// broker-incident.test.ts
//
// Phase 63, plan 63-03 (SESS-05): node:test coverage of broker-incident.mts,
// exercised entirely in-process -- no real broker, no real emulator, no
// network. broker-incident.mts is HOST-BOUND (it value-imports
// broker-home.mjs), so -- exactly like vice-broker-acquire.test.ts's own
// established convention -- this file builds FIRST and imports the COMPILED
// resources/broker-incident.mjs, never the unbuilt .mts source directly.
// Every write test passes an explicit `dir` override, so nothing here ever
// touches the real, permanent machine-level incidents root.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const BROKER_INCIDENT_ARTIFACT_URL = new URL("./resources/broker-incident.mjs", import.meta.url).href;
const INCIDENT_RECORD_TS = join(HERE, "incident-record.ts");
const BROKER_INCIDENT_MTS = join(HERE, "broker-incident.mts");

interface BrokerIncidentModule {
  BROKER_INCIDENT_VERSION: number;
  brokerIncidentStem: (opts?: { at?: string | number | Date; port?: unknown; epoch?: unknown }) => string;
  brokerIncidentPath: (opts?: { at?: string | number | Date; port?: unknown; epoch?: unknown; dir?: string }) => string;
  renderBrokerIncident: (record?: Record<string, unknown>) => string;
  writeBrokerIncident: (record?: Record<string, unknown>, opts?: { dir?: string }) => string;
}

async function loadBrokerIncidentModule(): Promise<BrokerIncidentModule> {
  build();
  return (await import(BROKER_INCIDENT_ARTIFACT_URL)) as unknown as BrokerIncidentModule;
}

function withTempDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "broker-incident-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// brokerIncidentStem()/brokerIncidentPath() -- the naming shape, mirroring
// incident-record.ts's own incidentAssetStem()/incidentRecordPath().
// ---------------------------------------------------------------------------

test("brokerIncidentStem() builds <UTC-compact>-port<N>-epoch<M> from only the timestamp/port/epoch inputs", async () => {
  const { brokerIncidentStem } = await loadBrokerIncidentModule();
  const stem = brokerIncidentStem({ at: "2026-08-02T14:30:00.123Z", port: 6510, epoch: 7 });
  assert.equal(stem, "20260802143000123-port6510-epoch7");
});

test("brokerIncidentStem() coerces a non-integer port or epoch to the literal 'unknown' rather than passing it through", async () => {
  const { brokerIncidentStem } = await loadBrokerIncidentModule();
  assert.match(brokerIncidentStem({ at: "2026-08-02T14:30:00.000Z", port: "not-a-port", epoch: 7 }), /-portunknown-epoch7$/);
  assert.match(brokerIncidentStem({ at: "2026-08-02T14:30:00.000Z", port: 6510, epoch: null }), /-port6510-epochunknown$/);
});

test("brokerIncidentPath(): an explicit dir override wins over the resolver, so a test never writes into the real machine-level root", async () => {
  const { brokerIncidentPath } = await loadBrokerIncidentModule();
  withTempDir((dir) => {
    const path = brokerIncidentPath({ at: "2026-08-02T14:30:00.000Z", port: 6510, epoch: 3, dir });
    assert.equal(path, join(dir, "20260802143000000-port6510-epoch3.md"));
  });
});

// ---------------------------------------------------------------------------
// renderBrokerIncident() -- the record shape.
// ---------------------------------------------------------------------------

test("renderBrokerIncident() carries the version, moment, trigger, grant id, session label, channel, port, epoch before, operation and void flag, and the broker-minted reason", async () => {
  const { renderBrokerIncident, BROKER_INCIDENT_VERSION } = await loadBrokerIncidentModule();
  const rendered = renderBrokerIncident({
    version: BROKER_INCIDENT_VERSION,
    at: "2026-09-19T12:00:00.000Z",
    trigger: "relay_close",
    grant_id: "grant-1",
    session_label: "my-session",
    channel: "binary",
    port: 6510,
    epoch_before: 4,
    operation: { name: "vice_run_until", declaredAt: 12345 },
    reason: "relay connection closed with an operation in flight",
  });
  assert.match(rendered, /^---\n/);
  const fmEnd = rendered.indexOf("\n---", 4);
  assert.ok(fmEnd > 0, "frontmatter must close with its own --- delimiter");
  const frontmatter = rendered.slice(0, fmEnd);
  assert.match(frontmatter, /version: 1/);
  assert.match(frontmatter, /at: '2026-09-19T12:00:00\.000Z'/);
  assert.match(frontmatter, /trigger: 'relay_close'/);
  assert.match(frontmatter, /grant_id: 'grant-1'/);
  assert.match(frontmatter, /session_label: 'my-session'/);
  assert.match(frontmatter, /channel: 'binary'/);
  assert.match(frontmatter, /port: 6510/);
  assert.match(frontmatter, /epoch_before: 4/);
  assert.match(frontmatter, /operation: 'vice_run_until'/);
  assert.match(frontmatter, /operation_declared_at: 12345/);
  assert.match(frontmatter, /void: true/);
  assert.match(rendered, /## Why this record exists/);
  assert.match(rendered, /relay connection closed with an operation in flight/);
});

test("renderBrokerIncident(): a null operation renders an explicit absence and a false void flag, never an empty heading", async () => {
  const { renderBrokerIncident } = await loadBrokerIncidentModule();
  const rendered = renderBrokerIncident({ trigger: "control_close", operation: null, reason: "control connection closed with nothing declared" });
  assert.match(rendered, /operation: null/);
  assert.match(rendered, /void: false/);
  assert.match(rendered, /operation in flight at the drop: none declared/);
});

test("renderBrokerIncident(): an absent operation field behaves identically to an explicit null", async () => {
  const { renderBrokerIncident } = await loadBrokerIncidentModule();
  const rendered = renderBrokerIncident({ trigger: "relay_error", reason: "no operation field supplied at all" });
  assert.match(rendered, /operation: null/);
  assert.match(rendered, /void: false/);
});

test("renderBrokerIncident(): a malformed operation value (not an object, or an object with no usable name) degrades to absent rather than throwing", async () => {
  const { renderBrokerIncident } = await loadBrokerIncidentModule();
  assert.doesNotThrow(() => renderBrokerIncident({ operation: "not-an-object" }));
  assert.match(renderBrokerIncident({ operation: "not-an-object" }), /operation: null/);
  assert.doesNotThrow(() => renderBrokerIncident({ operation: {} }));
  assert.match(renderBrokerIncident({ operation: {} }), /operation: null/);
});

// ---------------------------------------------------------------------------
// writeBrokerIncident() -- directory choice, atomicity, permissions.
// ---------------------------------------------------------------------------

test("writeBrokerIncident() with an explicit dir creates the directory when it does not exist and places the record inside it", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((parent) => {
    const dir = join(parent, "does-not-exist-yet", "incidents");
    const path = writeBrokerIncident({ port: 6510, epoch_before: 1, reason: "directory creation" }, { dir });
    assert.equal(dirname(path), dir);
    assert.ok(readFileSync(path, "utf8").includes("directory creation"));
  });
});

test("writeBrokerIncident(): the finished file's mode grants no group or other permission bits", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((dir) => {
    const path = writeBrokerIncident({ port: 6510, epoch_before: 9, reason: "mode check" }, { dir });
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode & 0o077, 0, `expected no group/world bits set, got mode ${mode.toString(8)}`);
  });
});

test("writeBrokerIncident(): no temporary file remains beside the record after a successful write", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((dir) => {
    writeBrokerIncident({ port: 6510, epoch_before: 1, reason: "no leftovers" }, { dir });
    const entries = readdirSync(dir);
    assert.ok(entries.length > 0, "sanity: the write must have produced at least one file");
    for (const entry of entries) {
      assert.ok(!entry.startsWith(".tmp-"), `a temporary file was left behind: ${entry}`);
    }
  });
});

test("writeBrokerIncident(): writing twice with an identical timestamp/port/epoch produces two distinct files, and the first is byte-unchanged", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((dir) => {
    const at = "2026-08-02T14:30:00.000Z";
    const path1 = writeBrokerIncident({ at, port: 6510, epoch_before: 7, reason: "first" }, { dir });
    const path2 = writeBrokerIncident({ at, port: 6510, epoch_before: 7, reason: "second" }, { dir });
    assert.notEqual(path1, path2);
    assert.match(path2, /-2\.md$/);
    const content1 = readFileSync(path1, "utf8");
    assert.match(content1, /first/);
    assert.doesNotMatch(content1, /second/);
  });
});

test("writeBrokerIncident(): a caller reason containing path separators and a parent-directory sequence cannot influence the filename", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((dir) => {
    const maliciousReason = "../../etc/passwd\n/absolute/path\n${injection}";
    const path = writeBrokerIncident({ port: 6510, epoch_before: 3, reason: maliciousReason }, { dir });
    assert.ok(path.startsWith(dir + "/"), "the written path must stay inside the given directory");
    const basename = path.slice(dir.length + 1);
    assert.match(basename, /^[0-9]+-port6510-epoch3(-\d+)?\.md$/);
    assert.doesNotMatch(basename, /etc|passwd|absolute|injection/);
    const content = readFileSync(path, "utf8");
    assert.ok(content.includes(maliciousReason), "the reason must still appear verbatim in the body");
  });
});

test("writeBrokerIncident(): a filesystem failure propagates rather than being swallowed", async () => {
  const { writeBrokerIncident } = await loadBrokerIncidentModule();
  withTempDir((parent) => {
    // A FILE (not a directory) sitting at the path this write would try to
    // mkdir into -- ensureBrokerDir()'s own mkdirSync(recursive) must throw
    // ENOTDIR against it, and that throw must reach the caller uncaught.
    const blockerPath = join(parent, "blocker");
    writeFileSync(blockerPath, "");
    const dir = join(blockerPath, "incidents");
    assert.throws(() => writeBrokerIncident({ port: 1, epoch_before: 1, reason: "must not swallow" }, { dir }));
  });
});

// ---------------------------------------------------------------------------
// Vocabulary sync (must_have): the field names this module shares with
// incident-record.ts must be spelled identically on both sides -- reds this
// test if a rename on either side is not mirrored on the other.
// ---------------------------------------------------------------------------

const SHARED_FIELD_NAMES = ["version", "at", "port", "epoch_before", "reason"];

test("vocabulary sync: the shared field names (version/at/port/epoch_before/reason) appear, spelled identically, in both incident-record.ts and broker-incident.mts", () => {
  const incidentRecordSource = readFileSync(INCIDENT_RECORD_TS, "utf8");
  const brokerIncidentSource = readFileSync(BROKER_INCIDENT_MTS, "utf8");
  for (const field of SHARED_FIELD_NAMES) {
    const pattern = new RegExp(`\\b${field}\\??:\\s*unknown\\b`);
    assert.match(incidentRecordSource, pattern, `incident-record.ts must declare "${field}?: unknown" on its own input interface`);
    assert.match(brokerIncidentSource, pattern, `broker-incident.mts must declare "${field}?: unknown" on its own input interface`);
  }
});

// ---------------------------------------------------------------------------
// Build: the new artifact exists and resources-sync stays green (asserted
// separately by resources-sync.test.ts itself; this is a narrower, local
// sanity check that build() actually emitted this ONE artifact).
// ---------------------------------------------------------------------------

test("build(): resources/broker-incident.mjs exists after a build", () => {
  build();
  assert.ok(readFileSync(join(HERE, "resources", "broker-incident.mjs"), "utf8").length > 0);
});
