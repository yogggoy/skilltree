// @ts-check

import { EditorState } from "@codemirror/state";
import { EditorView, lineNumbers, keymap } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { defaultHighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { yaml } from "@codemirror/lang-yaml";

export class YamlEditor {
  /**
   * @param {HTMLElement} container
   * @param {HTMLTextAreaElement} fallback
   */
  constructor(container, fallback) {
    this.container = container;
    this.fallback = fallback;
    this.view = null;

    const baseTheme = EditorView.theme({
      "&": {
        height: "100%",
        backgroundColor: "transparent",
        color: "var(--text)"
      },
      ".cm-scroller": {
        fontFamily: "IBM Plex Mono, Consolas, Liberation Mono, Menlo, monospace",
        fontSize: "12px",
        lineHeight: "1.35"
      },
      ".cm-content": {
        padding: "10px"
      },
      ".cm-gutters": {
        backgroundColor: "transparent",
        color: "var(--muted)",
        border: "none"
      },
      ".cm-activeLine": { backgroundColor: "#e8f0fb55" }
    });

    this.view = new EditorView({
      state: EditorState.create({
        doc: this.fallback.value || "",
        extensions: [
          yaml(),
          syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
          lineNumbers(),
          keymap.of([indentWithTab]),
          baseTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((v) => {
            if (v.docChanged) this.syncToFallback();
          })
        ]
      }),
      parent: this.container
    });
  }

  getValue() {
    if (this.view) return this.view.state.doc.toString();
    return this.fallback.value || "";
  }

  setValue(text) {
    if (this.view) {
      const current = this.view.state.doc.toString();
      if (current !== text) {
        this.view.dispatch({
          changes: { from: 0, to: current.length, insert: text }
        });
      }
    }
    this.fallback.value = text;
  }

  focus() {
    if (this.view) this.view.focus();
  }

  syncToFallback() {
    this.fallback.value = this.view.state.doc.toString();
  }
}
