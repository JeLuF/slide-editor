#!/usr/bin/env node
/*
 * Example MCP server exposing the slide tools over stdio.
 *
 *   npm install slide-editor fabric canvas jsdom @modelcontextprotocol/sdk
 *   SLIDES_DIR=./slides FONTS_DIR=./fonts node examples/mcp-server.js
 *
 * In your own project, import from the package instead of ../src:
 *   require('slide-editor/node'), require('slide-editor/mcp')
 *
 * Slides are stored as JSON files in SLIDES_DIR (<slideId>.json); in your application,
 * replace `store` with your database. Fonts: every .ttf/.otf file in FONTS_DIR is registered,
 * with the family name taken from the file name ("Archivo Black.ttf" → "Archivo Black",
 * "Inter-Bold.ttf" → family "Inter", weight bold).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { ListToolsRequestSchema, CallToolRequestSchema } = require('@modelcontextprotocol/sdk/types.js');
const { registerFont } = require('../src/slide-node.js');
const { createSlideTools } = require('../src/slide-mcp-tools.js');

// --- fonts -------------------------------------------------------------------
const fontsDir = process.env.FONTS_DIR || path.join(__dirname, 'fonts');
if (fs.existsSync(fontsDir)) {
  for (const f of fs.readdirSync(fontsDir).filter(n => /\.(ttf|otf)$/i.test(n)).sort()) {
    const base = f.replace(/\.(ttf|otf)$/i, '');
    const m = base.match(/^(.*?)[-_](Regular|Bold|Italic|BoldItalic)$/i);
    const family = (m ? m[1] : base).replace(/[-_]+/g, ' ');
    const style = m ? m[2].toLowerCase() : 'regular';
    registerFont(path.join(fontsDir, f), { family, weight: /bold/.test(style) ? 'bold' : 'normal', style: /italic/.test(style) ? 'italic' : 'normal' });
  }
}

// --- storage (replace with your database) ------------------------------------
const slidesDir = process.env.SLIDES_DIR || path.join(__dirname, 'slides');
fs.mkdirSync(slidesDir, { recursive: true });
const fileFor = id => {
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) throw new Error('slideId may only contain letters, digits, "-" and "_" (max 64).');
  return path.join(slidesDir, id + '.json');
};
const store = {
  load: async id => { const f = fileFor(id); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; },
  save: async (id, json) => { fs.writeFileSync(fileFor(id), JSON.stringify(json)); }
};

// --- MCP wiring --------------------------------------------------------------
const tools = createSlideTools({ store });
const server = new Server({ name: 'slides', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema }))
}));

server.setRequestHandler(CallToolRequestSchema, async req => {
  const tool = tools.find(t => t.name === req.params.name);
  if (!tool) return { isError: true, content: [{ type: 'text', text: 'Unknown tool: ' + req.params.name }] };
  return tool.handler(req.params.arguments || {});
});

server.connect(new StdioServerTransport()).catch(err => { console.error(err); process.exit(1); });
