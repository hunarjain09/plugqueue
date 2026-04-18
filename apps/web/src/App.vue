<script setup lang="ts">
import { watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useOverlayQueue } from '@/composables/useOverlayQueue';
import { trackPageView, trackError } from '@/composables/useAnalytics';
import PrivacyDisclaimer from '@/components/PrivacyDisclaimer.vue';
import OnboardingTour from '@/components/OnboardingTour.vue';
import InstallPrompt from '@/components/InstallPrompt.vue';
import FeedbackSheet from '@/components/FeedbackSheet.vue';

const route = useRoute();
const { showPrivacy, showTour, showInstall, dismissPrivacy, dismissTour, dismissInstall } = useOverlayQueue();

// Auto-track page views on route change
watch(
  () => route.fullPath,
  () => {
    if (route.name) {
      trackPageView(
        route.name as string,
        route.params.id as string | undefined
      );
    }
  },
  { immediate: true }
);

// Pipe uncaught errors to telemetry (since console.log won't help on iOS Safari)
window.addEventListener('error', (event) => {
  trackError('uncaught_error', route.name as string ?? 'unknown', {
    message: event.message,
    filename: event.filename,
    lineno: event.lineno,
  });
});

window.addEventListener('unhandledrejection', (event) => {
  trackError('unhandled_rejection', route.name as string ?? 'unknown', {
    reason: String(event.reason),
  });
});
</script>

<template>
  <div class="min-h-screen bg-background text-on-surface">
    <RouterView />
    <FeedbackSheet />
    <PrivacyDisclaimer v-if="showPrivacy" @dismissed="dismissPrivacy" />
    <OnboardingTour v-if="showTour" @dismissed="dismissTour" />
    <InstallPrompt v-if="showInstall" @dismissed="dismissInstall" />
  </div>
</template>
