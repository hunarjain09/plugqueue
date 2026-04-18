import { ref } from 'vue';

export function useGeolocation() {
  const lat = ref<number | null>(null);
  const lng = ref<number | null>(null);
  const error = ref<string | null>(null);
  const loading = ref(false);

  async function getCurrentPosition(): Promise<{ lat: number; lng: number }> {
    loading.value = true;
    error.value = null;

    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        error.value = 'Geolocation not supported';
        loading.value = false;
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => {
          lat.value = pos.coords.latitude;
          lng.value = pos.coords.longitude;
          loading.value = false;
          resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        (err) => {
          error.value = err.message;
          loading.value = false;
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
      );
    });
  }

  return { lat, lng, error, loading, getCurrentPosition };
}
