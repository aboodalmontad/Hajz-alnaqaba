/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface ClearCacheResult {
  cachesCleared: number;
  serviceWorkersUnregistered: number;
  storageCleaned: boolean;
  success: boolean;
  timestamp: string;
}

/**
 * Clears browser caches including Cache Storage API, Service Workers,
 * temporary session storage, and forces fresh network requests.
 */
export async function clearAppCache(options: { hardReload?: boolean } = {}): Promise<ClearCacheResult> {
  let cachesCleared = 0;
  let serviceWorkersUnregistered = 0;
  let storageCleaned = false;

  // 1. Clear Cache Storage (Cache API)
  try {
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await window.caches.keys();
      cachesCleared = keys.length;
      await Promise.all(keys.map(key => window.caches.delete(key)));
    }
  } catch (err) {
    console.warn('Failed to clear window.caches:', err);
  }

  // 2. Unregister all active Service Workers
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      serviceWorkersUnregistered = registrations.length;
      await Promise.all(registrations.map(reg => reg.unregister()));
    }
  } catch (err) {
    console.warn('Failed to unregister service workers:', err);
  }

  // 3. Clear temporary session and outdated bundle cache markers
  try {
    if (typeof window !== 'undefined') {
      sessionStorage.clear();
      
      // Clean up workbox and cached asset keys from localStorage
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('workbox') || k.startsWith('vite') || k.includes('bundle') || k.includes('cache_version'))) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      
      storageCleaned = true;
    }
  } catch (err) {
    console.warn('Failed to clean storage:', err);
  }

  // 4. Clean IndexedDB caches (workbox-precache)
  try {
    if (typeof window !== 'undefined' && 'indexedDB' in window) {
      const dbsToDrop = ['workbox-expiration-database', 'workbox-precaching'];
      dbsToDrop.forEach(dbName => {
        try { window.indexedDB.deleteDatabase(dbName); } catch {}
      });
    }
  } catch (err) {
    // Non-fatal
  }

  // 5. Force clean cache-busting ping to server
  try {
    await fetch(`/api/ping?_cb=${Date.now()}`, {
      cache: 'reload',
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (err) {
    // Non-fatal if offline
  }

  const result: ClearCacheResult = {
    cachesCleared,
    serviceWorkersUnregistered,
    storageCleaned,
    success: true,
    timestamp: new Date().toLocaleTimeString('ar-SY')
  };

  // 6. Hard reload if requested with cache-busting query parameter
  if (options.hardReload && typeof window !== 'undefined') {
    setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('nocache', Date.now().toString());
        url.searchParams.set('v', Math.random().toString(36).substring(2, 8));
        window.location.replace(url.toString());
      } catch {
        window.location.reload();
      }
    }, 300);
  }

  return result;
}
