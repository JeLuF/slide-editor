"use strict";
// Shared test helpers: a tiny offline stand-in for the Iconify API, PNG size reading, an in-memory store.

const ICON_SETS = {
  test: {
    info: {
      name: "Test Icons",
      author: { name: "Test" },
      license: { title: "MIT", spdx: "MIT" },
    },
    data: {
      prefix: "test",
      width: 24,
      height: 24,
      icons: {
        dot: { body: '<circle cx="12" cy="12" r="8" fill="currentColor"/>' },
        line: {
          body: '<path d="M4 12h16M12 4v16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
        },
        duo: {
          body: '<path fill="#f59e0b" d="M2 2h20v20H2z"/><circle cx="12" cy="12" r="6" fill="#7c3aed"/>',
        },
      },
      aliases: { "dot-alias": { parent: "dot" } },
    },
  },
  credit: {
    info: {
      name: "Credit Set",
      author: { name: "Someone" },
      license: {
        title: "CC BY 4.0",
        spdx: "CC-BY-4.0",
        url: "https://creativecommons.org/licenses/by/4.0/",
      },
    },
    data: {
      prefix: "credit",
      width: 16,
      height: 16,
      icons: {
        star: {
          body: '<path fill="currentColor" d="M8 1l2 5h5l-4 3 2 6-5-4-5 4 2-6-4-3h5z"/>',
        },
      },
    },
  },
};

const respond = (obj, status = 200) => ({
  ok: status === 200,
  status,
  headers: { get: () => null },
  json: async () => obj,
});

async function fakeFetch(url) {
  const u = new URL(url);
  if (u.pathname === "/search") {
    const q = u.searchParams.get("query"),
      prefixes = (u.searchParams.get("prefixes") || "")
        .split(",")
        .filter(Boolean);
    const icons = [],
      collections = {};
    for (const [p, s] of Object.entries(ICON_SETS)) {
      if (prefixes.length && !prefixes.includes(p)) continue;
      Object.keys(s.data.icons)
        .filter((n) => n.includes(q))
        .forEach((n) => {
          icons.push(p + ":" + n);
          collections[p] = s.info;
        });
    }
    return respond({ icons, total: icons.length, collections });
  }
  if (u.pathname === "/collections") {
    const out = {};
    u.searchParams
      .get("prefixes")
      .split(",")
      .forEach((p) => {
        if (ICON_SETS[p]) out[p] = ICON_SETS[p].info;
      });
    return respond(out);
  }
  const m = u.pathname.match(/^\/([a-z0-9-]+)\.json$/);
  if (m && ICON_SETS[m[1]]) return respond(ICON_SETS[m[1]].data);
  return respond({}, 404);
}

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error("not a PNG");
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function memoryStore() {
  const db = new Map();
  return {
    db,
    load: async (id) => db.get(id) || null,
    save: async (id, json) => {
      db.set(id, JSON.parse(JSON.stringify(json)));
    },
  };
}

module.exports = { fakeFetch, pngSize, memoryStore, ICON_SETS };
