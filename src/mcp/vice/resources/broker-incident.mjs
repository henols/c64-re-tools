// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from broker-incident.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// broker-incident.mts
//
// The broker's OWN incident writer (Phase 63, SESS-05) -- a small,
// purpose-built, host-bound sibling of incident-record.ts, never a call
// into it. Two separate facts force this rather than reuse:
//
//   1. This module is HOST-BOUND, compiled by build.ts into resources/,
//      because the broker runs from that compiled artifact and has no
//      container-side sibling to import at runtime -- the same constraint
//      broker-home.mts's own header states for why it cannot import
//      repo-root.ts. incident-record.ts is a plain container-side `.ts`
//      module; a host-bound module cannot value-import it.
//   2. Even if it could, incident-record.ts's own `incidentsDir()` resolves
//      a PER-PROJECT directory (`toolsDir()`, rooted at whichever repo
//      checkout is current) -- exactly wrong for a broker that is
//      machine-level and serves several unrelated projects' sessions at
//      once. This writer resolves through broker-home.mts's
//      `brokerIncidentsDir()` instead, giving that function its first real
//      production caller.
//
// WHAT NOT TO DO:
//   - Never import incident-record.ts from this file, in either direction.
//     A host-bound module importing a container-side one is exactly the
//     mistake broker-home.mts's own header already warns against, one
//     level up.
//   - Never let this module's field vocabulary drift from
//     incident-record.ts's own -- the two writers deliberately share field
//     NAMES (`version`, `at`, `port`, `epoch_before`, `reason`) for a
//     reader's sake, and broker-incident.test.ts's own sync test is the
//     ONLY thing holding that agreement together: it reads both sources and
//     asserts every shared name appears in both, verbatim. A rename on
//     either side without a matching rename on the other reds that test on
//     purpose -- fix the drift, never the test.
//   - Never sanitise a caller-supplied string here beyond what this file's
//     own atomic-write step already buys (mode 0600, temp-then-rename).
//     `sanitiseSessionLabel()` (broker-control.mts) already ran before a
//     `session_label`/`operation` name ever reaches this module -- this
//     writer renders whatever it is handed, exactly like
//     incident-record.ts's own renderer does for `reason`.
import { chmodSync, existsSync, renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { brokerIncidentsDir, ensureBrokerDir } from "./broker-home.mjs";
export const BROKER_INCIDENT_VERSION = 1;
function sanitiseUtcTimestamp(at) {
    const d = at instanceof Date ? at : new Date(at);
    const base = Number.isNaN(d.getTime()) ? new Date() : d;
    return base.toISOString().replace(/[^0-9]/g, "");
}
function sanitiseInt(value) {
    if (value === null || value === undefined || value === "")
        return "unknown";
    const n = Number(value);
    return Number.isInteger(n) ? n : "unknown";
}
/** The `<UTC compact timestamp>-port<port>-epoch<epoch>` stem -- byte-for-byte
 * the same naming shape incident-record.ts's own incidentAssetStem() uses,
 * mirrored rather than imported (see this file's own header). */
export function brokerIncidentStem({ at = new Date(), port, epoch } = {}) {
    const ts = sanitiseUtcTimestamp(at);
    const p = sanitiseInt(port);
    const e = sanitiseInt(epoch);
    return `${ts}-port${p}-epoch${e}`;
}
/** `<dir-or-resolved-brokerIncidentsDir>/<stem>.md`. */
export function brokerIncidentPath({ dir, homeOpts, ...stemOpts } = {}) {
    const resolvedDir = dir ?? brokerIncidentsDir(homeOpts);
    return join(resolvedDir, `${brokerIncidentStem(stemOpts)}.md`);
}
function yamlScalar(value) {
    if (value === null || value === undefined)
        return "null";
    if (typeof value === "number" || typeof value === "boolean")
        return String(value);
    return `'${String(value).replace(/'/g, "''")}'`;
}
/** Never-throw extraction of the two fields this module actually reads off
 * a caller-supplied `operation` value -- an absent, null, or malformed
 * value degrades to "nothing declared" rather than throwing, matching this
 * whole module's render-whatever-you-are-handed posture. */
function parseOperation(raw) {
    if (raw === null || raw === undefined || typeof raw !== "object")
        return { name: null, declaredAt: null };
    const o = raw;
    const name = typeof o.name === "string" && o.name !== "" ? o.name : null;
    return { name, declaredAt: name !== null ? (o.declaredAt ?? null) : null };
}
/** Renders the broker's own incident record as markdown: a parseable YAML
 * frontmatter block, mirroring incident-record.ts's own shape and field
 * SPELLING for the fields the two share (`version`, `at`, `port`,
 * `epoch_before`, `reason`), then a short prose body. The `void` flag is
 * `true` exactly when an operation was in flight at the drop -- computed
 * from `operation`, never a separate caller-supplied boolean that could
 * disagree with it. A `null`/absent operation renders as an EXPLICIT
 * absence ("none declared") and `void: false`, never as an empty heading
 * and never as a fabricated "unknown". */
export function renderBrokerIncident(record = {}) {
    const { version = BROKER_INCIDENT_VERSION, at = new Date().toISOString(), trigger = "unknown", grant_id = null, session_label = null, channel = null, port = null, epoch_before = null, operation = null, reason = "", } = record;
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
    const operationLine = operationName !== null
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
 * the SAME atomic-write shape incident-record.ts's own writeAtomic() uses
 * (mirrored, not imported, per this file's own header). A reader of `dir`
 * therefore either sees no file at the final path or sees the complete
 * record; it never observes a half-written one, and the finished file is
 * never briefly group- or world-readable. */
function writeAtomicIncident(dir, path, content) {
    ensureBrokerDir(dir);
    const tmp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
    writeFileSync(tmp, "");
    chmodSync(tmp, 0o600);
    writeFileSync(tmp, content);
    renameSync(tmp, path);
    return path;
}
/** Writes a NEW broker incident record, never clobbering an existing file
 * at the same computed path -- a second drop in the same second, on the
 * same port and epoch, appends "-2", "-3", ... exactly like
 * incident-record.ts's own writeIncidentRecord(). Creates the resolved
 * directory when it does not exist. Never throws on a RENDERING concern
 * (every field above degrades rather than throws); a filesystem failure
 * (an unwritable directory, a full disk) propagates uncaught, because a
 * caller that cannot write evidence must learn that before it reclaims
 * anything -- swallowing it here would silently turn "no incident could be
 * written" into "no incident happened". Returns the absolute path actually
 * written. */
export function writeBrokerIncident(record = {}, opts = {}) {
    const dir = opts.dir ?? brokerIncidentsDir(opts.homeOpts);
    ensureBrokerDir(dir);
    const at = record.at || new Date().toISOString();
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
