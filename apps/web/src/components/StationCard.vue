<script setup lang="ts">
defineProps<{
  station: {
    id: string;
    name: string;
    provider: string;
    address: string;
    available_stalls: number;
    total_stalls: number;
    queue_size: number;
    distance_m: number;
  };
}>();

function formatDistance(m: number): string {
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}
</script>

<template>
  <router-link
    :to="`/s/${station.id}`"
    class="block bg-surface-container-lowest p-5 rounded-2xl shadow-[0_12px_32px_rgba(0,101,145,0.06)] hover:shadow-lg transition-all active:scale-[0.98]"
  >
    <div class="flex justify-between items-start mb-4">
      <div>
        <h3 class="text-on-surface font-bold text-base tracking-tight">{{ station.name }}</h3>
        <p class="text-on-surface-variant text-xs flex items-center gap-1 mt-0.5">
          <span class="material-symbols-outlined text-xs">location_on</span>
          {{ station.address }}
        </p>
      </div>
      <div class="bg-surface-container-high px-3 py-2 rounded-xl flex flex-col items-center">
        <span class="text-[10px] text-on-surface-variant font-bold uppercase">Wait</span>
        <span class="text-lg font-black text-primary">
          {{ station.queue_size > 0 ? `~${station.queue_size * 20}` : '0' }}
          <span class="text-xs font-medium">m</span>
        </span>
      </div>
    </div>

    <div class="flex gap-3">
      <div class="glass-card px-3 py-2 rounded-xl flex items-center gap-2">
        <span class="material-symbols-outlined text-sm text-primary">ev_station</span>
        <span class="text-xs font-bold text-on-surface">
          {{ station.available_stalls }}/{{ station.total_stalls }}
          <span class="text-on-surface-variant font-normal">free</span>
        </span>
      </div>
      <div class="glass-card px-3 py-2 rounded-xl flex items-center gap-2">
        <span class="material-symbols-outlined text-sm text-primary">group</span>
        <span class="text-xs font-bold text-on-surface">
          {{ station.queue_size }}
          <span class="text-on-surface-variant font-normal">in queue</span>
        </span>
      </div>
      <div class="glass-card px-3 py-2 rounded-xl flex items-center gap-2 ml-auto">
        <span class="material-symbols-outlined text-sm text-on-surface-variant">navigation</span>
        <span class="text-xs font-bold text-on-surface-variant">{{ formatDistance(station.distance_m) }}</span>
      </div>
    </div>
  </router-link>
</template>
