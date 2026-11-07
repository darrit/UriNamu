import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const notice = readFileSync(new URL("../../../NOTICE", import.meta.url), "utf8").trim();

export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  base: "./",
  plugins: [react()],
  build: {
    outDir: "../demo",
    emptyOutDir: true,
    target: "es2022",
    license: { fileName: "licenses.md" },
    rolldownOptions: {
      output: {
        postBanner: `/*! ${notice}\nhttps://polyformproject.org/licenses/noncommercial/1.0.0\nThird-party licenses: ../licenses.md */`,
      },
    },
  },
});
