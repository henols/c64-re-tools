// anno-decomp-closure.test.ts -- the OFFLINE closure regression, phase 45
// plan 45-10 (Task 2).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// Phase 45's evidence, up to this plan, is nine terminal transcripts, split
// across two independently-derived families -- one dxa-derived, one
// Ghidra-derived -- each a verbatim capture of the real `decomp-completeness`
// gate passing against a real derived-and-executed store, both taken on
// 2026-09-11.
// A transcript decays the moment someone edits a fixture: nothing re-checks
// it on the next commit. This file is the regression that keeps the phase's
// own closure claim true on EVERY CI run, mechanically, using nothing but
// what is already committed: the nine `.annostore.json` exports plan 45-02's
// `anno-store-export.mts` produces and this repository's own fixture images.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Proving, for each of the nine committed exports: (1) the export re-imports
// into a fresh store reproducing every row class; (2) the real disagreement
// query plus the real gate exits 0 over that re-imported store; (3) the
// three manifest-declared non-executed fixtures still render their own NOT
// EXECUTED line on a green run (D-13's anti-vacuity guard); (4) each of the
// gate's four zero-counts is asserted BY NAME, not only the exit code; and
// (5) the disagreement input is still load-bearing -- removing it makes the
// SAME gate exit non-zero, naming `--disagreements`, inside this suite.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never import `skills/c64-annotations/scripts/completeness-report.ts`.
//     `src/mcp/vice/**` and `skills/**` publish as SEPARATE npm packages
//     and cannot import each other (`acme-verify.ts`'s own header states this
//     constraint; `skill-assembler-cli.test.ts` is the sanctioned pattern
//     this file copies: SPAWN the skill script as a subprocess, never
//     `import` it).
//   - Never write a scratch store inside this repository's own tree. Every
//     temp directory here is `mkdtempSync(join(tmpdir(), ...))`, matching
//     `anno-store.test.ts`'s own convention -- this project has already had
//     an intermittent suite failure from scratch files racing inside the
//     repo tree (`audit-root-args.test.ts`'s `/tmp`-scratch race).
//   - Never spawn an emulator, `dxa`, Ghidra or ACME. Every input this file
//     needs is already committed; a live tool dependency here would turn a
//     regression into a re-run.
//   - Never add this file to `test-gate.ts`'s `MANUAL_ONLY_TESTS` -- it
//     needs no emulator and belongs in the automated set.
//   - Never default the disagreement input to an empty array anywhere in
//     this file's own helpers. The non-vacuity control at the bottom exists
//     precisely so a future change that makes `--disagreements` optional
//     reds this suite.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStore, closeStore } from "../../src/mcp/vice/anno-store.mts";
import { exportStoreDocument, importStoreDocument, STORE_EXPORT_SCHEMA_VERSION, type StoreExportDocument } from "../../src/mcp/vice/anno-store-export.mts";
import { runAnnoCli } from "../../src/mcp/vice/anno-cli.ts";
import { seedWorkspaceProject } from "./workspace-store-fixture.ts";
import { REPO_ROOT } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures");
const MANIFEST_PATH = join(FIXTURES_DIR, "decomp-execution-manifest.json");

// `src/mcp/vice/` -> `src/` -> `skills/c64-annotations/scripts/` --
// computed from THIS file's own location, matching `mcp-module.ts`'s own
// "computed hop count, never a fixed count" discipline (see that module's
// header on the stale-offset incident this project has already had).
const COMPLETENESS_SCRIPT = join(REPO_ROOT, "skills", "c64-annotations", "scripts", "completeness-report.ts");

interface FixtureSpec {
  readonly dir: string;
  readonly name: string;
}

/** All nine committed fixtures (45-CONTEXT.md's own fixture-set decision),
 * read from the two family closure documents' own file lists rather than
 * re-derived from a directory scan -- a scan would also need to exclude the
 * manifest and README files sitting beside the `.annostore.json` exports. */
const NINE_FIXTURES: readonly FixtureSpec[] = Object.freeze([
  { dir: "dxa", name: "tracer" },
  { dir: "dxa", name: "fixture" },
  { dir: "dxa", name: "basic-stub" },
  { dir: "ghidra", name: "bank" },
  { dir: "ghidra", name: "bank-path-dependent" },
  { dir: "ghidra", name: "charset-phantom" },
  { dir: "export-asm", name: "smc" },
  { dir: "petcat", name: "computed-sys" },
  { dir: "petcat", name: "not-basic" },
]);

interface ManifestEntry {
  path: string;
  execution: "executed" | "not-executed";
  reason: string | null;
}

const MANIFEST_RAW = readFileSync(MANIFEST_PATH, "utf8");
const MANIFEST_DOC = JSON.parse(MANIFEST_RAW) as { fixtures: ManifestEntry[] };

function manifestEntryFor(name: string): ManifestEntry {
  const entry = MANIFEST_DOC.fixtures.find((f) => f.path.endsWith(`/${name}.prg`));
  assert.ok(entry, `the manifest must carry an entry whose path ends in "/${name}.prg"`);
  return entry!;
}

/** The three fixtures the manifest itself declares NOT EXECUTED --
 * `manifestEntryFor()` derives it, this array is asserted against it below
 * rather than trusted as a hand-maintained duplicate. */
const NOT_EXECUTED_NAMES: readonly string[] = Object.freeze(
  NINE_FIXTURES.filter((f) => manifestEntryFor(f.name).execution === "not-executed").map((f) => f.name),
);

/** Captures `console.log`/`console.error` around `fn`, restoring both
 * unconditionally. Copied from `anno-cli.test.ts`'s own helper -- the SAME
 * shape, not a divergent reimplementation, since `runAnnoCli()` writes its
 * answer to `console.log` rather than returning it. */
async function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
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

interface FixtureWorkspace {
  tempDir: string;
  storePath: string;
  manifestPath: string;
  doc: StoreExportDocument;
  /** The fixture's name as `--fixture` takes it: its manifest path. */
  fixtureArg: string;
}

/**
 * Builds a fresh, workspace-confined scratch store for `fixture`'s committed
 * export, in an OS temp directory OUTSIDE the repository tree.
 *
 * `CLAUDE_PROJECT_DIR` is MOVED, not mocked, to that temp directory for the
 * duration of `body` -- `repoRoot()` (and therefore every `anno-cli.ts`
 * verb's own `storePathWithinWorkspace()` confinement) resolves against it,
 * exactly matching `anno-tools.test.ts`'s own established "the workspace
 * root is moved, not mocked" pattern. This is what reconciles two
 * requirements that would otherwise conflict: the store must live outside
 * this repository's own tree, and every `anno-cli.ts` verb this file drives
 * refuses a store path outside its own resolved workspace root by design
 * (T-29-28's mitigation, not an inconvenience to route around).
 *
 * The fixture's annotations are seeded as that workspace's own project, its
 * .c64-re-tools/annotations.db, which is what `evid-disagreements`,
 * `decomp-completeness` and the spawned gate all read.
 *
 * The manifest is copied into the SAME temp directory: `decomp-completeness`
 * confines `--manifest` the identical way, and the manifest's own fixture
 * matching is on bare stems (`fixtureStem()` in `anno-cli.ts`). The fixture's
 * image is copied beside it at its manifest path, because the verb reads the
 * image relative to the manifest file.
 */
async function withFixtureWorkspace<T>(fixture: FixtureSpec, body: (ws: FixtureWorkspace) => Promise<T>): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), "anno-decomp-closure-"));
  const previousProjectDir = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = tempDir;
  try {
    const manifestPath = join(tempDir, "decomp-execution-manifest.json");
    writeFileSync(manifestPath, MANIFEST_RAW, "utf8");
    mkdirSync(join(tempDir, fixture.dir), { recursive: true });
    copyFileSync(join(FIXTURES_DIR, fixture.dir, `${fixture.name}.prg`), join(tempDir, fixture.dir, `${fixture.name}.prg`));

    const docPath = join(FIXTURES_DIR, fixture.dir, `${fixture.name}.annostore.json`);
    const doc = JSON.parse(readFileSync(docPath, "utf8")) as StoreExportDocument;

    // The committed export, twice: into a scratch store file (Test 1's
    // round trip, an engine property) and into the workspace's own project
    // in the broker (every verb and the gate).
    const storePath = join(tempDir, `${fixture.name}.annostore`);
    const handle = openStore(storePath, { workspaceRoot: tempDir });
    try {
      importStoreDocument(handle, doc);
    } finally {
      closeStore(handle);
    }
    seedWorkspaceProject(tempDir, (project) => importStoreDocument(project, doc));

    return await body({ tempDir, storePath, manifestPath, doc, fixtureArg: `${fixture.dir}/${fixture.name}.prg` });
  } finally {
    if (previousProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previousProjectDir;
    rmSync(tempDir, { recursive: true, force: true });
  }
}

/** The CLI's dependencies for `workspace`: its own project, through the
 * default runner. */
function cliDeps(workspace: string) {
  return { workspaceRoot: workspace };
}

/** Runs `evid-disagreements --json` for `workspace`'s project through the
 * REAL `cmdEvidDisagreements()` dispatch (via `runAnnoCli()`), in-process --
 * the SAME code path a developer's CLI invocation takes (this task's own
 * read_first names it explicitly). Returns the parsed JSON answer, which is
 * exactly the document a real `--disagreements FILE` argument must contain. */
async function realDisagreements(workspace: string): Promise<unknown> {
  const { result: code, stdout, stderr } = await withCapturedConsole(() => runAnnoCli(["evid-disagreements", "--json"], cliDeps(workspace)));
  assert.equal(code, 0, `evid-disagreements must succeed for ${workspace}:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  return JSON.parse(stdout);
}

interface DecompCompletenessJson {
  executionDisposition: "executed" | "not-executed";
  notExecutedReason: string | null;
  byteCensus: { undefinedCount: number };
  survivors: readonly unknown[];
  imageUnavailable: boolean;
  entryPoints: readonly { address: number }[];
  referencedAddresses: { unresolved: readonly unknown[]; denominator: number };
  disagreementResolution: { unresolvedCount: number };
}

/** Runs `decomp-completeness --fixture ... --disagreements ... --manifest ...
 * --json` through the REAL `cmdDecompCompleteness()` dispatch, in-process.
 * Returns the structured report -- the SAME document
 * `completeness-report.ts`'s own `buildCompletenessReport()` normalises --
 * used here for the four NAMED zero-count assertions this task requires
 * (an exit code alone tells you it passed; these tell you WHAT passed). */
async function realCompletenessJson(
  workspace: string,
  fixtureArg: string,
  disagreementsPath: string,
  manifestPath: string,
): Promise<DecompCompletenessJson> {
  const { result: code, stdout, stderr } = await withCapturedConsole(() =>
    runAnnoCli(
      ["decomp-completeness", "--fixture", fixtureArg, "--disagreements", disagreementsPath, "--manifest", manifestPath, "--json"],
      cliDeps(workspace),
    ),
  );
  assert.equal(code, 0, `decomp-completeness --json must succeed for ${fixtureArg}:\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  return JSON.parse(stdout) as DecompCompletenessJson;
}

interface GateRun {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Spawns the REAL `c64-annotations` skill script with `argv`, returning
 * its real process exit code and both streams -- D-08's own numeric stop
 * condition, proven here exactly as `c64-annotations` itself observes
 * it. NEVER an `import` (see this file's header) -- always a subprocess,
 * matching `skill-assembler-cli.test.ts`'s own sanctioned cross-package
 * pattern. The gate's own CLI child reads `workspace`'s project.
 */
function spawnGate(workspace: string, argv: readonly string[]): GateRun {
  assert.ok(existsSync(COMPLETENESS_SCRIPT), `the c64-annotations gate script must exist at ${COMPLETENESS_SCRIPT}`);
  const env = { ...process.env, CLAUDE_PROJECT_DIR: workspace, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" };
  const r = spawnSync(process.execPath, [COMPLETENESS_SCRIPT, ...argv], { encoding: "utf8", timeout: 30_000, env });
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}

// ---------------------------------------------------------------------------
// Test 1 (per fixture): the re-import reproduces every row class.
// ---------------------------------------------------------------------------

for (const fixture of NINE_FIXTURES) {
  const label = `${fixture.dir}/${fixture.name}.prg`;

  test(`${label} -- Test 1: importing the committed export into a fresh store reproduces every row class (re-export deep-equal)`, async () => {
    await withFixtureWorkspace(fixture, async ({ storePath, doc }) => {
      const handle = openStore(storePath, { workspaceRoot: dirname(storePath), mustExist: true });
      let reExported: StoreExportDocument;
      try {
        reExported = exportStoreDocument(handle);
      } finally {
        closeStore(handle);
      }
      assert.deepStrictEqual(reExported, doc, `${label}: a fresh re-export of the re-imported store must be deep-equal to the committed document`);
    });
  });
}

// ---------------------------------------------------------------------------
// Test 2 + Test 4 (per fixture): the real disagreement query, the real
// gate's own exit code, and the four zero-counts asserted individually by
// name.
// ---------------------------------------------------------------------------

for (const fixture of NINE_FIXTURES) {
  const label = `${fixture.dir}/${fixture.name}.prg`;

  test(`${label} -- Test 2/4: the real disagreement query plus the real gate exit 0, with all four zero-counts named`, async () => {
    await withFixtureWorkspace(fixture, async ({ fixtureArg, manifestPath, tempDir }) => {
      const disagreements = await realDisagreements(tempDir);
      const disagreementsPath = join(tempDir, "disagreements.json");
      writeFileSync(disagreementsPath, JSON.stringify(disagreements), "utf8");

      const gate = spawnGate(tempDir, ["--fixture", fixtureArg, "--disagreements", disagreementsPath, "--manifest", manifestPath]);
      assert.equal(gate.status, 0, `${label}: the real c64-annotations gate script must exit 0:\nSTDOUT:\n${gate.stdout}\nSTDERR:\n${gate.stderr}`);
      assert.match(gate.stdout, /GATE: PASS/, `${label}: the rendered report must say GATE: PASS:\n${gate.stdout}`);

      const report = await realCompletenessJson(tempDir, fixtureArg, disagreementsPath, manifestPath);
      // THE FOUR ZERO-COUNTS, NAMED INDIVIDUALLY -- the exit code above
      // proves the gate passed; these prove WHAT passed.
      assert.equal(report.byteCensus.undefinedCount, 0, `${label}: byte census undefined count must be 0`);
      assert.equal(report.survivors.length, 0, `${label}: survivor auto-name count must be 0`);
      assert.equal(report.referencedAddresses.unresolved.length, 0, `${label}: unresolved referenced-address count must be 0`);
      assert.equal(report.disagreementResolution.unresolvedCount, 0, `${label}: unresolved disagreement count must be 0`);
    });
  });
}

// ---------------------------------------------------------------------------
// Test 3 (the three manifest-declared non-executed fixtures only): a GREEN
// run still renders its own NOT EXECUTED line and the manifest's reason --
// D-13's anti-vacuity guard for criterion 2, checked here mechanically
// rather than trusted from a transcript.
// ---------------------------------------------------------------------------

test("exactly three fixtures are manifest-declared NOT EXECUTED, matching this phase's own D-13 decision", () => {
  assert.deepStrictEqual(
    [...NOT_EXECUTED_NAMES].sort(),
    ["basic-stub", "computed-sys", "not-basic"],
    "the three non-executed fixtures must be exactly dxa/basic-stub.prg, petcat/computed-sys.prg and petcat/not-basic.prg",
  );
});

for (const fixture of NINE_FIXTURES.filter((f) => NOT_EXECUTED_NAMES.includes(f.name))) {
  const label = `${fixture.dir}/${fixture.name}.prg`;
  const manifestEntry = manifestEntryFor(fixture.name);

  test(`${label} -- Test 3: a GREEN gate run still renders NOT EXECUTED and the manifest's own reason`, async () => {
    await withFixtureWorkspace(fixture, async ({ fixtureArg, manifestPath, tempDir }) => {
      const disagreements = await realDisagreements(tempDir);
      const disagreementsPath = join(tempDir, "disagreements.json");
      writeFileSync(disagreementsPath, JSON.stringify(disagreements), "utf8");

      const gate = spawnGate(tempDir, ["--fixture", fixtureArg, "--disagreements", disagreementsPath, "--manifest", manifestPath]);
      assert.equal(gate.status, 0, `${label}: this fixture's gate must still be GREEN:\nSTDOUT:\n${gate.stdout}\nSTDERR:\n${gate.stderr}`);
      assert.match(gate.stdout, /NOT EXECUTED:/, `${label}: a non-executed fixture's report must render its own NOT EXECUTED line, even on a green run:\n${gate.stdout}`);
      assert.ok(manifestEntry.reason, `${label}: the manifest entry must carry a reason string`);
      assert.ok(
        gate.stdout.includes(manifestEntry.reason!),
        `${label}: the rendered report must carry the manifest's own reason text verbatim:\n${gate.stdout}`,
      );

      const report = await realCompletenessJson(tempDir, fixtureArg, disagreementsPath, manifestPath);
      assert.equal(report.executionDisposition, "not-executed", `${label}: the structured report's own executionDisposition must be "not-executed"`);
      assert.equal(report.notExecutedReason, manifestEntry.reason, `${label}: the structured report's own notExecutedReason must match the manifest's reason exactly`);
    });
  });
}

// ---------------------------------------------------------------------------
// Test 5: the non-vacuity control. Removing the disagreement input must make
// the SAME gate exit non-zero, naming `--disagreements` -- without this
// case, a future change that made the argument optional would leave every
// test above still green.
// ---------------------------------------------------------------------------

test("Test 5 (NON-VACUITY CONTROL): omitting --disagreements makes the real gate exit non-zero, naming --disagreements", async () => {
  const fixture = NINE_FIXTURES[0]!;
  await withFixtureWorkspace(fixture, async ({ fixtureArg, manifestPath, tempDir }) => {
    const gate = spawnGate(tempDir, ["--fixture", fixtureArg, "--manifest", manifestPath]);
    assert.notEqual(gate.status, 0, "omitting --disagreements must NOT exit 0 -- an omitted query and a query that found nothing must never look the same (D-09)");
    const combined = `${gate.stdout}${gate.stderr}`;
    assert.ok(combined.includes("--disagreements"), `the refusal must name --disagreements literally, by name:\n${combined}`);
  });
});

// ---------------------------------------------------------------------------
// 45-REVIEW WR-02 (fixed 2026-09-11): a manifest-listed fixture whose own
// image bytes cannot be located must report `imageUnavailable: true` and
// fabricate NO synthetic `$0000` entry point from a zero-length placeholder's
// own `origin` -- never reachable through any of the nine real committed
// fixtures (all nine images exist), so this scenario is built from scratch,
// entirely outside the repository tree, pointing the manifest at a fixture
// path that genuinely does not exist beside the manifest.
// ---------------------------------------------------------------------------

test("WR-02 Fix: a fixture whose image cannot be located reports imageUnavailable:true and fabricates no $0000 entry point, while real stored evidence still surfaces", async () => {
  const tempDir = mkdtempSync(join(tmpdir(), "anno-decomp-closure-wr02-"));
  const previousProjectDir = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = tempDir;
  try {
    // A manifest path that does NOT exist beside the manifest --
    // reproduces WR-02's exact trigger condition (existsSync(fixtureImagePath)
    // false) without touching any real committed fixture.
    const fakeFixturePath = "ghidra/does-not-exist-wr02.prg";
    assert.equal(existsSync(join(FIXTURES_DIR, fakeFixturePath)), false, "precondition: this path must genuinely not exist under fixtures/");

    const manifestPath = join(tempDir, "manifest.json");
    writeFileSync(
      manifestPath,
      JSON.stringify({ fixtures: [{ path: fakeFixturePath, execution: "executed", reason: null, ghidraRoute: "prg" }] }),
      "utf8",
    );

    {
      // A stored xref landing inside a code range is a REAL entry-point
      // candidate that needs no image bytes to establish (buildEntryPoints()
      // unions it independently of image.origin) -- present here specifically
      // so the assertion below distinguishes "the fix empties everything" from
      // "the fix removes only the fabricated $0000", the actual claim.
      const doc: StoreExportDocument = {
        schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
        ranges: [{ start: 0x1000, endInclusive: 0x1002, dataType: "code", bank: null, provenance: "derived" }],
        labels: [],
        comments: [],
        projectEnums: [],
        enumUsage: [],
        xrefs: [{ fromAddress: 0x0810, toAddress: 0x1000, accessKind: "COMPUTED_JUMP", bank: null }],
        execObservations: [],
        scopes: [],
        excludedRanges: [],
      };
      seedWorkspaceProject(tempDir, (project) => importStoreDocument(project, doc));
    }

    const disagreements = await realDisagreements(tempDir);
    const disagreementsPath = join(tempDir, "disagreements.json");
    writeFileSync(disagreementsPath, JSON.stringify(disagreements), "utf8");

    const report = await realCompletenessJson(tempDir, fakeFixturePath, disagreementsPath, manifestPath);
    assert.equal(report.imageUnavailable, true, "an unlocatable image must be reported BY NAME");
    assert.deepEqual(
      report.entryPoints.map((e) => e.address),
      [0x1000],
      "the real stored xref target must still surface -- only the fabricated image.origin ($0000) candidate is gone",
    );
    assert.ok(
      !report.entryPoints.some((e) => e.address === 0),
      "no synthetic $0000 entry point may be fabricated when the image is unavailable",
    );
  } finally {
    if (previousProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = previousProjectDir;
    rmSync(tempDir, { recursive: true, force: true });
  }
});
