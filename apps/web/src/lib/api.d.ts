export declare class ApiError extends Error {
    code?: string | undefined;
    status?: number | undefined;
    constructor(message: string, code?: string | undefined, status?: number | undefined);
}
export declare function getDeviceHash(): string;
export declare const api: {
    getStationsNearby(lat: number, lng: number, radius?: number): Promise<any[]>;
    getStation(id: string): Promise<any>;
    joinQueue(stationId: string, data: {
        plate: string;
        spot_id?: string;
        push_sub_id?: string;
        lat: number;
        lng: number;
        turnstile_token?: string;
    }): Promise<any>;
    leaveQueue(entryId: string): Promise<any>;
    confirmCharge(entryId: string): Promise<any>;
    flagEntry(queueEntryId: string, reason?: string): Promise<any>;
    updateStallStatus(stationId: string, stalls: {
        label: string;
        status: string;
    }[], observedAt: string): Promise<any>;
    subscribePush(subscription: {
        id: string;
        endpoint: string;
        p256dh: string;
        auth: string;
    }): Promise<any>;
    getVapidKey(): Promise<{
        key: string;
    }>;
};
//# sourceMappingURL=api.d.ts.map