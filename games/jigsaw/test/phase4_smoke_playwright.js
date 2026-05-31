const { chromium } = require('playwright');

(async function MAREJIG_phase4Smoke() {
    const baseUrl = process.env.MAREJIG_BASE_URL || 'http://127.0.0.1:4173';
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });

    await page.goto(`${baseUrl}/games/jigsaw/index.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.marejig-level-poster', { timeout: 30000 });
    await page.locator('.marejig-level-poster').first().click();
    await page.waitForSelector('#marejig-screen-game:not([hidden])', { timeout: 45000 });
    await page.waitForFunction(() => {
        const state = window.MAREJIG_State && window.MAREJIG_State.getState();
        return state && state.scene && Object.values(state.scene.groups).some((group) => group.visible && group.hitBounds && group.hitBounds.width > 0);
    }, null, { timeout: 45000 });

    const before = await page.evaluate(() => {
        const scene = window.MAREJIG_State.getState().scene;
        const canvasRect = document.getElementById('marejig-canvas').getBoundingClientRect();
        const group = Object.values(scene.groups).filter((item) => item.visible).sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))[0];
        return {
            id: group.id,
            x: group.x,
            y: group.y,
            moves: scene.progress.moves,
            cx: canvasRect.left + group.hitBounds.x + group.hitBounds.width / 2,
            cy: canvasRect.top + group.hitBounds.y + group.hitBounds.height / 2
        };
    });

    await page.mouse.move(before.cx, before.cy);
    await page.mouse.down();
    await page.mouse.move(before.cx + 42, before.cy + 24, { steps: 6 });
    await page.mouse.up();
    await page.waitForTimeout(350);

    const after = await page.evaluate((groupId) => {
        const scene = window.MAREJIG_State.getState().scene;
        const group = scene.groups[groupId];
        return { x: group && group.x, y: group && group.y, moves: scene.progress.moves };
    }, before.id);

    if (!(after.moves > before.moves)) throw new Error(`moves did not increase: ${before.moves} -> ${after.moves}`);
    if (!(Math.abs(after.x - before.x) > 1 || Math.abs(after.y - before.y) > 1)) throw new Error('group did not move');

    await page.screenshot({ path: 'games/jigsaw/phase4-drag-390x844.png', fullPage: false });
    await browser.close();
    console.log('phase4 smoke ok', { before, after });
}()).catch((error) => {
    console.error(error);
    process.exit(1);
});
