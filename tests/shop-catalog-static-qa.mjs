#!/usr/bin/env node
/** Ticket-01 static QA: published catalog and retired gift ID safety. */
import { existsSync, readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';

const catalog = JSON.parse(readFileSync(new URL('../data/shop.json', import.meta.url)));
const retired = JSON.parse(readFileSync(new URL('../data/retired-shop-gift-ids.json', import.meta.url)));

assert.ok(Array.isArray(catalog), 'shop.json must be an array');
assert.ok(Array.isArray(retired.retiredGiftIds), 'retired gift IDs must be recorded');
assert.ok(Array.isArray(retired.publishedAliases), 'known published aliases must be recorded');
assert.equal(existsSync(new URL('../data/shop-gifts.json', import.meta.url)), false,
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
    assert.match(item.imageUrl, /\/image\/upload\/[^/]+$/, `item ${item.id}: imageUrl must be an original Cloudinary URL`);
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
console.log(`Documented legacy aliases: ${retired.publishedAliases.join(', ')}.`);
console.log(`Catalog QA passed: ${catalog.length} published items, ${retired.retiredGiftIds.length} retired gift IDs.`);
