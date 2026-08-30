#!/usr/bin/env node
// prg-image.ts -- the ONE authoritative place in this repo holding pure C64
// image byte-layout knowledge: how a `.prg` splits into a load address plus a
// body, what load address a flat 64K RAM capture has, and how to invert a
// gzip-then-base64 payload back into bytes. These are facts about C64 file
// formats and about one payload encoding -- they depend on no external
// analyser, no emulator, and no annotation store, so they belong in a module
// none of those can take with them when it goes away.
//
// This module performs NO filesystem and NO network I/O: every function takes
// bytes (or a base64 string) and returns values. Callers obtain and persist
// the bytes themselves. That is the same claim `r2000-project.ts` makes about
// itself, and it must remain true of both files now that the split has
// happened -- a structural test in `prg-image.test.ts` asserts it from this
// module's own source rather than trusting this paragraph.
//
// WHY THIS FILE EXISTS SEPARATELY: these three functions used to live in
// `r2000-project.ts`, the module that builds a `.regen2000proj` file for the
// regenerator2000 analyser. They were never about that analyser. One of them
// is imported statically by the byte-coverage census (`anno-coverage.ts`), a
// capability that must keep working independently of whether this repo still
// drives that analyser at all -- so a census whose only route to a payload
// decoder ran through analyser glue was one deletion away from breaking with
// no announcement (SEAM-02). Extracting them under a name that carries no
// analyser prefix removes that coupling outright instead of recording it as a
// hazard to remember later. There is deliberately NO re-export left behind in
// `r2000-project.ts`: a compatibility shim would leave the coupling fully
// intact while looking finished.
//
// THIS MODULE MUST BE LISTED IN `package.json`'s `files[]`. It is reachable
// from the published entry point's import closure, and the STATIC route is
// named here first because it is the stronger reachability claim: `anno-
// tools.ts` -- the curated `anno_*` MCP tool surface -- imports `parsePrg` and
// `flatImageOrigin` from here with a plain top-level import, and `vice-proxy.ts`
// imports `anno-tools.ts` statically. `anno-coverage.ts` (the byte-coverage
// census) imports `decodeRawData`, `parsePrg` and `flatImageOrigin` for the
// same three facts on the CLI's route. `scripts/check-npm-packages.mjs` walks
// that closure over `files[]` and fails the pack the moment a reachable module
// sits outside the listed set, exactly as `anno-d64.ts`'s own header records
// for the same reason.
//
// CORRECTED 2026-08-30 (WR-07, plan 29-16). This paragraph previously named
// `anno-cli.ts` as importing `parsePrg` and `flatImageOrigin` and rested the
// whole reachability claim on the DYNAMIC import that reaches that file. That
// was doubly wrong: `anno-cli.ts` imported neither symbol (it imported
// `decodeRawData` only), and it now imports nothing from here at all -- its
// image decode delegates to `anno-coverage.ts`'s `loadProjectImage()`. A
// stated reason for shipping a file has to be true or it is worse than absent.
//
// WHAT NOT TO DO:
//   - Never give any function here a filesystem PATH parameter. They take byte
//     arrays and a base64 string, which is precisely what keeps path traversal
//     out of this module's threat surface entirely. Path resolution belongs to
//     the CLI. For the same reason this module imports nothing from either of
//     this repo's two host/container path-translation seams; that absence is
//     asserted structurally by `hostpath-consumers.test.ts`, not merely stated
//     here.
//   - Never relax, reword or reorder either input refusal below. The concrete
//     incident: a 4096-byte flat `.raw` capture fell through to the `.prg`
//     parser, whose first two bytes become the load address, so a truncated
//     capture silently "bootstrapped" with an origin read backwards out of its
//     own payload bytes and exited zero -- every downstream address wrong, no
//     diagnostic. The refusal message texts are a user-visible contract: both
//     `anno-tools.ts`'s `loadImage()` and `anno-coverage.ts`'s
//     `loadProjectImage()` prefix them with the caller's own image path, and
//     tests on both routes match on their wording, so a reworded message
//     breaks a test for a reason that looks unrelated. (Attribution corrected
//     2026-08-30, WR-07: this line named `anno-cli.ts`, which prefixed them
//     through a `bootstrap` verb deleted in phase 29, D-14.)
//   - Never add the dispatch ORDER discipline here. Which check runs first for
//     a given input extension belongs to the two loaders that own it --
//     `anno-tools.ts`'s `loadImage()` for the MCP tool surface and
//     `anno-coverage.ts`'s `loadProjectImage()` for the coverage verb. Both
//     dispatch `.raw`/`.bin` by extension BEFORE any length check, so that
//     `flatImageOrigin`'s named refusal is always reachable for those two
//     extensions. Neither function below may start inferring what kind of
//     image it was handed.

import { gunzipSync } from "node:zlib";

/**
 * Parses a `.prg` file: a little-endian 2-byte load address followed by the
 * payload bytes. This is the C64 program-file convention every C64 loader
 * (and this project's own `acme-build` output) already follows.
 */
export function parsePrg(bytes: Uint8Array): { origin: number; body: Uint8Array } {
  if (bytes.length < 3) {
    throw new Error(
      `parsePrg: input is ${bytes.length} byte(s) -- a .prg needs at least 3 bytes (2-byte load address plus at least 1 payload byte)`,
    );
  }
  const origin = bytes[0]! | (bytes[1]! << 8);
  const body = bytes.subarray(2);
  return { origin, body };
}

/**
 * Returns the load address (`0`) for a flat 64K RAM capture, and throws for
 * anything else. Flat 64K is in scope because `R2000-06` names it directly
 * and it is exactly the shape `c64-ram-capture` already produces (D-03) --
 * this function does not attempt to support any other flat-image size.
 */
export function flatImageOrigin(bytes: Uint8Array): number {
  if (bytes.length !== 65536) {
    throw new Error(
      `flatImageOrigin: input is ${bytes.length} byte(s) -- a flat 64K capture must be exactly 65536 bytes`,
    );
  }
  return 0;
}

/**
 * The inverse of a gzip-then-base64 payload encoding: base64-decode, then
 * gunzip. Exported so tests can prove the payload round-trips exactly,
 * rather than asserting against an opaque blob.
 */
export function decodeRawData(base64: string): Uint8Array {
  return gunzipSync(Buffer.from(base64, "base64"));
}
