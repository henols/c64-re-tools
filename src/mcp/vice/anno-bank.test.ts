// anno-bank.test.ts -- Phase 37 plan 37-06, Task 1 (AUTO-04/AUTO-05): the
// processor-port bit decode, the region resolution, and the decline. Every
// `<behavior>` bullet below is written FIRST and observed to fail before the
// implementation in `anno-bank.ts` / `anno-join.ts` exists, per this plan's
// own TDD instruction.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { decodeBankState, isBankConditionalAddress, regionAdmitsEntry, resolveBankedRegion } from "./anno-bank.ts";
import { closeStore, listComments, openStore, putXref } from "./anno-store.ts";
import { parseConstWrites, parseGhidraExport } from "./anno-import.ts";
import { runMemmapJoin } from "./anno-join.ts";
import { loadMemmap, PROVENANCE_TOKEN_PREFIX, selectMemmapEntry } from "./memmap-lookup.ts";
import type { MemmapEntry } from "./memmap-lookup.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const REAL_CAPTURE_PATH = join(HERE, "fixtures", "ghidra", "export-bank-path-dependent.txt");

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
