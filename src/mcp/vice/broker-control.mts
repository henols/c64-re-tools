// broker-control.mts
//
// The framing, the token gate, acquire/release, status,
// host_state, the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's low-level bind primitive. Also adds
// `monitor_claim`/`monitor_release`: exclusive ownership of an instance's
// raw binmon socket, enforced here rather than left to a client-side
// heuristic -- stock VICE services exactly one binmon client, and a second
// connect() produces no reply and no EOF, so the refusal must happen
// BEFORE any second dial is ever attempted. The subsystem's FIRST network
// listener: a TCP control plane replacing the bash broker's
// requests/grants/denials/leases directory tree entirely. One JSON object
// per line; the connection open IS the claim, connection close IS the
// release (T-01.6.2-01 through -09).
//
// Wire format confirmed at a blocking checkpoint decision (2026-08-03,
// `as-specified`, no amendments), which accepted some residual risk and
// considered and rejected a unix-domain-socket alternative. Auth: `hello`
// (plan 62-01) answers UNCONDITIONALLY, to any caller that can reach a
// bound address, with no credential of any kind -- `attach` and `transfer`
// (Phase 64 gap G-64-1, owner decision 5) now answer
// BEFORE the token gate too, by their broker-minted per-claim/per-stage
// handle alone.
// This drops the "every op requires the token" absolute the very first
// version of this comment stated, but does not drop the credential
// itself: monitor_claim (which mints an attach handle) and stage_file
// (which mints a transfer handle) are BOTH still token-gated, and every
// other op -- acquire, release, status, host_state,
// monitor_claim, monitor_release, host_tool, operation -- still gates on
// the SAME per-boot capability token compared constant-time, checked
// BEFORE any state read or write, until Phase 66 (RM-02) deletes
// broker.json, the token's only distribution channel. That is what makes
// the bind set below the FIRST line of defence now (v2.0.0) for attach and
// transfer as well, not merely a convenience narrowing sitting on top of a
// credential every caller already needs: a wildcard bind would let any
// network peer complete a handshake and learn this broker's protocol and
// version for free, and now attach/transfer a session for free too. Bind:
// loopback plus every enumerated bridge gateway address from an
// interface-name allowlist (BRIDGE_INTERFACE_ALLOWLIST below), enumerated
// exactly once at startup, never the wildcard address and never a
// hardcoded gateway literal -- host.docker.internal resolves to one of
// those enumerated bridge addresses, so binding loopback alone would leave
// a container structurally unable to reach this listener, which is why
// the bridge set is enumerated rather than dropped outright. Port: 19510
// default via VICE_BROKER_CONTROL_PORT.
import { createServer, type Server, type Socket } from "node:net";
import { networkInterfaces as osNetworkInterfaces, type NetworkInterfaceInfo } from "node:os";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// TYPE-ONLY import -- the SAME discipline broker-launch.mts and
// broker-state.mts already use for each other: fully erased under this
// project's verbatimModuleSyntax/isolatedModules settings,
// so the ".mjs" specifier never becomes a real runtime resolution and this
// module stays importable unbuilt. `LaunchProfile` is IMPORTED, never
// redeclared -- broker-launch.mts is the one definition of the profile shape,
// and a second local copy here is exactly how the wire boundary and the argv
// builder would drift apart.
import type { LaunchProfile } from "./broker-launch.mjs";
// TYPE-ONLY import -- same discipline as the LaunchProfile import directly
// above: fully erased under this project's
// verbatimModuleSyntax/isolatedModules settings, so this module stays
// importable unbuilt. MonitorChannel is the two-value channel contract
// ("binary" | "text"); broker-state.mts is its one canonical declaration for
// every HOST-BOUND module, mirrored (not imported, for the container side)
// by channel-lock.ts and vice-broker-client.ts.
import type { MonitorChannel } from "./broker-state.mjs";
// TYPE-ONLY import, same discipline as the two imports directly above --
// backend-detect.mts is the type's one home (narrowed to a single literal
// now that the fork backend has been removed).
import type { ViceBackend } from "./backend-detect.mjs";

// STILL ONE OP PER SUBSYSTEM. `host_tool` is the EIGHTH member -- and the
// whole host-tool subsystem, not one member per tool. Its per-tool typing
// (which tool ids exist, which argument keys each accepts) lives in
// host-tool.mts's own allowlist, never in this union, and this union is
// never widened again per-tool: a second host tool (dxa, Ghidra, c1541,
// petcat, cartconv, ...) is a new entry in host-tool.mts's HOST_TOOL_IDS,
// not a ninth ControlRequestKind member. This mirrors the same reasoning
// one op-family over: adding a ninth kind per tool would mean a new
// dispatch path to keep in sync with every other tool's, forever.
// `hello` joins as the NINTH member, plan 62-01 (ENDPOINT-03/D-06). It is
// NOT one more arm of the post-token-gate chain `host_tool`'s own comment
// above describes -- it is one of the ops this listener answers BEFORE
// `tokensMatch()` runs at all, because the handshake by design carries no
// credential. See attachControlProtocol()'s handleLine() for the dispatch
// site and its own comment on why that placement is load-bearing.
// `attach` joins as the TENTH member, Phase 63 (SESS-02) -- ORIGINALLY it
// sat AFTER the token gate, in the same post-gate chain as every other
// target-naming op; Phase 64 gap G-64-1 (owner decision 5)
// REVERSED that placement, moving it BEFORE the gate, dispatched by its
// broker-minted per-claim handle alone -- see this file's own header
// "Auth:" paragraph. Sent on a
// connection dedicated solely to becoming a relay splice: this listener
// answers it once, then that socket's own line reader stops running (see
// the relayMode flag inside attachControlProtocol()) and every further
// byte belongs to broker-relay.mts's spliceRelay(), never to this
// JSON-line dispatcher again.
// `operation` joins as the ELEVENTH member, Phase 63 (SESS-05) -- gated on
// the SAME ownsTarget() predicate `monitor_claim`/`monitor_release`
// already share (never a bare target_id), and dispatched on the connection's
// ordinary line reader like every op except `attach`/`transfer` -- it never
// touches relayMode. Declares (or, with a `null` name, clears) the operation
// the declaring connection's own grant currently has in flight, so a
// broker-side incident record (broker-incident.mts, a later plan) can name
// what was running when a relay died. Written WITHOUT being awaited by its
// caller (stock-session.ts/text-tools.ts) -- see
// StartControlListenerOptions' onOperation comment for why that is safe.
// `stage_file` joins as the TWELFTH member, Phase 64 (XFER-04, D-01) --
// gated on the SAME ownsTarget() predicate `monitor_claim`/`monitor_release`/
// `operation` already shares (never a bare target_id), and
// dispatched on the connection's ordinary line reader -- it never touches
// relayMode. Mints an opaque, broker-chosen handle and a broker-side path
// the emulator itself must open (`emulator_filename`); the caller never
// supplies either. Its callback (onStageFile) is OPTIONAL on
// StartControlListenerOptions -- see that field's own comment for why.
// `transfer` joins as the THIRTEENTH member, Phase 64 (XFER-04, D-01/D-02,
// T-63-01 precedent) -- ORIGINALLY sat AFTER the token gate, like every op
// except `hello`; REVERSED by gap G-64-1 the SAME way `attach` above was,
// now dispatched BEFORE the gate, beside `attach`. Deliberately NOT gated
// by ownsTarget(): sent on a connection dedicated solely to becoming a
// payload connection, so the per-stage `handle` presented on the wire is
// the ONLY authority this op can check, exactly the reasoning `attach`'s
// own comment above already states. This listener answers it once, flips
// this socket out of line-reading mode (the SAME relayMode flag `attach`
// flips) BEFORE its callback runs, and hands the connection to
// onFileTransfer -- which, on success, owns every further reply line and
// every payload byte; this listener writes nothing more on that path. Its
// callback is ALSO optional -- see onFileTransfer's
// own comment.
// `host_tool_stage`/`host_tool_run` join as the FOURTEENTH/FIFTEENTH members,
// Phase 65 (SEAM-01, D-03/D-09) -- dispatched BEFORE the token gate, beside
// `attach`/`transfer`, by the SAME "this connection is a brand-new socket,
// never the one that already proved ownership some other way" reasoning
// those two arms' own comments state: a skill call holds no acquire-level
// grant at all (RESEARCH.md Critical Finding 2), so there is no `target_id`
// this pair could ever be gated on. `host_tool_stage` mints a brand-new
// request key and BINDS it to the connection that sent it (a per-connection
// variable, mirroring `requestIdForThisConnection`'s own shape); every
// subsequent `host_tool_run` on that SAME connection is refused `denied`
// unless it presents that exact key back (T-65-04) -- a key minted on one
// connection is never honoured on another. `host_tool_run` reuses the
// bound key; it carries no `target_id` and no token of its own. Neither
// touches `relayMode` -- both answer on this listener's own ordinary line
// reader, never handing the connection to a splice. The legacy `host_tool`
// literal, below the token gate, is UNTOUCHED by either -- two distinct
// functions, never a shared literal or a mode flag (T-65-05).
export type ControlRequestKind = "acquire" | "release" | "status" | "host_state" | "monitor_claim" | "monitor_release" | "hello" | "attach" | "operation" | "stage_file" | "transfer" | "host_tool_stage" | "host_tool_run";
// `no_free_text_port` joins the vocabulary as its OWN code -- a stock
// acquire that fails only on the SECOND (`-remotemonitor`) allocation is
// reported distinctly from `no_free_port` (which still means the
// FIRST/primary allocation failed, or the fork's single allocation
// failed), so a port-starved host's exact failure cause is legible at the
// control plane, not only in the broker log.
// `emulator_unreachable` joins the vocabulary as its OWN code (G-64-4, plan
// 64-12): a bounded emulator-leg dial that ran out its deadline, or hit a
// non-retryable connect error, WITHOUT being abandoned -- reachable only
// after handleRelayAttach()'s own handle check has already passed, so it
// tells a probing caller nothing usable about handles (T-63-01 unchanged).
// Reused rather than collapsed into `internal`, which means a broker fault
// -- this means the far side (the emulator) is not yet reachable, a
// distinction the tool-facing text (stock-handler.ts's convertHandshakeError())
// depends on to stay off the wedge/hung/unresponsive wording this codebase
// forbids for it.
export type ControlErrorCode =
  | "unauthorized"
  | "bad_request"
  | "denied"
  | "no_free_port"
  | "no_free_text_port"
  | "at_capacity"
  | "internal"
  | "monitor_owned"
  | "emulator_unreachable";

export interface ControlRequest {
  op: string;
  id?: string;
  token?: string;
  target_id?: string;
  /** `hello`'s own caller-supplied connection label -- open-ended, not a
   * closed union (see HELLO_PROTOCOL_MAGIC's own comment for why). Absent
   * or empty defaults to `"control"` at the dispatch site. */
  tag?: string;
  /** `acquire`'s own caller-declared session label (Phase 63, SESS-06) --
   * `unknown` on the wire like every other request field; run through
   * sanitiseSessionLabel() at the `acquire` dispatch arm before it is ever
   * passed to onAcquire() or recorded on a grant. Optional: a bare test
   * client or a future non-agent caller that omits this is not refused. */
  label?: unknown;
  [key: string]: unknown;
}

export interface AcquireGrant {
  port: number;
  url: string;
  epochFile: string;
  supervisorDir: string;
  /** The broker-allocated port stock's `-remotemonitor` text monitor binds,
   * mandatory on every stock launch. Optional here only for the fork case
   * -- a stock instance record always carries it, because a stock launch
   * that cannot bind one now fails the whole acquire
   * (broker-launch.mts's acquirePortAndLaunch()) rather than ever producing
   * a grant without it. `handleAcquire()` omits this key entirely when the
   * record has none, the same key-omitted-when-undefined idiom
   * `spawnAndRecordInstance()` already uses for this same field. */
  remoteMonitorPort?: number;
}

/** Discriminated acquire outcome (plan 05): the tracer's onAcquire used to
 * answer `AcquireGrant | null`, collapsing every failure into one
 * `internal` error. Criterion H's error vocabulary needs to tell
 * `no_free_port` (the port allocator is exhausted), `at_capacity` (the
 * instance ceiling is reached) and `launch_in_flight` (a launch is already
 * under way -- NOT a failure the caller should see; the control listener
 * queues the request instead, see enqueueAcquire()/drainPendingAcquires()
 * below) apart from a genuine `internal` fault. */
export type AcquireOutcome =
  | { ok: true; grant: AcquireGrant }
  // `no_free_text_port` -- the stock-only failure of the SECOND
  // (`-remotemonitor`) allocation, distinct from `no_free_port` (the
  // primary/only allocation failing). See ControlErrorCode's own comment
  // for why this is a separate code rather than collapsing into the
  // existing `no_free_port` reason.
  | { ok: false; reason: "no_free_port" | "no_free_text_port" | "at_capacity" | "launch_in_flight" | "internal" };

export interface StatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
  /** Whether this instance currently has a claimed monitor client on ANY
   * channel (InstanceRecord.monitorClients has at least one entry),
   * computed on demand from the SAME in-memory map every other status field
   * reads. Byte-identical wire shape since this field was introduced --
   * later promoted to a per-channel holder map, this field's own MEANING
   * is now stated explicitly rather than left inferable: "at least one
   * channel is claimed", never "the binary channel is claimed" alone. */
  hasMonitorClient: boolean;
  /** The owning grant's client-declared session label (Phase 63, SESS-06),
   * verbatim from GrantRecord.sessionLabel -- already sanitised before it
   * was ever recorded, so this field never needs a second pass. `null` both
   * when no grant currently owns this instance and when the owning grant
   * declared none. "Owning" is resolved by vice-broker.mts's status
   * projection using the SAME identity comparison handleRelease() already
   * uses (grant.port matches this instance's port AND grant.pid matches
   * this instance's CURRENT pid) -- an instance whose port occupant has
   * been replaced by a different process than the grant was issued for
   * reports no identity at all, never the stale grant's. THIS IS A DISPLAY
   * VALUE ONLY (see GrantRecord.sessionLabel's own header comment) -- never
   * an authorisation input. */
  sessionLabel: string | null;
  /** The owning grant's own id, resolved and absent under the exact same
   * rule as sessionLabel above -- lets a reader pair a status entry with a
   * specific grant rather than merely a label string (which may collide,
   * be blank, or be omitted). */
  grantId: string | null;
  /** The owning grant's own in-flight operation (GrantRecord.operation,
   * broker-state.mts), verbatim -- `null` both when no grant owns this
   * instance and when the owning grant has nothing currently declared. */
  operation: { name: string; declaredAt: number } | null;
}

/** The claim conflict's refusal payload -- names the holding grant, its
 * claim timestamp and which channel is contended, so a refusal is reported
 * as an ownership conflict, never as a wedged or unresponsive emulator.
 * `pid` mirrors GrantRecord.pid's own convention -- broker-state.mts's
 * InstanceRecord.monitorClients' own header comment explains why. */
export interface MonitorHolder {
  grantId: string;
  claimedAt: number;
  pid: number | null;
  channel: MonitorChannel;
}

/** Discriminated outcome for `monitor_claim`: resolved by vice-broker.mts's
 * own handleMonitorClaim(), which is the SOLE writer of an entry in
 * InstanceRecord.monitorClients on a successful claim. `monitor_owned` is a
 * distinct outcome from every other error -- it carries the holder's own
 * identity, because a refusal answered "someone else has it, and here is
 * who" is what makes this an ownership conflict rather than an unexplained
 * hang. */
/** Widened (Phase 63, SESS-02): a successful claim now carries the per-claim
 * `handle` vice-broker.mts's handleMonitorClaim() minted (or, on an
 * idempotent repeat, the SAME handle it minted the first time) -- the ONLY
 * authority an `attach` op on a SEPARATE relay connection can ever present,
 * since that connection holds no grant of its own. */
export type MonitorClaimOutcome =
  | { ok: true; handle: string }
  | { ok: false; code: "monitor_owned"; holder: MonitorHolder }
  | { ok: false; code: "bad_request" | "internal" };

/** Discriminated outcome for `attach` (Phase 63, SESS-02; widened by G-64-4,
 * plan 64-12): resolved by vice-broker.mts's own handleRelayAttach(). `denied`
 * covers every authorisation failure -- an unrecognised handle, a handle
 * presented for a channel with no current holder, a channel that is already
 * spliced, or a dial this attach's own wait ABANDONED (the client leg
 * closed, or the claim/instance changed under it while the dial was in
 * flight) -- deliberately collapsed to ONE code rather than several, so a
 * probing caller cannot distinguish "wrong handle" from "already attached"
 * by the code alone (both are refused with the same ownership wording,
 * never an emulator-fault wording -- see T-63-01). `bad_request` is
 * reserved for an unknown target id (the same meaning `monitor_claim`'s own
 * `bad_request` carries). `emulator_unreachable` (G-64-4) is the ONE new
 * member: a dial that ran out its bounded deadline, or hit a non-retryable
 * connect error, WITHOUT being abandoned -- reachable only after the
 * handle check above has already passed, so it tells a probing caller
 * nothing usable about handles (T-63-01 unchanged). `ok: true` now carries
 * a `start` continuation rather than nothing: see onRelayAttach's own
 * comment and vice-broker.mts's handleRelayAttach() header comment for why
 * the splice itself is deferred to this continuation, called only AFTER
 * the `attached` line has been written. `message`, present only on a
 * refusal, is optional wire-facing text (G-64-4's own errno-free refusal
 * text for `emulator_unreachable`); its absence falls back to the
 * pre-existing `attach refused: ${code}` wording, unchanged for every other
 * code. */
export type RelayAttachOutcome =
  | { ok: true; start: () => void }
  | { ok: false; code: "denied" | "bad_request" | "internal" | "emulator_unreachable"; message?: string };

/** Discriminated outcome for `operation` (Phase 63, SESS-05): resolved by
 * vice-broker.mts's own handleOperationNote(). `bad_request` covers the ONE
 * failure that function itself can produce -- `target_id` naming a grant
 * this listener's own ownsTarget() has already proven the CONNECTION holds,
 * but which is no longer present in the broker's own grant map (a
 * should-be-unreachable race, checked defensively rather than assumed). Every
 * OTHER refusal (empty target_id, ownership, an unrecognised channel) is
 * answered by THIS listener, before handleOperationNote() is ever called --
 * see the `operation` dispatch arm below, which mirrors monitor_claim's own
 * dispatch skeleton exactly. */
export type OperationNoteOutcome = { ok: true } | { ok: false; code: "bad_request" };

/** Discriminated outcome for `monitor_release` (plan 05, T-02-01): `denied`
 * is refused WITHOUT clearing the record -- a non-holder cannot release
 * someone else's claim. An already-cleared record (no current holder at
 * all) is tolerated as a success, matching the container-side client's own
 * documented tolerance for releasing twice. */
export type MonitorReleaseOutcome = { ok: true } | { ok: false; code: "denied" | "bad_request" | "internal" };

/** Discriminated outcome for `stage_file` (Phase 64, XFER-04, D-01): resolved
 * by vice-broker.mts's own handleStageFile() (plan 64-03). `ok: true` mints a
 * handle the REQUEST did not supply, and names the broker-side path the
 * EMULATOR itself must open (`emulatorFilename` -- see this plan's
 * wire_vocabulary block for why that is not a D-17 violation: it never
 * reaches a tool result, and the client never opens it). Every failure
 * reuses this file's OWN `ControlErrorCode` vocabulary rather than inventing
 * a stage_file-specific one -- `denied` and the `target_id`/`slot`
 * `bad_request` cases are already answered by THIS listener's own dispatch
 * arm before this callback is ever invoked (see the `stage_file` arm
 * below), so a callback-produced failure here is something the STAGING
 * layer itself refused (e.g. `internal` for a disk write failure). */
export type StageFileOutcome = { ok: true; handle: string; emulatorFilename: string } | { ok: false; code: ControlErrorCode };

/** The `transfer` op's already-narrowed request, handed to `onFileTransfer`
 * (Phase 64, XFER-04, D-02). `byteLength`/`sha256` are present ONLY for
 * `direction: "upload"` -- a download names neither, matching this plan's
 * wire_vocabulary block exactly. THIS listener's own dispatch arm is the
 * ONE narrowing site for every field here (mirrors normaliseLaunchProfile()'s
 * and sanitiseSessionLabel()'s own posture) -- the callback never sees an
 * unnarrowed field. */
export type FileTransferRequest =
  | { direction: "upload"; handle: string; byteLength: number; sha256: string }
  | { direction: "download"; handle: string };

/** Discriminated outcome for `transfer` (Phase 64, XFER-04): `ok: true`
 * means `onFileTransfer` itself has taken over this connection completely --
 * writing every further reply line (`transfer_ready`/`transfer_payload`/
 * `transfer_complete`, per this plan's wire_vocabulary) and streaming every
 * payload byte -- so THIS listener's own dispatch arm writes NOTHING
 * further on success (see the `transfer` arm below). `ok: false` means the
 * callback refused before consuming a single payload byte; `message` is
 * prose a caller can act on, matching this file's own
 * detect-then-refuse-by-name convention. */
export type FileTransferOutcome = { ok: true } | { ok: false; code: ControlErrorCode; message: string };

/** One `host_tool_stage` manifest entry, already narrowed off the wire by
 * THIS listener's own dispatch arm (Phase 65, SEAM-01) -- `tree` is a
 * non-negative integer, `rel` a string, `byteLength` a number; the callback
 * never sees an un-narrowed field. */
export interface HostToolStageFileSpec {
  tree: number;
  rel: string;
  byteLength: number;
}

/** Discriminated outcome for `host_tool_stage` (Phase 65, SEAM-01, D-03):
 * resolved by `vice-broker.mts`'s own `handleHostToolStage()`. `ok: true`
 * mints a request key the REQUEST did not supply, plus one tree handle per
 * distinct tree and one file handle per manifest entry -- both in manifest
 * order. `ok: false` reuses this file's OWN `ControlErrorCode` vocabulary. */
export type HostToolStageOutcome =
  | { ok: true; requestKey: string; treeHandles: string[]; fileHandles: string[] }
  | { ok: false; code: ControlErrorCode; message: string };

// `warmFloor` is DELETED, not merely renamed -- the warm floor itself is
// retired, and a published field whose knob no longer exists is false
// documentation, so it goes rather than reporting a constant.
export interface HostStateFields {
  pid: number;
  startedAt: string;
  nodeVersion: string;
  viceBin: string;
  maxInstances: number;
  basePort: number;
  /** Narrowed from `"fork" | "stock"` to the single literal `ViceBackend`
   * now has. Kept on the wire (rather than deleted outright) because
   * text-tools.ts's own broker-identity cross-check still reads this
   * field; the broker/proxy cross-check this field ALSO used to serve was
   * deleted separately, in vice-proxy.ts, not this field itself. */
  backend: ViceBackend;
}

export interface StartControlListenerOptions {
  host?: string;
  port?: number;
  token: string;
  /** Injectable override for the `hello` reply's `version` field, in this
   * project's standard env/time/spawning/I-O injection register -- when
   * supplied, the dispatch site uses this value verbatim instead of calling
   * resolveBrokerVersion(). Optional; production callers omit it and let
   * the real package.json resolve. */
  helloVersion?: string;
  /** Called on `acquire`, AFTER the token check has already passed. See
   * AcquireOutcome's own header comment for the discriminated shape.
   *
   * Widened with an OPTIONAL SECOND PARAMETER carrying the already-narrowed
   * launch profile (normaliseLaunchProfile() above has run and succeeded by
   * the time this is called; a refusal never reaches here). Optional on
   * purpose, in the same register as TryLaunchDeps.spawn's own widening:
   * JS/TS function-type compatibility lets a one-argument implementation
   * satisfy a type that offers two, so every pre-existing implementation
   * and every pre-existing test stub keeps compiling AND keeps behaving
   * identically. `undefined` means profile-less.
   *
   * Widened AGAIN (Phase 63, SESS-06) with an OPTIONAL THIRD PARAMETER
   * carrying the already-sanitised session label -- this listener runs
   * whatever the wire's `label` field held through sanitiseSessionLabel()
   * BEFORE this callback is ever invoked, exactly the same discipline the
   * second parameter's own comment above already documents for the launch
   * profile. `null` (or omitted) means no label was declared; this callback
   * never sees an unsanitised value. Same JS/TS function-type-compatibility
   * reasoning keeps every pre-63-05 one- and two-argument implementation
   * compiling AND behaving identically. */
  onAcquire: (requestId: string, profile?: LaunchProfile, label?: string | null) => Promise<AcquireOutcome>;
  /** Called on an explicit `release` request AND on connection close
   * (whichever happens first) -- the kernel enforces the release including
   * on the client's own SIGKILL, since close always fires either way. */
  onRelease: (requestId: string) => void;
  /** Called on `status` -- answers the question the dropped
   * broker-instances.json projection used to answer, computed on
   * demand. Synchronous: this broker holds every instance in one in-memory
   * map already (C4), so there is nothing to await. */
  onStatus: () => StatusInstanceEntry[];
  /** Called on `host_state` -- answers questions about the HOST, not about
   * instances (the retiring status subcommand's own host-facing half).
   * Neither this response nor the status response may ever carry the
   * capability token (T-01.6.2-32) -- this module never puts it there. */
  onHostState: () => HostStateFields;
  /** Called on `monitor_claim`, AFTER the token check has already passed --
   * the SAME gate every other op runs, checked before any state is read or
   * written. `requestId` is this specific claim request's own correlation
   * id; `targetId` both resolves which instance is being claimed (the same
   * way every target-naming op resolves its own target) AND is the claiming
   * identity compared against a conflicting holder; `channel` is the
   * resolved channel this request named -- see vice-broker.mts's
   * handleMonitorClaim() for the resolution and idempotency rules. */
  onMonitorClaim: (requestId: string, targetId: string, channel: MonitorChannel) => MonitorClaimOutcome;
  /** Called on `monitor_release`, under the same token gate. Clearing is
   * refused (not silently accepted) when `targetId` names a grant that is
   * NOT the current holder of `channel` -- see MonitorReleaseOutcome's own
   * header comment for the already-cleared tolerance. */
  onMonitorRelease: (requestId: string, targetId: string, channel: MonitorChannel) => MonitorReleaseOutcome;
  /** Called on `attach` (Phase 63, SESS-02). ORIGINALLY called AFTER the
   * token check had already passed; Phase 64 gap G-64-1 (owner decision 5)
   * REVERSED that -- this callback now runs BEFORE the token check, by
   * design, with the presented handle as the sole authority (see this
   * file's own header "Auth:" paragraph). Called AFTER this listener has
   * already stopped its own line reader on this socket (see the relayMode
   * flag inside attachControlProtocol()) -- a synchronous splice inside
   * this callback can never race this connection's next `"data"` event.
   * `presentedHandle`
   * is whatever the wire line named, narrowed to a string but NOT yet
   * checked against anything -- that check (constant-time, length-gated)
   * is this callback's own job. `socket` is the live relay connection
   * itself; `pending` is every byte that arrived, in the SAME chunk, past
   * the attach line's own terminator -- a raw Buffer, never decoded, to
   * hand straight to spliceRelay() as its own `pending` option.
   *
   * Widened to `RelayAttachOutcome | Promise<RelayAttachOutcome>` (G-64-4,
   * plan 64-12): vice-broker.mts's own handleRelayAttach() now awaits a
   * bounded emulator-leg dial before ever answering, so it can no longer
   * settle synchronously on its success path -- every synchronous refusal
   * it still makes (an unrecognised handle, an already-attached channel,
   * an unknown target) is unaffected, since those all happen before its own
   * first `await`. See this file's own `attach` dispatch arm below for how
   * the two shapes are both handled through one `Promise.resolve()`. */
  onRelayAttach: (targetId: string, channel: MonitorChannel, presentedHandle: string, socket: Socket, pending: Buffer) => RelayAttachOutcome | Promise<RelayAttachOutcome>;
  /** Called on `operation` (Phase 63, SESS-05), AFTER the token check AND
   * this listener's own target_id/ownership/channel gates have already
   * passed -- the SAME dispatch shape `onMonitorClaim`/`onMonitorRelease`
   * already establish. `name` is whatever the wire line named, ALREADY run
   * through sanitiseSessionLabel() by this listener (or `null`, verbatim,
   * for an explicit clear) -- this callback never sees an unsanitised value.
   * Synchronous, matching `onMonitorClaim`'s own posture: setting or
   * clearing a field on an in-memory grant record needs no await. Callers
   * are expected to send this WITHOUT awaiting the reply -- a slow or
   * refusing broker must never add latency to, or fail, the tool call that
   * triggered the declaration (T-63-13); the pending-response bookkeeping
   * that makes an un-awaited send safe lives one layer down, in
   * vice-broker-client.ts's own sendAndAwaitLine(). */
  onOperation: (targetId: string, channel: MonitorChannel, name: string | null) => OperationNoteOutcome;
  /** Called on `stage_file` (Phase 64, XFER-04, D-01), AFTER the token check
   * AND this listener's own target_id/ownership gate have already passed --
   * the SAME dispatch shape `onMonitorClaim`/`onOperation` already
   * establish. `slot` is whatever the wire line named, narrowed to a string
   * but NOT further validated here -- sanitising it against the same
   * allow-list posture `sanitiseSessionLabel()` applies to a session label
   * is this callback's own job, per this plan's wire_vocabulary block.
   *
   * OPTIONAL, unlike `onRelayAttach`/`onOperation`: vice-broker.mts does not
   * wire this callback until plan 64-03 -- this plan only puts the
   * operation on the wire. A `stage_file` request against a broker that has
   * not been updated yet (every test in THIS file included, until this
   * plan's own suite supplies a stub) is refused `internal` by the dispatch
   * arm below rather than crashing this connection's `"data"` handler by
   * calling an undefined function -- the same "a type contract is not a
   * runtime guarantee at a wire boundary" reasoning the `monitor_owned`
   * dispatch arm's own comment already states for a required field. */
  onStageFile?: (targetId: string, slot: string) => StageFileOutcome;
  /** Called on `transfer` (Phase 64, XFER-04, D-01/D-02). ORIGINALLY called
   * AFTER the token check had already passed; REVERSED by gap G-64-1 the
   * SAME way `onRelayAttach` above was -- this callback now runs BEFORE
   * the token check, by design (see `onRelayAttach`'s own comment above
   * for the full record). Deliberately NOT gated by this listener's own
   * `ownsTarget()`, the SAME T-63-01 reasoning `onRelayAttach`'s own
   * comment already states for `attach`: this connection is a brand-new
   * transfer socket, never the one that ran `stage_file`, so the presented
   * `handle` is the ONLY authority this callback can check. Called AFTER
   * this listener has already stopped its own line reader on this socket
   * (the SAME `relayMode` flag `attach` flips) -- a synchronous stream
   * start inside this callback can never race this connection's next
   * `"data"` event. `request` is already fully narrowed (see
   * `FileTransferRequest`'s own header comment); `socket` is the live
   * transfer connection itself; `pending` is every byte that arrived, in
   * the SAME chunk, past the `transfer` line's own terminator -- a raw
   * Buffer, never decoded.
   *
   * OPTIONAL, for the same reason `onStageFile` is: not wired into
   * vice-broker.mts until plan 64-03. Refused `internal` by the dispatch arm
   * below when absent, never invoked with `undefined`. */
  onFileTransfer?: (request: FileTransferRequest, socket: Socket, pending: Buffer) => FileTransferOutcome;
  /** Called on `host_tool_stage` (Phase 65, SEAM-01, D-03), ahead of the
   * token gate, by the SAME "brand-new connection, no ownership to gate on"
   * reasoning `onFileTransfer`'s own comment states. OPTIONAL, for the same
   * reason `onStageFile`/`onFileTransfer` are: refused `internal` by name
   * when unwired, never invoked with `undefined`. */
  onHostToolStage?: (files: HostToolStageFileSpec[]) => HostToolStageOutcome;
  /** Called on `host_tool_run` (Phase 65, SEAM-01, D-03/D-09), AFTER this
   * listener's own per-connection request-key binding check has already
   * passed (T-65-04) -- `requestKey` is the bound key, never re-read from
   * the wire line itself. `raw` is the FULL, un-narrowed request object;
   * `host-tool.mts`'s own `bindStagedInputs()` is the one place it is
   * narrowed. Resolves the
   * SAME shape `host-tool.mts`'s `runHostTool()` produces, rewritten to
   * carry handles instead of a broker path (D-10) -- never rejects in
   * production, but the dispatch arm below treats a rejection as a genuine
   * possibility anyway. OPTIONAL, for the same
   * reason `onHostToolStage` is. */
  onHostToolRun?: (requestKey: string, raw: unknown) => Promise<unknown>;
  /** Called when the connection that ran `host_tool_stage` closes (Phase 65,
   * D-09) -- the per-request scratch and every staging registry entry keyed
   * to it are gone once this fires, mirroring `onRelease`'s own
   * connection-close-is-the-release posture for an `acquire` grant.
   * OPTIONAL: a broker that never wires `onHostToolStage` has nothing to
   * clean up either, so this callback is simply never invoked on such a
   * broker. */
  onHostToolEnd?: (requestKey: string) => void;
}

export interface StartControlListenerResult {
  server: Server;
  port: number;
  host: string;
  /** The arrival-ordered pending-acquire structure for THIS listener
   * instance -- append-on-receipt, drain-from-the-front, nothing sorts or
   * re-orders it (see drainPendingAcquires()'s own comment below for the
   * direct FIFO fairness property, which this module deliberately does not
   * itself prove). Exposed so the real broker's own periodic evaluation
   * pass (vice-broker.mts's runBrokerPass) can drain it -- this is what an
   * earlier `serveAcquires: () => {}` no-op placeholder comment was
   * reserving room for. */
  pendingAcquires: PendingAcquireQueue;
}

export type ControlResponse =
  | { kind: "grant"; id: string; port: number; url: string; epoch_file: string; supervisor_dir: string; remote_monitor_port?: number }
  | { kind: "released" }
  | { kind: "status"; instances: StatusInstanceEntry[] }
  | {
      kind: "host_state";
      pid: number;
      started_at: string;
      node_version: string;
      vice_bin: string;
      max_instances: number;
      base_port: number;
      /** See HostStateFields.backend for why this is still on the wire. */
      backend: ViceBackend;
    }
  // Widened (Phase 63, SESS-02) with the per-claim handle -- see
  // MonitorClaimOutcome's own header comment for what mints it and why an
  // idempotent repeat claim echoes the SAME value.
  | { kind: "monitor_claimed"; handle: string }
  | { kind: "monitor_released" }
  // Phase 63 (SESS-02): the successful reply to `attach` -- sent BEFORE
  // this socket becomes a raw byte splice, so the caller has one
  // deterministic signal that the handshake completed before any binmon
  // byte can arrive on this same connection.
  | { kind: "attached" }
  // Phase 63 (SESS-05): the successful reply to `operation` -- both a
  // declaration (a sanitised name) and a clear (`null`) answer this SAME
  // variant; the wire carries no echo of what was recorded, matching
  // `monitor_released`'s own posture (the caller already knows what it
  // sent).
  | { kind: "operation_noted" }
  // Phase 64 (XFER-04, D-01): the successful reply to `stage_file` -- carries
  // a handle the REQUEST did not supply and the broker-side path the
  // emulator itself must open. `transfer`'s own successful replies
  // (`transfer_ready`/`transfer_payload`/`transfer_complete`) are NOT members
  // of this union: `onFileTransfer` writes those directly to the transfer
  // connection once this listener has handed it over (see FileTransferOutcome's
  // own header comment), so this module's own `writeLine()` never produces
  // them.
  | { kind: "file_staged"; handle: string; emulator_filename: string }
  // Phase 65 (SEAM-01, D-03): the successful reply to `host_tool_stage` --
  // carries a request key the REQUEST did not supply, plus one tree handle
  // per distinct tree and one file handle per manifest entry, both in
  // manifest order. `host_tool_run`'s own successful reply is NOT a member
  // of this union: it is `host-tool.mts`'s own response shape, written
  // through `writeHostToolLine()` exactly like the legacy `host_tool` op's
  // own reply already is (see that function's own header comment).
  | { kind: "host_tool_staged"; request: string; trees: string[]; files: string[] }
  // Answered BEFORE the token gate (see handleLine()'s own dispatch-order
  // comment) -- carries no token, username, hostname, home directory,
  // absolute path or per-instance detail, since anything reachable at a
  // bound address can trigger this reply. `tag` is a plain string, never a
  // closed union: Phase 63 adds the monitor-relay tag, Phase 64 the file
  // tag, and this field must not need a rewrite for either.
  | { kind: "hello"; protocol: string; version: string; tag: string }
  // `holder` is optional and populated ONLY for code "monitor_owned" --
  // every other op's error reuses this exact same variant with `holder`
  // omitted (plan 05 extends the existing seam rather than inventing a
  // parallel channel for the one op that needs an extra field).
  | { kind: "error"; code: ControlErrorCode; message: string; holder?: MonitorHolder };

/** 32 cryptographically random bytes rendered as hex -- the per-boot
 * capability token. Held in memory only by the caller; written once into
 * broker.json and never logged, never included in an error message
 * (T-01.6.2-02). */
export function newControlToken(): string {
  return randomBytes(32).toString("hex");
}

const MAX_LINE_BYTES = 65536;
// Phase 65 (plan 65-03, D-11): exported as a SEPARATE statement, never
// folded into the declaration above -- host-tool-transport.test.ts parses
// that exact `const MAX_LINE_BYTES = <n>;` line by regex, off this module's
// own source text, and an `export const` form would break that parse.
// host-tool-endpoint.mts's own HOST_TOOL_STAGE_LINE_MAX_BYTES (a mirrored,
// duplicated constant -- this module is host-bound and that one is not, per
// this file's own leaf-module posture) is kept at or under this value by a
// relation test that imports both modules directly.
export { MAX_LINE_BYTES };

/** Plan 63-04 Task 2 (SESS-04) DEFAULT, mirrored -- NOT imported -- from
 * broker-relay.mts's own DEFAULT_RELAY_KEEPALIVE_MS. Keeping the two
 * literal values in agreement is this module's own job, same as the
 * `HELLO_PROTOCOL_MAGIC` string mirrored a few lines below from
 * broker-endpoint.mts: a byte-identical sync test is what actually holds
 * the agreement together, not a shared import. */
const DEFAULT_RELAY_KEEPALIVE_MS_LOCAL = 30000;

/** DUPLICATES broker-relay.mts's own resolveRelayKeepAliveMs() rather than
 * value-importing it -- see this function's own call site (inside
 * attachControlProtocol() below) for the full boundary reason. Same
 * absent/non-numeric/zero/negative-falls-back-to-default discipline,
 * logged by name, never silently disabling the setting. */
function resolveRelayKeepAliveMsLocal(): number {
  const raw = process.env.VICE_BROKER_RELAY_KEEPALIVE_MS;
  if (raw === undefined || raw === "") return DEFAULT_RELAY_KEEPALIVE_MS_LOCAL;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) {
    console.error(
      `broker-control: rejected VICE_BROKER_RELAY_KEEPALIVE_MS=${JSON.stringify(raw)} (must be a positive number) -- falling back to the default of ${DEFAULT_RELAY_KEEPALIVE_MS_LOCAL}ms`,
    );
    return DEFAULT_RELAY_KEEPALIVE_MS_LOCAL;
  }
  return n;
}

/** The magic string identifying THIS project's own handshake protocol on
 * the wire -- specific enough that a bare TCP accept by an unrelated
 * service can never be mistaken for it. This is the one authoritative
 * definition (plan 62-01, D-06); `broker-endpoint.mts`, the container-side
 * dialling client, MIRRORS this literal rather than importing it (this
 * module is host-bound and compiled into `resources/`, so a container-side
 * source file cannot value-import it) -- broker-endpoint.test.ts asserts
 * the two copies are byte-identical by reading both files' source, so the
 * two cannot silently drift. Keep this comment's claim true if you ever
 * change the string: update both places in the SAME change. */
export const HELLO_PROTOCOL_MAGIC = "vice-mcp-broker-hello-v1";

/** This module's own directory, computed once at module load -- mirrors
 * tool-location.mts's own `HERE` constant and its two-candidate locate
 * idiom (beside `here`, then one directory up), because this module ships
 * two ways: as unbuilt source (`src/mcp/vice/broker-control.mts`, where
 * `here` is `src/mcp/vice/`) and as the compiled artifact this project
 * actually runs (`src/mcp/vice/resources/broker-control.mjs`, where `here`
 * is `src/mcp/vice/resources/`). The two-candidate join below is what lets
 * both forms find the same `package.json`. */
const HERE = dirname(fileURLToPath(import.meta.url));

/** The placeholder a git checkout (or a resolve/parse failure) reports as
 * this broker's own handshake version. Mirrored, not imported, from
 * version.mts's own `DEV_PLACEHOLDER` -- that module is container-side and
 * this one is host-bound, compiled away from it (see version.mts's own
 * header for why importing it here is forbidden). Kept byte-identical to
 * that constant so a published client reads the same placeholder string on
 * either side of the boundary. */
const HELLO_DEV_PLACEHOLDER = "0.0.0-dev";

/** Resolves the broker's own package version for the `hello` handshake
 * reply, reading `package.json` from two candidates relative to `here` --
 * beside it, then one directory up -- the same locate idiom
 * tool-location.mts's readDeclaration() already uses for a different data
 * file crossing this same source/compiled boundary. Never throws: any
 * missing file, unreadable file, unparsable JSON, or a missing/non-string
 * `.version` field degrades to HELLO_DEV_PLACEHOLDER rather than crashing
 * the listener over a version string. Exported so a test can call it
 * directly with an injected `here`; production dispatch calls it with no
 * argument and lets it default to this module's own real location. */
export function resolveBrokerVersion(here: string = HERE): string {
  const candidates = [join(here, "package.json"), join(here, "..", "package.json")];
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const raw = readFileSync(candidate, "utf8");
      const pkg = JSON.parse(raw) as { version?: unknown };
      if (typeof pkg.version === "string" && pkg.version.length > 0) return pkg.version;
    } catch {
      // Unreadable or unparsable at this candidate -- try the next one, or
      // fall through to the placeholder below.
    }
  }
  return HELLO_DEV_PLACEHOLDER;
}

/** The one refusal wording for a target-naming op whose `target_id` is
 * not the grant the asking connection itself holds. Deliberately worded as an
 * authorisation refusal and NOT as an ownership conflict between two
 * legitimate holders (`monitor_owned`, which names a holder) and never as an
 * emulator fault -- see attachControlProtocol()'s own ownsTarget() comment,
 * and this file's own prohibition on wedge/hang vocabulary in its
 * monitor-op refusals. */
const MONITOR_OWNERSHIP_DENIAL =
  "monitor_claim/monitor_release may only target the grant this connection itself holds";

/** Resolves the `channel` field on a `monitor_claim`/`monitor_release`
 * request line: an ABSENT field means `binary` deliberately -- a broker
 * restarted mid-upgrade against a client that predates this field keeps
 * working (backward compatibility). An unrecognised NON-EMPTY value is
 * `bad_request`, never a silent fallback and never cast -- the caller
 * below names both accepted values in the refusal message. */
function resolveMonitorChannel(raw: unknown): MonitorChannel | "bad_request" {
  if (raw === undefined) return "binary";
  if (raw === "binary" || raw === "text") return raw;
  return "bad_request";
}

/** Resolves the `transfer` op's own `direction` field: exactly the two
 * accepted literals, or `bad_request` -- mirrors resolveMonitorChannel()'s
 * own shape and its no-coercion discipline (an unrecognised value is
 * refused by name, never guessed at). Unlike resolveMonitorChannel(), there
 * is no absent-field default: `direction` has no meaningful implicit value
 * the way an omitted `channel` does, so `undefined` falls into the same
 * `bad_request` bucket as any other unrecognised value. */
function resolveTransferDirection(raw: unknown): "upload" | "download" | "bad_request" {
  if (raw === "upload" || raw === "download") return raw;
  return "bad_request";
}

/** The ONE sanitiser every caller-supplied display string travelling over
 * this control plane goes through before a broker-side record or log line
 * ever renders it (T-63-10). Strips every C0 control character
 * (`\u0000`-`\u001f`, which already covers both line terminators -- no
 * separate terminator pass is needed), trims the result, and caps it at 64
 * characters. Never rejects outright: a hostile or malformed value degrades
 * to a shorter, stripped string, or to `null` when nothing legible survives
 * -- never an exception, and never a partially-escaped value that could
 * still inject structure into a rendered record. `null` in, or a
 * non-string, answers `null`; an empty-after-stripping string ALSO answers
 * `null`, matching this file's own discipline of never fabricating a
 * plausible-looking value for "nothing was actually said". Exported so a
 * caller can run a value through this exact function rather than
 * re-deriving the C0-strip/trim/cap sequence -- Plan 63-05 reuses it
 * verbatim for the session label (SESS-06), which is why it lives here
 * rather than beside its one caller in the `operation` dispatch arm below. */
export function sanitiseSessionLabel(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const stripped = raw.replace(/[\u0000-\u001f]/g, "");
  const trimmed = stripped.trim();
  if (trimmed === "") return null;
  return trimmed.slice(0, 64);
}

// ---------------------------------------------------------------------------
// The launch-profile narrowing site.
//
// THIS IS THE ONE PLACE `profile` IS NARROWED. Do not re-derive this check
// anywhere else -- not in vice-broker.mts, not in broker-launch.mts, not in
// the container-side client. A second copy is how one of them ends up
// accepting a shape the other refuses.
//
// WHY IT HAS TO EXIST AT ALL: `ControlRequest` above carries an index
// signature, so *anything* a container writes on the wire parses into it. The
// profile then feeds buildViceArgs(), i.e. an `execve(x64sc, argv)` on the
// HOST. An unvalidated `profile` is therefore an argv-construction surface
// across a trust boundary, not merely a typing inconvenience.
//
// WHY UNKNOWN KEYS ARE REFUSED BY NAME rather than dropped: a silently
// accepted typo means a caller asked for warp, got an unwarped instance, and
// received a confident success -- the same undetectable-lie failure a
// mismatched grant-and-request eligibility check exists to prevent one
// layer down, and it is why the message below names the offending key --
// the by-name unexpected-argument discipline the tool handlers already use
// (RUN_UNTIL_KEYS' own convention).
//
// WHAT MUST NEVER BE ADDED HERE: a passthrough string, an `extraArgs`, or any
// key whose VALUE reaches argv. `profile` maps to exactly two literal flag
// tokens (`-console`, `-warp`) and to nothing else (T-33-04). `VICE_ARGS`
// stays the single, deliberate operator-only whole-argv override.
// ---------------------------------------------------------------------------

/** The complete accepted key set -- the ONE binding list this narrowing
 * checks against, so adding a knob to LaunchProfile without adding it here
 * refuses the knob rather than silently widening the boundary. */
const LAUNCH_PROFILE_KEYS: readonly string[] = Object.freeze(["warp", "headless"]);

const LAUNCH_PROFILE_SHAPE = `an object with optional boolean keys ${LAUNCH_PROFILE_KEYS.join("/")}, or absent`;

export type NormaliseLaunchProfileResult = { ok: true; profile: LaunchProfile | undefined } | { ok: false; message: string };

/** Narrows an untrusted `profile` field off the wire. Never throws; answers a
 * discriminated result so the caller writes the existing `bad_request` error
 * shape rather than needing a try/catch at the protocol boundary.
 *
 * Rules, in the order they are applied:
 * - `undefined` (key absent) and `null` -> `ok` with `undefined`. Both mean
 *   profile-less, which is byte-identically today's behaviour.
 * - a PLAIN object (arrays and every other non-plain value refused) whose
 *   keys are a subset of LAUNCH_PROFILE_KEYS and whose PRESENT values are
 *   booleans -> `ok` with that object.
 * - anything else -> `ok: false`, with a message naming the offending value
 *   (or key) and the accepted shape. Never coerced, never silently dropped:
 *   `"yes"`, `1` and `"warp"` are refusals, not truthy warp requests. */
export function normaliseLaunchProfile(raw: unknown): NormaliseLaunchProfileResult {
  if (raw === undefined || raw === null) return { ok: true, profile: undefined };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    // Arrays are specifically excluded: `typeof [] === "object"` in JS, so
    // without the Array.isArray() arm a JSON array would reach the key walk
    // below and pass it vacuously (an empty array has no own keys).
    return { ok: false, message: `profile must be ${LAUNCH_PROFILE_SHAPE}; got ${JSON.stringify(raw) ?? String(raw)}` };
  }
  const entries = Object.entries(raw as Record<string, unknown>);
  const unknownKeys = entries.filter(([key]) => !LAUNCH_PROFILE_KEYS.includes(key)).map(([key]) => key);
  if (unknownKeys.length > 0) {
    return { ok: false, message: `profile has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${LAUNCH_PROFILE_SHAPE}` };
  }
  const profile: LaunchProfile = {};
  for (const [key, value] of entries) {
    if (typeof value !== "boolean") {
      return { ok: false, message: `profile.${key} must be a boolean; got ${JSON.stringify(value) ?? String(value)}` };
    }
    if (key === "warp") profile.warp = value;
    if (key === "headless") profile.headless = value;
  }
  return { ok: true, profile };
}

export function resolveControlPort(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_CONTROL_PORT;
  if (raw === undefined || raw === "") return 19510;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 19510;
}

/** Constant-time token comparison over EQUAL-LENGTH buffers -- an
 * unequal-length comparison is refused without ever calling
 * timingSafeEqual (which throws on a length mismatch), so the length check
 * itself leaks nothing beyond what a fixed-length comparison already
 * would not avoid. */
function tokensMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function writeLine(socket: Socket, obj: ControlResponse): void {
  if (socket.writable) {
    socket.write(`${JSON.stringify(obj)}\n`);
  }
}

/** Writes a `host_tool_run` response line: the object host-tool.mts's
 * runHostTool() produced (`{ ok: true, ... }` or `{ ok: false, message }`).
 * Deliberately not `writeLine()`/`ControlResponse`, because that shape is
 * host-tool.mts's own contract. */
function writeHostToolLine(socket: Socket, obj: unknown): void {
  if (socket.writable) {
    socket.write(`${JSON.stringify(obj)}\n`);
  }
}

function defaultRequestId(prefix: string): string {
  return `${prefix}-${process.pid}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Arrival-ordered pending-acquire structure (not its fairness proof -- see
// drainPendingAcquires()'s own header comment).
// ---------------------------------------------------------------------------

export interface PendingAcquireEntry {
  requestId: string;
  /** Retries the acquire once, over the SAME original connection. Resolves
   * `true` once this entry is fully settled (either served, or answered
   * with a terminal error, or its connection is gone) and should be removed
   * for good; resolves `false` when the launch is STILL in flight and this
   * entry must be tried again on a later pass. */
  attempt: () => Promise<boolean>;
}

export type PendingAcquireQueue = PendingAcquireEntry[];

/** Appends to the BACK of the queue -- the only mutation this structure
 * ever performs on receipt. Nothing here sorts or re-orders; arrival order
 * falls out of the array's own insertion order. */
export function enqueueAcquire(queue: PendingAcquireQueue, entry: PendingAcquireEntry): void {
  queue.push(entry);
}

/** Drains the queue from the front, strictly in the order this CALL found
 * them: takes a snapshot of everything currently pending (`splice`, never a
 * sort), then attempts each in that order. An entry whose launch is still
 * in flight is pushed back onto the queue for the NEXT drain pass rather
 * than retried immediately in a tight loop -- a later-arriving acquire that
 * queued behind it during THIS pass is not overtaken (it is appended after
 * the requeued entry, never before), so the array never needs re-ordering
 * to stay correct; a genuinely adversarial retry pattern could still starve
 * an entry across MULTIPLE passes, which is exactly the direct fairness
 * proof this module deliberately does not author -- injecting N acquires
 * and asserting grants return in that order is left as a property for a
 * future test to prove, not this module's own deliverable. The original
 * defect this queue replaces (a lexical iteration over
 * `req-<pid>-<ms>-<hex>` filenames) cannot exist here regardless: there
 * is no file, and no re-ordering call of any kind anywhere in this region. */
export async function drainPendingAcquires(queue: PendingAcquireQueue): Promise<void> {
  const snapshot = queue.splice(0, queue.length);
  for (const entry of snapshot) {
    const settled = await entry.attempt();
    if (!settled) {
      queue.push(entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Interface enumeration and the bridge allowlist (BROKER-03/D-09/D-10).
// ---------------------------------------------------------------------------

/** The bridge-interface allowlist BROKER-03/D-09 requires: the broker binds
 * loopback plus every address on an interface whose NAME matches one of
 * these four patterns, matched among non-internal interfaces only (see
 * enumerateBindHosts() below). The owner considered, and explicitly
 * declined, an environment-override knob here -- a bridge under an
 * unlisted name is simply never bound, and that cost was accepted rather
 * than adding a knob that could widen the bind set unaudited. Binding
 * every RFC1918/private-range address was ALSO rejected: that would also
 * bind the machine's own LAN address, which on untrusted wifi is close to
 * the wildcard bind the settled decision above forbids. Frozen so the set
 * cannot be mutated by a caller at runtime; four entries, one per D-09
 * name, mutually exclusive by construction (no interface name can match
 * two of them at once). */
export const BRIDGE_INTERFACE_ALLOWLIST: readonly RegExp[] = Object.freeze([
  /^docker0$/, // Docker's own default bridge -- exact name, never a prefix
  /^br-/, // a Docker user-defined bridge network
  /^podman/, // Podman's own bridge naming
  /^cni-/, // a CNI-managed bridge (Kubernetes-style container networking)
]);

function matchesBridgeAllowlist(name: string): boolean {
  return BRIDGE_INTERFACE_ALLOWLIST.some((pattern) => pattern.test(name));
}

function isIPv4Record(record: NetworkInterfaceInfo): boolean {
  return record.family === "IPv4";
}

export interface EnumerateBindHostsOptions {
  /** Injectable override for `os.networkInterfaces()` -- this project's
   * standard env/time/spawning/I-O injection register (the suite has no
   * mocking library, so an injectable seam is the only testable shape).
   * Production callers omit it and get the platform's own live interface
   * list. */
  networkInterfaces?: () => NodeJS.Dict<NetworkInterfaceInfo[]>;
}

/** BROKER-03/D-09/D-10: enumerates the bind set from the live interface
 * list -- loopback (identified by the record's own INTERNAL flag, never by
 * the interface name, since the loopback interface is named differently on
 * macOS/BSD -- `lo0`, not `lo`) plus every IPv4 address on a NON-internal
 * interface whose name matches BRIDGE_INTERFACE_ALLOWLIST. IPv6 addresses
 * are never returned (a Docker/Podman/CNI bridge gateway address is always
 * IPv4, and binding the IPv6 link-local entry an allowlisted interface
 * commonly also carries would serve no routing purpose here while
 * complicating the empty-set logic below for no benefit). Loopback always
 * sorts first; the remaining order is the platform's own enumeration
 * order, de-duplicated. Never throws and never signals an error itself --
 * an empty bridge subset is a correct steady state (macOS Docker Desktop
 * has no host-side bridge interface at all, D-09), and even a totally
 * empty result (no loopback found either) is returned as a plain empty
 * array for the CALLER to treat as fatal -- this function never refuses on
 * its own. Never hardcodes a gateway literal: every address comes from the
 * live list handed to it, because a custom container network has its own
 * gateway. Intended to be called exactly ONCE per listener start (D-10) --
 * this module contains no timer or interval that calls it again. */
export function enumerateBindHosts(opts: EnumerateBindHostsOptions = {}): string[] {
  const listInterfaces = opts.networkInterfaces ?? osNetworkInterfaces;
  const interfaces = listInterfaces();
  const seen = new Set<string>();
  const ordered: string[] = [];
  const addUnique = (address: string): void => {
    if (seen.has(address)) return;
    seen.add(address);
    ordered.push(address);
  };

  // Loopback pass first -- always precedes bridge addresses in the
  // returned order, regardless of the platform's own key ordering.
  for (const records of Object.values(interfaces)) {
    if (!records) continue;
    for (const record of records) {
      if (record.internal && isIPv4Record(record)) addUnique(record.address);
    }
  }

  // Bridge pass -- interface NAME matched against the allowlist, among
  // non-internal interfaces only, filtered to IPv4.
  for (const [name, records] of Object.entries(interfaces)) {
    if (!records || !matchesBridgeAllowlist(name)) continue;
    for (const record of records) {
      if (!record.internal && isIPv4Record(record)) addUnique(record.address);
    }
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Bind (low-level, no protocol) -- kept separate from startControlListener()
// so a test can occupy a real port with a plain, non-broker listener (task
// 3's singleton-guard tests) without pulling in this module's own protocol
// handling.
// ---------------------------------------------------------------------------

export interface BoundListener {
  server: Server;
  port: number;
  host: string;
}

/** Binds a bare TCP listener with NO protocol wired up -- no token check, no
 * request handling, nothing. `startControlListener()` below calls this
 * internally and then attaches the real protocol; a test wanting to occupy
 * a control port with "something that is not a broker" (the loud singleton
 * path's own fixture) can call this directly and never see anything that
 * looks like this broker's wire format. */
export function bindControlListener(host: string, port: number): Promise<BoundListener> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr !== null ? addr.port : port;
      resolvePromise({ server, port: boundPort, host });
    });
  });
}

/** Attaches the newline-delimited-JSON protocol (framing, token gate, all
 * five request kinds) to an ALREADY-BOUND server. Split out of
 * startControlListener() so the bind step and the protocol-wiring step are
 * two separately callable primitives -- the real broker still calls
 * startControlListener() as one step (this function is not part of its own
 * public surface); this module's own tests exercise the two independently. */
function attachControlProtocol(server: Server, opts: StartControlListenerOptions, pendingAcquires: PendingAcquireQueue): void {
  server.on("connection", (socket: Socket) => {
    // Plan 63-04 Task 2 (SESS-04): the keepalive delay is set on EVERY
    // accepted connection -- a plain control connection just as much as one
    // that will go on to become a relay via `attach` -- since any of them
    // could be the client-facing leg an operator wants a best-effort dead-
    // peer signal for. This sets ONLY the delay before the FIRST probe; the
    // interval between probes and the number of probes past that delay
    // remain the host's own kernel settings, which this broker cannot
    // change (see broker-relay.mts's DEFAULT_RELAY_KEEPALIVE_MS's own
    // comment). The OWNED bound is the relay's own idle deadline
    // (broker-relay.mts's resolveRelayIdleMs()), never this setting.
    //
    // resolveRelayKeepAliveMsLocal() below DUPLICATES broker-relay.mts's own
    // resolveRelayKeepAliveMs() rather than value-importing it -- the SAME
    // boundary reason vice-broker.mts's own classifyBrokerLivenessLocal()/
    // isWildcardBindHostLocal() duplicate rather than import a sibling: this
    // module is routinely loaded UNBUILT (`.mts` source directly, never
    // resources/broker-control.mjs) by nine of its own test files, and a
    // VALUE import of a sibling host-bound module would require a real
    // "./broker-relay.mjs" file to sit beside this SOURCE file on disk --
    // which only exists once built. A TYPE-ONLY import stays safe (erased);
    // a value import does not.
    socket.setKeepAlive(true, resolveRelayKeepAliveMsLocal());

    // Buffer-mode carry (Phase 63, SESS-02) -- REPLACES the earlier
    // string accumulator (`let buffer = ""`) for every connection, not
    // only a relay one, because the corruption this guards against
    // happens at DECODE TIME: `chunk.toString("utf8")` on a whole chunk
    // mangles any non-UTF-8 byte in it (a lone 0x80-0xFF run, an embedded
    // 0x00) regardless of which line that byte logically belongs to. The
    // eight pre-existing JSON-line ops never carry such a byte, so this is
    // byte-identical behaviour for them; the NEW `attach` op's own
    // leftover bytes -- the FIRST thing in this whole protocol that is
    // NOT guaranteed to be ASCII -- are what make this the load-bearing
    // half. The terminator search is a byte-level `indexOf(0x0a)`, never a
    // string search; a line is decoded to a string ONLY for its own
    // `JSON.parse()` call, never the accumulator as a whole.
    let carry: Buffer = Buffer.alloc(0);
    let requestIdForThisConnection: string | null = null;
    // Phase 65 (SEAM-01, D-03/D-09): the request key `host_tool_stage`
    // minted and bound to THIS connection -- `null` until a stage succeeds,
    // never re-read from a later `host_tool_run` line's own `request`
    // field (T-65-04). Mirrors `requestIdForThisConnection`'s own shape one
    // line above, for the same reason: connection close IS the cleanup
    // signal (see the close handler below).
    let hostToolRequestKey: string | null = null;
    // Set by the `attach` dispatch arm below, BEFORE onRelayAttach() is
    // ever called -- once true, this socket's OWN "data" listener becomes
    // a no-op forever: every further byte belongs to
    // broker-relay.mts's spliceRelay(), which installs its OWN "data"
    // listeners on this SAME socket from inside onRelayAttach(). Node
    // fires every listener on an event, in the order each was added, so
    // this flag is what stops THIS listener from also decoding those
    // bytes as JSON lines once the splice takes over.
    let relayMode = false;

    socket.on("data", (chunk: Buffer) => {
      if (relayMode) return;
      const combined = Buffer.concat([carry, chunk]);
      if (combined.length > MAX_LINE_BYTES) {
        socket.destroy();
        return;
      }
      let cursor = combined;
      let newlineIdx: number;
      while ((newlineIdx = cursor.indexOf(0x0a)) !== -1) {
        const lineBuf = cursor.subarray(0, newlineIdx);
        const remainder = cursor.subarray(newlineIdx + 1);
        handleLine(lineBuf.toString("utf8"), remainder);
        if (relayMode) {
          // The line just handled was `attach`, and it has already handed
          // `remainder` to onRelayAttach() as `pending` -- those bytes are
          // now the splice's, not this reader's. Nothing left in `cursor`
          // is ever re-examined as a JSON line.
          return;
        }
        cursor = remainder;
      }
      carry = cursor;
    });

    socket.on("close", () => {
      // Connection close IS the release -- including on the client's own
      // SIGKILL, since "close" always fires either way. Idempotent: an
      // explicit `release` already having cleared
      // requestIdForThisConnection makes this a no-op.
      if (requestIdForThisConnection) {
        const id = requestIdForThisConnection;
        requestIdForThisConnection = null;
        opts.onRelease(id);
      }
      // Phase 65 (D-09): the SAME connection-close-is-the-cleanup-signal
      // posture as the release above, for a `host_tool_stage` request's own
      // per-request scratch -- fires on an explicit close and on a bare
      // socket death (SIGKILL) alike, since "close" always fires either way.
      if (hostToolRequestKey) {
        const key = hostToolRequestKey;
        hostToolRequestKey = null;
        opts.onHostToolEnd?.(key);
      }
    });

    socket.on("error", () => {
      // Per-connection error handling isolates one peer's failure from
      // every other connection and from the server itself (T-01.6.2-06).
    });

    /**
     * THE per-connection ownership predicate every target-naming op is
     * gated on, shared rather than copied.
     *
     * Before this existed, `monitor_claim`/`monitor_release` took `target_id`
     * from the request and passed it straight through, so any connection
     * holding the per-boot control token (which every container-side proxy
     * sharing this broker does) could name ANOTHER session's grant id.
     * vice-broker.mts's handleMonitorClaim() uses that id as BOTH the target
     * and the claiming identity, and handleMonitorRelease()'s "only the
     * holder may release" check compared the request against itself -- so
     * session B could lock session A out of its own monitor socket, or
     * RELEASE A's live claim, after which a third client was free to dial the
     * same single-client binmon socket. That is precisely the unserviced-
     * backlog state this ownership check exists to prevent and that
     * CLAUDE.md says must never be reachable.
     *
     * WHAT NOT TO DO: never add another op that acts on a caller-supplied
     * `target_id` without gating it here first. The grant a connection holds
     * is the ONLY identity this protocol has -- `target_id` is a request
     * field, not a credential.
     */
    function ownsTarget(targetId: string): boolean {
      return requestIdForThisConnection !== null && targetId === requestIdForThisConnection;
    }

    /** Attempts one acquire over THIS connection/socket, writing the
     * terminal response (grant or a non-queueing error) when settled, or
     * enqueueing itself and returning unsettled when a launch is already in
     * flight. Shared by the immediate first attempt and every later retry
     * `drainPendingAcquires()` drives, so the two paths can never answer
     * differently for the same requestId.
     *
     * Two destroyed-socket checks guard a grant against outliving the
     * connection that owns it, and they bound TWO DIFFERENT failures -- do
     * not conflate them into one claim.
     *
     * Half one -- the pre-check immediately below, BEFORE onAcquire() is
     * ever called -- closes the ALWAYS-REACHABLE leak: a client that
     * disconnects while queued leaves its entry pending (nothing removes it,
     * since it never held a grant id to release), and the next drain pass
     * would otherwise call the launch callback anyway -- which on the real
     * broker allocates a port, spawns a real child, writes an epoch record
     * and records a grant that no connection owns. This half turns that
     * always-reachable leak into a bounded race (half two, below).
     *
     * Half two -- the release-on-late-grant branch on the success path --
     * bounds the NARROW race the pre-check cannot close: a disconnect
     * landing between the pre-check passing and onAcquire()'s own
     * completion. This half does NOT eliminate that race -- it cannot, the
     * pre-check and the callback are separated by a real await -- it turns
     * the race from a leak into a reclaim, by invoking the existing release
     * callback with the same request id instead of silently dropping the
     * grant it produced.
     */
    function attemptAcquire(requestId: string, profile?: LaunchProfile, label?: string | null): Promise<boolean> {
      // Half one: a queued entry whose owning socket is already gone is
      // settled immediately, WITHOUT ever calling onAcquire() -- this is
      // what keeps a retried drain pass from performing a real, ownerless
      // launch.
      if (socket.destroyed) return Promise.resolve(true);
      return opts
        // The profile AND the already-sanitised label (Phase 63, SESS-06)
        // are threaded through THIS shared helper, which both the immediate
        // first attempt and every later drainPendingAcquires() retry go
        // through -- so a request that queued behind an in-flight launch is
        // retried later with the SAME profile and label it was MADE with.
        .onAcquire(requestId, profile, label)
        .then((outcome) => {
          if (outcome.ok) {
            // Half two: the pre-check above ran before this call; a
            // disconnect landing DURING the await is still possible and is
            // bounded, not eliminated, here -- a grant that settles for a
            // socket that is now gone is released through the existing
            // release path rather than dropped.
            if (socket.destroyed) {
              opts.onRelease(requestId);
              return true;
            }
            requestIdForThisConnection = requestId;
            writeLine(socket, {
              kind: "grant",
              id: requestId,
              port: outcome.grant.port,
              url: outcome.grant.url,
              epoch_file: outcome.grant.epochFile,
              supervisor_dir: outcome.grant.supervisorDir,
              // Key omitted entirely when absent -- the fork case only now.
              // A stock grant whose second (text-monitor) port allocation
              // failed never reaches this line at all:
              // acquirePortAndLaunch() fails the WHOLE acquire
              // (`no_free_text_port`) before any grant is produced, so
              // "absent" no longer needs to cover that case. Never a
              // fabricated 0 or null standing in for "no port".
              ...(outcome.grant.remoteMonitorPort === undefined ? {} : { remote_monitor_port: outcome.grant.remoteMonitorPort }),
            });
            return true;
          }
          if (outcome.reason === "launch_in_flight") {
            return false; // still blocked -- caller re-queues
          }
          if (socket.destroyed) return true; // no grant was produced -- nothing to release, nothing left to answer
          const code: ControlErrorCode = outcome.reason === "internal" ? "internal" : outcome.reason;
          writeLine(socket, { kind: "error", code, message: `acquire failed: ${outcome.reason}` });
          return true;
        })
        .catch(() => {
          if (!socket.destroyed) {
            writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "acquire threw" });
          }
          return true;
        });
    }

    /** `remainderAfterLine` is every byte the per-connection reader above
     * had already sliced past THIS line's own terminator, within whatever
     * chunk delivered it -- a raw Buffer, never decoded. Every existing
     * op ignores it; the NEW `attach` arm below is the one branch that
     * reads it, and only after it has already flipped `relayMode`. */
    function handleLine(line: string, remainderAfterLine: Buffer): void {
      if (line.trim() === "") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "malformed JSON line" });
        return;
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "request must be a JSON object" });
        return;
      }
      const req = parsed as ControlRequest;

      // Answered UNCONDITIONALLY, ahead of the token gate below -- BY
      // DESIGN, per D-06/ENDPOINT-03. The handshake carries no credential,
      // so an arm placed after tokensMatch() would always answer
      // `unauthorized`, indistinguishable from this module's own
      // stale-broker signature (a pre-v2.0.0 broker's token check runs
      // ahead of dispatch too). `hello` is no longer the ONLY op this
      // listener answers before the gate -- `attach` and `transfer`, below,
      // now join it (Phase 64 gap G-64-1, owner decision 5; see this file's
      // own header "Auth:" paragraph). Every other op -- including
      // `host_tool`, dispatched first in the POST-gate chain below -- keeps
      // requiring the token, untouched. The reply's key set is fixed to
      // exactly four fields and carries no token, username, hostname, home
      // directory, absolute path or per-instance detail, because it is
      // answered to any caller that can reach a bound address (see this
      // plan's own privacy prohibition and STRIDE entry T-62-02).
      if (req.op === "hello") {
        const tag = typeof req.tag === "string" && req.tag !== "" ? req.tag : "control";
        writeLine(socket, {
          kind: "hello",
          protocol: HELLO_PROTOCOL_MAGIC,
          version: opts.helloVersion ?? resolveBrokerVersion(),
          tag,
        });
        return;
      }

      // Phase 63 (SESS-02), REVERSED by Phase 64 gap G-64-1 (owner decision
      // 5). Dispatched HERE, ahead of the token gate below, by the
      // broker-minted per-claim handle ALONE -- see this file's own header
      // "Auth:" paragraph and ControlRequestKind's own comment on `attach`.
      // `hello` above is no longer the ONLY op this listener answers before
      // the gate; `attach` and `transfer` (below) now join it. Deliberately
      // NOT gated by ownsTarget(): this connection is a brand-new relay
      // socket, never the one that ran monitor_claim, so
      // requestIdForThisConnection is null on it -- the per-claim `handle`
      // presented below is the ONLY authority this arm can check. The
      // handle comparison itself is untouched, still owned by
      // vice-broker.mts's handleRelayAttach() (length-checked,
      // constant-time, refuses a second attach).
      if (req.op === "attach") {
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        const presentedHandle = typeof req.handle === "string" ? req.handle : "";
        if (targetId === "" || presentedHandle === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "attach requires target_id and handle" });
          return;
        }
        const channel = resolveMonitorChannel(req.channel);
        if (channel === "bad_request") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: `attach: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
          });
          return;
        }
        // Flipped BEFORE onRelayAttach() is ever called -- this socket's own
        // line reader (see the relayMode declaration's own header comment
        // above) must never decode a byte that belongs to the splice, even
        // though (G-64-4, plan 64-12) onRelayAttach() may now be AWAITING a
        // bounded emulator-leg dial for some time before it settles. The
        // client leg itself is paused for that same window by
        // vice-broker.mts's own handleRelayAttach() -- see this function's
        // own comment below on the refusal path's explicit `socket.resume()`
        // for the other half of that story.
        relayMode = true;
        Promise.resolve(opts.onRelayAttach(targetId, channel, presentedHandle, socket, remainderAfterLine))
          .then((outcome) => {
            // The client leg closed while this attach was in flight -- there
            // is nobody left to write a reply to, and nothing this arm does
            // past this point (resuming a destroyed socket, starting a
            // splice against it) is meaningful.
            if (socket.destroyed) return;
            if (outcome.ok) {
              // Written BEFORE start() ever runs (see RelayAttachOutcome's
              // own header comment and handleRelayAttach()'s): the emulator
              // socket carries no "data" listener and is not piped until
              // start() runs, so this write is guaranteed to precede any
              // byte the emulator has already sent.
              writeLine(socket, { kind: "attached" });
              outcome.start();
            } else {
              // The attach FAILED -- this socket never became a relay, so
              // its line reader must resume rather than silently going deaf
              // on a connection the caller may still retry `attach` over.
              // `socket.resume()` is a safe no-op if handleRelayAttach()
              // never actually paused it (every SYNCHRONOUS refusal, which
              // runs before that pause).
              relayMode = false;
              socket.resume();
              writeLine(socket, { kind: "error", code: outcome.code, message: outcome.message ?? `attach refused: ${outcome.code}` });
            }
          })
          .catch((err) => {
            if (socket.destroyed) return;
            relayMode = false;
            socket.resume();
            writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: `attach: onRelayAttach threw: ${String(err)}` });
          });
        return;
      }

      // Phase 64 (XFER-04, D-01/D-02), REVERSED by gap G-64-1 (owner
      // decision 5) the SAME way `attach` above was -- dispatched HERE,
      // ahead of the token gate, beside `attach`, by the broker-minted
      // per-stage handle ALONE (D-01: the payload is authorised by the
      // handle the broker minted, not by the connection presenting it).
      // Deliberately NOT gated by ownsTarget(): this connection is a
      // brand-new transfer socket, never the one that ran stage_file, so
      // the presented `handle` is the ONLY authority this arm can check.
      // The unknown-handle refusal and the in-flight guard are untouched,
      // still owned by vice-broker.mts's handleFileTransfer().
      if (req.op === "transfer") {
        const handle = typeof req.handle === "string" ? req.handle : "";
        const direction = resolveTransferDirection(req.direction);
        if (handle === "" || direction === "bad_request") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: 'transfer requires handle and direction ("upload" or "download")',
          });
          return;
        }
        let fileTransferRequest: FileTransferRequest;
        if (direction === "upload") {
          if (typeof req.byteLength !== "number" || typeof req.sha256 !== "string") {
            writeLine(socket, {
              kind: "error",
              code: "bad_request" as ControlErrorCode,
              message: "transfer (upload) requires byteLength (number) and sha256 (string)",
            });
            return;
          }
          fileTransferRequest = { direction: "upload", handle, byteLength: req.byteLength, sha256: req.sha256 };
        } else {
          fileTransferRequest = { direction: "download", handle };
        }
        // onFileTransfer is OPTIONAL for the same reason onStageFile is --
        // see that field's own header comment. Refused by name, never
        // called with `undefined`, and this socket's line reader is left
        // running (relayMode is never flipped on this path).
        if (!opts.onFileTransfer) {
          writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "transfer is not wired on this broker" });
          return;
        }
        // Flipped BEFORE onFileTransfer() is ever called -- mirrors the
        // `attach` arm's own relayMode flip above: a payload byte must
        // never be re-examined by this socket's own JSON-line reader.
        relayMode = true;
        const transferOutcome = opts.onFileTransfer(fileTransferRequest, socket, remainderAfterLine);
        if (!transferOutcome.ok) {
          // The transfer was refused before any payload byte was consumed
          // by the callback -- this socket never became a payload
          // connection, so its line reader must resume, exactly as a
          // failed `attach` resumes its own.
          relayMode = false;
          writeLine(socket, { kind: "error", code: transferOutcome.code, message: transferOutcome.message });
        }
        // On success this arm writes NOTHING further -- onFileTransfer()
        // itself owns every reply line and every payload byte from here on
        // (see FileTransferOutcome's own header comment).
        return;
      }

      // Phase 65 (SEAM-01, D-03), dispatched HERE, ahead of the token gate,
      // beside `attach`/`transfer` above -- see ControlRequestKind's own
      // comment on `host_tool_stage`/`host_tool_run` for the full reasoning.
      // Never touches relayMode: this op answers on the ordinary line
      // reader, it never hands the connection to a splice.
      if (req.op === "host_tool_stage") {
        if (hostToolRequestKey !== null) {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: "host_tool_stage: a stage request is already bound to this connection",
          });
          return;
        }
        const filesRaw = req.files;
        if (!Array.isArray(filesRaw)) {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "host_tool_stage requires files (array)" });
          return;
        }
        const files: HostToolStageFileSpec[] = [];
        for (const rawEntry of filesRaw) {
          if (typeof rawEntry !== "object" || rawEntry === null || Array.isArray(rawEntry)) {
            writeLine(socket, {
              kind: "error",
              code: "bad_request" as ControlErrorCode,
              message: "host_tool_stage: each files[] entry must be an object {tree, rel, byteLength}",
            });
            return;
          }
          const entry = rawEntry as Record<string, unknown>;
          const tree = entry.tree;
          const rel = entry.rel;
          const byteLength = entry.byteLength;
          if (typeof tree !== "number" || !Number.isSafeInteger(tree) || tree < 0 || typeof rel !== "string" || typeof byteLength !== "number") {
            writeLine(socket, {
              kind: "error",
              code: "bad_request" as ControlErrorCode,
              message: "host_tool_stage: each files[] entry must be {tree: non-negative integer, rel: string, byteLength: number}",
            });
            return;
          }
          files.push({ tree, rel, byteLength });
        }
        if (!opts.onHostToolStage) {
          writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "host_tool_stage is not wired on this broker" });
          return;
        }
        const stageOutcome = opts.onHostToolStage(files);
        if (!stageOutcome.ok) {
          writeLine(socket, { kind: "error", code: stageOutcome.code, message: stageOutcome.message });
          return;
        }
        hostToolRequestKey = stageOutcome.requestKey;
        writeHostToolLine(socket, {
          kind: "host_tool_staged",
          request: stageOutcome.requestKey,
          trees: stageOutcome.treeHandles,
          files: stageOutcome.fileHandles,
        });
        return;
      }

      if (req.op === "host_tool_run") {
        const presentedRequest = typeof req.request === "string" ? req.request : "";
        if (hostToolRequestKey === null || presentedRequest === "" || presentedRequest !== hostToolRequestKey) {
          writeLine(socket, {
            kind: "error",
            code: "denied" as ControlErrorCode,
            message: "host_tool_run: no matching host_tool_stage request is bound to this connection",
          });
          return;
        }
        if (!opts.onHostToolRun) {
          writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "host_tool_run is not wired on this broker" });
          return;
        }
        const boundRequestKey = hostToolRequestKey;
        opts
          .onHostToolRun(boundRequestKey, req)
          .then((result) => {
            if (!socket.destroyed) writeHostToolLine(socket, result);
          })
          .catch(() => {
            if (!socket.destroyed) {
              writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "host_tool_run threw" });
            }
          });
        return;
      }

      // Token check BEFORE any state is read or written, for every op
      // below -- absence or mismatch is refused, the connection is
      // destroyed, and nothing is allocated, spawned or signalled
      // (T-01.6.2-01, T-01.6.2-03). `attach` and `transfer` above no longer
      // reach this check (G-64-1, owner decision 5); every other op still
      // does, unchanged, until Phase 66 (RM-02) deletes broker.json, the
      // token's only distribution channel.
      const token = typeof req.token === "string" ? req.token : "";
      if (!tokensMatch(token, opts.token)) {
        writeLine(socket, { kind: "error", code: "unauthorized" as ControlErrorCode, message: "missing or invalid control token" });
        socket.destroy();
        return;
      }

      if (req.op === "acquire") {
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
        // Narrow BEFORE attemptAcquire, so a malformed profile never
        // reaches onAcquire and therefore never reaches the port allocator,
        // a spawn, or argv construction. A refusal also does NOT enqueue --
        // the request is answered and dropped, never retried on a later
        // drain pass with the same bad shape.
        const normalised = normaliseLaunchProfile(req.profile);
        if (!normalised.ok) {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: normalised.message });
          return;
        }
        const profile = normalised.profile;
        // A profile-is-stock-only refusal used to live here: it refused
        // `profile.warp`/`profile.headless` when this broker's resolved
        // backend had no `-warp`/`-console` route at all, so a caller
        // learned a knob would be silently ignored rather than getting a
        // confident grant with no effect. Now that the fork backend is
        // gone, there is one backend and it always has that route, so the
        // condition this refused can no longer occur -- deleted rather than
        // left as a check against a value that can never disagree.
        // Phase 63 (SESS-06): the label is sanitised HERE, once, before
        // either the immediate attempt or a later queued retry ever sees
        // it -- the SAME sanitiseSessionLabel() the `operation` op's own
        // declared name already goes through. An absent or hostile value
        // collapses to `null`, never fabricated.
        const label = sanitiseSessionLabel(req.label);
        void attemptAcquire(requestId, profile, label).then((settled) => {
          if (!settled) {
            enqueueAcquire(pendingAcquires, { requestId, attempt: () => attemptAcquire(requestId, profile, label) });
          }
        });
      } else if (req.op === "release") {
        if (requestIdForThisConnection) {
          const id = requestIdForThisConnection;
          requestIdForThisConnection = null;
          opts.onRelease(id);
        }
        writeLine(socket, { kind: "released" });
      } else if (req.op === "status") {
        writeLine(socket, { kind: "status", instances: opts.onStatus() });
      } else if (req.op === "host_state") {
        const hs = opts.onHostState();
        writeLine(socket, {
          kind: "host_state",
          pid: hs.pid,
          started_at: hs.startedAt,
          node_version: hs.nodeVersion,
          vice_bin: hs.viceBin,
          max_instances: hs.maxInstances,
          base_port: hs.basePort,
          backend: hs.backend,
        });
      } else if (req.op === "monitor_claim") {
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        if (targetId === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_claim requires target_id" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
          return;
        }
        const channel = resolveMonitorChannel(req.channel);
        if (channel === "bad_request") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: `monitor_claim: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
          });
          return;
        }
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("claim");
        const outcome = opts.onMonitorClaim(requestId, targetId, channel);
        if (outcome.ok) {
          writeLine(socket, { kind: "monitor_claimed", handle: outcome.handle });
        } else if (outcome.code === "monitor_owned") {
          // Ownership conflict, named by holder AND channel -- deliberately
          // worded to never suggest the emulator itself has stopped
          // answering.
          //
          // `holder` is REQUIRED by MonitorClaimOutcome for
          // this code, but this handler runs inside socket.on("data") with no
          // try/catch above it, so a producer that ever omitted it would throw a
          // TypeError out of the control listener and take the broker process
          // with it -- a type contract is not a runtime guarantee at a wire
          // boundary. The fallback names the holder as unknown rather than
          // fabricating one (matching what the container-side client now does
          // with a malformed holder payload), and defaults `channel` to the
          // channel THIS request asked for -- never a fabricated third value.
          const holder = outcome.holder ?? { grantId: "unknown", claimedAt: 0, pid: null, channel };
          writeLine(socket, {
            kind: "error",
            code: "monitor_owned",
            message: `instance already has a monitor client on the ${holder.channel} channel (grant ${holder.grantId}, claimed at ${holder.claimedAt}) -- this is an ownership conflict, not an emulator failure`,
            holder,
          });
        } else {
          writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_claim failed: ${outcome.code}` });
        }
      } else if (req.op === "monitor_release") {
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        if (targetId === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_release requires target_id" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
          return;
        }
        const channel = resolveMonitorChannel(req.channel);
        if (channel === "bad_request") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: `monitor_release: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
          });
          return;
        }
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("release-monitor");
        const outcome = opts.onMonitorRelease(requestId, targetId, channel);
        if (outcome.ok) {
          writeLine(socket, { kind: "monitor_released" });
        } else {
          writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_release refused: ${outcome.code}` });
        }
      } else if (req.op === "operation") {
        // Phase 63 (SESS-05). Dispatched on this connection's ORDINARY line
        // reader -- never touches relayMode, unlike `attach` above. Mirrors
        // monitor_claim's own dispatch skeleton: reject an empty target_id
        // by name, gate on the SAME per-connection ownsTarget() predicate
        // every other target-naming op uses (T-63-11), resolve the channel
        // through the existing resolver and refuse an unrecognised one by
        // name, then call the callback and branch on the discriminated
        // outcome.
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        if (targetId === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "operation requires target_id" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
          return;
        }
        const channel = resolveMonitorChannel(req.channel);
        if (channel === "bad_request") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: `operation: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
          });
          return;
        }
        // `name` must be exactly `null` (a clear) or a string (sanitised
        // below) -- anything else (absent, a number, an object) is refused
        // BY NAME rather than silently treated as either case.
        if (req.name !== null && typeof req.name !== "string") {
          writeLine(socket, {
            kind: "error",
            code: "bad_request" as ControlErrorCode,
            message: `operation: "name" must be a string or null (got ${JSON.stringify(req.name)})`,
          });
          return;
        }
        // T-63-10: a string name is run through the ONE sanitiser BEFORE
        // handleOperationNote() ever sees it -- this callback never
        // observes an unsanitised value. `null` passes through verbatim
        // (a clear, not a value to sanitise).
        const sanitisedName = req.name === null ? null : sanitiseSessionLabel(req.name);
        const outcome = opts.onOperation(targetId, channel, sanitisedName);
        if (outcome.ok) {
          writeLine(socket, { kind: "operation_noted" });
        } else {
          writeLine(socket, { kind: "error", code: outcome.code, message: `operation failed: ${outcome.code}` });
        }
      } else if (req.op === "stage_file") {
        // Phase 64 (XFER-04, D-01). Gated on the SAME ownsTarget() predicate
        // monitor_claim/monitor_release/operation already share --
        // dispatched on this connection's ORDINARY line reader; never
        // touches relayMode.
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        const slot = typeof req.slot === "string" ? req.slot : "";
        if (targetId === "" || slot === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "stage_file requires target_id and slot" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, {
            kind: "error",
            code: "denied" as ControlErrorCode,
            message: "stage_file may only target the grant this connection itself holds",
          });
          return;
        }
        // onStageFile is OPTIONAL on StartControlListenerOptions -- see that
        // field's own header comment for why (vice-broker.mts does not wire
        // it until plan 64-03). A type contract is not a runtime guarantee
        // at a wire boundary: refused BY NAME here rather than calling
        // `undefined` and crashing this socket's "data" handler.
        if (!opts.onStageFile) {
          writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "stage_file is not wired on this broker" });
          return;
        }
        const stageOutcome = opts.onStageFile(targetId, slot);
        if (stageOutcome.ok) {
          writeLine(socket, { kind: "file_staged", handle: stageOutcome.handle, emulator_filename: stageOutcome.emulatorFilename });
        } else {
          writeLine(socket, { kind: "error", code: stageOutcome.code, message: `stage_file failed: ${stageOutcome.code}` });
        }
      } else {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: `unknown op: ${String(req.op)}` });
      }
    }
  });
}

/** Starts the TCP control listener: binds (bindControlListener()), then
 * attaches the full newline-delimited-JSON protocol (attachControlProtocol()
 * above) -- all five request kinds, the token gate, and the arrival-ordered
 * pending-acquire queue this listener instance owns. Frames inbound bytes as
 * newline-delimited JSON: buffers, splits on "\n", parses each line with
 * the never-throw posture this codebase already uses for untrusted input --
 * a malformed line answers `bad_request` and the connection survives. A
 * connection exceeding MAX_LINE_BYTES without a newline is destroyed rather
 * than buffered further (T-01.6.2-04). */
export function startControlListener(opts: StartControlListenerOptions): Promise<StartControlListenerResult> {
  // No wildcard fallback (D-09/D-11): an explicitly-set control-host
  // environment variable is honoured as an operator's own choice; when
  // neither opts.host nor the environment variable names one, the caller
  // must supply a host -- this never silently substitutes "0.0.0.0". A
  // production caller wanting the enumerated multi-address bind should use
  // enumerateBindHosts()/startControlListenerOnHosts() below instead of
  // this single-host primitive.
  const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST;
  if (!host) {
    return Promise.reject(
      new Error(
        "startControlListener: no host resolved -- opts.host is unset and VICE_BROKER_CONTROL_HOST is unset; " +
          "the caller must supply a host explicitly (no wildcard fallback, D-09)",
      ),
    );
  }
  const port = resolveControlPort(opts.port);

  return bindControlListener(host, port).then((bound) => {
    const pendingAcquires: PendingAcquireQueue = [];
    attachControlProtocol(bound.server, opts, pendingAcquires);
    return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
  });
}

/** A per-host bind failure surfaced to the caller, never swallowed -- the
 * caller (vice-broker.mts's startup path, not this function) decides which
 * failures are fatal: loopback failing is always fatal (D-09), a specific
 * bridge address failing is logged and the broker continues on the reduced
 * set. `error` is whatever bindControlListener()'s own reject produced
 * (typically a NodeJS.ErrnoException with `.code === "EADDRINUSE"`). */
export interface HostBindFailure {
  host: string;
  error: Error;
}

export interface StartControlListenerOnHostsResult {
  /** One entry per SUCCESSFULLY bound host. Every entry's `pendingAcquires`
   * is the SAME array reference -- see this function's own header comment
   * for why a per-host queue would silently fork acquire fairness. */
  listeners: StartControlListenerResult[];
  /** Every host that failed to bind, in Promise.all's own settle order.
   * Empty when every host bound successfully. */
  failures: HostBindFailure[];
  /** The one shared queue every bound listener above was attached with --
   * exposed again here (redundant with each listener's own
   * `pendingAcquires` field) purely for a caller that wants it without
   * reaching into `listeners[0]`. */
  pendingAcquires: PendingAcquireQueue;
}

/** BROKER-03: binds the control protocol on EVERY host in `hosts`, sharing
 * exactly ONE pending-acquire queue across all of them -- never one call to
 * startControlListener() per host, which would allocate N independent
 * queues and silently fork acquire fairness into per-listener silos (a
 * request queued via one bound address would never drain when a slot freed
 * on another; see Pitfall 2 in 62-RESEARCH.md). Resolves the port ONCE
 * (shared by every host, exactly like startControlListener() resolves it
 * once for its single host), allocates the one shared queue, then calls
 * the lower-level bindControlListener()/attachControlProtocol() pair once
 * per host -- never startControlListener() itself, which stays untouched
 * and unlooped. A per-host bind failure is captured in `failures` rather
 * than rejecting the whole call or being silently dropped -- this function
 * makes no fatality judgement of its own; that decision belongs to the
 * caller, which alone knows whether the failing host was loopback (always
 * fatal, D-09) or a bridge address (never fatal on its own). */
export function startControlListenerOnHosts(hosts: string[], opts: StartControlListenerOptions): Promise<StartControlListenerOnHostsResult> {
  const port = resolveControlPort(opts.port);
  const pendingAcquires: PendingAcquireQueue = [];

  return Promise.all(
    hosts.map(
      (host): Promise<{ ok: true; listener: StartControlListenerResult } | { ok: false; failure: HostBindFailure }> =>
        bindControlListener(host, port)
          .then((bound) => {
            attachControlProtocol(bound.server, opts, pendingAcquires);
            return { ok: true as const, listener: { server: bound.server, port: bound.port, host: bound.host, pendingAcquires } };
          })
          .catch((error: unknown) => ({
            ok: false as const,
            failure: { host, error: error instanceof Error ? error : new Error(String(error)) },
          })),
    ),
  ).then((outcomes) => {
    const listeners: StartControlListenerResult[] = [];
    const failures: HostBindFailure[] = [];
    for (const outcome of outcomes) {
      if (outcome.ok) listeners.push(outcome.listener);
      else failures.push(outcome.failure);
    }
    return { listeners, failures, pendingAcquires };
  });
}
