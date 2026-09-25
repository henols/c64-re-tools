// service-no-invoke.test.ts -- the structural gate that makes BROKER-05's and
// BROKER-02's "never invoked automatically" promises MECHANICAL rather than
// aspirational (D-15).
//
// WHY THIS FILE EXISTS: plan 62-05 ships two committed service definitions
// (src/mcp/vice/service/vice-broker.service, a systemd USER unit, and
// src/mcp/vice/service/com.henols.vice-broker.plist, a launchd agent) that a
// user installs BY HAND, following the README. Nothing in this repository
// may ever apply either one for them -- that is BROKER-05's whole point, and
// a promise like that decays silently unless something asserts it. This file
// is that assertion, copying the closed-consumer-set idiom
// `tool-location-consumers.test.ts` already established (comment-stripped
// source, a `readdirSync` walk over this
// package's own top-level modules, a closed-set assertion, one named
// predicate shared by the real scan and its own planted-violation proof) --
// over a different token set: subprocess-invocation arguments, not import
// statements or env-var names.
//
// TWO SEPARATE PREDICATES, TWO SEPARATE REQUIREMENTS:
//   - `invokesServiceManager()` (BROKER-05/D-15): no module ANYWHERE in this
//     package's tracked tree -- production or test -- may spawn/exec
//     `systemctl` or `launchctl`. Scanned over EVERY top-level source file,
//     because "no module anywhere" is the literal must_have wording.
//   - `spawnsBrokerArtifact()` (BROKER-02): no PRODUCTION module may spawn
//     the broker artifact (`vice-broker.mjs`) as a child process. Test files
//     are excluded from this one on purpose -- a test that spawns a real
//     broker to exercise it end to end is the suite doing its job, not a
//     client starting one for a user (`broker-e2e.test.ts`,
//     `vice-broker-launch.test.ts` and several `stock-*-live*.test.ts`
//     siblings all do exactly this, and none of them is the violation this
//     predicate exists to catch).
//
// BYTE-SAFE READING, NOT A SHELL TEXT SEARCH -- MANDATORY, NOT A STYLE
// PREFERENCE. Four files under this directory (`anno-memmap-render.ts`,
// `anno-store-export.ts`, `prereq-readme-gen.ts`, `prerequisites.test.ts`)
// carry a literal NUL byte; GNU grep classifies a file containing one as
// binary and silently skips it, which would make this exact gate pass
// vacuously over precisely the files most likely to hide something. Every
// read below goes through `readFileSync(path).toString("utf8")` --
// `anno-memmap-render.test.ts`'s own byte-safe-read idiom, reused rather than
// reinvented -- never a spawned `grep`/`rg`/`ag` subprocess. The last test in
// this file asserts that discipline about its OWN source, not just about the
// production files it scans.
//
// SCOPE: this scan widens the precedent's `.ts`/`.mts`-only extension filter
// to also include top-level `.mjs` files (excluding ambient `.d.mts`
// declaration files, which carry no runtime code). That widening is
// deliberate, not scope creep: `vice-cli.mjs` (plan 62-04, D-03) is this
// package's one hand-authored, never-compiled `.mjs` PRODUCTION entry point
// -- the actual client dispatch surface BROKER-02 is about -- and a scan
// that only ever looked at `.ts`/`.mts` would never see it. Neither scan
// walks into `resources/` (compiled artifacts regenerated FROM the `.mts`
// sources already covered here) or `node_modules/`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { BROKER_START_COMMAND } from "./broker-endpoint.mts";

const HERE = dirname(fileURLToPath(import.meta.url));
const SERVICE_DIR = join(HERE, "service");
const SERVICE_UNIT_PATH = join(SERVICE_DIR, "vice-broker.service");
const LAUNCHD_PLIST_PATH = join(SERVICE_DIR, "com.henols.vice-broker.plist");

/** Strips `//` line comments and `/* ... *\/` block comments, returning the
 * comment-stripped source as ONE newline-joined string. Copied VERBATIM from
 * `tool-location-consumers.test.ts` (the WR-02 fix, 10-REVIEW.md) rather than
 * re-derived -- there is exactly one comment stripper in this tree's test
 * suite, not a second copy that can drift from the first. */
function stripCommentLines(src: string): string {
  const out: string[] = [];
  let inBlock = false;

  function processSegment(text: string): void {
    if (inBlock) {
      const closeIdx = text.indexOf("*/");
      if (closeIdx === -1) return; // still unterminated -- drop the rest of this line
      inBlock = false;
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    const trimmed = text.trim();
    if (trimmed.startsWith("/*")) {
      const openIdx = text.indexOf("/*");
      const closeIdx = text.indexOf("*/", openIdx + 2);
      if (closeIdx === -1) {
        inBlock = true; // unterminated on this line -- resumes on later lines
        return;
      }
      // Opens and closes on the same line (`/* ... */ code();`) -- the
      // remainder after the closing `*/` is still real code/comment text.
      processSegment(text.slice(closeIdx + 2));
      return;
    }
    if (/^\s*\/\//.test(text)) return; // whole-line `//` comment -- dropped
    out.push(text);
  }

  for (const line of src.split("\n")) {
    processSegment(line);
  }
  return out.join("\n");
}

/** Reads `path` as BYTES and decodes to a UTF-8 string -- never a shell
 * text-search subprocess, and never a string-encoded read that could
 * silently mangle the NUL byte four source files in this directory carry.
 * `Buffer#toString("utf8")` decodes a NUL as a normal (if unusual)
 * character and never truncates, exactly the discipline
 * `anno-memmap-render.test.ts` already established for the same reason. */
function readSourceText(path: string): string {
  return readFileSync(path).toString("utf8");
}

/** Every subprocess-spawn function name this predicate treats as a
 * spawn/exec form, synchronous or asynchronous. Ordered longest-prefix-first
 * only for readability -- the `\s*\(` anchor immediately after the matched
 * name already disambiguates `execFile` from `execFileSync` regardless of
 * alternation order, since a partial match that is not immediately followed
 * by `(` fails and the regex engine backtracks to the next alternative. */
const SPAWN_FN_NAMES = ["spawnSync", "execFileSync", "execSync", "spawn", "execFile", "exec"];

/** Returns the balanced-parenthesis argument-list text immediately following
 * each call to one of `fnNames` in `src` -- e.g. for `spawnSync("a", ["b"])`
 * returns `["\"a\", [\"b\"]"]`. A simple depth counter, not a real parser:
 * sufficient for the synthetic and real sources this gate scans, none of
 * which nest a spawn call's own argument list inside a string literal
 * containing an unmatched paren. */
function callArgLists(src: string, fnNames: string[]): string[] {
  const namePattern = fnNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
  const callRe = new RegExp(`\\b(?:${namePattern})\\s*\\(`, "g");
  const results: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = callRe.exec(src)) !== null) {
    const start = match.index + match[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === "(") depth++;
      else if (src[i] === ")") depth--;
      i++;
    }
    results.push(src.slice(start, i - 1));
    callRe.lastIndex = i;
  }
  return results;
}

/** The two service managers D-15's gate forbids invoking. */
const SERVICE_MANAGERS = ["systemctl", "launchctl"];

/** True iff `strippedSrc` (already comment-stripped) contains a call to one
 * of `SPAWN_FN_NAMES` whose argument list names either service manager.
 * Called by BOTH the real tree scan (`serviceManagerInvokers()`) and its own
 * planted-violation proof below, so there is exactly one definition of
 * "invokes a service manager" (the 11-01 discipline: a structural test and
 * its own proof must share the checked logic, not each carry a copy). */
function invokesServiceManager(strippedSrc: string): boolean {
  const argLists = callArgLists(strippedSrc, SPAWN_FN_NAMES);
  return argLists.some((args) => SERVICE_MANAGERS.some((mgr) => args.includes(mgr)));
}

/** The broker artifact's own file name -- the compiled entry `vice-cli.mjs`
 * dynamically `import()`s (never spawns) on the `broker` subcommand. A
 * PRODUCTION module spawning this by name as a child process, rather than
 * letting the user start it and dialling it over TCP, is exactly BROKER-02's
 * violation. */
const BROKER_ARTIFACT_NAME = "vice-broker.mjs";

/** True iff `strippedSrc` contains a call to one of `SPAWN_FN_NAMES` whose
 * argument list names the broker artifact. Called by both the real
 * production-module scan (`brokerSpawners()`) and its own planted-violation
 * proof below -- same one-definition discipline as `invokesServiceManager`
 * above. */
function spawnsBrokerArtifact(strippedSrc: string): boolean {
  const argLists = callArgLists(strippedSrc, SPAWN_FN_NAMES);
  return argLists.some((args) => args.includes(BROKER_ARTIFACT_NAME));
}

/** Every hand-authored source module directly under this package directory:
 * `.ts`, `.mts` and `.mjs` files, excluding ambient `.d.mts`/`.d.ts`
 * declaration files (no runtime code to scan). Does NOT walk into
 * `resources/` (compiled artifacts regenerated from the `.mts` sources this
 * already covers) or `node_modules/`. `dir` is injectable purely so a test
 * could point this at a synthetic directory; every real caller uses the
 * default. */
function topLevelSourceFiles(dir: string = HERE): string[] {
  return readdirSync(dir)
    .filter((name) => /\.(ts|mts|mjs)$/.test(name))
    .filter((name) => !/\.d\.m?ts$/.test(name));
}

/** `topLevelSourceFiles()` narrowed to PRODUCTION modules -- excludes any
 * `*.test.*` file. This is the scope `spawnsBrokerArtifact()`'s real scan
 * uses; `invokesServiceManager()`'s real scan deliberately does NOT narrow
 * this way, because BROKER-05's must_have is "no module anywhere", test
 * files included. */
function topLevelProductionSourceFiles(dir: string = HERE): string[] {
  return topLevelSourceFiles(dir).filter((name) => !/\.test\.[a-zA-Z0-9]+$/.test(name));
}

/** This gate's own file name. Excluded from `serviceManagerInvokers()`'s
 * scan below, and ONLY from that scan -- not from `topLevelSourceFiles()`
 * itself, which stays a true, unfiltered listing. This file's own job is to
 * construct SYNTHETIC violation strings (`spawnSync("systemctl", ...)` as a
 * plain string literal) so `invokesServiceManager()` can be proven to bite;
 * a scan that included this file would match its own planted-violation
 * fixtures and report a false positive against itself, not a real
 * violation. Every OTHER test file in this directory remains in scope, so a
 * genuine violation landing in an unrelated test still trips this gate. */
const SELF_FILENAME = "service-no-invoke.test.ts";

/** The set of top-level modules (production and test alike, this file's own
 * planted-violation fixtures excepted) whose comment-stripped source
 * invokes a service manager. Empty is the only passing shape. */
function serviceManagerInvokers(): string[] {
  const hits: string[] = [];
  for (const name of topLevelSourceFiles()) {
    if (name === SELF_FILENAME) continue;
    const stripped = stripCommentLines(readSourceText(join(HERE, name)));
    if (invokesServiceManager(stripped)) hits.push(name);
  }
  return hits.sort();
}

/** The set of top-level PRODUCTION modules whose comment-stripped source
 * spawns the broker artifact as a child process. Empty is the only passing
 * shape. */
function brokerSpawners(): string[] {
  const hits: string[] = [];
  for (const name of topLevelProductionSourceFiles()) {
    const stripped = stripCommentLines(readSourceText(join(HERE, name)));
    if (spawnsBrokerArtifact(stripped)) hits.push(name);
  }
  return hits.sort();
}

// ---------------------------------------------------------------------------
// The two committed definitions themselves.
// ---------------------------------------------------------------------------

test("both service definitions contain the exported BROKER_START_COMMAND byte-identically", () => {
  for (const path of [SERVICE_UNIT_PATH, LAUNCHD_PLIST_PATH]) {
    const text = readSourceText(path);
    assert.ok(text.includes(BROKER_START_COMMAND), `${path} must contain "${BROKER_START_COMMAND}" byte-for-byte`);
  }
});

/** A path beginning with one of these prefixes is a real, machine-specific
 * filesystem location -- exactly what neither definition may embed. The
 * single named exception, `/usr/bin/env` in the systemd unit's `ExecStart`,
 * is the environment-resolver mechanism the plan requires so the unit needs
 * no absolute INTERPRETER path -- it is universal POSIX plumbing, identical
 * on every machine, not the kind of path this check exists to forbid. */
const SYSTEM_BIN_PATH_RE = /\/(?:usr|bin|sbin|opt|Applications)\/[^\s"'<>]*/;
const ALLOWED_SYSTEM_PATHS = new Set(["/usr/bin/env"]);

function systemBinPathViolations(text: string): string[] {
  const violations: string[] = [];
  for (const line of text.split("\n")) {
    const match = SYSTEM_BIN_PATH_RE.exec(line);
    if (match && !ALLOWED_SYSTEM_PATHS.has(match[0])) {
      violations.push(line);
    }
  }
  return violations;
}

test("neither service definition embeds a machine-specific absolute path outside the env-resolver exception", () => {
  for (const path of [SERVICE_UNIT_PATH, LAUNCHD_PLIST_PATH]) {
    assert.deepEqual(systemBinPathViolations(readSourceText(path)), [], `${path} must embed no system-directory path other than /usr/bin/env`);
  }
});

test("the Linux unit's interpreter-pinning variable is present, and every line naming it is commented out", () => {
  const lines = readSourceText(SERVICE_UNIT_PATH)
    .split("\n")
    .filter((line) => line.includes("VICE_BROKER_NODE"));
  assert.ok(lines.length > 0, "VICE_BROKER_NODE must be named somewhere in the unit file");
  for (const line of lines) {
    assert.ok(line.trimStart().startsWith("#"), `every line naming VICE_BROKER_NODE must be commented out, found: ${line}`);
  }
});

// ---------------------------------------------------------------------------
// invokesServiceManager() -- planted-violation proof, then the clean cases.
// ---------------------------------------------------------------------------

test("invokesServiceManager returns true for a synthetic source invoking systemctl", () => {
  const src = 'const child = spawnSync("systemctl", ["--user", "start", "vice-broker.service"]);';
  assert.equal(invokesServiceManager(src), true);
});

test("invokesServiceManager returns true for a synthetic source invoking launchctl", () => {
  const src = 'execFileSync("launchctl", ["load", plistPath]);';
  assert.equal(invokesServiceManager(src), true);
});

test("invokesServiceManager returns false for a clean synthetic source", () => {
  // Deliberately spawns "npm", not the Node interpreter's own bare command
  // name -- WR-20 (`anno-cli-path-consumers.test.ts`) scans every top-level
  // source file's RAW text for a spawn whose first argument is that bare
  // command name and would report this synthetic fixture as its own
  // offender, a false positive in a completely different gate.
  const src = 'const child = spawnSync("npm", ["--version"]);';
  assert.equal(invokesServiceManager(src), false);
});

test("invokesServiceManager returns false when a service manager name appears only inside a comment", () => {
  // Proves the comment-stripping discipline: this project's own headers
  // routinely name the thing they forbid (this file's own header above does
  // exactly that), and a naive substring check would false-trip on itself.
  const raw = [
    "// This project never calls systemctl or launchctl automatically -- see D-15.",
    "function noop() { return 1; }",
  ].join("\n");
  assert.equal(invokesServiceManager(stripCommentLines(raw)), false);
});

// ---------------------------------------------------------------------------
// spawnsBrokerArtifact() -- planted-violation proof, then the clean case.
// ---------------------------------------------------------------------------

test("spawnsBrokerArtifact returns true for a synthetic source spawning the broker artifact", () => {
  const src = 'spawnSync(process.execPath, ["resources/vice-broker.mjs"]);';
  assert.equal(spawnsBrokerArtifact(src), true);
});

test("spawnsBrokerArtifact returns false for a clean synthetic source", () => {
  const src = 'spawnSync(process.execPath, ["resources/vice-proxy.ts"]);';
  assert.equal(spawnsBrokerArtifact(src), false);
});

// ---------------------------------------------------------------------------
// The real tree scans.
// ---------------------------------------------------------------------------

test("no module anywhere in the tracked tree invokes systemctl or launchctl", () => {
  assert.deepEqual(serviceManagerInvokers(), []);
});

test("no production module spawns the broker artifact", () => {
  assert.deepEqual(brokerSpawners(), []);
});

// ---------------------------------------------------------------------------
// This gate's own byte-safe-read discipline.
// ---------------------------------------------------------------------------

test("this gate's own source never shells out to a text-search tool -- it reads files as bytes instead", () => {
  const stripped = stripCommentLines(readSourceText(join(HERE, "service-no-invoke.test.ts")));
  const calls = callArgLists(stripped, SPAWN_FN_NAMES);
  for (const tool of ["grep", "rg", "ag", "ack", "ripgrep"]) {
    const shelledOut = calls.some((args) => new RegExp(`["'\`]${tool}["'\`]`).test(args));
    assert.equal(shelledOut, false, `must not shell out to ${tool}`);
  }
});
