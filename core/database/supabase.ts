import { createClient, SupabaseClient } from "@supabase/supabase-js";

// Export SupabaseClient type for use in other modules
export type { SupabaseClient } from "@supabase/supabase-js";

// Lazy initialization to ensure env vars are available at runtime
let _supabase: SupabaseClient | null = null;
let _supabaseAdmin: SupabaseClient | null = null;

/**
 * Configuration for isolated Supabase clients
 */
interface SupabaseConfig {
  instanceId?: string;
  connectionTimeout?: number;
}

function initializeClients() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    const missing = [];
    if (!supabaseUrl) missing.push("NEXT_PUBLIC_SUPABASE_URL");
    if (!supabaseAnonKey) missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    if (!supabaseServiceKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

    const error = `Missing Supabase environment variables: ${missing.join(
      ", "
    )}`;
    console.error("[Supabase] Initialization error:", error);
    throw new Error(error);
  }

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
  },
});

export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(target, prop) {
    if (!_supabaseAdmin) {
      initializeClients();
    }
    return (_supabaseAdmin as any)[prop];
  },
});

/**
 * Create isolated Supabase admin client for cron jobs
 *
 * Why isolated?
 * - Prevents connection pool exhaustion between concurrent cron calls
 * - Each client has its own connection management
 * - Includes retry logic for failed requests
 * - No session persistence (stateless)
 *
 * Use this for:
 * - Cron job executions
 * - Background tasks
 * - Any scenario where multiple serverless instances run concurrently
 */
export function createIsolatedSupabaseAdmin(
  config?: SupabaseConfig
): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    db: {
      schema: "public",
    },
    global: {
      headers: {
        "x-instance-id": config?.instanceId || crypto.randomUUID(),
      },
      fetch: createFetchWithRetry({
        maxRetries: 2,
        timeout: config?.connectionTimeout || 10000,
      }),
    },
    auth: {
      persistSession: false, // Don't keep session alive
      autoRefreshToken: false, // No token refresh
    },
  });
}

/**
 * Create fetch function with retry logic and timeout
 */
function createFetchWithRetry(options: {
  maxRetries: number;
  timeout: number;
}) {
  return async (
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> => {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= options.maxRetries; attempt++) {
      let attemptStartTime = Date.now();
      try {
        const controller = new AbortController();
        console.log(
          `[Supabase Fetch] Attempt ${attempt + 1}/${options.maxRetries + 1}, timeout: ${options.timeout}ms, URL: ${String(input).substring(0, 100)}...`
        );

        const timeoutId = setTimeout(() => {
          console.error(
            `[Supabase Fetch] Timeout after ${options.timeout}ms, aborting attempt ${attempt + 1}`
          );
          controller.abort();
        }, options.timeout);

        console.log(
          `[Supabase Fetch] Sending fetch request for attempt ${attempt + 1}...`
        );

        const response = await fetch(input, {
          ...init,
          signal: controller.signal,
        });

        console.log(
          `[Supabase Fetch] Fetch returned for attempt ${attempt + 1}, clearing timeout`
        );

        clearTimeout(timeoutId);
        const elapsedTime = Date.now() - attemptStartTime;
        console.log(
          `[Supabase Fetch] Attempt ${attempt + 1} succeeded in ${elapsedTime}ms, status: ${response.status}`
        );

        // Return even if not ok (let caller handle HTTP errors)
        return response;
      } catch (error) {
        lastError = error as Error;
        const elapsedTime = Date.now() - attemptStartTime;

        console.warn(
          `[Supabase Fetch] Attempt ${attempt + 1} failed after ${elapsedTime}ms: ${(error as Error).message}`
        );

        // Don't retry on last attempt
        if (attempt < options.maxRetries) {
          const delay = 100 * (attempt + 1); // Exponential backoff: 100ms, 200ms
          console.warn(
            `[Supabase Fetch] Retrying in ${delay}ms... (attempt ${attempt + 1}/${options.maxRetries})`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    // All attempts failed
    console.error(
      "[Supabase Fetch] All fetch attempts failed after 3 retries:",
      lastError?.message
    );
    throw lastError;
  };
}

export type Database = {
  public: {
    Tables: {
      auth_sessions: {
        Row: {
          id: string;
          user_email: string;
          aimharder_token: string;
          aimharder_cookies: Array<{ name: string; value: string }>;
          is_admin: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_email: string;
          aimharder_token: string;
          aimharder_cookies: Array<{ name: string; value: string }>;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_email?: string;
          aimharder_token?: string;
          aimharder_cookies?: Array<{ name: string; value: string }>;
          is_admin?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      boxes: {
        Row: {
          id: string;
          box_id: string;
          subdomain: string;
          name: string;
          phone: string | null;
          email: string | null;
          address: string | null;
          website: string | null;
          logo_url: string | null;
          base_url: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          box_id: string;
          subdomain: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          logo_url?: string | null;
          base_url: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          box_id?: string;
          subdomain?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address?: string | null;
          website?: string | null;
          logo_url?: string | null;
          base_url?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      user_boxes: {
        Row: {
          id: string;
          user_email: string;
          box_id: string;
          last_accessed_at: string | null;
          detected_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_email: string;
          box_id: string;
          last_accessed_at?: string | null;
          detected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_email?: string;
          box_id?: string;
          last_accessed_at?: string | null;
          detected_at?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      prebookings: {
        Row: {
          id: string;
          user_email: string;
          booking_data: any;
          available_at: string;
          status: string;
          qstash_schedule_id: string | null;
          box_id: string;
          result: any | null;
          error_message: string | null;
          created_at: string;
          loaded_at: string | null;
          executed_at: string | null;
        };
        Insert: {
          id?: string;
          user_email: string;
          booking_data: any;
          available_at: string;
          status: string;
          qstash_schedule_id?: string | null;
          box_id: string;
          result?: any | null;
          error_message?: string | null;
          created_at?: string;
          loaded_at?: string | null;
          executed_at?: string | null;
        };
        Update: {
          id?: string;
          user_email?: string;
          booking_data?: any;
          available_at?: string;
          status?: string;
          qstash_schedule_id?: string | null;
          box_id?: string;
          result?: any | null;
          error_message?: string | null;
          created_at?: string;
          loaded_at?: string | null;
          executed_at?: string | null;
        };
      };
    };
  };
};
