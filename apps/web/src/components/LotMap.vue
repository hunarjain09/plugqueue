<script setup lang="ts">
import { computed, ref } from 'vue';

interface Spot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface StallSvg {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Stall {
  label: string;
  connector: string;
  max_kw: number;
  svg: StallSvg;
}

export interface LotMapData {
  building: { points: [number, number][] };
  spots: Spot[];
  stalls: Stall[];
}

export interface LotPin {
  entryId: string;
  spotId: string;
  position: number;
  status: 'waiting' | 'notified';
  plateDisplay: string;
  isMe: boolean;
  joinedAt: string;
}

const props = defineProps<{
  mode: 'join' | 'live';
  lotMap: LotMapData;
  selectedSpotId?: string | null;
  pins?: LotPin[];
  evStatus?: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: 'select', spotId: string): void;
}>();

interface TooltipState {
  cx: number;
  cy: number;
  pin: LotPin;
}

const tooltip = ref<TooltipState | null>(null);
const activeTooltipSpot = ref<string | null>(null);

const spotsById = computed(() => {
  const m: Record<string, Spot> = {};
  props.lotMap.spots.forEach((s) => { m[s.id] = s; });
  return m;
});

const pinsBySpot = computed(() => {
  const m: Record<string, LotPin> = {};
  props.pins?.forEach((p) => { m[p.spotId] = p; });
  return m;
});

const buildingPath = computed(() =>
  'M ' + props.lotMap.building.points.map(([x, y]) => `${x},${y}`).join(' L ') + ' Z'
);

function getSpotFill(spotId: string): string {
  const pin = pinsBySpot.value[spotId];
  if (props.mode === 'live' && pin) return getPinColor(pin);
  if (props.selectedSpotId === spotId) return 'var(--color-primary, #0ea5e9)';
  return '#4d9e65';
}

function getPinColor(pin: LotPin): string {
  if (pin.status === 'notified') return '#f97316';
  if (pin.isMe) return '#0f172a';
  return '#0ea5e9';
}

function getEvFill(label: string): string {
  const status = props.evStatus?.[label] ?? 'unknown';
  if (status === 'in_use') return '#0e4d6e';
  if (status === 'available') return '#38bdf8';
  return '#5aa8c4';
}

function handleSpotClick(spotId: string) {
  if (props.mode === 'join') {
    emit('select', spotId);
    return;
  }
  const pin = pinsBySpot.value[spotId];
  if (!pin) return;
  if (activeTooltipSpot.value === spotId) {
    tooltip.value = null;
    activeTooltipSpot.value = null;
  } else {
    const s = spotsById.value[spotId];
    tooltip.value = { cx: s.x + s.w / 2, cy: s.y, pin };
    activeTooltipSpot.value = spotId;
  }
}

function handleSpotEnter(spotId: string) {
  if (props.mode !== 'live') return;
  const pin = pinsBySpot.value[spotId];
  if (!pin) return;
  const s = spotsById.value[spotId];
  tooltip.value = { cx: s.x + s.w / 2, cy: s.y, pin };
  activeTooltipSpot.value = spotId;
}

function handleSpotLeave() {
  if (activeTooltipSpot.value) return;
  tooltip.value = null;
}

function dismissTooltip() {
  tooltip.value = null;
  activeTooltipSpot.value = null;
}

function waitedMin(joinedAt: string): number {
  return Math.round((Date.now() - new Date(joinedAt).getTime()) / 60000);
}

const waitingCount = computed(() => props.pins?.length ?? 0);
</script>

<template>
  <div
    class="relative rounded-2xl overflow-hidden bg-[#2d3035] select-none"
    style="aspect-ratio: 4 / 3"
    @mouseleave="tooltip = null; activeTooltipSpot = null"
    @click.self="dismissTooltip"
  >
    <!-- SVG lot map -->
    <svg
      viewBox="0 0 100 100"
      class="absolute inset-0 w-full h-full"
      preserveAspectRatio="none"
    >
      <!-- Building silhouette -->
      <path :d="buildingPath" fill="#e5dccf" stroke="#8b6f4e" stroke-width="0.3" />
      <text
        x="50" y="24"
        text-anchor="middle" dominant-baseline="central"
        font-family="Inter, system-ui, sans-serif" font-size="2.8" font-weight="600"
        fill="#7a6248"
      >TOGO'S Sandwiches</text>
      <text
        x="50" y="29.5"
        text-anchor="middle" dominant-baseline="central"
        font-family="Inter, system-ui, sans-serif" font-size="2" fill="#9a8268" opacity="0.9"
      >7 Leaves Café</text>

      <!-- Crosswalk stripes between ML and MR rows -->
      <rect
        v-for="i in 5" :key="`cw${i}`"
        :x="46 + (i - 1) * 0.9" y="68" width="0.45" height="5.2"
        fill="white" opacity="0.3"
      />

      <!-- Parking spots -->
      <g v-for="spot in lotMap.spots" :key="spot.id">
        <rect
          :x="spot.x" :y="spot.y" :width="spot.w" :height="spot.h"
          rx="0.6"
          :fill="getSpotFill(spot.id)"
          :stroke="selectedSpotId === spot.id ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.2)'"
          :stroke-width="selectedSpotId === spot.id ? '0.4' : '0.15'"
          :opacity="mode === 'live' ? 1 : 1"
          :style="{
            cursor: mode === 'join' ? 'pointer' : (pinsBySpot[spot.id] ? 'pointer' : 'default')
          }"
          @click="handleSpotClick(spot.id)"
          @mouseenter="handleSpotEnter(spot.id)"
          @mouseleave="handleSpotLeave"
        />

        <!-- Spot ID label (no pin) -->
        <text
          v-if="!pinsBySpot[spot.id]"
          :x="spot.x + spot.w / 2" :y="spot.y + spot.h / 2"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, system-ui, sans-serif" font-size="1.7" font-weight="700"
          :fill="selectedSpotId === spot.id ? 'rgba(255,255,255,0.95)' : 'rgba(0,0,0,0.5)'"
          pointer-events="none"
        >{{ spot.id }}</text>

        <!-- Queue position number -->
        <text
          v-if="pinsBySpot[spot.id]"
          :x="spot.x + spot.w / 2" :y="spot.y + spot.h / 2"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, system-ui, sans-serif" font-size="2.6" font-weight="800"
          fill="white" pointer-events="none"
        >#{{ pinsBySpot[spot.id].position }}</text>

        <!-- Pulse ring for notified (up next) -->
        <rect
          v-if="pinsBySpot[spot.id]?.status === 'notified'"
          class="lot-pulse-ring"
          :x="spot.x - 0.6" :y="spot.y - 0.6"
          :width="spot.w + 1.2" :height="spot.h + 1.2"
          rx="1"
          fill="none" stroke="#f97316" stroke-width="0.4"
          pointer-events="none"
        />
      </g>

      <!-- EV stalls -->
      <g v-for="stall in lotMap.stalls" :key="stall.label">
        <rect
          :x="stall.svg.x" :y="stall.svg.y" :width="stall.svg.w" :height="stall.svg.h"
          rx="0.6"
          :fill="getEvFill(stall.label)"
          stroke="rgba(0,0,0,0.2)" stroke-width="0.15"
        />
        <text
          :x="stall.svg.x + stall.svg.w / 2" :y="stall.svg.y + stall.svg.h / 2 - 0.9"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, system-ui, sans-serif" font-size="2" font-weight="700"
          fill="white" opacity="0.95" pointer-events="none"
        >EV</text>
        <text
          :x="stall.svg.x + stall.svg.w / 2" :y="stall.svg.y + stall.svg.h / 2 + 1.5"
          text-anchor="middle" dominant-baseline="central"
          font-family="Inter, system-ui, sans-serif" font-size="1.7" fill="rgba(255,255,255,0.8)"
          pointer-events="none"
        >{{ stall.label }}</text>
      </g>

      <!-- Selection dashed ring (join mode) -->
      <rect
        v-if="mode === 'join' && selectedSpotId && spotsById[selectedSpotId]"
        :x="spotsById[selectedSpotId].x - 0.9"
        :y="spotsById[selectedSpotId].y - 0.9"
        :width="spotsById[selectedSpotId].w + 1.8"
        :height="spotsById[selectedSpotId].h + 1.8"
        rx="1.3"
        fill="none"
        stroke="white" stroke-width="0.45" stroke-dasharray="1.2 0.7"
        pointer-events="none"
      />
    </svg>

    <!-- Count badge (top-left) -->
    <div class="absolute top-2 left-2 bg-black/75 text-white rounded-xl px-2.5 py-1.5 leading-none backdrop-blur-sm">
      <div class="text-base font-black">{{ mode === 'live' ? waitingCount : lotMap.spots.length }}</div>
      <div class="text-[8px] font-medium uppercase tracking-widest opacity-70 mt-0.5">
        {{ mode === 'live' ? 'waiting' : 'spots' }}
      </div>
    </div>

    <!-- Legend (top-right) -->
    <div class="absolute top-2 right-2 bg-white/90 backdrop-blur-sm rounded-xl px-2.5 py-2 space-y-1 shadow-sm">
      <template v-if="mode === 'join'">
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#4d9e65" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">Available</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#0ea5e9" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">Your spot</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#38bdf8" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">EV stall</span>
        </div>
      </template>
      <template v-else>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#f97316" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">Up next</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#0ea5e9" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">Waiting</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#0f172a" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">You</span>
        </div>
        <div class="flex items-center gap-1.5">
          <span class="w-2.5 h-2.5 rounded-sm flex-shrink-0 border border-black/15" style="background:#38bdf8" />
          <span class="text-[9px] font-semibold text-neutral-600 uppercase tracking-wide">EV stall</span>
        </div>
      </template>
    </div>

    <!-- Tooltip (live mode) -->
    <Transition name="lot-fade">
      <div
        v-if="tooltip"
        class="absolute z-20 bg-white border border-black/10 shadow-xl rounded-2xl px-3 py-2.5 pointer-events-none"
        :style="{
          left: `${tooltip.cx}%`,
          top: `${tooltip.cy}%`,
          transform: 'translate(-50%, calc(-100% - 8px))'
        }"
      >
        <div class="text-xl font-black leading-none" :class="tooltip.pin.status === 'notified' ? 'text-orange-500' : 'text-primary'">
          #{{ tooltip.pin.position }}
          <span v-if="tooltip.pin.status === 'notified'" class="text-[10px] font-bold text-orange-500 ml-1 align-middle">UP NEXT</span>
        </div>
        <p class="font-mono text-[11px] text-on-surface-variant mt-1">{{ tooltip.pin.plateDisplay }}</p>
        <div class="flex items-center gap-2 mt-0.5 text-[11px] text-on-surface-variant">
          <span class="font-bold">{{ tooltip.pin.spotId }}</span>
          <span>·</span>
          <span>{{ waitedMin(tooltip.pin.joinedAt) }}m</span>
        </div>
        <!-- Caret -->
        <div class="absolute bottom-[-5px] left-1/2 -translate-x-1/2 w-2.5 h-2.5 bg-white border-r border-b border-black/10 rotate-45" />
      </div>
    </Transition>
  </div>
</template>

<style scoped>
@keyframes lotPulseRing {
  0% {
    opacity: 0.85;
    transform: scale(0.92);
  }
  100% {
    opacity: 0;
    transform: scale(1.35);
  }
}

.lot-pulse-ring {
  transform-box: fill-box;
  transform-origin: center;
  animation: lotPulseRing 1.8s ease-out infinite;
}

.lot-fade-enter-active,
.lot-fade-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}
.lot-fade-enter-from,
.lot-fade-leave-to {
  opacity: 0;
  transform: translate(-50%, calc(-100% - 4px));
}
</style>
