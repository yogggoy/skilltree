// @ts-check

/** @param {any} fields */
export function getFieldEntries(fields) {
  if (!fields) return [];
  if (Array.isArray(fields)) {
    return fields.map((f) => {
      if (typeof f === "string") return { label: f, value: "" };
      if (f && typeof f === "object") {
        if ("label" in f || "value" in f) {
          return { label: String(f.label || ""), value: f.value };
        }
        const keys = Object.keys(f);
        if (keys.length === 1) return { label: keys[0], value: f[keys[0]] };
        return { label: JSON.stringify(f), value: "" };
      }
      return { label: String(f), value: "" };
    }).filter(e => e.label);
  }
  if (typeof fields === "object") {
    return Object.entries(fields).map(([k, v]) => ({ label: k, value: v }));
  }
  return [];
}

/** @param {string} label @param {any} value */
export function formatFieldValue(label, value) {
  if (value === undefined || value === null || value === "") return label;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return `${label}: ${text}`;
}
