// anno-bank.test.ts -- Phase 37 plan 37-06, Task 1 (AUTO-04/AUTO-05): the
// processor-port bit decode, the region resolution, and the decline. Every
// `<behavior>` bullet below is written FIRST and observed to fail before the
// implementation in `anno-bank.ts` / `anno-join.ts` exists, per this plan's
// own TDD instruction.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeBankState, isBankConditionalAddress, regionAdmitsEntry, resolveBankedRegion } from "./anno-bank.ts";
import type { BankedRegion } from "./anno-bank.ts";
import { closeStore, listComments, openStore, putXref } from "./anno-store.ts";
import { parseConstWrites, parseGhidraExport } from "./anno-import.ts";
import type { ConstWriteFact } from "./anno-import.ts";
import { runMemmapJoin } from "./anno-join.ts";
import { loadMemmap, PROVENANCE_TOKEN_PREFIX, selectMemmapEntry } from "./memmap-lookup.ts";
import type { MemmapEntry } from "./memmap-lookup.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_CAPTURE_PATH = join(HERE, "fixtures", "ghidra", "export-bank-path-dependent.txt");
const REAL_ANNO_BANK_PATH = join(HERE, "anno-bank.ts");
const REAL_ANNO_JOIN_PATH = join(HERE, "anno-join.ts");
const REAL_ANNO_STORE_PATH = join(HERE, "anno-store.ts");
const REAL_MEMMAP_LOOKUP_PATH = join(HERE, "memmap-lookup.ts");
// Plan 37-08 (AUTO-07) added a fourth sibling import to anno-join.ts
// (`./anno-graphics.ts`, the graphics write-back's own derivation module) --
// shimmed here the same way, by absolute path, mirroring this file's own
// anno-store.ts/memmap-lookup.ts shims below.
const REAL_ANNO_GRAPHICS_PATH = join(HERE, "anno-graphics.ts");

const ESCAPED_PROVENANCE_TOKEN_PREFIX = PROVENANCE_TOKEN_PREFIX.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PROVENANCE_TOKEN_RE = new RegExp(`${ESCAPED_PROVENANCE_TOKEN_PREFIX}[0-9a-f]{64}$`);
const BANK_PROVENANCE_RE = /\[processor-port:\$[0-9a-f]+(?:,\$[0-9a-f]+)*\]/;

import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

function inTempDir(body: (dir: string) => void): void {
  const dir = mkdtempSync(join(tmpdir(), "anno-bank-"));
  try {
    body(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// decodeBankState() -- D-37-21's bit arithmetic (three fixture values).
// ---------------------------------------------------------------------------

test("decodeBankState(0x37) reports the I/O area at the I/O range, BASIC ROM at the BASIC range and KERNAL ROM at the KERNAL range", () => {
  const state = decodeBankState(0x37);
  assert.equal(state.ioRange, "io_area");
  assert.equal(state.basicRange, "basic_rom");
  assert.equal(state.kernalRange, "kernal_rom");
  assert.equal(state.raw, 0x37);
});

test("decodeBankState(0x34) reports RAM at all three ranges", () => {
  const state = decodeBankState(0x34);
  assert.equal(state.ioRange, "ram");
  assert.equal(state.basicRange, "ram");
  assert.equal(state.kernalRange, "ram");
});

test("decodeBankState(0x33) reports Character ROM at the I/O range, BASIC ROM at the BASIC range and KERNAL ROM at the KERNAL range", () => {
  const state = decodeBankState(0x33);
  assert.equal(state.ioRange, "character_rom");
  assert.equal(state.basicRange, "basic_rom");
  assert.equal(state.kernalRange, "kernal_rom");
});

test("decodeBankState() ignores bits above bit 2: two values differing only above bit 2 decode identically", () => {
  const a = decodeBankState(0x34);
  const b = decodeBankState(0xf4);
  assert.deepEqual(a, { ...b, raw: a.raw });
  assert.equal(a.ioRange, b.ioRange);
  assert.equal(a.basicRange, b.basicRange);
  assert.equal(a.kernalRange, b.kernalRange);
});

// ---------------------------------------------------------------------------
// resolveBankedRegion() / isBankConditionalAddress()
// ---------------------------------------------------------------------------

test("resolveBankedRegion() for an address outside all three bank-conditional ranges reports not_applicable, not RAM", () => {
  const state = decodeBankState(0x37);
  assert.equal(resolveBankedRegion(0x0800, state), "not_applicable");
  assert.equal(isBankConditionalAddress(0x0800), false);
  assert.equal(isBankConditionalAddress(0xd020), true);
  assert.equal(isBankConditionalAddress(0xa000), true);
  assert.equal(isBankConditionalAddress(0xe000), true);
});

// ---------------------------------------------------------------------------
// Program-point behavior over a synthetic store: single value, empty,
// disagreeing, and same-region cases (D-37-23). None of these need the real
// memmap.json -- they exercise the DECISION logic, not the real map's own
// content.
// ---------------------------------------------------------------------------

test("a program point reached by exactly one recovered value resolves and annotates", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    const entries: MemmapEntry[] = [
      { start: 0xa000, end: 0xa000, label: "Synthetic BASIC ROM entry", section: "$A000-$BFFF BASIC ROM", desc: "", src: "test" },
    ];
    putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x10, constWrites: [{ storeAddress: 0x1000, targetAddress: 0x0001, value: 0x03 }] },
      entries,
    );
    assert.equal(counts.annotated, 1);
    assert.equal(counts.declined, 0);
    assert.equal(decisions[0]!.outcome, "annotated");
    assert.equal(decisions[0]!.label, "Synthetic BASIC ROM entry");
    closeStore(handle);
  });
});

test("a program point reached by no recovered value declines with a reason naming the absence; it never defaults to the power-on value", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xa000, accessKind: "WRITE" });
    const { counts, decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x10, constWrites: [] }, []);
    assert.equal(counts.declined, 1);
    assert.equal(counts.annotated, 0);
    const [decision] = decisions;
    assert.equal(decision!.outcome, "declined");
    assert.ok(decision!.reason && decision!.reason.length > 0);
    assert.ok(/no recovered processor-port value reaches/.test(decision!.reason!), decision!.reason);
    assert.equal(decision!.label, undefined, "a declined address must never carry a label");
    assert.ok(!/\$37\b/.test(decision!.reason!), `reason must never name the power-on value as a default: ${decision!.reason}`);
    assert.equal(listComments(handle).length, 0, "a declined address never produces a comment row");
    closeStore(handle);
  });
});

test("a program point reached by two values decoding to different regions for its range declines with a reason naming both values and the address", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    putXref(handle, { fromAddress: 0x1000, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: 0x2000, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      {
        imageOrigin: 0x0801,
        imageByteLength: 0x10,
        constWrites: [
          { storeAddress: 0x1000, targetAddress: 0x0001, value: 0x37 },
          { storeAddress: 0x2000, targetAddress: 0x0001, value: 0x34 },
        ],
      },
      [],
    );
    assert.equal(counts.declined, 1);
    assert.equal(counts.annotated, 0);
    const [decision] = decisions;
    assert.equal(decision!.outcome, "declined");
    assert.ok(decision!.reason && /37/.test(decision!.reason) && /34/.test(decision!.reason), decision!.reason);
    assert.ok(/d020/.test(decision!.reason!), decision!.reason);
    closeStore(handle);
  });
});

test("a program point reached by two values decoding to the SAME region for its range annotates, and the decision records that the values differed but the region did not", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    const entries: MemmapEntry[] = [{ start: 0xa000, end: 0xa000, label: "Scratch RAM area", section: "test", desc: "", src: "test" }];
    putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
    putXref(handle, { fromAddress: 0x2000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
    const { counts, decisions } = runMemmapJoin(
      handle,
      {
        imageOrigin: 0x0801,
        imageByteLength: 0x10,
        constWrites: [
          { storeAddress: 0x1000, targetAddress: 0x0001, value: 0x00 },
          { storeAddress: 0x2000, targetAddress: 0x0001, value: 0x02 },
        ],
      },
      entries,
    );
    assert.equal(counts.annotated, 1);
    assert.equal(counts.declined, 0);
    const [decision] = decisions;
    assert.equal(decision!.outcome, "annotated");
    assert.equal(decision!.label, "Scratch RAM area");
    assert.ok(
      decision!.reason && /differing/.test(decision!.reason) && /ram/.test(decision!.reason),
      `expected the decision to record that the values differed but the region agreed: ${decision!.reason}`,
    );
    closeStore(handle);
  });
});

test("a decline and a no-map-entry skip are different outcomes with different reasons", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    // A: declines (empty reaching-values set, bank-conditional address).
    putXref(handle, { fromAddress: 0x0000, toAddress: 0xa000, accessKind: "WRITE" });
    // B: an ordinary machine address outside all bank-conditional ranges,
    // with no map entry at all -- unaffected by bank logic.
    putXref(handle, { fromAddress: 0x0000, toAddress: 0x9000, accessKind: "WRITE" });
    const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x10, constWrites: [] }, []);
    const byAddress = new Map(decisions.map((d) => [d.address, d]));
    const declined = byAddress.get(0xa000);
    const skipped = byAddress.get(0x9000);
    assert.equal(declined!.outcome, "declined");
    assert.equal(skipped!.outcome, "skipped-no-entry");
    assert.notEqual(declined!.outcome, skipped!.outcome);
    assert.notEqual(declined!.reason, skipped!.reason);
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// The two named flip cases, driven from the REAL committed captured export
// (plan 37-02), never a hand-written string -- that capture is the phase's
// only real evidence the two-value site exists.
// ---------------------------------------------------------------------------

const REAL_ENTRIES = loadMemmap();

function realConstWrites(): ReturnType<typeof parseConstWrites> {
  const text = readFileSync(REAL_CAPTURE_PATH, "utf8");
  const doc = parseGhidraExport(text);
  const facts = parseConstWrites(doc);
  assert.ok(facts.length >= 2, "expected the real capture to carry at least two const-write facts");
  return facts;
}

test("driven from the committed captured export: the shared subroutine's border-colour-register write resolves under the all-RAM value ($34) to a comment whose label is NOT the border colour label", () => {
  inTempDir((dir) => {
    const facts = realConstWrites();
    const flip34 = facts.find((f) => f.value === 0x34);
    assert.ok(flip34, "expected the real capture to carry the $34 (all-RAM) const-write fact");

    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    // Only the $34 fact's own store address is wired to reach $D020 here --
    // the real capture's `.prg`-route REFERENCES section cannot itself prove
    // reachability (the internal jsr defect this fixture's own README
    // records), so the control-flow edge is authored directly via the
    // store's own putXref(), matching the REAL, measured address trace.
    putXref(handle, { fromAddress: flip34!.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });

    const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, REAL_ENTRIES);
    const decision = decisions.find((d) => d.address === 0xd020);
    assert.equal(decision!.outcome, "annotated");
    assert.notEqual(decision!.label, "Border color (only bits #0-#3)");
    assert.notEqual(decision!.label, "Border Color");

    const region = resolveBankedRegion(0xd020, decodeBankState(0x34));
    assert.equal(region, "ram");
    const expected = selectMemmapEntry(0xd020, REAL_ENTRIES.filter((e) => regionAdmitsEntry(e, region)));
    assert.ok(expected, "expected the RAM-constrained candidate set at $D020 to have SOMETHING to say -- has the map drifted?");
    assert.equal(decision!.label, expected.entry.label, "the case names the label it IS");
    closeStore(handle);
  });
});

test("driven from the same capture: the shared subroutine's sprite-0-X-register read resolves under the character-ROM value ($33) to a comment whose label is NOT the sprite-0-X label", () => {
  inTempDir((dir) => {
    const facts = realConstWrites();
    const flip33 = facts.find((f) => f.value === 0x33);
    assert.ok(flip33, "expected the real capture to carry the $33 (character-ROM) const-write fact");

    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    putXref(handle, { fromAddress: flip33!.storeAddress, toAddress: 0xd000, accessKind: "COMPUTED_JUMP" });

    const { decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, REAL_ENTRIES);
    const decision = decisions.find((d) => d.address === 0xd000);
    assert.equal(decision!.outcome, "annotated");
    assert.notEqual(decision!.label, "Sprite #0 X-coordinate (only bits #0-#7)");
    assert.notEqual(decision!.label, "Sprite O X Pos");

    const region = resolveBankedRegion(0xd000, decodeBankState(0x33));
    assert.equal(region, "character_rom");
    const expected = selectMemmapEntry(0xd000, REAL_ENTRIES.filter((e) => regionAdmitsEntry(e, region)));
    assert.ok(expected, "expected the Character-ROM-constrained candidate set at $D000 to have SOMETHING to say -- has the map drifted?");
    assert.equal(decision!.label, expected.entry.label, "the case names the label it IS");
    closeStore(handle);
  });
});

test("the committed, unmutated join produces DIFFERENT annotations at the two flip addresses under their respective single reaching values -- the flip is real, not a coincidence of one test's own setup", () => {
  inTempDir((dir) => {
    const facts = realConstWrites();
    const flip34 = facts.find((f) => f.value === 0x34)!;
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    putXref(handle, { fromAddress: flip34.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
    const { decisions: ramRun } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, REAL_ENTRIES);
    closeStore(handle);

    const dir2 = join(dir, "second");
    mkdirSync(dir2);
    const handle2 = openStore(join(dir2, "proj.annostore"), { workspaceRoot: dir2 });
    const flip33 = facts.find((f) => f.value === 0x33)!;
    putXref(handle2, { fromAddress: flip33.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
    const { decisions: charRomRun } = runMemmapJoin(handle2, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, REAL_ENTRIES);
    closeStore(handle2);

    const ramLabel = ramRun.find((d) => d.address === 0xd020)!.label;
    const charRomLabel = charRomRun.find((d) => d.address === 0xd020)!.label;
    assert.notEqual(ramLabel, charRomLabel, "the SAME address must annotate DIFFERENTLY under the two different recovered processor-port values");
  });
});

// ---------------------------------------------------------------------------
// The axis-qualified provenance addition (D-37-25): before the digest, after
// the label, digest still last.
// ---------------------------------------------------------------------------

test("an annotated address in a bank-conditional range carries the axis-qualified processor-port state in its comment, positioned before the map digest token, with the digest still last", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    const entries: MemmapEntry[] = [
      { start: 0xa000, end: 0xa000, label: "Synthetic BASIC ROM entry", section: "$A000-$BFFF BASIC ROM", desc: "", src: "test" },
    ];
    putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
    runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x10, constWrites: [{ storeAddress: 0x1000, targetAddress: 0x0001, value: 0x03 }] },
      entries,
    );
    const [comment] = listComments(handle);
    assert.ok(comment, "expected exactly one comment row");
    assert.match(comment!.text, BANK_PROVENANCE_RE, comment!.text);
    assert.match(comment!.text, PROVENANCE_TOKEN_RE, comment!.text);
    const bankIdx = comment!.text.search(BANK_PROVENANCE_RE);
    const digestIdx = comment!.text.search(new RegExp(ESCAPED_PROVENANCE_TOKEN_PREFIX));
    assert.ok(bankIdx >= 0 && digestIdx >= 0 && bankIdx < digestIdx, "expected the bank marker to precede the digest token");
    assert.ok(comment!.text.endsWith(comment!.text.match(PROVENANCE_TOKEN_RE)![0]), "expected the digest token to still be last");
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// D-37-25 restated: the reserved store column stays null even for the rows
// this plan's own tests write.
// ---------------------------------------------------------------------------

test("bank-conditional annotations still leave the store's reserved bank column null", () => {
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    const entries: MemmapEntry[] = [
      { start: 0xa000, end: 0xa000, label: "Synthetic BASIC ROM entry", section: "$A000-$BFFF BASIC ROM", desc: "", src: "test" },
    ];
    putXref(handle, { fromAddress: 0x1000, toAddress: 0xa000, accessKind: "COMPUTED_JUMP" });
    runMemmapJoin(
      handle,
      { imageOrigin: 0x0801, imageByteLength: 0x10, constWrites: [{ storeAddress: 0x1000, targetAddress: 0x0001, value: 0x03 }] },
      entries,
    );
    const [comment] = listComments(handle);
    assert.equal(comment!.bank, null);
    closeStore(handle);
  });
});

// ---------------------------------------------------------------------------
// regionAdmitsEntry() -- a direct unit case per region, over hand-built
// entries, so the consistency table's own behaviour is pinned independent
// of the join.
// ---------------------------------------------------------------------------

test("regionAdmitsEntry(): matches io_area/character_rom/basic_rom/kernal_rom via the structured section field, and ram via a whole-word label match", () => {
  const io: MemmapEntry = { start: 0xd020, end: 0xd020, label: "Border Color", section: "MOS 6566 VIDEO INTERFACE CONTROLLER (VIC)", desc: "", src: "test" };
  const charRom: MemmapEntry = { start: 0xd000, end: 0xd7ff, label: "Characters", section: "$D000-$DFFF, 53248-57343 Character ROM", desc: "", src: "test" };
  const basic: MemmapEntry = { start: 0xa000, end: 0xbfff, label: "BASIC", section: "$A000-$BFFF, 40960-49151 BASIC ROM", desc: "", src: "test" };
  const kernal: MemmapEntry = { start: 0xe000, end: 0xffff, label: "KERNAL", section: "$E000-$FFFF, 57344-65535 KERNAL ROM", desc: "", src: "test" };
  const ram: MemmapEntry = { start: 0xd020, end: 0xd020, label: "I/O Area or RAM area", section: "$D000-$DFFF, 53248-57343 I/O Area", desc: "", src: "test" };
  const unrelated: MemmapEntry = { start: 0xd020, end: 0xd020, label: "6566 Video Interface Chip, VIC II", section: "C64 memory map (labelled)", desc: "", src: "test" };

  assert.equal(regionAdmitsEntry(io, "io_area"), true);
  assert.equal(regionAdmitsEntry(charRom, "character_rom"), true);
  assert.equal(regionAdmitsEntry(basic, "basic_rom"), true);
  assert.equal(regionAdmitsEntry(kernal, "kernal_rom"), true);
  assert.equal(regionAdmitsEntry(ram, "ram"), true);
  // A map entry matching no region member is EXCLUDED, never silently admitted.
  assert.equal(regionAdmitsEntry(unrelated, "io_area"), false, "D-37-22: an entry matching no region member must be excluded, not admitted");
  assert.equal(regionAdmitsEntry(unrelated, "ram"), false);
});

// ---------------------------------------------------------------------------
// Phase 37, plan 37-06, Task 2 -- Control: bypassing the processor-port
// decode reddens the two-value flip (37-VALIDATION.md Observed-Red Controls
// row 5). The mutation lives in a SCRATCH COPY of `anno-bank.ts` ONLY; the
// committed module is never opened for writing by this file
// (`.planning/research/PITFALLS.md` Pitfall 23 -- a red observation is its
// own committed deliverable, never batched with the fix that makes it
// green).
// ---------------------------------------------------------------------------

/** `decodeBankState()`'s committed form, held verbatim so the mutation below
 * is a single, exact, whole-function textual replacement -- copied
 * character-for-character from `anno-bank.ts` at plan time. */
const FIXED_DECODE_BANK_STATE = `export function decodeBankState(value: number): BankState {
  const raw = value;
  const b = value & 0x07; // bits #2-#0: CHAREN(2) HIRAM(1) LORAM(0)
  const bits10 = b & 0x03;
  const bit2Set = (b & 0x04) !== 0;

  const ioRange: BankedRegion = bits10 === 0 ? "ram" : bit2Set ? "io_area" : "character_rom";
  const basicRange: BankedRegion = bits10 === 0x03 ? "basic_rom" : "ram";
  const kernalRange: BankedRegion = (b & 0x02) !== 0 ? "kernal_rom" : "ram";

  return { raw, ioRange, basicRange, kernalRange };
}`;

/** The bypassed form: ignores the processor port value entirely and always
 * reports the SAME region at every range, exactly as an implementation that
 * forgot to decode `$01` at all would. */
const BYPASSED_DECODE_BANK_STATE = `export function decodeBankState(value: number): BankState {
  const raw = value;
  // BYPASS (planted violation, plan 37-06 Task 2): ignores the processor
  // port entirely and always reports the same region.
  return { raw, ioRange: "io_area", basicRange: "basic_rom", kernalRange: "kernal_rom" };
}`;

/** Builds a scratch tree holding a MUTATED copy of `anno-bank.ts` (the bit
 * decode bypassed, nothing else touched), an UNMUTATED copy of
 * `anno-join.ts` (so the full pipeline -- not just the decode function in
 * isolation -- is what is actually observed going wrong), and re-export
 * shims for `anno-join.ts`'s other two sibling imports (`anno-store.ts`,
 * `memmap-lookup.ts`), so the scratch join calls the exact same real store
 * and memmap-lookup functions this test file itself uses statically.
 * Asserts the committed `anno-bank.ts` still carries the exact decode text
 * before mutating, so source drift fails loudly rather than making the
 * replacement a silent no-op. */
function buildScratchTreeWithBypassedDecode(): { tmpDir: string; modulePath: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "anno-bank-bypass-"));

  const committedBankSource = readFileSync(REAL_ANNO_BANK_PATH, "utf8");
  assert.ok(
    committedBankSource.includes(FIXED_DECODE_BANK_STATE),
    "expected the committed anno-bank.ts to still carry decodeBankState()'s committed form -- has the source drifted?",
  );
  const mutatedBankSource = committedBankSource.replace(FIXED_DECODE_BANK_STATE, BYPASSED_DECODE_BANK_STATE);
  assert.ok(!mutatedBankSource.includes(FIXED_DECODE_BANK_STATE), "expected the committed decode text to be gone from the mutated source");
  writeFileSync(join(tmpDir, "anno-bank.ts"), mutatedBankSource, "utf8");

  writeFileSync(join(tmpDir, "anno-join.ts"), readFileSync(REAL_ANNO_JOIN_PATH, "utf8"), "utf8");
  writeFileSync(join(tmpDir, "anno-store.ts"), `export * from ${JSON.stringify(REAL_ANNO_STORE_PATH)};\n`, "utf8");
  writeFileSync(join(tmpDir, "memmap-lookup.ts"), `export * from ${JSON.stringify(REAL_MEMMAP_LOOKUP_PATH)};\n`, "utf8");
  writeFileSync(join(tmpDir, "anno-graphics.ts"), `export * from ${JSON.stringify(REAL_ANNO_GRAPHICS_PATH)};\n`, "utf8");

  return { tmpDir, modulePath: join(tmpDir, "anno-join.ts") };
}

async function importScratchAnnoJoinWithBypassedBank(modulePath: string): Promise<{ runMemmapJoin: typeof runMemmapJoin }> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as { runMemmapJoin: typeof runMemmapJoin };
}

/** Runs one single-reaching-value join over the real captured export's
 * const-write facts, wiring exactly ONE store address to `$D020` via
 * `putXref()`, and returns the resulting comment's label. Shared by both the
 * committed and the mutated observations below so neither duplicates the
 * store setup. */
function labelForSingleValueRun(runJoin: typeof runMemmapJoin, storeAddress: number, facts: readonly ConstWriteFact[]): string | undefined {
  let label: string | undefined;
  inTempDir((dir) => {
    const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
    putXref(handle, { fromAddress: storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
    const { decisions } = runJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, loadMemmap());
    label = decisions.find((d) => d.address === 0xd020)?.label;
    closeStore(handle);
  });
  return label;
}

test(
  "PLANTED VIOLATION: bypassing decodeBankState() makes the $34/$33 flip stop changing the annotation, and the border-colour write is now labelled the border colour",
  async () => {
    const facts = realConstWrites();
    const flip34 = facts.find((f) => f.value === 0x34)!;
    const flip33 = facts.find((f) => f.value === 0x33)!;

    // ---- THE COMMITTED MODULE (statically imported, unmutated) ----
    const committedRamLabel = labelForSingleValueRun(runMemmapJoin, flip34.storeAddress, facts);
    const committedCharRomLabel = labelForSingleValueRun(runMemmapJoin, flip33.storeAddress, facts);
    assert.notEqual(
      committedRamLabel,
      committedCharRomLabel,
      "expected the COMMITTED module to still produce DIFFERENT annotations at $D020 under the two values",
    );

    // ---- THE MUTATED MODULE (dynamically imported scratch copy, decode bypassed) ----
    const { tmpDir, modulePath } = buildScratchTreeWithBypassedDecode();
    try {
      const mutated = await importScratchAnnoJoinWithBypassedBank(modulePath);
      const bypassedRamLabel = labelForSingleValueRun(mutated.runMemmapJoin, flip34.storeAddress, facts);
      const bypassedCharRomLabel = labelForSingleValueRun(mutated.runMemmapJoin, flip33.storeAddress, facts);

      assert.equal(
        bypassedRamLabel,
        "Border color (only bits #0-#3)",
        "expected the bypass to make $D020 read as the border colour regardless of the recovered value",
      );
      assert.equal(
        bypassedRamLabel,
        bypassedCharRomLabel,
        "expected the bypass to make the two values produce the SAME annotation -- the flip has stopped",
      );
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);

// ---------------------------------------------------------------------------
// Phase 37, plan 37-06, Task 3 -- Control: replacing the decline with a
// forward-carried value reddens the path-dependent case (37-VALIDATION.md
// Observed-Red Controls row 6; AUTO-05, the phase's sixth and last required
// control). The mutation lives in a SCRATCH COPY of `anno-join.ts` ONLY.
// ---------------------------------------------------------------------------

/** The decline branch's committed text (the "several values resolving to
 * different regions" case) -- the single, small, textually-replaceable
 * region of source Task 1 built exactly for this control. Copied
 * character-for-character from `anno-join.ts` at plan time. */
const FIXED_DECLINE_BLOCK_LINES = [
  "      if (uniqueRegions.size > 1) {",
  "        declined += 1;",
  '        const named = uniqueValues.map((value, i) => `$${value.toString(16)}(${regionsByValue[i]})`).join(", ");',
  "        decisions.push({",
  "          address,",
  '          outcome: "declined",',
  '          reason: `$${address.toString(16)} is reached under disagreeing processor-port values: ${named}`,',
  "        });",
  "        continue;",
  "      }",
];
const FIXED_DECLINE_BLOCK = FIXED_DECLINE_BLOCK_LINES.join("\n");

/** The forward-carry replacement: takes the FIRST (ascending) reaching value
 * and annotates with its own region, exactly as an implementation that
 * carried a single bank value forward past a disagreement would. */
const FORWARD_CARRIED_DECLINE_BLOCK_LINES = [
  "      if (uniqueRegions.size > 1) {",
  '        const region = regionsByValue[0]! as Exclude<BankedRegion, "not_applicable">;',
  '        annotateUnderRegion(region, `$${uniqueValues[0]!.toString(16)}`);',
  "        continue;",
  "      }",
];
const FORWARD_CARRIED_DECLINE_BLOCK = FORWARD_CARRIED_DECLINE_BLOCK_LINES.join("\n");

/** Builds a scratch tree holding a MUTATED copy of `anno-join.ts` (the
 * decline branch replaced, nothing else touched) and re-export shims for ALL
 * THREE of its sibling imports (`anno-bank.ts`, `anno-store.ts`,
 * `memmap-lookup.ts`), forwarding by absolute path to the real, unmutated
 * files -- neither `anno-bank.ts` nor its own siblings need mutating for
 * this control, only resolving. */
function buildScratchTreeWithForwardCarriedDecline(): { tmpDir: string; modulePath: string } {
  const tmpDir = mkdtempSync(join(tmpdir(), "anno-join-forward-carry-"));

  const committedJoinSource = readFileSync(REAL_ANNO_JOIN_PATH, "utf8");
  assert.ok(
    committedJoinSource.includes(FIXED_DECLINE_BLOCK),
    "expected the committed anno-join.ts to still carry the decline branch's committed text -- has the source drifted?",
  );
  const mutatedJoinSource = committedJoinSource.replace(FIXED_DECLINE_BLOCK, FORWARD_CARRIED_DECLINE_BLOCK);
  assert.ok(!mutatedJoinSource.includes(FIXED_DECLINE_BLOCK), "expected the committed decline text to be gone from the mutated source");
  writeFileSync(join(tmpDir, "anno-join.ts"), mutatedJoinSource, "utf8");

  writeFileSync(join(tmpDir, "anno-bank.ts"), `export * from ${JSON.stringify(REAL_ANNO_BANK_PATH)};\n`, "utf8");
  writeFileSync(join(tmpDir, "anno-store.ts"), `export * from ${JSON.stringify(REAL_ANNO_STORE_PATH)};\n`, "utf8");
  writeFileSync(join(tmpDir, "memmap-lookup.ts"), `export * from ${JSON.stringify(REAL_MEMMAP_LOOKUP_PATH)};\n`, "utf8");
  writeFileSync(join(tmpDir, "anno-graphics.ts"), `export * from ${JSON.stringify(REAL_ANNO_GRAPHICS_PATH)};\n`, "utf8");

  return { tmpDir, modulePath: join(tmpDir, "anno-join.ts") };
}

async function importScratchAnnoJoinWithForwardCarry(modulePath: string): Promise<{ runMemmapJoin: typeof runMemmapJoin }> {
  return (await import(`${modulePath}?t=${Date.now()}-${Math.random()}`)) as { runMemmapJoin: typeof runMemmapJoin };
}

test(
  "PLANTED VIOLATION: replacing the decline branch with a forward-carried value produces an annotation where the committed code correctly stays silent",
  async () => {
    const facts = realConstWrites();
    const flip34 = facts.find((f) => f.value === 0x34)!;
    const flip33 = facts.find((f) => f.value === 0x33)!;

    // ---- THE COMMITTED MODULE: both values reach $D020, disagreeing regions -> decline ----
    let committedDecision: { outcome: string; reason?: string; label?: string } | undefined;
    let committedDeclinedCount = 0;
    inTempDir((dir) => {
      const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
      putXref(handle, { fromAddress: flip34.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
      putXref(handle, { fromAddress: flip33.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
      const { counts, decisions } = runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, loadMemmap());
      committedDecision = decisions.find((d) => d.address === 0xd020);
      committedDeclinedCount = counts.declined;
      closeStore(handle);
    });
    assert.equal(committedDecision?.outcome, "declined");
    assert.ok(
      committedDecision?.reason && /33/.test(committedDecision.reason) && /34/.test(committedDecision.reason),
      committedDecision?.reason,
    );
    assert.equal(committedDeclinedCount, 1);

    // ---- THE MUTATED MODULE: forward-carries the FIRST (ascending) value instead ----
    const { tmpDir, modulePath } = buildScratchTreeWithForwardCarriedDecline();
    try {
      const mutated = await importScratchAnnoJoinWithForwardCarry(modulePath);
      let mutatedDecision: { outcome: string; reason?: string; label?: string } | undefined;
      let mutatedCommentCount = 0;
      inTempDir((dir) => {
        const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
        putXref(handle, { fromAddress: flip34.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
        putXref(handle, { fromAddress: flip33.storeAddress, toAddress: 0xd020, accessKind: "COMPUTED_JUMP" });
        const { decisions } = mutated.runMemmapJoin(handle, { imageOrigin: 0x0801, imageByteLength: 0x30, constWrites: facts }, loadMemmap());
        mutatedDecision = decisions.find((d) => d.address === 0xd020);
        mutatedCommentCount = listComments(handle).length;
        closeStore(handle);
      });
      assert.equal(mutatedDecision?.outcome, "annotated", "expected the forward-carry mutation to ANNOTATE where the committed code declines");
      assert.equal(mutatedCommentCount, 1, "expected exactly one comment written under the mutation");

      // uniqueValues sorts ascending, so $33 (0x33 < 0x34) is the forward-carried value.
      const expectedRegion = resolveBankedRegion(0xd020, decodeBankState(0x33)) as Exclude<BankedRegion, "not_applicable">;
      const expectedSelection = selectMemmapEntry(0xd020, loadMemmap().filter((e) => regionAdmitsEntry(e, expectedRegion)));
      assert.ok(expectedSelection, "expected the character-ROM-constrained candidate set at $D020 to have SOMETHING to say");
      assert.equal(mutatedDecision?.label, expectedSelection.entry.label, "the case names the label the forward-carried value produces");
    } finally {
      rmSync(tmpDir, { recursive: true, force: true });
    }
  },
);
