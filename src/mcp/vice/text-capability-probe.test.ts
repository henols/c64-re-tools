// text-capability-probe.test.ts
//
// Deterministic, no-emulator coverage for text-capability-probe.ts (PARSE-04).
// Task 1 lands the classifier, the identity-keyed cache, and the
// concurrency/ordering machinery. Task 2 extends this file with the
// user-facing message's three distinguishable shapes (missing / indeterminate
// / chip-level degradation) and the phase-number-free assertion.
//
// The stub `dial` function used throughout is never a socket, never an
// emulator -- exactly as `withTextTool()`'s own callers are dependency-
// injected in stock-dispatch.test.ts. The capable path is proven against the
// real committed captures via `loadTextFixture`, never a hand-typed success
// string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { loadTextFixture } from "./textmon-fixtures.ts";
import {
  TEXT_CAPABILITY_COMMANDS,
  CPUHISTORY_DISABLED_STUB,
  classifyTextCapabilityResponse,
  textCapabilityCacheKey,
  probeTextCapability,
  textCapabilityRefusalMessage,
  resetTextCapabilityCache,
  type TextCapabilityIdentity,
  type TextCapabilityCommand,
  type TextCapabilityVerdict,
} from "./text-capability-probe.ts";

const HERE = fileURLToPath(import.meta.url);
const OWN_MODULE = HERE.replace(/text-capability-probe\.test\.ts$/, "text-capability-probe.ts");

// ---------------------------------------------------------------------------
// Test helpers -- test-only, never exported from the probe module itself.
// ---------------------------------------------------------------------------

/** Splits a fixture sidecar's `capturedFrom` (e.g. "stock:/usr/bin/x64sc")
 * into a resolved TextCapabilityIdentity -- so the test's notion of which
 * binary answered comes from the real capture's own provenance, never a
 * hand-typed literal. */
function identityFromCapturedFrom(capturedFrom: string): TextCapabilityIdentity {
  const idx = capturedFrom.indexOf(":");
  const backend = capturedFrom.slice(0, idx) as "stock" | "fork";
  const binPath = capturedFrom.slice(idx + 1);
  return { backend, binPath, resolved: true };
}

const STOCK_IDENTITY: TextCapabilityIdentity = { backend: "stock", binPath: "/usr/bin/x64sc", resolved: true };
const UNRESOLVED_IDENTITY: TextCapabilityIdentity = { backend: "stock", binPath: "x64sc", resolved: false };

function makeCountingDial(response: string | (() => Promise<string> | string)): {
  dial: (command: TextCapabilityCommand) => Promise<string>;
  count: () => number;
} {
  let calls = 0;
  const dial = async (_command: TextCapabilityCommand): Promise<string> => {
    calls++;
    if (typeof response === "string") return response;
    return response();
  };
  return { dial, count: () => calls };
}

function makeRejectingDial(message: string): {
  dial: (command: TextCapabilityCommand) => Promise<string>;
  count: () => number;
} {
  let calls = 0;
  const dial = async (_command: TextCapabilityCommand): Promise<string> => {
    calls++;
    throw new Error(message);
  };
  return { dial, count: () => calls };
}

// ---------------------------------------------------------------------------
// TEXT_CAPABILITY_COMMANDS -- frozen, canonical order.
// ---------------------------------------------------------------------------

test("TEXT_CAPABILITY_COMMANDS is frozen and its five members are in declared order with memmapshow first", () => {
  assert.ok(Object.isFrozen(TEXT_CAPABILITY_COMMANDS));
  assert.deepEqual(TEXT_CAPABILITY_COMMANDS, ["memmapshow", "prof flat", "chis", "bt", "io"]);
});

// ---------------------------------------------------------------------------
// The classifier -- capable path proven against real committed captures.
// ---------------------------------------------------------------------------

test("classifyTextCapabilityResponse: the real access-map-stock capture classifies capable, identity built from its own capturedFrom", () => {
  const fixture = loadTextFixture("access-map-stock");
  assert.equal(fixture.synthetic, false, "access-map-stock must be a real hardware capture");
  const identity = identityFromCapturedFrom(String(fixture.provenance.capturedFrom));
  assert.deepEqual(identity, { backend: "stock", binPath: "/usr/bin/x64sc", resolved: true });

  const classification = classifyTextCapabilityResponse("memmapshow", fixture.text);
  assert.equal(classification.outcome, "capable");
});

test("classifyTextCapabilityResponse: the real cpu-history-stock capture classifies capable, identity built from its own capturedFrom", () => {
  const fixture = loadTextFixture("cpu-history-stock");
  assert.equal(fixture.synthetic, false, "cpu-history-stock must be a real hardware capture");
  const identity = identityFromCapturedFrom(String(fixture.provenance.capturedFrom));
  assert.deepEqual(identity, { backend: "stock", binPath: "/usr/bin/x64sc", resolved: true });

  const classification = classifyTextCapabilityResponse("chis", fixture.text);
  assert.equal(classification.outcome, "capable");
});

test("classifyTextCapabilityResponse: the exact disabled-stub literal classifies missing, with a remedy naming the configure flag", () => {
  const classification = classifyTextCapabilityResponse("chis", CPUHISTORY_DISABLED_STUB);
  assert.equal(classification.outcome, "missing");
  assert.ok(classification.remedy, "expected a remedy string on a missing verdict");
  assert.match(classification.remedy!, /--enable-cpuhistory/);
});

test("classifyTextCapabilityResponse: the stub as the first of several lines still classifies missing", () => {
  const response = `${CPUHISTORY_DISABLED_STUB}\nmore trailing text\n`;
  const classification = classifyTextCapabilityResponse("memmapshow", response);
  assert.equal(classification.outcome, "missing");
});

test("classifyTextCapabilityResponse: a payload whose LATER line contains the stub text classifies capable, not missing", () => {
  const response = `addr: IO  ROM RAM\n0000: --- --- rw-\n${CPUHISTORY_DISABLED_STUB}\n`;
  const classification = classifyTextCapabilityResponse("memmapshow", response);
  assert.equal(classification.outcome, "capable");
});

test("classifyTextCapabilityResponse: an empty reply classifies indeterminate, never capable", () => {
  assert.equal(classifyTextCapabilityResponse("chis", "").outcome, "indeterminate");
  assert.equal(classifyTextCapabilityResponse("chis", "   \n  \n").outcome, "indeterminate");
});

test("classifyTextCapabilityResponse: bt and prof flat never classify missing, even matching the stub literal exactly", () => {
  assert.equal(classifyTextCapabilityResponse("bt", CPUHISTORY_DISABLED_STUB).outcome, "capable");
  assert.equal(classifyTextCapabilityResponse("prof flat", CPUHISTORY_DISABLED_STUB).outcome, "capable");
});

test("classifyTextCapabilityResponse: io never classifies missing, even matching the stub literal exactly", () => {
  assert.equal(classifyTextCapabilityResponse("io", CPUHISTORY_DISABLED_STUB).outcome, "capable");
});

// ---------------------------------------------------------------------------
// textCapabilityCacheKey
// ---------------------------------------------------------------------------

test("textCapabilityCacheKey: returns backend:path for a resolved identity, and refuses (null) an unresolved one", () => {
  const key = textCapabilityCacheKey(STOCK_IDENTITY);
  assert.equal(key, "stock:/usr/bin/x64sc");
  assert.equal(textCapabilityCacheKey(UNRESOLVED_IDENTITY), null);
});

// ---------------------------------------------------------------------------
// Caching: a definitive verdict is cached (one dial across two probes).
// ---------------------------------------------------------------------------

test("probeTextCapability: a capable verdict is cached -- one dial across two sequential probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("addr: IO  ROM RAM\n0000: --- --- rw-\n");
  await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  const second = await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  assert.equal(count(), 1, "expected exactly one dial across two probes of a cacheable outcome");
  assert.equal(second.fromCache, true);
});

test("probeTextCapability: a missing verdict is cached -- one dial across two sequential probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial(CPUHISTORY_DISABLED_STUB);
  await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  const second = await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  assert.equal(count(), 1);
  assert.equal(second.outcome, "missing");
  assert.equal(second.fromCache, true);
});

// ---------------------------------------------------------------------------
// Never-cached cases: two dials across two sequential probes.
// ---------------------------------------------------------------------------

test("probeTextCapability: an indeterminate outcome (empty reply) is NOT cached -- two dials across two probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("");
  const first = await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  const second = await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  assert.equal(first.outcome, "indeterminate");
  assert.equal(second.outcome, "indeterminate");
  assert.equal(count(), 2);
});

test("probeTextCapability: a rejected dial is NOT cached -- two dials across two probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeRejectingDial("ECONNRESET");
  const first = await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  const second = await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  assert.equal(first.outcome, "indeterminate");
  assert.equal(first.dialError, "ECONNRESET");
  assert.equal(second.outcome, "indeterminate");
  assert.equal(count(), 2);
});

test("probeTextCapability: an unkeyable (unresolved) identity is NOT cached -- two dials across two probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("addr: IO  ROM RAM\n0000: --- --- rw-\n");
  await probeTextCapability({ command: "memmapshow", identity: UNRESOLVED_IDENTITY, dial });
  await probeTextCapability({ command: "memmapshow", identity: UNRESOLVED_IDENTITY, dial });
  assert.equal(count(), 2);
});

test("probeTextCapability: a definite identity disagreement is NOT cached and names both observed identities -- two dials across two probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("addr: IO  ROM RAM\n0000: --- --- rw-\n");
  const brokerIdentity = { backend: "fork" as const, binPath: "/usr/local/bin/x64sc" };
  const first = await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, brokerIdentity, dial });
  const second = await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, brokerIdentity, dial });
  assert.equal(count(), 2);
  assert.ok(first.identityDisagreement, "expected an identityDisagreement string");
  assert.match(first.identityDisagreement!, /stock:\/usr\/bin\/x64sc/);
  assert.match(first.identityDisagreement!, /fork:\/usr\/local\/bin\/x64sc/);
  assert.equal(second.identityDisagreement !== undefined, true);
});

test("probeTextCapability: an absent broker record does not block caching -- one dial across two probes", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("addr: IO  ROM RAM\n0000: --- --- rw-\n");
  const brokerIdentity = { backend: null, binPath: "" };
  await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, brokerIdentity, dial });
  const second = await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, brokerIdentity, dial });
  assert.equal(count(), 1);
  assert.equal(second.fromCache, true);
  assert.equal(second.identityDisagreement, undefined);
});

// ---------------------------------------------------------------------------
// Concurrency: two un-awaited probes of the same key+command dial once.
// ---------------------------------------------------------------------------

test("probeTextCapability: two concurrent un-awaited probes of the same key+command dial exactly once", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial("addr: IO  ROM RAM\n0000: --- --- rw-\n");
  const p1 = probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  const p2 = probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(count(), 1, "expected exactly one dial across two concurrent probes");
  assert.equal(r1.outcome, "capable");
  assert.equal(r2.outcome, "capable");
});

// ---------------------------------------------------------------------------
// memmapshow and chis occupy separate cache entries under the same key.
// ---------------------------------------------------------------------------

test("probeTextCapability: memmapshow and chis occupy separate cache entries -- probing one requires its own dial for the other", async () => {
  resetTextCapabilityCache();
  const { dial, count } = makeCountingDial(CPUHISTORY_DISABLED_STUB);
  await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  assert.equal(count(), 1);
  await probeTextCapability({ command: "chis", identity: STOCK_IDENTITY, dial });
  assert.equal(count(), 2, "expected chis to dial fresh even though memmapshow was already cached under the same key");
  // Re-probing memmapshow is still served from cache -- confirms the two
  // entries are genuinely independent, not one overwriting the other.
  const memmapAgain = await probeTextCapability({ command: "memmapshow", identity: STOCK_IDENTITY, dial });
  assert.equal(count(), 2);
  assert.equal(memmapAgain.fromCache, true);
});

// ---------------------------------------------------------------------------
// Ordering: textCapabilityRefusalMessage renders in canonical command order.
// ---------------------------------------------------------------------------

test("textCapabilityRefusalMessage: renders in TEXT_CAPABILITY_COMMANDS order regardless of input array order", () => {
  const base = { identity: STOCK_IDENTITY, fromCache: false, response: "" };
  const btVerdict: TextCapabilityVerdict = { ...base, command: "bt", outcome: "indeterminate" };
  const ioVerdict: TextCapabilityVerdict = { ...base, command: "io", outcome: "indeterminate" };
  const memmapVerdict: TextCapabilityVerdict = { ...base, command: "memmapshow", outcome: "indeterminate" };
  // Scrambled input order: io, bt, memmapshow.
  const message = textCapabilityRefusalMessage([ioVerdict, btVerdict, memmapVerdict]);
  const lines = message.split("\n");
  assert.equal(lines.length, 3);
  assert.match(lines[0]!, /^memmapshow:/);
  assert.match(lines[1]!, /^bt:/);
  assert.match(lines[2]!, /^io:/);
});

// ---------------------------------------------------------------------------
// Source-level: no filesystem write, no reference to the tool-written root.
// ---------------------------------------------------------------------------

test("source-level: text-capability-probe.ts contains no filesystem write call and no reference to the tool-written root", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  for (const forbidden of ["writeFileSync(", "appendFileSync(", "createWriteStream(", ".c64-re-tools"]) {
    assert.equal(src.includes(forbidden), false, `expected text-capability-probe.ts to never contain ${JSON.stringify(forbidden)}`);
  }
});
