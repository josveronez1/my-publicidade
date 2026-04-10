<script setup lang="ts">
import { RouterView } from 'vue-router'
</script>

<template>
  <div class="flex h-full min-h-0 flex-col">
    <RouterView v-slot="{ Component }">
      <component :is="Component" class="min-h-0 flex-1" />
    </RouterView>
  </div>
</template>
