// capability-registry.test.ts
//
// AUTOMATED MIRROR: per test-gate.mjs's STANDING RULE (added 2026-08-18),
// every payload shape a manual-only live suite depends on must have a
// mirror assertion in the automated set. plan 08-02 adds end-to-end refusal
// assertions to the manual-only vice-proxy.test.ts; this file is that
// change's automated mirror -- a wording change that would red the manual
// suite reds this one first, with no emulator required.
//
// Nine behaviours, two of which carry the weight: the mechanical
// completeness test (stops the registry rotting relative to the two shipped
// manifests) and the synthetic-tool guard (pins research Pitfall 2 --
// vice_diagnose/vice_recycle are registration artifacts on BOTH backends,
// not a capability gap, so a naive manifest set-difference must not
// misclassify them).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { CAPABILITY_REGISTRY, capabilityEntryFor, capabilityRefusalMessage } from "./capability-registry.ts";
import { DENY_LIST } from "./vice.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

test("fork-only hardware tool on stock names the tool, unrecoverable, the fork route, and the hardware reason", () => {
  const message = capabilityRefusalMessage("vice_sid_get_state", "stock");
  assert.ok(message, "expected a refusal message, got undefined");
  assert.match(message!, /vice_sid_get_state/);
  assert.match(message!, /unrecoverable/);
  assert.match(message!, /VICE_BACKEND=fork/);
  assert.match(message!, /write-only/i);
});

test("fork-only descoped tool on stock names the tool, not implemented, the fork route, and never says unrecoverable", () => {
  const message = capabilityRefusalMessage("vice_memory_fill", "stock");
  assert.ok(message, "expected a refusal message, got undefined");
  assert.match(message!, /not implemented/);
  assert.match(message!, /VICE_BACKEND=fork/);
  assert.doesNotMatch(message!, /unrecoverable/);
});

test("stock-only tool on fork names the stock route", () => {
  const message = capabilityRefusalMessage("vice_execution_until_return", "fork");
  assert.ok(message, "expected a refusal message, got undefined");
  assert.match(message!, /VICE_BACKEND=stock/);
});

test("regression guard: a genuinely unknown tool name yields no refusal at all", () => {
  assert.equal(capabilityRefusalMessage("vice_totally_made_up_xyz", "stock"), undefined);
});

test("synthetic-tool guard: vice_diagnose and vice_recycle are absent from the registry and produce no refusal on either backend", () => {
  const guardMessage =
    "vice_diagnose/vice_recycle are synthetic, proxy-local tools registered on BOTH backends by " +
    "vice-proxy.ts's two buildBackendAwareTool(...resolveAdvertisedToolDefinition(...)) registration " +
    "call sites -- they are not a capability gap, and must never appear in this registry.";
  assert.equal(capabilityEntryFor("vice_diagnose"), undefined, guardMessage);
  assert.equal(capabilityEntryFor("vice_recycle"), undefined, guardMessage);
  assert.equal(capabilityRefusalMessage("vice_diagnose", "stock"), undefined, guardMessage);
  assert.equal(capabilityRefusalMessage("vice_diagnose", "fork"), undefined, guardMessage);
  assert.equal(capabilityRefusalMessage("vice_recycle", "stock"), undefined, guardMessage);
  assert.equal(capabilityRefusalMessage("vice_recycle", "fork"), undefined, guardMessage);
});

test("DENY_LIST boundary: no DENY_LIST entry is duplicated into the capability registry", () => {
  for (const denied of DENY_LIST) {
    assert.equal(
      capabilityEntryFor(denied),
      undefined,
      `${denied} is in DENY_LIST (a bypass hazard, checked first) and must not also appear in ` +
        `CAPABILITY_REGISTRY (a capability-gap hazard) -- these are different hazard shapes owned ` +
        `by different mechanisms.`,
    );
  }
});

test("same-backend miss: every entry's own providedBy backend yields no refusal for that entry", () => {
  for (const entry of CAPABILITY_REGISTRY) {
    assert.equal(
      capabilityRefusalMessage(entry.name, entry.providedBy),
      undefined,
      `${entry.name} already provides on ${entry.providedBy} -- a miss there is a genuine ` +
        `unknown-tool case, not a capability gap.`,
    );
  }
});

test("mechanical completeness: the registry's name set equals the manifest-derived divergence set", () => {
  const forkManifest = JSON.parse(readFileSync(join(HERE, "tools-manifest.json"), "utf8")) as {
    tools: { name: string }[];
  };
  const stockManifest = JSON.parse(readFileSync(join(HERE, "tools-manifest.stock.json"), "utf8")) as {
    tools: { name: string }[];
  };
  const forkNames = new Set(forkManifest.tools.map((t) => t.name));
  const stockNames = new Set(stockManifest.tools.map((t) => t.name));

  const SYNTHETIC = new Set(["vice_diagnose", "vice_recycle"]);
  const excluded = new Set<string>([...DENY_LIST, ...SYNTHETIC]);

  const expected = new Set<string>();
  for (const name of forkNames) {
    if (!stockNames.has(name) && !excluded.has(name)) expected.add(name);
  }
  for (const name of stockNames) {
    if (!forkNames.has(name) && !excluded.has(name)) expected.add(name);
  }

  // Non-vacuity control: a broken manifest read (e.g. an empty tools[]
  // array from a bad JSON.parse) must fail this test loudly rather than
  // pass trivially because both computed sets happened to be empty.
  assert.ok(
    expected.size >= 20,
    `expected at least 20 divergent names from a healthy manifest read, got ${expected.size} -- ` +
      `this usually means a manifest failed to parse, not that the registry shrank.`,
  );

  const actual = new Set(CAPABILITY_REGISTRY.map((e) => e.name));
  assert.deepEqual(
    [...actual].sort(),
    [...expected].sort(),
    "CAPABILITY_REGISTRY has drifted from the two shipped manifests: an unregistered divergence " +
      "means adding an entry to CAPABILITY_REGISTRY; a stale entry means a phase has landed the " +
      "capability on both backends and the entry must be deleted.",
  );

  for (const entry of CAPABILITY_REGISTRY) {
    if (entry.providedBy === "fork") {
      assert.ok(
        forkNames.has(entry.name) && !stockNames.has(entry.name),
        `${entry.name} claims providedBy: "fork" but the manifests disagree`,
      );
    } else {
      assert.ok(
        stockNames.has(entry.name) && !forkNames.has(entry.name),
        `${entry.name} claims providedBy: "stock" but the manifests disagree`,
      );
    }
  }
});

test("vice_sid_get_state's reason and vice_sid_set_state's reason are not equal (Pitfall 3: read vs write are different losses)", () => {
  const getState = capabilityEntryFor("vice_sid_get_state");
  const setState = capabilityEntryFor("vice_sid_set_state");
  assert.ok(getState && setState, "expected both SID entries to exist in the registry");
  assert.notEqual(getState!.reason, setState!.reason);
});
