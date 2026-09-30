// anno-cli-path-consumers.test.ts -- the closed set of caller-supplied path
// arguments of the `anno` CLI.
//
// The confinement predicate is tested in anno-confinement.test.ts, and each
// confined path is tested by the verb's own cli test. This file keeps the
// inventory honest in both directions: every option of `VERB_OPTIONS` is
// either declared a non-path option or named in `CLI_PATH_ARGUMENTS`, and
// every positional in a verb's `--help` synopsis is named there too, so a new
// path-shaped argument cannot be added without a decision here.

import test, { before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { join } from "node:path";

import { VERB_OPTIONS } from "../../src/mcp/vice/anno-cli.ts";
import { VICE_DIR } from "./paths.ts";

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
 * workspace's own project and accepts `--json` and `--run`, a run key. The coverage test below
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
const NON_PATH_OPTIONS: readonly string[] = ["--check", "--force", "--sample", "--json", "--args", "--fixture", "--run"];

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

// ---------------------------------------------------------------------------
// 4. Two positive controls, so the predicate can go red.
// ---------------------------------------------------------------------------

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

