// Test-support module: a loader for the captured text-monitor fixtures this
// phase commits under fixtures/textmon/. This is the ONE place any test in
// this package loads a text-monitor capture's provenance sidecar -- no test
// file should hand-roll its own key-presence check.
//
// WHY THIS FILE EXISTS: binmon-fixtures.ts's whole contract is byte-exact
// binary-monitor response FRAMES -- STX, api_version, the 12-byte header,
// and a family of synthetic frame builders for cases no live emulator can
// produce. Text captures share NONE of that beyond the five provenance
// keys (D-18): a text-monitor reply is a plain-text command response with
// no header, no framing byte, and no api-version field at all. Widening
// binmon-fixtures.ts to also accept text payloads would falsify its own
// file-header claim of being the ONE place any test in this package builds
// or loads a binary-monitor frame, and would invite a text test to reach
// for a frame encoder it has no business touching. This sibling module
// reimplements the shared part -- the sidecar validation CONTRACT -- as its
// own copy, not an import: the contract (five required keys, refuse when
// any is absent) is shared; the loader is not.
//
// WHAT NOT TO DO: never import anything from binmon-fixtures.ts's frame-
// encoding surface here (encodeResponseFrame, VICE_STX, VICE_API_VERSION,
// RESPONSE_HEADER_LEN, VICE_BROADCAST_REQUEST_ID, or any of its synthetic*
// frame builders) -- reaching for a binary-frame encoder from a text-only
// loader is exactly the mistake this file's own separation from
// binmon-fixtures.ts exists to foreclose. Never widen binmon-fixtures.ts to
// accept text payloads instead of adding a sibling like this one. And never
// hand-edit a committed .txt payload or .json sidecar under fixtures/
// textmon/ -- every one is written by
// .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/
// evidence/fixture-capture.mjs from what a real binary actually returned; a
// fixture is regenerated, never corrected (see fixtures/textmon/README.md's
// own "Regenerate, never hand-edit" section).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The fixture directory resolved relative to this module -- never an
 * absolute path baked in at authoring time. */
export const TEXTMON_FIXTURE_DIR = join(HERE, "fixtures", "textmon");

/**
 * This module's OWN copy of the five required provenance keys --
 * binmon-fixtures.ts:228 declares the identical array, but this is not an
 * import of it (D-18): the CONTRACT is shared, the module is not. A sidecar
 * that omits any of these reads as an unstated claim, exactly the failure
 * mode binmon-fixtures.ts's own WR-09 fixed on the binary side -- a fixture
 * missing `synthetic` would otherwise silently read back as a real capture.
 */
export const REQUIRED_PROVENANCE_KEYS = ["capturedFrom", "viceVersion", "capturedAt", "command", "synthetic"] as const;

export interface MissingTextFixtureErrorOptions {
  path?: string;
  command?: string;
}

/** A named, local error -- not a bare ENOENT and not a runtime ViceError --
 * so a test can assert on the absence or corruption of a captured text
 * fixture without catching every other possible filesystem failure.
 * Mirrors binmon-fixtures.ts's MissingFixtureError constructor shape and
 * naming convention exactly; this is its own class, not a re-export, so a
 * caller can tell a text-fixture refusal from a binary-fixture refusal by
 * type alone. */
export class MissingTextFixtureError extends Error {
  path?: string;
  command?: string;

  constructor(message: string, { path, command }: MissingTextFixtureErrorOptions = {}) {
    super(message);
    this.name = "MissingTextFixtureError";
    this.path = path;
    this.command = command;
  }
}

export interface TextFixture {
  /** The authoritative payload bytes, read exactly as committed -- never
   * round-tripped through a string. `buffer.length` always equals the
   * on-disk `<caseName>.txt` file's byte length. */
  buffer: Buffer;
  /** The parsed provenance sidecar, guaranteed to carry every key in
   * REQUIRED_PROVENANCE_KEYS (the loader throws otherwise). */
  provenance: Record<string, unknown>;
  /** A lossily-decoded UTF-8 convenience string over the SAME bytes as
   * `buffer` -- documented as a convenience, never the authoritative value.
   * A caller that needs byte-exact behavior (e.g. asserting on
   * `flat-profile`'s narrow-no-break-space thousands separators) must use
   * `buffer`, not `text`. */
  text: string;
  /** The sidecar's own declared `synthetic` flag, surfaced as a real
   * boolean (never coerced from a truthy non-boolean value) so a caller can
   * assert "these bytes are/are not hardware evidence" without re-deriving
   * it from `provenance.capturedFrom`'s string. */
  synthetic: boolean;
}

export interface LoadTextFixtureOptions {
  /** Directory the `<caseName>.txt` / `<caseName>.json` pair live in.
   * Defaults to TEXTMON_FIXTURE_DIR. Overridable for testing against a
   * temporary directory. */
  dir?: string;
}

/** The regenerating invocation named in every refusal message -- a fixture
 * under fixtures/textmon/ is regenerated by this single script, never
 * hand-edited (see fixtures/textmon/README.md's own "Regenerate, never
 * hand-edit" section). There is no per-case selector: one invocation
 * regenerates the whole batch. */
const REGENERATE_COMMAND =
  "node .planning/phases/39-the-dual-channel-coexistence-gate-go-degrade-no-go/evidence/fixture-capture.mjs";

/**
 * Load a committed `<caseName>.txt` payload plus its `<caseName>.json`
 * provenance sidecar. Throws MissingTextFixtureError, naming the expected
 * path and the regenerating command, when either file is absent, when the
 * sidecar is unparseable or parses to something that is not a plain
 * object, or when the sidecar is missing one or more of the five required
 * provenance keys.
 */
export function loadTextFixture(caseName: string, { dir }: LoadTextFixtureOptions = {}): TextFixture {
  const baseDir = dir ?? TEXTMON_FIXTURE_DIR;
  const txtPath = join(baseDir, `${caseName}.txt`);
  const jsonPath = join(baseDir, `${caseName}.json`);

  if (!existsSync(txtPath)) {
    throw new MissingTextFixtureError(
      `Captured text fixture "${caseName}" is missing at ${txtPath} -- regenerate it with: ${REGENERATE_COMMAND}`,
      { path: txtPath, command: REGENERATE_COMMAND },
    );
  }
  if (!existsSync(jsonPath)) {
    throw new MissingTextFixtureError(
      `Captured text fixture "${caseName}" sidecar is missing at ${jsonPath} -- regenerate it with: ${REGENERATE_COMMAND}`,
      { path: jsonPath, command: REGENERATE_COMMAND },
    );
  }

  const buffer = readFileSync(txtPath);

  let provenance: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(readFileSync(jsonPath, "utf8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw new Error("sidecar is not a JSON object");
    }
    provenance = parsed as Record<string, unknown>;
  } catch (err) {
    throw new MissingTextFixtureError(
      `Captured text fixture "${caseName}" sidecar at ${jsonPath} is unreadable or malformed (${
        err instanceof Error ? err.message : String(err)
      }) -- regenerate it with: ${REGENERATE_COMMAND}`,
      { path: jsonPath, command: REGENERATE_COMMAND },
    );
  }

  const missingKeys = REQUIRED_PROVENANCE_KEYS.filter((k) => !(k in provenance));
  if (missingKeys.length > 0) {
    throw new MissingTextFixtureError(
      `Captured text fixture "${caseName}" sidecar at ${jsonPath} is missing required key(s): ${missingKeys.join(", ")} -- regenerate it with: ${REGENERATE_COMMAND}`,
      { path: jsonPath, command: REGENERATE_COMMAND },
    );
  }

  return {
    buffer,
    provenance,
    text: buffer.toString("utf8"),
    synthetic: provenance.synthetic === true,
  };
}

export interface ListTextFixturesOptions {
  dir?: string;
}

/** Every case name in `dir` (default TEXTMON_FIXTURE_DIR) that has BOTH a
 * `.txt` payload and a `.json` sidecar, sorted. A case with only one of the
 * two is invisible here -- never half-loadable. */
export function listTextFixtures({ dir }: ListTextFixturesOptions = {}): string[] {
  const baseDir = dir ?? TEXTMON_FIXTURE_DIR;
  const entries = existsSync(baseDir) ? readdirSync(baseDir) : [];
  const txtCases = new Set<string>();
  const jsonCases = new Set<string>();
  for (const entry of entries) {
    const ext = extname(entry);
    if (ext === ".txt") txtCases.add(entry.slice(0, -ext.length));
    else if (ext === ".json") jsonCases.add(entry.slice(0, -ext.length));
  }
  const both: string[] = [];
  for (const c of txtCases) {
    if (jsonCases.has(c)) both.push(c);
  }
  return both.sort();
}
