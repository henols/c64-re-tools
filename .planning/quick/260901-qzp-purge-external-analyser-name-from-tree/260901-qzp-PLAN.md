---
task: Erase the retired external analyser's name from the whole project
date: 2026-09-01
mode: quick
---

# Erase the retired external analyser's name from the whole project

## Context

The third-party static-analysis tool this project used to drive was deleted from the
code in v0.6.0/v0.7.0, but its NAME survived by design: a removal gate policed it out
of the tracked tree while pinning 157 deliberate exemptions (attribution headers,
third-party notices, provenance comments, the gate's own machinery), and the
`.planning/` archive was excluded from that gate's scope entirely.

The user's instruction is that the name itself — in BOTH its long and short forms — is
the problem, and must appear nowhere: not in code, not in skills, not in planning, not
in CLAUDE.md, "not anywhere else". Two constraints were settled by the user directly:

1. **The skill playbook prose STAYS.** It is inspired-by, not copied-from; the user
   ruled there is no licence obligation and that the topic is not to be raised again.
2. **The short form is "the same poison" as the long form.** Both go.

## Tasks

1. **Delete what exists only to name the subject** — the removal gate and its planted
   fixtures and test, the attribution guard, the phase-9 probe findings document, the
   integration note, and the analyser-produced assembly evidence.

2. **Rename every surviving occurrence.** Use the rename map recorded in git so the
   archive names real successors (`anno-*`, `anno_*`, `ANNO-NN`) rather than invented
   ones; the product itself becomes "the external analyser". Preserve the ordinary
   English word that shares the tool's stem where it means a script that regenerates
   a committed fixture -- those uses were never about the tool.

3. **Strip the provenance chain** — the `ATTRIBUTION (ABS-02)` blocks in `src/skills/`,
   the third-party notices sections in all three notices files, and the packaging
   gate's inclusion-condition check.

4. **Repair every guard the rename breaks**, rather than silencing it. Retire only the
   guards whose subject genuinely no longer exists.

5. **Verify**: typecheck, full automated suite against the known clean floor of 0, and
   every CI gate script.

## Verify

- `grep -rlaiE "<both forms>"` over the ENTIRE working tree returns nothing.
- `tsc --noEmit` clean; `npm run test:automated` 0 failures.
- `check-npm-packages`, `check-skill-*` all exit 0; `node build.ts` produces no drift.
