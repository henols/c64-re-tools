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
import { copyFileSync, existsSync, mkdtempSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync, fork, spawn } from "node:child_process";
import { connect as netConnect } from "node:net";

import {
  applyEnumUsage,
  closeStore,
  createProjectEnum,
  currentRevision,
  listComments,
  listExecObservations,
  listLabels,
  listRanges,
  listXrefs,
  openStore,
  putXref,
  setDataType,
  setLabel,
  updateProjectEnum,
} from "./anno-store.ts";
import {
  ANNO_READ_REGION_MAX_BYTES,
  ANNO_READ_REGION_MAX_BYTES_ENV,
  ANNO_MAX_BATCH_DEPTH,
  ANNO_TOOL_DEFINITIONS,
  AnnoToolArgumentError,
  AnnoUncuratedToolError,
  CURATED_ANNO_TOOLS,
  READ_ONLY_ANNO_VERBS,
  assertAnnoBatch,
  assertAnnoTool,
  runAnnoTool,
} from "./anno-tools.ts";
import { loadTextFixture } from "./textmon-fixtures.ts";
import { accessMapRanges, parseAccessMap } from "./textmon-memmap.ts";
import { execObservationsFrom } from "./evid-ingest.ts";
import { argvDigest } from "./capture-predicate.ts";
import * as annoTypesModule from "./anno-types.ts";
import { dispatchStock, type StockDispatchDeps } from "./stock-dispatch.ts";
import type { BrokerControlSession } from "./vice-broker-client.ts";
import { textConnect, textDisconnect } from "./text-connect.ts";
import { withTextChannelLock } from "./text-protocol.ts";

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

// ---------------------------------------------------------------------------
// Plan 29-06 Task 1: the write and stored-read verbs.
//
// `stripCommentsAndStrings` below is shared by every structural guard added in
// this plan. A single-pass character scanner and NOT a regex, for the reason
// `scripts/lib/anno-cli-verbs.mjs:47-60` records and this repo's own
// `docs-dangling-refs.test.ts` MEASURED: a regex-alternation extractor silently
// missed a literal at the exact site a real defect lived. Template-literal
// INTERPOLATIONS are preserved as code, because `${someIdentifier}` is an
// identifier reference and a guard over identifiers must see it.
// ---------------------------------------------------------------------------

function stripCommentsAndStrings(source: string): string {
  const out: string[] = [];
  let i = 0;
  while (i < source.length) {
    const ch = source[i]!;
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      while (i < source.length && source[i] !== "\n") i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      i += 2;
      while (i < source.length && !(source[i] === "*" && source[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i += 1;
      while (i < source.length && source[i] !== quote) {
        if (source[i] === "\\") i += 1;
        i += 1;
      }
      i += 1;
      out.push('""');
      continue;
    }
    if (ch === "`") {
      i += 1;
      while (i < source.length && source[i] !== "`") {
        if (source[i] === "\\") {
          i += 2;
          continue;
        }
        if (source[i] === "$" && source[i + 1] === "{") {
          i += 2;
          let depth = 1;
          const start = i;
          while (i < source.length && depth > 0) {
            if (source[i] === "{") depth += 1;
            else if (source[i] === "}") depth -= 1;
            if (depth > 0) i += 1;
          }
          out.push(" ", source.slice(start, i), " ");
          i += 1;
          continue;
        }
        i += 1;
      }
      i += 1;
      out.push('""');
      continue;
    }
    out.push(ch);
    i += 1;
  }
  return out.join("");
}

const ANNO_TOOLS_CODE = stripCommentsAndStrings(ANNO_TOOLS_SOURCE);

function definitionNamed(name: string) {
  return ANNO_TOOL_DEFINITIONS.find((def) => def.name === name);
}

async function body(result: { content: { text: string }[]; isError: boolean }): Promise<Record<string, unknown>> {
  return JSON.parse(result.content[0]!.text) as Record<string, unknown>;
}

test("the twelve write and stored-read verbs are advertised, each requiring an explicit store (D-06)", () => {
  const expected = [
    "anno_set_label_name",
    "anno_set_comment",
    "anno_set_data_type",
    "anno_add_scope",
    "anno_remove_scope",
    "anno_get_symbols",
    "anno_get_comments",
    "anno_get_blocks",
    "anno_create_project_enum",
    "anno_update_project_enum",
    "anno_apply_enum_usage",
    "anno_save_project",
  ];
  for (const name of expected) {
    const def = definitionNamed(name);
    assert.ok(def, `${name} must be in ANNO_TOOL_DEFINITIONS`);
    assert.ok((def!.inputSchema.required ?? []).includes("store"), `${name} must require "store"`);
    assert.ok(def!.description.length >= 40, `${name}'s description must be written for an agent, not a token`);
  }
});

test("a repeated identical anno_set_label_name SUCCEEDS reporting changed:false -- an annotation pass re-run is not an error", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const first = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "irq_handler" });
      assert.equal(first.isError, false, first.content[0]!.text);
      assert.equal((await body(first)).changed, true);

      const second = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "irq_handler" });
      assert.equal(second.isError, false, "a repeated identical edit must SUCCEED, never be refused");
      const secondBody = await body(second);
      assert.equal(secondBody.changed, false, "the second identical write must report no change");
      assert.equal(typeof secondBody.revision, "number");
    },
  );
});

test("an illegal label name is REJECTED by name with the offending name in the message, and nothing is written or sanitized (T-29-23)", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const illegal = "irq handler!";
      const refused = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: illegal });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(refused.content[0]!.text, /irq handler!/, "the refusal must name the offending value");
      assert.match(refused.content[0]!.text, /never sanitized/i);

      const mnemonic = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "lda" });
      assert.equal(mnemonic.isError, true, "a 6502/6510 mnemonic is refused case-insensitively");

      // NOTHING WAS WRITTEN, and in particular nothing that LOOKS like the
      // submitted name: a sanitizing implementation would have stored
      // "irq_handler" here and reported success, and the store's printed name
      // would then diverge from the symbol an export emits.
      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.deepEqual(listLabels(handle), [], "an illegal name must leave no row at all");
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("comment length is bounded in BYTES by the store's own assertion -- this layer adds no second check and no truncation", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // 2049 two-byte characters: 2049 UTF-16 code units, 4098 UTF-8 bytes.
      // Over the 4096-byte bound in bytes, UNDER it in code units -- so a
      // length check written against `String.length` would have accepted it.
      const multiByte = "é".repeat(0);
      const overByBytes = "é".repeat(2049);
      assert.ok(overByBytes.length < 4096, "the fixture must be under the bound in CODE UNITS for this test to mean anything");
      assert.equal(multiByte, "");

      const refused = await runAnnoTool("anno_set_comment", { store, address: "$c000", comment: overByBytes, type: "line" });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoCommentError\]/, "the STORE's assertion is what refuses, not a second rule here");
      assert.match(refused.content[0]!.text, /UTF-8 bytes/);
      assert.match(refused.content[0]!.text, /REFUSED rather than truncated/);

      // A multi-byte comment that fits IS accepted, unchanged and unnormalized.
      const accepted = await runAnnoTool("anno_set_comment", { store, address: "$c000", comment: "résumé of the loop", type: "side" });
      assert.equal(accepted.isError, false, accepted.content[0]!.text);
      const read = await runAnnoTool("anno_get_comments", { store, max_results: 10 });
      const readBody = (await body(read)) as { comments: { text: string }[] };
      assert.deepEqual(
        readBody.comments.map((row) => row.text),
        ["résumé of the loop"],
        "the text is stored verbatim -- no normalization, no truncation",
      );
    },
  );
});

test("F-4: anno_set_data_type's SUCCESSFUL body carries BOTH contradictedComments and reinterpretedSplitTables", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const table = await runAnnoTool("anno_set_data_type", { store, start_address: "$2000", end_address: "$2007", data_type: "lo_hi_address" });
      assert.equal(table.isError, false, table.content[0]!.text);
      const commented = await runAnnoTool("anno_set_comment", { store, address: "$2002", comment: "[confirmed-code] this executes", type: "line" });
      assert.equal(commented.isError, false, commented.content[0]!.text);

      // Retyping two bytes out of the middle of the four-entry split table both
      // FRAGMENTS the table and FALSIFIES a code-asserting comment inside it.
      const retype = await runAnnoTool("anno_set_data_type", { store, start_address: "$2002", end_address: "$2003", data_type: "byte" });
      assert.equal(retype.isError, false, "the disclosure rides on a SUCCESS, never on an error");
      const retypeBody = (await body(retype)) as {
        changed: boolean;
        contradictedComments: { address: number; grade: string; contradictedBy: string }[];
        reinterpretedSplitTables: { row: unknown }[];
      };
      assert.equal(retypeBody.changed, true);
      assert.ok(Array.isArray(retypeBody.contradictedComments), "contradictedComments must be a named top-level field");
      assert.ok(Array.isArray(retypeBody.reinterpretedSplitTables), "reinterpretedSplitTables must be a named top-level field");
      assert.equal(retypeBody.contradictedComments.length, 1, "the [confirmed-code] comment inside the retyped range is contradicted by `byte`");
      assert.equal(retypeBody.contradictedComments[0]!.address, 0x2002);
      assert.equal(retypeBody.contradictedComments[0]!.contradictedBy, "byte");
      assert.equal(retypeBody.reinterpretedSplitTables.length, 1, "the split table this write fragmented must be disclosed");

      // BOTH FIELDS ARE PRESENT EVEN WHEN EMPTY, so a caller reads them
      // unconditionally rather than guarding on a field's absence.
      const quiet = await runAnnoTool("anno_set_data_type", { store, start_address: "$3000", end_address: "$300f", data_type: "byte" });
      const quietBody = (await body(quiet)) as Record<string, unknown>;
      assert.deepEqual(quietBody.contradictedComments, []);
      assert.deepEqual(quietBody.reinterpretedSplitTables, []);
    },
  );
});

test("F-5: a transposed scope span is refused by the store's overlap rule, and anno_remove_scope makes it recoverable without a revert", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // The mistake 28-REVIEW.md:1788-1814 describes: one transposed end.
      const transposed = await runAnnoTool("anno_add_scope", { store, start_address: "$1000", end_address: "$ffff" });
      assert.equal(transposed.isError, false, "the transposed span is ACCEPTED -- that is exactly what makes it dangerous");

      const blocked = await runAnnoTool("anno_add_scope", { store, start_address: "$1000", end_address: "$10ff" });
      assert.equal(blocked.isError, true, "every later scope above that start is now refused");
      assert.match(blocked.content[0]!.text, /\[AnnoRangeShapeError\]/);
      assert.match(blocked.content[0]!.text, /overlaps the existing scope/);

      const removed = await runAnnoTool("anno_remove_scope", { store, start_address: "$1000", end_address: "$ffff" });
      assert.equal(removed.isError, false, removed.content[0]!.text);
      const removedBody = (await body(removed)) as { changed: boolean; scopes: unknown[] };
      assert.equal(removedBody.changed, true);
      assert.deepEqual(removedBody.scopes, [], "the inverse removed the scope outright, with no revert and no snapshot spent");

      const retry = await runAnnoTool("anno_add_scope", { store, start_address: "$1000", end_address: "$10ff" });
      assert.equal(retry.isError, false, "the intended scope is addable again -- the refusal was recoverable");

      // Removing a scope that is not there SUCCEEDS reporting no change: an
      // inverse that refuses when there is nothing to undo makes "undo this"
      // conditional on knowing whether it was ever done.
      const noop = await runAnnoTool("anno_remove_scope", { store, start_address: "$4000", end_address: "$40ff" });
      assert.equal(noop.isError, false);
      assert.equal((await body(noop)).changed, false);
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 46-04: anno_exclude_range / anno_include_range -- the exclusion
// setter/unsetter pair, following anno_add_scope/anno_remove_scope's exact
// four-site registration shape. Every refusal test below asserts BOTH the
// message's CONTENT and the POST-STATE (a follow-up successful call's
// excludedRanges is exactly what it was before the refusal) -- a refusal
// that threw after a partial write would otherwise pass a message assertion
// while having corrupted the store.
// ---------------------------------------------------------------------------

test("CURATED_ANNO_TOOLS contains both anno_exclude_range and anno_include_range, without any second list being edited", () => {
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_exclude_range"));
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_include_range"));
  // CURATED_ANNO_TOOLS is a .map() over ANNO_TOOL_DEFINITIONS -- both names
  // must also be definitions, or this module's own header's "never hand-type
  // a second list" discipline would have been violated to make this pass.
  assert.ok(definitionNamed("anno_exclude_range"));
  assert.ok(definitionNamed("anno_include_range"));
});

test("anno_exclude_range's description states that recording an exclusion removes nothing -- pinned against the published definition, not a copy", () => {
  const def = definitionNamed("anno_exclude_range");
  assert.ok(def, "anno_exclude_range must be in ANNO_TOOL_DEFINITIONS");
  assert.match(
    def!.description,
    /DOES NOT REMOVE ANYTHING/,
    "the reassurance that recording an exclusion changes nothing about which bytes the export emits must be part of the published surface",
  );
});

test("anno_exclude_range and anno_include_range are absent from the tools manifest -- the anno_* family is served proxy-locally, in neither, by design", () => {
  const stock = JSON.parse(readFileSync(join(HERE, "tools-manifest.stock.json"), "utf8")) as { tools: { name: string }[] };
  const stockNames = new Set(stock.tools.map((t) => t.name));
  for (const name of ["anno_exclude_range", "anno_include_range"]) {
    assert.equal(stockNames.has(name), false, `${name} must be absent from the stock manifest`);
  }
});

test("anno_exclude_range records a span with its reason, reporting changed:true and excludedRanges of length 1; a byte-identical repeat SUCCEEDS reporting changed:false", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const first = await runAnnoTool("anno_exclude_range", { store, start_address: "$4000", end_address: "$40ff", reason: "cracker intro" });
      assert.equal(first.isError, false, first.content[0]!.text);
      const firstBody = (await body(first)) as {
        store: string;
        start_address: number;
        end_address: number;
        changed: boolean;
        excludedRanges: { start: number; endInclusive: number; reason: string }[];
      };
      assert.equal(firstBody.changed, true);
      assert.equal(firstBody.start_address, 0x4000);
      assert.equal(firstBody.end_address, 0x40ff);
      assert.equal(firstBody.excludedRanges.length, 1, "the SUCCESSFUL body must carry the full current excludedRanges list");
      assert.equal(firstBody.excludedRanges[0]!.reason, "cracker intro");

      const repeat = await runAnnoTool("anno_exclude_range", { store, start_address: "$4000", end_address: "$40ff", reason: "cracker intro" });
      assert.equal(repeat.isError, false, "an identical repeat must SUCCEED, never be refused");
      const repeatBody = (await body(repeat)) as { changed: boolean; excludedRanges: unknown[] };
      assert.equal(repeatBody.changed, false, "the repeat must report no change");
      assert.equal(repeatBody.excludedRanges.length, 1, "the list must still be reported in full on the no-op path");
    },
  );
});

test("anno_exclude_range refuses a missing reason at the validation layer, naming the argument, with the store left untouched", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const refused = await runAnnoTool("anno_exclude_range", { store, start_address: "$5000", end_address: "$50ff" });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(refused.content[0]!.text, /"reason"/, "the refusal must name the offending argument");

      // POST-STATE: nothing was written by the refused call.
      const after = await runAnnoTool("anno_exclude_range", { store, start_address: "$5000", end_address: "$50ff", reason: "now with a reason" });
      assert.equal(after.isError, false, after.content[0]!.text);
      const afterBody = (await body(after)) as { excludedRanges: unknown[] };
      assert.equal(afterBody.excludedRanges.length, 1, "the refused call must not have left a partial row behind");
    },
  );
});

test("anno_exclude_range refuses an empty or whitespace-only reason the same way a missing one is refused", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const refused = await runAnnoTool("anno_exclude_range", { store, start_address: "$5100", end_address: "$51ff", reason: "   " });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(refused.content[0]!.text, /"reason"/);
    },
  );
});

test("anno_exclude_range with a transposed span (end below start) is refused by assertSpanArgs's existing rule, not by a new one", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const refused = await runAnnoTool("anno_exclude_range", { store, start_address: "$6100", end_address: "$6000", reason: "transposed" });
      assert.equal(refused.isError, true);
      assert.match(
        refused.content[0]!.text,
        /\[AnnoRangeShapeError\]/,
        "assertSpanArgs's own assertRangeShape() throws this -- the SAME shape validator every other span-shaped verb uses, not a new one",
      );
      assert.match(refused.content[0]!.text, /below start/);

      const after = await runAnnoTool("anno_include_range", { store, start_address: "$6000", end_address: "$61ff" });
      assert.equal(after.isError, false, after.content[0]!.text);
      assert.equal((await body(after)).changed, false, "nothing was recorded by the refused transposed call");
    },
  );
});

test("anno_exclude_range surfaces the store's overlap refusal, and two exclusions that merely TOUCH are disjoint and both accepted", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const first = await runAnnoTool("anno_exclude_range", { store, start_address: "$7000", end_address: "$70ff", reason: "block one" });
      assert.equal(first.isError, false, first.content[0]!.text);

      const overlapping = await runAnnoTool("anno_exclude_range", { store, start_address: "$70ff", end_address: "$71ff", reason: "block two" });
      assert.equal(overlapping.isError, true, "a one-byte overlap at the boundary must be refused");
      assert.match(overlapping.content[0]!.text, /\[AnnoRangeShapeError\]/, "the STORE's own overlap refusal surfaces through the tool unchanged");
      assert.match(overlapping.content[0]!.text, /overlaps the existing exclusion/);

      // TOUCHING (not overlapping): the second span starts exactly one byte
      // past the first's end -- disjoint, and both accepted as two records.
      const touching = await runAnnoTool("anno_exclude_range", { store, start_address: "$7100", end_address: "$71ff", reason: "block two, adjacent" });
      assert.equal(touching.isError, false, touching.content[0]!.text);
      const touchingBody = (await body(touching)) as { excludedRanges: unknown[] };
      assert.equal(touchingBody.excludedRanges.length, 2, "touching exclusions stay TWO separate records");
    },
  );
});

test("anno_exclude_range refuses the same extent recorded with a DIFFERENT reason, leaving the stored reason exactly as it was", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const first = await runAnnoTool("anno_exclude_range", { store, start_address: "$8000", end_address: "$80ff", reason: "original reason" });
      assert.equal(first.isError, false, first.content[0]!.text);

      const conflicting = await runAnnoTool("anno_exclude_range", { store, start_address: "$8000", end_address: "$80ff", reason: "a different reason" });
      assert.equal(conflicting.isError, true);
      assert.match(conflicting.content[0]!.text, /\[AnnoRangeShapeError\]/);
      assert.match(conflicting.content[0]!.text, /DIFFERENT reason/);

      const read = await runAnnoTool("anno_include_range", { store, start_address: "$8000", end_address: "$80ff" });
      assert.equal(read.isError, false, read.content[0]!.text);
      // The record removed here is the ORIGINAL one -- if the conflicting
      // write had silently overwritten the reason, this would still remove
      // exactly one row, so the removal alone does not distinguish the two
      // outcomes; the refusal message above is what proves the store was
      // untouched, and this assertion proves removal saw a row to remove.
      assert.equal((await body(read)).changed, true, "the original record must still be the one exactly recorded, not silently dropped");
    },
  );
});

test("anno_include_range removes an exact extent reporting changed:true; an extent that is not there reports changed:false", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const added = await runAnnoTool("anno_exclude_range", { store, start_address: "$9000", end_address: "$90ff", reason: "to be removed" });
      assert.equal(added.isError, false, added.content[0]!.text);

      const removed = await runAnnoTool("anno_include_range", { store, start_address: "$9000", end_address: "$90ff" });
      assert.equal(removed.isError, false, removed.content[0]!.text);
      const removedBody = (await body(removed)) as { changed: boolean; excludedRanges: unknown[] };
      assert.equal(removedBody.changed, true);
      assert.deepEqual(removedBody.excludedRanges, [], "the inverse removed the exclusion outright");

      const noop = await runAnnoTool("anno_include_range", { store, start_address: "$a000", end_address: "$a0ff" });
      assert.equal(noop.isError, false, noop.content[0]!.text);
      assert.equal((await body(noop)).changed, false, "removing an exclusion that is not there succeeds reporting no change");
    },
  );
});

test("anno_include_range refuses a span that PARTIALLY overlaps a stored exclusion by name, rather than silently reporting no change", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const added = await runAnnoTool("anno_exclude_range", { store, start_address: "$b000", end_address: "$b0ff", reason: "partial removal target" });
      assert.equal(added.isError, false, added.content[0]!.text);

      const partial = await runAnnoTool("anno_include_range", { store, start_address: "$b000", end_address: "$b07f" });
      assert.equal(partial.isError, true, "a non-exact span must be refused, never treated as a plain no-op");
      assert.match(partial.content[0]!.text, /\[AnnoRangeShapeError\]/);
      assert.match(partial.content[0]!.text, /does not EXACTLY match/);

      const read = await runAnnoTool("anno_include_range", { store, start_address: "$b000", end_address: "$b0ff" });
      assert.equal(read.isError, false, read.content[0]!.text);
      assert.equal((await body(read)).changed, true, "the exact removal still works after the partial one was refused -- nothing was corrupted");
    },
  );
});

test("BATCH ROUTE (load-bearing): both anno_exclude_range and anno_include_range are validated inside anno_batch_execute by the SAME per-verb validator the direct route uses -- proves the single-validator claim rather than restating it", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const result = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          { name: "anno_exclude_range", arguments: { start_address: "$c000", end_address: "$c0ff", reason: "batch entry zero" } },
          { name: "anno_exclude_range", arguments: { start_address: "$c100", end_address: "$c1ff" } }, // missing "reason"
        ],
      });
      // Pre-validation runs over the WHOLE batch before anything executes
      // (the same discipline "NOTHING executes when pre-validation refuses"
      // proves for the rest of the surface), so the refusal is whole-batch,
      // isError:true, and names the offending index -- the same interpolation
      // every other per-verb validator performs via `whereOf()`.
      assert.equal(result.isError, true, "a missing required argument on ANY batch entry refuses the WHOLE batch before execution");
      assert.match(result.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(result.content[0]!.text, /"reason"/);
      assert.match(result.content[0]!.text, /calls\[1\]/, "the refusal must name the offending batch index");

      // POST-STATE: NOTHING executed, not even the well-formed first entry.
      const after = await runAnnoTool("anno_include_range", { store, start_address: "$c000", end_address: "$c0ff" });
      assert.equal(after.isError, false, after.content[0]!.text);
      assert.equal((await body(after)).changed, false, "the well-formed first entry must not have landed -- pre-validation refuses the WHOLE batch");
    },
  );
});

test("a tool name outside CURATED_ANNO_TOOLS is still refused outright by the outer gate, even one shaped like the new pair", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const refused = await runAnnoTool("anno_exclude_range_v2", { store, start_address: "$d000", end_address: "$d0ff", reason: "not curated" });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoUncuratedToolError\]/);
    },
  );
});

test("anno_apply_enum_usage with an omitted or empty name CLEARS the association, matching the schema's own contract", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const created = await runAnnoTool("anno_create_project_enum", {
        store,
        name: "vic_registers",
        variants: { "$d020": "border_colour", "53281": "background_colour" },
      });
      assert.equal(created.isError, false, created.content[0]!.text);

      const applied = await runAnnoTool("anno_apply_enum_usage", { store, address: "$c000", name: "vic_registers" });
      assert.equal(applied.isError, false, applied.content[0]!.text);
      const appliedBody = (await body(applied)) as { cleared: boolean; changed: boolean; enum_usage: { address: number; enumName: string }[] };
      assert.equal(appliedBody.cleared, false);
      assert.equal(appliedBody.changed, true);
      assert.deepEqual(appliedBody.enum_usage.map((row) => [row.address, row.enumName]), [[0xc000, "vic_registers"]]);

      const clearedEmpty = await runAnnoTool("anno_apply_enum_usage", { store, address: "$c000", name: "" });
      assert.equal(clearedEmpty.isError, false, clearedEmpty.content[0]!.text);
      const clearedBody = (await body(clearedEmpty)) as { cleared: boolean; changed: boolean; enum_usage: unknown[] };
      assert.equal(clearedBody.cleared, true);
      assert.equal(clearedBody.changed, true);
      assert.deepEqual(clearedBody.enum_usage, []);

      // OMITTED is the same clear, and clearing an address that carries none
      // SUCCEEDS reporting no change.
      const clearedOmitted = await runAnnoTool("anno_apply_enum_usage", { store, address: "$c000" });
      assert.equal(clearedOmitted.isError, false);
      const omittedBody = (await body(clearedOmitted)) as { cleared: boolean; changed: boolean };
      assert.equal(omittedBody.cleared, true);
      assert.equal(omittedBody.changed, false);

      // Applying an enum that does not exist is REFUSED, never created implicitly.
      const missing = await runAnnoTool("anno_apply_enum_usage", { store, address: "$c000", name: "not_an_enum" });
      assert.equal(missing.isError, true);
      assert.match(missing.content[0]!.text, /does not exist/);
    },
  );
});

test("anno_save_project reports the revision and PERFORMS NO WRITE -- the revision and the store file's mtime are identical before and after", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const seeded = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "irq_handler" });
      assert.equal(seeded.isError, false, seeded.content[0]!.text);
      const revisionBefore = (await body(seeded)).revision as number;
      const mtimeBefore = statSync(store).mtimeMs;

      const saved = await runAnnoTool("anno_save_project", { store });
      assert.equal(saved.isError, false, saved.content[0]!.text);
      const savedBody = (await body(saved)) as { revision: number; wrote: boolean; note: string };
      assert.equal(savedBody.revision, revisionBefore, "the revision must not advance -- this verb writes nothing");
      assert.equal(savedBody.wrote, false);
      assert.match(savedBody.note, /performed NO write/);
      assert.match(savedBody.note, /already durable/);
      assert.equal(statSync(store).mtimeMs, mtimeBefore, "the store file must not be touched at all");

      const again = await runAnnoTool("anno_save_project", { store });
      assert.equal(((await body(again)).revision as number), revisionBefore);
      assert.equal(statSync(store).mtimeMs, mtimeBefore);
    },
  );
});

test("WR-10: anno_save_project's revision FIELD and the revision named in its own prose are the same value", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // Seeded so the revision is not whatever an empty store starts at --
      // a pin that only held at revision 0 would hold for the wrong reason.
      for (const [i, name] of ["first_label", "second_label", "third_label"].entries()) {
        const written = await runAnnoTool("anno_set_label_name", { store, address: 0xc000 + i * 0x10, name });
        assert.equal(written.isError, false, written.content[0]!.text);
      }

      const saved = await runAnnoTool("anno_save_project", { store });
      assert.equal(saved.isError, false, saved.content[0]!.text);
      const savedBody = (await body(saved)) as { revision: number; wrote: boolean; note: string };

      // Extracted from the PROSE, never asserted as a literal: a literal would
      // pin the fixture, and the property here is that the two AGREE. This is
      // the one verb whose output a caller is told to use as a base_revision
      // compare-and-swap guard, so a field and a note that can name different
      // revisions is a guard built on a number its own note contradicts.
      const named = /revision (\d+)/.exec(savedBody.note);
      assert.ok(named, `the note must NAME the revision it is talking about -- got ${JSON.stringify(savedBody.note)}`);
      assert.equal(Number(named![1]), savedBody.revision, "the field and the prose must be the SAME revision, by construction");

      // The honest no-op stays honest: this must not have become a silent success.
      assert.equal(savedBody.wrote, false);
      assert.match(savedBody.note, /performed NO write/);
    },
  );
});

test("WR-10: dispatchSaveProject() reads the store revision EXACTLY ONCE", () => {
  // Asserted over the comment-and-string-stripped source, so neither the
  // function's own rationale nor the note's prose can affect the count.
  const start = ANNO_TOOLS_CODE.indexOf("function dispatchSaveProject(");
  assert.ok(start > 0, "dispatchSaveProject() must exist");
  const bodyText = ANNO_TOOLS_CODE.slice(start, ANNO_TOOLS_CODE.indexOf("\n}", start));
  const reads = bodyText.match(/currentRevision\(/g) ?? [];
  assert.equal(reads.length, 1, "two reads are two chances to disagree -- the field and the prose must come from ONE const");
});

test("every verb closes the store: no handle is left open and no journal sidecar survives a repeated call", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      for (let i = 0; i < 5; i += 1) {
        const written = await runAnnoTool("anno_set_comment", { store, address: 0x1000 + i, comment: `pass ${i}`, type: "line" });
        assert.equal(written.isError, false, written.content[0]!.text);
        assert.equal(existsSync(`${store}-wal`), false, "no write-ahead sidecar may survive a completed call");
        assert.equal(existsSync(`${store}-journal`), false, "no rollback journal may survive a completed call");
      }
      // The store is fully re-openable afterwards, which it would not be if a
      // handle from a previous call were still holding it.
      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.equal(listComments(handle).length, 5);
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("anno-tools.ts re-implements no address parsing, no range validation and no data-type membership -- every such check calls an anno-types.ts export", () => {
  for (const owned of ["parseStoreAddress(", "assertRangeShape(", "assertDataType(", "assertLegalLabel(", "assertCommentText(", "assertEnumName(", "assertCommentType(", "assertLabelKind("]) {
    assert.ok(ANNO_TOOLS_CODE.includes(owned), `anno-tools.ts must route through anno-types.ts's ${owned}`);
  }
  // Asserted over the STRIPPED source, so the header prose naming these
  // hazards cannot make the check pass by containing the words.
  for (const forbidden of ["parseInt(", "parseFloat(", "charCodeAt(", "normalize("]) {
    assert.equal(ANNO_TOOLS_CODE.includes(forbidden), false, `${forbidden} in anno-tools.ts would be a second, divergent rule beside the store's own`);
  }
  // Case folding is permitted in EXACTLY one place -- normalizing a FILE
  // EXTENSION, which is `anno-cli.ts`'s own discipline and not an argument
  // rule. Anywhere else it would silently merge two names a human
  // distinguished, which is the sanitization T-29-23 forbids.
  const foldSites = ANNO_TOOLS_CODE.split("toLowerCase()").length - 1;
  assert.equal(foldSites, 1, "case folding must appear exactly once in anno-tools.ts");
  assert.match(ANNO_TOOLS_CODE, /extname\([^)]*\)\.toLowerCase\(\)/, "the one case-folding site must be the file-extension normalization");
  // No second copy of the frozen twelve as an executable array. The
  // inputSchema's `enum` is documentation and its members are string literals,
  // which the stripper has already removed.
  assert.equal(/\[\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*\]/.test(ANNO_TOOLS_CODE), false, "a twelve-member literal array here would be a second data-type vocabulary");
});

// ---------------------------------------------------------------------------
// Plan 29-06 Task 2: the derived and composed read verbs.
//
// Every image below is a REAL file inside the REAL temporary workspace, written
// through the same containment the verbs enforce -- the seam D-07 depends on is
// exercised, never stubbed.
// ---------------------------------------------------------------------------

/** A .prg: a 2-byte little-endian load address followed by the payload. */
function prgBytes(origin: number, payload: number[]): Uint8Array {
  return Uint8Array.from([origin & 0xff, (origin >> 8) & 0xff, ...payload]);
}

function writeImage(ws: string, fileName: string, bytes: Uint8Array): string {
  const path = join(ws, fileName);
  writeFileSync(path, bytes);
  return path;
}

/** `$c000 jsr $c010` / `$c003 jmp $c010` / `$c006 rts` -- two references to one
 * address, from two different opcodes, so the union is not an artefact of one. */
const TWO_CALLERS_PRG = prgBytes(0xc000, [0x20, 0x10, 0xc0, 0x4c, 0x10, 0xc0, 0x60]);

/** Runs `body` with the region cap overridden, restoring it unconditionally.
 * The override is read AT CALL TIME, which is what makes this possible inside a
 * single `node --test` process. */
async function withRegionCap(cap: string, run: () => Promise<void>): Promise<void> {
  const previous = process.env[ANNO_READ_REGION_MAX_BYTES_ENV];
  process.env[ANNO_READ_REGION_MAX_BYTES_ENV] = cap;
  try {
    await run();
  } finally {
    if (previous === undefined) delete process.env[ANNO_READ_REGION_MAX_BYTES_ENV];
    else process.env[ANNO_READ_REGION_MAX_BYTES_ENV] = previous;
  }
}

test("the six derived and composed verbs are advertised, and every one requires an explicit image (D-07)", () => {
  for (const name of [
    "anno_disassemble",
    "anno_read_region",
    "anno_get_binary_info",
    "anno_get_cross_references",
    "anno_search",
    "anno_get_address_details",
  ]) {
    const def = definitionNamed(name);
    assert.ok(def, `${name} must be in ANNO_TOOL_DEFINITIONS`);
    const required = def!.inputSchema.required ?? [];
    assert.ok(required.includes("store"), `${name} must require "store"`);
    assert.ok(required.includes("image"), `${name} must require "image" -- the store holds annotations, never bytes (D-07)`);
  }
});

test("anno_disassemble decodes at an EXPLICIT address, and the surface names no cursor anywhere (D-09)", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c006" });
      assert.equal(result.isError, false, result.content[0]!.text);
      const disasmBody = (await body(result)) as { address: number; instructions: number; listing: string };
      assert.equal(disasmBody.address, 0xc000, "decoding starts where the caller said, and nowhere else");
      assert.equal(disasmBody.instructions, 3);
      assert.match(disasmBody.listing, /jsr \$c010/i);
      assert.match(disasmBody.listing, /jmp \$c010/i);
      assert.match(disasmBody.listing, /\* = \$c000/, "the listing's origin is the requested address");
    },
  );
});

// ---------------------------------------------------------------------------
// D-16/D-17 (plan 45-05): `anno_disassemble` is the SECOND renderer -- it
// calls `decomposeRegisterValue()` (`anno-enum-gen.ts`, plan 45-03), the SAME
// owning decoder `anno-export-asm.ts`'s real-ACME byte-diff oracle proves.
// This surface adds NOTHING to that proof; it only makes a bound register
// write readable in the one place a Claude session actually looks.
// ---------------------------------------------------------------------------

/** `lda #$04` / `sta $d018` / `rts` -- the same $D018=$04 write
 * `anno-export-asm.test.ts` uses, at `$c000` instead of `$0801` so this file
 * stays independent of that one's fixture addresses. */
const D018_WRITE_PRG = prgBytes(0xc000, [0xa9, 0x04, 0x8d, 0x18, 0xd0, 0x60]);

test("D-16/D-17 Test 1: anno_disassemble renders a multi-field register write as OR-ed term names plus a decoded comment, on the same line", async () => {
  await withStore(
    (handle) => {
      createProjectEnum(handle, { name: "D018", variants: {} });
      applyEnumUsage(handle, { address: 0xc000, name: "D018" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", D018_WRITE_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c005" });
      assert.equal(result.isError, false, result.content[0]!.text);
      const disasmBody = (await body(result)) as { listing: string };

      const ldaLine = disasmBody.listing.split("\n").find((l) => l.includes("lda #"));
      assert.ok(ldaLine !== undefined, `the lda line must be present:\n${disasmBody.listing}`);
      assert.ok(
        ldaLine!.includes(
          "lda #D018_SELECT_UPPER_LOWER_CHARACTER_SET0 | D018_CHARACTER_DOT_DATA_BASE_ADDRESS2 | D018_VIDEO_MATRIX_BASE_ADDRESS0",
        ),
        `the operand must be the OR-ed term names, exactly as the export renders them:\n${ldaLine}`,
      );
      assert.equal(disasmBody.listing.includes("lda #$04"), false, "the hex literal must be REPLACED, not merely accompanied");
      assert.ok(ldaLine!.includes("  ; $D018: "), `a trailing mechanical-decode comment must be present:\n${ldaLine}`);
      for (const fragment of ["SELECT_UPPER_LOWER_CHARACTER_SET=0", "CHARACTER_DOT_DATA_BASE_ADDRESS=2", "VIDEO_MATRIX_BASE_ADDRESS=0"]) {
        assert.ok(ldaLine!.includes(fragment), `the comment must name every field and its decoded value (${fragment}):\n${ldaLine}`);
      }
    },
  );
});

test("D-16 Test 2: a range with NO enum usage renders exactly what it renders today -- the existing listing is unchanged for unbound instructions", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", D018_WRITE_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c005" });
      assert.equal(result.isError, false, result.content[0]!.text);
      const disasmBody = (await body(result)) as { listing: string };
      assert.match(disasmBody.listing, /lda #\$04/, `an unbound write must still render the plain hex literal:\n${disasmBody.listing}`);
      assert.match(disasmBody.listing, /sta \$d018/i, `the following instruction must be untouched:\n${disasmBody.listing}`);
    },
  );
});

test("D-16 Test 3: anno_read_region with view:'disasm' is NOT changed by this task -- one verb's readability, not two", async () => {
  await withStore(
    (handle) => {
      createProjectEnum(handle, { name: "D018", variants: {} });
      applyEnumUsage(handle, { address: 0xc000, name: "D018" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", D018_WRITE_PRG);
      const region = await runAnnoTool("anno_read_region", { store, image, start_address: "$c000", end_address: "$c005", view: "disasm" });
      assert.equal(region.isError, false, region.content[0]!.text);
      const regionBody = (await body(region)) as { listing: string };
      assert.match(
        regionBody.listing,
        /lda #\$04/,
        `anno_read_region's disasm view must stay exactly as it is -- D-16 named two surfaces, the export and anno_disassemble, and this is not one of them:\n${regionBody.listing}`,
      );
    },
  );
});

test("D-16 Test 4: an enum usage naming an enum the store does not hold is REFUSED, matching the export boundary's own refusal shape", async () => {
  await withStore(
    (handle) => {
      // applyEnumUsage() resolves the enum inside its own transaction, so
      // reaching "the store holds no definition" needs a project enum that
      // is later removed from underneath the usage -- the same unreachable-
      // through-the-public-route state `anno-export-asm.ts`'s own identical
      // check documents. Reproduced the SAME way that file's own comment
      // says: create the enum, bind the usage, then rename the enum away
      // from the name the usage still carries (`updateProjectEnum` replaces
      // wholesale rather than merges, so the OLD name is left with no row).
      createProjectEnum(handle, { name: "D018", variants: {} });
      applyEnumUsage(handle, { address: 0xc000, name: "D018" });
    },
    async (ws, store) => {
      // Rename the enum out from under the usage through the SAME store
      // handle shape `anno-export-asm.test.ts` uses nowhere -- this file
      // reaches the identical unreachable-in-practice state via a second,
      // independent store open (a real store file somebody edited is the
      // scenario the exporter's own comment names).
      // `mustExist: true` opens READ-ONLY (`openStore()`'s own "judge an
      // existing image" mode) -- a real write needs the default, writable
      // open, which is safe here because the store already exists (seeded
      // above) and `fresh` is therefore false.
      const handle = openStore(store, { workspaceRoot: ws });
      try {
        updateProjectEnum(handle, { name: "D018", newName: "D018_RENAMED" });
      } finally {
        closeStore(handle);
      }

      const image = writeImage(ws, "prog.prg", D018_WRITE_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c005" });
      assert.equal(result.isError, true, "a dangling enum usage must be REFUSED, never rendered as a silently plain listing");
      assert.match(result.content[0]!.text, /\[AnnoStoreError\]/);
      assert.ok(result.content[0]!.text.includes("D018"), `the refusal names the ENUM: ${result.content[0]!.text}`);
      assert.ok(result.content[0]!.text.includes("$c000"), `the refusal names the ADDRESS: ${result.content[0]!.text}`);
    },
  );
});

// ---------------------------------------------------------------------------
// 45-REVIEW CR-01 (fixed 2026-09-11): the decomposition attempt is gated on
// TABLE MEMBERSHIP (`hasRegBitsEntry()`), not name shape alone -- the SAME
// fix `anno-export-asm.test.ts` proves through a real-ACME byte-diff oracle,
// proved here through this SECOND renderer instead. Before this fix, a
// register-shaped enum name for a register `anno-regbits.json` does not
// cover (e.g. `$D020`) made `decomposeRegisterValue()` throw its "no
// bit-name table entry" error, and this renderer re-threw it fatally instead
// of falling through to the pre-existing single-symbol path.
// ---------------------------------------------------------------------------

/** `lda #$00` / `sta $d020` / `rts` at `$c000` -- `$D020` (VIC-II border
 * colour) is CONFIRMED ABSENT from the committed `anno-regbits.json`: it is
 * name-shaped like a register the table covers, but the table carries no
 * entry for it at all, which is what makes it the CR-01 regression case
 * this fixture exercises. */
const D020_WRITE_PRG = prgBytes(0xc000, [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60]);

test("CR-01 Fix Test C: a register-shaped enum name for a register anno-regbits.json has NO entry for ($D020) renders through the plain single-symbol path, not a throw", async () => {
  await withStore(
    (handle) => {
      createProjectEnum(handle, { name: "D020", variants: { $00: "BLACK" } });
      applyEnumUsage(handle, { address: 0xc000, name: "D020" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", D020_WRITE_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c005" });
      assert.equal(result.isError, false, result.content[0]!.text);
      const disasmBody = (await body(result)) as { listing: string };

      const ldaLine = disasmBody.listing.split("\n").find((l) => l.includes("lda #"));
      assert.ok(ldaLine !== undefined, `the lda line must be present:\n${disasmBody.listing}`);
      assert.ok(
        ldaLine!.includes("lda #D020_BLACK"),
        `an absent-from-table register-shaped enum must still render through the PLAIN single-symbol path:\n${ldaLine}`,
      );
      assert.equal(disasmBody.listing.includes("lda #$00"), false, "the hex literal must be REPLACED, not merely accompanied");
    },
  );
});

/** `lda #$01` (bit #0 set) / `sta $dd00` / `rts` at `$c000` -- `$DD00` IS
 * present in the committed table but covers only bits #2-#7, so bit #0 is
 * uncovered: a register with a real table entry whose bit-name fields do
 * not span every bit, the gap class this fixture exercises alongside the
 * fully-absent case above. */
const DD00_WRITE_PRG = prgBytes(0xc000, [0xa9, 0x01, 0x8d, 0x00, 0xdd, 0x60]);

test("CR-01 Fix Test D: a register PRESENT in the table but not fully covered by its fields ($DD00) still refuses loudly -- the membership-test fix does not weaken T-45-21", async () => {
  await withStore(
    (handle) => {
      createProjectEnum(handle, { name: "DD00", variants: {} });
      applyEnumUsage(handle, { address: 0xc000, name: "DD00" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", DD00_WRITE_PRG);
      const result = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c005" });
      assert.equal(result.isError, true, "a genuinely-lossy decomposition must still refuse, not fall back to a hex literal");
      assert.match(result.content[0]!.text, /\[AnnoStoreError\]/);
      assert.ok(result.content[0]!.text.includes("DD00"), `the refusal names the register/enum: ${result.content[0]!.text}`);
      assert.ok(result.content[0]!.text.includes("not fully covered"), `the refusal names the real cause: ${result.content[0]!.text}`);
    },
  );
});

test("D-09: no identifier, schema property or dispatch branch on this surface names a cursor or a current address", () => {
  // Asserted over the COMMENT-AND-STRING-STRIPPED source, so the module
  // header's own prose explaining why the anti-feature is absent cannot make
  // the check pass by containing the word.
  assert.equal(/cursor/i.test(ANNO_TOOLS_CODE), false, "a cursor identifier anywhere would reintroduce the anti-feature D-09 folded away");
  assert.equal(/current[_\s]*address/i.test(ANNO_TOOLS_CODE), false, "a 'current address' concept is the same anti-feature under another name");
  // And the check is not vacuous: the header DOES discuss it, in prose.
  assert.match(ANNO_TOOLS_SOURCE, /cursor/i, "the header must explain the absence, or a later reader will read it as an oversight");
});

test("ONE cap governs BOTH views, is read at call time, and refuses by name with the cap and the requested width", async () => {
  assert.equal(ANNO_READ_REGION_MAX_BYTES, 4096);
  assert.equal(ANNO_READ_REGION_MAX_BYTES_ENV, "ANNO_READ_REGION_MAX_BYTES");
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);

      const overDefault = await runAnnoTool("anno_read_region", { store, image, start_address: 0, end_address: 4096 });
      assert.equal(overDefault.isError, true);
      assert.match(overDefault.content[0]!.text, /\[AnnoRegionRangeError\]/);
      assert.match(overDefault.content[0]!.text, /4097 bytes/, "the message must name the REQUESTED width");
      assert.match(overDefault.content[0]!.text, /cap of 4096/, "the message must name the CAP");

      await withRegionCap("8", async () => {
        const region = await runAnnoTool("anno_read_region", { store, image, start_address: "$c000", end_address: "$c008" });
        assert.equal(region.isError, true, "the override is read at CALL time, not frozen at module load");
        assert.match(region.content[0]!.text, /cap of 8/);

        // THE SAME CAP GOVERNS THE DISASSEMBLE VIEW -- one cap, both views, so
        // there is no per-view rule to get subtly wrong.
        const disasm = await runAnnoTool("anno_disassemble", { store, image, address: "$c000", end_address: "$c008" });
        assert.equal(disasm.isError, true);
        assert.match(disasm.content[0]!.text, /\[AnnoRegionRangeError\]/);
        assert.match(disasm.content[0]!.text, /cap of 8/);
      });
    },
  );
});

test("anno_read_region serves both views, and a span outside the image is reported unanswerable rather than served short", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);

      const hex = await runAnnoTool("anno_read_region", { store, image, start_address: "$c000", end_address: "$c002", view: "hexdump" });
      assert.equal(hex.isError, false, hex.content[0]!.text);
      const hexBody = (await body(hex)) as { view: string; hexdump: string; bytes: number };
      assert.equal(hexBody.view, "hexdump");
      assert.equal(hexBody.bytes, 3);
      assert.match(hexBody.hexdump, /\$c000 {2}20 10 c0/);

      const outside = await runAnnoTool("anno_read_region", { store, image, start_address: "$c000", end_address: "$c0ff" });
      assert.equal(outside.isError, false, "a well-formed question this image cannot answer is not a caller error");
      const outsideBody = (await body(outside)) as { available: boolean; reason: string };
      assert.equal(outsideBody.available, false);
      assert.ok(outsideBody.reason.length >= 40, "a bare token is not a reason");
      assert.match(outsideBody.reason, /partial answer to a range question/);
    },
  );
});

// ---------------------------------------------------------------------------
// CR-01 / MCP-04: THE TWO READ VERBS MUST AGREE.
//
// `anno_disassemble` and `anno_read_region` ask the same question of the same
// bytes through the same `sliceSpan()`/`outsideImage()` pair. The review
// reproduced them DISAGREEING: `anno_read_region` refused an out-of-image
// address correctly while `anno_disassemble` answered `isError:false` with
// `instructions:0` and an `end_address` numerically BELOW the `address` asked
// about -- a plausible-looking zero, and the exact shape ROADMAP criterion 5
// and this surface's own prohibition forbid.
//
// The property under assertion below is their AGREEMENT, asserted in ONE test
// per case rather than as two independent shapes that could drift apart again.
// ---------------------------------------------------------------------------

/** Loads at $1000 with FOUR payload bytes, so its last address is $1003:
 * `lda #$00` / `inx` / `rts`. Deliberately tiny -- every address at or above
 * $1004 is outside it, which is what the out-of-image cases need, and the
 * three instructions give the over-refusal control something non-zero to
 * count. */
const TINY_PRG = prgBytes(0x1000, [0xa9, 0x00, 0xe8, 0x60]);

/** The out-of-image address the review reported against: $9000, far past a
 * four-byte image loading at $1000. */
const OUT_OF_IMAGE = 0x9000;

test("CR-01 / MCP-04: both read verbs return the SAME {available:false} verdict for an out-of-image address", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "tiny.prg", TINY_PRG);

      const disasm = await runAnnoTool("anno_disassemble", { store, image, address: OUT_OF_IMAGE });
      const region = await runAnnoTool("anno_read_region", { store, image, start_address: OUT_OF_IMAGE, end_address: OUT_OF_IMAGE + 16 });

      for (const [name, result] of [
        ["anno_disassemble", disasm],
        ["anno_read_region", region],
      ] as const) {
        assert.equal(result.isError, false, `${name}: a well-formed question this image cannot answer is not a caller error -- ${result.content[0]!.text}`);
        const verdict = (await body(result)) as { available?: boolean; reason?: string };
        assert.equal(verdict.available, false, `${name} must report the address as unanswerable, exactly as its sibling verb does`);
        assert.equal(typeof verdict.reason, "string", `${name} must say WHY`);
        assert.ok(verdict.reason!.length >= 40, `${name}: a bare token is not a reason`);
      }
    },
  );
});

test("CR-01: the incoherent range is STRUCTURALLY absent -- an out-of-image disassemble carries no end_address and no instructions", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "tiny.prg", TINY_PRG);
      const disasm = await runAnnoTool("anno_disassemble", { store, image, address: OUT_OF_IMAGE });
      assert.equal(disasm.isError, false, disasm.content[0]!.text);
      const verdict = await body(disasm);

      // The reproduced defect was `{instructions: 0, end_address: 4099}` for
      // `address: 36864`. Asserting the KEYS are absent, not merely that the
      // numbers are sane: a range whose end is below its own start must be
      // unreachable, not unlikely.
      assert.equal("end_address" in verdict, false, "a refusal must not carry a range at all -- an end_address below the address asked about is the reported defect");
      assert.equal("instructions" in verdict, false, "a refusal must not carry an instruction COUNT -- zero reads as a measurement");
      assert.equal("listing" in verdict, false, "and it must not carry an empty listing either");
    },
  );
});

test("CR-01: an inverted span is refused IDENTICALLY by both verbs, and the one no validator can catch is caught by sliceSpan()", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "tiny.prg", TINY_PRG);

      // FIRST LAYER. When the caller NAMES an end below the start, the shared
      // range-shape validator in anno-types.ts refuses it for both verbs
      // before any byte is indexed. That is a caller error, not an
      // unanswerable question, and both verbs report it the same way -- the
      // agreement CR-01 is about holds at this layer too.
      const disasm = await runAnnoTool("anno_disassemble", { store, image, address: "$1003", end_address: "$1001" });
      const region = await runAnnoTool("anno_read_region", { store, image, start_address: "$1003", end_address: "$1001" });
      for (const [name, result] of [
        ["anno_disassemble", disasm],
        ["anno_read_region", region],
      ] as const) {
        assert.equal(result.isError, true, `${name} must refuse a transposed range, never serve it as a zero-length success`);
        assert.match(result.content[0]!.text, /\[AnnoRangeShapeError\]/, `${name} must refuse it BY NAME through the shared validator`);
        assert.match(result.content[0]!.text, /is below start/);
      }

      // SECOND LAYER, and the one that actually bit. An OMITTED end_address is
      // derived from the image's own last address, so no caller named it and
      // no argument validator can see it -- yet for a start past the image
      // that derived end lands BELOW the start. Both of sliceSpan()'s bound
      // checks pass for this pair (`from` is non-negative, `to` is inside the
      // body) and ONLY the inverted-span condition catches it. This is the
      // exact route the reported `{instructions:0, end_address:4099}` took.
      const derived = await runAnnoTool("anno_disassemble", { store, image, address: OUT_OF_IMAGE });
      assert.equal(derived.isError, false, derived.content[0]!.text);
      const verdict = (await body(derived)) as { available?: boolean };
      assert.equal(verdict.available, false, "sliceSpan() must be TOTAL -- an inverted span it alone can see is still refused, never subarray'd to nothing");
    },
  );
});

test("CR-01: sliceSpan()'s guard names all THREE cases, so the inverted-span condition cannot be dropped as redundant", () => {
  // Asserted over the comment-and-string-stripped source: the doc comment
  // above the function explains the third case at length, and must not be
  // what makes this check pass.
  const guard = /if\s*\(from < 0 \|\| to >= image\.body\.length \|\| from > to\) return null;/;
  assert.match(ANNO_TOOLS_CODE, guard, "sliceSpan() must guard the low bound, the high bound AND the inverted span (CR-01)");
  // And the reason is written down, or a later reader removes it as dead.
  assert.match(ANNO_TOOLS_SOURCE, /INVERTED span/, "the third case must carry its own rationale in the doc comment");
});

test("CR-01 over-refusal control: a span WHOLLY INSIDE the image still succeeds on both verbs, with a non-zero instruction count", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "tiny.prg", TINY_PRG);

      // Without this control a fix that refused EVERYTHING would pass the
      // three cases above and prove nothing.
      const disasm = await runAnnoTool("anno_disassemble", { store, image, address: "$1000", end_address: "$1003" });
      assert.equal(disasm.isError, false, disasm.content[0]!.text);
      const disasmBody = (await body(disasm)) as { available?: boolean; instructions: number; end_address: number; listing: string };
      assert.equal(disasmBody.available, undefined, "a span inside the image is answered, not refused");
      assert.ok(disasmBody.instructions > 0, "the fix must DISCRIMINATE -- a real span still decodes to real instructions");
      assert.equal(disasmBody.end_address, 0x1003);
      assert.match(disasmBody.listing, /rts/i);

      const region = await runAnnoTool("anno_read_region", { store, image, start_address: "$1000", end_address: "$1003" });
      assert.equal(region.isError, false, region.content[0]!.text);
      const regionBody = (await body(region)) as { available?: boolean; bytes: number };
      assert.equal(regionBody.available, undefined);
      assert.equal(regionBody.bytes, 4);
    },
  );
});

test("CR-01: an OMITTED end_address still defaults to the image's own bound -- removing the clamp must not remove the ergonomics", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "tiny.prg", TINY_PRG);
      const last = 0x1003;

      const disasm = await runAnnoTool("anno_disassemble", { store, image, address: "$1000" });
      assert.equal(disasm.isError, false, disasm.content[0]!.text);
      const disasmBody = (await body(disasm)) as { available?: boolean; instructions: number; end_address: number };
      assert.equal(disasmBody.available, undefined, "an omitted end is derived from the image itself and is inside it by construction");
      assert.ok(disasmBody.instructions > 0);
      assert.ok(disasmBody.end_address <= last, `an omitted end must not run past the image's last address $${last.toString(16)}`);
    },
  );
});

test("anno_get_binary_info reports the load address, origin and lengths for a real PRG, and refuses a non-PRG by name", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const info = await runAnnoTool("anno_get_binary_info", { store, image });
      assert.equal(info.isError, false, info.content[0]!.text);
      const infoBody = (await body(info)) as { kind: string; origin: number; total_bytes: number; body_bytes: number; entropy: number; likely_packed: boolean };
      assert.equal(infoBody.kind, "prg");
      assert.equal(infoBody.origin, 0xc000, "the origin is the .prg's own 2-byte little-endian load address");
      assert.equal(infoBody.total_bytes, 9);
      assert.equal(infoBody.body_bytes, 7);
      assert.equal(typeof infoBody.entropy, "number");
      assert.equal(infoBody.likely_packed, false);

      const flat = writeImage(ws, "capture.raw", new Uint8Array(65536));
      const flatInfo = await runAnnoTool("anno_get_binary_info", { store, image: flat });
      assert.equal(flatInfo.isError, false, flatInfo.content[0]!.text);
      const flatBody = (await body(flatInfo)) as { kind: string; origin: number };
      assert.equal(flatBody.kind, "flat");
      assert.equal(flatBody.origin, 0, "a flat 64K capture's origin is 0");

      // WR-07: a truncated .raw is dispatched by EXTENSION and hits
      // flatImageOrigin's named refusal, never falls through to the .prg parser
      // and gets an origin read backwards out of its own payload bytes.
      const truncated = writeImage(ws, "truncated.raw", new Uint8Array(4096));
      const truncatedInfo = await runAnnoTool("anno_get_binary_info", { store, image: truncated });
      assert.equal(truncatedInfo.isError, true);
      assert.match(truncatedInfo.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(truncatedInfo.content[0]!.text, /flat 64K capture must be exactly 65536 bytes/);

      const tooShort = writeImage(ws, "short.prg", Uint8Array.from([0x00, 0xc0]));
      const shortInfo = await runAnnoTool("anno_get_binary_info", { store, image: tooShort });
      assert.equal(shortInfo.isError, true);
      assert.match(shortInfo.content[0]!.text, /short\.prg/, "the refusal names the offending image, not only an internal function");
      assert.match(shortInfo.content[0]!.text, /at least 3 bytes/);
    },
  );
});

test("anno_get_cross_references returns the derivation module's union, and the store is byte-identical afterwards", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const typed = await runAnnoTool("anno_set_data_type", { store, image, start_address: "$c000", end_address: "$c006", data_type: "code" });
      assert.equal(typed.isError, false, typed.content[0]!.text);

      const before = readFileSync(store);
      const xrefs = await runAnnoTool("anno_get_cross_references", { store, image, address: "$c010", max_results: 10 });
      assert.equal(xrefs.isError, false, xrefs.content[0]!.text);
      const xrefBody = (await body(xrefs)) as { to: number; callers: number[]; total: number; truncated: boolean };
      assert.equal(xrefBody.to, 0xc010);
      assert.deepEqual(xrefBody.callers, [0xc000, 0xc003], "ascending and de-duplicated, unioned across the decoded code");
      assert.equal(xrefBody.total, 2);
      assert.equal(xrefBody.truncated, false);
      assert.deepEqual(readFileSync(store), before, "a derived read must write NOTHING -- a cached derivation is a second on-disk truth");

      const capped = await runAnnoTool("anno_get_cross_references", { store, image, address: "$c010", max_results: 1 });
      const cappedBody = (await body(capped)) as { returned: number; total: number; truncated: boolean };
      assert.equal(cappedBody.returned, 1);
      assert.equal(cappedBody.total, 2, "the TRUE total rides beside the truncated list, so truncation is detectable");
      assert.equal(cappedBody.truncated, true);
    },
  );
});

test("anno_search: max_results is REQUIRED with no default, and a capped answer reports the true total", async () => {
  await withStore(
    (handle) => {
      setLabel(handle, { address: 0xc000, name: "loop_one", kind: "User" });
      setLabel(handle, { address: 0xc010, name: "loop_two", kind: "User" });
      setLabel(handle, { address: 0xc020, name: "loop_three", kind: "User" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);

      const noCeiling = await runAnnoTool("anno_search", { store, image, query: "loop" });
      assert.equal(noCeiling.isError, true, "an implicit default would silently truncate a full-program pass");
      assert.match(noCeiling.content[0]!.text, /\[AnnoToolArgumentError\]/);
      assert.match(noCeiling.content[0]!.text, /"max_results" must be a positive integer/);

      const capped = await runAnnoTool("anno_search", { store, image, query: "loop", max_results: 1 });
      assert.equal(capped.isError, false, capped.content[0]!.text);
      const cappedBody = (await body(capped)) as { results: unknown[]; returned: number; total: number; truncated: boolean };
      assert.equal(cappedBody.returned, 1, "one result, because one was asked for");
      assert.equal(cappedBody.total, 3, "three matches, so the truncation is DETECTABLE rather than invisible");
      assert.equal(cappedBody.truncated, true);
    },
  );
});

test("anno_search naming a corpus this surface does not have answers {available:false, reason} in a SUCCESSFUL body, never an empty result set", async () => {
  await withStore(
    (handle) => {
      setLabel(handle, { address: 0xc000, name: "loop_one", kind: "User" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const result = await runAnnoTool("anno_search", { store, image, query: "loop", max_results: 10, search_strings: true });
      assert.equal(result.isError, false, "the request was WELL-FORMED -- an error here teaches an agent to retry what will never work");
      const refusal = (await body(result)) as { available: boolean; reason: string; unanswerable_corpora: string[]; results?: unknown };
      assert.equal(refusal.available, false);
      assert.equal(typeof refusal.reason, "string");
      assert.ok(refusal.reason.length >= 40, `a bare token is not a reason (got ${refusal.reason.length} characters)`);
      assert.deepEqual(refusal.unanswerable_corpora, ["strings"]);
      assert.equal(refusal.results, undefined, "no hit list may ride alongside -- it would read as the complete answer to the question actually asked");
    },
  );
});

test("anno_get_address_details returns the composition with its composed_from disclosure intact", async () => {
  await withStore(
    (handle) => {
      setLabel(handle, { address: 0xc010, name: "target", kind: "User" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const typed = await runAnnoTool("anno_set_data_type", { store, image, start_address: "$c000", end_address: "$c006", data_type: "code" });
      assert.equal(typed.isError, false, typed.content[0]!.text);

      const details = await runAnnoTool("anno_get_address_details", { store, image, address: "$c010" });
      assert.equal(details.isError, false, details.content[0]!.text);
      const detailsBody = (await body(details)) as {
        address: number;
        labels: { name: string }[];
        comments: unknown[];
        range: { available: boolean; reason?: string };
        crossReferences: { available: boolean; value?: { callers: number[] } };
        composed_client_side: boolean;
        composed_from: string[];
      };
      assert.equal(detailsBody.address, 0xc010);
      assert.deepEqual(detailsBody.labels.map((row) => row.name), ["target"]);
      assert.equal(detailsBody.composed_client_side, true, "a composition must never be mistaken for something the store held whole");
      assert.equal(detailsBody.composed_from.length, 4);
      assert.equal(detailsBody.crossReferences.available, true);
      assert.deepEqual(detailsBody.crossReferences.value!.callers, [0xc000, 0xc003]);
      // $c010 sits in no typed range: that component reports WHY, rather than
      // coming back as an empty object that reads like an answer.
      assert.equal(detailsBody.range.available, false);
      assert.ok((detailsBody.range.reason ?? "").length >= 40);
    },
  );
});

test("an image outside the workspace root, or absent, is refused by name -- the same containment the store path gets", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const outside = join(dirname(ws), "elsewhere.prg");
      const escaped = await runAnnoTool("anno_get_binary_info", { store, image: outside });
      assert.equal(escaped.isError, true);
      assert.match(escaped.content[0]!.text, /\[AnnoStorePathError\]/);

      const absent = await runAnnoTool("anno_get_binary_info", { store, image: join(ws, "not-here.prg") });
      assert.equal(absent.isError, true);
      assert.match(absent.content[0]!.text, /\[AnnoStorePathError\]/);
      assert.match(absent.content[0]!.text, /no image exists at/);

      const missing = await runAnnoTool("anno_get_binary_info", { store });
      assert.equal(missing.isError, true);
      assert.match(missing.content[0]!.text, /"image" must be a non-empty string/);
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 29-06 Task 3: the batch verb.
//
// The gate cases below are PORTED from `anno-tools.test.ts`'s own batch suite
// before that file is deleted, so the D-33 discipline survives the module it
// was written against. The depth-cap and empty-array cases are NEW -- the
// original validator had neither, and was safe from unbounded recursion only
// because a child-process spawn cost dominated any nesting a payload could
// carry. That cost is gone: this runs in-process.
// ---------------------------------------------------------------------------

/** Runs `assertAnnoTool("anno_batch_execute", payload)` and returns the thrown
 * error, failing if nothing was thrown. Asserting on the ERROR rather than on a
 * boolean keeps every case able to check the offending index in the message. */
function batchRefusal(payload: unknown): Error {
  try {
    assertAnnoTool("anno_batch_execute", payload);
  } catch (err) {
    return err as Error;
  }
  assert.fail("the batch must have been refused");
}

test("anno_batch_execute is advertised as the ONE sanctioned nested-argument verb, and the header says no second may join it", () => {
  const def = definitionNamed("anno_batch_execute");
  assert.ok(def, "anno_batch_execute must be in ANNO_TOOL_DEFINITIONS");
  assert.ok((def!.inputSchema.required ?? []).includes("store"));
  assert.ok((def!.inputSchema.required ?? []).includes("calls"));
  assert.match(ANNO_TOOLS_SOURCE, /ONE SANCTIONED NESTED-ARGUMENT VERB ON THIS/);
  assert.match(ANNO_TOOLS_SOURCE, /NO SECOND MAY JOIN IT/);
  assert.match(ANNO_TOOLS_SOURCE, /confused-deputy shape/);
  // The depth cap and the recursive validator are both real, exported names.
  assert.equal(ANNO_MAX_BATCH_DEPTH, 4);
  assert.equal(typeof assertAnnoBatch, "function");
});

test("the six whole-batch refusal shapes, each naming what it refused on", () => {
  const good = { name: "anno_set_label_name", arguments: { address: "$c000", name: "ok_label" } };

  // 1. A malformed payload -- "calls" is not an array. Payload-level, so there
  //    is no offending INDEX to name; the message says what it says instead.
  const notArray = batchRefusal({ store: "p.annostore", calls: "not-an-array" });
  assert.equal(notArray.name, "AnnoUncuratedToolError");
  assert.match(notArray.message, /"calls" must be an array/);
  assert.match(notArray.message, /never as an empty batch that passes through/);
  assert.match(batchRefusal({ store: "p.annostore" }).message, /"calls" must be an array/);
  assert.match(batchRefusal(undefined).message, /"calls" must be an array/);

  // 2. An EMPTY calls array -- payload-level too, and NEW here.
  const empty = batchRefusal({ store: "p.annostore", calls: [] });
  assert.equal(empty.name, "AnnoUncuratedToolError");
  assert.match(empty.message, /"calls" is an EMPTY array/);
  assert.match(empty.message, /plausible-looking zero/);

  // 3. An entry missing a string name -- refuses WHOLE, naming its index.
  const malformed = batchRefusal({ store: "p.annostore", calls: [good, { arguments: {} }] });
  assert.equal(malformed.name, "AnnoUncuratedToolError");
  assert.match(malformed.message, /calls\[1\]/);
  assert.match(malformed.message, /refused WHOLE/);
  assert.match(batchRefusal({ store: "p.annostore", calls: [42] }).message, /calls\[0\]/);

  // 4. An uncurated inner name -- refuses WHOLE, naming index AND name.
  const uncurated = batchRefusal({ store: "p.annostore", calls: [good, { name: "anno_delete_everything", arguments: {} }] });
  assert.equal(uncurated.name, "AnnoUncuratedToolError");
  assert.match(uncurated.message, /calls\[1\]/);
  assert.match(uncurated.message, /anno_delete_everything/);
  assert.match(uncurated.message, /outside the curated anno_\* tool surface/);

  // 5. An illegal label name inside an inner call -- the SAME validator the
  //    outer gate calls, refusing WHOLE and naming the index.
  const illegal = batchRefusal({
    store: "p.annostore",
    calls: [good, { name: "anno_set_label_name", arguments: { address: "$c010", name: "not a label" } }],
  });
  assert.equal(illegal.name, "AnnoToolArgumentError");
  assert.match(illegal.message, /calls\[1\]/);
  assert.match(illegal.message, /not a label/);
  assert.match(illegal.message, /never sanitized/);

  // 6. An over-cap region range inside an inner call -- likewise.
  const overCap = batchRefusal({
    store: "p.annostore",
    image: "prog.prg",
    calls: [good, { name: "anno_read_region", arguments: { start_address: 0, end_address: 4096 } }],
  });
  assert.equal(overCap.name, "AnnoRegionRangeError");
  assert.match(overCap.message, /calls\[1\]/);
  assert.match(overCap.message, /cap of 4096/);
});

test("the batch validator recurses: an uncurated name one level down still refuses the WHOLE batch", () => {
  const nested = batchRefusal({
    store: "p.annostore",
    calls: [
      {
        name: "anno_batch_execute",
        arguments: { store: "p.annostore", calls: [{ name: "anno_not_a_verb", arguments: {} }] },
      },
    ],
  });
  assert.equal(nested.name, "AnnoUncuratedToolError");
  assert.match(nested.message, /calls\[0\]/, "the refusal names the path to the offending inner call");
  assert.match(nested.message, /anno_not_a_verb/);
});

test("nesting deeper than the declared cap is refused BY NAME rather than walked (T-29-24)", () => {
  function nest(depth: number): Record<string, unknown> {
    if (depth === 0) return { store: "p.annostore", calls: [{ name: "anno_save_project", arguments: {} }] };
    return { store: "p.annostore", calls: [{ name: "anno_batch_execute", arguments: nest(depth - 1) }] };
  }
  // At the cap the payload is still walked and accepted.
  assert.doesNotThrow(() => assertAnnoTool("anno_batch_execute", nest(ANNO_MAX_BATCH_DEPTH)));

  const tooDeep = batchRefusal(nest(ANNO_MAX_BATCH_DEPTH + 1));
  assert.equal(tooDeep.name, "AnnoUncuratedToolError");
  assert.match(tooDeep.message, new RegExp(`deeper than ${ANNO_MAX_BATCH_DEPTH} levels`));
  assert.match(tooDeep.message, /refused BY NAME rather than walked/);
});

test("NOTHING executes when pre-validation refuses: the revision is unchanged and no partial write is visible", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const seeded = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "first_label" });
      assert.equal(seeded.isError, false, seeded.content[0]!.text);
      const revisionBefore = (await body(seeded)).revision as number;

      // A batch whose FIRST call is perfectly good and whose SECOND is
      // uncurated. A validator that ran per-call as it executed would have
      // committed the first write before discovering the second.
      const refused = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          { name: "anno_set_label_name", arguments: { address: "$c100", name: "would_have_landed" } },
          { name: "anno_delete_everything", arguments: {} },
        ],
      });
      assert.equal(refused.isError, true);
      assert.match(refused.content[0]!.text, /\[AnnoUncuratedToolError\]/);

      const after = await runAnnoTool("anno_save_project", { store });
      assert.equal((await body(after)).revision, revisionBefore, "the revision must not have moved -- nothing executed");
      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 50 });
      const symbolsBody = (await body(symbols)) as { symbols: { name: string }[] };
      assert.deepEqual(symbolsBody.symbols.map((row) => row.name), ["first_label"], "no partial write may be visible");
    },
  );
});

test("execution runs to COMPLETION: a three-call batch whose middle call fails returns three per-item entries, in order", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // The middle call is well-FORMED (so pre-validation passes) but fails at
      // EXECUTION: the name is already bound to a different address, which the
      // store refuses rather than rebinding.
      const bound = await runAnnoTool("anno_set_label_name", { store, address: "$c000", name: "taken_name" });
      assert.equal(bound.isError, false, bound.content[0]!.text);

      const result = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          { name: "anno_set_label_name", arguments: { address: "$c100", name: "before_the_failure" } },
          { name: "anno_set_label_name", arguments: { address: "$c200", name: "taken_name" } },
          { name: "anno_set_label_name", arguments: { address: "$c300", name: "after_the_failure" } },
        ],
      });
      assert.equal(result.isError, false, "a call that failed inside the batch is NOT a batch that should not have been sent");
      const batchBody = (await body(result)) as {
        results: { index: number; name: string; status: string; error?: string }[];
        executed: number;
        succeeded: number;
        failed: number;
        note: string;
      };
      assert.equal(batchBody.executed, 3, "the loop must have run to completion");
      assert.deepEqual(batchBody.results.map((entry) => entry.status), ["success", "error", "success"]);
      assert.deepEqual(batchBody.results.map((entry) => entry.index), [0, 1, 2]);
      assert.match(batchBody.results[1]!.error!, /\[AnnoLabelError\]/, "a per-item failure is named by CLASS, exactly as the outer boundary names one");
      assert.equal(batchBody.succeeded, 2);
      assert.equal(batchBody.failed, 1);
      assert.match(batchBody.note, /does not abort on the first failure/);

      // The third call really did land, which is what "runs to completion" is
      // for -- the failure did not cost the calls that came after it.
      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 50 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.ok(names.includes("after_the_failure"), "a call after the failing one must still have run");
    },
  );
});

test("a batch names its store ONCE and every inner call inherits it -- an inner store is overridden, never honoured", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const elsewhere = join(dirname(ws), "elsewhere.annostore");
      const result = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [{ name: "anno_set_label_name", arguments: { store: elsewhere, address: "$c000", name: "inherited" } }],
      });
      assert.equal(result.isError, false, result.content[0]!.text);
      const batchBody = (await body(result)) as { results: { status: string }[] };
      assert.equal(batchBody.results[0]!.status, "success");

      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 10 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.deepEqual(names, ["inherited"], "the write landed in the batch's own store, not the one the inner call named");
      assert.equal(existsSync(elsewhere), false, "the inner call's store was never even reached");
    },
  );
});

// ---------------------------------------------------------------------------
// CR-06 / MCP-04: THE TWO PHASES MUST AGREE ABOUT WHAT AN INNER PAYLOAD IS.
//
// Phase-one validation used to recurse on a nested entry's RAW arguments while
// phase-two execution recursed on its EFFECTIVE ones, so the documented
// top-level store inheritance was refused WHOLE at every depth -- with a
// message stating there is no ambient store to inherit, which is the opposite
// of what the tool's own description promises. `ANNO_MAX_BATCH_DEPTH`
// therefore governed a shape unreachable by the documented route: a cap with a
// negative control and no reachable POSITIVE one.
//
// Both phases now obtain an inner call's effective arguments from
// `batchArgumentsFor()`, and the cases below pin the positive control, the
// negative control, the override discipline and the recursive allow-list --
// the last two so the positive control is not paid for by weakening them.
// ---------------------------------------------------------------------------

test("CR-06 / MCP-04 positive control: a depth-1 nested batch relying on the DOCUMENTED store inheritance validates AND executes", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // The inner batch names NO store -- exactly what the description tells a
      // caller to write: "the store is named ONCE at the top level and every
      // inner call inherits it".
      const result = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          {
            name: "anno_batch_execute",
            arguments: { calls: [{ name: "anno_set_label_name", arguments: { address: "$c000", name: "nested_label" } }] },
          },
        ],
      });
      assert.equal(result.isError, false, `the documented route must not be refused whole -- ${result.content[0]!.text}`);
      const batchBody = (await body(result)) as { results: { status: string; result?: Record<string, unknown> }[]; failed: number };
      assert.equal(batchBody.failed, 0);
      assert.equal(batchBody.results[0]!.status, "success", "the inner batch must have EXECUTED, not merely validated");

      // And the write really landed, in the store named once at the top.
      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 10 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.deepEqual(names, ["nested_label"], "inheritance must reach the LEAF call, two levels down");
    },
  );
});

test("CR-06 negative control: a chain past the cap is still refused BY NAME, and nothing executes", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      // Depth is DERIVED from the cap, never hard-coded: raising the cap must
      // not silently turn this negative control into a passing positive one.
      // The top-level payload is depth 0, so `ANNO_MAX_BATCH_DEPTH + 1` nested
      // payloads put the innermost at depth ANNO_MAX_BATCH_DEPTH + 1.
      function nest(remaining: number): Record<string, unknown> {
        if (remaining === 0) {
          return { calls: [{ name: "anno_set_label_name", arguments: { address: "$c000", name: "would_have_landed" } }] };
        }
        return { calls: [{ name: "anno_batch_execute", arguments: nest(remaining - 1) }] };
      }
      const refused = await runAnnoTool("anno_batch_execute", { store, ...nest(ANNO_MAX_BATCH_DEPTH + 1) });

      assert.equal(refused.isError, true, "past the cap the payload is refused, not walked");
      assert.match(refused.content[0]!.text, /\[AnnoUncuratedToolError\]/);
      assert.match(refused.content[0]!.text, new RegExp(`deeper than ${ANNO_MAX_BATCH_DEPTH} levels`), "the refusal must NAME the cap's value");
      assert.match(refused.content[0]!.text, /refused BY NAME rather than walked/);

      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 10 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.deepEqual(names, [], "nothing may execute from a batch refused whole");
    },
  );
});

test("CR-06: an inner store is overridden by the batch's own in BOTH phases, at depth", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const elsewhere = join(dirname(ws), "elsewhere.annostore");
      // BOTH the nested batch AND its leaf call name a different store. If
      // phase one validated against `elsewhere` while phase two executed
      // against `store` (or the reverse), the two phases would be targeting
      // different stores -- which is the window propagating effective
      // arguments closes.
      const result = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          {
            name: "anno_batch_execute",
            arguments: {
              store: elsewhere,
              calls: [{ name: "anno_set_label_name", arguments: { store: elsewhere, address: "$c000", name: "inherited_at_depth" } }],
            },
          },
        ],
      });
      assert.equal(result.isError, false, result.content[0]!.text);
      const batchBody = (await body(result)) as { results: { status: string }[] };
      assert.equal(batchBody.results[0]!.status, "success");

      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 10 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.deepEqual(names, ["inherited_at_depth"], "the write must land in the batch's OWN store, never the one an inner call named");
      assert.equal(existsSync(elsewhere), false, "the store the inner calls named was never even reached");
    },
  );
});

test("CR-06: the recursive allow-list still bites -- an uncurated name TWO levels down refuses the WHOLE batch by index", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const refused = await runAnnoTool("anno_batch_execute", {
        store,
        calls: [
          { name: "anno_set_label_name", arguments: { address: "$c100", name: "would_have_landed" } },
          {
            name: "anno_batch_execute",
            arguments: {
              calls: [{ name: "anno_batch_execute", arguments: { calls: [{ name: "anno_delete_everything", arguments: {} }] } }],
            },
          },
        ],
      });
      assert.equal(refused.isError, true, "the positive control above must not have been paid for by weakening this");
      assert.match(refused.content[0]!.text, /\[AnnoUncuratedToolError\]/);
      assert.match(refused.content[0]!.text, /anno_delete_everything/);
      assert.match(refused.content[0]!.text, /refused WHOLE/);
      assert.match(refused.content[0]!.text, /calls\[0\]/, "the refusal names the index of the offending inner call");

      const symbols = await runAnnoTool("anno_get_symbols", { store, max_results: 10 });
      const names = ((await body(symbols)) as { symbols: { name: string }[] }).symbols.map((row) => row.name);
      assert.deepEqual(names, [], "the good FIRST call must not have landed -- refusal happens before anything is opened");
    },
  );
});

test("a batch of derived reads inherits the image too, and the whole batch shares ONE open/close pair", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const result = await runAnnoTool("anno_batch_execute", {
        store,
        image,
        calls: [
          { name: "anno_set_data_type", arguments: { start_address: "$c000", end_address: "$c006", data_type: "code" } },
          { name: "anno_get_cross_references", arguments: { address: "$c010", max_results: 10 } },
          { name: "anno_get_binary_info", arguments: {} },
        ],
      });
      assert.equal(result.isError, false, result.content[0]!.text);
      const batchBody = (await body(result)) as { results: { status: string; result?: Record<string, unknown> }[]; failed: number };
      assert.equal(batchBody.failed, 0);
      assert.deepEqual((batchBody.results[1]!.result as { callers: number[] }).callers, [0xc000, 0xc003]);
      assert.equal((batchBody.results[2]!.result as { origin: number }).origin, 0xc000);
      assert.equal(existsSync(`${store}-journal`), false, "the whole batch shares one open/close pair and leaves nothing behind");
    },
  );
});

// ---------------------------------------------------------------------------
// WR-01 fix: `anno_import_ghidra_export` and `anno_join_memmap` had zero
// dispatch-layer coverage in this file -- everything below reaches them
// through `runAnnoTool()`, the same never-throw boundary `vice-proxy.ts`
// registers, mirroring the pattern every other verb above already uses.
// ---------------------------------------------------------------------------

/** A minimal, hand-written Ghidra transfer file: one REFERENCES line and one
 * CONST_WRITES line (a processor-port store), matching the exact grammar
 * `parseGhidraExport()` requires (mirrors `anno-import.test.ts`'s own
 * `writeTransfer()`/`SINGLE_WRITE_EXPORT` fixtures). */
function writeGhidraTransfer(ws: string, fileName = "export.txt"): string {
  const text = ["## REFERENCES", "$0812 -> $d020 WRITE", "## REFERENCE_COUNT 1", "## CONST_WRITES", "0815 0001 34", "## CONST_WRITES_COUNT 1", ""].join(
    "\n",
  );
  const path = join(ws, fileName);
  writeFileSync(path, text, "utf8");
  return path;
}

test("WR-01: anno_import_ghidra_export succeeds through runAnnoTool(), reporting the full ImportCounts shape including constWrites (CR-01)", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const transfer = writeGhidraTransfer(ws);
      const result = await runAnnoTool("anno_import_ghidra_export", { store, export_path: transfer });
      assert.equal(result.isError, false, result.content[0]?.text);
      const importBody = (await body(result)) as {
        referencesSeen: number;
        xrefsWritten: number;
        xrefsAlreadyPresent: number;
        kindsSeenNotImported: Record<string, number>;
        transferDeleted: boolean;
        constWrites: { storeAddress: number; targetAddress: number; value: number }[];
      };
      assert.equal(importBody.referencesSeen, 1);
      assert.equal(importBody.xrefsWritten, 1);
      assert.equal(importBody.xrefsAlreadyPresent, 0);
      assert.deepEqual(importBody.kindsSeenNotImported, {});
      assert.equal(importBody.transferDeleted, true);
      assert.equal(existsSync(transfer), false, "a successful call through the dispatch layer must still delete the transfer file (IMP-02)");
      assert.deepEqual(importBody.constWrites, [{ storeAddress: 0x0815, targetAddress: 0x0001, value: 0x34 }]);
    },
  );
});

test("WR-01: anno_import_ghidra_export refuses a stale base_revision through runAnnoTool(), and writes nothing", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const transfer = writeGhidraTransfer(ws);
      const staleRevision = 999999;
      const result = await runAnnoTool("anno_import_ghidra_export", { store, export_path: transfer, base_revision: staleRevision });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /\[AnnoStoreStaleRevisionError\]/);
      assert.equal(existsSync(transfer), true, "a refused call must not delete the transfer file");

      const handle = openStore(store, { workspaceRoot: ws });
      try {
        assert.equal(listXrefs(handle).length, 0, "a refused call must write nothing");
      } finally {
        closeStore(handle);
      }
    },
  );
});

/** `dispatchJoinMemmap()`'s own return shape (`runMemmapJoin()`'s: `{ counts,
 * decisions, graphics? }`), serialized through `runAnnoTool()`'s generic
 * `JSON.stringify(await dispatch(...))` -- unlike several list-returning
 * verbs above, this body is NOT flattened. */
interface JoinMemmapBody {
  counts: {
    addressesConsidered: number;
    annotated: number;
    skippedInImage: number;
    skippedNoMapEntry: number;
    declined: number;
    commentsChanged: number;
    graphicsRangesWritten: number;
    graphicsContradictedComments: number;
    graphicsReinterpretedSplitTables: number;
  };
  decisions: { address: number; outcome: string; reason?: string; label?: string }[];
}

test("WR-01: anno_join_memmap succeeds through runAnnoTool(), reporting the full JoinCounts/decisions shape, and omitting const_writes is a no-op (CR-01)", async () => {
  await withStore(
    (handle) => {
      putXref(handle, { fromAddress: 0x0815, toAddress: 0xd020, accessKind: "WRITE" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);

      const unconstrained = await runAnnoTool("anno_join_memmap", { store, image });
      assert.equal(unconstrained.isError, false, unconstrained.content[0]?.text);
      const unconstrainedBody = (await body(unconstrained)) as unknown as JoinMemmapBody;
      assert.equal(unconstrainedBody.counts.addressesConsidered, 1);
      assert.equal(
        unconstrainedBody.counts.annotated,
        1,
        "omitting const_writes must resolve exactly as before this argument existed -- unconstrained annotation",
      );
      assert.equal(unconstrainedBody.counts.declined, 0);
      assert.equal(unconstrainedBody.counts.graphicsRangesWritten, 0);
      assert.equal(unconstrainedBody.decisions.length, 1);
      assert.equal(unconstrainedBody.decisions[0]!.address, 0xd020);
      assert.equal(unconstrainedBody.decisions[0]!.outcome, "annotated");
      assert.equal(unconstrainedBody.decisions[0]!.label, "Border color (only bits #0-#3)");
    },
  );
});

test("WR-01: anno_join_memmap's const_writes argument reaches runMemmapJoin() through the dispatch layer -- an all-RAM processor-port value ($34) changes $d020's own label away from border colour (CR-01)", async () => {
  await withStore(
    (handle) => {
      putXref(handle, { fromAddress: 0x0815, toAddress: 0xd020, accessKind: "WRITE" });
    },
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const constrained = await runAnnoTool("anno_join_memmap", {
        store,
        image,
        const_writes: [{ store_address: 0x0815, target_address: 0x0001, value: 0x34 }],
      });
      assert.equal(constrained.isError, false, constrained.content[0]?.text);
      const constrainedBody = (await body(constrained)) as unknown as JoinMemmapBody;
      const decision = constrainedBody.decisions.find((d) => d.address === 0xd020);
      assert.ok(decision, "expected a decision for $d020");
      // $34 decodes to all-RAM at the I/O range (anno-bank.test.ts's own
      // real-capture case): $d020 is annotated, but NEVER as the border
      // colour -- proving const_writes reached runMemmapJoin(), not merely
      // validated and dropped, since the PREVIOUS test (same store shape,
      // const_writes omitted) reports the border-colour label for the same
      // address.
      assert.equal(decision!.outcome, "annotated");
      assert.notEqual(
        decision!.label,
        "Border color (only bits #0-#3)",
        "supplying const_writes must change $d020's own label away from the unconstrained border-colour annotation",
      );
    },
  );
});

test("WR-01: anno_join_memmap refuses a malformed const_writes element by name, through runAnnoTool()", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const result = await runAnnoTool("anno_join_memmap", {
        store,
        image,
        const_writes: [{ store_address: "not-a-number", target_address: 1, value: 1 }],
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /const_writes\[0\]\.store_address/);
    },
  );
});

test("WR-01: anno_join_memmap refuses a stale base_revision through runAnnoTool(), and writes nothing", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const image = writeImage(ws, "prog.prg", TWO_CALLERS_PRG);
      const handle = openStore(store, { workspaceRoot: ws });
      const rev = currentRevision(handle);
      closeStore(handle);

      const result = await runAnnoTool("anno_join_memmap", { store, image, base_revision: rev + 1 });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /\[AnnoStoreStaleRevisionError\]/);

      const reopened = openStore(store, { workspaceRoot: ws });
      try {
        assert.equal(listComments(reopened).length, 0, "a refused join must write no comment");
      } finally {
        closeStore(reopened);
      }
    },
  );
});

test("WR-01: anno_join_memmap's loadImage() error paths -- a missing image and a non-image file -- are reached and named through runAnnoTool()", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const missing = await runAnnoTool("anno_join_memmap", { store, image: join(ws, "not-here.prg") });
      assert.equal(missing.isError, true);
      assert.match(missing.content[0]!.text, /\[AnnoStorePathError\]/);
      assert.match(missing.content[0]!.text, /not-here\.prg/);

      const notAnImage = writeImage(ws, "tiny.prg", Uint8Array.from([0x00, 0xc0]));
      const wrongShape = await runAnnoTool("anno_join_memmap", { store, image: notAnImage });
      assert.equal(wrongShape.isError, true);
      assert.match(wrongShape.content[0]!.text, /\[AnnoToolArgumentError\]/);
    },
  );
});

// ---------------------------------------------------------------------------
// Plan 43-05 Task 2: anno_evid_ingest -- registered through the existing
// anno loop, writing the rows through evid-ingest.ts's pure transform.
// ---------------------------------------------------------------------------

const VALID_SHA = "b".repeat(64);

/** Assembles a well-formed memmapshow reply text from a small, explicit set
 * of entries -- exactly the wire shape `parseAccessMap()` decodes (header
 * line, then "aaaa: xxx xxx xxx" data lines). Every glyph group defaults to
 * "---" (no access at all) so a test only has to name the banks it cares
 * about. */
function memmapReplyText(entries: { address: number; io?: string; rom?: string; ram?: string }[]): string {
  const lines = ["addr: IO  ROM RAM"];
  for (const e of entries) {
    const addr = e.address.toString(16).padStart(4, "0");
    lines.push(`${addr}: ${e.io ?? "---"} ${e.rom ?? "---"} ${e.ram ?? "---"}`);
  }
  return lines.join("\n");
}

const SAMPLE_EVID_REPLY = memmapReplyText([
  { address: 0x1000, ram: "--x" },
  { address: 0x2000, rom: "r-x" },
  { address: 0x3000, io: "-w-" }, // no execute -- must NOT produce a row
]);

test("Task 2 Test 1: anno_evid_ingest writes one row per observed execute bit and reports changed:true with observationsWritten and a denominator", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const result = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: SAMPLE_EVID_REPLY,
        image_sha256: VALID_SHA,
        argv: ["x64sc", "-binarymonitor"],
        seed: "seed-1",
      });
      assert.equal(result.isError, false, result.content[0]?.text);
      const b = await body(result);
      assert.equal(b.changed, true);
      assert.equal(b.observationsWritten, 2, "only the two entries carrying an execute bit may produce a row");
      assert.equal(typeof b.denominator, "number");
      assert.equal(b.denominator, b.addressesQueried, "denominator must be the same value as addressesQueried");
      assert.equal(b.addressesWithRecordedAccess, 3);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        const rows = listExecObservations(handle);
        assert.equal(rows.length, 2);
        assert.deepEqual(
          rows.map((r) => `${r.address}:${r.sourceBank}`).sort(),
          ["4096:ram", "8192:rom"],
        );
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("Task 2 Test 2: an identical repeat reports changed:false and observationsWritten:0, with the row count unchanged", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const args = { store, memmap_text: SAMPLE_EVID_REPLY, image_sha256: VALID_SHA, argv: ["x64sc"], seed: "seed-1" };
      const first = await runAnnoTool("anno_evid_ingest", args);
      assert.equal(first.isError, false, first.content[0]?.text);

      const second = await runAnnoTool("anno_evid_ingest", args);
      assert.equal(second.isError, false, second.content[0]?.text);
      const secondBody = await body(second);
      assert.equal(secondBody.changed, false);
      assert.equal(secondBody.observationsWritten, 0);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.equal(listExecObservations(handle).length, 2, "a repeated identical ingest must not double-count");
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("Task 2 Test 3: a store path that does not exist refuses by name with the never-create message, and creates no file", async () => {
  await withStore(
    () => {},
    async (ws) => {
      const absent = join(ws, "not-here.annostore");
      const result = await runAnnoTool("anno_evid_ingest", {
        store: absent,
        memmap_text: SAMPLE_EVID_REPLY,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-1",
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /no annotation store exists/);
      assert.equal(existsSync(absent), false, "a write verb must never CREATE the store it was asked to annotate");
    },
  );
});

test("Task 2 Test 4: a malformed memmap_text refuses naming the refusal code and the offending line, and writes nothing", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const result = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: "addr: IO  ROM RAM\nnot-a-valid-line",
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-1",
      });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /malformed-line/);
      assert.match(result.content[0]!.text, /line 2/);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.equal(listExecObservations(handle).length, 0);
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("Task 2 Test 5: an empty argv, a non-array argv, a bad image_sha256, and an absent store each refuse naming the offending argument, and none writes", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const base = { store, memmap_text: SAMPLE_EVID_REPLY, image_sha256: VALID_SHA, argv: ["x64sc"], seed: "seed-1" };

      const emptyArgv = await runAnnoTool("anno_evid_ingest", { ...base, argv: [] });
      assert.equal(emptyArgv.isError, true);
      assert.match(emptyArgv.content[0]!.text, /"argv"/);

      const nonArrayArgv = await runAnnoTool("anno_evid_ingest", { ...base, argv: "x64sc" });
      assert.equal(nonArrayArgv.isError, true);
      assert.match(nonArrayArgv.content[0]!.text, /"argv"/);

      const badSha = await runAnnoTool("anno_evid_ingest", { ...base, image_sha256: "not-a-digest" });
      assert.equal(badSha.isError, true);
      assert.match(badSha.content[0]!.text, /"image_sha256"/);

      const noStore = await runAnnoTool("anno_evid_ingest", {
        memmap_text: SAMPLE_EVID_REPLY,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-1",
      });
      assert.equal(noStore.isError, true);
      assert.match(noStore.content[0]!.text, /"store"/);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.equal(listExecObservations(handle).length, 0, "none of the four refusals may write anything");
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("Task 2 Test 6: anno_evid_ingest is curated (derived from ANNO_TOOL_DEFINITIONS) and is NOT in READ_ONLY_ANNO_VERBS -- it takes the existence-check-plus-inode-guard route", () => {
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_evid_ingest"));
  assert.equal(READ_ONLY_ANNO_VERBS.includes("anno_evid_ingest"), false);
});

test("Task 2 Test 7: runAnnoTool resolves rather than rejects on every anno_evid_ingest failure mode", async () => {
  const cases: unknown[] = [
    {},
    { store: "irrelevant.annostore" },
    { store: "irrelevant.annostore", memmap_text: "", image_sha256: VALID_SHA, argv: ["x64sc"], seed: "s" },
    { store: "irrelevant.annostore", memmap_text: SAMPLE_EVID_REPLY, image_sha256: "bad", argv: ["x64sc"], seed: "s" },
  ];
  for (const args of cases) {
    await assert.doesNotReject(async () => runAnnoTool("anno_evid_ingest", args));
  }
});

// ---------------------------------------------------------------------------
// Plan 43-05 Task 3: absence proven both directions, the block table
// untouched, a real inode race, two coexisting run identities, and the two
// address-space extremes.
// ---------------------------------------------------------------------------

test("Task 3 Test 1 (fused planting, both directions): read+write with no execute leaves listExecObservations empty, and the SAME address with execute produces exactly one row", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const noExecuteReply = memmapReplyText([{ address: 0x4000, ram: "rw-" }]);
      const noExecuteResult = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: noExecuteReply,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-a",
      });
      assert.equal(noExecuteResult.isError, false, noExecuteResult.content[0]?.text);
      {
        const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
        try {
          assert.deepEqual(listExecObservations(handle), [], "read+write access with no execute must produce NO row");
        } finally {
          closeStore(handle);
        }
      }

      const executeReply = memmapReplyText([{ address: 0x4000, ram: "--x" }]);
      const executeResult = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: executeReply,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-a",
      });
      assert.equal(executeResult.isError, false, executeResult.content[0]?.text);
      {
        const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
        try {
          const rows = listExecObservations(handle);
          assert.equal(rows.length, 1, "the SAME address observed executing must produce exactly one row");
          assert.equal(rows[0]!.address, 0x4000);
          assert.equal(rows[0]!.sourceBank, "ram");
        } finally {
          closeStore(handle);
        }
      }
    },
  );
});

test("Task 3 Test 2: an ingest never touches the byte-derived block table -- listRanges is deep-equal before and after", async () => {
  await withStore(
    (handle) => {
      setDataType(handle, { start: 0xc000, endInclusive: 0xc0ff, dataType: "code" });
    },
    async (ws, store) => {
      const before = openStore(store, { workspaceRoot: ws, mustExist: true });
      let rangesBefore;
      try {
        rangesBefore = listRanges(before);
      } finally {
        closeStore(before);
      }

      const reply = memmapReplyText([{ address: 0x4100, ram: "--x" }]);
      const result = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: reply,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-b",
      });
      assert.equal(result.isError, false, result.content[0]?.text);

      const after = openStore(store, { workspaceRoot: ws, mustExist: true });
      let rangesAfter;
      try {
        rangesAfter = listRanges(after);
      } finally {
        closeStore(after);
      }
      assert.deepEqual(
        rangesAfter,
        rangesBefore,
        "an observation must never overwrite, mutate or re-type a row of the byte-derived block table",
      );
    },
  );
});

test("Task 3 Test 3: the store file replaced between the existence check and the open refuses by name, writing nothing", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      // A second, valid, EMPTY store the racer swaps in repeatedly -- same
      // shape as `store` but a fresh inode every swap, so the guard's own
      // inode comparison has something real to catch.
      const decoy = join(ws, "decoy.annostore");
      const decoyHandle = openStore(decoy, { workspaceRoot: ws });
      closeStore(decoyHandle);

      const racerFile = join(ws, "racer.mjs");
      writeFileSync(
        racerFile,
        [
          'import { copyFileSync, renameSync } from "node:fs";',
          "const storePath = process.argv[2];",
          "const decoyPath = process.argv[3];",
          'const scratch = storePath + ".racer-scratch";',
          "const deadline = Date.now() + 5000;",
          "while (Date.now() < deadline) {",
          "  try {",
          "    copyFileSync(decoyPath, scratch);",
          "    renameSync(scratch, storePath);",
          "  } catch {}",
          "}",
        ].join("\n"),
      );
      const child = fork(racerFile, [store, decoy], { stdio: "ignore" });
      try {
        let refused = false;
        const deadline = Date.now() + 5000;
        while (!refused && Date.now() < deadline) {
          const result = await runAnnoTool("anno_evid_ingest", {
            store,
            memmap_text: SAMPLE_EVID_REPLY,
            image_sha256: VALID_SHA,
            argv: ["x64sc"],
            seed: "seed-race",
          });
          if (result.isError && /was replaced between the existence check and the open/.test(result.content[0]!.text)) {
            refused = true;
          }
        }
        assert.ok(
          refused,
          "expected at least one call, against a store under continuous replacement, to observe the inode mismatch and refuse",
        );
      } finally {
        child.kill();
      }
    },
  );
});

test("Task 3 Test 4: two different run identities coexist, and neither's filtered rows leak into the other's", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const replyA = memmapReplyText([{ address: 0x5000, ram: "--x" }]);
      const replyB = memmapReplyText([{ address: 0x6000, ram: "--x" }]);
      const a = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: replyA,
        image_sha256: VALID_SHA,
        argv: ["x64sc", "run-a"],
        seed: "seed-a",
      });
      assert.equal(a.isError, false, a.content[0]?.text);
      const b = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: replyB,
        image_sha256: VALID_SHA,
        argv: ["x64sc", "run-b"],
        seed: "seed-b",
      });
      assert.equal(b.isError, false, b.content[0]?.text);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        assert.equal(listExecObservations(handle).length, 2);
        const digestA = argvDigest(["x64sc", "run-a"]);
        const digestB = argvDigest(["x64sc", "run-b"]);
        const rowsA = listExecObservations(handle, { imageSha256: VALID_SHA, argvDigest: digestA, seed: "seed-a" });
        const rowsB = listExecObservations(handle, { imageSha256: VALID_SHA, argvDigest: digestB, seed: "seed-b" });
        assert.deepEqual(rowsA.map((r) => r.address), [0x5000]);
        assert.deepEqual(rowsB.map((r) => r.address), [0x6000]);
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("Task 3 Test 5: 0x0000 and 0xffff each ingest to exactly one row -- neither extreme is special-cased into a falsy hole", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const reply = memmapReplyText([
        { address: 0x0000, ram: "--x" },
        { address: 0xffff, io: "--x" },
      ]);
      const result = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: reply,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-c",
      });
      assert.equal(result.isError, false, result.content[0]?.text);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        const rows = listExecObservations(handle);
        assert.equal(rows.length, 2);
        assert.deepEqual(
          rows.map((r) => r.address).sort((x, y) => x - y),
          [0x0000, 0xffff],
        );
      } finally {
        closeStore(handle);
      }
    },
  );
});

// ---------------------------------------------------------------------------
// Task 3 Test 6 (opt-in, live): a real memmapshow reply from genuine stock
// VICE, dialed through the same withTextTool()/textConnect() seam
// vice_memmap_show uses, ingested by anno_evid_ingest.
// ---------------------------------------------------------------------------

const VICE_LIVE_STOCK_BIN_ENV = process.env.VICE_LIVE_STOCK_BIN;
const EVID_LIVE_SKIP_REASON: string | false = !VICE_LIVE_STOCK_BIN_ENV
  ? "anno-tools.test.ts's live anno_evid_ingest case is opt-in and default-skipped -- set VICE_LIVE_STOCK_BIN=/usr/bin/x64sc " +
    '(a real, genuinely unpatched stock VICE binary\'s absolute path) to run it. A bare "x64sc" on PATH resolves to the fork build.'
  : !existsSync(VICE_LIVE_STOCK_BIN_ENV)
    ? `VICE_LIVE_STOCK_BIN="${VICE_LIVE_STOCK_BIN_ENV}" does not exist on disk -- opt-in requires a real stock VICE binary at that absolute path.`
    : false;

const EVID_LIVE_BROKER_CONTROL = {
  claimMonitor: async () => ({ ok: true as const }),
  releaseMonitor: async () => ({ ok: true as const }),
} as unknown as BrokerControlSession;

async function evidFreeEphemeralPort(): Promise<number> {
  const { createServer } = await import("node:net");
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address();
      const port = typeof address === "object" && address ? address.port : null;
      srv.close(() => {
        if (port === null) reject(new Error("evidFreeEphemeralPort: could not read an ephemeral port from address()"));
        else resolve(port);
      });
    });
  });
}

function evidWaitForPortOpen(host: string, port: number, deadlineMs: number): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  return new Promise((resolveOuter) => {
    const attempt = () => {
      const socket = netConnect({ host, port });
      socket.once("connect", () => {
        socket.destroy();
        resolveOuter(true);
      });
      socket.once("error", () => {
        socket.destroy();
        if (Date.now() >= deadline) resolveOuter(false);
        else setTimeout(attempt, 200);
      });
    };
    attempt();
  });
}

test(
  "Task 3 Test 6 (opt-in, live): a real memmapshow reply from genuine stock VICE is ingested by anno_evid_ingest, producing 0 < rowCount <= addressesQueried",
  { skip: EVID_LIVE_SKIP_REASON, timeout: 60000 },
  async () => {
    const binPath = VICE_LIVE_STOCK_BIN_ENV as string;
    const binPort = await evidFreeEphemeralPort();
    const textPort = await evidFreeEphemeralPort();
    const scratchDir = mkdtempSync(join(tmpdir(), "evid-ingest-live-"));
    let annoWs = "";
    const child = spawn(
      binPath,
      [
        "-default",
        "-binarymonitor",
        "-binarymonitoraddress",
        `ip4://127.0.0.1:${binPort}`,
        "-remotemonitor",
        "-remotemonitoraddress",
        `ip4://127.0.0.1:${textPort}`,
      ],
      { stdio: "ignore", env: { ...process.env, XDG_CONFIG_HOME: scratchDir } },
    );
    child.once("error", (err) => {
      console.error(`anno-tools.test.ts (evid-ingest live): spawned emulator process error: ${String(err)}`);
    });

    try {
      const ready = await evidWaitForPortOpen("127.0.0.1", textPort, 10000);
      assert.ok(ready, "expected the text-monitor port to accept connections within 10s");

      const deps: StockDispatchDeps = {
        ensureLease: async () => ({
          ok: true,
          lease: {
            host: "127.0.0.1",
            port: binPort,
            targetId: "anno-tools-evid-ingest-live",
            brokerControl: EVID_LIVE_BROKER_CONTROL,
            epochFile: "",
            supervisorDir: "",
            remoteMonitorPort: textPort,
          },
        }),
      };

      // Proves the real MCP-facing seam dials successfully against genuine
      // stock VICE -- dispatchStock() is the SAME entry point vice-proxy.ts
      // calls.
      const showResult = await dispatchStock("vice_memmap_show", {}, deps);
      assert.equal(showResult.isError, false, `expected vice_memmap_show to succeed: ${JSON.stringify(showResult)}`);

      // dispatchStock()'s own answer is already-parsed JSON (ranges,
      // addressesQueried, executeCounts) -- anno_evid_ingest needs the RAW
      // reply, so a second, direct text-monitor session dials the identical
      // allowlisted "memmapshow" command over the SAME stub brokerControl.
      const session = await textConnect({
        host: "127.0.0.1",
        remoteMonitorPort: textPort,
        targetId: "anno-tools-evid-ingest-live",
        brokerControl: EVID_LIVE_BROKER_CONTROL,
      });
      let rawReply: string;
      try {
        rawReply = await withTextChannelLock("anno-tools-evid-ingest-live-memmapshow", () => session.client.command("memmapshow", { timeoutMs: 30000 }));
      } finally {
        await textDisconnect(session);
      }

      const parsed = parseAccessMap(rawReply);
      assert.equal(parsed.ok, true, `expected the live memmapshow reply to parse: ${JSON.stringify(!parsed.ok ? parsed.refusal : undefined)}`);
      const ranges = parsed.ok ? accessMapRanges(parsed.value) : undefined;
      const addressesQueried = ranges?.addressesQueried ?? 0;
      const expectedObservations = parsed.ok ? execObservationsFrom(parsed.value).length : 0;

      annoWs = mkdtempSync(join(tmpdir(), "evid-ingest-live-store-"));
      const store = join(annoWs, "project.annostore");
      const seedHandle = openStore(store, { workspaceRoot: annoWs });
      closeStore(seedHandle);

      // runAnnoTool() resolves the store path against repoRoot(), which
      // reads CLAUDE_PROJECT_DIR -- pointed at the scratch workspace for the
      // duration of this one call and restored unconditionally, mirroring
      // withStore()'s own discipline exactly.
      const previousProjectDir = process.env.CLAUDE_PROJECT_DIR;
      let result;
      try {
        process.env.CLAUDE_PROJECT_DIR = annoWs;
        result = await runAnnoTool("anno_evid_ingest", {
          store,
          memmap_text: rawReply,
          image_sha256: VALID_SHA,
          argv: [binPath, "-default", "-binarymonitor", "-remotemonitor"],
          seed: "evid-ingest-live-seed",
        });
      } finally {
        if (previousProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
        else process.env.CLAUDE_PROJECT_DIR = previousProjectDir;
      }
      assert.equal(result.isError, false, result.content[0]?.text);
      const b = await body(result);
      const rowCount = b.observationsWritten as number;
      // Asserted as a RELATION, never a pinned count (a real capture's exact
      // execute-bit count is not something this test may assume in advance).
      assert.ok(rowCount > 0, `expected at least one observed execute bit from a real capture, got ${rowCount}`);
      assert.ok(rowCount <= addressesQueried, `expected rowCount (${rowCount}) <= addressesQueried (${addressesQueried})`);
      assert.equal(rowCount, expectedObservations, "the dispatch layer's own count must match the pure transform's own count over the SAME reply");
    } finally {
      child.kill("SIGKILL");
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 3000);
        child.once("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
      rmSync(scratchDir, { recursive: true, force: true });
      if (annoWs) rmSync(annoWs, { recursive: true, force: true });
      let strayOutput = "";
      try {
        strayOutput = execFileSync("pgrep", ["-x", "x64sc"], { encoding: "utf8" });
      } catch {
        // pgrep exits non-zero (and prints nothing) when nothing matches --
        // that is the SUCCESS case here, not a failure to suppress.
        strayOutput = "";
      }
      assert.equal(strayOutput.trim(), "", `expected no x64sc process to survive teardown, found pids: ${strayOutput}`);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 43-06 Task 1: anno_evid_disagreements and anno_evid_runs -- the
// store-side query verbs over evid-reconcile.ts's pure join.
// ---------------------------------------------------------------------------

function rangesOf(ws: string, store: string): ReturnType<typeof listRanges> {
  const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
  try {
    return listRanges(handle);
  } finally {
    closeStore(handle);
  }
}

test(
  "tracer (EVID-03/EVID-04): a planted disagreement is written, ingested and asked for through anno_evid_disagreements, " +
    "answered disagreement-first with agreement as a count, and the block table is proven unchanged by the query",
  async () => {
    await withStore(
      (handle) => {
        // "byte" maps to the neutral "data" class through block-class.ts's
        // fallthrough -- the store's own twelve-member vocabulary has no
        // literal "data" spelling; every non-code, non-undefined spelling
        // becomes "data".
        setDataType(handle, { start: 0x4000, endInclusive: 0x4000, dataType: "byte" });
      },
      async (ws, store) => {
        const rangesBefore = rangesOf(ws, store);

        const ingestResult = await runAnnoTool("anno_evid_ingest", {
          store,
          memmap_text: memmapReplyText([{ address: 0x4000, ram: "--x" }]),
          image_sha256: VALID_SHA,
          argv: ["x64sc"],
          seed: "seed-disagree",
        });
        assert.equal(ingestResult.isError, false, ingestResult.content[0]?.text);

        const result = await runAnnoTool("anno_evid_disagreements", { store });
        assert.equal(result.isError, false, result.content[0]?.text);
        const b = await body(result);

        assert.equal(b.disagreementCount, 1);
        const disagreements = b.disagreements as { address: number; byteDerived: string; runtime: string }[];
        assert.equal(disagreements.length, 1);
        assert.equal(disagreements[0]!.address, 0x4000);
        assert.equal(disagreements[0]!.byteDerived, "data");
        assert.equal(disagreements[0]!.runtime, "code");
        assert.equal(b.agreementCount, 0);
        assert.equal(b.store, store);

        const keys = Object.keys(b);
        assert.equal(keys[0], "store");
        assert.equal(keys[1], "disagreements", "disagreements must be the FIRST key after store (EVID-03)");

        const rangesAfter = rangesOf(ws, store);
        assert.deepEqual(rangesAfter, rangesBefore, "anno_evid_disagreements must never write to the byte-derived block table");
      },
    );
  },
);

test("anno_evid_disagreements: an observation inside a code-classified block is agreementCount only -- disagreements stays empty", async () => {
  await withStore(
    (handle) => {
      setDataType(handle, { start: 0x5000, endInclusive: 0x5000, dataType: "code" });
    },
    async (ws, store) => {
      const ingestResult = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([{ address: 0x5000, ram: "--x" }]),
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-agree",
      });
      assert.equal(ingestResult.isError, false, ingestResult.content[0]?.text);

      const result = await runAnnoTool("anno_evid_disagreements", { store });
      assert.equal(result.isError, false, result.content[0]?.text);
      const b = await body(result);
      assert.equal(b.disagreementCount, 0);
      assert.deepEqual(b.disagreements, []);
      assert.equal(b.agreementCount, 1);
    },
  );
});

test("anno_evid_disagreements: max_results is OPTIONAL (unlike every other list-returning verb) and, when supplied, bounds only the disagreements array", async () => {
  await withStore(
    (handle) => {
      setDataType(handle, { start: 0x6000, endInclusive: 0x6001, dataType: "byte" });
    },
    async (_ws, store) => {
      const ingestResult = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([
          { address: 0x6000, ram: "--x" },
          { address: 0x6001, ram: "--x" },
        ]),
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-bound",
      });
      assert.equal(ingestResult.isError, false, ingestResult.content[0]?.text);

      const unbounded = await body(await runAnnoTool("anno_evid_disagreements", { store }));
      assert.equal(unbounded.disagreementCount, 2);
      assert.equal((unbounded.disagreements as unknown[]).length, 2);
      assert.equal(unbounded.truncated, false);

      const bounded = await body(await runAnnoTool("anno_evid_disagreements", { store, max_results: 1 }));
      assert.equal((bounded.disagreements as unknown[]).length, 1);
      assert.equal(bounded.matched, 2);
      assert.equal(bounded.returned, 1);
      assert.equal(bounded.truncated, true);
      // agreementCount and every other bucket are counts, never rows -- max_results
      // never touches them.
      assert.equal(bounded.disagreementCount, 2);
    },
  );
});

test("anno_evid_disagreements: a run-identity filter requires image_sha256, argv_digest AND seed together -- a partial identity refuses", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const result = await runAnnoTool("anno_evid_disagreements", { store, image_sha256: VALID_SHA });
      assert.equal(result.isError, true);
      assert.match(result.content[0]!.text, /image_sha256.*argv_digest.*seed together|argv_digest.*seed/i);
    },
  );
});

test("anno_evid_runs: reports every run identity's observation count beside a denominator, never a percentage", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const a = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([{ address: 0x7000, ram: "--x" }]),
        image_sha256: VALID_SHA,
        argv: ["x64sc", "run-a"],
        seed: "seed-a",
      });
      assert.equal(a.isError, false, a.content[0]?.text);

      const result = await runAnnoTool("anno_evid_runs", { store });
      assert.equal(result.isError, false, result.content[0]?.text);
      const b = await body(result);
      assert.equal(b.store, store);
      assert.equal(typeof b.denominator, "number");
      const runs = b.runs as { imageSha256: string; argvDigest: string; seed: string; observationCount: number }[];
      assert.equal(runs.length, 1);
      assert.equal(runs[0]!.observationCount, 1);
      assert.equal(runs[0]!.seed, "seed-a");
    },
  );
});

test("anno_evid_disagreements and anno_evid_runs are read-only (T-43-29): both appear in READ_ONLY_ANNO_VERBS", () => {
  assert.ok(READ_ONLY_ANNO_VERBS.includes("anno_evid_disagreements"));
  assert.ok(READ_ONLY_ANNO_VERBS.includes("anno_evid_runs"));
});

test("anno_evid_disagreements and anno_evid_runs are curated (derived from ANNO_TOOL_DEFINITIONS)", () => {
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_evid_disagreements"));
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_evid_runs"));
});

// ---------------------------------------------------------------------------
// Plan 43-06 Task 2: anno_evid_reset -- the store-side half of a bracket
// reset (beside plan 43-03's emulator-side vice_memmap_zap) -- plus the
// round-trip contract test over the single run-identity path.
// ---------------------------------------------------------------------------

/**
 * The run-class vocabulary this store schema ACTUALLY supports, derived from
 * `anno-types.ts`'s own exports rather than hand-typed. On the `promote`
 * branch of this project's own frame-exact-vs-instrumented A/B decision --
 * the branch not taken here -- this would be `anno-types.ts`'s own exported
 * `RUN_CLASSES` (`"frame-exact" |
 * "instrumented"`). On the `no-change` branch this project's own live A/B
 * actually selected, `anno-types.ts` exports no such array at all: there is
 * exactly ONE implicit run class -- the bare `(imageSha256, argvDigest,
 * seed)` triple, no discriminator column -- and that single-element
 * vocabulary is what this constant derives, by detecting the ABSENCE of a
 * `RUN_CLASSES` export, never by asserting a hand-invented list of possible
 * run classes of its own. If a future phase takes the `promote` branch and
 * adds `RUN_CLASSES`, this constant (and therefore the contract test below)
 * picks it up with no edit here.
 */
const RUN_CLASSES: readonly string[] = (() => {
  const maybe = (annoTypesModule as unknown as Record<string, unknown>).RUN_CLASSES;
  return Array.isArray(maybe) && maybe.length > 0 ? (maybe as string[]) : (["implicit"] as const);
})();

test("contract: every evidence row round-trips through the ONE run-identity path (runIdentityFrom/argvDigest), for every supported run class", async () => {
  assert.ok(RUN_CLASSES.length > 0, "the run-class enumeration must be non-empty -- a walk that silently covered nothing must not pass");
  let walked = 0;
  await withStore(
    () => {},
    async (_ws, store) => {
      for (const runClass of RUN_CLASSES) {
        walked++;
        const argv = ["x64sc", `run-class-${runClass}`];
        const seed = `seed-${runClass}`;
        const ingestResult = await runAnnoTool("anno_evid_ingest", {
          store,
          memmap_text: memmapReplyText([{ address: 0x8000, ram: "--x" }]),
          image_sha256: VALID_SHA,
          argv,
          seed,
        });
        assert.equal(ingestResult.isError, false, ingestResult.content[0]?.text);

        const runsResult = await runAnnoTool("anno_evid_runs", { store });
        assert.equal(runsResult.isError, false, runsResult.content[0]?.text);
        const runsBody = await body(runsResult);
        const runs = runsBody.runs as { imageSha256: string; argvDigest: string; seed: string }[];
        const match = runs.find((r) => r.imageSha256 === VALID_SHA && r.seed === seed);
        assert.ok(match, `expected anno_evid_runs to report a run for seed ${seed}`);
        assert.equal(
          match!.argvDigest,
          argvDigest(argv),
          "the run identity anno_evid_runs reports must be byte-identical to what runIdentityFrom() (via argvDigest()) computes for the same inputs",
        );

        // Clean up so the next run class's own `anno_evid_runs` read is not
        // confused by an earlier iteration's row -- anno_evid_reset itself,
        // exercised here as ordinary usage rather than as its own test.
        const reset = await runAnnoTool("anno_evid_reset", { store, image_sha256: VALID_SHA, argv, seed });
        assert.equal(reset.isError, false, reset.content[0]?.text);
      }
    },
  );
  assert.equal(walked, RUN_CLASSES.length, "a walk that silently covered nothing (or covered the wrong count) must not pass");
});

test("anno_evid_reset: reset of identity A leaves identity B's rows readable and unchanged", async () => {
  await withStore(
    () => {},
    async (ws, store) => {
      const argvA = ["x64sc", "run-a"];
      const argvB = ["x64sc", "run-b"];
      const a = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([{ address: 0x9000, ram: "--x" }]),
        image_sha256: VALID_SHA,
        argv: argvA,
        seed: "seed-a",
      });
      assert.equal(a.isError, false, a.content[0]?.text);
      const b = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([{ address: 0x9001, ram: "--x" }]),
        image_sha256: VALID_SHA,
        argv: argvB,
        seed: "seed-b",
      });
      assert.equal(b.isError, false, b.content[0]?.text);

      const bRowsBefore = (() => {
        const h = openStore(store, { workspaceRoot: ws, mustExist: true });
        try {
          return listExecObservations(h, { imageSha256: VALID_SHA, argvDigest: argvDigest(argvB), seed: "seed-b" });
        } finally {
          closeStore(h);
        }
      })();
      assert.equal(bRowsBefore.length, 1);

      const reset = await runAnnoTool("anno_evid_reset", { store, image_sha256: VALID_SHA, argv: argvA, seed: "seed-a" });
      assert.equal(reset.isError, false, reset.content[0]?.text);
      const resetBody = await body(reset);
      assert.equal(resetBody.changed, true);
      assert.equal(resetBody.observationsRemoved, 1);

      const handle = openStore(store, { workspaceRoot: ws, mustExist: true });
      try {
        const rowsA = listExecObservations(handle, { imageSha256: VALID_SHA, argvDigest: argvDigest(argvA), seed: "seed-a" });
        assert.equal(rowsA.length, 0, "identity A's rows must be gone after its own reset");
        const rowsB = listExecObservations(handle, { imageSha256: VALID_SHA, argvDigest: argvDigest(argvB), seed: "seed-b" });
        assert.deepEqual(rowsB, bRowsBefore, "identity B's rows must be untouched by resetting identity A");
      } finally {
        closeStore(handle);
      }
    },
  );
});

test("anno_evid_reset: resetting a run identity holding no observations reports changed:false and observationsRemoved:0 -- not an error", async () => {
  await withStore(
    () => {},
    async (_ws, store) => {
      const result = await runAnnoTool("anno_evid_reset", {
        store,
        image_sha256: VALID_SHA,
        argv: ["x64sc", "never-ingested"],
        seed: "seed-empty",
      });
      assert.equal(result.isError, false, result.content[0]?.text);
      const b = await body(result);
      assert.equal(b.changed, false);
      assert.equal(b.observationsRemoved, 0);
    },
  );
});

test("anno_evid_reset: never touches the byte-derived block table -- listRanges is deep-equal before and after", async () => {
  await withStore(
    (handle) => {
      setDataType(handle, { start: 0xa000, endInclusive: 0xa000, dataType: "code" });
    },
    async (ws, store) => {
      const ingestResult = await runAnnoTool("anno_evid_ingest", {
        store,
        memmap_text: memmapReplyText([{ address: 0xa000, ram: "--x" }]),
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-block-untouched",
      });
      assert.equal(ingestResult.isError, false, ingestResult.content[0]?.text);

      const rangesBefore = rangesOf(ws, store);
      const reset = await runAnnoTool("anno_evid_reset", {
        store,
        image_sha256: VALID_SHA,
        argv: ["x64sc"],
        seed: "seed-block-untouched",
      });
      assert.equal(reset.isError, false, reset.content[0]?.text);
      const rangesAfter = rangesOf(ws, store);
      assert.deepEqual(rangesAfter, rangesBefore, "anno_evid_reset must never write to the byte-derived block table");
    },
  );
});

test("anno_evid_reset is absent from READ_ONLY_ANNO_VERBS -- it writes, so it takes the existence-check-plus-inode-guard route", () => {
  assert.equal(READ_ONLY_ANNO_VERBS.includes("anno_evid_reset"), false);
  assert.ok(CURATED_ANNO_TOOLS.includes("anno_evid_reset"));
});

test("anno-tools.ts calls argvDigest() nowhere -- the digest is computed only inside evid-ingest.ts/capture-predicate.ts, so a call site here would be a second identity site", () => {
  assert.equal(
    (ANNO_TOOLS_SOURCE.match(/argvDigest\(/g) ?? []).length,
    0,
    "anno-tools.ts must reference argvDigest only as a field/property name (via runIdentityFrom()'s return value), never call the function itself",
  );
});
