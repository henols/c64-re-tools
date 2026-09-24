// broker-transfer.test.mts
//
// Phase 64 (XFER-01/02/05): the end-to-end proof of the one path a file
// payload takes crossing a real loopback TCP socket -- header line, then
// exactly N raw bytes, hashed and counted as they move, published only
// after their digest and length verify. broker-transfer.mts is host-bound
// and VALUE-imports a sibling host-bound module ("./transfer-hash.mjs"), so
// -- like broker-relay.test.ts's own load of resources/vice-broker.mjs --
// this file builds FIRST and imports the COMPILED resources/broker-
// transfer.mjs, never the unbuilt ".mts" source directly (an unbuilt import
// would throw ERR_MODULE_NOT_FOUND on its first sibling resolve).
import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer, connect as netConnect, type AddressInfo, type Socket } from "node:net";
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";

import { build } from "./build.ts";
// transfer-hash.mts has no sibling ".mjs" import of its own, so it is safe
// to import directly, unbuilt -- see that file's own test for the same
// convention.
import { TRANSFER_MAX_BYTES } from "./transfer-hash.mts";

build();

interface StagedFileEntry {
  handle: string;
  path: string;
  grantId: string;
  slot: string;
  claimedAt: number;
}

const brokerTransferModule = (await import(new URL("./resources/broker-transfer.mjs", import.meta.url).href)) as unknown as {
  writeTransferHeader: (socket: Socket, header: { kind: string; byteLength: number; sha256: string }) => void;
  readTransferHeader: (
    chunk: Buffer,
    carry?: Buffer,
  ) => { header?: { kind: string; byteLength: number; sha256: string }; remainder: Buffer; overflow: boolean; error?: string };
  sendPayloadFromFile: (opts: { socket: Socket; sourcePath: string; capBytes?: number; kind?: string }) => Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>;
  receivePayloadToFile: (opts: {
    socket: Socket;
    destPath: string;
    header: { kind: string; byteLength: number; sha256: string };
    pending?: Buffer;
    capBytes?: number;
    beforePublish?: () => Promise<void>;
  }) => Promise<
    { ok: true; byteLength: number; sha256: string } | { ok: false; reason: string; code?: "bad_request" | "internal"; wireReason?: string }
  >;
  /** G-64-5 (plan 64-15, Task 1): the ONE builder of wire text for a caught
   * transfer fault -- see that function's own JSDoc in broker-transfer.mts. */
  formatPathFreeFault: (summary: string, fault: unknown) => string;
  MAX_TRANSFER_HEADER_LINE_BYTES: number;
  stageFileSlot: (opts: { grantId: string; slot: string; now?: () => number }) => { ok: true; handle: string; stagedPath: string } | { ok: false; reason: string };
  resolveStagedFile: (handle: string) => { ok: true; entry: StagedFileEntry } | { ok: false; reason: string };
  markTransferInFlight: (handle: string) => { ok: true } | { ok: false; reason: string };
  clearTransferInFlight: (handle: string) => void;
  clearStagingForSession: (grantId: string) => void;
  resetStagingForTest: () => void;
};
const {
  writeTransferHeader,
  readTransferHeader,
  sendPayloadFromFile,
  receivePayloadToFile,
  formatPathFreeFault,
  stageFileSlot,
  resolveStagedFile,
  markTransferInFlight,
  clearTransferInFlight,
  clearStagingForSession,
  resetStagingForTest,
} = brokerTransferModule;

/** Runs `fn` with `VICE_BROKER_HOME` pointed at a fresh `mkdtempSync`
 * directory -- never the real machine-level root -- restoring the previous
 * value (or deleting the key if it was unset) in a `finally`, and resetting
 * this module's own staging registry before and after so no test leaks
 * state into the next one. */
async function withStagingFixture<T>(fn: (home: string) => Promise<T> | T): Promise<T> {
  const home = mkdtempSync(join(tmpdir(), "broker-transfer-staging-"));
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

/** Every byte value 0x00..0xFF, repeated `times` times -- definitively not
 * valid UTF-8 (Pitfall 1/2 in this phase's own research: a lone 0x80-0xFF
 * byte collapses under UTF-8 replacement if anything on the path ever
 * decodes it). */
function fullByteRangeFixture(times: number): Buffer {
  const one = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) one[i] = i;
  return Buffer.concat(Array.from({ length: times }, () => one));
}

/** Reads a transfer header off the front of `socket`'s byte stream via a
 * temporary "data" listener, exactly the loop shape broker-control.mts's own
 * line reader uses for the pre-existing JSON-line ops -- removed the instant
 * the header is found, so nothing after it competes with the payload
 * pipeline's own consumption of the same socket. */
function readHeaderFromSocket(socket: Socket): Promise<{ header: { kind: string; byteLength: number; sha256: string }; pending: Buffer }> {
  return new Promise((resolve, reject) => {
    let carry: Buffer = Buffer.alloc(0);
    const onData = (chunk: Buffer): void => {
      const result = readTransferHeader(chunk, carry);
      if (result.overflow) {
        socket.removeListener("data", onData);
        reject(new Error("transfer header line overflow"));
        return;
      }
      if (result.error) {
        socket.removeListener("data", onData);
        reject(new Error(result.error));
        return;
      }
      if (result.header) {
        socket.removeListener("data", onData);
        resolve({ header: result.header, pending: result.remainder });
        return;
      }
      carry = result.remainder;
    };
    socket.on("data", onData);
    socket.once("error", reject);
  });
}

test("broker-transfer: a real multi-megabyte, non-UTF-8 file crosses a real loopback TCP socket byte-for-byte", async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-e2e-"));
  try {
    const sourcePath = join(fixtureDir, "source.bin");
    const destPath = join(fixtureDir, "dest", "received.bin");
    const sourceBytes = fullByteRangeFixture(12289); // 12289 * 256 = 3,146,  well over 3,145,728 (3 MiB)
    assert.ok(sourceBytes.length >= 3 * 1024 * 1024, "fixture must be at least 3 MiB");
    writeFileSync(sourcePath, sourceBytes);

    const server = createServer();
    const serverDone = new Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>((resolve, reject) => {
      server.on("connection", (socket) => {
        readHeaderFromSocket(socket)
          .then(({ header, pending }) => receivePayloadToFile({ socket, destPath, header, pending }))
          .then(resolve, reject);
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const assignedPort = (server.address() as AddressInfo).port;
    assert.ok(assignedPort > 0, "the listener must bind an ephemeral port and report it back, never a hardcoded literal");

    const clientSocket = netConnect({ host: "127.0.0.1", port: assignedPort });
    await new Promise<void>((resolve, reject) => {
      clientSocket.once("connect", resolve);
      clientSocket.once("error", reject);
    });

    const sendResult = await sendPayloadFromFile({ socket: clientSocket, sourcePath });
    assert.equal(sendResult.ok, true, sendResult.ok ? "" : (sendResult as { reason: string }).reason);

    const receiveResult = await serverDone;
    assert.equal(receiveResult.ok, true, receiveResult.ok ? "" : (receiveResult as { reason: string }).reason);
    if (sendResult.ok && receiveResult.ok) {
      assert.equal(receiveResult.byteLength, sendResult.byteLength);
      assert.equal(receiveResult.sha256, sendResult.sha256);
    }

    const receivedBytes = readFileSync(destPath);
    assert.ok(receivedBytes.equals(sourceBytes), "received file bytes must be strictly equal to the sent file bytes");

    server.close();
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("broker-transfer: writeTransferHeader + readTransferHeader round-trip a header line, with the remainder as raw payload bytes", () => {
  const written: Buffer[] = [];
  const fakeSocket = { write: (data: string | Buffer) => written.push(Buffer.isBuffer(data) ? data : Buffer.from(data)) } as unknown as Socket;
  writeTransferHeader(fakeSocket, { kind: "file", byteLength: 3, sha256: "deadbeef" });

  const payload = Buffer.from([0x00, 0x80, 0xff]);
  const combined = Buffer.concat([...written, payload]);
  const result = readTransferHeader(combined);
  assert.deepEqual(result.header, { kind: "file", byteLength: 3, sha256: "deadbeef" });
  assert.ok(result.remainder.equals(payload));
  assert.equal(result.overflow, false);
  assert.equal(result.error, undefined);
});

test("broker-transfer: readTransferHeader refuses a malformed JSON line by name, never throwing", () => {
  const result = readTransferHeader(Buffer.from("not json at all\n"));
  assert.equal(result.header, undefined);
  assert.match(result.error ?? "", /not valid JSON/);
});

test("broker-transfer: readTransferHeader accumulates carry across chunks split mid-line", () => {
  const line = JSON.stringify({ kind: "file", byteLength: 0, sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855" }) + "\n";
  const buf = Buffer.from(line);
  const first = buf.subarray(0, 5);
  const second = buf.subarray(5);

  const partial = readTransferHeader(first);
  assert.equal(partial.header, undefined);
  assert.equal(partial.overflow, false);

  const complete = readTransferHeader(second, partial.remainder);
  assert.ok(complete.header);
});

test("broker-transfer: every fixture directory is created with mkdtempSync and this test cleans it up (no untracked scratch dirs)", () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-transfer-cleanup-check-"));
  assert.ok(existsSync(dir));
  rmSync(dir, { recursive: true, force: true });
  assert.equal(existsSync(dir), false);
});

test("broker-transfer: readdirSync is a real directory listing, never a name-guess, for asserting no leftover temp file", () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-transfer-listing-check-"));
  try {
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Task 2 (D-11, TDD): the cap at both ends, the mid-stream abort, and the
// proof that backpressure is real -- not a false green from a sender that
// already buffered everything (Pitfall 3, 64-RESEARCH.md).
// ---------------------------------------------------------------------------

test("sendPayloadFromFile: a source of exactly TRANSFER_MAX_BYTES is accepted; TRANSFER_MAX_BYTES+1 is refused before the socket is ever touched, naming both sizes", { timeout: 60000 }, async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-sendcap-"));
  try {
    const bigPath = join(fixtureDir, "big.bin");
    writeFileSync(bigPath, Buffer.alloc(TRANSFER_MAX_BYTES + 1, 0x41));

    // A socket-shaped double that throws if ever touched -- proves the
    // stat-based refusal fires BEFORE a single socket call, per D-11's
    // "fail fast, nothing wasted, one round trip".
    const throwingSocket = {
      write() {
        throw new Error("must not be reached: sendPayloadFromFile touched the socket before the size refusal");
      },
    } as unknown as Socket;

    const bigResult = await sendPayloadFromFile({ socket: throwingSocket, sourcePath: bigPath });
    assert.equal(bigResult.ok, false);
    if (!bigResult.ok) {
      assert.match(bigResult.reason, new RegExp(String(TRANSFER_MAX_BYTES)));
      assert.match(bigResult.reason, new RegExp(String(TRANSFER_MAX_BYTES + 1)));
    }

    const okPath = join(fixtureDir, "ok.bin");
    writeFileSync(okPath, Buffer.alloc(TRANSFER_MAX_BYTES, 0x41));

    const server = createServer();
    const serverDone = new Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>((resolve, reject) => {
      server.on("connection", (socket) => {
        readHeaderFromSocket(socket)
          .then(({ header, pending }) => receivePayloadToFile({ socket, destPath: join(fixtureDir, "dest", "ok.bin"), header, pending }))
          .then(resolve, reject);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const client = netConnect({ host: "127.0.0.1", port });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    const okResult = await sendPayloadFromFile({ socket: client, sourcePath: okPath });
    assert.equal(okResult.ok, true, okResult.ok ? "" : (okResult as { reason: string }).reason);
    const recv = await serverDone;
    assert.equal(recv.ok, true, recv.ok ? "" : (recv as { reason: string }).reason);
    server.close();
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

const MALFORMED_BYTE_LENGTHS: unknown[] = [-1, 1.5, "12", null, Number.MAX_SAFE_INTEGER + 2];

for (const bad of MALFORMED_BYTE_LENGTHS) {
  test(`receivePayloadToFile: header.byteLength=${JSON.stringify(bad)} is refused before the pipeline is constructed`, async () => {
    const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-badlen-"));
    try {
      const destPath = join(fixtureDir, "dest", "x.bin");
      // A socket-shaped double whose every stream-relevant method throws --
      // proves this validation runs BEFORE any stream is ever constructed
      // from `socket` (the acceptance criterion's own wording).
      const fakeSocket = {
        pipe() {
          throw new Error("must not be reached: pipeline constructed from an invalid header");
        },
        on() {
          throw new Error("must not be reached: pipeline constructed from an invalid header");
        },
        once() {
          throw new Error("must not be reached: pipeline constructed from an invalid header");
        },
        removeListener() {
          throw new Error("must not be reached: pipeline constructed from an invalid header");
        },
        unshift() {
          throw new Error("must not be reached: pending is empty in this case, unshift must not be called");
        },
      } as unknown as Socket;
      const header = { kind: "file", byteLength: bad, sha256: "abc" } as unknown as { kind: string; byteLength: number; sha256: string };

      const result = await receivePayloadToFile({ socket: fakeSocket, destPath, header });
      assert.equal(result.ok, false);
      if (!result.ok) {
        assert.match(result.reason, /byteLength/);
      }
      assert.equal(existsSync(destPath), false);
    } finally {
      rmSync(fixtureDir, { recursive: true, force: true });
    }
  });
}

test("receivePayloadToFile: a header declaring 1024 bytes fed 16777217 actual bytes refuses mid-stream, leaves nothing at destPath and no leftover temp file", { timeout: 60000 }, async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-lying-header-"));
  try {
    const destDir = join(fixtureDir, "dest");
    const destPath = join(destDir, "lied.bin");

    const server = createServer();
    const serverDone = new Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>((resolve, reject) => {
      server.on("connection", (socket) => {
        readHeaderFromSocket(socket)
          .then(({ header, pending }) => receivePayloadToFile({ socket, destPath, header, pending }))
          .then(resolve, reject);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const client = netConnect({ host: "127.0.0.1", port });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    // A hand-built header, declaring a small length, followed by MORE bytes
    // than the real cap -- the receiver must count for itself and refuse,
    // never trusting the declared 1024.
    writeTransferHeader(client, { kind: "file", byteLength: 1024, sha256: "0000" });
    const overCap = TRANSFER_MAX_BYTES + 1;
    const chunk = Buffer.alloc(1024 * 1024, 0x43);
    let written = 0;
    while (written < overCap) {
      const remaining = overCap - written;
      const toWrite = remaining < chunk.length ? chunk.subarray(0, remaining) : chunk;
      const ok = client.write(toWrite);
      written += toWrite.length;
      if (!ok) {
        await new Promise<void>((resolve) => client.once("drain", resolve));
      }
    }
    client.end();

    const result = await serverDone;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.match(result.reason, /cap|byte/i);
    }
    assert.equal(existsSync(destPath), false);
    assert.deepEqual(
      existsSync(destDir) ? readdirSync(destDir).filter((f) => f.includes(".tmp-")) : [],
      [],
    );
    server.close();
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("receivePayloadToFile: a socket destroyed mid-payload returns a refusal and leaves no file and no temp file", async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-midkill-"));
  try {
    const destDir = join(fixtureDir, "dest");
    const destPath = join(destDir, "partial.bin");

    const server = createServer();
    const serverDone = new Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>((resolve, reject) => {
      server.on("connection", (socket) => {
        readHeaderFromSocket(socket)
          .then(({ header, pending }) => receivePayloadToFile({ socket, destPath, header, pending }))
          .then(resolve, reject);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const client = netConnect({ host: "127.0.0.1", port });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    writeTransferHeader(client, { kind: "file", byteLength: 1024, sha256: "deadbeef" });
    client.write(Buffer.alloc(100, 0x41)); // only 100 of the declared 1024 bytes
    await new Promise((resolve) => setTimeout(resolve, 100));
    client.destroy(); // abrupt -- no FIN, no completing write

    const result = await serverDone;
    assert.equal(result.ok, false);
    assert.equal(existsSync(destPath), false);
    assert.deepEqual(
      existsSync(destDir) ? readdirSync(destDir).filter((f) => f.includes(".tmp-")) : [],
      [],
    );
    server.close();
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("broker-transfer: a receiver that stops reading stalls the sender's promise rather than being outrun by an already-buffered payload", { timeout: 60000 }, async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-backpressure-"));
  try {
    const sourcePath = join(fixtureDir, "source.bin");
    const destPath = join(fixtureDir, "dest", "received.bin");
    const payloadSize = 12 * 1024 * 1024; // 12 MiB -- comfortably over this
    // host's measured tcp_rmem max (6291456 bytes), so the kernel receive
    // window genuinely closes while the receiver is paused, rather than the
    // whole payload silently fitting in kernel buffers unread.
    writeFileSync(sourcePath, Buffer.alloc(payloadSize, 0x44));

    const server = createServer();
    let serverSocket: Socket | null = null;
    let headerResult: { header: { kind: string; byteLength: number; sha256: string }; pending: Buffer } | null = null;
    const headerReady = new Promise<void>((resolve, reject) => {
      server.on("connection", (socket) => {
        serverSocket = socket;
        readHeaderFromSocket(socket).then((info) => {
          headerResult = info;
          resolve();
        }, reject);
      });
    });

    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    const client = netConnect({ host: "127.0.0.1", port });
    await new Promise<void>((resolve, reject) => {
      client.once("connect", resolve);
      client.once("error", reject);
    });

    const sendPromise = sendPayloadFromFile({ socket: client, sourcePath });
    let settled = false;
    sendPromise.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );

    await headerReady;
    const socket = serverSocket!;
    // Explicitly pause -- matching this task's own required test shape
    // ("the test server accepts the connection, reads the header, then
    // pauses its socket"). Reading the header already removed this
    // connection's only "data" listener (readHeaderFromSocket's own), so
    // the socket is already effectively idle; this call makes that
    // explicit rather than relying on the implicit state.
    socket.pause();

    await new Promise((resolve) => setTimeout(resolve, 400));
    assert.equal(settled, false, "the sender's promise must not have settled while the receiver is paused");
    assert.ok(
      socket.bytesRead < payloadSize / 10,
      `expected far fewer than ${payloadSize} bytes observed while paused, observed ${socket.bytesRead}`,
    );

    socket.resume();
    const receivePromise = receivePayloadToFile({ socket, destPath, header: headerResult!.header, pending: headerResult!.pending });
    const [sendResult, receiveResult] = await Promise.all([sendPromise, receivePromise]);
    assert.equal(sendResult.ok, true, sendResult.ok ? "" : (sendResult as { reason: string }).reason);
    assert.equal(receiveResult.ok, true, receiveResult.ok ? "" : (receiveResult as { reason: string }).reason);
    if (sendResult.ok && receiveResult.ok) {
      assert.equal(receiveResult.byteLength, sendResult.byteLength);
      assert.equal(receiveResult.sha256, sendResult.sha256);
    }
    server.close();
  } finally {
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("TRANSFER_MAX_BYTES: imported (not re-typed) by both transfer-hash and this test, and equals 16 * 1024 * 1024", () => {
  assert.equal(TRANSFER_MAX_BYTES, 16 * 1024 * 1024);
});

// ---------------------------------------------------------------------------
// G-64-5 (plan 64-15, CR-01): a real filesystem fault caught by
// receivePayloadToFile()'s three catch branches must never put the broker's
// own absolute staging paths on the wire. Every test below drives a REAL
// fault (a real ENOENT/ENAMETOOLONG from a real fs call) -- never a
// synthetic, already path-free rejection, which is exactly what CR-01
// found the pre-existing suite could not catch (64-REVIEW.md).
// ---------------------------------------------------------------------------

test("receivePayloadToFile real fs fault, publish rename: a rename whose directory vanished answers path-free wire text and keeps the full reason", async () => {
  const fixtureDir = mkdtempSync(join(tmpdir(), "broker-transfer-rename-fault-"));
  const server = createServer();
  let client: Socket | undefined;
  try {
    const sourcePath = join(fixtureDir, "source.bin");
    writeFileSync(sourcePath, Buffer.from("hello world, this is the publish-rename fault fixture"));
    const sessionDir = join(fixtureDir, "session");
    const destPath = join(sessionDir, "staged.bin");

    const serverDone = new Promise<
      { ok: true; byteLength: number; sha256: string } | { ok: false; reason: string; code?: "bad_request" | "internal"; wireReason?: string }
    >((resolve, reject) => {
      server.on("connection", (socket) => {
        readHeaderFromSocket(socket)
          .then(({ header, pending }) =>
            receivePayloadToFile({
              socket,
              destPath,
              header,
              pending,
              // The verdict (digest/count match) has already been reached
              // by the time this hook runs (D-11's own timing contract) --
              // removing the destination's own directory here means the
              // renameSync() that follows fails with a REAL ENOENT, never a
              // synthetic one authored by the test.
              beforePublish: async () => {
                rmSync(sessionDir, { recursive: true, force: true });
              },
            }),
          )
          .then(resolve, reject);
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const port = (server.address() as AddressInfo).port;
    client = netConnect({ host: "127.0.0.1", port });
    await new Promise<void>((resolve, reject) => {
      client!.once("connect", resolve);
      client!.once("error", reject);
    });

    const sendResult = await sendPayloadFromFile({ socket: client, sourcePath });
    assert.equal(sendResult.ok, true, sendResult.ok ? "" : (sendResult as { reason: string }).reason);

    const result = await serverDone;
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.code, "internal");
      const wireReason = result.wireReason ?? "";
      assert.match(wireReason, /\(ENOENT\)/);
      assert.ok(!wireReason.includes(fixtureDir), `wireReason must exclude the fixture directory: ${wireReason}`);
      assert.ok(!wireReason.includes("/"), `wireReason must contain no "/": ${wireReason}`);
      assert.ok(result.reason.includes(destPath), `reason must still include destPath for the broker's own stderr line: ${result.reason}`);
    }
  } finally {
    // A try/finally around the socket AND the server -- unlike several
    // pre-existing tests in this file that close the server only at the
    // end of a passing try block -- because THIS test's own assertions are
    // expected to fail against today's unfixed tree (RED), and a listening
    // server left open by a thrown AssertionError keeps the whole test
    // process alive (measured live while authoring this test).
    if (client && !client.destroyed) client.destroy();
    server.close();
    rmSync(fixtureDir, { recursive: true, force: true });
  }
});

test("formatPathFreeFault: path-free fault text carries only a validated errno token", () => {
  const summary = "vice: test summary";
  const outputs: string[] = [];

  // A real Node fs error, taken from a failing statSync of a missing file
  // under a mkdtempSync directory.
  const missingDir = mkdtempSync(join(tmpdir(), "broker-transfer-fault-filter-"));
  try {
    let realFault: unknown;
    try {
      statSync(join(missingDir, "no-such-file"));
    } catch (e) {
      realFault = e;
    }
    assert.ok(realFault, "statSync of a missing file must throw");
    const realOutput = formatPathFreeFault(summary, realFault);
    outputs.push(realOutput);
    assert.match(realOutput, /\(ENOENT\)/);
    assert.ok(!realOutput.includes(missingDir), `real-fault output must exclude the fixture directory: ${realOutput}`);

    const noParenFaults: unknown[] = [
      new Error("no code at all"),
      Object.assign(new Error("numeric code"), { code: 42 }),
      Object.assign(new Error("code is a path"), { code: "/etc/passwd" }),
      Object.assign(new Error("code with embedded text"), { code: "ENOENT /tmp/x" }),
      Object.assign(new Error("lowercase code"), { code: "enoent" }),
      Object.assign(new Error("overlong code"), { code: "E".repeat(80) }),
      "a thrown string containing /tmp/leak",
      null,
      undefined,
      Object.defineProperty({}, "code", {
        enumerable: true,
        get(): string {
          throw new Error("a throwing code getter must count as no code");
        },
      }),
    ];
    noParenFaults.forEach((fault, index) => {
      const output = formatPathFreeFault(summary, fault);
      outputs.push(output);
      // Never stringify `fault` itself in this message -- the last fixture
      // is deliberately a throwing `code` getter, and JSON.stringify()
      // would invoke it as a side effect of building the message, even on
      // a passing assertion (message arguments evaluate eagerly).
      assert.ok(!output.includes("("), `output for noParenFaults[${index}] must contain no "(": ${output}`);
    });

    for (const output of outputs) {
      assert.ok(output.startsWith(summary), `every output must start with the summary: ${output}`);
      assert.ok(!output.includes("/"), `every output must contain no "/": ${output}`);
    }
  } finally {
    rmSync(missingDir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// Task 1 (Phase 64-03, XFER-04/XFER-07, D-05/D-06): the staging directory,
// the minted handle, and slot supersession. Every test sets
// VICE_BROKER_HOME to a fresh mkdtempSync directory (withStagingFixture())
// and restores it in a finally -- no test touches the real machine-level
// root.
// ---------------------------------------------------------------------------

test("stageFileSlot: two calls with the same grant and slot return different handles; the first handle stops resolving and its file is gone", async () => {
  await withStagingFixture(async () => {
    const first = stageFileSlot({ grantId: "req-1-1-aaaaaaaa", slot: "disk8" });
    assert.equal(first.ok, true);
    if (!first.ok) return;
    writeFileSync(first.stagedPath, Buffer.from("first"));
    assert.ok(existsSync(first.stagedPath));

    const second = stageFileSlot({ grantId: "req-1-1-aaaaaaaa", slot: "disk8" });
    assert.equal(second.ok, true);
    if (!second.ok) return;
    assert.notEqual(second.handle, first.handle);

    assert.equal(existsSync(first.stagedPath), false, "the FIRST staged file must be gone after supersession");
    const firstResolve = resolveStagedFile(first.handle);
    assert.equal(firstResolve.ok, false, "the FIRST handle must no longer resolve after supersession");

    const secondResolve = resolveStagedFile(second.handle);
    assert.equal(secondResolve.ok, true);
  });
});

test("stageFileSlot: two calls with the same grant and DIFFERENT slots both resolve, and neither deletes the other's file", async () => {
  await withStagingFixture(async () => {
    const a = stageFileSlot({ grantId: "req-1-1-bbbbbbbb", slot: "disk8" });
    const b = stageFileSlot({ grantId: "req-1-1-bbbbbbbb", slot: "disk9" });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    writeFileSync(a.stagedPath, Buffer.from("a"));
    writeFileSync(b.stagedPath, Buffer.from("b"));

    assert.ok(existsSync(a.stagedPath));
    assert.ok(existsSync(b.stagedPath));
    assert.equal(resolveStagedFile(a.handle).ok, true);
    assert.equal(resolveStagedFile(b.handle).ok, true);
  });
});

test("stageFileSlot: two calls with different grant ids land in different session directories", async () => {
  await withStagingFixture(async () => {
    const a = stageFileSlot({ grantId: "req-1-1-cccccccc", slot: "disk8" });
    const b = stageFileSlot({ grantId: "req-2-2-dddddddd", slot: "disk8" });
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    if (!a.ok || !b.ok) return;
    assert.notEqual(dirname(a.stagedPath), dirname(b.stagedPath));
  });
});

const UNSAFE_SLOTS = ["../escape", "a/b", "a\\b", "foo\u0000bar"];

for (const slot of UNSAFE_SLOTS) {
  test(`stageFileSlot: a slot ${JSON.stringify(slot)} is refused before any directory is created`, async () => {
    await withStagingFixture(async (home) => {
      const before = existsSync(join(home, "staging")) ? readdirSync(join(home, "staging")) : [];
      const result = stageFileSlot({ grantId: "req-1-1-eeeeeeee", slot });
      assert.equal(result.ok, false);
      const after = existsSync(join(home, "staging")) ? readdirSync(join(home, "staging")) : [];
      assert.deepEqual(after, before, "no session directory may be created for a refused slot");
    });
  });
}

test("clearStagingForSession: removes the session directory recursively and is a no-op on a second call", async () => {
  await withStagingFixture(async () => {
    const grantId = "req-1-1-ffffffff";
    const staged = stageFileSlot({ grantId, slot: "disk8" });
    assert.equal(staged.ok, true);
    if (!staged.ok) return;
    writeFileSync(staged.stagedPath, Buffer.from("bytes"));
    const sessionDir = dirname(staged.stagedPath);
    assert.ok(existsSync(sessionDir));

    clearStagingForSession(grantId);
    assert.equal(existsSync(sessionDir), false);
    assert.equal(resolveStagedFile(staged.handle).ok, false);

    // Second call: a no-op, never a throw.
    clearStagingForSession(grantId);
    assert.equal(existsSync(sessionDir), false);
  });
});

test("markTransferInFlight/clearTransferInFlight: a handle already in flight is refused; succeeds again after clearing", async () => {
  await withStagingFixture(async () => {
    const staged = stageFileSlot({ grantId: "req-1-1-11111111", slot: "disk8" });
    assert.equal(staged.ok, true);
    if (!staged.ok) return;

    const first = markTransferInFlight(staged.handle);
    assert.equal(first.ok, true);
    const second = markTransferInFlight(staged.handle);
    assert.equal(second.ok, false);

    clearTransferInFlight(staged.handle);
    const third = markTransferInFlight(staged.handle);
    assert.equal(third.ok, true);
    clearTransferInFlight(staged.handle);
  });
});

test("resolveStagedFile: refuses an unknown handle, never revealing a staging path", async () => {
  await withStagingFixture(async () => {
    const result = resolveStagedFile("0000000000000000000000000000000000");
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.doesNotMatch(result.reason, /staging|\/tmp\//);
    }
  });
});
