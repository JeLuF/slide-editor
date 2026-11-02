"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeFetch } = require("./helpers.js");

global.fetch = fakeFetch;
const S = require("../src/slide-node.js");

test("add returns descriptions with unique, stable ids", async () => {
  const doc = S.createSlide();
  const a = await doc.add({
    type: "text",
    text: "Hello",
    name: "title",
    fontSize: 100,
    y: 300,
  });
  const b = await doc.add({
    type: "rect",
    width: 400,
    height: 200,
    cornerRadius: 20,
    fill: "#ff0000",
  });
  const c = await doc.add({
    type: "ngon",
    sides: 6,
    cornerRadius: 30,
    width: 240,
  });
  assert.equal(a.kind, "text");
  assert.equal(a.name, "title");
  assert.equal(a.y, 300);
  assert.equal(b.cornerRadius, 20);
  assert.equal(b.fill, "#ff0000");
  assert.equal(c.sides, 6);
  assert.equal(c.width, 240);
  assert.ok(c.height < 240, "one dimension keeps the proportions");
  assert.equal(new Set([a.id, b.id, c.id]).size, 3);

  const again = await S.loadSlide(doc.toJSON());
  assert.deepEqual(
    again.describe().objects.map((o) => o.id),
    doc.describe().objects.map((o) => o.id),
  );
});

test("slides without ids get stable ids when loaded", async () => {
  const doc = S.createSlide();
  await doc.add({ type: "ellipse" });
  await doc.add({ type: "star" });
  const json = doc.toJSON();
  json.canvas.objects.forEach((o) => {
    delete o.seId;
  });
  const first = (await S.loadSlide(json)).describe().objects.map((o) => o.id);
  const second = (await S.loadSlide(json)).describe().objects.map((o) => o.id);
  assert.deepEqual(first, ["o1", "o2"]);
  assert.deepEqual(first, second);
});

test("update by id or name: position, rotation, gradients, outline, shadow, layer, alignment", async () => {
  const doc = S.createSlide();
  const bg = await doc.add({
    type: "rect",
    name: "bg",
    width: 600,
    height: 300,
  });
  await doc.add({ type: "text", name: "title", text: "Hi" });
  let d = doc.update("title", {
    x: 400,
    y: 200,
    angle: -10,
    fill: { type: "linear", colors: ["#ffffff", "#000000"], angle: 90 },
    stroke: "#111111",
    shadow: true,
  });
  assert.equal(d.x, 400);
  assert.equal(d.y, 200);
  assert.equal(d.angle, -10);
  assert.deepEqual(d.fill, {
    type: "linear",
    colors: ["#ffffff", "#000000"],
    angle: 90,
  });
  assert.equal(d.stroke, "#111111");
  assert.ok(d.strokeWidth > 0);
  assert.ok(d.shadow);
  d = doc.update(bg.id, { layer: "front", alignTo: ["right", "bottom"] });
  assert.equal(d.layer, 1);
  assert.equal(d.bounds.right, 1920);
  assert.equal(d.bounds.bottom, 1080);
});

test("maxHeight shrinks text to fit, also when setFields changes it", async () => {
  const doc = S.createSlide();
  await doc.add({
    type: "text",
    name: "title",
    text: "Short",
    fontSize: 150,
    width: 800,
    maxHeight: 200,
  });
  assert.equal(doc.get("title").font.size, 150);
  const r = doc.setFields({
    title:
      "A much longer sentence that will never fit on one line at this size",
    missingField: "x",
  });
  assert.deepEqual(r.missing, ["missingField"]);
  const t = doc.get("title");
  assert.ok(t.font.size < 150, "font got smaller");
  assert.ok(t.height <= 201, "fits the height");
});

test("helpful errors", async () => {
  const doc = S.createSlide();
  await doc.add({ type: "text", name: "title", text: "x" });
  await doc.add({ type: "rect", name: "box" });
  assert.throws(
    () => doc.update("nope", { x: 1 }),
    /No object with id or name "nope"/,
  );
  assert.throws(
    () => doc.update("title", { colour: "red" }),
    /Unknown property "colour". Allowed:/,
  );
  assert.throws(
    () => doc.update("title", { height: 100 }),
    /Text height follows from fontSize/,
  );
  assert.throws(
    () => doc.update("box", { fontSize: 20 }),
    /only applies to text/,
  );
  assert.throws(() => doc.update("box", { colors: {} }), /"colors" applies to/);
  await assert.rejects(
    doc.add({ type: "hexagon" }),
    /Unknown element type "hexagon"/,
  );
  await assert.rejects(
    doc.add({ type: "ngon", sides: 40 }),
    /sides must be 3–20/,
  );
});

test("duplicate, remove, batch", async () => {
  const doc = S.createSlide();
  await doc.add({ type: "text", name: "title", text: "One" });
  const copy = await doc.duplicate("title", { text: "Two", y: 900 });
  assert.notEqual(copy.id, doc.get("title").id);
  assert.equal(copy.text, "Two");
  assert.equal(copy.name, undefined);
  doc.remove(copy.id);
  assert.equal(doc.describe().objects.length, 1);

  let changes = 0;
  doc.on("change", () => changes++);
  await doc.batch(async (d) => {
    d.update("title", { x: 100 });
    d.update("title", { y: 100 });
    await d.add({ type: "ellipse" });
  });
  assert.equal(changes, 1);
});

test("layout issues", async () => {
  const doc = S.createSlide();
  await doc.add({ type: "rect", name: "bar", width: 500, height: 80, y: 700 });
  await doc.add({
    type: "text",
    name: "label",
    text: "A label that is far too long for its bar",
    fontSize: 60,
    width: 480,
    y: 700,
  });
  await doc.add({ type: "ellipse", x: -500, y: -500 });
  await doc.add({ type: "text", text: "Hi", fontFamily: "Font Nobody Has" });
  const types = doc.describe().issues.map((i) => i.type);
  assert.ok(types.includes("text-outside-shape"));
  assert.ok(types.includes("off-slide"));
  assert.ok(types.includes("font-missing"));
});

test("compact description leaves out small decorations", async () => {
  const doc = S.createSlide();
  await doc.add({ type: "text", text: "Title" });
  for (let i = 0; i < 10; i++)
    await doc.add({
      type: "ellipse",
      width: 8,
      height: 8,
      x: 100 + i * 20,
      y: 100,
    });
  const full = doc.describe(),
    compact = doc.describe({ compact: true });
  assert.equal(full.objects.length, 11);
  assert.equal(compact.objects.length, 1);
  assert.equal(compact.smallDecorations.count, 10);
});

test("icons: single-color, line, multi-color with palette, aliases, credits", async () => {
  const doc = S.createSlide({ background: "#000000" });
  const dot = await doc.add({
    type: "icon",
    icon: "test:dot",
    width: 100,
    fill: "#ff00ff",
  });
  assert.equal(dot.kind, "icon");
  assert.equal(dot.fill, "#ff00ff");
  const line = await doc.add({ type: "icon", icon: "test:line" });
  assert.ok(line.color && line.strokeWidth > 0, "line icons have a line color");
  const duo = await doc.add({ type: "icon", icon: "test:duo" });
  assert.equal(duo.colors.length, 2);
  const changed = doc.update(duo.id, { colors: { "#7c3aed": "#22c55e" } });
  assert.ok(
    changed.colors.some(
      (c) => c.original === "#7c3aed" && c.current === "#22c55e",
    ),
  );
  assert.equal(
    (await doc.add({ type: "icon", icon: "test:dot-alias" })).kind,
    "icon",
  );
  const star = await doc.add({ type: "icon", icon: "credit:star" });
  assert.match(star.credit, /CC BY 4.0/);
  assert.equal(doc.getAttributions().length, 1);
  const found = await doc.searchIcons("do", { set: "all" });
  assert.ok(found.icons.some((i) => i.id === "test:dot"));
});

test("SVG import with editable colors; external images are stripped", async () => {
  const doc = S.createSlide();
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#0ea5e9"/>' +
    '<circle cx="25" cy="25" r="15" fill="white" stroke="#0f172a" stroke-width="4"/><image href="https://example.com/x.png" width="10" height="10"/></svg>';
  const d = await doc.add({ type: "svg", svg, svgName: "logo", width: 400 });
  assert.equal(d.kind, "svg");
  assert.equal(d.svgName, "logo");
  assert.equal(d.width, 400);
  assert.deepEqual(d.colors.map((c) => c.original).sort(), [
    "#0ea5e9",
    "#0f172a",
    "#ffffff",
  ]);
  await assert.rejects(
    doc.add({ type: "svg", svg: "<svg><rect" }),
    /not a valid SVG/,
  );
});

test("works with a read-only Fabric module object (ES module namespace, bundlers)", async () => {
  const SlideCore = require("../src/slide-core.js");
  const frozen = Object.freeze(Object.assign({}, S.fabric));
  const doc = SlideCore.create({ fabric: frozen });
  const d = await doc.add({ type: "ngon", sides: 5, cornerRadius: 10 });
  assert.equal(d.cornerRadius, 10);
});
