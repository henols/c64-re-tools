// capture-predicate.ts -- the ONE authoritative place in this repo holding the
// RUN-EQUIVALENCE predicate for two flat 64K captures: the enumerated
// transient allow-list and its committed size cap, the `$0000`/`$0001`
// 6510-port normalisation, the byte-by-byte comparison that decides
// equivalence, and the argv identity digest a reproducible run is keyed by.
//
// CONSUMER STATUS: SUBSTRATE, NOT YET WIRED (33 review WR-08). As of phase
// 33 this module is imported by nothing outside its own tests and
// `derive-transients.test.mjs`, and it exposes no CLI, so -- unlike
// `vsf-slice.ts` -- there is no route to it from the skill side either. The
// only RUNNABLE equivalence check in the phase is the deliberate second
// implementation in `src/skills/c64-ram-capture/scripts/derive-transients.mjs`.
// So read "the ONE authoritative place" above as A DESIGN CONSTRAINT ON FUTURE
// CALLERS -- when the predicate is called, it is called here -- and NOT as a
// claim that anything in production calls it today. In particular
// `normalisePorts()`, the sole reason `sliceC64Mem()` returns the port bytes
// at all, has never run against a real capture.
//
// This is deliberate and is not a defect to be closed by inventing a caller:
// phase 33 built the capture substrate ahead of phases 34-38 consuming it. The
// status is recorded HERE, in the header a later reader will actually reach,
// because "authoritative" and "in use" are easy to conflate and the difference
// decides whether an edit here is safe. When a production consumer lands, this
// paragraph is what should be updated or removed.
//
// This module performs NO filesystem and NO network I/O: every function takes
// bytes, an already-parsed JSON value, or a string array, and returns values.
// Callers obtain and persist the bytes themselves. That is the same claim
// `prg-image.ts` and `vsf-slice.ts`'s library region make about themselves, and
// `capture-predicate.test.ts` asserts it from this module's own source rather
// than trusting this paragraph.
//
// WHY THIS FILE EXISTS, AND WHAT IT IS NOT: the existing
// `src/skills/c64-ram-capture/scripts/compare.mjs` is a VOCABULARY ANALOG
// ONLY. This module is a REPLACEMENT IN KIND for its rules and never an
// extension of them. Its report vocabulary is kept deliberately -- the
// `divergence` class, the `pass` verdict field, the `addr`/`a`/`b`/`bits` row
// shape and the `hex4`/`hex2`/`bin8`/`popcount` helpers -- because a reader
// comparing two transcripts should not have to learn a second vocabulary for
// the same facts. Those helpers are COPIED IN KIND rather than imported: that
// file lives in a different package with a different runtime, and no dependency
// edge exists or should exist between them.
//
// Its two RULES are dropped outright:
//
//   * `compare.mjs` excludes four address RANGES covering 4866 addresses
//     (`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, `$D000-$DFFF`). `CAP-02`
//     requires an ENUMERATED list of addresses, never a range. No range is a
//     volatile span here, at any address, under any name.
//   * `compare.mjs` classifies a difference of exactly one bit as "drift" and
//     lets it PASS anywhere. There is NO bit-count tolerance here, at any
//     address, in any form.
//
// THE CONSEQUENCE OF GETTING EITHER WRONG, STATED HERE SO IT CANNOT BE
// REDISCOVERED THE EXPENSIVE WAY: `D-25`'s fail-ability control plants exactly
// ONE BIT at an address outside the allow-list and requires the comparison to
// FAIL. A predicate carrying either inherited rule PASSES that plant -- so the
// control goes green, the gate reads "the predicate is proven able to fail",
// and nothing whatever has been proven. A vacuous control is worse than no
// control, because it is believed.
//
// `$D000-$DFFF` IS NOT VOLATILE ON THIS ROUTE. `compare.mjs`'s 4096-address
// exclusion is a property of the memory-READ route, where reading that range
// samples live I/O registers and two reads can never agree. The `.vsf`
// `C64MEM` array this predicate compares is `mem_ram[]` -- RAM *under* I/O,
// not the register read view -- so the exclusion does not apply on the snapshot
// route and must not be carried over. Carrying it over would hide 4096
// addresses of real divergence for a reason that is true somewhere else.
//
// WHAT NOT TO DO:
//   - Never make an address RANGE, span, region or page a volatile set here,
//     and never accept range-shaped notation in an allow-list artifact.
//     `parseAllowList()` refuses it BY NAME, and that refusal is a deliverable
//     rather than input hygiene.
//   - Never add a bit-count tolerance, a "drift" class, a fuzz factor or a
//     percentage at any address. A one-bit difference outside the allow-list
//     FAILS. See the vacuity paragraph above for what it costs.
//   - Never raise `TRANSIENT_ALLOW_LIST_CAP` because a derivation overflowed
//     it. An overflow VOIDS the derivation (`D-22`): it means the stop is not
//     frame-exact, which is a fact the gate must hear rather than a threshold
//     to move. Raising the cap after seeing the number converts a measurement
//     into an excuse.
//   - Never spend two allow-list slots on `$0000`/`$0001`. They are
//     normalised, in code, by `normalisePorts()`, and this is the ONE
//     normalisation site (`D-24`). Do not re-derive it in a caller, and do not
//     fold it into the slicer -- the slicer returns the port bytes precisely so
//     this module can apply them exactly once.
//   - Never give any function here a filesystem PATH parameter, and never
//     import either of this repo's host/container path-translation seams. Both
//     absences are asserted structurally by `capture-predicate.test.ts`, not
//     merely stated here.
//   - Never import `stop-oracle.ts` from here, on any route, static or
//     dynamic. The captured 64K is the DEPENDENT VARIABLE the stop-identity
//     oracle certifies; a predicate that could reach the oracle -- or an oracle
//     that could reach the predicate -- would let a capture participate in
//     certifying its own stop. `capture-seam.test.ts` bars it by SHAPE in both
//     directions, which is `CAP-03`.
import { createHash } from "node:crypto";

/** A flat capture is exactly this long, always. Named rather than inlined
 * because every refusal below quotes it back to the caller. */
export const IMAGE_BYTES = 65536;

/** The committed maximum number of addresses a transient allow-list may
 * enumerate (`D-22`).
 *
 * THE REASONING, RECORDED SO A LATER READER CAN WEIGH IT RATHER THAN TRUST IT.
 * The only measurement in hand when this number was committed is **3 transients
 * out of 1024 addresses** at the KERNAL `READY` prompt -- and that figure is
 * itself an UPPER BOUND, taken under frame-divergent conditions, so the
 * frame-exact number is at or below it. A real cracked release adds its own
 * frame counters, RNG state, sprite positions and music-player pointers: tens
 * of addresses, not hundreds. 64 therefore sits an order of magnitude above the
 * only measured value, and at a quarter of the 256-address page the requirement
 * itself names as over-wide.
 *
 * WHAT EXCEEDING IT MEANS. Not "the list is a bit long". Exceeding the cap
 * **VOIDS the derivation**: a run producing more than 64 differing addresses is
 * telling you the stop is not frame-exact, and that is a fact the gate must
 * hear. It is not a threshold to raise, and `parseAllowList()` THROWS rather
 * than warning-and-continuing for exactly that reason -- a warning is a fact
 * that can be scrolled past. */
export const TRANSIENT_ALLOW_LIST_CAP = 64;

/** Every refusal this module raises. Carries the offending value so a caller's
 * failure output can quote it rather than paraphrase it. */
export class CaptureComparisonError extends Error {
  readonly value: unknown;
  constructor(message: string, value?: unknown) {
    super(message);
    this.name = "CaptureComparisonError";
    this.value = value;
  }
}

/** Four-digit hex, for an address. One of `compare.mjs`'s four formatting
 * helpers, copied in kind (see this file's header for why copied, not
 * imported). */
export const hex4 = (n: number): string => "$" + n.toString(16).toUpperCase().padStart(4, "0");
/** Two-digit hex, for a byte value. */
export const hex2 = (n: number): string => "$" + n.toString(16).toUpperCase().padStart(2, "0");
/** Eight-digit binary, for a byte value, in the assembler's `%` notation. */
export const bin8 = (n: number): string => "%" + n.toString(2).padStart(8, "0");

/** How many bits are set. Reported per differing address for the reader's
 * benefit ONLY -- no verdict anywhere in this module reads it, which is exactly
 * the difference between this predicate and the one it replaces. */
export function popcount(n: number): number {
  let c = 0;
  let v = n;
  while (v) {
    v &= v - 1;
    c++;
  }
  return c;
}

/** One enumerated transient: an address, the run pairs it was observed to
 * differ in, and an optional one-line attribution where the cause is known
 * (`D-23`). */
export interface TransientEntry {
  /** An integer, `0 <= address <= 65535`. Never a range, never a span. */
  address: number;
  /** Which pairwise run comparisons this address differed in, e.g.
   * `["run1-run2", "run1-run3"]`. Free-form labels: the derivation script
   * names the runs, and this module only requires that they are strings. */
  pairs: string[];
  /** One line, where the cause is known. Absent is legal and common. */
  attribution?: string;
}

/** A parsed, validated per-release allow-list artifact. `addresses` is derived
 * once, here, ascending -- so no caller re-derives it, and no caller can
 * accidentally derive it differently. */
export interface TransientAllowList {
  /** The release this list was derived from. Lists are never inherited between
   * releases (`D-23`), so the identifier travels with the artifact. */
  release: string;
  entries: TransientEntry[];
  /** Every `entries[].address`, ascending, de-duplicated by construction
   * because duplicates are refused. */
  addresses: number[];
}

/** One differing address, in `compare.mjs`'s row vocabulary. */
export interface CaptureDifference {
  addr: number;
  a: number;
  b: number;
  /** Reported, never read by a verdict. */
  bits: number;
}

/** The verdict, plus everything a transcript needs to show its work. */
export interface CaptureComparison {
  verdict: "equivalent" | "not-equivalent";
  /** Divergent addresses -- differing and NOT allow-listed. Ascending.
   * Non-empty iff the verdict is `not-equivalent`. */
  differing: number[];
  /** Differing addresses that ARE allow-listed, and are therefore excluded
   * from the verdict. Ascending. */
  allowed: number[];
  /** The committed cap, echoed so a transcript records which cap the verdict
   * was taken under rather than leaving a reader to look it up. */
  cap: number;
  allowListSize: number;
  /** `compare.mjs`'s vocabulary: the divergent rows, in full. */
  divergence: CaptureDifference[];
  /** The allow-listed rows, in full. */
  allowedDifferences: CaptureDifference[];
  /** `compare.mjs`'s vocabulary: `true` iff `verdict === "equivalent"`. */
  pass: boolean;
}

/** The two CPU-visible 6510 port read-back values, under exactly the field
 * names `sliceC64Mem()`'s `C64MemSlice` record returns them under. Taking the
 * slice record's own names means a caller passes the slice straight through
 * rather than re-reading the snapshot layout, which is what keeps that layout
 * knowledge in one file. */
export interface PortReads {
  /** `pport.dir_read` -- the CPU-visible value of `$0000`. */
  dirRead: number;
  /** `pport.data_read` -- the CPU-visible value of `$0001`. */
  dataRead: number;
}

/** True for a value usable as a 16-bit address. */
function isAddress(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xffff;
}

/** True for a value usable as a byte. */
function isByte(v: unknown): v is number {
  return typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= 0xff;
}

/** The range-shaped keys an allow-list entry must never carry. Refused BY NAME
 * rather than ignored: an entry written as a span is not a typo, it is an
 * author reaching for the rule `CAP-02` exists to remove, and silently
 * dropping the extra keys would accept the entry while discarding what the
 * author actually meant by it. */
const RANGE_SHAPED_KEYS = ["start", "end", "from", "to", "range", "span", "lo", "hi", "first", "last"];

/** Parse and validate a committed per-release allow-list artifact.
 *
 * Takes an ALREADY-PARSED JSON value -- never a path, and never a JSON string:
 * reading the file is the caller's job (this module does no I/O), and a
 * function accepting a string would have to guess whether it had been handed
 * JSON text or a filename.
 *
 * Every refusal below closes a WIDENING route, because an allow-list is the one
 * input to this module that can turn a failing comparison into a passing one
 * (threat `T-33-26`). None of them is optional, and none of them warns. */
export function parseAllowList(json: unknown): TransientAllowList {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new CaptureComparisonError(
      "parseAllowList: an allow-list artifact must be a JSON object carrying a release identifier and an entries array",
      json,
    );
  }
  const raw = json as Record<string, unknown>;

  if (typeof raw.release !== "string" || raw.release.trim() === "") {
    throw new CaptureComparisonError(
      "parseAllowList: the artifact must name the release it was derived from -- an allow-list is re-derived per release and never inherited, so the identifier travels with it",
      raw.release,
    );
  }
  if (!Array.isArray(raw.entries)) {
    throw new CaptureComparisonError(
      "parseAllowList: the artifact must carry an entries array -- an enumerated list of addresses",
      raw.entries,
    );
  }

  // THE CAP IS CHECKED FIRST, AND IT THROWS. Exceeding it voids the whole
  // derivation, so there is nothing to be gained by validating the individual
  // entries of a list that cannot be used: the count IS the finding.
  if (raw.entries.length > TRANSIENT_ALLOW_LIST_CAP) {
    throw new CaptureComparisonError(
      `parseAllowList: the allow-list enumerates ${raw.entries.length} addresses, over the committed cap of ` +
        `${TRANSIENT_ALLOW_LIST_CAP} -- exceeding the cap VOIDS the derivation (it means the stop is not ` +
        `frame-exact) and is never repaired by raising the cap`,
      raw.entries.length,
    );
  }

  const entries: TransientEntry[] = [];
  const seen = new Set<number>();

  for (let i = 0; i < raw.entries.length; i++) {
    const item: unknown = raw.entries[i];
    if (typeof item !== "object" || item === null || Array.isArray(item)) {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} must be an object carrying an address and the run pairs it differed in`,
        item,
      );
    }
    const entry = item as Record<string, unknown>;

    for (const key of RANGE_SHAPED_KEYS) {
      if (key in entry) {
        throw new CaptureComparisonError(
          `parseAllowList: entry ${i} carries the range-shaped key "${key}" -- the transient allow-list is ` +
            `ENUMERATED and is never a range, so write each address as its own entry`,
          key,
        );
      }
    }
    if (Array.isArray(entry.address)) {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} writes its address as a two-element array, which is a range-shaped span ` +
          `-- the transient allow-list is ENUMERATED and is never a range, so write each address as its own entry`,
        entry.address,
      );
    }
    if (!isAddress(entry.address)) {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} has address ${JSON.stringify(entry.address)}, which is not an integer in 0..65535`,
        entry.address,
      );
    }
    if (seen.has(entry.address)) {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} repeats address ${hex4(entry.address)}, which an earlier entry already ` +
          `enumerates -- a duplicate silently consumes a second slot of the cap`,
        entry.address,
      );
    }
    if (!Array.isArray(entry.pairs) || entry.pairs.some((p) => typeof p !== "string")) {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} (address ${hex4(entry.address)}) must record which run pairs it differed ` +
          `in, as an array of strings`,
        entry.pairs,
      );
    }
    if (entry.attribution !== undefined && typeof entry.attribution !== "string") {
      throw new CaptureComparisonError(
        `parseAllowList: entry ${i} (address ${hex4(entry.address)}) has a non-string attribution`,
        entry.attribution,
      );
    }

    seen.add(entry.address);
    const parsed: TransientEntry = {
      address: entry.address,
      pairs: entry.pairs as string[],
    };
    if (entry.attribution !== undefined) parsed.attribution = entry.attribution;
    entries.push(parsed);
  }

  return {
    release: raw.release,
    entries,
    addresses: [...seen].sort((x, y) => x - y),
  };
}

/** Substitute the CPU-visible 6510 port read-back values over RAM `$0000` and
 * `$0001`, returning a COPY. This is the ONE normalisation site (`D-24`).
 *
 * NOTE THE ADDRESS ORDER, WHICH IS THE HALF THAT GETS WRITTEN BACKWARDS:
 * `$0000` is the DIRECTION register and takes `dirRead`; `$0001` is DATA and
 * takes `dataRead`. And note WHERE the values come from: the 3-byte SUFFIX
 * after the RAM array, never the 4-byte prefix before it. Measured on one
 * snapshot with three readings agreeing -- `prefix=[231,47,0,0]` against
 * `suffix3=[39,55,47]`, with the live registers on that same snapshot reading
 * `$00=47 $01=55` -- so a prefix-over-RAM copy writes 231 where the CPU sees
 * 47: wrong by 176, silently, at exactly the two addresses the normalisation
 * exists to fix.
 *
 * WHY THESE TWO BYTES NEED NORMALISING AT ALL, RATHER THAN ALLOW-LISTING:
 * every store to `$00`/`$01` overwrites `mem_ram[0]`/`mem_ram[1]` with the
 * VIC's phi1 bus value at that instant. Those two RAM bytes are therefore a
 * RASTER-POSITION ARTEFACT rather than program state -- which is both why they
 * are the one legitimate divergence pair, and why spending two of the cap's 64
 * slots on them would hide a real difference behind a known one. */
export function normalisePorts(image: Uint8Array, ports: PortReads): Uint8Array {
  if (!(image instanceof Uint8Array)) {
    throw new CaptureComparisonError("normalisePorts: expected a Uint8Array of capture bytes", image);
  }
  if (image.length !== IMAGE_BYTES) {
    throw new CaptureComparisonError(
      `normalisePorts: the image is ${image.length} byte(s), expected exactly ${IMAGE_BYTES} -- refusing to ` +
        `normalise something that is not a full 64K capture`,
      image.length,
    );
  }
  if (ports === null || typeof ports !== "object" || !isByte(ports.dirRead) || !isByte(ports.dataRead)) {
    throw new CaptureComparisonError(
      "normalisePorts: dirRead and dataRead must both be byte values in 0..255",
      ports,
    );
  }

  // An explicit `new Uint8Array` + `set`, and NEVER `image.slice(...)`.
  // `readFileSync` returns a `Buffer`, whose `slice` overrides the TypedArray
  // method as an alias for `subarray` -- so `image.slice()` returns a VIEW into
  // the caller's buffer for exactly the input type every real caller passes,
  // and the two writes below would land in the caller's snapshot bytes.
  // Measured in this repo already: `vsf-slice.ts`'s own copy-independence test
  // failed on its first implementation for precisely this reason.
  const out = new Uint8Array(IMAGE_BYTES);
  out.set(image);
  out[0x0000] = ports.dirRead;
  out[0x0001] = ports.dataRead;
  return out;
}

/** Normalise either accepted allow-list shape to an address set, in one place.
 *
 * A parsed `TransientAllowList` is the real artifact shape. A bare array of
 * addresses is accepted for the degenerate cases -- an empty list, or a single
 * address in a control -- so a caller with no artifact does not have to
 * fabricate a release identifier in order to ask a question. Both shapes go
 * through the same cap check and the same address validation, so the array form
 * is not a widening route. */
function allowSet(allowList: TransientAllowList | readonly number[]): { set: Set<number>; size: number } {
  const addresses: unknown = Array.isArray(allowList)
    ? allowList
    : (allowList as TransientAllowList | null)?.addresses;
  if (!Array.isArray(addresses)) {
    throw new CaptureComparisonError(
      "compareCaptures: the allow-list must be a parsed TransientAllowList or an array of addresses",
      allowList,
    );
  }
  if (addresses.length > TRANSIENT_ALLOW_LIST_CAP) {
    throw new CaptureComparisonError(
      `compareCaptures: the allow-list enumerates ${addresses.length} addresses, over the committed cap of ` +
        `${TRANSIENT_ALLOW_LIST_CAP} -- exceeding the cap VOIDS the derivation and is never repaired by ` +
        `raising the cap`,
      addresses.length,
    );
  }
  const set = new Set<number>();
  for (const addr of addresses as unknown[]) {
    if (!isAddress(addr)) {
      throw new CaptureComparisonError(
        `compareCaptures: the allow-list contains ${JSON.stringify(addr)}, which is not an integer in 0..65535`,
        addr,
      );
    }
    set.add(addr);
  }
  return { set, size: set.size };
}

/** Refuse anything that is not exactly one full 64K capture, naming the length
 * it actually had. A zero-length or wrong-length image is REFUSED and never
 * reported as trivially equivalent -- two empty buffers agree at every address
 * they have, and that is the failure mode this refusal exists to remove
 * (threat `T-33-01`). */
function requireFullImage(image: Uint8Array, side: string): void {
  if (!(image instanceof Uint8Array)) {
    throw new CaptureComparisonError(`compareCaptures: image ${side} is not a Uint8Array of capture bytes`, image);
  }
  if (image.length !== IMAGE_BYTES) {
    throw new CaptureComparisonError(
      `compareCaptures: image ${side} is ${image.length} byte(s), expected exactly ${IMAGE_BYTES} -- refusing ` +
        `rather than comparing a partial capture, which would agree everywhere it has no bytes`,
      image.length,
    );
  }
}

/** Decide whether two flat 64K captures are EQUIVALENT under an enumerated
 * transient allow-list.
 *
 * The rule, in full, with nothing else in it: a differing address ON the
 * allow-list is counted, reported as `allowed`, and excluded from the verdict.
 * ANY other differing address is a `divergence` and FAILS -- whatever its bit
 * count, wherever it sits, and however close it lies to an allow-listed
 * address. The allow-list is a SET OF ADDRESSES and never a neighbourhood: an
 * address one either side of an allow-listed one is divergent.
 *
 * Symmetric in `a` and `b` by construction: the verdict and both reported
 * address lists depend only on WHICH addresses differ, never on which image was
 * passed first. Both lists are ascending by address. */
export function compareCaptures(
  a: Uint8Array,
  b: Uint8Array,
  allowList: TransientAllowList | readonly number[],
): CaptureComparison {
  requireFullImage(a, "A");
  requireFullImage(b, "B");
  const { set, size } = allowSet(allowList);

  const divergence: CaptureDifference[] = [];
  const allowedDifferences: CaptureDifference[] = [];

  // Ascending by construction: one forward walk over the address space, so
  // neither list is ever sorted afterwards and neither can come back out of
  // order after a later edit.
  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = a[addr];
    const y = b[addr];
    if (x === y) continue;
    const row: CaptureDifference = { addr, a: x, b: y, bits: popcount(x ^ y) };
    if (set.has(addr)) allowedDifferences.push(row);
    else divergence.push(row);
  }

  const pass = divergence.length === 0;
  return {
    verdict: pass ? "equivalent" : "not-equivalent",
    differing: divergence.map((r) => r.addr),
    allowed: allowedDifferences.map((r) => r.addr),
    cap: TRANSIENT_ALLOW_LIST_CAP,
    allowListSize: size,
    divergence,
    allowedDifferences,
    pass,
  };
}

/** One row, in `compare.mjs`'s exact reporting shape. */
const formatRow = (r: CaptureDifference): string =>
  `  ${hex4(r.addr)}  ${hex2(r.a)} ${bin8(r.a)}  ->  ${hex2(r.b)} ${bin8(r.b)}   ${r.bits} bit${r.bits === 1 ? "" : "s"}`;

/** Render a comparison for a transcript, in `compare.mjs`'s report vocabulary.
 * Returns a string rather than printing: this module writes nothing anywhere,
 * and a caller appending to an evidence file needs the text, not stdout. */
export function formatComparison(comparison: CaptureComparison, limit = 0): string {
  const lines: string[] = [];
  const list = (title: string, rows: CaptureDifference[]): void => {
    lines.push(`${title}: ${rows.length}`);
    const shown = limit > 0 ? rows.slice(0, limit) : rows;
    for (const r of shown) lines.push(formatRow(r));
    if (shown.length < rows.length) lines.push(`  ... ${rows.length - shown.length} more`);
  };
  list(
    `allowed (enumerated transients, excluded from the verdict; ${comparison.allowListSize} of a cap of ${comparison.cap})`,
    comparison.allowedDifferences,
  );
  list("DIVERGENCE -- outside the allow-list, fails the comparison at any bit count", comparison.divergence);
  lines.push(`VERDICT: ${comparison.verdict}`);
  return lines.join("\n");
}

/** The one byte an argv element cannot contain, and therefore the only safe
 * join separator for a digest over an exact argv array. */
const ARGV_SEPARATOR = "\u0000";

/** sha256 over an exact argv array, NUL-joined, lowercase hex.
 *
 * The NUL join is the whole point, and a space join would be a bug: `["a b"]`
 * and `["a", "b"]` are different argvs that a space join collapses onto the
 * same digest, while 0x00 is the one byte that cannot appear inside a POSIX
 * argument. Order-sensitive by construction, which is what makes the digest
 * usable as a run identity key (`REPRO-04`).
 *
 * An empty array is REFUSED by name rather than digesting the empty string: the
 * sha256 of "" is a real, stable and entirely meaningless value, and a run keyed
 * by it would look identified. */
export function argvDigest(argv: readonly string[]): string {
  if (!Array.isArray(argv)) {
    throw new CaptureComparisonError("argvDigest: expected an array of argv strings", argv);
  }
  if (argv.length === 0) {
    throw new CaptureComparisonError(
      "argvDigest: refusing to digest an empty argv array -- the digest of nothing is a stable value that would look like a run identity",
      argv,
    );
  }
  for (let i = 0; i < argv.length; i++) {
    if (typeof argv[i] !== "string") {
      throw new CaptureComparisonError(`argvDigest: argv[${i}] is not a string`, argv[i]);
    }
  }
  return createHash("sha256").update(argv.join(ARGV_SEPARATOR), "utf8").digest("hex");
}
