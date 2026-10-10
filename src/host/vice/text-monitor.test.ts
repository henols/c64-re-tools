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

/** An answer VICE prints in parts, `gapMs` apart, as a long hunt or memory map does; the prompt follows the last part. */
interface Streamed {
  parts: string[];
  gapMs: number;
}

/**
 * A fake text monitor: `answer` maps a command to its output; the first
 * command also gets VICE's extra entry prompt. undefined hangs the monitor.
 * A line for which `hold` is true runs only when the next input arrives, as
 * stock VICE sometimes does. Lines that arrive while a streamed answer prints
 * wait until it ends.
 */
async function fakeTextMonitor(
  answer: (command: string) => string | undefined | typeof DROP | Streamed,
  hold: (line: string) => boolean = () => false,
): Promise<{ monitor: TextMonitor; socket: () => Socket }> {
  let current: Socket | undefined;
  const server = createServer((socket) => {
    current = socket;
    let entered = false;
    let hung = false;
    let pending = "";
    let held: string[] = [];
    let waiting: string[] = [];
    let streaming = false;
    const run = (lines: string[]) => {
      for (const [index, line] of lines.entries()) {
        if (streaming) {
          waiting.push(line);
          continue;
        }
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
        const entry = entered ? "" : "(C:$fd6e) ";
        entered = true;
        if (typeof output === "string") {
          socket.write(`${entry}${output}(C:$fd6e) `);
          continue;
        }
        streaming = true;
        const parts = [...output.parts];
        socket.write(`${entry}${parts.shift() ?? ""}`);
        const next = () => {
          if (socket.destroyed) return;
          const part = parts.shift();
          if (parts.length > 0) {
            socket.write(part!);
            setTimeout(next, output.gapMs);
            return;
          }
          socket.write(`${part ?? ""}(C:$fd6e) `);
          streaming = false;
          const later = waiting;
          waiting = [];
          run(later);
        };
        setTimeout(next, output.gapMs);
      }
    };
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      const lines = held;
      held = [];
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        lines.push(pending.slice(0, newline));
        pending = pending.slice(newline + 1);
      }
      run(lines);
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
  monitor.resendAfterMs = 20;
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
  monitor.sentinelResendMs = 20;
  assert.equal(await monitor.command("load", 5000), "load done");
  assert.equal(held, 2, "the first sentinel was held, the resend released it");
  assert.equal(await monitor.command("attach"), "attach done");
  await monitor.close();
});

test("a stray sentinel answer in the output is removed", () => {
  assert.equal(cleanOutput(`(C:$fd83) +5875\n$16f3\n0013363\n%00010110 11110011\n(C:$fd83) (C:$fd83) `), "");
  assert.equal(cleanOutput("+43981\n"), "+43981");
});

test("a step message of a binary monitor step in the output is removed", () => {
  assert.equal(cleanOutput("Stepping through the next 4 instruction(s).\r\n(C:$fce7) "), "");
  assert.equal(cleanOutput("Stepping through the next 1 instruction(s).\nWarp mode is on.\n(C:$fce7) "), "Warp mode is on.");
});

test("a command that still prints when the resend time passes is sent once and read once", async () => {
  let runs = 0;
  const { monitor } = await fakeTextMonitor((command) => {
    runs++;
    return command === "hunt" ? { parts: ["1000\n", "2000\n", "3000\n"], gapMs: 80 } : "";
  });
  monitor.resendAfterMs = 40;
  // The first command gets VICE's extra entry prompt; the hunt after it gets a prompt only at its end.
  assert.equal(await monitor.command("first"), "");
  assert.equal(await monitor.command("hunt", 5000), "1000\n2000\n3000");
  assert.equal(runs, 2);
  assert.equal(await monitor.command("next"), "");
  await monitor.close();
});

test("a command with no time limit waits for its answer, also after a command that timed out", async () => {
  // The answer takes longer than the limit for commands after a timed-out one.
  const { monitor } = await fakeTextMonitor((command) => (command === "lost" ? DROP : { parts: ["late\n", "answer\n"], gapMs: 100 }));
  monitor.resendAfterMs = 60_000;
  monitor.overdueTimeoutMs = 20;
  await assert.rejects(monitor.command("lost", 50), TextMonitorError);
  assert.equal(await monitor.command("drain", Infinity), "late\nanswer");
  await monitor.close();
});

test("a held sentinel's second answer that arrives in parts never reaches the next command's output", async () => {
  // Stock VICE, seen on a slow CI runner: the first sentinel is held, the resend
  // releases it, and VICE prints a second answer whose last line comes only after
  // the client has sent its next command.
  const hex = { first: "", sentinels: 0 };
  let tailWritten: Promise<void> = Promise.resolve();
  const server = createServer((socket) => {
    let pending = "";
    socket.on("data", (chunk) => {
      pending += chunk.toString("latin1");
      let newline: number;
      while ((newline = pending.indexOf("\n")) >= 0) {
        const line = pending.slice(0, newline);
        pending = pending.slice(newline + 1);
        const sentinel = /^~ \$([0-9a-f]{4})$/.exec(line);
        if (sentinel === null) {
          // A command runs after whatever VICE is still printing.
          void tailWritten.then(() => socket.write(`${line} done\n(C:$fd6e) `));
          continue;
        }
        if (hex.first === "") hex.first = sentinel[1]!;
        if (sentinel[1] !== hex.first) {
          void tailWritten.then(() => socket.write(sentinelAnswer(sentinel[1]!)));
          continue;
        }
        if (++hex.sentinels === 1) continue; // held
        const answer = sentinelAnswer(hex.first);
        const cut = answer.indexOf("%");
        socket.write(answer + answer.slice(0, cut));
        tailWritten = new Promise((resolve) =>
          setTimeout(() => {
            socket.write(answer.slice(cut));
            resolve();
          }, 60),
        );
      }
    });
    socket.on("error", () => {});
  });
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const monitor = await TextMonitor.connect((server.address() as { port: number }).port);
  monitor.sentinelResendMs = 20;
  try {
    assert.equal(await monitor.command("warp"), "warp done");
    assert.equal(hex.sentinels, 2, "the first sentinel was held and sent again");
    assert.equal(await monitor.command("warp off"), "warp off done");
  } finally {
    await monitor.close();
  }
});
