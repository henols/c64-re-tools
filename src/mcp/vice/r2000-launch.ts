#!/usr/bin/env node
// This module's original header (through 11.1-03) claimed to be the only
// place in this repo that shells out to regenerator2000. That claim was
// WRONG and is corrected below (INT-02/D-11.1-05) -- noted here, not
// deleted outright, because this line is the sentence the correction below
// is against.
//
// Why this seam exists at all (D-06): this directory is the only place a
// guard test actually runs in CI -- `hostpath-consumers.test.ts`'s
// closed-consumer-set machinery lives here, and CI's `npm test` never
// reaches skill-side `*.test.mjs` scripts. A guard test living beside a
// skill script would be green-by-absence. Phase 11's `r2000_*` MCP surface
// is also planned to land in this same directory, so this module is the
// natural first tenant rather than a throwaway.
//
// CORRECTED CLAIM (INT-02/D-11.1-05): this is NOT the only file that spawns
// regenerator2000 -- `r2000-mcp-client.ts` is a second, necessary spawn
// site, and its own header already said so correctly ("both spawn call
// sites in this repo") while this file's original claim above said the
// opposite. What this file IS actually the one authoritative place for:
//   - the `--vice` guard (`FORBIDDEN_R2000_FLAGS`, `assertNoViceFlag()`,
//     `viceFlagRefusalMessage()`) that every spawn site in this repo must
//     call before spawning;
//   - every FIXED argv builder (`buildExportAsmArgs()`, `buildVerifyArgs()`,
//     `buildMcpServerStdioArgs()`, `buildExportLblArgs()`,
//     `buildImportLblArgs()`) -- a future verb gets a new fixed builder
//     here, never a bespoke ad hoc argv assembled at a call site;
//   - the ONE **synchronous**, blocking `spawnSync` of regenerator2000
//     (`runR2000()`), used by every CLI verb (`r2000-cli.ts`) and by
//     `r2000-verify.ts`/`r2000-symbols.ts`.
// `r2000-mcp-client.ts`'s `withR2000Session()` is the ONE **asynchronous**
// spawn site (`spawn()`, not `spawnSync()`) -- it exists because a
// long-lived MCP-over-stdio child session cannot be a blocking call, which
// `runR2000()` deliberately is. Both sites are safe for the same reason:
// EVERY spawn call site in this repo calls `assertNoViceFlag(argv)` before
// spawning, and that is no longer a prose promise -- `r2000-spawn-seam.test.ts`
// derives the full production-module set, finds every regenerator2000
// spawn call site in it, and FAILS if any of them spawns without guarding
// first, or if a third, unguarded site ever appears. `R2000-01`'s
// guarantee is therefore checked, not merely stated.
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

export interface BuildMcpServerStdioArgsOptions {
  projectPath: string;
}

/** Fixed argv builder for the "run as an MCP server over stdio" verb
 * (D-16/D-17). `--mcp-server-stdio` takes no value of its own -- the
 * project path is the positional `[FILE]` argument documented by
 * `regenerator2000 --help`, confirmed at execution time on this host
 * (0.9.20): `Usage: regenerator2000 [OPTIONS] [FILE]`. */
export function buildMcpServerStdioArgs({ projectPath }: BuildMcpServerStdioArgsOptions): string[] {
  return ["--mcp-server-stdio", projectPath];
}

export interface BuildExportLblArgsOptions {
  projectPath: string;
  outPath: string;
}

/** Fixed argv builder for the "export VICE labels" verb (R2000-14, the
 * live-discovered-symbols-flow-back leg). `--export_lbl <PATH>` takes one
 * value, confirmed at execution time from `--help`; `--headless` is
 * required because this verb produces no TUI output. */
export function buildExportLblArgs({ projectPath, outPath }: BuildExportLblArgsOptions): string[] {
  return ["--headless", "--export_lbl", outPath, projectPath];
}

export interface BuildImportLblArgsOptions {
  projectPath: string;
  lblPath: string;
}

/**
 * Fixed argv builder for the "import VICE labels" verb (R2000-15, the
 * annotate-then-export-to-VICE leg). `--import_lbl <PATH>` takes one value,
 * confirmed at execution time from `--help`.
 *
 * `--mcp-server-stdio` is NOT optional here -- this is the D-28 trap this
 * builder exists to make unreachable by construction. `main.rs:800-806` is
 * `if headless && !mcp_server { return Ok(()) }`: an argv of
 * `--import_lbl <path> --headless <proj>` imports the labels into memory
 * and then hits that early return WITHOUT ever calling save, so the import
 * is silently discarded -- measured live on this host: two names imported
 * that way, and a subsequent `--export_lbl` read back from disk returned
 * only the pre-existing label. `main.rs:709-711` makes `--mcp-server-stdio`
 * set both `headless` and `mcp_server`, which is what skips that early
 * return and leaves the process alive long enough for a caller to issue an
 * explicit `r2000_save_project` over the resulting stdio session.
 *
 * Deliberately does NOT also add `--headless` to this argv: `--mcp-server-
 * stdio` already implies it (`main.rs:709-711`), and a caller reading this
 * argv should see the minimum token set that makes persistence possible,
 * not a redundant flag alongside it. `--import_lbl` only mutates in-memory
 * state -- the caller is still responsible for issuing `r2000_save_project`
 * over the resulting session before closing it; this builder only gets the
 * import to a point where saving is possible.
 */
export function buildImportLblArgs({ projectPath, lblPath }: BuildImportLblArgsOptions): string[] {
  return ["--import_lbl", lblPath, "--mcp-server-stdio", projectPath];
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

/** Fallback used when `R2000_TIMEOUT_MS`'s env override is absent or
 * invalid (WR-10, 10-REVIEW.md:481-511). Exported as its own name, distinct
 * from `R2000_TIMEOUT_MS`, so `parseR2000TimeoutMs()` and its tests can
 * refer to "the default" without re-deriving the literal `120_000`. */
export const R2000_DEFAULT_TIMEOUT_MS = 120_000;

/** One-time stderr warning for a malformed `R2000_TIMEOUT_MS` override,
 * mirroring `repo-root.ts`'s "warn once on stderr rather than throw on a
 * bad env var" convention -- a bad timeout value is an operator mistake,
 * not a reason to crash the process before it has done anything. */
let warnedBadTimeoutEnv = false;

/**
 * Parses a `R2000_TIMEOUT_MS`-shaped raw string into a valid, positive
 * timeout in milliseconds, falling back to `fallbackMs` (with a one-time
 * stderr warning naming the rejected value) for anything non-numeric,
 * `NaN`, zero or negative. Never returns `NaN` -- a bad value must fall
 * back to the default, never propagate into `spawnSync`'s `timeout` option
 * unchecked.
 *
 * Exported and free of any module-load-time side effect so a test can
 * exercise every input shape directly, by calling this function, rather
 * than mutating `process.env.R2000_TIMEOUT_MS` after `R2000_TIMEOUT_MS`
 * has already been evaluated -- exactly the IN-04 mistake (`R2000_BIN` is
 * resolved once at module load; env mutation afterward is a no-op against
 * it) applied to a second env-derived constant.
 */
export function parseR2000TimeoutMs(
  raw: string | undefined,
  fallbackMs: number = R2000_DEFAULT_TIMEOUT_MS
): number {
  if (raw === undefined) return fallbackMs;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    if (!warnedBadTimeoutEnv) {
      warnedBadTimeoutEnv = true;
      console.error(
        `warn: R2000_TIMEOUT_MS="${raw}" is not a positive, finite number -- falling back to the default ` +
          `(${fallbackMs}ms). Set R2000_TIMEOUT_MS to a positive number of milliseconds to override it.`
      );
    }
    return fallbackMs;
  }
  return n;
}

/** The default `runR2000()` timeout (WR-10): 120s unless overridden by
 * `R2000_TIMEOUT_MS`, validated by `parseR2000TimeoutMs()` above so a bad
 * override cannot turn into `NaN` inside `spawnSync`'s `timeout` option
 * (an unbounded, non-numeric timeout is the same hazard as no timeout at
 * all). A per-call `opts.timeoutMs` always overrides this module-level
 * default (D-11.1-04) -- this constant only supplies what every one of the
 * seven CLI verbs gets when it does not ask for anything different. */
export const R2000_TIMEOUT_MS: number = parseR2000TimeoutMs(process.env.R2000_TIMEOUT_MS);

/** `spawnSync`'s Node default `maxBuffer` is 1 MiB. That is too small for
 * this module's own reason to exist: `--verify`/`--export_asm` transcripts
 * ARE the payload `acmeVerdict()` and the label parsers exist to parse, so
 * a verbose-but-successful child run must never turn into a truncated
 * buffer and an opaque `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`/`ENOBUFS` stack
 * in place of the parsed verdict this seam was built to produce (WR-10).
 * 32 MiB is comfortably above any transcript measured live against
 * regenerator2000 0.9.20 on this host. */
export const R2000_MAX_BUFFER = 32 * 1024 * 1024;

/**
 * Spawns regenerator2000 with the given argv. Calls `assertNoViceFlag(argv)`
 * as the FIRST statement of this function body, deliberately, so the guard
 * is enforced even if a future edit reorders the rest of the function --
 * exactly the discipline `vice.ts`'s `call()` uses for `DENY_LIST`.
 *
 * Always spawns with an argv ARRAY and never enables a shell interpreter for
 * the child process, so a caller-controlled filename can never be
 * interpreted by a shell.
 *
 * BOUNDED (WR-10, 10-REVIEW.md:481-511): this is a **blocking** `spawnSync`,
 * so an unbounded child owns the whole Node event loop -- no JSON-RPC, no
 * diagnostics, nothing, for as long as the child runs. `timeout` defaults to
 * `R2000_TIMEOUT_MS` (120s, env-overridable) and `maxBuffer` is fixed at
 * `R2000_MAX_BUFFER` (32 MiB); `opts.timeoutMs` still overrides the default
 * per call. Both bounds, when hit, are translated into a named, actionable
 * `Error` naming the limit and the argv -- never a raw re-thrown `spawnSync`
 * error object, which is what WR-10 found: a *successful* verify with a
 * verbose transcript could previously surface as an opaque `ENOBUFS` stack
 * instead of the parsed verdict this module exists to produce.
 */
export function runR2000(argv: readonly string[], opts: RunR2000Options = {}): RunR2000Result {
  assertNoViceFlag(argv);
  // Caller override preserved (D-11.1-04): opts.timeoutMs still wins over
  // the module-level default. `timeoutMs` below mirrors the exact
  // expression passed to spawnSync() so the two can never drift and an
  // error message below can name the real bound that was actually applied.
  const timeoutMs = opts.timeoutMs ?? R2000_TIMEOUT_MS;
  const r = spawnSync(R2000_BIN, [...argv], {
    encoding: "utf8",
    cwd: opts.cwd,
    timeout: opts.timeoutMs ?? R2000_TIMEOUT_MS,
    maxBuffer: R2000_MAX_BUFFER,
  });
  if (r.error) {
    const err = r.error as NodeJS.ErrnoException;
    if (err.code === "ENOENT") {
      throw new Error(
        `regenerator2000 was not found on PATH -- install it with \`cargo install regenerator2000\` and ` +
          `ensure \`regenerator2000\` is on $PATH (or set R2000_BIN to its full path).`
      );
    }
    // Timeout (WR-10): Node's shape has varied across versions -- observed
    // on this host (Node 22) as `error.code === "ETIMEDOUT"` PLUS
    // `r.signal === "SIGTERM"` together, so both are checked rather than
    // relying on either alone.
    if (err.code === "ETIMEDOUT" || r.signal === "SIGTERM") {
      throw new Error(
        `regenerator2000 timed out after ${timeoutMs}ms and was killed (argv: [${argv.join(", ")}]) -- ` +
          `either the child is wedged, or a real run legitimately needs longer than ${timeoutMs}ms. Raise ` +
          `R2000_TIMEOUT_MS (or pass { timeoutMs } to runR2000()) if the latter.`
      );
    }
    // Max-buffer overrun (WR-10): observed on this host as
    // `error.code === "ENOBUFS"`; matched more broadly against the message
    // too, since Node's own docs describe this failure mode inconsistently
    // across versions as `ENOBUFS` or `ERR_CHILD_PROCESS_STDIO_MAXBUFFER`.
    if (err.code === "ENOBUFS" || /MAXBUFFER|maxBuffer/i.test(err.message ?? "")) {
      const limitMiB = (R2000_MAX_BUFFER / (1024 * 1024)).toFixed(0);
      throw new Error(
        `regenerator2000's combined stdout+stderr exceeded the ${limitMiB} MiB limit (argv: ` +
          `[${argv.join(", ")}]) -- its output was truncated, so any verdict parsed from it would be ` +
          `unreliable. This is a hard failure, never a silently-shortened transcript feeding a pass.`
      );
    }
    throw r.error;
  }
  return { status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
}
