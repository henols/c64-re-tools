// reassembly-gate-ack.ts -- turns a hazard report's findings and undecided
// regions into the gate's HAZARD_DISPOSITION input, and the only way a
// non-clean report reaches anything other than blocked: an explicit,
// per-finding, reasoned acknowledgement, never a blanket, a count or a
// wildcard.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// The hazard report reports and acts on nothing -- it names findings and
// undecided regions and stops there. That means the decision about what to
// DO with a finding lands here, one level up. A blanket acknowledgement (one
// entry covering every finding of a class), a count ("N findings accepted")
// or a reason-less entry would hand that decision back to the tool silently,
// and a reader looking at a green-adjacent verdict would have no way to see
// which specific construction a human actually looked at and accepted. Keying
// every acknowledgement to one finding by its class, anchor address and
// mechanism together is what makes that impossible: an acknowledgement either
// names the one finding it covers, with a reason a person wrote, or it
// matches nothing and the disposition is blocked.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Matching a hazard report's findings and undecided regions against an
// acknowledgement set by exact key, deriving the HAZARD_DISPOSITION token
// from that match, and rendering the matched acknowledgements in one
// deterministic order so the result is a reviewable diff across runs.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never accept a wildcard, a class-wide acknowledgement or a count. Every
//     acknowledgement names exactly one finding (by class, anchor address and
//     mechanism) or exactly one undecided region (by its start and inclusive
//     end), and carries a non-empty reason a person wrote.
//   - Never resolve an ambiguous match -- an acknowledgement matching more
//     than one finding, or a duplicate acknowledgement key -- in the
//     acknowledger's favor. Both are refused or reported as a failure to
//     acknowledge, never silently absorbed.
//   - Never mutate the hazard report this module is handed. It is consumed
//     read-only: this module opens no store, writes no file and spawns no
//     child process. The report is another module's output, and anything
//     this module changed about it would be invisible to that module's own
//     tests.
//   - Never let the findings array's order influence the result. Nothing
//     documents that array as stably ordered, so every key here is built
//     from the finding's own class, anchor address and mechanism -- never
//     from its position in the array.
//   - Never carry this project's own planning bookkeeping in this file. A
//     consumer reading it has no planning tree to resolve a citation
//     against, so every rule here is stated in words instead.
import { HAZARD_CLASSES, type HazardClass, type HazardFinding, type HazardRegionDisposition, type HazardReport } from "./anno-hazard-report.ts";
import type { HazardAcknowledgementResult } from "./reassembly-gate.ts";

// ---------------------------------------------------------------------------
// The acknowledgement shapes
// ---------------------------------------------------------------------------

/**
 * One acknowledgement of one hazard finding. Never a wildcard, a class-wide
 * waiver or a count: `hazardClass`, `anchorAddress` and `mechanism` together
 * name the ONE finding this acknowledgement covers, and `reason` is why a
 * human accepted it -- required, and rejected when it trims to nothing.
 */
export interface HazardAcknowledgement {
  hazardClass: HazardClass;
  anchorAddress: number;
  mechanism: string;
  reason: string;
}

/**
 * One acknowledgement of one undecided (`"unclassified"`) region. Named by
 * the region's own start and inclusive end -- the same two fields a hazard
 * report's own region disposition carries -- never by an index into the
 * report's `regions` array.
 */
export interface UndecidedRegionAcknowledgement {
  start: number;
  endInclusive: number;
  reason: string;
}

/** One finding paired with the one acknowledgement that claimed it. */
export interface AcknowledgementMatch {
  finding: HazardFinding;
  acknowledgement: HazardAcknowledgement;
}

/**
 * The full result of matching a hazard report's findings and undecided
 * regions against an acknowledgement set. Every field below is populated
 * independently -- a zero-match acknowledgement and an unacknowledged finding
 * are DIFFERENT facts, and folding either into a single count would hide
 * which one actually happened. Every array is sorted by its own canonical key
 * before being returned, so the whole result is independent of the caller's
 * own array order (see `hazardFindingKey()`'s own doc comment for why the
 * caller's order is never trustworthy in the first place).
 */
export interface AcknowledgementMatchResult {
  /** Findings matched by exactly one acknowledgement. */
  matched: readonly AcknowledgementMatch[];
  /** Findings matched by zero acknowledgements -- including a finding whose
   * only candidate acknowledgement was ambiguous (see
   * `multiMatchAcknowledgements` below): an ambiguous match is treated as no
   * match, never resolved in the acknowledger's favor. */
  unacknowledgedFindings: readonly HazardFinding[];
  /** Acknowledgements whose key matched zero findings -- a DIFFERENT fact
   * from an unacknowledged finding: "you acknowledged something that is not
   * there" is never folded into "you did not acknowledge this". */
  zeroMatchAcknowledgements: readonly HazardAcknowledgement[];
  /** Acknowledgements whose key matched more than one finding -- possible
   * only when the caller's own findings array carries more than one finding
   * under the identical (class, anchor, mechanism) triple, since acknowledgement
   * keys are themselves refused as duplicates before matching runs. */
  multiMatchAcknowledgements: readonly HazardAcknowledgement[];
  /** Undecided (`"unclassified"`) regions matched by zero region
   * acknowledgements. */
  unacknowledgedRegions: readonly HazardRegionDisposition[];
  /** Region acknowledgements whose key matched zero undecided regions. */
  zeroMatchRegionAcknowledgements: readonly UndecidedRegionAcknowledgement[];
}

// ---------------------------------------------------------------------------
// The three-part key
// ---------------------------------------------------------------------------

/** Separator for the finding key and the region key below. Safe because
 * every part it joins comes from a closed vocabulary this codebase itself
 * controls: `HazardClass` is one of the four frozen `HAZARD_CLASSES` members,
 * `mechanism` is always a lowercase-hyphenated identifier
 * (`anno-hazard-report.ts`'s own stated convention), and an address is a
 * plain decimal integer -- none of the three ever contains "::". */
const KEY_SEPARATOR = "::";

/**
 * The identity of one hazard finding for acknowledgement-matching purposes:
 * its class, its anchor address and its mechanism, taken together.
 *
 * The anchor address ALONE is not enough: one address can carry findings
 * under two different mechanisms (for example a byte that is both an
 * opcode-byte self-modification target and, under a wholly separate
 * detector, some other class's anchor) -- keying on the address alone would
 * silently collapse two distinct findings into one acknowledgement slot.
 *
 * The findings array's OWN INDEX is not usable either: nothing in
 * `anno-hazard-report.ts` documents that array as stably ordered across a
 * re-export or a re-run, so an acknowledgement keyed on "the third finding"
 * would silently move to a different finding the moment the array's order
 * changed for a reason that had nothing to do with the acknowledgement
 * itself. Keying on the finding's own class, address and mechanism makes the
 * array's order irrelevant by construction.
 */
export function hazardFindingKey(hazardClass: HazardClass, anchorAddress: number, mechanism: string): string {
  return `${hazardClass}${KEY_SEPARATOR}${anchorAddress}${KEY_SEPARATOR}${mechanism}`;
}

/** The identity of one undecided region for acknowledgement-matching
 * purposes: its start and inclusive end, taken together -- the same two
 * fields a hazard report's own region disposition carries. */
function undecidedRegionKey(start: number, endInclusive: number): string {
  return `${start}${KEY_SEPARATOR}${endInclusive}`;
}

function compareKeys(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

// ---------------------------------------------------------------------------
// The matcher
// ---------------------------------------------------------------------------

/**
 * Matches `findings` and the `"unclassified"` members of `regions` against
 * `acknowledgements` and `regionAcknowledgements`, by exact key.
 *
 * Duplicate acknowledgement keys are refused BY NAME before any matching
 * happens -- in either acknowledgement list, independently -- because a
 * duplicate cannot be attributed to one finding or one region, and absorbing
 * it would let one reasoned acknowledgement silently stand in for two.
 *
 * An acknowledgement matching more than one finding is possible only when
 * `findings` itself carries more than one finding under the identical
 * (class, anchor, mechanism) triple (a real `buildHazardReport()` call
 * de-duplicates on exactly this triple, so this can only happen against a
 * hand-assembled or merged findings array). Such a match is ambiguous and is
 * never resolved in the acknowledger's favor: every finding under that key is
 * reported unacknowledged, and the acknowledgement itself is reported
 * separately as a multi-match.
 *
 * Every returned array is sorted by its own canonical key, so the whole
 * result is independent of the order `findings`, `regions`,
 * `acknowledgements` or `regionAcknowledgements` were handed in.
 */
export function matchHazardAcknowledgements(
  findings: readonly HazardFinding[],
  regions: readonly HazardRegionDisposition[],
  acknowledgements: readonly HazardAcknowledgement[],
  regionAcknowledgements: readonly UndecidedRegionAcknowledgement[] = [],
): AcknowledgementMatchResult {
  const seenAckKeys = new Set<string>();
  for (const ack of acknowledgements) {
    const key = hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism);
    if (seenAckKeys.has(key)) {
      throw new Error(
        `matchHazardAcknowledgements: duplicate acknowledgement key "${key}" -- a duplicate cannot be attributed to one finding, ` +
          `and absorbing it would let one reasoned acknowledgement stand in for two findings.`,
      );
    }
    seenAckKeys.add(key);
  }

  const seenRegionAckKeys = new Set<string>();
  for (const ack of regionAcknowledgements) {
    const key = undecidedRegionKey(ack.start, ack.endInclusive);
    if (seenRegionAckKeys.has(key)) {
      throw new Error(
        `matchHazardAcknowledgements: duplicate undecided-region acknowledgement key "${key}" -- a duplicate cannot be attributed ` +
          `to one region, and absorbing it would let one reasoned acknowledgement stand in for two regions.`,
      );
    }
    seenRegionAckKeys.add(key);
  }

  const findingsByKey = new Map<string, HazardFinding[]>();
  for (const finding of findings) {
    const key = hazardFindingKey(finding.hazardClass, finding.anchorAddress, finding.mechanism);
    const bucket = findingsByKey.get(key);
    if (bucket) bucket.push(finding);
    else findingsByKey.set(key, [finding]);
  }

  const matched: AcknowledgementMatch[] = [];
  const zeroMatchAcknowledgements: HazardAcknowledgement[] = [];
  const multiMatchAcknowledgements: HazardAcknowledgement[] = [];
  const matchedFindingKeys = new Set<string>();

  for (const ack of acknowledgements) {
    const key = hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism);
    const candidates = findingsByKey.get(key) ?? [];
    if (candidates.length === 0) {
      zeroMatchAcknowledgements.push(ack);
    } else if (candidates.length > 1) {
      multiMatchAcknowledgements.push(ack);
    } else {
      matched.push({ finding: candidates[0]!, acknowledgement: ack });
      matchedFindingKeys.add(key);
    }
  }

  const unacknowledgedFindings = findings.filter(
    (finding) => !matchedFindingKeys.has(hazardFindingKey(finding.hazardClass, finding.anchorAddress, finding.mechanism)),
  );

  const undecidedRegions = regions.filter((region) => region.outcome === "unclassified");
  const regionsByKey = new Map<string, HazardRegionDisposition>();
  for (const region of undecidedRegions) regionsByKey.set(undecidedRegionKey(region.start, region.endInclusive), region);

  const matchedRegionKeys = new Set<string>();
  const zeroMatchRegionAcknowledgements: UndecidedRegionAcknowledgement[] = [];
  for (const ack of regionAcknowledgements) {
    const key = undecidedRegionKey(ack.start, ack.endInclusive);
    if (regionsByKey.has(key)) matchedRegionKeys.add(key);
    else zeroMatchRegionAcknowledgements.push(ack);
  }
  const unacknowledgedRegions = [...regionsByKey.entries()].filter(([key]) => !matchedRegionKeys.has(key)).map(([, region]) => region);

  const byFindingKey = (a: HazardFinding, b: HazardFinding): number =>
    compareKeys(hazardFindingKey(a.hazardClass, a.anchorAddress, a.mechanism), hazardFindingKey(b.hazardClass, b.anchorAddress, b.mechanism));
  const byAckKey = (a: HazardAcknowledgement, b: HazardAcknowledgement): number =>
    compareKeys(hazardFindingKey(a.hazardClass, a.anchorAddress, a.mechanism), hazardFindingKey(b.hazardClass, b.anchorAddress, b.mechanism));
  const byRegionKey = (a: HazardRegionDisposition, b: HazardRegionDisposition): number =>
    compareKeys(undecidedRegionKey(a.start, a.endInclusive), undecidedRegionKey(b.start, b.endInclusive));
  const byRegionAckKey = (a: UndecidedRegionAcknowledgement, b: UndecidedRegionAcknowledgement): number =>
    compareKeys(undecidedRegionKey(a.start, a.endInclusive), undecidedRegionKey(b.start, b.endInclusive));

  return {
    matched: [...matched].sort((a, b) => byFindingKey(a.finding, b.finding)),
    unacknowledgedFindings: [...unacknowledgedFindings].sort(byFindingKey),
    zeroMatchAcknowledgements: [...zeroMatchAcknowledgements].sort(byAckKey),
    multiMatchAcknowledgements: [...multiMatchAcknowledgements].sort(byAckKey),
    unacknowledgedRegions: [...unacknowledgedRegions].sort(byRegionKey),
    zeroMatchRegionAcknowledgements: [...zeroMatchRegionAcknowledgements].sort(byRegionAckKey),
  };
}

// ---------------------------------------------------------------------------
// The disposition rule
// ---------------------------------------------------------------------------

function hasNonEmptyReason(reason: string): boolean {
  return typeof reason === "string" && reason.trim().length > 0;
}

function blockedResult(reason: string, match?: AcknowledgementMatchResult): HazardAcknowledgementResult {
  return {
    disposition: "blocked",
    acknowledgedFindings: match ? match.matched.map((m) => m.finding) : [],
    unacknowledgedFindings: match ? match.unacknowledgedFindings : [],
    ambiguousAcknowledgements: [],
    reason,
  };
}

/**
 * Derives the gate's `HAZARD_DISPOSITION` token for one hazard report against
 * one acknowledgement set, per the rule this whole module exists to
 * implement:
 *
 *   - `"clean"` requires ALL of: zero findings, zero undecided
 *     (`"unclassified"`) regions, zero acknowledgements and zero region
 *     acknowledgements. Supplying an acknowledgement to an empty report is
 *     NOT clean -- it is an acknowledgement that matches nothing, which is
 *     `"blocked"`.
 *   - `"acknowledged"` requires ALL of: every finding matched exactly once,
 *     every undecided region matched exactly once, zero zero-match
 *     acknowledgements (either kind), zero multi-match acknowledgements, and
 *     every acknowledgement's reason non-empty after trimming.
 *   - Everything else is `"blocked"`, with a reason naming the first thing
 *     that failed -- the offending key or region -- so a blocked disposition
 *     is actionable rather than a bare token.
 */
export function disposeHazardReport(
  report: HazardReport,
  acknowledgements: readonly HazardAcknowledgement[] = [],
  regionAcknowledgements: readonly UndecidedRegionAcknowledgement[] = [],
): HazardAcknowledgementResult {
  const unclassifiedRegions = report.regions.filter((region) => region.outcome === "unclassified");

  if (report.findings.length === 0 && unclassifiedRegions.length === 0 && acknowledgements.length === 0 && regionAcknowledgements.length === 0) {
    return {
      disposition: "clean",
      acknowledgedFindings: [],
      unacknowledgedFindings: [],
      ambiguousAcknowledgements: [],
      reason: "disposeHazardReport: zero findings, zero undecided regions and zero acknowledgements of either kind -- clean.",
    };
  }

  // An acknowledgement -- of either kind -- carrying no real reason is never
  // accepted, whether or not it goes on to match anything: a blanket,
  // wildcard or reason-less acknowledgement is exactly what this module
  // exists to refuse, checked here before matching even assigns it a fate.
  for (const ack of acknowledgements) {
    if (!hasNonEmptyReason(ack.reason)) {
      const key = hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism);
      return blockedResult(
        `disposeHazardReport: acknowledgement ${key} carries an empty or whitespace-only reason -- every acknowledged finding must carry a real reason a person wrote.`,
      );
    }
  }
  for (const ack of regionAcknowledgements) {
    if (!hasNonEmptyReason(ack.reason)) {
      const key = undecidedRegionKey(ack.start, ack.endInclusive);
      return blockedResult(
        `disposeHazardReport: undecided-region acknowledgement ${key} carries an empty or whitespace-only reason -- every acknowledged region must carry a real reason a person wrote.`,
      );
    }
  }

  const match = matchHazardAcknowledgements(report.findings, report.regions, acknowledgements, regionAcknowledgements);

  if (match.zeroMatchAcknowledgements.length > 0) {
    const ack = match.zeroMatchAcknowledgements[0]!;
    const key = hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism);
    return blockedResult(
      `disposeHazardReport: acknowledgement ${key} matches zero findings -- an acknowledgement that matches nothing is never treated as covering something else.`,
      match,
    );
  }
  if (match.multiMatchAcknowledgements.length > 0) {
    const ack = match.multiMatchAcknowledgements[0]!;
    const key = hazardFindingKey(ack.hazardClass, ack.anchorAddress, ack.mechanism);
    const ambiguousFindings = report.findings.filter(
      (finding) => hazardFindingKey(finding.hazardClass, finding.anchorAddress, finding.mechanism) === key,
    );
    return {
      disposition: "blocked",
      acknowledgedFindings: [],
      unacknowledgedFindings: [],
      ambiguousAcknowledgements: ambiguousFindings,
      reason: `disposeHazardReport: acknowledgement ${key} matches more than one finding -- an ambiguous match is treated as no match, never resolved in the acknowledger's favor.`,
    };
  }
  if (match.zeroMatchRegionAcknowledgements.length > 0) {
    const ack = match.zeroMatchRegionAcknowledgements[0]!;
    const key = undecidedRegionKey(ack.start, ack.endInclusive);
    return blockedResult(`disposeHazardReport: undecided-region acknowledgement ${key} matches zero undecided regions.`, match);
  }
  if (match.unacknowledgedFindings.length > 0) {
    const finding = match.unacknowledgedFindings[0]!;
    const key = hazardFindingKey(finding.hazardClass, finding.anchorAddress, finding.mechanism);
    return blockedResult(`disposeHazardReport: finding ${key} is not matched by exactly one acknowledgement.`, match);
  }
  if (match.unacknowledgedRegions.length > 0) {
    const region = match.unacknowledgedRegions[0]!;
    const key = undecidedRegionKey(region.start, region.endInclusive);
    return blockedResult(`disposeHazardReport: undecided region ${key} is not matched by exactly one acknowledgement.`, match);
  }

  return {
    disposition: "acknowledged",
    acknowledgedFindings: match.matched.map((m) => m.finding),
    unacknowledgedFindings: [],
    ambiguousAcknowledgements: [],
    reason: "disposeHazardReport: every finding and every undecided region is matched by exactly one acknowledgement carrying a non-empty reason.",
  };
}

// ---------------------------------------------------------------------------
// Deterministic rendering
// ---------------------------------------------------------------------------

const HAZARD_CLASS_ORDER = new Map<HazardClass, number>(HAZARD_CLASSES.map((hazardClass, index) => [hazardClass, index]));

function hex4(value: number): string {
  return `$${(value & 0xffff).toString(16).toUpperCase().padStart(4, "0")}`;
}

/**
 * Renders one line per matched acknowledgement, sorted by the frozen
 * `HAZARD_CLASSES` list's own order, then by anchor address ascending, then
 * by mechanism lexicographically. The sort's whole purpose is byte-identical
 * output across runs, so the verdict artifact this feeds is a reviewable
 * diff rather than unreviewable churn from an incidental array-order change
 * upstream.
 */
export function renderAcknowledgementLines(matched: readonly AcknowledgementMatch[]): readonly string[] {
  const sorted = [...matched].sort((a, b) => {
    const orderA = HAZARD_CLASS_ORDER.get(a.finding.hazardClass) ?? 0;
    const orderB = HAZARD_CLASS_ORDER.get(b.finding.hazardClass) ?? 0;
    if (orderA !== orderB) return orderA - orderB;
    if (a.finding.anchorAddress !== b.finding.anchorAddress) return a.finding.anchorAddress - b.finding.anchorAddress;
    return a.finding.mechanism < b.finding.mechanism ? -1 : a.finding.mechanism > b.finding.mechanism ? 1 : 0;
  });
  return sorted.map(({ finding, acknowledgement }) => `${finding.hazardClass} ${hex4(finding.anchorAddress)} ${finding.mechanism}: ${acknowledgement.reason}`);
}
