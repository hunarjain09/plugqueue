import { watch } from 'vue';
import { RouterView, useRoute } from 'vue-router';
import { useOverlayQueue } from '@/composables/useOverlayQueue';
import { trackPageView, trackError } from '@/composables/useAnalytics';
import PrivacyDisclaimer from '@/components/PrivacyDisclaimer.vue';
import OnboardingTour from '@/components/OnboardingTour.vue';
import InstallPrompt from '@/components/InstallPrompt.vue';
import FeedbackSheet from '@/components/FeedbackSheet.vue';
const route = useRoute();
const { showPrivacy, showTour, showInstall, dismissPrivacy, dismissTour, dismissInstall } = useOverlayQueue();
// Auto-track page views on route change
watch(() => route.fullPath, () => {
    if (route.name) {
        trackPageView(route.name, route.params.id);
    }
}, { immediate: true });
// Pipe uncaught errors to telemetry (since console.log won't help on iOS Safari)
window.addEventListener('error', (event) => {
    trackError('uncaught_error', route.name ?? 'unknown', {
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
    });
});
window.addEventListener('unhandledrejection', (event) => {
    trackError('unhandled_rejection', route.name ?? 'unknown', {
        reason: String(event.reason),
    });
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
__VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
    ...{ class: "min-h-screen bg-background text-on-surface" },
});
const __VLS_0 = {}.RouterView;
/** @type {[typeof __VLS_components.RouterView, ]} */ ;
// @ts-ignore
const __VLS_1 = __VLS_asFunctionalComponent(__VLS_0, new __VLS_0({}));
const __VLS_2 = __VLS_1({}, ...__VLS_functionalComponentArgsRest(__VLS_1));
/** @type {[typeof FeedbackSheet, ]} */ ;
// @ts-ignore
const __VLS_4 = __VLS_asFunctionalComponent(FeedbackSheet, new FeedbackSheet({}));
const __VLS_5 = __VLS_4({}, ...__VLS_functionalComponentArgsRest(__VLS_4));
if (__VLS_ctx.showPrivacy) {
    /** @type {[typeof PrivacyDisclaimer, ]} */ ;
    // @ts-ignore
    const __VLS_7 = __VLS_asFunctionalComponent(PrivacyDisclaimer, new PrivacyDisclaimer({
        ...{ 'onDismissed': {} },
    }));
    const __VLS_8 = __VLS_7({
        ...{ 'onDismissed': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_7));
    let __VLS_10;
    let __VLS_11;
    let __VLS_12;
    const __VLS_13 = {
        onDismissed: (__VLS_ctx.dismissPrivacy)
    };
    var __VLS_9;
}
if (__VLS_ctx.showTour) {
    /** @type {[typeof OnboardingTour, ]} */ ;
    // @ts-ignore
    const __VLS_14 = __VLS_asFunctionalComponent(OnboardingTour, new OnboardingTour({
        ...{ 'onDismissed': {} },
    }));
    const __VLS_15 = __VLS_14({
        ...{ 'onDismissed': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_14));
    let __VLS_17;
    let __VLS_18;
    let __VLS_19;
    const __VLS_20 = {
        onDismissed: (__VLS_ctx.dismissTour)
    };
    var __VLS_16;
}
if (__VLS_ctx.showInstall) {
    /** @type {[typeof InstallPrompt, ]} */ ;
    // @ts-ignore
    const __VLS_21 = __VLS_asFunctionalComponent(InstallPrompt, new InstallPrompt({
        ...{ 'onDismissed': {} },
    }));
    const __VLS_22 = __VLS_21({
        ...{ 'onDismissed': {} },
    }, ...__VLS_functionalComponentArgsRest(__VLS_21));
    let __VLS_24;
    let __VLS_25;
    let __VLS_26;
    const __VLS_27 = {
        onDismissed: (__VLS_ctx.dismissInstall)
    };
    var __VLS_23;
}
/** @type {__VLS_StyleScopedClasses['min-h-screen']} */ ;
/** @type {__VLS_StyleScopedClasses['bg-background']} */ ;
/** @type {__VLS_StyleScopedClasses['text-on-surface']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            RouterView: RouterView,
            PrivacyDisclaimer: PrivacyDisclaimer,
            OnboardingTour: OnboardingTour,
            InstallPrompt: InstallPrompt,
            FeedbackSheet: FeedbackSheet,
            showPrivacy: showPrivacy,
            showTour: showTour,
            showInstall: showInstall,
            dismissPrivacy: dismissPrivacy,
            dismissTour: dismissTour,
            dismissInstall: dismissInstall,
        };
    },
});
export default (await import('vue')).defineComponent({
    setup() {
        return {};
    },
});
; /* PartiallyEnd: #4569/main.vue */
//# sourceMappingURL=App.vue.js.map