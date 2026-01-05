// @ts-check

export class PanZoom {
  /**
   * @param {HTMLElement} container
   * @param {HTMLElement} viewport
   * @param {SVGElement|null} linkGroup
   */
  constructor(container, viewport, linkGroup = null) {
    this.container = container;
    this.viewport = viewport;
    this.linkGroup = linkGroup;
    this.view = { scale: 1, tx: 0, ty: 0 };
    this._setup();
  }

  _setup() {
    let isPanning = false;
    let panStart = { x: 0, y: 0, tx: 0, ty: 0 };

    this.container.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect = this.container.getBoundingClientRect();
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      this.zoomAt(delta, cx, cy);
    }, { passive: false });

    this.container.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      if (e.target.closest(".node-row") || e.target.closest(".canvas-node")) return;
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY, tx: this.view.tx, ty: this.view.ty };
    });

    window.addEventListener("mousemove", (e) => {
      if (!isPanning) return;
      this.view.tx = panStart.tx + (e.clientX - panStart.x);
      this.view.ty = panStart.ty + (e.clientY - panStart.y);
      this.apply();
    });

    window.addEventListener("mouseup", () => { isPanning = false; });
  }

  apply() {
    this.viewport.style.transform = `translate(${this.view.tx}px, ${this.view.ty}px) scale(${this.view.scale})`;
    if (this.linkGroup) {
      this.linkGroup.setAttribute("transform", `translate(${this.view.tx} ${this.view.ty}) scale(${this.view.scale})`);
    }
  }

  fit() {
    this.view = { scale: 1, tx: 0, ty: 0 };
    this.apply();
  }

  zoomAt(delta, cx, cy) {
    const scale = Math.max(0.3, Math.min(2.5, this.view.scale * delta));
    const px = (cx - this.view.tx) / this.view.scale;
    const py = (cy - this.view.ty) / this.view.scale;
    this.view.tx = cx - px * scale;
    this.view.ty = cy - py * scale;
    this.view.scale = scale;
    this.apply();
  }

  /** @param {number} dx @param {number} dy */
  panBy(dx, dy) {
    this.view.tx += dx;
    this.view.ty += dy;
    this.apply();
  }

  /** @param {number} clientX @param {number} clientY */
  screenToWorld(clientX, clientY) {
    const rect = this.container.getBoundingClientRect();
    const sx = clientX - rect.left;
    const sy = clientY - rect.top;
    return { x: (sx - this.view.tx) / this.view.scale, y: (sy - this.view.ty) / this.view.scale };
  }
}
