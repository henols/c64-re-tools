// node:test coverage of stock-machine.ts -- Family D's machine-control
// handlers. Every session is a DI stub: `session.client` is an EventEmitter
// (so runStateFor()'s tracker attach point works, though no events are
// fired -- runState stays "unknown", which every test just asserts is
// present) with a `send` spy recording [commandType, body] and a
// caller-supplied canned response per call.
//
// Phase 64 (XFER-01/XFER-02/XFER-08): every handler in this file (the
// snapshot pair, then `vice_autostart`/`vice_disk_attach` in plan 64-06)
// injects a recording `stageFile` and a recording `transferFile` through
// `StockConnectBrokerControl`/`StockConnectDeps` -- the two seams plan 64-02
// added -- so every handler test still runs without a socket. No handler
// under test reaches the host/container translation seam any more (D-18:
// this file no longer imports stock-paths.ts at all), so this file's own
// former `setIsInsideContainerForTest()` stub is gone too -- stubbing a
// function the module under test no longer calls would itself be a defect.
// The single exception to "no socket" is the round-trip test at the bottom
// of this file, which deliberately drives a REAL control listener and REAL
// staged files (mirrors vice-broker-staging.test.ts's own fixture) to prove
// the snapshot pair round-trips a definitively-non-UTF-8 payload byte for
// byte across two roots that cannot see each other.
import { test, beforeEach } from "node:test";
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
  DISK_ATTACH_WRITE_LOSS,
  AUTOSTART_CMD_FAILURE_TEXT,
  UNDUMP_CMD_FAILURE_TEXT,
  DUMP_CMD_FAILURE_TEXT,
} from "./stock-machine.ts";
import { CommandType, ErrorCode, StockProtocolError } from "./stock-protocol.ts";
import { resetRunStateTrackersForTest } from "./stock-runstate.ts";
import type { StockConnectSession, TransferFileFn, TransferFileRequest, TransferFileResult } from "./stock-connect.ts";
import type { ViceMonitorClient } from "./stock-protocol.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";
import { dialFileTransfer, awaitTransferComplete } from "./broker-endpoint.ts";
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
  handleFileTransfer: (
    request: FileTransferRequest,
    socket: Socket,
    pending: Buffer,
    state: BrokerState,
    deps?: { beforePublish?: () => Promise<void> },
  ) => FileTransferOutcome;
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

// Phase 64 (XFER-02/XFER-08, plan 64-06): handleAutostart/handleDiskAttach's
// own recording session, mirroring makeSnapshotSession()'s shape above but
// keyed per-slot -- `handleAutostart` stages under `"autostart"` and
// `handleDiskAttach` stages under `"disk8"` (D-02's two-distinct-slots
// requirement), so a shared fixed-handle stub (like STAGE_HANDLE above)
// cannot tell the two apart. `stageOutcomeForSlot` defaults to a per-slot
// map covering both; a test whose own assertions need a different outcome
// (a refusal, a shared slot map) supplies its own.
const AUTOSTART_STAGE_HANDLE = "autostarthandle00112233";
const AUTOSTART_EMULATOR_FILENAME = `${STAGE_DIR}/${AUTOSTART_STAGE_HANDLE}.bin`;
const DISK_ATTACH_STAGE_HANDLE = "diskattachhandle44556677";
const DISK_ATTACH_EMULATOR_FILENAME = `${STAGE_DIR}/${DISK_ATTACH_STAGE_HANDLE}.bin`;

type StageOutcome = { ok: true; handle: string; emulatorFilename: string } | { ok: false; reason: string };

function defaultStageOutcomeForSlot(slot: string): StageOutcome {
  if (slot === "autostart") return { ok: true, handle: AUTOSTART_STAGE_HANDLE, emulatorFilename: AUTOSTART_EMULATOR_FILENAME };
  if (slot === "disk8") return { ok: true, handle: DISK_ATTACH_STAGE_HANDLE, emulatorFilename: DISK_ATTACH_EMULATOR_FILENAME };
  return { ok: false, reason: `makeMachineSession(): no default stage outcome registered for slot "${slot}"` };
}

function makeMachineSession(opts?: {
  responder?: (commandType: number, body: Buffer) => unknown;
  stageOutcomeForSlot?: (slot: string) => StageOutcome;
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

  const stageOutcomeForSlot = opts?.stageOutcomeForSlot ?? defaultStageOutcomeForSlot;
  const transferImpl = opts?.transferImpl ?? (async (): Promise<TransferFileResult> => ({ ok: true, byteLength: 0, sha256: "" }));

  session.brokerControl = {
    ...session.brokerControl,
    stageFile: async (stageOpts) => {
      stageCalls.push({ targetId: stageOpts.targetId, slot: stageOpts.slot });
      return stageOutcomeForSlot(stageOpts.slot);
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

/** Creates a fresh temp directory outside the project root (`os.tmpdir()`,
 * never a path under `process.cwd()`) containing one fixture file, runs
 * `fn` against its absolute path, and always cleans up. The load-bearing
 * case this exists for (D-14): a caller-supplied absolute path is accepted
 * and uploaded from ANYWHERE the client can read, never confined to the
 * workspace. */
async function withTempFixtureFile<T>(basename: string, fn: (fixturePath: string) => Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "vice-machine-fixture-"));
  assert.ok(!dir.startsWith(process.cwd()), "the fixture directory must live outside the project root (D-14's own load-bearing case)");
  const fixturePath = join(dir, basename);
  writeFileSync(fixturePath, "fixture bytes for stock-machine.test.ts -- unrestricted-path case (D-14)");
  try {
    return await fn(fixturePath);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** Generalises assertNoStagedPathLeak() above (which is fixed to the
 * snapshot pair's own STAGE_DIR/STAGE_EMULATOR_FILENAME constants) to any
 * forbidden directory substring plus a list of forbidden exact values --
 * handleAutostart/handleDiskAttach mint DIFFERENT emulator filenames than
 * the snapshot pair, so a single shared assertion needs to accept either. */
function assertNoLeak(payload: Record<string, unknown>, forbiddenDir: string, forbiddenExact: readonly string[]): void {
  for (const [key, value] of Object.entries(payload)) {
    if (typeof value !== "string") continue;
    assert.ok(!value.includes(forbiddenDir), `result key "${key}" must not contain the staging directory (${forbiddenDir}), got ${JSON.stringify(value)}`);
    for (const forbidden of forbiddenExact) {
      assert.notEqual(value, forbidden, `result key "${key}" must not equal the staged path (${forbidden})`);
    }
  }
}

const fakeDeps = {} as StockDispatchDeps;

beforeEach(() => {
  resetRunStateTrackersForTest();
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
//
// Phase 64 (XFER-02/XFER-08, plan 64-06): handleAutostart now stages a slot,
// uploads the caller's local file, and only then sends AUTOSTART with the
// broker-CHOSEN emulator filename -- never a path this client constructed.
// Every case below that reaches the upload step uses a REAL fixture file
// (withTempFixtureFile()) because handleAutostart genuinely checks local
// readability before staging (checkLocalFileReadable()) -- unlike the
// snapshot pair's DUMP direction, there is no wire reply to fake instead.

test('handleAutostart: program: "GAME" refuses with a message containing "index", zero sends', async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({ path: "/workspace/game.d64", program: "GAME" }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.match(result.content[0]!.text, /index/);
  assert.equal(sends.length, 0);
});

test("handleAutostart: records an AutoStart body whose filename equals the staging reply's emulator filename, stages under the 'autostart' slot, uploads the resolved local path, and the result carries the handle -- never sentPath", async () => {
  await withTempFixtureFile("game.prg", async (fixturePath) => {
    const { session, sends, stageCalls, transferCalls } = makeMachineSession();
    const result = await handleAutostart({ path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, false, `autostart must succeed: ${JSON.stringify(result)}`);

    assert.equal(stageCalls.length, 1);
    assert.equal(stageCalls[0]!.slot, "autostart");

    assert.equal(transferCalls.length, 1);
    assert.equal(transferCalls[0]!.direction, "upload");
    assert.equal((transferCalls[0] as { sourcePath: string }).sourcePath, fixturePath);

    assert.equal(sends.length, 1);
    assert.equal(sends[0]!.commandType, CommandType.AutoStart);
    const body = sends[0]!.body;
    assert.equal(body[0], 0x01); // default run = true
    assert.equal(body.readUInt16LE(1), 0); // default index = 0
    const filenameLen = body[3]!;
    const filename = body.subarray(4, 4 + filenameLen).toString("ascii");
    assert.equal(filename, AUTOSTART_EMULATOR_FILENAME);

    const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    assert.equal(payload.handle, AUTOSTART_STAGE_HANDLE);
    assert.ok(!("sentPath" in payload), "sentPath must be replaced by handle, not merely joined by it (D-15)");
    assert.equal(payload.run, true);
    assert.equal(payload.index, 0);
    assert.equal(payload.path, fixturePath);
    assertNoLeak(payload, STAGE_DIR, [AUTOSTART_EMULATOR_FILENAME]);
  });
});

test("handleAutostart: an absolute path outside the project root is accepted and uploaded, unrestricted (D-14)", async () => {
  await withTempFixtureFile("outside-workspace.prg", async (fixturePath) => {
    const { session, transferCalls } = makeMachineSession();
    const result = await handleAutostart({ path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, false, `autostart must succeed: ${JSON.stringify(result)}`);
    assert.equal(transferCalls.length, 1);
    assert.equal(
      (transferCalls[0] as { sourcePath: string }).sourcePath,
      fixturePath,
      "the upload's recorded source path must equal the caller's absolute path exactly -- confining it would be D-14's own regression",
    );
  });
});

test("handleAutostart: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleAutostart({}, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleAutostart: an unreadable (nonexistent) path refuses naming the path, with zero staging calls and zero sends", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-autostart-missing-"));
  try {
    const missingPath = join(dir, "does-not-exist.prg");
    const { session, sends, stageCalls } = makeMachineSession();
    const result = await handleAutostart({ path: missingPath }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]!.text.includes(missingPath), `error must name the path ${missingPath}: ${result.content[0]!.text}`);
    assert.equal(stageCalls.length, 0);
    assert.equal(sends.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("handleAutostart: a source file over the transfer cap is refused with the limit in decimal digits, zero sends", async () => {
  await withTempFixtureFile("big.prg", async (fixturePath) => {
    const { session, sends, stageCalls } = makeMachineSession({
      transferImpl: async () => ({ ok: false, reason: "transfer exceeds the 16777216 byte cap (sixteen mebibytes); source file is 20000000 bytes" }),
    });
    const result = await handleAutostart({ path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /16777216/);
    assert.equal(stageCalls.length, 1); // staging DID happen -- only the send is prevented
    assert.equal(sends.length, 0);
  });
});

test("handleAutostart: AUTOSTART answering 0x8f says the emulator could not open or load the file it was handed, from the exported constant (G-64-3, plan 64-13, Task 3)", async () => {
  await withTempFixtureFile("game.prg", async (fixturePath) => {
    const { session } = makeMachineSession({
      responder: (commandType) => {
        if (commandType === CommandType.AutoStart) {
          throw new StockProtocolError("binary monitor returned error code 0x8f for response type 0x00", {
            errorCode: ErrorCode.CmdFailure,
            responseType: 0x00,
            requestId: 1,
          });
        }
        return undefined;
      },
    });
    const result = await handleAutostart({ path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0]!.text.includes(AUTOSTART_CMD_FAILURE_TEXT),
      `expected the exported AUTOSTART_CMD_FAILURE_TEXT in: ${result.content[0]!.text}`,
    );
  });
});

// --------------------------------------------------------- handleDiskAttach
//
// Same migration shape as handleAutostart above, staged under the DIFFERENT
// "disk8" slot (D-02/T-64-29), and carrying the new D-16 write-loss constant
// alongside the existing approximation.

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

test("handleDiskAttach: units 9, 10 and 11 are refused with zero staging calls recorded", async () => {
  for (const unit of [9, 10, 11]) {
    const { session, sends, stageCalls } = makeMachineSession();
    const result = await handleDiskAttach({ unit, path: "/workspace/disk.d64" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.equal(stageCalls.length, 0, `unit ${unit} must record zero staging calls`);
    assert.equal(sends.length, 0);
  }
});

test("handleDiskAttach: unit: 8 records an AutoStart body whose byte 0 is 0x00 (run flag clear), stages under the 'disk8' slot, uploads the resolved local path, and carries the handle plus both the approximation and write-loss constants", async () => {
  await withTempFixtureFile("disk.d64", async (fixturePath) => {
    const { session, sends, stageCalls, transferCalls } = makeMachineSession();
    const result = await handleDiskAttach({ unit: 8, path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, false, `disk attach must succeed: ${JSON.stringify(result)}`);

    assert.equal(stageCalls.length, 1);
    assert.equal(stageCalls[0]!.slot, "disk8");

    assert.equal(transferCalls.length, 1);
    assert.equal(transferCalls[0]!.direction, "upload");
    assert.equal((transferCalls[0] as { sourcePath: string }).sourcePath, fixturePath);

    assert.equal(sends.length, 1);
    assert.equal(sends[0]!.commandType, CommandType.AutoStart);
    assert.equal(sends[0]!.body[0], 0x00);
    const filenameLen = sends[0]!.body[3]!;
    const filename = sends[0]!.body.subarray(4, 4 + filenameLen).toString("ascii");
    assert.equal(filename, DISK_ATTACH_EMULATOR_FILENAME);

    const payload = JSON.parse(result.content[0]!.text) as Record<string, unknown>;
    assert.equal(payload.unit, 8);
    assert.equal(payload.handle, DISK_ATTACH_STAGE_HANDLE);
    assert.ok(!("sentPath" in payload), "sentPath must be replaced by handle (D-15)");
    assert.equal(payload.approximation, DISK_ATTACH_APPROXIMATION);
    assert.equal(payload.writeLoss, DISK_ATTACH_WRITE_LOSS);
    assertNoLeak(payload, STAGE_DIR, [DISK_ATTACH_EMULATOR_FILENAME]);
  });
});

test("handleDiskAttach: refuses a missing path with zero sends", async () => {
  const { session, sends } = makeSession();
  const result = await handleDiskAttach({ unit: 8 }, session, fakeDeps);
  assert.equal(result.isError, true);
  assert.equal(sends.length, 0);
});

test("handleDiskAttach: an unreadable (nonexistent) path refuses naming the path, with zero staging calls and zero sends", async () => {
  const dir = mkdtempSync(join(tmpdir(), "vice-diskattach-missing-"));
  try {
    const missingPath = join(dir, "does-not-exist.d64");
    const { session, sends, stageCalls } = makeMachineSession();
    const result = await handleDiskAttach({ unit: 8, path: missingPath }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(result.content[0]!.text.includes(missingPath), `error must name the path ${missingPath}: ${result.content[0]!.text}`);
    assert.equal(stageCalls.length, 0);
    assert.equal(sends.length, 0);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("handleDiskAttach: AUTOSTART answering 0x8f says the emulator could not open or load the file it was handed, from the SAME exported constant handleAutostart uses (G-64-3, plan 64-13, Task 3)", async () => {
  await withTempFixtureFile("disk.d64", async (fixturePath) => {
    const { session } = makeMachineSession({
      responder: (commandType) => {
        if (commandType === CommandType.AutoStart) {
          throw new StockProtocolError("binary monitor returned error code 0x8f for response type 0x00", {
            errorCode: ErrorCode.CmdFailure,
            responseType: 0x00,
            requestId: 1,
          });
        }
        return undefined;
      },
    });
    const result = await handleDiskAttach({ unit: 8, path: fixturePath }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0]!.text.includes(AUTOSTART_CMD_FAILURE_TEXT),
      `expected the exported AUTOSTART_CMD_FAILURE_TEXT in: ${result.content[0]!.text}`,
    );
  });
});

test("handleAutostart then handleDiskAttach in one session: two distinct slots, two distinct handles, two distinct staged files (T-64-29)", async () => {
  await withTempFixtureFile("game.prg", async (autostartFixture) => {
    await withTempFixtureFile("disk.d64", async (diskFixture) => {
      const { session, stageCalls } = makeMachineSession();

      const autostartResult = await handleAutostart({ path: autostartFixture }, session, fakeDeps);
      assert.equal(autostartResult.isError, false, `autostart must succeed: ${JSON.stringify(autostartResult)}`);
      const diskResult = await handleDiskAttach({ unit: 8, path: diskFixture }, session, fakeDeps);
      assert.equal(diskResult.isError, false, `disk attach must succeed: ${JSON.stringify(diskResult)}`);

      assert.equal(stageCalls.length, 2);
      assert.equal(stageCalls[0]!.slot, "autostart");
      assert.equal(stageCalls[1]!.slot, "disk8");

      const autostartPayload = JSON.parse(autostartResult.content[0]!.text) as Record<string, unknown>;
      const diskPayload = JSON.parse(diskResult.content[0]!.text) as Record<string, unknown>;
      assert.notEqual(autostartPayload.handle, diskPayload.handle, "the two tools must mint two distinct handles, not share one");
      assert.equal(autostartPayload.handle, AUTOSTART_STAGE_HANDLE);
      assert.equal(diskPayload.handle, DISK_ATTACH_STAGE_HANDLE);
    });
  });
});

// --------------------------------------------------------- runState on every ok answer

test("every ok-answer from this module carries runState", async () => {
  const { session: s1 } = makeSession();
  const r1 = await handleMachineReset({}, s1, fakeDeps);
  assert.ok("runState" in JSON.parse(r1.content[0]!.text));

  await withTempFixtureFile("x.prg", async (fixturePath) => {
    const { session: s2 } = makeMachineSession();
    const r2 = await handleAutostart({ path: fixturePath }, s2, fakeDeps);
    assert.ok("runState" in JSON.parse(r2.content[0]!.text));
  });

  await withTempFixtureFile("x.d64", async (fixturePath) => {
    const { session: s3 } = makeMachineSession();
    const r3 = await handleDiskAttach({ unit: 8, path: fixturePath }, s3, fakeDeps);
    assert.ok("runState" in JSON.parse(r3.content[0]!.text));
  });
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

test("handleSnapshotSave: DUMP answering 0x8f says the emulator could not write the snapshot, from the exported constant (G-64-3, plan 64-13, Task 3)", async () => {
  await withTempRepoRoot(async () => {
    const { session } = makeSnapshotSession({
      responder: () => {
        throw new StockProtocolError("binary monitor returned error code 0x8f for response type 0x00", {
          errorCode: ErrorCode.CmdFailure,
          responseType: 0x00,
          requestId: 1,
        });
      },
    });
    const result = await handleSnapshotSave({ name: "cmdfailure_1" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0]!.text.includes(DUMP_CMD_FAILURE_TEXT),
      `expected the exported DUMP_CMD_FAILURE_TEXT in: ${result.content[0]!.text}`,
    );
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

test("handleSnapshotLoad: UNDUMP answering 0x8f says the emulator could not read the snapshot, from the exported constant (G-64-3, plan 64-13, Task 3)", async () => {
  await withTempRepoRoot(async (dir) => {
    mkdirSync(join(dir, ".c64-re-tools", "snapshots"), { recursive: true });
    writeFileSync(join(dir, ".c64-re-tools", "snapshots", "cmdfailure_2.vsf"), "");
    const { session } = makeSnapshotSession({
      responder: (commandType) => {
        if (commandType === CommandType.Undump) {
          throw new StockProtocolError("binary monitor returned error code 0x8f for response type 0x00", {
            errorCode: ErrorCode.CmdFailure,
            responseType: 0x00,
            requestId: 1,
          });
        }
        return undefined;
      },
    });
    const result = await handleSnapshotLoad({ name: "cmdfailure_2" }, session, fakeDeps);
    assert.equal(result.isError, true);
    assert.ok(
      result.content[0]!.text.includes(UNDUMP_CMD_FAILURE_TEXT),
      `expected the exported UNDUMP_CMD_FAILURE_TEXT in: ${result.content[0]!.text}`,
    );
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

// ---------------------------------------------------------------------------
// Task 3 (Phase 64-04): the pair proves each other -- a byte-for-byte round
// trip over disjoint client/broker roots, driven through a REAL control
// listener and REAL staged files (mirrors vice-broker-staging.test.ts's own
// fixture shape rather than re-deriving it), with the emulator itself still
// the DI stub: the `send` spy stands in for DUMP by writing the fixture
// bytes to the staged path the request body named, and stands in for UNDUMP
// by reading them back and asserting equality.
//
// D-17's own guarantee, recorded here VERBATIM rather than softened: this
// proves nothing LEAKED, NOT that nothing was ever OPENED -- a stray read of
// a broker path that happens to succeed would still pass this test. Two
// consequences follow, per the phase owner's own decision: the transfer
// modules (transfer-hash.mts/broker-transfer.mts/stock-connect.ts) do NOT
// need an injectable filesystem-root seam and one must not be added to them
// for this test's sake; and a source-scanning guard is not an available
// fallback here either, since this codebase's own locked no-asserting-on-
// text rule bans it, and moving such a check into CI does not escape that
// rule.
// ---------------------------------------------------------------------------

function makeGrantedRoundTripInstance(port: number, overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port,
    url: `http://127.0.0.1:${port}/mcp`,
    state: "granted",
    reason: "acquire",
    epochFile: "/tmp/stock-machine-roundtrip-epoch.json",
    supervisorDir: "/tmp/stock-machine-roundtrip",
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

function setupRoundTripBrokerState(emulatorPort: number, targetId: string): BrokerState {
  const state = createBrokerState();
  state.instances.set(emulatorPort, makeGrantedRoundTripInstance(emulatorPort));
  state.grants.set(targetId, { id: targetId, port: emulatorPort, grantedAt: Date.now(), pid: 4242, operation: null, sessionLabel: null });
  return state;
}

/** Starts a REAL control listener wired to the compiled artifacts' own
 * handleStageFile()/handleFileTransfer()/handleRelease() -- the same
 * production functions the real broker calls. Mirrors
 * vice-broker-staging.test.ts's own startStagingListenerForState() exactly.
 * `getDeps` is read AT CALL TIME (never captured once) so a test can arm or
 * rearm the `beforePublish` timing hook (G-64-3, plan 64-13) right before
 * its own upload starts, without needing a fresh listener per case. */
async function startRoundTripListener(
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
      grant: { port: emulatorPort, url: `http://127.0.0.1:${emulatorPort}/mcp`, epochFile: "/tmp/stock-machine-roundtrip-epoch.json", supervisorDir: "/tmp/stock-machine-roundtrip" },
    }),
    onRelease: (requestId: string) => handleRelease(requestId, state),
    onRecycle: async (): Promise<RecycleOutcome> => ({
      port: null,
      pid: null,
      viceBin: null,
      killStage: "no_signal",
      epochBefore: null,
      outcome: "grant_lookup_failed",
      reason: "not exercised by stock-machine.test.ts",
    }),
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
    onHostTool: async () => ({ ok: false, message: "not exercised by stock-machine.test.ts" }),
    onStageFile: (targetId: string, slot: string) => handleStageFile(targetId, slot, state),
    onFileTransfer: (request, socket, pending) => handleFileTransfer(request, socket, pending, state, getDeps()),
  });
  return { listener, token };
}

/** Byte-level newline search -- never a whole-buffer string decode, matching
 * vice-broker-staging.test.ts's own readLineFromSocket(). Control-plane
 * replies in THIS test never carry trailing payload bytes (stage_file and
 * acquire are pure JSON-line ops), so `pending` is always discarded here. */
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

function makeRoundTripControlClient(port: number): { sendAndRead: (obj: Record<string, unknown>) => Promise<Record<string, unknown>>; close: () => void } {
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

async function waitForRoundTrip(predicate: () => boolean, deadlineMs: number, pollMs = 15): Promise<boolean> {
  const deadline = Date.now() + deadlineMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((r) => setTimeout(r, pollMs));
  }
  return predicate();
}

/** A REAL StockConnectBrokerControl.stageFile(), sending `stage_file` over
 * the SAME control connection an `acquire` already ran on -- ownership
 * (`ownsTarget()`) is gated on that connection identity, broker-side. */
function makeRealStageFile(control: { sendAndRead: (obj: Record<string, unknown>) => Promise<Record<string, unknown>> }, token: string) {
  return async (opts: { targetId: string; slot: string }): Promise<{ ok: true; handle: string; emulatorFilename: string } | { ok: false; reason: string }> => {
    const reply = await control.sendAndRead({ op: "stage_file", target_id: opts.targetId, slot: opts.slot, token });
    if (reply.kind === "file_staged") {
      return { ok: true, handle: reply.handle as string, emulatorFilename: reply.emulator_filename as string };
    }
    return { ok: false, reason: typeof reply.code === "string" ? reply.code : "internal" };
  };
}

/** A REAL TransferFileFn dialling the round trip's own control listener via
 * dialFileTransfer() (broker-endpoint.ts) and streaming through the SAME
 * cap-and-digest Transform (transfer-hash.mts) the real production
 * defaultTransferFile() (stock-connect.ts) uses -- composed here from the
 * same exported public seams a real caller would use, since
 * defaultTransferFile() itself is not exported (see that function's own
 * header comment for why it must not become one: no injectable
 * filesystem-root seam is to be added to it). */
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

/** Every byte value 0x00..0xFF, repeated, spanning well over 64 KiB -- so a
 * UTF-8 replacement anywhere on the journey shows up as a byte difference
 * rather than passing by luck (per this task's own acceptance criteria). */
function fullByteRangeRoundTripPayload(): Buffer {
  const unit = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) unit[i] = i;
  return Buffer.concat(Array(300).fill(unit) as Buffer[]); // 76800 bytes > 65536
}

let nextRoundTripPort = 27600;
function nextRoundTripEmulatorPort(): number {
  nextRoundTripPort += 1;
  return nextRoundTripPort;
}

test("vice_snapshot_save/vice_snapshot_load round trip (publish lands late, G-64-3 plan 64-13): the same bytes make the whole journey across two roots that cannot see each other, and the staging directory is gone when the session is", async () => {
  const clientDir = mkdtempSync(join(tmpdir(), "vice-snapshot-roundtrip-client-"));
  const brokerHome = mkdtempSync(join(tmpdir(), "vice-snapshot-roundtrip-broker-"));
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const prevBrokerHome = process.env.VICE_BROKER_HOME;
  process.env.CLAUDE_PROJECT_DIR = clientDir;
  process.env.VICE_BROKER_HOME = brokerHome;
  resetStagingForTest();

  const emulatorPort = nextRoundTripEmulatorPort();
  const grantId = "req-64-04-roundtrip";
  const state = setupRoundTripBrokerState(emulatorPort, grantId);
  // G-64-3 (plan 64-13): a 300ms pre-publish hook holds the broker's own
  // rename back deterministically -- the UNDUMP stub below reads the staged
  // file SYNCHRONOUSLY, with no polling, proving transferFile() really does
  // not resolve until the broker has published the bytes.
  const beforePublish = () => new Promise<void>((resolve) => setTimeout(resolve, 300));
  const { listener, token } = await startRoundTripListener(state, emulatorPort, () => ({ beforePublish }));
  const control = makeRoundTripControlClient(listener.port);
  try {
    const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId, token });
    assert.equal(acquireReply.kind, "grant");

    const payload = fullByteRangeRoundTripPayload();

    // The DI stub emulator: DUMP writes the fixture bytes to the staged
    // path the request body named; UNDUMP reads them back and asserts
    // equality itself -- the round trip's own proof, not a second
    // assertion bolted on afterwards.
    const { session, sends } = makeSession((commandType, body) => {
      if (commandType === CommandType.Dump) {
        const filenameLen = body[2]!;
        const stagedPath = body.subarray(3, 3 + filenameLen).toString("ascii");
        mkdirSync(dirname(stagedPath), { recursive: true });
        writeFileSync(stagedPath, payload);
        return undefined;
      }
      if (commandType === CommandType.Undump) {
        const filenameLen = body[0]!;
        const stagedPath = body.subarray(1, 1 + filenameLen).toString("ascii");
        // G-64-3 (plan 64-13): transferFile() now resolves ok only after the
        // broker's own completion reply confirms the publish -- UNDUMP is
        // sent only after that, so the staged file is read SYNCHRONOUSLY the
        // instant this stub is asked to open it. No polling: a client that
        // named an unpublished file would fail this assertion every time.
        assert.ok(existsSync(stagedPath), "the staged file must already exist by the time UNDUMP names it -- no poll, no wait");
        const stagedBytes = readFileSync(stagedPath);
        assert.ok(stagedBytes.equals(payload), "the bytes UNDUMP is asked to load must equal the fixture bytes byte-for-byte");
        return { type: "undump", requestId: 1, errorCode: 0, programCounter: 0 };
      }
      return undefined;
    });
    session.targetId = grantId;
    session.brokerControl = { ...session.brokerControl, stageFile: makeRealStageFile(control, token) } as StockConnectSession["brokerControl"];
    session.deps = { ...session.deps, transferFile: makeRealTransferFile(listener.port) };

    const saveResult = await handleSnapshotSave({ name: "roundtrip_1" }, session, fakeDeps);
    assert.equal(saveResult.isError, false, `save must succeed: ${JSON.stringify(saveResult)}`);
    assert.equal(sends.length, 1);
    const savePayload = JSON.parse(saveResult.content[0]!.text) as Record<string, unknown>;
    const localPath = savePayload.path as string;
    assert.ok(localPath.startsWith(clientDir), "the client's own snapshot path must live under the client's own root");
    assert.ok(!localPath.startsWith(brokerHome), "the client's own snapshot path must never live under the broker's root");
    assert.ok(existsSync(localPath), "the downloaded snapshot must exist at the client's own local path");
    assert.ok(readFileSync(localPath).equals(payload), "the client's own downloaded file must equal the fixture bytes byte-for-byte");

    const loadResult = await handleSnapshotLoad({ name: "roundtrip_1" }, session, fakeDeps);
    assert.equal(loadResult.isError, false, `load must succeed: ${JSON.stringify(loadResult)}`);
    assert.equal(sends.length, 2);
    assert.equal(sends[1]!.commandType, CommandType.Undump);
    // The UNDUMP responder above already asserted the staged bytes equal
    // the fixture on the broker's own side -- this is the OTHER half:
    // nothing the client uploaded touched the broker's root by a path the
    // client itself constructed (it only ever names snapshotPathFor(name),
    // firmly under clientDir).
    const uploadedFromPath = savePayload.path as string;
    assert.ok(uploadedFromPath.startsWith(clientDir));

    // After the session's connection closes, the broker's own staging
    // directory for this grant must no longer exist (D-06/XFER-07).
    const sessionDir = join(brokerHome, "staging", grantId);
    assert.ok(existsSync(sessionDir), "the session directory must exist once a slot has been staged");
    control.close();
    const gone = await waitForRoundTrip(() => !existsSync(sessionDir), 2000);
    assert.ok(gone, "the session's staging directory must be removed once its connection closes");
  } finally {
    listener.server.close();
    resetStagingForTest();
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
    if (prevBrokerHome === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = prevBrokerHome;
    rmSync(clientDir, { recursive: true, force: true });
    rmSync(brokerHome, { recursive: true, force: true });
  }
});

test("vice_snapshot_load refusal (G-64-3, plan 64-13): a publish that fails before the rename refuses the load, sends no UNDUMP, and the result text names no path under the broker's own root", async () => {
  const clientDir = mkdtempSync(join(tmpdir(), "vice-snapshot-refusal-client-"));
  const brokerHome = mkdtempSync(join(tmpdir(), "vice-snapshot-refusal-broker-"));
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const prevBrokerHome = process.env.VICE_BROKER_HOME;
  process.env.CLAUDE_PROJECT_DIR = clientDir;
  process.env.VICE_BROKER_HOME = brokerHome;
  resetStagingForTest();

  const emulatorPort = nextRoundTripEmulatorPort();
  const grantId = "req-64-13-t2-refusal";
  const state = setupRoundTripBrokerState(emulatorPort, grantId);
  // Starts undefined -- the save's own DOWNLOAD is unaffected by this hook
  // (it only applies to an upload's own receivePayloadToFile() call).
  // Armed to a REJECTING hook only right before the load's own upload,
  // below, so the save can succeed first and produce a real local snapshot.
  let beforePublish: (() => Promise<void>) | undefined;
  const { listener, token } = await startRoundTripListener(state, emulatorPort, () => ({ beforePublish }));
  const control = makeRoundTripControlClient(listener.port);
  try {
    const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId, token });
    assert.equal(acquireReply.kind, "grant");

    const payload = fullByteRangeRoundTripPayload();
    const { session, sends } = makeSession((commandType, body) => {
      if (commandType === CommandType.Dump) {
        const filenameLen = body[2]!;
        const stagedPath = body.subarray(3, 3 + filenameLen).toString("ascii");
        mkdirSync(dirname(stagedPath), { recursive: true });
        writeFileSync(stagedPath, payload);
        return undefined;
      }
      if (commandType === CommandType.Undump) {
        // Must never be reached: a publish failure must refuse the load
        // BEFORE UNDUMP is ever sent (this test's own point).
        assert.fail("UNDUMP must not be sent when the upload's own publish failed");
      }
      return undefined;
    });
    session.targetId = grantId;
    session.brokerControl = { ...session.brokerControl, stageFile: makeRealStageFile(control, token) } as StockConnectSession["brokerControl"];
    session.deps = { ...session.deps, transferFile: makeRealTransferFile(listener.port) };

    const saveResult = await handleSnapshotSave({ name: "refusal_1" }, session, fakeDeps);
    assert.equal(saveResult.isError, false, `save must succeed: ${JSON.stringify(saveResult)}`);
    assert.equal(sends.length, 1);

    // G-64-5 (plan 64-15): a REAL fs error, never the synthetic,
    // already path-free rejection this test used to author itself -- the
    // synthetic message is exactly what CR-01 found the suite could not
    // catch (64-REVIEW.md).
    beforePublish = async () => {
      readFileSync(join(brokerHome, "staging", grantId, "no-such-file"));
    };

    const loadResult = await handleSnapshotLoad({ name: "refusal_1" }, session, fakeDeps);
    assert.equal(loadResult.isError, true, `a publish failure must refuse the load: ${JSON.stringify(loadResult)}`);
    assert.equal(sends.length, 1, "no UNDUMP may be sent after a publish failure");
    const resultText = loadResult.content[0]!.text;
    assert.ok(!resultText.includes(brokerHome), `the result text must name no path under the broker's own temp root: ${resultText}`);
    assert.match(resultText, /\(ENOENT\)/, `the result text must name the errno code: ${resultText}`);
  } finally {
    control.close();
    listener.server.close();
    resetStagingForTest();
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
    if (prevBrokerHome === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = prevBrokerHome;
    rmSync(clientDir, { recursive: true, force: true });
    rmSync(brokerHome, { recursive: true, force: true });
  }
});

test("vice_snapshot_load refusal on a real fs fault (CR-01, G-64-5): the staging directory vanishes before the rename, and neither the upload's wire reason nor the tool result names a broker-side path", async () => {
  const clientDir = mkdtempSync(join(tmpdir(), "vice-snapshot-realfault-client-"));
  const brokerHome = mkdtempSync(join(tmpdir(), "vice-snapshot-realfault-broker-"));
  const prevProjectDir = process.env.CLAUDE_PROJECT_DIR;
  const prevBrokerHome = process.env.VICE_BROKER_HOME;
  process.env.CLAUDE_PROJECT_DIR = clientDir;
  process.env.VICE_BROKER_HOME = brokerHome;
  resetStagingForTest();

  const emulatorPort = nextRoundTripEmulatorPort();
  const grantId = "req-64-15-t1-realfault";
  const state = setupRoundTripBrokerState(emulatorPort, grantId);
  // Starts undefined -- the save's own DOWNLOAD is unaffected by this hook.
  // Armed to a REAL-fault hook only right before the load's own upload,
  // below, so the save can succeed first and produce a real local snapshot.
  let beforePublish: (() => Promise<void>) | undefined;
  const { listener, token } = await startRoundTripListener(state, emulatorPort, () => ({ beforePublish }));
  const control = makeRoundTripControlClient(listener.port);
  try {
    const acquireReply = await control.sendAndRead({ op: "acquire", id: grantId, token });
    assert.equal(acquireReply.kind, "grant");

    const payload = fullByteRangeRoundTripPayload();
    const { session, sends } = makeSession((commandType, body) => {
      if (commandType === CommandType.Dump) {
        const filenameLen = body[2]!;
        const stagedPath = body.subarray(3, 3 + filenameLen).toString("ascii");
        mkdirSync(dirname(stagedPath), { recursive: true });
        writeFileSync(stagedPath, payload);
        return undefined;
      }
      if (commandType === CommandType.Undump) {
        // Must never be reached: a real rename fault must refuse the load
        // BEFORE UNDUMP is ever sent (this test's own point).
        assert.fail("UNDUMP must not be sent when the upload's own publish failed on a real fs fault");
      }
      return undefined;
    });
    session.targetId = grantId;
    session.brokerControl = { ...session.brokerControl, stageFile: makeRealStageFile(control, token) } as StockConnectSession["brokerControl"];
    // Wrap makeRealTransferFile() so this test can inspect the upload's own
    // result directly -- the recorded `reason` is the completion reply's
    // own message, i.e. the broker's wireReason, forwarded verbatim by
    // awaitTransferComplete()/defaultTransferFile() (mirrored here by
    // makeRealTransferFile()).
    let capturedUploadResult: TransferFileResult | undefined;
    const baseTransferFile = makeRealTransferFile(listener.port);
    const transferFile: TransferFileFn = async (request: TransferFileRequest): Promise<TransferFileResult> => {
      const result = await baseTransferFile(request);
      if (request.direction === "upload") capturedUploadResult = result;
      return result;
    };
    session.deps = { ...session.deps, transferFile };

    const saveResult = await handleSnapshotSave({ name: "realfault_1" }, session, fakeDeps);
    assert.equal(saveResult.isError, false, `save must succeed: ${JSON.stringify(saveResult)}`);
    assert.equal(sends.length, 1);

    // G-64-5 (plan 64-15): the staging directory vanishes AFTER the
    // digest/count verdict but BEFORE the rename -- the interleaving a
    // session-close sweep produces mid-upload. Resolves (never rejects):
    // it is the rename itself that must fail, with a REAL ENOENT, never a
    // synthetic rejection message the test authored.
    beforePublish = async () => {
      rmSync(join(brokerHome, "staging", grantId), { recursive: true, force: true });
    };

    const loadResult = await handleSnapshotLoad({ name: "realfault_1" }, session, fakeDeps);
    assert.equal(loadResult.isError, true, `a real rename fault must refuse the load: ${JSON.stringify(loadResult)}`);
    assert.equal(sends.length, 1, "no UNDUMP may be sent after a real rename failure");
    const resultText = loadResult.content[0]!.text;
    assert.ok(!resultText.includes(brokerHome), `the result text must name no path under the broker's own temp root: ${resultText}`);
    assert.match(resultText, /\(ENOENT\)/, `the result text must name the errno code: ${resultText}`);

    assert.ok(capturedUploadResult, "the upload's own result must have been captured");
    assert.equal(capturedUploadResult!.ok, false);
    if (!capturedUploadResult!.ok) {
      assert.ok(
        !capturedUploadResult!.reason.includes(brokerHome),
        `the upload's own reason must name no path under the broker's own temp root: ${capturedUploadResult!.reason}`,
      );
      assert.match(capturedUploadResult!.reason, /\(ENOENT\)/, `the upload's own reason must name the errno code: ${capturedUploadResult!.reason}`);
    }
  } finally {
    control.close();
    listener.server.close();
    resetStagingForTest();
    if (prevProjectDir === undefined) delete process.env.CLAUDE_PROJECT_DIR;
    else process.env.CLAUDE_PROJECT_DIR = prevProjectDir;
    if (prevBrokerHome === undefined) delete process.env.VICE_BROKER_HOME;
    else process.env.VICE_BROKER_HOME = prevBrokerHome;
    rmSync(clientDir, { recursive: true, force: true });
    rmSync(brokerHome, { recursive: true, force: true });
  }
});
