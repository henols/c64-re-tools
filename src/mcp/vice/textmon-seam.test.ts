// textmon-seam.test.ts
//
// THE structural, mechanical assertion of PARSE-03's third clause: each of
// the five text-monitor formats this phase adds a parser for has EXACTLY ONE
// owning module, and nothing outside it reads that format's raw text --
// "asserted structurally rather than left to convention". This is a FIFTH
// family adopting the same four mechanisms this tree already uses for that
// job, in its OWN file, next to the store's own seam guard -- not an
// extension of hostpath-consumers.test.ts (a different subject: which
// modules may reach hostpath.ts) and not folded into any of the five
// parsers' own *.test.ts files (each of those tests PARSING CORRECTNESS,
// never OWNERSHIP).
//
// THE FOUR MECHANISMS, AND WHERE EACH IS BORROWED FROM:
//   1. A hand-pinned family floor with a pinned-equals-measured companion --
//      hostpath-consumers.test.ts's ANNO_MODULE_FLOOR / HOST_TOOL_FAMILY_FLOOR
//      pattern (a non-vacuity floor that must be RAISED, never derived from
//      disk, plus a companion equality test that catches the family growing
//      unnoticed).
//   2. A declared map asserted against disk -- hostpath-consumers.test.ts's
//      DERIVED_TOOL_MODULES pattern (every entry named explicitly, every
//      filename asserted to exist, never a guessed name).
//   3. A named-absence-before-existence pattern -- hostpath-consumers.test.ts's
//      "every module this phase adds is absent... named before it exists"
//      idiom, here turned the other way: every format's literal is asserted
//      PRESENT in its own owner (the non-vacuity half) before the closed
//      consumer-set equality is asserted.
//   4. A planted-violation control run through the REAL predicate --
//      anno-seam.test.ts's four-route `namesNodeSqlite()` pattern: a
//      synthetic input that DOES violate the rule is run through the exact
//      function the real scan calls, proving the guard is capable of
//      failing, not merely present.
//
// WHY THIS LIVES IN ITS OWN FILE (from the plan's own decision record): the
// host-path consumer guard owns a different subject entirely, and this tree
// already has precedent for a second seam guard living in its own file next
// to the seam it polices (anno-seam.test.ts, next to anno-store.ts). A
// separate file also keeps this guard out of the way of the sibling plan
// that edits text-tools.ts, stock-dispatch.ts and friends in this same wave
// -- two plans touching one file in one wave is a collision this split
// avoids by construction.
//
// TWO DIFFERENT CENSUS RULES, DELIBERATELY DIFFERENT SHAPES:
//   - The LITERAL census (Task 1) does NOT strip comments. A format's
//     structural literal appearing only inside a `//` comment still counts
//     as knowledge of the format living in the wrong module -- a
//     commented-out reader is a reader waiting to be uncommented, and the
//     rule this file enforces is about WHERE that knowledge lives, not
//     whether it currently executes.
//   - The IMPORT census (Task 2) IS statement-anchored (mirrors
//     load-order.test.ts's IMPORT_REPO_ROOT_PATTERN and
//     hostpath-consumers.test.ts's HOSTPATH_IMPORT_RE): a relative specifier
//     merely quoted inside a comment does not count as importing the
//     module. These are two different questions -- "does this module's text
//     contain the format's own signature bytes" versus "does this module
//     structurally depend on the parser" -- and conflating them would blind
//     one half or the other.
//
// WHAT THIS FILE DOES NOT CHECK (the closing case, further down, states
// this too): whether a parser decodes correctly. That is each parser's own
// *.test.ts file's job. This file only checks WHERE a format's raw-text
// knowledge lives.
//
// A NOTE ON MEASURED REALITY VS. THIS PLAN'S OWN PROSE. The plan's decision
// record anticipated "the fixture loader's own test file" as the access
// map's ONE extra declared consumer beyond its owner and its owner's own
// test. Measured against this tree at plan time, the access map's header
// text is ALSO genuinely, legitimately present in three more files:
// text-tools.test.ts (exercising the declared handler module,
// handleMemmapShow, end-to-end), stock-dispatch.test.ts (a conformance test
// exercising vice_memmap_show through dispatchStock()), and
// text-capability-probe.test.ts (PARSE-04's capability probe, which dials
// memmapshow as one of five probed commands). Each carries its own stated
// reason below, per this guard's own "each declared entry outside the owner
// carries its own stated reason" rule -- the count is four rather than one,
// but the DISCIPLINE (every entry named, every entry justified, nothing
// silently absorbed) is unchanged. Declaring a NARROWER set here would not
// make the guard more correct; it would make it red against a codebase that
// has done nothing wrong.
//
// A SECOND NOTE ON MEASURED REALITY: WAVE-3 CONCURRENCY, RESOLVED POST-MERGE.
// This plan (42-08) ran concurrently, in its own worktree, alongside a
// sibling plan (42-07) that owns text-tools.ts, stock-dispatch.ts and
// friends and was (as of this file's original authoring) in the middle of
// wiring vice_cpu_history/vice_backtrace/vice_profile_flat/vice_io_registers
// through text-tools.ts. Measured in 42-08's OWN worktree at that time,
// text-tools.ts imported ONLY textmon-memmap.ts -- the other four parsers
// had no importer yet beyond their own test file, so the import-consumer
// declarations at that point reflected that pre-merge measured truth, not
// 42-07's anticipated end state. That was exactly the intended behaviour:
// this guard's own philosophy is that a new consumer appearing must fail
// loudly and be resolved by a DELIBERATE follow-up edit naming the plan that
// added it, never absorbed silently.
//
// That follow-up has now happened. Both plans merged, and the post-merge
// gate caught precisely the nine failures this comment predicted -- text-
// tools.ts became a second importer of textmon-cpuhistory.ts,
// textmon-backtrace.ts, textmon-profile.ts and textmon-registers.ts (four
// import-consumer-set and four full-tree-scan failures), and 42-07's own
// stock-dispatch.ts conformance test for vice_io_registers legitimately
// embeds the IO-registers row marker ">C:" in a realistic register-dump
// stub reply (the fifth, literal-consumer-set failure). FORMAT_OWNERS below
// now declares text-tools.ts as CPU history's, backtrace's, flat profile's
// and IO registers' import consumer, and stock-dispatch.test.ts as IO
// registers' fifth literal consumer, each entry naming plan 42-07 as the
// change that introduced it -- mirroring the access map's own entry, which
// already listed text-tools.ts because plan 42-01 had wired it before 42-08
// measured. The guard did its job; this is the deliberate resolution.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Scan-set helpers
// ---------------------------------------------------------------------------

/** Every top-level PRODUCTION `*.ts`/`*.mts` module in this directory,
 * excluding `*.test.*` -- the SAME shape `topLevelProductionModules()`
 * takes in hostpath-consumers.test.ts, reimplemented here (not imported:
 * that helper is private to its own file, and this guard's own purity is
 * better served by not reaching across a sibling test file for it) rather
 * than a fifth hand copy of a DIFFERENT concern -- this one is scoped to
 * `HERE` only, never a second directory walk elsewhere in the tree.
 * `dir` is injectable purely so this exact code path is exercised, never
 * driven blind. */
function topLevelProductionModules(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts)$/.test(name))
    .filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

/** Every top-level `*.ts`/`*.mts` module in this directory, production AND
 * test alike -- the scan set the per-format literal and import censuses
 * both run over, since a declared consumer can legitimately BE a test
 * file (a parser's own test, a handler's own test, a fixture loader's own
 * test). */
function allTopLevelModules(dir: string = HERE): string[] {
  return readdirSync(dir).filter((name) => /\.(ts|mts)$/.test(name));
}

/** Reads a candidate module's FULL CONTENT as bytes first, then decodes as
 * UTF-8 -- never a shell-out to a text tool that might treat a file as
 * binary and silently skip it. `anno-memmap-render.ts` (this tree's own,
 * shipped, NUL-byte-containing module) is the measured reason this
 * matters: `file(1)` classifies it as "binary data" and a plain `grep`
 * (no `-a`) silently reports zero matches against it, exit code 1 -- a
 * census built on that tool would scan fewer files than it claims to and
 * every consumer-set assertion below would pass by scanning less, not by
 * the tree being clean. `readFileSync()` returns a `Buffer` regardless of
 * NUL bytes, and `Buffer#toString("utf8")` decodes a lone NUL as the valid
 * code point U+0000 with no truncation -- MEASURED against this tree's own
 * copy of that file, further down. */
function readModuleSource(name: string, dir: string = HERE): string {
  return readFileSync(join(dir, name)).toString("utf8");
}

// ---------------------------------------------------------------------------
// The family floor, and its pinned-equals-measured companion (mechanism 1)
// ---------------------------------------------------------------------------

/** The `textmon-` family scan: every top-level PRODUCTION module whose name
 * starts `textmon-`. */
function textmonFamilyModules(dir: string = HERE): string[] {
  return topLevelProductionModules(dir)
    .filter((name) => /^textmon-.*\.(ts|mts)$/.test(name))
    .sort();
}

/** THE FLOOR IS AN ARITHMETIC EXPRESSION, NEVER A BARE INTEGER, AND NEVER
 * DERIVED FROM DISK (`disk.length >= disk.length` cannot fail, and this
 * floor exists precisely to be capable of failing). `5` is the five text
 * parsers this phase adds -- textmon-memmap.ts, textmon-cpuhistory.ts,
 * textmon-backtrace.ts, textmon-profile.ts, textmon-registers.ts -- and `1`
 * is the ONE pre-existing fixture loader, textmon-fixtures.ts, which
 * carries the family's own filename prefix but owns no format of its own
 * (it is not one of the five entries in FORMAT_OWNERS below). Six modules
 * total. RAISED, NEVER LOWERED (this tree's own D-13 discipline): if a
 * SIXTH `textmon-` module joins the family, re-derive this expression
 * deliberately, naming the plan that added it -- never nudge the integer to
 * make the equality below pass again. */
const TEXTMON_MODULE_FLOOR = 5 + 1;

test("the textmon- family (5 parsers + 1 fixture loader) is derived from disk with a non-vacuity floor, not a hard-coded list", () => {
  const modules = textmonFamilyModules();
  assert.ok(
    modules.length >= TEXTMON_MODULE_FLOOR,
    `expected >= ${TEXTMON_MODULE_FLOOR} textmon-*.ts production modules on disk, found ${modules.length} ` +
      `(${modules.join(", ")}) -- an empty or broken glob must fail loudly here rather than let every assertion ` +
      "below pass by scanning nothing",
  );
});

test("the hand-pinned TEXTMON_MODULE_FLOOR equals the measured textmon- family count -- a sixth module joining the family fails HERE with the right diagnosis", () => {
  const modules = textmonFamilyModules();
  assert.equal(
    modules.length,
    TEXTMON_MODULE_FLOOR,
    `TEXTMON_MODULE_FLOOR is pinned at ${TEXTMON_MODULE_FLOOR} but ${modules.length} textmon-*.ts production ` +
      `modules are on disk (${modules.join(", ")}) -- the family moved underneath the plan that pinned this ` +
      "number. Re-derive the expression deliberately, naming the plan that added or removed the module; do NOT " +
      "adjust the literal to fit, and never compute it from disk, which would make it unfailable.",
  );
});

test("positive control: the five parser modules and the one fixture loader are all present in the derived family", () => {
  const modules = textmonFamilyModules();
  for (const name of [
    "textmon-memmap.ts",
    "textmon-cpuhistory.ts",
    "textmon-backtrace.ts",
    "textmon-profile.ts",
    "textmon-registers.ts",
    "textmon-fixtures.ts",
  ]) {
    assert.ok(modules.includes(name), `${name} must be present in the derived textmon- family`);
  }
});

// ---------------------------------------------------------------------------
// The declared owner map (mechanism 2): one entry per format
// ---------------------------------------------------------------------------

/** One declared consumer, with its own stated reason -- every entry outside
 * a bare "this is the owner" carries one, per this guard's own rule that an
 * allowlist that can grow silently is how a seam guard rots into a
 * permanent exemption. */
interface DeclaredConsumer {
  readonly file: string;
  readonly reason: string;
}

/** This guard's own filename. Every format's `literalConsumers` declares it
 * with the SAME stated reason: this file necessarily spells each format's
 * literal as DATA -- once in `FORMAT_OWNERS` itself, and again inside every
 * planted-violation fixture below -- to build the census and to prove the
 * shared predicate can fail. That is knowledge OF the literal for the
 * purpose of comparing against it, never a reader of a live format reply,
 * and the anno-seam.test.ts precedent (`TEST_FILES_NAMING_SQLITE` declaring
 * itself for the identical reason) is followed here rather than reinvented. */
const SEAM_FILE = "textmon-seam.test.ts";
const SELF_DECLARATION_REASON =
  "this guard's own file: FORMAT_OWNERS declares every format's literal as data, and the planted-violation " +
  "cases below construct synthetic fixtures containing it -- comparing against the literal, never reading a live reply";

interface FormatOwner {
  /** Human-readable format name, used in messages only. */
  readonly name: string;
  /** The owning module's filename. */
  readonly module: string;
  /** The owning module's own test file. */
  readonly testFile: string;
  /** The format's distinctive structural literal, taken from the owner's
   * REAL source (see each entry's own comment for where). For every format
   * but the flat profile this is matched as a plain substring; the flat
   * profile's escape-sequence spelling is matched case-insensitively by
   * `containsFormatLiteral()` below, documented at that call site. */
  readonly literal: string;
  /** The closed, declared set of modules whose text may legitimately
   * contain `literal` -- always includes `module` and `testFile`; anything
   * beyond those two carries its own reason. */
  readonly literalConsumers: readonly DeclaredConsumer[];
  /** The closed, declared set of modules that may legitimately IMPORT
   * `module` -- always includes `testFile`; a genuine tool-level handler
   * (when one has landed) is the one other entry this ever carries. */
  readonly importConsumers: readonly DeclaredConsumer[];
}

const FORMAT_OWNERS: readonly FormatOwner[] = [
  {
    name: "access map",
    module: "textmon-memmap.ts",
    testFile: "textmon-memmap.test.ts",
    // textmon-memmap.ts:141 -- HEADER_LINE, VICE's own `memmapshow` header,
    // byte-for-byte (two spaces after "IO", one after "ROM", no trailing
    // space).
    literal: "addr: IO  ROM RAM",
    literalConsumers: [
      { file: "textmon-memmap.ts", reason: "the owner: HEADER_LINE, matched against every memmapshow reply's first line" },
      { file: "textmon-memmap.test.ts", reason: "the owner's own test file, using this header in real-capture and synthetic fixtures" },
      {
        file: "textmon-fixtures.test.ts",
        reason: "the fixture loader's own test, asserting what loadTextFixture() loaded for the access-map fixture",
      },
      {
        file: "text-tools.test.ts",
        reason: "the declared handler module's (text-tools.ts) own test, exercising handleMemmapShow() end-to-end with a realistic memmapshow stub",
      },
      {
        file: "stock-dispatch.test.ts",
        reason: "a conformance test exercising vice_memmap_show end-to-end through dispatchStock() with a realistic memmapshow stub",
      },
      {
        file: "text-capability-probe.test.ts",
        reason: "PARSE-04's capability probe test, dialing memmapshow as one of five probed commands with a realistic stub reply",
      },
      { file: SEAM_FILE, reason: SELF_DECLARATION_REASON },
    ],
    importConsumers: [
      { file: "textmon-memmap.test.ts", reason: "the owner's own test file" },
      { file: "text-tools.ts", reason: "the declared handler module: handleMemmapShow, whose body delegates to the owner's own parse and range-projection exports" },
    ],
  },
  {
    name: "CPU history",
    module: "textmon-cpuhistory.ts",
    testFile: "textmon-cpuhistory.test.ts",
    // textmon-cpuhistory.ts:141 -- FLAG_SET_GLYPHS, VICE's own fixed
    // processor-status-flag print order.
    literal: "NV-BDIZC",
    literalConsumers: [
      { file: "textmon-cpuhistory.ts", reason: "the owner: FLAG_SET_GLYPHS, matched position-by-position against every flag string" },
      { file: SEAM_FILE, reason: SELF_DECLARATION_REASON },
    ],
    importConsumers: [
      { file: "textmon-cpuhistory.test.ts", reason: "the owner's own test file" },
      {
        file: "text-tools.ts",
        reason: "plan 42-07's handleCpuHistory, whose body delegates to the owner's own parse export",
      },
    ],
  },
  {
    name: "backtrace",
    module: "textmon-backtrace.ts",
    testFile: "textmon-backtrace.test.ts",
    // textmon-backtrace.ts:141 -- the fixed " [SP +" opener FRAME_PREFIX_RE
    // anchors every frame line on, between a frame's callee address and its
    // (possibly negative) stack-pointer offset.
    literal: "[SP +",
    literalConsumers: [
      { file: "textmon-backtrace.ts", reason: "the owner: FRAME_PREFIX_RE's fixed stack-pointer field opener" },
      { file: "textmon-backtrace.test.ts", reason: "the owner's own test file, using this opener in synthetic frame-line fixtures" },
      { file: SEAM_FILE, reason: SELF_DECLARATION_REASON },
    ],
    importConsumers: [
      { file: "textmon-backtrace.test.ts", reason: "the owner's own test file" },
      {
        file: "text-tools.ts",
        reason: "plan 42-07's handleBacktrace, whose body delegates to the owner's own parse export",
      },
    ],
  },
  {
    name: "flat profile",
    module: "textmon-profile.ts",
    testFile: "textmon-profile.test.ts",
    // textmon-profile.ts:122 -- THOUSANDS_SEPARATOR, the SOURCE-CODE ESCAPE
    // SPELLING of U+202F (narrow no-break space), never the raw UTF-8
    // bytes: see containsFormatLiteral() below for why this one format is
    // matched differently from the other four.
    literal: "\\u202f",
    literalConsumers: [
      {
        file: "textmon-profile.ts",
        reason: "the owner: THOUSANDS_SEPARATOR, the one place this tree spells VICE's narrow-no-break-space thousands separator",
      },
      { file: SEAM_FILE, reason: SELF_DECLARATION_REASON },
    ],
    importConsumers: [
      { file: "textmon-profile.test.ts", reason: "the owner's own test file" },
      {
        file: "text-tools.ts",
        reason: "plan 42-07's handleProfileFlat, whose body delegates to the owner's own parse export",
      },
    ],
  },
  {
    name: "IO registers",
    module: "textmon-registers.ts",
    testFile: "textmon-registers.test.ts",
    // textmon-registers.ts:220/226 -- the fixed ">C:" marker DUMP_ROW_PREFIX_RE
    // and DUMP_ROW_RE both anchor on: ">" then the main-CPU memspace letter
    // then ":", opening every 16-byte register-dump row.
    literal: ">C:",
    literalConsumers: [
      { file: "textmon-registers.ts", reason: "the owner: the fixed row marker DUMP_ROW_PREFIX_RE/DUMP_ROW_RE anchor every hex-dump row on" },
      { file: "textmon-registers.test.ts", reason: "the owner's own test file, using this marker in synthetic dump-row fixtures" },
      {
        file: "stock-dispatch.test.ts",
        reason:
          "plan 42-07's conformance test exercising vice_io_registers end-to-end through dispatchStock() with a realistic register-dump stub reply",
      },
      { file: SEAM_FILE, reason: SELF_DECLARATION_REASON },
    ],
    importConsumers: [
      { file: "textmon-registers.test.ts", reason: "the owner's own test file" },
      {
        file: "text-tools.ts",
        reason: "plan 42-07's handleIoRegisters, whose body delegates to the owner's own parse export",
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Injectivity: no module owns two formats, no format is owned by two modules
// ---------------------------------------------------------------------------

test("the owner map is injective in both directions: no duplicated module, no duplicated format name", () => {
  const moduleNames = new Set(FORMAT_OWNERS.map((f) => f.module));
  assert.equal(moduleNames.size, FORMAT_OWNERS.length, "a module owning two formats must be caught here -- the owning-module set collapsed");
  const formatNames = new Set(FORMAT_OWNERS.map((f) => f.name));
  assert.equal(formatNames.size, FORMAT_OWNERS.length, "a format owned by two modules must be caught here -- the format-name set collapsed");
  assert.equal(FORMAT_OWNERS.length, 5, "the owner map must declare exactly the five formats this phase adds parsers for");
});

test("every module and test file named in the owner map exists on disk", () => {
  for (const owner of FORMAT_OWNERS) {
    assert.ok(existsSync(join(HERE, owner.module)), `${owner.module} (${owner.name}'s declared owner) must exist`);
    assert.ok(existsSync(join(HERE, owner.testFile)), `${owner.testFile} (${owner.name}'s declared owner test) must exist`);
    for (const consumer of owner.literalConsumers) {
      assert.ok(existsSync(join(HERE, consumer.file)), `${consumer.file} (a declared literal consumer of ${owner.name}) must exist`);
    }
    for (const consumer of owner.importConsumers) {
      assert.ok(existsSync(join(HERE, consumer.file)), `${consumer.file} (a declared importer of ${owner.name}) must exist`);
    }
  }
});

// ---------------------------------------------------------------------------
// The literal predicate (shared, mechanism 3's non-vacuity half + mechanism 4)
// ---------------------------------------------------------------------------

/** True iff `source` contains `owner`'s distinctive structural literal.
 * Deliberately NOT comment-stripped (see this file's header) -- a literal
 * appearing only inside a comment still counts.
 *
 * The flat profile is the one format matched DIFFERENTLY: its literal is
 * the SOURCE-CODE ESCAPE SPELLING of U+202F, and JavaScript/TypeScript
 * source may spell that escape's trailing hex digit as either `f` or `F` --
 * both spell the identical code point, so this predicate accepts either
 * case for that one format only (the plan's own instruction: "accept
 * either letter case of the hexadecimal spelling as the same token"). The
 * other four formats' literals are matched as an exact, case-sensitive
 * substring -- VICE has never emitted an uppercase glyph or an
 * alternately-cased header, so case-insensitivity there would only widen
 * the match surface for no real format variation it protects against. */
function containsFormatLiteral(source: string, owner: FormatOwner): boolean {
  if (owner.name === "flat profile") {
    return /\\u202f/i.test(source);
  }
  return source.includes(owner.literal);
}

test("non-vacuity: every format's literal IS found in its own owner's real source", () => {
  for (const owner of FORMAT_OWNERS) {
    const ownerSource = readModuleSource(owner.module);
    assert.ok(
      containsFormatLiteral(ownerSource, owner),
      `${owner.name}'s literal must be found in its own owner (${owner.module}), or every census below is vacuous`,
    );
  }
});

// ---------------------------------------------------------------------------
// The NUL-byte non-vacuity case
// ---------------------------------------------------------------------------

test("the scanned module set includes the NUL-byte-containing module by name, and reading it does not truncate", () => {
  const all = allTopLevelModules();
  assert.ok(
    all.includes("anno-memmap-render.ts"),
    "anno-memmap-render.ts (this tree's own NUL-byte-containing shipped module) must appear in the scanned set by name -- " +
      "a plain `grep` (without -a) silently skips this file (file(1) classifies it as binary data), which is exactly the " +
      "kind of silently-shortened census this file's own reader is built to avoid",
  );

  const rawBytes = readFileSync(join(HERE, "anno-memmap-render.ts"));
  assert.ok(rawBytes.includes(0), "anno-memmap-render.ts must genuinely contain a NUL byte, or this case proves nothing");

  const decoded = readModuleSource("anno-memmap-render.ts");
  assert.equal(decoded.length, rawBytes.toString("utf8").length, "decoding must not truncate at the NUL byte");
  assert.ok(decoded.includes("export"), "the module's real code, past the NUL byte, must still be visible to this reader");
});

test("non-vacuity: the full top-level scan set is real and substantial", () => {
  const all = allTopLevelModules();
  assert.ok(all.length > 50, `the scanned top-level module set must be substantial, got ${all.length}`);
  for (const owner of FORMAT_OWNERS) {
    assert.ok(all.includes(owner.module), `${owner.module} must be in the scanned set, or the censuses below are vacuous`);
    assert.ok(all.includes(owner.testFile), `${owner.testFile} must be in the scanned set, or the censuses below are vacuous`);
  }
});

// ---------------------------------------------------------------------------
// The per-format literal-consumer-set equality (Task 1's conclusion)
// ---------------------------------------------------------------------------

for (const owner of FORMAT_OWNERS) {
  test(`${owner.name}: the measured literal-consumer set equals the declared set exactly (neither a subset nor a superset passes)`, () => {
    const declared = owner.literalConsumers.map((c) => c.file).slice().sort();
    const all = allTopLevelModules();
    const measured = all.filter((name) => containsFormatLiteral(readModuleSource(name), owner)).sort();
    assert.deepEqual(
      measured,
      declared,
      `${owner.name}'s measured literal-consumer set ${JSON.stringify(measured)} does not equal the declared set ` +
        `${JSON.stringify(declared)} -- a new consumer must be added deliberately, with its own stated reason, never absorbed silently`,
    );
  });
}

// ---------------------------------------------------------------------------
// The import predicate (statement-anchored) and per-format equality (Task 2)
// ---------------------------------------------------------------------------

/** Builds a STATEMENT-ANCHORED import pattern for `moduleName`, mirroring
 * load-order.test.ts's own IMPORT_REPO_ROOT_PATTERN and
 * hostpath-consumers.test.ts's HOSTPATH_IMPORT_RE: optional leading
 * whitespace, the literal `import` keyword (optionally followed by the
 * type-only modifier), never a `//` comment line, then an unconstrained
 * import clause up to a `from "./<moduleName>"` specifier. `[^;]*?` bounds
 * the lazy match to the current statement -- a real import statement
 * contains no internal `;` -- while still spanning a multi-line brace-list
 * import (a negated character class matches newlines even though `.` does
 * not, matching this tree's own established idiom). */
function importPatternFor(moduleName: string): RegExp {
  const stem = moduleName.replace(/\.(ts|mts)$/, "");
  const escapedStem = stem.replace(/[.]/g, "\\.");
  return new RegExp(`^[ \\t]*import(?:\\s+type)?\\s+[^;]*?from\\s+["']\\./${escapedStem}(?:\\.(?:ts|mts))?["']`, "m");
}

function importsModule(source: string, moduleName: string): boolean {
  return importPatternFor(moduleName).test(source);
}

for (const owner of FORMAT_OWNERS) {
  test(`${owner.name}: the measured import-consumer set equals the declared set exactly`, () => {
    const declared = owner.importConsumers.map((c) => c.file).slice().sort();
    const all = allTopLevelModules();
    const measured = all.filter((name) => name !== owner.module && importsModule(readModuleSource(name), owner.module)).sort();
    assert.deepEqual(
      measured,
      declared,
      `${owner.name}'s measured import-consumer set ${JSON.stringify(measured)} does not equal the declared set ` +
        `${JSON.stringify(declared)} -- the failure names the unexpected importer directly above: a third importer ` +
        "means a second consumer of the format has appeared and must be reviewed deliberately",
    );
  });
}

test("importsModule(): the anchor never fires on a specifier merely quoted inside a comment", () => {
  const commentOnly = [
    "// see the parser: import { parseAccessMap } from \"./textmon-memmap.ts\";",
    "export function useIt() { return 1; }",
    "",
  ].join("\n");
  assert.equal(
    importsModule(commentOnly, "textmon-memmap.ts"),
    false,
    "a specifier quoted only inside a // comment must not be classified as an import",
  );
});

test("importsModule(): a multi-line brace-list import is still caught", () => {
  const multiLine = ["import {", "  parseAccessMap,", "  accessMapRanges,", '} from "./textmon-memmap.ts";', "", "export function useIt() {}", ""].join(
    "\n",
  );
  assert.equal(importsModule(multiLine, "textmon-memmap.ts"), true, "a multi-line named import must be caught");
});

// ---------------------------------------------------------------------------
// The shared violation predicate (mechanism 4): ONE definition, called by
// the real scan AND every planted case below.
// ---------------------------------------------------------------------------

interface Violation {
  readonly kind: "literal" | "import";
  readonly format: string;
  readonly module: string;
  readonly detail: string;
}

/** Returns every declared-rule violation `(moduleName, source)` commits
 * against `owner` -- zero, one, or two entries (a module can simultaneously
 * contain the literal AND import the parser from outside both declared
 * sets). This is the ONE function both the real full-tree scan below and
 * every planted-violation test call: a control that reimplemented the check
 * would prove only that the reimplementation works, never that the real
 * assertions above are capable of failing. */
function checkViolations(owner: FormatOwner, moduleName: string, source: string): Violation[] {
  const violations: Violation[] = [];
  if (containsFormatLiteral(source, owner) && !owner.literalConsumers.some((c) => c.file === moduleName)) {
    violations.push({
      kind: "literal",
      format: owner.name,
      module: moduleName,
      detail: `${moduleName} contains the ${owner.name} literal ${JSON.stringify(owner.literal)} but is not a declared literal consumer`,
    });
  }
  if (importsModule(source, owner.module) && !owner.importConsumers.some((c) => c.file === moduleName)) {
    violations.push({
      kind: "import",
      format: owner.name,
      module: moduleName,
      detail: `${moduleName} imports ${owner.module} but is not a declared importer of ${owner.name}`,
    });
  }
  return violations;
}

for (const owner of FORMAT_OWNERS) {
  test(`${owner.name}: the real full-tree scan reports zero violations through the shared predicate`, () => {
    const all = allTopLevelModules();
    const violations = all.flatMap((name) => checkViolations(owner, name, readModuleSource(name)));
    assert.deepEqual(violations, [], `${owner.name}: checkViolations() found real violations: ${JSON.stringify(violations)}`);
  });
}

// ---------------------------------------------------------------------------
// The planted-violation controls: four reported, three clean, all through
// checkViolations() -- never a second copy of the matching logic.
//
// The representative format is the access map (FORMAT_OWNERS[0]) -- the
// mechanism is generic over any FormatOwner, and running it once, clearly,
// is more legible than five near-identical copies; the per-format real-scan
// tests immediately above already exercise checkViolations() against every
// one of the other four formats' OWN real files.
// ---------------------------------------------------------------------------

const MEMMAP = FORMAT_OWNERS[0]!;

test("planted violation 1: the literal in CODE, under a module name outside the declared set, is reported", () => {
  const planted = `export const STUB = "${MEMMAP.literal}";\n`;
  const violations = checkViolations(MEMMAP, "stock-cia.ts", planted);
  assert.ok(
    violations.some((v) => v.kind === "literal"),
    "a literal in code under a non-declared module name must be reported -- if this fails, the equality assertion above cannot catch a real violation",
  );
});

test("planted violation 2: the SAME literal, present ONLY inside a comment, under a module name outside the declared set, is STILL reported", () => {
  // The rule is about where the format's structural knowledge lives, not
  // whether it currently executes -- a commented-out reader is a reader
  // waiting to be uncommented, so the literal census (unlike the import
  // census) does not strip comments.
  const planted = `// a stub reply shaped like ${MEMMAP.literal}\nexport function useIt() { return 1; }\n`;
  const violations = checkViolations(MEMMAP, "stock-cia.ts", planted);
  assert.ok(
    violations.some((v) => v.kind === "literal"),
    "a literal present only inside a comment must still be reported -- exempting comments would let format knowledge hide in prose",
  );
});

test("planted violation 3: an import of the parser, under a module name outside the declared importer set, is reported", () => {
  const planted = `import { parseAccessMap } from "./${MEMMAP.module}";\nexport function useIt() { return parseAccessMap; }\n`;
  const violations = checkViolations(MEMMAP, "stock-cia.ts", planted);
  assert.ok(
    violations.some((v) => v.kind === "import"),
    "an import from a non-declared module must be reported -- if this fails, the import equality assertion above cannot catch a real violation",
  );
});

test("planted violation 4: a TYPE-ONLY import of the parser, under a module name outside the declared importer set, is still reported", () => {
  // Proves the anchor's `(?:\s+type)?` modifier is exercised in the
  // reporting direction too -- load-order.test.ts's own regression corpus
  // establishes a type-only import must be caught even though it is erased
  // before module resolution; a guard that only caught VALUE imports would
  // miss a real second consumer that happened to import type-only.
  const planted = `import type { AccessMap } from "./${MEMMAP.module}";\nexport function useIt(): AccessMap | undefined { return undefined; }\n`;
  const violations = checkViolations(MEMMAP, "stock-cia.ts", planted);
  assert.ok(
    violations.some((v) => v.kind === "import"),
    "a type-only import from a non-declared module must still be reported",
  );
});

test("clean counterpart 1: the SAME literal, under the OWNER's own module name, is NOT reported", () => {
  const clean = `export const STUB = "${MEMMAP.literal}";\n`;
  const violations = checkViolations(MEMMAP, MEMMAP.module, clean);
  assert.deepEqual(violations, [], "the owner's own name must never be reported for containing its own literal");
});

test("clean counterpart 2: the SAME import, from the declared handler module's own name, is NOT reported", () => {
  const clean = `import { parseAccessMap } from "./${MEMMAP.module}";\nexport function useIt() { return parseAccessMap; }\n`;
  const handlerName = MEMMAP.importConsumers.find((c) => c.file !== MEMMAP.testFile)?.file;
  assert.ok(handlerName, "the access map must have a declared handler importer beyond its own test file for this control to mean anything");
  const violations = checkViolations(MEMMAP, handlerName!, clean);
  assert.deepEqual(violations, [], "the declared handler module must never be reported for its own legitimate import");
});

test("clean counterpart 3: an import specifier quoted ONLY inside a comment, under a non-declared module name, is NOT reported", () => {
  // Proves the discriminating half of the import rule specifically: the
  // literal census (planted violation 2) DOES fire on a comment; the
  // import census does NOT, because it is statement-anchored. A control
  // that only tested the first would leave the second's discrimination
  // unproven.
  const commentOnly = `// see the parser: import { parseAccessMap } from "./${MEMMAP.module}";\nexport function useIt() { return 1; }\n`;
  const violations = checkViolations(MEMMAP, "stock-cia.ts", commentOnly);
  assert.deepEqual(
    violations,
    [],
    "an import specifier quoted only inside a comment must not be reported -- the import predicate must not degrade into a substring search",
  );
});

// ---------------------------------------------------------------------------
// The closing case: this file's own honest scope statement
// ---------------------------------------------------------------------------

test("scope: this file checks WHERE each format's raw-text knowledge lives, never WHETHER a parser decodes correctly", () => {
  // A structural guard's job ends at ownership. Whether each of the five
  // parser functions this phase adds decodes its own format's bytes
  // correctly is each parser's own *.test.ts file's job --
  // textmon-memmap.test.ts, textmon-cpuhistory.test.ts,
  // textmon-backtrace.test.ts, textmon-profile.test.ts,
  // textmon-registers.test.ts. Adding a behavioural assertion here
  // (asserting a DECODED VALUE rather than a module NAME) would blur that
  // boundary and duplicate coverage those files already own -- this test
  // exists to say so, mechanically, rather than leave the boundary to a
  // future reader's inference.
  //
  // Built as a concatenation (never a literal call-shaped token like
  // `"parse" + "AccessMap("`... no -- built from the five parsers' OWN
  // exported function names, joined with the SAME open-paren every real
  // call site would use) so this scan is proven against the real names,
  // not a hand-typed guess that could drift from what the parsers actually
  // export.
  const parserFunctionNames = ["parseAccessMap", "parseCpuHistory", "parseBacktrace", "parseFlatProfile", "parseIoRegisters"];
  const openParen = String.fromCharCode(40); // never spelled as a literal "(" next to a parser name in this file's own text
  const ownSource = readModuleSource("textmon-seam.test.ts");
  for (const name of parserFunctionNames) {
    const callShape = name + openParen;
    assert.equal(ownSource.includes(callShape), false, `this file must never call ${name}() -- that would test decode correctness, not ownership`);
  }
});
