# SlideEditor

A small, embeddable editor for single slides / announcement screens, built on [Fabric.js](https://fabricjs.com) (v6 or newer, tested with 7.4.0). No framework, no build step, 0BSD license. The same document code runs in the browser editor and on a Node.js server, so slides can also be created, changed and rendered to PNG/SVG by a backend, e.g. through MCP tools for AI agents.

**Features:** text (font, size, color, bold, italic, underline, alignment, line height, letter spacing, outline, shrink-to-fit), rectangles, ellipses, triangles, stars, lines, polygons with movable and rounded corners, 20 organic blob shapes, icon and emoji search (Iconify), SVG import with editable colors, image upload (button, drag & drop, paste), non-destructive image crop, move / scale / rotate / flip, solid colors and linear/radial gradients for any fill and the background, transparency per color and per object, drop shadows, alignment and layering, center snapping, undo/redo, JSON save/load, PNG/JPEG/WebP/SVG export at the exact slide size.

![Example slide](docs/images/be-right-back.jpg)

## Demo site
You can test slide-editor on its [demo site](https://jeluf.github.io/slide-editor/). You can use the [demo slides](examples/slides/) or start your own slides. The demo site also shows how the editor can be styled.

## Install

```bash
npm install slide-editor fabric            # browser editor
npm install slide-editor fabric canvas jsdom   # server rendering / MCP tools
```

`fabric` is a peer dependency (bring v6 or v7); `canvas` and `jsdom` are only needed on a server.

| Import                | File                     | Where          | What                                                                                           |
| --------------------- | ------------------------ | -------------- | ---------------------------------------------------------------------------------------------- |
| `slide-editor/core`   | `src/slide-core.js`      | browser + Node | The document model: everything except the user interface, plus the ID-based API for automation |
| `slide-editor/editor` | `src/slide-editor.js`    | browser        | The visual editor, built on the core                                                           |
| `slide-editor/node`   | `src/slide-node.js`      | Node           | Server helper: fonts, create/load slides, render PNG/SVG                                       |
| `slide-editor/mcp`    | `src/slide-mcp-tools.js` | Node           | Ready-made MCP tool definitions (JSON schemas + handlers)                                      |
|                       | `examples/mcp-server.js` | Node           | A complete MCP server (stdio) using the tools                                                  |
|                       | `examples/slides/`       |                | Two example slides                                                                             |
|                       | `docs/index.html`        | browser        | Demo page (not part of the npm package)                                                        |

## Browser setup

Without a bundler (script tags, e.g. from jsDelivr):

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7.4.0/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/slide-editor@1/src/slide-core.js"></script>
<script src="https://cdn.jsdelivr.net/npm/slide-editor@1/src/slide-editor.js"></script>

<div id="editor" style="height: 640px"></div>
<script>
  const editor = SlideEditor.create("#editor", { width: 1920, height: 1080 });
</script>
```

The container must have a height; the editor fills it and scales the slide to fit.

With a bundler:

```js
import * as fabric from "fabric";
import SlideEditor from "slide-editor/editor";
const editor = SlideEditor.create(el, { width: 1920, height: 1080, fabric });
```

## Options

| Option              | Default                  |                                                                                                                                                                                                                                                         |
| ------------------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `width`, `height`   | `1920`, `1080`           | Size of the slide in pixels (= size of the exported image)                                                                                                                                                                                              |
| `background`        | `'#ffffff'`              | Color, `'transparent'`, or `{ type: 'linear' \| 'radial', colors: [c1, c2], angle }`                                                                                                                                                                    |
| `backgroundOpacity` | `1`                      | Overall background opacity 0–1, multiplied with the colors' own alpha                                                                                                                                                                                   |
| `fonts`             | web-safe list            | Font menu, in this order. Each entry is a name (already available, e.g. `'Arial'`), `{ name, url }` or `{ name, files: [{ url, weight, style }] }` (self-hosted, the editor loads it), or `{ name, google: 'Inter:wght@400;700' }` (loaded from Google) |
| `theme`             | `'light'`                | `'light'`, `'dark'` or `'auto'` (follows the OS)                                                                                                                                                                                                        |
| `colors`            | built-in                 | UI colors, see [UI colors](#ui-colors)                                                                                                                                                                                                                  |
| `historyLimit`      | `60`                     | Undo steps                                                                                                                                                                                                                                              |
| `imageMaxSize`      | 1.5 × longest slide side | Uploaded images larger than this are downscaled (keeps JSON small)                                                                                                                                                                                      |
| `defaultTextColor`  | auto                     | `null` picks black or white depending on the background                                                                                                                                                                                                 |
| `defaultShapeColor` | `'#2563eb'`              |                                                                                                                                                                                                                                                         |
| `defaultIconColor`  | auto                     | Color of newly added single-color icons; `null` picks black or white depending on the background                                                                                                                                                        |
| `icons`             | `true`                   | Icon search. `false` hides the button. Or `{ api: 'https://icons.example.com', filters: [{ key: 'icons', label: 'Icons', prefixes: ['mdi', 'ph'] }, …] }` to use your own Iconify server or set lists                                                   |
| `fabric`            | `window.fabric`          | Pass the Fabric module when not using the global build                                                                                                                                                                                                  |
| `onChange`          | –                        | Same as `editor.on('change', fn)`                                                                                                                                                                                                                       |

## Editor API

```js
editor.toJSON()                 // → { type: 'slide-editor', version: 1, width, height, backgroundStyle, canvas: {...} }
await editor.load(json)         // object or JSON string from toJSON(); resets undo history
editor.toPNG()                  // → data URL at width × height
editor.toPNG({ maxWidth: 640, format: 'jpeg', quality: 0.9 })   // or { multiplier: 0.5 }
await editor.toBlob()           // same options, returns a Blob (handy for uploads)
editor.importFonts(code)          // add Google Fonts from pasted embed code; saved in the slide JSON
editor.toSVG()                  // SVG markup; { fontFaces: [{ family, url }] } embeds fonts

editor.addText('Hello', { fontSize: 120, fill: '#fff' })        // Fabric properties
editor.addShape('rect' | 'ellipse' | 'triangle' | 'star' | 'line', props)
editor.addShape('blob', { blob: 0..19, ...props })
editor.addShape('ngon', { sides: 3..20, cornerRadius: 0, ...props })
editor.addCorner() / removeCorner()                  // on the selected polygon
await editor.addImage(url, props)   // remote URLs need CORS headers, otherwise export fails
await editor.addImageFile(file)
await editor.addIcon('mdi:coffee', props)
await editor.addSVG(svgText, { name: 'logo.svg', ...props })
editor.getAttributions()        // → [{ set, author, license, licenseUrl, text }] for icons whose license requires credit

editor.setBackground('#000' | 'transparent' | { type: 'linear', colors: ['#0f172a', '#1e3a8a'], angle: 135 })
editor.getBackground()
editor.setBackgroundOpacity(0.5) / getBackgroundOpacity()
editor.setSize(1080, 1920) / getSize()

editor.startCrop() / applyCrop() / cancelCrop()
editor.align('left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom')   // selected object
editor.arrange('forward' | 'backward' | 'front' | 'back')
editor.duplicateSelection() / deleteSelection() / clear()
editor.undo() / redo() / canUndo() / canRedo()

editor.setTheme('light' | 'dark' | 'auto')
editor.setColors({ accent: '#15803d', … })   // change UI colors at runtime; null resets

editor.on('change', fn)         // fires after every edit (debounced 250 ms)
editor.off('change', fn)
editor.canvas                   // the underlying fabric.Canvas
editor.destroy()
```

The editor also has the whole [automation API](#automation-api) (`describe`, `add`, `update`, …); changes made through it are undoable like manual edits.

## Automation API

For scripts, backends and AI agents. Available on the editor and on headless documents (`SlideCore.create()`, `slide-node.js`). Objects are addressed by a permanent **id** (saved in the JSON) or by a **name** you give them. Positions are slide pixels; `x`/`y` are the object's center.

```js
doc.describe()                  // whole slide as compact JSON, plus layout issues
doc.describe({ compact: true }) // leaves out small unnamed decorations (dots, sparkles)
doc.get('title')                // one object, by id or name

await doc.add({ type: 'text', name: 'title', text: 'Back soon', fontFamily: 'Archivo Black', fontSize: 160,
                width: 1400, maxHeight: 400, fill: '#fff', y: 450 })        // → description incl. id
await doc.add({ type: 'ngon', sides: 6, cornerRadius: 30, width: 240, x: 1650, y: 800,
                fill: { type: 'radial', colors: ['#facc15', '#f97316'] } })
await doc.add({ type: 'icon', icon: 'fluent-emoji-flat:rocket', width: 200, alignTo: ['right', 'top'] })
await doc.add({ type: 'image', src: 'https://…/photo.jpg', width: 600 })   // Node embeds remote images
await doc.add({ type: 'svg', svg: '<svg …>', svgName: 'logo' })

doc.update('title', { text: 'Back at 20:15', fill: { type: 'linear', colors: ['#fff', '#a5f3fc'], angle: 90 } })
doc.update('o3k9x', { x: 300, angle: -8, layer: 'front', shadow: true })
doc.remove('o3k9x')
await doc.duplicate('title', { y: 900, text: 'Copy' })
doc.setFields({ title: 'Back at 20:15', subtitle: 'Grab a coffee' })   // fills named text objects
await doc.batch(async d => { … })          // many changes → one change event / one undo step
await doc.searchIcons('coffee', { set: 'icons' | 'emoji' | 'all', limit: 24 })
doc.capabilities()                         // element types, fonts, icon sets, property list
```

**Element types:** `text`, `rect`, `ellipse`, `triangle`, `star`, `line`, `blob` (+ `blob: 0–19`), `ngon` (+ `sides: 3–20`), `image` (+ `src`), `icon` (+ `icon`, an Iconify id), `svg` (+ `svg` markup).

**Properties** (for `add` and `update`; `SlideCore.PROPS` has a description of each): `name`, `x`, `y`, `width`, `height`, `angle`, `opacity`, `fill` (color, gradient or null; line color for lines and line icons), `stroke`, `strokeWidth`, `text`, `fontFamily`, `fontSize`, `bold`, `italic`, `underline`, `align`, `lineHeight`, `letterSpacing`, `maxHeight` (text shrinks until it fits), `cornerRadius` (rect, ngon), `shadow` (`true` or `{ color, blur, x, y }`), `colors` (multi-color icons/SVGs: `{ "#original": "#new" }` or a list), `flipX`, `flipY`, `alignTo` (`left`, `center`, `right`, `top`, `middle`, `bottom`), `layer` (`front`, `back`, `forward`, `backward` or a number).

Invalid input throws an error that says what to do instead (e.g. `Unknown property "colour". Allowed: …`).

**Layout issues** in `describe().issues` help an agent check its work without seeing the slide: `off-slide`, `partly-outside` (often intentional for decoration), `text-too-wide`, `text-too-tall`, `text-overlap`, `text-outside-shape` (text sticking out of the bar or box behind it) and, on a server, `font-missing`.

## Server rendering (Node.js)

```js
const {
  registerFont,
  createSlide,
  loadSlide,
  renderPNG,
  renderSVG,
  toImageBuffer,
  toSVGString,
} = require("slide-editor/node");

registerFont("fonts/ArchivoBlack-Regular.ttf", { family: "Archivo Black" }); // same names as in the editor

const png = await renderPNG(slideJson); // Buffer, 1920×1080
const preview = await renderPNG(slideJson, { maxWidth: 640, format: "jpeg" });
const svg = await renderSVG(slideJson); // fonts embedded

const doc = await loadSlide(slideJson); // or createSlide({ width, height, background })
doc.update("title", { text: "Back at 20:15" });
saveToDb(doc.toJSON());
```

- Rendering uses `node-canvas` (prebuilt for Linux, macOS and Windows on x64 and ARM; Alpine needs build tools). A 1920×1080 slide renders in about 0.2–0.6 s and matches the browser to within anti-aliasing.
- **Fonts:** register every font your slides use, as **.ttf or .otf** files (WOFF/WOFF2 web fonts don't work with node-canvas; Google Fonts offers TTF downloads). Unregistered fonts fall back to a default font, which changes text measurements; `describe()` reports them as `font-missing`.
- Icon search and remote images use `fetch` (Node 18+). Remote images are embedded into the slide.

## MCP tools

`slide-editor/mcp` turns the automation API into MCP tools. You provide storage; the tools load the slide JSON, apply the change, save it back and return the result (plus layout issues). Open editors pick up the saved JSON as usual.

```js
const { createSlideTools } = require("slide-editor/mcp");
const tools = createSlideTools({
  store: {
    load: async (slideId) => db.getSlide(slideId), // JSON (string or object) or null
    save: async (slideId, json) => db.putSlide(slideId, json),
  },
  previewMaxWidth: 960,
});
// tools: [{ name, description, inputSchema (JSON Schema), handler(args) → CallToolResult }]
```

| Tool                                  | Does                                                       |
| ------------------------------------- | ---------------------------------------------------------- |
| `create_slide`                        | new empty slide (size, background)                         |
| `describe_slide`                      | elements with ids, positions, text, colors + layout issues |
| `add_element`                         | text, shape, polygon, blob, image, icon or SVG             |
| `update_element`                      | any property by id or name                                 |
| `remove_element`, `duplicate_element` |                                                            |
| `set_background`                      | color or gradient, opacity                                 |
| `set_fields`                          | fill named text elements (templates)                       |
| `render_slide`                        | JPEG/PNG preview image for the agent to look at            |
| `search_icons`                        | Iconify search; ids for `add_element`                      |

With the official SDK's low-level server (`@modelcontextprotocol/sdk`), wiring is two handlers; `examples/mcp-server.js` is a complete stdio server with file storage and a fonts folder (`npm run mcp` in a checkout):

```js
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({
    name,
    description,
    inputSchema,
  })),
}));
server.setRequestHandler(CallToolRequestSchema, async (req) =>
  tools
    .find((t) => t.name === req.params.name)
    .handler(req.params.arguments || {}),
);
```

Saving is last-write-wins: if a person edits the same slide in the editor while an agent changes it, the later save replaces the earlier one. Reload the slide in the editor (or lock it) when the backend changes it.

## Using the editor

- Double-click an image (or press **Crop** in the panel) to crop. Drag the dashed frame or its handles, then **Enter** to apply or **Esc** to cancel. The original image is kept, so **Reset crop** restores it.
- **Polygons:** the polygon button adds a shape with the last-used number of corners; the arrow next to it picks 3–20. A selected polygon shows a handle on every corner (drag to move it) and a rotation handle. Double-click it, or use _Handles: Corners / Resize_ in the panel, to switch to normal resize handles. _Rounding_ rounds all corners (in slide pixels; each corner is limited so arcs never overlap, and resizing keeps them circular). _Add corner_ splits the longest side; _Remove corner_ drops the corner that changes the outline least.
- Dragging a text box's corner changes its font size; side handles change its wrap width. Text with a `maxHeight` (set through the API) shrinks while you type so it keeps fitting.
- Keyboard (when the editor has focus): Delete, arrows (Shift = 10 px), Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z or Ctrl+Y, Ctrl/Cmd+D, Enter to edit text, Esc to deselect.
- Objects snap to the horizontal/vertical center of the slide.

## UI colors

Every key is optional; missing keys keep the built-in theme colors. Top-level keys apply in every theme, and keys under `dark` override them in dark mode (`theme: 'dark'`, or `'auto'` when the OS is dark).

```js
SlideEditor.create("#editor", {
  theme: "auto",
  colors: {
    accent: "#15803d", // buttons, active toggles, sliders, focus rings
    onAccent: "#ffffff", // text on accent-colored buttons
    background: "#f2f5f0", // editor frame
    surface: "#ffffff", // toolbar, panel, popups, inputs
    border: "#d9e2d3",
    text: "#1a2e1f",
    muted: "#5f7363", // labels and hints
    hover: "#e8efe4", // button hover
    stage: "#e1e8dc", // area around the slide
    selection: "#16a34a", // selection frame and handles on the slide (default: accent)
    guide: "#ea580c", // center snapping lines
    dark: {
      accent: "#4ade80",
      onAccent: "#052e16",
      background: "#0f1a12",
      surface: "#16241a",
      text: "#e7f2ea",
    },
  },
});
```

Values are CSS colors. Several editors on one page can each have their own colors. The demo page has a _UI colors_ menu with example schemes, an accent picker and a theme switch.

## Icons

The **Icons** button searches [Iconify](https://iconify.design) (free, no API key). The menu next to the search box switches between general icons, emoji and color clipart, or all sets.

- Single-color icons are added as one vector shape, so fill, gradient and outline work like on any shape. Line-style icons (Tabler, Lucide) get a line color and width instead of a fill.
- Multi-color icons (emoji, color clipart) keep their own colors; opacity, shadow, size and rotation still work.
- The panel shows each icon's set and license. Most sets are MIT or Apache and need no credit. For sets under CC BY / CC BY-SA (e.g. OpenMoji), the panel shows a credit notice and `getAttributions()` lists the credits to display with the slide.
- The icon is saved inside the slide JSON, so slides don't depend on the icon service after editing.
- Requests are kept low: thumbnails for a search page are loaded in one batch per icon set (usually 2–5 requests per search instead of one per icon), searches and icons are cached for the session, and search starts after 2 letters and a short typing pause. If the service answers "429 Too Many Requests", the picker pauses for the time the server asks (default 60 s) and says so.
- The public Iconify API is meant for moderate use and has unpublished limits. For production, especially with many editors or a busy backend, host the API yourself.
- Privacy: the public API at `api.iconify.design` sees your users' IP addresses and search words. To avoid that, [host the Iconify API yourself](https://iconify.design/docs/api/hosting.html) and set `icons: { api: 'https://your-server' }` (editor) or `iconApi` (headless documents).

## SVG upload and color editing

_Upload SVG…_ at the bottom of the icon popup imports an SVG file as editable vector shapes (the **Image** button still adds any file, SVG included, as a flat picture).

- Selecting an imported SVG, or a multi-color icon or emoji from the search, shows a **Colors** section with one picker and transparency slider per distinct color (fills, outlines and gradient colors), most-used first. Changing a color recolors every part that uses it; **Reset colors** restores the originals.
- Up to 12 colors are editable. Graphics with more colors show a short note and no pickers.
- Bitmaps that an SVG links from other websites are removed on import (they would block PNG export); embedded `data:` bitmaps are kept but can't be recolored. Scripts are never run.
- Most clipart, logos and icons import well. Filters, masks, some CSS and SVG fonts are not fully supported by Fabric's importer and may look different; use the Image button for such files.

## Notes

- Images are stored inside the JSON as data URLs, so a slide JSON is self-contained. If you'd rather store images on your server, upload them, call `addImage(url)` with the hosted URL (served with CORS headers), and the JSON keeps only the URL.
- Fonts must be available wherever a slide is rendered: in the browser (a `fonts` entry with `url`, `files` or `google`, or your own CSS) and on the server (`registerFont`). `load()` waits for the fonts used in the slide before measuring text.

## Development

```bash
npm install          # dev dependencies: fabric, canvas, jsdom, MCP SDK
npm test             # core, server rendering and MCP tools (no browser, no network)
npm run pack:check   # lists the files that would be published
```

Open `docs/index.html` directly from the checkout to try the editor; it loads the scripts from `../src`. Served from anywhere else (for example GitHub Pages with the `docs/` folder), it loads the published package from jsDelivr.

## License

[0BSD](LICENSE): use, copy, modify and distribute for any purpose, with or without fee; no conditions, no attribution required.

Third-party parts keep their own licenses: Fabric.js, node-canvas and jsdom (MIT), icons inserted through the icon search (the license of each set, shown in the editor), and the emoji artwork in `examples/slides/be-right-back.json` (Fluent Emoji, MIT, see [examples/slides/README.md](examples/slides/README.md)).
