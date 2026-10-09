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
 * Safely executes a fetch request and parses JSON response, guarding against HTML error pages.
 */
export async function apiFetch(url: string, options: RequestInit = {}) {
  const res = await fetch(url, options);
  const contentType = res.headers.get('content-type') || '';
  
  if (contentType.includes('application/json')) {
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || data.message || `خطأ في الخادم (${res.status})`);
    }
    return data;
  } else {
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`تعذر الاتصال بالخادم (${res.status}): ${text.substring(0, 80)}`);
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('استجابة غير صالحة من الخادم (ليست بصيغة JSON)');
    }
  }
}

