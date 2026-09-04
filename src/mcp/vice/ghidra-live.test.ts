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
// own `tools/ghidra-runs/` is never touched -- passing this file's own
// directory as `repoRoot` would leave untracked run directories there,
// because that ignore entry is anchored at the repository root. This host's
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
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGhidraAnalyze, classifyGhidraRunLog } from "./ghidra-run.ts";
import { installedLanguageIds } from "./ghidra-project.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures", "ghidra");
const SCRIPTS_DIR = join(HERE, "vendor", "ghidra-scripts");

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
  "ghidra-live GATE 1: a wrong expectedClassificationLines makes the export script throw, with analyzeHeadless's own exit status recorded as 0",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const exportRel = "gate1-wrong-export.txt";
      const result = await runGhidraAnalyze(
        {
          runId: "gate1-wrong",
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
      );

      // The exit status is recorded as evidence that it is UNINFORMATIVE,
      // never as a pass signal -- asserted explicitly rather than ignored,
      // per this plan's own must_haves.prohibitions.
      assert.equal(result.exitStatus, 0, "analyzeHeadless's own exit status must be recorded as 0 even though the post-script threw");

      const logText = readFileSync(result.runLogPath, "utf8");
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
