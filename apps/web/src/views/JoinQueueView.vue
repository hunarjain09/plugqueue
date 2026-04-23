<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import { useGeolocation } from '@/composables/useGeolocation';
import TopBar from '@/components/TopBar.vue';
import TurnstileWidget from '@/components/TurnstileWidget.vue';
import LotMap, { type LotMapData } from '@/components/LotMap.vue';
import { trackFlowStep, trackFlowComplete, trackFlowAbandon, trackFeatureUse, trackError } from '@/composables/useAnalytics';

const route = useRoute();
const router = useRouter();
const store = useStationStore();
const geo = useGeolocation();

const stationId = route.params.id as string;
const plate = ref('');
const selectedSpot = ref<string | null>(null);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);
const step = ref<'plate' | 'spot' | 'confirm'>('plate');
const turnstileToken = ref<string | null>(null);
const lotMapData = ref<LotMapData | null>(null);

// Camera/OCR state
const showCamera = ref(false);
const videoRef = ref<HTMLVideoElement | null>(null);
const ocrProcessing = ref(false);

onMounted(async () => {
  trackFlowStep('join_start', stationId);
  await store.fetchStation(stationId);
  try {
    await geo.getCurrentPosition();
  } catch {}
  try {
    const res = await fetch(`/stations/${stationId}.json`);
    if (res.ok) lotMapData.value = await res.json();
  } catch {}
});

const stalls = computed(() => store.station?.stalls ?? []);
const availableSpots = computed(() =>
  stalls.value.filter((s: any) => s.current_status === 'available')
);

async function startCamera() {
  showCamera.value = true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    if (videoRef.value) {
      videoRef.value.srcObject = stream;
      videoRef.value.play();
    }
  } catch {
    showCamera.value = false;
    errorMsg.value = 'Camera access denied. Please enter plate manually.';
  }
}

async function captureAndOCR() {
  if (!videoRef.value) return;
  ocrProcessing.value = true;

  const canvas = document.createElement('canvas');
  canvas.width = videoRef.value.videoWidth;
  canvas.height = videoRef.value.videoHeight;
  canvas.getContext('2d')!.drawImage(videoRef.value, 0, 0);

  // Stop camera
  const stream = videoRef.value.srcObject as MediaStream;
  stream?.getTracks().forEach((t) => t.stop());
  showCamera.value = false;

  try {
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng');
    const { data } = await worker.recognize(canvas);
    await worker.terminate();

    // Extract plate-like pattern
    const text = data.text.replace(/[^A-Z0-9\s-]/gi, '').trim();
    const match = text.match(/[A-Z0-9]{2,4}[\s-]?[A-Z0-9]{2,5}/i);
    if (match) {
      plate.value = match[0].toUpperCase();
      trackFlowStep('plate_captured', stationId, { method: 'ocr' });
    } else if (text.length >= 4) {
      plate.value = text.slice(0, 8).toUpperCase();
      trackFlowStep('plate_captured', stationId, { method: 'ocr_partial' });
    }
  } catch {
    errorMsg.value = 'OCR failed. Please enter plate manually.';
  } finally {
    ocrProcessing.value = false;
  }
}

function nextStep() {
  if (step.value === 'plate') {
    if (!plate.value || plate.value.length < 2) {
      errorMsg.value = 'Please enter a valid plate';
      return;
    }
    errorMsg.value = null;
    trackFlowStep('plate_confirmed', stationId, { method: 'manual' });
    step.value = 'spot';
  } else if (step.value === 'spot') {
    trackFlowStep('spot_selected', stationId, { spot: selectedSpot.value });
    step.value = 'confirm';
  }
}

async function submitJoin() {
  if (!geo.lat.value || !geo.lng.value) {
    errorMsg.value = 'Location required to join queue';
    return;
  }

  submitting.value = true;
  errorMsg.value = null;

  try {
    trackFlowStep('join_confirmed', stationId);
    await store.joinQueue(
      stationId,
      plate.value,
      selectedSpot.value ?? undefined,
      geo.lat.value,
      geo.lng.value,
      turnstileToken.value ?? undefined
    );
    trackFlowComplete('join_success', stationId);
    router.push(`/s/${stationId}/queue`);
  } catch (err: any) {
    trackError('join_failed', 'join', { code: err.code, message: err.message });
    errorMsg.value = err.message;
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <div class="min-h-screen pb-8">
    <TopBar title="JOIN QUEUE" show-back />

    <main class="max-w-md mx-auto px-6 pt-8 space-y-8">
      <!-- Location permission banner -->
      <section
        v-if="geo.error.value && !geo.loading.value"
        class="bg-error-container/30 border border-error/30 rounded-2xl p-4 flex items-start gap-3"
      >
        <span class="material-symbols-outlined text-error mt-0.5">location_off</span>
        <div class="flex-1 min-w-0">
          <p class="text-on-surface text-sm font-semibold">Location access needed</p>
          <p class="text-on-surface-variant text-xs mt-1 leading-relaxed">
            We use your location to confirm you're physically at this station — required to join the queue.
            If iOS already denied, open <span class="font-semibold">Settings → Safari → Location</span>
            and allow, then tap Retry.
          </p>
          <button
            class="mt-3 text-primary text-xs font-bold uppercase tracking-widest active:opacity-60"
            @click="geo.getCurrentPosition().catch(() => {})"
          >
            Retry
          </button>
        </div>
      </section>

      <!-- Camera/OCR Screen -->
      <section v-if="showCamera" class="relative -mx-6 -mt-8">
        <div class="relative bg-black aspect-[4/3] flex items-center justify-center overflow-hidden">
          <video ref="videoRef" class="w-full h-full object-cover" playsinline muted></video>
          <!-- Viewfinder overlay -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="w-72 h-20 border-2 border-primary/40 rounded-lg relative">
              <div class="absolute -top-1 -left-1 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg"></div>
              <div class="absolute -top-1 -right-1 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg"></div>
              <div class="absolute -bottom-1 -left-1 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg"></div>
              <div class="absolute -bottom-1 -right-1 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg"></div>
              <div class="absolute top-1/2 left-4 right-4 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent animate-pulse"></div>
            </div>
          </div>
          <div class="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black/80 to-transparent">
            <p class="text-white text-center text-sm mb-4">Align license plate within the frame</p>
            <button
              class="w-full bg-primary-container text-on-primary font-bold py-4 rounded-2xl flex items-center justify-center gap-2 active:scale-95"
              @click="captureAndOCR"
            >
              <span class="material-symbols-outlined">photo_camera</span>
              Capture
            </button>
          </div>
        </div>
      </section>

      <!-- OCR Processing -->
      <section v-if="ocrProcessing" class="flex flex-col items-center py-12 gap-4">
        <div class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
          <span class="material-symbols-outlined text-3xl text-primary">document_scanner</span>
        </div>
        <p class="text-on-surface-variant text-sm">Processing plate...</p>
        <p class="text-[10px] text-on-surface-variant/60 flex items-center gap-1">
          <span class="material-symbols-outlined text-xs">verified_user</span>
          On-device processing
        </p>
      </section>

      <!-- Step 1: Plate Input -->
      <template v-if="!showCamera && !ocrProcessing && step === 'plate'">
        <section class="space-y-6">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-on-surface mb-2">Join the Queue</h2>
            <p class="text-on-surface-variant text-sm">Scan or enter your license plate to get started.</p>
          </div>

          <div class="space-y-4">
            <label class="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant px-1">License Plate</label>
            <div class="relative">
              <input
                v-model="plate"
                type="text"
                placeholder="ABC-1234"
                class="w-full bg-surface-container-high border-none rounded-xl px-4 py-4 focus:ring-2 focus:ring-primary-container transition-all placeholder:text-outline/50 font-mono text-lg uppercase tracking-wider"
              />
              <span class="absolute right-4 top-1/2 -translate-y-1/2 text-outline material-symbols-outlined">directions_car</span>
            </div>

            <button
              class="w-full bg-surface-container text-on-surface-variant font-semibold py-4 rounded-xl flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
              @click="startCamera"
            >
              <span class="material-symbols-outlined">photo_camera</span>
              Scan with Camera
            </button>
          </div>

          <p v-if="errorMsg" class="text-error text-sm text-center">{{ errorMsg }}</p>

          <button
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
            @click="nextStep"
          >
            <span class="tracking-widest uppercase text-sm">Continue</span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>

          <p class="text-center text-[11px] text-on-surface-variant flex items-center justify-center gap-1">
            <span class="material-symbols-outlined text-xs">verified_user</span>
            Your plate is hashed on-device and never stored in plaintext.
          </p>
        </section>
      </template>

      <!-- Step 2: Parking Spot Selection -->
      <template v-if="step === 'spot'">
        <section class="space-y-5">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-on-surface mb-2">Where are you parked?</h2>
            <p class="text-on-surface-variant text-sm">Tap your parking spot — others in the queue can see where everyone is waiting.</p>
          </div>

          <!-- Lot map selector -->
          <LotMap
            v-if="lotMapData"
            mode="join"
            :lot-map="lotMapData"
            :selected-spot-id="selectedSpot"
            @select="(id: string) => selectedSpot = id"
          />
          <div v-else class="aspect-[4/3] bg-surface-container-low rounded-2xl animate-pulse" />

          <!-- Confirmation sheet when a spot is selected -->
          <Transition name="spot-sheet">
            <div
              v-if="selectedSpot"
              class="bg-surface-container-lowest border border-surface-container rounded-2xl p-5 space-y-3 shadow-sm"
            >
              <div class="flex items-center justify-between">
                <span class="text-sm font-semibold text-on-surface">Confirm your spot</span>
                <span class="bg-primary-container text-on-primary font-black text-sm px-3 py-1 rounded-full">{{ selectedSpot }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-on-surface-variant uppercase tracking-widest font-bold">Row</span>
                <span class="font-semibold text-on-surface">{{ selectedSpot.replace(/\d+$/, '') }}</span>
              </div>
              <div class="flex items-center justify-between text-xs">
                <span class="text-on-surface-variant uppercase tracking-widest font-bold">Spot</span>
                <span class="font-semibold text-on-surface">{{ selectedSpot }}</span>
              </div>
            </div>
          </Transition>

          <button
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
            @click="nextStep"
          >
            <span class="tracking-widest uppercase text-sm">
              {{ selectedSpot ? `Continue from ${selectedSpot}` : 'Skip — Pick Spot Later' }}
            </span>
            <span class="material-symbols-outlined">arrow_forward</span>
          </button>
        </section>
      </template>

      <!-- Step 3: Confirm -->
      <template v-if="step === 'confirm'">
        <section class="space-y-6">
          <div>
            <h2 class="text-2xl font-bold tracking-tight text-on-surface mb-2">Confirm & Join</h2>
            <p class="text-on-surface-variant text-sm">Review your details before joining the queue.</p>
          </div>

          <div class="bg-surface-container-lowest p-6 rounded-2xl shadow-sm space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Plate</span>
              <span class="font-mono text-lg font-bold text-on-surface tracking-wider">{{ plate }}</span>
            </div>
            <div v-if="selectedSpot" class="flex justify-between items-center">
              <span class="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Parked at</span>
              <span class="font-bold text-on-surface">{{ selectedSpot }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Station</span>
              <span class="text-sm text-on-surface">{{ store.station?.name }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-xs text-on-surface-variant uppercase tracking-widest font-bold">Est. Wait</span>
              <span class="font-bold text-primary">{{ store.station?.estimated_wait_min ?? 0 }} min</span>
            </div>
          </div>

          <!-- Turnstile verification -->
          <TurnstileWidget
            @verified="(token: string) => turnstileToken = token"
            @error="errorMsg = 'Verification failed. Please refresh and try again.'"
          />

          <p v-if="errorMsg" class="text-error text-sm text-center bg-error-container/20 p-3 rounded-xl">{{ errorMsg }}</p>

          <button
            :disabled="submitting"
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-50"
            @click="submitJoin"
          >
            <span v-if="submitting" class="material-symbols-outlined animate-spin">progress_activity</span>
            <template v-else>
              <span class="tracking-widest uppercase text-sm">Join Queue</span>
              <span class="material-symbols-outlined">bolt</span>
            </template>
          </button>

          <p class="text-center text-[11px] text-on-surface-variant">
            You will receive a notification when your stall is ready.
          </p>
        </section>
      </template>
    </main>
  </div>
</template>

<style scoped>
.spot-sheet-enter-active,
.spot-sheet-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.spot-sheet-enter-from,
.spot-sheet-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
