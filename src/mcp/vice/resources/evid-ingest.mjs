#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from evid-ingest.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
import { argvDigest } from "./capture-predicate.mjs";
import { EVID_SOURCE_BANKS } from "./anno-types.mjs";
import { ViceError } from "./vice-errors.mjs";
/** Exactly 64 lowercase hex characters -- the shape a sha256 digest (an
 * image hash, or `argvDigest()`'s own output) always takes. This module's
 * OWN copy of the check, deliberately not imported from `anno-types.mts`
 * (this file's import list is closed to exactly the five named imports
 * above): the caller-supplied `imageSha256` never reaches a digest
 * function here, so there is nothing to route through `argvDigest`'s own
 * shape, and duplicating a four-line regex check is cheaper than widening
 * this module's import surface for it. */
const RUN_IDENTITY_DIGEST_RE = /^[0-9a-f]{64}$/;
/** Validates `identity.imageSha256` and `identity.seed`, then computes
 * `argvDigest` from `identity.argv` through the ONE shipped digest function
 * -- and nothing else. Refuses BY NAME, throwing inside the `ViceError`
 * family so the anno never-throw boundary (`anno-tools.mts`'s
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
export function runIdentityFrom(identity) {
    if (typeof identity?.imageSha256 !== "string" || !RUN_IDENTITY_DIGEST_RE.test(identity.imageSha256)) {
        throw new ViceError(`runIdentityFrom: imageSha256 ${JSON.stringify(identity?.imageSha256)} is not exactly 64 lowercase hex characters -- ` +
            "expected the sha256 digest of the program image's own bytes.", { code: "evid-ingest-bad-image-sha256" });
    }
    if (typeof identity.seed !== "string" || identity.seed.length === 0) {
        throw new ViceError(`runIdentityFrom: seed ${JSON.stringify(identity.seed)} is not a non-empty string.`, {
            code: "evid-ingest-bad-seed",
        });
    }
    let digest;
    try {
        digest = argvDigest(identity.argv);
    }
    catch (err) {
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
export function execObservationsFrom(map) {
    const observations = [];
    for (const entry of map.entries) {
        for (const bank of EVID_SOURCE_BANKS) {
            if (entry[bank].execute) {
                observations.push({ address: entry.address, sourceBank: bank });
            }
        }
    }
    observations.sort((a, b) => {
        if (a.address !== b.address)
            return a.address - b.address;
        return EVID_SOURCE_BANKS.indexOf(a.sourceBank) - EVID_SOURCE_BANKS.indexOf(b.sourceBank);
    });
    return observations;
}
/**
 * The one join of a parse result and a run identity into observations ready
 * to write. THIS FUNCTION DOES NOT WRITE -- it is pure, and the store write
 * happens in `anno-tools.mts`'s dispatch arm.
 *
 * On `parsed.ok === false`, returns the refusal form carrying the refusal's
 * own code, line number and offending line, and touches nothing else --
 * neither `runIdentityFrom()` nor `execObservationsFrom()` is ever called on
 * a refused parse, because there is nothing in a refusal to derive either
 * from.
 */
export function ingestAccessMap(parsed, identity) {
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
