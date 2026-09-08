#!/usr/bin/env node
// ghidra-live.test.ts
//
// Phase 36, plan 36-04 (GHID-01): OPT-IN, MANUAL-ONLY. Drives `ghidra-run.ts`'s
// `runGhidraAnalyze()` end to end against a REAL, installed Ghidra 12.1.3 and
// a REAL, already-installed `6502:LE:16:nmos` language extension (36-01/36-02
// already materialised it into `$GHIDRA_HOME`; this file never calls
// `ghidra.installExtension` itself -- it is READ-ONLY toward the Ghidra
// installation, per this plan's own threat model). This file BUILDS NOTHING:
// every case skips with a named reason when the opt-in variable, `GHIDRA_HOME`,
// or the installed language is absent.
//
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file via `*.test.*`, and no
// CI runner has a Ghidra installation. `SKIP_REASON` is computed exactly once
// from three conditions in order (opt-in variable, then GHIDRA_HOME/
// analyzeHeadless, then the installed language), and EVERY test in this file
// passes it through node:test's own `{ skip }` option -- never a hand-rolled
// early return, which would report a false PASS rather than a SKIP. It is
// registered in test-gate.mjs's MANUAL_ONLY_TESTS (the ONE list) as the
// ELEVENTH manual-only file, so `npm run test:automated` never runs it.
//
// Opt in with:
//   GHIDRA_HOME=/path/to/ghidra VICE_LIVE_GHIDRA=1 node --test ghidra-live.test.ts
//
// D-36-12: every case builds its OWN temporary workspace root via
// `mkdtempSync`, copies the committed fixtures (`fixtures/ghidra/bank.prg`)
// and the committed scripts (`vendor/ghidra-scripts/*.java`) into it, passes
// that root as `repoRoot`, and removes it in a `finally`. This repository's
// own `.c64-re-tools/` (and its non-dotted `c64-re-tools` handle, gap
// G-40-1, plan 40-08/40-09) is never touched -- passing this file's own
// directory as `repoRoot` would leave an untracked handle-plus-runs tree
// there, because BOTH `.gitignore` stanzas (`/.c64-re-tools/`, `/c64-re-tools`)
// are anchored at the repository root, not at this file's directory.
// RE-CHECKED against plan 40-08's own nested-root measurement (its SUMMARY's
// "git status --porcelain Nested-Root Measurement" section): a full
// `npm run test:automated` run followed by `git status --porcelain` showed
// nothing new under `src/mcp/vice/`, confirming the root-anchored patterns
// genuinely do not reach a nested location -- an earlier version of this
// comment named the now-retired per-run project directory's old two-segment
// location (under `tools/`) for the same reason; the reasoning stands, only
// the location changed. This host's
// `/tmp` is RAM-backed with ageing disabled, so an untorn-down tree is leaked
// memory, not leaked disk -- torn down anyway, always.
//
// THIS FILE OBSERVES ALL THREE OF `GHID-01`'s GATES FIRING ON A REAL RUN:
//   - GATE 1 (a thrown script is the exact-literal signal, never the exit
//     status, which is recorded as 0 on a run that failed);
//   - GATE 2 (the classification count read is the export script's own
//     computed block total, never the image's byte length, on BOTH import
//     routes -- the two routes' numbers are asserted to differ);
//   - GATE 3 (the run is reproducible from the committed script set with no
//     click-path, and Ghidra's own installed version is read from the
//     installation and asserted against a named constant, never assumed).
// See `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/
// evidence/36-04-three-gates.md` for the recorded transcript of all three
// gates firing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve as resolvePath, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { runGhidraAnalyze, classifyGhidraRunLog } from "./ghidra-run.ts";
import { installedLanguageIds, ghidraRunsRealRoot, ghidraRunsRoot, ensureGhidraRunsHandle, resolveGhidraProject, importRouteBaseAddr, GHIDRA_RUNS_HANDLE_NAME } from "./ghidra-project.mts";
import { repoRoot } from "./repo-root.ts";
// Phase 37, plan 37-08 (AUTO-07): the derived character-set range is computed
// from the fixture's own real CONST_WRITES facts, never hard-coded -- the
// SAME two production modules the join itself will use.
import { parseConstWrites, parseGhidraExport } from "./anno-import.ts";
import { deriveGraphicsRanges } from "./anno-graphics.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures", "ghidra");
const SCRIPTS_DIR = join(HERE, "vendor", "ghidra-scripts");

// This file's OWN corpus case (below) needs `runHostTool()` (host-tool.mts)
// directly, in-process -- no client subprocess and no skill script in the
// loop (Phase 40 plan 40-06). `host-tool.mts` is a HOST-BOUND source module
// whose own `ghidra-project.mjs` import only resolves once compiled
// alongside its sibling under `resources/` (build.ts's own committed
// output) -- a plain static import of the `.mts` source from this file
// would throw `ERR_MODULE_NOT_FOUND` at load time. A dynamic import of a
// `URL` (never a bare string literal specifier) keeps `tsc` from trying to
// resolve a declaration file for the plain `.mjs` target -- the SAME idiom
// `host-tool.test.ts` already uses for its own typed access to this
// artifact, minus that file's own `build()` call: THIS file's own header
// states it builds nothing, and `resources-sync.test.ts` (part of the
// automated suite) already gates the committed artifact's freshness.
const hostToolModule = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<
    | { ok: true; tool: string; exitStatus: number | null; results: Array<{ path: string; sha256: string; byteLength: number }>; stderrTail: string }
    | { ok: false; message: string }
  >;
};
const { runHostTool } = hostToolModule;

/** The new language this phase adds (36-01), and the stock language it must
 * never collide with. Byte-exact, case-sensitive comparisons throughout --
 * this project's own harness never case-folds a language id. */
const NMOS_LANGUAGE_ID = "6502:LE:16:nmos";

/** MEASURED this phase's own development install (`fixtures/ghidra/README.md`,
 * `36-RESEARCH.md` Standard Stack) -- `application.properties` under
 * `$GHIDRA_HOME/Ghidra/` is the installation's OWN declaration, read at test
 * time rather than assumed. JDK floor for this install: >= 21 (measured
 * OpenJDK 21.0.12.1 present), no stated ceiling. */
const EXPECTED_GHIDRA_VERSION = "12.1.3";

/** Computed exactly once, from three conditions in order -- each producing
 * its own named reason. Duplicated (never imported) in
 * ghidra-opcode-live.test.ts: two short duplicates are cheaper than raising
 * this module's own floor for a single shared production helper. */
function computeGhidraSkipReason(): string | false {
  if (process.env.VICE_LIVE_GHIDRA !== "1") {
    return (
      "ghidra-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_GHIDRA=1 to run it " +
      `(requires GHIDRA_HOME pointing at a real Ghidra installation with "${NMOS_LANGUAGE_ID}" installed).`
    );
  }
  const ghidraHome = process.env.GHIDRA_HOME;
  if (ghidraHome === undefined || ghidraHome === "") {
    return "VICE_LIVE_GHIDRA=1 but GHIDRA_HOME is unset -- set it to a Ghidra installation directory to run this file.";
  }
  const analyzeHeadlessPath = join(ghidraHome, "support", "analyzeHeadless");
  if (!existsSync(analyzeHeadlessPath)) {
    return `VICE_LIVE_GHIDRA=1 but GHIDRA_HOME's resolved "support/analyzeHeadless" does not exist at ${analyzeHeadlessPath} -- point GHIDRA_HOME at a real Ghidra installation.`;
  }
  const installed = installedLanguageIds(ghidraHome);
  const matched = installed.find((lang) => lang.id === NMOS_LANGUAGE_ID);
  if (matched === undefined || !matched.slafileExists) {
    return (
      `VICE_LIVE_GHIDRA=1 and GHIDRA_HOME is set, but the language "${NMOS_LANGUAGE_ID}" is not installed with an ` +
      `existing compiled language file -- run ghidra.installExtension to build it.`
    );
  }
  return false;
}

const SKIP_REASON: string | false = computeGhidraSkipReason();

interface ScratchWorkspace {
  root: string;
}

/** Builds a fresh temporary workspace root OUTSIDE this repository, copies
 * the committed `vendor/ghidra-scripts/` tree and `fixtures/ghidra/bank.prg`
 * into it, and returns the root -- passed as `repoRoot` to `runGhidraAnalyze()`
 * so every path a case supplies (`importPath`, `scriptPath`, `postScript`,
 * `exportPath`) resolves inside THIS workspace, never the real repository. */
function makeScratchWorkspace(): ScratchWorkspace {
  const root = mkdtempSync(join(tmpdir(), "ghidra-live-"));
  cpSync(SCRIPTS_DIR, join(root, "vendor", "ghidra-scripts"), { recursive: true });
  cpSync(join(FIXTURES_DIR, "bank.prg"), join(root, "bank.prg"));
  // Plan 37-02: the new two-caller path-dependent $01 fixture, copied
  // alongside `bank.prg` so every case (not only this plan's own) can reach
  // it without a second scratch-workspace builder.
  cpSync(join(FIXTURES_DIR, "bank-path-dependent.prg"), join(root, "bank-path-dependent.prg"));
  // Plan 37-08: the graphics-feedback before/after fixture, copied alongside
  // the others so this plan's own cases can reach it without a second
  // scratch-workspace builder.
  cpSync(join(FIXTURES_DIR, "charset-phantom.prg"), join(root, "charset-phantom.prg"));
  return { root };
}

function removeScratchWorkspace(ws: ScratchWorkspace): void {
  rmSync(ws.root, { recursive: true, force: true });
}

/** Generates the flat-64K variant of the bank fixture INSIDE the scratch
 * workspace -- a 65,536-byte buffer with `bank.prg`'s own code body placed at
 * its own load address (read off the `.prg`'s own two-byte header, never
 * hardcoded), the remainder zero. Generated fresh per case, never committed.
 * Returns the workspace-relative path. */
function generateFlat64kVariant(ws: ScratchWorkspace): string {
  const bankPrg = readFileSync(join(FIXTURES_DIR, "bank.prg"));
  const loadAddr = bankPrg[0]! | (bankPrg[1]! << 8);
  const body = bankPrg.subarray(2);
  const flat = new Uint8Array(65536);
  flat.set(body, loadAddr);
  const relPath = "bank-flat64k.bin";
  writeFileSync(join(ws.root, relPath), flat);
  return relPath;
}

/** A generic labelled-integer extraction over the export FILE's own text --
 * distinct from `classifyGhidraRunLog()`'s own classification pattern (which
 * reads RUN-LOG text, printed via `println()` with a trailing colon); the
 * export file's own lines carry no colon (`GhidraStructExport.java`'s
 * `classificationSection.append("CLASSIFICATION_EXPECTED_FROM_BLOCKS "
 * ).append(...)`). Returns `null` for either field when its own labelled line
 * is absent -- never an accidental zero. */
function parseExportClassificationCounts(exportText: string): { expected: number | null; observed: number | null } {
  const expectedMatch = /CLASSIFICATION_EXPECTED_FROM_BLOCKS (\d+)/.exec(exportText);
  const observedMatch = /CLASSIFICATION_OBSERVED (\d+)/.exec(exportText);
  return {
    expected: expectedMatch ? Number(expectedMatch[1]) : null,
    observed: observedMatch ? Number(observedMatch[1]) : null,
  };
}

// ---------------------------------------------------------------------------
// Task 1: one real seed case -- the .prg route, under the new language,
// asserting no thrown script and the requested language named in the log.
// ---------------------------------------------------------------------------

test(
  "ghidra-live SEED: a .prg-route run over bank.prg under 6502:LE:16:nmos succeeds with no thrown script and names the requested language",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const result = await runGhidraAnalyze(
        { runId: "seed-prg", importPath: "bank.prg", processor: NMOS_LANGUAGE_ID, importRoute: "prg", noanalysis: true },
        { repoRoot: ws.root },
      );
      assert.equal(result.language.present, true, "the run log must carry a Using Language/Compiler: line");
      if (result.language.present) {
        assert.equal(result.language.id, NMOS_LANGUAGE_ID, "the run log must name the requested language, byte-exactly");
      }
      const logText = readFileSync(result.runLogPath, "utf8");
      const verdict = classifyGhidraRunLog(logText);
      assert.equal(verdict.scriptThrew, false, "no script ran in this seed case, so no thrown-script signal may appear");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 2 (GHID-01, gate 1): a wrong expectedClassificationLines makes the
// export script throw for real, and the paired negative case succeeds when
// the override is omitted. See evidence/36-04-three-gates.md, Part: Gate 1.
// ---------------------------------------------------------------------------

test(
  "ghidra-live GATE 1: a wrong expectedClassificationLines makes the export script throw, and runGhidraAnalyze() surfaces it as a rejection rather than a normal result (CR-01)",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const exportRel = "gate1-wrong-export.txt";
      const runId = "gate1-wrong";

      // CR-01 fix: runGhidraAnalyze() now checks verdict.scriptThrew itself
      // and throws before ever returning -- this is the DIRECT assertion the
      // review demanded, replacing the prior manual re-parse of a normally
      // -returned result. The run log and export file are still inspected
      // below (reconstructed from runId/ghidraRunsRealRoot(), since a thrown
      // call yields no GhidraRunResult to read a runLogPath off of) to keep
      // this gate's original file-content assertions intact.
      await assert.rejects(
        () =>
          runGhidraAnalyze(
            {
              runId,
              importPath: "bank.prg",
              processor: NMOS_LANGUAGE_ID,
              importRoute: "prg",
              noanalysis: true,
              scriptPath: "vendor/ghidra-scripts",
              postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
              exportPath: exportRel,
              expectedClassificationLines: 1,
            },
            { repoRoot: ws.root },
          ),
        /scriptThrew|a script threw during this run/i,
        "runGhidraAnalyze must reject when the post-script threw, never return a normal result",
      );

      const runLogPath = join(ghidraRunsRealRoot(ws.root), `${runId}.ghidra-run.log`);
      const logText = readFileSync(runLogPath, "utf8");
      const verdict = classifyGhidraRunLog(logText);
      assert.equal(verdict.scriptThrew, true, "the run log must carry the exact literal thrown-script signal");

      const exportPath = join(ws.root, exportRel);
      if (existsSync(exportPath)) {
        const exportText = readFileSync(exportPath, "utf8");
        assert.equal(
          exportText.includes("## UNRESOLVED_DISPATCH"),
          false,
          "the export must not carry its final, completed-assertion section when the script threw before ever opening the file",
        );
      }
      // Absence entirely is the MEASURED behaviour (the throw fires before
      // GhidraStructExport.java ever opens a FileWriter for args[0]) -- both
      // branches of "does not exist or does not carry the completed line"
      // are handled, per this plan's own acceptance criterion.
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live GATE 1 (paired): omitting expectedClassificationLines lets the script succeed against its own computed block total",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const exportRel = "gate1-omitted-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "gate1-omitted",
          importPath: "bank.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const logText = readFileSync(result.runLogPath, "utf8");
      const verdict = classifyGhidraRunLog(logText);
      assert.equal(verdict.scriptThrew, false, "no thrown-script signal may appear when the internal assertion succeeds");

      const exportPath = join(ws.root, exportRel);
      assert.ok(existsSync(exportPath), "the export file must exist when the script completes");
      const exportText = readFileSync(exportPath, "utf8");
      assert.equal(exportText.includes("## UNRESOLVED_DISPATCH"), true, "the export must carry its final, completed-assertion section");

      const { expected, observed } = parseExportClassificationCounts(exportText);
      assert.ok(expected !== null && observed !== null, "the export must carry both labelled classification-count lines");
      assert.equal(observed, expected, "the observed count must equal the script's own computed block total (no override supplied)");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 3 (GHID-01, gate 2): the classification count on BOTH import routes,
// asserted as the block total and never the image's byte length -- the two
// routes' own numbers must differ. See evidence/36-04-three-gates.md,
// Part: Gate 2.
// ---------------------------------------------------------------------------

/** Set by the prg-route case below, read by the flat64k-route case
 * immediately after it (registration order, node:test's own default serial
 * execution) -- so the "the two routes differ" assertion sits beside the
 * flat64k case's own numbers rather than depending on a third, separately
 * ordered test. */
let gate2PrgObserved: number | undefined;

test(
  "ghidra-live GATE 2 (prg route): the observed classification count equals the script's own computed block total, and differs from the image's own byte length",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const exportRel = "gate2-prg-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "gate2-prg",
          importPath: "bank.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const { expected, observed } = parseExportClassificationCounts(exportText);
      assert.ok(Number.isInteger(expected) && Number.isInteger(observed), "both classification counts must be exact integers");
      assert.equal(observed, expected, "on the prg route, the observed count must equal the script's own computed block total");

      const bankPrgByteLength = readFileSync(join(FIXTURES_DIR, "bank.prg")).length;
      assert.notEqual(
        observed,
        bankPrgByteLength,
        "the observed block total must NOT equal the image's own byte length on the .prg route -- an implementation that reverted to the image size would pass an equality check and fail this one",
      );

      gate2PrgObserved = observed!;
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live GATE 2 (flat64k route): the observed classification count equals the script's own computed block total, coincides with the image size on this route, and differs from the prg route's own number",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateFlat64kVariant(ws);
      const exportRel = "gate2-flat64k-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "gate2-flat64k",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const { expected, observed } = parseExportClassificationCounts(exportText);
      assert.ok(Number.isInteger(expected) && Number.isInteger(observed), "both classification counts must be exact integers");
      assert.equal(observed, expected, "on the flat64k route, the observed count must equal the script's own computed block total");
      assert.equal(
        observed,
        65536,
        "on the flat64k route, the block total coincides with the full 65,536-byte image -- recorded as a coincidence of THIS route, not assumed for the prg route",
      );

      assert.notEqual(gate2PrgObserved, undefined, "the prg-route case must have run first and recorded its own observed count");
      assert.notEqual(observed, gate2PrgObserved, "the two routes' own observed classification counts must differ -- one route cannot stand in for the other");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 3 (GHID-01, gate 3): reproducibility from the committed script set,
// anchored to the fixture's own recorded sha256, plus Ghidra's own installed
// version read from the installation. See evidence/36-04-three-gates.md,
// Part: Gate 3.
// ---------------------------------------------------------------------------

test(
  "ghidra-live GATE 3: two runs under different run ids over the same fixture produce byte-identical export files, anchored to the fixture's own recorded sha256",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const bankPrgBytes = readFileSync(join(FIXTURES_DIR, "bank.prg"));
      const actualSha256 = createHash("sha256").update(bankPrgBytes).digest("hex");
      const readmeText = readFileSync(join(FIXTURES_DIR, "README.md"), "utf8");
      const readmeMatch = /`bank\.prg`\s*\|\s*\d+\s*\|\s*`([0-9a-f]{64})`/.exec(readmeText);
      assert.ok(readmeMatch, "fixtures/ghidra/README.md must record bank.prg's own sha256 in its provenance table");
      assert.equal(actualSha256, readmeMatch![1], "the committed fixture's own sha256 must match its README's recorded value -- the reproducibility claim is anchored to a known input");

      async function runOnce(runId: string, exportRel: string): Promise<Buffer> {
        const result = await runGhidraAnalyze(
          {
            runId,
            importPath: "bank.prg",
            processor: NMOS_LANGUAGE_ID,
            importRoute: "prg",
            noanalysis: true,
            scriptPath: "vendor/ghidra-scripts",
            postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
            exportPath: exportRel,
          },
          { repoRoot: ws.root },
        );
        assert.equal(result.exitStatus, 0);
        return readFileSync(join(ws.root, exportRel));
      }

      const exportA = await runOnce("gate3-repro-a", "gate3-repro-a-export.txt");
      const exportB = await runOnce("gate3-repro-b", "gate3-repro-b-export.txt");

      assert.equal(exportA.length, exportB.length, "the two runs' export files must be the same byte length");
      const digestA = createHash("sha256").update(exportA).digest("hex");
      const digestB = createHash("sha256").update(exportB).digest("hex");
      assert.equal(digestA, digestB, "the two runs' export files must be BYTE-IDENTICAL -- reproducible from the committed script set with no click-path");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live GATE 3: the installed Ghidra's own version is read from the installation and asserted against the version this phase was developed against",
  { skip: SKIP_REASON },
  () => {
    const ghidraHome = process.env.GHIDRA_HOME!;
    const propsPath = join(ghidraHome, "Ghidra", "application.properties");
    const propsText = readFileSync(propsPath, "utf8");
    const versionMatch = /^application\.version=(.+)$/m.exec(propsText);
    assert.ok(versionMatch, `${propsPath} must declare application.version -- Ghidra must be a declared host prerequisite BY VERSION, never an unpinned unpack`);
    const installedVersion = versionMatch![1]!.trim();
    assert.equal(
      installedVersion,
      EXPECTED_GHIDRA_VERSION,
      `installed Ghidra version "${installedVersion}" does not match the version this phase was developed against ("${EXPECTED_GHIDRA_VERSION}") -- a mismatch must surface as a NAMED failure, never a silent pass and never a hard block on a newer install`,
    );
  },
);

// ---------------------------------------------------------------------------
// Plan 36-05 (GHID-02, GHID-03): the volatile carve proven by DISAPPEARANCE,
// on both import routes. See evidence/36-05-volatile-disappearance.md for the
// full with-flag / without-flag / forced-conflict record and for a MEASURED
// finding this file's own assertions below are built on: the export's
// `## REFERENCES` section is populated from the reference manager at
// DISASSEMBLY time and is UNCHANGED by the volatile flag -- MEASURED,
// byte-identical `## REFERENCES` sections with and without volatility, this
// session, against the real installation. The actual dead-store elimination
// this Standing Constraint describes is visible ONLY in the decompiled C
// text `GhidraStructExport.java`'s new `## DECOMPILED_TEXT` section now
// carries (added this plan, additively, as the OTHER committed script this
// plan's own <files_modified> did not originally name -- see this plan's
// own SUMMARY for the full deviation record). This file therefore asserts
// hardware-access PRESENCE from `## REFERENCES` (Task 1; true either way,
// since references never vanish) and asserts the actual DISAPPEARANCE from
// `## DECOMPILED_TEXT` (Task 2; this is where the carve's effect is real).
//
// D-36-13 (scratch-copy discipline): every without-flag / forced-conflict
// case below reads the COMMITTED VolatileCarve.java, asserts each intended
// string replacement occurs EXACTLY ONCE (so a future edit to the committed
// script that removes the expected text fails loudly here rather than
// silently producing an unedited copy), writes the edited text into its OWN
// scratch script directory inside the workspace, and never touches the
// committed tree. `GhidraStructExport.java` is copied into the SAME
// directory, unedited, since `ghidra.analyze`'s `scriptPath` must contain
// both scripts a case references (MEASURED this plan: a script outside the
// registered `scriptPath` directory fails with "Script not found", even when
// referenced by its own full workspace-relative path).
// ---------------------------------------------------------------------------

/** The `.prg` route's own entry point for `bank.prg` -- MEASURED, this plan:
 * `ghidra.analyze`'s "prg" route loads the file through `BinaryLoader` with
 * NO awareness of the `.prg` format's own two-byte load-address header --
 * those two bytes ($01,$08) are loaded as ordinary CONTENT at the base
 * address, so every address `bank.a` labels lands two bytes LATER than the
 * source's own label once loaded through this route. The flat-64K route's
 * own `generateFlat64kVariant()` strips the header before embedding the body
 * (`bankPrg.subarray(2)`), so it uses the source's own UNSHIFTED addressing.
 * See `fixtures/ghidra/README.md`'s corrected table (this plan) for both
 * routes' own reference-dump lines and the root cause. */
const PRG_ROUTE_ENTRYPOINT = "$0812";
const FLAT64K_ROUTE_ENTRYPOINT = "$0810";

/** The fixture's seven hardware-access reference lines this fixture yields
 * under a correct volatile carve, per route -- MEASURED this plan, real
 * Ghidra 12.1.3, `fixtures/ghidra/README.md`'s corrected table. Four writes
 * to the processor port ($0001), two writes to the border-colour register
 * ($d020), one read of it. Access kind is asserted, never the address alone. */
const WITH_FLAG_REFERENCE_LINES_PRG: readonly string[] = [
  "0814 -> 0001 WRITE",
  "0818 -> d020 WRITE",
  "081e -> 0001 WRITE",
  "0822 -> d020 WRITE",
  "0825 -> d020 READ",
  "082a -> 0001 WRITE",
  "0839 -> 0001 WRITE",
];
const WITH_FLAG_REFERENCE_LINES_FLAT64K: readonly string[] = [
  "0812 -> 0001 WRITE",
  "0816 -> d020 WRITE",
  "081c -> 0001 WRITE",
  "0820 -> d020 WRITE",
  "0823 -> d020 READ",
  "0828 -> 0001 WRITE",
  "0837 -> 0001 WRITE",
];

/** The decompiled-C literal statements this fixture yields under a correct
 * (with-flag) volatile carve -- MEASURED this plan, real Ghidra 12.1.3,
 * `## DECOMPILED_TEXT`, both routes byte-identical in their own statement
 * text (only the function's own address label differs). The read is
 * asserted via its right-hand-side shape (`= DAT_d020;`) rather than a
 * decompiler-assigned variable name, which is not a stable identifier. */
const WITH_FLAG_DECOMPILED_STATEMENTS: readonly string[] = [
  "DAT_0001 = 0x37;",
  "DAT_d020 = 5;",
  "DAT_0001 = 0x34;",
  "DAT_d020 = 0xaa;",
  "= DAT_d020;",
  "DAT_0001 = 0x33;",
];

/** Of the six statements above, MEASURED this plan: these two SURVIVE a
 * without-flag (non-volatile) carve -- each is the LAST write to its own
 * target with no subsequent read, so the decompiler's own dead-store
 * elimination never reaches them. The other four are the ones Task 2 proves
 * vanish. */
const WITHOUT_FLAG_SURVIVING_STATEMENTS: readonly string[] = ["DAT_d020 = 0xaa;", "DAT_0001 = 0x37;"];
const WITHOUT_FLAG_VANISHED_STATEMENTS: readonly string[] = WITH_FLAG_DECOMPILED_STATEMENTS.filter(
  (s) => !WITHOUT_FLAG_SURVIVING_STATEMENTS.includes(s),
);

/** Writes a one-line entry-point file inside the workspace, workspace-relative. */
function writeEntrypointsFile(ws: ScratchWorkspace, hexAddr: string, relName: string): string {
  writeFileSync(join(ws.root, relName), hexAddr + "\n");
  return relName;
}

/** Extracts a named `## SECTION` block's own text (from its own header line
 * up to, but not including, the NEXT `## ` header, or end of string) --
 * generic over the export file's own fixed section order. */
function extractSection(exportText: string, header: string): string {
  const startIdx = exportText.indexOf(header);
  assert.notEqual(startIdx, -1, `extractSection: ${JSON.stringify(header)} not found in export text`);
  const afterHeader = exportText.slice(startIdx + header.length);
  const nextHeaderIdx = afterHeader.indexOf("\n## ");
  return nextHeaderIdx === -1 ? afterHeader : afterHeader.slice(0, nextHeaderIdx);
}

/** D-36-13: reads the COMMITTED `VolatileCarve.java`, applies each
 * caller-supplied string replacement (asserted present EXACTLY ONCE before
 * substitution), writes the result into its own scratch script directory
 * inside the workspace, and copies the committed (unedited)
 * `GhidraStructExport.java` alongside it. Returns the workspace-relative
 * directory, suitable as `scriptPath`. The committed tree is only ever READ. */
function makeEditedVolatileCarveScriptDir(
  ws: ScratchWorkspace,
  dirName: string,
  replacements: ReadonlyArray<readonly [string, string]>,
): string {
  const committedSource = readFileSync(join(SCRIPTS_DIR, "VolatileCarve.java"), "utf8");
  let edited = committedSource;
  for (const [oldStr, newStr] of replacements) {
    const occurrences = edited.split(oldStr).length - 1;
    assert.equal(
      occurrences,
      1,
      `makeEditedVolatileCarveScriptDir: expected exactly one occurrence of ${JSON.stringify(oldStr)} in the committed VolatileCarve.java, found ${occurrences} -- the committed script has drifted from what this edit expects`,
    );
    edited = edited.split(oldStr).join(newStr);
  }
  assert.notEqual(edited, committedSource, "makeEditedVolatileCarveScriptDir: the edit produced no change at all");
  const relDir = join("vendor-scratch", dirName, "ghidra-scripts");
  const absDir = join(ws.root, relDir);
  mkdirSync(absDir, { recursive: true });
  writeFileSync(join(absDir, "VolatileCarve.java"), edited);
  cpSync(join(SCRIPTS_DIR, "GhidraStructExport.java"), join(absDir, "GhidraStructExport.java"));
  return relDir;
}

/** D-36-13's neutralising edit for Task 2: the disappearance proof. Both
 * flag-setting calls -- the existing-block branch AND the create branch --
 * are forced to `false`, so a route whose branch was left intact could not
 * keep its writes and the case would read as a partial disappearance rather
 * than a clean one (this task's own read_first warning). */
const NEUTRALISE_VOLATILE_FLAG: ReadonlyArray<readonly [string, string]> = [
  ["            blk.setVolatile(true);\n", "            blk.setVolatile(false); // NEUTRALISED for the disappearance proof (scratch copy only, never committed)\n"],
  ["        nb.setVolatile(true);\n", "        nb.setVolatile(false); // NEUTRALISED for the disappearance proof (scratch copy only, never committed)\n"],
];

/** D-36-13's forced-conflict edit for Task 3. Removing ONLY the pre-carve
 * split is not sufficient to force a THROWN conflict on the route where a
 * loader-owned block already covers the target range (MEASURED this plan):
 * on that route `getBlock()` never returns null in the first place (a single
 * block spans the whole image), so the existing-block branch is always
 * taken and the split is already a no-op there. Forcing the create branch to
 * be entered -- and therefore forcing the conflict -- requires bypassing the
 * existing-block check entirely, collapsing `makeVolatile()` to always
 * attempt `createUninitializedBlock()`. This is the naive shape this
 * script's own header warns never to copy, taken to its real conclusion: a
 * genuine `MemoryConflictException`, thrown for real, never swallowed. */
const FORCE_CONFLICT_EDIT: ReadonlyArray<readonly [string, string]> = [
  ["        carve(mem, sp);\n", "        // carve(mem, sp); -- REMOVED for the forced-conflict proof (scratch copy only, never committed)\n"],
  [
    "        MemoryBlock blk = mem.getBlock(addr);\n" +
      "        if (blk != null) {\n" +
      "            blk.setVolatile(true);\n" +
      "            println(\"VOLATILE-SET: \" + blk.getName() + \" \" + blk.getStart() + \"-\" + blk.getEnd());\n" +
      "            if (!blk.getStart().equals(addr)) {\n" +
      "                println(\"VOLATILE-WARN: block \" + blk.getName() + \" starts at \" + blk.getStart()\n" +
      "                        + \", not at the requested \" + addr\n" +
      "                        + \" -- volatility is wider than intended, the carve did not take\");\n" +
      "            }\n" +
      "            return;\n" +
      "        }\n" +
      "        MemoryBlock nb = mem.createUninitializedBlock(\n" +
      "                \"VOL_\" + Long.toHexString(start), addr, len, false);\n" +
      "        nb.setVolatile(true);\n" +
      "        nb.setRead(true);\n" +
      "        nb.setWrite(true);\n" +
      "        println(\"VOLATILE-NEW: \" + nb.getName() + \" \" + nb.getStart() + \"-\" + nb.getEnd()\n" +
      "                + \" (.prg route -- no existing block covered this address)\");\n",
    "        // getBlock-first check REMOVED for the forced-conflict proof (scratch copy only, never committed):\n" +
      "        // always attempt to create, so a loader-owned block already covering part of this range\n" +
      "        // throws MemoryConflictException for real, instead of being silently found and flagged.\n" +
      "        MemoryBlock nb = mem.createUninitializedBlock(\n" +
      "                \"VOL_\" + Long.toHexString(start), addr, len, false);\n" +
      "        nb.setVolatile(true);\n" +
      "        nb.setRead(true);\n" +
      "        nb.setWrite(true);\n" +
      "        println(\"VOLATILE-NEW: \" + nb.getName() + \" \" + nb.getStart() + \"-\" + nb.getEnd());\n",
  ],
];

// ---------------------------------------------------------------------------
// Task 1: the with-flag reference section, on both routes.
// ---------------------------------------------------------------------------

test(
  "ghidra-live VOLATILE (prg route, with flag): the fixture's hardware accesses survive as typed reference lines, and the carve creates the I/O-page block",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const entrypointsRel = writeEntrypointsFile(ws, PRG_ROUTE_ENTRYPOINT, "entrypoints.txt");
      const exportRel = "withflag-prg-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "vol-withflag-prg",
          importPath: "bank.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the with-flag prg-route case must not throw");

      // Carve branch, read from the pre-script's own printed output: the
      // processor port's ZERO_PAGE default block DOES exist on the prg
      // route, so the split succeeds and the existing sub-block is flagged;
      // nothing covers the I/O page, so the split is skipped and the create
      // branch fires.
      assert.match(logText, /SPLIT-OK at 2\b/);
      assert.match(logText, /SPLIT-SKIP at d000: no block covers this address/);
      assert.match(logText, /SPLIT-SKIP at e000: no block covers this address/);
      assert.match(logText, /VOLATILE-SET: \S+ 0000-0001/);
      assert.match(logText, /VOLATILE-NEW: VOL_d000 d000-dfff/);
      const blockCountMatch = /VOLATILE-BLOCK-COUNT: (\d+)/.exec(logText);
      assert.ok(blockCountMatch, "VOLATILE-BLOCK-COUNT line must be present");
      assert.ok(Number(blockCountMatch![1]) >= 2, "the printed volatile-block count must be at least the number of declared volatile ranges (2)");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const referencesText = extractSection(exportText, "## REFERENCES");
      for (const line of WITH_FLAG_REFERENCE_LINES_PRG) {
        assert.ok(referencesText.includes(line), `expected reference line ${JSON.stringify(line)} present in the prg-route with-flag export`);
      }
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");
      for (const stmt of WITH_FLAG_DECOMPILED_STATEMENTS) {
        assert.ok(decompiledText.includes(stmt), `expected decompiled statement ${JSON.stringify(stmt)} present in the prg-route with-flag export`);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live VOLATILE (flat64k route, with flag): the fixture's hardware accesses survive as typed reference lines, and the carve flags the EXISTING block after splitting",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateFlat64kVariant(ws);
      const entrypointsRel = writeEntrypointsFile(ws, FLAT64K_ROUTE_ENTRYPOINT, "entrypoints.txt");
      const exportRel = "withflag-flat64k-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "vol-withflag-flat64k",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the with-flag flat64k-route case must not throw");

      // Carve branch: the loader owns ONE block spanning the whole image, so
      // ALL THREE splits succeed and BOTH volatile ranges flag an EXISTING
      // (post-split) block -- D-36-14's own route dependence.
      assert.match(logText, /SPLIT-OK at 2\b/);
      assert.match(logText, /SPLIT-OK at d000\b/);
      assert.match(logText, /SPLIT-OK at e000\b/);
      assert.match(logText, /VOLATILE-SET: \S+ 0000-0001/);
      assert.match(logText, /VOLATILE-SET: \S+ d000-dfff/);
      assert.doesNotMatch(logText, /VOLATILE-NEW/, "the flat64k route must never enter the create branch -- a block already covers both ranges");
      const blockCountMatch = /VOLATILE-BLOCK-COUNT: (\d+)/.exec(logText);
      assert.ok(blockCountMatch, "VOLATILE-BLOCK-COUNT line must be present");
      assert.ok(Number(blockCountMatch![1]) >= 2, "the printed volatile-block count must be at least the number of declared volatile ranges (2)");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const referencesText = extractSection(exportText, "## REFERENCES");
      for (const line of WITH_FLAG_REFERENCE_LINES_FLAT64K) {
        assert.ok(referencesText.includes(line), `expected reference line ${JSON.stringify(line)} present in the flat64k-route with-flag export`);
      }
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");
      for (const stmt of WITH_FLAG_DECOMPILED_STATEMENTS) {
        assert.ok(decompiledText.includes(stmt), `expected decompiled statement ${JSON.stringify(stmt)} present in the flat64k-route with-flag export`);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 2: remove the flag and observe the writes vanish -- on both routes.
// ---------------------------------------------------------------------------

test(
  "ghidra-live VOLATILE (prg route, without flag): the decompiled hardware writes VANISH, and the run otherwise completes normally",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const scriptDir = makeEditedVolatileCarveScriptDir(ws, "noflag-prg", NEUTRALISE_VOLATILE_FLAG);
      const entrypointsRel = writeEntrypointsFile(ws, PRG_ROUTE_ENTRYPOINT, "entrypoints.txt");
      const exportRel = "noflag-prg-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "vol-noflag-prg",
          importPath: "bank.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: scriptDir,
          preScript: join(scriptDir, "VolatileCarve.java"),
          entrypointsPath: entrypointsRel,
          postScript: join(scriptDir, "GhidraStructExport.java"),
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "removing the flag must not itself throw -- the carve still completes, just without volatility");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      assert.ok(exportText.includes("## UNRESOLVED_DISPATCH"), "the without-flag export must still carry its completed-assertion section");
      const referenceCountMatch = /## REFERENCE_COUNT (\d+)/.exec(exportText);
      assert.ok(referenceCountMatch && Number(referenceCountMatch[1]) > 0, "the without-flag export must carry a non-trivial reference count");

      // MEASURED (this plan): `## REFERENCES` is UNCHANGED by the volatile
      // flag -- every reference line Task 1 asserted present is STILL
      // present here. The disappearance is real, but it is not visible in
      // this section; asserting so here is itself part of the record.
      const referencesText = extractSection(exportText, "## REFERENCES");
      for (const line of WITH_FLAG_REFERENCE_LINES_PRG) {
        assert.ok(referencesText.includes(line), `MEASURED finding: reference line ${JSON.stringify(line)} must STILL be present without the flag -- ## REFERENCES never reflects volatility`);
      }

      // The actual disappearance: per statement, not merely a lower count.
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");
      for (const stmt of WITHOUT_FLAG_VANISHED_STATEMENTS) {
        assert.equal(decompiledText.includes(stmt), false, `expected decompiled statement ${JSON.stringify(stmt)} to be ABSENT without the volatile flag (prg route)`);
      }
      for (const stmt of WITHOUT_FLAG_SURVIVING_STATEMENTS) {
        assert.ok(decompiledText.includes(stmt), `expected decompiled statement ${JSON.stringify(stmt)} to SURVIVE even without the volatile flag (prg route) -- it is the last write to its own target`);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live VOLATILE (flat64k route, without flag): the decompiled hardware writes VANISH, and the run otherwise completes normally",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateFlat64kVariant(ws);
      const scriptDir = makeEditedVolatileCarveScriptDir(ws, "noflag-flat64k", NEUTRALISE_VOLATILE_FLAG);
      const entrypointsRel = writeEntrypointsFile(ws, FLAT64K_ROUTE_ENTRYPOINT, "entrypoints.txt");
      const exportRel = "noflag-flat64k-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "vol-noflag-flat64k",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: scriptDir,
          preScript: join(scriptDir, "VolatileCarve.java"),
          entrypointsPath: entrypointsRel,
          postScript: join(scriptDir, "GhidraStructExport.java"),
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "removing the flag must not itself throw -- the carve still completes, just without volatility");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      assert.ok(exportText.includes("## UNRESOLVED_DISPATCH"), "the without-flag export must still carry its completed-assertion section");
      const referenceCountMatch = /## REFERENCE_COUNT (\d+)/.exec(exportText);
      assert.ok(referenceCountMatch && Number(referenceCountMatch[1]) > 0, "the without-flag export must carry a non-trivial reference count");

      const referencesText = extractSection(exportText, "## REFERENCES");
      for (const line of WITH_FLAG_REFERENCE_LINES_FLAT64K) {
        assert.ok(referencesText.includes(line), `MEASURED finding: reference line ${JSON.stringify(line)} must STILL be present without the flag -- ## REFERENCES never reflects volatility`);
      }

      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");
      for (const stmt of WITHOUT_FLAG_VANISHED_STATEMENTS) {
        assert.equal(decompiledText.includes(stmt), false, `expected decompiled statement ${JSON.stringify(stmt)} to be ABSENT without the volatile flag (flat64k route)`);
      }
      for (const stmt of WITHOUT_FLAG_SURVIVING_STATEMENTS) {
        assert.ok(decompiledText.includes(stmt), `expected decompiled statement ${JSON.stringify(stmt)} to SURVIVE even without the volatile flag (flat64k route) -- it is the last write to its own target`);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Task 3: a memory conflict is loud, not a silent fall-back.
// ---------------------------------------------------------------------------

test(
  "ghidra-live VOLATILE forced conflict (flat64k route): a genuine MemoryConflictException is thrown, on a run whose exit status is 0",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateFlat64kVariant(ws);
      const scriptDir = makeEditedVolatileCarveScriptDir(ws, "forced-conflict", FORCE_CONFLICT_EDIT);
      const exportRel = "forced-conflict-export.txt";
      const runId = "vol-forced-conflict";

      // CR-01 fix: runGhidraAnalyze() now checks verdict.scriptThrew itself
      // and rejects before ever returning a GhidraRunResult -- mirroring the
      // GATE 1 fix above (this same file, "GATE 1" case). A thrown call
      // yields no result, so the run log is reconstructed below from
      // runId/ghidraRunsRealRoot() (the same technique GATE 1 uses) and the
      // export path is reconstructed from exportRel, which was always
      // workspace-relative and never depended on the return value. The
      // exit-status assertion is preserved by reading it out of the
      // rejection's own message, which embeds `response.exitStatus`
      // (ghidra-run.ts:242) -- the only place that value is reachable once
      // the call throws instead of returning a GhidraRunResult.
      await assert.rejects(
        () =>
          runGhidraAnalyze(
            {
              runId,
              importPath: flatRelPath,
              processor: NMOS_LANGUAGE_ID,
              importRoute: "flat64k",
              noanalysis: true,
              scriptPath: scriptDir,
              preScript: join(scriptDir, "VolatileCarve.java"),
              postScript: join(scriptDir, "GhidraStructExport.java"),
              exportPath: exportRel,
            },
            { repoRoot: ws.root },
          ),
        (thrown: unknown) => {
          const message = thrown instanceof Error ? thrown.message : String(thrown);
          assert.match(
            message,
            /scriptThrew|a script threw during this run/i,
            "runGhidraAnalyze must reject when the pre-script threw, never return a normal result",
          );
          // The exit status is recorded as evidence that it is UNINFORMATIVE,
          // never a pass signal -- exactly like GATE 1 (plan 36-04).
          assert.match(
            message,
            /exit status \(0\)/,
            "analyzeHeadless's own exit status must be recorded as 0 even though the pre-script threw",
          );
          return true;
        },
        "runGhidraAnalyze must reject when the pre-script threw a genuine MemoryConflictException",
      );

      const runLogPath = join(ghidraRunsRealRoot(ws.root), `${runId}.ghidra-run.log`);
      const logText = readFileSync(runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, true, "the run log must carry the exact literal thrown-script signal");
      assert.match(logText, /MemoryConflictException/, "the thrown exception must be the genuine memory-conflict type, not some other failure");

      // MEASURED, and disclosed rather than hidden: analyzeHeadless still
      // runs the post-script for this SAME program after the pre-script
      // threw, and that post-script's own export completes NORMALLY -- with
      // zero functions found, since the pre-script's own analyzeAll() call
      // never ran (the throw aborted its run() method before reaching it).
      // The export's own completion is proof of NOTHING about whether the
      // carve succeeded; the thrown-script literal in the RUN LOG is the
      // only reliable signal. This is a stronger, MEASURED version of this
      // plan's original prohibition ("a run that completes with the flag
      // unset is the failure this plan exists to make impossible") -- the
      // failure mode is not merely possible, it is what a naive "did the
      // export complete" check would actually observe on this exact run.
      const exportPath = join(ws.root, exportRel);
      assert.ok(existsSync(exportPath), "MEASURED finding: the export file DOES exist even though the pre-script threw");
      const exportText = readFileSync(exportPath, "utf8");
      assert.ok(
        exportText.includes("## UNRESOLVED_DISPATCH"),
        "MEASURED finding: the export DOES carry its completed-assertion section even though the carve never took effect -- export completion proves nothing about the carve",
      );
      assert.ok(exportText.includes("DECOMPILE_ZERO_FUNCTIONS true"), "no entry points were ever seeded (the pre-script aborted before readEntryPoints()), so zero functions were decompiled");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live VOLATILE forced conflict, companion (flat64k route): the committed script sets the flag on the EXISTING block after the split, with no wider-than-requested warning",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateFlat64kVariant(ws);
      const result = await runGhidraAnalyze(
        {
          runId: "vol-forced-conflict-companion",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the committed, unedited script must not throw on this route");
      assert.match(logText, /SPLIT-OK at d000\b/, "the committed script must actually split at the I/O page boundary on this route");
      assert.match(logText, /VOLATILE-SET: \S+ d000-dfff/, "the flag must be set on the EXISTING (post-split) block");
      assert.doesNotMatch(
        logText,
        /VOLATILE-WARN/,
        "the wider-than-requested warning must be ABSENT -- its presence would mean the flag landed on the whole image, which looks like success and is the trap",
      );
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 36-07 (GHID-04, GHID-05): the acceptance run -- structural facts no
// listing-level query can produce, typed cross-references, per-function
// accounting under a committed ceiling, denominator-free unresolved-dispatch
// reporting, and byte-reproducibility -- on the SAME real corpus program
// Task 1 (`ghidra-opcode-live.test.ts`'s own CORPUS case) exercised.
// D-36-18/D-36-20: same corpus route, same second opt-in, duplicated here
// (not imported) per this file's own "two short duplicates" convention.
//
// Then (GHID-04's control): the SAME script, image, route and language,
// differing only in the mode argument that selects `DataTypeManager` instead
// of `DecompInterface` -- invoked DIRECTLY against `analyzeHeadless`, outside
// `ghidra.analyze`'s typed seam, per plan 36-03's own key-decision: that
// seam supplies only the export path and the expected-line override as
// positional script arguments, and the mode selector
// (`GhidraStructExport.java`'s `getScriptArgs()[2]`) is not yet reachable
// through it.
// ---------------------------------------------------------------------------

const CORPUS_PATH = join(
  repoRoot({ from: HERE }),
  ".planning",
  "phases",
  "23-the-real-release-gate-go-degrade-no-go",
  "evidence",
  "corpus",
  "danish.d64",
);

/** Gated behind BOTH `VICE_LIVE_GHIDRA=1` (this file's own opt-in, above) AND
 * its OWN `VICE_LIVE_GHIDRA_CORPUS=1` -- mirrors
 * `ghidra-opcode-live.test.ts`'s own identically-shaped corpus gate. */
const CORPUS_SKIP_REASON: string | false =
  SKIP_REASON !== false
    ? SKIP_REASON
    : process.env.VICE_LIVE_GHIDRA_CORPUS !== "1"
      ? "ghidra-live.test.ts's corpus case is opt-in and default-skipped -- set VICE_LIVE_GHIDRA_CORPUS=1 (in addition to VICE_LIVE_GHIDRA=1) to run it."
      : !existsSync(CORPUS_PATH)
        ? `VICE_LIVE_GHIDRA_CORPUS=1 but the corpus image does not exist at ${CORPUS_PATH} -- this repository never commits it (D-04, ` +
          `.planning/phases/23-.../evidence/README.md convention 10); obtain the Phase 23 corpus release separately.`
        : false;

/** The SAME five entry points `ghidra-opcode-live.test.ts`'s own CORPUS case
 * derives and documents in full (MEASURED this plan, real Ghidra 12.1.3,
 * against `danish.d64`'s own first entry) -- duplicated here, not imported,
 * per this file's own established convention. See that file's own comment
 * for the full derivation of each. */
const CORPUS_ENTRY_POINTS: readonly string[] = ["$081b", "$b70a", "$b74c", "$b7e7", "$b790"];

/** The smallest common ancestor directory of two absolute paths -- computed,
 * never a fixed guess, so the seam request's `repoRoot` for THIS call is
 * always exactly big enough to contain both the corpus image and the
 * scratch output directory, and no bigger. Mirrors `c1541.mjs`'s own
 * `commonAncestorDir()` (`src/skills/c64-disk-access/scripts/c1541.mjs`),
 * duplicated here rather than imported -- this file must never reach into a
 * skill script (D-36-12's own container/host-side split; a skill script
 * additionally ships in the OTHER npm package). */
function commonAncestorDir(a: string, b: string): string {
  const partsA = resolvePath(a).split(sep);
  const partsB = resolvePath(b).split(sep);
  const common: string[] = [];
  for (let i = 0; i < Math.min(partsA.length, partsB.length); i++) {
    if (partsA[i] === partsB[i]) common.push(partsA[i]!);
    else break;
  }
  const joined = common.join(sep);
  return joined === "" ? sep : joined;
}

/** `path.relative()`, except the "same directory" case yields `"."` rather
 * than `""` -- `resolveWorkspacePath()` (host-tool.mts) refuses an empty
 * string but accepts `"."` as a no-op relative reference to its own root. */
function toRel(root: string, abs: string): string {
  const r = relative(root, abs);
  return r === "" ? "." : r;
}

/** Reads the corpus release, extracts its first directory entry's program
 * bytes over the host-tool seam (`c1541.dir` then `c1541.read`) -- the ONE
 * disk-image route this project has (D-04, D-08). Before 2026-09-08 (Phase
 * 40 plan 40-06) this called the now-deleted MCP-side pure-parse module's
 * own in-process directory-and-entry reader directly; that module carried
 * no seam dependency of its own, and this is its replacement. ACCEPTED
 * COST, same date: the deleted module needed nothing running to answer
 * this; the seam route needs a resolvable `c1541` sibling binary and, on
 * the container route, the broker up -- already covered by this file's own
 * live-gate skip behaviour above, so that cost never surfaces here as an
 * unexplained failure. */
async function extractCorpusProgram(): Promise<Uint8Array> {
  const scratch = mkdtempSync(join(tmpdir(), "ghidra-live-corpus-"));
  try {
    const root = commonAncestorDir(dirname(CORPUS_PATH), scratch);
    const baseArgs = { image: toRel(root, CORPUS_PATH), outDir: toRel(root, scratch) };

    const dirResp = await runHostTool({ tool: "c1541.dir", args: baseArgs }, { repoRoot: root });
    if (!dirResp.ok) throw new Error(`ghidra-live acceptance: c1541.dir refused: ${dirResp.message}`);
    const listingPath = dirResp.results[0]?.path;
    if (!listingPath) throw new Error("ghidra-live acceptance: c1541.dir reported no listing output");
    const listingText = readFileSync(listingPath, "utf8");
    const entryMatch = listingText.match(/^\s*\d+\s+"([^"]*)"\s+\*?(?:prg|seq|usr|rel|del)\b/im);
    if (!entryMatch) throw new Error("ghidra-live acceptance: the corpus image's directory listing has no entries");
    const entryName = entryMatch[1]!.replace(/\s+$/, "");

    const readResp = await runHostTool({ tool: "c1541.read", args: { ...baseArgs, name: entryName } }, { repoRoot: root });
    if (!readResp.ok) throw new Error(`ghidra-live acceptance: c1541.read refused: ${readResp.message}`);
    const readPath = readResp.results[0]?.path;
    if (!readPath) throw new Error("ghidra-live acceptance: c1541.read reported no output file");
    return new Uint8Array(readFileSync(readPath));
  } finally {
    rmSync(scratch, { recursive: true, force: true });
  }
}

interface StructuralFactLine {
  kind: string;
  found: boolean;
}

/** Parses `## STRUCTURAL_FACTS`'s own `STRUCTURAL_FACT <KIND> found|not-found ...`
 * lines. Multiple `found` lines for the same kind are each their own entry
 * (this project's own export prints one line per occurrence). */
function parseStructuralFacts(exportText: string): StructuralFactLine[] {
  const section = extractSection(exportText, "## STRUCTURAL_FACTS");
  const lines: StructuralFactLine[] = [];
  for (const raw of section.split("\n")) {
    const m = /^STRUCTURAL_FACT (\S+) (found|not-found)/.exec(raw);
    if (m) lines.push({ kind: m[1]!, found: m[2] === "found" });
  }
  return lines;
}

interface DecompileAccounting {
  attempted: number;
  decompiled: number;
  timedOut: number;
  failed: number;
  ceiling: number;
  zeroFunctions: boolean;
}

/** Parses `## DECOMPILE_ACCOUNTING`'s own labelled count lines, READING the
 * committed ceiling from the export rather than restating it in this file
 * (this plan's own acceptance criterion). */
function parseAccounting(exportText: string): DecompileAccounting {
  const section = extractSection(exportText, "## DECOMPILE_ACCOUNTING");
  const num = (label: string): number => {
    const m = new RegExp(`${label} (\\d+)`).exec(section);
    assert.ok(m, `parseAccounting: ${JSON.stringify(label)} line missing from the DECOMPILE_ACCOUNTING section`);
    return Number(m![1]);
  };
  return {
    attempted: num("DECOMPILE_ATTEMPTED"),
    decompiled: num("DECOMPILE_DECOMPILED"),
    timedOut: num("DECOMPILE_TIMED_OUT"),
    failed: num("DECOMPILE_FAILED"),
    ceiling: num("DECOMPILE_TIMED_OUT_CEILING"),
    zeroFunctions: section.includes("DECOMPILE_ZERO_FUNCTIONS true"),
  };
}

interface ReferenceLine {
  from: string;
  to: string;
  kind: string;
  line: string;
}

/** Parses `## REFERENCES`'s own `<from> -> <to> <KIND>` lines, asserting on
 * the KIND token -- never the address alone (this plan's own acceptance
 * criterion for GHID-05). */
function parseReferences(exportText: string): ReferenceLine[] {
  const section = extractSection(exportText, "## REFERENCES");
  const lines: ReferenceLine[] = [];
  for (const raw of section.split("\n")) {
    const m = /^(\S+) -> (\S+) (\S+)$/.exec(raw);
    if (m) lines.push({ from: m[1]!, to: m[2]!, kind: m[3]!, line: raw });
  }
  return lines;
}

/** Parses `## UNRESOLVED_DISPATCH`'s own count-and-site-list shape, and
 * separately asserts (over the SECTION's own text, never the whole export)
 * that no ratio, percentage or total-sites figure appears in it. */
function parseUnresolvedDispatch(exportText: string): { count: number; sites: string[]; sectionText: string } {
  const section = extractSection(exportText, "## UNRESOLVED_DISPATCH");
  const countMatch = /UNRESOLVED_DISPATCH_COUNT (\d+)/.exec(section);
  assert.ok(countMatch, "parseUnresolvedDispatch: UNRESOLVED_DISPATCH_COUNT line missing");
  const sites = section
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("UNRESOLVED_DISPATCH_COUNT"));
  return { count: Number(countMatch![1]), sites, sectionText: section };
}

/** Counts of `## STRUCTURAL_FACTS`'s own `COMPOSITE_TYPES`/`DEFINED_DATA`
 * lines (the `MODE_DATATYPEMANAGER` control's OWN version of "structural
 * facts") -- parsed the same way regardless of which mode produced them,
 * since the control never prints the acceptance route's five-kind lines. */
function parseDataTypeManagerCounts(exportText: string): { compositeCount: number; definedDataCount: number } {
  const section = extractSection(exportText, "## STRUCTURAL_FACTS");
  const compositeMatch = /STRUCTURAL_FACT COMPOSITE_TYPES count=(\d+)/.exec(section);
  const definedDataMatch = /STRUCTURAL_FACT DEFINED_DATA count=(\d+)/.exec(section);
  assert.ok(compositeMatch && definedDataMatch, "parseDataTypeManagerCounts: expected both COMPOSITE_TYPES and DEFINED_DATA count lines");
  return { compositeCount: Number(compositeMatch![1]), definedDataCount: Number(definedDataMatch![1]) };
}

/** Counts the acceptance export's own `## DECOMPILED_TEXT` section's
 * non-blank lines (excluding the section's own header and trailing count
 * line) -- the concrete, countable unit of structural information the
 * decompiler route recovers, used as THIS plan's own stated metric for
 * "the acceptance export's structural-fact count" in the Task 3 comparison
 * against the control's `COMPOSITE_TYPES`+`DEFINED_DATA` total. Named
 * explicitly here (and in the evidence file) rather than left ambiguous. */
function countDecompiledTextLines(exportText: string): number {
  const section = extractSection(exportText, "## DECOMPILED_TEXT");
  return section
    .split("\n")
    .filter((l) => l.trim() !== "" && !l.startsWith("## DECOMPILED_TEXT_COUNT"))
    .length;
}

test(
  "ghidra-live acceptance run: the five structural fact kinds, typed cross-references and the accounting identity on the real corpus",
  { skip: CORPUS_SKIP_REASON },
  async () => {
    const extracted = await extractCorpusProgram();
    const ws = makeScratchWorkspace();
    try {
      writeFileSync(join(ws.root, "release.prg"), extracted);
      writeFileSync(join(ws.root, "release.entrypoints"), CORPUS_ENTRY_POINTS.join("\n") + "\n");
      const exportRel = "acceptance-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "acceptance",
          importPath: "release.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: "release.entrypoints",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const exportText = readFileSync(join(ws.root, exportRel), "utf8");

      // The five fact kinds -- each must carry at least one line (found or
      // not-found); which were found on THIS image is recorded below.
      const facts = parseStructuralFacts(exportText);
      const REQUIRED_KINDS = ["ARRAY_BOUND", "SPLIT_POINTER", "RECORD_STRIDE", "COMPUTED_JUMP_RESOLVED", "SELF_MODIFYING_WRITE"];
      for (const kind of REQUIRED_KINDS) {
        assert.ok(facts.some((f) => f.kind === kind), `expected at least one STRUCTURAL_FACT line (found or not-found) naming ${kind}`);
      }
      const foundKinds = new Set(facts.filter((f) => f.found).map((f) => f.kind));
      // MEASURED on this image: SPLIT_POINTER (FUN_a660's own CONCAT11
      // pointer construction) and SELF_MODIFYING_WRITE (a WRITE reference
      // targeting an address already disassembled as an instruction) are
      // found; ARRAY_BOUND and RECORD_STRIDE are not (no `for(...)` loop or
      // multiply-stride pattern appears in what this image's own entry
      // points reach) -- a fact about this image, recorded rather than
      // treated as a defect.
      assert.ok(foundKinds.has("SPLIT_POINTER"), "SPLIT_POINTER must be found on this image");
      assert.ok(foundKinds.has("SELF_MODIFYING_WRITE"), "SELF_MODIFYING_WRITE must be found on this image");
      assert.equal(foundKinds.has("ARRAY_BOUND"), false, "MEASURED: ARRAY_BOUND is not found on this image -- recorded, not treated as a defect");
      assert.equal(foundKinds.has("RECORD_STRIDE"), false, "MEASURED: RECORD_STRIDE is not found on this image -- recorded, not treated as a defect");

      // Split-pointer detection route: this project's own export detects
      // the idiom via the printed CONCAT11( text first, falling back to a
      // PcodeOp.PIECE walk only when that text is absent. MEASURED, this
      // image: the printed text carries CONCAT11( (FUN_a660's own body), so
      // the text route is what fired.
      const decompiledText = extractSection(exportText, "## DECOMPILED_TEXT");
      assert.ok(decompiledText.includes("CONCAT11("), "the split-pointer idiom's own detection route on this image is the printed CONCAT11( text");

      // The accounting identity.
      const accounting = parseAccounting(exportText);
      assert.equal(
        accounting.attempted,
        accounting.decompiled + accounting.timedOut + accounting.failed,
        "attempted must equal decompiled + timedOut + failed",
      );
      assert.ok(accounting.attempted > 0, "attempted must be greater than zero on this image -- the identity must not hold vacuously");
      assert.ok(
        accounting.timedOut <= accounting.ceiling,
        `timedOut (${accounting.timedOut}) must be at or below the script's own named ceiling (${accounting.ceiling}), read from the export`,
      );

      // Typed cross-references: at least one of each of READ, WRITE and
      // READ_WRITE, asserted on the kind token.
      const references = parseReferences(exportText);
      const kindsPresent = new Set(references.map((r) => r.kind));
      for (const kind of ["READ", "WRITE", "READ_WRITE"]) {
        assert.ok(kindsPresent.has(kind), `expected at least one reference of kind ${kind}`);
      }
      // MEASURED finding (GHID-05's own flagged assumption anticipated this
      // uncertainty): every computed control transfer this image's own
      // entry points reach is the "BRK trick" (a BRK instruction whose own
      // flow is a computed jump through the hardware IRQ vector, which this
      // synthetic flat import cannot resolve since the vector's own target
      // lives outside the loaded image) -- captured correctly below as
      // UNRESOLVED dispatch, never as a resolved COMPUTED_JUMP reference.
      // Independently re-confirmed on a second, unrelated crack of the SAME
      // game (`saeger.d64`) during this plan's own investigation. Asserted
      // here as a POSITIVE fact (not a silent omission): a future corpus or
      // entry-point change that introduces a resolved COMPUTED_JUMP would
      // need this assertion updated deliberately. See this plan's own
      // SUMMARY Deviations and evidence/36-07-acceptance-run.md.
      assert.equal(
        kindsPresent.has("COMPUTED_JUMP"),
        false,
        "MEASURED: this image's own computed control transfers are all BRK-trick (unresolved), never a resolved COMPUTED_JUMP reference",
      );

      // Unresolved dispatch, no denominator.
      const dispatch = parseUnresolvedDispatch(exportText);
      assert.equal(dispatch.sites.length, dispatch.count, "the dispatch section's own site-list length must equal its own printed count");
      assert.doesNotMatch(
        dispatch.sectionText,
        /%|\bratio\b|\bpercent(age)?\b|total[- ]sites/i,
        "the UNRESOLVED_DISPATCH section's own text must carry no ratio, percentage or total-sites figure",
      );

      // Reproducibility: run the acceptance export a second time under a
      // different run id, over the SAME extracted program and entry
      // points, and assert byte-identical export files.
      const exportRel2 = "acceptance-export-2.txt";
      const result2 = await runGhidraAnalyze(
        {
          runId: "acceptance-2",
          importPath: "release.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: "release.entrypoints",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel2,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result2.exitStatus, 0);
      const exportText2 = readFileSync(join(ws.root, exportRel2), "utf8");
      const digest1 = createHash("sha256").update(exportText).digest("hex");
      const digest2 = createHash("sha256").update(exportText2).digest("hex");
      assert.equal(digest1, digest2, "two acceptance runs under different run ids must produce byte-identical export files");

      console.log("ACCEPTANCE_EXPORT_DIGEST_1:", digest1);
      console.log("ACCEPTANCE_EXPORT_DIGEST_2:", digest2);
      console.log("ACCEPTANCE_EXPORT_BYTE_LENGTH:", exportText.length);
      console.log("ACCEPTANCE_ACCOUNTING:", JSON.stringify(accounting));
      console.log("ACCEPTANCE_REFERENCE_KINDS:", [...kindsPresent].sort().join(","));
      console.log("ACCEPTANCE_UNRESOLVED_DISPATCH:", JSON.stringify(dispatch.sites));
      console.log("ACCEPTANCE_FOUND_KINDS:", [...foundKinds].sort().join(","));
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live acceptance zero-function: a program with no functions carries the explicit zero-function line",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      // A function-less program: an all-zero (BRK-filled) flat-64K image,
      // with no entry points and no preScript at all -- nothing here is
      // ever seeded as an entry, so DecompInterface has zero functions to
      // attempt.
      writeFileSync(join(ws.root, "empty.bin"), new Uint8Array(65536));
      const exportRel = "zerofunc-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "acceptance-zerofunc",
          importPath: "empty.bin",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const accounting = parseAccounting(exportText);
      assert.equal(accounting.attempted, 0, "a function-less program must report zero attempted functions");
      assert.ok(accounting.zeroFunctions, "a function-less program must carry the explicit DECOMPILE_ZERO_FUNCTIONS true line");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 36-07 (GHID-04): the `DataTypeManager` control, on the SAME image,
// route and language as the acceptance run above, one script argument
// apart -- invoked directly against `analyzeHeadless` (see this section's
// own header comment for why the typed seam cannot yet reach it).
// ---------------------------------------------------------------------------

/** Named threshold for "essentially nothing" (this plan's own acceptance
 * criterion: a stated threshold, not an assumed exact zero). MEASURED on
 * this image: `COMPOSITE_TYPES` is 0 and `DEFINED_DATA` is 14 -- both well
 * under this threshold, which is itself far smaller than the classified
 * address total (49682) or the acceptance route's own decompiled-text line
 * count. */
const CONTROL_NEAR_ZERO_THRESHOLD = 100;

/** Named "stated multiple" for the acceptance-vs-control structural-fact
 * comparison (this plan's own acceptance criterion): the acceptance export's
 * `## DECOMPILED_TEXT` line count must exceed the control's own
 * `COMPOSITE_TYPES`+`DEFINED_DATA` total by at least this factor. MEASURED
 * on this image: 183 decompiled-text lines vs. 14 control lines (~13x) --
 * this threshold is set well below that observed ratio. */
const STRUCTURAL_FACT_STATED_MULTIPLE = 5;

/** Directly invokes `analyzeHeadless`, OUTSIDE `ghidra.analyze`'s typed seam
 * -- plan 36-03's own key-decision records that the `DataTypeManager`
 * control mode's third script argument (`getScriptArgs()[2]`) is not yet
 * reachable through that seam (only the export path and the expected-line
 * override are wired as positional script arguments). Builds the SAME
 * fixed-order argv `buildAnalyzeHeadlessArgv()` (`ghidra-project.mts`) would,
 * with one extra positional slot (the mode selector) after an
 * always-empty expected-classification-lines override -- so the export
 * path and the mode land in `GhidraStructExport.java`'s own
 * `getScriptArgs()[0]`/`getScriptArgs()[2]`, exactly as its own header
 * documents. */
function runGhidraAnalyzeDirectControl(
  ws: ScratchWorkspace,
  opts: { runId: string; importPath: string; processor: string; entrypointsPath: string; exportPath: string; mode: string },
): { exitStatus: number | null; runLogText: string; exportText: string } {
  const ghidraHome = process.env.GHIDRA_HOME!;
  const analyzeHeadlessPath = join(ghidraHome, "support", "analyzeHeadless");
  // Gap G-40-1 (plan 40-09): this function bypasses resolveGhidraProject()'s
  // typed seam entirely (it drives analyzeHeadless directly to reach the
  // DataTypeManager control-mode's third positional script argument, not
  // yet wired through that seam -- see this function's own header comment
  // above), so it must mint the SAME broker-owned handle
  // resolveGhidraProject() would have minted and hand analyzeHeadless the
  // SAME non-dotted handle path (ghidraRunsRoot()) that seam uses -- never
  // a dotted literal Ghidra's own dot-segment refusal would reject.
  const handleResult = ensureGhidraRunsHandle(ws.root);
  if (!handleResult.ok) throw new Error(`runGhidraAnalyzeDirectControl: ${handleResult.message}`);
  const projectLocation = join(ghidraRunsRoot(ws.root), opts.runId);
  mkdirSync(projectLocation, { recursive: true });
  const argv = [
    projectLocation,
    opts.runId,
    "-import",
    join(ws.root, opts.importPath),
    "-processor",
    opts.processor,
    "-loader",
    "BinaryLoader",
    "-loader-baseAddr",
    "0x801",
    "-noanalysis",
    "-scriptPath",
    join(ws.root, "vendor", "ghidra-scripts"),
    "-preScript",
    join(ws.root, "vendor", "ghidra-scripts", "VolatileCarve.java"),
    join(ws.root, opts.entrypointsPath),
    "-postScript",
    join(ws.root, "vendor", "ghidra-scripts", "GhidraStructExport.java"),
    join(ws.root, opts.exportPath),
    "",
    opts.mode,
    "-deleteProject",
  ];
  const result = spawnSync(analyzeHeadlessPath, argv, { encoding: "utf8" });
  const runLogText = (result.stdout ?? "") + (result.stderr ?? "");
  const exportPathAbs = join(ws.root, opts.exportPath);
  const exportText = existsSync(exportPathAbs) ? readFileSync(exportPathAbs, "utf8") : "";
  return { exitStatus: result.status, runLogText, exportText };
}

test(
  "ghidra-live acceptance control (DataTypeManager): the SAME image, route and language as the acceptance run, one script argument apart, returns essentially nothing",
  { skip: CORPUS_SKIP_REASON },
  async () => {
    const extracted = await extractCorpusProgram();
    const ws = makeScratchWorkspace();
    try {
      writeFileSync(join(ws.root, "release.prg"), extracted);
      writeFileSync(join(ws.root, "release.entrypoints"), CORPUS_ENTRY_POINTS.join("\n") + "\n");

      // The acceptance run, once more, in THIS case -- so both count sets
      // are read from runs made in the same test, over the identical bytes
      // this case itself wrote.
      const acceptanceExportRel = "control-acceptance-export.txt";
      const acceptanceResult = await runGhidraAnalyze(
        {
          runId: "control-acceptance",
          importPath: "release.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: "release.entrypoints",
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: acceptanceExportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(acceptanceResult.exitStatus, 0);
      const acceptanceExportText = readFileSync(join(ws.root, acceptanceExportRel), "utf8");
      const acceptanceDecompiledLines = countDecompiledTextLines(acceptanceExportText);

      // The control: the SAME image, route and language, one argument apart.
      const control = runGhidraAnalyzeDirectControl(ws, {
        runId: "control-datatype",
        importPath: "release.prg",
        processor: NMOS_LANGUAGE_ID,
        entrypointsPath: "release.entrypoints",
        exportPath: "control-datatype-export.txt",
        mode: "DATATYPE",
      });
      assert.equal(control.exitStatus, 0, `control run's own exit status must be 0 -- run log tail: ${control.runLogText.slice(-500)}`);
      assert.match(control.runLogText, /EXPORT_MODE: DATATYPE/, "the control's own printed mode line must name the DATATYPE mode");
      assert.match(
        control.exportText,
        /DECOMPILE_ACCOUNTING_MODE_NOTE decompiler not invoked in DATATYPE mode/,
        "the control must state, in its own export, that the decompiler was never invoked",
      );

      const { compositeCount, definedDataCount } = parseDataTypeManagerCounts(control.exportText);
      const controlTotal = compositeCount + definedDataCount;
      assert.ok(
        controlTotal <= CONTROL_NEAR_ZERO_THRESHOLD,
        `the control's own COMPOSITE_TYPES(${compositeCount})+DEFINED_DATA(${definedDataCount})=${controlTotal} must be at or below the stated near-zero threshold (${CONTROL_NEAR_ZERO_THRESHOLD})`,
      );

      assert.ok(
        acceptanceDecompiledLines > controlTotal * STRUCTURAL_FACT_STATED_MULTIPLE,
        `the acceptance export's own DECOMPILED_TEXT line count (${acceptanceDecompiledLines}) must exceed the control's own COMPOSITE_TYPES+DEFINED_DATA total (${controlTotal}) by at least the stated multiple (${STRUCTURAL_FACT_STATED_MULTIPLE}x)`,
      );

      console.log("CONTROL_COMPOSITE_COUNT:", compositeCount);
      console.log("CONTROL_DEFINED_DATA_COUNT:", definedDataCount);
      console.log("CONTROL_TOTAL:", controlTotal);
      console.log("ACCEPTANCE_DECOMPILED_TEXT_LINES:", acceptanceDecompiledLines);
      console.log("CONTROL_RUN_LOG_TAIL:", control.runLogText.slice(-1200));
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 37-02 (AUTO-04, AUTO-05): the real producing run over the new
// two-caller path-dependent $01 fixture (`bank-path-dependent.a`/`.prg`, see
// `fixtures/ghidra/README.md`), on both import routes. Drives the SAME
// VolatileCarve.java / GhidraStructExport.java script pair the bank.prg
// cases above drive -- GHID-02's volatile carve is a stated prerequisite:
// without it, the fixture's own `sta $01` writes are eliminated as dead
// stores before `## CONST_WRITES`'s p-code walk ever sees them (see that
// section's own header comment in GhidraStructExport.java). The committed
// capture fixture (`export-bank-path-dependent.txt`, the `.prg` route) is
// verified byte-for-byte reproducible here; `anno-import.test.ts` carries the
// hermetic, JVM-free half over that same committed capture.
// ---------------------------------------------------------------------------

/** This fixture's own entry point (`start:`), per route -- see
 * `fixtures/ghidra/README.md`'s address trace. Same +2 `.prg`-route offset
 * as `bank.prg` above, for the same reason (the loader never strips the
 * file's own two-byte load-address header on that route). */
const PATH_DEPENDENT_FLAT64K_ENTRYPOINT = "$0810";
const PATH_DEPENDENT_PRG_ENTRYPOINT = "$0812";

/** Generates the flat-64K variant of the NEW two-caller path-dependent
 * fixture -- mirrors `generateFlat64kVariant()` above in shape, kept as a
 * separate function since that one is already relied on elsewhere with its
 * own fixed fixture name (`bank.prg`). */
function generatePathDependentFlat64kVariant(ws: ScratchWorkspace): string {
  const prg = readFileSync(join(FIXTURES_DIR, "bank-path-dependent.prg"));
  const loadAddr = prg[0]! | (prg[1]! << 8);
  const body = prg.subarray(2);
  const flat = new Uint8Array(65536);
  flat.set(body, loadAddr);
  const relPath = "bank-path-dependent-flat64k.bin";
  writeFileSync(join(ws.root, relPath), flat);
  return relPath;
}

interface ConstWriteLine {
  storeAddress: string;
  targetAddress: string;
  value: string;
  line: string;
}

/** Parses `## CONST_WRITES`'s own `<store-address> <target-address>
 * <constant-value>` body lines -- returns an empty array for a section
 * carrying only `## CONST_WRITES_NONE`, never throwing on that shape (a
 * hand-built document exercising the SAME parse lives in
 * `anno-import.test.ts`, over `parseConstWrites()` itself; this is a
 * test-local, minimal reader over the raw export text). */
function parseConstWritesSection(exportText: string): ConstWriteLine[] {
  const section = extractSection(exportText, "## CONST_WRITES");
  const lines: ConstWriteLine[] = [];
  for (const raw of section.split("\n")) {
    const m = /^(\S+) (\S+) (\S+)$/.exec(raw);
    if (m) lines.push({ storeAddress: m[1]!, targetAddress: m[2]!, value: m[3]!, line: raw });
  }
  return lines;
}

function runConstWritesRoute(
  ws: ScratchWorkspace,
  route: "prg" | "flat64k",
  importPath: string,
  entrypoint: string,
  exportRel: string,
) {
  const entrypointsRel = writeEntrypointsFile(ws, entrypoint, `bpd-${route}-entrypoints.txt`);
  return runGhidraAnalyze(
    {
      runId: `bpd-const-writes-${route}`,
      importPath,
      processor: NMOS_LANGUAGE_ID,
      importRoute: route,
      noanalysis: true,
      scriptPath: "vendor/ghidra-scripts",
      preScript: "vendor/ghidra-scripts/VolatileCarve.java",
      entrypointsPath: entrypointsRel,
      postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
      exportPath: exportRel,
    },
    { repoRoot: ws.root },
  );
}

/** Common assertions both route cases below share: the section is present,
 * carries at least two lines targeting the processor port with at least two
 * DISTINCT values among them, and the fixture's own two call-site addresses
 * (where the flip happens) are distinct from the shared subroutine's own
 * single border-colour store address (where the flip is OBSERVED) -- proving
 * this fixture actually creates the path-dependent site it was built for. */
function assertConstWritesPortValuesDiffer(exportText: string): ConstWriteLine[] {
  const constWrites = parseConstWritesSection(exportText);
  const portWrites = constWrites.filter((c) => /^0*1$/.test(c.targetAddress));
  assert.ok(
    portWrites.length >= 2,
    `expected at least two CONST_WRITES lines targeting the processor port ($0001); got ${JSON.stringify(constWrites)}`,
  );
  const distinctValues = new Set(portWrites.map((c) => c.value));
  assert.ok(
    distinctValues.size >= 2,
    `expected at least two DISTINCT processor-port values among the CONST_WRITES lines; got ${JSON.stringify([...distinctValues])}`,
  );
  return portWrites;
}

/** The shared program point's own store address (the single `sta $d020`
 * inside `probe`) must differ from every processor-port store address --
 * otherwise this would not be a path-dependent site at all. Asserted ONLY on
 * the flat-64K route: MEASURED this plan (see `fixtures/ghidra/README.md`'s
 * own "NEW finding" paragraph), the `.prg` route's own internal-`jsr` target
 * is NOT corrected for the two-byte header shift, so `probe` is never
 * actually reached on THAT route -- `## REFERENCES` carries no border-colour
 * access there at all, which would make this exact assertion fail for a
 * reason unrelated to what it exists to prove. */
function assertSharedSubroutineReachedFromDistinctCallers(exportText: string, portWrites: ConstWriteLine[]): void {
  const references = parseReferences(exportText);
  const borderWrites = references.filter((r) => /^0*d020$/.test(r.to) && r.kind === "WRITE");
  assert.equal(borderWrites.length, 1, "the fixture's own shared border-colour write must appear exactly once in ## REFERENCES");
  const borderStoreAddress = borderWrites[0]!.from;
  for (const portWrite of portWrites) {
    assert.notEqual(
      portWrite.storeAddress,
      borderStoreAddress,
      "a processor-port store address must never coincide with the shared subroutine's own border-colour store address",
    );
  }
}

test(
  "ghidra-live CONST_WRITES (flat64k route): the two-caller fixture's own $01 writes resolve to differing values, and the shared subroutine is reached from both distinct call sites",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generatePathDependentFlat64kVariant(ws);
      const exportRel = "bpd-flat64k-export.txt";
      const result = await runConstWritesRoute(ws, "flat64k", flatRelPath, PATH_DEPENDENT_FLAT64K_ENTRYPOINT, exportRel);
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the flat64k-route CONST_WRITES case must not throw");
      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const portWrites = assertConstWritesPortValuesDiffer(exportText);
      assertSharedSubroutineReachedFromDistinctCallers(exportText, portWrites);
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live CONST_WRITES (prg route): the two-caller fixture's own $01 writes resolve to differing values at distinct addresses, and this run's own export matches the committed capture fixture byte-for-byte",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const exportRel = "bpd-prg-export.txt";
      const result = await runConstWritesRoute(ws, "prg", "bank-path-dependent.prg", PATH_DEPENDENT_PRG_ENTRYPOINT, exportRel);
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the prg-route CONST_WRITES case must not throw");
      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      assertConstWritesPortValuesDiffer(exportText);
      // The shared-subroutine-reached-from-two-callers assertion is
      // deliberately NOT run on this route -- see this function's own
      // sibling above and `fixtures/ghidra/README.md`'s "NEW finding"
      // paragraph: the `.prg` route's own internal-`jsr` defect means
      // `probe` is never actually reached here, which is exactly why the
      // COMMITTED capture uses this route (matching every other committed
      // export/run-log fixture's size) while the flat-64K route above
      // carries the structural proof.

      // This is the SAME route, fixture, entry point and script pair used to
      // produce the committed capture fixture -- a fresh run here must
      // reproduce it BYTE-FOR-BYTE, mirroring GATE 3's own reproducibility
      // proof (this file, above) rather than merely asserting the shape.
      const committedCapture = readFileSync(join(FIXTURES_DIR, "export-bank-path-dependent.txt"), "utf8");
      assert.equal(
        exportText,
        committedCapture,
        "a fresh prg-route run over the committed fixture must reproduce the committed capture byte-for-byte",
      );
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Plan 37-08 (AUTO-07): the phantom-label before/after proof over the new
// graphics-feedback fixture (`charset-phantom.a`/`.prg`). Flat-64K route
// ONLY -- see `fixtures/ghidra/README.md`'s own paragraph on why the `.prg`
// route's two-byte shift misaligns the register-derived range against where
// this fixture's charset bytes actually land.
// ---------------------------------------------------------------------------

/** This fixture's own entry point (`start:`), flat-64K route (source labels,
 * unshifted). See `fixtures/ghidra/README.md`'s address trace. */
const CHARSET_PHANTOM_FLAT64K_ENTRYPOINT = "$0810";

/** Generates the flat-64K variant of the new graphics-feedback fixture --
 * mirrors `generateFlat64kVariant()`/`generatePathDependentFlat64kVariant()`
 * above in shape, kept as a separate function for the same reason those two
 * are separate from each other: each is already relied on elsewhere with its
 * own fixed fixture name. */
function generateCharsetPhantomFlat64kVariant(ws: ScratchWorkspace): string {
  const prg = readFileSync(join(FIXTURES_DIR, "charset-phantom.prg"));
  const loadAddr = prg[0]! | (prg[1]! << 8);
  const body = prg.subarray(2);
  const flat = new Uint8Array(65536);
  flat.set(body, loadAddr);
  const relPath = "charset-phantom-flat64k.bin";
  writeFileSync(join(ws.root, relPath), flat);
  return relPath;
}

/** Writes `DataRangeSeed.java`'s own range-file grammar (`dxa-blocks.ts`'s
 * `-B` two-address form, one inclusive `xxxx-yyyy` lower-case-hex line per
 * range) -- workspace-relative, so it can be handed straight to
 * `dataRangesPath`. */
function writeDataRangesFile(ws: ScratchWorkspace, ranges: ReadonlyArray<{ start: number; endInclusive: number }>, relName: string): string {
  const text = ranges.map((r) => `${r.start.toString(16).padStart(4, "0")}-${r.endInclusive.toString(16).padStart(4, "0")}\n`).join("");
  writeFileSync(join(ws.root, relName), text);
  return relName;
}

/** Parses `## DECOMPILED_TEXT`'s own `FUNCTION <address> <name>` lines --
 * the ONLY place a minted symbol name is visible in the committed export
 * format (`## CLASSIFICATION`/`## REFERENCES` carry addresses and access
 * kinds, never names). One line is emitted per function that decompiled
 * successfully (`GhidraStructExport.java`'s own `decompileCompleted()`
 * gate) -- this is exactly "every label the analyser minted", not a subset. */
function parseFunctionLines(exportText: string): { address: number; name: string }[] {
  const section = extractSection(exportText, "## DECOMPILED_TEXT");
  const out: { address: number; name: string }[] = [];
  const pattern = /^FUNCTION ([0-9a-fA-F]+) (\S+)$/gm;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(section)) !== null) {
    out.push({ address: parseInt(m[1]!, 16), name: m[2]! });
  }
  return out;
}

/** Every entry in `functions` whose address falls inside the inclusive
 * `range` -- the ONE membership predicate both the before-run and the
 * after-run assertions below share, so "inside the derived range" means
 * exactly one thing throughout this file. Byte addresses, never character
 * offsets (D-37's own encoding-edge rule) -- both ends of `range` and every
 * function address are plain integers. */
function functionsInRange(functions: readonly { address: number; name: string }[], range: { start: number; endInclusive: number }): { address: number; name: string }[] {
  return functions.filter((f) => f.address >= range.start && f.address <= range.endInclusive);
}

/** Set by the BEFORE case below, read by the AFTER case immediately after it
 * (registration order, node:test's own default serial execution) -- mirrors
 * `gate2PrgObserved`'s own precedent above: the derived range is computed
 * ONCE, from a real run's own CONST_WRITES facts, and reused rather than
 * re-derived a second time (which would still be legitimate, but would cost
 * a second full analyzeHeadless invocation for no new information). */
let charsetPhantomDerivedRange: { start: number; endInclusive: number } | undefined;

test(
  "ghidra-live AUTO-07 (before): a real run over charset-phantom.prg with NO graphics feedback mints a non-empty set of function labels inside the derived character-set range",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateCharsetPhantomFlat64kVariant(ws);
      const entrypointsRel = writeEntrypointsFile(ws, CHARSET_PHANTOM_FLAT64K_ENTRYPOINT, "charset-phantom-entrypoints.txt");
      const exportRel = "charset-phantom-before-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "charset-phantom-before",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the before-run must not throw");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");

      // The derived range is computed from THIS run's own real CONST_WRITES
      // facts -- never hard-coded, per this plan's own must_haves.truths.
      const constWrites = parseConstWrites(parseGhidraExport(exportText));
      const maps = deriveGraphicsRanges(constWrites);
      assert.equal(maps.length, 1, "this fixture writes one determinate combination -- exactly one derived map");
      const charsetRange = maps[0]!.ranges.find((r) => r.kind === "character-set");
      assert.ok(charsetRange !== undefined, "a character-set range must derive from this fixture's own register writes");
      charsetPhantomDerivedRange = { start: charsetRange!.start, endInclusive: charsetRange!.endInclusive };

      const functions = parseFunctionLines(exportText);
      const before = functionsInRange(functions, charsetPhantomDerivedRange);
      assert.ok(
        before.length > 0,
        `the before-set must be NON-EMPTY -- if this fires, the fixture's own charset bytes did not decode into anything the analyser promoted; go back to Task 1's fixture bytes rather than weakening this assertion (got ${before.length})`,
      );

      console.log(`AUTO-07 BEFORE: derived range $${charsetPhantomDerivedRange.start.toString(16)}-$${charsetPhantomDerivedRange.endInclusive.toString(16)}, ${before.length} minted labels inside it`);
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live AUTO-07 (after): the SAME fixture, with dataRangesPath applied, mints ZERO function labels inside the SAME derived character-set range",
  { skip: SKIP_REASON },
  async () => {
    assert.ok(charsetPhantomDerivedRange !== undefined, "the before-run above must have populated the derived range first (registration-order dependency)");
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateCharsetPhantomFlat64kVariant(ws);
      const entrypointsRel = writeEntrypointsFile(ws, CHARSET_PHANTOM_FLAT64K_ENTRYPOINT, "charset-phantom-entrypoints.txt");
      const dataRangesRel = writeDataRangesFile(ws, [charsetPhantomDerivedRange!], "charset-phantom-dataranges.txt");
      const exportRel = "charset-phantom-after-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "charset-phantom-after",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          dataRangesPath: dataRangesRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the after-run must not throw");
      assert.match(logText, /DataRangeSeed\.java> DATARANGE-OK:/, "DataRangeSeed.java must report a seeded range in the run log");
      assert.match(logText, /DataRangeSeed\.java> DATARANGE-SEED-COUNT: 1/, "DataRangeSeed.java must report exactly one range seeded");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const functions = parseFunctionLines(exportText);
      const after = functionsInRange(functions, charsetPhantomDerivedRange!);
      assert.equal(after.length, 0, `the after-set must be EMPTY -- the derived range's own data-range feedback must suppress every phantom label (got ${JSON.stringify(after)})`);

      console.log(`AUTO-07 AFTER: derived range $${charsetPhantomDerivedRange!.start.toString(16)}-$${charsetPhantomDerivedRange!.endInclusive.toString(16)}, ${after.length} minted labels inside it`);
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live AUTO-07 (prg route, CONST_WRITES only): the fixture's own register writes resolve on the .prg route too, exercising the same derivation the flat64k route's phantom-label proof depends on",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      // .prg-route entry point: +2 over the flat64k route's own, per the
      // fixtures README's documented per-route offset.
      const entrypointsRel = writeEntrypointsFile(ws, "$0812", "charset-phantom-prg-entrypoints.txt");
      const exportRel = "charset-phantom-prg-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "charset-phantom-prg",
          importPath: "charset-phantom.prg",
          processor: NMOS_LANGUAGE_ID,
          importRoute: "prg",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          preScript: "vendor/ghidra-scripts/VolatileCarve.java",
          entrypointsPath: entrypointsRel,
          postScript: "vendor/ghidra-scripts/GhidraStructExport.java",
          exportPath: exportRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "the prg-route case must not throw");

      const exportText = readFileSync(join(ws.root, exportRel), "utf8");
      const constWrites = parseConstWrites(parseGhidraExport(exportText));
      assert.equal(constWrites.length, 3, "all three VIC register writes must resolve on the prg route too");
      const maps = deriveGraphicsRanges(constWrites);
      assert.equal(maps.length, 1);
      const charsetRange = maps[0]!.ranges.find((r) => r.kind === "character-set");
      assert.ok(charsetRange !== undefined, "a character-set range must derive on the prg route too, from the same register values");
      // Deliberately NOT asserting a phantom-label count here -- see
      // fixtures/ghidra/README.md's own paragraph: this route's own
      // two-byte shift means the charset bytes actually load two bytes
      // later than the derived range's own hardware-address boundaries,
      // so a before/after label-count proof on this route would compare
      // the wrong window. This case exists to prove the CONST_WRITES/
      // derivation half still works here, not the phantom-label half.
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// CR-02 fix: `DataRangeSeed.java`'s per-byte seed loop used to throw
// `AddressOutOfBoundsException` on the LAST iteration of a range ending at
// $FFFF (the address space's own maximum offset -- there is no address to
// advance to), reporting a fully-successful seed as `DATARANGE-FAILED` and
// undercounting `DATARANGE-SEED-COUNT` by one. `$fff8-$ffff` is not a
// hypothetical boundary: it is exactly the sprite-pointer range
// `anno-graphics.ts`'s own `deriveGraphicsRanges()` can legitimately derive
// (bank base $0000 with $D018's high nibble $F -- see the finding's own
// worked example). The flat-64K route is used so every address up to
// $FFFF is backed by real memory (a .prg's own small loaded range is not).
// ---------------------------------------------------------------------------

test(
  "ghidra-live CR-02: DataRangeSeed.java seeds a range ending at $ffff and reports DATARANGE-OK, never DATARANGE-FAILED",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const flatRelPath = generateCharsetPhantomFlat64kVariant(ws);
      const dataRangesRel = writeDataRangesFile(ws, [{ start: 0xfff8, endInclusive: 0xffff }], "cr02-dataranges.txt");
      const result = await runGhidraAnalyze(
        {
          runId: "cr02-ffff-boundary",
          importPath: flatRelPath,
          processor: NMOS_LANGUAGE_ID,
          importRoute: "flat64k",
          noanalysis: true,
          scriptPath: "vendor/ghidra-scripts",
          dataRangesPath: dataRangesRel,
        },
        { repoRoot: ws.root },
      );
      assert.equal(result.exitStatus, 0);
      const logText = readFileSync(result.runLogPath, "utf8");
      assert.equal(classifyGhidraRunLog(logText).scriptThrew, false, "seeding a range ending at $ffff must not throw a script error");
      assert.match(logText, /DataRangeSeed\.java> DATARANGE-OK: fff8-ffff/, "the $fff8-ffff range must report OK, not FAILED (CR-02's own regression)");
      assert.doesNotMatch(logText, /DataRangeSeed\.java> DATARANGE-FAILED/, "no range in this run should ever fail -- CR-02's own bug reported a FULLY seeded range as FAILED");
      assert.match(logText, /DataRangeSeed\.java> DATARANGE-SEED-COUNT: 1/, "the one range given must be counted as seeded, not dropped by the boundary bug");
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

// ---------------------------------------------------------------------------
// Gap G-40-1 (plan 40-09, Task 3): the guard .planning/todos/pending/
// 2026-09-08-guard-ghidra-symlink-project-location.md describes. The
// symlink route this plan's own Task 1/2 depend on rests on a property of
// real Ghidra this project does not control: `ProjectLocator` calls
// `java.io.File.getAbsolutePath()` and never `getCanonicalPath()`, so it
// never resolves the non-dotted handle -- MEASURED in bytecode against
// 12.1.3 (.planning/notes/ghidra-dot-path-check-semantics.md). If a future
// release switches that one call, every ghidra.analyze run breaks at once,
// silently, 12-16 seconds into a JVM startup, with a dot-segment error
// naming a path the user never typed. This guard fails at TEST time
// instead, reproducing both halves of that note's own runs B and C.
//
// Two halves, an outcome differential, never a stderr text match:
//   - POSITIVE (mirrors run C): the PRODUCTION route, driven for real,
//     lands its project database PHYSICALLY under the dotted root while
//     the non-dotted tree holds only the handle symlink.
//   - NEGATIVE (mirrors run B): the SAME real Ghidra, handed a LITERAL
//     dot-prefixed project location -- bypassing the production resolver
//     entirely, since going through it would prove this project's OWN
//     predicate rather than Ghidra's, the precise mistake that created
//     this gap -- produces NO project database at all.
// Without the negative half, the positive half passing could mean Ghidra
// stopped refusing dots entirely, which would make the positive half
// vacuous rather than reassuring.
// ---------------------------------------------------------------------------

/** Directly invokes `analyzeHeadless` with a LITERAL project location --
 * never through `resolveGhidraProject()`/`buildAnalyzeHeadlessArgv()`, both
 * of which independently refuse a dot-prefixed location themselves before
 * Ghidra is ever reached. This helper exists to observe GHIDRA'S OWN
 * behaviour, not this project's. No `-deleteProject` flag: this negative
 * control inspects whatever artifacts (if any) the run leaves behind, and
 * `-deleteProject` only deletes a project that was actually created. */
function spawnAnalyzeHeadlessDirectAtLocation(
  location: string,
  name: string,
  importPathAbs: string,
): { exitStatus: number | null; stdout: string; stderr: string } {
  const ghidraHome = process.env.GHIDRA_HOME!;
  const analyzeHeadlessPath = join(ghidraHome, "support", "analyzeHeadless");
  const argv = [location, name, "-import", importPathAbs, "-processor", NMOS_LANGUAGE_ID, "-loader", "BinaryLoader", "-loader-baseAddr", "0x801", "-noanalysis"];
  const result = spawnSync(analyzeHeadlessPath, argv, { encoding: "utf8" });
  return { exitStatus: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

/** True when a Ghidra project database exists at `<projectDir>/<projectName>.gpr`
 * -- the OUTCOME both halves of this guard compare, never Ghidra's own
 * stderr text (the pending todo's own explicit prohibition, mirroring
 * ghidra-project.mts's header rule against string-matching Ghidra's stderr
 * for the refusal path). */
function ghidraProjectDatabaseExists(projectDir: string, projectName: string): boolean {
  return existsSync(join(projectDir, `${projectName}.gpr`));
}

test(
  "ghidra-live SYMLINK GUARD (positive, mirrors note run C): a real Ghidra import through the handle the production resolver mints lands its project database PHYSICALLY under the dotted root, with only the handle symlink in the non-dotted tree",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const runId = "symlink-guard-positive";

      // The handle is minted by the CODE UNDER TEST -- resolveGhidraProject()
      // (ghidra-project.mts), which calls ensureGhidraRunsHandle() itself as
      // an idempotent precondition, exactly as the production `ghidra.analyze`
      // seam (host-tool.mts) does. This test spawns analyzeHeadless directly
      // at the resolved location -- deliberately WITHOUT the production
      // seam's own unconditional `-deleteProject` flag
      // (buildAnalyzeHeadlessArgv(), ghidra-project.mts) -- MEASURED at plan
      // time: the full production route (runGhidraAnalyze()) really does
      // create the project through the handle (its own run log carries
      // "Creating project:" and "REPORT: Import succeeded" naming the
      // handle path), but `-deleteProject` then removes every artifact this
      // guard exists to inspect, leaving an empty physical directory. Same
      // precedent this file's own runGhidraAnalyzeDirectControl() already
      // uses one section up: drive real analyzeHeadless directly to observe
      // Ghidra's own filesystem behaviour, not merely its exit status.
      const projectResolved = resolveGhidraProject({ repoRoot: ws.root, runId });
      assert.equal(projectResolved.ok, true, projectResolved.ok ? "" : (projectResolved as { ok: false; message: string }).message);
      if (!projectResolved.ok) return;

      const analyzeHeadlessPath = join(process.env.GHIDRA_HOME!, "support", "analyzeHeadless");
      const importPathAbs = join(ws.root, "bank.prg");
      const argv = [
        projectResolved.projectLocation,
        projectResolved.projectName,
        "-import",
        importPathAbs,
        "-processor",
        NMOS_LANGUAGE_ID,
        "-loader",
        "BinaryLoader",
        "-loader-baseAddr",
        importRouteBaseAddr("prg"),
        "-noanalysis",
      ];
      const spawned = spawnSync(analyzeHeadlessPath, argv, { encoding: "utf8" });
      const runLog = (spawned.stdout ?? "") + (spawned.stderr ?? "");
      assert.equal(spawned.status, 0, `production-computed-location run's own exit status must be 0 -- run log tail: ${runLog.slice(-500)}`);
      assert.match(runLog, /REPORT: Import succeeded/, "the import itself must have succeeded through the handle path");

      // The non-dotted tree holds ONLY the handle symlink -- lstat (never
      // stat, which would follow the link) reports a symbolic link at
      // exactly the handle path this file's own root gets.
      const handlePath = join(ws.root, GHIDRA_RUNS_HANDLE_NAME);
      const handleStat = lstatSync(handlePath);
      assert.ok(handleStat.isSymbolicLink(), `expected ${handlePath} to be a symbolic link (the broker-minted handle); if it is now a real directory, Ghidra may have started resolving symlinks in the project location`);

      // The project database landed PHYSICALLY under the dotted root --
      // reached through ghidraRunsRealRoot(), never the handle.
      const physicalProjectDir = join(ghidraRunsRealRoot(ws.root), runId);
      assert.ok(
        ghidraProjectDatabaseExists(physicalProjectDir, runId),
        `SYMLINK GUARD REGRESSION: expected a Ghidra project database (${runId}.gpr) physically under the dotted root at ${physicalProjectDir} -- if absent, Ghidra now appears to resolve symlinks in the project location (ProjectLocator switching from getAbsolutePath() to getCanonicalPath()), so the dotted runs root is no longer reachable through the handle and every ghidra.analyze call is about to fail. See .planning/notes/ghidra-dot-path-check-semantics.md.`,
      );
      const repEntries = existsSync(join(physicalProjectDir, `${runId}.rep`)) ? readdirSync(join(physicalProjectDir, `${runId}.rep`)) : [];
      assert.ok(repEntries.length > 0, `expected the project's own .rep/ directory to carry real content physically under ${physicalProjectDir}`);
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);

test(
  "ghidra-live SYMLINK GUARD (negative control, mirrors note run B): a directly-spawned run with a LITERAL dot-prefixed project location produces NO project database",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const runId = "symlink-guard-negative";
      // A literal, dot-prefixed location -- built by hand, deliberately
      // bypassing resolveGhidraProject()/buildAnalyzeHeadlessArgv(), which
      // would refuse this themselves before Ghidra is ever reached. This
      // spawns analyzeHeadless DIRECTLY so the outcome observed is Ghidra's
      // own, not this project's.
      const dottedProjectDir = join(ws.root, ".c64-re-tools", "runs", "ghidra", runId);
      mkdirSync(dottedProjectDir, { recursive: true });
      const importPathAbs = join(ws.root, "bank.prg");

      const control = spawnAnalyzeHeadlessDirectAtLocation(dottedProjectDir, runId, importPathAbs);

      assert.ok(
        !ghidraProjectDatabaseExists(dottedProjectDir, runId),
        `SYMLINK GUARD CONTROL REGRESSION: a project database (${runId}.gpr) was found at the LITERAL dot-prefixed location ${dottedProjectDir} -- Ghidra appears to have stopped refusing dot-prefixed segments, which makes the broker-minted handle unnecessary rather than broken, and means this guard's positive half is no longer meaningful on its own. Exit status was ${control.exitStatus}.`,
      );
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);
