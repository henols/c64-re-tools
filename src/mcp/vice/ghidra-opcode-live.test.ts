#!/usr/bin/env node
// ghidra-opcode-live.test.ts
//
// Phase 36, plan 36-04 (OPC-04): OPT-IN, MANUAL-ONLY. The language half of
// this phase's live suite, alongside `ghidra-live.test.ts` (the harness
// half) -- landed together, in ONE commit, as this project's ELEVENTH and
// TWELFTH `MANUAL_ONLY_TESTS` entries, so the volatile-carve work and the
// opcode work can each expand this file/that file in parallel next wave
// against disjoint files.
//
// SAME header shape and SAME `SKIP_REASON` computation as
// `ghidra-live.test.ts` -- duplicated here rather than imported (a small
// duplicate is cheaper than a shared production module for one function).
// DEFAULT-SKIP IS MANDATORY: `npm test` globs this file, and no CI runner
// has a Ghidra installation. Every case passes `SKIP_REASON` through
// node:test's own `{ skip }` option, never a hand-rolled early return.
//
// Opt in with:
//   GHIDRA_HOME=/path/to/ghidra VICE_LIVE_GHIDRA=1 node --test ghidra-opcode-live.test.ts
//
// This plan seeds ONE real case: the failing direction for OPC-04's
// criterion 1 (promoted from plan 36-01's own manual command) -- the SAME
// image run under the stock language and under the new language must name
// TWO DIFFERENT languages in their own run logs, asserted by BYTE-EXACT
// comparison. Later plans in this phase (36-06, opcode sweep) expand this
// file with OPC-01/OPC-02/OPC-03's own live cases.
import { test } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { runGhidraAnalyze } from "./ghidra-run.ts";
import { installedLanguageIds } from "./ghidra-project.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures", "ghidra");
const SCRIPTS_DIR = join(HERE, "vendor", "ghidra-scripts");

/** The new language this phase adds (36-01) and the stock language it must
 * never collide with -- byte-exact, case-sensitive comparisons throughout. */
const NMOS_LANGUAGE_ID = "6502:LE:16:nmos";
const DEFAULT_LANGUAGE_ID = "6502:LE:16:default";

/** Computed exactly once, from three conditions in order -- duplicated
 * (never imported) from ghidra-live.test.ts's own identically-named
 * function: two short duplicates are cheaper than raising this module's
 * floor for one shared helper. */
function computeGhidraSkipReason(): string | false {
  if (process.env.VICE_LIVE_GHIDRA !== "1") {
    return (
      "ghidra-opcode-live.test.ts is opt-in and default-skipped -- set VICE_LIVE_GHIDRA=1 to run it " +
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

/** Duplicated from ghidra-live.test.ts's own identically-shaped helper --
 * see that file's header for the "why a duplicate, not a shared module"
 * rationale. */
function makeScratchWorkspace(): ScratchWorkspace {
  const root = mkdtempSync(join(tmpdir(), "ghidra-opcode-live-"));
  cpSync(SCRIPTS_DIR, join(root, "vendor", "ghidra-scripts"), { recursive: true });
  cpSync(join(FIXTURES_DIR, "bank.prg"), join(root, "bank.prg"));
  return { root };
}

function removeScratchWorkspace(ws: ScratchWorkspace): void {
  rmSync(ws.root, { recursive: true, force: true });
}

test(
  "ghidra-opcode-live SEED: the same image under 6502:LE:16:default and 6502:LE:16:nmos names two different languages in their own run logs",
  { skip: SKIP_REASON },
  async () => {
    const ws = makeScratchWorkspace();
    try {
      const defaultResult = await runGhidraAnalyze(
        { runId: "seed-default", importPath: "bank.prg", processor: DEFAULT_LANGUAGE_ID, importRoute: "prg", noanalysis: true },
        { repoRoot: ws.root },
      );
      const nmosResult = await runGhidraAnalyze(
        { runId: "seed-nmos", importPath: "bank.prg", processor: NMOS_LANGUAGE_ID, importRoute: "prg", noanalysis: true },
        { repoRoot: ws.root },
      );

      assert.equal(defaultResult.language.present, true, "the stock-language run's log must carry a Using Language/Compiler: line");
      assert.equal(nmosResult.language.present, true, "the new-language run's log must carry a Using Language/Compiler: line");
      if (defaultResult.language.present && nmosResult.language.present) {
        assert.equal(defaultResult.language.id, DEFAULT_LANGUAGE_ID, "the stock run must name the stock language, byte-exactly");
        assert.equal(nmosResult.language.id, NMOS_LANGUAGE_ID, "the new-language run must name the new language, byte-exactly");
        // Byte-exact comparison, never case-folded: both the positive
        // (notEqual) and the explicit boolean-equality form below, so a
        // future case-insensitive regression in either parse site would be
        // caught by the second assertion even if the first somehow was not.
        assert.notEqual(defaultResult.language.id, nmosResult.language.id, "the two runs must name two DIFFERENT languages");
        assert.equal((defaultResult.language.id as string) === (nmosResult.language.id as string), false);
      }
    } finally {
      removeScratchWorkspace(ws);
    }
  },
);
