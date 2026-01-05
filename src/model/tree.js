// @ts-check

/** @typedef {Object} TreeNode
 *  @property {string} id
 *  @property {string} title
 *  @property {string} description
 *  @property {Object<string, any>|Array<any>|null} fields
 *  @property {string[]} tags
 *  @property {{color?: string, titleColor?: string, titleFont?: string, titleBold?: boolean, titleItalic?: boolean}|null} style
 *  @property {string} note
 *  @property {"map"|"seq"|"scalar"|undefined} kind
 *  @property {any} value
 *  @property {boolean} collapsed
 *  @property {TreeNode[]} children
 */

export function createId() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

/** @param {any} node */
export function normalizeNode(node) {
  /** @type {TreeNode} */
  const out = {
    id: node.id || createId(),
    title: typeof node.title === "string" && node.title.trim() ? node.title : "Untitled",
    description: typeof node.description === "string" ? node.description : "",
    fields: normalizeFields(node.fields),
    tags: normalizeTags(node.tags),
    style: normalizeStyle(node.style),
    note: typeof node.note === "string" ? node.note : "",
    kind: node.kind || undefined,
    value: node.value,
    collapsed: Boolean(node.collapsed),
    children: Array.isArray(node.children) ? node.children.map(normalizeNode) : []
  };
  return out;
}

function normalizeFields(fields) {
  if (fields === undefined || fields === null) return null;
  if (Array.isArray(fields)) return fields;
  if (typeof fields === "object") return fields;
  return null;
}

function normalizeTags(tags) {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags.map((tag) => String(tag).trim()).filter(Boolean);
  }
  if (typeof tags === "string") {
    return tags.split(",").map((tag) => tag.trim()).filter(Boolean);
  }
  return [];
}

function normalizeStyle(style) {
  if (!style || typeof style !== "object") return null;
  const out = {};
  if (typeof style.color === "string" && style.color.trim()) {
    out.color = style.color.trim();
  }
  if (typeof style.titleColor === "string" && style.titleColor.trim()) {
    out.titleColor = style.titleColor.trim();
  }
  if (typeof style.titleFont === "string" && style.titleFont.trim()) {
    out.titleFont = style.titleFont.trim();
  }
  if (typeof style.titleBold === "boolean") {
    out.titleBold = style.titleBold;
  }
  if (typeof style.titleItalic === "boolean") {
    out.titleItalic = style.titleItalic;
  }
  return Object.keys(out).length ? out : null;
}

/** @param {string} yamlText */
export function parseYamlToTree(yamlText) {
  const doc = window.jsyaml.load(yamlText);
  if (doc && typeof doc === "object" && doc.root && typeof doc.root === "object") {
    const root = doc.root;
    if (typeof root.title === "string" && Array.isArray(root.children)) {
      return normalizeNode(root);
    }
  }
  const rootNode = buildYamlNode(doc, "document", true);
  return normalizeNode(rootNode);
}

/** @param {TreeNode} node */
export function stripNode(node) {
  /** @type {any} */
  const out = { title: node.title };
  if (node.description && node.description.trim()) out.description = node.description;
  if (node.fields) out.fields = node.fields;
  if (node.tags && node.tags.length) out.tags = node.tags;
  if (node.note && node.note.trim()) out.note = node.note;
  if (node.children && node.children.length) out.children = node.children.map(stripNode);
  return out;
}

/** @param {TreeNode} root */
export function treeToYaml(root) {
  if (root && root.kind) {
    const value = buildYamlValue(root);
    return window.jsyaml.dump(value, { noRefs: true, lineWidth: -1, sortKeys: false });
  }
  const obj = { root: stripNode(root) };
  return window.jsyaml.dump(obj, { noRefs: true, lineWidth: -1, sortKeys: false });
}

/** @param {any} value @param {string} title @param {boolean} isRoot */
function buildYamlNode(value, title, isRoot = false) {
  if (Array.isArray(value)) {
    const node = {
      title: title || "list",
      kind: "seq",
      children: value.map((item, idx) => buildYamlNode(item, `[${idx}]`))
    };
    return node;
  }
  if (value && typeof value === "object") {
    const node = {
      title: title || "map",
      kind: "map",
      children: Object.entries(value).map(([key, val]) => buildYamlNode(val, key))
    };
    return node;
  }
  const scalarTitle = title || (isRoot ? "value" : "value");
  return {
    title: scalarTitle,
    kind: "scalar",
    value: value,
    fields: { value: value }
  };
}

/** @param {TreeNode} node */
function buildYamlValue(node) {
  if (node.kind === "map") {
    const out = {};
    node.children.forEach((child) => {
      const key = child.title || "key";
      out[key] = buildYamlValue(child);
    });
    return out;
  }
  if (node.kind === "seq") {
    return node.children.map((child) => buildYamlValue(child));
  }
  if (node.kind === "scalar") {
    return node.value;
  }
  return stripNode(node);
}

/** @param {TreeNode} node @param {string} id */
export function findById(node, id) {
  if (!node) return null;
  if (node.id === id) return node;
  for (const c of node.children || []) {
    const x = findById(c, id);
    if (x) return x;
  }
  return null;
}

/** @param {TreeNode} node @param {string} childId @param {TreeNode|null} parent */
export function findParent(node, childId, parent = null) {
  if (!node) return null;
  if (node.id === childId) return parent;
  for (const c of node.children || []) {
    const x = findParent(c, childId, node);
    if (x) return x;
  }
  return null;
}

/** @param {TreeNode} parent @param {string} childId */
export function removeChild(parent, childId) {
  if (!parent || !parent.children) return null;
  const idx = parent.children.findIndex((c) => c.id === childId);
  if (idx >= 0) return parent.children.splice(idx, 1)[0];
  return null;
}

/** @param {TreeNode} parent @param {TreeNode} child @param {number} idx */
export function insertChildAt(parent, child, idx) {
  parent.children = parent.children || [];
  const pos = Math.max(0, Math.min(idx, parent.children.length));
  parent.children.splice(pos, 0, child);
}

/** @param {TreeNode} root @param {string} ancestorId @param {string} nodeId */
export function isAncestor(root, ancestorId, nodeId) {
  const node = findById(root, nodeId);
  if (!node) return false;
  function dfs(n) {
    if (n.id === ancestorId) return true;
    for (const c of n.children || []) if (dfs(c)) return true;
    return false;
  }
  return dfs(node);
}

/** @param {TreeNode} root @param {string} nodeId @param {string} maybeDescId */
export function isInSubtree(root, nodeId, maybeDescId) {
  const node = findById(root, nodeId);
  if (!node) return false;
  function dfs(n) {
    if (n.id === maybeDescId) return true;
    for (const c of n.children || []) if (dfs(c)) return true;
    return false;
  }
  return dfs(node);
}

/** @param {TreeNode} root @param {string} nodeId */
export function collectSubtreeIds(root, nodeId) {
  const node = findById(root, nodeId);
  if (!node) return [];
  /** @type {string[]} */
  const ids = [];
  (function walk(n) {
    ids.push(n.id);
    n.children.forEach(walk);
  })(node);
  return ids;
}

/** @param {TreeNode} root @param {(node: TreeNode, path: string) => void} cb */
export function walkWithPath(root, cb) {
  function walk(node, path) {
    cb(node, path);
    node.children.forEach((c, idx) => walk(c, path + "/" + idx));
  }
  walk(root, "root");
}

/** @param {TreeNode} root @param {Map<string, {x:number,y:number}>} posById */
export function positionsToPath(root, posById) {
  /** @type {Record<string, {x:number,y:number}>} */
  const out = {};
  walkWithPath(root, (node, path) => {
    const pos = posById.get(node.id);
    if (pos) out[path] = { x: pos.x, y: pos.y };
  });
  return out;
}

/** @param {TreeNode} root */
export function stylesToPath(root) {
  /** @type {Record<string, any>} */
  const out = {};
  walkWithPath(root, (node, path) => {
    if (node.style && Object.keys(node.style).length) out[path] = node.style;
  });
  return out;
}

/** @param {TreeNode} root @param {Record<string, {x:number,y:number}>} posByPath @param {Map<string, {x:number,y:number}>} posById */
export function applyPositionsFromPath(root, posByPath, posById) {
  walkWithPath(root, (node, path) => {
    const pos = posByPath[path];
    if (pos) posById.set(node.id, { x: pos.x, y: pos.y });
  });
}

/** @param {TreeNode} root @param {Record<string, any>} stylesByPath */
export function applyStylesFromPath(root, stylesByPath) {
  if (!stylesByPath) return;
  walkWithPath(root, (node, path) => {
    const style = stylesByPath[path];
    if (style) node.style = normalizeStyle(style);
  });
}
