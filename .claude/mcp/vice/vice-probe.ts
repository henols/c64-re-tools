#!/usr/bin/env node
// The deliberately-FRAGILE liveness probe -- the counterpart to
// tools/vice.mjs's resilient withReconnect() ladder, and the two must NEVER
// be merged. Where the seam retries a transport failure over a ~50s backoff
// budget because a call has to eventually succeed, this module answers one
// question fast: is anything actually listening and answering right now.
//
// WHAT WENT WRONG BEFORE (this module exists because of it): the host
// supervisor died, its epoch froze, and the FIRST thing anyone noticed was a
// call burning ~50s of reconnect backoff before failing -- acquire() had
// handed out a port based only on the registry CLAIMING an instance existed,
// never on anything actually answering there (.planning/STATE.md's HOST
// INSTABILITY / HARD BLOCKER entries, 2026-07-30). Probing four dead
// candidates through that ladder would take minutes just to report an empty
// pool -- unacceptable for a health check that has to run on every acquire()
// poll pass.
//
// WHY vice_ping AND ONLY vice_ping: it is the one call measured NON-pausing
// -- 986,693 cycles/s while ping-polling versus 991,569 fully quiet
// (.planning/STATE.md's pause-on-read finding, 2026-07-30). Every other
// state-reading vice_* call PAUSES the emulator and does not resume it,
// which would make probing itself destructive to the very instance being
// probed. Check that measurement against STATE.md directly rather than
// trusting this comment if it ever needs re-verifying.
//
// This module takes NO static dependency on tools/vice.mjs (the transport
// seam) -- importing it is exactly how the resilient retry path would leak
// into a probe. probeAll() below fans a single-shot request sequence out
// across several candidate ports at once, none of which the seam is (or
// should be) pointed at; the seam's module-level "active instance" state has
// no business being touched by a health check.
//
// The one exception (quick-260730-q4b, D-3): a side-effect-only import of
// repo-root.ts, below. This module is the ONE skill file that imports
// nothing else from the skill, so without this line the deploy-on-first-use
// resource check never fires when this probe is the entry point. This does
// NOT violate the no-dependencies stance above, which is specifically about
// never importing vice.mjs's resilient retry ladder into this deliberately-
// fragile probe -- repo-root.ts is a pure path resolver plus this one
// trigger, and pulls in nothing that speaks MCP.
import "./repo-root.ts";

/** The one and only tool this module will ever call. Hardcoded, not a
 * parameter on any exported function -- that is the structural reason no
 * probe caller can ever steer this module at a forbidden tool (T-p5x-03,
 * D-7): there is no plumbing through which a tool name could arrive. */
export const PROBE_TOOL = "vice_ping";

/** ~1-2s, configurable (D-3). A probe is meant to answer fast; a caller that
 * wants a more patient check (or a stricter one) can override per call. */
export const DEFAULT_PROBE_TIMEOUT_MS = Number(process.env.VICE_PROBE_TIMEOUT_MS || 1500);

/** Options accepted by probeInstance(): a target `url`/`port` pair and an
 * optional per-call timeout override (defaults to DEFAULT_PROBE_TIMEOUT_MS). */
export interface ProbeInstanceOptions {
  url: string;
  port: number;
  timeoutMs?: number;
}

/** The verdict probeInstance() always resolves to -- never throws, per the
 * function's own doc comment below. `reason` is null exactly when
 * `alive` is true; `ping` carries the decoded vice_ping payload when one was
 * recognisable, otherwise null (or the raw text when it didn't parse as
 * JSON, matching the pre-existing behavior of the function this was ported
 * from). */
export type ProbeResult = {
  port: number;
  url: string;
  alive: boolean;
  ms: number;
  reason: string | null;
  ping: unknown;
};

/** A single probe target, as probeAll() consumes it -- the caller's own
 * responsibility to have derived `url` from a validated integer `port`
 * (T-p5x-01), never from a string read straight out of a registry file. */
export interface ProbeInstanceRef {
  port: number;
  url: string;
}

/** Options accepted by probeAll(): the same per-call timeout override
 * probeInstance() takes, applied uniformly to every candidate in the fan-out. */
export interface ProbeAllOptions {
  timeoutMs?: number;
}

/** The combined result of probeAll(): the plain per-instance results array,
 * plus a `byPort` Map for O(1) lookup by port without re-scanning. */
export interface ProbeAllResult {
  results: ProbeResult[];
  byPort: Map<number, ProbeResult>;
}

/**
 * Parse an MCP HTTP response body exactly the two ways tools/vice.mjs's
 * rpc() already does: an SSE-framed body's last `data:` line, or a plain
 * JSON body. Deliberately duplicated here, not imported from the seam --
 * see this file's header comment for why sharing that code would mean
 * sharing the seam's module state too. Throws on anything unparseable; the
 * caller turns that into an `alive:false` verdict, never lets it escape.
 */
function parseMcpBody(text: string, contentType: string): unknown {
  if (contentType.includes("text/event-stream")) {
    const dataLines = text
      .split("\n")
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .filter(Boolean);
    if (!dataLines.length) {
      throw new Error("no data: lines in SSE response");
    }
    return JSON.parse(dataLines[dataLines.length - 1]);
  }
  return JSON.parse(text);
}

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Used to narrow parseMcpBody()'s `unknown` result before reading
 * its `.error`/`.result` fields, in the same style as vice-broker.mts's
 * isPlainObject(). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * One single-shot MCP round trip sequence against `url`: the `initialize`
 * handshake followed by a `tools/call` of PROBE_TOOL. A SINGLE
 * `AbortSignal.timeout(timeoutMs)` is created once, before either request,
 * and shared by both -- total wall time is bounded by `timeoutMs` no matter
 * how many round trips the handshake costs. No retry, no backoff, no second
 * attempt at anything: this is the deliberately-fragile counterpart to
 * withReconnect(), and reusing that ladder here would silently reintroduce
 * the ~50s-per-dead-candidate problem this module exists to avoid (D-3).
 *
 * NEVER THROWS. Every failure mode -- a rejected fetch, an abort, a non-2xx
 * status, a JSON-RPC `error` member, or a 200 that doesn't decode to a
 * recognisable ping result -- becomes `{ alive: false, reason }` instead, so
 * a caller can always build a per-candidate rejection report without a
 * try/catch of its own.
 *
 * Returns `{ port, url, alive, ms, reason, ping }`.
 */
export async function probeInstance({
  url,
  port,
  timeoutMs = DEFAULT_PROBE_TIMEOUT_MS,
}: ProbeInstanceOptions): Promise<ProbeResult> {
  const startedAt = Date.now();
  const elapsed = () => Date.now() - startedAt;
  const signal = AbortSignal.timeout(timeoutMs);

  const post = async (body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(body),
      signal,
    });

  try {
    const initRes = await post({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "bruce-lee-probe", version: "1.0" },
      },
    });
    if (!initRes.ok) {
      return { port, url, alive: false, ms: elapsed(), reason: `initialize returned HTTP ${initRes.status}`, ping: null };
    }
    let initPayload: unknown;
    try {
      initPayload = parseMcpBody(await initRes.text(), initRes.headers.get("content-type") || "");
    } catch (e) {
      return { port, url, alive: false, ms: elapsed(), reason: `initialize: unparseable response (${(e as Error).message})`, ping: null };
    }
    if (isPlainObject(initPayload) && initPayload.error) {
      const initError = initPayload.error;
      const initErrorMessage = isPlainObject(initError) && typeof initError.message === "string" ? initError.message : "unknown";
      return {
        port, url, alive: false, ms: elapsed(),
        reason: `initialize RPC error: ${initErrorMessage}`,
        ping: null,
      };
    }

    const callRes = await post({
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: { name: PROBE_TOOL, arguments: {} },
    });
    if (!callRes.ok) {
      return { port, url, alive: false, ms: elapsed(), reason: `${PROBE_TOOL} returned HTTP ${callRes.status}`, ping: null };
    }
    let callPayload: unknown;
    try {
      callPayload = parseMcpBody(await callRes.text(), callRes.headers.get("content-type") || "");
    } catch (e) {
      return { port, url, alive: false, ms: elapsed(), reason: `${PROBE_TOOL}: unparseable response (${(e as Error).message})`, ping: null };
    }
    if (isPlainObject(callPayload) && callPayload.error) {
      const callError = callPayload.error;
      const callErrorMessage = isPlainObject(callError) && typeof callError.message === "string" ? callError.message : "unknown";
      return {
        port, url, alive: false, ms: elapsed(),
        reason: `${PROBE_TOOL} RPC error: ${callErrorMessage}`,
        ping: null,
      };
    }

    const result = isPlainObject(callPayload) ? callPayload.result : undefined;
    const contentArray = isPlainObject(result) && Array.isArray(result.content) ? result.content : undefined;
    const content = contentArray ? contentArray[0] : undefined;
    if (!isPlainObject(content) || content.type !== "text") {
      return { port, url, alive: false, ms: elapsed(), reason: `${PROBE_TOOL}: unexpected tool result shape`, ping: null };
    }
    let ping: unknown;
    try {
      ping = JSON.parse(content.text as string);
    } catch {
      ping = content.text;
    }
    // A 200 that doesn't decode to a recognisable ping result (no "version"
    // field) is something ELSE listening on that port -- not the same as
    // VICE being up (T-p5x-04).
    if (!isPlainObject(ping) || typeof ping.version === "undefined") {
      return {
        port, url, alive: false, ms: elapsed(),
        reason: `something answered on this port but did not return a recognisable ping result (no "version" field) -- not VICE`,
        ping: ping ?? null,
      };
    }

    return { port, url, alive: true, ms: elapsed(), reason: null, ping };
  } catch (e) {
    const ms = elapsed();
    const err = e as Error & { name?: string; cause?: unknown };
    if (err.name === "TimeoutError" || err.name === "AbortError") {
      return { port, url, alive: false, ms, reason: `no response within ${timeoutMs}ms (timeout)`, ping: null };
    }
    // Surface the underlying cause code (ECONNREFUSED etc.) when fetch's
    // undici implementation attaches one, rather than a generic message --
    // "nothing is listening" and "something is wrong with the request" are
    // different diagnoses and the reason string should say which.
    const cause = err.cause;
    const causeCode = isPlainObject(cause) && typeof cause.code === "string" ? cause.code : undefined;
    return { port, url, alive: false, ms, reason: causeCode || err.message, ping: null };
  }
}

/**
 * Probe every instance in `instances` concurrently -- N candidates cost one
 * timeout, not N (D-3). Takes instance OBJECTS (`{ port, url }`), never raw
 * registry entries: the caller is responsible for having derived `url` from
 * a validated integer port (T-p5x-01), never from a string read out of a
 * registry file. Returns both the plain results array and a `byPort` Map so
 * callers can look a verdict up without re-scanning.
 */
export async function probeAll(
  instances: ProbeInstanceRef[],
  { timeoutMs = DEFAULT_PROBE_TIMEOUT_MS }: ProbeAllOptions = {}
): Promise<ProbeAllResult> {
  const results = await Promise.all(
    instances.map((inst) => probeInstance({ url: inst.url, port: inst.port, timeoutMs }))
  );
  const byPort = new Map(results.map((r) => [r.port, r]));
  return { results, byPort };
}
