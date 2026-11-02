# Changelog

## 1.0.0 — 2026-10-31

First release.

- **Editor** (`slide-editor/editor`): text, shapes, polygons with movable and rounded corners, 20 blob shapes, images with crop, icon and emoji search (Iconify), SVG import with editable colors, gradients and transparency, shadows, alignment, layers, undo/redo, configurable UI colors and light/dark themes.
- **Core** (`slide-editor/core`): the document model shared by browser and server; JSON save/load; PNG, JPEG, WebP and SVG export; ID-based automation API (`describe`, `add`, `update`, `remove`, `duplicate`, `setFields`, `batch`, `searchIcons`) with layout checks.
- **Node** (`slide-editor/node`): server-side rendering with node-canvas, font registration, SVG with embedded fonts.
- **MCP** (`slide-editor/mcp`): ten MCP tools (create, describe, add, update, remove, duplicate, background, fields, render, icon search) and an example stdio server.
