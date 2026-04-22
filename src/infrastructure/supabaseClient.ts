import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

/** Browser client — anon key only; RLS applies. Tipagem ampla até `supabase gen types`. */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createClient(url, anon, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      /** Garante persistência explícita no browser (evita perder sessão em alguns contextos). */
      storage: typeof localStorage !== 'undefined' ? localStorage : undefined,
      detectSessionInUrl: true,
    },
  })
}

let singleton: SupabaseClient | null = null

export function getSupabase(): SupabaseClient {
  if (!singleton) singleton = createSupabaseBrowserClient()
  return singleton
}
