#!/usr/bin/env node
// The artifact renderer (01-04 Task 1, Part B). This module exists because
// of a structural fact worth stating up front: the executing agent can
// write text, not binary, so the only shape a committable 65536-byte image
// can take under the one permitted route to the emulator is *the agent
// serialises what it fetched via mcp__plugin_c64-re-tools_vice__* tool calls, and a pure
// function renders it*. Every function below takes already-fetched data as
// an argument -- nothing here contacts the emulator.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

import { releaseDir } from "./releases.mjs";
import { projectRoot } from "./project-paths.mjs";
import { addrNum, hex4 } from "./watch-loads.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = projectRoot();

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

function rel(p) {
  return relative(REPO_ROOT, p);
}

// ---------------------------------------------------------------- assembleImage

/**
 * Assemble the ordered `{ address, hex }` chunk records the agent wrote
 * after its `mcp__plugin_c64-re-tools_vice__vice_memory_read` calls into a 65536-byte buffer.
 * Asserts contiguity from $0000 with no gap and no overlap and a total of
 * exactly 65536 bytes, naming the offending address in every failure.
 */
export function assembleImage(chunks) {
  const sorted = [...chunks].sort((a, b) => addrNum(a.address) - addrNum(b.address));
  const bufs = [];
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

/** SHA-256 of a buffer, hex-encoded. `node:crypto` only -- no package added (D-18). */
export function sha256Buffer(buf) {
  return createHash("sha256").update(buf).digest("hex");
}

// ----------------------------------------------------------------- vicBank

/**
 * VIC-II bank number (0-3) from CIA2 port A ($DD00)'s low two bits. The
 * stored value is the INVERSE of the bank number (c64-memory-mapping skill
 * memmap: raw value %00 = "Bank #3" $C000-$FFFF ... %11 = "Bank #0"
 * $0000-$3FFF), so bank = 3 - (raw & 3). Verified against
 * a committed chip-state sidecar's own recorded
 * dd00_raw=193 (0xC1, low bits %01) -> vic_bank=2, which this formula
 * reproduces exactly.
 */
export function vicBank(dd00Raw) {
  return 3 - (dd00Raw & 3);
}

// --------------------------------------------------------------- screenBase

/**
 * Screen memory base address, derived from $D018's bits 4-7 (screen pointer,
 * in 1024-byte units relative to the VIC bank) added to the VIC bank's own
 * base (bank * 16384). Verified against the same committed sidecar:
 * dd00_raw=193, d018_raw=49 (0x31) -> screen_base=35840, reproduced exactly.
 */
export function screenBase(d018Raw, dd00Raw) {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const screenOffset = ((d018Raw >> 4) & 0xf) * 1024;
  return bankBase + screenOffset;
}

/** Character memory base: $D018 bits 1-3, in 2048-byte units relative to the VIC bank. */
function charsetBase(d018Raw, dd00Raw) {
  const bank = vicBank(dd00Raw);
  const bankBase = bank * 16384;
  const charsetOffset = ((d018Raw >> 1) & 0x7) * 2048;
  return bankBase + charsetOffset;
}

// -------------------------------------------------------------- buildChipState

/**
 * Build the D-04 chip-state sidecar in the exact shape the committed
 * primary sidecars already use (same top-level keys, same `derived` field
 * set), from the register/state readings the agent recorded. `raw` carries
 * whatever the agent fetched via vice_registers_get / vice_sprite_get /
 * vice_memory_read, keyed to match: `registers`, `sprites`, `cpu` pass
 * through verbatim; `dd00_raw`, `d018_raw`, `port01_raw` and
 * `sprite_pointers` (the bytes read from the sprite-pointer table at
 * screen_base+$3F8..$3FF) feed the derivation.
 */
export function buildChipState(raw) {
  const dd00 = raw.dd00_raw;
  const d018 = raw.d018_raw;
  const bank = vicBank(dd00);
  const bankBase = bank * 16384;
  const screenBaseAddr = screenBase(d018, dd00);
  const charsetBaseAddr = charsetBase(d018, dd00);
  const port01raw = raw.port01_raw;
  const spritePointers = raw.sprite_pointers ?? [];
  const spriteDataAddresses = spritePointers.map((p) => bankBase + p * 64);

  return {
    schema_version: 1,
    release: raw.release,
    label: raw.label,
    snapshot_name: raw.snapshot_name ?? null,
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
      dd00_direct_read: raw.dd00_direct_read ?? dd00,
      vic_bank: bank,
      d018_raw: d018,
      screen_base: screenBaseAddr,
      charset_base: charsetBaseAddr,
      sprite_pointers: spritePointers,
      sprite_data_addresses: spriteDataAddresses,
    },
    captured_at: raw.captured_at ?? new Date().toISOString(),
  };
}

// ---------------------------------------------------------- buildRangeManifest

const IO_START = 0xd000;
const IO_END = 0xdfff;

function powerOnRunLength(image, start) {
  const b = image[start];
  if (b !== 0x00 && b !== 0xff) return 0;
  let end = start;
  while (end < image.length && image[end] === b) end++;
  return end - start;
}

/**
 * Emit the D-02 range manifest in the committed shape: ranges whose union
 * covers $0000-$FFFF with no gap and no overlap, a contiguous power-on-
 * pattern run of at least 16 bytes marked kind `unused`, the I/O window
 * ($D000-$DFFF) marked `io`, everything else `unclassified`, and
 * `classification_state` set to the same transient `ranges-only` state the
 * committed primary manifests carry.
 */
export function buildRangeManifest(image, meta = {}) {
  if (image.length !== 65536) {
    throw new Error(`buildRangeManifest: image must be exactly 65536 bytes, got ${image.length}`);
  }
  const ranges = [];
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

/**
 * Render and write the four-file dump set from a committed chunk file's
 * contents plus the chip-state raw readings. Returns the written paths and
 * the image digest, so a caller can register a `dumps[]` entry.
 */
export function writeDumpSet({ releaseId, label, chunks, chipStateRaw, meta = {}, captureExtra = {} }) {
  const image = assembleImage(chunks);
  const digest = sha256Buffer(image);
  const dumpsDir = join(releaseDir(releaseId), "dumps");
  mkdirSync(dumpsDir, { recursive: true });

  const binPath = join(dumpsDir, `${releaseId}-${label}.bin`);
  writeFileSync(binPath, image);

  const stateOut = buildChipState({ ...chipStateRaw, release: releaseId, label });
  const statePath = join(dumpsDir, `${releaseId}-${label}.state.json`);
  writeFileSync(statePath, JSON.stringify(stateOut, null, 2) + "\n");

  const manifestOut = buildRangeManifest(image, { release: releaseId, label, ...meta });
  const mapPath = join(dumpsDir, `${releaseId}-${label}.map.json`);
  writeFileSync(mapPath, JSON.stringify(manifestOut, null, 2) + "\n");

  const captureOut = {
    release: releaseId,
    label,
    sha256: digest,
    bytes: image.length,
    ...captureExtra,
  };
  const capturePath = join(dumpsDir, `${releaseId}-${label}.capture.json`);
  writeFileSync(capturePath, JSON.stringify(captureOut, null, 2) + "\n");

  return {
    bin: rel(binPath),
    state: rel(statePath),
    map: rel(mapPath),
    capture: rel(capturePath),
    sha256: digest,
  };
}

// -------------------------------------------------------------------- CLI

function optValue(rest, name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}

function readJsonArg(rest, name) {
  const p = optValue(rest, name);
  if (!p) return undefined;
  return JSON.parse(readFileSync(resolve(p), "utf8"));
}

const VERBS = {
  assemble(rest) {
    const chunks = readJsonArg(rest, "chunks");
    if (!chunks) die("usage: assemble --chunks <chunks.json> [--json]");
    const image = assembleImage(chunks);
    const digest = sha256Buffer(image);
    const result = { bytes: image.length, sha256: digest };
    console.log(rest.includes("--json") ? JSON.stringify(result, null, 2) : `${result.bytes} bytes, sha256 ${result.sha256}`);
  },

  "chip-state"(rest) {
    const raw = readJsonArg(rest, "raw");
    if (!raw) die("usage: chip-state --raw <raw.json> [--json]");
    const result = buildChipState(raw);
    console.log(JSON.stringify(result, null, 2));
  },

  manifest(rest) {
    const chunks = readJsonArg(rest, "chunks");
    const metaArg = readJsonArg(rest, "meta") ?? {};
    if (!chunks) die("usage: manifest --chunks <chunks.json> [--meta <meta.json>] [--json]");
    const image = assembleImage(chunks);
    const result = buildRangeManifest(image, metaArg);
    console.log(JSON.stringify(result, null, 2));
  },

  "write-set"(rest) {
    const releaseId = optValue(rest, "release");
    const label = optValue(rest, "label");
    const chunks = readJsonArg(rest, "chunks");
    const chipStateRaw = readJsonArg(rest, "raw");
    const metaArg = readJsonArg(rest, "meta") ?? {};
    if (!releaseId || !label || !chunks || !chipStateRaw) {
      die("usage: write-set --release <id> --label <label> --chunks <chunks.json> --raw <raw.json> [--meta <meta.json>] [--json]");
    }
    const result = writeDumpSet({ releaseId, label, chunks, chipStateRaw, meta: metaArg });
    console.log(JSON.stringify(result, null, 2));
  },
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !VERBS[cmd]) {
    console.log(`usage: node ${fileURLToPath(import.meta.url)} <assemble|chip-state|manifest|write-set> [--json]`);
    process.exitCode = cmd ? 1 : 0;
  } else {
    VERBS[cmd](rest);
  }
}
