type __VLS_Props = {
    stationId: string;
    stalls: Array<{
        label: string;
        current_status: string;
    }>;
    selectedSpot: string | null;
};
declare const _default: import("vue").DefineComponent<__VLS_Props, {}, {}, {}, {}, import("vue").ComponentOptionsMixin, import("vue").ComponentOptionsMixin, {} & {
    select: (label: string) => any;
}, string, import("vue").PublicProps, Readonly<__VLS_Props> & Readonly<{
    onSelect?: ((label: string) => any) | undefined;
}>, {}, {}, {}, {}, string, import("vue").ComponentProvideOptions, false, {}, any>;
export default _default;
//# sourceMappingURL=AerialSpotSelector.vue.d.ts.map