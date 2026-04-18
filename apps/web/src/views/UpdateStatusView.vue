<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import { api } from '@/lib/api';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';

const route = useRoute();
const router = useRouter();
const store = useStationStore();
const stationId = route.params.id as string;

const stallStatuses = ref<{ label: string; status: string }[]>([]);
const submitting = ref(false);
const submitted = ref(false);
const errorMsg = ref<string | null>(null);
const ocrProcessing = ref(false);

onMounted(async () => {
  await store.fetchStation(stationId);
  if (store.station?.stalls) {
    stallStatuses.value = store.station.stalls.map((s: any) => ({
      label: s.label,
      status: s.current_status,
    }));
  }
});

function toggleStatus(label: string) {
  const stall = stallStatuses.value.find((s) => s.label === label);
  if (!stall) return;
  const cycle: Record<string, string> = {
    available: 'in_use',
    in_use: 'offline',
    offline: 'available',
    unknown: 'available',
  };
  stall.status = cycle[stall.status] ?? 'available';
}

function statusColor(status: string) {
  switch (status) {
    case 'available': return 'text-primary';
    case 'in_use': return 'text-tertiary';
    case 'offline': return 'text-error';
    default: return 'text-on-surface-variant';
  }
}

function statusIcon(status: string) {
  switch (status) {
    case 'available': return 'check_circle';
    case 'in_use': return 'hourglass_empty';
    case 'offline': return 'block';
    default: return 'help';
  }
}

async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items;
  if (!items) return;

  for (const item of items) {
    if (!item.type.startsWith('image/')) continue;
    const blob = item.getAsFile();
    if (!blob) continue;

    ocrProcessing.value = true;
    try {
      const Tesseract = await import('tesseract.js');
      const worker = await Tesseract.createWorker('eng');
      const { data } = await worker.recognize(blob);
      await worker.terminate();

      // Parse OCR text for stall status patterns
      const lines = data.text.split('\n').filter(Boolean);
      for (const line of lines) {
        const availMatch = line.match(/(A\d|B\d|C\d|#?\d+)\s*[:\-]?\s*(available|free|open)/i);
        const useMatch = line.match(/(A\d|B\d|C\d|#?\d+)\s*[:\-]?\s*(in.?use|charging|busy|occupied)/i);

        if (availMatch) {
          const label = availMatch[1].replace('#', '').toUpperCase();
          const stall = stallStatuses.value.find((s) => s.label === label);
          if (stall) stall.status = 'available';
        }
        if (useMatch) {
          const label = useMatch[1].replace('#', '').toUpperCase();
          const stall = stallStatuses.value.find((s) => s.label === label);
          if (stall) stall.status = 'in_use';
        }
      }
    } catch {
      errorMsg.value = 'OCR failed. Update stalls manually by tapping.';
    } finally {
      ocrProcessing.value = false;
    }
  }
}

async function submit() {
  submitting.value = true;
  errorMsg.value = null;
  try {
    await api.updateStallStatus(stationId, stallStatuses.value, new Date().toISOString());
    submitted.value = true;
  } catch (err: any) {
    errorMsg.value = err.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen pb-32" @paste="handlePaste">
    <TopBar title="UPDATE STATUS" show-back />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-6">
      <!-- Hero -->
      <section class="space-y-1">
        <h2 class="text-2xl font-extrabold text-on-surface tracking-tight">Station Update</h2>
        <p class="text-on-surface-variant text-sm">Update real-time stall availability for the community.</p>
      </section>

      <!-- Upload/Paste Area -->
      <section class="glass-card rounded-xl p-6 border-dashed border-2 border-primary/30 flex flex-col items-center justify-center gap-4 text-center active:scale-[0.98] transition-all cursor-pointer">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary">
          <span class="material-symbols-outlined text-4xl">photo_camera</span>
        </div>
        <div>
          <p class="font-semibold text-on-surface">Paste or Upload Screenshot</p>
          <p class="text-xs text-on-surface-variant mt-1">Host app screenshot (e.g. Tesla, Electrify America)</p>
        </div>
        <div class="flex items-center gap-2 px-3 py-2 bg-surface-container-high rounded-lg text-xs text-on-surface-variant font-medium">
          <span class="material-symbols-outlined text-sm">shield</span>
          Privacy: Images are processed locally and never uploaded.
        </div>
      </section>

      <!-- OCR Processing -->
      <div v-if="ocrProcessing" class="flex items-center gap-3 justify-center py-4">
        <span class="material-symbols-outlined text-primary animate-spin">progress_activity</span>
        <span class="text-sm text-on-surface-variant">Processing screenshot...</span>
      </div>

      <!-- Stall Status List -->
      <section v-if="stallStatuses.length > 0" class="space-y-4">
        <div class="flex justify-between items-end px-1">
          <h3 class="text-xs font-bold uppercase tracking-widest text-on-surface-variant">Stall Status</h3>
          <span class="text-[10px] text-primary font-bold bg-primary/10 px-2 py-0.5 rounded-full">
            {{ stallStatuses.length }} STALLS
          </span>
        </div>
        <div class="grid grid-cols-1 gap-3">
          <button
            v-for="stall in stallStatuses"
            :key="stall.label"
            class="p-4 rounded-xl flex items-center justify-between active:scale-[0.98] transition-all"
            :class="[
              stall.status === 'available'
                ? 'bg-surface-container-lowest border-l-4 border-l-primary shadow-sm'
                : stall.status === 'offline'
                  ? 'bg-surface-container-low border-l-4 border-l-error/40'
                  : 'bg-surface-container-low border-l-4 border-l-outline-variant/30'
            ]"
            @click="toggleStatus(stall.label)"
          >
            <div class="flex items-center gap-4">
              <div :class="[
                'w-10 h-10 rounded-lg flex items-center justify-center font-bold',
                stall.status === 'available' ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'
              ]">
                {{ stall.label }}
              </div>
              <div class="text-left">
                <p class="text-sm font-semibold text-on-surface">Stall {{ stall.label }}</p>
                <p :class="['text-xs font-medium capitalize', statusColor(stall.status)]">
                  {{ stall.status.replace('_', ' ') }}
                </p>
              </div>
            </div>
            <span
              :class="['material-symbols-outlined', statusColor(stall.status)]"
              :style="stall.status === 'available' ? `font-variation-settings: 'FILL' 1;` : ''"
            >{{ statusIcon(stall.status) }}</span>
          </button>
        </div>
        <p class="text-[10px] text-on-surface-variant text-center">Tap a stall to cycle its status</p>
      </section>

      <!-- Success -->
      <section v-if="submitted" class="bg-primary/10 p-6 rounded-2xl text-center space-y-2">
        <span class="material-symbols-outlined text-4xl text-primary" style="font-variation-settings: 'FILL' 1;">check_circle</span>
        <p class="font-bold text-on-surface">Status Updated!</p>
        <p class="text-xs text-on-surface-variant">Thank you for helping fellow drivers.</p>
        <button
          class="mt-4 text-primary font-semibold text-sm"
          @click="router.push(`/s/${stationId}`)"
        >
          Back to Station
        </button>
      </section>

      <!-- Action -->
      <section v-if="!submitted && stallStatuses.length > 0" class="pt-4 pb-8">
        <p v-if="errorMsg" class="text-error text-sm text-center mb-4">{{ errorMsg }}</p>
        <button
          :disabled="submitting"
          class="w-full bg-primary-container text-on-primary py-4 rounded-full font-bold text-lg shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
          @click="submit"
        >
          <span v-if="submitting" class="material-symbols-outlined animate-spin">progress_activity</span>
          <template v-else>
            <span class="material-symbols-outlined">publish</span>
            Update Community Queue
          </template>
        </button>
        <p class="text-center text-[11px] text-on-surface-variant mt-4 leading-relaxed px-6">
          By updating, you help fellow drivers find open stalls. Data is anonymized and temporary.
        </p>
      </section>
    </main>

    <BottomNav />
  </div>
</template>
