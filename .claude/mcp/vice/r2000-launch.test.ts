#!/usr/bin/env node
// Pins both halves of D-07 (R2000-01) for r2000-launch.ts: --vice is
// unreachable BY CONSTRUCTION (fixed per-verb builders, no caller-supplied
// argv pass-through) AND denied BY SCAN (assertNoViceFlag/runR2000 throw a
// named error if the flag is present). Both are asserted, not either/or,
// and each assertion is written so its failure mode is a *reintroduction*
// of the hazard -- someone later adding a pass-through parameter, or
// removing the scan -- rather than a static fact that can never regress.
//
// Every assertion here runs with no network, no emulator and no
// regenerator2000 binary present, so this file is safe for the automated
// gate and must NEVER be added to test-gate.mjs's MANUAL_ONLY_TESTS.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  R2000_BIN,
  FORBIDDEN_R2000_FLAGS,
  assertNoViceFlag,
  buildExportAsmArgs,
  buildVerifyArgs,
  runR2000,
  R2000ViceFlagError,
} from "./r2000-launch.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// Strips full-line `//` comments AND JSDoc/block comments before matching
// source text -- extends hostpath-consumers.test.ts's grep-gate-hygiene idiom
// (never a bare `includes()` against raw file text that would count comments
// and string literals as real code). The block-comment handling is needed
// here specifically because r2000-launch.ts's own header/JSDoc prose
// discusses "a rest parameter" and "the rest of the function" in plain
// English -- without stripping block comments, those prose sentences would
// false-positive the identifier scan below.
//
// WR-02 fix (10-REVIEW.md): a block comment closes on the FIRST close-comment
// token anywhere in the remaining text of a line, not only when the trimmed
// line ends with one. The previous version only left `inBlock` when the
// trimmed line ended with the close token, so a comment that closed mid-line
// and was followed by real code on the same line (e.g. a multi-line block
// comment whose closing line reads: close-token, then
// `export function buildEvilArgs(...) { ... }`) stayed "in block" for the
// rest of the file, silently dropping every line after it -- including the
// very code this guard exists to scan. The fixed version searches for the
// close token by position (`indexOf`, never `endsWith` as the sole close
// condition), clears `inBlock`, and re-feeds the remainder of the line (the
// text after that close token) back through the same line logic, so a
// trailing `//` comment on that remainder is still stripped and real code on
// it is still retained. The committed proof this can fail is the "planted
// violation" test below.
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return; // still unterminated -- drop the rest of this line
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true; // unterminated on this line -- resumes on later lines
        return;
      }
      // Opens and closes on the same line (`/* ... */ code();`) -- the
      // remainder after the closing `*/` is still real code/comment text.
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return; // whole-line `//` comment -- dropped
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

// -- Guard predicates (extracted, single definition each) -------------------
//
// Each predicate takes the stripped source text and returns a boolean. Both
// the real-source tests below AND the planted-violation test call these same
// functions -- there is exactly one definition of each, so a future edit to
// the check itself is exercised by both call sites at once.

/** (a) No `.filter(` call appears anywhere in the source -- D-07 requires a
 * loud throw (`assertNoViceFlag`) when `--vice` is present, never a silent
 * strip via `Array.prototype.filter`. */
function hasFilterOverDenyList(src: string): boolean {
  return /\.filter\(/.test(src);
}

/** (b) No rest parameter (a `...name: string[]`-shaped parameter, optionally
 * `readonly`) appears anywhere in an exported builder signature -- this is
 * exactly the caller-supplied argv passthrough D-07 forbids: a builder that
 * accepts `...extraArgs: string[]` and forwards them into the spawned argv. */
function hasRestParameterInBuilderSignature(src: string): boolean {
  return /\.\.\.[a-zA-Z]+\s*:\s*(readonly\s+)?string\[\]/.test(src);
}

/** (c) No identifier named after a common argv-passthrough shape --
 * `extraArgs`, `passthrough`, or `rest` -- appears anywhere in the source.
 *
 * Deliberately does NOT also scan for the bare words `argv`, `args`, or
 * `flags`, even though the plan's own wording lists them as illustrative
 * passthrough-suggestive names: `argv` is already a legitimate, pervasive
 * identifier in this exact file (a plain parameter name on
 * `assertNoViceFlag`/`runR2000`/`viceFlagRefusalMessage`, and a genuine field
 * on `R2000ViceFlagErrorOptions` that records an ALREADY-BUILT argv for error
 * reporting, not a caller-supplied passthrough into a builder). Scanning for
 * it here would flag that legitimate usage as a violation on today's file,
 * which is a false positive unrelated to WR-02/D-07's actual hazard. `args`
 * and `flags` do not appear anywhere in this file today, so omitting them
 * does not reduce today's coverage; if a future builder ever adds a genuinely
 * suspicious `args`/`argv`/`flags`-named OPTIONS FIELD (as opposed to a plain
 * argv-scanning parameter), that is caught by code review, not this
 * whole-file identifier scan. */
function hasPassthroughNamedIdentifier(src: string): boolean {
  return /\bextraArgs\b|\bpassthrough\b|\brest\b/.test(src);
}

// -- 1. Deny-by-scan, positive: the plain `--vice` token --------------------

test("assertNoViceFlag throws R2000ViceFlagError naming the single-client hazard for a plain --vice token", () => {
  const argv = ["--headless", "--vice", "localhost:6502", "proj.regen2000proj"];
  assert.throws(
    () => assertNoViceFlag(argv),
    (err: unknown) => {
      assert.ok(err instanceof R2000ViceFlagError);
      assert.equal(err.name, "R2000ViceFlagError");
      assert.match(err.message, /exactly one client/);
      return true;
    }
  );
});

// -- 2. Deny-by-scan, --vice=<value> single-token form -----------------------

test("assertNoViceFlag throws the same named error for the --vice=<value> single-token form", () => {
  const argv = ["--vice=localhost:6502"];
  assert.throws(
    () => assertNoViceFlag(argv),
    (err: unknown) => {
      assert.ok(err instanceof R2000ViceFlagError);
      assert.equal(err.name, "R2000ViceFlagError");
      return true;
    }
  );
});

// -- 3. Never-strip: no filtering function exists, and a clean argv is left --
//       untouched (void/throwing contract, not a filtered-copy contract) --

test("assertNoViceFlag returns undefined and leaves a clean argv unchanged (void/throwing contract, never a filter)", () => {
  const argv = ["--headless", "--export_asm", "out.a", "--assembler", "acme", "proj.regen2000proj"];
  const before = [...argv];
  const result = assertNoViceFlag(argv);
  assert.equal(result, undefined);
  assert.deepEqual(argv, before);
});

test("r2000-launch.ts contains no filter(...) call over the deny list -- the flag is never silently stripped", () => {
  const src = stripCommentLines(readFileSync(join(HERE, "r2000-launch.ts"), "utf8"));
  assert.equal(
    hasFilterOverDenyList(src),
    false,
    "r2000-launch.ts must never filter argv against FORBIDDEN_R2000_FLAGS -- D-07 requires a loud throw, not a silent strip"
  );
});

// -- 4. No false positive on a filename containing the substring "--vice" --

test("assertNoViceFlag does not throw on a filename that merely contains the substring --vice", () => {
  assert.doesNotThrow(() => {
    assertNoViceFlag(["--export_asm", "/tmp/my--vice-notes.a", "proj.regen2000proj"]);
  });
});

// -- 5. runR2000 enforces the scan before any subprocess is spawned ---------

test("runR2000 throws R2000ViceFlagError before spawning, even with a binary name guaranteed not to exist", () => {
  const originalBin = process.env.R2000_BIN;
  process.env.R2000_BIN = "definitely-not-installed-r2000-binary-xyz";
  try {
    assert.throws(
      () => runR2000(["--vice", "localhost:6502"]),
      (err: unknown) => {
        assert.ok(err instanceof R2000ViceFlagError, "must throw the flag error, not an ENOENT spawn error");
        assert.equal(err.name, "R2000ViceFlagError");
        return true;
      }
    );
  } finally {
    if (originalBin === undefined) delete process.env.R2000_BIN;
    else process.env.R2000_BIN = originalBin;
  }
});

test("R2000_BIN itself resolves from the environment at module load (documented override convention)", () => {
  assert.equal(typeof R2000_BIN, "string");
  assert.ok(R2000_BIN.length > 0);
});

// -- 6. Deny-by-construction: no rest parameter / pass-through identifier --
//       exists anywhere in the source (the reintroduction regression) ------

test("D-07 construction half: r2000-launch.ts source contains no rest-parameter or pass-through-named field -- catches a future reintroduction of a caller-supplied argv passthrough", () => {
  const src = stripCommentLines(readFileSync(join(HERE, "r2000-launch.ts"), "utf8"));
  assert.equal(
    hasRestParameterInBuilderSignature(src),
    false,
    "adding a caller-supplied argv passthrough (a rest parameter typed as a string array) is exactly what this test exists to catch"
  );
  assert.equal(
    hasPassthroughNamedIdentifier(src),
    false,
    "adding a caller-supplied argv passthrough (an identifier named extraArgs, passthrough, or rest) is exactly what this test exists to catch"
  );
});

// -- 6b. WR-02 non-vacuity: the guard must be OBSERVED failing under a ------
//        planted violation, not merely trusted by inspection ---------------

test(
  "planted violation: a block comment whose closing line carries trailing code no longer hides a D-07 reintroduction (WR-02, 10-REVIEW.md)",
  () => {
    // The reviewer's exact reproduction shape (10-REVIEW.md WR-02): a
    // multi-line block comment whose CLOSING line is `*/ <real code>`. The
    // pre-fix stripCommentLines() entered `inBlock` on any line whose
    // trimmed text merely failed to END with `*/`, and only cleared it on a
    // line ENDING with `*/` -- so once inside a multi-line block comment, a
    // closing line like this one (which does not end with `*/`, because
    // real code follows it) was never recognised as a close, and every
    // remaining line of the file -- including this reintroduced argv
    // passthrough -- was silently dropped before the guard predicates ever
    // saw it.
    const plantedSource =
      `import { spawnSync } from "node:child_process";\n` +
      `\n` +
      `/**\n` +
      ` * A legitimate multi-line JSDoc block comment, whose closing line then\n` +
      ` * carries real code -- exactly WR-02's reproduction.\n` +
      ` */ export function buildEvilArgs(...extraArgs: string[]): string[] { return extraArgs; }\n`;

    const stripped = stripCommentLines(plantedSource);

    assert.match(
      stripped,
      /buildEvilArgs/,
      "stripCommentLines() must retain code trailing a legitimately-closed */ on the same line"
    );
    assert.match(stripped, /\.\.\.extra/, "the rest-parameter token itself must survive stripping");

    assert.equal(
      hasRestParameterInBuilderSignature(stripped),
      true,
      "predicate (b) must report the planted rest-parameter passthrough once the stripper stops hiding it"
    );
    assert.equal(
      hasPassthroughNamedIdentifier(stripped),
      true,
      "predicate (c) must report the planted extraArgs identifier once the stripper stops hiding it"
    );
  }
);

// -- 6c. stripCommentLines() unit coverage -----------------------------------

test("stripCommentLines: a closing line of the shape `*/ code();` retains the trailing code", () => {
  const src = "/*\n * comment\n */ const kept = 1;\n";
  const stripped = stripCommentLines(src);
  assert.match(stripped, /const kept = 1;/);
});

test("stripCommentLines: a single-line `/* ... */ code();` retains the trailing code", () => {
  const src = '/* inline note */ const kept = 2;\n';
  const stripped = stripCommentLines(src);
  assert.match(stripped, /const kept = 2;/);
});

test("stripCommentLines: a whole-line `//` comment is dropped", () => {
  const src = "// just a comment\nconst kept = 3;\n";
  const stripped = stripCommentLines(src);
  assert.doesNotMatch(stripped, /just a comment/);
  assert.match(stripped, /const kept = 3;/);
});

test("stripCommentLines: a genuinely unterminated /* block drops everything after it (correct for a malformed file)", () => {
  const src = "const before = 1;\n/* never closed\nconst dropped = 2;\nstill dropped\n";
  const stripped = stripCommentLines(src);
  assert.match(stripped, /const before = 1;/);
  assert.doesNotMatch(stripped, /const dropped = 2;/);
  assert.doesNotMatch(stripped, /still dropped/);
});

// -- 7. Builder output shape ------------------------------------------------

test("buildExportAsmArgs and buildVerifyArgs each return a string[] with --assembler acme and no --vice token", () => {
  for (const argv of [
    buildExportAsmArgs({ projectPath: "proj.regen2000proj", outPath: "out.a" }),
    buildVerifyArgs({ projectPath: "proj.regen2000proj" }),
  ]) {
    assert.ok(Array.isArray(argv));
    for (const el of argv) assert.equal(typeof el, "string");
    const assemblerIdx = argv.indexOf("--assembler");
    assert.ok(assemblerIdx >= 0, "argv must contain --assembler");
    assert.equal(argv[assemblerIdx + 1], "acme");
    assert.equal(argv.includes("--vice"), false);
    assert.equal(
      argv.some((el) => el.startsWith("--vice=")),
      false
    );
  }
});

// -- 8. WR-01: FORBIDDEN_R2000_FLAGS is the actual source of truth ---------
//       for the scan, not merely a documented-but-unread constant ----------

test("FORBIDDEN_R2000_FLAGS includes --vice, and assertNoViceFlag throws for every member of the array", () => {
  assert.ok(FORBIDDEN_R2000_FLAGS.includes("--vice"));
  for (const flag of FORBIDDEN_R2000_FLAGS) {
    assert.throws(
      () => assertNoViceFlag([flag]),
      (err: unknown) => err instanceof R2000ViceFlagError,
      `assertNoViceFlag did not throw for declared forbidden flag "${flag}" -- the array is not fully enforced`
    );
  }
});

test(
  "WR-01 non-vacuity: a sentinel flag pushed onto FORBIDDEN_R2000_FLAGS at runtime is rejected by assertNoViceFlag, proving the scan reads the array rather than a hardcoded --vice literal",
  () => {
    const sentinel = "--totally-not-vice-but-still-forbidden";
    const mutable = FORBIDDEN_R2000_FLAGS as string[];
    assert.equal(mutable.includes(sentinel), false, "test sentinel must not already be in the deny list");
    mutable.push(sentinel);
    try {
      assert.throws(
        () => assertNoViceFlag([sentinel]),
        (err: unknown) => {
          assert.ok(err instanceof R2000ViceFlagError, "must throw R2000ViceFlagError for the sentinel flag");
          return true;
        },
        "assertNoViceFlag must reject a newly-added FORBIDDEN_R2000_FLAGS entry -- if this fails, the scan " +
          "is still hardcoded to --vice and the array is dead code (WR-01)"
      );
      // The single-token `flag=<value>` form must be covered too.
      assert.throws(() => assertNoViceFlag([`${sentinel}=localhost:1234`]));
      // A clean argv containing neither the sentinel nor --vice must still
      // pass, so the sentinel addition does not turn the scan into a
      // false-positive machine.
      assert.doesNotThrow(() => assertNoViceFlag(["--headless", "--export_asm", "out.a"]));
    } finally {
      const idx = mutable.indexOf(sentinel);
      if (idx >= 0) mutable.splice(idx, 1);
    }
    assert.equal(
      mutable.includes(sentinel),
      false,
      "sentinel must be removed from FORBIDDEN_R2000_FLAGS after the test, leaving the real deny list untouched"
    );
  }
);
