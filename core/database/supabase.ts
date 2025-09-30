import { createClient, SupabaseClient } from '@supabase/supabase-js'

// Lazy initialization to ensure env vars are available at runtime
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

function initializeClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    const missing = [];
    if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (!supabaseServiceKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');

    const error = `Missing Supabase environment variables: ${missing.join(', ')}`;
    console.error('[Supabase] Initialization error:', error);
    throw new Error(error);
  }

  console.log('[Supabase] Initializing clients with URL:', supabaseUrl.substring(0, 30) + '...');

  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseAnonKey);
  }

  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
  }
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!_supabase) {
      initializeClients();
    }
    return (_supabase as any)[prop];
  }
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!_supabaseAdmin) {
      initializeClients();
    }
    return (_supabaseAdmin as any)[prop];
  }
});

export type Database = {
  public: {
    Tables: {
      auth_sessions: {
        Row: {
          id: string
          user_email: string
          aimharder_token: string
          aimharder_cookies: Array<{ name: string; value: string }>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_email: string
          aimharder_token: string
          aimharder_cookies: Array<{ name: string; value: string }>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_email?: string
          aimharder_token?: string
          aimharder_cookies?: Array<{ name: string; value: string }>
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}