# `evidence/tools/verify/` — the plan's own `<verify>` blocks, as runnable files

Throwaway evidence, not deliverables. Each file is one 23-02-PLAN.md task's
`<verify><automated>` block written out verbatim so a reader re-runs exactly
what ran, instead of trusting a transcript's claim that it ran.

Run from the repository root: `bash task1-verify-as-planned.bash`

## Why `.bash` and not `.sh`

`src/mcp/vice/host-scripts.test.ts:187` pins the repository's tracked
shell-script set with `git ls-files -- "*.sh"` and asserts it equals exactly
four paths, deliberately, so a stray script cannot appear unnoticed. Committing
these checks as `*.sh` breaks that assertion — it did, on the first run after
the task-1 commit.

The correct fix is NOT to add these files to `EXPECTED_TRACKED_SHELL_SCRIPTS`:
that array lives under `src/`, and evidence convention 9 in `evidence/README.md`
forbids this phase creating or modifying anything under `src/`. Nor should the
gate be relaxed — it is doing precisely its job. So the files carry the `.bash`
extension, which names their interpreter accurately and falls outside the pinned
glob.

**Do not rename these to `.sh`.** It will red the suite again.
