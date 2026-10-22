// Real-VICE checks for keys of the keyboard matrix and RESTORE: a press
// patches a snapshot and restores it. A VICE with bug #2202 refuses press.

import assert from "node:assert/strict";
import { after, before, test } from "node:test";

import { keyTaps, type KeyTap } from "../../../src/c64-keys.ts";
import { textToPetscii } from "../../../src/c64.ts";
import { viceFlaws, type ViceFlaw } from "../../../src/native/discover.ts";
import { ProcessSupervisor } from "../../../src/native/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { checkViceStarts } from "../../../src/host/vice/process.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import { buildD64 } from "../../fixtures/d64.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

let session: ViceSessionHandle;
let flaws: ViceFlaw[] = [];
before(async () => {
  if (liveSkip !== false) return;
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  flaws = viceFlaws(await checkViceStarts({ supervisor, env: liveEnv() }));
  session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog, flaws })({ videoStandard: "pal" });
});
after(async () => {
  await session?.close();
});

const flawed = () => flaws.some((flaw) => flaw.breaks.includes("keyboard"));
const press = (keys: string, frames = 3) => session.handle("press", { taps: keyTaps(keys) as KeyTap[], frames });
const read = async (address: number, size: number) => Buffer.from((await session.handle("memoryRead", { address, size, space: "c64", view: "ram" })).data, "hex");
const write = (address: number, data: string) => session.handle("memoryWrite", { address, data, space: "c64", view: "ram" });
const frames = (count: number) => session.handle("execution", { action: "advance-frames", count, space: "c64" });
const type = (text: string) => session.handle("keyboard", { data: Buffer.from(textToPetscii(text)).toString("hex") });

/** The text screen at $0400 as rows of characters (screen codes 1-26 shown as A-Z). */
async function screenText(): Promise<string> {
  const bytes = await read(0x0400, 1000);
  let text = "";
  for (let row = 0; row < 25; row++) {
    for (const code of bytes.subarray(row * 40, row * 40 + 40)) text += code < 32 ? String.fromCharCode(code + 64) : String.fromCharCode(code);
    text += "\n";
  }
  return text;
}

/** Runs frames until `check` passes. */
async function framesUntil(check: () => Promise<boolean>, what: string, limit = 60): Promise<void> {
  for (let tries = 0; !(await check()); tries++) {
    if (tries >= limit) throw new Error(`${what} did not happen in ${limit * 25} frames. The screen:\n${await screenText()}`);
    await frames(25);
  }
}

/**
 * $c000: SEI, the NMI vector to $c080, CIA 1 port A out and port B in. The
 * loop scans the 8 rows into $c100-$c107 and ANDs each scan into
 * $c108-$c10f, so a key that was down at any time stays 0 there. $c080
 * counts each NMI in $c1ff.
 */
async function startScanner(): Promise<void> {
  await session.handle("reset", { mode: "hard", run: true });
  await frames(150);
  await write(0xc000, "78a9808d1803a9c08d1903a9ff8d02dca9008d03dc" + "a200bdf0c08d00dcad01dc9d00c13d08c19d08c1e8e008d0e94c15c0");
  await write(0xc080, "eeffc140");
  await write(0xc0f0, "fefdfbf7efdfbf7f");
  await write(0xc108, "ff".repeat(8));
  await write(0xc1ff, "00");
  await session.handle("registersSet", { space: "c64", values: { pc: 0xc000 } });
  await frames(2);
}

/** The rows that had a key down at any time during the press, and the rows after it. */
async function seen(keys: string): Promise<{ during: string; after: string }> {
  await write(0xc108, "ff".repeat(8));
  assert.equal((await press(keys)).taps, (keyTaps(keys) as KeyTap[]).length);
  return { during: (await read(0xc108, 8)).toString("hex"), after: (await read(0xc100, 8)).toString("hex") };
}

test("a press holds keys of the matrix, alone and together, and releases them", { skip: liveSkip, timeout: 120_000 }, async (t) => {
  if (flawed()) return t.skip("this VICE has bug #2202: see the refusal test");
  await startScanner();
  assert.equal((await read(0xc100, 8)).toString("hex"), "ffffffffffffffff", "no key");
  // F1: row 0, column 4. All keys are up again after the press.
  assert.deepEqual(await seen("{F1}"), { during: "efffffffffffffff", after: "ffffffffffffffff" });
  // The left SHIFT (row 1, column 7) and C= (row 7, column 5) together.
  assert.deepEqual(await seen("{LSHIFT+CBM}"), { during: "ff7fffffffffffdf", after: "ffffffffffffffff" });
  // F2 is the left SHIFT and F1; two taps give both F1 and F3 (row 0, column 5).
  assert.equal((await seen("{F2}")).during, "ef7fffffffffffff");
  assert.equal((await seen("{F1}{F3}")).during, "cfffffffffffffff");
  assert.equal((await read(0xc1ff, 1))[0], 0, "no NMI without RESTORE");
});

test("RESTORE gives exactly one NMI, and STOP+RESTORE stops a BASIC program", { skip: liveSkip, timeout: 120_000 }, async (t) => {
  if (flawed()) return t.skip("this VICE has bug #2202: see the refusal test");
  await startScanner();
  assert.deepEqual(await press("{RESTORE}"), { taps: 1, state: "stopped" });
  assert.equal((await read(0xc1ff, 1))[0], 1);
  await session.handle("execution", { action: "resume", space: "c64" });
  assert.deepEqual(await press("{RESTORE}", 1), { taps: 1, state: "running" }, "a running machine runs again");
  await session.handle("execution", { action: "pause", space: "c64" });
  assert.equal((await read(0xc1ff, 1))[0], 2);

  await session.handle("reset", { mode: "hard", run: true });
  await framesUntil(async () => (await screenText()).includes("READY."), "the READY prompt");
  await type("10 goto 10\nrun\n");
  await frames(50);
  assert.doesNotMatch(await screenText(), /RUN *\n *READY\./, "the program runs");
  await press("{STOP+RESTORE}");
  // The warm start clears the screen and shows READY. at the top.
  await framesUntil(async () => /^\s*READY\./.test(await screenText()), "the warm start");
  assert.equal((await read(0x0801, 9)).toString("hex"), "0a080a008920313000", "the program stays in memory");
});

test("a press keeps the disk in the drive: a LOAD after it works", { skip: liveSkip, timeout: 180_000 }, async (t) => {
  if (flawed()) return t.skip("this VICE has bug #2202: see the refusal test");
  await session.handle("reset", { mode: "hard", run: true });
  await framesUntil(async () => (await screenText()).includes("READY."), "the READY prompt");
  const prg = Uint8Array.of(0x01, 0x08, 0x0a, 0x08, 0x0a, 0x00, 0x89, 0x20, 0x31, 0x30, 0x00, 0x00, 0x00);
  assert.deepEqual(await session.handle("diskAttach", { type: "d64" }, [buildD64([{ name: "HELLO", bytes: prg }])]), { attached: true });
  await press("{SPACE}");
  await type('load"hello",8\n');
  await framesUntil(async () => /LOADING *\n *READY\./.test(await screenText()), "the LOAD");
  assert.equal((await read(0x0801, 9)).toString("hex"), "0a080a008920313000");
});

test("press refuses on a VICE with bug #2202", { skip: liveSkip, timeout: 60_000 }, async (t) => {
  if (!flawed()) return t.skip("this VICE has the fix of bug #2202");
  await assert.rejects(press("{F1}"), { code: "not-implemented", message: /^Keys of the keyboard matrix are not implemented in this setup\./ });
});
