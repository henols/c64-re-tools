#!/usr/bin/env node
// -----------------------------------------------------------------------------
// textmon-probe-client.mjs -- Phase 39, plan 39-03 (`CHAN-01`, `D-13`).
//
// THE THROWAWAY TEXT-MONITOR CLIENT.
// -----------------------------------
// A raw socket, banner capture, and crude prompt-terminator framing. This is
// deliberately the crudest client that can drive the handful of commands this
// phase needs -- it is NOT the text-monitor client Phase 41/`CHAN-04`'s
// serialization authority will need, and it does not try to be.
//
// WHAT NOT TO DO
// --------------
//   - This client does NOT solve framing that survives the prompt arriving
//     split across TCP segments. It matches PROMPT_RE against the WHOLE
//     accumulated buffer on every 'data' event, which is fine for a prompt
//     that always eventually appears intact in the accumulated bytes, and
//     wrong for a protocol implementation that has to be robust against an
//     adversarial or merely slow peer.
//   - This client does NOT distinguish a prompt-shaped substring appearing
//     inside a command's own OUTPUT from the real terminator. `memmapshow`'s
//     output, for instance, could in principle contain bytes that happen to
//     match PROMPT_RE before the monitor's own terminator arrives. Solving
//     that properly (a length-prefixed or otherwise unambiguous framing) is
//     a later phase's OWNED scope (`CHAN-03`), and building it here under
//     another name would be exactly that phase's work smuggled in early.
//   - Nothing in this file is promoted into any module under `src/`. It does
//     not survive this phase (`D-13`).
// -----------------------------------------------------------------------------
import net from "node:net";

/**
 * Anchored at the END of the accumulated buffer -- a prompt is only a prompt
 * once nothing more has arrived after it (within the read window). The stock
 * text monitor's own connect banner and post-command prompt are of the shape
 * `(C:$xxxx) ` observed directly against a real VICE 3.9 process in
 * `.planning/notes/text-monitor-channel-live-probe.md`, but that observation
 * was taken over an interactive terminal, not over this raw TCP socket, so
 * this regex is treated as a RESEARCH ASSUMPTION (A2) until this plan's own
 * `awaitBanner()` call confirms or corrects it against the real captured
 * bytes -- see `idle-coexist-probe.mjs`'s "Capture before trusting" step.
 */
export const PROMPT_RE = /\(C:\$[0-9A-Fa-f]{4}\)\s*$/;

export function connectTextMonitor(port, { timeoutMs = 5000 } = {}) {
  return new Promise((resolve, reject) => {
    const sock = net.createConnection({ host: "127.0.0.1", port });
    const onConnect = () => {
      clearTimeout(timer);
      sock.removeListener("error", onError);
      resolve(sock);
    };
    const onError = (err) => {
      clearTimeout(timer);
      reject(err);
    };
    const timer = setTimeout(() => {
      sock.removeListener("connect", onConnect);
      sock.removeListener("error", onError);
      sock.on("error", () => {});
      sock.destroy();
      reject(new Error(`connectTextMonitor: port ${port} did not accept within ${timeoutMs}ms`));
    }, timeoutMs);
    sock.once("connect", onConnect);
    sock.once("error", onError);
  });
}

/**
 * Returns the raw bytes received before the first prompt, WITHOUT sending
 * anything. Exposes both the raw Buffer and a decoded string, so the banner
 * can be recorded byte-exactly (hex) rather than only through a lossy
 * decode.
 */
export function awaitBanner(sock, { timeoutMs = 10000, promptRe = PROMPT_RE } = {}) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (promptRe.test(buf.toString("utf8"))) {
        clearTimeout(timer);
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);
        resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: true });
      }
    };
    const onError = (err) => {
      clearTimeout(timer);
      sock.removeListener("data", onData);
      reject(err);
    };
    const timer = setTimeout(() => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      // Not rejecting: a banner that never matched PROMPT_RE within budget is
      // still evidence -- the raw bytes received so far are returned so the
      // caller can record them and correct the matcher, per this plan's
      // "Capture before trusting" rule. matchedPromptRe: false is the signal.
      resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: false });
    }, timeoutMs);
    sock.on("data", onData);
    sock.on("error", onError);
  });
}

/**
 * Sends `command` (with a trailing newline, the text monitor's own line
 * terminator) and resolves with the full accumulated raw response once
 * `promptRe` matches the end of the accumulated buffer.
 */
export function sendAndAwaitPrompt(sock, command, { timeoutMs = 10000, promptRe = PROMPT_RE } = {}) {
  return new Promise((resolve, reject) => {
    let buf = Buffer.alloc(0);
    const onData = (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      if (promptRe.test(buf.toString("utf8"))) {
        clearTimeout(timer);
        sock.removeListener("data", onData);
        sock.removeListener("error", onError);
        resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: true });
      }
    };
    const onError = (err) => {
      clearTimeout(timer);
      sock.removeListener("data", onData);
      reject(err);
    };
    const timer = setTimeout(() => {
      sock.removeListener("data", onData);
      sock.removeListener("error", onError);
      resolve({ raw: buf, text: buf.toString("utf8"), matchedPromptRe: false });
    }, timeoutMs);
    sock.on("data", onData);
    sock.on("error", onError);
    sock.write(`${command}\n`);
  });
}

export function closeTextMonitor(sock) {
  return new Promise((resolve) => {
    if (!sock || sock.destroyed) {
      resolve();
      return;
    }
    sock.once("close", () => resolve());
    sock.destroy();
  });
}
