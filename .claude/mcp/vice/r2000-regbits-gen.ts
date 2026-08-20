#!/usr/bin/env node
// r2000-regbits-gen.ts -- the ONE authoritative place in this repo that turns
// c64-memory-mapping's memmap.json into the curated address->bit-name table
// r2000-enum-gen.ts decodes register values against (D-22, R2000-13).
//
// WHY THIS EXISTS (D-22): neither register the phase's own pinned criterion-3
// target needs ($D011) nor the registers a real game writes to constantly
// ($D015/$D017/$D01A-$D01D) can be named from memmap.json's own `bits` prose
// alone -- some of that prose is OCR-damaged ("O = Blank" uses a letter O for
// the digit 0; "Read NMls" uses a lowercase L for an uppercase I), and five
// addresses have NO `bits` entry in memmap.json at all (its `io` parser never
// produced one for them; widening memmap.json itself is separate work
// belonging to `c64-memory-mapping`, not this phase). `OVERRIDES` below is
// the curated fix for both problems, carrying a WHY comment on every entry
// so a future reader never has to guess why a bit was hand-named instead of
// mechanically derived.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: reading memmap.json's 29
// structured `bits` entries, normalising each `bits[].bit` range string into
// `{mask, shift}`, deriving (or overriding) a legal ACME identifier for every
// field, and emitting the committed, banner-marked `r2000-regbits.json`
// artifact `r2000-enum-gen.ts` decodes against. No other module may read
// memmap.json for this purpose or hand-maintain a second bit-name table.
//
// KEY-SHAPE DECISION: table keys are `$XXXX` (uppercase, 4-hex-digit,
// dollar-prefixed) strings, not decimal numbers -- this matches how every
// register in this project's own assembly/documentation conventions is
// named (`$D011`, not `53265`), and because every key is the same fixed
// width, `Object.keys(table).sort()` on the STRING keys already produces the
// same order as sorting the underlying addresses numerically, so no separate
// numeric-sort step is needed to keep the emitted JSON diff-stable.
//
// WHAT NOT TO DO, named concretely:
//   - Never hand-edit r2000-regbits.json. It is a generated-but-committed
//     artifact (ENGINEERING_RULES.md Sec 11), the same shape
//     `resources-sync.test.ts` already established for compiled `.mjs`
//     build output -- re-run `node r2000-regbits-gen.ts` and let the drift
//     guard in r2000-regbits.test.ts confirm the result matches.
//   - Never silently skip or placeholder an unmappable bit description.
//     `buildRegBits()` THROWS, naming the address, the bit range and the
//     offending description, when mechanical derivation fails AND no
//     OVERRIDES entry covers it -- the difference between a curated table
//     and an implicit one is exactly this refusal.
//   - Never emit a timestamp into the banner. The drift guard's whole
//     comparison (`buildRegBits()` re-run in memory vs. the committed file)
//     is only TOTAL because nothing in the emitted document changes between
//     two runs against the same memmap.json bytes.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The sole read of c64-memory-mapping's own memmap.json -- this generator is
 * its only consumer for this purpose (per this plan's key_links entry). */
const MEMMAP_PATH = join(HERE, "..", "..", "skills", "c64-memory-mapping", "memmap.json");

/** Where the generated, committed artifact lives -- always a sibling of this
 * generator, never a caller-supplied path. */
const OUTPUT_PATH = join(HERE, "r2000-regbits.json");

export type FieldKind = "flag" | "numeric" | "enum";

export interface RegBitsField {
  mask: number;
  shift: number;
  name: string;
  kind: FieldKind;
  /** Present only for "flag"/"enum" fields whose decoded value maps to a
   * specific token string. A field silent-by-design in one state (e.g. a
   * "the bit only matters when set" flag like ECM/RST8 below) still carries
   * an EXPLICIT entry for that state -- an empty string, never an absent
   * key -- so decoding never has to guess whether an omission was
   * deliberate. */
  tokens?: Record<number, string>;
}

export interface RegBitsEntry {
  label: string;
  fields: RegBitsField[];
}

export type RegBitsTable = Record<string, RegBitsEntry>;

const ACME_IDENT_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

interface MemmapBit {
  bit: string;
  desc: string;
}

interface MemmapEntry {
  start: number;
  end: number;
  label?: string | null;
  desc?: string;
  bits?: MemmapBit[];
}

interface MemmapFile {
  sources: unknown[];
  entries: MemmapEntry[];
}

/**
 * Parses a memmap `bits[].bit` string into `{mask, shift}`. Handles a single
 * index ("7"), a descending range ("2-0") and an ascending range ("6-7") --
 * both range forms appear in memmap.json's real data, and the result is
 * identical either way since a bit RANGE has no inherent direction; only the
 * high/low bounds matter for the mask this produces.
 */
export function parseBitRange(bitStr: string): { mask: number; shift: number } {
  const parts = bitStr.split("-").map((s) => Number.parseInt(s.trim(), 10));
  if (parts.length === 1) {
    const bit = parts[0]!;
    return { mask: 1 << bit, shift: bit };
  }
  const [a, b] = parts as [number, number];
  const hi = Math.max(a, b);
  const lo = Math.min(a, b);
  const width = hi - lo + 1;
  return { mask: ((1 << width) - 1) << lo, shift: lo };
}

/**
 * Mechanically derives an ACME-legal identifier from a memmap bit
 * description: drops parenthetical asides, uppercases, replaces every
 * non-alphanumeric run with a single underscore, and trims leading/trailing
 * underscores. Returns `null` (never throws) when the result is empty or
 * still not a legal identifier -- the caller decides whether to consult
 * `OVERRIDES` or throw; this function's job is only the mechanical half of
 * that decision.
 */
export function deriveIdentifier(desc: string): string | null {
  let s = desc.replace(/\([^)]*\)/g, " ");
  s = s.toUpperCase();
  s = s.replace(/[^A-Z0-9]+/g, "_");
  s = s.replace(/^_+|_+$/g, "");
  if (s === "") return null;
  if (!ACME_IDENT_RE.test(s)) return null;
  return s;
}

export interface RegbitsFieldOverride {
  /** Must match a memmap `bits[].bit` string EXACTLY (e.g. "2-0", "4"). */
  bit: string;
  name: string;
  kind: FieldKind;
  tokens?: Record<number, string>;
}

export interface RegbitsRegisterOverride {
  address: number;
  /** Overrides memmap's own `label` for this address (OCR-damage fix). */
  label?: string;
  /** Per-bit overrides, matched against this address's own memmap `bits`
   * entries by their `bit` string. */
  fields?: readonly RegbitsFieldOverride[];
  /** A COMPLETE field list for an address memmap.json's `io` parser produced
   * no `bits` entry for at all (D-22's known gap) -- used only when no
   * memmap entry exists for this address, never to replace one that does. */
  synthetic?: readonly RegBitsField[];
}

/** Builds the 8 independent "bit N = sprite N" flag fields the five VIC
 * sprite-plane registers ($D015/$D017/$D01B/$D01C/$D01D) all share the same
 * shape for (D-22's named gap) -- each bit is silent (empty token) when
 * clear and names the specific sprite when set, so a typical enum (most
 * sprites off, one or two on) renders as a short, readable name instead of
 * naming all eight sprites' negative state every time.
 */
function spriteBitFields(suffix: string): RegBitsField[] {
  const fields: RegBitsField[] = [];
  for (let n = 0; n < 8; n++) {
    fields.push({
      mask: 1 << n,
      shift: n,
      name: `SPR${n}${suffix}`,
      kind: "flag",
      tokens: { 0: "", 1: `SPR${n}${suffix}` },
    });
  }
  return fields;
}

// ---------------------------------------------------------------------------
// OVERRIDES -- every entry carries its own WHY comment immediately above it
// (r2000-regbits.test.ts's own non-vacuity check counts these two things
// against each other, so removing a comment without removing its entry, or
// vice versa, fails a test rather than silently drifting).
// ---------------------------------------------------------------------------

export const OVERRIDES: readonly RegbitsRegisterOverride[] = [
  {
    address: 53265, // $D011 -- VIC Control Register 1, this phase's pinned criterion-3 target
    fields: [
      // WHY: memmap's own prose ("Smooth Scroll to Y Dot-Position (0-7)") reads as a sentence, not
      // a compact field name; mechanical derivation would bake the whole sentence into the
      // identifier instead of the short numeric field the pinned criterion-3 target needs
      // (YSCROLL3, not SMOOTH_SCROLL_TO_Y_DOT_POSITION3).
      { bit: "2-0", name: "YSCROLL", kind: "numeric" },
      // WHY: OCR damage -- "O = Blank" uses a letter O for the digit 0, and the raw prose reads as
      // a NEGATIVE ("0 = Blank" the screen, i.e. bit=0 blanks it) rather than the positive
      // "is the screen on" framing this table wants. This override fixes both problems in one
      // place: the OCR-damaged letter, and the polarity, landing on the pinned SCREENON name.
      { bit: "4", name: "SCREENON", kind: "flag", tokens: { 0: "SCREENOFF", 1: "SCREENON" } },
      // WHY: memmap's prose ("Select 24/25 Row Text Display: 1 = 25 Rows") mixes the field name
      // with its own value table; this override extracts the clean ROW24/ROW25 pair the pinned
      // criterion-3 target needs instead of a mechanical transcription of the whole sentence.
      { bit: "3", name: "ROWS", kind: "flag", tokens: { 0: "ROW24", 1: "ROW25" } },
      // WHY: same shape as ROWS above -- "Bit Map Mode. 1 = Enable" is this register's other
      // genuinely-binary choice (text vs. bitmap), and both states are equally meaningful, so both
      // get a name rather than one state being silent.
      { bit: "5", name: "MODE", kind: "flag", tokens: { 0: "TEXT", 1: "BITMAP" } },
      // WHY: Extended Color Mode is off in the overwhelming majority of real programs' writes to
      // this register; naming only the "on" state (silent when clear, via an explicit empty-string
      // token for 0 -- never an absent key) keeps a typical generated variant name short rather
      // than always appending "_ECMOFF" to every single value.
      { bit: "6", name: "ECM", kind: "flag", tokens: { 0: "", 1: "ECM" } },
      // WHY: same reasoning as ECM -- bit 8 of the raster compare value is only interesting when
      // set (a compare line past 255), so the clear state is silent by design, not a dropped token.
      { bit: "7", name: "RST8", kind: "flag", tokens: { 0: "", 1: "RST8" } },
    ],
  },
  {
    // WHY: OCR damage -- memmap's own label reads "Read NMls" (a lowercase L in place of an
    // uppercase I). This is the register's LABEL, not a field name, so it is fixed here rather
    // than via a per-bit override.
    address: 56589, // $DD0D -- CIA2 Interrupt Control Register
    label: "CIA Interrupt Control Register (Read NMIs/Write Mask)",
  },
  {
    // WHY: memmap.json's `io` parser produced no `bits` entry at all for this address (D-22's
    // named gap) even though a real game writes to it constantly -- sprite enable, one flag bit
    // per sprite, is trivially regular and does not need memmap's own prose to describe correctly.
    address: 53269, // $D015 -- Sprite Enable
    label: "Sprite Enable",
    synthetic: spriteBitFields("EN"),
  },
  {
    // WHY: same D-22 gap as $D015 -- Sprite Y-Expand, one flag bit per sprite.
    address: 53271, // $D017 -- Sprite Y-Expand
    label: "Sprite Y-Expand",
    synthetic: spriteBitFields("YEXP"),
  },
  {
    // WHY: memmap.json's `io` parser produced no `bits` entry for the VIC IRQ mask register at
    // all -- distinct from the VIC Interrupt FLAG register at $D019, which memmap.json does cover.
    // Named per-bit since each bit enables a DIFFERENT interrupt source, not a repeated pattern.
    address: 53274, // $D01A -- VIC Interrupt Enable (mask) Register
    label: "VIC Interrupt Enable Register",
    synthetic: [
      { mask: 0x01, shift: 0, name: "RSTIRQEN", kind: "numeric" },
      { mask: 0x02, shift: 1, name: "SPRBGIRQEN", kind: "numeric" },
      { mask: 0x04, shift: 2, name: "SPRSPRIRQEN", kind: "numeric" },
      { mask: 0x08, shift: 3, name: "LPIRQEN", kind: "numeric" },
      { mask: 0xf0, shift: 4, name: "IRQENUNUSED", kind: "numeric" },
    ],
  },
  {
    // WHY: same D-22 gap as $D015 -- Sprite Priority (behind/in-front of background), one flag bit
    // per sprite.
    address: 53275, // $D01B -- Sprite Data Priority
    label: "Sprite Data Priority",
    synthetic: spriteBitFields("BG"),
  },
  {
    // WHY: same D-22 gap as $D015 -- Sprite Multicolor, one flag bit per sprite.
    address: 53276, // $D01C -- Sprite Multicolor
    label: "Sprite Multicolor",
    synthetic: spriteBitFields("MC"),
  },
  {
    // WHY: same D-22 gap as $D015 -- Sprite X-Expand, one flag bit per sprite.
    address: 53277, // $D01D -- Sprite X-Expand
    label: "Sprite X-Expand",
    synthetic: spriteBitFields("XEXP"),
  },
];

function findOverride(address: number): RegbitsRegisterOverride | undefined {
  return OVERRIDES.find((o) => o.address === address);
}

/**
 * Builds the field list for one memmap entry, consulting `override` for
 * per-bit name/kind/tokens, falling back to mechanical derivation, and
 * THROWING when neither succeeds (see this module's header). Also
 * deduplicates overlapping bit ranges within a single entry -- two memmap
 * "io" registers (`$DC00`/`$DC01`, the joystick/keyboard data ports) list
 * multiple ALTERNATE readings of the very same bits (e.g. "7-0: keyboard
 * column" and, separately, "4: joystick fire" -- the same physical bits
 * read two different ways depending on what is plugged in), which would
 * otherwise double-count those bits into two overlapping fields. First
 * claim wins (array order); a later entry whose mask intersects an
 * already-claimed one is skipped, never merged or thrown on.
 */
function buildFieldsForEntry(entry: MemmapEntry, override: RegbitsRegisterOverride | undefined): RegBitsField[] {
  const claimed: RegBitsField[] = [];
  for (const b of entry.bits ?? []) {
    const { mask, shift } = parseBitRange(b.bit);
    if (claimed.some((f) => (f.mask & mask) !== 0)) continue;

    const fo = override?.fields?.find((f) => f.bit === b.bit);
    if (fo) {
      const field: RegBitsField = { mask, shift, name: fo.name, kind: fo.kind };
      if (fo.tokens) field.tokens = fo.tokens;
      claimed.push(field);
      continue;
    }

    const name = deriveIdentifier(b.desc);
    if (name === null) {
      throw new Error(
        `buildRegBits: address $${entry.start.toString(16).toUpperCase().padStart(4, "0")} bit "${b.bit}" ` +
          `desc "${b.desc}" did not mechanically derive a legal ACME identifier, and no OVERRIDES entry ` +
          `covers it -- add a fieldOverride for { address: ${entry.start}, bit: "${b.bit}" }.`,
      );
    }
    claimed.push({ mask, shift, name, kind: "numeric" });
  }
  claimed.sort((a, b) => a.shift - b.shift);
  return claimed;
}

function formatAddressKey(address: number): string {
  return `$${address.toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Reads memmap.json, takes every entry with a `bits` array (29 as of this
 * writing), normalises each field, and returns the curated table keyed by
 * `$XXXX` address string, sorted so the result -- and the JSON this module
 * emits from it -- is diff-stable. Synthetic (memmap-absent) registers named
 * in `OVERRIDES` are added afterward, only when memmap produced no entry for
 * that address.
 */
export function buildRegBits(): RegBitsTable {
  const memmap = JSON.parse(readFileSync(MEMMAP_PATH, "utf8")) as MemmapFile;
  const table: RegBitsTable = {};

  for (const entry of memmap.entries) {
    if (!Array.isArray(entry.bits) || entry.bits.length === 0) continue;
    const address = entry.start;
    const override = findOverride(address);
    const key = formatAddressKey(address);
    const label = override?.label ?? entry.label ?? entry.desc ?? key;
    const fields = buildFieldsForEntry(entry, override);
    table[key] = { label, fields };
  }

  for (const override of OVERRIDES) {
    if (!override.synthetic) continue;
    const key = formatAddressKey(override.address);
    if (table[key]) continue; // memmap already produced this address -- synthetic is a fallback only
    table[key] = {
      label: override.label ?? key,
      fields: [...override.synthetic].sort((a, b) => a.shift - b.shift),
    };
  }

  const sorted: RegBitsTable = {};
  for (const key of Object.keys(table).sort()) {
    sorted[key] = table[key]!;
  }
  return sorted;
}

/** SHA-256 hex digest of memmap.json's current bytes -- the banner's own
 * drift-pin (T-11-GEN-DRIFT). */
export function memmapSha256(): string {
  return createHash("sha256").update(readFileSync(MEMMAP_PATH)).digest("hex");
}

export interface RegBitsBanner {
  generator: string;
  memmapSha256: string;
  warning: string;
}

export interface RegBitsDocument {
  _generated: RegBitsBanner;
  [key: string]: unknown;
}

/**
 * Wraps `buildRegBits()`'s table with the first-key banner (generator
 * filename, memmap.json's own digest, a do-not-hand-edit warning) --
 * deliberately no timestamp, so two runs against the same memmap.json bytes
 * produce byte-identical output and the drift guard's comparison stays
 * total.
 */
export function buildRegBitsDocument(): RegBitsDocument {
  const table = buildRegBits();
  const doc: RegBitsDocument = {
    _generated: {
      generator: "r2000-regbits-gen.ts",
      memmapSha256: memmapSha256(),
      warning: "GENERATED FILE -- do not hand-edit. Regenerate via `node r2000-regbits-gen.ts` from .claude/mcp/vice.",
    },
  };
  for (const key of Object.keys(table).sort()) {
    doc[key] = table[key];
  }
  return doc;
}

// Run-as-script: regenerate the committed artifact. Guarded so importing this
// module (e.g. from r2000-regbits.test.ts) never has a write side effect.
const isMain = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url;
if (isMain) {
  const doc = buildRegBitsDocument();
  writeFileSync(OUTPUT_PATH, `${JSON.stringify(doc, null, 2)}\n`);
  console.log(`r2000-regbits-gen: wrote ${OUTPUT_PATH} (${Object.keys(doc).length - 1} registers)`);
}
