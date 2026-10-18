/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import fs from 'fs';
import { join } from 'path';
import crypto from 'crypto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Branch,
  SyncQueueItem,
  SyncHistoryLog,
  SyncSettings,
  AgencyTransaction,
  TransactionAttachment,
  Ticket,
  CounterSession,
  AuditLog
} from './types';

export interface HQBranchesCache {
  lastUpdated: string;
  branches: Branch[];
  ticketsByBranch: Record<string, Ticket[]>;
  agenciesByBranch: Record<string, AgencyTransaction[]>;
  auditLogsByBranch: Record<string, AuditLog[]>;
  summary: {
    totalBranches: number;
    activeBranches: number;
    totalTodayTickets: number;
    totalCompletedTickets: number;
    totalAgenciesCount: number;
  };
}

const ATTACHMENTS_DIR = join(process.cwd(), 'data', 'attachments');
const HQ_CACHE_FILE = join(process.cwd(), 'data', 'hq_branches_cache.json');

// Ensure attachments directory exists
try {
  if (!fs.existsSync(ATTACHMENTS_DIR)) {
    fs.mkdirSync(ATTACHMENTS_DIR, { recursive: true });
  }
} catch (e) {
  console.warn('Could not create attachments directory:', e);
}

export class SyncService {
  private db: any;
  private saveDbCallback: (db: any) => void;
  private broadcastCallback: () => void;
  private syncTimer: NodeJS.Timeout | null = null;
  private isSyncing = false;

  constructor(db: any, saveDb: (db: any) => void, broadcast: () => void) {
    this.db = db;
    this.saveDbCallback = saveDb;
    this.broadcastCallback = broadcast;

    // Ensure array initializations
    if (!this.db.syncQueue) this.db.syncQueue = [];
    if (!this.db.syncHistory) this.db.syncHistory = [];
    if (!this.db.agenciesTransactions) this.db.agenciesTransactions = [];

    // Ensure default sync settings
    if (!this.db.syncSettings) {
      this.db.syncSettings = {
        branchId: process.env.BRANCH_ID || 'branch-aleppo-main',
        branchName: process.env.BRANCH_NAME || 'المقر الرئيسي - القصر العدلي بحلب',
        branchCode: process.env.BRANCH_CODE || 'ALP-MAIN',
        isHeadquarters: process.env.IS_HQ === 'true' || true,
        supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '',
        supabaseKey: process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '',
        syncIntervalMinutes: 2,
        autoSyncEnabled: false,
        lastSyncStatus: 'idle',
        lastSyncMessage: 'في انتظار الإعداد أو التشغيل اليدوي'
      };
    }

    this.startAutoSync();
  }

  public getEffectiveUrl(overrideUrl?: string): string {
    const fromEnv = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    if (overrideUrl && overrideUrl.trim()) return overrideUrl.trim();
    return (this.db.syncSettings?.supabaseUrl || '').trim();
  }

  public getEffectiveKey(overrideKey?: string): string {
    const fromEnv =
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY;
    if (fromEnv && fromEnv.trim()) return fromEnv.trim();
    if (overrideKey && overrideKey.trim() && !overrideKey.includes('•')) return overrideKey.trim();
    return (this.db.syncSettings?.supabaseKey || '').trim();
  }

  public getSettings(): SyncSettings {
    const effectiveUrl = this.getEffectiveUrl();
    const effectiveKey = this.getEffectiveKey();
    const isUrlFromEnv = Boolean(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL);
    const isKeyFromEnv = Boolean(
      process.env.SUPABASE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY
    );

    return {
      ...this.db.syncSettings,
      supabaseUrl: effectiveUrl,
      // Never send raw secret key to client over API
      supabaseKey: effectiveKey ? '••••••••••••••••' : '',
      isKeyConfigured: Boolean(effectiveKey),
      isKeyFromEnv,
      isUrlFromEnv
    };
  }

  public updateSettings(newSettings: Partial<SyncSettings>) {
    const currentKey = this.db.syncSettings.supabaseKey || '';
    let updatedKey = newSettings.supabaseKey;
    if (!updatedKey || updatedKey.includes('•')) {
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

  public getSupabaseClient(overrideUrl?: string, overrideKey?: string): SupabaseClient | null {
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

  public async testConnection(url?: string, key?: string): Promise<{ success: boolean; message: string }> {
    const client = this.getSupabaseClient(url, key);
    if (!client) {
      return { success: false, message: 'رابط Supabase والمفتاح مطلوبان للاتصال (يمكن وضعهما في الأسرار البيئية أو الحقول).' };
    }
    try {
      const { data, error } = await client.from('branches').select('id, name').limit(1);
      if (error) {
        return { success: false, message: `تعذر الاتصال بقاعدة البيانات: ${error.message}` };
      }
      return { success: true, message: 'تم الاتصال بنجاح بقاعدة بيانات Supabase المركزية!' };
    } catch (err: any) {
      return { success: false, message: `فشل فحص الاتصال: ${err.message || 'انقطاع الاتصال بالسحابة'}` };
    }
  }

  /**
   * Enqueues an entity change for offline-safe syncing
   */
  public enqueue(
    entityType: 'ticket' | 'counter_session' | 'audit_log' | 'agency' | 'attachment',
    entityLocalId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE',
    payload: any
  ) {
    if (!this.db.syncQueue) this.db.syncQueue = [];
    const branchId = this.db.syncSettings.branchId;

    // Avoid duplicate pending items for same entity
    const existingIndex = this.db.syncQueue.findIndex(
      (item: SyncQueueItem) =>
        item.entityType === entityType &&
        item.entityLocalId === entityLocalId &&
        item.syncStatus === 'pending'
    );

    const queueItem: SyncQueueItem = {
      id: Date.now() + Math.floor(Math.random() * 1000),
      branchId,
      entityType,
      entityLocalId,
      operation,
      payload,
      syncStatus: 'pending',
      retryCount: 0,
      createdAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      this.db.syncQueue[existingIndex] = queueItem;
    } else {
      this.db.syncQueue.push(queueItem);
    }

    // Limit syncQueue memory to last 500 records to prevent memory bloat
    if (this.db.syncQueue.length > 500) {
      this.db.syncQueue = this.db.syncQueue.filter(
        (i: SyncQueueItem) => i.syncStatus !== 'synced' || Date.now() - new Date(i.createdAt || Date.now()).getTime() < 86400000
      );
    }

    this.saveDbCallback(this.db);
  }

  /**
   * Push branch local data to Supabase (Runs on Branch or HQ when internet is available)
   */
  public async pushBranchData(): Promise<{ success: boolean; pushedCount: number; message: string }> {
    const client = this.getSupabaseClient();
    if (!client) {
      return { success: false, pushedCount: 0, message: 'إعدادات Supabase غير مهيأة بعد.' };
    }

    const branchId = this.db.syncSettings.branchId;
    const branchName = this.db.syncSettings.branchName;
    const pendingItems: SyncQueueItem[] = (this.db.syncQueue || []).filter(
      (i: SyncQueueItem) => i.syncStatus === 'pending' || (i.syncStatus === 'failed' && (i.retryCount || 0) < 5)
    );

    if (pendingItems.length === 0) {
      // Even if no items, ping branch heartbeat to Supabase
      try {
        await client.from('branches').upsert(
          {
            id: branchId,
            name: branchName,
            code: this.db.syncSettings.branchCode,
            is_headquarters: this.db.syncSettings.isHeadquarters,
            last_sync_at: new Date().toISOString(),
            is_active: true
          },
          { onConflict: 'id' }
        );
      } catch {}

      return { success: true, pushedCount: 0, message: 'لا توجد بيانات جديدة معلقة للمزامنة.' };
    }

    let successCount = 0;
    const errors: string[] = [];

    for (const item of pendingItems) {
      try {
        if (item.entityType === 'ticket') {
          const t: Ticket = item.payload;
          const { error } = await client.from('tickets').upsert(
            {
              branch_id: branchId,
              local_id: t.id,
              ticket_date: this.db.date || new Date().toISOString().split('T')[0],
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
              synced_at: new Date().toISOString()
            },
            { onConflict: 'branch_id, local_id' }
          );

          if (error) throw error;
        } else if (item.entityType === 'counter_session') {
          const cs: CounterSession = item.payload;
          const { error } = await client.from('counter_sessions').upsert(
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
            { onConflict: 'branch_id, id' }
          );
          if (error) throw error;
        } else if (item.entityType === 'audit_log') {
          const log: AuditLog = item.payload;
          const { error } = await client.from('audit_logs').insert({
            branch_id: branchId,
            local_id: log.id,
            timestamp: log.timestamp,
            action: log.action,
            details: log.details,
            operator_user: log.user,
            category: log.category || 'ticket',
            synced_at: new Date().toISOString()
          });
          if (error) throw error;
        } else if (item.entityType === 'agency') {
          const agency: AgencyTransaction = item.payload;
          const { error } = await client.from('agencies_transactions').upsert(
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
              status: agency.status || 'approved',
              notes: agency.notes || null,
              created_at: agency.createdAt
            },
            { onConflict: 'branch_id, agency_number' }
          );
          if (error) throw error;
        }

        item.syncStatus = 'synced';
        item.syncedAt = new Date().toISOString();
        successCount++;
      } catch (err: any) {
        item.retryCount = (item.retryCount || 0) + 1;
        item.errorMessage = err.message || 'خطأ في إرسال البيانات';
        if (item.retryCount >= 5) {
          item.syncStatus = 'failed';
        }
        errors.push(`[${item.entityType}:${item.entityLocalId}] ${item.errorMessage}`);
      }
    }

    // Update branch heartbeat
    try {
      await client.from('branches').upsert(
        {
          id: branchId,
          name: branchName,
          code: this.db.syncSettings.branchCode,
          is_headquarters: this.db.syncSettings.isHeadquarters,
          last_sync_at: new Date().toISOString(),
          is_active: true
        },
        { onConflict: 'id' }
      );
    } catch {}

    // Record history log
    const historyLog: SyncHistoryLog = {
      id: Date.now(),
      branchId,
      branchName,
      syncDirection: 'branch_to_cloud',
      recordsPushed: successCount,
      filesUploaded: 0,
      status: errors.length === 0 ? 'success' : successCount > 0 ? 'partial' : 'failed',
      details:
        errors.length === 0
          ? `تم رفع ${successCount} سجل بنجاح إلى السحابة.`
          : `تعذر إرسال ${errors.length} سجل. السبب: ${errors[0] || 'خطأ غير معروف'}`,
      timestamp: new Date().toISOString()
    };

    if (!this.db.syncHistory) this.db.syncHistory = [];
    this.db.syncHistory.unshift(historyLog);
    if (this.db.syncHistory.length > 50) this.db.syncHistory.pop();

    this.db.syncSettings.lastSyncTimestamp = new Date().toISOString();
    this.db.syncSettings.lastSyncStatus = historyLog.status;
    this.db.syncSettings.lastSyncMessage = historyLog.details;

    this.saveDbCallback(this.db);
    this.broadcastCallback();

    return {
      success: errors.length === 0,
      pushedCount: successCount,
      message: historyLog.details || ''
    };
  }

  /**
   * Pull all branches data from Supabase for Headquarters Oversight Board
   * and store permanently in local cache file for offline review!
   */
  public async pullAllBranchesDataToHQ(): Promise<{ success: boolean; data?: HQBranchesCache; message: string }> {
    const client = this.getSupabaseClient();
    if (!client) {
      // Fallback: Read existing local cache file if available
      const cached = this.loadHQLocalCache();
      if (cached) {
        return {
          success: true,
          data: cached,
          message: 'تم عرض بيانات الفروع المخزنة محلياً في المقر الرئيسي (وضع عدم الاتصال بالإنترنت).'
        };
      }
      return { success: false, message: 'إعدادات الاتصال السحابي غير متوفرة ولا توجد بيانات مخزنة محلياً.' };
    }

    try {
      // 1. Fetch all branches
      const { data: branchesData, error: branchesErr } = await client
        .from('branches')
        .select('*')
        .order('name', { ascending: true });

      if (branchesErr) throw branchesErr;

      // 2. Fetch today tickets from all branches
      const todayStr = this.db.date || new Date().toISOString().split('T')[0];
      const { data: ticketsData, error: ticketsErr } = await client
        .from('tickets')
        .select('*')
        .gte('ticket_date', todayStr)
        .order('created_at', { ascending: false });

      if (ticketsErr) throw ticketsErr;

      // 3. Fetch agencies from all branches
      const { data: agenciesData, error: agenciesErr } = await client
        .from('agencies_transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(300);

      if (agenciesErr) throw agenciesErr;

      // 4. Fetch audit logs from all branches
      const { data: auditsData, error: auditsErr } = await client
        .from('audit_logs')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(200);

      if (auditsErr) throw auditsErr;

      // Process and structure the data
      const branchesList: Branch[] = (branchesData || []).map((b: any) => {
        const branchTickets = (ticketsData || []).filter((t: any) => t.branch_id === b.id);
        const completedTickets = branchTickets.filter((t: any) => t.status === 'completed');
        const activeStaffSet = new Set(branchTickets.filter((t: any) => t.staff_name).map((t: any) => t.staff_name));

        return {
          id: b.id,
          name: b.name,
          code: b.code,
          city: b.city || 'حلب',
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

      const ticketsByBranch: Record<string, Ticket[]> = {};
      (ticketsData || []).forEach((t: any) => {
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

      const agenciesByBranch: Record<string, AgencyTransaction[]> = {};
      (agenciesData || []).forEach((a: any) => {
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

      const auditLogsByBranch: Record<string, AuditLog[]> = {};
      (auditsData || []).forEach((au: any) => {
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
      const totalCompletedTickets = (ticketsData || []).filter((t: any) => t.status === 'completed').length;
      const totalAgenciesCount = (agenciesData || []).length;

      const cacheResult: HQBranchesCache = {
        lastUpdated: new Date().toISOString(),
        branches: branchesList,
        ticketsByBranch,
        agenciesByBranch,
        auditLogsByBranch,
        summary: {
          totalBranches: branchesList.length,
          activeBranches: branchesList.filter(b => b.isActive).length,
          totalTodayTickets,
          totalCompletedTickets,
          totalAgenciesCount
        }
      };

      // Save to local disk cache in HQ so manager can see everything even if offline!
      this.saveHQLocalCache(cacheResult);

      // Record HQ sync history
      const historyLog: SyncHistoryLog = {
        id: Date.now(),
        branchId: this.db.syncSettings.branchId,
        branchName: 'كمبيوتر المقر الرئيسي',
        syncDirection: 'cloud_to_hq',
        recordsPushed: totalTodayTickets + totalAgenciesCount,
        filesUploaded: 0,
        status: 'success',
        details: `تم جلب وتحديث بيانات ${branchesList.length} فرع (${totalTodayTickets} تذكرة و ${totalAgenciesCount} معاملة) وتخزينها محلياً.`,
        timestamp: new Date().toISOString()
      };

      if (!this.db.syncHistory) this.db.syncHistory = [];
      this.db.syncHistory.unshift(historyLog);
      if (this.db.syncHistory.length > 50) this.db.syncHistory.pop();

      this.db.syncSettings.lastSyncTimestamp = new Date().toISOString();
      this.db.syncSettings.lastSyncStatus = 'success';
      this.db.syncSettings.lastSyncMessage = historyLog.details;

      this.saveDbCallback(this.db);
      this.broadcastCallback();

      return {
        success: true,
        data: cacheResult,
        message: historyLog.details || ''
      };
    } catch (err: any) {
      console.warn('Failed to pull branches data from cloud, loading local cache fallback:', err);
      const fallback = this.loadHQLocalCache();
      return {
        success: fallback !== null,
        data: fallback || undefined,
        message: fallback
          ? 'تعذر الوصول للإنترنت حالياً، وتم عرض آخر نسخة بيانات مخزنة محلياً في المقر.'
          : `خطأ في جلب البيانات من السحابة: ${err.message || 'انقطاع الشبكة'}`
      };
    }
  }

  public saveHQLocalCache(data: HQBranchesCache) {
    try {
      fs.writeFileSync(HQ_CACHE_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error saving HQ local cache:', e);
    }
  }

  public loadHQLocalCache(): HQBranchesCache | null {
    try {
      if (fs.existsSync(HQ_CACHE_FILE)) {
        const raw = fs.readFileSync(HQ_CACHE_FILE, 'utf8');
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading HQ local cache:', e);
    }
    return null;
  }

  /**
   * Saves an attachment file locally and enqueues it for cloud storage upload
   */
  public saveAttachmentLocally(
    localTicketId: string,
    fileName: string,
    fileBase64: string,
    fileType: string
  ): TransactionAttachment {
    const buffer = Buffer.from(fileBase64.replace(/^data:.*?;base64,/, ''), 'base64');
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');
    const extension = fileName.split('.').pop() || 'dat';
    const localFileName = `${Date.now()}_${hash.substring(0, 12)}.${extension}`;
    const filePath = join(ATTACHMENTS_DIR, localFileName);

    fs.writeFileSync(filePath, buffer);

    const attachment: TransactionAttachment = {
      id: `att-${Date.now()}-${hash.substring(0, 8)}`,
      branchId: this.db.syncSettings.branchId,
      localTicketId,
      fileName,
      fileType,
      fileSizeBytes: buffer.length,
      fileHashSha256: hash,
      storagePath: filePath,
      isUploadedToCloud: false,
      createdAt: new Date().toISOString()
    };

    this.enqueue('attachment', attachment.id, 'INSERT', attachment);
    return attachment;
  }

  private startAutoSync() {
    this.restartAutoSync();
  }

  private restartAutoSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
    }

    if (!this.db.syncSettings.autoSyncEnabled) return;

    const intervalMs = Math.max(1, this.db.syncSettings.syncIntervalMinutes || 2) * 60 * 1000;
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
        // Safe silent fail when offline
      } finally {
        this.isSyncing = false;
      }
    }, intervalMs);
  }
}
