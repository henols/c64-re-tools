// anno-cli.test.ts -- coverage for the TWO-VERB CLI (D-14, 2026-08-29).
//
// This file used to test eight verbs. Six of them were delivery paths for the
// retired external analyser this project rented an annotation store from, and
// they went in one commit together with their tests. What is left is exactly
// what the CLI still has: `render-memmap` and `coverage`.
//
// FOUR THINGS THIS FILE PROVES, and why each earns its place:
//
//   1. THE ARGV SUBCOMMAND MECHANISM, end to end, at the bin. Spawns the real
//      `vice-proxy.ts` exactly as a consumer would (`smoke.mjs`'s harness
//      shape, including VICE_SKIP_RESOURCE_INSTALL=1 and
//      MASTRA_TELEMETRY_DISABLED=1 in the child env), and asserts no line of
//      stdout is a JSON-RPC frame -- the proof the subcommand short-circuits
//      before the MCP server ever starts.
//   2. THE NARROWING IS REAL. Each of the six removed verbs is rejected, and
//      the rejection names the two that exist. A verb removed from the
//      dispatch switch but left in USAGE, or vice versa, fails here.
//   3. THE OPTION CONTRACT (IN-06). `VERB_OPTIONS` and USAGE agree per verb,
//      every documented option is accepted, and every undocumented one is
//      refused with the verb's own name on the front.
//   4. THE CENSUS RE-POINT IS EQUIVALENT, not merely compiling. A store
//      populated to match a committed coverage fixture produces the verdict
//      that fixture records. That is the assertion T-29-29 exists for: a
//      vocabulary mismatch between the store's columns and the census's input
//      shapes would move a measurement with nothing red anywhere.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, copyFileSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  runR2000Cli,
  VERB_OPTIONS,
  symbolsFromStore,
  commentsFromStore,
  blocksFromStore,
  crossReferencesFromStore,
} from "./anno-cli.ts";
import { openStore, closeStore, setLabel, setComment, setDataType, putXref, listLabels, listComments, listRanges } from "./anno-store.ts";
import { buildCoverageReport, coverageFindings } from "./anno-coverage.ts";
import type { R2000Comment, R2000CrossReference, R2000Symbol } from "./anno-coverage.ts";
import type { BlockEntry } from "./block-class.ts";
import { repoRoot } from "./repo-root.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The six verbs D-14 removed. Hand-listed on purpose: deriving it from
 * `VERB_OPTIONS` would assert that a removed verb is removed, which is a
 * tautology. This list is what makes "the narrowing happened" falsifiable. */
const REMOVED_VERBS = ["bootstrap", "export-asm", "verify", "gen-enums", "export-lbl", "import-lbl"];

/** The two that survive. Same reasoning, opposite polarity. */
const SURVIVING_VERBS = ["render-memmap", "coverage"];

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

async function withCapturedConsole<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const outLines: string[] = [];
  const errLines: string[] = [];
  console.log = (...args: unknown[]) => {
    outLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errLines.push(args.map(String).join(" "));
  };
  try {
    const result = await fn();
    return { result, stdout: outLines.join("\n"), stderr: errLines.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "anno-cli-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

/** A temp directory INSIDE the workspace root.
 *
 * `coverage` confines both of its caller-supplied paths with
 * `storePathWithinWorkspace()` against `repoRoot()`, so a system tmpdir path
 * is refused BY DESIGN -- that refusal is the mitigation for T-29-28, not an
 * inconvenience to route around. Any test that drives the coverage verb for
 * real must therefore work inside the tree, exactly as the store's own tests
 * do. */
function withWorkspaceTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(HERE, ".anno-cli-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// ---------------------------------------------------------------------------
// Bin-level tests -- the end-to-end proof that the subcommand short-circuits
// before the MCP server starts.
// ---------------------------------------------------------------------------

const VICE_PROXY = join(HERE, "vice-proxy.ts");
const CLI_ENV = {
  ...process.env,
  VICE_SKIP_RESOURCE_INSTALL: "1",
  MASTRA_TELEMETRY_DISABLED: "1",
};
const CLI_TIMEOUT_MS = 20_000;

function spawnCli(args: string[]) {
  return spawnSync("node", [VICE_PROXY, ...args], {
    encoding: "utf8" as const,
    env: CLI_ENV,
    timeout: CLI_TIMEOUT_MS,
  });
}

let helpResult: ReturnType<typeof spawnCli>;
let unknownVerbResult: ReturnType<typeof spawnCli>;

before(() => {
  helpResult = spawnCli(["r2000", "--help"]);
  unknownVerbResult = spawnCli(["r2000", "no-such-verb"]);
});

test("bin: `vice-mcp r2000 --help` exits 0, prints both invocation forms, and emits no JSON-RPC frame", () => {
  assert.equal(helpResult.status, 0, `stdout: ${helpResult.stdout} stderr: ${helpResult.stderr}`);
  assert.match(helpResult.stdout, /npx -y @henols\/vice-mcp r2000 <verb>/);
  assert.match(helpResult.stdout, /node <plugin-root>\/src\/mcp\/vice\/vice-proxy\.ts r2000 <verb>/);

  // The load-bearing assertion: no line of stdout parses as a JSON object
  // carrying a `jsonrpc` key -- proof the subcommand short-circuits before
  // the MCP server (and its stdio JSON-RPC wire protocol) ever starts.
  for (const line of helpResult.stdout.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const isJsonRpcFrame = !!parsed && typeof parsed === "object" && "jsonrpc" in (parsed as Record<string, unknown>);
    assert.equal(
      isJsonRpcFrame,
      false,
      `stdout line parses as a JSON-RPC frame, proving the dispatch fell through into the server: ${trimmed}`,
    );
  }
});

test("bin: `vice-mcp r2000 no-such-verb` exits non-zero and prints a usage block", () => {
  assert.notEqual(unknownVerbResult.status, 0);
  const combined = `${unknownVerbResult.stdout}${unknownVerbResult.stderr}`;
  assert.match(combined, /usage \(npm install\)/);
});

test("bin: `vice-mcp r2000 --help` lists exactly the two surviving verbs", () => {
  for (const verb of SURVIVING_VERBS) {
    assert.match(helpResult.stdout, new RegExp(`\\b${verb}\\b`), `USAGE must document the surviving verb ${verb}`);
  }
});

test("bin: both invocations terminate on their own within the timeout, not via spawnSync's timeout kill", () => {
  assert.equal(
    helpResult.signal,
    null,
    "r2000 --help was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
  assert.equal(
    unknownVerbResult.signal,
    null,
    "r2000 no-such-verb was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
});

// ---------------------------------------------------------------------------
// The narrowing itself (D-14). Six verbs are GONE, not disabled.
// ---------------------------------------------------------------------------

test("each of the six removed verbs is rejected, and the rejection names the two verbs that exist", async () => {
  for (const verb of REMOVED_VERBS) {
    const { result: code, stdout, stderr } = await withCapturedConsole(() => runR2000Cli([verb, "some.project"]));
    assert.notEqual(code, 0, `the removed verb "${verb}" must be rejected, not dispatched`);
    assert.match(stderr, new RegExp(`unknown verb "${verb}"`), `the refusal must name the verb the caller typed`);
    for (const survivor of SURVIVING_VERBS) {
      assert.match(
        `${stderr}\n${stdout}`,
        new RegExp(`\\b${survivor}\\b`),
        `the refusal for "${verb}" must point the caller at the surviving verb ${survivor}`,
      );
    }
  }
});

test("USAGE names neither the removed verbs nor their options", () => {
  const usage = helpResult.stdout;
  for (const verb of REMOVED_VERBS) {
    assert.doesNotMatch(usage, new RegExp(`^ {2}${verb}\\b`, "m"), `USAGE still documents the removed verb ${verb}`);
  }
  for (const gone of ["--entry", "--max-results"]) {
    assert.doesNotMatch(usage, new RegExp(gone.replace(/-/g, "\\-")), `USAGE still documents ${gone}, which no surviving verb reads`);
  }
});

test("VERB_OPTIONS carries exactly the two surviving verbs", () => {
  assert.deepEqual(Object.keys(VERB_OPTIONS).sort(), [...SURVIVING_VERBS].sort());
});

// ---------------------------------------------------------------------------
// render-memmap: argument-level refusals. The verb's own rendering behaviour
// is proven in `anno-memmap-render.test.ts`; what is proven here is that the
// CLI never guesses on the caller's behalf.
// ---------------------------------------------------------------------------

test("render-memmap: --help lists the verb, states the output is generated, and states --check catches a hand edit", () => {
  assert.match(helpResult.stdout, /\brender-memmap\b/);
  assert.match(helpResult.stdout, /GENERATED|generated/);
  assert.match(helpResult.stdout, /--check.*hand edit/is);
});

test("render-memmap: a missing project is refused, not silently accepted", async () => {
  await withTempDir(async (dir) => {
    const missing = join(dir, "does-not-exist.regen2000proj");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", missing, "--provenance", join(dir, "sidecar.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /project file not found/i);
  });
});

test("render-memmap: a missing --provenance is refused", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["render-memmap", projectPath]));
    assert.notEqual(code, 0);
    assert.match(stderr, /--provenance.*required/i);
  });
});

test("render-memmap: a nonexistent --provenance file is refused", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", projectPath, "--provenance", join(dir, "does-not-exist.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /provenance sidecar not found/i);
  });
});

test("render-memmap: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.project", "--provenance", "x.json", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("render-memmap: --provenance with no value is refused", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["render-memmap", "some.project", "--provenance"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--provenance requires a value/i);
});

test("render-memmap: --out followed by a flag-shaped token is refused (not silently consumed as the value)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.project", "--provenance", "x.json", "--out", "--check"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--out requires a value/i);
});

// ---------------------------------------------------------------------------
// coverage: argument-level refusals, including the TWO-PATH contract.
// ---------------------------------------------------------------------------

test("coverage: a missing project positional is refused with the two-path usage line", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /usage: coverage <project> --store FILE/);
});

test("coverage: --store is REQUIRED and is never derived from <project> (D-02: this CLI does not guess)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage", "some.project"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--store FILE is required/);
  assert.match(stderr, /will not derive its path from <project>/);
});

test("coverage: --store with no value is refused, not silently given the next token", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["coverage", "some.project", "--store"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--store requires a value/i);
});

test("coverage: --store followed by a flag-shaped token is refused (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "--force"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--store requires a value/i);
});

test("coverage: an unknown option is refused with a non-zero exit code", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "s.store", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("coverage: --sample must be a positive integer", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["coverage", "some.project", "--store", "s.store", "--sample", "0"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--sample must be a positive integer/);
});

test("coverage: a path outside the workspace root is refused by the ONE confinement seam (T-29-28)", async () => {
  await withTempDir(async (dir) => {
    const outside = join(dir, "elsewhere.project");
    writeFileSync(outside, "{}");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", outside, "--store", join(dir, "elsewhere.store")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /outside the workspace root/i);
  });
});

test("coverage: an absent store is refused BY NAME rather than created (gone and empty must not read the same)", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const projectPath = join(dir, "game.project");
    writeFileSync(projectPath, JSON.stringify({ origin: 0x0810, raw_data_base64: "" }));
    const storePath = join(dir, "annotations.store");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /annotation store not found/i);
    assert.match(stderr, /refusing to CREATE one/);
    assert.equal(existsSync(storePath), false, "a refused run must not leave a store behind at the named path");
  });
});

test("coverage: an absent project file is refused before the store is opened", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    closeStore(openStore(storePath, { workspaceRoot: repoRoot() }));
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", join(dir, "nope.project"), "--store", storePath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /project file not found/i);
  });
});

// ---------------------------------------------------------------------------
// THE CENSUS RE-POINT, PROVEN EQUIVALENT (T-29-29).
//
// The committed coverage fixtures each carry two files: a project file with
// the payload bytes, and a `store.json` recording the four census input shapes
// PLUS the verdict that fixture exists to pin. Before this phase the CLI read
// those four shapes out of the retired analyser's project JSON. It now reads
// them out of this project's own annotation store.
//
// The proof that the re-point did not move a measurement is therefore not
// "it compiles" and not "the columns look right": it is populating a REAL
// store from a fixture's own recorded facts, reading it back through the four
// adapter functions, and asserting the census reaches the verdict the fixture
// records. A vocabulary mismatch at any of the four shapes -- most easily the
// block-type column, whose two vocabularies `block-class.ts` alone reconciles
// -- changes that verdict.
// ---------------------------------------------------------------------------

interface FixtureStore {
  control: string;
  expect_clean: boolean;
  expect_measure: string | null;
  symbols: R2000Symbol[];
  comments: R2000Comment[];
  blocks: BlockEntry[];
  cross_references: R2000CrossReference[];
}

const FIXTURE_ROOT = join(HERE, "fixtures", "coverage");

function fixtureDirs(): string[] {
  return readdirSync(FIXTURE_ROOT, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
}

/** The fixtures are spelled in the CAPITALISED vocabulary the retired analyser
 * emitted; the store's own `dataType` column is lowercase. The translation is
 * written out here, in the test, rather than reached for in production code:
 * `block-class.ts` is the only module allowed to reconcile the two
 * vocabularies at runtime, and this is a fixture-loading concern. Everything
 * outside the two spellings the fixtures actually use is refused loudly rather
 * than defaulted, so a fixture gaining a third block type fails here instead
 * of being silently typed as bytes. */
const FIXTURE_BLOCK_TYPE_TO_STORE_DATA_TYPE: Readonly<Record<string, string>> = Object.freeze({
  Code: "code",
  Byte: "byte",
  Undefined: "undefined",
});

/** Populates a real store with a fixture's own recorded facts. The cross
 * references go in as stored rows, which is the one of `crossReferencesTo()`'s
 * three sources that carries a caller nothing can recover from the bytes --
 * exactly what a fixture's recorded `cross_references` list is. */
function populateStoreFromFixture(storePath: string, fixture: FixtureStore): void {
  const handle = openStore(storePath, { workspaceRoot: repoRoot() });
  try {
    for (const block of fixture.blocks) {
      const dataType = FIXTURE_BLOCK_TYPE_TO_STORE_DATA_TYPE[block.type];
      assert.ok(dataType, `fixture block type ${JSON.stringify(block.type)} has no store spelling in this test's table`);
      setDataType(handle, { start: block.start_address, endInclusive: block.end_address, dataType });
    }
    for (const symbol of fixture.symbols) {
      setLabel(handle, { address: symbol.address, name: symbol.name, kind: symbol.kind });
    }
    for (const comment of fixture.comments) {
      setComment(handle, { address: comment.address, commentType: comment.type, text: comment.comment });
    }
    for (const xref of fixture.cross_references) {
      for (const caller of xref.callers) {
        putXref(handle, { fromAddress: caller, toAddress: xref.address, accessKind: "COMPUTED_JUMP" });
      }
    }
  } finally {
    closeStore(handle);
  }
}

for (const dir of fixtureDirs()) {
  const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, dir, "store.json"), "utf8")) as FixtureStore;
  const verdictWord = fixture.expect_clean ? "CLEAN" : "non-clean";
  test(`census re-point equivalence: control ${fixture.control} (${dir}) still produces a ${verdictWord} result when its facts come from a real store`, async () => {
    await withWorkspaceTempDir(async (dir2) => {
      const projectPath = join(dir2, "project.regen2000proj");
      copyFileSync(join(FIXTURE_ROOT, dir, "project.regen2000proj"), projectPath);
      const storePath = join(dir2, "annotations.store");
      populateStoreFromFixture(storePath, fixture);

      const handle = openStore(storePath, { workspaceRoot: repoRoot(), mustExist: true });
      let report;
      try {
        const symbols = symbolsFromStore(listLabels(handle));
        const comments = commentsFromStore(listComments(handle));
        const blocks = blocksFromStore(listRanges(handle));
        // The store round trip must not lose a row: a silently empty read
        // would make every verdict below trivially reproducible.
        assert.equal(symbols.length, fixture.symbols.length, `${dir}: label rows did not survive the store round trip`);
        assert.equal(comments.length, fixture.comments.length, `${dir}: comment rows did not survive the store round trip`);
        assert.equal(blocks.length, fixture.blocks.length, `${dir}: range rows did not survive the store round trip`);

        const project = JSON.parse(readFileSync(projectPath, "utf8")) as { origin: number; raw_data_base64: string };
        const bytes = Uint8Array.from(Buffer.from(project.raw_data_base64, "base64"));
        const crossReferences = crossReferencesFromStore(handle, bytes, project.origin, symbols);
        report = buildCoverageReport({ projectPath, symbols, comments, blocks, crossReferences });
      } finally {
        closeStore(handle);
      }

      const findings = coverageFindings(report);
      assert.equal(
        findings.clean,
        fixture.expect_clean,
        `${dir} expected clean=${fixture.expect_clean} but got clean=${findings.clean}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
      );
      if (fixture.expect_measure) {
        assert.ok(
          findings.findings.some((f) => f.measure === fixture.expect_measure),
          `${dir} was caught, but not by ${fixture.expect_measure}. Findings: ${JSON.stringify(findings.findings, null, 2)}`,
        );
      }
    });
  });
}

test("non-vacuity: the equivalence set above is the whole committed control set, and it contains BOTH a clean and a non-clean control", () => {
  const dirs = fixtureDirs();
  assert.ok(dirs.length >= 12, `expected at least 12 committed control fixtures, found ${dirs.length}: ${dirs.join(", ")}`);
  const verdicts = dirs.map((d) => (JSON.parse(readFileSync(join(FIXTURE_ROOT, d, "store.json"), "utf8")) as FixtureStore).expect_clean);
  assert.ok(verdicts.includes(true), "no CLEAN control -- the equivalence proof would then be a machine that only fails");
  assert.ok(verdicts.includes(false), "no non-clean control -- the equivalence proof would then be a machine that only passes");
});

test("coverage end to end: the verb runs against a real store and prints all three named measures, exiting 0", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "store.json"), "utf8")) as FixtureStore;
    const projectPath = join(dir, "project.regen2000proj");
    copyFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "project.regen2000proj"), projectPath);
    const storePath = join(dir, "annotations.store");
    populateStoreFromFixture(storePath, fixture);

    const outPath = join(dir, "report.json");
    const { result: code, stdout } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath]),
    );
    assert.equal(code, 0, stdout);
    assert.match(stdout, /MEASURE 1 of 3 -- structural byte census/);
    assert.match(stdout, /MEASURE 2 of 3 -- label figures/);
    assert.match(stdout, /MEASURE 3 of 3 -- sampled reproducibility/);
    assert.match(stdout, /comment vacuity/);
    assert.match(stdout, /divergence sub-report/);
    // COV-01's own rule, asserted at the point of display: no aggregate.
    assert.doesNotMatch(stdout, /overall score|combined score|total coverage/i);
    assert.ok(existsSync(outPath), "the JSON report must be written when --out is given");

    // The cross-reference answer is now COMPLETE. The bounded-lookup note the
    // round-trip ceiling used to print is gone, and its absence is asserted so
    // a truncation cannot creep back in silently.
    assert.doesNotMatch(stdout, /cross-reference lookups were bounded/);
  });
});

test("coverage: --out refuses to clobber an existing file unless --force is given", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const fixture = JSON.parse(readFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "store.json"), "utf8")) as FixtureStore;
    const projectPath = join(dir, "project.regen2000proj");
    copyFileSync(join(FIXTURE_ROOT, "nc5-well-documented", "project.regen2000proj"), projectPath);
    const storePath = join(dir, "annotations.store");
    populateStoreFromFixture(storePath, fixture);

    const outPath = join(dir, "report.json");
    writeFileSync(outPath, "PRE-EXISTING");
    const { result: refused, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath]),
    );
    assert.notEqual(refused, 0);
    assert.match(stderr, /refusing to overwrite/i);
    assert.equal(readFileSync(outPath, "utf8"), "PRE-EXISTING");

    const { result: forced } = await withCapturedConsole(() =>
      runR2000Cli(["coverage", projectPath, "--store", storePath, "--out", outPath, "--force"]),
    );
    assert.equal(forced, 0);
    assert.notEqual(readFileSync(outPath, "utf8"), "PRE-EXISTING");
  });
});

test("the four adapters map the store's own columns onto the census's shapes, with no field invented and none dropped", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    const handle = openStore(storePath, { workspaceRoot: repoRoot() });
    try {
      setDataType(handle, { start: 0x0810, endInclusive: 0x081f, dataType: "code" });
      setDataType(handle, { start: 0x0820, endInclusive: 0x082f, dataType: "byte" });
      setLabel(handle, { address: 0x0810, name: "entry_point", kind: "User" });
      setComment(handle, { address: 0x0810, commentType: "line", text: "[confirmed-code] entry" });

      assert.deepEqual(symbolsFromStore(listLabels(handle)), [{ address: 0x0810, name: "entry_point", kind: "User" }]);
      assert.deepEqual(commentsFromStore(listComments(handle)), [
        { address: 0x0810, type: "line", comment: "[confirmed-code] entry" },
      ]);
      assert.deepEqual(blocksFromStore(listRanges(handle)), [
        { start_address: 0x0810, end_address: 0x081f, type: "code" },
        { start_address: 0x0820, end_address: 0x082f, type: "byte" },
      ]);
    } finally {
      closeStore(handle);
    }
  });
});

test("the cross-reference adapter answers over the WHOLE population, with no ceiling and no truncation note", async () => {
  await withWorkspaceTempDir(async (dir) => {
    const storePath = join(dir, "annotations.store");
    const handle = openStore(storePath, { workspaceRoot: repoRoot() });
    try {
      // Far more labels than the 512-lookup ceiling the retired round-trip
      // loop carried. The point of the assertion is the COUNT: a surviving cap
      // would silently answer for the lowest 512 addresses only.
      const symbols: R2000Symbol[] = [];
      for (let i = 0; i < 600; i++) {
        const address = 0x1000 + i;
        setLabel(handle, { address, name: `lbl_${i}`, kind: "User" });
        symbols.push({ address, name: `lbl_${i}`, kind: "User" });
      }
      setLabel(handle, { address: 0xc000, name: "sys_label", kind: "System" });
      symbols.push({ address: 0xc000, name: "sys_label", kind: "System" });

      const derived = crossReferencesFromStore(handle, new Uint8Array(64), 0x0810, symbols);
      assert.equal(derived.length, 600, "every non-System label must get an answer -- 600 is deliberately above the retired 512 ceiling");
      assert.ok(
        !derived.some((x) => x.address === 0xc000),
        "System labels are excluded from every label figure already, so deriving their callers would buy the census nothing",
      );
    } finally {
      closeStore(handle);
    }
  });
});

// ---------------------------------------------------------------------------
// IN-06 -- a verb refuses an option it does not implement instead of silently
// dropping it. `VERB_OPTIONS` (one frozen map in `anno-cli.ts`) plus
// `checkAcceptedOptions()`'s single pre-dispatch call site refuse any
// `--flag`-shaped token a verb does not accept, for both verbs uniformly.
// ---------------------------------------------------------------------------

// The verb count here is a count site that MOVES with the dispatch switch,
// alongside `ANNO_CLI_VERB_FLOOR` and `anno-verb-coverage.test.ts`'s own verb
// list. Kept as a hand-maintained literal on purpose: deriving it from
// `Object.keys(VERB_OPTIONS).length` would assert that a number equals itself.
test("the verb-options map agrees with USAGE's own per-verb option lists, for both verbs (IN-06)", () => {
  const usage = helpResult.stdout;
  const verbs = Object.keys(VERB_OPTIONS);
  assert.equal(verbs.length, 2, `expected exactly 2 verbs in VERB_OPTIONS, found ${verbs.length}: ${verbs.join(", ")}`);

  for (const verb of verbs) {
    const lineMatch = new RegExp(`^ {2}${verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`, "m").exec(usage);
    assert.ok(lineMatch, `expected a USAGE line for verb "${verb}"`);
    const documented = new Set(lineMatch![0].match(/--[a-zA-Z-]+/g) ?? []);
    const mapped = new Set(VERB_OPTIONS[verb]);
    assert.deepEqual(
      documented,
      mapped,
      `verb "${verb}": USAGE documents ${JSON.stringify([...documented])} but VERB_OPTIONS accepts ${JSON.stringify([...mapped])}`,
    );
  }
});

test("every verb's own documented options are still accepted, one assertion per verb (IN-06 regression guard)", async () => {
  // Built directly from VERB_OPTIONS (the map's own ground truth) rather than
  // hand-typed per verb, so this test cannot silently drift from the map it is
  // proving.
  const placeholderValue: Record<string, string> = {
    "--out": "some-out-path",
    "--force": "",
    "--provenance": "some-provenance.json",
    "--check": "",
    "--sample": "4",
    "--store": "some.store",
  };
  for (const [verb, options] of Object.entries(VERB_OPTIONS)) {
    const argv: string[] = [verb, "some.project"];
    for (const opt of options) {
      argv.push(opt);
      const value = placeholderValue[opt];
      if (value) argv.push(value);
    }
    const { stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.doesNotMatch(
      stderr,
      /is not accepted by this verb/,
      `verb "${verb}" with its own documented options ${JSON.stringify(options)} must not be refused by checkAcceptedOptions(); argv=${JSON.stringify(argv)}, stderr=${stderr}`,
    );
  }
});

test("an unaccepted option is refused for every verb it does not belong to (IN-06 generalisation)", async () => {
  for (const verb of Object.keys(VERB_OPTIONS)) {
    const argv = [verb, "some.project", "--totally-not-a-real-flag"];
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.notEqual(code, 0, `verb "${verb}" must refuse an unaccepted flag`);
    assert.match(stderr, new RegExp(`^${verb}:`), `verb "${verb}"'s refusal must be prefixed with its own name`);
    assert.match(stderr, /--totally-not-a-real-flag/);
  }
});

// ---------------------------------------------------------------------------
// WR-09 (D-11.1-04) -- the never-throw contract on the verbs' file writes,
// plus a structural guard pinning it so an unguarded write cannot be added
// silently.
//
// The structural guard reads anno-cli.ts's own source, strips comments and
// string/template-literal bodies (so neither can produce a false brace/paren
// match), then for every `writeFileSync(` occurrence walks BACKWARD through
// the stripped text one character at a time, tracking brace depth, until it
// reaches the nearest unmatched `{` (skipping any it can already prove is
// matched by a `}` seen along the way). That unmatched `{` is classified by
// the token immediately preceding it: `try` means the call is guarded;
// `else`/`finally`/`do`, or a `(...)`-headed block whose header keyword is
// `if`/`for`/`while`/`switch`/`catch`, is a same-function block the scan
// keeps climbing past; anything else (a `function`/method header, an arrow
// `=>`, or reaching column 0 with nothing left to climb) is a function
// boundary or module scope, and the call is reported unguarded. This is a
// brace-depth scan "from each match backwards to the nearest enclosing
// `try {` in the same function" exactly as specified, not a "the file
// contains the word try" substring check -- proven below by a planted
// violation (a bare call at function top level, which the scan must reach
// module scope for and report unguarded) alongside a wrapped control (which
// it must stop climbing at on the very first brace and report guarded).
//
// THE TWO NAMED POSITIVE-CONTROL SITES MOVED WITH THE NARROWING. Before D-14
// they were the project-file write and the Markdown write; the project-file
// write went with its verb, and the surviving pair is `cmdRenderMemmap()`'s
// Markdown write and `cmdCoverage()`'s JSON-report write. The FLOOR OF TWO is
// unchanged, and that is not a coincidence to be tidied away: it is the
// measured count of write sites this file still has.
// ---------------------------------------------------------------------------

const R2000_CLI_SOURCE_PATH = join(HERE, "anno-cli.ts");

/**
 * Blanks every line comment, block comment, quoted string and template
 * literal body to a same-length run of spaces (newlines preserved), so a
 * brace or paren living only inside a comment or a message string can never
 * be mistaken for real control-flow structure. Deliberately does not track
 * `${...}` interpolation specially inside a template literal -- the whole
 * span between backticks is blanked regardless of nesting, which is correct
 * for this file (no `writeFileSync(` call lives inside a template
 * interpolation anywhere in it) and simpler than a fully general JS
 * tokenizer would need to be.
 */
function stripCommentsAndLiterals(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && source[i] !== "\n") {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out[i] = " ";
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "`") {
      out[i] = " ";
      i++;
      while (i < n && source[i] !== "`") {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join("");
}

/** The word (identifier characters only) ending at, and including, index
 * `endIdxInclusive` in `stripped`. */
function wordEndingAt(stripped: string, endIdxInclusive: number): string {
  let start = endIdxInclusive;
  while (start >= 0 && /[A-Za-z0-9_$]/.test(stripped[start]!)) start--;
  start++;
  return stripped.slice(start, endIdxInclusive + 1);
}

type BraceKind = "try" | "block" | "function" | "module";

/** Classifies an open brace at `braceIdx` in `stripped` by the token
 * immediately preceding it (skipping whitespace). See this section's header
 * comment for the full classification rule. */
function classifyBrace(stripped: string, braceIdx: number): BraceKind {
  let j = braceIdx - 1;
  while (j >= 0 && /\s/.test(stripped[j]!)) j--;
  if (j < 0) return "module";
  if (stripped[j] === ">" && stripped[j - 1] === "=") return "function"; // arrow `=> {`
  if (stripped[j] === ")") {
    // Walk back to this `)`'s matching `(`, then classify by the keyword (if
    // any) immediately before THAT -- distinguishes `if (...) {` / `for
    // (...) {` / `catch (...) {` (same-function block) from a function or
    // method definition's own `(...) {` (a function boundary).
    let depth = 1;
    let k = j - 1;
    while (k >= 0 && depth > 0) {
      if (stripped[k] === ")") depth++;
      else if (stripped[k] === "(") depth--;
      k--;
    }
    let m = k;
    while (m >= 0 && /\s/.test(stripped[m]!)) m--;
    if (m < 0) return "function";
    const word = wordEndingAt(stripped, m);
    if (word === "if" || word === "for" || word === "while" || word === "switch" || word === "catch") {
      return "block";
    }
    return "function";
  }
  const word = wordEndingAt(stripped, j);
  if (word === "try") return "try";
  if (word === "else" || word === "finally" || word === "do") return "block";
  return "function";
}

/**
 * Walks backward from `callIdx` (the index of a `writeFileSync(` match) in
 * `stripped`, one enclosing brace at a time, until it either finds a `try`
 * (guarded, returns true) or hits a function boundary / module scope
 * (unguarded, returns false). Braces already matched by a `}` encountered
 * during the walk are skipped via a simple depth counter, exactly as if
 * scanning a balanced-bracket stack from the top down.
 */
function isWriteGuarded(stripped: string, callIdx: number): boolean {
  let i = callIdx - 1;
  let depth = 0;
  while (i >= 0) {
    const c = stripped[i];
    if (c === "}") {
      depth++;
      i--;
      continue;
    }
    if (c === "{") {
      if (depth === 0) {
        const kind = classifyBrace(stripped, i);
        if (kind === "try") return true;
        if (kind === "function" || kind === "module") return false;
        // "block" (if/for/while/switch/catch/else/finally/do) -- this brace
        // is consumed; keep climbing toward the next enclosing brace.
        i--;
        continue;
      }
      depth--;
      i--;
      continue;
    }
    i--;
  }
  return false;
}

/** Every `writeFileSync(` call-site index in `source`, found against the
 * comment/literal-stripped text so neither can produce a false match. */
function findWriteFileSyncCalls(source: string): { stripped: string; indices: number[] } {
  const stripped = stripCommentsAndLiterals(source);
  const re = /\bwriteFileSync\s*\(/g;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) indices.push(m.index);
  return { stripped, indices };
}

test("structural (WR-09): every writeFileSync( in anno-cli.ts is inside a try block, with a non-vacuous floor and named positive-control sites", () => {
  const source = readFileSync(R2000_CLI_SOURCE_PATH, "utf8");
  const { stripped, indices } = findWriteFileSyncCalls(source);

  // Non-vacuity floor -- a scanner that silently found zero call sites would
  // trivially "pass" a guard that asserts nothing. Two named sites are known
  // to exist right now (cmdRenderMemmap()'s Markdown write and cmdCoverage()'s
  // JSON-report write); the floor is exactly that measured count, so a THIRD
  // write added later raises it rather than silently slipping through
  // unguarded.
  assert.ok(indices.length >= 2, `expected at least 2 writeFileSync( call sites, found ${indices.length}`);

  // Positive control: the scanner must actually be looking at the real content
  // at each site, not merely returning a fixed answer. Assert each known call
  // site's own arguments are visible in the matched text.
  const contexts = indices.map((idx) => source.slice(idx, idx + 60));
  assert.ok(
    contexts.some((c) => c.includes("outPath, rendered.markdown")),
    `expected to see cmdRenderMemmap()'s own write site among: ${JSON.stringify(contexts)}`,
  );
  assert.ok(
    contexts.some((c) => c.includes("out, JSON.stringify(report")),
    `expected to see cmdCoverage()'s own write site among: ${JSON.stringify(contexts)}`,
  );

  for (const idx of indices) {
    assert.ok(
      isWriteGuarded(stripped, idx),
      `writeFileSync( at source offset ${idx} (${JSON.stringify(source.slice(idx, idx + 60))}) is not inside a try block`,
    );
  }
});

test("structural (WR-09): the guard's planted violation is reported and its wrapped control is not (non-vacuity)", () => {
  const wrapped = `
function foo() {
  try {
    writeFileSync(p, s);
  } catch (err) {
    console.error(err);
  }
}
`;
  const bare = `
function foo() {
  writeFileSync(p, s);
}
`;

  const { stripped: wrappedStripped, indices: wrappedIndices } = findWriteFileSyncCalls(wrapped);
  assert.equal(wrappedIndices.length, 1);
  assert.ok(isWriteGuarded(wrappedStripped, wrappedIndices[0]!), "a try/catch-wrapped writeFileSync must be reported as guarded");

  const { stripped: bareStripped, indices: bareIndices } = findWriteFileSyncCalls(bare);
  assert.equal(bareIndices.length, 1);
  assert.ok(
    !isWriteGuarded(bareStripped, bareIndices[0]!),
    "a bare, function-top-level writeFileSync must be reported as NOT guarded -- the planted violation this guard exists to catch",
  );
});

test("in-process (WR-09): render-memmap with --out inside a non-existent directory fails with a one-line message naming the path, never a stack trace", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const provenancePath = join(dir, "sidecar.json");
    writeFileSync(provenancePath, "{}");
    const outPath = join(dir, "no-such-dir", "memory-map.md");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", outPath]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /^render-memmap:/);
    assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
  });
});
