# Changelog

## Unreleased

- **Editor:** no horizontal scrollbar in the side panel (button groups shrink to fit); scrollbars follow the panel colors in light and dark themes.
- **Editor:** the font menu ends with "+ Import fonts…". Paste the `@import` (or `<link>`) code from fonts.google.com and all its fonts join the menu. Imported fonts are saved in the slide JSON (`fonts`) and loaded again by `load()`. New core method `importFonts(code)` and `SlideCore.parseFontImport(code)`.
- **Editor:** the `fonts` option is now one ordered list. Entries can be a name (already available), `{ name, url }` or `{ name, files: [{ url, weight, style }] }` (self-hosted, loaded by the editor) or `{ name, google }` (loaded from Google). The `googleFonts` option is removed: use `{ name, google: 'Inter:wght@400;700' }` entries in `fonts`.

## 1.0.0 — 2026-10-31

First release.

- **Editor** (`slide-editor/editor`): text, shapes, polygons with movable and rounded corners, 20 blob shapes, images with crop, icon and emoji search (Iconify), SVG import with editable colors, gradients and transparency, shadows, alignment, layers, undo/redo, configurable UI colors and light/dark themes.
- **Core** (`slide-editor/core`): the document model shared by browser and server; JSON save/load; PNG, JPEG, WebP and SVG export; ID-based automation API (`describe`, `add`, `update`, `remove`, `duplicate`, `setFields`, `batch`, `searchIcons`) with layout checks.
- **Node** (`slide-editor/node`): server-side rendering with node-canvas, font registration, SVG with embedded fonts.
- **MCP** (`slide-editor/mcp`): ten MCP tools (create, describe, add, update, remove, duplicate, background, fields, render, icon search) and an example stdio server.
