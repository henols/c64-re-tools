import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { connect } from "node:net";
import { resolve } from "node:path";
import { createInterface } from "node:readline";
import { test } from "node:test";

import { encodeFrame, FrameDecoder, HOST_PROTOCOL_ID } from "../../src/protocol.ts";

// Runs the built executable, so `pnpm build` must come first.
const root = resolve(import.meta.dirname, "../..");

test("c64-re-tools-host runs in the foreground, serves the protocol and stops on SIGTERM", { skip: process.platform === "win32" ? "the Host Runtime runs on Linux and macOS (POSIX signals and process groups)" : false }, async () => {
  const host = spawn(process.execPath, ["dist/host/main.js", "--port", "0"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
  try {
    const [line] = (await once(createInterface({ input: host.stdout }), "line")) as [string];
    const match = /listening on (127\.0\.0\.1):(\d+)$/.exec(line);
    assert.ok(match, line);

    // A client from another installation is refused without starting an emulator.
    const socket = connect({ host: match[1]!, port: Number(match[2]) });
    await once(socket, "connect");
    socket.write(encodeFrame({ type: "hello", protocol: HOST_PROTOCOL_ID, version: 0, role: "vice-session" }));
    const decoder = new FrameDecoder();
    const [chunk] = (await once(socket, "data")) as [Buffer];
    const [reply] = decoder.push(chunk) as Array<{ type: string; error: { code: string } }>;
    assert.equal(reply?.type, "error");
    assert.equal(reply.error.code, "installation-incomplete");
    socket.destroy();

    host.kill("SIGTERM");
    const [code] = (await once(host, "exit")) as [number | null];
    assert.equal(code, 0);
  } finally {
    host.kill("SIGKILL");
  }
});

test("c64-re-tools-host refuses a bad --port", async () => {
  const host = spawn(process.execPath, ["dist/host/main.js", "--port", "seven"], { cwd: root, stdio: "ignore" });
  const [code] = (await once(host, "exit")) as [number | null];
  assert.equal(code, 2);
});
