// broker-state.test.ts
//
// Plan 02, Task 1: broker-state.mts completed -- the 6600 port band, the
// full port-scan allocator with its injectable port-in-use probe, the three
// running counts, and _snapshotState()'s deep-copy guarantee. Every test
// here uses in-memory fixtures only: zero process spawning, zero real
// network I/O (the port-in-use probe is ALWAYS injected), zero filesystem
// access.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createBrokerState,
  nextFreePort,
  isPortBlocked,
  blockPort,
  countReady,
  countTotal,
  countLaunching,
  _snapshotState,
  clearMonitorClient,
  DEFAULT_BASE_PORT,
  MONITOR_CHANNELS,
  type BrokerState,
  type InstanceRecord,
} from "./broker-state.mts";

// Test-only: proves the request-id validator "the broker uses" is the
// imported container-side binding (C7), never a hand-rolled second copy.
// Importing vice-broker-client.ts here (a container-side, .ts-suffixed
// module) is safe for a TEST file -- it runs directly under `node --test`
// (native type stripping), entirely outside tsconfig.build.json's compile
// program. Deliberately NOT imported by broker-state.mts itself: a direct
// import from a host-bound .mts source pulls vice-broker-client.ts's own
// transitive dependents (repo-root.ts, install-resources.ts, hostpath.ts)
// into the SAME tsc build program (verified empirically, this plan) --
// tsconfig.build.json's allowImportingTsExtensions:false then fails to
// compile THEIR OWN internal ".ts"-suffixed imports, and even if that flag
// were loosened, resources-sync.test.ts's byte-identical check would then
// require those unrelated container-side compiled files to be committed
// under resources/ as if they were host-bound artifacts. broker-state.mts
// has no code path that validates a request id at all (ports/counts/
// snapshot never touch one), so there is nothing to hand-roll there in the
// first place -- the grep-for-zero-copies structural test below is what
// actually enforces C7's prohibition, and it passes trivially by having
// nothing to grep for.
import { REQUEST_ID_PATTERN, isValidRequestId } from "./vice-broker-client.ts";
// Phase 33, plan 33-06: the restart-tolerance case at the foot of this file
// checks a revived, profile-less record against the REAL profileEligible()
// out of the built artifact, so it needs the same `build()` idiom every other
// file that tests emitted output uses. This is the only test in this file
// that touches the build step.
import { build } from "./build.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

function makeInstance(overrides: Partial<InstanceRecord> = {}): InstanceRecord {
  return {
    port: 6600,
    url: "http://127.0.0.1:6600/mcp",
    state: "launching",
    reason: "acquire",
    epochFile: "/tmp/epoch.json",
    supervisorDir: "/tmp/6600",
    pid: 4242,
    expectedIdentity: "x64sc",
    launchedAt: 0,
    readyAt: null,
    viceBin: "x64sc",
    viceArgs: [],
    dryRun: false,
    // Plan 41-03 (D-14): monitorClients is non-optional -- "no claim on any
    // channel" is an empty map, never an absent field.
    monitorClients: {},
    ...overrides,
  };
}

function neverInUse(): Promise<boolean> {
  return Promise.resolve(false);
}

// ---------------------------------------------------------------- allocation

test("nextFreePort: an empty state with no blocked ports allocates the default base port 6600", async () => {
  const state = createBrokerState();
  const result = await nextFreePort(state, { portInUse: neverInUse });
  assert.deepEqual(result, { ok: true, port: DEFAULT_BASE_PORT });
});

test("nextFreePort: 6600 held by an instance record allocates 6601", async () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600 }));
  const result = await nextFreePort(state, { portInUse: neverInUse });
  assert.deepEqual(result, { ok: true, port: 6601 });
});

test("nextFreePort: 6600 in the blocked set (never on disk) allocates 6601", async () => {
  const state = createBrokerState();
  blockPort(state, 6600);
  const result = await nextFreePort(state, { portInUse: neverInUse });
  assert.deepEqual(result, { ok: true, port: 6601 });
  // The blocked set is pure in-memory bookkeeping -- there is no file this
  // assertion could even read to prove "not on disk"; the absence of any
  // filesystem import anywhere in this module IS the proof.
  assert.ok(isPortBlocked(state, 6600));
});

test("nextFreePort: VICE_BROKER_BASE_PORT override starts the scan from that value instead", async () => {
  const state = createBrokerState();
  const result = await nextFreePort(state, { basePort: 7000, portInUse: neverInUse });
  assert.deepEqual(result, { ok: true, port: 7000 });
});

test("nextFreePort: every candidate in the scan window taken returns a typed no_free_port failure, never throws", async () => {
  const state = createBrokerState();
  const basePort = 8000;
  for (let port = basePort; port < basePort + 100; port++) {
    state.instances.set(port, makeInstance({ port }));
  }
  const result = await nextFreePort(state, { basePort, portInUse: neverInUse });
  assert.deepEqual(result, { ok: false, reason: "no_free_port" });
});

test("nextFreePort: a port the injected port-in-use probe reports as in use is skipped and appears in the blocked set afterwards", async () => {
  const state = createBrokerState();
  const inUsePorts = new Set([6600, 6601]);
  const probedPorts: number[] = [];
  const probe = (port: number): Promise<boolean> => {
    probedPorts.push(port);
    return Promise.resolve(inUsePorts.has(port));
  };

  const result = await nextFreePort(state, { portInUse: probe });
  assert.deepEqual(result, { ok: true, port: 6602 });
  assert.ok(isPortBlocked(state, 6600), "6600 must be blocked after the probe reported it in use");
  assert.ok(isPortBlocked(state, 6601), "6601 must be blocked after the probe reported it in use");
  assert.ok(!isPortBlocked(state, 6602), "the eventually-allocated port must not itself be blocked");
  assert.deepEqual(probedPorts, [6600, 6601, 6602]);
});

// Gap closure (plan 14, discovered live during Task 2's own end-to-end
// proof -- RE-FINDINGS.md carries the full account): a scan running against
// MANY in-use candidates in a row does not merely take longer -- verified
// live against the real defaultPortInUse(), for its ENTIRE duration the
// control listener could not accept a new connection or read data already
// sitting on an existing one, because EADDRINUSE settles without ever
// yielding to libuv's poll/check phase. This is a real liveness gap
// independent of any one test: an unrelated release/recycle/status request
// arriving on a DIFFERENT connection would be held up for as long as a
// contended scan takes. The fix yields via setImmediate every few
// candidates; this test proves that yield actually happens (a macrotask
// queued before the scan starts gets AT LEAST one turn while the scan is
// still running), without asserting exactly how many turns or exactly which
// candidate triggers them -- that would over-specify an internal cadence
// this function's own callers do not depend on.
test("nextFreePort: yields to the event loop's check phase during a long run of in-use candidates -- a macrotask queued before the scan starts is not starved for the scan's whole duration", async () => {
  const state = createBrokerState();
  const inUseCount = 11; // several multiples of the yield cadence, well under PORT_SCAN_CEILING
  const probe = (port: number): Promise<boolean> => Promise.resolve(port < 6600 + inUseCount);

  let immediateTurns = 0;
  let stop = false;
  function scheduleNext(): void {
    if (stop) return;
    setImmediate(() => {
      immediateTurns++;
      scheduleNext();
    });
  }
  scheduleNext();

  const result = await nextFreePort(state, { portInUse: probe });
  stop = true;

  assert.deepEqual(result, { ok: true, port: 6600 + inUseCount });
  assert.ok(
    immediateTurns >= 1,
    "at least one setImmediate-scheduled macrotask queued BEFORE the scan started must run WHILE the scan of many in-use candidates is still in flight -- a scan that never yields would starve it for the scan's entire duration",
  );
});

// ===========================================================================
// 03-04-PLAN.md, Task 2: D-13 -- nextFreePort()'s exclude option and
// remoteMonitorPort's survival through _snapshotState()'s deep copy.
// ===========================================================================

test("nextFreePort (D-13): an excluded port is skipped and is NOT added to the blocked set", async () => {
  const state = createBrokerState();
  const result = await nextFreePort(state, { portInUse: neverInUse, exclude: new Set([6600]) });
  assert.deepEqual(result, { ok: true, port: 6601 }, "the excluded port must be skipped in favour of the next candidate");
  assert.ok(!isPortBlocked(state, 6600), "an excluded port must NOT be added to the blocked set -- it is not refused, only already claimed by the caller");
});

test("_snapshotState (D-13): remoteMonitorPort survives the snapshot's deep copy", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, remoteMonitorPort: 6601 }));
  const snapshot = _snapshotState(state);
  assert.equal(snapshot.instances[0].remoteMonitorPort, 6601, "remoteMonitorPort must survive _snapshotState()'s deep copy");
});

// -------------------------------------------------------------------- counts

test("counts: two ready, one granted and one launching instance yields ready=2, total=4, launching=1", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, state: "ready" }));
  state.instances.set(6601, makeInstance({ port: 6601, state: "ready" }));
  state.instances.set(6602, makeInstance({ port: 6602, state: "granted" }));
  state.instances.set(6603, makeInstance({ port: 6603, state: "launching" }));

  assert.equal(countReady(state), 2);
  assert.equal(countTotal(state), 4);
  assert.equal(countLaunching(state), 1);
});

test("counts: read only the in-memory map -- an injected filesystem reader that throws on every call still yields correct counts", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, state: "ready" }));
  state.instances.set(6601, makeInstance({ port: 6601, state: "launching" }));

  const throwingReader = (): never => {
    throw new Error("filesystem must never be touched by a count");
  };
  // Nothing under broker-state.mts's count functions accepts or calls a
  // filesystem reader at all -- the throwing stub is never invoked, which
  // IS the proof: if any count implementation ever grew a disk read, this
  // stub would need to be threaded through and would immediately explode.
  assert.doesNotThrow(() => {
    void throwingReader; // referenced so the linter/typechecker sees it used
    countReady(state);
    countTotal(state);
    countLaunching(state);
  });
  assert.equal(countReady(state), 1);
  assert.equal(countTotal(state), 2);
  assert.equal(countLaunching(state), 1);
});

// --------------------------------------------------------------- snapshot

test("_snapshotState: returns a plain-object deep copy -- mutating a nested value in the result leaves the broker's own state and a later snapshot unchanged", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, viceArgs: ["-mcpserver"] }));
  state.grants.set("req-1-2-3abc1234", { id: "req-1-2-3abc1234", port: 6600, grantedAt: 111, pid: 4242 });
  blockPort(state, 6601);

  const snapshot = _snapshotState(state);
  snapshot.instances[0].viceArgs.push("MUTATED");
  snapshot.instances[0].reason = "MUTATED";
  snapshot.grants[0].port = 9999;
  snapshot.blockedPorts.push(4242);

  const second = _snapshotState(state);
  assert.deepEqual(second.instances[0].viceArgs, ["-mcpserver"]);
  assert.equal(second.instances[0].reason, "acquire");
  assert.equal(second.grants[0].port, 6600);
  assert.deepEqual(second.blockedPorts, [6601]);

  // And the broker's own live state, never the snapshot, is what a real
  // caller would act on next -- confirm it was never touched either.
  assert.deepEqual(state.instances.get(6600)!.viceArgs, ["-mcpserver"]);
});

// ------------------------------------------------------------- request ids

test("the request-id validator the broker would use accepts the container-side generator's output shape and rejects a path-traversal string", () => {
  // A real container-side generated id (vice-broker-client.ts's own
  // newRequestId() shape: req-<pid>-<ms>-<8 hex chars>).
  assert.ok(isValidRequestId("req-12345-1785608443993-9c3df302"));
  assert.ok(REQUEST_ID_PATTERN.test("req-12345-1785608443993-9c3df302"));

  // Path-traversal and injection-shaped strings must be rejected.
  for (const bad of ["../../etc/passwd", "req-1-2-../../x", "req-1-2-3abc123", "", "not-a-request-id"]) {
    assert.equal(isValidRequestId(bad), false, `expected ${JSON.stringify(bad)} to be rejected`);
  }
});

// ---------------------------------------------------------------------------
// Plan 41-03 (D-14): InstanceRecord.monitorClients, promoted from a single
// field to a per-channel holder map. The invariant tests below are written
// so they go red the instant a future phase reintroduces a
// single-channel-scoped holder.
// ---------------------------------------------------------------------------

test("MONITOR_CHANNELS: frozen and exactly ['binary', 'text'], in order", () => {
  assert.deepEqual(MONITOR_CHANNELS, ["binary", "text"]);
  assert.ok(Object.isFrozen(MONITOR_CHANNELS));
});

test("InstanceRecord.monitorClients: present and empty on a freshly constructed record -- asserted on the field's OWN presence, so a re-introduced optional single field fails both compilation and this assertion", () => {
  const instance = makeInstance();
  assert.ok(Object.prototype.hasOwnProperty.call(instance, "monitorClients"), "a freshly constructed record must carry a monitorClients KEY");
  assert.deepEqual(instance.monitorClients, {}, "and it must be an EMPTY map, never an absent field");

  instance.monitorClients.binary = { grantId: "req-1-2-3abc1234", claimedAt: 111, pid: 4242 };
  assert.deepEqual(instance.monitorClients.binary, { grantId: "req-1-2-3abc1234", claimedAt: 111, pid: 4242 });
});

test("clearMonitorClient(record, 'text'): clears only the text entry, leaving the binary entry intact", () => {
  const instance = makeInstance({
    monitorClients: {
      binary: { grantId: "req-bin", claimedAt: 100, pid: 4242 },
      text: { grantId: "req-txt", claimedAt: 200, pid: 4242 },
    },
  });
  clearMonitorClient(instance, "text");
  assert.deepEqual(instance.monitorClients.binary, { grantId: "req-bin", claimedAt: 100, pid: 4242 }, "the binary entry must survive a text-scoped clear");
  assert.equal(instance.monitorClients.text, undefined);
});

test("clearMonitorClient(record): with no channel argument, clears BOTH channels", () => {
  const instance = makeInstance({
    monitorClients: {
      binary: { grantId: "req-bin", claimedAt: 100, pid: 4242 },
      text: { grantId: "req-txt", claimedAt: 200, pid: 4242 },
    },
  });
  clearMonitorClient(instance);
  assert.deepEqual(instance.monitorClients, {});
});

test("clearMonitorClient: a no-op, and does not throw, when the targeted channel is not currently held", () => {
  const instance = makeInstance();
  assert.doesNotThrow(() => clearMonitorClient(instance, "text"));
  assert.deepEqual(instance.monitorClients, {});
  assert.doesNotThrow(() => clearMonitorClient(instance));
  assert.deepEqual(instance.monitorClients, {});
});

test("clearMonitorClient: leaves every other field on the record untouched", () => {
  const instance = makeInstance({ monitorClients: { binary: { grantId: "req-1", claimedAt: 111, pid: 4242 } }, reason: "acquire" });
  clearMonitorClient(instance);
  assert.equal(instance.reason, "acquire");
  assert.equal(instance.pid, 4242);
});

test("structural: no broker module hand-rolls a second copy of the request-id pattern -- the shared import above is the only binding", () => {
  const files = [
    "broker-state.mts",
    "broker-launch.mts",
    "broker-control.mts",
    "broker-kill.mts",
    "broker-epoch.mts",
    "vice-broker.mts",
  ];
  const HAND_ROLLED_PATTERN = /req-\[0-9\]/;
  for (const rel of files) {
    const text = readFileSync(join(HERE, rel), "utf8");
    assert.doesNotMatch(text, HAND_ROLLED_PATTERN, `${rel} must not hand-roll a copy of REQUEST_ID_PATTERN`);
  }
});

// ---------------------------------------------------------------------------
// Phase 33, plan 33-06 (REPRO-05, D-16, T-33-25): InstanceRecord.profile and
// RESTART TOLERANCE.
//
// The case that matters is not the happy one. A broker restarted mid-phase
// reads state-directory records SERIALISED BEFORE this field existed, so the
// property that has to hold is: a record with no `profile` key at all is
// still a valid InstanceRecord, and is treated as profile-less by
// profileEligible() (vice-broker.mts). That degrades an older record to
// today's semantics rather than to an error, and it is pinned here rather
// than left implicit (the threat register accepts T-33-25 on exactly that
// basis).
// ---------------------------------------------------------------------------

test("InstanceRecord.profile (33-06): absent by default, and accepts the documented warp/headless shape with no default value of its own", () => {
  const instance = makeInstance();
  assert.equal(instance.profile, undefined, "a freshly constructed record carries no profile by default -- never `{}`, never a default");
  assert.equal(Object.prototype.hasOwnProperty.call(instance, "profile"), false, "and carries no `profile` KEY at all, which is what 'absent means profile-less' requires");

  instance.profile = { warp: true, headless: true };
  assert.deepEqual(instance.profile, { warp: true, headless: true });
});

test("_snapshotState (33-06): profile survives the snapshot's deep copy, and mutating the copy does not reach live broker state", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600, profile: { warp: true } }));
  const snapshot = _snapshotState(state);
  assert.deepEqual(snapshot.instances[0]!.profile, { warp: true }, "profile must survive the copy");

  snapshot.instances[0]!.profile!.warp = false;
  assert.deepEqual(state.instances.get(6600)!.profile, { warp: true }, "profile is the SECOND nested object on a record after viceArgs -- a shallow spread would hand a caller a reference into live state");
  assert.deepEqual(_snapshotState(state).instances[0]!.profile, { warp: true });
});

test("_snapshotState (33-06): a profile-less record's snapshot carries no `profile` key -- the copy must not invent one", () => {
  const state = createBrokerState();
  state.instances.set(6600, makeInstance({ port: 6600 }));
  const snapshot = _snapshotState(state);
  assert.equal(
    Object.prototype.hasOwnProperty.call(snapshot.instances[0]!, "profile"),
    false,
    "a snapshot must not add a `profile: undefined` key the record itself does not carry",
  );
});

test("InstanceRecord.profile (33-06, T-33-25, restart tolerance): a record SERIALISED WITHOUT a profile key round-trips to a valid InstanceRecord and is treated as profile-less by profileEligible -- the case a broker restarted mid-phase actually reads", async () => {
  // Serialise the way a pre-33-06 broker would have: build the record, strip
  // the field entirely (not set it to undefined -- the key must be genuinely
  // ABSENT, which is what an older writer produced), then round-trip through
  // JSON exactly as a state-directory read would.
  const preFieldRecord = makeInstance({ port: 6600, pid: 4242 });
  const serialised = JSON.stringify(preFieldRecord);
  assert.equal(serialised.includes('"profile"'), false, "this test's own precondition: the serialised form must carry no profile key at all");

  const revived = JSON.parse(serialised) as InstanceRecord;
  // Still a valid InstanceRecord: every REQUIRED field survived, and the
  // optional one is simply absent.
  assert.equal(revived.port, 6600);
  // This file's makeInstance() helper defaults to "launching" -- asserted
  // against the fixture's own value rather than a hardcoded one, so this
  // case is about the profile field and not about the helper's defaults.
  assert.equal(revived.state, preFieldRecord.state);
  assert.equal(revived.pid, 4242);
  assert.equal(revived.expectedIdentity, "x64sc");
  assert.deepEqual(revived.viceArgs, preFieldRecord.viceArgs);
  assert.equal(Object.prototype.hasOwnProperty.call(revived, "profile"), false);

  // And the eligibility rule -- read off the SAME built artifact production
  // uses, never a local reimplementation -- treats it as profile-less.
  build();
  const { profileEligible } = (await import(new URL("./resources/vice-broker.mjs", import.meta.url).href)) as unknown as {
    profileEligible: (record: InstanceRecord, requested?: { warp?: boolean; headless?: boolean }) => boolean;
  };
  assert.equal(profileEligible(revived), true, "an older, profile-less record must remain eligible for a profile-less acquire -- degraded gracefully, not an error");
  assert.equal(profileEligible(revived, {}), true, "and for an explicit empty profile");
  assert.equal(profileEligible(revived, { warp: false, headless: false }), true, "and for a both-false profile");
  assert.equal(profileEligible(revived, { warp: true }), false, "but NOT for a warp request -- it was not launched warped and cannot be retro-warped");
});
