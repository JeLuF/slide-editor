# Changelog

## 1.4.1 — 2026-11-03

- **Editor:** fixed single-color icons that are a single path: selecting one threw `getObjects is not a function`, left the Color section empty and made the slide unclickable.

## 1.4.0 — 2026-11-03

- **MCP:** `createSlideTools({ iconApi })` sends icon search and icon data requests to your own Iconify API server (`http:`/`https:` URL, a path prefix is fine, no credentials, query or fragment; invalid values throw). `iconFilters` (`[{ key, label, prefixes }]`) limits `search_icons` to the icon sets that server offers. Both are server options and are never saved in the slide JSON. `examples/mcp-server.js` reads `ICONIFY_API`.
- **Editor:** a top-level `iconApi` option is used when `icons.api` is not set.

## 1.3.0 — 2026-11-03

- **Node:** Google Fonts imported in the editor now render on the server. `prepareFonts(json, { cacheDir, fetch, timeoutMs, maxBytes, … })` downloads the TrueType files, caches them per family, weight and style and registers them under the slide's font name; `loadSlide`, `renderPNG` and `renderSVG` take `googleFonts` to do this first, and `createSlideTools({ googleFonts })` does the same for the MCP tools. Only the Google hosts are contacted, specs are validated, downloads have a timeout and a size limit. A failed download falls back as before and `describe()` still reports `font-missing`; registered fonts are no longer reported. Saved text sizes are measured again on load for fonts that are installed on the server.

- **Editor:** no horizontal scrollbar in the side panel (button groups shrink to fit); scrollbars follow the panel colors in light and dark themes.
- **Editor:** the font menu ends with "+ Import fonts…". Paste the `@import` (or `<link>`) code from fonts.google.com and all its fonts join the menu. Imported fonts are saved in the slide JSON (`fonts`) and loaded again by `load()`. New core method `importFonts(code)` and `SlideCore.parseFontImport(code)`.
- **Editor:** the `fonts` option is now one ordered list. Entries can be a name (already available), `{ name, url }` or `{ name, files: [{ url, weight, style }] }` (self-hosted, loaded by the editor) or `{ name, google }` (loaded from Google). The `googleFonts` option is removed: use `{ name, google: 'Inter:wght@400;700' }` entries in `fonts`.

## 1.0.0 — 2026-10-31

First release.

- **Editor** (`slide-editor/editor`): text, shapes, polygons with movable and rounded corners, 20 blob shapes, images with crop, icon and emoji search (Iconify), SVG import with editable colors, gradients and transparency, shadows, alignment, layers, undo/redo, configurable UI colors and light/dark themes.
- **Core** (`slide-editor/core`): the document model shared by browser and server; JSON save/load; PNG, JPEG, WebP and SVG export; ID-based automation API (`describe`, `add`, `update`, `remove`, `duplicate`, `setFields`, `batch`, `searchIcons`) with layout checks.
- **Node** (`slide-editor/node`): server-side rendering with node-canvas, font registration, SVG with embedded fonts.
- **MCP** (`slide-editor/mcp`): ten MCP tools (create, describe, add, update, remove, duplicate, background, fields, render, icon search) and an example stdio server.
