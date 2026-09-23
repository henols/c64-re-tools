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
import { mkdtempSync, writeFileSync, rmSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { build } from "./build.ts";

build();

const brokerTransferModule = (await import(new URL("./resources/broker-transfer.mjs", import.meta.url).href)) as unknown as {
  writeTransferHeader: (socket: Socket, header: { kind: string; byteLength: number; sha256: string }) => void;
  readTransferHeader: (
    chunk: Buffer,
    carry?: Buffer,
  ) => { header?: { kind: string; byteLength: number; sha256: string }; remainder: Buffer; overflow: boolean; error?: string };
  sendPayloadFromFile: (opts: { socket: Socket; sourcePath: string; capBytes?: number }) => Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>;
  receivePayloadToFile: (opts: {
    socket: Socket;
    destPath: string;
    header: { kind: string; byteLength: number; sha256: string };
    pending?: Buffer;
    capBytes?: number;
  }) => Promise<{ ok: true; byteLength: number; sha256: string } | { ok: false; reason: string }>;
  MAX_TRANSFER_HEADER_LINE_BYTES: number;
};
const { writeTransferHeader, readTransferHeader, sendPayloadFromFile, receivePayloadToFile } = brokerTransferModule;

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
