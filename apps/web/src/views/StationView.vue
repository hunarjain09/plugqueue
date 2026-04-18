<script setup lang="ts">
import { onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const store = useStationStore();

const stationId = route.params.id as string;

onMounted(() => {
  store.fetchStation(stationId);
});

const s = computed(() => store.station);
const stallsByStatus = computed(() => {
  if (!s.value?.stalls) return { available: 0, in_use: 0, offline: 0, total: 0 };
  const stalls = s.value.stalls;
  return {
    available: stalls.filter((st: any) => st.current_status === 'available').length,
    in_use: stalls.filter((st: any) => st.current_status === 'in_use').length,
    offline: stalls.filter((st: any) => st.current_status === 'offline').length,
    total: stalls.length,
  };
});
</script>

<template>
  <div class="min-h-screen pb-32">
    <TopBar :title="s?.name ?? 'Station'" show-back />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-8">
      <!-- Loading -->
      <div v-if="store.loading" class="space-y-6">
        <div class="bg-surface-container-low rounded-[2rem] p-8 animate-pulse">
          <div class="h-6 bg-surface-container-high rounded w-3/4 mb-4"></div>
          <div class="h-4 bg-surface-container-high rounded w-1/2"></div>
        </div>
      </div>

      <template v-else-if="s">
        <!-- Hero Card -->
        <section class="relative overflow-hidden bg-gradient-to-br from-primary to-primary-container p-8 rounded-[2rem] shadow-xl shadow-primary/10">
          <div class="absolute -top-12 -right-12 w-48 h-48 bg-white/10 rounded-full blur-3xl"></div>
          <div class="absolute -bottom-8 -left-8 w-32 h-32 bg-secondary-container/20 rounded-full blur-2xl"></div>
          <div class="relative z-10 space-y-4">
            <div class="flex justify-between items-start">
              <div>
                <span class="text-on-primary/70 text-[10px] font-bold uppercase tracking-[0.2em]">{{ s.provider }}</span>
                <h2 class="text-on-primary text-2xl font-extrabold tracking-tight mt-1">{{ s.name }}</h2>
                <p class="text-on-primary/80 text-xs flex items-center gap-1 mt-1">
                  <span class="material-symbols-outlined text-xs">location_on</span>
                  {{ s.address }}
                </p>
              </div>
              <div class="bg-white/20 backdrop-blur-md p-3 rounded-2xl">
                <span class="material-symbols-outlined text-on-primary" style="font-variation-settings: 'FILL' 1;">ev_station</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Stall Status Grid -->
        <section class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Stall Status</h3>
          <div class="grid grid-cols-2 gap-4">
            <div class="glass-card p-4 rounded-2xl">
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Available</p>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
                <span class="text-lg font-black text-on-surface">{{ stallsByStatus.available }}</span>
              </div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">In Use</p>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-tertiary">hourglass_empty</span>
                <span class="text-lg font-black text-on-surface">{{ stallsByStatus.in_use }}</span>
              </div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Queue</p>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-secondary">group</span>
                <span class="text-lg font-black text-on-surface">{{ s.queue_size }} <span class="text-xs font-normal text-on-surface-variant">cars</span></span>
              </div>
            </div>
            <div class="glass-card p-4 rounded-2xl">
              <p class="text-[10px] font-bold text-on-surface-variant uppercase tracking-widest mb-1">Est. Wait</p>
              <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-primary">schedule</span>
                <span class="text-lg font-black text-on-surface">
                  {{ s.estimated_wait_min ?? 0 }}
                  <span class="text-xs font-normal text-on-surface-variant">min</span>
                </span>
              </div>
            </div>
          </div>
        </section>

        <!-- Individual Stalls -->
        <section class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">All Stalls</h3>
          <div class="grid grid-cols-1 gap-3">
            <div
              v-for="stall in s.stalls"
              :key="stall.id"
              :class="[
                'p-4 rounded-xl flex items-center justify-between',
                stall.current_status === 'available'
                  ? 'bg-surface-container-lowest border-l-4 border-l-primary shadow-sm'
                  : 'bg-surface-container-low border-l-4 border-l-outline-variant/30'
              ]"
            >
              <div class="flex items-center gap-4">
                <div :class="[
                  'w-10 h-10 rounded-lg flex items-center justify-center font-bold',
                  stall.current_status === 'available' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
                ]">
                  {{ stall.label }}
                </div>
                <div>
                  <p class="text-sm font-semibold text-on-surface">{{ stall.connector_type }} &middot; {{ stall.max_kw }}kW</p>
                  <p :class="[
                    'text-xs font-medium capitalize',
                    stall.current_status === 'available' ? 'text-primary' : 'text-on-surface-variant'
                  ]">
                    {{ stall.current_status.replace('_', ' ') }}
                  </p>
                </div>
              </div>
              <span
                v-if="stall.current_status === 'available'"
                class="material-symbols-outlined text-primary"
                style="font-variation-settings: 'FILL' 1;"
              >check_circle</span>
              <span v-else class="material-symbols-outlined text-on-surface-variant/40">hourglass_empty</span>
            </div>
          </div>
        </section>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-4 pt-4">
          <button
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all hover:brightness-110"
            @click="router.push(`/s/${stationId}/join`)"
          >
            <span class="material-symbols-outlined" style="font-variation-settings: 'FILL' 1;">add_circle</span>
            <span class="tracking-widest uppercase text-sm">Join Queue</span>
          </button>
          <button
            class="w-full bg-surface-container-low text-on-surface-variant font-semibold py-4 rounded-full flex items-center justify-center gap-3 active:scale-95 transition-all"
            @click="router.push(`/s/${stationId}/update`)"
          >
            <span class="material-symbols-outlined">photo_camera</span>
            Update Status
          </button>
          <button
            class="w-full text-primary font-semibold py-3 rounded-full flex items-center justify-center gap-2 active:scale-95 transition-all"
            @click="router.push(`/s/${stationId}/queue`)"
          >
            <span class="material-symbols-outlined text-sm">visibility</span>
            View Live Queue
          </button>
        </div>
      </template>

      <!-- Error -->
      <div v-if="store.error" class="text-center py-12">
        <span class="material-symbols-outlined text-5xl text-error/30 mb-4">error</span>
        <p class="text-error">{{ store.error }}</p>
      </div>
    </main>

    <BottomNav />
  </div>
</template>
