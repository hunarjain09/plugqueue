export declare const useStationStore: import("pinia").StoreDefinition<"station", Pick<{
    station: import("vue").Ref<any, any>;
    nearbyStations: import("vue").Ref<any[], any[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    myEntry: import("vue").Ref<{
        entry_id: string;
        station_id: string;
        position: number;
    } | null, {
        entry_id: string;
        station_id: string;
        position: number;
    } | {
        entry_id: string;
        station_id: string;
        position: number;
    } | null>;
    fetchNearby: (lat: number, lng: number) => Promise<void>;
    fetchStation: (id: string) => Promise<void>;
    joinQueue: (stationId: string, plate: string, spotId: string | undefined, lat: number, lng: number, turnstileToken?: string) => Promise<any>;
    leaveQueue: () => Promise<void>;
    confirmCharge: () => Promise<void>;
}, "error" | "station" | "nearbyStations" | "loading" | "myEntry">, Pick<{
    station: import("vue").Ref<any, any>;
    nearbyStations: import("vue").Ref<any[], any[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    myEntry: import("vue").Ref<{
        entry_id: string;
        station_id: string;
        position: number;
    } | null, {
        entry_id: string;
        station_id: string;
        position: number;
    } | {
        entry_id: string;
        station_id: string;
        position: number;
    } | null>;
    fetchNearby: (lat: number, lng: number) => Promise<void>;
    fetchStation: (id: string) => Promise<void>;
    joinQueue: (stationId: string, plate: string, spotId: string | undefined, lat: number, lng: number, turnstileToken?: string) => Promise<any>;
    leaveQueue: () => Promise<void>;
    confirmCharge: () => Promise<void>;
}, never>, Pick<{
    station: import("vue").Ref<any, any>;
    nearbyStations: import("vue").Ref<any[], any[]>;
    loading: import("vue").Ref<boolean, boolean>;
    error: import("vue").Ref<string | null, string | null>;
    myEntry: import("vue").Ref<{
        entry_id: string;
        station_id: string;
        position: number;
    } | null, {
        entry_id: string;
        station_id: string;
        position: number;
    } | {
        entry_id: string;
        station_id: string;
        position: number;
    } | null>;
    fetchNearby: (lat: number, lng: number) => Promise<void>;
    fetchStation: (id: string) => Promise<void>;
    joinQueue: (stationId: string, plate: string, spotId: string | undefined, lat: number, lng: number, turnstileToken?: string) => Promise<any>;
    leaveQueue: () => Promise<void>;
    confirmCharge: () => Promise<void>;
}, "fetchNearby" | "fetchStation" | "joinQueue" | "leaveQueue" | "confirmCharge">>;
//# sourceMappingURL=station.d.ts.map