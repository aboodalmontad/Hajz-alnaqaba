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

  // 3. Clear temporary session without deleting user app data
  try {
    if (typeof window !== 'undefined') {
      // Clear sessionStorage for temporary views
      sessionStorage.clear();
      storageCleaned = true;
    }
  } catch (err) {
    console.warn('Failed to clean session storage:', err);
  }

  // 4. Force a clean cache-busting ping to server
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

  // 5. Hard reload if requested
  if (options.hardReload && typeof window !== 'undefined') {
    setTimeout(() => {
      // Add a cache-busting timestamp parameter and force hard navigation
      const url = new URL(window.location.href);
      url.searchParams.set('nocache', Date.now().toString());
      window.location.replace(url.toString());
    }, 400);
  }

  return result;
}
