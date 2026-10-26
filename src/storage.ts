import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { type Family, normalize, validate } from "./domain";
import { t } from "./i18n";
import { cropRegion, cropSample } from "./photo";
export const desktop = isTauri();
export interface Revision {
  id: number;
  created: string;
  label: string;
}
export interface TreeInfo {
  id: string;
  name: string;
  members: number;
  current: boolean;
}
const database = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("urinamu-preview", 2);
    request.onupgradeneeded = () => {
      const db = request.result,
        tx = request.transaction!;
      if (!db.objectStoreNames.contains("state")) db.createObjectStore("state");
      if (!db.objectStoreNames.contains("history"))
        db.createObjectStore("history", { keyPath: "id", autoIncrement: true });
      if (!db.objectStoreNames.contains("trees")) {
        const trees = db.createObjectStore("trees", { keyPath: "id" }),
          state = tx.objectStore("state"),
          old = state.get("family");
        old.onsuccess = () => {
          if (old.result) {
            trees.put({ id: "legacy", family: old.result });
            state.put("legacy", "activeTree");
            const histories = tx.objectStore("history").getAll();
            histories.onsuccess = () =>
              histories.result.forEach((row) =>
                tx.objectStore("history").put({ ...row, treeId: "legacy" }),
              );
          }
        };
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
const requestValue = <T>(r: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
export async function loadFamily(): Promise<Family | null> {
  if (desktop) {
    const f = await invoke<Family | null>("load_family");
    return f ? normalize(f) : null;
  }
  const db = await database();
  try {
    const f = await requestValue(
      db.transaction("state").objectStore("state").get("family"),
    );
    return f ? normalize(f) : null;
  } finally {
    db.close();
  }
}
async function writeWeb(
  family: Family,
  label: string,
  newTree: boolean,
): Promise<string> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "history", "trees"], "readwrite"),
      state = tx.objectStore("state");
    let id = "";
    const active = state.get("activeTree");
    active.onsuccess = () => {
      id = newTree || !active.result ? crypto.randomUUID() : active.result;
      state.put(id, "activeTree");
      state.put(family, "family");
      tx.objectStore("trees").put({ id, family });
      const history = tx.objectStore("history");
      history.add({
        treeId: id,
        family,
        label,
        created: new Date().toISOString(),
      });
      const all = history.getAll();
      all.onsuccess = () => {
        const rows = all.result.filter((row) => row.treeId === id);
        rows
          .slice(0, Math.max(0, rows.length - 100))
          .forEach((row) => history.delete(row.id));
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve(id);
    };
    tx.onerror = () => {
      db.close();
      reject(Error("Speichern fehlgeschlagen: " + tx.error));
    };
    tx.onabort = () => {
      db.close();
      reject(Error("Speichern abgebrochen."));
    };
  });
}
export async function saveFamily(family: Family, label: string) {
  validate(family);
  if (desktop) return invoke<void>("save_family", { family, label });
  await writeWeb(family, label, false);
}
export async function createTree(
  family: Family,
  label: string,
): Promise<string> {
  validate(family);
  return desktop
    ? invoke("create_tree", { family, label })
    : writeWeb(family, label, true);
}
export async function listTrees(): Promise<TreeInfo[]> {
  if (desktop) return invoke("list_trees");
  const db = await database();
  try {
    const tx = db.transaction(["state", "trees"]);
    const [trees, active] = await Promise.all([
      requestValue(tx.objectStore("trees").getAll()),
      requestValue(tx.objectStore("state").get("activeTree")),
    ]);
    return trees
      .map((t) => ({
        id: t.id,
        name: t.family.name,
        members: t.family.members.length,
        current: t.id === active,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  } finally {
    db.close();
  }
}
export async function readTree(id: string): Promise<Family> {
  if (desktop) return normalize(await invoke("read_tree", { id }));
  const db = await database();
  try {
    const row = await requestValue(
      db.transaction("trees").objectStore("trees").get(id),
    );
    if (!row) throw Error(t("errTreeMissing"));
    return normalize(row.family);
  } finally {
    db.close();
  }
}
export async function deleteTree(
  id: string,
): Promise<{ family: Family | null; changed: boolean }> {
  if (desktop) {
    const result = await invoke<{ family: Family | null; changed: boolean }>(
      "delete_tree",
      { id },
    );
    return {
      changed: result.changed,
      family: result.family ? normalize(result.family) : null,
    };
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "history", "trees"], "readwrite");
    const state = tx.objectStore("state");
    const trees = tx.objectStore("trees");
    const history = tx.objectStore("history");
    let changed = false;
    let family: Family | null = null;
    const active = state.get("activeTree");
    active.onsuccess = () => {
      changed = active.result === id;
      trees.delete(id);
      const rows = history.getAll();
      rows.onsuccess = () => {
        for (const row of rows.result)
          if (row.treeId === id) history.delete(row.id);
        if (!changed) return;
        const rest = trees.getAll();
        rest.onsuccess = () => {
          try {
            const next = [...rest.result].sort((a, b) =>
              a.family.name.localeCompare(b.family.name, "de"),
            )[0];
            if (next) {
              family = normalize(next.family);
              state.put(next.id, "activeTree");
              state.put(family, "family");
            } else {
              state.delete("activeTree");
              state.delete("family");
            }
          } catch {
            tx.abort();
          }
        };
      };
    };
    tx.oncomplete = () => {
      db.close();
      resolve({ family, changed });
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(Error(t("errDeleteTree")));
    };
  });
}
export async function renameTree(id: string, name: string): Promise<void> {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 100) throw Error(t("errName"));
  if (desktop) {
    await invoke("rename_tree", { id, name: trimmed });
    return;
  }
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "trees"], "readwrite");
    const trees = tx.objectStore("trees");
    const row = trees.get(id);
    row.onsuccess = () => {
      try {
        if (!row.result) throw Error(t("errTreeMissing"));
        const family = normalize({ ...row.result.family, name: trimmed });
        trees.put({ id, family });
        const active = tx.objectStore("state").get("activeTree");
        active.onsuccess = () => {
          if (active.result !== id) return;
          const current = tx.objectStore("state").get("family");
          current.onsuccess = () => {
            if (!current.result) return;
            tx.objectStore("state").put(
              normalize({ ...current.result, name: trimmed }),
              "family",
            );
          };
        };
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(Error(t("errRenameTree")));
    };
  });
}
export async function switchTree(id: string): Promise<Family> {
  if (desktop) return normalize(await invoke("switch_tree", { id }));
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(["state", "trees"], "readwrite");
    let family: Family;
    const tree = tx.objectStore("trees").get(id);
    tree.onsuccess = () => {
      try {
        if (!tree.result) throw Error(t("errTreeMissing"));
        family = normalize(tree.result.family);
        tx.objectStore("state").put(id, "activeTree");
        tx.objectStore("state").put(family, "family");
      } catch {
        tx.abort();
      }
    };
    tx.oncomplete = () => {
      db.close();
      resolve(family);
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(Error(t("errOpenTree")));
    };
  });
}
export async function revisions(): Promise<Revision[]> {
  if (desktop) return invoke("list_revisions");
  const db = await database();
  try {
    const tx = db.transaction(["state", "history"]);
    const [rows, active] = await Promise.all([
      requestValue(tx.objectStore("history").getAll()),
      requestValue(tx.objectStore("state").get("activeTree")),
    ]);
    return rows
      .filter((r) => r.treeId === active)
      .reverse()
      .slice(0, 100)
      .map(({ family: _, treeId: __, ...r }) => r);
  } finally {
    db.close();
  }
}
export async function revision(id: number): Promise<Family> {
  if (desktop) return normalize(await invoke("read_revision", { id }));
  const db = await database();
  try {
    const tx = db.transaction(["state", "history"]);
    const [row, active] = await Promise.all([
      requestValue(tx.objectStore("history").get(id)),
      requestValue(tx.objectStore("state").get("activeTree")),
    ]);
    if (!row || row.treeId !== active)
      throw Error(t("errRevisionTree"));
    return normalize(row.family);
  } finally {
    db.close();
  }
}
export async function exportFamily(family: Family, password: string) {
  if (!desktop) throw Error(t("errExportDesktop"));
  const path = await save({
    defaultPath: `UriNamu-${new Date().toISOString().slice(0, 10)}.urinamu`,
    filters: [{ name: t("fileFilter"), extensions: ["urinamu"] }],
  });
  if (path) await invoke("export_family", { path, password, family });
  return Boolean(path);
}
export async function importFamily(password: string): Promise<Family | null> {
  if (!desktop) throw Error(t("errImportDesktop"));
  const path = await open({
    multiple: false,
    filters: [{ name: t("fileFilter"), extensions: ["urinamu", "wurzeln"] }],
  });
  return path
    ? normalize(await invoke("import_family", { path, password }))
    : null;
}
export const imageByteLimit = 50 * 1024 * 1024;
export async function fitLogo(file: File): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(
      file.type,
    ) ||
    file.size > imageByteLimit
  )
    throw Error(t("errPhotoType"));
  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, 512 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(bitmap, 0, 0, width, height);
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
export async function resizePhoto(
  file: File,
  selection = { zoom: 1, x: 0.5, y: 0.5 },
): Promise<string> {
  if (
    !["image/png", "image/jpeg", "image/webp", "image/avif"].includes(
      file.type,
    ) ||
    file.size > imageByteLimit
  )
    throw Error(t("errPhotoType"));
  const bitmap = await createImageBitmap(file);
  try {
    const crop = cropRegion(
      bitmap.width,
      bitmap.height,
      selection.zoom,
      selection.x,
      selection.y,
    );
    const scale = Math.min(1, 1024 / Math.max(crop.width, crop.height));
    const outputWidth = Math.max(1, Math.round(crop.width * scale));
    const outputHeight = Math.max(1, Math.round(crop.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const context = canvas.getContext("2d")!;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    const sample = cropSample(
      bitmap.width,
      bitmap.height,
      crop,
      outputWidth,
      outputHeight,
    );
    if (sample)
      context.drawImage(
        bitmap,
        sample.sx,
        sample.sy,
        sample.sw,
        sample.sh,
        sample.dx,
        sample.dy,
        sample.dw,
        sample.dh,
      );
    return canvas.toDataURL("image/png");
  } finally {
    bitmap.close();
  }
}
