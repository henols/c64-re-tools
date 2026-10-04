import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer, type Server, type Socket } from "node:net";
import { after, test } from "node:test";

import { cleanOutput, TextMonitor, TextMonitorError } from "./text-monitor.ts";

const servers: Server[] = [];
after(() => {
  for (const server of servers) server.close();
});

/** The four-line answer VICE gives to `~ $nnnn`, then a prompt. */
function sentinelAnswer(hex: string, prompt = "(C:$e5cf) "): string {
  const value = Number.parseInt(hex, 16);
  return `+${value}\n$${hex}\n${value.toString(8).padStart(7, "0")}\n%${value.toString(2).padStart(16, "0").replace(/(.{8})/, "$1 ")}\n${prompt}`;
}

/** Returned by an answer function: VICE silently drops this one line. */
const DROP = Symbol("drop");

/**
 * A fake text monitor: `answer` maps a command to its output; the first
 * command also gets VICE's extra entry prompt. undefined hangs the monitor.
 * A line for which `hold` is true runs only when the next input arrives, as
 * stock VICE sometimes does.
 */
async function fakeTextMonitor(
  answer: (command: string) => string | undefined | typeof DROP,
  hold: (line: string) => boolean = () => false,
): Promise<{ monitor: TextMonitor; socket: () => Socket }> {
  let current: Socket | undefined;
  const server = createServer((socket) => {
    current = socket;
    let entered = false;
    let hung = false;
    let pending = "";
    let held: string[] = [];
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      const lines = held;
      held = [];
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        lines.push(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
      for (const [index, line] of lines.entries()) {
        if (index === lines.length - 1 && hold(line)) {
          held.push(line);
          continue;
        }
        if (hung) continue;
        const sentinel = /^~ \$([0-9a-f]{4})$/.exec(line);
        if (sentinel !== null) {
          socket.write(sentinelAnswer(sentinel[1]!));
          continue;
        }
        const output = answer(line);
        if (output === DROP) continue;
        if (output === undefined) {
          hung = true; // simulate a hang: answer nothing from now on
          continue;
        }
        socket.write(`${entered ? "" : "(C:$fd6e) "}${output}(C:$fd6e) `);
        entered = true;
      }
    });
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const monitor = await TextMonitor.connect((server.address() as { port: number }).port);
  return { monitor, socket: () => current! };
}

test("prompts are stripped from command output", () => {
  assert.equal(cleanOutput("(C:$fd6e) (C:$fd6e) "), "");
  assert.equal(cleanOutput("Warp mode is on.\n(8:$ec12) "), "Warp mode is on.");
});

test("the extra entry prompt does not shift answers between commands", async () => {
  const { monitor } = await fakeTextMonitor((command) => (command === "warp" ? "Warp mode is on.\n" : ""));
  assert.equal(await monitor.command("warp on"), "");
  assert.equal(await monitor.command("warp"), "Warp mode is on.");
  assert.equal(await monitor.command("warp off"), "");
  await monitor.close();
});

test("concurrent commands run one at a time and get their own output", async () => {
  const { monitor } = await fakeTextMonitor((command) => `${command.toUpperCase()}\n`);
  const results = await Promise.all(["one", "two", "three"].map((command) => monitor.command(command)));
  assert.deepEqual(results, ["ONE", "TWO", "THREE"]);
  await monitor.close();
});

test("output that looks like a prompt or a number is kept", async () => {
  const { monitor } = await fakeTextMonitor(() => ">C:c000  a9 01 8d 20  d0 60 ff ff   .a. P...\n+43981\n");
  assert.equal(await monitor.command("m c000 c007"), ">C:c000  a9 01 8d 20  d0 60 ff ff   .a. P...\n+43981");
  await monitor.close();
});

test("a multi-line command is refused before it reaches VICE", async () => {
  const { monitor } = await fakeTextMonitor(() => "");
  await assert.rejects(monitor.command("warp on\nquit"), TypeError);
  await monitor.close();
});

test("a command without an answer times out", async () => {
  const { monitor } = await fakeTextMonitor(() => undefined);
  await assert.rejects(monitor.command("hang", 50), TextMonitorError);
  await monitor.close();
});

test("VICE closing the connection fails the command and reports why", async () => {
  const { monitor, socket } = await fakeTextMonitor(() => {
    socket().destroy();
    return undefined;
  });
  await assert.rejects(monitor.command("quit"), TextMonitorError);
  assert.ok((await monitor.closed) instanceof TextMonitorError);
});

test("a command whose line VICE dropped is sent once more", async () => {
  let seen = 0;
  const { monitor } = await fakeTextMonitor((command) => {
    seen++;
    return seen === 1 ? DROP : `${command} done\n`;
  });
  assert.equal(await monitor.command("stopwatch", 8000), "stopwatch done");
  assert.equal(seen, 2);
  await monitor.close();
});

test("a sentinel that VICE holds is sent again, and its late answer is not output", async () => {
  let held = 0;
  const { monitor } = await fakeTextMonitor(
    (command) => `${command} done\n`,
    (line) => line.startsWith("~") && held++ === 0,
  );
  assert.equal(await monitor.command("load", 5000), "load done");
  assert.equal(held, 2, "the first sentinel was held, the resend released it");
  assert.equal(await monitor.command("attach"), "attach done");
  await monitor.close();
});

test("a stray sentinel answer in the output is removed", () => {
  assert.equal(cleanOutput(`(C:$fd83) +5875\n$16f3\n0013363\n%00010110 11110011\n(C:$fd83) (C:$fd83) `), "");
  assert.equal(cleanOutput("+43981\n"), "+43981");
});
