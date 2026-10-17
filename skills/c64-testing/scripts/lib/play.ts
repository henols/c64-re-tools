// A person plays the program in the replay core: a page on localhost shows
// the screen and sends the keyboard and gamepad. The core runs one frame each
// 20 ms. The reads of the program keep the input, so the recording needs
// nothing from the page. Stop on the page ends the session.

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
</style></head><body>
<canvas id="screen" width="392" height="272"></canvas>
<div>Joystick: arrow keys and space, or a gamepad. Other keys go to the C64 keyboard. <span id="state">connecting</span></div>
<button id="stop">Stop and save the recording</button>
<script>
const canvas = document.getElementById("screen"), context = canvas.getContext("2d"), state = document.getElementById("state");
let palette = [], image = context.createImageData(392, 272), frames = 0;
const source = new EventSource("frames");
source.addEventListener("palette", (event) => { palette = event.data.split(" ").map((hex) => [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16))); });
source.onmessage = (event) => {
  const [width, height, data] = event.data.split(" ");
  if (image.width != width) { canvas.width = width; canvas.height = height; image = context.createImageData(+width, +height); }
  const bytes = atob(data);
  for (let at = 0; at < bytes.length; at++) { const rgb = palette[bytes.charCodeAt(at)] || [0, 0, 0]; image.data.set(rgb, at * 4); image.data[at * 4 + 3] = 255; }
  context.putImageData(image, 0, 0);
  state.textContent = "frame " + ++frames;
};
source.onerror = () => { state.textContent = "the session ended"; };
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
  if (mask !== sent) { sent = mask; send("joystick?mask=" + mask); }
  requestAnimationFrame(joystick);
}
requestAnimationFrame(joystick);
function key(event, down) {
  if (event.key in bits) { event.preventDefault(); down ? held.add(event.key) : held.delete(event.key); return; }
  const name = event.key.length === 1 ? event.key.toUpperCase() : event.key;
  if (name.length === 1 || /^(Enter|Backspace|Escape|F[1-8])$/.test(name)) { event.preventDefault(); if (!event.repeat) send("key?name=" + encodeURIComponent(name) + "&down=" + (down ? 1 : 0)); }
}
addEventListener("keydown", (event) => key(event, true));
addEventListener("keyup", (event) => key(event, false));
document.getElementById("stop").onclick = () => { send("stop"); state.textContent = "saving"; };
</script></body></html>`;

/** The key code of a key name from the page, or undefined for a key that the C64 does not have. */
function keyCode(name: string): number | undefined {
  if (name in KEYS) return KEYS[name];
  return name.length === 1 && /[A-Z0-9 +\-.:@,*;=/!"#$%&'()[\]<>?]/.test(name) ? name.charCodeAt(0) : undefined;
}

/** Runs the core in real time with the page as its joystick and keyboard, until Stop. */
export async function play(core: C64RunSession, options: PlayOptions): Promise<void> {
  const palette = (await core.command("palette")).split(" ").slice(1).join(" ");
  const viewers = new Set<ServerResponse>();
  const pending: string[] = [];
  let mask = 0;
  let stop: () => void = () => {};
  const stopped = new Promise<void>((resolve) => (stop = resolve));
  const server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://localhost");
    if (request.method === "GET" && url.pathname === "/") {
      response.writeHead(200, { "content-type": "text/html; charset=utf-8" }).end(PAGE);
    } else if (request.method === "GET" && url.pathname === "/frames") {
      response.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store" });
      response.write(`event: palette\ndata: ${palette}\n\n`);
      viewers.add(response);
      request.on("close", () => viewers.delete(response));
    } else if (request.method === "POST" && url.pathname === "/joystick") {
      mask = Number(url.searchParams.get("mask")) & 0x1f;
      response.writeHead(204).end();
    } else if (request.method === "POST" && url.pathname === "/key") {
      const code = keyCode(url.searchParams.get("name") ?? "");
      if (code !== undefined) pending.push(`key ${code.toString(16)} ${url.searchParams.get("down") === "1" ? "down" : "up"}`);
      response.writeHead(204).end();
    } else if (request.method === "POST" && url.pathname === "/stop") {
      response.writeHead(204).end();
      stop();
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(options.httpPort, "127.0.0.1", resolve));
  const address = server.address();
  options.ready(`http://localhost:${typeof address === "object" && address !== null ? address.port : options.httpPort}/`);
  let running = true;
  void stopped.then(() => (running = false));
  let tick = (await core.status("status")).tick;
  let sent = -1;
  try {
    while (running) {
      const started = Date.now();
      if (mask !== sent) {
        await core.command(options.joystick === 1 ? `joy ${mask.toString(16)} 0` : `joy 0 ${mask.toString(16)}`);
        sent = mask;
      }
      while (pending.length > 0) await core.command(pending.shift()!);
      tick += PAL_FRAME_CYCLES;
      await core.status(`run ${tick}`);
      if (viewers.size > 0) {
        const frame = (await core.command("frame")).slice(3);
        for (const viewer of viewers) viewer.write(`data: ${frame}\n\n`);
      }
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, FRAME_MS - (Date.now() - started))));
    }
  } finally {
    await core.command("joy 0 0");
    for (const viewer of viewers) viewer.end();
    await new Promise((resolve) => server.close(resolve));
  }
}
