// r2000-symbol-roundtrip.test.ts -- criterion 4's committed-fixture closed
// loop (R2000-15): proves the round trip is a LOOP, not two one-way dumps,
// by asserting the inbound ("discovered") name is ABSENT from both the store
// and the exported `.lbl` BEFORE the discovery step, and present in both
// AFTER it -- criterion 4's own wording is explicit that a passing export
// test plus a passing import test does not satisfy it on their own.
//
// FIXTURE (`<decisions_you_own>` #6, D-31): the committed
// `probe-illegal.prg` (Phase 9's evidence fixture) -- what is under test
// here is the round-trip MECHANISM, not a program's structure, so the
// subject needs no vectors, tables or handlers. Referenced by path with a
// guard assertion that it exists, so a moved fixture fails loudly rather
// than resolving to nothing.
//
// GATE (D-11, `r2000-test-gate.ts`): every regenerator2000-dependent test
// below is registered with `{ skip: skipReasonFor(...) }` and exits 0 with
// no hard failure when regenerator2000 is absent, except the standing
// availability-gate test, which hard-FAILs under VICE_REQUIRE_R2000. The two
// ceiling-refusal tests near the end need no live binary at all (the ceiling
// check inside `importLabels()` runs before any child is ever spawned), so
// they are registered ungated.
//
// WORKSPACE: temp project/label-file directories are created UNDER THIS
// FILE'S OWN DIRECTORY (`mkdtempSync(join(HERE, "."...))`), mirroring
// r2000-cli.test.ts's/r2000-tools.test.ts's/r2000-enum-gen.test.ts's own
// convention -- `r2000-tools.ts`'s `resolveStorePath()` requires every
// `.regen2000proj` path to resolve INSIDE the workspace root (T-11-PATH-
// ESCAPE), which a system tmpdir path is refused by design. Every directory
// created below is removed in a `finally`, never left behind.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  appendFileSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  statSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";
import { exportLabels, importLabels, R2000SymbolsError, regenerateAndReload } from "./r2000-symbols.ts";
import { runR2000Tool } from "./r2000-tools.ts";
import { runR2000 } from "./r2000-launch.ts";
import { parsePrg, synthesizeProject } from "./r2000-project.ts";
import { handleSymbolsLoad, handleSymbolsLookup, resetSymbolStoreForTest } from "./stock-symbols.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// `.claude/mcp/vice` -> `.claude/mcp` -> `.claude` -> repo root.
const FIXTURE_PATH = join(
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

// `handleSymbolsLoad`/`handleSymbolsLookup` are `needsSession: false` (never
// touch `deps`) -- same cast stock-symbols.test.ts's own `DEPS` constant
// uses.
const DEPS = {} as unknown as StockDispatchDeps;

function parseAnswer(result: { content: { text: string }[] }): Record<string, unknown> {
  return JSON.parse(result.content[0]!.text);
}

function withWorkspaceTempDir<T>(prefix: string, fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(HERE, prefix));
  return Promise.resolve(fn(dir)).finally(() => {
    rmSync(dir, { recursive: true, force: true });
    resetSymbolStoreForTest();
  });
}

/** Bootstraps the committed fixture into a fresh `.regen2000proj` inside
 * `dir` (D-05: `use_illegal_opcodes` forced true by `synthesizeProject()`
 * regardless), returning the project path and the fixture's own load
 * address/body. */
function bootstrapFixtureProject(dir: string): { projectPath: string; origin: number; body: Uint8Array } {
  const fixtureBytes = readFileSync(FIXTURE_PATH);
  const { origin, body } = parsePrg(fixtureBytes);
  const projectPath = join(dir, "roundtrip.regen2000proj");
  writeFileSync(projectPath, synthesizeProject(body, { origin }));
  return { projectPath, origin, body };
}

// ---------------------------------------------------------------------------
// The fixture must exist at the committed path (D-31 guard) -- always runs,
// no binary needed. A moved fixture fails loudly here rather than every
// gated test below silently skipping for the wrong reason.
// ---------------------------------------------------------------------------

test("probe-illegal.prg exists at its committed Phase-9 evidence path (D-31 fixture guard)", () => {
  assert.ok(
    existsSync(FIXTURE_PATH),
    `fixture not found at ${FIXTURE_PATH} -- probe-illegal.prg must stay committed at this path (D-31); ` +
      "update this file's FIXTURE_PATH if it was deliberately moved.",
  );
});

// ---------------------------------------------------------------------------
// D-11 availability gate.
// ---------------------------------------------------------------------------

const SKIP_REASON: string | false = skipReasonFor("r2000-symbol-roundtrip.test.ts");

test("regenerator2000 availability gate (D-11)", () => {
  assertR2000RequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// The closed loop -- ONE ordered test, deliberately not split into an
// "export" test and an "import" test: criterion 4's own wording requires the
// absent-before assertion to sit BETWEEN the two legs, which only an ordered
// single test can express.
// ---------------------------------------------------------------------------

test(
  "criterion 4: the closed symbol loop -- absent before discovery, present after, and stock-symbols.ts resolves both (R2000-15)",
  { skip: SKIP_REASON },
  async () => {
    await withWorkspaceTempDir(".r2000-symbol-roundtrip-test-loop-", async (dir) => {
      const { projectPath, origin } = bootstrapFixtureProject(dir);

      const USER_LABEL_NAME = "init_screen";
      const USER_LABEL_ADDR = origin; // 0xc000 for probe-illegal.prg -- inside the loaded body
      const DISCOVERED_NAME = "discovered_name";
      const DISCOVERED_ADDR = origin + 0x10; // still inside the 44-byte body

      // 1. (bootstrap already done above.)

      // 2. Write ONE user label into the store via the curated runner, save
      // (runR2000Tool auto-saves internally for a mutating tool), and export.
      const setResult = await runR2000Tool("r2000_set_label_name", {
        project: projectPath,
        address: USER_LABEL_ADDR,
        name: USER_LABEL_NAME,
      });
      assert.equal(setResult.isError, false, `setup: r2000_set_label_name failed: ${JSON.stringify(setResult)}`);

      const firstLblPath = join(dir, "first.lbl");
      const firstExport = await exportLabels({ projectPath, outPath: firstLblPath });
      assert.equal(
        firstExport.symbolCount,
        1,
        `expected exactly one exported symbol at this point, got ${JSON.stringify(firstExport)}`,
      );
      assert.equal(firstExport.symbols[0]?.name, USER_LABEL_NAME);
      assert.ok(
        !firstExport.symbols.some((s) => s.name.startsWith("a_")),
        `the exported file must not contain an a_-prefixed auto-label (measured user-labels-only behaviour): ${JSON.stringify(firstExport.symbols)}`,
      );

      // 3. ABSENT BEFORE -- this is the assertion that makes the loop a
      // loop: the inbound name must not exist yet, in either the store or
      // the exported .lbl, prior to the discovery step.
      const symbolsBeforeResult = await runR2000Tool("r2000_get_symbols", { project: projectPath });
      const symbolsBeforeRows = JSON.parse(symbolsBeforeResult.content.map((c) => c.text).join("")) as { name: string }[];
      assert.ok(
        !symbolsBeforeRows.some((r) => r.name === DISCOVERED_NAME),
        `absent before: "${DISCOVERED_NAME}" must not be in the store prior to the discovery step, got names: ${symbolsBeforeRows.map((r) => r.name).join(", ")}`,
      );
      assert.ok(
        !firstExport.symbols.some((s) => s.name === DISCOVERED_NAME),
        `absent before: "${DISCOVERED_NAME}" must not be in the exported .lbl prior to the discovery step`,
      );

      // 4. Simulate live discovery: append one `al C:xxxx .discovered_name`
      // line to the exported file, in the exact format stock-symbols.ts's
      // parser accepts -- the shape a name discovered against a running
      // machine takes; plan 11-11 does the same step against a real x64sc.
      const discoveredHex = DISCOVERED_ADDR.toString(16);
      appendFileSync(firstLblPath, `\nal C:${discoveredHex} .${DISCOVERED_NAME}\n`);

      // 5. importLabels() -- the D-28 path -- must report a disk-verified
      // import.
      const importResult = await importLabels({ projectPath, lblPath: firstLblPath });
      assert.equal(importResult.diskVerified, true, `import must be disk-verified: ${JSON.stringify(importResult)}`);
      assert.ok(importResult.importedNames.includes(DISCOVERED_NAME));
      assert.ok(importResult.importedNames.includes(USER_LABEL_NAME));

      // 6. Re-open the project in a FRESH child: r2000_get_symbols now
      // contains BOTH names (every runR2000Tool() call is already its own
      // fresh session/process per D-17), and a fresh exportLabels() from
      // disk emits both.
      const symbolsAfterResult = await runR2000Tool("r2000_get_symbols", { project: projectPath });
      const symbolsAfterRows = JSON.parse(symbolsAfterResult.content.map((c) => c.text).join("")) as { name: string }[];
      const symbolsAfterNames = symbolsAfterRows.map((r) => r.name);
      assert.ok(symbolsAfterNames.includes(USER_LABEL_NAME), `expected ${USER_LABEL_NAME} in ${symbolsAfterNames.join(", ")}`);
      assert.ok(symbolsAfterNames.includes(DISCOVERED_NAME), `expected ${DISCOVERED_NAME} in ${symbolsAfterNames.join(", ")}`);

      const finalLblPath = join(dir, "final.lbl");
      const finalExport = await exportLabels({ projectPath, outPath: finalLblPath });
      const finalNames = finalExport.symbols.map((s) => s.name);
      assert.ok(finalNames.includes(USER_LABEL_NAME));
      assert.ok(finalNames.includes(DISCOVERED_NAME));

      // 7. Feed the final exported file to stock-symbols.ts's loader and
      // assert both names resolve to their addresses -- the
      // vice_symbols_load half this repo owns and can test without an
      // emulator.
      const loadResult = await handleSymbolsLoad({ path: finalLblPath }, DEPS);
      const loadPayload = parseAnswer(loadResult) as { symbolCount: number };
      assert.ok(loadPayload.symbolCount >= 2, `expected at least 2 loaded symbols, got ${JSON.stringify(loadPayload)}`);

      const lookupUser = parseAnswer(await handleSymbolsLookup({ name: USER_LABEL_NAME }, DEPS)) as {
        found: boolean;
        address?: number;
      };
      assert.equal(lookupUser.found, true);
      assert.equal(lookupUser.address, USER_LABEL_ADDR);

      const lookupDiscovered = parseAnswer(await handleSymbolsLookup({ name: DISCOVERED_NAME }, DEPS)) as {
        found: boolean;
        address?: number;
      };
      assert.equal(lookupDiscovered.found, true);
      assert.equal(lookupDiscovered.address, DISCOVERED_ADDR);
    });
  },
);

// ---------------------------------------------------------------------------
// The discard-trap regression -- pins the trap itself, so buildImportLblArgs()'s
// --mcp-server-stdio pairing stays provably load-bearing rather than merely
// assumed. If this test ever fails because the trap disappeared upstream,
// that is the intended signal: the pairing can then be re-justified or
// relaxed DELIBERATELY, not by accident.
// ---------------------------------------------------------------------------

test(
  "discard-trap regression: --import_lbl + --headless does NOT persist (D-28's trap, pinned)",
  { skip: SKIP_REASON },
  async () => {
    await withWorkspaceTempDir(".r2000-symbol-roundtrip-test-trap-", async (dir) => {
      const { projectPath, origin } = bootstrapFixtureProject(dir);

      const TRAP_NAME = "trap_should_not_persist";
      const lblPath = join(dir, "trap-import.lbl");
      writeFileSync(lblPath, `al C:${origin.toString(16)} .${TRAP_NAME}\n`);

      // Deliberately built by hand, NOT through buildImportLblArgs() -- no
      // fixed builder in this repo can produce this argv (D-28), since
      // buildImportLblArgs() always pairs --mcp-server-stdio. This is
      // exactly the discard-prone combination main.rs:800-806 discards.
      const trapArgv = ["--import_lbl", lblPath, "--headless", projectPath];
      const trapResult = runR2000(trapArgv);
      assert.equal(
        trapResult.status,
        0,
        `the trap run itself must exit 0 (the discard is silent, not an error): stderr: ${trapResult.stderr}`,
      );

      const reExportPath = join(dir, "trap-reexport.lbl");
      const reExported = await exportLabels({ projectPath, outPath: reExportPath });
      assert.ok(
        !reExported.symbols.some((s) => s.name === TRAP_NAME),
        `the discard trap must have discarded "${TRAP_NAME}" -- if this assertion fails, the trap disappeared ` +
          "upstream and buildImportLblArgs()'s --mcp-server-stdio pairing should be re-justified or relaxed " +
          "deliberately, not accidentally.",
      );
    });
  },
);

// ---------------------------------------------------------------------------
// Ceiling tests (T-11-LBL-SIZE) -- proving the adapter did not route around
// the hardened reader. importLabels() ceiling-checks the CALLER-SUPPLIED
// .lbl file before ever spawning a child, so neither test below needs a live
// regenerator2000 and both run unconditionally.
// ---------------------------------------------------------------------------

test("importLabels refuses a .lbl exceeding MAX_LABEL_FILE_LINES, by name, without spawning a child", async () => {
  await withWorkspaceTempDir(".r2000-symbol-roundtrip-test-ceiling-lines-", async (dir) => {
    const lblPath = join(dir, "toomanylines.lbl");
    const lines = Array.from({ length: 50001 }, (_, i) => `; filler line ${i}`).join("\n");
    writeFileSync(lblPath, lines);
    // The project path never needs to exist -- the ceiling check runs
    // before importLabels() ever touches it.
    const projectPath = join(dir, "unused.regen2000proj");

    await assert.rejects(
      () => importLabels({ projectPath, lblPath }),
      (err: unknown) => {
        assert.match((err as Error).message, /50000-line ceiling/);
        return true;
      },
    );
  });
});

test("importLabels refuses a .lbl exceeding MAX_SYMBOLS, by name, without spawning a child", async () => {
  await withWorkspaceTempDir(".r2000-symbol-roundtrip-test-ceiling-symbols-", async (dir) => {
    const lblPath = join(dir, "toomanysymbols.lbl");
    const lines: string[] = [];
    for (let i = 0; i <= 20000; i++) {
      const addr = (i % 0x10000).toString(16).padStart(4, "0");
      lines.push(`al C:${addr} .sym${i}`);
    }
    writeFileSync(lblPath, lines.join("\n"));
    const projectPath = join(dir, "unused.regen2000proj");

    await assert.rejects(
      () => importLabels({ projectPath, lblPath }),
      (err: unknown) => {
        assert.match((err as Error).message, /20000-symbol ceiling/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// T-11-NAME-INJECT (route B): importLabels() refuses a .lbl carrying an
// illegal label name BEFORE any child is spawned, naming the offending line
// number and its own text -- same shape as the two ceiling tests above (no
// binary needed, ungated).
// ---------------------------------------------------------------------------

test("importLabels refuses a .lbl carrying an illegal label name, naming the offending line number and its text, without spawning a child", async () => {
  await withWorkspaceTempDir(".r2000-symbol-roundtrip-test-illegal-name-", async (dir) => {
    const lblPath = join(dir, "illegal.lbl");
    const lines = ["al C:0800 .main", "al C:0810 .bad-name", "al C:0820 .entry"];
    writeFileSync(lblPath, lines.join("\n"));
    const projectPath = join(dir, "unused.regen2000proj");

    await assert.rejects(
      () => importLabels({ projectPath, lblPath }),
      (err: unknown) => {
        assert.ok(err instanceof R2000SymbolsError);
        assert.match((err as Error).message, /line 2\b/);
        assert.match((err as Error).message, /bad-name/);
        assert.match((err as Error).message, /al C:0810 \.bad-name/);
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// R2000SymbolsError's own shape (unit-level). exportLabels()'s non-zero-exit
// and missing-output-file branches are exercised live by the gated tests
// above against a real regenerator2000 project path -- NOT re-tested here
// via an env-var-swapped spy binary: r2000-launch.ts's own R2000_BIN is a
// module-level constant resolved ONCE at import time
// (`process.env.R2000_BIN ?? "regenerator2000"`), so mutating
// `process.env.R2000_BIN` mid-test has no effect on an already-imported
// `runR2000()` -- a spy substitution attempted that way would coincidentally
// "pass" only because a REAL regenerator2000 run against a nonexistent
// project path also exits non-zero, which is not what such a test would
// claim to prove (exactly the class of vacuous test this repo's own
// engineering rules warn against).
// ---------------------------------------------------------------------------

test("R2000SymbolsError carries the class's own name", () => {
  const err = new R2000SymbolsError("test message");
  assert.equal(err.name, "R2000SymbolsError");
  assert.equal(err.message, "test message");
  assert.ok(err instanceof Error);
});

// ---------------------------------------------------------------------------
// Phase 11 IN-02 (D-11.1-06): regenerateAndReload() has zero production
// callers today (confirmed by grep across .claude/mcp/vice/,
// .claude/skills/ and scripts/ during the 11.1 audit). Rather than leave
// that ambiguous for a future phase to misread as "already wired", it is
// marked LIBRARY-ONLY in its own doc comment (r2000-symbols.ts), and this
// guard ties that marker to the real caller count in BOTH directions:
// zero callers requires the marker present; one or more callers requires
// the marker ABSENT (adopted, header now stale). Purely structural, no
// binary needed -- runs ungated, unlike the rest of this file.
// ---------------------------------------------------------------------------

/** Exactly the token this guard greps for -- defined once so the assertion
 * messages and the scan itself can never drift apart. Deliberately does
 * NOT read as a bare `Phase <N>` INSIDE A STRING LITERAL in a shipped
 * module: it lives here as a string constant in a `*.test.ts` file (not a
 * shipped module -- absent from package.json's `files[]`), and in
 * r2000-symbols.ts as prose inside a `/** ... *\/` doc comment (comments
 * are not scanned for phase-literal dangling refs). `docs-dangling-refs
 * .test.ts` is run after this file specifically to confirm neither
 * exemption was accidentally violated. */
const LIBRARY_ONLY_MARKER = "LIBRARY-ONLY (Phase 11 IN-02, D-11.1-06)";

const R2000_SYMBOLS_SOURCE_PATH = join(HERE, "r2000-symbols.ts");

/** Strips `//` and `/* ... *\/` comments, reusing `r2000-launch.test.ts`'s
 * WR-02-fixed close-token-by-position algorithm verbatim rather than
 * reinventing it -- needed here because r2000-symbols.ts's own header and
 * this guard's marker comment both discuss `regenerateAndReload(` in
 * prose, which an unfiltered scan would count as a call. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return;
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true;
        return;
      }
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return;
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

/** True iff the comment-stripped source contains an actual CALL to
 * `regenerateAndReload` -- `regenerateAndReload(` immediately followed by
 * an open paren, which a plain `import { regenerateAndReload }` (no paren
 * right after the identifier) never matches, and which its own `function
 * regenerateAndReload(` declaration line is explicitly excluded from
 * below. */
function callsRegenerateAndReload(strippedSrc: string, { excludeDeclaration }: { excludeDeclaration: boolean }): boolean {
  const withoutDecl = excludeDeclaration
    ? strippedSrc.replace(/\bexport\s+async\s+function\s+regenerateAndReload\s*\(/g, "")
    : strippedSrc;
  return /\bregenerateAndReload\s*\(/.test(withoutDecl);
}

/** Recursively lists every file under `dir`, skipping `node_modules` --
 * used to walk `.claude/skills/` and `scripts/` (which have no top-level
 * `readdirSync`-only equivalent of `.claude/mcp/vice`'s flat layout). */
function walkFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === ".git") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walkFiles(full));
    } else {
      results.push(full);
    }
  }
  return results;
}

// `.claude/mcp/vice` -> `.claude/mcp` -> `.claude` -> repo root.
const REPO_ROOT = join(HERE, "..", "..", "..");
const SKILLS_DIR = join(REPO_ROOT, ".claude", "skills");
const SCRIPTS_DIR = join(REPO_ROOT, "scripts");

/** Every production module this guard searches for a REAL call to
 * `regenerateAndReload`: every top-level non-test `.ts`/`.mts` file under
 * `.claude/mcp/vice` (excluding r2000-symbols.ts's own definition site,
 * per this plan's explicit instruction), plus every file under
 * `.claude/skills/` and `scripts/` -- the same three trees the Phase 11
 * IN-02 audit itself grepped. */
function productionCallerSearchDomain(): string[] {
  const viceModules = readdirSync(HERE)
    .filter((name) => /\.(ts|mts|mjs)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name))
    .map((name) => join(HERE, name));
  return [...viceModules, ...walkFiles(SKILLS_DIR), ...walkFiles(SCRIPTS_DIR)];
}

/** Counts production callers of `regenerateAndReload` across the derived
 * search domain. r2000-symbols.ts is scanned too (it is in the domain via
 * `viceModules` above) but with its own declaration line excluded, per the
 * plan's explicit "excluding its own definition site" instruction --
 * every other file is scanned without that exclusion, since none of them
 * could possibly contain the declaration. */
function countProductionCallers(): { file: string; count: number }[] {
  const hits: { file: string; count: number }[] = [];
  for (const file of productionCallerSearchDomain()) {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch {
      continue; // a symlink or other unreadable entry -- not a caller either way
    }
    const stripped = stripCommentLines(raw);
    const isSelf = file === R2000_SYMBOLS_SOURCE_PATH;
    if (!callsRegenerateAndReload(stripped, { excludeDeclaration: isSelf })) continue;
    const withoutDecl = isSelf
      ? stripped.replace(/\bexport\s+async\s+function\s+regenerateAndReload\s*\(/g, "")
      : stripped;
    const matches = withoutDecl.match(/\bregenerateAndReload\s*\(/g) ?? [];
    hits.push({ file, count: matches.length });
  }
  return hits;
}

test("non-vacuity: the scanner reaches regenerateAndReload's own definition site and at least one test reference", () => {
  // (a) the definition site itself, found directly (not via the caller
  // scanner, which deliberately excludes it) -- proves this test file's
  // path resolution to r2000-symbols.ts is correct.
  const symbolsSrc = readFileSync(R2000_SYMBOLS_SOURCE_PATH, "utf8");
  assert.match(
    stripCommentLines(symbolsSrc),
    /\bexport\s+async\s+function\s+regenerateAndReload\s*\(/,
    "the scanner's own path to r2000-symbols.ts did not find regenerateAndReload's declaration -- the search " +
      "domain is broken, not merely 'zero callers'",
  );

  // (b) at least one test reference to the bare identifier, proving grep
  // across test files is reaching real content. `regenerateAndReload` is
  // imported into THIS file (above) and referenced by the typeof check
  // below -- neither is a CALL, so this does not inflate the caller count,
  // but both are genuine occurrences of the identifier in a *.test.ts
  // file, which is exactly what this control needs to prove reachable.
  const ownSource = readFileSync(join(HERE, "r2000-symbol-roundtrip.test.ts"), "utf8");
  const importCount = (ownSource.match(/\bregenerateAndReload\b/g) ?? []).length;
  assert.ok(
    importCount >= 2,
    "expected at least two textual references to regenerateAndReload in this test file (the import and the " +
      `typeof check below), got ${importCount} -- the identifier-reachability control is not exercising anything`,
  );
});

test("regenerateAndReload is exported as a function (referenced, never invoked, by this structural guard)", () => {
  assert.equal(typeof regenerateAndReload, "function");
});

/** The ONE definition of the Phase 11 IN-02 biconditional (D-11.1-06): both
 * the real-source test below AND the planted-violation tests call this
 * exact function, fed either the real scan result or a synthetic one --
 * there is exactly one place this rule is written down (the 11-01
 * discipline: a structural test and its own proof must share the checked
 * logic, not each carry a copy). Throws (via `assert`) if the caller count
 * and the marker's presence disagree; returns normally if they agree. */
function assertLibraryOnlyBiconditional(callers: { file: string; count: number }[], markerPresent: boolean): void {
  if (callers.length === 0) {
    assert.ok(
      markerPresent,
      "regenerateAndReload has zero production callers but r2000-symbols.ts is missing the LIBRARY-ONLY " +
        `marker (${JSON.stringify(LIBRARY_ONLY_MARKER)}) -- the header must record this status`,
    );
  } else {
    assert.equal(
      markerPresent,
      false,
      "regenerateAndReload now has a production caller (" +
        callers.map((c) => `${c.file} x${c.count}`).join(", ") +
        ") but r2000-symbols.ts still carries the LIBRARY-ONLY marker -- the function has been adopted and " +
        "its header is now stale. Remove the marker in the same commit that adds the caller.",
    );
  }
}

test("Phase 11 IN-02 biconditional: zero production callers of regenerateAndReload <=> the LIBRARY-ONLY marker is present in r2000-symbols.ts", () => {
  const callers = countProductionCallers();
  const symbolsSrc = readFileSync(R2000_SYMBOLS_SOURCE_PATH, "utf8");
  const markerPresent = symbolsSrc.includes(LIBRARY_ONLY_MARKER);
  assertLibraryOnlyBiconditional(callers, markerPresent);
});

test("current state, asserted explicitly (not only the rule): today's caller count is 0 and the marker is present", () => {
  const callers = countProductionCallers();
  assert.deepEqual(
    callers,
    [],
    `expected zero production callers of regenerateAndReload, found: ${JSON.stringify(callers)}`,
  );
  const symbolsSrc = readFileSync(R2000_SYMBOLS_SOURCE_PATH, "utf8");
  assert.ok(
    symbolsSrc.includes(LIBRARY_ONLY_MARKER),
    `r2000-symbols.ts must contain the literal marker ${JSON.stringify(LIBRARY_ONLY_MARKER)} today`,
  );
});

// -- Planted violation (committed), exercising the SAME assertLibraryOnly ---
//    Biconditional() function the real test above calls, fed synthetic
//    scan results -- proving both failure branches are reachable and
//    correctly worded, without needing to mutate real files in CI. The
//    equivalent demonstration against REAL files (a scratch caller module;
//    a temporarily deleted marker) was run manually and is recorded in this
//    plan's SUMMARY, then reverted -- not committed, since a committed
//    scratch caller would itself flip the real guard's caller count.

test("planted violation: a production caller makes assertLibraryOnlyBiconditional demand the marker's removal", () => {
  assert.throws(
    () => assertLibraryOnlyBiconditional([{ file: "scratch-caller.ts", count: 1 }], /* markerPresent */ true),
    /now has a production caller.*still carries the LIBRARY-ONLY marker/s,
  );
});

test("planted violation: zero callers with the marker absent also fails assertLibraryOnlyBiconditional", () => {
  assert.throws(
    () => assertLibraryOnlyBiconditional([], /* markerPresent */ false),
    /zero production callers but r2000-symbols\.ts is missing the LIBRARY-ONLY/,
  );
});

test("control: zero callers with the marker present, and one caller with the marker absent, both pass assertLibraryOnlyBiconditional", () => {
  assert.doesNotThrow(() => assertLibraryOnlyBiconditional([], true));
  assert.doesNotThrow(() => assertLibraryOnlyBiconditional([{ file: "adopter.ts", count: 1 }], false));
});
