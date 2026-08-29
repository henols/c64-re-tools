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
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, listComments, listLabels, openStore, setLabel } from "./anno-store.ts";
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

// ---------------------------------------------------------------------------
// Plan 29-06 Task 1: the write and stored-read verbs.
//
// `stripCommentsAndStrings` below is shared by every structural guard added in
// this plan. A single-pass character scanner and NOT a regex, for the reason
// `scripts/lib/r2000-cli-verbs.mjs:47-60` records and this repo's own
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
  for (const forbidden of ["parseInt(", "parseFloat(", "charCodeAt(", "toLowerCase()", "normalize("]) {
    assert.equal(ANNO_TOOLS_CODE.includes(forbidden), false, `${forbidden} in anno-tools.ts would be a second, divergent rule beside the store's own`);
  }
  // No second copy of the frozen twelve as an executable array. The
  // inputSchema's `enum` is documentation and its members are string literals,
  // which the stripper has already removed.
  assert.equal(/\[\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*,\s*""\s*\]/.test(ANNO_TOOLS_CODE), false, "a twelve-member literal array here would be a second data-type vocabulary");
});
