export declare function useGeolocation(): {
    lat: import("vue").Ref<number | null, number | null>;
    lng: import("vue").Ref<number | null, number | null>;
    error: import("vue").Ref<string | null, string | null>;
    loading: import("vue").Ref<boolean, boolean>;
    getCurrentPosition: () => Promise<{
        lat: number;
        lng: number;
    }>;
};
//# sourceMappingURL=useGeolocation.d.ts.map