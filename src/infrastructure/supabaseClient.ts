import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL ?? ''
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY ?? ''

if (import.meta.env.DEV && (!url || !anon)) {
  // eslint-disable-next-line no-console
  console.error(
    '[supabase] Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env; pedidos podem pendurar ou falhar.',
  )
}

/**
 * Timeout em pedidos PostgREST (listas, RPC). Auth e Storage usam `fetch` nativo: o primeiro
 * por sessão/refresh; o segundo por uploads que podem exceder 30s.
 */
const DEFAULT_FETCH_TIMEOUT_MS = 30_000

function requestUrlString(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input
  if (input instanceof URL) return input.href
  return input.url
}

/** Rotas do próprio supabase-js que não devem levar o timeout curto. */
function shouldUseNativeFetchNoTimeout(requestUrl: string, baseUrl: string): boolean {
  let path: string
  try {
    path = new URL(requestUrl, baseUrl).pathname
  } catch {
    return false
  }
  if (path.startsWith('/auth/v1')) return true
  if (path.startsWith('/storage/v1')) return true
  return false
}

/**
 * `fetch` com timeout. Propaga o abort de `init.signal` (Supabase) e aborta de-ofício após o prazo.
 */
function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)
  const parent = init?.signal
  if (parent) {
    if (parent.aborted) {
      clearTimeout(t)
      return Promise.reject(
        (parent as AbortSignal & { reason?: unknown }).reason ??
          new DOMException('Requisição cancelada.', 'AbortError'),
      )
    }
    parent.addEventListener(
      'abort',
      () => {
        clearTimeout(t)
        controller.abort((parent as AbortSignal & { reason?: unknown }).reason)
      },
      { once: true },
    )
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(t))
}

/**
 * Roteia pedidos: Auth fica com `fetch` global do browser; o resto usa timeout.
 */
function fetchForSupabaseClient(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (!url) {
    return Promise.reject(
      new Error('VITE_SUPABASE_URL em falta. Configura o .env e reconstrói a app (Vite).'),
    )
  }
  const s = requestUrlString(input)
  if (shouldUseNativeFetchNoTimeout(s, url)) {
    return fetch(input, init)
  }
  return fetchWithTimeout(input, init)
}

/** Browser client — anon key only; RLS applies. Tipagem ampla até `supabase gen types`. */
export function createSupabaseBrowserClient(): SupabaseClient {
  return createClient(url, anon, {
    global: { fetch: fetchForSupabaseClient },
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
