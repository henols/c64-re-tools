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

