#!/usr/bin/env node
// make-sidecar.mjs -- turn one capture-run.mjs bundle plus its sliced 64K
// image into the chip-state sidecar `compare-cross-binary.mjs` reads.
//
// WHY THIS FILE EXISTS: two committed contracts name a key called
// `registers`, and they do NOT agree on its shape.
//
//   - c64-ram-capture/SKILL.md's `raw.json` step says `registers` passes
//     through VERBATIM from vice_vicii_get_state -- a decoded document
//     ("control1", "spriteX", "borderColour", ...).
//   - compare-cross-binary.mjs's own loadState()/normalizeRegisters() reads
//     `registers` as an ADDRESS -> VALUE map and refuses the whole sidecar
//     BY NAME when any key does not parse as an address.
//
// The consumer's contract wins, because it is the one that is actually
// executed: plan 50-04 Task 2 states outright that the comparison module
// reads the sidecar. So `registers` here is the address -> value map, decoded
// from vice_vicii_get_state's own `registersHex` field -- which is the
// literal run of register bytes the chip returned, not a re-derivation -- and
// every field SKILL.md's raw.json names is preserved unchanged under an
// explicitly named sibling key (`vicii_raw`, `sprites`, `cpu`, `port01_raw`,
// `dd00_raw`, `d018_raw`, `sprite_pointers`). Nothing is dropped; one key is
// renamed so the document is loadable by the module that consumes it.
//
// WHAT NOT TO DO: do not "fix" this by making `registers` the decoded VIC-II
// document again. That reintroduces the refusal, and the refusal is silent
// about which of the two contracts it meant.

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

function arg(name, fallback) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const bundlePath = arg("bundle");
const imagePath = arg("image");
const outPath = arg("out");
if (!bundlePath || !imagePath || !outPath) {
  console.error("usage: make-sidecar.mjs --bundle <run-X.bundle.json> --image <X.bin> --out <X.state.json>");
  process.exit(2);
}

const bundle = JSON.parse(readFileSync(bundlePath, "utf8"));
const image = readFileSync(imagePath);
if (image.length !== 65536) {
  throw new Error(`${imagePath}: ${image.length} bytes, expected 65536 -- refusing to build a sidecar for a partial image`);
}

const vicii = bundle.vicii;
if (!vicii || typeof vicii.registersHex !== "string" || typeof vicii.base !== "number") {
  throw new Error(`${bundlePath}: no vice_vicii_get_state answer with base + registersHex -- refusing to fabricate one`);
}

// Decode the literal register bytes the chip returned, at their real
// addresses. `base` is $D000 and `registersHex` runs to $D02E on this build.
const registers = {};
const hex = vicii.registersHex;
if (hex.length % 2 !== 0) throw new Error(`${bundlePath}: registersHex has an odd length (${hex.length})`);
for (let i = 0; i < hex.length / 2; i++) {
  const addr = vicii.base + i;
  registers["$" + addr.toString(16).toUpperCase().padStart(4, "0")] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
}

// The three bytes SKILL.md's raw.json names individually. $D018 is already
// inside the VIC-II window above and is re-asserted from its own read here;
// a disagreement between the two reads would be a real finding, so it is
// checked rather than silently overwritten.
const oneByte = (text, label) => {
  const doc = JSON.parse(text);
  if (typeof doc.hex !== "string" || doc.hex.length !== 2) {
    throw new Error(`${bundlePath}: ${label} is not a single-byte hex read`);
  }
  return { addr: doc.address, value: parseInt(doc.hex, 16) };
};

const p01 = oneByte(bundle.port01_raw, "port01_raw");
const dd00 = oneByte(bundle.dd00_raw, "dd00_raw");
const d018 = oneByte(bundle.d018_raw, "d018_raw");

const d018Key = "$" + d018.addr.toString(16).toUpperCase().padStart(4, "0");
if (registers[d018Key] !== undefined && registers[d018Key] !== d018.value) {
  throw new Error(
    `${bundlePath}: $D018 read directly (${d018.value}) disagrees with the VIC-II register block (${registers[d018Key]}) -- refusing to pick one silently`,
  );
}
registers["$" + p01.addr.toString(16).toUpperCase().padStart(4, "0")] = p01.value;
registers["$" + dd00.addr.toString(16).toUpperCase().padStart(4, "0")] = dd00.value;

// The eight sprite pointers at screen_base+$3F8, read out of the captured
// image rather than recomputed -- vice_sprite_get already reported
// pointerTableAddress, and this asserts the two agree.
const screenBase = bundle.sprites?.screenBase;
const pointerTableAddress = bundle.sprites?.pointerTableAddress;
if (typeof screenBase !== "number" || typeof pointerTableAddress !== "number") {
  throw new Error(`${bundlePath}: vice_sprite_get answer carries no screenBase/pointerTableAddress`);
}
if (screenBase + 0x3f8 !== pointerTableAddress) {
  throw new Error(
    `${bundlePath}: screenBase+$3F8 (${screenBase + 0x3f8}) does not equal the reported pointerTableAddress (${pointerTableAddress})`,
  );
}
const spritePointers = [...image.subarray(pointerTableAddress, pointerTableAddress + 8)];

const subjectSha = createHash("sha256").update(readFileSync(bundle.subject_prg)).digest("hex");
if (subjectSha !== bundle.subject_prg_sha256) {
  throw new Error(`subject .prg sha256 changed since the run (${bundle.subject_prg_sha256} -> ${subjectSha}) -- refusing`);
}

const sidecar = {
  // --- read by compare-cross-binary.mjs ---
  route: "snapshot",
  checkpoint_name: bundle.checkpoint_name,
  checkpoint_address: bundle.checkpoint_address,
  registers,

  // --- capture identity ---
  subject_prg: bundle.subject_prg,
  subject_prg_sha256: subjectSha,
  entry_address: bundle.entry_address,
  image_sha256: createHash("sha256").update(image).digest("hex"),
  snapshot_path: bundle.snapshot?.path ?? null,

  // --- SKILL.md raw.json passthrough, unchanged ---
  vicii_raw: vicii,
  sprites: bundle.sprites,
  cpu: bundle.cpu,
  port01_raw: p01.value,
  dd00_raw: dd00.value,
  d018_raw: d018.value,
  sprite_pointers: spritePointers,

  // --- checkpoint hygiene, recorded rather than asserted in prose ---
  checkpoint_list_after_delete: JSON.parse(bundle.checkpoint_list_after_delete),
};

writeFileSync(outPath, JSON.stringify(sidecar, null, 2) + "\n");
console.log(`wrote ${outPath}`);
console.log(`  route=${sidecar.route} checkpoint=${sidecar.checkpoint_name} @ $${sidecar.checkpoint_address.toString(16).toUpperCase()}`);
console.log(`  registers=${Object.keys(registers).length} image_sha256=${sidecar.image_sha256}`);
console.log(`  checkpoints after delete = ${sidecar.checkpoint_list_after_delete.totalReported}`);
