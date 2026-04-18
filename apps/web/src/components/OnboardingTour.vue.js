import { ref, computed, onMounted } from 'vue';
const emit = defineEmits();
const show = ref(false);
const currentStep = ref(0);
const steps = [
    {
        title: 'Find a station',
        body: 'Nearby charging stations appear automatically based on your location. Tap any station to see live stall availability and queue length.',
        icon: 'ev_station',
        target: 'station-list',
        position: 'bottom',
    },
    {
        title: 'Join the queue',
        body: 'Tap "Join Queue" and point your camera at your license plate. We scan it on your phone — the image never leaves your device.',
        icon: 'photo_camera',
        target: 'join-queue-btn',
        position: 'top',
    },
    {
        title: 'Pick your spot',
        body: 'Select the parking spot where you\'re waiting. This helps other drivers see where the queue is physically located.',
        icon: 'map',
        target: 'spot-grid',
        position: 'top',
    },
    {
        title: 'Watch the live queue',
        body: 'Your position updates in real-time. No need to refresh — the queue moves automatically as stalls open up.',
        icon: 'hourglass_empty',
        target: 'queue-list',
        position: 'bottom',
    },
    {
        title: 'Get notified instantly',
        body: 'When a stall opens, you get a push notification. You have 3 minutes to plug in and confirm — then the spot is yours.',
        icon: 'notifications_active',
        target: 'notify-hero',
        position: 'bottom',
    },
    {
        title: 'Help the community',
        body: 'Paste a screenshot from your charging app to update stall statuses. This helps the next driver in line get notified faster.',
        icon: 'group',
        target: 'update-status-btn',
        position: 'top',
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
    }
    else {
        currentStep.value++;
    }
}
function prev() {
    if (currentStep.value > 0)
        currentStep.value--;
}
function finish() {
    show.value = false;
    localStorage.setItem('pq_tour_done', 'true');
    emit('dismissed');
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
const __VLS_0 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    enterActiveClass: "transition-opacity duration-300",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-200",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}));
const __VLS_2 = __VLS_1({
    enterActiveClass: "transition-opacity duration-300",
    enterFromClass: "opacity-0",
    enterToClass: "opacity-100",
    leaveActiveClass: "transition-opacity duration-200",
    leaveFromClass: "opacity-100",
    leaveToClass: "opacity-0",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "fixed inset-0 z-[120]" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (__VLS_ctx.finish) },
        ...{ class: "absolute inset-0 bg-black/60 backdrop-blur-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute inset-x-0 bottom-0 flex justify-center pointer-events-none" },
    });
    const __VLS_4 = {}.Transition;
    /** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
    // @ts-ignore
    const __VLS_5 = __VLS_asFunctionalComponent(__VLS_4, new __VLS_4({
        enterActiveClass: "transition-all duration-400 ease-out",
        enterFromClass: "translate-y-8 opacity-0",
        enterToClass: "translate-y-0 opacity-100",
        leaveActiveClass: "transition-all duration-200",
        leaveFromClass: "translate-y-0 opacity-100",
        leaveToClass: "translate-y-8 opacity-0",
        mode: "out-in",
    }));
    const __VLS_6 = __VLS_5({
        enterActiveClass: "transition-all duration-400 ease-out",
        enterFromClass: "translate-y-8 opacity-0",
        enterToClass: "translate-y-0 opacity-100",
        leaveActiveClass: "transition-all duration-200",
        leaveFromClass: "translate-y-0 opacity-100",
        leaveToClass: "translate-y-8 opacity-0",
        mode: "out-in",
    }, ...__VLS_functionalComponentArgsRest(__VLS_5));
    __VLS_7.slots.default;
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        key: (__VLS_ctx.currentStep),
        ...{ class: "w-full max-w-md mx-4 mb-8 pointer-events-auto" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-surface-container-lowest rounded-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.4)] overflow-hidden" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "h-1 bg-surface-container-high" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "h-full bg-primary-container transition-all duration-500 ease-out" },
        ...{ style: ({ width: `${__VLS_ctx.progress}%` }) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "p-8" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex items-center justify-between mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-primary-container flex items-center justify-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "material-symbols-outlined text-on-primary text-2xl" },
        ...{ style: {} },
    });
    (__VLS_ctx.step.icon);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" },
    });
    (__VLS_ctx.currentStep + 1);
    (__VLS_ctx.steps.length);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
        ...{ class: "text-on-surface text-xl font-black tracking-tight mb-3" },
    });
    (__VLS_ctx.step.title);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface-variant text-sm leading-relaxed" },
    });
    (__VLS_ctx.step.body);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex justify-center gap-2 mt-6 mb-6" },
    });
    for (const [_, i] of __VLS_getVForSourceType((__VLS_ctx.steps))) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            key: (i),
            ...{ class: ([
                    'h-1.5 rounded-full transition-all duration-300',
                    i === __VLS_ctx.currentStep
                        ? 'w-6 bg-primary-container'
                        : i < __VLS_ctx.currentStep
                            ? 'w-1.5 bg-primary/40'
                            : 'w-1.5 bg-surface-container-high'
                ]) },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex gap-3" },
    });
    if (__VLS_ctx.currentStep > 0) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.prev) },
            ...{ class: "flex-1 bg-surface-container text-on-surface-variant font-semibold py-4 rounded-full active:scale-95 transition-all" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.finish) },
            ...{ class: "flex-1 bg-surface-container text-on-surface-variant font-semibold py-4 rounded-full active:scale-95 transition-all" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.next) },
        ...{ class: "flex-1 bg-primary-container text-on-primary font-bold py-4 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2" },
    });
    (__VLS_ctx.isLast ? 'Get Started' : 'Next');
    if (!__VLS_ctx.isLast) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined text-sm" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined text-sm" },
        });
    }
    var __VLS_7;
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[120]']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/60']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-x-0']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-none']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pointer-events-auto']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-lowest']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_-20px_60px_rgba(0,0,0,0.4)]']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-high']} */ ;
/** @type {__VLS_StyleScopedClasses['h-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['duration-500']} */ ;
/** @type {__VLS_StyleScopedClasses['ease-out']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-14']} */ ;
/** @type {__VLS_StyleScopedClasses['h-14']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['to-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-6']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            show: show,
            currentStep: currentStep,
            steps: steps,
            step: step,
            isLast: isLast,
            progress: progress,
            next: next,
            prev: prev,
            finish: finish,
        };
    },
    __typeEmits: {},
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
    __typeEmits: {},
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=OnboardingTour.vue.js.map