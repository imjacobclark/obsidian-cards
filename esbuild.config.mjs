import esbuild from "esbuild";
import process from "process";
import builtins from "builtin-modules";
import { copyFileSync, mkdirSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const prod = process.argv[2] === "production";

// Set VAULT=/path/to/vault to copy the built plugin into that vault as real files
// (Obsidian Sync skips symlinks), so it syncs to other devices.
const vault = process.env.VAULT?.replace(/^~(?=$|\/)/, homedir());
const pluginDir = vault && join(vault, ".obsidian", "plugins", "obsidian-cards");

const copyToVault = {
  name: "copy-to-vault",
  setup(build) {
    build.onEnd((result) => {
      if (!pluginDir || result.errors.length) return;
      mkdirSync(pluginDir, { recursive: true });
      for (const file of ["main.js", "manifest.json", "styles.css"]) {
        copyFileSync(file, join(pluginDir, file));
      }
      console.log(`Copied plugin to ${pluginDir}`);
    });
  },
};

const context = await esbuild.context({
  entryPoints: ["src/main.ts"],
  bundle: true,
  external: ["obsidian", "electron", "@codemirror/*", "@lezer/*", ...builtins],
  format: "cjs",
  target: "es2018",
  logLevel: "info",
  sourcemap: prod ? false : "inline",
  treeShaking: true,
  outfile: "main.js",
  minify: prod,
  plugins: [copyToVault],
});

if (prod) {
  await context.rebuild();
  process.exit(0);
} else {
  await context.watch();
}
