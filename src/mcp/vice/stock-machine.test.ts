// node:test coverage of stock-machine.ts -- Family D's machine-control
// handlers. Every session is a DI stub: `session.client` is an EventEmitter
// (so runStateFor()'s tracker attach point works, though no events are
// fired -- runState stays "unknown", which every test just asserts is
// present) with a `send` spy recording [commandType, body] and a
// caller-supplied canned response per call. isInsideContainer() is stubbed
// false via stock-paths.ts's setIsInsideContainerForTest() so no real mount
// lookup happens -- these tests never touch a real filesystem bind mount.
//
// Phase 64 (XFER-01/XFER-02): the snapshot-pair tests below inject a
// recording `stageFile` and a recording `transferFile` through
// `StockConnectBrokerControl`/`StockConnectDeps` -- the two seams plan 64-02
// added -- so every handler test still runs without a socket. The single
// exception is the round-trip test at the bottom of this file, which
// deliberately drives a REAL control listener and REAL staged files (mirrors
// vice-broker-staging.test.ts's own fixture) to prove the pair round-trips a
// definitively-non-UTF-8 payload byte for byte across two roots that cannot
// see each other.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { connect as netConnect, type Socket } from "node:net";
import { Writable } from "node:stream";
import { pipeline } from "node:stream/promises";
import {
  mkdtempSync,
  existsSync,
  rmSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  createReadStream,
  createWriteStream,
  renameSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

import {
  handleMachineReset,
  handleAutostart,
  handleDiskAttach,
  handleSnapshotSave,
  handleSnapshotLoad,
  DISK_ATTACH_APPROXIMATION,
} from "./stock-machine.ts";
import { CommandType } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import { setIsInsideContainerForTest } from "./stock-paths.ts";
import type { StockConnectSession, TransferFileFn, TransferFileRequest, TransferFileResult } from "./stock-connect.ts";
import type { ViceMonitorClient } from "./stock-protocol.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import { dialFileTransfer } from "./broker-endpoint.ts";
import { createHashAndCountTransform, verifyObserved, TRANSFER_MAX_BYTES } from "./transfer-hash.mts";
import { build } from "./build.ts";
import { startControlListener, newControlToken } from "./broker-control.mts";
import type {
  StartControlListenerResult,
  AcquireOutcome,
  RecycleOutcome,
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

// vice-broker.mts/broker-transfer.mts are host-bound (.mts, compiled into
// resources/) -- like vice-broker-staging.test.ts's own load, this file
// builds FIRST and imports the COMPILED resources/*.mjs, never the unbuilt
// source directly.
const HERE_MODULE_URL = import.meta.url;
build();

const brokerTransferModule = (await import(new URL("./resources/broker-transfer.mjs", HERE_MODULE_URL).href)) as unknown as {
  resetStagingForTest: () => void;
};
const { resetStagingForTest } = brokerTransferModule;

const viceBrokerModule = (await import(new URL("./resources/vice-broker.mjs", HERE_MODULE_URL).href)) as unknown as {
  handleRelease: (requestId: string, state: BrokerState) => void;
  handleStageFile: (grantId: string, slot: string, state: BrokerState) => BrokerStageFileOutcome;
  handleFileTransfer: (request: FileTransferRequest, socket: Socket, pending: Buffer, state: BrokerState) => FileTransferOutcome;
};
const { handleRelease, handleStageFile, handleFileTransfer } = viceBrokerModule;

interface RecordedSend {
  commandType: number;
  body: Buffer;
}

/** Builds a fake session whose `client.send()` is a spy: records every call
 * as [commandType, body] and resolves per `responder(commandType, body)` --
 * `undefined` from the responder resolves to `undefined` (fine for RESET/
 * EXIT/AUTOSTART, whose replies this module never reads). Throwing from
 * `responder` rejects the send() call, exercising the error-conversion path. */
function makeSession(responder?: (commandType: number, body: Buffer) => unknown): { session: StockConnectSession; sends: RecordedSend[] } {
  const sends: RecordedSend[] = [];
  const emitter = new EventEmitter();
  (emitter as unknown as { send: unknown }).send = async (commandType: number, body: Buffer = Buffer.alloc(0)) => {
    sends.push({ commandType, body });
    return responder ? responder(commandType, body) : undefined;
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

// Phase 64 (XFER-01/XFER-02): the two seams plan 64-02 added --
// session.brokerControl.stageFile and session.deps.transferFile -- as
// recording stubs, so a snapshot-handler test never opens a socket.

interface RecordedStageCall {
  targetId: string;
  slot: string;
}

type RecordedTransferCall = { direction: "upload"; handle: string; sourcePath: string } | { direction: "download"; handle: string; destPath: string };

/** The default stub `stageFile()` outcome every `makeSnapshotSession()` call
 * uses unless overridden: a successful stage minting a fixed handle and a
 * broker-chosen "emulator filename" that looks nothing like the local
 * snapshots directory -- so a test asserting "no result key names the
 * staged path" has something meaningfully different to assert against. */
const STAGE_HANDLE = "deadbeefcafef00d";
const STAGE_DIR = "/staged/session-dir";
const STAGE_EMULATOR_FILENAME = `${STAGE_DIR}/deadbeefcafef00d.bin`;

/** Builds a session for the snapshot-handler tests: makeSession()'s own
 * send-recording client, plus a recording `stageFile` and a recording
 * `transferFile` injected through StockConnectBrokerControl/StockConnectDeps
 * -- the two seams Phase 64 added. `stageOutcome` defaults to a successful
 * stage minting STAGE_HANDLE/STAGE_EMULATOR_FILENAME; `transferImpl`
 * defaults to a successful transfer that never touches the filesystem --
 * a test whose own assertions need a REAL file to appear (or be read) at
 * the local snapshot path supplies its own `transferImpl` instead. */
function makeSnapshotSession(opts?: {
  responder?: (commandType: number, body: Buffer) => unknown;
  stageOutcome?: { ok: true; handle: string; emulatorFilename: string } | { ok: false; reason: string };
  transferImpl?: (request: TransferFileRequest) => Promise<TransferFileResult>;
}): {
  session: StockConnectSession;
  sends: RecordedSend[];
  stageCalls: RecordedStageCall[];
  transferCalls: RecordedTransferCall[];
} {
  const { session, sends } = makeSession(opts?.responder);
  const stageCalls: RecordedStageCall[] = [];
  const transferCalls: RecordedTransferCall[] = [];

  const stageOutcome = opts?.stageOutcome ?? { ok: true as const, handle: STAGE_HANDLE, emulatorFilename: STAGE_EMULATOR_FILENAME };
  const transferImpl = opts?.transferImpl ?? (async (): Promise<TransferFileResult> => ({ ok: true, byteLength: 0, sha256: "" }));

  session.brokerControl = {
    ...session.brokerControl,
    stageFile: async (stageOpts) => {
      stageCalls.push({ targetId: stageOpts.targetId, slot: stageOpts.slot });
      return stageOutcome;
    },
  } as StockConnectSession["brokerControl"];

  session.deps = {
    ...session.deps,
    transferFile: async (request: TransferFileRequest): Promise<TransferFileResult> => {
      transferCalls.push(
        request.direction === "upload"
          ? { direction: "upload", handle: request.handle, sourcePath: request.sourcePath }
          : { direction: "download", handle: request.handle, destPath: request.destPath },
      );
      return transferImpl(request);
    },
  };

  return { session, sends, stageCalls, transferCalls };
}

const fakeDeps = {} as StockDispatchDeps;

beforeEach(() => {
  resetRunStateTrackersForTest();
  setIsInsideContainerForTest(() => false);
});

afterEach(() => {
  setIsInsideContainerForTest(null);
});

// --------------------------------------------------------- handleMachineReset

test("handleMachineReset: mode omitted -> Reset body is exactly [0x00] (soft), one send, no Exit", async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({}, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.Reset);
  assert.deepEqual(sends[0]!.body, Buffer.from([0x00]));
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.mode, "soft");
  assert.equal(payload.runAfter, false);
  assert.equal(payload.resumed, false);
  assert.equal(payload.runState, "unknown");
});

test('handleMachineReset: mode "hard" -> Reset body is exactly [0x01]', async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ mode: "hard" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.deepEqual(sends[0]!.body, Buffer.from([0x01]));
});

test('handleMachineReset: mode "power" refuses with zero sends', async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ mode: "power" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleMachineReset: run_after omitted -> exactly one send, no CommandType.Exit", async () => {
  const { session, sends } = makeSession();
  await handleMachineReset({}, session, fakeDeps);
  assert.equal(sends.length, 1);
  assert.ok(sends.every((s) => s.commandType !== CommandType.Exit));
});

test("handleMachineReset: run_after: true -> two sends, second is CommandType.Exit with a zero-length body, resumed true", async () => {
  const { session, sends } = makeSession();
  const result = await handleMachineReset({ run_after: true }, session, fakeDeps);
  assert.equal(sends.length, 2);
  assert.equal(sends[0]!.commandType, CommandType.Reset);
  assert.equal(sends[1]!.commandType, CommandType.Exit);
  assert.equal(sends[1]!.body.length, 0);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.resumed, true);
  assert.equal(payload.runAfter, true);
});

// --------------------------------------------------------- handleAutostart

test('handleAutostart: program: "GAME" refuses with a message containing "index", zero sends', async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({ path: "/workspace/game.d64", program: "GAME" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /index/);
  assert.equal(sends.length, 0);
});

test("handleAutostart: records an AutoStart body with default run/index, and the sent path in the ASCII tail", async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({ path: "/workspace/game.prg" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.AutoStart);
  const body = sends[0]!.body;
  assert.equal(body[0], 0x01); // default run = true
  assert.equal(body.readUInt16LE(1), 0); // default index = 0
  const filenameLen = body[3]!;
  const filename = body.subarray(4, 4 + filenameLen).toString("ascii");
  assert.equal(filename, "/workspace/game.prg");
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.sentPath, "/workspace/game.prg");
  assert.equal(payload.run, true);
  assert.equal(payload.index, 0);
});

test("handleAutostart: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({}, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

// --------------------------------------------------------- handleDiskAttach

test("handleDiskAttach: unit: 9 refuses with a message containing 'no drive-unit field', zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 9, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /no drive-unit field/);
  assert.equal(sends.length, 0);
});

test("handleDiskAttach: unit: 12 refuses naming the 8..11 range", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 12, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /8\.\.11/);
  assert.equal(sends.length, 0);
});

test("handleDiskAttach: unit: 8 records an AutoStart body whose byte 0 is 0x00 (run flag clear)", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 8, path: "/workspace/disk.d64" }, session, fakeDeps);
  assert.equal(result.isError, false);
  assert.equal(sends.length, 1);
  assert.equal(sends[0]!.commandType, CommandType.AutoStart);
  assert.equal(sends[0]!.body[0], 0x00);
  const payload = JSON.parse(result.content[0]!.text);
  assert.equal(payload.unit, 8);
  assert.equal(payload.approximation, DISK_ATTACH_APPROXIMATION);
});

test("handleDiskAttach: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 8 }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

// --------------------------------------------------------- runState on every ok answer

test("every ok-answer from this module carries runState", async () => {
  const { session: s1 } = makeSession();
  const r1 = await handleMachineReset({}, s1, fakeDeps);
  assert.ok("runState" in JSON.parse(r1.content[0]!.text));

  const { session: s2 } = makeSession();
  const r2 = await handleAutostart({ path: "/workspace/x.prg" }, s2, fakeDeps);
  assert.ok("runState" in JSON.parse(r2.content[0]!.text));

  const { session: s3 } = makeSession();
  const r3 = await handleDiskAttach({ unit: 8, path: "/workspace/x.d64" }, s3, fakeDeps);
  assert.ok("runState" in JSON.parse(r3.content[0]!.text));
});

// --------------------------------------------------------- handleSnapshotSave / handleSnapshotLoad
//
// A temp directory stands in for the repo root (following
// repo-root.test.ts's own temp-dir discipline) so no real workspace
// is ever touched: CLAUDE_PROJECT_DIR unconditionally wins repoRoot()'s
// precedence ladder (branch 0), so pointing it at a fresh mkdtempSync()
// directory per test makes snapshotPathFor()/snapshotMetaPathFor() resolve
// entirely inside that throwaway directory.
//
// Phase 64 (XFER-01/XFER-02, D-15): the DUMP/UNDUMP request body's filename
// is now the broker-CHOSEN `STAGE_EMULATOR_FILENAME` (via the recording
// `stageFile()` makeSnapshotSession() injects), never a path built from the
// client's own snapshots directory -- so a test that used to assert the
// sent filename ends in ".../snapshots/<name>.vsf" now asserts it equals
// the stub's own emulator filename instead.

async function withTempRepoRoot<T>(fn: (repoRootDir: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "vice-snapshot-test-"));
  const prev = process.env.CLAUDE_PROJECT_DIR;
  process.env.CLAUDE_PROJECT_DIR = dir;
  try {
    return await fn(dir);
  } finally {
    if (prev === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Asserts that no string value anywhere in `payload` (a parsed tool result)
 * equals or contains the staged path or its containing staging directory --
 * T-64-19/D-15's own "never a broker-side path in a tool result" guarantee. */
function assertNoStagedPathLeak(payload: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") continue;
    assert.ok(!value.includes(STAGE_DIR), `result key "${key}" must not contain the staging directory (${STAGE_DIR}), got ${JSON.stringify(value)}`);
    assert.notEqual(value, STAGE_EMULATOR_FILENAME, `result key "${key}" must not equal the staged path`);
  }
}

test("handleSnapshotSave: name '../etc/passwd' refuses with zero sends", async () => {
  await withTempRepoRoot(async () => {
    const { session, sends } = makeSession();
    const result = await handleSnapshotSave({ name: "../etc/passwd" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.equal(sends.length, 0);
  });
});

test("handleSnapshotSave: records a Dump body whose filename equals the staging reply's emulator filename, and the result carries that handle -- never the staged path", async () => {
  await withTempRepoRoot(async () => {
    const { session, sends } = makeSnapshotSession();
    const result = await handleSnapshotSave({ name: "ok_1" }, session, fakeDeps);
    assert.equal(result.isError, false, `save must succeed: ${JSON.stringify(result)}`);
    assert.equal(sends.length, 1);
    assert.equal(sends[0]!.commandType, CommandType.Dump);
    const body = sends[0]!.body;
    assert.equal(body[0], 0x00);
    assert.equal(body[1], 0x00);
    const filenameLen = body[2]!;
    const filename = body.subarray(3, 3 + filenameLen).toString("ascii");
    assert.equal(filename, STAGE_EMULATOR_FILENAME);

    const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    assert.equal(payload.handle, STAGE_HANDLE);
    assert.ok(!("sentPath" in payload), "sentPath must be replaced by handle, not merely joined by it (D-15)");
    assertNoStagedPathLeak(payload);
  });
});

test("handleSnapshotSave: include_roms/include_disks true records bytes 0x01/0x01", async () => {
  await withTempRepoRoot(async () => {
    const { session, sends } = makeSnapshotSession();
    const result = await handleSnapshotSave({ name: "ok_2", include_roms: true, include_disks: true }, session, fakeDeps);
    assert.equal(result.isError, false);
    assert.equal(sends[0]!.body[0], 0x01);
    assert.equal(sends[0]!.body[1], 0x01);
  });
});

test("handleSnapshotSave: a successful save writes a sidecar containing name, createdAt, backend: 'stock'", async () => {
  await withTempRepoRoot(async (dir) => {
    const { session } = makeSnapshotSession();
    const result = await handleSnapshotSave({ name: "ok_3", description: "a test snapshot" }, session, fakeDeps);
    assert.equal(result.isError, false);
    const metaPath = join(dir, ".c64-re-tools", "snapshots", "ok_3.json");
    assert.ok(existsSync(metaPath));
    const meta = JSON.parse(readFileSync(metaPath, "utf8"));
    assert.equal(meta.name, "ok_3");
    assert.equal(meta.backend, "stock");
    assert.equal(typeof meta.createdAt, "string");
    const payload = JSON.parse(result.content[0]!.text);
    assert.equal(payload.metadataWritten, true);
  });
});

test("handleSnapshotSave: a failing DUMP writes no sidecar and dials no transfer connection", async () => {
  await withTempRepoRoot(async (dir) => {
    const { session, transferCalls } = makeSnapshotSession({
      responder: () => {
        throw new Error("dump failed");
      },
    });
    const result = await handleSnapshotSave({ name: "ok_4" }, session, fakeDeps);
    assert.equal(result.isError, true);
    const metaPath = join(dir, ".c64-re-tools", "snapshots", "ok_4.json");
    assert.equal(existsSync(metaPath), false);
    assert.equal(transferCalls.length, 0);
  });
});

test("handleSnapshotSave: a sidecar write failure still answers ok with metadataWritten: false and a reason", async () => {
  await withTempRepoRoot(async (dir) => {
    // Pre-create the exact sidecar path AS A DIRECTORY -- writeFileSync then
    // fails deterministically (EISDIR) regardless of uid/permissions, unlike
    // a chmod-based approach which is a no-op when tests run as root.
    const metaPath = join(dir, ".c64-re-tools", "snapshots", "ok_5.json");
    mkdirSync(metaPath, { recursive: true });
    const { session } = makeSnapshotSession();
    const result = await handleSnapshotSave({ name: "ok_5" }, session, fakeDeps);
    assert.equal(result.isError, false);
    const payload = JSON.parse(result.content[0]!.text);
    assert.equal(payload.metadataWritten, false);
    assert.equal(typeof payload.metadataFailureReason, "string");
  });
});

test("handleSnapshotSave: a refused staging request produces an error result and zero sends", async () => {
  await withTempRepoRoot(async () => {
    const { session, sends } = makeSnapshotSession({ stageOutcome: { ok: false, reason: "denied" } });
    const result = await handleSnapshotSave({ name: "ok_10" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /denied/);
    assert.equal(sends.length, 0);
  });
});

test("handleSnapshotSave: a failed download produces an error result, leaves no file at the snapshot path, an empty snapshots directory, and no sidecar", async () => {
  await withTempRepoRoot(async (dir) => {
    const { session, sends } = makeSnapshotSession({
      transferImpl: async () => ({ ok: false, reason: "digest mismatch" }),
    });
    const result = await handleSnapshotSave({ name: "ok_11" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.equal(sends.length, 1); // DUMP was sent before the failed download
    const snapshotsDir = join(dir, ".c64-re-tools", "snapshots");
    const localPath = join(snapshotsDir, "ok_11.vsf");
    assert.equal(existsSync(localPath), false);
    assert.deepEqual(readdirSync(snapshotsDir), []);
    const metaPath = join(snapshotsDir, "ok_11.json");
    assert.equal(existsSync(metaPath), false);
  });
});

test("handleSnapshotLoad: a missing file refuses with a message listing the .vsf names present, records zero sends and never stages or transfers", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "other.vsf"), "");
    const { session, sends, stageCalls, transferCalls } = makeSnapshotSession();
    const result = await handleSnapshotLoad({ name: "missing" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /other\.vsf/);
    assert.equal(sends.length, 0);
    assert.equal(stageCalls.length, 0);
    assert.equal(transferCalls.length, 0);
  });
});

test("handleSnapshotLoad: a successful load records an Undump body whose filename equals the staging reply's emulator filename, uploads the local file, and reports programCounter -- never the staged path in the result", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    const localVsfPath = join(dir, ".c64-re-tools", "snapshots", "ok_6.vsf");
    writeFileSync(localVsfPath, "");
    const { session, sends, transferCalls } = makeSnapshotSession({
      responder: (commandType) =>
        commandType === CommandType.Undump ? { type: "undump", requestId: 1, errorCode: 0, programCounter: 0x0801 } : undefined,
    });
    const result = await handleSnapshotLoad({ name: "ok_6" }, session, fakeDeps);
    assert.equal(result.isError, false, `load must succeed: ${JSON.stringify(result)}`);
    assert.equal(sends.length, 1);
    assert.equal(sends[0]!.commandType, CommandType.Undump);
    const body = sends[0]!.body;
    const filenameLen = body[0]!;
    assert.equal(filenameLen, body.length - 1);
    const filename = body.subarray(1, 1 + filenameLen).toString("ascii");
    assert.equal(filename, STAGE_EMULATOR_FILENAME);

    assert.equal(transferCalls.length, 1);
    assert.equal(transferCalls[0]!.direction, "upload");
    assert.equal((transferCalls[0] as { sourcePath: string }).sourcePath, localVsfPath);

    const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    assert.equal(payload.programCounter, 0x0801);
    assert.equal(payload.handle, STAGE_HANDLE);
    assertNoStagedPathLeak(payload);
  });
});

test("handleSnapshotLoad: a load whose sidecar is absent answers with metadata: null rather than erroring", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "ok_7.vsf"), "");
    const { session } = makeSnapshotSession({
      responder: () => ({ type: "undump", requestId: 1, errorCode: 0, programCounter: 0 }),
    });
    const result = await handleSnapshotLoad({ name: "ok_7" }, session, fakeDeps);
    assert.equal(result.isError, false);
    const payload = JSON.parse(result.content[0]!.text);
    assert.equal(payload.metadata, null);
  });
});

test("handleSnapshotLoad: a refused staging request produces an error result and sends no UNDUMP", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "ok_13.vsf"), "");
    const { session, sends } = makeSnapshotSession({ stageOutcome: { ok: false, reason: "denied" } });
    const result = await handleSnapshotLoad({ name: "ok_13" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.equal(sends.length, 0);
  });
});

test("handleSnapshotLoad: a refused upload produces an error result and sends no UNDUMP", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "ok_12.vsf"), "");
    const { session, sends } = makeSnapshotSession({
      transferImpl: async () => ({ ok: false, reason: "digest mismatch" }),
    });
    const result = await handleSnapshotLoad({ name: "ok_12" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.equal(sends.length, 0);
  });
});

test("handleSnapshotSave/Load: every ok-answer carries runState", async () => {
  await withTempRepoRoot(async (dir) => {
    const { session: s1 } = makeSnapshotSession();
    const r1 = await handleSnapshotSave({ name: "ok_8" }, s1, fakeDeps);
    assert.ok("runState" in JSON.parse(r1.content[0]!.text));

    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "ok_9.vsf"), "");
    const { session: s2 } = makeSnapshotSession({
      responder: () => ({ type: "undump", requestId: 1, errorCode: 0, programCounter: 0 }),
    });
    const r2 = await handleSnapshotLoad({ name: "ok_9" }, s2, fakeDeps);
    assert.ok("runState" in JSON.parse(r2.content[0]!.text));
  });
});
