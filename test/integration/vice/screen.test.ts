// Real-VICE checks for screen capture: the visible frame, and that it follows
// what the C64 draws.

import assert from "node:assert/strict";
import { after, test } from "node:test";

import { ProcessSupervisor } from "../../../src/host/processes.ts";
import type { ViceSessionHandle } from "../../../src/host/server.ts";
import { viceSessionFactory } from "../../../src/host/vice/session.ts";
import type { VideoStandard } from "../../../src/protocol.ts";
import { readPng } from "../../../src/host/vice/png.testkit.ts";
import { liveEnv, liveLog, liveSkip } from "./live.ts";

const sessions: ViceSessionHandle[] = [];
after(async () => {
  await Promise.all(sessions.map((session) => session.close()));
});

async function open(videoStandard: VideoStandard): Promise<ViceSessionHandle> {
  const supervisor = new ProcessSupervisor();
  supervisor.installExitGuard();
  const session = await viceSessionFactory({ supervisor, env: liveEnv(), log: liveLog })({ videoStandard });
  sessions.push(session);
  return session;
}

async function capture(session: ViceSessionHandle) {
  const shot = await session.handle("screenCapture", {});
  return { ...shot, image: readPng(Buffer.from(shot.png, "base64")) };
}

test("a PAL capture is the 384x272 bordered frame and follows the border colour", { skip: liveSkip, timeout: 90_000 }, async () => {
  const session = await open("pal");
  await session.handle("reset", { mode: "hard", run: true });
  const deadline = Date.now() + 20_000;
  // After the KERNAL draws the start screen: light blue border (14), blue window (6).
  let shot = await capture(session);
  while (shot.image.pixels[36 * 384 + 32] !== 6 && Date.now() < deadline) shot = await capture(session);
  assert.equal(shot.width, 384);
  assert.equal(shot.height, 272);
  assert.equal(shot.image.pixels[0], 14, "border");
  assert.equal(shot.image.pixels[36 * 384 + 32], 6, "window");
  assert.equal(shot.image.pixels[35 * 384 + 31], 14, "the pixel before the window is border");

  // Turn the border red; the next drawn frame shows it.
  await session.handle("execution", { action: "pause", space: "c64" });
  await session.handle("memoryWrite", { address: 0xd020, data: "02", space: "c64", view: "cpu" });
  await session.handle("execution", { action: "resume", space: "c64" });
  shot = await capture(session);
  while (shot.image.pixels[0] !== 2 && Date.now() < deadline + 10_000) shot = await capture(session);
  assert.equal(shot.image.pixels[0], 2);
  assert.deepEqual(shot.image.palette[2]!.length, 3);
  assert.equal((await session.handle("status", {})).state, "running");
});

test("an NTSC capture is 384x247", { skip: liveSkip, timeout: 90_000 }, async () => {
  const session = await open("ntsc");
  const shot = await capture(session);
  assert.equal(shot.width, 384);
  assert.equal(shot.height, 247);
});
