// broker-incident.mts
//
// WHY THIS FILE EXISTS: the broker's own incident writer (Phase 63,
// SESS-05). It is host-bound, compiled by build.ts into resources/, and it
// writes under the machine-level broker home (broker-home.mts's
// brokerIncidentsDir()), never under a project checkout: the broker serves
// several projects' sessions at once.
//
// WHAT NOT TO DO:
//   - Never value-import a container-side `.ts` module from here.
//   - Never sanitise a caller-supplied string here beyond what the atomic
//     write already buys (mode 0600, temp-then-rename).
//     `sanitiseSessionLabel()` (broker-control.mts) already ran before a
//     `session_label`/`operation` name reaches this module.
import { chmodSync, existsSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";

import { brokerIncidentsDir, ensureBrokerDir, type BrokerHomeOptions } from "./broker-home.mjs";

export const BROKER_INCIDENT_VERSION = 1;

function sanitiseUtcTimestamp(at: Date | string | number): string {
  const d = at instanceof Date ? at : new Date(at);
  const base = Number.isNaN(d.getTime()) ? new Date() : d;
  return base.toISOString().replace(/[^0-9]/g, "");
}

function sanitiseInt(value: unknown): number | "unknown" {
  if (value === null || value === undefined || value === "") return "unknown";
  const n = Number(value);
  return Number.isInteger(n) ? n : "unknown";
}

export interface BrokerIncidentStemOptions {
  at?: Date | string | number;
  port?: unknown;
  epoch?: unknown;
}

/** The `<UTC compact timestamp>-port<port>-epoch<epoch>` stem. */
export function brokerIncidentStem({ at = new Date(), port, epoch }: BrokerIncidentStemOptions = {}): string {
  const ts = sanitiseUtcTimestamp(at);
  const p = sanitiseInt(port);
  const e = sanitiseInt(epoch);
  return `${ts}-port${p}-epoch${e}`;
}

export interface BrokerIncidentPathOptions extends BrokerIncidentStemOptions {
  /** An explicit directory override wins over brokerIncidentsDir()'s own
   * resolver -- the ONLY way a test may compute a path without ever
   * touching the real, machine-level incidents root. Production callers
   * omit it. */
  dir?: string;
  homeOpts?: BrokerHomeOptions;
}

/** `<dir-or-resolved-brokerIncidentsDir>/<stem>.md`. */
export function brokerIncidentPath({ dir, homeOpts, ...stemOpts }: BrokerIncidentPathOptions = {}): string {
  const resolvedDir = dir ?? brokerIncidentsDir(homeOpts);
  return join(resolvedDir, `${brokerIncidentStem(stemOpts)}.md`);
}

/** The full, untyped-passthrough field set this module renders -- every
 * field typed `unknown`, because this module's contract is to render
 * WHATEVER it is handed, never to validate it. `operation` is the raw
 * `{ name, declaredAt } | null` shape broker-state.mts's own
 * GrantRecord.operation field carries (or a caller's own equivalent
 * object); this module reads only `.name`/`.declaredAt` off it, tolerating
 * anything else as absent rather than throwing. */
export interface BrokerIncidentInput {
  version?: unknown;
  at?: unknown;
  trigger?: unknown;
  grant_id?: unknown;
  session_label?: unknown;
  channel?: unknown;
  port?: unknown;
  epoch_before?: unknown;
  operation?: unknown;
  reason?: unknown;
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

interface ParsedOperation {
  name: string | null;
  declaredAt: unknown;
}

/** Never-throw extraction of the two fields this module actually reads off
 * a caller-supplied `operation` value -- an absent, null, or malformed
 * value degrades to "nothing declared" rather than throwing, matching this
 * whole module's render-whatever-you-are-handed posture. */
function parseOperation(raw: unknown): ParsedOperation {
  if (raw === null || raw === undefined || typeof raw !== "object") return { name: null, declaredAt: null };
  const o = raw as Record<string, unknown>;
  const name = typeof o.name === "string" && o.name !== "" ? o.name : null;
  return { name, declaredAt: name !== null ? (o.declaredAt ?? null) : null };
}

/** Renders the broker's own incident record as markdown: a parseable YAML
 * frontmatter block (`version`, `at`, `port`, `epoch_before`, `reason`, ...),
 * then a short prose body. The `void` flag is
 * `true` exactly when an operation was in flight at the drop -- computed
 * from `operation`, never a separate caller-supplied boolean that could
 * disagree with it. A `null`/absent operation renders as an EXPLICIT
 * absence ("none declared") and `void: false`, never as an empty heading
 * and never as a fabricated "unknown". */
export function renderBrokerIncident(record: BrokerIncidentInput = {}): string {
  const {
    version = BROKER_INCIDENT_VERSION,
    at = new Date().toISOString(),
    trigger = "unknown",
    grant_id = null,
    session_label = null,
    channel = null,
    port = null,
    epoch_before = null,
    operation = null,
    reason = "",
  } = record;

  const { name: operationName, declaredAt: operationDeclaredAt } = parseOperation(operation);
  const voided = operationName !== null;

  const frontmatter = [
    "---",
    `version: ${yamlScalar(version)}`,
    `at: ${yamlScalar(at)}`,
    `trigger: ${yamlScalar(trigger)}`,
    `grant_id: ${yamlScalar(grant_id)}`,
    `session_label: ${yamlScalar(session_label)}`,
    `channel: ${yamlScalar(channel)}`,
    `port: ${yamlScalar(port)}`,
    `epoch_before: ${yamlScalar(epoch_before)}`,
    `operation: ${yamlScalar(operationName)}`,
    `operation_declared_at: ${yamlScalar(operationDeclaredAt)}`,
    `void: ${yamlScalar(voided)}`,
    "---",
  ].join("\n");

  const reasonText = reason && String(reason).trim().length > 0 ? String(reason) : "(no reason recorded)";
  const operationLine =
    operationName !== null
      ? `- operation in flight at the drop: ${operationName} (declared at ${yamlScalar(operationDeclaredAt).replace(/^'|'$/g, "")})`
      : "- operation in flight at the drop: none declared";

  const body = [
    "",
    "## Why this record exists",
    "",
    reasonText,
    "",
    "## What was happening when the connection dropped",
    "",
    `- trigger: ${trigger}`,
    `- channel: ${channel === null || channel === undefined ? "unknown" : channel}`,
    operationLine,
    `- this run is marked void: ${voided}`,
    "",
  ].join("\n");

  return `${frontmatter}\n${body}`;
}

/** Tmp sibling created empty -> mode tightened to owner-read-write BEFORE
 * any content lands -> content written -> renamed over the destination --
 * so a reader of `dir` either sees no file at the final path or sees the complete
 * record; it never observes a half-written one, and the finished file is
 * never briefly group- or world-readable. */
function writeAtomicIncident(dir: string, path: string, content: string): string {
  ensureBrokerDir(dir);
  const tmp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
  writeFileSync(tmp, "");
  chmodSync(tmp, 0o600);
  writeFileSync(tmp, content);
  renameSync(tmp, path);
  return path;
}

export interface WriteBrokerIncidentOptions {
  /** An explicit directory override wins over brokerIncidentsDir()'s own
   * resolver -- the ONLY way a test writes without ever touching the real,
   * machine-level incidents root. */
  dir?: string;
  homeOpts?: BrokerHomeOptions;
}

/** Writes a NEW broker incident record, never clobbering an existing file
 * at the same computed path -- a second drop in the same second, on the
 * same port and epoch, appends "-2", "-3", .... Creates the resolved
 * directory when it does not exist. Never throws on a RENDERING concern
 * (every field above degrades rather than throws); a filesystem failure
 * (an unwritable directory, a full disk) propagates uncaught, because a
 * caller that cannot write evidence must learn that before it reclaims
 * anything -- swallowing it here would silently turn "no incident could be
 * written" into "no incident happened". Returns the absolute path actually
 * written. */
export function writeBrokerIncident(record: BrokerIncidentInput = {}, opts: WriteBrokerIncidentOptions = {}): string {
  const dir = opts.dir ?? brokerIncidentsDir(opts.homeOpts);
  ensureBrokerDir(dir);
  const at = (record.at as string | undefined) || new Date().toISOString();
  const basePath = brokerIncidentPath({ at, port: record.port, epoch: record.epoch_before, dir });
  let path = basePath;
  let suffix = 2;
  while (existsSync(path)) {
    path = basePath.replace(/\.md$/, `-${suffix}.md`);
    suffix += 1;
  }
  const content = renderBrokerIncident({ ...record, at });
  return writeAtomicIncident(dir, path, content);
}
