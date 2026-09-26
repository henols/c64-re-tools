// broker-epoch.test.ts
//
// Task 1 (this file, this commit): frozen-contract assertions against the
// two epoch fixtures captured live from the running bash broker in
// `fixtures/README.md`, BEFORE `vice-supervisor.sh`'s `write_epoch()` is
// deleted. These assertions pin down the "before" shape of the epoch record
// so a later plan's TypeScript
// writer (`broker-epoch.mts`, plan 03) can be held to it with something
// concrete to diff against.
//
// Task 3 (this file, this plan 01) extends this with the writer's own
// fixture-diff test now that `broker-epoch.mts` exists: build a record from
// the 6510 fixture's own values, write it through the real writer, and
// assert the emitted key set and each value's type match the fixture
// exactly.
//
// Plan 03, Task 1 extends this further: the mode check (T-01.6.2-18), the
// path derivations for a known port, the epoch-increment derivation
// (fresh/second/malformed-record cases), the concurrent write-and-read
// atomicity assertion (T-01.6.2-19).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { writeEpochRecord, epochPathFor, instanceLogDirFor, nextEpochFor, type EpochRecord } from "./broker-epoch.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(HERE, "fixtures");

/** The exact eight fields the bash writer's `write_epoch()` emits
 * (`vice-supervisor.sh` lines 289-306), in the order it prints them. */
const EPOCH_FIELDS = [
  "epoch",
  "spawned_at",
  "pid",
  "supervisor_pid",
  "vice_bin",
  "vice_args",
  "log",
  "dry_run",
] as const;

interface EpochFixtureCase {
  file: string;
  port: string;
}

const EPOCH_FIXTURES: EpochFixtureCase[] = [
  { file: "bash-epoch-6510.json", port: "6510" },
  { file: "bash-epoch-6514.json", port: "6514" },
];

function readFixtureJson(name: string): unknown {
  const raw = readFileSync(join(FIXTURES_DIR, name), "utf8");
  return JSON.parse(raw);
}

for (const { file, port } of EPOCH_FIXTURES) {
  test(`frozen epoch fixture ${file}: exact eight-field key set`, () => {
    const parsed = readFixtureJson(file) as Record<string, unknown>;
    const keys = Object.keys(parsed).sort();
    assert.deepEqual(keys, [...EPOCH_FIELDS].sort());
  });

  test(`frozen epoch fixture ${file}: field types and values`, () => {
    const parsed = readFixtureJson(file) as Record<string, unknown>;

    assert.ok(Number.isInteger(parsed.epoch), "epoch must decode to a finite integer");

    assert.equal(typeof parsed.spawned_at, "string");
    assert.ok(
      Number.isFinite(Date.parse(parsed.spawned_at as string)),
      "spawned_at must parse as a date",
    );

    assert.ok(
      Number.isInteger(parsed.pid) && (parsed.pid as number) > 0,
      "pid must be a positive integer",
    );

    assert.ok(Array.isArray(parsed.vice_args), "vice_args must be an array");
    const viceArgs = parsed.vice_args as unknown[];
    assert.ok(
      viceArgs.every((v) => typeof v === "string"),
      "every vice_args element must be a string",
    );
    assert.equal(
      viceArgs[viceArgs.length - 1],
      port,
      "vice_args's last element must be the instance's own port as a string",
    );

    assert.equal(typeof parsed.log, "string");
    assert.ok(
      (parsed.log as string).startsWith("logs/"),
      "log must be a relative path beginning with the per-instance log directory name",
    );
    assert.ok(!(parsed.log as string).startsWith("/"), "log must be a relative path, not absolute");
  });
}

test("broker-epoch.mts's writeEpochRecord() round-trips a record built from the 6510 fixture's own values, matching key set and value types exactly", () => {
  const fixture = readFixtureJson("bash-epoch-6510.json") as Record<string, unknown>;
  const dir = mkdtempSync(join(tmpdir(), "broker-epoch-fixture-diff-"));
  try {
    const record: EpochRecord = {
      epoch: fixture.epoch as number,
      spawned_at: fixture.spawned_at as string,
      pid: fixture.pid as number,
      supervisor_pid: fixture.supervisor_pid as number,
      vice_bin: fixture.vice_bin as string,
      vice_args: fixture.vice_args as string[],
      log: fixture.log as string,
      dry_run: fixture.dry_run as boolean,
    };

    const path = writeEpochRecord({ supervisorDir: dir, record });
    const written = JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;

    // Asserted against the FIXTURE FILE's own key set directly (plan 03,
    // Task 1's own acceptance criterion) -- not the EPOCH_FIELDS literal
    // above. A literal-list comparison could drift silently if EPOCH_FIELDS
    // were ever edited to match a mistaken understanding of the contract;
    // comparing against the fixture's own keys means the contract can only
    // ever be judged against the frozen evidence itself.
    assert.deepEqual(Object.keys(written).sort(), Object.keys(fixture).sort());
    for (const field of EPOCH_FIELDS) {
      assert.equal(
        typeof written[field],
        typeof (fixture as Record<string, unknown>)[field],
        `field ${field}: type must match the fixture's own type`,
      );
    }
    assert.deepEqual(written.vice_args, fixture.vice_args);
    assert.equal(written.epoch, fixture.epoch);
    assert.equal(written.pid, fixture.pid);
    assert.equal(written.supervisor_pid, fixture.supervisor_pid);
    assert.equal(written.vice_bin, fixture.vice_bin);
    assert.equal(written.log, fixture.log);
    assert.equal(written.dry_run, fixture.dry_run);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// ===========================================================================
// Plan 03, Task 1: the writer completed -- mode, path derivations, the
// epoch-increment derivation, atomic-write-under-concurrency, and a round
// trip through the unchanged container-side reader.
// ===========================================================================

function makeRecord(overrides: Partial<EpochRecord> = {}): EpochRecord {
  return {
    epoch: 1,
    spawned_at: "2026-08-03T17:15:13Z",
    pid: 4242,
    supervisor_pid: process.pid,
    vice_bin: "x64sc",
    vice_args: ["-mcpserver", "-mcpserverhost", "0.0.0.0", "-mcpserverport", "6600"],
    log: "logs/x64sc-20260803-171513.log",
    dry_run: false,
    ...overrides,
  };
}

test("writeEpochRecord: the written file's mode is owner-read-write only (T-01.6.2-18)", () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-epoch-mode-"));
  try {
    const path = writeEpochRecord({ supervisorDir: dir, record: makeRecord() });
    const mode = statSync(path).mode & 0o777;
    assert.equal(mode, 0o600, `epoch.json mode must be 0o600, got 0o${mode.toString(8)}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("epochPathFor: port 6600 resolves to the epoch file inside the per-instance directory named 6600 under the state directory", () => {
  const stateDir = "/tmp/vice-supervisor-test-state";
  const path = epochPathFor(stateDir, 6600);
  assert.equal(path, join(stateDir, "6600", "epoch.json"));
});

test("instanceLogDirFor: port 6600 resolves to the logs directory inside the SAME per-instance directory epochPathFor uses", () => {
  const stateDir = "/tmp/vice-supervisor-test-state";
  const logDir = instanceLogDirFor(stateDir, 6600);
  assert.equal(logDir, join(stateDir, "6600", "logs"));
  // Structural: both derivations must share the same per-instance directory
  // prefix -- asserted directly rather than trusted, since this is exactly
  // the property (D-04/D-23) that keeps the epoch record's `log` field and
  // the file actually written from ever disagreeing.
  const epochPath = epochPathFor(stateDir, 6600);
  assert.ok(epochPath.startsWith(join(stateDir, "6600")));
  assert.ok(logDir.startsWith(join(stateDir, "6600")));
});

test("nextEpochFor: a fresh instance (no prior epoch.json) records 1; a second write for the same instance records 2; a write over a malformed existing record records 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-epoch-next-"));
  try {
    const firstEpoch = nextEpochFor(dir);
    assert.equal(firstEpoch, 1, "a fresh instance's first epoch must be 1");
    writeEpochRecord({ supervisorDir: dir, record: makeRecord({ epoch: firstEpoch }) });

    const secondEpoch = nextEpochFor(dir);
    assert.equal(secondEpoch, 2, "the same instance's second write must record epoch 2");
    writeEpochRecord({ supervisorDir: dir, record: makeRecord({ epoch: secondEpoch }) });

    // Malformed existing record (not valid JSON) -- never throws, and
    // never refuses to let a fresh instance start over an unreadable file.
    writeFileSync(join(dir, "epoch.json"), "{ not valid json");
    const afterMalformed = nextEpochFor(dir);
    assert.equal(afterMalformed, 1, "a malformed existing record must not block a write -- treated as no usable prior record");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("nextEpochFor: absent, non-object, and non-integer-epoch records all resolve to 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-epoch-next-edge-"));
  try {
    assert.equal(nextEpochFor(join(dir, "does-not-exist")), 1, "an absent directory must resolve to 1");

    writeFileSync(join(dir, "epoch.json"), JSON.stringify(["not", "an", "object"]));
    assert.equal(nextEpochFor(dir), 1, "a non-object JSON value must resolve to 1");

    writeFileSync(join(dir, "epoch.json"), JSON.stringify({ epoch: "not-a-number" }));
    assert.equal(nextEpochFor(dir), 1, "a non-integer epoch field must resolve to 1");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a concurrent write-and-read loop over the epoch file never observes a partial document (T-01.6.2-19)", async () => {
  const dir = mkdtempSync(join(tmpdir(), "broker-epoch-concurrency-"));
  const path = join(dir, "epoch.json");
  try {
    let writing = true;
    let observedReads = 0;

    const writer = (async () => {
      for (let i = 1; i <= 150; i++) {
        writeEpochRecord({ supervisorDir: dir, record: makeRecord({ epoch: i, pid: 4242 + i }) });
        // Yield to the event loop between writes so the async reader below
        // genuinely gets a scheduling opportunity to race the rename --
        // this is what makes the concurrency real rather than nominal.
        await new Promise<void>((r) => setImmediate(r));
      }
      writing = false;
    })();

    const reader = (async () => {
      while (writing) {
        try {
          const raw = await readFile(path, "utf8");
          observedReads++;
          if (raw.length > 0) {
            // Must be COMPLETELY parseable -- a partial write (had the
            // rename not been atomic) would throw here.
            const parsed: unknown = JSON.parse(raw);
            assert.ok(
              typeof parsed === "object" && parsed !== null && Number.isInteger((parsed as Record<string, unknown>).epoch),
              "every non-empty read must be a complete, parseable epoch record",
            );
          }
        } catch (e) {
          const code = (e as NodeJS.ErrnoException).code;
          assert.ok(code === "ENOENT", `a read must either succeed completely or find the file absent, never fail with ${String(code)}: ${(e as Error).message}`);
        }
        await new Promise<void>((r) => setImmediate(r));
      }
    })();

    await Promise.all([writer, reader]);
    assert.ok(observedReads > 0, "the concurrent reader must have observed at least one read during the write loop");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
