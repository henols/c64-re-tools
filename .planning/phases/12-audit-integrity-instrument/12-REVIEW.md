---
phase: 12-audit-integrity-instrument
reviewed: 2026-08-21T16:24:36Z
depth: deep
files_reviewed: 4
files_reviewed_list:
  - scripts/audit-gate.mjs
  - .claude/mcp/vice/audit-integrity.test.ts
  - .claude/settings.json
  - .gitignore
findings:
  critical: 3
  warning: 4
  info: 0
  total: 7
status: issues_found
---

# Phase 12: Code Review Report

**Reviewed:** 2026-08-21T16:24:36Z
**Depth:** deep
**Files Reviewed:** 4
**Status:** issues_found

## Summary

Phase 12 builds `scripts/audit-gate.mjs` (check mode + `--hook` PreToolUse mode), a
`docs-*.test.ts`-derived-guard-set proof suite in `audit-integrity.test.ts`, and a live
`.claude/settings.json` wiring that runs `audit-gate.mjs --hook` on every `Write|Edit|Bash`
tool call in this repo. The check-mode logic (`checkAuditGate`, `frontmatterStatus`,
`milestoneAuditFiles`, the D-12-16 planted-violation/false-negative test pair) is solid and
genuinely non-vacuous — I could not break it.

The `--hook` mode, however, has three provable, reproducible defects that undermine the
exact guarantees its own header comments claim, all confirmed by direct execution against
the real script during this review (commands and outputs available on request):

1. A catastrophic-backtracking regex (`BASH_INPLACE_EDIT_RE`) hangs the hook on any large,
   entirely benign `sed -i`/`perl -i` Bash command that doesn't touch a milestone audit —
   this hook is wired to **every** Bash call in every session in this repo (CLAUDE.md's own
   "a hang or crash here degrades every tool call in every session" warning, realized).
2. An unbounded recursion in the field-name-agnostic fallback (`collectStringLeaves`) crashes
   the hook process with an uncaught `RangeError` on a ~120KB deeply-nested `tool_input`,
   violating the documented "a bug in this file must not be able to brick unrelated
   Write/Edit/Bash calls" contract for exactly the fallback path built to be the most
   defensive one.
3. The Bash-mode "declares a gated status" check is line-anchored and misses the single most
   ordinary way to append a status line from a shell one-liner
   (`echo "status: passed" >> file.md`), as opposed to the documented/accepted T-12-02
   base64/`python -c` obfuscation limitation. Confirmed end-to-end against a real red-guard
   tree: the hook allows (exit 0) a Bash write that should be refused. Only the heredoc form
   is exercised by the committed tests.

None of these defeat Layer 1 (`checkAuditGate()` re-reading the actual committed file, the
documented unevadable enforcement point) — a milestone audit that lands via one of these
routes would still be caught the next time `node scripts/audit-gate.mjs` (or CI) runs. But
the `--hook` mode's whole value proposition is the *live*, in-session block, and all three
break that promise for realistic, non-adversarial inputs.

Four further findings (WARNING) cover a `spawnSync` with no `timeout` bound, an empty-guard-
set path that triggers an unbounded full-suite `node --test` auto-discovery instead of "run
zero guards," an asymmetry in error handling between check mode and hook mode, and one dead
code path.

## Critical Issues

### CR-01: Catastrophic regex backtracking in the Bash in-place-edit detector hangs the live PreToolUse hook on ordinary large `sed -i`/`perl -i` commands

**File:** `scripts/audit-gate.mjs:522-523`
**Issue:**

```js
const BASH_INPLACE_EDIT_RE =
  /(?:sed\s+-i[^\s]*|perl\s+-i[^\s]*)[\s\S]*?['"]?[^\s'"]*MILESTONE-AUDIT[^\s'"]*\.md/;
```

The lazy `[\s\S]*?` followed by more variable-width groups causes polynomial (at minimum;
observed growth is worse than quadratic) backtracking when the command contains `sed -i` or
`perl -i` followed by a long run of text that never contains `MILESTONE-AUDIT`. Measured
directly against the committed regex in this review:

| non-matching chars after `sed -i ` | time to evaluate `.test()` |
|---|---|
| 5,000 | 38 ms |
| 10,000 | 132 ms |
| 20,000 | 422 ms |
| 40,000 | 2,196 ms |
| 80,000 | 7,697 ms |
| 2,000,000 | did not complete in 120 s (killed) |

`bashTargetsMilestoneAudit()` (which calls this regex) is invoked from `isHookInScope()` for
**every** `Bash` tool call whose `tool_input` has the standard shape — i.e. every ordinary
Bash call in every session, per `.claude/settings.json`'s `Write|Edit|Bash` matcher, and
before any `spawnSync`/timeout logic runs at all. A single legitimate Bash call doing an
in-place edit of anything larger than a few tens of KB (e.g. `sed -i 's/x/y/' some-large-
generated-file`, or a `perl -i` one-liner over a sizeable script) hangs the hook process for
seconds to minutes, well past `.claude/settings.json`'s own `timeout: 30`. This is a
denial-of-service in the hot path of a control wired to every Write/Edit/Bash call
repo-wide, not a mere efficiency nit — it is exactly the "a hang ... here degrades every tool
call in every session" scenario this review was asked to check for.

**Fix:** Replace the lazy-wildcard scan with a bounded, non-backtracking check, e.g. split
the command into an argument-like token list first (or cap the scanned window with a fixed
length, e.g. `.slice(0, 4096)`, before applying the existing pattern), or use two independent
non-overlapping regexes (`/sed\s+-i[^\s]*/` / `/perl\s+-i[^\s]*/` presence test, then a
*separate*, anchor-free `MILESTONE_AUDIT_TOKEN_RE.test(command)` for the target) instead of
one pattern that tries to bridge the two with an unbounded `[\s\S]*?`.

### CR-02: Unbounded recursion in the field-name-agnostic fallback crashes the hook on a small, deeply-nested payload

**File:** `scripts/audit-gate.mjs:404-420` (recursion at `:411`), reached from `extractHookTarget()` at `:442`
**Issue:**

```js
function collectStringLeaves(value, out) {
  ...
  if (Array.isArray(value)) {
    for (const item of value) collectStringLeaves(item, out);
    return;
  }
  ...
}
```

This function is called, unconditionally, for every `Write`/`Edit`/`MultiEdit`/
`NotebookEdit`/`Bash` call whose `tool_input` matches none of `HOOK_KNOWN_KEYS` — i.e.
exactly the "field renamed upstream" case `extractHookTarget()`'s own header comment says
this fallback exists to defend against (T-12-08). It has no depth guard.

Reproduced directly against the committed script:

```
$ node scripts/audit-gate.mjs --hook --root . < deep.json   # 120,053-byte payload
file:///.../scripts/audit-gate.mjs:411
    for (const item of value) collectStringLeaves(item, out);
                       ^
RangeError: Maximum call stack size exceeded
    at collectStringLeaves (.../audit-gate.mjs:411:24)
    ... (repeats)
Node.js v22.22.0
EXIT CODE: 1
```

where `deep.json` is `{"tool_name":"Write","tool_input":{"unknown_field":[[[[...60000 levels...]]]]}}`
— well under the 10 MiB stdin cap (`readHookStdin`'s `MAX_BYTES`), so that cap provides no
protection against this. The process crashes with an uncaught exception and exit code `1` —
neither the documented `exit 0` (fail-open, out-of-scope) nor `exit 2` (fail-closed,
in-scope refusal) contract. This violates the file's own stated invariant: "a bug in this
file must not be able to brick unrelated Write/Edit/Bash calls repo-wide" — this crash fires
before scope is even determined, for any tool call whose `tool_input` happens to carry no
recognized key (precisely the scenario the fallback exists to handle robustly instead of
crashing on).

**Fix:** Convert `collectStringLeaves` to an explicit-stack iterative walk, or add a depth
cap (e.g. 500) that stops descending and still returns whatever was collected, or wrap the
`extractHookTarget`/`isHookInScope` call site in `hookMain()` in the same try/catch already
used around `hookGuardVerdict()` so an internal error here also degrades to a clean `exit 2`
with a reason instead of an unhandled crash.

### CR-03: Bash single-line status writes bypass detection entirely — only the (untested) heredoc form is caught

**File:** `scripts/audit-gate.mjs:495-511` (`writtenDeclaresGatedStatus`), `:520-537` (Bash regexes), `:550-553` (`isHookInScope`'s Bash branch)
**Issue:** `writtenDeclaresGatedStatus()` scans line-by-line with `/^\s*status:\s*(.*)$/`.
For a Bash `command` string, "a line" means a real `\n` inside that single string — which a
one-line shell command does not have. Reproduced end-to-end against a real synthetic tree
with a genuinely red guard (via `runHook`-shaped subprocess call, `--hook --root <tree>`):

```
tool_input.command = 'echo "status: passed" >> .planning/v9.9.9-MILESTONE-AUDIT.md'
=> exit 0   (allowed — should be refused: BASH_ADJACENT_WRITE_RE matches the >> adjacency,
             but writtenDeclaresGatedStatus never finds "status:" at the start of the
             (single, "echo ...") line)
```

versus the heredoc form, which the committed tests DO exercise and which correctly refuses:

```
tool_input.command = "cat > file.md <<'EOF'\n---\nstatus: passed\n---\nEOF"
=> exit 2   (refused)
```

This is not the accepted T-12-02 limitation (base64/`python -c` obfuscation of the target or
the text) — the string `status: passed` is present in the command *verbatim*, on the *exact
line* the adjacency regex just matched a write to. It is a plain coding gap: the two checks
(`bashTargetsMilestoneAudit` and `writtenDeclaresGatedStatus`) are evaluated against the same
`command` string but make incompatible assumptions about what "a line" is. `echo`/`printf`
one-liners are the single most ordinary way an operator or an LLM would append a status line
from a shell command — far more likely in practice than a heredoc. No test in
`audit-integrity.test.ts` exercises this single-line form; only the multi-line heredoc
("hook mode: a Bash heredoc writing a gated status..." at `audit-integrity.test.ts:508`) is
pinned, so this gap shipped without a red test ever seeing it.

**Fix:** In the Bash branch of `isHookInScope`, don't reuse the generic line-anchored
`writtenDeclaresGatedStatus(command)`; instead search for the gated-status token anywhere in
the command (e.g. `/\bstatus:\s*['"]?(passed|tech_debt)\b/i.test(command)` reusing
`isGatedStatus`'s value set), since a Bash command line is not multi-line frontmatter and
should not be scanned as if it were.

## Warnings

### WR-01: `runGuardsLive()`'s `spawnSync` has no internal timeout bound

**File:** `scripts/audit-gate.mjs:147-151`
**Issue:** `spawnSync(process.execPath, ["--test", ...files], { cwd: viceDir, encoding: "utf8", env })`
passes no `timeout` option. If the guard test run itself hangs (a real bug in a guard file, a
loaded system, or CR-01/CR-02 above interacting with a slow environment), this call blocks
indefinitely. In `--hook` mode the only backstop is the external `timeout: 30` in
`.claude/settings.json` (enforced by the Claude Code hook runner, not by this file), whose
allow/deny behavior on timeout is not verified anywhere in this phase's evidence
(`12-GATE-PROOF.md` explicitly defers the live in-session hook check). In check mode
(`node scripts/audit-gate.mjs`, used manually or from CI) there is no bound at all.
**Fix:** Pass an explicit `timeout` (comfortably under the hook's own 30s budget, e.g. 15000)
and `killSignal` to `spawnSync`, and treat a `result.signal`/timeout the same way
`result.error` is already handled today (fail closed / red).

### WR-02: `checkAuditGate()` spawns a full-suite `node --test` auto-discovery instead of "run zero guards" when the guard set is empty

**File:** `scripts/audit-gate.mjs:304-329`
**Issue:** `checkAuditGate()` unconditionally calls `runGuardsLive(viceDir, guardFiles)` even
when `guardFiles.length === 0` (a below-floor structural failure already recorded via
`need(...)`). `runGuardsLive(viceDir, [])` becomes `spawnSync(process.execPath, ["--test"], {cwd: viceDir, ...})`
— Node's test runner interprets zero positional file arguments as "auto-discover every test
file in the tree," not "run nothing." Reproduced directly: `node --test` with no arguments in
`.claude/mcp/vice` does not finish within 15 seconds (that directory's real suite is ~2200+
tests per the phase's own SUMMARY evidence). So the one scenario meant to fail fast and
loudly (D-12-08's "an empty or broken glob must fail loudly ... rather than let this gate
report green forever") instead triggers a multi-minute full-suite run before returning. The
final `allowed` verdict is unaffected (already `false` from the structural error), but the
call becomes needlessly slow exactly when a fast diagnostic is most wanted, and — combined
with WR-01's missing timeout — has no bound at all in check mode. Note `hookGuardVerdict()`
(`:588-604`) does NOT have this bug: it returns early on a structural error before ever
calling `runGuardsLive`. The existing floor test (`audit-integrity.test.ts`, "a synthetic
tree below the guard floor...") uses `guardCount: 1`, never `0`, so this path is untested.
**Fix:** Short-circuit before calling `runGuardsLive` when `structuralErrors.length > 0` (or
at minimum when `guardFiles.length === 0`), mirroring `hookGuardVerdict()`'s own structure.

### WR-03: Asymmetric error handling between check mode and hook mode for the same shared logic

**File:** `scripts/audit-gate.mjs:298-329` (`checkAuditGate`) vs `:744-756` (`hookMain`'s `hookGuardVerdict()` call)
**Issue:** `hookMain()` wraps its call into the shared guard-derivation/run logic in a
try/catch and turns any internal error (e.g. a missing `viceDir` from a bad `--root`) into a
clean `exit 2` refusal with a reason. `checkAuditGate()`/`main()` has no equivalent guard: a
missing `viceDir`/`planningDir` (e.g. a mistyped `--root`) propagates an uncaught `ENOENT`
out of `docsGuardFiles()`/`milestoneAuditFiles()`, crashing the process with a raw stack
trace and Node's generic uncaught-exception exit code, instead of the clean `audit-gate: FAIL`
message the rest of `main()` is designed to produce.
**Fix:** Wrap `checkAuditGate({ viceDir, planningDir })` (and the duplicate
`docsGuardFiles`/`milestoneAuditFiles` calls in `main()`) in the same style of try/catch used
in `hookMain()`, producing a clean, non-zero exit with a readable message.

### WR-04: Dead code — `extractHookTarget()` collects a Bash command into `pathish`, but `isHookInScope()` never reads it there

**File:** `scripts/audit-gate.mjs:453-455` (push), `:550-553` (unused for this case)
**Issue:**

```js
if (toolName === "Bash" && typeof toolInput.command === "string") {
  pathish.push(toolInput.command);
}
```

`isHookInScope()` special-cases `toolName === "Bash"` and returns based on
`bashTargetsMilestoneAudit(command)`/`writtenDeclaresGatedStatus(command)` directly from
`toolInput.command` — it never reaches the generic `extraction.pathish.some(isMilestoneAuditPath)`
check for Bash. So this push is unreachable in the only caller that matters, is not asserted
by any test (`extractHookTarget` and `pathish` do not appear anywhere in
`audit-integrity.test.ts`), and reads as though Bash participates in the generic path-based
scope check when it does not.
**Fix:** Remove the dead push, or add a comment at `:453` explaining explicitly that it is
intentionally unused for scope determination (if kept for some other future consumer), plus a
direct unit test of `extractHookTarget()`'s return shape.

---

_Reviewed: 2026-08-21T16:24:36Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: deep_
