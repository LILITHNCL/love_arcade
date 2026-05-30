const { chromium } = require('playwright');

(async function MAREJIG_phase6Smoke() {
    const baseUrl = process.env.MAREJIG_BASE_URL || 'http://127.0.0.1:4173';
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto(`${baseUrl}/games/jigsaw/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        ['MAREJIG_completedLevels_v1', 'MAREJIG_levelProgress_v1', 'MAREJIG_activeSave_v1', 'MAREJIG_settings_v1'].forEach((key) => localStorage.removeItem(key));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.marejig-level-card', { timeout: 30000 });
    await page.locator('.marejig-level-card').first().click();
    await page.waitForSelector('#marejig-screen-game:not([hidden])', { timeout: 45000 });
    await page.waitForFunction(() => window.MAREJIG_State && window.MAREJIG_State.getState().scene, null, { timeout: 45000 });
    if (await page.locator('#marejig-hint-button').count()) throw new Error('No debe existir botón Pista');
    await page.waitForFunction(() => {
        const state = window.MAREJIG_State.getState();
        return state.scene && !state.scene.ui.hint && !Object.prototype.hasOwnProperty.call(state.scene.progress, 'hintsUsed');
    }, null, { timeout: 5000 });
    await page.screenshot({ path: 'games/jigsaw/phase6-sandbox-390x844.png', fullPage: false });

    await page.locator('#marejig-pause-button').click();
    await page.locator('#marejig-pause-reset').click();
    await page.waitForSelector('#marejig-confirm-reset-modal:not([hidden])', { timeout: 5000 });
    await page.screenshot({ path: 'games/jigsaw/phase6-reset-confirm-390x844.png', fullPage: false });
    await page.locator('#marejig-reset-confirm').click();
    await page.waitForSelector('#marejig-screen-game:not([hidden])', { timeout: 45000 });
    await page.waitForFunction(() => {
        const state = window.MAREJIG_State.getState();
        return state.scene && !Object.prototype.hasOwnProperty.call(state.scene.progress, 'hintsUsed') && state.scene.progress.moves === 0;
    }, null, { timeout: 10000 });

    await page.locator('#marejig-pause-button').click();
    await page.locator('#marejig-pause-help').click();
    await page.waitForSelector('#marejig-help-modal:not([hidden])', { timeout: 5000 });
    await page.screenshot({ path: 'games/jigsaw/phase6-help-modal-390x844.png', fullPage: false });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.getElementById('marejig-help-modal').hidden, null, { timeout: 5000 });

    await page.evaluate(() => window.MAREJIG_Main.completeCurrentForDebug());
    await page.waitForSelector('#marejig-victory-modal:not([hidden])', { timeout: 10000 });
    await browser.close();
    console.log('phase6 smoke ok');
}()).catch((error) => {
    console.error(error);
    process.exit(1);
});
