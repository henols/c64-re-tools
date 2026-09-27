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
// below is that inventory; nothing else in this tree declares it. Both halves
// of it are now derived from the surface rather than merely asserted: the
// FLAGS from `VERB_OPTIONS` (direction 2), the POSITIONALS from each verb's
// `--help` synopsis line (direction 3b), each in BOTH directions.
//
// WHAT THIS FILE DOES NOT CHECK, NAMED SO A LATER READER CAN CLOSE IT ON
// PURPOSE INSTEAD OF DISCOVERING IT (WR-02). The seam assertion in section 3
// is an aggregate COUNT: it requires at least as many
// `storePathWithinWorkspace(` call sites in `anno-cli.ts` as there are entries
// in `CLI_PATH_ARGUMENTS`. IT DOES NOT ASSOCIATE A PARTICULAR ARGUMENT WITH A
// PARTICULAR CALL SITE, so "nine arguments each confined once" and "eight
// confined with one of them confined twice" are indistinguishable to it. That
// association needs per-argument dataflow through a 1200-line CLI -- a
// static-analysis job, deliberately not taken on in a gap-closure round -- and
// tightening `>=` to `==` would not reach it either, since the same nine sites
// satisfy both readings. Three headers in `anno-cli.ts` used to credit this
// file with that association; they were corrected in the same change that
// added the positional direction, because a header naming a property this file
// does not check is a written warrant for the next maintainer not to check it.
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
//     to provide.
//   - Never widen `NON_PATH_OPTIONS` to silence a failing test. Every widening
//     is a claim that a new option carries no path, and it must be true rather
//     than convenient.
//   - Never count `storePathWithinWorkspace` against RAW file text. This
//     file's own header, and `anno-cli.ts`'s, both name the seam in prose
//     several times over, so an unfiltered count would "pass" by counting the
//     very comments that described the problem. Comment stripping below is
//     mandatory, not hygiene.
import test, { before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { VERB_OPTIONS } from "../../src/mcp/vice/anno-cli.ts";
import { REPO_ROOT, VICE_DIR } from "./paths.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const ANNO_CLI_SOURCE_PATH = join(VICE_DIR, "anno-cli.ts");

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

/** Counts real seam CALL SITES in already-stripped source: direct
 * `storePathWithinWorkspace(` calls plus calls of `anno-cli.ts`'s one
 * wrapper, `confine(`, which confines and prints the verb's refusal. The
 * trailing `(` is what distinguishes a call from the bare import binding,
 * which names the symbol without calling it and must not be counted as a
 * confinement. Each wrapper DEFINITION is subtracted twice -- once for its
 * own `function confine(` spelling and once for the one predicate call in
 * its body -- so a wrapped argument counts once, not twice.
 * `wrapperRoutesThroughSeam()` is what keeps the wrapper honest. */
function seamCallCount(strippedSrc: string): number {
  const direct = strippedSrc.split("storePathWithinWorkspace(").length - 1;
  const wrapped = strippedSrc.split(/\bconfine\(/).length - 1;
  const wrappers = strippedSrc.split("function confine(").length - 1;
  return direct + wrapped - 2 * wrappers;
}

/** True when every `function confine(` in already-stripped source calls
 * `storePathWithinWorkspace(` in its own body -- the one property that lets
 * a `confine(` call count as a seam call at all. */
function wrapperRoutesThroughSeam(strippedSrc: string): boolean {
  const bodies = strippedSrc.split("function confine(").slice(1).map((rest) => rest.slice(0, rest.indexOf("\n}\n")));
  return bodies.every((body) => body.includes("storePathWithinWorkspace("));
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
  { verb: "render-memmap", argument: "--provenance", kind: "flag" },
  { verb: "render-memmap", argument: "--out", kind: "flag" },
  { verb: "coverage", argument: "<image>", kind: "positional" },
  { verb: "coverage", argument: "--out", kind: "flag" },
  { verb: "export-asm", argument: "<image>", kind: "positional" },
  { verb: "export-asm", argument: "--out", kind: "flag" },
  { verb: "export-asm", argument: "--ledger", kind: "flag" },
  { verb: "decomp-completeness", argument: "--disagreements", kind: "flag" },
  { verb: "decomp-completeness", argument: "--manifest", kind: "flag" },
  { verb: "hazard-report", argument: "--image", kind: "flag" },
  { verb: "export-project", argument: "--out", kind: "flag" },
  { verb: "import-project", argument: "<file>", kind: "positional" },
  { verb: "call", argument: "--args-file", kind: "flag" },
];

/**
 * The verbs that take NO path argument at all, kept explicit for the same
 * reason as `NON_PATH_OPTIONS`: `evid-disagreements` answers for the
 * workspace's own project and accepts only `--json`. The coverage test below
 * requires every other verb to appear in the inventory.
 */
const VERBS_WITHOUT_PATH_ARGUMENTS: readonly string[] = ["evid-disagreements"];

/**
 * The options that carry NO path, per verb, kept EXPLICIT and SHORT so that
 * adding to it is a visible decision rather than a quiet one. `--check` and
 * `--force` are booleans; `--sample` takes an integer; `--fixture` takes a
 * fixture NAME that is looked up in `--manifest`, never opened as a file.
 *
 * Assertion 2 subtracts this list from the real `VERB_OPTIONS` and requires
 * everything left over to be named in `CLI_PATH_ARGUMENTS`. That direction is
 * the one that catches the ACTUAL failure mode: a new path-shaped flag added
 * to the CLI without a confinement call reds HERE, BY NAME, instead of being
 * reviewed.
 */
const NON_PATH_OPTIONS: readonly string[] = ["--check", "--force", "--sample", "--json", "--args", "--fixture"];

/**
 * MEASURED, NOT COPIED: nine caller-supplied path arguments across the three
 * verbs at this commit -- the store positional plus `--provenance` and `--out`
 * on `render-memmap`, the image positional plus `--store` and `--out` on
 * `coverage`, and the image positional plus `--store` and `--out` on
 * `export-asm`. Counted by reading all three command functions, not carried
 * over from any planning document.
 *
 * RAISED 6 -> 9 on 2026-08-31, in the commit that landed `export-asm`. Its
 * three path arguments are confined by the same seam in `cmdExportAsm()`, and
 * the raise is what makes that statement falsifiable rather than a claim.
 *
 * RAISED 9 -> 10 by phase 43 plan 43-06, in the commit that landed
 * `evid-disagreements`. Its one path argument (`--store`) is confined by the
 * same seam in `cmdEvidDisagreements()`; the verb has no positional and no
 * `--out`, so it contributes exactly one to this floor rather than three.
 *
 * RAISED 10 -> 13 by phase 45 plan 45-01, in the commit that landed
 * `decomp-completeness`. Its three path arguments (`--store`,
 * `--disagreements`, `--manifest`) are each confined by the same seam in
 * `cmdDecompCompleteness()`; the verb has no positional and no `--out`, so
 * it contributes exactly three to this floor.
 *
 * RAISED 13 -> 14, in the commit that added `export-asm --ledger`. It is
 * confined by the SAME seam, in the SAME `cmdExportAsm()` confinement block
 * as `<image>` and `--store`, so it contributes exactly one to this floor.
 *
 * RAISED 14 -> 16, in the commit that added `hazard-report`. Its two path
 * arguments (`--store`, `--image`) are confined by the same seam in
 * `cmdHazardReport()`; the verb has no positional and no `--out`, so it
 * contributes exactly two to this floor.
 *
 * RAISED 16 -> 17, in the commit that added `call` (D-12, plan 65-02). Its
 * ONE path argument, `--args-file`, is confined by the same seam in
 * `cmdCall()`; the positional (the curated tool NAME) is not a path and
 * carries no confinement call, so `call` contributes exactly one to this
 * floor, not two.
 *
 * LOWERED 17 -> 11 by the broker-owned annotation store, in the commit that
 * removed every store argument: `render-memmap <store>` and `--store` on
 * coverage, export-asm, evid-disagreements, decomp-completeness and
 * hazard-report. The annotations are the workspace's own project, held by
 * the broker, so those six arguments are gone from the surface rather than
 * unconfined -- and the inventory's other direction (every VERB_OPTIONS
 * entry, every synopsis positional) is what proves they are gone.
 *
 * RAISED 11 -> 13 with the backup pair: `export-project --out` and
 * `import-project <file>`, each confined by the same seam.
 *
 * HAND-PINNED AS AN INTEGER LITERAL, AND IT MUST STAY THAT WAY. Deriving it
 * from `CLI_PATH_ARGUMENTS.length` (or from disk) would make it unfailable and
 * would discard the entire non-vacuity it exists to provide: a truncated or
 * accidentally-emptied inventory would then satisfy every assertion below
 * trivially. Raise it when a verb genuinely grows a path argument; never lower
 * it to fit.
 */
const CLI_PATH_ARGUMENT_FLOOR = 13;

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

test("every verb named in CLI_PATH_ARGUMENTS is a real verb, and every real verb is represented", () => {
  const verbsInInventory = new Set(CLI_PATH_ARGUMENTS.map((e) => e.verb));
  const realVerbs = new Set(Object.keys(VERB_OPTIONS));
  assert.deepEqual(
    [...verbsInInventory].sort(),
    [...realVerbs].filter((v) => !VERBS_WITHOUT_PATH_ARGUMENTS.includes(v)).sort(),
    "the inventory must cover exactly the verbs the CLI dispatches -- a verb with no entry has no audited path arguments",
  );
});

test("every verb in VERBS_WITHOUT_PATH_ARGUMENTS is a real verb whose every option is declared non-path", () => {
  for (const verb of VERBS_WITHOUT_PATH_ARGUMENTS) {
    const accepted = VERB_OPTIONS[verb];
    assert.ok(accepted, `VERBS_WITHOUT_PATH_ARGUMENTS names "${verb}", which is not a key of VERB_OPTIONS`);
    for (const option of accepted!) {
      assert.ok(NON_PATH_OPTIONS.includes(option), `${verb} is declared path-free but accepts ${option}, which is not declared non-path`);
    }
  }
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

test("anno-cli.ts's confine() wrapper calls storePathWithinWorkspace() in its own body", () => {
  const stripped = stripComments(readFileSync(ANNO_CLI_SOURCE_PATH, "utf8"));
  assert.ok(stripped.includes("function confine("), "precondition: anno-cli.ts defines the confine() wrapper this scan credits");
  assert.ok(wrapperRoutesThroughSeam(stripped), "a confine( call counts as a seam call only while the wrapper calls the predicate");
});

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
  const rawMentions = seamCallCount(raw);
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
// 3b. THE POSITIONAL HALF OF THE INVENTORY (WR-02).
//
// Direction 2 derives the FLAG half from `VERB_OPTIONS`, so a new path-shaped
// flag joins the audit automatically. The POSITIONALS had no direction at all:
// `<store>` and `<image>` sat in `CLI_PATH_ARGUMENTS` as hand-declarations
// nothing could contradict, so a verb that grew a second positional would have
// joined the CLI without joining the audit -- and a positional RENAMED on the
// surface would have left the inventory auditing a spelling no caller can pass.
//
// THE DECLARATION OF RECORD FOR A POSITIONAL IS THE VERB'S USAGE SYNOPSIS
// LINE, read from `--help` STDOUT rather than scraped from the source literal.
// Same route as `anno-cli.test.ts`'s IN-06 test, and for its reason: `--help`
// is the only channel by which a caller learns what to pass, so a source
// literal that never reached stdout would satisfy a source-scraping check
// while telling the caller nothing. The parsing shape is that test's too --
// locate the verb's line, extract its declared tokens with one regex -- reused
// rather than reinvented, and without importing one test file from another.
//
// BOTH DIRECTIONS, for the same reason section 2 needs both: an uninventoried
// positional is the failure that ships, and a stale inventory entry is the one
// that reads as coverage while auditing nothing.
// ---------------------------------------------------------------------------

const VICE_PROXY_PATH = join(VICE_DIR, "vice-proxy.ts");

/** The shipped `anno --help` text, captured once. Populated in `before()`
 * rather than at module scope so a spawn failure is reported as a test-file
 * setup failure with its stderr rather than an unhandled throw at import. */
let usageText = "";

before(() => {
  // `process.execPath`, never a bare "node" (WR-20). The shipped server has no
  // build step and runs `.ts` through Node's native type-stripping, so it
  // requires Node >= 24; whenever the Node running this suite is not the
  // first `node` on PATH -- an nvm/fnm/volta shell, a CI matrix job, a
  // sudo-elevated run, a Debian box whose /usr/bin/node is 20 -- a bare "node"
  // child either cannot parse the TypeScript or is a different runtime
  // entirely, and the two positional directions below then fail for a reason
  // that has nothing to do with the property under test. PATH resolution also
  // makes the child's identity influenceable in a way `process.execPath` is
  // not. The census-guard test at the end of this file keeps this uniform.
  const result = spawnSync(process.execPath, [VICE_PROXY_PATH, "anno", "--help"], {
    encoding: "utf8" as const,
    env: { ...process.env, VICE_SKIP_RESOURCE_INSTALL: "1", MASTRA_TELEMETRY_DISABLED: "1" },
    timeout: 20_000,
  });
  assert.equal(
    result.status,
    0,
    `\`anno --help\` exited ${result.status} (signal ${result.signal}) -- the positional directions below have no ` +
      `declaration of record without it. stderr: ${result.stderr}`,
  );
  usageText = result.stdout;
});

/**
 * Every positional a verb's USAGE synopsis line declares, in the spelling a
 * caller sees.
 *
 * `<...>`-shaped tokens only, and that is a property of this CLI's own
 * synopsis convention rather than a guess: flag VALUES are spelled `FILE` and
 * `N`, and optional groups are spelled `[--out FILE]`, so an angled token on a
 * synopsis line is a positional and nothing else. An OPTIONAL positional
 * (`[<file>]`) is matched too, which is correct -- optional or not, it is a
 * caller-supplied path argument and belongs in the inventory.
 */
function declaredPositionals(usage: string, verb: string): string[] {
  const escaped = verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const lineMatch = new RegExp(`^ {2}${escaped}\\b.*$`, "m").exec(usage);
  assert.ok(
    lineMatch,
    `expected a USAGE synopsis line for verb "${verb}" -- a verb with no synopsis has no declaration of record for ` +
      "its positionals, so none of them can be audited",
  );
  return lineMatch![0].match(/<[a-zA-Z][a-zA-Z0-9_-]*>/g) ?? [];
}

test("every positional a verb's USAGE synopsis declares is named in CLI_PATH_ARGUMENTS", () => {
  for (const verb of Object.keys(VERB_OPTIONS)) {
    const inventoried = new Set(
      CLI_PATH_ARGUMENTS.filter((e) => e.verb === verb && e.kind === "positional").map((e) => e.argument),
    );
    for (const positional of declaredPositionals(usageText, verb)) {
      assert.ok(
        inventoried.has(positional),
        `${verb}'s USAGE synopsis declares the positional ${positional}, which is not named in CLI_PATH_ARGUMENTS ` +
          `(that verb's inventoried positionals are ${JSON.stringify([...inventoried])}). Add it to the inventory AND ` +
          "add its storePathWithinWorkspace() call in anno-cli.ts. Do NOT rename the synopsis token to match a stale " +
          "inventory entry, and do NOT drop the positional from the synopsis to make this pass -- the synopsis is the " +
          "only route by which a caller learns what to pass.",
      );
    }
  }
});

test("every CLI_PATH_ARGUMENTS positional is declared in some verb's USAGE synopsis -- a stale entry audits nothing while reading as coverage", () => {
  for (const entry of CLI_PATH_ARGUMENTS) {
    if (entry.kind !== "positional") continue;
    const declared = declaredPositionals(usageText, entry.verb);
    assert.ok(
      declared.includes(entry.argument),
      `CLI_PATH_ARGUMENTS names ${entry.verb} ${entry.argument} as a positional, but that verb's USAGE synopsis ` +
        `declares ${JSON.stringify(declared)}. An entry for a positional the shipped surface does not offer audits ` +
        "nothing. Re-point the entry onto the shipped spelling; do NOT delete it to make this pass unless the " +
        "positional itself is genuinely gone.",
    );
  }
});

// ---------------------------------------------------------------------------
// 3c. No verb names a store. The broker owns the annotation database and every
// verb answers for the workspace's own project, so a `--store` flag or a
// store-shaped positional on any verb would be a route back to a client-local
// store file.
// ---------------------------------------------------------------------------

/** Every store-naming argument in a verb surface: an option spelled
 * `--store`, or a synopsis positional spelled `<store>` or `<project>`.
 * The real check and its planted control both call this. */
function storeArguments(verbOptions: Readonly<Record<string, readonly string[]>>, usage: string): string[] {
  const found: string[] = [];
  for (const [verb, options] of Object.entries(verbOptions)) {
    if (options.includes("--store")) found.push(`${verb} --store`);
    for (const positional of declaredPositionals(usage, verb)) {
      if (positional === "<store>" || positional === "<project>") found.push(`${verb} ${positional}`);
    }
  }
  return found;
}

test("no verb accepts --store or declares a store positional -- the annotations are the workspace's own project", () => {
  assert.deepEqual(storeArguments(VERB_OPTIONS, usageText), []);
});

test("planted control: a verb surface that still names a store is reported by the same predicate", () => {
  const plantedUsage = "  render-memmap <store> --out FILE\n  coverage <image> [--out FILE]\n";
  assert.deepEqual(
    storeArguments({ "render-memmap": ["--out"], coverage: ["--store", "--out"] }, plantedUsage),
    ["render-memmap <store>", "coverage --store"],
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
    'import { storePathWithinWorkspace } from "./anno-types.mts";',
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

test("planted violation: a confine() wrapper that never calls the predicate is reported, and credits no call site", () => {
  const hollowWrapper = [
    "function confine(verb: string, raw: string, root: string): string | undefined {",
    "  return raw;",
    "}",
    "export function cmdSomething(out: string, root: string): string | undefined {",
    '  return confine("x", out, root);',
    "}",
    "",
  ].join("\n");
  const realWrapper = hollowWrapper.replace("  return raw;", "  return storePathWithinWorkspace(raw, root);");
  assert.equal(wrapperRoutesThroughSeam(stripComments(hollowWrapper)), false, "a wrapper that does not confine must be reported");
  assert.equal(wrapperRoutesThroughSeam(stripComments(realWrapper)), true, "a wrapper that confines must not be reported");
  assert.equal(seamCallCount(stripComments(realWrapper)), 1, "one wrapped call is one seam call -- the wrapper's own body is not counted again");
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

// ---------------------------------------------------------------------------
// WR-20: the Node child every spawn in this tree starts is `process.execPath`.
//
// A census on 2026-08-30 found 27 sites passing `process.execPath` and exactly
// two passing a bare "node": the `--help` capture in this file (added by plan
// 29-20) and `anno-cli.test.ts`'s `spawnCli()` (pre-existing). Both were fixed
// in one commit, because leaving one behind is what made the other look like a
// precedent.
//
// The guard is a source scan rather than a count, so it names the offending
// file and line instead of reporting a number that moved. It is deliberately
// scoped to the FIRST ARGUMENT of a spawn: a bare "node" appearing as a
// documented invocation inside a string (the skill playbooks' `node
// <plugin-root>/...` route) is not a spawn and must keep passing.
// ---------------------------------------------------------------------------

test("WR-20: no Node child is spawned as a bare \"node\" -- every site passes process.execPath", () => {
  // The package, the server tests, every skill's `scripts/` -- the skill scripts are the
  // other tree that spawns Node children (the host-tool endpoint client) --
  // and every test/skills/<skill>/ folder holding those scripts' tests.
  const skillsDir = join(REPO_ROOT, "skills");
  const skillTestsDir = join(REPO_ROOT, "test", "skills");
  const subdirs = (root: string, leaf: string) =>
    readdirSync(root, { withFileTypes: true })
      .filter((d) => d.isDirectory() && existsSync(join(root, d.name, leaf)))
      .map((d) => join(root, d.name, leaf));
  const roots = [VICE_DIR, HERE, ...subdirs(skillsDir, "scripts"), ...subdirs(skillTestsDir, ".")];
  const offenders: string[] = [];
  let scanned = 0;
  for (const root of roots) {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isFile() || !/\.(ts|mts|mjs)$/.test(entry.name)) continue;
      scanned++;
      const lines = readFileSync(join(root, entry.name), "utf8").split("\n");
      lines.forEach((line, i) => {
        if (/\b(spawnSync|spawn|execFileSync|execFile)\(\s*"node"/.test(line)) {
          offenders.push(`${entry.name}:${i + 1}: ${line.trim()}`);
        }
      });
    }
  }
  // Non-vacuity: a scan that found nothing to read would report zero offenders
  // and look like a clean tree, which is this repo's standing failure mode for
  // a guard.
  assert.ok(scanned >= 40, `precondition: expected to scan at least 40 source files, scanned ${scanned}`);
  assert.deepEqual(
    offenders,
    [],
    "a Node child spawned as a bare \"node\" resolves through PATH, which need not be the Node >= 24 that can " +
      "type-strip this tree's .ts sources:\n  " + offenders.join("\n  "),
  );
});
