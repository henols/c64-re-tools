// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-endpoint.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/local/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-endpoint.mts
//
// THIS IS THE ONE AUTHORITATIVE PLACE for dialling the fixed machine-level
// broker endpoint (plan 62-01, ENDPOINT-01..05) and classifying what
// answers. Runs as source under Node's type-stripping, and is also compiled
// into resources/ (with host-tool-endpoint.mts) for callers that load it from
// node_modules, where Node never strips types.
//
// WHAT NOT TO DO, and why:
//   - Never touch the filesystem from this module -- no readFileSync,
//     existsSync, readFile, or any other fs call. The whole point of the
//     fixed endpoint is that a client finds the broker with nothing on disk
//     telling it where to look (D-06/D-07); a disk read here would silently
//     reintroduce the discovery-record dependency this milestone retires.
//     (version.mts's own runtimeVersion() DOES read a package.json, but that
//     read lives in version.mts, not here -- this module only calls it, the
//     same way vice-proxy.ts's own PROXY_VERSION already does.)
//   - Never import vice-broker-client.ts. That client wraps this module's
//     control dial (dialControlSocket()) in its request framing; the import
//     runs one way only.
//   - Never call a container detector to
//     decide which candidate to try, or in which order. DIAL_CANDIDATES'
//     fixed order IS the host/container detection -- that is this phase's
//     whole premise (see the phase objective in 62-01-PLAN.md).
//   - Never throw out of dialBrokerEndpoint() or classifyHelloReply(). Every
//     byte a candidate sends back is untrusted input from an unknown TCP
//     listener; the JSON parse is always wrapped and every field is
//     type-checked before use, and no negative result is ever cached --
//     the same never-throw posture vice-broker-client.ts's own header
//     states for this exact kind of boundary.
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { runtimeVersion, DEV_PLACEHOLDER } from "./version.mjs";
/** Mirrors broker-control.mts's own HELLO_PROTOCOL_MAGIC literal, character
 * for character. broker-control.mts is the one authoritative definition
 * (see that module's own comment on this constant) -- it is host-bound and
 * compiled into resources/, so this container-side source file cannot
 * value-import it and instead carries its own copy. Update BOTH places in
 * the SAME change if this string ever changes; broker-endpoint.test.ts
 * reads both files' source and asserts the two literals are byte-identical,
 * so an edit to only one side goes red rather than silently drifting. */
export const HELLO_PROTOCOL_MAGIC = "vice-mcp-broker-hello-v1";
/** The fixed, ordered dial candidates: the IPv4 loopback literal first, the
 * Docker bridge alias hostname second. The ORDER is fixed and IS the
 * host/container detection this phase's whole premise rests on -- no code
 * in this module may call a container detector to decide what to dial
 * instead. Frozen so a caller cannot mutate the shared array in place. */
export const DIAL_CANDIDATES = Object.freeze(["127.0.0.1", "host.docker.internal"]);
/** Mirrors broker-control.mts's own resolveControlPort() default -- the
 * fixed port this whole milestone makes a persistent, machine-wide fixture.
 * Never used directly by a test: every test binds port 0 and reads its own
 * assigned port back, per this phase's own ephemeral-port test convention. */
const DEFAULT_CONTROL_PORT = 19510;
/** Resolves the port every fixed-endpoint dial in this module defaults to
 * when its caller supplies no explicit `port` option. Reads
 * VICE_BROKER_CONTROL_PORT -- the SAME variable broker-control.mts's own
 * resolveControlPort() binds the LISTENER on -- because a bind port and a
 * dial port are the same number, unlike a bind host and a dial host. Before this
 * function existed, every dial in this module hardcoded
 * DEFAULT_CONTROL_PORT regardless of what the broker was actually told to
 * bind on -- the latent "relay always dials 19510" defect the G-64-1
 * diagnosis recorded: a client and a broker moved together off the default
 * port would never meet.
 *
 * An unusable value (absent, empty, non-integer, or outside 1..65535) is
 * silently ignored and this function returns DEFAULT_CONTROL_PORT instead
 * of throwing -- no function in this module ever throws (see this file's
 * own header), and a caller who mistyped the variable already gets a
 * ranked, act-on-able refusal from describeDialFailure() naming the port
 * this function actually resolved and dialled; a thrown error here would be
 * a second, worse way to report the exact same mistake.
 *
 * Reads only `options.env` (or `process.env`) -- never the filesystem. This
 * module must never touch disk (see this file's own header "WHAT NOT TO
 * DO" list); an environment-variable read is not a disk read. */
export function resolveEndpointPort(options = {}) {
    const env = options.env ?? process.env;
    const raw = env.VICE_BROKER_CONTROL_PORT;
    if (raw === undefined || raw === "")
        return DEFAULT_CONTROL_PORT;
    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > 65535)
        return DEFAULT_CONTROL_PORT;
    return n;
}
const DEFAULT_CONNECT_TIMEOUT_MS = 2000;
const DEFAULT_REPLY_TIMEOUT_MS = 2000;
/** G-64-4 (plan 64-12, Task 3): the attach reply's OWN wait, separate from
 * the `hello` reply's DEFAULT_REPLY_TIMEOUT_MS above (which keeps its own
 * 2000ms default, used ONLY for the hello race in dialOneCandidate()).
 * MUST exceed the broker's own bounded emulator-leg dial deadline
 * (broker-relay.mts's DEFAULT_RELAY_DIAL_DEADLINE_MS, 5000ms) by at least
 * one retry interval (DEFAULT_RELAY_DIAL_RETRY_MS, 50ms) -- pinned by a
 * relation test in broker-relay.test.ts that imports both constants, never
 * a copy-pasted number. Otherwise the client gives up on an attach the
 * broker is still correctly waiting on, and the broker's own eventual
 * refusal (or success) is never read at all. */
export const DEFAULT_ATTACH_REPLY_TIMEOUT_MS = 8000;
/** G-64-3 (plan 64-13): `awaitTransferComplete()`'s own default wait for the
 * broker's `transfer_complete`/`error` reply line, below. An upload's
 * completion is reported by the side that published the file (the broker),
 * not inferred from the client's own write finishing -- this bound exists
 * only to keep a client from waiting forever against a broker that never
 * answers (a crash mid-publish, or a broker built before this reply
 * existed). Ten seconds -- generous relative to the sub-2ms publish
 * latencies this same gap-closure plan measured on a same-host broker,
 * never tuned down to save wall-clock time in a test; a test that needs a
 * SHORT bound passes its own `timeoutMs` explicitly instead. */
export const DEFAULT_TRANSFER_COMPLETE_TIMEOUT_MS = 10000;
/** This module's own directory, computed once at module load -- the same
 * `dirname(fileURLToPath(import.meta.url))` idiom vice-proxy.ts's own
 * HERE_DIR already uses right before it calls runtimeVersion(). */
const HERE = dirname(fileURLToPath(import.meta.url));
/** This package's own version, resolved ONCE at module load -- reads
 * `package.json` beside this file, then one directory up (the compiled copy
 * in resources/ sits one level below the package root, the same lookup
 * broker-control.mts's resolveBrokerVersion() makes), and degrades to the
 * dev placeholder in a git checkout. This is the "client's own version"
 * D-05's major-version compatibility rule compares the broker's reported
 * version against. */
const CLIENT_VERSION = [join(HERE, "package.json"), join(HERE, "..", "package.json")]
    .map((pkgJsonPath) => runtimeVersion({ pkgJsonPath }))
    .find((v) => v !== DEV_PLACEHOLDER) ?? DEV_PLACEHOLDER;
/** Parses the leading integer of a version string ("2.1.0" -> 2), per D-05's
 * rule that compatibility is a MAJOR-version comparison. A non-numeric
 * leading segment (or an empty string) is unparseable, returning `null`
 * rather than `NaN` or `0`, so the caller classifies it as rank 2 (a
 * foreign listener) instead of silently comparing against a value that was
 * never a version. */
function parseLeadingMajor(version) {
    const match = /^(\d+)/.exec(version);
    return match ? Number(match[1]) : null;
}
/** The one authoritative classifier for what a candidate's dial attempt
 * observed, mapping it onto EXACTLY one of the four D-07 ranks or a
 * completed handshake. Pure: given the same input twice, it returns the
 * same result twice -- no clock read, no state, no cached negative result.
 * Both dialBrokerEndpoint() and this file's own tests call this function;
 * neither re-implements the rank mapping. Never throws: every field is
 * type-checked before use, and an untrusted or malformed `raw` value
 * degrades to a rank rather than an exception. */
export function classifyHelloReply(input, clientVersion) {
    if (!input.connected)
        return { completed: false, rank: 1 };
    const raw = input.raw;
    if (typeof raw !== "object" || raw === null || Array.isArray(raw))
        return { completed: false, rank: 2 };
    const obj = raw;
    // A pre-v2.0.0 broker's token check runs ahead of dispatch, so a
    // credential-free `hello` gets exactly this error shape back -- D-06's
    // own stale-broker discriminator, checked BEFORE the hello-shape check
    // below so a stale broker is never miscategorised as a foreign listener.
    if (obj.kind === "error" && (obj.code === "unauthorized" || obj.code === "bad_request")) {
        return { completed: false, rank: 3 };
    }
    if (obj.kind !== "hello" || obj.protocol !== HELLO_PROTOCOL_MAGIC)
        return { completed: false, rank: 2 };
    // A missing, empty, or non-string version is a foreign listener, never a
    // version mismatch -- it was never a version to compare in the first
    // place (ENDPOINT-05, D-05).
    if (typeof obj.version !== "string" || obj.version.length === 0 || typeof obj.tag !== "string") {
        return { completed: false, rank: 2 };
    }
    const replyMajor = parseLeadingMajor(obj.version);
    const clientMajor = parseLeadingMajor(clientVersion);
    if (replyMajor === null || clientMajor === null)
        return { completed: false, rank: 2 };
    if (replyMajor !== clientMajor)
        return { completed: false, rank: 4, version: obj.version };
    return { completed: true, version: obj.version, tag: obj.tag };
}
/** Dials ONE candidate: opens a socket, sends the handshake line on
 * connect, reads one newline-delimited reply, and resolves with whatever it
 * observed. NEVER throws and NEVER rejects -- a DNS failure, a refused
 * connection, a reply timeout, and a malformed reply all resolve the same
 * promise shape with a rank, exactly the never-throw posture this boundary
 * requires. Gives this candidate its OWN connect timer and its OWN reply
 * timer, both `.unref()`d and cleared on settle, so a wedged candidate can
 * never block its sibling (ENDPOINT-02).
 *
 * `onSocket` fires SYNCHRONOUSLY, before this function returns, with the
 * live socket handle -- dialBrokerEndpoint() needs it immediately (not only
 * once this promise settles) so it can destroy a still-pending LOSING
 * candidate's socket the instant the other candidate completes, rather than
 * waiting out its own timers for no reason. */
function dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, onSocket, 
// Phase 63 (SESS-02): optional `tag`, appended as the LAST parameter so
// every pre-existing call site (dialBrokerEndpoint()'s own two, and this
// file's own tests) keeps compiling and behaving byte-identically --
// omitted means the same untagged `{"op":"hello"}` line this function
// has always sent. dialMonitorRelay() below is the one caller that
// supplies RELAY_TAG_BINARY/RELAY_TAG_TEXT, so the broker's own `hello`
// reply echoes which KIND of connection this is before the attach line
// ever follows.
tag) {
    return new Promise((resolvePromise) => {
        let settled = false;
        let buffer = "";
        let replyTimer = null;
        const socket = connectFn({ host, port });
        onSocket(socket);
        const connectTimer = setTimeout(() => {
            if (settled)
                return;
            settled = true;
            socket.removeAllListeners();
            if (!socket.destroyed)
                socket.destroy();
            resolvePromise({ host, resolved: false, classification: classifyHelloReply({ connected: false, raw: null }, clientVersion) });
        }, connectTimeoutMs);
        if (typeof connectTimer.unref === "function")
            connectTimer.unref();
        function finish(connected, raw, resolved) {
            if (settled)
                return;
            settled = true;
            clearTimeout(connectTimer);
            if (replyTimer)
                clearTimeout(replyTimer);
            socket.removeAllListeners();
            resolvePromise({ host, resolved, classification: classifyHelloReply({ connected, raw }, clientVersion) });
        }
        socket.once("connect", () => {
            if (settled)
                return;
            clearTimeout(connectTimer);
            socket.write(`${JSON.stringify(tag ? { op: "hello", tag } : { op: "hello" })}\n`);
            // Bounds the wait for a reply SEPARATELY from the connect timeout --
            // a listener that accepts and never writes a byte (a "wedged"
            // candidate) is bounded here, not by the connect timer above, which
            // already cleared the instant TCP connect succeeded.
            replyTimer = setTimeout(() => finish(true, null, true), replyTimeoutMs);
            if (typeof replyTimer.unref === "function")
                replyTimer.unref();
            socket.on("data", (chunk) => {
                buffer += chunk.toString("utf8");
                const idx = buffer.indexOf("\n");
                if (idx === -1)
                    return;
                const line = buffer.slice(0, idx);
                let parsed = null;
                try {
                    parsed = JSON.parse(line);
                }
                catch {
                    parsed = null;
                }
                // A connection that got this far genuinely connected -- resolved is
                // unconditionally true, DNS having plainly already succeeded.
                finish(true, parsed, true);
            });
        });
        socket.once("error", (err) => {
            const dnsFailure = err.code === "ENOTFOUND" || err.code === "EAI_AGAIN";
            if (!socket.destroyed)
                socket.destroy();
            finish(false, null, !dnsFailure);
        });
    });
}
/** Dials the fixed endpoint. Every candidate is started IMMEDIATELY and
 * CONCURRENTLY -- never sequentially, never chained (ENDPOINT-02) -- so a
 * wedged first candidate can never delay, let alone block, the second.
 * Resolves as soon as ANY candidate produces a COMPLETED handshake (D-07);
 * a version-skew or stale-broker observation is not a completed handshake
 * and never short-circuits the other candidate, which may still complete.
 * Only once every candidate has settled with nothing completed does this
 * resolve `ok: false`, carrying the highest rank seen and the full,
 * stably-ordered per-candidate observation set.
 *
 * Destroys every socket this dial opened before resolving, on BOTH the
 * success and failure paths -- including a still-pending losing candidate's
 * socket the instant a winner is found, so a dial never leaks a handle and
 * never waits out a timer it no longer needs to. */
export async function dialBrokerEndpoint(options = {}) {
    const port = options.port ?? resolveEndpointPort();
    const candidates = options.candidates ?? DIAL_CANDIDATES;
    const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
    const connectFn = options.connect ?? connect;
    const clientVersion = options.clientVersion ?? CLIENT_VERSION;
    return new Promise((resolveOuter) => {
        const sockets = candidates.map(() => null);
        const observations = candidates.map(() => undefined);
        let settledCount = 0;
        let outerSettled = false;
        function destroyAllSockets() {
            for (const s of sockets) {
                if (s && !s.destroyed)
                    s.destroy();
            }
        }
        function finishOuter(result) {
            if (outerSettled)
                return;
            outerSettled = true;
            destroyAllSockets();
            resolveOuter(result);
        }
        candidates.forEach((host, idx) => {
            dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, (socket) => {
                sockets[idx] = socket;
            }).then((outcome) => {
                settledCount++;
                const classification = outcome.classification;
                if (classification.completed) {
                    finishOuter({ ok: true, host: outcome.host, port, version: classification.version, tag: classification.tag });
                    return;
                }
                observations[idx] = {
                    host: outcome.host,
                    resolved: outcome.resolved,
                    rank: classification.rank,
                    version: classification.rank === 4 ? classification.version : undefined,
                };
                if (settledCount === candidates.length && !outerSettled) {
                    const finalObservations = observations;
                    const highestRank = finalObservations.reduce((max, o) => (o.rank > max ? o.rank : max), 1);
                    finishOuter({ ok: false, port, clientVersion, rank: highestRank, observations: finalObservations });
                }
            });
        });
    });
}
// ---------------------------------------------------------------------------
// The four ranked refusals (task 3, ENDPOINT-04) and the one shared start
// command they all quote.
// ---------------------------------------------------------------------------
/** D-01's fixed invocation -- the ONE command that starts a broker, correct
 * and identical whether the caller is on the host or inside a container.
 * Under this milestone a containerized client has no bind mount and
 * therefore no way to compute a HOST PATH at all, so this is deliberately a
 * fixed string with no path in it -- the two path-bearing alternatives
 * (running the host launcher script in place, or deploying one to a
 * machine-level bin) both produce a path the refusing client has no way to
 * compute.
 *
 * It names both routes in one literal: the npm package's `vice-mcp` bin,
 * and the plugin (or checkout) tree with a `<plugin-root>` placeholder the
 * reader fills in -- never a computed path, and never an `npx` form:
 * never-auto-install binds shipped remedy text too, and `npx -y` installs.
 *
 * README.md's "Starting the broker" section and src/mcp/vice/README.md
 * name the same two commands; change them in the SAME change.
 *
 * Deliberately does NOT join `prerequisites.json`: that file's `kind` field
 * is a closed two-member union (`"executable"` | `"directory"`) enforced by
 * a named test, and a live TCP listener is neither -- widening that schema
 * for a refusal that already fires correctly at its own point of use (a
 * real failed dial) would add pre-flight-flavoured indirection for no
 * benefit (RESEARCH.md's own Deferred Question, answered "no, inline the
 * constant instead"). */
export const BROKER_START_COMMAND = "vice-mcp broker (npm install) or node <plugin-root>/src/mcp/vice/vice-cli.mjs broker (plugin or checkout)";
/** The client and the broker ship in one package, so a major-version skew
 * only happens when the broker was started from a different install (an
 * older checkout, plugin or npm copy) than the one this client runs from. */
const SERVER_PACKAGE_NAME = "@henols/vice-mcp";
/** D-08: appended to a refusal ONLY when some candidate's hostname RESOLVED
 * -- since every observation in a DialFailure already represents a FAILED
 * connection by construction, "resolved but failed" collapses to simply
 * "any observation has resolved:true". Gated on this dial-observed
 * condition alone, NEVER on a container-detection call -- that would
 * contradict this phase's own premise that the dial order IS the detection.
 *
 * Community-sourced, MEDIUM confidence: worded as a possibility to check,
 * with that provenance disclosed in the sentence itself, and never stated
 * as the diagnosis (this plan's transparency prohibition). Does not
 * mention Podman's `pasta` default at all -- that is DEFER-01, a deferred
 * verification item, not something to state here. */
function rootlessDisclosure(failure) {
    const anyResolvedButFailed = failure.observations.some((o) => o.resolved);
    if (!anyResolvedButFailed)
        return "";
    return ("\nIf this is a rootless container runtime, this MAY (unconfirmed by any vendor -- community-sourced " +
        'only) be a host-loopback restriction on the bridge gateway, the signature some rootless Docker/' +
        'RootlessKit configurations report under "slirp4netns --disable-host-loopback" -- worth checking if ' +
        "the above does not resolve it.");
}
/** Rank 1: nothing answered on either candidate. States plainly that no
 * client starts one automatically -- the user does (BROKER-02) -- and
 * gives the start command as the remedy. */
function rank1Message(failure) {
    const hosts = failure.observations.map((o) => o.host).join(" and ");
    return (`vice: no broker answered on either candidate (${hosts}, port ${failure.port}). No client starts one ` +
        `automatically -- start it yourself, on the machine you want the broker running on:\n` +
        `  ${BROKER_START_COMMAND}` +
        rootlessDisclosure(failure));
}
/** Rank 2: something else is squatting the port. Names the candidate host
 * and the port, and suggests checking what holds it before restarting
 * anything -- restarting is NOT the remedy here, since nothing broker-owned
 * is even listening yet. */
function rank2Message(failure) {
    const squatters = failure.observations.filter((o) => o.rank === 2);
    const hosts = (squatters.length > 0 ? squatters : failure.observations).map((o) => o.host).join(" and ");
    return (`vice: something else is already listening on ${hosts} (port ${failure.port}) -- it accepted the ` +
        `connection but did not answer as this broker. Check what holds that port before restarting anything.` +
        rootlessDisclosure(failure));
}
/** Rank 3: a stale pre-v2.0.0 broker. D-06's own stale-broker signature --
 * a broker whose credential check runs ahead of dispatch refuses a
 * credential-free `hello` with exactly this error shape. The remedy is to
 * stop it and start one from the current package. */
function rank3Message(failure) {
    return (`vice: the listener on port ${failure.port} speaks this protocol but refused the handshake -- that is ` +
        `what a broker older than v2.0.0 does, because its credential check runs ahead of dispatch. Stop it and ` +
        `start one from the current package:\n` +
        `  ${BROKER_START_COMMAND}` +
        rootlessDisclosure(failure));
}
/** Rank 4: a genuine broker at an incompatible major version. Names BOTH
 * package names and BOTH observed versions, and says which side is behind,
 * because the reader's next action differs depending on which one it is
 * (D-05, ENDPOINT-05). */
function rank4Message(failure) {
    const skewed = failure.observations.find((o) => o.rank === 4 && o.version !== undefined);
    const brokerVersion = skewed?.version ?? "unknown";
    const clientMajor = parseLeadingMajor(failure.clientVersion);
    const brokerMajor = skewed?.version !== undefined ? parseLeadingMajor(skewed.version) : null;
    let whichSide;
    if (clientMajor !== null && brokerMajor !== null && clientMajor < brokerMajor) {
        whichSide = `this client is behind -- update the install this client runs from (${SERVER_PACKAGE_NAME}, the plugin or the checkout)`;
    }
    else if (clientMajor !== null && brokerMajor !== null && clientMajor > brokerMajor) {
        whichSide = `the broker is behind -- stop it and start one from the current package`;
    }
    else {
        whichSide = "one side is behind the other";
    }
    return (`vice: this client (${SERVER_PACKAGE_NAME} v${failure.clientVersion}) and the broker (v${brokerVersion}) ` +
        `are on incompatible major versions -- ${whichSide}. The client and the broker ship in the same package, ` +
        `so start the broker from the same install this client runs from:\n` +
        `  ${BROKER_START_COMMAND}` +
        rootlessDisclosure(failure));
}
/** Builds the act-on-able refusal text for a failed dial, reading Task 2's
 * already-ranked failure result -- it does not re-derive the rank or
 * re-classify anything. Pure: no clock read, no environment read beyond
 * the already-resolved `failure.clientVersion`, no caching. Two calls on
 * the same input return the same bytes. */
export function describeDialFailure(failure) {
    switch (failure.rank) {
        case 1:
            return rank1Message(failure);
        case 2:
            return rank2Message(failure);
        case 3:
            return rank3Message(failure);
        case 4:
            return rank4Message(failure);
    }
}
// ---------------------------------------------------------------------------
// dialMonitorRelay() -- Phase 63 (SESS-02). Every binary-monitor byte now
// travels through a connection dialled HERE, never through a direct dial to
// the emulator's own port (stock-connect.ts's own header comment names this
// as the one thing that module must never do again). Reuses the SAME
// fixed-endpoint, two-candidate hello race dialBrokerEndpoint() runs above --
// same ranks, same never-throw posture -- but on the FIRST completed
// handshake this function does the opposite of dialBrokerEndpoint(): it
// KEEPS that winning socket alive (destroying only the losing candidate's),
// then writes ONE `attach` line over it and reads the reply with a
// byte-level terminator search, because stock VICE emits a REGISTER_INFO
// frame on every monitor open and those bytes can land in the SAME TCP
// segment as this broker's own attach reply (Task 2's own boundary two).
// ---------------------------------------------------------------------------
/** The two handshake tags a relay connection identifies itself with on its
 * OWN `hello` line -- before the `attach` line that follows it. Distinct
 * from RELAY_TAG_TEXT so a future observer of broker-side logs (or a
 * `status` projection) can tell which channel a given relay connection was
 * FOR without waiting on its `attach` line at all. */
export const RELAY_TAG_BINARY = "monitor-binary";
export const RELAY_TAG_TEXT = "monitor-text";
/** Phase 64 (XFER-04, D-01/D-02): the file-transfer connection's own hello
 * tag, joining RELAY_TAG_BINARY/RELAY_TAG_TEXT above. Deliberately an
 * open-ended string value rather than a member of a closed union -- per
 * 62-CONTEXT's own specifics note, the tag vocabulary stays open-ended so a
 * later phase's stateless call (the `anno` seam) can join it without a
 * rewrite here. */
export const TRANSFER_TAG = "file-transfer";
/** Writes the `attach` line over an already-hello'd, already-kept-alive
 * socket and reads its reply with a BYTE-level terminator search --
 * `chunk.toString("utf8")` on the whole accumulator would corrupt any
 * REGISTER_INFO bytes landing in the same chunk, exactly the corruption
 * broker-control.mts's own pre-splice reader guards against on the other
 * side of this same connection. Settles exactly once: on a parsed
 * `{"kind":"attached"}` line (success, `pending` is whatever followed the
 * terminator), on a parsed `{"kind":"error",...}` line (failure, naming the
 * broker's own refusal), on a reply timeout, or on the socket closing/
 * erroring before either -- every path is `ok: false`, never a throw. */
function performAttach(socket, host, port, opts, attachReplyTimeoutMs, resolveOuter) {
    let carry = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => {
        finish({
            ok: false,
            // G-64-4 (plan 64-12, Task 3): says the BROKER did not answer -- this
            // wait is now attachReplyTimeoutMs, deliberately longer than the
            // broker's own emulator-dial deadline (DEFAULT_ATTACH_REPLY_TIMEOUT_MS's
            // own comment), so reaching this timeout means the broker itself is
            // unresponsive, not merely still waiting on its own emulator dial.
            reason: `vice: broker at ${host}:${port} accepted the relay connection but never answered the attach request within ${attachReplyTimeoutMs}ms`,
        });
    }, attachReplyTimeoutMs);
    if (typeof timer.unref === "function")
        timer.unref();
    function finish(result) {
        if (settled)
            return;
        settled = true;
        clearTimeout(timer);
        socket.removeAllListeners("data");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
        if (!result.ok && !socket.destroyed)
            socket.destroy();
        resolveOuter(result);
    }
    socket.on("data", (chunk) => {
        carry = Buffer.concat([carry, chunk]);
        const idx = carry.indexOf(0x0a);
        if (idx === -1)
            return; // keep accumulating -- bounded by the reply timer above, not a byte cap
        const lineText = carry.subarray(0, idx).toString("utf8");
        const pending = carry.subarray(idx + 1);
        let parsed = null;
        try {
            parsed = JSON.parse(lineText);
        }
        catch {
            parsed = null;
        }
        if (typeof parsed === "object" && parsed !== null && parsed.kind === "attached") {
            finish({ ok: true, socket, host, port, pending });
            return;
        }
        const message = typeof parsed === "object" && parsed !== null && typeof parsed.message === "string"
            ? parsed.message
            : "the broker refused the attach request with an unrecognisable reply";
        finish({ ok: false, reason: `vice: ${message}` });
    });
    socket.once("error", () => {
        finish({ ok: false, reason: `vice: relay connection to ${host}:${port} failed before the attach reply arrived` });
    });
    socket.once("close", () => {
        finish({ ok: false, reason: `vice: relay connection to ${host}:${port} closed before the attach reply arrived` });
    });
    socket.write(`${JSON.stringify({ op: "attach", target_id: opts.targetId, channel: opts.channel, handle: opts.handle })}\n`);
}
/** Dials the fixed endpoint for a relay connection: the SAME two-candidate
 * hello race dialBrokerEndpoint() runs, tagged RELAY_TAG_BINARY/
 * RELAY_TAG_TEXT, but on the FIRST completed handshake this function keeps
 * that winning socket alive (destroying only the losing candidate's) and
 * writes ONE `attach` line over it -- see performAttach() above for the
 * reply's own byte-level read. Never throws. `ok: false` covers BOTH "no
 * candidate could even complete a hello" (reusing describeDialFailure()'s
 * own ranked text) and "a candidate completed hello but the broker refused
 * the attach by name" -- the caller (stock-connect.ts's own
 * dialMonitorSocket default) does not need to tell the two apart; both mean
 * this dial produced no usable socket. */
export function dialMonitorRelay(options) {
    const port = options.port ?? resolveEndpointPort();
    const candidates = options.candidates ?? DIAL_CANDIDATES;
    const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
    // G-64-4 (plan 64-12, Task 3): the attach reply's OWN wait -- deliberately
    // NOT replyTimeoutMs above, which stays the hello race's own wait. See
    // DEFAULT_ATTACH_REPLY_TIMEOUT_MS's own comment for why this one must
    // exceed the broker's own emulator-dial deadline.
    const attachReplyTimeoutMs = options.attachReplyTimeoutMs ?? DEFAULT_ATTACH_REPLY_TIMEOUT_MS;
    const connectFn = options.connect ?? connect;
    const clientVersion = options.clientVersion ?? CLIENT_VERSION;
    const tag = options.channel === "text" ? RELAY_TAG_TEXT : RELAY_TAG_BINARY;
    return new Promise((resolveOuter) => {
        const sockets = candidates.map(() => null);
        const observations = candidates.map(() => undefined);
        let settledCount = 0;
        let outerSettled = false;
        function destroyAllSockets() {
            for (const s of sockets) {
                if (s && !s.destroyed)
                    s.destroy();
            }
        }
        function destroyLosers(winnerIdx) {
            sockets.forEach((s, idx) => {
                if (idx !== winnerIdx && s && !s.destroyed)
                    s.destroy();
            });
        }
        candidates.forEach((host, idx) => {
            dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, (socket) => {
                sockets[idx] = socket;
            }, tag).then((outcome) => {
                settledCount++;
                if (outerSettled)
                    return;
                const classification = outcome.classification;
                if (classification.completed) {
                    outerSettled = true;
                    destroyLosers(idx);
                    const winnerSocket = sockets[idx];
                    if (!winnerSocket) {
                        // Structurally unreachable: dialOneCandidate's own onSocket
                        // callback fires synchronously before this .then() can ever
                        // run. Guarded anyway -- never a throw out of this function.
                        resolveOuter({ ok: false, reason: "vice: internal error -- relay dial completed with no live socket" });
                        return;
                    }
                    performAttach(winnerSocket, outcome.host, port, options, attachReplyTimeoutMs, resolveOuter);
                    return;
                }
                observations[idx] = {
                    host: outcome.host,
                    resolved: outcome.resolved,
                    rank: classification.rank,
                    version: classification.rank === 4 ? classification.version : undefined,
                };
                if (settledCount === candidates.length && !outerSettled) {
                    outerSettled = true;
                    destroyAllSockets();
                    const finalObservations = observations;
                    const highestRank = finalObservations.reduce((max, o) => (o.rank > max ? o.rank : max), 1);
                    resolveOuter({ ok: false, reason: describeDialFailure({ ok: false, port, clientVersion, rank: highestRank, observations: finalObservations }) });
                }
            });
        });
    });
}
/** Writes the `transfer` line over an already-hello'd, already-kept-alive
 * socket and reads its reply with a BYTE-level terminator search -- see
 * this section's own header comment for why. Settles exactly once: on a
 * parsed `{"kind":"transfer_ready"}` line for an upload, a parsed
 * `{"kind":"transfer_payload",byteLength,sha256}` line for a download
 * (`pending` is whatever followed the terminator), on a parsed
 * `{"kind":"error",...}` line (failure, naming the broker's own refusal),
 * on a reply timeout, or on the socket closing/erroring before either --
 * every path is `ok: false`, never a throw. */
function performTransfer(socket, host, port, opts, replyTimeoutMs, resolveOuter) {
    let carry = Buffer.alloc(0);
    let settled = false;
    const timer = setTimeout(() => {
        finish({
            ok: false,
            reason: `vice: broker at ${host}:${port} accepted the transfer connection but never answered the transfer request within ${replyTimeoutMs}ms`,
        });
    }, replyTimeoutMs);
    if (typeof timer.unref === "function")
        timer.unref();
    function finish(result) {
        if (settled)
            return;
        settled = true;
        clearTimeout(timer);
        // Paused BEFORE the listener goes: a flowing socket with no "data"
        // listener DROPS every chunk it emits, and a payload chunk can be emitted
        // in the same flush as the reply line, before the caller has attached its
        // reader. Paused, it stays buffered until the caller's pipeline() (or
        // awaitTransferComplete()'s own resume()) reads it.
        socket.pause();
        socket.removeAllListeners("data");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
        if (!result.ok && !socket.destroyed)
            socket.destroy();
        resolveOuter(result);
    }
    socket.on("data", (chunk) => {
        carry = Buffer.concat([carry, chunk]);
        const idx = carry.indexOf(0x0a);
        if (idx === -1)
            return; // keep accumulating -- bounded by the reply timer above, not a byte cap
        const lineText = carry.subarray(0, idx).toString("utf8");
        const pending = carry.subarray(idx + 1);
        let parsed = null;
        try {
            parsed = JSON.parse(lineText);
        }
        catch {
            parsed = null;
        }
        if (typeof parsed === "object" && parsed !== null) {
            const obj = parsed;
            if (obj.kind === "transfer_ready" && opts.direction === "upload") {
                finish({ ok: true, direction: "upload", socket, host, port, pending });
                return;
            }
            if (obj.kind === "transfer_payload" && opts.direction === "download") {
                if (typeof obj.byteLength !== "number" || typeof obj.sha256 !== "string") {
                    finish({ ok: false, reason: "vice: transfer_payload reply is missing or malformed byteLength/sha256" });
                    return;
                }
                finish({ ok: true, direction: "download", socket, host, port, byteLength: obj.byteLength, sha256: obj.sha256, pending });
                return;
            }
        }
        const message = typeof parsed === "object" && parsed !== null && typeof parsed.message === "string"
            ? parsed.message
            : "the broker refused the transfer request with an unrecognisable reply";
        finish({ ok: false, reason: `vice: ${message}` });
    });
    socket.once("error", () => {
        finish({ ok: false, reason: `vice: transfer connection to ${host}:${port} failed before the transfer reply arrived` });
    });
    socket.once("close", () => {
        finish({ ok: false, reason: `vice: transfer connection to ${host}:${port} closed before the transfer reply arrived` });
    });
    const requestLine = { op: "transfer", direction: opts.direction, handle: opts.handle };
    if (opts.direction === "upload") {
        requestLine.byteLength = opts.byteLength;
        requestLine.sha256 = opts.sha256;
    }
    socket.write(`${JSON.stringify(requestLine)}\n`);
}
/** Dials the fixed endpoint for a file-transfer connection: the SAME
 * two-candidate hello race dialMonitorRelay() runs, tagged TRANSFER_TAG, but
 * on the FIRST completed handshake this function keeps that winning socket
 * alive (destroying only the losing candidate's) and writes ONE `transfer`
 * line over it -- see performTransfer() above for the reply's own
 * byte-level read. Never throws. `ok: false` covers BOTH "no candidate could
 * even complete a hello" (reusing describeDialFailure()'s own ranked text)
 * and "a candidate completed hello but the broker refused the transfer by
 * name" -- the caller does not need to tell the two apart; both mean this
 * dial produced no usable socket. Reuses every primitive already defined
 * above in this same file (DIAL_CANDIDATES, DEFAULT_CONTROL_PORT,
 * dialOneCandidate(), classifyHelloReply(), describeDialFailure()) -- no new
 * import was added for this function. */
export function dialFileTransfer(options) {
    const port = options.port ?? resolveEndpointPort();
    const candidates = options.candidates ?? DIAL_CANDIDATES;
    const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
    const connectFn = options.connect ?? connect;
    const clientVersion = options.clientVersion ?? CLIENT_VERSION;
    return new Promise((resolveOuter) => {
        const sockets = candidates.map(() => null);
        const observations = candidates.map(() => undefined);
        let settledCount = 0;
        let outerSettled = false;
        function destroyAllSockets() {
            for (const s of sockets) {
                if (s && !s.destroyed)
                    s.destroy();
            }
        }
        function destroyLosers(winnerIdx) {
            sockets.forEach((s, idx) => {
                if (idx !== winnerIdx && s && !s.destroyed)
                    s.destroy();
            });
        }
        candidates.forEach((host, idx) => {
            dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, (socket) => {
                sockets[idx] = socket;
            }, TRANSFER_TAG).then((outcome) => {
                settledCount++;
                if (outerSettled)
                    return;
                const classification = outcome.classification;
                if (classification.completed) {
                    outerSettled = true;
                    destroyLosers(idx);
                    const winnerSocket = sockets[idx];
                    if (!winnerSocket) {
                        // Structurally unreachable: dialOneCandidate's own onSocket
                        // callback fires synchronously before this .then() can ever
                        // run. Guarded anyway -- never a throw out of this function.
                        resolveOuter({ ok: false, reason: "vice: internal error -- transfer dial completed with no live socket" });
                        return;
                    }
                    performTransfer(winnerSocket, outcome.host, port, options, replyTimeoutMs, resolveOuter);
                    return;
                }
                observations[idx] = {
                    host: outcome.host,
                    resolved: outcome.resolved,
                    rank: classification.rank,
                    version: classification.rank === 4 ? classification.version : undefined,
                };
                if (settledCount === candidates.length && !outerSettled) {
                    outerSettled = true;
                    destroyAllSockets();
                    const finalObservations = observations;
                    const highestRank = finalObservations.reduce((max, o) => (o.rank > max ? o.rank : max), 1);
                    resolveOuter({ ok: false, reason: describeDialFailure({ ok: false, port, clientVersion, rank: highestRank, observations: finalObservations }) });
                }
            });
        });
    });
}
/**
 * Reads ONE newline-terminated JSON reply line off `options.socket`'s byte
 * stream, by the SAME byte-level `indexOf(0x0a)` search `performTransfer()`
 * above uses -- never a whole-buffer string decode (a line that arrives in
 * the same chunk as trailing garbage must not corrupt anything past its own
 * terminator, though a completion line, unlike a download's `transfer_payload`
 * reply, carries no payload bytes after it in practice). Installs its
 * `"data"`/`"error"`/`"end"`/`"close"` listeners SYNCHRONOUSLY, before
 * returning -- see this function's own header note on why call-order
 * matters. Resolves exactly once, never throws:
 *   - `{ ok: true }` on a `transfer_complete` line whose `byteLength` and
 *     `sha256` both equal the declared values this call was given.
 *   - `{ ok: false, reason }` naming both pairs on a `transfer_complete`
 *     line whose echoed values disagree with what was declared (a
 *     Tampering concern, T-64-G3-01).
 *   - `{ ok: false, reason }` carrying the broker's own `error` line
 *     message verbatim (already path-free -- see `broker-transfer.mts`'s
 *     `TransferResult.wireReason`).
 *   - `{ ok: false, reason }` on the socket ending, closing, or erroring
 *     before a line ever completed.
 *   - `{ ok: false, reason }` on `timeoutMs` elapsing with no line at all --
 *     naming that a broker built before this reply existed never sends one,
 *     so the caller should restart the broker.
 */
export function awaitTransferComplete(options) {
    const { socket, byteLength, sha256 } = options;
    const timeoutMs = options.timeoutMs ?? DEFAULT_TRANSFER_COMPLETE_TIMEOUT_MS;
    let carry = options.pending ?? Buffer.alloc(0);
    let settled = false;
    return new Promise((resolve) => {
        const timer = setTimeout(() => {
            finish({
                ok: false,
                reason: `vice: the broker never confirmed the upload was published within ${timeoutMs}ms -- a broker older than this reply never sends it, so restart the broker`,
            });
        }, timeoutMs);
        if (typeof timer.unref === "function")
            timer.unref();
        function finish(result) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            socket.removeListener("end", onEnd);
            socket.removeListener("close", onClose);
            resolve(result);
        }
        function processLine() {
            const idx = carry.indexOf(0x0a);
            if (idx === -1)
                return; // keep accumulating -- bounded by the timer above, not a byte cap
            const lineText = carry.subarray(0, idx).toString("utf8");
            let parsed = null;
            try {
                parsed = JSON.parse(lineText);
            }
            catch {
                parsed = null;
            }
            if (typeof parsed === "object" && parsed !== null) {
                const obj = parsed;
                if (obj.kind === "transfer_complete") {
                    if (obj.byteLength === byteLength && obj.sha256 === sha256) {
                        finish({ ok: true });
                    }
                    else {
                        finish({
                            ok: false,
                            reason: `vice: the broker's completion reply declared byteLength ${JSON.stringify(obj.byteLength)}/sha256 ${JSON.stringify(obj.sha256)}, which does not match what this side sent (byteLength ${byteLength}/sha256 ${sha256})`,
                        });
                    }
                    return;
                }
                if (obj.kind === "error") {
                    // `obj.message` is already `vice: ...`-prefixed for every real
                    // broker refusal (broker-transfer.mts's own TransferResult.reason/
                    // wireReason convention) -- do not double-prefix it. Only the
                    // unrecognisable-reply fallback below needs one added here.
                    const message = typeof obj.message === "string" ? obj.message : "vice: the broker refused the upload with an unrecognisable error reply";
                    finish({ ok: false, reason: message });
                    return;
                }
            }
            finish({ ok: false, reason: "vice: the broker's completion reply was not a recognised transfer_complete or error line" });
        }
        function onData(chunk) {
            carry = Buffer.concat([carry, chunk]);
            processLine();
        }
        function onError() {
            finish({ ok: false, reason: "vice: the broker closed the transfer connection before confirming the upload was published" });
        }
        function onEnd() {
            finish({ ok: false, reason: "vice: the broker closed the transfer connection before confirming the upload was published" });
        }
        function onClose() {
            finish({ ok: false, reason: "vice: the broker closed the transfer connection before confirming the upload was published" });
        }
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("end", onEnd);
        socket.once("close", onClose);
        // performTransfer() left the socket paused; this reader resumes it.
        socket.resume();
        // A line may already be sitting in `carry` (whatever arrived as
        // `options.pending`, past `transfer_ready`'s own terminator) --
        // vanishingly unlikely (the broker has nothing to report yet at this
        // point in the exchange), but processed the same way rather than
        // assumed empty.
        if (carry.length > 0)
            processLine();
    });
}
// ---------------------------------------------------------------------------
// dialHostToolSession() -- Phase 65 (SEAM-01). The one authoritative place a
// host-tool session connection is dialled: the SAME fixed-endpoint,
// two-candidate hello race dialFileTransfer()/dialMonitorRelay() run above --
// same ranks, same never-throw posture -- tagged HOST_TOOL_TAG instead of
// TRANSFER_TAG/RELAY_TAG_BINARY/RELAY_TAG_TEXT. On the FIRST completed
// handshake this function keeps that winning socket alive (destroying only
// the losing candidate's) and hands the caller a small session object with
// `stage()`/`run()`/`close()` -- UNLIKE `attach`/`transfer`, this connection
// carries MULTIPLE JSON-line round trips (a `host_tool_stage` reply, then a
// `host_tool_run` reply), never a splice and never a raw payload of its own,
// so each round trip is a plain string-accumulated line read (no byte-level
// terminator search is needed -- neither reply carries a trailing binary
// payload, unlike `attach`'s REGISTER_INFO frame or `transfer`'s own payload
// bytes).
// ---------------------------------------------------------------------------
export const HOST_TOOL_TAG = "host-tool";
/** The default reply-wait for BOTH `stage()` and `run()` below when the
 * caller passes no explicit `replyTimeoutMs` of its own -- `run()`'s own
 * caller (`host-tool-endpoint.mts`'s `runHostToolOverEndpoint()`) always
 * passes its own per-tool budget (`hostToolRequestTimeoutMs()`), so this
 * default binds `stage()` in practice, and `run()` only when a caller
 * omits its own budget entirely (e.g. a direct test). */
export const DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS = 5000;
/** Writes one JSON line onto `socket` and resolves with the next
 * newline-terminated JSON reply -- a PLAIN string accumulator (never the
 * byte-level `indexOf(0x0a)` search `performAttach()`/`performTransfer()`
 * above use), because neither `host_tool_stage`'s nor `host_tool_run`'s own
 * reply ever carries a trailing binary payload on this connection. Resolves
 * `{ ok: false, reason }` on a parsed `{"kind":"error",...}` line, a
 * malformed/non-object line, the socket closing or erroring, or a reply
 * timeout -- never throws. Does NOT destroy the socket on any path: this
 * function is called MORE THAN ONCE per connection (`stage()` then `run()`),
 * so tearing the socket down on its own failure would break the caller's
 * own second call; `HostToolSession.close()` is the only thing that
 * destroys it. */
function sendHostToolLineAwaitReply(socket, line, timeoutMs) {
    return new Promise((resolve) => {
        let carry = "";
        let settled = false;
        const timer = setTimeout(() => {
            finish({ ok: false, reason: `vice: the broker did not answer ${JSON.stringify(line.op)} within ${timeoutMs}ms` });
        }, timeoutMs);
        if (typeof timer.unref === "function")
            timer.unref();
        function finish(result) {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            socket.removeListener("data", onData);
            socket.removeListener("error", onError);
            socket.removeListener("close", onClose);
            resolve(result);
        }
        function onData(chunk) {
            carry += chunk.toString("utf8");
            const idx = carry.indexOf("\n");
            if (idx === -1)
                return;
            const lineText = carry.slice(0, idx);
            let parsed = null;
            try {
                parsed = JSON.parse(lineText);
            }
            catch {
                parsed = null;
            }
            if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
                finish({ ok: false, reason: "vice: malformed reply line" });
                return;
            }
            const obj = parsed;
            if (obj.kind === "error") {
                const message = typeof obj.message === "string" ? obj.message : "vice: the broker refused the request with an unrecognisable error reply";
                finish({ ok: false, reason: `vice: ${message}` });
                return;
            }
            finish({ ok: true, value: obj });
        }
        function onError() {
            finish({ ok: false, reason: "vice: the host-tool connection failed before a reply arrived" });
        }
        function onClose() {
            finish({ ok: false, reason: "vice: the host-tool connection closed before a reply arrived" });
        }
        socket.on("data", onData);
        socket.once("error", onError);
        socket.once("close", onClose);
        socket.write(`${JSON.stringify(line)}\n`);
    });
}
function makeHostToolSession(socket) {
    return {
        async stage(files, replyTimeoutMs = DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS) {
            const result = await sendHostToolLineAwaitReply(socket, { op: "host_tool_stage", files }, replyTimeoutMs);
            if (!result.ok)
                return result;
            const { value } = result;
            if (typeof value.request !== "string" || !Array.isArray(value.trees) || !Array.isArray(value.files)) {
                return { ok: false, reason: "vice: host_tool_stage reply is missing or malformed request/trees/files" };
            }
            return { ok: true, request: value.request, trees: value.trees, files: value.files };
        },
        async run(tool, args, request, replyTimeoutMs = DEFAULT_HOST_TOOL_STAGE_REPLY_TIMEOUT_MS) {
            const result = await sendHostToolLineAwaitReply(socket, { op: "host_tool_run", tool, args, request }, replyTimeoutMs);
            if (!result.ok)
                return result;
            return { ok: true, response: result.value };
        },
        close() {
            if (!socket.destroyed)
                socket.destroy();
        },
    };
}
/** Runs the same two-candidate hello race `dialFileTransfer()`/
 * `dialMonitorRelay()` run above, under `tag`, but keeps the winning socket
 * alive (destroying only the losing candidate's) and hands it back. Never
 * throws. `ok: false` covers only "no candidate completed a hello", with
 * `describeDialFailure()`'s ranked text as the reason. */
function dialKeptSocket(tag, options) {
    const port = options.port ?? resolveEndpointPort();
    const candidates = options.candidates ?? DIAL_CANDIDATES;
    const connectTimeoutMs = options.connectTimeoutMs ?? DEFAULT_CONNECT_TIMEOUT_MS;
    const replyTimeoutMs = options.replyTimeoutMs ?? DEFAULT_REPLY_TIMEOUT_MS;
    const connectFn = options.connect ?? connect;
    const clientVersion = options.clientVersion ?? CLIENT_VERSION;
    return new Promise((resolveOuter) => {
        const sockets = candidates.map(() => null);
        const observations = candidates.map(() => undefined);
        let settledCount = 0;
        let outerSettled = false;
        function destroyAllSockets() {
            for (const s of sockets) {
                if (s && !s.destroyed)
                    s.destroy();
            }
        }
        function destroyLosers(winnerIdx) {
            sockets.forEach((s, idx) => {
                if (idx !== winnerIdx && s && !s.destroyed)
                    s.destroy();
            });
        }
        candidates.forEach((host, idx) => {
            dialOneCandidate(host, port, connectTimeoutMs, replyTimeoutMs, connectFn, clientVersion, (socket) => {
                sockets[idx] = socket;
            }, tag).then((outcome) => {
                settledCount++;
                if (outerSettled)
                    return;
                const classification = outcome.classification;
                if (classification.completed) {
                    outerSettled = true;
                    destroyLosers(idx);
                    const winnerSocket = sockets[idx];
                    if (!winnerSocket) {
                        // Structurally unreachable: dialOneCandidate's own onSocket
                        // callback fires synchronously before this .then() can ever
                        // run. Guarded anyway -- never a throw out of this function.
                        resolveOuter({ ok: false, reason: "vice: internal error -- the dial completed with no live socket" });
                        return;
                    }
                    resolveOuter({ ok: true, socket: winnerSocket });
                    return;
                }
                observations[idx] = {
                    host: outcome.host,
                    resolved: outcome.resolved,
                    rank: classification.rank,
                    version: classification.rank === 4 ? classification.version : undefined,
                };
                if (settledCount === candidates.length && !outerSettled) {
                    outerSettled = true;
                    destroyAllSockets();
                    const finalObservations = observations;
                    const highestRank = finalObservations.reduce((max, o) => (o.rank > max ? o.rank : max), 1);
                    resolveOuter({ ok: false, reason: describeDialFailure({ ok: false, port, clientVersion, rank: highestRank, observations: finalObservations }) });
                }
            });
        });
    });
}
/** Dials the fixed endpoint for a host-tool session (tag `HOST_TOOL_TAG`). */
export function dialHostToolSession(options = {}) {
    return dialKeptSocket(HOST_TOOL_TAG, options).then((dialed) => dialed.ok ? { ok: true, session: makeHostToolSession(dialed.socket) } : dialed);
}
/** The hello tag of a long-lived control connection: the one that carries
 * acquire/release/status and monitor claims, and whose close is the lease's
 * release. */
export const CONTROL_TAG = "control";
/** Dials the fixed endpoint for a control connection (tag `CONTROL_TAG`) and
 * hands back the hello'd socket. vice-broker-client.ts's
 * `dialControlSession()` wraps it in the request/reply framing; this module
 * never imports that client. */
export function dialControlSocket(options = {}) {
    return dialKeptSocket(CONTROL_TAG, options);
}
