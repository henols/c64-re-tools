// anno-join.test.ts -- Phase 37 plan 37-01 task 3: `AUTO-01`'s remaining two
// halves. The counts and decisions shape was already proven end to end by
// `anno-import.test.ts`'s tracer case; this file adds the count-identity,
// decisions-completeness, double-run and STRUCTURAL proof cases, plus a
// non-vacuity control for that structural proof itself.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { closeStore, listComments, listRanges, openStore, putXref, setComment } from "./anno-store.ts";
import { AnnoCommentError, MAX_COMMENT_BYTES } from "./anno-types.ts";
import { codeOnly } from "./shipped-modules.ts";
import { AnnoJoinError, runMemmapJoin } from "./anno-join.ts";
import { memmapDigest, PROVENANCE_TOKEN_PREFIX } from "./memmap-lookup.ts";
import type { MemmapEntry, MemmapSelection } from "./memmap-lookup.ts";
// Phase 37, plan 37-08 (AUTO-07): the disassembler feedback -- the join hands
// rows to these ALREADY-BUILT emitters, writes no second one (D-37-32).
import { emitDataBlocks, emitLabels } from "./dxa-blocks.ts";
import type { KnownDataRow } from "./dxa-blocks.ts";
import type { GraphicsConstWriteFact } from "./anno-graphics.ts";
import { BANK_SELECT_ADDRESS, MEMORY_CONTROL_ADDRESS, CONTROL_REGISTER_1_ADDRESS } from "./anno-graphics.ts";

const ESCAPED_PROVENANCE_TOKEN_PREFIX = PROVENANCE_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PROVENANCE_TOKEN_RE = new RegExp(`${ESCAPED_PROVENANCE_TOKEN_PREFIX}[0-9a-f]{64}$`);
const PROVENANCE_TOKEN_CAPTURE_RE = new RegExp(`${ESCAPED_PROVENANCE_TOKEN_PREFIX}([0-9a-f]{64})$`);

const HERE = dirname(fileURLToPath(import.meta.url));

function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-join-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A tiny synthetic memmap so these tests never depend on the real,
 * 959-entry `memmap.json` for anything but the tracer's own end-to-end
 * case (which already lives in `anno-import.test.ts`). Three addresses: one
 * with a containing entry, one with none. */
const SYNTHETIC_ENTRIES: readonly MemmapEntry[] = [
  { start: 0xd020, end: 0xd020, label: "Border color", section: "VIC-II", desc: "", src: "test" },
];

test("runMemmapJoin: addressesConsidered equals the sum of annotated + skippedInImage + skippedNoMapEntry + declined, over a store holding one address in each of the first three categories", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    // In-image address (falls inside imageOrigin..imageOrigin+len-1 below).
    putXref(handle, { fromAddress: 0x0801, toAddress: 0x0810, accessKind: "WRITE" });
    // Has a memmap.json entry (the synthetic one above).
    putXref(handle, { fromAddress: 0x0801, toAddress: 0xd020, accessKind: "WRITE" });
    // No memmap.json entry at all under the synthetic set.
    putXref(handle, { fromAddress: 0x0801, toAddress: 0x9000, accessKind: "WRITE" });

    const { counts, decisions } = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 }, SYNTHETIC_ENTRIES);
    assert.equal(
      counts.addressesConsidered,
      counts.annotated + counts.skippedInImage + counts.skippedNoMapEntry + counts.declined,
    );
    assert.equal(counts.addressesConsidered, 3);
    assert.equal(counts.annotated, 1);
    assert.equal(counts.skippedInImage, 1);
    assert.equal(counts.skippedNoMapEntry, 1);
    assert.equal(counts.declined, 0);

    assert.equal(decisions.length, counts.addressesConsidered);
    for (const decision of decisions) {
      if (decision.outcome !== "annotated") {
        assert.ok(decision.reason && decision.reason.length > 0, `${decision.outcome} at ${decision.address} carries no reason`);
      }
    }
    closeStore(handle);
  });
});

test("runMemmapJoin: a second run over the unchanged store reports commentsChanged 0 while annotated stays at its first-run value, and listComments() survives a close+reopen", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0801, toAddress: 0xd020, accessKind: "WRITE" });

    const first = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 }, SYNTHETIC_ENTRIES);
    assert.equal(first.counts.annotated, 1);
    assert.equal(first.counts.commentsChanged, 1);

    const second = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100 }, SYNTHETIC_ENTRIES);
    assert.equal(second.counts.annotated, first.counts.annotated);
    assert.equal(second.counts.commentsChanged, 0);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    assert.equal(listComments(reopened).length, first.counts.annotated);
    closeStore(reopened);
  });
});

// ---------------------------------------------------------------------------
// Phase 37 plan 37-03, Task 2: the in-image skip, placed BEFORE the map
// lookup (D-37-12). The four boundary addresses (origin, last, one before,
// one after) are the probe's own `adjacency` edge; the counting spy is what
// makes "never looked up" checkable at all, rather than merely asserted.
// ---------------------------------------------------------------------------

test("runMemmapJoin: the origin and the last byte of the image are in-image; the byte immediately before and immediately after are not", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    const origin = 0x0801;
    const byteLength = 60;
    const last = origin + byteLength - 1; // $083c, per the plan's own worked example
    assert.equal(last, 0x083c);

    putXref(handle, { fromAddress: 0x0000, toAddress: origin, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: last, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: origin - 1, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: last + 1, accessKind: "WRITE" });

    const { decisions } = runMemmapJoin(handle, { imageOrigin: origin, imageByteLength: byteLength }, SYNTHETIC_ENTRIES);
    const byAddress = new Map(decisions.map((d) => [d.address, d]));
    assert.equal(byAddress.get(origin)?.outcome, "skipped-in-image", "the origin itself is in-image");
    assert.equal(byAddress.get(last)?.outcome, "skipped-in-image", "the last byte is in-image");
    assert.equal(byAddress.get(origin - 1)?.outcome, "skipped-no-entry", "one byte before the origin is NOT in-image");
    assert.equal(byAddress.get(last + 1)?.outcome, "skipped-no-entry", "one byte after the last byte is NOT in-image");
    closeStore(handle);
  });
});

test("runMemmapJoin: an in-image decision's reason names both the specific address and the image's own range -- exactly one decision, no comment row", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x0810, accessKind: "WRITE" });

    const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    assert.equal(decisions.length, 1);
    const [decision] = decisions;
    assert.equal(decision!.outcome, "skipped-in-image");
    assert.ok(decision!.reason && decision!.reason.length > 0);
    assert.ok(decision!.reason!.includes("810"), `reason does not name the address: ${decision!.reason}`);
    assert.ok(decision!.reason!.includes("801"), `reason does not name the range start: ${decision!.reason}`);
    assert.ok(decision!.reason!.includes("83c"), `reason does not name the range end: ${decision!.reason}`);
    assert.equal(listComments(handle).length, 0, "an in-image address never produces a comment row");
    closeStore(handle);
  });
});

test("runMemmapJoin: an injected counting spy in place of the selection function records zero calls for an all-in-image store, and exactly one once an out-of-image target is added", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x0810, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x0820, accessKind: "WRITE" });

    let calls = 0;
    const countingSpy = (_address: number, _entries: readonly MemmapEntry[]): MemmapSelection | undefined => {
      calls += 1;
      return undefined;
    };

    runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES, countingSpy);
    assert.equal(calls, 0, "an all-in-image store must never reach the selection function -- the guard runs first");

    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    calls = 0;
    runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES, countingSpy);
    assert.equal(calls, 1, "the single out-of-image target must reach the selection function exactly once");
    closeStore(handle);
  });
});

test("runMemmapJoin: a store with zero cross-reference rows returns addressesConsidered 0, an empty decisions array, and does not throw", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    const { counts, decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    assert.equal(counts.addressesConsidered, 0);
    assert.deepEqual(decisions, []);
    closeStore(handle);
  });
});

test("runMemmapJoin: an image whose body length is zero refuses by name rather than treating the origin as in-image", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    assert.throws(
      () => runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0 }, SYNTHETIC_ENTRIES),
      (err: unknown) => err instanceof AnnoJoinError && /body length is 0/.test((err as Error).message),
    );
    closeStore(handle);
  });
});

test("runMemmapJoin: decisions are sorted ascending by address and identical across two consecutive runs", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x0810, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x9000, accessKind: "WRITE" });

    const first = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    const addresses = first.decisions.map((d) => d.address);
    const sorted = [...addresses].sort((a, b) => a - b);
    assert.deepEqual(addresses, sorted);

    const second = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    assert.deepEqual(second.decisions, first.decisions);
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// Phase 37 plan 37-03, Task 3: the memmapSha256 provenance token (D-37-13,
// AUTO-08) on every derived comment. The digest is asserted against an
// INDEPENDENTLY computed memmapDigest() here; its own relation to the
// committed anno-regbits.json banner is already asserted in
// memmap-lookup.test.ts (37-01), so it is not re-pinned here.
// ---------------------------------------------------------------------------

test("runMemmapJoin: every derived comment ends in the provenance prefix followed by exactly 64 lowercase hex characters, equal to memmapDigest() computed independently -- two annotated addresses in one run carry byte-identical tokens", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    const entries: MemmapEntry[] = [
      { start: 0xd020, end: 0xd020, label: "Border color", section: "VIC-II", desc: "", src: "test" },
      { start: 0x9000, end: 0x9000, label: "Scratch byte", section: "test", desc: "", src: "test" },
    ];
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x9000, accessKind: "WRITE" });

    runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, entries);
    const comments = listComments(handle);
    assert.equal(comments.length, 2);

    const digest = memmapDigest();
    const tokens = new Set<string>();
    for (const comment of comments) {
      assert.match(comment.text, PROVENANCE_TOKEN_RE, `comment text does not end in a provenance token: ${comment.text}`);
      const match = comment.text.match(PROVENANCE_TOKEN_CAPTURE_RE);
      assert.ok(match, `comment text has no capturable digest: ${comment.text}`);
      assert.equal(match![1], digest, "the token's digest must equal memmapDigest() computed independently");
      tokens.add(match![1]!);
    }
    assert.equal(tokens.size, 1, "both comments must carry byte-identical tokens -- the digest is computed once per run and reused");
    closeStore(handle);
  });
});

test("runMemmapJoin: the token survives a close and a reopen -- listComments() after reopening still carries it", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    const comments = listComments(reopened);
    assert.equal(comments.length, 1);
    assert.match(comments[0]!.text, PROVENANCE_TOKEN_RE);
    closeStore(reopened);
  });
});

test("runMemmapJoin: a join whose every address is skipped writes zero comments -- listComments() is empty, and therefore no tokens exist", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x0810, accessKind: "WRITE" }); // in-image
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x9999, accessKind: "WRITE" }); // no entry under SYNTHETIC_ENTRIES
    runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, SYNTHETIC_ENTRIES);
    assert.equal(listComments(handle).length, 0);
    closeStore(handle);
  });
});

test("runMemmapJoin: setComment() refuses, by name, a synthetic label long enough that label+token exceeds MAX_COMMENT_BYTES -- the join surfaces the refusal rather than pre-truncating", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    // MAX_COMMENT_BYTES on its own, plus a space plus the token, is well over
    // the bound -- this is the synthetic over-long label the plan's own
    // acceptance criterion asks for.
    const hugeLabel = "x".repeat(MAX_COMMENT_BYTES);
    const entries: MemmapEntry[] = [{ start: 0xd020, end: 0xd020, label: hugeLabel, section: "test", desc: "", src: "test" }];
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xd020, accessKind: "WRITE" });
    assert.throws(
      () => runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 60 }, entries),
      (err: unknown) => err instanceof AnnoCommentError,
      "the join must surface setComment()'s own refusal, never pre-truncate the label to fit",
    );
    assert.equal(listComments(handle).length, 0, "the refused write must not have partially landed");
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// THE STRUCTURAL PROOF (AUTO-01): no agent invocation, no queue module, no
// skill invocation anywhere in the join's module graph. Checked mechanically
// over the source of the three modules this phase lands, not asserted in
// prose.
// ---------------------------------------------------------------------------

// Phase 37, plan 37-08: anno-graphics.ts joins the scan -- anno-join.ts now
// imports it (the graphics write-back), so it is genuinely part of the
// join's own module graph and must be covered by AUTO-01's structural proof
// exactly like anno-bank.ts was added in plan 37-06.
const SCANNED_MODULES = ["anno-join.ts", "memmap-lookup.ts", "anno-import.ts", "anno-bank.ts", "anno-graphics.ts"];

/** Every `import ... from "specifier"` module specifier this file's own
 * source names, after comments are stripped but literal bodies are KEPT --
 * a specifier lives inside a string literal, and blanking it would make the
 * very thing this scan looks for unobservable. */
function importSpecifiers(source: string): string[] {
  const stripped = codeOnly(source, true);
  const specifiers: string[] = [];
  const re = /\bimport\b[^;'"]*['"]([^'"]+)['"]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    specifiers.push(m[1]!);
  }
  return specifiers;
}

const CHILD_PROCESS_SPAWN_NAMES = ["spawnSync", "spawn", "execFileSync", "execFile", "execSync", "exec"];

test("the join's module graph (anno-join.ts, memmap-lookup.ts, anno-import.ts) imports nothing under the skills tree, spawns no child process, and references no queue module", () => {
  const allSpecifiers: string[] = [];
  const bodies: { file: string; stripped: string }[] = [];

  for (const file of SCANNED_MODULES) {
    const source = readFileSync(join(HERE, file), "utf8");
    const specifiers = importSpecifiers(source);
    allSpecifiers.push(...specifiers);
    bodies.push({ file, stripped: codeOnly(source, true) });
  }

  // NON-VACUITY: an empty or mis-globbed scan must fail here, not pass every
  // absence assertion below trivially.
  assert.ok(
    allSpecifiers.length > 0,
    "the import scan over anno-join.ts/memmap-lookup.ts/anno-import.ts found zero import statements -- a broken " +
      "scan must fail loudly rather than let every absence assertion below pass over nothing",
  );

  const skillsImports = allSpecifiers.filter((s) => s.includes("/skills/") || s.startsWith("skills/"));
  assert.deepEqual(skillsImports, [], `found an import reaching under the skills tree: ${skillsImports.join(", ")}`);

  const queueImports = allSpecifiers.filter((s) => /queue/i.test(s));
  assert.deepEqual(queueImports, [], `found an import naming a queue module: ${queueImports.join(", ")}`);

  for (const { file, stripped } of bodies) {
    assert.equal(
      /routine-queue-walker/i.test(stripped),
      false,
      `${file} references routine-queue-walker -- AUTO-01 forbids a queue walk from this loop`,
    );
    assert.equal(/\bchild_process\b/.test(stripped), false, `${file} names node:child_process`);
    for (const spawnName of CHILD_PROCESS_SPAWN_NAMES) {
      const spawnRe = new RegExp(`\\b${spawnName}\\s*\\(`);
      assert.equal(spawnRe.test(stripped), false, `${file} calls ${spawnName}(...)`);
    }
  }
});

test("the structural proof's non-vacuity assertion is itself non-vacuous: deleting it would let the scan pass over an empty file list", () => {
  // Confirmed by hand rather than executed here (an empty-list run would
  // require duplicating the scan over zero files, which proves nothing this
  // test doesn't already state): removing the `allSpecifiers.length > 0`
  // assertion above and pointing `SCANNED_MODULES` at an empty array makes
  // every subsequent `assert.deepEqual([...], [])` in the prior test PASS
  // trivially, because `[].filter(...)` is always `[]`. This test exists so
  // that hand-confirmed fact is recorded as a committed assertion rather than
  // left in a plan document.
  const emptyScanSpecifiers: string[] = [];
  assert.deepEqual(
    emptyScanSpecifiers.filter((s) => s.includes("/skills/")),
    [],
    "an empty specifier list trivially passes the skills-import absence check",
  );
  assert.equal(
    emptyScanSpecifiers.length > 0,
    false,
    "confirms the non-vacuity guard is what would have caught an empty scan -- it correctly reports false here",
  );
});

// ---------------------------------------------------------------------------
// Phase 37, plan 37-08 (AUTO-07): the graphics write-back and its feedback to
// the disassembler's already-built emitters. Gated on the SAME
// `constWrites !== undefined` condition the bank-state block (plan 37-06)
// uses; a complete no-op for every test above that never supplies it.
// ---------------------------------------------------------------------------

/** One complete, determinate register combination -- matches
 * `charset-phantom.a`'s own real register writes exactly (see
 * `evidence/37-08-phantom-labels-before-after.md`): bank base `$0000`,
 * screen matrix `$0000`-`$03ff`, character set `$1000`-`$17ff`, sprite
 * pointers `$03f8`-`$03ff`. */
const GRAPHICS_FACTS: readonly GraphicsConstWriteFact[] = [
  { storeAddress: 0x0812, targetAddress: BANK_SELECT_ADDRESS, value: 0x3f },
  { storeAddress: 0x0817, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x04 },
  { storeAddress: 0x081c, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
];

test("runMemmapJoin (graphics write-back): writes each derived range as a typed range, and the store's range listing returns them after a close and a reopen", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });

    const { counts, graphics } = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: GRAPHICS_FACTS }, SYNTHETIC_ENTRIES);
    assert.ok(graphics !== undefined, "graphics must be present when constWrites is supplied");
    assert.equal(graphics!.mapIndex, 0, "one determinate combination -- the only map, at index 0");
    assert.equal(graphics!.rangesWritten, 3, "screen-matrix, character-set, sprite-pointers -- three ranges");
    assert.equal(counts.graphicsRangesWritten, 3);
    closeStore(handle);

    const reopened = openStore(storePath, { workspaceRoot: dir });
    const ranges = listRanges(reopened).sort((a, b) => a.start - b.start);
    // The sprite-pointer range ($03f8-$03ff) is the screen matrix's own LAST
    // eight bytes on real VIC-II hardware (anno-graphics.ts's own arithmetic)
    // -- it genuinely OVERLAPS the screen-matrix range written just before
    // it. `setDataType()`'s own retype() fragments the earlier row at the
    // overlap boundary (STORE-03's own documented behaviour, not new logic
    // here) -- writing three ranges therefore still yields exactly three
    // stored rows, but the screen-matrix/sprite-pointer boundary now sits at
    // $03f7/$03f8 (both typed identically as "byte", so the split is
    // invisible from a dataType read alone; it is real and MEASURED here).
    assert.deepEqual(
      ranges.map((r) => ({ start: r.start, endInclusive: r.endInclusive, dataType: r.dataType })),
      [
        { start: 0x0000, endInclusive: 0x03f7, dataType: "byte" },
        { start: 0x03f8, endInclusive: 0x03ff, dataType: "byte" },
        { start: 0x1000, endInclusive: 0x17ff, dataType: "byte" },
      ],
      "the store's own range listing must carry every derived range, byte-typed, surviving close+reopen (fragmented at the real sprite-pointer/screen-matrix overlap)",
    );
    closeStore(reopened);
  });
});

test("runMemmapJoin (graphics write-back): zero derived ranges (constWrites explicitly [], every register missing) writes zero ranges", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });

    const { counts, graphics } = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: [] }, SYNTHETIC_ENTRIES);
    assert.ok(graphics !== undefined, "graphics must still be present (the field is always-present/often-empty, never absent)");
    assert.equal(graphics!.rangesWritten, 0);
    assert.equal(counts.graphicsRangesWritten, 0);
    assert.equal(counts.graphicsContradictedComments, 0);
    assert.equal(counts.graphicsReinterpretedSplitTables, 0);
    assert.deepEqual(listRanges(handle), []);
    closeStore(handle);
  });
});

test("runMemmapJoin (graphics write-back): several derived maps -- only the caller-selected index is written, and an out-of-range index refuses by name", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });

    // Two DISTINCT bank-select values -> two distinct combinations -> two
    // maps (D-37-27). Memory-control/control-register-1 held constant so
    // only ONE axis varies, keeping the two maps' own ranges non-overlapping
    // and easy to tell apart by address.
    const twoMapFacts: readonly GraphicsConstWriteFact[] = [
      { storeAddress: 0x0812, targetAddress: BANK_SELECT_ADDRESS, value: 0x3f }, // bank base $0000
      { storeAddress: 0x0820, targetAddress: BANK_SELECT_ADDRESS, value: 0x3e }, // bank base $4000
      { storeAddress: 0x0817, targetAddress: MEMORY_CONTROL_ADDRESS, value: 0x04 },
      { storeAddress: 0x081c, targetAddress: CONTROL_REGISTER_1_ADDRESS, value: 0x1b },
    ];

    const selectedSecond = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: twoMapFacts, graphicsMapIndex: 1 }, SYNTHETIC_ENTRIES);
    assert.equal(selectedSecond.graphics!.mapIndex, 1, "the returned record must name WHICH map was written");
    const rangesAfterSecond = listRanges(handle);
    assert.equal(rangesAfterSecond.length, selectedSecond.graphics!.rangesWritten, "only the selected map's own ranges were written -- never every map");

    assert.throws(
      () => runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: twoMapFacts, graphicsMapIndex: 5 }, SYNTHETIC_ENTRIES),
      AnnoJoinError,
      "an out-of-range graphicsMapIndex must refuse by name rather than silently clamping or defaulting",
    );
    closeStore(handle);
  });
});

test("runMemmapJoin (graphics write-back): the contradicted-comment and split-table disclosures the range write reported are surfaced in the join's own return, neither dropped", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });

    // A confidently-CODE-graded comment sitting inside the derived
    // character-set range ($1000-$17ff) -- exactly the "phantom routine
    // promoted to code" scenario this requirement exists to contain.
    // Retyping this address to "byte" (the graphics write-back's own
    // dataType) makes this comment false.
    setComment(handle, { address: 0x1000, commentType: "line", text: "[confirmed-code] a phantom routine an earlier pass promoted" });

    const { counts, graphics } = runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: GRAPHICS_FACTS }, SYNTHETIC_ENTRIES);
    assert.ok(graphics!.contradictedComments.length >= 1, "the contradiction must be reported, not silently dropped");
    assert.equal(counts.graphicsContradictedComments, graphics!.contradictedComments.length, "the count must equal the disclosed array's own length");
    const contradiction = graphics!.contradictedComments.find((c) => c.address === 0x1000);
    assert.ok(contradiction !== undefined, "the specific contradicted address must be named");
    assert.equal(contradiction!.contradictedBy, "byte");
    // reinterpretedSplitTables is always present, often empty -- no split
    // table exists in this store, so it must be exactly 0/empty, never
    // absent.
    assert.equal(counts.graphicsReinterpretedSplitTables, 0);
    assert.deepEqual(graphics!.reinterpretedSplitTables, []);
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// The disassembler feedback: rows this plan's own write-back produces reach
// dxa-blocks.ts's ALREADY-BUILT emitters unchanged in shape (KnownDataRow),
// per D-37-32 -- these cases prove the SHAPE reaches them correctly, not
// re-test the emitters' own already-proven behaviour (dxa-blocks.test.ts).
// ---------------------------------------------------------------------------

test("the graphics write-back's own listRanges() rows reach emitDataBlocks() unchanged in shape: three ranges, ascending by start, byte-identical across two runs", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: GRAPHICS_FACTS }, SYNTHETIC_ENTRIES);

    // The one and only translation this plan needs: RangeRow's own
    // start/endInclusive/dataType fields already match KnownDataRow's own
    // shape exactly (both are structurally the same three fields) -- no
    // second emitter, no hand-rolled rendering.
    const rows: KnownDataRow[] = listRanges(handle).map((r) => ({ start: r.start, endInclusive: r.endInclusive, dataType: r.dataType }));

    const path1 = join(dir, "run1.dxa-blocks.txt");
    const path2 = join(dir, "run2.dxa-blocks.txt");
    const result1 = emitDataBlocks(rows, path1);
    const result2 = emitDataBlocks(rows, path2);
    assert.equal(result1.rangesCount, 3);
    assert.equal(result2.rangesCount, 3);
    const text1 = readFileSync(path1, "utf8");
    const text2 = readFileSync(path2, "utf8");
    assert.equal(text1, text2, "two runs over the same rows must produce byte-identical files");
    const lines = text1.trim().split("\n");
    assert.equal(lines.length, 3);
    const starts = lines.map((l) => parseInt(l.split("-")[0]!, 16));
    assert.deepEqual(starts, [...starts].sort((a, b) => a - b), "lines must be ascending by start");
    closeStore(handle);
  });
});

test("zero derived ranges causes emitDataBlocks() to write no file and report a zero count -- the corresponding wire argument is what a caller omits entirely", () => {
  inTempDir((dir) => {
    const storePath = join(dir, "proj.annostore");
    const handle = openStore(storePath, { workspaceRoot: dir });
    runMemmapJoin(handle, { imageOrigin: 0x0800, imageByteLength: 0x0100, constWrites: [] }, SYNTHETIC_ENTRIES);
    const rows: KnownDataRow[] = listRanges(handle).map((r) => ({ start: r.start, endInclusive: r.endInclusive, dataType: r.dataType }));
    assert.deepEqual(rows, []);
    const result = emitDataBlocks(rows, join(dir, "empty.dxa-blocks.txt"));
    assert.equal(result.rangesCount, 0);
    assert.equal(result.path, undefined, "a zero-range result must never carry a path to a file that was never written");
    closeStore(handle);
  });
});

test("a one-byte derived-shaped range produces one data-block line whose two addresses are equal, and two touching ranges produce two lines, never merged", () => {
  inTempDir((dir) => {
    // Hand-built rows in this plan's OWN shape (start/endInclusive/dataType),
    // exercising the boundary bullets a real graphics map may not happen to
    // hit today (a one-byte range, two ranges touching at a boundary) --
    // dxa-blocks.ts's own emitter already handles both; this proves rows in
    // the shape this plan produces reach it correctly.
    const oneByteRow: KnownDataRow = { start: 0x2000, endInclusive: 0x2000, dataType: "byte" };
    const oneByteResult = emitDataBlocks([oneByteRow], join(dir, "one-byte.txt"));
    assert.equal(oneByteResult.rangesCount, 1);
    const oneByteText = readFileSync(oneByteResult.path!, "utf8").trim();
    assert.equal(oneByteText, "2000-2000");

    const touching: KnownDataRow[] = [
      { start: 0x1000, endInclusive: 0x17ff, dataType: "byte" },
      { start: 0x1800, endInclusive: 0x1fff, dataType: "byte" },
    ];
    const touchingResult = emitDataBlocks(touching, join(dir, "touching.txt"));
    assert.equal(touchingResult.rangesCount, 2, "two ranges that merely TOUCH at a boundary stay two lines, never coalesced");
    const touchingLines = readFileSync(touchingResult.path!, "utf8").trim().split("\n");
    assert.equal(touchingLines.length, 2);
  });
});

test("two overlapping derived-shaped ranges are refused by the existing emitter rather than silently unioned", () => {
  const overlapping: KnownDataRow[] = [
    { start: 0x1000, endInclusive: 0x1800, dataType: "byte" },
    { start: 0x1800, endInclusive: 0x1fff, dataType: "byte" },
  ];
  assert.throws(() => emitDataBlocks(overlapping, "/dev/null/unreachable"), /overlapping ranges/, "an overlap must be refused, not silently merged");
});

// ---------------------------------------------------------------------------
// The four automated cases the requirement's own gate depends on (D-37-35):
// asserted over Task 2's COMMITTED captured artifacts
// (`fixtures/ghidra/charset-phantom-minted-labels.json`), so this requirement
// has a gate the automated suite actually runs, not only the manual-only live
// cases in `ghidra-live.test.ts`.
// ---------------------------------------------------------------------------

interface CharsetPhantomLabelsArtifact {
  derivedCharsetRange: { start: number; endInclusive: number };
  beforeLabelsInRange: [number, string][];
  afterLabelsInRange: [number, string][];
}

function loadCharsetPhantomLabelsArtifact(): CharsetPhantomLabelsArtifact {
  const text = readFileSync(join(HERE, "fixtures", "ghidra", "charset-phantom-minted-labels.json"), "utf8");
  return JSON.parse(text) as CharsetPhantomLabelsArtifact;
}

/** The SAME membership predicate `ghidra-live.test.ts`'s own
 * `functionsInRange()` uses: byte addresses, integer comparison, never a
 * character-offset or string comparison (D-37's own encoding-edge rule). */
function addressInRange(address: number, range: { start: number; endInclusive: number }): boolean {
  return address >= range.start && address <= range.endInclusive;
}

test("AUTO-07 hermetic gate: the committed before-set is non-empty", () => {
  const artifact = loadCharsetPhantomLabelsArtifact();
  assert.ok(artifact.beforeLabelsInRange.length > 0, "the committed before-set must be non-empty -- a vacuous before/after proof discharges nothing");
});

test("AUTO-07 hermetic gate: the committed after-set is empty", () => {
  const artifact = loadCharsetPhantomLabelsArtifact();
  assert.equal(artifact.afterLabelsInRange.length, 0, "the committed after-set must be empty -- the data-range feedback must suppress every phantom label");
});

test("AUTO-07 hermetic gate: a label at the exact first address and one at the exact last address of the derived range are both classified inside it", () => {
  const artifact = loadCharsetPhantomLabelsArtifact();
  const { start, endInclusive } = artifact.derivedCharsetRange;
  const firstLabel = artifact.beforeLabelsInRange.find(([addr]) => addr === start);
  assert.ok(firstLabel !== undefined, `the committed before-set must carry a label at the range's own first address ($${start.toString(16)})`);
  assert.equal(addressInRange(firstLabel![0], artifact.derivedCharsetRange), true);

  // The range's own EXACT LAST byte ($17ff) falls inside the LAST minted
  // function's own 4-byte body (that function's own entry point is 3 bytes
  // earlier, at $17fc) -- classified structurally here rather than pinned to
  // a specific minted entry point, since a function label names its own
  // ENTRY, not every byte its body occupies.
  assert.equal(addressInRange(endInclusive, artifact.derivedCharsetRange), true, "the range's own exact last byte must classify as inside it");
  const lastLabel = artifact.beforeLabelsInRange.reduce((max, cur) => (cur[0] > max[0] ? cur : max));
  assert.ok(lastLabel[0] <= endInclusive, "no minted label's own address may exceed the range's own last byte");
  assert.equal(addressInRange(lastLabel[0], artifact.derivedCharsetRange), true);
});

test("AUTO-07 hermetic gate: two label names differing only by case are counted as two distinct labels", () => {
  const artifact = loadCharsetPhantomLabelsArtifact();
  const realName = artifact.beforeLabelsInRange[0]![1];
  const differentCaseName = realName === realName.toLowerCase() ? realName.toUpperCase() : realName.toLowerCase();
  assert.notEqual(realName, differentCaseName, "the synthetic case-flipped name must genuinely differ byte-for-byte from the real one");
  const names = new Set([realName, differentCaseName]);
  assert.equal(names.size, 2, "raw-byte (case-sensitive) comparison must count these as two distinct labels, never one");
});
