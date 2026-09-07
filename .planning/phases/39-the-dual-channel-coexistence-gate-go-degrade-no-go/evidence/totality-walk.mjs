#!/usr/bin/env node
// -----------------------------------------------------------------------------
// totality-walk.mjs -- Phase 39, plan 39-01, Task 2 (D-04).
//
// WHY THIS FILE EXISTS
// ---------------------
// DECISION-RULE.md's `## Totality` section states the arithmetic -- seven
// inputs with domains of size 3, 4, 4, 3, 3, 3, 3 give 3,888 tuples -- and
// points HERE for the proof rather than tabulating it by hand: Phase 33
// already put 108 tuples at the limit of what a reader can check in prose,
// and 3,888 is roughly 36 times that. Totality is executable, not asserted.
//
// WHAT IT IS THE ONE PLACE FOR
// -----------------------------
// The only place this project enumerates the full cross-product of the seven
// CHAN-01 gate inputs and checks, mechanically, that DECISION-RULE.md's
// fifteen rules are TOTAL (every tuple resolves to exactly one rule) and
// pairwise DISJOINT over R1..R14 (no tuple matches two or more of them). It
// also proves D-08 (`TEXT_SINGLE_CLIENT` gates nothing) mechanically, as
// `TSC_INDEPENDENCE`, and computes `COULD_NOT_RUN_EMITTABLE` from the rule
// set itself rather than accepting it as a promise.
//
// WHAT NOT TO DO
// ---------------
// The RULES array below mirrors DECISION-RULE.md's numbered rule list 1:1,
// in the SAME WRITTEN ORDER. Do not "simplify" it, do not reorder it, and do
// not extend it with a rule the prose does not carry -- a rule added here
// that is not in the prose is a rule the pre-commitment never froze, and a
// rule silently dropped here that IS in the prose un-checks what the freeze
// was for. If DECISION-RULE.md's rule text ever needs to change, it can only
// happen before the first measurement commit lands (see that file's
// `**Status: pre-commitment, frozen.**` paragraph) -- and this file changes
// in the same commit as that edit, never separately.
// -----------------------------------------------------------------------------

"use strict";

// The seven CHAN-01 gate inputs, in DECISION-RULE.md's `## Inputs` row order,
// with their frozen domains (SCHEMA.md section 2).
const DOMAINS = {
  IDLE_COEXIST: ["clean", "corrupts", "not-taken"],
  FOREIGN_HALT_VISIBILITY: ["visible", "invisible", "corrupts", "not-taken"],
  CONCURRENT_INFLIGHT: ["clean", "degraded", "corrupts", "not-taken"],
  CROSS_CHANNEL_RESUME: ["clean", "corrupts", "not-taken"],
  DISCONNECT_RECOVERY: ["recovers", "leaves-halted", "not-taken"],
  HITCOUNT_INVARIANT_HOLDS: ["holds", "breaks", "not-taken"],
  TEXT_SINGLE_CLIENT: ["single", "multi", "not-taken"],
};

const INPUT_ORDER = Object.keys(DOMAINS);

// Mirrors DECISION-RULE.md `## Rules, first match wins` 1:1, in the same
// written order. Each of R3..R14 is conditioned on every input EARLIER in
// this reading order holding its best value -- that conditioning is what
// makes R1..R14 pairwise mutually exclusive (see that file's disjointness
// paragraph), so `matchingRules()` below can assert "exactly one of R1..R14,
// or none of them and then R15" as a checkable property instead of trusting
// first-match-wins to disambiguate an overlap it was never designed to
// disambiguate. R15 carries NO antecedent -- `test` ignores its argument and
// always returns true, which is what the self-check below and the
// `COULD_NOT_RUN_EMITTABLE` computation both rely on mechanically (a rule
// declared with zero formal parameters cannot be reading the tuple).
const RULES = [
  { id: "R1", verdict: "no-go", test: (t) => t.IDLE_COEXIST === "corrupts" },
  { id: "R2", verdict: "no-go", test: (t) => t.IDLE_COEXIST === "not-taken" },
  {
    id: "R3",
    verdict: "degrade",
    test: (t) => t.IDLE_COEXIST === "clean" && t.FOREIGN_HALT_VISIBILITY === "corrupts",
  },
  {
    id: "R4",
    verdict: "degrade",
    test: (t) => t.IDLE_COEXIST === "clean" && t.FOREIGN_HALT_VISIBILITY === "invisible",
  },
  {
    id: "R5",
    verdict: "degrade",
    test: (t) => t.IDLE_COEXIST === "clean" && t.FOREIGN_HALT_VISIBILITY === "not-taken",
  },
  {
    id: "R6",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "corrupts",
  },
  {
    id: "R7",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "degraded",
  },
  {
    id: "R8",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "not-taken",
  },
  {
    id: "R9",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "corrupts",
  },
  {
    id: "R10",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "not-taken",
  },
  {
    id: "R11",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "clean" &&
      t.DISCONNECT_RECOVERY === "leaves-halted",
  },
  {
    id: "R12",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "clean" &&
      t.DISCONNECT_RECOVERY === "not-taken",
  },
  {
    id: "R13",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "clean" &&
      t.DISCONNECT_RECOVERY === "recovers" &&
      t.HITCOUNT_INVARIANT_HOLDS === "breaks",
  },
  {
    id: "R14",
    verdict: "degrade",
    test: (t) =>
      t.IDLE_COEXIST === "clean" &&
      t.FOREIGN_HALT_VISIBILITY === "visible" &&
      t.CONCURRENT_INFLIGHT === "clean" &&
      t.CROSS_CHANNEL_RESUME === "clean" &&
      t.DISCONNECT_RECOVERY === "recovers" &&
      t.HITCOUNT_INVARIANT_HOLDS === "not-taken",
  },
  // No antecedent -- the exhaustive default. This is what makes
  // `could-not-run` structurally unemittable (D-03) rather than merely
  // discouraged: every tuple that reaches this point has already failed
  // every earlier antecedent, and this one always matches.
  { id: "R15", verdict: "go", test: () => true },
];

function crossProduct(domains) {
  const keys = Object.keys(domains);
  let tuples = [{}];
  for (const key of keys) {
    const next = [];
    for (const partial of tuples) {
      for (const value of domains[key]) {
        next.push({ ...partial, [key]: value });
      }
    }
    tuples = next;
  }
  return tuples;
}

// Returns ALL matching rules for a tuple, not just the first -- computing
// every match (rather than stopping at the first) is what makes the strong
// totality property checkable rather than assumed: "exactly one of R1..R14
// matches, or none of them and then R15" cannot be verified by a function
// that only ever reports the first hit.
function matchingRules(tuple) {
  return RULES.filter((r) => r.test(tuple));
}

function tupleLabel(tuple) {
  return INPUT_ORDER.map((k) => `${k}=${tuple[k]}`).join(", ");
}

// -----------------------------------------------------------------------------
// Named self-check regression case (DECISION-RULE.md's disjointness
// paragraph): a tuple carrying BOTH `DISCONNECT_RECOVERY: leaves-halted` AND
// `HITCOUNT_INVARIANT_HOLDS: breaks` is the shortest witness that an
// antecedent written bare, rather than conditioned on the earlier inputs,
// would overlap its siblings -- R11's bare form ("DISCONNECT_RECOVERY:
// leaves-halted") and R13's bare form ("HITCOUNT_INVARIANT_HOLDS: breaks")
// would both fire on this exact tuple if either dropped its leading
// conditioning. With the conditioning in place it must match ONLY R11: R13
// requires DISCONNECT_RECOVERY === "recovers", which this witness does not
// carry, so R13 cannot fire regardless of HITCOUNT_INVARIANT_HOLDS.
// -----------------------------------------------------------------------------
function runSelfCheck() {
  const witness = {
    IDLE_COEXIST: "clean",
    FOREIGN_HALT_VISIBILITY: "visible",
    CONCURRENT_INFLIGHT: "clean",
    CROSS_CHANNEL_RESUME: "clean",
    DISCONNECT_RECOVERY: "leaves-halted",
    HITCOUNT_INVARIANT_HOLDS: "breaks",
    TEXT_SINGLE_CLIENT: "single",
  };
  const matches = matchingRules(witness).filter((r) => r.id !== "R15");
  if (matches.length !== 1 || matches[0].id !== "R11") {
    throw new Error(
      `SELF-CHECK FAILED: disjointness witness (${tupleLabel(witness)}) matched ` +
        `[${matches.map((m) => m.id).join(", ") || "none"}], expected exactly [R11]. ` +
        `An antecedent has been written bare instead of conditioned on the earlier inputs.`,
    );
  }
}

function main() {
  runSelfCheck();

  const tuples = crossProduct(DOMAINS);
  const ruleHits = Object.fromEntries(RULES.map((r) => [r.id, 0]));

  for (const tuple of tuples) {
    const among14 = matchingRules(tuple).filter((r) => r.id !== "R15");
    let fired;
    if (among14.length > 1) {
      throw new Error(
        `TOTALITY VIOLATION: tuple (${tupleLabel(tuple)}) matched more than one of ` +
          `R1..R14: [${among14.map((r) => r.id).join(", ")}]`,
      );
    } else if (among14.length === 1) {
      fired = among14[0];
    } else {
      fired = RULES.find((r) => r.id === "R15");
    }
    ruleHits[fired.id] += 1;
  }

  const totalTuples = tuples.length;
  const hitSum = Object.values(ruleHits).reduce((a, b) => a + b, 0);
  const totalityHolds = hitSum === totalTuples;

  // COULD_NOT_RUN_EMITTABLE: computed, not asserted. `no` iff every declared
  // rule's verdict is a member of {go, degrade, no-go} (never
  // "could-not-run") AND R15 -- the exhaustive default -- carries no
  // antecedent, i.e. its `test` function reads none of the tuple's fields.
  // `Function.prototype.length` is the formal-parameter count; R15's `test`
  // is declared `() => true` with zero formal parameters, which is the
  // mechanical proof that it cannot be consulting the tuple at all.
  const allVerdictsValid = RULES.every((r) => ["go", "degrade", "no-go"].includes(r.verdict));
  const r15 = RULES.find((r) => r.id === "R15");
  const r15HasNoAntecedent = r15.test.length === 0;
  const couldNotRunEmittable = allVerdictsValid && r15HasNoAntecedent ? "no" : "yes";

  // TSC_INDEPENDENCE (D-08, proved mechanically): for every one of the 1,296
  // tuple groups that differ ONLY in TEXT_SINGLE_CLIENT, all three members
  // must fire the SAME rule id.
  const groups = new Map();
  for (const tuple of tuples) {
    const key = INPUT_ORDER.filter((k) => k !== "TEXT_SINGLE_CLIENT")
      .map((k) => `${k}=${tuple[k]}`)
      .join("|");
    const among14 = matchingRules(tuple).filter((r) => r.id !== "R15");
    const firedId = among14.length === 1 ? among14[0].id : "R15";
    if (!groups.has(key)) groups.set(key, new Set());
    groups.get(key).add(firedId);
  }
  let tscIndependenceHolds = true;
  for (const [key, ids] of groups) {
    if (ids.size !== 1) {
      tscIndependenceHolds = false;
      console.error(
        `TSC_INDEPENDENCE VIOLATION: group (${key}) fired rules [${[...ids].join(", ")}] across its three TEXT_SINGLE_CLIENT values`,
      );
    }
  }

  console.log(`TOTAL_TUPLES: ${totalTuples}`);
  for (const r of RULES) {
    console.log(`RULE_HIT_${r.id}: ${ruleHits[r.id]}`);
  }
  console.log(`TOTALITY: ${totalityHolds ? "holds" : "violated"}`);
  console.log(`TSC_INDEPENDENCE: ${tscIndependenceHolds ? "holds" : "violated"}`);
  console.log(`COULD_NOT_RUN_EMITTABLE: ${couldNotRunEmittable}`);
  console.log(`TSC_GROUP_COUNT: ${groups.size}`);

  if (!totalityHolds || !tscIndependenceHolds || couldNotRunEmittable !== "no") {
    process.exitCode = 1;
  }
}

main();
