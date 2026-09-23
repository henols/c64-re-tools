// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-control.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-control.mts
//
// The framing, the token gate, acquire/release, recycle, status,
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
// (Phase 64 gap G-64-1, owner decision 5, REQUIREMENTS.md) now answer
// BEFORE the token gate too, by their broker-minted per-claim/per-stage
// handle alone; see .planning/phases/64-files-as-bytes-both-directions/
// evidence/64-g641-handle-only-authority.md for the full reversal record.
// This drops the "every op requires the token" absolute the very first
// version of this comment stated, but does not drop the credential
// itself: monitor_claim (which mints an attach handle) and stage_file
// (which mints a transfer handle) are BOTH still token-gated, and every
// other op -- acquire, release, recycle, status, host_state,
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
import { createServer } from "node:net";
import { networkInterfaces as osNetworkInterfaces } from "node:os";
import { timingSafeEqual, randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
/** 32 cryptographically random bytes rendered as hex -- the per-boot
 * capability token. Held in memory only by the caller; written once into
 * broker.json and never logged, never included in an error message
 * (T-01.6.2-02). */
export function newControlToken() {
    return randomBytes(32).toString("hex");
}
const MAX_LINE_BYTES = 65536;
/** Plan 63-04 Task 2 (SESS-04) DEFAULT, mirrored -- NOT imported -- from
 * broker-relay.mts's own DEFAULT_RELAY_KEEPALIVE_MS. Keeping the two
 * literal values in agreement is this module's own job, same as the
 * `HELLO_PROTOCOL_MAGIC` string mirrored a few lines below from
 * broker-endpoint.ts: a byte-identical sync test is what actually holds
 * the agreement together, not a shared import. */
const DEFAULT_RELAY_KEEPALIVE_MS_LOCAL = 30000;
/** DUPLICATES broker-relay.mts's own resolveRelayKeepAliveMs() rather than
 * value-importing it -- see this function's own call site (inside
 * attachControlProtocol() below) for the full boundary reason. Same
 * absent/non-numeric/zero/negative-falls-back-to-default discipline,
 * logged by name, never silently disabling the setting. */
function resolveRelayKeepAliveMsLocal() {
    const raw = process.env.VICE_BROKER_RELAY_KEEPALIVE_MS;
    if (raw === undefined || raw === "")
        return DEFAULT_RELAY_KEEPALIVE_MS_LOCAL;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
        console.error(`broker-control: rejected VICE_BROKER_RELAY_KEEPALIVE_MS=${JSON.stringify(raw)} (must be a positive number) -- falling back to the default of ${DEFAULT_RELAY_KEEPALIVE_MS_LOCAL}ms`);
        return DEFAULT_RELAY_KEEPALIVE_MS_LOCAL;
    }
    return n;
}
/** The magic string identifying THIS project's own handshake protocol on
 * the wire -- specific enough that a bare TCP accept by an unrelated
 * service can never be mistaken for it. This is the one authoritative
 * definition (plan 62-01, D-06); `broker-endpoint.ts`, the container-side
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
 * version.ts's own `DEV_PLACEHOLDER` -- that module is container-side and
 * this one is host-bound, compiled away from it (see version.ts's own
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
export function resolveBrokerVersion(here = HERE) {
    const candidates = [join(here, "package.json"), join(here, "..", "package.json")];
    for (const candidate of candidates) {
        try {
            if (!existsSync(candidate))
                continue;
            const raw = readFileSync(candidate, "utf8");
            const pkg = JSON.parse(raw);
            if (typeof pkg.version === "string" && pkg.version.length > 0)
                return pkg.version;
        }
        catch {
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
const MONITOR_OWNERSHIP_DENIAL = "monitor_claim/monitor_release may only target the grant this connection itself holds";
/** Resolves the `channel` field on a `monitor_claim`/`monitor_release`
 * request line: an ABSENT field means `binary` deliberately -- a broker
 * restarted mid-upgrade against a client that predates this field keeps
 * working (backward compatibility). An unrecognised NON-EMPTY value is
 * `bad_request`, never a silent fallback and never cast -- the caller
 * below names both accepted values in the refusal message. */
function resolveMonitorChannel(raw) {
    if (raw === undefined)
        return "binary";
    if (raw === "binary" || raw === "text")
        return raw;
    return "bad_request";
}
/** Resolves the `transfer` op's own `direction` field: exactly the two
 * accepted literals, or `bad_request` -- mirrors resolveMonitorChannel()'s
 * own shape and its no-coercion discipline (an unrecognised value is
 * refused by name, never guessed at). Unlike resolveMonitorChannel(), there
 * is no absent-field default: `direction` has no meaningful implicit value
 * the way an omitted `channel` does, so `undefined` falls into the same
 * `bad_request` bucket as any other unrecognised value. */
function resolveTransferDirection(raw) {
    if (raw === "upload" || raw === "download")
        return raw;
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
export function sanitiseSessionLabel(raw) {
    if (typeof raw !== "string")
        return null;
    const stripped = raw.replace(/[\u0000-\u001f]/g, "");
    const trimmed = stripped.trim();
    if (trimmed === "")
        return null;
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
const LAUNCH_PROFILE_KEYS = Object.freeze(["warp", "headless"]);
const LAUNCH_PROFILE_SHAPE = `an object with optional boolean keys ${LAUNCH_PROFILE_KEYS.join("/")}, or absent`;
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
export function normaliseLaunchProfile(raw) {
    if (raw === undefined || raw === null)
        return { ok: true, profile: undefined };
    if (typeof raw !== "object" || Array.isArray(raw)) {
        // Arrays are specifically excluded: `typeof [] === "object"` in JS, so
        // without the Array.isArray() arm a JSON array would reach the key walk
        // below and pass it vacuously (an empty array has no own keys).
        return { ok: false, message: `profile must be ${LAUNCH_PROFILE_SHAPE}; got ${JSON.stringify(raw) ?? String(raw)}` };
    }
    const entries = Object.entries(raw);
    const unknownKeys = entries.filter(([key]) => !LAUNCH_PROFILE_KEYS.includes(key)).map(([key]) => key);
    if (unknownKeys.length > 0) {
        return { ok: false, message: `profile has unknown key(s) ${unknownKeys.join(", ")}; accepted shape is ${LAUNCH_PROFILE_SHAPE}` };
    }
    const profile = {};
    for (const [key, value] of entries) {
        if (typeof value !== "boolean") {
            return { ok: false, message: `profile.${key} must be a boolean; got ${JSON.stringify(value) ?? String(value)}` };
        }
        if (key === "warp")
            profile.warp = value;
        if (key === "headless")
            profile.headless = value;
    }
    return { ok: true, profile };
}
export function resolveControlPort(override) {
    if (typeof override === "number")
        return override;
    const raw = process.env.VICE_BROKER_CONTROL_PORT;
    if (raw === undefined || raw === "")
        return 19510;
    const n = Number(raw);
    return Number.isFinite(n) ? n : 19510;
}
/** Constant-time token comparison over EQUAL-LENGTH buffers -- an
 * unequal-length comparison is refused without ever calling
 * timingSafeEqual (which throws on a length mismatch), so the length check
 * itself leaks nothing beyond what a fixed-length comparison already
 * would not avoid. */
function tokensMatch(candidate, expected) {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    if (a.length !== b.length)
        return false;
    return timingSafeEqual(a, b);
}
function writeLine(socket, obj) {
    if (socket.writable) {
        socket.write(`${JSON.stringify(obj)}\n`);
    }
}
/** Writes a `host_tool` SUCCESS response line -- the object host-tool.mts's
 * runHostTool() produced, whatever shape that is (`{ ok: true, ... }` or
 * its own `{ ok: false, message }` refusal). This is deliberately NOT
 * `writeLine()`/`ControlResponse`: the host-tool response shape is
 * host-tool.mts's own contract, not one more `ControlResponse` variant this
 * module would otherwise have to keep in sync with a sibling module's
 * allowlist. A REJECTED onHostTool() promise never reaches this function --
 * it is answered through the ordinary `writeLine()`/`error` path instead,
 * so every protocol-level failure still goes through one shape. */
function writeHostToolLine(socket, obj) {
    if (socket.writable) {
        socket.write(`${JSON.stringify(obj)}\n`);
    }
}
function defaultRequestId(prefix) {
    return `${prefix}-${process.pid}-${Date.now()}`;
}
/** Appends to the BACK of the queue -- the only mutation this structure
 * ever performs on receipt. Nothing here sorts or re-orders; arrival order
 * falls out of the array's own insertion order. */
export function enqueueAcquire(queue, entry) {
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
export async function drainPendingAcquires(queue) {
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
export const BRIDGE_INTERFACE_ALLOWLIST = Object.freeze([
    /^docker0$/, // Docker's own default bridge -- exact name, never a prefix
    /^br-/, // a Docker user-defined bridge network
    /^podman/, // Podman's own bridge naming
    /^cni-/, // a CNI-managed bridge (Kubernetes-style container networking)
]);
function matchesBridgeAllowlist(name) {
    return BRIDGE_INTERFACE_ALLOWLIST.some((pattern) => pattern.test(name));
}
function isIPv4Record(record) {
    return record.family === "IPv4";
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
export function enumerateBindHosts(opts = {}) {
    const listInterfaces = opts.networkInterfaces ?? osNetworkInterfaces;
    const interfaces = listInterfaces();
    const seen = new Set();
    const ordered = [];
    const addUnique = (address) => {
        if (seen.has(address))
            return;
        seen.add(address);
        ordered.push(address);
    };
    // Loopback pass first -- always precedes bridge addresses in the
    // returned order, regardless of the platform's own key ordering.
    for (const records of Object.values(interfaces)) {
        if (!records)
            continue;
        for (const record of records) {
            if (record.internal && isIPv4Record(record))
                addUnique(record.address);
        }
    }
    // Bridge pass -- interface NAME matched against the allowlist, among
    // non-internal interfaces only, filtered to IPv4.
    for (const [name, records] of Object.entries(interfaces)) {
        if (!records || !matchesBridgeAllowlist(name))
            continue;
        for (const record of records) {
            if (!record.internal && isIPv4Record(record))
                addUnique(record.address);
        }
    }
    return ordered;
}
/** Binds a bare TCP listener with NO protocol wired up -- no token check, no
 * request handling, nothing. `startControlListener()` below calls this
 * internally and then attaches the real protocol; a test wanting to occupy
 * a control port with "something that is not a broker" (the loud singleton
 * path's own fixture) can call this directly and never see anything that
 * looks like this broker's wire format. */
export function bindControlListener(host, port) {
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
function attachControlProtocol(server, opts, pendingAcquires) {
    server.on("connection", (socket) => {
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
        let carry = Buffer.alloc(0);
        let requestIdForThisConnection = null;
        // Set by the `attach` dispatch arm below, BEFORE onRelayAttach() is
        // ever called -- once true, this socket's OWN "data" listener becomes
        // a no-op forever: every further byte belongs to
        // broker-relay.mts's spliceRelay(), which installs its OWN "data"
        // listeners on this SAME socket from inside onRelayAttach(). Node
        // fires every listener on an event, in the order each was added, so
        // this flag is what stops THIS listener from also decoding those
        // bytes as JSON lines once the splice takes over.
        let relayMode = false;
        socket.on("data", (chunk) => {
            if (relayMode)
                return;
            const combined = Buffer.concat([carry, chunk]);
            if (combined.length > MAX_LINE_BYTES) {
                socket.destroy();
                return;
            }
            let cursor = combined;
            let newlineIdx;
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
        });
        socket.on("error", () => {
            // Per-connection error handling isolates one peer's failure from
            // every other connection and from the server itself (T-01.6.2-06).
        });
        /**
         * THE per-connection ownership predicate every target-naming op is
         * gated on -- the same rule `recycle` has enforced since this
         * protocol's earliest version, now shared rather than copied.
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
        function ownsTarget(targetId) {
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
        function attemptAcquire(requestId, profile, label) {
            // Half one: a queued entry whose owning socket is already gone is
            // settled immediately, WITHOUT ever calling onAcquire() -- this is
            // what keeps a retried drain pass from performing a real, ownerless
            // launch.
            if (socket.destroyed)
                return Promise.resolve(true);
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
                if (socket.destroyed)
                    return true; // no grant was produced -- nothing to release, nothing left to answer
                const code = outcome.reason === "internal" ? "internal" : outcome.reason;
                writeLine(socket, { kind: "error", code, message: `acquire failed: ${outcome.reason}` });
                return true;
            })
                .catch(() => {
                if (!socket.destroyed) {
                    writeLine(socket, { kind: "error", code: "internal", message: "acquire threw" });
                }
                return true;
            });
        }
        /** `remainderAfterLine` is every byte the per-connection reader above
         * had already sliced past THIS line's own terminator, within whatever
         * chunk delivered it -- a raw Buffer, never decoded. Every existing
         * op ignores it; the NEW `attach` arm below is the one branch that
         * reads it, and only after it has already flipped `relayMode`. */
        function handleLine(line, remainderAfterLine) {
            if (line.trim() === "")
                return;
            let parsed;
            try {
                parsed = JSON.parse(line);
            }
            catch {
                writeLine(socket, { kind: "error", code: "bad_request", message: "malformed JSON line" });
                return;
            }
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                writeLine(socket, { kind: "error", code: "bad_request", message: "request must be a JSON object" });
                return;
            }
            const req = parsed;
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
            // 5, REQUIREMENTS.md; see .planning/phases/64-files-as-bytes-both-
            // directions/evidence/64-g641-handle-only-authority.md for the full
            // record). Dispatched HERE, ahead of the token gate below, by the
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
                    writeLine(socket, { kind: "error", code: "bad_request", message: "attach requires target_id and handle" });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `attach: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
                    });
                    return;
                }
                // Flipped BEFORE onRelayAttach() is ever called -- a synchronous
                // splice inside that callback (spliceRelay() installs its own
                // "data" listeners on THIS socket) must never race this
                // connection's next "data" event. See the relayMode declaration's
                // own header comment above.
                relayMode = true;
                const outcome = opts.onRelayAttach(targetId, channel, presentedHandle, socket, remainderAfterLine);
                if (outcome.ok) {
                    writeLine(socket, { kind: "attached" });
                }
                else {
                    // The attach FAILED -- this socket never became a relay, so its
                    // line reader must resume rather than silently going deaf on a
                    // connection the caller may still retry `attach` over.
                    relayMode = false;
                    writeLine(socket, { kind: "error", code: outcome.code, message: `attach refused: ${outcome.code}` });
                }
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
                        code: "bad_request",
                        message: 'transfer requires handle and direction ("upload" or "download")',
                    });
                    return;
                }
                let fileTransferRequest;
                if (direction === "upload") {
                    if (typeof req.byteLength !== "number" || typeof req.sha256 !== "string") {
                        writeLine(socket, {
                            kind: "error",
                            code: "bad_request",
                            message: "transfer (upload) requires byteLength (number) and sha256 (string)",
                        });
                        return;
                    }
                    fileTransferRequest = { direction: "upload", handle, byteLength: req.byteLength, sha256: req.sha256 };
                }
                else {
                    fileTransferRequest = { direction: "download", handle };
                }
                // onFileTransfer is OPTIONAL for the same reason onStageFile is --
                // see that field's own header comment. Refused by name, never
                // called with `undefined`, and this socket's line reader is left
                // running (relayMode is never flipped on this path).
                if (!opts.onFileTransfer) {
                    writeLine(socket, { kind: "error", code: "internal", message: "transfer is not wired on this broker" });
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
            // Token check BEFORE any state is read or written, for every op
            // below -- absence or mismatch is refused, the connection is
            // destroyed, and nothing is allocated, spawned or signalled
            // (T-01.6.2-01, T-01.6.2-03). `attach` and `transfer` above no longer
            // reach this check (G-64-1, owner decision 5); every other op still
            // does, unchanged, until Phase 66 (RM-02) deletes broker.json, the
            // token's only distribution channel.
            const token = typeof req.token === "string" ? req.token : "";
            if (!tokensMatch(token, opts.token)) {
                writeLine(socket, { kind: "error", code: "unauthorized", message: "missing or invalid control token" });
                socket.destroy();
                return;
            }
            // Dispatched FIRST in the chain, before "acquire" -- so the ordering
            // reads clearly. Dispatch here is on EXACT STRING EQUALITY, never
            // fallthrough, so branch order does not itself change which requests
            // reach attemptAcquire() -- what actually makes this branch unable to
            // touch lease state is that opts.onHostTool is its OWN callback (see
            // StartControlListenerOptions' own comment), never composed from
            // onAcquire/onRelease/onRecycle/onStatus/onHostState/onMonitorClaim/
            // onMonitorRelease.
            if (req.op === "host_tool") {
                opts
                    .onHostTool(req)
                    .then((result) => {
                    if (!socket.destroyed)
                        writeHostToolLine(socket, result);
                })
                    .catch(() => {
                    if (!socket.destroyed) {
                        writeLine(socket, { kind: "error", code: "internal", message: "host_tool threw" });
                    }
                });
            }
            else if (req.op === "acquire") {
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
                // Narrow BEFORE attemptAcquire, so a malformed profile never
                // reaches onAcquire and therefore never reaches the port allocator,
                // a spawn, or argv construction. A refusal also does NOT enqueue --
                // the request is answered and dropped, never retried on a later
                // drain pass with the same bad shape.
                const normalised = normaliseLaunchProfile(req.profile);
                if (!normalised.ok) {
                    writeLine(socket, { kind: "error", code: "bad_request", message: normalised.message });
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
            }
            else if (req.op === "release") {
                if (requestIdForThisConnection) {
                    const id = requestIdForThisConnection;
                    requestIdForThisConnection = null;
                    opts.onRelease(id);
                }
                writeLine(socket, { kind: "released" });
            }
            else if (req.op === "recycle") {
                const recycleId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("recycle");
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                // T-01.6.2-31: a connection may only recycle the grant IT ITSELF
                // holds. This check happens here, before onRecycle() is ever
                // called, so a mismatched target never reaches the kill discipline
                // and never signals anything -- an injected signal recorder stays
                // empty for this case. Now expressed through the SAME ownsTarget()
                // predicate monitor_claim/monitor_release use, so the three
                // target-naming ops cannot drift apart.
                if (!ownsTarget(targetId)) {
                    writeLine(socket, {
                        kind: "error",
                        code: "denied",
                        message: "recycle may only target the grant this connection itself holds",
                    });
                    return;
                }
                opts
                    .onRecycle(targetId)
                    .then((result) => {
                    writeLine(socket, {
                        kind: "recycle_ack",
                        id: recycleId,
                        target_id: targetId,
                        port: result.port,
                        x64sc_pid: result.pid,
                        vice_bin: result.viceBin,
                        kill_stage: result.killStage,
                        epoch_before: result.epochBefore,
                        outcome: result.outcome,
                        reason: result.reason,
                    });
                })
                    .catch(() => {
                    writeLine(socket, { kind: "error", code: "internal", message: "recycle threw" });
                });
            }
            else if (req.op === "status") {
                writeLine(socket, { kind: "status", instances: opts.onStatus() });
            }
            else if (req.op === "host_state") {
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
            }
            else if (req.op === "monitor_claim") {
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                if (targetId === "") {
                    writeLine(socket, { kind: "error", code: "bad_request", message: "monitor_claim requires target_id" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, { kind: "error", code: "denied", message: MONITOR_OWNERSHIP_DENIAL });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `monitor_claim: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
                    });
                    return;
                }
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("claim");
                const outcome = opts.onMonitorClaim(requestId, targetId, channel);
                if (outcome.ok) {
                    writeLine(socket, { kind: "monitor_claimed", handle: outcome.handle });
                }
                else if (outcome.code === "monitor_owned") {
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
                }
                else {
                    writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_claim failed: ${outcome.code}` });
                }
            }
            else if (req.op === "monitor_release") {
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                if (targetId === "") {
                    writeLine(socket, { kind: "error", code: "bad_request", message: "monitor_release requires target_id" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, { kind: "error", code: "denied", message: MONITOR_OWNERSHIP_DENIAL });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
                        message: `monitor_release: unrecognised channel ${JSON.stringify(req.channel)} -- accepted values are "binary" and "text"`,
                    });
                    return;
                }
                const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("release-monitor");
                const outcome = opts.onMonitorRelease(requestId, targetId, channel);
                if (outcome.ok) {
                    writeLine(socket, { kind: "monitor_released" });
                }
                else {
                    writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_release refused: ${outcome.code}` });
                }
            }
            else if (req.op === "operation") {
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
                    writeLine(socket, { kind: "error", code: "bad_request", message: "operation requires target_id" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, { kind: "error", code: "denied", message: MONITOR_OWNERSHIP_DENIAL });
                    return;
                }
                const channel = resolveMonitorChannel(req.channel);
                if (channel === "bad_request") {
                    writeLine(socket, {
                        kind: "error",
                        code: "bad_request",
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
                        code: "bad_request",
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
                }
                else {
                    writeLine(socket, { kind: "error", code: outcome.code, message: `operation failed: ${outcome.code}` });
                }
            }
            else if (req.op === "stage_file") {
                // Phase 64 (XFER-04, D-01). Gated on the SAME ownsTarget() predicate
                // monitor_claim/monitor_release/recycle/operation already share --
                // dispatched on this connection's ORDINARY line reader; never
                // touches relayMode.
                const targetId = typeof req.target_id === "string" ? req.target_id : "";
                const slot = typeof req.slot === "string" ? req.slot : "";
                if (targetId === "" || slot === "") {
                    writeLine(socket, { kind: "error", code: "bad_request", message: "stage_file requires target_id and slot" });
                    return;
                }
                if (!ownsTarget(targetId)) {
                    writeLine(socket, {
                        kind: "error",
                        code: "denied",
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
                    writeLine(socket, { kind: "error", code: "internal", message: "stage_file is not wired on this broker" });
                    return;
                }
                const stageOutcome = opts.onStageFile(targetId, slot);
                if (stageOutcome.ok) {
                    writeLine(socket, { kind: "file_staged", handle: stageOutcome.handle, emulator_filename: stageOutcome.emulatorFilename });
                }
                else {
                    writeLine(socket, { kind: "error", code: stageOutcome.code, message: `stage_file failed: ${stageOutcome.code}` });
                }
            }
            else {
                writeLine(socket, { kind: "error", code: "bad_request", message: `unknown op: ${String(req.op)}` });
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
export function startControlListener(opts) {
    // No wildcard fallback (D-09/D-11): an explicitly-set control-host
    // environment variable is honoured as an operator's own choice; when
    // neither opts.host nor the environment variable names one, the caller
    // must supply a host -- this never silently substitutes "0.0.0.0". A
    // production caller wanting the enumerated multi-address bind should use
    // enumerateBindHosts()/startControlListenerOnHosts() below instead of
    // this single-host primitive.
    const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST;
    if (!host) {
        return Promise.reject(new Error("startControlListener: no host resolved -- opts.host is unset and VICE_BROKER_CONTROL_HOST is unset; " +
            "the caller must supply a host explicitly (no wildcard fallback, D-09)"));
    }
    const port = resolveControlPort(opts.port);
    return bindControlListener(host, port).then((bound) => {
        const pendingAcquires = [];
        attachControlProtocol(bound.server, opts, pendingAcquires);
        return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
    });
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
export function startControlListenerOnHosts(hosts, opts) {
    const port = resolveControlPort(opts.port);
    const pendingAcquires = [];
    return Promise.all(hosts.map((host) => bindControlListener(host, port)
        .then((bound) => {
        attachControlProtocol(bound.server, opts, pendingAcquires);
        return { ok: true, listener: { server: bound.server, port: bound.port, host: bound.host, pendingAcquires } };
    })
        .catch((error) => ({
        ok: false,
        failure: { host, error: error instanceof Error ? error : new Error(String(error)) },
    })))).then((outcomes) => {
        const listeners = [];
        const failures = [];
        for (const outcome of outcomes) {
            if (outcome.ok)
                listeners.push(outcome.listener);
            else
                failures.push(outcome.failure);
        }
        return { listeners, failures, pendingAcquires };
    });
}
