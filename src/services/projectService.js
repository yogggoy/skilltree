// @ts-check

const PROJECT_ACCEPT = [{ description: "Skill Tree Project", accept: { "application/json": [".stree.json", ".json"] } }];

async function pickOpenFile() {
  if (window.showOpenFilePicker) {
    const [handle] = await window.showOpenFilePicker({ types: PROJECT_ACCEPT, multiple: false });
    return handle;
  }
  return null;
}

async function pickSaveFile() {
  if (window.showSaveFilePicker) {
    return await window.showSaveFilePicker({ types: PROJECT_ACCEPT, suggestedName: "tree.stree.json" });
  }
  return null;
}

async function readHandleText(handle) {
  const file = await handle.getFile();
  return await file.text();
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

async function openFileFallback() {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json,.stree.json,application/json";
    input.addEventListener("change", async () => {
      const file = input.files && input.files[0];
      if (!file) return resolve(null);
      const text = await file.text();
      resolve({ text, filename: file.name });
    });
    input.click();
  });
}

export class ProjectService {
  constructor() {
    this.lastHandle = null;
  }

  async openProject() {
    if (window.showOpenFilePicker) {
      const handle = await pickOpenFile();
      if (!handle) return null;
      const text = await readHandleText(handle);
      this.lastHandle = handle;
      return { text, handle };
    }
    const fallback = await openFileFallback();
    if (!fallback) return null;
    return { text: fallback.text, handle: null };
  }

  /** @param {string} text */
  async saveProject(text) {
    if (this.lastHandle && window.showOpenFilePicker) {
      const writable = await this.lastHandle.createWritable();
      await writable.write(text);
      await writable.close();
      return;
    }
    if (window.showSaveFilePicker) {
      const handle = await pickSaveFile();
      if (!handle) return;
      const writable = await handle.createWritable();
      await writable.write(text);
      await writable.close();
      this.lastHandle = handle;
      return;
    }
    downloadText("tree.stree.json", text);
  }
}
