"use strict";
// Google Fonts on the server (prepareFonts): all network access is mocked with a font from test/fixtures.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const S = require("../src/slide-node.js");

const TTF = fs.readFileSync(
  path.join(__dirname, "fixtures", "BebasNeue-Regular.ttf"),
);
const { parseGoogleSpec, parseFontFaces } = S._googleFonts;

const importCode = (spec) =>
  `<style>@import url('https://fonts.googleapis.com/css2?family=${spec.replace(/ /g, "+")}&display=swap');</style>`;

/** A fake Google: CSS with one face per requested weight/style, all files are the fixture font. */
function mockGoogle(opts = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push(url);
    if (opts.fail) throw new Error("network down");
    const u = new URL(url);
    if (u.hostname === "fonts.googleapis.com") {
      const spec = decodeURIComponent(u.searchParams.get("family"));
      const m = /^([^:]+):(.+)@(.+)$/.exec(spec);
      const faces = [];
      if (!m) faces.push([400, "normal"]);
      else {
        const axes = m[2].split(",");
        m[3].split(";").forEach((t) => {
          const v = t.split(",");
          const get = (a, d) => (axes.includes(a) ? v[axes.indexOf(a)] : d);
          faces.push([
            parseInt(get("wght", 400), 10),
            get("ital", "0") === "1" ? "italic" : "normal",
          ]);
        });
      }
      const family = spec.split(":")[0];
      const css = faces
        .map(
          ([w, st]) =>
            `@font-face {\n  font-family: '${family}';\n  font-style: ${st};\n  font-weight: ${w};\n  src: url(${opts.evil || "https://fonts.gstatic.com/s/x/" + w + st}.ttf) format('truetype');\n}`,
        )
        .join("\n");
      return {
        ok: true,
        status: 200,
        headers: { get: () => null },
        text: async () => css,
        arrayBuffer: async () => Buffer.from(css),
      };
    }
    if (opts.hang) return new Promise(() => {});
    const body = opts.big ? Buffer.alloc(opts.big) : TTF;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => body,
    };
  };
  return { fetch, calls };
}

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "se-fonts-test-"));

async function slideWith(family, spec) {
  const doc = S.createSlide({ width: 800, height: 200 });
  doc.importFonts(importCode(spec || family));
  await doc.add({
    type: "text",
    text: "Wide Wide Wide Wide",
    fontFamily: family,
    fontSize: 60,
    x: 400,
    y: 100,
  });
  return doc.toJSON();
}
const textWidth = (doc) =>
  doc._canvas
    .getObjects()
    .find((o) => o.text)
    .calcTextWidth();
const issues = (doc, type) =>
  doc.describe().issues.filter((i) => i.type === type);

test("spec forms: plain family, wght, ital+wght", () => {
  assert.equal(parseGoogleSpec("Bebas Neue").query, "Bebas+Neue");
  assert.equal(
    parseGoogleSpec("Inter:wght@400;700").query,
    "Inter:wght@400;700",
  );
  assert.equal(parseGoogleSpec("Lora:ital,wght@0,400;1,400").family, "Lora");
  assert.equal(
    parseGoogleSpec("Playpen Sans:wght@100..800").family,
    "Playpen Sans",
  );
  for (const bad of [
    "",
    "In/ter",
    "Inter:wght@4x0",
    "Inter:wght@400,700",
    "Inter:wg@400",
    "Inter:@400",
    "../x",
    "Inter\n",
    7,
  ])
    assert.throws(() => parseGoogleSpec(bad), undefined, String(bad));
});

test("CSS parsing: each weight and style becomes its own face", () => {
  const css = `
/* latin */
@font-face { font-family: 'Lora'; font-style: normal; font-weight: 400; src: url(https://fonts.gstatic.com/a.ttf) format('truetype'); }
@font-face { font-family: 'Lora'; font-style: italic; font-weight: 700; src: url("https://fonts.gstatic.com/b.ttf") format('truetype'); }
@font-face { font-family: 'Lora'; font-style: italic; font-weight: 700; src: url(https://fonts.gstatic.com/dup.ttf); }
@font-face { font-family: 'Lora'; font-weight: bold; src: local('x'), url(https://fonts.gstatic.com/c.ttf); }`;
  assert.deepEqual(parseFontFaces(css), [
    { weight: 400, style: "normal", url: "https://fonts.gstatic.com/a.ttf" },
    { weight: 700, style: "italic", url: "https://fonts.gstatic.com/b.ttf" },
    { weight: 700, style: "normal", url: "https://fonts.gstatic.com/c.ttf" },
  ]);
});

test("downloads, caches and registers every variant; mocked fetch only sees Google hosts", async () => {
  const json = await slideWith(
    "Cachey Sans",
    "Cachey Sans:ital,wght@0,400;1,400;0,700",
  );
  const g = mockGoogle();
  const dir = tmp();
  const r = await S.prepareFonts(json, { cacheDir: dir, fetch: g.fetch });
  assert.deepEqual(r, { loaded: ["Cachey Sans"], failed: [] });
  assert.equal(g.calls.length, 4); // CSS + 3 files
  assert.ok(
    g.calls.every((u) =>
      /^https:\/\/fonts\.(googleapis|gstatic)\.com\//.test(u),
    ),
  );
  const files = fs.readdirSync(path.join(dir, fs.readdirSync(dir)[0]));
  assert.ok(
    files.includes("400-italic.ttf") && files.includes("700-normal.ttf"),
  );
  assert.ok(S.fontFamilies().includes("Cachey Sans"));

  // cache hit: no network at all
  const off = mockGoogle({ fail: true });
  const again = await S.prepareFonts(json, { cacheDir: dir, fetch: off.fetch });
  assert.deepEqual(again.loaded, ["Cachey Sans"]);
  assert.equal(off.calls.length, 0);
  const fresh = await S.prepareFonts(
    await slideWith("Cachey Sans", "Cachey Sans:ital,wght@0,400;1,400;0,700"),
    { cacheDir: dir, fetch: off.fetch },
  );
  assert.equal(off.calls.length, 0);
  assert.equal(fresh.failed.length, 0);
});

test("a registered Google font is measured with its real metrics, and font-missing goes away", async () => {
  const json = await slideWith("Measure Me");
  const before = await S.loadSlide(json); // canvas already exists, font unknown
  const fallback = textWidth(before);
  assert.equal(issues(before, "font-missing").length, 1);

  const g = mockGoogle();
  const r = await S.prepareFonts(json, { cacheDir: tmp(), fetch: g.fetch });
  assert.deepEqual(r.loaded, ["Measure Me"]);

  const after = await S.loadSlide(json);
  assert.notEqual(textWidth(after), fallback);
  assert.equal(issues(after, "font-missing").length, 0);

  // registering after the earlier document was created also works for new text there
  await before.add({
    type: "text",
    text: "Wide Wide Wide Wide",
    fontFamily: "Measure Me",
    fontSize: 60,
  });
  const added = before._canvas
    .getObjects()
    .filter((o) => o.text)
    .pop();
  assert.equal(added.calcTextWidth(), textWidth(after));
  assert.equal(issues(before, "font-missing").length, 0);
});

test("loadSlide({ googleFonts }) prepares fonts; SVG embeds them", async () => {
  const json = await slideWith("Svg Face");
  const g = mockGoogle();
  const doc = await S.loadSlide(json, {
    googleFonts: { cacheDir: tmp(), fetch: g.fetch },
  });
  assert.equal(issues(doc, "font-missing").length, 0);
  assert.match(S.toSVGString(doc), /@font-face[^}]*Svg Face/);
  const png = await S.renderPNG(json, {
    maxWidth: 200,
    googleFonts: { cacheDir: tmp(), fetch: g.fetch },
  });
  assert.ok(png.length > 100);
});

test("without the option nothing is fetched", async () => {
  const json = await slideWith("Offline Face");
  const g = mockGoogle();
  const doc = await S.loadSlide(json, { fetch: g.fetch });
  assert.equal(g.calls.length, 0);
  assert.equal(issues(doc, "font-missing").length, 1);
});

test("only Google hosts and valid specs are fetched", async () => {
  const g = mockGoogle({ evil: "https://evil.example.com/font" });
  const r = await S.prepareFonts(
    { fonts: [{ name: "Evil Face", google: "Evil Face" }] },
    { cacheDir: tmp(), fetch: g.fetch },
  );
  assert.equal(r.failed.length, 1);
  assert.match(r.failed[0].error, /host not allowed/);
  assert.ok(g.calls.every((u) => !u.includes("evil.example.com")));

  const g2 = mockGoogle();
  const bad = await S.prepareFonts(
    {
      fonts: [
        { name: "Bad One", google: "Bad One:wght@400;../../x" },
        { name: "../etc", google: "../etc" },
        { name: "Mismatch", google: "Mis/match" },
      ],
    },
    { cacheDir: tmp(), fetch: g2.fetch },
  );
  assert.equal(bad.loaded.length, 0);
  assert.equal(bad.failed.length, 3);
  assert.equal(g2.calls.length, 0);
});

test("timeout, size limit and family cap", async () => {
  const hang = mockGoogle({ hang: true });
  const t0 = Date.now();
  const r1 = await S.prepareFonts(
    { fonts: [{ name: "Slow Face", google: "Slow Face" }] },
    { cacheDir: tmp(), fetch: hang.fetch, timeoutMs: 60 },
  );
  assert.match(r1.failed[0].error, /timeout/);
  assert.ok(Date.now() - t0 < 3000);

  const big = mockGoogle({ big: 5000 });
  const r2 = await S.prepareFonts(
    { fonts: [{ name: "Big Face", google: "Big Face" }] },
    { cacheDir: tmp(), fetch: big.fetch, maxBytes: 1000 },
  );
  assert.match(r2.failed[0].error, /too large/);

  const many = mockGoogle();
  const r3 = await S.prepareFonts(
    { fonts: ["Cap A", "Cap B", "Cap C"].map((n) => ({ name: n, google: n })) },
    { cacheDir: tmp(), fetch: many.fetch, maxFamilies: 2 },
  );
  assert.deepEqual(r3.loaded, ["Cap A", "Cap B"]);
  assert.match(r3.failed[0].error, /too many/);
});

test("a failed download still renders and reports font-missing", async () => {
  const json = await slideWith("Broken Face");
  const g = mockGoogle({ fail: true });
  const doc = await S.loadSlide(json, {
    googleFonts: { cacheDir: tmp(), fetch: g.fetch },
  });
  const miss = issues(doc, "font-missing");
  assert.equal(miss.length, 1);
  assert.equal(miss[0].family, "Broken Face");
  assert.ok(
    (
      await S.renderPNG(json, {
        maxWidth: 200,
        googleFonts: { cacheDir: tmp(), fetch: g.fetch },
      })
    ).length > 100,
  );
});

test("non-font data is rejected and nothing is written outside cacheDir", async () => {
  const dir = tmp();
  const html = async (url) =>
    new URL(url).hostname === "fonts.googleapis.com"
      ? {
          ok: true,
          status: 200,
          headers: { get: () => null },
          arrayBuffer: async () =>
            Buffer.from(
              "@font-face{font-family:'Html Face';src:url(https://fonts.gstatic.com/x.ttf)}",
            ),
        }
      : {
          ok: true,
          status: 200,
          headers: { get: () => null },
          arrayBuffer: async () => Buffer.from("<html>not a font</html>"),
        };
  const r = await S.prepareFonts(
    { fonts: [{ name: "Html Face", google: "Html Face" }] },
    { cacheDir: dir, fetch: html },
  );
  assert.match(r.failed[0].error, /not a TrueType/);
  const all = [];
  (function walk(d) {
    for (const f of fs.readdirSync(d, { withFileTypes: true }))
      f.isDirectory() ? walk(path.join(d, f.name)) : all.push(f.name);
  })(dir);
  assert.deepEqual(
    all.filter((n) => n.endsWith(".ttf")),
    [],
  );
});
