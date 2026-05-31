let chromium;
try {
    ({ chromium } = require('playwright'));
} catch (error) {
    const message = [
        '[MAREJIG] Playwright no está instalado; smoke browser omitido explícitamente.',
        'Instalación reproducible:',
        '  npm install --no-save playwright',
        '  npx playwright install chromium',
        '  MAREJIG_REQUIRE_PLAYWRIGHT=1 node games/jigsaw/test/phase7_smoke_playwright.js',
        'Para convertir la omisión en fallo de CI, define MAREJIG_REQUIRE_PLAYWRIGHT=1.'
    ].join('\n');
    if (process.env.MAREJIG_REQUIRE_PLAYWRIGHT === '1' || process.env.CI === 'true') {
        console.error(message);
        console.error(error.message);
        process.exit(1);
    }
    console.warn(message);
    process.exit(0);
}

(async function MAREJIG_phase7Smoke() {
    const baseUrl = process.env.MAREJIG_BASE_URL || 'http://127.0.0.1:4173';
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
    await page.goto(`${baseUrl}/games/jigsaw/index.html`, { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
        ['MAREJIG_completedLevels_v1', 'MAREJIG_levelProgress_v1', 'MAREJIG_activeSave_v1', 'MAREJIG_settings_v1'].forEach((key) => localStorage.removeItem(key));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.marejig-level-card', { timeout: 30000 });
    const initialCards = await page.locator('.marejig-level-card').count();
    if (initialCards > 12) throw new Error(`batch inicial demasiado grande: ${initialCards}`);
    await page.locator('.marejig-level-card').first().click();
    await page.waitForSelector('#marejig-screen-game:not([hidden])', { timeout: 45000 });
    await page.waitForFunction(() => window.MAREJIG_State && window.MAREJIG_State.getState().scene, null, { timeout: 45000 });
    const fullscreen = await page.evaluate(() => {
        function read(selector) {
            const element = document.querySelector(selector);
            const rect = element.getBoundingClientRect();
            return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, position: getComputedStyle(element).position };
        }
        return { viewport: { width: innerWidth, height: innerHeight }, layout: read('.marejig-game-layout'), wrap: read('.marejig-canvas-wrap'), canvas: read('.marejig-canvas'), scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight) };
    });
    if (fullscreen.layout.position !== 'fixed' || fullscreen.wrap.position !== 'absolute' || fullscreen.canvas.position !== 'absolute') throw new Error(`layout gameplay no aislado: ${JSON.stringify(fullscreen)}`);
    if ([fullscreen.layout, fullscreen.wrap, fullscreen.canvas].some((box) => box.x !== 0 || box.y !== 0 || box.width !== fullscreen.viewport.width || box.height !== fullscreen.viewport.height)) throw new Error(`canvas no ocupa viewport completo: ${JSON.stringify(fullscreen)}`);
    if (fullscreen.scrollHeight > fullscreen.viewport.height) throw new Error(`scroll vertical durante gameplay: ${JSON.stringify(fullscreen)}`);
    await page.screenshot({ path: '/tmp/marejig-gameplay-390x844.png', fullPage: false });
    const completedId = await page.evaluate(() => window.MAREJIG_State.getState().selectedLevelId);
    if (await page.locator('#marejig-hint-button').count()) throw new Error('No debe existir botón Pista');
    await page.waitForFunction(() => {
        const state = window.MAREJIG_State.getState();
        return state.scene && !state.scene.ui.hint && !Object.prototype.hasOwnProperty.call(state.scene.progress, 'hintsUsed');
    }, null, { timeout: 5000 });
    await page.evaluate(() => window.MAREJIG_Main.completeCurrentForDebug());
    await page.waitForSelector('#marejig-victory-modal:not([hidden])', { timeout: 10000 });
    await page.locator('#marejig-victory-levels').click();
    await page.waitForSelector('#marejig-screen-menu:not([hidden])', { timeout: 10000 });
    const stillVisible = await page.locator(`[data-marejig-level-id="${completedId}"]`).count();
    if (stillVisible !== 0) throw new Error(`nivel completado todavía visible: ${completedId}`);
    await page.screenshot({ path: 'games/jigsaw/phase7-menu-after-complete-390x844.png', fullPage: false });
    await browser.close();
    console.log('phase7 smoke ok');
}()).catch((error) => {
    console.error(error);
    process.exit(1);
});
