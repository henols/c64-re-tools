#!/usr/bin/env node
// text-protocol.ts
//
// THE ONE place that frames the `-remotemonitor` TEXT-monitor wire's bytes --
// nothing else in this tree decodes text-monitor bytes. This is the text-wire
// sibling of stock-protocol.ts's ViceMonitorClient (the binary-monitor
// client): same private-field shape (#socket, #buffer, bound
// #onData/#onClose/#onError handlers, a `connected` getter), same
// concat-then-decode-once discipline, same "never leak a live socket on a
// second connect()" rule -- but the text wire has NO length-prefixed frame,
// NO request-id multiplexing, and NO api_version byte. One command is
// outstanding at a time; the reply is framed by a literal, human-readable
// prompt string VICE writes when it is ready for the next command. Because
// of that, this class deliberately DROPS stock-protocol.ts's
// #pending/#nextRequestId/#settledRing/#settledSet machinery entirely --
// there is nothing to correlate a reply against beyond "is a command
// outstanding right now".
//
// Plan 41-01: Task 1 shipped the happy path plus a quiescence window pulled
// forward from Task 2's original scope -- this task's own live acceptance
// criterion (a real `device c:` round trip against genuine stock VICE) was
// MEASURED to fail without it. A fresh connection's very FIRST command reply
// can arrive as TWO separate TCP chunks: a residual leading prompt
// (`(C:$xxxx) `) with no command output yet attached, then the real output.
// A resolve-on-first-tail-match design mistakes the first chunk alone for a
// complete (empty) response -- exactly the shape Control 2 (a tail match
// that is not really final) exists to catch, occurring naturally rather than
// needing to be planted. See the plan SUMMARY for the measured repro. Task 2
// adds: the passive banner drain (D-13(b)) for bytes arriving with no
// command outstanding, enforcement of TEXT_MAX_BUFFERED_LEN, and the full
// deterministic test suite (including a controlled RED/GREEN demonstration
// of both planted controls).
//
// WHAT NOT TO DO:
//   - Never re-implement text-wire framing in a dispatcher, a tool handler,
//     or channel-lock.ts -- this module is the ONE place it happens.
//   - Never call command() outside withTextChannelLock() (plan 41-02,
//     CHAN-04) -- command() itself refuses when channel-lock.ts's mutex is
//     not currently held by the text channel, so a call site that bypasses
//     withTextChannelLock() is refused, not silently allowed through.
//   - Never widen stock-protocol.ts to also speak text. The binary and text
//     wires are structurally different protocols (length-prefixed frames
//     with a request-id demux vs. a free-text prompt terminator with no
//     multiplexing at all) and belong in separate modules, mirroring this
//     project's existing binary/text file split.
//   - Never accept a caller-supplied, free-text command string anywhere in
//     this module's public surface. VICE's text monitor accepts arbitrary
//     monitor commands and is UNAUTHENTICATED -- it can `load` and `save`
//     host files, exactly like the security caveat broker-launch.mts's own
//     bind-widening warning already states for this same channel. Every
//     outbound command must come from TEXT_COMMAND_ALLOWLIST below;
//     command() refuses anything else BY NAME, before a single byte reaches
//     the socket (D-01). The ONE stated, bounded exception (D-42-1, plan
//     42-04, widened plan 50-04): TEXT_COMMAND_PARAM_SPECS lets exactly
//     four of the allowlisted verbs also carry a caller-chosen value, but
//     that value is always a typed, bounded number -- never a string, never
//     a rest-of-line passthrough, never a `params` field -- validated and
//     rendered by buildTextCommand(), the ONE place such a string is built,
//     and accepted as dialable only when isDialableTextCommandForVerb()'s
//     own re-render round trip reproduces it byte-for-byte. This does not
//     widen what "free-text command" means above; it narrows one bounded
//     numeric slot per verb. Plan 50-04's `load` entry is the sole
//     exception to "never a string": the FILENAME half of that one entry is
//     not a caller-supplied string at all -- it is baked into the verb's
//     own frozen identity, a reviewed literal chosen by this file, never a
//     value a caller passes in. Only the device NUMBER is the caller's
//     bounded value, exactly like every other entry in this table. See
//     TEXT_COMMAND_PARAM_SPECS's own `load` entry below for the full
//     rationale.
//   - Never frame a response by a timeout, a byte count, or any fallback
//     that hands back a plausible-looking partial payload. A response that
//     cannot be honestly framed refuses by name (TextFramingError), naming
//     what was actually observed -- never a guess.
import { EventEmitter } from "node:events";
import net from "node:net";
import { join } from "node:path";

import { ViceError } from "./vice-errors.ts";
import { acquireChannelLock, currentChannelLockHolder } from "./channel-lock.ts";
import { repoRoot } from "./repo-root.ts";

// ---------------------------------------------------------------------------
// The prompt terminator and the closed command allowlist.
// ---------------------------------------------------------------------------

/**
 * Matches the trailing `(C:$xxxx) ` prompt VICE's text monitor writes once it
 * has finished producing a command's output and is ready for the next one.
 * Anchored at the buffer's TAIL ($) deliberately: a command whose own output
 * happens to CONTAIN prompt-shaped text partway through (the second planted
 * control this phase's criterion names) must never be mistaken for the real
 * terminator merely because the pattern occurs somewhere in the stream --
 * only a match at the true end counts.
 */
export const PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

/**
 * The closed set of verb strings this project may send over the text
 * channel (D-01/D-02). `device c:` and `warp on`/`warp off` reach `tools/
 * list` as their own MCP tools; the remaining five (`memmapshow`,
 * `prof flat`, `chis`, `bt`, `io`) are reachable ONLY in-process through this
 * allowlist -- covered by this file's own framing controls, but not yet
 * exposed as tools -- until a later plan lands their owning text-format
 * parsers. Frozen: a ninth entry is a conscious edit here, never a
 * speculative widening, and never a free-text field accepting anything
 * outside this list.
 *
 * `prof on`/`prof off` (plan 42-09, a conscious, measured widening, not a
 * speculative one): live-testing `prof flat` against a genuinely fresh
 * stock instance MEASURED that VICE's own profiler defaults to off --
 * `prof flat` alone returns `"No profiling data available. Start profiling
 * with \"prof on\"."`, never real rows, until `prof on` is issued first on
 * that same machine. No handler in this tree issues `prof on` today (a
 * real, separately-tracked production gap -- `vice_profile_flat` cannot
 * yet produce real data against a freshly launched instance); these two
 * verbs are added here ONLY so the live opt-in suite can toggle the
 * profiler on before proving `prof flat`'s own parsing path, and off again
 * afterward, leaving the toggle itself reachable but unused elsewhere.
 *
 * `memmapzap` (plan 43-01, a conscious, measured widening, not a speculative
 * one): clears VICE's accumulated memory-access map (`mon_memmap_zap()`'s
 * `memset()`, per the VICE Manual and `mon_memmap.c`) so a runtime-evidence
 * measurement bracket starts from nothing rather than inheriting whatever
 * `memmapshow` has accumulated since the instance booted. This is what lets
 * the evidence layer arm a fresh bracket immediately before a run instead of
 * subtracting a prior baseline after the fact. The sibling verb `memmapsave`
 * is deliberately NOT added here -- it writes a host file, and this
 * allowlist's own membership test (`text-protocol.test.ts`) refuses any
 * entry whose name matches the pattern that spells the word `save`, the
 * same file-touching-WRITE-verb rule `device c:`, `warp on/off`,
 * `memmapshow`, `prof flat`, `chis`, `bt`, `io` and `prof on/off` already
 * satisfy.
 *
 * `load` (plan 50-04, 2026-09-15, a conscious, measured widening, and the
 * FIRST one that reverses part of the load/save refusal rather than adding
 * a fresh always-safe verb): Phase 50 needed a way to get a committed
 * `.prg` into a running stock VICE for a live capture, and the project's
 * only other route -- `vice_autostart` against a bare `.prg` -- was
 * MEASURED to fail with monitor error `0x8f` (see
 * `fixtures/hazard-subject/FIXTURE-DESIGN.md`), with no committed `.d64`
 * writer anywhere in this tree to fall back to. The developer was shown
 * three routes that added no capability, a hand-authored disk image, or a
 * new file-WRITING host-tool capability -- and chose a FOURTH: the text
 * monitor's own `load` command (`load "<filename>" <device> [<address>]`,
 * VICE Manual ch. 12, `mon_parse.y`'s `disk_rules` grammar), because it
 * READS a host file and writes nothing back to the host. That is the
 * load-bearing distinction this widening rests on: this allowlist's own
 * rule above was never "no `load` or `save`" in principle, it was "no verb
 * that touches a host file" -- and `memmapsave`'s rejection above is a
 * WRITE. `load` is a READ, and the developer judged the original rule to
 * have over-reached for the read direction (recorded in
 * `.planning/phases/50-equivalence-and-modifiability/evidence/LOAD-ROUTE.md`).
 * This is NOT a general "load anything" capability: the entry added to
 * TEXT_COMMAND_PARAM_SPECS below bakes in the ONE committed fixture path
 * this phase's tracer plan targets as part of the verb's own frozen
 * identity, never a caller-supplied filename -- and, since plan 50-05, one
 * such frozen entry per member of the closed HAZARD_SUBJECT_PRG_RELPATHS
 * table, still never a caller-supplied filename. See those entries' own
 * comment for why a caller still cannot choose what gets loaded. `save`
 * remains refused exactly as before; only the read direction moved.
 */
export const TEXT_COMMAND_ALLOWLIST = Object.freeze([
  "device c:",
  "warp on",
  "warp off",
  "memmapshow",
  "prof flat",
  "chis",
  "bt",
  "io",
  "prof on",
  "prof off",
  "memmapzap",
] as const);

export type TextCommand = (typeof TEXT_COMMAND_ALLOWLIST)[number];

// ---------------------------------------------------------------------------
// Parameterized commands (D-42-1, plan 42-04, widened plan 50-04). Three of
// the allowlisted verbs -- "chis", "prof flat", "io" -- were captured on the
// real wire carrying a caller-chosen value ("chis 4", "prof flat 5",
// "io $d020" -- see fixtures/textmon/{cpu-history,flat-profile,
// register-decode}-stock.json's own "command" field), so a bare literal
// alone cannot reach them meaningfully. TEXT_COMMAND_ALLOWLIST above is NOT
// widened for this: its own membership assertion is unaffected by any entry
// here. TEXT_COMMAND_PARAM_SPECS is a SIBLING table describing, for the
// subset of verbs that take one, the bounded typed value each accepts and
// the ONE renderer that turns a validated value into the exact command
// string VICE accepts. Plan 50-04 adds a "load" entry, and plan 50-05 turns
// that single entry into one DERIVED entry per committed subject (see
// HAZARD_SUBJECT_PRG_RELPATHS) -- see those entries' own comment below and
// TEXT_COMMAND_ALLOWLIST's doc comment above for the full
// rationale; unlike the first three, this one is not sourced from a
// committed live-captured fixture (no live capture was run to add it -- the
// syntax is sourced directly from VICE's own upstream grammar and manual,
// cited on the entry itself).
// ---------------------------------------------------------------------------

/** The parameter kind a spec entry declares. "count" bounds a decimal
 * row/entry count (chis, prof flat), rendered as the verb, one space, and
 * the decimal digits with no padding and no leading zero. "address" bounds
 * a 16-bit machine address (io), rendered as the verb, one space, a dollar
 * sign, and exactly four lowercase hex digits, zero-padded -- the exact
 * form the committed register-decode-stock fixture was captured with. */
export type TextCommandParamKind = "count" | "address";

export interface TextCommandParamSpec {
  readonly kind: TextCommandParamKind;
  readonly min: number;
  readonly max: number;
  readonly render: (value: number) => string;
}

function renderCountParam(verb: string, value: number): string {
  return `${verb} ${value}`;
}

function renderAddressParam(verb: string, value: number): string {
  return `${verb} $${value.toString(16).padStart(4, "0")}`;
}

/**
 * The CLOSED set of committed fixtures the `load` widening below may load,
 * as an id -> BASENAME table (plan 50-04 committed the first member; plan
 * 50-05 turned the single constant into this table).
 *
 * WHY A TABLE AND NOT ONE CONSTANT PER SUBJECT. Plan 50-04's own note here
 * said a later plan adding a second committed subject would add "its OWN new
 * constant and its OWN new TEXT_COMMAND_PARAM_SPECS entry". Plan 50-05 is
 * that later plan, and plan 50-06 needs two more. Three hand-copied
 * constants, three hand-copied spec entries and three hand-copied verb
 * strings in text-tools.ts is three chances to mis-copy a path and load the
 * WRONG subject into a capture that then silently becomes evidence for the
 * wrong binary. The table removes that class of mistake: adding a subject is
 * ONE reviewed row here, and every spec entry, every verb string and the
 * tool's own accepted id set are all derived from it.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT. Every path here is still a reviewed
 * literal chosen by THIS file. A caller never supplies a path, a basename or
 * any fragment of one. The tool's `subject` argument (text-tools.ts) is an
 * enumerated ID that is looked up in this frozen table by exact membership
 * and is NEVER concatenated into a command string -- an id this table does
 * not carry is refused BY NAME, so the set of loadable files stays exactly
 * as closed as it was when it held one entry. TextCommandParamKind is
 * likewise untouched: the only caller-supplied VALUE is still the bounded
 * device NUMBER, and no parameter kind in this module accepts a string
 * domain (text-protocol.test.ts pins both facts, at runtime and at source
 * level).
 *
 * WHAT NOT TO DO: do not add a function that builds a path from caller
 * input, and do not widen a row into anything a caller can steer. Every row
 * below is a REVIEWED LITERAL spelled out in this file, whole.
 *
 * WHY THE ROWS CARRY A WHOLE REPO-RELATIVE PATH AND NOT A BARE BASENAME
 * (plan 50-06). Plan 50-05 wrote each row as a basename and joined a single
 * fixed `src/mcp/vice/fixtures/hazard-subject` directory onto it, and said
 * in this very comment that a build artifact outside that directory "gets a
 * reviewed row of its own, spelled out here the same way". Plan 50-06 is the
 * plan with that artifact: its rebuild `.prg` is produced from the committed
 * annotation store and lands under the PHASE EVIDENCE directory, not the
 * fixture directory, because it is an output of this phase rather than a
 * committed fixture. A basename-plus-fixed-directory row cannot spell that,
 * so the row now carries the whole repo-relative path as an array of
 * reviewed segments. Nothing about the CLOSURE changed: the path is still
 * chosen entirely by this file, a caller still supplies no path, no
 * basename, no directory and no fragment of one, and the only thing a
 * caller ever names is an id this table's own keys define.
 *
 * `misaligned` is deliberately ABSENT: `hazard-subject-misaligned.prg` is a
 * committed fixture, but no plan loads it into a running emulator -- it is
 * consumed offline by the hazard-report gate. The set is what is actually
 * dialed, not every fixture that happens to exist, and a committed test
 * asserts it stays undialable so the boundary is this table rather than a
 * directory.
 */
export const HAZARD_SUBJECT_PRG_RELPATHS = Object.freeze({
  /** Plan 50-04's tracer-slice subject -- the original. */
  original: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject.prg"]),
  /** Plan 50-02's regressed twin: three planted single-bit regressions at
   * the immediates feeding $D020, $D015 and $D018. Plan 50-05's red
   * control. */
  regressed: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject-regressed.prg"]),
  /** Plan 50-02's modified subject: one behaviour removed and one added.
   * Plan 50-06's modifiability observation. */
  modified: Object.freeze(["src", "mcp", "vice", "fixtures", "hazard-subject", "hazard-subject-modified.prg"]),
  /** Plan 50-06's REBUILD: the committed subject re-produced from its own
   * committed annotation store through importStoreDocument() ->
   * exportAsmTree() -> verifyAcmeAssemblesTree(), recorded in
   * `.planning/phases/50-equivalence-and-modifiability/evidence/REBUILD.md`.
   * The only row that is not a committed fixture, and the reason the rows
   * carry a whole repo-relative path -- see this table's own comment. */
  rebuild: Object.freeze([
    ".planning",
    "phases",
    "50-equivalence-and-modifiability",
    "evidence",
    "hazard-subject-rebuild.prg",
  ]),
  /** Plan 50-08's exported-edit subject: the same one-behaviour-removed,
   * one-behaviour-added pair `modified` carries, made this time in a file
   * `exportAsmTree()` itself emitted (`scope_087a.a`) rather than in the
   * hand-written `modified` fixture family, reassembled through the same
   * single oracle against a pre-registered byte manifest committed at
   * `fixtures/hazard-subject/exported-edit.manifest.json`. See
   * `docs/phase50-exported-edit-findings.md` and
   * `docs/phase50-exported-modifiability-transcript.md`. */
  "exported-edit": Object.freeze([
    "src",
    "mcp",
    "vice",
    "fixtures",
    "hazard-subject",
    "hazard-subject-exported-edit.prg",
  ]),
} as const);

/** The id half of HAZARD_SUBJECT_PRG_RELPATHS -- the only thing a caller
 * ever names, and never a path. */
export type HazardSubjectId = keyof typeof HAZARD_SUBJECT_PRG_RELPATHS;

/** The frozen id list, in table order. Exported so text-tools.ts can state
 * the accepted set in its refusal message without re-typing it. */
export const HAZARD_SUBJECT_IDS: readonly HazardSubjectId[] = Object.freeze(
  Object.keys(HAZARD_SUBJECT_PRG_RELPATHS) as HazardSubjectId[],
);

/** Each row's own last segment, DERIVED from the table above rather than
 * spelled a second time. Preserved by name because committed tests already
 * bind it, and because "which file does this id name" is a question worth
 * answering without re-walking the path. */
export const HAZARD_SUBJECT_PRG_BASENAMES: Readonly<Record<HazardSubjectId, string>> = Object.freeze(
  Object.fromEntries(
    HAZARD_SUBJECT_IDS.map((id) => {
      const segments = HAZARD_SUBJECT_PRG_RELPATHS[id];
      return [id, segments[segments.length - 1]] as const;
    }),
  ) as Record<HazardSubjectId, string>,
);

/** True only for an id this table actually carries. The ONE membership test
 * -- `Object.keys`-derived rather than a prototype lookup, so an inherited
 * name ("constructor", "__proto__", "toString") can never test true. */
export function isHazardSubjectId(value: unknown): value is HazardSubjectId {
  return typeof value === "string" && (HAZARD_SUBJECT_IDS as readonly string[]).includes(value);
}

/**
 * Absolute host path to one member of the closed table above. Three members
 * are committed fixtures; `rebuild` is plan 50-06's own build artifact under
 * the phase evidence directory, which is why the table's rows carry a whole
 * repo-relative path rather than a basename joined onto one fixed directory.
 *
 * Resolved through repoRoot() rather than hard-coded as a relative string:
 * `broker-launch.mts` spawns `x64sc` with no explicit `cwd` (checked
 * directly in this session -- no `cwd` option anywhere in that file), so a
 * repo-relative string would resolve against whatever directory the broker
 * process itself happened to be started from, not necessarily this
 * repository. An absolute path removes that ambiguity. Residual, stated
 * risk (not solved here): this is the CONTAINER-side path as seen by this
 * Node process; on a genuinely containerized deployment (this project has
 * none today -- host-developed, no devcontainer) the host process actually
 * running `x64sc` would need this translated through `hostpath.ts` first.
 * That translation is deliberately NOT added here, matching this project's
 * existing "solve the general host/container case only where it is
 * actually exercised" discipline -- a later plan that runs this widening
 * through a real container split adds it then.
 */
export function hazardSubjectPrgPath(id: HazardSubjectId): string {
  return join(repoRoot(), ...HAZARD_SUBJECT_PRG_RELPATHS[id]);
}

/** THE ONE place a `load "<path>"` verb string is spelled, for any subject.
 * Both the TEXT_COMMAND_PARAM_SPECS keys below and text-tools.ts's own
 * lookup go through this function, so the table key and the dialed verb can
 * never drift apart into two literals that differ by a character. */
export function hazardSubjectLoadVerb(id: HazardSubjectId): string {
  return `load "${hazardSubjectPrgPath(id)}"`;
}

/** Plan 50-04's original constant, preserved by name and by value: it is
 * exactly the `original` member of the table above. Kept because several
 * committed tests and text-tools.ts already bind this name, and because the
 * default subject is still the original. */
export const HAZARD_SUBJECT_PRG_PATH: string = hazardSubjectPrgPath("original");

/**
 * One frozen `load "<path>"` spec per member of HAZARD_SUBJECT_PRG_RELPATHS,
 * derived from that closed table rather than hand-copied per subject (plan
 * 50-05). Every entry is identical except for the reviewed path baked into
 * its own key: same "count" kind, same 0-11 device bound, same renderer. The
 * DERIVATION is the point -- a hand-copied entry per subject is how a path
 * and its renderer drift apart, and a renderer that disagrees with its own
 * key fails isDialableTextCommandForVerb()'s round trip and refuses the
 * command outright, which is a confusing way to discover a typo.
 */
const HAZARD_SUBJECT_LOAD_SPECS: Readonly<Record<string, TextCommandParamSpec>> = Object.freeze(
  Object.fromEntries(
    HAZARD_SUBJECT_IDS.map((id) => {
      const verb = hazardSubjectLoadVerb(id);
      return [
        verb,
        Object.freeze({
          kind: "count",
          min: 0,
          max: 11,
          render: (value: number) => renderCountParam(verb, value),
        } satisfies TextCommandParamSpec),
      ] as const;
    }),
  ),
);

/**
 * Frozen, per-verb parameter specs (D-42-1). Keyed by the verb exactly as
 * it appears in TEXT_COMMAND_ALLOWLIST above -- with ONE exception, the
 * `load` family (plan 50-04, one entry per committed subject since plan
 * 50-05), whose keys are full frozen literals that already embed their own
 * filename argument (see below); none of them ever appears in
 * TEXT_COMMAND_ALLOWLIST as a bare entry, because `load "<file>"` with no
 * device number is not valid VICE syntax on its own (`mon_parse.y`'s
 * `disk_rules: CMD_LOAD filename device_num opt_address` requires the
 * device number) -- unlike "chis"/"prof flat"/"io", which ARE independently
 * valid bare and so are also listed in TEXT_COMMAND_ALLOWLIST.
 *
 * A verb with no entry here takes no parameter -- it keeps dialing its bare
 * frozen literal, unchanged (the three no-parameter verbs -- "device c:",
 * "warp on", "warp off" -- are deliberately absent). The count bound is 1
 * through 65535 for "chis"/"prof flat": one because a zero-row request is
 * not a request, and 65535 because that is the same 16-bit domain the
 * CPU-history count lives in on this machine (CPUHISTORY_GET's own count
 * field, monitor_binary.c:1492). The address bound for "io" is 0 through
 * 65535, the full 16-bit machine address space.
 *
 * `load "<one committed subject path>"` (plan 50-04, 2026-09-15; one entry
 * per subject since plan 50-05): the single bounded value is still the
 * DEVICE NUMBER, per VICE's own documented syntax
 * (`load "<filename>" <device> [<address>]`, VICE Manual ch. 12 -- "If
 * device is 0, the file is read from the file system"). The address
 * argument is deliberately never offered here: omitting it makes VICE use
 * the load address embedded in the `.prg` file's own two-byte header, which
 * is exactly what a committed machine-code fixture needs and removes a
 * second numeric slot this project would otherwise have to bound and
 * justify for no present use. This reuses the SAME "count" kind and the
 * SAME `${verb} ${value}` rendering `renderCountParam()` already produces
 * for "chis"/"prof flat" -- no new TextCommandParamKind, no new render
 * shape; only the verb string itself is new, and it is a reviewed literal,
 * never a caller-supplied string, and the SUBJECT is chosen by an
 * enumerated id looked up in that same frozen table, never by a path a
 * caller passes in (see TEXT_COMMAND_ALLOWLIST's own `load` paragraph above
 * and HAZARD_SUBJECT_PRG_RELPATHS). Bound 0 through 11: 0 is the one value this phase
 * exercises (host filesystem, per the manual quote above); 1 through 11
 * spans this project's own documented device-number range elsewhere
 * (CLAUDE.md's wire memspace note: units 8-11 are the four IEC disk
 * drives this codebase ever names) -- a deliberately narrow bound, not the
 * full addressable device range VICE itself accepts, because nothing in
 * this project has a reason to dial anything wider yet.
 */
export const TEXT_COMMAND_PARAM_SPECS: Readonly<Record<string, TextCommandParamSpec>> = Object.freeze({
  chis: Object.freeze({
    kind: "count",
    min: 1,
    max: 65535,
    render: (value: number) => renderCountParam("chis", value),
  }),
  "prof flat": Object.freeze({
    kind: "count",
    min: 1,
    max: 65535,
    render: (value: number) => renderCountParam("prof flat", value),
  }),
  io: Object.freeze({
    kind: "address",
    min: 0,
    max: 65535,
    render: (value: number) => renderAddressParam("io", value),
  }),
  ...HAZARD_SUBJECT_LOAD_SPECS,
} satisfies Record<string, TextCommandParamSpec>);

function isSafeIntegerNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value);
}

export type BuildTextCommandResult = { readonly ok: true; readonly command: string } | { readonly ok: false; readonly message: string };

/**
 * THE ONE place a parameterized text-monitor command string is ever
 * constructed (D-42-1). Looks `verb` up in TEXT_COMMAND_PARAM_SPECS and
 * refuses BY NAME when it has no entry -- never falls through to a bare
 * concatenation. Validates `value` as a number, a safe integer, and within
 * the spec's inclusive bounds; a string that merely looks numeric is
 * refused too -- the parameter's type is a number, and accepting a string
 * here would be the first step back toward a free-text field. Returns a
 * discriminated result rather than throwing (mirrors textmon-memmap.ts's
 * D-42-3 discipline for the same reason): a refusal is a value the caller
 * renders to the user, not an exception whose meaning a catch block has to
 * guess.
 */
export function buildTextCommand(verb: string, value: unknown): BuildTextCommandResult {
  const spec = (TEXT_COMMAND_PARAM_SPECS as Record<string, TextCommandParamSpec | undefined>)[verb];
  if (!spec) {
    return {
      ok: false,
      message: `text-protocol: "${verb}" has no parameterized form -- refusing rather than concatenating a value onto an unrecognised verb`,
    };
  }
  if (!isSafeIntegerNumber(value) || value < spec.min || value > spec.max) {
    return {
      ok: false,
      message: `text-protocol: "${verb}" requires an integer between ${spec.min} and ${spec.max} (got ${JSON.stringify(value)})`,
    };
  }
  return { ok: true, command: spec.render(value) };
}

/** Strict decimal-digits-only match for a "count" parameter's candidate
 * text -- never Number()'s own permissive parsing (which accepts leading/
 * trailing whitespace, a leading "+", scientific notation, etc.), because
 * the ROUND TRIP below depends on rejecting anything the renderer itself
 * would never have produced. */
function parseCountParamText(text: string): number | null {
  if (!/^[0-9]+$/.test(text)) return null;
  const n = Number(text);
  return Number.isSafeInteger(n) ? n : null;
}

/** Strict `$` plus one-or-more hex-digit match for an "address" parameter's
 * candidate text. Case-insensitive on input (parseInt handles that), but
 * the round trip below still rejects an uppercase-hex rendering, because
 * the RE-RENDER is always lowercase and compared with strict equality. */
function parseAddressParamText(text: string): number | null {
  const match = /^\$([0-9A-Fa-f]+)$/.exec(text);
  if (!match) return null;
  const n = parseInt(match[1]!, 16);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * True when `cmd` is byte-identical to what verb's own renderer produces
 * for the value `cmd` claims to carry (D-42-1). Implemented by extracting
 * the candidate parameter text after the verb and its single separating
 * space, parsing it back to a number under the spec's own kind, re-
 * rendering through the same renderer, and comparing the result to `cmd`
 * with strict equality. This round trip -- never a hand-written pattern --
 * is what makes the accepted set exactly the canonical forms and rejects a
 * doubled space, a trailing space, a leading zero, an uppercase rendering
 * and an appended second parameter, without any of those needing to be
 * enumerated individually.
 */
export function isDialableTextCommandForVerb(verb: string, cmd: string): boolean {
  const spec = (TEXT_COMMAND_PARAM_SPECS as Record<string, TextCommandParamSpec | undefined>)[verb];
  if (!spec) return false;
  const prefix = `${verb} `;
  if (!cmd.startsWith(prefix)) return false;
  const paramText = cmd.slice(prefix.length);
  const parsed = spec.kind === "address" ? parseAddressParamText(paramText) : parseCountParamText(paramText);
  if (parsed === null || parsed < spec.min || parsed > spec.max) return false;
  return spec.render(parsed) === cmd;
}

/** The ONE place a string is checked against the dialable command set --
 * either an exact TEXT_COMMAND_ALLOWLIST literal, or a spec verb's own
 * canonical parameterized rendering (D-42-1). A plain boolean, not a type
 * predicate over TextCommand: the dialable set is now larger than that
 * eight-member union, since a parameterized command is a distinct runtime
 * string TextCommand's own literal union does not (and should not) name. */
export function isAllowlistedTextCommand(cmd: string): boolean {
  if ((TEXT_COMMAND_ALLOWLIST as readonly string[]).includes(cmd)) return true;
  for (const verb of Object.keys(TEXT_COMMAND_PARAM_SPECS)) {
    if (cmd.startsWith(`${verb} `) && isDialableTextCommandForVerb(verb, cmd)) return true;
  }
  return false;
}

/** Any carriage return, line feed, or other C0 control character. Defense in
 * depth: every TEXT_COMMAND_ALLOWLIST entry above is already a fixed literal
 * with none of these, so this can never actually fire against a bare
 * allowlisted command -- but as of D-42-1 (plan 42-04) isAllowlistedTextCommand()
 * also accepts a RENDERED parameterized command, so this check is no longer
 * merely hypothetical defense in depth for that path: a bug in a spec's
 * render() function, or in isDialableTextCommandForVerb()'s own round trip,
 * is now a real way a control character could reach this far, and this
 * check is what still stops it before a single byte is written. It also
 * guards any future allowlist entry the same way it always did. (canon-
 * referral breadcrumb: generic command injection is `/gsd-secure-phase`
 * canon, not re-litigated here). */
const FORBIDDEN_COMMAND_CHARS_RE = /[\r\n\x00-\x1f]/;

/**
 * Thrown when a text-monitor response cannot be honestly framed -- an
 * accumulated buffer that exceeded TEXT_MAX_BUFFERED_LEN with no prompt in
 * sight (Task 2 enforces this; the type ships now so Task 2 needs no new
 * export). Never thrown for a byte-count or timeout reason alone; always
 * names what was actually observed. A subclass of ViceError, not a bare
 * Error, so callers already switching on ViceError's shape keep working.
 */
export interface TextFramingErrorOptions {
  observedBytes?: number;
  outstandingCommand?: string | null;
}

export class TextFramingError extends ViceError {
  observedBytes?: number;
  outstandingCommand?: string | null;

  constructor(message: string, { observedBytes, outstandingCommand }: TextFramingErrorOptions = {}) {
    super(message);
    this.name = "TextFramingError";
    this.observedBytes = observedBytes;
    this.outstandingCommand = outstandingCommand ?? null;
  }
}

// ---------------------------------------------------------------------------
// Accumulation cap and quiescence window (constants ship now; Task 2 wires
// enforcement of both into TextMonitorClient's data handler).
// ---------------------------------------------------------------------------

/**
 * Upper bound on accumulated-but-not-yet-framed bytes for a single
 * outstanding command. Re-derived from real captured text-monitor output
 * rather than copied from stock-protocol.ts's MAX_BUFFERED_LEN, which bounds
 * a DIFFERENT wire (length-prefixed binary frames) with a different worst
 * case: the largest real fixture committed under fixtures/textmon/
 * (`access-map-stock.txt`, `memmapshow`'s own output) is ~1.62 MiB. 4 MiB
 * gives generous headroom above that measured ceiling while still refusing
 * genuinely unbounded accumulation (the DoS shape this cap exists to bound)
 * -- see text-protocol.test.ts's own assertion (Task 2) that this constant
 * is strictly greater than the largest fixture found on disk, so it can
 * never be tightened below real observed output without going red.
 */
export const TEXT_MAX_BUFFERED_LEN = 4 * 1024 * 1024;

/**
 * How long a buffer must stay silent, after a tail match against PROMPT_RE,
 * before that match is accepted as the real terminator rather than
 * prompt-shaped text occurring mid-stream (the second planted control this
 * phase's criterion names, wired in Task 2). VICE writes the real prompt as
 * the very last thing it sends for a completed command, so a genuine
 * terminator is never immediately followed by more command-output bytes --
 * 50ms is comfortably above ordinary same-host loopback latency while
 * staying well under the per-command cost every caller of this class
 * already accepts. Overridable via VICE_TEXT_QUIESCENCE_MS for a slower host
 * or a deliberately stressed test. Residual risk, stated rather than
 * hidden: a response written in bursts with wire-level backpressure longer
 * than this window would be accepted early, and no measurement on file
 * covers inter-chunk timing on a response near TEXT_MAX_BUFFERED_LEN's own
 * ceiling.
 */
export const TEXT_QUIESCENCE_MS: number = (() => {
  const raw = process.env.VICE_TEXT_QUIESCENCE_MS;
  if (raw === undefined || raw === "") return 50;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : 50;
})();

/** Byte-safe tail scan for the prompt terminator. Deliberately decodes only a
 * short, fixed-size tail window through `latin1` (a 1-byte-to-1-code-unit
 * mapping that never throws and never depends on where a multi-byte UTF-8
 * sequence happens to be split) -- the prompt itself is pure ASCII, so this
 * can never miss a real terminator and can never be confused by a UTF-8
 * continuation byte living in the tail window. The AUTHORITATIVE decode of
 * the full payload still happens exactly once, with `utf8`, on the complete
 * assembled buffer, after a match is accepted as final -- see
 * #finishPending() below. */
function bufferEndsWithPrompt(buf: Buffer): boolean {
  const windowLen = Math.min(buf.length, 32);
  const tail = buf.subarray(buf.length - windowLen).toString("latin1");
  return PROMPT_RE.test(tail);
}

// ---------------------------------------------------------------------------
// withTextChannelLock() -- the text channel's ONE acquire seam for
// channel-lock.ts's mutex (plan 41-02, CHAN-04, D-07).
// ---------------------------------------------------------------------------

export interface WithTextChannelLockOptions {
  /** Test-only override of channel-lock.ts's acquire bound. Production call
   * sites never set this -- they always take channel-lock.ts's own
   * CHANNEL_LOCK_ACQUIRE_TIMEOUT_MS default. */
  timeoutMs?: number;
}

/**
 * The text channel's ONE acquire seam for channel-lock.ts's mutex. Acquires
 * `channel: "text"`, runs `fn`, and releases in a `finally` so a throwing
 * `fn` still releases -- matching stock-dispatch.ts's `withChannelLockHeld()`
 * on the binary side exactly, and satisfying D-07's requirement that
 * `text-protocol.ts` and `stock-dispatch.ts` both import the one primitive.
 *
 * Every real text-monitor command MUST be issued from inside this function:
 * `command()` below refuses, by name, whenever channel-lock.ts's mutex is
 * not currently held by the text channel -- so a call site that forgets to
 * acquire is refused rather than silently bypassing the authority (D-07's
 * "cannot be silently bypassed" requirement).
 */
export async function withTextChannelLock<T>(operation: string, fn: () => Promise<T>, opts: WithTextChannelLockOptions = {}): Promise<T> {
  const handle = await acquireChannelLock({ channel: "text", operation, timeoutMs: opts.timeoutMs });
  try {
    return await fn();
  } finally {
    handle.release();
  }
}

interface PendingTextCommand {
  resolve: (value: string) => void;
  reject: (reason: unknown) => void;
  // D-42-1 (plan 42-04): a dialable command is no longer only ever a
  // TextCommand literal -- isAllowlistedTextCommand() also accepts a
  // spec verb's own canonical parameterized rendering, a distinct runtime
  // string TextCommand's closed union does not (and should not) name.
  command: string;
}

export interface TextMonitorClientOptions {
  /** Test-only override of the quiescence window, taking precedence over
   * both the module-level TEXT_QUIESCENCE_MS constant and its own
   * VICE_TEXT_QUIESCENCE_MS env override -- lets a test exercise the
   * mid-stream-prompt case (Control 2) without waiting out a real-world
   * window or mutating process.env. */
  quiescenceMs?: number;
}

export interface TextConnectSocketOptions {
  timeoutMs?: number;
}

export interface TextCommandOptions {
  timeoutMs?: number;
}

// ---------------------------------------------------------------------------
// TextMonitorClient
// ---------------------------------------------------------------------------

/**
 * Raw text-monitor socket client: connect/disconnect and a single
 * outstanding command() at a time, framed by PROMPT_RE plus a quiescence
 * window -- accumulate raw Buffers (never decode per chunk), and accept a
 * tail match against PROMPT_RE as final only once no further bytes arrive
 * within the quiescence window (see TEXT_QUIESCENCE_MS's own header comment
 * for why this is not optional even for the plain happy path). Task 2 adds
 * the passive banner drain (D-13(b)) and the accumulation cap on top of this
 * shape without changing it structurally.
 *
 * D-13(a): connect() never reads or waits for a connect banner -- stock's
 * text monitor sends ZERO bytes on connect, so there is nothing to frame or
 * race. Waiting would hang for the full connect timeout on every single
 * connection.
 */
export class TextMonitorClient extends EventEmitter {
  #socket: net.Socket | null = null;
  #buffer: Buffer = Buffer.alloc(0);
  #port: number | null = null;
  #closed = false;
  #pending: PendingTextCommand | null = null;
  #quiescenceTimer: NodeJS.Timeout | null = null;
  #quiescenceMs: number;
  /** Task 2 (D-13(b)): incremented every time a passively-arriving,
   * no-command-outstanding banner is drained -- never used to resolve a
   * later command's promise, only counted and emitted on `banner`. */
  bannerFramesDrained = 0;
  #onDataBound = (chunk: Buffer) => this.#onData(chunk);
  #onCloseBound = () => this.#onClose();
  #onErrorBound = (err: Error) => this.#onError(err);

  constructor({ quiescenceMs }: TextMonitorClientOptions = {}) {
    super();
    this.#quiescenceMs = quiescenceMs ?? TEXT_QUIESCENCE_MS;
  }

  get connected(): boolean {
    return this.#socket != null && !this.#socket.destroyed;
  }

  /** Whether a command is currently outstanding on this connection -- exposed
   * so text-connect.ts and any future channel-lock integration can observe
   * idle-vs-busy state without reaching into a private field. */
  get hasOutstandingCommand(): boolean {
    return this.#pending !== null;
  }

  connect(host: string, port: number, { timeoutMs = 5000 }: TextConnectSocketOptions = {}): Promise<void> {
    // Mirrors stock-protocol.ts's WR-13(b) fix: refuse to connect over a
    // socket that is still live, rather than silently overwriting #socket
    // and leaking the previous socket and its listeners. A reconnect must go
    // through disconnect() first.
    if (this.#socket != null && !this.#socket.destroyed) {
      return Promise.reject(
        new ViceError(
          `connect to ${host}:${port} refused: this client already holds a live socket to port ${this.#port} -- ` +
            `call disconnect() first (stock VICE services exactly one text-monitor client)`,
        ),
      );
    }

    return new Promise((resolve, reject) => {
      const socket = net.createConnection({ host, port });

      const onConnect = () => {
        clearTimeout(timer);
        socket.removeListener("error", onConnectError);
        this.#socket = socket;
        this.#buffer = Buffer.alloc(0);
        this.#port = port;
        this.#closed = false;
        socket.on("data", this.#onDataBound);
        socket.on("close", this.#onCloseBound);
        socket.on("error", this.#onErrorBound);
        // D-13(a): resolve immediately -- never read or wait for a connect
        // banner. Stock's text monitor sends zero bytes on connect.
        resolve();
      };
      const onConnectError = (err: Error) => {
        clearTimeout(timer);
        reject(err);
      };
      const timer = setTimeout(() => {
        socket.removeListener("connect", onConnect);
        socket.removeListener("error", onConnectError);
        // Mirrors stock-protocol.ts's WR-13(a) fix: destroy() can itself
        // deliver an 'error' for this socket. Both prior listeners are
        // already removed, so a no-op listener is attached for the socket's
        // remaining lifetime -- this socket is abandoned, nothing left to
        // report, but the event still needs somewhere to land.
        socket.on("error", () => {
          /* abandoned socket -- swallow */
        });
        socket.destroy();
        reject(new ViceError(`connect to ${host}:${port} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      socket.once("connect", onConnect);
      socket.once("error", onConnectError);
    });
  }

  /**
   * Issue exactly one text-monitor command and resolve with its complete,
   * prompt-framed response (the prompt itself stripped). Refuses any
   * argument that is not in TEXT_COMMAND_ALLOWLIST, and refuses any argument
   * containing a CR, LF, or C0 control character, BY NAME, before a single
   * byte is written (D-01). Only one command may be outstanding at a time --
   * the text protocol is not multiplexed.
   */
  command(cmd: string, _opts: TextCommandOptions = {}): Promise<string> {
    // Checked BEFORE the allowlist membership check, deliberately: every
    // TEXT_COMMAND_ALLOWLIST entry is already clean of these characters, so
    // ordering it first makes this refusal reachable and testable in its own
    // right (a string carrying an embedded control character is refused
    // BY THAT REASON, not merely folded into the generic non-allowlisted
    // refusal) while changing nothing about which strings are ultimately
    // accepted.
    if (FORBIDDEN_COMMAND_CHARS_RE.test(cmd)) {
      return Promise.reject(
        new ViceError(`text-protocol: refusing command ${JSON.stringify(cmd)} containing a CR, LF, or C0 control character`),
      );
    }
    if (!isAllowlistedTextCommand(cmd)) {
      return Promise.reject(
        new ViceError(
          `text-protocol: refusing non-allowlisted command ${JSON.stringify(cmd)} -- every outbound text-monitor ` +
            `command must come from TEXT_COMMAND_ALLOWLIST (D-01)`,
        ),
      );
    }
    // D-07 (plan 41-02, CHAN-04): a text command issued without the text
    // channel holding channel-lock.ts's mutex is a defect, not a variant --
    // refusing it BY NAME is what keeps the serialization authority from
    // being silently bypassable by a call site that forgot to route through
    // withTextChannelLock(). Checked before the connection-state checks
    // below: holding halt authority is a prerequisite for issuing ANY
    // command, independent of whether a socket happens to be connected.
    const lockHolder = currentChannelLockHolder();
    if (lockHolder === null || lockHolder.channel !== "text") {
      return Promise.reject(
        new ViceError(
          `text-protocol: refusing command ${JSON.stringify(cmd)} -- the text channel does not currently hold ` +
            `channel-lock.ts's halt authority; every text-monitor command must be issued from inside ` +
            `withTextChannelLock()`,
        ),
      );
    }
    if (this.#closed || !this.connected || !this.#socket) {
      return Promise.reject(new ViceError("text-protocol: cannot send, the text-monitor connection is not open"));
    }
    if (this.#pending) {
      return Promise.reject(new ViceError("text-protocol: a command is already outstanding on this connection"));
    }

    const socket = this.#socket;
    return new Promise<string>((resolve, reject) => {
      this.#pending = { resolve, reject, command: cmd };
      socket.write(`${cmd}\n`);
    });
  }

  /** Tears down the socket and removes the bound listeners. Any outstanding
   * command is rejected rather than left to hang. A second disconnect() on
   * an already-torn-down client is a harmless no-op. */
  disconnect(): Promise<void> {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    if (pending) {
      pending.reject(new ViceError("text-protocol: connection closed while a command was outstanding"));
    }

    const socket = this.#socket;
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.#closed = true;
    if (!socket) {
      return Promise.resolve();
    }
    socket.removeListener("data", this.#onDataBound);
    socket.removeListener("close", this.#onCloseBound);
    socket.removeListener("error", this.#onErrorBound);
    return new Promise((resolve) => {
      socket.once("close", () => resolve());
      socket.destroy();
    });
  }

  #onData(chunk: Buffer): void {
    // Concat raw Buffers, never decode per chunk -- this alone is what
    // survives a prompt split across two socket chunks (Control 1):
    // matching happens against the TAIL of the accumulated buffer, which is
    // agnostic to where the chunk boundary fell.
    this.#buffer = Buffer.concat([this.#buffer, chunk]);

    if (this.#quiescenceTimer) {
      // More bytes arrived before the quiescence window elapsed for a
      // PREVIOUS tail match -- that match was not really final (Control 2's
      // own shape: prompt-shaped text mid-stream, or -- as measured live --
      // a residual leading prompt arriving as its own chunk ahead of the
      // real output). Cancel the timer and re-evaluate from scratch below
      // against the now-larger buffer.
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }

    if (!this.#pending) {
      // D-13(b): a passively-arriving banner (e.g. a binary-owned
      // checkpoint-hit notification pushed to this same text console) with
      // no command outstanding. WR-01: this path must apply the SAME
      // quiescence discipline as the pending-command branch below --
      // prompt-shaped text can occur mid-banner exactly as it can
      // mid-command-response (Control 2's own shape), and draining
      // immediately on the first tail match risks splitting one logical
      // banner into two events, or -- worse -- leaking a banner's true
      // trailing bytes into an unrelated command's response buffer if a
      // command is issued in the narrow window between the false match and
      // the banner's real tail arriving. Arm the quiescence window and only
      // drain once a tail match SURVIVES it with no further bytes arriving.
      if (bufferEndsWithPrompt(this.#buffer)) {
        this.#quiescenceTimer = setTimeout(() => {
          this.#quiescenceTimer = null;
          this.#finishBanner();
        }, this.#quiescenceMs);
        if (typeof this.#quiescenceTimer.unref === "function") this.#quiescenceTimer.unref();
        return;
      }
      this.#checkCap();
      return;
    }

    if (bufferEndsWithPrompt(this.#buffer)) {
      // A tail match. Arm the quiescence window rather than resolving
      // immediately: only a match that SURVIVES the window (no further
      // bytes arrive) is accepted as the genuine terminator.
      this.#quiescenceTimer = setTimeout(() => {
        this.#quiescenceTimer = null;
        this.#finishPending();
      }, this.#quiescenceMs);
      if (typeof this.#quiescenceTimer.unref === "function") this.#quiescenceTimer.unref();
      return;
    }

    this.#checkCap();
  }

  /** Finalizes the currently outstanding command against the buffer accrued
   * so far: decodes the ENTIRE assembled buffer with `utf8` exactly once
   * (never per chunk -- the encoding-split control depends on this), strips
   * the trailing prompt, and resolves. */
  #finishPending(): void {
    const pending = this.#pending;
    if (!pending) return;
    this.#pending = null;
    const raw = this.#buffer;
    this.#buffer = Buffer.alloc(0);
    const decoded = raw.toString("utf8");
    const payload = decoded.replace(PROMPT_RE, "");
    pending.resolve(payload);
  }

  /** Finalizes a passively-drained banner (D-13(b)) against the buffer
   * accrued so far, mirroring #finishPending()'s discipline for the
   * pending-command path: only invoked after a tail match has survived the
   * quiescence window with no further bytes arriving in between (WR-01) --
   * never on the first tail match alone. Never resolves or touches
   * #pending; a banner is passive output, not a command reply. */
  #finishBanner(): void {
    const raw = this.#buffer;
    this.#buffer = Buffer.alloc(0);
    this.bannerFramesDrained += 1;
    this.emit("banner", raw.toString("utf8"));
  }

  /** Enforces TEXT_MAX_BUFFERED_LEN against accumulated-but-not-yet-framed
   * bytes, whether a command is outstanding or a banner is being drained.
   * Exceeding the cap with no prompt in sight is a refusal (TextFramingError
   * naming the byte count and the outstanding command, if any) -- never a
   * truncated payload handed back as if it were complete. */
  #checkCap(): void {
    if (this.#buffer.length <= TEXT_MAX_BUFFERED_LEN) return;
    const observedBytes = this.#buffer.length;
    const outstandingCommand = this.#pending?.command ?? null;
    this.#buffer = Buffer.alloc(0);
    const err = new TextFramingError(
      `text-protocol: accumulated buffer exceeded TEXT_MAX_BUFFERED_LEN (${TEXT_MAX_BUFFERED_LEN}) with no prompt in sight` +
        (outstandingCommand ? ` while "${outstandingCommand}" was outstanding` : " while draining a banner"),
      { observedBytes, outstandingCommand },
    );
    const pending = this.#pending;
    this.#pending = null;
    if (pending) {
      pending.reject(err);
    } else {
      // IN-01: no command is outstanding when this fires, so there is no
      // promise to reject -- "desync" is the only signal. This deliberately
      // mirrors stock-protocol.ts's own "desync" convention for its binary
      // ViceMonitorClient: neither of this class's two current production
      // consumers (text-connect.ts, text-tools.ts) attach a listener, exactly
      // like the binary client's own production call sites today. That is a
      // known diagnosability gap (a genuinely desynced text channel produces
      // no operator-visible signal until the next real command is issued
      // against it), not an oversight -- left unconsumed BY DESIGN, pending a
      // future plan that exposes the banner/desync stream to a caller. A
      // fix that wires a listener onto only this class, asymmetric with the
      // binary client's identical convention, is explicitly NOT wanted here.
      this.emit("desync", err);
    }
  }

  #onClose(): void {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    this.#socket = null;
    this.#buffer = Buffer.alloc(0);
    this.#closed = true;
    if (pending) {
      pending.reject(new ViceError("text-protocol: connection closed while a command was outstanding"));
    }
    this.emit("close");
  }

  #onError(err: Error): void {
    if (this.#quiescenceTimer) {
      clearTimeout(this.#quiescenceTimer);
      this.#quiescenceTimer = null;
    }
    const pending = this.#pending;
    this.#pending = null;
    this.#closed = true;
    if (pending) {
      pending.reject(err);
    }
    this.emit("transport-error", err);
  }
}
