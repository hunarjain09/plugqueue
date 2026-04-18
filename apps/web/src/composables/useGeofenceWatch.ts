import { ref, watch, onUnmounted, type Ref } from 'vue';
import { useStationStore } from '@/stores/station';

/**
 * Watches the user's position while they're in the queue.
 * If they leave the station's geofence, auto-leaves the queue.
 *
 * Accepts reactive refs so coordinates can be updated after station loads.
 */
export function useGeofenceWatch(
  stationLat: Ref<number | null>,
  stationLng: Ref<number | null>,
  geofenceM: Ref<number>
) {
  const outsideGeofence = ref(false);
  const autoLeft = ref(false);
  let watchId: number | null = null;

  const store = useStationStore();

  function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function start() {
    if (!navigator.geolocation || !store.myEntry) return;
    if (watchId !== null) return; // already watching

    watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        // Skip if station coordinates not loaded yet
        if (stationLat.value === null || stationLng.value === null) return;

        const dist = distanceMeters(
          pos.coords.latitude,
          pos.coords.longitude,
          stationLat.value,
          stationLng.value
        );

        // Add 50m buffer beyond geofence to avoid flapping
        if (dist > geofenceM.value + 50) {
          outsideGeofence.value = true;

          if (store.myEntry && !autoLeft.value) {
            autoLeft.value = true;
            try {
              await store.leaveQueue();
            } catch {}
          }
        } else {
          outsideGeofence.value = false;
        }
      },
      () => {},
      {
        enableHighAccuracy: false,
        maximumAge: 30000,
        timeout: 10000,
      }
    );
  }

  function stop() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      watchId = null;
    }
  }

  // Start when myEntry exists AND station coordinates are available
  watch(
    [() => store.myEntry, stationLat, stationLng],
    ([entry, lat, lng]) => {
      if (entry && lat !== null && lng !== null) {
        start();
      } else if (!entry) {
        stop();
      }
    },
    { immediate: true }
  );

  onUnmounted(stop);

  return { outsideGeofence, autoLeft };
}
