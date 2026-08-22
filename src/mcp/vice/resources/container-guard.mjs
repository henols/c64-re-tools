// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from container-guard.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to tools/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// container-guard.mts
//
// PD-03: TypeScript port of resources/lib/container-guard.sh's five
// container-detection signals, checked at broker PROCESS STARTUP -- not
// only at vice-launcher.sh's shell wrapper. This closes the
// invocation-scoped hole recorded in RE-FINDINGS.md (2026-08-03): running
// the compiled broker directly (bypassing the launcher) was previously
// unguarded, since the bash guard only ever ran inside the scripts that
// sourced it.
//
// Every dependency this needs (filesystem existence/reads, the environment,
// a subprocess runner for systemd-detect-virt) is injected with real
// defaults, so every signal is exercised in a test without a real
// /proc/1/cgroup or a real systemd-detect-virt binary on the machine
// running the test.
import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const defaultDeps = {
    fileExists: (path) => existsSync(path),
    readFile: (path) => readFileSync(path, "utf8"),
    env: process.env,
    runSystemdDetectVirt: () => {
        try {
            return execFileSync("systemd-detect-virt", ["--container"], { encoding: "utf8" }).trim();
        }
        catch {
            return null;
        }
    },
};
/** Matches container-guard.sh's own awk cgroup matcher: the field after the
 * LAST colon on any /proc/1/cgroup line, tested against a container-naming
 * path component. Deliberately does NOT match a systemd host's
 * `0::/init.scope`, a bare root cgroup, or the Docker daemon's own
 * `/system.slice/docker.service` cgroup -- only `/docker/<id>`,
 * `/system.slice/docker-<id>.scope`, `/kubepods/...`, `/libpod-...` and
 * `/lxc/...` match. */
function cgroupNamesContainer(cgroupText) {
    const CONTAINER_PATH = /(^|\/)(docker|lxc|kubepods|libpod)(\/|-|$)/;
    for (const line of cgroupText.split("\n")) {
        const idx = line.lastIndexOf(":");
        if (idx === -1)
            continue;
        const path = line.slice(idx + 1);
        if (CONTAINER_PATH.test(path))
            return line;
    }
    return null;
}
/** Evaluates all five signals and returns one ContainerSignal per signal
 * (fired or not, with its evidence) -- the same two-array shape
 * container_guard_evaluate() builds (CONTAINER_SIGNALS/CONTAINER_REPORT),
 * as one typed return value.
 *
 * REMOVED, DO NOT RE-ADD: a `grep docker /proc/self/mountinfo` signal used
 * to exist here (ported from the bash guard's own header). It answers "is
 * Docker installed on this machine", not "is THIS process inside a
 * container" -- it fires on the real host (which runs the devcontainer
 * daemon) and refuses to launch on exactly the machine this guard exists to
 * allow. Not fixable by tightening the pattern; the signal itself is
 * invalid. It is gone in the bash version and must not come back here
 * either. */
export function evaluateContainerSignals(deps = defaultDeps) {
    const signals = [];
    signals.push({
        description: "/.dockerenv exists",
        fired: deps.fileExists("/.dockerenv"),
        evidence: "",
    });
    signals.push({
        description: "/run/.containerenv exists (podman)",
        fired: deps.fileExists("/run/.containerenv"),
        evidence: "",
    });
    const workspacePath = deps.env.CONTAINER_WORKSPACE_PATH;
    signals.push({
        description: "CONTAINER_WORKSPACE_PATH is set (this devcontainer sets it)",
        fired: Boolean(workspacePath),
        evidence: workspacePath ?? "",
    });
    const detectedVirt = deps.runSystemdDetectVirt();
    const virtFired = detectedVirt !== null && detectedVirt !== "" && detectedVirt !== "none";
    signals.push({
        description: "systemd-detect-virt --container",
        fired: virtFired,
        evidence: detectedVirt === null ? "binary not present, signal skipped" : `reports: ${detectedVirt || "none"}`,
    });
    let cgroupMatch = null;
    if (deps.fileExists("/proc/1/cgroup")) {
        try {
            cgroupMatch = cgroupNamesContainer(deps.readFile("/proc/1/cgroup"));
        }
        catch {
            cgroupMatch = null;
        }
    }
    signals.push({
        description: "/proc/1/cgroup path names a container",
        fired: cgroupMatch !== null,
        evidence: cgroupMatch ?? "no container path component in PID 1's cgroup",
    });
    return signals;
}
/** Prints one report line per signal to stderr and returns 3 in a container
 * (>=1 signal fired), 0 on a host (none fired) -- mirrors
 * container_guard_report()'s exit-code contract exactly. Never calls
 * process.exit() itself (D-4 discipline this module tree observes
 * throughout): the caller (vice-broker.mts's CLI wrapper) turns the
 * returned code into process.exitCode. */
export function containerGuardReport(deps = defaultDeps) {
    const signals = evaluateContainerSignals(deps);
    process.stderr.write("vice-broker: container guard evaluation\n");
    for (const s of signals) {
        if (s.fired) {
            process.stderr.write(`  [FIRED] ${s.description}${s.evidence ? ` -- evidence: ${s.evidence}` : ""}\n`);
        }
        else {
            process.stderr.write(`  [clear] ${s.description}${s.evidence ? ` (${s.evidence})` : ""}\n`);
        }
    }
    const fired = signals.filter((s) => s.fired);
    if (fired.length > 0) {
        process.stderr.write(`verdict: CONTAINER (${fired.length} signal(s) fired) -- the guard would refuse here.\n`);
        return 3;
    }
    process.stderr.write("verdict: HOST (no signals fired) -- the guard would allow x64sc to launch here.\n");
    return 0;
}
/** Evaluates the guard and, if any signal fired, writes a FATAL block naming
 * every fired signal and returns 2 -- UNLESS VICE_SUPERVISOR_ALLOW_CONTAINER
 * is EXACTLY "1" (testing only; never set it to actually run VICE). On a
 * clear host verdict, returns 0 and writes nothing. Mirrors
 * container_guard_enforce()'s escape hatch, wording and exit-code contract
 * verbatim -- never calls process.exit() itself, matching
 * containerGuardReport()'s own posture above. */
export function containerGuardEnforce(deps = defaultDeps) {
    const signals = evaluateContainerSignals(deps);
    const fired = signals.filter((s) => s.fired);
    if (fired.length > 0 && deps.env.VICE_SUPERVISOR_ALLOW_CONTAINER !== "1") {
        process.stderr.write("FATAL: vice-broker refuses to run inside a container.\n");
        process.stderr.write("This process is HOST-ONLY. Signals that fired:\n");
        for (const s of fired) {
            process.stderr.write(`  - ${s.description}${s.evidence ? ` -- ${s.evidence}` : ""}\n`);
        }
        process.stderr.write("\n");
        process.stderr.write("If you believe this IS the host, run --check-container for the full\n");
        process.stderr.write("per-signal breakdown and report which signal is wrong.\n");
        process.stderr.write("\n");
        process.stderr.write("This cannot work in here: there is no x64sc binary, no display, and\n");
        process.stderr.write("the entire point of this process is to launch or supervise a process\n");
        process.stderr.write("the container has no access to in the first place.\n");
        process.stderr.write("\n");
        process.stderr.write("Escape hatch (TESTING ONLY -- never to actually run VICE):\n");
        process.stderr.write("  VICE_SUPERVISOR_ALLOW_CONTAINER=1\n");
        process.stderr.write("\n");
        process.stderr.write("Run this broker on the HOST instead, from the host workspace.\n");
        return 2;
    }
    return 0;
}
// -------------------------------------------------- environment predicate
//
// containerGuardReport()/containerGuardEnforce() above answer "should this
// process REFUSE to run here". This answers the different question "which
// environment am I in", for callers that must CHOOSE behaviour rather than
// refuse -- specifically vice.ts's mcpHost(), which has to return the
// container-visible bridge alias inside a container and a loopback address
// on a host, because `host.docker.internal` is a Docker-provided alias that
// does not resolve on the host at all.
//
// It shares this module's detection deliberately rather than growing a
// second, weaker copy. That is the exact mistake this file's own header
// records for the REMOVED /proc/self/mountinfo signal: an independent
// "looks dockery" heuristic fired on the real host -- the machine running
// the devcontainer daemon -- and so answered the wrong question. Any new
// detector would risk re-earning that bug; this one is already calibrated
// against precisely the host-versus-container distinction being asked here.
//
// The verdict rule is not invented here: it is the one containerGuardReport()
// and containerGuardEnforce() both state -- >=1 signal fired means CONTAINER,
// none fired means HOST.
/** Memoised verdict for the default-deps path only. */
let cachedDefaultVerdict = null;
/** True inside a container, false on a host.
 *
 * MEMOISED on the default-deps path, deliberately: one of the five signals
 * shells out to `systemd-detect-virt`, and mcpHost() is read fresh on EVERY
 * forwarded tool call -- spawning a subprocess per call would be a real cost
 * for an answer that cannot change. Container membership is fixed for a
 * process lifetime, so caching the verdict is safe. Note what is NOT cached:
 * the caller's own env-var read (`VICE_MCP_HOST`) stays fresh, preserving the
 * override-sensitivity mcpHost()'s comment says a module-level constant would
 * have silently destroyed.
 *
 * Passing explicit deps ALWAYS re-evaluates and never touches the cache, so
 * tests can drive both branches in-process, in any order, without one test's
 * verdict leaking into another's. */
export function isInsideContainer(deps) {
    if (deps)
        return evaluateContainerSignals(deps).some((s) => s.fired);
    if (cachedDefaultVerdict === null) {
        cachedDefaultVerdict = evaluateContainerSignals(defaultDeps).some((s) => s.fired);
    }
    return cachedDefaultVerdict;
}
