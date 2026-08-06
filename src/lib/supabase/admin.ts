import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Creates a Supabase admin client with service_role key.
 * This client bypasses Row Level Security and should ONLY be used server-side.
 * Never expose the service_role key to the browser.
 */
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
