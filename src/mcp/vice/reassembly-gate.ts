// reassembly-gate.ts -- reads the seven committed gate inputs and returns a
// verdict derived from a frozen rule table, never judged.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// A rebuild that is judged rather than derived is not a gate. The whole
// point of writing the input names, their value sets and the ordered rule
// table down BEFORE any measurement exists is that the module reading them
// afterward has nothing left to decide: it reads a rule from a frozen table,
// it records which rule fired beside the verdict it produced, and it reports
// what it found without acting on any of it -- this module removes nothing,
// strips nothing, and excludes nothing on its own judgement.
//
// This module is a DEVELOPMENT AND CONTINUOUS-INTEGRATION GATE and is
// deliberately absent from the published file list, exactly as the byte-diff
// oracle it reads its rebuild tokens from (`acme-verify.ts`) already is.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
// Turning the seven declared gate inputs into exactly one of three verdict
// tokens, with the id of the rule that produced it. Every consumer branches
// on the verdict token; none of them re-derives a rule of its own from the
// inputs beside it.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO
// ---------------------------------------------------------------------------
//   - Never read an exit status, open a file, or spawn a child process here.
//     Every input this module reads is already a resolved token by the time
//     it arrives; the module that produced that token (the byte-diff oracle,
//     a movement producer, a hazard acknowledgement producer) owns the
//     measurement, and this module owns only the rule table.
//   - Never reorder, merge, drop or "simplify" a rule. The rule table is a
//     committed, ordered, first-match-wins list; a rule implemented
//     differently from the one committed makes the whole instrument
//     advisory.
//   - Never let a missing or out-of-domain input throw. A thrown error at
//     the top of a gate reads to a caller as a broken harness rather than a
//     refusal -- the absence rule resolves to a verdict, same as every other
//     rule.
//   - Never carry this project's own planning bookkeeping in this file. It
//     is one published-file-list edit away from shipping and a consumer has
//     no planning tree to resolve a citation against.
import type { AcmeOutcome } from "./acme-verify.ts";
import type { HazardFinding } from "./anno-hazard-report.ts";

/** The three verdict tokens, and there are exactly three. There is no fourth
 * "could not resolve" token: every reachable combination of the seven inputs
 * below resolves to one of these three through some named rule, including
 * the catch-all. */
export const GATE_OUTCOMES = Object.freeze(["green", "acknowledged", "red"] as const);
export type GateOutcome = (typeof GATE_OUTCOMES)[number];

/** The rebuild outcome is the byte-diff oracle's OWN outcome type, reused by
 * import -- never a second, locally declared token list. `"skipped"` means
 * no assembler ran and is never a pass; see `acme-verify.ts`'s own JSDoc on
 * `AcmeOutcome`. */
export type RebuildOutcome = AcmeOutcome;
const REBUILD_OUTCOMES: readonly RebuildOutcome[] = Object.freeze(["ok", "failed", "skipped"]);

/** The rebuild outcome type widened by one value the byte-diff oracle itself
 * cannot produce: `"refused"`, emitted when the gate was handed no movement
 * input at all, or one whose relocation delta is zero -- a same-address
 * round trip exercises nothing about whether a MOVED layout still rebuilds.
 * See `movementRebuildFromResult()` below for that derivation. */
export type MovementOutcome = RebuildOutcome | "refused";
const MOVEMENT_OUTCOMES: readonly MovementOutcome[] = Object.freeze(["ok", "failed", "skipped", "refused"]);

export const HAZARD_DISPOSITIONS = Object.freeze(["clean", "acknowledged", "blocked"] as const);
export type HazardDisposition = (typeof HAZARD_DISPOSITIONS)[number];

export const DIFF_SCOPE_COVERAGES = Object.freeze(["complete", "incomplete"] as const);
export type DiffScopeCoverage = (typeof DIFF_SCOPE_COVERAGES)[number];

export const RED_CONTROLS_OBSERVATIONS = Object.freeze(["all-observed", "partial", "none"] as const);
export type RedControlsObservation = (typeof RED_CONTROLS_OBSERVATIONS)[number];

/** Shared by both `SECOND_PATH_GUARD` and `ORDERING_PROOF` -- the two guard
 * inputs have the identical value domain, so this is ONE declared type read
 * by both fields rather than two copies of the same two-member set. */
export const GUARD_OBSERVATIONS = Object.freeze(["held", "breached"] as const);
export type GuardObservation = (typeof GUARD_OBSERVATIONS)[number];

/**
 * What a movement producer (a later plan's own module) reports about ONE
 * relocation attempt. Declared HERE so the gate's shape is fixed before that
 * producer exists -- wiring a real one in later is an import, not a
 * redesign. Every field is nullable only where a genuine refusal has
 * nothing to report (e.g. no symbol was ever chosen).
 */
export interface MovementResult {
  outcome: MovementOutcome;
  /** The relocated symbol's name, or `null` when nothing was chosen (a
   * refusal with no symbol to name). */
  symbolName: string | null;
  /** Signed distance the symbol moved, in bytes. `0` means a same-address
   * round trip -- see `movementRebuildFromResult()`'s own refusal for that
   * value. `null` only when no relocation was attempted at all. */
  relocationDelta: number | null;
  originalAddress: number | null;
  relocatedAddress: number | null;
  /** Why the outcome is what it is, in words a human can act on. */
  reason: string;
}

/**
 * What a hazard-acknowledgement producer (a later plan's own module)
 * reports after matching a hazard report's findings against an operator's
 * acknowledgements. Declared HERE for the same reason `MovementResult` is:
 * the gate's shape exists before its producer does.
 */
export interface HazardAcknowledgementResult {
  disposition: HazardDisposition;
  /** Findings matched by exactly one acknowledgement carrying a non-empty
   * reason. A finding's identity for matching purposes is the triple of its
   * hazard class, anchor address and mechanism taken together -- never the
   * anchor address alone, since one address can carry findings under two
   * distinct mechanisms and the finding type carries no identity field of
   * its own. */
  acknowledgedFindings: readonly HazardFinding[];
  /** Findings matched by zero acknowledgements. */
  unacknowledgedFindings: readonly HazardFinding[];
  /** Findings whose match was AMBIGUOUS -- matched by more than one
   * acknowledgement. An ambiguous match is treated as no match, never
   * resolved in the acknowledger's favour. */
  ambiguousAcknowledgements: readonly HazardFinding[];
  reason: string;
}

/** A half-open byte extent: `start` is inside, `endExclusive` is outside. */
export interface DiffScopeExtent {
  start: number;
  endExclusive: number;
}

/**
 * The seven gate inputs, spelled EXACTLY as the committed schema declares
 * them, ALL REQUIRED. Every consumer branches on the verdict token, so a
 * caller that could omit the movement or hazard input could obtain a pass
 * from a gate that never ran one of its rules -- recording a shortfall in a
 * string while the field a human reads says green is the same failure as
 * trusting a summary line. Required fields move the property from RECORDED
 * to IMPOSSIBLE: the compiler rejects a call site that omits one. The
 * runtime absence rule (`runReassemblyGate()`'s first rule) is the
 * defence-in-depth half of the same property, for a caller the type system
 * cannot see -- untyped JS, or a value assembled from parsed text.
 */
export interface GateInput {
  TREE_REBUILD: RebuildOutcome;
  MOVEMENT_REBUILD: MovementOutcome;
  HAZARD_DISPOSITION: HazardDisposition;
  DIFF_SCOPE_COVERAGE: DiffScopeCoverage;
  RED_CONTROLS: RedControlsObservation;
  SECOND_PATH_GUARD: GuardObservation;
  ORDERING_PROOF: GuardObservation;
}

/** The gate's verdict: the outcome token, the id of the rule that produced
 * it, the resolved value of every input keyed by its schema name, and a
 * reason a human can act on. */
export interface GateVerdict {
  outcome: GateOutcome;
  /** `"R1"` through `"R12"` -- the id of the FIRST rule whose condition
   * held, per the committed rule table's first-match-wins order. */
  rule: string;
  inputs: GateInput;
  reason: string;
}

/** One entry of the absence/domain check the gate's first rule runs. */
interface DomainCheck {
  key: keyof GateInput;
  domain: readonly string[];
}

const DOMAIN_CHECKS: readonly DomainCheck[] = Object.freeze([
  { key: "TREE_REBUILD", domain: REBUILD_OUTCOMES },
  { key: "MOVEMENT_REBUILD", domain: MOVEMENT_OUTCOMES },
  { key: "HAZARD_DISPOSITION", domain: HAZARD_DISPOSITIONS },
  { key: "DIFF_SCOPE_COVERAGE", domain: DIFF_SCOPE_COVERAGES },
  { key: "RED_CONTROLS", domain: RED_CONTROLS_OBSERVATIONS },
  { key: "SECOND_PATH_GUARD", domain: GUARD_OBSERVATIONS },
  { key: "ORDERING_PROOF", domain: GUARD_OBSERVATIONS },
]);

function isDomainMember(value: unknown, domain: readonly string[]): value is string {
  return typeof value === "string" && domain.includes(value);
}

/**
 * Derives the `MOVEMENT_REBUILD` gate input from a movement producer's own
 * result, stated once here rather than re-derived at every call site. `null`
 * -- no movement input at all -- and a
 * `relocationDelta` of exactly `0` -- a same-address round trip -- both
 * derive to `"refused"`, never to the producer's own reported outcome:
 * relocating a symbol to its own existing address exercises nothing about
 * whether a MOVED layout still rebuilds, so recording it as `"ok"` would let
 * the gate's movement requirement be satisfied vacuously. Every other case
 * passes the producer's own outcome through unchanged.
 */
export function movementRebuildFromResult(movement: MovementResult | null): MovementOutcome {
  if (movement === null) return "refused";
  if (movement.relocationDelta === 0) return "refused";
  return movement.outcome;
}

/**
 * Given a hazard report's findings and the half-open byte extent an export
 * run actually diffed, returns the `DIFF_SCOPE_COVERAGE` token together with
 * every finding whose anchor address, or non-null blocked address, falls
 * OUTSIDE that extent.
 *
 * MEMBERSHIP IS HALF-OPEN: `extent.start` is INSIDE, `extent.endExclusive`
 * is OUTSIDE. An off-by-one here would silently narrow what the gate
 * actually checked -- a byte-diff over a narrowed scope can be perfectly
 * clean while a hazard-anchored range was never compared at all.
 */
export function hazardCoverageOutsideDiffScope(
  findings: readonly HazardFinding[],
  extent: DiffScopeExtent
): { coverage: DiffScopeCoverage; outside: readonly HazardFinding[] } {
  const outside = findings.filter((finding) => {
    const anchorOutside = finding.anchorAddress < extent.start || finding.anchorAddress >= extent.endExclusive;
    const blockedOutside =
      finding.blockedAddress !== null && (finding.blockedAddress < extent.start || finding.blockedAddress >= extent.endExclusive);
    return anchorOutside || blockedOutside;
  });
  return { coverage: outside.length === 0 ? "complete" : "incomplete", outside };
}

/**
 * The gate. Implements the committed rule table's twelve rules, in order,
 * first match wins. Reads no exit status, opens no file, spawns nothing --
 * every input arrives already resolved, and this function's only job is to
 * find the first rule whose condition holds and record it.
 *
 * The FIRST rule is the runtime absence/domain check: any of the seven
 * inputs missing, or carrying a value outside its declared domain, resolves
 * to `"red"` through this rule rather than throwing -- absence is never a
 * pass, and a thrown error here would read to a caller as a broken harness
 * rather than a refusal.
 *
 * The LAST rule is the unconditional catch-all: an input combination none of
 * the eleven rules above matched is an unanticipated state and is never a
 * pass. Given the domain check that already ran, every input is a member of
 * its declared set by the time rule ten and eleven are reached, so the
 * catch-all is unreachable in practice -- it exists as the structural proof
 * that the rule table's output space is exactly `{green, acknowledged,
 * red}`, never a fourth "could not resolve" token.
 */
export function runReassemblyGate(input: GateInput): GateVerdict {
  const record = input as unknown as Record<string, unknown> | null | undefined;

  // R1: absence / out-of-domain check, ahead of everything else.
  for (const { key, domain } of DOMAIN_CHECKS) {
    const value = record?.[key];
    if (!isDomainMember(value, domain)) {
      return {
        outcome: "red",
        rule: "R1",
        inputs: input,
        reason:
          `R1: ${key} is absent or outside its declared domain (${domain.join(" | ")}) -- absence is never a pass, ` +
          `and this phase is incomplete until every declared input carries a real value.`,
      };
    }
  }

  const { TREE_REBUILD, MOVEMENT_REBUILD, HAZARD_DISPOSITION, DIFF_SCOPE_COVERAGE, RED_CONTROLS, SECOND_PATH_GUARD, ORDERING_PROOF } = input;

  // R2: rules written after a measurement make the whole instrument advisory.
  if (ORDERING_PROOF === "breached") {
    return {
      outcome: "red",
      rule: "R2",
      inputs: input,
      reason: "R2: ORDERING_PROOF is breached -- rules written after a measurement make the whole instrument advisory, so nothing evaluated below this rule can be trusted regardless of what it reads.",
    };
  }

  // R3: an unaudited second spawn or comparison site means no byte result below means anything.
  if (SECOND_PATH_GUARD === "breached") {
    return {
      outcome: "red",
      rule: "R3",
      inputs: input,
      reason: "R3: SECOND_PATH_GUARD is breached -- the byte-diff this gate reports may not be the one it claims to have run.",
    };
  }

  // R4: no assembler ran on one of the two rebuilds -- no claim about the bytes exists.
  if (TREE_REBUILD === "skipped" || MOVEMENT_REBUILD === "skipped") {
    return {
      outcome: "red",
      rule: "R4",
      inputs: input,
      reason: "R4: TREE_REBUILD or MOVEMENT_REBUILD is skipped -- no assembler ran, so no claim about the bytes exists.",
    };
  }

  // R5: movement is exercised on every run, never optionally.
  if (MOVEMENT_REBUILD === "refused") {
    return {
      outcome: "red",
      rule: "R5",
      inputs: input,
      reason: "R5: MOVEMENT_REBUILD is refused -- a same-address round trip or an absent movement input is a refusal, not a pass.",
    };
  }

  // R6: a byte-diff mismatch against the exporter's own expected bytes is a failure.
  if (TREE_REBUILD === "failed" || MOVEMENT_REBUILD === "failed") {
    return {
      outcome: "red",
      rule: "R6",
      inputs: input,
      reason: "R6: TREE_REBUILD or MOVEMENT_REBUILD is failed -- the assembled bytes disagreed with the exporter's own expected bytes.",
    };
  }

  // R7: a hazard-adjacent range may never have been diffed at all.
  if (DIFF_SCOPE_COVERAGE === "incomplete") {
    return {
      outcome: "red",
      rule: "R7",
      inputs: input,
      reason: "R7: DIFF_SCOPE_COVERAGE is incomplete -- a clean byte-diff over a narrowed scope is silence about the bytes it never compared.",
    };
  }

  // R8: a green result is not trusted before the planted controls have gone red in the same run.
  if (RED_CONTROLS === "partial" || RED_CONTROLS === "none") {
    return {
      outcome: "red",
      rule: "R8",
      inputs: input,
      reason: `R8: RED_CONTROLS is "${RED_CONTROLS}" -- a green result is not trusted before the planted controls have been observed going red in the same run.`,
    };
  }

  // R9: a non-clean hazard report blocks the gate outright.
  if (HAZARD_DISPOSITION === "blocked") {
    return {
      outcome: "red",
      rule: "R9",
      inputs: input,
      reason: "R9: HAZARD_DISPOSITION is blocked.",
    };
  }

  // R10: an explicit, recorded, per-finding acknowledgement is the only path
  // from "hazard found" to anything other than red -- never a silent green.
  // Everything else at this point is already known to be at its passing
  // value: R2..R8 above excluded every non-passing state for the other six
  // inputs, and R1 excluded any value outside a declared domain.
  if (HAZARD_DISPOSITION === "acknowledged") {
    return {
      outcome: "acknowledged",
      rule: "R10",
      inputs: input,
      reason: "R10: HAZARD_DISPOSITION is acknowledged and every other input is at its passing value.",
    };
  }

  // R11: the only rule that can produce green, and it requires every other
  // criterion's passing condition simultaneously -- HAZARD_DISPOSITION must
  // be clean, since R9 already excluded blocked and R10 already excluded
  // acknowledged.
  if (HAZARD_DISPOSITION === "clean") {
    return {
      outcome: "green",
      rule: "R11",
      inputs: input,
      reason: "R11: every input is at its passing value with HAZARD_DISPOSITION clean.",
    };
  }

  // R12: catch-all. Structurally unreachable given the domain check above,
  // and kept anyway -- an input combination no rule above matched is an
  // unanticipated state and is never a pass.
  return {
    outcome: "red",
    rule: "R12",
    inputs: input,
    reason: "R12: an input combination no rule above matched -- an unanticipated state is never a pass.",
  };
}
