import assert from 'node:assert/strict';

export async function verifyMlbStandings(page, origin, screenshotPath) {
  // Use both leagues so a decorative layer intercepting either control is detectable.
  const rows = [158, 147].map((id, index) => ({
    id, leagueId: index ? 103 : 104, divisionId: index ? 201 : 205,
    wins: 90, losses: 72, pct: 90 / 162, lastFive: [],
    rank: { all: index + 1, league: 1, division: 1 },
    back: { all: 0, league: 0, division: 0 },
  }));
  const endpoint = origin + '/api/baseball?kind=standings';
  let reads = 0;
  await page.route(endpoint, route => {
    reads += 1;
    return route.fulfill({ json: { rows, season: 2026, recentAvailable: true, fetchedAt: '2026-11-06T12:00:00Z' } });
  });
  try {
    await page.goto(origin + '/?league=MLB&view=standings');
    const panel = page.getByRole('region', { name: 'MLB 球隊戰績排名' });
    await panel.locator('tbody tr').nth(1).waitFor();
    const layout = await panel.evaluate(async el => {
      const image = new Image();
      image.src = '/brand/mlb-night-stands-v1.webp';
      await image.decode();
      const header = el.querySelector('.mlb-standings-intro');
      const table = el.querySelector('[data-slot="table-container"]');
      table.scrollLeft = table.scrollWidth;
      const scrollable = table.scrollWidth <= table.clientWidth || table.scrollLeft > 0;
      table.scrollLeft = 0;
      return {
        scene: getComputedStyle(header, '::before').backgroundImage.includes(image.src),
        surface: getComputedStyle(el).backgroundImage.includes(image.src),
        fits: el.getBoundingClientRect().right <= innerWidth + 1,
        scrollable,
      };
    });
    assert.deepEqual(layout, { scene: true, surface: true, fits: true, scrollable: true });
    await panel.screenshot({ path: screenshotPath });
    await panel.getByRole('combobox').click();
    await page.getByRole('option', { name: '美國聯盟' }).click();
    await panel.locator('tbody tr').nth(1).waitFor({ state: 'detached' });
    assert.equal(await panel.locator('tbody a').getAttribute('href'), '/teams/147');
    const before = reads;
    await Promise.all([
      page.waitForResponse(response => response.url() === endpoint),
      panel.getByRole('button', { name: '更新戰績' }).click(),
    ]);
    assert.ok(reads > before);
  } finally {
    await page.unroute(endpoint);
  }
}
