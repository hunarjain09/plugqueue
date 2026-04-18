<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import TopBar from '@/components/TopBar.vue';

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
const loading = ref(true);
const data = ref<any>(null);
const dropoffs = ref<any[]>([]);
const days = ref(7);

async function fetchStats() {
  loading.value = true;
  try {
    const [statsRes, dropoffRes] = await Promise.all([
      fetch(`${BASE_URL}/api/telemetry/stats/daily?days=${days.value}`),
      fetch(`${BASE_URL}/api/telemetry/stats/dropoffs?days=${days.value}`),
    ]);
    const statsJson = await statsRes.json();
    const dropoffJson = await dropoffRes.json();
    if (statsJson.ok) data.value = statsJson.data;
    if (dropoffJson.ok) dropoffs.value = dropoffJson.data;
  } catch {}
  loading.value = false;
}

onMounted(fetchStats);

// Derived metrics
const totalUsers = computed(() =>
  data.value?.overview?.reduce((sum: number, d: any) => sum + parseInt(d.unique_devices), 0) ?? 0
);
const totalSessions = computed(() =>
  data.value?.overview?.reduce((sum: number, d: any) => sum + parseInt(d.unique_sessions), 0) ?? 0
);
const totalEvents = computed(() =>
  data.value?.overview?.reduce((sum: number, d: any) => sum + parseInt(d.total_events), 0) ?? 0
);
const totalErrors = computed(() =>
  data.value?.overview?.reduce((sum: number, d: any) => sum + parseInt(d.errors), 0) ?? 0
);
const avgRating = computed(() => {
  const fb = data.value?.feedback;
  if (!fb || fb.length === 0) return null;
  const total = fb.reduce((sum: number, f: any) => sum + (parseFloat(f.avg_rating) || 0) * parseInt(f.count), 0);
  const count = fb.reduce((sum: number, f: any) => sum + parseInt(f.count), 0);
  return count > 0 ? (total / count).toFixed(1) : null;
});

// Simple bar chart via CSS
function barWidth(value: number, max: number) {
  return max > 0 ? `${Math.round((value / max) * 100)}%` : '0%';
}
</script>

<template>
  <div class="min-h-screen pb-32">
    <TopBar title="ANALYTICS" show-back />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-8">
      <!-- Period selector -->
      <div class="flex gap-2">
        <button
          v-for="d in [7, 14, 30]"
          :key="d"
          :class="[
            'px-4 py-2 rounded-full text-xs font-bold transition-all active:scale-95',
            days === d ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant'
          ]"
          @click="days = d; fetchStats()"
        >{{ d }}d</button>
      </div>

      <!-- Loading -->
      <div v-if="loading" class="space-y-4">
        <div v-for="i in 4" :key="i" class="bg-surface-container-low rounded-2xl p-5 animate-pulse">
          <div class="h-4 bg-surface-container-high rounded w-1/2 mb-3"></div>
          <div class="h-8 bg-surface-container-high rounded w-1/3"></div>
        </div>
      </div>

      <template v-else-if="data">
        <!-- KPI Cards -->
        <section class="grid grid-cols-2 gap-4">
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Users</p>
            <p class="text-3xl font-black text-on-surface">{{ totalUsers }}</p>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Sessions</p>
            <p class="text-3xl font-black text-on-surface">{{ totalSessions }}</p>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Events</p>
            <p class="text-3xl font-black text-on-surface">{{ totalEvents }}</p>
          </div>
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-1">Avg Rating</p>
            <p class="text-3xl font-black" :class="avgRating && parseFloat(avgRating) >= 4 ? 'text-primary' : 'text-on-surface'">
              {{ avgRating ?? '—' }}
            </p>
          </div>
        </section>

        <!-- Daily Activity Chart -->
        <section class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Daily Activity</h3>
          <div class="space-y-2">
            <div v-for="day in data.overview" :key="day.day" class="flex items-center gap-3">
              <span class="text-[10px] font-mono text-on-surface-variant w-16 shrink-0">{{ day.day?.slice(5) }}</span>
              <div class="flex-1 h-6 bg-surface-container rounded-full overflow-hidden relative">
                <div
                  class="h-full bg-primary-container rounded-full transition-all duration-500"
                  :style="{ width: barWidth(parseInt(day.unique_devices), Math.max(...data.overview.map((d: any) => parseInt(d.unique_devices)))) }"
                ></div>
              </div>
              <span class="text-xs font-bold text-on-surface w-8 text-right">{{ day.unique_devices }}</span>
            </div>
          </div>
        </section>

        <!-- Join Queue Funnel -->
        <section v-if="data.funnel?.length > 0" class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Join Queue Funnel</h3>
          <div class="bg-surface-container-lowest p-5 rounded-2xl shadow-sm space-y-3">
            <template v-for="(step, idx) in [
              { label: 'Started', key: 'step_1_start' },
              { label: 'Plate Scanned', key: 'step_2_plate' },
              { label: 'Spot Selected', key: 'step_3_spot' },
              { label: 'Confirmed', key: 'step_4_confirm' },
              { label: 'Completed', key: 'step_5_success' },
            ]" :key="step.key">
              <div class="flex items-center gap-3">
                <div :class="[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0',
                  idx === 4 ? 'bg-primary-container text-on-primary' : 'bg-surface-container text-on-surface-variant'
                ]">{{ idx + 1 }}</div>
                <div class="flex-1">
                  <div class="flex justify-between mb-1">
                    <span class="text-xs font-medium text-on-surface">{{ step.label }}</span>
                    <span class="text-xs font-bold text-on-surface-variant">
                      {{ data.funnel.reduce((s: number, f: any) => s + parseInt(f[step.key] ?? 0), 0) }}
                    </span>
                  </div>
                  <div class="h-2 bg-surface-container rounded-full overflow-hidden">
                    <div
                      class="h-full rounded-full transition-all duration-500"
                      :class="idx === 4 ? 'bg-primary-container' : 'bg-primary/30'"
                      :style="{
                        width: barWidth(
                          data.funnel.reduce((s: number, f: any) => s + parseInt(f[step.key] ?? 0), 0),
                          Math.max(1, data.funnel.reduce((s: number, f: any) => s + parseInt(f.step_1_start ?? 0), 0))
                        )
                      }"
                    ></div>
                  </div>
                </div>
              </div>
            </template>
            <div v-if="data.funnel[0]?.completion_rate_pct" class="pt-2 text-center">
              <span class="text-xs text-on-surface-variant">Completion rate: </span>
              <span class="text-sm font-black text-primary">{{ data.funnel[0].completion_rate_pct }}%</span>
            </div>
          </div>
        </section>

        <!-- Drop-off Points -->
        <section v-if="dropoffs.length > 0" class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Exit Points</h3>
          <div class="space-y-3">
            <div v-for="d in dropoffs" :key="d.exit_page" class="bg-surface-container-lowest p-4 rounded-xl flex items-center justify-between shadow-sm">
              <div>
                <p class="text-sm font-semibold text-on-surface capitalize">{{ d.exit_page?.replace(/_/g, ' ') }}</p>
                <p class="text-xs text-on-surface-variant">{{ d.exits }} exits / {{ d.total_views }} views</p>
              </div>
              <span :class="[
                'text-sm font-black px-3 py-1 rounded-full',
                parseFloat(d.exit_rate_pct) > 50 ? 'bg-error/10 text-error' : 'bg-surface-container text-on-surface-variant'
              ]">{{ d.exit_rate_pct }}%</span>
            </div>
          </div>
        </section>

        <!-- Top Stations -->
        <section v-if="data.top_stations?.length > 0" class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Most Active Stations</h3>
          <div class="space-y-3">
            <div v-for="(s, idx) in data.top_stations" :key="s.station_id" class="bg-surface-container-lowest p-4 rounded-xl flex items-center gap-4 shadow-sm">
              <div class="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-black text-sm">{{ idx + 1 }}</div>
              <div class="flex-1">
                <p class="text-sm font-semibold text-on-surface">{{ s.station_id }}</p>
                <p class="text-xs text-on-surface-variant">{{ s.unique_users }} users &middot; {{ s.successful_joins }} joins</p>
              </div>
              <span class="text-xs font-bold text-on-surface-variant">{{ s.events }} events</span>
            </div>
          </div>
        </section>

        <!-- Feedback Summary -->
        <section v-if="data.feedback?.length > 0" class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight">Feedback</h3>
          <div class="space-y-3">
            <div v-for="f in data.feedback" :key="f.category" class="bg-surface-container-lowest p-4 rounded-xl shadow-sm">
              <div class="flex justify-between items-center mb-2">
                <span class="text-sm font-semibold text-on-surface capitalize">{{ f.category.replace(/_/g, ' ') }}</span>
                <span class="text-xs font-bold text-on-surface-variant">{{ f.count }} responses</span>
              </div>
              <div class="flex gap-4 text-xs">
                <span class="text-primary font-bold">{{ f.positive }} positive</span>
                <span class="text-error font-bold">{{ f.negative }} negative</span>
                <span v-if="f.avg_rating" class="text-on-surface-variant">avg: {{ f.avg_rating }}/5</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Errors -->
        <section v-if="totalErrors > 0" class="space-y-4">
          <h3 class="text-on-surface font-bold text-lg tracking-tight flex items-center gap-2">
            <span class="material-symbols-outlined text-error text-lg">error</span>
            Errors
          </h3>
          <div class="bg-error/5 p-4 rounded-xl">
            <p class="text-sm font-bold text-error">{{ totalErrors }} errors in the last {{ days }} days</p>
            <p class="text-xs text-on-surface-variant mt-1">Check the telemetry API for details: GET /api/telemetry/stats/daily</p>
          </div>
        </section>
      </template>

      <!-- No data -->
      <div v-else class="text-center py-12">
        <span class="material-symbols-outlined text-5xl text-on-surface-variant/20 mb-4">analytics</span>
        <p class="text-on-surface-variant">No analytics data yet</p>
        <p class="text-xs text-on-surface-variant/60 mt-1">Data will appear as users interact with the app</p>
      </div>
    </main>
  </div>
</template>
