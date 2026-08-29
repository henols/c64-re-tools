// block-class.test.ts
//
// The unit tests for the ONE store-vocabulary boundary (SEAM-03). Two of
// these are structural rather than behavioural and are the load-bearing
// ones:
//
//   - the IMPORT-PURITY assertion. `block-class.ts`'s header trap 1 records
//     that giving the classifier the census, the raw bytes, a decoder or a
//     confidence grade would collapse the bytes-versus-store independence
//     axis QUIETLY -- the coverage suite's independence test would keep
//     passing while the claim it protects became void. A prohibition that
//     only a header states is a prohibition a future edit does not see, so
//     it is asserted here from the module's own source.
//
//   - the `files[]` INCLUSION assertion. This is the exact inverse of the
//     test-only-module assertions elsewhere in this suite: the classifier is
//     production runtime code reachable from the published entry point's
//     relative-import closure, so it MUST ship. `r2000-verify.test.ts`'s
//     absence assertion is the shape; only the polarity differs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { blockClassAt, type BlockClass, type BlockEntry } from "./block-class.ts";
import { codeOnly } from "./shipped-modules.ts";
import { DATA_TYPES } from "./anno-types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The EXTERNAL ANALYSER's spellings that the production mapping recognises by
 * name, plus one it deliberately does not. This is the capitalised vocabulary
 * the rented analyser's Rust `Display` emits and every committed coverage
 * fixture is spelled in -- it is NOT this project's own store's vocabulary,
 * which is lowercase and lives in `anno-types.ts`. That distinction is
 * load-bearing now that the mapping accepts both.
 *
 * Written out here rather than imported so a silent change to the mapping
 * cannot silently change its own test. */
const ANALYSER_CODE = "Code";
const ANALYSER_UNDEFINED = "Undefined";
const ANALYSER_OTHER = "Byte";

const ONE_BLOCK: readonly BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: ANALYSER_CODE }];

// ---------------------------------------------------------------------------
// 1. Coverage and the inclusive range ends
// ---------------------------------------------------------------------------

test("an address inside a block returns that block's neutral class", () => {
  assert.equal(blockClassAt(ONE_BLOCK, 0x0820), "code");
});

test("start_address and end_address are BOTH inclusive", () => {
  assert.equal(blockClassAt(ONE_BLOCK, 0x0810), "code", "start_address is inside the block, not one before it");
  assert.equal(blockClassAt(ONE_BLOCK, 0x084f), "code", "end_address is inside the block, not one past it");
});

test("one step either side of the block returns null", () => {
  assert.equal(blockClassAt(ONE_BLOCK, 0x080f), null, "start_address - 1 must be uncovered");
  assert.equal(blockClassAt(ONE_BLOCK, 0x0850), null, "end_address + 1 must be uncovered");
});

test("an address covered by no block returns null", () => {
  assert.equal(blockClassAt(ONE_BLOCK, 0xc000), null);
});

test("an empty block array returns null for every probed address", () => {
  for (const address of [0x0000, 0x0810, 0x084f, 0xffff]) {
    assert.equal(blockClassAt([], address), null, `an empty listing must not classify $${address.toString(16)}`);
  }
});

// ---------------------------------------------------------------------------
// 2. The vocabulary mapping, including the fallthrough
//
// The mapping accepts TWO vocabularies. This section's spot checks drive the
// EXTERNAL ANALYSER's capitalised one off hand-written constants; section 2b
// below drives this project's own store's lowercase one off a DERIVED total
// loop. The two forms are kept on purpose -- see 2b for why the justification
// that applies to the constants here is deliberately reversed there.
// ---------------------------------------------------------------------------

test("the analyser's code spelling maps to code, its undefined spelling to undefined, and ANY other spelling to data", () => {
  const at = (type: string) => blockClassAt([{ start_address: 0x10, end_address: 0x20, type }], 0x18);

  assert.equal(at(ANALYSER_CODE), "code");
  assert.equal(at(ANALYSER_UNDEFINED), "undefined");
  assert.equal(at(ANALYSER_OTHER), "data", "a recognised non-code, non-undefined spelling is data");
  assert.equal(at("Address"), "data");
  assert.equal(
    at("SomeSpellingThisTreeHasNeverSeen"),
    "data",
    "the fallthrough is total on purpose -- an unrecognised store spelling must never read as code",
  );
  assert.equal(at(""), "data", "an empty type string is still not code");
});

// ---------------------------------------------------------------------------
// 2b. The DERIVED total cross-check over this project's own store vocabulary
// ---------------------------------------------------------------------------

/** One probe against a single-entry listing, at an interior address. */
const classOf = (type: string): BlockClass | null =>
  blockClassAt([{ start_address: 0x10, end_address: 0x20, type }], 0x18);

test("derived TOTAL cross-check: every member of the store's frozen block vocabulary maps to the right neutral class", () => {
  // THE RATIONALE REVERSAL, ON THE RECORD -- do not "reconcile" this with the
  // comment above the analyser constants by deleting one of them.
  //
  // That comment justifies writing the spellings out by hand on the ground
  // that a silent change to the mapping must not be able to silently change
  // the test of it. It is CORRECT for the analyser's four spellings: the
  // analyser is external, its vocabulary has no importable home in this tree,
  // and a hand-written copy is the only copy there can be.
  //
  // It is deliberately REVERSED here, for the store's twelve. This project's
  // own vocabulary has exactly ONE home (`DATA_TYPES` in `anno-types.ts`),
  // and the failure this test exists against is precisely a DIVERGENCE
  // between that home and this mapping -- a correct new store silently
  // reclassifying every block as `data` while every spot check stays green.
  // A hand-written copy here would be a second home, free to drift from the
  // first without either side noticing, which is the failure rather than the
  // guard against it.
  //
  // Both forms are kept on purpose. Neither replaces the other.
  const mapped = new Map<string, BlockClass | null>();

  for (const member of DATA_TYPES) {
    // The expectation is computed FROM THE MEMBER STRING, never from a second
    // table beside the vocabulary: the code spelling is the code class, the
    // undefined spelling is the undefined class, everything else is data.
    const expected: BlockClass = member === "code" ? "code" : member === "undefined" ? "undefined" : "data";
    const actual = classOf(member);
    mapped.set(member, actual);
    assert.equal(
      actual,
      expected,
      `the store's ${JSON.stringify(member)} block type resolved to ${JSON.stringify(actual)} rather than ` +
        `${JSON.stringify(expected)} -- block-class.ts and anno-types.ts's DATA_TYPES have diverged, which ` +
        "reclassifies live blocks and moves a published census figure with no error anywhere",
    );
  }

  // NON-VACUITY. Without these, a vocabulary that collapsed to a single
  // member -- or one whose code spelling was re-spelt, so that NO member
  // equals "code" and the loop's own expectation quietly becomes "data" for
  // all of them -- would satisfy the loop above trivially.
  assert.equal(
    DATA_TYPES.length,
    12,
    `the iterated vocabulary has ${DATA_TYPES.length} members, not the twelve this cross-check is total over`,
  );
  const membersFor = (cls: BlockClass) => [...mapped.entries()].filter(([, v]) => v === cls).map(([k]) => k);
  assert.deepEqual(
    membersFor("code"),
    ["code"],
    "exactly one member of the store's vocabulary must map to the code class -- zero means the code spelling " +
      "drifted, more than one means the mapping widened",
  );
  assert.deepEqual(
    membersFor("undefined"),
    ["undefined"],
    "exactly one member of the store's vocabulary must map to the undefined class",
  );
  assert.equal(
    membersFor("data").length,
    10,
    "the other ten members must all fall through to data -- the fallthrough is what keeps an unrecognised " +
      "spelling from reading as code",
  );
});

test("the analyser arm survives the store arm being added -- its four spellings still map as before", () => {
  // Pinned explicitly so removing the transitional arm later (`CUT-01`) is a
  // deliberate edit that reddens here, never a silent consequence of some
  // other change. Every committed coverage fixture is spelled in this
  // vocabulary.
  assert.equal(classOf(ANALYSER_CODE), "code");
  assert.equal(classOf(ANALYSER_UNDEFINED), "undefined");
  assert.equal(classOf(ANALYSER_OTHER), "data");
  assert.equal(classOf("Address"), "data");
});

test("the two arms are two vocabularies, NOT one vocabulary compared case-insensitively", () => {
  for (const neither of ["CODE", "cOdE", "UNDEFINED", "Code ", " code", "code\t", "Byte ", "BYTE"]) {
    assert.equal(
      classOf(neither),
      "data",
      `${JSON.stringify(neither)} belongs to neither accepted vocabulary and must read as data -- a ` +
        "case-insensitive or whitespace-trimming comparison would silently accept a third spelling nobody chose, " +
        "and no producer in this tree emits one",
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Defensive shape -- the listing arrives from a file this process did not
//    author, so a hole in the array is data, not a crash
// ---------------------------------------------------------------------------

test("a null/undefined hole inside the block array is skipped rather than thrown on", () => {
  const holed = [
    null,
    undefined,
    { start_address: 0x0810, end_address: 0x084f, type: ANALYSER_CODE },
  ] as unknown as readonly BlockEntry[];

  assert.equal(blockClassAt(holed, 0x0820), "code", "the hole must be skipped and the real entry still found");
  assert.equal(blockClassAt(holed, 0x0900), null, "a hole must not be mistaken for coverage either");
});

test("a non-array blocks argument returns null rather than throwing (IN-04)", () => {
  // The doc comment's own premise -- "the listing arrives from a project file
  // this process did not author" -- applies to the container as much as to its
  // holes. Both production callers pre-guard with `Array.isArray(...) ? ... : []`,
  // so this pins the symmetry rather than a reachable path: the defence belongs
  // in the module that states the premise.
  for (const notAnArray of [null, undefined, 42, "blocks", { start_address: 0x0810 }]) {
    assert.equal(
      blockClassAt(notAnArray as unknown as readonly BlockEntry[], 0x0820),
      null,
      `a ${typeof notAnArray} blocks argument must read as "covers nothing", not throw`,
    );
  }
});

test("first-match-wins on overlapping blocks -- the earliest array entry decides", () => {
  const overlapping: readonly BlockEntry[] = [
    { start_address: 0x0810, end_address: 0x084f, type: ANALYSER_CODE },
    { start_address: 0x0800, end_address: 0x08ff, type: ANALYSER_OTHER },
  ];

  assert.equal(
    blockClassAt(overlapping, 0x0820),
    "code",
    "the linear scan must return the FIRST covering entry, matching the scan this function replaced",
  );
});

// ---------------------------------------------------------------------------
// 4. Import purity -- see this file's header for why this is a test and not
//    a comment
// ---------------------------------------------------------------------------

test("block-class.ts imports nothing census-side, disassembler-side, transport-side or path-translation-side", () => {
  const raw = readFileSync(join(HERE, "block-class.ts"), "utf8");
  // Comments must be stripped before scanning: this module's own header
  // legitimately names the module families it must not import, so an
  // unfiltered scan would be a self-invalidating gate. `codeOnly()` from
  // `shipped-modules.ts` is the tree's shared stripper for exactly this job,
  // and `keepLiteralBodies: true` is the right mode because an import
  // specifier IS a string literal.
  //
  // This replaces a hand-rolled comment-line filter plus a
  // `/\bfrom\s+"/` line scan that saw ONLY single-line, double-quoted,
  // `from`-bearing imports (WR-03). All three of the shapes below were
  // invisible to it, and both the family loop AND the emptiness assertion
  // passed regardless -- a guard whose scanned set can shrink to nothing
  // while staying green, which is trap 1's "quietly" made literal:
  //
  //   import "./anno-coverage.ts";                    // no `from` at all
  //   import { x } from './anno-coverage.ts';         // single-quoted
  //   const m = await import("./anno-coverage.ts");   // dynamic
  const source = codeOnly(raw, true);

  const specifiers = [
    ...source.matchAll(
      /\bfrom\s+["']([^"']+)["']|\bimport\s*\(\s*["']([^"']+)["']|^\s*import\s+["']([^"']+)["']/gm,
    ),
  ]
    .map((match) => match[1] ?? match[2] ?? match[3])
    .filter((specifier): specifier is string => specifier !== undefined);

  // The family check runs FIRST and the emptiness check LAST, deliberately:
  // `assert.deepEqual` is a type-narrowing assertion, so an empty-array
  // expectation narrows `specifiers` to `never[]` and every later read of it
  // becomes a typecheck error. Ordering, not a cast, is the fix.
  for (const family of ["./r2000-", "./disasm-", "./stock-", "./vice", "./hostpath", "./containerpath"]) {
    assert.equal(
      specifiers.some((specifier) => specifier.startsWith(family)),
      false,
      `block-class.ts imports from the ${family} family -- see trap 1 in its header`,
    );
  }

  // The specifier scan catches a dynamic import with a LITERAL specifier, but
  // `import(someVariable)` has no specifier to collect. Prohibit the shape
  // itself, on strict-mode output so a comment discussing it cannot redden
  // this.
  assert.equal(
    /\bimport\s*\(/.test(codeOnly(raw)),
    false,
    "block-class.ts must not use a dynamic import either -- it is an import the specifier scan above cannot see",
  );

  assert.deepEqual(
    specifiers,
    [],
    "block-class.ts must import NOTHING -- giving the classifier the census, the bytes, a decoder or a grade " +
      "collapses the bytes-versus-store independence axis while the independence test keeps passing",
  );
});

test("block-class.ts declares no module-level mutable binding, including a const mutable container", () => {
  // Trap 3 forbids module-level MUTABLE STATE, not the `let`/`var` keywords.
  // A `let`-only grep let the likeliest real offender straight through
  // (WR-04): `const seen = new Map<number, BlockClass>();` is a memoising
  // cache, is module-level mutable state, is exactly the shape someone would
  // reach for to speed up a linear scan, and is `const`. Scanned on
  // strict-mode `codeOnly()` output so the header's own prose about the trap
  // cannot redden the gate.
  const source = codeOnly(readFileSync(join(HERE, "block-class.ts"), "utf8"));
  const offenders = source
    .split("\n")
    .filter(
      (line) =>
        /^\s*(let|var)\s/.test(line) ||
        /^\s*const\s+\w+\s*(:[^=]*)?=\s*(new\s+(Map|Set|WeakMap|WeakSet)\b|\[|\{)/.test(line),
    );
  assert.deepEqual(offenders, [], "the lookup is a pure function of its two arguments; there is nothing to hold");
});

// ---------------------------------------------------------------------------
// 5. Shipped, not test-only -- the inverse of this suite's absence assertions
// ---------------------------------------------------------------------------

test("block-class.ts IS present in package.json's files[] array", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("block-class.ts"),
    true,
    "block-class.ts must ship: the tarball validator walks the relative-import closure from the published " +
      "entry point, and this module is reachable through r2000-cli.ts and anno-coverage.ts. A reachable " +
      "module missing from files[] fails the pack with ERR_MODULE_NOT_FOUND at a consumer's runtime.",
  );
});
