// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-launch.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-launch.mts
//
// This module owns three concerns that started life separately and were
// folded together here: the single `in_flight` launch-guard owner -- every
// launch call site in the whole broker goes through tryLaunchOne(), which
// is what makes the single-owner guarantee mechanical rather than a
// convention a concurrency race test could silently violate -- PLUS the
// readiness probe's single in-process mechanism (collapsed from a
// three-way branch down to one; see probeReady()'s own header comment
// below for the full record of that collapse and its later amendment),
// the launching -> ready promotion sweep (promoteLaunchingInstances() --
// this used to be step one inside a warm-floor maintenance function that
// speculatively pre-launched spare instances; that floor is RETIRED and
// VICE now launches strictly on demand, but the promotion sweep outlived
// it), and the fixed-order evaluation pass both surviving concerns run
// through.
//
// This file also grew a real per-child supervisor: superviseChild()
// launches an instance through tryLaunchOne() (the SAME single guarded
// primitive above) and installs an exit handler on the spawned child that
// respawns on crash (doubling backoff, clamped at a ceiling), gives up
// cleanly after too many crashes inside a window, never respawns a
// deliberately-killed instance, and writes the per-instance boot/crash log
// at the exact path shape the retiring bash supervisor used.
import { spawn as nodeSpawn } from "node:child_process";
import { mkdirSync, mkdtempSync, openSync, closeSync, existsSync } from "node:fs";
import { join, basename } from "node:path";
import { tmpdir } from "node:os";
// Module-level: this file, not the caller, owns the single boolean --
// synchronous check, synchronous set, released in a finally, with no
// `await` between the check and the set.
//
// Launch PRIORITY is layered on this owner, and never replaces or weakens
// it. An in-flight boot always completes and is NEVER killed or abandoned
// to serve a later arrival -- preemption was considered and rejected
// because a kill/relaunch overlap re-creates the exact concurrent-spawn
// window the 2026-08-01 outage came from (one SEGV, one exit 1, one exit 0
// at the identical spawn second). Once a boot reaches `ready`, a waiting
// request takes it
// regardless of which reason booted it (vice-broker.mts's
// selectWarmInstance() performs no `reason` check at all -- proven by
// vice-broker-acquire.test.ts). Priority governs only which REASON wins
// this slot once it next frees, via the fixed pass order (runBrokerPass()'s
// own invariant comment, below) -- it never decides who currently holds it.
let inFlight = false;
// The reason currently holding the slot, alongside `inFlight` -- metadata
// only, never a second guard: nothing branches on this value's presence to
// decide whether a launch may proceed (that is `inFlight` alone, checked
// and set synchronously exactly as before). Its only consumer is the
// launch-slot decision log line: a lifecycle decision must be
// reconstructable from the log after an incident -- both the 2026-08-01
// and 2026-08-02 outages were diagnosed from broker log lines.
let inFlightReason = null;
/** True while a launch is in progress -- exported for the race test plan 02
 * writes against two concurrent tryLaunchOne() calls. */
export function isLaunchInFlight() {
    return inFlight;
}
// Gates the stock binmon-bind-widened stderr note below so a long-running
// broker (or a test suite driving buildViceArgs() many times) emits it at
// most once per process -- the repo-root.ts `warnedEnvOutsideFrom` gate
// pattern, reused here.
let warnedBinmonBindWidened = false;
// The SAME one-time-note idiom as warnedBinmonBindWidened above, for the
// SECOND (`-remotemonitor`) port's bind -- a separate boolean because the
// two flags widen independently (a caller could widen one host override
// and not the other, though in practice both resolve from the same
// `binmonHost` value below).
let warnedRemoteMonitorBindWidened = false;
/** The random seed the stock determinism block pins, and the exact value
 * the reproduction was measured with on this host -- exported so a capture
 * record's reproducibility key can cite ONE definition rather than
 * re-deriving a literal that could silently drift away from the launches it
 * claims to describe. MEASURED 2026-09-02 against genuine stock 3.9 over
 * `-binarymonitor`: two cold boots WITHOUT the block differ at 59 of the
 * 4080 addresses in the untouched `$C000-$CFEF` window; WITH it, at 0 of
 * 4080. */
export const STOCK_DETERMINISM_SEED = 4242;
/** The determinism block, in ONE fixed order, emitted UNCONDITIONALLY by
 * the stock branch below (never gated on `profile` -- see buildViceArgs()'s
 * own comment above `args`). Exported and frozen so tests and evidence
 * scripts assert against this single definition instead of a second
 * hand-copied array, and so no caller can mutate the shared value into a
 * launch that no longer matches the recorded seed.
 *
 * The order is fixed and load-bearing beyond readability: capture records
 * key on an argv digest, so a block whose element order varied between two
 * launches on the same port would produce two digests for one launch
 * intent. */
export const STOCK_DETERMINISM_FLAGS = Object.freeze([
    "-seed",
    String(STOCK_DETERMINISM_SEED),
    "-raminitstartrandom",
    "0",
    "-raminitrepeatrandom",
    "0",
    "-raminitrandomchance",
    "0",
    "+autostart-delay-random",
]);
/** Resolves the emulator's own argument vector for the given `backend`. The
 * `VICE_ARGS` full-override short-circuit (matching
 * resources/vice-supervisor.sh's own VICE_ARGS convention exactly) is
 * checked FIRST, ahead of either backend branch, and stays unchanged for
 * both: it exists because this broker's own tests (and an operator's manual
 * dry runs) need to launch a stand-in binary (e.g. /bin/sleep) that
 * understands neither `-mcpserver` nor `-binarymonitor` flags, and that need
 * does not depend on which backend is configured.
 *
 * `backend: "stock"` (the only value `ViceBackend` has, now that the fork
 * backend is gone) returns `-binarymonitor -binarymonitoraddress
 * ip4://<host>:<port>`, the confirmed real-world command line. The host
 * resolves from `binmonHost` or VICE_BROKER_BINMON_HOST, defaulting to
 * `127.0.0.1` -- deliberately narrow, because VICE's binary monitor is
 * unauthenticated by design and grants full read/write over the emulated
 * machine plus process control to anything that can reach it. Widening the
 * bind away from loopback emits exactly one stderr note per process,
 * naming the resolved bind address and what the exposure grants.
 *
 * When `remoteMonitorPort` is a number, the stock branch APPENDS
 * `-remotemonitor -remotemonitoraddress ip4://<host>:<remoteMonitorPort>`,
 * reusing the SAME resolved `host` value the binmon address already used --
 * one resolution, not two. When `remoteMonitorPort` is omitted (undefined),
 * the returned argv is byte-identical to what this function always
 * returned -- no `-remotemonitor` at all. `-remotemonitoraddress`'s exact
 * spelling was live-probed against a real fork-3.10 binary and CONFIRMED:
 * the flag bound a real, accepting text-monitor listener, corroborated
 * independently by `ss -ltnp`. Genuine stock 3.9 was not independently
 * probed in that run -- the spelling itself is a symmetrical CLI flag pair
 * and is not version-sensitive, so this is recorded as a low-risk
 * carry-forward rather than implied stock-3.9 coverage. Widening THIS bind
 * away from loopback emits its own one-time stderr note
 * (`warnedRemoteMonitorBindWidened`), naming the resolved address and
 * stating that VICE's TEXT monitor accepts arbitrary monitor commands and
 * is unauthenticated. text-connect.ts's textConnect() dials this port, and
 * it is MANDATORY on every stock launch -- a stock launch that cannot bind
 * it now fails the whole acquire rather than launching without it, because
 * the flag has to be set at launch time: adding it later would require
 * relaunching a live instance, destroying all emulation state.
 *
 * The stock branch also emits STOCK_DETERMINISM_FLAGS unconditionally, and
 * takes an optional `profile` for the two additive launch knobs. Deliberately
 * in the same register as tryLaunchOne's own widened `spawn` field below,
 * and for the same reason: `profile` is optional, so every pre-existing
 * caller and every pre-existing test stub keeps compiling and behaving
 * identically, and an ABSENT profile produces exactly the same argv as an
 * empty one or one whose knobs are both `false`. What optionality could NOT
 * save: the determinism block is unconditional on stock, so all FIVE stock
 * whole-argv assertions in broker-launch.test.ts move even with `profile`
 * absent -- it is the block and not the profile that moves them. The
 * byte-identity claim therefore survives in full only for the `profile`
 * half: an absent profile adds no flag. */
export function buildViceArgs(port, { backend, mcpHost, binmonHost, viceArgsEnv, remoteMonitorPort, profile, }) {
    const rawViceArgs = viceArgsEnv ?? process.env.VICE_ARGS;
    if (typeof rawViceArgs === "string" && rawViceArgs.trim() !== "") {
        return rawViceArgs.trim().split(/\s+/);
    }
    if (backend === "stock") {
        const host = binmonHost ?? process.env.VICE_BROKER_BINMON_HOST ?? "127.0.0.1";
        if (host !== "127.0.0.1" && !warnedBinmonBindWidened) {
            warnedBinmonBindWidened = true;
            process.stderr.write(`vice-broker: stock binary-monitor bind widened to ${host} -- VICE's binary monitor is ` +
                `unauthenticated and grants full memory read/write plus process control to anything that can ` +
                `reach it; the default of 127.0.0.1 is the safe posture for a host-native install, widen only ` +
                `when the MCP server itself runs in a container that must reach the host emulator\n`);
        }
        // Audit item I-2 (§4.2, FINDING-C1): a broker-launched stock x64sc used
        // to boot with Drive8Type=0 (NONE) -- nothing answers unit 8, so
        // LOAD"*",8,1 fails ?DEVICE NOT PRESENT ERROR and the entry-point
        // checkpoint never hits. No stock MCP tool can correct this after boot
        // (the 38-tool stock manifest has zero resource-set names by design),
        // so the fix must be a launch-time flag. `-default` MUST be the very
        // first element: it is VICE's reset-to-compiled-in-defaults instruction,
        // not an inert "these are the baselines" no-op, so any flag emitted
        // before it (including -drive8type) is silently clobbered back to its
        // compiled-in value. `-drive8type 1541` therefore has to come AFTER
        // `-default` -- not necessarily IMMEDIATELY after -- and -- per
        // CLAUDE.md's documented constraint -- `-default` also has to come before
        // `-binarymonitor` or the monitor never binds and the subsequent connect
        // hangs in the backlog looking exactly like a wedge.
        //
        // WORDING CORRECTED. This paragraph used to say "immediately after
        // `-default`", which the `-console` block below now violates by
        // construction whenever `profile.headless` is set -- leaving the next
        // editor to find code contradicting the comment and having to re-derive
        // which one is authoritative. What is load-bearing is the RELATIVE
        // ORDER (`-default` precedes everything it resets), not adjacency.
        //
        // The `-console` block's own citation was `alive=yes bound=1`, which does
        // NOT cover this paragraph's property: the failure mode this flag guards
        // against is Drive8Type silently reverting to 0 (NONE) WHILE THE MONITOR
        // STILL BINDS FINE, so liveness and boundness cannot tell the good case
        // from the failure being guarded against. Re-verified against the
        // resource itself
        // [VERIFIED: live probe 2026-09-03, genuine unpatched stock
        // /usr/bin/x64sc (VICE 3.9), DISPLAY and WAYLAND_DISPLAY both unset]:
        //   [-default -console -drive8type 1541 <determinism> -binarymonitor]
        //     alive=yes bound=1  Drive8Type=1541  Drive8TrueEmulation=1
        // read over `RESOURCE_GET` (0x51) with `-console` interposed. So the
        // citation now covers the RESOURCE and not only liveness. Confirmed
        // sufficient live in a standalone probe:
        // `resourceget "Drive8Type"` moved 0 -> 1541 and a `load` over the text
        // monitor succeeded immediately. Deliberately NOT setting
        // -drive8truedrive / Drive8TrueEmulation here: this build's own default
        // already reads Drive8TrueEmulation=1 (same probe), so only
        // `-drive8type` needs adding.
        // A different stock build might default Drive8TrueEmulation to 0,
        // which is read and deliberately not pre-emptively defended against
        // here; a live test against that build is what would surface it if
        // this assumption is ever wrong there.
        //
        // The headless route is `-console`, and its POSITION is as
        // load-bearing as `-default`'s. `-console` is handled in the SAME
        // `main.c` pre-scan as `-default` -- that loop `break`s at the first
        // option it does not recognise and then strips the prefix it handled
        // from argv
        // [CITED: vice-3.8/src/main.c:184-192, 232-238] -- and `console_mode`
        // gates GTK initialisation at two call sites (`ui_init_with_args`,
        // `ui_init`) that BOTH run before the late command-line parser
        // `initcmdline_check_args()` [CITED: vice-3.8/src/main.c:296-345]. A
        // `-console` seen only by the late parser therefore arrives after GTK has
        // already tried and failed. MEASURED 2026-09-02 with `DISPLAY` and
        // `WAYLAND_DISPLAY` both unset:
        //   [-default -console -binarymonitor]                    alive=yes bound=1
        //   [-default -drive8type 1541 -console -binarymonitor]   alive=no  bound=0  Gtk-WARNING: cannot open display:
        //   [-default -console -drive8type 1541 -binarymonitor]   alive=yes bound=1
        // So `-console` goes immediately after `-default` and BEFORE
        // `-drive8type` -- which is compatible with the paragraph above as
        // corrected: that constraint is `-drive8type` AFTER `-default`, not
        // adjacent to it, and the interposition was re-verified over
        // `RESOURCE_GET` to leave Drive8Type=1541 rather than only to leave
        // the monitor bound. It is pinned by an ordering assertion rather than by
        // this comment -- a bare flag push with no reason is exactly what let the
        // `-default` ordering constraint be rediscovered by a red CI run last
        // time.
        //
        // The determinism block is emitted UNCONDITIONALLY on stock, never
        // gated on `profile`. Read over `RESOURCE_GET` (0x51) on this build
        // under `-default -drive8type 1541`
        // [VERIFIED: live probe 2026-09-02],
        // `-raminitrandomchance 0` is the LOAD-BEARING one: the factory value is
        // **10**, i.e. 0.1% of all RAM bits randomly flipped at power-up, and it is
        // the dominant term in the divergence this milestone removes. The
        // `-raminitstartrandom 0` / `-raminitrepeatrandom 0` pair already reads 0
        // at factory and is DEFENSIVE against an operator `vicerc` -- belt and
        // braces alongside the scratch `XDG_CONFIG_HOME` threaded in
        // spawnAndRecordInstance() below.
        //
        // `+autostart-delay-random` is a FIFTH flag beyond the determinism
        // block's own headline text (which names only `-seed` plus the three
        // `raminit*`), recorded here as a deliberate ADDITION rather than
        // smuggled in. `AutostartDelayRandom`
        // ships at **1** on this build [VERIFIED: same probe], it draws an
        // additional random delay of up to 10 frames
        // [CITED: vice-3.8/src/autostart.c:1432-1436], and -- the effect that is
        // easy to miss -- it also SELECTS WHICH keyboard-buffer feed injects `RUN`
        // (`kbdbuf_feed_runcmd` when set, `kbdbuf_feed` when clear)
        // [CITED: vice-3.8/src/autostart.c:882-886]. Disabling it is therefore a
        // behavioural change and not only a timing one. Pin it once; never toggle
        // it between the two runs of a capture pair.
        //
        // `-warp` is position-free (MEASURED 2026-09-02), placed here only so
        // the argv reads in the order a human would describe it. Launch-time is
        // the ONLY route on stock: there is no runtime `WarpMode` resource at
        // all (`RESOURCE_GET` replies `err=0x01` OBJECT_MISSING on 3.9), so no
        // runtime setter can exist here. Worth roughly **1.97x** on this host
        // and this launch profile -- 5.23 emulated seconds against 2.65 over
        // the same 5 s wall clock [MEASURED: evidence/33-wallclock-control.md,
        // Control B instance 1] -- and NOT the order of magnitude a reader may
        // assume; `AUTOSTART` additionally turns warp on by itself during the
        // load whatever argv says, so both loads are warped either way. It is
        // behaviour-neutral under a frame-anchored protocol (identical registers
        // and one identical 64K sha256 across a warped and an unwarped run, same
        // source), which is a precondition for shipping `profile.warp`; it is
        // NOT neutral for a wall-clock bracket, which it invalidates by 1.76x.
        const args = ["-default"];
        if (profile?.headless) {
            args.push("-console");
        }
        args.push("-drive8type", "1541");
        args.push(...STOCK_DETERMINISM_FLAGS);
        if (profile?.warp) {
            args.push("-warp");
        }
        args.push("-binarymonitor", "-binarymonitoraddress", `ip4://${host}:${port}`);
        if (typeof remoteMonitorPort === "number") {
            if (host !== "127.0.0.1" && !warnedRemoteMonitorBindWidened) {
                warnedRemoteMonitorBindWidened = true;
                process.stderr.write(`vice-broker: stock text (-remotemonitor) monitor bind widened to ${host} -- VICE's text monitor ` +
                    `accepts arbitrary monitor commands and is unauthenticated, exactly like the binary monitor; the ` +
                    `default of 127.0.0.1 is the safe posture for a host-native install, widen only when the MCP server ` +
                    `itself runs in a container that must reach the host emulator\n`);
            }
            args.push("-remotemonitor", "-remotemonitoraddress", `ip4://${host}:${remoteMonitorPort}`);
        }
        return args;
    }
    const host = mcpHost ?? process.env.VICE_BROKER_MCP_HOST ?? "0.0.0.0";
    return ["-mcpserver", "-mcpserverhost", host, "-mcpserverport", String(port)];
}
/** The unguarded spawn+record primitive -- no in_flight check here at all.
 * Called from exactly two places: tryLaunchOne() below (which wraps it in
 * the standalone synchronous guard) and acquirePortAndLaunch() further
 * down (which holds that SAME guard across its own async port-allocation
 * step first, then calls this directly so the guard is never
 * double-checked against itself). Spawns via deps.spawn (defaulting to
 * Node's own child_process.spawn), records the resolved binary path at
 * spawn time into the instance record's expectedIdentity field -- the
 * string the kill discipline (broker-kill.mts) checks identity against,
 * and the VICE_BIN binary this broker spawns directly, never any
 * intermediate script path. Logs the resolved command line before
 * spawning, so a bad configuration value is visible rather than silently
 * mis-parsed, exactly like the bash launcher's own logging discipline. */
function spawnAndRecordInstance(reason, port, deps) {
    const spawnFn = deps.spawn ?? ((cmd, args, opts) => nodeSpawn(cmd, args, opts));
    const now = deps.now ?? (() => Date.now());
    // Phase 60 (LOC-02): no environment-variable fallback here any more -- the
    // real broker resolves the binary ONCE at startup through backend-detect.mts's
    // resolvedBackend() (which itself now consults the tool-location seam) and
    // threads that SAME value down through deps.viceBin on every call. The
    // literal "x64sc" default below is only ever reached by a caller (a test)
    // that supplies neither.
    const viceBin = deps.viceBin ?? "x64sc";
    const backend = deps.backend ?? "stock";
    // The ONE construction site for a fresh InstanceRecord asserts the
    // invariant every downstream consumer (HeldLease, textConnect(), etc.) was
    // written against -- a stock record NEVER lacks a text-monitor port.
    // acquirePortAndLaunch() above already fails the whole acquire before ever
    // reaching this function when the second allocation fails, so a caller
    // that lands here with `backend: "stock"` and no `remoteMonitorPort` is a
    // defect in THIS module (a call site that bypassed that guarantee), not a
    // state a stock record may legitimately carry -- throw by name rather
    // than silently writing a record that violates it.
    // The fork case is real and unaffected: this check is stock-only.
    if (backend === "stock" && deps.remoteMonitorPort === undefined) {
        throw new Error("spawnAndRecordInstance: backend \"stock\" requires remoteMonitorPort -- a stock launch that cannot bind a text-monitor port must fail the acquire before reaching this construction site, never write a portless stock record");
    }
    const viceArgs = buildViceArgs(port, {
        backend,
        mcpHost: deps.mcpHost,
        binmonHost: deps.binmonHost,
        remoteMonitorPort: deps.remoteMonitorPort,
        // The ONE place a launch's profile becomes argv. The record built
        // below mirrors the SAME value, so an instance's recorded profile and
        // its actual argv are written in one step and cannot disagree.
        profile: deps.profile,
    });
    const log = deps.log ?? defaultLog;
    // Production stock launches used to set no scratch XDG_CONFIG_HOME and
    // would read whatever vicerc the operator's own $HOME already carried --
    // shared with the operator's own VICE usage and with the fork build. For
    // backend === "stock" only, compute a fresh, isolated config dir with
    // mkdtempSync (atomic creation, random suffix, 0700 permissions -- the
    // primitive that makes a collision or a symlink-swap into the operator's
    // real config unreachable) and pass it as a third options argument
    // carrying `env` only. Never `shell: true`: the existing array-form
    // spawn(viceBin, viceArgs) call avoids shell interpretation entirely and
    // that property must survive this widening.
    //
    // Scope boundary (do not remove this note): the production broker daemon
    // always supplies its own deps.spawn / deps.spawnFactory, so the widened
    // default wrapper above is dead code on the real launch paths. This
    // function's job is only to COMPUTE the value at the one seam that should
    // own it; the forwarding to nodeSpawn() happens at three further hops --
    // makeLoggingSpawn() in vice-broker.mts, and withCrashSupervision()'s
    // wrapper body and launchSupervised()'s defaultRealSpawn in this file (a
    // fourth hop, the retired warm floor's own inner stashingSpawn closure in
    // vice-broker.mts, is REMOVED along with the function that held it). All
    // three now forward the options argument, with a handleAcquire()
    // composition test that omits buildColdSpawnFactory so an injected stub
    // cannot fake the proof. If you add another spawn hop, it must forward
    // options too, or production stock launches silently lose their config
    // isolation again.
    //
    // Scratch-dir lifetime: this function deliberately does NOT clean the
    // directory up -- the spawned emulator process outlives this function's
    // return and needs the directory for its whole lifetime. Per-launch
    // scratch dirs therefore accumulate under the OS temp dir for the life of
    // the host; this is a recorded trade-off, not an oversight. If reaping
    // them is ever worth doing, the broker's own kill/recycle path is the
    // component that would own it (it already knows when an instance's
    // process has actually exited).
    let spawnOptions;
    let logLine = `vice-broker: launching ${viceBin} ${viceArgs.join(" ")}`;
    if (backend === "stock") {
        const scratchConfigDir = mkdtempSync(join(tmpdir(), "vice-broker-vicerc-"));
        spawnOptions = { env: { ...process.env, XDG_CONFIG_HOME: scratchConfigDir } };
        logLine += ` (XDG_CONFIG_HOME=${scratchConfigDir})`;
    }
    log(logLine);
    const child = spawnOptions === undefined ? spawnFn(viceBin, viceArgs) : spawnFn(viceBin, viceArgs, spawnOptions);
    const record = {
        port,
        url: `http://127.0.0.1:${port}/mcp`,
        state: "launching",
        reason,
        epochFile: deps.epochFile,
        supervisorDir: deps.supervisorDir,
        pid: child.pid ?? null,
        expectedIdentity: viceBin,
        launchedAt: now(),
        readyAt: null,
        viceBin,
        viceArgs,
        dryRun: false,
        // Non-optional, defaulted to an empty map -- "no claim on any channel"
        // is an empty map, never an absent field. The ONE place a fresh
        // InstanceRecord is constructed, so this is the ONE place this default
        // is set.
        monitorClients: {},
        // Key omitted only on the FORK path now -- the guard above already
        // throws before this point for any stock call with no
        // remoteMonitorPort, so a stock record reaching this line always
        // supplies the key. "Absent" means fork, never "stock allocation
        // failed" (that state no longer exists).
        ...(deps.remoteMonitorPort === undefined ? {} : { remoteMonitorPort: deps.remoteMonitorPort }),
        // Same key-omitted-when-undefined idiom as remoteMonitorPort directly
        // above. An absent request must produce a record with NO `profile` key
        // at all -- not `profile: undefined` -- because "absent means
        // profile-less" is the property a broker restarted mid-phase relies on
        // when it reads records written before this field existed. A copy, not
        // the caller's own object: the record outlives this call and a caller
        // mutating its profile afterwards must not silently change what this
        // instance claims it was launched with.
        ...(deps.profile === undefined ? {} : { profile: { ...deps.profile } }),
    };
    deps.state.instances.set(port, record);
    return record;
}
/** The single in_flight owner, for a caller that ALREADY knows its port.
 * Fully SYNCHRONOUS by design -- no `await` anywhere between the guard
 * check and the guard release. This is what makes the single-owner
 * guarantee hold even under concurrent CALLERS: JS's run-to-completion
 * semantics mean two invocations of a synchronous function can never
 * interleave, regardless of how many async callers race to reach it. The
 * moment this function itself grows an internal `await` between the check
 * and the set, that guarantee is lost -- see broker-launch.test.ts's own
 * "discriminating power" regression check for a demonstration.
 *
 * This is the RIGHT primitive when the port is already decided and fixed
 * (most tests; any future caller with its own allocation scheme). It is
 * deliberately NOT what handleAcquire calls for a FRESH port, because
 * nextFreePort() itself is asynchronous (a real port-in-use probe requires
 * it) -- see acquirePortAndLaunch()'s own header comment for the race that
 * creates and how it is closed. */
export function tryLaunchOne(reason, port, deps) {
    if (inFlight)
        return null;
    inFlight = true;
    try {
        return spawnAndRecordInstance(reason, port, deps);
    }
    finally {
        inFlight = false;
    }
}
/** Holds the SAME single in_flight owner across the ENTIRE
 * allocate-a-port-then-launch sequence -- not merely the synchronous spawn
 * instant tryLaunchOne() alone guards. This closes a genuine race window
 * tryLaunchOne() cannot: nextFreePort()'s own port-in-use probe is
 * asynchronous (a real bind-and-release check), so two overlapping callers
 * could otherwise BOTH be told the SAME candidate port is free before
 * either commits it to state.instances -- a double-launch on one port,
 * silently overwriting the earlier record. The guard is checked and set
 * SYNCHRONOUSLY before the first `await`, exactly like tryLaunchOne()'s own
 * discipline, so a second concurrent call is refused immediately
 * (`launch_in_flight`) rather than racing on the allocation.
 *
 * This guard's own reasoning OUTLIVED the warm floor it was originally
 * written alongside -- it exists because of the 2026-08-01 triple-launch
 * outage (three simultaneous x64sc launches: one SEGV, one exit 1, one exit
 * 0 at the identical spawn second) and is regression-tested (CLAUDE.md),
 * and that history has nothing to do with whether a warm floor exists.
 * Today the only caller of this function is the cold-acquire arm
 * (vice-broker.mts's handleAcquire(), via `serveAcquires()` in
 * runBrokerPass()); the overlap this guard closes is now TWO OR MORE
 * concurrent acquires -- e.g. two requests arriving over the TCP control
 * listener at nearly the same moment, or one arriving while an EARLIER
 * acquire's own launch is still resolving -- never a warming pass, which no
 * longer exists. This is also the function that restores vice-broker.sh's
 * own process_requests() throttle (its `in_flight` local): whatever launches
 * this broker ever attempts, they never overlap, matching the bash
 * original's declined-to-change behaviour. Non-preemptive launch PRIORITY
 * layers on top of this same "one at a time" guard, never replacing it, and
 * the anti-pattern it names -- killing or relaunching preemptively to serve
 * a newer request -- is likewise unaffected by the floor's removal: this
 * function still only ever refuses a second concurrent caller
 * (`launch_in_flight`), and never kills or preempts whichever caller
 * already holds the slot. Among multiple QUEUED acquires, which one wins
 * this slot NEXT, once it frees, falls out of the arrival-ordered
 * pending-acquire structure (broker-control.mts's own mechanism) that
 * requeues a refused acquire for the next pass -- not from anything in this
 * function. The refusal below logs which reason currently holds the slot
 * and which reason is waiting, so the decision is reconstructable from the
 * log after an incident. */
export async function acquirePortAndLaunch(reason, deps) {
    const log = deps.log ?? defaultLog;
    if (inFlight) {
        log(`vice-broker: launch-slot decision -- ${inFlightReason ?? "unknown"} holds the slot; ${reason} waits`);
        return { ok: false, reason: "launch_in_flight" };
    }
    inFlight = true;
    inFlightReason = reason;
    try {
        const portResult = await deps.allocatePort(deps.state);
        if (!portResult.ok) {
            return { ok: false, reason: "no_free_port" };
        }
        const port = portResult.port;
        const supervisorDir = join(deps.stateDir, String(port));
        const epochFile = join(supervisorDir, "epoch.json");
        const spawn = deps.spawnFactory ? deps.spawnFactory(port) : deps.spawn;
        // The second (`-remotemonitor`) port is resolved HERE, still inside the
        // single in_flight owner's own try-block, immediately after the primary
        // allocation succeeds -- both awaits stay inside this SAME try, after
        // the guard's synchronous check-and-set above; neither is moved,
        // duplicated, or awaited around that guard. Only ever attempted for
        // `backend === "stock"`, and only when the caller actually provided the
        // allocator -- every fork launch and every caller before this feature
        // existed never reaches this branch at all.
        let remoteMonitorPort;
        if (deps.backend === "stock" && deps.allocateRemoteMonitorPort) {
            const remoteResult = await deps.allocateRemoteMonitorPort(deps.state, new Set([port]));
            if (remoteResult.ok) {
                // Assigned directly (not via broker-state.mjs's blockPort()) -- this
                // module's own type-only import of that sibling is load-bearing
                // (see this file's own header comment): a VALUE import would turn
                // "./broker-state.mjs" into a real runtime resolution this file
                // cannot satisfy when loaded directly, as this file's own unit test
                // does. `state.blockedPorts` is a plain Set the type import already
                // describes, so mutating it directly needs no value import at all --
                // exactly the same discipline handleExit()'s own
                // `record.monitorClients = {}` uses in place of
                // clearMonitorClient().
                deps.state.blockedPorts.add(remoteResult.port);
                remoteMonitorPort = remoteResult.port;
            }
            else {
                // FAIL, never degrade. Owner direction, verbatim: "it should not be
                // possible, vice must be started witht the text channel." A stock
                // launch that cannot bind a text-monitor port fails the whole
                // acquire -- no process is spawned. The PRIMARY port allocated
                // moments earlier is not yet in `state.instances` and was never
                // added to `state.blockedPorts` by this function (only
                // `nextFreePort()`'s own in-use probe blocks a candidate, and that
                // never ran against the winning candidate) -- so it is already
                // allocatable again on the very next call with no further release
                // step; a discriminating-power test proves this rather than assuming
                // it. This failure arm must NEVER call spawnAndRecordInstance() or
                // otherwise leave a port "spoken for" on the caller's behalf.
                log(`vice-broker: second (-remotemonitor) port allocation failed (${remoteResult.reason}) -- ` +
                    `abandoning the stock launch; the text-monitor port is mandatory on every stock launch and the acquire fails`);
                return { ok: false, reason: "no_free_text_port" };
            }
        }
        const record = spawnAndRecordInstance(reason, port, {
            state: deps.state,
            supervisorDir,
            epochFile,
            spawn,
            now: deps.now,
            viceBin: deps.viceBin,
            mcpHost: deps.mcpHost,
            backend: deps.backend,
            binmonHost: deps.binmonHost,
            remoteMonitorPort,
            profile: deps.profile,
        });
        return { ok: true, record };
    }
    finally {
        inFlight = false;
        inFlightReason = null;
    }
}
/** The ONE way an instance record leaves `state.instances` for good --
 * deleting the record AND handing its second (`-remotemonitor`) port back to
 * the allocator in the same step.
 *
 * `acquirePortAndLaunch()` above adds every allocated remote-monitor port to
 * `state.blockedPorts`, and until this function existed NOTHING ever removed
 * one. `nextFreePort()` never reconsiders a blocked candidate for the
 * lifetime of the process, so every teardown of a stock instance permanently
 * consumed one more port out of the fixed PORT_SCAN_CEILING window even
 * though the OS port was free again the instant the owning process exited
 * -- a long-running broker (the explicit design goal of an on-demand pool
 * with crash supervision, launched strictly on demand rather than kept
 * warm) eventually exhausts its band and answers `no_free_port` to ordinary
 * launches purely from routine churn, with no operator recourse short of a
 * broker restart.
 *
 * A RESPAWN is deliberately NOT a call site: the replacement instance keeps
 * BOTH the primary port and the remote-monitor port of the instance it
 * replaces (launchSupervised() below threads the latter forward exactly like
 * the port argument carries the former), so the block must stay in place for
 * the whole chain of replacements rather than being released and immediately
 * re-taken.
 *
 * Mutates `state.blockedPorts` directly rather than through a broker-state
 * helper, for the SAME load-bearing reason acquirePortAndLaunch()'s own
 * `blockedPorts.add` does (see this file's header comment): a VALUE import of
 * "./broker-state.mjs" would turn a type-only dependency into a real runtime
 * resolution this file cannot satisfy when loaded unbuilt, as its own unit
 * test does. Callers outside this module import THIS function rather than
 * re-deriving the pair of mutations. Idempotent, and safe for a record that
 * never had a second port (every fork launch). */
export function deleteInstanceRecord(state, port) {
    const record = state.instances.get(port);
    if (record && typeof record.remoteMonitorPort === "number") {
        state.blockedPorts.delete(record.remoteMonitorPort);
    }
    state.instances.delete(port);
}
const DEFAULT_PROBE_TIMEOUT_S = 1;
function defaultLog(line) {
    process.stderr.write(`${line}\n`);
}
/** A single POST of a tools/call for vice_ping at the instance's own URL,
 * bounded by the probe timeout -- matching the exact single-POST curl form
 * vice-broker.sh's own probe_ready() used. Treated as ready ONLY when the
 * response body carries BOTH the "version" and "machine" substrings a real
 * vice_ping reply contains; a bare TCP accept is explicitly not sufficient
 * (a C64 can accept a connection before it has finished booting). */
async function defaultHttpProbe(port, timeoutMs) {
    const body = JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/call",
        params: { name: "vice_ping", arguments: {} },
    });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`http://127.0.0.1:${port}/mcp`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body,
            signal: controller.signal,
        });
        const text = await response.text();
        return text.includes("version") && text.includes("machine");
    }
    catch {
        return false;
    }
    finally {
        clearTimeout(timer);
    }
}
// ---------------------------------------------------------------------------
// The STOCK readiness route.
//
// probeReady() below used to POST http://127.0.0.1:<port>/mcp unconditionally
// and require both "version" and "machine" in the body. On the stock backend
// that port speaks the BINARY MONITOR, so the probe could never succeed:
// warm-floor instances stayed `launching` forever, countLaunching(state) > 0
// short-circuited every later warm pass, and a never-usable emulator process was
// retained until broker shutdown while still counting toward
// countTotal()/atCapacity(). Cold acquires kept working only because the cold
// arm grants without probing.
//
// WHY THE WIRE BYTES ARE HAND-BUILT HERE: stock-protocol.ts is the ONE place
// this tree frames and DEMULTIPLEXES the binmon protocol, and this probe is
// deliberately not a second copy of that -- it neither correlates request ids
// nor decodes bodies. But it cannot reuse even the constants: this file is a
// host-bound .mts compiled into resources/ by build.ts, and a .mts cannot
// value-import a .ts module (TS5097). The same constraint already produced
// hand-copied wire constants in binmon-fixtures.ts and a standalone client in
// probe-binmon.mjs. What is written here is the minimum a READINESS check needs:
// one request header out, one response header in, four bytes checked.
// ---------------------------------------------------------------------------
/** Hand-copied from this project's own measured binary-monitor wire format
 * (the same constants stock-protocol.ts defines) -- see the block comment
 * above for why these are not imported from stock-protocol.ts directly. */
const BINMON_STX = 0x02;
const BINMON_API_VERSION = 0x02;
const BINMON_REQUEST_HEADER_LEN = 11;
const BINMON_RESPONSE_HEADER_LEN = 12;
const BINMON_CMD_PING = 0x81;
const BINMON_CMD_EXIT = 0xaa;
const BINMON_PROBE_REQUEST_ID = 0x0000ca11;
function binmonRequest(commandType, requestId) {
    const header = Buffer.alloc(BINMON_REQUEST_HEADER_LEN);
    header[0] = BINMON_STX;
    header[1] = BINMON_API_VERSION;
    header.writeUInt32LE(0, 2); // no body
    header.writeUInt32LE(requestId >>> 0, 6);
    header[10] = commandType;
    return header;
}
/** The wire's own "this is not a reply to any request I sent" sentinel
 * (CLAUDE.md's Protocol constraint) -- REGISTER_INFO (0x31) arrives
 * unsolicited at THIS id on every monitor open, and CHECKPOINT_INFO/STOPPED/
 * RESUMED/JAM can too. A response-type byte alone is not enough to
 * distinguish "an event that happens to share a type with a real reply" from
 * an actual reply -- request-id is the only field the wire promises never
 * collides between the two, which is exactly why demux must key on it. */
const BINMON_UNSOLICITED_REQUEST_ID = 0xffffffff;
/**
 * One PING (0x81) over the binary monitor, requiring a WELL-FORMED 0x81
 * reply -- STX, the expected api_version, response type 0x81, error code 0x00,
 * and this probe's own request id. A bare TCP accept is explicitly insufficient
 * here for exactly the reason probeReady()'s own comment gives for the HTTP
 * route: a C64 can accept a connection before it has finished booting.
 *
 * A live-discovered defect: a NEW binmon connection ALWAYS emits an
 * unsolicited REGISTER_INFO (0x31) frame at request-id 0xffffffff the
 * instant it opens (CLAUDE.md's own Protocol constraint) -- BEFORE this
 * probe's own PING reply ever arrives. The naive "the first 12 bytes ARE the
 * reply" read this code used to do treated that event frame's OWN response-
 * type byte (0x31) as a malformed PING reply and answered `false` forever,
 * live-reproduced against a real crash-respawned stock x64sc: the respawn
 * never left "launching" because THIS probe could never see it as ready,
 * even though the emulator was genuinely up and answering fine underneath.
 * The fix walks frame boundaries using each frame's own body-length field and
 * discards every frame whose request-id is the unsolicited sentinel (or
 * simply is not this probe's own id) rather than assuming the first frame
 * on the wire is the reply -- the same "demux by request-id, never by
 * arrival order" discipline CLAUDE.md's Protocol constraint already requires
 * of every OTHER binmon consumer in this tree (stock-protocol.ts's
 * ViceMonitorClient chief among them).
 *
 * Then EXIT (0xaa), unconditionally, before closing -- because the PING ITSELF
 * HALTS THE MACHINE. Any inbound byte does, and this project's own connect
 * handshake had the same omission and was fixed for the same reason. A
 * readiness probe that left every warm instance frozen would be a worse defect
 * than the one it fixes: the emulator would be "ready" and stopped.
 *
 * Never throws -- every failure (refused, timed out, wrong reply shape, socket
 * error) is `false`, matching defaultHttpProbe()'s own posture, so a
 * still-booting instance simply fails THIS pass and is re-probed on the next.
 *
 * The socket is ALWAYS destroyed before resolving: stock VICE services exactly
 * one binmon client, so a probe that leaked its connection would occupy the
 * single client slot the real session needs to claim.
 */
async function defaultBinmonProbe(port, timeoutMs) {
    const { createConnection } = await import("node:net");
    return new Promise((resolvePromise) => {
        let settled = false;
        let buffer = Buffer.alloc(0);
        const socket = createConnection({ host: "127.0.0.1", port });
        const finish = (result) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            try {
                socket.destroy();
            }
            catch {
                /* already gone */
            }
            resolvePromise(result);
        };
        const timer = setTimeout(() => finish(false), timeoutMs);
        socket.on("error", () => finish(false));
        socket.on("close", () => finish(false));
        socket.on("connect", () => {
            socket.write(binmonRequest(BINMON_CMD_PING, BINMON_PROBE_REQUEST_ID));
        });
        socket.on("data", (chunk) => {
            buffer = Buffer.concat([buffer, chunk]);
            // Walk complete frames off the front of the buffer -- never assume the
            // first BINMON_RESPONSE_HEADER_LEN bytes on the wire are this probe's
            // own reply (see this function's own header comment on why an
            // unsolicited event frame can and does arrive first in practice).
            for (;;) {
                if (buffer.length < BINMON_RESPONSE_HEADER_LEN)
                    return; // wait for more data
                const bodyLen = buffer.readUInt32LE(2);
                const frameLen = BINMON_RESPONSE_HEADER_LEN + bodyLen;
                if (buffer.length < frameLen)
                    return; // header seen, body still incoming
                const responseType = buffer[6];
                const errorCode = buffer[7];
                const requestId = buffer.readUInt32LE(8);
                const stxOk = buffer[0] === BINMON_STX && buffer[1] === BINMON_API_VERSION;
                if (!stxOk) {
                    finish(false);
                    return;
                }
                if (requestId === BINMON_UNSOLICITED_REQUEST_ID || requestId !== BINMON_PROBE_REQUEST_ID) {
                    // Not a reply to anything this probe sent (an unsolicited event, or
                    // a stale reply to a previous probe's own request id) -- discard
                    // this one frame only and keep walking the rest of the buffer.
                    buffer = buffer.subarray(frameLen);
                    continue;
                }
                if (responseType !== BINMON_CMD_PING || errorCode !== 0x00) {
                    finish(false);
                    return;
                }
                // Resume the machine this probe's own PING halted, then close GRACEFULLY:
                // socket.end(data, cb) writes the EXIT and then sends FIN, so the bytes
                // are delivered before the connection goes away. A bare write() followed
                // by destroy() can discard them (destroy may RST), which would leave the
                // instance "ready" and frozen -- the exact outcome the EXIT exists to
                // prevent. The resume is best-effort in its OUTCOME, though: a failed
                // resume must not turn a READY instance into a not-ready one, since the
                // emulator demonstrably answered, which is what this function reports on.
                try {
                    socket.end(binmonRequest(BINMON_CMD_EXIT, BINMON_PROBE_REQUEST_ID + 1), () => finish(true));
                }
                catch {
                    finish(true);
                }
                return;
            }
        });
    });
}
/** This comment records why the readiness probe below looks the way it
 * does, kept in the exact place a longer, three-branch description used to
 * sit.
 *
 * The probe was originally specified as a bare in-process TCP connect to
 * the instance's own monitor port, with a short timeout. The code that
 * landed instead argued against that wording, in its OWN comment: "a bare
 * TCP accept is explicitly not sufficient (a C64 can accept a connection
 * before it has finished booting)" -- a booting emulator promoted to ready
 * on nothing more than an accepted connection is exactly the kind of false
 * positive this probe exists to prevent.
 *
 * The ping-shaped request body stays -- it is what proves the emulator
 * ANSWERS, not merely that a port is bound, which is the whole difference
 * between a liveness check and a readiness check. Two other mechanisms the
 * landed code originally carried (an external-command mechanism, and a
 * "neither mechanism available -> report ready unconditionally" fallback)
 * were retired outright: with no second mechanism to prefer and no "no
 * mechanism" state left to report, there is no longer a pair of
 * indistinguishable states (a deliberately-zero warm floor and a broken
 * host) for an operator to confuse in the logs. The original intent --
 * exactly one check, no external command, no ambiguity -- is fully
 * honoured by this collapse, not reversed by it.
 *
 * No retry loop, deliberately: a still-booting instance simply fails THIS
 * pass and is re-probed on the next one (promoteLaunchingInstances()'s own
 * per-pass cadence, or a later grant-time re-probe) -- this is what makes the
 * shortened ~1s default below safe rather than reckless: a slow host is
 * re-probed, never starved, and the seconds-valued timeout knob
 * (VICE_BROKER_PROBE_TIMEOUT_S) still lets an operator on a slow host raise
 * it. */
export async function probeReady(port, deps = {}) {
    const timeoutS = Number(deps.probeTimeoutSEnv ?? process.env.VICE_BROKER_PROBE_TIMEOUT_S) || DEFAULT_PROBE_TIMEOUT_S;
    const timeoutMs = timeoutS * 1000;
    // The route is chosen by the backend, exactly like buildViceArgs()'s
    // own argv choice, and from the SAME threaded-down verdict. The fork arm below
    // is byte-identical to what this function always did, including the
    // omitted-backend default -- a fork deployment sees no behaviour change.
    if (deps.backend === "stock") {
        const binmonProbe = deps.binmonProbe ?? defaultBinmonProbe;
        return binmonProbe(port, timeoutMs);
    }
    const httpProbe = deps.httpProbe ?? defaultHttpProbe;
    return httpProbe(port, timeoutMs);
}
/** Promotes every `launching` instance whose readiness probe now succeeds to
 * `ready`, recording its readiness timestamp and logging the elapsed boot
 * time. Runs regardless of whether a launch is in flight -- promotion and a
 * NEW launch starting are independent concerns; an already-launched instance
 * becomes usable the moment it answers, whether or not this same pass goes on
 * to start anything further. No retry loop: a still-booting instance simply
 * fails THIS pass and is re-probed on the next one (runBrokerPass()'s own
 * per-tick cadence). */
export async function promoteLaunchingInstances(deps) {
    const log = deps.log ?? defaultLog;
    const now = deps.now ?? (() => Date.now());
    // The DEFAULT probe follows this call's own backend, so a caller that
    // threads `backend` and omits `probe` gets a matching readiness route
    // rather than an HTTP POST at a binary-monitor port. An explicitly
    // injected `probe` still wins, unchanged.
    const probe = deps.probe ?? ((port) => probeReady(port, { backend: deps.backend ?? "stock" }));
    for (const record of deps.state.instances.values()) {
        if (record.state !== "launching")
            continue;
        const isReady = await probe(record.port);
        if (isReady) {
            const readyAt = now();
            const elapsedMs = readyAt - record.launchedAt;
            record.state = "ready";
            record.readyAt = readyAt;
            log(`vice-broker: port ${record.port} launching -> ready (${elapsedMs}ms)`);
        }
    }
}
/** The fixed pass order (mirrors vice-broker.sh's own broker_once(), whose
 * comment names the ordering as load-bearing: "the spare invariant is
 * always re-evaluated against the freshest possible grant/teardown
 * state"). The bash version's third concern, the grant sweep, does NOT
 * appear here -- it is one of several retiring file-lease mechanisms; the
 * TCP connection itself is the lease. The broker-instances.json projection
 * write does not appear either (see broker-state.mts's own FINDING 2
 * comment). Takes plain callbacks rather than the full BrokerState/deps
 * shape so a test can inject two instrumented no-op functions and assert
 * call ORDER without needing a real broker, a real port or a real launch.
 *
 * The warm floor that non-preemptive launch priority originally reasoned
 * about here is GONE -- `promoteLaunching` never calls
 * acquirePortAndLaunch() and so never competes for the single in-flight
 * launch slot the way a warm-floor spare launch used to. `serveAcquires()`
 * (via its own drainPendingAcquires()) is now the ONLY caller in this pass
 * that ever launches anything, so the original "which reason wins a freed
 * slot" question has nothing left to decide BETWEEN these two steps -- that
 * reasoning still applies WITHIN the acquire arm itself (two overlapping
 * acquires still resolve through the single in-flight owner
 * (acquirePortAndLaunch()'s own invariant comment), which this reordering
 * never weakens). What the fixed order still buys: promoting AFTER serving
 * means an instance that becomes probe-ready DURING this exact tick is not
 * available to any acquire THIS SAME pass -- selectWarmInstance() sees it on
 * the NEXT pass instead, a bound of one poll interval (VICE_BROKER_POLL_MS),
 * never a correctness gap, since a cold acquire finding no ready candidate
 * falls straight through to its own dedicated cold launch rather than
 * waiting on one. */
export async function runBrokerPass(deps) {
    await deps.serveAcquires();
    await deps.promoteLaunching();
}
// ===========================================================================
// Per-child supervision: absorbs resources/vice-supervisor.sh WHOLESALE. The
// respawn loop becomes an exit-event handler installed on the spawned
// child; the backoff shape (initial delay, doubling, ceiling), the
// crash-loop give-up (too many crashes inside a window), and the
// per-instance boot/crash log are ported exactly, keeping the same
// configuration knobs -- VICE_RESTART_BACKOFF_S, VICE_RESTART_BACKOFF_MAX_S,
// VICE_MAX_RESTARTS, VICE_CRASH_WINDOW_S all keep their exact names and
// semantics.
// ===========================================================================
function resolveMs(envVar, defaultSeconds, override) {
    if (typeof override === "number")
        return override;
    const raw = process.env[envVar];
    const n = raw === undefined || raw === "" ? NaN : Number(raw);
    return (Number.isFinite(n) ? n : defaultSeconds) * 1000;
}
function resolveCount(envVar, defaultValue, override) {
    if (typeof override === "number")
        return override;
    const raw = process.env[envVar];
    const n = raw === undefined || raw === "" ? NaN : Number(raw);
    return Number.isFinite(n) ? n : defaultValue;
}
/** The exit-driven respawn step. Reads the JUST-crashed record (still in
 * state.instances -- nothing here deletes it before this runs), decides
 * among the four outcomes, and acts:
 *
 * - deliberateKill set AND respawnAfterKill set -> "recycled": a
 *   broker-ordered death that wants a replacement, relaunched on the SAME
 *   port through launchSupervised() -- but called DIRECTLY, bypassing every
 *   crash-accounting step below (no appended crash timestamp, no give-up
 *   evaluation, no backoff wait, no doubling): a deliberate recycle is not
 *   evidence of instability, and the crash-loop machinery exists for an
 *   UNEXPLAINED exit, not this one. The pre-kill crash history and backoff
 *   are carried forward UNCHANGED, and a pre-kill "granted" state is
 *   restored on the fresh record -- the relaunch primitive always creates a
 *   new record in the "launching" state, and leaving it there (once
 *   promoted to "ready" by the next probe pass) would let a LATER,
 *   UNRELATED acquire's own selectWarmInstance() walk (vice-broker.mts)
 *   mistake a recycled session's own machine for an available candidate to
 *   grant out from under the session that already owns it.
 * - deliberateKill set WITHOUT respawnAfterKill -> "deliberate_teardown":
 *   drop the instance, no respawn. This is T-01.6.2-21's whole point --
 *   without reading this flag, every deliberate teardown would respawn
 *   exactly what it just killed, silently breaking kill-never-recycle (a
 *   released instance must be killed and stay gone).
 * - crash count (this instance's crash timestamps still inside the window,
 *   INCLUDING this one) at or above the configured maximum ->
 *   "given_up": drop the instance, log a line naming it and the count.
 *   Mirrors vice-supervisor.sh's own `>= VICE_MAX_RESTARTS` check exactly
 *   (T-01.6.2-20).
 * - otherwise -> "respawned": wait the CURRENT backoff (from the crashed
 *   record, so the doubling carries forward across respawns), then relaunch
 *   through launchSupervised() below -- the SAME tryLaunchOne() primitive
 *   plan 02 established, with the crash history and the NEXT (doubled,
 *   clamped) backoff threaded into the new record. */
async function handleExit(reason, port, deps) {
    const record = deps.state.instances.get(port);
    if (!record) {
        // Already gone by some other path (e.g. a release that removed the
        // instance outright rather than merely marking it) -- nothing to do.
        return;
    }
    const log = deps.log ?? defaultLog;
    // The process behind this instance's monitor sockets has just exited, by
    // every path this function can take (crash, recycle, or a deliberate
    // teardown) -- clear EVERY channel's ownership record HERE, once, before
    // any of those paths branch, so a client that died without releasing can
    // never hold this lock forever on any channel. Redundant
    // with the respawn/delete paths below (a fresh InstanceRecord never
    // carries this forward; a deleted one has no field to carry), but
    // explicit for the same reason broker-state.mts's own header comment
    // names this as one of the required clearing sites. Assigned directly
    // (not via broker-state.mjs's clearMonitorClient()) -- this module's own
    // type-only import of that sibling (see this file's own header comment a
    // few lines above) is load-bearing: a VALUE import would turn "./broker-
    // state.mjs" into a real runtime resolution this file cannot satisfy when
    // loaded directly (as broker-launch.test.ts does), rather than the
    // compiled resources/ sibling this specifier is actually shaped for. `{}`
    // (not `undefined`) since `monitorClients` is non-optional -- "no claim
    // on any channel" is an empty map.
    record.monitorClients = {};
    if (record.deliberateKill) {
        if (record.respawnAfterKill) {
            // Recycle. Capture the pre-kill state, crash history and backoff
            // BEFORE launchSupervised() replaces the map entry at this port key
            // with a brand new InstanceRecord -- nothing about those three facts
            // survives once that overwrite happens.
            const preKillState = record.state;
            const preKillCrashTimes = record.crashTimes ?? [];
            const preKillBackoffMs = record.backoffMs ?? resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
            // The second (`-remotemonitor`) port is carried forward across the
            // replacement exactly like the primary port is -- captured BEFORE
            // launchSupervised() overwrites this port's map entry with a brand
            // new record, for the same reason the three values above are.
            const preKillRemoteMonitorPort = record.remoteMonitorPort;
            // The launch PROFILE is carried forward for exactly the reason the
            // remote-monitor port is carried forward above, and the failure it
            // prevents is sharper. Without this, a recycled `{warp:true}`
            // instance would come back UNWARPED while its fresh record still
            // claimed `profile:{warp:true}` -- after which profileEligible()
            // (vice-broker.mts) would happily hand that instance to the next warp
            // request. That is precisely the undetectable lie this carry-forward
            // exists to structurally exclude, reintroduced one respawn later.
            // Captured BEFORE launchSupervised() overwrites this port's map entry
            // with a brand new record, same as the four values above.
            const preKillProfile = record.profile;
            const respawned = launchSupervised(reason, port, deps, preKillCrashTimes, preKillBackoffMs, preKillRemoteMonitorPort, preKillProfile);
            if (respawned && preKillState === "granted") {
                respawned.state = "granted";
            }
            // Keep the matching grant's own recorded pid in sync with the
            // respawned record's pid -- the ONE legitimate case where the SAME
            // grant continues to own a DIFFERENT pid on the SAME port. Without
            // this, vice-broker.mts's handleRelease() own grant-pid identity
            // check (T-01.6.2.1-28) would misfire and refuse to tear down the
            // very instance the grant now legitimately owns.
            if (respawned) {
                for (const grant of deps.state.grants.values()) {
                    if (grant.port === port) {
                        grant.pid = respawned.pid;
                    }
                }
            }
            deps.onOutcome?.("recycled", port);
            return;
        }
        // A deliberate teardown is the END of this instance -- its
        // remote-monitor port must go back to the allocator with it.
        deleteInstanceRecord(deps.state, port);
        deps.onOutcome?.("deliberate_teardown", port);
        return;
    }
    const now = deps.now ?? (() => Date.now());
    const nowMs = now();
    const crashWindowMs = resolveMs("VICE_CRASH_WINDOW_S", 120, deps.crashWindowMs);
    const crashTimes = [...(record.crashTimes ?? []), nowMs].filter((t) => nowMs - t <= crashWindowMs);
    const maxRestarts = resolveCount("VICE_MAX_RESTARTS", 5, deps.maxRestarts);
    if (crashTimes.length >= maxRestarts) {
        log(`vice-broker: giving up on port ${port} after ${crashTimes.length} crashes within ${crashWindowMs}ms -- ` +
            `this is not a transient crash; check VICE_ARGS and whether the port is already bound`);
        // Giving up is likewise terminal for this instance -- release its
        // remote-monitor port rather than leaking it out of the allocation band.
        deleteInstanceRecord(deps.state, port);
        deps.onOutcome?.("given_up", port);
        return;
    }
    const sleepMs = deps.sleepMs ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    const currentBackoffMs = record.backoffMs ?? resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
    await sleepMs(currentBackoffMs);
    const maxBackoffMs = resolveMs("VICE_RESTART_BACKOFF_MAX_S", 30, deps.maxBackoffMs);
    const nextBackoffMs = Math.min(currentBackoffMs * 2, maxBackoffMs);
    // Same carry-forward as the recycle branch above -- a crash must not
    // silently strip `-remotemonitor` (and its InstanceRecord field) off the
    // replacement, which would otherwise make the instance record's claim to
    // carry that field stop being true the first time an instance was
    // replaced. Same reasoning applies to the launch profile -- an
    // unexplained crash must not silently strip `-warp`/`-console` off the
    // replacement while leaving the record claiming them.
    const respawned = launchSupervised(reason, port, deps, crashTimes, nextBackoffMs, record.remoteMonitorPort, record.profile);
    deps.onOutcome?.(respawned ? "respawned" : "given_up", port);
}
/** The single exit-listener installation point in the whole module tree.
 * Wraps `baseSpawn` (a plain spawn function of the same shape
 * `(command, args, options?) => ChildProcess` every launch path already
 * threads through -- the third `options` argument is load-bearing: it
 * carries the scratch XDG_CONFIG_HOME that isolates a stock launch from the
 * operator's real vicerc, and this wrapper MUST forward it) so the returned
 * spawn function, when called, attaches a
 * one-shot "exit" listener that drives handleExit() above -- the SAME
 * respawn/give-up/deliberate-teardown resolution launchSupervised()'s own
 * relaunch path already uses. Returns the child object baseSpawn produced,
 * UNCHANGED -- a caller's own handle to the child (e.g. its pid) is never
 * replaced or wrapped itself; only the spawn FUNCTION is composed.
 *
 * This is the extraction the phase's own gap closure exists to make: before
 * this function existed, launchSupervised() built this exact listener
 * inline, and it was the ONLY place in the tree that ever did -- both real
 * launch paths in vice-broker.mts instead spawned through a bare,
 * unwrapped spawn with no exit observation at all. Composing a real launch
 * path's own spawn factory through THIS function, rather than reaching for
 * a second inline listener, is what keeps the "exactly one installation
 * point" invariant a structural gate (broker-launch.test.ts) can hold. */
export function withCrashSupervision(reason, port, baseSpawn, deps) {
    // Forwards a third options argument in the BODY, not just the type --
    // this is the hop that matters most, because it wraps every real launch
    // path (cold acquire and every respawn -- a warm floor used to be a
    // third path here and has since been retired). A type-only widening
    // would still silently drop a caller's options at this call site.
    return (cmd, args, options) => {
        const child = baseSpawn(cmd, args, options);
        child.once("exit", () => {
            void handleExit(reason, port, deps);
        });
        return child;
    };
}
/** Launches (or relaunches) a supervised instance: spawns through
 * tryLaunchOne() (the SAME single guarded primitive established above --
 * "spawn again through the SAME single guarded launch function", never a
 * second, parallel spawn path), writes the per-instance boot/crash log at
 * the path shape the retiring supervisor used (a `logs/` directory under
 * the instance directory, named for the binary and a timestamp -- derived
 * from broker-epoch.mts's instanceLogDirFor so this file and the epoch
 * record's own `log` field can never disagree), bumps the epoch through
 * the epoch writer (broker-epoch.mts's nextEpochFor + writeEpochRecord),
 * and installs the exit handler that drives the NEXT crash's outcome.
 *
 * crashTimes/backoffMs are threaded through explicitly (not reset to
 * defaults) so a respawn's crash history and doubling backoff survive the
 * fact that spawnAndRecordInstance() creates a BRAND NEW InstanceRecord
 * object on every launch, replacing the old one at the same port key.
 *
 * `remoteMonitorPort` is threaded the SAME way and for the same reason --
 * it belongs to the instance, not to a single spawn of it. The replacement
 * reuses the port the crashed/recycled process just vacated (already
 * reserved in `state.blockedPorts`, so nothing else can have taken it
 * meanwhile), exactly as it reuses the primary `port` argument; this function
 * stays fully synchronous and never allocates. `undefined` is the correct
 * value for a FIRST launch through superviseChild() and for every fork launch,
 * which is why the parameter is optional.
 *
 * `profile` is threaded the SAME way and for a sharper version of the same
 * reason -- it belongs to the instance, not to a single spawn of it, and
 * warp is fixed at spawn (there is no runtime `WarpMode` resource on stock
 * at all). A replacement that dropped it would come back unwarped while
 * its record still claimed warp, which is exactly the
 * mismatch-between-grant-and-request that this carry-forward exists to
 * make impossible. `undefined` is correct for a FIRST launch through
 * superviseChild() -- production has no profile-less first-launch call site
 * of its own left now that the warm floor is retired, but this module's
 * own unit tests still drive one directly -- and for every fork launch,
 * which is why this parameter is optional too. */
function launchSupervised(reason, port, deps, crashTimes, backoffMs, remoteMonitorPort, profile) {
    const supervisorDir = join(deps.stateDir, String(port));
    const epochFile = deps.epoch.epochPathFor(deps.stateDir, port);
    const logDir = deps.epoch.instanceLogDirFor(deps.stateDir, port);
    mkdirSync(logDir, { recursive: true });
    const epoch = deps.epoch.nextEpochFor(supervisorDir);
    // Phase 60 (LOC-02): same narrowing as spawnAndRecordInstance() above --
    // no environment-variable fallback here, the real broker always threads
    // its once-resolved viceBin down through deps.viceBin.
    const viceBin = deps.viceBin ?? "x64sc";
    // Timestamp PLUS the epoch number: Date.now() alone can collide across
    // two respawns inside the same millisecond when the injected sleepMs
    // resolves immediately (exactly what this module's own tests do to stay
    // fast and deterministic) -- the epoch, guaranteed strictly increasing
    // per instance, makes every respawn's log filename distinct regardless
    // of wall-clock resolution.
    const logFileName = `${basename(viceBin)}-${Date.now()}-e${epoch}.log`;
    const logPath = join(logDir, logFileName);
    const logRelPath = `logs/${logFileName}`;
    // Forwards a third options argument and MERGES it with the per-instance
    // log stdio -- caller options spread FIRST, `stdio` set LAST, so the
    // per-instance log fd always wins. Never the other order: a
    // caller-supplied `stdio` would silently redirect a crash-respawn's
    // output away from the log file the epoch record names, and the
    // forensic per-instance log would point at a file that received nothing.
    // Without this fix, a stock instance that crashes and respawns comes back
    // reading the operator's real `vicerc` even though its original launch
    // was isolated.
    const defaultRealSpawn = (cmd, args, options) => {
        const fd = openSync(logPath, "a");
        return nodeSpawn(cmd, args, { ...options, stdio: ["ignore", fd, fd] });
    };
    const baseSpawn = deps.spawnFactory ? deps.spawnFactory(port) : (deps.spawn ?? defaultRealSpawn);
    const wrappedSpawn = withCrashSupervision(reason, port, baseSpawn, deps);
    const record = tryLaunchOne(reason, port, {
        state: deps.state,
        supervisorDir,
        epochFile,
        spawn: wrappedSpawn,
        now: deps.now,
        viceBin: deps.viceBin,
        mcpHost: deps.mcpHost,
        backend: deps.backend,
        binmonHost: deps.binmonHost,
        remoteMonitorPort,
        profile,
        log: deps.log,
    });
    if (!record)
        return null;
    // The log file's EXISTENCE and the epoch record's `log` field naming it
    // must never disagree, regardless of which spawn implementation actually
    // produced output -- a test-injected stub child never writes through
    // defaultRealSpawn's own fd, so this touches the file into existence
    // when nothing else has.
    if (!existsSync(logPath)) {
        closeSync(openSync(logPath, "a"));
    }
    record.epoch = epoch;
    record.deliberateKill = false;
    record.crashTimes = crashTimes;
    record.backoffMs = backoffMs;
    record.logPath = logPath;
    deps.epoch.writeEpochRecord({
        supervisorDir,
        record: {
            epoch,
            spawned_at: new Date(record.launchedAt).toISOString(),
            pid: record.pid,
            supervisor_pid: process.pid,
            vice_bin: record.viceBin,
            vice_args: record.viceArgs,
            log: logRelPath,
            dry_run: false,
        },
    });
    return record;
}
/** The public entry point: launches a NEW instance under full supervision
 * (crash respawn with backoff, crash-loop give-up, kill-never-recycle via
 * the deliberate-kill marker, and the per-instance boot/crash log), exactly
 * mirroring resources/vice-supervisor.sh's own respawn loop but expressed
 * as an event-loop exit handler instead of a `while true` poll.
 *
 * `remoteMonitorPort` is an OPTIONAL fourth parameter, threaded straight
 * through to launchSupervised() exactly like every other optional trailing
 * parameter in this file. A `backend: "stock"` caller MUST supply it:
 * spawnAndRecordInstance()'s own construction-site assertion throws
 * otherwise, since this function is a genuine first-launch call site, not
 * merely a respawn. This is not a production stock first-launch path today
 * (only acquirePortAndLaunch() is) -- it exists for this module's own unit
 * tests to drive a supervised first launch directly, and the parameter
 * exists so a stock test case can do so without violating the same
 * guarantee production code enforces. */
export function superviseChild(reason, port, deps, remoteMonitorPort) {
    const initialBackoffMs = resolveMs("VICE_RESTART_BACKOFF_S", 3, deps.initialBackoffMs);
    return launchSupervised(reason, port, deps, [], initialBackoffMs, remoteMonitorPort);
}
