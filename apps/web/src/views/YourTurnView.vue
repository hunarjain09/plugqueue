<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import { useGeofenceWatch } from '@/composables/useGeofenceWatch';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';

const CONFIRM_WINDOW_SEC = 3 * 60;

const route = useRoute();
const router = useRouter();
const store = useStationStore();
const stationId = route.params.id as string;
const confirming = ref(false);
const leaving = ref(false);
const secondsLeft = ref(CONFIRM_WINDOW_SEC);
let countdownTimer: ReturnType<typeof setInterval> | null = null;

// Reactive geofence with actual station coordinates
const sLat = computed(() => store.station?.location?.lat ?? null);
const sLng = computed(() => store.station?.location?.lng ?? null);
const sGeo = computed(() => store.station?.geofence_m ?? 500);
const { autoLeft } = useGeofenceWatch(sLat, sLng, sGeo);

onMounted(async () => {
  await store.fetchStation(stationId);

  // Calculate actual remaining time based on server's notified_at
  // instead of always starting at 3:00
  if (store.station?.queue && store.myEntry) {
    const myQueueEntry = store.station.queue.find(
      (q: any) => q.id === store.myEntry!.entry_id
    );
    if (myQueueEntry?.notified_at) {
      const notifiedAt = new Date(myQueueEntry.notified_at).getTime();
      const elapsed = Math.floor((Date.now() - notifiedAt) / 1000);
      secondsLeft.value = Math.max(0, CONFIRM_WINDOW_SEC - elapsed);
    }
  }

  countdownTimer = setInterval(() => {
    secondsLeft.value = Math.max(0, secondsLeft.value - 1);
    if (secondsLeft.value === 0) {
      if (countdownTimer) clearInterval(countdownTimer);
    }
  }, 1000);
});

onUnmounted(() => {
  if (countdownTimer) clearInterval(countdownTimer);
});

const formattedTime = computed(() => {
  const m = Math.floor(secondsLeft.value / 60);
  const s = secondsLeft.value % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
});

const urgency = computed(() => {
  if (secondsLeft.value <= 30) return 'critical';
  if (secondsLeft.value <= 60) return 'warning';
  return 'normal';
});

async function handleConfirm() {
  confirming.value = true;
  try {
    await store.confirmCharge();
    router.push(`/s/${stationId}`);
  } catch {
    confirming.value = false;
  }
}

async function handleLeave() {
  leaving.value = true;
  try {
    await store.leaveQueue();
    router.push(`/s/${stationId}`);
  } catch {
    leaving.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen pb-32 flex flex-col items-center">
    <TopBar title="PLUGQUEUE" show-back />

    <main class="w-full max-w-md flex-grow flex flex-col px-6 pt-8 pb-32">
      <!-- Auto-left notice -->
      <div v-if="autoLeft" class="bg-error-container/20 p-5 rounded-2xl mb-6 text-center">
        <span class="material-symbols-outlined text-error text-3xl mb-2">location_off</span>
        <p class="text-on-surface font-bold">You left the station area</p>
        <p class="text-on-surface-variant text-sm mt-1">Your queue spot has been released automatically.</p>
        <button
          class="mt-4 text-primary font-semibold text-sm"
          @click="router.push(`/s/${stationId}`)"
        >Back to Station</button>
      </div>

      <!-- Expired notice -->
      <div v-else-if="secondsLeft === 0" class="bg-error-container/20 p-5 rounded-2xl mb-6 text-center">
        <span class="material-symbols-outlined text-error text-3xl mb-2">timer_off</span>
        <p class="text-on-surface font-bold">Time expired</p>
        <p class="text-on-surface-variant text-sm mt-1">Your spot has been given to the next driver.</p>
        <button
          class="mt-4 text-primary font-semibold text-sm"
          @click="router.push(`/s/${stationId}`)"
        >Back to Station</button>
      </div>

      <template v-else>
        <!-- Status Hero Card -->
        <div class="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary-container p-8 mb-6 shadow-xl shadow-primary/20">
          <div class="absolute -top-10 -right-10 w-40 h-40 bg-secondary-container/20 rounded-full blur-3xl"></div>
          <div class="relative z-10">
            <span class="inline-block px-3 py-1 bg-white/20 text-on-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-4 backdrop-blur-md">
              Priority Access
            </span>
            <h2 class="text-on-primary text-5xl font-black tracking-tighter mb-2 leading-tight">
              It's your turn!
            </h2>
            <p class="text-on-primary/90 text-lg font-medium">Your charging stall is ready.</p>
          </div>
        </div>

        <!-- Countdown Timer -->
        <div :class="[
          'rounded-2xl p-6 mb-6 flex items-center justify-between',
          urgency === 'critical' ? 'bg-error/10 border-2 border-error/30' :
          urgency === 'warning' ? 'bg-tertiary-container/10 border-2 border-tertiary-container/30' :
          'bg-surface-container-lowest shadow-sm'
        ]">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">Time to confirm</p>
            <p :class="[
              'text-4xl font-black tracking-tighter font-mono',
              urgency === 'critical' ? 'text-error' :
              urgency === 'warning' ? 'text-tertiary' :
              'text-on-surface'
            ]">
              {{ formattedTime }}
            </p>
          </div>
          <div :class="[
            'w-14 h-14 rounded-full flex items-center justify-center',
            urgency === 'critical' ? 'bg-error/20' :
            urgency === 'warning' ? 'bg-tertiary-container/20' :
            'bg-primary/10'
          ]">
            <span :class="[
              'material-symbols-outlined text-2xl',
              urgency === 'critical' ? 'text-error animate-pulse' :
              urgency === 'warning' ? 'text-tertiary' :
              'text-primary'
            ]">timer</span>
          </div>
        </div>

        <!-- Warning text -->
        <p v-if="urgency !== 'normal'" :class="[
          'text-center text-sm font-medium mb-6 px-4',
          urgency === 'critical' ? 'text-error' : 'text-tertiary'
        ]">
          {{ urgency === 'critical'
            ? 'Confirm now or your spot will be given away!'
            : 'Less than a minute left to confirm.' }}
        </p>

        <!-- Instruction Section -->
        <div class="bg-surface-container-lowest rounded-[2rem] p-8 mb-6 shadow-[0_12px_32px_rgba(0,101,145,0.06)] flex flex-col items-center text-center">
          <div class="w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-6">
            <span class="material-symbols-outlined text-primary text-4xl" style="font-variation-settings: 'FILL' 1;">ev_station</span>
          </div>
          <p class="text-on-surface-variant font-medium mb-1 uppercase tracking-[0.2em] text-xs">Proceed to your stall</p>
          <p class="text-on-surface-variant leading-relaxed px-4 mt-4">
            Plug in and tap <strong>"I'm Plugged In"</strong> below. If you don't confirm within {{ Math.ceil(CONFIRM_WINDOW_SEC / 60) }} minutes, your spot goes to the next driver.
          </p>
        </div>

        <!-- Call to Action -->
        <div class="flex flex-col gap-4">
          <button
            :disabled="confirming"
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            @click="handleConfirm"
          >
            <span v-if="confirming" class="material-symbols-outlined animate-spin">progress_activity</span>
            <template v-else>
              <span class="material-symbols-outlined">ev_station</span>
              I'm Plugged In
            </template>
          </button>
          <button
            :disabled="leaving"
            class="w-full bg-surface-container-low text-on-surface-variant font-semibold py-5 rounded-full active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            @click="handleLeave"
          >
            <span class="material-symbols-outlined">close</span>
            Leave Queue
          </button>
        </div>
      </template>

      <!-- Decorative dots -->
      <div class="mt-8 flex justify-center opacity-20">
        <div class="w-1 h-1 rounded-full bg-primary mx-1"></div>
        <div class="w-1 h-1 rounded-full bg-primary mx-1"></div>
        <div class="w-1 h-1 rounded-full bg-primary mx-1"></div>
      </div>
    </main>

    <BottomNav />
  </div>
</template>
