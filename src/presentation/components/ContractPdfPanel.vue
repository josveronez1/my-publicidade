<script setup lang="ts">
import { computed, ref } from 'vue'
import { contractMarkdownToSafeHtml } from '@/infrastructure/contractDocument/markdownToContractHtml'
import { downloadContractPdf } from '@/infrastructure/contractDocument/contractPrintDocument'

const props = defineProps<{
  contractNumber: string
  markdown: string
  logoUrl: string | null
}>()

const busy = ref(false)
const err = ref<string | null>(null)

const safeHtml = computed(() => contractMarkdownToSafeHtml(props.markdown || ''))
const hasBody = computed(() => (props.markdown || '').trim().length > 0)

async function onDownload() {
  if (!hasBody.value) {
    err.value = 'Não há texto de contrato. Edite o registo e associe um modelo com dados do cliente.'
    return
  }
  busy.value = true
  err.value = null
  try {
    await downloadContractPdf(props.markdown, props.contractNumber, props.logoUrl)
  } catch (e) {
    err.value = e instanceof Error ? e.message : 'Falha ao gerar o PDF.'
  } finally {
    busy.value = false
  }
}

</script>

<template>
  <section class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div class="flex flex-wrap items-start justify-between gap-2">
      <h2 class="text-sm font-semibold text-slate-900">Documento (Markdown + logo)</h2>
      <button
        v-if="hasBody"
        type="button"
        class="rounded-lg bg-[#e7bb0e] px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-[#d4a90c] disabled:opacity-50"
        :disabled="busy"
        @click="onDownload"
      >
        {{ busy ? 'A gerar…' : 'Descarregar PDF' }}
      </button>
    </div>
    <p v-if="err" class="mt-2 text-sm text-red-600">{{ err }}</p>
    <p v-if="!hasBody" class="mt-2 text-sm text-amber-800">
      Ainda sem texto com variáveis do cliente. Edite o contrato e escolha um modelo na ficha.
    </p>
    <p v-else class="mt-2 text-xs text-slate-500">
      Pré-visualização abaixo. O PDF é gerado no teu computador, com texto selecionável.
    </p>

    <div
      v-show="hasBody"
      class="mt-4 overflow-x-auto border border-dashed border-slate-200 bg-slate-50/80 p-3"
    >
      <div
        class="contract-pdf-a4 bg-white text-slate-900 shadow-sm"
        style="width: 210mm; min-height: 80mm; padding: 12mm; box-sizing: border-box"
      >
        <header v-if="logoUrl" class="mb-6 flex justify-center">
          <img
            :src="logoUrl"
            alt=""
            class="max-h-24 w-auto object-contain"
            crossorigin="anonymous"
          />
        </header>
        <p class="mb-4 text-center text-xs text-slate-500">
          {{ contractNumber }} · MW Publicidade
        </p>
        <div class="contract-prose" v-html="safeHtml" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.contract-prose :deep(h1) {
  font-size: 1.25rem;
  font-weight: 700;
  margin: 0 0 0.75rem;
  line-height: 1.3;
}
.contract-prose :deep(h2) {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 1rem 0 0.5rem;
}
.contract-prose :deep(h3) {
  font-size: 1rem;
  font-weight: 600;
  margin: 0.75rem 0 0.35rem;
}
.contract-prose :deep(p) {
  margin: 0 0 0.65rem;
  line-height: 1.5;
  font-size: 0.875rem;
}
.contract-prose :deep(ul) {
  margin: 0.35rem 0 0.65rem 1.1rem;
  list-style: disc;
  font-size: 0.875rem;
}
.contract-prose :deep(ol) {
  margin: 0.35rem 0 0.65rem 1.1rem;
  list-style: decimal;
  font-size: 0.875rem;
}
.contract-prose :deep(li) {
  margin: 0.2rem 0;
}
.contract-prose :deep(strong) {
  font-weight: 700;
}
.contract-prose :deep(em) {
  font-style: italic;
}
.contract-prose :deep(a) {
  color: #b08a0b;
  text-decoration: underline;
}
.contract-prose :deep(blockquote) {
  border-left: 3px solid #e2e8f0;
  margin: 0.75rem 0;
  padding-left: 0.75rem;
  color: #475569;
  font-size: 0.875rem;
}
.contract-prose :deep(code) {
  font-family: ui-monospace, monospace;
  font-size: 0.8em;
  background: #f1f5f9;
  padding: 0.1em 0.3em;
  border-radius: 0.25rem;
}
.contract-prose :deep(pre) {
  background: #0f172a0d;
  padding: 0.75rem;
  border-radius: 0.5rem;
  overflow-x: auto;
  font-size: 0.8rem;
  margin: 0.5rem 0 1rem;
}
.contract-prose :deep(table) {
  width: 100%;
  font-size: 0.8rem;
  border-collapse: collapse;
  margin: 0.5rem 0 1rem;
}
.contract-prose :deep(th),
.contract-prose :deep(td) {
  border: 1px solid #e2e8f0;
  padding: 0.35rem 0.5rem;
}
</style>
