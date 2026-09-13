# Phase 49, plan 49-07 — `SECOND_PATH_GUARD` and `ORDERING_PROOF`

Declares the two outcome lines `SCHEMA.md` §3 assigns to this file:
`SECOND_PATH_GUARD` (§2.6) and `ORDERING_PROOF` (§2.7).

---

## Part 1 — `SECOND_PATH_GUARD`

### What was measured

`src/mcp/vice/acme-seam.test.ts` (plan 49-06) freezes, in both directions,
two sets: `ACME_SPAWN_SITES` (every module that launches the assembler) and
`EXPECTED_BYTES_COMPARISON_SITES` (every module that derives a verdict by
comparing produced bytes to expected bytes). `SECOND_PATH_GUARD` is `held`
only when both set equalities hold in both directions — every module the
live scan flags is a declared member, and every declared member the scan is
capable of finding is actually found by it.

### Command and raw output

```
$ date -u +"%Y-%m-%d"
2026-09-13
$ cd src/mcp/vice && node --test acme-seam.test.ts
✔ acme seam: the module walk returns every source module under the server tree and none from the dependency, compiled-output or fixture directories (4.529782ms)
✔ acme seam: the scan reports the launch function and the identifier launched for each flagged module (390.391988ms)
✔ acme seam: every module the scan flags appears in the frozen declared set (345.329424ms)
✔ acme seam: every module in the frozen declared set that the scan is capable of finding is actually found by it (352.75951ms)
✔ acme seam: a synthetic module source containing a raw assembler launch is flagged (0.197434ms)
✔ acme seam: a synthetic module source containing a launch of an unrelated binary is not flagged (0.110645ms)
✔ acme seam: no module whose name identifies it as part of this phase's gate appears in the scan's result or in the frozen spawn-site set (341.080021ms)
✔ acme seam: the assembler oracle contains exactly one launch call site and exactly one function body returning an outcome token (2.476284ms)
✔ acme seam: a module that reads an assembler-produced artifact and compares it against an export's expected bytes is flagged (335.703528ms)
✔ acme seam: a module that merely constructs or asserts on an export's expected bytes without comparing an assembled artifact to them is not flagged (0.366297ms)
✔ acme seam: every flagged module appears in the frozen comparison set, and every member of that set is flagged (351.674338ms)
✔ acme seam: no gate module is flagged as an expected-bytes comparison site, and adding one to the frozen set is not how the assertion is satisfied (332.365134ms)
✔ acme seam: a synthetic source performing a produced-versus-expected comparison is flagged; one performing an unrelated deep comparison is not (0.214371ms)
✔ acme seam: two runs of the scan over an unchanged tree produce the same two sets, in the same order (1397.484239ms)
ℹ tests 14
ℹ suites 0
ℹ pass 14
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3954.655297
```

Exit code, read directly on the same line (never through a pipe): `0`.

### The guard's own accepted limit, stated no more strongly than it states it

`ACME_SPAWN_SITES` (`src/mcp/vice/acme-seam.test.ts`) freezes **8** members
(the availability probe, the byte-diff oracle, five test modules that
assemble a fixture or round-trip subject directly, and the typed
host-tool build branch, declared by hand because its launch passes a
resolved generic tool path a name-based scan structurally cannot see).

`EXPECTED_BYTES_COMPARISON_SITES` freezes **3** members, and the guard's
own comment states its accepted limit verbatim (`acme-seam.test.ts`,
quoted, not paraphrased):

> "ACCEPTED LIMIT, recorded here rather than resolved: the two test-file
> members below PREDATE the byte-diff oracle's own tree support -- they
> are assertions written before this project had any other way to prove a
> multi-file export reassembles, kept as declared members rather than
> migrated onto the oracle in this pass. Their presence here is NOT a
> licence for a third one: the property this set enforces from this point
> forward is that no NEW second comparison path appears, not that these
> two are somehow correct to keep growing. Closing them onto the oracle is
> separate work this set does not itself claim to have done."

The two named members this accepted limit covers are
`anno-export-asm.test.ts` (the exporter's own pre-existing round-trip
assertions) and `hazard-subject-reassembly.test.ts` (the purpose-built
subject's own round-trip assertion) — both explicitly annotated in the
frozen set's own declaration as `"ACCEPTED LIMIT, not a licence for a new
comparison path"`. This evidence file states the guard's claim in exactly
those terms and no stronger: the guard proves no **new, unaudited** second
path has appeared, not that these two pre-existing members have been
migrated onto the one oracle.

### Reading the line

All 14 `acme seam:` cases pass, both set-equality assertions hold in both
directions (declared-vs-discovered and discovered-vs-declared), and the
dedicated case confirms no `reassembly-gate*` module is a member of, or
discovered by, either scan. `SECOND_PATH_GUARD` derives to `held`.

---

## Part 2 — `ORDERING_PROOF`

### What was measured

Whether `SCHEMA.md`'s and `DECISION-RULE.md`'s own add-commits both
precede every measurement commit in this phase, read from `git log`
directly rather than taken on either document's own word.

### Command and raw output

```
$ cd .planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence
$ git log --diff-filter=A --format=%H -- SCHEMA.md
b6953618c972a0a88d92f84d9e5a015367f61601
$ git log --diff-filter=A --format=%H -- DECISION-RULE.md
4df0f567a7a980ae64985c65061fe5968761f625

$ git show --name-only --format="%H %ci" b6953618c972a0a88d92f84d9e5a015367f61601
b6953618c972a0a88d92f84d9e5a015367f61601 2026-09-13 10:35:07 +0200

.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md

$ git show --name-only --format="%H %ci" 4df0f567a7a980ae64985c65061fe5968761f625
4df0f567a7a980ae64985c65061fe5968761f625 2026-09-13 10:35:14 +0200

.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md

$ git log --oneline --reverse --grep="(49-0" -- .
b6953618 feat(49-01): freeze the reassembly gate's outcome-line schema
4df0f567 feat(49-01): freeze the reassembly gate's ordered decision rule table
1b389ed4 docs(49-01): complete the pre-commitment plan
fc72e2e0 docs(49-01): complete the pre-commitment plan
f681e76a feat(49-02): extract the shared byte-diff verdict body and add a tree-aware entry point
4fbc7f12 test(49-02): add failing test for the reassembly gate's rule table
989cd08d feat(49-02): implement the reassembly gate's rule table and required inputs
[... every remaining commit through plan 49-06, and 0ba1872e feat(49-07) ...]
```

Exit code of the two `git log --diff-filter=A` invocations and the two
`git show` invocations above, each read directly on its own line: `0`.

### The file list each add-commit touched

`b6953618` (`SCHEMA.md`'s add-commit): exactly one file,
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/SCHEMA.md`
— nothing else, and in particular no `evidence/49-*.md` measurement file
and no `docs/phase49-*` verdict document.

`4df0f567` (`DECISION-RULE.md`'s add-commit): exactly one file,
`.planning/phases/49-the-reassembly-gate-committed-before-the-phase-it-gates/evidence/DECISION-RULE.md`
— nothing else, same absence of any measurement file or verdict document.

Both commits are the FIRST two commits `git log --oneline --reverse
--grep="(49-0" -- .` lists for this whole phase; every subsequent commit
(`1b389ed4` onward, through this plan's own `0ba1872e`) postdates both.

### Reading the line

Both add-commits precede every measurement commit in this phase, and
neither commit's own file list contains a measurement evidence file or the
verdict document. `ORDERING_PROOF` derives to `held` per `SCHEMA.md`
§2.7's own rule, checked against real git history rather than any
document's claim about itself.

---

<!-- Bare column-0 outcome lines. Final occurrence wins. Already quoted in
     the two "Reading the line(s)" sections above are prose references, not
     the bare lines themselves -- these two are each's sole physical
     occurrence. -->

SECOND_PATH_GUARD: held
ORDERING_PROOF: held
