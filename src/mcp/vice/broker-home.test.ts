// broker-home.test.ts
//
// Plan 62-02, Task 1: precedence, two-project isolation, and
// idempotent-creation cases for broker-home.mts's machine-level root and its
// derived directories (BROKER-06, D-13, D-14).
//
// Every environment value is driven through the injectable `env`/`homedir`
// options, never `process.env` mutation, so cases cannot leak into a sibling
// test file (this suite has no mocking library). Every scratch path is a
// fresh `mkdtempSync(tmpdir())` directory, reaped in a `try`/`finally` --
// this suite has a recorded history of races on repo-tree scratch files, so
// no case here writes anywhere under the repository working tree.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";

import { HOST_BOUND_ARTIFACTS } from "./build.ts";
import {
  BROKER_HOME_ENV,
  brokerHome,
  brokerStateDir,
  brokerIncidentsDir,
  brokerEpochFile,
  brokerStagingDir,
  brokerRunsDir,
  ensureBrokerDir,
} from "./broker-home.mts";
import * as brokerHomeModule from "./broker-home.mts";

test("broker-home.mts exports exactly the eight documented names", () => {
  const expected = [
    "BROKER_HOME_ENV",
    "brokerHome",
    "brokerStateDir",
    "brokerIncidentsDir",
    "brokerEpochFile",
    "brokerStagingDir",
    "brokerRunsDir",
    "ensureBrokerDir",
  ].sort();
  assert.deepEqual(Object.keys(brokerHomeModule).sort(), expected);
});

function tempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

test("BROKER_HOME_ENV is exactly the string VICE_BROKER_HOME", () => {
  assert.equal(BROKER_HOME_ENV, "VICE_BROKER_HOME");
});

test("brokerHome(): no environment set resolves to the injected home directory joined with the project's tools directory name", () => {
  const home = tempDir("broker-home-default-");
  try {
    assert.equal(brokerHome({ env: {}, homedir: home }), join(home, ".c64-re-tools"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("brokerHome(): VICE_BROKER_HOME set to a relative path resolves to an absolute path", () => {
  const result = brokerHome({ env: { [BROKER_HOME_ENV]: "relative/broker/root" } });
  assert.ok(
    result.startsWith(sep),
    `expected an absolute path (leading separator), got: ${result}`
  );
});

test("brokerHome(): VICE_BROKER_HOME set to an absolute path resolves to that exact path", () => {
  const abs = tempDir("broker-home-abs-");
  try {
    assert.equal(brokerHome({ env: { [BROKER_HOME_ENV]: abs } }), resolve(abs));
  } finally {
    rmSync(abs, { recursive: true, force: true });
  }
});

test("brokerHome(): VICE_BROKER_HOME set to the empty string is treated as unset", () => {
  const home = tempDir("broker-home-empty-");
  try {
    assert.equal(
      brokerHome({ env: { [BROKER_HOME_ENV]: "" }, homedir: home }),
      join(home, ".c64-re-tools")
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("legacy variable 1/4: VICE_POOL_DIR wins for brokerStateDir(), leaving incidents/epoch/staging resolving under the machine-level root", () => {
  const pool = tempDir("broker-home-pool-");
  const home = tempDir("broker-home-home-");
  try {
    const opts = { env: { VICE_POOL_DIR: pool }, homedir: home };
    const root = join(home, ".c64-re-tools");
    assert.equal(brokerStateDir(opts), resolve(pool));
    assert.ok(brokerIncidentsDir(opts).startsWith(root));
    assert.ok(brokerEpochFile(opts).startsWith(root));
    assert.ok(brokerStagingDir(opts).startsWith(root));
  } finally {
    rmSync(pool, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("legacy variable 2/4: VICE_SUPERVISOR_DIR wins for brokerStateDir(), leaving incidents/epoch/staging resolving under the machine-level root", () => {
  const supervisor = tempDir("broker-home-supervisor-");
  const home = tempDir("broker-home-home-");
  try {
    const opts = { env: { VICE_SUPERVISOR_DIR: supervisor }, homedir: home };
    const root = join(home, ".c64-re-tools");
    assert.equal(brokerStateDir(opts), resolve(supervisor));
    assert.ok(brokerIncidentsDir(opts).startsWith(root));
    assert.ok(brokerEpochFile(opts).startsWith(root));
    assert.ok(brokerStagingDir(opts).startsWith(root));
  } finally {
    rmSync(supervisor, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("legacy variable 3/4: VICE_INCIDENTS_DIR wins for brokerIncidentsDir(), leaving state/epoch/staging resolving under the machine-level root", () => {
  const incidents = tempDir("broker-home-incidents-");
  const home = tempDir("broker-home-home-");
  try {
    const opts = { env: { VICE_INCIDENTS_DIR: incidents }, homedir: home };
    const root = join(home, ".c64-re-tools");
    assert.equal(brokerIncidentsDir(opts), resolve(incidents));
    assert.ok(brokerStateDir(opts).startsWith(root));
    assert.ok(brokerEpochFile(opts).startsWith(root));
    assert.ok(brokerStagingDir(opts).startsWith(root));
  } finally {
    rmSync(incidents, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("legacy variable 4/4: VICE_EPOCH_FILE wins for brokerEpochFile(), leaving state/incidents/staging resolving under the machine-level root", () => {
  const epochFile = join(tempDir("broker-home-epoch-"), "epoch.json");
  const home = tempDir("broker-home-home-");
  try {
    const opts = { env: { VICE_EPOCH_FILE: epochFile }, homedir: home };
    const root = join(home, ".c64-re-tools");
    assert.equal(brokerEpochFile(opts), resolve(epochFile));
    assert.ok(brokerStateDir(opts).startsWith(root));
    assert.ok(brokerIncidentsDir(opts).startsWith(root));
    assert.ok(brokerStagingDir(opts).startsWith(root));
  } finally {
    rmSync(epochFile, { force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("two-project isolation: none of the six resolved broker paths falls inside either of two distinct project roots", () => {
  const projectA = tempDir("broker-home-projA-");
  const projectB = tempDir("broker-home-projB-");
  const home = tempDir("broker-home-shared-home-");
  try {
    const opts = { env: {}, homedir: home };
    const resolved = [
      brokerHome(opts),
      brokerStateDir(opts),
      brokerIncidentsDir(opts),
      brokerEpochFile(opts),
      brokerStagingDir(opts),
      brokerRunsDir("oracle", opts),
    ];
    for (const p of resolved) {
      assert.ok(!p.startsWith(projectA), `${p} must not be inside project A (${projectA})`);
      assert.ok(!p.startsWith(projectB), `${p} must not be inside project B (${projectB})`);
    }
  } finally {
    rmSync(projectA, { recursive: true, force: true });
    rmSync(projectB, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});

test("ensureBrokerDir(): called twice on the same path leaves exactly one directory and throws on neither call", () => {
  const parent = tempDir("broker-home-ensure-");
  try {
    const target = join(parent, "a", "b", "c");
    assert.doesNotThrow(() => ensureBrokerDir(target));
    assert.doesNotThrow(() => ensureBrokerDir(target));
    const entries = readdirSync(join(parent, "a", "b"));
    assert.deepEqual(entries, ["c"]);
  } finally {
    rmSync(parent, { recursive: true, force: true });
  }
});

test("brokerRunsDir(): resolves a per-kind subdirectory under the machine-level root's runs directory", () => {
  const home = tempDir("broker-home-runs-");
  try {
    const opts = { env: {}, homedir: home };
    assert.equal(brokerRunsDir("ghidra", opts), join(home, ".c64-re-tools", "runs", "ghidra"));
    assert.equal(brokerRunsDir("oracle", opts), join(home, ".c64-re-tools", "runs", "oracle"));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("build.ts's HOST_BOUND_ARTIFACTS includes broker-home.mjs", () => {
  assert.ok(HOST_BOUND_ARTIFACTS.includes("broker-home.mjs"));
});
