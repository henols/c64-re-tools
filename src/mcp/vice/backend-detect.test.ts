// backend-detect.test.ts
//
// FORKRM-01 (plan 52-06) removed two of the three code paths this file used
// to drive: the explicit environment-variable backend override and the
// `--help` probe that used to classify a binary as fork or stock. Both are
// gone from backend-detect.mts, not merely unreachable, so the tests
// exercising them are gone too, structurally -- see this plan's SUMMARY for
// the removal record.
//
// What SURVIVES, and what this file now covers:
//   (1) WR-05 binary-path resolution (`binPath`/`binPathResolved`) --
//       unaffected by the collapse, since it never depended on which
//       backend was detected.
//   (2) The on-disk identity cache's read/write/invalidate lifecycle --
//       still real, still worth testing, but now keyed on identity alone
//       (resolvedPath/mtimeMs/sizeBytes) rather than on a backend verdict
//       there is no longer anything to determine.
//   (3) Once-per-process memoisation -- resolvedBackend() still resolves at
//       most once per process; there is no longer a one-time "detected
//       backend" note to pin, since there is nothing left to detect.
//   (4) readCapabilityRecord()/writeCapabilityRecord() -- BACK-04's round
//       trip, unaffected by the collapse (it never encoded a backend
//       verdict of its own).
//
// The REAL HARDWARE (EXTV-02) fixture class -- verbatim `--help` transcripts
// under fixtures/backend-detect/ -- is deleted along with the probe it
// pinned as a regression; see this plan's SUMMARY for that removal too.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  resolvedBackend,
  resetResolvedBackendForTests,
  readCapabilityRecord,
  writeCapabilityRecord,
  CAPABILITY_SCHEMA_VERSION,
  type ResolvedBackendDeps,
} from "./backend-detect.mts";

function withScratchDir<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), "backend-detect-test-"));
  try {
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** A fully-injected ResolvedBackendDeps fixture with every dependency
 * stubbed -- no real filesystem stat, no real PATH walk. Every test
 * overrides only the fields its own scenario cares about. */
function stubDeps(overrides: Partial<ResolvedBackendDeps> = {}): ResolvedBackendDeps {
  return {
    env: {},
    viceBin: "/fake/x64sc",
    resolveBinPath: (bin) => bin,
    stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }),
    now: () => 1700000000000,
    ...overrides,
  };
}

// ===========================================================================
// resolvedBackend(): backend is always "stock" -- there is nothing left to
// detect between (FORKRM-01, plan 52-06).
// ===========================================================================

test("resolvedBackend: always returns backend 'stock', with no supervisorDir and no cache interaction", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps());
  assert.equal(result.backend, "stock");
});

// ===========================================================================
// WR-05: binPath is the RESOLVED absolute path when there is one, and
// binPathResolved says which of the two cases the caller has. Every
// resolvedBackend() return path used to hand back the raw configured name while
// two consumers' doc comments (and BACK-03's own `vice_ping` field name)
// claimed resolution -- so `vice_ping` on stock reported "x64sc", which inside
// a container names nothing at all.
// ===========================================================================

test("WR-05: a resolvable binary yields the RESOLVED absolute path, flagged resolved", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(
    stubDeps({ viceBin: "x64sc", resolveBinPath: () => "/usr/local/bin/x64sc" }),
  );
  assert.equal(result.binPath, "/usr/local/bin/x64sc", "the configured name must not be reported as the path when a real one is known");
  assert.equal(result.binPathResolved, true);
});

test("WR-05: an UNRESOLVABLE binary falls back to the configured name and is flagged unresolved", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps({ viceBin: "x64sc", resolveBinPath: () => null }));
  assert.equal(result.binPath, "x64sc", "the configured name is still reported -- it is the only information available");
  assert.equal(result.binPathResolved, false, "and it must never claim to be resolved");
});

// ===========================================================================
// resolvedBackend(): the on-disk identity cache -- (re)initialised on a
// fresh or changed identity, left untouched on a matching one, tolerant of
// a malformed/wrong-shaped/absent file, and skipped entirely with no
// supervisorDir.
// ===========================================================================

test("resolvedBackend: a fresh identity (no prior cache) writes an identity record", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));
    const finalPath = join(dir, "backend.json");
    assert.ok(existsSync(finalPath), "backend.json must exist after a fresh resolution with a supervisorDir");
    const parsed = JSON.parse(readFileSync(finalPath, "utf8"));
    assert.equal(parsed.resolvedPath, "/fake/x64sc");
    assert.equal(parsed.mtimeMs, 1000);
    assert.equal(parsed.sizeBytes, 5000);
  });
});

test("resolvedBackend: a matching identity on a later process leaves the existing record untouched (no unnecessary rewrite)", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, now: () => 1000 }));
    const firstProbedAt = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8")).probedAt;

    resetResolvedBackendForTests(); // clear only the in-process memo -- the ON-DISK cache survives
    resolvedBackend(stubDeps({ supervisorDir: dir, now: () => 2000 }));
    const secondProbedAt = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8")).probedAt;

    assert.equal(secondProbedAt, firstProbedAt, "a matching identity must not trigger a rewrite -- probedAt must not move");
  });
});

test("resolvedBackend: changing the binary's mtimeMs invalidates the cache and forces a fresh identity record", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }), now: () => 1000 }));

    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 9999, sizeBytes: 5000 }), now: () => 2000 }));

    const parsed = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8"));
    assert.equal(parsed.mtimeMs, 9999, "a changed mtimeMs must force a fresh identity record");
    assert.equal(parsed.probedAt, new Date(2000).toISOString(), "the fresh record must be re-stamped, not reused");
  });
});

test("resolvedBackend: changing the binary's sizeBytes invalidates the cache and forces a fresh identity record", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }) }));

    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 6001 }) }));

    const parsed = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8"));
    assert.equal(parsed.sizeBytes, 6001, "a changed sizeBytes must force a fresh identity record");
  });
});

test("resolvedBackend: changing the resolved binary path invalidates the cache and forces a fresh identity record", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, resolveBinPath: () => "/fake/x64sc-v1" }));

    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, resolveBinPath: () => "/fake/x64sc-v2" }));

    const parsed = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8"));
    assert.equal(parsed.resolvedPath, "/fake/x64sc-v2", "a different resolved path (e.g. VICE_BIN repointed) must force a fresh identity record");
  });
});

test("resolvedBackend: a malformed cache file is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    writeFileSync(join(dir, "backend.json"), "{ not valid json ][");
    resetResolvedBackendForTests();
    assert.doesNotThrow(() => resolvedBackend(stubDeps({ supervisorDir: dir })));
    const parsed = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8"));
    assert.equal(parsed.resolvedPath, "/fake/x64sc");
  });
});

test("resolvedBackend: a wrong-shaped cache file (missing required fields) is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    writeFileSync(join(dir, "backend.json"), JSON.stringify({ version: 1 }));
    resetResolvedBackendForTests();
    assert.doesNotThrow(() => resolvedBackend(stubDeps({ supervisorDir: dir })));
    const parsed = JSON.parse(readFileSync(join(dir, "backend.json"), "utf8"));
    assert.equal(parsed.resolvedPath, "/fake/x64sc");
  });
});

test("resolvedBackend: an absent cache file is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    assert.equal(existsSync(join(dir, "backend.json")), false);
    resetResolvedBackendForTests();
    assert.doesNotThrow(() => resolvedBackend(stubDeps({ supervisorDir: dir })));
  });
});

test("cache write is atomic: the committed backend.json round-trips through JSON exactly once written, with no leftover tmp sibling", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));

    const finalPath = join(dir, "backend.json");
    assert.ok(existsSync(finalPath), "backend.json must exist after a fresh resolution");
    const parsed = JSON.parse(readFileSync(finalPath, "utf8"));
    assert.equal(parsed.resolvedPath, "/fake/x64sc");

    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    assert.deepEqual(leftovers, [], "no tmp-sibling file must survive a successful write");
  });
});

test("resolvedBackend: when supervisorDir is omitted, the cache is skipped entirely -- no backend.json is ever written", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: undefined }));
    assert.equal(existsSync(join(dir, "backend.json")), false);
  });
});

// ===========================================================================
// resolvedBackend(): once-per-process memoisation -- the "resolves exactly
// once at startup" guarantee this file's own module-level memo exists to
// enforce.
// ===========================================================================

test("resolvedBackend: memoises the answer once resolved -- calling it many times in one process stats the binary only once", () => {
  resetResolvedBackendForTests();
  let statCalls = 0;
  const deps = stubDeps({ stat: () => { statCalls++; return { mtimeMs: 1000, sizeBytes: 5000 }; } });
  resolvedBackend(deps);
  resolvedBackend(deps);
  resolvedBackend(deps);
  assert.equal(statCalls, 1, "a broker that resolves once at startup and reuses the answer for every later launch must never re-stat the binary");
});

test("resolvedBackend: repeated calls return the exact same result object (in-process memo, not merely equal values)", () => {
  resetResolvedBackendForTests();
  const deps = stubDeps();
  const first = resolvedBackend(deps);
  const second = resolvedBackend(deps);
  assert.equal(first, second);
});

// ===========================================================================
// Plan 60-06 (LOC-03 gap closure, PD-13): `locationRefusal` -- the seam's
// own `refusal` carried onto `ResolvedBackendResult` -- and the PD-01
// branch's fallback to the seam's own `envCandidate` as the configured
// name shown when resolution fails. Both are consumer-side controls: they
// prove `resolvedBackend()` propagates what `resolveTool()` reported rather
// than re-deriving or discarding it, without this file ever reading one of
// the four declared environment-variable names itself
// (`tool-location-consumers.test.ts` is what polices that).
// ===========================================================================

test("resolvedBackend: the PD-02 injected-override branch always reports locationRefusal null, even when resolution fails", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps({ viceBin: "x64sc", resolveBinPath: () => null }));
  assert.equal(result.binPathResolved, false);
  assert.equal(result.locationRefusal, null, "the injected-override branch never reaches the seam and so never has a refusal to carry");
});

test("resolvedBackend: the PD-01 seam branch reports locationRefusal null when the seam resolves successfully", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    const result = resolvedBackend({
      toolsDir: dir,
      projectRoot: dir,
      env: {},
      locate: () => ({ id: "x64sc", path: "/resolved/x64sc", tried: ["/resolved/x64sc"], layer: "env", mechanism: "VICE_BIN", refusal: null, envCandidate: "/resolved/x64sc" }),
      stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }),
    });
    assert.equal(result.binPath, "/resolved/x64sc");
    assert.equal(result.binPathResolved, true);
    assert.equal(result.locationRefusal, null);
  });
});

test("resolvedBackend: the PD-01 seam branch carries the seam's own refusal verbatim, and reports the developer's own value as the configured name (binPathResolved false)", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    const refusalText = '"x64sc"\'s VICE_BIN environment variable is set to "x64sc-absent", which did not resolve to an executable file';
    const result = resolvedBackend({
      toolsDir: dir,
      projectRoot: dir,
      env: {},
      locate: () => ({ id: "x64sc", path: null, tried: ["x64sc-absent"], layer: null, mechanism: null, refusal: refusalText, envCandidate: "x64sc-absent" }),
    });
    assert.equal(result.binPath, "x64sc-absent", "the configured name shown on failure must be the developer's own value, not the literal x64sc");
    assert.equal(result.binPathResolved, false);
    assert.equal(result.locationRefusal, refusalText, "the seam's refusal must be carried verbatim, never re-authored");
  });
});

test("resolvedBackend: the PD-01 seam branch falls back to the literal x64sc as the configured name when the seam reports no envCandidate", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    const result = resolvedBackend({
      toolsDir: dir,
      projectRoot: dir,
      env: {},
      locate: () => ({ id: "x64sc", path: null, tried: [], layer: null, mechanism: null, refusal: null, envCandidate: null }),
    });
    assert.equal(result.binPath, "x64sc", "with no envCandidate at all (e.g. an unset variable), the configured name stays the literal x64sc");
    assert.equal(result.binPathResolved, false);
    assert.equal(result.locationRefusal, null);
  });
});

// ===========================================================================
// readCapabilityRecord()/writeCapabilityRecord() -- BACK-04's round trip.
// Unaffected by FORKRM-01: neither function ever encoded a backend verdict
// of its own.
// ===========================================================================

test("readCapabilityRecord/writeCapabilityRecord: round-trip versionQuad and cpuHistoryAvailable against an existing identity record", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));

    writeCapabilityRecord(
      "/fake/x64sc",
      { versionQuad: "3.9.0.0", cpuHistoryAvailable: false },
      { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc", stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }) },
    );

    const record = readCapabilityRecord("/fake/x64sc", { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc" });
    assert.ok(record);
    assert.equal(record!.versionQuad, "3.9.0.0");
    assert.equal(record!.cpuHistoryAvailable, false);
    assert.equal(record!.stale, false);
  });
});

test("readCapabilityRecord: a stored versionQuad differing from the observed one is reported as stale", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));
    writeCapabilityRecord(
      "/fake/x64sc",
      { versionQuad: "3.9.0.0", cpuHistoryAvailable: false },
      { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc", stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }) },
    );

    const record = readCapabilityRecord("/fake/x64sc", {
      supervisorDir: dir,
      resolveBinPath: () => "/fake/x64sc",
      observedVersionQuad: "3.10.0.0",
    });
    assert.ok(record);
    assert.equal(record!.stale, true, "an observed version quad different from the stored one must be reported stale");
  });
});

// CR-01 (07-REVIEW.md re-review): staleness must also be keyed on the CLIENT
// schema that decided the capability, not the VICE version quad alone. Before
// this, a capability answer produced by a buggy client parser survived every
// subsequent parser fix and could only be cleared by upgrading VICE or
// hand-deleting a file under .vice-supervisor/.
test("readCapabilityRecord: a record written by a DIFFERENT client capability schema is stale even when the version quad matches (CR-01)", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));
    writeCapabilityRecord(
      "/fake/x64sc",
      { versionQuad: "3.10.0.0", cpuHistoryAvailable: false },
      { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc", stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }) },
    );

    // Hand-rewrite the stamped schema to an older one, exactly as a record
    // written by a previous release would read back.
    const cachePath = join(dir, "backend.json");
    const onDisk = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
    assert.equal(onDisk.capabilitySchema, CAPABILITY_SCHEMA_VERSION, "every write must stamp the schema that decided the capability");
    onDisk.capabilitySchema = CAPABILITY_SCHEMA_VERSION - 1;
    writeFileSync(cachePath, JSON.stringify(onDisk, null, 2) + "\n");

    const record = readCapabilityRecord("/fake/x64sc", {
      supervisorDir: dir,
      resolveBinPath: () => "/fake/x64sc",
      observedVersionQuad: "3.10.0.0",
    });
    assert.ok(record);
    assert.equal(record!.capabilitySchema, CAPABILITY_SCHEMA_VERSION - 1);
    assert.equal(record!.stale, true, "a matching version quad must NOT rescue a record decided by a different client schema");
  });
});

test("readCapabilityRecord: a record with NO capabilitySchema at all (written before the field existed) is stale (CR-01)", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));
    writeCapabilityRecord(
      "/fake/x64sc",
      { versionQuad: "3.10.0.0", cpuHistoryAvailable: false },
      { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc", stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }) },
    );
    const cachePath = join(dir, "backend.json");
    const onDisk = JSON.parse(readFileSync(cachePath, "utf8")) as Record<string, unknown>;
    delete onDisk.capabilitySchema;
    writeFileSync(cachePath, JSON.stringify(onDisk, null, 2) + "\n");

    const record = readCapabilityRecord("/fake/x64sc", {
      supervisorDir: dir,
      resolveBinPath: () => "/fake/x64sc",
      observedVersionQuad: "3.10.0.0",
    });
    assert.ok(record);
    assert.equal(record!.capabilitySchema, undefined);
    assert.equal(record!.stale, true, "a pre-field record is exactly the record a possibly-broken parser wrote -- it must be re-probed");
  });
});

test("writeCapabilityRecord: a no-op when no matching identity record is on record yet -- never invents one", () => {
  withScratchDir((dir) => {
    writeCapabilityRecord(
      "/fake/x64sc",
      { versionQuad: "3.9.0.0", cpuHistoryAvailable: false },
      { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc" },
    );
    assert.equal(existsSync(join(dir, "backend.json")), false);
  });
});

test("readCapabilityRecord: returns null when nothing has been recorded for this binary yet", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir }));
    const record = readCapabilityRecord("/fake/x64sc", { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc" });
    assert.equal(record, null);
  });
});
