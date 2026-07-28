/* Shared helper for the check scripts: loads the app's classic (non-module)
   scripts into a Node vm sandbox with a minimal `window` shim, so ENGINE and
   DATA layers can be exercised headlessly with zero dependencies.
   Only DOM-free files may be loaded this way (the ENGINE no-DOM rule is what
   makes these checks possible at all). */
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

export function loadSandbox(files) {
  // Host globals the app uses that a bare vm context lacks
  const sandbox = { console, Blob, atob: globalThis.atob };
  sandbox.window = sandbox;         // classic scripts see `window` = global
  sandbox.globalThis = sandbox;
  createContext(sandbox);
  for (const f of files) {
    try {
      runInContext(readFileSync(f, "utf8"), sandbox, { filename: f });
    } catch (err) {
      throw new Error(`failed loading ${f}: ${err.message}`);
    }
  }
  return sandbox;
}

/* The DOM-free load order (dependency order, same as index.html). */
export const ENGINE_FILES = [
  "js/content.js",
  "js/engine/dsp.js",
  "js/library.js",
  "js/state.js",
  "js/demos.js",
];
