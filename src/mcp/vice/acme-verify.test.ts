// acme-verify.test.ts
//
// WHY THIS FILE EXISTS: `acme-verify.ts` exists to refuse a specific recorded
// false pass -- an exit-zero assembler run whose aggregate summary line read as
// a full pass while the one assembler the project cares about never ran. A
// module that refuses that shape is worthless unless the refusal is observed on
// every suite run, because a verdict layer that silently degrades back into
// "ACME exited 0, so it passed" produces a green run too. This file is where
// the three outcomes are observed rather than asserted about, and where the
// whole phase architecture -- store, exporter, real ACME, byte-diff -- is
// walked end to end exactly once.
//
// THE THIRD OUTCOME IS PROVED HERE, IN PROCESS, THROUGH THE `acmeBin` SEAM.
// `verifyAcmeAssembles()` takes an optional `acmeBin` whose only purpose is to
// make `"skipped"` reachable without a child `node --test`. Pointed at a path
// that was never created, `spawnSync` reports `ENOENT` and the verdict must be
// `"skipped"` -- never `"ok"` (the truthiness hole: `!r.status` is `true` for a
// spawn that never ran) and never silently folded into `"failed"`.
//
// TWO DIRECTIONS, NOT ONE. A control that only ever refuses is indistinguishable
// from one that refuses everything. So the same call is repeated against
// `/bin/true` -- a binary that spawns cleanly, prints nothing and writes nothing
// -- and must come back `"failed"`, not `"skipped"`. That single assertion
// carries two proofs at once: `"skipped"` is reachable only from a spawn that
// did NOT run, and the unanimity rule ran without being asked to (one expected
// segment against zero parsed result lines is rule 8 firing ahead of rule 9's
// absent output file, under the reason precedence `verifyAcmeAssembles()`
// documents).
//
// NEVER TREAT AN ACME STDERR WARNING AS A FAILURE. ACME 0.97 documents warnings
// for buggy-but-legal constructs (`jmp ($xxff)`, unstable ANE/LXA) and emits one
// under `-Wtype-mismatch` for a raw-number operand -- the TRACER below trips
// that very warning on its own `sta $d020` and must still come back `"ok"`,
// because every one of those cases assembles to exactly the right bytes. The
// verdict's basis is the byte-diff; `diagnostics` is recorded for a human and
// only `Error`/`Serious error` are fatal.
//
// WHAT THIS FILE DOES NOT PROVE: the `ACME_BIN` *environment variable* boundary.
// `ACME_BIN` and `ACME_AVAILABLE` are module-load `const`s in `acme-gate.ts`, so
// only a child process can move them; that observation belongs to the
// mandatory-red harness in a later plan of this phase, not here. The `acmeBin`
// option is an in-process seam, deliberately NOT a second way to reach a real
// assembler.
//
// COST, STATED RATHER THAN SMUGGLED: two child processes per suite run -- one
// `/bin/true`, and one REAL ACME assemble in the tracer -- plus one spawn that
// fails before exec, together well under a second. On top of that sits
// `acme-gate.ts`'s own module-load availability probe, which is paid once per
// node process and shared with every other ACME-gated file, not billed again
// here.
//
// This file is deliberately never added to `MANUAL_ONLY_TESTS`: `test-gate.mjs`'s
// `automatedTestFiles()` auto-discovers every on-disk `*.test.*`, and
// `test-gate.test.ts`'s drift guard fails the build if a file escapes both sets.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { acmeSkipReasonFor, assertAcmeRequiredIfEnvSet } from "./acme-gate.ts";
import { ACME_VERIFY_ARGV_FLAGS, verifyAcmeAssembles, type AcmeOutcome } from "./acme-verify.ts";
import { exportAsm } from "./anno-export-asm.ts";
import { openStore, closeStore, setDataType, setLabel } from "./anno-store.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const VERIFY_MODULE_PATH = join(HERE, "acme-verify.ts");
const SKILL_DRIVER_PATH = join(HERE, "..", "..", "skills", "acme-build", "scripts", "acme.mjs");

/** Computed exactly ONCE, by the shared `acme-gate.ts` seam. Every
 * ACME-dependent test in this file passes this through node:test's own
 * `{ skip }` option -- never a hand-rolled early return on this value, which
 * reports a false PASS rather than a SKIP. */
const SKIP_REASON: string | false = acmeSkipReasonFor("acme-verify.test.ts");

test("ACME availability gate (never skipped)", () => {
  assertAcmeRequiredIfEnvSet(assert);
});

// ---------------------------------------------------------------------------
// A trivial one-segment subject, shared by the two seam tests below. Neither
// needs a real assembler: one never execs, the other execs a binary that emits
// nothing.
// ---------------------------------------------------------------------------

/** `lda #$00` / `rts` at $0801 -- three bytes, one segment, $0801..$0804. */
const TRIVIAL_SOURCE = ["!cpu 6510", "* = $0801", "\tlda #$00", "\trts", ""].join("\n");
const TRIVIAL_BYTES = new Uint8Array([0xa9, 0x00, 0x60]);
const TRIVIAL_SEGMENTS = [{ start: 0x0801, endExclusive: 0x0804 }] as const;

test("a spawn that never ran is `skipped`, never `ok` -- the ENOENT direction", () => {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-skip-"));
  try {
    // Inside a directory that DOES exist, at a path that was never created:
    // `spawnSync` reports ENOENT with `status === null`, which is exactly the
    // `!r.status` truthiness hole the three-outcome verdict exists to close.
    const missingBinary = join(dir, "definitely-not-acme");
    assert.equal(existsSync(missingBinary), false, "the probe binary must not exist for this test to mean anything");

    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: missingBinary,
    });

    assert.equal(
      verdict.outcome,
      "skipped",
      `a spawn that never ran must be "skipped"; got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "ok",
      "a spawn that never ran must NEVER read as a pass -- that is the exact false-pass shape this module exists against"
    );
    assert.equal(verdict.byteDiff, null, "nothing was assembled, so nothing can be reported as compared");
    assert.ok(
      verdict.reason.includes(missingBinary),
      `the reason must name the binary that was attempted so a human can see WHICH assembler was missing; got ${JSON.stringify(verdict.reason)}`
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test(
  "a spawn that DID run but emitted nothing is `failed`, not `skipped` -- the paired direction",
  { skip: existsSync("/bin/true") ? false : "no /bin/true on this host" },
  () => {
    const verdict = verifyAcmeAssembles({
      source: TRIVIAL_SOURCE,
      expectedBytes: TRIVIAL_BYTES,
      expectedSegments: TRIVIAL_SEGMENTS,
      acmeBin: "/bin/true",
    });

    assert.equal(
      verdict.outcome,
      "failed",
      `/bin/true spawns cleanly, prints nothing and writes nothing -- that is a FAILED verification, not a skipped one; ` +
        `got ${JSON.stringify(verdict.outcome)} with reason ${JSON.stringify(verdict.reason)}`
    );
    assert.notEqual(
      verdict.outcome,
      "skipped",
      "`skipped` must be reachable ONLY from a spawn that did not run; a clean exec that produced nothing is a real failure"
    );
    // Rule 8 (unanimity against the exporter's blocks) fires ahead of rule 9
    // (absent output file) under the documented reason precedence. Asserting
    // THIS reason rather than the absent-file one is what proves the unanimity
    // rule is unconditional: `expectedSegments` is a REQUIRED option and no
    // code path can skip it, so a verdict can never return `ok` with that rule
    // unrun (D30-06).
    assert.match(
      verdict.reason,
      /per-segment result line/i,
      `the reason must name the segment-count disagreement (1 expected block against 0 parsed result lines), which doubles as ` +
        `the proof that the unanimity rule ran unconditionally; got ${JSON.stringify(verdict.reason)}`
    );
    assert.match(
      verdict.reason,
      /\b1\b[\s\S]*\b0\b/,
      `the reason must state BOTH counts -- one expected block, zero parsed lines; got ${JSON.stringify(verdict.reason)}`
    );
    assert.equal(verdict.byteDiff, null, "no output file was read, so nothing can be reported as compared");
  }
);

// ---------------------------------------------------------------------------
// The arity of `AcmeOutcome` is proved by the COMPILER, not by a text grep.
// This switch is exhaustive with no `default` branch: adding a fourth member to
// the union leaves `outcome` un-narrowed at the assignment below, and
// `npm run typecheck` stops passing. A grep for the union's declaration would
// pass on a fourth member appended anywhere else.
// ---------------------------------------------------------------------------

function describeOutcome(outcome: AcmeOutcome): string {
  switch (outcome) {
    case "ok":
      return "the output file this run created is byte-identical to the expected bytes";
    case "failed":
      return "ACME ran and the result disagreed with the expected bytes or segments";
    case "skipped":
      return "ACME never ran, so no verdict about the bytes exists";
  }
  const exhaustive: never = outcome;
  return exhaustive;
}

test("AcmeOutcome has exactly three members (proved by the exhaustive switch above typechecking)", () => {
  assert.equal(describeOutcome("ok").length > 0, true);
  assert.equal(describeOutcome("failed").length > 0, true);
  assert.equal(describeOutcome("skipped").length > 0, true);
  assert.notEqual(
    describeOutcome("skipped"),
    describeOutcome("ok"),
    "`skipped` and `ok` must not describe the same thing -- a skipped assembler is not a pass on any surface"
  );
  assert.equal(SKIP_REASON === false || typeof SKIP_REASON === "string", true);
});

// ---------------------------------------------------------------------------
// Store fixtures. Every one builds a REAL store with the store's own public
// write verbs -- never raw SQL -- in a fresh temp directory removed in a
// `finally`, because this host's `/tmp` is RAM-backed and a leaked directory is
// leaked memory.
// ---------------------------------------------------------------------------

interface StoreFixture {
  dir: string;
  storePath: string;
  imagePath: string;
}

/** Writes a `.prg` (2-byte little-endian load address then `body`) and a store
 * carrying `ranges` and `labels`, then runs `fn` against them. */
function withStore(
  origin: number,
  body: readonly number[],
  ranges: readonly { start: number; endInclusive: number; dataType: string }[],
  labels: readonly { address: number; name: string }[],
  fn: (fixture: StoreFixture) => void
): void {
  const dir = mkdtempSync(join(tmpdir(), "acme-verify-store-"));
  try {
    const imagePath = join(dir, "game.prg");
    writeFileSync(imagePath, Buffer.from([origin & 0xff, (origin >> 8) & 0xff, ...body]));

    const storePath = join(dir, "anno.sqlite");
    const handle = openStore(storePath, { workspaceRoot: dir });
    try {
      for (const range of ranges) setDataType(handle, range);
      for (const label of labels) setLabel(handle, { ...label, kind: "User" });
    } finally {
      closeStore(handle);
    }

    fn({ dir, storePath, imagePath });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// THE TRACER. One store, one range, one image, one REAL ACME run, one
// byte-diff, one `ok` -- the whole phase architecture walked once.
//
// It passes NO `acmeBin`, which is itself the proof that the default resolves
// to the imported `ACME_BIN`: Task 1's test-only override did not quietly
// become the only path a real assembler is reached on.
//
// DIVISION OF LABOUR, recorded here so a later reader does not add a third,
// weaker copy: the `"skipped"` outcome is proved directly and in-process above,
// through the `acmeBin` seam with its paired `/bin/true` direction. What is
// still unproven is the ENV-VAR boundary -- `ACME_BIN` is read from the
// environment once at module load, so only a child process can move it -- and
// that observation belongs to the mandatory-red harness in a later plan of this
// phase, by design.
// ---------------------------------------------------------------------------

test("TRACER: store -> export -> real ACME 0.97 -> byte-diff -> ok", { skip: SKIP_REASON }, () => {
  // `lda #$00` / `sta $d020` / `rts` -- six bytes covering $0801..$0806.
  const body = [0xa9, 0x00, 0x8d, 0x20, 0xd0, 0x60];

  withStore(
    0x0801,
    body,
    [{ start: 0x0801, endInclusive: 0x0806, dataType: "code" }],
    [{ address: 0x0801, name: "entry" }],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });

      const verdict = verifyAcmeAssembles({
        source: result.source,
        expectedBytes: result.expectedBytes,
        expectedSegments: result.blocks,
      });

      const context =
        `\n  reason: ${verdict.reason}` +
        `\n  diagnostics: ${verdict.diagnostics.join(" | ") || "(none)"}` +
        `\n  acmeResultLines: ${verdict.acmeResultLines.join(" | ") || "(none)"}` +
        `\n  source:\n${result.source}`;

      assert.equal(verdict.outcome, "ok", `the tracer must round-trip through a real ACME:${context}`);
      assert.equal(verdict.byteDiff?.equal, true, `the byte-diff IS the verdict, and it must be equal:${context}`);
      assert.equal(
        verdict.byteDiff?.firstDifferingOffset,
        null,
        `an equal byte-diff has no first differing offset:${context}`
      );
      assert.ok(
        verdict.acmeResultLines.length >= 1,
        `ACME's own per-segment result lines must have been parsed and recorded:${context}`
      );
      assert.notEqual(
        verdict.exitStatus,
        undefined,
        "exitStatus is RECORDED so a human can read what happened, and CONSULTED BY NOTHING -- this assertion " +
          "checks only that it was populated, never that it was zero, because a zero exit is compatible with a wrong byte"
      );
    }
  );
});

// ---------------------------------------------------------------------------
// The exporter's own refusals and emission rules. These need no assembler: they
// are properties of the text and of `expectedBytes`, and the tracer above is
// what proves that text actually assembles.
// ---------------------------------------------------------------------------

test("a store with ZERO ranges is refused by name, never exported as an empty source", () => {
  withStore(0x0801, [0xa9, 0x00, 0x60], [], [], ({ dir, storePath, imagePath }) => {
    assert.throws(
      () => exportAsm({ storePath, imagePath, workspaceRoot: dir }),
      (err: unknown) => {
        assert.ok(err instanceof Error, "the refusal must be an Error");
        assert.ok(err.message.startsWith("exportAsm:"), `the message must name the function; got ${JSON.stringify(err.message)}`);
        assert.ok(err.message.includes(storePath), `the message must name the store path; got ${JSON.stringify(err.message)}`);
        return true;
      },
      '"nothing is annotated" and "the export produced nothing" must not read the same'
    );
  });
});

test("a store label below $0100 is defined with TWO hex digits, and one at or above with four", () => {
  withStore(
    0x0801,
    [0xa9, 0x00, 0x60],
    [{ start: 0x0801, endInclusive: 0x0803, dataType: "code" }],
    [
      { address: 0x10, name: "zpf_10" },
      { address: 0x0801, name: "entry" },
    ],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      const lines = result.source.split("\n");

      assert.equal(lines[0], "!cpu 6510", "the header opens with the CPU directive");
      // Measured on ACME 0.97: `zpf = $10` gives `lda zpf` -> `a5 10` (2 bytes),
      // `zpf = $0010` gives `ad 10 00` (3 bytes). The DEFINITION's digit count
      // decides the OPERAND's width, so this is a byte-level property wearing
      // the clothes of a formatting detail.
      assert.ok(
        lines.includes("zpf_10 = $10"),
        `a zero-page definition must carry two hex digits; got:\n${result.source}`
      );
      assert.ok(
        lines.includes("entry = $0801"),
        `a definition at or above $0100 must carry four hex digits; got:\n${result.source}`
      );

      const firstOrigin = lines.findIndex((l) => l.startsWith("* ="));
      const lastDefinition = Math.max(lines.indexOf("zpf_10 = $10"), lines.indexOf("entry = $0801"));
      assert.ok(
        lastDefinition < firstOrigin,
        "EVERY definition sits before the first `* =`. A symbol defined after its first reference widens the " +
          "referencing instruction from zeropage to absolute -- three bytes where the original was two -- with only " +
          "a Warning and exit status 0, and everything after it shifts"
      );
      assert.equal(result.symbolCount, 2);
    }
  );
});

test("two blocks with a gap: expectedBytes spans both and $00-fills between them", () => {
  const body = [0xa9, 0x00, 0x60, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xee, 0xea];
  withStore(
    0x0801,
    body,
    [
      { start: 0x0801, endInclusive: 0x0803, dataType: "code" },
      { start: 0x0810, endInclusive: 0x0810, dataType: "code" },
    ],
    [],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      // ACME `-f plain` emits ONE contiguous span across every segment,
      // zero-filling the gaps (measured). `expectedBytes` is built to match, so
      // padding is never a false disagreement while a wrong byte inside a
      // covered range still fails.
      assert.deepEqual(
        [...result.expectedBytes],
        [0xa9, 0x00, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xea],
        "the gap between two blocks is $00-filled, and the image's own filler bytes are NOT carried into it"
      );
      assert.equal(result.blocks.length, 2);
      assert.deepEqual(
        result.blocks.map((b) => [b.start, b.endExclusive]),
        [
          [0x0801, 0x0804],
          [0x0810, 0x0811],
        ],
        "the store's INCLUSIVE end converts to an exclusive one exactly once, here"
      );
    }
  );
});

test("an opcode ACME cannot express goes out as `!byte` with all its bytes, and is counted", () => {
  // $12 is a `jam` whose bare mnemonic ACME assembles to $02 instead -- exactly
  // the over-substitution case `disasm-opcodes.ts`'s `acmeExpressible` column
  // exists to record.
  withStore(
    0x0801,
    [0x12, 0x60],
    [{ start: 0x0801, endInclusive: 0x0802, dataType: "code" }],
    [],
    ({ dir, storePath, imagePath }) => {
      const result = exportAsm({ storePath, imagePath, workspaceRoot: dir });
      assert.equal(result.unexpressibleCount, 1, `got:\n${result.source}`);
      assert.match(
        result.source,
        /!byte \$12\s+; jam/,
        `an unexpressible opcode emits every byte as !byte with its mnemonic in a comment; got:\n${result.source}`
      );
      assert.deepEqual([...result.expectedBytes], [0x12, 0x60]);
    }
  );
});

// ---------------------------------------------------------------------------
// THE ARGV-AGREEMENT INVARIANT.
//
// `ACME_VERIFY_ARGV_FLAGS` and `src/skills/acme-build/scripts/acme.mjs`'s `args`
// array are a DELIBERATE second implementation of the same ACME invocation:
// `src/mcp/vice/**` and `src/skills/**` publish as separate npm packages and
// cannot import each other, so a shared module is not reachable without
// inventing a third package for one flag array. The accepted cost is that the
// two lists can drift apart silently. This test is the only thing holding them
// together, so it reads BOTH off disk rather than trusting either side's
// in-memory value alone.
// ---------------------------------------------------------------------------

/** A quote-aware comment stripper, the same shape `anno-cli-path-consumers.test.ts`
 * carries. A naive `//`-to-end-of-line strip would delete the inside of any
 * string containing `//`, and a naive block strip would eat a `/*` inside a
 * string -- either way the extraction below would go quietly short and this
 * test would pass by missing the very literal a drift lives in. */
function stripComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** The text of the first `[...]` array literal following the LAST of `markers`,
 * each of which is located in sequence, matched by bracket DEPTH rather than by
 * a regex, and quote-aware so a `]` inside a string cannot close it early.
 *
 * The markers are a sequence rather than one string because a TypeScript
 * declaration can carry an EMPTY bracket pair before the literal --
 * `readonly string[] = Object.freeze([...])` -- and a scan that anchored on the
 * first `[` after the name would return `[]` and then assert vacuously against
 * an empty member list. Each marker is asserted present, so a rename cannot
 * silently degrade this into a no-op. */
function arrayLiteralAfter(strippedSrc: string, ...markers: readonly string[]): string {
  let at = 0;
  for (const marker of markers) {
    const found = strippedSrc.indexOf(marker, at);
    assert.notEqual(found, -1, `the marker ${JSON.stringify(marker)} is gone from the source this test reads`);
    at = found + marker.length;
  }
  const open = strippedSrc.indexOf("[", at);
  assert.notEqual(open, -1, `no array literal follows ${JSON.stringify(markers.join(" -> "))}`);

  let depth = 0;
  let quote: string | null = null;
  for (let i = open; i < strippedSrc.length; i++) {
    const c = strippedSrc[i]!;
    if (quote) {
      if (c === "\\") {
        i++;
        continue;
      }
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      continue;
    }
    if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return strippedSrc.slice(open, i + 1);
    }
  }
  assert.fail(`the array literal after ${JSON.stringify(markers.join(" -> "))} is unterminated`);
}

/** Every double-quoted string literal in `arrayText`, in order. */
function doubleQuotedMembers(arrayText: string): string[] {
  return [...arrayText.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1]!);
}

/** The members that are FLAGS -- tokens beginning with `-`. Values (`6510`,
 * `plain`, `cbm`) and interpolated paths are not part of the comparison
 * subject; the flag SET is. */
function flagsOf(members: readonly string[]): string[] {
  return members.filter((m) => m.startsWith("-"));
}

/**
 * The three divergences between the two constructions, each declared with its
 * own justification rather than absorbed into a widened comparison. A fourth
 * divergence goes RED instead of landing silently.
 */
const DECLARED_DIVERGENCES = Object.freeze([
  Object.freeze({
    name: "the binary token",
    skillOnly: Object.freeze([] as readonly string[]),
    verifyOnly: Object.freeze([] as readonly string[]),
    justification:
      "the build driver spawns the LITERAL string \"acme\"; the verify module spawns the imported ACME_BIN, because " +
      "the mandatory-red harness requires the binary to be overridable and acme-gate.ts is the one home of that env-var " +
      "name. This is not a flag, so it is asserted DIRECTLY on both sources below rather than subtracted from a flag set.",
  }),
  Object.freeze({
    name: "verbosity",
    skillOnly: Object.freeze(["-v1"] as readonly string[]),
    verifyOnly: Object.freeze(["-v2"] as readonly string[]),
    justification:
      "-v1 emits only the aggregate `Saving ...` line; -v2 adds ACME's own PER-SEGMENT result lines, which are the " +
      "unanimity subject. A build driver wants the aggregate; a verdict refuses to trust it.",
  }),
  Object.freeze({
    name: "the build driver's side outputs",
    skillOnly: Object.freeze(["-l", "--vicelabels", "-r"] as readonly string[]),
    verifyOnly: Object.freeze([] as readonly string[]),
    justification:
      "-l (symbol file), --vicelabels (debugger labels) and -r (report) exist so a BUILD can be inspected afterwards. " +
      "A verify path consumes none of them, and emitting files nothing reads would only widen the temp directory.",
  }),
]);

test("ACME_VERIFY_ARGV_FLAGS is really the list this test reads off disk (so the extraction cannot pass vacuously)", () => {
  const verifyArray = arrayLiteralAfter(
    stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8")),
    "ACME_VERIFY_ARGV_FLAGS",
    "Object.freeze("
  );
  assert.deepEqual(
    doubleQuotedMembers(verifyArray),
    [...ACME_VERIFY_ARGV_FLAGS],
    "the members extracted from acme-verify.ts's source must equal the frozen constant it exports -- otherwise the " +
      "agreement test below is comparing something that is not the flag list actually spawned"
  );
});

test("the two ACME argv constructions agree on every flag except the three declared divergences", () => {
  const verifyFlags = new Set(
    flagsOf(doubleQuotedMembers(arrayLiteralAfter(stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8")), "ACME_VERIFY_ARGV_FLAGS", "Object.freeze(")))
  );
  // `-o` lives in the skill's array literal but is appended at spawn time on
  // the verify side, deliberately excluded from the frozen constant because its
  // VALUE is per-invocation. Both sides do pass it, so it is added back here to
  // make the two sets comparable subjects rather than declared as a divergence
  // that does not exist.
  verifyFlags.add("-o");

  const skillFlags = new Set(
    flagsOf(doubleQuotedMembers(arrayLiteralAfter(stripComments(readFileSync(SKILL_DRIVER_PATH, "utf8")), "const args =")))
  );

  assert.ok(skillFlags.size >= 6, `the skill driver's args array extraction went short: ${[...skillFlags].join(" ")}`);

  for (const divergence of DECLARED_DIVERGENCES) {
    for (const flag of divergence.skillOnly) skillFlags.delete(flag);
    for (const flag of divergence.verifyOnly) verifyFlags.delete(flag);
  }

  const skillSorted = [...skillFlags].sort();
  const verifySorted = [...verifyFlags].sort();
  assert.deepEqual(
    verifySorted,
    skillSorted,
    `the two ACME argv constructions have DRIFTED.\n` +
      `  acme-verify.ts (after declared divergences): ${verifySorted.join(" ")}\n` +
      `  acme-build/scripts/acme.mjs                : ${skillSorted.join(" ")}\n` +
      `These live in SEPARATE npm packages that cannot import each other, so this test is the only thing holding them ` +
      `together. Either add the flag to both, or add a fourth entry to DECLARED_DIVERGENCES with its justification -- ` +
      `widening the exception list must be a visible edit, never a quiet one.`
  );
});

test("the binary-token divergence is real on both sides (the one declared divergence that is not a flag)", () => {
  const skillSrc = stripComments(readFileSync(SKILL_DRIVER_PATH, "utf8"));
  const verifySrc = stripComments(readFileSync(VERIFY_MODULE_PATH, "utf8"));

  assert.match(
    skillSrc,
    /spawnSync\(\s*"acme"\s*,/,
    "the build driver is expected to spawn the LITERAL string \"acme\"; if it now resolves a binary name, the first " +
      "declared divergence has been discharged and should be removed rather than left standing"
  );
  assert.match(
    verifySrc,
    /import\s*\{\s*ACME_BIN\s*\}\s*from\s*"\.\/acme-gate\.ts"/,
    "the verify module must IMPORT ACME_BIN from acme-gate.ts -- a second copy of that env-var name is what acme-gate.ts " +
      "forbids by name, because a rename on one side turns CI's hard FAIL into a silent SKIP with both sides green"
  );
  assert.equal(
    DECLARED_DIVERGENCES.length,
    3,
    "exactly three divergences are declared. Growing this list must be a visible edit with its own justification"
  );
});
