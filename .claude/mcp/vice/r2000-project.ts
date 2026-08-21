#!/usr/bin/env node
// r2000-project.ts -- the ONE authoritative place in this repo that builds a
// `.regen2000proj` file. This module performs no filesystem or network I/O:
// callers read the source bytes and write the returned JSON text themselves;
// this module only transforms bytes into the wire shape regenerator2000
// loads. Nothing else in this repo may hand-build a project file -- if a
// future caller needs a `.regen2000proj`, it imports `synthesizeProject`
// from here rather than re-deriving the shape.
//
// WHY THIS EXISTS (D-01): Phase 9 already proved a working bootstrap route --
// drive the TUI's own Save-As flow over a synthetic pty and a scripted
// keystroke sequence. That route works, but it costs `tmux` as a declared
// prerequisite this project does not otherwise need, AND it still requires a
// post-save JSON edit to force `settings.use_illegal_opcodes` (the TUI's own
// Save-As does not expose that setting). Synthesising the project file
// directly in Node removes all four costs at once: no pty, no modal TUI, no
// keystroke encoding, no terminal-size assumption, and no post-edit -- the
// forced setting is written correctly the first time, by construction.
//
// WHAT NOT TO DO (two concrete past mistakes, both from Phase 9's own
// evidence and CONTEXT.md's D-01/D-04):
//   1. Do NOT write `raw_data_base64` as a plain (uncompressed) base64
//      payload. regenerator2000 loads the project file expecting the value
//      to be gzip-then-base64 encoded; an uncompressed payload was tried
//      during Phase 9's probe and failed to load with
//      `Error loading file: invalid gzip header`. Always run the bytes
//      through `node:zlib`'s `gzipSync` first.
//   2. Do NOT add a version pin or a `--version` allow-list anywhere near
//      this module. D-04 explicitly rejects that shape: it blocks a user on
//      a newer, perfectly working regenerator2000 build, and it still
//      cannot detect a schema break that lands *within* a permitted
//      version range. The compatibility strategy here is minimality --
//      write only the fields `ProjectState` requires (no `#[serde(default)]`
//      on the Rust side) plus the two deliberately-forced settings, and let
//      every other field's own default carry the rest. The self-check that
//      this is compatible is running a real regenerator2000 against the
//      synthesised file once (see `r2000-project.test.ts`'s gated
//      integration half), never a version table.
//
// Ground truth for the shape below was independently re-verified against the
// installed regenerator2000-core-0.9.20 crate source (not merely paraphrased
// from CONTEXT.md) -- see
// `.planning/phases/10-adoption-boundaries-automated-bootstrap-and-the-removal/evidence/10-environment-recheck.txt`
// for the file:line citations. Summary: `ProjectState`'s only three fields
// without a `#[serde(default...)]` are `origin`, `raw_data` (serde-renamed
// to `raw_data_base64`), and `blocks`; `origin` is `Addr`, a
// `#[serde(transparent)]` newtype over `u16`, so it serialises as a plain
// JSON number; and `System`, `DocumentSettings.system`'s type, is likewise
// `#[serde(transparent)]` over `String`, so `settings.system` is a plain
// JSON string, with the C64 constant equal to the exact literal
// `Commodore 64`.
//
// `.vsf` is deliberately NOT an input to this module (D-03). Phase 9 found
// `.vsf`'s machine-type field only reads correctly by coincidence --
// `"C64SC"` matches none of regenerator2000's literal `System` arms and
// falls through to that tool's own C64 default.
//
// FLOW-02 (D-11.1-01): this comment used to end by naming a specific
// numbered phase as the eventual owner of closing that gap. That phase
// shipped and never touched `.vsf` bootstrap, so the pointer was false the
// moment that phase closed -- a phase number is a planning artifact, not a
// durable remediation path. The idea is recorded as backlog, not assigned
// to any phase: see
// `.planning/todos/pending/2026-08-20-vsf-as-a-bootstrap-input.md`. (This is
// a comment, not a user-facing string literal, so it is fixed here by hand
// rather than by `docs-dangling-refs.test.ts`'s guard -- see that guard's
// header for why it is deliberately scoped to string literals only.)

import { gzipSync, gunzipSync } from "node:zlib";

/** The exact literal regenerator2000's `System::C64` constant serialises as
 * (`types.rs`, `#[serde(transparent)] pub struct System(String)`). This is
 * the only system string this module ever writes unless a caller passes an
 * explicit override. */
export const R2000_SYSTEM_C64 = "Commodore 64";

export interface SynthesizeOptions {
  /** Load address (`ProjectState.origin`). `Addr` is `#[serde(transparent)]`
   * over `u16`, so this is written as a plain JSON number -- never a hex
   * string, never an object. */
  origin: number;
  /** `DocumentSettings.system`, a plain JSON string. Defaults to
   * `R2000_SYSTEM_C64`. This module never infers, detects or defaults the
   * machine type from the payload bytes -- an explicit caller-supplied (or
   * defaulted-to-C64) value is the whole point (D-05): it is what makes
   * Phase 9's `.vsf` machine-type coincidence unreachable rather than
   * merely mitigated, because there is no inference path here to get
   * wrong. */
  system?: string;
}

/**
 * Builds the JSON text of a `.regen2000proj` file from raw program bytes.
 *
 * The object written is EXACTLY four top-level keys: `origin`,
 * `raw_data_base64`, `blocks`, and `settings` (itself exactly two keys:
 * `use_illegal_opcodes` and `system`). Every other `ProjectState` member
 * (`version`, `labels`, `user_side_comments`, `cursor_address`, and so on)
 * carries its own `#[serde(default...)]` on the Rust side, so omitting them
 * is the forward-compatibility strategy (D-04), not an oversight -- a field
 * this module does not write is a field a future regenerator2000 release
 * can freely add, rename the default of, or restructure without ever
 * breaking this synthesiser. `version` is deliberately not written; it
 * defaults to the crate's current `PROJECT_FORMAT_VERSION` on load.
 *
 * `settings.use_illegal_opcodes` and `settings.system` are deliberately NOT
 * configurable to be turned off or omitted -- there is no flag, no option,
 * no code path that skips writing either:
 *   - `use_illegal_opcodes` defaults to `false` on the Rust side
 *     (`settings.rs`). Illegal-opcode-*correct* decoding is the entire
 *     reason this project's now-removed `toacme` had caveats in the first
 *     place; making this setting optional here would silently reintroduce
 *     that exact defect as a configuration choice rather than closing it
 *     (D-05).
 *   - An explicit `system` on every synthesised project (rather than
 *     omitting the key and letting the Rust-side default apply) is what
 *     makes Phase 9's `.vsf` machine-type limit unreachable through this
 *     route rather than merely mitigated -- there is no coincidental
 *     fallback to fall into, because a value is always supplied.
 */
export function synthesizeProject(bytes: Uint8Array, opts: SynthesizeOptions): string {
  const { origin, system = R2000_SYSTEM_C64 } = opts;

  if (!Number.isInteger(origin) || origin < 0 || origin > 0xffff) {
    throw new Error(
      `synthesizeProject: origin ${origin} is out of range -- expected an integer 0..0xffff (0..65535)`,
    );
  }
  if (bytes.length === 0) {
    throw new Error("synthesizeProject: payload is empty -- a .regen2000proj must carry at least one byte");
  }

  const raw_data_base64 = gzipSync(bytes).toString("base64");

  const project = {
    origin,
    raw_data_base64,
    blocks: [] as unknown[],
    settings: {
      // Forced true, never configurable -- see the function doc comment
      // above and D-05. Do not add a parameter that overrides this.
      use_illegal_opcodes: true,
      // Always written explicitly, never omitted -- see the function doc
      // comment above and D-05/Phase 9's .vsf finding.
      system,
    },
  };

  return JSON.stringify(project);
}

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
 * The inverse of the `raw_data_base64` encoding step: base64-decode then
 * gunzip. Exported so tests can prove the payload round-trips exactly,
 * rather than asserting against an opaque blob.
 */
export function decodeRawData(base64: string): Uint8Array {
  return gunzipSync(Buffer.from(base64, "base64"));
}
