// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from vice-broker.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// vice-broker.mts
//
// The long-lived host broker entry point: one per machine, on the fixed
// control port. It binds the control listener (loopback plus the enumerated
// bridge gateways, never the wildcard address), serves acquire/release over
// that one endpoint, and launches and supervises the emulator instances it
// grants. Clients find it by dialling the port and completing a `hello`;
// nothing is written to disk for them to read.
//
// Imports node: builtins ONLY plus this phase's own sibling modules --
// mcp__vice__* stays the only route to the emulator; nothing here opens a
// connection to it.
import { mkdirSync, openSync, existsSync } from "node:fs";
import { join, basename, relative, resolve as resolvePath } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn as nodeSpawn } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { containerGuardReport, containerGuardEnforce } from "./container-guard.mjs";
// countReady/countTotal/countLaunching are DROPPED from this import -- they
// were used only as maintainWarmFloorForRealBroker()'s own deps for the
// now-retired maintainWarmFloor() (the warm floor itself was retired once
// the connection became the lease, with no separate expiry left to
// maintain), passed through by shorthand property (`countReady,` etc.),
// never called directly in this file. atCapacity() is the one survivor
// actually called here (its own cold-launch-arm gate, below).
import { createBrokerState, nextFreePort, atCapacity, resolveBasePort, clearMonitorClient, MONITOR_CHANNELS, } from "./broker-state.mjs";
import { acquirePortAndLaunch, deleteInstanceRecord, 
// Replaces maintainWarmFloor -- the warm floor itself is retired (the
// connection is the lease now, so there is no separate floor left to
// keep warm); this is ONLY the launching -> ready promotion sweep the
// floor used to carry as its own step 1.
promoteLaunchingInstances, probeReady, runBrokerPass, withCrashSupervision, 
// The ONE owner of the binmon host precedence (Phase 63, SESS-02) --
// the argv builder's own resolution and this file's relay-dial resolution
// below both go through this single function, never a second literal.
resolveBinmonHost, } from "./broker-launch.mjs";
// A VALUE import of the splice primitive (Phase 63, SESS-02) -- safe here
// for the SAME reason every other sibling value import in this file is:
// this file is ALWAYS run from its own compiled resources/ form, and
// "./broker-relay.mjs" is compiled into that same directory by the same
// build.ts pass (both source and target are listed in
// HOST_BOUND_ARTIFACTS/tsconfig.build.json's include[] in this same
// change).
import { spliceRelay, resolveRelayChannelTarget, relaySessionKey, resolveRelayIdleMs, resolveRelayKeepAliveMs, dialEmulatorLeg, buildEmulatorUnreachableMessage, DEFAULT_RELAY_DIAL_DEADLINE_MS, DEFAULT_RELAY_DIAL_RETRY_MS, } from "./broker-relay.mjs";
// A VALUE import of the broker's own incident writer (Phase 63, SESS-05) --
// safe here for the SAME reason every other sibling value import in this
// file is: this file is ALWAYS run from its own compiled resources/ form,
// and "./broker-incident.mjs" is compiled into that same directory by the
// same build.ts pass (both source and target are already listed in
// HOST_BOUND_ARTIFACTS). handleRelayDeath() below is this module's one and
// only production call site -- see that function's own header comment.
import { writeBrokerIncident } from "./broker-incident.mjs";
// resolvedBackend() resolves the emulator binary's identity -- ViceBackend's
// own definition lives in backend-detect.mts too (narrowed to a single
// literal now that the fork backend has been removed entirely), so
// broker-launch.mjs's own (type-only) re-import of it and this file's VALUE
// import both name the same one home. A real value import is safe here
// (unlike inside
// broker-launch.mts) because vice-broker.mts is ALWAYS run from its own
// compiled resources/ form -- both modules are compiled together in the
// same build.ts pass, so "./backend-detect.mjs" always exists as a real
// sibling file by the time this import resolves.
import { resolvedBackend } from "./backend-detect.mjs";
import { verifiedKill, registerShutdownHandlers, startupBanner, reapOrphanedInstances, reapOrphanedConfigScratch, sweepOrphanedStaging, } from "./broker-kill.mjs";
import { writeEpochRecord, epochPathFor, nextEpochFor, instanceLogDirFor } from "./broker-epoch.mjs";
// A VALUE import of the host-tool executor -- safe here for the SAME reason
// every other sibling value import above is:
// this file is ALWAYS run from its own compiled resources/ form, and
// "./host-tool.mjs" is compiled into that same directory by the same build.ts
// pass (host-tool.mts is added to HOST_BOUND_ARTIFACTS/tsconfig.build.json's
// include[] in this same commit).
import { runHostTool, bindStagedInputs } from "./host-tool.mjs";
import { startControlListenerOnHosts, enumerateBindHosts, drainPendingAcquires, resolveControlPort, } from "./broker-control.mjs";
// A VALUE import of the machine-level state resolver (plan 62-02) -- safe
// here for the SAME reason every other sibling value import above is: this
// file is ALWAYS run from its own compiled resources/ form, and
// "./broker-home.mjs" is compiled into that same directory by the same
// build.ts pass (both source and target are already listed in
// HOST_BOUND_ARTIFACTS/tsconfig.build.json's include[]). This is the
// FOURTH, LOWEST-precedence step in parseArgs()'s state-directory chain
// below -- it answers only when no explicit --state-dir, no VICE_POOL_DIR,
// and no --repo-root apply, which is exactly BROKER-01/BROKER-06's "no
// project argument at all" case (D-13).
import { brokerStateDir, brokerConfigScratchDir, brokerStagingDir, brokerGhidraDir } from "./broker-home.mjs";
// The endpoint dialler, for the hello probe that arbitrates a busy control port.
import { dialBrokerEndpoint, describeDialFailure } from "./broker-endpoint.mjs";
// A VALUE import of the staging/transfer primitives (Phase 64, plan 64-03,
// XFER-04/XFER-07) -- safe here for the SAME reason every other sibling
// value import above is: this file is ALWAYS run from its own compiled
// resources/ form, and "./broker-transfer.mjs" is compiled into that same
// directory by the same build.ts pass (both source and target are already
// listed in HOST_BOUND_ARTIFACTS, since plan 64-01). handleStageFile() and
// handleFileTransfer() below are this module's own callers; neither
// re-implements the directory layout, the handle minting or the byte
// movement broker-transfer.mts already owns.
import { stageFileSlot, resolveStagedFile, markTransferInFlight, clearTransferInFlight, clearStagingForSession, sendPayloadFromFile, receivePayloadToFile, stageHostToolRequest, listHostToolUploads, registerHostToolResult, resolveHostToolTree, } from "./broker-transfer.mjs";
const USAGE = "usage: vice-broker.mjs [--repo-root <path>] [--state-dir <path>] [--check-container] [--dry-run]";
/** `--repo-root` is now OPTIONAL (BROKER-01/BROKER-06, D-13): the per-project
 * binding it used to enforce is exactly what a machine-level broker removes,
 * and `--check-container` never needed it either. A genuinely malformed
 * invocation -- an unrecognised token, or a flag that takes a value with
 * none following it -- still throws USAGE; only the "no project was named"
 * case no longer does.
 *
 * `--repo-root` NO LONGER SELECTS A STATE DIRECTORY (Phase 64, plan 64-10,
 * G-64-1's secondary cause): it used to join `.c64-re-tools/supervisor`
 * onto whatever project was named, and `vice-launcher.sh` always passes
 * `--repo-root`, so that pin was silently pulling broker state into one
 * project's tree on the ONE route that used it -- exactly what BROKER-06
 * forbids -- while the documented start route (`npx -y
 * @henols/vice-mcp broker`, which passes no `--repo-root`) wrote to the
 * machine-level root instead.
 * The client read the machine-level root unconditionally, so only the
 * launcher route ever agreed with it. `--repo-root` is still parsed and
 * still returned on `ParsedArgs.repoRoot` -- it keeps anchoring the Ghidra
 * runs handle and `run()`'s once-per-process emulator-binary lookup below;
 * only its state-directory meaning is gone.
 *
 * `--state-dir` now resolves through a TWO-step chain: (1) an explicit
 * `--state-dir` argument; (2) `broker-home.mts`'s `brokerStateDir()`, which
 * itself honours `VICE_POOL_DIR` first, then `VICE_SUPERVISOR_DIR`, then
 * `VICE_BROKER_HOME`, then the machine-level default
 * (`~/.c64-re-tools/supervisor`). Because step 2 now does the env-var
 * reading this function used to do directly, one behavioural edge follows:
 * an empty-string `VICE_POOL_DIR` is now treated as unset (`brokerStateDir()`
 * uses `||`, not `??`), where the old three-step chain here used `??` and
 * would have kept an empty string. This module is host-bound and compiled by
 * `build.ts`, so it must not import the container-side `repo-root.ts`. */
export function parseArgs(argv) {
    let repoRoot = null;
    let stateDir = null;
    let checkContainer = false;
    let dryRun = false;
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === "--repo-root") {
            if (argv[i + 1] === undefined)
                throw new Error(USAGE);
            repoRoot = argv[i + 1];
            i++;
        }
        else if (argv[i] === "--state-dir") {
            if (argv[i + 1] === undefined)
                throw new Error(USAGE);
            stateDir = argv[i + 1];
            i++;
        }
        else if (argv[i] === "--check-container") {
            checkContainer = true;
        }
        else if (argv[i] === "--dry-run") {
            dryRun = true;
        }
        else {
            // An unrecognised token -- the ONLY remaining reason to refuse. Missing
            // --repo-root is no longer one (D-13): a genuinely malformed
            // invocation still refuses, "no project was named" no longer does.
            throw new Error(USAGE);
        }
    }
    const resolvedStateDir = stateDir ?? brokerStateDir();
    return { repoRoot: repoRoot ?? "", stateDir: resolvedStateDir, checkContainer, dryRun };
}
// ---------------------------------------------------------------------------
// Small, locally-duplicated env-var reader (plan 05) -- the SAME pattern
// broker-kill.mts's own resolveBasePortForReap()/resolveViceBinForReap()
// already established: this module cannot import broker-launch.mts's
// PRIVATE resolveCeiling() (it is not exported, and this file is already
// the top-level wiring module value-importing every sibling .mjs directly --
// exporting it would widen broker-launch.mts's own surface for a one-line
// env-var read this file can duplicate exactly as cheaply). Mirrors
// broker-launch.mts's own default precisely (VICE_BROKER_MAX/16) so
// host_state's own answer can never disagree with what atCapacity() itself
// actually enforces. This used to be a PAIR
// with resolveWarmFloorForRecord() (VICE_BROKER_WARM_FLOOR/1), kept in
// lockstep with broker-launch.mts's own matching pair so the two numbers
// could never disagree. The warm-floor half of that pair is RETIRED along
// with the floor itself -- the
// ceiling's own default (16) is untouched, since it is a separate concern
// (VICE_BROKER_MAX / atCapacity()) this plan does not touch.
// ---------------------------------------------------------------------------
function resolveCeilingForRecord() {
    const raw = process.env.VICE_BROKER_MAX;
    if (raw === undefined || raw === "")
        return 16;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 16;
}
/** Classifies a bare hostname as a wildcard bind address, in the IPv4 and
 * IPv6 "listen on everything" spellings this project cares about --
 * DELIBERATELY RE-STATED here rather than imported from
 * vice-broker-client.ts's own `isWildcardBindHost()`: that module is
 * container-side and this one is host-bound, compiled away from it. Used ONLY to refuse an explicitly-set
 * VICE_BROKER_CONTROL_HOST value before ever attempting to bind it (D-09) --
 * never applied to an enumerated host, which can never be a wildcard by
 * construction. */
function isWildcardBindHostLocal(host) {
    const bare = host.replace(/^\[/, "").replace(/\]$/, "");
    return bare === "0.0.0.0" || bare === "::" || /^(0{1,4}:){7}0{1,4}$/.test(bare);
}
/** Builds a spawn function that redirects the child's stdout/stderr into a
 * FRESH per-launch log file under logDir (so per-instance boot/crash logs
 * survive under .c64-re-tools/supervisor/<port>/logs/, same paths, same
 * format as the retiring bash supervisor), returning both the spawn
 * closure and the log's path relative to supervisorDir (the epoch
 * record's own `log` field). Shared by both launch paths -- a cold
 * acquire and warm-floor maintenance -- so there is exactly one place that
 * opens a launch log fd.
 *
 * The returned `spawn` now also forwards a caller options object, MERGING
 * it into the object handed to nodeSpawn() -- caller options spread FIRST,
 * `stdio` set LAST, so the launch log fd always wins over any
 * caller-supplied `stdio`. Merging in the other order would silently
 * redirect a launch's output away from the per-instance log file the
 * epoch record names, breaking the per-instance forensic logs while
 * appearing to work.
 *
 * `viceBin` (Phase 60, LOC-02) names the ALREADY-resolved binary this launch
 * is about to spawn -- the log filename's own stem, via `basename()`, rather
 * than a fresh read of the emulator environment variable on its own.
 * Optional, defaulting to the literal "x64sc" for a caller (a test) that
 * supplies neither this nor a real resolution up its own call chain, so the
 * filename shape is unchanged for it. */
function makeLoggingSpawn(logDir, viceBin) {
    mkdirSync(logDir, { recursive: true });
    const viceBinForLog = basename(viceBin ?? "x64sc");
    const logName = `${viceBinForLog}-${Date.now()}.log`;
    const logFd = openSync(join(logDir, logName), "a");
    return {
        spawn: (cmd, cmdArgs, options) => nodeSpawn(cmd, cmdArgs, { ...options, stdio: ["ignore", logFd, logFd] }),
        logRelPath: `logs/${logName}`,
    };
}
/** Writes the epoch record for a just-launched instance -- shared by both
 * launch paths so the epoch record's own contract (format, location,
 * atomic-write discipline, all unchanged -- only the writer moves) is
 * discharged from
 * exactly one place regardless of WHY the instance was launched. A
 * granted instance and a still-warm instance are equally real processes; both
 * need a real epoch.json the moment they exist, or plan 04's grant-time
 * re-probe (which reads a warm instance's recorded epoch_file, per
 * grant_from_spare()'s bash original) would carry forward a path to
 * nothing. */
function writeEpochForLaunch(record, logRelPath) {
    const epochRecord = {
        epoch: 1,
        spawned_at: new Date(record.launchedAt).toISOString(),
        pid: record.pid,
        supervisor_pid: process.pid,
        vice_bin: record.viceBin,
        vice_args: record.viceArgs,
        log: logRelPath,
        dry_run: false,
    };
    writeEpochRecord({ supervisorDir: record.supervisorDir, record: epochRecord });
    // The in-memory record's own epoch field must carry the SAME value the
    // epoch record was just written with -- without this, every
    // first-generation instance reports an absent epoch to the status
    // response, making a later respawn's advance unobservable at the one
    // place a caller reads it (handleStatus()).
    record.epoch = epochRecord.epoch;
}
/** Builds the supervision dependency object for withCrashSupervision(),
 * once per launch, so the real launch path (handleAcquire's own cold arm,
 * here -- the second real launch path this comment used to name, the warm
 * floor, was retired once the connection became the lease) passes a
 * structurally identical SuperviseChildDeps object into the shared wrapper.
 * Deliberately does NOT set spawnFactory: on a respawn, launchSupervised()
 * (broker-launch.mts) derives its own per-instance log path from
 * instanceLogDirFor and names that same path in the epoch record it writes
 * -- supplying a competing spawn factory here would produce two log files
 * per respawn with the epoch record naming the wrong one. Leaving it unset
 * means a respawn's output lands in the supervision module's own log file
 * under the same per-instance logs directory the epoch record already
 * requires, and the epoch record names the file that actually received the
 * output.
 *
 * `backend` is a REQUIRED positional parameter, not an
 * optional field a call site may quietly omit. Before this, both real call
 * sites built their deps here WITHOUT it, so `spawnAndRecordInstance()`'s own
 * unset-parameter default silently took over the moment crash supervision
 * replaced an instance -- a stock instance's crash-respawn could relaunch it with a different backend's argv shape than the one it
 * was actually launched with, leaving a pool member that can never be
 * reached over the binary monitor again while still counting toward
 * countReady()/countTotal(). Making it positional and required is what makes
 * that omission a compile error rather than a silent backend swap: the FIRST
 * launch and every REPLACEMENT of it now build their argv from the SAME
 * resolved verdict. `binmonHost` is threaded for the same reason, one step
 * ahead of need -- no broker call site configures a stock bind override today
 * (acquirePortAndLaunch()'s own `binmonHost` is likewise unset), so it is
 * always `undefined` in production right now; the parameter exists so that
 * adding one later cannot reintroduce exactly this divergence between a
 * launch's argv and its respawn's argv. */
/** Phase 60 (LOC-01/LOC-02): `viceBin` is now a REQUIRED-in-spirit fourth
 * argument (kept optional only for source compatibility with a caller that
 * has none to give) -- before this plan, a crash respawn's own
 * SuperviseChildDeps.viceBin was silently left unset here, and
 * broker-launch.mts's own launchSupervised() covered the gap by falling
 * through to a fresh read of the emulator environment variable. That fallback is gone (see
 * broker-launch.mts's own header for why); leaving this builder unchanged
 * would have made a crash-respawned instance silently spawn the bare
 * "x64sc" literal instead of the SAME binary a tools.json entry or
 * VICE_BIN resolved for the launch it replaces -- exactly the
 * disagreement LOC-02 exists to remove. */
function superviseDepsFor(stateDir, state, backend, viceBin, binmonHost) {
    return {
        state,
        stateDir,
        epoch: { epochPathFor, instanceLogDirFor, nextEpochFor, writeEpochRecord },
        log: (line) => process.stderr.write(`${line}\n`),
        backend,
        viceBin,
        binmonHost,
    };
}
/** Exported ONLY so a test can install withCrashSupervision() through the
 * REAL deps object this module actually uses in production, rather than a
 * hand-built SuperviseChildDeps that can (and did) diverge from it -- the
 * exact blind spot the backend-argv bug above lived in: broker-launch.test.ts's
 * own respawn tests each construct their deps inline and therefore pass
 * `backend: "stock"` directly, so the production builder's missing field was
 * invisible to the whole suite. Same discipline as broker-kill.mts's
 * `_HANDLED_SIGNALS`: an underscore-prefixed alias, never called by any
 * production code path in this module. */
export const _superviseDepsFor = superviseDepsFor;
/** Sets the deliberate-death marker. Called BEFORE any signal reaches the
 * target child, never after: the exit handler (broker-launch.mts) runs on
 * the child's OWN exit event, so a marker set after the signal arrives too
 * late to be read (T-01.6.2-84). */
function markDeliberateDeath(instance) {
    instance.deliberateKill = true;
}
// ---------------------------------------------------------------------------
// THE WARM-INSTANCE PROFILE-ELIGIBILITY RULE.
//
// THE DECISION, stated out loud because two of the three available answers
// are wrong in ways the CALLER CANNOT DETECT:
//   - Refuse the acquire outright when a mismatched warm instance exists ->
//     warp becomes unusable whenever a warm floor exists (the default is 1,
//     so: essentially always).
//   - Serve the request with the mismatched instance -> the caller asked for
//     warp, got an unwarped machine, and received a confident grant. The knob
//     is a lie and nothing in the response says so.
//   - What this implements: the mismatched instance is INELIGIBLE. The
//     walk skips it and the acquire falls through to the cold arm, which
//     launches a DEDICATED instance for that grant.
//
// WHAT MUST NEVER BE ADDED HERE: a retro-warp, and a kill-then-relaunch of a
// mismatched warm instance. There is no runtime `WarpMode` resource on stock
// at all (vsync.c:220-241, deliberately), so an existing instance cannot be
// adjusted -- it can only be ineligible. And "killing or relaunching
// preemptively to serve a newer request" is a NAMED anti-pattern in this
// project (CLAUDE.md): it would make an interactive session's emulator vanish
// because some capture run asked for warp. A test asserts the kill dependency
// is not called and the instance stays `ready`.
// ---------------------------------------------------------------------------
/** True when `record` was launched with the SAME profile `requested` asks
 * for. FULLY SYNCHRONOUS by requirement, not by convenience -- see the call
 * site inside selectWarmInstance() below for why.
 *
 * Absent is `{}`: a record with no `profile` field (a pre-33-06 record, a
 * fork launch, a warm-floor spare, or a record a broker restarted mid-phase
 * read from a state directory written before the field existed) is compared
 * as though it carried `{}`, and so is an absent request. Each knob is
 * compared `=== true` on BOTH sides, so `undefined` and `false` are the same
 * request -- which is what makes an absent profile, an explicit `{}` and
 * `{warp:false, headless:false}` one single behaviour rather than three. */
export function profileEligible(record, requested) {
    const have = record.profile ?? {};
    const want = requested ?? {};
    return (have.warp === true) === (want.warp === true) && (have.headless === true) === (want.headless === true);
}
/** Walks `state.instances` for probe-live `ready` candidates, in iteration
 * order, and returns the first that answers a grant-time re-probe (P-02) --
 * or `null` once every candidate has been tried and none answered, letting
 * the caller fall through to a cold launch. Regardless of `record.reason`:
 * a waiting request takes an instance whichever reason booted it, so a
 * warm-floor instance and a not-yet-granted instance are equally eligible.
 * Kill-never-recycle needs no separate guard here --
 * handleRelease() below already deletes a released instance's record
 * outright, so a released instance is structurally absent from
 * `state.instances` and can never be a candidate.
 *
 * A candidate whose grant-time probe FAILS is dropped -- de-registered from
 * `state.instances` -- and identity-verified-killed BEFORE the walk
 * continues to the next candidate, but the kill itself is deliberately
 * fire-and-forget, matching handleRelease()'s own posture a few hundred
 * lines below (`verifiedKill(...).catch(...)`, never awaited by that call
 * site either): the acquiring request must not wait up to
 * `VICE_BROKER_KILL_WAIT_S` (default 5s) of SIGTERM-then-poll-then-SIGKILL
 * PER DEAD CANDIDATE before the walk can move on -- that wait is exactly
 * what turns a warm floor's fast, in-memory grant into a multi-second
 * serial teardown on a single request's hot path once the warm floor is
 * configured above its default of 1. The drop -- `markDeliberateDeath()`
 * plus `state.instances.delete()` -- still happens SYNCHRONOUSLY, in the
 * same tick as the probe failure, before `deps.kill(...)` is even invoked;
 * only the kill's own SETTLEMENT is decoupled from this walk. This matches
 * an idiom the file already uses elsewhere rather than inventing a new
 * bound, and removes the wait entirely rather than merely capping it, by
 * design: capping how many failed candidates a single acquire will wait
 * through was the alternative considered and rejected. The grant-time-probe-failure
 * log line's own ordering is decoupled accordingly (see below) -- it can no
 * longer name the kill's resolved stage synchronously, since nothing here
 * waits for it to resolve. The marker is set BEFORE any signal reaches the
 * child (markDeliberateDeath()'s own contract), with a FALSE
 * respawn-after-kill answer -- this arm never wants a replacement on the
 * SAME port; a replacement, if any, comes from either the next candidate in
 * this same walk or the caller's own cold-launch fall-through.
 *
 * Re-checks `record.state === "ready"` AND map membership by identity
 * immediately after every `await` (the probe call itself) and BEFORE ever
 * treating a probe-live candidate as the winner -- this is what makes the
 * caller's own "no await between selection and the grant-recording step"
 * property actually hold under two concurrent acquires. A candidate's own
 * probe response cannot change because a sibling acquire granted it first,
 * but its RECORDED state does, the instant that sibling's synchronous grant
 * step runs -- recorded state alone catches that case. It does NOT catch a
 * sibling that has already DROPPED this exact candidate (a failed
 * grant-time probe: markDeliberateDeath() + state.instances.delete(), which
 * never touches record.state -- the drop path a few lines below) -- a
 * state-only recheck is blind to a concurrent drop, letting a second
 * caller's stale object reference win a grant for a record that is no
 * longer in state.instances at all, orphaning the grant. Rechecking
 * `state.instances.get(record.port) === record` (identity, not merely a
 * port-number lookup) closes that case too. */
async function selectWarmInstance(state, deps) {
    for (const record of Array.from(state.instances.values())) {
        if (record.state !== "ready")
            continue;
        // A SYNCHRONOUS `continue`, sitting
        // immediately beside the `record.state !== "ready"` filter directly
        // above and BEFORE the readiness probe below. That placement is
        // load-bearing twice over, and neither reason is stylistic:
        //
        //   1. It introduces NO new `await` into the region the single-owner
        //      `inFlight` launch guard protects. That guard exists because of the
        //      2026-08-01 triple-launch outage and must stay a synchronous
        //      check-and-set with no `await` between (CLAUDE.md, regression-
        //      tested). A filter placed after the probe would put a fresh
        //      suspension point inside that region -- which is why this plan
        //      verifies the placement by line-number comparison, not by comment.
        //   2. An ineligible candidate costs no probe at all -- no socket, no
        //      round trip, no wait.
        //
        // An ineligible miss falls through EXACTLY as a "no warm instance" miss
        // does: to the caller's own cold arm, which records the one and only
        // grant. It opens no second `state.grants.set()` call, and it never
        // kills or re-warps the mismatched instance (see
        // profileEligible()'s own banner for why those are excluded by design).
        if (!profileEligible(record, deps.requestedProfile))
            continue;
        const isReady = await deps.probe(record.port);
        // A sibling acquire may have granted OR dropped this exact candidate
        // while this probe was in flight. "Granted" changes record.state;
        // "dropped" removes the record from state.instances outright and never
        // touches record.state -- so map membership must be rechecked too, not
        // merely the state field.
        if (record.state !== "ready" || state.instances.get(record.port) !== record) {
            continue;
        }
        if (isReady) {
            return record;
        }
        // Drop and de-register FIRST, synchronously, before the kill is even
        // invoked -- this is what the identity recheck above depends on: the
        // record must already be gone from state.instances by the time a
        // concurrent sibling's own probe on this same candidate resolves. The
        // fire-and-forget kill below only changes what happens to the kill's
        // own PROMISE next, never this ordering.
        markDeliberateDeath(record);
        // Dropping a record is also where its second
        // (`-remotemonitor`) port stops being spoken for -- deleteInstanceRecord()
        // is the ONE place both mutations happen together, so a drop can never
        // leak a port out of the fixed allocation band.
        deleteInstanceRecord(state, record.port);
        // Distinct wording from shutdown()'s own "shutdown complete" line
        // (broker-kill.mts) -- the standing constraint that a lifecycle decision must be
        // reconstructable from the log after an incident (both 2026-08-01 and
        // 2026-08-02 were diagnosed from broker log lines). Logged BEFORE the
        // kill settles: the walk does not wait for deps.kill(...) to
        // resolve, so this line can no longer name the kill's resolved stage --
        // that gets its own, separately-logged line once the kill settles,
        // below.
        deps.log(`vice-broker: grant-time probe failed for port ${record.port} (pid ${record.pid ?? "null"}) -- dropped the record and kicked off an identity-verified kill of the pid (not awaited by the acquire walk)`);
        // Fire-and-forget, matching handleRelease()'s own posture
        // (`verifiedKill(...).catch(...)`, a few hundred lines below in this
        // same file) -- the acquire walk moves on to the next candidate (or
        // returns null to the cold-launch fall-through) without waiting up to
        // VICE_BROKER_KILL_WAIT_S per dead candidate. Still identity-verified:
        // this is the SAME deps.kill, never replaced by a bare, unverified
        // signal. The settlement is only OBSERVED asynchronously, via its own
        // log line, never awaited.
        void deps
            .kill({ pid: record.pid, expectedIdentity: record.expectedIdentity })
            .then((killStage) => {
            deps.log(`vice-broker: grant-time-probe-failure kill for port ${record.port} (pid ${record.pid ?? "null"}) settled (kill stage: ${killStage})`);
        })
            .catch(() => {
            // best-effort; nothing further to report on this path, matching
            // handleRelease()'s own posture at its own verifiedKill(...).catch(...) call site.
        });
    }
    return null;
}
/** Resolves a GRANTABLE instance -- a cold launch is one of two ways of
 * obtaining one, not the only one (this task's own assumption-delta
 * decision: "resolve a grantable instance" is now the primary operation).
 * The warm-instance selection arm (selectWarmInstance(), P-01) runs BEFORE
 * the cold-launch arm; `atCapacity()` gates ONLY the cold-launch arm --
 * checked only once selectWarmInstance() has already answered `null` (no
 * probe-live candidate available) -- NOT before either arm. A full host
 * still refuses a fresh cold launch before
 * ever touching the port allocator, but a ready, probe-live warm candidate
 * is grantable even when the ceiling is already reached: granting it
 * creates no NEW instance and does not raise `countTotal()`, so refusing to
 * hand out an already-existing idle one was a real availability bug, not a
 * correct interpretation of the ceiling's own purpose (bounding concurrent
 * emulator *processes*, not bounding how many of those processes may be
 * *handed out*). Both arms converge on exactly ONE `state.grants.set()`
 * call -- load-bearing for task 2's structural anti-regression gate, which
 * counts it -- fed by whichever arm produced a record. Answers the full
 * discriminated AcquireOutcome (plan 05): `at_capacity` when the ceiling is
 * already reached AND no warm candidate could be served,
 * `no_free_port`/`launch_in_flight` passed straight through from
 * acquirePortAndLaunch()'s own typed failure (the cold arm only), and
 * `internal` only for a genuine, otherwise-unclassified fault. A
 * `launch_in_flight` outcome is NOT a control-plane error -- broker-
 * control.mts's own attemptAcquire()/enqueueAcquire() queue the request and
 * retry it later rather than refusing it. */
export async function handleAcquire(requestId, stateDir, state, deps = {}) {
    // The readiness probe is backend-aware, from the SAME threaded-down
    // verdict handleAcquire already uses for buildViceArgs() -- on stock the port
    // speaks the binary monitor, so an HTTP POST there can never succeed.
    const backend = deps.backend ?? "stock";
    // Same threaded-down-once discipline as `backend` immediately above --
    // this function never resolves it itself. See HandleAcquireDeps.viceBin's
    // own doc comment.
    const viceBin = deps.viceBin;
    const probe = deps.probe ?? ((port) => probeReady(port, { backend }));
    // Textually a verifiedKill( call site, not merely a reference -- reused
    // UNCHANGED from broker-kill.mts, never re-derived, and never replaced by
    // a bare process.kill().
    const kill = deps.kill ?? ((opts) => verifiedKill(opts));
    const log = deps.log ?? ((line) => process.stderr.write(`${line}\n`));
    const winner = await selectWarmInstance(state, { probe, kill, log, requestedProfile: deps.profile });
    let record;
    if (winner) {
        record = winner;
    }
    else if (atCapacity(state)) {
        return { ok: false, reason: "at_capacity" };
    }
    else {
        // acquirePortAndLaunch() holds the single in_flight owner across its own
        // async port allocation (not merely tryLaunchOne()'s synchronous spawn
        // instant) -- see that function's own header comment for the race this
        // closes between a cold acquire and a concurrent warm-floor pass. This
        // is also what restores vice-broker.sh's own process_requests() throttle:
        // a cold acquire that arrives while ANY launch (cold or warm) is already
        // under way is queued here (plan 05), matching the bash original's
        // declined-to-change behaviour of never racing a second instance into
        // existence, but answered LATER instead of refused outright.
        let lastLogRelPath = "";
        const result = await acquirePortAndLaunch("acquire", {
            state,
            stateDir,
            allocatePort: nextFreePort,
            // The SAME local `backend` const resolved at the
            // top of this function feeds BOTH the initial argv (here) and the
            // supervision deps below, so a crash-respawn of this instance can never
            // build a different backend's argv than the launch it replaces.
            backend,
            // The SAME local `viceBin` const, threaded down unchanged -- see this
            // function's own binding above and HandleAcquireDeps.viceBin's doc
            // comment. `undefined` here is exactly what broker-launch.mts's own
            // "x64sc"-literal default is for.
            viceBin,
            allocateRemoteMonitorPort: deps.allocateRemoteMonitorPort,
            // The profile the warm arm just
            // refused to compromise on reaches buildViceArgs() here, and is
            // mirrored onto the fresh InstanceRecord by spawnAndRecordInstance()
            // in the SAME step -- so this instance's recorded profile and its real
            // argv are written together and cannot disagree. This is the arm that
            // makes "a dedicated instance for that grant" true rather than
            // aspirational.
            profile: deps.profile,
            spawnFactory: deps.buildColdSpawnFactory ??
                ((port) => {
                    const supervisorDir = join(stateDir, String(port));
                    const { spawn, logRelPath } = makeLoggingSpawn(join(supervisorDir, "logs"), viceBin);
                    lastLogRelPath = logRelPath;
                    return withCrashSupervision("acquire", port, spawn, superviseDepsFor(stateDir, state, backend, viceBin));
                }),
        });
        if (!result.ok) {
            // `result.reason` passes
            // straight through -- `AcquireLaunchResult`'s reason union
            // ("launch_in_flight" | "no_free_port" | "no_free_text_port") is a
            // subset of `AcquireOutcome`'s, so a failed text-port allocation's own
            // `no_free_text_port` reaches the control plane as its own distinct
            // code (broker-control.mts's ControlErrorCode) rather than collapsing
            // to `internal` or to the generic `no_free_port`.
            return { ok: false, reason: result.reason };
        }
        if (result.record.pid === null) {
            // The spawn never forked a real process (e.g. a bad VICE_BIN path),
            // so there is nothing to signal -- the fix is deleting the
            // just-created broken record alone. Without this, a configuration
            // failure would silently occupy a port slot and count toward
            // countTotal()/atCapacity() until crash supervision's own delayed
            // respawn/give-up machinery eventually noticed and freed it, even
            // though the caller was already told "internal" right now.
            // deleteInstanceRecord(), not a bare map delete -- a stock launch that
            // failed this way already had its second port allocated and blocked
            // by acquirePortAndLaunch(), and deleteInstanceRecord() hands that
            // second port back to the allocator (via state.blockedPorts) in the
            // SAME step as it removes the broken record -- this branch is reached
            // only once a record already exists, i.e. only once BOTH allocations
            // already succeeded (a failed second allocation now fails the acquire
            // before any record -- and before this `pid === null` check -- is
            // ever reached at all).
            deleteInstanceRecord(state, result.record.port);
            return { ok: false, reason: "internal" };
        }
        record = result.record;
        // Only the cold-launch arm ever writes a FRESH epoch record here --
        // selectWarmInstance()'s own winner already has one. WHY that is true
        // changed without changing that it IS true: a
        // ready, ungranted candidate no longer comes from a warm-floor pass's
        // own onLaunched hook (retired along with the floor) -- it comes from
        // broker-launch.mts's own crash-supervision respawn path
        // (launchSupervised(), which writes its own epoch record via
        // deps.epoch.writeEpochRecord() on every launch and every respawn).
        // Either way, rewriting the epoch here would advance an epoch no restart
        // caused, which the container-side assertSameMachine() would read as a
        // machine change.
        writeEpochForLaunch(record, lastLogRelPath);
    }
    // THE single grant-recording step, fed by both arms above -- no `await`
    // between resolving `record` (whichever arm produced it) and this
    // synchronous pair, so two concurrent acquires can never both grant the
    // SAME record (see selectWarmInstance()'s own re-check for
    // the other half of that guarantee).
    state.grants.set(requestId, { id: requestId, port: record.port, grantedAt: Date.now(), pid: record.pid, operation: null, sessionLabel: deps.sessionLabel ?? null });
    record.state = "granted";
    return {
        ok: true,
        grant: {
            port: record.port,
            url: record.url,
            // Key omitted entirely when the record has none --
            // the fork case, and (until a later plan closes the port-allocation
            // degrade path) a stock instance whose second port allocation itself
            // failed. Same key-omitted-when-undefined idiom
            // spawnAndRecordInstance() already uses for this same field.
            ...(record.remoteMonitorPort === undefined ? {} : { remoteMonitorPort: record.remoteMonitorPort }),
        },
    };
}
/** Resolves the grant that currently OWNS a given instance (Phase 63,
 * SESS-06) -- the SAME identity comparison handleRelease() already uses
 * before it kills anything: a grant's own recorded `port` matches this
 * instance's port AND the grant's own recorded `pid` matches this
 * instance's CURRENT pid. Scanning by (port, pid) rather than merely by
 * port is what keeps a stale grant from reporting IDENTITY for an instance
 * whose port occupant has since been replaced by an unrelated launch (a
 * crash-respawn or a give-up) -- exactly the same
 * gap handleRelease()'s own header comment describes for the kill
 * discipline, now applied to what status DISPLAYS rather than what a
 * release KILLS. Returns `null` when no grant currently matches, which the
 * caller (handleStatus() below) reports as every identity field absent. */
function findOwningGrant(state, instance) {
    for (const grant of state.grants.values()) {
        if (grant.port === instance.port && grant.pid === instance.pid)
            return grant;
    }
    return null;
}
/** Answers the `status` control-plane request: one entry per instance,
 * computed on demand from the SAME in-memory map every other count reads --
 * strictly better than the dropped broker-instances.json projection, which
 * could go stale between passes. */
export function handleStatus(state) {
    return Array.from(state.instances.values()).map((r) => {
        const grant = findOwningGrant(state, r);
        return {
            port: r.port,
            url: r.url,
            state: r.state,
            reason: r.reason,
            epoch: typeof r.epoch === "number" ? r.epoch : null,
            // "at least one channel is claimed" -- promoted from
            // a single-field check, byte-identical wire shape, meaning stated
            // explicitly.
            hasMonitorClient: Object.keys(r.monitorClients).length > 0,
            // Phase 63 (SESS-06): all three resolved from the SAME owning grant
            // (or all absent together when findOwningGrant() found none) -- never
            // a fabricated value standing in for "nothing owns this instance".
            sessionLabel: grant ? grant.sessionLabel : null,
            grantId: grant ? grant.id : null,
            operation: grant ? grant.operation : null,
        };
    });
}
/** Resolves a monitor_claim/monitor_release target the SAME way
 * handleRelease() already resolves its own:
 * `targetId` is a grant id, looked up in state.grants for its port, then
 * the instance at that port. Returns `null` for an unknown target_id/port
 * so callers answer `bad_request`, never `internal`. */
function resolveInstanceForMonitorTarget(targetId, state) {
    const grant = state.grants.get(targetId);
    if (!grant)
        return null;
    return state.instances.get(grant.port) ?? null;
}
/** Answers `monitor_claim` (per-channel): exclusive monitor-socket
 * ownership enforced HERE, broker-side, PER CHANNEL, so a conflicting
 * claim is refused by name
 * before any second `connect()` is ever attempted -- the one state stock
 * VICE cannot report and no client-side heuristic can diagnose. `targetId`
 * doubles as both "which instance" (resolved via the SAME grant lookup
 * handleRelease() already uses) and "the
 * requesting grant's own identity" -- the claim IS the grant, so there is
 * no separate identity to carry. A repeated claim from the SAME grant on
 * the SAME channel is idempotent (`ok: true`, no second holder created); a
 * claim from a DIFFERENT grant while that channel already has a holder is
 * refused, naming the current holder and the channel (T-02-18) -- never the
 * emulator's own fault. A DIFFERENT channel's holder is irrelevant to this
 * decision -- claiming one channel never evicts or is refused by the
 * other's holder. */
export function handleMonitorClaim(requestId, targetId, channel, state) {
    void requestId; // correlation only -- the claim's own identity is targetId itself
    const instance = resolveInstanceForMonitorTarget(targetId, state);
    if (!instance)
        return { ok: false, code: "bad_request" };
    const existing = instance.monitorClients[channel];
    if (!existing) {
        // Phase 63 (SESS-02): mints the per-claim handle a relay connection's
        // `attach` will later have to present -- 16 random bytes rendered as
        // hex, at a size chosen only for the constant-time
        // comparison's own length gate (handleRelayAttach() below), not for
        // any wire-format reason.
        const handle = randomBytes(16).toString("hex");
        instance.monitorClients[channel] = { grantId: targetId, claimedAt: Date.now(), pid: instance.pid, handle, attached: false };
        return { ok: true, handle };
    }
    if (existing.grantId === targetId) {
        return { ok: true, handle: existing.handle }; // idempotent repeat from the SAME grant on the SAME channel -- SAME handle, no second holder minted
    }
    return { ok: false, code: "monitor_owned", holder: { grantId: existing.grantId, claimedAt: existing.claimedAt, pid: existing.pid, channel } };
}
/** Answers `stage_file` (Phase 64, plan 64-03, XFER-04, D-01): resolves the
 * grant's instance the SAME way every other target-naming op resolves its
 * own (resolveInstanceForMonitorTarget()), refusing `bad_request` when it
 * resolves to nothing -- mirroring handleMonitorClaim()'s own posture for
 * the identical failure. `broker-control.mts`'s own `stage_file` dispatch
 * arm has already checked ownership (`ownsTarget()`) and the `target_id`/
 * `slot`-non-empty shape before this function is ever called, so a failure
 * reaching here is something the STAGING LAYER itself refused. Delegates
 * every path-and-handle decision to `broker-transfer.mts`'s own
 * `stageFileSlot()` -- this function does not choose a path or mint a
 * handle itself. */
export function handleStageFile(grantId, slot, state) {
    const instance = resolveInstanceForMonitorTarget(grantId, state);
    if (!instance)
        return { ok: false, code: "bad_request" };
    const staged = stageFileSlot({ grantId, slot });
    if (!staged.ok) {
        process.stderr.write(`vice-broker: stage_file failed for target ${grantId}: ${staged.reason}\n`);
        return { ok: false, code: "internal" };
    }
    // `emulatorFilename` is the path the EMULATOR itself must open -- the
    // client relays it into the binary-monitor request body and never opens
    // it itself (this plan's own wire_vocabulary note on why this is not a
    // D-17 violation).
    return { ok: true, handle: staged.handle, emulatorFilename: staged.stagedPath };
}
/** Grace period (ms), after the broker has written and ended an upload's
 * completion reply, before the socket is force-destroyed if the client
 * never closes its own end (T-64-G3-03) -- bounds a half-open transfer
 * socket's lifetime without depending on client cooperation. */
const UPLOAD_REPLY_DESTROY_GRACE_MS = 2000;
/**
 * Writes an upload's ONE completion reply line -- `transfer_complete` on
 * success (the OBSERVED byteLength/sha256, an end-to-end publish
 * confirmation, D-11/D-09/XFER-06) or an `error` line on failure -- then
 * ends the socket so the line is flushed, and destroys it once the socket
 * has actually finished closing, or after a short grace period if the
 * client never closes its own end (T-64-G3-03/T-64-G3-04). Writes nothing
 * if the client socket is already gone.
 *
 * G-64-5 (plan 64-15, CR-01): the failure line's `message` is
 * `result.wireReason`, taken directly -- there is no longer a fallback to
 * `result.reason`. `ReceivePayloadToFileResult` (broker-transfer.mts)
 * makes both `code` and `wireReason` REQUIRED on a receive failure, so
 * `npm run typecheck` refuses a future failure branch that omits path-free
 * wire text, rather than this function silently falling back to the full,
 * path-bearing `reason` the way it used to -- that fallback was exactly
 * how CR-01's leak reached the wire (64-REVIEW.md).
 */
function writeUploadCompletionReply(socket, result) {
    if (socket.destroyed)
        return;
    const reply = result.ok
        ? { kind: "transfer_complete", byteLength: result.byteLength, sha256: result.sha256 }
        : { kind: "error", code: result.code, message: result.wireReason };
    socket.write(`${JSON.stringify(reply)}\n`, () => {
        if (!socket.destroyed)
            socket.end();
    });
    const destroyTimer = setTimeout(() => {
        if (!socket.destroyed)
            socket.destroy();
    }, UPLOAD_REPLY_DESTROY_GRACE_MS);
    if (typeof destroyTimer.unref === "function")
        destroyTimer.unref();
    socket.once("close", () => clearTimeout(destroyTimer));
}
export function handleFileTransfer(request, socket, pending, state, deps = {}) {
    void state;
    const resolved = resolveStagedFile(request.handle);
    if (!resolved.ok) {
        return { ok: false, code: "denied", message: `transfer failed: ${resolved.reason}` };
    }
    const entry = resolved.entry;
    // The in-flight guard is checked BEFORE the download-existence check
    // below: an in-flight upload's staged file legitimately does not exist
    // yet either (receivePayloadToFile() only renames its temp file into
    // place once the transfer completes), so a competing download would
    // otherwise see "does not exist" instead of the real, more specific
    // conflict -- "already in flight" is the answer that actually explains
    // why this second transfer is refused.
    const guard = markTransferInFlight(request.handle);
    if (!guard.ok) {
        return { ok: false, code: "denied", message: `transfer failed: ${guard.reason}` };
    }
    if (request.direction === "download" && !existsSync(entry.path)) {
        clearTransferInFlight(request.handle);
        return { ok: false, code: "denied", message: "vice: transfer failed: the staged file does not exist yet" };
    }
    // Phase 65 (SEAM-01, D-11): a host-tool upload slot declares its own
    // byteLength at `host_tool_stage` time (`StagedFileEntry.declaredByteLength`,
    // broker-transfer.mts) -- a `stageFileSlot()` entry (a monitor upload)
    // never carries one, so this check is a no-op for every pre-existing
    // caller. Refused BEFORE `transfer_ready` is ever written and before any
    // payload byte moves, exactly like every other upload refusal above.
    if (request.direction === "upload" && entry.declaredByteLength !== undefined && entry.declaredByteLength !== request.byteLength) {
        clearTransferInFlight(request.handle);
        return {
            ok: false,
            code: "denied",
            message: `vice: transfer failed: declared byteLength ${request.byteLength} does not match the staged manifest's declared byteLength ${entry.declaredByteLength}`,
        };
    }
    const settle = () => {
        clearTransferInFlight(request.handle);
        if (!socket.destroyed)
            socket.destroy();
    };
    if (request.direction === "upload") {
        // G-64-3 (plan 64-13): the client ends ITS OWN write side to mark the
        // end of the payload -- on a socket accepted by a server created
        // without allowHalfOpen (broker-control.mts's own listener), the
        // client's FIN would otherwise auto-end this socket's writable side
        // too, so a reply written after that FIN is never delivered (MEASURED
        // by the planner on Node v24.20.0). Set BEFORE writing `transfer_ready`
        // -- and therefore strictly before the client can possibly have sent
        // its own FIN -- so the broker can still answer once its own publish
        // finishes.
        socket.allowHalfOpen = true;
        // The upload reply -- no byteLength/sha256 to declare here (those
        // arrived already, on the `transfer` request itself), so this is a
        // plain JSON line, never writeTransferHeader() (whose type requires all
        // three TransferHeader fields).
        socket.write(`${JSON.stringify({ kind: "transfer_ready" })}\n`);
        receivePayloadToFile({
            socket,
            destPath: entry.path,
            header: { kind: "file", byteLength: request.byteLength, sha256: request.sha256 },
            pending,
            beforePublish: deps.beforePublish,
        }).then((result) => {
            if (!result.ok) {
                process.stderr.write(`vice-broker: upload transfer failed for handle ${request.handle}: ${result.reason}\n`);
            }
            clearTransferInFlight(request.handle);
            writeUploadCompletionReply(socket, result);
        });
    }
    else {
        sendPayloadFromFile({ socket, sourcePath: entry.path, kind: "transfer_payload" })
            .then((result) => {
            if (!result.ok) {
                process.stderr.write(`vice-broker: download transfer failed for handle ${request.handle}: ${result.reason}\n`);
            }
        })
            .finally(settle);
    }
    return { ok: true };
}
// ---------------------------------------------------------------------------
// host_tool_stage / host_tool_run / host_tool_end (Phase 65, SEAM-01,
// D-03/D-07/D-09/D-10). The fixed-endpoint route's own three broker-side
// handlers -- a brand-new request key per host-tool request, never gated by
// `ownsTarget()` (a skill call holds no acquire-level grant at all,
// RESEARCH.md Critical Finding 2). Delegates every path-and-handle decision
// to `broker-transfer.mts`'s own staging primitives, exactly like
// `handleStageFile()`/`handleFileTransfer()` above already do for a monitor
// upload; this module orchestrates, it does not choose a path or mint a
// handle itself.
// ---------------------------------------------------------------------------
/** Answers `host_tool_stage`: delegates to `stageHostToolRequest()`
 * (broker-transfer.mts) unchanged, and reports a staging refusal as
 * `bad_request` with the (already path-free) reason that function
 * produced. */
export function handleHostToolStage(files) {
    const staged = stageHostToolRequest({ files });
    if (!staged.ok) {
        return { ok: false, code: "bad_request", message: staged.reason };
    }
    return { ok: true, requestKey: staged.requestKey, treeHandles: staged.treeHandles, fileHandles: staged.fileHandles };
}
/** The fixed token every reply string field is scrubbed to once it has
 * matched the request's own scratch root (D-10) -- so no broker-side
 * filesystem path ever reaches the wire on this route, mirroring
 * `broker-transfer.mts`'s own `formatPathFreeFault()` posture of naming a
 * fixed replacement rather than attempting to scrub an unbounded shape. */
const STAGED_REQUEST_TOKEN = "<staged-request>";
/** The same, for the broker's Ghidra projects root (brokerGhidraDir()). */
const GHIDRA_PROJECTS_TOKEN = "<ghidra-projects>";
function redactScratchRoot(value, scratchRoot, ghidraRoot) {
    return value.split(scratchRoot).join(STAGED_REQUEST_TOKEN).split(ghidraRoot).join(GHIDRA_PROJECTS_TOKEN);
}
/** Answers `host_tool_run`: verifies every staged upload for this request
 * has actually finished transferring (D-09's own "not every declared file
 * has arrived yet" case), binds every path-bearing wire key to its
 * scratch-relative path via `bindStagedInputs()` (host-tool.mts), runs
 * `runHostTool()` against the REQUEST'S OWN scratch root (never this
 * broker's own `--repo-root`) for `repoRoot`, while `projectRoot` IS this
 * broker's own `--repo-root` (`args.repoRoot` at the call site below), so the
 * `tools.json` locator layer keeps resolving where it always has, and
 * `ghidraProjectsRoot` is brokerGhidraDir(). `clearDeclaredOutputs: true` generalises
 * the c1541.read-only stale-output unlink to every tool (D-08). Then
 * rewrites the response: every `results[]` entry becomes a download handle
 * via `registerHostToolResult()` (D-07's first live producer), and every
 * remaining string field is scrubbed of the scratch root (D-10, T-65-06).
 * Never rejects -- every failure resolves `{ ok: false, message }`,
 * mirroring `runHostTool()`'s own contract. */
export async function handleHostToolRun(requestKey, raw, projectRoot, deps = {}) {
    const uploads = listHostToolUploads(requestKey);
    for (const upload of uploads) {
        if (!existsSync(upload.path)) {
            return { ok: false, message: "vice: host_tool_run: not every staged upload has finished transferring yet" };
        }
    }
    const scratchRoot = join(brokerStagingDir(), requestKey);
    // Phase 65 (plan 65-03, D-03): created BEFORE the run, unconditionally --
    // ghidra.analyze's own exportPath output-name binding (host-tool.mts's
    // bindStagedInputs()) resolves to "out/<name>" under this directory, and
    // `resolveWorkspacePath()`'s own ancestor-realpath walk requires SOME
    // existing ancestor to walk from. A tool with no output-name key stages
    // an empty, harmless directory here.
    mkdirSync(join(scratchRoot, "out"), { recursive: true });
    const lookup = {
        fileHandle: (handle) => {
            const resolved = resolveStagedFile(handle);
            if (!resolved.ok || resolved.entry.grantId !== requestKey)
                return undefined;
            return relative(scratchRoot, resolved.entry.path);
        },
        // Phase 65 (plan 65-03, D-04): a tree handle resolves to its own tree
        // INDEX (resolveHostToolTree()), never a path -- the relative directory
        // it names is always `in/<tree>`, the SAME layout
        // stageHostToolRequest() (broker-transfer.mts) already wrote every
        // manifest entry for that tree under.
        treeHandle: (handle) => {
            const resolved = resolveHostToolTree(requestKey, handle);
            if (!resolved.ok)
                return undefined;
            return join("in", String(resolved.tree));
        },
    };
    const bound = bindStagedInputs(raw, lookup);
    if (!bound.ok) {
        return { ok: false, message: bound.message };
    }
    const ghidraRoot = brokerGhidraDir();
    const response = await runHostTool(bound.request, {
        repoRoot: scratchRoot,
        projectRoot,
        ghidraProjectsRoot: ghidraRoot,
        clearDeclaredOutputs: true,
        outputDir: join(scratchRoot, "out"),
        log: deps.log,
    });
    const responseObj = response;
    if (!response.ok) {
        const message = typeof responseObj.message === "string" ? responseObj.message : "vice: the host tool refused";
        return { ok: false, message: redactScratchRoot(message, scratchRoot, ghidraRoot) };
    }
    const rewritten = { ...responseObj };
    const results = responseObj.results;
    if (Array.isArray(results)) {
        rewritten.results = results.map((result, index) => {
            const handle = registerHostToolResult({ requestKey, path: result.path, index });
            return { name: basename(result.path), handle, sha256: result.sha256, byteLength: result.byteLength };
        });
    }
    for (const key of ["message", "stderrTail", "reason", "entrypointReason"]) {
        const value = rewritten[key];
        if (typeof value === "string") {
            rewritten[key] = redactScratchRoot(value, scratchRoot, ghidraRoot);
        }
    }
    return rewritten;
}
/** Answers the connection close that ends a `host_tool_stage` request
 * (D-09): reuses `clearStagingForSession()` unchanged, exactly like
 * `handleRelease()` already does for an `acquire` grant's own release. */
export function handleHostToolEnd(requestKey) {
    clearStagingForSession(requestKey);
}
/**
 * Answers a relay connection's own death (Phase 63, SESS-03/05) -- the ONE
 * place this broker ever writes an incident record for a dropped monitor
 * channel. It is one of TWO places a relay session's live handle is ever
 * removed from `state.relaySessions` -- the other being
 * tearDownRelaySessionForChannel() below (whose whole-grant caller,
 * tearDownRelaySessionsForGrant(), and handleMonitorRelease() -- Phase 63,
 * gap closure plan 63-11 -- are wired into every deliberate release
 * path BEFORE the process or channel they own is signalled), using the
 * same delete-before-close order this function itself uses (see that
 * function's own header comment for why the order is load-bearing). Called
 * from exactly one production site here: the
 * `onDeath` callback handleRelayAttach() below hands to spliceRelay() at
 * the moment a channel is spliced.
 *
 * THE ORDER BELOW IS STRUCTURALLY THE POINT OF THIS FUNCTION, not
 * incidental -- CLAUDE.md's own architecture constraint ("Do not kill or
 * relaunch the emulator to serve a newer request. Write the incident record
 * first.") and this plan's own prohibition both bind it:
 *
 *   1. Look up the grant and the live relay session for this exact
 *      (targetId, channel) pair. An ABSENT session means a teardown already
 *      ran (this is the per-grant-and-channel idempotency guard, one layer
 *      above spliceRelay()'s own per-session `deathReported` latch) --
 *      return immediately, writing NOTHING and touching NOTHING else.
 *   2. Read the grant's own declared operation (GrantRecord.operation,
 *      Plan 63-03) -- a declared operation means a live run is voided.
 *   3. Write the incident record with the injectable writer, SYNCHRONOUSLY
 *      (writeBrokerIncident()'s own atomic tmp-then-rename write is a
 *      synchronous fs call chain, never a Promise), keeping the returned
 *      path. A throw here propagates AFTER a distinctly-worded log line --
 *      this function does NOT swallow it, because a caller that cannot
 *      write evidence must learn that before anything is released.
 *   4. ONLY NOW: remove the session from `state.relaySessions`, clear the
 *      monitor claim for this channel through the injectable claim-clearing
 *      step (the SAME clearMonitorClient() every other release path uses --
 *      this also resets the channel's `attached` marker, since clearing the
 *      WHOLE per-channel entry is what makes a later re-claim mint a FRESH
 *      handle rather than resurrecting a dead one), and call the session
 *      handle's own close(trigger) -- which is what actually destroys
 *      whichever leg is not already destroyed.
 *   5. Leave the instance record and the grant entirely untouched -- a
 *      relay death tears down exactly one channel, never the instance or
 *      the grant that owns it (SESS-03's own "leaves the instance running
 *      and the grant standing"). Log one line naming the grant, the
 *      channel, the trigger, the declared operation (or its explicit
 *      absence), and the record's own path.
 */
export function handleRelayDeath(targetId, channel, trigger, state, deps = {}) {
    const key = relaySessionKey(targetId, channel);
    const session = state.relaySessions.get(key);
    if (!session)
        return; // a teardown already ran for this exact grant+channel -- write nothing, touch nothing
    const writeIncident = deps.writeIncident ?? writeBrokerIncident;
    const clearClaim = deps.clearClaim ?? clearMonitorClient;
    const grant = state.grants.get(targetId);
    const instance = resolveInstanceForMonitorTarget(targetId, state);
    const operation = grant?.operation ?? null;
    let recordPath;
    try {
        recordPath = writeIncident({
            trigger,
            grant_id: targetId,
            channel,
            port: instance ? instance.port : null,
            epoch_before: instance && typeof instance.epoch === "number" ? instance.epoch : null,
            operation,
            reason: `relay death on target ${targetId}, channel ${channel}: ${trigger}`,
        });
    }
    catch (err) {
        process.stderr.write(`vice-broker: FAILED to write the incident record for a relay death on target ${targetId} channel ${channel} (trigger ${trigger}) -- ` +
            `refusing to release the claim, destroy either socket, or signal anything until this is fixed: ${String(err)}\n`);
        throw err;
    }
    // Only now: the record is durably on disk (writeIncident()'s own atomic
    // tmp-then-rename write already completed synchronously above) --
    // release exactly one channel, never the instance or the grant.
    state.relaySessions.delete(key);
    if (instance)
        clearClaim(instance, channel);
    session.close(trigger);
    process.stderr.write(`vice-broker: relay death on target ${targetId} channel ${channel} (trigger ${trigger}, operation ${operation ? operation.name : "none declared"}) -- ` +
        `incident recorded at ${recordPath}\n`);
}
/**
 * The ONE primitive by which a live relay session is deliberately removed
 * and closed for exactly one (grant, channel) pair (Phase 63, gap closure
 * plan 63-11). tearDownRelaySessionsForGrant() below is its whole-grant
 * caller, looping this function over every MONITOR_CHANNELS value rather
 * than carrying a second copy of the delete-before-close body;
 * handleMonitorRelease() below is this function's other caller, on its
 * per-channel path. handleRelayDeath() above is the separate,
 * UNANNOUNCED-death path: it writes evidence FIRST and only then removes
 * the same map entry this function removes directly, with no evidence
 * write, because a deliberate teardown is not itself an incident.
 *
 * The delete-then-close order is load-bearing, not incidental: close()
 * destroys both of the session's sockets, each socket's own "close" event
 * calls spliceRelay()'s reportDeath(), and onDeath lands right back in
 * handleRelayDeath() above. An entry still present in state.relaySessions
 * at that moment is EXACTLY what made an ordinary, successful call write a
 * junk incident record before this fix existed: every successful
 * text-channel tool call opened a fresh relay connection, ran one command
 * and closed it again, and each one deposited a full incident record --
 * with no operation declared and nothing dropped -- into the machine-wide,
 * cross-project incidents directory. Deleting the map entry BEFORE calling
 * close() is what makes that re-entry a no-op instead -- the exact order
 * handleRelayDeath() itself already uses.
 *
 * This is also the recorded decision 63-VERIFICATION.md's `missing[2]`
 * asked for: a per-channel release ALWAYS tears that channel's relay
 * session down, whether or not a socket close follows it -- a client that
 * wants to keep using its relay socket must simply not release the claim.
 * Releasing clears the channel's whole holder record, including its
 * handle; handleRelayAttach() above refuses a second attach on an
 * already-attached channel; and a re-claim mints a FRESH handle. A socket
 * left spliced after a release is therefore a live connection no claim
 * accounts for and no future attach can adopt -- that state is
 * unrepresentable in this broker's model, so tearing down is the only
 * consistent outcome, not a convenience.
 *
 * A REFUSED release tears down nothing: handleMonitorRelease() never
 * calls this function on its `denied` or `bad_request` paths, because a
 * grant that is not the channel's holder must not be able to destroy the
 * holder's live connection.
 *
 * Passes "relay_close" to close() deliberately: RelayDeathTrigger
 * (broker-relay.mts) declares exactly three members and must not grow a
 * fourth "control_close" -- that string names a DIFFERENT type,
 * BrokerIncidentTrigger (broker-incident.mts), used only for the incident
 * record's own trigger field at handleRelease()'s evidence-write call site
 * above. close() ignores its argument past the first call in any case
 * (RelaySession.close()'s own documented contract), so the choice of
 * trigger here is a matter of naming honesty, not behavior.
 *
 * Returns false when the (grant, channel) pair has no live session at all
 * -- "never attached" and "a teardown already ran" are the same case, and
 * this function does nothing observable in either.
 */
export function tearDownRelaySessionForChannel(targetId, channel, state) {
    const key = relaySessionKey(targetId, channel);
    const session = state.relaySessions.get(key);
    if (!session)
        return false;
    state.relaySessions.delete(key); // BEFORE close() -- see header comment above
    session.close("relay_close");
    return true;
}
/**
 * Tears down every live relay session a grant holds, across both monitor
 * channels (Phase 63, gap closure plan 63-07) -- the whole-grant caller of
 * tearDownRelaySessionForChannel() above, which is the single
 * delete-before-close implementation both this function and
 * handleMonitorRelease() share (see that function's own header comment for
 * the full delete-before-close rationale). Called from BOTH of
 * handleRelease()'s branches below, strictly BEFORE the process this grant owns is signalled.
 *
 * Returns the array of channels that actually held a live session -- an
 * empty array is the ordinary case (most grants never attach a relay at
 * all, or already had it torn down) and is never logged as anything
 * unusual by this function itself; callers decide whether and how to log
 * a non-empty result.
 */
export function tearDownRelaySessionsForGrant(targetId, state) {
    const torn = [];
    for (const ch of MONITOR_CHANNELS) {
        if (tearDownRelaySessionForChannel(targetId, ch, state))
            torn.push(ch);
    }
    return torn;
}
/** Answers `attach` (Phase 63, SESS-02; gated at the seam by G-64-4, plan
 * 64-12, Task 1): the ONE place a relay connection's presented handle is
 * checked, and the ONE place spliceRelay() is ever called from production
 * wiring. Resolves the instance the SAME way every other target-naming op
 * resolves its own (resolveInstanceForMonitorTarget() above); refuses
 * `bad_request` for an unknown target, matching handleMonitorClaim()'s own
 * posture for the identical failure.
 *
 * Every OTHER SYNCHRONOUS failure is `denied`, deliberately collapsed into
 * one code (RelayAttachOutcome's own header comment explains why): no
 * current holder on this channel at all, a holder whose stored handle
 * differs in LENGTH from what was presented (checked before ever calling
 * timingSafeEqual(), which throws on a length mismatch rather than
 * returning false), a byte-for-byte mismatch under timingSafeEqual()
 * itself, or a channel that is already `attached` -- one emulator socket
 * to splice to, so a second attach on the same channel is refused rather
 * than silently spliced twice. Every one of these checks runs BEFORE any
 * `await` in this function, exactly as it did when this function was
 * synchronous.
 *
 * G-64-4: `attached` used to mean "the splice was wired", not "the
 * emulator leg connected" -- spliceRelay() dialled the emulator itself and
 * spliced immediately, with no wait for the TCP connect to succeed, which
 * is what let a cold session's first PING die under an ECONNREFUSED relay
 * (a measured mechanism). This function now marks the channel `attached`
 * synchronously (so a concurrent second attach is still refused
 * immediately) and THEN awaits the bounded dial (broker-relay.mjs's
 * dialEmulatorLeg()) before ever reporting success -- the emulator leg is guaranteed connected by
 * the time this function's promise resolves `ok: true`.
 *
 * The client leg is paused for the duration of that wait (see the
 * `clientSocket.pause()` call below) so no byte it sends is dropped by
 * broker-control.mts's own line reader, which already treats this socket as
 * "relayMode" the instant this function is called and would otherwise
 * silently discard anything arriving before the splice's own listeners take
 * over.
 *
 * On success: resolves the emulator's own host through resolveBinmonHost()
 * (the SAME resolver the argv builder uses -- never a second literal) and
 * its port through broker-relay.mts's own resolveRelayChannelTarget() (plan
 * 63-02) -- the instance record's primary `port` field for the binary
 * channel, its own `remoteMonitorPort` for the text channel, with NO
 * fallback from one to the other on a missing value (T-63-08). Returns a
 * `start` continuation rather than splicing here directly: broker-control.mts's
 * attach dispatch arm calls it AFTER writing the `attached` line, which is
 * what keeps that line strictly ahead of any emulator byte in program order
 * (the emulator socket carries no "data" listener and is not piped until
 * `start()` runs). `start()` is what actually calls spliceRelay() and
 * records the returned session in `state.relaySessions` (Phase 63, plan
 * 63-04) keyed by relaySessionKey(targetId, channel), so handleRelayDeath()
 * above can find it again.
 *
 * On a dial that is ABANDONED (the client leg closed, or the instance/holder
 * identity this attach validated no longer matches the broker's live state):
 * the holder's `attached` marker is cleared -- but ONLY if that holder is
 * still the current one (a release or a respawn that already ran has its
 * own holder, or none, and must never be perturbed by a stale dial's own
 * cleanup) -- and this function answers a generic `denied`, writing no
 * incident and never splicing. On a dial that GENUINELY FAILS (its own
 * deadline elapsed, or a non-ECONNREFUSED connect error) without being
 * abandoned: the SAME conditional clearing applies, the code is the
 * distinct `emulator_unreachable`, the wire message is broker-relay.mjs's
 * own errno-free buildEmulatorUnreachableMessage() (channel, port and
 * deadline only -- see that function's own comment for why no errno or
 * path ever reaches the wire), and the full detail (errno, attempt count,
 * elapsed time) goes to this broker's own stderr journal line instead.
 *
 * `deps` (optional, defaulting to real production functions/constants) is
 * threaded straight into every death this session can ever report, AND into
 * the dial itself (dialDeadlineMs/dialRetryIntervalMs/connect) -- a test
 * overrides these to prove every failure mode without touching the real
 * filesystem and without a real five-second wait; the real broker (this
 * file's own `run()`) omits it. */
export async function handleRelayAttach(targetId, channel, presentedHandle, clientSocket, pending, state, deps = {}) {
    const instance = resolveInstanceForMonitorTarget(targetId, state);
    if (!instance)
        return { ok: false, code: "bad_request" };
    const holder = instance.monitorClients[channel];
    if (!holder)
        return { ok: false, code: "denied" };
    const stored = Buffer.from(holder.handle, "utf8");
    const presented = Buffer.from(presentedHandle, "utf8");
    if (stored.length !== presented.length)
        return { ok: false, code: "denied" };
    if (!timingSafeEqual(stored, presented))
        return { ok: false, code: "denied" };
    if (holder.attached)
        return { ok: false, code: "denied" };
    // Plan 63-02: resolved BEFORE the channel is marked attached -- a target
    // whose record carries no text-monitor port must be refused, by name,
    // without leaving the channel's holder in a half-attached state.
    const target = resolveRelayChannelTarget(channel, targetId, instance);
    if (!target.ok) {
        console.error(`vice-broker: ${target.reason}`);
        return { ok: false, code: "bad_request" };
    }
    // Everything above is synchronous -- a concurrent second attach on this
    // exact channel is refused immediately by the `holder.attached` check
    // above, since THIS line runs before any await in this function.
    holder.attached = true;
    // G-64-4: pause the client leg BEFORE the first await below. Every byte
    // it sends while this dial is in flight must stay buffered inside the
    // socket, not be silently discarded by broker-control.mts's own line
    // reader (already in "relayMode" for this socket the instant `attach` was
    // dispatched). Resumed either by the success continuation's own
    // spliceRelay() -> pipe() call (piping a paused Readable puts it back
    // into flowing mode) or, on refusal, explicitly by broker-control.mts's
    // own attach dispatch arm.
    clientSocket.pause();
    const host = resolveBinmonHost();
    const deadlineMs = deps.dialDeadlineMs ?? DEFAULT_RELAY_DIAL_DEADLINE_MS;
    const retryIntervalMs = deps.dialRetryIntervalMs ?? DEFAULT_RELAY_DIAL_RETRY_MS;
    // G-64-4's own abandonment predicate: true once THIS attach's own wait is
    // stale. `instance`/`holder` here are the EXACT objects validated above --
    // re-resolving the instance for `targetId` and re-reading the channel's
    // current holder and comparing by IDENTITY (never by value) is what
    // catches a respawn (a brand new InstanceRecord object at the
    // same or a different port) and a release (the SAME instance object, but
    // a cleared or replaced holder) alike.
    const isAbandoned = () => {
        if (clientSocket.destroyed)
            return true;
        if (resolveInstanceForMonitorTarget(targetId, state) !== instance)
            return true;
        if (instance.monitorClients[channel] !== holder)
            return true;
        return false;
    };
    const dial = await dialEmulatorLeg({
        host,
        port: target.port,
        connect: deps.connect,
        deadlineMs,
        retryIntervalMs,
        isAbandoned,
    });
    if (!dial.ok) {
        // G-64-4 Task 2: cleared ONLY if this holder is still the CURRENT one --
        // a release or a respawn that already ran has its own holder (or none
        // at all) and must never be perturbed by a stale dial's own cleanup.
        if (instance.monitorClients[channel] === holder)
            holder.attached = false;
        if (dial.abandoned) {
            // Never write an incident, never splice, never register a session --
            // the client leg is gone or the claim/instance moved on while this
            // dial waited. A generic `denied` costs nothing on a destroyed socket
            // (broker-control.mts's own attach arm writes nothing to one) and is
            // a safe, honest refusal on a still-live one whose claim changed
            // under it.
            return { ok: false, code: "denied" };
        }
        // A genuine failure (deadline exceeded, or a non-retryable connect
        // error) -- the full detail (errno, attempt count, elapsed time) goes
        // to this broker's OWN stderr journal line, never to the wire; the
        // wire message is built once, errno-free, by broker-relay.mjs's own
        // buildEmulatorUnreachableMessage().
        process.stderr.write(`vice-broker: attach: emulator dial for target ${targetId} channel ${channel} port ${target.port} failed after ` +
            `${dial.attempts} attempt(s) in ${dial.elapsedMs}ms (last error ${dial.lastErrorCode ?? "n/a"}) -- ${dial.reason}\n`);
        return {
            ok: false,
            code: "emulator_unreachable",
            message: buildEmulatorUnreachableMessage(channel, target.port, deadlineMs),
        };
    }
    // Connected -- re-check the SAME three conditions once more before ever
    // splicing (T-64-G4-02): an instance that reused this exact port after a
    // kill or respawn while this dial was in flight must never be spliced to as
    // if it were still this attach's own original target.
    if (isAbandoned()) {
        if (!dial.socket.destroyed)
            dial.socket.destroy();
        if (instance.monitorClients[channel] === holder)
            holder.attached = false;
        return { ok: false, code: "denied" };
    }
    const emulatorSocket = dial.socket;
    return {
        ok: true,
        // The synchronous start continuation (see this function's own header
        // comment): broker-control.mts's attach arm calls this AFTER it has
        // already written the `attached` line, so the emulator socket -- which
        // carries no "data" listener and is not piped until this runs -- can
        // never deliver a byte ahead of that line.
        start: () => {
            const session = spliceRelay({
                clientSocket,
                emulatorSocket,
                pending,
                onDeath: (trigger) => handleRelayDeath(targetId, channel, trigger, state, deps),
                // Plan 63-04 Task 2 (SESS-04): the broker-owned idle deadline and the
                // labelled-secondary keepalive delay, both resolved fresh per attach
                // (an operator's env-var override is honoured for every new relay, not
                // just ones spliced before the broker started) unless a test overrides
                // either through `deps`.
                idleMs: deps.idleMs ?? resolveRelayIdleMs(),
                armIdleTimer: deps.armIdleTimer,
                keepAliveMs: deps.keepAliveMs ?? resolveRelayKeepAliveMs(),
            });
            state.relaySessions.set(relaySessionKey(targetId, channel), session);
        },
    };
}
/** Answers `monitor_release` (per-channel): clears ONLY the named
 * channel's entry, ONLY when `targetId` names that channel's CURRENT
 * holder -- a non-holder is refused, not silently accepted (spoofing a
 * release is a deliberately refused case). A channel with no current
 * holder at all tolerates the
 * release as a success, matching the container-side client's own documented
 * tolerance for releasing a socket the broker already cleared.
 *
 * Phase 63, gap closure plan 63-11: on BOTH `ok: true` paths, also tears
 * down this exact (grant, channel) pair's own live relay session through
 * tearDownRelaySessionForChannel() -- see that function's own header
 * comment for why a released channel must never be left with a live
 * splice behind it, and why the refused paths below must never reach it.
 * On the holder-matches path the teardown runs strictly BEFORE
 * clearMonitorClient(), in the same delete-before-close order every other
 * deliberate teardown in this file already uses. */
export function handleMonitorRelease(requestId, targetId, channel, state) {
    void requestId; // correlation only, matching handleMonitorClaim()'s own posture
    const instance = resolveInstanceForMonitorTarget(targetId, state);
    if (!instance)
        return { ok: false, code: "bad_request" };
    const existing = instance.monitorClients[channel];
    if (!existing) {
        // Already cleared as far as the per-channel holder record goes -- but
        // a live relay session for this exact (grant, channel) pair may still
        // be attached (e.g. a prior release already ran but a socket close
        // never followed it). Tear it down too, tolerated as a success either
        // way, matching the container-side client's own documented tolerance.
        tearDownRelaySessionForChannel(targetId, channel, state);
        return { ok: true };
    }
    if (existing.grantId !== targetId) {
        return { ok: false, code: "denied" };
    }
    tearDownRelaySessionForChannel(targetId, channel, state);
    clearMonitorClient(instance, channel);
    return { ok: true };
}
/** Answers `operation` (Phase 63, SESS-05): the ONE place a grant's own
 * in-flight-operation field is ever written. Resolves the grant DIRECTLY
 * from `state.grants` -- never through `resolveInstanceForMonitorTarget()`
 * (the instance/monitor-client path every other handler above uses) --
 * because a declaration names the CONNECTION'S OWN grant, not a monitor
 * channel's holder; broker-control.mts's own ownsTarget() gate has already
 * proven the calling connection holds this exact grant id before this
 * function is ever reached, so the only remaining failure is the grant
 * having disappeared between that check and this call (a
 * should-be-unreachable race in this single-threaded event loop, checked
 * defensively rather than assumed -- `bad_request` names it the same way
 * every other target-naming handler names an unknown target).
 *
 * `channel` is accepted (matching every other target-naming op's own wire
 * shape) but not itself part of the stored state: a grant has exactly ONE
 * connection and therefore exactly one in-flight operation at a time,
 * regardless of which channel it runs on -- channel-lock.ts's own single,
 * cross-channel mutex is what already guarantees that only one logical
 * operation is ever running for this grant at once. Storing a SECOND,
 * per-channel field here would let a stale text-channel declaration outlive
 * a binary-channel operation that has already cleared, or vice versa.
 *
 * `name === null` clears the field; clearing an already-clear field is
 * accepted, not refused, matching monitor_release's own tolerance for
 * releasing an already-cleared record. The declaration moment is stamped
 * from `opts.now` (this project's standard `now?: () => number` injection
 * register, stock-checkpoints.ts's own convention) so a test can assert the
 * EXACT stamped value without racing Date.now().
 *
 * Plan 63-04 Task 2 (SESS-04): a declaration ALSO suspends the idle
 * deadline on every LIVE relay session this grant currently holds -- BOTH
 * channels, if both happen to be attached, since a grant has exactly one
 * in-flight operation regardless of which channel runs it (see this
 * function's own header comment above). Clearing (`name === null`) resumes
 * every one of them with a FRESH interval. This is why one declaration
 * serves both SESS-05's evidence requirement and SESS-04's deadline: a
 * channel with something declared is legitimately silent and must never be
 * torn down by the clock. A grant with no live relay session on a given
 * channel simply has nothing to suspend/resume there -- never an error. */
export function handleOperationNote(targetId, channel, name, state, opts = {}) {
    void channel; // accepted for wire-shape symmetry with every other target-naming op; not itself stored -- see header comment
    const grant = state.grants.get(targetId);
    if (!grant)
        return { ok: false, code: "bad_request" };
    const nowFn = opts.now ?? Date.now;
    grant.operation = name === null ? null : { name, declaredAt: nowFn() };
    for (const ch of MONITOR_CHANNELS) {
        const session = state.relaySessions.get(relaySessionKey(targetId, ch));
        if (!session)
            continue;
        if (name === null)
            session.resumeIdle();
        else
            session.suspendIdle();
    }
    return { ok: true };
}
/** The second concern of the fixed-order evaluation pass, RENAMED from the
 * retired warm-floor maintenance function this replaces (the projection
 * write is dropped, and the grant sweep does not appear -- the connection
 * is the lease now, so there is nothing left to sweep for expiry). Unlike
 * the function it
 * replaces, this one never launches anything -- it wires only
 * broker-launch.mjs's real promoteLaunchingInstances() against this
 * broker's own state and the backend-aware readiness probe, so a
 * `launching` instance (however it got there -- a cold acquire's own
 * instance, or a crash-respawn) is promoted to `ready` the moment it
 * answers. */
function promoteLaunchingForRealBroker(state, backend) {
    return promoteLaunchingInstances({
        state,
        backend,
        // Same backend-aware probe route as handleAcquire's, from the
        // SAME resolved verdict this function already receives.
        probe: (port) => probeReady(port, { backend }),
        log: (line) => process.stderr.write(`${line}\n`),
    });
}
export function handleRelease(requestId, state, deps = {}) {
    const grant = state.grants.get(requestId);
    if (!grant)
        return;
    const instance = state.instances.get(grant.port);
    if (instance && instance.pid === grant.pid) {
        if (grant.operation) {
            const writeIncident = deps.writeIncident ?? writeBrokerIncident;
            let recordPath;
            try {
                recordPath = writeIncident({
                    trigger: "control_close",
                    grant_id: requestId,
                    // No single channel to name -- a control-connection close reclaims
                    // the WHOLE instance, not one channel (unlike handleRelayDeath()'s
                    // own per-channel record).
                    channel: null,
                    port: instance.port,
                    epoch_before: typeof instance.epoch === "number" ? instance.epoch : null,
                    operation: grant.operation,
                    reason: `control connection closed on target ${requestId} with a declared operation in flight`,
                });
            }
            catch (err) {
                process.stderr.write(`vice-broker: FAILED to write the incident record for a control-connection release on target ${requestId} -- ` +
                    `refusing to release the claim, delete the instance record, or kill anything until this is fixed: ${String(err)}\n`);
                throw err;
            }
            process.stderr.write(`vice-broker: control-connection release on target ${requestId} with a declared operation (${grant.operation.name}) -- incident recorded at ${recordPath}\n`);
        }
        // Plan 63-07 (SESS-05): tears down this grant's own live relay
        // session(s) -- if any -- BEFORE the reclaim below and BEFORE the kill,
        // so the kill's own later asynchronous socket close finds
        // state.relaySessions already empty and handleRelayDeath()'s early
        // return fires as designed, writing no second (content-empty) record.
        const tornDown = tearDownRelaySessionsForGrant(requestId, state);
        if (tornDown.length > 0) {
            process.stderr.write(`vice-broker: release on target ${requestId} tore down live relay session(s) on channel(s) ${tornDown.join(", ")} ahead of the kill\n`);
        }
        markDeliberateDeath(instance);
        // Plan 05: releasing clears monitor-client ownership (every channel) as
        // a side effect -- redundant with the instance-map deletion two lines
        // below (the WHOLE record, monitorClients included, is going away), but
        // explicit for the same reason GrantRecord's own clearing is explicit
        // here: the
        // instance-map deletion is a Task-2-era invariant this task must not
        // depend on silently continuing to hold.
        clearMonitorClient(instance);
        // Phase 64, plan 64-03 (XFER-07, D-06): handleRelease() is the SAME
        // function broker-control.mts's own onRelease callback invokes BOTH on
        // an explicit `release` request AND on the control connection's own
        // close event -- so this is the "session's connection closes" trigger
        // XFER-07 names, and a client killed with SIGKILL (which sends no
        // goodbye, only a socket close) still loses its staging. One recursive
        // delete of one directory; never per-file bookkeeping.
        clearStagingForSession(requestId);
        state.grants.delete(requestId);
        // Kill-never-recycle means this instance is gone for good, so its
        // second (`-remotemonitor`) port must go back to the allocator with it.
        deleteInstanceRecord(state, grant.port);
        const kill = deps.kill ?? ((opts) => verifiedKill(opts));
        kill({ pid: instance.pid, expectedIdentity: instance.expectedIdentity }).catch(() => {
            // best-effort; nothing further to report on this path this task
        });
        return;
    }
    // Stale/orphaned grant: the port's current occupant (if any) is NOT the
    // same process this grant was issued for. Retire the grant's own
    // bookkeeping only -- the mismatched occupant, if any, is left running.
    // UNCHANGED by Task 3: this branch writes no record and signals nothing
    // at the mismatched occupant's own process.
    //
    // Plan 63-07 (SESS-05): tears down only THIS grant's own relay channels
    // -- two sockets this broker itself owns -- before the grant's
    // bookkeeping is deleted. This signals nothing at the mismatched
    // occupant process, so this branch's documented "the current occupant
    // was left running, untouched" property is about the PROCESS and is
    // unchanged.
    const tornDownMismatch = tearDownRelaySessionsForGrant(requestId, state);
    // Phase 64, plan 64-03 (XFER-07, D-06): this grant's own bookkeeping is
    // being retired on this branch too (see this function's own header
    // comment for why) -- its staging, if any, goes with it.
    clearStagingForSession(requestId);
    state.grants.delete(requestId);
    const mismatchSuffix = tornDownMismatch.length > 0 ? `; tore down this grant's own relay session(s) on channel(s) ${tornDownMismatch.join(", ")}` : "";
    process.stderr.write(`vice-broker: release for request ${requestId} found a different instance at port ${grant.port} than the one this grant was issued for ` +
        `(grant pid ${grant.pid ?? "null"}, current occupant pid ${instance ? instance.pid ?? "null" : "none"}) -- the grant's own bookkeeping was retired, ` +
        `and the current occupant was left untouched${mismatchSuffix}\n`);
}
async function run(args) {
    // The singleton guard is the kernel-enforced bind below: a control port
    // cannot be bound twice. A failed bind is then arbitrated by dialling the
    // port and asking for a `hello`.
    //
    // The mandatory start-time banner, printed unconditionally and
    // BEFORE anything else in this function runs -- an operator must be told
    // what a Ctrl-C costs before there is anything running for them to Ctrl-C.
    process.stderr.write(`${startupBanner()}\n`);
    const state = createBrokerState();
    const startedAt = new Date().toISOString();
    const pollMs = Number(process.env.VICE_BROKER_POLL_MS) || 500;
    const controlPort = resolveControlPort();
    // Resolve the bind set (BROKER-03/D-09/D-10). An explicitly-set
    // VICE_BROKER_CONTROL_HOST is an operator's OWN choice -- honoured
    // verbatim as the ONLY bind host, refused by name (before any bind
    // attempt is ever made) if it classifies as a wildcard, and never
    // silently narrowed or merged with the enumerated set below (this plan's
    // own transparency prohibition). When the variable is unset, the
    // enumerator is called EXACTLY ONCE, here, and the result is held for
    // this process's entire life (D-10) -- there is no re-enumeration timer
    // and no watch-and-warn anywhere in this file; a bridge that appears
    // later needs a broker restart, and that is documented rather than
    // worked around. `bindHosts[0]` is always the address this startup
    // treats as loopback for fatality purposes below: the explicit-host case
    // has exactly one entry (fatal like every prior version of this
    // function), and enumerateBindHosts() is contracted to always return
    // loopback first.
    const explicitControlHost = process.env.VICE_BROKER_CONTROL_HOST;
    let bindHosts;
    if (explicitControlHost !== undefined && explicitControlHost !== "") {
        if (isWildcardBindHostLocal(explicitControlHost)) {
            process.stderr.write(`vice-broker: FATAL -- VICE_BROKER_CONTROL_HOST is set to "${explicitControlHost}", a wildcard bind address. ` +
                `The settled bind rule (D-09) never binds the wildcard address, even when an operator asks for it explicitly. ` +
                `Set VICE_BROKER_CONTROL_HOST to a specific address, or unset it entirely to let the broker enumerate loopback ` +
                `plus its bridge gateways.\n`);
            process.exitCode = 1;
            return;
        }
        bindHosts = [explicitControlHost];
    }
    else {
        bindHosts = enumerateBindHosts();
        if (bindHosts.length === 0) {
            // Per D-09, this can only happen if loopback itself was not found in
            // the live interface list at all -- an empty BRIDGE subset alone
            // (macOS Docker Desktop's own steady state) never reaches this
            // branch, since enumerateBindHosts() still returns loopback in that
            // case.
            process.stderr.write("vice-broker: FATAL -- no bindable address was found in the live interface list, not even loopback; nothing was bound.\n");
            process.exitCode = 1;
            return;
        }
    }
    const loopbackBindHost = bindHosts[0];
    // The unconditional startup reap runs BEFORE the
    // control listener accepts and before anything is launched. A SIGKILLed
    // prior broker never ran a shutdown path, so this is the only place the
    // "every emulator this project's port band could be squatting is either
    // ours or a human's own work" guarantee can be enforced -- no marker file
    // is consulted, per this reap's own header comment in broker-kill.mts.
    //
    // NOTE: this reap runs UNCONDITIONALLY, before the bind attempt
    // below -- including for a process that goes on to LOSE the singleton
    // race a moment later (see the EADDRINUSE handling below). That ordering
    // is deliberate and already established and tested
    // (broker-kill.test.ts's own structural source-order check); this task
    // does not change it. A losing second broker's own reap pass is an
    // accepted, pre-existing consequence of "the reap is unconditional" --
    // not something the singleton guard below is required to prevent.
    await reapOrphanedInstances({
        stateDir: args.stateDir,
        epochPathFor,
        nextEpochFor,
        writeEpochRecord,
    });
    // Phase 64 (XFER-07, D-08): one MORE startup-only reap, beside the
    // unconditional reap directly above -- never reordering or gating it (its
    // own placement, before the bind attempt and unconditional even for a
    // process that goes on to lose the singleton race, is unchanged, and is
    // already covered by broker-kill.test.ts's own structural source-order
    // check). This pass's own mandatory live-pid and identity guard (D-08)
    // makes it safe here, unconditional, even in a process that goes on to
    // lose the singleton race a moment later: a config-scratch directory whose
    // recorded process is still alive and still identifies as the expected
    // binary is left completely untouched, so a losing second broker's own
    // pass here cannot touch a live emulator's configuration.
    //
    // The staging sweep used to run in this same unconditional block. It has
    // no liveness guard of any kind: a second broker that had not yet lost
    // its bind ran this sweep here and removed a live broker's staging -- see
    // sweepOrphanedStaging()'s own call site, below the confirmed bind, for
    // the fix and the reasoning. A periodic timer was offered and declined
    // for both passes (D-07): it adds an interval to tune and a window where
    // a sweep can race a live transfer, which the startup-only variant
    // structurally cannot. Do not add one back as an "improvement".
    reapOrphanedConfigScratch({ root: brokerConfigScratchDir() });
    // Resolved ONCE here, after the unconditional
    // startup reap and BEFORE the control listener binds -- never re-read per
    // launch, and never called from inside broker-launch.mts's `inFlight`
    // single-owner guard (this call sits entirely outside it; no launch is
    // even possible yet at this point in run()). `supervisorDir: args.stateDir`
    // is passed explicitly -- args.stateDir is now the machine-level state
    // directory broker-home.mts's brokerStateDir() resolves (Phase 64, plan
    // 64-10, G-64-1), NOT a directory under this broker's own `--repo-root`
    // (that binding is gone; see parseArgs() above). This is the SAME
    // directory a client resolves through the same function, without this
    // host-bound module ever importing that container-side resolver directly
    // (backend-detect.mts's own header comment explains why it cannot).
    // There is nothing left to detect -- the resolved
    // `backend` is always `"stock"`; what this call still does is resolve the
    // binary's own identity for the log line below and initialise the
    // capability cache backend-detect.mts's own record depends on. Phase 60
    // (LOC-01/LOC-02): `toolsDir`/`projectRoot` are passed explicitly rather
    // than left to backend-detect.mts's own supervisorDir-derived fallback
    // (PD-03) -- this IS the one real call site with a genuine repoRoot to
    // hand it, so there is no reason to make it guess. This is the ONE call
    // in the whole real broker that ever reaches the tool-location seam; the
    // resolved value below is threaded down through every real launch call
    // site from here, never re-resolved per acquire.
    const backendResult = resolvedBackend({
        supervisorDir: args.stateDir,
        toolsDir: join(args.repoRoot, ".c64-re-tools"),
        projectRoot: args.repoRoot,
    });
    const backend = backendResult.backend;
    // The ONE value this process ever spawns as the emulator binary --
    // resolved once, here, and threaded down through HandleAcquireDeps.viceBin
    // (below) and onHostState's own `viceBin` field (task 2). Never re-read
    // from resolvedBackend() a second time and never re-derived locally.
    const resolvedViceBin = backendResult.binPath;
    process.stderr.write(`vice-broker: backend "${backend}" (binary: ${backendResult.binPath})\n`);
    // Phase 60 gap closure (LOC-03, PD-13/T-60-15): written only when the
    // tool-location seam refused a declared environment-variable override --
    // `backendResult.locationRefusal` is `null` in every other case, including
    // the PD-02 injected-override branch, which never reaches the seam at
    // all. This is the ONE readable record a host operator has of "which
    // binary did this broker refuse to substitute, and why" -- no throw here:
    // this process's own uncaught-exception handlers kill the whole pool, and
    // only one of this broker's callers (the emulator spawn itself) needed
    // this value to be correct.
    if (backendResult.locationRefusal !== null) {
        process.stderr.write(`vice-broker: ${backendResult.locationRefusal}\n`);
    }
    // The singleton guarantee holds only while the control port keeps its default -- two brokers deliberately configured onto different ports are two brokers, and no code prevents that.
    let listener;
    {
        const bindResult = await startControlListenerOnHosts(bindHosts, {
            port: controlPort,
            onAcquire: (requestId, profile, label) => handleAcquire(requestId, args.stateDir, state, {
                backend,
                // The ONCE-resolved `resolvedViceBin` local from this function's
                // own top (LOC-01/LOC-02) -- found missing here by Plan 60-05's
                // own required full-suite baseline diff (broker-e2e.test.ts's
                // "wired disconnect-while-queued" case): this real onAcquire
                // wiring is the ONE production call site that turns a tools.json
                // or VICE_BIN resolution into what the broker actually spawns,
                // and it was never supplying `viceBin` at all -- every unit test
                // calling handleAcquire() directly injects `viceBin` itself, so
                // this gap was invisible until an end-to-end, real-process test
                // exercised the genuine `run()` wiring. Without this, every real
                // acquire silently fell through to broker-launch.mts's own
                // "x64sc"-literal last-resort default, regardless of what
                // tools.json or VICE_BIN named.
                viceBin: resolvedViceBin,
                // Threaded down to
                // acquirePortAndLaunch()'s own gate (backend === "stock"); this
                // callback does not re-read any environment variable itself.
                allocateRemoteMonitorPort: (s, exclude) => nextFreePort(s, { exclude }),
                // The ALREADY-NARROWED
                // profile broker-control.mts handed this callback. Nothing here
                // re-validates it and nothing here reads a raw wire field --
                // normaliseLaunchProfile() is the single narrowing site, and it ran
                // before this callback was ever invoked.
                profile,
                // The ALREADY-SANITISED label
                // broker-control.mts handed this callback (Phase 63, SESS-06).
                // Nothing here re-validates it -- sanitiseSessionLabel() is the
                // single sanitising site, and it ran before this callback was
                // ever invoked.
                sessionLabel: label,
            }),
            onRelease: (requestId) => handleRelease(requestId, state),
            onStatus: () => handleStatus(state),
            onMonitorClaim: (requestId, targetId, channel) => handleMonitorClaim(requestId, targetId, channel, state),
            onMonitorRelease: (requestId, targetId, channel) => handleMonitorRelease(requestId, targetId, channel, state),
            onRelayAttach: (targetId, channel, presentedHandle, socket, pending) => handleRelayAttach(targetId, channel, presentedHandle, socket, pending, state),
            onOperation: (targetId, channel, name) => handleOperationNote(targetId, channel, name, state),
            // Phase 64, plan 64-03 (XFER-04): wired in the SAME options object as
            // the two relay/note callbacks immediately above, never as a second
            // listener.
            onStageFile: (targetId, slot) => handleStageFile(targetId, slot, state),
            onFileTransfer: (request, socket, pendingBytes) => handleFileTransfer(request, socket, pendingBytes, state),
            // Phase 65 (SEAM-01): wired in the SAME options object as the two
            // staging callbacks immediately above, never as a second listener.
            // Deliberately handed no `state` reference: this route reaches
            // only the request's own per-request scratch subtree under
            // brokerStagingDir(), never this broker's acquire/release map.
            onHostToolStage: (files) => handleHostToolStage(files),
            onHostToolRun: (requestKey, raw) => handleHostToolRun(requestKey, raw, args.repoRoot, {
                log: (line) => process.stderr.write(`${line}\n`),
            }),
            onHostToolEnd: (requestKey) => handleHostToolEnd(requestKey),
            onHostState: () => ({
                pid: process.pid,
                startedAt,
                nodeVersion: process.version,
                // The SAME value THIS process just spawned (this function's own
                // `resolvedViceBin` closure binding, above) -- the deleted
                // per-host-state helper this file used to call here re-read the
                // emulator environment variable fresh on every call, which could
                // report a DIFFERENT binary than the one this broker actually
                // launched -- exactly the disagreement LOC-02 exists to remove.
                viceBin: resolvedViceBin,
                maxInstances: resolveCeilingForRecord(),
                basePort: resolveBasePort(),
                // The verdict THIS process resolved once, at
                // startup, above -- kept on the wire because text-tools.ts's own
                // broker-identity cross-check (out of this plan's scope) still reads
                // it. Never a second resolvedBackend() call.
                backend,
            }),
        });
        // A SPECIFIC bridge address failing to bind -- for any reason, port
        // conflict included -- is logged naming that address verbatim and the
        // broker continues on the reduced set; it is NEVER fatal on its own
        // (D-09). An empty bridge subset is a legitimate steady state (macOS
        // Docker Desktop has no host-side bridge interface at all), and this
        // startup cannot tell "every bridge happened to fail" apart from that
        // steady state -- treating either as fatal would refuse a perfectly
        // healthy macOS broker.
        const loopbackFailure = bindResult.failures.find((f) => f.host === loopbackBindHost);
        for (const failure of bindResult.failures) {
            if (failure === loopbackFailure)
                continue;
            const err = failure.error;
            process.stderr.write(`vice-broker: bridge address ${failure.host} failed to bind (${err.code ?? err.message}) -- continuing on the reduced set; ` +
                `this address will not be reachable until the broker is restarted (D-10)\n`);
        }
        // Loopback failing to bind is ALWAYS fatal (D-09). The singleton race
        // closes here: a well-known TCP port cannot be bound twice, so
        // EADDRINUSE is the kernel enforcing the singleton -- but the guarantee
        // holds only while the control port keeps its default (two brokers
        // deliberately configured onto DIFFERENT ports are two brokers, and no
        // code here or anywhere else prevents that). On EADDRINUSE this process
        // dials the port and asks for a `hello`, and takes exactly one of two
        // DISTINCT paths: a completed handshake means it lost a genuine race
        // against a live broker -- exit quietly, status 0, as designed. Anything
        // else means the port is held by something that does not answer as a
        // compatible broker -- fail loudly, naming the port and what to check.
        // Conflating these two would let a squatted port masquerade as a
        // healthy singleton, permanently and silently (T-01.6.2-34). Neither
        // path launches an instance or sweeps staging -- both simply exit.
        if (loopbackFailure) {
            // A bridge address can bind successfully even when loopback itself
            // fails (they are independent sockets) -- every such listener MUST be
            // closed before any of the fatal returns below, or its still-open
            // net.Server keeps this process's event loop alive forever despite
            // `process.exitCode` being set: exitCode alone only takes effect once
            // Node has nothing left to wait for. Never rely on process.exit()
            // here instead -- an abrupt exit would skip flushing the stderr
            // writes above/below it on some platforms.
            for (const bound of bindResult.listeners)
                bound.server.close();
            const err = loopbackFailure.error;
            if (err.code === "EADDRINUSE") {
                const probe = await dialBrokerEndpoint({ port: controlPort, candidates: [loopbackBindHost] });
                if (probe.ok) {
                    process.stderr.write(`vice-broker: another broker (version ${probe.version}) is already running and holds control port ${controlPort} -- exiting quietly as a second instance\n`);
                    process.exitCode = 0;
                    return;
                }
                process.stderr.write(`vice-broker: FATAL -- control port ${controlPort} is held by something that does not answer as a compatible broker. ` +
                    `${describeDialFailure(probe)}\n` +
                    `Check what is bound to port ${controlPort} on the host (e.g. \`lsof -i :${controlPort}\` or \`ss -ltnp\`) before restarting.\n`);
                process.exitCode = 1;
                return;
            }
            process.stderr.write(`vice-broker: failed to start control listener on ${loopbackBindHost}: ${err.message}\n`);
            process.exitCode = 1;
            return;
        }
        if (bindResult.listeners.length === 0) {
            // Unreachable in practice -- a loopback failure above always returns
            // first whenever bindHosts[0] fails to bind -- kept as a defensive
            // guard against a future change silently breaking that invariant.
            // Nothing is open here to close.
            process.stderr.write("vice-broker: FATAL -- no address could be bound at all.\n");
            process.exitCode = 1;
            return;
        }
        const loopbackListener = bindResult.listeners.find((l) => l.host === loopbackBindHost);
        if (!loopbackListener) {
            // Unreachable in practice (loopbackFailure above already covers every
            // way bindHosts[0] can fail) -- still closes every open listener
            // before returning, for the same reason the loopbackFailure branch
            // above does.
            for (const bound of bindResult.listeners)
                bound.server.close();
            process.stderr.write("vice-broker: FATAL -- internal error: loopback bind reported neither success nor failure.\n");
            process.exitCode = 1;
            return;
        }
        // Auditability: an operator can see exactly what is listening -- the
        // bind set is what the whole security posture rests on, since every op
        // is answered with no credential at all (see broker-control.mts's
        // header "Auth:" paragraph).
        process.stderr.write(`vice-broker: bound control listener on: ${bindResult.listeners.map((l) => l.host).join(", ")} (port ${loopbackListener.port})\n`);
        // Auditability for D-13's machine-level fallback (BROKER-01/BROKER-06):
        // an operator can see where THIS broker is writing.
        process.stderr.write(`vice-broker: state directory: ${args.stateDir}\n`);
        process.stderr.write(`vice-broker: ghidra projects directory: ${brokerGhidraDir()}\n`);
        listener = { host: loopbackListener.host, port: loopbackListener.port, pendingAcquires: bindResult.pendingAcquires };
    }
    // The one place this broker calls the staging sweep. A second broker
    // started while a live broker still held the control port used to run
    // this sweep BEFORE it learned (via EADDRINUSE, above) that it had lost --
    // and unconditionally deleted a live broker's staging: every session
    // directory that live broker's own sessions owned, including a disk image
    // attached to unit 8 and a file in the middle of a transfer. Every early
    // return above (a failed loopback bind, a squatted port, a genuine
    // singleton loss) returns before this line is ever reached, so a process
    // that does not own the control port never runs this sweep at all.
    //
    // This process's OWN sessions cannot be caught by it either. The listener
    // is already accepting, but the sweep is synchronous and nothing between
    // the bind resolving and this line awaits, so no connection handler --
    // and therefore no `acquire` or `stage_file` -- can run before the sweep
    // has finished.
    //
    // Never move this call back above the bind -- that reintroduces the
    // defect above. Never put an `await` between the bind and this call --
    // that would let a client stage a file this sweep then removes. Never add
    // a timer (D-07): the sweep runs once, here, in the process that has just
    // confirmed it won the bind.
    //
    // The residual this does NOT cover: a broker deliberately configured onto
    // a different control port, or an explicit control host this process did
    // not bind, while sharing this VICE_BROKER_HOME. That broker wins its OWN
    // bind and reaches this same line, sweeping this same root -- the same
    // scope limit the singleton comment above the bind states for the
    // singleton guarantee itself.
    sweepOrphanedStaging({ root: brokerStagingDir() });
    // The Ghidra projects root, by the same reasoning: a run's project
    // directory outlives its run only when a broker died mid-run, and no run of
    // this process can have started yet.
    sweepOrphanedStaging({ root: brokerGhidraDir(), label: "ghidra projects sweep" });
    // Every catchable shutdown path (SIGTERM/SIGINT/SIGHUP, an uncaught
    // exception, an unhandled rejection, normal exit) converges on ONE
    // re-entrant-safe teardown that identity-verified-kills every instance
    // this broker launched and clears the map unconditionally
    // (kill-never-recycle). Registered once the listener is up, since there is
    // nothing to tear down before that point.
    registerShutdownHandlers({ state });
    // The readiness line. node_exec_path is process.execPath: exec() replaces
    // the process image, so whatever interpreter the launcher resolved IS this
    // process's own execPath by now, and the line stays truthful even when
    // this broker was started directly, bypassing the launcher.
    process.stderr.write(`vice-broker: ready (node ${process.version} at ${process.execPath}, max ${resolveCeilingForRecord()} instances, base port ${resolveBasePort()}, poll ${pollMs}ms${args.dryRun ? ", dry run" : ""}); control listener bound on ${listener.host}:${listener.port}\n`);
    // The fixed-order evaluation pass (runBrokerPass, broker-launch.mts):
    // serve pending acquires, then promote launching -> ready -- mirroring
    // the retiring bash daemon's own broker_once() ordering (the warm floor
    // this pass used to maintain as its second concern is RETIRED; see
    // runBrokerPass()'s own comment in broker-launch.mts for what the fixed
    // order still buys now that only serveAcquires() ever launches anything).
    // Ticks on VICE_BROKER_POLL_MS (default 500, the SAME env var name and
    // semantics the bash daemon used). serveAcquires now drains the
    // arrival-ordered pending-acquire structure this listener instance owns
    // (an early stubbed `serveAcquires: () => {}` comment reserved exactly
    // this room) -- an acquire queued because a launch was
    // already in flight is retried here, on the SAME pass that also promotes
    // any newly-ready instance. Re-entrancy guarded: a pass that is
    // still running (e.g. a slow readiness probe against a genuinely slow
    // host) is never overlapped by the next tick.
    let passInFlight = false;
    setInterval(() => {
        if (passInFlight)
            return;
        passInFlight = true;
        runBrokerPass({
            serveAcquires: () => drainPendingAcquires(listener.pendingAcquires),
            promoteLaunching: () => promoteLaunchingForRealBroker(state, backend),
        })
            .catch((e) => {
            process.stderr.write(`vice-broker: evaluation pass failed: ${e.message}\n`);
        })
            .finally(() => {
            passInFlight = false;
        });
    }, pollMs);
}
/** Parses argv, evaluates the container guard FIRST -- before any state
 * directory is read or written and before anything is spawned -- then
 * runs the long-lived broker. Never calls process.exit(); always sets
 * process.exitCode so pending I/O flushes first. */
export function main(argv = process.argv.slice(2)) {
    let args;
    try {
        args = parseArgs(argv);
    }
    catch (e) {
        process.stderr.write(`${e.message}\n`);
        process.exitCode = 1;
        return;
    }
    if (args.checkContainer) {
        process.exitCode = containerGuardReport();
        return;
    }
    const guardRc = containerGuardEnforce();
    if (guardRc !== 0) {
        process.exitCode = guardRc;
        return;
    }
    run(args).catch((e) => {
        process.stderr.write(`vice-broker: ${e.message}\n`);
        process.exitCode = 1;
    });
}
// -------------------------------------------------------------------- CLI
if (process.argv[1] && resolvePath(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main();
}
