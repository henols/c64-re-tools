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
// JSON string, with the C64 constant's exact literal value defined once,
// below, as `R2000_SYSTEM_C64`.
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
// `.planning/todos/completed/2026-08-20-vsf-as-a-bootstrap-input.md`. (This is
// a comment, not a user-facing string literal, so it is fixed here by hand
// rather than by `docs-dangling-refs.test.ts`'s guard -- see that guard's
// header for why it is deliberately scoped to string literals only.)
//
// TWO SETTINGS SURFACES (18-02, D18-32/D18-33/D18-34): this module owns two
// distinct settings surfaces, not one. `synthesizeProject()` (above) forces
// the settings on a brand-new project it is building from raw bytes.
// `ensureProjectSettings()` (below) forces the SAME settings on an EXISTING
// `.regen2000proj` on disk, read, corrected, and rewritten in place -- the
// ROADMAP gap this closes is that the synthesiser only ever ran once, at
// creation, so a session re-opening an older project had no path back to a
// forced `use_illegal_opcodes`. The two surfaces share exactly one thing on
// purpose -- the `R2000_SYSTEM_C64` constant and the forced-`true` literal
// convention -- and nothing else; `ensureProjectSettings()` is written fresh
// below, never lifted out of `synthesizeProject()`'s body, which this
// change leaves byte-for-byte untouched.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";

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

export interface R2000ProjectSettingsErrorOptions {
  cause?: unknown;
  projectPath: string;
}

/**
 * Thrown by `ensureProjectSettings()` for every one of its distinguishable
 * refusals (unreadable path, malformed JSON, a non-object top level, a
 * `settings.system` mismatch). Carries `projectPath` as a public field,
 * mirroring `r2000-mcp-client.ts`'s named-error convention -- a caller must
 * never need to parse this error's message text to recover the path that
 * failed.
 */
export class R2000ProjectSettingsError extends Error {
  projectPath: string;

  constructor(message: string, { cause, projectPath }: R2000ProjectSettingsErrorOptions) {
    super(message);
    this.name = "R2000ProjectSettingsError";
    this.projectPath = projectPath;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

export interface EnsureProjectSettingsOptions {
  /** Overrides the expected `settings.system` value. Defaults to
   * `R2000_SYSTEM_C64` -- the same constant `synthesizeProject()` defaults
   * to, so both callers of this forced-values convention read from one
   * shared source rather than two copies that could drift apart. */
  system?: string;
}

/**
 * Reads an EXISTING `.regen2000proj` from `projectPath`, force-corrects its
 * settings in place, and rewrites the file -- the read-parse-force-rewrite
 * pass `synthesizeProject()` has no equivalent of, because that function
 * only ever builds a brand-new project from raw bytes.
 *
 * WHY THIS EXISTS: `synthesizeProject()` forces `use_illegal_opcodes` only
 * at creation time. A session re-opening a project synthesised (or
 * hand-edited) before that forcing existed, or one whose setting was
 * otherwise reset to `false`, would otherwise silently re-degrade every
 * illegal opcode back to an opaque `!byte` fallback on export -- exactly the
 * defect this project's own now-removed `toacme` caveats were about. This
 * function closes that gap for the ONE window it is legal to run in: before
 * a regenerator2000 child owns the file (a live session's own tool surface,
 * never this function, is the only other place allowed to touch settings
 * once a child has the project open).
 *
 * WHY `use_illegal_opcodes` IS FORCED SILENTLY BUT `system` IS A NAMED
 * REFUSAL: forcing illegal-opcode decoding only ever widens what decodes
 * correctly on export -- there is no existing annotation it could
 * invalidate. Rewriting the machine type is different: an already-annotated
 * project's block classifications were made against a specific machine, and
 * silently reinterpreting that value could invalidate every one of them.
 * A `settings.system` mismatch is therefore a refusal a human reads, never a
 * repair (D18-34).
 *
 * Returns `{ changed: false }` without touching the file at all when nothing
 * needed correcting (an idempotent open must not churn the file's mtime).
 * Returns `{ changed: true }` after replacing the file via the write-temp-
 * then-`renameSync` idiom already used by `refresh-manifest.ts` and
 * `broker-epoch.mts`, so a crash mid-write can never leave a truncated
 * project file behind.
 */
export function ensureProjectSettings(
  projectPath: string,
  opts: EnsureProjectSettingsOptions = {},
): { changed: boolean } {
  const expectedSystem = opts.system ?? R2000_SYSTEM_C64;

  let raw: string;
  try {
    raw = readFileSync(projectPath, "utf8");
  } catch (err) {
    throw new R2000ProjectSettingsError(
      `ensureProjectSettings: could not read ${projectPath} -- ${err instanceof Error ? err.message : String(err)}`,
      { cause: err, projectPath },
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new R2000ProjectSettingsError(
      `ensureProjectSettings: ${projectPath} is not valid JSON -- ${err instanceof Error ? err.message : String(err)}`,
      { cause: err, projectPath },
    );
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new R2000ProjectSettingsError(
      `ensureProjectSettings: ${projectPath}'s top-level JSON value is not an object -- refusing to write ` +
        `a settings key onto a non-object project file`,
      { projectPath },
    );
  }

  const project = parsed as Record<string, unknown>;
  const existingSettings =
    typeof project.settings === "object" && project.settings !== null && !Array.isArray(project.settings)
      ? (project.settings as Record<string, unknown>)
      : undefined;

  const foundSystem = existingSettings?.system;
  if (foundSystem !== undefined && foundSystem !== expectedSystem) {
    throw new R2000ProjectSettingsError(
      `ensureProjectSettings: ${projectPath}'s settings.system is ${JSON.stringify(foundSystem)}, expected ` +
        `${JSON.stringify(expectedSystem)} -- refusing to rewrite the machine type of an already-annotated ` +
        `project (D18-34)`,
      { projectPath },
    );
  }

  const alreadyForced = existingSettings?.use_illegal_opcodes === true;
  const systemAlreadySet = foundSystem === expectedSystem;
  if (alreadyForced && systemAlreadySet) {
    return { changed: false };
  }

  // Forced true, never configurable -- mirrors synthesizeProject()'s own
  // "do not add a parameter that overrides this" convention above. Always
  // written explicitly, never omitted, matching D18-34/D-05.
  project.settings = {
    ...(existingSettings ?? {}),
    use_illegal_opcodes: true,
    system: expectedSystem,
  };

  const serialized = JSON.stringify(project);
  const tmpPath = `${projectPath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(tmpPath, serialized);
  renameSync(tmpPath, projectPath);

  return { changed: true };
}
