// The retro-testing play page with a fake replay core: the start screen is
// frozen until Start, End freezes the machine again, Cancel ends the session
// without a recording, F9 changes the joystick port, the key maps send only
// C64 keys, and RESTORE goes to the event of the recording.

import assert from "node:assert/strict";
import { networkInterfaces } from "node:os";
import { after, test } from "node:test";

import { CANCELLED, KEY_MAPS, play } from "../../skills/retro-testing/scripts/lib/play.ts";
import { MATRIX_KEYS } from "../../src/c64-keys.ts";
import { PAL_FRAME_CYCLES, type C64RunSession, type CoreStatus } from "../../src/native/c64run.ts";

/** A core that logs each command; a run moves its tick. */
class FakeCore implements Pick<C64RunSession, "command" | "status"> {
  readonly log: string[] = [];
  tick = 1000;

  async command(text: string): Promise<string> {
    this.log.push(text);
    if (text === "palette") return "ok 000000 ffffff";
    if (text === "frame") return "ok 2 1 AAE=";
    return "ok";
  }

  async status(text: string): Promise<CoreStatus> {
    this.log.push(text);
    if (text.startsWith("run ")) this.tick = Number(text.slice(4));
    return { tick: this.tick, sync: true, pc: 0, a: 0, x: 0, y: 0, s: 0, p: 0, line: 0, cycle: 0, hash: "0" };
  }

  runs(): number[] {
    return this.log.filter((line) => line.startsWith("run ")).map((line) => Number(line.slice(4)));
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Waits for a check; a full suite under load can be slow, so the limit is 10 s. `seen` tells what came instead. */
async function until(check: () => boolean, what: string, seen?: () => string): Promise<void> {
  const limit = Date.now() + 10_000;
  while (Date.now() < limit) {
    if (check()) return;
    await sleep(10);
  }
  assert.fail("timed out: " + what + (seen === undefined ? "" : "; the event stream ends with " + JSON.stringify(seen().slice(-400))));
}

/** The sessions that a failed test left open: Cancel closes their servers, so that the run ends. */
const opened: Array<(path: string) => Promise<number>> = [];
after(async () => {
  for (const post of opened) await post("cancel").catch(() => 0);
});

/** Starts play() on a free port and opens its event stream. */
async function open(core: FakeCore, options: { joystick?: 1 | 2; restore?: () => Promise<string | undefined> } = {}) {
  let url = "";
  const session = play(core, { httpPort: 0, joystick: options.joystick ?? 2, ready: (address) => (url = address), restore: options.restore ?? (async () => undefined) });
  let settled = false;
  void session.then(() => (settled = true));
  await until(() => url !== "", "the page address");
  const post = async (path: string) => (await fetch(url + path, { method: "POST" })).status;
  opened.push(post);
  const stream = await fetch(url + "frames");
  const reader = stream.body!.pipeThrough(new TextDecoderStream()).getReader();
  let events = "";
  void (async () => {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      events += value;
    }
  })();
  return { url, session, post, events: () => events, settled: () => settled };
}

test("the page has Start, End and Cancel, and shows the start screen frozen until Start", async () => {
  const core = new FakeCore();
  const page = await open(core);
  const html = await (await fetch(page.url)).text();
  for (const id of ["start", "end", "cancel", "port", "arrows", "map"]) assert.match(html, new RegExp('<button id="' + id + '"'));
  assert.doesNotMatch(html, /__KEYS__/, "the page has the key maps");
  // A dev container forwards the port to an address of the container that is not loopback.
  const outside = Object.values(networkInterfaces()).flat().find((item) => item !== undefined && item.family === "IPv4" && !item.internal);
  if (outside !== undefined) assert.equal((await fetch(page.url.replace("localhost", outside.address))).status, 200, "the page answers on " + outside.address);
  await until(() => page.events().includes("data: 2 1 AAE="), "the start frame", page.events);
  assert.match(page.events(), /event: palette\ndata: 000000 ffffff\n\n/);
  assert.match(page.events(), /event: state\ndata: waiting\n\nevent: port\ndata: 2\n\n/);

  assert.equal(await page.post("joystick?mask=1"), 409);
  assert.equal(await page.post("key?keys=10&down=1"), 409);
  assert.equal(await page.post("restore"), 409);
  assert.equal(await page.post("end"), 409);
  await sleep(100);
  assert.deepEqual(core.runs(), [], "no frame runs before Start");
  assert.equal(core.log.some((line) => line.startsWith("joy") || line.startsWith("key")), false);
  assert.equal(page.settled(), false, "End before Start does not end the session");

  assert.equal(await page.post("cancel"), 204);
  assert.equal(await page.session, CANCELLED);
  assert.deepEqual(core.runs(), []);
});

test("Start runs a frame at a time with the page input, and End freezes the machine at once", async () => {
  const core = new FakeCore();
  const page = await open(core);
  await until(() => page.events().includes("data: waiting"), "the waiting state", page.events);

  assert.equal(await page.post("start"), 204);
  assert.equal(await page.post("start"), 409, "one session for each run");
  await until(() => core.runs().length >= 3, "three frames");
  assert.match(page.events(), /event: state\ndata: playing\n\n/);
  const runs = core.runs();
  for (const [index, tick] of runs.entries()) assert.equal(tick, 1000 + (index + 1) * PAL_FRAME_CYCLES);

  assert.equal(await page.post("joystick?mask=1"), 204);
  await until(() => core.log.includes("joy 0 1"), "the joystick of port 2");
  // Matrix place 10 is A (row 1, column 2); the core gets 80 + the place.
  assert.equal(await page.post("key?keys=10&down=1"), 204);
  await until(() => core.log.includes("key 8a down"), "the key");
  assert.equal(await page.post("key?keys=15,61&down=1"), 204, "the left SHIFT and C= together");
  await until(() => core.log.includes("key 8f down") && core.log.includes("key bd down"), "both keys");
  assert.equal(await page.post("key?keys=15,61&down=0"), 204);
  await until(() => core.log.includes("key 8f up") && core.log.includes("key bd up"), "both keys up");
  assert.equal(await page.post("key?keys=ff&down=1"), 400, "RESTORE is no key of the page: it is an event");
  assert.equal(await page.post("key?keys=64&down=1"), 400, "the matrix has 64 places");
  assert.equal(await page.post("key?keys=&down=1"), 400);

  assert.equal(await page.post("end"), 204);
  const frozen = core.runs().length;
  assert.equal(await page.session, undefined, "End: the recording is complete");
  assert.equal(core.runs().length, frozen, "no frame runs after End");
  assert.equal(core.log.at(-1), "joy 0 0");
  await until(() => page.events().includes("event: state\ndata: ended\n\n"), "the ended state on the page", page.events);
  assert.equal(await page.post("cancel").catch(() => "closed"), "closed", "the server is closed");
});

test("Cancel during play ends the session without another frame", async () => {
  const core = new FakeCore();
  const page = await open(core);
  assert.equal(await page.post("start"), 204);
  await until(() => core.runs().length >= 2, "two frames");
  assert.equal(await page.post("cancel"), 204);
  const frozen = core.runs().length;
  assert.equal(await page.session, CANCELLED);
  assert.equal(core.runs().length, frozen);
  await until(() => page.events().includes("event: state\ndata: cancelled\n\n"), "the cancelled state on the page", page.events);
});

test("the joystick starts on the given port, and F9 moves it to the other port", async () => {
  const core = new FakeCore();
  const page = await open(core, { joystick: 1 });
  await until(() => page.events().includes("data: waiting\n\nevent: port\ndata: 1"), "port 1 at the start", page.events);
  assert.equal(await page.post("port"), 204, "the port changes on the start screen too");
  await until(() => page.events().includes("event: port\ndata: 2"), "port 2", page.events);
  assert.equal(await page.post("port"), 204);
  assert.equal(await page.post("start"), 204);
  assert.equal(await page.post("joystick?mask=16"), 204);
  await until(() => core.log.includes("joy 10 0"), "fire on port 1");
  assert.equal(await page.post("port"), 204);
  await until(() => core.log.includes("joy 0 10"), "fire on port 2, port 1 released");
  assert.equal(await page.post("end"), 204);
  await page.session;
});

test("RESTORE runs the event of the recording, and the frames go on after it", async () => {
  const core = new FakeCore();
  let restores = 0;
  const page = await open(core, {
    restore: async () => {
      restores++;
      core.tick += 3 * PAL_FRAME_CYCLES;
      return undefined;
    },
  });
  assert.equal(await page.post("start"), 204);
  await until(() => core.runs().length >= 1, "a frame");
  assert.equal(await page.post("restore"), 204);
  await until(() => restores === 1, "the RESTORE event");
  const after = core.tick;
  await until(() => core.runs().some((tick) => tick > after), "a frame after the event");
  assert.equal(core.runs().filter((tick) => tick > after)[0], after + PAL_FRAME_CYCLES, "the next frame starts where the event ended");
  assert.equal(await page.post("end"), 204);
  assert.equal(await page.session, undefined);
});

test("a RESTORE that fails stops the session with its reason", async () => {
  const core = new FakeCore();
  const page = await open(core, { restore: async () => "RESTORE: the program did not read its input again within 600 frames" });
  assert.equal(await page.post("start"), 204);
  assert.equal(await page.post("restore"), 204);
  assert.equal(await page.session, "RESTORE: the program did not read its input again within 600 frames");
  await until(() => page.events().includes("event: state\ndata: failed\n\n"), "the failed state on the page", page.events);
});

test("the key maps send matrix places: SHIFT alone only in the positional map, shifted letters in the symbolic map", () => {
  const { LSHIFT, RSHIFT, A, CTRL, CBM, HOME, POUND, UPARROW, SPACE } = MATRIX_KEYS as Record<string, number>;
  assert.deepEqual(KEY_MAPS.positional.ShiftLeft, [LSHIFT]);
  assert.deepEqual(KEY_MAPS.positional.ShiftRight, [RSHIFT]);
  assert.deepEqual(KEY_MAPS.positional.KeyA, [A]);
  assert.deepEqual(KEY_MAPS.positional.Minus, [MATRIX_KEYS["+"]], "the C64 + is right of 0");
  assert.deepEqual(KEY_MAPS.positional.Delete, [UPARROW], "the up arrow");
  assert.equal("ShiftLeft" in KEY_MAPS.symbolic, false);
  assert.deepEqual(KEY_MAPS.symbolic.a, [A], "a is the C64 letter");
  assert.deepEqual(KEY_MAPS.symbolic.A, [A, LSHIFT], "A is the letter with SHIFT");
  assert.deepEqual(KEY_MAPS.symbolic["!"], [LSHIFT, MATRIX_KEYS["1"]], "! is SHIFT and 1");
  assert.deepEqual(KEY_MAPS.symbolic["£"], [POUND]);
  assert.deepEqual(KEY_MAPS.symbolicShift.Home, [LSHIFT, HOME], "SHIFT+Home is CLR");
  assert.deepEqual(KEY_MAPS.both, { Tab: [CTRL], AltLeft: [CBM] });
  assert.deepEqual(KEY_MAPS.arrows.Space, [SPACE]);
  for (const map of Object.values(KEY_MAPS)) for (const keys of Object.values(map)) assert.ok(keys.length > 0 && keys.every((key) => key >= 0 && key < 64), "matrix places only: RESTORE is an event, not a key");
});
