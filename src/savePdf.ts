import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { desktop } from "./storage";
import { t } from "./i18n";

export function pdfFileName(name: string) {
  const safe = name.replace(/[\\/:*?"<>|]+/g, " ").trim() || "Stammbaum";
  return `UriNamu-${safe}.pdf`;
}

function encodePath(path: string) {
  const bytes = new TextEncoder().encode(path);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export async function savePdfFile(name: string, bytes: Uint8Array) {
  if (!desktop) {
    const blob = new Blob([new Uint8Array(bytes)], { type: "application/pdf" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return true;
  }
  const path = await save({
    defaultPath: name,
    filters: [{ name: t("pdfFilter"), extensions: ["pdf"] }],
  });
  if (!path) return false;
  await invoke("save_pdf", bytes, { headers: { "x-path": encodePath(path) } });
  return true;
}
