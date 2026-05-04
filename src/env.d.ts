/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** `stub` = fluxo local sem Edge; omitir ou outro valor = Mercado Pago (Checkout Pro). */
  readonly VITE_PAYMENT_GATEWAY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
