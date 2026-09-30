#!/usr/bin/env node
// compare.ts
//
// Compare 65536-byte C64 RAM captures and classify every difference.
//
// Pure logic. This module reads files the agent already captured and does
// arithmetic over them. It contacts nothing: the mcp__plugin_c64-re-tools_vice__* tools are the
// only route to the emulator (see the c64-emulator skill), and
// nothing here opens a connection, reads broker state, or shells out.
//
// The classification rules are the ones c64-ram-capture/SKILL.md states, and
// they live here so they are applied identically every time instead of being
// re-derived by hand per session:
//
//   volatile   $0000-$0001, $0100-$01FF, $0200-$03FF, and $D000-$DFFF on the
//              memory-read route -- counted, reported, excluded from the verdict
//   drift      exactly one bit differs -- listed as a candidate, does not fail
//   divergence two or more bits differ -- listed, and fails the comparison
//
// `--route` is required for `compare` and `floor`. On the memory-read route,
// $D000-$DFFF is the live I/O register view, so it can never be stable and is
// masked. On the snapshot route, a sliced image holds the RAM under I/O there,
// so a difference in that range is a real difference and is not masked.

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_BYTES = 65536;

/** How the images were read. It decides whether $D000-$DFFF is masked. */
export type Route = "memory-read" | "snapshot";

// Volatile spans on every route, inclusive. A difference inside these is
// expected on any two captures of the same checkpoint and never fails a
// comparison.
const VOLATILE: [number, number][] = [
  [0x0000, 0x0001], // CPU port
  [0x0100, 0x01ff], // stack page
  [0x0200, 0x03ff], // KERNAL work area / BASIC input buffer
];

// Volatile on the memory-read route only. $D000-$DFFF is I/O there, not RAM:
// the VIC's registers repeat every $40 across $D000-$D3FF and the SID's across
// $D400-$D7FF, so reading this range samples live hardware and two captures
// can never agree here.
const IO_WINDOW: [number, number] = [0xd000, 0xdfff];

// Deliberately NOT volatile: $E000-$FFFF (RAM under KERNAL ROM when HIRAM=0).
// $FAD8 and $FC51 do differ across captures, but only 2 addresses out of 8192 --
// far too few for power-on garbage, and unexplained. Blanket-excluding 8 KB on
// two data points would hide real divergence, so these still fail and the
// capture record carries the explanation. Confidence MEDIUM, see the same entry.

/** True when a difference at `a` is excluded from the verdict on `route`. */
export function isVolatile(a: number, route: Route): boolean {
  if (VOLATILE.some(([lo, hi]) => a >= lo && a <= hi)) return true;
  return route === "memory-read" && a >= IO_WINDOW[0] && a <= IO_WINDOW[1];
}

const hex4 = (n: number) => "$" + n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n: number) => "$" + n.toString(16).toUpperCase().padStart(2, "0");
const bin8 = (n: number) => "%" + n.toString(2).padStart(8, "0");

const popcount = (n: number) => {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
};

function loadImage(path: string): Buffer {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(
      `${path}: ${buf.length} bytes, expected ${IMAGE_BYTES} — not a full 64K image`,
    );
  }
  return buf;
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

interface DiffRecord {
  addr: number;
  a: number;
  b: number;
  bits: number;
}

interface Comparison {
  volatile: DiffRecord[];
  drift: DiffRecord[];
  divergence: DiffRecord[];
  pass: boolean;
}

/**
 * Classify every differing address between two images.
 * Returns { volatile[], drift[], divergence[], pass } — the three lists
 * SKILL.md requires, plus the verdict.
 */
export function compare(a: Buffer, b: Buffer, route: Route): Comparison {
  const volatile_: DiffRecord[] = [];
  const drift: DiffRecord[] = [];
  const divergence: DiffRecord[] = [];

  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = a[addr];
    const y = b[addr];
    if (x === y) continue;

    const bits = popcount(x ^ y);
    const rec = { addr, a: x, b: y, bits };

    // Volatile wins over bit-count: an address in a volatile span is excluded
    // from the verdict regardless of how many bits moved.
    if (isVolatile(addr, route)) volatile_.push(rec);
    else if (bits === 1) drift.push(rec);
    else divergence.push(rec);
  }

  return { volatile: volatile_, drift, divergence, pass: divergence.length === 0 };
}

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string; [key: string]: unknown };

type Say = (line: string) => void;

const fmtRow = (r: DiffRecord) =>
  `  ${hex4(r.addr)}  ${hex2(r.a)} ${bin8(r.a)}  ->  ${hex2(r.b)} ${bin8(r.b)}   ${r.bits} bit${r.bits === 1 ? "" : "s"}`;

function printList(say: Say, title: string, rows: DiffRecord[], limit: number | undefined) {
  say(`\n${title}: ${rows.length}`);
  if (!rows.length) return;
  // --limit 0 means unlimited, matching the usage text. Anything else caps.
  const shown = limit ? rows.slice(0, limit) : rows;
  for (const r of shown) say(fmtRow(r));
  if (shown.length < rows.length) {
    say(`  … ${rows.length - shown.length} more (--limit 0 for all)`);
  }
}

interface ParsedArgs {
  paths: string[];
  limit: number | undefined;
  route: Route | undefined;
}

/** A real parser: a flag's value is never read as an image path. */
function parseArgs(verb: string, argv: string[], flags: readonly string[]): ParsedArgs {
  const out: ParsedArgs = { paths: [], limit: undefined, route: undefined };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith("--")) {
      out.paths.push(a);
      continue;
    }
    if (!flags.includes(a)) throw new Error(`${verb}: unknown flag ${a} -- accepted: ${flags.join(", ")}`);
    const v = argv[++i];
    if (v === undefined || v.startsWith("--")) throw new Error(`${verb}: ${a} needs a value`);
    if (a === "--limit") {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 0) throw new Error("--limit needs a non-negative integer");
      out.limit = n;
    } else if (a === "--route") {
      if (v !== "memory-read" && v !== "snapshot") throw new Error(`--route must be "memory-read" or "snapshot", got ${JSON.stringify(v)}`);
      out.route = v;
    }
  }
  return out;
}

function requireRoute(verb: string, route: Route | undefined): Route {
  if (!route) {
    throw new Error(
      `${verb} needs --route memory-read or --route snapshot -- the route decides whether $D000-$DFFF is masked, so it is never assumed`,
    );
  }
  return route;
}

function cmdCompare(argv: string[], say: Say): ScriptResult {
  const { paths, limit, route: routeArg } = parseArgs("compare", argv, ["--limit", "--route"]);
  const route = requireRoute("compare", routeArg);
  if (paths.length !== 2) throw new Error("compare needs exactly two image paths");

  const [pa, pb] = paths;
  const a = loadImage(pa);
  const b = loadImage(pb);

  const ha = sha256(a);
  const hb = sha256(b);

  say(`A  ${basename(pa)}  sha256 ${ha}`);
  say(`B  ${basename(pb)}  sha256 ${hb}`);
  say(`route: ${route}${route === "memory-read" ? " ($D000-$DFFF masked)" : " ($D000-$DFFF is RAM, not masked)"}`);

  const r = compare(a, b, route);

  if (ha === hb) {
    say("\nIDENTICAL — the two images are byte-for-byte equal.");
  } else {
    printList(say, "volatile (excluded from the verdict)", r.volatile, limit);
    printList(say, "drift — exactly one bit, reported as candidates", r.drift, limit);
    printList(say, "DIVERGENCE — two or more bits, fails the comparison", r.divergence, limit);
    const total = r.volatile.length + r.drift.length + r.divergence.length;
    say(`\ntotal differing addresses: ${total} of ${IMAGE_BYTES}`);
  }
  say(`\nVERDICT: ${r.pass ? "PASS" : "FAIL"}`);
  if (r.pass && r.drift.length) {
    say("Drift candidates present — pass, but record them with the capture.");
  }
  const record = {
    verdict: r.pass ? "PASS" : "FAIL",
    route,
    sha256: { a: ha, b: hb },
    counts: { volatile: r.volatile.length, drift: r.drift.length, divergence: r.divergence.length },
    drift: r.drift.map((d) => hex4(d.addr)),
    divergence: r.divergence.map((d) => hex4(d.addr)),
  };
  return r.pass ? { ok: true, ...record } : { ok: false, message: `VERDICT: FAIL -- ${r.divergence.length} divergence(s)`, ...record };
}

/**
 * Drift floor across N captures of the same checkpoint: every address that
 * differed in ANY pairing. Reported as a floor, never as a complete set —
 * more captures can only widen it.
 */
function cmdFloor(argv: string[], say: Say): ScriptResult {
  const { paths, limit, route: routeArg } = parseArgs("floor", argv, ["--limit", "--route"]);
  const route = requireRoute("floor", routeArg);
  if (paths.length < 2) throw new Error("floor needs at least two image paths");

  const imgs = paths.map((p) => ({ path: p, buf: loadImage(p) }));
  for (const i of imgs) say(`${basename(i.path)}  sha256 ${sha256(i.buf)}`);

  const floor = new Map<number, Set<number>>(); // addr -> Set of distinct values seen
  let worstPair: { label: string; n: number } | null = null;

  for (let i = 0; i < imgs.length; i++) {
    for (let j = i + 1; j < imgs.length; j++) {
      const r = compare(imgs[i].buf, imgs[j].buf, route);
      for (const rec of [...r.volatile, ...r.drift, ...r.divergence]) {
        if (!floor.has(rec.addr)) floor.set(rec.addr, new Set());
        floor.get(rec.addr)!.add(rec.a);
        floor.get(rec.addr)!.add(rec.b);
      }
      const label = `${basename(imgs[i].path)} vs ${basename(imgs[j].path)}`;
      say(`\n${label}: ${r.volatile.length} volatile, ${r.drift.length} drift, ${r.divergence.length} divergence -> ${r.pass ? "PASS" : "FAIL"}`);
      if (!r.pass && (!worstPair || r.divergence.length > worstPair.n)) {
        worstPair = { label, n: r.divergence.length };
      }
    }
  }

  const addrs = [...floor.keys()].sort((x, y) => x - y);
  const vol = addrs.filter((a) => isVolatile(a, route)).length;

  say(`\nDRIFT FLOOR: ${addrs.length} addresses (${vol} inside volatile spans)`);
  const shown = limit === 0 ? addrs : addrs.slice(0, limit || 40);
  for (const a of shown) {
    const vals = [...floor.get(a)!].sort((p, q) => p - q).map(hex2).join(" / ");
    say(`  ${hex4(a)}${isVolatile(a, route) ? "  [volatile]" : "            "}  ${vals}`);
  }
  if (shown.length < addrs.length) {
    say(`  … ${addrs.length - shown.length} more (--limit 0 for all)`);
  }

  say("\nThis is a FLOOR, not a complete set — more captures of the same checkpoint can only widen it.");
  if (worstPair) {
    const n = worstPair.n;
    say(`Worst pairing: ${worstPair.label} (${n} divergence${n === 1 ? "" : "s"}).`);
  }
  return { ok: true, route, floorCount: addrs.length, volatileCount: vol, floor: addrs.map(hex4), worstPair };
}

/** SHA-256 and size of each image, for recording alongside a capture. A file
 * that is not a full 64K image is refused. */
function cmdDigest(argv: string[], say: Say): ScriptResult {
  const { paths } = parseArgs("digest", argv, []);
  if (!paths.length) throw new Error("digest needs at least one image path");
  const images = paths.map((p) => {
    const buf = loadImage(p);
    const digest = sha256(buf);
    say(`${digest}  ${buf.length} bytes  ${basename(p)}`);
    return { path: p, sha256: digest, bytes: buf.length };
  });
  return { ok: true, images };
}

const commands: Record<string, (argv: string[], say: Say) => ScriptResult> = Object.assign(Object.create(null), {
  compare: cmdCompare,
  floor: cmdFloor,
  digest: cmdDigest,
});

export function usage(): string {
  return `usage: node compare.ts <command> [--json]

  compare <a.bin> <b.bin> --route <memory-read|snapshot> [--limit N]      classify every difference, print a verdict
  floor <a.bin> <b.bin> [...] --route <memory-read|snapshot> [--limit N]  drift floor across N captures of one checkpoint
  digest <image.bin>...                                                   sha256 + size, for the capture record

Volatile (counted, excluded from the verdict): $0000-$0001, $0100-$01FF, $0200-$03FF,
and on the memory-read route $D000-$DFFF. There that range is I/O, not RAM, so it can
never be stable. On the snapshot route it is RAM under I/O and is not masked.
One differing bit is drift and passes; two or more is divergence and fails.
--limit 0 prints every row. The last stdout line is one JSON result; ok is false on a
FAIL verdict and on any refusal.

Images come from the capture procedure in this skill's SKILL.md, via mcp__plugin_c64-re-tools_vice__*.
This script contacts nothing.`;
}

/** The whole CLI as a function. `say` receives the human-readable lines. Never throws. */
export function main(argv: readonly string[], say: Say = () => {}): ScriptResult {
  const [cmd, ...rest] = argv.filter((a) => a !== "--json");
  if (!cmd || !commands[cmd]) {
    return { ok: false, message: cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage()}` : usage() };
  }
  try {
    return commands[cmd](rest, say);
  } catch (e) {
    return { ok: false, message: (e as Error).message };
  }
}

// True when this file is the process entry point, also when it runs through a symlink.
const invokedDirectly = process.argv[1] !== undefined && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);

if (invokedDirectly) {
  const argv = process.argv.slice(2);
  const result = main(argv, argv.includes("--json") ? () => {} : (line) => console.log(line));
  console.log(JSON.stringify(result));
  process.exitCode = result.ok ? 0 : 1;
}
