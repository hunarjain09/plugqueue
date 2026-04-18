import { expect, test } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

test.describe('api integration', () => {
  test('GET /api/stations/ea-7leaves returns seed data with 4 stalls', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/stations/ea-7leaves`);
    expect(res.ok()).toBe(true);

    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.id).toBe('ea-7leaves');
    expect(body.data.provider).toBe('Electrify America');
    expect(Array.isArray(body.data.stalls)).toBe(true);
    expect(body.data.stalls).toHaveLength(4);
    expect(body.data.total_stalls).toBe(4);

    const labels = body.data.stalls.map((s: { label: string }) => s.label).sort();
    expect(labels).toEqual(['1', '2', '3', '4']);
  });

  test('GET /api/stations/ea-7leaves exposes a queue array (empty on clean seed)', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/stations/ea-7leaves`);
    const body = await res.json();
    expect(Array.isArray(body.data.queue)).toBe(true);
    expect(typeof body.data.queue_size).toBe('number');
  });

  test('GET /api/stations/nearby requires lat and lng', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/stations/nearby`);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
  });

  test('GET /api/stations/nearby returns ea-7leaves when querying its location', async ({ request }) => {
    const res = await request.get(`${API_BASE}/api/stations/nearby?lat=37.3884&lng=-121.9915&radius=500`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.ok).toBe(true);
    const ids = body.data.map((s: { id: string }) => s.id);
    expect(ids).toContain('ea-7leaves');
  });
});
