export declare function useWebSocket(stationId: string): {
    connected: import("vue").Ref<boolean, boolean>;
    connectionLost: import("vue").Ref<boolean, boolean>;
    queue: import("vue").Ref<any[], any[]>;
    stalls: import("vue").Ref<any[], any[]>;
    disconnect: () => void;
    retry: () => void;
};
//# sourceMappingURL=useWebSocket.d.ts.map