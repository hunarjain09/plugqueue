<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';

const emit = defineEmits<{
  (e: 'verified', token: string): void;
  (e: 'error'): void;
}>();

const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const containerRef = ref<HTMLDivElement | null>(null);
let widgetId: string | null = null;

onMounted(() => {
  if (!siteKey || !containerRef.value) return;

  // Load Turnstile script if not already loaded
  if (!(window as any).turnstile) {
    const script = document.createElement('script');
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
    script.async = true;
    script.onload = renderWidget;
    document.head.appendChild(script);
  } else {
    renderWidget();
  }
});

function renderWidget() {
  if (!containerRef.value || !(window as any).turnstile) return;

  widgetId = (window as any).turnstile.render(containerRef.value, {
    sitekey: siteKey,
    theme: 'light',
    callback: (token: string) => emit('verified', token),
    'error-callback': () => emit('error'),
  });
}

onUnmounted(() => {
  if (widgetId && (window as any).turnstile) {
    (window as any).turnstile.remove(widgetId);
  }
});
</script>

<template>
  <div v-if="siteKey" ref="containerRef" class="flex justify-center my-4"></div>
</template>
