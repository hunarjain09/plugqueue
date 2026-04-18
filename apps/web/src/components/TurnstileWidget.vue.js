import { ref, onMounted, onUnmounted } from 'vue';
const emit = defineEmits();
const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const containerRef = ref(null);
let widgetId = null;
onMounted(() => {
    if (!siteKey || !containerRef.value)
        return;
    // Load Turnstile script if not already loaded
    if (!window.turnstile) {
        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
        script.async = true;
        script.onload = renderWidget;
        document.head.appendChild(script);
    }
    else {
        renderWidget();
    }
});
function renderWidget() {
    if (!containerRef.value || !window.turnstile)
        return;
    widgetId = window.turnstile.render(containerRef.value, {
        sitekey: siteKey,
        theme: 'light',
        callback: (token) => emit('verified', token),
        'error-callback': () => emit('error'),
    });
}
onUnmounted(() => {
    if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
    }
});
debugger; /* PartiallyEnd: #3632/scriptSetup.vue */
const __VLS_ctx = {};
let __VLS_components;
let __VLS_directives;
if (__VLS_ctx.siteKey) {
    __VLS_asFunctionalElement(__VLS_intrinsicElements.div, __VLS_intrinsicElements.div)({
        ref: "containerRef",
        ...{ class: "flex justify-center my-4" },
    });
    /** @type {typeof __VLS_ctx.containerRef} */ ;
}
/** @type {__VLS_StyleScopedClasses['flex']} */ ;
/** @type {__VLS_StyleScopedClasses['justify-center']} */ ;
/** @type {__VLS_StyleScopedClasses['my-4']} */ ;
var __VLS_dollars;
const __VLS_self = (await import('vue')).defineComponent({
    setup() {
        return {
            siteKey: siteKey,
            containerRef: containerRef,
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
//# sourceMappingURL=TurnstileWidget.vue.js.map