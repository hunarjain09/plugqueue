import { ref, computed } from 'vue';

/**
 * Controls the display order of overlays: privacy → tour → install.
 * Only one overlay is visible at a time.
 */
const privacyDismissed = ref(localStorage.getItem('pq_privacy_accepted') === 'true');
const tourDismissed = ref(localStorage.getItem('pq_tour_done') === 'true');
const installDismissed = ref(false); // managed by InstallPrompt internally

export function useOverlayQueue() {
  const showPrivacy = computed(() => !privacyDismissed.value);
  const showTour = computed(() => privacyDismissed.value && !tourDismissed.value);
  const showInstall = computed(() => privacyDismissed.value && tourDismissed.value && !installDismissed.value);

  function dismissPrivacy() {
    privacyDismissed.value = true;
  }

  function dismissTour() {
    tourDismissed.value = true;
  }

  function dismissInstall() {
    installDismissed.value = true;
  }

  return { showPrivacy, showTour, showInstall, dismissPrivacy, dismissTour, dismissInstall };
}
