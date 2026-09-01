#!/usr/bin/env node
// packer-finding.mjs -- the ONE place this project answers "which packer was
// used on this binary", as a project-owned recon finding with an ordered
// oracle chain and a hard, reasoned unknown (SURF-03).
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// DATED PROVENANCE (2026-08-29): the retired static analyser this project once
// rented -- the external analyser, pinned at 0.9.20 -- computed packer identity on
// EVERY load and then threw it away before it reached any machine-readable
// surface. That analyser is GONE from this repository; nothing below calls it,
// and this paragraph is history in the past tense, not a route. It is kept
// because it is the whole reason this file exists: without it, the obvious
// next step is to go looking for the packer-name call that was already proven
// not to be there. At the pin, that absence was established four independent
// ways, each read at the pin:
//
//   (a) the curated binary-info tool emits a fixed seven-field object
//       (origin, size, system, filename, description, an illegal-opcode hint
//       and entropy) built from a static literal -- a packed input cannot
//       change the field set;
//   (b) the unpack result carries no name field at all: it returns data,
//       start/end addresses, an entry point, a dependency address and an
//       instruction count, and the one place the detected packer is consulted
//       applies a memory patch and feeds a progress callback the MCP handler
//       passes nothing to;
//   (c) the loaded-project value that DOES hold a detected packer name is an
//       in-memory return value only -- it is absent from the serialised
//       project shape, so saving and re-reading the project file yields
//       nothing;
//   (d) every consumer of the name lives in the terminal-UI crate. There are
//       zero non-UI, non-internal consumers, and the command line has no flag
//       that reports file info.
//
// So there was no read-only route to a packer name in that analyser, and there
// is none on the surface that replaced it either: the annotation store holds
// annotations, the derived reads decode instructions, and neither answers
// "which packer". The two routes that would produce a name -- copying that
// upstream project's signature table (or transcribing its bytes into search
// patterns), and inventing a tool name on this project's own surface that no
// verb actually implements -- are both refused: the first is the copy this
// milestone exists to avoid, and the second would be a fabricated tool that
// this repository's own honesty gates would then treat as legitimate. What is
// left, and what this file is, is a project-owned finding with an EXTERNAL
// oracle and an explicit unknown.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
//   - the ordered oracle chain (external identifier, then a packedness-only
//     entropy gate, then an explicit unknown) and its first-hit-wins rule;
//   - the finding's response shape and its four-verdict vocabulary
//     (`PACKER_VERDICTS`);
//   - the external identifier's probe (`probeUnp64`) and the defensive parser
//     for its standard output (`parseUnp64Stdout`).
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- the four rules, each enforced structurally below
// ---------------------------------------------------------------------------
//   1. NEVER write the `packer` field from anything but an oracle's own
//      verbatim output. Not from entropy, not from a decompression or
//      dependency address, not from a byte pattern. There is exactly ONE
//      assignment of that field in this module, inside `identifiedByOracle()`
//      below, and it refuses a value the oracle did not supply.
//   2. NEVER return the high confidence level off the oracle route. The
//      entropy route is MEDIUM and answers packedness only; the no-route case
//      is LOW and answers `unknown`. `CONFIDENCE_HIGH` is ASSIGNED at exactly
//      one site in this file, in the oracle branch, and the colocated test
//      counts that site at source level.
//   3. NEVER return the `unknown` verdict with an empty reason. A silent null
//      with nothing said about it is the failure mode this whole file exists
//      to prevent, so `unknownFinding()` throws rather than build one. More
//      generally: every finding whose `packer` is null states, in
//      `unavailableReason`, why no name is being reported.
//   4. NEVER add vocabulary beyond the four verdicts. No fractional rating, no
//      ratio, no hedged phrasing, no named-but-unconfirmed packer. A reader
//      must get either a name an oracle stated or an explicit unknown, and
//      nothing in between.
//
// Also: NEVER invoke the oracle through a command interpreter. Every child
// process below is launched with an argument ARRAY and an explicitly disabled
// interpreter, and a configured oracle path that does not exist on disk is
// treated as oracle-absent rather than being placed into any command anywhere
// (T-19-18). The oracle's standard output reaches exactly one field, through
// one bounded parser that evaluates nothing (T-19-19).
//
// ---------------------------------------------------------------------------
// STATUS OF THE ORACLE BRANCH (recorded, deliberate)
// ---------------------------------------------------------------------------
// The env-var convention below (`UNP64`, then `UNP64_PATH`) is the same one
// upstream's own comparison harness uses, and is verified. The SHAPE of the
// identifier's standard output is NOT verified here -- the tool was not
// installed on the machine where this was written, so `parseUnp64Stdout()` is
// written defensively and its accepted marker set is a stated assumption, not
// a measurement. Installing the identifier and running it against a genuinely
// packed fixture is the experiment that would settle it; until then the
// oracle-route test SKIPS with a visible reason and never reads as a pass.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ---------------------------------------------------------------------------
// Vocabulary. Exactly four verdicts, frozen. Rule 4.
// ---------------------------------------------------------------------------

/**
 * The complete verdict vocabulary. Nothing else may ever appear in a
 * finding's `verdict` field.
 *
 *   identified          -- an oracle stated a name, verbatim.
 *   packed-unidentified -- the entropy gate places the bytes at or above its
 *                          packedness threshold, and NO oracle named the
 *                          packer. Packedness, never identity.
 *   unpacked            -- the entropy gate puts the bytes below its
 *                          threshold. Still not an identity claim.
 *   unknown             -- no route produced an answer. Always carries a
 *                          reason.
 */
export const PACKER_VERDICTS = Object.freeze(["identified", "packed-unidentified", "unpacked", "unknown"]);

const VERDICT_IDENTIFIED = "identified";
const VERDICT_PACKED_UNIDENTIFIED = "packed-unidentified";
const VERDICT_UNPACKED = "unpacked";
const VERDICT_UNKNOWN = "unknown";

const CONFIDENCE_HIGH = "HIGH";
const CONFIDENCE_MEDIUM = "MEDIUM";
const CONFIDENCE_LOW = "LOW";

const ROUTE_ORACLE = "unp64";
const ROUTE_ENTROPY = "entropy-only";
const ROUTE_NONE = "none";

/**
 * The packedness threshold, taken from the curated binary-info tool's own
 * description ("values higher than 7.5 suggest the binary might be
 * compressed") rather than restated from a second source. Shannon entropy
 * over bytes runs 0.0 to 8.0.
 *
 * This number gates PACKEDNESS ONLY. It can never reach the `packer` field --
 * see rule 1.
 */
export const PACKED_ENTROPY_THRESHOLD = 7.5;

/** Default command name when neither environment variable is set. */
const DEFAULT_ORACLE_COMMAND = "unp64";

/** The two environment variables the external identifier is located from, in
 * this order -- the same convention upstream's own comparison harness uses. */
const ORACLE_ENV_VARS = Object.freeze(["UNP64", "UNP64_PATH"]);

/** The opt-in variable that turns an absent oracle from an expected skip into
 * a hard failure, by the established `VICE_REQUIRE_*` precedent. */
export const REQUIRE_ORACLE_ENV_VAR = "VICE_REQUIRE_UNP64";

/** Every child process here is bounded. A hung identifier is treated exactly
 * like an absent one (T-19-23). */
const ORACLE_TIMEOUT_MS = 20_000;

/** Hard cap on how much of the oracle's standard output the parser will even
 * look at. Longer than this is rejected outright rather than scanned
 * (T-19-19). */
export const MAX_ORACLE_STDOUT_BYTES = 64 * 1024;

/** Hard cap on the length of a parsed packer name. */
export const MAX_PACKER_NAME_LENGTH = 64;

/**
 * The accepted shape of a parsed name: begins alphanumeric, then a small,
 * explicitly listed printable set. Deliberately narrow -- the parsed value's
 * only destination is a report field, and narrowing it here means a hostile
 * standard output cannot smuggle control characters or markup into a document
 * a human later reads.
 */
const PACKER_NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._/+-]*$/;

/**
 * Line markers the parser accepts, each anchored at the start of a trimmed
 * line and each followed by the name. ASSUMED, not measured -- see the module
 * header's status note. An unrecognised line yields null, never a guess drawn
 * from the surrounding text.
 */
const ORACLE_NAME_MARKERS = Object.freeze([/^packer\s*:\s*(.+)$/i, /^detected\s+packer\s*:\s*(.+)$/i, /^detected\s*:\s*(.+)$/i]);

// ---------------------------------------------------------------------------
// Entropy -- packedness only
// ---------------------------------------------------------------------------

/**
 * Shannon entropy over a byte buffer, 0.0 to 8.0 -- the same quantity the
 * curated binary-info tool reports, computed here so the command-line entry
 * can answer from a bare file with no live session.
 *
 * Returns null for an empty buffer: zero bytes is an absent measurement, not
 * a measurement of zero (a zero would read as "definitely not compressed",
 * which is a claim nobody made).
 */
export function shannonEntropy(bytes) {
  if (!bytes || bytes.length === 0) return null;
  const counts = new Array(256).fill(0);
  for (const b of bytes) counts[b & 0xff]++;
  let total = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const p = count / bytes.length;
    total -= p * Math.log2(p);
  }
  return total;
}

// ---------------------------------------------------------------------------
// The oracle: probe, run, parse. All three read-only.
// ---------------------------------------------------------------------------

/**
 * Locates and probes the external packer identifier, WITHOUT touching any
 * input file.
 *
 * Resolution order: the two environment variables, then the bare command name
 * on the search path. A CONFIGURED path that does not exist on disk is
 * reported as absent and is deliberately not echoed back in the reason
 * (T-19-18: an attacker-influenceable value is never placed into a command,
 * and not into a message a later step might paste into one either).
 *
 * Never throws. A launch error, a non-zero status or a timeout are all
 * "absent", never a failure -- absence of the oracle is an expected state.
 */
export function probeUnp64(env = process.env) {
  const source = env ?? {};
  let configuredVar = null;
  let configured = null;
  for (const name of ORACLE_ENV_VARS) {
    const value = source[name];
    if (typeof value === "string" && value.trim() !== "") {
      configuredVar = name;
      configured = value.trim();
      break;
    }
  }

  if (configured !== null && !existsSync(configured)) {
    return {
      available: false,
      command: null,
      version: null,
      reason:
        `the packer identifier configured through ${configuredVar} does not exist on disk -- ` +
        "treated as oracle-absent, and the configured value was not placed into any command",
    };
  }

  const command = configured ?? DEFAULT_ORACLE_COMMAND;
  const probe = spawnSync(command, ["--version"], {
    encoding: "utf8",
    timeout: ORACLE_TIMEOUT_MS,
    shell: false,
    windowsHide: true,
  });

  if (probe.error) {
    return {
      available: false,
      command: null,
      version: null,
      reason:
        configuredVar === null
          ? `no "${DEFAULT_ORACLE_COMMAND}" packer identifier was found on the search path`
          : `the packer identifier configured through ${configuredVar} could not be launched`,
    };
  }

  const banner = `${probe.stdout ?? ""}${probe.stderr ?? ""}`.trim();
  if (banner === "") {
    return {
      available: false,
      command: null,
      version: null,
      reason: "the packer identifier produced no version banner, so it was not accepted as an oracle",
    };
  }

  return { available: true, command, version: banner.slice(0, 200), reason: null };
}

/**
 * Runs the located identifier against `filePath`, read-only.
 *
 * The input file is never modified: any unpacked output the identifier writes
 * goes to a scratch path under the system temporary directory, which is
 * removed before this function returns (T-19-24). The child is launched with
 * an argument ARRAY and an explicitly disabled command interpreter, so neither
 * the configured command nor the caller's filename is ever parsed as a
 * command (T-19-18).
 *
 * Never throws: every failure is reported as `{ ok: false, reason }`.
 */
export function runUnp64(probe, filePath) {
  if (!probe || probe.available !== true || typeof probe.command !== "string") {
    return { ok: false, stdout: "", reason: "the oracle was not available" };
  }
  if (typeof filePath !== "string" || filePath === "") {
    return { ok: false, stdout: "", reason: "no input file was given to the oracle" };
  }
  if (!existsSync(filePath)) {
    return { ok: false, stdout: "", reason: "the input file does not exist" };
  }

  let scratch = null;
  try {
    scratch = mkdtempSync(join(tmpdir(), "packer-finding-"));
    const scratchOut = join(scratch, "unpacked.out");
    const run = spawnSync(probe.command, [filePath, scratchOut], {
      encoding: "utf8",
      timeout: ORACLE_TIMEOUT_MS,
      shell: false,
      windowsHide: true,
      maxBuffer: MAX_ORACLE_STDOUT_BYTES,
    });
    if (run.error) {
      return { ok: false, stdout: "", reason: "the oracle could not be run against the input file" };
    }
    return { ok: true, stdout: `${run.stdout ?? ""}`, reason: null };
  } catch {
    // A scratch directory that could not be created is an absent oracle, not
    // an error a recon pass should stop for.
    return { ok: false, stdout: "", reason: "a scratch directory for the oracle's output could not be created" };
  } finally {
    if (scratch !== null) {
      try {
        rmSync(scratch, { recursive: true, force: true });
      } catch {
        // Best effort. A leftover empty scratch directory is not worth
        // failing a read-only recon finding over.
      }
    }
  }
}

/**
 * Parses a packer name out of the oracle's standard output.
 *
 * Defensive by construction (T-19-19): an explicit byte cap before anything
 * is scanned, no evaluation of any kind, a narrow accepted character set, and
 * a length cap on the result. Empty, truncated, over-long and unrecognised
 * input all return null WITHOUT throwing -- a parser that throws inside a
 * recon pass would turn an unhelpful oracle into a stopped session.
 *
 * The returned value's only destination is the finding's `packer` field. It
 * never reaches a command, a path, or any executable position.
 */
export function parseUnp64Stdout(text) {
  if (typeof text !== "string") return null;
  if (text.length === 0) return null;
  if (text.length > MAX_ORACLE_STDOUT_BYTES) return null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line === "") continue;
    for (const marker of ORACLE_NAME_MARKERS) {
      const matched = line.match(marker);
      if (!matched) continue;
      const candidate = (matched[1] ?? "").trim();
      if (candidate === "") return null;
      if (candidate.length > MAX_PACKER_NAME_LENGTH) return null;
      if (!PACKER_NAME_RE.test(candidate)) return null;
      return candidate;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Finding constructors. Each route has exactly one, and only the oracle's
// constructor may set `packer`.
// ---------------------------------------------------------------------------

/**
 * THE ONLY PLACE IN THIS MODULE THAT ASSIGNS A PACKER NAME (rule 1), and the
 * only place the high confidence level is written (rule 2). It refuses to
 * build a finding from anything but a non-empty string the oracle's own
 * output supplied.
 */
function identifiedByOracle(name, evidence, checkedAt) {
  if (typeof name !== "string" || name.trim() === "") {
    throw new Error("identifiedByOracle: refusing to report a packer name the oracle did not state");
  }
  return Object.freeze({
    packer: name,
    verdict: VERDICT_IDENTIFIED,
    confidence: CONFIDENCE_HIGH,
    route: ROUTE_ORACLE,
    evidence: Object.freeze(evidence.slice()),
    checkedAt,
    unavailableReason: null,
  });
}

/** The entropy route. Answers PACKEDNESS and nothing else -- `packer` is
 * written as the literal null here, and the entropy value has no path to it
 * (rule 1). Never the high confidence level (rule 2). */
function fromEntropy(entropy, threshold, evidence, checkedAt) {
  const packed = entropy >= threshold;
  return Object.freeze({
    packer: null,
    verdict: packed ? VERDICT_PACKED_UNIDENTIFIED : VERDICT_UNPACKED,
    confidence: CONFIDENCE_MEDIUM,
    route: ROUTE_ENTROPY,
    evidence: Object.freeze(evidence.slice()),
    checkedAt,
    unavailableReason: packed
      ? "the entropy gate answers packedness only -- no oracle named the packer, and this project never " +
        "infers a name from entropy, from a decompression address, or from a byte pattern"
      : "no name is claimed: the entropy gate places these bytes below its packedness threshold, which is " +
        "a statement about compression and not about identity",
  });
}

/** The no-route case. Rule 3 is enforced here: an `unknown` verdict with an
 * empty reason cannot be constructed at all. */
function unknownFinding(reason, evidence, checkedAt) {
  if (typeof reason !== "string" || reason.trim() === "") {
    throw new Error("unknownFinding: refusing to return an unknown verdict with no reason (rule 3)");
  }
  return Object.freeze({
    packer: null,
    verdict: VERDICT_UNKNOWN,
    confidence: CONFIDENCE_LOW,
    route: ROUTE_NONE,
    evidence: Object.freeze(evidence.slice()),
    checkedAt,
    unavailableReason: reason,
  });
}

// ---------------------------------------------------------------------------
// The finding
// ---------------------------------------------------------------------------

/**
 * Produces the packer recon finding for one binary, walking the ordered oracle
 * chain: the external identifier first (first hit wins for the name), then the
 * packedness-only entropy gate, then an explicit unknown.
 *
 * Options:
 *   filePath  -- the binary to ask the oracle about. Required for the oracle
 *                route; the entropy route does not need it when `entropy` is
 *                supplied directly.
 *   entropy   -- a measured entropy value (for example the one the curated
 *                binary-info tool reports). When absent and `bytes` is given,
 *                it is computed locally; the evidence entry records WHICH.
 *   bytes     -- the binary's bytes, for the local entropy computation.
 *   threshold -- overrides the packedness threshold. The default is the one
 *                the curated tool's own description states.
 *   probe     -- injectable oracle probe, so a test can force the oracle
 *                absent without uninstalling anything.
 *   run       -- injectable oracle runner, same reason.
 *   now       -- injectable clock, so a test can pin `checkedAt`.
 */
export function packerFinding(options = {}) {
  const {
    filePath = null,
    entropy = null,
    bytes = null,
    threshold = PACKED_ENTROPY_THRESHOLD,
    env = process.env,
    probe = probeUnp64,
    run = runUnp64,
    now = () => new Date().toISOString(),
  } = options;

  const checkedAt = now();
  const evidence = [];

  // --- Route 1: the external oracle. The ONLY route that can name a packer.
  const probed = probe(env);
  evidence.push(
    Object.freeze({
      source: ROUTE_ORACLE,
      available: probed.available === true,
      version: probed.available === true ? probed.version : null,
      reason: probed.available === true ? null : (probed.reason ?? "the oracle was not available"),
    }),
  );

  if (probed.available === true && typeof filePath === "string" && filePath !== "") {
    const result = run(probed, filePath);
    const raw = typeof result.stdout === "string" ? result.stdout.slice(0, MAX_PACKER_NAME_LENGTH * 8) : "";
    evidence.push(Object.freeze({ source: ROUTE_ORACLE, ok: result.ok === true, raw, reason: result.reason ?? null }));
    if (result.ok === true) {
      const name = parseUnp64Stdout(result.stdout);
      if (name !== null) {
        return identifiedByOracle(name, evidence, checkedAt);
      }
      // The oracle ran and named nothing. That is a real answer about the
      // oracle, not about the packer -- fall through to the entropy gate
      // rather than inventing a name from what it did print.
    }
  }

  // --- Route 2: the entropy gate. Packedness only, never a name.
  let measured = null;
  let entropySource = null;
  if (typeof entropy === "number" && Number.isFinite(entropy)) {
    measured = entropy;
    // THE RECORDED PROVENANCE VALUE, DECIDED 2026-08-29 -- not string-replaced.
    // Until this date this field carried the retired static analyser's
    // binary-info verb, in that verb's own tool-name shape. Carrying that
    // shape forward under ANY spelling is wrong twice over. It is a FACT
    // ABOUT A PAST RUN: renaming it to a verb on the current surface would
    // claim a run that never happened. And this branch cannot know who
    // produced the number in the first place -- `--entropy` is
    // caller-supplied, and the caller may equally have measured it, read it
    // from a derived binary-info read, or copied it out of a report. So the
    // value now names the CHANNEL, which this code can actually observe,
    // rather than guessing a producer; the historical producer is recorded
    // above in prose, with no token an extractor could mistake for a live
    // route.
    entropySource = "caller-supplied";
  } else if (bytes && bytes.length > 0) {
    measured = shannonEntropy(bytes);
    entropySource = "local-shannon-entropy";
  }

  if (measured !== null) {
    evidence.push(Object.freeze({ source: entropySource, entropy: measured, threshold }));
    return fromEntropy(measured, threshold, evidence, checkedAt);
  }

  // --- Route 3: the explicit unknown, always with a reason.
  return unknownFinding(
    "no packer-identity route was available: this project's own tool and command-line surfaces expose no " +
      "packer name, the external oracle was absent, and no entropy measurement was supplied, so packedness " +
      "could not be established either",
    evidence,
    checkedAt,
  );
}

// ---------------------------------------------------------------------------
// The live gate. Absence of the oracle is an EXPECTED SKIP by default and a
// hard FAIL under the opt-in variable -- never a pass either way.
// ---------------------------------------------------------------------------

/**
 * Returns a non-empty skip reason naming the absent oracle, or `false` when a
 * real one is available -- meant to be handed straight to a test runner's
 * `{ skip }` option so the skip is VISIBLE in the report rather than a test
 * that quietly returns early and reads as a pass.
 */
export function skipReasonForUnp64(probed) {
  const result = probed ?? probeUnp64();
  if (result.available === true) return false;
  return (
    `the oracle-route tests are skipped -- no external packer identifier was found (${result.reason ?? "reason not recorded"}). ` +
    `Point ${ORACLE_ENV_VARS.join(" or ")} at one, or install "${DEFAULT_ORACLE_COMMAND}". ` +
    `An absent oracle is an EXPECTED SKIP here, never a pass: set ${REQUIRE_ORACLE_ENV_VAR} to turn it into a hard failure.`
  );
}

// ---------------------------------------------------------------------------
// Command-line entry: one file in, one JSON object out.
// ---------------------------------------------------------------------------

const USAGE = `usage: node src/skills/c64-program-recon/scripts/packer-finding.mjs <file> [--entropy N]

Prints ONE JSON object: the packer recon finding for <file>.

  packer            the packer name, or null. Non-null ONLY when an external
                    oracle stated it verbatim. This project never guesses one.
  verdict           one of: ${PACKER_VERDICTS.join(", ")}
  confidence        HIGH (oracle route only), MEDIUM (entropy route), LOW
  route             ${ROUTE_ORACLE}, ${ROUTE_ENTROPY}, or ${ROUTE_NONE}
  evidence          what each step actually saw
  checkedAt         when this was answered
  unavailableReason why no name is being reported, whenever there is none

--entropy overrides the locally computed value with one you already have (the
curated binary-info tool reports it). The entropy gate answers PACKEDNESS and
never identity.`;

function readFlag(argv, name) {
  const index = argv.indexOf(`--${name}`);
  if (index === -1) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) return undefined;
  return value;
}

function main(argv) {
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    if (token === "--entropy") {
      i++;
      continue;
    }
    if (token.startsWith("--")) continue;
    positional.push(token);
  }

  const filePath = positional[0];
  if (filePath === undefined || argv.includes("--help") || argv.includes("-h")) {
    console.log(USAGE);
    process.exit(filePath === undefined && !argv.includes("--help") && !argv.includes("-h") ? 2 : 0);
  }

  let bytes = null;
  try {
    bytes = readFileSync(filePath);
  } catch (err) {
    console.error(`packer-finding: could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }

  const entropyRaw = readFlag(argv, "entropy");
  const entropy = entropyRaw === undefined ? null : Number.parseFloat(entropyRaw);
  if (entropyRaw !== undefined && !Number.isFinite(entropy)) {
    console.error(`packer-finding: --entropy must be a number, got "${entropyRaw}"`);
    process.exit(1);
  }

  const finding = packerFinding({ filePath, bytes, ...(entropy === null ? {} : { entropy }) });
  console.log(JSON.stringify(finding, null, 2));
}

// Run only when invoked directly, never when imported by the colocated test.
if (process.argv[1] && process.argv[1].endsWith("packer-finding.mjs")) {
  main(process.argv.slice(2));
}
