// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-children.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.ts copies THIS file's on-disk contents
// verbatim to .c64-re-tools/local/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-children.mts
//
// WHY THIS FILE EXISTS: the one registry of every process the broker started
// -- emulators and host tools -- each in its own process group, so any stop
// of the broker can stop all of them and their descendants (Ghidra's
// analyzeHeadless starts a JVM that outlives a pid-only kill).
//
// WHAT NOT TO DO:
//   - Never spawn a broker child without `detached: true` (its own process
//     group) and trackChild(). A child outside the registry survives a stop.
//   - Never signal only a pid when stopping a child: signal its group (-pid).
const defaultKill = (pid, signal) => {
    process.kill(pid, signal);
};
/** Signals the process group `pid` leads; falls back to the pid alone when
 * no such group exists (a child that was never a group leader). Never
 * throws: a group already gone is the goal. */
export function signalGroup(pid, signal, kill = defaultKill) {
    try {
        kill(-pid, signal);
        return;
    }
    catch {
        // no such group -- try the pid itself
    }
    try {
        kill(pid, signal);
    }
    catch {
        // already gone
    }
}
/** True while any process in the group `pid` leads (or the pid itself) exists. */
export function isGroupAlive(pid, kill = defaultKill) {
    for (const target of [-pid, pid]) {
        try {
            kill(target, 0);
            return true;
        }
        catch {
            // not this one
        }
    }
    return false;
}
/** Registers a child the broker just spawned. When the child exits, the
 * rest of its group is killed too -- a descendant never outlives the
 * process the broker started -- and the child leaves the registry. */
export function trackChild(state, child, kind, kill = defaultKill) {
    const pid = child.pid;
    // A test stand-in with no exit event is not a real process to track.
    if (typeof pid !== "number" || typeof child.once !== "function")
        return;
    state.children.set(pid, { pid, kind });
    state.childListener?.({ op: "track", pid });
    child.once("exit", () => {
        // The child is reaped, so its pid may already belong to another process.
        // Only the group it led is signalled: a group id stays ours while any
        // descendant lives, and signalling it never reaches a reused bare pid.
        try {
            kill(-pid, "SIGKILL");
        }
        catch {
            // no descendants left
        }
        state.children.delete(pid);
        state.childListener?.({ op: "untrack", pid });
    });
}
/** Stops every tracked child's whole process group: SIGTERM to all at once,
 * a bounded wait, then SIGKILL to every group still alive. Returns how many
 * groups it signalled. */
export async function stopAllChildren(state, opts = {}) {
    const kill = opts.kill ?? defaultKill;
    const sleepMs = opts.sleepMs ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    const killWaitMs = opts.killWaitMs ?? 5000;
    const pids = [...state.children.keys()];
    for (const pid of pids)
        signalGroup(pid, "SIGTERM", kill);
    let waitedMs = 0;
    while (waitedMs < killWaitMs && pids.some((pid) => isGroupAlive(pid, kill))) {
        await sleepMs(100);
        waitedMs += 100;
    }
    for (const pid of pids) {
        if (isGroupAlive(pid, kill))
            signalGroup(pid, "SIGKILL", kill);
    }
    return pids.length;
}
/** SIGKILLs every tracked group synchronously -- for the process 'exit'
 * event, where nothing asynchronous can run. */
export function killAllChildrenNow(state, kill = defaultKill) {
    for (const pid of state.children.keys())
        signalGroup(pid, "SIGKILL", kill);
}
