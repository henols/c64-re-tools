// anno-tools.test.ts -- the phase's tracer proof: one curated `anno_*` verb
// answers a real query against a real store, through the same never-throw
// boundary `vice-proxy.ts` registers, and the module holds nothing open
// afterwards.
//
// Every temp directory is `mkdtempSync(join(tmpdir(), "anno-"))` inside a
// `try` with an unconditional `finally rmSync(..., { recursive: true, force:
// true })` -- `anno-store.test.ts:5-9`'s pairing, copied for the same reason:
// `/tmp` on the development host is a tmpfs with periodic cleanup disabled, so
// a leaked directory is leaked RAM until the next reboot.
//
// THE WORKSPACE ROOT IS MOVED, NOT MOCKED. `runAnnoTool()` resolves the store
// path against `repoRoot()` at DISPATCH time, and `repoRoot()`'s branch 0 reads
// `CLAUDE_PROJECT_DIR` from `process.env` on every call -- so pointing that
// variable at a temp directory exercises the REAL confinement code against a
// REAL temporary workspace, rather than stubbing the seam the threat model
// (T-29-01) depends on.
//
// NOTHING here asserts that stderr is empty, and nothing may. `node:sqlite`
// emits an `ExperimentalWarning` unconditionally on first load.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, openStore, setLabel } from "./anno-store.ts";
import {
  ANNO_TOOL_DEFINITIONS,
  AnnoToolArgumentError,
  AnnoUncuratedToolError,
  CURATED_ANNO_TOOLS,
  assertAnnoTool,
  runAnnoTool,
} from "./anno-tools.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANNO_TOOLS_SOURCE = readFileSync(join(HERE, "anno-tools.ts"), "utf8");

/** Runs `body` with `CLAUDE_PROJECT_DIR` pointed at a fresh temp workspace
 * holding a store seeded by `seed`, restoring the variable and removing the
 * directory unconditionally. */
async function withStore(
  seed: (handle: ReturnType<typeof openStore>) => void,
  body: (ws: string, storePath: string) => Promise<void>,
): Promise<void> {
  const ws = mkdtempSync(join(tmpdir(), "anno-"));
  const previous = process.env.CLAUDE_PROJECT_DIR;
  try {
    const storePath = join(ws, "project.annostore");
    const handle = openStore(storePath, { workspaceRoot: ws });
    try {
      seed(handle);
    } finally {
      closeStore(handle);
    }
    process.env.CLAUDE_PROJECT_DIR = ws;
    await body(ws, storePath);
  } finally {
    if (previous === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previous;
    rmSync(ws, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// The tracer itself: the store answers an agent through the MCP surface.
// ---------------------------------------------------------------------------

test("tracer (MCP-05): anno_get_symbols answers a real query against a real store, end to end", async () => {
  await withStore(
    (handle) => {
      setLabel(handle, { address: 0xc000, name: "irq_handler", kind: "User" });
    },
    async (_ws, storePath) => {
      const result = await runAnnoTool("anno_get_symbols", { store: storePath, max_results: 50 });
      assert.equal(result.isError, false, `expected a successful result, got: ${result.content[0]?.text}`);
      const body = JSON.parse(result.content[0]!.text) as {
        symbols: { address: number; name: string; kind: string }[];
        returned: number;
        matched: number;
        truncated: boolean;
      };
      assert.equal(body.symbols.length, 1);
      assert.equal(body.symbols[0]!.name, "irq_handler");
      assert.equal(body.symbols[0]!.address, 0xc000);
      assert.equal(body.symbols[0]!.kind, "User");
      assert.equal(body.returned, 1);
      assert.equal(body.matched, 1);
      assert.equal(body.truncated, false);
    },
  );
});

test("anno_get_symbols narrows by address range, and reports truncation as a fact rather than leaving it to be inferred", async () => {
  await withStore(
    (handle) => {
      setLabel(handle, { address: 0x0400, name: "screen_ram", kind: "Auto" });
      setLabel(handle, { address: 0xc000, name: "irq_handler", kind: "User" });
      setLabel(handle, { address: 0xc100, name: "main_loop", kind: "User" });
    },
    async (_ws, storePath) => {
      const ranged = await runAnnoTool("anno_get_symbols", {
        store: storePath,
        max_results: 50,
        start_address: "$c000",
        end_address: 0xcfff,
      });
      assert.equal(ranged.isError, false);
      const rangedBody = JSON.parse(ranged.content[0]!.text) as { symbols: { name: string }[]; matched: number };
      assert.deepEqual(
        rangedBody.symbols.map((s) => s.name),
        ["irq_handler", "main_loop"],
      );
      assert.equal(rangedBody.matched, 2);

      const capped = await runAnnoTool("anno_get_symbols", { store: storePath, max_results: 1 });
      assert.equal(capped.isError, false);
      const cappedBody = JSON.parse(capped.content[0]!.text) as { returned: number; matched: number; truncated: boolean };
      assert.equal(cappedBody.returned, 1);
      assert.equal(cappedBody.matched, 3);
      assert.equal(cappedBody.truncated, true, "a capped answer must SAY it was capped -- 'returned == max_results' is not the same fact");
    },
  );
});

// ---------------------------------------------------------------------------
// The never-throw boundary, including WR-02's closure.
// ---------------------------------------------------------------------------

test("WR-02 closed: an uncurated name RESOLVES {isError:true} naming both resolution routes -- it does not reject the promise", async () => {
  const result = await runAnnoTool("anno_delete_everything", { store: "irrelevant.annostore", max_results: 1 });
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /\[AnnoUncuratedToolError\]/, "the failure must name the error CLASS, never collapse to a bare string");
  assert.match(result.content[0]!.text, /add it to ANNO_TOOL_DEFINITIONS with a named criterion/);
  assert.match(result.content[0]!.text, /remove the caller reference/);
});

test("a store path outside the workspace root RESOLVES {isError:true} naming AnnoStorePathError (T-29-01)", async () => {
  await withStore(
    () => {},
    async (ws) => {
      const outside = join(dirname(ws), "elsewhere.annostore");
      const result = await runAnnoTool("anno_get_symbols", { store: outside, max_results: 10 });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /\[AnnoStorePathError\]/);
      assert.match(result.content[0]!.text, /outside the workspace root/);
    },
  );
});

test("an absent store is refused, never created -- mustExist is what keeps 'gone' and 'empty' distinguishable", async () => {
  await withStore(
    () => {},
    async (ws) => {
      const absent = join(ws, "not-here.annostore");
      const result = await runAnnoTool("anno_get_symbols", { store: absent, max_results: 10 });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /anno_get_symbols failed: \[Anno/);
    },
  );
});

test("the transport validates nothing, so a missing required argument is refused HERE and named", async () => {
  const noStore = await runAnnoTool("anno_get_symbols", { max_results: 10 });
  assert.equal(noStore.isError, true);
  assert.match(noStore.content[0]!.text, /\[AnnoToolArgumentError\]/);
  assert.match(noStore.content[0]!.text, /"store" must be a non-empty string/);

  const noMax = await runAnnoTool("anno_get_symbols", { store: "p.annostore" });
  assert.equal(noMax.isError, true);
  assert.match(noMax.content[0]!.text, /\[AnnoToolArgumentError\]/);
  assert.match(noMax.content[0]!.text, /"max_results" must be a positive integer/);

  const notAnObject = await runAnnoTool("anno_get_symbols", "not an object");
  assert.equal(notAnObject.isError, true);
  assert.match(notAnObject.content[0]!.text, /\[AnnoToolArgumentError\]/);
});

test("an unprefixed numeric address string is refused by the ONE address parser, not accepted by a second rule here", async () => {
  await withStore(
    () => {},
    async (_ws, storePath) => {
      const result = await runAnnoTool("anno_get_symbols", { store: storePath, max_results: 10, start_address: "1024" });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /\[AnnoAddressError\]/);
    },
  );
});

// ---------------------------------------------------------------------------
// The gate and the derived allow-list.
// ---------------------------------------------------------------------------

test("assertAnnoTool's FIRST check is set membership: an uncurated name is refused before any argument is looked at", () => {
  // Arguments that would fail every per-argument validator, so if the name
  // check were not first this would refuse with the WRONG error class.
  assert.throws(() => assertAnnoTool("anno_not_a_verb", {}), AnnoUncuratedToolError);
  assert.throws(() => assertAnnoTool("anno_get_symbols", {}), AnnoToolArgumentError);
});

test("CURATED_ANNO_TOOLS is DERIVED from ANNO_TOOL_DEFINITIONS, never a second hand-typed list (T-29-02)", () => {
  assert.ok(ANNO_TOOL_DEFINITIONS.length > 0, "the definition table must be non-empty for the assertions below to mean anything");
  assert.deepEqual(
    [...CURATED_ANNO_TOOLS],
    ANNO_TOOL_DEFINITIONS.map((def) => def.name),
  );
  for (const def of ANNO_TOOL_DEFINITIONS) {
    assert.match(def.name, /^anno_[a-z0-9_]+$/, `${def.name} must carry the one D-05 prefix`);
    assert.ok(def.description.length > 0, `${def.name} must carry a description`);
    assert.ok(
      (def.inputSchema.required ?? []).includes("store"),
      `${def.name} must require an explicit store argument -- there is no ambient current store (D-06)`,
    );
  }
});

// ---------------------------------------------------------------------------
// Structural guards over this module's own source (D-06, T-29-03, MCP-02).
// ---------------------------------------------------------------------------

test("anno-tools.ts holds no module-level mutable store handle (D-06)", () => {
  const declarations = ANNO_TOOLS_SOURCE.split("\n").filter((line) => /^(?:let|var)\s/.test(line));
  assert.deepEqual(declarations, [], `anno-tools.ts must hold no module-level mutable state, found: ${JSON.stringify(declarations)}`);
  const topLevelBindings = ANNO_TOOLS_SOURCE.split("\n").filter((line) => /^(?:const|let|var)\s+\w+.*=\s*openStore\(/.test(line));
  assert.deepEqual(topLevelBindings, [], "no module-scope binding may hold a store handle -- the handle lives for one call and no longer");
});

test("every openStore( in anno-tools.ts is closed by a closeStore( inside a finally (T-29-03)", () => {
  const opens = ANNO_TOOLS_SOURCE.split("\n").filter((line) => line.includes("openStore(") && !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"));
  assert.equal(opens.length, 1, `expected exactly one openStore( call site, found ${opens.length}: ${JSON.stringify(opens)}`);

  const start = ANNO_TOOLS_SOURCE.indexOf("export async function runAnnoTool(");
  assert.ok(start > 0, "runAnnoTool() must exist");
  const body = ANNO_TOOLS_SOURCE.slice(start, ANNO_TOOLS_SOURCE.indexOf("\n}", start));
  assert.ok(body.includes("openStore("), "the one openStore( call must live inside runAnnoTool()");
  const finallyIndex = body.indexOf("} finally {");
  assert.ok(finallyIndex > body.indexOf("openStore("), "the finally must follow the open");
  assert.ok(
    body.slice(finallyIndex).includes("closeStore("),
    "closeStore( must sit inside the finally, so the handle is released on the throwing path exactly as on the succeeding one",
  );
});

test("MCP-02 by construction: anno-tools.ts reaches no VICE transport and no host-path seam", () => {
  const code = ANNO_TOOLS_SOURCE.split("\n")
    .filter((line) => !line.trimStart().startsWith("//") && !line.trimStart().startsWith("*"))
    .join("\n");
  for (const forbidden of ["forwardToVice", "ensureViceSession", "rewriteArguments", "hostpath"]) {
    assert.ok(!code.includes(forbidden), `anno-tools.ts must not reach ${forbidden} -- that is what makes the anno_* family's backend-independence sound`);
  }
});

test("anno-tools.ts never throws a bare Error -- every refusal is an AnnoStoreError and therefore a ViceError", () => {
  assert.equal(ANNO_TOOLS_SOURCE.includes("throw new Error("), false, "a bare Error escapes the ViceError family one catch is written against");
});
