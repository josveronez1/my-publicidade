import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { getSupabase } from '@/infrastructure/supabaseClient'
import type { AuthChangeEvent, Session } from '@supabase/supabase-js'

/** Evita duas execuções paralelas de `initialize()` (ex.: guards do router) registrando `onAuthStateChange` várias vezes. */
let authInitPromise: Promise<void> | null = null

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const profile = ref<{
    id: string
    role: string
    client_id: string | null
    full_name: string | null
  } | null>(null)
  const initialized = ref(false)

  const isAdmin = computed(
    () =>
      profile.value?.role === 'admin' ||
      profile.value?.role === 'super_admin',
  )
  const isClientUser = computed(
    () => profile.value?.role === 'client_user' && !!profile.value?.client_id,
  )

  /** @returns true se o perfil foi carregado; false se RLS/linha em falta/erro. */
  async function loadProfile(userId: string): Promise<boolean> {
    const sb = getSupabase()
    const { data, error } = await sb
      .from('profiles')
      .select('id, role, client_id, full_name')
      .eq('id', userId)
      .single()
    if (error) {
      console.error(error)
      profile.value = null
      return false
    }
    profile.value = data as typeof profile.value
    return true
  }

  async function initialize() {
    if (initialized.value) return
    if (authInitPromise) {
      await authInitPromise
      return
    }
    authInitPromise = (async () => {
      const sb = getSupabase()
      const { data } = await sb.auth.getSession()
      session.value = data.session
      if (data.session?.user) {
        await loadProfile(data.session.user.id)
      } else {
        profile.value = null
      }
      sb.auth.onAuthStateChange(async (_event: AuthChangeEvent, sess: Session | null) => {
        session.value = sess
        if (sess?.user) {
          await loadProfile(sess.user.id)
        } else {
          profile.value = null
        }
      })
      initialized.value = true
    })()
    try {
      await authInitPromise
    } finally {
      authInitPromise = null
    }
  }

  const PROFILE_MISSING_MESSAGE =
    'Não foi possível carregar o teu perfil. Verifica com o administrador se a tua conta tem registo em "profiles" e permissões corretas.'

  async function signIn(email: string, password: string) {
    const sb = getSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return { error }
    if (!data.user) {
      return { error: { message: 'Resposta de login inesperada.' } }
    }
    session.value = data.session
    const ok = await loadProfile(data.user.id)
    if (!ok) {
      await sb.auth.signOut()
      session.value = null
      profile.value = null
      return { error: { message: PROFILE_MISSING_MESSAGE } }
    }
    return { error: null }
  }

  async function signOut() {
    const sb = getSupabase()
    try {
      await sb.auth.signOut()
    } catch (e) {
      console.error(e)
    } finally {
      session.value = null
      profile.value = null
    }
  }

  return {
    session,
    profile,
    initialized,
    isAdmin,
    isClientUser,
    initialize,
    signIn,
    signOut,
  }
})
