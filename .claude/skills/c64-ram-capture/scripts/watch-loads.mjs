#!/usr/bin/env node
// The on-demand-load detector's pure logic (01-04 Task 1). Every function
// here takes already-fetched data as an argument or reads a committed file
// -- nothing in this module contacts the emulator, ever. The single
// permitted route to the emulator is the executing agent's own
// `mcp__plugin_c64-re-tools_vice__*` tool calls (see .claude/CLAUDE.md "Emulator Access");
// arming, resuming, polling, disassembling and reading memory all happen in
// the agent's own turn, and the observations land in a committed hit-log
// JSON (`recovery/<release>/dumps/<release>-loading-hits.json`) that this
// module reads back. The import-purity guard test in
// tools/watch-loads.test.mjs is the mechanical statement of that boundary:
// every import specifier in this file resolves to a `node:` built-in or a
// sibling file inside tools/, so this module cannot acquire an outside
// dependency without the guard failing.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve, relative } from "node:path";

import { loadRegistry, release as getReleaseEntry, upsertRelease } from "./releases.mjs";
import { projectRoot, dataRoot } from "./project-paths.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = projectRoot();
const RECOVERY_DIR = dataRoot();

const die = (m) => { console.error(`error: ${m}`); process.exit(1); };

function rel(p) {
  return relative(REPO_ROOT, p);
}

// ------------------------------------------------------------ address math

/** Parse `"$08B1"`, `"0x8b1"`, a decimal string, or a number into an integer. */
export function addrNum(a) {
  if (typeof a === "number") return a;
  if (typeof a === "string") {
    const s = a.trim();
    if (s.startsWith("$")) return parseInt(s.slice(1), 16);
    if (/^0x/i.test(s)) return parseInt(s, 16);
    const n = Number(s);
    if (Number.isNaN(n)) throw new Error(`addrNum: cannot parse address from "${a}"`);
    return n;
  }
  throw new Error(`addrNum: cannot parse address from ${JSON.stringify(a)}`);
}

/** Format an integer as a canonical `$XXXX` 4-hex-digit address string. */
export function hex4(n) {
  return "$" + (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
}

// -------------------------------------------------------------- hit-log I/O

function hitLogPath(releaseId) {
  return join(RECOVERY_DIR, releaseId, "dumps", `${releaseId}-loading-hits.json`);
}

/** Read and JSON.parse a release's committed boundary hit-log artifact. */
export function readHitLog(releaseId) {
  const p = hitLogPath(releaseId);
  if (!existsSync(p)) {
    throw new Error(`readHitLog: no hit log at ${rel(p)} for release "${releaseId}"`);
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

/**
 * Structural validation of a hit-log's boundary-artifact shape: every
 * `armed` entry must carry the `checkpoint_num` the arming call returned,
 * and `teardown.checkpoints_remaining` must be present -- both are the
 * "the delete call's own word is never the proof" invariant made mechanical.
 */
export function validateHitLog(log) {
  const errors = [];
  for (const a of log.armed ?? []) {
    if (a.checkpoint_num === undefined || a.checkpoint_num === null) {
      errors.push(`armed sentinel "${a.name}" is missing checkpoint_num`);
    }
  }
  if (!log.teardown || log.teardown.checkpoints_remaining === undefined || log.teardown.checkpoints_remaining === null) {
    errors.push("teardown.checkpoints_remaining is not recorded");
  }
  return { ok: errors.length === 0, errors };
}

// --------------------------------------------------------------- WATCH_SET

function loadManifestForRelease(rel) {
  const dump = (rel.dumps ?? []).find((d) => d.label === "run1");
  if (!dump || !dump.range_manifest) {
    throw new Error(`WATCH_SET: release "${rel.id}" has no run1 dump with a range_manifest recorded`);
  }
  const manifestPath = join(REPO_ROOT, dump.range_manifest);
  return JSON.parse(readFileSync(manifestPath, "utf8"));
}

/**
 * Resolve the two-tier sentinel set for one release from registry data and
 * that release's run1 range manifest -- never hardcoded. `stopping` tier is
 * one sentinel per `loader_ranges` entry (the loader-reentry sentinels that
 * must never fire again after the dump point per D-10). `counting` tier is
 * one sentinel per never-populated range in the run1 manifest, plus one
 * register sentinel on CIA2 port A ($DD00), which carries both the VIC
 * bank-select bits and the bit-banged serial-bus lines a KERNAL-bypassing
 * raw-sector loader toggles directly -- the primary on-demand-load sentinel
 * precisely because such a loader leaves no KERNAL vector activity to watch
 * instead.
 */
export function WATCH_SET(releaseId, { registry, manifest } = {}) {
  const reg = registry ?? loadRegistry();
  const rel = reg.releases.find((r) => r.id === releaseId);
  if (!rel) {
    throw new Error(`WATCH_SET: unknown release "${releaseId}" -- known releases: ${reg.releases.map((r) => r.id).join(", ")}`);
  }
  const loaderRanges = rel.loader_ranges ?? [];
  if (loaderRanges.length === 0) {
    throw new Error(
      `WATCH_SET: release "${releaseId}" has no loader_ranges recorded -- derive and record loader_ranges ` +
        `(earn them live against a disassembly, per plan Task 2 step 1) before resolving a watch set; a set ` +
        `with no re-entry sentinel in it is not a two-tier set`
    );
  }
  const map = manifest ?? loadManifestForRelease(rel);
  const neverPopulated = (map.ranges ?? []).filter((r) => r.kind === "unused");

  const sentinels = [];
  for (const lr of loaderRanges) {
    const start = addrNum(lr.start);
    const end = addrNum(lr.end);
    sentinels.push({
      name: `loader:${hex4(start)}-${hex4(end)}`,
      kind: "loader-reentry",
      tier: "stopping",
      type: "exec",
      start,
      end,
      reason: lr.note ?? "loader-reentry range: must never fire again after the dump point (D-10)",
      evidence: lr.evidence ?? "",
    });
  }
  for (const nr of neverPopulated) {
    const start = addrNum(nr.start);
    const end = addrNum(nr.end);
    sentinels.push({
      name: `unused:${hex4(start)}-${hex4(end)}`,
      kind: "never-populated",
      tier: "counting",
      type: "write",
      start,
      end,
      reason: nr.note ?? "never-populated range in the run1 capture -- any write during gameplay is a candidate",
      evidence: nr.note ?? "",
    });
  }
  sentinels.push({
    name: "reg:$DD00",
    kind: "register",
    tier: "counting",
    type: "write",
    start: 0xdd00,
    end: 0xdd00,
    reason:
      "CIA2 port A -- VIC-II bank-select bits (0-1) plus the bit-banged serial-bus lines (ATN/CLOCK/DATA, bits 3-5) " +
      "a KERNAL-bypassing raw-sector loader toggles directly; the primary on-demand-load sentinel because such a " +
      "loader leaves no KERNAL vector activity to watch instead",
    evidence:
      "c64-memory-mapping skill memmap: $DD00 bits 0-1 select the VIC bank (00=bank3 $C000-$FFFF ... 11=bank0 " +
      "$0000-$3FFF); bits 3-5 are the serial bus ATN OUT/CLOCK OUT/DATA OUT lines",
  });
  return sentinels;
}

// ----------------------------------------------------------- attributeAddress

/**
 * Resolve `addr` to exactly one sentinel's name. Validates the *whole*
 * sentinel set for overlap/duplication on every call -- a configuration
 * error is a property of the set, not of the one address being queried, so
 * it must be caught regardless of which address happens to be asked about.
 * Abutting ranges (one range's `end` immediately followed by the next
 * range's `start`) are never flagged: they are adjacent, not overlapping.
 */
export function attributeAddress(addr, sentinels) {
  const a = addrNum(addr);
  for (let i = 0; i < sentinels.length; i++) {
    for (let j = i + 1; j < sentinels.length; j++) {
      const s1 = sentinels[i];
      const s2 = sentinels[j];
      const s1s = addrNum(s1.start);
      const s1e = addrNum(s1.end);
      const s2s = addrNum(s2.start);
      const s2e = addrNum(s2.end);
      if (s1s <= s2e && s2s <= s1e) {
        throw new Error(
          `attributeAddress: overlapping or duplicate sentinel ranges "${s1.name}" (${hex4(s1s)}-${hex4(s1e)}) and ` +
            `"${s2.name}" (${hex4(s2s)}-${hex4(s2e)}) -- refusing to resolve a winner by precedence`
        );
      }
    }
  }
  const matches = sentinels.filter((s) => a >= addrNum(s.start) && a <= addrNum(s.end));
  if (matches.length === 0) {
    return { matched: false, name: null, address: a };
  }
  return { matched: true, name: matches[0].name, address: a };
}

// ----------------------------------------------------------------- reportHits

/**
 * Total order over a hit log: cycle ascending, then address ascending, then
 * sentinel name ascending -- so two hits sharing both cycle and address
 * still have one defined position, and re-reporting an unchanged log is
 * byte-identical. Accepts either a bare array of hit records or the whole
 * boundary-artifact object (reading its `.hits` field); an absent/empty
 * `hits` array reports as an empty result rather than throwing.
 */
export function reportHits(hitLog) {
  const hits = Array.isArray(hitLog) ? hitLog : hitLog?.hits ?? [];
  return [...hits].sort((a, b) => {
    const ca = a.cycle ?? 0;
    const cb = b.cycle ?? 0;
    if (ca !== cb) return ca - cb;
    const aa = addrNum(a.address);
    const ab = addrNum(b.address);
    if (aa !== ab) return aa - ab;
    return String(a.sentinel ?? "").localeCompare(String(b.sentinel ?? ""));
  });
}

// ------------------------------------------------------------------ idleGate

/**
 * The mechanical half of the idle check. Passes only when every
 * `stopping`-tier sentinel recorded exactly zero hits AND the recorded
 * `cycles_advanced` is greater than zero -- a machine that did not execute
 * proves nothing, whatever the hit counts say. Otherwise names the
 * violating sentinels with their counts.
 */
export function idleGate(calibration) {
  const cyclesAdvanced = calibration?.cycles_advanced;
  const sentinels = calibration?.sentinels ?? [];
  const violations = sentinels
    .filter((s) => s.tier === "stopping" && s.hits !== 0)
    .map((s) => ({ name: s.name, hits: s.hits }));
  const cyclesOk = typeof cyclesAdvanced === "number" && cyclesAdvanced > 0;
  const reasons = [];
  if (!cyclesOk) {
    reasons.push(`cycles_advanced (${cyclesAdvanced}) is not greater than zero -- a machine that did not execute proves nothing`);
  }
  if (violations.length > 0) {
    reasons.push(
      `stopping-tier sentinel(s) recorded non-zero idle hits: ${violations.map((v) => `${v.name}=${v.hits}`).join(", ")}`
    );
  }
  return { ok: cyclesOk && violations.length === 0, cycles_advanced: cyclesAdvanced, violations, reasons };
}

// ---------------------------------------------------------------- classifyHit

/**
 * Returns `unattributed` unless the hit record carries a non-empty program
 * counter, backtrace and disassembly -- only then does it return the
 * recorded classification (`gameplay-write` or `load-candidate`). An
 * unattributed hit is reported as exactly that, never as a bare count.
 */
export function classifyHit(hit) {
  const hasPc = hit?.pc !== undefined && hit?.pc !== null && hit?.pc !== "";
  const hasBacktrace = Array.isArray(hit?.backtrace) ? hit.backtrace.length > 0 : !!hit?.backtrace;
  const hasDisassembly = !!hit?.disassembly;
  if (!hasPc || !hasBacktrace || !hasDisassembly) return "unattributed";
  if (hit.classification === "gameplay-write" || hit.classification === "load-candidate") {
    return hit.classification;
  }
  return "unattributed";
}

// ------------------------------------------------------------ screenSignature

/**
 * Hash the 1000 bytes of screen matrix the agent read (hex string in,
 * digest out) together with the sprite-enable register value. Screenshots
 * are human-audit artifacts and are never hashed here or anywhere else in
 * this project: an encoder can emit different bytes for pixel-identical
 * images, and this project deliberately installs no image-decoding library
 * (D-18) to decode-then-hash instead.
 */
export function screenSignature(screenMatrixHex, spriteEnable) {
  const buf = Buffer.from(screenMatrixHex, "hex");
  if (buf.length !== 1000) {
    throw new Error(`screenSignature: expected 1000 bytes of screen matrix hex, got ${buf.length} bytes`);
  }
  const digest = createHash("sha256").update(buf).digest("hex");
  return { digest, sprite_enable: spriteEnable ?? null };
}

// --------------------------------------------------------------- recordWatchSet

/** Persist a resolved sentinel set into the registry under `watch_set`. */
export function recordWatchSet(releaseId, watchSet) {
  return upsertRelease(releaseId, (r) => ({ ...r, watch_set: watchSet }));
}

// ----------------------------------------------------------------- renderLoading

function escapeCell(text) {
  return String(text ?? "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function fmtRange(s) {
  return `${hex4(addrNum(s.start))}-${hex4(addrNum(s.end))}`;
}

function renderReleaseSection(id, log) {
  const hits = reportHits(log);
  const count = hits.length;
  let s = `## Release: ${id}\n\n`;

  s += `**Load-event count:**\n\n${count}\n\n`;

  if (log.run_status === "blocked") {
    if (count === 0) {
      s += `> **⚠ THIS IS NOT AN EVIDENCED ZERO.** The count above is \`0\` only because no live ` +
        `emulator work reached completion for this release this run -- it is a bare absence of ` +
        `attempted measurement, not a null result earned by an idle calibration on a machine proven ` +
        `to have executed. ${log.run_status_note ?? ""}\n\n`;
    } else {
      s += `> **⚠ THIS IS A PARTIAL RESULT, NOT A COMPLETED COVERAGE CLAIM.** The count above (\`${count}\`) ` +
        `reflects genuinely attributed hits from the portion of the play-through that did complete before this ` +
        `run was blocked -- it is not evidence that no further load events exist beyond what was reached. ` +
        `${log.run_status_note ?? ""}\n\n`;
    }
  }

  s += `**Route:** the executing agent's own \`mcp__plugin_c64-re-tools_vice__*\` tool calls -- machine ${log.machine ?? "unknown"}, ` +
    `video standard ${log.video_standard ?? "unknown"}, VICE server version ${log.vice_version ?? "unknown"}.\n\n`;

  s += `### Armed set\n\n`;
  s += "| Sentinel | Kind | Tier | Type | Range | Reason | Evidence | Idle hits |\n";
  s += "|---|---|---|---|---|---|---|---|\n";
  for (const a of log.armed ?? []) {
    s += `| ${a.name} | ${a.kind} | ${a.tier} | ${a.type} | ${fmtRange(a)} | ${escapeCell(a.reason)} | ${escapeCell(a.evidence)} | ${a.idle_hits ?? ""} |\n`;
  }
  s += "\n";

  s += `### Idle calibration\n\n`;
  const cal = log.idle_calibration ?? {};
  s += `Cycles advanced during the no-input idle window: **${cal.cycles_advanced ?? "unrecorded"}**.\n\n`;
  s += "| Sentinel | Tier | Range | Idle hits |\n|---|---|---|---|\n";
  for (const sn of cal.sentinels ?? []) {
    s += `| ${sn.name} | ${sn.tier} | ${sn.start !== undefined ? fmtRange(sn) : ""} | ${sn.hits} |\n`;
  }
  s += "\n";

  s += `### Counting-tier probe\n\n`;
  const probe = log.counting_tier_probe ?? {};
  s += `Observed hit count: ${probe.hit_count ?? "unrecorded"}. Execution stopped during the probe: ${probe.execution_stopped ?? "unrecorded"}.\n\n`;
  if (probe.fallback_taken) {
    s += `**Fallback taken:** the counting tier could not count without stopping. ${probe.fallback_note ?? ""}\n\n`;
  }

  s += `### Coverage reached\n\n`;
  s += "| Milestone | Reached | Screen signature | Cycles advanced | Retries | Screenshot |\n|---|---|---|---|---|---|\n";
  for (const m of log.milestones ?? []) {
    s += `| ${m.name} | ${m.reached ? "yes" : "no"} | ${m.screen_signature ?? ""} | ${m.cycles_advanced ?? ""} | ${m.retries ?? 0} | ${m.screenshot ?? ""} |\n`;
  }
  s += "\n";

  s += `### States not reached\n\n`;
  const notReachedMilestones = (log.milestones ?? []).filter((m) => !m.reached);
  const scopeBoundary = log.scope_not_attempted ?? [];
  if (notReachedMilestones.length === 0 && scopeBoundary.length === 0) {
    s += "(nothing recorded as not reached -- if this looks wrong, the record is incomplete, not the coverage)\n\n";
  } else {
    for (const m of notReachedMilestones) {
      s += `- **${m.name}**: not reached. ${m.not_reached_reason ?? ""}\n`;
    }
    for (const item of scopeBoundary) {
      s += `- ${item}\n`;
    }
    s += "\n";
  }

  s += `### Attributed hits\n\n`;
  if (hits.length === 0) {
    s += "(no hits recorded above the idle floor)\n\n";
  } else {
    s += "| Cycle | Address | Sentinel | Tier | Classification | Evidence |\n|---|---|---|---|---|---|\n";
    for (const h of hits) {
      const cls = h.classification ?? classifyHit(h);
      s += `| ${h.cycle} | ${h.address} | ${h.sentinel} | ${h.tier ?? ""} | ${cls} | ${escapeCell(h.disassembly ?? "")} |\n`;
    }
    s += "\n";
  }

  const loadCandidates = hits.filter((h) => (h.classification ?? classifyHit(h)) === "load-candidate");
  s += `### Supplementary dumps\n\n`;
  if (loadCandidates.length === 0) {
    s += "None -- no hit was classified `load-candidate` for this release.\n\n";
  } else {
    for (const h of loadCandidates) {
      s += `- Hit at ${h.address} (cycle ${h.cycle}): supplementary dump \`${h.supplementary_dump ?? "unrecorded"}\`, ` +
        `registry ref \`${h.load_event_ref ?? "unrecorded"}\`. Reproducibility bar: a single capture, decided in ` +
        `this plan because the claim is about an observed moment rather than a stable state -- if D-13 resolves to ` +
        `absorbing loaded content into the canonical image, this region must be re-captured at the primary dumps' ` +
        `three-run bar before Phase 4 treats it as a round-trip diff target.\n`;
    }
    s += "\n";
  }

  s += `### Hand-off to plan 02-02\n\n`;
  s += "The registry's `watch_set` entries for this release are the re-armable specification: plan 02-02's own " +
    "executing agent re-arms the same set by issuing the same `mcp__plugin_c64-re-tools_vice__vice_checkpoint_add` calls during Phase " +
    "2's exhaustive all-chambers trace, and interprets what it observes with this module's pure `attributeAddress`, " +
    "`reportHits` and `classifyHit` functions. This is a hand-off of data and procedure, not an executable -- plan " +
    "02-02's own plan text should describe agent-performed arming with acceptance criteria over a committed record " +
    "rather than over an exit code. A late hit there reopens this document.\n\n";

  s += `### Input sequence notes\n\n`;
  s += (log.input_notes ?? "(no input notes recorded)") + "\n\n";
  s += "Per D-12 this is plain notes, not a `verify/scripts/` artifact -- VERIFY-01 in Phase 3 owns the real " +
    "input-script format; these notes are a seed for it, not a pre-empting specification.\n\n";

  s += `### Teardown proof\n\n`;
  const teardown = log.teardown ?? {};
  s += `Checkpoints remaining after teardown, from an explicit \`mcp__plugin_c64-re-tools_vice__vice_checkpoint_list\` enumeration: ` +
    `**${teardown.checkpoints_remaining ?? "unrecorded"}** (enumerated at ${teardown.enumerated_at ?? "unrecorded"}).\n\n`;

  if ((log.identity_changes ?? []).length > 0) {
    s += `### Identity changes\n\n`;
    for (const c of log.identity_changes) {
      s += `- ${JSON.stringify(c)}\n`;
    }
    s += "\n";
  }

  return s;
}

/**
 * Render `recovery/LOADING.md` from a list of `{ id, log }` entries, each
 * `log` being one release's validated boundary hit-log artifact. Pure
 * string templating over already-fetched data -- nothing here reads a file
 * or contacts anything; the CLI `render` verb below is what reads the
 * hit-log files and writes the result.
 */
export function renderLoading(entries) {
  let out = "# `recovery/LOADING.md` -- the on-demand-load detection record\n\n";
  out +=
    "This document is the absence-as-evidence record: per release, the armed set with its justification, the " +
    "idle calibration result, the coverage reached with a mechanical arrival proof per milestone, the states not " +
    "reached, the attributed hits, and the teardown enumeration. Every measurement below was fetched by the " +
    "executing agent's own `mcp__plugin_c64-re-tools_vice__*` tool calls; `.claude/skills/c64-ram-capture/scripts/watch-loads.mjs` and `.claude/skills/c64-ram-capture/scripts/dump-artifacts.mjs` hold " +
    "only the pure logic that resolves, attributes, orders and renders it -- neither module contacted the " +
    "emulator.\n\n";
  for (const { id, log } of entries) {
    out += renderReleaseSection(id, log);
  }
  return out;
}

// -------------------------------------------------------------------- CLI

function optValue(rest, name) {
  const i = rest.indexOf(`--${name}`);
  return i === -1 ? undefined : rest[i + 1];
}

const VERBS = {
  resolve(rest) {
    const releaseId = optValue(rest, "release");
    if (!releaseId) die("usage: resolve --release <id> [--json]");
    const watchSet = WATCH_SET(releaseId);
    recordWatchSet(releaseId, watchSet);
    const result = { release: releaseId, count: watchSet.length, watch_set: watchSet };
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${releaseId}: resolved ${watchSet.length} sentinel(s)`);
      for (const s of watchSet) console.log(`  ${s.name} tier=${s.tier} type=${s.type} ${fmtRange(s)}`);
    }
  },

  attribute(rest) {
    const releaseId = optValue(rest, "release");
    const addrArg = optValue(rest, "addr");
    if (!releaseId || !addrArg) die("usage: attribute --release <id> --addr <address> [--json]");
    const relEntry = getReleaseEntry(releaseId);
    const sentinels = relEntry.watch_set && relEntry.watch_set.length ? relEntry.watch_set : WATCH_SET(releaseId);
    const result = attributeAddress(addrArg, sentinels);
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(result.matched ? `${addrArg} -> ${result.name}` : `${addrArg} -> unmatched`);
    }
  },

  report(rest) {
    const releaseId = optValue(rest, "release");
    if (!releaseId) die("usage: report --release <id> [--json]");
    const log = readHitLog(releaseId);
    const hits = reportHits(log);
    const result = { release: releaseId, count: hits.length, hits };
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${releaseId}: ${hits.length} hit(s)`);
      for (const h of hits) {
        console.log(`  cycle=${h.cycle} addr=${h.address} sentinel=${h.sentinel} classification=${h.classification ?? classifyHit(h)}`);
      }
    }
  },

  "check-idle"(rest) {
    const releaseId = optValue(rest, "release");
    if (!releaseId) die("usage: check-idle --release <id> [--json]");
    const log = readHitLog(releaseId);
    if (!log.idle_calibration) die(`check-idle: release "${releaseId}" hit log has no idle_calibration recorded`);
    const gate = idleGate(log.idle_calibration);
    const result = { release: releaseId, ...gate, sentinels: log.idle_calibration.sentinels ?? [] };
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${releaseId}: cycles_advanced=${gate.cycles_advanced} ok=${gate.ok}`);
      for (const s of result.sentinels) console.log(`  ${s.name}: tier=${s.tier} ${s.start !== undefined ? fmtRange(s) : ""} hits=${s.hits}`);
      if (!gate.ok) for (const r of gate.reasons) console.error(`  - ${r}`);
    }
    process.exitCode = gate.ok ? 0 : 1;
  },

  signature(rest) {
    const hex = optValue(rest, "hex");
    const spriteEnable = optValue(rest, "sprite-enable");
    if (!hex) die("usage: signature --hex <1000-byte-hex> [--sprite-enable <n>] [--json]");
    const result = screenSignature(hex, spriteEnable !== undefined ? Number(spriteEnable) : null);
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`${result.digest} sprite_enable=${result.sprite_enable}`);
    }
  },

  render(rest) {
    const reg = loadRegistry();
    const only = optValue(rest, "release");
    const releaseIds = only ? [only] : reg.releases.map((r) => r.id);
    const entries = [];
    for (const id of releaseIds) {
      const p = hitLogPath(id);
      if (!existsSync(p)) continue;
      entries.push({ id, log: JSON.parse(readFileSync(p, "utf8")) });
    }
    const markdown = renderLoading(entries);
    const outPath = join(RECOVERY_DIR, "LOADING.md");
    writeFileSync(outPath, markdown);
    const result = { path: rel(outPath), releases: entries.map((e) => e.id) };
    if (rest.includes("--json")) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(`wrote ${rel(outPath)} for releases: ${result.releases.join(", ")}`);
    }
  },
};

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  if (!cmd || !VERBS[cmd]) {
    console.log(`usage: node ${fileURLToPath(import.meta.url)} <resolve|attribute|report|check-idle|signature|render> [--release <id>] [--json]`);
    process.exitCode = cmd ? 1 : 0;
  } else {
    VERBS[cmd](rest);
  }
}
