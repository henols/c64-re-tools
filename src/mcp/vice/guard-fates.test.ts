// src/mcp/vice/guard-fates.test.ts
//
// WHY THIS FILE EXISTS: `scripts/check-guard-fates.mjs` is the check that says
// "every guard that was pinned to the deleted subject has a recorded,
// non-vacuous fate". A check like that is worthless if IT is vacuous -- if
// deleting a row, or adding a row nobody derived, or emptying the registry
// entirely, still comes back green. So this file plants exactly those
// violations and requires the check to report them.
//
// WHAT NOT TO DO: do not re-derive the membership rule here. Every assertion
// below drives the REAL exported predicate. A planted violation proved against
// a re-implementation of the rule proves nothing about the rule that actually
// runs -- which is the discipline the removal gate's own colocated test
// records, and it applies verbatim here.
//
// The inputs are built in-test rather than read from fixtures because
// `checkGuardFates` is PURE: the derived set and the registry are its
// arguments, and "does this path exist" is injected. That keeps this file fast
// enough to run on every commit and keeps it from depending on the real
// registry's completeness, which changes under it as the sweep plans land.
//
// This file is inside the removal gate's scope, so it must carry ZERO
// occurrences of the deleted subject's literal name. The gate is referred to
// by ROLE, never by file name.

import { test } from "node:test";
import assert from "node:assert/strict";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  AUDIT_COMMIT,
  AUDIT_END,
  SET_A_FLOOR,
  SET_B_FLOOR,
  SET_C_FLOOR,
  TOTAL_FLOOR,
  checkGuardFates,
  deriveAuditedSet,
  parseDeferredFateNote,
  resolveSetC,
} from "../../../scripts/check-guard-fates.mjs";
import type {
  AuditedSetMembership,
  GuardFateRegistry,
  GuardFateRow,
} from "../../../scripts/check-guard-fates.mjs";
import { resolveContainedRoot } from "../../../scripts/lib/audit-root.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = resolve(HERE, "..", "..", ".."); // <root>

// ---------------------------------------------------------------------------
// Synthetic inputs. Sized to the real floors so the floor assertions are
// satisfied by construction and each test isolates ONE violation.
// ---------------------------------------------------------------------------

function syntheticPaths(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `src/mcp/vice/${prefix}-${i}.test.ts`);
}

function syntheticDerived(): AuditedSetMembership {
  const setA = syntheticPaths("synthetic-a", SET_A_FLOOR);
  const setB = syntheticPaths("synthetic-b", SET_B_FLOOR);
  const setC = syntheticPaths("synthetic-c", SET_C_FLOOR);
  return { setA, setB, setC, union: [...setA, ...setB, ...setC].sort() };
}

function keptRow(historicalPath: string): GuardFateRow {
  return {
    historicalPath,
    verdict: "kept-unchanged",
    newSubject: historicalPath,
    removalTrigger: "the synthetic subject ceasing to exist",
  };
}

function syntheticRegistry(derived: AuditedSetMembership): GuardFateRegistry {
  return {
    auditCommit: AUDIT_COMMIT,
    auditEnd: AUDIT_END,
    setAFloor: SET_A_FLOOR,
    setBFloor: SET_B_FLOOR,
    setCFloor: SET_C_FLOOR,
    totalFloor: TOTAL_FLOOR,
    derivationNote: "synthetic: two mechanically-derived halves plus the mandated deferred pair",
    rows: derived.union.map(keptRow),
  };
}

/** Every synthetic member "exists"; individual tests narrow this. */
function existsAll(): (relPath: string) => boolean {
  return () => true;
}

function run(derived: AuditedSetMembership, registry: GuardFateRegistry): string[] {
  return checkGuardFates({ derived, registry, exists: existsAll() });
}

// ---------------------------------------------------------------------------
// The baseline: a registry that IS a bijection over the derived set
// ---------------------------------------------------------------------------

test("baseline: a registry whose rows exactly match the derived set reports zero errors", () => {
  const derived = syntheticDerived();
  const errors = run(derived, syntheticRegistry(derived));
  assert.deepEqual(errors, [], `expected no errors, got:\n${errors.join("\n")}`);
  assert.equal(derived.union.length, TOTAL_FLOOR);
});

// ---------------------------------------------------------------------------
// Planted violation 1: a member with no row
// ---------------------------------------------------------------------------

test("planted violation: deleting ONE row makes the real predicate name the orphaned member", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const removed = registry.rows[12]!.historicalPath;
  registry.rows = registry.rows.filter((r) => r.historicalPath !== removed);

  const errors = run(derived, registry);
  assert.ok(errors.length > 0, "a member with no row must be reported");
  assert.ok(
    errors.some((e) => e.includes(removed) && e.includes("no recorded fate")),
    `expected an error naming ${removed}, got:\n${errors.join("\n")}`,
  );

  // Self-non-vacuity: a predicate stubbed to always return [] must NOT agree
  // with the real one here. This is the assertion that catches a future
  // refactor that turns the real check into a no-op.
  const stubbedAlwaysEmpty = (): string[] => [];
  assert.notDeepEqual(stubbedAlwaysEmpty(), errors);
});

// ---------------------------------------------------------------------------
// Planted violation 2: a row nobody derived (the inverse direction)
// ---------------------------------------------------------------------------

test("planted violation: a row whose historicalPath is not in the derived set is named", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const stranger = "src/mcp/vice/nobody-derived-this.test.ts";
  registry.rows.push(keptRow(stranger));

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes(stranger) && e.includes("stranger row")),
    `expected an error naming the stranger row ${stranger}, got:\n${errors.join("\n")}`,
  );
});

// ---------------------------------------------------------------------------
// Planted violation 3: duplicates, in both keys
// ---------------------------------------------------------------------------

test("planted violation: two rows sharing a historicalPath are reported as a duplicate", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const duplicated = registry.rows[3]!.historicalPath;
  registry.rows.push(keptRow(duplicated));

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes("duplicate row") && e.includes(duplicated)),
    `expected a duplicate-row error naming ${duplicated}, got:\n${errors.join("\n")}`,
  );
});

test("planted violation: two rows sharing a non-null newSubject are reported as a duplicate", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const shared = "src/mcp/vice/shared-successor.test.ts";
  registry.rows[0] = {
    historicalPath: registry.rows[0]!.historicalPath,
    verdict: "re-pointed",
    newSubject: shared,
    removalTrigger: "trigger",
    observedRed: {
      command: "node --test shared-successor.test.ts",
      exitStatus: 1,
      excerpt: "not ok 1",
      control: { exitStatus: 0 },
    },
  };
  registry.rows[1] = {
    historicalPath: registry.rows[1]!.historicalPath,
    verdict: "re-pointed",
    newSubject: shared,
    removalTrigger: "trigger",
    observedRed: {
      command: "node --test shared-successor.test.ts",
      exitStatus: 1,
      excerpt: "not ok 1",
      control: { exitStatus: 0 },
    },
  };

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes("duplicate newSubject") && e.includes(shared)),
    `expected a duplicate-newSubject error naming ${shared}, got:\n${errors.join("\n")}`,
  );
});

// ---------------------------------------------------------------------------
// Planted violation 4: structural emptiness, both directions
// ---------------------------------------------------------------------------

test("planted violation: an empty registry against a non-empty derived set is never zero errors", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  registry.rows = [];

  const errors = run(derived, registry);
  assert.ok(errors.length > 0, "an empty registry must never report zero errors");
  assert.ok(
    errors.some((e) => e.includes("structural") && e.includes("ZERO rows")),
    `expected a structural emptiness error, got:\n${errors.join("\n")}`,
  );
});

test("planted violation: an empty derived set is a floor failure, never a vacuous green", () => {
  const empty: AuditedSetMembership = { setA: [], setB: [], setC: [], union: [] };
  const registry = syntheticRegistry(syntheticDerived());

  const errors = run(empty, registry);
  assert.ok(errors.length > 0, "an empty derived set must never report zero errors");
  assert.ok(
    errors.some((e) => e.includes("structural") && e.includes("EMPTY")),
    `expected a structural emptiness error, got:\n${errors.join("\n")}`,
  );
  assert.ok(
    errors.some((e) => e.includes("floor: set A")),
    `expected a set-A floor error, got:\n${errors.join("\n")}`,
  );
});

// ---------------------------------------------------------------------------
// Planted violation 5: the per-verdict evidence rules
// ---------------------------------------------------------------------------

test("planted violation: a re-pointed row whose observedRed.exitStatus is 0 is not an observed red", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const target = registry.rows[5]!.historicalPath;
  registry.rows[5] = {
    historicalPath: target,
    verdict: "re-pointed",
    newSubject: "src/mcp/vice/synthetic-successor.test.ts",
    removalTrigger: "trigger",
    observedRed: {
      command: "node --test synthetic-successor.test.ts",
      exitStatus: 0,
      excerpt: "ok 1",
      control: { exitStatus: 0 },
    },
  };

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes(target) && e.includes("exitStatus")),
    `expected a zero-exit-status error naming ${target}, got:\n${errors.join("\n")}`,
  );
});

test("planted violation: a re-pointed row with no GREEN control is refused", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const target = registry.rows[6]!.historicalPath;
  registry.rows[6] = {
    historicalPath: target,
    verdict: "re-pointed",
    newSubject: "src/mcp/vice/synthetic-successor.test.ts",
    removalTrigger: "trigger",
    observedRed: {
      command: "node --test synthetic-successor.test.ts",
      exitStatus: 1,
      excerpt: "not ok 1",
      control: { exitStatus: 1 },
    },
  };

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes(target) && e.includes("control")),
    `expected a missing-green-control error naming ${target}, got:\n${errors.join("\n")}`,
  );
});

test("planted violation: a kept-unchanged row with no removalTrigger is refused", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const target = registry.rows[7]!.historicalPath;
  registry.rows[7] = { historicalPath: target, verdict: "kept-unchanged", newSubject: target };

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes(target) && e.includes("removalTrigger")),
    `expected a missing-removalTrigger error naming ${target}, got:\n${errors.join("\n")}`,
  );
});

test("planted violation: an unrecognised verdict owes nothing, so it is a structural failure", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const target = registry.rows[8]!.historicalPath;
  registry.rows[8] = {
    historicalPath: target,
    verdict: "probably-fine",
    newSubject: target,
    removalTrigger: "trigger",
  };

  const errors = run(derived, registry);
  assert.ok(
    errors.some((e) => e.includes(target) && e.includes("verdict")),
    `expected an unrecognised-verdict error naming ${target}, got:\n${errors.join("\n")}`,
  );
});

test("the injected `exists` is load-bearing: a deleted row whose path still exists is refused", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const target = registry.rows[9]!.historicalPath;
  registry.rows[9] = {
    historicalPath: target,
    verdict: "deleted",
    newSubject: null,
    removingCommit: "deadbee",
  };

  // `exists` reports the historical path as still on the tree.
  const errors = checkGuardFates({ derived, registry, exists: (p) => p === target });
  assert.ok(
    errors.some((e) => e.includes(target) && e.includes("still on the working tree")),
    `expected a still-present error naming ${target}, got:\n${errors.join("\n")}`,
  );

  // And with `exists` reporting it gone, the same row is accepted.
  const clean = checkGuardFates({ derived, registry, exists: (p) => p !== target });
  assert.ok(
    !clean.some((e) => e.includes(target)),
    `a deleted row whose path is genuinely gone must be accepted, got:\n${clean.join("\n")}`,
  );
});

test("omitting `exists` is refused rather than defaulting to a permissive stub", () => {
  const derived = syntheticDerived();
  const registry = syntheticRegistry(derived);
  const errors = checkGuardFates({ derived, registry } as never);
  assert.ok(
    errors.some((e) => e.includes("`exists`")),
    `expected a missing-injection error, got:\n${errors.join("\n")}`,
  );
});

// ---------------------------------------------------------------------------
// Set C: the mandating document is the authority, and a reworded note is LOUD
// ---------------------------------------------------------------------------

const NOTE_WITH_NO_PATHS = [
  "### Phase 32: The Deletion and the Grep Gate",
  "",
  "- **Two guard fates were DEFERRED to this phase rather than discharged earlier.** Both hinge",
  "  on the same subject, so they are one decision taken twice, not two:",
  "  1. **The transitional block-type arm survives its own removal trigger.**",
  "  2. **The fixture generator kept its generator and FROZE its writer.**",
  "- Another, unrelated top-level bullet that closes the note.",
  "",
  "## Sequencing Rationale",
].join("\n");

test("set C: a note that parses to zero deferred paths makes deriveAuditedSet fail loudly, naming the note", () => {
  assert.throws(
    () => deriveAuditedSet({ root: ROOT, roadmapText: NOTE_WITH_NO_PATHS }),
    (err: unknown) => {
      const message = (err as Error).message;
      assert.match(message, /set C/);
      assert.match(message, /0 source-file token\(s\)/);
      assert.match(message, /Two guard fates were DEFERRED/);
      return true;
    },
  );
});

test("set C: a note whose marker sentence is gone is a hard failure, not an empty set C", () => {
  const noMarker = NOTE_WITH_NO_PATHS.replace("Two guard fates were DEFERRED", "Some fates moved");
  assert.throws(
    () => resolveSetC({ roadmapText: noMarker, trackedPaths: [] }),
    /no note beginning/,
  );
});

test("set C: an ambiguous token is refused rather than resolved to the first match", () => {
  const note = NOTE_WITH_NO_PATHS.replace(
    "  1. **The transitional block-type arm survives its own removal trigger.**",
    "  1. **`ambiguous.ts` survives its own removal trigger.**",
  ).replace(
    "  2. **The fixture generator kept its generator and FROZE its writer.**",
    "  2. **`src/mcp/vice/fixtures/coverage/only-one.mjs` kept its generator.**",
  );
  assert.throws(
    () =>
      resolveSetC({
        roadmapText: note,
        trackedPaths: [
          "src/a/ambiguous.ts",
          "src/b/ambiguous.ts",
          "src/mcp/vice/fixtures/coverage/only-one.mjs",
        ],
      }),
    /resolved to 2 tracked path\(s\)/,
  );
});

test("set C: the real note parses to exactly the floor, each token resolving to one tracked path", () => {
  const { setC, setCTokens } = deriveAuditedSet({ root: ROOT });
  assert.equal(setCTokens.length, SET_C_FLOOR);
  assert.equal(setC.length, SET_C_FLOOR);
});

// ---------------------------------------------------------------------------
// The --root containment boundary
// ---------------------------------------------------------------------------

test("resolveContainedRoot accepts the root itself and a descendant of it", () => {
  assert.equal(resolveContainedRoot(undefined, { repoRoot: ROOT }), ROOT);
  assert.equal(resolveContainedRoot("scripts/lib", { repoRoot: ROOT }), `${ROOT}/scripts/lib`);
});

test("resolveContainedRoot refuses a SIBLING whose name merely shares the root's prefix", () => {
  // The boundary is segment-wise, not a bare string prefix: `<root>-evil`
  // starts with `<root>` and must still be refused.
  assert.throws(
    () => resolveContainedRoot(`${ROOT}-evil`, { repoRoot: ROOT }),
    (err: unknown) => {
      const message = (err as Error).message;
      assert.match(message, /OUTSIDE the repository root/);
      assert.ok(message.includes(`${ROOT}-evil`), "the refusal must name the offending path");
      assert.ok(message.includes(ROOT), "the refusal must name the containing root");
      return true;
    },
  );
});

test("resolveContainedRoot refuses a traversal out of the root and honours allowExtra", () => {
  assert.throws(() => resolveContainedRoot("../..", { repoRoot: ROOT }), /OUTSIDE/);
  const escaped = resolve(ROOT, "..");
  assert.equal(resolveContainedRoot("..", { repoRoot: ROOT, allowExtra: [escaped] }), escaped);
});

// ---------------------------------------------------------------------------
// The note parser's own boundaries
// ---------------------------------------------------------------------------

test("parseDeferredFateNote stops at the next top-level bullet, not at the end of the section", () => {
  const { note } = parseDeferredFateNote(NOTE_WITH_NO_PATHS);
  assert.match(note, /Two guard fates were DEFERRED/);
  assert.ok(
    !note.includes("unrelated top-level bullet"),
    "the note must end at the next top-level bullet, or it would absorb unrelated backticked tokens",
  );
});
