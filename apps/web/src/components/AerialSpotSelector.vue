<script setup lang="ts">
import { ref, onMounted } from 'vue';

const props = defineProps<{
  stationId: string;
  stalls: Array<{ label: string; current_status: string }>;
  selectedSpot: string | null;
}>();

const emit = defineEmits<{
  (e: 'select', label: string): void;
}>();

interface LotMapStall {
  label: string;
  connector: string;
  max_kw: number;
  x_pct: number;
  y_pct: number;
  width_pct: number;
  height_pct: number;
}

interface LotMap {
  aerial_image: string;
  stalls: LotMapStall[];
}

const lotMap = ref<LotMap | null>(null);
const loading = ref(true);

onMounted(async () => {
  try {
    const res = await fetch(`/stations/${props.stationId}.json`);
    if (res.ok) {
      lotMap.value = await res.json();
    }
  } catch {}
  loading.value = false;
});

function getStallStatus(label: string): string {
  return props.stalls.find((s) => s.label === label)?.current_status ?? 'unknown';
}

function isOccupied(label: string): boolean {
  const status = getStallStatus(label);
  return status === 'in_use';
}
</script>

<template>
  <div v-if="lotMap" class="relative rounded-2xl overflow-hidden shadow-xl">
    <!-- Aerial photo -->
    <img
      :src="lotMap.aerial_image"
      alt="Parking lot aerial view"
      class="w-full h-auto"
    />

    <!-- Darkened overlay -->
    <div class="absolute inset-0 bg-black/20"></div>

    <!-- Stall hotspots -->
    <button
      v-for="stall in lotMap.stalls"
      :key="stall.label"
      :disabled="isOccupied(stall.label)"
      :style="{
        position: 'absolute',
        left: `${stall.x_pct}%`,
        top: `${stall.y_pct}%`,
        width: `${stall.width_pct}%`,
        height: `${stall.height_pct}%`,
      }"
      :class="[
        'flex flex-col items-center justify-center rounded-lg transition-all duration-200',
        selectedSpot === stall.label
          ? 'bg-primary-container/90 border-2 border-white shadow-lg shadow-primary/40 scale-110 z-10'
          : isOccupied(stall.label)
            ? 'bg-black/40 cursor-not-allowed'
            : 'bg-white/20 backdrop-blur-sm border border-white/40 hover:bg-primary-container/70 hover:scale-105 active:scale-95'
      ]"
      @click="emit('select', stall.label)"
    >
      <span :class="[
        'text-xs font-black',
        selectedSpot === stall.label ? 'text-white' : isOccupied(stall.label) ? 'text-white/50' : 'text-white'
      ]">{{ stall.label }}</span>

      <span
        v-if="selectedSpot === stall.label"
        class="material-symbols-outlined text-white text-sm"
        style="font-variation-settings: 'FILL' 1;"
      >check_circle</span>
      <span
        v-else-if="isOccupied(stall.label)"
        class="material-symbols-outlined text-white/50 text-sm"
      >block</span>
      <span
        v-else
        class="material-symbols-outlined text-white/80 text-sm"
      >ev_station</span>
    </button>

    <!-- Legend overlay -->
    <div class="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-md p-2.5 rounded-xl flex justify-center gap-4">
      <div class="flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-primary-container"></div>
        <span class="text-[9px] font-bold text-white/80 uppercase tracking-wider">Selected</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-white/40 border border-white/60"></div>
        <span class="text-[9px] font-bold text-white/80 uppercase tracking-wider">Available</span>
      </div>
      <div class="flex items-center gap-1.5">
        <div class="w-2.5 h-2.5 rounded-full bg-white/20"></div>
        <span class="text-[9px] font-bold text-white/80 uppercase tracking-wider">Occupied</span>
      </div>
    </div>
  </div>

  <!-- Fallback: plain grid if lot map not available -->
  <div v-else-if="!loading" class="text-center py-8 text-on-surface-variant text-sm">
    <span class="material-symbols-outlined text-3xl mb-2">map</span>
    <p>Lot map unavailable</p>
  </div>

  <!-- Loading -->
  <div v-else class="aspect-[4/3] bg-surface-container-low rounded-2xl animate-pulse"></div>
</template>
