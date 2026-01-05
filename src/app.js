// @ts-check

import {
  parseYamlToTree,
  treeToYaml,
  findById,
  findParent,
  removeChild,
  insertChildAt,
  isInSubtree,
  collectSubtreeIds,
  positionsToPath,
  applyPositionsFromPath,
  stylesToPath,
  applyStylesFromPath,
  normalizeNode
} from "./model/tree.js";
import { TreeView } from "./view/treeView.js";
import { CanvasView } from "./view/canvasView.js";
import { NotePanel } from "./view/notePanel.js";
import { PanZoom } from "./ui/panZoom.js";
import { ProjectService } from "./services/projectService.js";
import { buildNodeCard } from "./view/nodeCard.js";
import { YamlEditor } from "./view/yamlEditor.js";

const DEFAULT_YAML = `root:
  title: Embedded / Hardware Engineer
  description: Development plan for the Embedded direction
  fields:
    owner: Team A
    updated: 2024-01
  children:
    - title: Electronics
      fields:
        level: base
      children:
        - title: Schematics
        - title: Power (DC/DC, LDO, PI)
        - title: Signal Integrity (basic)
    - title: Interfaces
      children:
        - title: UART
        - title: SPI / I2C
        - title: Ethernet
          children:
            - title: PHY / MAC
            - title: SFP
            - title: QSFP
    - title: FPGA
      children:
        - title: Verilog/SystemVerilog
        - title: Timing / CDC
        - title: PCIe (overview)
`;

class App {
  constructor() {
    this.debug = true;
    this.$yaml = document.getElementById("yaml");
    this.$yamlEditor = document.getElementById("yamlEditor");
    this.$status = document.getElementById("status");
    this.$noteTitle = document.getElementById("noteTitle");
    this.$titleColor = document.getElementById("titleColor");
    this.$titleBold = document.getElementById("titleBold");
    this.$titleItalic = document.getElementById("titleItalic");
    this.$noteDescription = document.getElementById("noteDescription");
    this.$noteTags = document.getElementById("noteTags");
    this.$noteColor = document.getElementById("noteColor");
    this.$btnColorReset = document.getElementById("btnColorReset");
    this.$colorSwatches = document.getElementById("colorSwatches");
    this.$btnColorDepth = document.getElementById("btnColorDepth");
    this.$btnColorRandom = document.getElementById("btnColorRandom");
    this.$titleColorSwatches = document.getElementById("titleColorSwatches");
    this.$noteFields = document.getElementById("noteFields");
    this.$noteText = document.getElementById("noteText");
    this.$treeRoot = document.getElementById("treeRoot");
    this.$treeViewport = document.getElementById("treeViewport");
    this.$treeView = document.getElementById("treeView");
    this.$treeDropIndicator = document.getElementById("treeDropIndicator");
    this.$canvasView = document.getElementById("canvasView");
    this.$canvasViewport = document.getElementById("canvasViewport");
    this.$canvasLinks = document.getElementById("canvasLinks");
    this.$canvasDropIndicator = document.getElementById("canvasDropIndicator");
    this.$btnViewTree = document.getElementById("btnViewTree");
    this.$btnViewCanvas = document.getElementById("btnViewCanvas");
    this.$btnLoad = document.getElementById("btnLoad");
    this.$btnExport = document.getElementById("btnExport");
    this.$btnFit = document.getElementById("btnFit");
    this.$btnAddChild = document.getElementById("btnAddChild");
    this.$btnDelete = document.getElementById("btnDelete");
    this.$btnCollapse = document.getElementById("btnCollapse");
    this.$btnOpenProject = document.getElementById("btnOpenProject");
    this.$btnSaveProject = document.getElementById("btnSaveProject");
    this.$btnResetLayout = document.getElementById("btnResetLayout");
    this.$btnAnchorToggle = document.getElementById("btnAnchorToggle");
    this.$btnClearAutosave = document.getElementById("btnClearAutosave");
    this.$layoutDirection = document.getElementById("layoutDirection");
    this.$layoutAlign = document.getElementById("layoutAlign");
    this.$hotkeyToggle = document.getElementById("hotkeyToggle");
    this.$canvasControls = document.getElementById("canvasControls");
    this.$btnUndo = document.getElementById("btnUndo");
    this.$btnRedo = document.getElementById("btnRedo");
    this.$searchInput = document.getElementById("searchInput");
    this.$btnSearchPrev = document.getElementById("btnSearchPrev");
    this.$btnSearchNext = document.getElementById("btnSearchNext");
    this.$searchCount = document.getElementById("searchCount");
    this.$searchAll = document.getElementById("searchAll");
    this.$searchTitle = document.getElementById("searchTitle");
    this.$searchTags = document.getElementById("searchTags");
    this.$searchDesc = document.getElementById("searchDesc");
    this.$searchNote = document.getElementById("searchNote");
    this.$searchFields = document.getElementById("searchFields");
    this.$searchRegex = document.getElementById("searchRegex");
    this.$searchCase = document.getElementById("searchCase");
    this.$resizer = document.getElementById("resizer");
    this.$noteResizer = document.getElementById("noteResizer");
    this.$leftPanel = document.querySelector(".left");
    this.$noteSidebar = document.getElementById("noteSidebar");
    this.$centerPanel = document.querySelector(".center");
    this.$breadcrumb = document.getElementById("breadcrumb");
    this.setActivePanel = null;
    this.activePanel = "center";

    this.projectService = new ProjectService();
    this.panZoomTree = new PanZoom(this.$treeView, this.$treeViewport, null);
    this.panZoomCanvas = new PanZoom(this.$canvasView, this.$canvasViewport, this.$canvasLinks);

    this.treeView = new TreeView(
      this.$treeRoot,
      this.$treeViewport,
      this.$treeDropIndicator,
      {
        onSelect: (id) => this.setSelected(id, { focus: false }),
        onToggle: (id) => this.toggleCollapse(id),
        onMove: (src, tgt, mode) => this.moveNode(src, tgt, mode),
        canDrop: (src, tgt, mode) => this.canDrop(src, tgt, mode)
      }
    );

    this.canvasView = new CanvasView(
      this.$canvasViewport,
      this.$canvasLinks,
      this.$canvasDropIndicator,
      this.panZoomCanvas,
      {
        onSelect: (id) => this.setSelected(id, { focus: false }),
        onToggle: (id) => this.toggleCollapse(id),
        onMove: (src, tgt, mode) => this.moveNode(src, tgt, mode),
        canDrop: (src, tgt, mode) => this.canDrop(src, tgt, mode),
        getDragIds: (id) => this.getDragIds(id),
        getPosition: (id) => this.posById.get(id) || null,
        setPosition: (id, x, y) => this.setPosition(id, x, y)
      }
    );

    this.notePanel = new NotePanel(
      {
        title: this.$noteTitle,
        titleColor: this.$titleColor,
        titleBold: this.$titleBold,
        titleItalic: this.$titleItalic,
        description: this.$noteDescription,
        tags: this.$noteTags,
        color: this.$noteColor,
        fields: this.$noteFields,
        note: this.$noteText
      },
      (data) => this.updateNoteData(data),
      () => this.onNoteBlur()
    );

    this.root = null;
    this.selectedId = null;
    this.activeView = "tree";
    this.posById = new Map();
    this.sizeById = new Map();
    this.layout = { direction: "ltr", align: "top", gap: 26, pad: 20 };
    this._measureHost = this.createMeasureHost();
    this.moveWithChildren = true;
    this.yamlEditor = new YamlEditor(this.$yamlEditor, this.$yaml);
    this._pendingDelete = { id: null, at: 0 };
    this.history = [];
    this.redoStack = [];
    this.isApplyingHistory = false;
    this.noteSnapshot = null;
    this.noteSnapshotId = null;
    this.searchResults = [];
    this.searchHits = new Set();
    this.searchIndex = -1;
    this.searchActiveId = null;
    this._autoSaveTimer = null;
  }

  init() {
    this.$layoutDirection.value = this.layout.direction;
    this.$layoutAlign.value = this.layout.align;
    if (!this.loadAutoProject()) {
      this.yamlEditor.setValue(DEFAULT_YAML);
      this.loadFromYaml(this.yamlEditor.getValue());
    }

    this.$btnLoad.addEventListener("click", () => this.loadFromYaml(this.yamlEditor.getValue()));
    this.$btnExport.addEventListener("click", () => this.exportYaml());
    this.$btnFit.addEventListener("click", () => this.fit());
    this.$btnAddChild.addEventListener("click", () => this.addChild());
    this.$btnDelete.addEventListener("click", () => this.deleteSelected());
    this.$btnCollapse.addEventListener("click", () => this.toggleCollapseAll());
    this.$btnViewTree.addEventListener("click", () => this.setActiveView("tree"));
    this.$btnViewCanvas.addEventListener("click", () => this.setActiveView("canvas"));
    this.$btnOpenProject.addEventListener("click", () => this.openProject());
    this.$btnSaveProject.addEventListener("click", () => this.saveProject());
    this.$btnClearAutosave.addEventListener("click", () => this.clearAutoProject());
    this.$btnResetLayout.addEventListener("click", () => this.resetLayout());
    this.$btnAnchorToggle.addEventListener("click", () => this.toggleAnchor());
    this.$btnUndo.addEventListener("click", () => this.undo());
    this.$btnRedo.addEventListener("click", () => this.redo());
    this.$btnColorReset.addEventListener("click", () => this.resetNodeColor());
    if (this.$titleColorSwatches) {
      this.$titleColorSwatches.querySelectorAll("[data-title-color]").forEach((btn) => {
        const el = /** @type {HTMLElement} */ (btn);
        const color = el.dataset.titleColor;
        if (color) el.style.background = color;
        el.addEventListener("click", () => {
          if (!color) return;
          this.applyTitleColor(color);
        });
      });
    }
    if (this.$colorSwatches) {
      this.$colorSwatches.querySelectorAll("[data-color]").forEach((btn) => {
        const el = /** @type {HTMLElement} */ (btn);
        const color = el.dataset.color;
        if (color) el.style.background = color;
        el.addEventListener("click", () => {
          if (!color) return;
          this.applyColorToSelected(color);
        });
      });
    }
    if (this.$btnColorDepth) {
      this.$btnColorDepth.addEventListener("click", () => this.colorByDepth());
    }
    if (this.$btnColorRandom) {
      this.$btnColorRandom.addEventListener("click", () => this.colorRandom());
    }
    this.$searchInput.addEventListener("input", () => this.updateSearch());
    this.$btnSearchPrev.addEventListener("click", () => this.jumpSearch(-1));
    this.$btnSearchNext.addEventListener("click", () => this.jumpSearch(1));
    [
      this.$searchAll,
      this.$searchTitle,
      this.$searchTags,
      this.$searchDesc,
      this.$searchNote,
      this.$searchFields,
      this.$searchRegex,
      this.$searchCase
    ].forEach((el) => el.addEventListener("change", () => this.updateSearch()));
    this.$searchInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        this.jumpSearch(e.shiftKey ? -1 : 1);
      }
    });
    this.$layoutDirection.addEventListener("change", () => this.updateLayoutSettings());
    this.$layoutAlign.addEventListener("change", () => this.updateLayoutSettings());
    this.$hotkeyToggle.addEventListener("click", () => this.toggleHotkeyHelp());
    this.setupResizer();
    this.setupNoteResizer();
    this.setupPanelFocus();
    this.setupColorNavigation();

    window.addEventListener("keydown", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const tag = target && target.tagName ? target.tagName.toLowerCase() : "";
      const isTyping = tag === "textarea" || tag === "input" || tag === "select";
      const inCodeMirror = target && target.closest && target.closest(".cm-editor");
      const isEscape = e.key === "Escape" || (e.ctrlKey && e.code === "BracketLeft");
      if (isEscape) {
        e.preventDefault();
        if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
        if (this.setActivePanel) this.setActivePanel("center");
        this.focusSelectedNode();
        return;
      }
      if (this.activePanel !== "center") {
        return;
      }
      if (isTyping || inCodeMirror) {
        return;
      }

      if (e.code === "Enter") { e.preventDefault(); this.focusTitle(); }
      // if (e.code === "Tab") { e.preventDefault(); this.addChild(); }
      if (e.code === "KeyF") {e.preventDefault(); this.fit(); }
      if (e.code === "KeyA") { e.preventDefault(); this.addChild(); }
      if (e.code === "Delete" || e.code === "Backspace" || e.code === "KeyD") { e.preventDefault(); this.confirmDelete(); }
      if (e.code === "ArrowUp") { e.preventDefault(); this.selectPrev(); }
      if (e.code === "ArrowDown") { e.preventDefault(); this.selectNext(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); this.selectParent(); }
      if (e.code === "ArrowRight") { e.preventDefault(); this.selectNextSibling(); }
      // if (e.code === "F2") { e.preventDefault(); this.renameSelected(); }
      if (e.code === "KeyR" && e.shiftKey) { e.preventDefault(); this.resetLayout(); }
      if (e.code === "KeyH") { e.preventDefault(); this.selectParent(); }
      if (e.code === "KeyJ") { e.preventDefault(); this.selectNext(); }
      if (e.code === "KeyK") { e.preventDefault(); this.selectPrev(); }
      if (e.code === "KeyL" && e.shiftKey) { e.preventDefault(); this.selectPrevSibling(); }
      else if (e.code === "KeyL") { e.preventDefault(); this.selectNextSibling(); }
      if (e.code === "KeyI") { e.preventDefault(); this.focusNote(); }
      if (e.code === "KeyY") { e.preventDefault(); this.focusYaml(); }
      if (e.code === "KeyU" && e.shiftKey) { e.preventDefault(); this.redo(); }
      else if (e.code === "KeyU") { e.preventDefault(); this.undo(); }
      if (e.code === "KeyC" && e.shiftKey) { e.preventDefault(); this.setActiveView("canvas"); }
      if (e.code === "KeyV" && e.shiftKey) { e.preventDefault(); this.setActiveView("tree"); }
      if (e.code === "KeyW") { e.preventDefault(); this.toggleCollapse(this.selectedId); }
      // Space unbound in center panel.
      if (e.code === "Slash" && !e.shiftKey) { e.preventDefault(); this.focusSearch(); }
      if (e.code === "Slash" && e.shiftKey) { e.preventDefault(); this.toggleHotkeyHelp(); }
    });

    this.updateAnchorButton();
    this.setActiveView("tree");
  }

  setupResizer() {
    if (!this.$resizer || !this.$leftPanel) return;
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const onMove = (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const minWidth = 240;
      const maxWidth = Math.max(minWidth, window.innerWidth - 360);
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
      this.$leftPanel.style.width = `${next}px`;
    };

    const onUp = () => {
      isDragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    this.$resizer.addEventListener("pointerdown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = this.$leftPanel.getBoundingClientRect().width;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  setupNoteResizer() {
    if (!this.$noteResizer || !this.$noteSidebar) return;
    let isDragging = false;
    let startX = 0;
    let startWidth = 0;

    const onMove = (e) => {
      if (!isDragging) return;
      const dx = startX - e.clientX;
      const minWidth = 240;
      const maxWidth = Math.max(minWidth, window.innerWidth - 360);
      const next = Math.max(minWidth, Math.min(maxWidth, startWidth + dx));
      this.$noteSidebar.style.width = `${next}px`;
    };

    const onUp = () => {
      isDragging = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    this.$noteResizer.addEventListener("pointerdown", (e) => {
      isDragging = true;
      startX = e.clientX;
      startWidth = this.$noteSidebar.getBoundingClientRect().width;
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    });
  }

  setupPanelFocus() {
    const panels = {
      left: this.$leftPanel,
      center: this.$centerPanel,
      note: this.$noteSidebar
    };
    const setActive = (name) => {
      Object.entries(panels).forEach(([key, el]) => {
        if (!el) return;
        el.classList.toggle("active", key === name);
      });
      this.activePanel = name;
    };
    this.setActivePanel = setActive;
    const detect = (target) => {
      if (!target || !target.closest) return;
      if (target.closest(".note-sidebar")) return setActive("note");
      if (target.closest(".left")) return setActive("left");
      if (target.closest(".center")) return setActive("center");
    };
    document.addEventListener("focusin", (e) => detect(e.target));
    if (this.$leftPanel) this.$leftPanel.addEventListener("pointerdown", (e) => detect(e.target));
    if (this.$centerPanel) this.$centerPanel.addEventListener("pointerdown", (e) => detect(e.target));
    if (this.$noteSidebar) this.$noteSidebar.addEventListener("pointerdown", (e) => detect(e.target));
    setActive("center");
  }

  setupColorNavigation() {
    if (!this.$noteSidebar) return;
    const moveFocus = (container, cols, dx, dy) => {
      const buttons = Array.from(container.querySelectorAll("button"));
      const active = document.activeElement;
      const idx = buttons.indexOf(active);
      if (idx === -1) return false;
      const rows = Math.ceil(buttons.length / cols);
      let row = Math.floor(idx / cols);
      let col = idx % cols;
      row = Math.max(0, Math.min(rows - 1, row + dy));
      col = Math.max(0, Math.min(cols - 1, col + dx));
      let next = row * cols + col;
      if (next >= buttons.length) next = buttons.length - 1;
      const nextBtn = buttons[next];
      if (nextBtn) nextBtn.focus();
      return true;
    };

    this.$noteSidebar.addEventListener("keydown", (e) => {
      const target = /** @type {HTMLElement} */ (e.target);
      const key = e.code;
      let dx = 0;
      let dy = 0;
      if (key === "ArrowLeft" || key === "KeyH") dx = -1;
      else if (key === "ArrowRight" || key === "KeyL") dx = 1;
      else if (key === "ArrowUp" || key === "KeyK") dy = -1;
      else if (key === "ArrowDown" || key === "KeyJ") dy = 1;
      else return;

      const titleGrid = target.closest(".title-color-swatches");
      if (titleGrid && (dx !== 0 || dy !== 0)) {
        e.preventDefault();
        moveFocus(titleGrid, 3, dx, 0);
        return;
      }
      const colorGrid = target.closest(".color-swatches");
      if (colorGrid && (dx !== 0 || dy !== 0)) {
        e.preventDefault();
        moveFocus(colorGrid, 9, dx, dy);
      }
    });
  }

  setStatus(msg, isErr = false) {
    this.$status.textContent = msg;
    this.$status.style.color = isErr ? "var(--bad)" : "var(--muted)";
    if (isErr && this.debug) console.warn("[tree] " + msg);
  }

  setSelected(id, options = { focus: false }) {
    this.selectedId = id;
    const n = findById(this.root, id);
    this.notePanel.setValue({
      title: n ? n.title : "",
      titleColor: n && n.style && n.style.titleColor ? n.style.titleColor : "#111827",
      titleBold: n && n.style ? Boolean(n.style.titleBold) : false,
      titleItalic: n && n.style ? Boolean(n.style.titleItalic) : false,
      description: n ? n.description : "",
      tags: n ? this.formatTags(n.tags) : "",
      color: n && n.style && n.style.color ? n.style.color : null,
      fields: n ? this.formatFields(n.fields) : "",
      note: n ? n.note : ""
    });
    if (this.searchResults.length) {
      const idx = this.searchResults.indexOf(id);
      if (idx !== -1) {
        this.searchIndex = idx;
        this.searchActiveId = id;
        this.updateSearchCount();
      }
    }
    if (this.setActivePanel) this.setActivePanel("center");
    this.render();
    this.noteSnapshot = n ? this.cloneData(this.getEditableData(n)) : null;
    this.noteSnapshotId = n ? n.id : null;
    this.updateBreadcrumb();
    if (options.focus) {
      requestAnimationFrame(() => this.focusSelectedNode());
    }
  }

  updateNoteData(data) {
    if (!this.root || !this.selectedId) return;
    const n = findById(this.root, this.selectedId);
    if (!n) return;
    n.title = (data.title || "").trim() || "Untitled";
    n.description = (data.description || "").trim();
    n.tags = this.parseTags(data.tags);
    n.fields = this.parseFields(data.fields);
    n.note = data.note || "";
    const style = {};
    if (data.colorEnabled && data.color) style.color = data.color;
    if (data.titleColor && data.titleColor !== "#111827") style.titleColor = data.titleColor;
    if (data.titleBold) style.titleBold = true;
    if (data.titleItalic) style.titleItalic = true;
    n.style = Object.keys(style).length ? style : null;
    if (n.kind === "scalar") {
      if (n.fields && typeof n.fields === "object" && !Array.isArray(n.fields) && "value" in n.fields) {
        n.value = n.fields.value;
      }
    }
    this.render();
    this.updateBreadcrumb();
  }

  resetNodeColor() {
    if (!this.root || !this.selectedId) return;
    const n = findById(this.root, this.selectedId);
    if (!n) return;
    n.style = null;
    this.notePanel.clearColor();
    this.updateNoteData(this.notePanel.getValue());
    this.onNoteBlur();
  }

  applyColorToSelected(color) {
    if (!this.root || !this.selectedId) return;
    this.$noteColor.value = color;
    this.notePanel.colorEnabled = true;
    this.updateNoteData(this.notePanel.getValue());
    this.onNoteBlur();
  }

  applyTitleColor(color) {
    if (!this.root || !this.selectedId) return;
    if (this.$titleColor) this.$titleColor.value = color;
    this.updateNoteData(this.notePanel.getValue());
    this.onNoteBlur();
  }

  getPalette() {
    return [
      "#d46b6b",
      "#d19a55",
      "#c7b85b",
      "#78a96d",
      "#5aa7a4",
      "#5b86c1",
      "#7b6cc2",
      "#b66cb0",
      "#ffffff",
      "#d9c2a3",
      "#b8d4d8",
      "#b7d1c2",
      "#d8b7b2",
      "#c4c7e3",
      "#cdd7a8",
      "#b7c2d6",
      "#d7c0b0",
      "#9ca3af",
      "#f5f0e6",
      "#e7f1f4",
      "#e6f0ea",
      "#f3e8e6",
      "#eef0f7",
      "#f1f3e8",
      "#e9edf2",
      "#f6efe8",
      "#111827"
    ];
  }

  colorByDepth() {
    if (!this.root) return;
    const palette = this.getPalette();
    const items = [];
    const walk = (node, depth) => {
      const before = this.getEditableData(node);
      const after = this.cloneData(before);
      after.style = { ...(after.style || {}), color: palette[depth % palette.length] };
      items.push({ id: node.id, before, after });
      node.style = { color: after.style.color };
      node.children.forEach((child) => walk(child, depth + 1));
    };
    walk(this.root, 0);
    this.pushHistory({ type: "bulkUpdate", items });
    this.render();
    this.syncYaml();
    if (this.selectedId) this.setSelected(this.selectedId);
    this.setStatus("Applied palette by depth.");
  }

  colorRandom() {
    if (!this.root) return;
    const palette = this.getPalette();
    const items = [];
    const walk = (node) => {
      const before = this.getEditableData(node);
      const after = this.cloneData(before);
      after.style = { ...(after.style || {}), color: palette[Math.floor(Math.random() * palette.length)] };
      items.push({ id: node.id, before, after });
      node.style = { color: after.style.color };
      node.children.forEach(walk);
    };
    walk(this.root);
    this.pushHistory({ type: "bulkUpdate", items });
    this.render();
    this.syncYaml();
    if (this.selectedId) this.setSelected(this.selectedId);
    this.setStatus("Applied random palette.");
  }

  syncYaml() {
    if (!this.root) return;
    this.yamlEditor.setValue(treeToYaml(this.root));
    this.scheduleAutoSave();
  }

  onNoteBlur() {
    if (!this.root || !this.selectedId) {
      this.syncYaml();
      return;
    }
    const n = findById(this.root, this.selectedId);
    if (!n) {
      this.syncYaml();
      return;
    }
    const current = this.getEditableData(n);
    if (this.noteSnapshot && this.noteSnapshotId === n.id && !this.isEqualData(this.noteSnapshot, current)) {
      this.pushHistory({
        type: "update",
        nodeId: n.id,
        before: this.cloneData(this.noteSnapshot),
        after: this.cloneData(current)
      });
    }
    this.noteSnapshot = this.cloneData(current);
    this.noteSnapshotId = n.id;
    this.syncYaml();
  }

  updateSearch() {
    if (!this.root) return;
    const query = (this.$searchInput.value || "").trim();
    const opts = this.getSearchOptions();
    if (!query) {
      this.searchResults = [];
      this.searchHits = new Set();
      this.searchIndex = -1;
      this.searchActiveId = null;
      this.updateSearchCount();
      this.render();
      return;
    }
    let regex = null;
    if (opts.regex) {
      try {
        regex = new RegExp(query, opts.caseSensitive ? "" : "i");
      } catch (err) {
        this.setStatus("Invalid regex.", true);
        return;
      }
    }
    const results = [];
    const needle = opts.caseSensitive ? query : query.toLowerCase();
    const walk = (node) => {
      const haystack = this.buildSearchText(node, opts);
      const hay = opts.caseSensitive ? haystack : haystack.toLowerCase();
      const isMatch = regex ? regex.test(haystack) : hay.includes(needle);
      if (isMatch) results.push(node.id);
      node.children.forEach(walk);
    };
    walk(this.root);
    this.searchResults = results;
    this.searchHits = new Set(results);
    if (!results.length) {
      this.searchIndex = -1;
      this.searchActiveId = null;
      this.updateSearchCount();
      this.render();
      return;
    }
    if (this.selectedId && results.includes(this.selectedId)) {
      this.searchIndex = results.indexOf(this.selectedId);
      this.searchActiveId = this.selectedId;
    } else {
      this.searchIndex = 0;
      this.searchActiveId = results[0];
    }
    this.updateSearchCount();
    this.render();
  }

  jumpSearch(direction) {
    if (!this.searchResults.length) return;
    const len = this.searchResults.length;
    let idx = this.searchIndex;
    if (idx < 0) idx = 0;
    else idx = (idx + direction + len) % len;
    this.searchIndex = idx;
    const id = this.searchResults[idx];
    this.searchActiveId = id;
    this.expandToNode(id);
    this.setSelected(id, { focus: true });
    this.updateSearchCount();
  }

  updateSearchCount() {
    if (!this.$searchCount) return;
    if (!this.searchResults.length) {
      this.$searchCount.textContent = "0";
      return;
    }
    const idx = this.searchIndex >= 0 ? this.searchIndex + 1 : 0;
    this.$searchCount.textContent = `${idx}/${this.searchResults.length}`;
  }

  getSearchOptions() {
    const opts = {
      all: this.$searchAll.checked,
      title: this.$searchTitle.checked,
      tags: this.$searchTags.checked,
      desc: this.$searchDesc.checked,
      note: this.$searchNote.checked,
      fields: this.$searchFields.checked,
      regex: this.$searchRegex.checked,
      caseSensitive: this.$searchCase.checked
    };
    if (!opts.all && !(opts.title || opts.tags || opts.desc || opts.note || opts.fields)) {
      opts.title = true;
    }
    return opts;
  }

  buildSearchText(node, opts) {
    const parts = [];
    const add = (value) => {
      if (value === undefined || value === null) return;
      const text = String(value).trim();
      if (text) parts.push(text);
    };
    if (opts.all || opts.title) add(node.title);
    if (opts.all || opts.desc) add(node.description);
    if (opts.all || opts.note) add(node.note);
    if (opts.all || opts.tags) add((node.tags || []).join(" "));
    if (opts.all || opts.fields) add(this.serializeFields(node.fields));
    return parts.join("\n");
  }

  serializeFields(fields) {
    if (!fields) return "";
    if (typeof fields === "string") return fields;
    try {
      return JSON.stringify(fields);
    } catch (err) {
      return String(fields);
    }
  }

  focusNote() {
    if (this.$noteText) this.$noteText.focus();
  }

  focusTitle() {
    if (this.$noteTitle) this.$noteTitle.focus();
  }

  focusYaml() {
    if (this.yamlEditor) this.yamlEditor.focus();
  }

  focusSearch() {
    if (this.$searchInput) this.$searchInput.focus();
  }

  confirmDelete() {
    if (!this.selectedId) return;
    const now = Date.now();
    const withinWindow = this._pendingDelete.id === this.selectedId && now - this._pendingDelete.at < 1500;
    if (!withinWindow) {
      this._pendingDelete = { id: this.selectedId, at: now };
      this.setStatus("Press Delete again to confirm.");
      return;
    }
    this._pendingDelete = { id: null, at: 0 };
    this.deleteSelected();
  }

  parseTags(text) {
    if (!text) return [];
    return text
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  formatTags(tags) {
    if (!tags || !tags.length) return "";
    return tags.join(", ");
  }

  parseFields(text) {
    const raw = (text || "").trim();
    if (!raw) return null;
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (!lines.length) return null;
    const isList = lines.every((line) => line.startsWith("- "));
    if (isList) {
      const items = lines
        .map((line) => line.replace(/^- +/, "").trim())
        .filter(Boolean);
      return items.length ? items : null;
    }
    const obj = {};
    for (const line of lines) {
      if (line.startsWith("#")) continue;
      const idx = line.indexOf(":");
      if (idx === -1) {
        obj[line] = "";
        continue;
      }
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!key) continue;
      obj[key] = value;
    }
    return Object.keys(obj).length ? obj : null;
  }

  formatFields(fields) {
    if (!fields) return "";
    if (Array.isArray(fields)) {
      return fields.map((value) => `- ${this.formatFieldValue(value)}`).join("\n");
    }
    if (typeof fields === "object") {
      return Object.entries(fields)
        .map(([key, value]) => `${key}: ${this.formatFieldValue(value)}`)
        .join("\n");
    }
    return String(fields);
  }

  formatFieldValue(value) {
    if (value === undefined || value === null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  }

  setPosition(id, x, y) {
    this.posById.set(id, { x, y });
  }

  ensurePositions() {
    const layout = this.buildLayout();
    if (this.posById.size === 0) {
      this.posById = layout;
      return;
    }
    for (const [id, pos] of layout.entries()) {
      if (!this.posById.has(id)) this.posById.set(id, pos);
    }
  }

  loadFromYaml(yamlText, positionsByPath = null, stylesByPath = null) {
    try {
      this.root = parseYamlToTree(yamlText);
      this.selectedId = this.root.id;
      this.history = [];
      this.redoStack = [];
      this.noteSnapshot = null;
      this.noteSnapshotId = null;
      this.posById = new Map();
      if (positionsByPath) {
        applyPositionsFromPath(this.root, positionsByPath, this.posById);
      }
      if (stylesByPath) {
        applyStylesFromPath(this.root, stylesByPath);
      }
      this.ensurePositions();
      this.setStatus("Loaded YAML.");
      this.fit();
      this.render();
      if (!positionsByPath) {
        requestAnimationFrame(() => this.resetLayout(true));
      }
      this.updateSearch();
      this.updateBreadcrumb();
    } catch (e) {
      this.setStatus("YAML error: " + e.message, true);
    }
  }

  exportYaml() {
    if (!this.root) return;
    this.syncYaml();
    this.setStatus("Exported Tree -> YAML.");
  }

  addChild() {
    if (!this.root) return;
    const n = findById(this.root, this.selectedId) || this.root;
    const newNode = normalizeNode({ title: "New node", children: [] });
    n.children.push(newNode);
    this.ensurePositions();
    this.setSelected(newNode.id);
    this.setStatus("Added child.");
    this.pushHistory({
      type: "add",
      parentId: n.id,
      index: n.children.length - 1,
      node: this.cloneData(newNode)
    });
    this.syncYaml();
  }

  deleteSelected() {
    if (!this.root || !this.selectedId) return;
    if (this.selectedId === this.root.id) { this.setStatus("Cannot delete root.", true); return; }
    const p = findParent(this.root, this.selectedId);
    if (!p) return;
    const idx = p.children.findIndex((c) => c.id === this.selectedId);
    const removed = removeChild(p, this.selectedId);
    if (removed) {
      this.pushHistory({
        type: "delete",
        parentId: p.id,
        index: idx,
        node: this.cloneData(removed)
      });
    }
    this.setSelected(p.id);
    this.setStatus("Deleted node.");
    this.syncYaml();
  }

  getVisibleNodes() {
    /** @type {import("./model/tree.js").TreeNode[]} */
    const list = [];
    const walk = (node) => {
      list.push(node);
      if (node.collapsed) return;
      node.children.forEach(walk);
    };
    if (this.root) walk(this.root);
    return list;
  }

  selectPrev() {
    const nodes = this.getVisibleNodes();
    const idx = nodes.findIndex((n) => n.id === this.selectedId);
    if (idx > 0) this.setSelected(nodes[idx - 1].id, { focus: true });
  }

  selectNext() {
    const nodes = this.getVisibleNodes();
    const idx = nodes.findIndex((n) => n.id === this.selectedId);
    if (idx >= 0 && idx < nodes.length - 1) this.setSelected(nodes[idx + 1].id, { focus: true });
  }

  selectParent() {
    if (!this.root || !this.selectedId) return;
    const parent = findParent(this.root, this.selectedId);
    if (parent) this.setSelected(parent.id, { focus: true });
  }

  selectFirstChild() {
    if (!this.root || !this.selectedId) return;
    const node = findById(this.root, this.selectedId);
    if (!node || !node.children.length) return;
    if (node.collapsed) node.collapsed = false;
    this.setSelected(node.children[0].id, { focus: true });
  }

  selectNextSibling() {
    if (!this.root || !this.selectedId) return;
    const parent = findParent(this.root, this.selectedId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === this.selectedId);
    if (idx === -1) return;
    const next = parent.children[idx + 1];
    if (next) this.setSelected(next.id, { focus: true });
  }

  selectPrevSibling() {
    if (!this.root || !this.selectedId) return;
    const parent = findParent(this.root, this.selectedId);
    if (!parent) return;
    const idx = parent.children.findIndex((c) => c.id === this.selectedId);
    if (idx <= 0) return;
    const prev = parent.children[idx - 1];
    if (prev) this.setSelected(prev.id, { focus: true });
  }

  focusSelectedNode() {
    if (!this.selectedId) return;
    const pad = 24;
    if (this.activeView === "tree") {
      const row = this.$treeRoot.querySelector(`li[data-id="${this.selectedId}"] .node-row`);
      if (!row) return;
      this.panIntoView(row, this.$treeView, this.panZoomTree, pad);
    } else {
      const nodeEl = this.$canvasViewport.querySelector(`.canvas-node[data-id="${this.selectedId}"]`);
      if (!nodeEl) return;
      this.panIntoView(nodeEl, this.$canvasView, this.panZoomCanvas, pad);
    }
  }

  expandToNode(id) {
    if (!this.root || !id) return;
    let parent = findParent(this.root, id);
    while (parent) {
      parent.collapsed = false;
      parent = findParent(this.root, parent.id);
    }
  }

  panIntoView(nodeEl, container, panZoom, padding) {
    const nodeRect = nodeEl.getBoundingClientRect();
    const contRect = container.getBoundingClientRect();
    let dx = 0;
    let dy = 0;
    if (nodeRect.left < contRect.left + padding) dx = contRect.left + padding - nodeRect.left;
    if (nodeRect.right > contRect.right - padding) dx = contRect.right - padding - nodeRect.right;
    if (nodeRect.top < contRect.top + padding) dy = contRect.top + padding - nodeRect.top;
    if (nodeRect.bottom > contRect.bottom - padding) dy = contRect.bottom - padding - nodeRect.bottom;
    if (dx !== 0 || dy !== 0) panZoom.panBy(dx, dy);
  }

  toggleCollapse(id) {
    if (!this.root || !id) return;
    const n = findById(this.root, id);
    if (!n) return;
    n.collapsed = !n.collapsed;
    this.render();
  }

  toggleCollapseAll() {
    if (!this.root) return;
    let hasExpanded = false;
    const walk = (node) => {
      if (node.children && node.children.length && !node.collapsed) hasExpanded = true;
      node.children.forEach(walk);
    };
    walk(this.root);
    const nextState = hasExpanded;
    const apply = (node) => {
      if (node.children && node.children.length) node.collapsed = nextState;
      node.children.forEach(apply);
    };
    apply(this.root);
    this.render();
    this.setStatus(nextState ? "Collapsed all." : "Expanded all.");
  }

  pushHistory(entry) {
    if (this.isApplyingHistory) return;
    this.history.push(entry);
    if (this.history.length > 200) this.history.shift();
    this.redoStack = [];
  }

  undo() {
    if (!this.history.length) { this.setStatus("Nothing to undo."); return; }
    const action = this.history.pop();
    this.isApplyingHistory = true;
    this.applyHistory(action, true);
    this.isApplyingHistory = false;
    this.redoStack.push(action);
    this.syncYaml();
  }

  redo() {
    if (!this.redoStack.length) { this.setStatus("Nothing to redo."); return; }
    const action = this.redoStack.pop();
    this.isApplyingHistory = true;
    this.applyHistory(action, false);
    this.isApplyingHistory = false;
    this.history.push(action);
    this.syncYaml();
  }

  applyHistory(action, isUndo) {
    if (!this.root) return;
    if (action.type === "add") {
      const parent = findById(this.root, action.parentId);
      if (parent) {
        if (isUndo) {
          removeChild(parent, action.node.id);
        } else {
          insertChildAt(parent, this.cloneData(action.node), action.index);
        }
      }
      this.render();
      return;
    }
    if (action.type === "delete") {
      const parent = findById(this.root, action.parentId);
      if (parent) {
        if (isUndo) {
          insertChildAt(parent, this.cloneData(action.node), action.index);
        } else {
          removeChild(parent, action.node.id);
        }
      }
      this.render();
      return;
    }
    if (action.type === "move") {
      const fromParentId = isUndo ? action.toParentId : action.fromParentId;
      const toParentId = isUndo ? action.fromParentId : action.toParentId;
      const toIndex = isUndo ? action.fromIndex : action.toIndex;
      const fromParent = findById(this.root, fromParentId);
      const toParent = findById(this.root, toParentId);
      if (!fromParent || !toParent) return;
      const moving = removeChild(fromParent, action.nodeId);
      if (moving) insertChildAt(toParent, moving, toIndex);
      this.render();
      return;
    }
    if (action.type === "update") {
      const node = findById(this.root, action.nodeId);
      if (!node) return;
      const data = isUndo ? action.before : action.after;
      this.applyEditableData(node, data);
      this.render();
      if (this.selectedId === node.id) this.setSelected(node.id);
      return;
    }
    if (action.type === "bulkUpdate") {
      action.items.forEach((item) => {
        const node = findById(this.root, item.id);
        if (!node) return;
        const data = isUndo ? item.before : item.after;
        this.applyEditableData(node, data);
      });
      this.render();
      if (this.selectedId) this.setSelected(this.selectedId);
      return;
    }
  }

  computeMoveMeta(sourceParent, sourceIndex, targetNode, targetId, mode) {
    if (!this.root) return { toParentId: sourceParent.id, toIndex: sourceIndex };
    if (mode === "inside") {
      return { toParentId: targetNode.id, toIndex: targetNode.children.length };
    }
    const targetParent = findParent(this.root, targetId);
    if (!targetParent) return { toParentId: sourceParent.id, toIndex: sourceIndex };
    let targetIndex = targetParent.children.findIndex((c) => c.id === targetId);
    if (mode === "after") targetIndex += 1;
    if (targetParent === sourceParent && sourceIndex < targetIndex) targetIndex -= 1;
    return { toParentId: targetParent.id, toIndex: targetIndex };
  }

  getEditableData(node) {
    return {
      title: node.title || "",
      description: node.description || "",
      tags: Array.isArray(node.tags) ? [...node.tags] : [],
      style: node.style ? this.cloneData(node.style) : null,
      fields: this.cloneData(node.fields),
      note: node.note || "",
      value: node.value
    };
  }

  applyEditableData(node, data) {
    node.title = (data.title || "").trim() || "Untitled";
    node.description = data.description || "";
    node.tags = Array.isArray(data.tags) ? [...data.tags] : [];
    node.style = data.style ? this.cloneData(data.style) : null;
    node.fields = this.cloneData(data.fields);
    node.note = data.note || "";
    if (node.kind === "scalar") {
      node.value = data.value;
    }
  }

  cloneData(data) {
    if (data === undefined) return undefined;
    if (data === null) return null;
    if (typeof data !== "object") return data;
    return JSON.parse(JSON.stringify(data));
  }

  isEqualData(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  moveNode(sourceId, targetId, mode) {
    if (!this.root) return;
    if (sourceId === targetId) return;
    if (sourceId === this.root.id) { this.setStatus("Cannot move root.", true); return; }
    if (!this.canDrop(sourceId, targetId, mode)) {
      this.setStatus("Invalid move (cycle).", true);
      if (this.debug) console.warn("[tree] moveNode blocked", { sourceId, targetId, mode });
      return;
    }

    const sourceParent = findParent(this.root, sourceId);
    const targetNode = findById(this.root, targetId);
    if (!sourceParent || !targetNode) {
      if (this.debug) console.warn("[tree] moveNode missing nodes", { sourceId, targetId, sourceParent, targetNode });
      return;
    }

    const sourceIndex = sourceParent.children.findIndex((c) => c.id === sourceId);
    const moveMeta = this.computeMoveMeta(sourceParent, sourceIndex, targetNode, targetId, mode);
    /** @type {import("./model/tree.js").TreeNode|null} */
    let moving = null;

    if (mode === "inside") {
      moving = removeChild(sourceParent, sourceId);
      if (!moving) {
        if (this.debug) console.warn("[tree] removeChild failed (inside)", { sourceId, targetId, mode });
        return;
      }
      targetNode.children.push(moving);
      targetNode.collapsed = false;
    } else {
      const targetParent = findParent(this.root, targetId);
      if (!targetParent) { this.setStatus("Invalid drop.", true); return; }
      let targetIndex = targetParent.children.findIndex((c) => c.id === targetId);
      if (mode === "after") targetIndex += 1;
      if (targetParent === sourceParent && sourceIndex < targetIndex) targetIndex -= 1;
      moving = removeChild(sourceParent, sourceId);
      if (!moving) {
        if (this.debug) console.warn("[tree] removeChild failed (sibling)", { sourceId, targetId, mode });
        return;
      }
      insertChildAt(targetParent, moving, targetIndex);
    }

    this.setSelected(moving.id);
    this.setStatus("Moved node.");
    this.pushHistory({
      type: "move",
      nodeId: moving.id,
      fromParentId: sourceParent.id,
      fromIndex: sourceIndex,
      toParentId: moveMeta.toParentId,
      toIndex: moveMeta.toIndex
    });
    if (this.debug) console.log("[tree] moved", { sourceId, targetId, mode });
    this.syncYaml();
  }

  canDrop(sourceId, targetId, mode) {
    if (!this.root) return false;
    if (sourceId === targetId) return false;
    if (mode !== "inside") {
      const targetParent = findParent(this.root, targetId);
      if (!targetParent) return false;
    }
    if (isInSubtree(this.root, sourceId, targetId)) {
      if (mode === "inside") return false;
      const targetParent = findParent(this.root, targetId);
      if (!targetParent) return false;
      if (isInSubtree(this.root, sourceId, targetParent.id)) return false;
    }
    return true;
  }

  setActiveView(view) {
    this.activeView = view;
    this.$btnViewTree.classList.toggle("active", view === "tree");
    this.$btnViewCanvas.classList.toggle("active", view === "canvas");
    this.$treeView.classList.toggle("hidden", view !== "tree");
    this.$canvasView.classList.toggle("hidden", view !== "canvas");
    if (this.$canvasControls) this.$canvasControls.classList.toggle("hidden", view !== "canvas");
  }

  fit() {
    this.panZoomTree.fit();
    this.panZoomCanvas.fit();
  }

  updateLayoutSettings() {
    this.layout.direction = this.$layoutDirection.value === "rtl" ? "rtl" : "ltr";
    this.layout.align = this.$layoutAlign.value === "center" ? "center" : "top";
    this.resetLayout();
  }

  toggleHotkeyHelp() {
    const el = document.getElementById("hotkeyHelp");
    if (!el) return;
    el.classList.toggle("hidden");
  }

  toggleAnchor() {
    this.moveWithChildren = !this.moveWithChildren;
    this.updateAnchorButton();
    this.setStatus(`Anchor: ${this.moveWithChildren ? "On" : "Off"}.`);
  }

  updateAnchorButton() {
    this.$btnAnchorToggle.textContent = `Anchor: ${this.moveWithChildren ? "On" : "Off"}`;
  }

  getDragIds(id) {
    if (!this.moveWithChildren) return [id];
    return collectSubtreeIds(this.root, id);
  }

  resetLayout(silent = false) {
    if (!this.root) return;
    this.posById = this.buildLayout();
    this.render();
    if (!silent) this.setStatus("Layout reset.");
  }

  createMeasureHost() {
    const host = document.createElement("div");
    host.style.position = "absolute";
    host.style.left = "-10000px";
    host.style.top = "-10000px";
    host.style.visibility = "hidden";
    host.style.pointerEvents = "none";
    document.body.appendChild(host);
    return host;
  }

  measureNode(node) {
    const el = document.createElement("div");
    el.className = "canvas-node";
    const caret = document.createElement("span");
    caret.className = "caret";
    caret.textContent = node.collapsed ? ">" : "v";
    el.appendChild(caret);
    el.appendChild(buildNodeCard(node));
    this._measureHost.appendChild(el);
    const size = { width: el.offsetWidth, height: el.offsetHeight };
    el.remove();
    return size;
  }

  buildLayout() {
    const X_PAD = this.layout.pad;
    const Y_PAD = this.layout.pad;
    const GAP = this.layout.gap;
    const direction = this.layout.direction;
    const align = this.layout.align;
    /** @type {Map<string, {x:number,y:number}>} */
    const positions = new Map();
    /** @type {Map<string, {width:number,height:number}>} */
    const sizes = new Map();

    const measureSizes = (node) => {
      sizes.set(node.id, this.measureNode(node));
      node.children.forEach(measureSizes);
    };
    measureSizes(this.root);
    this.sizeById = sizes;

    const measure = (node) => {
      const size = sizes.get(node.id) || { width: 0, height: 0 };
      const nodeHeight = size.height;
      if (node.collapsed || !node.children.length) {
        return { node, nodeHeight, subtreeHeight: nodeHeight, children: [], totalChildrenHeight: 0 };
      }
      const children = node.children.map((c) => measure(c));
      const totalChildrenHeight = children.reduce((sum, m) => sum + m.subtreeHeight, 0) + GAP * (children.length - 1);
      const subtreeHeight = align === "center" ? Math.max(nodeHeight, totalChildrenHeight) : nodeHeight + GAP + totalChildrenHeight;
      return { node, nodeHeight, subtreeHeight, children, totalChildrenHeight };
    };

    const assign = (measureNode, depth, yTop) => {
      const size = sizes.get(measureNode.node.id) || { width: 0, height: 0 };
      const baseX = X_PAD;
      const y = align === "center"
        ? Y_PAD + yTop + (measureNode.subtreeHeight - measureNode.nodeHeight) / 2
        : Y_PAD + yTop;
      const depthX = (node) => sizes.get(node.id)?.width || 0;
      let nodeX = baseX;
      if (direction === "ltr") {
        let cur = 0;
        const path = [];
        let p = measureNode.node;
        while (p && p !== this.root) {
          const parent = findParent(this.root, p.id);
          if (!parent) break;
          path.push(parent);
          p = parent;
        }
        for (let i = path.length - 1; i >= 0; i--) {
          cur += depthX(path[i]) + GAP;
        }
        nodeX = baseX + cur;
      } else {
        let cur = 0;
        const path = [];
        let p = measureNode.node;
        while (p && p !== this.root) {
          const parent = findParent(this.root, p.id);
          if (!parent) break;
          path.push(parent);
          p = parent;
        }
        for (let i = path.length - 1; i >= 0; i--) {
          cur += (depthX(path[i]) + GAP);
        }
        nodeX = baseX - cur - size.width;
      }
      const xPos = nodeX;
      positions.set(measureNode.node.id, { x: xPos, y });
      if (!measureNode.children.length) return;
      const offset = align === "center" ? (measureNode.subtreeHeight - measureNode.totalChildrenHeight) / 2 : (measureNode.nodeHeight + GAP);
      let cursor = yTop + offset;
      for (const child of measureNode.children) {
        assign(child, depth + 1, cursor);
        cursor += child.subtreeHeight + GAP;
      }
    };

    const rootMeasure = measure(this.root);
    assign(rootMeasure, 0, 0);
    if (direction === "rtl") {
      let minX = Infinity;
      positions.forEach((pos) => { if (pos.x < minX) minX = pos.x; });
      if (minX < X_PAD) {
        const shift = X_PAD - minX;
        positions.forEach((pos, id) => { positions.set(id, { x: pos.x + shift, y: pos.y }); });
      }
    }
    return positions;
  }

  render() {
    if (!this.root) return;
    this.ensurePositions();
    this.treeView.render(this.root, this.selectedId, this.searchHits, this.searchActiveId);
    this.canvasView.render(this.root, this.posById, this.sizeById, this.selectedId, this.searchHits, this.searchActiveId, this.layout.direction);
    this.updateBreadcrumb();
  }

  async openProject() {
    const res = await this.projectService.openProject();
    if (!res) return;
    try {
      const data = JSON.parse(res.text);
      if (!data || typeof data.yaml !== "string") throw new Error("Invalid project file");
      this.yamlEditor.setValue(data.yaml);
      const positions = data.positions && typeof data.positions === "object" ? data.positions : null;
      const styles = data.styles && typeof data.styles === "object" ? data.styles : null;
      this.loadFromYaml(data.yaml, positions, styles);
      this.saveAutoProject(data);
      this.setStatus("Project loaded.");
    } catch (e) {
      this.setStatus("Project error: " + e.message, true);
    }
  }

  async saveProject() {
    if (!this.root) return;
    const data = this.getProjectData();
    const text = JSON.stringify(data, null, 2);
    await this.projectService.saveProject(text);
    this.saveAutoProject(data);
    this.setStatus("Project saved.");
  }

  getProjectData() {
    return {
      version: 1,
      yaml: treeToYaml(this.root),
      positions: positionsToPath(this.root, this.posById),
      styles: stylesToPath(this.root)
    };
  }

  scheduleAutoSave() {
    if (!this.root) return;
    if (this._autoSaveTimer) clearTimeout(this._autoSaveTimer);
    this._autoSaveTimer = setTimeout(() => {
      this.saveAutoProject(this.getProjectData());
      this._autoSaveTimer = null;
    }, 600);
  }

  saveAutoProject(data) {
    try {
      localStorage.setItem("skilltree.lastProject", JSON.stringify(data));
    } catch (e) {
      if (this.debug) console.warn("[tree] autosave failed", e);
    }
  }

  clearAutoProject() {
    if (!confirm("Clear autosaved project data? This cannot be undone.")) return;
    try {
      localStorage.removeItem("skilltree.lastProject");
      this.setStatus("Autosave cleared.");
    } catch (e) {
      this.setStatus("Autosave clear failed.", true);
      if (this.debug) console.warn("[tree] autosave clear failed", e);
    }
  }

  loadAutoProject() {
    try {
      const raw = localStorage.getItem("skilltree.lastProject");
      if (!raw) return false;
      const data = JSON.parse(raw);
      if (!data || typeof data.yaml !== "string") return false;
      const positions = data.positions && typeof data.positions === "object" ? data.positions : null;
      const styles = data.styles && typeof data.styles === "object" ? data.styles : null;
      this.yamlEditor.setValue(data.yaml);
      this.loadFromYaml(data.yaml, positions, styles);
      this.setStatus("Auto-loaded last project.");
      this.updateBreadcrumb();
      return true;
    } catch (e) {
      if (this.debug) console.warn("[tree] autoload failed", e);
      return false;
    }
  }

  updateBreadcrumb() {
    if (!this.$breadcrumb) return;
    if (!this.root) { this.$breadcrumb.textContent = ""; return; }
    const path = [];
    let node = this.selectedId ? findById(this.root, this.selectedId) : null;
    while (node) {
      path.unshift(node.title || "Untitled");
      node = findParent(this.root, node.id);
    }
    if (!path.length) path.push(this.root.title || "Root");
    this.$breadcrumb.textContent = path.join("  /  ");
  }
}

const app = new App();
app.init();
