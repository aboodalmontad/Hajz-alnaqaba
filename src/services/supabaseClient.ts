/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

const getEnvOrStorage = (key: string, storageKey: string): string => {
  const envVal = (import.meta as any).env?.[key];
  if (envVal && typeof envVal === 'string' && envVal.trim()) {
    return envVal.trim();
  }
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored && stored.trim()) return stored.trim();
    } catch {}
  }
  return '';
};

let currentUrl = getEnvOrStorage('VITE_SUPABASE_URL', 'supabase_custom_url') || 'https://pmgurqakutyqbsrcslwk.supabase.co';
let currentKey = getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'supabase_custom_key') || '';

// If key is empty in env, use placeholder to prevent constructor throw
const safeKey = currentKey || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_anon_key_for_unconfigured_client';

export let supabase: SupabaseClient = createClient(currentUrl, safeKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true
  }
});

export function isSupabaseConfigured(): boolean {
  const url = getEnvOrStorage('VITE_SUPABASE_URL', 'supabase_custom_url');
  const key = getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'supabase_custom_key');
  return Boolean(url && key && !key.includes('dummy_anon_key'));
}

export function getSupabaseCredentials(): { url: string; key: string } {
  return {
    url: getEnvOrStorage('VITE_SUPABASE_URL', 'supabase_custom_url') || currentUrl,
    key: getEnvOrStorage('VITE_SUPABASE_ANON_KEY', 'supabase_custom_key')
  };
}

export function updateSupabaseConfig(url: string, key: string): SupabaseClient {
  currentUrl = url.trim();
  currentKey = key.trim();
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('supabase_custom_url', currentUrl);
      localStorage.setItem('supabase_custom_key', currentKey);
    } catch {}
  }
  supabase = createClient(currentUrl, currentKey || safeKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    }
  });
  return supabase;
}
