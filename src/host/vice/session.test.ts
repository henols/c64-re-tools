import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test } from "node:test";

import { WireFailure } from "../../protocol.ts";
import { BinaryMonitor, Command, EVENT_REQUEST_ID } from "./binary-monitor.ts";
import type { ViceProcess } from "./process.ts";
import { ViceSession } from "./session.ts";

// ---------------------------------------------------------------------------
// A fake VICE binary monitor that behaves like stock VICE 3.10 as probed:
// any command while running first sends a register event and a stopped event;
// exit answers, then sends a resumed event.

function frame(type: number, requestId: number, body: Buffer = Buffer.alloc(0), error = 0): Buffer {
  const header = Buffer.alloc(12);
  header[0] = 0x02;
  header[1] = 0x02;
  header.writeUInt32LE(body.length, 2);
  header[6] = type;
  header[7] = error;
  header.writeUInt32LE(requestId, 8);
  return Buffer.concat([header, body]);
}

const REGISTERS = [
  { id: 3, name: "PC", bits: 16 },
  { id: 0, name: "A", bits: 8 },
  { id: 1, name: "X", bits: 8 },
  { id: 2, name: "Y", bits: 8 },
  { id: 4, name: "SP", bits: 8 },
  { id: 5, name: "FL", bits: 8 },
];

class FakeVice {
  running = true;
  readonly commands: number[] = [];
  readonly memory = Buffer.alloc(0x10000);
  registers: Record<string, number> = { PC: 0xe5cf, A: 0x42, X: 3, Y: 0, SP: 0xf9, FL: 0b1010_0101 };
  socket: Socket | undefined;
  readonly server: Server;

  constructor() {
    for (let address = 0; address < 0x10000; address++) this.memory[address] = address & 0xff;
    this.server = createServer((socket) => {
      this.socket = socket;
      let pending = Buffer.alloc(0);
      socket.on("data", (chunk) => {
        pending = Buffer.concat([pending, chunk]);
        while (pending.length >= 11) {
          const length = pending.readUInt32LE(2);
          if (pending.length < 11 + length) break;
          this.#command(socket, pending.readUInt32LE(6), pending[10]!, pending.subarray(11, 11 + length));
          pending = pending.subarray(11 + length);
        }
      });
      socket.on("error", () => {});
    });
  }

  /** Stops the machine as a checkpoint would. */
  stopSpontaneously(pc: number): void {
    this.running = false;
    this.registers.PC = pc;
    this.socket!.write(frame(0x62, EVENT_REQUEST_ID, this.#pc()));
  }

  #pc(): Buffer {
    const body = Buffer.alloc(2);
    body.writeUInt16LE(this.registers.PC!, 0);
    return body;
  }

  #command(socket: Socket, id: number, command: number, body: Buffer): void {
    this.commands.push(command);
    if (this.running) {
      this.running = false;
      socket.write(Buffer.concat([frame(0x31, EVENT_REQUEST_ID, this.#registerBody(0)), frame(0x62, EVENT_REQUEST_ID, this.#pc())]));
    }
    switch (command) {
      case Command.banksAvailable: {
        const items = ["default", "cpu", "ram"].map((name, index) =>
          Buffer.concat([Buffer.from([3 + name.length]), u16(index === 0 ? 0 : index - 1), Buffer.from([name.length]), Buffer.from(name)]),
        );
        socket.write(frame(command, id, Buffer.concat([u16(items.length), ...items])));
        break;
      }
      case Command.registersAvailable: {
        const items = REGISTERS.map((r) => Buffer.concat([Buffer.from([3 + r.name.length, r.id, r.bits, r.name.length]), Buffer.from(r.name)]));
        socket.write(frame(command, id, Buffer.concat([u16(items.length), ...items])));
        break;
      }
      case Command.registersGet:
        socket.write(frame(command, id, this.#registerBody(body[0]!)));
        break;
      case Command.memoryGet: {
        const start = body.readUInt16LE(1);
        const end = body.readUInt16LE(3);
        const data = this.memory.subarray(start, end + 1);
        socket.write(frame(command, id, Buffer.concat([u16(data.length), data])));
        break;
      }
      case Command.exit:
        socket.write(frame(command, id));
        this.running = true;
        socket.write(frame(0x63, EVENT_REQUEST_ID, this.#pc()));
        break;
      default:
        socket.write(frame(command, id, Buffer.alloc(0), 0x83));
    }
  }

  #registerBody(memspace: number): Buffer {
    const items = REGISTERS.map((r) => {
      const value = memspace === 0 ? this.registers[r.name]! : 0;
      return Buffer.concat([Buffer.from([3, r.id]), u16(value)]);
    });
    return Buffer.concat([u16(items.length), ...items]);
  }
}

function u16(value: number): Buffer {
  const buffer = Buffer.alloc(2);
  buffer.writeUInt16LE(value, 0);
  return buffer;
}

const servers: Server[] = [];
after(() => {
  for (const server of servers) server.close();
});

async function startSession(): Promise<{ fake: FakeVice; session: ViceSession; process: ViceProcess & { crash(): void; stopped: number } }> {
  const fake = new FakeVice();
  servers.push(fake.server);
  fake.server.listen(0, "127.0.0.1");
  await once(fake.server, "listening");
  const monitor = await BinaryMonitor.connect((fake.server.address() as { port: number }).port);
  let exit!: (status: { code: number | null; signal: NodeJS.Signals | null }) => void;
  const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) => (exit = resolve));
  const process = {
    pid: 0,
    monitor,
    exited,
    stopped: 0,
    outputTail: () => "",
    async stop() {
      this.stopped++;
      await monitor.close();
    },
    crash() {
      fake.socket?.destroy();
      exit({ code: null, signal: "SIGSEGV" });
    },
  };
  const session = await ViceSession.start(process, "pal");
  fake.commands.length = 0;
  return { fake, session, process };
}

test("setup leaves the machine running", async () => {
  const { fake, session } = await startSession();
  assert.equal(fake.running, true);
  await session.close();
});

test("status while running reports no pc and does not touch the machine", async () => {
  const { fake, session } = await startSession();
  assert.deepEqual(await session.handle("status", {}), { state: "running", videoStandard: "pal", warp: false });
  assert.deepEqual(fake.commands, []);
  await session.close();
});

test("a read while running pauses, reads and resumes", async () => {
  const { fake, session } = await startSession();
  const result = await session.handle("memoryRead", { address: 0xe000, size: 4, space: "c64", view: "cpu" });
  assert.deepEqual(result, { address: 0xe000, data: "00010203" });
  assert.deepEqual(fake.commands, [Command.memoryGet, Command.exit]);
  assert.equal(fake.running, true);
  assert.equal((await session.handle("status", {})).state, "running");
  await session.close();
});

test("a read while stopped leaves the machine stopped and status reports the pc", async () => {
  const { fake, session } = await startSession();
  fake.stopSpontaneously(0x2100);
  await waitFor(async () => (await session.handle("status", {})).state === "stopped");
  fake.commands.length = 0;
  const registers = await session.handle("registersGet", { space: "c64" });
  assert.deepEqual(registers, {
    pc: 0x2100,
    a: 0x42,
    x: 3,
    y: 0,
    sp: 0xf9,
    flags: { n: true, v: false, b: false, d: false, i: true, z: false, c: true },
  });
  assert.deepEqual(fake.commands, [Command.registersGet]);
  assert.equal(fake.running, false);
  assert.deepEqual(await session.handle("status", {}), { state: "stopped", videoStandard: "pal", warp: false, pc: 0x2100 });
  await session.close();
});

test("the ram view is refused for drive8", async () => {
  const { fake, session } = await startSession();
  await assert.rejects(
    session.handle("memoryRead", { address: 0, size: 1, space: "drive8", view: "ram" }),
    (error: unknown) => error instanceof WireFailure && error.code === "unsupported-in-space",
  );
  assert.equal(fake.running, true, "a refused read must not leave the machine stopped");
  await session.close();
});

test("concurrent operations run one at a time", async () => {
  const { fake, session } = await startSession();
  await Promise.all([
    session.handle("memoryRead", { address: 0, size: 1, space: "c64", view: "cpu" }),
    session.handle("registersGet", { space: "c64" }),
    session.handle("memoryRead", { address: 1, size: 1, space: "c64", view: "ram" }),
  ]);
  assert.deepEqual(fake.commands, [Command.memoryGet, Command.exit, Command.registersGet, Command.exit, Command.memoryGet, Command.exit]);
  await session.close();
});

test("a VICE crash fails the operation and every later one with machine-state-lost", async () => {
  const { session, process } = await startSession();
  process.crash();
  for (let attempt = 0; attempt < 2; attempt++) {
    await assert.rejects(
      session.handle("registersGet", { space: "c64" }),
      (error: unknown) => error instanceof WireFailure && error.code === "machine-state-lost",
    );
  }
  await session.close();
});

test("closing drops queued work and stops VICE", async () => {
  const { session, process } = await startSession();
  const queued = session.handle("memoryRead", { address: 0, size: 1, space: "c64", view: "cpu" });
  const closing = session.close();
  await assert.rejects(queued, (error: unknown) => error instanceof WireFailure && error.code === "machine-unavailable");
  await closing;
  assert.equal(process.stopped, 1);
});

async function waitFor(condition: () => Promise<boolean>, timeoutMs = 2000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await condition())) {
    if (Date.now() > deadline) throw new Error("condition not reached in time");
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}
