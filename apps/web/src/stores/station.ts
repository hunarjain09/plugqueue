import { defineStore } from 'pinia';
import { ref } from 'vue';
import { api } from '@/lib/api';

export const useStationStore = defineStore('station', () => {
  const station = ref<any>(null);
  const nearbyStations = ref<any[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  // Current user's queue entry (persisted in localStorage)
  const myEntry = ref<{ entry_id: string; station_id: string; position: number } | null>(
    JSON.parse(localStorage.getItem('pq_my_entry') ?? 'null')
  );

  function saveMyEntry(entry: typeof myEntry.value) {
    myEntry.value = entry;
    if (entry) {
      localStorage.setItem('pq_my_entry', JSON.stringify(entry));
    } else {
      localStorage.removeItem('pq_my_entry');
    }
  }

  /** Validate the stored entry against the server on startup. Clear if stale. */
  async function validateMyEntry() {
    if (!myEntry.value) return;
    try {
      const stationData = await api.getStation(myEntry.value.station_id);
      const found = stationData.queue?.some(
        (q: any) => q.id === myEntry.value!.entry_id
      );
      if (!found) {
        saveMyEntry(null); // Entry no longer exists on server
      }
    } catch {
      // Network error — keep the entry for now, will validate later
    }
  }

  // Validate on store creation (async, non-blocking)
  validateMyEntry();

  async function fetchNearby(lat: number, lng: number) {
    loading.value = true;
    error.value = null;
    try {
      nearbyStations.value = await api.getStationsNearby(lat, lng);
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function fetchStation(id: string) {
    // Clear stale data immediately so the UI doesn't flash old station info
    if (station.value?.id !== id) {
      station.value = null;
    }
    loading.value = true;
    error.value = null;
    try {
      station.value = await api.getStation(id);
    } catch (err: any) {
      error.value = err.message;
    } finally {
      loading.value = false;
    }
  }

  async function joinQueue(stationId: string, plate: string, waitingSpotId: string | undefined, lat: number, lng: number, turnstileToken?: string) {
    const result = await api.joinQueue(stationId, { plate, waiting_spot_id: waitingSpotId, lat, lng, turnstile_token: turnstileToken });
    saveMyEntry({ entry_id: result.entry_id, station_id: stationId, position: result.position });
    return result;
  }

  async function leaveQueue() {
    if (!myEntry.value) return;
    await api.leaveQueue(myEntry.value.entry_id);
    saveMyEntry(null);
  }

  async function confirmCharge() {
    if (!myEntry.value) return;
    await api.confirmCharge(myEntry.value.entry_id);
    saveMyEntry(null);
  }

  return {
    station,
    nearbyStations,
    loading,
    error,
    myEntry,
    fetchNearby,
    fetchStation,
    joinQueue,
    leaveQueue,
    confirmCharge,
  };
});
