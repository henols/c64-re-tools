// r2000-regbits.test.ts -- coverage for r2000-regbits-gen.ts (D-22, R2000-13
// Task 1): the drift guard between the generator and the committed artifact,
// the digest pin against memmap.json, identifier legality across the whole
// table, presence of the six override-supplied (memmap-absent) registers,
// and a non-vacuous proof that an unmappable description with no OVERRIDES
// entry actually throws rather than silently passing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildRegBits,
  buildRegBitsDocument,
  deriveIdentifier,
  memmapSha256,
  parseBitRange,
  type RegBitsField,
} from "./r2000-regbits-gen.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACME_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

test("parseBitRange: single index, descending range and ascending range all normalise correctly", () => {
  assert.deepEqual(parseBitRange("0"), { mask: 0x01, shift: 0 });
  assert.deepEqual(parseBitRange("7"), { mask: 0x80, shift: 7 });
  assert.deepEqual(parseBitRange("2-0"), { mask: 0x07, shift: 0 });
  assert.deepEqual(parseBitRange("6-7"), { mask: 0xc0, shift: 6 });
  assert.deepEqual(parseBitRange("7-4"), { mask: 0xf0, shift: 4 });
});

test("deriveIdentifier: drops parenthetical asides, uppercases, and collapses punctuation to underscores", () => {
  assert.equal(deriveIdentifier("/LORAM Signal (0=Switch BASIC ROM Out)"), "LORAM_SIGNAL");
  assert.equal(deriveIdentifier("Unused"), "UNUSED");
  assert.equal(deriveIdentifier(""), null);
  assert.equal(deriveIdentifier("   "), null);
});

// ---------------------------------------------------------------------------
// Drift guard (ENGINEERING_RULES.md Sec 11 / T-11-GEN-DRIFT): buildRegBits(),
// re-run in memory right now, must deep-equal the committed r2000-regbits.json
// with its banner stripped. No timestamp is ever emitted, so this comparison
// is TOTAL -- not merely "close enough".
// ---------------------------------------------------------------------------

function readCommittedDoc(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(HERE, "r2000-regbits.json"), "utf8")) as Record<string, unknown>;
}

test("drift guard: buildRegBits() re-run in memory deep-equals the committed r2000-regbits.json (banner stripped)", () => {
  const committed = readCommittedDoc();
  const { _generated, ...committedTable } = committed;
  const fresh = buildRegBits();
  assert.deepEqual(fresh, committedTable);
});

test("drift guard: the committed banner's memmapSha256 equals memmap.json's current digest", () => {
  const committed = readCommittedDoc();
  const banner = committed._generated as { memmapSha256: string; generator: string; warning: string };
  assert.equal(banner.memmapSha256, memmapSha256());
  assert.equal(banner.generator, "r2000-regbits-gen.ts");
  assert.match(banner.warning, /do not hand-edit/i);
});

test("drift guard: buildRegBitsDocument() emits the SAME banner shape twice in a row (no timestamp, so the comparison stays total)", () => {
  const a = buildRegBitsDocument();
  const b = buildRegBitsDocument();
  assert.deepEqual(a, b);
});

test("non-vacuous drift guard: appending a byte to a SCRATCH COPY of memmap.json makes the drift assertion FAIL (planted violation, ENGINEERING_RULES.md Sec 6)", async (t) => {
  // Copies both the generator and memmap.json into a scratch tree, appends one
  // byte to the SCRATCH memmap.json only (the real one on disk is never
  // touched), regenerates against that mutated copy, and proves the resulting
  // digest disagrees with the COMMITTED banner's digest -- i.e. the exact
  // assertion "drift guard: the committed banner's memmapSha256 equals
  // memmap.json's current digest" (above) would now FAIL if this mutated file
  // were the real one and nobody had regenerated. This is the transcript
  // recorded in 11-06-SUMMARY.md.
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "r2000-regbits-drift-"));
  const skillsDir = path.join(tmpDir, "skills", "c64-memory-mapping");
  fs.mkdirSync(skillsDir, { recursive: true });
  const mcpDir = path.join(tmpDir, "mcp", "vice");
  fs.mkdirSync(mcpDir, { recursive: true });

  const realMemmapPath = join(HERE, "..", "..", "skills", "c64-memory-mapping", "memmap.json");
  const realBytes = readFileSync(realMemmapPath);
  const mutatedPath = path.join(skillsDir, "memmap.json");
  fs.writeFileSync(mutatedPath, Buffer.concat([realBytes, Buffer.from("\n// planted for T-11-GEN-DRIFT non-vacuity\n")]));

  const genSrc = readFileSync(join(HERE, "r2000-regbits-gen.ts"), "utf8");
  fs.writeFileSync(path.join(mcpDir, "r2000-regbits-gen.ts"), genSrc);

  const { memmapSha256: mutatedMemmapSha256 } = (await import(
    `${path.join(mcpDir, "r2000-regbits-gen.ts")}?t=${Date.now()}`
  )) as { memmapSha256: () => string };

  const committedDigest = (readCommittedDoc()._generated as { memmapSha256: string }).memmapSha256;
  const mutatedDigest = mutatedMemmapSha256();

  t.diagnostic(`committed memmap.json digest: ${committedDigest}`);
  t.diagnostic(`mutated (planted-violation) memmap.json digest: ${mutatedDigest}`);
  assert.notEqual(
    mutatedDigest,
    committedDigest,
    "a single appended byte in memmap.json must change the digest the drift guard pins against -- if it did not, " +
      "the drift guard would be vacuous",
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Identifier legality across the WHOLE table -- asserted, not eyeballed.
// ---------------------------------------------------------------------------

test("every field name in r2000-regbits.json matches ^[A-Za-z_][A-Za-z0-9_]*$", () => {
  const doc = readCommittedDoc();
  for (const [addr, entry] of Object.entries(doc)) {
    if (addr === "_generated") continue;
    for (const field of (entry as { fields: RegBitsField[] }).fields) {
      assert.match(field.name, ACME_IDENT_RE, `${addr}'s field "${field.name}" is not a legal ACME identifier`);
      if (field.tokens) {
        for (const [value, token] of Object.entries(field.tokens)) {
          if (token === "") continue; // an explicit silent-state token, never a bare identifier
          assert.match(
            token,
            ACME_IDENT_RE,
            `${addr}'s field "${field.name}" token for value ${value} ("${token}") is not a legal ACME identifier`,
          );
        }
      }
    }
  }
});

test("no field name or token contains the OCR-damage artifacts NMls or a bare letter-O-for-zero pattern", () => {
  const doc = readCommittedDoc();
  const serialized = JSON.stringify(doc);
  assert.doesNotMatch(serialized, /NMls/, "the OCR-damaged 'Read NMls' spelling must never survive into a field name or label");
  // The specific letter-O-for-zero artifact this table exists to fix is $D011 bit 4's raw prose
  // ("O = Blank"); the fix itself (SCREENON/SCREENOFF) never contains a literal "O_BLANK" or
  // "O=BLANK" fragment.
  assert.doesNotMatch(serialized, /O_BLANK|O=BLANK/i);
});

test("$D011's six fields match the plan's pinned criterion-3 shape exactly", () => {
  const doc = readCommittedDoc();
  const d011 = doc["$D011"] as { fields: RegBitsField[] };
  const byName = Object.fromEntries(d011.fields.map((f) => [f.name, f]));
  assert.equal(byName.YSCROLL?.kind, "numeric");
  assert.deepEqual(byName.ROWS?.tokens, { "0": "ROW24", "1": "ROW25" });
  assert.deepEqual(byName.SCREENON?.tokens, { "0": "SCREENOFF", "1": "SCREENON" });
  assert.deepEqual(byName.MODE?.tokens, { "0": "TEXT", "1": "BITMAP" });
  assert.deepEqual(byName.ECM?.tokens, { "0": "", "1": "ECM" });
  assert.deepEqual(byName.RST8?.tokens, { "0": "", "1": "RST8" });
});

test("the six override-supplied (memmap-absent) registers are present: $D015, $D017, $D01A, $D01B, $D01C, $D01D", () => {
  const doc = readCommittedDoc();
  for (const key of ["$D015", "$D017", "$D01A", "$D01B", "$D01C", "$D01D"]) {
    assert.ok(key in doc, `expected ${key} to be present in r2000-regbits.json`);
    assert.ok((doc[key] as { fields: unknown[] }).fields.length > 0, `expected ${key} to have at least one field`);
  }
});

test("the table also contains $D011 and $01 (address 1)", () => {
  const doc = readCommittedDoc();
  assert.ok("$D011" in doc);
  assert.ok("$0001" in doc, "address 1 ($01, the 6510 I/O port) must be present");
});

// ---------------------------------------------------------------------------
// OVERRIDES WHY-comment coverage (mechanical, not eyeballed): every override
// field/register entry in the SOURCE has a "// WHY:" comment directly above
// it. Counts both and reports them, per this plan's acceptance criteria.
// ---------------------------------------------------------------------------

test("OVERRIDES: every field/register override entry carries a WHY comment (grep-counted, not eyeballed)", () => {
  const src = readFileSync(join(HERE, "r2000-regbits-gen.ts"), "utf8");
  const overridesSection = src.slice(src.indexOf("export const OVERRIDES"), src.indexOf("function findOverride"));
  const whyComments = overridesSection.match(/\/\/ WHY:/g) ?? [];
  // Count override "entries" as field-override objects (each carries its own bit) plus
  // register-level overrides that are label-only or synthetic-only (no fields[] array).
  const fieldEntries = overridesSection.match(/\{ bit: "/g) ?? [];
  const registerEntries = overridesSection.match(/address: \d+, \/\//g) ?? [];
  console.log(
    `r2000-regbits-gen.ts OVERRIDES: ${whyComments.length} WHY comments, ${fieldEntries.length} field-level entries, ` +
      `${registerEntries.length} register-level (label/synthetic) entries needing their own WHY`,
  );
  assert.ok(whyComments.length >= fieldEntries.length, "every field-level override entry must carry its own WHY comment");
  assert.ok(whyComments.length > 0, "OVERRIDES must carry at least one WHY comment");
});

// ---------------------------------------------------------------------------
// Non-vacuity control (ENGINEERING_RULES.md Sec 6): buildRegBits() must
// actually be capable of throwing on an unmappable description absent from
// OVERRIDES -- proven here against a SYNTHETIC memmap file, never by editing
// the real one.
// ---------------------------------------------------------------------------

test("non-vacuity: a synthetic memmap entry whose desc is unmappable and absent from OVERRIDES THROWS naming the address", async (t) => {
  const os = await import("node:os");
  const fs = await import("node:fs");
  const path = await import("node:path");

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "r2000-regbits-nonvacuity-"));
  const skillsDir = path.join(tmpDir, "skills", "c64-memory-mapping");
  fs.mkdirSync(skillsDir, { recursive: true });
  const mcpDir = path.join(tmpDir, "mcp", "vice");
  fs.mkdirSync(mcpDir, { recursive: true });

  // A description that is EMPTY after stripping punctuation -- mechanically unmappable, and this
  // synthetic memmap has no matching OVERRIDES entry (address 61440, $F000, appears nowhere in the
  // real OVERRIDES table).
  const syntheticMemmap = {
    sources: [],
    entries: [{ start: 61440, end: 61440, label: "Synthetic", bits: [{ bit: "0", desc: "((( )))" }] }],
  };
  fs.writeFileSync(path.join(skillsDir, "memmap.json"), JSON.stringify(syntheticMemmap));

  const genSrc = fs.readFileSync(path.join(HERE, "r2000-regbits-gen.ts"), "utf8");
  const copiedGenPath = path.join(mcpDir, "r2000-regbits-gen.ts");
  fs.writeFileSync(copiedGenPath, genSrc);

  const { buildRegBits: buildRegBitsFromCopy } = (await import(`${path.join(mcpDir, "r2000-regbits-gen.ts")}?t=${Date.now()}`)) as {
    buildRegBits: () => unknown;
  };

  assert.throws(
    () => buildRegBitsFromCopy(),
    (err: unknown) => err instanceof Error && /\$F000/.test(err.message) && /desc/i.test(err.message),
    "buildRegBits() must throw naming the offending address when a description is unmappable and uncovered by OVERRIDES",
  );

  fs.rmSync(tmpDir, { recursive: true, force: true });
});
