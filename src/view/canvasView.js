// @ts-check

import { buildNodeCard } from "./nodeCard.js";

export class CanvasView {
  /**
   * @param {HTMLElement} viewport
   * @param {SVGElement} linkGroup
   * @param {HTMLElement} dropIndicator
   * @param {import("../ui/panZoom.js").PanZoom} panZoom
   * @param {{
   *  onSelect: (id: string) => void,
   *  onToggle: (id: string) => void,
   *  onMove: (sourceId: string, targetId: string, mode: "before"|"after"|"inside") => void,
   *  canDrop: (sourceId: string, targetId: string, mode: "before"|"after"|"inside") => boolean,
   *  getDragIds: (id: string) => string[],
   *  getPosition: (id: string) => {x:number,y:number} | null,
   *  setPosition: (id: string, x: number, y: number) => void,
   * }} callbacks
   */
  constructor(viewport, linkGroup, dropIndicator, panZoom, callbacks) {
    this.viewport = viewport;
    this.linkGroup = linkGroup;
    this.dropIndicator = dropIndicator;
    this.panZoom = panZoom;
    this.callbacks = callbacks;
    this.nodeEls = new Map();
    this.drag = null;
    this.dropInfo = null;
  }

  clearDropIndicator() {
    this.dropIndicator.style.opacity = "0";
    this.viewport.querySelectorAll(".canvas-node.drop-inside").forEach((el) => {
      el.classList.remove("drop-inside");
    });
    this.dropInfo = null;
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
   * @param {import("../model/tree.js").TreeNode} root
   * @param {Map<string, {x:number,y:number}>} positions
   * @param {Map<string, {width:number,height:number}>} sizeById
   * @param {string|null} selectedId
   * @param {Set<string>|null} searchHits
   * @param {string|null} activeSearchId
   * @param {"ltr"|"rtl"} direction
   */
  render(root, positions, sizeById, selectedId, searchHits, activeSearchId, direction) {
    this.rootId = root.id;
    this.positions = positions;
    this.sizeById = sizeById;
    this.direction = direction;
    this.viewport.innerHTML = "";
    this.linkGroup.innerHTML = "";
    this.nodeEls.clear();

    const nodes = [];
    const links = [];
    const walk = (node) => {
      nodes.push(node);
      if (!node.collapsed) {
        for (const c of node.children || []) {
          links.push({ source: node, target: c });
          walk(c);
        }
      }
    };
    walk(root);

    for (const node of nodes) {
      const pos = positions.get(node.id) || { x: 0, y: 0 };
      const el = document.createElement("div");
      el.className = "canvas-node" + (node.id === selectedId ? " selected" : "");
      if (searchHits && searchHits.has(node.id)) el.classList.add("search-hit");
      if (activeSearchId && node.id === activeSearchId) el.classList.add("search-active");
      el.dataset.id = node.id;
      el.style.left = `${pos.x}px`;
      el.style.top = `${pos.y}px`;

      const caret = document.createElement("span");
      caret.className = "caret" + (node.children.length ? "" : " empty");
      caret.textContent = node.collapsed ? ">" : "v";
      caret.addEventListener("pointerdown", (e) => {
        e.stopPropagation();
        e.preventDefault();
      });
      caret.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!node.children.length) return;
        this.callbacks.onToggle(node.id);
      });

      el.appendChild(caret);
      el.appendChild(buildNodeCard(node));

      el.addEventListener("click", (e) => {
        e.stopPropagation();
        this.callbacks.onSelect(node.id);
      });

      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (!node.children.length) return;
        this.callbacks.onToggle(node.id);
      });

      el.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        if (e.target && e.target.closest && e.target.closest(".caret")) return;
        el.setPointerCapture(e.pointerId);
        const p = this.panZoom.screenToWorld(e.clientX, e.clientY);
        const start = positions.get(node.id) || { x: 0, y: 0 };
        const dragIds = this.callbacks.getDragIds(node.id);
        const snapshot = new Map();
        dragIds.forEach((id) => {
          const pos = positions.get(id) || { x: 0, y: 0 };
          snapshot.set(id, { x: pos.x, y: pos.y });
        });
        this.drag = {
          id: node.id,
          startX: p.x,
          startY: p.y,
          origX: start.x,
          origY: start.y,
          snapshot
        };
        el.style.cursor = "grabbing";
      });

      el.addEventListener("pointermove", (e) => {
        if (!this.drag || this.drag.id !== node.id) return;
        const p = this.panZoom.screenToWorld(e.clientX, e.clientY);
        const dx = p.x - this.drag.startX;
        const dy = p.y - this.drag.startY;
        this.drag.snapshot.forEach((pos, id) => {
          const nx = pos.x + dx;
          const ny = pos.y + dy;
          this.callbacks.setPosition(id, nx, ny);
          const nodeEl = this.nodeEls.get(id);
          if (nodeEl) {
            nodeEl.style.left = `${nx}px`;
            nodeEl.style.top = `${ny}px`;
          }
        });
        const blocked = new Set(this.drag.snapshot.keys());
        this.updateDropTarget(e.clientX, e.clientY, node.id, blocked);
        this.drawLinks(links, this.positions);
      });

      el.addEventListener("pointerup", (e) => {
        if (!this.drag || this.drag.id !== node.id) return;
        el.releasePointerCapture(e.pointerId);
        el.style.cursor = "grab";
        this.finalizeDrop(node.id);
        this.drag = null;
      });

      el.addEventListener("pointercancel", () => {
        if (!this.drag || this.drag.id !== node.id) return;
        el.style.cursor = "grab";
        this.clearDropIndicator();
        this.drag = null;
      });

      this.applyNodeStyle(el, node);

      this.viewport.appendChild(el);
      this.nodeEls.set(node.id, el);
    }

    requestAnimationFrame(() => {
      this.drawLinks(links, positions);
    });
  }

  /** @param {{source:any,target:any}[]} links @param {Map<string,{x:number,y:number}>} positions */
  drawLinks(links, positions) {
    this.linkGroup.innerHTML = "";
    const ltr = this.direction !== "rtl";
    const BUS_OFFSET = 12;
    /** @type {Map<string, {parent:any, children:any[]}>} */
    const grouped = new Map();
    for (const link of links) {
      const id = link.source.id;
      if (!grouped.has(id)) grouped.set(id, { parent: link.source, children: [] });
      grouped.get(id).children.push(link.target);
    }

    const svgNS = "http://www.w3.org/2000/svg";
    const attachHover = (line, groupEl) => {
      line.addEventListener("mouseenter", () => groupEl.classList.add("hover"));
      line.addEventListener("mouseleave", () => groupEl.classList.remove("hover"));
    };

    grouped.forEach((group, parentId) => {
      const parentEl = this.nodeEls.get(parentId);
      const parentPos = positions.get(parentId);
      if (!parentPos) return;
      const parentSize = this.getNodeSize(parentId, parentEl);
      const parentWidth = parentSize.width;
      const parentHeight = parentSize.height;
      const parentX = parentPos.x;
      const parentY = parentPos.y + parentHeight / 2;

      const trunkX = ltr ? parentPos.x + parentWidth + BUS_OFFSET : parentPos.x - BUS_OFFSET;

      const childPoints = [];
      for (const child of group.children) {
        const childEl = this.nodeEls.get(child.id);
        const childPos = positions.get(child.id);
        if (!childPos) continue;
        const childSize = this.getNodeSize(child.id, childEl);
        const childWidth = childSize.width;
        const childHeight = childSize.height;
        const cx = ltr ? childPos.x : childPos.x + childWidth;
        const cy = childPos.y + childHeight / 2;
        childPoints.push({ x: cx, y: cy });
      }
      if (!childPoints.length) return;

      const minChildY = Math.min(...childPoints.map((p) => p.y));
      const maxChildY = Math.max(...childPoints.map((p) => p.y));
      const minY = Math.min(parentY, minChildY);
      const maxY = Math.max(parentY, maxChildY);

      const groupEl = document.createElementNS(svgNS, "g");
      groupEl.classList.add("link-group");
      groupEl.dataset.group = parentId;

      const parentSeg = document.createElementNS(svgNS, "line");
      parentSeg.classList.add("link-seg");
      parentSeg.setAttribute("x1", String(parentX + (ltr ? parentWidth : 0)));
      parentSeg.setAttribute("y1", String(parentY));
      parentSeg.setAttribute("x2", String(trunkX));
      parentSeg.setAttribute("y2", String(parentY));
      groupEl.appendChild(parentSeg);
      const parentHit = document.createElementNS(svgNS, "line");
      parentHit.classList.add("link-hit");
      parentHit.setAttribute("x1", parentSeg.getAttribute("x1"));
      parentHit.setAttribute("y1", parentSeg.getAttribute("y1"));
      parentHit.setAttribute("x2", parentSeg.getAttribute("x2"));
      parentHit.setAttribute("y2", parentSeg.getAttribute("y2"));
      attachHover(parentHit, groupEl);
      groupEl.appendChild(parentHit);

      const trunk = document.createElementNS(svgNS, "line");
      trunk.classList.add("link-seg");
      trunk.setAttribute("x1", String(trunkX));
      trunk.setAttribute("y1", String(minY));
      trunk.setAttribute("x2", String(trunkX));
      trunk.setAttribute("y2", String(maxY));
      groupEl.appendChild(trunk);
      const trunkHit = document.createElementNS(svgNS, "line");
      trunkHit.classList.add("link-hit");
      trunkHit.setAttribute("x1", trunk.getAttribute("x1"));
      trunkHit.setAttribute("y1", trunk.getAttribute("y1"));
      trunkHit.setAttribute("x2", trunk.getAttribute("x2"));
      trunkHit.setAttribute("y2", trunk.getAttribute("y2"));
      attachHover(trunkHit, groupEl);
      groupEl.appendChild(trunkHit);

      childPoints.forEach((p) => {
        const seg = document.createElementNS(svgNS, "line");
        seg.classList.add("link-seg");
        seg.setAttribute("x1", String(trunkX));
        seg.setAttribute("y1", String(p.y));
        seg.setAttribute("x2", String(p.x));
        seg.setAttribute("y2", String(p.y));
        groupEl.appendChild(seg);
        const hit = document.createElementNS(svgNS, "line");
        hit.classList.add("link-hit");
        hit.setAttribute("x1", seg.getAttribute("x1"));
        hit.setAttribute("y1", seg.getAttribute("y1"));
        hit.setAttribute("x2", seg.getAttribute("x2"));
        hit.setAttribute("y2", seg.getAttribute("y2"));
        attachHover(hit, groupEl);
        groupEl.appendChild(hit);
      });

      this.linkGroup.appendChild(groupEl);
    });
  }

  updateDropTarget(clientX, clientY, dragNodeId, blockedIds) {
    const els = document.elementsFromPoint(clientX, clientY);
    const target = els.find((el) => {
      if (!el.classList || !el.classList.contains("canvas-node")) return false;
      const id = el.dataset.id;
      if (!id || id === dragNodeId) return false;
      if (blockedIds && blockedIds.has(id)) return false;
      return true;
    });
    if (!target) { this.clearDropIndicator(); return; }
    const targetId = target.dataset.id;
    if (!targetId) { this.clearDropIndicator(); return; }

    const rect = target.getBoundingClientRect();
    const y = clientY - rect.top;
    const ratio = y / rect.height;
    let mode = ratio < 0.4 ? "before" :
               ratio > 0.6 ? "after" : "inside";
    if (targetId === this.rootId) mode = "inside";

    if (!this.callbacks.canDrop(dragNodeId, targetId, mode)) {
      if (mode === "inside") {
        mode = ratio < 0.5 ? "before" : "after";
      }
    }
    if (!this.callbacks.canDrop(dragNodeId, targetId, mode)) return;

    this.clearDropIndicator();
    if (mode === "inside") {
      target.classList.add("drop-inside");
    } else {
      this.showDropIndicator(target, mode, this.viewport.parentElement);
    }
    this.dropInfo = { targetId, mode };
  }

  finalizeDrop(dragNodeId) {
    if (!this.dropInfo) { this.clearDropIndicator(); return; }
    this.callbacks.onMove(dragNodeId, this.dropInfo.targetId, this.dropInfo.mode);
    this.clearDropIndicator();
  }

  /** @param {string} id @param {HTMLElement|null} el */
  getNodeSize(id, el) {
    if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
      return { width: el.offsetWidth, height: el.offsetHeight };
    }
    if (this.sizeById && this.sizeById.has(id)) {
      return this.sizeById.get(id);
    }
    return { width: 0, height: 0 };
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
