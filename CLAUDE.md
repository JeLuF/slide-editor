# CLAUDE.md — slide-editor

Embeddable editor for single slides / announcement screens (live-stream overlays: "Be right back", "Short break", …), built on Fabric.js 7. The same document code runs in the browser editor and in Node.js, so slides can also be created, changed and rendered to PNG/SVG by a backend, including through MCP tools for AI agents.

Published to npm as `slide-editor` (0BSD), served by jsDelivr, demo on GitHub Pages: https://jeluf.github.io/slide-editor/

## Commands

```bash
npm install          # dev deps: fabric, canvas (native), jsdom, MCP SDK, prettier
npm test             # node:test suite in test/ — core API, Node rendering, MCP tools; no browser, no network
npm run format       # prettier (project style lives in .prettierrc; run before committing)
npm run pack:check   # files that would be published (whitelist in package.json "files")
npm run mcp          # example MCP server over stdio (FONTS_DIR, SLIDES_DIR env vars)
```

Open `docs/index.html` directly from the checkout to try the editor: locally it loads `../src/*`; anywhere else it loads the npm package from jsDelivr, and the Pages workflow rewrites that to `./src/` (see `.github/workflows/pages.yml`).

## Architecture

```
src/slide-core.js       UMD, browser + Node. Document model, no UI. Global: SlideCore
src/slide-editor.js     UMD, browser. class Editor extends SlideCore.Doc; adds UI. Global: SlideEditor
src/slide-node.js       CommonJS, Node. fabric/node + node-canvas: fonts, create/load, render PNG/SVG
src/slide-mcp-tools.js  CommonJS, Node. createSlideTools({ store }) → 10 MCP tools (JSON Schema + handlers)
examples/mcp-server.js  Complete stdio MCP server (official SDK, low-level Server) with file storage
examples/slides/*.json  Example slides (be-right-back.json contains Fluent Emoji art, MIT → credits README)
docs/index.html         Demo page (not published to npm)
test/*.test.js          npm test; test/helpers.js has an offline stand-in for the Iconify API
```

Package entry points (`exports` in package.json): `.` and `./core` → core, `./editor`, `./node`, `./mcp`. Deep imports are intentionally blocked. Browser pages load fabric → slide-core.js → slide-editor.js (editor requires the core).

**Core vs. editor split.** Everything that changes the document lives in `Doc` (core): shapes, text, images, icons, SVG import, palettes, background, JSON, export, the ID-based API. The editor overrides *hooks* that are no-ops in the core: `_finishCrop`, `_renderPanel`, `_updateToolbar`, `_fit`, `_commit` (→ undo history), `_decorate` (→ selection handles, controls), `_add`. New document features go into the core so the backend gets them too; only UI goes into the editor. The browser editor must keep working when `Doc` gains methods (it inherits them).

### Slide JSON

```js
{ type: 'slide-editor', version: 1, width, height,
  backgroundStyle: { fill, opacity },   // un-faded background settings (source of truth)
  canvas: { ...Fabric canvas JSON } }   // canvas.background = rendered (faded) result
```

Custom object properties are saved via `SE_PROPS`: `seId` (stable id), `seName` (user name for setFields), `seFit` (`{maxHeight, maxFontSize}` shrink-to-fit), `seShape` (rect/ellipse/triangle/star/line/blob/ngon), `seBlob` (0–19), `seIcon` (`{id, kind, set, license, attribution, …}`), `seSvg` (`{name}`), `seOrig` (per part: original colors), `seColors` (original→current color map). Any new custom property must be added to `SE_PROPS`, or it is lost on save, undo and duplicate.

Objects without `seId` get deterministic ids (`o1`, `o2`, … by layer) when loaded (`_assignIds`). Ids must stay stable across load/save, because MCP agents use them across separate tool calls that each reload the JSON.

## Requirements and decisions (don't regress these)

The project grew from user requests in roughly this order; each item records the reason behind non-obvious code.

- **Starting point:** "simple slide generator to embed in a bigger project": place, move, rotate and crop graphics, add text, change font, color and size. Readymade editors were too big (HyCanvas, draw.io) or commercial (Polotno), so it's a Fabric.js-based component.
- **Options at creation:** width/height of the slide; `load`/`toJSON`/`toPNG` API. Gradients (linear/radial, angle, **swap colors** button in every gradient editor), transparency per color and per object, **background opacity** (multiplies color alpha, stored separately in `backgroundStyle`).
- **Fonts:** `googleFonts` loads via stylesheet; the editor waits for stylesheets and `document.fonts`, and re-measures all text on the `loadingdone` event (a bug where text stayed in a fallback font until the next click).
- **Resizing must preview the final result.** Rect scale is baked into width/height *during* the drag (`_bakeRectScale`) so rounded corners stay circular; n-gon scale is baked into its points (`_bakePolyScale`); text corner-drag becomes fontSize (`_normalizeText`); top/bottom handles are hidden on text; `noScaleCache: false` on these objects so Fabric redraws live. Before this, rects showed a stale cached image and text snapped back after release.
- **Blob shapes:** 20 "organic round blobs" (Catmull-Rom splines through point lists in `BLOBS`), offered in a toolbar dropdown.
- **N-gon tool:** split button (main part = last n, persisted in localStorage; arrow = picker 3–20). Every corner draggable (Fabric `controlsUtils.createPolyControls`) plus rotation handle; double-click / panel toggle "Corners | Resize". Panel: Add corner (splits the longest side), Remove corner (smallest triangle area). **Rounded corners**: custom class `SeNgon` (registered as `'SeNgon'` in Fabric's classRegistry; WeakMap-cached per Fabric instance because ES-module namespaces are read-only). It renders with `arcTo`, clamps each corner radius to half the adjacent sides, and has its own `_toSVG` (otherwise Fabric emits `<sengon>`). Old slides with plain `Polygon` n-gons are upgraded on load (`_upgradeNgons`).
- **Icons:** Iconify search. To avoid HTTP 429: thumbnails are fetched in batches per icon set via `/{prefix}.json?icons=…` (URLs ≤ 500 chars), results and SVGs are cached, search starts after 2 letters and 500 ms, and on 429 there's a cooldown honouring Retry-After (default 60 s). Single-color icons become one `Path` (fill/stroke editable, gradient-capable); line icons get stroke color/width with `strokeUniform: false`; multi-color icons become groups. Licenses are tracked; CC-BY sets require attribution (`getAttributions()`). Aliases with hFlip/vFlip/rotate are resolved in `iconDataToSvg`. Configurable API base for self-hosting (GDPR).
- **SVG upload** (in the icon popup, *not* the Image button; the Image button still adds SVGs as bitmaps): imported as vectors via Fabric's SVG parser. External `<image>` hrefs and scripts/foreignObject are stripped (external images would taint the canvas and break export).
- **Palette editing** for imported SVGs and multi-color icons: distinct colors, most-used first, **max 12 editable**; with more than 12 colors no pickers are shown (only a note). Mapping always goes from the *original* colors (`seOrig`) so two colors set to the same value stay separately editable; Reset restores them.
- **UI colors** option (`colors: {accent, onAccent, background, surface, border, text, muted, hover, stage, selection, guide, dark: {…}}`), `setColors()`, `setTheme('light'|'dark'|'auto')`. Per-instance scoped `<style>`; values that aren't plain colors are rejected (CSS injection). Canvas-drawn selection colors follow dark mode.
- **Backend / MCP** (the app's MCP endpoint is backend-only, and there may be zero or several browser sessions): headless `Doc` on `fabric/node` + node-canvas; ID-based agent API: `describe({compact})`, `get`, `add(spec)`, `update(id|name, props)`, `remove`, `duplicate`, `setFields`, `batch`, `searchIcons`, `capabilities`. Props use slide pixels with x/y = **center** (`PROPS` documents every property; unknown props throw errors listing the allowed ones; error messages tell the agent what to do instead). `maxHeight` on text = shrink-to-fit (also re-applied on setFields and while typing in the editor). `describe().issues` reports layout problems the agent can't see: off-slide, partly-outside, text-too-wide, text-too-tall, text-overlap, text-outside-shape, font-missing.
- **Server fonts must be .ttf/.otf** (node-canvas can't read WOFF/WOFF2). Unregistered fonts silently fall back, which changes text measurements; `font-missing` exists because of this.
- **Packaging:** 0BSD; `fabric` is a peer dependency; `canvas`/`jsdom` are optional peers (browser users must not install native modules); the MCP SDK is only a dev dependency.

## Conventions

- Plain JavaScript, no build step, no TypeScript; UMD wrappers for core/editor so they work as script tags, CommonJS and in bundlers. Don't introduce a bundler without discussing it.
- Node ≥ 18; browser code targets current evergreen browsers.
- Keep the core free of DOM UI. Use `this._win()` for DOMParser/XMLSerializer (jsdom in Node), never globals.
- `fabric` may be a read-only module namespace: never assign properties to it.
- User-facing text in the editor is short, plain English; errors from the API are instructions ("Unknown property "colour". Allowed: …").
- Keep README.md in sync when changing options or API (it is the user documentation; it also documents the MCP tools).
- CHANGELOG.md: add an entry for every user-visible change; bump the version with `npm version patch|minor|major`.

## Testing

- `npm test` must pass; add tests in `test/` for every core/Node/MCP change. Tests stub `fetch` with `test/helpers.js` (no network).
- Browser behaviour (dragging, panel, popups, crop) has no automated tests in the repo. Verify UI changes manually in `docs/index.html`, or with Playwright: load the page, drive the editor through `window.editor`, and compare `editor.toPNG()` against a server render (`slide-node.js`) — they normally differ by < 1% of pixels (anti-aliasing only).
- Rendering parity matters: a slide must look the same in the editor, in Node PNG and in SVG export.

## Open tasks / ideas

- **Unified `fonts` option** (agreed, not yet built): one list where each entry says where the font comes from: `'Arial'` (already available), `{ name, url }` or `{ name, files: [{url, weight, style}] }` (self-hosted; the editor creates @font-face), `{ name, google: 'Spec' }`. Menu order = list order. Keep `googleFonts` working but document the new form; switch the demo to self-hosted fonts (GDPR).
- Combined CDN file (core + editor in one script) for jsDelivr users.
- npm publishing via GitHub Actions with trusted publishing (provenance), triggered by version tags.
- Optional `main` field in package.json for tools that don't read `exports`.