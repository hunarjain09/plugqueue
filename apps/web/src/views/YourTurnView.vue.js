import { onMounted, onUnmounted, ref, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStationStore } from '@/stores/station';
import { useGeofenceWatch } from '@/composables/useGeofenceWatch';
import TopBar from '@/components/TopBar.vue';
import BottomNav from '@/components/BottomNav.vue';
const CONFIRM_WINDOW_SEC = 3 * 60;
const route = useRoute();
const router = useRouter();
const store = useStationStore();
const stationId = route.params.id;
const confirming = ref(false);
const leaving = ref(false);
const secondsLeft = ref(CONFIRM_WINDOW_SEC);
let countdownTimer = null;
// Reactive geofence with actual station coordinates
const sLat = computed(() => store.station?.location?.lat ?? null);
const sLng = computed(() => store.station?.location?.lng ?? null);
const sGeo = computed(() => store.station?.geofence_m ?? 500);
const { autoLeft } = useGeofenceWatch(sLat, sLng, sGeo);
onMounted(async () => {
    await store.fetchStation(stationId);
    // Calculate actual remaining time based on server's notified_at
    // instead of always starting at 3:00
    if (store.station?.queue && store.myEntry) {
        const myQueueEntry = store.station.queue.find((q) => q.id === store.myEntry.entry_id);
        if (myQueueEntry?.notified_at) {
            const notifiedAt = new Date(myQueueEntry.notified_at).getTime();
            const elapsed = Math.floor((Date.now() - notifiedAt) / 1000);
            secondsLeft.value = Math.max(0, CONFIRM_WINDOW_SEC - elapsed);
        }
    }
    countdownTimer = setInterval(() => {
        secondsLeft.value = Math.max(0, secondsLeft.value - 1);
        if (secondsLeft.value === 0) {
            if (countdownTimer)
                clearInterval(countdownTimer);
        }
    }, 1000);
});
onUnmounted(() => {
    if (countdownTimer)
        clearInterval(countdownTimer);
});
const formattedTime = computed(() => {
    const m = Math.floor(secondsLeft.value / 60);
    const s = secondsLeft.value % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
});
const urgency = computed(() => {
    if (secondsLeft.value <= 30)
        return 'critical';
    if (secondsLeft.value <= 60)
        return 'warning';
    return 'normal';
});
async function handleConfirm() {
    confirming.value = true;
    try {
        await store.confirmCharge();
        router.push(`/s/${stationId}`);
    }
    catch {
        confirming.value = false;
    }
}
async function handleLeave() {
    leaving.value = true;
    try {
        await store.leaveQueue();
        router.push(`/s/${stationId}`);
    }
    catch {
        leaving.value = false;
    }
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "min-h-screen pb-32 flex flex-col items-center" },
});
/** @type {[typeof TopBar, ]} */ ;
// @ts-ignore
const __VLS_0 = __VLS_asFunctionalComponent(TopBar, new TopBar({
    title: "PLUGQUEUE",
    showBack: true,
}));
const __VLS_1 = __VLS_0({
    title: "PLUGQUEUE",
    showBack: true,
}, ...__VLS_functionalComponentArgsRest(__VLS_0));
__VLS_asFunctionalElement(__VLS_intrinsicElements.main, __VLS_intrinsicElements.main)({
    ...{ class: "w-full max-w-md flex-grow flex flex-col px-6 pt-8 pb-32" },
});
if (__VLS_ctx.autoLeft) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-error-container/20 p-5 rounded-2xl mb-6 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "material-symbols-outlined text-error text-3xl mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface font-bold" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface-variant text-sm mt-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.autoLeft))
                    return;
                __VLS_ctx.router.push(`/s/${__VLS_ctx.stationId}`);
            } },
        ...{ class: "mt-4 text-primary font-semibold text-sm" },
    });
}
else if (__VLS_ctx.secondsLeft === 0) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-error-container/20 p-5 rounded-2xl mb-6 text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "material-symbols-outlined text-error text-3xl mb-2" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface font-bold" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface-variant text-sm mt-1" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (...[$event]) => {
                if (!!(__VLS_ctx.autoLeft))
                    return;
                if (!(__VLS_ctx.secondsLeft === 0))
                    return;
                __VLS_ctx.router.push(`/s/${__VLS_ctx.stationId}`);
            } },
        ...{ class: "mt-4 text-primary font-semibold text-sm" },
    });
}
else {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary to-primary-container p-8 mb-6 shadow-xl shadow-primary/20" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "absolute -top-10 -right-10 w-40 h-40 bg-secondary-container/20 rounded-full blur-3xl" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "relative z-10" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "inline-block px-3 py-1 bg-white/20 text-on-primary text-[10px] font-bold tracking-widest uppercase rounded-full mb-4 backdrop-blur-md" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.h2, __VLS_intrinsicElements.h2)({
        ...{ class: "text-on-primary text-5xl font-black tracking-tighter mb-2 leading-tight" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-primary/90 text-lg font-medium" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ([
                'rounded-2xl p-6 mb-6 flex items-center justify-between',
                __VLS_ctx.urgency === 'critical' ? 'bg-error/10 border-2 border-error/30' :
                    __VLS_ctx.urgency === 'warning' ? 'bg-tertiary-container/10 border-2 border-tertiary-container/30' :
                        'bg-surface-container-lowest shadow-sm'
            ]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({});
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-[10px] font-bold uppercase tracking-widest text-on-surface-variant" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: ([
                'text-4xl font-black tracking-tighter font-mono',
                __VLS_ctx.urgency === 'critical' ? 'text-error' :
                    __VLS_ctx.urgency === 'warning' ? 'text-tertiary' :
                        'text-on-surface'
            ]) },
    });
    (__VLS_ctx.formattedTime);
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: ([
                'w-14 h-14 rounded-full flex items-center justify-center',
                __VLS_ctx.urgency === 'critical' ? 'bg-error/20' :
                    __VLS_ctx.urgency === 'warning' ? 'bg-tertiary-container/20' :
                        'bg-primary/10'
            ]) },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: ([
                'material-symbols-outlined text-2xl',
                __VLS_ctx.urgency === 'critical' ? 'text-error animate-pulse' :
                    __VLS_ctx.urgency === 'warning' ? 'text-tertiary' :
                        'text-primary'
            ]) },
    });
    if (__VLS_ctx.urgency !== 'normal') {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: ([
                    'text-center text-sm font-medium mb-6 px-4',
                    __VLS_ctx.urgency === 'critical' ? 'text-error' : 'text-tertiary'
                ]) },
        });
        (__VLS_ctx.urgency === 'critical'
            ? 'Confirm now or your spot will be given away!'
            : 'Less than a minute left to confirm.');
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "bg-surface-container-lowest rounded-[2rem] p-8 mb-6 shadow-[0_12px_32px_rgba(0,101,145,0.06)] flex flex-col items-center text-center" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-20 h-20 bg-surface-container rounded-full flex items-center justify-center mb-6" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "material-symbols-outlined text-primary text-4xl" },
        ...{ style: {} },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface-variant font-medium mb-1 uppercase tracking-[0.2em] text-xs" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
        ...{ class: "text-on-surface-variant leading-relaxed px-4 mt-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.strong, __VLS_intrinsicElements.strong)({});
    (Math.ceil(__VLS_ctx.CONFIRM_WINDOW_SEC / 60));
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "flex flex-col gap-4" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleConfirm) },
        disabled: (__VLS_ctx.confirming),
        ...{ class: "w-full bg-primary-container text-on-primary font-bold py-5 rounded-full shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50" },
    });
    if (__VLS_ctx.confirming) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined animate-spin" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined" },
        });
    }
    __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
        ...{ onClick: (__VLS_ctx.handleLeave) },
        disabled: (__VLS_ctx.leaving),
        ...{ class: "w-full bg-surface-container-low text-on-surface-variant font-semibold py-5 rounded-full active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
        ...{ class: "material-symbols-outlined" },
    });
}
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "mt-8 flex justify-center opacity-20" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-1 h-1 rounded-full bg-primary mx-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-1 h-1 rounded-full bg-primary mx-1" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "w-1 h-1 rounded-full bg-primary mx-1" },
});
/** @type {[typeof BottomNav, ]} */ ;
// @ts-ignore
const __VLS_3 = __VLS_asFunctionalComponent(BottomNav, new BottomNav({}));
const __VLS_4 = __VLS_3({}, ...__VLS_functionalComponentArgsRest(__VLS_3));
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-32']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-grow']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-32']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-error-container/20']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-error-container/20']} */ ;
/** @type {__VLS_StyleScopedClasses['p-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-2xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-error']} */ ;
/** @type {__VLS_StyleScopedClasses['text-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['overflow-hidden']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-gradient-to-br']} */ ;
/** @type {__VLS_StyleScopedClasses['from-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['to-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['absolute']} */ ;
/** @type {__VLS_StyleScopedClasses['-top-10']} */ ;
/** @type {__VLS_StyleScopedClasses['-right-10']} */ ;
/** @type {__VLS_StyleScopedClasses['w-40']} */ ;
/** @type {__VLS_StyleScopedClasses['h-40']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-secondary-container/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['blur-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['relative']} */ ;
/** @type {__VLS_StyleScopedClasses['z-10']} */ ;
/** @type {__VLS_StyleScopedClasses['inline-block']} */ ;
/** @type {__VLS_StyleScopedClasses['px-3']} */ ;
/** @type {__VLS_StyleScopedClasses['py-1']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-white/20']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-4']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-md']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-5xl']} */ ;
/** @type {__VLS_StyleScopedClasses['font-black']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-tighter']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-tight']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary/90']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-lowest']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_12px_32px_rgba(0,101,145,0.06)]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['w-20']} */ ;
/** @type {__VLS_StyleScopedClasses['h-20']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['font-medium']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-1']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-[0.2em]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-xs']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['leading-relaxed']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-4']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-low']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['font-semibold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-5']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-95']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-3']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-8']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['opacity-20']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
/** @type {__VLS_StyleScopedClasses['w-1']} */ ;
/** @type {__VLS_StyleScopedClasses['h-1']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mx-1']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            TopBar: TopBar,
            BottomNav: BottomNav,
            CONFIRM_WINDOW_SEC: CONFIRM_WINDOW_SEC,
            router: router,
            stationId: stationId,
            confirming: confirming,
            leaving: leaving,
            secondsLeft: secondsLeft,
            autoLeft: autoLeft,
            formattedTime: formattedTime,
            urgency: urgency,
            handleConfirm: handleConfirm,
            handleLeave: handleLeave,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=YourTurnView.vue.js.map