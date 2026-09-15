#!/usr/bin/env node
// make-hazard-subject-annostore.mjs -- the reproducible generator for the
// hazard-subject family's committed store exports.
//
// WHY THIS SCRIPT EXISTS AND WHY IT NEVER HAND-WRITES THE JSON: a committed
// export is the input the multi-file export path and its reassembly
// criterion run on. A hand-typed JSON document would silently become the
// ground truth for that criterion regardless of whether it actually matched
// what the source assembles to. This script instead assembles the real
// root, reads back real ACME symbol addresses (never hand-transcribed),
// decomposes the image into a fresh in-memory store through this project's
// own write API, and exports that store with the existing
// `exportStoreDocument()` entry point -- the same one every other committed
// `.annostore.json` in this tree is produced through.
//
// HOW THE DECOMPOSITION IS DERIVED: every range boundary below is an ACME
// symbol address read from a real `--symbollist` run, never a byte offset
// this script computed by hand. The one place this script's OWN judgement
// enters is which four spans are typed `external_file` (the four data
// tables) and which spans belong to which scope (one per hazard-bearing
// routine) -- everything else is a mechanical walk of symbols in address
// order. A `decode()` sanity pass at the end confirms every declared range
// boundary lands on a real instruction start, so a future source edit that
// silently changes a boundary's meaning fails this script loudly rather than
// producing a plausible-looking wrong export.
//
// TWO SUBJECTS, ONE SHARED DECOMPOSITION (plan 50-02): `SUBJECTS` holds two
// entries -- the committed `hazard-subject.a` (unchanged behaviour, same
// output as before this script was parameterised) and the modified subject
// (`hazard-subject-align-nosprite.a` swapped in for the alignment
// construction, matching `make-hazard-subject-fixtures.mjs`'s own
// `modifiedRootSource()`). The decomposition logic -- the `ranges`/`scopes`
// arrays, the `LABELS` list, the `decode()` sanity pass, the partition
// check -- runs UNCHANGED for both: every boundary is a symbol lookup, so
// the modified subject's shifted addresses (the alignment routine shrinks
// when the sprite block is removed) are picked up automatically and
// nothing is hand-transcribed for either subject.
//
// REFUSE-RATHER-THAN-PARTIAL-WRITE, ACROSS SUBJECTS: every subject is
// assembled and decomposed BEFORE any output file is written. If any
// subject in `SUBJECTS` fails -- ACME refusal, a missing symbol, a sanity
// or partition-check failure -- this script refuses and writes NO output
// file for ANY subject, not just the one that failed. A generator that
// wrote the first subject's export and then failed on the second would
// leave one committed export silently out of sync with a run that never
// actually completed.
//
// Regenerate with:
//   cd src/mcp/vice && node fixtures/hazard-subject/make-hazard-subject-annostore.mjs

import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { openStore, closeStore, setDataType, setLabel, setComment, addScope } from "../../anno-store.ts";
import { exportStoreDocument } from "../../anno-store-export.ts";
import { decode } from "../../disasm-decoder.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ACME_BIN = process.env.ACME_BIN ?? "acme";
const ROOT_SOURCE_NAME = "hazard-subject.a";

const ALIGN_SOURCE_LINE = '!source "hazard-subject-align.a"';
const ALIGN_NOSPRITE_SOURCE_LINE = '!source "hazard-subject-align-nosprite.a"';

function fail(reason) {
  process.stderr.write(`make-hazard-subject-annostore: ${reason}\n`);
  process.stderr.write("make-hazard-subject-annostore: REFUSING to write a partial export -- nothing was changed.\n");
  process.exit(1);
}

/** Builds the modified subject's root text by swapping the ONE `!source`
 * line that pulls in the alignment construction for the no-sprite variant's
 * own file -- the identical substitution
 * `make-hazard-subject-fixtures.mjs`'s `modifiedRootSource()` performs.
 * Refuses rather than silently exporting the WRONG subject if the committed
 * root ever stops containing that exact line. */
function modifiedRootSource() {
  const rootText = readFileSync(join(HERE, ROOT_SOURCE_NAME), "utf8");
  if (!rootText.includes(ALIGN_SOURCE_LINE)) {
    fail(`hazard-subject.a no longer contains ${JSON.stringify(ALIGN_SOURCE_LINE)} -- the modified subject's root substitution has nothing to replace`);
  }
  return rootText.replace(ALIGN_SOURCE_LINE, ALIGN_NOSPRITE_SOURCE_LINE);
}

/** The two subjects this script owns. The first entry keeps this script's
 * pre-parameterisation behaviour exactly: its root is the committed
 * `hazard-subject.a`, assembled directly, and its output is the original
 * `hazard-subject.annostore.json`. The second entry's root is synthesized
 * in memory (see above), and its output is the new
 * `hazard-subject-modified.annostore.json`. */
const SUBJECTS = [
  { rootSourceName: ROOT_SOURCE_NAME, output: "hazard-subject.annostore.json" },
  { buildRootText: modifiedRootSource, output: "hazard-subject-modified.annostore.json" },
];

// Same probe-then-refuse ladder every other regenerator and gate in this
// tree uses: argv-array only, never a shell-interpreted command string.
function probeAcmeBanner() {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 30_000 });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8", timeout: 30_000 });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return { ok: false, detail: String(r.error.message) };
  if (!/acme/i.test(banner)) return { ok: false, detail: `neither --version nor --help printed an ACME banner (exit ${String(r.status)})` };
  return { ok: true, detail: "" };
}

const probe = probeAcmeBanner();
if (!probe.ok) {
  fail(`no usable ACME at ${JSON.stringify(ACME_BIN)} (set ACME_BIN, or put \`acme\` on PATH): ${probe.detail}`);
}

/** Assembles one subject (either its committed root file, or a synthesized
 * root built in memory -- exactly one of `rootSourceName`/`buildRootText`
 * is set per SUBJECTS entry, mirroring `make-hazard-subject-fixtures.mjs`'s
 * own branching), reads back real symbol addresses, and returns the raw
 * bytes and the symbol map. Never writes anything outside a throwaway temp
 * directory. */
function assembleSubject(subject) {
  const workDir = mkdtempSync(join(tmpdir(), "make-hazard-subject-annostore-"));
  try {
    const outPrg = join(workDir, "out.prg");
    const outSym = join(workDir, "out.sym");

    let acmeSourceArg;
    if (subject.rootSourceName) {
      const sourcePath = join(HERE, subject.rootSourceName);
      if (!existsSync(sourcePath)) fail(`the ACME source ${JSON.stringify(sourcePath)} does not exist`);
      acmeSourceArg = subject.rootSourceName;
    } else {
      const tempRootPath = join(workDir, `synthesized-root-${subject.output}.a`);
      writeFileSync(tempRootPath, subject.buildRootText());
      acmeSourceArg = tempRootPath;
    }

    // `cwd: HERE` is load-bearing regardless of which branch above ran:
    // every `!source` line in either root (committed or synthesized) is a
    // bare filename with no directory component, and ACME resolves a
    // relative `!source` argument against the assembler's own working
    // directory, not against the root file's own location.
    const r = spawnSync(ACME_BIN, ["--cpu", "6510", "-f", "cbm", "-o", outPrg, "--symbollist", outSym, acmeSourceArg], {
      encoding: "utf8",
      timeout: 30_000,
      cwd: HERE,
    });
    if (r.status !== 0) fail(`ACME refused ${subject.output}'s root (exit ${String(r.status)}):\n${r.stderr ?? ""}`);
    if (!existsSync(outPrg) || !existsSync(outSym)) fail(`ACME exited 0 for ${subject.output}'s root but did not write both the output image and the symbol list`);

    const bytes = new Uint8Array(readFileSync(outPrg));
    const symbols = new Map();
    for (const line of readFileSync(outSym, "utf8").split("\n")) {
      const m = line.match(/^\s*(\S+)\s*=\s*\$([0-9a-fA-F]+)/);
      if (m) symbols.set(m[1], parseInt(m[2], 16));
    }
    return { bytes, symbols };
  } finally {
    rmSync(workDir, { recursive: true, force: true });
  }
}

/** Builds this subject's decomposition -- ranges, scopes, labels, comments,
 * the `decode()` sanity pass and the partition check -- and returns the
 * exported store document. Identical decomposition LOGIC for every subject;
 * every boundary is a symbol lookup against THIS subject's own symbol map,
 * so a subject whose addresses shifted (the modified subject's alignment
 * routine shrinks once the sprite block is removed) is picked up
 * automatically. */
function buildExportDocument(subjectOutput, bytes, symbols) {
  function sym(name) {
    const v = symbols.get(name);
    if (v === undefined) fail(`${subjectOutput}: ACME's own symbol list does not contain ${JSON.stringify(name)} -- the source and this generator's boundary list have drifted apart`);
    return v;
  }

  const origin = bytes[0] | (bytes[1] << 8);
  const payload = bytes.subarray(2);
  const imageEndInclusive = origin + payload.length - 1;

  // ---------------------------------------------------------------------
  // The decomposition. Every boundary is a real ACME symbol address; the
  // two alignment-directive filler gaps (before the character set, and
  // between the character set and the sprite shape) are folded into the
  // range that PRECEDES each gap (the setup routine's own code, and the
  // character set's own external-file range respectively) rather than
  // carved out separately -- both readings are honest (reserved padding
  // belongs conceptually to whichever construct asked for the alignment),
  // and folding them in keeps every boundary a plain symbol-to-symbol span.
  // ---------------------------------------------------------------------

  const ranges = [
    { start: origin, endInclusive: sym("entry") - 1, dataType: "byte" }, // BASIC loader stub
    { start: sym("entry"), endInclusive: sym("hazard_smc_entry") - 1, dataType: "code" }, // root: entry dispatcher + hazard_dispatch_entry
    { start: sym("hazard_smc_entry"), endInclusive: sym("hazard_smc2_write") - 1, dataType: "code" }, // first self-modification
    { start: sym("hazard_smc2_write"), endInclusive: sym("dispatch_target_1") - 1, dataType: "code" }, // second self-modification
    { start: sym("dispatch_target_1"), endInclusive: sym("dispatch_hi") - 1, dataType: "code" }, // the three dispatch targets
    { start: sym("dispatch_hi"), endInclusive: sym("dispatch_lo") - 1, dataType: "byte" },
    { start: sym("dispatch_lo"), endInclusive: sym("decline_hi") - 1, dataType: "byte" },
    { start: sym("decline_hi"), endInclusive: sym("decline_lo") - 1, dataType: "byte" },
    { start: sym("decline_lo"), endInclusive: sym("dispatch_decline_entry") - 1, dataType: "byte" },
    { start: sym("dispatch_decline_entry"), endInclusive: sym("hazard_align_entry") - 1, dataType: "code" },
    { start: sym("hazard_align_entry"), endInclusive: sym("align_char_base") - 1, dataType: "code" }, // register setup (+ its own alignment padding)
    { start: sym("align_char_base"), endInclusive: sym("align_sprite_base") - 1, dataType: "external_file" }, // character set (+ its own alignment padding)
    { start: sym("align_sprite_base"), endInclusive: sym("align_level_table") - 1, dataType: "external_file" }, // sprite shape
    { start: sym("align_level_table"), endInclusive: sym("align_music_table") - 1, dataType: "external_file" }, // level table
    { start: sym("align_music_table"), endInclusive: sym("hazard_raster_entry") - 1, dataType: "external_file" }, // music table
    { start: sym("hazard_raster_entry"), endInclusive: imageEndInclusive, dataType: "code" }, // the timer-stabilised raster routine
  ];

  // One scope per hazard-bearing routine. The root's own inline code and the
  // four data tables stay UNSCOPED -- they are not themselves a planted
  // hazard, and the multi-file export's own D47-D "goes somewhere, never
  // nowhere" rule already gives unscoped bytes a home (`unscoped.a`).
  const scopes = [
    { start: sym("hazard_smc_entry"), endInclusive: sym("hazard_smc2_write") - 1 }, // smc scope (first construction)
    { start: sym("hazard_smc2_write"), endInclusive: sym("dispatch_target_1") - 1 }, // smc2 scope (second construction)
    { start: sym("dispatch_target_1"), endInclusive: sym("hazard_align_entry") - 1 }, // dispatch scope
    { start: sym("hazard_align_entry"), endInclusive: sym("align_char_base") - 1 }, // align scope (setup code only)
    { start: sym("hazard_raster_entry"), endInclusive: imageEndInclusive }, // raster scope
  ];

  // Every address referenced by a branch, a subroutine call, a jump, or a
  // data reference from inside the image (the dispatch table entries and the
  // routines they name, the sprite shape base and the character-set base,
  // plus every other routine entry point for readability). The two
  // self-modified bytes below are deliberately ABSENT from this list -- see
  // the comments section.
  const LABELS = [
    "entry",
    "hazard_smc_entry",
    "hazard_dispatch_entry",
    "hazard_align_entry",
    "hazard_raster_entry",
    "hazard_smc2_write",
    "hazard_smc2_entry",
    "dispatch_target_1",
    "dispatch_target_2",
    "dispatch_target_3",
    "dispatch_hi",
    "dispatch_lo",
    "decline_hi",
    "decline_lo",
    "dispatch_decline_entry",
    "align_char_base",
    "align_sprite_base",
    "align_level_table",
    "align_music_table",
    "hazard_raster_irq",
    "hazard_raster_timer_phase",
    "hazard_raster_irq_exit",
  ];

  // -----------------------------------------------------------------------
  // Sanity pass: every declared range/scope boundary must be a real
  // instruction start, and the ranges must partition the image with no hole
  // and no overlap, before a single row is written.
  // -----------------------------------------------------------------------

  const instructions = decode(payload, origin);
  const instructionStarts = new Set(instructions.map((i) => i.address));

  // Only CODE-typed range starts (and every scope start, which this script
  // only ever places at a code-range boundary) are checked against
  // `decode()`'s own instruction starts -- a data range's start is a symbol
  // address, not necessarily an address `decode()` (which knows nothing about
  // typing and reads data bytes as if they were instructions too) would ever
  // treat as one, so checking it there would fail for the wrong reason.
  for (const r of ranges) {
    if (r.dataType !== "code") continue;
    if (r.start !== origin && !instructionStarts.has(r.start)) {
      fail(`${subjectOutput}: code range boundary $${r.start.toString(16)} is not a real instruction start -- the source and this generator's boundary list have drifted apart`);
    }
  }
  for (const s of scopes) {
    if (!instructionStarts.has(s.start)) {
      fail(`${subjectOutput}: scope boundary $${s.start.toString(16)} is not a real instruction start -- the source and this generator's boundary list have drifted apart`);
    }
  }

  let expected = origin;
  for (const r of ranges) {
    if (r.start !== expected) fail(`${subjectOutput}: range gap or overlap at $${expected.toString(16)}..$${(r.start - 1).toString(16)} -- the ranges must partition the image with no hole`);
    if (r.endInclusive < r.start) fail(`${subjectOutput}: range ${r.start}..${r.endInclusive} is inverted`);
    expected = r.endInclusive + 1;
  }
  if (expected !== imageEndInclusive + 1) {
    fail(`${subjectOutput}: the declared ranges end at $${(expected - 1).toString(16)} but the image ends at $${imageEndInclusive.toString(16)} -- coverage is incomplete`);
  }

  // -----------------------------------------------------------------------
  // Build the decomposition in a fresh, throwaway store, then export it.
  // -----------------------------------------------------------------------

  const storeWorkDir = mkdtempSync(join(tmpdir(), "make-hazard-subject-annostore-store-"));
  const storePath = join(storeWorkDir, "hazard-subject.annostore");
  try {
    const handle = openStore(storePath, { workspaceRoot: storeWorkDir });
    try {
      for (const scope of scopes) addScope(handle, { start: scope.start, endInclusive: scope.endInclusive });
      for (const range of ranges) setDataType(handle, { start: range.start, endInclusive: range.endInclusive, dataType: range.dataType });
      for (const name of LABELS) setLabel(handle, { address: sym(name), name, kind: "User" });

      setComment(handle, {
        address: sym("hazard_smc_entry"),
        commentType: "line",
        text:
          "DECLINED: this is the first self-modification's own opcode byte -- the NOP this routine's host instruction starts with, " +
          "overwritten in place with $60 (the RTS opcode) by the STA instruction later in the same routine. Its effective opcode " +
          "varies across passes through the routine (NOP on the first pass, RTS afterward) and there is no single correct symbol or " +
          "value to name here.",
      });
      // Attached to hazard_smc2_write's own START address, not smc2_operand_addr
      // (that instruction's own operand byte, one past its opcode): a generic
      // multi-file export can only attach a comment to an instruction's start
      // address or to an address an annotation label already names, and
      // smc2_operand_addr is deliberately NOT a store label (a store label here
      // would be exactly the "misleading symbol" this construction avoids on
      // purpose). Attaching the comment to the host instruction's own start
      // still says the same thing about the operand byte one past it. This
      // text is still accurate for the modified subject: the second
      // construction's operand byte is still rewritten at runtime through a
      // pointer no static operand names -- the only thing that changed is
      // that the construction now actually RUNS.
      setComment(handle, {
        address: sym("hazard_smc2_write"),
        commentType: "line",
        text:
          "DECLINED: this instruction's own operand byte -- one past its opcode, the immediate operand of the LDA at " +
          "hazard_smc2_write -- is rewritten in place by an indirect-indexed store through a zero-page pointer built entirely at " +
          "runtime. Its effective value varies across calls to hazard_smc2_write (one value before the patch, a different one " +
          "after) and there is no single correct symbol or value to name here. No static operand anywhere in this image names this " +
          "address, which is exactly why a report reading this program shows no self-modification finding at it.",
      });

      return exportStoreDocument(handle, { storeName: "hazard-subject.annostore" });
    } finally {
      closeStore(handle);
    }
  } finally {
    rmSync(storeWorkDir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Run the whole pipeline once per subject, buffering every output document
// in memory. Nothing is written to disk until every subject has succeeded --
// see the header comment's "REFUSE-RATHER-THAN-PARTIAL-WRITE, ACROSS
// SUBJECTS" section.
// ---------------------------------------------------------------------------

const writes = [];
for (const subject of SUBJECTS) {
  const { bytes, symbols } = assembleSubject(subject);
  const doc = buildExportDocument(subject.output, bytes, symbols);
  writes.push({ path: join(HERE, subject.output), doc });
}

for (const { path, doc } of writes) {
  writeFileSync(path, JSON.stringify(doc, null, 2) + "\n");
  process.stdout.write(`make-hazard-subject-annostore: wrote ${path.split("/").pop()} (${doc.ranges.length} ranges, ${doc.labels.length} labels, ${doc.comments.length} comments, ${doc.scopes.length} scopes)\n`);
}
