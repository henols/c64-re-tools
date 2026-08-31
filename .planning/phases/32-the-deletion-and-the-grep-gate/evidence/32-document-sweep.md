# CUT-06 — the living-document sweep ledger

**Requirement:** `CUT-06` (part B — the record). **Plan:** `32-05`. **Phase:** 32.
**Measured:** 2026-08-31.
**Measured at commit:** `19b2c5c7741020f55207e588a5afc6a565fcefa9` (`19b2c5c`, *docs(phase-32): update tracking after wave 2*).
**Phase base commit (the "pre-sweep" tree):** `d6bebb1` (*docs(32): create phase plan*) — the last
commit before any phase-32 execution work. Every `changed` / `unchanged` verdict below is
`git diff --exit-code d6bebb1 HEAD -- <path>`.

**This document is a RECORD, not an edit pass.** Plan 32-05 modified exactly one file: this one. No
file in the swept set was touched, no dated record was rewritten, and no pinned occurrence count was
moved. `D-08`'s prohibition — *rewriting a dated record is the one move this project's convention
treats as destroying evidence rather than tidying it* — is honoured by construction here, because the
plan's declared file scope contains no swept document.

---

## 0. Where these numbers were measured, and why that matters

Every `<automated>` verification command in `32-05-PLAN.md` hardcodes the **orchestrator's** checkout
at `/home/henrik/dev/henrik/git/c64-re-tools`. This plan executed in a git worktree, which is a
*different working tree* whose file contents may differ and which does not contain this phase's
worktree commits. Running the plan's commands as written would have measured somebody else's tree and
recorded the result as if it were this one — the exact laundered-evidence failure `CUT-06` exists to
prevent.

Every command was therefore re-anchored to the worktree root, resolved once:

```bash
$ git rev-parse --show-toplevel
/home/henrik/dev/henrik/git/c64-re-tools/.claude/worktrees/agent-a84404fd8662b382d
```

All commands quoted in this document were run from that directory. Where a command is quoted, it is
the command that actually ran, verbatim, with its real output.

### 0.1 Two counting units, named everywhere

Two different things can be called "a mention", and this project has already published figures that
disagree for exactly that reason:

- **LINES** — the number of lines containing at least one match. This is what `grep -c` reports.
- **OCCURRENCES** — the number of matches. This is what `grep -o … | wc -l` reports, and what
  `check-no-regenerator2000.mjs`'s `subjectHits()` returns (*"ONE ENTRY PER OCCURRENCE (not per
  line), so a line carrying the subject twice is reported twice"*).

**Every number in this ledger names its unit.** A bare count is a defect.

### 0.2 `grep -a` is mandatory, and here is the proof

`src/mcp/vice/anno-memmap-render.ts` carries literal NUL bytes. GNU grep classifies the whole file as
binary and skips it, so a plain `grep` silently drops it from any census:

```bash
$ grep -c 'regenerator2000' src/mcp/vice/anno-memmap-render.ts ; echo "plain-grep-exit=$?"
plain-grep-exit=1                        # no output, exit 1 -- the file was SKIPPED, not searched

$ grep -ac 'regenerator2000' src/mcp/vice/anno-memmap-render.ts
1                                        # 1 LINE, with -a
```

Consequence, measured both ways over the same file set:

```bash
$ N=$(for f in $(git ls-files | grep -v '^\.planning/'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done | wc -l); echo "with -a: $N"
with -a: 35

$ N=$(for f in $(git ls-files | grep -v '^\.planning/'); do grep -q  'regenerator2000' "$f" && echo "$f"; done | wc -l); echo "without -a: $N"
without -a: 34
```

**35 with `-a`, 34 without.** The one file that vanishes is `src/mcp/vice/anno-memmap-render.ts`, and
it vanishes because of a NUL byte at **offset 15097, line 315** (two NULs in total, at offsets 15097
and 15118, both on line 315; file size 31604 bytes — re-measured by plan 32-03, and independently
confirmed here by the byte-level scan described in §0.3, which reports `hasNul: true` for exactly that
one file out of the 35).

This is not hypothetical caution. This repo has already had a `grep`-backed census produce a false
decision on this file, and plan 32-01 hit the same trap a second time. Plan 32-03 measured the removal
gate's own scope as **157 occurrences with `-a`, 156 without, across 406 files** — that one-occurrence
delta *is* this file, and it is the provenance comment at `anno-memmap-render.ts:79`. A grep-backed
removal gate would let the subject survive its own removal check in precisely this file.

**Every count in this ledger was produced either with `grep -a` or by a byte-level in-process read.**

### 0.3 The byte-level scanner used for the per-file counts

`grep -a` was used for every spot-check quoted inline. The full 50-row table below was produced by a
byte-level scan that reads each file as a raw `Buffer`, converts with `latin1` (a total, lossless
byte→codepoint mapping — no replacement characters, no NUL truncation), and counts with `indexOf`:

```js
const occ = (s, n) => { let c = 0, i = 0; for (;;) { const k = s.indexOf(n, i); if (k === -1) break; c++; i = k + 1; } return c; };
const lns = (s, n) => s.split("\n").filter((l) => l.includes(n)).length;
```

This agrees with `grep -a` on every file checked and, unlike `grep`, has no binary heuristic at all.
The needle is the contiguous literal `regenerator` + `2000`, matched case-sensitively; the gate's own
`subjectHits()` matches case-insensitively, and no case variant was found in the swept set.

---

## 1. The swept set — declared, with the exact command for every clause

The swept set is the **union of three clauses**, deduplicated on repo-relative path.

### Clause (a) — the removal gate's own scope predicate

Files the removal gate actually polices: `git ls-files` minus the `PLANNING_PREFIX` (`".planning/"`,
a **prefix**, not a substring — `check-no-regenerator2000.mjs:180`, `trackedFiles()` at `:194-200`),
plus the shipped-but-untracked `installer/**` paths `packFiles()` supplies.

```bash
# (a) tracked, outside .planning/, CONTENT carries the literal -- 35 files
for f in $(git ls-files | grep -v '^\.planning/'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done
```

```bash
# scope sizes, for context
$ git ls-files | wc -l
1404
$ git ls-files | grep -vc '^\.planning/'
376
```

**Clause (a) splits into three measured sub-populations, and the split is itself a finding:**

| Sub-clause | Definition | Count | Command |
|---|---|---|---|
| **(a1)** | tracked, outside `.planning/`, **content** carries the literal | **35 files** | the loop above, `grep -aq` |
| **(a2)** | tracked, outside `.planning/`, the literal is in the **path only**, not the content | **2 files** | byte scan of §0.3 over path *and* content, minus (a1) |
| **(a3)** | shipped-but-untracked `installer/**` paths (`packFiles()`) carrying the literal | **4 files** | `packFiles(join(ROOT,"installer")).files`, filtered |

**(a1) + (a2) = 37 files**, and **37 is the cardinality of the gate's own predicate**, because
`subjectHits(relPath, text)` scans *"BOTH the file's path and its text"* and emits the sentinel `0`
for a path occurrence (`check-no-regenerator2000.mjs`, `subjectHits()`). The plan's clause-(a) command
is content-only and yields **35**; the plan's published figure of 35 therefore reconciles exactly under
the content-only definition, and the gate's own predicate reaches **two more files**:

- `scripts/check-no-regenerator2000.mjs` — the gate itself. Its **content** carries **0** occurrences
  (it composes `SUBJECT_NEEDLE = "regenerator" + "2000"` at module scope specifically so that *"this
  file's own source never carries the literal contiguously"*). Its **path** carries 1.
- `scripts/check-no-regenerator2000.d.mts` — its ambient type declaration. Same shape: 0 in content,
  1 in the path.

Both are pinned at exactly 1 by the `gate-self` exemption class, which is why the gate's reported
`gate-self 5` covers five paths at one occurrence each. **Both get rows below**, because `D-09` asks
whether we looked, and a file the gate itself counts is a file we must be able to say we looked at.
Confirming the direction of the discrepancy:

```bash
$ grep -ac 'regenerator2000' scripts/check-no-regenerator2000.mjs
0
```

### Clause (b) — the named living documents ROADMAP criterion 2 lists that clause (a) cannot reach

`.planning/ROADMAP.md` § Phase 32 criterion 2 names *"install documentation, `CLAUDE.md`'s
regenerator2000 constraint bullets and its `r2000_*` clause, `PROJECT.md`'s constraints and Key
Decisions rows … `ARCHITECTURE.md`'s Rule A21, `THIRD-PARTY-NOTICES.md`'s dual-licence notice — which
**remains true** for the retained prose — and all seven skill playbooks"*. Four of those live under
`.planning/`, which clause (a) excludes by prefix, and `CLAUDE.md` carries zero occurrences so clause
(a) never reaches it either:

```
.planning/PROJECT.md
.planning/ARCHITECTURE.md
.planning/ROADMAP.md
.planning/REQUIREMENTS.md
CLAUDE.md
```

**5 files, enumerated by name rather than derived** — that is deliberate: this clause exists precisely
because no predicate reaches them.

### Clause (c) — all seven skill playbooks, mentions or not

```bash
$ git ls-files | grep -E '^src/skills/[^/]+/SKILL\.md$'
src/skills/acme-build/SKILL.md
src/skills/c64-memory-mapping/SKILL.md
src/skills/c64-program-recon/SKILL.md
src/skills/c64-provenance-diff/SKILL.md
src/skills/c64-ram-capture/SKILL.md
src/skills/routine-queue-walker/SKILL.md
src/skills/vice-wedge-triage/SKILL.md
```

**7 files.** ROADMAP criterion 2 names them as a *set*, so a playbook with zero mentions still owes a
"we looked" row. Four of the seven carry zero occurrences and are in the set only through this clause.

### Deduplication — applied, and stated

**Duplicates across clauses were collapsed to exactly one row per repo-relative path.** The
overlapping members are the three playbooks that qualify under both (a1) and (c):

- `src/skills/c64-memory-mapping/SKILL.md` — (a1) + (c)
- `src/skills/c64-program-recon/SKILL.md` — (a1) + (c)
- `src/skills/routine-queue-walker/SKILL.md` — (a1) + (c)

Clause (b) overlaps nothing: four of its five members sit under the `.planning/` prefix clause (a)
excludes, and the fifth (`CLAUDE.md`) carries zero occurrences.

```
raw sum      (a1) 35 + (a2) 2 + (a3) 4 + (b) 5 + (c) 7  =  53
overlaps                                    (a1) ∩ (c)  =  −3
─────────────────────────────────────────────────────────────
deduplicated swept set                                  =  50 rows
```

**The table in §2 has exactly 50 rows and no path appears twice.**

---

## 2. The verdict table — one row per swept file

**Verdict column semantics.** The verdict is **derived, never narrated**:

- `unchanged` ⇔ `git diff --exit-code d6bebb1 HEAD -- <path>` **exits 0** (bytes identical to the
  pre-sweep tree).
- `corrected` ⇔ the same command **exits non-zero**.

A document read closely and left alone is `unchanged`, however carefully it was read. Conversely, a
file whose bytes moved is `corrected` **even when the change was not a `CUT-06` pointer repair** — three
of the five `corrected` rows are exactly that case, and the *Changed by* column says so rather than
letting the verdict imply a correction that did not happen. Keeping the verdict mechanical and the
attribution separate is what makes the column checkable.

The four `installer/skills/**` rows are gitignored (`.gitignore:43:/installer/skills/`), so
`git diff` is structurally silent on them and cannot be the derivation. Their verdict is derived
instead from byte-comparison against the `src/skills/**` source they are generated from — see §4.

**`hits` column** = OCCURRENCES of the literal, path + content, byte-level (§0.3), which is the unit
the gate's pins use. **`lines`** = LINES of content containing it.

### Clause (a1) — the 35 tracked non-`.planning` files whose content carries the literal

| # | Path | hits | lines | `D-08` class | Verdict | Changed by | Gate exemption class + pin |
|---|---|---|---|---|---|---|---|
| 1 | `.github/workflows/ci.yml` | 1 | 1 | infra | unchanged | — | `gate-self`, pinned **1** (the step name) |
| 2 | `README.md` | 2 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **2** (one line: the attribution link's URL + link text) |
| 3 | `THIRD-PARTY-NOTICES.md` | 3 | 3 | 2 | unchanged | — | `notices-attribution-blocks`, BLOCK-scoped (no per-file exact pin; class total **27**) |
| 4 | `docs/phase23-real-release-gate-findings.md` | 3 | 2 | 1 | unchanged | — | `findings-docs`, pinned **3** |
| 5 | `docs/phase9-regenerator2000-probe-findings.md` | 44 | 41 | 1 | unchanged | — | `findings-docs`, pinned **44** — 43 in content + **1 in the filename** |
| 6 | `docs/stock-vice-parity.md` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 7 | `installer/THIRD-PARTY-NOTICES.md` | 7 | 7 | 2 | unchanged | — | `notices-attribution-blocks`, BLOCK-scoped |
| 8 | `scripts/check-npm-packages.mjs` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 9 | `scripts/check-skill-fork-honesty.mjs` | 2 | 2 | 2 | **corrected** | plan **32-02** (`029e5ca`) — a contained `--root` was added; **not** a `CUT-06` edit. Both occurrences byte-identical; count unmoved at 2 | `attribution-guard-test`, pinned **2** (required-string entry + the header note recording `CUT-05`'s re-pointing) |
| 10 | `scripts/lib/skill-descriptions.mjs` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 11 | `src/mcp/vice/THIRD-PARTY-NOTICES.md` | 17 | 16 | 2 | unchanged | — | `notices-attribution-blocks`, BLOCK-scoped |
| 12 | `src/mcp/vice/absorbed-answer-key.test.ts` | 2 | 2 | 1 | unchanged | — | `renamed-guard-disciplines`, pinned **2** (founding incident; second leg of the do-not-archive-phase-directories decision) |
| 13 | `src/mcp/vice/acme-gate.ts` | 4 | 4 | 2 | unchanged | — | `surviving-provenance`, pinned **4** |
| 14 | `src/mcp/vice/anno-acme-ident.ts` | 1 | 1 | 1 | unchanged | — | `enum-name-threat-history`, **line-scoped** `atLines: [68]` |
| 15 | `src/mcp/vice/anno-coverage.test.ts` | 1 | 1 | 1 | unchanged | — | `census-design-and-incident-records`, **line-scoped** `atLines: [1557]` |
| 16 | `src/mcp/vice/anno-coverage.ts` | 2 | 2 | 1 | unchanged | — | `census-design-and-incident-records`, **line-scoped** `atLines: [9, 1753]` |
| 17 | `src/mcp/vice/anno-derivation.test.ts` | 3 | 3 | 2 | unchanged | — | `upstream-audit-manifest-provenance`, pinned **3** |
| 18 | `src/mcp/vice/anno-memmap-render.ts` | 1 | 1 | 1 | unchanged | — | `memmap-measurement-provenance`, pinned **1** *and* line-pinned `lines: [79]`. **The NUL-byte file** (§0.2) |
| 19 | `src/mcp/vice/disasm-roundtrip.test.ts` | 2 | 2 | 2 | unchanged | — | `surviving-provenance`, pinned **2** |
| 20 | `src/mcp/vice/docs-absorbed-decisions.test.ts` | 2 | 2 | 1 | unchanged | — | `renamed-guard-disciplines`, pinned **2** (upstream issue #42 — `D-36`'s named reversal trigger) |
| 21 | `src/mcp/vice/docs-dangling-refs.test.ts` | 3 | 3 | 2 | unchanged | — | `surviving-provenance`, pinned **3** |
| 22 | `src/mcp/vice/fixtures/README.md` | 1 | 1 | infra | unchanged | — | `gate-self`, pinned **1** |
| 23 | `src/mcp/vice/fixtures/planted-removal-fixture.md.txt` | 1 | 1 | infra | unchanged | — | `planted-fixtures`, **prefix**-scoped `src/mcp/vice/fixtures/planted-`, `prefixHits: 2` across the pair |
| 24 | `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` | 1 | 1 | infra | unchanged | — | `planted-fixtures`, same `prefixHits: 2` |
| 25 | `src/mcp/vice/prg-image.ts` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 26 | `src/mcp/vice/removal-gate.test.ts` | 1 | 1 | infra | unchanged | — | `gate-self`, pinned **1** |
| 27 | `src/mcp/vice/shipped-modules.ts` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 28 | `src/mcp/vice/skill-acme-build-cli.test.ts` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 29 | `src/mcp/vice/skill-attribution.test.ts` | 12 | 12 | 2 | unchanged | — | `attribution-guard-test`, pinned **12** |
| 30 | `src/mcp/vice/spawn-seam.test.ts` | 1 | 1 | 1 | unchanged | — | `renamed-guard-disciplines`, pinned **1** (re-measured 39→1 by plan 29-10 when the guard was re-pointed onto the emulator spawn seam) |
| 31 | `src/mcp/vice/stock-symbols.ts` | 6 | 6 | 2 | unchanged | — | `surviving-provenance`, pinned **6** |
| 32 | `src/skills/c64-memory-mapping/SKILL.md` | 5 | 5 | 2 | unchanged | — | `skill-attribution-headers`, BLOCK-scoped on the `ATTRIBUTION (ABS-02)` marker, `{ blocks: 2, hits: 5 }` |
| 33 | `src/skills/c64-program-recon/SKILL.md` | 4 | 4 | 2 | unchanged | — | `skill-attribution-headers`, `{ blocks: 2, hits: 4 }` |
| 34 | `src/skills/c64-program-recon/scripts/packer-finding.mjs` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** (dated past-tense provenance) |
| 35 | `src/skills/routine-queue-walker/SKILL.md` | 3 | 3 | 2 | unchanged | — | `skill-attribution-headers`, `{ blocks: 1, hits: 3 }` |

### Clause (a2) — the 2 files the gate's path-scanning predicate reaches and a content grep does not

| # | Path | hits | lines | `D-08` class | Verdict | Changed by | Gate exemption class + pin |
|---|---|---|---|---|---|---|---|
| 36 | `scripts/check-no-regenerator2000.mjs` | 1 (path) | 0 | infra | **corrected** | plan **32-03** (`c81d2ee`) — rule 4's stale NUL offset and pre-deletion tree-wide totals re-measured. **Comment-only**; content occurrences stayed at 0, so no pin could move | `gate-self`, pinned **1** — satisfied by the filename alone |
| 37 | `scripts/check-no-regenerator2000.d.mts` | 1 (path) | 0 | infra | unchanged | — | `gate-self`, pinned **1** — filename only |

### Clause (a3) — the 4 shipped-but-untracked `installer/**` twins

Verdict derived by byte-comparison against the generated-from source, not by `git diff` (§4).

| # | Path | hits | lines | `D-08` class | Verdict | Changed by | Gate exemption class + pin |
|---|---|---|---|---|---|---|---|
| 38 | `installer/skills/c64-memory-mapping/SKILL.md` | 5 | 5 | 2 | unchanged | — (byte-identical to its source) | `skill-attribution-headers`, `{ blocks: 2, hits: 5 }` |
| 39 | `installer/skills/c64-program-recon/SKILL.md` | 4 | 4 | 2 | unchanged | — | `skill-attribution-headers`, `{ blocks: 2, hits: 4 }` |
| 40 | `installer/skills/c64-program-recon/scripts/packer-finding.mjs` | 1 | 1 | 2 | unchanged | — | `surviving-provenance`, pinned **1** |
| 41 | `installer/skills/routine-queue-walker/SKILL.md` | 3 | 3 | 2 | unchanged | — | `skill-attribution-headers`, `{ blocks: 1, hits: 3 }` |

### Clause (b) — the 5 named living documents

`.planning/` is excluded from the removal gate by **prefix**, so no row here has a gate pin. That is
also why `CUT-06`'s *corrective* work could be confined to `.planning/` without touching any exact
count.

| # | Path | hits | lines | `r2000_` (occ / lines) | `D-08` class | Verdict | Changed by |
|---|---|---|---|---|---|---|---|
| 42 | `.planning/PROJECT.md` | 51 | 46 | 22 / 16 | 3 (was) → corrected | **corrected** | plan **32-03** (`11abb71`): `:311`'s four `vice-proxy.ts` citations un-staled by `+2` and the deleted `r2000_*` family replaced with the surviving `anno_*` one; `:396`'s `D-36` Outcome cell re-pointed at a guard file that exists. Subject-literal count **unmoved** at 51 occurrences / 46 lines; `r2000_` moved 23→22 occurrences, 17→16 lines, which is the one corrected pointer leaving. See §3 |
| 43 | `.planning/ARCHITECTURE.md` | 11 | 11 | 7 / 7 | 3 (was) → corrected | **corrected** | plan **32-03** (`5ff2311`): Rule A21 converted from a present-tense invariant about a deleted module into a dated, superseded record. Heading and rule number preserved; all five citations intact; subject count **unmoved** at 11 / 11 |
| 44 | `.planning/ROADMAP.md` | 24 | 23 | 10 / 10 | 1 | **corrected** | **Not a `CUT-06` edit.** Orchestrator progress bookkeeping only (`2eaa136`, `19b2c5c`): three plan checkboxes `[ ]`→`[x]`, `**Plans**: 9 plans`→`3/9 plans executed`, and the Phase 32 progress row `— / Not started`→`3/9 / In Progress`. The full diff (`git diff d6bebb1 HEAD -- .planning/ROADMAP.md`) contains **no change to any sentence naming the subject**; criterion 2's prose is byte-identical. Both counts unmoved (24 / 23, 10 / 10) |
| 45 | `.planning/REQUIREMENTS.md` | 13 | 12 | 7 / 7 | 1 | unchanged | — Deliberately untouched: `CUT-06` is declared by six plans in this phase, so it may not read `Complete` until the last one summarises (recorded by plan 32-03) |
| 46 | `CLAUDE.md` | **0** | **0** | **0 / 0** | n/a | unchanged | — Already clean; `D-11` settled. See §5 |

### Clause (c) — the 3 remaining playbooks with zero mentions, plus `acme-build`

The four playbooks in the set **only** through clause (c). Each carries **0 occurrences / 0 lines** of
the subject literal and **0 occurrences of `r2000_`**, so none is reachable by clause (a) and none
carries a gate pin. They are here because ROADMAP criterion 2 names the seven playbooks as a set, and
"we looked and there is nothing" must be distinguishable from "we never looked".

| # | Path | hits | lines | `r2000_` occ | Verdict | Changed by |
|---|---|---|---|---|---|---|
| 47 | `src/skills/acme-build/SKILL.md` | 0 | 0 | 0 | unchanged | — |
| 48 | `src/skills/c64-provenance-diff/SKILL.md` | 0 | 0 | 0 | unchanged | — |
| 49 | `src/skills/c64-ram-capture/SKILL.md` | 0 | 0 | 0 | unchanged | — |
| 50 | `src/skills/vice-wedge-triage/SKILL.md` | 0 | 0 | 0 | unchanged | — |

### Roll-up

```
rows                     50   (= deduplicated swept-set size, §1)
unchanged                45
corrected                 5   (.planning/PROJECT.md, .planning/ARCHITECTURE.md, .planning/ROADMAP.md,
                               scripts/check-no-regenerator2000.mjs, scripts/check-skill-fork-honesty.mjs)
  of those, CUT-06 pointer corrections   3   (PROJECT.md, ARCHITECTURE.md, and the gate's own stale header)
  of those, changed for other reasons    2   (ROADMAP.md bookkeeping; check-skill-fork-honesty.mjs's --root)
occurrence counts moved   0   in every clause-(a) file -- see §6
```

**All seven `src/skills/*/SKILL.md` playbooks have a row** (rows 32, 33, 35, 47–50).

---

## 3. `.planning/PROJECT.md` — the `r2000_` per-line roll-up, including `:715`

Plan 32-03 adjudicated all **17 lines** carrying `r2000_` in `.planning/PROJECT.md` at the pre-sweep
tree and recorded **15 keep / 2 correct**, with the deciding `D-08` clause written down for each. That
table is the primary record (`32-03-SUMMARY.md` § *The `r2000_` adjudication ledger*); it is rolled up
here rather than re-derived.

Re-measured for this ledger, both units, both trees:

```bash
$ git show d6bebb1:.planning/PROJECT.md | grep -ac 'r2000_'            # pre-sweep, LINES
17
$ git show d6bebb1:.planning/PROJECT.md | grep -ao 'r2000_' | wc -l    # pre-sweep, OCCURRENCES
23
$ grep -ac 'r2000_' .planning/PROJECT.md                               # post-sweep, LINES
16
$ grep -ao 'r2000_' .planning/PROJECT.md | wc -l                       # post-sweep, OCCURRENCES
22
```

Both reproduce plan 32-03's figures exactly: 17 lines / 23 occurrences before, 16 / 22 after. The
single line that left is `:311`, the one live pointer.

| Verdict | Lines | Where recorded |
|---|---|---|
| `correct` | 2 — `:311` (live pointer at the deleted `r2000_*` family, replaced with `anno_*`), `:396` (`D-36` Outcome cell's pointer at a guard filename not on disk) | `32-03-SUMMARY.md`, commit `11abb71` |
| `keep` | 15, of which 3 carry a recorded ambiguity (`:143`, `:668`, `:715`) | `32-03-SUMMARY.md` |

### 3.1 `.planning/PROJECT.md:715` — explicit verdict, reasoned here

Plan 32-03 flagged this line by name for this plan as its closest call. It gets its own verdict rather
than a silent inheritance, and rather than a silent reversal.

**The text** (`.planning/PROJECT.md:714-716`, read this session):

> The prose is therefore already this project's. What is **not** already this project's is the route
> underneath it: every absorbed step **is written against `r2000_*` tool calls**. Deleting the tool
> surface without re-pointing them leaves the knowledge intact and the procedure inert — which is the
> failure this milestone's skill half exists to prevent.

**Verdict: `keep` / `unchanged`. Ambiguity recorded, and it is real.**

The case *for* correcting it, stated plainly so a later reader can weigh it rather than take my word:
the clause is **present tense**, and as a statement about today's tree it is now **false**. Measured
this session:

```bash
$ grep -aco 'r2000_' src/skills/*/SKILL.md
src/skills/acme-build/SKILL.md:0
src/skills/c64-memory-mapping/SKILL.md:0
src/skills/c64-program-recon/SKILL.md:0
src/skills/c64-provenance-diff/SKILL.md:0
src/skills/c64-ram-capture/SKILL.md:0
src/skills/routine-queue-walker/SKILL.md:0
src/skills/vice-wedge-triage/SKILL.md:0
```

Zero `r2000_` occurrences across all seven playbooks: phases 29 and 31 re-pointed every one. So "every
absorbed step is written against `r2000_*` tool calls" describes a tree that no longer exists.

The case *for* keeping it, which decides the verdict:

1. **`D-08`'s test is not "is it true today", it is "does it route a reader at a deleted surface".**
   The clause asserts something about what the *skill prose contained*; it names no tool to call, no
   package to install, and no command to run. Nothing follows from reading it. A reader cannot be
   mis-routed by it.
2. **Its scope marker is two lines below, not absent.** The next paragraph opens *"Measured at the
   v0.7.0 open: **82 tool names and 13 CLI verbs across five files**"*. The block is explicitly a
   v0.7.0-open measurement, and this sentence is the measurement's subject.
3. **The surrounding sentences only parse pre-deletion.** The very next clause — *"Deleting the tool
   surface without re-pointing them leaves the knowledge intact and the procedure inert"* — is
   conditional on a deletion that had not yet happened, and the one after names this as *"the failure
   this milestone's skill half exists to prevent"*. Correcting the tense of the middle clause alone
   would leave a paragraph that contradicts itself: a present-tense report of a solved state wedged
   between two sentences describing the problem that motivated solving it.
4. **It is the recorded motivation for phases 29 and 31.** This sentence is *why* the re-pointing work
   was commissioned. Rewriting it to describe the post-re-pointing tree deletes the reason the tree
   changed — which is exactly the move `D-08` calls destroying evidence rather than tidying it.

**Where I differ from a silent inheritance:** plan 32-03 resolved this to `keep` on the tie-break
"present tense inside a dated block". I reach the same verdict on the stronger ground that the
sentence *routes nobody*, and I additionally record the measurement that makes it stale — the seven
zeros above — so a later reader is not left to rediscover it.

**Recommended remedy, deliberately not applied here.** If a later plan wants present-tense accuracy,
the correct edit is **additive**: append a dated clause such as "(re-pointed to `anno_*` by phases 29
and 31; zero `r2000_` occurrences remain in the playbooks as of 2026-08-31)" *after* the existing
sentence, leaving the original byte-identical. This plan does not make that edit for two independent
reasons, both recorded rather than assumed: (i) plan 32-05's declared `files_modified` is exactly this
ledger, so editing `.planning/PROJECT.md` would be an out-of-scope write from a parallel worktree
executor while another executor is live; and (ii) `CUT-06` corrects *routes*, and the tense of a
motivating claim is not a route. An ambiguity recorded is a decision; an ambiguity resolved by silent
editing is evidence destroyed.

---

## 4. The shipped-twin duplication, and the obligation it creates

`installer/skills/**` is **gitignored** —

```bash
$ git check-ignore -v installer/skills/c64-memory-mapping/SKILL.md
.gitignore:43:/installer/skills/	installer/skills/c64-memory-mapping/SKILL.md
```

— but it is **inside the removal gate's scan scope**, because `scopeSet()` unions `trackedFiles()`
with `shippedInstallerFiles()`, which is `packFiles(join(ROOT, "installer")).files`. The gate reports
this explicitly on every successful run:

```
check-no-<subject>: OK -- scanned 406 files (376 tracked outside ".planning/" + 30 shipped-but-untracked
installer paths, floor 350); 157 occurrence(s) permanently exempt, 0 temporarily allow-listed across 0 entries.
```

The gate pins the twins in the same breath as the sources:
`surviving-provenance` carries `"installer/skills/c64-program-recon/scripts/packer-finding.mjs": 1`
alongside its `src/skills/**` original, and `SKILL_ATTRIBUTION_PINS` carries all three shipped
`SKILL.md` twins at exactly the same `{ blocks, hits }` as their sources
(`{2,5}`, `{2,4}`, `{1,3}`).

**Verdict derivation for the four twin rows.** `git diff` is structurally silent on a gitignored path,
so it cannot produce their verdict. Instead: they are generated wholesale from `src/skills/**` by
`sync-skills.mjs`, so their verdict *follows* their source's. Confirmed by byte-comparison rather than
assumed:

```bash
$ cmp src/skills/c64-memory-mapping/SKILL.md            installer/skills/c64-memory-mapping/SKILL.md
$ cmp src/skills/c64-program-recon/SKILL.md             installer/skills/c64-program-recon/SKILL.md
$ cmp src/skills/routine-queue-walker/SKILL.md          installer/skills/routine-queue-walker/SKILL.md
$ cmp src/skills/c64-program-recon/scripts/packer-finding.mjs \
      installer/skills/c64-program-recon/scripts/packer-finding.mjs
```

All four exit 0 with no output — byte-identical. Their sources are `unchanged` (rows 32–35), therefore
so are they.

### 4.1 The obligation for the next plan that DOES edit a playbook

**This plan edits no playbook.** It is stated anyway, because the next reader who does needs it:

> **Every edit to a `src/skills/*/SKILL.md` must be followed by a shipped-tree regeneration before the
> removal gate is re-run.** Otherwise the gate scores a stale twin and either reds against a count
> that has already moved, or — worse — passes on a tree that no longer matches what ships.

`.github/workflows/ci.yml:126-128` does exactly this, immediately before the test step:

```yaml
      - name: Generate the shipped skills tree (scored by skill-attribution.test.ts)
        working-directory: installer
        run: node scripts/sync-skills.mjs
```

Locally the equivalent is `node installer/scripts/sync-skills.mjs`. **Note also that the gate
regenerates the tree as a side effect all by itself**: `packFiles()` shells out to `npm pack
--dry-run`, whose `prepack` hook runs `sync-skills.mjs`. Observed this session on the very first gate
invocation, before any explicit sync:

```
> @henols/c64-re-tools@0.0.0-dev prepack
> node scripts/sync-skills.mjs
sync-skills: copied 7 skill(s) into <worktree>/installer/skills: acme-build, c64-memory-mapping,
  c64-program-recon, c64-provenance-diff, c64-ram-capture, routine-queue-walker, vice-wedge-triage
sync-skills: excluded 6 non-shipping entries (test files, fixtures/, test-corpus.mjs)
```

That side effect is convenient but must not be relied on as the contract — the CI step exists because
a gate that silently regenerates its own inputs is one refactor away from scoring one tree and
reporting on two. The generated tree is gitignored, so it does not dirty the working tree:
`git status --porcelain` is empty after the run.

---

## 5. `CLAUDE.md` and `ARCHITECTURE.md` — `D-11` confirmed, not re-derived

`D-11` is **settled**: *"`CLAUDE.md` is already clean and needs no work … A planner must not re-derive
this as outstanding."* This ledger records the evidence without reopening the decision.

```bash
$ grep -ac 'regenerator2000' CLAUDE.md
0
$ grep -ac 'r2000_' CLAUDE.md
0
```

**0 lines and 0 occurrences of each** — and the same at the pre-sweep tree (`d6bebb1`), so nothing
about `CLAUDE.md` moved during this phase. Row 46 records it as `unchanged` with a measured 0, which is
the "we looked and it is fine" state `D-09` asks for — **not** as an outstanding item.

There is **no `ARCHITECTURE.md` outside `.planning/`**:

```bash
$ git ls-files | grep -i 'ARCHITECTURE\.md'
.planning/ARCHITECTURE.md
.planning/codebase/ARCHITECTURE.md
.planning/research/ARCHITECTURE.md
.planning/research/archive-v0.6.0/ARCHITECTURE.md
$ git ls-files | grep -ic 'ARCHITECTURE\.md'
4
```

Four copies, all under `.planning/`. Full inventory in §B.5.

---

## 6. The sweep changed nothing it should not have

### 6.1 The removal gate exits 0

```bash
$ node scripts/check-no-regenerator2000.mjs ; echo "exit=$?"
check-no-<subject>: OK -- scanned 406 files (376 tracked outside ".planning/" + 30 shipped-but-untracked
installer paths, floor 350); 157 occurrence(s) permanently exempt, 0 temporarily allow-listed across 0 entries.
  permanent exemptions (exact pins):
    gate-self                            5
    findings-docs                        47
    attribution-guard-test               14
    upstream-audit-manifest-provenance   3
    memmap-measurement-provenance        1
    enum-name-threat-history             1
    census-design-and-incident-records   3
    renamed-guard-disciplines            5
    surviving-provenance                 25
    skill-attribution-headers            24
    planted-fixtures                     2
    notices-attribution-blocks           27
exit=0
```

The twelve class totals reconcile against the per-file pins in §2 without a residual:
`gate-self` 1+1+1+1+1 = 5; `findings-docs` 44+3 = 47; `attribution-guard-test` 12+2 = 14;
`renamed-guard-disciplines` 1+2+2 = 5; `census-design-and-incident-records` 2+1 = 3;
`surviving-provenance` 2+1+1+1+1+1+4+2+3+1+1+1+6 = 25;
`skill-attribution-headers` (5+4+3) source + (5+4+3) shipped = 24;
`notices-attribution-blocks` 3+17+7 = 27. Sum = **157**, the reported total.

### 6.2 Every clause-(a) occurrence count is identical to its pre-sweep value

Measured for all 37 clause-(a1)+(a2) paths by reading each file at `d6bebb1` (`git show
d6bebb1:<path>`) and at `HEAD`, and comparing path+content occurrence totals:

```
files compared                    37
counts that moved                  0
```

The five `corrected` rows are the interesting cases, and all five held:

| Path | pre-sweep occ | post-sweep occ | moved? |
|---|---|---|---|
| `scripts/check-no-regenerator2000.mjs` | 1 (path only) | 1 (path only) | no — comment-only edit |
| `scripts/check-skill-fork-honesty.mjs` | 2 | 2 | no — `--root` added around them |
| `.planning/PROJECT.md` | 51 | 51 | no (subject literal); `r2000_` 23→22 |
| `.planning/ARCHITECTURE.md` | 11 | 11 | no |
| `.planning/ROADMAP.md` | 24 | 24 | no |

`.planning/**` carries no gate pin at all (prefix-excluded), so the three `.planning` rows could not
have moved one; the two `scripts/` rows could have, and did not.

**Why this matters, in the gate's own words:** every exemption count is asserted with `===`, so *any*
edit to one of these files that changes its occurrence count reds the gate. That is what makes this
sweep verdict-recording rather than editing. The rule for the plan that does eventually need an edit is
the gate's own: *"a mention that moved moves its pin in the same commit, a mention that multiplied does
not."*

### 6.3 The working tree is clean and the audit gate is green

```bash
$ git status --porcelain
                       # empty

$ node scripts/audit-gate.mjs --json | head -c 60
{"allowed":true,"redGuards":[],"gatedAudits":[{"file":"...
```

`allowed: true`, `redGuards: []`, `structuralErrors: []`, nine derived docs guards.

### 6.4 The automated test suite

```bash
$ cd src/mcp/vice && npm run test:automated
# tests 2941 | suites 24 | pass 2934 | fail 1 | skipped 1 | todo 5 | duration_ms 47335
```

**One failure, and it is the recorded worktree artifact, not a regression:**

```
not ok 1472 - path agreement (D-3, D-6, THE regression this task exists to catch): the launcher's own
  repo_root (resources/ and tools/ copies) agrees with Node's supervisorDir()/dirname(EPOCH_FILE),
  and the agreed path is not under .claude
  location: src/mcp/vice/repo-root.test.ts:178:1
  error: 'the agreed directory must not sit under .claude -- got
    <worktree>/.vice-supervisor'
```

`repo-root.test.ts:248-251` asserts `!supervisorDir().includes(".claude")`, and a GSD worktree root
**is** `<repo>/.claude/worktrees/agent-*`. It fails inside every GSD worktree and only inside one;
plan 32-01 measured, attributed and recorded it in this phase's `deferred-items.md` § 1, and plan
32-03 hit exactly the same single failure. **The expected floor in the main checkout is 0.** This plan
touches no source file at all, so it cannot have caused it; the assertion was **not** loosened and the
test was **not** skipped. No VICE broker was running during the run, so the BACK-05 broker-reddening
artifact does not apply either.

`npm ci --no-audit --no-fund` was run once from the committed lockfile before the suite (the worktree
had no `node_modules/`); 237 packages, nothing new resolved.

### 6.5 The plan's own `<automated>` command, re-anchored and run

The plan's task-1 command with `/home/henrik/dev/henrik/git/c64-re-tools` replaced by the worktree
root (§0), run verbatim:

```bash
cd "$WT_ROOT" \
  && N=$(for f in $(git ls-files | grep -v '^\.planning/'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done | wc -l) \
  && echo "N=$N" && test "$N" -eq 35 \
  && node scripts/check-no-regenerator2000.mjs >/dev/null \
  && grep -c 'grep -a' .planning/phases/32-the-deletion-and-the-grep-gate/evidence/32-document-sweep.md
```

Output: `N=35`, gate silent (exit 0), and a non-zero `grep -a` occurrence count in this file. The
assertion `N -eq 35` holds **as measured in this worktree**, not inherited from the plan.

---

## Section A — the discussion-time numbers, re-measured

`32-CONTEXT.md`'s `<specifics>` offered six measurements *"for the researcher to re-verify rather than
trust"*. Every one was re-run in this worktree. **No figure below is copied from `32-CONTEXT.md` or
`32-RESEARCH.md`.** Where a figure moved, the tree it was measured against is named — most of these
were taken before phase 32's own commits landed, so "the same number today" is the wrong test.

| # | `32-CONTEXT.md` said | Re-measured | Unit | Verdict |
|---|---|---|---|---|
| A1 | 35 tracked non-`.planning` files contain the literal | **35** (with `-a`) / **34** (without) | FILES | ✅ **reconciles** — but only with `-a` |
| A2 | `.planning/PROJECT.md` has 46 mentions | **46 lines / 51 occurrences** | both | ✅ **reconciles**, as LINES |
| A3 | `.planning/PROJECT.md` has 26 `r2000_` occurrences | **26** case-insensitive occurrences at the pre-sweep tree | OCCURRENCES, case-insensitive | ✅ **reconciles** — see A3.1; this **overturns** the research prediction |
| A4 | `CLAUDE.md` has 0 and 0 | **0 and 0** | LINES and OCCURRENCES | ✅ **reconciles** (`D-11` confirmed) |
| A5 | no `ARCHITECTURE.md` outside `.planning/` | **none**; 4 copies, all inside | FILES | ✅ **reconciles** |
| A6 | 126 `*.test.*` files in `src/mcp/vice/` | **126** at the phase base, **127** at HEAD | FILES | ✅ **reconciles** at the tree it was measured against |
| A7 | *(research, not CONTEXT)* 373 tracked files carry the literal; 338 of them under `.planning/` | **374 / 339** at `12a3a47`; **376 / 341** at `345d5c4` | FILES | ❌ **does not reproduce** — see A7.1 |

### A1 — the 35, and the NUL trap

```bash
$ N=$(for f in $(git ls-files | grep -v '^\.planning/'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done | wc -l); echo "$N"
35
$ N=$(for f in $(git ls-files | grep -v '^\.planning/'); do grep -q  'regenerator2000' "$f" && echo "$f"; done | wc -l); echo "$N"
34
```

Unit: FILES containing at least one occurrence in their **content**. Reconciles exactly with `-a`.
Without `-a` the answer is 34, and the missing file is `src/mcp/vice/anno-memmap-render.ts` — NUL at
offset 15097, line 315. Full derivation in §0.2. Under the gate's own path-*and*-content predicate the
answer is **37**; see §1, sub-clause (a2).

### A2 — `.planning/PROJECT.md`, the subject literal

```bash
$ grep -ac 'regenerator2000' .planning/PROJECT.md          # LINES
46
$ grep -ao 'regenerator2000' .planning/PROJECT.md | wc -l  # OCCURRENCES
51
```

`32-CONTEXT.md`'s "46 mentions" is the **LINES** figure. Both are recorded so a later reader picking
either definition lands on a number this document already published. Unmoved from the pre-sweep tree
(`git show d6bebb1:.planning/PROJECT.md` gives the same 46 / 51), because plan 32-03's `:311` edit
replaced an `r2000_*` token, not a subject-literal one.

### A3 — `r2000_`: **CONTEXT.md's 26 reproduces exactly, and research's prediction was wrong**

`32-RESEARCH.md` §5.1 recorded this figure as **disagreeing** — *"Measured 17 lines and 23
occurrences; neither counting definition yields 26"* — and `32-05-PLAN.md` instructed this ledger to
record it as a disagreement with a delta of 3, listing three unconfirmed hypotheses. **Measurement
contradicts the plan, so the measurement is what is recorded.** Research's own *first* hypothesis —
*"the discussion-time figure counted `r2000_` case-insensitively plus `R2000_`"* — is **confirmed**,
and it accounts for the delta exactly.

The full grid, both cases × both units × both trees:

| Tree | case-sensitive lines | case-sensitive occurrences | case-**in**sensitive lines | case-**in**sensitive occurrences |
|---|---|---|---|---|
| pre-sweep `d6bebb1` | 17 | 23 | 20 | **26** ← `32-CONTEXT.md`'s figure |
| HEAD `19b2c5c` | 16 | 22 | 19 | 25 |

```bash
$ git show d6bebb1:.planning/PROJECT.md | grep -ac  'r2000_'            # 17  (cs, LINES)
$ git show d6bebb1:.planning/PROJECT.md | grep -ao  'r2000_' | wc -l    # 23  (cs, OCCURRENCES)
$ git show d6bebb1:.planning/PROJECT.md | grep -aci 'r2000_'            # 20  (ci, LINES)
$ git show d6bebb1:.planning/PROJECT.md | grep -aoi 'r2000_' | wc -l    # 26  (ci, OCCURRENCES)  <-- exact
```

The three extra occurrences are uppercase, and they are identifier names rather than tool names:

```bash
$ git show d6bebb1:.planning/PROJECT.md | grep -aoi 'r2000_' | sort | uniq -c
     23 r2000_
      3 R2000_
$ grep -an 'R2000_' .planning/PROJECT.md
748:  `R2000_TOOL_DEFINITIONS`, so renaming the collection matches nothing, hits a
751:  `check-skill-tool-coverage.mjs:49` statically imports `CURATED_R2000_TOOLS`
753:  itself goes red on three tests, one via a hard-coded `R2000_MODULE_FLOOR = 14`
```

**23 + 3 = 26.** `R2000_TOOL_DEFINITIONS`, `CURATED_R2000_TOOLS` and `R2000_MODULE_FLOOR` are
SCREAMING_SNAKE_CASE symbol names, which is exactly this repo's constant-naming convention, so a
case-insensitive count is not a sloppy count — it is the count that sees all the symbols. It is also
the count **this project's own gate** takes: `subjectHits()` builds its matcher with
`new RegExp(SUBJECT_NEEDLE, "gi")` — the `i` flag — so case-insensitive occurrences is the gate's
native definition, not an exotic one.

**Working figures, stated once:**

- For *prose adjudication* (which lines tell a reader to invoke a deleted tool — the `D-08` question),
  the working figure is **23 case-sensitive occurrences over 17 lines** at the pre-sweep tree. That is
  the population plan 32-03 adjudicated line-by-line, and all 17 lines carry a recorded verdict (§3).
  The three uppercase symbols are not tool-call routes; they are names of code identifiers being
  discussed, so excluding them from the adjudication was correct.
- For *census reconciliation against `32-CONTEXT.md`*, the figure is **26 case-insensitive
  occurrences**, and it reconciles exactly.

**What this corrects.** `32-RESEARCH.md` §5.1's ❌ row and Open Question 5's "RESOLVED … recorded as
DISAGREEING" recommendation are both superseded by this measurement. Recording a reconciling figure as
a disagreement would have published a false discrepancy into the phase record — the same category of
error, in the opposite direction, that `D-09` exists to prevent. The three lines above are the
evidence; anyone can re-run the four `grep` invocations.

### A4 — `CLAUDE.md`

```bash
$ grep -ac 'regenerator2000' CLAUDE.md   # 0
$ grep -ac 'r2000_'          CLAUDE.md   # 0
```

**0 LINES and 0 OCCURRENCES of each**, at HEAD and at the pre-sweep tree alike. Recorded as
**confirming `D-11`** — *"`CLAUDE.md` is already clean and needs no work … A planner must not re-derive
this as outstanding"* — and explicitly **not** as reopening it. Row 46 of §2 carries the same fact as a
"we looked and it is fine" row.

### A5 — the four `ARCHITECTURE.md` copies

```bash
$ git ls-files | grep -i 'ARCHITECTURE\.md'
.planning/ARCHITECTURE.md
.planning/codebase/ARCHITECTURE.md
.planning/research/ARCHITECTURE.md
.planning/research/archive-v0.6.0/ARCHITECTURE.md
$ git ls-files | grep -ic 'ARCHITECTURE\.md'
4
```

**Four copies, all inside `.planning/`. None outside it** — `A5` reconciles. Which carry Rule A21:

| Path | `A21` (lines / occurrences) | subject literal (occurrences) | In the swept set? |
|---|---|---|---|
| `.planning/ARCHITECTURE.md` | 4 / 4 | 11 | **yes** — clause (b), row 43. `corrected` by plan 32-03 |
| `.planning/codebase/ARCHITECTURE.md` | 0 / 0 | 0 | no — generated codebase map, carries neither A21 nor the subject |
| `.planning/research/ARCHITECTURE.md` | 4 / 5 | 12 | no — excluded population, given a named row in §B.3 |
| `.planning/research/archive-v0.6.0/ARCHITECTURE.md` | 0 / 0 | 22 | no — excluded population, §B.3 |

```bash
$ grep -ac 'A21' .planning/ARCHITECTURE.md            # 4 LINES
$ grep -ac 'A21' .planning/research/ARCHITECTURE.md   # 4 LINES
```

**Two of the four carry A21**: `.planning/ARCHITECTURE.md` and `.planning/research/ARCHITECTURE.md`.
Note the unit trap again — the research copy has **4 lines but 5 occurrences** of `A21`; a
`grep -c`-derived "4" and an occurrence-derived "5" are both right and describe the same file.
`.planning/ARCHITECTURE.md`'s A21 count rose from 1 line to 4 when plan 32-03 converted the rule to a
dated superseded record (the conversion names the rule several times); the **heading and rule number
were deliberately preserved**, so `ROADMAP.md` § Phase 32 criterion 2's reference to "`ARCHITECTURE.md`'s
Rule A21" still resolves.

### A6 — `src/mcp/vice/*.test.*`

```bash
$ git ls-files 'src/mcp/vice/*.test.*' | wc -l                          # 127  (HEAD)
$ git ls-tree -r --name-only d6bebb1 src/mcp/vice | grep -c '\.test\.'  # 126  (phase base)
```

**126 reconciles exactly at the tree `32-CONTEXT.md` measured** (the phase base). HEAD is **127**; the
one added file is phase 32's own:

```bash
$ git diff --name-only --diff-filter=A d6bebb1 HEAD -- src/mcp/vice
src/mcp/vice/guard-fates.test.ts
```

created by plan 32-01 as the fate guard's colocated non-vacuity proof. `CUT-04`'s historical figure of
32 is a different set entirely and is reconciled in
`evidence/32-audited-set-reconciliation.md`, not here.

### A7 — research's own tree-wide totals do **not** reproduce

`32-RESEARCH.md` §5.1 published *"Total tracked files containing the literal (incl. `.planning/`):
**373**"* and §5.3 derived *"`.planning/` files with `regenerator2000`, total: **338** (373 tracked −
35 non-`.planning`)"*. Re-measured with the byte-level scanner (§0.3) at the two commits closest to
when research ran:

| Commit | What it is | tracked total | non-`.planning` matching | `.planning` matching | total matching |
|---|---|---|---|---|---|
| `12a3a47` | last commit **before** the research commit | 1378 | 35 | 339 | **374** |
| `345d5c4` | the research commit itself | 1380 | 35 | 341 | **376** |
| `d6bebb1` | phase base (pre-execution) | 1390 | 35 | 351 | **386** |
| `19b2c5c` | this ledger's measurement commit | 1404 | 35 | 356 | **391** |

**Neither 373 nor 338 reproduces at either candidate commit.** The nearest is 374 / 339 — off by
exactly 1. Recorded as a disagreement rather than smoothed over.

Hypotheses, explicitly **unconfirmed**: research may have measured against an uncommitted working tree
missing one file; or excluded one path (`.planning/notes/regenerator2000-integration.md` carries the
literal in its *path*, and a content-only scan that also skipped it would land on 338 — but a
path-only match does not exist here, since that file's content carries the literal too, so this
hypothesis does not fully account for it); or ran a slightly different scope predicate. **338 is in any
case a derived number, not a measured one** — research obtained it by subtracting 35 from 373 — so a
single error in 373 propagates. **The working figures for this ledger are the measured ones in the
table above**, and §B.1 uses them.

Two of these numbers are self-referential and it is worth saying so plainly: this ledger is itself a
file under `.planning/phases/**` that carries the literal, so committing it moves the `.planning`
matching count from 356 to **357** and the tracked total from 1404 to **1405**. The §B.1 figures are
measured **after** that commit; the §A7 figures are measured **at** `19b2c5c`, before it. Both are
correct at their stated commit, and neither is a discrepancy.

---

## Section B — the excluded populations, each an explicit row

`D-09` requires a later reader to distinguish *"we looked and it is fine"* from *"we never looked"*. An
excluded population that is simply absent from this document is indistinguishable from one nobody
considered. Every exclusion below therefore carries a **measured size** and a **stated reason**.

All counts are **FILES containing at least one occurrence**, produced with `grep -a`, measured at
commit `ab14671` (this ledger's own first commit — see the self-reference note in §A7).

### B.1 The measured shape of what was excluded

```bash
$ git ls-files | wc -l                    # 1405 tracked files
$ git ls-files '.planning/*' | wc -l      # 1029 under .planning/
# per-prefix: for f in $(git ls-files '<prefix>'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done | wc -l
```

| Population | Files carrying the literal | In the swept set? | Reason |
|---|---|---|---|
| `.planning/phases/**` | **311** | **no** (0 of 311) | §B.2 |
| `.planning/research/**` (incl. its archive) | **10** (5 + 5) | **no** (0 of 10) | §B.3 |
| `.planning/milestones/**` | **9** | no | §B.4 |
| `.planning/quick/**` | **7** | no | §B.4 |
| `.planning/todos/**` | **6** | no | §B.4, §B.6 |
| `.planning/notes/**` | **4** | no | §B.4 |
| `.planning/seeds/**` | **1** | no | §B.4 |
| `.planning/codebase/**` | **0** | no | §B.4 — measured zero, nothing to exclude |
| `.planning/` root documents | **9** | **partly — 4 of 9** | §B.5 |
| **`.planning/` total** | **357** | **4** | |
| tracked, outside `.planning/`, content carries the literal | **35** | **yes — all 35** | clause (a1) |
| tracked, outside `.planning/`, literal in path only | **2** | **yes — both** | clause (a2) |
| shipped-but-untracked `installer/**` | **4** | **yes — all 4** | clause (a3) |
| tracked, outside `.planning/`, **zero** occurrences | 339 (376 − 37) | **5 of them** | `CLAUDE.md` + the 4 zero-mention playbooks; the other 334 carry nothing and are named by no criterion |

### B.2 `.planning/phases/**` — 311 files — EXCLUDED

**Reason: phase artifacts are dated records by construction.** A `PLAN.md` states what a phase intended
to do at the moment it was planned; a `SUMMARY.md` states what it did; a `RESEARCH.md` states what was
measured on a named tree. Every one is a `D-08` class-1 document — true in the past tense, false to
rewrite. Correcting them would not remove a route (nobody follows a closed phase's plan); it would
destroy the record this milestone's provenance corrections were able to *re-derive from*.

They are also **structurally out of the removal gate's reach**: `PLANNING_PREFIX = ".planning/"` is
applied as a prefix in `trackedFiles()`, so not one of the 311 can move a pinned count.

**We looked**: the population was enumerated and sized, and its exclusion is a class decision about
dated records, not an oversight. **This ledger is itself one of the 311.**

### B.3 `.planning/research/**` and `.planning/research/archive-v0.6.0/**` — 10 files — EXCLUDED

**Reason: research archives, dated by construction.** Same class-1 argument as §B.2, with an explicit
archive marker in the path for the five under `archive-v0.6.0/`.

One member is named individually because ROADMAP criterion 2's "Rule A21" phrasing could be read as
reaching it:

| Path | `A21` | subject occ | Verdict |
|---|---|---|---|
| `.planning/research/ARCHITECTURE.md` | 4 lines / 5 occurrences | 12 | **`unchanged` — research archive, dated by construction** |

Cross-reference: **plan 32-03 deliberately left this file byte-identical** while converting the
`.planning/ARCHITECTURE.md` copy, and proved it mechanically —
`git diff --exit-code 2eaa136 HEAD -- .planning/research/ARCHITECTURE.md` exits 0
(`32-03-SUMMARY.md`, § *The `ARCHITECTURE.md` inventory*). Re-confirmed here against the phase base:

```bash
$ git diff --exit-code d6bebb1 HEAD -- .planning/research/ARCHITECTURE.md ; echo "exit=$?"
exit=0
```

`32-RESEARCH.md` §5.3 recommended exactly this ("recommend: yes, verdict `unchanged — research archive,
dated by construction`"); the recommendation is adopted, and the row is here rather than in §2 because
the file is in an excluded population, not in the swept set.

`.planning/research/archive-v0.6.0/ARCHITECTURE.md` carries **22** occurrences of the subject and **0**
of `A21`. Same verdict, same reason, and the `archive-` path segment makes the dating explicit.

### B.4 The remaining `.planning/` sub-trees — 27 files — EXCLUDED

`milestones/` (9), `quick/` (7), `todos/` (6), `notes/` (4), `seeds/` (1); `codebase/` measures **0**.

**Reason: all are dated or generated records, and none is named by ROADMAP criterion 2.** Milestone
archives and audits are closed records with dates in their filenames; `quick/` holds completed one-off
plans and summaries; `todos/` holds captured items (see §B.6); `notes/` holds dated investigation
notes, including `.planning/notes/regenerator2000-integration.md`, which is the *record of the
integration that was deleted* and is the single most obviously class-1 document in the repository;
`seeds/` holds an un-started idea. `codebase/` is regenerated by `/gsd-map-codebase` and carries zero
occurrences, so there is nothing to exclude — a measured zero, recorded so it is not mistaken for an
unchecked directory.

### B.5 The nine `.planning/` root documents — 4 in the swept set, 5 excluded

| Path | subject occ | In the swept set? | Reason |
|---|---|---|---|
| `.planning/PROJECT.md` | 51 | **yes** — row 42 | named by ROADMAP criterion 2 |
| `.planning/ARCHITECTURE.md` | 11 | **yes** — row 43 | named by ROADMAP criterion 2 (Rule A21) |
| `.planning/ROADMAP.md` | 24 | **yes** — row 44 | named by clause (b) |
| `.planning/REQUIREMENTS.md` | 13 | **yes** — row 45 | named by clause (b) |
| `.planning/STATE.md` | ≥1 | **no** | Machine-maintained position/progress file, rewritten by the GSD state verbs on every plan close. Its mentions are historical decision echoes, not prose a reader routes from. **Also out of this executor's reach by policy**: a worktree executor may not write `STATE.md`; the orchestrator owns it |
| `.planning/ENGINEERING_RULES.md` | ≥1 | no | Numbered, dated rule record; class 1 |
| `.planning/MILESTONES.md` | ≥1 | no | Closed-milestone roll-up; class 1 |
| `.planning/RETROSPECTIVE.md` | ≥1 | no | Dated retrospective; class 1 |
| `.planning/WINDOWS.md` | ≥1 | no | Cross-phase defect ledger; append-only by construction |

**We looked at all nine.** Four are swept; five are excluded as dated or machine-maintained records,
and `STATE.md` additionally sits outside what a worktree executor is permitted to write.

### B.6 The two reviewed-but-not-folded todos — considered, measured, and outside `CUT-06`

`32-CONTEXT.md` § *Reviewed Todos (not folded)* names two items that are adjacent to this sweep. They
are recorded here so a later reader sees they were **considered and rejected**, not missed.

| Todo | Subject occurrences | Verdict |
|---|---|---|
| `.planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md` | **0** | Out of scope. Document-honesty work about a **corpus claim**, not a deleted route |
| `.planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md` | **0** | Out of scope. Doc-accuracy work in `docs/` about **text-monitor reachability**, unrelated to the subject |

```bash
$ grep -ac 'regenerator2000' .planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md
0
$ grep -ac 'regenerator2000' .planning/todos/pending/2026-08-28-phase-7-pitfall-5-overgeneralizes-text-monitor-unreachability.md
0
```

**Both measure zero occurrences of the subject**, which is the mechanical form of `32-CONTEXT.md`'s
stated objection: folding them *"would widen the sweep from 'deleted routes' to 'all stale doc
claims'"*. `CUT-06`'s subject is the deleted route. These are real work and belong in the pending todo
queue where they already sit; they are not `CUT-06`'s.

`32-CONTEXT.md` also records *"the remaining six keyword matches (`broker` and `capture` area todos) are
false positives from generic term overlap and were not considered further."* That disposition is
carried forward unchanged; the pending queue holds nine todos in total, of which the two above plus
those six account for eight, and the ninth (`back-05-test-fails-deterministically-on-a-live-broker-host`)
is folded into this phase as `D-13`'s recorded precondition rather than as sweep work.

---

## 7. How to re-derive this document

Run every command from the repository root you want to measure — **not** from a path copied out of a
plan file. Resolve it first:

```bash
WT_ROOT=$(git rev-parse --show-toplevel) && cd "$WT_ROOT"
```

1. **Clause (a1), the 35** — `for f in $(git ls-files | grep -v '^\.planning/'); do grep -aq 'regenerator2000' "$f" && echo "$f"; done`
2. **The NUL proof** — the same loop without `-a`; diff the two lists; the single missing path is the NUL-carrying file.
3. **Clause (a2), the 2** — the gate's own predicate scans the *path* too:
   `git ls-files | grep -v '^\.planning/' | grep -i 'regenerator2000'` returns **three** paths —
   `docs/phase9-regenerator2000-probe-findings.md`, `scripts/check-no-regenerator2000.d.mts`,
   `scripts/check-no-regenerator2000.mjs`. The first is already in clause (a1) (its *content* carries
   the literal 43 times as well), so clause (a2) is the other **two**: the ones whose content carries
   zero. `35 + 2 = 37`.
4. **Clause (a3), the 4** — `node -e "import('./scripts/check-npm-packages.mjs').then(m=>console.log(m.packFiles('installer').files))"`, then grep the `installer/skills/**` results.
5. **Clause (c), the 7** — `git ls-files | grep -E '^src/skills/[^/]+/SKILL\.md$'`
6. **Every verdict** — `git diff --exit-code d6bebb1 HEAD -- <path>`; exit 0 is `unchanged`, non-zero is `corrected`.
7. **Every pin** — read `EXEMPTION_CLASSES` in `scripts/check-no-regenerator2000.mjs`; the per-class totals print on every successful gate run.
8. **The gate** — `node scripts/check-no-regenerator2000.mjs`; exit 0, 157 permanently exempt, 0 allow-listed.

**One caveat that will bite the next reader:** running the gate (or anything that calls `packFiles()`)
executes `npm pack --dry-run`, whose `prepack` hook regenerates `installer/skills/`. That directory is
gitignored so the working tree stays clean, but a run that has never invoked the gate will find those
four clause-(a3) paths absent from disk.

---

## 8. Deviation recorded: the plan's own prediction about A3 was wrong

`32-05-PLAN.md` task 2 instructed this ledger to record `32-CONTEXT.md`'s "26 `r2000_` occurrences" as
**DISAGREEING** — *"Measured 17 lines and 23 occurrences; neither counting definition yields 26. State
the delta of 3 … Do not smooth this over"* — and its `must_haves.truths` restates the same expectation.
That instruction was written from `32-RESEARCH.md` §5.1, which tested two counting definitions
(case-sensitive lines, case-sensitive occurrences) and not the third.

**The third definition reproduces the figure exactly** (§A3): case-insensitive occurrences at the
pre-sweep tree measure **26**. Recording a disagreement that does not exist would have been the same
failure as smoothing over one that does — a published figure whose provenance does not reproduce.
Section A3 therefore records `reconciles`, with all four measurements, the three uppercase lines that
account for the delta, and the note that case-insensitivity is the removal gate's own native matching
mode. Everything the plan asked to be *stated* is stated — both units, the delta of 3, the command, and
the hypothesis — but the verdict follows the measurement rather than the prediction.

The plan's own instruction anticipated this: *"Every number in both sections carries the command that
produced it. No number is copied from CONTEXT.md or RESEARCH.md without being re-run."* Re-running is
what produced this correction.
