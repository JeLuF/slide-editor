/*!
 * slide-mcp-tools.js — MCP tool definitions for slides (Node.js).
 *
 *   const { createSlideTools } = require('./slide-mcp-tools.js');
 *   const tools = createSlideTools({ store: { load: id => db.get(id), save: (id, json) => db.put(id, json) } });
 *   // tools: [{ name, description, inputSchema, handler(args) → MCP result }]
 *
 * Every handler returns an MCP CallToolResult: { content: [...], isError? }.
 * Mutating tools load the slide JSON from your store, apply the change and save it back.
 * License: 0BSD
 */
"use strict";

const S = require("./slide-node.js");
const { PROPS } = S.SlideCore;

const ELEMENT_TYPES = [
  "text",
  "rect",
  "ellipse",
  "triangle",
  "star",
  "line",
  "blob",
  "ngon",
  "image",
  "icon",
  "svg",
];

const COLOR = {
  anyOf: [{ type: "string" }, { type: "object" }, { type: "null" }],
};
const NUM = { type: "number" };
const BOOL = { type: "boolean" };
const STR = { type: "string" };

/** JSON Schema for element properties (shared by add/update), built from SlideCore.PROPS. */
function propSchema() {
  const types = {
    name: STR,
    x: NUM,
    y: NUM,
    width: NUM,
    height: NUM,
    angle: NUM,
    opacity: NUM,
    fill: COLOR,
    stroke: { anyOf: [STR, { type: "null" }] },
    strokeWidth: NUM,
    text: STR,
    fontFamily: STR,
    fontSize: NUM,
    bold: BOOL,
    italic: BOOL,
    underline: BOOL,
    align: { type: "string", enum: ["left", "center", "right", "justify"] },
    lineHeight: NUM,
    letterSpacing: NUM,
    maxHeight: { anyOf: [NUM, { type: "null" }] },
    cornerRadius: NUM,
    shadow: { anyOf: [BOOL, { type: "object" }] },
    colors: {
      anyOf: [{ type: "object" }, { type: "array" }, { type: "null" }],
    },
    flipX: BOOL,
    flipY: BOOL,
    alignTo: { anyOf: [STR, { type: "array", items: STR }] },
    layer: { anyOf: [STR, NUM] },
  };
  const props = {};
  Object.keys(PROPS).forEach((k) => {
    props[k] = Object.assign({}, types[k] || {}, { description: PROPS[k] });
  });
  return props;
}

function createSlideTools(options) {
  const o = Object.assign({ previewMaxWidth: 960 }, options || {});
  const store = o.store;
  if (
    !store ||
    typeof store.load !== "function" ||
    typeof store.save !== "function"
  ) {
    throw new Error(
      "createSlideTools: pass { store: { load(slideId), save(slideId, json) } }",
    );
  }

  const userError = (msg) => {
    const e = new Error(msg);
    e.seUser = true;
    return e;
  };
  const text = (obj) => ({
    content: [
      {
        type: "text",
        text: typeof obj === "string" ? obj : JSON.stringify(obj),
      },
    ],
  });

  async function open(slideId) {
    if (!slideId || typeof slideId !== "string")
      throw userError("slideId (string) is required.");
    const json = await store.load(slideId);
    if (!json)
      throw userError(
        'Slide "' + slideId + '" does not exist. Create it with create_slide.',
      );
    return S.loadSlide(json);
  }

  /** Load, change, save. Returns the change result plus the slide's current layout issues. */
  async function change(slideId, fn) {
    const doc = await open(slideId);
    const result = await fn(doc);
    await store.save(slideId, doc.toJSON());
    const issues = doc.describe({ compact: true }).issues;
    return text(issues.length ? Object.assign({}, result, { issues }) : result);
  }

  const props = propSchema();
  const elementProps = Object.assign(
    {
      type: {
        type: "string",
        enum: ELEMENT_TYPES,
        description: "element type",
      },
      text: { type: "string", description: "text content (type text)" },
      sides: {
        type: "integer",
        minimum: 3,
        maximum: 20,
        description: "number of corners (type ngon)",
      },
      blob: {
        type: "integer",
        minimum: 0,
        maximum: 19,
        description: "which organic blob shape (type blob)",
      },
      src: {
        type: "string",
        description:
          "image URL (https) or data: URL (type image); the image is embedded in the slide",
      },
      icon: {
        type: "string",
        description:
          'Iconify id like "mdi:coffee" (type icon); find ids with search_icons',
      },
      svg: {
        type: "string",
        description: "SVG markup (type svg); becomes editable vector shapes",
      },
      svgName: { type: "string", description: "label for an imported SVG" },
    },
    props,
  );

  const tools = [
    {
      name: "create_slide",
      description:
        "Create a new empty slide (default 1920×1080). Coordinates on slides are pixels from the top-left; x/y of elements are their centers.",
      inputSchema: {
        type: "object",
        properties: {
          slideId: {
            type: "string",
            description: "id under which the slide is stored",
          },
          width: { type: "integer", minimum: 16, maximum: 8192 },
          height: { type: "integer", minimum: 16, maximum: 8192 },
          background: Object.assign({}, COLOR, {
            description:
              'color or gradient {type:"linear"|"radial", colors:[c1,c2], angle}',
          }),
          overwrite: {
            type: "boolean",
            description: "replace an existing slide with the same id",
          },
        },
        required: ["slideId"],
      },
      async handler(a) {
        if (!a.overwrite && (await store.load(a.slideId)))
          throw userError(
            'Slide "' +
              a.slideId +
              '" already exists. Pass overwrite: true to replace it.',
          );
        const doc = S.createSlide({
          width: a.width || 1920,
          height: a.height || 1080,
          background: a.background == null ? "#ffffff" : a.background,
        });
        await store.save(a.slideId, doc.toJSON());
        return text({
          created: a.slideId,
          width: doc.width,
          height: doc.height,
          fonts: S.fontFamilies(),
        });
      },
    },
    {
      name: "describe_slide",
      description:
        "Describe a slide: size, background, every element (id, kind, position, size, text, colors…) and layout issues. Use the ids with the other tools.",
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          compact: {
            type: "boolean",
            description: "leave out small unnamed decorations (default true)",
          },
        },
        required: ["slideId"],
      },
      async handler(a) {
        const doc = await open(a.slideId);
        return text(doc.describe({ compact: a.compact !== false }));
      },
    },
    {
      name: "add_element",
      description:
        "Add text, a shape, an image, an icon or an SVG to a slide. Returns the new element with its id.",
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          element: {
            type: "object",
            properties: elementProps,
            required: ["type"],
          },
        },
        required: ["slideId", "element"],
      },
      async handler(a) {
        return change(a.slideId, async (doc) => ({
          added: await doc.add(a.element || {}),
        }));
      },
    },
    {
      name: "update_element",
      description:
        "Change an element (by id or name): position, size, text, font, colors, gradient, outline, shadow, rotation, layer, alignment…",
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          id: { type: "string", description: "element id or name" },
          changes: { type: "object", properties: props },
        },
        required: ["slideId", "id", "changes"],
      },
      async handler(a) {
        return change(a.slideId, (doc) => ({
          updated: doc.update(a.id, a.changes || {}),
        }));
      },
    },
    {
      name: "remove_element",
      description: "Remove an element (by id or name).",
      inputSchema: {
        type: "object",
        properties: { slideId: { type: "string" }, id: { type: "string" } },
        required: ["slideId", "id"],
      },
      async handler(a) {
        return change(a.slideId, (doc) => doc.remove(a.id));
      },
    },
    {
      name: "duplicate_element",
      description:
        "Copy an element, optionally with changes for the copy (e.g. new x/y or text).",
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          id: { type: "string" },
          changes: { type: "object", properties: props },
        },
        required: ["slideId", "id"],
      },
      async handler(a) {
        return change(a.slideId, async (doc) => ({
          added: await doc.duplicate(a.id, a.changes),
        }));
      },
    },
    {
      name: "set_background",
      description:
        'Set the slide background: a color, "transparent", or a gradient {type:"linear"|"radial", colors:[c1,c2], angle}; opacity 0–1.',
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          fill: COLOR,
          opacity: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["slideId"],
      },
      async handler(a) {
        return change(a.slideId, (doc) => {
          if ("fill" in a) doc.setBackground(a.fill, { silent: true });
          if (a.opacity != null)
            doc.setBackgroundOpacity(a.opacity, { silent: true });
          return {
            background: doc.getBackground(),
            opacity: doc.getBackgroundOpacity(),
          };
        });
      },
    },
    {
      name: "set_fields",
      description:
        'Fill named text elements, e.g. {"title": "Back at 20:15"}. Elements get names via the "name" property.',
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          fields: { type: "object", additionalProperties: { type: "string" } },
        },
        required: ["slideId", "fields"],
      },
      async handler(a) {
        return change(a.slideId, (doc) => doc.setFields(a.fields));
      },
    },
    {
      name: "render_slide",
      description: "Render a slide as an image to check how it looks.",
      inputSchema: {
        type: "object",
        properties: {
          slideId: { type: "string" },
          maxWidth: {
            type: "integer",
            minimum: 64,
            maximum: 4096,
            description:
              "preview width in px (default " + o.previewMaxWidth + ")",
          },
          format: { type: "string", enum: ["png", "jpeg"] },
        },
        required: ["slideId"],
      },
      async handler(a) {
        const doc = await open(a.slideId);
        const format = a.format === "png" ? "png" : "jpeg";
        const buf = S.toImageBuffer(doc, {
          maxWidth: Math.min(a.maxWidth || o.previewMaxWidth, doc.width),
          format,
          quality: 0.85,
        });
        return {
          content: [
            {
              type: "image",
              data: buf.toString("base64"),
              mimeType: "image/" + format,
            },
            {
              type: "text",
              text:
                "Slide " +
                a.slideId +
                " (" +
                doc.width +
                "×" +
                doc.height +
                ")",
            },
          ],
        };
      },
    },
    {
      name: "search_icons",
      description:
        'Search free icons and emoji (Iconify). Use a returned id with add_element type "icon". set: "icons" (single color, recolorable), "emoji" (multi-color), "all".',
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: 'English search word, e.g. "coffee"',
          },
          set: { type: "string", enum: ["icons", "emoji", "all"] },
          limit: { type: "integer", minimum: 1, maximum: 64 },
        },
        required: ["query"],
      },
      async handler(a) {
        const doc = S.createSlide();
        return text(
          await doc.searchIcons(a.query, {
            set: a.set || "icons",
            limit: a.limit || 24,
          }),
        );
      },
    },
  ];

  // Errors become readable tool results (isError) instead of protocol failures.
  tools.forEach((t) => {
    const run = t.handler;
    t.handler = async (args) => {
      try {
        return await run(args || {});
      } catch (e) {
        return {
          isError: true,
          content: [{ type: "text", text: (e && e.message) || String(e) }],
        };
      }
    };
  });
  return tools;
}

module.exports = { createSlideTools, ELEMENT_TYPES };
