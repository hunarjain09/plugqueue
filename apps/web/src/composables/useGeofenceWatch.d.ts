import { type Ref } from 'vue';
/**
 * Watches the user's position while they're in the queue.
 * If they leave the station's geofence, auto-leaves the queue.
 *
 * Accepts reactive refs so coordinates can be updated after station loads.
 */
export declare function useGeofenceWatch(stationLat: Ref<number | null>, stationLng: Ref<number | null>, geofenceM: Ref<number>): {
    outsideGeofence: Ref<boolean, boolean>;
    autoLeft: Ref<boolean, boolean>;
};
//# sourceMappingURL=useGeofenceWatch.d.ts.map