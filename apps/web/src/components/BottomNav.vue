<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStationStore } from '@/stores/station';

const route = useRoute();
const store = useStationStore();

// Get station ID from current route or from store (last viewed)
const stationId = computed(() =>
  (route.params.id as string) ?? store.station?.id ?? store.myEntry?.station_id
);

const tabs = computed(() => [
  { name: 'discover', icon: 'map', label: 'Explore', path: '/discover' },
  {
    name: 'queue',
    icon: 'hourglass_empty',
    label: 'Queue',
    path: stationId.value ? `/s/${stationId.value}/queue` : null,
  },
  {
    name: 'update-status',
    icon: 'ev_station',
    label: 'Update',
    path: stationId.value ? `/s/${stationId.value}/update` : null,
  },
]);

function isActive(name: string) {
  return route.name === name;
}
</script>

<template>
  <nav class="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface-container-lowest/80 backdrop-blur-xl border-t border-outline-variant/20 rounded-t-3xl z-50 flex justify-around items-center px-8 pb-8 pt-4 shadow-[0_-12px_32px_rgba(0,101,145,0.06)]">
    <template v-for="tab in tabs" :key="tab.name">
      <router-link
        v-if="tab.path"
        :to="tab.path"
        :class="[
          'flex flex-col items-center justify-center px-6 py-2 active:scale-90 transition-all duration-200',
          isActive(tab.name)
            ? 'bg-primary-container text-on-primary rounded-full'
            : 'text-on-surface-variant hover:text-primary'
        ]"
      >
        <span class="material-symbols-outlined text-lg">{{ tab.icon }}</span>
        <span class="text-[11px] font-bold uppercase tracking-widest mt-0.5">{{ tab.label }}</span>
      </router-link>
      <!-- Disabled tab when no station context -->
      <div
        v-else
        class="flex flex-col items-center justify-center px-6 py-2 text-on-surface-variant/30 cursor-not-allowed"
      >
        <span class="material-symbols-outlined text-lg">{{ tab.icon }}</span>
        <span class="text-[11px] font-bold uppercase tracking-widest mt-0.5">{{ tab.label }}</span>
      </div>
    </template>
  </nav>
</template>
