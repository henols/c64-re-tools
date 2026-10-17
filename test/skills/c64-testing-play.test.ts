// The c64-testing play page with a fake replay core: the start screen is
// frozen until Start, End freezes the machine again, Cancel ends the session
// without a recording, F9 changes the joystick port, the key maps send only
// C64 keys, and RESTORE goes to the event of the recording.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { CANCELLED, KEY_MAPS, play } from "../../skills/c64-testing/scripts/lib/play.ts";
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

async function until(check: () => boolean, what: string): Promise<void> {
  for (let at = 0; at < 200; at++) {
    if (check()) return;
    await sleep(10);
  }
  assert.fail("timed out: " + what);
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
  await until(() => page.events().includes("data: 2 1 AAE="), "the start frame");
  assert.match(page.events(), /event: palette\ndata: 000000 ffffff\n\n/);
  assert.match(page.events(), /event: state\ndata: waiting\n\nevent: port\ndata: 2\n\n/);

  assert.equal(await page.post("joystick?mask=1"), 409);
  assert.equal(await page.post("key?code=41&down=1"), 409);
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
  await until(() => page.events().includes("data: waiting"), "the waiting state");

  assert.equal(await page.post("start"), 204);
  assert.equal(await page.post("start"), 409, "one session for each run");
  await until(() => core.runs().length >= 3, "three frames");
  assert.match(page.events(), /event: state\ndata: playing\n\n/);
  const runs = core.runs();
  for (const [index, tick] of runs.entries()) assert.equal(tick, 1000 + (index + 1) * PAL_FRAME_CYCLES);

  assert.equal(await page.post("joystick?mask=1"), 204);
  await until(() => core.log.includes("joy 0 1"), "the joystick of port 2");
  assert.equal(await page.post("key?code=41&down=1"), 204);
  await until(() => core.log.includes("key 41 down"), "the key");
  assert.equal(await page.post("key?code=11&down=1"), 204, "the left SHIFT alone");
  await until(() => core.log.includes("key 11 down"), "the left SHIFT");
  assert.equal(await page.post("key?code=ff&down=1"), 400, "RESTORE is no key of the page: it is an event");
  assert.equal(await page.post("key?code=zz&down=1"), 400);

  assert.equal(await page.post("end"), 204);
  const frozen = core.runs().length;
  assert.equal(await page.session, undefined, "End: the recording is complete");
  assert.equal(core.runs().length, frozen, "no frame runs after End");
  assert.equal(core.log.at(-1), "joy 0 0");
  await until(() => page.events().includes("event: state\ndata: ended\n\n"), "the ended state on the page");
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
  await until(() => page.events().includes("event: state\ndata: cancelled\n\n"), "the cancelled state on the page");
});

test("the joystick starts on the given port, and F9 moves it to the other port", async () => {
  const core = new FakeCore();
  const page = await open(core, { joystick: 1 });
  await until(() => page.events().includes("data: waiting\n\nevent: port\ndata: 1"), "port 1 at the start");
  assert.equal(await page.post("port"), 204, "the port changes on the start screen too");
  await until(() => page.events().includes("event: port\ndata: 2"), "port 2");
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
  await until(() => page.events().includes("event: state\ndata: failed\n\n"), "the failed state on the page");
});

test("the key maps send C64 keys: SHIFT alone only in the positional map, shifted letters in the symbolic map", () => {
  assert.equal(KEY_MAPS.positional.ShiftLeft, 0x11);
  assert.equal(KEY_MAPS.positional.ShiftRight, 0x12);
  assert.equal(KEY_MAPS.positional.KeyA, 0x41);
  assert.equal(KEY_MAPS.positional.Minus, 0x2b, "the C64 + is right of 0");
  assert.equal(KEY_MAPS.positional.Delete, 0x5e, "the up arrow");
  assert.equal("ShiftLeft" in KEY_MAPS.symbolic, false);
  assert.equal(KEY_MAPS.symbolic.a, 0x41, "a is the C64 letter");
  assert.equal(KEY_MAPS.symbolic.A, 0x61, "A is the letter with SHIFT");
  assert.equal(KEY_MAPS.symbolic["£"], 0x7e);
  assert.equal(KEY_MAPS.symbolicShift.Home, 0x02, "SHIFT+Home is CLR");
  assert.deepEqual(KEY_MAPS.both, { Tab: 0x0e, AltLeft: 0x0f });
  assert.equal(KEY_MAPS.arrows.Space, 0x20);
  for (const map of Object.values(KEY_MAPS)) for (const code of Object.values(map)) assert.notEqual(code, 0xff, "RESTORE is an event, not a key");
});
