---
quick_id: 260915-mmo
phase: quick-260915-mmo
plan: 01
subsystem: docs
tags: [ste100, docs, acme-build, skill]
status: complete
dependency_graph:
  requires: []
  provides: ["ste100-compliant src/skills/acme-build/SKILL.md"]
  affects: []
tech_stack:
  added: []
  patterns: ["ASD-STE100 strict pass: active voice, no semicolons, fixed verb glossary, one-word-one-meaning"]
key_files:
  created: []
  modified:
    - "src/skills/acme-build/SKILL.md"
decisions:
  - "Kept the D-2 exemption on the `description:` frontmatter long-sentence violation — it is the only violation left, by design."
  - "Reused the existing referent 'the verb' for two passive-voice sites. The file already uses that term later, for `anno export-asm`."
  - "Reused the phrase 'the removed route' (already used earlier in the same paragraph) rather than paraphrasing 'what was removed'."
metrics:
  duration: "~15 minutes"
  completed: "2026-09-15"
actuals:
  tokens: 1995
  tasks: 3
  commits: 2
plan_head_before: 5d104d75c9a1d05ca10cbc44d67b58e9c0c2f5f8
---

# Quick 260915-mmo: ACME-build SKILL.md ASD-STE100 strict pass Summary

Applied the ASD-STE100 strict pass to `src/skills/acme-build/SKILL.md`, cutting the ste-lint
violation count from a baseline of 23 to 1, with every fact, condition, hedge, and hazard
token preserved byte-identical or meaning-identical.

## What Changed

Two tasks, two commits, one file:

1. **Hard violations (Task 1, commit `bed8e0e7`):** split all 5 prose semicolons into
   separate sentences. Resolved both synonym rotations: `launched`→`started` against the
   glossary's `start`, and `Fix`→`Correct` in the Troubleshooting header, against the glossary's
   `correct`. Split the one addressable over-long sentence, inside the Troubleshooting
   cell about the `.a` extension, keeping the dated measurement, the accepted extensions, and
   the `sed` remedy.

2. **Passive voice (Task 2, commit `ab39ad0e`):** converted all 14 nameable passive-voice
   sites to active voice, naming: the seam (`-I DIR` resolution and refusal), the scaffold's
   BASIC stub (computes its `SYS` target rather than hard-coding it), this document (keeps
   both disassembly-history halves), the withdrawal (records why the route has its current
   shape), the removed route (reused the exact phrase from the paragraph above instead of
   "what was removed"), the assembling-and-diffing action (settles/comes-from correctness),
   `<image>`/`--store` (neither derives from the other), the verb (writes the export into the
   named directory, and refuses a non-empty destination), `acme-verify.test.ts` (exercises the
   oracle), the oracle (stays absent from the published package), the verb again (wrote
   source, evidence of nothing more), and the reader (what you actually knew when you wrote
   it).

## Final Count

| Metric | Baseline | Final |
|---|---|---|
| Total violations | 23 | **1** |
| `passive-voice` | 14 | 0 |
| `semicolon` | 5 | 0 |
| `long-sentence` | 2 | 1 (exempt) |
| `synonym-rotation` | 2 | 0 |

The single remaining violation is the `long-sentence` hit on line 3, the `description:`
YAML frontmatter field. It is exempt by decision D-2 (`.planning/notes/ste100-conformance-of-the-shipped-skills.md`)
and was never touched.

## Kept As-Is

Nothing was left passive by choice — all 14 flagged passive-voice sites had a nameable actor
in the surrounding text and were converted. No hedge, scope qualifier, or measurement was
softened or dropped.

## Verbatim Tokens and Byte-Identity

- The `description:` frontmatter line: byte-identical to baseline (sha256 prefix
  `ba56ba0677fc1642`, checked and unchanged).
- Every fenced code block: byte-identical to baseline (sha256 prefix `0c36d09a846bd991`,
  checked and unchanged).
- All 10 hazard tokens present at baseline count: `$ACME` (3), `0.97 "Zem"` (1),
  `31 Jan 2021` (1), `findAcmeLib()` (1), `src/mcp/vice/host-tool.mts` (1), `acme.build` (1),
  `acme.mts` (1), `acme-verify.ts` (1), `VICE_REQUIRE_ACME=1` (1), `anno export-asm` (5).

## Probe Order — Unchanged in Content and Order

The four filesystem prefixes (`/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`,
`~/.acme`) that other project documents (e.g. `.claude/CLAUDE.md`'s STACK section) attribute
to this file are, as before this pass, **not present in this file at all** — the Setup
section still states only that `acme.mts`'s own `findAcmeLib()` names those conventional
install locations and that this file does not restate them. This pass added no such list,
named no such path, and did not touch the sentence that defers to `findAcmeLib()`. The
ordered probe list itself lives elsewhere in the codebase and was not part of this file's
diff, so there is no ordering to compare here — the relevant invariant for this file is that
the list stays absent, which it does.

## "Never Auto-Installs" Rule — Unchanged

The Setup section and the Troubleshooting row `install the ACME cross assembler and put
acme on PATH` both still read as instructions to the *user* to install ACME. No sentence in
the diff claims the skill, the script, or the seam installs ACME. The Setup section's two
load-bearing conditions — the probe runs on the HOST inside the seam's executor and never
inside a container, and `$ACME` must be set in the environment the host broker process sees
— were not touched by either task and remain exactly as written.

## Deviations from Plan

None. The plan's two tasks were executed as scoped. Task 3's checks (linter count,
byte-identity, token counts, single-file diff, no install-claim drift) all passed on the
first run after Task 2's commit. No hunk needed reverting.

## Self-Check: PASSED

- `src/skills/acme-build/SKILL.md` exists and is the only file changed across both commits
  (checked via `git diff --name-only bed8e0e7~1 HEAD`).
- Commit `bed8e0e7` exists in `git log`.
- Commit `ab39ad0e` exists in `git log`.
- ste-lint count is 1 (down from baseline 23), hard_count is 1 (the exempt frontmatter line).
- No test was written or run. No assembly was invoked.
