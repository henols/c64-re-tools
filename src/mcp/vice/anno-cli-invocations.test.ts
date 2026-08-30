// anno-cli-invocations.test.ts -- the non-vacuity / planted-violation proof
// for the INVOCATION guard (REPOINT-01, REPOINT-02, 29-VERIFICATION.md gap 2).
//
// `anno-verb-coverage.test.ts` is this file's counterpart for the VERB
// predicates; this one covers the ARGUMENT predicates, and it exists for the
// reason gap 2 exists at all: the phase's own skill gate resolves NAMES and
// never an invocation's arguments, so two documented commands shipped dead
// while it was green (CR-04's wrong positional, CR-05's unreadable format). A
// guard is only as good as the evidence it was ever awake, and an argument
// guard's specific failure mode is a broken extractor that finds nothing and
// reports a clean tree.
//
// This file imports the SAME module `scripts/check-skill-cli-invocations.mjs`
// imports -- never a second copy of the predicates -- so proving them here
// proves the predicates the CI script runs in production. It calls them in
// ISOLATION rather than importing the CI script, which executes its whole
// check at import time.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseDocumentedInvocations,
  checkInvocation,
  ANNO_INVOCATION_FLOOR,
  POSITIONAL_KINDS,
  REQUIRED_FLAGS,
  PROBLEM_ORDER,
} from "../../../scripts/lib/anno-cli-invocations.mjs";
import { VERB_OPTIONS } from "./anno-cli.ts";

const HERE = dirname(fileURLToPath(import.meta.url)); // <root>/src/mcp/vice
const ROOT = join(HERE, "..", "..", ".."); // <root>
const SKILLS_DIR = join(ROOT, "src", "skills");

// The predicates live in a `.mjs` module deliberately -- they carry no
// first-party TypeScript import and stay callable from a bare CI script -- so
// their shapes come from the colocated `anno-cli-invocations.d.mts`, exactly
// as `anno-cli-verbs.d.mts` serves the sibling proof. These two aliases are
// naming only; the types are the declaration file's.
const parseInvocations = parseDocumentedInvocations;
const checkOne = checkInvocation;

// The two per-verb declaration tables are IMPORTED from the lib above, not
// declared here. Until 2026-08-30 this file kept a private copy of
// `POSITIONAL_KINDS`, because the only other declaration lived in
// `check-skill-cli-invocations.mjs`, which runs the live gate at import time.
// That left the suite proving a FIXTURE while CI ran the shipped map -- an
// edit to one could go green against the other. The tables moved into the
// import-safe lib (WR-01) precisely so these assertions run against the map
// the gate uses. A deliberately-wrong table is still used below, but only
// where a planted control needs one, and each such use says why.

function skillText(...segments: string[]): string {
  return readFileSync(join(SKILLS_DIR, ...segments), "utf8");
}

// ---------------------------------------------------------------------------
// 1. Non-vacuity against the REAL playbooks.
//
// A parser that silently returns nothing must fail here, before any planted
// case can make it look alive.
// ---------------------------------------------------------------------------

test("non-vacuity: the real routine-queue-walker playbook yields at least one `coverage` invocation", () => {
  const parsed = parseInvocations(skillText("routine-queue-walker", "SKILL.md"));
  assert.notEqual(parsed, null, "the playbook has fenced blocks, so a null here means the fence scanner is broken");
  const coverage = parsed!.filter((i) => i.verb === "coverage");
  assert.ok(coverage.length >= 1, `expected at least one documented 'anno coverage' invocation, got ${parsed!.length} invocation(s) in all`);
  // The measurement instruction this skill's whole Phase 5 rests on.
  assert.ok(
    coverage.some((i) => i.positionals.length === 1 && i.flags.some((f) => f.flag === "--store")),
    "the documented coverage invocation must carry one positional and --store",
  );
});

test("non-vacuity: the real c64-program-recon playbook yields at least one `render-memmap` invocation", () => {
  const parsed = parseInvocations(skillText("c64-program-recon", "SKILL.md"));
  assert.notEqual(parsed, null);
  const render = parsed!.filter((i) => i.verb === "render-memmap");
  assert.ok(render.length >= 1, `expected at least one documented 'anno render-memmap' invocation, got ${parsed!.length} invocation(s) in all`);
  assert.ok(
    render.every((i) => i.positionals.length === 1),
    "each documented render-memmap invocation names exactly one positional (the annotation store)",
  );
});

test("non-vacuity: every invocation the real playbooks document passes the checker -- the gate is green over the corrected tree", () => {
  for (const [skill, file] of [
    ["routine-queue-walker", "SKILL.md"],
    ["c64-program-recon", "SKILL.md"],
    ["c64-program-recon", "templates/memory-map.template.md"],
  ] as const) {
    const parsed = parseInvocations(skillText(skill, ...file.split("/")));
    assert.notEqual(parsed, null, `${skill}/${file}: no fenced block found`);
    for (const invocation of parsed!) {
      const problems = checkOne(invocation, VERB_OPTIONS, POSITIONAL_KINDS, REQUIRED_FLAGS);
      assert.deepEqual(problems, [], `${skill}/${file}: ${problems.join("; ")}`);
    }
  }
});

test("the floor is a hand-pinned integer, not a figure derived from the corpus it guards", () => {
  assert.equal(typeof ANNO_INVOCATION_FLOOR, "number");
  assert.ok(Number.isSafeInteger(ANNO_INVOCATION_FLOOR) && ANNO_INVOCATION_FLOOR > 0, "a floor of zero can never fail");
  const source = readFileSync(join(ROOT, "scripts", "lib", "anno-cli-invocations.mjs"), "utf8");
  assert.match(source, /export const ANNO_INVOCATION_FLOOR = \d+;/, "the floor must be a literal in the module's own source");
});

// ---------------------------------------------------------------------------
// 2. The four planted violations -- each a SYNTHETIC text, never an edit to a
//    real skill file. A guard proven only against a tree it already passes has
//    not been proven at all.
// ---------------------------------------------------------------------------

/** Wraps `lines` in a fenced block, so a planted case reaches the extractor by
 * the same route a real playbook does. */
function fenced(...lines: string[]): string {
  return ["Prose above the block.", "", "```bash", ...lines, "```", "", "Prose below."].join("\n");
}

function problemsFor(line: string): string[] {
  const parsed = parseInvocations(fenced(line));
  assert.notEqual(parsed, null);
  assert.equal(parsed!.length, 1, `expected exactly one invocation from ${JSON.stringify(line)}`);
  return checkOne(parsed![0]!, VERB_OPTIONS, POSITIONAL_KINDS, REQUIRED_FLAGS);
}

test("planted violation 1: a flag the verb does not accept is reported by name", () => {
  const problems = problemsFor("npx -y @henols/vice-mcp anno coverage game.prg --store game.annostore --verbose");
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /--verbose/, "the problem must name the offending flag");
  assert.match(problems[0]!, /accepted option set/i);
  // ...and it must name the real set, read from the CLI's own declaration.
  assert.match(problems[0]!, /--store/);
});

test("planted violation 2 (CR-04's exact shape): a positional whose extension is outside the declared kinds is reported by name", () => {
  const problems = problemsFor("npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json");
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /game\.regen2000proj/, "the problem must name the offending positional");
  assert.match(problems[0]!, /\.regen2000proj/);
  assert.match(problems[0]!, /\.annostore/, "and the kinds the verb does read");
});

test("planted violation 3: a verb the CLI does not have is reported by name", () => {
  const problems = problemsFor("node src/mcp/vice/vice-proxy.ts anno export-asm game.annostore --out out.a");
  assert.ok(problems.length >= 1);
  assert.match(problems[0]!, /export-asm/);
  assert.match(problems[0]!, /no such verb/i);
  // The report names the real verb set, so the fix is legible from the failure.
  assert.match(problems[0]!, /coverage/);
  assert.match(problems[0]!, /render-memmap/);
});

test("planted violation 4 (the one that must NOT fire): an invocation in PROSE is never extracted", () => {
  // Byte-for-byte the shape `c64-ram-capture/SKILL.md` really carries: the verb
  // named inline while discussing the sidecar. A gate that fires on prose is
  // one nobody can keep green.
  const prose = "The generated memory map (`vice-mcp anno render-memmap game.regen2000proj`) takes a provenance sidecar.\n";
  assert.equal(parseInvocations(prose), null, "a text with no fence at all is 'nothing to parse', not 'zero invocations'");
  const withFenceElsewhere = ["```bash", "echo hello", "```", "", prose].join("\n");
  const parsed = parseInvocations(withFenceElsewhere);
  assert.deepEqual(parsed, [], "a fenced block carrying no invocation yields zero, and the prose mention is still invisible");
});

test("the prose exclusion holds against the REAL file that motivated it", () => {
  const text = skillText("c64-ram-capture", "SKILL.md");
  assert.ok(text.includes("anno render-memmap"), "precondition: this playbook really does mention the verb in prose");
  const parsed = parseInvocations(text);
  assert.notEqual(parsed, null, "the file has fenced blocks");
  assert.deepEqual(
    parsed!.filter((i) => i.verb === "render-memmap"),
    [],
    "the inline prose mention must not be extracted as an invocation",
  );
});

// ---------------------------------------------------------------------------
// 3. The `null`-versus-empty discipline. Conflating them is how a broken
//    extractor reads as a clean tree.
// ---------------------------------------------------------------------------

test("null versus empty: no fence at all is null; a fence with no invocation is an empty array", () => {
  assert.equal(parseInvocations("Just prose. No code anywhere.\n"), null);
  assert.equal(parseInvocations(""), null);
  assert.deepEqual(parseInvocations(fenced("ls -la")), []);
  assert.deepEqual(parseInvocations(["```", "```"].join("\n")), []);
});

// ---------------------------------------------------------------------------
// 4. The adjacency control. Asserting BOTH halves in one test makes the
//    property under test the DISCRIMINATION rather than the refusal -- a
//    checker that refused everything would satisfy the planted cases above.
// ---------------------------------------------------------------------------

test("adjacency: an invocation differing ONLY in its positional's extension passes on one side and fails on the other", () => {
  const good = "node src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore";
  const bad = "node src/mcp/vice/vice-proxy.ts anno coverage game.proj --store game.annostore";
  assert.deepEqual(problemsFor(good), [], "an accepted extension must pass");
  const problems = problemsFor(bad);
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /game\.proj/);
});

test("adjacency: every extension the coverage loader reads passes, and a near-miss of each fails", () => {
  for (const [ok, near] of [
    [".prg", ".prgx"],
    [".raw", ".rawx"],
    [".bin", ".binx"],
  ] as const) {
    assert.deepEqual(problemsFor(`vice-mcp anno coverage game${ok} --store game.annostore`), [], `${ok} must pass`);
    assert.equal(problemsFor(`vice-mcp anno coverage game${near} --store game.annostore`).length, 1, `${near} must fail`);
  }
});

// ---------------------------------------------------------------------------
// 5. Shape details the two consumers rely on.
// ---------------------------------------------------------------------------

test("the two documented launchers reach the same record -- the parser matches from the subcommand token rightward", () => {
  const npx = problemsFor("npx -y @henols/vice-mcp anno coverage game.prg --store game.annostore");
  const inRepo = problemsFor("node <plugin-root>/src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore");
  assert.deepEqual(npx, []);
  assert.deepEqual(inRepo, []);
  const parsed = parseInvocations(
    fenced(
      "npx -y @henols/vice-mcp anno coverage game.prg --store game.annostore",
      "node <plugin-root>/src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore",
    ),
  );
  assert.equal(parsed!.length, 2);
  assert.deepEqual(parsed![0]!.positionals, parsed![1]!.positionals, "the launcher must not change the extracted arguments");
  assert.deepEqual(parsed![0]!.flags, parsed![1]!.flags);
});

test("a boolean flag at end of line carries no value, and a value-taking flag carries one", () => {
  const parsed = parseInvocations(fenced("vice-mcp anno render-memmap game.annostore --provenance sidecar.json --check"));
  assert.equal(parsed!.length, 1);
  const [invocation] = parsed!;
  assert.deepEqual(invocation!.positionals, ["game.annostore"], "the flag's value must not be counted as a positional");
  assert.deepEqual(invocation!.flags, [
    { flag: "--provenance", value: "sidecar.json" },
    { flag: "--check", value: null },
  ]);
  assert.deepEqual(checkOne(invocation!, VERB_OPTIONS, POSITIONAL_KINDS, REQUIRED_FLAGS), []);
});

test("a synopsis placeholder positional is skipped rather than refused -- usage lines are documentation, not invocations", () => {
  assert.deepEqual(problemsFor("vice-mcp anno coverage <program> --store FILE"), []);
  assert.deepEqual(problemsFor("vice-mcp anno render-memmap <store> --provenance FILE --out FILE"), []);
});

test("the checker reads the CLI's OWN option set, so a flag the CLI accepts is never reported", () => {
  for (const [verb, flags] of Object.entries(VERB_OPTIONS)) {
    const positional = verb === "coverage" ? "game.prg" : "game.annostore";
    const line = `vice-mcp anno ${verb} ${positional} ${flags.map((f) => `${f} x`).join(" ")}`;
    // Every flag is given a value token, which is harmless for the boolean
    // ones here: the point is that no flag in the CLI's own set is refused.
    const problems = problemsFor(line);
    assert.deepEqual(problems, [], `${verb}: ${problems.join("; ")}`);
  }
});

// ---------------------------------------------------------------------------
// 6. WR-01 -- a REQUIRED flag that is OMITTED.
//
// The gate this file proves was built so "a name-only floor cannot see a dead
// command" could not ship again, and then went green for a documented command
// that exits 1: the verifier planted `anno coverage game.prg` (no `--store`) at
// `routine-queue-walker/SKILL.md:241` and got
// `check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) ...`,
// exit 0. Flag MEMBERSHIP and positional EXTENSION were both checked
// thoroughly; flag PRESENCE was not checked at all. A guard proven on the
// wrong axis.
//
// The required-flag table is passed IN like the other two, so these cases can
// hand the predicate a deliberately-wrong table when that is the point.
// ---------------------------------------------------------------------------

/** Like `problemsFor`, but hands the predicate a CALLER-SUPPLIED required-flag
 * table. Used only by the control that proves the check is table-driven rather
 * than hard-coded to the two flags the shipped table happens to name. */
function problemsForWithTable(line: string, requiredFlags: Readonly<Record<string, readonly string[]>>): string[] {
  const parsed = parseInvocations(fenced(line));
  assert.notEqual(parsed, null);
  assert.equal(parsed!.length, 1, `expected exactly one invocation from ${JSON.stringify(line)}`);
  return checkOne(parsed![0]!, VERB_OPTIONS, POSITIONAL_KINDS, requiredFlags);
}

test("WR-01: an omitted REQUIRED flag is reported by name", () => {
  // The verifier's exact plant, verbatim.
  const problems = problemsFor("node src/mcp/vice/vice-proxy.ts anno coverage game.prg");
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /--store/, "the problem must name the omitted flag");
  assert.match(problems[0]!, /required/i);
  // The reader has to be able to act on it: say what actually happens.
  assert.match(problems[0]!, /exits non-zero/i, "the problem must say the command fails at runtime without it");
  assert.match(problems[0]!, /anno coverage game\.prg/, "and quote the line a reader has to go and find");
});

test("WR-01 positive control: the same invocation WITH --store is sound", () => {
  assert.deepEqual(problemsFor("node src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore"), []);
});

test("WR-01: render-memmap's own required flag is checked too, both directions", () => {
  const without = problemsFor("vice-mcp anno render-memmap game.annostore");
  assert.equal(without.length, 1, without.join("; "));
  assert.match(without[0]!, /--provenance/);
  assert.match(without[0]!, /required/i);
  assert.deepEqual(problemsFor("vice-mcp anno render-memmap game.annostore --provenance sidecar.json"), []);
});

test("the required-flag check reads the table it is GIVEN, not a hard-coded pair of flag names", () => {
  // A deliberately-wrong local table: correct here, and only here, because the
  // property under test is that the predicate stays parameterised. If the
  // check were hard-coded to --store/--provenance this would report nothing.
  const wrong = Object.freeze({ coverage: Object.freeze(["--out"]) });
  const problems = problemsForWithTable("vice-mcp anno coverage game.prg --store game.annostore", wrong);
  assert.equal(problems.length, 1, problems.join("; "));
  assert.match(problems[0]!, /--out/, "the caller's table names --out, so --out is what must be reported");
  // ...and the shipped table does NOT require --out, so the same line is sound
  // under the map CI actually runs. Both halves in one test make the property
  // the DISCRIMINATION rather than the refusal.
  assert.deepEqual(problemsFor("vice-mcp anno coverage game.prg --store game.annostore"), []);
});

test("a required flag written in a USAGE synopsis, with a placeholder VALUE, counts as PRESENT", () => {
  // Presence is a property of the flag TOKEN, so `--store FILE` is present by
  // construction and no second placeholder rule is needed beside
  // `isPlaceholder()`. A gate that reds on a synopsis is one nobody keeps green.
  assert.deepEqual(problemsFor("vice-mcp anno coverage <program> --store FILE"), []);
  assert.deepEqual(problemsFor("vice-mcp anno render-memmap <store> --provenance FILE --out FILE"), []);
});

/** Classifies one problem message by the check that produced it. Used only by
 * the ordering assertion, which is about the SEQUENCE rather than the text. */
function problemKind(problem: string): string {
  if (/no such verb/i.test(problem)) return "unknown-verb";
  if (/accepted option set/i.test(problem)) return "flag-membership";
  if (/is not one this verb reads|takes no positional argument/i.test(problem)) return "positional-kind";
  if (/is required/i.test(problem)) return "required-flag";
  return `unclassified: ${problem}`;
}

test("multiple problems are reported in the declared order, stably across runs", () => {
  // One invocation carrying all three non-short-circuiting problems at once:
  // an unaccepted flag, a positional outside the declared kinds, and an
  // omitted required flag.
  const line = "vice-mcp anno render-memmap game.regen2000proj --verbose";
  const first = problemsFor(line);
  assert.equal(first.length, 3, first.join("; "));
  // Asserted against the SHIPPED constant, so a refactor that reorders the
  // control flow without moving PROBLEM_ORDER is caught here.
  assert.deepEqual(
    first.map(problemKind),
    PROBLEM_ORDER.filter((kind) => kind !== "unknown-verb"),
    "the three accumulating checks must report in the declared order",
  );
  const second = problemsFor(line);
  assert.deepEqual(second, first, "two runs over the same input must return identical problem arrays");
});

test("the unknown-verb case SHORT-CIRCUITS: it is reported alone, never alongside the other three", () => {
  // Same line as above but with a verb the CLI does not have, so every
  // verb-keyed table has no entry to read.
  const problems = problemsFor("vice-mcp anno export-asm game.regen2000proj --verbose");
  assert.equal(problems.length, 1, problems.join("; "));
  assert.deepEqual(problems.map(problemKind), [PROBLEM_ORDER[0]]);
});

test("non-vacuity, the other direction: every VERB_OPTIONS verb has a REQUIRED_FLAGS entry, even an empty one", () => {
  // An empty array is a deliberate, readable "this verb requires nothing". An
  // ABSENT key is a verb that joined the gate with its required flags simply
  // undeclared, which is how WR-01's hole would reopen for the next verb.
  for (const verb of Object.keys(VERB_OPTIONS)) {
    assert.ok(
      Object.prototype.hasOwnProperty.call(REQUIRED_FLAGS, verb),
      `${verb} is in the CLI's own VERB_OPTIONS but has no REQUIRED_FLAGS entry -- declare [] if it requires nothing`,
    );
    assert.ok(Array.isArray(REQUIRED_FLAGS[verb as keyof typeof REQUIRED_FLAGS]), `${verb}'s REQUIRED_FLAGS entry must be an array`);
  }
  // ...and every flag named as required must be one the verb actually accepts,
  // or the table would demand a flag the CLI refuses.
  for (const [verb, required] of Object.entries(REQUIRED_FLAGS)) {
    for (const flag of required) {
      assert.ok(VERB_OPTIONS[verb]?.includes(flag), `${verb}: REQUIRED_FLAGS names ${flag}, which is not in that verb's VERB_OPTIONS`);
    }
  }
});

test("one definition, two callers: the CI gate imports the shipped tables instead of declaring its own", () => {
  // The structural half of WR-01. The behavioural tests above are only worth
  // anything if the table they assert against is the table CI runs; a
  // re-introduced local copy in the gate script would restore the drift this
  // move removed, with every test in this file still green.
  const gate = readFileSync(join(ROOT, "scripts", "check-skill-cli-invocations.mjs"), "utf8");
  assert.match(gate, /POSITIONAL_KINDS,?\s/, "precondition: the gate still uses the table");
  assert.doesNotMatch(gate, /const\s+POSITIONAL_KINDS\s*=/, "the gate must not re-declare POSITIONAL_KINDS locally");
  assert.doesNotMatch(gate, /const\s+REQUIRED_FLAGS\s*=/, "the gate must not declare REQUIRED_FLAGS locally");
  assert.match(
    gate,
    /import\s*\{[^}]*REQUIRED_FLAGS[^}]*\}\s*from\s*"\.\/lib\/anno-cli-invocations\.mjs"/s,
    "the gate must import the required-flag table from the lib this file imports it from",
  );
  assert.match(gate, /checkInvocation\(invocation, VERB_OPTIONS, POSITIONAL_KINDS, REQUIRED_FLAGS\)/, "and pass it to the predicate");
});
