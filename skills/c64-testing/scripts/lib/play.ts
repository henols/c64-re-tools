// A person plays the program in the replay core: a page shows the screen and sends the keyboard and gamepad. The machine is frozen at the
// start screen until Start on the page; then the core runs one frame each
// 20 ms. End freezes it again and the recording is saved; Cancel ends the
// session without one. The reads of the program keep the input, so the
// recording needs nothing from the page. RESTORE is no read: it is an event
// of the recording (see record in recording.ts). The page listens on every
// address: the port that a dev container publishes to the host needs that.

import { createServer, type ServerResponse } from "node:http";

import { PAL_FRAME_CYCLES, type C64RunSession } from "#src/native/c64run.ts";
import { C64_KEYS, F_KEYS } from "./keys.ts";

const FRAME_MS = 20;

/** The reason that play gives when the user clicks Cancel. */
export const CANCELLED = "the user cancelled the session on the page";

export interface PlayOptions {
  /** The TCP port of the page; 0 takes a free one. */
  httpPort: number;
  /** The control port that the joystick keys and the gamepad move first; F9 on the page changes it. */
  joystick: 1 | 2;
  /** Called with the address of the page when it listens. */
  ready: (url: string) => void;
  /** Presses RESTORE as an event of the recording. A reason stops the session. */
  restore: () => Promise<string | undefined>;
}

const C64 = C64_KEYS;
const LETTERS = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"];
const DIGITS = [..."0123456789"];
const code = (character: string) => character.charCodeAt(0);

/**
 * The key maps of the page. Each one maps a KeyboardEvent property to a key code.
 * The symbolic map (event.key) gives the character on the PC key; the positional
 * map (event.code) gives the C64 key at the place of the PC key, with each SHIFT alone.
 */
export const KEY_MAPS = {
  /** event.code, in both maps. */
  both: { Tab: C64.ctrl, AltLeft: C64.cbm },
  /** event.code, when the arrow keys and space are keyboard keys. */
  arrows: { ArrowUp: C64.csrUp, ArrowDown: C64.csrDown, ArrowLeft: C64.csrLeft, ArrowRight: C64.csrRight, Space: C64.space },
  /** event.code */
  positional: {
    ...Object.fromEntries(LETTERS.map((letter) => ["Key" + letter, code(letter)])),
    ...Object.fromEntries(DIGITS.map((digit) => ["Digit" + digit, code(digit)])),
    ...Object.fromEntries(F_KEYS.map((key, index) => ["F" + (index + 1), key])),
    Backquote: C64.leftArrow, Minus: code("+"), Equal: code("-"), Insert: C64.pound, Home: C64.home, Backspace: C64.del,
    BracketLeft: code("@"), BracketRight: code("*"), Delete: C64.upArrow,
    Escape: C64.stop, Semicolon: code(":"), Quote: code(";"), Backslash: code("="), Enter: C64.return,
    ShiftLeft: C64.leftShift, ShiftRight: C64.rightShift, Comma: code(","), Period: code("."), Slash: code("/"),
  } as Record<string, number>,
  /** event.key; a-z are the C64 letters, A-Z the letters with SHIFT. */
  symbolic: {
    ...Object.fromEntries(LETTERS.flatMap((letter) => [[letter.toLowerCase(), code(letter)], [letter, code(letter.toLowerCase())]])),
    ...Object.fromEntries([...DIGITS, ..."+-.:@,*;=/!\"#$%&'()[]<>?"].map((character) => [character, code(character)])),
    ...Object.fromEntries(F_KEYS.map((key, index) => ["F" + (index + 1), key])),
    "£": C64.pound, "^": C64.upArrow, "`": C64.leftArrow,
    Enter: C64.return, Backspace: C64.del, Delete: C64.del, Insert: C64.inst, Home: C64.home, Escape: C64.stop,
  } as Record<string, number>,
  /** event.key with SHIFT held, in the symbolic map. */
  symbolicShift: { Home: C64.clr, Backspace: C64.inst, Escape: C64.run, F1: 0xf2, F3: 0xf4, F5: 0xf6, F7: 0xf8 } as Record<string, number>,
};

/** The key codes that the page can send: every code of the key maps. */
const PAGE_KEYS = new Set(Object.values(KEY_MAPS).flatMap((map) => Object.values(map)));

const PAGE = String.raw`<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>c64-testing record</title>
<style>
body{margin:0;background:#111;color:#ddd;font:14px system-ui,sans-serif;display:flex;flex-direction:column;align-items:center;gap:12px;padding:16px}
canvas{image-rendering:pixelated;width:min(784px,100%);aspect-ratio:392/272;background:#000}
button{font:inherit;font-size:12px;padding:3px 8px}
.row{display:flex;flex-wrap:wrap;gap:6px;align-items:center;justify-content:center}
.gap{width:12px}
table{border-collapse:collapse;font-size:13px}td{padding:2px 10px;border-top:1px solid #333}
</style></head><body>
<div class="row"><button id="start" disabled>Start (Enter)</button><button id="end" disabled>End and save (F12)</button><button id="cancel" disabled>Cancel (F11)</button><span class="gap"></span><button id="port">Port 2 (F9)</button><button id="arrows">Arrows: joystick (F10)</button><button id="map">Keys: symbolic</button></div>
<canvas id="screen" width="392" height="272"></canvas>
<div id="state">connecting</div>
<table>
<tr><td>Start, End, Cancel</td><td>Enter (on the start screen), F12, F11</td></tr>
<tr><td>Joystick</td><td>arrow keys and space (when F10 sets joystick), or a gamepad</td></tr>
<tr><td>RUN/STOP, RESTORE</td><td>Esc, Page Up</td></tr>
<tr><td>CTRL, C=</td><td>Tab, left Alt</td></tr>
<tr><td>CLR/HOME, INST/DEL</td><td>Home, Backspace</td></tr>
<tr><td>Symbolic map</td><td>the characters on the PC keys; £, ^ (up arrow) and the backquote (left arrow)</td></tr>
<tr><td>Positional map</td><td>the C64 keys at the places of the PC keys; each SHIFT alone; Insert £, Delete up arrow, the backquote left arrow</td></tr>
</table>
<script>
const KEYS = __KEYS__;
const BITS = { ArrowUp: 1, ArrowDown: 2, ArrowLeft: 4, ArrowRight: 8, Space: 16 };
const $ = (id) => document.getElementById(id);
const canvas = $("screen"), context = canvas.getContext("2d"), state = $("state");
let palette = [], image = context.createImageData(392, 272), frames = 0, phase = "connecting", port = 2, arrows = "joystick", keyMap = "symbolic", sent = -1;
// The C64 key of each PC key that is down (by event.code), and the joystick keys that are down.
const pressed = new Map(), stick = new Set();
// One request at a time, so that the core gets each key down before its key up.
let queue = Promise.resolve();
function send(path) { queue = queue.then(() => fetch(path, { method: "POST" })).catch(() => {}); }
function show() {
  $("start").disabled = phase !== "waiting";
  $("end").disabled = phase !== "playing";
  $("cancel").disabled = phase !== "waiting" && phase !== "playing";
  $("port").textContent = "Port " + port + " (F9)";
  $("arrows").textContent = "Arrows: " + arrows + " (F10)";
  $("map").textContent = "Keys: " + keyMap;
  if (phase === "waiting") state.textContent = "Frozen at the start: read the screen, then press Start.";
  else if (phase === "playing") state.textContent = "Frame " + frames;
  else if (phase === "ended") state.textContent = "Frozen at frame " + frames + ". The script saves the recording.";
  else if (phase === "cancelled") state.textContent = "Cancelled. No recording is saved.";
  else if (phase === "failed") state.textContent = "The session stopped. The script output gives the reason. No recording is saved.";
  else state.textContent = phase;
}
function releaseAll() {
  for (const code of pressed.values()) send("key?code=" + code.toString(16) + "&down=0");
  pressed.clear();
  stick.clear();
}
const source = new EventSource("frames");
source.addEventListener("palette", (event) => { palette = event.data.split(" ").map((hex) => [0, 2, 4].map((at) => parseInt(hex.slice(at, at + 2), 16))); });
source.addEventListener("state", (event) => { phase = event.data; if (phase === "playing") sent = -1; show(); });
source.addEventListener("port", (event) => { port = +event.data; show(); });
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
  if (phase !== "ended" && phase !== "cancelled" && phase !== "failed") { phase = "the session ended"; show(); }
};
function joystick() {
  let mask = 0;
  for (const key of stick) mask |= BITS[key];
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
function c64Key(event) {
  if (event.code in KEYS.both) return KEYS.both[event.code];
  if (arrows === "keyboard" && event.code in KEYS.arrows) return KEYS.arrows[event.code];
  if (keyMap === "positional") return KEYS.positional[event.code];
  if (event.shiftKey && event.key in KEYS.symbolicShift) return KEYS.symbolicShift[event.key];
  return KEYS.symbolic[event.key];
}
function toggleArrows() { releaseAll(); arrows = arrows === "joystick" ? "keyboard" : "joystick"; show(); }
function toggleMap() { releaseAll(); keyMap = keyMap === "symbolic" ? "positional" : "symbolic"; show(); }
function key(event, down) {
  // Ctrl and Cmd keep their browser use: they are not C64 keys.
  if (event.ctrlKey || event.metaKey) return;
  // The keys of the page: they are not C64 keys. Enter is Start only on the start screen.
  const command = { F9: "port", F10: "arrows", F11: "cancel", F12: "end", PageUp: "restore" }[event.code] ?? (phase === "waiting" && event.code === "Enter" ? "start" : undefined);
  if (command !== undefined) {
    event.preventDefault();
    if (!down || event.repeat) return;
    if (command === "arrows") toggleArrows();
    else if (command !== "restore" || phase === "playing") send(command);
    return;
  }
  if (arrows === "joystick" && event.code in BITS) { event.preventDefault(); down ? stick.add(event.code) : stick.delete(event.code); return; }
  if (!down) {
    const code = pressed.get(event.code);
    if (code === undefined) return;
    event.preventDefault();
    pressed.delete(event.code);
    send("key?code=" + code.toString(16) + "&down=0");
    return;
  }
  const code = c64Key(event);
  if (code === undefined) return;
  event.preventDefault();
  if (event.repeat || phase !== "playing" || pressed.has(event.code)) return;
  pressed.set(event.code, code);
  send("key?code=" + code.toString(16) + "&down=1");
}
addEventListener("keydown", (event) => key(event, true));
addEventListener("keyup", (event) => key(event, false));
addEventListener("blur", releaseAll);
$("start").onclick = () => send("start");
$("end").onclick = () => send("end");
$("cancel").onclick = () => send("cancel");
$("port").onclick = () => send("port");
$("arrows").onclick = toggleArrows;
$("map").onclick = toggleMap;
show();
</script></body></html>`.replace("__KEYS__", JSON.stringify(KEY_MAPS));

/** The phases of a session: the start screen, the play, then End, Cancel or a failed RESTORE. */
type Phase = "waiting" | "playing" | "ended" | "cancelled" | "failed";

/** A RESTORE press in the queue of the page input. */
const RESTORE = Symbol("restore");

/**
 * Shows the start screen frozen until Start, then runs the core in real time
 * with the page as its joystick and keyboard. End freezes the machine and gives
 * undefined: the recording is complete. Cancel gives CANCELLED, and a RESTORE
 * that fails gives its reason. No frame runs after End or Cancel.
 */
export async function play(core: Pick<C64RunSession, "command" | "status">, options: PlayOptions): Promise<string | undefined> {
  const palette = (await core.command("palette")).split(" ").slice(1).join(" ");
  const viewers = new Set<ServerResponse>();
  const pending: Array<string | typeof RESTORE> = [];
  let mask = 0;
  let port = options.joystick;
  let reason: string | undefined;
  // Not narrowed: the request handlers change it.
  let phase = "waiting" as Phase;
  let leaveWaiting: () => void = () => {};
  const leftWaiting = new Promise<void>((resolve) => (leaveWaiting = resolve));
  const tell = (viewer: ServerResponse) => viewer.write("event: state\ndata: " + phase + "\n\nevent: port\ndata: " + port + "\n\n");
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
      const key = Number.parseInt(url.searchParams.get("code") ?? "", 16);
      if (!PAGE_KEYS.has(key)) return void response.writeHead(400).end();
      if (phase === "playing") pending.push("key " + key.toString(16) + " " + (url.searchParams.get("down") === "1" ? "down" : "up"));
      answer(phase === "playing");
    } else if (request.method === "POST" && url.pathname === "/restore") {
      if (phase === "playing") pending.push(RESTORE);
      answer(phase === "playing");
    } else if (request.method === "POST" && url.pathname === "/port") {
      // The other port; the joystick mask moves with it, the old port is released.
      if (phase === "waiting" || phase === "playing") {
        port = port === 1 ? 2 : 1;
        for (const viewer of viewers) tell(viewer);
      }
      answer(phase === "waiting" || phase === "playing");
    } else if (request.method === "POST" && url.pathname === "/start") {
      answer(phase === "waiting", "playing");
    } else if (request.method === "POST" && url.pathname === "/end") {
      answer(phase === "playing", "ended");
    } else if (request.method === "POST" && url.pathname === "/cancel") {
      if (phase === "waiting" || phase === "playing") reason = CANCELLED;
      answer(phase === "waiting" || phase === "playing", "cancelled");
    } else {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(options.httpPort, "0.0.0.0", resolve));
  const address = server.address();
  options.ready("http://localhost:" + (typeof address === "object" && address !== null ? address.port : options.httpPort) + "/");
  let tick = (await core.status("status")).tick;
  let sent = "";
  try {
    await leftWaiting;
    while (phase === "playing") {
      const started = Date.now();
      const joy = port === 1 ? "joy " + mask.toString(16) + " 0" : "joy 0 " + mask.toString(16);
      if (joy !== sent) {
        await core.command(joy);
        sent = joy;
      }
      while (pending.length > 0 && phase === "playing") {
        const next = pending.shift()!;
        if (next !== RESTORE) {
          await core.command(next);
          continue;
        }
        const failed = await options.restore();
        if (failed !== undefined) {
          reason = failed;
          enter("failed");
        }
        // The event ran the machine to its point and held RESTORE: the frames go on from there.
        tick = (await core.status("status")).tick;
      }
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
  return reason;
}
