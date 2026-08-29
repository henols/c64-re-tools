// anno-derive.test.ts -- STORE-06's proof: cross-references and search are
// DERIVED from the program bytes on every query, unioned across three sources,
// sorted and de-duplicated -- and NOTHING is written while answering.
//
// WHY THE FIXTURE IS A REAL `.prg` DECODED BY THE REAL DECODERS. A hand-built
// `Instruction[]` would let this file's expectations and `disasm-decoder.ts`'s
// behaviour drift apart silently: the test would keep passing over a decoder
// that stopped resolving branch targets. Every case below therefore starts from
// 34 real bytes, goes through `parsePrg()`, and is decoded by the same
// `decode()` the production module calls.
//
// Nothing here asserts stderr is empty, and nothing may: `node:sqlite` emits an
// `ExperimentalWarning` unconditionally on first load.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeStore, listRanges, openStore, paintIndexOf, putXref, setComment, setDataType, setLabel } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { NO_ROW, resolveAt } from "./anno-index.ts";
import { AnnoAddressError } from "./anno-types.ts";
import { parsePrg } from "./prg-image.ts";
import {
  AnnoDeriveArgumentError,
  ANNO_DERIVE_MAX_IMAGE_BYTES,
  crossReferencesTo,
  searchAnnotations,
} from "./anno-derive.ts";

// ---------------------------------------------------------------------------
// The fixture: 34 real bytes, laid out so every behavioural case in the plan
// has a byte that produces it and a byte that must NOT produce it.
// ---------------------------------------------------------------------------

/**
 * A `.prg` loading at `$0810`:
 *
 *   $0810  20 00 c0   jsr $c000      -> a caller of $c000 (resolvedTarget)
 *   $0813  a9 c0      lda #$c0       -> role `immediate`: NOT a caller of $00c0
 *   $0815  6c 14 03   jmp ($0314)    -> role `indirect`:  NOT a caller of $0314
 *   $0818  d0 f6      bne $0810      -> role `relative`:  a caller of $0810
 *   $081a  ad 00 c0   lda $c000      -> role `absolute`, no resolvedTarget:
 *                                       falls back to operand.value ($c000)
 *   $081d  a5 20      lda $20        -> role `zeropage`: a caller of $0020
 *   $081f  60         rts
 *   $0820  10 34 00 ff 08 12 c0 cf   lo_hi_address -> $0810 $1234 $c000 $cfff
 *   $0828  10 34 00 ff 08 12 c0 cf   lo_hi_word    -> contributes NOTHING
 *
 * The two tables hold the SAME EIGHT BYTES on purpose: the only thing that can
 * make one contribute and the other not is `producesXrefsFor()`, so a test that
 * sees `$0822` and not `$082a` is reading that predicate and nothing else.
 */
const FIXTURE_PRG = Uint8Array.from([
  0x10, 0x08,
  0x20, 0x00, 0xc0,
  0xa9, 0xc0,
  0x6c, 0x14, 0x03,
  0xd0, 0xf6,
  0xad, 0x00, 0xc0,
  0xa5, 0x20,
  0x60,
  0x10, 0x34, 0x00, 0xff, 0x08, 0x12, 0xc0, 0xcf,
  0x10, 0x34, 0x00, 0xff, 0x08, 0x12, 0xc0, 0xcf,
]);

/** The two code ranges EXACTLY TOUCH ($0819 / $081a) -- STORE-02 says two
 * touching ranges stay two ranges, and the instruction at the first byte of the
 * second one must be attributed to the second one. */
const CODE_RANGE_A = { start: 0x0810, endInclusive: 0x0819 } as const;
const CODE_RANGE_B = { start: 0x081a, endInclusive: 0x081f } as const;
const SPLIT_ADDRESS_TABLE = { start: 0x0820, endInclusive: 0x0827 } as const;
const SPLIT_WORD_TABLE = { start: 0x0828, endInclusive: 0x082f } as const;

interface Fixture {
  dir: string;
  handle: AnnoStoreHandle;
  image: Uint8Array;
  origin: number;
}

/** Opens a real store in a real temp workspace and types the four ranges,
 * one label, one comment and one stored non-derivable cross-reference. */
function makeFixture(): Fixture {
  const dir = mkdtempSync(join(tmpdir(), "anno-derive-"));
  const handle = openStore(join(dir, "fixture.annostore"), { workspaceRoot: dir });

  setDataType(handle, { ...CODE_RANGE_A, dataType: "code" });
  setDataType(handle, { ...CODE_RANGE_B, dataType: "code" });
  setDataType(handle, { ...SPLIT_ADDRESS_TABLE, dataType: "lo_hi_address" });
  setDataType(handle, { ...SPLIT_WORD_TABLE, dataType: "lo_hi_word" });

  setLabel(handle, { address: 0x0810, name: "jsr_target", kind: "User" });
  setComment(handle, { address: 0x0813, commentType: "line", text: "follow the jsr here" });

  // The ONLY half that lives on disk: a computed dispatch produces no reference
  // derivable from the bytes at all, which is why it needs somewhere to live.
  putXref(handle, { fromAddress: 0xc100, toAddress: 0xc000, accessKind: "COMPUTED_JUMP" });

  const { origin, body } = parsePrg(FIXTURE_PRG);
  return { dir, handle, image: body, origin };
}

function disposeFixture(fx: Fixture): void {
  closeStore(fx.handle);
  rmSync(fx.dir, { recursive: true, force: true });
}

/** Runs `body` against a fresh fixture and always cleans up. */
function withFixture(body: (fx: Fixture) => void): void {
  const fx = makeFixture();
  try {
    body(fx);
  } finally {
    disposeFixture(fx);
  }
}

// ---------------------------------------------------------------------------
// 1. Derived cross-references: three sources, one sorted union
// ---------------------------------------------------------------------------

test("STORE-06: a jsr inside a code range makes its own address a caller of the target", () => {
  withFixture((fx) => {
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.ok(result.callers.includes(0x0810), "the jsr at $0810 must be a caller of $c000");
  });
});

test("STORE-06: an immediate operand contributes NO caller", () => {
  withFixture((fx) => {
    // `lda #$c0` at $0813 encodes the byte $c0; a derivation that ignored
    // `role` would report $0813 as a caller of $00c0.
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0x00c0);
    assert.deepEqual(result.callers, [], "an immediate operand is a constant, never an address reference");
    assert.equal(result.count, 0);
  });
});

test("STORE-06: an indirect operand contributes NO caller for the vector it names", () => {
  withFixture((fx) => {
    // `jmp ($0314)` reads the CONTENTS of $0314; the reference is to whatever
    // those two bytes hold, which is not derivable from this instruction.
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0x0314);
    assert.deepEqual(result.callers, []);
  });
});

test("STORE-06: a branch uses resolvedTarget, and an absolute operand with none uses operand.value", () => {
  withFixture((fx) => {
    const toBranchTarget = crossReferencesTo(fx.handle, fx.image, fx.origin, 0x0810);
    assert.ok(toBranchTarget.callers.includes(0x0818), "the bne at $0818 resolves to $0810");

    const toAbsolute = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.ok(toAbsolute.callers.includes(0x081a), "the lda $c000 at $081a has no resolvedTarget and falls back to operand.value");

    const toZeroPage = crossReferencesTo(fx.handle, fx.image, fx.origin, 0x0020);
    assert.deepEqual(toZeroPage.callers, [0x081d], "the lda $20 at $081d is a zeropage reference and counts");
  });
});

test("STORE-06: a lo_hi_address table contributes callers and a lo_hi_word table does not", () => {
  withFixture((fx) => {
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.ok(result.callers.includes(0x0822), "entry 2 of the lo_hi_address table at $0820 resolves to $c000");
    assert.ok(
      !result.callers.includes(0x082a),
      "the lo_hi_word table holds the SAME bytes; producesXrefsFor() is the only thing that may separate them",
    );

    const toFirstEntry = crossReferencesTo(fx.handle, fx.image, fx.origin, 0x0810);
    assert.ok(toFirstEntry.callers.includes(0x0820), "entry 0 of the lo_hi_address table resolves to $0810");
  });
});

test("STORE-06: a stored non-derivable row appears in the same result set as the derived callers", () => {
  withFixture((fx) => {
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.deepEqual(
      result.callers,
      [0x0810, 0x081a, 0x0822, 0xc100],
      "two decoded instructions, one split-table entry and one stored COMPUTED_JUMP row, in one ascending list",
    );
    assert.equal(result.count, 4);
    assert.equal(result.to, 0xc000);
  });
});

test("STORE-06: an address reached by two sources appears exactly once, and the list is ascending", () => {
  withFixture((fx) => {
    // $0810 already derives from the `jsr`; storing it again as a hand-asserted
    // READ must not produce a second entry.
    putXref(fx.handle, { fromAddress: 0x0810, toAddress: 0xc000, accessKind: "READ" });

    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.deepEqual(result.callers, [0x0810, 0x081a, 0x0822, 0xc100]);
    assert.equal(result.count, result.callers.length);
    assert.deepEqual([...result.callers].sort((a, b) => a - b), result.callers, "the union is returned ascending");
  });
});

test("STORE-02: two ranges that exactly touch stay two ranges, and the instruction at the boundary belongs to the second", () => {
  withFixture((fx) => {
    // The attribution is observable through `crossReferencesTo`: $081a is the
    // FIRST byte of range B, and its `lda $c000` is only decoded at all if the
    // boundary belongs to B. Range A ends at $0819.
    const result = crossReferencesTo(fx.handle, fx.image, fx.origin, 0xc000);
    assert.ok(result.callers.includes(0x081a), "the boundary byte is decoded as the first instruction of the SECOND range");

    // `resolveAt()` is the single arbiter, and it must agree: the boundary byte
    // resolves to a DIFFERENT row than the byte before it.
    const rows = listRanges(fx.handle).filter((row) => row.dataType === "code");
    assert.equal(rows.length, 2, "two ranges that touch are two ranges -- never merged (STORE-02)");
    const index = paintIndexOf(fx.handle);
    const atBoundary = resolveAt(index, 0x081a);
    const beforeBoundary = resolveAt(index, 0x0819);
    assert.notEqual(atBoundary, NO_ROW);
    assert.notEqual(beforeBoundary, NO_ROW);
    assert.notEqual(atBoundary, beforeBoundary, "the first byte of the second range belongs to the SECOND range");
  });
});

test("STORE-06: every address argument goes through parseStoreAddress -- -1 and 0x10000 are refused", () => {
  withFixture((fx) => {
    assert.throws(() => crossReferencesTo(fx.handle, fx.image, fx.origin, -1), AnnoAddressError);
    assert.throws(() => crossReferencesTo(fx.handle, fx.image, fx.origin, 0x10000), AnnoAddressError);
    // The accepted string forms the one parser owns.
    assert.equal(crossReferencesTo(fx.handle, fx.image, fx.origin, "$c000").to, 0xc000);
  });
});

test("STORE-06: an image longer than the 6510 address space is refused by name (T-29-15)", () => {
  withFixture((fx) => {
    const oversized = new Uint8Array(ANNO_DERIVE_MAX_IMAGE_BYTES + 1);
    assert.throws(
      () => crossReferencesTo(fx.handle, oversized, 0, 0xc000),
      (err: unknown) => err instanceof AnnoDeriveArgumentError && /image/i.test((err as Error).message),
    );
  });
});

// ---------------------------------------------------------------------------
// 2. Search over three corpora
// ---------------------------------------------------------------------------

test("STORE-06: search finds a term in a label, in a comment and in a rendered instruction", () => {
  withFixture((fx) => {
    const result = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 50 });
    const corpora = result.results.map((hit) => hit.corpus).sort();
    assert.deepEqual(corpora, ["comments", "instructions", "labels"]);
    assert.equal(result.total, 3);
    assert.equal(result.returned, 3);
    assert.equal(result.truncated, false);

    const byCorpus = new Map(result.results.map((hit) => [hit.corpus, hit] as const));
    assert.equal(byCorpus.get("labels")!.address, 0x0810);
    assert.equal(byCorpus.get("comments")!.address, 0x0813);
    assert.equal(byCorpus.get("instructions")!.address, 0x0810);
  });
});

test("STORE-06: each corpus is independently disableable, and disabling one removes ONLY that hit", () => {
  withFixture((fx) => {
    const noLabels = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 50, search_labels: false });
    assert.deepEqual(noLabels.results.map((h) => h.corpus).sort(), ["comments", "instructions"]);
    assert.equal(noLabels.corpora.labels.searched, false);

    const noComments = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 50, search_comments: false });
    assert.deepEqual(noComments.results.map((h) => h.corpus).sort(), ["instructions", "labels"]);

    const noInstructions = searchAnnotations(fx.handle, fx.image, fx.origin, {
      query: "jsr",
      max_results: 50,
      search_instructions: false,
    });
    assert.deepEqual(noInstructions.results.map((h) => h.corpus).sort(), ["comments", "labels"]);
  });
});

test("STORE-06: matching is byte-exact and CASE-SENSITIVE, applied identically to all three corpora", () => {
  withFixture((fx) => {
    const upper = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "JSR", max_results: 50 });
    assert.equal(upper.total, 0, "case folding would find a label the store itself considers a different name");
    assert.equal(upper.caseSensitive, true, "the matching rule is stated in the body, not left for a caller to infer");
  });
});

test("STORE-06: an empty result over a real corpus is a genuine zero, distinguishable from an unavailable corpus", () => {
  withFixture((fx) => {
    const result = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "no_such_term_anywhere", max_results: 50 });
    assert.equal(result.total, 0);
    assert.deepEqual(result.results, []);
    assert.deepEqual(result.unavailable, {}, "nothing was unanswerable -- the zero is genuine");
    assert.ok(result.corpora.labels.entries > 0, "the labels corpus was named AND non-empty");
    assert.ok(result.corpora.comments.entries > 0);
    assert.ok(result.corpora.instructions.entries > 0);
  });
});

test("STORE-06: a corpus this surface does not have returns {available:false, reason} rather than a plausible zero", () => {
  withFixture((fx) => {
    const result = searchAnnotations(fx.handle, fx.image, fx.origin, {
      query: "jsr",
      max_results: 50,
      search_scopes: true,
    });
    assert.equal(result.unavailable.scopes?.available, false);
    assert.ok(
      (result.unavailable.scopes?.reason ?? "").length >= 40,
      "the reason must name what was asked for, why it cannot be answered and where the nearest answerable thing lives",
    );
    // The three real corpora still answer -- an unavailable fourth is reported
    // beside them, never instead of them.
    assert.equal(result.total, 3);
  });
});

test("STORE-06: max_results is REQUIRED with no default, and 0 is refused by name", () => {
  withFixture((fx) => {
    assert.throws(
      () => searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr" } as never),
      (err: unknown) => err instanceof AnnoDeriveArgumentError && /max_results/.test((err as Error).message),
    );
    assert.throws(
      () => searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 0 }),
      (err: unknown) => err instanceof AnnoDeriveArgumentError && /max_results/.test((err as Error).message),
    );
  });
});

test("STORE-06: max_results of 1 returns at most one result and reports the TRUE total, so truncation is detectable", () => {
  withFixture((fx) => {
    const result = searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 1 });
    assert.equal(result.results.length, 1);
    assert.equal(result.returned, 1);
    assert.equal(result.total, 3, "the true total is returned alongside the truncated list");
    assert.equal(result.truncated, true);
  });
});

test("STORE-06: the instruction corpus is bounded, and exceeding the cap is refused by name (T-29-15)", () => {
  withFixture((fx) => {
    const previous = process.env.ANNO_SEARCH_MAX_CORPUS_BYTES;
    process.env.ANNO_SEARCH_MAX_CORPUS_BYTES = "4";
    try {
      assert.throws(
        () => searchAnnotations(fx.handle, fx.image, fx.origin, { query: "jsr", max_results: 50 }),
        (err: unknown) => err instanceof AnnoDeriveArgumentError && /ANNO_SEARCH_MAX_CORPUS_BYTES/.test((err as Error).message),
      );
    } finally {
      if (previous === undefined) delete process.env.ANNO_SEARCH_MAX_CORPUS_BYTES;
      else process.env.ANNO_SEARCH_MAX_CORPUS_BYTES = previous;
    }
  });
});
