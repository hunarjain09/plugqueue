<script setup lang="ts">
import { onMounted, ref, computed } from 'vue';
import { useStationStore } from '@/stores/station';
import { useGeolocation } from '@/composables/useGeolocation';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';
import StationCard from '@/components/StationCard.vue';

const store = useStationStore();
const geo = useGeolocation();
const locationReady = ref(false);
const searchQuery = ref('');

// Single-station MVP: ea-7leaves is always shown regardless of location or
// API response. We merge it with whatever fetchNearby returns so we don't
// show duplicates if the API already returned it.
const EA7LEAVES_STUB = {
  id: 'ea-7leaves',
  name: 'Electrify America — 7 Leaves Cafe',
  provider: 'Electrify America',
  address: '540-548 Lawrence Expy, Sunnyvale, CA 94085',
  location: { lat: 37.3884, lng: -121.9915 },
};

const visibleStations = computed(() => {
  const apiStations = store.nearbyStations;
  const hasEa7leaves = apiStations.some((s) => s.id === 'ea-7leaves');
  const base = hasEa7leaves ? apiStations : [EA7LEAVES_STUB, ...apiStations];
  if (!searchQuery.value.trim()) return base;
  const q = searchQuery.value.toLowerCase();
  return base.filter(
    (s) =>
      s.name.toLowerCase().includes(q) ||
      s.provider.toLowerCase().includes(q) ||
      (s.address ?? '').toLowerCase().includes(q)
  );
});

onMounted(async () => {
  locationReady.value = true;
  try {
    const pos = await geo.getCurrentPosition();
    await store.fetchNearby(pos.lat, pos.lng);
  } catch {
    await store.fetchNearby(37.3884, -121.9915);
  }
});
</script>

<template>
  <div class="min-h-screen pb-32">
    <TopBar title="PLUGQUEUE" />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-8">
      <!-- Hero search (disabled — MVP ships with one station) -->
      <section class="space-y-4 opacity-50 pointer-events-none select-none" aria-disabled="true">
        <div class="flex items-start justify-between gap-3">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-on-surface">Find a Charger</h2>
            <p class="text-on-surface-variant text-sm mt-1">Nearby stations with live queue data</p>
          </div>
          <span class="shrink-0 mt-1 bg-surface-container-high text-on-surface-variant px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">
            Coming soon
          </span>
        </div>
        <div class="relative">
          <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm">search</span>
          <input
            type="text"
            placeholder="Search charging hubs..."
            disabled
            tabindex="-1"
            class="w-full bg-surface-container-high border-none rounded-full pl-11 pr-4 py-3.5 text-sm placeholder:text-outline/50 cursor-not-allowed"
          />
        </div>
      </section>

      <!-- Location status -->
      <section v-if="geo.loading.value" class="flex items-center gap-3 text-on-surface-variant text-sm">
        <span class="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        Getting your location...
      </section>

      <section v-if="geo.error.value" class="glass-card p-4 rounded-2xl flex items-center gap-3">
        <span class="material-symbols-outlined text-error">location_off</span>
        <div>
          <p class="text-sm font-medium text-on-surface">Location unavailable</p>
          <p class="text-xs text-on-surface-variant">Showing default area stations</p>
        </div>
      </section>

      <!-- Station list -->
      <section class="space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Nearby Stations</h3>
          <span
            v-if="store.nearbyStations.length > 0"
            class="bg-secondary-container/30 text-on-secondary-container px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest"
          >
            {{ store.nearbyStations.length }} found
          </span>
        </div>

        <!-- Loading -->
        <div v-if="store.loading" class="space-y-4">
          <div v-for="i in 3" :key="i" class="bg-surface-container-low rounded-2xl p-5 animate-pulse">
            <div class="h-4 bg-surface-container-high rounded w-2/3 mb-3"></div>
            <div class="h-3 bg-surface-container-high rounded w-1/2"></div>
          </div>
        </div>

        <!-- Stations -->
        <div v-else class="space-y-4">
          <StationCard
            v-for="s in visibleStations"
            :key="s.id"
            :station="s"
          />

          <div v-if="visibleStations.length === 0 && !store.loading" class="text-center py-12">
            <span class="material-symbols-outlined text-5xl text-on-surface-variant/30 mb-4">ev_station</span>
            <p class="text-on-surface-variant">No stations found nearby</p>
          </div>
        </div>
      </section>
    </main>

    <BottomNav />
  </div>
</template>
