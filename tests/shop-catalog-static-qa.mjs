#!/usr/bin/env node
/**
 * Static QA for the published shop catalog and the Ticket-08 shop architecture.
 * Run with: node tests/shop-catalog-static-qa.mjs
 */
import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const catalog = JSON.parse(read('data/shop.json'));
const retired = JSON.parse(read('data/retired-shop-gift-ids.json'));
const indexHtml = read('index.html');
const shopLogic = read('js/shop-logic.js');
const styles = read('styles.css');

assert.ok(Array.isArray(catalog), 'shop.json must be an array');
assert.ok(Array.isArray(retired.retiredGiftIds), 'retired gift IDs must be recorded');
assert.ok(Array.isArray(retired.publishedAliases), 'known published aliases must be recorded');
assert.equal(existsSync(new URL('data/shop-gifts.json', root)), false,
    'the retired gift catalog must not be published');

const publishedIds = new Set();
for (const [index, item] of catalog.entries()) {
    assert.ok(Number.isInteger(item.id) && item.id >= 0, `item ${index}: id must be a non-negative integer`);
    assert.equal(publishedIds.has(item.id), false, `item ${index}: duplicate id ${item.id}`);
    publishedIds.add(item.id);
    assert.ok(typeof item.name === 'string' && item.name.trim(), `item ${item.id}: name is required`);
    assert.ok(Number.isInteger(item.price) && item.price >= 0, `item ${item.id}: price must be a non-negative integer`);
    assert.equal(item.category, 'art', `item ${item.id}: category must be art`);
    assert.ok(['image', 'file'].includes(item.type), `item ${item.id}: type must be image or file`);
    assert.ok(typeof item.imageUrl === 'string' && item.imageUrl.startsWith('https://res.cloudinary.com/'),
        `item ${item.id}: imageUrl must be a Cloudinary URL`);
    assert.match(item.imageUrl, /\/image\/upload\/[^/?]+$/, `item ${item.id}: imageUrl must be an original Cloudinary URL`);
    assert.equal('tags' in item || 'file' in item || 'requirements' in item || item.category === 'gift', false,
        `item ${item.id}: legacy catalog fields are forbidden`);
    assert.equal(item.type === 'file', Boolean(item.downloadUrl), `item ${item.id}: file items need downloadUrl`);
}

const aliases = new Set(retired.publishedAliases);
for (const id of retired.retiredGiftIds) {
    assert.ok(Number.isInteger(id), 'retired gift IDs must be integers');
    const collision = publishedIds.has(id);
    assert.equal(collision, aliases.has(id), `retired gift ID ${id} has an undocumented catalog collision`);
}
for (const id of aliases) {
    assert.ok(retired.retiredGiftIds.includes(id), `published alias ${id} is not retired`);
}

for (const [sourceName, source] of [['index.html', indexHtml], ['js/shop-logic.js', shopLogic], ['styles.css', styles]]) {
    for (const legacy of ['shop-gifts.json', 'gift_claimed', 'la:levelcomplete', 'la_gift_claim_order', 'sale-banner']) {
        assert.equal(source.includes(legacy), false, `${sourceName} must not reference retired ${legacy}`);
    }
}

for (const legacyMarkup of ['id="search-input"', 'id="search-clear"', 'id="filter-pills"', 'class="shop-tab"']) {
    assert.equal(indexHtml.includes(legacyMarkup), false, `index.html must not contain legacy ${legacyMarkup}`);
}
for (const legacyLogic of ['activeFilter', 'filterItems', 'resetFilters', '_isGiftItem', '_renderGiftCarousel']) {
    assert.equal(shopLogic.includes(legacyLogic), false, `shop-logic.js must not contain legacy ${legacyLogic}`);
}
assert.doesNotMatch(shopLogic, /allItems\.indexOf\(item\)/,
    'shop-logic.js must not resolve catalog position via indexOf; it must use the precomputed per-id descriptor');
assert.match(shopLogic, /children\.length/,
    'incremental collection inserts must balance by actual physical rail child count, not by a recomputed global position');

assert.match(indexHtml, /id="btn-toggle-collection"/, 'the Tienda/Colección switch must exist');
assert.match(indexHtml, /id="shop-collection"[^>]*aria-hidden="true"/, 'the collection host must start hidden');
assert.match(indexHtml, /data-profile-target="promotions"/, 'promotions must be reachable from Perfil');
assert.match(indexHtml, /id="profile-promotions"[^>]*data-profile-panel="promotions"/, 'the dedicated promotions panel must exist');
assert.match(shopLogic, /let _collectionMounted = false/, 'Colección must have an explicit lazy-mount flag');
assert.match(shopLogic, /let _preloadObserver = null;/, 'shop preload must retain an explicit observer lifecycle handle');
assert.match(shopLogic, /function _mountCollection\(\)/, 'Colección must be mounted on demand');
assert.match(shopLogic, /toLocaleLowerCase\(\)/, 'Colección search must normalize names locally');
assert.match(shopLogic, /getThumbnailUrl\(/, 'Cloudinary thumbnails must be derived centrally');
assert.match(shopLogic, /getImageDownloadUrl\(/, 'Cloudinary image downloads must be derived centrally');
assert.match(shopLogic, /fl_attachment/, 'image downloads must force attachment delivery');
assert.match(shopLogic, /pointerdown/, 'shop cards must use delegated Pointer Events');
assert.match(styles, /\.collection-search-input/, 'Collection search styles must be present');
const shopVisualCardRule = styles.match(/\.shop-visual-card\s*\{([^}]*)}/)?.[1] || '';
assert.match(styles, /--radius-card-product:\s*24px;/,
    'product cards must use the dedicated 24 px radius token');
assert.match(shopVisualCardRule, /border-radius:\s*var\(--radius-card-product\);/,
    'shop product cards must retain a tokenized border-radius fallback');
assert.match(styles, /@supports \(corner-shape:\s*squircle\)[\s\S]*?\.shop-visual-card,[\s\S]*?corner-shape:\s*squircle;/,
    'product cards must progressively enhance to native squircle corners');
assert.match(styles, /\.game-card\s*\{[\s\S]*?border-radius:\s*var\(--radius-card-product\);/,
    'game cards must share the product-card radius');
assert.match(styles, /\.card-cover\s*\{[\s\S]*?border-radius:\s*var\(--radius-card-product\) var\(--radius-card-product\) 0 0;/,
    'game covers must align their upper corners with the product-card radius');
assert.match(shopVisualCardRule, /(?:^|\n)\s*border:\s*none;/,
    'shop product cards must remove the permanent accent border');
assert.doesNotMatch(shopVisualCardRule, /background:\s*var\(--accent-soft\);/,
    'shop product cards must not keep the permanent accent background');
assert.match(styles, /\.shop-visual-card--loading\s*\{\s*background:\s*var\(--solid-surface-deep\);\s*\}/,
    'shop product cards must use a neutral loading placeholder');
assert.match(styles, /data-aspect-ratio="9:16"[^\n]*aspect-ratio:\s*9\s*\/\s*16;/,
    'narrow collection thumbnails must retain their 9:16 geometry');
assert.match(styles, /data-aspect-ratio="3:4"[^\n]*aspect-ratio:\s*3\s*\/\s*4;/,
    'standard shop thumbnails must retain their 3:4 geometry');
assert.match(styles, /\.shop-sale-pill\s*\{[\s\S]*?top:\s*8px;[\s\S]*?left:\s*8px;/,
    'the sale pill must keep its 8 px inset inside the larger product corner');
assert.match(shopLogic, /shop-visual-card shop-visual-card--loading/,
    'shop product cards must begin with the neutral loading placeholder');
assert.match(shopLogic, /button\.classList\.remove\('shop-visual-card--loading'\)/,
    'shop product cards must clear the loading placeholder after load or error');

// Card previews share one delegated activation contract. Native button clicks
// cover mouse/tap plus Enter/Space; Pointer Events only discard real drags.
assert.match(shopLogic, /function _bindCardPreviewActivation\(container, openItem\)/,
    'Tienda and Colección must share an explicit card preview activation helper');
assert.match(shopLogic, /_bindCardPreviewActivation\(container, openPreviewModal\)/,
    'shop container must bind the shared helper');
assert.match(shopLogic, /_bindCardPreviewActivation\(grid, openCollectionItemModal\)/,
    'collection container must bind the shared helper');
assert.doesNotMatch(shopLogic, /grid\.addEventListener\('click'/,
    'collection must not retain a per-container click implementation');
assert.match(shopLogic, /const dragThreshold = 10;/,
    'the shared activation helper must keep a documented 10 px drag threshold');
assert.match(shopLogic, /if \(gesture\?\.dragged\) return;/,
    'a vertical/horizontal drag must not open a preview');
assert.match(shopLogic, /container\.contains\(visualCard\)/,
    'delegated activation must reject cards outside its bound container');
assert.match(shopLogic, /allItems\.find\(candidate => candidate\.id === Number\(visualCard\.dataset\.itemId\)\)/,
    'activation must resolve a still-existing item from data-item-id');
assert.doesNotMatch(shopLogic, /event\.detail\s*!==\s*0/,
    'keyboard activation must not be filtered out by click detail');
const activationHelper = shopLogic.slice(
    shopLogic.indexOf('function _bindCardPreviewActivation'),
    shopLogic.indexOf('// ── Render: Colección', shopLogic.indexOf('function _bindCardPreviewActivation'))
);
assert.doesNotMatch(activationHelper, /preventDefault|addEventListener\('scroll'/,
    'preview activation must neither cancel scrolling nor use global scroll cancellation');
assert.equal((activationHelper.match(/addEventListener\('click'/g) || []).length, 1,
    'each container must have exactly one click route, so a tap opens one preview');
assert.match(shopLogic, /El click nativo de <button> cubre puntero, Enter y Espacio/,
    'the helper must preserve native Enter/Space button activation');
assert.match(shopLogic, /function _getPreviewImageUrl\(item\)/,
    'preview URL selection must be centralized');
assert.match(shopLogic, /const url = _getPreviewImageUrl\(item\);/,
    'shop preloading must request the same high-resolution URL used by the preview');
assert.match(shopLogic, /image\.src = _getPreviewImageUrl\(item\);/,
    'both preview renderers must use the selected high-resolution URL');
assert.match(shopLogic, /image\.decoding = 'async';/,
    'preview images must keep asynchronous decoding');

// ── Regresión: independencia real entre ratio (por ID) y rail (por posición) ──
// shop-logic.js corre en el navegador, pero _aspectRatioForId() es una función
// pura sin DOM. La extraemos del código fuente y la ejecutamos aquí para probar
// el algoritmo de verdad, no solo su presencia textual.
const aspectRatioFnMatch = shopLogic.match(/function _aspectRatioForId\([^)]*\)\s*{[\s\S]*?\n}/);
assert.ok(aspectRatioFnMatch, '_aspectRatioForId must exist as a standalone, extractable function');

assert.doesNotMatch(aspectRatioFnMatch[0], /id\s*%\s*2/,
    '_aspectRatioForId must not derive the ratio from a direct modulo of id: for contiguous/dense id ' +
    'ranges (the common case — the full catalog, or a collection bought roughly in order) this correlates ' +
    'perfectly with any position-based alternating rail, reproducing the original single-ratio-per-column bug.');

const _aspectRatioForId = new Function(`${aspectRatioFnMatch[0]}\nreturn _aspectRatioForId;`)();

// Distribución razonable sobre un rango grande — no debe degenerar a casi-todo-un-ratio.
const sampleIds = Array.from({ length: 500 }, (_, i) => i + 1);
const nineBySixteenCount = sampleIds.filter(id => _aspectRatioForId(id) === '9:16').length;
assert.ok(nineBySixteenCount > 150 && nineBySixteenCount < 350,
    '_aspectRatioForId must distribute roughly evenly across a large contiguous id range');

// Regresión directa del bug real: emparejar el ratio con un rail que alterna
// estrictamente cada ítem (el comportamiento real de _describeVisibleItems sobre
// un rango de ids sin huecos) y comprobar que ninguna columna resulta monocromática.
for (const windowSize of [20, 41, 96]) {
    const windowIds = Array.from({ length: windowSize }, (_, i) => i + 1);
    const rails = [[], []];
    windowIds.forEach((id, index) => rails[index % 2].push(_aspectRatioForId(id)));
    for (const [railIndex, rail] of rails.entries()) {
        assert.ok(new Set(rail).size > 1,
            `a contiguous run of ${windowSize} ids must not produce a single-ratio rail ${railIndex} ` +
            `(regression for the id-parity / position-parity correlation bug)`);
    }
}

console.log(`Documented legacy aliases: ${retired.publishedAliases.join(', ')}.`);
console.log(`Catalog and shop architecture QA passed: ${catalog.length} published items, ${retired.retiredGiftIds.length} retired gift IDs.`);
