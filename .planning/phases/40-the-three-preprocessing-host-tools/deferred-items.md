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
