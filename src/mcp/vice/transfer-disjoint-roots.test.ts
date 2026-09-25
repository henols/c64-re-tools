// transfer-disjoint-roots.test.ts
//
// Phase 64 plan 64-07 (XFER-01/XFER-05/XFER-08, ROADMAP criterion 1): proves
// the phase's own headline claim -- all four file-carrying tools
// (vice_autostart, vice_disk_attach, vice_snapshot_save, vice_snapshot_load)
// complete end to end against a client whose root and a broker whose root
// are DISJOINT temporary directories, and records what that proof is worth.
//
// Composes two fixtures that already exist rather than building a third:
// vice-broker-staging.test.ts's own real control listener / real staging
// directory (handleStageFile()/handleFileTransfer()/handleRelease() against
// the COMPILED resources/vice-broker.mjs, wired through startControlListener()
// bound to port zero), and stock-machine.test.ts's own DI-stub session with
// its `send` spy (the emulator itself stays a stub -- the spy stands in for
// AUTOSTART/DUMP/UNDUMP by acting on the staged path each request body
// names, because a live emulator is a separate, manual verification
// recorded in 64-07-PLAN.md's own <human-check>, not this file's job).
//
// D-17's guarantee, recorded here VERBATIM rather than softened: this proves
// nothing LEAKED, NOT that nothing was ever OPENED -- a stray read of a
// broker-side path that happens to succeed would still pass every assertion
// below. Two consequences follow from the owner's own decision, and neither
// is this file's to relitigate:
//   1. The transfer modules (transfer-hash.mts/broker-transfer.mts/
//      stock-connect.ts) do NOT need an injectable filesystem-root seam.
//      That was the recommended option's own cost, and D-17 put it out of
//      scope by choosing disjoint roots instead -- do not add one.
//   2. A source-scanning guard is not an available fallback here either.
//      This codebase's own locked rule ("no test may assert on text at
//      all", 260914-poo D-1) bans it, and ROADMAP.md's own Phase 53
//      withdrawal record shows that moving such a check into CI does not
//      escape that rule.
// A real container run in CI was offered as the only true proof of "no
// shared filesystem" and declined: this repository is host-developed with
// no devcontainer, so CI would be the only place the proven configuration
// ever existed -- proving nothing about what a developer's own host run
// does.
import { test } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { connect as netConnect, type Socket } from "node:net";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { mkdtempSync, mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, statSync, createReadStream, createWriteStream, renameSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import { handleAutostart, handleDiskAttach, handleSnapshotSave, handleSnapshotLoad } from "./stock-machine.ts";
import { CommandType, type ViceMonitorClient } from "./stock-protocol.ts";
import { dialFileTransfer, awaitTransferComplete } from "./broker-endpoint.mts";
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mts";
import { build } from "./build.ts";
import { startControlListener } from "./broker-control.mts";
import type {
  StartControlListenerResult,
  AcquireOutcome,
  StatusInstanceEntry,
  HostStateFields,
  MonitorClaimOutcome,
  MonitorReleaseOutcome,
  RelayAttachOutcome,
  OperationNoteOutcome,
  StageFileOutcome as BrokerStageFileOutcome,
  FileTransferRequest,
  FileTransferOutcome,
} from "./broker-control.mts";
import { createBrokerState, type BrokerState, type InstanceRecord } from "./broker-state.mts";
import type { StockConnectSession, TransferFileFn, TransferFileRequest, TransferFileResult } from "./stock-connect.ts";
import type { StockSessionDeps } from "./stock-session.ts";

// vice-broker.mts/broker-transfer.mts are host-bound (.mts, compiled into
// resources/) -- like vice-broker-staging.test.ts's own load, this file
// builds FIRST and imports the COMPILED resources/*.mjs, never the unbuilt
// source directly (an unbuilt import throws ERR_MODULE_NOT_FOUND).
const HERE_MODULE_URL = import.meta.url;
build();

const brokerTransferModule = (await import(new URL("./resources/broker-transfer.mjs", HERE_MODULE_URL).href)) as unknown as {
  resetStagingForTest: () => void;
};
const { resetStagingForTest } = brokerTransferModule;

const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", HERE_MODULE_URL).href)) as unknown as {
  handleRelease: (requestId: string, state: BrokerState) => void;
  handleStageFile: (grantId: string, slot: string, state: BrokerState) => BrokerStageFileOutcome;
  handleFileTransfer: (
    request: FileTransferRequest,
    socket: Socket,
    pending: Buffer,
    state: BrokerState,
    deps?: { beforePublish?: () => Promise<void> },
  ) => FileTransferOutcome;
};
const { handleRelease, handleStageFile, handleFileTransfer } = viceBrokerModule;

const fakeDeps = {} as StockSessionDeps;

// ---------------------------------------------------------------------------
// Broker-state / listener fixtures -- mirrors vice-broker-staging.test.ts's
// and stock-machine.test.ts's own round-trip fixtures exactly, composed
// rather than re-derived.
// ---------------------------------------------------------------------------

function makeGrantedInstance(port: number): InstanceRecord {
  return {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/transfer-disjoint-roots-epoch.json",
    supervisorDir: "/tmp/transfer-disjoint-roots",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: 0,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    monitorClients: {},
  };
}

/** `emulatorPort` here is a SYNTHETIC key inside this test's own in-memory
 * BrokerState -- it is never bound to an actual socket and nothing in this
 * file connects to it. It exists only so distinct test cases (and distinct
 * files run in the same `node --test` invocation) do not collide on the
 * same grant/instance map key. The one REAL network bind in this file is
 * the control listener below, which binds port 0 and reads the assigned
 * port back from the OS. */
function setupBrokerState(emulatorPort: number, targetId: string): BrokerState {
  const state = createBrokerState();
  state.instances.set(emulatorPort, makeGrantedInstance(emulatorPort));
  state.grants.set(targetId, { id: targetId, port: emulatorPort, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

/** `getDeps` is read AT CALL TIME (never captured once) so a test can arm
 * the `beforePublish` timing hook (G-64-3, plan 64-13) right before its own
 * upload starts. Defaults to no hook (the pre-64-13 behaviour). */
async function startDisjointListener(
  state: BrokerState,
  emulatorPort: number,
  getDeps: () => { beforePublish?: () => Promise<void> } = () => ({}),
): Promise<{ listener: StartControlListenerResult }> {
  const listener = await startControlListener({
    host: "127.0.0.1",
    port: 0,
    onAcquire: async (): Promise<AcquireOutcome> => ({
      ok: true,
      grant: {
        port: emulatorPort,
        url: `http://127.0.0.1:${emulatorPort}/mcp`,
        epochFile: "/tmp/transfer-disjoint-roots-epoch.json",
        supervisorDir: "/tmp/transfer-disjoint-roots",
      },
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
    onStageFile: (targetId: string, slot: string) => handleStageFile(targetId, slot, state),
    onFileTransfer: (request, socket, pending) => handleFileTransfer(request, socket, pending, state, getDeps()),
  });
  return { listener };
}

/** Byte-level newline search -- never a whole-buffer string decode,
 * matching vice-broker-staging.test.ts's own readLineFromSocket(). Control
 * replies on this connection are always pure JSON lines (acquire/
 * stage_file), so no trailing payload byte is ever discarded here. */
function readControlLine(socket: Socket): Promise<Record<string, unknown>> {
  return new Promise((resolvePromise, reject) => {
    let carry = Buffer.alloc(0);
    const onData = (chunk: Buffer): void => {
      carry = Buffer.concat([carry, chunk]);
      const idx = carry.indexOf(0x0a);
      if (idx === -1) return;
      socket.removeListener("data", onData);
      const lineText = carry.subarray(0, idx).toString("utf8");
      try {
        resolvePromise(JSON.parse(lineText) as Record<string, unknown>);
      } catch (e) {
        reject(new Error(`could not parse reply line ${JSON.stringify(lineText)}: ${(e as Error).message}`));
      }
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

function makeDisjointControlClient(port: number): { sendAndRead: (obj: Record<string, unknown>) => Promise<Record<string, unknown>>; close: () => void } {
  const socket = netConnect({ host: "127.0.0.1", port });
  return {
    async sendAndRead(obj: Record<string, unknown>): Promise<Record<string, unknown>> {
      const p = readControlLine(socket);
      socket.write(`${JSON.stringify(obj)}\n`);
      return p;
    },
    close(): void {
      socket.destroy();
    },
  };
}

async function waitForDisjoint(predicate: () => boolean, deadlineMs: number, pollMs = 15): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

/** A REAL StockConnectBrokerControl.stageFile(), sending `stage_file` over
 * the SAME control connection an `acquire` already ran on -- ownership
 * (`ownsTarget()`) is gated on that connection identity, broker-side.
 * Composed identically to stock-machine.test.ts's own makeRealStageFile(). */
function makeRealStageFile(control: { sendAndRead: (obj: Record<string, unknown>) => Promise<Record<string, unknown>> }) {
  return async (opts: { targetId: string; slot: string }): Promise<{ ok: true; handle: string; emulatorFilename: string } | { ok: false; reason: string }> => {
    const reply = await control.sendAndRead({ op: "stage_file", target_id: opts.targetId, slot: opts.slot });
    if (reply.kind === "file_staged") {
      return { ok: true, handle: reply.handle as string, emulatorFilename: reply.emulator_filename as string };
    }
    return { ok: false, reason: typeof reply.code === "string" ? reply.code : "internal" };
  };
}

/** A REAL TransferFileFn dialling this listener via dialFileTransfer()
 * (broker-endpoint.mts) and streaming through the SAME cap-and-digest
 * Transform (transfer-hash.mts) the real production defaultTransferFile()
 * (stock-connect.ts) uses. Composed here from the same exported public
 * seams a real caller would use -- defaultTransferFile() itself is not
 * exported and must not become one (no injectable filesystem-root seam is
 * to be added to it, D-17). Identical in shape to stock-machine.test.ts's
 * own makeRealTransferFile(). */
function makeRealTransferFile(port: number): TransferFileFn {
  return async (request: TransferFileRequest): Promise<TransferFileResult> => {
    if (request.direction === "upload") {
      let size: number;
      try {
        size = statSync(request.sourcePath).size;
      } catch (e) {
        return { ok: false, reason: `cannot read source file ${request.sourcePath}: ${(e as Error).message}` };
      }
      if (size > TRANSFER_MAX_BYTES) {
        return { ok: false, reason: `transfer exceeds the ${TRANSFER_MAX_BYTES} byte cap; source file is ${size} bytes` };
      }
      const digestPass = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
      await pipeline(
        createReadStream(request.sourcePath),
        digestPass,
        new Writable({
          write(_chunk, _encoding, callback) {
            callback();
          },
        }),
      );
      const { byteLength, sha256 } = digestPass.result();

      const dialResult = await dialFileTransfer({ handle: request.handle, direction: "upload", byteLength, sha256, port, candidates: ["127.0.0.1"] });
      if (!dialResult.ok) return { ok: false, reason: dialResult.reason };
      const { socket } = dialResult;
      try {
        // G-64-3 (plan 64-13): armed BEFORE the payload pipeline, awaited
        // AFTER -- exactly as the PRODUCTION defaultTransferFile() (stock-
        // connect.ts) now does, so this test-local copy stays faithful to
        // production rather than absorbing the publish race it closes.
        const completionPromise = awaitTransferComplete({ socket, byteLength, sha256, pending: dialResult.pending });
        const sendPass = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
        try {
          await pipeline(createReadStream(request.sourcePath), sendPass, socket);
        } catch (e) {
          const completion = await completionPromise;
          if (!completion.ok) return { ok: false, reason: completion.reason };
          return { ok: false, reason: `transfer failed while sending: ${(e as Error).message}` };
        }
        const completion = await completionPromise;
        if (!completion.ok) return { ok: false, reason: completion.reason };
        return { ok: true, byteLength, sha256 };
      } finally {
        if (!socket.destroyed) socket.destroy();
      }
    }

    const dialResult = await dialFileTransfer({ handle: request.handle, direction: "download", port, candidates: ["127.0.0.1"] });
    if (!dialResult.ok) return { ok: false, reason: dialResult.reason };
    if (dialResult.direction !== "download") {
      dialResult.socket.destroy();
      return { ok: false, reason: "internal error -- expected a download transfer reply" };
    }
    const { socket, byteLength, sha256, pending } = dialResult;
    try {
      if (byteLength > TRANSFER_MAX_BYTES) {
        return { ok: false, reason: `broker declared byteLength ${byteLength} exceeds the ${TRANSFER_MAX_BYTES} byte cap` };
      }
      if (pending.length > 0) socket.unshift(pending);
      mkdirSync(dirname(request.destPath), { recursive: true });
      const tmpPath = `${request.destPath}.tmp-${process.pid}-${Date.now()}`;
      const transform = createHashAndCountTransform({ capBytes: TRANSFER_MAX_BYTES });
      try {
        await pipeline(socket, transform, createWriteStream(tmpPath));
      } catch (e) {
        rmSync(tmpPath, { force: true });
        return { ok: false, reason: `transfer failed while receiving: ${(e as Error).message}` };
      }
      const observed = transform.result();
      const verdict = verifyObserved({ byteLength, sha256 }, observed);
      if (!verdict.ok) {
        rmSync(tmpPath, { force: true });
        return { ok: false, reason: verdict.reason };
      }
      renameSync(tmpPath, request.destPath);
      return { ok: true, byteLength: observed.byteLength, sha256: observed.sha256 };
    } finally {
      if (!socket.destroyed) socket.destroy();
    }
  };
}

// ---------------------------------------------------------------------------
// DI-stub emulator session -- mirrors stock-machine.test.ts's own
// makeSession() shape (an EventEmitter whose `send` is a spy).
// ---------------------------------------------------------------------------

function makeSession(responder: (commandType: number, body: Buffer) => unknown): { session: StockConnectSession; sends: Array<{ commandType: number; body: Buffer }> } {
  const sends: Array<{ commandType: number; body: Buffer }> = [];
  const emitter = new EventEmitter();
  (emitter as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    sends.push({ commandType, body });
    return responder(commandType, body);
  };
  const client = emitter as unknown as ViceMonitorClient;

  const session = {
    client,
    versionQuad: "3.9.0",
    capabilities: { cpuHistory: "absent" },
    host: "127.0.0.1",
    port: 6502,
    targetId: "test-target",
    brokerControl: {} as StockConnectSession["brokerControl"],
    deps: {},
    baselineEpoch: null,
  } as StockConnectSession;

  return { session, sends };
}

// AUTOSTART (0xdd) request body: runAfter(1) fileIndex(u16LE) filenameLen(1)
// filename(ASCII) -- see stock-protocol.ts's own autostartBody(). DUMP
// (0x41): saveRoms(1) saveDisks(1) filenameLen(1) filename. UNDUMP (0x42):
// filenameLen(1) filename. Decoded here rather than imported because the
// handlers under test build these bodies internally; the DI-stub responder
// must decode the SAME wire shape to find the broker-chosen filename.
function decodeAutostartFilename(body: Buffer): string {
  const len = body[3]!;
  return body.subarray(4, 4 + len).toString("ascii");
}
function decodeDumpFilename(body: Buffer): string {
  const len = body[2]!;
  return body.subarray(3, 3 + len).toString("ascii");
}
function decodeUndumpFilename(body: Buffer): string {
  const len = body[0]!;
  return body.subarray(1, 1 + len).toString("ascii");
}

/** Every byte value 0x00..0xFF, repeated to well over 65536 bytes -- so a
 * UTF-8 replacement anywhere on the journey shows up as a byte difference
 * rather than passing by luck. Mirrors stock-machine.test.ts's own
 * fullByteRangeRoundTripPayload(). */
function fullByteRangeBuffer(): Buffer {
  const unit = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) unit[i] = i;
  return Buffer.concat(Array(300).fill(unit) as Buffer[]); // 76800 bytes > 65536
}

// ---------------------------------------------------------------------------
// The recursive leak scanner -- enumerates every key and every nested
// value, never a fixed list of expected keys, so a planted violation in a
// key nobody anticipated still fails. Proven to catch a violation below,
// before it is ever relied on against a real handler result.
// ---------------------------------------------------------------------------

function collectStringLeaves(value: unknown, path: string, out: Array<{ path: string; value: string }>): void {
  if (typeof value === "string") {
    out.push({ path, value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectStringLeaves(v, `${path}[${i}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      collectStringLeaves(v, path === "" ? k : `${path}.${k}`, out);
    }
  }
}

function assertNoPrefixLeak(result: unknown, forbiddenPrefix: string, label: string): void {
  const leaves: Array<{ path: string; value: string }> = [];
  collectStringLeaves(result, "", leaves);
  const offenders = leaves.filter((leaf) => leaf.value.includes(forbiddenPrefix));
  assert.deepEqual(
    offenders,
    [],
    `${label}: no string value of any key may contain the broker-side prefix ${JSON.stringify(forbiddenPrefix)} -- found: ${JSON.stringify(offenders)}`,
  );
}

test("transfer-disjoint-roots: the leak scanner is proven to catch a violation in a key nobody anticipated, before it is trusted against a real result", () => {
  const planted = { ok: true, nested: { deeply: { surprise: "totally unexpected key carrying /some/broker/staging/path/file.bin" } } };
  assert.throws(() => assertNoPrefixLeak(planted, "/some/broker/staging", "self-test"), /broker-side prefix/, "the scanner must fail on a planted violation nested three levels deep, in a key not on any expected list");
  // Remove the plant -- prove the same object, with the offending substring
  // gone, now passes.
  planted.nested.deeply.surprise = "nothing broker-side here";
  assert.doesNotThrow(() => assertNoPrefixLeak(planted, "/some/broker/staging", "self-test-cleared"));
});

let nextDisjointEmulatorPort = 47600;
function reserveDisjointEmulatorPort(): number {
  nextDisjointEmulatorPort += 1;
  return nextDisjointEmulatorPort;
}

test("transfer-disjoint-roots: all four tools complete against a client and a broker that cannot see each other's filesystems, with no broker-side path in any result and nothing left in staging when the session ends", async () => {
  const clientRoot = mkdtempSync(join(tmpdir(), "transfer-disjoint-client-"));
  const brokerRoot = mkdtempSync(join(tmpdir(), "transfer-disjoint-broker-"));
  assert.ok(!brokerRoot.startsWith(clientRoot) && !clientRoot.startsWith(brokerRoot), "the two roots must be genuinely disjoint -- neither is a prefix of the other");

  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const prevBrokerHome = process.env.VICE_BROKER_HOME;
  process.env.CLAUDE_PROJECT_DIR = clientRoot;
  process.env.VICE_BROKER_HOME = brokerRoot;
  resetStagingForTest();

  const emulatorPort = reserveDisjointEmulatorPort();
  const grantId = "req-64-07-disjoint";
  const state = setupBrokerState(emulatorPort, grantId);
  // G-64-3 (plan 64-13): a 300ms pre-publish hook holds the broker's own
  // rename back deterministically for every upload in this test -- the
  // AUTOSTART/UNDUMP stubs below all read their staged file SYNCHRONOUSLY,
  // with no polling, proving transferFile() really does not resolve until
  // the broker has published the bytes.
  const beforePublish = () => new Promise<void>((resolve) => setTimeout(resolve, 300));
  const { listener } = await startDisjointListener(state, emulatorPort, () => ({ beforePublish }));
  const control = makeDisjointControlClient(listener.port);

  try {
    const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId });
    assert.equal(acquireReply.kind, "grant");

    // Source fixture files this CLIENT reads and uploads -- placed under
    // the client's own root A. D-14 permits an autostart/disk-attach path
    // to be ANY absolute path the client can read; placing them under A
    // keeps the "staged file lives under B, never under A" assertions
    // below meaningful rather than vacuous.
    const autostartFixturePath = join(clientRoot, "fixtures", "autostart.prg");
    mkdirSync(dirname(autostartFixturePath), { recursive: true });
    const autostartFixtureBytes = Buffer.from([0x01, 0x08, 0x00, 0x00, 0x9e, 0x32, 0x30, 0x36, 0x31, 0x00, 0x00, 0x00]);
    writeFileSync(autostartFixturePath, autostartFixtureBytes);

    const diskAttachFixturePath = join(clientRoot, "fixtures", "disk8.d64");
    const diskAttachBytes = Buffer.alloc(1024);
    for (let i = 0; i < diskAttachBytes.length; i++) diskAttachBytes[i] = i % 256;
    writeFileSync(diskAttachFixturePath, diskAttachBytes);

    // The snapshot payload: at least 65536 bytes spanning every value
    // 0x00..0xFF -- definitively not valid UTF-8, and large enough that a
    // truncation or a partial-chunk bug cannot pass by luck.
    const snapshotPayload = fullByteRangeBuffer();
    assert.ok(snapshotPayload.length >= 65536);

    const stagedPaths: { autostart?: string; diskAttach?: string; dump?: string; undump?: string } = {};

    const { session, sends } = makeSession((commandType, body) => {
      if (commandType === CommandType.AutoStart) {
        // AUTOSTART is the wire command BOTH vice_autostart and
        // vice_disk_attach send (D-14's own approximation). runAfter at
        // byte 0 distinguishes them here: handleAutostart defaults
        // run:true (byte 0x01, since this test never overrides it);
        // handleDiskAttach always sends runAfter:false (byte 0x00).
        //
        // G-64-3 (plan 64-13): transferFile() now resolves ok only after
        // the broker's own completion reply confirms the publish -- AUTOSTART
        // is sent only after that, so the staged file is read SYNCHRONOUSLY
        // the instant this stub is asked to open it, and its bytes are
        // compared against the fixture that was actually uploaded. No
        // polling: a client that named an unpublished or wrong file would
        // fail this assertion every time.
        const filename = decodeAutostartFilename(body);
        if (body[0] === 0x01) {
          stagedPaths.autostart = filename;
          assert.ok(existsSync(filename), "the staged autostart file must already exist synchronously when AUTOSTART names it");
          assert.ok(readFileSync(filename).equals(autostartFixtureBytes), "the staged autostart file's bytes must equal the uploaded fixture byte-for-byte");
        } else {
          stagedPaths.diskAttach = filename;
          assert.ok(existsSync(filename), "the staged disk-attach file must already exist synchronously when AUTOSTART names it");
          assert.ok(readFileSync(filename).equals(diskAttachBytes), "the staged disk-attach file's bytes must equal the uploaded fixture byte-for-byte");
        }
        return undefined; // neither handler reads a reply value
      }
      if (commandType === CommandType.Dump) {
        const filename = decodeDumpFilename(body);
        stagedPaths.dump = filename;
        // The stub emulator: DUMP writes the fixture bytes to the
        // broker-chosen staged path, mirroring stock-machine.test.ts's own
        // round-trip stub exactly.
        mkdirSync(dirname(filename), { recursive: true });
        writeFileSync(filename, snapshotPayload);
        return undefined;
      }
      if (commandType === CommandType.Undump) {
        const filename = decodeUndumpFilename(body);
        stagedPaths.undump = filename;
        // G-64-3 (plan 64-13): transferFile() now resolves ok only after the
        // broker's own completion reply confirms the publish -- UNDUMP is
        // sent only after that, so the staged file is read SYNCHRONOUSLY the
        // instant this stub is asked to open it. No polling: a client that
        // named an unpublished file would fail this assertion every time.
        assert.ok(existsSync(filename), "the staged snapshot file must already exist by the time UNDUMP names it -- no poll, no wait");
        const stagedBytes = readFileSync(filename);
        assert.ok(stagedBytes.equals(snapshotPayload), "the bytes UNDUMP is asked to load must equal the fixture bytes byte-for-byte");
        return { type: "undump", requestId: 1, errorCode: 0, programCounter: 0 };
      }
      return undefined;
    });

    session.targetId = grantId;
    session.brokerControl = { ...session.brokerControl, stageFile: makeRealStageFile(control) } as StockConnectSession["brokerControl"];
    session.deps = { ...session.deps, transferFile: makeRealTransferFile(listener.port) };

    // --- vice_autostart ---
    const autostartResult = await handleAutostart({ path: autostartFixturePath }, session, fakeDeps);
    assert.equal(autostartResult.isError, false, `vice_autostart must succeed: ${JSON.stringify(autostartResult)}`);
    const autostartPayload = JSON.parse(autostartResult.content[0]!.text) as Record<string, unknown>;
    assertNoPrefixLeak(autostartPayload, brokerRoot, "vice_autostart result");
    assert.ok(stagedPaths.autostart, "AUTOSTART must have been sent for vice_autostart");
    assert.ok(stagedPaths.autostart!.startsWith(brokerRoot), "the staged autostart file must live under the broker's own root B");
    assert.ok(!stagedPaths.autostart!.startsWith(clientRoot), "the staged autostart file must never live under the client's own root A");

    // --- vice_disk_attach ---
    const diskAttachResult = await handleDiskAttach({ unit: 8, path: diskAttachFixturePath }, session, fakeDeps);
    assert.equal(diskAttachResult.isError, false, `vice_disk_attach must succeed: ${JSON.stringify(diskAttachResult)}`);
    const diskAttachPayload = JSON.parse(diskAttachResult.content[0]!.text) as Record<string, unknown>;
    assertNoPrefixLeak(diskAttachPayload, brokerRoot, "vice_disk_attach result");
    assert.ok(stagedPaths.diskAttach, "AUTOSTART must have been sent for vice_disk_attach");
    assert.ok(stagedPaths.diskAttach!.startsWith(brokerRoot), "the staged disk image must live under the broker's own root B");
    assert.ok(!stagedPaths.diskAttach!.startsWith(clientRoot), "the staged disk image must never live under the client's own root A");
    assert.notEqual(stagedPaths.diskAttach, stagedPaths.autostart, "the two tools must stage into distinct slots (T-64-29) -- neither supersedes the other's staged file");

    // --- vice_snapshot_save ---
    const saveResult = await handleSnapshotSave({ name: "disjoint_roots_1" }, session, fakeDeps);
    assert.equal(saveResult.isError, false, `vice_snapshot_save must succeed: ${JSON.stringify(saveResult)}`);
    const savePayload = JSON.parse(saveResult.content[0]!.text) as Record<string, unknown>;
    assertNoPrefixLeak(savePayload, brokerRoot, "vice_snapshot_save result");
    const localSnapshotPath = savePayload.path as string;
    assert.ok(localSnapshotPath.startsWith(clientRoot), "the downloaded snapshot must live under the client's own root A");
    assert.ok(!localSnapshotPath.startsWith(brokerRoot), "the downloaded snapshot must never live under the broker's root B");
    assert.ok(existsSync(localSnapshotPath), "the downloaded snapshot must exist under A");
    assert.ok(readFileSync(localSnapshotPath).equals(snapshotPayload), "the downloaded snapshot's bytes must equal the fixture byte-for-byte");
    assert.ok(stagedPaths.dump!.startsWith(brokerRoot), "the staged DUMP file must live under the broker's own root B");
    // Right now -- before the load below stages a SECOND slot under the
    // SAME "snapshot" name -- the save's own staged file must still exist.
    const stagedDumpPath = stagedPaths.dump!;
    assert.ok(existsSync(stagedDumpPath), "the staged DUMP file must exist under B immediately after the save completes");

    // --- vice_snapshot_load --- (uploads the SAME local file save just
    // downloaded -- the pair proving each other, per XFER-05)
    const loadResult = await handleSnapshotLoad({ name: "disjoint_roots_1" }, session, fakeDeps);
    assert.equal(loadResult.isError, false, `vice_snapshot_load must succeed: ${JSON.stringify(loadResult)}`);
    const loadPayload = JSON.parse(loadResult.content[0]!.text) as Record<string, unknown>;
    assertNoPrefixLeak(loadPayload, brokerRoot, "vice_snapshot_load result");
    assert.ok(stagedPaths.undump!.startsWith(brokerRoot), "the staged UNDUMP file must live under the broker's own root B");

    // D-05: a staged upload is keyed by (grant, slot) and SUPERSEDED on
    // reuse. Save and load share the SAME "snapshot" slot name (by design
    // -- see SNAPSHOT_STAGE_SLOT's own doc comment in stock-machine.ts), so
    // the load's own stage_file call mints a NEW handle/path and deletes
    // the save's now-superseded one. This is the phase's own decision,
    // proven here rather than assumed.
    assert.ok(!existsSync(stagedDumpPath), "D-05: staging the same slot for the load must supersede and delete the save's own staged file");
    assert.notEqual(stagedPaths.undump, stagedDumpPath, "the load's own staged path must be a NEWLY minted handle, not a reuse of the save's");

    // The three tools whose slots were never reused in this session
    // (autostart, disk_attach, and the load's own CURRENT "snapshot"
    // staged file) still exist under B while the session remains open.
    for (const name of ["autostart", "diskAttach", "undump"] as const) {
      const path = stagedPaths[name]!;
      assert.ok(existsSync(path), `the staged file for ${name} must still exist under B while the session is open`);
      assert.ok(!path.startsWith(clientRoot), `the staged file for ${name} must never live under A`);
    }

    assert.equal(sends.length, 4, "exactly four wire sends: one AUTOSTART for vice_autostart, one AUTOSTART for vice_disk_attach, one DUMP, one UNDUMP");

    // After the session's connection closes, B's ENTIRE staging directory
    // for this grant must be gone -- D-06/XFER-07, now proven across all
    // four tools sharing one session, not merely one tool in isolation.
    const sessionStagingDir = join(brokerRoot, "staging", grantId);
    assert.ok(existsSync(sessionStagingDir), "the session's staging directory must exist once any slot has been staged");
    control.close();
    const gone = await waitForDisjoint(() => !existsSync(sessionStagingDir), 2000);
    assert.ok(gone, "the session's entire staging directory must be removed once its connection closes");
    for (const path of Object.values(stagedPaths)) {
      assert.ok(!existsSync(path!), "every staged file must be gone once the session's connection closes");
    }
  } finally {
    listener.server.close();
    resetStagingForTest();
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
    if (prevBrokerHome === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = prevBrokerHome;
    rmSync(clientRoot, { recursive: true, force: true });
    rmSync(brokerRoot, { recursive: true, force: true });
  }
});
