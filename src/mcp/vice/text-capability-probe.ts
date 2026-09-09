// text-capability-probe.ts
//
// THE ONE owning module for PARSE-04: probing whether a connected VICE
// binary was BUILT with the tracing/profiling support a given text-monitor
// command needs, and answering the gap by name -- capability, command,
// binary, remedy -- never a silent empty result and never a parse error
// that reads like a defect in this project.
//
// WHY PER-COMMAND, NOT ONE GUARD FOR ALL FIVE: VICE gates `memmapshow` and
// `chis` behind the SAME build-time C macro (FEATURE_CPUMEMHISTORY) and both
// print the IDENTICAL disabled-stub string when it is compiled out. `bt` and
// `prof flat` carry NO build-time guard at all -- a probe for them can only
// ever come back capable or indeterminate. `io` (register decode) has no
// build-time guard either, but degrades gracefully per-chip with its own two
// runtime strings ("No details available." / "No I/O regs available") when a
// register has no dump function -- a CHIP-LEVEL degradation, not a missing
// build capability, and reported with different wording so a reader is never
// told the wrong reason shape for the same command. Probing per command, per
// binary is what stays correct under all three shapes; one guard per command
// or one guard for all five would both be wrong.
//
// D-42-2 (locked): the cache is IN-PROCESS ONLY, keyed by the backend kind
// plus a RESOLVED absolute binary path, and the key is never operator-
// supplied -- it is built from the identity StockDispatchDeps already
// threads down from the dispatch layer's single resolvedBackend() call
// (stock-dispatch.ts's own header comment), cross-checked against the
// broker's own hostState() report when the broker reports one. A build
// capability is a property of a BINARY FILE; a persisted answer would
// outlive the VICE rebuild that invalidated it, which is worse than no
// answer at all. This module therefore contains no filesystem write and no
// reference to the tool-written root -- asserted mechanically by this
// module's own test, not by review.
//
// D-42-3 (inherited from textmon-memmap.ts, decided once for all five text
// parsers this phase adds): refuse by RETURNING, never by throwing. This
// module never throws for a malformed, empty, unresolved, or disagreeing
// input -- every failure mode reports through TextCapabilityVerdict's
// three-state outcome instead.
//
// A DIFFERENT, ALREADY-PERSISTED FACT THIS MODULE MUST NOT TOUCH: the
// supervisor's backend record (backend-detect.mts's readCapabilityRecord())
// already carries a `cpuHistoryAvailable` field. That is the BINARY
// MONITOR's own opcode availability (CPUHISTORY_GET, 0x86) -- a protocol-
// VERSION question, gated by VICE >= 3.10 on the wire opcode itself. This
// module answers a build-FLAG question about the TEXT monitor, which the
// project's own committed fixtures prove is a genuinely different fact:
// `chis` returns real CPU-history entries with per-entry cycle counts over
// the text channel on genuine stock VICE 3.9 (the fixture batch's own
// cpu-history-stock.txt), the exact binary the binary-monitor opcode cannot
// reach at all. This module neither reads, writes, nor overwrites
// `cpuHistoryAvailable`; collapsing the two answers would produce a
// confidently wrong verdict on the same binary.
//
// SOURCE-TRACED, NOT LIVE-OBSERVED: CPUHISTORY_DISABLED_STUB and the two
// `io` degradation strings below were read from VICE's own C source
// (mon_memmap.c, monitor.c) during this phase's research pass, not observed
// over a live socket against a binary genuinely built without the feature --
// no such binary exists on this host and building one is out of scope for
// this plan (see 42-VALIDATION.md's manual-only entry). Do not upgrade this
// module's own header comment, or any string it renders, to imply a binary
// was ever seen refusing.
//
// WHAT NOT TO DO:
//   - Never import a transport module, a filesystem module, or a host-bound
//     resolver here. This module takes its dial function and its identity
//     as ARGUMENTS (`ProbeTextCapabilityOptions`); the only import anywhere
//     in this file is a type-only import of ViceBackend, erased entirely by
//     Node's type-stripping at runtime, matching capability-registry.ts's
//     own "imports nothing at runtime" posture.
//   - Never write a capability verdict to disk, in any form -- not under
//     the tool-written root directory, not in the supervisor's backend
//     record, not in a temp file. See the D-42-2 paragraph above.
//   - Never key the cache on an unresolved binary path (a bare name like
//     "x64sc" is not a binary identity) or on an identity the broker's own
//     report definitely disagrees with. Attributing a capability answer to
//     the wrong binary is precisely the mislabelling failure the fixture
//     batch's own README records having paid for once (see
//     fixtures/textmon/README.md's "capturedFrom kind token is DERIVED, not
//     operator-supplied" paragraph).
//   - Never cache an indeterminate outcome, a rejected dial, or an unkeyable
//     identity -- a transient failure must not poison this process's answer
//     for its whole lifetime.
//   - Never conflate `cpuHistoryAvailable` (backend-detect.mts) with this
//     module's own verdicts -- see the paragraph above.

import type { ViceBackend } from "./backend-detect.mts";

// ---------------------------------------------------------------------------
// The canonical command set and report order.
// ---------------------------------------------------------------------------

/** The five text-monitor commands PARSE-04 probes, in the module's declared
 * canonical report order -- `textCapabilityRefusalMessage()` always renders
 * in this order, independent of probe completion order or the order
 * verdicts are handed to it in. */
export const TEXT_CAPABILITY_COMMANDS = Object.freeze([
  "memmapshow",
  "prof flat",
  "chis",
  "bt",
  "io",
] as const);

export type TextCapabilityCommand = (typeof TEXT_CAPABILITY_COMMANDS)[number];

/** The two commands sharing FEATURE_CPUMEMHISTORY, VICE's build-time C
 * macro -- the only two commands a probe can legitimately classify
 * "missing" for. `bt` and `prof flat` carry no build-time guard at all
 * (only ever capable or indeterminate); `io` carries no build-time guard
 * either, but degrades per-chip with its own two runtime strings (see
 * IO_CHIP_DEGRADATION_STRINGS below) -- a different fact, reported with
 * different wording, never a build-capability claim. */
export const CPUHISTORY_GATED_COMMANDS: readonly TextCapabilityCommand[] = Object.freeze(["memmapshow", "chis"]);

/** The exact disabled-stub TEXT (VICE's own C source prints this line
 * followed by a trailing newline; this constant omits the newline because
 * classification always compares against a trimmed, already-split line).
 * SOURCE-TRACED, not live-observed -- see this module's header comment. */
export const CPUHISTORY_DISABLED_STUB = "Disabled. configure with --enable-cpuhistory and recompile.";

const CPUHISTORY_CAPABILITY_NAME = "CPU-and-memory-history build support (shared by memmapshow and chis)";

const CPUHISTORY_REMEDY =
  "rebuild the binary with --enable-cpuhistory (VICE compiles this in by default; only an explicit " +
  "--disable-cpuhistory at configure time removes it)";

/** `io`'s own two chip-level degradation strings (monitor.c's dump-path
 * iterator) -- printed per-chip when a specific register has no dump
 * function, or when the register list itself is empty for the current
 * bank. Neither is a build-time refusal; both are reported as a chip
 * reporting it has nothing to show, worded distinctly from a missing build
 * capability. SOURCE-TRACED, not live-observed -- see this module's header
 * comment. */
const IO_CHIP_DEGRADATION_STRINGS: readonly string[] = Object.freeze(["No details available.", "No I/O regs available"]);

// ---------------------------------------------------------------------------
// Identity and the cache key (D-42-2).
// ---------------------------------------------------------------------------

/** The identity a probe is keyed on: the backend kind plus a binary path,
 * with `resolved` stating whether that path is a real resolved absolute
 * path (as opposed to a bare configured name like "x64sc" that resolution
 * failed on -- WR-05's own distinction, threaded down unchanged from
 * `StockDispatchDeps.resolvedBinaryPath`/`resolvedBinaryPathIsResolved`). */
export interface TextCapabilityIdentity {
  readonly backend: ViceBackend;
  readonly binPath: string;
  readonly resolved: boolean;
}

/** The broker's OWN reported identity (`BrokerControlSession.hostState()`'s
 * `vice_bin`/`backend` fields), used only for the cross-check against
 * `TextCapabilityIdentity` above. `backend: null` and `binPath: ""` are
 * both ABSENT EVIDENCE, never disagreement -- mirroring vice-proxy.ts's own
 * backend-mismatch refusal discipline ("Absent evidence is NOT
 * disagreement: a broker that does not report a backend ... leaves
 * `backend: null`, and ... is not allowed to block an acquire. Only a
 * definite, named mismatch refuses."). */
export interface TextCapabilityBrokerIdentity {
  readonly backend: ViceBackend | null;
  readonly binPath: string;
}

/** Renders the cache key `"<backend>:<binPath>"` for a resolved identity,
 * or `null` when `identity.resolved` is false -- a bare binary name is not
 * a binary identity, and a capability answer filed under one would be
 * attributed to whatever that name resolves to NEXT time, not this time. */
export function textCapabilityCacheKey(identity: TextCapabilityIdentity): string | null {
  if (!identity.resolved) return null;
  return `${identity.backend}:${identity.binPath}`;
}

// ---------------------------------------------------------------------------
// The verdict.
// ---------------------------------------------------------------------------

export type TextCapabilityOutcome = "capable" | "missing" | "indeterminate";

/** One command's answer. `capability`/`remedy` are present only when
 * `outcome === "missing"`. `dialError` is present only when the dial itself
 * rejected (a transport failure, never a parse result). `identityDisagreement`
 * is present only when the cross-check against a supplied broker identity
 * found a DEFINITE mismatch -- and when present, the verdict was never
 * cached (see `probeTextCapability`'s own doc comment). `fromCache` is
 * `true` only when this verdict was served from a prior probe's cached
 * answer rather than a fresh dial. */
export interface TextCapabilityVerdict {
  readonly command: TextCapabilityCommand;
  readonly outcome: TextCapabilityOutcome;
  readonly response: string;
  readonly capability?: string;
  readonly remedy?: string;
  readonly identity: TextCapabilityIdentity;
  readonly fromCache: boolean;
  readonly dialError?: string;
  readonly identityDisagreement?: string;
}

// ---------------------------------------------------------------------------
// The classifier -- pure, no dial, no identity, no cache.
// ---------------------------------------------------------------------------

export interface TextCapabilityClassification {
  readonly outcome: TextCapabilityOutcome;
  readonly capability?: string;
  readonly remedy?: string;
}

/** The first non-empty line of `text`, UNTRIMMED (callers trim it
 * themselves) -- `""` when every line is empty or whitespace-only. Bounded
 * by construction: one pass over `text.split("\n")`, no recursion. */
function firstNonEmptyLine(text: string): string {
  for (const line of text.split("\n")) {
    if (line.trim() !== "") return line;
  }
  return "";
}

/**
 * Classifies one text-monitor reply for one command. Equality against the
 * FIRST NON-EMPTY LINE, trimmed, only -- never a substring search over the
 * whole payload -- because a large legitimate reply must never be misread
 * as a refusal because the disabled-stub words happen to appear somewhere
 * inside it (e.g. `memmapshow`'s own real output could in principle carry
 * arbitrary bytes on a later line; only the first line is the command's own
 * answer to "did this even run").
 *
 * A missing verdict is possible ONLY for `command` in CPUHISTORY_GATED_COMMANDS
 * (`memmapshow`, `chis`) -- VICE never gates any other command behind
 * FEATURE_CPUMEMHISTORY, so this classifier never renders a build-capability
 * claim for `bt`, `prof flat`, or `io` even if their first line happened to
 * coincidentally equal the stub text.
 *
 * An empty or whitespace-only reply is `indeterminate`, never `capable`:
 * PARSE-04's whole point is that a user is never handed a silent empty
 * result, so "nothing came back" is a named state, not an absence of one.
 */
export function classifyTextCapabilityResponse(
  command: TextCapabilityCommand,
  response: string,
): TextCapabilityClassification {
  if (typeof response !== "string" || response.trim() === "") {
    return { outcome: "indeterminate" };
  }
  const firstLine = firstNonEmptyLine(response).trim();
  if (CPUHISTORY_GATED_COMMANDS.includes(command) && firstLine === CPUHISTORY_DISABLED_STUB) {
    return { outcome: "missing", capability: CPUHISTORY_CAPABILITY_NAME, remedy: CPUHISTORY_REMEDY };
  }
  return { outcome: "capable" };
}

/** `io`'s own chip-level degradation text, when `verdict`'s first line
 * matches one of `IO_CHIP_DEGRADATION_STRINGS` -- `null` for every other
 * command, and `null` when `io`'s reply does not match either string
 * (a genuine register dump). Never a `TextCapabilityOutcome` of its own
 * (the three-state outcome stays exactly capable/missing/indeterminate,
 * per Task 1's own locked shape) -- this is a render-time distinction over
 * an otherwise-capable `io` verdict. */
function ioChipDegradationText(command: TextCapabilityCommand, response: string): string | null {
  if (command !== "io") return null;
  const firstLine = firstNonEmptyLine(response).trim();
  return IO_CHIP_DEGRADATION_STRINGS.includes(firstLine) ? firstLine : null;
}

// ---------------------------------------------------------------------------
// The identity cross-check.
// ---------------------------------------------------------------------------

/** `null` when there is nothing to disagree about (no broker identity
 * supplied, or every field it reports is absent evidence); otherwise a
 * human-readable sentence naming BOTH observed identities, for embedding in
 * a verdict and, from there, a rendered message -- never silently keyed to
 * one of the two without saying so. */
function identityDisagreementText(
  identity: TextCapabilityIdentity,
  brokerIdentity: TextCapabilityBrokerIdentity | undefined,
): string | null {
  if (!brokerIdentity) return null;
  const backendAbsent = brokerIdentity.backend === null;
  const pathAbsent = brokerIdentity.binPath === "";
  const backendDisagrees = !backendAbsent && brokerIdentity.backend !== identity.backend;
  const pathDisagrees = !pathAbsent && brokerIdentity.binPath !== identity.binPath;
  if (!backendDisagrees && !pathDisagrees) return null;
  return (
    `text-capability-probe: identity disagreement -- the dispatch-resolved identity is ` +
    `"${identity.backend}:${identity.binPath}" but the broker reports ` +
    `"${brokerIdentity.backend ?? "(none)"}:${brokerIdentity.binPath || "(empty)"}" -- refusing to cache an ` +
    `answer that may not be attributable to either binary with confidence`
  );
}

// ---------------------------------------------------------------------------
// The cache -- in-process only (D-42-2), never persisted to disk.
// ---------------------------------------------------------------------------

const capabilityCache = new Map<string, Map<TextCapabilityCommand, TextCapabilityVerdict>>();
const inFlightProbes = new Map<string, Promise<TextCapabilityVerdict>>();

/** Test-only: clears the in-process cache and the in-flight dial memo. Never
 * called by any production code path -- production never needs "start
 * over," only a test driving many independent scenarios in one process. */
export function resetTextCapabilityCache(): void {
  capabilityCache.clear();
  inFlightProbes.clear();
}

export interface ProbeTextCapabilityOptions {
  readonly command: TextCapabilityCommand;
  readonly identity: TextCapabilityIdentity;
  /** The broker's own reported identity, for the D-42-2 cross-check.
   * Omitted entirely is the same as an all-absent broker report -- absent
   * evidence, never disagreement. */
  readonly brokerIdentity?: TextCapabilityBrokerIdentity;
  /** Issues `command` over the text-monitor channel and resolves to the
   * framed reply string, or rejects on a transport failure. The ONLY
   * transport-touching thing this module ever calls, and it is always
   * INJECTED -- this module has no socket, no channel lock, and no lease of
   * its own. */
  readonly dial: (command: TextCapabilityCommand) => Promise<string>;
}

async function runProbe(
  command: TextCapabilityCommand,
  identity: TextCapabilityIdentity,
  brokerIdentity: TextCapabilityBrokerIdentity | undefined,
  dial: (command: TextCapabilityCommand) => Promise<string>,
  key: string | null,
): Promise<TextCapabilityVerdict> {
  const disagreement = identityDisagreementText(identity, brokerIdentity);

  let response = "";
  let dialError: string | undefined;
  try {
    response = await dial(command);
  } catch (err) {
    dialError = err instanceof Error ? err.message : String(err);
  }

  const classification: TextCapabilityClassification =
    dialError !== undefined ? { outcome: "indeterminate" } : classifyTextCapabilityResponse(command, response);

  const verdict: TextCapabilityVerdict = {
    command,
    outcome: classification.outcome,
    response,
    identity,
    fromCache: false,
    ...(classification.capability !== undefined ? { capability: classification.capability } : {}),
    ...(classification.remedy !== undefined ? { remedy: classification.remedy } : {}),
    ...(dialError !== undefined ? { dialError } : {}),
    ...(disagreement !== null ? { identityDisagreement: disagreement } : {}),
  };

  const cacheable = key !== null && disagreement === null && dialError === undefined && classification.outcome !== "indeterminate";
  if (cacheable) {
    let forKey = capabilityCache.get(key!);
    if (!forKey) {
      forKey = new Map();
      capabilityCache.set(key!, forKey);
    }
    forKey.set(command, verdict);
  }

  return verdict;
}

/**
 * Probes `options.command` against `options.identity`, using the in-process
 * cache (D-42-2) when a definitive answer is already on file.
 *
 * Caching rules, exactly:
 *   - `capable` or `missing`, from an identity that produced a cache key
 *     (`textCapabilityCacheKey(identity) !== null`) and whose cross-check
 *     against `options.brokerIdentity` did not definitely disagree: CACHED.
 *   - `indeterminate` (empty/whitespace reply), a rejected dial, an
 *     unresolved identity (no key), or a definite identity disagreement:
 *     NEVER cached -- a transient failure must not poison this process's
 *     answer for its whole lifetime, and an unproven identity must never be
 *     asserted as fact to a later caller.
 *
 * Concurrency: two concurrent probes of the SAME key and command dial
 * exactly once -- the in-flight promise is memoised and handed to the
 * second caller, mirroring the broker's own single-owner check-and-set
 * launch guard (`broker-launch.mts`) for the same reason.
 */
export async function probeTextCapability(options: ProbeTextCapabilityOptions): Promise<TextCapabilityVerdict> {
  const { command, identity, brokerIdentity, dial } = options;
  const key = textCapabilityCacheKey(identity);

  if (key === null) {
    // Unkeyable identity: never cached, never memoised in-flight -- there is
    // no key to memoise against.
    return runProbe(command, identity, brokerIdentity, dial, null);
  }

  const cachedForKey = capabilityCache.get(key);
  const cached = cachedForKey?.get(command);
  if (cached) {
    return { ...cached, fromCache: true };
  }

  const inFlightKey = `${key} ${command}`;
  const existing = inFlightProbes.get(inFlightKey);
  if (existing) {
    return existing;
  }

  const promise = runProbe(command, identity, brokerIdentity, dial, key);
  inFlightProbes.set(inFlightKey, promise);
  try {
    return await promise;
  } finally {
    inFlightProbes.delete(inFlightKey);
  }
}

// ---------------------------------------------------------------------------
// The user-facing answer.
// ---------------------------------------------------------------------------

interface MissingGroup {
  readonly kind: "missing-group";
  readonly capability: string;
  readonly remedy: string;
  readonly binPath: string;
  readonly commands: TextCapabilityCommand[];
}

interface DirectLine {
  readonly kind: "line";
  readonly text: string;
}

function buildMissingGroupText(group: MissingGroup): string {
  return (
    `${group.commands.join(", ")}: ${group.capability} is missing on ${group.binPath} -- ${group.remedy}. ` +
    (group.commands.length > 1
      ? `Both commands are compiled behind the same VICE build macro, so this is one gap, not two.`
      : ``)
  ).trim();
}

function indeterminateLine(verdict: TextCapabilityVerdict): string {
  const observed =
    verdict.dialError !== undefined ? `a dial failure (${verdict.dialError})` : "an empty or unframeable reply";
  return (
    `${verdict.command}: whether this text-monitor build capability is present on ${verdict.identity.binPath} is ` +
    `unknown, not negative -- the probe observed ${observed}.`
  );
}

function chipDegradationLine(verdict: TextCapabilityVerdict, observedLine: string): string {
  return (
    `${verdict.command}: ${verdict.identity.binPath} reports ${JSON.stringify(observedLine)} -- the chip has ` +
    `nothing to report here, not a missing build capability.`
  );
}

/**
 * Renders one message over `verdicts`, in `TEXT_CAPABILITY_COMMANDS` order
 * (independent of the order `verdicts` was handed in), with three
 * distinguishable shapes -- never one wording reused for all three, per
 * `capability-registry.ts`'s own "keyed by reason shape" discipline:
 *
 *   1. A MISSING build capability: command(s), capability name, binary
 *      path, one remedy sentence. Two or more verdicts sharing the same
 *      `capability`/`remedy` (memmapshow + chis, always) are merged into
 *      ONE line naming both commands and stating the remedy once -- telling
 *      a user about two independent gaps when one flag fixes both is a
 *      worse answer than telling them about one.
 *   2. An INDETERMINATE probe: command, binary, what was observed (a dial
 *      failure or an empty reply), and that the answer is unknown rather
 *      than negative.
 *   3. A CHIP-LEVEL DEGRADATION (`io`'s own two runtime strings): command,
 *      binary, the observed string, and that this is the chip reporting it
 *      has nothing to show, not a build gap.
 *
 * A fully `capable` verdict for any other command renders nothing -- this
 * is a REFUSAL/gap message, not a general-purpose status report.
 *
 * No line this function renders names a phase number (own test asserts
 * this against the same `/\bPhase\s+\d/i` pattern `docs-dangling-refs.test.ts`
 * enforces tree-wide once this module joins `files[]`).
 */
export function textCapabilityRefusalMessage(verdicts: readonly TextCapabilityVerdict[]): string {
  const byCommand = new Map<TextCapabilityCommand, TextCapabilityVerdict>();
  for (const v of verdicts) byCommand.set(v.command, v);

  const ordered = TEXT_CAPABILITY_COMMANDS.filter((c) => byCommand.has(c)).map((c) => byCommand.get(c)!);

  const groupsByKey = new Map<string, MissingGroup>();
  const queue: (MissingGroup | DirectLine)[] = [];

  for (const verdict of ordered) {
    if (verdict.outcome === "missing" && verdict.capability !== undefined && verdict.remedy !== undefined) {
      const groupKey = `${verdict.capability} ${verdict.remedy}`;
      let group = groupsByKey.get(groupKey);
      if (!group) {
        group = { kind: "missing-group", capability: verdict.capability, remedy: verdict.remedy, binPath: verdict.identity.binPath, commands: [] };
        groupsByKey.set(groupKey, group);
        queue.push(group);
      }
      group.commands.push(verdict.command);
      continue;
    }
    if (verdict.outcome === "indeterminate") {
      queue.push({ kind: "line", text: indeterminateLine(verdict) });
      continue;
    }
    const degraded = ioChipDegradationText(verdict.command, verdict.response);
    if (degraded !== null) {
      queue.push({ kind: "line", text: chipDegradationLine(verdict, degraded) });
    }
  }

  return queue.map((item) => (item.kind === "missing-group" ? buildMissingGroupText(item) : item.text)).join("\n");
}
