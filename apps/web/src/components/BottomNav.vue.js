import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { useStationStore } from '@/stores/station';
const route = useRoute();
const store = useStationStore();
// Get station ID from current route or from store (last viewed)
const stationId = computed(() => route.params.id ?? store.station?.id ?? store.myEntry?.station_id);
const tabs = computed(() => [
    { name: 'discover', icon: 'map', label: 'Explore', path: '/' },
    {
        name: 'queue',
        icon: 'hourglass_empty',
        label: 'Queue',
        path: stationId.value ? `/s/${stationId.value}/queue` : null,
    },
    {
        name: 'update-status',
        icon: 'ev_station',
        label: 'Update',
        path: stationId.value ? `/s/${stationId.value}/update` : null,
    },
]);
function isActive(name) {
    return route.name === name;
}
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.nav, __VLS_intrinsicElements.nav)({
    ...{ class: "fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-surface-container-lowest/80 backdrop-blur-xl border-t border-outline-variant/20 rounded-t-3xl z-50 flex justify-around items-center px-8 pb-8 pt-4 shadow-[0_-12px_32px_rgba(0,101,145,0.06)]" },
});
for (const [tab] of __VLS_getVForSourceType((__VLS_ctx.tabs))) {
    (tab.name);
    if (tab.path) {
        const __VLS_0 = {}.RouterLink;
        /** @type {[typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, typeof __VLS_components.RouterLink, typeof __VLS_components.routerLink, ]} */ ;
        // @ts-ignore
        const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
            to: (tab.path),
            ...{ class: ([
                    'flex flex-col items-center justify-center px-6 py-2 active:scale-90 transition-all duration-200',
                    __VLS_ctx.isActive(tab.name)
                        ? 'bg-primary-container text-on-primary rounded-full'
                        : 'text-on-surface-variant hover:text-primary'
                ]) },
        }));
        const __VLS_2 = __VLS_1({
            to: (tab.path),
            ...{ class: ([
                    'flex flex-col items-center justify-center px-6 py-2 active:scale-90 transition-all duration-200',
                    __VLS_ctx.isActive(tab.name)
                        ? 'bg-primary-container text-on-primary rounded-full'
                        : 'text-on-surface-variant hover:text-primary'
                ]) },
        }, ...__VLS_functionalComponentArgsRest(__VLS_1));
        __VLS_3.slots.default;
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined text-lg" },
        });
        (tab.icon);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-[11px] font-bold uppercase tracking-widest mt-0.5" },
        });
        (tab.label);
        var __VLS_3;
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex flex-col items-center justify-center px-6 py-2 text-on-surface-variant/30 cursor-not-allowed" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined text-lg" },
        });
        (tab.icon);
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-[11px] font-bold uppercase tracking-widest mt-0.5" },
        });
        (tab.label);
    }
}
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-0']} */ ;
/** @type {__VLS_StyleScopedClasses['left-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['-translate-x-1/2']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-lowest/80']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['border-t']} */ ;
/** @type {__VLS_StyleScopedClasses['border-outline-variant/20']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-3xl']} */ ;
/** @type {__VLS_StyleScopedClasses['z-50']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-around']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pt-4']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_-12px_32px_rgba(0,101,145,0.06)]']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-col']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['px-6']} */ ;
/** @type {__VLS_StyleScopedClasses['py-2']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant/30']} */ ;
/** @type {__VLS_StyleScopedClasses['cursor-not-allowed']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[11px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-0.5']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            tabs: tabs,
            isActive: isActive,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=BottomNav.vue.js.map