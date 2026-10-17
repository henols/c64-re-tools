// The c64-testing play page with a fake replay core: the start screen is
// frozen until Start, End freezes the machine again, and Cancel ends the
// session without a recording.

import assert from "node:assert/strict";
import { test } from "node:test";

import { play } from "../../skills/c64-testing/scripts/lib/play.ts";
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

/** Starts play() on a free port and opens its event stream. */
async function open(core: FakeCore) {
  let url = "";
  const session = play(core, { httpPort: 0, joystick: 2, ready: (address) => (url = address) });
  let settled: string | undefined;
  void session.then((result) => (settled = result));
  await until(() => url !== "", "the page address");
  const post = async (path: string) => (await fetch(url + path, { method: "POST" })).status;
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
  for (const id of ["start", "end", "cancel"]) assert.match(html, new RegExp('<button id="' + id + '"'));
  await until(() => page.events().includes("data: 2 1 AAE="), "the start frame");
  assert.match(page.events(), /event: palette\ndata: 000000 ffffff\n\n/);
  assert.match(page.events(), /event: state\ndata: waiting\n\n/);

  assert.equal(await page.post("joystick?mask=1"), 409);
  assert.equal(await page.post("key?name=A&down=1"), 409);
  assert.equal(await page.post("end"), 409);
  await sleep(100);
  assert.deepEqual(core.runs(), [], "no frame runs before Start");
  assert.equal(core.log.some((line) => line.startsWith("joy") || line.startsWith("key")), false);
  assert.equal(page.settled(), undefined, "End before Start does not end the session");

  assert.equal(await page.post("cancel"), 204);
  assert.equal(await page.session, "cancelled");
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
  assert.equal(await page.post("key?name=A&down=1"), 204);
  await until(() => core.log.includes("key 41 down"), "the key");

  assert.equal(await page.post("end"), 204);
  const frozen = core.runs().length;
  assert.equal(await page.session, "ended");
  assert.equal(core.runs().length, frozen, "no frame runs after End");
  assert.equal(core.log.at(-1), "joy 0 0");
  assert.match(page.events(), /event: state\ndata: ended\n\n/);
  assert.equal(await page.post("cancel").catch(() => "closed"), "closed", "the server is closed");
});

test("Cancel during play ends the session without another frame", async () => {
  const core = new FakeCore();
  const page = await open(core);
  assert.equal(await page.post("start"), 204);
  await until(() => core.runs().length >= 2, "two frames");
  assert.equal(await page.post("cancel"), 204);
  const frozen = core.runs().length;
  assert.equal(await page.session, "cancelled");
  assert.equal(core.runs().length, frozen);
  assert.match(page.events(), /event: state\ndata: cancelled\n\n/);
});
