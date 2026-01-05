// @ts-check

import { formatFieldValue, getFieldEntries } from "../services/fieldService.js";

/** @param {import("../model/tree.js").TreeNode} node */
export function buildNodeCard(node) {
  const card = document.createElement("div");
  card.className = "node-card";

  const titleLine = document.createElement("div");
  titleLine.className = "node-title";
  titleLine.textContent = node.title;
  card.appendChild(titleLine);

  if (node.note && node.note.trim()) {
    const noteBadge = document.createElement("span");
    noteBadge.className = "note-badge";
    noteBadge.textContent = "note";
    titleLine.appendChild(document.createTextNode(" "));
    titleLine.appendChild(noteBadge);
  }

  if (node.description && node.description.trim()) {
    const desc = document.createElement("div");
    desc.className = "node-desc";
    desc.textContent = node.description;
    card.appendChild(desc);
  }

  const fields = getFieldEntries(node.fields);
  if (fields.length) {
    const list = document.createElement("div");
    list.className = "node-fields";
    fields.forEach(({ label, value }) => {
      const item = document.createElement("div");
      item.className = "node-field";
      item.textContent = formatFieldValue(label, value);
      list.appendChild(item);
    });
    card.appendChild(list);
  }

  return card;
}
