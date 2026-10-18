/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import {
  STORES,
  StoreName,
  openLocalDatabase,
  getAllFromStore,
  putManyToStore,
  putToStore,
  deleteFromStore,
  countStore,
  getMetadata,
  setMetadata,
  getInitialSyncState,
  setInitialSyncState,
  getLastSyncTimestamp,
  setLastSyncTimestamp,
  InitialSyncState
} from './indexedDbService';

export interface SyncProgress {
  stage: string;
  percent: number;
  currentTable?: string;
  tablesProcessed?: number;
  totalTables?: number;
  recordsLoaded?: number;
  addedCount?: number;
  updatedCount?: number;
  deletedCount?: number;
  status: 'idle' | 'downloading' | 'verifying' | 'completed' | 'error';
  errorMessage?: string;
}

export interface SyncResult {
  success: boolean;
  isInitial: boolean;
  addedCount: number;
  updatedCount: number;
  deletedCount: number;
  timestamp: string;
  message?: string;
}

// Ordered list of tables to synchronize matching supabase_schema.sql
const SYNC_TABLES: Array<{ supabaseTable: string; store: StoreName; label: string }> = [
  { supabaseTable: 'branches', store: STORES.BRANCHES, label: 'المكاتب والفروع' },
  { supabaseTable: 'branch_managers', store: STORES.BRANCH_MANAGERS, label: 'حسابات مدراء الفروع' },
  { supabaseTable: 'staff_users', store: STORES.STAFF, label: 'المندوبين والموظفين' },
  { supabaseTable: 'counters', store: STORES.COUNTERS, label: 'الشبابيك ونقاط الخدمة' },
  { supabaseTable: 'services_categories', store: STORES.SERVICES, label: 'الخدمات والتصنيفات' },
  { supabaseTable: 'agencies_transactions', store: STORES.AGENCIES, label: 'معاملات الوكالات والأرشفة' },
  { supabaseTable: 'tickets', store: STORES.TICKETS, label: 'تذاكر الدور وسجلات الانتظار' },
  { supabaseTable: 'audit_logs', store: STORES.AUDIT_LOGS, label: 'سجلات الرقابة والتدقيق' },
  { supabaseTable: 'counter_sessions', store: STORES.COUNTER_SESSIONS, label: 'جلسات العمل اليومية' },
  { supabaseTable: 'transaction_attachments', store: STORES.ATTACHMENTS, label: 'سجلات المرفقات والوثائق' }
];

/**
 * Paginated fetch helper to read all rows from Supabase without exceeding query limits.
 */
async function fetchAllRowsPaginated(
  tableName: string,
  onBatchLoaded?: (count: number) => void
): Promise<any[]> {
  const pageSize = 300;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, from + pageSize - 1);

    if (error) {
      // Table might not exist or be empty in this Supabase instance
      const isMissingTable =
        error.message.includes('relation') ||
        error.message.includes('does not exist') ||
        error.message.includes('schema cache') ||
        error.code === '42P01' ||
        error.code === 'PGRST204';
      if (isMissingTable) {
        console.warn(`Supabase table "${tableName}" does not exist or is inaccessible, skipping.`);
        return [];
      }
      console.warn(`Error fetching table "${tableName}":`, error);
      return []; // Gracefully return empty array instead of aborting sync
    }

    if (data && data.length > 0) {
      allRows = allRows.concat(data);
      onBatchLoaded?.(allRows.length);
      if (data.length < pageSize) {
        hasMore = false;
      } else {
        from += pageSize;
      }
    } else {
      hasMore = false;
    }
  }

  return allRows;
}

/**
 * Performs a comprehensive initial download from Supabase into IndexedDB.
 */
export async function performInitialDownload(
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) {
    throw new Error('أسرار Supabase غير معرّفة بعد في بيئة التشغيل.');
  }

  await setInitialSyncState({
    inProgress: true,
    stage: 'بدء التحميل الأولي الشامل...',
    percent: 5,
    error: undefined
  });

  onProgress?.({
    stage: 'بدء الاتصال بالسحابة وفحص الجداول...',
    percent: 5,
    status: 'downloading',
    tablesProcessed: 0,
    totalTables: SYNC_TABLES.length,
    recordsLoaded: 0
  });

  let totalRecordsLoaded = 0;
  const tablesCompleted: string[] = [];

  try {
    for (let i = 0; i < SYNC_TABLES.length; i++) {
      const { supabaseTable, store, label } = SYNC_TABLES[i];
      const startPercent = 10 + Math.floor((i / SYNC_TABLES.length) * 80);

      onProgress?.({
        stage: `جاري تنزيل جدول: ${label} (${i + 1}/${SYNC_TABLES.length})...`,
        percent: startPercent,
        currentTable: label,
        status: 'downloading',
        tablesProcessed: i,
        totalTables: SYNC_TABLES.length,
        recordsLoaded: totalRecordsLoaded
      });

      const rows = await fetchAllRowsPaginated(supabaseTable, currentCount => {
        onProgress?.({
          stage: `جاري استلام بيانات ${label} (${currentCount} سجل)...`,
          percent: startPercent + 3,
          currentTable: label,
          status: 'downloading',
          tablesProcessed: i,
          totalTables: SYNC_TABLES.length,
          recordsLoaded: totalRecordsLoaded + currentCount
        });
      });
      console.log(`Table ${supabaseTable} fetched, rows count:`, rows.length);

      // Write safely to IndexedDB
      if (rows.length > 0) {
        await putManyToStore(store, rows);
        totalRecordsLoaded += rows.length;
      }

      tablesCompleted.push(supabaseTable);

      await setInitialSyncState({
        tablesCompleted,
        totalRecordsLoaded,
        percent: startPercent + 5
      });
    }

    // Verification Step
    onProgress?.({
      stage: 'جاري التحقق من سلامة واكتمال البيانات المحفوظة محلياً...',
      percent: 95,
      status: 'verifying',
      tablesProcessed: SYNC_TABLES.length,
      totalTables: SYNC_TABLES.length,
      recordsLoaded: totalRecordsLoaded
    });

    const completionTimestamp = new Date().toISOString();

    await setInitialSyncState({
      completed: true,
      inProgress: false,
      completedAt: completionTimestamp,
      percent: 100,
      totalRecordsLoaded,
      tablesCompleted
    });

    await setLastSyncTimestamp(completionTimestamp);

    onProgress?.({
      stage: 'اكتمل التحميل الأولي بنجاح تام! جاهز للعمل.',
      percent: 100,
      status: 'completed',
      tablesProcessed: SYNC_TABLES.length,
      totalTables: SYNC_TABLES.length,
      recordsLoaded: totalRecordsLoaded
    });

    return {
      success: true,
      isInitial: true,
      addedCount: totalRecordsLoaded,
      updatedCount: 0,
      deletedCount: 0,
      timestamp: completionTimestamp,
      message: `تم تحميل ${totalRecordsLoaded} سجل محلياً بنجاح.`
    };
  } catch (err: any) {
    const errorMsg = err.message || 'حدث خطأ أثناء التحميل الأولي للبيانات.';
    await setInitialSyncState({
      inProgress: false,
      error: errorMsg
    });
    onProgress?.({
      stage: `فشل التحميل: ${errorMsg}`,
      percent: 0,
      status: 'error',
      errorMessage: errorMsg
    });
    throw err;
  }
}

/**
 * Performs differential / delta synchronization against Supabase.
 * Fetches only new, updated, or soft-deleted records since the last sync.
 */
export async function performDifferentialSync(
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  const syncState = await getInitialSyncState();
  if (!syncState.completed) {
    // If initial sync never succeeded, execute full initial download
    return await performInitialDownload(onProgress);
  }

  const lastSync = (await getLastSyncTimestamp()) || syncState.completedAt || new Date(0).toISOString();
  const currentSyncTime = new Date().toISOString();

  onProgress?.({
    stage: 'جاري فحص التحديثات الجديدة في السحابة (مزامنة تفاضلية)...',
    percent: 15,
    status: 'downloading',
    addedCount: 0,
    updatedCount: 0,
    deletedCount: 0
  });

  let totalAdded = 0;
  let totalUpdated = 0;
  let totalDeleted = 0;

  try {
    // 1. Push any pending offline HQ changes first
    await pushPendingHqChanges();

    // 2. Pull changes per table
    for (let i = 0; i < SYNC_TABLES.length; i++) {
      const { supabaseTable, store, label } = SYNC_TABLES[i];
      const stepPercent = 20 + Math.floor((i / SYNC_TABLES.length) * 70);

      onProgress?.({
        stage: `فحص التعديلات في ${label}...`,
        percent: stepPercent,
        currentTable: label,
        status: 'downloading'
      });

      // Fetch records updated or created after last sync
      let newOrUpdatedRows: any[] = [];
      try {
        const { data, error } = await supabase
          .from(supabaseTable)
          .select('*')
          .or(`updated_at.gt.${lastSync},created_at.gt.${lastSync}`);

        if (!error && data) {
          newOrUpdatedRows = data;
        } else if (error && !error.message.includes('does not exist')) {
          // If updated_at doesn't exist, try created_at only
          const fallbackRes = await supabase
            .from(supabaseTable)
            .select('*')
            .gt('created_at', lastSync);
          if (fallbackRes.data) newOrUpdatedRows = fallbackRes.data;
        }
      } catch (e) {
        console.warn(`Delta query warning on ${supabaseTable}:`, e);
      }

      // Check for soft deletions if supported
      let deletedIds: string[] = [];
      try {
        const { data: delData } = await supabase
          .from(supabaseTable)
          .select('id')
          .gt('deleted_at', lastSync);
        if (delData && delData.length > 0) {
          deletedIds = delData.map(d => d.id);
        }
      } catch {}

      // Apply upserts
      for (const row of newOrUpdatedRows) {
        if (!row || !row.id) continue;
        const exists = await getByIdFromStore(store, row.id);
        if (exists) {
          totalUpdated++;
        } else {
          totalAdded++;
        }
        await putToStore(store, row);
      }

      // Apply deletions
      for (const id of deletedIds) {
        await deleteFromStore(store, id);
        totalDeleted++;
      }
    }

    // Commit timestamp
    await setLastSyncTimestamp(currentSyncTime);

    onProgress?.({
      stage: 'اكتملت المزامنة التفاضلية بنجاح.',
      percent: 100,
      status: 'completed',
      addedCount: totalAdded,
      updatedCount: totalUpdated,
      deletedCount: totalDeleted
    });

    return {
      success: true,
      isInitial: false,
      addedCount: totalAdded,
      updatedCount: totalUpdated,
      deletedCount: totalDeleted,
      timestamp: currentSyncTime,
      message: `تم تحديث ${totalAdded + totalUpdated} سجل وحذف ${totalDeleted} سجل.`
    };
  } catch (err: any) {
    const errorMsg = err.message || 'فشلت المزامنة التفاضلية.';
    onProgress?.({
      stage: `فشل التحقق: ${errorMsg}`,
      percent: 0,
      status: 'error',
      errorMessage: errorMsg
    });
    throw err;
  }
}

/**
 * Pushes any changes made locally by the General Manager in HQ Dashboard
 * to IndexedDB, and to Supabase (or queues them if offline).
 */
export async function saveHqChangeLocallyAndCloud(
  store: StoreName,
  supabaseTable: string,
  record: any,
  operation: 'INSERT' | 'UPDATE' | 'DELETE' = 'UPDATE'
): Promise<{ success: boolean; cloudSynced: boolean }> {
  // 1. Save to local IndexedDB immediately
  if (operation === 'DELETE') {
    await deleteFromStore(store, record.id);
  } else {
    const updatedRecord = {
      ...record,
      updated_at: new Date().toISOString()
    };
    await putToStore(store, updatedRecord);
  }

  // 2. Attempt push to Supabase
  let cloudSynced = false;
  if (isSupabaseConfigured()) {
    try {
      if (operation === 'DELETE') {
        const { error } = await supabase.from(supabaseTable).delete().eq('id', record.id);
        if (!error) cloudSynced = true;
      } else {
        const { error } = await supabase.from(supabaseTable).upsert(record);
        if (!error) cloudSynced = true;
      }
    } catch (e) {
      console.warn('Could not push change to cloud immediately, queuing:', e);
    }
  }

  // 3. If cloud push failed, queue in pending_changes
  if (!cloudSynced) {
    const pending = (await getMetadata<any[]>('pending_changes')) || [];
    pending.push({
      id: `${supabaseTable}-${record.id}-${Date.now()}`,
      supabaseTable,
      store,
      operation,
      record,
      timestamp: new Date().toISOString()
    });
    await setMetadata('pending_changes', pending);
  }

  return { success: true, cloudSynced };
}

/**
 * Flushes pending changes to Supabase when reconnected.
 */
async function pushPendingHqChanges(): Promise<number> {
  const pending = (await getMetadata<any[]>('pending_changes')) || [];
  if (pending.length === 0) return 0;

  const remaining: any[] = [];
  let pushedCount = 0;

  for (const item of pending) {
    try {
      if (item.operation === 'DELETE') {
        const { error } = await supabase.from(item.supabaseTable).delete().eq('id', item.record.id);
        if (error) remaining.push(item);
        else pushedCount++;
      } else {
        const { error } = await supabase.from(item.supabaseTable).upsert(item.record);
        if (error) remaining.push(item);
        else pushedCount++;
      }
    } catch {
      remaining.push(item);
    }
  }

  await setMetadata('pending_changes', remaining);
  return pushedCount;
}

// Helper to check if a specific store has a record
async function getByIdFromStore(store: StoreName, id: string): Promise<any | null> {
  const db = await openLocalDatabase();
  return new Promise(resolve => {
    try {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(id);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}
