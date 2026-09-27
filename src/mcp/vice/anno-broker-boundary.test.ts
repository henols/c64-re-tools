// anno-broker-boundary.test.ts -- the broker never opens an annotation
// database.
//
// A project's annotations are an artifact of that project: its own
// .c64-re-tools/annotations.db, opened in-process by the client. The broker
// owns machine state only -- emulators, host tools, transfers -- so no module
// it runs may load the store. This file checks that structurally: from every
// host-bound module (compiled into resources/ by build.ts), follow every
// value import transitively and require that the closure never reaches
// `anno-store.mts` and never names `node:sqlite`.
//
// This restores, in its new shape, the `node:sqlite` confinement scan Phase 56
// dropped from `anno-seam.test.ts`.
//
// A type-only import (`import type`, `export type`) is erased and loads
// nothing, so it is not followed. An inline `{ type X }` import is followed:
// the stripped form still loads its module.
import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { HOST_BOUND_ARTIFACTS } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** Strips `//` and block comments, leaving string and template literals
 * untouched -- the same single-pass scanner `anno-cli-path-consumers.test.ts`
 * uses, so a module that names `node:sqlite` only in prose is not reported. */
function stripComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Every relative module specifier `src` loads at runtime: static imports and
 * re-exports that are not type-only, side-effect imports, and dynamic
 * `import()` of a string literal. */
function valueImports(src: string): string[] {
  const specs: string[] = [];
  const staticRe = /^\s*(import|export)\s+(type\s+)?[^;]*?\bfrom\s+["']([^"']+)["']/gm;
  for (const m of src.matchAll(staticRe)) {
    if (m[2] === undefined) specs.push(m[3]!);
  }
  for (const m of src.matchAll(/^\s*import\s+["']([^"']+)["']/gm)) specs.push(m[1]!);
  for (const m of src.matchAll(/\bimport\(\s*["']([^"']+)["']\s*\)/g)) specs.push(m[1]!);
  return specs.filter((s) => s.startsWith("./") || s.startsWith("../"));
}

interface BoundaryViolation {
  root: string;
  /** Root first, offending module last. */
  chain: string[];
  reason: string;
}

/**
 * THE ONE PREDICATE. Walks each root's value-import closure inside `dir` and
 * reports every path to a module that is `anno-store.mts` or names
 * `node:sqlite`. The real scan and the planted controls below both call it.
 */
function clientBoundaryViolations(dir: string, roots: readonly string[]): BoundaryViolation[] {
  const violations: BoundaryViolation[] = [];
  const sourceCache = new Map<string, string>();
  const read = (abs: string): string => {
    let s = sourceCache.get(abs);
    if (s === undefined) {
      s = stripComments(readFileSync(abs, "utf8"));
      sourceCache.set(abs, s);
    }
    return s;
  };
  for (const root of roots) {
    const start = resolve(dir, root);
    const parent = new Map<string, string | null>([[start, null]]);
    const queue = [start];
    while (queue.length > 0) {
      const abs = queue.shift()!;
      const chain = (): string[] => {
        const names: string[] = [];
        for (let at: string | null = abs; at !== null; at = parent.get(at) ?? null) names.unshift(at.slice(dir.length + 1));
        return names;
      };
      const src = read(abs);
      if (abs.endsWith("/anno-store.mts")) {
        violations.push({ root, chain: chain(), reason: "loads anno-store.mts" });
        continue;
      }
      if (/["']node:sqlite["']/.test(src)) {
        violations.push({ root, chain: chain(), reason: "names node:sqlite" });
        continue;
      }
      for (const spec of valueImports(src)) {
        let next = resolve(dirname(abs), spec);
        // Host-bound sources import each other as the `.mjs` build emits.
        if (!existsSync(next) && next.endsWith(".mjs")) next = next.replace(/\.mjs$/, ".mts");
        if (parent.has(next) || !existsSync(next)) continue;
        parent.set(next, abs);
        queue.push(next);
      }
    }
  }
  return violations;
}

/** The host-bound sources: each compiled artifact's `.mts`. */
const HOST_BOUND_SOURCES = new Set(HOST_BOUND_ARTIFACTS.map((artifact) => artifact.replace(/\.mjs$/, ".mts")));

/** Every module the broker runs: the host-bound set. */
function brokerRoots(): string[] {
  return [...HOST_BOUND_SOURCES];
}

test("PRECONDITION: the broker roots include the broker and its endpoint, and exclude the store", () => {
  const roots = brokerRoots();
  for (const expected of ["vice-broker.mts", "broker-control.mts", "broker-endpoint.mts", "host-tool.mts"]) {
    assert.ok(roots.includes(expected), `${expected} must be scanned as a broker root; roots: ${roots.join(", ")}`);
  }
  assert.ok(!roots.includes("anno-store.mts"), "the store must not be host-bound");
});

test("the walk follows the broker's own .mjs-spelled imports into their .mts sources (non-vacuity)", () => {
  const reached = new Set<string>();
  // vice-broker.mts imports broker-home under its emitted .mjs name.
  const violations = clientBoundaryViolations(HERE, ["vice-broker.mts"]);
  assert.deepEqual(violations, []);
  const src = readFileSync(join(HERE, "vice-broker.mts"), "utf8");
  for (const spec of valueImports(stripComments(src))) if (spec.endsWith(".mjs")) reached.add(spec);
  assert.ok(reached.size >= 5, `precondition: vice-broker.mts imports at least five host-bound modules by .mjs name; found ${[...reached].join(", ")}`);
});

test("no host-bound module value-imports anno-store.mts or names node:sqlite, directly or transitively", () => {
  const violations = clientBoundaryViolations(HERE, brokerRoots());
  assert.deepEqual(
    violations.map((v) => `${v.chain.join(" -> ")} (${v.reason})`),
    [],
    "a broker module reaches the annotation store; a project's annotations are opened by the client, never the broker",
  );
});

test("planted violations: a transitive import, a re-export and a dynamic import of the store are each reported; type-only imports are not", () => {
  const dir = mkdtempSync(join(tmpdir(), "anno-broker-boundary-"));
  try {
    const write = (name: string, body: string) => writeFileSync(join(dir, name), body);
    write("anno-store.mts", 'import { DatabaseSync } from "node:sqlite";\nexport const db = DatabaseSync;\n');
    write("raw-sqlite.mts", 'export async function open() { return import("node:sqlite"); }\n');
    write("middle.mts", 'import { db } from "./anno-store.mts";\nexport const x = db;\n');
    write("transitive.ts", 'import { x } from "./middle.mts";\nexport const y = x;\n');
    write("reexport.ts", 'export { db } from "./anno-store.mts";\n');
    write("dynamic.ts", 'export async function load() { return import("./anno-store.mts"); }\n');
    write("direct-sqlite.ts", 'import { open } from "./raw-sqlite.mts";\nexport const o = open;\n');
    write("inline-type.ts", 'import { type db } from "./anno-store.mts";\nexport type T = typeof db;\n');
    write("type-only.ts", 'import type { db } from "./anno-store.mts";\nexport type { db as D } from "./anno-store.mts";\nexport type T = typeof db;\n');
    write("prose-only.ts", '// the worker opens "node:sqlite" through ./anno-store.mts\nexport const z = 1;\n');

    const reported = (root: string) => clientBoundaryViolations(dir, [root]);
    assert.deepEqual(reported("transitive.ts")[0]?.chain, ["transitive.ts", "middle.mts", "anno-store.mts"], "the chain names every hop");
    assert.equal(reported("reexport.ts").length, 1, "a re-export loads the module");
    assert.equal(reported("dynamic.ts").length, 1, "a dynamic import loads the module");
    assert.equal(reported("direct-sqlite.ts")[0]?.reason, "names node:sqlite", "a module naming node:sqlite is reported even without the store");
    assert.equal(reported("inline-type.ts").length, 1, "an inline { type X } import still loads its module once stripped");
    assert.deepEqual(reported("type-only.ts"), [], "a type-only import is erased and loads nothing");
    assert.deepEqual(reported("prose-only.ts"), [], "a mention in a comment is not an import");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
