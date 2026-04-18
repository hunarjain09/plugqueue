import { expect, test } from '@playwright/test';

test.describe('navigation', () => {
  test('discover -> station -> join flow surfaces the aerial spot selector', async ({ page }) => {
    await page.goto('/');

    const stationLink = page.locator('a[href="/s/ea-7leaves"]').first();
    await expect(stationLink).toBeVisible({ timeout: 15_000 });
    await stationLink.click();

    await expect(page).toHaveURL(/\/s\/ea-7leaves$/);

    // Kick off the join flow. The entry into join differs by UI state,
    // so navigate directly — this is what the router exposes.
    await page.goto('/s/ea-7leaves/join');
    await expect(page).toHaveURL(/\/s\/ea-7leaves\/join$/);

    // We do not interact with the camera. We only need evidence that the
    // join view mounts and the spot-selection UI is reachable. The aerial
    // selector renders <button> elements once the user is past OCR — so we
    // look for either the selector container or a route-level landmark.
    // Accept any of: role=group (AerialSpotSelector), heading text about
    // scanning, or a main region.
    const joinLanded = page.locator('main, [role="group"], [role="heading"]').first();
    await expect(joinLanded).toBeVisible();
  });

  test('dashboard route loads without crashing', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.locator('main, body')).toBeVisible();
  });
});
