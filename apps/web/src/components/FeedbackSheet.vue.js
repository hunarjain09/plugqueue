import { ref } from 'vue';
import { useRoute } from 'vue-router';
import { submitFeedback } from '@/composables/useAnalytics';
const route = useRoute();
const show = ref(false);
const rating = ref(null);
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
        stationId: route.params.id,
        page: route.name,
    });
    submitting.value = false;
    submitted.value = true;
    setTimeout(() => { show.value = false; }, 2000);
}
const __VLS_exposed = { open };
defineExpose(__VLS_exposed);
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
    ...{ onClick: (__VLS_ctx.open) },
    ...{ class: "fixed bottom-24 right-4 z-40 w-12 h-12 bg-primary-container text-on-primary rounded-full shadow-lg shadow-primary/20 flex items-center justify-center active:scale-90 transition-all" },
});
__VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
    ...{ class: "material-symbols-outlined text-lg" },
});
const __VLS_0 = {}.Transition;
/** @type {[typeof __VLS_components.Transition, typeof __VLS_components.Transition, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({
    enterActiveClass: "transition-all duration-400 ease-out",
    enterFromClass: "translate-y-full opacity-0",
    enterToClass: "translate-y-0 opacity-100",
    leaveActiveClass: "transition-all duration-300 ease-in",
    leaveFromClass: "translate-y-0 opacity-100",
    leaveToClass: "translate-y-full opacity-0",
}));
const __VLS_2 = __VLS_1({
    enterActiveClass: "transition-all duration-400 ease-out",
    enterFromClass: "translate-y-full opacity-0",
    enterToClass: "translate-y-0 opacity-100",
    leaveActiveClass: "transition-all duration-300 ease-in",
    leaveFromClass: "translate-y-0 opacity-100",
    leaveToClass: "translate-y-full opacity-0",
}, ...__VLS_functionalComponentArgsRest(__VLS_1));
__VLS_3.slots.default;
if (__VLS_ctx.show) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ onClick: (...[$event]) => {
                if (!(__VLS_ctx.show))
                    return;
                __VLS_ctx.show = false;
            } },
        ...{ class: "fixed inset-0 z-[90] flex items-end justify-center bg-black/30 backdrop-blur-sm" },
    });
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ...{ class: "w-full max-w-md bg-surface-container-lowest rounded-t-[2rem] shadow-[0_-20px_60px_rgba(0,0,0,0.3)] p-8 pb-10" },
    });
    if (__VLS_ctx.submitted) {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "text-center py-8" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined text-4xl text-primary mb-3" },
            ...{ style: {} },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-on-surface font-bold text-lg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-on-surface-variant text-sm mt-1" },
        });
    }
    else {
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex items-center justify-between mb-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.h3, __VLS_intrinsicElements.h3)({
            ...{ class: "text-on-surface font-bold text-lg" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (...[$event]) => {
                    if (!(__VLS_ctx.show))
                        return;
                    if (!!(__VLS_ctx.submitted))
                        return;
                    __VLS_ctx.show = false;
                } },
            ...{ class: "text-on-surface-variant p-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "material-symbols-outlined" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-5" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-3" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex gap-2 justify-center" },
        });
        for (const [n] of __VLS_getVForSourceType((5))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!!(__VLS_ctx.submitted))
                            return;
                        __VLS_ctx.rating = n;
                    } },
                key: (n),
                ...{ class: ([
                        'w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold transition-all active:scale-90',
                        __VLS_ctx.rating === n
                            ? 'bg-primary-container text-on-primary shadow-md'
                            : 'bg-surface-container text-on-surface-variant hover:bg-surface-container-high'
                    ]) },
            });
            (n);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex justify-between mt-1 px-1" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-[10px] text-on-surface-variant" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
            ...{ class: "text-[10px] text-on-surface-variant" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-5" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.p, __VLS_intrinsicElements.p)({
            ...{ class: "text-[10px] font-bold uppercase tracking-widest text-on-surface-variant mb-2" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "flex flex-wrap gap-2" },
        });
        for (const [cat] of __VLS_getVForSourceType((__VLS_ctx.categories))) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
                ...{ onClick: (...[$event]) => {
                        if (!(__VLS_ctx.show))
                            return;
                        if (!!(__VLS_ctx.submitted))
                            return;
                        __VLS_ctx.category = cat.value;
                    } },
                key: (cat.value),
                ...{ class: ([
                        'px-3 py-1.5 rounded-full text-xs font-medium transition-all',
                        __VLS_ctx.category === cat.value
                            ? 'bg-primary-container text-on-primary'
                            : 'bg-surface-container text-on-surface-variant'
                    ]) },
            });
            (cat.label);
        }
        __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
            ...{ class: "mb-6" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.textarea, __VLS_intrinsicElements.textarea)({
            value: (__VLS_ctx.comment),
            placeholder: "Tell us more (optional)...",
            rows: "3",
            ...{ class: "w-full bg-surface-container-high border-none rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-primary-container transition-all placeholder:text-outline/50 resize-none" },
        });
        __VLS_asFunctionalElement(__VLS_intrinsicElements.button, __VLS_intrinsicElements.button)({
            ...{ onClick: (__VLS_ctx.submit) },
            disabled: (__VLS_ctx.submitting),
            ...{ class: "w-full bg-primary-container text-on-primary font-bold py-4 rounded-full flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-50" },
        });
        if (__VLS_ctx.submitting) {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "material-symbols-outlined animate-spin text-sm" },
            });
        }
        else {
            __VLS_asFunctionalElement(__VLS_intrinsicElements.span, __VLS_intrinsicElements.span)({
                ...{ class: "material-symbols-outlined text-sm" },
            });
        }
    }
}
var __VLS_3;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['bottom-24']} */ ;
/** @type {__VLS_StyleScopedClasses['right-4']} */ ;
/** @type {__VLS_StyleScopedClasses['z-40']} */ ;
/** @type {__VLS_StyleScopedClasses['w-12']} */ ;
/** @type {__VLS_StyleScopedClasses['h-12']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-primary/20']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-90']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['fixed']} */ ;
/** @type {__VLS_StyleScopedClasses['inset-0']} */ ;
/** @type {__VLS_StyleScopedClasses['z-[90]']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-end']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-black/30']} */ ;
/** @type {__VLS_StyleScopedClasses['backdrop-blur-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['max-w-md']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-lowest']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-t-[2rem]']} */ ;
/** @type {__VLS_StyleScopedClasses['shadow-[0_-20px_60px_rgba(0,0,0,0.3)]']} */ ;
/** @type {__VLS_StyleScopedClasses['p-8']} */ ;
/** @type {__VLS_StyleScopedClasses['pb-10']} */ ;
/** @type {__VLS_StyleScopedClasses['text-center']} */ ;
/** @type {__VLS_StyleScopedClasses['py-8']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-4xl']} */ ;
/** @type {__VLS_StyleScopedClasses['text-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['text-lg']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['p-1']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-3']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-between']} */ ;
/** @type {__VLS_StyleScopedClasses['mt-1']} */ ;
/** @type {__VLS_StyleScopedClasses['px-1']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-5']} */ ;
/** @type {__VLS_StyleScopedClasses['text-[10px]']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['uppercase']} */ ;
/** @type {__VLS_StyleScopedClasses['tracking-widest']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface-variant']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-2']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['flex-wrap']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['mb-6']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-surface-container-high']} */ ;
/** @type {__VLS_StyleScopedClasses['border-none']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-xl']} */ ;
/** @type {__VLS_StyleScopedClasses['px-4']} */ ;
/** @type {__VLS_StyleScopedClasses['py-3']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-2']} */ ;
/** @type {__VLS_StyleScopedClasses['focus:ring-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['placeholder:text-outline/50']} */ ;
/** @type {__VLS_StyleScopedClasses['resize-none']} */ ;
/** @type {__VLS_StyleScopedClasses['w-full']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-primary-container']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-primary']} */ ;
/** @type {__VLS_StyleScopedClasses['font-bold']} */ ;
/** @type {__VLS_StyleScopedClasses['py-4']} */ ;
/** @type {__VLS_StyleScopedClasses['rounded-full']} */ ;
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['items-center']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['gap-2']} */ ;
/** @type {__VLS_StyleScopedClasses['active:scale-[0.98]']} */ ;
/** @type {__VLS_StyleScopedClasses['transition-all']} */ ;
/** @type {__VLS_StyleScopedClasses['disabled:opacity-50']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['animate-spin']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
/** @type {__VLS_StyleScopedClasses['material-symbols-outlined']} */ ;
/** @type {__VLS_StyleScopedClasses['text-sm']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            show: show,
            rating: rating,
            comment: comment,
            category: category,
            submitted: submitted,
            submitting: submitting,
            categories: categories,
            open: open,
            submit: submit,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {
            ...__VLS_exposed,
        };
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=FeedbackSheet.vue.js.map