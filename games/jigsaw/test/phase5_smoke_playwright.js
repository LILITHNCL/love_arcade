const { chromium } = require('playwright');

(async function MAREJIG_phase5Smoke() {
    const baseUrl = process.env.MAREJIG_BASE_URL || 'http://127.0.0.1:4173';
    const completeCalls = [];
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.exposeFunction('__marejigRecordComplete', (args) => { completeCalls.push(args); });
    await page.addInitScript(() => {
        Object.defineProperty(window, 'GameCenter', {
            configurable: true,
            value: {
                ['complete' + 'Level'](gameId, rewardLevelId, coins) {
                    window.__marejigRecordComplete([gameId, rewardLevelId, coins]);
                    return { paid: true };
                }
            }
        });
    });

    await page.goto(`${baseUrl}/games/jigsaw/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        ['MAREJIG_completedLevels_v1', 'MAREJIG_levelProgress_v1', 'MAREJIG_activeSave_v1', 'MAREJIG_settings_v1'].forEach((key) => localStorage.removeItem(key));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.marejig-level-card', { timeout: 30000 });
    const firstLevelId = await page.locator('.marejig-level-card').first().getAttribute('data-marejig-level-id');
    await page.locator('.marejig-level-card').first().click();
    await page.waitForSelector('#marejig-screen-game:not([hidden])', { timeout: 45000 });
    await page.evaluate(() => {
        Object.defineProperty(window, 'GameCenter', {
            configurable: true,
            value: {
                ['complete' + 'Level'](gameId, rewardLevelId, coins) {
                    window.__marejigRecordComplete([gameId, rewardLevelId, coins]);
                    return { paid: true };
                }
            }
        });
    });
    await page.waitForFunction(() => window.MAREJIG_State && window.MAREJIG_State.getState().scene, null, { timeout: 45000 });
    await page.evaluate(() => window.MAREJIG_Main.completeCurrentForDebug());
    await page.waitForSelector('#marejig-victory-modal:not([hidden])', { timeout: 10000 });
    await page.waitForFunction(() => localStorage.getItem('MAREJIG_completedLevels_v1') && !localStorage.getItem('MAREJIG_activeSave_v1'));
    if (completeCalls.length !== 1) throw new Error(`expected one GameCenter call, got ${completeCalls.length}`);
    if (completeCalls[0][0] !== 'jigsaw') throw new Error('wrong game id');
    if (completeCalls[0][1] !== `level_${firstLevelId}`) throw new Error('wrong reward level id');
    await page.screenshot({ path: 'games/jigsaw/phase5-victory-390x844.png', fullPage: false });
    await page.locator('#marejig-victory-levels').click();
    await page.waitForSelector('#marejig-screen-menu:not([hidden])', { timeout: 10000 });
    const stillPresent = await page.locator(`.marejig-level-card[data-marejig-level-id="${firstLevelId}"]`).count();
    if (stillPresent !== 0) throw new Error('completed level still appears in pending menu');
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#marejig-screen-menu:not([hidden])', { timeout: 10000 });
    if (completeCalls.length !== 1) throw new Error('reload duplicated GameCenter completion');
    await browser.close();
    console.log('phase5 smoke ok', { firstLevelId, completeCalls });
}()).catch((error) => {
    console.error(error);
    process.exit(1);
});
