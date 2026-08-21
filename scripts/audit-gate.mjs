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
// HOOK MODE (plan 12-02, D-12-03): `--hook` reads a Claude Code `PreToolUse`
// payload on stdin (`{ tool_name, tool_input }`) and refuses an in-scope
// gated write with `exit 2` plus the reason on stderr -- never the `exit 2`
// + JSON `permissionDecision` combination, which is unreliable on current
// Claude Code (anthropics/claude-code#43407; see the output-contract comment
// near `hookMain()`). Scope is fail-OPEN: a call whose `tool_name` is not
// one of Write/Edit/MultiEdit/NotebookEdit/Bash, or that names no
// `*MILESTONE-AUDIT*.md` target, exits 0 before any `spawnSync` -- a bug in
// this file must not be able to brick unrelated Write/Edit/Bash calls
// repo-wide. Once a call IS in scope, every subsequent internal failure
// (malformed JSON, an unrecognised `tool_input` shape, a truncated stdin
// read, a guard-spawn failure) exits 2 rather than 0 -- fail-CLOSED, exactly
// once scope is established, per D-12-14's "no hatch" premise. Target
// extraction (`extractHookTarget`/`isHookInScope`) is field-name-agnostic by
// construction (Route C in `12-RESEARCH.md`'s Assumptions Log): it is not
// betting on any single `tool_input` field name staying stable, and a
// payload shape this file does not recognise still refuses loudly, naming
// the unrecognised keys, rather than silently passing (T-12-08).
//
// Exported surface (all directory-parameterised; no globals, no env reads):
// `docsGuardFiles`, `DOCS_GUARD_FLOOR`, `EXPECTED_DOCS_GUARD_NAMES`,
// `runGuardsLive`, `frontmatterStatus`, `isGatedStatus`,
// `milestoneAuditFiles`, `checkAuditGate`, plus hook-mode's
// `writtenDeclaresGatedStatus`, `extractHookTarget`, `isHookInScope`. Plan
// 12-03 wires `--hook` into `.claude/settings.json` and MUST NOT rename or
// re-derive any of the above.
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

// ============================================================================
// HOOK MODE (plan 12-02, D-12-03/D-12-04) -- everything below this line is
// the `--hook` extension of the single check point above. It calls
// `docsGuardFiles()`, `runGuardsLive()`, `DOCS_GUARD_FLOOR`,
// `EXPECTED_DOCS_GUARD_NAMES` and `isGatedStatus()` exactly as check mode
// does; it does not re-derive any of them.
// ============================================================================

/** The `tool_name` values this hook ever considers in scope. Everything
 * else (Read, Grep, Glob, Task, WebFetch, ...) exits 0 before any
 * `spawnSync`, unconditionally -- D-12-14's "absolute, no hatch" premise
 * applies only once a call is already known to be in this set. */
const HOOK_MATCHER_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit", "Bash"]);

/** `tool_input` keys that plausibly carry a *path* this call is aimed at.
 * `command` is added for `Bash` specifically inside `extractHookTarget` --
 * the command string is itself the "path-ish" thing a heredoc/redirect
 * targets a file through. */
const HOOK_PATH_KEYS = ["file_path", "path", "notebook_path"];

/** `tool_input` keys that plausibly carry *written* text. Deliberately
 * excludes `old_string`/`old_str`/`old_text` (see `isOldKey` below) --
 * D-12-13: an Edit that downgrades an existing `status: passed` to
 * `status: gaps_found` carries the gated string in its OLD side, and
 * blocking that would obstruct exactly the honest-bad-news case this gate
 * must never obstruct. `command` is folded in separately below, since a
 * `Bash` call's written text and its "path" are the same string. */
const HOOK_WRITTEN_KEYS = ["content", "file_text", "new_string", "new_str"];

/** The full known-key set used only to decide whether `tool_input`'s SHAPE
 * is recognised at all (T-12-08). Presence of a key counts, independent of
 * its value's type -- an unrecognised VALUE under a recognised key is not
 * the failure mode this guards against; an unrecognised SHAPE is. */
const HOOK_KNOWN_KEYS = [...HOOK_PATH_KEYS, ...HOOK_WRITTEN_KEYS, "edits", "command"];

function isOldKey(key) {
  // Never collected as written text -- D-12-13. Listed here once, checked
  // once, in both the known-shape path below and the unrecognised-shape
  // fallback's recursive leaf collector.
  return key === "old_string" || key === "old_str" || key === "old_text";
}

/** Recursively collects every string-valued leaf of `value`, skipping any
 * `old_string`/`old_str`/`old_text` key at any depth (D-12-13 applies to the
 * fallback path too). Used only when `tool_input`'s shape is NOT recognised
 * (T-12-08) -- joins with a real newline, never `JSON.stringify`, because
 * `JSON.stringify` escapes newlines to a literal two-character `\n`, which
 * would defeat `writtenDeclaresGatedStatus()`'s line-anchored scan and turn
 * this fallback into the silent no-op it exists to prevent. */
function collectStringLeaves(value, out) {
  if (value == null) return;
  if (typeof value === "string") {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return;
  }
  if (typeof value === "object") {
    for (const [key, val] of Object.entries(value)) {
      if (isOldKey(key)) continue;
      collectStringLeaves(val, out);
    }
  }
}

/** Field-name-agnostic extraction of what a hook payload targets and
 * writes (Route C in `12-RESEARCH.md`'s Assumptions Log -- this is what
 * makes assumption A1, resolved by observation in
 * `12-HOOK-STDIN-EVIDENCE.md`, non-load-bearing either way). Returns
 * `{ pathish, written, shapeKnown, keysSeen }`.
 *
 * When `tool_input` carries at least one of `HOOK_KNOWN_KEYS`, `shapeKnown`
 * is true and `pathish`/`written` are built from exactly those known keys.
 * When it carries none of them, `shapeKnown` is false and BOTH `pathish`
 * and `written` become the same single joined string of every string leaf
 * in `tool_input` (minus `old_*` keys) -- so a `*MILESTONE-AUDIT*.md` token
 * anywhere in an unrecognised payload puts the call in scope, and
 * `isHookInScope` (below) can still refuse, naming the unrecognised shape. */
export function extractHookTarget(toolName, toolInput) {
  const isPlainObject = toolInput !== null && typeof toolInput === "object" && !Array.isArray(toolInput);
  const keysSeen = isPlainObject ? Object.keys(toolInput) : [];
  const shapeKnown = isPlainObject && HOOK_KNOWN_KEYS.some((k) => k in toolInput);

  if (!isPlainObject || !shapeKnown) {
    const leaves = [];
    if (isPlainObject) collectStringLeaves(toolInput, leaves);
    const joined = leaves.join("\n");
    return { pathish: [joined], written: [joined], shapeKnown: false, keysSeen };
  }

  const pathish = [];
  const written = [];

  for (const key of HOOK_PATH_KEYS) {
    if (typeof toolInput[key] === "string") pathish.push(toolInput[key]);
  }
  if (toolName === "Bash" && typeof toolInput.command === "string") {
    pathish.push(toolInput.command);
  }

  for (const key of HOOK_WRITTEN_KEYS) {
    if (typeof toolInput[key] === "string") written.push(toolInput[key]);
  }
  if (Array.isArray(toolInput.edits)) {
    for (const edit of toolInput.edits) {
      if (edit && typeof edit === "object") {
        if (typeof edit.new_string === "string") written.push(edit.new_string);
        if (typeof edit.new_text === "string") written.push(edit.new_text);
      }
    }
  }
  if (typeof toolInput.command === "string") {
    written.push(toolInput.command);
  }

  return { pathish, written, shapeKnown: true, keysSeen };
}

/** True when `p`'s basename contains `MILESTONE-AUDIT` and ends `.md`,
 * matching `milestoneAuditFiles()`'s own discovery pattern above. */
function isMilestoneAuditPath(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  const base = p.split(/[\\/]/).pop() ?? p;
  return base.includes("MILESTONE-AUDIT") && base.endsWith(".md");
}

// CR-01 (12-REVIEW.md): the token locator below replaces two regexes that
// bridged a writer/edit token to a `MILESTONE-AUDIT...md` target across an
// UNBOUNDED run of intervening text (`[\s\S]*?` / an unbounded whole-text
// scan). On a large non-matching command or payload that evaluation is
// polynomial-to-quadratic: measured pre-fix at 7,050 ms for a 100,000-char
// `sed -i ` Bash command and 5,353 ms (worse, ~19.5 s at 200 KB, quadratic
// beyond) for a 100,000-char unrecognised-shape payload, against a hook wired
// live to every Write/Edit/Bash call in this repo. The fix below locates the
// literal `MILESTONE-AUDIT` token with `String.prototype.indexOf` -- linear,
// cannot backtrack -- and then applies only small, FIXED-length-window
// regexes around each hit. Full-length coverage of the input is preserved
// (every occurrence up to `MAX_AUDIT_TOKEN_SCANS` is examined) while every
// regex evaluation is bounded to a constant number of characters regardless
// of the input's total length. Measured post-fix: <=1 ms on the same two
// inputs, 4.7 ms at 10 MiB.

/** The literal audit-filename token, matched with `indexOf` rather than a
 * regex specifically so locating it can never backtrack. */
const AUDIT_TOKEN = "MILESTONE-AUDIT";

/** Caps how many occurrences of `AUDIT_TOKEN` a single text is examined at,
 * bounding the worst case to a constant number of bounded-window regex
 * evaluations regardless of how many times the token repeats in adversarial
 * input. */
const MAX_AUDIT_TOKEN_SCANS = 64;

/** Window examined immediately AFTER an `AUDIT_TOKEN` hit to confirm it is
 * shaped like the tail of a `*MILESTONE-AUDIT*.md` filename. Bounded so the
 * regex below never sees more than a fixed number of characters. */
const AUDIT_TOKEN_TAIL_WINDOW = 256;

/** Start-anchored: a run of characters that are not whitespace, a quote, or
 * an angle bracket, ending in a literal `.md`. Applied ONLY to the bounded
 * tail window above -- its input length is bounded by construction, so this
 * pattern cannot itself become a backtracking hazard no matter its shape. */
const AUDIT_TOKEN_TAIL_RE = /^[^\s'"<>]*\.md/;

/** Every offset of `AUDIT_TOKEN` in `text`, in order, up to
 * `MAX_AUDIT_TOKEN_SCANS` occurrences. No regex, no recursion -- a plain loop
 * over `String.prototype.indexOf`, which is linear in the searched text and
 * cannot backtrack. */
function auditTokenOffsets(text) {
  const offsets = [];
  let idx = text.indexOf(AUDIT_TOKEN);
  while (idx !== -1 && offsets.length < MAX_AUDIT_TOKEN_SCANS) {
    offsets.push(idx);
    idx = text.indexOf(AUDIT_TOKEN, idx + AUDIT_TOKEN.length);
  }
  return offsets;
}

/** True when `text` contains an `AUDIT_TOKEN` occurrence whose bounded tail
 * window is shaped like a `*MILESTONE-AUDIT*.md` filename. Replaces the
 * former unbounded whole-text token regex entirely -- used by the
 * shapeKnown:false fallback in `isHookInScope()` and by
 * `rawTextIndicatesScope()`'s malformed-JSON path, both of which may see
 * arbitrarily large text (up to the 10 MiB stdin cap). */
function textNamesMilestoneAudit(text) {
  if (typeof text !== "string") return false;
  for (const offset of auditTokenOffsets(text)) {
    const tail = text.slice(offset + AUDIT_TOKEN.length, offset + AUDIT_TOKEN.length + AUDIT_TOKEN_TAIL_WINDOW);
    if (AUDIT_TOKEN_TAIL_RE.test(tail)) return true;
  }
  return false;
}

/** Finds any line declaring a gated `status:` value, tolerating leading
 * whitespace (unlike `frontmatterStatus()`'s column-zero rule) because a
 * heredoc body inside a shell command, or an unrecognised-shape fallback's
 * joined text, is not column-anchored. Reuses `isGatedStatus()` for the
 * passed/tech_debt check itself -- D-12-12/D-12-13's gated-status set is
 * defined in exactly one place. */
export function writtenDeclaresGatedStatus(text) {
  if (typeof text !== "string" || text.length === 0) return false;
  const lines = text.replace(/\r/g, "").split("\n");
  for (const line of lines) {
    const m = /^\s*status:\s*(.*)$/.exec(line);
    if (!m) continue;
    let value = m[1].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length >= 2) ||
      (value.startsWith("'") && value.endsWith("'") && value.length >= 2)
    ) {
      value = value.slice(1, -1);
    }
    if (isGatedStatus(value)) return true;
  }
  return false;
}

// D-12-04/T-12-02: a CONTENT-adjacency scan, deliberately not a shell-syntax
// parser -- see the accepted-limitation comment on `bashTargetsMilestoneAudit`
// below. Covers the redirect/writer shapes D-12-04 names: `>`, `>>`, `tee`
// (with optional `-a`), and `dd of=` want the target IMMEDIATELY before the
// writer token, in the fixed-length window just preceding it; `sed -i`/
// `perl -i` edit their target in place, so its mere PRESENCE anywhere in the
// (also fixed-length) preceding window is enough -- the script argument
// comes between the flag and the filename in real usage, at unpredictable
// distance, which is exactly what made the pre-fix bridging pattern
// unbounded (CR-01).
//
// Why bounded WINDOWS rather than a single global input cap (e.g.
// `command.slice(0, 4096)` before matching): a global cap is a bypass --
// place the write past character 4096 and the gate never sees it at all.
// Locating the literal token first with `indexOf` (unbounded input, but
// linear and non-backtracking) and then examining only a small window
// around EACH hit keeps full-length coverage of the command while still
// bounding every regex evaluation to a constant number of characters. Do
// not "simplify" this back into one pattern bridging writer to target
// across unbounded text -- that is the CR-01 regression.
const BASH_WRITER_WINDOW = 512;
const BASH_WRITER_TAIL_RE = /(?:>>?|tee(?:\s+-a)?|dd\s+of=)\s*['"]?[^\s'"]*$/;
const BASH_INPLACE_WINDOW = 4096;
const BASH_INPLACE_PRESENCE_RE = /(?:^|\s)(?:sed|perl)\s+-i/;

/** T-12-02 (accepted limitation, recorded here and in the phase SUMMARY): a
 * base64-encoded payload, or a `python -c` one-liner that assembles the
 * write target or the gated text at runtime, evades this scan by design --
 * this function matches literal command TEXT, never shell semantics, and
 * deliberately does not attempt to parse shell syntax generally. Layer 1
 * (`audit-integrity.test.ts` / `checkAuditGate()`) re-reads the actual
 * committed file content regardless of how the shell wrote it, and is the
 * unevadable enforcement point this function is only a partial backstop
 * for.
 *
 * T-12-20 (accepted limitation, new in this fix): an in-place edit whose
 * script argument exceeds `BASH_INPLACE_WINDOW` (4096) characters before its
 * target filename is no longer detected -- the pre-fix regex bridged that
 * distance without bound, which is exactly what made it super-linear
 * (CR-01). Measured: a 3,000-character `sed -i` script is still detected;
 * realistic in-place edits are far below the window, and Layer 1 still
 * catches the landed write regardless. */
function bashTargetsMilestoneAudit(command) {
  if (typeof command !== "string") return false;
  for (const offset of auditTokenOffsets(command)) {
    const tail = command.slice(offset + AUDIT_TOKEN.length, offset + AUDIT_TOKEN.length + AUDIT_TOKEN_TAIL_WINDOW);
    if (!AUDIT_TOKEN_TAIL_RE.test(tail)) continue;
    const writerWindow = command.slice(Math.max(0, offset - BASH_WRITER_WINDOW), offset);
    if (BASH_WRITER_TAIL_RE.test(writerWindow)) return true;
    const inplaceWindow = command.slice(Math.max(0, offset - BASH_INPLACE_WINDOW), offset);
    if (BASH_INPLACE_PRESENCE_RE.test(inplaceWindow)) return true;
  }
  return false;
}

/** The fail-open/fail-closed boundary itself (D-12-14, scoped). Returns
 * true only for a call this hook considers itself responsible for -- every
 * out-of-scope path here is reached BEFORE any `spawnSync`. */
export function isHookInScope(toolName, toolInput, extraction) {
  if (!HOOK_MATCHER_TOOLS.has(toolName)) return false;

  if (!extraction.shapeKnown) {
    const joined = extraction.written[0] ?? "";
    return textNamesMilestoneAudit(joined) && writtenDeclaresGatedStatus(joined);
  }

  if (toolName === "Bash") {
    const command = typeof toolInput?.command === "string" ? toolInput.command : "";
    return bashTargetsMilestoneAudit(command) && writtenDeclaresGatedStatus(command);
  }

  const hasAuditPath = extraction.pathish.some(isMilestoneAuditPath);
  if (!hasAuditPath) return false;
  return extraction.written.some((w) => writtenDeclaresGatedStatus(w));
}

/** Same-text fallback used only when `JSON.parse` itself fails (malformed
 * stdin) -- there is no `tool_input` object to extract from at all, so this
 * scans the raw stdin text directly for the same two signals
 * (`isHookInScope`'s shapeKnown:false branch uses the identical pair).
 *
 * `rawText` here is still JSON SOURCE text (that is exactly why it failed to
 * parse) -- a real line break inside a JSON string value is written as the
 * two-character escape sequence `\n`, never an actual line-break byte, so
 * `writtenDeclaresGatedStatus()`'s line-anchored scan would never find a
 * `status:` line embedded in e.g. a broken `content` value without first
 * decoding that escape (and `\r`) back into real line breaks. */
function rawTextIndicatesScope(rawText) {
  if (!textNamesMilestoneAudit(rawText)) return false;
  const decoded = rawText.replace(/\\r/g, "\r").replace(/\\n/g, "\n");
  return writtenDeclaresGatedStatus(decoded);
}

/** Re-runs the derived guard set live and reports pass/fail, reusing
 * `docsGuardFiles()`/`runGuardsLive()`/`DOCS_GUARD_FLOOR`/
 * `EXPECTED_DOCS_GUARD_NAMES` exactly as `checkAuditGate()` does (D-12-01:
 * one seam, no duplicate logic). Deliberately does NOT scan `planningDir`
 * for already-gated audits the way `checkAuditGate()` does -- hook mode's
 * question is narrower: "if this in-scope write lands, is any guard red
 * right now?", not "what does the whole tree currently declare?". */
function hookGuardVerdict(root) {
  const viceDir = join(root, ".claude", "mcp", "vice");
  const guardFiles = docsGuardFiles(viceDir);

  const structuralErrors = [];
  if (guardFiles.length < DOCS_GUARD_FLOOR) {
    structuralErrors.push(
      `only ${guardFiles.length} docs-*.test.ts guard(s) found in ${viceDir} (>= ${DOCS_GUARD_FLOOR} required) -- ` +
        "an empty or broken glob must fail loudly here rather than let this gate report green forever"
    );
  }
  for (const name of EXPECTED_DOCS_GUARD_NAMES) {
    if (!guardFiles.includes(name)) {
      structuralErrors.push(
        `expected guard "${name}" is missing from the derived guard set [${guardFiles.join(", ") || "none"}]`
      );
    }
  }
  if (structuralErrors.length > 0) {
    return { allowed: false, redGuards: [], guardFiles, guardOutput: null, structuralErrors };
  }

  const guardResult = runGuardsLive(viceDir, guardFiles);
  const guardsRed = guardResult.status !== 0;
  const redGuards = guardsRed ? parseRedGuardNames(guardResult, guardFiles) : [];
  return { allowed: !guardsRed, redGuards, guardFiles, guardOutput: guardResult, structuralErrors: [] };
}

/** Assembles the D-12-15 three-part refusal (red guard name(s), its
 * assertion text, the two legitimate routes), prefixed with the
 * unrecognised-shape note (T-12-08) when `extraction.shapeKnown` is false. */
function buildHookRefusal(verdict, extraction) {
  const shapeNote =
    extraction.shapeKnown === false
      ? "Note: tool_input carried none of the recognised fields (file_path, path, " +
        "notebook_path, content, file_text, new_string, new_str, edits, command); this " +
        "refusal was reached via the unrecognised-shape fallback (T-12-08). tool_input keys " +
        `seen: [${extraction.keysSeen.join(", ") || "none"}].\n`
      : "";

  if (verdict.structuralErrors.length > 0) {
    return `audit-gate --hook: REFUSED\n${shapeNote}Structural failure: ${verdict.structuralErrors.join("; ")}\n`;
  }

  const guardNames = verdict.redGuards.length > 0 ? verdict.redGuards.join(", ") : verdict.guardFiles.join(", ");
  const assertionText = truncate(`${verdict.guardOutput.stdout}\n${verdict.guardOutput.stderr}`.trim(), 4000);
  return (
    `audit-gate --hook: REFUSED\n${shapeNote}` +
    `(a) red guard(s): ${guardNames}.\n` +
    `(b) failing assertion output:\n${assertionText}\n` +
    "(c) there is no waiver file and no environment variable that relaxes this gate. The two legitimate " +
    "routes are: 1) fix the documents the red guard checks, or 2) change or retire the guard itself, in a commit.\n"
  );
}

/** Bounded stdin read (T-12-01, hook DoS). 5000ms timeout guard and a 10 MiB
 * byte cap -- on either, stop reading and hand back whatever arrived plus
 * `truncated: true` rather than hang; the caller decides fail-open/closed
 * from there (a truncated payload that is still in scope fails closed). */
function readHookStdin(callback) {
  const MAX_BYTES = 10 * 1024 * 1024;
  const TIMEOUT_MS = 5000;
  let data = "";
  let bytes = 0;
  let truncated = false;
  let finished = false;

  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    callback(data, { truncated });
  };

  const timer = setTimeout(() => {
    truncated = true;
    finish();
  }, TIMEOUT_MS);

  try {
    process.stdin.setEncoding("utf8");
  } catch {
    // stdin not a readable stream (e.g. closed) -- treat as zero bytes.
    finish();
    return;
  }
  process.stdin.on("data", (chunk) => {
    bytes += Buffer.byteLength(chunk, "utf8");
    data += chunk;
    if (bytes > MAX_BYTES) {
      truncated = true;
      finish();
      process.stdin.pause();
    }
  });
  process.stdin.on("end", () => finish());
  process.stdin.on("error", () => finish());
}

/** `--hook` entry point. Never `eval()`s, `import()`s, `require()`s, or
 * shell-executes any part of the stdin payload (ASVS V5, T-12-03) -- the
 * only subprocess this spawns is the same guard-file `spawnSync` check mode
 * already uses, via `hookGuardVerdict()` -> `runGuardsLive()`. */
function hookMain(rootArg) {
  const root = resolve(rootArg ?? join(HERE, ".."));

  readHookStdin((stdinText, { truncated }) => {
    if (stdinText.length === 0) {
      // Zero bytes arrived -- scope is unknowable. Blocking every tool call
      // in the session is exactly the DoS this mitigation exists to
      // prevent, so fail OPEN here specifically (T-12-01).
      process.exit(0);
      return;
    }

    let parsed;
    try {
      parsed = JSON.parse(stdinText);
    } catch (err) {
      if (rawTextIndicatesScope(stdinText)) {
        const reason = truncated
          ? "stdin read was truncated (5000ms timeout or 10 MiB cap) before a complete JSON " +
            "payload arrived; failing closed because the partial payload still names a " +
            "milestone-audit path and a gated status token."
          : `stdin payload could not be parsed as JSON (${err.message}); failing closed ` +
            "because the raw payload still names a milestone-audit path and a gated status token.";
        process.stderr.write(
          `audit-gate --hook: REFUSED (malformed payload)\n${reason}\n` +
            "There is no waiver file and no environment variable that relaxes this gate.\n"
        );
        process.exitCode = 2;
      } else {
        process.exitCode = 0;
      }
      return;
    }

    const toolName = parsed && typeof parsed.tool_name === "string" ? parsed.tool_name : "";
    const toolInput = parsed && typeof parsed === "object" ? parsed.tool_input : undefined;

    const extraction = extractHookTarget(toolName, toolInput);
    const inScope = isHookInScope(toolName, toolInput, extraction);

    if (!inScope) {
      process.exitCode = 0;
      return;
    }

    // In scope from here on -- every remaining path fails CLOSED (D-12-14).
    if (truncated) {
      process.stderr.write(
        "audit-gate --hook: REFUSED (truncated stdin)\n" +
          "stdin read was truncated (5000ms timeout or 10 MiB cap) while evaluating an " +
          "in-scope tool call; failing closed rather than risk missing a gated write.\n" +
          "There is no waiver file and no environment variable that relaxes this gate.\n"
      );
      process.exitCode = 2;
      return;
    }

    let verdict;
    try {
      verdict = hookGuardVerdict(root);
    } catch (err) {
      process.stderr.write(
        "audit-gate --hook: REFUSED (internal error)\n" +
          `${err?.stack ?? String(err)}\n` +
          "There is no waiver file and no environment variable that relaxes this gate. Fix the " +
          "underlying error, or change or retire the affected guard, in a commit.\n"
      );
      process.exitCode = 2;
      return;
    }

    if (verdict.allowed) {
      process.exitCode = 0;
      return;
    }

    // Output contract (Pitfall 2 / anthropics/claude-code#43407): exit 2
    // plus a stderr reason is the ONLY blocking mechanism used here. Do NOT
    // print a `hookSpecificOutput.permissionDecision` JSON blob on stdout
    // alongside this exit 2 -- on this Claude Code build, JSON is only
    // honoured on exit 0, and the combined exit-2-plus-JSON form is
    // unreliable (see the upstream issue). If a future maintainer is
    // tempted to "improve" this by adding that JSON back, don't -- re-verify
    // against a real plant first.
    process.stderr.write(buildHookRefusal(verdict, extraction));
    process.exitCode = 2;
  });
}

function parseArgs(argv) {
  let root;
  let json = false;
  let hook = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--root") {
      root = argv[i + 1];
      i += 1;
    } else if (argv[i] === "--json") {
      json = true;
    } else if (argv[i] === "--hook") {
      hook = true;
    }
  }
  return { root, json, hook };
}

function main() {
  const { root: rootArg, json, hook } = parseArgs(process.argv.slice(2));

  if (hook) {
    hookMain(rootArg);
    return;
  }

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
