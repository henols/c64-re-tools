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
  assertCuratedTool,
  resolveStorePath,
  runR2000Tool,
  R2000UncuratedToolError,
  R2000StorePathError,
} from "./r2000-tools.ts";
import { synthesizeProject } from "./r2000-project.ts";
import { R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// D-18: the exact 17-member curated set, pinned by a hardcoded literal list
// so a name added to only one of CURATED_R2000_TOOLS/R2000_TOOL_DEFINITIONS
// (or a name lost from either) fails here rather than passing vacuously
// because the two happen to be derived from the same array today.
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
];

test("CURATED_R2000_TOOLS has exactly 17 members, matching the plan's objective table (set-equality, both directions)", () => {
  assert.equal(CURATED_R2000_TOOLS.length, 17, `expected exactly 17 curated tools, got ${CURATED_R2000_TOOLS.length}`);
  const actual = new Set(CURATED_R2000_TOOLS);
  const expected = new Set(EXPECTED_CURATED_NAMES);
  const missing = [...expected].filter((n) => !actual.has(n));
  const extra = [...actual].filter((n) => !expected.has(n));
  assert.deepEqual(missing, [], `expected curated but missing: ${missing.join(", ")}`);
  assert.deepEqual(extra, [], `curated but not in the plan's objective table (missing a criterion?): ${extra.join(", ")}`);
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
// D-32: r2000_get_address_details is excluded by name, with a refusal
// message naming the defect and the upstream issue rather than a generic
// "unknown tool" message.
// ---------------------------------------------------------------------------

test("assertCuratedTool refuses r2000_get_address_details naming the 64K OutOfRange defect and the upstream issue", () => {
  assert.throws(
    () => assertCuratedTool("r2000_get_address_details"),
    (err: unknown) => {
      assert.ok(err instanceof R2000UncuratedToolError);
      assert.equal((err as R2000UncuratedToolError).toolName, "r2000_get_address_details");
      assert.match((err as Error).message, /OutOfRange/);
      assert.match((err as Error).message, /issue/i);
      return true;
    },
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
          { name: "r2000_get_address_details", arguments: { address: 4096 } },
        ],
      }),
    (err: unknown) => {
      assert.ok(err instanceof R2000UncuratedToolError);
      assert.equal((err as R2000UncuratedToolError).batchIndex, 1);
      assert.match((err as Error).message, /r2000_get_address_details/);
      assert.match((err as Error).message, /calls\[1\]/);
      return true;
    },
  );
});

test("assertCuratedTool refuses a batch containing an inner name outside the curated set entirely (not just D-32's exclusion)", () => {
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
            arguments: { calls: [{ name: "r2000_get_address_details", arguments: { address: 1 } }] },
          },
        ],
      }),
    R2000UncuratedToolError,
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
          { name: "r2000_get_address_details", arguments: { address: 4096 } },
        ],
      }),
      (err: unknown) => {
        assert.ok(err instanceof R2000UncuratedToolError);
        assert.match((err as Error).message, /r2000_get_address_details/);
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
    // its own session, before that session exits (D-17's per-call lifecycle).
    // No separate r2000_save_project call is needed (or wanted here: since
    // nothing else would be pending, an immediately-following standalone
    // r2000_save_project call would correctly report an unchanged hash --
    // see r2000-tools.ts's own comment above READ_ONLY_R2000_TOOLS for why).
    const setLabel = await runR2000Tool("r2000_set_label_name", { project: projectPath, address: origin, name: "entry_point" });
    assert.equal(setLabel.isError, false, `r2000_set_label_name failed: ${JSON.stringify(setLabel)}`);

    // A FRESH session (runR2000Tool spawns a brand-new child per call, D-17)
    // -- proves the internal auto-save actually persisted the label to disk,
    // not merely to the now-exited child's own memory.
    const afterSave = await runR2000Tool("r2000_get_symbols", { project: projectPath, kind: "user" });
    assert.equal(afterSave.isError, false, `r2000_get_symbols (after) failed: ${JSON.stringify(afterSave)}`);
    const afterSymbols = JSON.parse(afterSave.content[0]!.text) as Array<{ name: string }>;
    assert.ok(
      afterSymbols.some((s) => s.name === "entry_point"),
      `expected entry_point to survive into a fresh session, got ${JSON.stringify(afterSymbols)}`,
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
