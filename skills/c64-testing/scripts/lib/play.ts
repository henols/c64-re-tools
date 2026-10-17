// A person plays the program in the replay core: a page on localhost shows
// the screen and sends the keyboard and gamepad. The machine is frozen at the
// start screen until Start on the page; then the core runs one frame each
// 20 ms. End freezes it again and the recording is saved; Cancel ends the
// session without one. The reads of the program keep the input, so the
// recording needs nothing from the page.

import { createServer, type ServerResponse } from "node:http";

import { PAL_FRAME_CYCLES, type C64RunSession } from "#src/native/c64run.ts";

const FRAME_MS = 20;

export interface PlayOptions {
  /** The TCP port of the page; 0 takes a free one. */
  httpPort: number;
  /** The control port that the arrow keys, space and the gamepad move. */
  joystick: 1 | 2;
  /** Called with the address of the page when it listens. */
  ready: (url: string) => void;
}

/** The C64 keys of the page: KeyboardEvent.key → the key code of the replay core. */
const KEYS: Record<string, number> = { Enter: 0x0d, Backspace: 0x01, F1: 0xf1, F2: 0xf2, F3: 0xf3, F4: 0xf4, F5: 0xf5, F6: 0xf6, F7: 0xf7, F8: 0xf8, Escape: 0x03 };

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>c64-testing record</title>
<style>
body{margin:0;background:#111;color:#ddd;font:14px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px}
canvas{image-rendering:pixelated;width:min(784px,100%);aspect-ratio:392/272;background:#000}
button{font:inherit;padding:6px 16px}
.buttons{display:flex;gap:12px}
</style></head><body>
<canvas id="screen" width="392" height="272"></canvas>
<div>Joystick: arrow keys and space, or a gamepad. Other keys go to the C64 keyboard. <span id="state">connecting</span></div>
<div class="buttons"><button id="start" disabled>Start</button><button id="end" disabled>End and save the recording</button><button id="cancel" disabled>Cancel</button></div>
<script>
const canvas = document.getElementById("screen"), context = canvas.getContext("2d"), state = document.getElementById("state");
const start = document.getElementById("start"), end = document.getElementById("end"), cancel = document.getElementById("cancel");
let palette = [], image = context.createImageData(392, 272), frames = 0, phase = "connecting";
function show() {
  start.disabled = phase !== "waiting";
  end.disabled = phase !== "playing";
  cancel.disabled = phase !== "waiting" && phase !== "playing";
  if (phase === "waiting") state.textContent = "frozen at the start: press Start to play";
  else if (phase === "playing") state.textContent = "frame " + frames;
  else if (phase === "ended") state.textContent = "frozen at frame " + frames + ": the recording is saved by the script";
  else if (phase === "cancelled") state.textContent = "cancelled: no recording is saved";
  else state.textContent = phase;
}
const source = new EventSource("frames");
source.addEventListener("palette", (event) => { palette = event.data.split(" ").map((hex) => [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16))); });
source.addEventListener("state", (event) => { phase = event.data; if (phase === "playing") sent = -1; show(); });
source.onmessage = (event) => {
  const [width, height, data] = event.data.split(" ");
  if (image.width != width) { canvas.width = width; canvas.height = height; image = context.createImageData(+width, +height); }
  const bytes = atob(data);
  for (let at = 0; at < bytes.length; at++) { const rgb = palette[bytes.charCodeAt(at)] || [0, 0, 0]; image.data.set(rgb, at * 4); image.data[at * 4 + 3] = 255; }
  context.putImageData(image, 0, 0);
  if (phase === "playing") { frames++; show(); }
};
// The canvas keeps the last frame when the stream closes.
source.onerror = () => {
  source.close();
  if (phase !== "ended" && phase !== "cancelled") { phase = "the session ended"; show(); }
};
const held = new Set();
const bits = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 4, ArrowRight: 8, " ": 16 };
let sent = -1;
function send(path) { fetch(path, { method: "POST" }); }
function joystick() {
  let mask = 0;
  for (const key of held) mask |= bits[key] || 0;
  for (const pad of navigator.getGamepads ? navigator.getGamepads() : []) {
    if (!pad) continue;
    const [x, y] = pad.axes;
    if (y < -0.5 || pad.buttons[12]?.pressed) mask |= 1;
    if (y > 0.5 || pad.buttons[13]?.pressed) mask |= 2;
    if (x < -0.5 || pad.buttons[14]?.pressed) mask |= 4;
    if (x > 0.5 || pad.buttons[15]?.pressed) mask |= 8;
    if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) mask |= 16;
  }
  if (phase === "playing" && mask !== sent) { sent = mask; send("joystick?mask=" + mask); }
  requestAnimationFrame(joystick);
}
requestAnimationFrame(joystick);
function key(event, down) {
  if (event.key in bits) { event.preventDefault(); down ? held.add(event.key) : held.delete(event.key); return; }
  const name = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (name.length === 1 || /^(Enter|Backspace|Escape|F[1-8])$/.test(name)) { event.preventDefault(); if (!event.repeat && phase === "playing") send("key?name=" + encodeURIComponent(name) + "&down=" + (down ? 1 : 0)); }
}
addEventListener("keydown", (event) => key(event, true));
addEventListener("keyup", (event) => key(event, false));
start.onclick = () => send("start");
end.onclick = () => send("end");
cancel.onclick = () => send("cancel");
</script></body></html>`;

/** The key code of a key name from the page, or undefined for a key that the C64 does not have. */
function keyCode(name: string): number | undefined {
  if (name in KEYS) return KEYS[name];
  return name.length === 1 && /[A-Z0-9 +\-.:@,*;=/!"#$%&'()[\]<>?]/.test(name) ? name.charCodeAt(0) : undefined;
}

/** The phases of a session: the start screen, the play, then End or Cancel. */
type Phase = "waiting" | "playing" | "ended" | "cancelled";

/**
 * Shows the start screen frozen until Start, then runs the core in real time
 * with the page as its joystick and keyboard. End freezes the machine and gives
 * "ended"; Cancel gives "cancelled". No frame runs after End or Cancel.
 */
export async function play(core: Pick<C64RunSession, "command" | "status">, options: PlayOptions): Promise<"ended" | "cancelled"> {
  const palette = (await core.command("palette")).split(" ").slice(1).join(" ");
  const viewers = new Set<ServerResponse>();
  const pending: string[] = [];
  let mask = 0;
  // Not narrowed: the request handlers change it.
  let phase = "waiting" as Phase;
  let leaveWaiting: () => void = () => {};
  const leftWaiting = new Promise<void>((resolve) => (leaveWaiting = resolve));
  const tell = (viewer: ServerResponse) => viewer.write("event: state\ndata: " + phase + "\n\n");
  // The phase changes in the request handler, so the loop sees it before its next frame.
  const enter = (next: Phase) => {
    phase = next;
    for (const viewer of viewers) tell(viewer);
    leaveWaiting();
  };
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    const answer = (allowed: boolean, next?: Phase) => {
      if (!allowed) return void response.writeHead(409).end();
      if (next !== undefined) enter(next);
      response.writeHead(204).end();
    };
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    } else if (request.method === "GET" && url.pathname === "/frames") {
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      response.write("event: palette\ndata: " + palette + "\n\n");
      tell(response);
      viewers.add(response);
      request.on("close", () => viewers.delete(response));
      // The frozen start screen; in play, the loop sends each frame.
      if (phase === "waiting") {
        core.command("frame").then(
          (frame) => void response.write("data: " + frame.slice(3) + "\n\n"),
          () => {},
        );
      }
    } else if (request.method === "POST" && url.pathname === "/joystick") {
      if (phase === "playing") mask = Number(url.searchParams.get("mask")) & 0x1f;
      answer(phase === "playing");
    } else if (request.method === "POST" && url.pathname === "/key") {
      const code = keyCode(url.searchParams.get("name") ?? "");
      if (phase === "playing" && code !== undefined) pending.push("key " + code.toString(16) + " " + (url.searchParams.get("down") === "1" ? "down" : "up"));
      answer(phase === "playing");
    } else if (request.method === "POST" && url.pathname === "/start") {
      answer(phase === "waiting", "playing");
    } else if (request.method === "POST" && url.pathname === "/end") {
      answer(phase === "playing", "ended");
    } else if (request.method === "POST" && url.pathname === "/cancel") {
      answer(phase === "waiting" || phase === "playing", "cancelled");
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(options.httpPort, "127.0.0.1", resolve));
  const address = server.address();
  options.ready("http://localhost:" + (typeof address === "object" && address !== null ? address.port : options.httpPort) + "/");
  let tick = (await core.status("status")).tick;
  let sent = -1;
  try {
    await leftWaiting;
    while (phase === "playing") {
      const started = Date.now();
      if (mask !== sent) {
        await core.command(options.joystick === 1 ? "joy " + mask.toString(16) + " 0" : "joy 0 " + mask.toString(16));
        sent = mask;
      }
      while (pending.length > 0) await core.command(pending.shift()!);
      // End or Cancel while the input went in: the machine stays at the frame on the page.
      if (phase !== "playing") break;
      tick += PAL_FRAME_CYCLES;
      await core.status("run " + tick);
      if (viewers.size > 0) {
        const frame = (await core.command("frame")).slice(3);
        for (const viewer of viewers) viewer.write("data: " + frame + "\n\n");
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, FRAME_MS - (Date.now() - started))));
    }
  } finally {
    await core.command("joy 0 0");
    for (const viewer of viewers) viewer.end();
    await new Promise((resolve) => server.close(resolve));
  }
  return phase === "cancelled" ? "cancelled" : "ended";
}
