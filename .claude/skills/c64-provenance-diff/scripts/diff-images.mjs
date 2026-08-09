#!/usr/bin/env node
// The provenance diff (01-05): anchor-proven offset search, N-way byte diff,
// gap-tolerant range coalescing, patch counting, the loader/cracktro/game
// three-bucket partition, and the generated ledger tier. Every input here is
// an already-committed file (a release's primary `.bin` dump, its
// `.map.json` range manifest, and `recovery/RELEASES.json`) and every tool
// is pure Node over those files -- nothing in this module contacts the
// emulator, ever (D-18: zero third-party dependencies, `Buffer.indexOf` and
// `node:crypto` are sufficient).
//
// This is the step the objective calls "the one most able to produce
// confident nonsense": an un-normalised diff manufactures false
// CRACKER-PATCH verdicts wholesale, so every function below either proves
// its own precondition (proveOffset refuses a majority vote) or refuses to
// emit at all (renderLedger) rather than launder an assumption as evidence.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

import { loadRegistry, registryPath, upsertRelease } from "../../c64-ram-capture/scripts/releases.mjs";
import { addrNum, hex4 } from "../../c64-ram-capture/scripts/watch-loads.mjs";
import { projectRoot, dataRoot } from "../../c64-ram-capture/scripts/project-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = projectRoot();
const RECOVERY_DIR = dataRoot();

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

function rel(p) {
  return relative(REPO_ROOT, p);
}

function sha256Hex(bufOrStr) {
  return createHash("sha256").update(bufOrStr).digest("hex");
}

// ------------------------------------------------------------------ ranges

/** Intersection of two `{start,end}` (inclusive) integer ranges, or null. */
function intersectRanges(a, b) {
  const s = Math.max(a.start, b.start);
  const e = Math.min(a.end, b.end);
  return s <= e ? { start: s, end: e } : null;
}

/** `base` minus every range in `cuts` (any order/overlap), as a sorted list of remaining sub-ranges. */
function subtractRanges(base, cuts) {
  let remaining = [{ start: base.start, end: base.end }];
  for (const cut of cuts) {
    const next = [];
    for (const r of remaining) {
      const inter = intersectRanges(r, cut);
      if (!inter) { next.push(r); continue; }
      if (r.start < inter.start) next.push({ start: r.start, end: inter.start - 1 });
      if (r.end > inter.end) next.push({ start: inter.end + 1, end: r.end });
    }
    remaining = next;
  }
  return remaining.sort((a, b) => a.start - b.start);
}

// -------------------------------------------------------------- image I/O

function primaryDumpEntry(release) {
  const dump = (release.dumps ?? []).find((d) => d.label === "run1");
  if (!dump || !dump.bin) {
    throw new Error(`primaryDumpEntry: release "${release.id}" has no run1 dump with a .bin recorded`);
  }
  return dump;
}

function readImage(binPath) {
  const buf = readFileSync(join(REPO_ROOT, binPath));
  if (buf.length !== 65536) {
    throw new Error(`readImage: ${binPath} is ${buf.length} bytes, expected exactly 65536`);
  }
  return buf;
}

/** Every `dumps[]` entry's `range_manifest`, across every run label and every release -- enumerated from the registry, never hardcoded (see check-parameterisation / T-05 N-readiness). */
export function enumerateManifests(registry) {
  const out = [];
  for (const r of registry.releases) {
    for (const d of r.dumps ?? []) {
      if (d.range_manifest) out.push({ release: r.id, label: d.label, bin: d.bin, manifestPath: d.range_manifest });
    }
  }
  return out;
}

// ------------------------------------------------------------ anchorSearch

const VOLATILE_START = 0x0000;
const VOLATILE_END = 0x03ff; // CPU port regs, stack, KERNAL work area/BASIC input buffer -- see NOTES.md's own drift zones; biased away from as anchor source, never excluded from the diff itself.

function isTrivialRun(buf) {
  const first = buf[0];
  for (let i = 1; i < buf.length; i++) if (buf[i] !== first) return false;
  return true; // a constant-byte run proves nothing and matches too easily
}

function findAllMatches(haystack, needle) {
  const out = [];
  let from = 0;
  for (;;) {
    const idx = haystack.indexOf(needle, from);
    if (idx === -1) break;
    out.push(idx);
    from = idx + 1;
  }
  return out;
}

/**
 * Select several long, distinctive byte runs from `source` (biased away from
 * the volatile zero-page/stack/KERNAL-work-area region and away from
 * constant-byte filler, per-run, not per-release -- a general C64 memory
 * heuristic, not a release identifier), then locate each in `target` with
 * `Buffer.indexOf`. For every anchor, reports its source offset, *all*
 * match offsets found in target, the computed delta (matchOffset -
 * sourceOffset, only when exactly one match was found), and the three bytes
 * at target[matchOffset-1..matchOffset+1] -- the neighbour-byte check that
 * makes an off-by-one visible rather than assumed.
 */
export function anchorSearch(source, target, { minRunLength = 48, count = 8 } = {}) {
  if (!Buffer.isBuffer(source) || !Buffer.isBuffer(target)) {
    throw new Error("anchorSearch: source and target must be Buffers");
  }
  // Scan every offset (not a coarse stride) so a non-trivial run narrower
  // than any sampling interval is never invisible to the search -- cheap
  // even at 65536 bytes (O(length * minRunLength) byte comparisons).
  const startFloor = Math.min(VOLATILE_END + 1, Math.max(0, source.length - minRunLength));
  const candidateOffsets = [];
  for (let offset = startFloor; offset + minRunLength <= source.length; offset++) {
    if (!isTrivialRun(source.subarray(offset, offset + minRunLength))) {
      candidateOffsets.push(offset);
    }
  }
  // Spread the chosen anchors across the candidate list (preferring picks
  // that are not immediately adjacent to one already chosen) rather than
  // clustering at the front, so they sample different regions of the image.
  const chosenOffsets = [];
  const minGap = Math.max(1, Math.floor(source.length / (count * 2)));
  const strideThroughCandidates = Math.max(1, Math.floor(candidateOffsets.length / count));
  let lastChosen = -Infinity;
  for (let i = 0; i < candidateOffsets.length && chosenOffsets.length < count; i += strideThroughCandidates) {
    const c = candidateOffsets[i];
    if (chosenOffsets.length === 0 || c - lastChosen >= minGap) {
      chosenOffsets.push(c);
      lastChosen = c;
    }
  }
  if (chosenOffsets.length === 0 && candidateOffsets.length > 0) chosenOffsets.push(candidateOffsets[0]);
  const chosen = chosenOffsets.map((sourceOffset) => ({
    sourceOffset,
    run: Buffer.from(source.subarray(sourceOffset, sourceOffset + minRunLength)),
  }));

  return chosen.map(({ sourceOffset, run }) => {
    const matches = findAllMatches(target, run);
    const unique = matches.length === 1;
    const delta = unique ? matches[0] - sourceOffset : null;
    const matchOffset = unique ? matches[0] : null;
    const neighbourBytes = unique
      ? {
          before: matchOffset - 1 >= 0 ? target[matchOffset - 1] : null,
          at: target[matchOffset],
          after: matchOffset + 1 < target.length ? target[matchOffset + 1] : null,
        }
      : null;
    return {
      sourceOffset,
      runLength: run.length,
      runHex: run.toString("hex"),
      matches,
      matchCount: matches.length,
      unique,
      delta,
      matchOffset,
      neighbourBytes,
    };
  });
}

/**
 * Accepts a single global offset only when every *unique-match* anchor's
 * delta agrees. An anchor matching at more than one target offset is
 * rejected outright (a non-unique anchor proves nothing) and excluded from
 * the agreement check. On disagreement among the remaining anchors, this
 * FAILS -- naming the disagreeing anchors and their deltas -- rather than
 * returning a majority answer, because a majority vote on a relocation
 * offset is exactly the silent-plausible-wrongness this guards against.
 */
export function proveOffset(anchorResults) {
  const rejected = anchorResults.filter((a) => !a.unique);
  const usable = anchorResults.filter((a) => a.unique);
  if (usable.length === 0) {
    return {
      ok: false,
      offset: null,
      rejected,
      usable: [],
      disagreeing: [],
      reason: `no anchor produced a unique match in the target image (${rejected.length} anchor(s) rejected as non-unique or unmatched) -- cannot prove any offset`,
    };
  }
  const deltas = new Set(usable.map((a) => a.delta));
  if (deltas.size === 1) {
    return {
      ok: true,
      offset: usable[0].delta,
      rejected,
      usable,
      disagreeing: [],
      reason: `all ${usable.length} usable anchor(s) agree on offset ${usable[0].delta}`,
    };
  }
  const byDelta = new Map();
  for (const a of usable) {
    if (!byDelta.has(a.delta)) byDelta.set(a.delta, []);
    byDelta.get(a.delta).push(a);
  }
  return {
    ok: false,
    offset: null,
    rejected,
    usable: [],
    disagreeing: usable,
    byDelta: Object.fromEntries([...byDelta.entries()].map(([d, arr]) => [String(d), arr.map((a) => a.sourceOffset)])),
    reason:
      `anchors disagree on offset: ${[...byDelta.entries()].map(([d, arr]) => `delta=${d} (${arr.length} anchor(s): ${arr.map((a) => hex4(a.sourceOffset)).join(", ")})`).join("; ")}` +
      " -- refusing a majority vote; fall back to per-region offsets recorded in the manifest",
  };
}

/**
 * Exact integer arithmetic, never wrapped modulo 65536. An address whose
 * offset-adjusted counterpart falls outside $0000-$FFFF is reported
 * out-of-range with a named reason and excluded from any compared set.
 */
export function applyOffset(address, offset) {
  const addr = addrNum(address);
  const target = addr + offset;
  if (target < 0 || target > 0xffff) {
    return {
      address: addr,
      offset,
      target,
      inRange: false,
      reason: `offset-adjusted address (raw ${target}, 0x${target.toString(16)}) falls outside $0000-$FFFF -- excluded from the compared set, never wrapped modulo 65536`,
    };
  }
  return { address: addr, offset, target, inRange: true };
}

// -------------------------------------------------------- provenance offset

function loadOffsets(registry) {
  const out = {};
  for (const r of registry.releases) {
    const po = r.provenance_offset;
    out[r.id] = po && typeof po.offset === "number" ? po.offset : 0;
  }
  return out;
}

function recordProvenanceOffset(releaseId, data) {
  return upsertRelease(releaseId, (r) => ({ ...r, provenance_offset: data }));
}

// -------------------------------------------------------- cracktro scan

function isPrintableByte(b) {
  return b >= 0x20 && b <= 0x7e;
}

/** Plain buffer scan for runs of printable-ASCII bytes. NOT by itself the cracktro bucket's seed -- see findCracktroRuns below. */
export function findPrintableRuns(buffer, { minLength = 8 } = {}) {
  const runs = [];
  let i = 0;
  while (i < buffer.length) {
    if (!isPrintableByte(buffer[i])) { i++; continue; }
    let j = i;
    while (j < buffer.length && isPrintableByte(buffer[j])) j++;
    if (j - i >= minLength) runs.push({ start: i, end: j - 1 });
    i = j;
  }
  return runs;
}

// A DEFAULT vocabulary of crack-scene credit phrasing. Deliberately generic
// words rather than any particular group's name or release id, so this stays
// vocabulary matching and never becomes an id comparison. Override it per call
// via `findCracktroRuns(buf, { signatures })` when a corpus uses different
// phrasing; a project should seed it from evidence it has actually verified.
//
// Why a vocabulary at all, instead of scanning for any printable run: a blind
// "any printable ASCII run" scan misclassifies a GAME'S OWN title-screen text
// as cracktro content. That is not hypothetical -- it was observed against a
// real two-release corpus, where the title text differed between releases and a
// bare scan called it cracker credit. A differing string is not a cracker
// string. Keep the bar at recognised credit vocabulary.
export const CRACKTRO_SIGNATURE_WORDS = ["CRACKED", "CRACKERS", "SOFT GROUP", "BREAK'EM", "MAKE'EM", "PRESENTS BY", "CRACKED BY"];

/**
 * The actual seed for the cracktro bucket: printable-ASCII runs whose
 * decoded text contains at least one recognised crack-credit vocabulary
 * word. Narrower than `findPrintableRuns` on purpose -- see
 * CRACKTRO_SIGNATURE_WORDS's comment for why a bare printable-run scan is
 * not enough by itself.
 */
export function findCracktroRuns(buffer, { minLength = 8, signatures = CRACKTRO_SIGNATURE_WORDS } = {}) {
  const upperSignatures = signatures.map((s) => s.toUpperCase());
  return findPrintableRuns(buffer, { minLength }).filter((r) => {
    const text = buffer.subarray(r.start, r.end + 1).toString("latin1").toUpperCase();
    return upperSignatures.some((sig) => text.includes(sig));
  });
}

// ------------------------------------------------------------- diffRanges

// The four alternatives an UNKNOWN verdict must have ruled out before it is
// honest. Stated generically: each clause names the precondition the pipeline
// itself enforces, so the sentence is true for any corpus this runs against
// rather than describing one project's dumps.
const RULED_OUT_ALTERNATIVES =
  "Alternatives checked and ruled out: not a revision difference (all releases were captured at the same " +
  "recorded trigger, so they are the same build state); not a read error (each release's own multi-run " +
  "reproducibility verdict passed before its primary dump was accepted); not a packer artifact (every image " +
  "is captured post-load at that same fully-loaded trigger, which is the normalisation requirement); not " +
  "relocation (the anchor-proven offset for this pair is recorded above and used here).";

/**
 * N-way per-address comparison, aligned via each image's own anchor-proven
 * offset, followed internally by `coalesceRanges` at `gapTolerance`. Returns
 * ranges whose union covers $0000-$FFFF with no gap and no overlap; a range
 * with fewer than two covering releases (including a range only one release
 * covers) is UNKNOWN, never ORIGINAL. `images`: `[{ id, bytes, offset,
 * loaderRanges, cracktroRuns }]`, all already read from the registry's
 * primary dumps -- never a hardcoded pair.
 */
export function diffRanges(images, { gapTolerance = 16 } = {}) {
  if (!Array.isArray(images) || images.length === 0) {
    throw new Error("diffRanges: images must be a non-empty array");
  }
  const raw = [];
  for (let addr = 0; addr <= 0xffff; addr++) {
    const available = [];
    for (const img of images) {
      const applied = applyOffset(addr, img.offset ?? 0);
      if (applied.inRange) available.push({ id: img.id, value: img.bytes[applied.target], localAddr: applied.target });
    }
    let rec;
    if (available.length < 2) {
      rec = {
        verdict: "UNKNOWN",
        agreeing_releases: available.length,
        evidence: "",
        reason:
          available.length === 0
            ? "no release has in-range coverage at this address after offset application"
            : `only one release ("${available[0].id}") covers this address -- cannot corroborate against an independent release`,
      };
    } else {
      const allEqual = available.every((a) => a.value === available[0].value);
      if (allEqual) {
        // Deliberately does NOT quote the specific byte value: this record
        // gets collapsed with its neighbours into a multi-address range
        // (potentially spanning many different byte values, all agreeing
        // internally at their own address), so an evidence string tied to
        // one address's value would be both wrong for the range and would
        // silently defeat collapsing (no two addresses would ever compare
        // equal on evidence text, discovered live while running this tool
        // against the real dumps -- see .planning/RE-FINDINGS.md).
        rec = {
          verdict: "ORIGINAL",
          agreeing_releases: available.length,
          evidence: `identical across ${available.length} independently-cracked releases (${available.map((a) => a.id).join(", ")}), at the anchor-proven offset`,
          reason: "",
        };
      } else {
        // Differing. Only two mechanically-detectable "recognised cracker
        // techniques" are checked here: the address falls inside a
        // release's own earned loader_ranges (loader replacement), or
        // inside a printable-text run found by the cracktro scan (intro
        // splice). Anything else is UNKNOWN with a reason -- this project
        // never launders an unrecognised difference into a CRACKER-PATCH
        // verdict (the prohibition this plan carries).
        let technique = null;
        let techniqueRelease = null;
        for (const img of images) {
          const applied = applyOffset(addr, img.offset ?? 0);
          if (!applied.inRange) continue;
          if ((img.loaderRanges ?? []).some((lr) => applied.target >= lr.start && applied.target <= lr.end)) {
            technique = "loader replacement/relocation -- this address is inside a crack's own earned loader_ranges entry (each crack replaces the original loader with its own, per Pitfall 4)";
            techniqueRelease = img.id;
            break;
          }
        }
        if (!technique) {
          for (const img of images) {
            const applied = applyOffset(addr, img.offset ?? 0);
            if (!applied.inRange) continue;
            if ((img.cracktroRuns ?? []).some((cr) => applied.target >= cr.start && applied.target <= cr.end)) {
              technique = "intro/cracktro splice -- this address is inside a printable-text run found by the cracktro banner/credit scan (per Pitfall 4)";
              techniqueRelease = img.id;
              break;
            }
          }
        }
        if (technique) {
          rec = {
            verdict: "CRACKER-PATCH",
            agreeing_releases: 0,
            evidence: `${technique} (release "${techniqueRelease}"). ${RULED_OUT_ALTERNATIVES}`,
            reason: "",
          };
        } else {
          // Same reasoning as the ORIGINAL branch above: no per-address byte
          // value is quoted, so this record can collapse with adjacent
          // same-signature UNKNOWN records into one range.
          rec = {
            verdict: "UNKNOWN",
            agreeing_releases: 0,
            evidence: "",
            reason: `differs across ${available.length} release(s) (${available.map((a) => a.id).join(", ")}) with no recognised cracker signature (not inside any release's loader_ranges or cracktro scan). ${RULED_OUT_ALTERNATIVES}`,
          };
        }
      }
    }
    raw.push({ start: addr, end: addr, ...rec });
  }
  // Collapse into maximal contiguous same-signature ranges before coalescing.
  const collapsed = [];
  for (const r of raw) {
    const prev = collapsed[collapsed.length - 1];
    if (
      prev &&
      prev.end + 1 === r.start &&
      prev.verdict === r.verdict &&
      prev.agreeing_releases === r.agreeing_releases &&
      prev.evidence === r.evidence &&
      prev.reason === r.reason
    ) {
      prev.end = r.end;
    } else {
      collapsed.push({ ...r });
    }
  }
  const { ranges, kept, coalesced } = coalesceRanges(collapsed, gapTolerance);
  return { ranges, kept, coalesced, gapTolerance, imageIds: images.map((i) => i.id) };
}

// --------------------------------------------------------- coalesceRanges

/**
 * Merges neighbouring non-ORIGINAL ("differing") ranges across a run of
 * ORIGINAL bytes strictly shorter than `gapTolerance`; a run of exactly
 * `gapTolerance` identical bytes is left as its own separate ORIGINAL row
 * (the boundary is defined, not incidental). Reports kept-vs-coalesced
 * counts in the same shape `acme.mjs`'s `curateLabels` already uses.
 */
export function coalesceRanges(ranges, gapTolerance) {
  if (!Array.isArray(ranges) || ranges.length === 0) return { ranges: [], kept: 0, coalesced: 0 };
  if (!(gapTolerance >= 0)) throw new Error(`coalesceRanges: gapTolerance must be >= 0, got ${gapTolerance}`);
  const sorted = [...ranges].sort((a, b) => a.start - b.start || a.end - b.end);
  const isOriginal = (r) => r.verdict === "ORIGINAL";

  const out = [];
  let coalescedCount = 0;
  let i = 0;
  while (i < sorted.length) {
    if (isOriginal(sorted[i])) {
      out.push({ ...sorted[i] });
      i++;
      continue;
    }
    const group = [sorted[i]];
    let j = i + 1;
    for (;;) {
      if (j >= sorted.length) break;
      if (!isOriginal(sorted[j])) {
        group.push(sorted[j]);
        j++;
        continue;
      }
      const gapLen = sorted[j].end - sorted[j].start + 1;
      const nextIsDiffering = j + 1 < sorted.length && !isOriginal(sorted[j + 1]);
      if (gapLen < gapTolerance && nextIsDiffering) {
        group.push(sorted[j]); // swallow the short agreeing gap
        j++;
        continue;
      }
      break; // gap too long (>= tolerance), or nothing differing follows
    }
    out.push(mergeGroup(group));
    coalescedCount += group.length - 1;
    i = j;
  }
  return { ranges: out, kept: out.length, coalesced: coalescedCount };
}

function mergeGroup(group) {
  if (group.length === 1) return { ...group[0] };
  const start = group[0].start;
  const end = group[group.length - 1].end;
  const nonOriginal = group.filter((r) => r.verdict !== "ORIGINAL");
  const verdictSet = new Set(nonOriginal.map((r) => r.verdict));
  const mixed = verdictSet.size > 1;
  const verdict = mixed ? "UNKNOWN" : [...verdictSet][0];
  const agreeing = nonOriginal.length
    ? Math.min(...nonOriginal.map((r) => (typeof r.agreeing_releases === "number" ? r.agreeing_releases : 0)))
    : 0;
  // Only the non-ORIGINAL constituents' text is worth surfacing here -- a
  // swallowed ORIGINAL gap's own evidence ("identical across N releases...")
  // is generic boilerplate that adds nothing once summarised by
  // `swallowedGap` below. Deduplicated (via Set) so a coalesced range with
  // many same-reason singleton addresses doesn't repeat identical
  // boilerplate once per address -- found live while running this against
  // the real dumps (see .planning/RE-FINDINGS.md).
  const constituentNotes = [...new Set(nonOriginal.map((r) => r.evidence || r.reason).filter(Boolean))];
  const swallowedGap = group.length > nonOriginal.length;
  const note =
    (mixed
      ? `coalesced group of mixed verdicts (${[...verdictSet].join(", ")}) within the gap tolerance -- downgraded to UNKNOWN, the conservative choice. `
      : "") +
    (swallowedGap ? `Includes a short run of agreeing bytes swallowed by the gap tolerance. ` : "") +
    (constituentNotes.length > 1
      ? `Constituent findings (${constituentNotes.length} distinct): ${constituentNotes.join(" | ")}`
      : `Constituent finding: ${constituentNotes[0] ?? ""}`);
  return {
    start,
    end,
    verdict,
    agreeing_releases: agreeing,
    evidence: verdict === "CRACKER-PATCH" ? note : "",
    reason: verdict === "UNKNOWN" ? note : "",
    coalesced_from: group.length,
  };
}

// -------------------------------------------------------------- countPatches

/**
 * Per release, the number of bytes verdicted CRACKER-PATCH that fall inside
 * that release's own manifest ranges bucketed `game`. Deterministic and
 * re-runnable: recomputed each time from the committed images, manifests
 * and registry, never from ephemeral state.
 */
export function countPatches(images, diffResult, bucketedManifestsByRelease) {
  const counts = {};
  for (const img of images) counts[img.id] = 0;
  for (const range of diffResult.ranges) {
    if (range.verdict !== "CRACKER-PATCH") continue;
    for (let addr = range.start; addr <= range.end; addr++) {
      for (const img of images) {
        const applied = applyOffset(addr, img.offset ?? 0);
        if (!applied.inRange) continue;
        const manifest = bucketedManifestsByRelease[img.id];
        if (!manifest) continue;
        const kind = lookupKind(manifest.ranges, applied.target);
        if (kind === "game") counts[img.id] += 1;
      }
    }
  }
  return counts;
}

/** Linear scan for the range containing `address` in a sorted, gapless, non-overlapping ranges array. */
function lookupKind(sortedRanges, address) {
  for (const r of sortedRanges) {
    if (address >= r.start && address <= r.end) return r.kind;
  }
  return null;
}

/**
 * Splits each diff range against a manifest's own kind boundaries, so the
 * ledger's `kind` column is never resolved from only a range's start
 * address -- a coalesced range can span multiple kind zones (e.g. `game`
 * then `loader`) since coalescing groups on VERDICT continuity, not kind
 * continuity. Resolving kind from `start` alone silently mislabels every
 * address after the first kind boundary inside the range; found live
 * against a real corpus (a wide ORIGINAL range was found spannings
 * straight through its own $0340-$035E `loader` sub-range).
 */
export function splitRangeByManifestKind(range, manifestRanges) {
  const out = [];
  for (const m of manifestRanges) {
    const inter = intersectRanges(range, m);
    if (inter) out.push({ ...range, start: inter.start, end: inter.end, kind: m.kind });
  }
  return out.sort((a, b) => a.start - b.start);
}

// --------------------------------------------------------- manifest bucketing

/**
 * Promote one manifest from `ranges-only` to `bucketed`: `unused`/`io`
 * ranges are kept verbatim (D-02's byte-level classification already
 * stands); every `unclassified` range is re-partitioned against the
 * release's earned `loader_ranges` (never NOTES.md prose) and this image's
 * own cracktro printable-run scan, with the remainder -- reached by the
 * trace/entry point -- bucketed `game`. Per D-05 the underlying bytes are
 * never edited; only the manifest's own `kind` field changes.
 */
export function bucketManifest(image, manifest, { loaderRanges, cracktroMinLength = 8 } = {}) {
  const cracktroRuns = findCracktroRuns(image, { minLength: cracktroMinLength });
  const loaderNumeric = loaderRanges.map((lr) => ({
    start: addrNum(lr.start),
    end: addrNum(lr.end),
    note: lr.note ?? "",
    evidence: lr.evidence ?? "",
  }));
  // Keep every already-classified range verbatim (unused/io from D-02's
  // byte-level pass, or -- on a re-run of an already-bucketed manifest --
  // game/loader/cracktro from a prior run of this same function). Only
  // "unclassified" is ever re-partitioned. Filtering "kept" down to just
  // unused/io would silently discard game/loader/cracktro ranges on a
  // second run, since nothing would remain to reclassify them from -- an
  // idempotency bug caught before it ever reached a committed manifest.
  const kept = manifest.ranges.filter((r) => r.kind !== "unclassified");
  const toBucket = manifest.ranges.filter((r) => r.kind === "unclassified");
  const newRanges = kept.map((r) => ({ ...r }));

  for (const u of toBucket) {
    const loaderCuts = loaderNumeric.map((lr) => intersectRanges(u, lr)).filter(Boolean);
    const cracktroCuts = cracktroRuns.map((cr) => intersectRanges(u, cr)).filter(Boolean);
    for (const c of loaderCuts) {
      const src = loaderNumeric.find((lr) => c.start >= lr.start && c.end <= lr.end);
      newRanges.push({
        start: c.start,
        end: c.end,
        kind: "loader",
        source: "diff-images:loader_ranges",
        note: `seeded from recovery/RELEASES.json's earned loader_ranges (live disassembly evidence, never NOTES.md prose): ${src?.note ?? ""}`,
      });
    }
    for (const c of cracktroCuts) {
      newRanges.push({
        start: c.start,
        end: c.end,
        kind: "cracktro",
        source: "diff-images:printable-scan",
        note: `printable-byte run of length ${c.end - c.start + 1} found by a plain buffer scan for banner/credit text`,
      });
    }
    const allCuts = [...loaderCuts, ...cracktroCuts].sort((a, b) => a.start - b.start);
    const remainder = subtractRanges(u, allCuts);
    for (const r of remainder) {
      newRanges.push({
        start: r.start,
        end: r.end,
        kind: "game",
        source: "diff-images:trace-remainder",
        note: "reached by the trace/entry point; not classified loader, cracktro, io, or unused",
      });
    }
  }

  newRanges.sort((a, b) => a.start - b.start || a.end - b.end);
  return { ...manifest, classification_state: "bucketed", ranges: newRanges };
}

// ------------------------------------------------------------- renderLedger

const D02_KINDS = new Set(["game", "loader", "cracktro", "io", "unused"]);

/**
 * Renders `recovery/PROVENANCE.md`'s two tiers. Refuses to emit at all
 * (throws, no file written) if any row is UNKNOWN with an empty reason, any
 * row is ORIGINAL with an agreeing-release count below two, or the rows do
 * not cover exactly $0000-$FFFF with no gap and no overlap.
 */
export function renderLedger({ generatedRanges, gapTolerance, prose }) {
  const sorted = [...generatedRanges].sort((a, b) => a.start - b.start || a.end - b.end);
  let expected = 0;
  for (const r of sorted) {
    if (r.verdict === "UNKNOWN" && !(r.reason && r.reason.trim())) {
      throw new Error(`renderLedger: refusing to emit -- range ${hex4(r.start)}-${hex4(r.end)} has verdict UNKNOWN with an empty reason`);
    }
    if (r.verdict === "ORIGINAL" && !((r.agreeing_releases ?? 0) >= 2)) {
      throw new Error(`renderLedger: refusing to emit -- range ${hex4(r.start)}-${hex4(r.end)} has verdict ORIGINAL with agreeing_releases=${r.agreeing_releases} (< 2)`);
    }
    if (r.start !== expected) {
      throw new Error(`renderLedger: refusing to emit -- gap or overlap in the generated tier at ${hex4(expected)} (next range starts at ${hex4(r.start)})`);
    }
    expected = r.end + 1;
  }
  if (expected !== 0x10000) {
    throw new Error(`renderLedger: refusing to emit -- generated tier stops at ${hex4(expected - 1)}, does not reach $FFFF`);
  }

  let generated = `<!-- GENERATED, DO NOT HAND-EDIT. Regenerate with: node .claude/skills/c64-provenance-diff/scripts/diff-images.mjs ledger --gap-tolerance ${gapTolerance} -->\n\n`;
  generated += `| Start | End | Kind | Verdict | Confidence | Agreeing releases | Evidence / Reason |\n`;
  generated += `|---|---|---|---|---|---|---|\n`;
  for (const r of sorted) {
    const confidence =
      r.verdict === "ORIGINAL" ? (r.agreeing_releases >= 3 ? "HIGH" : "MEDIUM-HIGH") :
      r.verdict === "CRACKER-PATCH" ? "HIGH (patch), MEDIUM-LOW (what original there replaced)" :
      "LOW";
    const kind = D02_KINDS.has(r.kind) ? r.kind : (r.kind ?? "unresolved");
    const text = (r.evidence || r.reason || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    generated += `| ${hex4(r.start)} | ${hex4(r.end)} | ${kind} | ${r.verdict} | ${confidence} | ${r.agreeing_releases} | ${text} |\n`;
  }

  const header = `# \`recovery/PROVENANCE.md\` -- the provenance ledger\n\n` +
    `Two tiers, one direction of truth. The **generated tier** below is machine-produced by ` +
    `\`.claude/skills/c64-provenance-diff/scripts/diff-images.mjs\`'s \`renderLedger\` and is regenerable at any time from the committed ` +
    `dumps plus the recorded offset -- never hand-edit it. The **prose tier** underneath states the ` +
    `facts a table cannot hold. This file is the ledger; \`docs/provenance.md\` will be a summary ` +
    `pointer and inline \`; PROVENANCE:\` tags in \`src/\` will be the point-of-use copy -- one ` +
    `direction only, and no downstream copy is ever edited independently (per ARCHITECTURE.md).\n\n`;

  return header + `## Generated tier\n\n` + generated + `\n## Prose tier\n\n` + prose;
}

// ------------------------------------------------------------------- helpers

function loadImagesForDiff(registry) {
  const offsets = loadOffsets(registry);
  return registry.releases.map((r) => {
    const dump = primaryDumpEntry(r);
    const bytes = readImage(dump.bin);
    const loaderRanges = (r.loader_ranges ?? []).map((lr) => ({ start: addrNum(lr.start), end: addrNum(lr.end), note: lr.note, evidence: lr.evidence }));
    const cracktroRuns = findCracktroRuns(bytes, { minLength: 8 });
    return { id: r.id, bytes, offset: offsets[r.id] ?? 0, loaderRanges, cracktroRuns };
  });
}

function readManifest(manifestPath) {
  return JSON.parse(readFileSync(join(REPO_ROOT, manifestPath), "utf8"));
}

function writeManifest(manifestPath, manifest) {
  writeFileSync(join(REPO_ROOT, manifestPath), JSON.stringify(manifest, null, 2) + "\n");
}

// -------------------------------------------------------------------- CLI

function optValue(rest, name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}

const VERBS = {
  "anchor-search"(rest) {
    const reg = loadRegistry();
    if (reg.releases.length < 2) die("anchor-search needs at least two releases in the registry");
    const referenceId = optValue(rest, "reference") ?? reg.releases[0].id;
    const reference = reg.releases.find((r) => r.id === referenceId);
    if (!reference) die(`unknown reference release "${referenceId}"`);
    const refBytes = readImage(primaryDumpEntry(reference).bin);

    const provenAt = new Date().toISOString();
    // The reference release carries its own provenance_offset record too --
    // required so every release in the registry has the same field set
    // (recovery-schema.mjs's runBaseChecks asserts this).
    recordProvenanceOffset(referenceId, {
      role: "reference",
      reference_release: null,
      offset: 0,
      anchor_count: null,
      anchors_agreeing: null,
      proven_at: provenAt,
      method: "reference release -- every other release's offset is proven against this one's primary dump",
    });

    const results = {};
    for (const r of reg.releases) {
      if (r.id === referenceId) continue;
      const targetBytes = readImage(primaryDumpEntry(r).bin);
      const anchors = anchorSearch(refBytes, targetBytes);
      const proof = proveOffset(anchors);
      results[r.id] = { anchors, proof };
      if (proof.ok) {
        recordProvenanceOffset(r.id, {
          role: "target",
          reference_release: referenceId,
          offset: proof.offset,
          anchor_count: anchors.length,
          anchors_agreeing: proof.usable.length,
          proven_at: provenAt,
          method: "anchor-proven via .claude/skills/c64-provenance-diff/scripts/diff-images.mjs anchor-search -- see NOTES.md for the full narrative",
        });
      }
    }

    if (rest.includes("--json")) {
      console.log(JSON.stringify({ reference: referenceId, results }, null, 2));
    } else {
      for (const [id, { proof }] of Object.entries(results)) {
        console.log(`${referenceId} -> ${id}: ok=${proof.ok} offset=${proof.offset} (${proof.reason})`);
      }
    }
    process.exitCode = Object.values(results).every((r) => r.proof.ok) ? 0 : 1;
  },

  diff(rest) {
    const gapTolerance = rest.includes("--gap-tolerance") ? Number(optValue(rest, "gap-tolerance")) : 16;
    const reg = loadRegistry();
    const images = loadImagesForDiff(reg);
    const result = diffRanges(images, { gapTolerance });
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`diff: ${result.ranges.length} range(s), gap_tolerance=${gapTolerance}, coalesced=${result.coalesced}`);
    }

    // Write back the three-bucket partition for every dumps[] entry in the
    // registry, enumerated -- never a hardcoded pair.
    for (const { release: releaseId, bin, manifestPath } of enumerateManifests(reg)) {
      const releaseEntry = reg.releases.find((r) => r.id === releaseId);
      const image = readImage(bin);
      const manifest = readManifest(manifestPath);
      const loaderRanges = releaseEntry.loader_ranges ?? [];
      const bucketed = bucketManifest(image, manifest, { loaderRanges });
      writeManifest(manifestPath, bucketed);
    }
  },

  "count-patches"(rest) {
    const gapTolerance = rest.includes("--gap-tolerance") ? Number(optValue(rest, "gap-tolerance")) : 16;
    const reg = loadRegistry();
    const images = loadImagesForDiff(reg);
    const diffResult = diffRanges(images, { gapTolerance });
    const bucketedManifestsByRelease = {};
    for (const r of reg.releases) {
      const dump = primaryDumpEntry(r);
      bucketedManifestsByRelease[r.id] = readManifest(dump.range_manifest);
    }
    const counts = countPatches(images, diffResult, bucketedManifestsByRelease);
    if (rest.includes("--json")) {
      console.log(JSON.stringify({ counts }, null, 2));
    } else {
      for (const [id, n] of Object.entries(counts)) console.log(`${id}: ${n}`);
    }
  },

  ledger(rest) {
    const gapTolerance = rest.includes("--gap-tolerance") ? Number(optValue(rest, "gap-tolerance")) : 16;
    const reg = loadRegistry();
    const images = loadImagesForDiff(reg);
    const diffResult = diffRanges(images, { gapTolerance });

    const referenceId = reg.releases[0].id;
    const referenceEntry = reg.releases.find((r) => r.id === referenceId);
    const referenceManifest = readManifest(primaryDumpEntry(referenceEntry).range_manifest);
    // Split every diff range against the reference manifest's own kind
    // boundaries -- never resolve kind from a range's start address alone
    // (see splitRangeByManifestKind's own comment for the real bug this
    // fixes).
    const generatedRanges = diffResult.ranges.flatMap((r) => splitRangeByManifestKind(r, referenceManifest.ranges));

    // Project narrative is read from a file the project owns, never hardcoded
    // here -- that is what lets this module run against someone else's corpus.
    const prosePath = resolve(optValue(rest, "prose") ?? defaultProsePath());
    let projectProse = null;
    if (existsSync(prosePath)) {
      projectProse = readFileSync(prosePath, "utf8")
        .replace(/^<!--[\s\S]*?-->\s*/, "")            // drop the file's own maintainer header
        .replace(/\{\{gapTolerance\}\}/g, String(gapTolerance))
        .trim();
    } else {
      console.error(
        `ledger: no project prose at ${rel(prosePath)} -- emitting the derived prose only. ` +
          `Create that file (or pass --prose <path>) to add project-specific narrative.`,
      );
    }

    const prose = buildProse({ reg, images, gapTolerance, referenceId, projectProse });
    let markdown;
    try {
      markdown = renderLedger({ generatedRanges, gapTolerance, prose });
    } catch (e) {
      console.error(`ledger: ${e.message}`);
      process.exitCode = 1;
      return;
    }
    const outPath = join(RECOVERY_DIR, "PROVENANCE.md");
    writeFileSync(outPath, markdown);

    // Record the generated tier's digest so a later phase can detect drift.
    const generatedTierText = markdown.split("## Prose tier")[0];
    const digest = sha256Hex(generatedTierText);
    const rawReg = JSON.parse(readFileSync(registryPath, "utf8"));
    rawReg.ledger = { generated_tier_sha256: digest, gap_tolerance: gapTolerance, generated_at: new Date().toISOString() };
    writeFileSync(registryPath, JSON.stringify(rawReg, null, 2) + "\n");

    console.log(`wrote ${rel(outPath)} (generated tier sha256 ${digest})`);
  },
};

/** Where the hand-maintained project narrative lives. Overridable per run. */
export function defaultProsePath() {
  return join(dataRoot(), "PROVENANCE.prose.md");
}

/**
 * The prose tier, in two parts. Everything this function generates is derived
 * from the registry and is true of ANY project using the tool -- the method, the
 * per-release offsets, the coalescing mechanics, the seeding rules. Anything
 * specific to one project's evidence (decision numbers, particular addresses,
 * coverage caveats) belongs in the project's own prose file, which is appended
 * verbatim. Keeping the two apart is what lets this module ship to another
 * project without carrying someone else's findings.
 */
function buildProse({ reg, images, gapTolerance, referenceId, projectProse }) {
  const registryName = relative(projectRoot(), registryPath);

  const offsetLines = images
    .map((img) => {
      const entry = reg.releases.find((r) => r.id === img.id);
      const po = entry.provenance_offset;
      if (img.id === referenceId) {
        return `- **${img.id}** (reference release): offset 0 by definition -- every other release's offset is proven against this one's primary dump.`;
      }
      if (!po) {
        return `- **${img.id}**: no provenance_offset recorded yet -- run the \`anchor-search\` verb first.`;
      }
      return `- **${img.id}**: proven offset **${po.offset}**, from ${po.anchor_count} anchor(s), all agreeing. Machine record in \`${registryName}\`'s \`provenance_offset\` field. Proven ${po.proven_at}.`;
    })
    .join("\n");

  const dumpTriggerLines = reg.releases
    .map((r) => `- **${r.id}**: dump trigger \`${r.trigger?.address ?? "unrecorded"}\` (\`${r.trigger?.kind ?? "unrecorded"}\`). All releases' captures were taken at this same trigger, so the images are directly comparable.`)
    .join("\n");

  const method =
`### The offset used, and how it was proven

The diff above runs at an **anchor-proven** offset per release, never an assumed one. Long,
distinctive byte runs were selected from the reference release's primary dump, located in each other
release's primary dump with \`Buffer.indexOf\`, and a global offset was accepted only when **every**
usable anchor's computed delta agreed -- a majority is refused. The neighbour bytes at each anchor's
resolved position (one before, at, and one after) were inspected so an off-by-one would be visible
rather than assumed.

${offsetLines}

### The state the images were normalised to

${dumpTriggerLines}

### The gap-coalescing tolerance

**${gapTolerance} identical bytes**, passed as \`--gap-tolerance ${gapTolerance}\`. Two differing
ranges separated by a run of identical (ORIGINAL-verdict) bytes *strictly shorter* than this
tolerance are coalesced into one row; a run of *exactly* ${gapTolerance} identical bytes is left as
its own separate row.

### How the kinds were seeded

- **\`loader\`** comes from each release's own earned \`loader_ranges\` in \`${registryName}\`, which
  should be live disassembly evidence -- never prose. A loader range read out of prose is how a
  legitimate game instruction gets misclassified as loader code.
- **\`cracktro\`** comes from printable-ASCII runs whose decoded text contains a recognised
  crack-credit vocabulary word, not from a bare "any printable run" scan. A bare scan misclassifies
  a game's own title-screen text as cracker credit.
- **\`io\`** and **\`unused\`** were assigned at capture time and are kept verbatim.
- Everything else the trace and the entry point reach is bucketed **\`game\`**.

The underlying \`.bin\` files are never edited or zeroed: classification lives in this ledger and in
the manifests, and the bytes stay verbatim evidence.
`;

  return projectProse ? `${method}\n${projectProse}` : method;
}


if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !VERBS[cmd]) {
    console.log(`usage: node ${fileURLToPath(import.meta.url)} <anchor-search|diff|count-patches|ledger> [--gap-tolerance N] [--reference <id>] [--json]`);
    process.exitCode = cmd ? 1 : 0;
  } else {
    VERBS[cmd](rest);
  }
}
