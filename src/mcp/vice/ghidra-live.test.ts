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
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGhidraAnalyze, classifyGhidraRunLog } from "./ghidra-run.ts";
import { installedLanguageIds } from "./ghidra-project.mts";
import { repoRoot } from "./repo-root.ts";
import { listEntries, extractEntry } from "./anno-d64.ts";

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
      const result = await runGhidraAnalyze(
        {
          runId: "vol-forced-conflict",
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
      );

      // The exit status is recorded as evidence that it is UNINFORMATIVE,
      // never a pass signal -- exactly like GATE 1 (plan 36-04).
      assert.equal(result.exitStatus, 0, "analyzeHeadless's own exit status must be recorded as 0 even though the pre-script threw");

      const logText = readFileSync(result.runLogPath, "utf8");
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

/** Reads the corpus release, extracts its first directory entry -- the SAME
 * directory-and-entry route `anno-d64.ts` already provides and
 * `dxa-live.test.ts`'s own corpus case established (D-36-18). */
function extractCorpusProgram(): Uint8Array {
  const corpusImageBytes = readFileSync(CORPUS_PATH);
  const entries = listEntries(new Uint8Array(corpusImageBytes));
  const entry = entries[0];
  if (entry === undefined) {
    throw new Error("ghidra-live acceptance: the corpus image has no directory entries");
  }
  return extractEntry(new Uint8Array(corpusImageBytes), entry.name);
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
    const extracted = extractCorpusProgram();
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
  const projectLocation = join(ws.root, "tools", "ghidra-runs", opts.runId);
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
    const extracted = extractCorpusProgram();
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
