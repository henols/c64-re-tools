#!/usr/bin/env node
// Derive a per-release transient allow-list from N >= 3 captures of the same
// stop, and re-check a pair against an already-committed derivation.
//
// Pure logic. This module reads images the agent already captured and does
// arithmetic over them. It contacts nothing: the mcp__plugin_c64-re-tools_vice__* tools are the
// only route to the emulator, and nothing here opens a connection, reads
// broker state, or spawns any process at all -- not even the interpreter
// already running it.
//
// THE METHOD IS THE DELIVERABLE, AND THE ADDRESS SET NEVER IS (`CAP-02`,
// `D-23`). A real release's transients are its own frame counters, RNG state,
// sprite positions and music-player pointers. An allow-list inherited from
// another release cannot be distinguished afterwards from one honestly
// derived, which is why this script re-derives per release and refuses to
// overwrite an existing artifact without an explicit `--force`. What carries
// forward between releases is this file, never its output.
//
// THE RULES IT IMPLEMENTS, in full:
//
//   N >= 3      fewer than three images is refused, naming the count and the
//               minimum. Three runs is already this project's documented
//               minimum for a verified capture.
//   union       the allow-list is the union of addresses differing across
//               EVERY pairwise comparison -- N(N-1)/2 pairs for N images.
//   per entry   the address, which run pairs it differed in (by basename, so
//               the artifact is readable), the distinct byte values seen, and
//               a one-line attribution left empty for a human to fill.
//   cap 64      exceeding it VOIDS the derivation: non-zero exit, no artifact,
//               and the message states the stop is not frame-exact. It is not
//               a threshold to raise. `--cap` only ever NARROWS -- a value
//               above the committed cap is refused by name, so the flag cannot
//               be used to launder an overflow into a pass.
//
// THE TWO RULES IT DOES NOT INHERIT FROM ITS SIBLING, stated explicitly
// because `compare.mjs` sits in this same directory and reads on the same
// captures:
//
//   * NO ADDRESS RANGE IS EVER A VOLATILE SPAN HERE, at any address, under any
//     name. `compare.mjs` excludes four ranges covering 4866 addresses
//     (`$0000-$0001`, `$0100-$01FF`, `$0200-$03FF`, `$D000-$DFFF`). `CAP-02`
//     requires an ENUMERATED list and never a range, and the artifact this
//     script writes carries one entry per address for exactly that reason.
//   * THERE IS NO BIT-COUNT TOLERANCE HERE, at any address, in any form.
//     `compare.mjs` classifies a one-bit difference as "drift" and lets it
//     pass anywhere. A one-bit difference outside the allow-list FAILS here.
//     The cost of getting this wrong is recorded in
//     `src/mcp/vice/capture-predicate.ts`'s header: a predicate carrying
//     either inherited rule passes the phase's one-bit fail-ability control,
//     so the control goes green having proven nothing.
//
// `$D000-$DFFF` IS NOT VOLATILE HERE EITHER, and that is route-specific rather
// than arbitrary. `compare.mjs`'s 4096-address exclusion is a property of the
// memory-READ route, where reading that range samples live I/O registers and
// two reads can never agree. A `.vsf`-sliced image is the `C64MEM` array --
// RAM *under* I/O, not the register read view -- so on the snapshot route the
// exclusion disappears and a difference there is a real difference.
//
// WHY IT CARRIES ITS OWN COMPARISON INSTEAD OF CALLING THE MCP-SIDE ONE.
// `src/mcp/vice/capture-predicate.ts` is the authoritative predicate, and
// `vsf-slice.mjs` in this directory shows the route a skill script takes to
// reach the MCP tree: spawn the interpreter on a CLI entry point. That route
// is unavailable here -- `capture-predicate.ts` is a pure library with no CLI
// entry point, a static cross-package import resolves on neither npm-installer
// route (see `vsf-slice.mjs`'s header for the measured constraint), and
// `scripts/check-npm-packages.mjs`'s transitive closure walk would fail the
// pack for one. So this is the `d64-parse.mjs` answer rather than the
// `vsf-slice.mjs` answer: a second independent implementation of a rule that
// is STABLE and TINY -- set membership over differing addresses, with no
// ranges, no tolerances and no version-sensitive layout anywhere in it. The
// agreement between the two is not left to trust: `derive-transients.test.mjs`
// imports `compareCaptures()` over the same resolution ladder `vsf-slice.mjs`
// uses and asserts that `check`'s verdict matches it on a synthetic pair,
// skipping with a NAMED reason if the MCP tree is absent.
//
// WHAT NOT TO DO:
//   - Never raise the cap because a derivation overflowed it. An overflow
//     means the stop is not frame-exact (`D-22`). MEASURED, for scale: 0
//     differing addresses at a frame-exact `READY`-prompt stop, 66 at a
//     jitter-4000 autostarted stop, 300 at a wall-clock autostarted stop on a
//     real release, 1242 at a wall-clock `READY` stop with the determinism
//     block applied. Over-cap is a real, observed outcome and not a
//     hypothetical, and the answer to it is a better stop.
//   - Never truncate the union to fit the cap. A truncated allow-list makes
//     every later comparison pass on bytes nobody vetted, which is the silent
//     widening the void exists to prevent. The artifact is written once, in
//     full, only after the cap check clears.
//   - Never add `$0000`/`$0001` to a derived allow-list by hand. They are
//     normalised in code by `normalisePorts()` on the snapshot route (`D-24`),
//     and spending two of the cap's 64 slots on them would hide a real
//     difference behind a known one. They can legitimately appear in a
//     derivation taken from un-normalised images -- see `check`'s note below.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { basename } from "node:path";

const IMAGE_BYTES = 65536;

/** The committed maximum number of addresses an allow-list may enumerate
 * (`D-22`). This literal MUST equal `TRANSIENT_ALLOW_LIST_CAP` in
 * `src/mcp/vice/capture-predicate.ts`; the colocated test asserts that
 * equality against the IMPORTED constant rather than against a second copy of
 * the number, so the two cannot drift apart silently. */
const TRANSIENT_ALLOW_LIST_CAP = 64;

/** The committed minimum number of runs a derivation takes (`D-23`). */
const MIN_RUNS = 3;

/** The artifact format version. Bump it when the entry shape changes, never
 * when an address set changes -- address sets are per-release data, not
 * schema. */
const SCHEMA_VERSION = "1.0";

const hex4 = (n) => "$" + n.toString(16).toUpperCase().padStart(4, "0");
const hex2 = (n) => "$" + n.toString(16).toUpperCase().padStart(2, "0");

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

/** The range-shaped keys an entry must never carry, byte-identical to
 * `parseAllowList()`'s own list. Refused BY NAME on the way in AND on the way
 * out: an entry written as a span is an author reaching for the rule `CAP-02`
 * exists to remove. */
const RANGE_SHAPED_KEYS = [
  "start",
  "end",
  "from",
  "to",
  "range",
  "span",
  "lo",
  "hi",
  "first",
  "last",
];

// ---------------------------------------------------------------- argv

/** Which flags each verb accepts, and whether each takes a value.
 *
 * A REAL PARSER, DELIBERATELY, and not `compare.mjs`'s
 * `argv.filter(s => !s.startsWith("--"))` idiom. That filter treats a flag's
 * VALUE as a positional, so `--out probe.json a.bin b.bin c.bin` would derive
 * from four images, one of which is a JSON path. With value-taking flags in
 * the signature that idiom is a defect rather than a shortcut. */
const FLAG_SPEC = {
  derive: { "--release": "value", "--out": "value", "--cap": "value", "--force": "boolean" },
  check: { "--allow-list": "value", "--limit": "value" },
};

function parseArgv(verb, argv) {
  const spec = FLAG_SPEC[verb];
  const flags = Object.create(null);
  const positionals = [];

  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) {
      positionals.push(tok);
      continue;
    }
    const kind = spec[tok];
    if (!kind) {
      throw new Error(
        `${verb}: unknown flag ${tok} -- accepted: ${Object.keys(spec).join(", ")}`,
      );
    }
    if (kind === "boolean") {
      flags[tok] = true;
      continue;
    }
    const value = argv[i + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`${verb}: ${tok} needs a value`);
    }
    flags[tok] = value;
    i++;
  }

  return { flags, positionals };
}

function requiredFlag(verb, flags, name) {
  const v = flags[name];
  if (typeof v !== "string" || v.trim() === "") {
    throw new Error(`${verb}: ${name} is required and must not be empty`);
  }
  return v;
}

// ---------------------------------------------------------------- images

/** Load one image, refusing anything that is not exactly a full 64K capture,
 * naming the path and the length it actually had. Refused rather than
 * compared: two short buffers agree at every address they have. */
function loadImage(path) {
  const buf = readFileSync(path);
  if (buf.length !== IMAGE_BYTES) {
    throw new Error(
      `${path}: ${buf.length} bytes, expected exactly ${IMAGE_BYTES} -- not a full 64K image, and ` +
        `refusing rather than deriving from a partial one, which agrees everywhere it has no bytes`,
    );
  }
  return buf;
}

/** Load every image, in the order given, refusing a basename collision.
 *
 * The pair attributions in the artifact are written by basename, so two
 * images sharing one makes an entry's provenance unreadable -- and passing the
 * same path twice would add a pair that differs nowhere and inflate the pair
 * count with a comparison of an image against itself. */
function loadImages(verb, paths) {
  if (paths.length < MIN_RUNS) {
    throw new Error(
      `${verb}: ${paths.length} image(s) given, minimum ${MIN_RUNS} -- the committed method is ` +
        `N >= ${MIN_RUNS} runs of the same release under the same protocol at the same stop, and three ` +
        `runs is already this project's documented minimum for a verified capture`,
    );
  }
  const byName = new Map();
  const imgs = [];
  for (const path of paths) {
    const name = basename(path);
    const already = byName.get(name);
    if (already !== undefined) {
      throw new Error(
        `${verb}: two images share the basename "${name}" (${already} and ${path}) -- the pair ` +
          `attributions are written by basename, so a collision makes an entry's provenance unreadable`,
      );
    }
    byName.set(name, path);
    imgs.push({ path, name, buf: loadImage(path) });
  }
  return imgs;
}

// ---------------------------------------------------------------- derivation

/**
 * The committed derivation: the union of addresses differing across EVERY
 * pairwise comparison of N images. Returns the union as an ascending entry
 * array plus the pair count, and classifies nothing -- there is no volatile
 * span and no bit-count tolerance anywhere in it.
 */
function deriveUnion(imgs) {
  const union = new Map(); // addr -> { pairs: string[], values: Set<number> }
  const pairs = [];

  for (let i = 0; i < imgs.length; i++) {
    for (let j = i + 1; j < imgs.length; j++) {
      const label = `${imgs[i].name} vs ${imgs[j].name}`;
      pairs.push(label);
      const a = imgs[i].buf;
      const b = imgs[j].buf;
      let n = 0;
      for (let addr = 0; addr < IMAGE_BYTES; addr++) {
        const x = a[addr];
        const y = b[addr];
        if (x === y) continue;
        n++;
        let rec = union.get(addr);
        if (!rec) {
          rec = { pairs: [], values: new Set() };
          union.set(addr, rec);
        }
        rec.pairs.push(label);
        rec.values.add(x);
        rec.values.add(y);
      }
      console.log(`PAIR ${label}: ${n} differing address${n === 1 ? "" : "es"}`);
    }
  }

  // Ascending by address, so the artifact is diffable and an entry's position
  // never depends on which pair happened to observe it first.
  const addresses = [...union.keys()].sort((x, y) => x - y);
  const entries = addresses.map((address) => {
    const rec = union.get(address);
    return {
      address,
      pairs: rec.pairs,
      values: [...rec.values].sort((p, q) => p - q).map(hex2),
      // Left empty for a human to fill. An empty string is a legal
      // attribution and round-trips through `parseAllowList()`; the field
      // exists so an unattributed transient is visibly unattributed rather
      // than absent.
      attribution: "",
    };
  });

  return { entries, pairs };
}

function capFrom(flags) {
  if (flags["--cap"] === undefined) return TRANSIENT_ALLOW_LIST_CAP;
  const n = Number(flags["--cap"]);
  if (!Number.isInteger(n) || n < 1) {
    throw new Error("derive: --cap needs a positive integer");
  }
  if (n > TRANSIENT_ALLOW_LIST_CAP) {
    throw new Error(
      `derive: --cap ${n} is above the committed cap of ${TRANSIENT_ALLOW_LIST_CAP} -- the cap is a ` +
        `pre-commitment, and raising it after seeing a derivation overflow converts a measurement into ` +
        `an excuse. --cap only ever NARROWS`,
    );
  }
  return n;
}

function cmdDerive(argv) {
  const { flags, positionals } = parseArgv("derive", argv);
  const release = requiredFlag("derive", flags, "--release");
  const out = requiredFlag("derive", flags, "--out");
  const cap = capFrom(flags);

  // Checked BEFORE any image is read, so the no-inheritance refusal costs
  // nothing and cannot be reached halfway through a derivation.
  if (existsSync(out) && flags["--force"] !== true) {
    throw new Error(
      `derive: ${out} already exists. An allow-list is re-derived per release from that release's own ` +
        `runs, and no address set is ever inherited between releases -- an inherited list cannot be ` +
        `distinguished afterwards from an honestly derived one, so a contaminated ledger has to be ` +
        `re-derived from fresh captures. Pass --force to replace this artifact with a fresh derivation ` +
        `of "${release}"`,
    );
  }

  const imgs = loadImages("derive", positionals);
  for (const i of imgs) console.log(`${i.name}  sha256 ${sha256(i.buf)}`);

  const { entries, pairs } = deriveUnion(imgs);

  // The count IS the finding, on both paths, so it is printed on both. What
  // differs is that the void path writes nothing.
  console.log(`TRANSIENT_COUNT: ${entries.length}`);
  console.log(`cap: ${cap} (committed cap ${TRANSIENT_ALLOW_LIST_CAP})`);

  if (entries.length > cap) {
    console.error(
      `VOID: the derivation over ${imgs.length} runs of release "${release}" yields ${entries.length} ` +
        `differing addresses, above the cap of ${cap}.\n` +
        `The derivation is VOID. What that means is not "the list is a bit long": it means THE STOP IS ` +
        `NOT FRAME-EXACT, and that is a fact the gate must hear rather than a threshold to move. ` +
        `Re-derive from a frame-anchored stop and record this count as measured; do not raise the cap ` +
        `and do not truncate the union to fit it, which would make every later comparison pass on bytes ` +
        `nobody vetted.\n` +
        `No artifact was written to ${out}.`,
    );
    return 1;
  }

  const artifact = {
    schema_version: SCHEMA_VERSION,
    release,
    derived_from: imgs.map((i) => i.name),
    pair_count: pairs.length,
    cap,
    method:
      `union of addresses differing across every pairwise comparison of N >= ${MIN_RUNS} runs of one ` +
      `release at one stop; re-derived per release, never inherited (CAP-02, D-23)`,
    entries,
  };

  // Written ONCE, in full, only after the cap check cleared. No partial file
  // exists at any point on the void path.
  writeFileSync(out, JSON.stringify(artifact, null, 2) + "\n");
  console.log(`wrote ${out}: release "${release}", ${entries.length} entries, ${pairs.length} pairs`);
  return 0;
}

// ---------------------------------------------------------------- check

/** Parse a committed artifact, with the refusals `parseAllowList()` raises, in
 * the same order -- the cap FIRST, because exceeding it voids the whole
 * derivation and there is nothing to gain from validating the entries of a
 * list that cannot be used. */
function parseArtifact(json, path) {
  if (typeof json !== "object" || json === null || Array.isArray(json)) {
    throw new Error(`${path}: an allow-list artifact must be a JSON object with a release and entries`);
  }
  if (typeof json.release !== "string" || json.release.trim() === "") {
    throw new Error(
      `${path}: the artifact must name the release it was derived from -- an allow-list is re-derived ` +
        `per release and never inherited, so the identifier travels with it`,
    );
  }
  if (!Array.isArray(json.entries)) {
    throw new Error(`${path}: the artifact must carry an entries array -- an enumerated list of addresses`);
  }
  if (json.entries.length > TRANSIENT_ALLOW_LIST_CAP) {
    throw new Error(
      `${path}: the allow-list enumerates ${json.entries.length} addresses, above the committed cap of ` +
        `${TRANSIENT_ALLOW_LIST_CAP} -- exceeding the cap VOIDS the derivation (it means the stop is not ` +
        `frame-exact) and is never repaired by raising the cap`,
    );
  }

  const addresses = new Set();
  for (let i = 0; i < json.entries.length; i++) {
    const entry = json.entries[i];
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)) {
      throw new Error(`${path}: entry ${i} must be an object carrying an address and its run pairs`);
    }
    for (const key of RANGE_SHAPED_KEYS) {
      if (key in entry) {
        throw new Error(
          `${path}: entry ${i} carries the range-shaped key "${key}" -- the transient allow-list is ` +
            `ENUMERATED and is never a range, so write each address as its own entry`,
        );
      }
    }
    const addr = entry.address;
    if (Array.isArray(addr)) {
      throw new Error(
        `${path}: entry ${i} writes its address as an array, which is a range-shaped span -- the ` +
          `transient allow-list is ENUMERATED and is never a range`,
      );
    }
    if (!Number.isInteger(addr) || addr < 0 || addr > 0xffff) {
      throw new Error(`${path}: entry ${i} has address ${JSON.stringify(addr)}, not an integer in 0..65535`);
    }
    if (addresses.has(addr)) {
      throw new Error(
        `${path}: entry ${i} repeats address ${hex4(addr)} -- a duplicate silently consumes a second ` +
          `slot of the cap`,
      );
    }
    if (!Array.isArray(entry.pairs) || entry.pairs.some((p) => typeof p !== "string")) {
      throw new Error(
        `${path}: entry ${i} (address ${hex4(addr)}) must record which run pairs it differed in, as an ` +
          `array of strings`,
      );
    }
    addresses.add(addr);
  }

  return { release: json.release, addresses };
}

/**
 * The equivalence rule, in full, with nothing else in it: a differing address
 * ON the allow-list is counted, reported and excluded from the verdict. ANY
 * other differing address FAILS -- whatever its bit count, wherever it sits,
 * and however close it lies to an allow-listed address. The allow-list is a
 * SET OF ADDRESSES and never a neighbourhood.
 *
 * Symmetric in `a` and `b`: the verdict depends only on WHICH addresses
 * differ, never on which image was passed first.
 */
function compareUnderAllowList(a, b, addresses) {
  const allowed = [];
  const divergence = [];
  for (let addr = 0; addr < IMAGE_BYTES; addr++) {
    const x = a[addr];
    const y = b[addr];
    if (x === y) continue;
    (addresses.has(addr) ? allowed : divergence).push({ addr, a: x, b: y });
  }
  return {
    allowed,
    divergence,
    verdict: divergence.length === 0 ? "equivalent" : "not-equivalent",
  };
}

function printRows(title, rows, limit) {
  console.log(`\n${title}: ${rows.length}`);
  const shown = limit === 0 ? rows : rows.slice(0, limit);
  for (const r of shown) console.log(`  ${hex4(r.addr)}  ${hex2(r.a)}  ->  ${hex2(r.b)}`);
  if (shown.length < rows.length) {
    console.log(`  ... ${rows.length - shown.length} more (--limit 0 for all)`);
  }
}

function cmdCheck(argv) {
  const { flags, positionals } = parseArgv("check", argv);
  const listPath = requiredFlag("check", flags, "--allow-list");
  const limit = flags["--limit"] === undefined ? 40 : Number(flags["--limit"]);
  if (!Number.isInteger(limit) || limit < 0) throw new Error("check: --limit needs a non-negative integer");
  if (positionals.length !== 2) {
    throw new Error(`check: needs exactly two image paths, got ${positionals.length}`);
  }

  const { release, addresses } = parseArtifact(JSON.parse(readFileSync(listPath, "utf8")), listPath);
  const [pa, pb] = positionals;
  const a = loadImage(pa);
  const b = loadImage(pb);

  console.log(`allow-list ${listPath}: release "${release}", ${addresses.size} addresses (cap ${TRANSIENT_ALLOW_LIST_CAP})`);
  console.log(`A  ${basename(pa)}  sha256 ${sha256(a)}`);
  console.log(`B  ${basename(pb)}  sha256 ${sha256(b)}`);

  const r = compareUnderAllowList(a, b, addresses);
  printRows("allowed (enumerated transients, excluded from the verdict)", r.allowed, limit);
  printRows("DIVERGENCE -- outside the allow-list, fails at any bit count", r.divergence, limit);

  console.log(`\nCHECK_VERDICT: ${r.verdict}`);
  return r.verdict === "equivalent" ? 0 : 1;
}

// ---------------------------------------------------------------- CLI

const commands = { derive: cmdDerive, check: cmdCheck };

const [cmd, ...rest] = process.argv.slice(2);
if (!cmd || !commands[cmd]) {
  console.error(`usage: node derive-transients.mjs <command>

  derive --release <id> --out <path> [--cap N] [--force] <a.bin> <b.bin> <c.bin> [...]
        Derive the per-release transient allow-list: the union of addresses differing across
        every pairwise comparison of N >= ${MIN_RUNS} captures of one release at one stop.
        Prints TRANSIENT_COUNT: <n>. Over the cap of ${TRANSIENT_ALLOW_LIST_CAP} the derivation
        is VOID -- non-zero exit, no artifact written, because the stop is not frame-exact.

  check --allow-list <path> [--limit N] <a.bin> <b.bin>
        Re-check one pair against an already-committed derivation, without re-deriving it.
        Prints CHECK_VERDICT: equivalent | not-equivalent. Exit 1 when not equivalent.

The allow-list is ENUMERATED, never a range, and there is no bit-count tolerance at any
address: a one-bit difference outside the list FAILS. \`compare.mjs\`'s volatile spans and
its drift-passes rule are NOT inherited here -- see this file's header for why, and for why
\`$D000-$DFFF\` is not volatile on the snapshot route.

The method is re-derived per release and NO address set is ever inherited between releases;
re-deriving over an existing artifact is refused without --force. \`--cap\` only narrows.

\`check\` compares the images exactly as given. On the snapshot route the \`$0000\`/\`$0001\`
6510-port overlay is normalised in code by the MCP-side predicate (D-24), so a derivation
taken from un-normalised images can legitimately carry those two addresses.

Images come from the capture procedure in this skill's SKILL.md. This script contacts
nothing and spawns nothing.`);
  process.exit(cmd ? 1 : 0);
}

try {
  process.exit(commands[cmd](rest));
} catch (e) {
  console.error(`error: ${e.message}`);
  process.exit(1);
}
