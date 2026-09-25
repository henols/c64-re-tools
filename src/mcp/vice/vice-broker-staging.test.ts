// vice-broker-staging.test.ts
//
// Phase 64, plan 64-03 (XFER-04/XFER-07, D-05/D-06): the real broker
// wiring for `stage_file`/`transfer` -- handleStageFile()/handleFileTransfer()
// against a REAL startControlListener() bound to port zero, a real client
// socket dialling it, and real files under a fresh mkdtempSync
// VICE_BROKER_HOME. vice-broker.mts is host-bound: it VALUE-imports sibling
// host-bound modules ("./broker-transfer.mjs" among them), so -- like
// broker-relay.test.ts's own load -- this file builds FIRST and imports the
// COMPILED resources/vice-broker.mjs, never the unbuilt ".mts" source
// directly (an unbuilt import would throw ERR_MODULE_NOT_FOUND on the first
// sibling it tries to resolve).
import { test } from "node:test";
import assert from "node:assert/strict";
import { connect as netConnect, type Socket } from "node:net";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build } from "./build.ts";
import {
  startControlListener,
  newControlToken,
  type StartControlListenerResult,
  type AcquireOutcome,
  type StatusInstanceEntry,
  type HostStateFields,
  type MonitorClaimOutcome,
  type MonitorReleaseOutcome,
  type RelayAttachOutcome,
  type OperationNoteOutcome,
} from "./broker-control.mts";
import { createBrokerState, type BrokerState, type InstanceRecord } from "./broker-state.mts";
import type { StageFileOutcome, FileTransferRequest, FileTransferOutcome } from "./broker-control.mts";

const HERE_MODULE_URL = import.meta.url;

build();

interface StagedFileEntry {
  handle: string;
  path: string;
  grantId: string;
  slot: string;
  claimedAt: number;
}

const brokerTransferModule = (await import(new URL("./resources/broker-transfer.mjs", HERE_MODULE_URL).href)) as unknown as {
  resetStagingForTest: () => void;
  resolveStagedFile: (handle: string) => { ok: true; entry: StagedFileEntry } | { ok: false; reason: string };
};
const { resetStagingForTest, resolveStagedFile } = brokerTransferModule;

const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", HERE_MODULE_URL).href)) as unknown as {
  handleRelease: (requestId: string, state: BrokerState) => void;
  handleStageFile: (grantId: string, slot: string, state: BrokerState) => StageFileOutcome;
  handleFileTransfer: (
    request: FileTransferRequest,
    socket: Socket,
    pending: Buffer,
    state: BrokerState,
    deps?: { beforePublish?: () => Promise<void> },
  ) => FileTransferOutcome;
};
const { handleRelease, handleStageFile, handleFileTransfer } = viceBrokerModule;

// ---------------------------------------------------------------------------
// Fixtures -- mirrors broker-relay.test.ts's own makeGrantedInstance()/
// setupBrokerState() shape (this file needs no relay session, so the
// InstanceRecord fields relevant to that are left at their defaults).
// ---------------------------------------------------------------------------

function makeGrantedInstance(port: number, overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/staging-test-epoch.json",
    supervisorDir: "/tmp/staging-test",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    monitorClients: {},
    ...overrides,
  };
}

function setupBrokerState(emulatorPort: number, targetId: string): BrokerState {
  const state = createBrokerState();
  state.instances.set(emulatorPort, makeGrantedInstance(emulatorPort));
  state.grants.set(targetId, { id: targetId, port: emulatorPort, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

/** Starts a REAL control listener wired to the compiled artifacts'
 * handleStageFile()/handleFileTransfer()/handleRelease() -- the same
 * production functions the real broker calls, not a re-implemented
 * stand-in. `onAcquire` is a stub that always succeeds -- this suite never
 * exercises a real spawn; it only needs `requestIdForThisConnection` set on
 * the acquiring connection so `stage_file`'s own ownsTarget() gate passes
 * for a grant this test already pre-populated directly in `state`.
 *
 * G-64-5 (plan 64-15): `getDeps` is OPTIONAL and read AT CALL TIME (never
 * captured once), mirroring stock-connect.test.ts's own
 * `startTransferControlListener()` -- so a test can arm/rearm a
 * `beforePublish` timing hook right before its own upload, without needing
 * a fresh listener per case. Every existing caller passes nothing and is
 * unaffected (defaults to `{}`, which `handleFileTransfer()`'s own default
 * parameter already treats identically to an entirely absent 5th
 * argument). */
async function startStagingListenerForState(
  state: BrokerState,
  emulatorPort: number,
  getDeps: () => { beforePublish?: () => Promise<void> } = () => ({}),
): Promise<{ listener: StartControlListenerResult; token: string }> {
  const token = newControlToken();
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    token,
    onAcquire: async (): Promise<AcquireOutcome> => ({
      ok: true,
      grant: { port: emulatorPort, url: `http://127.0.0.1:${emulatorPort}/mcp`, epochFile: "/tmp/staging-test-epoch.json", supervisorDir: "/tmp/staging-test" },
    }),
    onRelease: (requestId: string) => handleRelease(requestId, state),
    onStatus: (): StatusInstanceEntry[] => [],
    onHostState: (): HostStateFields => ({
      pid: process.pid,
      startedAt: "2026-01-01T00:00:00Z",
      nodeVersion: process.version,
      viceBin: "x64sc",
      maxInstances: 1,
      basePort: emulatorPort,
      backend: "stock",
    }),
    onMonitorClaim: (): MonitorClaimOutcome => ({ ok: false, code: "bad_request" }),
    onMonitorRelease: (): MonitorReleaseOutcome => ({ ok: false, code: "bad_request" }),
    onRelayAttach: (): RelayAttachOutcome => ({ ok: false, code: "internal" }),
    onOperation: (): OperationNoteOutcome => ({ ok: true }),
    // vice-broker.mts's own real handleStageFile()/handleFileTransfer() are
    // wired via the real broker's own startup -- this suite calls them the
    // SAME way, through their real production entry points, imported above
    // from the compiled artifact.
    onStageFile: (targetId: string, slot: string) => handleStageFile(targetId, slot, state),
    onFileTransfer: (request, socket, pending) => handleFileTransfer(request, socket, pending, state, getDeps()),
  });
  return { listener, token };
}

/** Runs `fn` with a fresh mkdtempSync VICE_BROKER_HOME -- never the real
 * machine-level root -- restoring the previous value (or unsetting it) in a
 * `finally`, and resetting broker-transfer.mts's own module-level staging
 * registry before and after so no test leaks state into the next one. */
async function withStagingFixture<T>(fn: (home: string) => Promise<T>): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), "vice-broker-staging-"));
  const previous = process.env.VICE_BROKER_HOME;
  process.env.VICE_BROKER_HOME = home;
  resetStagingForTest();
  try {
    return await fn(home);
  } finally {
    resetStagingForTest();
    if (previous === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = previous;
    rmSync(home, { recursive: true, force: true });
  }
}

async function waitFor(predicate: () => boolean, deadlineMs: number, pollMs = 15): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

function onceConnected(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.once("connect", () => resolve());
    socket.once("error", reject);
  });
}

function onceClosed(socket: Socket): Promise<void> {
  return new Promise((resolve) => {
    if (socket.destroyed) {
      resolve();
      return;
    }
    socket.once("close", () => resolve());
  });
}

/** Reads ONE newline-terminated JSON line off `socket`'s front, by a
 * byte-level `indexOf(0x0a)` search -- never a whole-buffer string decode,
 * since bytes past the terminator (a download's own payload) may arrive in
 * the SAME chunk. Returns the parsed object and whatever followed the
 * terminator, untouched, as a raw Buffer. */
function readLineFromSocket(socket: Socket): Promise<{ obj: Record<string, unknown>; pending: Buffer }> {
  return new Promise((resolve, reject) => {
    let carry = Buffer.alloc(0);
    const onData = (chunk: Buffer): void => {
      carry = Buffer.concat([carry, chunk]);
      const idx = carry.indexOf(0x0a);
      if (idx === -1) return;
      socket.removeListener("data", onData);
      const lineText = carry.subarray(0, idx).toString("utf8");
      const pending = carry.subarray(idx + 1);
      try {
        resolve({ obj: JSON.parse(lineText) as Record<string, unknown>, pending });
      } catch (e) {
        reject(new Error(`could not parse reply line ${JSON.stringify(lineText)}: ${(e as Error).message}`));
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

/** Accumulates bytes off `socket` until at least `total` bytes have been
 * seen (counting `already` first), then resolves exactly `total` bytes --
 * the download payload's own read, matching the client's real
 * `pipeline(socket, ...)` consumption shape without importing it. */
function readExactBytes(socket: Socket, already: Buffer, total: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let acc = already;
    if (acc.length >= total) {
      resolve(acc.subarray(0, total));
      return;
    }
    const onData = (chunk: Buffer): void => {
      acc = Buffer.concat([acc, chunk]);
      if (acc.length >= total) {
        socket.removeListener("data", onData);
        socket.removeListener("error", onError);
        resolve(acc.subarray(0, total));
      }
    };
    const onError = (e: Error): void => reject(e);
    socket.on("data", onData);
    socket.once("error", onError);
  });
}

/** A minimal line-oriented control client, mirroring broker-control.test.ts's
 * own makeClient() -- send() writes one JSON line, sendAndRead() awaits the
 * next reply line. Only ever used for JSON-only control ops on this
 * connection (acquire/stage_file/release); a transfer connection is always
 * a SEPARATE, brand-new socket (per-test, dialled directly), never this
 * helper. */
function makeControlClient(port: number): { socket: Socket; sendAndRead: (obj: Record<string, unknown>) => Promise<Record<string, unknown>>; close: () => void } {
  const socket = netConnect({ host: "127.0.0.1", port });
  return {
    socket,
    async sendAndRead(obj: Record<string, unknown>): Promise<Record<string, unknown>> {
      const p = readLineFromSocket(socket);
      socket.write(`${JSON.stringify(obj)}\n`);
      const { obj: reply } = await p;
      return reply;
    },
    close(): void {
      socket.destroy();
    },
  };
}

function digestOf(buf: Buffer): { byteLength: number; sha256: string } {
  return { byteLength: buf.length, sha256: createHash("sha256").update(buf).digest("hex") };
}

/** Every byte value 0x00..0xFF, once -- definitively not valid UTF-8. */
function fullByteRangeBuffer(): Buffer {
  const buf = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) buf[i] = i;
  return buf;
}

let nextPort = 17600;
function nextEmulatorPort(): number {
  nextPort += 1;
  return nextPort;
}

// ---------------------------------------------------------------------------
// Task 2 (Phase 64-03, XFER-04/XFER-07): the wired-in real broker, exercised
// through a real control listener and real transfer connections.
// ---------------------------------------------------------------------------

test("vice-broker-staging: a full upload-then-download round trip is byte-for-byte identical for a buffer spanning every value 0x00..0xFF", async () => {
  await withStagingFixture(async () => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-aaaaaaaa";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const control = makeControlClient(listener.port);
      try {
        const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId, token });
        assert.equal(acquireReply.kind, "grant");

        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        assert.equal(stageReply.kind, "file_staged");
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;
        assert.equal(typeof handle, "string");
        assert.equal(typeof emulatorFilename, "string");

        const payload = fullByteRangeBuffer();
        const { byteLength, sha256 } = digestOf(payload);

        // Upload
        const uploadSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(uploadSocket);
        const uploadReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.write(`${JSON.stringify({ op: "transfer", direction: "upload", handle, byteLength, sha256, token })}\n`);
        const { obj: uploadReply } = await uploadReplyPromise;
        assert.equal(uploadReply.kind, "transfer_ready");

        // G-64-3 (plan 64-13): the completion reader is armed BEFORE the
        // write side is ended -- a line that arrived before a reader was
        // attached would be lost, since nothing else on this connection
        // keeps a byte buffer once transfer_ready's own listeners are torn
        // down (readLineFromSocket()'s own "data" listener, above).
        const completionReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.end(payload);
        const { obj: completionReply } = await completionReplyPromise;
        assert.equal(completionReply.kind, "transfer_complete");
        assert.deepEqual(Object.keys(completionReply).sort(), ["byteLength", "kind", "sha256"], "the completion reply's key set must be exactly kind, byteLength and sha256");
        assert.equal(completionReply.byteLength, byteLength);
        assert.equal(completionReply.sha256, sha256);

        // No polling: the completion reply IS the broker's own confirmation
        // that the file has already been published -- it must already exist,
        // synchronously, the instant this reply is read.
        assert.equal(existsSync(emulatorFilename), true, "the staged file must already exist the instant the completion reply is read");
        const uploadedBytes = readFileSync(emulatorFilename);
        assert.ok(uploadedBytes.equals(payload), "the staged file's bytes must equal the uploaded bytes exactly");
        await onceClosed(uploadSocket);

        // Download
        const downloadSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(downloadSocket);
        const downloadReplyPromise = readLineFromSocket(downloadSocket);
        downloadSocket.write(`${JSON.stringify({ op: "transfer", direction: "download", handle, token })}\n`);
        const { obj: downloadReply, pending } = await downloadReplyPromise;
        assert.equal(downloadReply.kind, "transfer_payload");
        assert.equal(downloadReply.byteLength, byteLength);
        assert.equal(downloadReply.sha256, sha256);
        const received = await readExactBytes(downloadSocket, pending, byteLength);
        assert.ok(received.equals(payload), "the downloaded bytes must equal the staged bytes exactly");
        await onceClosed(downloadSocket);
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: a transfer presenting an unknown handle receives an error frame and no file appears anywhere under VICE_BROKER_HOME", async () => {
  await withStagingFixture(async (home) => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-bbbbbbbb";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const socket = netConnect({ host: "127.0.0.1", port: listener.port });
      await onceConnected(socket);
      const replyPromise = readLineFromSocket(socket);
      socket.write(`${JSON.stringify({ op: "transfer", direction: "download", handle: "0000000000000000000000000000000000", token })}\n`);
      const { obj: reply } = await replyPromise;
      assert.equal(reply.kind, "error");
      assert.equal(reply.code, "denied");
      socket.destroy();

      assert.equal(existsSync(join(home, "staging")), false, "no staging directory may exist -- nothing was ever staged");
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: an upload whose declared digest disagrees with its bytes leaves no file at the staged path", async () => {
  await withStagingFixture(async (home) => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-cccccccc";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const control = makeControlClient(listener.port);
      try {
        await control.sendAndRead({ op: "acquire", id: grantId, token });
        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;

        const payload = fullByteRangeBuffer();
        const wrongSha256 = createHash("sha256").update(Buffer.from("not the real payload")).digest("hex");

        const uploadSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(uploadSocket);
        const uploadReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.write(`${JSON.stringify({ op: "transfer", direction: "upload", handle, byteLength: payload.length, sha256: wrongSha256, token })}\n`);
        const { obj: uploadReply } = await uploadReplyPromise;
        assert.equal(uploadReply.kind, "transfer_ready");

        // G-64-3 (plan 64-13): armed BEFORE ending the write side -- see the
        // round-trip test's own comment above for why call order matters.
        const errorReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.end(payload);
        const { obj: errorReply } = await errorReplyPromise;
        assert.equal(errorReply.kind, "error");
        assert.match(String(errorReply.message ?? ""), /digest mismatch/i, "the error line's message must name the mismatch");
        assert.ok(!String(errorReply.message ?? "").includes(home), "the error line's message must contain no path under VICE_BROKER_HOME");
        await onceClosed(uploadSocket);

        assert.equal(existsSync(emulatorFilename), false, "a digest mismatch must leave no file at the staged path");
        assert.equal(resolveStagedFile(handle).ok, true, "the handle itself is still a known registry entry -- only the FILE is missing");
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: real fs fault at the publish rename (the session directory removed before the rename) answers an error line with the errno code and no path under VICE_BROKER_HOME", async () => {
  await withStagingFixture(async (home) => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-64-15-t2-rename";
    const state = setupBrokerState(emulatorPort, grantId);
    // Starts undefined -- armed right before this upload so the hook is
    // per-case, matching stock-connect.test.ts's own getDeps shape.
    let beforePublish: (() => Promise<void>) | undefined;
    const { listener, token } = await startStagingListenerForState(state, emulatorPort, () => ({ beforePublish }));
    try {
      const control = makeControlClient(listener.port);
      try {
        await control.sendAndRead({ op: "acquire", id: grantId, token });
        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;

        const payload = fullByteRangeBuffer();
        const { byteLength, sha256 } = digestOf(payload);

        // The digest/count verdict has already been reached by the time
        // this hook runs (D-11's own timing contract) -- removing the
        // WHOLE session directory here means the renameSync() that
        // follows fails with a REAL ENOENT, never a synthetic one.
        beforePublish = async () => {
          rmSync(join(home, "staging", grantId), { recursive: true, force: true });
        };

        const uploadSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(uploadSocket);
        const uploadReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.write(`${JSON.stringify({ op: "transfer", direction: "upload", handle, byteLength, sha256, token })}\n`);
        const { obj: uploadReply } = await uploadReplyPromise;
        assert.equal(uploadReply.kind, "transfer_ready");

        const errorReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.end(payload);
        const { obj: errorReply } = await errorReplyPromise;
        assert.equal(errorReply.kind, "error");
        assert.deepEqual(Object.keys(errorReply).sort(), ["code", "kind", "message"], "the error line's key set must be exactly code/kind/message");
        assert.equal(errorReply.code, "internal");
        const message = String(errorReply.message ?? "");
        assert.match(message, /\(ENOENT\)/);
        assert.ok(!message.includes(home), "the error line's message must contain no path under VICE_BROKER_HOME");
        assert.ok(!message.includes(emulatorFilename), "the error line's message must not name the staged path");
        await onceClosed(uploadSocket);

        assert.equal(existsSync(emulatorFilename), false, "no file may exist at the staged path");
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: real fs fault in the pre-publish hook (a real ENOENT fs error) answers an error line with the errno code and no path under VICE_BROKER_HOME", async () => {
  await withStagingFixture(async (home) => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-64-15-t2-hook";
    const state = setupBrokerState(emulatorPort, grantId);
    let beforePublish: (() => Promise<void>) | undefined;
    const { listener, token } = await startStagingListenerForState(state, emulatorPort, () => ({ beforePublish }));
    try {
      const control = makeControlClient(listener.port);
      try {
        await control.sendAndRead({ op: "acquire", id: grantId, token });
        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;

        const payload = fullByteRangeBuffer();
        const { byteLength, sha256 } = digestOf(payload);

        // A real ENOENT, carrying its own path -- never a synthetic
        // rejection the test authored itself.
        beforePublish = async () => {
          readFileSync(join(home, "staging", grantId, "no-such-file"));
        };

        const uploadSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(uploadSocket);
        const uploadReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.write(`${JSON.stringify({ op: "transfer", direction: "upload", handle, byteLength, sha256, token })}\n`);
        const { obj: uploadReply } = await uploadReplyPromise;
        assert.equal(uploadReply.kind, "transfer_ready");

        const errorReplyPromise = readLineFromSocket(uploadSocket);
        uploadSocket.end(payload);
        const { obj: errorReply } = await errorReplyPromise;
        assert.equal(errorReply.kind, "error");
        assert.deepEqual(Object.keys(errorReply).sort(), ["code", "kind", "message"], "the error line's key set must be exactly code/kind/message");
        assert.equal(errorReply.code, "internal");
        const message = String(errorReply.message ?? "");
        assert.match(message, /\(ENOENT\)/);
        assert.ok(!message.includes(home), "the error line's message must contain no path under VICE_BROKER_HOME");
        assert.ok(!message.includes(emulatorFilename), "the error line's message must not name the staged path");
        await onceClosed(uploadSocket);

        assert.equal(existsSync(emulatorFilename), false, "no file may exist at the staged path after a hook failure");
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: a download for a handle whose staged file does not exist yet is refused by name, never a zero-byte payload", async () => {
  await withStagingFixture(async () => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-dddddddd";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const control = makeControlClient(listener.port);
      try {
        await control.sendAndRead({ op: "acquire", id: grantId, token });
        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;
        assert.equal(existsSync(emulatorFilename), false, "nothing has been uploaded yet");

        const socket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(socket);
        const replyPromise = readLineFromSocket(socket);
        socket.write(`${JSON.stringify({ op: "transfer", direction: "download", handle, token })}\n`);
        const { obj: reply } = await replyPromise;
        assert.equal(reply.kind, "error");
        assert.equal(reply.code, "denied");
        assert.doesNotMatch(String(reply.message ?? ""), /^$/);
        socket.destroy();
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: a second transfer on an in-flight handle is refused while the first completes successfully", async () => {
  await withStagingFixture(async () => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-eeeeeeee";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const control = makeControlClient(listener.port);
      try {
        await control.sendAndRead({ op: "acquire", id: grantId, token });
        const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
        const handle = stageReply.handle as string;
        const emulatorFilename = stageReply.emulator_filename as string;

        const payload = fullByteRangeBuffer();
        const { byteLength, sha256 } = digestOf(payload);

        const firstSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(firstSocket);
        const firstReplyPromise = readLineFromSocket(firstSocket);
        firstSocket.write(`${JSON.stringify({ op: "transfer", direction: "upload", handle, byteLength, sha256, token })}\n`);
        const { obj: firstReply } = await firstReplyPromise;
        assert.equal(firstReply.kind, "transfer_ready");
        // Write all but the last byte -- the transfer is now "in flight"
        // (markTransferInFlight() already ran, strictly before the
        // transfer_ready reply above was written) but not yet complete.
        firstSocket.write(payload.subarray(0, payload.length - 1));

        const secondSocket = netConnect({ host: "127.0.0.1", port: listener.port });
        await onceConnected(secondSocket);
        const secondReplyPromise = readLineFromSocket(secondSocket);
        secondSocket.write(`${JSON.stringify({ op: "transfer", direction: "download", handle, token })}\n`);
        const { obj: secondReply } = await secondReplyPromise;
        assert.equal(secondReply.kind, "error");
        assert.equal(secondReply.code, "denied");
        assert.match(String(secondReply.message ?? ""), /in flight/);
        secondSocket.destroy();

        // Now complete the first transfer.
        firstSocket.end(payload.subarray(payload.length - 1));
        await onceClosed(firstSocket);

        // See the round-trip test's own comment: the socket closing is not
        // a completion confirmation -- poll (bounded) for the publish.
        const published = await waitFor(() => existsSync(emulatorFilename), 2000);
        assert.ok(published, "the first transfer must eventually publish its file");
        const uploadedBytes = readFileSync(emulatorFilename);
        assert.ok(uploadedBytes.equals(payload), "the first transfer must complete successfully, unaffected by the refused second one");
      } finally {
        control.close();
      }
    } finally {
      listener.server.close();
    }
  });
});

test("vice-broker-staging: after the session-close path runs for a grant, the session's staging directory no longer exists", async () => {
  await withStagingFixture(async (home) => {
    const emulatorPort = nextEmulatorPort();
    const grantId = "req-1-1-ffffffff";
    const state = setupBrokerState(emulatorPort, grantId);
    const { listener, token } = await startStagingListenerForState(state, emulatorPort);
    try {
      const control = makeControlClient(listener.port);
      const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId, token });
      assert.equal(acquireReply.kind, "grant");
      const stageReply = await control.sendAndRead({ op: "stage_file", target_id: grantId, slot: "disk8", token });
      assert.equal(stageReply.kind, "file_staged");
      const emulatorFilename = stageReply.emulator_filename as string;
      const sessionDir = join(home, "staging", grantId);
      assert.ok(existsSync(sessionDir), "the session directory must exist once a slot has been staged");

      // Simulate a client killed with SIGKILL: no explicit `release`, just
      // the connection closing -- broker-control.mts's own onRelease
      // callback fires on connection close exactly as it would on an
      // explicit release request (see that file's own onRelease comment).
      control.close();

      const gone = await waitFor(() => !existsSync(sessionDir), 2000);
      assert.ok(gone, "the session's staging directory must be removed once its connection closes");
      assert.equal(existsSync(emulatorFilename), false);
    } finally {
      listener.server.close();
    }
  });
});

// ---------------------------------------------------------------------------
// 64-05-PLAN.md, Task 3 (XFER-07, D-07/D-08); placement corrected by G-64-6.
// reapOrphanedConfigScratch() runs in vice-broker.mts's pre-bind,
// unconditional startup-reap block, beside reapOrphanedInstances().
// sweepOrphanedStaging() runs later, only in the process that has won the
// control-port bind and only before it publishes its control token -- see
// vice-broker.mts's own call site. This test calls both directly through
// the SAME production root-resolution wiring vice-broker.mts itself uses
// (brokerConfigScratchDir()/brokerStagingDir(), no arguments, reading
// VICE_BROKER_HOME), against the SAME compiled artifacts, so a drift
// between the roots this test seeds and the roots the real broker resolves
// would show up here rather than only at startup. It pins ROOT AGREEMENT,
// not placement -- placement is pinned by broker-control.test.ts's
// spawned-real-broker `G-64-6` tests, which exercise the real run().
// ---------------------------------------------------------------------------

const brokerKillModule = (await import(new URL("./resources/broker-kill.mjs", HERE_MODULE_URL).href)) as unknown as {
  reapOrphanedConfigScratch: (opts: { root: string; isAlive?: (pid: number) => boolean; readProcessArgs?: (pid: number) => string }) => { found: number; removed: number };
  sweepOrphanedStaging: (opts: { root: string }) => { found: number; removed: number };
};
const { reapOrphanedConfigScratch, sweepOrphanedStaging } = brokerKillModule;

const brokerHomeModule = (await import(new URL("./resources/broker-home.mjs", HERE_MODULE_URL).href)) as unknown as {
  brokerConfigScratchDir: () => string;
  brokerStagingDir: () => string;
};
const { brokerConfigScratchDir, brokerStagingDir } = brokerHomeModule;

test("vice-broker startup reap (64-05, D-07/D-08): a fixture broker root's leftover staging directory is gone, and a config-scratch directory whose recorded process is alive is left in place", async () => {
  await withStagingFixture(async () => {
    const staleStagingDir = join(brokerStagingDir(), "req-leftover-session");
    mkdirSync(staleStagingDir, { recursive: true });
    writeFileSync(join(staleStagingDir, "some-staged-file"), "payload");

    const aliveConfigScratchDir = join(brokerConfigScratchDir(), "vice-broker-vicerc-startup-alive");
    mkdirSync(aliveConfigScratchDir, { recursive: true });
    writeFileSync(`${aliveConfigScratchDir}.json`, JSON.stringify({ pid: 424242, expectedIdentity: "x64sc" }));

    const configResult = reapOrphanedConfigScratch({
      root: brokerConfigScratchDir(),
      isAlive: () => true,
      readProcessArgs: () => "/usr/bin/x64sc -binarymonitor",
    });
    const stagingResult = sweepOrphanedStaging({ root: brokerStagingDir() });

    assert.equal(configResult.removed, 0, "a config-scratch directory whose recorded process is alive must not be removed");
    assert.ok(existsSync(aliveConfigScratchDir), "the alive config-scratch directory must still exist");
    assert.equal(stagingResult.removed, 1, "the leftover staging session directory must be removed");
    assert.equal(existsSync(staleStagingDir), false, "the leftover staging session directory must be gone");
  });
});
