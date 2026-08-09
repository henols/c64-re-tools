// node:test coverage of incident-record.ts (plan 01.3-01 task 2) --
// exercised entirely in-process, with NO proxy and NO broker involved:
// this module makes no network call and no host-side round trip, so its
// own test suite doesn't need either. Every test redirects incidentsDir()
// to a disposable temp directory via VICE_INCIDENTS_DIR (this module's own
// override, mirroring vice-broker-client.mjs's VICE_POOL_DIR) so nothing
// here ever touches the real, permanent .planning/incidents/.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  INCIDENT_RECORD_VERSION,
  incidentsDir,
  incidentRecordPath,
  renderIncidentRecord,
  writeIncidentRecord,
  finaliseIncidentRecord,
  type IncidentEvidence,
} from "./incident-record.ts";

function withTempIncidentsDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "vice-incidents-test-"));
  const prev = process.env.VICE_INCIDENTS_DIR;
  process.env.VICE_INCIDENTS_DIR = dir;
  try {
    return fn(dir);
  } finally {
    if (prev === undefined) delete process.env.VICE_INCIDENTS_DIR;
    else process.env.VICE_INCIDENTS_DIR = prev;
    rmSync(dir, { recursive: true, force: true });
  }
}

test("incidentsDir() respects VICE_INCIDENTS_DIR", () => {
  withTempIncidentsDir((dir) => {
    assert.equal(incidentsDir(), dir);
  });
});

test("incidentRecordPath() builds <UTC-compact>-port<N>-epoch<M>.md from only the timestamp/port/epoch inputs", () => {
  withTempIncidentsDir((dir) => {
    const p = incidentRecordPath({ at: "2026-08-02T14:30:00.123Z", port: 6510, epoch: 7 });
    assert.equal(p, join(dir, "20260802143000123-port6510-epoch7.md"));
  });
});

test("incidentRecordPath() coerces a non-integer port or epoch to the literal 'unknown' rather than passing it through", () => {
  withTempIncidentsDir(() => {
    const p1 = incidentRecordPath({ at: "2026-08-02T14:30:00.000Z", port: "not-a-port", epoch: 7 });
    assert.match(p1, /-portunknown-epoch7\.md$/);
    const p2 = incidentRecordPath({ at: "2026-08-02T14:30:00.000Z", port: 6510, epoch: null });
    assert.match(p2, /-port6510-epochunknown\.md$/);
    const p3 = incidentRecordPath({ at: "2026-08-02T14:30:00.000Z", port: 3.5, epoch: 7 });
    assert.match(p3, /-portunknown-epoch7\.md$/, "a non-integer NUMBER must also coerce to unknown, not truncate");
  });
});

test("a caller reason containing path separators, a parent-directory sequence and a newline cannot influence the filename", () => {
  withTempIncidentsDir((dir) => {
    const maliciousReason = "../../etc/passwd\n/absolute/path\n${injection}";
    const path = writeIncidentRecord({ port: 6510, epoch_before: 3, reason: maliciousReason });
    // The path must still land INSIDE the incidents dir, with a filename
    // matching the timestamp-port-epoch shape only -- no separator, no
    // ".." segment, no newline from the reason ever reached it.
    assert.ok(path.startsWith(dir + "/"), "the written path must stay inside the incidents directory");
    const basename = path.slice(dir.length + 1);
    assert.match(basename, /^[0-9]+-port6510-epoch3(-\d+)?\.md$/);
    assert.doesNotMatch(basename, /etc|passwd|absolute|injection/);
    // The reason DOES appear verbatim in the BODY -- the mitigation is the
    // filename, not the body.
    const content = readFileSync(path, "utf8");
    assert.ok(content.includes(maliciousReason), "the reason must still appear verbatim in the body");
  });
});

test("a record renders with parseable YAML frontmatter carrying every field, and the caller's reason appears verbatim in the body", () => {
  withTempIncidentsDir(() => {
    const rendered = renderIncidentRecord({
      version: INCIDENT_RECORD_VERSION,
      at: "2026-08-02T14:30:00.000Z",
      port: 6510,
      epoch_before: 5,
      epoch_after: 6,
      outcome: "ok",
      kill_stage: "sigterm",
      session_id: "sess-123",
      reason: "manual test recycle",
    });
    assert.match(rendered, /^---\n/);
    const fmEnd = rendered.indexOf("\n---", 4);
    assert.ok(fmEnd > 0, "frontmatter must close with its own --- delimiter");
    const frontmatter = rendered.slice(0, fmEnd);
    assert.match(frontmatter, /version: 1/);
    assert.match(frontmatter, /port: 6510/);
    assert.match(frontmatter, /epoch_before: 5/);
    assert.match(frontmatter, /epoch_after: 6/);
    assert.match(frontmatter, /outcome: 'ok'/);
    assert.match(frontmatter, /kill_stage: 'sigterm'/);
    assert.match(frontmatter, /session_id: 'sess-123'/);
    assert.match(rendered, /## Why this record exists/);
    assert.match(rendered, /manual test recycle/);
    assert.match(rendered, /## Pre-kill evidence/);
    assert.match(rendered, /## Outcome/);
  });
});

test("writing twice with an identical timestamp, port and epoch produces two distinct files and the first is byte-unchanged", () => {
  withTempIncidentsDir(() => {
    const at = "2026-08-02T14:30:00.000Z";
    const path1 = writeIncidentRecord({ at, port: 6510, epoch_before: 7, reason: "first" });
    const path2 = writeIncidentRecord({ at, port: 6510, epoch_before: 7, reason: "second" });
    assert.notEqual(path1, path2, "a second write at the identical timestamp/port/epoch must land at a distinct path");
    assert.match(path2, /-2\.md$/);
    const content1 = readFileSync(path1, "utf8");
    assert.match(content1, /first/, "the first file must be byte-unchanged -- still naming its own original reason");
    assert.doesNotMatch(content1, /second/);
    const content2 = readFileSync(path2, "utf8");
    assert.match(content2, /second/);
  });
});

test("no temporary file is left behind in the incidents directory after a write", () => {
  withTempIncidentsDir((dir) => {
    writeIncidentRecord({ port: 6510, epoch_before: 1, reason: "no leftovers" });
    const entries = readdirSync(dir);
    assert.ok(entries.length > 0, "sanity: the write must have produced at least one file");
    for (const entry of entries) {
      assert.ok(!entry.startsWith(".tmp-"), `a temporary file was left behind: ${entry}`);
    }
  });
});

// T-01.6.1-08 (this plan's own threat register entry): the atomic-write
// choke point must leave the record not group- or world-readable. Asserted
// directly against the file mode rather than merely trusted from reading the
// source, since a mode regression would otherwise be invisible to every
// other test in this file (none of them inspect permissions).
test("T-01.6.1-08: the written record's mode is not group- or world-readable", () => {
  withTempIncidentsDir(() => {
    const path = writeIncidentRecord({ port: 6510, epoch_before: 9, reason: "mode check" });
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode & 0o077, 0, `expected no group/world bits set, got mode ${mode.toString(8)}`);
  });
});

test("finaliseIncidentRecord() updates the outcome fields and leaves the frontmatter parseable", () => {
  withTempIncidentsDir(() => {
    const path = writeIncidentRecord({ port: 6510, epoch_before: 5, reason: "will be finalised" });
    const before = readFileSync(path, "utf8");
    assert.match(before, /outcome: 'pending'/);

    finaliseIncidentRecord(path, { outcome: "ok", kill_stage: "sigkill", epoch_after: 6 });

    const after = readFileSync(path, "utf8");
    assert.match(after, /outcome: 'ok'/);
    assert.match(after, /kill_stage: 'sigkill'/);
    assert.match(after, /epoch_after: 6/);
    // The original reason must survive the re-render untouched.
    assert.match(after, /will be finalised/);
    // Still parseable frontmatter: exactly one opening and one closing ---
    // delimiter pair at the top of the file.
    assert.match(after, /^---\n[\s\S]*?\n---\n/);
  });
});

test("finaliseIncidentRecord() on a record with no prior outcome fields still produces a well-formed, parseable file", () => {
  withTempIncidentsDir(() => {
    const path = writeIncidentRecord({ port: 6511, epoch_before: 1, reason: "timeout case" });
    finaliseIncidentRecord(path, { outcome: "timeout" });
    const content = readFileSync(path, "utf8");
    assert.match(content, /outcome: 'timeout'/);
    assert.match(content, /kill_stage: null/, "a field never supplied to finalise must remain null, not vanish");
  });
});

test("finaliseIncidentRecord() preserves the written record's restricted mode across the re-render", () => {
  withTempIncidentsDir(() => {
    const path = writeIncidentRecord({ port: 6512, epoch_before: 2, reason: "mode survives finalise" });
    finaliseIncidentRecord(path, { outcome: "ok", kill_stage: "sigterm", epoch_after: 3 });
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode & 0o077, 0, `expected no group/world bits set after finalise, got mode ${mode.toString(8)}`);
  });
});

// ---------------------------------------------------------------------------
// Plan 01.3-03 task 1: renderIncidentRecord()'s expanded evidence section --
// the full criterion-4 evidence set, one fixed-order item per line, with an
// unavailable item rendered as an EXPLICIT unavailable line rather than
// silently omitted (must_have 3).
// ---------------------------------------------------------------------------

function fullEvidenceFixture(): IncidentEvidence {
  return {
    bracket: { available: true, value: { cycles: 991234, elapsedMs: 1001 } },
    registers: { available: true, value: { PC: 0x1103, A: 1, X: 2, Y: 3, SP: 0xf0 } },
    checkpoints: {
      available: true,
      value: [{ checkpoint_num: 3, address: "$4000", enabled: true, flag: "stop" }],
    },
    irqHandler: {
      available: true,
      value: {
        target: 0xea31,
        pairLabel: "the RAM KERNAL IRQ vector pair ($0314/$0315)",
        explanation: "$01 read as $37 -- the RAM KERNAL IRQ vector pair ($0314/$0315) resolves to $EA31.",
      },
    },
    screenshot: { available: true, value: ".planning/incidents/20260802143000123-port6510-epoch7.png" },
  };
}

test("a record rendered from a full evidence object contains every evidence item under one heading, and evidence_complete is true", () => {
  withTempIncidentsDir(() => {
    const rendered = renderIncidentRecord({
      port: 6510,
      epoch_before: 7,
      reason: "full evidence test",
      evidence: fullEvidenceFixture(),
    });
    assert.match(rendered, /## Evidence/);
    assert.match(rendered, /evidence_complete: true/);
    assert.match(rendered, /cycle bracket: 991234 cycles retired in ~1001ms/);
    assert.match(rendered, /PC \$1103/);
    assert.match(rendered, /#3 \$4000 \(stop, enabled\)/);
    assert.match(rendered, /RAM KERNAL IRQ vector pair/);
    assert.match(rendered, /screenshot: saved to \.planning\/incidents\/20260802143000123-port6510-epoch7\.png/);
    // The frontmatter must still parse as YAML with the evidence section present.
    assert.match(rendered, /^---\n[\s\S]*?\n---\n/);
  });
});

test("an evidence object with a rejected item renders that item as an explicit unavailable line, and every other item is still populated; evidence_complete is false", () => {
  withTempIncidentsDir(() => {
    const evidence = fullEvidenceFixture();
    evidence.screenshot = { available: false, reason: "vice_display_screenshot rejected: disk full" };
    const rendered = renderIncidentRecord({ port: 6510, epoch_before: 7, reason: "partial failure test", evidence });
    assert.match(rendered, /screenshot: unavailable \(vice_display_screenshot rejected: disk full\)/);
    assert.match(rendered, /cycle bracket: 991234 cycles retired/, "an unrelated item's failure must not blank out the others");
    assert.match(rendered, /PC \$1103/);
    assert.match(rendered, /evidence_complete: false/);
  });
});

test("a fully-unavailable evidence object renders every item as an explicit unavailable line, never silently omitted", () => {
  withTempIncidentsDir(() => {
    const evidence = {
      bracket: { available: false, reason: "transport error: reset failed" },
      registers: { available: false, reason: "transport error: registers_get failed" },
      checkpoints: { available: false, reason: "transport error: checkpoint_list failed" },
      irqHandler: { available: false, reason: "transport error: memory_read failed" },
      screenshot: { available: false, reason: "transport error: screenshot failed" },
    };
    const rendered = renderIncidentRecord({ port: 6510, epoch_before: 7, reason: "total failure test", evidence });
    assert.match(rendered, /cycle bracket: unavailable \(transport error: reset failed\)/);
    assert.match(rendered, /program counter \/ register snapshot: unavailable \(transport error: registers_get failed\)/);
    assert.match(rendered, /armed checkpoints: unavailable \(transport error: checkpoint_list failed\)/);
    assert.match(rendered, /resolved live IRQ handler: unavailable \(transport error: memory_read failed\)/);
    assert.match(rendered, /screenshot: unavailable \(transport error: screenshot failed\)/);
    assert.match(rendered, /evidence_complete: false/);
  });
});

test("a record with no evidence at all (legacy shape) still renders a well-formed Evidence section and evidence_complete: false", () => {
  withTempIncidentsDir(() => {
    const rendered = renderIncidentRecord({ port: 6510, epoch_before: 7, reason: "no evidence" });
    assert.match(rendered, /## Evidence\n\n\(no evidence captured\)/);
    assert.match(rendered, /evidence_complete: false/);
  });
});

test("a snapshot evidence item (plan 01.3-03 task 2) renders as accepted-with-name when available, and unavailable-with-reason when not", () => {
  withTempIncidentsDir(() => {
    const acceptedEvidence = { ...fullEvidenceFixture(), snapshot: { available: true, value: { name: "20260802143000123-port6510-epoch7" } } };
    const acceptedRendered = renderIncidentRecord({ port: 6510, epoch_before: 7, reason: "snapshot ok", evidence: acceptedEvidence });
    assert.match(acceptedRendered, /pre-kill snapshot attempt: accepted \(name: 20260802143000123-port6510-epoch7\)/);
    assert.match(acceptedRendered, /never independently verified as written/);

    const rejectedEvidence = { ...fullEvidenceFixture(), snapshot: { available: false, reason: "vice_snapshot_save rejected: disk full" } };
    const rejectedRendered = renderIncidentRecord({ port: 6510, epoch_before: 7, reason: "snapshot rejected", evidence: rejectedEvidence });
    assert.match(rejectedRendered, /pre-kill snapshot attempt: unavailable \(vice_snapshot_save rejected: disk full\)/);
  });
});

test("finaliseIncidentRecord() preserves the ALREADY-RENDERED evidence section verbatim across the outcome re-render", () => {
  withTempIncidentsDir(() => {
    const path = writeIncidentRecord({ port: 6510, epoch_before: 7, reason: "evidence survives finalise", evidence: fullEvidenceFixture() });
    const before = readFileSync(path, "utf8");
    assert.match(before, /evidence_complete: true/);
    assert.match(before, /cycle bracket: 991234 cycles retired/);

    finaliseIncidentRecord(path, { outcome: "ok", kill_stage: "sigterm", epoch_after: 8 });

    const after = readFileSync(path, "utf8");
    assert.match(after, /outcome: 'ok'/);
    assert.match(after, /evidence_complete: true/, "evidence_complete must survive the finalise re-render");
    assert.match(after, /cycle bracket: 991234 cycles retired/, "the evidence section itself must survive the finalise re-render verbatim");
    assert.match(after, /screenshot: saved to \.planning\/incidents\/20260802143000123-port6510-epoch7\.png/);
  });
});

// ---------------------------------------------------------------------------
// Never-throw discipline (T-01.6.1-01): finaliseIncidentRecord() must degrade
// on a missing/corrupt existing file rather than propagate a read failure --
// it is called while a real vice_recycle is already mid-kill, and a thrown
// error here would lose the evidence captured so far as well as the process.
// ---------------------------------------------------------------------------

test("T-01.6.1-01: finaliseIncidentRecord() never throws, even against a path that does not exist", () => {
  withTempIncidentsDir((dir) => {
    const missingPath = join(dir, "does-not-exist.md");
    assert.doesNotThrow(() => finaliseIncidentRecord(missingPath, { outcome: "ok" }));
    const content = readFileSync(missingPath, "utf8");
    assert.match(content, /outcome: 'ok'/, "a well-formed record must still be produced from nothing");
  });
});

test("T-01.6.1-01: finaliseIncidentRecord() never throws against a truncated, non-frontmatter file, and still produces a well-formed record", () => {
  withTempIncidentsDir((dir) => {
    const path = writeIncidentRecord({ port: 6513, epoch_before: 4, reason: "will be corrupted" });
    // Overwrite with garbage that has no parseable frontmatter at all.
    writeFileSync(path, "not even close to yaml frontmatter, just garbage bytes\x00\xff");
    assert.doesNotThrow(() => finaliseIncidentRecord(path, { outcome: "ok", kill_stage: "sigkill" }));
    const content = readFileSync(path, "utf8");
    assert.match(content, /outcome: 'ok'/);
    assert.match(content, /^---\n[\s\S]*?\n---\n/, "must still produce parseable frontmatter from garbage input");
  });
});
