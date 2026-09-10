#!/usr/bin/env node
// evid-ingest.ts
//
// Plan 43-05 (EVID-01, EVID-04): THE ONE PLACE a parsed `memmapshow` access
// map (`textmon-memmap.ts`'s `AccessMap`) becomes durable-store-shaped
// observation rows. `anno-tools.ts`'s `anno_evid_ingest` dispatch arm calls
// this module's pure functions and then, and only then, writes what they
// return through `anno-store.ts`'s `insertExecObservations`.
//
// THE ONE POSITIVE FACT THIS LAYER IS LICENSED TO ASSERT (quoted from this
// plan's own objective, verbatim, so a later reader never has to re-derive
// it): "A row is written if and only if an address's `ram.execute`,
// `rom.execute` or `io.execute` flag is true in the parsed reply. Nothing
// else produces a row." An address `memmapshow` mentioned with read or
// write access but no execute produces no row, and an address absent from
// the sparse `entries` array produces no row either -- those are two
// DIFFERENT facts about the world, and neither is recoverable from the
// store's row set alone, only from the reply itself. That is correct and is
// the point: the store holds observed execution, and the absence of a row
// is not a fact the store asserts about the address. It is the absence of
// an assertion.
//
// Read-and-write-only observations are deliberately NOT stored here. The
// schema can gain a separate table for them later without a migration,
// because it would be a wholly new table -- the store's existing additive
// discipline.
//
// WHY THE VERB TAKES AN ARGV ARRAY AND NEVER A DIGEST: a caller-supplied
// pre-computed digest would let a caller invent a run identity, a second
// notion of sameness sitting beside EVID-01's own. `runIdentityFrom()`
// below computes `argvDigest` itself, from the exact `argv` the caller
// supplies, through the ONE shipped digest function
// (`capture-predicate.ts`'s `argvDigest()`) and nothing else -- there is no
// code path here that accepts a digest as input.
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER write a row from an address's ABSENCE. `execObservationsFrom()`
//      only ever iterates `map.entries` -- the sparse array VICE actually
//      sent -- and never pads it back out to the full address space. An
//      address absent from `entries` produces nothing, silently, by
//      construction: there is no branch here that could emit a row for it.
//   2. NEVER merge two banks' execute bits into one row. `ram.execute`,
//      `rom.execute` and `io.execute` are three independent facts
//      (`textmon-memmap.ts`'s own header states this for `AccessFlags`);
//      this module emits at most one observation per (address, bank) pair,
//      never a combined "any bank executed" row.
//   3. NEVER accept a pre-computed argv digest. `runIdentityFrom()`'s ONLY
//      input for identity is `argv` itself; there is no `argvDigest`
//      parameter anywhere in this module's exported surface.
//   4. NEVER open a store here. This module imports nothing from
//      `anno-store.ts` and touches no filesystem, transport or
//      child-process -- the write happens in `anno-tools.ts`'s dispatch
//      arm, which is what keeps this module out of `anno-seam.test.ts`'s
//      single-consumer set (`anno-store.ts` remains the one module naming
//      `node:sqlite`).
//   5. NEVER read `.read` or `.write` off an `AccessFlags` value anywhere in
//      this file. Only `.execute` is ever inspected -- read-and-write-only
//      access is deliberately not this layer's concern (see the header
//      above).
import type { AccessMap, AccessMapParseResult } from "./textmon-memmap.ts";
import { argvDigest } from "./capture-predicate.ts";
import { EVID_SOURCE_BANKS, type EvidSourceBank } from "./anno-types.ts";
import { ViceError } from "./vice.ts";

/** One observed execute bit: this address, in this source bank, was seen
 * executing. There is no third field -- an `ExecObservation` carries no
 * opinion about whether the address is "code" or "data"; it is a single,
 * narrow fact about what the emulator actually did. */
export interface ExecObservation {
  readonly address: number;
  readonly sourceBank: EvidSourceBank;
}

/** Exactly 64 lowercase hex characters -- the shape a sha256 digest (an
 * image hash, or `argvDigest()`'s own output) always takes. This module's
 * OWN copy of the check, deliberately not imported from `anno-types.ts`
 * (this file's import list is closed to exactly the five named imports
 * above): the caller-supplied `imageSha256` never reaches a digest
 * function here, so there is nothing to route through `argvDigest`'s own
 * shape, and duplicating a four-line regex check is cheaper than widening
 * this module's import surface for it. */
const RUN_IDENTITY_DIGEST_RE = /^[0-9a-f]{64}$/;

/** The exact launch identity a caller must supply. `runClass` exists ONLY
 * on plan 43-01's `promote` branch decision and is never read by this
 * module's `no-change` implementation -- carried in the type so a future
 * `promote` branch has somewhere to put it without a second interface. */
export interface IngestRunIdentity {
  readonly imageSha256: string;
  readonly argv: readonly string[];
  readonly seed: string;
}

/** `runIdentityFrom()`'s answer: the bare `(imageSha256, argvDigest, seed)`
 * triple the `no-change` run-identity decision selected (plan 43-01,
 * `docs/phase43-instrumentation-perturbation-ab.md`) -- no `runClass`
 * discriminator field exists on this type. */
export interface RunIdentity {
  readonly imageSha256: string;
  readonly argvDigest: string;
  readonly seed: string;
}

/** Validates `identity.imageSha256` and `identity.seed`, then computes
 * `argvDigest` from `identity.argv` through the ONE shipped digest function
 * -- and nothing else. Refuses BY NAME, throwing inside the `ViceError`
 * family so the anno never-throw boundary (`anno-tools.ts`'s
 * `runAnnoTool()`) can name the class in its `{isError:true}` answer:
 *
 *   - `imageSha256` that is not exactly 64 lowercase hex characters
 *     (the program image is named by its bytes; a malformed digest here
 *     would silently key a run under the wrong image identity forever).
 *   - `seed` that is not a non-empty string.
 *   - `argv` that is not an array, or an empty array -- both refusals are
 *     `argvDigest()`'s OWN (this function never duplicates that check; it
 *     lets `argvDigest()` throw and re-wraps the message as a `ViceError`
 *     so the caller sees one error family regardless of which check fired).
 *
 * `argvDigest()` is the ONLY place `argv` becomes an identity: there is no
 * second hashing site here, and no parameter anywhere on this module's
 * surface through which a caller could hand in an already-computed digest.
 */
export function runIdentityFrom(identity: IngestRunIdentity): RunIdentity {
  if (typeof identity?.imageSha256 !== "string" || !RUN_IDENTITY_DIGEST_RE.test(identity.imageSha256)) {
    throw new ViceError(
      `runIdentityFrom: imageSha256 ${JSON.stringify(identity?.imageSha256)} is not exactly 64 lowercase hex characters -- ` +
        "expected the sha256 digest of the program image's own bytes.",
      { code: "evid-ingest-bad-image-sha256" },
    );
  }
  if (typeof identity.seed !== "string" || identity.seed.length === 0) {
    throw new ViceError(`runIdentityFrom: seed ${JSON.stringify(identity.seed)} is not a non-empty string.`, {
      code: "evid-ingest-bad-seed",
    });
  }

  let digest: string;
  try {
    digest = argvDigest(identity.argv);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new ViceError(`runIdentityFrom: ${reason}`, { code: "evid-ingest-bad-argv" });
  }

  return { imageSha256: identity.imageSha256, argvDigest: digest, seed: identity.seed };
}

/**
 * The pure transform (EVID-01, EVID-04): one observation per (address,
 * bank) pair whose `execute` flag is `true` in `map.entries`, sorted
 * ascending by address then by the bank's index in `EVID_SOURCE_BANKS`'s
 * frozen order (`ram`, `rom`, `io`). One pass over `map.entries`; never
 * reads `.read` or `.write`; never derives an observation from an address's
 * absence, because the loop only ever visits addresses `map.entries`
 * actually contains.
 */
export function execObservationsFrom(map: AccessMap): ExecObservation[] {
  const observations: ExecObservation[] = [];
  for (const entry of map.entries) {
    for (const bank of EVID_SOURCE_BANKS) {
      if (entry[bank].execute) {
        observations.push({ address: entry.address, sourceBank: bank });
      }
    }
  }
  observations.sort((a, b) => {
    if (a.address !== b.address) return a.address - b.address;
    return EVID_SOURCE_BANKS.indexOf(a.sourceBank) - EVID_SOURCE_BANKS.indexOf(b.sourceBank);
  });
  return observations;
}

/** `ingestAccessMap()`'s success arm: the derived run identity plus the
 * sorted observation list -- exactly what `anno-tools.ts`'s dispatch arm
 * hands to `insertExecObservations()` in one call. */
export interface IngestAccessMapOk {
  readonly ok: true;
  readonly runIdentity: RunIdentity;
  readonly observations: readonly ExecObservation[];
}

/** `ingestAccessMap()`'s refusal arm: the parse refusal's own code, line
 * number and offending line, carried through UNABSORBED -- a drifted or
 * malformed `memmapshow` reply is never silently treated as a zero-entry
 * capture. */
export interface IngestAccessMapRefusal {
  readonly ok: false;
  readonly message: string;
}

export type IngestAccessMapResult = IngestAccessMapOk | IngestAccessMapRefusal;

/**
 * The one join of a parse result and a run identity into observations ready
 * to write. THIS FUNCTION DOES NOT WRITE -- it is pure, and the store write
 * happens in `anno-tools.ts`'s dispatch arm.
 *
 * On `parsed.ok === false`, returns the refusal form carrying the refusal's
 * own code, line number and offending line, and touches nothing else --
 * neither `runIdentityFrom()` nor `execObservationsFrom()` is ever called on
 * a refused parse, because there is nothing in a refusal to derive either
 * from.
 */
export function ingestAccessMap(parsed: AccessMapParseResult, identity: IngestRunIdentity): IngestAccessMapResult {
  if (!parsed.ok) {
    const { refusal } = parsed;
    return {
      ok: false,
      message: `memmapshow reply refused [${refusal.code}] at line ${refusal.lineNumber}: ${refusal.message} (offending line: ${JSON.stringify(refusal.line)})`,
    };
  }
  const runIdentity = runIdentityFrom(identity);
  const observations = execObservationsFrom(parsed.value);
  return { ok: true, runIdentity, observations };
}
