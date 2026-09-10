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

assert.match(indexHtml, /id="btn-toggle-collection"/, 'the Tienda/Colección switch must exist');
assert.match(indexHtml, /id="shop-collection"[^>]*aria-hidden="true"/, 'the collection host must start hidden');
assert.match(indexHtml, /data-profile-target="promotions"/, 'promotions must be reachable from Perfil');
assert.match(indexHtml, /id="profile-promotions"[^>]*data-profile-panel="promotions"/, 'the dedicated promotions panel must exist');
assert.match(shopLogic, /let _collectionMounted = false/, 'Colección must have an explicit lazy-mount flag');
assert.match(shopLogic, /function _mountCollection\(\)/, 'Colección must be mounted on demand');
assert.match(shopLogic, /toLocaleLowerCase\(\)/, 'Colección search must normalize names locally');
assert.match(shopLogic, /getThumbnailUrl\(/, 'Cloudinary thumbnails must be derived centrally');
assert.match(shopLogic, /getImageDownloadUrl\(/, 'Cloudinary image downloads must be derived centrally');
assert.match(shopLogic, /fl_attachment/, 'image downloads must force attachment delivery');
assert.match(shopLogic, /pointerdown/, 'shop cards must use delegated Pointer Events');
assert.match(styles, /\.collection-search-input/, 'Collection search styles must be present');

console.log(`Documented legacy aliases: ${retired.publishedAliases.join(', ')}.`);
console.log(`Catalog and shop architecture QA passed: ${catalog.length} published items, ${retired.retiredGiftIds.length} retired gift IDs.`);
