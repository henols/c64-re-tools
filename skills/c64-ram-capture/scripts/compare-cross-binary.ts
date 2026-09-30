#!/usr/bin/env node
// compare-cross-binary.ts
//
// Cross-binary RAM/chip-state comparison: classify every difference between
// two captures of DIFFERENT binaries and print a single VERDICT line.
//
// Pure logic. This module reads files the agent already produced and does
// arithmetic over them. It contacts nothing: the mcp__plugin_c64-re-tools_vice__*
// tools are the only route to the emulator (see the c64-emulator
// skill), and nothing here opens a connection, reads broker state, or shells
// out.
//
// The narrowed volatile mask below is committed here, in this commit, before
// any rebuild is compared under it (ROADMAP Phase 50 criterion 1). The mask
// may be narrowed further later. It must never be widened just to make a
// rebuild pass -- the same discipline `compare.ts` and `derive-transients.ts`
// already carry for their own masks/allow-lists.
//
// This is a SIBLING of `compare.ts`, not an extension of it. `compare.ts`'s
// own rules -- a blanket $D000-$DFFF mask and a one-bit "drift" tolerance --
// are correct for its own job: two captures of the SAME binary at the same
// checkpoint. Both rules are wrong for this module's job, which is two
// captures of DIFFERENT binaries, where a one-bit difference at a masked
// address (e.g. `lda #$02` -> `lda #$03` ahead of `sta $d020`) is exactly the
// kind of regression a rebuild must not be allowed to hide. This module does
// not import from, edit, or re-export `compare.ts`; its rules stay frozen
// for its own, still-correct, same-binary job. The three-bucket shape and the
// classification core are duplicated here DELIBERATELY, not shared, so a
// future edit to one module's rules cannot silently change the other's.
//
// Three rule departures from compare.ts, each load-bearing:
//
//   (a) NO DRIFT BUCKET. Across two different binaries a one-bit difference
//       is a real difference. `drift` exists to absorb sampling noise between
//       two runs of the SAME binary; applied across binaries it would absorb
//       an `lda #$02` to `lda #$03` regression whole. Every non-volatile,
//       non-allowlisted difference is a divergence here, regardless of bit
//       count.
//   (b) NARROWED I/O MASK. `compare.ts` masks $D000-$DFFF entirely. This
//       module masks only the addresses and register fields that genuinely
//       cannot be stable, listed individually below with a reason each.
//   (c) ROUTE AWARENESS. A capture carries a declared route of "snapshot" or
//       "memory-read". On the snapshot route the bytes at $D000-$DFFF in the
//       image are RAM under I/O, not the register read view (SKILL.md,
//       "Slice the image out of a snapshot instead of transcribing it"); on
//       the memory-read route they are the register read view. Comparing one
//       against the other is meaningless, so this module refuses the pair.
//
// The CLI dispatch at the bottom runs only when this file is the process
// entry point, so a test can import IMAGE_VOLATILE, isIoVolatile() and
// classify() without running the CLI.

import { readFileSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_BYTES = 65536;

interface MaskEntry {
  lo: number;
  hi: number;
  reason: string;
}

type Domain = "image" | "register";

interface DiffRecord {
  addr: number;
  a: number;
  b: number;
  domain: Domain;
  why?: string;
}

interface AllowlistEntry {
  start: number;
  endInclusive: number;
  domain?: string;
  why?: string;
}

interface AllowlistDoc {
  checkpoint?: string;
  subjects?: Record<string, string>;
  entries?: AllowlistEntry[];
}

interface Allowlist {
  checkpoint: string | null;
  subjects: Record<string, string>;
  entries: AllowlistEntry[];
}

interface StateDoc {
  route: Route;
  registers?: { registersHex?: unknown; [key: string]: unknown } | null;
  checkpoint_name?: string;
  checkpoint_address?: number;
}

type Route = "snapshot" | "memory-read";

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string; [key: string]: unknown };

interface ClassifyInput {
  imgA: Uint8Array;
  imgB: Uint8Array;
  route: string;
  regMapA: Map<number, number> | null;
  regMapB: Map<number, number> | null;
  allowlist?: Allowlist | null;
}

// A hand-bumped version string, printed into every report as
// `MASK_NARROWED_AT:` so a transcript records which mask produced it. Bump
// this whenever a mask span in IMAGE_VOLATILE or IO_VOLATILE changes --
// never silently, and never to make a rebuild pass.
const MASK_VERSION = "compare-cross-binary-mask-v1";

// ---------------------------------------------------------------- IMAGE_VOLATILE

// Spans of the 64K image that are excluded from the verdict on every route.
// Carried forward from compare.ts's own VOLATILE table, same reasons.
export const IMAGE_VOLATILE: MaskEntry[] = [
  { lo: 0x0000, hi: 0x0001, reason: "CPU port" },
  { lo: 0x0100, hi: 0x01ff, reason: "stack page" },
  { lo: 0x0200, hi: 0x03ff, reason: "KERNAL work area / BASIC input buffer" },
];

// ------------------------------------------------------------------- IO_VOLATILE

// Register offsets and ranges that stay excluded, each with its own one-line
// hardware reason. The VIC-II only decodes 6 address bits, so its registers
// at $D000-$D02E mirror every $40 bytes across the whole $D000-$D3FF window
// -- entries here for that window are expressed as the CANONICAL address in
// the first $D000-$D03F block and folded across all sixteen mirrors by
// (addr & 0x3f) in isIoVolatile()/imageMaskEntryFor() below, so a regression
// at $D020 is caught at $D020 and at all fifteen of its mirrors.
//
// Everything else in $D000-$D3FF -- $D000-$D010, $D013-$D018, $D01A-$D01D
// and $D020-$D02E -- is deliberately NOT masked. $D015, $D018 and $D020 are
// the three ROADMAP criterion 1 names inside that carve-out.
const VIC_MIRRORED_VOLATILE: MaskEntry[] = [
  {
    lo: 0xd011,
    hi: 0xd011,
    reason: "bit 7 is the raster counter's ninth bit, so the whole byte is masked",
  },
  { lo: 0xd012, hi: 0xd012, reason: "the raster counter" },
  { lo: 0xd019, hi: 0xd019, reason: "the interrupt latch" },
  { lo: 0xd01e, hi: 0xd01f, reason: "the collision latches, cleared by reading them" },
];

// Ranges outside the VIC-II mirrored window. These do not mirror the same
// way -- SID/colour-RAM/CIA/expansion each occupy their own flat span -- so
// no offset-folding applies; the whole range is excluded.
const FLAT_VOLATILE: MaskEntry[] = [
  { lo: 0xd400, hi: 0xd7ff, reason: "SID is write-only in hardware, read-back is unrecoverable" },
  { lo: 0xd800, hi: 0xdbff, reason: "colour RAM whose high nibble is open bus" },
  {
    lo: 0xdc00,
    hi: 0xdcff,
    reason: "CIA1 -- timers, time-of-day and interrupt-control registers all move without the program touching them",
  },
  {
    lo: 0xdd00,
    hi: 0xddff,
    reason: "CIA2 -- timers, time-of-day and interrupt-control registers all move without the program touching them",
  },
  { lo: 0xde00, hi: 0xdfff, reason: "I/O expansion area and reads open bus" },
];

function ioMaskEntryFor(addr: number): MaskEntry | null {
  if (addr >= 0xd000 && addr <= 0xd3ff) {
    const canonical = 0xd000 + (addr & 0x3f);
    return VIC_MIRRORED_VOLATILE.find(({ lo, hi }) => canonical >= lo && canonical <= hi) ?? null;
  }
  return FLAT_VOLATILE.find(({ lo, hi }) => addr >= lo && addr <= hi) ?? null;
}

export function isIoVolatile(addr: number): boolean {
  return ioMaskEntryFor(addr) !== null;
}

function imageMaskEntryFor(addr: number, route: string): MaskEntry | null {
  const base = IMAGE_VOLATILE.find(({ lo, hi }) => addr >= lo && addr <= hi);
  if (base) return base;
  if (route === "memory-read" && addr >= 0xd000 && addr <= 0xdfff) {
    return ioMaskEntryFor(addr);
  }
  // snapshot route: $D000-$DFFF in the image is ordinary RAM under I/O, not
  // the register read view -- not masked at all. See SKILL.md, "Slice the
  // image out of a snapshot instead of transcribing it".
  return null;
}

export function isImageVolatile(addr: number, route: string): boolean {
  return imageMaskEntryFor(addr, route) !== null;
}

// -------------------------------------------------------------------- format

const hex4 = (n: number) => "$" + n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n: number) => "$" + n.toString(16).toUpperCase().padStart(2, "0");
const bin8 = (n: number) => "%" + n.toString(2).padStart(8, "0");

function loadImage(path: string): Buffer {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(`${path}: ${buf.length} bytes, expected ${IMAGE_BYTES} — not a full 64K image`);
  }
  return buf;
}

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

// ---------------------------------------------------------------------- state

// --state <a.state.json> loads the chip-state sidecar that
// `dump-artifacts.ts write-set` writes. This module reads three parts of it:
//
//   {
//     "route": "snapshot" | "memory-read",           required
//     "registers": { "registersHex": "<94 hex chars>", ... },
//     "checkpoint_name": "...", "checkpoint_address": 4290
//   }
//
// `registers` is the `vice_vicii_get_state` answer, unchanged. Its
// `registersHex` holds the 47 bytes at $D000-$D02E, which this module
// compares register by register. `registers` is optional: a capture with no
// chip-state evidence compares on the image alone. A `registers` object
// without a well-formed `registersHex` is refused by name.

const VIC_REGISTER_COUNT = 47;

function loadState(path: string): StateDoc {
  let doc: unknown;
  try {
    doc = JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`${path}: cannot read the state sidecar -- ${(e as Error).message}`);
  }
  if (typeof doc !== "object" || doc === null) throw new Error(`${path}: the state sidecar is not a JSON object`);
  const route = (doc as { route?: unknown }).route;
  if (route !== "snapshot" && route !== "memory-read") {
    throw new Error(`${path}: the state sidecar declares route ${JSON.stringify(route)} -- it must be "snapshot" or "memory-read"`);
  }
  return doc as StateDoc;
}

function normalizeRegisters(stateDoc: StateDoc, path: string): Map<number, number> {
  const map = new Map<number, number>();
  const regs = stateDoc.registers;
  if (regs === undefined || regs === null) return map;
  const hexText = regs.registersHex;
  if (typeof hexText !== "string" || !/^[0-9a-fA-F]*$/.test(hexText) || hexText.length !== VIC_REGISTER_COUNT * 2) {
    throw new Error(
      `${path}: registers carries no registersHex of ${VIC_REGISTER_COUNT} bytes -- record the vice_vicii_get_state answer unchanged -- refused`,
    );
  }
  const bytes = Buffer.from(hexText, "hex");
  for (let i = 0; i < bytes.length; i++) map.set(0xd000 + i, bytes[i]);
  return map;
}

// ----------------------------------------------------------------- allowlist

// --allowlist <path> loads the intentional-difference document. Shape:
//
//   {
//     "checkpoint": "hazard_raster_entry",
//     "subjects": { "hazard-subject-modified": "<sha256 of the .prg>" },
//     "entries": [
//       { "start": 8221, "endInclusive": 8221, "domain": "image", "why": "..." }
//     ]
//   }
//
// Every entry is validated at load time and refused BY NAME on: a missing or
// whitespace-only `why`; a `start` above `endInclusive`; a range that
// intersects a masked span (mask wins -- an allowlist can never re-admit a
// hardware-volatile address, so a real difference can never be smuggled in
// under a masked address's cover); and a document `checkpoint` that does not
// match the checkpoint the two captures themselves declare. This is
// semantically distinct from the mask tables above -- hardware noise versus a
// deliberate difference -- and is kept in its own bucket, never folded into
// IMAGE_VOLATILE/IO_VOLATILE, so ROADMAP criterion 2's distinction stays
// visible in the record.
function loadAllowlist(
  path: string,
  { route, checkpointName }: { route: string; checkpointName: string | null },
): Allowlist {
  const doc: AllowlistDoc = JSON.parse(readFileSync(path, "utf8"));
  const entries = doc.entries ?? [];

  if (checkpointName && doc.checkpoint && doc.checkpoint !== checkpointName) {
    throw new Error(
      `${path}: allowlist declares checkpoint "${doc.checkpoint}", captures declare "${checkpointName}" -- refused`,
    );
  }

  for (const e of entries) {
    const rangeLabel =
      e.start === e.endInclusive ? hex4(e.start) : `${hex4(e.start)}-${hex4(e.endInclusive)}`;
    if (!e.why || !String(e.why).trim()) {
      throw new Error(
        `${path}: allowlist entry ${rangeLabel} has no why -- an allowlist entry without a non-empty why string is refused`,
      );
    }
    if (!(e.start <= e.endInclusive)) {
      throw new Error(`${path}: allowlist entry ${rangeLabel} has start above endInclusive -- refused`);
    }
    const domain = e.domain === "register" ? "register" : "image";
    for (let addr = e.start; addr <= e.endInclusive; addr++) {
      const maskEntry = domain === "register" ? ioMaskEntryFor(addr) : imageMaskEntryFor(addr, route);
      if (maskEntry) {
        throw new Error(
          `${path}: allowlist entry ${rangeLabel} (${domain}) overlaps the masked span ` +
            `${hex4(maskEntry.lo)}-${hex4(maskEntry.hi)} (${maskEntry.reason}) -- overlap between an ` +
            `allowlist entry and the volatile mask is refused`,
        );
      }
    }
  }

  return { checkpoint: doc.checkpoint ?? null, subjects: doc.subjects ?? {}, entries };
}

function findAllowlistEntry(
  allowlist: Allowlist | null | undefined,
  addr: number,
  domain: Domain,
): AllowlistEntry | null {
  if (!allowlist) return null;
  for (const e of allowlist.entries) {
    const eDomain = e.domain === "register" ? "register" : "image";
    if (eDomain !== domain) continue;
    if (addr >= e.start && addr <= e.endInclusive) return e;
  }
  return null;
}

// -------------------------------------------------------------- classification

/**
 * Classify every differing address between two captures -- image bytes plus,
 * when both sides carry a chip-state sidecar, register values. Precedence is
 * volatile first, then allowlisted, then divergence -- the same "mask wins
 * over everything else" precedence compare.ts already uses for isVolatile,
 * extended one step further: allowlist wins over bit-count too. There is no
 * fourth bucket and no bit-count branch: every non-volatile,
 * non-allowlisted difference is a divergence, one bit or many.
 */
export function classify({ imgA, imgB, route, regMapA, regMapB, allowlist }: ClassifyInput) {
  const volatile_: DiffRecord[] = [];
  const allowlisted: DiffRecord[] = [];
  const divergence: DiffRecord[] = [];

  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = imgA[addr];
    const y = imgB[addr];
    if (x === y) continue;

    const rec: DiffRecord = { addr, a: x, b: y, domain: "image" };
    if (isImageVolatile(addr, route)) {
      volatile_.push(rec);
      continue;
    }
    const aw = findAllowlistEntry(allowlist, addr, "image");
    if (aw) {
      allowlisted.push({ ...rec, why: aw.why });
      continue;
    }
    divergence.push(rec);
  }

  if (regMapA && regMapB && regMapA.size && regMapB.size) {
    const addrs = new Set([...regMapA.keys(), ...regMapB.keys()]);
    for (const addr of [...addrs].sort((p, q) => p - q)) {
      const x = regMapA.get(addr);
      const y = regMapB.get(addr);
      // Present on only one side -- not comparable, not counted either way.
      if (x === undefined || y === undefined) continue;
      if (x === y) continue;

      const rec: DiffRecord = { addr, a: x, b: y, domain: "register" };
      if (isIoVolatile(addr)) {
        volatile_.push(rec);
        continue;
      }
      const aw = findAllowlistEntry(allowlist, addr, "register");
      if (aw) {
        allowlisted.push({ ...rec, why: aw.why });
        continue;
      }
      divergence.push(rec);
    }
  }

  return { volatile: volatile_, allowlisted, divergence, pass: divergence.length === 0 };
}

// ------------------------------------------------------------------- printing

type Say = (line: string) => void;

const fmtDiffRow = (r: DiffRecord) =>
  `  ${hex4(r.addr)}  ${hex2(r.a)} ${bin8(r.a)}  ->  ${hex2(r.b)} ${bin8(r.b)}   [${r.domain}]`;

function printList(say: Say, title: string, rows: DiffRecord[], limit: number | undefined) {
  say(`\n${title}: ${rows.length}`);
  if (!rows.length) return;
  // --limit 0 means unlimited, matching the usage text. Anything else caps.
  const shown = limit ? rows.slice(0, limit) : rows;
  for (const r of shown) {
    const why = r.why ? `  -- ${r.why}` : "";
    say(fmtDiffRow(r) + why);
  }
  if (shown.length < rows.length) {
    say(`  … ${rows.length - shown.length} more (--limit 0 for all)`);
  }
}

// ---------------------------------------------------------------------- cross

function parseCrossArgs(argv: string[]) {
  const positional: string[] = [];
  let statePaths: [string, string] | null = null;
  let allowlistPath: string | null = null;
  let noAllowlist = false;
  let checkpointAssert: string | null = null;
  let routeAssert: Route | null = null;
  let limit: number | undefined;

  const value = (i: number, flag: string): string => {
    const v = argv[i];
    if (v === undefined || v.startsWith("--")) throw new Error(`${flag} needs a value`);
    return v;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--state") {
      statePaths = [value(i + 1, "--state"), value(i + 2, "--state")];
      i += 2;
    } else if (a === "--allowlist") {
      allowlistPath = value(++i, a);
    } else if (a === "--no-allowlist") {
      noAllowlist = true;
    } else if (a === "--checkpoint") {
      checkpointAssert = value(++i, a);
    } else if (a === "--route") {
      const r = value(++i, a);
      if (r !== "snapshot" && r !== "memory-read") throw new Error(`--route must be "snapshot" or "memory-read", got ${JSON.stringify(r)}`);
      routeAssert = r;
    } else if (a === "--limit") {
      const n = Number(value(++i, a));
      if (!Number.isInteger(n) || n < 0) throw new Error("--limit needs a non-negative integer");
      limit = n;
    } else if (a.startsWith("--")) {
      throw new Error(`unknown flag ${a}`);
    } else {
      positional.push(a);
    }
  }

  if (positional.length !== 2) throw new Error("cross needs exactly two image paths");
  return {
    imagePaths: positional,
    statePaths,
    allowlistPath,
    noAllowlist,
    checkpointAssert,
    routeAssert,
    limit,
  };
}

function cmdCross(argv: string[], say: Say): ScriptResult {
  const opts = parseCrossArgs(argv);
  const [pa, pb] = opts.imagePaths;
  const imgA = loadImage(pa);
  const imgB = loadImage(pb);

  const stateA = opts.statePaths ? loadState(opts.statePaths[0]) : null;
  const stateB = opts.statePaths ? loadState(opts.statePaths[1]) : null;

  // The route decides whether $D000-$DFFF is masked, so it is never assumed.
  let route: Route;
  if (stateA && stateB) {
    if (stateA.route !== stateB.route) {
      throw new Error(
        `capture routes differ -- A declares "${stateA.route}", B declares "${stateB.route}". Comparing a ` +
          `snapshot-route capture against a memory-read-route capture is meaningless; refused.`,
      );
    }
    if (opts.routeAssert && opts.routeAssert !== stateA.route) {
      throw new Error(`--route asserted "${opts.routeAssert}", the state sidecars declare "${stateA.route}" -- refused`);
    }
    route = stateA.route;
  } else if (opts.routeAssert) {
    route = opts.routeAssert;
  } else {
    throw new Error('cross needs the capture route: pass --state <a> <b>, or --route "snapshot" or "memory-read"');
  }

  const checkpointA = stateA?.checkpoint_name ?? null;
  const checkpointB = stateB?.checkpoint_name ?? null;
  if (checkpointA && checkpointB && checkpointA !== checkpointB) {
    throw new Error(
      `logical checkpoints differ -- A resolved "${checkpointA}", B resolved "${checkpointB}". A ` +
        `comparison whose two captures name different logical checkpoints is refused.`,
    );
  }
  const checkpointName = checkpointA ?? checkpointB ?? null;
  if (opts.checkpointAssert && checkpointName && opts.checkpointAssert !== checkpointName) {
    throw new Error(
      `--checkpoint asserted "${opts.checkpointAssert}", captures declare "${checkpointName}" -- refused`,
    );
  }

  const regMapA = stateA ? normalizeRegisters(stateA, opts.statePaths![0]) : null;
  const regMapB = stateB ? normalizeRegisters(stateB, opts.statePaths![1]) : null;

  const allowlist =
    opts.allowlistPath && !opts.noAllowlist
      ? loadAllowlist(opts.allowlistPath, { route, checkpointName })
      : null;

  const haA = sha256(imgA);
  const haB = sha256(imgB);

  say(`A  ${basename(pa)}  sha256 ${haA}`);
  say(`B  ${basename(pb)}  sha256 ${haB}`);
  say(`MASK_NARROWED_AT: ${MASK_VERSION}`);
  if (checkpointA) {
    say(`A  checkpoint ${checkpointA} @ ${hex4(stateA!.checkpoint_address ?? 0)}`);
  }
  if (checkpointB) {
    say(`B  checkpoint ${checkpointB} @ ${hex4(stateB!.checkpoint_address ?? 0)}`);
  }

  const byteIdentical = haA === haB;
  say(`\nBYTE_IDENTICAL: ${byteIdentical ? "yes" : "no"}`);
  say("  (a recorded extra -- the VERDICT line below is the acceptance signal, not this one)");

  // Always classify, even when the images are byte-identical: a chip-state-
  // only regression must still be caught. Byte identity is a recorded extra,
  // and the full classification is the acceptance criterion.
  const r = classify({ imgA, imgB, route, regMapA, regMapB, allowlist });

  printList(say, "volatile (excluded from the verdict)", r.volatile, opts.limit);
  printList(say, "allowlisted (intentional difference, excluded from the verdict)", r.allowlisted, opts.limit);
  printList(say, "DIVERGENCE — fails the comparison", r.divergence, opts.limit);

  const total = r.volatile.length + r.allowlisted.length + r.divergence.length;
  say(`\ntotal differing addresses (image + register): ${total}`);
  say(`\nVERDICT: ${r.pass ? "PASS" : "FAIL"}`);

  const record = {
    verdict: r.pass ? "PASS" : "FAIL",
    route,
    maskVersion: MASK_VERSION,
    byteIdentical,
    sha256: { a: haA, b: haB },
    checkpoint: checkpointName,
    counts: { volatile: r.volatile.length, allowlisted: r.allowlisted.length, divergence: r.divergence.length },
    divergence: r.divergence.map((d) => ({ addr: hex4(d.addr), a: d.a, b: d.b, domain: d.domain })),
  };
  if (r.pass) return { ok: true, ...record };
  return { ok: false, message: `VERDICT: FAIL -- ${r.divergence.length} divergence(s)`, ...record };
}

// -------------------------------------------------------------------- dispatch

const commands: Record<string, (argv: string[], say: Say) => ScriptResult> = { cross: cmdCross };

export function usage() {
  return `usage: node compare-cross-binary.ts <command>

  cross <a.bin> <b.bin> (--state <a.state.json> <b.state.json> | --route <snapshot|memory-read>)
        [--allowlist <path>] [--no-allowlist] [--checkpoint <name>] [--limit N] [--json]
    classify every difference between two captures of DIFFERENT binaries and
    print a single VERDICT line.

No drift bucket here: every non-volatile, non-allowlisted difference fails,
regardless of bit count -- unlike compare.ts, which is for two captures of
the SAME binary. Volatile registers (excluded): $D011, $D012, $D019,
$D01E-$D01F, $D400-$D7FF, $D800-$DBFF, $DC00-$DCFF, $DD00-$DDFF, $DE00-$DFFF
(mirrored across $D000-$D3FF where applicable). $D015, $D018 and $D020 are
deliberately NOT masked. The route comes from the state sidecars, or from
--route when there are none.
--limit 0 prints every row. The last stdout line is one JSON result; ok is
false on a FAIL verdict and on any refusal.

Captures come from the procedure in c64-ram-capture/SKILL.md, via
mcp__plugin_c64-re-tools_vice__*. This script contacts nothing.`;
}

/** The whole CLI as a function. `say` receives the human-readable lines. Never throws. */
export function main(argv: readonly string[], say: Say = () => {}): ScriptResult {
  const [cmd, ...rest] = argv.filter((a) => a !== "--json");
  if (!cmd || !Object.hasOwn(commands, cmd)) {
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
