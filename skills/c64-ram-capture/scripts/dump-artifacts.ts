#!/usr/bin/env node
// dump-artifacts.ts
//
// The artifact renderer. This module exists because
// of a structural fact worth stating up front: the executing agent can
// write text, not binary, so the only shape a committable 65536-byte image
// can take under the one permitted route to the emulator is *the agent
// serialises what it fetched via mcp__plugin_c64-re-tools_vice__* tool calls, and a pure
// function renders it*. Every function below takes already-fetched data as
// an argument -- nothing here contacts the emulator.
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join, resolve, relative } from "node:path";

import type { Address } from "../../c64-project/scripts/releases.ts";
import { loadSibling, siblingOrRefuse } from "./sibling.ts";

const { releaseDir } = siblingOrRefuse(await loadSibling(() => import("../../c64-project/scripts/releases.ts"), "releases.ts", "c64-ram-capture"), import.meta.url);
const { projectRoot } = siblingOrRefuse(await loadSibling(() => import("../../c64-project/scripts/project-paths.ts"), "project-paths.ts", "c64-ram-capture"), import.meta.url);
const { addrNum, hex4 } = siblingOrRefuse(await loadSibling(() => import("../../c64-project/scripts/address.ts"), "address.ts", "c64-ram-capture"), import.meta.url);

/** One `{ address, hex }` chunk record the agent wrote after a memory read. */
export interface MemoryChunk {
  address: Address;
  hex: string;
}

/** How the image bytes were read: `vice_memory_read` (the I/O register view
 * at $D000-$DFFF) or a sliced `.vsf` snapshot (the RAM under I/O). */
export type CaptureRoute = "memory-read" | "snapshot";

/** The register/state readings `buildChipState()` derives the sidecar from.
 * `registers`, `sprites` and `cpu` pass through verbatim. */
export interface ChipStateRaw {
  dd00_raw: number;
  d018_raw: number;
  port01_raw: number;
  sprite_pointers: number[];
  captured_at: string;
  route: CaptureRoute;
  registers?: unknown;
  sprites?: unknown;
  cpu?: unknown;
  release?: string;
  label?: string;
  snapshot_name?: string | null;
  dd00_direct_read?: number;
  checkpoint_name?: string;
  checkpoint_address?: number;
}

/** The descriptive fields a range manifest carries next to its ranges. */
export interface RangeManifestMeta {
  release?: string;
  label?: string;
  snapshot_name?: string | null;
  note?: string;
  generated_at?: string;
}

/** One range of a range manifest. */
export interface ManifestRange {
  start: number;
  end: number;
  kind: string;
  source: string;
  note: string;
}

/** What `writeDumpSet()` takes. */
export interface WriteDumpSetInput {
  releaseId: string;
  label: string;
  chunks: MemoryChunk[];
  chipStateRaw: ChipStateRaw;
  meta?: RangeManifestMeta;
  captureExtra?: Record<string, unknown>;
}

/** Every result this script prints. The last stdout line is always one of
 * these, as JSON. */
export type ScriptResult = { ok: true; [key: string]: unknown } | { ok: false; message: string };

function rel(p: string): string {
  return relative(projectRoot(), p);
}

// ---------------------------------------------------------------- assembleImage

/**
 * Assemble the ordered `{ address, hex }` chunk records the agent wrote
 * after its `mcp__plugin_c64-re-tools_vice__vice_memory_read` calls into a 65536-byte buffer.
 * Asserts contiguity from $0000 with no gap and no overlap and a total of
 * exactly 65536 bytes, naming the offending address in every failure.
 */
export function assembleImage(chunks: readonly MemoryChunk[]): Buffer {
  const sorted = [...chunks].sort((a, b) => addrNum(a.address) - addrNum(b.address));
  const bufs: Buffer[] = [];
  let expected = 0;
  for (const c of sorted) {
    const addr = addrNum(c.address);
    const buf = Buffer.from(c.hex, "hex");
    if (addr > expected) {
      throw new Error(`assembleImage: gap before address ${hex4(expected)} -- next chunk starts at ${hex4(addr)}`);
    }
    if (addr < expected) {
      throw new Error(`assembleImage: overlap at address ${hex4(addr)} -- a previous chunk already covered up to ${hex4(expected - 1)}`);
    }
    bufs.push(buf);
    expected += buf.length;
  }
  const total = Buffer.concat(bufs);
  if (total.length !== 65536) {
    throw new Error(`assembleImage: assembled ${total.length} bytes ending at ${hex4(expected)}, expected exactly 65536`);
  }
  return total;
}

/** SHA-256 of a buffer, hex-encoded. `node:crypto` only -- no package added. */
export function sha256Buffer(buf: Uint8Array): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ----------------------------------------------------------------- vicBank

/**
 * VIC-II bank number (0-3) from CIA2 port A ($DD00)'s low two bits. The
 * stored value is the INVERSE of the bank number (c64-memory-map skill
 * memmap: raw value %00 = "Bank #3" $C000-$FFFF ... %11 = "Bank #0"
 * $0000-$3FFF), so bank = 3 - (raw & 3). Verified against
 * a committed chip-state sidecar's own recorded
 * dd00_raw=193 (0xC1, low bits %01) -> vic_bank=2, which this formula
 * reproduces exactly.
 */
export function vicBank(dd00Raw: number): number {
  return 3 - (dd00Raw & 3);
}

// --------------------------------------------------------------- screenBase

/**
 * Screen memory base address, derived from $D018's bits 4-7 (screen pointer,
 * in 1024-byte units relative to the VIC bank) added to the VIC bank's own
 * base (bank * 16384). Verified against the same committed sidecar:
 * dd00_raw=193, d018_raw=49 (0x31) -> screen_base=35840, reproduced exactly.
 */
export function screenBase(d018Raw: number, dd00Raw: number): number {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const screenOffset = ((d018Raw >> 4) & 0xf) * 1024;
  return bankBase + screenOffset;
}

/** Character memory base: $D018 bits 1-3, in 2048-byte units relative to the VIC bank. */
function charsetBase(d018Raw: number, dd00Raw: number): number {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const charsetOffset = ((d018Raw >> 1) & 0x7) * 2048;
  return bankBase + charsetOffset;
}

// -------------------------------------------------------------- buildChipState

function byteField(raw: Record<string, unknown>, key: string): number {
  const v = raw[key];
  if (!Number.isInteger(v) || (v as number) < 0 || (v as number) > 0xff) {
    throw new Error(`chip-state: "${key}" must be the byte read from the machine (an integer 0-255), got ${JSON.stringify(v)}`);
  }
  return v as number;
}

/**
 * Build the chip-state sidecar from the register/state readings the agent
 * recorded. `raw` carries whatever the agent fetched via vice_vicii_get_state
 * / vice_sprite_get / vice_registers_get / vice_memory_read: `registers`,
 * `sprites` and `cpu` pass through verbatim. `dd00_raw`, `d018_raw`,
 * `port01_raw` and `sprite_pointers` (the eight bytes read from the
 * sprite-pointer table at screen_base+$3F8..$3FF) feed the derivation.
 *
 * Refuses, naming the field, when a derivation input, `captured_at` or
 * `route` is missing or malformed. No field gets a default: a guessed $DD00
 * gives a wrong VIC bank with no error. `derived.dd00_direct_read` is present
 * only when the agent measured it.
 */
export function buildChipState(raw: ChipStateRaw) {
  if (typeof raw !== "object" || raw === null) throw new Error("chip-state: the raw readings must be a JSON object");
  const r = raw as unknown as Record<string, unknown>;
  const dd00 = byteField(r, "dd00_raw");
  const d018 = byteField(r, "d018_raw");
  const port01raw = byteField(r, "port01_raw");
  const spritePointers = raw.sprite_pointers;
  if (!Array.isArray(spritePointers) || spritePointers.length !== 8 || !spritePointers.every((p) => Number.isInteger(p) && p >= 0 && p <= 0xff)) {
    throw new Error(`chip-state: "sprite_pointers" must be the eight bytes at screen_base+$3F8, got ${JSON.stringify(spritePointers)}`);
  }
  if (typeof raw.captured_at !== "string" || raw.captured_at.trim() === "") {
    throw new Error("chip-state: \"captured_at\" must name when the readings were taken (an ISO time string)");
  }
  if (raw.route !== "memory-read" && raw.route !== "snapshot") {
    throw new Error(`chip-state: "route" must be "memory-read" or "snapshot", got ${JSON.stringify(raw.route)}`);
  }
  if (raw.dd00_direct_read !== undefined) byteField(r, "dd00_direct_read");
  const bank = vicBank(dd00);
  const bankBase = bank * 16384;
  const spriteDataAddresses = spritePointers.map((p) => bankBase + p * 64);

  return {
    schema_version: 1,
    release: raw.release,
    label: raw.label,
    route: raw.route,
    snapshot_name: raw.snapshot_name ?? null,
    ...(raw.checkpoint_name !== undefined ? { checkpoint_name: raw.checkpoint_name } : {}),
    ...(raw.checkpoint_address !== undefined ? { checkpoint_address: raw.checkpoint_address } : {}),
    registers: raw.registers,
    sprites: raw.sprites,
    cpu: raw.cpu,
    derived: {
      port01: {
        raw: port01raw,
        loram: !!(port01raw & 1),
        hiram: !!(port01raw & 2),
        charen: !!(port01raw & 4),
      },
      dd00_raw: dd00,
      ...(raw.dd00_direct_read !== undefined ? { dd00_direct_read: raw.dd00_direct_read } : {}),
      vic_bank: bank,
      d018_raw: d018,
      screen_base: screenBase(d018, dd00),
      charset_base: charsetBase(d018, dd00),
      sprite_pointers: spritePointers,
      sprite_data_addresses: spriteDataAddresses,
    },
    captured_at: raw.captured_at,
  };
}

// ---------------------------------------------------------- buildRangeManifest

const IO_START = 0xd000;
const IO_END = 0xdfff;

/** Length of the $00 or $FF run at `start`. A run below the I/O window
 * stops at $D000, so an `unused` range never reaches into it. */
function powerOnRunLength(image: Uint8Array, start: number): number {
  const b = image[start];
  if (b !== 0x00 && b !== 0xff) return 0;
  const limit = start < IO_START ? IO_START : image.length;
  let end = start;
  while (end < limit && image[end] === b) end++;
  return end - start;
}

/**
 * Emit the range manifest in the committed shape: ranges whose union
 * covers $0000-$FFFF with no gap and no overlap, a contiguous power-on-
 * pattern run of at least 16 bytes marked kind `unused`, the I/O window
 * ($D000-$DFFF) marked `io`, everything else `unclassified`, and
 * `classification_state` set to the same transient `ranges-only` state the
 * committed primary manifests carry.
 */
export function buildRangeManifest(image: Uint8Array, meta: RangeManifestMeta = {}) {
  if (image.length !== 65536) {
    throw new Error(`buildRangeManifest: image must be exactly 65536 bytes, got ${image.length}`);
  }
  const ranges: ManifestRange[] = [];
  let i = 0;
  while (i < 65536) {
    if (i >= IO_START && i <= IO_END) {
      ranges.push({ start: i, end: IO_END, kind: "io", source: "capture", note: "VIC-II/SID/CIA/color-RAM I/O window" });
      i = IO_END + 1;
      continue;
    }
    const runLen = powerOnRunLength(image, i);
    if (runLen >= 16) {
      const end = i + runLen - 1;
      ranges.push({ start: i, end, kind: "unused", source: "capture", note: "contiguous $00/$FF power-on-pattern run of at least 16 bytes" });
      i = end + 1;
      continue;
    }
    let j = i;
    while (j < 65536 && !(j >= IO_START && j <= IO_END) && powerOnRunLength(image, j) < 16) {
      j++;
    }
    ranges.push({ start: i, end: j - 1, kind: "unclassified", source: "capture", note: "awaiting the loader/cracktro/game three-bucket partition" });
    i = j;
  }
  return {
    schema_version: 1,
    release: meta.release,
    label: meta.label,
    snapshot_name: meta.snapshot_name ?? null,
    image_bytes: image.length,
    offset_equals_address: true,
    classification_state: "ranges-only",
    ranges,
    note: meta.note ?? "",
    generated_at: meta.generated_at ?? new Date().toISOString(),
  };
}

// -------------------------------------------------------------- writeDumpSet

/** A dump label is part of four file names, so it must be one plain segment. */
const LABEL = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

/**
 * Render and write the four-file dump set from a committed chunk file's
 * contents plus the chip-state raw readings. Returns the written paths and
 * the image digest, in the shape `releases.ts add-dump` reads. Every check
 * runs before the first write. An existing dump set is refused unless
 * `force` is set.
 */
export function writeDumpSet({ releaseId, label, chunks, chipStateRaw, meta = {}, captureExtra = {}, force = false }: WriteDumpSetInput & { force?: boolean }) {
  if (!LABEL.test(label)) throw new Error(`write-set: label ${JSON.stringify(label)} must match ${LABEL.source}`);
  const image = assembleImage(chunks);
  const digest = sha256Buffer(image);
  const stateOut = buildChipState({ ...chipStateRaw, release: releaseId, label });
  const manifestOut = buildRangeManifest(image, { release: releaseId, label, ...meta });
  const dumpsDir = join(releaseDir(releaseId), "dumps");
  const binPath = join(dumpsDir, `${releaseId}-${label}.bin`);
  const statePath = join(dumpsDir, `${releaseId}-${label}.state.json`);
  const mapPath = join(dumpsDir, `${releaseId}-${label}.map.json`);
  const capturePath = join(dumpsDir, `${releaseId}-${label}.capture.json`);
  const existing = [binPath, statePath, mapPath, capturePath].filter((p) => existsSync(p));
  if (existing.length > 0 && !force) {
    throw new Error(`write-set: ${existing.map(rel).join(", ")} already exist(s) -- a committed dump set is evidence; pass --force to replace it`);
  }
  mkdirSync(dumpsDir, { recursive: true });

  writeFileSync(binPath, image);
  writeFileSync(statePath, JSON.stringify(stateOut, null, 2) + "\n");
  writeFileSync(mapPath, JSON.stringify(manifestOut, null, 2) + "\n");

  const captureOut = {
    release: releaseId,
    label,
    sha256: digest,
    bytes: image.length,
    ...captureExtra,
  };
  writeFileSync(capturePath, JSON.stringify(captureOut, null, 2) + "\n");

  return {
    release: releaseId,
    label,
    bin: rel(binPath),
    state: rel(statePath),
    map: rel(mapPath),
    capture: rel(capturePath),
    sha256: digest,
  };
}

// -------------------------------------------------------------------- CLI

function optValue(rest: readonly string[], name: string): string | undefined {
  const i = rest.indexOf(`--${name}`);
  if (i === -1) return undefined;
  const v = rest[i + 1];
  if (v === undefined || v.startsWith("--")) throw new Error(`--${name} needs a value`);
  return v;
}

function readJsonArg<T>(rest: readonly string[], name: string): T | undefined {
  const p = optValue(rest, name);
  if (!p) return undefined;
  const path = resolve(p);
  if (!existsSync(path)) throw new Error(`--${name}: no file at ${path}`);
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (e) {
    throw new Error(`--${name}: ${path} is not valid JSON -- ${e instanceof Error ? e.message : String(e)}`);
  }
}

type Say = (line: string) => void;

const VERBS: Record<string, (rest: string[], say: Say) => ScriptResult> = {
  assemble(rest, say) {
    const chunks = readJsonArg<MemoryChunk[]>(rest, "chunks");
    if (!chunks) return { ok: false, message: "usage: assemble --chunks <chunks.json> [--json]" };
    const image = assembleImage(chunks);
    const digest = sha256Buffer(image);
    say(`${image.length} bytes, sha256 ${digest}`);
    return { ok: true, bytes: image.length, sha256: digest };
  },

  "chip-state"(rest) {
    const raw = readJsonArg<ChipStateRaw>(rest, "raw");
    if (!raw) return { ok: false, message: "usage: chip-state --raw <raw.json> [--json]" };
    return { ok: true, chip_state: buildChipState(raw) };
  },

  manifest(rest) {
    const chunks = readJsonArg<MemoryChunk[]>(rest, "chunks");
    const metaArg = readJsonArg<RangeManifestMeta>(rest, "meta") ?? {};
    if (!chunks) return { ok: false, message: "usage: manifest --chunks <chunks.json> [--meta <meta.json>] [--json]" };
    return { ok: true, manifest: buildRangeManifest(assembleImage(chunks), metaArg) };
  },

  "write-set"(rest, say) {
    const releaseId = optValue(rest, "release");
    const label = optValue(rest, "label");
    const chunks = readJsonArg<MemoryChunk[]>(rest, "chunks");
    const chipStateRaw = readJsonArg<ChipStateRaw>(rest, "raw");
    const metaArg = readJsonArg<RangeManifestMeta>(rest, "meta") ?? {};
    if (!releaseId || !label || !chunks || !chipStateRaw) {
      return { ok: false, message: "usage: write-set --release <id> --label <label> --chunks <chunks.json> --raw <raw.json> [--meta <meta.json>] [--force] [--json]" };
    }
    const result = writeDumpSet({ releaseId, label, chunks, chipStateRaw, meta: metaArg, force: rest.includes("--force") });
    say(`wrote ${result.bin}, ${result.state}, ${result.map}, ${result.capture}`);
    return { ok: true, ...result };
  },
};

/** The whole CLI as a function. `say` receives the human-readable lines. Never throws. */
export function main(argv: readonly string[], say: Say = () => {}): ScriptResult {
  const [cmd, ...rest] = argv.filter((a) => a !== "--json");
  if (!cmd || !Object.hasOwn(VERBS, cmd)) {
    const usage = `usage: node ${fileURLToPath(import.meta.url)} <assemble|chip-state|manifest|write-set> [--json]`;
    return { ok: false, message: cmd ? `unknown command ${JSON.stringify(cmd)}\n${usage}` : usage };
  }
  try {
    return VERBS[cmd](rest, say);
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : String(e) };
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
