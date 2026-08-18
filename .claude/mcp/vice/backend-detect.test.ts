// backend-detect.test.ts
//
// ENVIRONMENT CONSTRAINT (2026-08-13, explicit user scope override): "we
// can't do tests with deciding what vice is". No test in this file spawns,
// launches, or interrogates a real VICE binary -- every scenario below
// drives ONE of three tested surfaces: (1) the explicit VICE_BACKEND
// override path, (2) the on-disk cache's read/write/invalidate/staleness
// lifecycle, and (3) classifyHelpOutput()'s pure STRING-PARSING logic
// against fixture strings authored here as test inputs. `probeBackend()`'s
// own spawn seam (`spawnHelp`) is ALWAYS injected with a stub in every test
// that reaches it -- nothing here ever calls node:child_process's real
// spawnSync.
//
// Every fixture string fed to classifyHelpOutput() below is labelled
// ASSUMED: it is an author-constructed guess at what a real build's --help
// output might contain (per D-02's discriminator tokens), NOT a captured
// transcript from any real binary. docs/phase2-backend-probe-evidence.md
// section 2 records this discriminator as an explicit OPEN question --
// neither confirmed nor refuted against real hardware -- and nothing in
// this file upgrades that verdict. See
// .planning/todos/pending/2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md
// for what a real-hardware run must still confirm.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  classifyHelpOutput,
  probeBackend,
  resolvedBackend,
  resetResolvedBackendForTests,
  readCapabilityRecord,
  writeCapabilityRecord,
  CAPABILITY_SCHEMA_VERSION,
  type ResolvedBackendDeps,
  type SpawnHelpResult,
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
 * stubbed -- no real filesystem stat, no real PATH walk, no real spawn.
 * Every test overrides only the fields its own scenario cares about. */
function stubDeps(overrides: Partial<ResolvedBackendDeps> = {}): ResolvedBackendDeps {
  return {
    env: {},
    viceBin: "/fake/x64sc",
    resolveBinPath: (bin) => bin,
    stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }),
    probe: () => "stock",
    now: () => 1700000000000,
    log: () => {},
    ...overrides,
  };
}

// ===========================================================================
// classifyHelpOutput() -- pure string classification. Every fixture string
// below is an ASSUMED shape, authored for this test, never a real --help
// transcript (see this file's own header comment).
// ===========================================================================

test("classifyHelpOutput: returns 'fork' when the ASSUMED fixture text contains -mcpserver", () => {
  const assumedForkHelpText = "usage: x64sc [options]\n  -mcpserver          Enable MCP server\n";
  assert.equal(classifyHelpOutput(assumedForkHelpText), "fork");
});

test("classifyHelpOutput: returns 'stock' when the ASSUMED fixture text contains -binarymonitor but not -mcpserver", () => {
  const assumedStockHelpText = "usage: x64sc [options]\n  -binarymonitor      Enable binary monitor\n";
  assert.equal(classifyHelpOutput(assumedStockHelpText), "stock");
});

test("classifyHelpOutput: returns 'unknown' when the ASSUMED fixture text contains neither discriminator token", () => {
  const assumedUnrelatedHelpText = "usage: x64sc [options]\n  -help               Show this help\n";
  assert.equal(classifyHelpOutput(assumedUnrelatedHelpText), "unknown");
});

test("classifyHelpOutput: returns 'unknown' for empty text (a probe that spawned nothing usable)", () => {
  assert.equal(classifyHelpOutput(""), "unknown");
});

test("classifyHelpOutput: 'fork' wins when an ASSUMED fixture text contains both tokens", () => {
  const assumedBothHelpText = "usage: x64sc [options]\n  -mcpserver\n  -binarymonitor\n";
  assert.equal(classifyHelpOutput(assumedBothHelpText), "fork");
});

// ===========================================================================
// probeBackend() -- the --help fallback ladder, driven entirely through the
// injected spawnHelp seam. No real binary is ever spawned.
// ===========================================================================

test("probeBackend: uses --help's output directly when it exits zero", () => {
  const calls: string[] = [];
  const result = probeBackend("/fake/x64sc", {
    spawnHelp: (bin, flag): SpawnHelpResult => {
      calls.push(flag);
      return { text: "-binarymonitor", exitedZero: true };
    },
  });
  assert.equal(result, "stock");
  assert.deepEqual(calls, ["--help"], "must not fall back once --help succeeds with output");
});

test("probeBackend: falls back to -help then -? only when a run exits non-zero with EMPTY output", () => {
  const calls: string[] = [];
  const result = probeBackend("/fake/x64sc", {
    spawnHelp: (bin, flag): SpawnHelpResult => {
      calls.push(flag);
      if (flag === "-?") return { text: "-mcpserver", exitedZero: false };
      return { text: "", exitedZero: false };
    },
  });
  assert.equal(result, "fork");
  assert.deepEqual(calls, ["--help", "-help", "-?"]);
});

test("probeBackend: does NOT fall back when a run exits non-zero but still produced output", () => {
  const calls: string[] = [];
  const result = probeBackend("/fake/x64sc", {
    spawnHelp: (bin, flag): SpawnHelpResult => {
      calls.push(flag);
      return { text: "-binarymonitor", exitedZero: false };
    },
  });
  assert.equal(result, "stock");
  assert.deepEqual(calls, ["--help"], "non-zero exit with usable output must not trigger a fallback");
});

test("probeBackend: a spawn failure (ENOENT-shaped, reported as empty output) on every flag never throws and classifies as 'unknown'", () => {
  assert.doesNotThrow(() => {
    // Mirrors defaultSpawnHelp's own internal try/catch contract: a spawn
    // failure is reported as { text: "", exitedZero: false }, never a thrown
    // error out of the spawnHelp seam itself.
    const result = probeBackend("/fake/x64sc", {
      spawnHelp: (): SpawnHelpResult => ({ text: "", exitedZero: false }),
    });
    assert.equal(result, "unknown");
  });
});

test("probeBackend: three empty, non-zero runs never throw and classify as 'unknown'", () => {
  const result = probeBackend("/fake/x64sc", {
    spawnHelp: (): SpawnHelpResult => ({ text: "", exitedZero: false }),
  });
  assert.equal(result, "unknown");
});

// ===========================================================================
// resolvedBackend(): the VICE_BACKEND override path -- checked first, never
// spawns, never touches the cache.
// ===========================================================================

test("resolvedBackend: override branch returns 'stock' for VICE_BACKEND=stock without spawning anything", () => {
  resetResolvedBackendForTests();
  let probeCalls = 0;
  const result = resolvedBackend(
    stubDeps({ env: { VICE_BACKEND: "stock" }, probe: () => { probeCalls++; return "fork"; } }),
  );
  assert.equal(result.backend, "stock");
  assert.equal(result.source, "override");
  assert.equal(probeCalls, 0);
});

test("resolvedBackend: override branch returns 'fork' for VICE_BACKEND=fork without spawning anything", () => {
  resetResolvedBackendForTests();
  let probeCalls = 0;
  const result = resolvedBackend(
    stubDeps({ env: { VICE_BACKEND: "fork" }, probe: () => { probeCalls++; return "stock"; } }),
  );
  assert.equal(result.backend, "fork");
  assert.equal(result.source, "override");
  assert.equal(probeCalls, 0);
});

test("resolvedBackend: override is exact-string-matched -- an unrecognised VICE_BACKEND value falls through to detection instead", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps({ env: { VICE_BACKEND: "bogus" }, probe: () => "stock" }));
  assert.equal(result.source, "probe");
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

test("WR-05: a resolvable binary yields the RESOLVED absolute path, flagged resolved, on the probe path", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(
    stubDeps({ viceBin: "x64sc", resolveBinPath: () => "/usr/local/bin/x64sc", probe: () => "stock" }),
  );
  assert.equal(result.source, "probe");
  assert.equal(result.binPath, "/usr/local/bin/x64sc", "the configured name must not be reported as the path when a real one is known");
  assert.equal(result.binPathResolved, true);
});

test("WR-05: an UNRESOLVABLE binary falls back to the configured name and is flagged unresolved", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps({ viceBin: "x64sc", resolveBinPath: () => null, probe: () => "stock" }));
  assert.equal(result.binPath, "x64sc", "the configured name is still reported -- it is the only information available");
  assert.equal(result.binPathResolved, false, "and it must never claim to be resolved");
});

test("WR-05: the override path resolves too -- an explicit VICE_BACKEND does not mean an unresolved path", () => {
  resetResolvedBackendForTests();
  const resolved = resolvedBackend(
    stubDeps({ env: { VICE_BACKEND: "stock" }, viceBin: "x64sc", resolveBinPath: () => "/opt/vice/bin/x64sc" }),
  );
  assert.equal(resolved.source, "override");
  assert.equal(resolved.binPath, "/opt/vice/bin/x64sc");
  assert.equal(resolved.binPathResolved, true);

  resetResolvedBackendForTests();
  const unresolved = resolvedBackend(stubDeps({ env: { VICE_BACKEND: "stock" }, viceBin: "x64sc", resolveBinPath: () => null }));
  assert.equal(unresolved.binPath, "x64sc");
  assert.equal(unresolved.binPathResolved, false);
});

test("WR-05: the override path still spawns nothing while resolving the path", () => {
  resetResolvedBackendForTests();
  let probeCalls = 0;
  const result = resolvedBackend(
    stubDeps({
      env: { VICE_BACKEND: "fork" },
      viceBin: "x64sc",
      resolveBinPath: () => "/usr/bin/x64sc",
      probe: () => {
        probeCalls++;
        return "stock";
      },
    }),
  );
  assert.equal(result.binPath, "/usr/bin/x64sc");
  assert.equal(probeCalls, 0, "resolution is a filesystem lookup, never a spawn -- the override path must stay spawn-free");
});

test("WR-05: the indeterminate outcome carries the resolved path too, not the bare name", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(
    stubDeps({ viceBin: "x64sc", resolveBinPath: () => "/usr/bin/x64sc", probe: () => "unknown" }),
  );
  assert.equal(result.source, "indeterminate");
  assert.equal(result.binPath, "/usr/bin/x64sc");
  assert.equal(result.binPathResolved, true);
});

test("WR-05: probeBackend still receives the UNRESOLVED configured name, so the OS's own PATH search happens as it would for a real invocation", () => {
  resetResolvedBackendForTests();
  const probedWith: string[] = [];
  const result = resolvedBackend(
    stubDeps({
      viceBin: "x64sc",
      resolveBinPath: () => "/usr/bin/x64sc",
      probe: (bin) => {
        probedWith.push(bin);
        return "stock";
      },
    }),
  );
  assert.deepEqual(probedWith, ["x64sc"], "the probe target is deliberately the configured name, not the resolved path");
  assert.equal(result.binPath, "/usr/bin/x64sc", "while the REPORTED path is the resolved one");
});

// ===========================================================================
// resolvedBackend(): the on-disk cache -- hit, miss (each identity field),
// malformed file, absent file.
// ===========================================================================

test("resolvedBackend: cache hit returns the cached backend without spawning when resolvedPath/mtimeMs/sizeBytes all match", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    let probeCalls = 0;
    // Prime the cache via a real probe first.
    const first = resolvedBackend(
      stubDeps({ supervisorDir: dir, probe: () => { probeCalls++; return "stock"; } }),
    );
    assert.equal(first.source, "probe");
    assert.equal(probeCalls, 1);

    resetResolvedBackendForTests(); // clear only the in-process memo -- the ON-DISK cache survives
    const second = resolvedBackend(
      stubDeps({ supervisorDir: dir, probe: () => { probeCalls++; return "fork"; } }),
    );
    assert.equal(second.source, "cache");
    assert.equal(second.backend, "stock", "the cached verdict, not whatever the (never-called) probe stub would have said");
    assert.equal(probeCalls, 1, "the second resolution must not have spawned a second probe");
  });
});

test("resolvedBackend: changing the binary's mtimeMs invalidates the cache and forces a re-probe", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    let probeCalls = 0;
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }), probe: () => { probeCalls++; return "stock"; } }));
    assert.equal(probeCalls, 1);

    resetResolvedBackendForTests();
    const second = resolvedBackend(
      stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 9999, sizeBytes: 5000 }), probe: () => { probeCalls++; return "fork"; } }),
    );
    assert.equal(probeCalls, 2, "a changed mtimeMs must force a fresh probe");
    assert.equal(second.source, "probe");
    assert.equal(second.backend, "fork");
  });
});

test("resolvedBackend: changing the binary's sizeBytes invalidates the cache and forces a re-probe", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    let probeCalls = 0;
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 5000 }), probe: () => { probeCalls++; return "stock"; } }));
    assert.equal(probeCalls, 1);

    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, stat: () => ({ mtimeMs: 1000, sizeBytes: 6001 }), probe: () => { probeCalls++; return "fork"; } }));
    assert.equal(probeCalls, 2, "a changed sizeBytes must force a fresh probe");
  });
});

test("resolvedBackend: changing the resolved binary path invalidates the cache and forces a re-probe", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    let probeCalls = 0;
    resolvedBackend(stubDeps({ supervisorDir: dir, resolveBinPath: () => "/fake/x64sc-v1", probe: () => { probeCalls++; return "stock"; } }));
    assert.equal(probeCalls, 1);

    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, resolveBinPath: () => "/fake/x64sc-v2", probe: () => { probeCalls++; return "fork"; } }));
    assert.equal(probeCalls, 2, "a different resolved path (e.g. VICE_BIN repointed) must force a fresh probe");
  });
});

test("resolvedBackend: a malformed cache file is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    writeFileSync(join(dir, "backend.json"), "{ not valid json ][");
    resetResolvedBackendForTests();
    let probeCalls = 0;
    const result = resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => { probeCalls++; return "stock"; } }));
    assert.equal(result.source, "probe");
    assert.equal(probeCalls, 1);
  });
});

test("resolvedBackend: a wrong-shaped cache file (missing required fields) is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    writeFileSync(join(dir, "backend.json"), JSON.stringify({ version: 1, backend: "stock" }));
    resetResolvedBackendForTests();
    let probeCalls = 0;
    const result = resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => { probeCalls++; return "fork"; } }));
    assert.equal(result.source, "probe");
    assert.equal(probeCalls, 1);
  });
});

test("resolvedBackend: an absent cache file is treated as a miss, not an error", () => {
  withScratchDir((dir) => {
    assert.equal(existsSync(join(dir, "backend.json")), false);
    resetResolvedBackendForTests();
    const result = resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));
    assert.equal(result.source, "probe");
  });
});

test("cache write is atomic: the committed backend.json round-trips through JSON exactly once written, with no leftover tmp sibling", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));

    const finalPath = join(dir, "backend.json");
    assert.ok(existsSync(finalPath), "backend.json must exist after a successful probe+cache-write");
    const parsed = JSON.parse(readFileSync(finalPath, "utf8"));
    assert.equal(parsed.backend, "stock");
    assert.equal(parsed.resolvedPath, "/fake/x64sc");

    const leftovers = readdirSync(dir).filter((f) => f.includes(".tmp-"));
    assert.deepEqual(leftovers, [], "no tmp-sibling file must survive a successful write");
  });
});

test("resolvedBackend: when supervisorDir is omitted, the cache is skipped entirely -- no backend.json is ever written", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: undefined, probe: () => "stock" }));
    assert.equal(existsSync(join(dir, "backend.json")), false);
  });
});

// ===========================================================================
// resolvedBackend(): the indeterminate outcome -- never throws, degrades to
// "fork", writes no cache entry, and emits its own note.
// ===========================================================================

test("resolvedBackend: an indeterminate outcome (classification 'unknown') never throws and returns backend 'fork'", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    assert.doesNotThrow(() => {
      const result = resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "unknown" }));
      assert.equal(result.backend, "fork");
      assert.equal(result.source, "indeterminate");
      assert.ok(result.note && result.note.includes("VICE_BACKEND"), "the indeterminate note must tell the user how to override explicitly");
    });
  });
});

test("resolvedBackend: an indeterminate outcome writes NO cache entry, so a later, working probe is not shadowed by a stale non-answer", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "unknown" }));
    assert.equal(existsSync(join(dir, "backend.json")), false);
  });
});

test("resolvedBackend: an indeterminate outcome still returns a startable configuration (backend 'fork', a valid binPath, no thrown error)", () => {
  resetResolvedBackendForTests();
  const result = resolvedBackend(stubDeps({ probe: () => "unknown" }));
  assert.equal(result.backend, "fork");
  assert.equal(typeof result.binPath, "string");
  assert.ok(result.binPath.length > 0);
});

// ===========================================================================
// resolvedBackend(): once-per-process memoisation and the D-06 one-time
// note -- the "resolves exactly once at startup" guarantee this file's own
// module-level memo exists to enforce.
// ===========================================================================

test("resolvedBackend: memoises the answer once resolved -- calling it many times in one process triggers the probe only once (startup)", () => {
  resetResolvedBackendForTests();
  let probeCalls = 0;
  const deps = stubDeps({ probe: () => { probeCalls++; return "stock"; } });
  resolvedBackend(deps);
  resolvedBackend(deps);
  resolvedBackend(deps);
  assert.equal(probeCalls, 1, "a broker that resolves the backend once at startup and reuses the answer for every later launch must never probe twice");
});

test("resolvedBackend: emits exactly one detected-backend note per process, however many times it is called (D-06, once unset)", () => {
  resetResolvedBackendForTests();
  const notes: string[] = [];
  const deps = stubDeps({ probe: () => "stock", log: (line) => notes.push(line) });
  resolvedBackend(deps);
  resolvedBackend(deps);
  resolvedBackend(deps);
  const detectedNotes = notes.filter((n) => n.includes("detected backend"));
  assert.equal(detectedNotes.length, 1, `expected exactly one detected-backend note, got ${detectedNotes.length}: ${JSON.stringify(notes)}`);
  assert.ok(detectedNotes[0].includes("VICE_BACKEND=stock") && detectedNotes[0].includes("VICE_BACKEND=fork"));
});

test("resolvedBackend: the override path never consults or populates the memo, so a test process can freely alternate scenarios", () => {
  resetResolvedBackendForTests();
  const first = resolvedBackend(stubDeps({ env: { VICE_BACKEND: "stock" } }));
  const second = resolvedBackend(stubDeps({ env: { VICE_BACKEND: "fork" } }));
  assert.equal(first.backend, "stock");
  assert.equal(second.backend, "fork");
});

// ===========================================================================
// readCapabilityRecord()/writeCapabilityRecord() -- BACK-04's round trip.
// ===========================================================================

test("readCapabilityRecord/writeCapabilityRecord: round-trip versionQuad and cpuHistoryAvailable against an existing backend verdict", () => {
  withScratchDir((dir) => {
    resetResolvedBackendForTests();
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));

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
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));
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
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));
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
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));
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

test("writeCapabilityRecord: a no-op when no matching backend verdict is on record yet -- never invents one", () => {
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
    resolvedBackend(stubDeps({ supervisorDir: dir, probe: () => "stock" }));
    const record = readCapabilityRecord("/fake/x64sc", { supervisorDir: dir, resolveBinPath: () => "/fake/x64sc" });
    assert.equal(record, null);
  });
});
