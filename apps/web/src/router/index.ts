import { createRouter, createWebHistory } from 'vue-router';

function requireQueueEntry(to: any) {
  const entry = JSON.parse(localStorage.getItem('pq_my_entry') ?? 'null');
  if (!entry || entry.station_id !== to.params.id) {
    return { name: 'station', params: { id: to.params.id } };
  }
}

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      redirect: '/s/ea-7leaves',
    },
    {
      path: '/discover',
      name: 'discover',
      component: () => import('@/views/DiscoverView.vue'),
    },
    {
      path: '/s/:id',
      name: 'station',
      component: () => import('@/views/StationView.vue'),
    },
    {
      path: '/s/:id/join',
      name: 'join',
      component: () => import('@/views/JoinQueueView.vue'),
    },
    {
      path: '/s/:id/queue',
      name: 'queue',
      component: () => import('@/views/LiveQueueView.vue'),
    },
    {
      path: '/s/:id/notify',
      name: 'notify',
      component: () => import('@/views/YourTurnView.vue'),
      beforeEnter: requireQueueEntry,
    },
    {
      path: '/s/:id/update',
      name: 'update-status',
      component: () => import('@/views/UpdateStatusView.vue'),
    },
    {
      path: '/dashboard',
      name: 'dashboard',
      component: () => import('@/views/DashboardView.vue'),
    },
  ],
});
