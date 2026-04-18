<script setup lang="ts">
const emit = defineEmits<{ (e: 'dismissed'): void }>();

function accept() {
  localStorage.setItem('pq_privacy_accepted', 'true');
  emit('dismissed');
}
</script>

<template>
  <Transition
    enter-active-class="transition-all duration-400 ease-out"
    enter-from-class="translate-y-full opacity-0"
    enter-to-class="translate-y-0 opacity-100"
    leave-active-class="transition-all duration-300 ease-in"
    leave-from-class="translate-y-0 opacity-100"
    leave-to-class="translate-y-full opacity-0"
  >
    <div
      v-if="true"
      class="fixed inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm"
    >
      <div class="w-full max-w-md bg-surface-container-lowest rounded-t-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] max-h-[85dvh] overflow-y-auto overscroll-contain">
        <div class="px-8 pt-8 pb-2">
          <div class="flex items-center gap-3 mb-4">
            <div class="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <span class="material-symbols-outlined text-primary">verified_user</span>
            </div>
            <h2 class="text-on-surface text-xl font-black tracking-tight">Your Privacy Matters</h2>
          </div>
          <p class="text-on-surface-variant text-sm leading-relaxed mb-6">
            PlugQueue is designed to work <strong>without storing your personal data</strong>.
          </p>
        </div>

        <div class="px-8 space-y-5 pb-6">
          <!-- What we ask for -->
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">Permissions we ask</p>
            <div class="space-y-3">
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-primary text-lg mt-0.5">location_on</span>
                <div>
                  <p class="text-on-surface text-sm font-semibold">Location</p>
                  <p class="text-on-surface-variant text-xs">Confirms you're physically at the station so only drivers on-site can join the queue.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-primary text-lg mt-0.5">photo_camera</span>
                <div>
                  <p class="text-on-surface text-sm font-semibold">Camera</p>
                  <p class="text-on-surface-variant text-xs">Scans your license plate to identify your spot in the queue. Photos never leave your device.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <span class="material-symbols-outlined text-primary text-lg mt-0.5">notifications</span>
                <div>
                  <p class="text-on-surface text-sm font-semibold">Notifications</p>
                  <p class="text-on-surface-variant text-xs">Alerts you the instant a stall opens so you don't miss your 3-minute window to plug in.</p>
                </div>
              </div>
            </div>
          </div>

          <!-- What we store -->
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">What we store</p>
            <div class="bg-surface-container rounded-2xl p-4 space-y-3">
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-sm text-primary">tag</span>
                <p class="text-on-surface-variant text-xs"><strong class="text-on-surface">Device ID</strong> — random, anonymous, stored locally on your phone</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-sm text-primary">fingerprint</span>
                <p class="text-on-surface-variant text-xs"><strong class="text-on-surface">Plate hash</strong> — one-way hash with a daily-rotating salt. We cannot reverse it.</p>
              </div>
              <div class="flex items-center gap-3">
                <span class="material-symbols-outlined text-sm text-primary">auto_delete</span>
                <p class="text-on-surface-variant text-xs"><strong class="text-on-surface">Queue entries</strong> — auto-deleted after your session ends (max 24h)</p>
              </div>
            </div>
          </div>

          <!-- What we DON'T store -->
          <div>
            <p class="text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3">What we never store</p>
            <div class="flex flex-wrap gap-2">
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No accounts</span>
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No emails</span>
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No phone numbers</span>
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No photos</span>
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No location history</span>
              <span class="bg-surface-container px-3 py-1.5 rounded-full text-xs text-on-surface-variant font-medium">No license plates</span>
            </div>
          </div>
        </div>

        <div class="px-8 pt-2 pb-10">
          <button
            class="w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 flex items-center justify-center gap-3 active:scale-[0.98] transition-all"
            @click="accept"
          >
            <span class="material-symbols-outlined">check</span>
            <span class="tracking-widest uppercase text-sm">Got It</span>
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
