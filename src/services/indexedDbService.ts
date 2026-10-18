/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Robust IndexedDB Service for persistent local storage on General Manager's device.
 * Stores complete snapshots and handles local queries for branches, staff, tickets,
 * agencies, audits, counters, and attachments.
 */

const DB_NAME = 'AleppoLawyers_HQ_LocalDB';
const DB_VERSION = 1;

export const STORES = {
  BRANCHES: 'branches',
  BRANCH_MANAGERS: 'branch_managers',
  STAFF: 'staff',
  COUNTERS: 'counters',
  SERVICES: 'services',
  AGENCIES: 'agencies_transactions',
  TICKETS: 'tickets',
  AUDIT_LOGS: 'audit_logs',
  COUNTER_SESSIONS: 'counter_sessions',
  ATTACHMENTS: 'attachments',
  SYNC_METADATA: 'sync_metadata'
} as const;

export type StoreName = typeof STORES[keyof typeof STORES];

let dbInstance: IDBDatabase | null = null;

/**
 * Initializes and opens the IndexedDB database.
 */
export function openLocalDatabase(): Promise<IDBDatabase> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB غير مدعوم في هذا المتصفح.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object stores with primary key 'id'
      const keyIdStores = [
        STORES.BRANCHES,
        STORES.BRANCH_MANAGERS,
        STORES.STAFF,
        STORES.COUNTERS,
        STORES.SERVICES,
        STORES.AGENCIES,
        STORES.TICKETS,
        STORES.AUDIT_LOGS,
        STORES.COUNTER_SESSIONS,
        STORES.ATTACHMENTS
      ];

      keyIdStores.forEach(storeName => {
        if (!db.objectStoreNames.contains(storeName)) {
          const store = db.createObjectStore(storeName, { keyPath: 'id' });
          // Helpful indexes for filtering
          try {
            store.createIndex('branch_id', 'branch_id', { unique: false });
          } catch {}
          try {
            store.createIndex('updated_at', 'updated_at', { unique: false });
          } catch {}
          try {
            store.createIndex('created_at', 'created_at', { unique: false });
          } catch {}
        }
      });

      // Metadata store with keyPath 'key'
      if (!db.objectStoreNames.contains(STORES.SYNC_METADATA)) {
        db.createObjectStore(STORES.SYNC_METADATA, { keyPath: 'key' });
      }
    };

    request.onsuccess = (event: Event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      dbInstance.onversionchange = () => {
        dbInstance?.close();
        dbInstance = null;
      };
      resolve(dbInstance);
    };

    request.onerror = (event: Event) => {
      const err = (event.target as IDBOpenDBRequest).error;
      console.error('Failed to open IndexedDB:', err);
      reject(err || new Error('فشل فتح قاعدة البيانات المحلية IndexedDB'));
    };
  });
}

/**
 * Gets all records from a specific store.
 */
export async function getAllFromStore<T = any>(storeName: StoreName): Promise<T[]> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.getAll();

    request.onsuccess = () => resolve((request.result as T[]) || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Gets a single record by ID.
 */
export async function getByIdFromStore<T = any>(storeName: StoreName, id: string): Promise<T | null> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.get(id);

    request.onsuccess = () => resolve((request.result as T) || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Puts/upserts a single record into a store.
 */
export async function putToStore<T = any>(storeName: StoreName, item: T): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.put(item);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Bulk upserts records in a single transactional batch.
 */
export async function putManyToStore<T extends { id: string }>(
  storeName: StoreName,
  items: T[]
): Promise<number> {
  if (!items || items.length === 0) return 0;
  const db = await openLocalDatabase();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);

    let count = 0;
    for (const item of items) {
      if (item && item.id) {
        store.put(item);
        count++;
      }
    }

    tx.oncomplete = () => resolve(count);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(new Error(`Transaction aborted for store: ${storeName}`));
  });
}

/**
 * Deletes a single record by ID.
 */
export async function deleteFromStore(storeName: StoreName, id: string): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.delete(id);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Clears an entire store.
 */
export async function clearStore(storeName: StoreName): Promise<void> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const request = store.clear();

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

/**
 * Counts records in a store.
 */
export async function countStore(storeName: StoreName): Promise<number> {
  const db = await openLocalDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const request = store.count();

    request.onsuccess = () => resolve(request.result || 0);
    request.onerror = () => reject(request.error);
  });
}

// ==========================================
// METADATA & SYNC STATE HELPERS
// ==========================================

export async function getMetadata<T = any>(key: string): Promise<T | null> {
  try {
    const item = await getByIdFromStore<{ key: string; value: T }>(STORES.SYNC_METADATA, key);
    return item ? item.value : null;
  } catch (err) {
    console.warn(`Error reading metadata key "${key}":`, err);
    return null;
  }
}

export async function setMetadata<T = any>(key: string, value: T): Promise<void> {
  try {
    await putToStore(STORES.SYNC_METADATA, { key, value, updatedAt: new Date().toISOString() });
  } catch (err) {
    console.error(`Error setting metadata key "${key}":`, err);
  }
}

export interface InitialSyncState {
  completed: boolean;
  completedAt?: string;
  inProgress?: boolean;
  stage?: string;
  percent?: number;
  totalRecordsLoaded?: number;
  tablesCompleted?: string[];
  error?: string;
}

export async function getInitialSyncState(): Promise<InitialSyncState> {
  const state = await getMetadata<InitialSyncState>('initial_sync_state');
  return (
    state || {
      completed: false,
      inProgress: false,
      percent: 0,
      totalRecordsLoaded: 0
    }
  );
}

export async function setInitialSyncState(state: Partial<InitialSyncState>): Promise<void> {
  const current = await getInitialSyncState();
  await setMetadata('initial_sync_state', { ...current, ...state });
}

export async function getLastSyncTimestamp(): Promise<string | null> {
  return await getMetadata<string>('last_sync_timestamp');
}

export async function setLastSyncTimestamp(isoTimestamp: string): Promise<void> {
  await setMetadata('last_sync_timestamp', isoTimestamp);
}

/**
 * Loads entire local data snapshot for HQ dashboard.
 */
export async function loadHqSnapshotFromLocalDb(): Promise<{
  branches: any[];
  ticketsByBranch: Record<string, any[]>;
  agencies: any[];
  branchManagers: any[];
  auditLogsByBranch: Record<string, any[]>;
  summary: {
    totalBranches: number;
    activeBranches: number;
    totalTodayTickets: number;
    totalCompletedTickets: number;
    totalAgenciesCount: number;
  };
}> {
  const [branches, managers, agencies, tickets, audits] = await Promise.all([
    getAllFromStore(STORES.BRANCHES),
    getAllFromStore(STORES.BRANCH_MANAGERS),
    getAllFromStore(STORES.AGENCIES),
    getAllFromStore(STORES.TICKETS),
    getAllFromStore(STORES.AUDIT_LOGS)
  ]);

  const ticketsByBranch: Record<string, any[]> = {};
  for (const t of tickets) {
    const bId = t.branch_id || t.branchId || 'branch-aleppo-main';
    if (!ticketsByBranch[bId]) ticketsByBranch[bId] = [];
    ticketsByBranch[bId].push({
      ...t,
      id: t.local_id || t.id,
      categoryNameArabic: t.category_name_arabic || t.categoryNameArabic
    });
  }

  const auditLogsByBranch: Record<string, any[]> = {};
  for (const a of audits) {
    const bId = a.branch_id || a.branchId || 'branch-aleppo-main';
    if (!auditLogsByBranch[bId]) auditLogsByBranch[bId] = [];
    auditLogsByBranch[bId].push(a);
  }

  const summary = {
    totalBranches: branches.length,
    activeBranches: branches.filter((b: any) => b.isActive ?? b.is_active ?? true).length,
    totalTodayTickets: tickets.length,
    totalCompletedTickets: tickets.filter((t: any) => t.status === 'completed').length,
    totalAgenciesCount: agencies.length
  };

  return {
    branches,
    ticketsByBranch,
    agencies,
    branchManagers: managers,
    auditLogsByBranch,
    summary
  };
}

/**
 * Resets local database completely (for force re-download).
 */
export async function resetLocalDatabase(): Promise<void> {
  const allStores = Object.values(STORES);
  for (const store of allStores) {
    try {
      await clearStore(store);
    } catch {}
  }
  await setInitialSyncState({
    completed: false,
    inProgress: false,
    percent: 0,
    totalRecordsLoaded: 0,
    tablesCompleted: []
  });
}
