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
// Task 2: the user-facing answer's three distinguishable shapes.
// ---------------------------------------------------------------------------

function missingVerdict(command: TextCapabilityCommand, binPath = "/usr/bin/x64sc"): TextCapabilityVerdict {
  const classification = classifyTextCapabilityResponse(command, CPUHISTORY_DISABLED_STUB);
  return {
    command,
    outcome: "missing",
    response: CPUHISTORY_DISABLED_STUB,
    capability: classification.capability,
    remedy: classification.remedy,
    identity: { backend: "stock", binPath, resolved: true },
    fromCache: false,
  };
}

test("textCapabilityRefusalMessage: a single missing verdict's message names the command, the capability, the binary path and the configure flag", () => {
  const message = textCapabilityRefusalMessage([missingVerdict("chis")]);
  assert.match(message, /chis/);
  assert.match(message, /\/usr\/bin\/x64sc/);
  assert.match(message, /--enable-cpuhistory/);
});

test("textCapabilityRefusalMessage: two missing verdicts sharing the stub render exactly ONE remedy sentence naming both commands", () => {
  const message = textCapabilityRefusalMessage([missingVerdict("memmapshow"), missingVerdict("chis")]);
  const lines = message.split("\n");
  assert.equal(lines.length, 1, `expected exactly one merged line, got: ${JSON.stringify(lines)}`);
  assert.match(lines[0]!, /memmapshow/);
  assert.match(lines[0]!, /chis/);
  // Exactly one occurrence of the remedy sentence's distinctive substring.
  const remedyOccurrences = (message.match(/--enable-cpuhistory/g) ?? []).length;
  assert.equal(remedyOccurrences, 1);
});

test("textCapabilityRefusalMessage: a missing verdict and an indeterminate verdict render as separate, distinctly-worded lines", () => {
  const indeterminate: TextCapabilityVerdict = {
    command: "bt",
    outcome: "indeterminate",
    response: "",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const message = textCapabilityRefusalMessage([missingVerdict("chis"), indeterminate]);
  const lines = message.split("\n");
  assert.equal(lines.length, 2);
  assert.notEqual(lines[0], lines[1]);
  assert.match(lines[0]!, /missing/);
  assert.doesNotMatch(lines[0]!, /unknown/);
  assert.match(lines[1]!, /unknown/);
  assert.doesNotMatch(lines[1]!, /missing/);
});

test("textCapabilityRefusalMessage: bt and prof flat render no build-capability claim -- a capable verdict for them produces no line at all", () => {
  const btCapable: TextCapabilityVerdict = {
    command: "bt",
    outcome: "capable",
    response: "some real backtrace output",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const profCapable: TextCapabilityVerdict = {
    command: "prof flat",
    outcome: "capable",
    response: "some real profiler output",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const message = textCapabilityRefusalMessage([btCapable, profCapable]);
  assert.equal(message, "", "expected no rendered line for two fully-capable no-guard verdicts");
});

test("textCapabilityRefusalMessage: the register command's own two degradation strings render as a chip-level degradation, distinct wording from a missing build capability", () => {
  const ioNoDetails: TextCapabilityVerdict = {
    command: "io",
    outcome: "capable",
    response: "No details available.\n",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const ioNoRegs: TextCapabilityVerdict = {
    command: "io",
    outcome: "capable",
    response: "No I/O regs available\n",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const message1 = textCapabilityRefusalMessage([ioNoDetails]);
  assert.match(message1, /io:/);
  assert.match(message1, /No details available/);
  assert.doesNotMatch(message1, /--enable-cpuhistory/);
  // The chip-degradation wording explicitly NEGATES the missing-capability
  // template ("not a missing build capability") rather than reusing it --
  // it must never contain the missing template's own "is missing on" phrase.
  assert.doesNotMatch(message1, /is missing on/);

  const message2 = textCapabilityRefusalMessage([ioNoRegs]);
  assert.match(message2, /No I\/O regs available/);
  assert.doesNotMatch(message2, /--enable-cpuhistory/);
  assert.doesNotMatch(message2, /is missing on/);

  // Distinct wording from the missing-build-capability shape.
  const missingMessage = textCapabilityRefusalMessage([missingVerdict("chis")]);
  assert.notEqual(message1, missingMessage);
});

test("textCapabilityRefusalMessage: io's own genuine register dump (not one of the two degradation strings) renders no line", () => {
  const ioReal: TextCapabilityVerdict = {
    command: "io",
    outcome: "capable",
    response: "VIC-II registers...\nRaster: 100\n",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  assert.equal(textCapabilityRefusalMessage([ioReal]), "");
});

test("textCapabilityRefusalMessage: no rendered message names a phase number (mirrors docs-dangling-refs.test.ts's FLOW-02 pattern)", () => {
  const PHASE_NUMBER_RE = /\bPhase\s+\d/i;
  const indeterminate: TextCapabilityVerdict = {
    command: "bt",
    outcome: "indeterminate",
    response: "",
    identity: STOCK_IDENTITY,
    fromCache: false,
    dialError: "ECONNRESET",
  };
  const ioDegraded: TextCapabilityVerdict = {
    command: "io",
    outcome: "capable",
    response: "No details available.\n",
    identity: STOCK_IDENTITY,
    fromCache: false,
  };
  const message = textCapabilityRefusalMessage([missingVerdict("memmapshow"), missingVerdict("chis"), indeterminate, ioDegraded]);
  assert.doesNotMatch(message, PHASE_NUMBER_RE);
});

test("source-level: text-capability-probe.ts's own module comment marks the stub/degradation strings source-traced, never live-measured", () => {
  const src = readFileSync(OWN_MODULE, "utf8");
  assert.match(src, /SOURCE-TRACED, not live-observed/);
  assert.doesNotMatch(src, /MEASURED/);
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
