import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { type Plugin } from "vite";
import { defineConfig } from "vitest/config";
import preact from "@preact/preset-vite";

/** Emits sw.js with a precache list of all build output and a content-hash version. */
function serviceWorker(): Plugin {
  return {
    name: "hourglass-sw",
    apply: "build",
    enforce: "post",
    generateBundle(_, bundle) {
      const hash = createHash("sha256");
      const files: string[] = [];
      for (const [name, item] of Object.entries(bundle)) {
        files.push(name);
        hash
          .update(name)
          .update(item.type === "chunk" ? item.code : item.source);
      }
      for (const name of readdirSync("public")) {
        files.push(name);
        hash.update(name).update(readFileSync(`public/${name}`));
      }
      const template = readFileSync("src/sw.js", "utf8");
      hash.update(template);
      const source = template
        .replace("__VERSION__", hash.digest("hex").slice(0, 12))
        .replace(
          "__PRECACHE__",
          JSON.stringify(["./", ...files.sort().map((f) => `./${f}`)]),
        );
      this.emitFile({ type: "asset", fileName: "sw.js", source });
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [preact(), serviceWorker()],
  test: { environment: "node" },
});
