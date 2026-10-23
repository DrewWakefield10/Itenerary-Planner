import { chromium, expect } from '@playwright/test';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';

const origin = process.env.LAKBAY_TEST_ORIGIN || 'http://localhost:5180';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
await mkdir('work/discover-scroll', { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: width === 390 ? 'reduce' : 'no-preference' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/account/session', route => route.fulfill({ json: { enabled: false, user: null } }));
    await page.route('**/api/discovery', route => route.fulfill({ status: 503, json: { error: 'Unavailable in scroll test' } }));
    await page.addInitScript(() => {
      window.destinationScrolls = [];
      const original = Element.prototype.scrollIntoView;
      Element.prototype.scrollIntoView = function (options) {
        if (this.id === 'discover-spots') window.destinationScrolls.push(options);
        return original.call(this, options);
      };
    });
    await page.goto(origin + '/discover?food=cafe&page=2');
    const spots = page.getByRole('region', { name: 'Spots to discover.' });
    const destination = page.getByRole('button', { name: /^Palawan \d+ locations$/ });
    await expect(page.getByLabel('Food type', { exact: true })).toHaveValue('cafe');
    await expect(spots.getByRole('status')).toContainText('Page 2');
    assert.equal(await page.evaluate(() => window.destinationScrolls.length), 0);
    await destination.click();
    await expect(page.getByLabel('Browsing destination')).toHaveValue('Palawan');
    await expect(spots.getByRole('status')).toContainText('in Palawan / Page 1');
    await expect(page.getByLabel('Food type', { exact: true })).toHaveValue('cafe');
    await expect.poll(async () => Math.abs((await spots.boundingBox()).y - 24)).toBeLessThan(2);
    await expect(destination).toBeFocused();
    assert.deepEqual(await page.evaluate(() => window.destinationScrolls), [{ behavior: width === 390 ? 'instant' : 'smooth', block: 'start' }]);
    await page.screenshot({ path: `work/discover-scroll/selected-${width}.png` });
    // Keyboard activation keeps the existing deselect-to-all behavior and scrolls again.
    await destination.focus();
    await destination.press('Enter');
    await expect(page.getByLabel('Browsing destination')).toHaveValue('all');
    await expect.poll(async () => Math.abs((await spots.boundingBox()).y - 24)).toBeLessThan(2);
    assert.equal(await page.evaluate(() => window.destinationScrolls.length), 2);
    await page.getByLabel('Browsing destination').selectOption('Baguio');
    await expect(spots.getByRole('status')).toContainText('in Baguio / Page 1');
    assert.equal(await page.evaluate(() => window.destinationScrolls.length), 2);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('Destination scroll passed at desktop/mobile: filtered results, page reset, pointer/keyboard toggles, retained focus, reduced motion, no URL-restore/filter auto-scroll and no overflow.');
} finally {
  await browser.close();
}
