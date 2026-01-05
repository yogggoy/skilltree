// @ts-check

export class NotePanel {
  /**
   * @param {{title: HTMLInputElement, titleColor: HTMLInputElement, titleBold: HTMLInputElement, titleItalic: HTMLInputElement, description: HTMLInputElement, tags: HTMLInputElement, color: HTMLInputElement, fields: HTMLTextAreaElement, note: HTMLTextAreaElement}} elements
   * @param {(data: {title: string, titleColor: string, titleBold: boolean, titleItalic: boolean, description: string, tags: string, color: string, colorEnabled: boolean, fields: string, note: string}) => void} onChange
   * @param {() => void} onBlur
   */
  constructor(elements, onChange, onBlur) {
    this.elements = elements;
    this.onChange = onChange;
    this.onBlur = onBlur;
    this.colorEnabled = false;
    this.bind();
  }

  bind() {
    Object.values(this.elements).forEach((el) => {
      el.addEventListener("input", () => {
        if (el === this.elements.color) this.colorEnabled = true;
        this.onChange(this.getValue());
      });
      el.addEventListener("blur", () => this.onBlur());
    });
    this.elements.fields.addEventListener("input", () => this.autoGrowFields());
    this.autoGrowFields();
  }

  getValue() {
    return {
      title: this.elements.title.value,
      titleColor: this.elements.titleColor.value,
      titleBold: this.elements.titleBold.checked,
      titleItalic: this.elements.titleItalic.checked,
      description: this.elements.description.value,
      tags: this.elements.tags.value,
      color: this.elements.color.value,
      colorEnabled: this.colorEnabled,
      fields: this.elements.fields.value,
      note: this.elements.note.value
    };
  }

  /** @param {{title: string, titleColor?: string|null, titleBold?: boolean, titleItalic?: boolean, description: string, tags: string, color: string|null, fields: string, note: string}} data */
  setValue(data) {
    this.elements.title.value = data.title || "";
    this.elements.titleColor.value = data.titleColor || "#111827";
    this.elements.titleBold.checked = Boolean(data.titleBold);
    this.elements.titleItalic.checked = Boolean(data.titleItalic);
    this.elements.description.value = data.description || "";
    this.elements.tags.value = data.tags || "";
    this.elements.color.value = data.color || "#ffffff";
    this.colorEnabled = Boolean(data.color);
    this.elements.fields.value = data.fields || "";
    this.elements.note.value = data.note || "";
    this.autoGrowFields();
  }

  clearColor() {
    this.colorEnabled = false;
    this.elements.color.value = "#ffffff";
  }

  autoGrowFields() {
    const el = this.elements.fields;
    const style = window.getComputedStyle(el);
    const lineHeight = parseFloat(style.lineHeight) || 16;
    const maxLines = 10;
    el.style.height = "auto";
    const next = Math.min(el.scrollHeight, lineHeight * maxLines + 12);
    el.style.height = `${next}px`;
  }
}
