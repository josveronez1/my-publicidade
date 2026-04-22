/**
 * Reexecuta operações do cliente Supabase (PostgREST) quando `error` indica
 * falha transitória (rede, 5xx, etc.).
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Mensagem amigável quando o fetch aborta por timeout (supabaseClient). */
export function requestErrorMessage(e: unknown): string {
  if (e instanceof DOMException && e.name === 'AbortError') {
    return 'Tempo esgotado ou rede indisponível. Tente novamente.'
  }
  if (e instanceof Error) return e.message
  return 'Falha ao carregar.'
}

export type PostgrestResult<T> = { data: T; error: { message: string } | null }

/**
 * O builder `.from()/.rpc()` do supabase-js é `await`-able, mas o tipo ainda
 * reflete o builder, não `Promise<…>`; o cast alinha com o `await` real.
 */
export async function runPostgrestWithRetry<T>(
  op: () => unknown,
  options: { maxAttempts?: number; baseDelayMs?: number } = {},
): Promise<PostgrestResult<T>> {
  const maxAttempts = options.maxAttempts ?? 3
  const baseDelayMs = options.baseDelayMs ?? 400
  let last: PostgrestResult<T> | null = null
  for (let i = 0; i < maxAttempts; i++) {
    last = (await (op() as Promise<PostgrestResult<T>>)) as PostgrestResult<T>
    if (!last.error) return last
    if (i < maxAttempts - 1) {
      await sleep(baseDelayMs * (i + 1))
    }
  }
  return last!
}
