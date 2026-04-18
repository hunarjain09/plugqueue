<script setup lang="ts">
import { useRouter } from 'vue-router';

defineProps<{
  title?: string;
  showBack?: boolean;
}>();

const router = useRouter();
</script>

<template>
  <header class="bg-surface-container-lowest/80 backdrop-blur-xl shadow-sm sticky top-0 w-full z-50">
    <div class="flex items-center justify-between px-6 h-16 w-full max-w-md mx-auto">
      <div class="flex items-center gap-4">
        <button
          v-if="showBack"
          class="text-primary active:scale-95 transition-transform"
          @click="router.back()"
        >
          <span class="material-symbols-outlined">arrow_back</span>
        </button>
        <h1 class="font-sans tracking-tight text-on-surface font-semibold text-lg">
          {{ title ?? 'PLUGQUEUE' }}
        </h1>
      </div>
      <div class="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
        <span class="material-symbols-outlined text-sm text-on-surface-variant">notifications</span>
      </div>
    </div>
  </header>
</template>
