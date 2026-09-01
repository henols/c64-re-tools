---
task: Erase the retired external analyser's name from the whole project
date: 2026-09-01
status: complete
commit: 09150c8
---

# Summary

The name is gone from the entire working tree — tracked, gitignored-but-shipped, and
the session's own persistent memory. A case-insensitive sweep for either form over
everything except `.git/` and `node_modules/` returns zero files.

## Scale

| | |
|---|---|
| Occurrences rewritten | ~20,200 |
| Files touched | 612 |
| Files deleted | 19 |
| Paths renamed | 3 |

## What was renamed

Historical module names were re-pointed through the rename map recorded in git
(`git log --diff-filter=R`), so the archive keeps naming real successors rather than
invented ones: the retired `*-cli.ts` family reads as `anno-*`, its tool verbs as
`anno_*`, its requirement ids as `ANNO-NN`. The product itself reads as "the external
analyser".

Ordinary uses of the English word that shares the tool's stem — the committed-fixture
regeneration scripts, the fixture-agreement test in `anno-export-asm.test.ts`, the
manifest regeneration path — were deliberately left alone. They were never about that
tool, and a blind sweep would have destroyed them.

## What was retired, and why it had to be

Three subsystems could not survive the erasure, because each one's subject IS the name:

- **The removal gate** (`scripts/check-no-*.mjs` + `.d.mts`), its two planted fixtures
  and `removal-gate.test.ts`. A gate that keeps a name out cannot do so without
  carrying the name — this one composed it from two fragments specifically to avoid
  needing an exemption for itself.
- **The attribution guard** (`skill-attribution.test.ts`), the `ATTRIBUTION (ABS-02)`
  blocks in three playbooks, the third-party notices sections in all three notices
  files, and `check-npm-packages.mjs`'s inclusion-condition check. The playbook prose
  itself stays; only the provenance chain goes.
- **The guard-fates audit** — `check-guard-fates.mjs`, `audit-mutation-harness.mjs`,
  `guard-fates.test.ts`, `audit-harness-restore.test.ts`, four harness-signal fixtures
  and the fate registry. Its audited set is *derived* by matching the subject's name
  against pinned historical commits, and two of its members carry the name in their
  PATH. It cannot be expressed, or frozen as a census, without reintroducing the name.

**Coverage preserved rather than dropped:** the two BASIC-trigger checks inside the
retired attribution guard never depended on that chain — they police this project's own
skill descriptions — so they were extracted verbatim into
`src/mcp/vice/skill-basic-trigger.test.ts`.

## Guard repairs

A tree-wide rename walks straight into guards whose subject *is* a name. Every one of
these was a genuine break, surfaced by the suite against a baseline measured clean in a
throwaway worktree, and fixed rather than silenced:

| Guard | What the rename did |
|---|---|
| `module-classification.ts` / `.test.ts` | Rename-provenance records became self-renames, and the enumeration filter was widened onto the surviving `anno-` family, re-importing every survivor into a scope whose whole purpose is to empty. The retired prefix is restored as a named constant matching nothing on disk. |
| `anno-index.test.ts` | The forbidden-import family list named the retired prefix; rewriting it to `./anno-` forbade the module's one legitimate import. Dead entry dropped, not re-pointed. |
| `tool-support-table.test.mjs` | A negative control whose whole point is that its argument does NOT match — the rename made it match, so it stopped throwing. |
| `docs-dangling-refs.test.ts` | A requirement-id regex lost its capitalisation, because the trailing `\d` blocked the uppercase rename rule and the lowercase one fired instead. It stopped matching the uppercase `ANNO-NN` ids it exists to find. |
| `anno-derivation.test.ts` + manifest | An over-eager rule destroyed the upstream procedure PATHS; restored as structured, needle-free paths with the regex re-pointed. |
| `audit-root-args.test.ts` | Two retired scripts left its matrix and clean-control population; the root-accepting floor moves 8 → 6. |

**One floor was lowered.** `audit-root-args.test.ts`'s non-vacuity floor carries a
"RAISE and NEVER LOWER" discipline. The rationale is recorded at the assertion itself:
the two scripts are **gone from the tree**, not excluded from measurement — no exclusion
list, no skip, no unmigrated-scripts array was added.

## Verification

- `tsc --noEmit` — clean.
- `npm run test:automated` — **2960 pass, 0 fail, 1 skipped** (against the known clean
  floor of 0, re-confirmed on a detached baseline worktree before any fix was written).
- `check-npm-packages`, `check-skill-tool-coverage`, `check-skill-fork-honesty`,
  `check-skill-cli-invocations`, `check-skill-description-overlap` — all exit 0.
- `node build.ts` — 8 artifacts, no drift.
- Whole-tree grep for either form — zero hits.

## Notes

- CI lost two steps (the removal gate, the fate audit) and one step's comment was
  rewritten where it cited the retired attribution guard.
- The five pre-existing untracked files in the working tree were swept for the name but
  deliberately **not** committed — they were untracked before this task and stay that way.
- This task's own artifacts and commit message are named neutrally on purpose: a GSD
  record that named the subject would have re-seeded `.planning/` with it.
