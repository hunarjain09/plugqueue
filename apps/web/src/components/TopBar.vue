<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { usePush } from '@/composables/usePush';
import { trackFeatureUse, trackError } from '@/composables/useAnalytics';

defineProps<{
  title?: string;
  showBack?: boolean;
}>();

const router = useRouter();
const push = usePush();
const busy = ref(false);

onMounted(async () => {
  // Reflect an existing subscription (PWA reopened after a previous subscribe)
  if ('serviceWorker' in navigator && 'PushManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const existing = await reg.pushManager.getSubscription();
      if (existing) push.subscribed.value = true;
    } catch {}
  }
});

async function toggleNotifications() {
  if (busy.value || push.subscribed.value) return;
  busy.value = true;
  const t0 = performance.now();
  try {
    const id = await push.subscribe();
    if (id) {
      trackFeatureUse('push_subscribe', undefined, { ms: Math.round(performance.now() - t0) });
    } else {
      trackError('push_subscribe_denied', 'topbar', { permission: push.permission.value });
    }
  } catch (e: any) {
    trackError('push_subscribe_failed', 'topbar', { message: String(e?.message ?? e) });
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <header
    class="bg-surface-container-lowest/80 backdrop-blur-xl shadow-sm sticky top-0 w-full z-50"
    style="padding-top: env(safe-area-inset-top);"
  >
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
      <button
        type="button"
        :aria-label="
          push.subscribed.value
            ? 'Notifications enabled'
            : push.permission.value === 'denied'
            ? 'Notifications blocked — enable in Settings'
            : 'Enable notifications'
        "
        :disabled="busy || push.permission.value === 'denied' || push.subscribed.value"
        class="relative w-8 h-8 rounded-full bg-surface-container flex items-center justify-center active:scale-95 transition-transform disabled:active:scale-100"
        @click="toggleNotifications"
      >
        <span
          class="material-symbols-outlined text-sm"
          :class="
            push.subscribed.value
              ? 'text-primary'
              : push.permission.value === 'denied'
              ? 'text-error'
              : 'text-on-surface-variant'
          "
        >{{
          push.permission.value === 'denied'
            ? 'notifications_off'
            : push.subscribed.value
            ? 'notifications_active'
            : 'notifications'
        }}</span>
        <!-- CTA jewel: red dot with "1" until the user subscribes -->
        <span
          v-if="!push.subscribed.value && push.permission.value !== 'denied'"
          aria-hidden="true"
          class="absolute -top-0.5 -right-0.5 min-w-[16px] h-[16px] px-[3px] rounded-full bg-error text-white text-[10px] font-bold leading-none flex items-center justify-center ring-2 ring-surface-container-lowest animate-pulse"
        >1</span>
      </button>
    </div>
  </header>
</template>
