/*!
 * slide-node.js — server-side use of SlideCore (no browser needed).
 * Requires: npm install fabric@7 canvas jsdom
 * License: 0BSD
 */
"use strict";

const fs = require("fs");
const path = require("path");

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
      availableFonts: fams,
    },
    options || {},
  );
}

/** A new, empty slide document. options: { width, height, background, backgroundOpacity, iconApi, … } */
function createSlide(options) {
  return SlideCore.create(docOptions(options));
}

/** A slide document loaded from JSON (as saved by the editor or by toJSON()). */
function loadSlide(json, options) {
  return SlideCore.fromJSON(json, docOptions(options));
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
  return toImageBuffer(await loadSlide(json), opts);
}

/** Render slide JSON straight to SVG markup. */
async function renderSVG(json, opts) {
  return toSVGString(await loadSlide(json), opts);
}

module.exports = {
  fabric,
  SlideCore,
  registerFont,
  fontFamilies,
  createSlide,
  loadSlide,
  toImageBuffer,
  toSVGString,
  renderPNG,
  renderSVG,
  fontFacesFor,
};
