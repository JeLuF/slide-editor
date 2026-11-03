"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const { fakeFetch, memoryStore, pngSize } = require("./helpers.js");

global.fetch = fakeFetch;
const { createSlideTools } = require("../src/slide-mcp-tools.js");

function setup() {
  const store = memoryStore();
  const tools = createSlideTools({ store, previewMaxWidth: 640 });
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const call = async (name, args) => {
    const r = await byName[name].handler(args);
    const t = r.content.find((c) => c.type === "text");
    let value = t && t.text;
    try {
      value = JSON.parse(value);
    } catch (_) {
      /* plain text */
    }
    return { result: r, value, isError: !!r.isError };
  };
  return { store, tools, call };
}

test("tool list and JSON schemas", () => {
  const { tools } = setup();
  assert.deepEqual(
    tools.map((t) => t.name),
    [
      "create_slide",
      "describe_slide",
      "add_element",
      "update_element",
      "remove_element",
      "duplicate_element",
      "set_background",
      "set_fields",
      "render_slide",
      "search_icons",
    ],
  );
  for (const t of tools) {
    assert.equal(typeof t.description, "string");
    assert.equal(t.inputSchema.type, "object");
    assert.doesNotThrow(() => JSON.stringify(t.inputSchema));
  }
  assert.throws(() => createSlideTools({}), /store/);
});

test("a slide built through the tools", async () => {
  const { store, call } = setup();
  let r = await call("create_slide", { slideId: "s1", background: "#111827" });
  assert.equal(r.value.created, "s1");
  assert.ok(store.db.has("s1"));
  assert.ok(
    (await call("create_slide", { slideId: "s1" })).isError,
    "no silent overwrite",
  );

  r = await call("add_element", {
    slideId: "s1",
    element: {
      type: "text",
      name: "title",
      text: "Live soon",
      fontSize: 120,
      fill: "#ffffff",
      maxHeight: 300,
    },
  });
  assert.equal(r.value.added.name, "title");
  r = await call("add_element", {
    slideId: "s1",
    element: { type: "icon", icon: "test:dot", width: 120, x: 960, y: 200 },
  });
  const iconId = r.value.added.id;
  r = await call("update_element", {
    slideId: "s1",
    id: iconId,
    changes: { fill: "#22c55e", layer: "back" },
  });
  assert.equal(r.value.updated.fill, "#22c55e");
  r = await call("set_fields", {
    slideId: "s1",
    fields: { title: "Back at 20:15" },
  });
  assert.equal(r.value.updated.length, 1);
  r = await call("duplicate_element", {
    slideId: "s1",
    id: "title",
    changes: { y: 900 },
  });
  r = await call("remove_element", { slideId: "s1", id: r.value.added.id });
  r = await call("set_background", {
    slideId: "s1",
    fill: { type: "linear", colors: ["#0f172a", "#1e3a8a"], angle: 45 },
    opacity: 0.8,
  });
  assert.equal(r.value.opacity, 0.8);

  r = await call("describe_slide", { slideId: "s1" });
  assert.deepEqual(
    r.value.objects.map((o) => o.name || o.kind),
    ["icon", "title"],
  );
  assert.equal(r.value.objects[1].text, "Back at 20:15");

  r = await call("render_slide", { slideId: "s1", format: "png" });
  const img = r.result.content.find((c) => c.type === "image");
  assert.equal(img.mimeType, "image/png");
  assert.deepEqual(pngSize(Buffer.from(img.data, "base64")), {
    width: 640,
    height: 360,
  });
});

test("errors come back as readable tool results", async () => {
  const { call } = setup();
  let r = await call("describe_slide", { slideId: "missing" });
  assert.ok(r.isError);
  assert.match(r.value, /does not exist/);
  await call("create_slide", { slideId: "s2" });
  r = await call("update_element", {
    slideId: "s2",
    id: "nothing",
    changes: {},
  });
  assert.ok(r.isError);
  assert.match(r.value, /No object/);
  r = await call("add_element", {
    slideId: "s2",
    element: { type: "text", text: "x", colour: "red" },
  });
  assert.ok(r.isError);
  assert.match(r.value, /Unknown property "colour"/);
});

test("mutating tools report layout issues", async () => {
  const { call } = setup();
  await call("create_slide", { slideId: "s3" });
  const r = await call("add_element", {
    slideId: "s3",
    element: { type: "rect", x: -400, y: -400 },
  });
  assert.ok(r.value.issues.some((i) => i.type === "off-slide"));
});

test("search_icons", async () => {
  const { call } = setup();
  const r = await call("search_icons", { query: "star", set: "all" });
  assert.equal(r.value.icons[0].id, "credit:star");
  assert.equal(r.value.icons[0].creditRequired, true);
});

test("render_slide prepares Google Fonts when the host passes googleFonts", async () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const ttf = fs.readFileSync(
    path.join(__dirname, "fixtures", "BebasNeue-Regular.ttf"),
  );
  const calls = [];
  const fetch = async (url) => {
    calls.push(url);
    const css = new URL(url).hostname === "fonts.googleapis.com";
    const body = css
      ? Buffer.from(
          "@font-face{font-family:'Mcp Face';font-weight:400;font-style:normal;src:url(https://fonts.gstatic.com/s/mcp.ttf) format('truetype')}",
        )
      : ttf;
    return {
      ok: true,
      status: 200,
      headers: { get: () => null },
      arrayBuffer: async () => body,
    };
  };
  const store = memoryStore();
  const tools = createSlideTools({
    store,
    googleFonts: {
      cacheDir: fs.mkdtempSync(path.join(os.tmpdir(), "se-mcp-")),
      fetch,
    },
  });
  const t = Object.fromEntries(tools.map((x) => [x.name, x]));
  await t.create_slide.handler({ slideId: "g", width: 400, height: 200 });
  const json = JSON.parse(JSON.stringify(await store.load("g")));
  json.fonts = [{ name: "Mcp Face", google: "Mcp Face" }];
  await store.save("g", json);
  const r = await t.describe_slide.handler({ slideId: "g" });
  assert.ok(!r.isError);
  assert.ok(calls.length >= 2);
  assert.ok(calls.every((u) => /fonts\.(googleapis|gstatic)\.com/.test(u)));
});

/* ======================= iconApi ======================= */

function recordingTools(opts) {
  const urls = [];
  const saved = global.fetch;
  global.fetch = async (url, init) => {
    urls.push(String(url));
    // answer as the default host so the stand-in handles the path
    return fakeFetch(
      String(url).replace(/^https?:\/\/[^/]+(\/iconify)?/, "https://x"),
      init,
    );
  };
  const store = memoryStore();
  const tools = createSlideTools(Object.assign({ store }, opts));
  const byName = Object.fromEntries(tools.map((t) => [t.name, t]));
  const call = (name, args) => byName[name].handler(args);
  return { urls, store, call, restore: () => (global.fetch = saved) };
}

for (const [label, api, prefix] of [
  ["trailing slash", "http://icons.test:3000/", "http://icons.test:3000"],
  ["path prefix", "http://icons.test/iconify", "http://icons.test/iconify"],
]) {
  test("iconApi: search and icon data use it (" + label + ")", async () => {
    const t = recordingTools({
      iconApi: api,
      iconFilters: [{ key: "icons", label: "Icons", prefixes: ["test"] }],
    });
    try {
      await t.call("search_icons", { query: "dot" });
      assert.ok(t.urls[0].startsWith(prefix + "/search?query=dot"), t.urls[0]);
      assert.match(t.urls[0], /prefixes=test/);
      await t.call("create_slide", { slideId: "a" });
      await t.call("add_element", {
        slideId: "a",
        element: { type: "icon", icon: "test:dot" },
      });
      assert.ok(
        t.urls.some((u) => u.startsWith(prefix + "/test.json?icons=dot")),
      );
      assert.ok(
        t.urls.every((u) => u.startsWith(prefix + "/")),
        t.urls.join(),
      );
      assert.ok(
        !JSON.stringify(await t.store.load("a")).includes("icons.test"),
      );
    } finally {
      t.restore();
    }
  });
}

test("iconApi: default is the public API, JSON has no iconApi", async () => {
  const t = recordingTools({});
  try {
    await t.call("search_icons", { query: "dot" });
    await t.call("create_slide", { slideId: "a" });
    await t.call("add_element", {
      slideId: "a",
      element: { type: "icon", icon: "test:dot" },
    });
    assert.ok(t.urls.length >= 2);
    assert.ok(t.urls.every((u) => u.startsWith("https://api.iconify.design/")));
    const json = JSON.stringify(await t.store.load("a"));
    assert.ok(!/iconApi|api\.iconify/.test(json));
  } finally {
    t.restore();
  }
});

test("iconApi: saved JSON never contains the server URL", async () => {
  const t = recordingTools({ iconApi: "http://icons.test:3000" });
  try {
    await t.call("create_slide", { slideId: "a" });
    await t.call("add_element", {
      slideId: "a",
      element: { type: "icon", icon: "test:dot" },
    });
    assert.ok(
      !/iconApi|icons\.test/.test(JSON.stringify(await t.store.load("a"))),
    );
  } finally {
    t.restore();
  }
});

test("iconApi / iconFilters: invalid values throw from createSlideTools", () => {
  const store = memoryStore();
  for (const bad of [
    "ftp://x",
    "http://user:pw@x",
    "not a url",
    "http://x/?a=1",
    "http://x/#f",
    42,
  ])
    assert.throws(() => createSlideTools({ store, iconApi: bad }), /iconApi/);
  assert.throws(
    () => createSlideTools({ store, iconFilters: [{ key: "a" }] }),
    /iconFilters/,
  );
  assert.throws(
    () => createSlideTools({ store, iconFilters: "mdi" }),
    /iconFilters/,
  );
  assert.doesNotThrow(() =>
    createSlideTools({
      store,
      iconApi: "https://x.test/iconify/",
      iconFilters: [{ key: "k", label: "K", prefixes: ["mdi"] }],
    }),
  );
});
