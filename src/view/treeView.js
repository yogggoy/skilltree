// @ts-check

import { buildNodeCard } from "./nodeCard.js";

export class TreeView {
  /**
   * @param {HTMLElement} rootEl
   * @param {HTMLElement} viewport
   * @param {HTMLElement} dropIndicator
   * @param {{
   *  onSelect: (id: string) => void,
   *  onToggle: (id: string) => void,
   *  onMove: (sourceId: string, targetId: string, mode: "before"|"after"|"inside") => void,
   *  canDrop: (sourceId: string, targetId: string, mode: "before"|"after"|"inside") => boolean,
   *  onDragStart?: (id: string) => void,
   *  onDragEnd?: () => void
   * }} callbacks
   */
  constructor(rootEl, viewport, dropIndicator, callbacks) {
    this.rootEl = rootEl;
    this.viewport = viewport;
    this.dropIndicator = dropIndicator;
    this.callbacks = callbacks;
    this.dragId = null;
  }

  /**
   * @param {import("../model/tree.js").TreeNode} root
   * @param {string|null} selectedId
   * @param {Set<string>|null} searchHits
   * @param {string|null} activeSearchId
   */
  render(root, selectedId, searchHits = null, activeSearchId = null) {
    this.rootId = root.id;
    this.rootEl.innerHTML = "";
    this._buildTree(root, this.rootEl, selectedId, searchHits, activeSearchId);
    this.updateLineStops();
  }

  clearDropIndicator() {
    this.dropIndicator.style.opacity = "0";
    const rows = this.rootEl.querySelectorAll(".node-row.drop-inside");
    rows.forEach((r) => r.classList.remove("drop-inside"));
  }

  /** @param {HTMLElement} target @param {"before"|"after"} mode @param {HTMLElement} container */
  showDropIndicator(target, mode, container) {
    const rect = target.getBoundingClientRect();
    const canvasRect = container.getBoundingClientRect();
    const top = mode === "before" ? rect.top : rect.bottom;
    this.dropIndicator.style.top = `${top - canvasRect.top}px`;
    this.dropIndicator.style.left = "0px";
    this.dropIndicator.style.right = "0px";
    this.dropIndicator.style.opacity = "1";
  }

  /**
   * @param {import("../model/tree.js").TreeNode} node
   * @param {HTMLElement} parentUl
   * @param {string|null} selectedId
   * @param {Set<string>|null} searchHits
   * @param {string|null} activeSearchId
   */
  _buildTree(node, parentUl, selectedId, searchHits, activeSearchId) {
    const li = document.createElement("li");
    li.dataset.id = node.id;

    const row = document.createElement("div");
    row.className = "node-row" + (node.id === selectedId ? " selected" : "");
    if (searchHits && searchHits.has(node.id)) row.classList.add("search-hit");
    if (activeSearchId && node.id === activeSearchId) row.classList.add("search-active");
    row.draggable = true;

    const caret = document.createElement("span");
    caret.className = "caret" + (node.children.length ? "" : " empty");
    caret.textContent = node.collapsed ? ">" : "v";
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!node.children.length) return;
      this.callbacks.onToggle(node.id);
    });

    row.addEventListener("click", (e) => {
      e.stopPropagation();
      this.callbacks.onSelect(node.id);
    });
    row.addEventListener("mouseenter", () => li.classList.add("hover"));
    row.addEventListener("mouseleave", () => li.classList.remove("hover"));

    row.addEventListener("dragstart", (e) => {
      this.dragId = node.id;
      if (this.callbacks.onDragStart) this.callbacks.onDragStart(node.id);
      e.dataTransfer.setData("text/plain", node.id);
      e.dataTransfer.effectAllowed = "move";
    });

    row.addEventListener("dragover", (e) => {
      if (!this.dragId || this.dragId === node.id) return;
      e.preventDefault();

      const rect = row.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const ratio = y / rect.height;
      let mode = ratio < 0.4 ? "before" :
                 ratio > 0.6 ? "after" : "inside";
      if (node.id === this.rootId) mode = "inside";

      if (!this.callbacks.canDrop(this.dragId, node.id, mode)) {
        if (mode === "inside") {
          mode = ratio < 0.5 ? "before" : "after";
        }
      }
      if (!this.callbacks.canDrop(this.dragId, node.id, mode)) return;

      this.clearDropIndicator();
      if (mode === "inside") {
        row.classList.add("drop-inside");
      } else {
        this.showDropIndicator(row, mode, this.viewport.parentElement);
      }
      this._dropInfo = { targetId: node.id, mode };
    });

    row.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!this._dropInfo || !this.dragId) return;
      this.callbacks.onMove(this.dragId, this._dropInfo.targetId, this._dropInfo.mode);
      this.clearDropIndicator();
    });

    row.addEventListener("dragend", () => {
      this.dragId = null;
      this._dropInfo = null;
      this.clearDropIndicator();
      if (this.callbacks.onDragEnd) this.callbacks.onDragEnd();
    });

    this.applyNodeStyle(row, node);

    row.appendChild(caret);
    row.appendChild(buildNodeCard(node));
    li.appendChild(row);

    if (!node.collapsed && node.children.length) {
      const ul = document.createElement("ul");
      for (const c of node.children) this._buildTree(c, ul, selectedId, searchHits, activeSearchId);
      li.appendChild(ul);
    }

    parentUl.appendChild(li);
  }

  updateLineStops() {
    const items = this.rootEl.querySelectorAll("li");
    items.forEach((li) => {
      const row = li.querySelector(":scope > .node-row");
      if (!row) return;
      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      li.style.setProperty("--row-center", `${rowCenter}px`);
    });
  }

  /** @param {HTMLElement} el @param {import("../model/tree.js").TreeNode} node */
  applyNodeStyle(el, node) {
    if (node.style && node.style.color) {
      const bg = node.style.color;
      el.style.setProperty("--node-bg", bg);
      el.style.setProperty("--node-border", adjustColor(bg, -18));
      el.style.setProperty("--node-text", pickTextColor(bg));
      el.style.setProperty("--select-border", pickTextColor(bg));
    } else {
      el.style.removeProperty("--node-bg");
      el.style.removeProperty("--node-border");
      el.style.removeProperty("--node-text");
      el.style.removeProperty("--select-border");
    }
    if (node.style && node.style.titleColor) {
      el.style.setProperty("--title-color", node.style.titleColor);
    } else {
      el.style.removeProperty("--title-color");
    }
    if (node.style && node.style.titleBold) {
      el.style.setProperty("--title-weight", "700");
    } else {
      el.style.removeProperty("--title-weight");
    }
    if (node.style && node.style.titleItalic) {
      el.style.setProperty("--title-style", "italic");
    } else {
      el.style.removeProperty("--title-style");
    }
    if (node.style && node.style.titleFont) {
      el.style.setProperty("--title-font", getTitleFontFamily(node.style.titleFont));
    } else {
      el.style.removeProperty("--title-font");
    }
  }
}

function getTitleFontFamily(key) {
  switch (key) {
    case "gost":
      return "\"GOST Type A\", \"GOST 2.304\", \"Bahnschrift\", \"Segoe UI\", sans-serif";
    case "din":
      return "\"DIN 1451\", \"DIN\", \"Bahnschrift\", \"Segoe UI\", sans-serif";
    case "iso":
      return "\"ISO 3098\", \"Bahnschrift\", \"Segoe UI\", sans-serif";
    case "jis":
      return "\"JIS Z 8313\", \"Bahnschrift\", \"Segoe UI\", sans-serif";
    default:
      return "inherit";
  }
}

function pickTextColor(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return "var(--text)";
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? "#1f2937" : "#f8fafc";
}

function adjustColor(hex, amount) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const clamp = (v) => Math.max(0, Math.min(255, v));
  const toHex = (v) => clamp(v).toString(16).padStart(2, "0");
  return "#" + toHex(rgb.r + amount) + toHex(rgb.g + amount) + toHex(rgb.b + amount);
}

function hexToRgb(hex) {
  if (!hex || typeof hex !== "string") return null;
  const cleaned = hex.replace("#", "");
  if (cleaned.length !== 6) return null;
  const num = parseInt(cleaned, 16);
  if (Number.isNaN(num)) return null;
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}
