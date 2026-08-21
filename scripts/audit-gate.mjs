#!/usr/bin/env node
// scripts/audit-gate.mjs
//
// WHY THIS FILE EXISTS: v0.3.0 closed at commit 4f048bb with its milestone
// audit frontmatter reading `status: passed` while
// `docs-review-disposition.test.ts` was ALREADY RED -- a guard that
// existed, that ran under this repo's own test suite, and that nobody read
// before writing the closing commit. GATE-01 requires that specific failure
// mode be made MECHANICALLY IMPOSSIBLE, not merely documented as a step in
// a checklist: a milestone audit must not be able to declare a gated
// status while any of the four `docs-*.test.ts` guards is red. This file
// is the single check point that answers both halves of that question --
// "is any docs guard red right now?" and "does this text declare a gated
// status?" -- in exactly one place (D-12-01).
//
// WHAT NOT TO DO:
//  - Do not hand-type a second list of guard file names anywhere else in
//    this repo. The guard set below is derived from disk (D-12-07);
//    duplicating it by hand is exactly how a guard can silently drop out of
//    the set this gate protects.
//  - Do not add a waiver file, an environment-variable override, or any
//    other relaxation hatch (D-12-14). There is deliberately no such thing
//    anywhere in this file. Testability comes from the `--root <dir>` CLI
//    flag instead, which points this whole script at a synthetic tree
//    without touching any real behaviour or reading any real environment
//    variable.
//  - Do not make this script reachable from this repo's own top-level
//    package-script entries (see `.claude/mcp/vice/package.json`'s
//    `scripts` block). D-12-11 requires the guard files be invoked
//    directly, as their own file names, never through that broader
//    automated-suite entry point -- doing so would also quietly settle the
//    still-open todo
//    `.planning/todos/pending/2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`,
//    which this phase does not own and must not resolve as a side effect.
//  - Never evaluate, dynamically load, or shell-execute any text this
//    script scans (ASVS V5, threat T-12-03). The only subprocess this file
//    spawns receives an argv array built exclusively from a directory
//    listing filtered by a fixed pattern -- never a shell string, and never
//    anything derived from scanned document content, CLI argv, or stdin.
//
// SCOPE FENCE: this gates only the milestone audit's frontmatter `status:`
// line. It does not gate phase `VERIFICATION.md` files, it is not invoked
// by `/gsd-complete-milestone` itself, and `status: gaps_found` is never
// gated (D-12-13) -- honest bad news must never be obstructed.
//
// Exported surface (all directory-parameterised; no globals, no env reads):
// `docsGuardFiles`, `DOCS_GUARD_FLOOR`, `EXPECTED_DOCS_GUARD_NAMES`,
// `runGuardsLive`, `frontmatterStatus`, `isGatedStatus`,
// `milestoneAuditFiles`, `checkAuditGate`. Plan 12-02 extends this same
// file with a `--hook` mode and MUST NOT rename or re-derive any of the
// above.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const HERE = dirname(fileURLToPath(import.meta.url));

/** The non-vacuity floor for the derived docs-guard set (D-12-08). A glob
 * that silently matches almost nothing must become a structural failure,
 * never a vacuous green -- raise this only if a guard is legitimately
 * retired in the same commit that lowers it. */
export const DOCS_GUARD_FLOOR = 4;

/** The four current docs-*.test.ts guard basenames, frozen. Used only as an
 * exact-membership check against the DERIVED set from `docsGuardFiles()` --
 * never as the set itself. Extend this array (in a commit, alongside the
 * new guard file) the day a fifth guard is added; do not create a second,
 * competing list anywhere else. */
export const EXPECTED_DOCS_GUARD_NAMES = Object.freeze([
  "docs-linerefs.test.ts",
  "docs-dangling-refs.test.ts",
  "docs-deferred-ledger.test.ts",
  "docs-review-disposition.test.ts",
]);

/** Every `docs-*.test.ts` guard basename in `viceDir`, sorted. Derived from
 * a plain, non-recursive `readdirSync` filtered by a fixed pattern (D-12-07)
 * -- never a hand-maintained array. Deliberately non-recursive: every
 * current and anticipated guard lives directly in `.claude/mcp/vice/`, and
 * a recursive walk here would risk picking up an unrelated `docs-*.test.ts`
 * fixture nested under a subdirectory (e.g. a `fixtures/` folder) that was
 * never meant to be a live guard. */
export function docsGuardFiles(viceDir) {
  return readdirSync(viceDir)
    .filter((f) => /^docs-.*\.test\.ts$/.test(f))
    .sort();
}

/** Bounded truncation for captured subprocess text, so a refusal message
 * stays readable instead of dumping an unbounded TAP transcript. */
function truncate(text, max) {
  if (text.length <= max) return text;
  const omitted = text.length - max;
  return `${text.slice(0, max)}\n... [truncated ${omitted} more characters]`;
}

/** Runs the given guard files live, under this same Node binary's own
 * `--test` runner, as a subprocess (D-12-10: guards are re-run live on
 * every invocation, never read from a recorded artifact). The argv is
 * always an array -- `process.execPath` plus `--test` plus the guard
 * basenames themselves -- constructed exclusively from `docsGuardFiles()`'s
 * own return value, never from CLI argv, stdin, or any scanned document
 * text (T-12-03). This deliberately diverges from `test-gate.mjs`'s
 * `stdio: "inherit"` shape: D-12-15's refusal message needs the captured
 * assertion text itself, which inherited stdio does not hand back to the
 * caller at all. */
export function runGuardsLive(viceDir, files) {
  // Strip NODE_TEST_* from the child's environment before spawning. When
  // this gate itself runs from inside a `node --test` process (exactly
  // what audit-integrity.test.ts does, and exactly what a future CI step
  // running the whole suite under `--test` would do), Node sets
  // `NODE_TEST_CONTEXT` in the parent's own process.env; inherited
  // unmodified, the NESTED `node --test` below silently switches its
  // reporter to the parent-child IPC/v8-serialization protocol instead of
  // TAP on stdout, so a genuinely failing guard is reported here as if it
  // had produced no output at all -- exit code 0, empty parsed output --
  // which is precisely the "green when it should be red" failure GATE-01
  // exists to make impossible. Measured directly while building this file,
  // not assumed: see audit-integrity.test.ts's planted-violation test,
  // which reproduces this exact failure mode when the strip below is
  // removed.
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (key.startsWith("NODE_TEST_")) delete env[key];
  }
  const result = spawnSync(process.execPath, ["--test", ...files], {
    cwd: viceDir,
    encoding: "utf8",
    env,
  });
  if (result.error) {
    const stderr = `${result.stderr ?? ""}\n${result.error.message ?? String(result.error)}`.trim();
    return { status: 1, stdout: result.stdout ?? "", stderr };
  }
  return {
    status: result.status ?? 1,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

/** The two statuses D-12-12 requires gated. Deliberately stricter than
 * GATE-01's literal wording, which names only `passed` -- `tech_debt` is
 * gated too because both statuses route to `/gsd-complete-milestone` and
 * both are exactly the kind of claim `4f048bb` got wrong. `gaps_found` and
 * every other value are never gated (D-12-13): a milestone honestly
 * reporting open gaps must never be blocked from saying so. */
const GATED_STATUSES = new Set(["passed", "tech_debt"]);

export function isGatedStatus(value) {
  if (typeof value !== "string") return false;
  return GATED_STATUSES.has(value.trim().toLowerCase());
}

/** Column-zero, frontmatter-only extraction of a `status:` key. Strips a
 * leading BOM and all `\r` first. The first line must be exactly `---`; the
 * scan then looks only between that line and the NEXT exact `---` line for
 * a line matching `/^status:\s*(.*)$/`, and returns its trimmed value with
 * one optional pair of surrounding quotes stripped. Returns `null` when
 * there is no frontmatter block, or no `status:` key inside it.
 *
 * Deliberately NOT a whole-document regex (T-12-04): a real
 * `v0.2.0-MILESTONE-AUDIT.md` carries 9 prose occurrences of the literal
 * text `status:` outside its frontmatter (a `v0.3.0` sibling carries 4),
 * and a scan that is not bounded to the frontmatter block would false-
 * positive on whichever one happens to come first (or last) in the
 * document, rather than reading the one authoritative key. */
export function frontmatterStatus(markdown) {
  if (typeof markdown !== "string") return null;
  let text = markdown.replace(/\r/g, "");
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const lines = text.split("\n");
  if (lines[0] !== "---") return null;

  let endIdx = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === "---") {
      endIdx = i;
      break;
    }
  }
  if (endIdx === -1) return null;

  for (let i = 1; i < endIdx; i++) {
    const m = /^status:\s*(.*)$/.exec(lines[i]);
    if (m) {
      let value = m[1].trim();
      if (
        (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
        (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
      ) {
        value = value.slice(1, -1);
      }
      return value;
    }
  }
  return null;
}

/** Recursive walk of `planningDir`, returning absolute paths whose basename
 * contains `MILESTONE-AUDIT` and ends `.md`, sorted (D-12-02: the live
 * audit-milestone workflow writes `.planning/v{version}-MILESTONE-AUDIT.md`
 * at top level while it is open, and every closed round is archived under
 * `.planning/milestones/`, so a top-level-only scan would miss the archive
 * and a milestone-only scan would miss an in-progress close).
 *
 * Skips any directory whose name starts with `.` and refuses to descend a
 * symlinked directory (T-12-06): `readdirSync(..., { withFileTypes: true })`
 * reports a directory reached only through a symlink as a symbolic-link
 * dirent, not a directory dirent, without ever calling `readlink` or
 * following the link -- checking `isSymbolicLink()` first and skipping is
 * therefore enough to keep the walk from being redirected outside the tree
 * or into an unbounded loop, with no separate `lstatSync` call needed. */
export function milestoneAuditFiles(planningDir) {
  const results = [];

  function walk(dir) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      if (entry.isSymbolicLink()) continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.isFile() && /MILESTONE-AUDIT/.test(entry.name) && entry.name.endsWith(".md")) {
        results.push(full);
      }
    }
  }

  walk(planningDir);
  return results.sort();
}

/** Parses `not ok <n> - <name>` TAP lines out of a guard run's own stdout to
 * name the specific red guard(s), per D-12-15 part (a). When `node --test`
 * is invoked with multiple file arguments, each file surfaces as its own
 * top-level (column-zero) test, so a top-level `not ok` line whose name
 * matches one of the guard basenames identifies exactly which file broke.
 * Falls back to the full guard list when the parse finds nothing, so a
 * refusal is never silently unnamed even if the TAP shape ever changes. */
function parseRedGuardNames(guardResult, guardFiles) {
  const lines = `${guardResult.stdout ?? ""}`.split("\n");
  const found = new Set();
  for (const line of lines) {
    const m = /^not ok \d+ - (.+)$/.exec(line);
    if (m) {
      const candidate = m[1].trim();
      if (guardFiles.includes(candidate)) found.add(candidate);
    }
  }
  if (found.size === 0) {
    for (const line of lines) {
      const m = /^# Subtest: (.+)$/.exec(line);
      if (m && guardFiles.includes(m[1].trim())) found.add(m[1].trim());
    }
  }
  return found.size > 0 ? [...found].sort() : [...guardFiles];
}

/** The single check point (D-12-01). Accumulates structural errors (a
 * derived guard set that fails the floor, or is missing one of the four
 * expected names), discovers every milestone audit under `planningDir` and
 * which of them declare a gated status, and re-runs the derived guard set
 * live (D-12-10) unconditionally -- so `--json` always reports real guard
 * state, not merely "green because nothing needed checking".
 *
 * `allowed` is false whenever there are structural errors, OR the live
 * guard run is red AND at least one discovered audit declares a gated
 * status. A red guard with no gated audit (or a gated audit found while
 * every guard is green) is allowed. */
export function checkAuditGate({ viceDir, planningDir }) {
  const structuralErrors = [];
  const need = (cond, msg) => {
    if (!cond) structuralErrors.push(msg);
  };

  const guardFiles = docsGuardFiles(viceDir);
  need(
    guardFiles.length >= DOCS_GUARD_FLOOR,
    `only ${guardFiles.length} docs-*.test.ts guard(s) found in ${viceDir} (>= ${DOCS_GUARD_FLOOR} required) -- ` +
      "an empty or broken glob must fail loudly here rather than let this gate report green forever"
  );
  for (const name of EXPECTED_DOCS_GUARD_NAMES) {
    need(
      guardFiles.includes(name),
      `expected guard "${name}" is missing from the derived guard set [${guardFiles.join(", ") || "none"}]`
    );
  }

  const auditFiles = milestoneAuditFiles(planningDir);
  const gatedAudits = [];
  for (const file of auditFiles) {
    const status = frontmatterStatus(readFileSync(file, "utf8"));
    if (isGatedStatus(status)) {
      gatedAudits.push({ file, status });
    }
  }

  // Re-run live on every call, unconditionally -- D-12-10. This is what lets
  // `--json` report the true guard state even when there is nothing gated
  // discovered yet, and keeps this the one place that ever spawns a guard.
  const guardResult = runGuardsLive(viceDir, guardFiles);
  const guardsRed = guardResult.status !== 0;
  const redGuards = guardsRed ? parseRedGuardNames(guardResult, guardFiles) : [];

  const allowed = structuralErrors.length === 0 && !(guardsRed && gatedAudits.length > 0);

  let reason = "";
  if (!allowed) {
    if (structuralErrors.length > 0) {
      reason = `Structural failure: ${structuralErrors.join("; ")}`;
    } else {
      const guardNames = redGuards.length > 0 ? redGuards.join(", ") : guardFiles.join(", ");
      const assertionText = truncate(`${guardResult.stdout}\n${guardResult.stderr}`.trim(), 4000);
      const auditNames = gatedAudits.map((a) => `${a.file} (status: ${a.status})`).join("; ");
      reason =
        `(a) red guard(s): ${guardNames} -- while ${gatedAudits.length} milestone audit(s) declare a gated ` +
        `status [${auditNames}]. ` +
        `(b) failing assertion output:\n${assertionText}\n` +
        "(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate " +
        "routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.";
    }
  }

  return { allowed, redGuards, guardOutput: guardResult, gatedAudits, structuralErrors, reason };
}

function parseArgs(argv) {
  let root;
  let json = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json") {
      json = true;
    }
  }
  return { root, json };
}

function main() {
  const { root: rootArg, json } = parseArgs(process.argv.slice(2));
  const root = resolve(rootArg ?? join(HERE, ".."));
  const viceDir = join(root, ".claude", "mcp", "vice");
  const planningDir = join(root, ".planning");

  const result = checkAuditGate({ viceDir, planningDir });

  const guardFiles = docsGuardFiles(viceDir);
  const auditFiles = milestoneAuditFiles(planningDir);
  const statusCounts = {};
  for (const file of auditFiles) {
    const status = frontmatterStatus(readFileSync(file, "utf8"));
    const key = status ?? "null";
    statusCounts[key] = (statusCounts[key] ?? 0) + 1;
  }

  if (json) {
    const payload = {
      allowed: result.allowed,
      redGuards: result.redGuards,
      gatedAudits: result.gatedAudits,
      guardFiles,
      auditFiles,
      statusCounts,
      structuralErrors: result.structuralErrors,
      reason: result.reason,
    };
    console.log(JSON.stringify(payload));
    process.exit(result.allowed ? 0 : 1);
    return;
  }

  if (result.structuralErrors.length > 0) {
    console.error("audit-gate: FAIL");
    for (const e of result.structuralErrors) console.error(`  - ${e}`);
    process.exit(1);
    return;
  }

  if (!result.allowed) {
    console.error("audit-gate: REFUSED");
    console.error(result.reason);
    for (const a of result.gatedAudits) {
      console.error(`  - ${a.file} (status: ${a.status})`);
    }
    process.exit(1);
    return;
  }

  console.log(
    `audit-gate: OK -- ${guardFiles.length} docs guards green, ${auditFiles.length} milestone audits scanned, ` +
      `${result.gatedAudits.length} declaring a gated status`
  );
  process.exit(0);
}

// Only run when invoked directly (`node scripts/audit-gate.mjs`), never when
// imported by a test or by plan 12-02's `--hook` extension of this file.
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
