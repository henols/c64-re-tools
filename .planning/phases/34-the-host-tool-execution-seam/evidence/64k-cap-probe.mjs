#!/usr/bin/env node
// -----------------------------------------------------------------------------
// evidence/64k-cap-probe.mjs -- Phase 34 plan 34-02's named, repeatable probe.
//
// WHY THIS FILE EXISTS
// --------------------
// 34-RESEARCH.md Finding 1 dialed the real broker-control.mts control-plane
// listener with a 70050-byte JSON line and NO trailing newline and observed a
// bare disconnect: `close` fires with `hadError=false`, and the client
// receives zero bytes of any kind. This is exactly the observation ROADMAP
// success criterion 2 asks be demonstrated rather than asserted from reading
// source, and it is what makes SEAM-03's "results cross as a path, never a
// payload" constraint a genuine one -- a payload route would fail this
// silently at exactly the scale (Ghidra exports run to megabytes; the cap is
// 64 KiB) where it would matter most.
//
// This is an EVIDENCE SCRIPT, not a deliverable: standalone, importing ONLY
// the real `startControlListener()` from `src/mcp/vice/broker-control.mts`
// (no mock, no re-derivation of the framing/token/dispatch logic) plus
// `node:` builtins. It needs no VICE instance, no broker process, and no
// network beyond loopback.
//
// WHAT IT MUST NOT BECOME
// -----------------------
// - Not a second copy of the cap constant, the framing, the token gate or
//   the dispatch chain. It imports the real listener and observes it.
// - Not a fixture for the shipped test suite. `host-tool-transport.test.ts`
//   is that fixture, and it reads the cap from broker-control.mts's own
//   source text rather than importing this script. This file's job is a
//   human-readable, re-runnable, committed transcript producer.
// -----------------------------------------------------------------------------
import { startControlListener } from "../../../../src/mcp/vice/broker-control.mts";
import { connect } from "node:net";

/** Everything this probe needs from `startControlListener()`'s
 * `StartControlListenerOptions` -- seven pre-existing VICE callbacks stubbed
 * to refuse, plus a no-op `host_tool` refusal. This probe's subject is the
 * framing/cap behaviour, never lease semantics. */
function stubOptions() {
  return {
    host: "127.0.0.1",
    port: 0,
    token: "cap-probe-token",
    onAcquire: async () => ({ ok: false, reason: "internal" }),
    onRelease: () => {},
    onRecycle: async () => ({
      port: null,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "grant_lookup_failed",
      reason: "cap probe: no stub configured",
    }),
    onStatus: () => [],
    onHostState: () => ({
      pid: process.pid,
      startedAt: new Date().toISOString(),
      nodeVersion: process.version,
      viceBin: "x64sc",
      warmFloor: 1,
      maxInstances: 1,
      basePort: 6600,
      backend: "fork",
    }),
    onMonitorClaim: () => ({ ok: false, code: "internal" }),
    onMonitorRelease: () => ({ ok: false, code: "internal" }),
    onHostTool: async () => ({ ok: false, message: "cap probe: host_tool not exercised" }),
  };
}

/** Dials `port`, writes ONE line with NO trailing newline, and resolves once
 * either a `close` event fires or `waitMs` elapses first -- whichever comes
 * first decides `closed`. Always destroys the socket before resolving, so a
 * failing probe run can never leave a hung socket behind. */
function dialAndSend(port, line, waitMs = 300) {
  return new Promise((resolvePromise) => {
    const socket = connect({ port, host: "127.0.0.1" });
    let gotData = false;
    let settled = false;
    let timer;

    const finish = (outcome) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(outcome);
    };

    socket.on("data", () => {
      gotData = true;
    });
    socket.on("error", () => {
      // Expected once the far end destroys the socket -- never a probe
      // failure on its own.
    });
    socket.on("close", (hadError) => {
      finish({ closed: true, hadError, gotData });
    });
    socket.on("connect", () => {
      socket.write(line);
    });

    timer = setTimeout(() => {
      finish({ closed: false, hadError: false, gotData });
    }, waitMs);
    if (typeof timer.unref === "function") timer.unref();
  });
}

async function main() {
  const listener = await startControlListener(stubOptions());
  console.log(`PROBE_LISTENING port=${listener.port}`);

  // --- Primary observation: 34-RESEARCH.md Finding 1's own byte count -----
  {
    const lineBytes = 70050;
    const line = "x".repeat(lineBytes);
    if (Buffer.byteLength(line, "utf8") !== lineBytes) {
      throw new Error(`64k-cap-probe: constructed line's byte length does not equal ${lineBytes}`);
    }
    console.log("PROBE_CONNECTED");
    console.log(`PROBE_LINE_BYTES=${lineBytes}`);
    const outcome = await dialAndSend(listener.port, line);
    if (!outcome.closed) {
      throw new Error("64k-cap-probe: the 70050-byte line did not produce a close event -- the cap did not fire");
    }
    console.log(`PROBE_CLOSE hadError=${outcome.hadError} gotData=${outcome.gotData}`);
  }

  // --- Boundary, exact: read the cap from the module's own source text ---
  const capSource = await import("node:fs").then((fs) => fs.readFileSync(new URL("../../../../src/mcp/vice/broker-control.mts", import.meta.url), "utf8"));
  const capMatch = capSource.match(/^const MAX_LINE_BYTES = (\d+);$/m);
  if (!capMatch) {
    throw new Error("64k-cap-probe: could not find 'const MAX_LINE_BYTES = <n>;' in broker-control.mts's own source text");
  }
  const cap = Number(capMatch[1]);
  if (!Number.isInteger(cap) || cap <= 0) {
    throw new Error(`64k-cap-probe: parsed cap is not a positive integer (got ${capMatch[1]})`);
  }

  {
    const atCapLine = "x".repeat(cap);
    const outcome = await dialAndSend(listener.port, atCapLine, 300);
    console.log(`PROBE_BOUNDARY_AT_CAP hadError=${outcome.hadError} gotData=${outcome.gotData} closed=${outcome.closed}`);
    if (outcome.closed) {
      throw new Error(`64k-cap-probe: a line of exactly ${cap} bytes was destroyed -- the boundary is not exact`);
    }
  }

  // --- Boundary, one over: cap + 1 --------------------------------------
  {
    const overCapLine = "x".repeat(cap + 1);
    const outcome = await dialAndSend(listener.port, overCapLine);
    console.log(`PROBE_BOUNDARY_OVER_CAP hadError=${outcome.hadError} gotData=${outcome.gotData} closed=${outcome.closed}`);
    if (!outcome.closed) {
      throw new Error(`64k-cap-probe: a line of ${cap + 1} bytes was NOT destroyed -- the boundary is not exact`);
    }
  }

  listener.server.close();
}

main().catch((err) => {
  console.error(`PROBE_FAILED ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
});
