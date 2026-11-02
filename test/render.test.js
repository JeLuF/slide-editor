'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pngSize } = require('./helpers.js');
const S = require('../src/slide-node.js');

const example = name => fs.readFileSync(path.join(__dirname, '..', 'examples', 'slides', name), 'utf8');

test('PNG at slide size, smaller previews, JPEG', async () => {
  const doc = S.createSlide({ width: 1280, height: 720, background: { type: 'radial', colors: ['#1e3a8a', '#020617'] } });
  await doc.add({ type: 'ngon', sides: 5, cornerRadius: 25, fill: '#facc15' });
  assert.deepEqual(pngSize(S.toImageBuffer(doc)), { width: 1280, height: 720 });
  assert.deepEqual(pngSize(S.toImageBuffer(doc, { maxWidth: 320 })), { width: 320, height: 180 });
  const jpg = S.toImageBuffer(doc, { format: 'jpeg', quality: 0.8 });
  assert.equal(jpg[0], 0xff);
  assert.equal(jpg[1], 0xd8);
});

test('transparent background stays transparent', async () => {
  const doc = S.createSlide({ width: 200, height: 100, background: 'transparent' });
  const { createCanvas, loadImage } = require('canvas');
  const img = await loadImage(S.toImageBuffer(doc));
  const ctx = createCanvas(200, 100).getContext('2d');
  ctx.drawImage(img, 0, 0);
  assert.equal(ctx.getImageData(5, 5, 1, 1).data[3], 0);
});

test('SVG export: rounded polygons as paths, plain ones as polygons, no custom tags', async () => {
  const doc = S.createSlide();
  await doc.add({ type: 'ngon', sides: 6, cornerRadius: 30 });
  await doc.add({ type: 'ngon', sides: 4 });
  await doc.add({ type: 'text', text: 'Hello' });
  const svg = S.toSVGString(doc);
  assert.match(svg, /^<\?xml|^<svg/);
  assert.match(svg, /<path[^>]*d="M[^"]*A/);
  assert.match(svg, /<polygon/);
  assert.doesNotMatch(svg, /<sengon/i);
  assert.match(svg, /viewBox="0 0 1920 1080"/);
});

test('example slides load and render', async () => {
  for (const name of ['were-coming-back.json', 'be-right-back.json']) {
    const json = example(name);
    assert.deepEqual(pngSize(await S.renderPNG(json, { maxWidth: 480 })), { width: 480, height: 270 });
    const doc = await S.loadSlide(json);
    assert.ok(doc.describe().objects.length > 3);
    assert.match(await S.renderSVG(json), /<svg/);
  }
});

test('fonts must be .ttf/.otf', () => {
  assert.throws(() => S.registerFont('font.woff2', { family: 'X' }), /\.ttf or \.otf/);
  assert.throws(() => S.registerFont('missing.ttf', { family: 'X' }), /not found/);
});
