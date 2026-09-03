// host-tool-transport.test.ts
//
// Phase 34, plan 34-02 (SEAM-03): makes the inline-line cap an OBSERVATION
// against the real listener, not a claim read out of source. 34-RESEARCH.md
// Finding 1 dialed the real `startControlListener()` with a 70050-byte line
// and no trailing newline and observed a bare disconnect -- `close` fires
// with `hadError=false`, zero response bytes, no error frame. This file
// reproduces that observation as a committed, automated test, at the exact
// boundary and one step either side, in bytes rather than characters -- and
// separately asserts the host_tool result-by-reference shape
// (`{ path, sha256, byteLength }`, and ONLY those three keys) holds at every
// result size including zero and under two overlapping requests.
//
// The cap is read from broker-control.mts's own source text below -- it is
// NEVER hand-copied as a literal in this file. The one literal this file
// does carry is 70050, and only because it is the exact byte count
// 34-RESEARCH.md Finding 1 actually observed; this file reproduces that
// observation, it does not re-derive a new one.
//
// No VICE instance, no broker daemon and no network beyond loopback are
// needed for anything in this file.
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect } from "node:net";
import { readFileSync, mkdtempSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  startControlListener,
  type StartControlListenerResult,
  type AcquireOutcome,
  type RecycleOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
} from "./broker-control.mts";
import { hostToolOverControlPlane } from "./host-tool-client.ts";
import { brokerJsonPath } from "./vice-broker-client.ts";
import { build } from "./build.ts";

// ---------------------------------------------------------------------------
// The cap, read from the module under test -- never a hand-written literal
// anywhere in this file. `broker-control.mts` declares it as a private,
// non-exported module-level const, so the ONE `const MAX_LINE_BYTES = `
// declaration is parsed out of its own source text. A parse failure throws
// immediately (loud), rather than silently defaulting to zero and passing
// every "destroyed" case for the wrong reason.
// ---------------------------------------------------------------------------
function readCapFromBrokerControlSource(): number {
  const source = readFileSync(new URL("./broker-control.mts", import.meta.url), "utf8");
  const match = source.match(/^const MAX_LINE_BYTES = (\d+);$/m);
  if (!match) {
    throw new Error(
      "host-tool-transport.test.ts: could not find the 'const MAX_LINE_BYTES = <n>;' declaration in broker-control.mts's own source text -- the module under test may have renamed or restructured its cap constant.",
    );
  }
  return Number(match[1]);
}

const CAP = readCapFromBrokerControlSource();

test("the parsed cap is a positive integer read from broker-control.mts's own source -- a parse failure here is loud, never a silent zero", () => {
  assert.equal(Number.isInteger(CAP), true);
  assert.ok(CAP > 0);
});

// ---------------------------------------------------------------------------
// A real listener with all seven pre-existing VICE callbacks stubbed to
// refuse -- this file's subject is the framing/cap behaviour and the
// host_tool result shape, not lease semantics (already proven by plan
// 34-01's own spy assertion). `onHostTool` defaults to a no-op refusal so
// the cap-boundary cases below never need one.
// ---------------------------------------------------------------------------
function baseListenerOptions(onHostTool: (raw: unknown) => Promise<unknown>) {
  return {
    onAcquire: async (): Promise<AcquireOutcome> => ({ ok: false, reason: "internal" }) as AcquireOutcome,
    onRelease: (): void => {},
    onRecycle: async (): Promise<RecycleOutcome> => ({
      port: null,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "grant_lookup_failed",
      reason: "no stub configured",
    }),
    onStatus: (): StatusInstanceEntry[] => [],
    onHostState: (): HostStateFields => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      warmFloor: 1,
      maxInstances: 1,
      basePort: 6600,
      backend: "fork" as const,
    }),
    onMonitorClaim: (): MonitorClaimOutcome => ({ ok: false, code: "internal" }) as MonitorClaimOutcome,
    onMonitorRelease: (): MonitorReleaseOutcome => ({ ok: false, code: "internal" }) as MonitorReleaseOutcome,
    onHostTool,
  };
}

async function startTransportListener(
  onHostTool: (raw: unknown) => Promise<unknown> = async () => ({ ok: false, message: "no onHostTool stub configured" }),
): Promise<StartControlListenerResult> {
  return startControlListener({
    host: "127.0.0.1",
    port: 0,
    token: "host-tool-transport-test-token",
    ...baseListenerOptions(onHostTool),
  });
}

// ---------------------------------------------------------------------------
// Raw-socket probe for the cap-boundary cases. Dials, writes ONE line with NO
// trailing newline, and races a `close` event against a short, `unref()`ed
// bounded timer -- the same "connection stayed open" idiom
// `acquireOverControlPlane()`'s own connect timer uses, so a hung case can
// never wedge the test runner. Always `destroy()`s the socket in `finish()`,
// win or lose the race.
// ---------------------------------------------------------------------------
interface RawProbeOutcome {
  /** True once a `close` event actually fired before the bounded wait
   * elapsed -- false means the connection was still open when this probe
   * gave up waiting (the "stayed open" observation for the at-the-cap
   * case). */
  closed: boolean;
  hadError: boolean;
  gotData: boolean;
}

function dialAndSendLine(port: number, line: string, waitMs = 300): Promise<RawProbeOutcome> {
  return new Promise((resolvePromise) => {
    const socket = connect({ port, host: "127.0.0.1" });
    let gotData = false;
    let settled = false;
    let timer: ReturnType<typeof setTimeout>;

    const finish = (outcome: RawProbeOutcome): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      socket.destroy();
      resolvePromise(outcome);
    };

    socket.on("data", () => {
      gotData = true;
    });
    // A per-connection socket error (e.g. ECONNRESET once the far end
    // destroys) is expected here and must not throw -- broker-control.mts's
    // own per-connection handler is deliberately silent for exactly this
    // reason.
    socket.on("error", () => {});
    socket.on("close", (hadError: boolean) => {
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

// ---------------------------------------------------------------------------
// Task 1 behaviour: the cap, observed red at the exact boundary and one step
// either side, in bytes rather than characters.
// ---------------------------------------------------------------------------

test("a 70050-byte inline line (34-RESEARCH.md Finding 1's own observed byte count), no trailing newline, sent to the real listener: the connection is destroyed with hadError=false and zero response bytes of any kind", async () => {
  const listener = await startTransportListener();
  try {
    const line = "x".repeat(70050);
    assert.equal(Buffer.byteLength(line, "utf8"), 70050);
    const outcome = await dialAndSendLine(listener.port, line);
    assert.equal(outcome.closed, true, "the oversized line must produce a close event");
    assert.equal(outcome.hadError, false, "the disconnect is a clean destroy, not a socket error");
    assert.equal(outcome.gotData, false, "no error frame, no bad_request frame, no partial JSON -- zero bytes of any kind");
  } finally {
    listener.server.close();
  }
});

test(`a line of exactly the cap's own byte count (${CAP}), no trailing newline, is NOT destroyed -- the connection stays open for at least a short bounded wait`, async () => {
  const listener = await startTransportListener();
  try {
    const line = "x".repeat(CAP);
    assert.equal(Buffer.byteLength(line, "utf8"), CAP, "the probe line's own byte length must equal the parsed cap for this case to test what it claims");
    const outcome = await dialAndSendLine(listener.port, line, 300);
    assert.equal(outcome.closed, false, "a line at exactly the cap must not be destroyed within the bounded wait");
  } finally {
    listener.server.close();
  }
});

test(`a line of the cap's own byte count plus one, no trailing newline, IS destroyed: hadError=false and zero response bytes`, async () => {
  const listener = await startTransportListener();
  try {
    const line = "x".repeat(CAP + 1);
    assert.equal(Buffer.byteLength(line, "utf8"), CAP + 1);
    const outcome = await dialAndSendLine(listener.port, line);
    assert.equal(outcome.closed, true);
    assert.equal(outcome.hadError, false);
    assert.equal(outcome.gotData, false);
  } finally {
    listener.server.close();
  }
});

test("a line whose JavaScript .length is below the cap but whose UTF-8 byte length is above it IS destroyed -- the cap is bytes, not characters", async () => {
  const listener = await startTransportListener();
  try {
    // "日" is one UTF-16 code unit (so .length counts it as 1) but three
    // UTF-8 bytes -- repeating it enough times crosses the byte cap while
    // staying comfortably under it in JS string .length.
    const CHAR = "日";
    const count = Math.floor(CAP / 3) + 100;
    const line = CHAR.repeat(count);
    assert.ok(line.length < CAP, "line.length (UTF-16 code units) must stay below the cap for this case to test what it claims");
    assert.ok(Buffer.byteLength(line, "utf8") > CAP, "the line's UTF-8 byte length must exceed the cap");
    const outcome = await dialAndSendLine(listener.port, line);
    // Measured (this session): with multi-byte UTF-8 content, the raw
    // TCP-level close can race the client's own still-in-flight write and
    // surface as hadError=true (ECONNRESET) rather than the clean
    // hadError=false destroy the two pure-ASCII cases above observe --
    // this is a property of that race, not of the cap check itself, so
    // unlike those two cases this one deliberately does NOT assert on
    // hadError's value. What the plan's own <behavior> requires here, and
    // what this asserts, is narrower: destroyed, and zero response bytes
    // of any kind either way.
    assert.equal(outcome.closed, true, "an over-cap multi-byte line must still be destroyed");
    assert.equal(outcome.gotData, false, "no error frame, no bad_request frame, no partial JSON -- zero bytes of any kind, regardless of hadError's value");
  } finally {
    listener.server.close();
  }
});

// ---------------------------------------------------------------------------
// Task 1 behaviour: the host_tool result-by-reference shape, asserted by
// recursive key enumeration rather than by comment -- this fails when
// someone later adds a payload field, which a source grep would not.
// ---------------------------------------------------------------------------

const DIAGNOSTIC_STRING_BOUND = 100_000;

/** Walks a host_tool response recursively and fails loudly the moment it
 * finds a Buffer value anywhere, or a string longer than a generous
 * diagnostic bound outside the one field allowed to carry diagnostic text
 * (`stderrTail`). This is the NEGATIVE assertion the plan calls for: it
 * fails when a future change adds a byte-payload field, at any nesting
 * depth, which a grep over the source text would not catch. */
function assertNoBytePayload(value: unknown, label: string): void {
  if (Buffer.isBuffer(value)) {
    assert.fail(`${label}: value is a Buffer -- a host_tool response must never carry raw bytes`);
  }
  if (typeof value === "string" && value.length > DIAGNOSTIC_STRING_BOUND && !label.endsWith(".stderrTail")) {
    assert.fail(`${label}: string of length ${value.length} exceeds the diagnostic bound -- reads like an inline byte payload rather than a path/digest/diagnostic`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, i) => assertNoBytePayload(item, `${label}[${i}]`));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      assertNoBytePayload(v, `${label}.${key}`);
    }
  }
}

async function withTempDir<T>(fn: (dir: string) => Promise<T> | T): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "host-tool-transport-test-"));
  try {
    return await fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A small, executable, controllable stand-in for the real `acme` binary --
 * locates its own `-o <path>` flag (the same flag buildHostToolArgv() always
 * emits) and writes either a handful of bytes or a genuinely empty file.
 * Keeps every case in this file deterministic and independent of whether
 * real ACME happens to be installed on this host. */
function writeFakeAcme(dir: string, mode: "normal" | "zerobyte"): string {
  const scriptPath = join(dir, "fake-acme.mjs");
  writeFileSync(
    scriptPath,
    [
      "#!/usr/bin/env node",
      'import { writeFileSync } from "node:fs";',
      "const argv = process.argv.slice(2);",
      'const oIdx = argv.indexOf("-o");',
      "const outPath = oIdx !== -1 ? argv[oIdx + 1] : null;",
      `const mode = ${JSON.stringify(mode)};`,
      "if (outPath) {",
      '  writeFileSync(outPath, mode === "zerobyte" ? Buffer.alloc(0) : Buffer.from("fake .prg bytes\\n", "utf8"));',
      "}",
      "process.exit(0);",
      "",
    ].join("\n"),
    "utf8",
  );
  chmodSync(scriptPath, 0o755);
  return scriptPath;
}

async function withFakeAcme<T>(acmeBinOverride: string, fn: () => Promise<T> | T): Promise<T> {
  const previous = process.env.ACME_BIN;
  process.env.ACME_BIN = acmeBinOverride;
  try {
    return await fn();
  } finally {
    if (previous === undefined) delete process.env.ACME_BIN;
    else process.env.ACME_BIN = previous;
  }
}

// Built BEFORE importing the artifact -- broker-state.test.ts's own idiom,
// already followed by host-tool.test.ts -- so this suite never reaches a
// stale committed resources/host-tool.mjs.
build();
const hostToolModule = (await import(new URL("./resources/host-tool.mjs", import.meta.url).href)) as unknown as {
  runHostTool: (
    raw: unknown,
    deps: { repoRoot: string; log?: (line: string) => void; timeoutMs?: number },
  ) => Promise<
    | { ok: true; tool: string; exitStatus: number | null; results: Array<{ path: string; sha256: string; byteLength: number }>; stderrTail: string }
    | { ok: false; message: string }
  >;
};
const { runHostTool } = hostToolModule;

async function startHostToolListener(repoRoot: string): Promise<{ listener: StartControlListenerResult; token: string }> {
  const token = "host-tool-transport-result-shape-token";
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    ...baseListenerOptions((raw: unknown) => runHostTool(raw, { repoRoot })),
  });
  return { listener, token };
}

test("a host_tool response carries no byte payload at any field, asserted by recursive key enumeration, and each result entry's key set is exactly path/sha256/byteLength", async () => {
  await withTempDir(async (dir) => {
    const fakeAcme = writeFakeAcme(dir, "normal");
    await withFakeAcme(fakeAcme, async () => {
      writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", noReport: true } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (!response.ok) return;
      assertNoBytePayload(response, "response");
      assert.equal(response.results.length, 1);
      assert.deepEqual(Object.keys(response.results[0]).sort(), ["byteLength", "path", "sha256"]);
    });
  });
});

test("a zero-byte produced output crosses as byteLength: 0 with the sha256 of the empty byte string -- never an omitted or null entry", async () => {
  await withTempDir(async (dir) => {
    const fakeAcme = writeFakeAcme(dir, "zerobyte");
    await withFakeAcme(fakeAcme, async () => {
      writeFileSync(join(dir, "a.a"), "; test source\n", "utf8");
      const response = await runHostTool({ tool: "acme.build", args: { source: "a.a", noReport: true } }, { repoRoot: dir });
      assert.equal(response.ok, true);
      if (!response.ok) return;
      assert.equal(response.results.length, 1);
      assert.equal(response.results[0].byteLength, 0);
      const emptySha256 = createHash("sha256").update(Buffer.alloc(0)).digest("hex");
      assert.equal(response.results[0].sha256, emptySha256);
      assert.deepEqual(Object.keys(response.results[0]).sort(), ["byteLength", "path", "sha256"]);
      assertNoBytePayload(response, "response");
    });
  });
});

test("two host_tool requests issued over the real control plane without awaiting the first resolve to distinct output paths, each sha256 matching an independent digest of its own file on disk", async () => {
  await withTempDir(async (dir) => {
    writeFileSync(join(dir, "a.a"), "; test source A\n", "utf8");
    writeFileSync(join(dir, "b.a"), "; test source B\n", "utf8");
    const fakeAcme = writeFakeAcme(dir, "normal");
    await withFakeAcme(fakeAcme, async () => {
      const { listener, token } = await startHostToolListener(dir);
      try {
        const stateDir = mkdtempSync(join(tmpdir(), "host-tool-transport-broker-json-"));
        try {
          writeFileSync(brokerJsonPath(stateDir), JSON.stringify({ control_host: "127.0.0.1", control_port: listener.port, control_token: token }));
          const [responseA, responseB] = await Promise.all([
            hostToolOverControlPlane(stateDir, "acme.build", { source: "a.a", noReport: true }),
            hostToolOverControlPlane(stateDir, "acme.build", { source: "b.a", noReport: true }),
          ]);
          assert.equal(responseA.ok, true);
          assert.equal(responseB.ok, true);
          if (!responseA.ok || !responseB.ok) return;
          assert.equal(responseA.results.length, 1);
          assert.equal(responseB.results.length, 1);
          assert.notEqual(responseA.results[0].path, responseB.results[0].path);
          const digestA = createHash("sha256").update(readFileSync(responseA.results[0].path)).digest("hex");
          const digestB = createHash("sha256").update(readFileSync(responseB.results[0].path)).digest("hex");
          assert.equal(responseA.results[0].sha256, digestA);
          assert.equal(responseB.results[0].sha256, digestB);
        } finally {
          rmSync(stateDir, { recursive: true, force: true });
        }
      } finally {
        listener.server.close();
      }
    });
  });
});
