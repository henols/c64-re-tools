# Deferred Items — Phase 40

Out-of-scope discoveries found during execution, logged per the executor's
scope-boundary rule (not fixed here — pre-existing, unrelated to this
phase's `.c64-re-tools/` consolidation work).

## 2026-09-08, plan 40-01: anno-register/anno-import requirement-id gap

`npm run test:automated` reports 3 pre-existing failures, all in
`anno-register.test.ts` / `anno-import.test.ts`, none touched by this plan:

- `anno-import.test.ts:352` — `annoRegisterEntryFor(): both new tools have a register entry citing a real consumer path and a declared requirement id`
- `anno-register.test.ts:385` — `DIRECTION 5 (basis integrity): every entry cites at least one consumer AND at least one requirement id, every path exists, and every id is declared in .planning/REQUIREMENTS.md`
- `anno-register.test.ts:479` — `planted violation (the negative control): a CLEAN synthetic entry is reported by NONE of the predicates`

Root cause (from the assertion output): the annotation register cites
requirement ids `STORE-01`, `STORE-04`, `STORE-06`, `IMP-01`, `IMP-02`,
`AUTO-01`, `MCP-04` that are well-shaped but NOT declared in
`.planning/REQUIREMENTS.md`. Confirmed via `git log --oneline -- .planning/REQUIREMENTS.md`
that the file's last change was phase 39-08, unrelated to phase 40, and via
`grep` that none of these ids appear in it at all — this predates plan
40-01 and is not caused by the `.c64-re-tools/` path consolidation.

Verified this is the ONLY delta from a clean floor: re-running
`docs-linerefs.test.ts` and `audit-integrity.test.ts` in isolation (both of
which DID regress transiently during this plan's own execution, from the
`vice-proxy.ts` line-number shift `brokerHostPath()`'s new doc comment
introduced) are green again after updating CLAUDE.md/PROJECT.md's citations
and `docs-linerefs.test.ts`'s own planted-violation fixture — see
40-01-SUMMARY.md's Deviations section.

**Not fixed here** — either add the missing `REQUIREMENTS.md` entries or
retire the register entries that cite them, in whichever future phase owns
that annotation-store work.

## 2026-09-08, plan 40-05: a SECOND, orthogonal concurrent-scanner race in `audit-root-args.test.ts`, pre-existing

While verifying the D-27 scratch-fixture fix (uniquely-named per-invocation
scratch directories replacing fixed-name scratch files at the two named
sites — `skill-honesty-checks.test.ts`'s `runCiScriptWithScratchFile()` and
the assessed-but-unchanged `dxa-seam.test.ts` planted binary), a full
`npm run test:automated` run intermittently (3 of 4 runs observed) also
failed:

- `audit-root-args.test.ts:982` — `check-skill-fork-honesty: every spelling
  that RESOLVES to the repository root is accepted` — fails with
  `--root . resolves to the repository root and must behave exactly like the
  unflagged run (got 1, unflagged 0)`, citing whichever
  `zz-scratch-<random>/zz-scratch-in03-positive.md` scratch directory
  `skill-honesty-checks.test.ts`'s own deliberately-violating test case had
  planted (and cleaned up) at that moment.

**Confirmed pre-existing, not caused by this plan's fix:** stashing this
plan's changes to `dxa-seam.test.ts` and `skill-honesty-checks.test.ts` and
re-running the SAME full suite against the ORIGINAL (fixed-name-scratch-file)
code reproduces the identical failure, with the identical mechanism (the
original fixed-name file at `src/skills/acme-build/zz-scratch-in03-positive.md`
observed mid-existence by the same `audit-root-args.test.ts` test). So the
D-27 fix neither introduces nor worsens this; it is a DIFFERENT hazard in a
file this plan's `files_modified` never named.

**Root cause, distinct from D-27's two named sites:** `audit-root-args.test.ts`'s
"every spelling ... is accepted" test runs FOUR sequential live spawns of
`check-skill-fork-honesty.mjs` against the shared real `src/skills/` tree (an
unflagged baseline, then three differently-spelled `--root` arguments all
resolving to the same repository root) and asserts all four exit identically.
Because Node's test runner executes test FILES concurrently, if
`skill-honesty-checks.test.ts`'s own violating scratch fixture exists during
SOME of those four sequential spawns but not others (its own window is a
single `writeFileSync` + one `spawnSync` + cleanup, already about as short as
it can be while still letting the CI script observe it — the whole point of
that helper), the four spawns disagree with each other. No naming change at
either D-27 site closes this: the artifact's CONTENT and the fact that it
must sit inside the real `src/skills/` tree (never a tmpdir, or the CI script
under test would never see it) is what causes the four-way comparison to
occasionally see one live state and then another.

**Not fixed here** — `audit-root-args.test.ts` is not one of this plan's
`files_modified`, and closing it durably would need either (a) that test
comparing something more tolerant of a live, shared, mutable tree instead of
four back-to-back sequential snapshots, or (b) a way to serialize this file's
run against any other file that plants a scratch fixture inside `src/skills/`
mid-suite — a cross-file coordination this repository's test runner
configuration does not currently provide. Left for whichever future pass owns
`audit-root-args.test.ts`'s own hygiene.
