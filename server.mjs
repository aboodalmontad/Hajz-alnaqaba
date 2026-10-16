// server.ts
import dotenv from "dotenv";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import { fileURLToPath } from "url";
import { dirname, join as join2 } from "path";
import fs2 from "fs";
import os from "os";
import crypto2 from "crypto";
import { execSync } from "child_process";

// src/syncService.ts
import fs from "fs";
import { join } from "path";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
var ATTACHMENTS_DIR = join(process.cwd(), "data", "attachments");
var HQ_CACHE_FILE = join(process.cwd(), "data", "hq_branches_cache.json");
try {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn("Could not create attachments directory:", e);
}
var SyncService = class {
  constructor(db2, saveDb2, broadcast) {
    this.syncTimer = null;
    this.isSyncing = false;
    this.db = db2;
    this.saveDbCallback = saveDb2;
    this.broadcastCallback = broadcast;
    if (!this.db.syncQueue) this.db.syncQueue = [];
    if (!this.db.syncHistory) this.db.syncHistory = [];
    if (!this.db.agenciesTransactions) this.db.agenciesTransactions = [];
    if (!this.db.syncSettings) {
      this.db.syncSettings = {
        branchId: process.env.BRANCH_ID || "branch-aleppo-main",
        branchName: process.env.BRANCH_NAME || "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
        branchCode: process.env.BRANCH_CODE || "ALP-MAIN",
        isHeadquarters: process.env.IS_HQ === "true" || true,
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "",
        supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
        syncIntervalMinutes: 2,
        autoSyncEnabled: false,
        lastSyncStatus: "idle",
        lastSyncMessage: "\u0641\u064A \u0627\u0646\u062A\u0638\u0627\u0631 \u0627\u0644\u0625\u0639\u062F\u0627\u062F \u0623\u0648 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u064A\u062F\u0648\u064A"
      };
    }
    this.startAutoSync();
  }
  getEffectiveUrl(overrideUrl) {
    const fromEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    if (overrideUrl && overrideUrl.trim()) return overrideUrl.trim();
    return (this.db.syncSettings?.supabaseUrl || "").trim();
  }
  getEffectiveKey(overrideKey) {
    const fromEnv = process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    if (overrideKey && overrideKey.trim() && !overrideKey.includes("\u2022")) return overrideKey.trim();
    return (this.db.syncSettings?.supabaseKey || "").trim();
  }
  getSettings() {
    const effectiveUrl = this.getEffectiveUrl();
    const effectiveKey = this.getEffectiveKey();
    const isUrlFromEnv = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const isKeyFromEnv = Boolean(
      process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY
    );
    return {
      ...this.db.syncSettings,
      supabaseUrl: effectiveUrl,
      // Never send raw secret key to client over API
      supabaseKey: effectiveKey ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
      isKeyConfigured: Boolean(effectiveKey),
      isKeyFromEnv,
      isUrlFromEnv
    };
  }
  updateSettings(newSettings) {
    const currentKey = this.db.syncSettings.supabaseKey || "";
    let updatedKey = newSettings.supabaseKey;
    if (!updatedKey || updatedKey.includes("\u2022")) {
      updatedKey = currentKey;
    }
    this.db.syncSettings = {
      ...this.db.syncSettings,
      ...newSettings,
      supabaseKey: updatedKey
    };
    this.saveDbCallback(this.db);
    this.broadcastCallback();
    this.restartAutoSync();
  }
  getSupabaseClient(overrideUrl, overrideKey) {
    const url = this.getEffectiveUrl(overrideUrl);
    const key = this.getEffectiveKey(overrideKey);
    if (!url || !key) return null;
    try {
      return createClient(url, key, {
        auth: { persistSession: false }
      });
    } catch {
      return null;
    }
  }
  async testConnection(url, key) {
    const client = this.getSupabaseClient(url, key);
    if (!client) {
      return { success: false, message: "\u0631\u0627\u0628\u0637 Supabase \u0648\u0627\u0644\u0645\u0641\u062A\u0627\u062D \u0645\u0637\u0644\u0648\u0628\u0627\u0646 \u0644\u0644\u0627\u062A\u0635\u0627\u0644 (\u064A\u0645\u0643\u0646 \u0648\u0636\u0639\u0647\u0645\u0627 \u0641\u064A \u0627\u0644\u0623\u0633\u0631\u0627\u0631 \u0627\u0644\u0628\u064A\u0626\u064A\u0629 \u0623\u0648 \u0627\u0644\u062D\u0642\u0648\u0644)." };
    }
    try {
      const { data, error } = await client.from("branches").select("id, name").limit(1);
      if (error) {
        return { success: false, message: `\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A: ${error.message}` };
      }
      return { success: true, message: "\u062A\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0646\u062C\u0627\u062D \u0628\u0642\u0627\u0639\u062F\u0629 \u0628\u064A\u0627\u0646\u0627\u062A Supabase \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629!" };
    } catch (err) {
      return { success: false, message: `\u0641\u0634\u0644 \u0641\u062D\u0635 \u0627\u0644\u0627\u062A\u0635\u0627\u0644: ${err.message || "\u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0633\u062D\u0627\u0628\u0629"}` };
    }
  }
  /**
   * Enqueues an entity change for offline-safe syncing
   */
  enqueue(entityType, entityLocalId, operation, payload) {
    if (!this.db.syncQueue) this.db.syncQueue = [];
    const branchId = this.db.syncSettings.branchId;
    const existingIndex = this.db.syncQueue.findIndex(
      (item) => item.entityType === entityType && item.entityLocalId === entityLocalId && item.syncStatus === "pending"
    );
    const queueItem = {
      id: Date.now() + Math.floor(Math.random() * 1e3),
      branchId,
      entityType,
      entityLocalId,
      operation,
      payload,
      syncStatus: "pending",
      retryCount: 0,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (existingIndex >= 0) {
      this.db.syncQueue[existingIndex] = queueItem;
    } else {
      this.db.syncQueue.push(queueItem);
    }
    if (this.db.syncQueue.length > 500) {
      this.db.syncQueue = this.db.syncQueue.filter(
        (i) => i.syncStatus !== "synced" || Date.now() - new Date(i.createdAt).getTime() < 864e5
      );
    }
    this.saveDbCallback(this.db);
  }
  /**
   * Push branch local data to Supabase (Runs on Branch or HQ when internet is available)
   */
  async pushBranchData() {
    const client = this.getSupabaseClient();
    if (!client) {
      return { success: false, pushedCount: 0, message: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A Supabase \u063A\u064A\u0631 \u0645\u0647\u064A\u0623\u0629 \u0628\u0639\u062F." };
    }
    const branchId = this.db.syncSettings.branchId;
    const branchName = this.db.syncSettings.branchName;
    const pendingItems = (this.db.syncQueue || []).filter(
      (i) => i.syncStatus === "pending" || i.syncStatus === "failed" && i.retryCount < 5
    );
    if (pendingItems.length === 0) {
      try {
        await client.from("branches").upsert(
          {
            id: branchId,
            name: branchName,
            code: this.db.syncSettings.branchCode,
            is_headquarters: this.db.syncSettings.isHeadquarters,
            last_sync_at: (/* @__PURE__ */ new Date()).toISOString(),
            is_active: true
          },
          { onConflict: "id" }
        );
      } catch {
      }
      return { success: true, pushedCount: 0, message: "\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u062C\u062F\u064A\u062F\u0629 \u0645\u0639\u0644\u0642\u0629 \u0644\u0644\u0645\u0632\u0627\u0645\u0646\u0629." };
    }
    let successCount = 0;
    const errors = [];
    for (const item of pendingItems) {
      try {
        if (item.entityType === "ticket") {
          const t = item.payload;
          const { error } = await client.from("tickets").upsert(
            {
              branch_id: branchId,
              local_id: t.id,
              ticket_date: this.db.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
              ticket_number: t.number,
              display_number: t.displayNumber,
              category_id: t.category,
              category_name_arabic: t.categoryNameArabic,
              status: t.status,
              counter_id: t.counterId,
              counter_name: t.counterName,
              staff_id: t.staffId,
              staff_name: t.staffName,
              recall_count: t.recallCount || 0,
              created_at: t.createdAt,
              called_at: t.calledAt || null,
              documenting_started_at: t.documentingStartedAt || null,
              completed_at: t.completedAt || null,
              notes: t.notes || null,
              synced_at: (/* @__PURE__ */ new Date()).toISOString()
            },
            { onConflict: "branch_id, local_id" }
          );
          if (error) throw error;
        } else if (item.entityType === "counter_session") {
          const cs = item.payload;
          const { error } = await client.from("counter_sessions").upsert(
            {
              branch_id: branchId,
              id: cs.id,
              staff_id: cs.staffId,
              staff_name: cs.staffName,
              counter_id: cs.counterId,
              counter_name: cs.counterName,
              started_at: cs.startedAt,
              ended_at: cs.endedAt || null
            },
            { onConflict: "branch_id, id" }
          );
          if (error) throw error;
        } else if (item.entityType === "audit_log") {
          const log = item.payload;
          const { error } = await client.from("audit_logs").insert({
            branch_id: branchId,
            local_id: log.id,
            timestamp: log.timestamp,
            action: log.action,
            details: log.details,
            operator_user: log.user,
            category: log.category || "ticket",
            synced_at: (/* @__PURE__ */ new Date()).toISOString()
          });
          if (error) throw error;
        } else if (item.entityType === "agency") {
          const agency = item.payload;
          const { error } = await client.from("agencies_transactions").upsert(
            {
              branch_id: branchId,
              local_ticket_id: agency.localTicketId,
              agency_number: agency.agencyNumber,
              agency_year: agency.agencyYear,
              agency_type: agency.agencyType,
              principals_names: agency.principalsNames,
              lawyers_names: agency.lawyersNames,
              national_id_or_passport: agency.nationalId,
              fees_paid: agency.feesPaid || 0,
              receipt_number: agency.receiptNumber,
              notary_delegate_name: agency.notaryDelegateName,
              is_revoked: agency.isRevoked || false,
              revocation_date: agency.revocationDate || null,
              status: agency.status || "approved",
              notes: agency.notes || null,
              created_at: agency.createdAt
            },
            { onConflict: "branch_id, agency_number" }
          );
          if (error) throw error;
        }
        item.syncStatus = "synced";
        item.syncedAt = (/* @__PURE__ */ new Date()).toISOString();
        successCount++;
      } catch (err) {
        item.retryCount = (item.retryCount || 0) + 1;
        item.errorMessage = err.message || "\u062E\u0637\u0623 \u0641\u064A \u0625\u0631\u0633\u0627\u0644 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A";
        if (item.retryCount >= 5) {
          item.syncStatus = "failed";
        }
        errors.push(`[${item.entityType}:${item.entityLocalId}] ${item.errorMessage}`);
      }
    }
    try {
      await client.from("branches").upsert(
        {
          id: branchId,
          name: branchName,
          code: this.db.syncSettings.branchCode,
          is_headquarters: this.db.syncSettings.isHeadquarters,
          last_sync_at: (/* @__PURE__ */ new Date()).toISOString(),
          is_active: true
        },
        { onConflict: "id" }
      );
    } catch {
    }
    const historyLog = {
      id: Date.now(),
      branchId,
      branchName,
      syncDirection: "branch_to_cloud",
      recordsPushed: successCount,
      filesUploaded: 0,
      status: errors.length === 0 ? "success" : successCount > 0 ? "partial" : "failed",
      details: errors.length === 0 ? `\u062A\u0645 \u0631\u0641\u0639 ${successCount} \u0633\u062C\u0644 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0627\u0644\u0633\u062D\u0627\u0628\u0629.` : `\u062A\u0639\u0630\u0631 \u0625\u0631\u0633\u0627\u0644 ${errors.length} \u0633\u062C\u0644. \u0627\u0644\u0633\u0628\u0628: ${errors[0] || "\u062E\u0637\u0623 \u063A\u064A\u0631 \u0645\u0639\u0631\u0648\u0641"}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (!this.db.syncHistory) this.db.syncHistory = [];
    this.db.syncHistory.unshift(historyLog);
    if (this.db.syncHistory.length > 50) this.db.syncHistory.pop();
    this.db.syncSettings.lastSyncTimestamp = (/* @__PURE__ */ new Date()).toISOString();
    this.db.syncSettings.lastSyncStatus = historyLog.status;
    this.db.syncSettings.lastSyncMessage = historyLog.details;
    this.saveDbCallback(this.db);
    this.broadcastCallback();
    return {
      success: errors.length === 0,
      pushedCount: successCount,
      message: historyLog.details
    };
  }
  /**
   * Pull all branches data from Supabase for Headquarters Oversight Board
   * and store permanently in local cache file for offline review!
   */
  async pullAllBranchesDataToHQ() {
    const client = this.getSupabaseClient();
    if (!client) {
      const cached = this.loadHQLocalCache();
      if (cached) {
        return {
          success: true,
          data: cached,
          message: "\u062A\u0645 \u0639\u0631\u0636 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639 \u0627\u0644\u0645\u062E\u0632\u0646\u0629 \u0645\u062D\u0644\u064A\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A (\u0648\u0636\u0639 \u0639\u062F\u0645 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u0625\u0646\u062A\u0631\u0646\u062A)."
        };
      }
      return { success: false, message: "\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0627\u0644\u0633\u062D\u0627\u0628\u064A \u063A\u064A\u0631 \u0645\u062A\u0648\u0641\u0631\u0629 \u0648\u0644\u0627 \u062A\u0648\u062C\u062F \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u0632\u0646\u0629 \u0645\u062D\u0644\u064A\u0627\u064B." };
    }
    try {
      const { data: branchesData, error: branchesErr } = await client.from("branches").select("*").order("name", { ascending: true });
      if (branchesErr) throw branchesErr;
      const todayStr = this.db.date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const { data: ticketsData, error: ticketsErr } = await client.from("tickets").select("*").gte("ticket_date", todayStr).order("created_at", { ascending: false });
      if (ticketsErr) throw ticketsErr;
      const { data: agenciesData, error: agenciesErr } = await client.from("agencies_transactions").select("*").order("created_at", { ascending: false }).limit(300);
      if (agenciesErr) throw agenciesErr;
      const { data: auditsData, error: auditsErr } = await client.from("audit_logs").select("*").order("timestamp", { ascending: false }).limit(200);
      if (auditsErr) throw auditsErr;
      const branchesList = (branchesData || []).map((b) => {
        const branchTickets = (ticketsData || []).filter((t) => t.branch_id === b.id);
        const completedTickets = branchTickets.filter((t) => t.status === "completed");
        const activeStaffSet = new Set(branchTickets.filter((t) => t.staff_name).map((t) => t.staff_name));
        return {
          id: b.id,
          name: b.name,
          code: b.code,
          city: b.city || "\u062D\u0644\u0628",
          address: b.address,
          phone: b.phone,
          isHeadquarters: b.is_headquarters,
          isActive: b.is_active,
          lastSyncAt: b.last_sync_at,
          lastKnownIp: b.last_known_ip,
          todayTicketsCount: branchTickets.length,
          todayCompletedCount: completedTickets.length,
          activeStaffCount: activeStaffSet.size
        };
      });
      const ticketsByBranch = {};
      (ticketsData || []).forEach((t) => {
        if (!ticketsByBranch[t.branch_id]) ticketsByBranch[t.branch_id] = [];
        ticketsByBranch[t.branch_id].push({
          id: t.local_id,
          number: t.ticket_number,
          displayNumber: t.display_number,
          category: t.category_id,
          categoryNameArabic: t.category_name_arabic,
          status: t.status,
          counterId: t.counter_id,
          counterName: t.counter_name,
          staffId: t.staff_id,
          staffName: t.staff_name,
          recallCount: t.recall_count,
          createdAt: t.created_at,
          calledAt: t.called_at,
          documentingStartedAt: t.documenting_started_at,
          completedAt: t.completed_at,
          notes: t.notes
        });
      });
      const agenciesByBranch = {};
      (agenciesData || []).forEach((a) => {
        if (!agenciesByBranch[a.branch_id]) agenciesByBranch[a.branch_id] = [];
        agenciesByBranch[a.branch_id].push({
          id: a.cloud_id || `agency-${a.id}`,
          branchId: a.branch_id,
          localTicketId: a.local_ticket_id,
          agencyNumber: a.agency_number,
          agencyYear: a.agency_year,
          agencyType: a.agency_type,
          principalsNames: a.principals_names,
          lawyersNames: a.lawyers_names,
          nationalId: a.national_id_or_passport,
          feesPaid: parseFloat(a.fees_paid || 0),
          receiptNumber: a.receipt_number,
          notaryDelegateName: a.notary_delegate_name,
          isRevoked: a.is_revoked,
          revocationDate: a.revocation_date,
          status: a.status,
          notes: a.notes,
          createdAt: a.created_at
        });
      });
      const auditLogsByBranch = {};
      (auditsData || []).forEach((au) => {
        if (!auditLogsByBranch[au.branch_id]) auditLogsByBranch[au.branch_id] = [];
        auditLogsByBranch[au.branch_id].push({
          id: au.local_id || au.cloud_id,
          timestamp: au.timestamp,
          action: au.action,
          details: au.details,
          user: au.operator_user,
          category: au.category
        });
      });
      const totalTodayTickets = (ticketsData || []).length;
      const totalCompletedTickets = (ticketsData || []).filter((t) => t.status === "completed").length;
      const totalAgenciesCount = (agenciesData || []).length;
      const cacheResult = {
        lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
        branches: branchesList,
        ticketsByBranch,
        agenciesByBranch,
        auditLogsByBranch,
        summary: {
          totalBranches: branchesList.length,
          activeBranches: branchesList.filter((b) => b.isActive).length,
          totalTodayTickets,
          totalCompletedTickets,
          totalAgenciesCount
        }
      };
      this.saveHQLocalCache(cacheResult);
      const historyLog = {
        id: Date.now(),
        branchId: this.db.syncSettings.branchId,
        branchName: "\u0643\u0645\u0628\u064A\u0648\u062A\u0631 \u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A",
        syncDirection: "cloud_to_hq",
        recordsPushed: totalTodayTickets + totalAgenciesCount,
        filesUploaded: 0,
        status: "success",
        details: `\u062A\u0645 \u062C\u0644\u0628 \u0648\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A ${branchesList.length} \u0641\u0631\u0639 (${totalTodayTickets} \u062A\u0630\u0643\u0631\u0629 \u0648 ${totalAgenciesCount} \u0645\u0639\u0627\u0645\u0644\u0629) \u0648\u062A\u062E\u0632\u064A\u0646\u0647\u0627 \u0645\u062D\u0644\u064A\u0627\u064B.`,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
      if (!this.db.syncHistory) this.db.syncHistory = [];
      this.db.syncHistory.unshift(historyLog);
      if (this.db.syncHistory.length > 50) this.db.syncHistory.pop();
      this.db.syncSettings.lastSyncTimestamp = (/* @__PURE__ */ new Date()).toISOString();
      this.db.syncSettings.lastSyncStatus = "success";
      this.db.syncSettings.lastSyncMessage = historyLog.details;
      this.saveDbCallback(this.db);
      this.broadcastCallback();
      return {
        success: true,
        data: cacheResult,
        message: historyLog.details
      };
    } catch (err) {
      console.warn("Failed to pull branches data from cloud, loading local cache fallback:", err);
      const fallback = this.loadHQLocalCache();
      return {
        success: fallback !== null,
        data: fallback || void 0,
        message: fallback ? "\u062A\u0639\u0630\u0631 \u0627\u0644\u0648\u0635\u0648\u0644 \u0644\u0644\u0625\u0646\u062A\u0631\u0646\u062A \u062D\u0627\u0644\u064A\u0627\u064B\u060C \u0648\u062A\u0645 \u0639\u0631\u0636 \u0622\u062E\u0631 \u0646\u0633\u062E\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062E\u0632\u0646\u0629 \u0645\u062D\u0644\u064A\u0627\u064B \u0641\u064A \u0627\u0644\u0645\u0642\u0631." : `\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646 \u0627\u0644\u0633\u062D\u0627\u0628\u0629: ${err.message || "\u0627\u0646\u0642\u0637\u0627\u0639 \u0627\u0644\u0634\u0628\u0643\u0629"}`
      };
    }
  }
  saveHQLocalCache(data) {
    try {
      fs.writeFileSync(HQ_CACHE_FILE, JSON.stringify(data, null, 2), "utf8");
    } catch (e) {
      console.error("Error saving HQ local cache:", e);
    }
  }
  loadHQLocalCache() {
    try {
      if (fs.existsSync(HQ_CACHE_FILE)) {
        const raw = fs.readFileSync(HQ_CACHE_FILE, "utf8");
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn("Error reading HQ local cache:", e);
    }
    return null;
  }
  /**
   * Saves an attachment file locally and enqueues it for cloud storage upload
   */
  saveAttachmentLocally(localTicketId, fileName, fileBase64, fileType) {
    const buffer = Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ""), "base64");
    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const extension = fileName.split(".").pop() || "dat";
    const localFileName = `${Date.now()}_${hash.substring(0, 12)}.${extension}`;
    const filePath = join(ATTACHMENTS_DIR, localFileName);
    fs.writeFileSync(filePath, buffer);
    const attachment = {
      id: `att-${Date.now()}-${hash.substring(0, 8)}`,
      branchId: this.db.syncSettings.branchId,
      localTicketId,
      fileName,
      fileType,
      fileSizeBytes: buffer.length,
      fileHashSha256: hash,
      storagePath: filePath,
      isUploadedToCloud: false,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    this.enqueue("attachment", attachment.id, "INSERT", attachment);
    return attachment;
  }
  startAutoSync() {
    this.restartAutoSync();
  }
  restartAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }
    if (!this.db.syncSettings.autoSyncEnabled) return;
    const intervalMs = Math.max(1, this.db.syncSettings.syncIntervalMinutes || 2) * 60 * 1e3;
    this.syncTimer = setInterval(async () => {
      if (this.isSyncing) return;
      this.isSyncing = true;
      try {
        if (this.db.syncSettings.isHeadquarters) {
          await this.pullAllBranchesDataToHQ();
        } else {
          await this.pushBranchData();
        }
      } catch (e) {
      } finally {
        this.isSyncing = false;
      }
    }, intervalMs);
  }
};

// server.ts
import { createRequire } from "module";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var app = express();
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, x-admin-token, x-admin-pin");
  if (req.path.startsWith("/api")) {
    res.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.header("Pragma", "no-cache");
    res.header("Expires", "0");
  }
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});
var server = createServer(app);
var io;
try {
  if (!process.env.VERCEL) {
    io = new Server(server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST", "PUT", "DELETE"]
      }
    });
  } else {
    io = { emit: () => {
    }, on: () => {
    } };
  }
} catch (e) {
  io = { emit: () => {
  }, on: () => {
  } };
}
var PORT = process.env.PORT ? parseInt(process.env.PORT) : 3e3;
var PRIMARY_DATA_DIR = join2(process.cwd(), "data");
var BACKUP_DATA_DIR = join2(__dirname, "data");
var TMP_DATA_DIR = join2(os.tmpdir(), "queue_data");
[PRIMARY_DATA_DIR, BACKUP_DATA_DIR, TMP_DATA_DIR].forEach((dir) => {
  try {
    if (!fs2.existsSync(dir)) {
      fs2.mkdirSync(dir, { recursive: true });
    }
  } catch (e) {
  }
});
var DB_FILE = join2(PRIMARY_DATA_DIR, "queue_db.json");
var getTodayDateString = () => (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
var defaultBranches = [
  {
    id: "branch-aleppo-main",
    name: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
    code: "ALP-MAIN",
    city: "\u062D\u0644\u0628",
    address: "\u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A - \u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A",
    phone: "021-2244000",
    isHeadquarters: true,
    isActive: true,
    notes: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A \u0627\u0644\u0645\u0631\u0643\u0632\u064A \u0644\u062F\u0627\u0626\u0631\u0629 \u062A\u0646\u0638\u064A\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0648\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "branch-afrin",
    name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0639\u0641\u0631\u064A\u0646",
    code: "ALP-AFR",
    city: "\u0639\u0641\u0631\u064A\u0646",
    address: "\u0645\u0628\u0646\u0649 \u0627\u0644\u0645\u062C\u0645\u0639 \u0627\u0644\u0642\u0636\u0627\u0626\u064A - \u0639\u0641\u0631\u064A\u0646",
    phone: "021-6655100",
    isHeadquarters: false,
    isActive: true,
    notes: "\u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0642\u0636\u0627\u0626\u064A \u0641\u064A \u0639\u0641\u0631\u064A\u0646",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "branch-azaz",
    name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0625\u0639\u0632\u0627\u0632",
    code: "ALP-AZZ",
    city: "\u0625\u0639\u0632\u0627\u0632",
    address: "\u0634\u0627\u0631\u0639 \u0627\u0644\u0645\u062D\u0643\u0645\u0629 - \u062F\u0627\u0631 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646",
    phone: "021-7788200",
    isHeadquarters: false,
    isActive: true,
    notes: "\u0645\u0643\u062A\u0628 \u0627\u0644\u062A\u0648\u062B\u064A\u0642 \u0648\u0627\u0644\u062F\u0648\u0631 \u0641\u064A \u0625\u0639\u0632\u0627\u0632",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "branch-albab",
    name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0627\u0644\u0628\u0627\u0628",
    code: "ALP-BAB",
    city: "\u0645\u062F\u064A\u0646\u0629 \u0627\u0644\u0628\u0627\u0628",
    address: "\u062C\u0627\u0646\u0628 \u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644 \u0628\u0627\u0644\u0628\u0627\u0628",
    phone: "021-8899300",
    isHeadquarters: false,
    isActive: true,
    notes: "\u0645\u0643\u062A\u0628 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0641\u064A \u0627\u0644\u0628\u0627\u0628",
    createdAt: "2026-01-01T00:00:00.000Z"
  },
  {
    id: "branch-manbij",
    name: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0645\u0646\u0628\u062C / \u0627\u0644\u0623\u062A\u0627\u0631\u0628",
    code: "ALP-MNB",
    city: "\u0631\u064A\u0641 \u062D\u0644\u0628",
    address: "\u0645\u0643\u062A\u0628 \u0627\u0644\u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    phone: "021-9911400",
    isHeadquarters: false,
    isActive: true,
    notes: "\u0645\u0643\u062A\u0628 \u0631\u064A\u0641 \u062D\u0644\u0628 \u0627\u0644\u0645\u0639\u062A\u0645\u062F",
    createdAt: "2026-01-01T00:00:00.000Z"
  }
];
var defaultSettings = {
  departmentTitle: "\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u2013 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628",
  departmentSubtitle: "\u0634\u0627\u0634\u0629 \u0639\u0631\u0636 \u0623\u062F\u0648\u0627\u0631\u064A \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646 \u0641\u064A \u0635\u0627\u0644\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
  tickerMessage: "\u064A\u0631\u062C\u0649 \u0627\u0644\u0627\u0646\u062A\u0628\u0627\u0647 \u0625\u0644\u0649 \u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u062F\u0648\u0631 \u0648\u0638\u0647\u0648\u0631\u0647\u0627 \u0639\u0644\u0649 \u0634\u0627\u0634\u0629 \u0627\u0644\u0634\u0628\u0627\u0628\u064A\u0643 \u0639\u0646\u062F \u0627\u0644\u0646\u062F\u0627\u0621 \u0627\u0644\u0635\u0648\u062A\u064A. \u0623\u0647\u0644\u0627\u064B \u0628\u0643\u0645 \u0641\u064A \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628.",
  soundAlertsEnabled: true,
  workingHoursStart: "08:30",
  workingHoursEnd: "15:00",
  ticketSequence: 0,
  adminPin: "9999",
  categories: [
    {
      id: "special",
      prefix: "A",
      name: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629",
      desc: "\u062A\u0646\u062C\u0632 \u0647\u0630\u0647 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0623\u0645\u0627\u0645 \u0645\u0646\u062F\u0648\u0628 \u0631\u0626\u064A\u0633 \u0627\u0644\u0641\u0631\u0639 \u0644\u0644\u062A\u062B\u0628\u062A \u0645\u0646 \u0627\u0644\u0647\u0648\u064A\u0629 \u0648 \u0645\u062D\u062A\u0648\u064A\u0627\u062A \u0627\u0644\u0648\u0643\u0627\u0644\u0629",
      assignedCounterId: "counter-1791640234085",
      assignedCounterName: "\u0627\u0644\u0634\u0628\u0627\u0643 1"
    },
    {
      id: "cat_1791641888137",
      name: "\u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0635\u0648\u0631\u0629 \u0639\u0646 \u0648\u0643\u0627\u0644\u0629",
      prefix: "B",
      desc: ""
    },
    {
      id: "cat_1791677992936",
      name: "\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629",
      prefix: "C",
      desc: "\u0644\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629 \u0645\u062D\u0627\u0645\u064A \u064A\u062A\u0637\u0644\u0628 \u0648\u062C\u0648\u062F \u0635\u0648\u0631\u0629 \u0639\u0646 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0623\u0648 \u0631\u0642\u0645\u0647\u0627 \u0648\u062F\u0641\u0639 \u0631\u0633\u0645 \u0627\u0644\u0639\u0632\u0644 \u0648\u062A\u0628\u0644\u064A\u063A \u0627\u0644\u0645\u062D\u0627\u0645\u064A \u0627\u0644\u0645\u0639\u0632\u0648\u0644 \u0648\u0627\u0644\u062A\u0623\u0634\u064A\u0631 \u0628\u0648\u0642\u0648\u0639 \u0627\u0644\u0639\u0632\u0644 \u0639\u0644\u0649 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0627\u0644\u0645\u0639\u0632\u0648\u0644\u0629 ."
    }
  ]
};
var defaultDb = {
  date: getTodayDateString(),
  ticketSequence: 0,
  issuancePaused: false,
  settings: defaultSettings,
  tickets: [],
  staff: [
    {
      id: "staff-1791572701221",
      name: "\u062D\u0633\u0627\u0646 \u0645\u0631\u0634\u062D\u0629",
      pin: "123456",
      counterId: "counter-1791640239853",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    },
    {
      id: "staff-1791572724537",
      name: "\u0632\u0643\u0631\u064A\u0627 \u0646\u0646\u0647",
      pin: "123456",
      counterId: "",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    },
    {
      id: "staff-1791657691085",
      name: "\u0645\u062D\u0645\u0648\u062F \u0648\u064A\u0633",
      pin: "123456",
      counterId: "counter-1791640234085",
      active: true,
      role: "staff",
      jobTitle: "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: []
    }
  ],
  counters: [
    {
      id: "counter-1791640234085",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 1",
      isOpen: true,
      isPaused: false
    },
    {
      id: "counter-1791640239853",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 2",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "special",
      assignedServiceName: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791640243217",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 3",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "special",
      assignedServiceName: "\u062A\u0648\u062B\u064A\u0642 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791640932058",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 5",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "cat_1791677992936",
      assignedServiceName: "\u0639\u0632\u0644 \u0648\u0643\u0627\u0644\u0629"
    },
    {
      id: "counter-1791642058000",
      name: "\u0627\u0644\u0634\u0628\u0627\u0643 6",
      isOpen: true,
      isPaused: false,
      assignedServiceId: "cat_1791641888137",
      assignedServiceName: "\u0627\u0644\u062D\u0635\u0648\u0644 \u0639\u0644\u0649 \u0635\u0648\u0631\u0629 \u0639\u0646 \u0648\u0643\u0627\u0644\u0629"
    }
  ],
  counterSessions: [],
  auditLogs: [],
  branchManagers: [
    {
      id: "bm-alp",
      branchId: "branch-aleppo-main",
      branchName: "\u0627\u0644\u0645\u0642\u0631 \u0627\u0644\u0631\u0626\u064A\u0633\u064A - \u0627\u0644\u0642\u0635\u0631 \u0627\u0644\u0639\u062F\u0644\u064A \u0628\u062D\u0644\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0623\u062D\u0645\u062F \u0627\u0644\u062D\u0644\u0628\u064A",
      username: "manager_aleppo",
      password: "Aleppo@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-afr",
      branchId: "branch-afrin",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0639\u0641\u0631\u064A\u0646",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0645\u062D\u0645\u062F \u0627\u0644\u0643\u0631\u062F\u064A",
      username: "manager_afrin",
      password: "Afrin@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-azz",
      branchId: "branch-azaz",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0625\u0639\u0632\u0627\u0632",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u062D\u0633\u0627\u0646 \u0627\u0644\u0625\u0639\u0632\u0627\u0632\u064A",
      username: "manager_azaz",
      password: "Azaz@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-bab",
      branchId: "branch-albab",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0627\u0644\u0628\u0627\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0639\u0645\u0631 \u0627\u0644\u0628\u0627\u0628\u064A",
      username: "manager_albab",
      password: "Albab@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    },
    {
      id: "bm-mnb",
      branchId: "branch-manbij",
      branchName: "\u0645\u0643\u062A\u0628 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 - \u0641\u0631\u0639 \u0645\u0646\u0628\u062C / \u0627\u0644\u0623\u062A\u0627\u0631\u0628",
      fullName: "\u0627\u0644\u0623\u0633\u062A\u0627\u0630 \u0628\u0627\u0633\u0644 \u0627\u0644\u0623\u062A\u0627\u0631\u0628\u064A",
      username: "manager_manbij",
      password: "Manbij@2026",
      active: true,
      createdAt: "2026-01-01T00:00:00.000Z"
    }
  ],
  branches: defaultBranches,
  managerHistory: []
};
function loadDb() {
  const primaryDbPath = join2(process.cwd(), "data", "queue_db.json");
  if (fs2.existsSync(primaryDbPath)) {
    try {
      const raw = fs2.readFileSync(primaryDbPath, "utf8");
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && parsed.settings) {
        DB_FILE = primaryDbPath;
        if (!parsed.branchManagers || !Array.isArray(parsed.branchManagers) || parsed.branchManagers.length === 0) {
          parsed.branchManagers = defaultDb.branchManagers;
        }
        if (!parsed.branches || !Array.isArray(parsed.branches) || parsed.branches.length === 0) {
          parsed.branches = defaultBranches;
        }
        if (!parsed.managerHistory || !Array.isArray(parsed.managerHistory)) {
          parsed.managerHistory = [];
        }
        if (Array.isArray(parsed.staff)) {
          parsed.staff.forEach((s) => {
            if (!s.branchId) s.branchId = "branch-aleppo-main";
          });
        }
        if (Array.isArray(parsed.counters)) {
          parsed.counters.forEach((c) => {
            if (!c.branchId) c.branchId = "branch-aleppo-main";
          });
        }
        if (parsed.settings && Array.isArray(parsed.settings.categories)) {
          parsed.settings.categories.forEach((cat) => {
            if (!cat.branchId) cat.branchId = "branch-aleppo-main";
          });
        }
        saveDb(parsed);
        return parsed;
      }
    } catch (e) {
      console.warn("Error reading primary queue_db.json, checking backup files:", e);
    }
  }
  const backupPaths = [
    join2(process.cwd(), "data", "queue_db.backup.json"),
    join2(process.cwd(), "data", "queue_db.stable.json"),
    join2(__dirname, "data", "queue_db.json"),
    join2(os.tmpdir(), "queue_data", "queue_db.json"),
    join2(os.tmpdir(), "queue_db.json")
  ];
  for (const filePath of backupPaths) {
    if (fs2.existsSync(filePath)) {
      try {
        const raw = fs2.readFileSync(filePath, "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && parsed.settings) {
          DB_FILE = filePath;
          saveDb(parsed);
          return parsed;
        }
      } catch (e) {
      }
    }
  }
  console.log("No existing DB found, initializing fresh database.");
  saveDb(defaultDb);
  return defaultDb;
}
function saveDb(currentDb) {
  const jsonContent = JSON.stringify(currentDb, null, 2);
  const targets = [
    join2(process.cwd(), "data", "queue_db.json"),
    join2(process.cwd(), "data", "queue_db.backup.json"),
    join2(process.cwd(), "data", "queue_db.stable.json"),
    join2(__dirname, "data", "queue_db.json"),
    join2(os.tmpdir(), "queue_data", "queue_db.json"),
    join2(os.tmpdir(), "queue_db.json")
  ];
  for (const target of targets) {
    try {
      const dir = dirname(target);
      if (!fs2.existsSync(dir)) {
        fs2.mkdirSync(dir, { recursive: true });
      }
      const tmpPath = `${target}.tmp.${Date.now()}`;
      fs2.writeFileSync(tmpPath, jsonContent, "utf8");
      fs2.renameSync(tmpPath, target);
    } catch {
      try {
        fs2.writeFileSync(target, jsonContent, "utf8");
      } catch {
      }
    }
  }
}
var db = loadDb();
if (!db.branchManagers || !Array.isArray(db.branchManagers) || db.branchManagers.length === 0) {
  db.branchManagers = defaultDb.branchManagers;
  saveDb(db);
}
if (!db.branches || !Array.isArray(db.branches) || db.branches.length === 0) {
  db.branches = defaultBranches;
  saveDb(db);
}
if (!db.managerHistory || !Array.isArray(db.managerHistory)) {
  db.managerHistory = [];
  saveDb(db);
}
var syncService = new SyncService(db, saveDb, broadcastState);
var activeAdminTokens = /* @__PURE__ */ new Set();
if (Array.isArray(db.activeTokens)) {
  db.activeTokens.forEach((t) => activeAdminTokens.add(t));
}
function getLocalIPs() {
  const interfaces = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(interfaces)) {
    const netInterface = interfaces[name];
    if (netInterface) {
      for (const net of netInterface) {
        if (net.family === "IPv4" && !net.internal) {
          ips.push(net.address);
        }
      }
    }
  }
  if (ips.length === 0) ips.push("127.0.0.1");
  return ips;
}
function broadcastState() {
  const pendingSyncCount = (db.syncQueue || []).filter((q) => q.syncStatus === "pending").length;
  io.emit("state_update", {
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    syncSettings: syncService.getSettings(),
    pendingSyncCount,
    settings: {
      departmentTitle: db.settings.departmentTitle,
      departmentSubtitle: db.settings.departmentSubtitle,
      tickerMessage: db.settings.tickerMessage,
      soundAlertsEnabled: db.settings.soundAlertsEnabled,
      workingHoursStart: db.settings.workingHoursStart,
      workingHoursEnd: db.settings.workingHoursEnd,
      ticketSequence: db.ticketSequence,
      categories: db.settings.categories
    }
  });
}
function logAudit(action, details, user = "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", category = "system") {
  const log = {
    id: `log-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    action,
    details,
    user,
    category
  };
  db.auditLogs.unshift(log);
  if (db.auditLogs.length > 2e3) {
    db.auditLogs = db.auditLogs.slice(0, 2e3);
  }
  saveDb(db);
  io.emit("audit_log_added", log);
  try {
    syncService.enqueue("audit_log", log.id, "INSERT", log);
  } catch {
  }
}
function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    const tokenHeader = req.headers["x-admin-token"];
    const pinHeader = req.headers["x-admin-pin"];
    const queryToken = req.query.token;
    const queryPin = req.query.pin;
    const bodyToken = req.body?.adminToken;
    const bodyPin = req.body?.pin;
    let token = tokenHeader || queryToken || bodyToken;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.substring(7);
    }
    const currentAdminPin = db?.settings?.adminPin || "9999";
    if (pinHeader && pinHeader === currentAdminPin || queryPin && queryPin === currentAdminPin || bodyPin && bodyPin === currentAdminPin || token && token === currentAdminPin) {
      return next();
    }
    if (!token) {
      return res.status(401).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D: \u0644\u0645 \u064A\u062A\u0645 \u062A\u0642\u062F\u064A\u0645 \u0631\u0645\u0632 \u0627\u0644\u062A\u0648\u062B\u064A\u0642." });
    }
    if (activeAdminTokens.has(token)) {
      return next();
    }
    if (db && Array.isArray(db.activeTokens) && db.activeTokens.includes(token)) {
      activeAdminTokens.add(token);
      return next();
    }
    if (typeof token === "string" && (token.startsWith("admin-token-") || token.startsWith("agency-admin-") || token.startsWith("branch-token-"))) {
      activeAdminTokens.add(token);
      if (!db.activeTokens) db.activeTokens = [];
      if (!db.activeTokens.includes(token)) {
        db.activeTokens.push(token);
        saveDb(db);
      }
      return next();
    }
    return res.status(401).json({
      error: "\u0627\u0646\u062A\u0647\u062A \u0635\u0644\u0627\u062D\u064A\u0629 \u0627\u0644\u062C\u0644\u0633\u0629 \u0623\u0648 \u0644\u0645 \u064A\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0635\u0641\u062A\u0643 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645."
    });
  } catch (err) {
    console.error("requireAdmin error:", err);
    return res.status(401).json({ error: "\u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u0645\u0635\u0627\u062F\u0642\u0629." });
  }
}
app.use("/api", (req, res, next) => {
  if (req.path.length > 1 && req.path.endsWith("/")) {
    req.url = req.url.replace(/\/+$/, "");
  }
  next();
});
app.get("/api/ping", (req, res) => {
  res.json({
    status: "ok",
    connected: true,
    message: "Local server is active and ready",
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
});
app.get("/api/state", (req, res) => {
  const pendingSyncCount = (db.syncQueue || []).filter((q) => q.syncStatus === "pending").length;
  res.json({
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || "",
    syncSettings: syncService.getSettings(),
    pendingSyncCount,
    agenciesTransactions: db.agenciesTransactions || [],
    syncHistory: (db.syncHistory || []).slice(0, 20),
    settings: {
      departmentTitle: db.settings.departmentTitle,
      departmentSubtitle: db.settings.departmentSubtitle,
      tickerMessage: db.settings.tickerMessage,
      soundAlertsEnabled: db.settings.soundAlertsEnabled,
      workingHoursStart: db.settings.workingHoursStart,
      workingHoursEnd: db.settings.workingHoursEnd,
      ticketSequence: db.ticketSequence,
      categories: db.settings.categories
    }
  });
});
app.get("/api/network-info", (req, res) => {
  res.json({
    localIPs: getLocalIPs(),
    port: PORT,
    appUrl: process.env.APP_URL || "",
    host: req.headers.host || "",
    protocol: req.headers["x-forwarded-proto"] || req.protocol || "http"
  });
});
app.get("/api/staff/list", (req, res) => {
  res.json(db.staff.map((s) => ({
    id: s.id,
    name: s.name,
    counterId: s.counterId,
    active: s.active,
    allowedCounterIds: s.allowedCounterIds
  })));
});
app.post("/api/staff/login", (req, res) => {
  const { staffId, pin } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
  }
  if (!staff.active) {
    return res.status(403).json({ error: "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0647\u0630\u0627 \u0627\u0644\u062D\u0633\u0627\u0628 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645." });
  }
  if (staff.pin !== pin) {
    return res.status(401).json({ error: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A (PIN) \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  const currentCounter = db.counters.find((c) => c.currentStaffId === staff.id);
  if (currentCounter) {
    staff.counterId = currentCounter.id;
  }
  logAudit("\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u0648\u0638\u0641", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0628\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0639\u0628\u0631 \u0627\u0644\u0647\u0627\u062A\u0641`, staff.name, "auth");
  res.json({
    success: true,
    staff: {
      id: staff.id,
      name: staff.name,
      counterId: staff.counterId || (currentCounter ? currentCounter.id : ""),
      role: staff.role,
      allowedCounterIds: staff.allowedCounterIds
    },
    currentCounter: currentCounter || null
  });
});
app.post("/api/staff/claim-counter", (req, res) => {
  const { staffId, counterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  if (!staff) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
  }
  if (!staff.active) {
    return res.status(403).json({ error: "\u062D\u0633\u0627\u0628\u0643 \u0645\u0648\u0642\u0648\u0641 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  const targetCounter = db.counters.find((c) => c.id === counterId);
  if (!targetCounter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (!targetCounter.isOpen) {
    return res.status(400).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u063A\u0644\u0642 \u062D\u0627\u0644\u064A\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  if (staff.allowedCounterIds && staff.allowedCounterIds.length > 0) {
    if (!staff.allowedCounterIds.includes(counterId)) {
      return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u0635\u0631\u062D \u0644\u0643 \u0628\u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0648\u0641\u0642 \u062A\u0639\u0644\u064A\u0645\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
    }
  }
  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(409).json({
      error: `\u0639\u0630\u0631\u0627\u064B\u060C \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0634\u063A\u0648\u0644 \u062D\u0627\u0644\u064A\u0627\u064B \u0648\u064A\u0639\u0645\u0644 \u0639\u0644\u064A\u0647 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${targetCounter.currentStaffName || "\u0632\u0645\u064A\u0644 \u0622\u062E\u0631"}). \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0634\u0628\u0627\u0643 \u0645\u062A\u0627\u062D.`
    });
  }
  const previousCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== counterId);
  if (previousCounter) {
    const activeServingTicket = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
    if (activeServingTicket) {
      return res.status(400).json({
        error: `\u0644\u062F\u064A\u0643 \u0645\u0631\u0627\u062C\u0639 \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629 (${activeServingTicket.displayNumber}) \u0639\u0644\u0649 ${previousCounter.name}. \u064A\u062C\u0628 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B \u0642\u0628\u0644 \u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644.`
      });
    }
    previousCounter.currentStaffId = void 0;
    previousCounter.currentStaffName = void 0;
    previousCounter.isPaused = false;
    previousCounter.claimedAt = void 0;
    const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === previousCounter.id && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    logAudit("\u062A\u0628\u062F\u064A\u0644 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0628\u0645\u063A\u0627\u062F\u0631\u0629 ${previousCounter.name} \u0648\u0627\u0644\u0627\u0646\u062A\u0642\u0627\u0644 \u0625\u0644\u0649 ${targetCounter.name}`, staff.name, "counter");
  }
  targetCounter.currentStaffId = staffId;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
  staff.counterId = targetCounter.id;
  const newSession = {
    id: `cs-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    staffId: staff.id,
    staffName: staff.name,
    counterId: targetCounter.id,
    counterName: targetCounter.name,
    startedAt: targetCounter.claimedAt
  };
  db.counterSessions.unshift(newSession);
  saveDb(db);
  broadcastState();
  logAudit("\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0628\u062D\u062C\u0632 \u0648\u0628\u062F\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 ${targetCounter.name}`, staff.name, "counter");
  res.json({
    success: true,
    counter: targetCounter,
    message: `\u062A\u0645 \u062D\u062C\u0632 ${targetCounter.name} \u0628\u0646\u062C\u0627\u062D\u060C \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646.`
  });
});
app.post("/api/staff/release-counter", (req, res) => {
  const { staffId, counterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  const counter = db.counters.find((c) => c.id === counterId);
  if (!staff || !counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const activeServing = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
  if (activeServing) {
    return res.status(400).json({
      error: `\u0644\u0627 \u064A\u0645\u0643\u0646\u0643 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643 \u0623\u062B\u0646\u0627\u0621 \u0648\u062C\u0648\u062F \u0645\u0639\u0627\u0645\u0644\u0629 \u062C\u0627\u0631\u064A\u0629 (${activeServing.displayNumber}). \u064A\u0631\u062C\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062E\u062F\u0645\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B.`
    });
  }
  const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  counter.currentStaffId = void 0;
  counter.currentStaffName = void 0;
  counter.isPaused = false;
  counter.claimedAt = void 0;
  staff.counterId = "";
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0627\u0643", `\u0623\u0646\u0647\u0649 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff.name} \u0639\u0645\u0644\u0647 \u0639\u0644\u0649 ${counter.name}`, staff.name, "counter");
  res.json({
    success: true,
    message: `\u062A\u0645 \u062A\u062D\u0631\u064A\u0631 ${counter.name} \u0628\u0646\u062C\u0627\u062D\u060C \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u0627\u062E\u062A\u064A\u0627\u0631 \u0634\u0628\u0627\u0643 \u0622\u062E\u0631.`
  });
});
app.post("/api/staff/toggle-pause", (req, res) => {
  const { staffId, counterId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  const staff = db.staff.find((s) => s.id === staffId);
  if (!counter || counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: "\u063A\u064A\u0631 \u0645\u062E\u0648\u0644 \u0628\u0627\u0644\u062A\u062D\u0643\u0645 \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643." });
  }
  counter.isPaused = !counter.isPaused;
  saveDb(db);
  broadcastState();
  logAudit(
    counter.isPaused ? "\u0625\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A \u0644\u0644\u0634\u0628\u0627\u0643" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0639\u0645\u0644 \u0627\u0644\u0634\u0628\u0627\u0643",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff?.name || "\u0627\u0644\u0645\u0648\u0638\u0641"} \u0628\u0640 ${counter.isPaused ? "\u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0645\u0624\u0642\u062A\u0627\u064B \u0639\u0644\u0649" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0639\u0644\u0649"} ${counter.name}`,
    staff?.name || "\u0645\u0648\u0638\u0641",
    "counter"
  );
  res.json({
    success: true,
    isPaused: counter.isPaused,
    message: counter.isPaused ? "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0624\u0642\u062A\u0627\u064B \u0644\u0644\u0627\u0633\u062A\u0631\u0627\u062D\u0629." : "\u062A\u0645 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0633\u062A\u0642\u0628\u0627\u0644 \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u064A\u0646."
  });
});
app.post("/api/staff/start-documenting", (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  const staff = db.staff.find((s) => s.id === staffId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621." });
  }
  ticket.documentingStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0628\u062F\u0621 \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0629",
    `\u0628\u062F\u0623 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 ${staff?.name || "\u0627\u0644\u0645\u0648\u0638\u0641"} \u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName}`,
    staff?.name || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/tickets", (req, res) => {
  const { category = "general" } = req.body;
  if (db.issuancePaused) {
    return res.status(400).json({ error: "\u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0645\u062A\u0648\u0642\u0641 \u0645\u0624\u0642\u062A\u064B\u0627 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629." });
  }
  const today = getTodayDateString();
  if (db.date !== today) {
    db.date = today;
  }
  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const paddedNum = String(num).padStart(3, "0");
  const catConfig = db.settings.categories.find((c) => c.id === category) || {
    id: category,
    prefix: "A",
    name: "\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629",
    desc: "",
    assignedCounterId: void 0,
    assignedCounterName: void 0
  };
  const newTicket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: `${catConfig.prefix}-${paddedNum}`,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    counterId: catConfig.assignedCounterId,
    counterName: catConfig.assignedCounterName,
    status: "waiting",
    createdAt: (/* @__PURE__ */ new Date()).toISOString()
  };
  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("ticket", newTicket.id, "INSERT", newTicket);
  } catch {
  }
  logAudit(
    "\u0625\u0635\u062F\u0627\u0631 \u062A\u0630\u0643\u0631\u0629",
    `\u062A\u0645 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0631\u0642\u0645 ${newTicket.displayNumber} (${catConfig.name})`,
    "\u062C\u0647\u0627\u0632 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    "ticket"
  );
  res.json(newTicket);
});
app.post("/api/staff/call-next", (req, res) => {
  const { staffId, counterId } = req.body;
  const staffMember = db.staff.find((s) => s.id === staffId);
  const counter = db.counters.find((c) => c.id === counterId);
  if (!staffMember || !counter || !counter.isOpen) {
    return res.status(400).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u063A\u0644\u0642." });
  }
  if (counter.isPaused) {
    return res.status(400).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0641\u064A \u062D\u0627\u0644\u0629 \u0625\u064A\u0642\u0627\u0641 \u0645\u0624\u0642\u062A. \u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0627\u0644\u0639\u0645\u0644 \u0623\u0648\u0644\u0627\u064B." });
  }
  if (counter.currentStaffId && counter.currentStaffId !== staffId) {
    return res.status(403).json({ error: "\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0633\u0646\u062F \u0644\u0645\u0646\u062F\u0648\u0628 \u0622\u062E\u0631." });
  }
  const currentServing = db.tickets.find((t) => t.staffId === staffId && t.status === "serving");
  if (currentServing) {
    return res.status(400).json({ error: "\u0644\u062F\u064A\u0643 \u0645\u0631\u0627\u062C\u0639 \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629 \u062D\u0627\u0644\u064A\u064B\u0627. \u064A\u0631\u062C\u0649 \u0625\u0646\u0647\u0627\u0621 \u0627\u0644\u062E\u062F\u0645\u0629 \u0623\u0648 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0623\u0648\u0644\u0627\u064B." });
  }
  const allowedCatIdsSet = /* @__PURE__ */ new Set();
  if (counter.assignedServiceId) {
    allowedCatIdsSet.add(counter.assignedServiceId);
  }
  db.settings.categories.forEach((cat) => {
    if (cat.assignedCounterId === counter.id) {
      allowedCatIdsSet.add(cat.id);
    }
  });
  const counterServiceMatch = counter.name.match(/\((.*?)\)/);
  const counterService = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1].trim() : null);
  if (counterService) {
    db.settings.categories.forEach((cat) => {
      if (cat.name === counterService || cat.id === counterService) {
        allowedCatIdsSet.add(cat.id);
      }
    });
  }
  db.settings.categories.forEach((cat) => {
    const matchingCounters = db.counters.filter((c) => c.assignedServiceId === cat.id);
    if (matchingCounters.some((c) => c.id === counter.id)) {
      allowedCatIdsSet.add(cat.id);
    }
  });
  const allowedCatIds = Array.from(allowedCatIdsSet);
  let nextTicket = null;
  if (allowedCatIds.length > 0) {
    nextTicket = db.tickets.slice().reverse().find(
      (t) => t.status === "waiting" && (allowedCatIds.includes(t.category) || t.counterId === counter.id)
    );
  } else {
    nextTicket = db.tickets.slice().reverse().find((t) => t.status === "waiting");
  }
  if (!nextTicket) {
    const serviceName = counter.assignedServiceName || (counterServiceMatch ? counterServiceMatch[1] : "\u0627\u0644\u0645\u062E\u0635\u0635\u0629");
    return res.status(404).json({ error: `\u0644\u0627 \u062A\u0648\u062C\u062F \u062A\u0630\u0627\u0643\u0631 \u0641\u064A \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0644\u0644\u062E\u062F\u0645\u0629 (${serviceName}) \u0627\u0644\u062E\u0627\u0635\u0629 \u0628\u0647\u0630\u0627 \u0627\u0644\u0634\u0628\u0627\u0643.` });
  }
  nextTicket.status = "serving";
  nextTicket.calledAt = (/* @__PURE__ */ new Date()).toISOString();
  nextTicket.counterId = counter.id;
  nextTicket.counterName = counter.name;
  nextTicket.staffId = staffMember.id;
  nextTicket.staffName = staffMember.name;
  nextTicket.documentingStartedAt = void 0;
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("ticket", nextTicket.id, "UPDATE", nextTicket);
  } catch {
  }
  io.emit("ticket_called", {
    ticket: nextTicket,
    counter: counter.name,
    timestamp: nextTicket.calledAt
  });
  logAudit(
    "\u0627\u0633\u062A\u062F\u0639\u0627\u0621 \u0645\u0631\u0627\u062C\u0639",
    `\u0627\u0644\u0645\u0648\u0638\u0641 ${staffMember.name} \u0639\u0644\u0649 ${counter.name} \u0627\u0633\u062A\u062F\u0639\u0649 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${nextTicket.displayNumber}`,
    staffMember.name,
    "ticket"
  );
  res.json(nextTicket);
});
app.post("/api/staff/recall", (req, res) => {
  const { ticketId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  const currentRecalls = ticket.recallCount || 0;
  if (currentRecalls >= 3) {
    return res.status(400).json({
      error: "\u062A\u0645 \u0627\u0633\u062A\u0646\u0641\u0627\u062F \u0627\u0644\u062D\u062F \u0627\u0644\u0623\u0642\u0635\u0649 \u0644\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 (3 \u0645\u0631\u0627\u062A). \u064A\u0645\u0643\u0646\u0643 \u0627\u0644\u0622\u0646 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631 \u0644\u0639\u062F\u0645 \u062D\u0636\u0648\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639."
    });
  }
  ticket.recallCount = currentRecalls + 1;
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("ticket", ticket.id, "UPDATE", ticket);
  } catch {
  }
  io.emit("ticket_called", {
    ticket,
    counter: ticket.counterName || "\u0627\u0644\u0634\u0628\u0627\u0643",
    isRecall: true,
    recallCount: ticket.recallCount,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit(
    "\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621",
    `\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 (\u0627\u0644\u0645\u0631\u0629 ${ticket.recallCount} \u0645\u0646 3) \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({
    success: true,
    ticket,
    recallCount: ticket.recallCount,
    remainingRecalls: 3 - ticket.recallCount,
    maxReached: ticket.recallCount >= 3
  });
});
app.post("/api/staff/complete", (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  ticket.status = "completed";
  ticket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("ticket", ticket.id, "UPDATE", ticket);
  } catch {
  }
  logAudit(
    "\u0625\u0646\u0647\u0627\u0621 \u062E\u062F\u0645\u0629",
    `\u062A\u0645\u062A \u062E\u062F\u0645\u0629 \u0648\u062A\u0648\u062B\u064A\u0642 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0628\u0646\u062C\u0627\u062D \u0639\u0644\u0649 ${ticket.counterName}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/staff/skip", (req, res) => {
  const { ticketId, notes } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket || ticket.status !== "serving") {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629 \u0623\u0648 \u0644\u064A\u0633\u062A \u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629." });
  }
  const recallInfo = ticket.recallCount ? ` (\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 ${ticket.recallCount} \u0645\u0631\u0627\u062A)` : "";
  ticket.status = "skipped";
  ticket.notes = notes || `\u0644\u0645 \u064A\u062D\u0636\u0631 \u0627\u0644\u0645\u0631\u0627\u062C\u0639 \u0639\u0646\u062F \u0627\u0644\u0646\u062F\u0627\u0621${recallInfo}`;
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("ticket", ticket.id, "UPDATE", ticket);
  } catch {
  }
  logAudit(
    "\u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062F\u0648\u0631",
    `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} - \u0627\u0644\u0633\u0628\u0628: ${ticket.notes}`,
    ticket.staffName || "\u0645\u0648\u0638\u0641",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/staff/return-queue", (req, res) => {
  const { ticketId } = req.body;
  const ticket = db.tickets.find((t) => t.id === ticketId);
  if (!ticket) {
    return res.status(400).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  ticket.status = "waiting";
  ticket.counterId = void 0;
  ticket.counterName = void 0;
  ticket.staffId = void 0;
  ticket.staffName = void 0;
  ticket.documentingStartedAt = void 0;
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0639\u0627\u062F\u0629 \u0644\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
    `\u062A\u0645 \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631`,
    "\u0645\u0648\u0638\u0641 \u0627\u0644\u0634\u0628\u0627\u0643",
    "ticket"
  );
  res.json({ success: true, ticket });
});
app.post("/api/admin/login", (req, res) => {
  try {
    const pin = req.body?.pin;
    const correctPin = db?.settings?.adminPin || "9999";
    if (!pin || pin !== correctPin) {
      console.error("Admin login failed: incorrect PIN attempt");
      return res.status(401).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
    }
    const token = `admin-token-${Date.now()}-${crypto2.randomBytes(16).toString("hex")}`;
    activeAdminTokens.add(token);
    if (!db.activeTokens) db.activeTokens = [];
    db.activeTokens.push(token);
    if (db.activeTokens.length > 100) {
      db.activeTokens = db.activeTokens.slice(-100);
    }
    saveDb(db);
    try {
      logAudit("\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0627\u0644\u0645\u062F\u064A\u0631", "\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0628\u0646\u062C\u0627\u062D \u0625\u0644\u0649 \u0644\u0648\u062D\u0629 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0639\u0627\u0645\u0629", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "auth");
    } catch (auditErr) {
      console.error("Audit log error during login:", auditErr);
    }
    return res.json({
      success: true,
      token,
      adminName: "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0644\u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A"
    });
  } catch (err) {
    console.error("Admin login error (FUNCTION_INVOCATION_FAILED):", err?.message || err, err?.stack);
    return res.status(500).json({ error: "\u062A\u0639\u0630\u0631 \u0627\u0644\u0627\u062A\u0635\u0627\u0644 \u0628\u0627\u0644\u062E\u0627\u062F\u0645 (500): A server error has occurred" });
  }
});
app.post("/api/branch-manager/login", (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0625\u062F\u062E\u0627\u0644 \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639." });
    }
    const cleanUser = String(username).trim();
    const cleanPass = String(password).trim();
    if (!db.branchManagers || !Array.isArray(db.branchManagers) || db.branchManagers.length === 0) {
      db.branchManagers = defaultDb.branchManagers;
      saveDb(db);
    }
    const isStaffPin = (db.staff || []).some((s) => s.pin === cleanPass);
    const managers = db.branchManagers || [];
    const manager = managers.find(
      (bm) => bm.username.toLowerCase() === cleanUser.toLowerCase() && bm.password === cleanPass
    );
    if (isStaffPin && (!manager || manager.password !== cleanPass)) {
      return res.status(401).json({
        error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0623\u0648 \u0645\u0648\u0638\u0641 \u0627\u0644\u0634\u0628\u0627\u0643 \u0644\u0627 \u064A\u062E\u0648\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0643\u0645\u062F\u064A\u0631 \u0641\u0631\u0639! \u0644\u0643\u0644 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0648\u0643\u0644\u0645\u0629 \u0645\u0631\u0648\u0631 \u062E\u0627\u0635\u0629 \u0648\u0645\u0633\u062A\u0642\u0644\u0629 \u062A\u0645\u0627\u0645\u0627\u064B \u062A\u064F\u0639\u0631\u0651\u0641 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629."
      });
    }
    if (!manager) {
      return res.status(401).json({
        error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0623\u0648 \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u063A\u064A\u0631 \u0635\u062D\u064A\u062D\u0629. \u064A\u062A\u0645 \u062A\u0639\u0631\u064A\u0641 \u062D\u0633\u0627\u0628\u0627\u062A \u0645\u062F\u0631\u0627\u0621 \u0627\u0644\u0641\u0631\u0648\u0639 \u0648\u062A\u062D\u062F\u064A\u062F \u0643\u0644\u0645\u0627\u062A \u0645\u0631\u0648\u0631\u0647\u0645 \u062D\u0635\u0631\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629."
      });
    }
    if (!manager.active) {
      return res.status(403).json({ error: "\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0647\u0630\u0627 \u0627\u0644\u0645\u062F\u064A\u0631 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629." });
    }
    manager.lastLoginAt = (/* @__PURE__ */ new Date()).toISOString();
    saveDb(db);
    const token = `branch-token-${manager.id}-${Date.now()}`;
    activeAdminTokens.add(token);
    if (!db.activeTokens) db.activeTokens = [];
    db.activeTokens.push(token);
    saveDb(db);
    logAudit(
      "\u062A\u0633\u062C\u064A\u0644 \u062F\u062E\u0648\u0644 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639",
      `\u062A\u0645 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644 \u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639: ${manager.fullName} (${manager.branchName})`,
      manager.fullName,
      "auth"
    );
    return res.json({
      success: true,
      token,
      manager: {
        id: manager.id,
        fullName: manager.fullName,
        username: manager.username,
        branchId: manager.branchId,
        branchName: manager.branchName
      }
    });
  } catch (err) {
    console.error("Branch manager login error:", err);
    return res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0641\u064A \u0627\u0644\u062E\u0627\u062F\u0645 \u0623\u062B\u0646\u0627\u0621 \u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u062F\u062E\u0648\u0644." });
  }
});
app.get("/api/admin/branch-managers", (req, res) => {
  const managers = (db.branchManagers || []).map((m) => ({
    id: m.id,
    branchId: m.branchId,
    branchName: m.branchName,
    fullName: m.fullName,
    username: m.username,
    password: m.password,
    active: m.active,
    createdAt: m.createdAt,
    lastLoginAt: m.lastLoginAt
  }));
  res.json({ success: true, data: managers });
});
app.post("/api/admin/branch-managers", (req, res) => {
  try {
    const { id, branchId, branchName, fullName, username, password, active } = req.body;
    if (!branchId || !fullName || !username || !password) {
      return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 (\u0627\u0644\u0641\u0631\u0639\u060C \u0627\u0644\u0627\u0633\u0645\u060C \u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645\u060C \u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631)." });
    }
    if (!db.branchManagers) db.branchManagers = [];
    const existingIdx = id ? db.branchManagers.findIndex((m) => m.id === id) : -1;
    const usernameConflict = db.branchManagers.find(
      (m) => m.username.toLowerCase() === username.trim().toLowerCase() && m.id !== id
    );
    if (usernameConflict) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0647\u0630\u0627 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B\u060C \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0622\u062E\u0631." });
    }
    if (existingIdx >= 0) {
      db.branchManagers[existingIdx] = {
        ...db.branchManagers[existingIdx],
        branchId,
        branchName: branchName || db.branchManagers[existingIdx].branchName,
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        active: active !== void 0 ? !!active : true
      };
      saveDb(db);
      logAudit("\u062A\u0639\u062F\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639", `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 ${fullName} (${branchName})`, "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629", "auth");
      return res.json({ success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0628\u0646\u062C\u0627\u062D.", manager: db.branchManagers[existingIdx] });
    } else {
      const newManager = {
        id: `bm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        branchId,
        branchName: branchName || "\u0641\u0631\u0639 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646",
        fullName: fullName.trim(),
        username: username.trim(),
        password: password.trim(),
        active: active !== void 0 ? !!active : true,
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      db.branchManagers.push(newManager);
      saveDb(db);
      logAudit("\u0625\u0646\u0634\u0627\u0621 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639", `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0639\u064A\u064A\u0646 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u062C\u062F\u064A\u062F: ${fullName} (${branchName})`, "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629", "auth");
      return res.json({ success: true, message: "\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0628\u0646\u062C\u0627\u062D.", manager: newManager });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u0641\u0634\u0644 \u062D\u0641\u0638 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639." });
  }
});
app.delete("/api/admin/branch-managers/:id", (req, res) => {
  try {
    const { id } = req.params;
    if (!db.branchManagers) db.branchManagers = [];
    const idx = db.branchManagers.findIndex((m) => m.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: "\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const deleted = db.branchManagers.splice(idx, 1)[0];
    saveDb(db);
    logAudit("\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639", `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639: ${deleted.fullName} (${deleted.branchName})`, "\u0627\u0644\u0625\u062F\u0627\u0631\u0629 \u0627\u0644\u0645\u0631\u0643\u0632\u064A\u0629", "auth");
    res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u0628\u0646\u062C\u0627\u062D." });
  } catch (err) {
    return res.status(500).json({ error: err.message || "\u0641\u0634\u0644 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631." });
  }
});
app.post("/api/admin/change-pin", requireAdmin, (req, res) => {
  const { currentPin, newPin } = req.body;
  const correctPin = db.settings.adminPin || "9999";
  if (currentPin !== correctPin) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062D\u0627\u0644\u064A \u063A\u064A\u0631 \u0635\u062D\u064A\u062D." });
  }
  if (!newPin || newPin.length < 4) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062A\u0643\u0648\u0646 \u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u062C\u062F\u064A\u062F \u0645\u0646 4 \u0625\u0644\u0649 8 \u062E\u0627\u0646\u0627\u062A." });
  }
  db.settings.adminPin = newPin;
  saveDb(db);
  logAudit("\u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631", "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u062F\u062E\u0648\u0644 \u0627\u0644\u0633\u0631\u064A \u0644\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u062C\u0627\u062D", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "auth");
  res.json({ success: true, message: "\u062A\u0645 \u062A\u063A\u064A\u064A\u0631 \u0631\u0645\u0632 \u0627\u0644\u0645\u062F\u064A\u0631 \u0628\u0646\u062C\u0627\u062D." });
});
app.get("/api/admin/staff", requireAdmin, (req, res) => {
  res.json(db.staff);
});
app.post("/api/admin/staff", requireAdmin, (req, res) => {
  const { id, name, pin, counterId, active, allowedCounterIds, jobTitle, role } = req.body;
  if (id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldName = staff.name;
    if (name && typeof name === "string" && name.trim()) {
      staff.name = name.trim();
    }
    if (pin && typeof pin === "string" && pin.trim() !== "" && pin.trim() !== "****") {
      staff.pin = pin.trim();
    }
    if (counterId !== void 0) staff.counterId = counterId;
    if (typeof active === "boolean") staff.active = active;
    if (allowedCounterIds !== void 0) staff.allowedCounterIds = allowedCounterIds;
    if (jobTitle !== void 0 && typeof jobTitle === "string") {
      staff.jobTitle = jobTitle.trim() || "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A";
    }
    if (role && (role === "staff" || role === "admin")) {
      staff.role = role;
    }
    db.counters.forEach((c) => {
      if (c.currentStaffId === staff.id) {
        c.currentStaffName = staff.name;
      }
    });
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628", `\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A (${staff.jobTitle || "\u0645\u0646\u062F\u0648\u0628"}) ${oldName} ${oldName !== staff.name ? `\u0625\u0644\u0649 (${staff.name})` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, message: `\u062A\u0645 \u062D\u0641\u0638 \u062A\u0639\u062F\u064A\u0644\u0627\u062A ${staff.name} \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff, updatedStaff: staff });
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0645\u0646\u062F\u0648\u0628 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0645\u0637\u0644\u0648\u0628." });
    }
    if (!pin || typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({ error: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A (PIN) \u0645\u0637\u0644\u0648\u0628." });
    }
    const newStaff = {
      id: `staff-${Date.now()}`,
      name: name.trim(),
      pin: pin.trim(),
      counterId: counterId || "",
      active: typeof active === "boolean" ? active : true,
      role: role === "admin" ? "admin" : "staff",
      jobTitle: jobTitle && typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: allowedCounterIds || []
    };
    db.staff.push(newStaff);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u062D\u0633\u0627\u0628 (${newStaff.jobTitle}) ${newStaff.name} \u0628\u0646\u062C\u0627\u062D`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
    return res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 ${newStaff.name} \u0648\u062D\u0641\u0638\u0647 \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff, newStaff });
  }
});
app.delete("/api/admin/staff/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.staff.findIndex((s) => s.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staffName = db.staff[index].name;
  const staffTitle = db.staff[index].jobTitle || "\u0627\u0644\u0645\u0648\u0638\u0641";
  db.staff.splice(index, 1);
  db.counters.forEach((c) => {
    if (c.currentStaffId === id) {
      c.currentStaffId = void 0;
      c.currentStaffName = void 0;
      c.isPaused = false;
      c.claimedAt = void 0;
    }
  });
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u062D\u0633\u0627\u0628 \u0645\u0648\u0638\u0641/\u0645\u0646\u062F\u0648\u0628", `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 ${staffTitle} ${staffName} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "staff");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u062D\u0633\u0627\u0628 ${staffName} \u0628\u0646\u062C\u0627\u062D.`, staff: db.staff });
});
app.post("/api/admin/force-release-counter", requireAdmin, (req, res) => {
  const { counterId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staffName = counter.currentStaffName || "\u0627\u0644\u0645\u0648\u0638\u0641 \u0627\u0644\u062D\u0627\u0644\u064A";
  const staffId = counter.currentStaffId;
  const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
  if (openSession) {
    openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  counter.currentStaffId = void 0;
  counter.currentStaffName = void 0;
  counter.isPaused = false;
  counter.claimedAt = void 0;
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (staff) staff.counterId = "";
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u062D\u0631\u064A\u0631 \u0634\u0628\u0627\u0643 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0646\u0647\u0627\u0621 \u062D\u062C\u0632 ${counter.name} \u0648\u0641\u0635\u0644\u0647 \u0639\u0646 ${staffName}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u0631\u064A\u0631 ${counter.name} \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/move-staff-counter", requireAdmin, (req, res) => {
  const { staffId, targetCounterId } = req.body;
  const staff = db.staff.find((s) => s.id === staffId);
  const targetCounter = db.counters.find((c) => c.id === targetCounterId);
  if (!staff || !targetCounter) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u0623\u0648 \u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (targetCounter.currentStaffId && targetCounter.currentStaffId !== staffId) {
    return res.status(400).json({ error: `\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0647\u062F\u0641 \u0645\u0634\u063A\u0648\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0645\u0646 \u0642\u0628\u0644 ${targetCounter.currentStaffName}.` });
  }
  const oldCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== targetCounterId);
  if (oldCounter) {
    oldCounter.currentStaffId = void 0;
    oldCounter.currentStaffName = void 0;
    oldCounter.isPaused = false;
    oldCounter.claimedAt = void 0;
    const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
    if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  targetCounter.currentStaffId = staff.id;
  targetCounter.currentStaffName = staff.name;
  targetCounter.isPaused = false;
  targetCounter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
  staff.counterId = targetCounter.id;
  db.counterSessions.unshift({
    id: `cs-${Date.now()}`,
    staffId: staff.id,
    staffName: staff.name,
    counterId: targetCounter.id,
    counterName: targetCounter.name,
    startedAt: targetCounter.claimedAt
  });
  saveDb(db);
  broadcastState();
  logAudit("\u0646\u0642\u0644 \u0645\u0648\u0638\u0641 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u0642\u0644 \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0625\u0644\u0649 ${targetCounter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u0646\u0642\u0644 ${staff.name} \u0625\u0644\u0649 ${targetCounter.name} \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/counters/:id/assign-staff", requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { staffId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0648\u0638\u0641 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldCounter = db.counters.find((c) => c.currentStaffId === staffId && c.id !== counterId);
    if (oldCounter) {
      oldCounter.currentStaffId = void 0;
      oldCounter.currentStaffName = void 0;
      oldCounter.isPaused = false;
      oldCounter.claimedAt = void 0;
      const openSession = db.counterSessions.find((cs) => cs.staffId === staffId && cs.counterId === oldCounter.id && !cs.endedAt);
      if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    const previousStaffId = counter.currentStaffId;
    if (previousStaffId && previousStaffId !== staffId) {
      const prevStaff = db.staff.find((s) => s.id === previousStaffId);
      if (prevStaff) prevStaff.counterId = "";
      const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
      if (openSession) openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    counter.currentStaffId = staff.id;
    counter.currentStaffName = staff.name;
    counter.isPaused = false;
    counter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
    staff.counterId = counter.id;
    db.counterSessions.unshift({
      id: `cs-${Date.now()}`,
      staffId: staff.id,
      staffName: staff.name,
      counterId: counter.id,
      counterName: counter.name,
      startedAt: counter.claimedAt
    });
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0633\u0646\u0627\u062F \u0645\u0646\u062F\u0648\u0628 \u0644\u0634\u0628\u0627\u0643", `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u0645\u0648\u0638\u0641 ${staff.name} \u0625\u0644\u0649 ${counter.name} \u0641\u0648\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    res.json({ success: true, message: `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F ${staff.name} \u0625\u0644\u0649 ${counter.name} \u0628\u0646\u062C\u0627\u062D.` });
  } else {
    const staffIdOld = counter.currentStaffId;
    const openSession = db.counterSessions.find((cs) => cs.counterId === counterId && !cs.endedAt);
    if (openSession) {
      openSession.endedAt = (/* @__PURE__ */ new Date()).toISOString();
    }
    counter.currentStaffId = void 0;
    counter.currentStaffName = void 0;
    counter.isPaused = false;
    counter.claimedAt = void 0;
    if (staffIdOld) {
      const staff = db.staff.find((s) => s.id === staffIdOld);
      if (staff) staff.counterId = "";
    }
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u062D\u0631\u064A\u0631 \u0634\u0628\u0627\u0643 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u062A\u0641\u0631\u064A\u063A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0645\u0646 ${counter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    res.json({ success: true, message: `\u062A\u0645 \u0625\u062E\u0644\u0627\u0621 \u0627\u0644\u0634\u0628\u0627\u0643 \u0628\u0646\u062C\u0627\u062D.` });
  }
});
app.post("/api/admin/counters/:id/assign-service", requireAdmin, (req, res) => {
  const { id: counterId } = req.params;
  const { serviceId } = req.body;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  if (serviceId) {
    const service = db.settings.categories.find((c) => c.id === serviceId);
    if (!service) {
      return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    }
    counter.assignedServiceId = service.id;
    counter.assignedServiceName = service.name;
  } else {
    counter.assignedServiceId = void 0;
    counter.assignedServiceName = void 0;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 \u0644\u0634\u0628\u0627\u0643", `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u062E\u062F\u0645\u0629 (${counter.assignedServiceName || "\u0628\u062F\u0648\u0646 \u062E\u062F\u0645\u0629"}) \u0644\u0644\u0634\u0628\u0627\u0643 (${counter.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u062E\u062F\u0645\u0629 \u0627\u0644\u0645\u0642\u062F\u0645\u0629 \u0644\u0644\u0634\u0628\u0627\u0643 \u0628\u0646\u062C\u0627\u062D.", counter });
});
app.get("/api/admin/counter-sessions", requireAdmin, (req, res) => {
  res.json(db.counterSessions);
});
app.delete("/api/admin/counter-sessions/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counterSessions.findIndex((cs) => cs.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0633\u062C\u0644 \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const deleted = db.counterSessions.splice(index, 1)[0];
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0633\u062C\u0644 \u0645\u0646\u0627\u0648\u0628\u0629", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062D\u0630\u0641 \u0633\u062C\u0644 \u0645\u0646\u0627\u0648\u0628\u0629 (${deleted.staffName} \u0639\u0644\u0649 ${deleted.counterName})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: "\u062A\u0645 \u062D\u0630\u0641 \u0633\u062C\u0644 \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0629 \u0628\u0646\u062C\u0627\u062D.", counterSessions: db.counterSessions });
});
app.delete("/api/admin/counter-sessions", requireAdmin, (req, res) => {
  const count = db.counterSessions.length;
  db.counterSessions = [];
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A (${count} \u0633\u062C\u0644)`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0633\u062C\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u0627\u0648\u0628\u0627\u062A (${count} \u0633\u062C\u0644) \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/counters", requireAdmin, (req, res) => {
  res.json(db.counters);
});
app.post("/api/admin/counters", requireAdmin, (req, res) => {
  const { id, name, isOpen, isPaused } = req.body;
  if (id) {
    const counter = db.counters.find((c) => c.id === id);
    if (!counter) {
      return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    const oldName = counter.name;
    if (name && typeof name === "string" && name.trim()) {
      counter.name = name.trim();
      db.tickets.forEach((t) => {
        if (t.counterId === counter.id) {
          t.counterName = counter.name;
        }
      });
      db.counterSessions.forEach((cs) => {
        if (cs.counterId === counter.id) {
          cs.counterName = counter.name;
        }
      });
    }
    if (typeof isOpen === "boolean") counter.isOpen = isOpen;
    if (typeof isPaused === "boolean") counter.isPaused = isPaused;
    saveDb(db);
    broadcastState();
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0648\u062D\u0641\u0638\u0647", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0646 (${oldName}) \u0625\u0644\u0649 (${counter.name}) \u0648\u062D\u0641\u0638 \u0627\u0644\u062A\u063A\u064A\u064A\u0631\u0627\u062A \u0628\u0646\u062C\u0627\u062D`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u0628\u0646\u062C\u0627\u062D: \u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0625\u0644\u0649 (${counter.name})`,
      counter,
      counters: db.counters
    });
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0637\u0644\u0648\u0628." });
    }
    const newCounter = {
      id: `counter-${Date.now()}`,
      name: name.trim(),
      isOpen: true,
      isPaused: false
    };
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit("\u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F: ${newCounter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0627\u0644\u062D\u0641\u0638 \u0628\u0646\u062C\u0627\u062D: \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0634\u0628\u0627\u0643 (${newCounter.name})`,
      counter: newCounter,
      counters: db.counters
    });
  }
});
app.delete("/api/admin/counters/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.counters.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const counterName = db.counters[index].name;
  db.counters.splice(index, 1);
  db.staff.forEach((s) => {
    if (s.counterId === id) {
      s.counterId = "";
    }
  });
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0634\u0628\u0627\u0643", `\u062A\u0645 \u062D\u0630\u0641 ${counterName} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "counter");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 ${counterName} \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/tickets", requireAdmin, (req, res) => {
  res.json(db.tickets);
});
app.post("/api/admin/tickets", requireAdmin, (req, res) => {
  const { category, displayNumber, status = "waiting", counterId, staffId, notes } = req.body;
  const catConfig = db.settings.categories.find((c) => c.id === category) || db.settings.categories[0] || {
    id: "general",
    prefix: "A",
    name: "\u0648\u0643\u0627\u0644\u0627\u062A \u0639\u0627\u0645\u0629",
    desc: ""
  };
  db.ticketSequence += 1;
  const num = db.ticketSequence;
  const autoDisplay = `${catConfig.prefix}-${String(num).padStart(3, "0")}`;
  const finalDisplay = displayNumber && typeof displayNumber === "string" && displayNumber.trim() ? displayNumber.trim() : autoDisplay;
  const duplicate = db.tickets.find((t) => t.displayNumber === finalDisplay);
  if (duplicate) {
    return res.status(400).json({ error: `\u0631\u0642\u0645 \u0627\u0644\u062F\u0648\u0631 (${finalDisplay}) \u0645\u0633\u062C\u0644 \u0628\u0627\u0644\u0641\u0639\u0644 \u0627\u0644\u064A\u0648\u0645.` });
  }
  let counterName = void 0;
  if (counterId) {
    const counter = db.counters.find((c) => c.id === counterId);
    if (counter) counterName = counter.name;
  }
  let staffName = void 0;
  if (staffId) {
    const staff = db.staff.find((s) => s.id === staffId);
    if (staff) staffName = staff.name;
  }
  const newTicket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    number: num,
    displayNumber: finalDisplay,
    category: catConfig.id,
    categoryNameArabic: catConfig.name,
    status: status || "waiting",
    createdAt: (/* @__PURE__ */ new Date()).toISOString(),
    counterId: counterId || void 0,
    counterName,
    staffId: staffId || void 0,
    staffName,
    notes: notes || "\u062A\u0645\u062A \u0627\u0644\u0625\u0636\u0627\u0641\u0629 \u064A\u062F\u0648\u064A\u0627\u064B \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645"
  };
  if (status === "serving") {
    newTicket.calledAt = (/* @__PURE__ */ new Date()).toISOString();
  } else if (status === "completed") {
    newTicket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
  }
  db.tickets.unshift(newTicket);
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0636\u0627\u0641\u0629 \u062A\u0630\u0643\u0631\u0629 \u064A\u062F\u0648\u064A\u0627\u064B",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0636\u0627\u0641\u0629 \u062A\u0630\u0643\u0631\u0629 \u062C\u062F\u064A\u062F\u0629 \u0628\u0631\u0642\u0645 ${newTicket.displayNumber} (${newTicket.categoryNameArabic})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "ticket"
  );
  res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${newTicket.displayNumber} \u0628\u0646\u062C\u0627\u062D.`, ticket: newTicket, tickets: db.tickets });
});
app.delete("/api/admin/tickets", requireAdmin, (req, res) => {
  const count = db.tickets.length;
  db.tickets = [];
  db.ticketSequence = 0;
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u0627\u0644\u062A\u0630\u0627\u0643\u0631", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0648\u062A\u0635\u0641\u064A\u0631 \u0643\u0627\u0641\u0629 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u064A\u0648\u0645 (\u0627\u0644\u0639\u062F\u062F: ${count})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u062C\u0645\u064A\u0639 \u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u064A\u0648\u0645 (${count} \u062A\u0630\u0643\u0631\u0629) \u0628\u0646\u062C\u0627\u062D.` });
});
app.put("/api/admin/tickets/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { displayNumber, number, status, counterId, staffId, notes, categoryNameArabic } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (displayNumber && displayNumber !== ticket.displayNumber) {
    const duplicate = db.tickets.find((t) => t.id !== id && t.displayNumber === displayNumber);
    if (duplicate) {
      return res.status(400).json({ error: `\u0627\u0644\u0631\u0642\u0645 ${displayNumber} \u0645\u0633\u062A\u062E\u062F\u0645 \u0628\u0627\u0644\u0641\u0639\u0644 \u0644\u062A\u0630\u0643\u0631\u0629 \u0623\u062E\u0631\u0649 \u0627\u0644\u064A\u0648\u0645!` });
    }
    const prevDisplay = ticket.displayNumber;
    ticket.displayNumber = displayNumber;
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0631\u0642\u0645 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0631\u0642\u0645 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0645\u0646 ${prevDisplay} \u0625\u0644\u0649 ${displayNumber}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  if (typeof number === "number") {
    ticket.number = number;
  }
  if (categoryNameArabic) {
    ticket.categoryNameArabic = categoryNameArabic;
  }
  if (notes !== void 0) {
    ticket.notes = notes;
  }
  if (status && status !== ticket.status) {
    const prevStatus = ticket.status;
    ticket.status = status;
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u062D\u0627\u0644\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0645\u0646 (${prevStatus}) \u0625\u0644\u0649 (${status})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  if (counterId !== void 0) {
    const counter = db.counters.find((c) => c.id === counterId);
    ticket.counterId = counterId || void 0;
    ticket.counterName = counter ? counter.name : void 0;
  }
  if (staffId !== void 0) {
    const staff = db.staff.find((s) => s.id === staffId);
    ticket.staffId = staffId || void 0;
    ticket.staffName = staff ? staff.name : void 0;
  }
  saveDb(db);
  broadcastState();
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/reassign", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId, staffId } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  const staff = staffId ? db.staff.find((s) => s.id === staffId) : void 0;
  const prevCounter = ticket.counterName || "\u063A\u064A\u0631 \u0645\u062D\u062F\u062F";
  ticket.counterId = counter.id;
  ticket.counterName = counter.name;
  if (staff) {
    ticket.staffId = staff.id;
    ticket.staffName = staff.name;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0625\u0633\u0646\u0627\u062F \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0645\u0646 ${prevCounter} \u0625\u0644\u0649 ${counter.name}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/action", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { action, notes } = req.body;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (action === "return_queue") {
    ticket.status = "waiting";
    ticket.counterId = void 0;
    ticket.counterName = void 0;
    ticket.staffId = void 0;
    ticket.staffName = void 0;
    ticket.documentingStartedAt = void 0;
    logAudit("\u0625\u0639\u0627\u062F\u0629 \u062A\u0630\u0643\u0631\u0629 \u0644\u0644\u0627\u0646\u062A\u0638\u0627\u0631", `\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u0644\u0649 \u0642\u0627\u0626\u0645\u0629 \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631 \u0628\u0623\u0645\u0631 \u0625\u062F\u0627\u0631\u064A`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "cancel") {
    ticket.status = "cancelled";
    ticket.notes = notes || "\u062A\u0645 \u0627\u0644\u0625\u0644\u063A\u0627\u0621 \u0628\u0648\u0627\u0633\u0637\u0629 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645";
    logAudit("\u0625\u0644\u063A\u0627\u0621 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u0625\u0644\u063A\u0627\u0621 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} - \u0645\u0644\u0627\u062D\u0638\u0627\u062A: ${ticket.notes}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "complete") {
    ticket.status = "completed";
    ticket.completedAt = (/* @__PURE__ */ new Date()).toISOString();
    logAudit("\u0625\u0646\u0647\u0627\u0621 \u062A\u0630\u0643\u0631\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u0625\u0646\u0647\u0627\u0621 \u0645\u0639\u0627\u0645\u0644\u0629 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u062F\u0627\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  } else if (action === "skip") {
    ticket.status = "skipped";
    ticket.notes = notes || "\u062A\u062C\u0627\u0648\u0632 \u0628\u0623\u0645\u0631 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645";
    logAudit("\u062A\u062C\u0627\u0648\u0632 \u062A\u0630\u0643\u0631\u0629 \u0625\u062F\u0627\u0631\u064A\u0627\u064B", `\u062A\u0645 \u062A\u062C\u0627\u0648\u0632 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0625\u062F\u0627\u0631\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  }
  saveDb(db);
  broadcastState();
  res.json({ success: true, ticket });
});
app.post("/api/admin/tickets/:id/recall", requireAdmin, (req, res) => {
  const { id } = req.params;
  const ticket = db.tickets.find((t) => t.id === id);
  if (!ticket) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  io.emit("ticket_called", {
    ticket,
    counter: ticket.counterName || "\u0627\u0644\u0634\u0628\u0627\u0643 \u0627\u0644\u0645\u062D\u062F\u062F",
    isRecall: true,
    byAdmin: true,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  });
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0646\u062F\u0627\u0621 \u0625\u062F\u0627\u0631\u064A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0639\u0627\u062F\u0629 \u0627\u0644\u0646\u062F\u0627\u0621 \u0644\u0644\u062A\u0630\u0643\u0631\u0629 ${ticket.displayNumber} \u0639\u0644\u0649 ${ticket.counterName || "\u0627\u0644\u0634\u0627\u0634\u0629"}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: "\u062A\u0645 \u0625\u0631\u0633\u0627\u0644 \u0646\u062F\u0627\u0621 \u0641\u0648\u0631\u064A \u0644\u0644\u062A\u0630\u0643\u0631\u0629." });
});
app.delete("/api/admin/tickets/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const index = db.tickets.findIndex((t) => t.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const ticketNum = db.tickets[index].displayNumber;
  db.tickets.splice(index, 1);
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u062A\u0630\u0643\u0631\u0629", `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 \u0631\u0642\u0645 ${ticketNum} \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645 \u0646\u0647\u0627\u0626\u064A\u0627\u064B`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "ticket");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u0627\u0644\u062A\u0630\u0643\u0631\u0629 ${ticketNum} \u0628\u0646\u062C\u0627\u062D.` });
});
app.get("/api/admin/settings", requireAdmin, (req, res) => {
  res.json({
    ...db.settings,
    ticketSequence: db.ticketSequence,
    issuancePaused: db.issuancePaused
  });
});
app.put("/api/admin/settings", requireAdmin, (req, res) => {
  const {
    departmentTitle,
    departmentSubtitle,
    tickerMessage,
    soundAlertsEnabled,
    workingHoursStart,
    workingHoursEnd,
    categories,
    ticketSequence
  } = req.body;
  if (departmentTitle) db.settings.departmentTitle = departmentTitle;
  if (departmentSubtitle) db.settings.departmentSubtitle = departmentSubtitle;
  if (tickerMessage) db.settings.tickerMessage = tickerMessage;
  if (typeof soundAlertsEnabled === "boolean") db.settings.soundAlertsEnabled = soundAlertsEnabled;
  if (workingHoursStart) db.settings.workingHoursStart = workingHoursStart;
  if (workingHoursEnd) db.settings.workingHoursEnd = workingHoursEnd;
  if (Array.isArray(categories)) db.settings.categories = categories;
  if (typeof ticketSequence === "number" && ticketSequence >= 0) {
    db.ticketSequence = ticketSequence;
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0646\u0638\u0627\u0645", "\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 \u0648\u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0634\u0627\u0634\u0629 \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, settings: db.settings });
});
app.get("/api/admin/categories", requireAdmin, (req, res) => {
  res.json(db.settings.categories);
});
app.post("/api/admin/categories", requireAdmin, (req, res) => {
  const { name, prefix, desc, id, assignedCounterId } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0645\u0637\u0644\u0648\u0628." });
  }
  const cleanPrefix = prefix && typeof prefix === "string" && prefix.trim() ? prefix.trim().toUpperCase().slice(0, 3) : (() => {
    const existing = db.settings.categories.map((c) => c.prefix.toUpperCase());
    for (let i = 65; i <= 90; i++) {
      const char = String.fromCharCode(i);
      if (!existing.includes(char)) return char;
    }
    return "Z";
  })();
  const cleanId = id && typeof id === "string" && id.trim() ? id.trim().toLowerCase().replace(/\s+/g, "_") : `cat_${Date.now()}`;
  if (db.settings.categories.some((c) => c.id === cleanId)) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u062A\u0639\u0631\u064A\u0641 \u0627\u0644\u0641\u0626\u0629 \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B." });
  }
  let counterName = void 0;
  if (assignedCounterId) {
    const targetCounter = db.counters.find((c) => c.id === assignedCounterId);
    if (targetCounter) {
      counterName = targetCounter.name;
    }
  }
  const newCat = {
    id: cleanId,
    name: name.trim(),
    prefix: cleanPrefix,
    desc: desc && typeof desc === "string" ? desc.trim() : "",
    assignedCounterId: assignedCounterId || void 0,
    assignedCounterName: counterName || void 0
  };
  db.settings.categories.push(newCat);
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 \u062C\u062F\u064A\u062F\u0629: ${newCat.name} (\u0631\u0645\u0632: ${newCat.prefix}) ${counterName ? `\u0645\u0633\u0646\u062F\u0629 \u0625\u0644\u0649 ${counterName}` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0641\u0626\u0629 (${newCat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: newCat, categories: db.settings.categories });
});
app.put("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { name, prefix, desc, assignedCounterId } = req.body;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const oldName = cat.name;
  if (name && typeof name === "string" && name.trim()) cat.name = name.trim();
  if (prefix && typeof prefix === "string" && prefix.trim()) cat.prefix = prefix.trim().toUpperCase().slice(0, 3);
  if (desc !== void 0 && typeof desc === "string") cat.desc = desc.trim();
  if (assignedCounterId !== void 0) {
    if (assignedCounterId) {
      cat.assignedCounterId = assignedCounterId;
      const targetCounter = db.counters.find((c) => c.id === assignedCounterId);
      cat.assignedCounterName = targetCounter ? targetCounter.name : void 0;
    } else {
      cat.assignedCounterId = void 0;
      cat.assignedCounterName = void 0;
    }
  }
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u0639\u062F\u064A\u0644 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0626\u0629 (${oldName}) ${oldName !== cat.name ? `\u0625\u0644\u0649 (${cat.name})` : ""}`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0641\u0626\u0629 (${cat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: cat, categories: db.settings.categories });
});
app.post("/api/admin/categories/:id/assign-counter", requireAdmin, (req, res) => {
  const { id } = req.params;
  const { counterId } = req.body;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  if (counterId) {
    const counter = db.counters.find((c) => c.id === counterId);
    if (!counter) {
      return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    cat.assignedCounterId = counter.id;
    cat.assignedCounterName = counter.name;
  } else {
    cat.assignedCounterId = void 0;
    cat.assignedCounterName = void 0;
  }
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 \u0644\u0634\u0628\u0627\u0643",
    `\u062A\u0645 \u0625\u0633\u0646\u0627\u062F \u062E\u062F\u0645\u0629 (${cat.name}) \u0625\u0644\u0649 (${cat.assignedCounterName || "\u063A\u064A\u0631 \u0645\u0633\u0646\u062F\u0629"})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "settings"
  );
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0625\u0633\u0646\u0627\u062F \u0627\u0644\u062E\u062F\u0645\u0629 \u0628\u0646\u062C\u0627\u062D`, category: cat, categories: db.settings.categories });
});
app.delete("/api/admin/categories/:id", requireAdmin, (req, res) => {
  const { id } = req.params;
  if (db.settings.categories.length <= 1) {
    return res.status(400).json({ error: "\u064A\u062C\u0628 \u0623\u0646 \u064A\u062D\u062A\u0648\u064A \u0627\u0644\u0646\u0638\u0627\u0645 \u0639\u0644\u0649 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629 \u0648\u0627\u062D\u062F\u0629 \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644." });
  }
  const index = db.settings.categories.findIndex((c) => c.id === id);
  if (index === -1) {
    return res.status(404).json({ error: "\u0641\u0626\u0629 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  const catName = db.settings.categories[index].name;
  db.settings.categories.splice(index, 1);
  saveDb(db);
  broadcastState();
  logAudit("\u062D\u0630\u0641 \u0641\u0626\u0629 \u062E\u062F\u0645\u0629/\u0645\u0639\u0627\u0645\u0644\u0629", `\u062A\u0645 \u062D\u0630\u0641 \u0641\u0626\u0629 (${catName}) \u0645\u0646 \u0627\u0644\u0646\u0638\u0627\u0645`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062D\u0630\u0641 \u0641\u0626\u0629 (${catName}) \u0628\u0646\u062C\u0627\u062D.`, categories: db.settings.categories });
});
app.post("/api/admin/categories/:id/toggle-active", requireAdmin, (req, res) => {
  const { id } = req.params;
  const cat = db.settings.categories.find((c) => c.id === id);
  if (!cat) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  cat.active = cat.active === false ? true : false;
  saveDb(db);
  broadcastState();
  logAudit("\u062A\u063A\u064A\u064A\u0631 \u062D\u0627\u0644\u0629 \u0627\u0644\u062E\u062F\u0645\u0629", `\u062A\u0645 ${cat.active ? "\u062A\u0641\u0639\u064A\u0644" : "\u062A\u0639\u0637\u064A\u0644"} \u062E\u062F\u0645\u0629 (${cat.name})`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "settings");
  res.json({ success: true, message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u062D\u0627\u0644\u0629 \u062E\u062F\u0645\u0629 (${cat.name}) \u0628\u0646\u062C\u0627\u062D.`, category: cat, categories: db.settings.categories });
});
app.post("/api/admin/toggle-issuance", requireAdmin, (req, res) => {
  db.issuancePaused = !db.issuancePaused;
  saveDb(db);
  broadcastState();
  logAudit(
    db.issuancePaused ? "\u0625\u064A\u0642\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631" : "\u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    db.issuancePaused ? "\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0645\u0624\u0642\u062A\u0627\u064B" : "\u062A\u0645 \u0627\u0633\u062A\u0626\u0646\u0627\u0641 \u0625\u0635\u062F\u0627\u0631 \u0627\u0644\u062A\u0630\u0627\u0643\u0631",
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "system"
  );
  res.json({ success: true, issuancePaused: db.issuancePaused });
});
app.post("/api/admin/new-day", requireAdmin, (req, res) => {
  const prevDate = db.date;
  db.date = getTodayDateString();
  db.ticketSequence = 0;
  db.tickets = [];
  db.issuancePaused = false;
  db.counters.forEach((c) => {
    c.currentStaffId = void 0;
    c.currentStaffName = void 0;
    c.isPaused = false;
    c.claimedAt = void 0;
  });
  db.staff.forEach((s) => {
    s.counterId = "";
  });
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F",
    `\u062A\u0645 \u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F \u0628\u062A\u0627\u0631\u064A\u062E ${db.date} (\u062A\u0635\u0641\u064A\u0631 \u0627\u0644\u0623\u062F\u0648\u0627\u0631 \u0644\u0644\u064A\u0648\u0645 \u0627\u0644\u0633\u0627\u0628\u0642 ${prevDate})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "system"
  );
  res.json({ success: true, message: `\u062A\u0645 \u0628\u062F\u0621 \u064A\u0648\u0645 \u0639\u0645\u0644 \u062C\u062F\u064A\u062F \u0628\u0646\u062C\u0627\u062D (${db.date})` });
});
app.get("/api/admin/export-csv", requireAdmin, (req, res) => {
  const BOM = "\uFEFF";
  const headers = ["\u0631\u0642\u0645 \u0627\u0644\u062F\u0648\u0631", "\u0627\u0644\u0641\u0626\u0629", "\u0627\u0644\u062D\u0627\u0644\u0629", "\u0627\u0644\u0634\u0628\u0627\u0643", "\u0627\u0644\u0645\u0648\u0638\u0641", "\u0648\u0642\u062A \u0627\u0644\u0625\u0635\u062F\u0627\u0631", "\u0648\u0642\u062A \u0627\u0644\u0627\u0633\u062A\u062F\u0639\u0627\u0621", "\u0648\u0642\u062A \u0627\u0644\u0625\u0646\u062C\u0627\u0632", "\u0645\u0644\u0627\u062D\u0638\u0627\u062A"];
  const statusTranslations = {
    waiting: "\u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631",
    serving: "\u0642\u064A\u062F \u0627\u0644\u062E\u062F\u0645\u0629",
    completed: "\u0645\u0643\u062A\u0645\u0644\u0629",
    skipped: "\u0645\u062A\u062C\u0627\u0648\u0632\u0629",
    cancelled: "\u0645\u0644\u063A\u0627\u0629"
  };
  const rows = db.tickets.map((t) => [
    t.displayNumber,
    t.categoryNameArabic,
    statusTranslations[t.status] || t.status,
    t.counterName || "-",
    t.staffName || "-",
    new Date(t.createdAt).toLocaleTimeString("ar-SY"),
    t.calledAt ? new Date(t.calledAt).toLocaleTimeString("ar-SY") : "-",
    t.completedAt ? new Date(t.completedAt).toLocaleTimeString("ar-SY") : "-",
    (t.notes || "").replace(/"/g, '""')
  ]);
  const csvContent = BOM + [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(","))
  ].join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="agency-queue-report-${db.date}.csv"`);
  res.send(csvContent);
});
app.get("/api/admin/backup", requireAdmin, (req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename=agency-queue-backup-${db.date}.json`);
  res.send(JSON.stringify(db, null, 2));
});
app.post("/api/admin/restore", requireAdmin, (req, res) => {
  try {
    const restored = req.body;
    if (restored && Array.isArray(restored.tickets) && Array.isArray(restored.counters)) {
      db = {
        ...defaultDb,
        ...restored,
        settings: {
          ...defaultSettings,
          ...restored.settings || {}
        }
      };
      saveDb(db);
      broadcastState();
      logAudit("\u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0646\u0633\u062E\u0629 \u0627\u062D\u062A\u064A\u0627\u0637\u064A\u0629", "\u062A\u0645\u062A \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D \u0645\u0646 \u0645\u0644\u0641 \u0646\u0633\u062E \u0627\u062D\u062A\u064A\u0627\u0637\u064A", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
      return res.json({ success: true, message: "\u062A\u0645 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D." });
    }
    res.status(400).json({ error: "\u0645\u0644\u0641 \u0627\u0644\u0646\u0633\u062E \u0627\u0644\u0627\u062D\u062A\u064A\u0627\u0637\u064A \u063A\u064A\u0631 \u0635\u0627\u0644\u062D \u0623\u0648 \u063A\u064A\u0631 \u0645\u0643\u062A\u0645\u0644." });
  } catch (err) {
    res.status(500).json({ error: "\u062D\u062F\u062B \u062E\u0637\u0623 \u0623\u062B\u0646\u0627\u0621 \u0627\u0633\u062A\u0639\u0627\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
  }
});
app.get("/api/admin/logs", requireAdmin, (req, res) => {
  res.json(db.auditLogs);
});
app.delete("/api/admin/logs", requireAdmin, (req, res) => {
  const count = db.auditLogs.length;
  db.auditLogs = [];
  saveDb(db);
  broadcastState();
  logAudit("\u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A", `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0645\u0633\u062D \u0648\u062A\u0641\u0631\u064A\u063A \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642 (${count} \u062D\u0631\u0643\u0629)`, "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
  res.json({ success: true, message: `\u062A\u0645 \u0645\u0633\u062D \u0633\u062C\u0644 \u0627\u0644\u0639\u0645\u0644\u064A\u0627\u062A (${count} \u062D\u0631\u0643\u0629) \u0628\u0646\u062C\u0627\u062D.` });
});
app.post("/api/admin/reset-database", requireAdmin, (req, res) => {
  db = JSON.parse(JSON.stringify(defaultDb));
  db.date = getTodayDateString();
  saveDb(db);
  broadcastState();
  logAudit("\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0627\u0644\u0645\u0635\u0646\u0639", "\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0644\u0649 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0627\u0644\u0646\u0638\u064A\u0641", "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645", "system");
  res.json({ success: true, message: "\u062A\u0645\u062A \u0625\u0639\u0627\u062F\u0629 \u0636\u0628\u0637 \u062C\u0645\u064A\u0639 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u0635\u0629 \u0625\u0644\u0649 \u0627\u0644\u0648\u0636\u0639 \u0627\u0644\u0627\u0641\u062A\u0631\u0627\u0636\u064A \u0628\u0646\u062C\u0627\u062D." });
});
app.get("/api/sync/settings", (req, res) => {
  const pendingCount = (db.syncQueue || []).filter((q) => q.syncStatus === "pending").length;
  res.json({
    settings: syncService.getSettings(),
    pendingCount,
    history: (db.syncHistory || []).slice(0, 15)
  });
});
app.post("/api/sync/settings", requireAdmin, (req, res) => {
  const {
    branchId,
    branchName,
    branchCode,
    isHeadquarters,
    supabaseUrl,
    supabaseKey,
    syncIntervalMinutes,
    autoSyncEnabled
  } = req.body;
  syncService.updateSettings({
    branchId: branchId || void 0,
    branchName: branchName || void 0,
    branchCode: branchCode || void 0,
    isHeadquarters: typeof isHeadquarters === "boolean" ? isHeadquarters : void 0,
    supabaseUrl: typeof supabaseUrl === "string" ? supabaseUrl.trim() : void 0,
    supabaseKey: typeof supabaseKey === "string" ? supabaseKey.trim() : void 0,
    syncIntervalMinutes: syncIntervalMinutes ? parseInt(syncIntervalMinutes) : void 0,
    autoSyncEnabled: typeof autoSyncEnabled === "boolean" ? autoSyncEnabled : void 0
  });
  logAudit(
    "\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062A\u062D\u062F\u064A\u062B \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0631\u0628\u0637 \u0627\u0644\u0633\u062D\u0627\u0628\u064A (\u0627\u0644\u0641\u0631\u0639: ${syncService.getSettings().branchName})`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "sync"
  );
  res.json({
    success: true,
    message: "\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u0637\u0628\u064A\u0642 \u0625\u0639\u062F\u0627\u062F\u0627\u062A \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629 \u0627\u0644\u0633\u062D\u0627\u0628\u064A\u0629 \u0628\u0646\u062C\u0627\u062D.",
    settings: syncService.getSettings()
  });
});
app.post("/api/sync/test", async (req, res) => {
  const { supabaseUrl, supabaseKey } = req.body;
  const result = await syncService.testConnection(supabaseUrl, supabaseKey);
  res.json(result);
});
app.post("/api/sync/push", async (req, res) => {
  try {
    const result = await syncService.pushBranchData();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || "\u062E\u0637\u0623 \u0641\u064A \u0639\u0645\u0644\u064A\u0629 \u0627\u0644\u0645\u0632\u0627\u0645\u0646\u0629." });
  }
});
app.post("/api/sync/pull-hq", async (req, res) => {
  try {
    const result = await syncService.pullAllBranchesDataToHQ();
    res.json(result);
  } catch (err) {
    console.error("SERVER_ERROR [/api/sync/pull-hq]:", err);
    res.status(500).json({ success: false, message: err.message || "\u062E\u0637\u0623 \u0641\u064A \u062C\u0644\u0628 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0648\u0639." });
  }
});
var require2 = createRequire(import.meta.url);
var archiver = require2("archiver");
app.get("/api/backup/download", async (req, res) => {
  try {
    const archive = archiver("zip", { zlib: { level: 9 } });
    res.attachment("backup_" + (/* @__PURE__ */ new Date()).toISOString().replace(/:/g, "-") + ".zip");
    archive.pipe(res);
    archive.file(DB_FILE, { name: "queue_db.json" });
    const hqCache = join2(process.cwd(), "data", "hq_branches_cache.json");
    if (fs2.existsSync(hqCache)) {
      archive.file(hqCache, { name: "hq_branches_cache.json" });
    }
    const attachmentsDir = join2(process.cwd(), "data", "attachments");
    if (fs2.existsSync(attachmentsDir)) {
      archive.directory(attachmentsDir, "attachments");
    }
    await archive.finalize();
  } catch (err) {
    console.error("BACKUP_ERROR:", err);
    res.status(500).json({ error: "Failed to create backup." });
  }
});
app.get("/api/hq/branches-data", (req, res) => {
  const cached = syncService.loadHQLocalCache();
  const branchesList = (db.branches && db.branches.length > 0 ? db.branches : defaultBranches).map((b) => {
    const branchTickets = (db.tickets || []).filter((t) => (t.branchId || "branch-aleppo-main") === b.id);
    const completedCount = branchTickets.filter((t) => t.status === "completed").length;
    const activeStaff = (db.counters || []).filter((c) => (c.branchId || "branch-aleppo-main") === b.id && c.currentStaffId).length;
    const branchAgencies = (db.agenciesTransactions || []).filter((a) => (a.branchId || "branch-aleppo-main") === b.id);
    return {
      ...b,
      todayTicketsCount: branchTickets.length,
      todayCompletedCount: completedCount,
      activeStaffCount: activeStaff,
      totalAgenciesCount: branchAgencies.length,
      lastSyncAt: b.lastSyncAt || syncService.getSettings().lastSyncTimestamp
    };
  });
  const ticketsByBranch = {};
  const agenciesByBranch = {};
  const auditLogsByBranch = {};
  branchesList.forEach((b) => {
    ticketsByBranch[b.id] = (db.tickets || []).filter((t) => (t.branchId || "branch-aleppo-main") === b.id);
    agenciesByBranch[b.id] = (db.agenciesTransactions || []).filter((a) => (a.branchId || "branch-aleppo-main") === b.id);
    auditLogsByBranch[b.id] = (db.auditLogs || []).filter((au) => (au.branchId || "branch-aleppo-main") === b.id || au.details?.includes(b.name));
  });
  const aggregatedHQ = {
    lastUpdated: (/* @__PURE__ */ new Date()).toISOString(),
    branches: branchesList,
    ticketsByBranch,
    agenciesByBranch,
    auditLogsByBranch,
    summary: {
      totalBranches: branchesList.length,
      activeBranches: branchesList.filter((b) => b.isActive).length,
      totalTodayTickets: (db.tickets || []).length,
      totalCompletedTickets: (db.tickets || []).filter((t) => t.status === "completed").length,
      totalAgenciesCount: (db.agenciesTransactions || []).length
    }
  };
  res.json({
    success: true,
    fromLocalCache: cached ? true : false,
    data: aggregatedHQ
  });
});
app.get("/api/hq/branch/:branchId/details", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find((b) => b.id === branchId);
  if (!branch) {
    return res.status(404).json({ error: `\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 (${branchId}) \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645.` });
  }
  const manager = (db.branchManagers || []).find((m) => m.branchId === branchId) || null;
  const managerHistory = (db.managerHistory || []).filter((h) => h.branchId === branchId);
  const branchStaff = (db.staff || []).filter((s) => (s.branchId || "branch-aleppo-main") === branchId);
  const staffWithStats = branchStaff.map((s) => {
    const sAgencies = (db.agenciesTransactions || []).filter(
      (a) => (a.branchId || "branch-aleppo-main") === branchId && (a.notaryDelegateName === s.name || s.jobTitle && a.notaryDelegateName?.includes(s.name))
    );
    const sTickets = (db.tickets || []).filter(
      (t) => (t.branchId || "branch-aleppo-main") === branchId && (t.staffId === s.id || t.staffName === s.name)
    );
    const lastAgencyTime = sAgencies[0]?.createdAt;
    const lastTicketTime = sTickets[0]?.completedAt || sTickets[0]?.calledAt || sTickets[0]?.createdAt;
    const lastActive = [lastAgencyTime, lastTicketTime].filter(Boolean).sort().reverse()[0] || s.createdAt;
    return {
      ...s,
      registeredAgenciesCount: sAgencies.length,
      completedAgenciesCount: sAgencies.filter((a) => a.status === "approved").length,
      pendingAgenciesCount: sAgencies.filter((a) => a.status === "pending_review").length,
      ticketsHandledCount: sTickets.length,
      lastActive
    };
  });
  const branchCounters = (db.counters || []).filter((c) => (c.branchId || "branch-aleppo-main") === branchId);
  const countersWithStats = branchCounters.map((c) => {
    const cTickets = (db.tickets || []).filter(
      (t) => (t.branchId || "branch-aleppo-main") === branchId && t.counterId === c.id
    );
    const completed = cTickets.filter((t) => t.status === "completed");
    let totalWaitSeconds = 0;
    let waitCount = 0;
    let totalServiceSeconds = 0;
    let serviceCount = 0;
    cTickets.forEach((t) => {
      if (t.calledAt && t.createdAt) {
        const diff = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 1e3;
        if (diff >= 0 && diff < 86400) {
          totalWaitSeconds += diff;
          waitCount++;
        }
      }
      if (t.completedAt && t.calledAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1e3;
        if (diff >= 0 && diff < 86400) {
          totalServiceSeconds += diff;
          serviceCount++;
        }
      }
    });
    const avgWait = waitCount > 0 ? Math.round(totalWaitSeconds / waitCount) : 0;
    const avgService = serviceCount > 0 ? Math.round(totalServiceSeconds / serviceCount) : 0;
    const remaining = (db.tickets || []).filter(
      (t) => (t.branchId || "branch-aleppo-main") === branchId && t.status === "waiting" && (t.counterId === c.id || t.category === c.assignedServiceId)
    ).length;
    return {
      ...c,
      ticketsCalledCount: cTickets.filter((t) => t.status === "serving" || t.status === "completed" || t.status === "skipped").length,
      ticketsCompletedCount: completed.length,
      avgWaitTimeSeconds: avgWait,
      avgServiceTimeSeconds: avgService,
      remainingTicketsCount: remaining
    };
  });
  const branchServices = (db.settings.categories || []).filter((cat) => (cat.branchId || "branch-aleppo-main") === branchId);
  const servicesWithStats = branchServices.map((cat) => {
    const sTickets = (db.tickets || []).filter((t) => (t.branchId || "branch-aleppo-main") === branchId && t.category === cat.id);
    const completed = sTickets.filter((t) => t.status === "completed");
    const pending = sTickets.filter((t) => t.status === "waiting" || t.status === "serving");
    let totalDuration = 0;
    let countDuration = 0;
    completed.forEach((t) => {
      if (t.completedAt && t.calledAt) {
        const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1e3;
        if (diff >= 0 && diff < 86400) {
          totalDuration += diff;
          countDuration++;
        }
      }
    });
    return {
      ...cat,
      ticketsCount: sTickets.length,
      completedCount: completed.length,
      pendingCount: pending.length,
      avgServiceTimeSeconds: countDuration > 0 ? Math.round(totalDuration / countDuration) : 0
    };
  });
  const tickets = (db.tickets || []).filter((t) => (t.branchId || "branch-aleppo-main") === branchId);
  const agencies = (db.agenciesTransactions || []).filter((a) => (a.branchId || "branch-aleppo-main") === branchId);
  const auditLogs = (db.auditLogs || []).filter((au) => (au.branchId || "branch-aleppo-main") === branchId || au.details?.includes(branch.name));
  const completedTickets = tickets.filter((t) => t.status === "completed").length;
  const waitingTickets = tickets.filter((t) => t.status === "waiting").length;
  const servingTickets = tickets.filter((t) => t.status === "serving").length;
  const skippedTickets = tickets.filter((t) => t.status === "skipped").length;
  const completedAgencies = agencies.filter((a) => a.status === "approved").length;
  const pendingAgencies = agencies.filter((a) => a.status === "pending_review").length;
  const totalFeesPaid = agencies.reduce((acc, a) => acc + (Number(a.feesPaid) || 0), 0);
  let totalWaitTime = 0;
  let waitCountTotal = 0;
  let totalServiceTime = 0;
  let serviceCountTotal = 0;
  tickets.forEach((t) => {
    if (t.calledAt && t.createdAt) {
      const diff = (new Date(t.calledAt).getTime() - new Date(t.createdAt).getTime()) / 1e3;
      if (diff >= 0 && diff < 86400) {
        totalWaitTime += diff;
        waitCountTotal++;
      }
    }
    if (t.completedAt && t.calledAt) {
      const diff = (new Date(t.completedAt).getTime() - new Date(t.calledAt).getTime()) / 1e3;
      if (diff >= 0 && diff < 86400) {
        totalServiceTime += diff;
        serviceCountTotal++;
      }
    }
  });
  const avgWaitTimeSeconds = waitCountTotal > 0 ? Math.round(totalWaitTime / waitCountTotal) : 0;
  const avgServiceTimeSeconds = serviceCountTotal > 0 ? Math.round(totalServiceTime / serviceCountTotal) : 0;
  const totalCountForRate = completedTickets + waitingTickets + servingTickets + skippedTickets;
  const completionRatePercentage = totalCountForRate > 0 ? Math.round(completedTickets / totalCountForRate * 100) : 100;
  const pendingQueueCount = (db.syncQueue || []).filter((q) => q.branchId === branchId && q.syncStatus === "pending").length;
  const responseData = {
    branch: {
      ...branch,
      todayTicketsCount: tickets.length,
      todayCompletedCount: completedTickets,
      activeStaffCount: countersWithStats.filter((c) => c.currentStaffId).length,
      totalAgenciesCount: agencies.length,
      lastSyncAt: branch.lastSyncAt || syncService.getSettings().lastSyncTimestamp
    },
    manager,
    managerHistory,
    staff: staffWithStats,
    counters: countersWithStats,
    services: servicesWithStats,
    tickets,
    agencies,
    auditLogs,
    syncStatus: {
      lastSyncAt: branch.lastSyncAt || syncService.getSettings().lastSyncTimestamp,
      pendingQueueCount,
      isOnline: branch.isActive,
      lastKnownIp: branch.lastKnownIp || "127.0.0.1"
    },
    metrics: {
      totalAgencies: agencies.length,
      completedAgencies,
      pendingAgencies,
      totalFeesPaid,
      totalTickets: tickets.length,
      completedTickets,
      waitingTickets,
      servingTickets,
      skippedTickets,
      avgWaitTimeSeconds,
      avgServiceTimeSeconds,
      completionRatePercentage
    }
  };
  res.json({ success: true, data: responseData });
});
app.put("/api/hq/branch/:branchId", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { name, code, city, address, phone, isActive, notes } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628 \u0648\u0644\u0627 \u064A\u0645\u0643\u0646 \u062A\u0631\u0643\u0647 \u0641\u0627\u0631\u063A\u0627\u064B." });
  }
  if (!code || typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "\u0631\u0645\u0632 \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628 \u0644\u062A\u0645\u064A\u064A\u0632 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A." });
  }
  const cleanCode = code.trim().toUpperCase();
  if (!db.branches) db.branches = defaultBranches;
  const branchIdx = db.branches.findIndex((b) => b.id === branchId);
  if (branchIdx === -1) {
    return res.status(404).json({ error: "\u0627\u0644\u0641\u0631\u0639 \u0627\u0644\u0645\u0637\u0644\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A." });
  }
  const codeConflict = db.branches.find((b) => b.id !== branchId && b.code.toUpperCase() === cleanCode);
  if (codeConflict) {
    return res.status(400).json({ error: `\u0631\u0645\u0632 \u0627\u0644\u0641\u0631\u0639 (${cleanCode}) \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 ${codeConflict.name}. \u064A\u062C\u0628 \u0623\u0646 \u064A\u0643\u0648\u0646 \u0644\u0643\u0644 \u0641\u0631\u0639 \u0631\u0645\u0632 \u0641\u0631\u064A\u062F.` });
  }
  const oldBranch = db.branches[branchIdx];
  const oldName = oldBranch.name;
  db.branches[branchIdx] = {
    ...oldBranch,
    name: name.trim(),
    code: cleanCode,
    city: city ? String(city).trim() : oldBranch.city,
    address: address !== void 0 ? String(address).trim() : oldBranch.address,
    phone: phone !== void 0 ? String(phone).trim() : oldBranch.phone,
    isActive: typeof isActive === "boolean" ? isActive : oldBranch.isActive,
    notes: notes !== void 0 ? String(notes).trim() : oldBranch.notes
  };
  const updatedBranch = db.branches[branchIdx];
  if (db.branchManagers) {
    db.branchManagers.forEach((m) => {
      if (m.branchId === branchId) {
        m.branchName = updatedBranch.name;
      }
    });
  }
  if (syncService.getSettings().branchId === branchId) {
    syncService.updateSettings({
      branchName: updatedBranch.name,
      branchCode: updatedBranch.code
    });
  }
  saveDb(db);
  broadcastState();
  try {
    syncService.enqueue("audit_log", branchId, "UPDATE", updatedBranch);
  } catch {
  }
  logAudit(
    "\u062A\u0639\u062F\u064A\u0644 \u0648\u062D\u0641\u0638 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0641\u0631\u0639",
    `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062A\u062D\u062F\u064A\u062B \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0625\u062F\u0627\u0631\u064A\u0629 \u0644\u0641\u0631\u0639 (${oldName}) ${oldName !== updatedBranch.name ? `\u0625\u0644\u0649 (${updatedBranch.name})` : ""} - \u0627\u0644\u062D\u0627\u0644\u0629: ${updatedBranch.isActive ? "\u0641\u0639\u0627\u0644" : "\u0645\u0639\u0637\u0644"}`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "settings"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u062D\u0641\u0638 \u0648\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0641\u0631\u0639 (${updatedBranch.name}) \u0641\u064A \u0642\u0627\u0639\u062F\u0629 \u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0628\u0646\u062C\u0627\u062D.`,
    branch: updatedBranch
  });
});
app.post("/api/hq/branch/:branchId/manager", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { fullName, username, password, active, isReplacement, previousManagerNotes } = req.body;
  if (!fullName || typeof fullName !== "string" || !fullName.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!username || typeof username !== "string" || !username.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0637\u0644\u0648\u0628 \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631." });
  }
  const cleanUsername = username.trim().toLowerCase();
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find((b) => b.id === branchId);
  const branchName = branch ? branch.name : "\u0641\u0631\u0639 \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646";
  if (!db.branchManagers) db.branchManagers = defaultDb.branchManagers ? [...defaultDb.branchManagers] : [];
  if (!db.managerHistory) db.managerHistory = [];
  const branchManagers = db.branchManagers;
  const currentManager = branchManagers.find((m) => m.branchId === branchId);
  const usernameConflict = branchManagers.find(
    (m) => m.username.toLowerCase() === cleanUsername && m.branchId !== branchId
  );
  if (usernameConflict) {
    return res.status(400).json({ error: `\u0627\u0633\u0645 \u0627\u0644\u0645\u0633\u062A\u062E\u062F\u0645 (${username}) \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B \u0644\u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0622\u062E\u0631. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0645\u0633\u062A\u062E\u062F\u0645 \u0641\u0631\u064A\u062F.` });
  }
  if (isReplacement && currentManager) {
    db.managerHistory.unshift({
      id: `mh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      managerId: currentManager.id,
      managerName: currentManager.fullName,
      appointedAt: currentManager.createdAt,
      endedAt: (/* @__PURE__ */ new Date()).toISOString(),
      notes: previousManagerNotes || "\u062A\u0645 \u0627\u0633\u062A\u0628\u062F\u0627\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0648\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u062C\u062F\u064A\u062F \u0645\u0646 \u0642\u0628\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      assignedBy: "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645"
    });
    currentManager.active = false;
    if (!password || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u062F\u064A\u062F." });
    }
    const newManager = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      active: typeof active === "boolean" ? active : true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    const currentIdx = branchManagers.findIndex((m) => m.id === currentManager.id);
    if (currentIdx !== -1) {
      branchManagers.splice(currentIdx, 1);
    }
    branchManagers.push(newManager);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u0628\u062F\u064A\u0644",
      `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u062A\u0639\u064A\u064A\u0646 (${newManager.fullName}) \u0645\u062F\u064A\u0631\u0627\u064B \u0644\u0640 (${branchName}) \u0628\u062F\u0644\u0627\u064B \u0645\u0646 (${currentManager.fullName}) \u0645\u0639 \u0623\u0631\u0634\u0641\u0629 \u0627\u0644\u0633\u062C\u0644 \u0627\u0644\u0633\u0627\u0628\u0642`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "auth"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u0639\u064A\u064A\u0646 \u0627\u0644\u0623\u0633\u062A\u0627\u0630 (${newManager.fullName}) \u0645\u062F\u064A\u0631\u0627\u064B \u0644\u0640 (${branchName}) \u0628\u0646\u062C\u0627\u062D \u0648\u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0633\u062C\u0644 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0633\u0627\u0628\u0642.`,
      manager: newManager,
      managerHistory: db.managerHistory.filter((h) => h.branchId === branchId)
    });
  }
  if (currentManager) {
    currentManager.fullName = fullName.trim();
    currentManager.username = cleanUsername;
    if (password && typeof password === "string" && password.trim()) {
      currentManager.password = password.trim();
    }
    if (typeof active === "boolean") {
      currentManager.active = active;
    }
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 (${branchName}): ${currentManager.fullName} (\u0627\u0644\u062D\u0627\u0644\u0629: ${currentManager.active ? "\u0645\u0641\u0639\u0644" : "\u0645\u0639\u0637\u0644"})`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "auth"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0648\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 (${currentManager.fullName}) \u0628\u0646\u062C\u0627\u062D.`,
      manager: currentManager
    });
  } else {
    if (!password || typeof password !== "string" || !password.trim()) {
      return res.status(400).json({ error: "\u0643\u0644\u0645\u0629 \u0627\u0644\u0645\u0631\u0648\u0631 \u0645\u0637\u0644\u0648\u0628\u0629 \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u062C\u062F\u064A\u062F." });
    }
    const newManager = {
      id: `bm-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      branchName,
      fullName: fullName.trim(),
      username: cleanUsername,
      password: password.trim(),
      active: typeof active === "boolean" ? active : true,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    branchManagers.push(newManager);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u064A\u064A\u0646 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639 \u062C\u062F\u064A\u062F",
      `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0639\u064A\u064A\u0646 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0641\u0631\u0639: ${newManager.fullName} (${branchName})`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "auth"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u0625\u0646\u0634\u0627\u0621 \u0648\u062A\u0641\u0639\u064A\u0644 \u062D\u0633\u0627\u0628 \u0645\u062F\u064A\u0631 \u0627\u0644\u0641\u0631\u0639 (${newManager.fullName}) \u0628\u0646\u062C\u0627\u062D.`,
      manager: newManager
    });
  }
});
app.post("/api/hq/branch/:branchId/delegates", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, pin, jobTitle, active, allowedCounterIds, targetBranchId } = req.body;
  if (id) {
    const staff = db.staff.find((s) => s.id === id);
    if (!staff) {
      return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F \u0641\u064A \u0627\u0644\u0646\u0638\u0627\u0645." });
    }
    if (targetBranchId && targetBranchId !== staff.branchId) {
      const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
      const targetBranch = branches.find((b) => b.id === targetBranchId);
      const targetName = targetBranch ? targetBranch.name : targetBranchId;
      const oldBranchName = branches.find((b) => b.id === staff.branchId)?.name || staff.branchId || "\u0627\u0644\u0641\u0631\u0639";
      staff.branchId = targetBranchId;
      staff.counterId = "";
      saveDb(db);
      broadcastState();
      logAudit(
        "\u0646\u0642\u0644 \u0645\u0646\u062F\u0648\u0628 \u0625\u062F\u0627\u0631\u064A\u0627\u064B",
        `\u0642\u0627\u0645 \u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645 \u0628\u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0645\u0646 (${oldBranchName}) \u0625\u0644\u0649 (${targetName})`,
        "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
        "staff"
      );
      return res.json({
        success: true,
        message: `\u062A\u0645 \u0646\u0642\u0644 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0625\u0644\u0649 (${targetName}) \u0628\u0646\u062C\u0627\u062D.`,
        staff
      });
    }
    if (name && typeof name === "string" && name.trim()) staff.name = name.trim();
    if (pin && typeof pin === "string" && pin.trim() && pin.trim() !== "****") staff.pin = pin.trim();
    if (jobTitle !== void 0 && typeof jobTitle === "string") staff.jobTitle = jobTitle.trim();
    if (typeof active === "boolean") staff.active = active;
    if (allowedCounterIds !== void 0) staff.allowedCounterIds = allowedCounterIds;
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0645\u0646\u062F\u0648\u0628",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639 - \u0627\u0644\u062D\u0627\u0644\u0629: ${staff.active ? "\u0646\u0634\u0637" : "\u0645\u0639\u0637\u0644"}`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "staff"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062D\u0641\u0638 \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0628\u0646\u062C\u0627\u062D.`,
      staff
    });
  } else {
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0645\u0637\u0644\u0648\u0628." });
    }
    if (!pin || typeof pin !== "string" || !pin.trim()) {
      return res.status(400).json({ error: "\u0627\u0644\u0631\u0645\u0632 \u0627\u0644\u0634\u062E\u0635\u064A (PIN) \u0645\u0637\u0644\u0648\u0628 \u0644\u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0646\u062F\u0648\u0628." });
    }
    const newDelegate = {
      id: `staff-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: name.trim(),
      pin: pin.trim(),
      counterId: "",
      active: typeof active === "boolean" ? active : true,
      role: "staff",
      jobTitle: jobTitle && typeof jobTitle === "string" && jobTitle.trim() ? jobTitle.trim() : "\u0645\u0646\u062F\u0648\u0628 \u0648\u0643\u0627\u0644\u0627\u062A",
      allowedCounterIds: allowedCounterIds || [],
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.staff.push(newDelegate);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u0625\u0636\u0627\u0641\u0629 \u0645\u0646\u062F\u0648\u0628 \u062C\u062F\u064A\u062F \u0644\u0644\u0641\u0631\u0639",
      `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${newDelegate.name}) \u0643\u0640 (${newDelegate.jobTitle}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0628\u0646\u062C\u0627\u062D`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "staff"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0648\u062D\u0641\u0638 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${newDelegate.name}) \u0628\u0646\u062C\u0627\u062D.`,
      staff: newDelegate
    });
  }
});
app.delete("/api/hq/branch/:branchId/delegates/:delegateId", requireAdmin, (req, res) => {
  const { delegateId } = req.params;
  const staff = db.staff.find((s) => s.id === delegateId);
  if (!staff) {
    return res.status(404).json({ error: "\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  staff.active = false;
  staff.counterId = "";
  db.counters.forEach((c) => {
    if (c.currentStaffId === delegateId) {
      c.currentStaffId = void 0;
      c.currentStaffName = void 0;
      c.isPaused = false;
      c.claimedAt = void 0;
    }
  });
  saveDb(db);
  broadcastState();
  logAudit(
    "\u062A\u0639\u0637\u064A\u0644 \u0648\u0623\u0631\u0634\u0641\u0629 \u062D\u0633\u0627\u0628 \u0645\u0646\u062F\u0648\u0628",
    `\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 (${staff.name}) \u0648\u0623\u0631\u0634\u0641\u062A\u0647 \u0628\u0623\u0645\u0627\u0646 \u0645\u0639 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A\u0647 \u0648\u0645\u0639\u0627\u0645\u0644\u0627\u062A\u0647 \u0627\u0644\u0633\u0627\u0628\u0642\u0629 \u062F\u0648\u0646 \u0623\u064A \u0645\u0633\u0627\u0633 \u0628\u0647\u0627`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "staff"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u062A\u0639\u0637\u064A\u0644 \u062D\u0633\u0627\u0628 \u0627\u0644\u0645\u0646\u062F\u0648\u0628 (${staff.name}) \u0648\u0623\u0631\u0634\u0641\u062A\u0647 \u0628\u0646\u062C\u0627\u062D \u062F\u0648\u0646 \u0627\u0644\u0645\u0633\u0627\u0633 \u0628\u0633\u062C\u0644\u0627\u062A\u0647 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629.`
  });
});
app.post("/api/hq/branch/:branchId/counters", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, isOpen, isPaused, assignedServiceId, currentStaffId } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 \u0645\u0637\u0644\u0648\u0628." });
  }
  const cleanName = name.trim();
  const existingCounters = db.counters.filter((c) => (c.branchId || "branch-aleppo-main") === branchId);
  const nameConflict = existingCounters.find((c) => c.name.toLowerCase() === cleanName.toLowerCase() && c.id !== id);
  if (nameConflict) {
    return res.status(400).json({ error: `\u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0627\u0644\u0634\u0628\u0627\u0643 (${cleanName}) \u0645\u0633\u062A\u062E\u062F\u0645 \u0645\u0633\u0628\u0642\u0627\u064B \u0641\u064A \u0647\u0630\u0627 \u0627\u0644\u0641\u0631\u0639. \u064A\u0631\u062C\u0649 \u0627\u062E\u062A\u064A\u0627\u0631 \u0627\u0633\u0645 \u0623\u0648 \u0631\u0642\u0645 \u0645\u0645\u064A\u0632.` });
  }
  let assignedServiceName = void 0;
  if (assignedServiceId) {
    const service = db.settings.categories.find((cat) => cat.id === assignedServiceId);
    if (service) assignedServiceName = service.name;
  }
  if (id) {
    const counter = db.counters.find((c) => c.id === id);
    if (!counter) {
      return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
    }
    counter.name = cleanName;
    if (typeof isOpen === "boolean") counter.isOpen = isOpen;
    if (typeof isPaused === "boolean") counter.isPaused = isPaused;
    if (assignedServiceId !== void 0) {
      counter.assignedServiceId = assignedServiceId || void 0;
      counter.assignedServiceName = assignedServiceName;
    }
    if (currentStaffId !== void 0) {
      if (currentStaffId) {
        const staff = db.staff.find((s) => s.id === currentStaffId);
        if (staff) {
          counter.currentStaffId = staff.id;
          counter.currentStaffName = staff.name;
          counter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
          staff.counterId = counter.id;
        }
      } else {
        if (counter.currentStaffId) {
          const prev = db.staff.find((s) => s.id === counter.currentStaffId);
          if (prev) prev.counterId = "";
        }
        counter.currentStaffId = void 0;
        counter.currentStaffName = void 0;
        counter.claimedAt = void 0;
      }
    }
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0634\u0628\u0627\u0643",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A ${counter.name} \u0641\u064A \u0627\u0644\u0641\u0631\u0639 (\u0627\u0644\u062E\u062F\u0645\u0629: ${counter.assignedServiceName || "\u0639\u0627\u0645\u0629"})`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "counter"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A (${counter.name}) \u0628\u0646\u062C\u0627\u062D.`,
      counter
    });
  } else {
    const newCounter = {
      id: `counter-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: cleanName,
      isOpen: typeof isOpen === "boolean" ? isOpen : true,
      isPaused: false,
      assignedServiceId: assignedServiceId || void 0,
      assignedServiceName
    };
    if (currentStaffId) {
      const staff = db.staff.find((s) => s.id === currentStaffId);
      if (staff) {
        newCounter.currentStaffId = staff.id;
        newCounter.currentStaffName = staff.name;
        newCounter.claimedAt = (/* @__PURE__ */ new Date()).toISOString();
        staff.counterId = newCounter.id;
      }
    }
    db.counters.push(newCounter);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F \u0644\u0644\u0641\u0631\u0639",
      `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u0634\u0628\u0627\u0643 \u062C\u062F\u064A\u062F: ${newCounter.name} \u0641\u064A \u0627\u0644\u0641\u0631\u0639`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "counter"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 (${newCounter.name}) \u0648\u062D\u0641\u0638\u0647 \u0628\u0646\u062C\u0627\u062D.`,
      counter: newCounter
    });
  }
});
app.delete("/api/hq/branch/:branchId/counters/:counterId", requireAdmin, (req, res) => {
  const { counterId } = req.params;
  const counter = db.counters.find((c) => c.id === counterId);
  if (!counter) {
    return res.status(404).json({ error: "\u0627\u0644\u0634\u0628\u0627\u0643 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F." });
  }
  counter.isOpen = false;
  if (counter.currentStaffId) {
    const staff = db.staff.find((s) => s.id === counter.currentStaffId);
    if (staff) staff.counterId = "";
  }
  counter.currentStaffId = void 0;
  counter.currentStaffName = void 0;
  counter.claimedAt = void 0;
  saveDb(db);
  broadcastState();
  logAudit(
    "\u0625\u063A\u0644\u0627\u0642 \u0648\u062A\u0639\u0637\u064A\u0644 \u0634\u0628\u0627\u0643",
    `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 ${counter.name} \u0648\u062A\u0639\u0637\u064A\u0644\u0647 \u0645\u0639 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0643\u0627\u0641\u0629 \u0628\u064A\u0627\u0646\u0627\u062A\u0647 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629 \u0628\u0646\u062C\u0627\u062D`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "counter"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u0625\u063A\u0644\u0627\u0642 \u0648\u062A\u0639\u0637\u064A\u0644 (${counter.name}) \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A\u0647 \u0627\u0644\u0633\u0627\u0628\u0642\u0629.`
  });
});
app.post("/api/hq/branch/:branchId/services", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const { id, name, prefix, desc, assignedCounterId, active } = req.body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "\u0627\u0633\u0645 \u0627\u0644\u062E\u062F\u0645\u0629 \u0645\u0637\u0644\u0648\u0628." });
  }
  if (!prefix || typeof prefix !== "string" || !prefix.trim()) {
    return res.status(400).json({ error: "\u0628\u0627\u062F\u0626\u0629 \u0643\u0648\u062F \u0627\u0644\u062A\u0630\u0643\u0631\u0629 (Prefix) \u0645\u0637\u0644\u0648\u0628\u0629." });
  }
  const cleanPrefix = prefix.trim().toUpperCase().slice(0, 3);
  let counterName = void 0;
  if (assignedCounterId) {
    const counter = db.counters.find((c) => c.id === assignedCounterId);
    if (counter) counterName = counter.name;
  }
  if (id) {
    const cat = db.settings.categories.find((c) => c.id === id);
    if (!cat) {
      return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
    }
    cat.name = name.trim();
    cat.prefix = cleanPrefix;
    if (desc !== void 0) cat.desc = String(desc).trim();
    if (typeof active === "boolean") cat.active = active;
    if (assignedCounterId !== void 0) {
      cat.assignedCounterId = assignedCounterId || void 0;
      cat.assignedCounterName = counterName;
    }
    saveDb(db);
    broadcastState();
    logAudit(
      "\u062A\u0639\u062F\u064A\u0644 \u062E\u062F\u0645\u0629 \u0627\u0644\u0641\u0631\u0639",
      `\u062A\u0645 \u062A\u062D\u062F\u064A\u062B \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u0629 (${cat.name}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0628\u0646\u062C\u0627\u062D`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "settings"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645 \u062D\u0641\u0638 \u062A\u0639\u062F\u064A\u0644\u0627\u062A \u0627\u0644\u062E\u062F\u0645\u0629 (${cat.name}) \u0628\u0646\u062C\u0627\u062D.`,
      category: cat
    });
  } else {
    const newService = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      branchId,
      name: name.trim(),
      prefix: cleanPrefix,
      desc: desc ? String(desc).trim() : "",
      active: typeof active === "boolean" ? active : true,
      assignedCounterId: assignedCounterId || void 0,
      assignedCounterName: counterName
    };
    db.settings.categories.push(newService);
    saveDb(db);
    broadcastState();
    logAudit(
      "\u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 \u062C\u062F\u064A\u062F\u0629 \u0644\u0644\u0641\u0631\u0639",
      `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 \u062C\u062F\u064A\u062F\u0629: (${newService.name}) \u0628\u0627\u0644\u0628\u0627\u062F\u0626\u0629 (${newService.prefix})`,
      "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
      "settings"
    );
    return res.json({
      success: true,
      message: `\u062A\u0645\u062A \u0625\u0636\u0627\u0641\u0629 \u062E\u062F\u0645\u0629 (${newService.name}) \u0628\u0646\u062C\u0627\u062D.`,
      category: newService
    });
  }
});
app.delete("/api/hq/branch/:branchId/services/:serviceId", requireAdmin, (req, res) => {
  const { serviceId } = req.params;
  const service = db.settings.categories.find((c) => c.id === serviceId);
  if (!service) {
    return res.status(404).json({ error: "\u0627\u0644\u062E\u062F\u0645\u0629 \u063A\u064A\u0631 \u0645\u0648\u062C\u0648\u062F\u0629." });
  }
  service.active = false;
  saveDb(db);
  broadcastState();
  logAudit(
    "\u062A\u0639\u0637\u064A\u0644 \u062E\u062F\u0645\u0629",
    `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u0648\u062A\u0639\u0637\u064A\u0644 \u062E\u062F\u0645\u0629 (${service.name}) \u0641\u064A \u0627\u0644\u0641\u0631\u0639 \u0645\u0639 \u0627\u0644\u062D\u0641\u0627\u0638 \u0627\u0644\u062A\u0627\u0645 \u0639\u0644\u0649 \u0633\u062C\u0644\u0627\u062A \u0648\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0627\u0644\u0633\u0627\u0628\u0642\u0629`,
    "\u0627\u0644\u0645\u062F\u064A\u0631 \u0627\u0644\u0639\u0627\u0645",
    "settings"
  );
  res.json({
    success: true,
    message: `\u062A\u0645 \u0625\u064A\u0642\u0627\u0641 \u062E\u062F\u0645\u0629 (${service.name}) \u0628\u0646\u062C\u0627\u062D \u0645\u0639 \u0627\u0644\u0627\u062D\u062A\u0641\u0627\u0638 \u0628\u0643\u0627\u0641\u0629 \u0633\u062C\u0644\u0627\u062A\u0647\u0627 \u0627\u0644\u062A\u0627\u0631\u064A\u062E\u064A\u0629.`
  });
});
app.get("/api/hq/branch/:branchId/export-report", requireAdmin, (req, res) => {
  const { branchId } = req.params;
  const branches = db.branches && db.branches.length > 0 ? db.branches : defaultBranches;
  const branch = branches.find((b) => b.id === branchId) || { name: branchId, code: branchId };
  const tickets = (db.tickets || []).filter((t) => (t.branchId || "branch-aleppo-main") === branchId);
  const agencies = (db.agenciesTransactions || []).filter((a) => (a.branchId || "branch-aleppo-main") === branchId);
  const BOM = "\uFEFF";
  const csvRows = [];
  csvRows.push(`\u062A\u0642\u0631\u064A\u0631 \u062A\u0642\u064A\u064A\u0645 \u0627\u0644\u0623\u062F\u0627\u0621 \u0648\u0627\u0644\u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0634\u0627\u0645\u0644\u0629 \u0644\u0641\u0631\u0639: ${branch.name} (${branch.code})`);
  csvRows.push(`\u062A\u0627\u0631\u064A\u062E \u0627\u0633\u062A\u062E\u0631\u0627\u062C \u0627\u0644\u062A\u0642\u0631\u064A\u0631: ${(/* @__PURE__ */ new Date()).toLocaleString("ar-SY")}`);
  csvRows.push("");
  csvRows.push("=== \u0645\u0644\u062E\u0635 \u0627\u0644\u0645\u0624\u0634\u0631\u0627\u062A \u0627\u0644\u0639\u0627\u0645\u0629 ===");
  csvRows.push(`\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u062A\u0630\u0627\u0643\u0631,${tickets.length}`);
  csvRows.push(`\u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0627\u0644\u0645\u0646\u062C\u0632\u0629,${tickets.filter((t) => t.status === "completed").length}`);
  csvRows.push(`\u0627\u0644\u062A\u0630\u0627\u0643\u0631 \u0642\u064A\u062F \u0627\u0644\u0627\u0646\u062A\u0638\u0627\u0631,${tickets.filter((t) => t.status === "waiting").length}`);
  csvRows.push(`\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A \u0627\u0644\u0645\u0648\u062B\u0642\u0629,${agencies.length}`);
  csvRows.push(`\u0625\u062C\u0645\u0627\u0644\u064A \u0627\u0644\u0631\u0633\u0648\u0645 \u0627\u0644\u0645\u0633\u062A\u0648\u0641\u0627\u0629 (\u0644.\u0633),${agencies.reduce((acc, a) => acc + (Number(a.feesPaid) || 0), 0)}`);
  csvRows.push("");
  csvRows.push("=== \u062A\u0641\u0627\u0635\u064A\u0644 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0627\u062A \u0648\u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A ===");
  csvRows.push("\u0631\u0642\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0629,\u0627\u0644\u0633\u0646\u0629,\u0627\u0644\u0646\u0648\u0639,\u0627\u0644\u0645\u0648\u0643\u0644\u0648\u0646,\u0627\u0644\u0645\u062D\u0627\u0645\u0648\u0646,\u0627\u0644\u0631\u0633\u0648\u0645 (\u0644.\u0633),\u0627\u0644\u0645\u0646\u062F\u0648\u0628 \u0627\u0644\u0645\u0648\u062B\u0642,\u0627\u0644\u062D\u0627\u0644\u0629,\u062A\u0627\u0631\u064A\u062E \u0627\u0644\u062A\u0633\u062C\u064A\u0644");
  agencies.forEach((a) => {
    csvRows.push([
      `"${a.agencyNumber}"`,
      a.agencyYear || 2026,
      `"${a.agencyType}"`,
      `"${(a.principalsNames || "").replace(/"/g, '""')}"`,
      `"${(a.lawyersNames || "").replace(/"/g, '""')}"`,
      a.feesPaid || 0,
      `"${a.notaryDelegateName || "-"}"`,
      `"${a.status === "approved" ? "\u0645\u0639\u062A\u0645\u062F\u0629" : "\u0642\u064A\u062F \u0627\u0644\u0645\u0631\u0627\u062C\u0639\u0629"}"`,
      `"${new Date(a.createdAt).toLocaleString("ar-SY")}"`
    ].join(","));
  });
  const csvContent = BOM + csvRows.join("\r\n");
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="branch-${branchId}-performance-report.csv"`);
  res.send(csvContent);
});
app.get("/api/sync/queue", requireAdmin, (req, res) => {
  res.json(db.syncQueue || []);
});
app.get("/api/sync/history", (req, res) => {
  res.json(db.syncHistory || []);
});
app.get("/api/agencies", (req, res) => {
  res.json(db.agenciesTransactions || []);
});
app.post("/api/agencies", (req, res) => {
  const {
    id,
    localTicketId,
    agencyNumber,
    agencyYear,
    agencyType,
    principalsNames,
    lawyersNames,
    nationalId,
    feesPaid,
    receiptNumber,
    notaryDelegateName,
    isRevoked,
    revocationDate,
    status,
    notes
  } = req.body;
  if (!agencyNumber || !agencyType || !principalsNames || !lawyersNames) {
    return res.status(400).json({ error: "\u064A\u0631\u062C\u0649 \u0627\u0633\u062A\u0643\u0645\u0627\u0644 \u0627\u0644\u062D\u0642\u0648\u0644 \u0627\u0644\u0625\u0644\u0632\u0627\u0645\u064A\u0629 \u0644\u0644\u0648\u0643\u0627\u0644\u0629 (\u0631\u0642\u0645 \u0627\u0644\u0648\u0643\u0627\u0644\u0629\u060C \u0646\u0648\u0639\u0647\u0627\u060C \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u0648\u0643\u0644\u064A\u0646\u060C \u0623\u0633\u0645\u0627\u0621 \u0627\u0644\u0648\u0643\u0644\u0627\u0621)." });
  }
  if (!db.agenciesTransactions) db.agenciesTransactions = [];
  let agency;
  const existingIndex = id ? db.agenciesTransactions.findIndex((a) => a.id === id) : -1;
  if (existingIndex >= 0) {
    agency = {
      ...db.agenciesTransactions[existingIndex],
      localTicketId: localTicketId || db.agenciesTransactions[existingIndex].localTicketId,
      agencyNumber,
      agencyYear: agencyYear || (/* @__PURE__ */ new Date()).getFullYear(),
      agencyType,
      principalsNames,
      lawyersNames,
      nationalId,
      feesPaid: parseFloat(feesPaid || 0),
      receiptNumber,
      notaryDelegateName,
      isRevoked: isRevoked || false,
      revocationDate,
      status: status || "approved",
      notes
    };
    db.agenciesTransactions[existingIndex] = agency;
    syncService.enqueue("agency", agency.id, "UPDATE", agency);
    logAudit("\u062A\u0639\u062F\u064A\u0644 \u0645\u0639\u0627\u0645\u0644\u0629 \u0648\u0643\u0627\u0644\u0629", `\u062A\u0645 \u062A\u0639\u062F\u064A\u0644 \u0628\u064A\u0627\u0646\u0627\u062A \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0631\u0642\u0645 ${agency.agencyNumber} (${agency.agencyType})`, notaryDelegateName || "\u0627\u0644\u0645\u0646\u062F\u0648\u0628", "ticket");
  } else {
    agency = {
      id: `agency-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      branchId: syncService.getSettings().branchId,
      localTicketId,
      agencyNumber,
      agencyYear: agencyYear || (/* @__PURE__ */ new Date()).getFullYear(),
      agencyType,
      principalsNames,
      lawyersNames,
      nationalId,
      feesPaid: parseFloat(feesPaid || 0),
      receiptNumber,
      notaryDelegateName,
      isRevoked: isRevoked || false,
      revocationDate,
      status: status || "approved",
      notes,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    };
    db.agenciesTransactions.unshift(agency);
    syncService.enqueue("agency", agency.id, "INSERT", agency);
    logAudit("\u062A\u0633\u062C\u064A\u0644 \u0648\u0643\u0627\u0644\u0629 \u062C\u062F\u064A\u062F\u0629", `\u062A\u0645 \u062A\u0646\u0638\u064A\u0645 \u0648\u062A\u0633\u062C\u064A\u0644 \u0627\u0644\u0648\u0643\u0627\u0644\u0629 \u0631\u0642\u0645 ${agency.agencyNumber} (${agency.agencyType}) \u0644\u0644\u0645\u0648\u0643\u0644: ${principalsNames}`, notaryDelegateName || "\u0627\u0644\u0645\u0646\u062F\u0648\u0628", "ticket");
  }
  saveDb(db);
  broadcastState();
  res.json({
    success: true,
    message: `\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0639\u0627\u0645\u0644\u0629 \u0644\u0644\u0648\u0643\u0627\u0644\u0629 \u0631\u0642\u0645 ${agency.agencyNumber} \u0628\u0646\u062C\u0627\u062D.`,
    agency
  });
});
app.post("/api/attachments/upload", (req, res) => {
  const { localTicketId, fileName, fileBase64, fileType } = req.body;
  if (!fileName || !fileBase64) {
    return res.status(400).json({ error: "\u0627\u0644\u0645\u0644\u0641 \u0648\u0627\u0644\u0645\u062D\u062A\u0648\u0649 \u0645\u0637\u0644\u0648\u0628\u0627\u0646." });
  }
  try {
    const attachment = syncService.saveAttachmentLocally(
      localTicketId || "",
      fileName,
      fileBase64,
      fileType || "image/jpeg"
    );
    res.json({
      success: true,
      message: "\u062A\u0645 \u062D\u0641\u0638 \u0627\u0644\u0645\u0644\u0641 \u0645\u062D\u0644\u064A\u0627\u064B \u0648\u0625\u062F\u0631\u0627\u062C\u0647 \u0641\u064A \u0637\u0627\u0628\u0648\u0631 \u0627\u0644\u0631\u0641\u0639 \u0627\u0644\u0633\u062D\u0627\u0628\u064A.",
      attachment
    });
  } catch (err) {
    res.status(500).json({ error: `\u0641\u0634\u0644 \u062D\u0641\u0638 \u0627\u0644\u0645\u0631\u0641\u0642: ${err.message}` });
  }
});
io.on("connection", (socket) => {
  socket.emit("state_update", {
    tickets: db.tickets,
    staff: db.staff.map((s) => ({ ...s, pin: "****" })),
    counters: db.counters,
    counterSessions: db.counterSessions,
    issuancePaused: db.issuancePaused,
    date: db.date,
    settings: {
      departmentTitle: db.settings.departmentTitle,
      departmentSubtitle: db.settings.departmentSubtitle,
      tickerMessage: db.settings.tickerMessage,
      soundAlertsEnabled: db.settings.soundAlertsEnabled,
      workingHoursStart: db.settings.workingHoursStart,
      workingHoursEnd: db.settings.workingHoursEnd,
      ticketSequence: db.ticketSequence,
      categories: db.settings.categories
    }
  });
});
async function startServer() {
  const DIST_DIR = join2(__dirname, "dist");
  if (!fs2.existsSync(DIST_DIR)) {
    try {
      console.log("Building app distribution for production...");
      execSync("npm run build", { stdio: "inherit" });
    } catch (e) {
      console.error("Auto build warning:", e);
    }
  }
  const isProduction = process.env.NODE_ENV === "production" || fs2.existsSync(DIST_DIR);
  if (!isProduction) {
    try {
      const viteModule = await import("vite");
      const vite = await viteModule.createServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("Failed to create Vite server:", e);
    }
  }
  if (fs2.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
  app.use(express.static(__dirname));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }
    const distIndex = join2(DIST_DIR, "index.html");
    if (fs2.existsSync(distIndex)) {
      res.sendFile(distIndex);
    } else {
      res.sendFile(join2(__dirname, "index.html"));
    }
  });
  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`
==================================================`);
      console.error(` [\u062E\u0637\u0623] \u0627\u0644\u0645\u0646\u0641\u0630 ${PORT} \u0642\u064A\u062F \u0627\u0644\u0627\u0633\u062A\u062E\u062F\u0627\u0645 \u062D\u0627\u0644\u064A\u0627\u064B \u0645\u0646 \u0642\u0628\u0644 \u0628\u0631\u0646\u0627\u0645\u062C \u0622\u062E\u0631!`);
      console.error(` \u064A\u0631\u062C\u0649 \u0625\u063A\u0644\u0627\u0642 \u0623\u064A \u0646\u0627\u0641\u0630\u0629 \u062E\u0627\u062F\u0645 \u0633\u0627\u0628\u0642\u0629 \u0645\u0641\u062A\u0648\u062D\u0629 \u0644\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631\u060C \u062B\u0645 \u062D\u0627\u0648\u0644 \u0627\u0644\u062A\u0634\u063A\u064A\u0644 \u0645\u062C\u062F\u062F\u0627\u064B.`);
      console.error(`==================================================
`);
    } else {
      console.error("\n[\u062E\u0637\u0623 \u0641\u064A \u062A\u0634\u063A\u064A\u0644 \u0627\u0644\u062E\u0627\u062F\u0645]:", err);
    }
  });
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`==================================================`);
    console.log(` \u0646\u0642\u0627\u0628\u0629 \u0627\u0644\u0645\u062D\u0627\u0645\u064A\u0646 \u0628\u062D\u0644\u0628 - \u062F\u0627\u0626\u0631\u0629 \u0627\u0644\u0648\u0643\u0627\u0644\u0627\u062A (\u0646\u0638\u0627\u0645 \u0627\u0644\u062F\u0648\u0631)`);
    console.log(` \u0627\u0644\u062E\u0627\u062F\u0645 \u064A\u0639\u0645\u0644 \u0645\u062D\u0644\u064A\u0627\u064B \u0639\u0644\u0649 \u0627\u0644\u0628\u0648\u0631\u062A: ${PORT}`);
    console.log(` \u0639\u0646\u0627\u0648\u064A\u0646 \u0627\u0644\u0648\u0635\u0648\u0644 \u0627\u0644\u0645\u062D\u0644\u064A\u0629 \u0639\u0644\u0649 \u0627\u0644\u0634\u0628\u0643\u0629 (Wi-Fi):`);
    getLocalIPs().forEach((ip) => {
      console.log(`   \u{1F449} http://${ip}:${PORT}`);
    });
    console.log(`==================================================`);
  });
}
if (!process.env.VERCEL) {
  startServer();
} else {
  const DIST_DIR = join2(__dirname, "dist");
  if (fs2.existsSync(DIST_DIR)) {
    app.use(express.static(DIST_DIR));
  }
}
var server_default = app;
export {
  server_default as default
};
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
