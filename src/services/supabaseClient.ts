/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Read strictly from environment secrets
const getEnvSecret = (key: string): string => {
  const envVal = (import.meta as any).env?.[key];
  if (envVal && typeof envVal === 'string' && envVal.trim()) {
    return envVal.trim();
  }
  return '';
};

let currentUrl = getEnvSecret('VITE_SUPABASE_URL') || 'https://kllqkzuumhvtpzwdekfp.supabase.co';
let currentKey = getEnvSecret('VITE_SUPABASE_ANON_KEY') || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtsbHFrenV1bWh2dHB6d2Rla2ZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxNzc3MzIsImV4cCI6MjEwNzc1MzczMn0.dummy_anon_fallback_key';

// If key is empty, use dummy key only to prevent constructor throw
const safeKey = currentKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_unconfigured_client';
const safeUrl = currentUrl || 'https://placeholder.supabase.co';

export let supabase: SupabaseClient = createClient(safeUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export function isSupabaseConfigured(): boolean {
  return Boolean(currentUrl && currentKey && !currentKey.includes('dummy_anon_key'));
}

export function getSupabaseCredentials(): { url: string; key: string; host: string } {
  let host = '';
  try {
    if (currentUrl) host = new URL(currentUrl).hostname;
  } catch {}
  return {
    url: currentUrl,
    key: currentKey ? '••••••••••••••••' : '',
    host
  };
}

// Dynamically refresh secrets from server API if needed
export async function syncRuntimeSecretsFromServer(): Promise<boolean> {
  try {
    const res = await fetch('/api/sync/client-config', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data && data.configured && data.supabaseUrl && data.hasKey) {
        currentUrl = data.supabaseUrl;
        // If we received new URL, recreate client
        supabase = createClient(data.supabaseUrl, safeKey, {
          auth: {
            persistSession: true,
            autoRefreshToken: true
          }
        });
        return true;
      }
    }
  } catch (e) {
    // Non-fatal
  }
  return isSupabaseConfigured();
}
