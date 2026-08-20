#!/usr/bin/env node
// The ONE authoritative place in this repo that spawns regenerator2000.
//
// Why this seam exists at all (D-06): this directory is the only place a
// guard test actually runs in CI -- `hostpath-consumers.test.ts`'s
// closed-consumer-set machinery lives here, and CI's `npm test` never
// reaches skill-side `*.test.mjs` scripts. A guard test living beside a
// skill script would be green-by-absence. Phase 11's `r2000_*` MCP surface
// is also planned to land in this same directory, so this module is the
// natural first tenant rather than a throwaway.
//
// What this is the ONE authoritative place for: every regenerator2000
// spawn in this repo. No other file may shell out to the `regenerator2000`
// binary directly -- if a future caller needs a new verb, it gets a new
// fixed builder here, not a bespoke `spawnSync` call at the call site.
//
// What NOT to do, named concretely (D-07/D-08):
//   - Never add a caller-supplied argv pass-through parameter (no rest
//     parameter, no field for extra command-line arguments, no field that
//     forwards arbitrary caller-supplied tokens on any builder's options
//     object). Every verb's argv shape is fixed by this file, not by its
//     caller.
//   - Never strip `--vice` silently if a caller somehow supplies it. Stock
//     VICE's binary monitor services *exactly one client*
//     (CLAUDE.md's "Concurrency" constraint) -- a regenerator2000 launched
//     with `--vice <host:port>` becomes a second, unserviced client against
//     an instance the broker already owns, indistinguishable from a wedge
//     with no diagnostic. Silently removing the flag would hide exactly the
//     bug class this guard exists to catch, so the guard throws a named
//     error instead.
//   - Never import `hostpath.ts` or `containerpath.ts` here. regenerator2000
//     runs container-side (D-R4, same side as the MCP proxy), so no path
//     translation ever applies to any argument passed to it -- translating
//     one would be the mirror image of the DERIV-07 screenshot-path trap,
//     where a client-side-derived path was wrongly translated a second
//     time. This absence is asserted structurally by
//     `hostpath-consumers.test.ts` (D-08), not merely stated here.
import { spawnSync } from "node:child_process";

/** Overridable binary name, mirroring `disasm-roundtrip.test.ts`'s `ACME_BIN`
 * convention -- lets tests point at a name guaranteed not to exist on PATH
 * without needing regenerator2000 installed at all. */
export const R2000_BIN: string = process.env.R2000_BIN ?? "regenerator2000";

/** The permanent deny list for regenerator2000 argv, declared once as a
 * named constant -- the same shape `vice.ts` uses for `DENY_LIST`. Today
 * this holds exactly one entry; if a second hazardous flag is ever
 * discovered, it joins this array rather than spawning a parallel check.
 * `assertNoViceFlag()` below actually iterates this array (WR-01) -- it is
 * the single source of truth for the scan, not merely documentation of
 * intent, so adding an entry here is sufficient to enforce it. */
export const FORBIDDEN_R2000_FLAGS: readonly string[] = ["--vice"];

export interface R2000ViceFlagErrorOptions {
  argv: readonly string[];
}

/** Thrown by `assertNoViceFlag()`/`runR2000()` when `--vice` (or its
 * `--vice=<value>` single-token form) is found anywhere in a built argv. */
export class R2000ViceFlagError extends Error {
  argv: readonly string[];

  constructor(message: string, { argv }: R2000ViceFlagErrorOptions) {
    super(message);
    this.name = "R2000ViceFlagError";
    this.argv = argv;
  }
}

/**
 * Renders the pinned refusal text for a `--vice`-bearing argv, mirroring
 * `vice.ts`'s `denyListRefusalMessage()`. States plainly that the flag is
 * permanently forbidden, why (stock VICE's binary monitor serves exactly
 * one client and the broker owns that socket), what a second client would
 * look like (indistinguishable from a wedge), and that the flag was
 * refused rather than silently removed.
 */
export function viceFlagRefusalMessage(argv: readonly string[]): string {
  return (
    `--vice is permanently forbidden on any regenerator2000 launch -- stock VICE's binary monitor ` +
    `serves exactly one client and the broker already owns that socket. A second client (this ` +
    `regenerator2000 process connecting via --vice) would be indistinguishable from a wedge, with no ` +
    `diagnostic. The flag was refused, not removed -- caller-supplied argv: [${argv.join(", ")}]`
  );
}

/**
 * Scans a finished argv array against every entry of `FORBIDDEN_R2000_FLAGS`
 * and throws `R2000ViceFlagError` if any is found (WR-01: the scan reads
 * the array itself, so a future addition to the deny list is enforced by
 * construction rather than requiring a parallel hand-edit here). Exact-token
 * comparison only -- `arg === flag` or the single-token `flag=<value>` form
 * via `startsWith`. Deliberately does NOT join argv into a string and
 * substring-match: a filename containing the characters `--vice` (e.g.
 * `/tmp/my--vice-notes.a`) must never false-positive.
 */
export function assertNoViceFlag(argv: readonly string[]): void {
  for (const arg of argv) {
    for (const flag of FORBIDDEN_R2000_FLAGS) {
      if (arg === flag || arg.startsWith(`${flag}=`)) {
        throw new R2000ViceFlagError(viceFlagRefusalMessage(argv), { argv });
      }
    }
  }
}

export interface BuildExportAsmArgsOptions {
  projectPath: string;
  outPath: string;
}

/** Fixed argv builder for the "export ACME assembly source" verb. No rest
 * parameter, no extra-args field -- the shape is exactly these four tokens
 * plus the two caller-supplied paths. */
export function buildExportAsmArgs({ projectPath, outPath }: BuildExportAsmArgsOptions): string[] {
  return ["--headless", "--export_asm", outPath, "--assembler", "acme", projectPath];
}

export interface BuildVerifyArgsOptions {
  projectPath: string;
}

/** Fixed argv builder for the "verify export roundtrip" verb. */
export function buildVerifyArgs({ projectPath }: BuildVerifyArgsOptions): string[] {
  return ["--verify", "--assembler", "acme", projectPath];
}

export interface RunR2000Options {
  cwd?: string;
  timeoutMs?: number;
}

export interface RunR2000Result {
  status: number | null;
  stdout: string;
  stderr: string;
}

/**
 * Spawns regenerator2000 with the given argv. Calls `assertNoViceFlag(argv)`
 * as the FIRST statement of this function body, deliberately, so the guard
 * is enforced even if a future edit reorders the rest of the function --
 * exactly the discipline `vice.ts`'s `call()` uses for `DENY_LIST`.
 *
 * Always spawns with an argv ARRAY and never enables a shell interpreter for
 * the child process, so a caller-controlled filename can never be
 * interpreted by a shell.
 */
export function runR2000(argv: readonly string[], opts: RunR2000Options = {}): RunR2000Result {
  assertNoViceFlag(argv);
  const r = spawnSync(R2000_BIN, [...argv], {
    encoding: "utf8",
    cwd: opts.cwd,
    timeout: opts.timeoutMs,
  });
  if (r.error) {
    if ((r.error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new Error(
        `regenerator2000 was not found on PATH -- install it with \`cargo install regenerator2000\` and ` +
          `ensure \`regenerator2000\` is on $PATH (or set R2000_BIN to its full path).`
      );
    }
    throw r.error;
  }
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
