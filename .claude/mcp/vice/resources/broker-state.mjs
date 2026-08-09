// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-state.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
import { createServer } from "node:net";
export function createBrokerState() {
    return { instances: new Map(), grants: new Map(), blockedPorts: new Set() };
}
/** Deep, plain-object copy of `state` for tests -- a real, typed, named
 * export imported directly by test files, modelled on build.ts's own
 * exported build(). Never a global, never a subprocess-and-inspect round
 * trip. */
export function _snapshotState(state) {
    return {
        instances: Array.from(state.instances.values()).map((r) => ({ ...r, viceArgs: [...r.viceArgs] })),
        grants: Array.from(state.grants.values()).map((g) => ({ ...g })),
        blockedPorts: Array.from(state.blockedPorts).sort((a, b) => a - b),
    };
}
/** VICE_BROKER_BASE_PORT's default (D-18): the broker's port band moves
 * from 6510 to 6600 in this phase -- 6510-6599 stays reserved by convention
 * for an x64sc a human launches for their own work. */
export const DEFAULT_BASE_PORT = 6600;
/** Scan ceiling matching vice-broker.sh's own next_free_port(): exactly one
 * hundred candidates starting at (and including) the base port. Bounded so
 * an exhausted host produces one explicit `no_free_port` result rather than
 * an unbounded scan. */
const PORT_SCAN_CEILING = 100;
/** Exported (plan 05): vice-broker.mts's host_state control-plane response
 * and broker.json's own `base_port` field both need the SAME resolved base
 * port this allocator itself uses -- reading it here rather than
 * re-duplicating the env-var lookup a third time keeps the two values
 * structurally unable to disagree. */
export function resolveBasePort() {
    const raw = process.env.VICE_BROKER_BASE_PORT;
    if (raw === undefined || raw === "")
        return DEFAULT_BASE_PORT;
    const n = Number(raw);
    return Number.isFinite(n) ? n : DEFAULT_BASE_PORT;
}
/** Real default: attempts to bind the candidate port on 127.0.0.1 and
 * immediately releases it. Answers ONLY "is a TCP listener already bound
 * here" -- the exact question vice-broker.sh's own /dev/tcp-based
 * port_in_use() asked, and deliberately never reused as a readiness check
 * (see broker-launch.mts's probeReady() header comment for why those two
 * questions are never conflated: a C64 can accept a connection before it
 * has finished booting). EADDRINUSE means genuinely in use; any other
 * listen error is treated as "not in use" -- cheaper and clearer than
 * letting a launch fail later for an unrelated reason. */
export function defaultPortInUse(port) {
    return new Promise((resolve) => {
        const server = createServer();
        server.once("error", (err) => {
            resolve(err.code === "EADDRINUSE");
        });
        server.once("listening", () => {
            server.close(() => resolve(false));
        });
        server.listen(port, "127.0.0.1");
    });
}
export function isPortBlocked(state, port) {
    return state.blockedPorts.has(port);
}
/** Remembers a refused port for the lifetime of THIS broker process only --
 * never persisted. A port refused now may be free after the next reboot;
 * persisting the refusal would silently shrink the allocation band
 * forever. Idempotent: blocking an already-blocked port is a no-op. */
export function blockPort(state, port) {
    state.blockedPorts.add(port);
}
/** Allocates the lowest free port at or above the base port (default 6600
 * per D-18, overridable via VICE_BROKER_BASE_PORT -- the same env var name
 * the bash daemon used), scanning up to PORT_SCAN_CEILING candidates.
 * "Free" means: not already recorded in the instance map (granted,
 * launching or ready all occupy their port), not already in the
 * process-scoped blocked set, and not reported in use by the injectable
 * port-in-use probe (defaulting to defaultPortInUse's real bind-and-release
 * check). A candidate the probe reports as in use is added to the blocked
 * set before scanning continues, so it is never re-offered or re-probed by
 * this process again. Never throws -- returns a typed failure naming
 * exhaustion when every candidate in the window is taken. */
// Gap closure (plan 14, discovered live during Task 2's own end-to-end
// proof -- see RE-FINDINGS.md's dated entry for the full account):
// EADDRINUSE is delivered to defaultPortInUse()'s `error` listener without
// ever yielding to libuv's poll phase, so a scan running against MANY
// already-bound candidates in a row does not merely take longer -- for its
// ENTIRE duration, the control listener cannot accept a new connection or
// read data already sitting on an existing one (verified live: a second,
// already-established connection's own request was not read by this
// process until the ENTIRE scan, spawn and record sequence had already
// resolved, confirmed with the real production functions in isolation
// before this fix). That is a real liveness gap independent of this
// plan's own test -- a release, a recycle or a status request over an
// UNRELATED connection would be held up for as long as a contended scan
// takes, not merely a competing acquire. Yielding via setImmediate every
// few candidates restores that liveness at negligible cost (the scan
// itself already costs one real bind-and-release round trip per
// candidate; this adds one cheap timer-phase turn every YIELD_EVERY of
// them) without changing what this function returns for any input.
const YIELD_EVERY_N_CANDIDATES = 5;
export async function nextFreePort(state, opts = {}) {
    const basePort = opts.basePort ?? resolveBasePort();
    const portInUse = opts.portInUse ?? defaultPortInUse;
    const limit = basePort + PORT_SCAN_CEILING;
    let checked = 0;
    for (let port = basePort; port < limit; port++) {
        if (state.instances.has(port))
            continue;
        if (isPortBlocked(state, port))
            continue;
        if (await portInUse(port)) {
            blockPort(state, port);
            checked++;
            if (checked % YIELD_EVERY_N_CANDIDATES === 0) {
                await new Promise((resolvePromise) => setImmediate(resolvePromise));
            }
            continue;
        }
        return { ok: true, port };
    }
    return { ok: false, reason: "no_free_port" };
}
/** Counts ready, unclaimed instances -- filters the SAME in-memory map every
 * other count reads, no filesystem access anywhere in this expression. */
export function countReady(state) {
    let n = 0;
    for (const record of state.instances.values()) {
        if (record.state === "ready")
            n++;
    }
    return n;
}
/** Counts every launched instance regardless of state (launching, ready or
 * granted) -- the denominator of the total <= VICE_BROKER_MAX ceiling. */
export function countTotal(state) {
    return state.instances.size;
}
/** Counts instances currently "launching" -- THE single counter both launch
 * paths (a cold acquire, via handleAcquire in vice-broker.mts, and warm
 * floor maintenance, via maintainWarmFloor in broker-launch.mts) consult
 * before starting a new launch. Two counters that could ever disagree about
 * whether a boot is already under way is exactly how the two bash launch
 * paths raced each other into the 2026-08-01 outage (three simultaneous
 * x64sc launches: one SEGV, one exit 1, one exit 0 at the identical spawn
 * second) -- there is now exactly one, read here and nowhere else. */
export function countLaunching(state) {
    let n = 0;
    for (const record of state.instances.values()) {
        if (record.state === "launching")
            n++;
    }
    return n;
}
function resolveCeiling(override) {
    if (typeof override === "number")
        return override;
    const raw = process.env.VICE_BROKER_MAX;
    if (raw === undefined || raw === "")
        return 16;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 16;
}
/** True once countTotal() has reached the configured instance ceiling
 * (VICE_BROKER_MAX, default 16, untouched by this phase). A cold acquire
 * consults this BEFORE attempting to allocate a port or spawn (plan 05's
 * control-plane `at_capacity` error code), so an at-capacity host answers
 * without ever touching the port allocator. */
export function atCapacity(state, ceiling) {
    return countTotal(state) >= resolveCeiling(ceiling);
}
