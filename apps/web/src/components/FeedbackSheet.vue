<script setup lang="ts">
import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { submitFeedback } from '@/composables/useAnalytics';

const route = useRoute();
const show = ref(false);
const rating = ref<number | null>(null);
const comment = ref('');
const category = ref('general');
const submitted = ref(false);
const submitting = ref(false);

const categories = [
  { value: 'general', label: 'General' },
  { value: 'join_flow', label: 'Joining Queue' },
  { value: 'queue_experience', label: 'Queue Experience' },
  { value: 'notification', label: 'Notifications' },
  { value: 'status_update', label: 'Status Updates' },
  { value: 'bug_report', label: 'Report a Bug' },
];

function open() {
  show.value = true;
  submitted.value = false;
  rating.value = null;
  comment.value = '';
}

async function submit() {
  submitting.value = true;
  await submitFeedback({
    rating: rating.value ?? undefined,
    category: category.value,
    comment: comment.value || undefined,
    stationId: route.params.id as string | undefined,
    page: route.name as string,
  });
  submitting.value = false;
  submitted.value = true;
  setTimeout(() => { show.value = false; }, 2000);
}

defineExpose({ open });
</script>

<template>
  <!-- Floating trigger button -->
  <button
    class="fixed bottom-24 right-4 z-40 w-12 h-12 bg-primary-container text-on-primary rounded-full shadow-lg shadow-primary/20 flex items-center justify-center active:scale-90 transition-all"
    @click="open"
  >
    <span class="material-symbols-outlined text-lg">rate_review</span>
  </button>

  <!-- Feedback sheet -->
  <Transition
    enter-active-class="transition-all duration-400 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div v-if="show" class="fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm" @click.self="show = false">
      <div class="w-full max-w-md bg-surface-container-lowest rounded-t-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-8 pb-10">
        <template v-if="submitted">
          <div class="text-center py-8">
            <span class="material-symbols-outlined text-4xl text-primary mb-3" style="font-variation-settings: 'FILL' 1;">check_circle</span>
            <p class="text-on-surface font-bold text-lg">Thanks for your feedback!</p>
            <p class="text-on-surface-variant text-sm mt-1">This helps us improve PlugQueue.</p>
          </div>
        </template>

        <template v-else>
          <div class="flex items-center justify-between mb-6">
            <h3 class="text-on-surface font-bold text-lg">Share Feedback</h3>
            <button class="text-on-surface-variant p-1" @click="show = false">
              <span class="material-symbols-outlined">close</span>
            </button>
          </div>

          <!-- Rating -->
          <div class="mb-5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">How was your experience?</p>
            <div class="flex gap-2 justify-center">
              <button
                v-for="n in 5"
                :key="n"
                :class="[
                  'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-90',
                  rating === n
                    ? 'bg-primary-container text-on-primary shadow-md'
                    : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                ]"
                @click="rating = n"
              >
                {{ n }}
              </button>
            </div>
            <div class="flex justify-between mt-1 px-1">
              <span class="text-[10px] text-on-surface-variant">Terrible</span>
              <span class="text-[10px] text-on-surface-variant">Excellent</span>
            </div>
          </div>

          <!-- Category -->
          <div class="mb-5">
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2">About</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="cat in categories"
                :key="cat.value"
                :class="[
                  'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                  category === cat.value
                    ? 'bg-primary-container text-on-primary'
                    : 'bg-surface-container text-on-surface-variant'
                ]"
                @click="category = cat.value"
              >
                {{ cat.label }}
              </button>
            </div>
          </div>

          <!-- Comment -->
          <div class="mb-6">
            <textarea
              v-model="comment"
              placeholder="Tell us more (optional)..."
              rows="3"
              class="w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-container transition-all placeholder:text-outline/50 resize-none"
            ></textarea>
          </div>

          <button
            :disabled="submitting"
            class="w-full bg-primary-container text-on-primary font-bold py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50"
            @click="submit"
          >
            <span v-if="submitting" class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
            <template v-else>
              <span class="material-symbols-outlined text-sm">send</span>
              Submit Feedback
            </template>
          </button>
        </template>
      </div>
    </div>
  </Transition>
</template>
