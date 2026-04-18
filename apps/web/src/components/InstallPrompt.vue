<script setup lang="ts">
import { ref, onMounted } from 'vue';

const emit = defineEmits<{ (e: 'dismissed'): void }>();

const show = ref(false);
const isIOS = ref(false);
const isAndroid = ref(false);
const deferredPrompt = ref<any>(null);

onMounted(() => {
  // Don't show if already installed (standalone mode)
  if (window.matchMedia('(display-mode: standalone)').matches) return;
  // Don't show if dismissed recently
  const dismissed = localStorage.getItem('pq_install_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed) < 7 * 24 * 60 * 60 * 1000) return;

  const ua = navigator.userAgent;
  isIOS.value = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  isAndroid.value = /Android/.test(ua);

  // Android: intercept beforeinstallprompt
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt.value = e;
    show.value = true;
  });

  // iOS: always show manual instructions
  if (isIOS.value) {
    show.value = true;
  }
});

async function installAndroid() {
  if (!deferredPrompt.value) return;
  deferredPrompt.value.prompt();
  const result = await deferredPrompt.value.userChoice;
  if (result.outcome === 'accepted') {
    show.value = false;
  }
  deferredPrompt.value = null;
}

function dismiss() {
  show.value = false;
  localStorage.setItem('pq_install_dismissed', Date.now().toString());
  emit('dismissed');
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-500 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm"
      @click.self="dismiss"
    >
      <div class="w-full max-w-md bg-surface-container-lowest rounded-t-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] overflow-hidden">
        <!-- Header gradient -->
        <div class="relative bg-gradient-to-br from-primary to-primary-container p-8 pb-12 overflow-hidden">
          <div class="absolute -top-16 -right-16 w-56 h-56 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-10 -left-10 w-40 h-40 bg-secondary-container/20 rounded-full blur-2xl"></div>

          <button
            class="absolute top-4 right-4 p-2 rounded-full bg-white/20 text-on-primary/80 hover:bg-white/30 active:scale-90 transition-all"
            @click="dismiss"
          >
            <span class="material-symbols-outlined text-sm">close</span>
          </button>

          <div class="relative z-10">
            <div class="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center mb-5">
              <span class="material-symbols-outlined text-on-primary text-3xl" style="font-variation-settings: 'FILL' 1;">bolt</span>
            </div>
            <h2 class="text-on-primary text-3xl font-black tracking-tight leading-tight">
              Add PlugQueue<br/>to Home Screen
            </h2>
            <p class="text-on-primary/80 text-sm mt-2 leading-relaxed">
              Get instant push notifications when your charging stall is ready.
            </p>
          </div>
        </div>

        <!-- Benefits -->
        <div class="px-8 -mt-4 relative z-10">
          <div class="bg-surface-container-lowest rounded-2xl shadow-lg p-5 space-y-4">
            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary text-lg">notifications_active</span>
              </div>
              <div>
                <p class="text-on-surface font-bold text-sm">Real-time Notifications</p>
                <p class="text-on-surface-variant text-xs leading-relaxed mt-0.5">
                  Get alerted the instant a stall opens — even if the app is closed.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary text-lg">speed</span>
              </div>
              <div>
                <p class="text-on-surface font-bold text-sm">Instant Launch</p>
                <p class="text-on-surface-variant text-xs leading-relaxed mt-0.5">
                  Opens full-screen like a native app — no browser chrome.
                </p>
              </div>
            </div>

            <div class="flex items-start gap-4">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <span class="material-symbols-outlined text-primary text-lg">wifi_off</span>
              </div>
              <div>
                <p class="text-on-surface font-bold text-sm">Works Offline</p>
                <p class="text-on-surface-variant text-xs leading-relaxed mt-0.5">
                  View your queue position even with spotty signal at the station.
                </p>
              </div>
            </div>
          </div>
        </div>

        <!-- Install Instructions -->
        <div class="px-8 pt-6 pb-10 space-y-4">
          <!-- Android: one-tap install -->
          <template v-if="isAndroid && deferredPrompt">
            <button
              class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
              @click="installAndroid"
            >
              <span class="material-symbols-outlined">install_mobile</span>
              <span class="tracking-widest uppercase text-sm">Install App</span>
            </button>
          </template>

          <!-- iOS: manual instructions -->
          <template v-else-if="isIOS">
            <div class="bg-surface-container rounded-2xl p-5 space-y-4">
              <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">How to install</p>

              <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-sm font-black shrink-0">1</div>
                <p class="text-on-surface text-sm">
                  Tap the <span class="inline-flex items-center align-middle mx-0.5 px-1.5 py-0.5 bg-surface-container-high rounded-lg">
                    <span class="material-symbols-outlined text-primary text-sm">ios_share</span>
                  </span> Share button in Safari
                </p>
              </div>

              <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-sm font-black shrink-0">2</div>
                <p class="text-on-surface text-sm">
                  Scroll down and tap <span class="font-bold">"Add to Home Screen"</span>
                </p>
              </div>

              <div class="flex items-center gap-4">
                <div class="w-8 h-8 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-sm font-black shrink-0">3</div>
                <p class="text-on-surface text-sm">
                  Tap <span class="font-bold">"Add"</span> to confirm
                </p>
              </div>
            </div>

            <p class="text-[10px] text-on-surface-variant text-center leading-relaxed px-4">
              Push notifications on iOS require the app to be installed to your Home Screen.
            </p>
          </template>

          <!-- Fallback: generic instructions -->
          <template v-else>
            <div class="bg-surface-container rounded-2xl p-5 space-y-3">
              <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">How to install</p>
              <p class="text-on-surface text-sm leading-relaxed">
                Look for the <span class="font-bold">install</span> icon
                <span class="material-symbols-outlined text-sm align-middle text-primary">install_desktop</span>
                in your browser's address bar, or open your browser menu and select
                <span class="font-bold">"Install PlugQueue"</span>.
              </p>
            </div>
          </template>

          <button
            class="w-full text-on-surface-variant font-medium py-3 text-sm active:scale-95 transition-all"
            @click="dismiss"
          >
            Maybe Later
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
