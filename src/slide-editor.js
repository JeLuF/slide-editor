/*!
 * SlideEditor 1.0.0
 * A small, embeddable slide / announcement-screen editor built on Fabric.js (v6+) and SlideCore.
 * Load fabric.js, then slide-core.js, then slide-editor.js.
 * License: 0BSD
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports)
    module.exports = factory(require("./slide-core.js"));
  else root.SlideEditor = factory(root.SlideCore);
})(typeof self !== "undefined" ? self : this, function (Core) {
  "use strict";

  if (!Core || !Core.Doc)
    throw new Error(
      "SlideEditor: slide-core.js must be loaded before slide-editor.js.",
    );
  const VERSION = Core.version;
  const { DEFAULT_ICON_FILTERS, DEFAULT_FONTS, SE_PROPS } = Core;
  const {
    BLOBS,
    blobPath,
    regularPolygon,
    ngonClass,
    clamp,
    round,
    firstFamily,
    splitIconId,
  } = Core._internal;

  /* ------------------------------------------------------------------ */
  /* Styles                                                             */
  /* ------------------------------------------------------------------ */

  const DARK_VARS =
    "--se-accent:#60a5fa;--se-bg:#18181b;--se-surface:#232326;--se-border:#3f3f46;--se-text:#f4f4f5;--se-muted:#a1a1aa;--se-hover:#33333a;--se-stage:#0c0c0e;";

  const CSS = `
.se-root{--se-accent:#2563eb;--se-on-accent:#fff;--se-bg:#f4f4f5;--se-surface:#fff;--se-border:#e4e4e7;--se-text:#18181b;--se-muted:#71717a;--se-hover:#f1f1f3;--se-stage:#e7e7ea;
  font:13px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--se-text);display:flex;flex-direction:column;height:100%;min-height:420px;
  background:var(--se-bg);border:1px solid var(--se-border);border-radius:8px;overflow:hidden;outline:none;box-sizing:border-box;position:relative}
.se-root *,.se-root *::before,.se-root *::after{box-sizing:border-box}
.se-root.se-dark{${DARK_VARS}}
@media (prefers-color-scheme: dark){.se-root.se-auto{${DARK_VARS}}}
.se-toolbar{display:flex;align-items:center;gap:2px;padding:6px 8px;background:var(--se-surface);border-bottom:1px solid var(--se-border);flex-wrap:wrap}
.se-sep{width:1px;height:20px;background:var(--se-border);margin:0 6px}
.se-spacer{flex:1}
.se-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;height:32px;min-width:32px;padding:0 8px;border:1px solid transparent;border-radius:6px;
  background:transparent;color:inherit;font:inherit;cursor:pointer;white-space:nowrap}
.se-btn:hover:not(:disabled){background:var(--se-hover)}
.se-btn:focus-visible{outline:2px solid var(--se-accent);outline-offset:1px}
.se-btn:disabled{opacity:.38;cursor:default}
.se-btn[aria-pressed="true"]{background:color-mix(in srgb,var(--se-accent) 16%,transparent);color:var(--se-accent)}
.se-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex:none}
.se-btn.se-primary{background:var(--se-accent);color:var(--se-on-accent)}
.se-btn.se-primary:hover:not(:disabled){background:color-mix(in srgb,var(--se-accent) 85%,#000)}
.se-btn.se-outline{border-color:var(--se-border)}
.se-body{flex:1;display:flex;min-height:0}
.se-stage{flex:1;min-width:0;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;background:var(--se-stage);overflow:hidden}
.se-stage .canvas-container{box-shadow:0 1px 3px rgba(0,0,0,.18),0 10px 30px rgba(0,0,0,.14)}
.se-stage canvas.lower-canvas{background:repeating-conic-gradient(#d4d4d8 0 25%,#fafafa 0 50%) 0 0/16px 16px}
.se-stage.se-drop::after{content:attr(data-drop);position:absolute;inset:10px;border:2px dashed var(--se-accent);border-radius:10px;display:flex;align-items:center;
  justify-content:center;color:var(--se-accent);font-weight:600;background:color-mix(in srgb,var(--se-accent) 10%,transparent);pointer-events:none}
.se-panel{width:268px;flex:none;background:var(--se-surface);border-left:1px solid var(--se-border);overflow-y:auto;overflow-x:hidden}
.se-panel,.se-igrid,.se-pop{scrollbar-color:var(--se-border) var(--se-surface)}
.se-narrow .se-body{flex-direction:column}
.se-narrow .se-panel{width:auto;border-left:0;border-top:1px solid var(--se-border);height:42%}
.se-sec{padding:12px 14px;border-bottom:1px solid var(--se-border)}
.se-sec:last-child{border-bottom:0}
.se-sec-title{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.06em;color:var(--se-muted);margin-bottom:8px}
.se-row{display:flex;align-items:center;gap:8px;margin:7px 0}
.se-lbl{width:54px;flex:none;color:var(--se-muted)}
.se-ctrl{flex:1;display:flex;align-items:center;gap:6px;min-width:0}
.se-root input[type=number],.se-root select{height:28px;border:1px solid var(--se-border);border-radius:6px;background:var(--se-surface);color:inherit;font:inherit;
  padding:0 6px;width:100%;min-width:0}
.se-root input[type=number]:focus,.se-root select:focus{outline:2px solid color-mix(in srgb,var(--se-accent) 45%,transparent);border-color:var(--se-accent)}
.se-root input[type=color]{width:30px;height:28px;border:1px solid var(--se-border);border-radius:6px;padding:2px;background:var(--se-surface);flex:none;cursor:pointer}
.se-root input[type=range]{flex:1;min-width:0;accent-color:var(--se-accent)}
.se-root input[type=checkbox]{accent-color:var(--se-accent);width:15px;height:15px;margin:0}
.se-val{width:38px;flex:none;text-align:right;color:var(--se-muted);font-variant-numeric:tabular-nums}
.se-group{display:inline-flex;gap:2px;background:var(--se-bg);border-radius:7px;padding:2px}
.se-group{max-width:100%}
.se-group .se-btn{height:28px;min-width:0;max-width:32px;flex:1 1 0;padding:0 2px}
.se-glyph{font-weight:700;font-family:Georgia,"Times New Roman",serif;font-size:15px}
.se-hint{color:var(--se-muted);font-size:12px;margin:2px 0 0}
.se-actions{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.se-file{display:none}
.se-import textarea{width:100%;box-sizing:border-box;border:1px solid var(--se-border);border-radius:6px;background:var(--se-surface);color:inherit;font:12px/1.4 monospace;padding:6px;resize:vertical}
.se-import .se-error{color:#dc2626}
.se-root select option.se-import-opt{font-weight:600}
.se-btn .se-caret{width:12px;height:12px;margin-left:-4px;opacity:.6}
.se-split{display:inline-flex}
.se-split>.se-btn:first-child{border-top-right-radius:0;border-bottom-right-radius:0;padding-right:4px;gap:3px}
.se-split>.se-btn:last-child{border-top-left-radius:0;border-bottom-left-radius:0;min-width:18px;padding:0 2px}
.se-split>.se-btn:last-child .se-caret{margin:0}
.se-nlabel{font-size:11px;font-weight:600;font-variant-numeric:tabular-nums;min-width:12px;text-align:left}
.se-pop.se-npop{grid-template-columns:repeat(6,44px)}
.se-npop .se-btn{flex-direction:column;gap:0;font-size:10px;line-height:1}
.se-pop.se-npop .se-btn svg{width:26px;height:26px;fill:none;stroke:currentColor;stroke-width:1.5;stroke-linejoin:round}
.se-seg{display:inline-flex;background:var(--se-bg);border-radius:7px;padding:2px;gap:2px}
.se-seg .se-btn{height:26px;padding:0 10px;font-size:12px}
.se-pop{position:absolute;z-index:30;display:grid;grid-template-columns:repeat(5,44px);gap:4px;padding:8px;background:var(--se-surface);
  border:1px solid var(--se-border);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18)}
.se-pop[hidden]{display:none}
.se-ipop{position:absolute;z-index:30;width:min(440px,calc(100% - 16px));display:flex;flex-direction:column;gap:8px;padding:10px;background:var(--se-surface);
  border:1px solid var(--se-border);border-radius:10px;box-shadow:0 8px 28px rgba(0,0,0,.18);max-height:min(520px,calc(100% - 60px))}
.se-ipop[hidden]{display:none}
.se-ipop .se-isearch{display:flex;gap:6px}
.se-ipop input[type=search]{flex:1;min-width:0;height:32px;border:1px solid var(--se-border);border-radius:6px;background:var(--se-bg);color:inherit;font:inherit;padding:0 10px}
.se-ipop input[type=search]:focus{outline:2px solid color-mix(in srgb,var(--se-accent) 45%,transparent);border-color:var(--se-accent)}
.se-ipop select{width:auto;flex:none;height:32px}
.se-igrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:4px;overflow-y:auto;min-height:60px;align-content:start}
.se-igrid .se-btn{height:46px;padding:6px}
.se-igrid img{width:30px;height:30px;display:block}
.se-istatus{color:var(--se-muted);font-size:12px;padding:6px 2px}
.se-istatus:empty{display:none}
.se-iupload{display:flex;align-items:center;gap:8px;padding-top:8px;border-top:1px solid var(--se-border);color:var(--se-muted);font-size:12px}
.se-ifoot{display:flex;align-items:center;justify-content:space-between;gap:8px;color:var(--se-muted);font-size:11px}
.se-ifoot a,.se-sec a{color:var(--se-accent)}
.se-credit{font-size:12px;margin-top:6px;padding:8px;border-radius:6px;background:color-mix(in srgb,#f59e0b 14%,transparent)}
.se-pop .se-btn{width:44px;height:44px;padding:4px}
.se-pop .se-btn svg{width:34px;height:34px;fill:currentColor;stroke:none}
`;

  /* UI color option → CSS variable names */
  const COLOR_VARS = {
    accent: "--se-accent",
    onAccent: "--se-on-accent",
    background: "--se-bg",
    surface: "--se-surface",
    border: "--se-border",
    text: "--se-text",
    muted: "--se-muted",
    hover: "--se-hover",
    stage: "--se-stage",
  };
  let instanceCount = 0;

  function cssColor(v) {
    // only plain color values; blocks anything that could break out of the declaration
    return typeof v === "string" && v.trim() && !/[;{}<>\\]/.test(v)
      ? v.trim()
      : null;
  }

  function colorDecls(c) {
    return Object.keys(COLOR_VARS)
      .map((k) => {
        const v = cssColor(c && c[k]);
        return v ? COLOR_VARS[k] + ":" + v + ";" : "";
      })
      .join("");
  }

  function injectCSS() {
    if (typeof document === "undefined" || document.getElementById("se-styles"))
      return;
    const s = document.createElement("style");
    s.id = "se-styles";
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ------------------------------------------------------------------ */
  /* Icons (24×24, stroked)                                              */
  /* ------------------------------------------------------------------ */

  const ICONS = {
    text: '<path d="M5 7V5h14v2M12 5v14M9 19h6"/>',
    rect: '<rect x="4" y="5" width="16" height="14" rx="1.5"/>',
    ellipse: '<circle cx="12" cy="12" r="8"/>',
    triangle: '<path d="M12 4 21 20H3z"/>',
    star: '<path d="M12 3.5l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 17l-5.4 3 1.2-6-4.5-4.2 6.1-.7z"/>',
    line: '<path d="M5 19 19 5"/>',
    image:
      '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/>',
    undo: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>',
    redo: '<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>',
    duplicate:
      '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    forward: '<path d="M12 19V6M6 11l6-6 6 6"/>',
    backward: '<path d="M12 5v13M6 13l6 6 6-6"/>',
    front: '<path d="M12 20V9M7 13l5-5 5 5M5 4h14"/>',
    back: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    crop: '<path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M2 6h14a2 2 0 0 1 2 2v14"/>',
    check: '<path d="m5 12 5 5L20 7"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    flipH:
      '<path d="M12 3v18"/><path d="M8 7 3 12l5 5z"/><path d="m16 7 5 5-5 5z"/>',
    flipV:
      '<path d="M3 12h18"/><path d="M7 8l5-5 5 5z"/><path d="m7 16 5 5 5-5z"/>',
    alignL: '<path d="M4 3v18M8 7h12v4H8zM8 14h7v4H8z"/>',
    alignCH: '<path d="M12 3v18M6 7h12v4H6zM8.5 14h7v4h-7z"/>',
    alignR: '<path d="M20 3v18M4 7h12v4H4zM9 14h7v4H9z"/>',
    alignT: '<path d="M3 4h18M7 8v12h4V8zM14 8v7h4V8z"/>',
    alignCV: '<path d="M3 12h18M7 6v12h4V6zM14 8.5v7h4v-7z"/>',
    alignB: '<path d="M3 20h18M7 4v12h4V4zM14 9v7h4V9z"/>',
    tLeft: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    tCenter: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    tRight: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    ngon: '<path d="M12 3.5 20.1 9.4 17 18.9H7L3.9 9.4z"/>',
    blob: '<path d="M8.5 5.5c2.6-1.6 6.2-.9 8.2 1 2.4 2.2 3.5 6 2.3 9.1-1.4 3.4-5.5 4.6-8.8 3.6-3-.9-5.9-3.4-6.1-6.6-.1-2.7 2-5.6 4.4-7.1z"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    icons:
      '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5a4.5 4.5 0 0 0 7 0M9 9.5h.01M15 9.5h.01"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    swap: '<path d="M7 4v16M3 8l4-4 4 4M17 20V4M13 16l4 4 4-4"/>',
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + "</svg>"
    );
  }

  /* ------------------------------------------------------------------ */
  /* Small helpers                                                      */
  /* ------------------------------------------------------------------ */

  function h(tag, props) {
    const el = document.createElement(tag);
    const kids = Array.prototype.slice.call(arguments, 2);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === "class") el.className = v;
        else if (k === "html") el.innerHTML = v;
        else if (k.slice(0, 2) === "on" && typeof v === "function")
          el.addEventListener(k.slice(2), v);
        else el.setAttribute(k, v === true ? "" : v);
      }
    }
    for (const c of kids.flat(Infinity)) {
      if (c == null || c === false) continue;
      el.append(c.nodeType ? c : String(c));
    }
    return el;
  }

  /* ------------------------------------------------------------------ */
  /* Editor                                                             */
  /* ------------------------------------------------------------------ */

  class Editor extends Core.Doc {
    constructor(container, options) {
      const opts = Object.assign(
        {
          width: 1920,
          height: 1080,
          background: "#ffffff",
          fonts: DEFAULT_FONTS,
          googleFonts: [],
          icons: true, // false hides the Icons button; or { api, filters }
          theme: "light",
          colors: null, // UI colors, see README: { accent, surface, text, …, dark: { … } }
          historyLimit: 60,
          imageMaxSize: null,
          defaultTextColor: null, // null = pick black or white based on the background
          defaultShapeColor: "#2563eb",
        },
        options || {},
      );

      super(Object.assign({}, opts, { canvas: false }));
      if (!this.F.Canvas)
        throw new Error(
          "SlideEditor: the browser build of Fabric.js is required.",
        );
      this.container =
        typeof container === "string"
          ? document.querySelector(container)
          : container;
      if (!this.container) throw new Error("SlideEditor: container not found.");

      this.fonts = this._prepareFonts(opts.fonts, opts.googleFonts);

      this._history = [];
      this._hIndex = -1;
      this._crop = null;
      this._zoom = 1;
      this._guides = { v: false, h: false };

      injectCSS();
      this._buildDOM();
      this._initCanvas();
      this.setTheme(opts.theme);
      this.setColors(opts.colors);
      this._bindDOMEvents();
      this.setBackground(opts.background, {
        silent: true,
        opacity: opts.backgroundOpacity,
      });
      this._fit();
      this._ro = new ResizeObserver(() => this._fit());
      this._ro.observe(this.root);
      if (
        typeof document !== "undefined" &&
        document.fonts &&
        document.fonts.addEventListener
      ) {
        this._onFontsLoaded = () => {
          cancelAnimationFrame(this._fontRaf);
          this._fontRaf = requestAnimationFrame(() => this._remeasureTexts());
        };
        document.fonts.addEventListener("loadingdone", this._onFontsLoaded);
      }
      this._pushHistory(true);
      this._renderPanel();
    }

    /* ======================= public API ======================= */

    /** Serialize the slide (objects, background, size) to a plain object. */
    toJSON() {
      this._finishCrop(true);
      return this._serialize();
    }

    /** Load a slide previously produced by toJSON() (object or JSON string). */
    async load(json, { resetHistory = true } = {}) {
      if (typeof json === "string") json = JSON.parse(json);
      if (!json) throw new Error("SlideEditor.load: no data");
      this._finishCrop(false);
      await this._restore(json);
      if (resetHistory) {
        this._history = [];
        this._hIndex = -1;
        this._pushHistory(true);
      } else this._commitNow();
      return this;
    }

    /**
     * Export as an image data URL at the slide's native size.
     * opts: { multiplier = 1, format = 'png' | 'jpeg' | 'webp', quality = 0.92 }
     */
    toPNG(opts) {
      this._finishCrop(true);
      const active = this._canvas.getActiveObject();
      if (active && active.isEditing) active.exitEditing();
      this._guides = { v: false, h: false };
      return super.toPNG(opts);
    }

    toSVG(opts) {
      this._finishCrop(true);
      const active = this._canvas.getActiveObject();
      if (active && active.isEditing) active.exitEditing();
      return super.toSVG(opts);
    }

    /** Read a File/Blob (e.g. from an <input type=file>), downscale it if huge, and add it. */
    async addImageFile(file) {
      if (!file || !/^image\//.test(file.type)) return null;
      const url = await this._readImageFile(file);
      return this.addImage(url);
    }

    /** Enter interactive crop mode for the selected (or given) image. */
    startCrop(img) {
      this._startCrop(img || this._canvas.getActiveObject());
    }
    applyCrop() {
      this._finishCrop(true);
    }
    cancelCrop() {
      this._finishCrop(false);
    }

    deleteSelection() {
      if (this._crop) return;
      const c = this._canvas;
      const objs = c.getActiveObjects();
      if (!objs.length) return;
      c.discardActiveObject();
      objs.forEach((o) => c.remove(o));
      c.requestRenderAll();
      this._commit();
    }

    async duplicateSelection() {
      this._finishCrop(true);
      const c = this._canvas;
      const active = c.getActiveObject();
      if (!active) return;
      const off = Math.round(Math.min(this.width, this.height) * 0.02);
      if (active instanceof this.F.ActiveSelection) {
        const objs = active.getObjects();
        c.discardActiveObject();
        const clones = await Promise.all(objs.map((o) => o.clone(SE_PROPS)));
        clones.forEach((cl) => {
          cl.seId = null;
          cl.seName = undefined;
          cl.set({ left: cl.left + off, top: cl.top + off });
          this._decorate(cl);
          c.add(cl);
        });
        c.setActiveObject(new this.F.ActiveSelection(clones, { canvas: c }));
      } else {
        const cl = await active.clone(SE_PROPS);
        cl.seId = null;
        cl.seName = undefined;
        cl.set({ left: cl.left + off, top: cl.top + off });
        this._decorate(cl);
        c.add(cl);
        c.setActiveObject(cl);
      }
      c.requestRenderAll();
      this._commit();
    }

    /** dir: 'forward' | 'backward' | 'front' | 'back' */
    arrange(dir) {
      const c = this._canvas;
      const o = c.getActiveObject();
      if (!o || this._crop) return;
      const objs = o instanceof this.F.ActiveSelection ? o.getObjects() : [o];
      const fn = {
        forward: "bringObjectForward",
        backward: "sendObjectBackwards",
        front: "bringObjectToFront",
        back: "sendObjectToBack",
      }[dir];
      const order =
        dir === "forward" || dir === "front" ? objs.slice().reverse() : objs;
      order.forEach((x) => c[fn](x));
      c.requestRenderAll();
      this._commit();
    }

    /** where: 'left' | 'centerH' | 'right' | 'top' | 'centerV' | 'bottom' (relative to the slide) */
    align(where) {
      const o = this._canvas.getActiveObject();
      if (!o) return;
      o.setCoords();
      const br = o.getBoundingRect();
      let dx = 0,
        dy = 0;
      if (where === "left") dx = -br.left;
      if (where === "centerH") dx = this.width / 2 - (br.left + br.width / 2);
      if (where === "right") dx = this.width - (br.left + br.width);
      if (where === "top") dy = -br.top;
      if (where === "centerV") dy = this.height / 2 - (br.top + br.height / 2);
      if (where === "bottom") dy = this.height - (br.top + br.height);
      o.set({ left: o.left + dx, top: o.top + dy });
      o.setCoords();
      this._canvas.requestRenderAll();
      this._commit();
    }

    undo() {
      if (this._hIndex > 0) this._goto(this._hIndex - 1);
    }
    redo() {
      if (this._hIndex < this._history.length - 1) this._goto(this._hIndex + 1);
    }
    canUndo() {
      return this._hIndex > 0;
    }
    canRedo() {
      return this._hIndex < this._history.length - 1;
    }

    /** 'light' | 'dark' | 'auto' (follows the operating system). */
    setTheme(theme) {
      this.opts.theme = theme === "dark" || theme === "auto" ? theme : "light";
      this.root.classList.toggle("se-dark", this.opts.theme === "dark");
      this.root.classList.toggle("se-auto", this.opts.theme === "auto");
      if (this._colors) this._applyCanvasColors();
    }

    _isDark() {
      if (this.opts.theme === "dark") return true;
      return (
        this.opts.theme === "auto" &&
        typeof matchMedia === "function" &&
        matchMedia("(prefers-color-scheme: dark)").matches
      );
    }

    /**
     * Change the UI colors. Keys: accent, onAccent, background, surface, border, text, muted,
     * hover, stage, selection, guide; plus `dark: { … }` with overrides for dark mode.
     * Missing keys keep the built-in theme colors. Pass null to reset.
     */
    setColors(colors) {
      this._colors = colors || {};
      const sel = '.se-root[data-se="' + this._uid + '"]';
      const dark = colorDecls(this._colors.dark);
      let css = sel + "{" + colorDecls(this._colors) + "}";
      if (dark)
        css +=
          sel +
          ".se-dark{" +
          dark +
          "}@media (prefers-color-scheme: dark){" +
          sel +
          ".se-auto{" +
          dark +
          "}}";
      if (!this._colorStyle) {
        this._colorStyle = document.createElement("style");
        document.head.appendChild(this._colorStyle);
      }
      this._colorStyle.textContent = css;
      if (!this._mq && typeof matchMedia === "function") {
        this._mq = matchMedia("(prefers-color-scheme: dark)");
        this._onMq = () => {
          if (this.opts.theme === "auto") this._applyCanvasColors();
        };
        this._mq.addEventListener &&
          this._mq.addEventListener("change", this._onMq);
      }
      this._applyCanvasColors();
    }

    /** Selection handles and frames are drawn on the canvas, so they need the color directly. */
    _applyCanvasColors() {
      const c = this._canvas,
        col = this._selColor();
      if (c) {
        c.selectionBorderColor = col;
        c.selectionColor = this._rgba(col, 0.08);
        c.getObjects().forEach((o) =>
          o.set({ cornerStrokeColor: col, borderColor: col }),
        );
        const a = c.getActiveObject();
        if (a) a.set({ cornerStrokeColor: col, borderColor: col });
        if (this._crop)
          this._crop.frame.set({ cornerStrokeColor: col, borderColor: col });
        c.requestRenderAll();
      }
    }

    _selColor() {
      const c = this._colors || {},
        d = (this._isDark() && c.dark) || {};
      return (
        cssColor(d.selection) ||
        cssColor(c.selection) ||
        cssColor(d.accent) ||
        cssColor(c.accent) ||
        "#2563eb"
      );
    }

    /** Re-fit the slide into the available space (called automatically on resize). */
    fit() {
      this._fit();
    }

    /** Open/close a toolbar popover anchored under its button. */
    _togglePop(pop, btn, show, focusEl) {
      show = show == null ? pop.hidden : show;
      if (!show) {
        pop.hidden = true;
        btn.setAttribute("aria-expanded", "false");
        if (this._openPop && this._openPop.pop === pop) {
          document.removeEventListener("pointerdown", this._popOutside, true);
          document.removeEventListener("keydown", this._popEsc, true);
          this._openPop = null;
        }
        return;
      }
      if (this._openPop && this._openPop.pop !== pop)
        this._togglePop(this._openPop.pop, this._openPop.btn, false);
      pop.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      const rr = this.root.getBoundingClientRect(),
        br = btn.getBoundingClientRect();
      pop.style.left =
        clamp(
          br.left - rr.left,
          8,
          Math.max(8, rr.width - pop.offsetWidth - 8),
        ) + "px";
      pop.style.top = br.bottom - rr.top + 4 + "px";
      this._openPop = { pop, btn };
      this._popOutside =
        this._popOutside ||
        ((e) => {
          const o = this._openPop;
          if (o && !o.pop.contains(e.target) && !o.btn.contains(e.target))
            this._togglePop(o.pop, o.btn, false);
        });
      document.addEventListener("pointerdown", this._popOutside, true);
      // Esc closes the popup even if focus left it (e.g. the focused button was hidden).
      this._popEsc =
        this._popEsc ||
        ((e) => {
          const o = this._openPop;
          if (!o || e.key !== "Escape") return;
          e.preventDefault();
          e.stopPropagation();
          this._togglePop(o.pop, o.btn, false);
          o.btn.focus();
        });
      document.addEventListener("keydown", this._popEsc, true);
      const f = focusEl || pop.querySelector("button");
      f && f.focus({ preventScroll: true });
    }

    _toggleBlobMenu(show) {
      this._togglePop(this.blobMenu, this.blobBtn, show);
    }

    destroy() {
      if (this._popOutside)
        document.removeEventListener("pointerdown", this._popOutside, true);
      if (this._popEsc)
        document.removeEventListener("keydown", this._popEsc, true);
      if (this._iconAbort) this._iconAbort.abort();
      clearTimeout(this._ct);
      this._ro && this._ro.disconnect();
      if (this._onFontsLoaded)
        document.fonts.removeEventListener("loadingdone", this._onFontsLoaded);
      cancelAnimationFrame(this._fontRaf);
      this._canvas.dispose();
      this.root.remove();
      if (this._colorStyle) this._colorStyle.remove();
      if (this._mq && this._mq.removeEventListener)
        this._mq.removeEventListener("change", this._onMq);
      this._listeners = {};
    }

    /* ======================= setup ======================= */

    _prepareFonts(fonts, google) {
      this._fontSheets = [];
      const web = typeof document !== "undefined";
      const googleHref = (spec) =>
        "https://fonts.googleapis.com/css2?family=" +
        String(spec).trim().replace(/ /g, "+") +
        "&display=swap";
      const faceFiles = (f) => f.files || (f.url ? [{ url: f.url }] : []);
      const list = (fonts || []).map((f) => {
        if (typeof f === "string") return { name: f };
        if (!f || !f.name) throw new Error('Font entries need a "name"');
        if (web) {
          if (f.google)
            this._fontSheets.push(
              loadStylesheet(googleHref(f.google === true ? f.name : f.google)),
            );
          faceFiles(f).forEach((file) => {
            if (!file.url) throw new Error('Font files need a "url"');
            const face = new FontFace(
              f.name,
              "url(" + JSON.stringify(file.url) + ")",
              {
                weight: String(file.weight || 400),
                style: file.style || "normal",
              },
            );
            document.fonts.add(face);
            this._fontSheets.push(face.load().catch(() => null));
          });
        }
        return { name: f.name };
      });
      // Legacy option: googleFonts are put in front of the list.
      (google || []).forEach((spec) => {
        const name = String(spec).split(":")[0].trim();
        if (!list.some((f) => f.name === name))
          list.unshift({ name, google: true });
        if (web) this._fontSheets.push(loadStylesheet(googleHref(spec)));
      });
      if (!list.length) list.push({ name: "Arial" });
      return list;
    }

    _buildDOM() {
      this._uid = "se" + ++instanceCount;
      const tb = (name, title, onclick, extra) =>
        h(
          "button",
          Object.assign(
            {
              class: "se-btn",
              type: "button",
              title,
              "aria-label": title,
              html: icon(name),
              onclick,
            },
            extra || {},
          ),
        );

      this.fileInput = h("input", {
        type: "file",
        accept: "image/*",
        class: "se-file",
        multiple: true,
      });

      this.btnUndo = tb("undo", "Undo (Ctrl+Z)", () => this.undo());
      this.btnRedo = tb("redo", "Redo (Ctrl+Shift+Z)", () => this.redo());
      this.btnDup = tb("duplicate", "Duplicate (Ctrl+D)", () =>
        this.duplicateSelection(),
      );
      this.btnFwd = tb("forward", "Bring forward", () =>
        this.arrange("forward"),
      );
      this.btnBwd = tb("backward", "Send backward", () =>
        this.arrange("backward"),
      );
      this.btnDel = tb("trash", "Delete (Del)", () => this.deleteSelection());

      const textBtn = h("button", {
        class: "se-btn",
        type: "button",
        title: "Add text",
        onclick: () => {
          this._finishCrop(true);
          this._select(this.addText());
        },
      });
      textBtn.innerHTML = icon("text") + "<span>Text</span>";
      const imgBtn = h("button", {
        class: "se-btn",
        type: "button",
        title: "Add image (or drop / paste one)",
        onclick: () => this.fileInput.click(),
      });
      imgBtn.innerHTML = icon("image") + "<span>Image</span>";
      this._buildIconPicker();

      const shape = (t, title) =>
        tb(t, title, () => {
          this._finishCrop(true);
          this._select(this.addShape(t));
        });

      this._ngonN = 6;
      try {
        const v = parseInt(localStorage.getItem("slide-editor:ngon"), 10);
        if (v >= 3 && v <= 20) this._ngonN = v;
      } catch (_) {
        /* storage unavailable */
      }
      this.ngonLabel = h("span", { class: "se-nlabel" }, String(this._ngonN));
      this.ngonBtn = h("button", {
        class: "se-btn",
        type: "button",
        title: "Polygon (" + this._ngonN + " corners)",
        onclick: () => this._addNgon(this._ngonN),
      });
      this.ngonBtn.innerHTML = icon("ngon");
      this.ngonBtn.appendChild(this.ngonLabel);
      this.ngonCaret = h("button", {
        class: "se-btn",
        type: "button",
        title: "Choose number of corners",
        "aria-label": "Choose number of corners",
        "aria-haspopup": "true",
        "aria-expanded": "false",
        html: icon("chevron").replace("<svg", '<svg class="se-caret"'),
        onclick: () => this._togglePop(this.ngonMenu, this.ngonCaret),
      });
      this.ngonMenu = h(
        "div",
        {
          class: "se-pop se-npop",
          role: "menu",
          "aria-label": "Number of corners",
          hidden: true,
        },
        Array.from({ length: 18 }, (_, i) => i + 3).map((n) => {
          const pts = regularPolygon(n, 10)
            .map((q) => (q.x + 12).toFixed(2) + "," + (q.y + 12).toFixed(2))
            .join(" ");
          return h("button", {
            class: "se-btn",
            type: "button",
            role: "menuitem",
            title: n + " corners",
            "aria-label": n + " corners",
            html:
              '<svg viewBox="0 0 24 24" aria-hidden="true"><polygon points="' +
              pts +
              '"/></svg><span>' +
              n +
              "</span>",
            onclick: () => {
              this._togglePop(this.ngonMenu, this.ngonCaret, false);
              this._addNgon(n);
            },
          });
        }),
      );
      this.blobBtn = h("button", {
        class: "se-btn",
        type: "button",
        title: "Blob shapes",
        "aria-label": "Blob shapes",
        "aria-haspopup": "true",
        "aria-expanded": "false",
        onclick: () => this._toggleBlobMenu(),
      });
      this.blobBtn.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="' +
        blobPath(1, 0.24) +
        '"/></svg>' +
        icon("chevron").replace("<svg", '<svg class="se-caret"');
      this.blobMenu = h(
        "div",
        {
          class: "se-pop",
          role: "menu",
          "aria-label": "Blob shapes",
          hidden: true,
        },
        BLOBS.map((_, i) =>
          h("button", {
            class: "se-btn",
            type: "button",
            role: "menuitem",
            title: "Blob " + (i + 1),
            "aria-label": "Blob " + (i + 1),
            html:
              '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="' +
              blobPath(i) +
              '"/></svg>',
            onclick: () => {
              this._toggleBlobMenu(false);
              this._finishCrop(true);
              this._select(this.addShape("blob", { blob: i }));
            },
          }),
        ),
      );

      this.toolbar = h(
        "div",
        {
          class: "se-toolbar",
          role: "toolbar",
          "aria-label": "Slide editor tools",
        },
        textBtn,
        imgBtn,
        this.iconBtn,
        h("span", { class: "se-sep" }),
        shape("rect", "Rectangle"),
        shape("ellipse", "Ellipse"),
        shape("triangle", "Triangle"),
        shape("star", "Star"),
        shape("line", "Line"),
        h("span", { class: "se-split" }, this.ngonBtn, this.ngonCaret),
        this.blobBtn,
        h("span", { class: "se-sep" }),
        this.btnUndo,
        this.btnRedo,
        h("span", { class: "se-spacer" }),
        this.btnDup,
        this.btnFwd,
        this.btnBwd,
        this.btnDel,
        this.fileInput,
      );

      this.canvasEl = h("canvas");
      this.stage = h(
        "div",
        { class: "se-stage", "data-drop": "Drop image to add" },
        this.canvasEl,
      );
      this.panel = h("div", { class: "se-panel" });
      this.root = h(
        "div",
        { class: "se-root", "data-se": this._uid, tabindex: "0" },
        this.toolbar,
        this.blobMenu,
        this.ngonMenu,
        this.iconPop,
        h("div", { class: "se-body" }, this.stage, this.panel),
      );
      this.container.appendChild(this.root);
    }

    _initCanvas() {
      const F = this.F;
      const c = (this._canvas = new F.Canvas(this.canvasEl, {
        width: 10,
        height: 10,
        preserveObjectStacking: true,
        selectionColor: "rgba(37,99,235,0.08)",
        selectionBorderColor: "#2563eb", // replaced by setColors()
        selectionLineWidth: 1,
        stopContextMenu: true,
      }));

      const onSel = (e) => {
        // Rects scaled as part of a multi-selection get their scale baked in once released.
        ((e && e.deselected) || []).forEach((o) => {
          if (this._bakeRectScale(o)) c.requestRenderAll();
        });
        const act = c.getActiveObject();
        if (act instanceof F.ActiveSelection) {
          const col = this._selColor();
          act.set({
            borderColor: col,
            cornerStrokeColor: col,
            cornerColor: "#ffffff",
            transparentCorners: false,
            cornerStyle: "circle",
            cornerSize: 11,
          });
        }
        if (!this._crop) this._renderPanel();
        this._updateToolbar();
      };
      c.on("selection:created", onSel);
      c.on("selection:updated", onSel);
      c.on("selection:cleared", onSel);

      c.on("object:moving", (e) => this._onMoving(e));
      c.on("object:scaling", (e) => {
        if (this._crop) {
          if (e.target === this._crop.frame) this._clampCropFrame(true);
          return;
        }
        // Apply the resize to real dimensions while dragging, so the preview is the result.
        this._bakeRectScale(e.target);
        this._normalizeText(e.target);
      });
      c.on("object:modified", (e) => {
        if (this._crop) {
          if (e.target === this._crop.frame) this._clampCropFrame(true);
          return;
        }
        this._normalizeText(e.target);
        this._bakeRectScale(e.target);
        this._guides = { v: false, h: false };
        this._renderPanel();
        this._commit();
      });
      c.on("mouse:up", () => {
        if (this._guides.v || this._guides.h) {
          this._guides = { v: false, h: false };
          c.requestRenderAll();
        }
      });
      c.on("text:changed", (e) => {
        if (e && e.target && e.target.seFit) {
          this._fitText(e.target);
          c.requestRenderAll();
        }
        this._commit();
      });
      c.on("text:editing:exited", () => this._commit());
      c.on("mouse:dblclick", (e) => {
        if (this._crop) return;
        if (e.target instanceof F.FabricImage) this._startCrop(e.target);
        else if (e.target && e.target.seShape === "ngon")
          this._setNgonMode(
            e.target,
            e.target._seMode === "resize" ? "corners" : "resize",
          );
      });
      c.on("mouse:down", (e) => {
        try {
          this.root.focus({ preventScroll: true });
        } catch (_) {
          /* ignore */
        }
        if (this._crop && e.target !== this._crop.frame) this._finishCrop(true);
      });
      c.on("after:render", (e) => this._drawGuides(e.ctx));
    }

    _bindDOMEvents() {
      this.fileInput.addEventListener("change", async () => {
        const files = Array.from(this.fileInput.files || []);
        this.fileInput.value = "";
        this._finishCrop(true);
        let last = null;
        for (const f of files)
          last =
            (await this.addImageFile(f).catch((err) => {
              this._emit("error", err);
              return null;
            })) || last;
        if (last) this._select(last);
      });

      // Drag & drop images onto the stage
      let dragDepth = 0;
      this.stage.addEventListener("dragenter", (e) => {
        if (hasFiles(e)) {
          dragDepth++;
          this.stage.classList.add("se-drop");
          e.preventDefault();
        }
      });
      this.stage.addEventListener("dragover", (e) => {
        if (hasFiles(e)) e.preventDefault();
      });
      this.stage.addEventListener("dragleave", () => {
        if (--dragDepth <= 0) {
          dragDepth = 0;
          this.stage.classList.remove("se-drop");
        }
      });
      this.stage.addEventListener("drop", async (e) => {
        dragDepth = 0;
        this.stage.classList.remove("se-drop");
        const files = Array.from(
          (e.dataTransfer && e.dataTransfer.files) || [],
        ).filter((f) => /^image\//.test(f.type));
        if (!files.length) return;
        e.preventDefault();
        this._finishCrop(true);
        let last = null;
        for (const f of files)
          last = (await this.addImageFile(f).catch(() => null)) || last;
        if (last) this._select(last);
      });

      // Paste images
      this.root.addEventListener("paste", async (e) => {
        const a = this._canvas.getActiveObject();
        if (a && a.isEditing) return;
        const items = Array.from(
          (e.clipboardData && e.clipboardData.items) || [],
        ).filter((i) => /^image\//.test(i.type));
        if (!items.length) return;
        e.preventDefault();
        const img = await this.addImageFile(items[0].getAsFile()).catch(
          () => null,
        );
        if (img) this._select(img);
      });

      this.root.addEventListener("keydown", (e) => this._onKey(e));
    }

    _onKey(e) {
      if (this._openPop) {
        if (e.key === "Escape") {
          e.preventDefault();
          const o = this._openPop;
          this._togglePop(o.pop, o.btn, false);
          o.btn.focus();
        }
        return;
      }
      const tag = (e.target && e.target.tagName) || "";
      if (/^(INPUT|SELECT|TEXTAREA)$/.test(tag)) return;
      const c = this._canvas;
      const a = c.getActiveObject();
      if (a && a.isEditing) return;
      const mod = e.ctrlKey || e.metaKey;
      const k = e.key;

      if (this._crop) {
        if (k === "Enter") {
          e.preventDefault();
          this._finishCrop(true);
        } else if (k === "Escape") {
          e.preventDefault();
          this._finishCrop(false);
        }
        return;
      }
      if (mod && (k === "z" || k === "Z")) {
        e.preventDefault();
        e.shiftKey ? this.redo() : this.undo();
        return;
      }
      if (mod && (k === "y" || k === "Y")) {
        e.preventDefault();
        this.redo();
        return;
      }
      if (mod && (k === "d" || k === "D")) {
        e.preventDefault();
        this.duplicateSelection();
        return;
      }
      if (!a) return;
      if (k === "Delete" || k === "Backspace") {
        e.preventDefault();
        this.deleteSelection();
        return;
      }
      if (k === "Escape") {
        c.discardActiveObject();
        c.requestRenderAll();
        return;
      }
      if (k === "Enter" && a instanceof this.F.Textbox) {
        e.preventDefault();
        a.enterEditing();
        a.selectAll();
        c.requestRenderAll();
        return;
      }
      const step = e.shiftKey ? 10 : 1;
      const d = {
        ArrowLeft: [-step, 0],
        ArrowRight: [step, 0],
        ArrowUp: [0, -step],
        ArrowDown: [0, step],
      }[k];
      if (d) {
        e.preventDefault();
        a.set({ left: a.left + d[0], top: a.top + d[1] });
        a.setCoords();
        c.requestRenderAll();
        this._commit();
      }
    }

    _fit() {
      const r = this.root.getBoundingClientRect();
      this.root.classList.toggle("se-narrow", r.width > 0 && r.width < 680);
      const s = this.stage.getBoundingClientRect();
      if (!s.width || !s.height) return;
      const pad = s.width < 500 ? 12 : 28;
      const z = Math.max(
        0.02,
        Math.min(
          (s.width - 2 * pad) / this.width,
          (s.height - 2 * pad) / this.height,
        ),
      );
      this._zoom = z;
      this._canvas.setDimensions({
        width: Math.max(1, Math.floor(this.width * z)),
        height: Math.max(1, Math.floor(this.height * z)),
      });
      this._canvas.setViewportTransform([z, 0, 0, z, 0, 0]);
      this._canvas.requestRenderAll();
    }

    /* ======================= objects ======================= */

    _decorate(o) {
      super._decorate(o);
      const F = this.F;
      o.set({
        transparentCorners: false,
        cornerColor: "#ffffff",
        cornerStrokeColor: this._selColor(),
        borderColor: this._selColor(),
        cornerStyle: "circle",
        cornerSize: 11,
        borderScaleFactor: 1.5,
        padding: 0,
      });
      if (!(o instanceof F.FabricImage) && !(o instanceof F.Textbox))
        o.set("strokeUniform", !(o.seIcon && o.seIcon.kind === "stroke"));
      if (o instanceof F.Line)
        o.setControlsVisibility({ mt: false, mb: false });
      // Text height follows from font size and wrapping, so no vertical-only stretch handles.
      if (o instanceof F.Textbox)
        o.setControlsVisibility({ mt: false, mb: false });
      if (o.seShape === "ngon" && o instanceof F.Polygon)
        this._setNgonMode(o, o._seMode || "corners", true);
      // Rects and text get their scale applied during the drag; Fabric must redraw them live.
      if (o instanceof F.Rect || o instanceof F.Textbox || o.seShape === "ngon")
        o.set("noScaleCache", false);
      return o;
    }

    _add(o) {
      this._finishCrop(true);
      return super._add(o);
    }

    _select(o) {
      if (!o) return;
      this._canvas.setActiveObject(o);
      this._canvas.requestRenderAll();
      this._renderPanel();
      this._updateToolbar();
      try {
        this.root.focus({ preventScroll: true });
      } catch (_) {
        /* ignore */
      }
    }

    _onMoving(e) {
      const o = e.target;
      if (this._crop) {
        if (o === this._crop.frame) this._clampCropFrame(false);
        return;
      }
      const thr = 8 / this._zoom;
      const c = o.getCenterPoint();
      let x = c.x,
        y = c.y;
      const v = Math.abs(c.x - this.width / 2) < thr;
      const hz = Math.abs(c.y - this.height / 2) < thr;
      if (v) x = this.width / 2;
      if (hz) y = this.height / 2;
      if (v || hz)
        o.setPositionByOrigin(new this.F.Point(x, y), "center", "center");
      this._guides = { v, h: hz };
    }

    _drawGuides(ctx) {
      if (!ctx || (!this._guides.v && !this._guides.h)) return;
      const z = this._zoom;
      ctx.save();
      const gc = this._colors || {},
        gd = (this._isDark() && gc.dark) || {};
      ctx.strokeStyle = cssColor(gd.guide) || cssColor(gc.guide) || "#ec4899";
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      if (this._guides.v) {
        const x = Math.round((this.width / 2) * z) + 0.5;
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height * z);
      }
      if (this._guides.h) {
        const y = Math.round((this.height / 2) * z) + 0.5;
        ctx.moveTo(0, y);
        ctx.lineTo(this.width * z, y);
      }
      ctx.stroke();
      ctx.restore();
    }

    async _readImageFile(file) {
      const url = await new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(fr.result);
        fr.onerror = () => rej(fr.error);
        fr.readAsDataURL(file);
      });
      if (/svg|gif/.test(file.type)) return url;
      const max =
        this.opts.imageMaxSize || Math.max(this.width, this.height) * 1.5;
      const img = await new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = rej;
        i.src = url;
      });
      const longest = Math.max(img.naturalWidth, img.naturalHeight);
      if (longest <= max) return url;
      const k = max / longest;
      const cv = document.createElement("canvas");
      cv.width = Math.round(img.naturalWidth * k);
      cv.height = Math.round(img.naturalHeight * k);
      const ctx = cv.getContext("2d");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, cv.width, cv.height);
      return /jpe?g/.test(file.type)
        ? cv.toDataURL("image/jpeg", 0.9)
        : cv.toDataURL("image/png");
    }

    /* ======================= crop ======================= */

    _startCrop(img) {
      const F = this.F;
      if (!(img instanceof F.FabricImage) || this._crop) return;
      const c = this._canvas;
      const el = img.getElement();
      const elW = el.naturalWidth || el.width,
        elH = el.naturalHeight || el.height;

      const center = img.getCenterPoint();
      const angle = img.angle;
      img.set("angle", 0);
      img.setPositionByOrigin(center, "center", "center");

      const sx = img.scaleX,
        sy = img.scaleY,
        w = img.width,
        hgt = img.height;
      const dispCropX = img.flipX ? elW - img.cropX - w : img.cropX;
      const dispCropY = img.flipY ? elH - img.cropY - hgt : img.cropY;
      const fullLeft = center.x - (w / 2 + dispCropX) * sx;
      const fullTop = center.y - (hgt / 2 + dispCropY) * sy;

      const common = {
        originX: "left",
        originY: "top",
        left: fullLeft,
        top: fullTop,
        scaleX: sx,
        scaleY: sy,
        flipX: img.flipX,
        flipY: img.flipY,
        cropX: 0,
        cropY: 0,
        width: elW,
        height: elH,
        selectable: false,
        evented: false,
        excludeFromExport: true,
        objectCaching: false,
      };
      const ghost = new F.FabricImage(
        el,
        Object.assign({}, common, { opacity: 0.3 }),
      );
      const clip = new F.Rect({
        originX: "left",
        originY: "top",
        left: center.x - (w * sx) / 2,
        top: center.y - (hgt * sy) / 2,
        width: w * sx,
        height: hgt * sy,
        absolutePositioned: true,
      });
      const bright = new F.FabricImage(
        el,
        Object.assign({}, common, { clipPath: clip }),
      );
      const frame = new F.Rect({
        originX: "left",
        originY: "top",
        left: clip.left,
        top: clip.top,
        width: clip.width,
        height: clip.height,
        fill: "rgba(0,0,0,0)",
        stroke: "#ffffff",
        strokeWidth: 2,
        strokeDashArray: [7, 5],
        strokeUniform: true,
        lockRotation: true,
        lockScalingFlip: true,
        excludeFromExport: true,
        noScaleCache: true,
        transparentCorners: false,
        cornerColor: "#ffffff",
        cornerStrokeColor: this._selColor(),
        cornerStyle: "circle",
        cornerSize: 12,
        borderColor: this._selColor(),
      });
      frame.setControlVisible("mtr", false);
      frame.shadow = new F.Shadow({ color: "rgba(0,0,0,0.6)", blur: 2 });

      img.visible = false;
      c.discardActiveObject();
      c.add(ghost, bright, frame);
      this._crop = {
        img,
        angle,
        center,
        ghost,
        bright,
        clip,
        frame,
        elW,
        elH,
        sx,
        sy,
        prevUniform: c.uniformScaling,
        bounds: {
          l: fullLeft,
          t: fullTop,
          r: fullLeft + elW * sx,
          b: fullTop + elH * sy,
        },
      };
      c.uniformScaling = false;
      c.setActiveObject(frame);
      c.requestRenderAll();
      this._renderPanel();
      this._updateToolbar();
    }

    _clampCropFrame(isScale) {
      const cr = this._crop;
      if (!cr) return;
      const f = cr.frame,
        b = cr.bounds;
      let w = f.width * f.scaleX,
        hh = f.height * f.scaleY;
      if (isScale) {
        let l = Math.max(f.left, b.l),
          t = Math.max(f.top, b.t);
        let r = Math.min(f.left + w, b.r),
          btm = Math.min(f.top + hh, b.b);
        const minSize = 8 / this._zoom;
        r = Math.max(r, l + minSize);
        btm = Math.max(btm, t + minSize);
        f.set({
          left: l,
          top: t,
          scaleX: (r - l) / f.width,
          scaleY: (btm - t) / f.height,
        });
      } else {
        w = Math.min(w, b.r - b.l);
        hh = Math.min(hh, b.b - b.t);
        f.set({
          left: clamp(f.left, b.l, b.r - w),
          top: clamp(f.top, b.t, b.b - hh),
        });
      }
      f.setCoords();
      cr.clip.set({
        left: f.left,
        top: f.top,
        width: f.width * f.scaleX,
        height: f.height * f.scaleY,
      });
      cr.bright.dirty = true;
    }

    _resetCropFrame() {
      const cr = this._crop;
      if (!cr) return;
      const b = cr.bounds;
      cr.frame.set({
        left: b.l,
        top: b.t,
        scaleX: (b.r - b.l) / cr.frame.width,
        scaleY: (b.b - b.t) / cr.frame.height,
      });
      this._clampCropFrame(false);
      this._canvas.setActiveObject(cr.frame);
      this._canvas.requestRenderAll();
    }

    _finishCrop(apply) {
      const cr = this._crop;
      if (!cr) return;
      this._crop = null;
      const F = this.F,
        c = this._canvas,
        img = cr.img,
        f = cr.frame;
      if (apply) {
        const fw = f.width * f.scaleX,
          fh = f.height * f.scaleY;
        let dx = (f.left - cr.ghost.left) / cr.sx,
          dy = (f.top - cr.ghost.top) / cr.sy;
        let cw = fw / cr.sx,
          ch = fh / cr.sy;
        dx = clamp(dx, 0, cr.elW - 1);
        dy = clamp(dy, 0, cr.elH - 1);
        cw = clamp(cw, 1, cr.elW - dx);
        ch = clamp(ch, 1, cr.elH - dy);
        const cropX = img.flipX ? cr.elW - dx - cw : dx;
        const cropY = img.flipY ? cr.elH - dy - ch : dy;
        img.set({ cropX, cropY, width: cw, height: ch });
        img.setPositionByOrigin(
          new F.Point(f.left + fw / 2, f.top + fh / 2),
          "center",
          "center",
        );
      } else {
        img.setPositionByOrigin(cr.center, "center", "center");
      }
      const ctr = img.getCenterPoint();
      img.set({ angle: cr.angle, visible: true });
      img.setPositionByOrigin(ctr, "center", "center");
      img.dirty = true;
      img.setCoords();
      c.remove(cr.ghost, cr.bright, f);
      c.uniformScaling = cr.prevUniform;
      c.setActiveObject(img);
      c.requestRenderAll();
      this._renderPanel();
      this._updateToolbar();
      if (apply) this._commit();
    }

    _resetCrop(img) {
      const el = img.getElement();
      const center = img.getCenterPoint();
      img.set({
        cropX: 0,
        cropY: 0,
        width: el.naturalWidth || el.width,
        height: el.naturalHeight || el.height,
      });
      img.setPositionByOrigin(center, "center", "center");
      img.dirty = true;
      img.setCoords();
      this._canvas.requestRenderAll();
      this._commit();
    }

    /* ======================= fills & gradients ======================= */

    /* ======================= history ======================= */

    _commit() {
      if (this._suspend || this._batch) return;
      clearTimeout(this._ct);
      this._ct = setTimeout(() => this._pushHistory(false), 250);
    }

    _commitNow() {
      clearTimeout(this._ct);
      this._pushHistory(false);
    }

    _pushHistory(initial) {
      if (this._suspend || this._crop) return;
      const snap = this._serialize();
      this._history = this._history.slice(0, this._hIndex + 1);
      this._history.push(snap);
      const lim = Math.max(2, this.opts.historyLimit);
      if (this._history.length > lim)
        this._history.splice(0, this._history.length - lim);
      this._hIndex = this._history.length - 1;
      this._updateToolbar();
      if (!initial) this._emit("change", this);
    }

    async _goto(i) {
      this._finishCrop(false);
      clearTimeout(this._ct);
      this._hIndex = i;
      await this._restore(this._history[i]);
      this._emit("change", this);
    }

    _updateToolbar() {
      const has = !!this._canvas.getActiveObject() && !this._crop;
      this.btnUndo.disabled = !this.canUndo() || !!this._crop;
      this.btnRedo.disabled = !this.canRedo() || !!this._crop;
      [this.btnDup, this.btnFwd, this.btnBwd, this.btnDel].forEach((b) => {
        b.disabled = !has;
      });
    }

    /* ======================= properties panel ======================= */

    _renderPanel() {
      const p = this.panel;
      if (!p) return;
      const scroll = p.scrollTop;
      p.textContent = "";
      const F = this.F;
      const o = this._canvas.getActiveObject();

      if (this._crop) {
        this._panelCrop();
        return;
      }

      if (!o) {
        this._panelSlide();
      } else if (o instanceof F.ActiveSelection) {
        const s = this._section(o.size() + " objects selected");
        this._opacityRow(s, o.getObjects());
        this._panelArrange(o);
      } else {
        if (o instanceof F.Textbox) this._panelText(o);
        if (o instanceof F.FabricImage) this._panelImage(o);
        const kind = o.seIcon && o.seIcon.kind;
        if (kind) this._panelIcon(o);
        if (o.seShape === "ngon" && o instanceof F.Polygon) this._panelNgon(o);
        if (kind === "mono") this._panelIconColor(o);
        if (o.seSvg) this._panelSvgInfo(o);
        if (o.seSvg || kind === "color") this._panelPalette(o);
        if (
          !(o instanceof F.FabricImage) &&
          !(o instanceof F.Line) &&
          !(o instanceof F.Group) &&
          kind !== "stroke"
        ) {
          const s = this._section(
            o instanceof F.Textbox ? "Text fill" : "Fill",
          );
          this._fillEditor(
            s,
            this._fillToSpec(o.fill, "object"),
            (spec) => {
              o.set("fill", this._specToFill(spec, "object"));
              this._changed();
            },
            false,
          );
        }
        if (!(o instanceof F.Group)) this._panelStroke(o);
        this._panelEffects(o);
        this._panelTransform(o);
        this._panelArrange(o);
      }
      p.scrollTop = scroll;
    }

    _changed() {
      this._canvas.requestRenderAll();
      this._commit();
    }

    _section(title) {
      const s = h(
        "div",
        { class: "se-sec" },
        h("div", { class: "se-sec-title" }, title),
      );
      this.panel.appendChild(s);
      return s;
    }

    _row(sec, label) {
      const ctrls = Array.prototype.slice.call(arguments, 2);
      const r = h(
        "div",
        { class: "se-row" },
        label != null ? h("span", { class: "se-lbl" }, label) : null,
        h("div", { class: "se-ctrl" }, ctrls),
      );
      sec.appendChild(r);
      return r;
    }

    _num(val, onChange, { min = -1e6, max = 1e6, step = 1, title } = {}) {
      const inp = h("input", {
        type: "number",
        min,
        max,
        step,
        title,
        "aria-label": title,
      });
      inp.value = String(round(val, step < 1 ? 2 : 0));
      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        if (isFinite(v)) onChange(clamp(v, min, max));
      });
      return inp;
    }

    _range(
      val,
      onChange,
      { min = 0, max = 100, step = 1, fmt = (v) => v + "%", title } = {},
    ) {
      const out = h("span", { class: "se-val" }, fmt(val));
      const inp = h("input", {
        type: "range",
        min,
        max,
        step,
        title,
        "aria-label": title,
      });
      inp.value = String(val);
      inp.addEventListener("input", () => {
        const v = parseFloat(inp.value);
        out.textContent = fmt(v);
        onChange(v);
      });
      return [inp, out];
    }

    _dropdown(options, val, onChange, title) {
      const sel = h(
        "select",
        { title, "aria-label": title },
        options.map((op) => {
          const [v, l, style] = Array.isArray(op) ? op : [op, op];
          return h("option", { value: v, style }, l);
        }),
      );
      sel.value = val;
      sel.addEventListener("change", () => onChange(sel.value));
      return sel;
    }

    _colorAlpha(rgba, onChange, title) {
      const col = h("input", {
        type: "color",
        title: title || "Color",
        "aria-label": title || "Color",
      });
      col.value = this._hex(rgba);
      let alpha = Math.round(this._alpha(rgba) * 100);
      const [rng, out] = this._range(
        alpha,
        (v) => {
          alpha = v;
          onChange(this._rgba(col.value, alpha / 100));
        },
        { title: "Opacity of " + (title || "color").toLowerCase() },
      );
      col.addEventListener("input", () => {
        if (alpha === 0) {
          alpha = 100;
          rng.value = "100";
          out.textContent = "100%";
        }
        onChange(this._rgba(col.value, alpha / 100));
      });
      return [col, rng, out];
    }

    _toggle(content, active, onClick, title) {
      const b = h("button", {
        class: "se-btn",
        type: "button",
        title,
        "aria-label": title,
        "aria-pressed": active ? "true" : "false",
      });
      if (/^<svg/.test(content)) b.innerHTML = content;
      else {
        b.textContent = content;
        b.classList.add("se-glyph");
      }
      b.addEventListener("click", () => {
        const now = b.getAttribute("aria-pressed") !== "true";
        b.setAttribute("aria-pressed", now ? "true" : "false");
        onClick(now);
      });
      return b;
    }

    _iconBtn(name, title, onClick, cls) {
      return h("button", {
        class: "se-btn" + (cls ? " " + cls : ""),
        type: "button",
        title,
        "aria-label": title,
        html: icon(name),
        onclick: onClick,
      });
    }

    /** Fill editor: none / solid / linear / radial with two colour stops + alpha. */
    _fillEditor(sec, spec, apply, allowNone, labelNone) {
      const box = h("div");
      sec.appendChild(box);
      const state = Object.assign({}, spec);
      if (state.type !== "none") {
        state.c1 = state.c1 || "#000000";
        state.c2 = state.c2 || state.c1;
      }
      const draw = () => {
        box.textContent = "";
        const types = [
          ["solid", "Solid color"],
          ["linear", "Linear gradient"],
          ["radial", "Radial gradient"],
        ];
        if (allowNone || state.type === "none")
          types.unshift(["none", labelNone || "None"]);
        this._row(
          box,
          "Type",
          this._dropdown(
            types,
            state.type,
            (v) => {
              if (state.type === "none" && v !== "none") {
                if (this._alpha(state.c1) === 0) state.c1 = "#ffffff";
                if (this._alpha(state.c2) === 0) state.c2 = "#000000";
              }
              if (
                state.type === "solid" &&
                v !== "solid" &&
                state.c2 === state.c1
              )
                state.c2 = this._contrast(state.c1);
              state.type = v;
              apply(Object.assign({}, state));
              draw();
            },
            "Fill type",
          ),
        );
        if (state.type === "none") return;
        const grad = state.type !== "solid";
        this._row(
          box,
          grad ? "From" : "Color",
          this._colorAlpha(
            state.c1,
            (c) => {
              state.c1 = c;
              apply(Object.assign({}, state));
            },
            grad ? "Start color" : "Color",
          ),
        );
        if (grad) {
          this._row(
            box,
            "To",
            this._colorAlpha(
              state.c2,
              (c) => {
                state.c2 = c;
                apply(Object.assign({}, state));
              },
              "End color",
            ),
          );
          const swap = h("button", {
            class: "se-btn se-outline",
            type: "button",
            title: "Swap gradient colors",
            onclick: () => {
              const t = state.c1;
              state.c1 = state.c2;
              state.c2 = t;
              apply(Object.assign({}, state));
              draw();
            },
          });
          swap.innerHTML = icon("swap") + "<span>Swap colors</span>";
          this._row(box, "", swap);
        }
        if (state.type === "linear") {
          this._row(
            box,
            "Angle",
            this._range(
              state.angle,
              (v) => {
                state.angle = v;
                apply(Object.assign({}, state));
              },
              {
                min: 0,
                max: 360,
                fmt: (v) => v + "°",
                title: "Gradient angle",
              },
            ),
          );
        }
      };
      draw();
    }

    _panelSlide() {
      const s = this._section("Slide");
      this._row(
        s,
        "Size",
        h("span", null, this.width + " × " + this.height + " px"),
      );
      const bg = this._section("Background");
      this._fillEditor(
        bg,
        this._bg.spec,
        (spec) => {
          this._bg.spec = spec;
          this._applyBackground();
          this._changed();
        },
        true,
        "Transparent",
      );
      this._row(
        bg,
        "Opacity",
        this._range(
          Math.round(this._bg.opacity * 100),
          (v) => {
            this._bg.opacity = v / 100;
            this._applyBackground();
            this._changed();
          },
          { title: "Background opacity" },
        ),
      );
      const tip = this._section("Tips");
      tip.appendChild(
        h(
          "p",
          { class: "se-hint" },
          "Drop or paste images onto the slide. Double-click an image to crop it. Arrow keys nudge, Shift+arrows move by 10 px.",
        ),
      );
    }

    _fontImportBox(sec) {
      const box = h("div", { class: "se-import" });
      const ta = h("textarea", {
        rows: 4,
        spellcheck: "false",
        placeholder:
          "<style>\n@import url('https://fonts.googleapis.com/css2?family=…');\n</style>",
        "aria-label": "Google Fonts embed code",
      });
      const msg = h("p", { class: "se-hint" });
      msg.textContent =
        "On fonts.google.com choose fonts, open “Get embed code”, select @import and paste it here.";
      const close = () => {
        this._fontImportOpen = false;
        this._renderPanel();
      };
      const go = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          onclick: () => {
            try {
              this.importFonts(ta.value);
              this._fontImportOpen = false;
              this._renderPanel();
            } catch (e) {
              msg.textContent = e.message;
              msg.classList.add("se-error");
            }
          },
        },
        "Import",
      );
      const cancel = h(
        "button",
        { class: "se-btn se-outline", type: "button", onclick: close },
        "Cancel",
      );
      box.append(ta, h("div", { class: "se-actions" }, go, cancel), msg);
      sec.appendChild(box);
      setTimeout(() => ta.focus(), 0);
    }

    _loadFontSheet(href) {
      return typeof document === "undefined"
        ? Promise.resolve()
        : loadStylesheet(href);
    }

    _panelText(o) {
      const s = this._section("Text");
      const names = this.fonts.map((f) => [
        f.name,
        f.name,
        'font-family:"' + f.name + '"',
      ]);
      const cur = firstFamily(o.fontFamily);
      if (!names.some((n) => n[0] === cur)) names.unshift([cur, cur]);
      const fontSel = this._dropdown(
        names,
        cur,
        (v) => {
          if (v === IMPORT_FONTS) {
            fontSel.value = cur;
            this._fontImportOpen = true;
            this._renderPanel();
            return;
          }
          o.set("fontFamily", v);
          this._ensureFonts([o]);
          this._changed();
        },
        "Font family",
      );
      fontSel.appendChild(h("option", { disabled: true }, "──────────"));
      fontSel.appendChild(
        h(
          "option",
          { value: IMPORT_FONTS, class: "se-import-opt" },
          "+ Import fonts…",
        ),
      );
      this._row(s, "Font", fontSel);
      if (this._fontImportOpen) this._fontImportBox(s);
      this._row(
        s,
        "Size",
        this._num(
          o.fontSize,
          (v) => {
            if (v > 0) {
              o.set("fontSize", v);
              o.initDimensions();
              o.setCoords();
              this._changed();
            }
          },
          { min: 1, max: 2000, title: "Font size" },
        ),
      );
      const isBold =
        String(o.fontWeight) === "bold" || Number(o.fontWeight) >= 600;
      this._row(
        s,
        "Style",
        h(
          "div",
          { class: "se-group" },
          this._toggle(
            "B",
            isBold,
            (on) => {
              o.set("fontWeight", on ? "bold" : "normal");
              this._ensureFonts([o]);
              this._changed();
            },
            "Bold",
          ),
          this._toggle(
            "I",
            o.fontStyle === "italic",
            (on) => {
              o.set("fontStyle", on ? "italic" : "normal");
              this._ensureFonts([o]);
              this._changed();
            },
            "Italic",
          ),
          (() => {
            const b = this._toggle(
              "U",
              !!o.underline,
              (on) => {
                o.set("underline", on);
                this._changed();
              },
              "Underline",
            );
            b.style.textDecoration = "underline";
            return b;
          })(),
        ),
      );
      const alignGroup = h("div", { class: "se-group" });
      [
        ["left", "tLeft", "Align left"],
        ["center", "tCenter", "Align center"],
        ["right", "tRight", "Align right"],
      ].forEach(([v, ic, t]) => {
        const b = this._toggle(
          icon(ic),
          o.textAlign === v,
          () => {
            o.set("textAlign", v);
            alignGroup
              .querySelectorAll(".se-btn")
              .forEach((x) =>
                x.setAttribute("aria-pressed", x === b ? "true" : "false"),
              );
            this._changed();
          },
          t,
        );
        alignGroup.appendChild(b);
      });
      this._row(s, "Align", alignGroup);
      this._row(
        s,
        "Line h.",
        this._range(
          Math.round(o.lineHeight * 100),
          (v) => {
            o.set("lineHeight", v / 100);
            o.initDimensions();
            o.setCoords();
            this._changed();
          },
          {
            min: 70,
            max: 250,
            fmt: (v) => (v / 100).toFixed(2),
            title: "Line height",
          },
        ),
      );
      this._row(
        s,
        "Spacing",
        this._range(
          o.charSpacing || 0,
          (v) => {
            o.set("charSpacing", v);
            o.initDimensions();
            o.setCoords();
            this._changed();
          },
          {
            min: -100,
            max: 800,
            step: 10,
            fmt: (v) => String(v),
            title: "Letter spacing",
          },
        ),
      );
    }

    _panelImage(o) {
      const s = this._section("Image");
      const el = o.getElement();
      const cropped =
        o.cropX ||
        o.cropY ||
        o.width < (el.naturalWidth || el.width) - 0.5 ||
        o.height < (el.naturalHeight || el.height) - 0.5;
      const crop = h("button", {
        class: "se-btn se-primary",
        type: "button",
        title: "Crop image (double-click)",
        onclick: () => this._startCrop(o),
      });
      crop.innerHTML = icon("crop") + "<span>Crop</span>";
      const actions = h("div", { class: "se-actions" }, crop);
      if (cropped) {
        const reset = h(
          "button",
          {
            class: "se-btn se-outline",
            type: "button",
            onclick: () => {
              this._resetCrop(o);
              this._renderPanel();
            },
          },
          "Reset crop",
        );
        actions.appendChild(reset);
      }
      s.appendChild(actions);
      this._row(
        s,
        "Flip",
        h(
          "div",
          { class: "se-group" },
          this._toggle(
            icon("flipH"),
            !!o.flipX,
            (on) => {
              o.set("flipX", on);
              this._changed();
            },
            "Flip horizontally",
          ),
          this._toggle(
            icon("flipV"),
            !!o.flipY,
            (on) => {
              o.set("flipY", on);
              this._changed();
            },
            "Flip vertically",
          ),
        ),
      );
    }

    _panelStroke(o) {
      const F = this.F;
      const isLine =
        o instanceof F.Line || !!(o.seIcon && o.seIcon.kind === "stroke");
      const isText = o instanceof F.Textbox;
      const s = this._section(isLine ? "Line" : isText ? "Outline" : "Border");
      const stroke =
        typeof o.stroke === "string" && o.stroke
          ? o.stroke
          : isText
            ? "#000000"
            : "#111111";
      const hasStroke = !!o.stroke && !!o.strokeWidth;
      this._row(
        s,
        "Color",
        this._colorAlpha(
          stroke,
          (c) => {
            const had = !!o.stroke && !!o.strokeWidth;
            o.set("stroke", c);
            if (!had) {
              const w = isText
                ? Math.max(1, Math.round(o.fontSize / 30))
                : Math.max(
                    2,
                    Math.round(Math.min(this.width, this.height) / 200),
                  );
              o.set("strokeWidth", w);
              if (isText) o.set("paintFirst", "stroke");
              widthInp.value = String(w);
            }
            this._changed();
          },
          isLine ? "Line color" : "Border color",
        ),
      );
      const widthInp = this._num(
        hasStroke ? o.strokeWidth : 0,
        (v) => {
          o.set({ strokeWidth: v, stroke: o.stroke || stroke });
          if (isText) o.set("paintFirst", "stroke");
          o.setCoords();
          this._changed();
        },
        { min: 0, max: 400, step: 1, title: "Width" },
      );
      this._row(s, "Width", widthInp);
      if (o instanceof F.Rect) {
        this._row(
          s,
          "Corners",
          this._num(
            o.rx || 0,
            (v) => {
              o.set({ rx: v, ry: v });
              this._changed();
            },
            { min: 0, max: 2000, title: "Corner radius" },
          ),
        );
      }
      if (isText && o.paintFirst !== "stroke" && o.strokeWidth)
        o.set("paintFirst", "stroke");
    }

    _opacityRow(sec, objs) {
      const val = Math.round(
        (objs[0].opacity == null ? 1 : objs[0].opacity) * 100,
      );
      this._row(
        sec,
        "Opacity",
        this._range(
          val,
          (v) => {
            objs.forEach((x) => x.set("opacity", v / 100));
            this._changed();
          },
          { title: "Opacity" },
        ),
      );
    }

    _panelEffects(o) {
      const s = this._section("Effects");
      this._opacityRow(s, [o]);
      const cb = h("input", { type: "checkbox", title: "Drop shadow" });
      cb.checked = !!o.shadow;
      const size = Math.max(
        4,
        Math.round(Math.min(this.width, this.height) * 0.012),
      );
      cb.addEventListener("change", () => {
        o.set(
          "shadow",
          cb.checked
            ? new this.F.Shadow({
                color: "rgba(0,0,0,0.45)",
                blur: Math.round(size * 2.5),
                offsetX: Math.round(size * 0.6),
                offsetY: size,
              })
            : null,
        );
        this._changed();
        this._renderPanel();
      });
      this._row(s, "Shadow", cb);
      if (o.shadow) {
        const sh = o.shadow;
        this._row(
          s,
          "Color",
          this._colorAlpha(
            sh.color,
            (c) => {
              sh.color = c;
              o.dirty = true;
              this._changed();
            },
            "Shadow color",
          ),
        );
        this._row(
          s,
          "Blur",
          this._range(
            Math.round(sh.blur),
            (v) => {
              sh.blur = v;
              o.dirty = true;
              this._changed();
            },
            { min: 0, max: 200, fmt: (v) => String(v), title: "Shadow blur" },
          ),
        );
        this._row(
          s,
          "Offset",
          this._range(
            Math.round(sh.offsetY),
            (v) => {
              sh.offsetY = v;
              sh.offsetX = round(v * 0.6);
              o.dirty = true;
              this._changed();
            },
            {
              min: -100,
              max: 100,
              fmt: (v) => String(v),
              title: "Shadow offset",
            },
          ),
        );
      }
    }

    _panelTransform(o) {
      const F = this.F;
      const s = this._section("Size & rotation");
      const isText = o instanceof F.Textbox;
      const wIn = this._num(
        o.width * o.scaleX,
        (v) => {
          if (v <= 0) return;
          if (isText) {
            o.set("width", v);
            o.initDimensions();
          } else if (o instanceof F.Rect) {
            const c = o.getCenterPoint();
            o.set({ width: v, scaleX: 1 });
            o.setPositionByOrigin(c, "center", "center");
          } else o.set("scaleX", v / o.width);
          o.setCoords();
          this._changed();
        },
        { min: 1, max: 100000, title: "Width" },
      );
      const hIn = this._num(
        o.height * o.scaleY,
        (v) => {
          if (v <= 0 || isText) return;
          if (o instanceof F.Rect) {
            const c = o.getCenterPoint();
            o.set({ height: v, scaleY: 1 });
            o.setPositionByOrigin(c, "center", "center");
          } else o.set("scaleY", v / (o.height || 1));
          o.setCoords();
          this._changed();
        },
        { min: 1, max: 100000, title: "Height" },
      );
      if (isText || o instanceof F.Line) hIn.disabled = true;
      this._row(s, "W × H", wIn, hIn);
      this._row(
        s,
        "Angle",
        this._num(
          o.angle || 0,
          (v) => {
            const c = o.getCenterPoint();
            o.set("angle", ((v % 360) + 360) % 360);
            o.setPositionByOrigin(c, "center", "center");
            o.setCoords();
            this._changed();
          },
          { min: -360, max: 360, title: "Rotation in degrees" },
        ),
      );
    }

    _panelArrange(o) {
      const s = this._section("Arrange");
      this._row(
        s,
        "Align",
        h(
          "div",
          { class: "se-group" },
          this._iconBtn("alignL", "Align left", () => this.align("left")),
          this._iconBtn("alignCH", "Center horizontally", () =>
            this.align("centerH"),
          ),
          this._iconBtn("alignR", "Align right", () => this.align("right")),
          this._iconBtn("alignT", "Align top", () => this.align("top")),
          this._iconBtn("alignCV", "Center vertically", () =>
            this.align("centerV"),
          ),
          this._iconBtn("alignB", "Align bottom", () => this.align("bottom")),
        ),
      );
      this._row(
        s,
        "Layer",
        h(
          "div",
          { class: "se-group" },
          this._iconBtn("front", "Bring to front", () => this.arrange("front")),
          this._iconBtn("forward", "Bring forward", () =>
            this.arrange("forward"),
          ),
          this._iconBtn("backward", "Send backward", () =>
            this.arrange("backward"),
          ),
          this._iconBtn("back", "Send to back", () => this.arrange("back")),
        ),
      );
    }

    /* ======================= n-gons ======================= */

    _addNgon(n) {
      n = clamp(Math.round(n), 3, 20);
      this._ngonN = n;
      this.ngonLabel.textContent = String(n);
      this.ngonBtn.title = "Polygon (" + n + " corners)";
      try {
        localStorage.setItem("slide-editor:ngon", String(n));
      } catch (_) {
        /* storage unavailable */
      }
      this._finishCrop(true);
      this._select(this.addShape("ngon", { sides: n }));
    }

    /**
     * 'corners': a handle on every corner plus the rotation handle.
     * 'resize':  the normal scale + rotation handles.
     */
    _setNgonMode(o, mode, silent) {
      const F = this.F,
        cu = F.controlsUtils;
      o._seMode = mode;
      const defaults = cu.createObjectDefaultControls();
      if (mode === "corners") {
        const pts = cu.createPolyControls(o, {
          cursorStyle: "move",
          sizeX: 13,
          sizeY: 13,
        });
        o.controls = Object.assign(pts, { mtr: defaults.mtr });
        o.hasBorders = true;
      } else {
        o.controls = defaults;
      }
      o.setCoords();
      if (!silent) {
        this._canvas.requestRenderAll();
        this._renderPanel();
      }
    }

    _panelNgon(o) {
      const s = this._section("Polygon");
      this._row(s, "Corners", h("span", null, String(o.points.length)));
      const maxR = Math.max(10, Math.round(Math.min(o.width, o.height) / 2));
      this._row(
        s,
        "Rounding",
        this._range(
          Math.round(o.cornerRadius || 0),
          (v) => {
            o.set("cornerRadius", v);
            this._changed();
          },
          {
            min: 0,
            max: maxR,
            fmt: (v) => v + " px",
            title: "Corner rounding",
          },
        ),
      );
      const seg = h("div", {
        class: "se-seg",
        role: "group",
        "aria-label": "Handles",
      });
      [
        ["corners", "Corners"],
        ["resize", "Resize"],
      ].forEach(([m, l]) => {
        seg.appendChild(
          h(
            "button",
            {
              class: "se-btn",
              type: "button",
              "aria-pressed": (o._seMode || "corners") === m ? "true" : "false",
              title:
                m === "corners"
                  ? "Drag single corners"
                  : "Scale the whole shape",
              onclick: () => this._setNgonMode(o, m),
            },
            l,
          ),
        );
      });
      this._row(s, "Handles", seg);
      const add = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          onclick: () => this.addCorner(o),
        },
        "+ Add corner",
      );
      const del = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          disabled: o.points.length <= 3,
          onclick: () => this.removeCorner(o),
        },
        "− Remove corner",
      );
      s.appendChild(h("div", { class: "se-actions" }, add, del));
      s.appendChild(
        h(
          "p",
          { class: "se-hint" },
          "Drag a corner to move it. Use the round handle above the shape to rotate. Double-click switches between corner and resize handles.",
        ),
      );
    }

    /* ======================= icons (Iconify) ======================= */

    _iconCfg() {
      const o = this.opts.icons;
      if (o === false) return null;
      const cfg = Object.assign(
        { api: "https://api.iconify.design", filters: DEFAULT_ICON_FILTERS },
        typeof o === "object" ? o : {},
      );
      cfg.api = String(cfg.api).replace(/\/+$/, "");
      return cfg;
    }

    _buildIconPicker() {
      this._iconInfo = {}; // set prefix → info (name, author, license)
      this._iconSvgs = {}; // "prefix:name" → SVG markup (null = not found)
      this._iconResults = {}; // search cache: "filter|query|start" → response
      this._iconShown = []; // ids currently shown in the grid
      const cfg = this._iconCfg();
      if (!cfg) {
        this.iconBtn = null;
        this.iconPop = null;
        return;
      }
      this.iconBtn = h("button", {
        class: "se-btn",
        type: "button",
        title: "Search icons",
        "aria-haspopup": "true",
        "aria-expanded": "false",
        onclick: () => this._toggleIconPicker(),
      });
      this.iconBtn.innerHTML = icon("icons") + "<span>Icons</span>";

      this.iconInput = h("input", {
        type: "search",
        placeholder: "Search icons, e.g. coffee, music, star",
        "aria-label": "Search icons",
        autocomplete: "off",
        spellcheck: "false",
      });
      this.iconFilter = h(
        "select",
        { "aria-label": "Icon sets", title: "Icon sets" },
        cfg.filters.map((f, i) => h("option", { value: i }, f.label)),
      );
      this.iconGrid = h("div", {
        class: "se-igrid",
        role: "listbox",
        "aria-label": "Icon results",
      });
      this.iconStatus = h(
        "div",
        { class: "se-istatus", role: "status" },
        "Type a word to search.",
      );
      this.iconMore = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          hidden: true,
          onclick: () => this._iconSearch(true),
        },
        "Load more",
      );
      this.svgInput = h("input", {
        type: "file",
        accept: ".svg,image/svg+xml",
        class: "se-file",
      });
      this.svgInput.addEventListener("change", () => this._onSvgFile());
      const svgBtn = h("button", {
        class: "se-btn se-outline",
        type: "button",
        title: "Add an SVG file as editable vector shapes",
        onclick: () => this.svgInput.click(),
      });
      svgBtn.innerHTML = icon("image") + "<span>Upload SVG…</span>";
      this.iconPop = h(
        "div",
        {
          class: "se-ipop",
          hidden: true,
          role: "dialog",
          "aria-label": "Icon search",
        },
        h("div", { class: "se-isearch" }, this.iconInput, this.iconFilter),
        this.iconStatus,
        this.iconGrid,
        h(
          "div",
          { class: "se-ifoot" },
          h("span", {
            html: 'Icons via <a href="https://iconify.design" target="_blank" rel="noopener">Iconify</a>. Licenses vary by set.',
          }),
          this.iconMore,
        ),
        h(
          "div",
          { class: "se-iupload" },
          svgBtn,
          h("span", null, "Your own SVG, editable colors"),
          this.svgInput,
        ),
      );
      let t;
      this.iconInput.addEventListener("input", () => {
        clearTimeout(t);
        t = setTimeout(() => this._iconSearch(false), 500);
      });
      this.iconInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          clearTimeout(t);
          this._iconSearch(false);
        }
        if (e.key === "ArrowDown") {
          const b = this.iconGrid.querySelector("button");
          if (b) {
            e.preventDefault();
            b.focus();
          }
        }
      });
      this.iconFilter.addEventListener("change", () => this._iconSearch(false));
      this.iconGrid.addEventListener("keydown", (e) => {
        const btns = Array.from(this.iconGrid.querySelectorAll("button"));
        const i = btns.indexOf(document.activeElement);
        if (i < 0) return;
        const cols = Math.max(
          1,
          Math.round(this.iconGrid.clientWidth / (btns[0].offsetWidth + 4)),
        );
        const d = {
          ArrowRight: 1,
          ArrowLeft: -1,
          ArrowDown: cols,
          ArrowUp: -cols,
        }[e.key];
        if (d == null) return;
        e.preventDefault();
        if (i + d < 0) {
          this.iconInput.focus();
          return;
        }
        const n = btns[clamp(i + d, 0, btns.length - 1)];
        n && n.focus();
      });
    }

    _toggleIconPicker(show) {
      if (!this.iconPop) return;
      this._togglePop(this.iconPop, this.iconBtn, show, this.iconInput);
      if (!this.iconPop.hidden) {
        // re-tint single-color previews if the theme changed (no network needed)
        if (
          this._iconPreviewColor() !== this._iconTint &&
          this._iconShown.length
        ) {
          const ids = this._iconShown;
          this.iconGrid.textContent = "";
          this._iconShown = [];
          this._renderIconResults(ids);
        }
        this.iconInput.select();
      }
    }

    _iconPreviewColor() {
      const v = getComputedStyle(this.root)
        .getPropertyValue("--se-text")
        .trim();
      return v || "#18181b";
    }

    async _iconSearch(more) {
      const cfg = this._iconCfg();
      const q = this.iconInput.value.trim().toLowerCase();
      if (this._iconAbort) this._iconAbort.abort();
      if (!more) {
        this.iconGrid.textContent = "";
        this._iconShown = [];
        this._iconStart = 0;
        this.iconGrid.scrollTop = 0;
      }
      this.iconMore.hidden = true;
      if (q.length < 2) {
        this.iconStatus.textContent = q
          ? "Type at least 2 letters."
          : "Type a word to search.";
        return;
      }
      if (this._iconCooling()) return;
      const fi = +this.iconFilter.value || 0;
      const filter = cfg.filters[fi] || cfg.filters[0];
      const limit = 96,
        start = this._iconStart || 0;
      const key = fi + "|" + q + "|" + start;
      this.iconStatus.textContent = "Searching…";
      const ctl = (this._iconAbort = new AbortController());
      let data = this._iconResults[key];
      try {
        if (!data) {
          const params = new URLSearchParams({
            query: q,
            limit: String(limit),
            start: String(start),
          });
          if (filter.prefixes && filter.prefixes.length)
            params.set("prefixes", [].concat(filter.prefixes).join(","));
          data = await this._iconFetch(
            cfg.api + "/search?" + params,
            ctl.signal,
          );
          this._iconResults[key] = data;
          Object.assign(this._iconInfo, data.collections || {});
        }
        // One request per icon set for all thumbnails, instead of one per icon.
        await this._loadIconSvgs(data.icons || [], ctl.signal);
      } catch (err) {
        if (err.name === "AbortError") return;
        this._iconError(err);
        return;
      }
      const icons = data.icons || [];
      this._renderIconResults(icons);
      this._iconStart = start + icons.length;
      this.iconStatus.textContent = this._iconShown.length
        ? ""
        : 'No icons found for "' +
          q +
          '". Try another word (search is in English).';
      // A full page means more results may exist.
      this.iconMore.hidden = !(
        icons.length >= limit &&
        (data.total == null || data.total >= limit)
      );
    }

    _renderIconResults(ids) {
      this._iconTint = this._iconPreviewColor();
      ids.forEach((id) => {
        const svg = this._iconSvgs[id];
        if (!svg) return;
        const [prefix, name] = splitIconId(id);
        const info = this._iconInfo[prefix] || {};
        const lic = info.license ? info.license.title : "unknown license";
        const title =
          name.replace(/-/g, " ") +
          " — " +
          (info.name || prefix) +
          " (" +
          lic +
          ")";
        const src =
          "data:image/svg+xml," +
          encodeURIComponent(svg.replace(/currentColor/g, this._iconTint));
        const b = h(
          "button",
          {
            class: "se-btn",
            type: "button",
            role: "option",
            title,
            "aria-label": title,
            onclick: () => this._pickIcon(id, b),
          },
          h("img", { src, alt: "", draggable: "false" }),
        );
        this.iconGrid.appendChild(b);
        this._iconShown.push(id);
      });
    }

    _iconCooling() {
      const left = Math.ceil(((this._iconCoolUntil || 0) - Date.now()) / 1000);
      if (left <= 0) return false;
      this.iconStatus.textContent =
        "The icon service is limiting requests. Please try again in " +
        left +
        " s.";
      return true;
    }

    _iconError(err) {
      if (err.status === 429) {
        const wait =
          isFinite(err.retryAfter) && err.retryAfter > 0 ? err.retryAfter : 60;
        this._iconCoolUntil = Date.now() + wait * 1000;
        this._iconCooling();
      } else {
        this.iconStatus.textContent =
          "Could not reach the icon service. Check your connection and try again.";
      }
      this._emit("error", err);
    }

    async _pickIcon(id, btn) {
      btn.disabled = true;
      try {
        const o = await this.addIcon(id);
        this._toggleIconPicker(false);
        this._select(o);
      } catch (err) {
        if (err.status === 429) this._iconError(err);
        else {
          this.iconStatus.textContent =
            "Could not load that icon. Please try again.";
          this._emit("error", err);
        }
      } finally {
        btn.disabled = false;
      }
    }

    _panelIcon(o) {
      const m = o.seIcon;
      const s = this._section("Icon");
      this._row(s, "Name", h("span", null, m.id));
      const lic = m.licenseUrl
        ? h(
            "a",
            { href: m.licenseUrl, target: "_blank", rel: "noopener" },
            m.license || "License",
          )
        : m.license || "unknown";
      this._row(
        s,
        "Set",
        h("span", null, m.set + (m.author ? " · " + m.author : "")),
      );
      this._row(s, "License", lic);
      if (m.attribution)
        s.appendChild(
          h(
            "div",
            { class: "se-credit" },
            'This license requires credit wherever the slide is shown, e.g. "' +
              m.set +
              (m.author ? " by " + m.author : "") +
              ", " +
              m.license +
              '".',
          ),
        );
    }

    /* ======================= SVG import & palette ======================= */

    async _onSvgFile() {
      const f = this.svgInput.files && this.svgInput.files[0];
      this.svgInput.value = "";
      if (!f) return;
      try {
        const o = await this.addSVG(await f.text(), { name: f.name });
        this._toggleIconPicker(false);
        this._select(o);
      } catch (err) {
        this.iconStatus.textContent =
          "Could not read that SVG file. " +
          (err && err.seMessage
            ? err.seMessage
            : "It may be damaged or use features the importer does not support.");
        this._emit("error", err);
      }
    }

    _panelSvgInfo(o) {
      const s = this._section("SVG");
      this._row(s, "File", h("span", null, o.seSvg.name || "SVG"));
    }

    _panelPalette(o) {
      const MAX = 12;
      const palette = this._svgPalette(o);
      if (!palette.length) return;
      const s = this._section("Colors");
      if (palette.length > MAX) {
        s.appendChild(
          h(
            "p",
            { class: "se-hint" },
            "This graphic uses " +
              palette.length +
              " colors. Color editing is available for up to " +
              MAX +
              " colors.",
          ),
        );
        return;
      }
      palette.forEach((key, i) => {
        this._row(
          s,
          String(i + 1),
          this._colorAlpha(
            o.seColors[key] || key,
            (c) => {
              if (c === key) delete o.seColors[key];
              else o.seColors[key] = c;
              this._svgApplyColors(o);
              this._changed();
            },
            "Color " + (i + 1),
          ),
        );
      });
      const changed = Object.keys(o.seColors || {}).length > 0;
      const reset = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          disabled: !changed,
          onclick: () => {
            o.seColors = {};
            this._svgApplyColors(o);
            this._changed();
            this._renderPanel();
          },
        },
        "Reset colors",
      );
      s.appendChild(h("div", { class: "se-actions" }, reset));
    }

    _panelIconColor(o) {
      const s = this._section("Color");
      const parts = o.getObjects();
      const first =
        parts.find((p) => typeof p.fill === "string" && p.fill !== "none") ||
        parts.find((p) => typeof p.stroke === "string");
      const cur = first
        ? typeof first.fill === "string" && first.fill !== "none"
          ? first.fill
          : first.stroke
        : "#000000";
      this._row(
        s,
        "Color",
        this._colorAlpha(
          cur,
          (c) => {
            parts.forEach((p) => {
              if (p.fill && p.fill !== "none") p.set("fill", c);
              if (p.stroke && p.stroke !== "none") p.set("stroke", c);
            });
            o.dirty = true;
            this._changed();
          },
          "Icon color",
        ),
      );
    }

    _panelCrop() {
      const s = this._section("Crop image");
      s.appendChild(
        h(
          "p",
          { class: "se-hint" },
          "Drag the frame or its handles to choose the visible area. Enter applies, Esc cancels.",
        ),
      );
      const apply = h("button", {
        class: "se-btn se-primary",
        type: "button",
        onclick: () => this._finishCrop(true),
      });
      apply.innerHTML = icon("check") + "<span>Apply</span>";
      const cancel = h("button", {
        class: "se-btn se-outline",
        type: "button",
        onclick: () => this._finishCrop(false),
      });
      cancel.innerHTML = icon("x") + "<span>Cancel</span>";
      const full = h(
        "button",
        {
          class: "se-btn se-outline",
          type: "button",
          onclick: () => this._resetCropFrame(),
        },
        "Full image",
      );
      s.appendChild(h("div", { class: "se-actions" }, apply, cancel, full));
    }
  }

  const IMPORT_FONTS = "\u0000import-fonts";
  const sheetPromises = {};
  /** Add a stylesheet <link> once and resolve when it has loaded (or failed). */
  function loadStylesheet(href) {
    if (sheetPromises[href]) return sheetPromises[href];
    const existing = document.querySelector('link[href="' + href + '"]');
    if (existing && existing.sheet)
      return (sheetPromises[href] = Promise.resolve());
    const link = existing || h("link", { rel: "stylesheet", href });
    sheetPromises[href] = new Promise((res) => {
      link.addEventListener("load", res, { once: true });
      link.addEventListener("error", res, { once: true });
    });
    if (!existing) document.head.appendChild(link);
    return sheetPromises[href];
  }

  function hasFiles(e) {
    const t = e.dataTransfer && e.dataTransfer.types;
    return !!t && Array.prototype.indexOf.call(t, "Files") !== -1;
  }

  return {
    version: VERSION,
    /** Create an editor inside `container` (element or selector). */
    create(container, options) {
      return new Editor(container, options);
    },
    Editor,
  };
});
