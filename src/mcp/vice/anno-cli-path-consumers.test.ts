// anno-cli-path-consumers.test.ts -- the CLOSED CONSUMER SET for the `anno`
// CLI's caller-supplied path arguments.
//
// WHY THIS FILE EXISTS. `anno-confinement.test.ts` covers the PREDICATE --
// fifteen thorough tests of `storePathWithinWorkspace()`, including the
// symlink, dangling-link and cycle classes that `28-REVIEW.md` CR-03 found.
// The predicate was never the weak half. Its CONSUMER SET was unenumerated:
// nothing anywhere could fail when a NEW caller-supplied path argument reached
// `readFileSync`/`writeFileSync` without going through it. That asymmetry --
// a proven predicate beside an unenumerated set of callers -- is the exact gap
// two blockers fell through, on a green suite:
//
//   CR-02 (Tampering). `render-memmap --out` and `coverage --out` reached
//   `writeFileSync` as raw caller strings. The phase verifier pointed the
//   first outside the workspace root; it exited 0, printed `wrote
//   /tmp/.../PRECIOUS.md`, and silently replaced that pre-existing file's
//   bytes. `--force` was not in `render-memmap`'s option set at all, so
//   `refuseOverwrite()` -- whose own doc claimed the safety was uniform across
//   every verb that writes an output file -- was never reached from it.
//
//   CR-03 (Information Disclosure). `render-memmap --provenance` reached
//   `readFileSync` as a raw caller string, making it an arbitrary-file read
//   oracle; the sidecar parse failure then interpolated Node's own JSON
//   `SyntaxError`, which quotes a snippet of the input, so the oracle
//   disclosed the target file's opening bytes.
//
// Both are arguments the shipped playbooks tell an agent to COMPOSE IN A BASH
// INVOCATION. That is the designed route, not an abuse of one, which is what
// makes an unconfined argument here a live confinement escape rather than a
// theoretical one.
//
// WHAT THIS FILE IS THE ONE AUTHORITATIVE PLACE FOR: the inventory of
// caller-supplied path arguments the `anno` CLI accepts. `CLI_PATH_ARGUMENTS`
// below is that inventory; nothing else in this tree declares it.
//
// WHY IT IS A NEW FILE rather than more cases in `anno-confinement.test.ts`.
// The same reasoning that file records for its own separation from
// `anno-store.test.ts`: the predicate and its consumer set are different
// subjects, and NOT editing the predicate's file keeps its fifteen pins
// running as an untouched regression rather than as assertions this change
// could have quietly adjusted to suit itself. Conflating the two is precisely
// how CR-02 and CR-03 shipped past a green suite in the first place.
//
// WHAT NOT TO DO, named concretely:
//   - Never add an entry to `CLI_PATH_ARGUMENTS` without adding the
//     corresponding `storePathWithinWorkspace()` call in `anno-cli.ts`. The
//     inventory is a record of what IS confined, never a wish list.
//   - Never derive `CLI_PATH_ARGUMENT_FLOOR` from disk or from
//     `CLI_PATH_ARGUMENTS.length`. A floor computed from the thing it guards
//     can never fail -- `n >= n` is a guard re-pointed at a subject that
//     cannot fail -- and it discards the entire non-vacuity the floor exists
//     to provide. `hostpath-consumers.test.ts` records the same prohibition
//     over `ANNO_MODULE_FLOOR` for the same reason.
//   - Never widen `NON_PATH_OPTIONS` to silence a failing test. Every widening
//     is a claim that a new option carries no path, and it must be true rather
//     than convenient.
//   - Never count `storePathWithinWorkspace` against RAW file text. This
//     file's own header, and `anno-cli.ts`'s, both name the seam in prose
//     several times over, so an unfiltered count would "pass" by counting the
//     very comments that described the problem. Comment stripping below is
//     mandatory, not hygiene.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VERB_OPTIONS } from "./anno-cli.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANNO_CLI_SOURCE_PATH = join(HERE, "anno-cli.ts");

/**
 * Strips `//` line comments and block comments from `src`, leaving every
 * string/template literal's content untouched. A single-pass character
 * scanner, NOT a regex.
 *
 * This mirrors `scripts/lib/anno-cli-verbs.mjs`'s `stripComments()` and its
 * recorded reason rather than inventing a second discipline: this repo's own
 * `docs-dangling-refs.test.ts` measured a regex-alternation extractor silently
 * missing a literal at the exact site a real defect lived. A copy rather than
 * an import because that module lives under `scripts/lib/` (deliberately out
 * of the shipped runtime's `files[]`) and does not export this helper; the
 * alternative -- widening its export surface for a test in another tree -- is
 * a larger change than the twenty lines below.
 */
function stripComments(src: string): string {
  let out = "";
  const n = src.length;
  let i = 0;
  let quote: string | null = null;
  while (i < n) {
    const c = src[i]!;
    if (quote) {
      out += c;
      if (c === "\\") {
        out += src[i + 1] ?? "";
        i += 2;
        continue;
      }
      if (c === quote) quote = null;
      i++;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "/") {
      while (i < n && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && src[i + 1] === "*") {
      i += 2;
      while (i < n && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/** Counts real `storePathWithinWorkspace(` CALL SITES in already-stripped
 * source. The trailing `(` is what distinguishes a call from the bare import
 * binding at the top of `anno-cli.ts`, which names the symbol without calling
 * it and must not be counted as a confinement. */
function seamCallCount(strippedSrc: string): number {
  return strippedSrc.split("storePathWithinWorkspace(").length - 1;
}

/** The ONE predicate. Both the real scan and the planted-violation controls
 * call this same function, so there is exactly one definition of "routes
 * through the seam" -- the 11-01 discipline: a structural test and its own
 * proof must share the checked logic rather than each carry a copy. */
function confinesAtLeast(strippedSrc: string, required: number): boolean {
  return seamCallCount(strippedSrc) >= required;
}

type CliPathArgument = {
  verb: string;
  /** `--flag` for a flag, or the USAGE spelling of the positional. */
  argument: string;
  kind: "positional" | "flag";
};

/**
 * THE INVENTORY: every caller-supplied path argument the `anno` CLI accepts.
 * Hand-declared, because that is the point -- an entry here is a deliberate
 * statement that this argument exists AND is confined. Assertion 2 below is
 * what keeps the hand-declaration honest in the other direction.
 */
const CLI_PATH_ARGUMENTS: readonly CliPathArgument[] = [
  { verb: "render-memmap", argument: "<store>", kind: "positional" },
  { verb: "render-memmap", argument: "--provenance", kind: "flag" },
  { verb: "render-memmap", argument: "--out", kind: "flag" },
  { verb: "coverage", argument: "<project>", kind: "positional" },
  { verb: "coverage", argument: "--store", kind: "flag" },
  { verb: "coverage", argument: "--out", kind: "flag" },
];

/**
 * The options that carry NO path, per verb, kept EXPLICIT and SHORT so that
 * adding to it is a visible decision rather than a quiet one. `--check` and
 * `--force` are booleans; `--sample` takes an integer.
 *
 * Assertion 2 subtracts this list from the real `VERB_OPTIONS` and requires
 * everything left over to be named in `CLI_PATH_ARGUMENTS`. That direction is
 * the one that catches the ACTUAL failure mode: a new path-shaped flag added
 * to the CLI without a confinement call reds HERE, BY NAME, instead of being
 * reviewed.
 */
const NON_PATH_OPTIONS: readonly string[] = ["--check", "--force", "--sample"];

/**
 * MEASURED, NOT COPIED: six caller-supplied path arguments across the two
 * verbs at this commit -- the store positional plus `--provenance` and `--out`
 * on `render-memmap`, and the project positional plus `--store` and `--out` on
 * `coverage`. Counted by reading both command functions, not carried over from
 * any planning document.
 *
 * HAND-PINNED AS AN INTEGER LITERAL, AND IT MUST STAY THAT WAY. Deriving it
 * from `CLI_PATH_ARGUMENTS.length` (or from disk) would make it unfailable and
 * would discard the entire non-vacuity it exists to provide: a truncated or
 * accidentally-emptied inventory would then satisfy every assertion below
 * trivially. Raise it when a verb genuinely grows a path argument; never lower
 * it to fit.
 */
const CLI_PATH_ARGUMENT_FLOOR = 6;

// ---------------------------------------------------------------------------
// 1. The inventory is declared and complete.
// ---------------------------------------------------------------------------

test("every path-shaped FLAG in CLI_PATH_ARGUMENTS is a real accepted option of its verb in VERB_OPTIONS", () => {
  for (const entry of CLI_PATH_ARGUMENTS) {
    if (entry.kind !== "flag") continue;
    const accepted = VERB_OPTIONS[entry.verb];
    assert.ok(accepted, `CLI_PATH_ARGUMENTS names verb "${entry.verb}", which is not a key of VERB_OPTIONS`);
    assert.ok(
      accepted!.includes(entry.argument),
      `CLI_PATH_ARGUMENTS names ${entry.verb} ${entry.argument}, but VERB_OPTIONS accepts only ${JSON.stringify(accepted)} -- ` +
        "an inventory entry for an option the CLI does not have must fail here rather than sit inert",
    );
  }
});

test("every verb named in CLI_PATH_ARGUMENTS is a real verb, and both real verbs are represented", () => {
  const verbsInInventory = new Set(CLI_PATH_ARGUMENTS.map((e) => e.verb));
  const realVerbs = new Set(Object.keys(VERB_OPTIONS));
  assert.deepEqual(
    [...verbsInInventory].sort(),
    [...realVerbs].sort(),
    "the inventory must cover exactly the verbs the CLI dispatches -- a verb with no entry has no audited path arguments",
  );
});

// ---------------------------------------------------------------------------
// 2. The inventory has not gone stale underneath the CLI.
//
// THIS IS THE DIRECTION THAT CATCHES THE REAL FAILURE. Assertion 1 catches an
// inventory entry that outlived its option; this catches an option that
// outran the inventory, which is how CR-02 and CR-03 arrived.
// ---------------------------------------------------------------------------

test("every VERB_OPTIONS entry that is not an explicitly-declared non-path option is named in CLI_PATH_ARGUMENTS", () => {
  for (const [verb, options] of Object.entries(VERB_OPTIONS)) {
    const inventoried = new Set(CLI_PATH_ARGUMENTS.filter((e) => e.verb === verb).map((e) => e.argument));
    for (const option of options) {
      if (NON_PATH_OPTIONS.includes(option)) continue;
      assert.ok(
        inventoried.has(option),
        `${verb} accepts ${option}, which is neither declared non-path (${NON_PATH_OPTIONS.join(", ")}) nor named in ` +
          "CLI_PATH_ARGUMENTS. If it carries a path, add it to the inventory AND add its " +
          "storePathWithinWorkspace() call; if it does not, add it to NON_PATH_OPTIONS deliberately. " +
          "Do NOT widen NON_PATH_OPTIONS merely to make this pass.",
      );
    }
  }
});

test("NON_PATH_OPTIONS names only options that some verb actually accepts -- a stale exclusion is a silent hole", () => {
  const everyRealOption = new Set(Object.values(VERB_OPTIONS).flatMap((options) => [...options]));
  for (const option of NON_PATH_OPTIONS) {
    assert.ok(
      everyRealOption.has(option),
      `NON_PATH_OPTIONS excludes ${option}, which no verb accepts -- an exclusion for a nonexistent option is dead ` +
        "weight that makes the list read as broader coverage than it has",
    );
  }
});

// ---------------------------------------------------------------------------
// 3. Every declared consumer routes through the seam.
// ---------------------------------------------------------------------------

test("anno-cli.ts contains at least one storePathWithinWorkspace() call site per declared path argument", () => {
  const stripped = stripComments(readFileSync(ANNO_CLI_SOURCE_PATH, "utf8"));
  const found = seamCallCount(stripped);
  assert.ok(
    confinesAtLeast(stripped, CLI_PATH_ARGUMENTS.length),
    `anno-cli.ts has ${found} storePathWithinWorkspace( call site(s) in its comment-stripped source but declares ` +
      `${CLI_PATH_ARGUMENTS.length} caller-supplied path argument(s). At least one argument reaches a filesystem call ` +
      "without passing through the ONE confinement seam -- which is exactly the state CR-02 and CR-03 were reported from.",
  );
});

test("the seam count is taken against COMMENT-STRIPPED source -- an unfiltered count would pass by counting prose", () => {
  const raw = readFileSync(ANNO_CLI_SOURCE_PATH, "utf8");
  const stripped = stripComments(raw);
  const rawMentions = raw.split("storePathWithinWorkspace").length - 1;
  const strippedCalls = seamCallCount(stripped);
  // Not an equality: the raw count includes the import binding and every
  // prose mention. The point is that stripping REMOVES mentions, so the guard
  // is measuring code rather than commentary. If these ever converged, the
  // stripper stopped working.
  assert.ok(
    rawMentions > strippedCalls,
    `anno-cli.ts mentions the seam ${rawMentions} time(s) in raw text and calls it ${strippedCalls} time(s) after ` +
      "stripping. Raw mentions must exceed real call sites (the header and both command docs name it in prose, and " +
      "the import names it without calling it) -- if they do not, stripComments() is no longer removing anything and " +
      "the guard above has quietly become a substring search.",
  );
});

// ---------------------------------------------------------------------------
// 4. Two positive controls, so the predicate can go red.
// ---------------------------------------------------------------------------

test("planted violation: a command function that writes a caller-supplied --out with NO seam call is reported by the same predicate the real scan uses", () => {
  // The shape of the defect, minimally: an output path taken from argv and
  // handed straight to writeFileSync. This is what cmdRenderMemmap() looked
  // like before this plan.
  const plantedViolation = [
    'import { writeFileSync } from "node:fs";',
    "export function cmdSomething(out: string, body: string): number {",
    "  writeFileSync(out, body);",
    "  return 0;",
    "}",
    "",
  ].join("\n");

  // The same function, confined. Without this half the control proves only
  // that a tiny file has few call sites.
  const plantedConfined = [
    'import { writeFileSync } from "node:fs";',
    'import { storePathWithinWorkspace } from "./anno-types.ts";',
    "export function cmdSomething(out: string, body: string, root: string): number {",
    "  const outPath = storePathWithinWorkspace(out, root);",
    "  writeFileSync(outPath, body);",
    "  return 0;",
    "}",
    "",
  ].join("\n");

  assert.equal(
    confinesAtLeast(stripComments(plantedViolation), 1),
    false,
    "the predicate must report an unconfined write -- if this passes, the real scan above is not capable of catching a violation",
  );
  assert.equal(
    confinesAtLeast(stripComments(plantedConfined), 1),
    true,
    "the predicate must NOT report a confined write -- a control that only ever refuses is indistinguishable from one that works",
  );
});

test("planted violation: a seam mention that lives ONLY in a comment or a string literal is not counted as a call site", () => {
  // The half that keeps the count trustworthy: proving it did not become a
  // substring search. Both shapes below are real and present in this repo --
  // `anno-cli.ts`'s header names the seam in prose repeatedly, and this very
  // file embeds it in string literals.
  const commentOnly = [
    "// Every caller-supplied path goes through storePathWithinWorkspace() -- the ONE seam.",
    "/* storePathWithinWorkspace(candidate, root) is the shape to copy. */",
    "export function cmdSomething(out: string): number {",
    "  return out.length;",
    "}",
    "",
  ].join("\n");

  assert.equal(
    seamCallCount(stripComments(commentOnly)),
    0,
    "a seam mention inside only a // comment and a block comment must NOT be counted -- otherwise the guard passes by " +
      "counting the very prose that described the problem",
  );
});

test("non-vacuity floor: CLI_PATH_ARGUMENTS has at least CLI_PATH_ARGUMENT_FLOOR entries", () => {
  assert.ok(
    CLI_PATH_ARGUMENTS.length >= CLI_PATH_ARGUMENT_FLOOR,
    `expected >= ${CLI_PATH_ARGUMENT_FLOOR} entries in CLI_PATH_ARGUMENTS, found ${CLI_PATH_ARGUMENTS.length} -- ` +
      "a truncated or accidentally-emptied inventory must fail loudly HERE rather than let every assertion above pass " +
      "trivially. The floor is a hand-pinned literal on purpose; never derive it from CLI_PATH_ARGUMENTS.length.",
  );
});
