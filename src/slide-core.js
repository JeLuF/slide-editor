/*!
 * SlideCore 1.0.0
 * The document model behind SlideEditor: shapes, text, images, icons, SVG import, gradients,
 * JSON save/load, PNG/SVG export and an ID-based API for automation (e.g. MCP tools).
 * No user interface; runs in the browser and in Node.js (with fabric/node + node-canvas).
 * License: 0BSD
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SlideCore = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const VERSION = "1.0.0";
  const IS_NODE =
    typeof process !== "undefined" &&
    !!(process.versions && process.versions.node) &&
    typeof window === "undefined";

  /** Custom properties saved with each object. */
  const SE_PROPS = [
    "seId",
    "seName",
    "seFit",
    "seShape",
    "seBlob",
    "seIcon",
    "seSvg",
    "seOrig",
    "seColors",
  ];

  /* Icon search (Iconify). Each filter limits the search to a list of icon-set prefixes. */
  const DEFAULT_ICON_FILTERS = [
    {
      key: "icons",
      label: "Icons",
      prefixes: [
        "mdi",
        "material-symbols",
        "ph",
        "ri",
        "fluent",
        "bi",
        "tabler",
        "lucide",
      ],
    },
    {
      key: "emoji",
      label: "Emoji & color",
      prefixes: [
        "fluent-emoji-flat",
        "noto",
        "twemoji",
        "openmoji",
        "flat-color-icons",
      ],
    },
    { key: "all", label: "All sets", prefixes: [] },
  ];

  const FONT_SPEC = /^[A-Za-z0-9][A-Za-z0-9 ]*(:[A-Za-z0-9@;,. ]+)?$/;
  function isFontSpec(spec) {
    return (
      typeof spec === "string" && spec.length < 300 && FONT_SPEC.test(spec)
    );
  }
  function googleFontsHref(spec) {
    return (
      "https://fonts.googleapis.com/css2?family=" +
      spec.trim().replace(/ /g, "+") +
      "&display=swap"
    );
  }
  /** Fonts in pasted Google Fonts code: [{ name, google: 'Inter:wght@400;700' }]. */
  function parseFontImport(code) {
    const out = [];
    const re = /fonts\.googleapis\.com\/css2?\?([^'")\s<]+)/g;
    let m;
    while ((m = re.exec(String(code || "")))) {
      m[1].replace(/(?:^|&(?:amp;)?)family=([^&\s]+)/g, (_, raw) => {
        let spec;
        try {
          spec = decodeURIComponent(raw.replace(/\+/g, " ")).trim();
        } catch (e) {
          return;
        }
        if (isFontSpec(spec) && !out.some((f) => f.google === spec))
          out.push({ name: spec.split(":")[0].trim(), google: spec });
      });
    }
    return out;
  }

  const DEFAULT_FONTS = [
    "Arial",
    "Helvetica",
    "Verdana",
    "Tahoma",
    "Trebuchet MS",
    "Georgia",
    "Times New Roman",
    "Courier New",
    "Impact",
  ];

  const SHAPES = [
    "rect",
    "ellipse",
    "triangle",
    "star",
    "line",
    "blob",
    "ngon",
  ];
  const KINDS = ["text"].concat(SHAPES, ["image", "icon", "svg"]);
  const MAX_PALETTE = 12;

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const round = (v, d = 0) => {
    const p = Math.pow(10, d);
    return Math.round(v * p) / p;
  };

  function firstFamily(ff) {
    return String(ff || "")
      .split(",")[0]
      .trim()
      .replace(/^["']|["']$/g, "");
  }

  function dataURLtoBlob(dataURL) {
    const [head, body] = dataURL.split(",");
    const mime =
      (head.match(/data:([^;]+)/) || [])[1] || "application/octet-stream";
    const bin = atob(body);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  async function fetchAsDataURL(url) {
    const res = await fetch(url);
    if (!res.ok)
      throw new Error(
        "Could not load image " + url + " (HTTP " + res.status + ")",
      );
    const type = (res.headers.get("content-type") || "image/png").split(";")[0];
    const buf = Buffer.from(await res.arrayBuffer());
    return "data:" + type + ";base64," + buf.toString("base64");
  }

  function err(msg) {
    const e = new Error(msg);
    e.seUser = true;
    return e;
  }

  /* ------------------------------------------------------------------ */
  /* Shapes, icons and SVG helpers                                      */
  /* ------------------------------------------------------------------ */

  /* Organic blob shapes */
  // Blob definitions in a 100×100 box. `p` = explicit outline points, `r` = radii at equal angles.
  const BLOBS = [
    {
      p: [
        [42, 6],
        [60, 8],
        [64, 32],
        [54, 62],
        [44, 88],
        [24, 95],
        [12, 80],
        [24, 52],
        [28, 22],
      ],
    },
    {
      p: [
        [8, 34],
        [22, 14],
        [48, 12],
        [62, 32],
        [70, 50],
        [90, 62],
        [88, 86],
        [66, 92],
        [56, 76],
        [52, 62],
        [28, 60],
        [10, 52],
      ],
    },
    { r: [44, 46, 42, 40, 36, 38, 42, 46], sx: 1.05, sy: 0.82 },
    {
      p: [
        [50, 6],
        [60, 8],
        [66, 26],
        [80, 42],
        [94, 64],
        [84, 90],
        [56, 97],
        [24, 92],
        [8, 68],
        [16, 44],
        [36, 30],
        [44, 18],
      ],
    },
    {
      p: [
        [42, 8],
        [56, 8],
        [70, 42],
        [88, 76],
        [76, 94],
        [40, 96],
        [10, 88],
        [12, 64],
        [30, 38],
      ],
    },
    {
      p: [
        [8, 80],
        [16, 62],
        [40, 52],
        [58, 34],
        [70, 10],
        [80, 14],
        [86, 40],
        [94, 70],
        [86, 92],
        [50, 96],
        [16, 96],
      ],
    },
    {
      p: [
        [54, 8],
        [74, 10],
        [82, 32],
        [70, 50],
        [56, 60],
        [50, 80],
        [34, 94],
        [12, 90],
        [6, 66],
        [22, 52],
        [36, 44],
        [40, 22],
      ],
    },
    {
      p: [
        [6, 62],
        [18, 48],
        [42, 50],
        [50, 28],
        [64, 14],
        [80, 18],
        [96, 40],
        [88, 54],
        [72, 56],
        [70, 76],
        [54, 92],
        [26, 92],
        [8, 80],
      ],
    },
    {
      p: [
        [6, 90],
        [18, 72],
        [24, 40],
        [32, 22],
        [42, 24],
        [46, 38],
        [62, 52],
        [84, 64],
        [96, 82],
        [86, 96],
        [46, 97],
        [14, 97],
      ],
    },
    {
      p: [
        [6, 52],
        [24, 38],
        [60, 34],
        [92, 40],
        [96, 54],
        [82, 64],
        [48, 68],
        [16, 66],
      ],
    },
    { r: [46, 40, 48, 38, 44, 47, 40, 45] },
    {
      p: [
        [50, 24],
        [62, 10],
        [84, 10],
        [94, 30],
        [86, 56],
        [68, 78],
        [54, 90],
        [44, 90],
        [30, 78],
        [12, 56],
        [6, 30],
        [16, 10],
        [38, 10],
      ],
    },
    { r: [45, 33, 46, 34, 44, 33] },
    {
      p: [
        [18, 14],
        [46, 8],
        [78, 16],
        [94, 40],
        [86, 70],
        [62, 92],
        [34, 92],
        [24, 72],
        [42, 58],
        [40, 40],
        [16, 34],
      ],
    },
    { r: [40, 46, 48, 42, 34, 30, 30, 34], sx: 0.85, sy: 1.0, rot: 25 },
    {
      p: [
        [12, 14],
        [40, 8],
        [64, 14],
        [88, 10],
        [94, 38],
        [88, 62],
        [92, 88],
        [62, 92],
        [38, 86],
        [12, 90],
        [8, 62],
        [14, 38],
      ],
    },
    { r: [46, 36, 44, 35, 46, 34, 45, 36, 45, 35] },
    {
      p: [
        [62, 6],
        [86, 18],
        [94, 44],
        [84, 72],
        [60, 90],
        [32, 96],
        [10, 86],
        [22, 74],
        [48, 64],
        [62, 44],
        [52, 24],
      ],
    },
    {
      p: [
        [10, 70],
        [8, 50],
        [22, 40],
        [30, 22],
        [50, 16],
        [64, 26],
        [78, 22],
        [94, 38],
        [92, 58],
        [94, 76],
        [76, 90],
        [52, 86],
        [32, 92],
        [16, 86],
      ],
    },
    {
      p: [
        [4, 50],
        [14, 36],
        [34, 40],
        [50, 30],
        [70, 36],
        [90, 30],
        [98, 46],
        [90, 64],
        [66, 66],
        [48, 72],
        [26, 64],
        [10, 66],
      ],
    },
  ];

  function blobPoints(b) {
    if (b.p) return b.p;
    const n = b.r.length,
      sx = b.sx || 1,
      sy = b.sy || 1,
      rot = ((b.rot || 0) * Math.PI) / 180;
    return b.r.map((r, i) => {
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(a) * r * sx,
        y = Math.sin(a) * r * sy;
      return [
        50 + x * Math.cos(rot) - y * Math.sin(rot),
        50 + x * Math.sin(rot) + y * Math.cos(rot),
      ];
    });
  }

  // Closed Catmull-Rom spline → cubic Bézier SVG path, scaled by k (1 = 100×100 box).
  function blobPath(i, k) {
    k = k || 1;
    const P = blobPoints(BLOBS[i]).map(([x, y]) => [x * k, y * k]),
      n = P.length,
      f = (v) => Math.round(v * 10) / 10;
    let d = "M" + f(P[0][0]) + " " + f(P[0][1]);
    for (let k = 0; k < n; k++) {
      const p0 = P[(k - 1 + n) % n],
        p1 = P[k],
        p2 = P[(k + 1) % n],
        p3 = P[(k + 2) % n];
      d +=
        "C" +
        [
          p1[0] + (p2[0] - p0[0]) / 6,
          p1[1] + (p2[1] - p0[1]) / 6,
          p2[0] - (p3[0] - p1[0]) / 6,
          p2[1] - (p3[1] - p1[1]) / 6,
          p2[0],
          p2[1],
        ]
          .map(f)
          .join(" ");
    }
    return d + "Z";
  }

  function splitIconId(id) {
    const m =
      String(id).match(/^([a-z0-9-]+):([a-z0-9-]+)$/i) ||
      String(id).match(/^([a-z0-9]+)-([a-z0-9-]+)$/i);
    return m ? [m[1], m[2]] : [null, null];
  }

  /** Build SVG markup for one icon from an IconifyJSON response, resolving aliases and flips/rotation. */
  function iconDataToSvg(data, name) {
    const icons = (data && data.icons) || {},
      aliases = (data && data.aliases) || {};
    const chain = [];
    let cur = name;
    while (!icons[cur]) {
      const a = aliases[cur];
      if (!a || chain.length > 8) return null;
      chain.push(a);
      cur = a.parent;
    }
    const p = Object.assign(
      {
        left: data.left || 0,
        top: data.top || 0,
        width: data.width || 16,
        height: data.height || 16,
      },
      icons[cur],
    );
    let hFlip = !!p.hFlip,
      vFlip = !!p.vFlip,
      rot = p.rotate || 0;
    for (let i = chain.length - 1; i >= 0; i--) {
      const a = chain[i];
      ["left", "top", "width", "height"].forEach((k) => {
        if (a[k] != null) p[k] = a[k];
      });
      if (a.hFlip) hFlip = !hFlip;
      if (a.vFlip) vFlip = !vFlip;
      rot += a.rotate || 0;
    }
    let x = p.left,
      y = p.top,
      w = p.width,
      hh = p.height,
      body = p.body;
    const tf = [];
    if (hFlip) tf.push("translate(" + (2 * x + w) + " 0) scale(-1 1)");
    if (vFlip) tf.push("translate(0 " + (2 * y + hh) + ") scale(1 -1)");
    rot = ((rot % 4) + 4) % 4;
    if (rot) {
      const cx = x + w / 2,
        cy = y + hh / 2;
      tf.unshift("rotate(" + rot * 90 + " " + cx + " " + cy + ")");
      if (rot % 2) {
        x = cx - hh / 2;
        y = cy - w / 2;
        const t = w;
        w = hh;
        hh = t;
      }
    }
    if (tf.length)
      body = '<g transform="' + tf.join(" ") + '">' + body + "</g>";
    return (
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="' +
      [x, y, w, hh].join(" ") +
      '">' +
      body +
      "</svg>"
    );
  }

  function scalePathData(cmds, k) {
    return cmds.map((c) => [c[0]].concat(c.slice(1).map((v) => v * k)));
  }

  /**
   * Inspect an icon SVG. Returns kind 'fill' | 'stroke' (single-color, mergeable into one path),
   * 'mono' (single-color but not mergeable), or 'color', plus merged path data and viewBox.
   */
  function analyzeIconSvg(text, win) {
    const res = {
      kind: "color",
      d: "",
      vbW: 24,
      vbH: 24,
      fillRule: "nonzero",
      strokeWidth: 1,
      lineCap: "butt",
      lineJoin: "miter",
    };
    let doc;
    try {
      doc = new ((win && win.DOMParser) || DOMParser)().parseFromString(
        text,
        "image/svg+xml",
      );
    } catch (_) {
      return res;
    }
    const svg = doc.documentElement;
    if (!svg || svg.nodeName.toLowerCase() !== "svg") return res;
    const vb = (svg.getAttribute("viewBox") || "")
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (vb.length === 4 && vb.every(isFinite)) {
      res.vbX = vb[0];
      res.vbY = vb[1];
      res.vbW = vb[2];
      res.vbH = vb[3];
    }
    const attr = (el, name) => {
      for (let n = el; n && n.nodeType === 1; n = n.parentNode) {
        const st = n.getAttribute("style");
        if (st) {
          const m = st.match(
            new RegExp("(?:^|;)\\s*" + name + "\\s*:\\s*([^;]+)"),
          );
          if (m) return m[1].trim();
        }
        if (n.hasAttribute(name)) return n.getAttribute(name);
        if (n === svg) break;
      }
      return null;
    };
    const paints = [];
    let mergeable = true;
    const shapes = Array.from(
      svg.querySelectorAll("path,circle,ellipse,rect,line,polyline,polygon"),
    );
    if (!shapes.length) return res;
    const ds = [],
      kinds = new Set(),
      rules = new Set(),
      widths = new Set(),
      caps = new Set(),
      joins = new Set();
    if (
      svg.querySelector(
        "linearGradient,radialGradient,pattern,image,mask,clipPath,use,text,filter",
      )
    )
      mergeable = false;
    shapes.forEach((el) => {
      const fill = (attr(el, "fill") || "black").toLowerCase();
      const stroke = (attr(el, "stroke") || "none").toLowerCase();
      [fill, stroke].forEach((v) => {
        if (v !== "none") paints.push(v);
      });
      for (let n = el; n && n !== svg; n = n.parentNode) {
        if (
          n.getAttribute("transform") ||
          n.getAttribute("opacity") ||
          n.getAttribute("fill-opacity") ||
          n.getAttribute("stroke-opacity") ||
          n.getAttribute("clip-path") ||
          n.getAttribute("mask")
        )
          mergeable = false;
      }
      const hasFill = fill !== "none",
        hasStroke = stroke !== "none";
      if (hasFill && hasStroke) mergeable = false;
      if (!hasFill && !hasStroke) return;
      kinds.add(hasFill ? "fill" : "stroke");
      rules.add(attr(el, "fill-rule") || "nonzero");
      if (hasStroke) {
        widths.add(parseFloat(attr(el, "stroke-width") || "1"));
        caps.add(attr(el, "stroke-linecap") || "butt");
        joins.add(attr(el, "stroke-linejoin") || "miter");
        if (attr(el, "stroke-dasharray")) mergeable = false;
      }
      const d = shapeToPath(el);
      if (d == null) mergeable = false;
      else ds.push(d);
    });
    const mono = paints.length > 0 && paints.every((v) => v === "currentcolor");
    if (!mono) return res;
    if (
      mergeable &&
      kinds.size === 1 &&
      rules.size === 1 &&
      widths.size <= 1 &&
      caps.size <= 1 &&
      joins.size <= 1
    ) {
      res.kind = kinds.has("fill") ? "fill" : "stroke";
      res.d = ds.join(" ");
      res.fillRule =
        rules.values().next().value === "evenodd" ? "evenodd" : "nonzero";
      if (widths.size) res.strokeWidth = widths.values().next().value || 1;
      if (caps.size) res.lineCap = caps.values().next().value;
      if (joins.size) res.lineJoin = joins.values().next().value;
    } else {
      res.kind = "mono";
    }
    return res;
  }

  function shapeToPath(el) {
    const n = (k) => parseFloat(el.getAttribute(k) || "0");
    switch (el.nodeName.toLowerCase()) {
      case "path":
        return el.getAttribute("d") || "";
      case "circle": {
        const cx = n("cx"),
          cy = n("cy"),
          r = n("r");
        return (
          "M" +
          (cx - r) +
          " " +
          cy +
          "a" +
          r +
          " " +
          r +
          " 0 1 0 " +
          2 * r +
          " 0a" +
          r +
          " " +
          r +
          " 0 1 0 " +
          -2 * r +
          " 0z"
        );
      }
      case "ellipse": {
        const cx = n("cx"),
          cy = n("cy"),
          rx = n("rx"),
          ry = n("ry");
        return (
          "M" +
          (cx - rx) +
          " " +
          cy +
          "a" +
          rx +
          " " +
          ry +
          " 0 1 0 " +
          2 * rx +
          " 0a" +
          rx +
          " " +
          ry +
          " 0 1 0 " +
          -2 * rx +
          " 0z"
        );
      }
      case "line":
        return "M" + n("x1") + " " + n("y1") + "L" + n("x2") + " " + n("y2");
      case "polyline":
      case "polygon": {
        const pts = (el.getAttribute("points") || "")
          .trim()
          .split(/[\s,]+/)
          .map(Number);
        if (pts.length < 4) return "";
        let d = "M" + pts[0] + " " + pts[1];
        for (let i = 2; i + 1 < pts.length; i += 2)
          d += "L" + pts[i] + " " + pts[i + 1];
        return el.nodeName.toLowerCase() === "polygon" ? d + "z" : d;
      }
      case "rect": {
        const x = n("x"),
          y = n("y"),
          w = n("width"),
          hh = n("height");
        let rx = el.hasAttribute("rx") ? n("rx") : n("ry"),
          ry = el.hasAttribute("ry") ? n("ry") : rx;
        rx = Math.min(rx, w / 2);
        ry = Math.min(ry, hh / 2);
        if (!rx || !ry)
          return "M" + x + " " + y + "h" + w + "v" + hh + "h" + -w + "z";
        return (
          "M" +
          (x + rx) +
          " " +
          y +
          "h" +
          (w - 2 * rx) +
          "a" +
          rx +
          " " +
          ry +
          " 0 0 1 " +
          rx +
          " " +
          ry +
          "v" +
          (hh - 2 * ry) +
          "a" +
          rx +
          " " +
          ry +
          " 0 0 1 " +
          -rx +
          " " +
          ry +
          "h" +
          (2 * rx - w) +
          "a" +
          rx +
          " " +
          ry +
          " 0 0 1 " +
          -rx +
          " " +
          -ry +
          "v" +
          (2 * ry - hh) +
          "a" +
          rx +
          " " +
          ry +
          " 0 0 1 " +
          rx +
          " " +
          -ry +
          "z"
        );
      }
    }
    return null;
  }

  /**
   * Polygon with rounded corners (`cornerRadius`, in slide pixels). Registered with Fabric as
   * 'SeNgon' so it survives JSON save/load. Created lazily because Fabric may be passed in.
   */
  // Keyed by Fabric's Polygon class: ES module namespaces (import * as fabric) are read-only objects.
  const ngonClasses = new WeakMap();
  function ngonClass(F) {
    if (ngonClasses.has(F.Polygon)) return ngonClasses.get(F.Polygon);
    class SeNgon extends F.Polygon {
      _render(ctx) {
        const P = this.points,
          n = P.length,
          ox = this.pathOffset.x,
          oy = this.pathOffset.y;
        const r = Math.max(0, this.cornerRadius || 0);
        if (n < 3 || !r) return super._render(ctx);
        // Largest radius per corner so the arcs' tangent points stay within half of each adjacent side.
        const radius = (i) => {
          const p = P[i],
            a = P[(i - 1 + n) % n],
            b = P[(i + 1) % n];
          const ax = a.x - p.x,
            ay = a.y - p.y,
            bx = b.x - p.x,
            by = b.y - p.y;
          const la = Math.hypot(ax, ay),
            lb = Math.hypot(bx, by);
          if (!la || !lb) return 0;
          const cos = clamp((ax * bx + ay * by) / (la * lb), -1, 1);
          const half = Math.acos(cos) / 2;
          if (half < 1e-4 || Math.PI / 2 - half < 1e-4) return 0;
          return Math.min(r, (Math.min(la, lb) / 2) * Math.tan(half));
        };
        const last = P[n - 1],
          first = P[0];
        ctx.beginPath();
        ctx.moveTo((last.x + first.x) / 2 - ox, (last.y + first.y) / 2 - oy);
        for (let i = 0; i < n; i++) {
          const p = P[i],
            q = P[(i + 1) % n];
          ctx.arcTo(p.x - ox, p.y - oy, q.x - ox, q.y - oy, radius(i));
        }
        ctx.closePath();
        this._renderPaintInOrder(ctx);
      }
      toObject(props) {
        return Object.assign(super.toObject(props), {
          cornerRadius: this.cornerRadius || 0,
        });
      }
      /** SVG export: rounded corners as arcs (same geometry as _render), plain <polygon> otherwise. */
      _toSVG() {
        const P = this.points,
          n = P.length,
          ox = this.pathOffset.x,
          oy = this.pathOffset.y;
        const f = (v) => Math.round(v * 100) / 100;
        const r = Math.max(0, this.cornerRadius || 0);
        if (n < 3 || !r) {
          return [
            "<polygon ",
            "COMMON_PARTS",
            'points="' +
              P.map((p) => f(p.x - ox) + "," + f(p.y - oy)).join(" ") +
              '" />\n',
          ];
        }
        let d = "";
        for (let i = 0; i < n; i++) {
          const p = P[i],
            a = P[(i - 1 + n) % n],
            b = P[(i + 1) % n];
          const ax = a.x - p.x,
            ay = a.y - p.y,
            bx = b.x - p.x,
            by = b.y - p.y;
          const la = Math.hypot(ax, ay),
            lb = Math.hypot(bx, by);
          let rad = 0,
            t = 0;
          if (la && lb) {
            const half =
              Math.acos(clamp((ax * bx + ay * by) / (la * lb), -1, 1)) / 2;
            if (half > 1e-4 && Math.PI / 2 - half > 1e-4) {
              rad = Math.min(r, (Math.min(la, lb) / 2) * Math.tan(half));
              t = rad / Math.tan(half);
            }
          }
          const inX = p.x + (ax / (la || 1)) * t,
            inY = p.y + (ay / (la || 1)) * t;
          const outX = p.x + (bx / (lb || 1)) * t,
            outY = p.y + (by / (lb || 1)) * t;
          d += (i ? "L" : "M") + f(inX - ox) + " " + f(inY - oy);
          if (rad) {
            const sweep =
              (p.x - a.x) * (b.y - p.y) - (p.y - a.y) * (b.x - p.x) > 0 ? 1 : 0;
            d +=
              "A" +
              f(rad) +
              " " +
              f(rad) +
              " 0 0 " +
              sweep +
              " " +
              f(outX - ox) +
              " " +
              f(outY - oy);
          }
        }
        return ["<path ", "COMMON_PARTS", 'd="' + d + 'Z" />\n'];
      }
    }
    SeNgon.type = "SeNgon";
    SeNgon.cacheProperties = F.Polygon.cacheProperties.concat(["cornerRadius"]);
    SeNgon.ownDefaults = Object.assign({}, F.Polygon.ownDefaults || {}, {
      cornerRadius: 0,
    });
    F.classRegistry.setClass(SeNgon, "SeNgon");
    ngonClasses.set(F.Polygon, SeNgon);
    return SeNgon;
  }

  /** Regular polygon around (0,0). Odd n: a corner on top; even n: a flat top edge. */
  function regularPolygon(n, r) {
    const off = n % 2 ? -Math.PI / 2 : -Math.PI / 2 + Math.PI / n;
    return Array.from({ length: n }, (_, i) => {
      const a = off + (i * 2 * Math.PI) / n;
      return { x: Math.cos(a) * r, y: Math.sin(a) * r };
    });
  }

  function starPoints(outer, inner, n) {
    const pts = [];
    for (let i = 0; i < n * 2; i++) {
      const r = i % 2 ? inner : outer;
      const a = (Math.PI / n) * i - Math.PI / 2;
      pts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
    }
    return pts;
  }

  /* ------------------------------------------------------------------ */
  /* Document                                                           */
  /* ------------------------------------------------------------------ */

  class Doc {
    /**
     * options: { width, height, background, backgroundOpacity, fonts, fabric, iconApi,
     *            defaultTextColor, defaultShapeColor, defaultIconColor }
     * Pass canvas: false when a subclass (the editor) creates its own canvas.
     */
    constructor(options) {
      const opts = Object.assign(
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          fonts: DEFAULT_FONTS,
          iconApi: null,
          defaultTextColor: null,
          defaultShapeColor: "#2563eb",
          defaultIconColor: null,
        },
        options || {},
      );
      const F =
        opts.fabric ||
        (typeof window !== "undefined" && window.fabric) ||
        (typeof globalThis !== "undefined" && globalThis.fabric);
      if (!F || !F.StaticCanvas || !F.FabricImage) {
        throw new Error(
          'SlideCore: Fabric.js v6+ not found. Load it first, or pass { fabric } in the options (in Node: require("fabric/node")).',
        );
      }
      this.F = F;
      ngonClass(F);
      this.opts = opts;
      this.width = Math.round(opts.width);
      this.height = Math.round(opts.height);
      this.fonts = (opts.fonts || DEFAULT_FONTS).map((f) =>
        typeof f === "string" ? { name: f } : f,
      );
      if (!this.fonts.length) this.fonts.push({ name: "Arial" });
      this._fontSheets = [];
      this.importedFonts = []; // [{ name, google }] added by importFonts(); saved in the slide JSON
      this._listeners = {};
      this._suspend = 0;
      this._batch = 0;
      this._iconInfo = {};
      this._iconSvgs = {};
      this._bg = {
        spec: this._normalizeSpec(opts.background),
        opacity:
          opts.backgroundOpacity == null
            ? 1
            : clamp(+opts.backgroundOpacity, 0, 1),
      };
      if (opts.canvas !== false) {
        const el =
          !IS_NODE && typeof document !== "undefined"
            ? document.createElement("canvas")
            : null;
        this._canvas = new F.StaticCanvas(el, {
          width: this.width,
          height: this.height,
          enableRetinaScaling: false,
          renderOnAddRemove: false,
        });
        this._applyBackground();
      }
    }

    /** Fabric canvas instance, for advanced use. */
    get canvas() {
      return this._canvas;
    }

    /* ---- hooks the editor overrides (no-ops for the headless document) ---- */
    _finishCrop() {}
    _renderPanel() {}
    _updateToolbar() {}
    _fit() {
      if (this._canvas && !this.root)
        this._canvas.setDimensions({ width: this.width, height: this.height });
    }
    _commit() {
      if (!this._suspend && !this._batch) this._emit("change", this);
    }
    _commitNow() {
      this._commit();
    }

    _decorate(o) {
      if (
        !o.seId ||
        this._canvas.getObjects().some((x) => x !== o && x.seId === o.seId)
      )
        o.seId = this._newId();
      return o;
    }

    _add(o) {
      this._decorate(o);
      this._canvas.add(o);
      this._canvas.requestRenderAll();
      this._commit();
      return o;
    }

    _newId() {
      const used = new Set(
        this._canvas ? this._canvas.getObjects().map((o) => o.seId) : [],
      );
      let id;
      do {
        id = "o" + Math.random().toString(36).slice(2, 7);
      } while (used.has(id));
      return id;
    }

    /** Window-like object with DOMParser/XMLSerializer (jsdom in Node). */
    _win() {
      const w =
        (this.F.getFabricWindow && this.F.getFabricWindow()) ||
        (typeof window !== "undefined" ? window : null);
      if (!w || !w.DOMParser)
        throw new Error(
          'SlideCore: no DOMParser available (in Node use require("fabric/node")).',
        );
      return w;
    }

    _iconApiBase() {
      const o = this.opts.icons;
      const api =
        (o && typeof o === "object" && o.api) ||
        this.opts.iconApi ||
        "https://api.iconify.design";
      return String(api).replace(/\/+$/, "");
    }

    /* ======================= save / load / export ======================= */

    /** Serialize the slide (objects, background, size) to a plain object. */
    toJSON() {
      return this._serialize();
    }

    /** Load a slide previously produced by toJSON() (object or JSON string). */
    async load(json) {
      if (typeof json === "string") json = JSON.parse(json);
      if (!json) throw new Error("SlideCore.load: no data");
      await this._restore(json);
      return this;
    }

    /**
     * Render as an image data URL at the slide's size.
     * opts: { multiplier = 1, maxWidth, format = 'png' | 'jpeg' | 'webp', quality = 0.92 }
     */
    toPNG(opts) {
      const o = Object.assign(
        { multiplier: 1, format: "png", quality: 0.92 },
        opts || {},
      );
      if (o.maxWidth)
        o.multiplier = Math.min(o.multiplier, o.maxWidth / this.width);
      return this._withNativeView((c) =>
        c.toDataURL({
          format: o.format,
          quality: o.quality,
          multiplier: o.multiplier,
          enableRetinaScaling: false,
        }),
      );
    }

    /** Same as toPNG(), but resolves to a Blob (browser) or Buffer (Node). */
    async toBlob(opts) {
      const url = this.toPNG(opts);
      if (IS_NODE) return Buffer.from(url.split(",")[1], "base64");
      return dataURLtoBlob(url);
    }

    /**
     * SVG markup of the slide. opts.fontFaces: [{ family, url, weight, style }] are embedded as
     * @font-face rules so the SVG shows the right fonts anywhere (url may be a data: URL).
     */
    toSVG(opts) {
      const o = opts || {};
      let svg = this._withNativeView((c) =>
        c.toSVG({
          width: this.width,
          height: this.height,
          viewBox: { x: 0, y: 0, width: this.width, height: this.height },
        }),
      );
      if (o.fontFaces && o.fontFaces.length) {
        const css = o.fontFaces
          .map(
            (f) =>
              '@font-face{font-family:"' +
              String(f.family).replace(/"/g, "") +
              '";src:url("' +
              f.url +
              '")' +
              (f.weight ? ";font-weight:" + f.weight : "") +
              (f.style ? ";font-style:" + f.style : "") +
              "}",
          )
          .join("");
        svg = svg.replace(
          /<defs>/,
          '<defs>\n<style type="text/css"><![CDATA[' + css + "]]></style>",
        );
      }
      return svg;
    }

    /** Font families used by text on the slide. */
    usedFonts() {
      const s = new Set();
      this._canvas.getObjects().forEach((o) => {
        if (o instanceof this.F.FabricText) s.add(firstFamily(o.fontFamily));
      });
      return Array.from(s);
    }

    _withNativeView(fn) {
      const c = this._canvas;
      const vpt = c.viewportTransform.slice();
      const dims = { width: c.getWidth(), height: c.getHeight() };
      c.setDimensions(
        { width: this.width, height: this.height },
        { backstoreOnly: true },
      );
      c.setViewportTransform([1, 0, 0, 1, 0, 0]);
      try {
        return fn(c);
      } finally {
        c.setDimensions(dims, { backstoreOnly: true });
        c.setViewportTransform(vpt);
        c.requestRenderAll();
      }
    }

    on(evt, fn) {
      (this._listeners[evt] = this._listeners[evt] || []).push(fn);
      return this;
    }

    off(evt, fn) {
      const l = this._listeners[evt];
      if (l) this._listeners[evt] = l.filter((f) => f !== fn);
      return this;
    }

    /** Change the slide size (objects keep their positions). */
    setSize(width, height) {
      this.width = Math.round(width);
      this.height = Math.round(height);
      this._applyBackground();
      this._fit();
      this._renderPanel();
      this._commit();
    }

    getSize() {
      return { width: this.width, height: this.height };
    }

    /**
     * Background: a CSS colour ('#123', 'rgba(...)', 'transparent')
     * or a gradient { type: 'linear' | 'radial', colors: [c1, c2], angle: 0-360 }.
     */
    setBackground(bg, { silent = false, opacity } = {}) {
      const prev = this._bg ? this._bg.opacity : 1;
      this._bg = {
        spec: this._normalizeSpec(bg),
        opacity: opacity == null ? prev : clamp(+opacity, 0, 1),
      };
      this._applyBackground();
      if (!silent) {
        this._renderPanel();
        this._commit();
      }
    }

    getBackground() {
      return this._specToPublic(this._bg.spec);
    }

    /** Overall background opacity 0–1, multiplied with the colors' own alpha. */
    setBackgroundOpacity(opacity, { silent = false } = {}) {
      this._bg.opacity = clamp(+opacity, 0, 1);
      this._applyBackground();
      if (!silent) {
        this._renderPanel();
        this._commit();
      }
    }

    getBackgroundOpacity() {
      return this._bg.opacity;
    }

    /** Render this._bg (spec × opacity) into the Fabric canvas background. */
    _applyBackground() {
      const { spec, opacity } = this._bg;
      const fade = (c) => {
        const col = this._color(c);
        col.setAlpha(col.getAlpha() * opacity);
        return col.toRgba();
      };
      const eff =
        opacity >= 1 || spec.type === "none"
          ? spec
          : Object.assign({}, spec, { c1: fade(spec.c1), c2: fade(spec.c2) });
      this._canvas.backgroundColor = this._specToFill(eff, "canvas");
      this._canvas.requestRenderAll();
    }

    addText(text, props) {
      const F = this.F;
      const t = new F.Textbox(
        text == null ? "Your text here" : String(text),
        Object.assign(
          {
            left: this.width / 2,
            top: this.height / 2,
            originX: "center",
            originY: "center",
            width: Math.round(this.width * 0.6),
            fontSize: Math.round(Math.min(this.width, this.height) * 0.09),
            fontFamily: this.fonts[0].name,
            fill: this.opts.defaultTextColor || this._autoTextColor(),
            textAlign: "center",
            lineHeight: 1.15,
          },
          props || {},
        ),
      );
      if (
        props &&
        props.fill &&
        typeof props.fill === "object" &&
        !(props.fill instanceof F.Gradient)
      ) {
        t.set(
          "fill",
          this._specToFill(this._normalizeSpec(props.fill), "object"),
        );
      }
      this._add(t);
      this._ensureFonts([t]);
      return t;
    }

    /** type: 'rect' | 'ellipse' | 'triangle' | 'star' | 'line' | 'blob' (props.blob = 0–19) | 'ngon' (props.sides = 3–20) */
    addShape(type, props) {
      const F = this.F;
      const s = Math.round(Math.min(this.width, this.height) * 0.3);
      const base = {
        left: this.width / 2,
        top: this.height / 2,
        originX: "center",
        originY: "center",
        fill: this.opts.defaultShapeColor,
        stroke: null,
        strokeWidth: 0,
        strokeUniform: true,
      };
      let o;
      switch (type) {
        case "rect":
          o = new F.Rect(
            Object.assign(base, { width: s * 1.4, height: s, rx: 0, ry: 0 }),
          );
          break;
        case "ellipse":
          o = new F.Ellipse(Object.assign(base, { rx: s / 2, ry: s / 2 }));
          break;
        case "triangle":
          o = new F.Triangle(
            Object.assign(base, { width: s, height: s * 0.9 }),
          );
          break;
        case "star":
          o = new F.Polygon(starPoints(s / 2, s / 4.4, 5), base);
          break;
        case "ngon": {
          const n = clamp(
            Math.round((props && props.sides) || this._ngonN || 6),
            3,
            20,
          );
          o = new (ngonClass(F))(
            regularPolygon(n, s * 0.6),
            Object.assign(base, {
              strokeLineJoin: "round",
              cornerRadius: (props && props.cornerRadius) || 0,
            }),
          );
          break;
        }
        case "blob": {
          const idx = clamp(
            Math.round((props && props.blob) || 0),
            0,
            BLOBS.length - 1,
          );
          o = new F.Path(blobPath(idx, (s * 1.2) / 100), base);
          o.seBlob = idx;
          break;
        }
        case "line":
          o = new F.Line(
            [0, 0, s * 1.5, 0],
            Object.assign(base, {
              fill: null,
              stroke: this.opts.defaultShapeColor,
              strokeWidth: Math.max(2, Math.round(s / 30)),
              strokeLineCap: "round",
            }),
          );
          break;
        default:
          throw new Error('SlideCore.addShape: unknown type "' + type + '"');
      }
      if (props) {
        const p = Object.assign({}, props);
        delete p.blob;
        delete p.sides;
        if (
          p.fill &&
          typeof p.fill === "object" &&
          !(p.fill instanceof F.Gradient)
        )
          p.fill = this._specToFill(this._normalizeSpec(p.fill), "object");
        o.set(p);
      }
      o.seShape = type;
      this._add(o);
      return o;
    }

    /** Add an image from a URL or data URL. Resolves to the Fabric image. */
    async addImage(src, props) {
      const F = this.F;
      // On a server there is no browser cache or CORS; embed remote images so the slide is self-contained.
      if (IS_NODE && /^https?:/i.test(src)) src = await fetchAsDataURL(src);
      const isData = /^data:|^blob:/.test(src);
      const img = await F.FabricImage.fromURL(
        src,
        isData ? {} : { crossOrigin: "anonymous" },
      );
      const fit = Math.min(
        (this.width * 0.6) / img.width,
        (this.height * 0.6) / img.height,
        1,
      );
      img.set(
        Object.assign(
          {
            left: this.width / 2,
            top: this.height / 2,
            originX: "center",
            originY: "center",
            scaleX: fit,
            scaleY: fit,
          },
          props || {},
        ),
      );
      this._add(img);
      return img;
    }

    /** Remove all objects (background is kept). */
    clear() {
      this._finishCrop(false);
      const bg = this._canvas.backgroundColor;
      if (this._canvas.discardActiveObject) this._canvas.discardActiveObject();
      this._canvas.remove(...this._canvas.getObjects());
      this._canvas.backgroundColor = bg;
      this._canvas.requestRenderAll();
      this._renderPanel();
      this._commit();
    }

    /** Turn corner-scaling of a Textbox into a real font size / box width. */
    /**
     * Turn a rectangle's scale into real width/height so the corner radius
     * stays a quarter circle instead of being stretched into an ellipse.
     */
    _bakeRectScale(o) {
      if (o && o.seShape === "ngon" && o instanceof this.F.Polygon)
        return this._bakePolyScale(o);
      if (
        !(o instanceof this.F.Rect) ||
        o.group ||
        (o.scaleX === 1 && o.scaleY === 1)
      )
        return false;
      if (this._crop && o === this._crop.frame) return false;
      const center = o.getCenterPoint();
      o.set({
        width: Math.max(1, o.width * Math.abs(o.scaleX)),
        height: Math.max(1, o.height * Math.abs(o.scaleY)),
        scaleX: o.scaleX < 0 ? -1 : 1,
        scaleY: o.scaleY < 0 ? -1 : 1,
      });
      o.setPositionByOrigin(center, "center", "center");
      o.setCoords();
      return true;
    }

    /** Apply a polygon's scale to its points, so rounded corners stay circular and handles stay on the corners. */
    _bakePolyScale(o) {
      if (o.group || (o.scaleX === 1 && o.scaleY === 1)) return false;
      const center = o.getCenterPoint(),
        sx = o.scaleX,
        sy = o.scaleY;
      o.points = o.points.map((p) => new this.F.Point(p.x * sx, p.y * sy));
      o.set({ scaleX: 1, scaleY: 1 });
      o.setDimensions();
      o.setPositionByOrigin(center, "center", "center");
      o.dirty = true;
      o.setCoords();
      return true;
    }

    _normalizeText(o) {
      if (!(o instanceof this.F.Textbox) || (o.scaleX === 1 && o.scaleY === 1))
        return;
      const center = o.getCenterPoint();
      o.set({
        fontSize: Math.max(1, round(o.fontSize * o.scaleY, 1)),
        width: Math.max(10, o.width * o.scaleX),
        scaleX: 1,
        scaleY: 1,
      });
      o.initDimensions();
      o.setPositionByOrigin(center, "center", "center");
      o.setCoords();
    }

    async _ensureFonts(objs) {
      const texts = (objs || this._canvas.getObjects()).filter(
        (o) => o instanceof this.F.FabricText,
      );
      if (!texts.length) return;
      if (typeof document === "undefined" || !document.fonts) {
        // No browser: fonts are registered up front. Saved text sizes were measured elsewhere,
        // so measure again the texts whose font is installed here.
        const have = this.opts.availableFonts;
        if (Array.isArray(have)) {
          const names = new Set(have.map((f) => String(f).toLowerCase()));
          this._remeasureTexts(
            texts.filter((t) =>
              names.has(firstFamily(t.fontFamily).toLowerCase()),
            ),
          );
        }
        return;
      }
      // The @font-face rules must exist before document.fonts.load() can find a font.
      const timeout = (ms) => new Promise((r) => setTimeout(r, ms));
      await Promise.race([Promise.all(this._fontSheets), timeout(5000)]);
      const reqs = new Set();
      texts.forEach((t) =>
        reqs.add(
          `${t.fontStyle || "normal"} ${t.fontWeight || "normal"} 40px "${firstFamily(t.fontFamily)}"`,
        ),
      );
      const loads = Array.from(reqs).map((r) =>
        document.fonts.load(r).catch(() => null),
      );
      await Promise.race([Promise.all(loads), timeout(5000)]);
      this._remeasureTexts(texts);
    }

    /** Re-measure and redraw text after fonts changed or finished loading. */
    _remeasureTexts(texts) {
      if (!this._canvas) return;
      texts =
        texts ||
        this._canvas.getObjects().filter((o) => o instanceof this.F.FabricText);
      if (!texts.length) return;
      texts.forEach((t) => {
        this.F.cache.clearFontCache(firstFamily(t.fontFamily));
        const center = t.getCenterPoint();
        t.initDimensions();
        t.setPositionByOrigin(center, "center", "center");
        t.setCoords();
        t.dirty = true;
      });
      this._canvas.requestRenderAll();
    }

    _color(str) {
      return new this.F.Color(str || "rgba(0,0,0,0)");
    }

    _hex(str) {
      const c = this._color(str);
      return "#" + c.toHex().slice(0, 6).toLowerCase();
    }

    _alpha(str) {
      if (!str || str === "transparent") return 0;
      return this._color(str).getAlpha();
    }

    _rgba(hex, alpha) {
      const c = this._color(hex);
      c.setAlpha(clamp(alpha, 0, 1));
      return c.toRgba();
    }

    /** Accept the public format and return the internal spec {type,c1,c2,angle}. */
    _normalizeSpec(bg) {
      if (bg == null || bg === "" || bg === "transparent" || bg === "none")
        return {
          type: "none",
          c1: "rgba(255,255,255,1)",
          c2: "rgba(0,0,0,1)",
          angle: 90,
        };
      if (typeof bg === "string")
        return { type: "solid", c1: bg, c2: bg, angle: 90 };
      if (bg instanceof this.F.Gradient) return this._fillToSpec(bg, "object");
      const cols = bg.colors || [bg.c1 || "#ffffff", bg.c2 || "#000000"];
      return {
        type:
          bg.type === "radial"
            ? "radial"
            : bg.type === "solid"
              ? "solid"
              : "linear",
        c1: cols[0],
        c2: cols[1] || cols[0],
        angle: bg.angle == null ? 90 : bg.angle,
      };
    }

    _specToPublic(s) {
      if (s.type === "none") return "transparent";
      if (s.type === "solid") return s.c1;
      return { type: s.type, colors: [s.c1, s.c2], angle: s.angle };
    }

    /** mode 'object' → percentage units; mode 'canvas' → slide pixels. */
    _specToFill(s, mode) {
      if (s.type === "none") return mode === "canvas" ? "" : null;
      if (s.type === "solid") return s.c1;
      const W = mode === "canvas" ? this.width : 1,
        H = mode === "canvas" ? this.height : 1;
      const stops = [
        { offset: 0, color: s.c1 },
        { offset: 1, color: s.c2 },
      ];
      if (s.type === "radial") {
        return new this.F.Gradient({
          type: "radial",
          gradientUnits: mode === "canvas" ? "pixels" : "percentage",
          coords: {
            x1: W / 2,
            y1: H / 2,
            r1: 0,
            x2: W / 2,
            y2: H / 2,
            r2: mode === "canvas" ? Math.hypot(W, H) / 2 : 0.5,
          },
          colorStops: stops,
        });
      }
      const a = ((s.angle || 0) * Math.PI) / 180;
      const dx = Math.cos(a) / 2,
        dy = Math.sin(a) / 2;
      return new this.F.Gradient({
        type: "linear",
        gradientUnits: mode === "canvas" ? "pixels" : "percentage",
        coords: {
          x1: W * (0.5 - dx),
          y1: H * (0.5 - dy),
          x2: W * (0.5 + dx),
          y2: H * (0.5 + dy),
        },
        colorStops: stops,
      });
    }

    _fillToSpec(fill, mode) {
      if (!fill || fill === "transparent")
        return {
          type: "none",
          c1: "rgba(255,255,255,1)",
          c2: "rgba(0,0,0,1)",
          angle: 90,
        };
      if (typeof fill === "string")
        return { type: "solid", c1: fill, c2: fill, angle: 90 };
      if (!(fill instanceof this.F.Gradient))
        return { type: "solid", c1: "#000000", c2: "#000000", angle: 90 };
      const stops = fill.colorStops.slice().sort((a, b) => a.offset - b.offset);
      const stopColor = (st) => {
        if (st.opacity == null || st.opacity === 1) return st.color;
        const col = this._color(st.color);
        col.setAlpha(col.getAlpha() * st.opacity);
        return col.toRgba();
      };
      const c1 = stopColor(stops[0]),
        c2 = stopColor(stops[stops.length - 1]);
      if (fill.type === "radial") return { type: "radial", c1, c2, angle: 90 };
      const W =
        mode === "canvas"
          ? this.width
          : fill.gradientUnits === "percentage"
            ? 1
            : 1;
      const H = mode === "canvas" ? this.height : 1;
      const k = fill.coords;
      const ang =
        (Math.atan2((k.y2 - k.y1) / H, (k.x2 - k.x1) / W) * 180) / Math.PI;
      return { type: "linear", c1, c2, angle: Math.round((ang + 360) % 360) };
    }

    _serialize() {
      return {
        type: "slide-editor",
        version: 1,
        width: this.width,
        height: this.height,
        // Un-faded background settings; canvas.background holds the rendered result.
        backgroundStyle: {
          fill: this._specToPublic(this._bg.spec),
          opacity: this._bg.opacity,
        },
        fonts: this.importedFonts.map((f) => Object.assign({}, f)),
        canvas: this._canvas.toObject(SE_PROPS),
      };
    }

    /**
     * Add Google Fonts from the code of the Google Fonts page (the <style>@import …</style>
     * or <link href> snippet). The fonts join the font menu and are saved with the slide.
     * Returns the font names that were found.
     */
    importFonts(code) {
      const found = parseFontImport(code);
      if (!found.length)
        throw new Error(
          "No Google Fonts found. Paste the code from fonts.google.com (\"Get embed code\"), e.g. @import url('https://fonts.googleapis.com/css2?family=Inter&display=swap');",
        );
      this._addGoogleFonts(found);
      this._commit();
      this._renderPanel();
      return found.map((f) => f.name);
    }

    _addGoogleFonts(list) {
      list.forEach((f) => {
        if (!isFontSpec(f && f.google)) return;
        const name = f.google.split(":")[0].trim();
        const prev = this.importedFonts.find((x) => x.name === name);
        if (prev && prev.google === f.google) return;
        if (prev) prev.google = f.google;
        else this.importedFonts.push({ name, google: f.google });
        if (!this.fonts.some((x) => x.name === name))
          this.fonts.push({ name, google: true });
        this._fontSheets.push(this._loadFontSheet(googleFontsHref(f.google)));
      });
    }

    /** Hook: the editor loads the stylesheet in the page. Returns a promise. */
    _loadFontSheet() {
      return Promise.resolve();
    }

    async _restore(json) {
      const data = json.canvas ? json : { canvas: json };
      if (
        data.width &&
        data.height &&
        (data.width !== this.width || data.height !== this.height)
      ) {
        this.width = Math.round(data.width);
        this.height = Math.round(data.height);
        this._fit();
      }
      this._suspend++;
      try {
        if (this._canvas.discardActiveObject)
          this._canvas.discardActiveObject();
        if (Array.isArray(data.fonts)) this._addGoogleFonts(data.fonts);
        await this._canvas.loadFromJSON(data.canvas);
        const bs = data.backgroundStyle;
        this._bg = bs
          ? {
              spec: this._normalizeSpec(bs.fill),
              opacity: bs.opacity == null ? 1 : clamp(+bs.opacity, 0, 1),
            }
          : {
              spec: this._fillToSpec(this._canvas.backgroundColor, "canvas"),
              opacity: 1,
            };
        this._applyBackground();
        await this._upgradeNgons();
        this._assignIds();
        this._canvas.getObjects().forEach((o) => this._decorate(o));
        await this._ensureFonts();
        this._canvas.requestRenderAll();
      } finally {
        this._suspend--;
      }
      this._renderPanel();
      this._updateToolbar();
    }

    /** Slides saved before rounded corners existed store n-gons as plain polygons; swap in the n-gon class. */
    async _upgradeNgons() {
      const C = ngonClass(this.F),
        c = this._canvas;
      const objs = c.getObjects();
      for (let i = 0; i < objs.length; i++) {
        const o = objs[i];
        if (o.seShape !== "ngon" || o instanceof C) continue;
        const n = await C.fromObject(
          Object.assign(o.toObject(["seShape"]), {
            type: "SeNgon",
            cornerRadius: 0,
          }),
        );
        c.remove(o);
        c.insertAt(i, n);
      }
    }

    _emit(evt, arg) {
      (this._listeners[evt] || []).forEach((fn) => {
        try {
          fn(arg);
        } catch (err) {
          console.error(err);
        }
      });
      const cb = this.opts["on" + evt.charAt(0).toUpperCase() + evt.slice(1)];
      if (typeof cb === "function")
        try {
          cb(arg);
        } catch (err) {
          console.error(err);
        }
    }

    _contrast(c) {
      const [r, g, b] = this._color(c).getSource();
      return r * 0.299 + g * 0.587 + b * 0.114 > 140 ? "#1f2937" : "#ffffff";
    }

    _autoTextColor() {
      const s = this._bg.spec;
      if (s.type === "none" || this._alpha(s.c1) * this._bg.opacity < 0.3)
        return "#111111";
      if (s.type === "solid") return this._contrast(s.c1);
      // gradient: judge by the average of both ends
      const a = this._color(s.c1).getSource(),
        b = this._color(s.c2).getSource();
      return this._contrast(
        "rgb(" +
          [0, 1, 2].map((i) => Math.round((a[i] + b[i]) / 2)).join(",") +
          ")",
      );
    }

    /** Recompute the polygon's box after its points changed, without moving it on the slide. */
    _polyRefit(o, anchorIndex) {
      const before = new this.F.Point(o.points[anchorIndex])
        .subtract(o.pathOffset)
        .transform(o.calcOwnMatrix());
      o.setDimensions();
      const after = new this.F.Point(o.points[anchorIndex])
        .subtract(o.pathOffset)
        .transform(o.calcOwnMatrix());
      o.set({
        left: o.left - (after.x - before.x),
        top: o.top - (after.y - before.y),
      });
      o.dirty = true;
      o.setCoords();
    }

    /** Insert a corner in the middle of the longest side. */
    addCorner(o) {
      o = this._obj(o);
      if (o.seShape !== "ngon")
        throw new Error("addCorner: object is not an n-gon");
      const P = o.points;
      let best = 0,
        len = -1;
      P.forEach((p, i) => {
        const q = P[(i + 1) % P.length];
        const d = Math.hypot(q.x - p.x, q.y - p.y);
        if (d > len) {
          len = d;
          best = i;
        }
      });
      const a = P[best],
        b = P[(best + 1) % P.length];
      P.splice(best + 1, 0, new this.F.Point((a.x + b.x) / 2, (a.y + b.y) / 2));
      this._polyRefit(o, 0);
      if (this._setNgonMode && o._seMode !== "resize")
        this._setNgonMode(o, "corners", true);
      this._canvas.requestRenderAll();
      this._renderPanel();
      this._commit();
    }

    /** Remove the corner whose removal changes the outline least (smallest triangle with its neighbours). */
    removeCorner(o) {
      o = this._obj(o);
      if (o.seShape !== "ngon")
        throw new Error("removeCorner: object is not an n-gon");
      if (o.points.length <= 3) return;
      const P = o.points,
        n = P.length;
      let best = 0,
        area = Infinity;
      P.forEach((p, i) => {
        const a = P[(i - 1 + n) % n],
          b = P[(i + 1) % n];
        const t =
          Math.abs((p.x - a.x) * (b.y - a.y) - (b.x - a.x) * (p.y - a.y)) / 2;
        if (t < area) {
          area = t;
          best = i;
        }
      });
      const anchor = best === 0 ? 1 : 0;
      const keep = P[anchor];
      this._polyRefitAfter(
        o,
        () => {
          P.splice(best, 1);
        },
        keep,
      );
      if (this._setNgonMode && o._seMode !== "resize")
        this._setNgonMode(o, "corners", true);
      this._canvas.requestRenderAll();
      this._renderPanel();
      this._commit();
    }

    _polyRefitAfter(o, mutate, keepPoint) {
      const before = new this.F.Point(keepPoint)
        .subtract(o.pathOffset)
        .transform(o.calcOwnMatrix());
      mutate();
      o.setDimensions();
      const after = new this.F.Point(keepPoint)
        .subtract(o.pathOffset)
        .transform(o.calcOwnMatrix());
      o.set({
        left: o.left - (after.x - before.x),
        top: o.top - (after.y - before.y),
      });
      o.dirty = true;
      o.setCoords();
    }

    /** fetch() JSON with errors that carry the HTTP status (and Retry-After for 429). */
    async _iconFetch(url, signal) {
      const res = await fetch(url, { signal });
      if (!res.ok) {
        const err = new Error("Icon service: HTTP " + res.status);
        err.status = res.status;
        err.retryAfter = parseInt(res.headers.get("Retry-After") || "", 10);
        throw err;
      }
      return res.json();
    }

    /** Fetch SVG data for icon ids that aren't cached yet, batched per set (Iconify icon-data query). */
    async _loadIconSvgs(ids, signal) {
      const cfg = { api: this._iconApiBase() };
      const bySet = {};
      ids.forEach((id) => {
        if (id in this._iconSvgs) return;
        const [prefix, name] = splitIconId(id);
        if (prefix) (bySet[prefix] = bySet[prefix] || []).push(name);
      });
      const jobs = [];
      Object.keys(bySet).forEach((prefix) => {
        const names = Array.from(new Set(bySet[prefix])).sort(); // sorted → identical URLs → browser cache hits
        const base = cfg.api + "/" + prefix + ".json?icons=";
        let chunk = [];
        const flush = () => {
          if (chunk.length) {
            const c = chunk;
            jobs.push(
              this._iconFetch(base + c.join(","), signal).then((data) => {
                c.forEach((n) => {
                  this._iconSvgs[prefix + ":" + n] = iconDataToSvg(data, n);
                });
              }),
            );
            chunk = [];
          }
        };
        names.forEach((n) => {
          if (chunk.length && (base + chunk.join(",") + "," + n).length > 480)
            flush(); // Iconify recommends URLs ≤ 500 chars
          chunk.push(n);
        });
        flush();
      });
      await Promise.all(jobs);
    }

    /**
     * Add an icon by Iconify id ("prefix:name"). Single-color icons become one editable
     * vector path (fill, gradient, outline); multi-color icons become a group.
     */
    async addIcon(id, props) {
      const cfg = { api: this._iconApiBase() };
      const F = this.F;
      const [prefix, name] = splitIconId(id);
      if (!prefix || !name)
        throw new Error(
          'SlideCore.addIcon: expected "prefix:name", got "' + id + '"',
        );
      const id2 = prefix + ":" + name;
      const [, info] = await Promise.all([
        this._loadIconSvgs([id2]),
        this._iconSetInfo(prefix, cfg),
      ]);
      const svgText = this._iconSvgs[id2];
      if (!svgText)
        throw new Error('SlideCore.addIcon: icon "' + id + '" not found');
      const target = Math.round(Math.min(this.width, this.height) * 0.25);
      const color = this.opts.defaultIconColor || this._autoTextColor();
      const a = analyzeIconSvg(svgText, this._win());
      let o;
      if (a.kind === "fill" || a.kind === "stroke") {
        const k = target / Math.max(a.vbW, a.vbH);
        const path = scalePathData(
          F.util.makePathSimpler(F.util.parsePath(a.d)),
          k,
        );
        const base = {
          left: this.width / 2,
          top: this.height / 2,
          originX: "center",
          originY: "center",
          fillRule: a.fillRule,
        };
        o =
          a.kind === "fill"
            ? new F.Path(
                path,
                Object.assign(base, {
                  fill: color,
                  stroke: null,
                  strokeWidth: 0,
                }),
              )
            : new F.Path(
                path,
                Object.assign(base, {
                  fill: null,
                  stroke: color,
                  strokeWidth: round(a.strokeWidth * k, 2),
                  strokeLineCap: a.lineCap,
                  strokeLineJoin: a.lineJoin,
                }),
              );
      } else {
        // Multi-color or complex SVG: let Fabric parse it into a group.
        const fixed = svgText
          .replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/g, "$1")
          .replace(/(<svg[^>]*?)\s(width|height)="[^"]*"/g, "$1");
        const { objects, options } = await F.loadSVGFromString(fixed);
        const parts = objects.filter(Boolean);
        if (a.kind === "mono")
          parts.forEach((p) => {
            if (p.fill && p.fill !== "none") p.set("fill", color);
            if (p.stroke && p.stroke !== "none") p.set("stroke", color);
          });
        o = F.util.groupSVGElements(parts, options);
        const k = target / Math.max(o.width || 1, o.height || 1);
        o.set({
          left: this.width / 2,
          top: this.height / 2,
          originX: "center",
          originY: "center",
          scaleX: k,
          scaleY: k,
        });
      }
      o.seIcon = this._iconMeta(id2, a.kind, info);
      if (props) {
        const p = Object.assign({}, props);
        if (
          p.fill &&
          typeof p.fill === "object" &&
          !(p.fill instanceof F.Gradient)
        )
          p.fill = this._specToFill(this._normalizeSpec(p.fill), "object");
        o.set(p);
      }
      this._add(o);
      return o;
    }

    async _iconSetInfo(prefix, cfg) {
      if (this._iconInfo[prefix]) return this._iconInfo[prefix];
      try {
        const r = await fetch(
          cfg.api + "/collections?prefixes=" + encodeURIComponent(prefix),
        );
        if (r.ok) Object.assign(this._iconInfo, await r.json());
      } catch (_) {
        /* license info is optional */
      }
      return this._iconInfo[prefix] || {};
    }

    _iconMeta(id, kind, info) {
      const lic = info.license || {};
      const spdx = lic.spdx || "";
      return {
        id,
        kind,
        set: info.name || id.split(":")[0],
        author: (info.author && info.author.name) || "",
        authorUrl: (info.author && info.author.url) || "",
        license: lic.title || spdx || "",
        licenseUrl: lic.url || "",
        // CC BY / BY-SA licenses require visible credit; MIT, Apache, ISC, OFL, CC0 do not.
        attribution: /^CC-BY/i.test(spdx),
      };
    }

    /** Credits needed for icons on the slide whose licenses require attribution (one per icon set). */
    getAttributions() {
      const seen = {};
      const out = [];
      this._canvas.getObjects().forEach((o) => {
        const m = o.seIcon;
        if (!m || !m.attribution || seen[m.set]) return;
        seen[m.set] = true;
        out.push({
          set: m.set,
          author: m.author,
          license: m.license,
          licenseUrl: m.licenseUrl,
          text: m.set + (m.author ? " by " + m.author : "") + ", " + m.license,
        });
      });
      return out;
    }

    /**
     * Import SVG markup as editable vector objects (a group, or a single shape).
     * props.name is shown in the panel; other props are applied to the object.
     */
    async addSVG(svgText, props) {
      const F = this.F;
      props = Object.assign({}, props);
      const name = props.name || "SVG";
      delete props.name;
      let doc;
      try {
        doc = new (this._win().DOMParser)().parseFromString(
          String(svgText),
          "image/svg+xml",
        );
      } catch (_) {
        doc = null;
      }
      if (
        !doc ||
        doc.querySelector("parsererror") ||
        doc.documentElement.nodeName.toLowerCase() !== "svg"
      ) {
        const e = new Error("SlideCore.addSVG: not a valid SVG");
        e.seMessage = "It is not a valid SVG.";
        throw e;
      }
      // External bitmaps would block PNG export (cross-origin), and scripts never run here anyway.
      doc.querySelectorAll("image").forEach((el) => {
        const href =
          el.getAttribute("href") || el.getAttribute("xlink:href") || "";
        if (!/^data:/i.test(href)) el.remove();
      });
      doc.querySelectorAll("script,foreignObject").forEach((el) => el.remove());
      const markup = new (this._win().XMLSerializer)().serializeToString(doc);
      const { objects, options } = await F.loadSVGFromString(markup);
      const parts = objects.filter(Boolean);
      if (!parts.length) {
        const e = new Error("SlideCore.addSVG: no shapes found");
        e.seMessage = "No shapes were found in it.";
        throw e;
      }
      const o = F.util.groupSVGElements(parts, options);
      const target = Math.min(this.width, this.height) * 0.5;
      const k = target / Math.max(o.width || 1, o.height || 1);
      o.set({
        left: this.width / 2,
        top: this.height / 2,
        originX: "center",
        originY: "center",
        scaleX: k,
        scaleY: k,
      });
      o.seSvg = { name };
      this._svgInitPalette(o);
      if (Object.keys(props).length) o.set(props);
      this._add(o);
      return o;
    }

    _svgParts(o) {
      const out = [];
      const walk = (x) => {
        if (x instanceof this.F.Group) x.getObjects().forEach(walk);
        else out.push(x);
      };
      walk(o);
      return out;
    }

    _colorKey(c) {
      if (typeof c !== "string") return null;
      const v = c.trim().toLowerCase();
      if (
        !v ||
        v === "none" ||
        v === "transparent" ||
        v === "currentcolor" ||
        /^url\(/.test(v)
      )
        return null;
      return this._color(v).toRgba();
    }

    /** Remember each part's original colors, so palette edits always map from the originals. */
    _svgInitPalette(o) {
      const F = this.F;
      this._svgParts(o).forEach((p) => {
        if (p.seOrig) return;
        const orig = (v) =>
          v instanceof F.Gradient
            ? v.colorStops.map((st) => this._colorKey(st.color))
            : this._colorKey(v);
        p.seOrig = { fill: orig(p.fill), stroke: orig(p.stroke) };
      });
      o.seColors = o.seColors || {};
    }

    /** Distinct original colors, most used first. */
    _svgPalette(o) {
      this._svgInitPalette(o);
      const count = {};
      const add = (k) => {
        if (k) count[k] = (count[k] || 0) + 1;
      };
      this._svgParts(o).forEach((p) =>
        ["fill", "stroke"].forEach((prop) => {
          const v = p.seOrig[prop];
          if (Array.isArray(v)) v.forEach(add);
          else add(v);
        }),
      );
      return Object.keys(count).sort((a, b) => count[b] - count[a]);
    }

    _svgApplyColors(o) {
      const F = this.F,
        map = o.seColors || {};
      this._svgParts(o).forEach((p) => {
        ["fill", "stroke"].forEach((prop) => {
          const orig = p.seOrig && p.seOrig[prop];
          if (orig == null) return;
          if (Array.isArray(orig)) {
            if (p[prop] instanceof F.Gradient)
              p[prop].colorStops.forEach((st, i) => {
                if (orig[i]) st.color = map[orig[i]] || orig[i];
              });
          } else {
            p.set(prop, map[orig] || orig);
          }
        });
        p.dirty = true;
      });
      o.dirty = true;
      for (let g = o.group; g; g = g.group) g.dirty = true;
    }

    /* ======================= ID-based API (automation, MCP) ======================= */

    /**
     * Find an object by id or name (or pass the object itself). Without an argument, the
     * editor's selected object is used.
     */
    _obj(ref) {
      if (ref && typeof ref === "object" && typeof ref.set === "function")
        return ref;
      const objs = this._canvas.getObjects();
      if (ref == null || ref === "") {
        const a =
          this._canvas.getActiveObject && this._canvas.getActiveObject();
        if (a && !(a instanceof this.F.ActiveSelection)) return a;
        throw err("No object given.");
      }
      const s = String(ref);
      const o =
        objs.find((x) => x.seId === s) ||
        objs.find((x) => x.seName === s) ||
        objs.find(
          (x) => x.seName && x.seName.toLowerCase() === s.toLowerCase(),
        );
      if (!o)
        throw err(
          'No object with id or name "' +
            s +
            '". Describe the slide to see the current ids and names.',
        );
      return o;
    }

    /** Give objects without an id a stable one (based on their layer), so ids survive reloading. */
    _assignIds() {
      const objs = this._canvas.getObjects();
      const used = new Set(objs.map((o) => o.seId).filter(Boolean));
      objs.forEach((o, i) => {
        if (o.seId) return;
        let n = i + 1,
          id = "o" + n;
        while (used.has(id)) id = "o" + ++n + "x";
        o.seId = id;
        used.add(id);
      });
    }

    _kind(o) {
      const F = this.F;
      if (o instanceof F.FabricText) return "text";
      if (o.seIcon) return "icon";
      if (o.seSvg) return "svg";
      if (o instanceof F.FabricImage) return "image";
      if (o.seShape) return o.seShape;
      if (o instanceof F.Rect) return "rect";
      if (o instanceof F.Ellipse || o instanceof F.Circle) return "ellipse";
      if (o instanceof F.Line) return "line";
      if (o instanceof F.Group) return "group";
      return "path";
    }

    _niceColor(c) {
      if (typeof c !== "string") return c;
      const col = this._color(c);
      return col.getAlpha() >= 1
        ? "#" + col.toHex().slice(0, 6).toLowerCase()
        : col.toRgba();
    }

    _niceFill(fill) {
      if (!fill) return null;
      const p = this._specToPublic(this._fillToSpec(fill, "object"));
      if (typeof p === "string")
        return p === "transparent" ? null : this._niceColor(p);
      return {
        type: p.type,
        colors: p.colors.map((c) => this._niceColor(c)),
        angle: p.angle,
      };
    }

    /** One object as a compact, JSON-friendly description. Positions are slide pixels; x/y is the center. */
    _describe(o, layer) {
      const F = this.F,
        k = this._kind(o);
      o.setCoords();
      const c = o.getCenterPoint(),
        br = o.getBoundingRect();
      const d = { id: o.seId, kind: k };
      if (o.seName) d.name = o.seName;
      d.layer = layer == null ? this._canvas.getObjects().indexOf(o) : layer;
      d.x = round(c.x);
      d.y = round(c.y);
      d.width = round(o.width * Math.abs(o.scaleX));
      d.height = round(o.height * Math.abs(o.scaleY));
      if (o.angle) {
        const a = (((o.angle % 360) + 540) % 360) - 180;
        if (round(a, 1)) d.angle = round(a, 1);
      }
      if (o.opacity !== 1) d.opacity = round(o.opacity, 2);
      d.bounds = {
        left: round(br.left),
        top: round(br.top),
        right: round(br.left + br.width),
        bottom: round(br.top + br.height),
      };
      if (k === "text") {
        d.text = o.text;
        d.font = {
          family: firstFamily(o.fontFamily),
          size: round(o.fontSize, 1),
        };
        if (String(o.fontWeight) === "bold" || +o.fontWeight >= 600)
          d.font.bold = true;
        if (o.fontStyle === "italic") d.font.italic = true;
        if (o.underline) d.font.underline = true;
        d.font.align = o.textAlign;
        if (round(o.lineHeight, 2) !== 1.16)
          d.font.lineHeight = round(o.lineHeight, 2);
        if (o.charSpacing) d.font.letterSpacing = o.charSpacing;
        d.lines = (o._textLines || []).length;
        if (o.seFit) d.maxHeight = o.seFit.maxHeight;
      }
      const isGroup = o instanceof F.Group;
      if (k === "line") d.color = this._niceColor(o.stroke);
      else if (o.seIcon && o.seIcon.kind === "stroke")
        d.color = this._niceColor(o.stroke);
      else if (isGroup && o.seIcon && o.seIcon.kind === "mono") {
        const p = this._svgParts(o).find(
          (x) => typeof x.fill === "string" && x.fill !== "none",
        );
        if (p) d.fill = this._niceColor(p.fill);
      } else if (!isGroup && k !== "image") d.fill = this._niceFill(o.fill);
      if (
        k !== "line" &&
        !(o.seIcon && o.seIcon.kind === "stroke") &&
        o.stroke &&
        o.strokeWidth
      ) {
        d.stroke =
          typeof o.stroke === "string" ? this._niceColor(o.stroke) : "gradient";
        d.strokeWidth = round(o.strokeWidth, 1);
      }
      if (k === "line" || (o.seIcon && o.seIcon.kind === "stroke"))
        d.strokeWidth = round(o.strokeWidth, 1);
      if (o instanceof F.Rect && o.rx) d.cornerRadius = round(o.rx);
      if (k === "ngon") {
        d.sides = o.points.length;
        if (o.cornerRadius) d.cornerRadius = round(o.cornerRadius);
      }
      if (k === "blob") d.blob = o.seBlob;
      if (o.seIcon) {
        d.icon = o.seIcon.id;
        if (o.seIcon.attribution)
          d.credit =
            o.seIcon.set +
            (o.seIcon.author ? " by " + o.seIcon.author : "") +
            ", " +
            o.seIcon.license;
      }
      if (o.seSvg) d.svgName = o.seSvg.name;
      if (o.seSvg || (o.seIcon && o.seIcon.kind === "color")) {
        const pal = this._svgPalette(o);
        if (pal.length <= MAX_PALETTE)
          d.colors = pal.map((key) => ({
            original: this._niceColor(key),
            current: this._niceColor(o.seColors[key] || key),
          }));
        else d.colorCount = pal.length;
      }
      if (o.shadow)
        d.shadow = {
          color: this._niceColor(o.shadow.color),
          blur: round(o.shadow.blur),
          x: round(o.shadow.offsetX),
          y: round(o.shadow.offsetY),
        };
      if (o.flipX) d.flipX = true;
      if (o.flipY) d.flipY = true;
      return d;
    }

    /**
     * The whole slide as compact JSON: size, background, every object (front-most last) and
     * layout issues (objects outside the slide, text that does not fit, overlapping text).
     */
    describe(opts) {
      const o = Object.assign({ compact: false }, opts || {});
      const objs = this._canvas.getObjects();
      const out = {
        width: this.width,
        height: this.height,
        background:
          this._niceFill(this._specToFill(this._bg.spec, "object")) ||
          "transparent",
      };
      if (this._bg.opacity !== 1) out.backgroundOpacity = this._bg.opacity;
      // compact: leave out small unnamed decorations (dots, sparkles) and just count them
      const tiny = Math.min(this.width, this.height) * 0.03;
      const small = [];
      out.objects = [];
      objs.forEach((x, i) => {
        if (
          o.compact &&
          !x.seName &&
          !(x instanceof this.F.FabricText) &&
          x.width * Math.abs(x.scaleX) < tiny &&
          x.height * Math.abs(x.scaleY) < tiny
        )
          small.push(x.seId);
        else out.objects.push(this._describe(x, i));
      });
      if (small.length)
        out.smallDecorations = {
          count: small.length,
          ids: small,
          note: "small unnamed shapes left out; use get(id) for details",
        };
      out.issues = this._issues(objs).filter(
        (i) => !(i.id && small.includes(i.id)),
      );
      return out;
    }

    /** Description of one object (by id or name). */
    get(ref) {
      return this._describe(this._obj(ref));
    }

    _issues(objs) {
      const out = [],
        F = this.F,
        W = this.width,
        H = this.height;
      const rects = objs.map((o) => {
        o.setCoords();
        const b = o.getBoundingRect();
        return {
          o,
          l: b.left,
          t: b.top,
          r: b.left + b.width,
          b: b.top + b.height,
        };
      });
      rects.forEach(({ o, l, t, r, b }) => {
        const area = Math.max(1e-6, (r - l) * (b - t));
        const vis =
          (Math.max(0, Math.min(r, W) - Math.max(l, 0)) *
            Math.max(0, Math.min(b, H) - Math.max(t, 0))) /
          area;
        if (vis <= 0)
          out.push({
            id: o.seId,
            type: "off-slide",
            message: "completely outside the slide",
          });
        else if (vis < 0.995)
          out.push({
            id: o.seId,
            type: "partly-outside",
            visible: round(vis, 2),
            message:
              Math.round(vis * 100) +
              "% inside the slide (fine if intentional, e.g. decoration bleeding off the edge)",
          });
        if (o instanceof F.Textbox) {
          const tw = o.calcTextWidth();
          if (tw > o.width + 1)
            out.push({
              id: o.seId,
              type: "text-too-wide",
              message:
                "a word is " +
                Math.round(tw) +
                " px wide but the box is " +
                Math.round(o.width) +
                " px; widen the box or reduce fontSize",
            });
          if (o.seFit && o.height > o.seFit.maxHeight + 1)
            out.push({
              id: o.seId,
              type: "text-too-tall",
              message:
                "text is " +
                Math.round(o.height) +
                " px tall, maxHeight is " +
                o.seFit.maxHeight +
                " px even at the smallest size",
            });
        }
      });
      if (Array.isArray(this.opts.availableFonts)) {
        const have = new Set(
          this.opts.availableFonts.map((f) => String(f).toLowerCase()),
        );
        this.usedFonts()
          .filter((f) => !have.has(f.toLowerCase()))
          .forEach((f) =>
            out.push({
              type: "font-missing",
              family: f,
              message:
                'font "' +
                f +
                '" is not installed here; text is measured and drawn with a fallback font. Use one of: ' +
                this.opts.availableFonts.join(", "),
            }),
          );
      }
      const texts = rects.filter((x) => x.o instanceof F.FabricText);
      // text that sits on a shape (a bar, badge or box) but sticks out of it
      texts.forEach((t) => {
        const ti = objs.indexOf(t.o),
          cx = (t.l + t.r) / 2,
          cy = (t.t + t.b) / 2;
        const under = rects.filter(
          (x) =>
            objs.indexOf(x.o) < ti &&
            !(x.o instanceof F.FabricText) &&
            x.r - x.l < W * 0.9 &&
            x.b - x.t < H * 0.9 &&
            cx > x.l &&
            cx < x.r &&
            cy > x.t &&
            cy < x.b,
        );
        const box = under[under.length - 1];
        if (
          box &&
          (t.l < box.l - 2 ||
            t.r > box.r + 2 ||
            t.t < box.t - 2 ||
            t.b > box.b + 2)
        ) {
          out.push({
            id: t.o.seId,
            type: "text-outside-shape",
            shape: box.o.seId,
            message:
              "the text sticks out of the shape behind it (" +
              (box.o.seName || box.o.seId) +
              "); use maxHeight, a smaller fontSize, a wider box, or enlarge the shape",
          });
        }
      });
      for (let i = 0; i < texts.length; i++)
        for (let j = i + 1; j < texts.length; j++) {
          const a = texts[i],
            b = texts[j];
          const ix = Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)),
            iy = Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
          const small = Math.min(
            (a.r - a.l) * (a.b - a.t),
            (b.r - b.l) * (b.b - b.t),
          );
          if (ix * iy > 0.12 * small)
            out.push({
              ids: [a.o.seId, b.o.seId],
              type: "text-overlap",
              message: "these text boxes overlap",
            });
        }
      return out;
    }

    /**
     * Add an element. spec.type: text | rect | ellipse | triangle | star | line | blob | ngon | image | icon | svg,
     * plus any property accepted by update(). Type-specific: text (text), sides (ngon 3–20),
     * blob (0–19), src (image URL or data URL), icon (Iconify id), svg (markup) + svgName.
     * Returns the new object's description.
     */
    async add(spec) {
      spec = Object.assign({}, spec);
      const type = spec.type;
      if (!KINDS.includes(type))
        throw err(
          'Unknown element type "' +
            type +
            '". Use one of: ' +
            KINDS.join(", ") +
            ".",
        );
      ["type"].forEach((k) => delete spec[k]);
      let o = null;
      this._batch++;
      try {
        if (type === "text")
          o = this.addText(spec.text != null ? String(spec.text) : "Text");
        else if (SHAPES.includes(type)) {
          if (
            type === "ngon" &&
            spec.sides != null &&
            !(spec.sides >= 3 && spec.sides <= 20)
          )
            throw err("sides must be 3–20.");
          if (
            type === "blob" &&
            spec.blob != null &&
            !(spec.blob >= 0 && spec.blob < BLOBS.length)
          )
            throw err("blob must be 0–" + (BLOBS.length - 1) + ".");
          o = this.addShape(type, { sides: spec.sides, blob: spec.blob });
        } else if (type === "image") {
          if (!spec.src)
            throw err('An image needs "src" (an https URL or a data: URL).');
          o = await this.addImage(spec.src);
        } else if (type === "icon") {
          if (!spec.icon)
            throw err(
              'An icon needs "icon", an Iconify id like "mdi:coffee" (find ids with searchIcons).',
            );
          o = await this.addIcon(spec.icon);
        } else if (type === "svg") {
          if (!spec.svg) throw err('An svg element needs "svg" (SVG markup).');
          o = await this.addSVG(spec.svg, { name: spec.svgName || "SVG" });
        }
        ["text", "sides", "blob", "src", "icon", "svg", "svgName"].forEach(
          (k) => {
            if (k !== "text" || type === "text") delete spec[k];
          },
        );
        this._applyProps(o, spec);
      } catch (e) {
        if (o) this._canvas.remove(o);
        throw e;
      } finally {
        this._batch--;
      }
      this._commit();
      return this._describe(o);
    }

    /** Change an object (by id or name). See PROPS for the accepted properties. Returns its new description. */
    update(ref, props) {
      const o = this._obj(ref);
      this._applyProps(o, props || {});
      this._canvas.requestRenderAll();
      this._commit();
      return this._describe(o);
    }

    remove(ref) {
      const o = this._obj(ref);
      this._canvas.remove(o);
      this._canvas.requestRenderAll();
      this._commit();
      return { removed: o.seId };
    }

    /** Copy an object, optionally changing the copy right away (e.g. { x, y, text }). */
    async duplicate(ref, changes) {
      const src = this._obj(ref);
      const cl = await src.clone(SE_PROPS);
      cl.seId = null;
      cl.seName = undefined;
      const off = Math.round(Math.min(this.width, this.height) * 0.02);
      cl.set({ left: cl.left + off, top: cl.top + off });
      this._batch++;
      try {
        this._add(cl);
        this._canvas.moveObjectTo(
          cl,
          this._canvas.getObjects().indexOf(src) + 1,
        );
        if (changes) this._applyProps(cl, changes);
      } finally {
        this._batch--;
      }
      this._commit();
      return this._describe(cl);
    }

    /** Set the text of named text objects: setFields({ title: 'Back at 20:15' }). */
    setFields(fields) {
      const updated = [],
        missing = [];
      this._batch++;
      try {
        Object.keys(fields || {}).forEach((name) => {
          const objs = this._canvas
            .getObjects()
            .filter((o) => o.seName === name && o instanceof this.F.FabricText);
          if (!objs.length) {
            missing.push(name);
            return;
          }
          objs.forEach((o) => {
            this._applyProps(o, { text: String(fields[name]) });
            updated.push(o.seId);
          });
        });
      } finally {
        this._batch--;
      }
      this._canvas.requestRenderAll();
      if (updated.length) this._commit();
      return { updated, missing };
    }

    /** Run several changes as one step (one change event; one undo step in the editor). */
    async batch(fn) {
      this._batch++;
      try {
        return await fn(this);
      } finally {
        this._batch--;
        if (!this._batch) {
          this._canvas.requestRenderAll();
          this._commit();
        }
      }
    }

    /** Search Iconify. set: 'icons' | 'emoji' | 'all'. Returns ids for add({ type: 'icon', icon }). */
    async searchIcons(query, opts) {
      const o = Object.assign(
        { set: "icons", limit: 32, start: 0 },
        opts || {},
      );
      const filters =
        (this.opts.icons && this.opts.icons.filters) || DEFAULT_ICON_FILTERS;
      const f = filters.find((x) => x.key === o.set) || filters[0];
      const params = new URLSearchParams({
        query: String(query || ""),
        limit: String(clamp(o.limit, 32, 999)),
        start: String(o.start || 0),
      });
      if (f.prefixes && f.prefixes.length)
        params.set("prefixes", f.prefixes.join(","));
      const data = await this._iconFetch(
        this._iconApiBase() + "/search?" + params,
      );
      Object.assign(this._iconInfo, data.collections || {});
      const icons = (data.icons || []).slice(0, o.limit).map((id) => {
        const info = this._iconInfo[id.split(":")[0]] || {};
        const lic = info.license || {};
        const r = {
          id,
          set: info.name || id.split(":")[0],
          license: lic.title || lic.spdx || "unknown",
        };
        if (/^CC-BY/i.test(lic.spdx || "")) r.creditRequired = true;
        if (info.palette) r.multicolor = true;
        return r;
      });
      return { icons, more: (data.icons || []).length >= o.limit };
    }

    /** What this document supports (element types, shapes, fonts, icon sets, properties). */
    capabilities() {
      const filters =
        (this.opts.icons && this.opts.icons.filters) || DEFAULT_ICON_FILTERS;
      return {
        version: VERSION,
        size: { width: this.width, height: this.height },
        elementTypes: KINDS.slice(),
        blobs: BLOBS.length,
        ngonSides: [3, 20],
        fonts: this.fonts.map((f) => f.name),
        iconSets: filters.map((f) => ({ key: f.key, label: f.label })),
        properties: Object.assign({}, PROPS),
      };
    }

    _fitText(o) {
      if (!o.seFit || !(o instanceof this.F.Textbox)) return;
      const c = o.getCenterPoint();
      let fs = o.seFit.maxFontSize;
      o.set("fontSize", fs);
      o.initDimensions();
      let guard = 0;
      while (
        (o.height > o.seFit.maxHeight + 0.5 ||
          o.calcTextWidth() > o.width + 0.5) &&
        fs > 6 &&
        guard++ < 90
      ) {
        fs = Math.max(6, fs * 0.96);
        o.set("fontSize", round(fs, 1));
        o.initDimensions();
      }
      o.setPositionByOrigin(c, "center", "center");
      o.setCoords();
    }

    _setSize(o, w, hgt) {
      const F = this.F,
        k = this._kind(o);
      if (w != null && !(w > 0)) throw err("width must be a positive number.");
      if (hgt != null && !(hgt > 0))
        throw err("height must be a positive number.");
      const c = o.getCenterPoint();
      if (o instanceof F.Textbox) {
        if (hgt != null)
          throw err(
            "Text height follows from fontSize and wrapping. Set fontSize, or maxHeight to shrink the text until it fits.",
          );
        o.set("width", Math.max(10, w));
        o.initDimensions();
      } else if (o instanceof F.Rect) {
        o.set({
          width: w != null ? w : o.width * Math.abs(o.scaleX),
          height: hgt != null ? hgt : o.height * Math.abs(o.scaleY),
          scaleX: 1,
          scaleY: 1,
        });
      } else if (o instanceof F.Ellipse) {
        o.set({
          rx: (w != null ? w : o.rx * 2 * Math.abs(o.scaleX)) / 2,
          ry: (hgt != null ? hgt : o.ry * 2 * Math.abs(o.scaleY)) / 2,
          scaleX: 1,
          scaleY: 1,
        });
      } else if (k === "ngon" || k === "triangle") {
        // one value keeps the proportions, two set both
        if (w != null && hgt != null)
          o.set({ scaleX: w / o.width, scaleY: hgt / o.height });
        else {
          const f =
            w != null
              ? w / (o.width * Math.abs(o.scaleX))
              : hgt / (o.height * Math.abs(o.scaleY));
          o.set({ scaleX: o.scaleX * f, scaleY: o.scaleY * f });
        }
        if (k === "ngon") this._bakePolyScale(o);
      } else if (k === "line") {
        if (hgt != null)
          throw err(
            "A line has no height; use width (its length), angle and strokeWidth.",
          );
        o.set("scaleX", w / o.width);
      } else {
        // pictures, icons, blobs, stars: one value keeps the proportions
        if (w != null && hgt != null)
          o.set({ scaleX: w / o.width, scaleY: hgt / o.height });
        else {
          const s = w != null ? w / o.width : hgt / o.height;
          o.set({ scaleX: s, scaleY: s });
        }
      }
      o.setPositionByOrigin(c, "center", "center");
      o.setCoords();
    }

    _applyProps(o, p) {
      const F = this.F,
        k = this._kind(o),
        isText = o instanceof F.Textbox,
        isGroup = o instanceof F.Group;
      const keys = Object.keys(p || {});
      const unknown = keys.filter((x) => !(x in PROPS));
      if (unknown.length)
        throw err(
          "Unknown propert" +
            (unknown.length > 1 ? "ies" : "y") +
            " " +
            unknown.map((x) => '"' + x + '"').join(", ") +
            ". Allowed: " +
            Object.keys(PROPS).join(", ") +
            ".",
        );
      const textOnly = [
        "text",
        "fontFamily",
        "fontSize",
        "bold",
        "italic",
        "underline",
        "align",
        "lineHeight",
        "letterSpacing",
        "maxHeight",
      ];
      const bad = keys.filter((x) => textOnly.includes(x) && !isText);
      if (bad.length)
        throw err(
          bad.join(", ") +
            (bad.length > 1 ? " only apply" : " only applies") +
            " to text, but this object is a " +
            k +
            ".",
        );
      const num = (name, v, lo, hi) => {
        if (typeof v !== "number" || !isFinite(v))
          throw err(name + " must be a number.");
        return lo != null ? clamp(v, lo, hi) : v;
      };

      if ("name" in p) o.seName = p.name ? String(p.name) : undefined;

      // text content and typography
      if (isText) {
        if ("text" in p) o.set("text", String(p.text));
        if ("fontFamily" in p) o.set("fontFamily", String(p.fontFamily));
        if ("fontSize" in p) {
          o.set("fontSize", num("fontSize", p.fontSize, 4, 2000));
          if (o.seFit) o.seFit.maxFontSize = o.fontSize;
        }
        if ("bold" in p) o.set("fontWeight", p.bold ? "bold" : "normal");
        if ("italic" in p) o.set("fontStyle", p.italic ? "italic" : "normal");
        if ("underline" in p) o.set("underline", !!p.underline);
        if ("align" in p) {
          if (!["left", "center", "right", "justify"].includes(p.align))
            throw err("align must be left, center, right or justify.");
          o.set("textAlign", p.align);
        }
        if ("lineHeight" in p)
          o.set("lineHeight", num("lineHeight", p.lineHeight, 0.5, 4));
        if ("letterSpacing" in p)
          o.set(
            "charSpacing",
            num("letterSpacing", p.letterSpacing, -500, 2000),
          );
        o.initDimensions();
      }

      if ("width" in p || "height" in p)
        this._setSize(
          o,
          p.width != null ? num("width", p.width) : null,
          p.height != null ? num("height", p.height) : null,
        );

      if (isText && "maxHeight" in p) {
        if (p.maxHeight == null || p.maxHeight === false) o.seFit = undefined;
        else
          o.seFit = {
            maxHeight: num("maxHeight", p.maxHeight, 10, 100000),
            maxFontSize:
              o.seFit && !("fontSize" in p) ? o.seFit.maxFontSize : o.fontSize,
          };
      }
      if (isText && o.seFit) this._fitText(o);

      // colors
      if ("fill" in p) {
        const strokeIcon = o.seIcon && o.seIcon.kind === "stroke";
        if (k === "line" || strokeIcon) {
          if (typeof p.fill !== "string")
            throw err(
              "This " +
                k +
                " is drawn with a line; fill must be a plain color.",
            );
          o.set("stroke", p.fill);
        } else if (isGroup && o.seIcon && o.seIcon.kind === "mono") {
          if (typeof p.fill !== "string")
            throw err("This icon takes a plain color.");
          this._svgParts(o).forEach((x) => {
            if (x.fill && x.fill !== "none") x.set("fill", p.fill);
            if (x.stroke && x.stroke !== "none") x.set("stroke", p.fill);
          });
          o.dirty = true;
        } else if (isGroup || k === "image") {
          throw err(
            k === "image"
              ? "Pictures have no fill."
              : 'This graphic has several colors; change them with "colors".',
          );
        } else {
          o.set(
            "fill",
            p.fill == null
              ? null
              : this._specToFill(this._normalizeSpec(p.fill), "object"),
          );
        }
      }
      if ("stroke" in p || "strokeWidth" in p) {
        if (isGroup || k === "image")
          throw err("Outlines are not supported on this " + k + ".");
        if ("stroke" in p && p.stroke != null && typeof p.stroke !== "string")
          throw err("stroke must be a color string or null.");
        if ("stroke" in p) o.set("stroke", p.stroke || null);
        if ("strokeWidth" in p)
          o.set("strokeWidth", num("strokeWidth", p.strokeWidth, 0, 500));
        else if (p.stroke && !o.strokeWidth)
          o.set(
            "strokeWidth",
            isText
              ? Math.max(1, Math.round(o.fontSize / 30))
              : Math.max(
                  2,
                  Math.round(Math.min(this.width, this.height) / 200),
                ),
          );
        if (isText) o.set("paintFirst", "stroke");
      }
      if ("cornerRadius" in p) {
        const r = num("cornerRadius", p.cornerRadius, 0, 100000);
        if (o instanceof F.Rect) o.set({ rx: r, ry: r });
        else if (k === "ngon") o.set("cornerRadius", r);
        else throw err("cornerRadius applies to rect and ngon only.");
      }
      if ("colors" in p) {
        if (!(o.seSvg || (o.seIcon && o.seIcon.kind === "color")))
          throw err('"colors" applies to multi-color icons and imported SVGs.');
        const pal = this._svgPalette(o);
        const norm = (c) => this._colorKey(String(c));
        if (p.colors == null) o.seColors = {};
        else if (Array.isArray(p.colors)) {
          p.colors.forEach((c, i) => {
            if (i < pal.length && c != null) o.seColors[pal[i]] = norm(c);
          });
        } else {
          Object.keys(p.colors).forEach((key) => {
            const kk = norm(key);
            if (!pal.includes(kk))
              throw err(
                "Color " +
                  key +
                  " is not in this graphic. Its colors are: " +
                  pal.map((x) => this._niceColor(x)).join(", ") +
                  ".",
              );
            o.seColors[kk] = norm(p.colors[key]);
          });
        }
        this._svgApplyColors(o);
      }
      if ("shadow" in p) {
        const s = p.shadow,
          size = Math.max(
            4,
            Math.round(Math.min(this.width, this.height) * 0.012),
          );
        if (!s) o.set("shadow", null);
        else if (s === true)
          o.set(
            "shadow",
            new F.Shadow({
              color: "rgba(0,0,0,0.45)",
              blur: Math.round(size * 2.5),
              offsetX: Math.round(size * 0.6),
              offsetY: size,
            }),
          );
        else
          o.set(
            "shadow",
            new F.Shadow({
              color: s.color || "rgba(0,0,0,0.45)",
              blur: s.blur != null ? s.blur : size * 2,
              offsetX: s.x || 0,
              offsetY: s.y != null ? s.y : size,
            }),
          );
      }

      // placement
      if ("opacity" in p) o.set("opacity", num("opacity", p.opacity, 0, 1));
      if ("flipX" in p) o.set("flipX", !!p.flipX);
      if ("flipY" in p) o.set("flipY", !!p.flipY);
      if ("angle" in p) {
        const c = o.getCenterPoint();
        o.set("angle", ((num("angle", p.angle) % 360) + 360) % 360);
        o.setPositionByOrigin(c, "center", "center");
      }
      if ("x" in p || "y" in p) {
        const c = o.getCenterPoint();
        o.setPositionByOrigin(
          new F.Point(
            "x" in p ? num("x", p.x) : c.x,
            "y" in p ? num("y", p.y) : c.y,
          ),
          "center",
          "center",
        );
      }
      o.setCoords();
      if ("alignTo" in p) {
        [].concat(p.alignTo).forEach((where) => {
          if (
            !["left", "center", "right", "top", "middle", "bottom"].includes(
              where,
            )
          )
            throw err(
              "alignTo must be left, center, right, top, middle or bottom (or a list of them).",
            );
          const br = o.getBoundingRect();
          let dx = 0,
            dy = 0;
          if (where === "left") dx = -br.left;
          if (where === "center")
            dx = this.width / 2 - (br.left + br.width / 2);
          if (where === "right") dx = this.width - (br.left + br.width);
          if (where === "top") dy = -br.top;
          if (where === "middle")
            dy = this.height / 2 - (br.top + br.height / 2);
          if (where === "bottom") dy = this.height - (br.top + br.height);
          o.set({ left: o.left + dx, top: o.top + dy });
          o.setCoords();
        });
      }
      if ("layer" in p) {
        const c = this._canvas,
          v = p.layer;
        if (v === "front") c.bringObjectToFront(o);
        else if (v === "back") c.sendObjectToBack(o);
        else if (v === "forward") c.bringObjectForward(o);
        else if (v === "backward") c.sendObjectBackwards(o);
        else if (typeof v === "number")
          c.moveObjectTo(o, clamp(Math.round(v), 0, c.getObjects().length - 1));
        else
          throw err(
            "layer must be front, back, forward, backward or a layer number (0 = back).",
          );
      }
      o.dirty = true;
    }
  }

  /** Properties accepted by add() and update(), with a short description each. */
  const PROPS = {
    name: "label for referring to the object later (setFields uses it for text)",
    x: "center x in slide pixels",
    y: "center y in slide pixels",
    width:
      "width in px (text: wrap width; rect/ellipse change only the width; other shapes, pictures and icons keep proportions if height is omitted)",
    height: "height in px (not for text or lines)",
    angle: "rotation in degrees, clockwise",
    opacity: "0–1",
    fill: 'color (#hex, rgba(), name), gradient {type:"linear"|"radial", colors:[c1,c2], angle}, or null; for lines and line icons this is the line color',
    stroke: "outline color or null",
    strokeWidth: "outline width in px",
    text: "text content (\\n for line breaks)",
    fontFamily: "font name",
    fontSize: "px",
    bold: "true/false",
    italic: "true/false",
    underline: "true/false",
    align: "left | center | right | justify",
    lineHeight: "multiple of font size, e.g. 1.1",
    letterSpacing: "thousandths of an em, e.g. 50",
    maxHeight:
      "text only: shrink the font (from fontSize down) until the text fits this height and its width; null turns it off",
    cornerRadius: "rounded corners in px (rect, ngon)",
    shadow: "false, true, or {color, blur, x, y}",
    colors:
      'multi-color icons/SVGs: {"<original color>": "<new color>"} or a list in the order of describe().colors; null resets',
    flipX: "mirror horizontally",
    flipY: "mirror vertically",
    alignTo:
      "left | center | right | top | middle | bottom, or a list, relative to the slide",
    layer: "front | back | forward | backward | layer number (0 = back)",
  };

  return {
    version: VERSION,
    Doc,
    SE_PROPS,
    PROPS,
    DEFAULT_ICON_FILTERS,
    DEFAULT_FONTS,
    parseFontImport,
    /** Create a headless slide document. */
    create(options) {
      return new Doc(options);
    },
    /** Load a slide JSON into a new headless document. */
    async fromJSON(json, options) {
      const data = typeof json === "string" ? JSON.parse(json) : json;
      const doc = new Doc(
        Object.assign(
          { width: data.width || 1920, height: data.height || 1080 },
          options || {},
        ),
      );
      await doc.load(data);
      return doc;
    },
    // shared with slide-editor.js
    _internal: {
      BLOBS,
      blobPath,
      regularPolygon,
      starPoints,
      ngonClass,
      clamp,
      round,
      firstFamily,
      splitIconId,
      iconDataToSvg,
      analyzeIconSvg,
      dataURLtoBlob,
      IS_NODE,
    },
  };
});
