import { expect, test } from '@playwright/test';

const API_BASE = process.env.PLAYWRIGHT_API_URL ?? 'http://localhost:3001';

test.describe('smoke', () => {
  test('landing page loads with PlugQueue title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/PlugQueue/i);
    await expect(page.getByRole('heading', { name: /find a charger/i })).toBeVisible();
  });

  test('seed station ea-7leaves is reachable via the station card', async ({ page }) => {
    await page.goto('/');
    // Geolocation falls back to San Jose area — the seed station is nearby.
    const stationLink = page.locator('a[href="/s/ea-7leaves"]').first();
    await expect(stationLink).toBeVisible({ timeout: 15_000 });
    await expect(stationLink).toContainText(/Electrify America/i);
  });

  test('API /health returns ok', async ({ request }) => {
    const res = await request.get(`${API_BASE}/health`);
    expect(res.ok()).toBe(true);
    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.timestamp).toBe('string');
  });
});
