<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import { useWebSocket } from '@/composables/useWebSocket';
import { useGeofenceWatch } from '@/composables/useGeofenceWatch';
import { getDeviceHash } from '@/lib/api';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const store = useStationStore();
const stationId = route.params.id as string;

const { connected, queue, stalls } = useWebSocket(stationId);

// Reactive station coordinates for geofence
const sLat = computed(() => store.station?.location?.lat ?? null);
const sLng = computed(() => store.station?.location?.lng ?? null);
const sGeo = computed(() => store.station?.geofence_m ?? 500);

const { outsideGeofence, autoLeft } = useGeofenceWatch(sLat, sLng, sGeo);

onMounted(async () => {
  await store.fetchStation(stationId);
});

const myDeviceHash = getDeviceHash();

const myPosition = computed(() => {
  if (!store.myEntry || store.myEntry.station_id !== stationId) return null;
  const idx = queue.value.findIndex((q) => q.id === store.myEntry!.entry_id);
  return idx >= 0 ? idx + 1 : null;
});

const availableCount = computed(() =>
  stalls.value.filter((s) => s.current_status === 'available').length
);

const estimatedWait = computed(() => {
  if (!myPosition.value) return null;
  return myPosition.value * 20;
});

function maskPlate(plate: string) {
  if (plate.length <= 3) return plate;
  return plate.slice(0, -3) + '***';
}

// If the user's own entry transitions to 'notified' (via websocket broadcast),
// send them to YourTurnView so they can confirm. Without this, a user who
// stays on the app never leaves LiveQueueView — the only way to reach
// YourTurnView was tapping the push.
watch(queue, (entries) => {
  const myId = store.myEntry?.entry_id;
  if (!myId || store.myEntry?.station_id !== stationId) return;
  const me = entries.find((e) => e.id === myId);
  if (me?.status === 'notified' && route.name !== 'notify') {
    router.push(`/s/${stationId}/notify`);
  }
}, { deep: true });
</script>

<template>
  <div class="min-h-screen pb-32">
    <TopBar :title="store.station?.name ?? 'Queue'" show-back />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-8">
      <!-- Your Position Hero -->
      <section
        v-if="myPosition"
        class="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2rem] shadow-xl shadow-primary/10"
      >
        <div class="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
        <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-secondary-container/20 rounded-full blur-2xl"></div>
        <div class="relative z-10 space-y-4">
          <div class="flex justify-between items-start">
            <div>
              <span class="text-on-primary/70 text-[10px] font-bold uppercase tracking-[0.2em]">Current Status</span>
              <h2 class="text-on-primary text-3xl font-extrabold tracking-tight mt-1">Charging Queue</h2>
            </div>
            <div class="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
              <span class="material-symbols-outlined text-on-primary" style="font-variation-settings: 'FILL' 1;">bolt</span>
            </div>
          </div>
          <div class="pt-4 flex items-end gap-3">
            <div class="text-on-primary">
              <span class="text-sm font-medium opacity-80">Your Position:</span>
              <div class="text-6xl font-black tracking-tighter leading-none mt-1">#{{ myPosition }}</div>
            </div>
            <div class="pb-1 text-on-primary/80">
              <span class="text-xs font-bold uppercase tracking-wider">Est. Wait: {{ estimatedWait }} min</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Connection status -->
      <div class="flex items-center gap-2 px-1">
        <span :class="['w-2 h-2 rounded-full', connected ? 'bg-green-500' : 'bg-error animate-pulse']"></span>
        <span class="text-[10px] text-on-surface-variant uppercase tracking-widest font-bold">
          {{ connected ? 'Live Updates' : 'Reconnecting...' }}
        </span>
        <span class="ml-auto text-[10px] text-on-surface-variant">
          {{ availableCount }}/{{ stalls.length }} available
        </span>
      </div>

      <!-- Queue List -->
      <section class="space-y-3">
        <div
          v-for="(entry, idx) in queue"
          :key="entry.id"
          :class="[
            'p-5 rounded-[1.5rem] flex items-center justify-between transition-colors',
            store.myEntry?.entry_id === entry.id
              ? 'bg-surface-container-lowest shadow-sm border-2 border-primary-container ring-8 ring-primary-container/5 scale-[1.02]'
              : 'bg-surface-container-low'
          ]"
        >
          <div class="flex items-center gap-4">
            <div :class="[
              'w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm',
              entry.status === 'notified'
                ? 'bg-primary-container text-on-primary'
                : store.myEntry?.entry_id === entry.id
                  ? 'bg-primary-container text-on-primary shadow-lg shadow-primary/20'
                  : 'bg-surface-container-lowest text-on-surface-variant'
            ]">
              <span v-if="entry.status === 'notified'" class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">ev_station</span>
              <span v-else class="font-black text-lg">{{ idx + 1 }}</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <p class="text-on-surface font-bold text-sm">
                  {{ store.myEntry?.entry_id === entry.id ? 'You' : `Driver ${idx + 1}` }}
                </p>
                <span
                  v-if="entry.status === 'notified'"
                  class="w-1.5 h-1.5 rounded-full bg-green-500"
                ></span>
              </div>
              <p class="text-on-surface-variant text-[11px] font-medium tracking-wide">
                PLATE: {{ maskPlate(entry.plate) }}
              </p>
            </div>
          </div>
          <div class="flex flex-col items-end gap-2">
            <div v-if="entry.spot_id" class="flex items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-xl shadow-sm">
              <span class="material-symbols-outlined text-xs text-on-surface-variant">map</span>
              <span class="text-on-surface-variant font-black text-xs">{{ entry.spot_id }}</span>
            </div>
            <span :class="[
              'text-[10px] font-bold uppercase tracking-tighter',
              entry.status === 'notified' ? 'text-primary' : 'text-on-surface-variant/40'
            ]">
              {{ entry.status === 'notified' ? 'Notified' : 'Waiting' }}
            </span>
          </div>
        </div>

        <div v-if="queue.length === 0" class="text-center py-12">
          <span class="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">hourglass_empty</span>
          <p class="text-on-surface-variant">Queue is empty</p>
          <p class="text-on-surface-variant/60 text-xs mt-1">Be the first to join!</p>
        </div>
      </section>

      <!-- Actions -->
      <div v-if="!myPosition" class="pt-4">
        <button
          class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
          @click="router.push(`/s/${stationId}/join`)"
        >
          <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">add_circle</span>
          <span class="tracking-widest uppercase text-sm">Join Queue</span>
        </button>
      </div>

      <div v-else class="pt-4">
        <button
          class="w-full bg-surface-container-low text-on-surface-variant font-semibold py-4 rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all"
          @click="store.leaveQueue().then(() => router.push(`/s/${stationId}`))"
        >
          <span class="material-symbols-outlined">close</span>
          Leave Queue
        </button>
      </div>
    </main>

    <BottomNav />
  </div>
</template>
