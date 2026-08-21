---
outcome: "resolved (adapted route — see 'Route actually taken' below)"
route: "A-adapted (session-transcript evidence in place of a live-firing hook; Route A's hooks do not exist on this host/repo, Route B was not exercised because it requires an operator-initiated restart)"
claude_code_version: "2.1.238"
date: 2026-08-21
fields_confirmed:
  Write: "file_path, content, description — CONFIRMED"
  Edit: "file_path, old_string, new_string, replace_all — CONFIRMED"
  Bash: "command, description — CONFIRMED"
  Bash_heredoc_full_body: "UNCONFIRMED (A3, partial — see below)"
subagent_routing_A2: "UNCONFIRMED — no live PreToolUse hook exists on this host to test either context against"
---

# Phase 12 Plan 02 Task 1: Hook stdin field-name evidence (RESEARCH assumption A1)

## Route actually taken — and why Route A/B as literally written did not apply

12-02-PLAN.md's Task 1 assumes `$HOME/.claude/hooks/gsd-prompt-guard.js`,
`gsd-read-guard.js`, `gsd-workflow-guard.js` and `gsd-validate-commit.sh` are
**live-registered** `PreToolUse` hooks on this host, firing via
`$HOME/.claude/settings.json`. That assumption, made by `12-RESEARCH.md`
(dated the same day, 2026-08-21), does **not hold at execution time**:

- `$HOME/.claude/hooks/` contains exactly two files
  (`gsd-check-update-worker.js`, `gsd-graphify-update.sh`) — none of the four
  files Task 1 names.
- `$HOME/.claude/settings.json`'s `hooks` key contains exactly one entry: a
  `PostToolUse` hook on matcher `Bash` running `gsd-graphify-update.sh`. There
  is no `PreToolUse` key at all.
- The project's own `.claude/settings.json` and `.claude/settings.local.json`
  contain a `permissions` block only — no `hooks` key, and no
  `.claude/hooks/` directory exists in this repo.
- The four named scripts DO exist as **project-scoped** hooks in several
  *other* repos on this machine (e.g. `~/dev/henrik/git/bruce_lee/.claude/hooks/`),
  wired through that project's own `.claude/settings.local.json`
  `hooks.PreToolUse` array — a different, npm-`gsd-core`-installed GSD
  variant, not the one used in this repo. `12-RESEARCH.md`'s claim that these
  are *global* hooks "already us[ing]" `~/.claude/settings.json` on *this*
  host was wrong, or has since regressed (a `gsd-cleanup-backup-20260525-*`
  snapshot under `/home/henrik/` shows the four scripts present in
  `~/.claude/hooks/` as of 2026-05-25; they are gone from that location now).

Given that, **Route A as written ("piggyback on hooks already registered and
firing") is inconclusive for all three fields, not just one** — there is
nothing firing to piggyback on. Per the plan's own fallback ladder, that
routes to Route B (register a diagnostic hook in
`.claude/settings.local.json`, then stop and report that a restart is
required). Route B was not executed either, because:

1. Registering the diagnostic hook would have no observable effect until a
   session restart or a `/hooks` review re-reads `settings.local.json` — an
   action only the human operator can trigger, and this task runs
   `autonomous: true` under auto mode with an explicit hard prohibition on
   spawning a nested headless session or restarting the session itself.
2. A strictly better, already-available, restart-free, hook-free empirical
   source existed: **this project's own Claude Code session transcripts**
   under `~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/*.jsonl`.
   Every `tool_use` content block Claude Code has ever written for this
   project records `{"name": "<ToolName>", "input": {...}}`, and `input` here
   is *definitionally* the same object a `PreToolUse` hook receives as
   `tool_input` on stdin — it is the literal argument Claude Code passed to
   the tool call, not a hook's report about it. Reading it requires no new
   hook, no restart, and no nested session.

This is Route A in spirit (observe an artifact Claude Code itself already
produced, rather than guess) but not Route A as literally scripted (no hook
fired). Recorded as such rather than silently reclassified as a clean "Route
A" pass.

## Per-tool findings

### Write — CONFIRMED: `file_path`, `content` (+ `description`)

Verbatim, from `~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/095212fc-1434-469a-9655-d27164fe568c.jsonl` (a `Write` call from an earlier session in this same project, truncated only inside the `content` string value for length):

```json
{"type":"tool_use","id":"toolu_016vG8MBudeiMn1fGK9bdpuY","name":"Write","input":{"file_path":"/tmp/gsd-worktree-wave-7z9vb0.json","content":"{\n  ..."}}
```

Multiple other `Write` calls across this project's transcript history show
the identical two-key shape (`file_path`, `content`), e.g. targeting
`.planning/v0.2.0-MILESTONE-AUDIT.md`, `.planning/phases/.../04-VALIDATION.md`,
and others — the shape is consistent across dozens of independent calls, not
a one-off.

**Verdict: matches RESEARCH.md's empirically-claimed shape
`{ file_path, content, description }` exactly.** The competing WebFetch-derived
`{ file_text }` shape from the official docs page is NOT what this host's
Claude Code 2.1.238 actually sends.

### Edit — CONFIRMED: `file_path`, `old_string`, `new_string`, `replace_all`

Verbatim, from `~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/fa82fbf5-1735-453e-897a-36a6caa8e1af.jsonl`:

```json
{"type":"tool_use","id":"toolu_01C1ZWhWHZjL4YbXnfB1JrXE","name":"Edit","input":{"replace_all":false,"file_path":"/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/05-skill-critical-derived-tools/05-VALIDATION.md","old_string":"- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 22 tasks carry one","new_string":"- [x] All tasks have `<automated>` verify or Wave 0 dependencies — all 23 tasks carry one"},"caller":{"type":"direct"}}
```

Note the top-level `"caller":{"type":"direct"}` key sits **alongside** `input`
in the transcript record, not inside it — it is session/transcript metadata
Claude Code itself tracks (main session vs. subagent-originated call), not
part of `tool_input`. This is the same field the `caller` distinction in
Assumption A2 hinges on; see below.

**Verdict: matches RESEARCH.md's empirically-claimed shape
`{ file_path, old_string, new_string, replace_all }` exactly.** The competing
`{ edits: [{ old_text, new_text }] }` array shape from the WebFetched docs is
NOT what this host's Claude Code 2.1.238 actually sends for a single-edit
`Edit` call.

### Bash — CONFIRMED: `command` (+ `description`)

Verbatim, from **this exact session's own transcript**,
`~/.claude/projects/-home-henrik-dev-henrik-git-c64-re-tools/f051c967-6ef0-416c-b233-f628f704760b.jsonl`
— the orchestrating agent's own pre-wave dependency check, issued just before
this executor was spawned:

```json
{"type":"tool_use","id":"toolu_0148EV56mxc5UgyVFfvDu3Sk","name":"Bash","input":{"command":"cd /home/henrik/dev/henrik/git/c64-re-tools\ngsd-sdk query verify.key-links .planning/phases/12-audit-integrity-instrument/12-02-PLAN.md 2>&1 | tail -30","description":"Pre-wave 2 dependency check"},"caller":{"type":"direct"}}
```

**Verdict: `tool_input.command` is populated for `Bash`, exactly as
`gsd-validate-commit.sh` was claimed to read it.** This also directly answers
half of Assumption A3: the `command` string is the **full, multi-line**
command text as issued (note the embedded `\n` between the `cd` and the
`gsd-sdk query` lines above) — it is not truncated to a single line.

### A3 (heredoc full-body capture) — UNCONFIRMED (partial)

The Bash example above proves `command` carries a full *multi-line* string,
which is meaningfully more than "first line only." It does **not** prove the
specific heredoc shape (`cat > f <<EOF ... EOF`) is captured to its closing
delimiter with no truncation, because no heredoc-shaped `Bash` call happens to
appear verbatim in the transcripts inspected. Per the plan's own instruction,
this is recorded as **UNCONFIRMED** rather than guessed, and is backstopped
by Layer 1 (`audit-integrity.test.ts` / `checkAuditGate()`), which re-reads
the actual committed file content regardless of how the shell wrote it, and
by Task 2's Route C (below), which does not depend on this being true.

## Route C (Task 2, unconditional — this is what makes A1 non-load-bearing)

Independent of every finding above, `scripts/audit-gate.mjs --hook`'s target
extraction is field-name-agnostic by construction: it collects candidate path
and written-text values from a prioritised list of known keys, and falls back
to recursively joining every string-valued leaf of `tool_input` when none of
the known keys is present, naming the unrecognised shape in its refusal
reason rather than silently no-op'ing. A future Claude Code rename of
`content`/`new_string`/`command` — or this evidence document simply being
wrong — cannot silently disable the gate; it can only turn a would-be silent
pass into a loud, named refusal when the call is in scope. That is the
correctness property this document exists to support, not to gate.

## A2 — subagent vs. main-session hook routing

**UNCONFIRMED**, and unlike A1, this could not be resolved by transcript
inspection: no `PreToolUse` hook currently fires in this repo or on this host
at all (see "Route actually taken" above), so there is nothing to observe
firing (or not firing) from a subagent context either way. The `caller`
field seen in the Edit transcript example above (`"caller":{"type":"direct"}`)
confirms Claude Code *does* tag each tool call with a caller-context marker
in the transcript — which is suggestive that a hook's `tool_input`-adjacent
context could plausibly carry the same or a similar marker — but this
document does not claim that as confirmed, since no hook was live to inspect
what it actually receives. This executor is itself running as a task-spawned
executor agent (per its own system prompt), so nothing about the *plan's*
execution context differs from a "subagent" one, but that does not by itself
resolve whether a *project-scoped* hook would see it: with zero
`PreToolUse` hooks registered anywhere in this repo, A2 remains exactly as
open as `12-RESEARCH.md` left it. It is not load-bearing for this phase: Layer
1 (`audit-integrity.test.ts`) is a full backstop regardless of which session
context performs the write, and D-12-04's Bash-heredoc coverage plus Route C
above mean Layer 2's write-refusal does not depend on knowing this answer
either.

## No scratch probe file was created

Because the resolution method was transcript inspection rather than a live
`Write`/`Edit` probe, no `scratch-a1-probe.md` (or similar) file was ever
created under this phase directory, and none needs to be deleted.

## Files touched by this task

Only this document. `.claude/settings.json`, `.gitignore`, and
`scripts/audit-gate.mjs` are unmodified by this task, consistent with the
plan's explicit instruction.

## A2 / A3 resolution

Added by plan 12-07, Task 1. The frontmatter keys `subagent_routing_A2` and
`fields_confirmed.Bash_heredoc_full_body` above still read `UNCONFIRMED` as
of this section's authoring -- Task 3 changes them, once there is something
observed to change them to. **A frontmatter value must never be advanced
ahead of the body evidence below.**

### A2 -- subagent-routed tool calls reach the `--hook` payload

Two branches on offer; Task 3 records which was taken, per the human's Task 2
report in `12-GATE-PROOF.md`.

**Branch (a) CONFIRMED.** A subagent (Route D / Step 9 in
`12-GATE-PROOF.md`'s `## Live in-session hook block`) attempted a write and
the human observed whether the hook fired for it.

```
PENDING-HUMAN-OBSERVATION
```

Pointer: `12-GATE-PROOF.md` § Live in-session hook block, Step 9.

**Branch (b) ACCEPTED LIMITATION.** No subagent-routed attempt was made (or
the human declined). A2 is recorded as a standing, disclosed limitation:

```
PENDING-HUMAN-OBSERVATION
```
Fields to fill when this branch is taken: acceptance date, who accepted it,
the residual risk in one sentence, and the backstop that carries that risk --
Layer 1's `checkAuditGate()` re-reads the actual committed file content under
`npm test` and CI regardless of which tool wrote it or which session context
issued the call, and every merge to `main` auto-publishes, so there is no
release path past a red gate even if a subagent-routing gap turned out to
exist.

### A3 -- a real Bash heredoc's full multi-line body reaches `tool_input.command`

**Branch (a) CONFIRMED.** Step 5 (Route C, Bash heredoc) in
`12-GATE-PROOF.md`'s `## Live in-session hook block` observed the refusal
firing on a heredoc whose gated-status token is not on the first line --
proving the full body, not just the opening `cat > ... <<'EOF'` line, reached
`tool_input.command`.

```
PENDING-HUMAN-OBSERVATION
```

Pointer: `12-GATE-PROOF.md` § Live in-session hook block, Step 5.

**Branch (b) ACCEPTED LIMITATION.** Step 5 was not performed, or its result
was inconclusive. A3 is recorded as a standing, disclosed limitation:

```
PENDING-HUMAN-OBSERVATION
```
Fields to fill when this branch is taken: acceptance date, who accepted it,
the residual risk in one sentence, and the backstop -- the same
`checkAuditGate()` re-read described under A2 above, which is indifferent to
how the shell assembled the write.
