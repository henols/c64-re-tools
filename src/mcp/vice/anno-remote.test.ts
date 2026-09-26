// anno-remote.test.ts -- the annotation call over a real broker's endpoint.
//
// One harness broker (dynamic port, temp VICE_BROKER_HOME -- never 19510,
// never the real ~/.c64-re-tools) answers every case. What is proved:
//   * a project is registered before its first write, a read of an unknown
//     id is refused as `unknown_project`, and two projects stay isolated;
//   * a staged image is what a derived read decodes, and arguments far past
//     the broker's 64 KiB line cap still arrive, because they are staged;
//   * of two parallel writers based on the same revision, one is refused;
//   * a report's files come back by handle;
//   * no path crosses the socket: a tee between client and broker never sees
//     a marker planted in the input's directory -- and does see it when a
//     planted call puts the path in its arguments, so the tee is really
//     looking.
import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { connect, createServer, type Server, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { startHarnessBroker, type HarnessBroker } from "./broker-harness.ts";
import { runAnnoRemote, type AnnoRemoteCall, type AnnoRemoteOptions, type AnnoRemoteResult } from "./anno-remote.ts";

/** A tiny PRG: load address $0801, then `lda #$00` / `rts`. */
const PRG = new Uint8Array([0x01, 0x08, 0xa9, 0x00, 0x60]);

let broker: HarnessBroker;
let endpoint: AnnoRemoteOptions;
let scratch: string;

before(async () => {
  broker = await startHarnessBroker();
  endpoint = { port: broker.port, candidates: ["127.0.0.1"] };
  scratch = mkdtempSync(join(tmpdir(), "anno-remote-"));
});

after(async () => {
  await broker?.stop();
  if (scratch) rmSync(scratch, { recursive: true, force: true });
});

function call(projectId: string, kind: AnnoRemoteCall["kind"], name: string, args: Record<string, unknown> = {}, files: Record<string, string> = {}): Promise<AnnoRemoteResult> {
  return runAnnoRemote({ projectId, kind, name, args, files }, endpoint);
}

async function register(projectId: string): Promise<void> {
  const result = await call(projectId, "register", "");
  assert.deepEqual(result, { ok: true, type: "register" });
}

/** A successful tool answer's parsed body. */
function toolBody(result: AnnoRemoteResult): Record<string, unknown> {
  assert.ok(result.ok && result.type === "tool", `expected a tool answer, got ${JSON.stringify(result)}`);
  assert.equal(result.result.isError, false, result.result.content[0]!.text);
  return JSON.parse(result.result.content[0]!.text) as Record<string, unknown>;
}

function writePrg(dir: string, name = "game.prg"): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, name);
  writeFileSync(path, PRG);
  return path;
}

test("a registered project takes a write and reads it back; an unregistered id is refused as unknown_project", async () => {
  const project = randomUUID();
  const before = await call(project, "tool", "anno_get_symbols", { max_results: 5 });
  assert.equal(before.ok, false);
  assert.equal(!before.ok && before.code, "unknown_project", JSON.stringify(before));

  await register(project);
  toolBody(await call(project, "tool", "anno_set_label_name", { address: "$c000", name: "entry" }));
  const symbols = toolBody(await call(project, "tool", "anno_get_symbols", { max_results: 5 }));
  assert.deepEqual((symbols.symbols as { name: string; address: number }[]).map((s) => [s.name, s.address]), [["entry", 0xc000]]);
});

test("two projects bind the same label name over the wire without seeing each other's rows", async () => {
  const a = randomUUID();
  const b = randomUUID();
  await register(a);
  await register(b);
  toolBody(await call(a, "tool", "anno_set_label_name", { address: "$1000", name: "init" }));
  toolBody(await call(b, "tool", "anno_set_label_name", { address: "$2000", name: "init" }));
  const symbolsA = toolBody(await call(a, "tool", "anno_get_symbols", { max_results: 5 })).symbols as { address: number }[];
  const symbolsB = toolBody(await call(b, "tool", "anno_get_symbols", { max_results: 5 })).symbols as { address: number }[];
  assert.deepEqual(symbolsA.map((s) => s.address), [0x1000]);
  assert.deepEqual(symbolsB.map((s) => s.address), [0x2000]);
});

test("a derived read decodes the staged image, and the answer names the file by its basename only", async () => {
  const project = randomUUID();
  await register(project);
  const image = writePrg(join(scratch, "disasm"));
  const body = toolBody(await call(project, "tool", "anno_disassemble", { image: { $file: "f0" }, address: "$0801" }, { f0: image }));
  assert.equal(body.image, "game.prg");
  assert.equal(body.origin, 0x0801);
  assert.match(String(body.listing), /lda #\$00/i);
});

test("arguments far past the broker's 64 KiB line cap arrive, because they are staged rather than sent on the line", async () => {
  const project = randomUUID();
  await register(project);
  const calls = Array.from({ length: 1500 }, (_, i) => ({ name: "anno_set_label_name", arguments: { address: 0x4000 + i, name: `label_${i}` } }));
  assert.ok(JSON.stringify({ calls }).length > 65536, "the payload must exceed the line cap for this case to prove anything");
  const body = toolBody(await call(project, "tool", "anno_batch_execute", { calls }));
  assert.equal(body.succeeded, 1500);
});

test("of two parallel writers based on the same revision, exactly one is refused as stale", async () => {
  const project = randomUUID();
  await register(project);
  const [first, second] = await Promise.all([
    call(project, "tool", "anno_set_label_name", { address: "$3000", name: "one", base_revision: 0 }),
    call(project, "tool", "anno_set_label_name", { address: "$3001", name: "two", base_revision: 0 }),
  ]);
  const outcomes = [first, second].map((r) => (r.ok && r.type === "tool" ? r.result.isError : "no-answer"));
  assert.deepEqual([...outcomes].sort(), [false, true], JSON.stringify([first, second]));
  const refused = [first, second].find((r) => r.ok && r.type === "tool" && r.result.isError)!;
  assert.match(refused.ok && refused.type === "tool" ? refused.result.content[0]!.text : "", /AnnoStoreStaleRevisionError/);
});

test("a report's files come back by handle", async () => {
  const project = randomUUID();
  await register(project);
  toolBody(await call(project, "tool", "anno_set_data_type", { start_address: "$0801", end_address: "$0803", data_type: "code" }));
  const image = writePrg(join(scratch, "export"));
  const result = await call(project, "report", "export-asm", { image: { $file: "f0" }, store_label: "project" }, { f0: image });
  assert.ok(result.ok && result.type === "report", JSON.stringify(result));
  const names = result.files.map((f) => f.name);
  assert.deepEqual([...names].sort(), ["root.a", "symbols.a", "unscoped.a"]);
  const root = new TextDecoder().decode(result.files.find((f) => f.name === "root.a")!.bytes);
  assert.match(root, /!source "symbols.a"/);
});

/** A TCP tee in front of the broker: forwards both ways and records every
 * byte the client sends. */
async function startTee(): Promise<{ port: number; sent: () => string; close: () => Promise<void> }> {
  const chunks: Buffer[] = [];
  const sockets = new Set<Socket>();
  // Half-open on both legs: a transfer client half-closes after its payload
  // and still reads the broker's confirmation.
  const server: Server = createServer({ allowHalfOpen: true }, (client) => {
    const upstream = connect({ port: broker.port, host: "127.0.0.1", allowHalfOpen: true });
    sockets.add(client);
    sockets.add(upstream);
    // Two pipes carry both directions, half-closes included; the tap only
    // records what the client sends.
    client.on("data", (chunk: Buffer) => chunks.push(chunk));
    client.pipe(upstream);
    upstream.pipe(client);
    const fail = (): void => {
      client.destroy();
      upstream.destroy();
    };
    client.on("error", fail);
    upstream.on("error", fail);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as { port: number }).port;
  return {
    port,
    sent: () => Buffer.concat(chunks).toString("latin1"),
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}

test("no path crosses the socket: a marker in the input's directory never reaches the broker, and a planted path argument does", async () => {
  const project = randomUUID();
  await register(project);
  const marker = `MARKER${randomUUID().replace(/-/g, "")}`;
  const image = writePrg(join(scratch, marker));
  const tee = await startTee();
  try {
    const teed: AnnoRemoteOptions = { port: tee.port, candidates: ["127.0.0.1"] };
    const staged = await runAnnoRemote({ projectId: project, kind: "tool", name: "anno_get_binary_info", args: { image: { $file: "f0" } }, files: { f0: image } }, teed);
    assert.ok(staged.ok && staged.type === "tool" && !staged.result.isError, JSON.stringify(staged));
    assert.ok(tee.sent().length > 0, "the tee must have carried the call");
    assert.equal(tee.sent().includes(marker), false, "the input's directory must never cross the socket");

    const planted = await runAnnoRemote({ projectId: project, kind: "tool", name: "anno_get_binary_info", args: { image }, files: {} }, teed);
    assert.ok(planted.ok && planted.type === "tool" && planted.result.isError, "the engine refuses a path it was sent");
    assert.equal(tee.sent().includes(marker), true, "planted: a path in the arguments is visible to the tee, so the check above is really looking");
  } finally {
    await tee.close();
  }
});
