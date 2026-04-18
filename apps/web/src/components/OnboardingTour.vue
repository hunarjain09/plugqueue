<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';

const emit = defineEmits<{ (e: 'dismissed'): void }>();

const show = ref(false);
const currentStep = ref(0);

const steps = [
  {
    title: 'Find a station',
    body: 'Nearby charging stations appear automatically based on your location. Tap any station to see live stall availability and queue length.',
    icon: 'ev_station',
    target: 'station-list',
    position: 'bottom' as const,
  },
  {
    title: 'Join the queue',
    body: 'Tap "Join Queue" and point your camera at your license plate. We scan it on your phone — the image never leaves your device.',
    icon: 'photo_camera',
    target: 'join-queue-btn',
    position: 'top' as const,
  },
  {
    title: 'Pick your spot',
    body: 'Select the parking spot where you\'re waiting. This helps other drivers see where the queue is physically located.',
    icon: 'map',
    target: 'spot-grid',
    position: 'top' as const,
  },
  {
    title: 'Watch the live queue',
    body: 'Your position updates in real-time. No need to refresh — the queue moves automatically as stalls open up.',
    icon: 'hourglass_empty',
    target: 'queue-list',
    position: 'bottom' as const,
  },
  {
    title: 'Get notified instantly',
    body: 'When a stall opens, you get a push notification. You have 3 minutes to plug in and confirm — then the spot is yours.',
    icon: 'notifications_active',
    target: 'notify-hero',
    position: 'bottom' as const,
  },
  {
    title: 'Help the community',
    body: 'Paste a screenshot from your charging app to update stall statuses. This helps the next driver in line get notified faster.',
    icon: 'group',
    target: 'update-status-btn',
    position: 'top' as const,
  },
];

const step = computed(() => steps[currentStep.value]);
const isLast = computed(() => currentStep.value === steps.length - 1);
const progress = computed(() => ((currentStep.value + 1) / steps.length) * 100);

onMounted(() => {
  setTimeout(() => { show.value = true; }, 800);
});

function next() {
  if (isLast.value) {
    finish();
  } else {
    currentStep.value++;
  }
}

function prev() {
  if (currentStep.value > 0) currentStep.value--;
}

function finish() {
  show.value = false;
  localStorage.setItem('pq_tour_done', 'true');
  emit('dismissed');
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-[120]">
      <!-- Backdrop -->
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" @click="finish"></div>

      <!-- Tour Card -->
      <div class="absolute inset-x-0 bottom-0 flex justify-center pointer-events-none">
        <Transition
          enter-active-class="transition-all duration-400 ease-out"
          enter-from-class="translate-y-8 opacity-0"
          enter-to-class="translate-y-0 opacity-100"
          leave-active-class="transition-all duration-200"
          leave-from-class="translate-y-0 opacity-100"
          leave-to-class="translate-y-8 opacity-0"
          mode="out-in"
        >
          <div
            :key="currentStep"
            class="w-full max-w-md mx-4 mb-8 pointer-events-auto"
          >
            <div class="bg-surface-container-lowest rounded-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.4)] overflow-hidden">
              <!-- Progress bar -->
              <div class="h-1 bg-surface-container-high">
                <div
                  class="h-full bg-primary-container transition-all duration-500 ease-out"
                  :style="{ width: `${progress}%` }"
                ></div>
              </div>

              <div class="p-8">
                <!-- Icon + Step indicator -->
                <div class="flex items-center justify-between mb-6">
                  <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center">
                    <span class="material-symbols-outlined text-on-primary text-2xl" style="font-variation-settings: 'FILL' 1;">{{ step.icon }}</span>
                  </div>
                  <span class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant">
                    {{ currentStep + 1 }} of {{ steps.length }}
                  </span>
                </div>

                <!-- Content -->
                <h3 class="text-on-surface text-xl font-black tracking-tight mb-3">{{ step.title }}</h3>
                <p class="text-on-surface-variant text-sm leading-relaxed">{{ step.body }}</p>

                <!-- Step dots -->
                <div class="flex justify-center gap-2 mt-6 mb-6">
                  <div
                    v-for="(_, i) in steps"
                    :key="i"
                    :class="[
                      'h-1.5 rounded-full transition-all duration-300',
                      i === currentStep
                        ? 'w-6 bg-primary-container'
                        : i < currentStep
                          ? 'w-1.5 bg-primary/40'
                          : 'w-1.5 bg-surface-container-high'
                    ]"
                  ></div>
                </div>

                <!-- Actions -->
                <div class="flex gap-3">
                  <button
                    v-if="currentStep > 0"
                    class="flex-1 bg-surface-container text-on-surface-variant font-semibold py-4 rounded-full active:scale-95 transition-all"
                    @click="prev"
                  >
                    Back
                  </button>
                  <button
                    v-else
                    class="flex-1 bg-surface-container text-on-surface-variant font-semibold py-4 rounded-full active:scale-95 transition-all"
                    @click="finish"
                  >
                    Skip Tour
                  </button>
                  <button
                    class="flex-1 bg-primary-container text-on-primary font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2"
                    @click="next"
                  >
                    {{ isLast ? 'Get Started' : 'Next' }}
                    <span v-if="!isLast" class="material-symbols-outlined text-sm">arrow_forward</span>
                    <span v-else class="material-symbols-outlined text-sm">bolt</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </Transition>
</template>
