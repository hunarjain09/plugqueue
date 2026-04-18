type EventType = 'page_view' | 'flow_step' | 'flow_complete' | 'flow_abandon' | 'interaction' | 'error' | 'performance' | 'feature_use';
export declare function trackEvent(type: EventType, name: string, opts?: {
    stationId?: string;
    page?: string;
    properties?: Record<string, unknown>;
}): void;
/** Track a page view — call from each view's onMounted */
export declare function trackPageView(page: string, stationId?: string): void;
/** Track a flow step (join queue funnel) */
export declare function trackFlowStep(name: string, stationId?: string, properties?: Record<string, unknown>): void;
/** Track flow completion */
export declare function trackFlowComplete(name: string, stationId?: string): void;
/** Track flow abandonment */
export declare function trackFlowAbandon(name: string, stationId?: string, properties?: Record<string, unknown>): void;
/** Track a button click or interaction */
export declare function trackInteraction(name: string, page: string, stationId?: string): void;
/** Track an error */
export declare function trackError(name: string, page: string, properties?: Record<string, unknown>): void;
/** Track feature usage (camera, OCR, push, paste) */
export declare function trackFeatureUse(name: string, stationId?: string, properties?: Record<string, unknown>): void;
/** Track a performance metric (ms) */
export declare function trackPerformance(name: string, durationMs: number, page?: string): void;
/** Submit user feedback */
export declare function submitFeedback(data: {
    rating?: number;
    category: string;
    comment?: string;
    stationId?: string;
    page?: string;
}): Promise<void>;
export {};
//# sourceMappingURL=useAnalytics.d.ts.map