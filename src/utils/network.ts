/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Resolves the most accurate and reachable base URL for other devices on the network.
 * Prioritizes:
 * 1. User manual override if chosen
 * 2. Public / Web deployment origin if accessing from a live domain (not localhost)
 * 3. Server-provided APP_URL
 * 4. Local Wi-Fi IPv4 address (avoiding 127.0.0.1 and loopbacks) + Port
 */
export function resolveBaseUrl(
  localIPs: string[] = [],
  port: number = 3000,
  serverAppUrl?: string,
  overrideIP?: string
): string {
  if (overrideIP && overrideIP.trim()) {
    const trimmed = overrideIP.trim();
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return trimmed.replace(/\/+$/, '');
    }
    return `http://${trimmed}:${port}`;
  }

  // If in browser and accessed via domain / external IP (e.g. Cloud Run or public LAN IP)
  if (typeof window !== 'undefined' && window.location) {
    const hostname = window.location.hostname;
    if (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '::1') {
      return window.location.origin;
    }
  }

  // If server provided APP_URL
  if (serverAppUrl && serverAppUrl.startsWith('http')) {
    return serverAppUrl.replace(/\/+$/, '');
  }

  // Local Wi-Fi network: pick first non-loopback IP
  const lanIP = localIPs.find(ip => ip && ip !== '127.0.0.1' && ip !== 'localhost' && !ip.startsWith('127.')) 
    || localIPs[0] 
    || '192.168.1.50';

  return `http://${lanIP}:${port}`;
}

/**
 * Resolves the direct URL for the delegate mobile web portal.
 */
export function resolveAgentUrl(baseUrl: string): string {
  const clean = baseUrl.replace(/\/+$/, '');
  return `${clean}/agent`;
}

/**
 * Safely copies text to the clipboard with fallback for older browsers.
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    // Fallback for non-https or older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    textArea.remove();
    return successful;
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Safely executes a fetch request and parses JSON response, guarding against HTML error pages and startup delays.
 */
export async function apiFetch(url: string, options: RequestInit = {}, retries = 3, delay = 1000): Promise<any> {
  const fetchOptions = {
    cache: 'no-store' as RequestCache,
    ...options
  };
  const baseUrl = (typeof window !== 'undefined') ? window.location.origin : '';
  const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;
  
  try {
    const res = await fetch(fullUrl, fetchOptions);
    const text = await res.text();

    if (!res.ok) {
      let errorMsg = `خطأ في الخادم (${res.status})`;
      try {
        const parsed = JSON.parse(text);
        errorMsg = parsed.error || parsed.message || errorMsg;
      } catch {}

      if ((res.status >= 500 && res.status <= 504) && retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return apiFetch(url, options, retries - 1, delay * 2);
      }

      const err: any = new Error(errorMsg);
      err.status = res.status;
      throw err;
    }

    try {
      return JSON.parse(text);
    } catch {
      if (text.trim().startsWith('<') && retries > 0) {
        await new Promise(r => setTimeout(r, delay));
        return apiFetch(url, options, retries - 1, delay * 2);
      }
      if (text.trim().startsWith('<')) {
        throw new Error('الخادم قيد البدء أو يعيد توجيه الصفحة، يرجى المحاولة بعد قليل.');
      }
      throw new Error('استجابة غير صالحة من الخادم (ليست بصيغة JSON)');
    }
  } catch (err: any) {
    if (retries > 0 && (err.message?.includes('قيد البدء') || err.message?.includes('فشل') || err.message?.includes('Failed to fetch') || err.message?.includes('NetworkError'))) {
      await new Promise(r => setTimeout(r, delay));
      return apiFetch(url, options, retries - 1, delay * 2);
    }
    console.error('Fetch error for', fullUrl, ':', err);
    throw err;
  }
}

