#!/usr/bin/env node
// Records a vice_recycle incident to disk BEFORE anything is killed (D-17,
// plan 01.3-01). This is the FIRST repo-tracked file any mcp__vice__* tool
// has ever written -- see .planning/incidents/README.md for why the path is
// committed rather than living under the gitignored .vice-supervisor/ tree
// every other module in this directory reads/writes through.
//
// This module makes NO network call of any kind, and never will -- the
// file-writing remit this phase adds expands, the transport remit does not
// (T-01.3-SC's package-legitimacy gate has nothing in scope here either: no
// import beyond node:fs/node:crypto/node:path and this directory's own
// repo-root.ts).
//
// Filename safety (T-01.3-07): incidentRecordPath() below builds the
// filename ONLY from a UTC timestamp, an integer port and an integer epoch.
// No caller-supplied string -- specifically, never the caller's own
// "reason" -- ever reaches a path. A non-integer port or epoch is coerced
// to the literal "unknown" rather than passed through, so a malformed
// caller value degrades the filename's specificity, never its safety.
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join, resolve } from "node:path";

import { repoRoot } from "./repo-root.ts";

export const INCIDENT_RECORD_VERSION = 1;

/** `<repoRoot>/.planning/incidents` -- repo-tracked, never gitignored.
 * `VICE_INCIDENTS_DIR` overrides the resolved location when set, mirroring
 * vice-broker-client.mjs's own `VICE_POOL_DIR` override -- the seam this
 * module's own test suite uses to write against a disposable temp
 * directory instead of the real, permanent `.planning/incidents/` every
 * production caller resolves to. */
export function incidentsDir(): string {
  if (process.env.VICE_INCIDENTS_DIR) return resolve(process.env.VICE_INCIDENTS_DIR);
  return join(repoRoot(), ".planning", "incidents");
}

function sanitiseUtcTimestamp(at: Date | string | number): string {
  const d = at instanceof Date ? at : new Date(at);
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  // Strip every non-digit from the ISO string ("2026-08-02T14:30:00.123Z" ->
  // "20260802143000123") -- a UTC-compact timestamp with no punctuation a
  // filesystem could ever object to.
  return base.toISOString().replace(/[^0-9]/g, "");
}

function sanitiseInt(value: unknown): number | "unknown" {
  // null/undefined/"" all coerce to 0 (or NaN) under a bare Number(), which
  // would silently misreport "no port/epoch known" as the real port 0 --
  // excluded FIRST, before the coercion, rather than trusting Number()'s
  // own permissiveness here.
  if (value === null || value === undefined || value === "") return "unknown";
  const n = Number(value);
  return Number.isInteger(n) ? n : "unknown";
}

/** Options shared by incidentAssetStem()/incidentAssetPath()/
 * incidentRecordPath() below: `port`/`epoch` are typed `unknown` rather
 * than `number` because they arrive as whatever the recycle protocol
 * happened to capture -- sanitiseInt() above is what turns a malformed or
 * missing value into the literal "unknown" rather than a bad path. */
export interface IncidentAssetStemOptions {
  at?: Date | string | number;
  port?: unknown;
  epoch?: unknown;
}

export interface IncidentAssetPathOptions extends IncidentAssetStemOptions {
  ext?: string;
}

/** The `<UTC compact timestamp>-port<port>-epoch<epoch>` stem shared by an
 * incident record and every sibling asset (the screenshot, plan 01.3-03) --
 * the ONLY three inputs that ever reach it, each coerced independently and
 * with no caller-supplied string (the "reason" field) ever consulted
 * (T-01.3-07). Single source of truth for `incidentAssetPath()` and
 * `incidentRecordPath()` below, so a screenshot and its record can never
 * drift onto two different naming rules. */
export function incidentAssetStem({ at = new Date(), port, epoch }: IncidentAssetStemOptions = {}): string {
  const ts = sanitiseUtcTimestamp(at);
  const p = sanitiseInt(port);
  const e = sanitiseInt(epoch);
  return `${ts}-port${p}-epoch${e}`;
}

/** `<incidentsDir>/<stem>.<ext>` -- the general form `incidentRecordPath()`
 * specialises to `.md`. Plan 01.3-03's `gatherWedgeEvidence()` calls this
 * directly with `ext: "png"` so the screenshot lands beside the record it
 * will be named from, sharing the identical stem. */
export function incidentAssetPath({ at = new Date(), port, epoch, ext = "md" }: IncidentAssetPathOptions = {}): string {
  return join(incidentsDir(), `${incidentAssetStem({ at, port, epoch })}.${ext}`);
}

/** Builds `<UTC compact timestamp>-port<port>-epoch<epoch>.md`. */
export function incidentRecordPath({ at = new Date(), port, epoch }: IncidentAssetStemOptions = {}): string {
  return incidentAssetPath({ at, port, epoch, ext: "md" });
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  // A conservative single-quoted YAML scalar: doubling an embedded single
  // quote is the one escape single-quoted style needs, and it never
  // interprets backslashes or newlines specially -- nothing in a caller's
  // reason string can break out of the frontmatter block this way.
  return `'${String(value).replace(/'/g, "''")}'`;
}

// ------------------------------------------------------- evidence rendering
//
// Plan 01.3-03 (criterion 4): the full evidence set `gatherWedgeEvidence()`
// (vice-proxy.mjs) assembles, one fixed-order item per line so two records
// diff cleanly. Each item is `{ available: true, value }` or
// `{ available: false, reason }` -- captureStep()'s own contract -- and an
// unavailable item renders as an EXPLICIT unavailable line, never a silent
// omission (must_have 3): a failed capture and an omitted one must never
// look the same in the file. "snapshot" (task 2) is simply absent from
// `evidence` on a record written before that capture existed; absence is
// treated as "not this record's concern", not as a failure of its own.

/** One evidence item, as captureStep() (vice-proxy.mjs) produces it. */
export interface EvidenceItem {
  available: boolean;
  value?: unknown;
  reason?: string;
}

/** The full, fixed-order evidence set a record MAY carry -- every key is
 * optional because a record written before a given capture existed simply
 * omits it (see renderEvidenceSection()'s own `undefined` skip below). */
export interface IncidentEvidence {
  bracket?: EvidenceItem;
  registers?: EvidenceItem;
  checkpoints?: EvidenceItem;
  irqHandler?: EvidenceItem;
  screenshot?: EvidenceItem;
  snapshot?: EvidenceItem;
}

const EVIDENCE_ITEM_ORDER: { key: keyof IncidentEvidence; label: string }[] = [
  { key: "bracket", label: "cycle bracket" },
  { key: "registers", label: "program counter / register snapshot" },
  { key: "checkpoints", label: "armed checkpoints" },
  { key: "irqHandler", label: "resolved live IRQ handler" },
  { key: "screenshot", label: "screenshot" },
  { key: "snapshot", label: "pre-kill snapshot attempt" },
];

function formatEvidenceValue(key: keyof IncidentEvidence, value: unknown): string {
  switch (key) {
    case "bracket": {
      const v = value as { cycles?: unknown; elapsedMs?: unknown } | undefined;
      return `${v && v.cycles} cycles retired in ~${v && v.elapsedMs}ms`;
    }
    case "registers": {
      const v = value as { PC?: unknown } | undefined;
      const pc =
        v && typeof v.PC === "number" ? `$${v.PC.toString(16).toUpperCase().padStart(4, "0")}` : "unknown";
      return `PC ${pc} (full snapshot: ${JSON.stringify(value)})`;
    }
    case "checkpoints": {
      const list = Array.isArray(value)
        ? (value as { checkpoint_num: unknown; address: unknown; flag: unknown; enabled: unknown }[])
        : [];
      if (list.length === 0) return "none armed";
      return list
        .map((c) => `#${c.checkpoint_num} ${c.address} (${c.flag}, ${c.enabled ? "enabled" : "disabled"})`)
        .join("; ");
    }
    case "irqHandler": {
      const v = value as { explanation?: unknown } | undefined;
      return v && v.explanation ? String(v.explanation) : JSON.stringify(value);
    }
    case "screenshot":
      return `saved to ${value}`;
    // Deliberately NEVER "verified" or "saved" wording (T-01.3-11): the
    // snapshot capability takes a NAME resolved inside the host emulator's
    // own directory, so nothing container-side can confirm a file actually
    // landed -- the record can only say the ATTEMPT was accepted.
    case "snapshot": {
      const v = value as { name?: unknown } | undefined;
      return `accepted (name: ${v && v.name}) -- a name resolved host-side, never independently verified as written`;
    }
    default:
      return JSON.stringify(value);
  }
}

function renderEvidenceSection(evidence: IncidentEvidence | null | undefined): string {
  if (!evidence) return "(no evidence captured)";
  const lines: string[] = [];
  for (const { key, label } of EVIDENCE_ITEM_ORDER) {
    const item = evidence[key];
    if (item === undefined) continue; // this record's own plan/task never wires this item in -- not a gap
    if (item && item.available === true) {
      lines.push(`- ${label}: ${formatEvidenceValue(key, item.value)}`);
    } else {
      const reason = item && item.reason ? item.reason : "no reason recorded";
      lines.push(`- ${label}: unavailable (${reason})`);
    }
  }
  return lines.length > 0 ? lines.join("\n") : "(no evidence captured)";
}

/** `evidence_complete` (frontmatter): true only when every item THIS record
 * actually attempted came back available -- "so a later grep can find the
 * records that captured everything without reading each one" (task 1). An
 * item this record's own plan/task never wires in (undefined) does not
 * count against completeness; at least one real item must be present for
 * "complete" to mean anything. */
function isEvidenceComplete(evidence: IncidentEvidence | null | undefined): boolean {
  if (!evidence) return false;
  let sawAny = false;
  for (const { key } of EVIDENCE_ITEM_ORDER) {
    const item = evidence[key];
    if (item === undefined) continue;
    sawAny = true;
    if (item.available !== true) return false;
  }
  return sawAny;
}

/** The full set of fields renderIncidentRecord()/writeIncidentRecord()/
 * finaliseIncidentRecord() pass around. Most fields are typed `unknown`
 * rather than a narrower scalar type because this module's own contract is
 * to render WHATEVER it is handed via yamlScalar()/template-literal
 * stringification, never to validate it -- narrowing these to `string` or
 * `number` would be a type claim this module's own runtime behaviour does
 * not make good on. */
export interface IncidentRecordInput {
  version?: unknown;
  at?: unknown;
  port?: unknown;
  epoch_before?: unknown;
  epoch_after?: unknown;
  outcome?: unknown;
  kill_stage?: unknown;
  session_id?: unknown;
  reason?: unknown;
  evidence?: IncidentEvidence | null;
  evidence_section?: string | null;
  evidence_complete?: unknown;
}

/** Renders the incident record as markdown: a parseable YAML frontmatter
 * block carrying every field the recycle protocol produces, then a prose
 * body with the caller's own reason quoted verbatim (T-01.3-07's mitigation
 * is the FILENAME, not the body -- the body is free to carry anything).
 *
 * `evidence` (structured, from gatherWedgeEvidence()) drives the initial
 * render. `evidence_section`/`evidence_complete` (raw strings/boolean) are
 * how finaliseIncidentRecord() re-renders WITHOUT structured evidence in
 * hand: it extracts the already-rendered evidence text and the already-
 * parsed completeness flag from the existing file and carries both forward
 * verbatim, so finalising a record (outcome/kill_stage/epoch_after only)
 * can never silently drop the evidence captured before the kill.
 */
export function renderIncidentRecord(record: IncidentRecordInput = {}): string {
  const {
    version = INCIDENT_RECORD_VERSION,
    at = new Date().toISOString(),
    port = null,
    epoch_before = null,
    epoch_after = null,
    outcome = "pending",
    kill_stage = null,
    session_id = null,
    reason = "",
    evidence = null,
    evidence_section = null,
    evidence_complete = null,
  } = record;

  const evidenceComplete = evidence_complete !== null ? Boolean(evidence_complete) : isEvidenceComplete(evidence);
  const evidenceSectionText = evidence_section !== null ? evidence_section : renderEvidenceSection(evidence);

  const frontmatter = [
    "---",
    `version: ${yamlScalar(version)}`,
    `at: ${yamlScalar(at)}`,
    `port: ${yamlScalar(port)}`,
    `epoch_before: ${yamlScalar(epoch_before)}`,
    `epoch_after: ${yamlScalar(epoch_after)}`,
    `outcome: ${yamlScalar(outcome)}`,
    `kill_stage: ${yamlScalar(kill_stage)}`,
    `session_id: ${yamlScalar(session_id)}`,
    `evidence_complete: ${yamlScalar(evidenceComplete)}`,
    "---",
  ].join("\n");

  const reasonText = reason && String(reason).trim().length > 0 ? String(reason) : "(no reason recorded)";

  const body = [
    "",
    "## Why this record exists",
    "",
    reasonText,
    "",
    "## Pre-kill evidence",
    "",
    `- port: ${port === null || port === undefined ? "unknown" : port}`,
    `- epoch before recycle: ${epoch_before === null || epoch_before === undefined ? "unknown" : epoch_before}`,
    "",
    "## Evidence",
    "",
    evidenceSectionText,
    "",
    "## Outcome",
    "",
    `- outcome: ${outcome}`,
    `- kill stage: ${kill_stage === null || kill_stage === undefined ? "(not yet known)" : kill_stage}`,
    `- epoch after recycle: ${epoch_after === null || epoch_after === undefined ? "(not yet known)" : epoch_after}`,
    "",
  ].join("\n");

  return `${frontmatter}\n${body}`;
}

// Tmp sibling created empty -> mode tightened to owner-read-write BEFORE any
// content lands -> content written -> renamed over the destination, the
// same shape vice-broker.mts's writeBrokerRecord() and install-resources.ts's
// manifest writer use (01.6.1-PATTERNS.md's "Atomic write" pattern). Ported
// here rather than left at the plain tmp-then-rename shape the retiring
// bash broker's write_json_atomic() (formerly resources/vice-broker.sh,
// deleted plan 11 -- its own mode-0600 shape survives independently in
// vice-broker.mts's writeBrokerRecord() and broker-epoch.mts's
// writeEpochRecord()) and writeJsonAtomic() (vice-broker-client.mjs) use:
// this module's own threat register entry (T-01.6.1-08) requires the
// mode-restriction step specifically, since a record can carry register/
// screenshot-path evidence and briefly sat world-readable at the default
// umask between write and rename otherwise. The rename itself is still what
// makes the write atomic (a crash between write and rename leaves at most
// one stray, uniquely-named temp file, never a half-written record observed
// mid-write); the chmod is what stops that same window being world-readable.
function writeAtomic(path: string, content: string): string {
  mkdirSync(incidentsDir(), { recursive: true });
  const tmp = join(incidentsDir(), `.tmp-${process.pid}-${randomUUID()}`);
  writeFileSync(tmp, "");
  chmodSync(tmp, 0o600);
  writeFileSync(tmp, content);
  renameSync(tmp, path);
  return path;
}

/** Writes a NEW incident record, never clobbering an existing file at the
 * same computed path: a second recycle in the same second, on the same
 * port and epoch, appends "-2", "-3", ... rather than overwriting the
 * first record. Returns the absolute path actually written. */
export function writeIncidentRecord(record: IncidentRecordInput = {}): string {
  mkdirSync(incidentsDir(), { recursive: true });
  // `record.at`, when supplied, is always an ISO timestamp string in every
  // caller across this tree (this module's own contract; see the default
  // above) -- narrowed here rather than left `unknown`, the same scoped-cast
  // idiom this codebase uses at `(e as Error).message`.
  const at = (record.at as string | undefined) || new Date().toISOString();
  const basePath = incidentRecordPath({ at, port: record.port, epoch: record.epoch_before });
  let path = basePath;
  let suffix = 2;
  while (existsSync(path)) {
    path = basePath.replace(/\.md$/, `-${suffix}.md`);
    suffix += 1;
  }
  const content = renderIncidentRecord({ ...record, at });
  writeAtomic(path, content);
  return path;
}

/** A DELIBERATELY minimal frontmatter reader -- this module never depends on
 * a YAML parser; it only needs to read back the handful of scalar fields it
 * itself wrote, in the exact single-quoted shape yamlScalar() emits above.
 * `reason`/`evidence_section` are typed explicitly since every code path
 * below either sets or leaves them at their initial value; every other
 * frontmatter key is read back dynamically by name and so falls to the
 * index signature. */
interface ParsedFrontmatter {
  reason: string;
  evidence_section?: string;
  [key: string]: unknown;
}

function parseFrontmatterLoose(text: string): ParsedFrontmatter {
  const out: ParsedFrontmatter = { reason: "" };
  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (fmMatch) {
    for (const line of fmMatch[1].split("\n")) {
      const m = line.match(/^([a-z_]+):\s*(.*)$/);
      if (!m) continue;
      const [, key, rawValue] = m;
      let value: unknown = rawValue;
      if (value === "null") value = null;
      else if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (/^-?\d+$/.test(rawValue)) value = Number(rawValue);
      else if (rawValue.startsWith("'") && rawValue.endsWith("'")) value = rawValue.slice(1, -1).replace(/''/g, "'");
      out[key] = value;
    }
  }
  const reasonMatch = text.match(/## Why this record exists\n\n([\s\S]*?)\n\n## Pre-kill evidence/);
  if (reasonMatch) out.reason = reasonMatch[1] === "(no reason recorded)" ? "" : reasonMatch[1];

  // Carried forward VERBATIM by finaliseIncidentRecord() -- the raw already-
  // rendered evidence text, not re-derived from structured evidence (which
  // finalise never has in hand; only writeIncidentRecord()'s initial call
  // does). This is what stops finalising a record from silently dropping
  // the evidence captured before the kill.
  const evidenceMatch = text.match(/## Evidence\n\n([\s\S]*?)\n\n## Outcome/);
  if (evidenceMatch) out.evidence_section = evidenceMatch[1];

  return out;
}

export interface FinaliseIncidentRecordOptions {
  outcome?: unknown;
  kill_stage?: unknown;
  epoch_after?: unknown;
}

/** Re-renders an already-written record with its outcome fields filled in,
 * through the same atomic write shape -- the record is never left saying
 * an outcome is still pending once a caller knows better. */
export function finaliseIncidentRecord(
  path: string,
  { outcome, kill_stage, epoch_after }: FinaliseIncidentRecordOptions = {}
): string {
  let existing = "";
  try {
    existing = readFileSync(path, "utf8");
  } catch {
    existing = "";
  }
  const parsed = parseFrontmatterLoose(existing);
  const merged: IncidentRecordInput = {
    ...parsed,
    outcome: outcome !== undefined ? outcome : parsed.outcome,
    kill_stage: kill_stage !== undefined ? kill_stage : parsed.kill_stage,
    epoch_after: epoch_after !== undefined ? epoch_after : parsed.epoch_after,
  };
  const content = renderIncidentRecord(merged);
  writeAtomic(path, content);
  return path;
}
