# Phase 32 — the two deferred guard fates (set C), recorded against their NEW triggers

Written by plan 32-08, task 2. Every number and every line citation below was
**re-measured in this worktree at execution time**, never copied from a research or
planning document — this project's line citations drift every phase, and this milestone
has already had to correct copied figures twice.

**What this document is for.** Set C is the only part of the audited set that is not
derived from the git object store. It is parsed out of one committed document, and its
two members are pinned to the deleted subject through twelve committed coverage fixtures
rather than through their own text. Neither content predicate can see them. This file is
the record of *why they survive their own removal triggers*, so a later reader finds a
deliberate decision rather than two inert branches.

**What this document is not.** It is not a re-point, and it does not authorise one.
`ROADMAP.md` is explicit that this phase **records the fate and does not perform the
re-point**, and `32-CONTEXT.md` lists both as deferred ideas. The assertion that nothing
moved is mechanical and is stated in section 7.

---

## 1. How set C is derived, and why it is a document rather than a walk

`resolveSetC()` in `scripts/check-guard-fates.mjs`:

1. finds `.planning/ROADMAP.md`'s section matching `/^### Phase 32\b/`;
2. finds the note inside it beginning `Two guard fates were DEFERRED` (line **814** at
   this commit);
3. takes the note as that bullet plus its indented sub-bullets, ending at the next
   top-level list item;
4. extracts every backticked token in the note matching `/\.(ts|mjs|d\.mts)$/`;
5. requires **exactly `SET_C_FLOOR` = 2** tokens, and requires each to resolve against
   `git ls-files` to **exactly one** tracked path.

Any other outcome **throws**. A reworded note is a loud, named failure and never a
silently smaller set C (threat **T-32-35**). The note is never mirrored into a hand-typed
array anywhere.

The two tokens resolve to:

| token in the note | resolved tracked path |
|---|---|
| `block-class.ts` (bare basename) | `src/mcp/vice/block-class.ts` |
| `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs` (full path) | itself |

The adjacency subtraction is applied to set C too, unconditionally. Measured: it removes
neither member.

---

## 2. The shared subject — why these are one decision taken twice

Both fates hinge on the **same** twelve fixture directories under
`src/mcp/vice/fixtures/coverage/`:

- `block-class.ts`'s capitalised arms survive **because those fixtures are still spelled
  in the capitalised vocabulary**.
- `make-coverage-fixtures.mjs`'s writer is frozen **because re-pointing it would re-derive
  those same twelve fixtures**.

So the trigger for one is the act the other is waiting on. Re-spelling the fixtures is
exactly what re-deriving them would do. **A later reader who re-spells the fixtures
discharges both triggers at once and must retire both rows together** — which is what
`ROADMAP.md:814` means by "one decision taken twice, not two". Neither row can be
discharged alone: deleting `block-class.ts`'s arms without re-deriving the fixtures
changes the census silently, and re-pointing the writer without deleting the arms leaves
two arms matching nothing.

The twelve directories, from
`git ls-files 'src/mcp/vice/fixtures/coverage/*/project.regen2000proj'` — **re-measured,
count = 12**:

```
fp1-indexed-copy-loop        fp1b-immediate-copy-loop
fp2-zeropage-data-pointer    fp2b-immediate-data-pointer
fp3-unlinked-push-idiom      fp3b-immediate-push-idiom
nc1-all-auto                 nc1b-auto-renamed-in-place
nc2-generic-comments         nc3-all-data-blocks
nc4-multi-caller-unnamed     nc5-well-documented
```

---

## 3. Research assumption A7, resolved — and a correction to where the block types live

Research marked A7 **NOT MEASURED — planner must verify**: are the fixtures' block types
actually spelled `"Code"` / `"Byte"` / `"Undefined"`?

**They are — but not in the file the plan's task text names.**

The plan directs the executor to read `project.regen2000proj` and check its block types.
Measured, parsed as JSON rather than grepped:

> **All twelve `project.regen2000proj` files carry `"blocks": []`.** Zero blocks, therefore
> zero block-type tokens, in either vocabulary.

The block types live in the **sibling `store.json`** in each of the same twelve
directories — which is what `block-class.ts:178`'s own comment says
(`fixtures/coverage/**/store.json`), and which the plan's read-first list did not follow.
Structural census over those twelve `store.json` files:

| fixture directory | blocks | `block.type` values |
|---|---|---|
| `fp1-indexed-copy-loop` | 0 | — |
| `fp1b-immediate-copy-loop` | 0 | — |
| `fp2-zeropage-data-pointer` | 0 | — |
| `fp2b-immediate-data-pointer` | 0 | — |
| `fp3-unlinked-push-idiom` | 0 | — |
| `fp3b-immediate-push-idiom` | 0 | — |
| `nc1-all-auto` | 2 | `Code`, `Byte` |
| `nc1b-auto-renamed-in-place` | 2 | `Code`, `Byte` |
| `nc2-generic-comments` | 2 | `Code`, `Byte` |
| `nc3-all-data-blocks` | 1 | `Byte` |
| `nc4-multi-caller-unnamed` | 2 | `Code`, `Byte` |
| `nc5-well-documented` | 2 | `Code`, `Byte` |
| **total** | **11** | `Code` × 5, `Byte` × 6 |

**A7's substance is confirmed: the capitalised vocabulary is live in the committed
fixtures, so the new removal trigger stands and the verdict is `kept-unchanged`.** The
correction is to the *location*, and it matters: an executor who read only
`project.regen2000proj`, saw `"blocks": []`, and concluded the fixtures were already
re-spelled would have deleted a load-bearing arm.

### 3.1 A second finding — half the "deliberately kept" arm is already inert

Measuring A7 properly produces something the trigger's own wording does not admit.
`block-class.ts` keeps **two** capitalised arms:

```
195:      if (block.type === "Code") return "code";
196:      if (block.type === "Undefined") return "undefined";
```

Against the committed fixtures:

- **`:195` is load-bearing.** It rescues exactly **5** blocks. Delete it today and those
  five reclassify from `code` to `data`, silently — `data` is the total fallthrough and no
  error is raised anywhere.
- **`:196` is already inert.** `"Undefined"` appears **0** times in any committed fixture.
  Its stated justification — "every committed coverage fixture is still spelled in that
  vocabulary" — **does not hold for it**.
- `"Byte"` × 6 already falls through to `data`. That is by design, not a casualty.

The comment at `:180` says deleting the arms "reclassifies every fixture block as `data`".
Directionally right, quantitatively loose: **6 of the 11 already resolve to `data`**, and
only 5 change.

**Recorded, not acted on.** Deleting a half-inert arm is a change to a live classifier.
This phase has no build remit (`ROADMAP.md`: "This phase contains no build work by
design") and the arm's removal is explicitly deferred here. The finding belongs to whoever
owns the re-spelling.

---

## 4. Why twelve tracked files named after a retired producer survive a path-scanning gate

This is a real gap in coverage and it belongs in the record.

The removal gate's scope is `git ls-files` minus the `.planning/` **prefix**, UNION
`packFiles("installer").files` mapped back onto disk. It matches on the subject
**needle** — a literal the gate composes at runtime from two fragments so its own source
never carries it contiguously.

The fixture filename is **`project.regen2000proj`**. It carries **`regen2000`**, which is
**not** the subject literal. So twelve tracked files sit squarely inside the gate's scope,
named after the retired producer, and the gate correctly reports nothing — because the
string it looks for is not there.

**This is not a gate defect.** It is the limit of a literal-matching gate, and it is
precisely why these two fates could not be carried by either object-store content
predicate and had to be mandated by a document instead. It is also why `SET_C_FLOOR` is
asserted with `!==` rather than `>=`: the only thing standing between these two members
and invisibility is a note somebody could reword.

---

## 5. `r2000-upstream-audit.test.ts` — a rename the derivation cannot express

Filed here because it is the one place in this phase where a *verdict* and a *measured
fact* do not line up, and burying that in a registry note would be the exact failure this
audit exists to prevent.

**Measured.** `git show --format="" --name-status -M c59fcef` reports:

```
R091	src/mcp/vice/r2000-upstream-audit.test.ts	src/mcp/vice/anno-derivation.test.ts
```

A 91 %-similarity **rename**, inside the very commit the derivation records as the
removing commit. Three independent confirmations:

1. The commit's own subject: `refactor(29-05): move the four unpaired guard tests, ...`.
2. The successor's header, in words: *"RENAMED from `r2000-upstream-audit.test.ts` by
   phase 29 plan 29-05. Renamed ONLY — plan 29-08 adds this file's surface-derivation
   half."*
3. **All five** of the predecessor's test names survive verbatim in
   `anno-derivation.test.ts` today (`Phase 19 pins and classifies all five upstream
   analysis procedures`, `every non-curated upstream call carries a justification and a
   citation`, `ABS-04's re-sync triggers are named and each carries a mechanism`, `the
   elected licence is one of the two the upstream dual licence offers`, and the fifth at
   `:255`).

**Why the derivation still puts it in `forwardGone`.** The forward map resolves successors
by exactly two mechanisms and both miss this one:

- **End-to-end `git diff -M 0394cbc 345d5c4` does not score it.** The file grew from
  **207** lines to **478** across `904763e` (which added the MCP-01 derivation half) and
  `1d40ad0`, dropping the pair below git's similarity threshold over the full span even
  though the single commit scores R091.
- **The name-descendant predicate cannot reach it.** `nameDescendantCandidates()` replaces
  the *prefix* and keeps the *stem*, yielding `anno-upstream-audit.test.ts`,
  `absorbed-upstream-audit.test.ts` and `upstream-audit.test.ts`. Here the **stem** changed
  (`upstream-audit` → `derivation`). All three candidates were checked and none exists.

**Why the verdict is `deleted` anyway, and why that is not a laundering.** The successor is
independently derived into **set B** and carries its own row. A `superseded` verdict naming
it would make two rows claim `src/mcp/vice/anno-derivation.test.ts` as `newSubject`, and
the registry's duplicate-`newSubject` check rejects that outright. Every other verdict is
structurally unavailable to the successor's own row (`kept-unchanged` and `re-pointed`
both require a non-empty `newSubject`; `deleted` requires the path to be absent, and it is
present). **The relationship is not expressible in the registry as the guard is currently
written.**

So the row records `deleted` — under which every machine-checkable claim it makes is
literally true: the path is absent, all three name-descendants are absent, and
`c59fcef` resolves — and its note carries this finding in full. Threat **T-32-34** is
"a `deleted` row that is really a rename **nobody looked for**". Somebody looked, found it,
measured it, and wrote it down. **The coverage is not lost and it is not unaudited**: it
lives at `src/mcp/vice/anno-derivation.test.ts`, whose row is `re-pointed` and carries a
machine-captured observed red behind a green control.

**The recommended fix, for a plan that owns the guard.** Give `deriveForwardMap()` a third
mechanism: for each member that would otherwise land in `gone`, look inside its removing
commit for an `R` entry naming it as the source. That is mechanical, deterministic and
derived from the object store — fully in the spirit of the existing two — and it is a
**strengthening**, not a relaxation. It would resolve this rename, move the member into
`renamed`, and let the adjacency subtraction remove `anno-derivation.test.ts` from set B.
The consequence is a floor change: `SET_B_FLOOR` 16 → 15 and `TOTAL_FLOOR` 61 → 60 —
which is, notably, exactly the arithmetic `32-08-PLAN.md` predicted before the blind spot
was found. Not done here: changing a derivation predicate and two committed floors at the
wave that closes the phase is architectural, and this plan measures and records.

---

## 6. The two rows, and what each records

### 6.1 `src/mcp/vice/block-class.ts`

- **Verdict:** `kept-unchanged`; `newSubject` = itself.
- **Existence proof:** on the working tree; live arms at `:195` and `:196`; the
  `TRANSITIONAL` comment block opens at `:171`; its "Deleting the two arms" sentence is at
  `:180`. **All three plan citations re-measured and matching.**
- **Original trigger — already satisfied, and insufficient:** the *producer's* absence. The
  external analyser whose Rust `Display` emitted the capitalised spellings was deleted in
  Phase 29 on 2026-08-29. The trigger fired; the arm still stands, deliberately.
- **New trigger:** the twelve fixtures being **re-spelled** into the store's lowercase
  vocabulary, together with their generator, *and the census then observed unchanged* —
  only then may the arms go.
- **No `observedRed`.** The guard's predicate rejects one on `kept-unchanged`.

### 6.2 `src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs`

- **Verdict:** `kept-unchanged`; `newSubject` = itself.
- **Existence proof:** on the working tree; `synthesizeProject()` defined at `:121` and
  called at `:943`; header line at `:43`. **`:121`, `:943` and `:43` match the plan
  exactly.** One citation corrected: the plan gives the FROZEN PROJECT-FILE WRITER block as
  `:67-97`; measured, its title line is at `:67` and the block runs to its closing rule at
  `:107`, so the range is **`:66-107`**.
- **Original trigger — already satisfied, and insufficient:** the retired analyser's
  project module being deleted. Plan 29-10 deleted it on 2026-08-30 and **inlined**
  `synthesizeProject()` as a module-private writer emitting byte-for-byte identical JSON,
  rather than re-pointing it.
- **New trigger:** the writer being **re-pointed onto the Phase 28 annotation store**,
  which re-derives all twelve fixtures and changes what the census controls measure.
- **A correction to the mandating note.** `ROADMAP.md:816` says "The re-point is Phase 30's
  work on Phase 30's evidence." The source has since corrected that forecast **in place**:
  `make-coverage-fixtures.mjs:88-92` records that the phase once named for it "shipped the
  ACME export oracle and nothing store-native to re-point onto, so **no phase currently
  owns** the file this writer would be re-pointed at." The trigger is a **condition** — a
  store-native project file landing — not a scheduled phase, and no phase currently owns
  creating that condition. The row records the condition.
- **Why the freeze is checkable:** determinism is part of this file's contract. Running the
  generator twice must leave `git status --porcelain src/mcp/vice/fixtures/coverage` empty,
  so a single changed byte in any of the twelve committed files fails. No timestamp, no
  random value, no host-dependent path is emitted. If this writer and those fixtures ever
  disagree, **the fixtures are the authority, not the code** — they are the only remaining
  record of the format.
- **No `observedRed`.** Same reason.

---

## 7. No re-point was performed — the mechanical assertion

Threat **T-32-36** is performing a deferred re-point while recording its fate. Asserted at
this commit:

```
git diff --exit-code -- src/mcp/vice/fixtures/coverage/ src/mcp/vice/block-class.ts   →   exit 0
grep -ac 'block.type === "Code"' src/mcp/vice/block-class.ts                          →   1
```

The twelve fixtures are **byte-identical**, both capitalised arms are still present,
`synthesizeProject()` was not re-pointed, and no fixture was re-spelled. The only files
this task changed are `guard-fates.json` and this document.

---

## 8. How to re-derive everything in this document

```bash
WT_ROOT=$(git rev-parse --show-toplevel) && cd "$WT_ROOT"

# section 1 — set C, parsed from the mandating note
node -e 'import("./scripts/check-guard-fates.mjs").then(m=>console.log(m.deriveAuditedSet({root:process.cwd()}).setC))'

# section 2 — the twelve fixture directories
git ls-files 'src/mcp/vice/fixtures/coverage/*/project.regen2000proj' | wc -l   # 12

# section 3 — the block-type census (parse as JSON; a grep census misses nothing here,
# but `blocks` is nested and the empty-array case is what a grep would silently skip)
node -e 'const {readFileSync}=require("fs");const {execFileSync}=require("child_process");
const f=execFileSync("git",["ls-files","src/mcp/vice/fixtures/coverage/*/store.json"],{encoding:"utf8"}).split("\n").filter(Boolean);
const c={};let n=0;for(const p of f){for(const b of (JSON.parse(readFileSync(p,"utf8")).blocks||[])){n++;c[b.type]=(c[b.type]||0)+1}}
console.log("files",f.length,"blocks",n,c)'

# section 3.1 — the arms
grep -an 'block.type === "Code"\|block.type === "Undefined"' src/mcp/vice/block-class.ts

# section 5 — the rename the derivation cannot see
git show --format="" --name-status -M c59fcef -- src/mcp/vice/r2000-upstream-audit.test.ts src/mcp/vice/anno-derivation.test.ts

# section 7 — nothing moved
git diff --exit-code -- src/mcp/vice/fixtures/coverage/ src/mcp/vice/block-class.ts
```

Every `grep` in this document is run with `-a`. A NUL byte can hide a file from a plain
`grep`, and this repository already carries one such file
(`src/mcp/vice/anno-memmap-render.ts`); a census that silently skipped a file has already
produced one wrong decision here.
