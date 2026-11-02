/*!
 * slide-node.js — server-side use of SlideCore (no browser needed).
 * Requires: npm install fabric@7 canvas jsdom
 * License: 0BSD
 */
"use strict";

const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

let canvasLib;
try {
  canvasLib = require("canvas");
} catch (e) {
  throw new Error(
    'slide-node: the "canvas" package is missing. Run: npm install fabric@7 canvas jsdom',
  );
}
const fabric = require("fabric/node");
const SlideCore = require("./slide-core.js");

const registered = []; // { family, file, weight, style }
const available = []; // family names registered so far; shared (live) with every document's `availableFonts`

/**
 * Make a font available for rendering. Use the same family name as in the editor.
 * node-canvas needs .ttf or .otf files (not .woff/.woff2). Register fonts before rendering.
 *   registerFont('fonts/ArchivoBlack-Regular.ttf', { family: 'Archivo Black' })
 *   registerFont('fonts/Inter-Bold.ttf', { family: 'Inter', weight: 'bold' })
 */
function registerFont(file, { family, weight, style } = {}) {
  if (!family) throw new Error('registerFont: "family" is required');
  if (!/\.(ttf|otf)$/i.test(file))
    throw new Error(
      "registerFont: node-canvas needs .ttf or .otf files (WOFF/WOFF2 are not supported): " +
        file,
    );
  if (!fs.existsSync(file))
    throw new Error("registerFont: file not found: " + file);
  canvasLib.registerFont(path.resolve(file), { family, weight, style });
  registered.push({ family, file: path.resolve(file), weight, style });
  if (!available.includes(family)) available.push(family);
}

/** Families registered so far (first one is the default for new text). */
function fontFamilies() {
  return Array.from(new Set(registered.map((f) => f.family)));
}

function docOptions(options) {
  const fams = fontFamilies();
  return Object.assign(
    {
      fabric,
      fonts: fams.length ? fams : SlideCore.DEFAULT_FONTS,
      availableFonts: available,
    },
    options || {},
  );
}

/** A new, empty slide document. options: { width, height, background, backgroundOpacity, iconApi, … } */
function createSlide(options) {
  return SlideCore.create(docOptions(options));
}

/**
 * A slide document loaded from JSON (as saved by the editor or by toJSON()).
 * options: the document options of createSlide(), plus `googleFonts` ({ cacheDir, … } or true):
 * download and register the slide's imported Google Fonts first, see prepareFonts().
 */
async function loadSlide(json, options) {
  const o = Object.assign({}, options || {});
  const gf = o.googleFonts;
  delete o.googleFonts;
  if (gf) await prepareFonts(json, gf === true ? {} : gf);
  return SlideCore.fromJSON(json, docOptions(o));
}

/* ======================= Google Fonts ======================= */

const GOOGLE_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];
// Google answers with TrueType files unless the user agent looks like a browser (which gets WOFF/WOFF2,
// unreadable for node-canvas). No user agent, node's default and this one all get .ttf.
const GOOGLE_FONTS_UA = "slide-editor";
const FONT_LIMITS = {
  timeoutMs: 10000,
  maxBytes: 8 * 1024 * 1024, // per font file
  maxCssBytes: 256 * 1024,
  maxFamilies: 8, // per slide
  maxFiles: 40, // per slide
};

const FAMILY_RE = /^[A-Za-z0-9][A-Za-z0-9 ]{0,63}$/;
const AXIS_RE = /^[A-Za-z]{3,6}$/;
const VALUE_RE = /^\d{1,4}(?:\.\d{1,2})?(?:\.\.\d{1,4}(?:\.\d{1,2})?)?$/;

/**
 * Check a spec as the editor produces it ("Inter", "Inter:wght@400;700", "Lora:ital,wght@0,400;1,400")
 * and return { family, query } with the query part of the CSS URL. Throws for anything else.
 */
function parseGoogleSpec(spec) {
  if (typeof spec !== "string" || spec.length > 300)
    throw new Error("font spec must be a string of at most 300 characters");
  const colon = spec.indexOf(":");
  const family = colon < 0 ? spec : spec.slice(0, colon);
  if (!FAMILY_RE.test(family))
    throw new Error("invalid font family (letters, digits and spaces only)");
  if (colon < 0) return { family, query: family.replace(/ /g, "+") };
  const m = /^([^@]+)@(.+)$/.exec(spec.slice(colon + 1));
  if (!m) throw new Error('invalid font axes, expected "wght@400;700"');
  const axes = m[1].split(",");
  if (axes.length > 4 || !axes.every((a) => AXIS_RE.test(a)))
    throw new Error("invalid font axis list");
  const tuples = m[2].split(";");
  if (tuples.length > 64) throw new Error("too many font variants");
  tuples.forEach((t) => {
    const v = t.split(",");
    if (v.length !== axes.length || !v.every((x) => VALUE_RE.test(x)))
      throw new Error("invalid font axis values");
  });
  return {
    family,
    query: family.replace(/ /g, "+") + ":" + m[1] + "@" + m[2],
  };
}

function assertGoogleUrl(url) {
  let u;
  try {
    u = new URL(url);
  } catch (e) {
    throw new Error("invalid URL");
  }
  if (
    u.protocol !== "https:" ||
    !GOOGLE_HOSTS.includes(u.hostname) ||
    u.port ||
    u.username ||
    u.password
  )
    throw new Error("host not allowed: " + u.hostname);
  return u.href;
}

/** Parse the @font-face rules of a Google Fonts CSS answer: [{ weight, style, url }]. */
function parseFontFaces(css) {
  const faces = [];
  const seen = new Set();
  const re = /@font-face\s*\{([^}]*)\}/g;
  let m;
  while ((m = re.exec(css))) {
    const body = m[1];
    const prop = (n) =>
      new RegExp("(?:^|[;\\s])" + n + "\\s*:\\s*([^;]+)", "i").exec(body);
    const src = /url\(\s*(['"]?)(https:[^)'"\s]+)\1\s*\)/i.exec(
      (prop("src") || [])[1] || "",
    );
    if (!src) continue;
    const w = ((prop("font-weight") || [])[1] || "400").trim().toLowerCase();
    const weight =
      w === "bold" ? 700 : w === "normal" ? 400 : parseInt(w, 10) || 400;
    const style = /italic|oblique/i.test((prop("font-style") || [])[1] || "")
      ? "italic"
      : "normal";
    const key = weight + "|" + style;
    if (seen.has(key)) continue; // one file per weight and style
    seen.add(key);
    faces.push({ weight, style, url: src[2] });
  }
  return faces;
}

/** GET with timeout and size limit. Resolves to a Buffer. */
async function fetchLimited(fetchFn, url, o) {
  assertGoogleUrl(url);
  const ctl =
    typeof AbortController === "function" ? new AbortController() : null;
  let timer;
  const timeout = new Promise((_, rej) => {
    timer = setTimeout(() => {
      if (ctl) ctl.abort();
      rej(new Error("timeout after " + o.timeoutMs + " ms"));
    }, o.timeoutMs);
  });
  const work = (async () => {
    const res = await fetchFn(url, {
      headers: { "User-Agent": GOOGLE_FONTS_UA },
      redirect: "error",
      signal: ctl && ctl.signal,
    });
    if (!res || !res.ok) throw new Error("HTTP " + (res && res.status));
    if (res.url) assertGoogleUrl(res.url);
    const len = Number(
      res.headers && res.headers.get && res.headers.get("content-length"),
    );
    if (len > o.maxBytes) throw new Error("file too large (" + len + " bytes)");
    if (res.body && typeof res.body.getReader === "function") {
      const reader = res.body.getReader();
      const chunks = [];
      let n = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        n += value.length;
        if (n > o.maxBytes) {
          if (reader.cancel) reader.cancel().catch(() => {});
          throw new Error("file too large (over " + o.maxBytes + " bytes)");
        }
        chunks.push(Buffer.from(value));
      }
      return Buffer.concat(chunks);
    }
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length > o.maxBytes)
      throw new Error("file too large (" + buf.length + " bytes)");
    return buf;
  })();
  work.catch(() => {}); // the timeout may win; don't leave an unhandled rejection
  try {
    return await Promise.race([work, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

const isFontFile = (b) =>
  b.length > 12 &&
  (b.readUInt32BE(0) === 0x00010000 ||
    b.toString("latin1", 0, 4) === "true" ||
    b.toString("latin1", 0, 4) === "OTTO");

let tempFontDir;
function defaultFontDir() {
  if (!tempFontDir) {
    tempFontDir = fs.mkdtempSync(path.join(os.tmpdir(), "slide-editor-fonts-"));
    process.on("exit", () => {
      try {
        fs.rmSync(tempFontDir, { recursive: true, force: true });
      } catch (e) {
        /* ignore */
      }
    });
  }
  return tempFontDir;
}

const sha = (str) => crypto.createHash("sha1").update(str).digest("hex");
const withinDir = (dir, file) => {
  const rel = path.relative(dir, file);
  return !!rel && !rel.startsWith("..") && !path.isAbsolute(rel);
};

const registeredGoogle = new Set(); // "family|weight|style", registered once per process
const inFlight = new Map();
const failedRecently = new Map(); // key -> time; don't hammer Google for a broken font
const FAIL_TTL_MS = 5 * 60 * 1000;

function registerFace(family, face) {
  const key = family + "|" + face.weight + "|" + face.style;
  if (registeredGoogle.has(key)) return;
  registerFont(face.file, {
    family,
    weight: String(face.weight),
    style: face.style,
  });
  registeredGoogle.add(key);
}

async function loadGoogleFont(name, spec, o, budget) {
  const { family, query } = parseGoogleSpec(spec);
  const dir = path.resolve(o.cacheDir || defaultFontDir());
  const famDir = path.join(
    dir,
    family.toLowerCase().replace(/[^a-z0-9]+/g, "-") +
      "-" +
      sha(family).slice(0, 6),
  );
  const manifest = path.join(famDir, sha(query).slice(0, 12) + ".json");
  if (!withinDir(dir, manifest)) throw new Error("cache path outside cacheDir");

  // Cache hit: register without fetching.
  try {
    const m = JSON.parse(fs.readFileSync(manifest, "utf8"));
    const faces = m.faces.map((f) => ({
      weight: f.weight,
      style: f.style,
      file: path.join(famDir, path.basename(f.file)),
    }));
    if (faces.length && faces.every((f) => fs.existsSync(f.file))) {
      faces.forEach((f) => registerFace(name, f));
      return;
    }
  } catch (e) {
    /* not cached yet */
  }

  const fetchFn = o.fetch || globalThis.fetch;
  if (typeof fetchFn !== "function")
    throw new Error("no fetch available; pass the `fetch` option");
  const css = (
    await fetchLimited(
      fetchFn,
      "https://fonts.googleapis.com/css2?family=" + query,
      { timeoutMs: o.timeoutMs, maxBytes: o.maxCssBytes },
    )
  ).toString("utf8");
  const faces = parseFontFaces(css);
  if (!faces.length) throw new Error("Google returned no font files");
  if ((budget.files += faces.length) > o.maxFiles)
    throw new Error(
      "too many font files for one slide (max " + o.maxFiles + ")",
    );

  fs.mkdirSync(famDir, { recursive: true });
  const saved = [];
  for (const f of faces) {
    const buf = await fetchLimited(fetchFn, f.url, o);
    if (!isFontFile(buf))
      throw new Error("not a TrueType/OpenType file: " + f.url);
    const file = path.join(famDir, f.weight + "-" + f.style + ".ttf");
    if (!withinDir(dir, file)) throw new Error("cache path outside cacheDir");
    const tmp = file + "." + process.pid + ".tmp";
    fs.writeFileSync(tmp, buf);
    fs.renameSync(tmp, file);
    saved.push({ weight: f.weight, style: f.style, file });
  }
  fs.writeFileSync(
    manifest,
    JSON.stringify({
      spec,
      faces: saved.map((f) => ({
        weight: f.weight,
        style: f.style,
        file: path.basename(f.file),
      })),
    }),
  );
  saved.forEach((f) => registerFace(name, f));
}

/**
 * Make the Google Fonts imported into a slide (`fonts: [{ name, google }]` in the slide JSON) available
 * for rendering: download the TrueType files, cache them and register them with node-canvas.
 * Call it before loadSlide() (or pass `googleFonts` to loadSlide/renderPNG/renderSVG).
 *
 * options: { cacheDir, fetch, timeoutMs = 10000, maxBytes = 8 MiB, maxFamilies = 8, maxFiles = 40 }
 *   cacheDir  folder for the font files, kept between runs; default: a temp folder of this process
 *   fetch     function used for every request; default: global fetch
 * Only https://fonts.googleapis.com and https://fonts.gstatic.com are contacted. A font that fails
 * is skipped (text falls back, describe() reports "font-missing"); this function does not throw for it.
 * Resolves to { loaded: [family], failed: [{ family, error }] }.
 */
async function prepareFonts(json, options) {
  const o = Object.assign({}, FONT_LIMITS, options || {});
  if (typeof json === "string") json = JSON.parse(json);
  const list = ((json && json.fonts) || []).filter(
    (f) => f && typeof f.google === "string" && typeof f.name === "string",
  );
  const result = { loaded: [], failed: [] };
  const budget = { files: 0 };
  let families = 0;
  for (const f of list) {
    const fail = (e) =>
      result.failed.push({
        family: f.name,
        error: String((e && e.message) || e),
      });
    if (!FAMILY_RE.test(f.name)) {
      fail("invalid font name");
      continue;
    }
    if (++families > o.maxFamilies) {
      fail("too many fonts for one slide (max " + o.maxFamilies + ")");
      continue;
    }
    const key = [f.name, f.google, o.cacheDir || ""].join("\n");
    const failedAt = failedRecently.get(key);
    if (failedAt && Date.now() - failedAt < FAIL_TTL_MS) {
      fail("download failed recently; not retrying yet");
      continue;
    }
    try {
      if (!inFlight.has(key))
        inFlight.set(
          key,
          loadGoogleFont(f.name, f.google, o, budget).finally(() =>
            inFlight.delete(key),
          ),
        );
      await inFlight.get(key);
      failedRecently.delete(key);
      result.loaded.push(f.name);
    } catch (e) {
      failedRecently.set(key, Date.now());
      fail(e);
    }
  }
  return result;
}

/** @font-face entries (as data: URLs) for the registered fonts used on a slide, for SVG export. */
function fontFacesFor(doc) {
  const used = new Set(doc.usedFonts());
  return registered
    .filter((f) => used.has(f.family))
    .map((f) => ({
      family: f.family,
      weight: f.weight,
      style: f.style,
      url:
        "data:font/" +
        (/\.otf$/i.test(f.file) ? "otf" : "ttf") +
        ";base64," +
        fs.readFileSync(f.file).toString("base64"),
    }));
}

/** PNG (or JPEG) as a Buffer. opts: { maxWidth, multiplier, format: 'png' | 'jpeg', quality } */
function toImageBuffer(doc, opts) {
  const url = doc.toPNG(opts);
  return Buffer.from(url.slice(url.indexOf(",") + 1), "base64");
}

/** SVG markup; by default the used fonts are embedded so the SVG renders correctly anywhere. */
function toSVGString(doc, opts) {
  const o = Object.assign({ embedFonts: true }, opts || {});
  return doc.toSVG(o.embedFonts ? { fontFaces: fontFacesFor(doc) } : {});
}

/** Render slide JSON straight to an image Buffer. */
async function renderPNG(json, opts) {
  const { googleFonts, ...rest } = opts || {};
  return toImageBuffer(await loadSlide(json, { googleFonts }), rest);
}

/** Render slide JSON straight to SVG markup. */
async function renderSVG(json, opts) {
  const { googleFonts, ...rest } = opts || {};
  return toSVGString(await loadSlide(json, { googleFonts }), rest);
}

module.exports = {
  fabric,
  SlideCore,
  registerFont,
  prepareFonts,
  _googleFonts: { parseGoogleSpec, parseFontFaces },
  fontFamilies,
  createSlide,
  loadSlide,
  toImageBuffer,
  toSVGString,
  renderPNG,
  renderSVG,
  fontFacesFor,
};
