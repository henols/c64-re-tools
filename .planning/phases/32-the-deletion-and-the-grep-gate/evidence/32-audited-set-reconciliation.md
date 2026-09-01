# Phase 32 — the audited set, re-derived and reconciled (D-02)

**What this document is.** `CUT-04` names a historical audited set by *figures*
("32 test files … and 11 files under `scripts/`"). This phase's guard derives
that set *mechanically*, from the git object store at two pinned commits plus
one committed document. This document is the reconciliation between the two: it
re-derives the set, reproduces `CUT-04`'s figures, maps every historical member
forward onto the settled tree, and gives a stated reason for every addition and
every removal.

**Provenance discipline.** Every figure below carries the command that produced
it, and every figure was produced by *running* that command against this tree —
none is copied from `32-CONTEXT.md`, `32-RESEARCH.md` or `.planning/research/`.
Three figures inherited from those documents did **not** reproduce, and each is
corrected in place with the measurement that disproves it (§2.4, §4.1, §7.1).
This milestone has already had to correct figures whose provenance did not
reproduce; the rule is stronger than the convenience.

**Where the numbers live.** `scripts/check-guard-fates.mjs` exports
`SET_A_FLOOR = 43`, `SET_B_FLOOR = 16`, `SET_C_FLOOR = 2`, `TOTAL_FLOOR = 61`.
The arithmetic in §8 is those four constants. Plan `32-08` reads this document
as the authoritative arithmetic when it completes the registry.

---

## 1. The two pinned commits and the two predicates

| Constant | Value | What it is |
|---|---|---|
| `AUDIT_COMMIT` | `0394cbc` | The milestone open. Both of `CUT-04`'s historical figures reproduce against this tree exactly (§2). |
| `AUDIT_END` | `345d5c4` | The settled tree: after the re-pointing milestone closed, before this phase's own commits. |

Both are asserted present before any derivation runs:

```bash
git cat-file -t 0394cbc   # -> commit
git cat-file -t 345d5c4   # -> commit
```

An absent object is a **hard failure naming `fetch-depth: 0`**, never a smaller
set. `.github/workflows/ci.yml`'s `actions/checkout@v4` step has no `with:`
block, so a CI runner's clone is shallow (depth 1) and *neither* pinned commit
exists there until plan `32-08` adds that setting.

### 1.1 The set-A predicate, quoted from the guard

```js
    const base = path.slice(path.lastIndexOf("/") + 1);
    if (TEST_PATH_RE.test(path)) {
      if (base.startsWith(SUBJECT_PREFIX) || SUBJECT_RE.test(showAt(root, AUDIT_COMMIT, path))) {
        members.push(path);
      }
    } else if (SCRIPTS_RE.test(path)) {
      if (SUBJECT_RE.test(path) || SUBJECT_RE.test(showAt(root, AUDIT_COMMIT, path))) {
        members.push(path);
      }
    }
```

with `TEST_PATH_RE = /^src\/mcp\/vice\/.*\.test\.[a-z]+$/`,
`SCRIPTS_RE = /^scripts\//`, `SUBJECT_PREFIX = "anno-"` and
`SUBJECT_RE = /anno/i`, applied over:

```bash
git ls-tree -r --full-tree --name-only 0394cbc -- src/mcp/vice scripts   # 273 paths
git show 0394cbc:<path>                                                  # content test
```

`--full-tree` is load-bearing: without it the pathspec is resolved relative to
the process cwd, so a `--root` pointing at a subdirectory would silently derive
the empty set.

### 1.2 The set-B predicate, quoted from the guard

```js
    const inScope =
      TEST_PATH_RE.test(path) || PLANTED_FIXTURE_RE.test(path) || SCRIPTS_RE.test(path);
    if (!inScope) continue;
    if (SUBJECT_RE.test(path) || SUBJECT_RE.test(showAt(root, AUDIT_END, path))) {
      candidates.push(path);
    }
```

with `PLANTED_FIXTURE_RE = /^src\/mcp\/vice\/fixtures\/planted-/`, applied over:

```bash
git diff --name-only --diff-filter=A 0394cbc 345d5c4
git show 345d5c4:<path>
```

The guard passes **no pathspec** to `git diff` — a `git diff` pathspec is
cwd-relative and has no `--full-tree` equivalent, so the in-scope regexes above
do that filtering instead, cwd-independently.

Rename detection is **on** (git's default), which is why the successors of
git-detected renames do not appear in this list at all — see §4.

### 1.3 The set-C predicate

Set C is parsed out of the document that *mandates* it rather than typed:

```bash
# section: the `### Phase 32` heading up to the next `## ` or `### Phase N`
# note:    the bullet beginning "Two guard fates were DEFERRED", up to the next
#          TOP-LEVEL `- ` bullet (so its two numbered sub-bullets are included)
# tokens:  every `backticked` token matching /\.(ts|mjs|d\.mts)$/
# resolve: against `git ls-files -z --full-name`, requiring EXACTLY ONE match
```

Measured: the note begins at `.planning/ROADMAP.md` line **814**.

---

## 2. Set A reproduces `CUT-04`'s figures exactly

```
setA 43   tests 32   scripts 11
  name-carrying tests   19
  content-only tests    13
```

`CUT-04` says "32 test files (19 `anno-`named plus 13 non-`anno-`named that
reference it) and 11 files under `scripts/`". **19 + 13 = 32, plus 11 = 43.**
Every figure reproduces.

### 2.1 The 19 name-carrying test files

- `src/mcp/vice/absorbed-answer-key.test.ts`
- `src/mcp/vice/anno-cli.test.ts`
- `src/mcp/vice/anno-confidence.test.ts`
- `src/mcp/vice/anno-coverage-grammar.test.ts`
- `src/mcp/vice/anno-coverage.test.ts`
- `src/mcp/vice/anno-d64.test.ts`
- `src/mcp/vice/anno-enum-gen.test.ts`
- `src/mcp/vice/anno-launch.test.ts`
- `src/mcp/vice/anno-mcp-client.test.ts`
- `src/mcp/vice/anno-memmap-render.test.ts`
- `src/mcp/vice/anno-project.test.ts`
- `src/mcp/vice/anno-regbits.test.ts`
- `src/mcp/vice/anno-session.test.ts`
- `src/mcp/vice/spawn-seam.test.ts`
- `src/mcp/vice/anno-symbol-roundtrip.test.ts`
- `src/mcp/vice/anno-tools.test.ts`
- `src/mcp/vice/anno-derivation.test.ts`
- `src/mcp/vice/anno-verb-coverage.test.ts`
- `src/mcp/vice/anno-verify.test.ts`

### 2.2 The 13 content-only test files, with both counting definitions

| Path | occurrences | lines-with-a-hit |
|---|---|---|
| `src/mcp/vice/audit-integrity.test.ts` | 1 | 1 |
| `src/mcp/vice/capability-registry.test.ts` | 8 | 5 |
| `src/mcp/vice/disasm-roundtrip.test.ts` | 3 | 3 |
| `src/mcp/vice/docs-dangling-refs.test.ts` | 19 | 18 |
| `src/mcp/vice/docs-absorbed-decisions.test.ts` | 10 | 8 |
| `src/mcp/vice/hop-chain-comments.test.ts` | 8 | 8 |
| `src/mcp/vice/hostpath-consumers.test.ts` | 31 | 22 |
| `src/mcp/vice/skill-acme-build-cli.test.ts` | 2 | 2 |
| `src/mcp/vice/skill-attribution.test.ts` | 20 | 20 |
| `src/mcp/vice/stock-connect.test.ts` | 1 | 1 |
| `src/mcp/vice/stock-dispatch.test.ts` | 32 | 21 |
| `src/mcp/vice/tool-support-table.test.mjs` | 9 | 5 |
| `src/mcp/vice/vice-proxy.test.ts` | 30 | 29 |

Command (per path):

```bash
git show 0394cbc:<path> | grep -aoi anno | wc -l   # occurrences
git show 0394cbc:<path> | grep -aic anno           # lines-with-a-hit
```

**Counting definition used by THIS document: occurrences** (one entry per
match, so a line carrying the subject twice counts twice). This is the same
definition the removal gate's own scan predicate uses, and it is the one that
is directly comparable with `grep -aoi … | wc -l`.

> **`grep -a` is mandatory, not stylistic.** `src/mcp/vice/anno-memmap-render.ts`
> carries a NUL byte, and a plain `grep` treats such a file as binary and prints
> no matching lines at all. A census run without `-a` silently skips it. The
> guard itself avoids the problem entirely by matching in-process on the decoded
> string.

### 2.3 Reconciliation against `.planning/research/PITFALLS.md:36`

`PITFALLS.md:36` lists **the same 13 names** with these per-file figures:
`docs-anno-decisions` (8), `hostpath-consumers` (22), `skill-attribution`
(20), `stock-dispatch` (21), `vice-proxy` (29), `docs-dangling-refs` (18),
`hop-chain-comments` (8), `capability-registry` (5), `tool-support-table`
(5), `disasm-roundtrip` (3), `skill-acme-build-cli` (2), `stock-connect` (1),
`audit-integrity` (1).

**Every one of those 13 figures equals this document's `lines-with-a-hit`
column, for all 13 files.** The difference between the two documents is
therefore *entirely* a counting definition — `PITFALLS.md` counts
lines-with-a-hit, this document counts occurrences — and not a disagreement
about membership or a measurement error in either. The two are consistent; read
them with their own definitions.

### 2.4 CORRECTION: `PITFALLS.md:36`'s "21 `anno-*.test.ts` files" does not reproduce

The same `PITFALLS.md` row closes with "plus the 21 `anno-*.test.ts` files".
Measured:

```bash
git ls-tree -r --full-tree --name-only 0394cbc -- src/mcp/vice \
  | grep -c '^src/mcp/vice/anno-.*\.test\.[a-z]\+$'      # -> 19
git ls-tree -r --full-tree --name-only 0394cbc -- src/mcp/vice \
  | grep -c '^src/mcp/vice/anno-'                         # -> 36
```

**19**, not 21 — and `CUT-04`'s own "19 `anno-`named" is the figure that
reproduces. (36 is the count of *all* `anno-`prefixed files under
`src/mcp/vice/`, tests and non-tests together; it is not the test count.) The
guard's `SET_A_FLOOR = 43` is built on 19 + 13 + 11, so nothing downstream
depends on the 21.

### 2.5 The 11 `scripts/` files

| Path | matched via | occurrences at `0394cbc` |
|---|---|---|
| `scripts/audit-gate.mjs` | content | 2 |
| `scripts/check-npm-packages.mjs` | content | 11 |
| `scripts/check-skill-fork-honesty.mjs` | content | 8 |
| `scripts/check-skill-tool-coverage.mjs` | content | 85 |
| `scripts/generate-tool-support-table.mjs` | content | 12 |
| `scripts/lib/anno-cli-verbs.d.mts` | **path** | 4 |
| `scripts/lib/anno-cli-verbs.mjs` | **path** | 16 |
| `scripts/lib/skill-corpus.d.mts` | content | 1 |
| `scripts/lib/skill-descriptions.d.mts` | content | 1 |
| `scripts/lib/skill-descriptions.mjs` | content | 3 |
| `scripts/lib/skill-honesty-checks.mjs` | content | 2 |

---

## 3. Resolving `CUT-04`'s "two `.d.mts` declarations" ambiguity, in writing

`CUT-04`'s prose refers to "two `.d.mts` declarations" among the 11 `scripts/`
files. The derived set contains **three**:

- `scripts/lib/anno-cli-verbs.d.mts`
- `scripts/lib/skill-corpus.d.mts`
- `scripts/lib/skill-descriptions.d.mts`

```bash
git ls-tree -r --full-tree --name-only 0394cbc -- scripts | grep -c '\.d\.mts$'   # -> 4 total
```

(Four `.d.mts` files exist under `scripts/` at that commit; three of them match
the subject predicate.) **The arithmetic closes either way**, because the figure
`CUT-04` states exactly is the *count of 11*, not the breakdown by extension.
The requirement's "two" is a prose slip about composition, not a membership
claim; `SET_A_FLOOR` is unaffected. Recorded here so a later reader does not
read the third declaration as an over-derivation.

---

## 4. The forward map: what each of the 43 became

```
same-path survivors  21
renamed              15
gone                  7        (21 + 15 + 7 = 43)
```

Commands:

```bash
git ls-tree -r --full-tree --name-only 345d5c4          # survives under the same path?
git diff -M --name-status 0394cbc 345d5c4               # git's own rename detection
```

plus the name-descendant fallback (§4.2) for the members git scores as a delete
plus an unrelated add.

### 4.1 CORRECTION: 15 renamed / 7 gone, not the plan's 16 / 6

`32-01-PLAN.md` §4 states "21 survive under the same path, 16 under a new name,
6 are gone". The measured split is **21 / 15 / 7**. The difference is one
member: seven set-A paths are absent from `345d5c4` and have **no mechanically
derivable successor** — no git-detected rename, and no name-descendant that
exists at `AUDIT_END`:

- `src/mcp/vice/anno-launch.test.ts`
- `src/mcp/vice/anno-mcp-client.test.ts`
- `src/mcp/vice/anno-project.test.ts`
- `src/mcp/vice/anno-session.test.ts`
- `src/mcp/vice/anno-symbol-roundtrip.test.ts`
- `src/mcp/vice/anno-derivation.test.ts`
- `src/mcp/vice/anno-verify.test.ts`

Calling any of these "renamed" would require a **hand-typed** historical→new
mapping, which is exactly what the guard forbids. Each of the seven therefore
enters the registry as `deleted` (with its removing commit named) or as
`superseded` (with the replacement's own observed red) — a judgement the sweep
plans make per row, against `29-21-SUMMARY.md:176-259`'s commit-level record of
the outright removals. The forward-map split is **descriptive**; no floor
depends on it. An earlier research draft said **13** renamed; neither 13 nor 16
reproduces, and 15 is the measured figure.

### 4.2 The five renames git's `-M` heuristic misses

`git diff -M --name-status 0394cbc 345d5c4` resolves **8** of the 15 renames.
The remaining 7 score as `D` + an unrelated `A`, and are resolved by the
name-descendant predicate — same directory, basename with the `anno-` prefix
replaced by `anno-`/`absorbed-` or dropped entirely:

| Historical path | New subject | Resolved via |
|---|---|---|
| `scripts/lib/anno-cli-verbs.mjs` | `scripts/lib/anno-cli-verbs.mjs` | git rename detection |
| `src/mcp/vice/docs-absorbed-decisions.test.ts` | `src/mcp/vice/docs-absorbed-decisions.test.ts` | git rename detection |
| `src/mcp/vice/absorbed-answer-key.test.ts` | `src/mcp/vice/absorbed-answer-key.test.ts` | git rename detection |
| `src/mcp/vice/anno-confidence.test.ts` | `src/mcp/vice/anno-confidence.test.ts` | git rename detection |
| `src/mcp/vice/anno-coverage-grammar.test.ts` | `src/mcp/vice/anno-coverage-grammar.test.ts` | git rename detection |
| `src/mcp/vice/anno-coverage.test.ts` | `src/mcp/vice/anno-coverage.test.ts` | git rename detection |
| `src/mcp/vice/anno-d64.test.ts` | `src/mcp/vice/anno-d64.test.ts` | git rename detection |
| `src/mcp/vice/anno-regbits.test.ts` | `src/mcp/vice/anno-regbits.test.ts` | git rename detection |
| `scripts/lib/anno-cli-verbs.d.mts` | `scripts/lib/anno-cli-verbs.d.mts` | **name-descendant** |
| `src/mcp/vice/anno-cli.test.ts` | `src/mcp/vice/anno-cli.test.ts` | **name-descendant** |
| `src/mcp/vice/anno-enum-gen.test.ts` | `src/mcp/vice/anno-enum-gen.test.ts` | **name-descendant** |
| `src/mcp/vice/anno-memmap-render.test.ts` | `src/mcp/vice/anno-memmap-render.test.ts` | **name-descendant** |
| `src/mcp/vice/spawn-seam.test.ts` | `src/mcp/vice/spawn-seam.test.ts` | **name-descendant** |
| `src/mcp/vice/anno-tools.test.ts` | `src/mcp/vice/anno-tools.test.ts` | **name-descendant** |
| `src/mcp/vice/anno-verb-coverage.test.ts` | `src/mcp/vice/anno-verb-coverage.test.ts` | **name-descendant** |

The plan names five of these as git-invisible (`anno-cli`, `anno-enum-gen`,
`anno-memmap-render`, `anno-tools`, `anno-verb-coverage`); the measurement
finds **seven**, adding `scripts/lib/anno-cli-verbs.d.mts` and
`src/mcp/vice/spawn-seam.test.ts`. **The name-descendant predicate is
AUTHORITATIVE over git's output** wherever the two disagree — it is the same
predicate `CUT-01` and `29-VERIFICATION.md` already established, and git's
similarity heuristic is a scoring accident of how much of each file changed,
not a statement about intent.

### 4.3 The 21 same-path survivors

- `scripts/audit-gate.mjs`
- `scripts/check-npm-packages.mjs`
- `scripts/check-skill-fork-honesty.mjs`
- `scripts/check-skill-tool-coverage.mjs`
- `scripts/generate-tool-support-table.mjs`
- `scripts/lib/skill-corpus.d.mts`
- `scripts/lib/skill-descriptions.d.mts`
- `scripts/lib/skill-descriptions.mjs`
- `scripts/lib/skill-honesty-checks.mjs`
- `src/mcp/vice/audit-integrity.test.ts`
- `src/mcp/vice/capability-registry.test.ts`
- `src/mcp/vice/disasm-roundtrip.test.ts`
- `src/mcp/vice/docs-dangling-refs.test.ts`
- `src/mcp/vice/hop-chain-comments.test.ts`
- `src/mcp/vice/hostpath-consumers.test.ts`
- `src/mcp/vice/skill-acme-build-cli.test.ts`
- `src/mcp/vice/skill-attribution.test.ts`
- `src/mcp/vice/stock-connect.test.ts`
- `src/mcp/vice/stock-dispatch.test.ts`
- `src/mcp/vice/tool-support-table.test.mjs`
- `src/mcp/vice/vice-proxy.test.ts`

---

## 5. The additions: 16 net-new set-B members, each with its reason

Every one of the 16 was **created by the re-pointing milestone between the two
pinned commits** and **matches the same subject predicate set A uses** (path or
content). That is the whole inclusion reason — a uniform, mechanical test, not a
per-file judgement. The `occurrences at 345d5c4` column is the measurement that
admits each one; where it is `0`, the **path** carried the match instead.

| Path | matched via | occurrences at `345d5c4` |
|---|---|---|
| `scripts/check-no-analyser.d.mts` | **path** | 0 |
| `scripts/check-no-analyser.mjs` | **path** | 0 |
| `scripts/lib/anno-cli-invocations.mjs` | content | 1 |
| `src/mcp/vice/acme-gate.test.ts` | content | 1 |
| `src/mcp/vice/anno-derivation.test.ts` | content | 19 |
| `src/mcp/vice/anno-index.test.ts` | content | 1 |
| `src/mcp/vice/anno-seam.test.ts` | content | 1 |
| `src/mcp/vice/anno-store.test.ts` | content | 1 |
| `src/mcp/vice/anno-types.test.ts` | content | 3 |
| `src/mcp/vice/block-class.test.ts` | content | 2 |
| `src/mcp/vice/fixtures/planted-removal-fixture.md.txt` | content | 1 |
| `src/mcp/vice/fixtures/planted-removal-fixture.ts.txt` | content | 1 |
| `src/mcp/vice/module-classification.test.ts` | content | 26 |
| `src/mcp/vice/prg-image.test.ts` | content | 2 |
| `src/mcp/vice/removal-gate.test.ts` | content | 1 |
| `src/mcp/vice/shipped-modules.test.ts` | content | 13 |

The two `fixtures/planted-*` entries are in scope by the explicit
`PLANTED_FIXTURE_RE` clause: they are the removal gate's own planted-violation
corpus, so a fate for the gate that ignored its fixtures would be a fate for
half the mechanism.

---

## 6. The removals from research §1.5's candidate list, with reasons

`32-RESEARCH.md` §1.5 lists candidates that the mechanical predicate **does
not** admit. No candidate is dropped silently; each exclusion is the same
uniform content test failing, not a judgement.

| Candidate | added between the commits? | occurrences at `345d5c4` | verdict |
|---|---|---|---|
| `scripts/check-skill-cli-invocations.mjs` | yes | **0** | **EXCLUDED** — neither its path nor its content matches |
| `scripts/lib/anno-cli-invocations.d.mts` | yes | **0** | **EXCLUDED** — same reason |
| `scripts/lib/anno-cli-verbs.d.mts` | yes | **0** | **EXCLUDED** — same reason (see §7.1; this is the exclusion the plan's arithmetic did not account for) |
| `scripts/lib/anno-cli-invocations.mjs` | yes | **1** | **INCLUDED** — its content matches |
| `scripts/lib/anno-cli-verbs.mjs` | **no** (git resolves it as a rename `R`) | 4 | **not a set-B candidate** — it is `scripts/lib/anno-cli-verbs.mjs`'s successor, and that set-A row claims it (§4.2) |

Command:

```bash
git diff --name-only --diff-filter=A 0394cbc 345d5c4 | grep -x '<path>'
git show 345d5c4:<path> | grep -aoi anno | wc -l
```

**The asymmetry between `anno-cli-invocations.mjs` (in) and
`anno-cli-invocations.d.mts` (out) is deliberate and mechanical**: the `.mjs`
mentions the subject in a comment, the `.d.mts` does not. A reader should not
read the missing `.d.mts` as an omission — a declaration file that never
mentioned the subject was never pinned to it, so it owes no fate.

---

## 6.1 `CUT-04`'s NAMED list, adjudicated name by name

**Why this section exists.** §2 reconciles `CUT-04`'s **figures** ("32 test files
… and 11 files under `scripts/`") and §6 reconciles **research §1.5's candidate
list**. Neither reconciles `CUT-04`'s **NAMES** — the eleven guards the
requirement lists after "Named explicitly:". One of them, `docs-linerefs`, is
correctly outside the mechanical predicate, and because no section reconciled
against the names, it fell out of the audit with no recorded reason. A reader
could not tell "we looked and it is fine" from "we never looked", which is
**D-09**'s own test.

Written **2026-09-01**, in gap-closure round 1, after `32-VERIFICATION.md`
scored `CUT-04` ⚠ SATISFIED WITH ONE NAMED EXCEPTION and recorded this as Gap 1.
This section is an **insertion**: no existing byte of this document was changed.

### 6.1.1 The eleven names, extracted rather than transcribed

The list is derived from the requirement text by command, so the input to this
adjudication is reproducible and not a hand-copied list:

```bash
sed -n '141p' .planning/REQUIREMENTS.md \
  | sed 's/.*Named explicitly: //' \
  | sed 's/([^)]*)//g' \
  | grep -ao '`[^`]*`' | tr -d '`'
```

The `sed 's/([^)]*)//g'` step is load-bearing and was added after measurement,
not by anticipation: three of the eleven entries carry a parenthetical aside,
and those asides themselves contain backticked tokens (`CLAUDE.md`,
`docs-absorbed-decisions`, `scripts/audit-gate.mjs`, `D-12`). Without the strip,
the same extraction returns **13** tokens rather than 11, and four of them are
not names in the list at all. Measured both ways.

Result — **11 names**, in the requirement's own order:

```
docs-linerefs
docs-dangling-refs
docs-anno-decisions
hostpath-consumers
stock-dispatch
vice-proxy
capability-registry
skill-attribution
tool-support-table
check-skill-tool-coverage.mjs
generate-tool-support-table.mjs
```

### 6.1.2 The resolution rule, and why it is NOT §1.3's rule

Most of the eleven are **bare stems**, not filenames. §1.3's set-C rule resolves
a token against `git ls-files` requiring `p === token || p.endsWith("/" + token)`.
Applied to a bare stem that rule returns **zero** paths, because no tracked path
is *named* `docs-linerefs`. Measured, rather than asserted:

```bash
$ git ls-files | awk -v t='docs-linerefs' '$0==t || $0 ~ ("/" t "$")' | wc -l
0
```

So §1.3's rule is unusable here and this section states a different one.

**The rule used.** Resolve each name against the set of `historicalPath` values
in `guard-fates.json` — the paths **as they stood at the pinned commits**, not
against `HEAD`'s `git ls-files`. A name matches a row when the row's
`historicalPath` **basename** is exactly the name, or exactly the name plus one
of `.test.ts`, `.test.mjs` or `.mjs`. **Basename EQUALITY, never substring
containment.**

Re-runnable in full:

```bash
node --input-type=module -e '
import { readFileSync } from "node:fs";
const REG = ".planning/phases/32-the-deletion-and-the-grep-gate/guard-fates.json";
const rows = JSON.parse(readFileSync(REG, "utf8")).rows;
const SUFFIXES = ["", ".test.ts", ".test.mjs", ".mjs"];
const names = readFileSync(process.argv[1], "utf8").split("\n").filter(Boolean);
for (const name of names) {
  const hits = rows.filter((r) => {
    const base = r.historicalPath.slice(r.historicalPath.lastIndexOf("/") + 1);
    return SUFFIXES.some((s) => base === name + s);
  });
  console.log(`${name}\t${hits.length}\t` +
    (hits.map((h) => `${h.historicalPath} [${h.verdict}]`).join(" | ") || "-"));
}' names.txt
```

(where `names.txt` is the eleven-line output of §6.1.1.)

**Why equality and not containment — measured, not argued.** Swapping the
predicate for `r.historicalPath.includes(name)` and re-running changes exactly
one resolution:

```
tool-support-table   2   scripts/generate-tool-support-table.mjs | src/mcp/vice/tool-support-table.test.mjs
```

Under containment the name `tool-support-table` claims
`generate-tool-support-table.mjs`'s row as well as its own — one name eating
another name's row, which would leave a *different* named guard unaudited while
appearing to resolve. Equality returns one row for each. This is the precise
failure this section exists to close, so the rule is stated in the form that
does not commit it.

**Three consequences, handled explicitly rather than smoothed over:**

- A name matching **zero** rows is not a defect in the rule — it is **the
  finding**. It gets an `EXCLUDED` verdict carrying its measurement (§6.1.4).
- A name matching **more than one** row is reported `AMBIGUOUS` with every
  candidate listed and **none picked**. An ambiguity silently resolved by
  preference is exactly the "name unaudited" failure this section closes.
  *Measured outcome: no name resolved ambiguously under the equality rule.*
- `docs-anno-decisions` resolves to **zero** paths at `HEAD` — the file was
  renamed to `docs-absorbed-decisions.test.ts` by **plan 29-05** — but resolves
  cleanly against the pinned-commit `historicalPath` set. Its resolution below
  is taken at `AUDIT_COMMIT` `0394cbc`, which is what makes the historical name
  in the requirement resolvable at all.

### 6.1.3 The eleven verdicts

| # | Name as written in `CUT-04` | Resolved path | Verdict | Evidence |
|---|---|---|---|---|
| 1 | `docs-linerefs` | *(no registry row)* → `src/mcp/vice/docs-linerefs.test.ts` | **EXCLUDED** | `grep -aic anno` = **0** at `0394cbc` and **0** at `345d5c4`; not added between the pins. Non-vacuity discharged in-band by plan 32-04 — see §6.1.4 |
| 2 | `docs-dangling-refs` | `src/mcp/vice/docs-dangling-refs.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/docs-dangling-refs.test.ts`, `verdict` `re-pointed` |
| 3 | `docs-anno-decisions` | `src/mcp/vice/docs-absorbed-decisions.test.ts` *(at `0394cbc`; renamed to `src/mcp/vice/docs-absorbed-decisions.test.ts` by plan 29-05)* | **CITED** | registry row `historicalPath` `src/mcp/vice/docs-absorbed-decisions.test.ts`, `verdict` `re-pointed`, `newSubject` `src/mcp/vice/docs-absorbed-decisions.test.ts` |
| 4 | `hostpath-consumers` | `src/mcp/vice/hostpath-consumers.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/hostpath-consumers.test.ts`, `verdict` `re-pointed` |
| 5 | `stock-dispatch` | `src/mcp/vice/stock-dispatch.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/stock-dispatch.test.ts`, `verdict` `re-pointed` |
| 6 | `vice-proxy` | `src/mcp/vice/vice-proxy.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/vice-proxy.test.ts`, `verdict` `re-pointed` |
| 7 | `capability-registry` | `src/mcp/vice/capability-registry.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/capability-registry.test.ts`, `verdict` `re-pointed` |
| 8 | `skill-attribution` | `src/mcp/vice/skill-attribution.test.ts` | **CITED** | registry row `historicalPath` `src/mcp/vice/skill-attribution.test.ts`, `verdict` **`kept-unchanged`** |
| 9 | `tool-support-table` | `src/mcp/vice/tool-support-table.test.mjs` | **CITED** | registry row `historicalPath` `src/mcp/vice/tool-support-table.test.mjs`, `verdict` `re-pointed`. Resolved by basename equality on the `.test.mjs` suffix — **its own row**, distinct from row 11 |
| 10 | `check-skill-tool-coverage.mjs` | `scripts/check-skill-tool-coverage.mjs` | **CITED** | registry row `historicalPath` `scripts/check-skill-tool-coverage.mjs`, `verdict` `re-pointed` |
| 11 | `generate-tool-support-table.mjs` | `scripts/generate-tool-support-table.mjs` | **CITED** | registry row `historicalPath` `scripts/generate-tool-support-table.mjs`, `verdict` `re-pointed` |

**Rows 9 and 11 are two guards, not one guard named twice.** They look like a
duplicate and are not: under basename equality `tool-support-table` resolves to
a `src/mcp/vice/*.test.mjs` **guard** and `generate-tool-support-table.mjs` to a
`scripts/` **generator**, and each holds its own registry row with its own
`verdict`. They are cited separately and deliberately — collapsing them into one
citation would turn two independently audited members into one, which is the
same failure mode as leaving a name unresolved.

**Row 8 is the only `kept-unchanged` among the ten CITED names**, and it is
recorded as such rather than smoothed to match its neighbours. "Left unchanged"
is a fate, and D-09 requires it to have a row exactly as a re-pointing does.

### 6.1.4 `docs-linerefs` — the excluded name, in full

This is the guard `CUT-04` names **first** and `ROADMAP.md` Success Criterion 1
names again. It is the one name with no registry row, so it gets the paragraph
the table cell cannot hold. Every figure below is the output of the command
printed beside it.

**1. Resolved path.** `src/mcp/vice/docs-linerefs.test.ts`. The name resolves to
zero rows under the §6.1.2 rule, so the path is taken from the tree rather than
from the registry.

**2. Subject-occurrence count at both pins — zero and zero.**

```bash
$ git show 0394cbc:src/mcp/vice/docs-linerefs.test.ts | grep -aic anno
0
$ git show 345d5c4:src/mcp/vice/docs-linerefs.test.ts | grep -aic anno
0
```

**The `-a` is not optional and its use is stated here deliberately**, exactly as
`evidence/32-document-sweep.md` does: a plain `grep` silently treats a file
containing a NUL byte as binary and reports nothing, and this project has
already recorded **one false decision** taken from a census run without it
(`src/mcp/vice/anno-memmap-render.ts` is the file that hides). An exclusion is a
written claim that a number is zero; a zero produced by a predicate that skips
files is not a measurement.

**3. Not added between the pins.**

```bash
$ git diff --name-only --diff-filter=A 0394cbc 345d5c4 \
    | grep -x 'src/mcp/vice/docs-linerefs.test.ts'
$ echo $?
1
```

No output, exit 1 — the path is absent from the added-file list, so it is not a
set-B candidate either. It existed at `AUDIT_COMMIT` and never named the subject.

**4. Therefore it is outside the mechanical predicate BY CONSTRUCTION, owes no
registry row, and CANNOT be given one.** Set A admits a `src/mcp/vice/*.test.*`
path when its basename starts with the subject prefix **or** its content at
`AUDIT_COMMIT` matches the subject (§1.1). This file does neither: zero
occurrences at `0394cbc`, and its basename is `docs-linerefs.test.ts`. Adding a
hand-written row would not repair the gap — it would **red the blocking gate**,
because the registry's inverse direction rejects a row naming a path the
derivation does not admit. Re-measured, and quoted from the source rather than
from memory:

```bash
$ grep -an 'stranger row' scripts/check-guard-fates.mjs
672:      `stranger row: ${REGISTRY_REL_PATH} names \`${key}\`, which is NOT in the derived audited ` +
```

`scripts/check-guard-fates.mjs:672-676`, whose message states the reason
verbatim: *"stranger row: … names `<path>`, which is NOT in the derived audited
set. This direction is what stops the registry drifting into a hand-typed second
list of members: a row nobody derived is either a typo or an audit of something
outside scope."* That is why this gap is closed by **adjudication** — this
section — and not by a registry row.

**5. Where its non-vacuity WAS discharged: in band, by plan 32-04.** The guard
was not left unproven; it was proven somewhere the mechanical sweep does not
look. Plan 32-04 widened it from one hard-coded path onto a **declared document
set**, adding `.planning/PROJECT.md` beside `CLAUDE.md`:

```bash
$ sed -n '64,67p' src/mcp/vice/docs-linerefs.test.ts
const SCANNED_DOCS = Object.freeze([
  "CLAUDE.md",
  ".planning/PROJECT.md",
]);
```

Its **per-document non-vacuity floor** — never a sum across documents — is the
literal comparison at `:192`, with the message that names the offending document
and states the floor's per-document nature at `:196`:

```bash
$ grep -an 'meetsFloor\|This floor is per document' src/mcp/vice/docs-linerefs.test.ts
192:  const meetsFloor = citations.length >= 2;
193:  if (!meetsFloor) {
196:        `found ${citations.length}. This floor is per document.`,
```

Its planted violations drive that real rule from in-memory bodies. The one whose
own message states that a **globally summed floor would be satisfied here while
the per-document floor is not** is at `:361-374`:

> `"a GLOBAL summed floor would be SATISFIED here (2 + 0 = 2) -- which is exactly why this guard must never sum across documents"`

and its companion, the one-citation floor plant, at `:376-387`.

**MEASURED CORRECTION — the count and range this section was asked to write do
not reproduce, and the measurement is recorded rather than the expectation.**
Plan 32-13 directed this paragraph to cite "its three planted-violation tests at
`:361-383`". Re-measuring before writing, as this project's line-citation
discipline requires:

```bash
$ grep -ac '^test("planted-violation' src/mcp/vice/docs-linerefs.test.ts
6
$ grep -an '^test("planted-violation' src/mcp/vice/docs-linerefs.test.ts
272: … a citation pointing at an unrelated line fails this test's own logic
339: … a document whose only rewriteArguments() line carries no citation is reported
361: … the floor is PER DOCUMENT -- a global summed count stays green
376: … a document whose bullet cites only ONE line number fails the per-document floor
389: … a document with TWO citation-carrying rewriteArguments() bullets is reported
405: … a declared document that does not exist FAILS rather than shrinking the scanned set
```

There are **six** `planted-violation` tests, not three, and the range `:361-383`
spans **two** of them — it contains `:361-374` whole and cuts `:376-387` at its
eighth line. The five that plan 32-04 landed and enumerates in `32-04-SUMMARY.md`
are `:339`, `:361`, `:376`, `:389` and `:405`; the sixth, at `:272`, predates
that widening. The measured inventory above is what this document records. This
correction is stated rather than quietly adjusted because a line citation
written from expectation is the exact class of defect `docs-linerefs.test.ts`
itself exists to catch, and writing one *into the paragraph adjudicating that
guard* would be self-refuting.

**6. The statement a later reader needs.** **We looked, and it is fine, and here
is what we measured.** `docs-linerefs.test.ts` never named the deleted subject —
zero occurrences at both pinned commits, with `grep -a` — so the deletion could
not have made it pass vacuously, and the mechanical sweep correctly does not
admit it. Its non-vacuity was nonetheless established in this phase, by plan
32-04, through a per-document floor and five planted violations that fail on a
real document set. Its absence from `guard-fates.json` is a **property of the
derivation**, not an oversight, and giving it a row would red the gate that
guarantees the derivation is honest.

### 6.1.5 The measured arithmetic

**Eleven names in, eleven rows out.** Verdict counts, as the resolution produced
them and not as they were predicted:

```
CITED       10
EXCLUDED     1
AMBIGUOUS    0
─────────────
total       11   == the 11 names extracted in §6.1.1
```

No name is absent, no name is doubled, and **no two names share a citation** —
rows 9 and 11 each hold their own, per §6.1.3.

**This section adds no member, removes no member and changes no floor.** The
derived set stands at **61**, exactly as §9 records: `setA=43`, `setB=16`,
`setC=2`. It touches neither `guard-fates.json` nor any script.

Re-run afterwards, in this task's own working tree:

```bash
$ node scripts/check-guard-fates.mjs
check-guard-fates: OK -- setA=43 setB=16 setC=2 total=61 rows=61 (floors setA=43 setB=16 setC=2 total=61)
  derived from 273 path(s) at 0394cbc; forward map 21 same-path / 15 renamed / 7 gone; set B 22 raw candidate(s) minus 6 already-claimed successor(s); set C parsed from .planning/ROADMAP.md line 830.
$ echo $?
0
```

**Note on `line 830`, so a cross-check does not read it as a regression.** §1.3
above records the set-C note at `.planning/ROADMAP.md` line **814**, and
`32-VERIFICATION.md` records 814 as well. Those are **dated records of what the
gate printed on the day each was written**; `.planning/ROADMAP.md` has grown
since, and the note has moved down. Neither document is edited to agree with the
current reading — a dated record that gets rewritten to stay green stops being a
record. The requirement this section holds itself to is narrower and is met: the
line the gate printed **before** this section was written and the line it prints
**after** are the same 830, both taken in the same working tree.

---

## 7. The adjacency subtraction: 22 raw candidates − 6 already-claimed = 16

The raw set-B candidate list is **22** paths. Six of them are already some set-A
member's mechanically-derived successor, and the subtraction removes them so a
renamed member gets **exactly one row** — under its historical path at
`AUDIT_COMMIT` — rather than two:

| Subtracted path | Claimed by (set-A member) |
|---|---|
| `src/mcp/vice/anno-cli.test.ts` | `src/mcp/vice/anno-cli.test.ts` |
| `src/mcp/vice/anno-enum-gen.test.ts` | `src/mcp/vice/anno-enum-gen.test.ts` |
| `src/mcp/vice/anno-memmap-render.test.ts` | `src/mcp/vice/anno-memmap-render.test.ts` |
| `src/mcp/vice/anno-tools.test.ts` | `src/mcp/vice/anno-tools.test.ts` |
| `src/mcp/vice/anno-verb-coverage.test.ts` | `src/mcp/vice/anno-verb-coverage.test.ts` |
| `src/mcp/vice/spawn-seam.test.ts` | `src/mcp/vice/spawn-seam.test.ts` |

**22 − 6 = 16.**

The other 9 of the 15 newSubjects are absent from the 22 for two distinct,
measured reasons: 8 of them are git-detected renames (`R`, so they never appear
in a `--diff-filter=A` list at all) and one — `scripts/lib/anno-cli-verbs.d.mts`
— is an `A` whose content carries no mention of the subject, so the set-B
content predicate never admits it in the first place.

### 7.1 CORRECTION: the plan's `22 − 7 = 15` does not reproduce

`32-01-PLAN.md` predicts "22 raw set-B candidates minus 7 paths already claimed
as a set-A row's `newSubject` = 15", and `SET_B_FLOOR` was planned as 15 with
`TOTAL_FLOOR` as 60. The raw candidate count **22 reproduces exactly**. The
subtraction does not: only **6** of the 22 are already-claimed successors.

The seventh path the plan subtracted is `scripts/lib/anno-cli-verbs.d.mts`. It
*is* a set-A member's successor (§4.2), but it is **not among the 22**, so there
was nothing to subtract it from:

```bash
git diff --name-only --diff-filter=A 0394cbc 345d5c4 \
  | grep -x 'scripts/lib/anno-cli-verbs.d.mts'          # -> present (it IS an addition)
git show 345d5c4:scripts/lib/anno-cli-verbs.d.mts \
  | grep -aoi anno | wc -l                              # -> 0  (fails the content predicate)
```

The plan counted a path out of the set-B candidate list that had never entered
it. The guard's floors therefore carry the **measured** figures:
`SET_B_FLOOR = 16` and `TOTAL_FLOOR = 61`, each with the correction recorded in
its own constant's comment in `scripts/check-guard-fates.mjs`. Writing 15 and 60
would have made the guard red permanently, on a fabricated number, in the one
file whose entire purpose is refusing fabricated evidence.

---

## 8. Set C: the two deferred fates

The two members, parsed (never typed) out of `.planning/ROADMAP.md`:

- `src/mcp/vice/block-class.ts`
- `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs`

Neither is reachable by the set-A or set-B **content** predicate: both are
pinned to the deleted subject through the twelve committed
`project.regen2000proj` coverage fixtures rather than through their own text.
The mandating note is the only source, and it is quoted here verbatim from
`.planning/ROADMAP.md` line 814 and its two sub-bullets:

> - **Two guard fates were DEFERRED to this phase rather than discharged in
>   Phase 29, and they are named here so the recorded-fate criterion picks them
>   up instead of them sitting inert.** Both hinge on the same subject — the
>   twelve committed `project.regen2000proj` coverage fixtures — so they are one
>   decision taken twice, not two:
>   1. **`block-class.ts`'s transitional capitalised block-type arm survives its
>      own removal trigger** (recorded by plan 29-07). … Its **new** removal
>      trigger is *the fixtures being re-spelled*; record its fate against that
>      trigger rather than against the producer's absence.
>   2. **`src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` kept its
>      generator and FROZE its writer** (plan 29-10). … Its header now records
>      that those twelve files are the only remaining record of the format. …
>      this phase records the fate, it does not perform the re-point.

The parse, exactly as the guard performs it:

```bash
# 1. isolate the `### Phase 32` section (heading -> next `## ` or `### Phase N`)
# 2. inside it, the bullet containing "Two guard fates were DEFERRED",
#    up to the next TOP-LEVEL `- ` bullet
# 3. every `backticked` token matching /\.(ts|mjs|d\.mts)$/   -> 2 tokens:
#      "block-class.ts"
#      "src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs"
# 4. resolve each against `git ls-files -z --full-name`, requiring EXACTLY ONE
#    match (`p === token || p.endsWith("/" + token)`)
```

Note that the note names one member by **bare basename** and the other by
**full path** — which is why the resolution rule accepts a suffix match, and why
it insists on exactly one hit. `block-class.ts` resolves to exactly one tracked
path even though `block-class.test.ts` also exists, because the suffix compared
is `/block-class.ts`.

Two invariants of this parse:

- **A parse yielding anything other than 2 tokens is a hard failure that quotes
  the note.** A note reworded past the parse must be loud, not silently produce
  a smaller set C. `guard-fates.test.ts` proves this against a synthetic note
  that keeps the marker sentence but carries no source-file tokens, and against
  one whose marker sentence is gone.
- **The adjacency subtraction is applied to set C too**, unconditionally, and it
  **removes neither member** — neither is a set-A successor and neither is in
  set B. It is applied anyway so a future note naming an already-claimed path
  still yields one row rather than two.

---

## 9. The total

```
setA   43   == SET_A_FLOOR
setB   16   == SET_B_FLOOR
setC    2   == SET_C_FLOOR
─────────────
union  61   == TOTAL_FLOOR
```

Verified by running the guard:

```bash
$ node scripts/check-guard-fates.mjs
check-guard-fates: FAIL -- setA=43 setB=16 setC=2 total=61 rows=1 (floors setA=43 setB=16 setC=2 total=61)
  - no recorded fate: … (60 members)
```

**The union is 61, and it INCLUDES set C.** An arithmetic that omits set C — a
union of 59 here, or the plan's predicted 60 — contradicts `TOTAL_FLOOR` and
reds the guard for a reason that has nothing to do with the audit. There are no
duplicates between the three sets: set A and set B are disjoint by the adjacency
subtraction, and set C is disjoint from both by the same subtraction plus a
membership check, so `43 + 16 + 2` and `|union|` are the same number rather than
coincidentally equal ones.

The `FAIL` above is the phase's **pre-declared red**: the registry carries one
row (the tracer) and owes 60 more. It is expected from plan `32-01`'s landing
commit until plan `32-08` completes the registry, and it is deliberately not
wired into CI until then.

---

## 10. How to re-derive everything in this document

```bash
# the whole set, with its provenance, in one run
node scripts/check-guard-fates.mjs

# the four floors the document must agree with
grep -E 'SET_[ABC]_FLOOR|TOTAL_FLOOR' scripts/check-guard-fates.mjs

# set A, from scratch
git ls-tree -r --full-tree --name-only 0394cbc -- src/mcp/vice scripts

# set B candidates, from scratch
git diff --name-only --diff-filter=A 0394cbc 345d5c4

# the forward map's git half
git diff -M --name-status 0394cbc 345d5c4

# set C's mandating note
sed -n '814,816p' .planning/ROADMAP.md
```

---

*Phase: 32-the-deletion-and-the-grep-gate, plan 01, task 3 (D-02)*
*Measured against `0394cbc` and `345d5c4`; document written 2026-08-31*
