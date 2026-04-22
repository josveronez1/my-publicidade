import { ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'
import { sleep } from '@/composables/retryRequest'

const unreadCount = ref(0)

export function useAdminQuoteInboxMeta() {
  /**
   * Conta `read_at IS NULL`. Se a coluna ainda não existir no projeto (migration
   * não aplicada), trata o erro e zera o badge em vez de falhar o admin.
   */
  async function refreshUnread() {
    const sb = getSupabase()
    for (let attempt = 0; attempt < 2; attempt++) {
      const { count, error } = await sb
        .from('quote_requests')
        .select('id', { count: 'exact', head: true })
        .is('read_at', null)
      if (!error) {
        unreadCount.value = count ?? 0
        return
      }
      const msg = error?.message?.toLowerCase() ?? ''
      const missingCol =
        msg.includes('read_at') ||
        msg.includes('pgrst204') ||
        (msg.includes('column') && msg.includes('schema cache'))
      if (missingCol) {
        if (import.meta.env.DEV) {
          // eslint-disable-next-line no-console
          console.warn('[inbox] read_at indisponível; rode a migration 20260409140000_quote_requests_read_at', error.message)
        }
        unreadCount.value = 0
        return
      }
      if (import.meta.env.DEV) {
        // eslint-disable-next-line no-console
        console.warn('[inbox] contagem não lida, tentativa', attempt + 1, error.message)
      }
      if (attempt < 1) await sleep(400 * (attempt + 1))
    }
    unreadCount.value = 0
  }
  return { unreadCount, refreshUnread }
}
