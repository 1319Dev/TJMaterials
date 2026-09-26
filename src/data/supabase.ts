import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function supabaseEnv(): { url: string; key: string; configured: boolean } {
  const url = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
  const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();
  return { url, key, configured: url.length > 0 && key.length > 0 };
}

export function isRemoteConfigured(): boolean {
  return supabaseEnv().configured;
}

export function authRedirectTo(): string {
  const origin = window.location.origin;
  const base = import.meta.env.BASE_URL || '/';
  const prefix = base.endsWith('/') ? base : `${base}/`;
  return `${origin}${prefix}auth/callback`;
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const env = supabaseEnv();
  if (!env.configured) return null;
  if (!client) {
    client = createClient(env.url, env.key, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return client;
}
