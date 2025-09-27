import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

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