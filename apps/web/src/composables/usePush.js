import { ref } from 'vue';
import { api } from '@/lib/api';
export function usePush() {
    const permission = ref(typeof Notification !== 'undefined' ? Notification.permission : 'denied');
    const subscribed = ref(false);
    function urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; i++) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }
    async function subscribe() {
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
            return null;
        }
        const perm = await Notification.requestPermission();
        permission.value = perm;
        if (perm !== 'granted')
            return null;
        const reg = await navigator.serviceWorker.ready;
        const { key } = await api.getVapidKey();
        if (!key)
            return null;
        const sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
        });
        const subJson = sub.toJSON();
        const subId = btoa(subJson.endpoint).slice(0, 64);
        await api.subscribePush({
            id: subId,
            endpoint: subJson.endpoint,
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
        });
        subscribed.value = true;
        return subId;
    }
    return { permission, subscribed, subscribe };
}
//# sourceMappingURL=usePush.js.map