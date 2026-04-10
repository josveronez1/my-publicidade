<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const email = ref('')
const password = ref('')
const err = ref<string | null>(null)

async function submit() {
  err.value = null
  const { error } = await auth.signIn(email.value, password.value)
  if (error) {
    err.value = error.message
    return
  }
  await auth.initialize()
  const redir = (route.query.redirect as string) || '/admin'
  if (auth.isAdmin) await router.replace(redir.startsWith('/admin') ? redir : '/admin')
  else if (auth.isClientUser) await router.replace('/client')
  else await router.replace('/')
}
</script>

<template>
  <div class="flex min-h-full flex-col items-center justify-center bg-slate-50 px-4">
    <RouterLink to="/" class="mb-8 flex items-center gap-3">
      <img src="/mw-logo.jpg" alt="" class="h-12 w-12 rounded-xl object-cover" />
      <span class="font-semibold text-slate-900">MW Publicidade</span>
    </RouterLink>
    <form
      class="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      @submit.prevent="submit"
    >
      <h1 class="text-lg font-semibold text-slate-900">Entrar</h1>
      <label class="mt-4 block text-xs font-medium text-slate-600">E-mail</label>
      <input
        v-model="email"
        type="email"
        required
        class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <label class="mt-3 block text-xs font-medium text-slate-600">Senha</label>
      <input
        v-model="password"
        type="password"
        required
        class="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
      <button
        type="submit"
        class="mt-4 w-full rounded-lg bg-[#e7bb0e] py-2 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c]"
      >
        Continuar
      </button>
    </form>
    <RouterLink to="/" class="mt-6 text-sm text-slate-500 hover:text-slate-800">
      ← Voltar ao mapa
    </RouterLink>
  </div>
</template>
