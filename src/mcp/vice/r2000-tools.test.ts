// r2000-tools.test.ts -- pins the curated r2000_* surface (D-18), the
// allow-list gate including its D-33 batch recursion, project-path
// validation (T-11-PATH-ESCAPE), and proves criterion 2 (cross-references,
// disassembly search) against a real regenerator2000 child under the D-11
// availability gate.
//
// Unit half (the bulk of this file) always runs, no binary needed -- pure
// structural assertions against R2000_TOOL_DEFINITIONS/CURATED_R2000_TOOLS/
// assertCuratedTool()/resolveStorePath(), plus a spy-binary proof that a
// smuggled batch is refused BEFORE any child process spawns.
//
// Gated half (the last test) mirrors D-11's established shape via the single
// shared r2000-test-gate.ts seam (plan 11-01) -- never a hand-rolled
// `if (!available) return`, which would report a false PASS rather than a
// SKIP.
import { test, after, type TestContext } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  R2000_TOOL_DEFINITIONS,
  CURATED_R2000_TOOLS,
  READ_ONLY_R2000_TOOLS,
  assertCuratedTool,
  resolveStorePath,
  runR2000Tool,
  R2000UncuratedToolError,
  R2000StorePathError,
  R2000LabelNameError,
  R2000ReadRegionRangeError,
  R2000_READ_REGION_MAX_BYTES,
} from "./r2000-tools.ts";
import { synthesizeProject, flatImageOrigin } from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
import { __resetR2000SessionForTest } from "./r2000-session.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// D-18, extended by SURF-01/SURF-02 (plan 18-05): the exact 19-member
// curated set, pinned by a hardcoded literal list so a name added to only
// one of CURATED_R2000_TOOLS/R2000_TOOL_DEFINITIONS (or a name lost from
// either) fails here rather than passing vacuously because the two happen
// to be derived from the same array today.
// ---------------------------------------------------------------------------

const EXPECTED_CURATED_NAMES = [
  "r2000_set_label_name",
  "r2000_set_comment",
  "r2000_set_data_type",
  "r2000_add_scope",
  "r2000_get_symbols",
  "r2000_get_comments",
  "r2000_get_blocks",
  "r2000_get_cross_references",
  "r2000_search_disassembly",
  "r2000_disassemble",
  "r2000_get_binary_info",
  "r2000_create_project_enum",
  "r2000_update_project_enum",
  "r2000_delete_project_enum",
  "r2000_apply_enum_usage",
  "r2000_save_project",
  "r2000_batch_execute",
  "r2000_read_region",
  "r2000_get_address_details",
];

// The pre-SURF-01/SURF-02 17-member ordering, kept verbatim so a future
// reorder of the ORIGINAL 17 is caught separately from a count change (task
// 1's own ordering criterion, plan 18-05).
const EXPECTED_FIRST_17_NAMES = [
  "r2000_set_label_name",
  "r2000_set_comment",
  "r2000_set_data_type",
  "r2000_add_scope",
  "r2000_get_symbols",
  "r2000_get_comments",
  "r2000_get_blocks",
  "r2000_get_cross_references",
  "r2000_search_disassembly",
  "r2000_disassemble",
  "r2000_get_binary_info",
  "r2000_create_project_enum",
  "r2000_update_project_enum",
  "r2000_delete_project_enum",
  "r2000_apply_enum_usage",
  "r2000_save_project",
  "r2000_batch_execute",
];

test("CURATED_R2000_TOOLS has exactly 19 members, matching the plan's objective table (set-equality, both directions)", () => {
  assert.equal(CURATED_R2000_TOOLS.length, 19, `expected exactly 19 curated tools, got ${CURATED_R2000_TOOLS.length}`);
  const actual = new Set(CURATED_R2000_TOOLS);
  const expected = new Set(EXPECTED_CURATED_NAMES);
  const missing = [...expected].filter((n) => !actual.has(n));
  const extra = [...actual].filter((n) => !expected.has(n));
  assert.deepEqual(missing, [], `expected curated but missing: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `curated but not in the plan's objective table (missing a criterion?): ${extra.join(", ")}`);
});

test("CURATED_R2000_TOOLS's first 17 members are unchanged, in the same order, after SURF-01/SURF-02 additions (plan 18-05)", () => {
  assert.deepEqual(
    CURATED_R2000_TOOLS.slice(0, 17),
    EXPECTED_FIRST_17_NAMES,
    "the original pre-SURF-01/SURF-02 entries must keep their exact relative order -- new entries are appended, never inserted",
  );
});

test("every CURATED_R2000_TOOLS name has a matching R2000_TOOL_DEFINITIONS entry, and vice versa", () => {
  const defNames = new Set(R2000_TOOL_DEFINITIONS.map((d) => d.name));
  for (const name of CURATED_R2000_TOOLS) {
    assert.ok(defNames.has(name), `${name} is curated but has no R2000_TOOL_DEFINITIONS entry`);
  }
  for (const def of R2000_TOOL_DEFINITIONS) {
    assert.ok(CURATED_R2000_TOOLS.includes(def.name), `${def.name} has a definition but is not in CURATED_R2000_TOOLS`);
  }
});

test("every R2000_TOOL_DEFINITIONS entry's inputSchema requires 'project' (D-19)", () => {
  for (const def of R2000_TOOL_DEFINITIONS) {
    assert.ok(
      "project" in def.inputSchema.properties,
      `${def.name}'s inputSchema does not declare a 'project' property`,
    );
    assert.ok(
      def.inputSchema.required?.includes("project"),
      `${def.name}'s inputSchema does not require 'project' -- D-19 requires an explicit path on every call`,
    );
  }
});

test("r2000_search_disassembly requires max_results explicitly (no silent 50-item default)", () => {
  const def = R2000_TOOL_DEFINITIONS.find((d) => d.name === "r2000_search_disassembly");
  assert.ok(def, "r2000_search_disassembly must be a curated tool");
  assert.ok(def!.inputSchema.required?.includes("max_results"), "max_results must be required on this surface");
});

test("r2000_save_project's inputSchema has exactly one property: project", () => {
  const def = R2000_TOOL_DEFINITIONS.find((d) => d.name === "r2000_save_project");
  assert.ok(def, "r2000_save_project must be a curated tool");
  assert.deepEqual(Object.keys(def!.inputSchema.properties), ["project"]);
});

// ---------------------------------------------------------------------------
// D-36 (superseding D-32, plan 18-05): r2000_get_address_details is CURATED
// as a client-side composition -- assertCuratedTool() no longer refuses it
// by name.
// ---------------------------------------------------------------------------

test("assertCuratedTool no longer refuses r2000_get_address_details (D-36 supersedes D-32's exclusion; it is now curated)", () => {
  assert.doesNotThrow(() => assertCuratedTool("r2000_get_address_details", { project: "x.regen2000proj", address: 4096 }));
  assert.ok(CURATED_R2000_TOOLS.includes("r2000_get_address_details"));
});

test("r2000_batch_execute with r2000_get_address_details as an inner name is no longer refused for that reason (it is now curated); an uncurated inner name is still refused whole", () => {
  assert.doesNotThrow(() =>
    assertCuratedTool("r2000_batch_execute", {
      calls: [{ name: "r2000_get_address_details", arguments: { address: 4096 } }],
    }),
  );
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [{ name: "r2000_undo", arguments: {} }],
      }),
    R2000UncuratedToolError,
  );
});

test("r2000_get_address_details's description states its composed, client-side, never-calls-upstream nature and cites the upstream issue", () => {
  const def = R2000_TOOL_DEFINITIONS.find((d) => d.name === "r2000_get_address_details");
  assert.ok(def, "r2000_get_address_details must be a curated tool");
  assert.match(def!.description, /composed/i);
  assert.match(def!.description, /client-side|client side/i);
  assert.match(def!.description, /issues\/42/);
  assert.deepEqual(def!.inputSchema.required, ["project", "address"]);
});

test("READ_ONLY_R2000_TOOLS has exactly 7 members and deliberately excludes r2000_get_address_details (its dispatch is read-only by construction but never reaches this generic branch)", () => {
  assert.equal(READ_ONLY_R2000_TOOLS.size, 7, `expected exactly 7 members, got ${READ_ONLY_R2000_TOOLS.size}`);
  assert.ok(
    !READ_ONLY_R2000_TOOLS.has("r2000_get_address_details"),
    "r2000_get_address_details is dispatched via its own runR2000Tool() special case (composeAddressDetails), never via the generic READ_ONLY_R2000_TOOLS branch -- membership here would document a code path that does not exist",
  );
});

test("SURF-02 (D18-27/D18-28): r2000_get_address_details never appears as a literal tool-name argument to call( in r2000-tools.ts (source-structural)", () => {
  const rawSource = readFileSync(join(HERE, "r2000-tools.ts"), "utf8");
  // Comment-strip only (never string-strip): the literal we are looking FOR
  // is itself a string, so blanking string content would make it
  // unobservable. codeOnly()-style full stripping is the right tool when a
  // check must ignore ALL string content (r2000-spawn-seam.test.ts's own
  // spawn-site scan); here the opposite is true -- we must inspect exactly
  // the literal call() receives, and comment-stripping alone is sufficient
  // to keep a doc-comment mention of "call(...)" from producing a false
  // positive, since no comment in this file contains that exact adjacency.
  const codeOnly = rawSource.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  const callLiteralRe = /\bcall\(\s*(["'`])((?:\\.|(?!\1).)*)\1/g;
  const literalNames: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = callLiteralRe.exec(codeOnly)) !== null) {
    literalNames.push(m[2]);
  }
  assert.ok(
    literalNames.length > 0,
    "non-vacuity: expected at least one call( invocation with a literal tool-name argument (e.g. r2000_save_project) -- if this is empty, the scan regex itself is broken",
  );
  assert.ok(
    !literalNames.includes("r2000_get_address_details"),
    `call( must never receive "r2000_get_address_details" as a literal tool-name argument -- found among: ${literalNames.join(", ")}`,
  );
});

test("assertCuratedTool refuses any name outside CURATED_R2000_TOOLS with a resolution-route message", () => {
  assert.throws(
    () => assertCuratedTool("r2000_unpack_binary"),
    (err: unknown) => {
      assert.ok(err instanceof R2000UncuratedToolError);
      assert.match((err as Error).message, /not part of the curated/);
      return true;
    },
  );
});

test("assertCuratedTool accepts every curated name with no args", () => {
  for (const name of CURATED_R2000_TOOLS) {
    if (name === "r2000_batch_execute") continue; // covered separately below
    assert.doesNotThrow(() => assertCuratedTool(name));
  }
});

// ---------------------------------------------------------------------------
// D-33: the batch gate. Refuses the whole batch when ANY inner name is
// outside the curated set, treats a malformed `calls` payload as a refusal
// (never an empty batch that passes through), and recurses into a nested
// batch.
// ---------------------------------------------------------------------------

test("assertCuratedTool accepts a batch whose every inner name is curated", () => {
  assert.doesNotThrow(() =>
    assertCuratedTool("r2000_batch_execute", {
      calls: [
        { name: "r2000_set_label_name", arguments: { address: 1, name: "x" } },
        { name: "r2000_get_symbols", arguments: {} },
      ],
    }),
  );
});

test("assertCuratedTool refuses a batch containing one uncurated inner name, naming it and its index", () => {
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [
          { name: "r2000_set_label_name", arguments: { address: 4096, name: "entry" } },
          { name: "r2000_unpack_binary", arguments: {} },
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof R2000UncuratedToolError);
      assert.equal((err as R2000UncuratedToolError).batchIndex, 1);
      assert.match((err as Error).message, /r2000_unpack_binary/);
      assert.match((err as Error).message, /calls\[1\]/);
      return true;
    },
  );
});

test("assertCuratedTool refuses a batch containing an inner name outside the curated set entirely", () => {
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [{ name: "r2000_undo", arguments: {} }],
      }),
    (err: unknown) => {
      assert.ok(err instanceof R2000UncuratedToolError);
      assert.equal((err as R2000UncuratedToolError).toolName, "r2000_undo");
      assert.equal((err as R2000UncuratedToolError).batchIndex, 0);
      return true;
    },
  );
});

test("assertCuratedTool treats a malformed batch payload as a refusal, never an empty batch", () => {
  assert.throws(() => assertCuratedTool("r2000_batch_execute", { calls: "not-an-array" }), R2000UncuratedToolError);
  assert.throws(() => assertCuratedTool("r2000_batch_execute", { calls: [{ arguments: {} }] }), R2000UncuratedToolError);
  assert.throws(() => assertCuratedTool("r2000_batch_execute", { calls: [42] }), R2000UncuratedToolError);
  assert.throws(() => assertCuratedTool("r2000_batch_execute", {}), R2000UncuratedToolError);
  assert.throws(() => assertCuratedTool("r2000_batch_execute", undefined), R2000UncuratedToolError);
});

test("assertCuratedTool recurses into a nested r2000_batch_execute", () => {
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [
          {
            name: "r2000_batch_execute",
            arguments: { calls: [{ name: "r2000_unpack_binary", arguments: {} }] },
          },
        ],
      }),
    R2000UncuratedToolError,
  );
});

// ---------------------------------------------------------------------------
// T-11-NAME-INJECT (route A): the label-name REJECT policy on
// r2000_set_label_name, both the outer dispatch and the batch-inner call --
// refused BEFORE any regenerator2000 child is spawned, proven here by
// calling assertCuratedTool() directly (the pre-spawn seam), the same shape
// the D-33 batch-refusal cases above already take.
// ---------------------------------------------------------------------------

const ILLEGAL_LABEL_NAMES = ["bad-name", "has space", "1BAD", "a|b", "LDA", "BAD\nNAME"];

test("assertCuratedTool refuses every illegal ACME identifier as an r2000_set_label_name name, pre-spawn", () => {
  for (const bad of ILLEGAL_LABEL_NAMES) {
    assert.throws(
      () => assertCuratedTool("r2000_set_label_name", { project: "x.regen2000proj", address: 4096, name: bad }),
      (err: unknown) => {
        assert.ok(err instanceof R2000LabelNameError, `expected R2000LabelNameError for ${JSON.stringify(bad)}`);
        assert.equal((err as R2000LabelNameError).labelName, bad);
        assert.match((err as Error).message, /not a legal ACME identifier|reserved 6502/);
        return true;
      },
    );
  }
});

test("assertCuratedTool does NOT refuse a legal r2000_set_label_name name", () => {
  assert.doesNotThrow(() =>
    assertCuratedTool("r2000_set_label_name", { project: "x.regen2000proj", address: 4096, name: "init_screen" }),
  );
});

test("assertCuratedTool refuses a batch smuggling an illegal r2000_set_label_name name, refusing the WHOLE batch and naming calls[1]", () => {
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [
          { name: "r2000_get_symbols", arguments: {} },
          { name: "r2000_set_label_name", arguments: { address: 4096, name: "bad-name" } },
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof R2000LabelNameError);
      assert.equal((err as R2000LabelNameError).batchIndex, 1);
      assert.match((err as Error).message, /bad-name/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// SURF-01 (D18-24/D18-25, plan 18-05): r2000_read_region's documented range
// cap, enforced pre-spawn by assertReadRegionArgs(), called from BOTH
// assertCuratedTool() and assertCuratedBatch() -- the same dual-call-site
// shape assertLegalLabelArg() already established above.
// ---------------------------------------------------------------------------

test("r2000_read_region is curated with the live schema {start_address, end_address, view}, required [project, start_address, end_address]", () => {
  const def = R2000_TOOL_DEFINITIONS.find((d) => d.name === "r2000_read_region");
  assert.ok(def, "r2000_read_region must be a curated tool");
  assert.deepEqual(
    Object.keys(def!.inputSchema.properties).sort(),
    ["end_address", "project", "start_address", "view"].sort(),
  );
  assert.deepEqual(def!.inputSchema.required, ["project", "start_address", "end_address"]);
  const view = def!.inputSchema.properties.view as { enum: string[] };
  assert.deepEqual(view.enum, ["disasm", "hexdump"]);
});

test("r2000_read_region is a member of READ_ONLY_R2000_TOOLS (no save issued after a read)", () => {
  assert.ok(READ_ONLY_R2000_TOOLS.has("r2000_read_region"));
});

test("assertCuratedTool refuses an r2000_read_region request one byte over R2000_READ_REGION_MAX_BYTES, naming the requested size and the valid range, before any spawn", () => {
  const start = 0;
  const end = start + R2000_READ_REGION_MAX_BYTES; // inclusive size = MAX_BYTES + 1
  assert.throws(
    () => assertCuratedTool("r2000_read_region", { project: "x.regen2000proj", start_address: start, end_address: end }),
    (err: unknown) => {
      assert.ok(err instanceof R2000ReadRegionRangeError);
      assert.equal((err as R2000ReadRegionRangeError).requestedBytes, R2000_READ_REGION_MAX_BYTES + 1);
      assert.match((err as Error).message, new RegExp(`${R2000_READ_REGION_MAX_BYTES + 1}`));
      assert.match((err as Error).message, new RegExp(`${R2000_READ_REGION_MAX_BYTES}`));
      return true;
    },
  );
});

test("assertCuratedTool accepts an r2000_read_region request whose inclusive size equals R2000_READ_REGION_MAX_BYTES exactly", () => {
  assert.doesNotThrow(() =>
    assertCuratedTool("r2000_read_region", {
      project: "x.regen2000proj",
      start_address: 0,
      end_address: R2000_READ_REGION_MAX_BYTES - 1,
    }),
  );
});

test("assertCuratedTool accepts start_address === end_address (a single address is a valid, inclusive, one-byte range)", () => {
  assert.doesNotThrow(() =>
    assertCuratedTool("r2000_read_region", { project: "x.regen2000proj", start_address: 4096, end_address: 4096 }),
  );
});

test("assertCuratedTool refuses an r2000_read_region request with end_address < start_address, naming both values", () => {
  assert.throws(
    () => assertCuratedTool("r2000_read_region", { project: "x.regen2000proj", start_address: 100, end_address: 50 }),
    (err: unknown) => {
      assert.ok(err instanceof R2000ReadRegionRangeError);
      assert.match((err as Error).message, /100/);
      assert.match((err as Error).message, /50/);
      assert.match((err as Error).message, /inverted/);
      return true;
    },
  );
});

test("assertCuratedTool refuses an r2000_read_region request with an address outside 0..65535, naming the offending value", () => {
  assert.throws(
    () => assertCuratedTool("r2000_read_region", { project: "x.regen2000proj", start_address: -1, end_address: 10 }),
    (err: unknown) => {
      assert.ok(err instanceof R2000ReadRegionRangeError);
      assert.match((err as Error).message, /-1/);
      assert.match((err as Error).message, /0\.\.65535/);
      return true;
    },
  );
  assert.throws(
    () => assertCuratedTool("r2000_read_region", { project: "x.regen2000proj", start_address: 0, end_address: 65536 }),
    R2000ReadRegionRangeError,
  );
});

test("assertReadRegionArgs is wired into BOTH assertCuratedTool() and assertCuratedBatch() (source assertion: 1 definition + 2 call sites)", () => {
  const source = readFileSync(join(HERE, "r2000-tools.ts"), "utf8");
  const occurrences = source.match(/assertReadRegionArgs\(/g) ?? [];
  assert.equal(
    occurrences.length,
    3,
    `expected exactly 3 occurrences of "assertReadRegionArgs(" (1 function definition + 2 call sites), got ${occurrences.length}`,
  );
});

test("assertCuratedTool refuses an over-cap r2000_read_region request nested inside r2000_batch_execute, refusing the WHOLE batch and naming calls[1]", () => {
  const over = R2000_READ_REGION_MAX_BYTES; // inclusive size = MAX_BYTES + 1
  assert.throws(
    () =>
      assertCuratedTool("r2000_batch_execute", {
        calls: [
          { name: "r2000_get_symbols", arguments: {} },
          { name: "r2000_read_region", arguments: { start_address: 0, end_address: over } },
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof R2000ReadRegionRangeError);
      assert.equal((err as R2000ReadRegionRangeError).batchIndex, 1);
      assert.match((err as Error).message, /calls\[1\]/);
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// The non-vacuous "zero child processes spawned" proof: point R2000_BIN at a
// spy script that records its own invocation, call runR2000Tool with a batch
// that mixes a curated and an uncurated inner name, and assert the spy was
// NEVER invoked -- the refusal happens before the dynamic import of
// r2000-mcp-client.ts ever has a chance to spawn anything.
// ---------------------------------------------------------------------------

let spyWorkDir: string | undefined;

after(() => {
  if (spyWorkDir) rmSync(spyWorkDir, { recursive: true, force: true });
});

test("runR2000Tool refuses a smuggled batch WHOLE, before any child process is spawned (counted, not reasoned)", async () => {
  spyWorkDir = mkdtempSync(join(HERE, ".r2000-tools-test-spy-"));
  const marker = join(spyWorkDir, "spawned.marker");
  const spyBin = join(spyWorkDir, "spy-r2000.mjs");
  writeFileSync(
    spyBin,
    "#!/usr/bin/env node\n" +
      "import { writeFileSync } from \"node:fs\";\n" +
      `writeFileSync(${JSON.stringify(marker)}, "spawned");\n` +
      "process.exit(1);\n",
  );
  chmodSync(spyBin, 0o755);

  const prevBin = process.env.R2000_BIN;
  process.env.R2000_BIN = spyBin;
  try {
    const projectPath = join(spyWorkDir, "smuggle-test.regen2000proj");
    await assert.rejects(
      runR2000Tool("r2000_batch_execute", {
        project: projectPath,
        calls: [
          { name: "r2000_set_label_name", arguments: { address: 4096, name: "entry" } },
          { name: "r2000_unpack_binary", arguments: {} },
        ],
      }),
      (err: unknown) => {
        assert.ok(err instanceof R2000UncuratedToolError);
        assert.match((err as Error).message, /r2000_unpack_binary/);
        assert.match((err as Error).message, /calls\[1\]/);
        return true;
      },
    );
  } finally {
    // process.env values are always strings -- assigning `undefined` directly
    // would coerce to the literal string "undefined" rather than clearing it.
    if (prevBin === undefined) delete process.env.R2000_BIN;
    else process.env.R2000_BIN = prevBin;
  }

  assert.equal(existsSync(marker), false, "the spy binary must never have been invoked -- the batch was refused before any spawn");
});

// ---------------------------------------------------------------------------
// resolveStorePath (T-11-PATH-ESCAPE)
// ---------------------------------------------------------------------------

test("resolveStorePath refuses a path escaping the workspace root (literal plan example)", () => {
  assert.throws(() => resolveStorePath("../../etc/passwd"), R2000StorePathError);
});

test("resolveStorePath refuses a path escaping the workspace root even with the right extension", () => {
  assert.throws(() => resolveStorePath("../../../etc/escape.regen2000proj"), (err: unknown) => {
    assert.ok(err instanceof R2000StorePathError);
    assert.match((err as Error).message, /outside the workspace root/);
    return true;
  });
});

test("resolveStorePath refuses a non-.regen2000proj extension", () => {
  assert.throws(() => resolveStorePath("x.txt"), (err: unknown) => {
    assert.ok(err instanceof R2000StorePathError);
    assert.match((err as Error).message, /\.regen2000proj/);
    return true;
  });
});

test("resolveStorePath refuses a non-string or empty project value", () => {
  assert.throws(() => resolveStorePath(undefined), R2000StorePathError);
  assert.throws(() => resolveStorePath(""), R2000StorePathError);
  assert.throws(() => resolveStorePath("   "), R2000StorePathError);
  assert.throws(() => resolveStorePath(42), R2000StorePathError);
});

test("resolveStorePath accepts a path under the repo root", () => {
  const resolved = resolveStorePath(join(HERE, "does-not-need-to-exist.regen2000proj"));
  assert.ok(resolved.endsWith("does-not-need-to-exist.regen2000proj"));
  assert.ok(resolved.startsWith(HERE));
});

// ---------------------------------------------------------------------------
// WR-01 / T-11-PATH-ESCAPE: parent-realpath containment. `repoRoot()`
// (branch 0) reads `env.CLAUDE_PROJECT_DIR` fresh on every call with no
// caching, so these tests swap it to a scratch temp dir per case --
// mirroring `stock-symbols.test.ts`'s own `withTempWorkspace()` shape --
// rather than planting symlinks inside this real checkout.
// ---------------------------------------------------------------------------

function withTempWorkspace<T>(fn: (dir: string, t: TestContext) => Promise<T> | T) {
  return async (t: TestContext) => {
    const dir = mkdtempSync(join(tmpdir(), "r2000-tools-test-workspace-"));
    const prev = process.env.CLAUDE_PROJECT_DIR;
    process.env.CLAUDE_PROJECT_DIR = dir;
    try {
      await fn(dir, t);
    } finally {
      if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
      else process.env.CLAUDE_PROJECT_DIR = prev;
      rmSync(dir, { recursive: true, force: true });
    }
  };
}

test(
  "resolveStorePath refuses a directory symlink escape via a not-yet-existing leaf (the audit's PoC), naming the resolved outside target",
  withTempWorkspace((dir, t) => {
    const outsideDir = mkdtempSync(join(tmpdir(), "r2000-tools-test-outside-"));
    const linkPath = join(dir, "escape-link");
    try {
      symlinkSync(outsideDir, linkPath);
    } catch (err) {
      t.skip(`symlinkSync unavailable in this environment: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      assert.throws(
        () => resolveStorePath("escape-link/pwned.regen2000proj"),
        (err: unknown) => {
          assert.ok(err instanceof R2000StorePathError);
          const escapedOutside = realpathSync(outsideDir).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          assert.match((err as Error).message, new RegExp(escapedOutside));
          return true;
        },
      );
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  }),
);

test(
  "resolveStorePath refuses the same symlink escape one level deeper, so the fix cannot pass by inspecting only the immediate parent",
  withTempWorkspace((dir, t) => {
    const outsideDir = mkdtempSync(join(tmpdir(), "r2000-tools-test-outside-deep-"));
    const linkPath = join(dir, "escape-link");
    try {
      symlinkSync(outsideDir, linkPath);
    } catch (err) {
      t.skip(`symlinkSync unavailable in this environment: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }
    try {
      assert.throws(
        () => resolveStorePath("escape-link/sub/x.regen2000proj"),
        (err: unknown) => {
          assert.ok(err instanceof R2000StorePathError);
          const escapedOutside = realpathSync(outsideDir).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          assert.match((err as Error).message, new RegExp(escapedOutside));
          return true;
        },
      );
    } finally {
      rmSync(outsideDir, { recursive: true, force: true });
    }
  }),
);

test(
  "resolveStorePath's create path still works when an intermediate directory does not exist yet either",
  withTempWorkspace((dir) => {
    const realDir = realpathSync(dir);
    const resolved = resolveStorePath("newdir/deeper/fresh.regen2000proj");
    assert.ok(resolved.startsWith(realDir + "/"), `expected "${resolved}" to be contained under "${realDir}"`);
    assert.ok(resolved.endsWith(join("newdir", "deeper", "fresh.regen2000proj")));
  }),
);

// ---------------------------------------------------------------------------
// Gated integration (D-11): criterion 2 against a real regenerator2000
// child, on a project synthesised from the committed probe-illegal.prg
// fixture (the only .prg committed anywhere in this repo -- D-31).
// ---------------------------------------------------------------------------

const SKIP_REASON: string | false = skipReasonFor("r2000-tools.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});

let liveWorkDir: string | undefined;

after(() => {
  if (liveWorkDir) rmSync(liveWorkDir, { recursive: true, force: true });
});

test(
  "gated: the curated surface answers criterion 2 against a real regenerator2000 child -- a label written in one session is read back in a FRESH session, cross-references and search both answer non-vacuously",
  { skip: SKIP_REASON },
  async () => {
    liveWorkDir = mkdtempSync(join(HERE, ".r2000-tools-test-live-"));

    const fixturePath = join(
      HERE,
      "..",
      "..",
      "..",
      ".planning",
      "phases",
      "09-the-assumption-probe-go-no-go",
      "evidence",
      "fixture",
      "probe-illegal.prg",
    );
    const prgBytes = readFileSync(fixturePath);
    const origin = prgBytes.readUInt16LE(0);
    const body = prgBytes.subarray(2);
    const projectJson = synthesizeProject(body, { origin });
    const projectPath = join(liveWorkDir, "probe.regen2000proj");
    writeFileSync(projectPath, projectJson);

    const disasm = await runR2000Tool("r2000_disassemble", { project: projectPath, address: origin });
    assert.equal(disasm.isError, false, `r2000_disassemble failed: ${JSON.stringify(disasm)}`);

    const before = await runR2000Tool("r2000_get_symbols", { project: projectPath, kind: "user" });
    assert.equal(before.isError, false, `r2000_get_symbols (before) failed: ${JSON.stringify(before)}`);
    assert.equal(JSON.parse(before.content[0]!.text).length, 0, "expected no user labels before r2000_set_label_name");

    // r2000_set_label_name is a mutating tool -- it saves internally, inside
    // the SHARED session r2000-session.ts owns (Rule A21, D-17/D-18 reversed
    // by plan 18-03), before this tool call resolves to its caller. No
    // separate r2000_save_project call is needed (or wanted here: since
    // nothing else would be pending, an immediately-following standalone
    // r2000_save_project call would correctly report an unchanged hash --
    // see r2000-tools.ts's own comment above READ_ONLY_R2000_TOOLS for why).
    const setLabel = await runR2000Tool("r2000_set_label_name", { project: projectPath, address: origin, name: "entry_point" });
    assert.equal(setLabel.isError, false, `r2000_set_label_name failed: ${JSON.stringify(setLabel)}`);

    // Under a HELD session (plan 18-03's D-17/D-18 reversal), a SECOND
    // runR2000Tool() call against the SAME project reuses the same live
    // child -- it no longer proves disk persistence by itself the way a
    // brand-new per-call child once did (that WAS this test's own reasoning
    // before plan 18-05; corrected here rather than left stale). Disk
    // persistence itself is proven independently by
    // r2000-session.test.ts's D18-09 scenario 1 (a SIGKILL delivered the
    // instant a mutating call resolves, then a straight-off-disk reread).
    // This assertion instead reads the .regen2000proj file DIRECTLY off
    // disk (readFileSync/JSON.parse), in addition to the tool call below, so
    // it proves what its own name claims rather than relying on a lifecycle
    // this phase retired.
    const onDiskAfterSave = JSON.parse(readFileSync(projectPath, "utf8")) as {
      labels?: Record<string, Array<{ name: string }>>;
    };
    const onDiskLabelsAtOrigin = onDiskAfterSave.labels?.[String(origin)] ?? [];
    assert.ok(
      onDiskLabelsAtOrigin.some((l) => l.name === "entry_point"),
      `expected entry_point to be present in the on-disk .regen2000proj file at address ${origin}, got ${JSON.stringify(onDiskAfterSave.labels)}`,
    );

    // The curated surface itself must also read it back correctly.
    const afterSave = await runR2000Tool("r2000_get_symbols", { project: projectPath, kind: "user" });
    assert.equal(afterSave.isError, false, `r2000_get_symbols (after) failed: ${JSON.stringify(afterSave)}`);
    const afterSymbols = JSON.parse(afterSave.content[0]!.text) as Array<{ name: string }>;
    assert.ok(
      afterSymbols.some((s) => s.name === "entry_point"),
      `expected entry_point to be readable via the curated surface, got ${JSON.stringify(afterSymbols)}`,
    );

    // r2000_get_cross_references: this fixture's own STA $D020 (border colour) is a real reference.
    const xref = await runR2000Tool("r2000_get_cross_references", { project: projectPath, address: 0xd020 });
    assert.equal(xref.isError, false, `r2000_get_cross_references failed: ${JSON.stringify(xref)}`);
    const xrefList = JSON.parse(xref.content[0]!.text);
    assert.ok(Array.isArray(xrefList) && xrefList.length > 0, `expected a non-empty cross-reference list for $D020, got ${JSON.stringify(xrefList)}`);

    // r2000_search_disassembly with an explicit max_results well above this
    // fixture's real match count (3 "lda" instructions) -- the returned count
    // must be strictly less than max_results, or a silent truncation would be
    // invisible (D-23's report-coverage-explicitly rule).
    const search = await runR2000Tool("r2000_search_disassembly", {
      project: projectPath,
      query: "lda",
      max_results: 50,
      search_labels: false,
      search_comments: false,
      search_instructions: true,
    });
    assert.equal(search.isError, false, `r2000_search_disassembly failed: ${JSON.stringify(search)}`);
    const matches = JSON.parse(search.content[0]!.text);
    assert.ok(Array.isArray(matches) && matches.length > 0, `expected at least one "lda" match, got ${JSON.stringify(matches)}`);
    assert.ok(
      matches.length < 50,
      `returned count (${matches.length}) must be strictly less than max_results (50), or a silent truncation would be invisible`,
    );

    // r2000_save_project, called standalone (its own top-level runR2000Tool
    // call) with nothing newly pending -- the entry_point label above was
    // already persisted by its OWN internal auto-save. regenerator2000 also
    // requires the project file to already exist to load it at all (measured
    // live: --mcp-server-stdio against a nonexistent path exits 1 with "Error
    // loading file"), so a standalone save can NEVER be the very first write.
    // saveAndVerify() therefore correctly reports this as an unchanged-hash
    // failure -- this is the documented reason r2000_save_project's own
    // description says it is "rarely required standalone".
    const redundantSave = await runR2000Tool("r2000_save_project", { project: projectPath });
    assert.equal(redundantSave.isError, true, "a standalone r2000_save_project with nothing pending is expected to report an unchanged-hash failure");
    assert.match(redundantSave.content[0]!.text, /content hash on disk is unchanged/);
  },
);

// ---------------------------------------------------------------------------
// Gated integration: r2000_read_region (SURF-01, D18-24/D18-25, plan 18-05)
// against a real regenerator2000 child -- both views, the omitted-view
// default, a single-address (size-1) request, and a cap-sized request.
// ---------------------------------------------------------------------------

let readRegionWorkDir: string | undefined;

after(() => {
  if (readRegionWorkDir) rmSync(readRegionWorkDir, { recursive: true, force: true });
});

test(
  "gated: r2000_read_region against a real regenerator2000 child -- both views resolve, 'view' omitted matches 'disasm' verbatim, a single address returns non-empty, and a cap-sized request returns a result",
  { skip: SKIP_REASON },
  async () => {
    readRegionWorkDir = mkdtempSync(join(HERE, ".r2000-tools-test-read-region-"));

    const fixturePath = join(
      HERE,
      "..",
      "..",
      "..",
      ".planning",
      "phases",
      "09-the-assumption-probe-go-no-go",
      "evidence",
      "fixture",
      "probe-illegal.prg",
    );
    const prgBytes = readFileSync(fixturePath);
    const origin = prgBytes.readUInt16LE(0);
    const body = prgBytes.subarray(2);
    const projectJson = synthesizeProject(body, { origin });
    const projectPath = join(readRegionWorkDir, "read-region.regen2000proj");
    writeFileSync(projectPath, projectJson);

    // A single address (inclusive size 1) returns a non-empty result.
    const single = await runR2000Tool("r2000_read_region", { project: projectPath, start_address: origin, end_address: origin });
    assert.equal(single.isError, false, `r2000_read_region (single address) failed: ${JSON.stringify(single)}`);
    assert.ok(single.content[0]!.text.length > 0, "expected a non-empty result for a one-byte inclusive range");

    // Both views resolve.
    const hexdump = await runR2000Tool("r2000_read_region", {
      project: projectPath,
      start_address: origin,
      end_address: origin + 15,
      view: "hexdump",
    });
    assert.equal(hexdump.isError, false, `r2000_read_region (hexdump) failed: ${JSON.stringify(hexdump)}`);
    assert.match(hexdump.content[0]!.text, /^\$[0-9A-F]{4}:/, "expected hexdump-shaped output ($ADDR: bytes)");

    const disasm = await runR2000Tool("r2000_read_region", {
      project: projectPath,
      start_address: origin,
      end_address: origin + 15,
      view: "disasm",
    });
    assert.equal(disasm.isError, false, `r2000_read_region (disasm) failed: ${JSON.stringify(disasm)}`);

    // 'view' omitted must be IDENTICAL to view: 'disasm' -- the exact
    // observation this curated tool's own description records verbatim.
    const omitted = await runR2000Tool("r2000_read_region", { project: projectPath, start_address: origin, end_address: origin + 15 });
    assert.equal(omitted.isError, false, `r2000_read_region (view omitted) failed: ${JSON.stringify(omitted)}`);
    assert.equal(
      omitted.content[0]!.text,
      disasm.content[0]!.text,
      "'view' omitted must match view: 'disasm' verbatim -- this is the exact live-observed behaviour the curated description states",
    );

    // A cap-sized request (inclusive size === R2000_READ_REGION_MAX_BYTES)
    // still returns a result (not an error), even though most of that range
    // is undefined memory outside this tiny fixture's own data.
    const capSized = await runR2000Tool("r2000_read_region", {
      project: projectPath,
      start_address: origin,
      end_address: origin + R2000_READ_REGION_MAX_BYTES - 1,
      view: "hexdump",
    });
    assert.equal(capSized.isError, false, `r2000_read_region (cap-sized) failed: ${JSON.stringify(capSized)}`);

    // An invalid 'view' value is refused BY NAME (upstream's own schema
    // validation, forwarded through unmodified) rather than silently
    // defaulting -- the live-observed behaviour this curated tool's
    // description implicitly relies on for its enum semantics.
    const badView = await runR2000Tool("r2000_read_region", {
      project: projectPath,
      start_address: origin,
      end_address: origin + 5,
      view: "bogus",
    });
    assert.equal(badView.isError, true, "an unrecognised 'view' value must be refused, never silently defaulted");
    assert.match(badView.content[0]!.text, /disasm|hexdump/i);
  },
);

// ---------------------------------------------------------------------------
// SURF-02 (D-36, plan 18-05): composeAddressDetails() -- the stub-driven
// frame-count proof. Points R2000_BIN at a tiny stub server that logs every
// tools/call name it receives and answers ONLY the four composing reads --
// any other name (including r2000_get_address_details or
// r2000_save_project) is refused with a JSON-RPC error, so an unexpected
// fifth call fails loudly rather than silently succeeding.
// ---------------------------------------------------------------------------

const COMPOSE_STUB_SOURCE = `
import { createInterface } from "node:readline";
import { appendFileSync } from "node:fs";
const rl = createInterface({ input: process.stdin, terminal: false });
function send(msg) { process.stdout.write(JSON.stringify(msg) + "\\n"); }
const RESPONSES = {
  r2000_get_symbols: [{ address: 49152, name: "probe_symbol", kind: "User" }],
  r2000_get_comments: [{ address: 49152, comment: "probe comment", type: "line" }],
  r2000_get_blocks: [{ start_address: 49152, end_address: 49200, type: "Code" }],
  r2000_get_cross_references: [49999],
};
rl.on("line", (line) => {
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  if (msg.method === "initialize") {
    send({ jsonrpc: "2.0", id: msg.id, result: { protocolVersion: "2024-11-05", capabilities: {}, serverInfo: { name: "compose-stub", version: "0" } } });
    return;
  }
  if (msg.method === "notifications/initialized") return;
  if (msg.method === "tools/call") {
    const name = msg.params && msg.params.name;
    appendFileSync(process.env.STUB_CALL_LOG, name + "\\n");
    if (Object.prototype.hasOwnProperty.call(RESPONSES, name)) {
      send({ jsonrpc: "2.0", id: msg.id, result: { content: [ { type: "text", text: JSON.stringify(RESPONSES[name]) } ] } });
      return;
    }
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "compose-stub refuses unexpected tool call: " + name } });
    return;
  }
  if (msg.id !== undefined) {
    send({ jsonrpc: "2.0", id: msg.id, error: { code: -32601, message: "unhandled method " + msg.method } });
  }
});
`;

let composeStubWorkDir: string | undefined;

after(async () => {
  await __resetR2000SessionForTest();
  if (composeStubWorkDir) rmSync(composeStubWorkDir, { recursive: true, force: true });
});

test("composeAddressDetails issues exactly 4 tools/call frames (the four named reads), zero naming r2000_get_address_details or r2000_save_project, all inside ONE session", async () => {
  await __resetR2000SessionForTest();
  composeStubWorkDir = mkdtempSync(join(HERE, ".r2000-tools-test-compose-stub-"));
  const callLog = join(composeStubWorkDir, "calls.log");
  writeFileSync(callLog, "");
  const stubBin = join(composeStubWorkDir, "compose-stub.mjs");
  writeFileSync(stubBin, "#!/usr/bin/env node\n" + COMPOSE_STUB_SOURCE);
  chmodSync(stubBin, 0o755);

  const prevBin = process.env.R2000_BIN;
  const prevLog = process.env.STUB_CALL_LOG;
  process.env.R2000_BIN = stubBin;
  process.env.STUB_CALL_LOG = callLog;
  try {
    // ensureProjectSettings() (D18-32) reads the project file BEFORE any
    // spawn, so a real (if trivial) .regen2000proj must exist on disk --
    // the stub server itself is never asked to load anything.
    const projectPath = join(composeStubWorkDir, "compose-test.regen2000proj");
    writeFileSync(projectPath, synthesizeProject(new Uint8Array(4), { origin: 49152 }));

    const result = await runR2000Tool("r2000_get_address_details", { project: projectPath, address: 49152 });
    assert.equal(result.isError, false, `r2000_get_address_details failed: ${JSON.stringify(result)}`);

    const composed = JSON.parse(result.content[0]!.text) as {
      composed_client_side: boolean;
      composed_from: string[];
      symbols: unknown;
      comments: unknown;
      block: unknown;
      cross_references: unknown;
    };
    assert.equal(composed.composed_client_side, true);
    assert.deepEqual(
      [...composed.composed_from].sort(),
      ["r2000_get_blocks", "r2000_get_comments", "r2000_get_cross_references", "r2000_get_symbols"].sort(),
    );
    assert.deepEqual(composed.symbols, [{ address: 49152, name: "probe_symbol", kind: "User" }]);
    assert.deepEqual(composed.comments, [{ address: 49152, comment: "probe comment", type: "line" }]);
    assert.deepEqual(composed.block, { start_address: 49152, end_address: 49200, type: "Code" });
    assert.deepEqual(composed.cross_references, [49999]);

    const loggedCalls = readFileSync(callLog, "utf8").trim().split("\n").filter(Boolean);
    assert.equal(loggedCalls.length, 4, `expected exactly 4 tools/call frames, got ${loggedCalls.length}: ${loggedCalls.join(", ")}`);
    assert.deepEqual(
      [...loggedCalls].sort(),
      ["r2000_get_blocks", "r2000_get_comments", "r2000_get_cross_references", "r2000_get_symbols"].sort(),
    );
    assert.ok(!loggedCalls.includes("r2000_get_address_details"), "the composed tool must never call itself by name upstream");
    assert.ok(!loggedCalls.includes("r2000_save_project"), "a read-only composition must never trigger a save");
  } finally {
    if (prevBin === undefined) delete process.env.R2000_BIN;
    else process.env.R2000_BIN = prevBin;
    if (prevLog === undefined) delete process.env.STUB_CALL_LOG;
    else process.env.STUB_CALL_LOG = prevLog;
    await __resetR2000SessionForTest();
  }
});

// ---------------------------------------------------------------------------
// Gated integration: composeAddressDetails() against a real, full-64K
// regenerator2000 project -- exactly the case upstream's own tool answers
// OutOfRange for at every address -- proving a usable composed answer, and
// that no save was issued (the project file's content is byte-identical
// across the call).
// ---------------------------------------------------------------------------

let compose64kWorkDir: string | undefined;

after(async () => {
  await __resetR2000SessionForTest();
  if (compose64kWorkDir) rmSync(compose64kWorkDir, { recursive: true, force: true });
});

test(
  "gated: composeAddressDetails against a real full-64K regenerator2000 project returns a usable answer, and issues no save",
  { skip: SKIP_REASON },
  async () => {
    await __resetR2000SessionForTest();
    compose64kWorkDir = mkdtempSync(join(HERE, ".r2000-tools-test-compose-64k-"));
    const bytes = new Uint8Array(65536);
    const origin = flatImageOrigin(bytes);
    const projectJson = synthesizeProject(bytes, { origin });
    const projectPath = join(compose64kWorkDir, "flat-64k.regen2000proj");
    writeFileSync(projectPath, projectJson);

    const beforeBytes = readFileSync(projectPath);

    const result = await runR2000Tool("r2000_get_address_details", { project: projectPath, address: 0 });
    assert.equal(result.isError, false, `r2000_get_address_details (64K project) failed: ${JSON.stringify(result)}`);
    const composed = JSON.parse(result.content[0]!.text) as { composed_client_side: boolean; composed_from: string[] };
    assert.equal(composed.composed_client_side, true, "expected a composed answer, not an upstream OutOfRange refusal");
    assert.equal(composed.composed_from.length, 4);
    // The whole point of D-36: this must NEVER be upstream's own OutOfRange
    // refusal, which is exactly what a passthrough to the native tool would
    // return at every address on a full 64K project.
    assert.ok(!JSON.stringify(result).includes("OutOfRange"), `expected a composed answer, got upstream's own OutOfRange text: ${JSON.stringify(result)}`);

    const afterBytes = readFileSync(projectPath);
    assert.ok(beforeBytes.equals(afterBytes), "composeAddressDetails must issue no save -- the project file's on-disk bytes must be unchanged across the call");
  },
);
