// stop-oracle.ts -- the ONE authoritative place in this repo holding the
// STOP-IDENTITY comparison: whether two stops of the same protocol, on the same
// release, are the SAME stop. The oracle is the three-term
// `(PC, hit_count, (LIN, CYC))`, expressed here as its four scalar terms.
//
// WHAT THIS MODULE CERTIFIES, AND WHY THAT DETERMINES ITS SHAPE: it certifies a
// STOP. The captured 64K is the DEPENDENT VARIABLE -- the thing whose
// reproducibility is being claimed on the strength of the stop being identical.
// So the capture must never become a conjunct of the stop's own identity. If it
// did, two runs that stopped in genuinely different places could be certified
// "the same stop" because their memory happened to agree, and a capture would be
// participating in certifying itself. That circularity, once it has certified a
// capture, cannot be laundered back out of that capture's record -- which is why
// it is barred by SHAPE rather than by convention (`CAP-03`, `D-26`):
//
//   1. This module takes NO image buffer. No exported function here declares a
//      byte-array parameter of any kind, and `capture-seam.test.ts` asserts that
//      from this module's own exported signatures, over stripped code, with a
//      planted oracle-shaped module as its positive control.
//   2. This module imports NOTHING from `capture-predicate.ts`, on any route,
//      static or dynamic -- and that module imports nothing from here. Both
//      directions are asserted, because the circularity is symmetric and a
//      one-directional guard leaves half of it open.
//
// This module performs NO filesystem and NO network I/O, imports nothing at all,
// and holds no module-level mutable state. It is four scalars in, one record
// out.
//
// WHY FOUR TERMS AND NOT TWO: `(LIN, CYC)` is a WITHIN-FRAME position, not a
// monotonic clock -- stock VICE's binary monitor has no monotonic cycle register
// below 3.10 -- so two stops one whole frame apart can carry identical
// `(LIN, CYC)`. `PC` and `hit_count` are what distinguish them, and the frame
// term is what distinguishes two stops at the same PC and hit count within a
// frame. Each term is load-bearing for a different confusion, and dropping any
// one of them silently widens what counts as "the same stop".
//
// WHAT NOT TO DO:
//   - Never add a parameter carrying capture bytes, a byte array, a memory
//     image, or a value DERIVED from one (a digest, a differing-address count,
//     an equivalence verdict). The derived-scalar route is the realistic one and
//     the structural assertions cannot see it: a caller that reads the capture
//     and passes a digest in here has reintroduced the circularity through a
//     `number`. It is recorded as an accepted limit rather than left implicit.
//   - Never import `capture-predicate.ts` here, and never reach it dynamically.
//   - Never ship a two-term mode flag. `GATE-01`'s pre-mapped
//     `ORACLE_NECESSITY: unproven` narrowing is implementable by READING
//     `differingTerms` and treating the frame entries as recorded-not-fatal;
//     `frameTermAsserted` records which form the comparison used and does not
//     select one. `D-13`'s no-sub-flags rule is about the run protocol, and the
//     same reasoning applies here -- a published second mode is a second route a
//     caller can forget it took.
//   - Never substitute a zero, a null or a sentinel for a term the caller did
//     not supply. A partial stop record is REFUSED, naming the term and the
//     side. Silently passing on a partial record is the one failure this module
//     must not have: it would certify two stops as identical on the strength of
//     the terms that happened to be present.
//   - Never hardcode a wire register id for `PC`, `LIN` or `CYC` anywhere near
//     this module. Register ids are not stable across builds, and
//     `stock-timing.ts`'s `registerCatalogFor()` is the only route from a
//     register NAME to its id. This module takes already-read numbers and never
//     touches a wire.

/** The four scalar terms of the three-term stop-identity oracle
 * `(PC, hit_count, (LIN, CYC))`. The frame term is a pair, which is why four
 * scalars express three terms.
 *
 * Ordering is normative: `differingTerms` below is reported in this order, so a
 * reader comparing two transcripts sees the terms in the same sequence every
 * time. */
export const ORACLE_TERMS = ["pc", "hitCount", "line", "cycle"] as const;

/** One member of `ORACLE_TERMS`. */
export type OracleTerm = (typeof ORACLE_TERMS)[number];

/** One stop, as its four already-read scalar terms. No bytes, by design -- see
 * this module's header. */
export interface StopIdentity {
  /** The program counter at the stop. */
  pc: number;
  /** The checkpoint's hit count at the stop. */
  hitCount: number;
  /** `LIN` -- the raster line. Half of the frame term. */
  line: number;
  /** `CYC` -- the cycle within the raster line. The other half. */
  cycle: number;
}

/** Raised when a stop record cannot be compared. Carries the term and the side
 * so a caller's failure output names both rather than paraphrasing. */
export class StopOracleError extends Error {
  readonly term: string;
  readonly side: string;
  constructor(message: string, term: string, side: string) {
    super(message);
    this.name = "StopOracleError";
    this.term = term;
    this.side = side;
  }
}

/** The verdict. */
export interface StopIdentityComparison {
  /** True iff every term in `ORACLE_TERMS` agrees. */
  identical: boolean;
  /** Which terms differ, ordered as `ORACLE_TERMS` is. */
  differingTerms: string[];
  /** Whether the frame term participated in the verdict.
   *
   * `true` for every comparison this function performs: all four terms are
   * asserted, always. The field exists so `GATE-01`'s pre-mapped
   * `ORACLE_NECESSITY: unproven` narrowing is implementable without a rewrite --
   * under that narrowing the frame term is RECORDED but not ASSERTED, and a
   * caller expresses it by reading `differingTerms` and treating the
   * `line`/`cycle` entries as recorded rather than fatal. It RECORDS which form
   * the comparison used; it never selects one. */
  frameTermAsserted: boolean;
}

/** Every term of one side, validated. Throws naming the term and the side
 * rather than returning a partial record: there is no honest way to compare
 * stops when a term is absent, and no sentinel that would not be a lie. */
function requireTerms(record: StopIdentity, side: string): void {
  if (record === null || typeof record !== "object") {
    throw new StopOracleError(
      `compareStopIdentity: side ${side} is not a stop record -- expected an object carrying ${ORACLE_TERMS.join(", ")}`,
      "(whole record)",
      side,
    );
  }
  for (const term of ORACLE_TERMS) {
    const value: unknown = record[term];
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isInteger(value)) {
      throw new StopOracleError(
        `compareStopIdentity: term "${term}" is absent or not a finite integer on side ${side} ` +
          `(got ${JSON.stringify(value)}) -- refusing rather than passing on a partial stop record, which ` +
          `would certify two stops as identical on the strength of the terms that happened to be present`,
        term,
        side,
      );
    }
  }
}

/** Compare two stops under the three-term oracle.
 *
 * Symmetric in its arguments: the verdict and `differingTerms` depend only on
 * WHICH terms disagree, never on which record was passed first. Two stops with
 * identical `pc` and `hitCount` whose frame position is one frame apart compare
 * NOT identical -- that is the frame term doing its job, and it is the whole
 * reason a two-term oracle is insufficient. */
export function compareStopIdentity(a: StopIdentity, b: StopIdentity): StopIdentityComparison {
  requireTerms(a, "a");
  requireTerms(b, "b");

  // Built by walking ORACLE_TERMS, so the reported order IS the declared order
  // and cannot drift from it after an edit.
  const differingTerms: string[] = [];
  for (const term of ORACLE_TERMS) {
    if (a[term] !== b[term]) differingTerms.push(term);
  }

  return {
    identical: differingTerms.length === 0,
    differingTerms,
    frameTermAsserted: true,
  };
}
