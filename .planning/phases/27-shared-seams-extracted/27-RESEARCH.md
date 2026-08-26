# Phase 27: Shared Seams Extracted - Research

**Researched:** 2026-08-26
**Domain:** In-repo module extraction (no external technology). Verification-first pass over `src/mcp/vice/`.
**Confidence:** HIGH — every claim below was obtained by reading the live tree at `1785165` this session. Zero external lookups were needed or made.

## Summary

This was a **narrow re-verification pass**, not an open investigation. The roadmap
records that milestone research already enumerated every consumer by file and
symbol; `27-CONTEXT.md` locks D-01..D-17. Accordingly this document does not
re-derive settled decisions. It does three things: (1) re-checks every cited
`file:line` and symbol against the tree at HEAD and reports drift, (2) enumerates
the live ground truth SEAM-02's registry must cover, (3) writes the validation
architecture the planner's Nyquist strategy is derived from.

**Overall verdict on `27-CONTEXT.md`: substantially accurate.** Of ~40 cited
line references, **36 are exact**. Two are off by two lines. Two counts are wrong
in ways that change the work. And one factual claim in `<canonical_refs>` is
**wrong in a way that would leave the exact hazard SEAM-02 exists to remove** —
that is the single most valuable finding in this document (Correction C-1).

**Primary recommendation:** Plan the gate split first and independently (D-05's
child-process proof is observable on its own), then the coverage adapter, then
the registry, then the two extraction-scope items. Before writing any
`<acceptance_criteria>`, apply Corrections C-1 through C-6 below — each one is a
place where following `27-CONTEXT.md` verbatim produces a wrong instruction.

## Corrections to `27-CONTEXT.md` (observed evidence)

These are the findings the scope direction asked for. Each is stated with the
observed evidence, not a preference.

### C-1 (HIGH IMPACT) — `decodeRawData` is a fifth un-recorded capability dependency, and CONTEXT's reason for excluding it does not hold

`27-CONTEXT.md` `<canonical_refs>` states, verbatim:

> `src/mcp/vice/r2000-project.ts:171-195` — `parsePrg`, `flatImageOrigin` (note `decodeRawData` at `:202` is r2000-payload-specific and does **not** move)

Two observations contradict the parenthetical.

**(a) Its body is not r2000-specific.** `[VERIFIED: src/mcp/vice/r2000-project.ts:196-204]`, quoted verbatim:

```
/**
 * The inverse of the `raw_data_base64` encoding step: base64-decode then
 * gunzip. Exported so tests can prove the payload round-trips exactly,
 * rather than asserting against an opaque blob.
 */
export function decodeRawData(base64: string): Uint8Array {
  return gunzipSync(Buffer.from(base64, "base64"));
}
```

The function is two generic calls. Only its *doc comment* ties it to r2000's
`raw_data_base64` field. It is exactly as "pure and prefix-free" as `parsePrg`
and `flatImageOrigin`, which D-08/D-14 extract on precisely that ground.

**(b) A criterion-2 capability module statically imports it.**
`[VERIFIED: src/mcp/vice/r2000-coverage.ts:131-134]`, quoted verbatim:

```
import { decode, type Instruction } from "./disasm-decoder.ts";
import { decodeRawData } from "./r2000-project.ts";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./r2000-confidence.ts";
import { readFileSync } from "node:fs";
```

`r2000-coverage.ts` is one of the ten modules criterion 2 says are "provably not
deletable by prefix". `r2000-project.ts` is D-08's named `glue-with-extractable`
instance. **So after Phase 27 as CONTEXT specifies it, deleting
`r2000-project.ts` in Phase 32 breaks the coverage census** — a capability whose
loss does not announce itself. That is the precise failure mode SEAM-02 exists
to prevent, left in place by the one line of CONTEXT that waves it away.

`r2000-coverage.test.ts:64` imports it too `[VERIFIED: grep, src/mcp/vice/r2000-coverage.test.ts:64]`.

**Recommended resolution (planner's call, both discharge it):**
1. *Minimum, does not overrule CONTEXT:* record `decodeRawData` as a **named
   extractable symbol** in `r2000-project.ts`'s `glue-with-extractable` registry
   entry (D-08 explicitly exists to name "the specific symbols that must move
   out before the module may be deleted"). Cost: one registry field. Phase 32
   cannot then discharge the obligation by ignoring it.
2. *Cleaner:* move it into `prg-image.ts` alongside `parsePrg`/`flatImageOrigin`
   in this phase. It is the same shape of pure byte-level helper and it already
   has a non-glue consumer. Cost: `prg-image.ts` gains a `node:zlib` import; two
   more import sites to repoint (`r2000-coverage.ts:132`,
   `r2000-coverage.test.ts:64`).

Option 2 is recommended: option 1 leaves the census's dependency on a
to-be-deleted module live for five more phases, and D-14's own rationale
("extracting now discharges that obligation immediately instead of leaving Phase
32 to do it under deletion pressure") applies with equal force. Either way the
planner must **state the choice**; silently following CONTEXT's parenthetical is
the one route that leaves the hazard.

### C-2 — `r2000-test-gate.ts` keeps **ten** importers, not nine, and one import statement must be *split* rather than rewritten

D-01 states: "`r2000-test-gate.ts` keeps only the regenerator2000 half and its
nine remaining importers." Measured against the tree, the regenerator2000 half
has **ten** importing files. The undercount arises because CONTEXT treated the
four ACME importers as disjoint from the remainder (13 distinct importers − 4 =
9), but **`r2000-cli.test.ts` imports both halves**.

`[VERIFIED: src/mcp/vice/r2000-cli.test.ts:22-28]`, quoted verbatim:

```
import {
  R2000_AVAILABLE,
  skipReasonFor,
  assertR2000RequiredIfEnvSet,
  ACME_AVAILABLE,
  assertAcmeRequiredIfEnvSet,
} from "./r2000-test-gate.ts";
```

**Consequence for the plan:** three of the four ACME importers get their import
line *rewritten*; `r2000-cli.test.ts` gets its single import statement **split
into two** — one retaining `R2000_AVAILABLE`, `skipReasonFor`,
`assertR2000RequiredIfEnvSet` from `./r2000-test-gate.ts`, one taking
`ACME_AVAILABLE`, `assertAcmeRequiredIfEnvSet` from the new module. Note also
that `r2000-cli.test.ts` imports `ACME_AVAILABLE`/`assertAcmeRequiredIfEnvSet`
but **not** `ACME_BIN`/`acmeSkipReasonFor` — an acceptance criterion asserting
"all four files import `ACME_BIN`" would be false.

### C-3 — There is exactly **one** `codeOnly()`, not two; and `stock-dispatch.test.ts` deliberately does **not** borrow it

The roadmap Notes say: "the `codeOnly()` / `shippedTsModules()` helpers
`stock-dispatch.test.ts:2889,2919` borrows from `r2000-spawn-seam.test.ts`".
D-15 says "two of `codeOnly()`".

Measured: `grep -n "^function codeOnly"` across `src/mcp/vice/` returns exactly
one hit — `r2000-spawn-seam.test.ts:65` `[VERIFIED: src/mcp/vice/r2000-spawn-seam.test.ts:65]`.

The two cited `stock-dispatch.test.ts` lines are **prose, not definitions**:
- `:2889` is inside a header comment: `// the same shippedTsModules() idiom r2000-spawn-seam.test.ts already`
- `:2919` is inside a doc comment that explicitly declines `codeOnly()`. `[VERIFIED: src/mcp/vice/stock-dispatch.test.ts:2913-2923]`, quoted verbatim:

```
/** Strips comment lines (a line whose first non-whitespace characters open a
 * `//`, `/*`, or `*` continuation line) before scanning -- capability-registry
 * .ts's OWN doc comment quotes both forbidden shapes as prose describing what
 * NOT to do (335-346), and this file's own comments quote WR-13's fixed
 * wording; neither is a live occurrence. Line-oriented, not the fuller
 * codeOnly() string-literal stripper r2000-spawn-seam.test.ts uses -- no
 * shipped module's non-comment code has any legitimate reason to hold either
 * forbidden phrase inside a string literal either, so the simpler filter is
 * sufficient here. */
function nonCommentLines(src: string): string[] {
  return src.split("\n").filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line));
}
```

So `stock-dispatch.test.ts` borrows **only** `shippedTsModules()` (its own copy
at `:2902`), and holds a *fifth* distinct comment-stripper (`nonCommentLines()`
at `:2925`) whose non-use of `codeOnly()` is a recorded, reasoned decision.

**Consequence:** `codeOnly()` has exactly **one** consumer today
(`r2000-spawn-seam.test.ts` itself, at `:276` and `:493`). There is therefore
**no divergence hazard** for `codeOnly()` — the divergence argument D-15 makes
applies only to `shippedTsModules()`. The case for extracting `codeOnly()` is a
*survival* case, not a divergence case: `r2000-spawn-seam.test.ts` is an
`r2000-*.test.ts` file Phase 32 deletes, so `codeOnly()` dies with it. The
planner should either state that survival rationale explicitly, or scope D-15 to
`shippedTsModules()` alone. See Open Question OQ-1 for the tension this creates
with the "no partial repoints" principle.

### C-4 — D-16's convention is recorded in **two** places, not one; clarifying only one leaves the record self-contradictory

D-16 names `comment-phase-pointers.test.ts:53-59`. That reference is exact.
`[VERIFIED: src/mcp/vice/comment-phase-pointers.test.ts:53-59]`, quoted verbatim:

```
// MODULE SET: shippedTsModules() is copied verbatim from
// docs-dangling-refs.test.ts (package.json's files[] filtered to
// .ts/.mts, with an existence assertion so the scanned set cannot shrink
// silently). Kept as a second, independent copy rather than an import --
// this file and docs-dangling-refs.test.ts each own their own scan
// end-to-end, matching this codebase's established "no import between
// sibling guard tests" convention.
```

But a second, independently-worded statement of the same convention exists that
CONTEXT does not name. `[VERIFIED: src/mcp/vice/hop-chain-comments.test.ts:46-50]`, quoted verbatim:

```
// sitting inside a template literal). Kept as a second, independent copy
// rather than an import -- this codebase's established convention is that
// each guard test owns its own scan end-to-end (`comment-phase-pointers
// .test.ts`'s own header records that same decision for the same helpers).
// Keep the copy verbatim so a future reader can diff the two.
```

This second copy is worded **more broadly** ("each guard test owns its own scan
end-to-end", with no "between sibling guard tests" qualifier) and ends with a
*positive instruction to keep duplicating*. Rewriting only
`comment-phase-pointers.test.ts:53-59` leaves `hop-chain-comments.test.ts:46-50`
asserting the unqualified version — precisely the "silent contradiction in the
record" D-16 exists to avoid. **Both comments must be rewritten in the same
commit.** (Note: `hop-chain-comments.test.ts` duplicates the *comment
extractor*, not `shippedTsModules()`, so nothing in D-15 repoints it — only its
comment needs the clarification.)

### C-5 — Two line-number drifts (off by two)

| Citation in `27-CONTEXT.md` | Observed | Status |
|---|---|---|
| `ACME_AVAILABLE` at `r2000-test-gate.ts:132` (D-05) | `r2000-test-gate.ts:**134**` | drift, −2 |
| `storeBlockTypeAt`, `r2000-coverage.ts:1662` (D-11) | `r2000-coverage.ts:**1662**` | **exact** |

`[VERIFIED: src/mcp/vice/r2000-test-gate.ts:133-134]`, quoted verbatim:

```
/** Probed once at module load, shared by every importing test file. */
export const ACME_AVAILABLE: boolean = probeAcme();
```

The substance of D-05 is unaffected — `ACME_AVAILABLE` **is** evaluated once at
module load, so no in-process test can re-probe, and the child-process design
stands. Only the cited line number is stale.

The one other drift: `r2000-project.ts:171-195` is cited for `parsePrg` +
`flatImageOrigin`. `parsePrg` is at `:171` and `flatImageOrigin` at `:188`
(exact), but `flatImageOrigin`'s body ends at `:194` and its doc comment starts
at `:182` — the range `171-195` is correct as a span. No action.

### C-6 — The criterion-3 test is **not** named `COV-01`/`COV-02` in its own file

Criterion 3 and D-13 refer to "`COV-01`/`COV-02`'s census-versus-store boundary
test" at `r2000-coverage.test.ts:604`. The line number is exact, but the test's
own name carries neither id. `[VERIFIED: src/mcp/vice/r2000-coverage.test.ts:600-606]`, quoted verbatim:

```
// ---------------------------------------------------------------------------
// 2. Independence -- the load-bearing structural claim
// ---------------------------------------------------------------------------

test("independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report", () => {
  const before = reportFor(WELL_DOCUMENTED);
  const oneType: R2000BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];
```

The literal strings `COV-01` and `COV-02` appear elsewhere in that file — at
`:578`, `:592` (a *different* test: "no key anywhere in the report matches a
combined-figure vocabulary"), and `:816`, `:913` `[VERIFIED: grep -n "COV-01\|COV-02" src/mcp/vice/r2000-coverage.test.ts]`.

**Consequence:** an acceptance criterion written as "grep for `COV-01` in
`r2000-coverage.test.ts` and confirm it passes" targets the wrong test. The
criterion must name the test by its **title string** (`"independence: rewriting
every block entry to one type…"`) or by its line, not by requirement id.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01: The ACME half is a hard move out of `r2000-test-gate.ts` — no
  re-export shim.** `ACME_BIN`, `probeAcme`, `ACME_AVAILABLE`,
  `acmeSkipReasonFor` and `assertAcmeRequiredIfEnvSet` move to a new module and
  all four importing test files get their import line rewritten:
  `disasm-roundtrip.test.ts:57`, `skill-acme-build-cli.test.ts:47`,
  `r2000-cli.test.ts:28`, `r2000-answer-key.test.ts:228-231`.
  `r2000-test-gate.ts` keeps only the regenerator2000 half and its nine
  remaining importers. A shim was rejected precisely because it would leave the
  deletion hazard intact: with a re-export in place, deleting `r2000-*` still
  breaks four test files, which is the failure `SEAM-01` exists to remove.
  Verified: `grep -c` of the ACME symbols under `r2000-*` reaching zero is the
  observable form of this decision.
  — **Reversibility:** reversible — five symbols and four import lines.

- **D-02: The new module is `src/mcp/vice/acme-gate.ts`.** `test-gate.ts` is
  **not available**: `test-gate.mjs` (the MANUAL_ONLY_TESTS gate) and
  `test-gate.d.mts` / `test-gate.test.ts` already occupy that name in the same
  directory and do a different job — they gate *which tests run*, not *whether
  an external binary exists*. `acme-gate.ts` reads consistently with the
  repo's `<domain>-<role>.ts` convention (`backend-detect`, `stock-condition`,
  `disasm-decoder`). `acme-probe.ts` was rejected because `vice-probe.ts`
  already means "liveness probe of a running thing", a different job.
  — **Reversibility:** reversible.

- **D-03: `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` keep
  byte-identical names.** Measured fact from the scout: `.github/workflows/ci.yml`
  binds **only the env var names** (`ci.yml:140`, `VICE_REQUIRE_ACME: "1"`) and
  never references the module path. So ci.yml needs **no functional edit** — the
  "repointed in the same commit" clause in `SEAM-01` is satisfied by comment
  accuracy, not by a code change. A planner must not invent a ci.yml code change
  to satisfy the requirement text; it must instead *state* that ci.yml binds by
  env-var name and confirm the names did not move.
  — **Reversibility:** one-way — renaming either variable silently converts CI's
  hard-FAIL into a skip, with a green run either way. This is the second silent
  failure mode the roadmap's Ordering constraint 1 names.

- **D-04: The new module gets its own `acme-gate.test.ts`**, carrying (a) the
  `package.json` `files[]`-absence assertion for `acme-gate.ts` and (b)
  criterion 1's hard-FAIL proof. `r2000-verify.test.ts:187` is left alone — it
  is still correct about `r2000-test-gate.ts`. Extending that assertion was
  rejected: it would put a non-`r2000` module's only structural guard inside an
  `r2000-*` test file, re-creating the exact prefix-deletion hazard this phase
  removes.
  — **Reversibility:** reversible.

- **D-05: Criterion 1's FAIL is proven by a committed child-process test, not a
  one-off transcript.** `ACME_AVAILABLE` is evaluated once at module load
  (`r2000-test-gate.ts:132`), so no in-process test can re-probe. The test
  spawns a child `node --test` run with `VICE_REQUIRE_ACME=1` and `ACME_BIN`
  pointed at a nonexistent path, and asserts a **non-zero exit** plus the
  assertion message. It re-runs on every CI run forever, so the gate cannot
  silently rot after Phase 32 rearranges the tree. Cost: one extra child
  process per suite run.
  — **Reversibility:** reversible.

- **D-06: The record is a committed registry data file plus an enforcing test,
  not a prose document.** The test enumerates `src/mcp/vice/r2000-*` on disk and
  **FAILS** when any module has no registry entry, so a module added later
  cannot slip in unclassified. A `docs/` page was rejected as the sole record:
  nothing fails when it goes stale, and its consumer (Phase 32) is five phases
  away.
  — **Reversibility:** costly — Phase 32's deletion decisions are meant to read
  this file rather than re-derive the verdict under deletion pressure. Replacing
  it later means re-establishing trust in a record written *after* deletions
  began, which is the one thing criterion 2 says cannot be done.

- **D-07: Each entry's basis is surviving consumers plus requirement ids —
  never the name prefix.** An entry names the concrete files/symbols that break
  if the module vanishes, plus any requirement it implements (`r2000-symbols` →
  the ✓ Validated `R2000-14`/`R2000-15` symbol round trip; `r2000-coverage` →
  `COV-01`/`COV-02`). **Capability** means it has a consumer or a requirement
  that survives the substrate swap. The enforcing test asserts every cited
  consumer path exists on disk and that no entry's justification rests on the
  prefix. That is what makes criterion 2's "no classification cites a name
  prefix" checkable rather than a promise.
  — **Reversibility:** costly — the basis is the evidence Phase 32 acts on.

- **D-08: Three verdicts, not two: `capability`, `glue`, `glue-with-extractable`.**
  The third names the specific symbols that must move out before the module may
  be deleted. `r2000-project.ts` is the concrete instance — it is glue that
  drives the regenerator2000 binary, but it also holds `parsePrg`
  (`r2000-project.ts:171`) and `flatImageOrigin` (`:188`), which are pure and
  prefix-free. This turns "also extractable" from a nice-to-have into a recorded
  obligation Phase 32 cannot discharge by ignoring it.
  — **Reversibility:** reversible.

- **D-09: The registry lives in `src/mcp/vice/` and is deliberately absent from
  `package.json`'s `files[]`.** Next to the modules it classifies, so registry
  drift and the enumerating test show up in one diff. It is bookkeeping, not
  runtime — same `files[]` rule as the gate (D-04). A `.planning/` location was
  rejected because the test would then reach out of `src/mcp/vice/`, which
  nothing else in the suite does.
  — **Reversibility:** reversible.

- **D-10: The boundary is an adapter module with a neutral vocabulary.** A new
  non-`r2000` module owns the upstream Rust `Display` strings and exposes a
  neutral shape (e.g. `blockClassAt(blocks, addr) → "code" | "data" |
  "undefined" | null`). After the move `r2000-coverage.ts` contains **no**
  literal `"Code"` / `"Undefined"` / `"Byte"` comparison anywhere. Phase 28
  swaps the adapter, not the census. Rejected: an injected default-argument
  mapping (a caller that forgets it silently gets upstream's vocabulary back —
  exactly the failure that should be loud) and an interface-only declaration
  (names the boundary without moving anything, so the census still dies with the
  prefix).
  — **Reversibility:** costly — Phase 28's store repoint is written against this
  boundary; changing its shape later moves the census's only contact surface.

- **D-11: All three comparison sites route through the adapter — including the
  divergence sub-report.** The requirement text says "two functions"
  (`storeBlockTypeAt`, `r2000-coverage.ts:1662`; `classFromStore`, `:1683`), but
  the scout found a **third** site: the boundary-audit block at
  `r2000-coverage.ts:1983-1986` compares `blockType !== "Code"` and
  `blockType === "Code"` directly. Leaving it behind would leave the census
  holding upstream's vocabulary and quietly falsify criterion 3. Treat
  "two functions" as the requirement's measurement, not as an exhaustive list.
  — **Reversibility:** reversible.

- **D-12: `r2000-coverage.ts` keeps its name this phase.** Only its store
  contact moves; the census itself is protected by its registry entry (D-06/D-07)
  rather than by a rename. It is 2292 lines with a 4315-line test file, no
  criterion requires the rename, and renaming it makes criterion 4's
  "demonstrably a move" much harder to read in the diff. The rename stays
  available to Phase 31/32 once its consumers are already repointed.
  — **Reversibility:** reversible.

- **D-13: The adapter is proven substitutable by a second implementation, not by
  a string search.** A new test feeds the census a *different* block-vocabulary
  implementation through the adapter and asserts the census's byte counts are
  unchanged while only the divergence sub-report moves. This is the same shape
  as the existing independence test at `r2000-coverage.test.ts:604` (the
  mass-rewrite-to-one-type test `COV-01`/`COV-02` already own), and it is the
  property Phase 28 actually needs. A structural "no Rust literal survives in
  the census" guard proves absence of a string, not substitutability — it is
  available as a supplement at the planner's discretion, not as the proof.
  — **Reversibility:** reversible.

- **D-14: `prg-image.ts` is extracted in this phase.** `parsePrg` and
  `flatImageOrigin` move out of `r2000-project.ts` into a new
  `src/mcp/vice/prg-image.ts`. They are the concrete instance behind
  `r2000-project.ts`'s `glue-with-extractable` verdict (D-08), so extracting now
  discharges that obligation immediately instead of leaving Phase 32 to do it
  under deletion pressure. **Unlike the gate, this module ships**:
  `r2000-project.ts` is in `package.json`'s `files[]`, so `prg-image.ts` must be
  added there too, and `scripts/check-npm-packages.mjs` validates the resulting
  tarball contents.
  — **Reversibility:** costly — adding a file to `files[]` changes the published
  tarball; removing it later is a packaging change to a published contract.

- **D-15: `shippedTsModules()` / `codeOnly()` are extracted to one shared
  test-only helper, and all copies are repointed.** The scout found **four**
  hand-copies of `shippedTsModules()` — `r2000-spawn-seam.test.ts:176`,
  `stock-dispatch.test.ts:2902`, `docs-dangling-refs.test.ts:353`,
  `comment-phase-pointers.test.ts:400` — and two of `codeOnly()`
  (`r2000-spawn-seam.test.ts:65`, plus the partial variants in
  `disasm-decoder.test.ts:308`, `disasm-renderer.test.ts:346`,
  `disasm-opcodes.test.ts:394`, `r2000-tools.test.ts:201`). The roadmap names
  only `stock-dispatch`'s copy. Four copies of a `files[]`-derived module
  enumerator is exactly the divergence hazard `r2000-test-gate.ts`'s own header
  was written to stop. Test-only, so the helper stays out of `files[]`.
  **Scope note for the planner:** the four `shippedTsModules()` copies are
  verbatim and repoint cleanly. The `codeOnly()` variants in the three
  `disasm-*` / `r2000-tools` test files are *partial* strippers doing a
  different job (comments only, not string bodies) — repoint only the true
  `codeOnly()` copies, and leave the partial ones unless they turn out
  identical on inspection.
  — **Reversibility:** reversible.

- **D-16: The "no import between sibling guard tests" convention is clarified,
  not overruled.** `comment-phase-pointers.test.ts:53-59` records its copy as a
  deliberate independence choice: *"Kept as a second, independent copy rather
  than an import — this file and `docs-dangling-refs.test.ts` each own their own
  scan end-to-end."* The convention forbids one guard test importing **another
  guard test**. Importing a neutral non-test helper module is a different thing
  — `r2000-spawn-seam.test.ts:53` already imports `r2000-test-gate.ts` exactly
  that way. So the extraction is compatible with the convention, **and that
  comment is rewritten in the same commit** to state the convention's scope
  explicitly, so it is not re-read later as a ban on all sharing. Leaving the
  comment as written while repointing the file would be a silent contradiction
  in the record.
  — **Reversibility:** reversible.

- **D-17: The green-run evidence names the command and states the broker was
  stopped.** A live VICE broker makes the `BACK-05` D→G ordering test go red
  **deterministically** — a known, recorded environmental condition with an open
  todo (`.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md`).
  It is a pre-existing red, not something this extraction causes, and fixing it
  is **out of scope** (broker behaviour, no requirement in this phase). The
  evidence must therefore name the exact command (`npm test`, the full
  `*.test.*` glob — **not** `npm run test:automated`, which skips
  `MANUAL_ONLY_TESTS`) and state the broker was stopped.
  — **Reversibility:** reversible.

### Claude's Discretion

The following were left open with a stated lean; the planner decides:

- **Adapter module name (D-10).** Lean: `block-class.ts` or
  `annotation-blocks.ts` — must not say `r2000`, and must not collide with
  anything already in `src/mcp/vice/`. Check the directory before choosing.
- **Whether `R2000BlockEntry` (and `R2000Symbol` / `R2000Comment`) move with the
  adapter (`r2000-coverage.ts:192-219`).** Lean: `R2000BlockEntry` moves (it is
  the store's shape and its doc comment literally documents the Rust `Display`
  vocabulary); the other two stay, since nothing in this phase touches them.
  If they move, they are renamed off the `R2000` prefix.
- **Whether the registry also covers `r2000-*.test.ts` files and
  `r2000-regbits.json`.** Lean: cover the 16 non-test modules plus
  `r2000-regbits.json` (it is in `files[]`); leave test files out, since a test
  file's fate follows its module's.
- **Registry file format** (TS module with a typed const, vs JSON). Lean: TS —
  the enforcing test gets type-checking for free and `tsconfig` already covers
  the directory.
- **Plan decomposition.** The roadmap's Ordering constraint 1 is binding: the
  gate split precedes any deletion, in the same commit or earlier. Since this
  phase deletes nothing, the constraint is satisfied by construction — but the
  gate work should still land first so criterion 1 is observable independently
  of the rest.

**One standing hazard for the enforcing test (D-06):** assert *relations*, not
counts. A pinned "there are exactly 16 `r2000-*` modules" assertion goes red on
a correct tree the moment a module is added or extracted — the failure mode
already seen in `audit-integrity.test.ts`. The test's contract is "every module
on disk has an entry and every cited consumer exists", never a total.

### Deferred Ideas (OUT OF SCOPE)

- **Renaming `r2000-coverage.ts` off the prefix.** Explicitly deferred by D-12
  to Phase 31/32, once its consumers are already repointed.
- **The remaining `r2000-*` capability renames** (`-acme-ident`, `-confidence`,
  `-symbols`, `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen`).
  This phase records their classification (D-06/D-07); it does not rename them.
  Whether they ever need renaming is a Phase 32 question the registry exists to
  answer.
- **The partial `codeOnly()` variants** in `disasm-decoder.test.ts:308`,
  `disasm-renderer.test.ts:346`, `disasm-opcodes.test.ts:394` and
  `r2000-tools.test.ts:201` — comment-only strippers doing a different job. Not
  consolidated (D-15).
- Six reviewed todos, none folded (broker, capture and planning concerns).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description (verbatim, `REQUIREMENTS.md:68-70`) | Research Support |
|----|-------------|------------------|
| SEAM-01 | "The ACME availability gate is extracted out of `r2000-test-gate.ts` under a name that does not say `r2000`, keeping `ACME_BIN`, `VICE_REQUIRE_ACME` and `assertAcmeRequiredIfEnvSet` working for `disasm-roundtrip.test.ts` and `skill-acme-build-cli.test.ts` — and `ci.yml` is repointed in the same commit, because CI binds those names directly (`ci.yml:45-140`). Proven by observing a missing-ACME run **FAIL** under `VICE_REQUIRE_ACME=1`, not skip" | §Verified Reference Map rows 1-8 (all five symbols + their exact lines); §ci.yml Binding Audit (proves **no** ci.yml code edit is needed, D-03 confirmed); Correction C-2 (the importer set is 4 ACME + 10 r2000-half, one file in both); §Validation Architecture V-1 (the child-process hard-FAIL design, with the in-repo precedent named) |
| SEAM-02 | "Every `r2000-*` module that is a **capability rather than glue** is identified by what it does and not by its name prefix, and the classification is recorded before any deletion — at minimum `r2000-test-gate`, `-acme-ident`, `-confidence`, `-symbols` (which *implements* the ✓ Validated `R2000-14`/`R2000-15` symbol round trip), `-verify`, `-memmap-render`, `-d64`, `-regbits-gen`, `-enum-gen` and `-coverage`. A module whose only claim to deletion is its prefix is not deleted" | §SEAM-02 Ground Truth — the full on-disk module list, every module's live consumer set by file:line, and the requirement ids each serves; §Glue-vs-Capability Discriminator (why "has a non-`r2000` consumer" is *not* the test); Correction C-1 (a fifth capability dependency CONTEXT excludes); OQ-2 (`-verify`'s contested classification); §Registry Scope Gaps |
| SEAM-03 | "`r2000-coverage.ts`'s store contact is reduced to a named, repointable boundary — measured as two functions comparing against upstream's Rust `Display` strings — so the coverage census survives the substrate swap intact rather than being deleted as glue. `COV-01`/`COV-02`'s census-versus-store boundary test passes against the new store" | §The Coverage Boundary, Measured — all three comparison sites + both `storeBlockTypeAt()` call sites verified at exact lines with verbatim quotes; §The Stale Header Invariant (the module's own "one call site" claim is already false and the adapter is what makes it true); Correction C-6 (the criterion-3 test is not named `COV-01`/`COV-02`); §Validation Architecture V-3 (D-13's second-implementation design) |
</phase_requirements>

## Project Constraints (from CLAUDE.md)

Directives extracted from `./CLAUDE.md` that bear on this phase. The planner must
verify compliance; none of them is contradicted by anything recommended here.

| Directive | Bearing on Phase 27 |
|---|---|
| **Architecture:** "Any host-facing path or hostname must go through `hostpath.ts` / `containerpath.ts` / `container-guard.mts`. The project maintains a tested closed consumer set for host-path logic." | `hostpath-consumers.test.ts` is that closed set's guard. Neither `acme-gate.ts`, `prg-image.ts`, the adapter nor the registry may import `hostpath.ts`/`containerpath.ts` — none has any reason to. See §Guards That Will Automatically See the New Modules. |
| **Architecture:** "Derived tools must be intercepted before `forwardToVice()`, not behind `call()`… (Line numbers in this bullet are checked against the source at each phase and drift between phases; treat a mismatch as drift to re-verify.) `docs-linerefs.test.ts` mechanically checks the two `rewriteArguments()` citations." | **No contact.** Phase 27 touches no tool registration and does not edit `vice-proxy.ts`. `docs-linerefs.test.ts` pins only `CLAUDE.md`'s `rewriteArguments()` bullet against `vice-proxy.ts` line numbers `[VERIFIED: src/mcp/vice/docs-linerefs.test.ts:37-99]` — unaffected. No `CLAUDE.md` edit is required by this phase. |
| **Tech stack:** "Node ≥ 22.18 (native TypeScript type-stripping — the shipped server has no build step). Host-bound `.mts` files must still be compiled by `build.ts` into committed `resources/*.mjs`, and `resources-sync.test.ts` fails CI on drift." | Nothing in this phase is host-bound `.mts`. All four new modules are `.ts`, run under type-stripping, and need **no** `build.ts` change. Node on this host is `v22.22.0` `[VERIFIED: node --version]`. |
| **Testing:** "`vice-sync.ts`'s checkpoint-wait functions are deliberately not unit-tested… Preserve the documented invariants." | No contact. |
| **Concurrency / broker constraints** (single-client, single-owner `inFlight`, etc.) | No contact — but see D-17: a *running* broker reddens `BACK-05` in `vice-proxy.test.ts`, so the green-run evidence must state the broker was stopped. Confirmed no broker process running on this host at research time. |
| **GSD Workflow Enforcement:** "Do not make direct repo edits outside a GSD workflow." | This research pass made **zero** edits to `src/`. |

## Architectural Responsibility Map

This phase has no runtime tiers — it is a compile-time/test-time module
reorganisation inside a single Node package. The map is therefore over
*enforcement* tiers rather than request tiers.

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| ACME binary availability probe (`probeAcme`, `ACME_AVAILABLE`) | Test-harness seam (`acme-gate.ts`, not in `files[]`) | CI env binding (`ci.yml` env vars) | It gates *whether external-oracle tests may skip*. It is not shipped runtime behaviour, exactly as `r2000-test-gate.ts` is not. `r2000-verify.test.ts:187`'s `files[]`-absence pattern is the enforcement. |
| CI hard-FAIL switch (`VICE_REQUIRE_ACME`) | CI configuration (`ci.yml:140`) | Test-harness seam (reads `process.env`) | CI owns *setting* it; the module owns *honouring* it. The binding is by env-var name only — no module path crosses the boundary. This is why D-03's "no ci.yml code edit" holds. |
| `r2000-*` capability-or-glue classification | Committed data + enforcing test (registry in `src/mcp/vice/`, not in `files[]`) | Phase 32 deletion decisions (downstream consumer) | Bookkeeping, not runtime. Colocated with the modules so drift and the enumerating test land in one diff (D-09). |
| Block-vocabulary translation (Rust `Display` → neutral class) | Adapter module (non-`r2000`, ships or not per §Discretion Resolutions) | `r2000-coverage.ts` census (consumer only) | The census must own *derivation from bytes*; the store's vocabulary is a foreign contract. Phase 28 swaps the adapter, never the census (D-10). |
| `.prg` / flat-64K byte-layout parsing | Shipped runtime module (`prg-image.ts`, **in** `files[]`) | `r2000-cli.ts` + five test files (consumers) | Pure byte-level C64 file-format knowledge with no regenerator2000 dependency. Its one shipped consumer (`r2000-cli.ts:56`) is why it must be in `files[]`. |
| `files[]`-derived shipped-module enumeration | Test-only shared helper (not in `files[]`) | Four guard test files (consumers) | Four identical copies of one `package.json`-reading enumerator is a divergence hazard; the shared helper is a neutral non-test module, which D-16 establishes is *not* what the convention forbids. |

## Verified Reference Map (SEAM-01)

Every reference `27-CONTEXT.md` inherits for the gate split, re-checked against
the tree at `1785165`. **"exact"** means the cited line number matches what is on
disk today.

### The five ACME symbols in `src/mcp/vice/r2000-test-gate.ts` (166 lines total)

| Symbol | CONTEXT cites | Observed | Status |
|---|---|---|---|
| `ACME_BIN` | — | `:116` | exact (uncited) |
| `probeAcme` | — | `:122` | exact (uncited) |
| `ACME_AVAILABLE` | `:132` (D-05) | **`:134`** | **drift, −2** |
| `acmeSkipReasonFor` | — | `:143` | exact (uncited) |
| `assertAcmeRequiredIfEnvSet` | — | `:158` | exact (uncited) |
| The ACME half's boundary | `:96-166` | `:97-166` (banner comment opens at `:97`) | effectively exact |
| The ACME half's rationale | `:96-113` | `:97-112` | effectively exact |

`[VERIFIED: src/mcp/vice/r2000-test-gate.ts:97-134]`, quoted verbatim (the block
that must travel with the code, per `<code_context>`):

```
// ---------------------------------------------------------------------------
// The ACME half of the same gate (D-08).
//
// WHY IT LIVES HERE TOO: `disasm-roundtrip.test.ts` established the
// `ACME_BIN`/`VICE_REQUIRE_ACME` convention in an earlier phase, and
// `r2000-cli.test.ts` hand-copied it for criterion 3. The Phase 11
// validation audit needed a THIRD copy for criterion 1's fixture
// reproducibility check -- which is precisely the divergence this module's
// own header exists to stop. So the probe lives here instead, and every
// ACME-gated test file (`disasm-roundtrip.test.ts`, `r2000-cli.test.ts`)
// imports it from here rather than copying it.
//
// The env var names are deliberately UNCHANGED (`ACME_BIN`,
// `VICE_REQUIRE_ACME`) -- it is the same external-oracle claim, and CI
// already installs ACME and sets the latter.
// ---------------------------------------------------------------------------

/** Overridable ACME binary name, matching disasm-roundtrip.test.ts's own
 * original convention exactly. */
export const ACME_BIN: string = process.env.ACME_BIN ?? "acme";

/** Spawns `${ACME_BIN} --version`, falling back to `--help` (ACME 0.97
 * prints its banner to either depending on build), and checks the combined
 * output for the literal (case-insensitive) substring "acme". Never throws:
 * a spawn error is "not available", not a test failure. */
export function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8", timeout: 10_000 });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

/** Probed once at module load, shared by every importing test file. */
export const ACME_AVAILABLE: boolean = probeAcme();
```

**Note for the planner:** `spawnSync` is imported once at
`r2000-test-gate.ts:34` (`import { spawnSync } from "node:child_process";`) and
is used by **both** halves. `acme-gate.ts` needs its own copy of that import;
`r2000-test-gate.ts` keeps its (the R2000 probe still uses it).

Two additional header facts that must be carried into `acme-gate.ts`'s own header
`[VERIFIED: src/mcp/vice/r2000-test-gate.ts:25-33]`, quoted verbatim:

```
// This module is TEST-ONLY. It must never appear in package.json's `files[]`
// (a test-only helper has no business in the published npm tarball), and it
// must never be imported by a production module -- only by `*.test.ts`
// files. `r2000-verify.test.ts` asserts the `files[]` absence mechanically.
//
// This file's own name deliberately does NOT match the `*.test.*` glob
// `package.json`'s `"test"` script runs (`node --test '*.test.*'`) -- it is
// imported BY test files, not itself a test file, and must never be
// collected as one.
```

`acme-gate.ts` satisfies the second rule by name. It must satisfy the first by
staying out of `files[]`, asserted by its own `acme-gate.test.ts` (D-04).

### The four ACME importers (count CONFIRMED: exactly four; no fifth exists)

A repo-wide grep for all five symbol names across `*.ts`/`*.mts`/`*.mjs`/`*.yml`/
`*.json`/`*.md`/`*.sh` outside `node_modules` and `.planning/` returned **only**
these four importing files, plus one comment-only mention.

| File | CONTEXT cites | Observed | Symbols imported | Action |
|---|---|---|---|---|
| `disasm-roundtrip.test.ts` | `:57` | **`:57` exact** | `ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet` | rewrite one line |
| `skill-acme-build-cli.test.ts` | `:47` | **`:47` exact** | `ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet` | rewrite one line |
| `r2000-cli.test.ts` | `:28` | **`:22-28` exact** (statement spans 22-28) | `R2000_AVAILABLE, skipReasonFor, assertR2000RequiredIfEnvSet, ACME_AVAILABLE, assertAcmeRequiredIfEnvSet` | **SPLIT into two statements** — see Correction C-2 |
| `r2000-answer-key.test.ts` | `:228-231` | **`:227-231` exact** (statement opens `import {` at `:227`) | `ACME_BIN, acmeSkipReasonFor, assertAcmeRequiredIfEnvSet` | rewrite the statement |

**Comment-only mention, not an importer:** `r2000-launch.ts:65` — a doc comment
reading *"Overridable binary name, mirroring `disasm-roundtrip.test.ts`'s `ACME_BIN`"*.
`[VERIFIED: grep, src/mcp/vice/r2000-launch.ts:65]`. No repoint needed.

**Prose sites to update for comment accuracy** (each names
`r2000-test-gate.ts` as the ACME seam and will be false after the split):
`disasm-roundtrip.test.ts:60-65`, `skill-acme-build-cli.test.ts:15-16`,
`r2000-cli.test.ts:679-684`, `r2000-answer-key.test.ts:220-221`,
`r2000-spawn-seam.test.ts:158-175` (its `shippedTsModules()` doc comment cites
`r2000-test-gate.ts` as the motivating unshipped-spawn-site example — after this
phase `acme-gate.ts` is a *second* instance of exactly that shape and the comment
should say so).

### The ten remaining (regenerator2000-half) importers — count CORRECTED from nine

| # | File | Import line | Symbols |
|---|---|---|---|
| 1 | `r2000-symbol-roundtrip.test.ts` | `:45` | `skipReasonFor, assertR2000RequiredIfEnvSet` |
| 2 | `r2000-project.test.ts` | `:60` | `R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet` |
| 3 | `r2000-verify.test.ts` | `:39` | `R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet` |
| 4 | `r2000-enum-gen.test.ts` | `:23` | `skipReasonFor, assertR2000RequiredIfEnvSet` |
| 5 | `r2000-memmap-render.test.ts` | `:22` | `skipReasonFor, assertR2000RequiredIfEnvSet` |
| 6 | `r2000-session.test.ts` | `:21` | `R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet` |
| 7 | `r2000-tools.test.ts` | `:37` | `R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet` |
| 8 | `r2000-spawn-seam.test.ts` | `:53` | `skipReasonFor, assertR2000RequiredIfEnvSet` |
| 9 | `r2000-mcp-client.test.ts` | `:99` | `R2000_BIN, skipReasonFor, assertR2000RequiredIfEnvSet` |
| **10** | **`r2000-cli.test.ts`** | **`:22-28`** | **`R2000_AVAILABLE, skipReasonFor, assertR2000RequiredIfEnvSet`** (the half it keeps) |

`[VERIFIED: grep -rn 'from "./r2000-test-gate.ts"' src/mcp/vice/]`. Distinct
importers: **13**. ACME half: **4**. R2000 half: **10**. Overlap: **1**
(`r2000-cli.test.ts`).

### `r2000-verify.test.ts:187` — the `files[]`-absence assertion (left alone)

`[VERIFIED: src/mcp/vice/r2000-verify.test.ts:187-194]`, quoted verbatim:

```
test("r2000-test-gate.ts is absent from package.json's files[] array (test-only, mechanically enforced)", () => {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files: string[] };
  assert.ok(Array.isArray(pkg.files), "package.json must declare a files[] array");
  assert.equal(
    pkg.files.includes("r2000-test-gate.ts"),
    false,
    "r2000-test-gate.ts is test-only and must never ship in the published npm tarball"
  );
});
```

Cited line `:187` is **exact**. It remains true after the split (the module still
exists, still test-only, still absent from `files[]`). **No edit.** D-04's
reasoning for not extending it holds.

### `hostpath-consumers.test.ts:204` — resolved: `acme-gate.ts` does **not** belong

`27-CONTEXT.md` flags this as an open check. Resolved with evidence: **no**.

`[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:199-207]`, quoted verbatim:

```
test("INT-01's positive control: the four modules the audit found uncovered are present in the derived r2000 set", () => {
  // The finding's own reproduction, kept as a permanent test: if a future
  // rename or move drops one of these out of the glob, this says which one
  // -- rather than the absence test below silently stopping short again.
  const modules = r2000ProductionModules();
  for (const name of ["r2000-acme-ident.ts", "r2000-regbits-gen.ts", "r2000-symbols.ts", "r2000-test-gate.ts"]) {
    assert.ok(modules.includes(name), `${name} (named by INT-01 as uncovered) must be present in the derived r2000 module set`);
  }
});
```

The assertion is membership in `r2000ProductionModules()` — a glob over
`r2000-*.ts`. `acme-gate.ts` can never match it; **adding it would break the
test**. Phase 27 neither deletes nor renames `r2000-test-gate.ts`, so this test
continues to pass unchanged. Its sibling floor is also safe:
`[VERIFIED: src/mcp/vice/hostpath-consumers.test.ts:188]` — `const R2000_MODULE_FLOOR = 14;`
against **16** `r2000-*.ts` production modules on disk. Phase 27 adds and removes
zero, so `16 >= 14` still holds. **No edit to this file.**

## ci.yml Binding Audit (D-03 CONFIRMED)

`.github/workflows/ci.yml` is 392 lines. Every case-insensitive `acme` occurrence:

| Line | Content class | Names a module path? |
|---|---|---|
| 45 | step name: `Install ACME cross-assembler (DISASM-03 round-trip gate)` | no |
| 46-61 | comment prose (package name, banner-grep rationale, apt retry rationale) | no |
| 78-81 | shell: `retry_apt install -y acme`; `command -v acme`; `{ acme --version \|\| acme --help; }`; `grep -qi acme /tmp/acme-banner.txt` | no |
| 83-92 | step name + comment: `Assemble the acme-build scaffold (library-free)` | no |
| 97-100 | shell: `ACME= node src/skills/acme-build/scripts/acme.mjs new/build` (a *different* env var, `ACME`, consumed by the skill script) | no |
| 114 | comment: `disasm-roundtrip.test.ts turns "ACME absent" from a named SKIP` | **names a test file**, not the gate module |
| **140** | **`VICE_REQUIRE_ACME: "1"`** — the env binding, followed by `run: npm test` at `:141` | **no** |
| 163 | comment: `These suites need no ACME and no emulator` | no |

`[VERIFIED: grep -n -i "acme" .github/workflows/ci.yml; sed -n '104,145p' .github/workflows/ci.yml]`

**Verdict: D-03 is exactly right.** `ci.yml` binds by env-var name only. `ACME_BIN`
does not appear in `ci.yml` at all. `VICE_REQUIRE_ACME: "1"` at `:140` is exact.
**No ci.yml code edit is required or permitted** to satisfy `SEAM-01`'s
"repointed in the same commit" clause. The only candidate edit is a comment: `:114`
names `disasm-roundtrip.test.ts` (still correct) — so even the comment needs no
change. A planner adding a `ci.yml` code change here is inventing work; a planner
*renaming* either env var is triggering the one-way failure D-03 warns about.

The `ci.yml:141` command choice is itself guarded, which is load-bearing for D-17:
`[VERIFIED: src/mcp/vice/ci-guardrails.test.mjs:334]` — a test asserting
*"ci.yml's Test step still runs the FULL `*.test.*` glob (npm test), not the
narrowed automated gate — BACK-05's only end-to-end wire proof (vice-proxy.test.ts,
ok 116-ok 119) is a MANUAL_ONLY_TESTS entry and reaches CI only via this bare-glob
invocation"*. Its sibling at `:387` guards the other half (redefining the npm
script). Neither is affected by Phase 27.

## SEAM-02 Ground Truth

Obtained from the live tree, not from prose. **Relations and lists only — no
pinned total is stated as an invariant** (per `27-CONTEXT.md`'s standing hazard
note and the `audit-integrity.test.ts` history).

### Every `src/mcp/vice/r2000-*` entry on disk

`[VERIFIED: git ls-files | grep -i r2000; ls src/mcp/vice/r2000-*]`

**Non-test modules** (`.ts`), alphabetical:
`r2000-acme-ident.ts`, `r2000-cli.ts`, `r2000-confidence.ts`, `r2000-coverage.ts`,
`r2000-d64.ts`, `r2000-enum-gen.ts`, `r2000-launch.ts`, `r2000-mcp-client.ts`,
`r2000-memmap-render.ts`, `r2000-project.ts`, `r2000-regbits-gen.ts`,
`r2000-session.ts`, `r2000-symbols.ts`, `r2000-test-gate.ts`, `r2000-tools.ts`,
`r2000-verify.ts` — **sixteen**, matching CONTEXT's "16 non-test modules" lean.

**Data file:** `r2000-regbits.json` (in `files[]`; generated, header warns
against hand-editing).

**Test files** (`r2000-*.test.ts`), alphabetical: `r2000-answer-key`,
`r2000-cli`, `r2000-confidence`, `r2000-coverage-grammar`, `r2000-coverage`,
`r2000-d64`, `r2000-enum-gen`, `r2000-launch`, `r2000-mcp-client`,
`r2000-memmap-render`, `r2000-project`, `r2000-regbits`, `r2000-session`,
`r2000-spawn-seam`, `r2000-symbol-roundtrip`, `r2000-tools`,
`r2000-upstream-audit`, `r2000-verb-coverage`, `r2000-verify`.

**All ten modules named in criterion 2 are present**: `-test-gate` ✓,
`-acme-ident` ✓, `-confidence` ✓, `-symbols` ✓, `-verify` ✓, `-memmap-render` ✓,
`-d64` ✓, `-regbits-gen` ✓, `-enum-gen` ✓, `-coverage` ✓. The six *not* named by
criterion 2 are `-cli`, `-launch`, `-mcp-client`, `-project`, `-session`, `-tools`
— the glue candidates.

### Registry Scope Gaps (must be stated, not discovered later)

Three items sit outside the glob D-06 specifies (`src/mcp/vice/r2000-*`):

1. **`scripts/lib/r2000-cli-verbs.mjs`** and **`scripts/lib/r2000-cli-verbs.d.mts`**
   `[VERIFIED: git ls-files | grep -i r2000]`. `CUT-04` names the former
   explicitly. A registry scoped to `src/mcp/vice/r2000-*` is structurally blind
   to both.
2. **`src/mcp/vice/docs-r2000-decisions.test.ts`** — an `r2000`-named guard that
   the glob `r2000-*` does **not** match (it starts `docs-`). Not a gap in the
   glob's correctness, but a name a future reader will expect to be covered.
3. **`r2000-regbits.json`** — matches the glob but is not a module. If the
   enforcing test globs `r2000-*` without an extension filter, it will demand a
   registry entry for a JSON data file. CONTEXT's lean is to cover it; either
   way the test's filter must be **explicit**, not incidental.

**Recommendation:** the registry states its own scope as a field or header
comment, and the enforcing test asserts that scope. Extending it to
`scripts/lib/r2000-cli-verbs.*` is cheap (two entries) and closes a `CUT-04`
blind spot five phases early. If the planner scopes it narrowly, the exclusion
must be *written down* — an unstated exclusion is the failure D-06 exists to stop.

### Consumer map — the raw material for D-06/D-07 entries

Every static/dynamic import of each non-test module, from the live tree
`[VERIFIED: grep -rn 'from "./r2000-<m>.ts"' src scripts]`. **`†` marks a
consumer that is itself `r2000-*` and therefore does not survive Phase 32.**

| Module | Consumers (file:line) | Requirement ids it serves | Criterion-2 named? |
|---|---|---|---|
| `r2000-acme-ident.ts` | `r2000-tools.ts:104`†, `r2000-enum-gen.ts:86`†, `r2000-symbols.ts:76`† | `EXPORT-02` (ACME identifier legality / the 11 typed label prefixes) — **its only non-`†` basis** | ✓ |
| `r2000-confidence.ts` | `r2000-coverage.ts:133`† (but a *capability*), `r2000-memmap-render.test.ts:21`†, `r2000-cli.test.ts:904`† | supplies the grade tokens `classFromStore()` reads (`COV-01`/`COV-02`) | ✓ |
| `r2000-coverage.ts` | `r2000-cli.ts:74,75`†, `r2000-coverage-grammar.test.ts:71`†, `r2000-coverage.test.ts:62`† | `COV-01`, `COV-02` | ✓ |
| `r2000-d64.ts` | `r2000-cli.ts:57`†, `r2000-d64.test.ts:13`†, `r2000-cli.test.ts:20`† | `.d64` image reading — pure C64 format knowledge, no r2000 dependency | ✓ |
| `r2000-enum-gen.ts` | `r2000-cli.ts:59`†, `r2000-enum-gen.test.ts:22`† | `EXPORT-*` adjacency; `R2000-13` lineage | ✓ |
| `r2000-memmap-render.ts` | `r2000-cli.ts:61`†, `r2000-memmap-render.test.ts:18`† | memory-map rendering (skill-facing) | ✓ |
| `r2000-regbits-gen.ts` | `r2000-enum-gen.ts:85`† (type-only), `r2000-regbits.test.ts:20,239`† ; produces `r2000-regbits.json` (in `files[]`) | VIC-II/SID/CIA register-bit tables | ✓ |
| `r2000-symbols.ts` | `r2000-cli.ts:60`†, `r2000-symbol-roundtrip.test.ts:46`† | **`R2000-14` / `R2000-15`** (✓ Validated symbol round trip) | ✓ |
| `r2000-test-gate.ts` | ACME half: 4 files (3 non-`†`: `disasm-roundtrip`, `skill-acme-build-cli`, plus `r2000-cli`†, `r2000-answer-key`†). R2000 half: 10, all `†` | `SEAM-01`; `DISASM-03` round-trip gate | ✓ |
| `r2000-verify.ts` | `r2000-cli.ts:58`†, `r2000-verify.test.ts:37`† | contested — see OQ-2 | ✓ |
| `r2000-cli.ts` | `vice-proxy.ts:309` (dynamic), `scripts/check-skill-tool-coverage.mjs:41,468,487,519` (parses its dispatch switch), `scripts/lib/r2000-cli-verbs.mjs:3`, `scripts/check-npm-packages.mjs:217`, `r2000-cli.test.ts:19`†, `r2000-verb-coverage.test.ts:9`† | none surviving — the CLI verbs are what `MCP-01` replaces | ✗ (glue) |
| `r2000-launch.ts` | `r2000-verify.ts:46`†, `r2000-symbols.ts:72`†, `r2000-mcp-client.ts:84`†, `r2000-cli.ts:55`†, `r2000-spawn-seam.test.ts:51`†, `r2000-symbol-roundtrip.test.ts:48`†, `r2000-launch.test.ts:35`† | none — spawns the regenerator2000 binary | ✗ (glue) |
| `r2000-mcp-client.ts` | `r2000-tools.ts:108,1163`†, `r2000-session.ts:102,554`†, `r2000-symbols.ts:73`†, `r2000-mcp-client.test.ts:97`†, `r2000-session.test.ts:36`† | none — speaks MCP to the r2000 binary | ✗ (glue) |
| `r2000-project.ts` | `r2000-cli.ts:56`†, `r2000-session.ts:94`†, **`r2000-coverage.ts:132`†(capability)**, `r2000-coverage.test.ts:64`†, plus 7 more `†` test files, `fixtures/coverage/make-coverage-fixtures.mjs:63` | `glue-with-extractable`: `parsePrg` `:171`, `flatImageOrigin` `:188`, **and `decodeRawData` `:202` — see C-1** | ✗ (glue-with-extractable) |
| `r2000-session.ts` | `r2000-tools.ts:1164`†, **`vice-proxy.ts:200`** (static, `closeR2000SessionSync`), `r2000-spawn-seam.test.ts:50`†, `r2000-tools.test.ts:38`†, `r2000-session.test.ts:29`† | none — r2000 session lifecycle | ✗ (glue) |
| `r2000-tools.ts` | **`vice-proxy.ts:194`** (`R2000_TOOL_DEFINITIONS, runR2000Tool`), `stock-dispatch.test.ts:44,1547`, `vice-proxy.test.ts:54`, `scripts/check-skill-tool-coverage.mjs:49`, plus 8 `†` sites | none — `MCP-01` replaces the surface | ✗ (glue) |

### Glue-vs-Capability Discriminator (a trap D-07's wording invites)

**"Has a non-`r2000`-prefixed consumer" is NOT the discriminator.** Two of the
six glue modules have prominent non-`r2000` consumers:

- `r2000-tools.ts` ← `vice-proxy.ts:194`, `stock-dispatch.test.ts:44`,
  `vice-proxy.test.ts:54`, `scripts/check-skill-tool-coverage.mjs:49`
- `r2000-session.ts` ← `vice-proxy.ts:200`
- `r2000-cli.ts` ← `vice-proxy.ts:309`, four `scripts/` files

`vice-proxy.ts` survives Phase 32; *its imports of these modules do not*. And two
of the ten capability modules have **no** non-`r2000` consumer at all
(`r2000-acme-ident.ts`, `r2000-confidence.ts`) — their basis is a requirement id,
not a consumer.

So D-07's "surviving consumers plus requirement ids" must be read as: **a
consumer that survives *the substrate swap*, or a requirement id.** The enforcing
test can check the *cheap half* mechanically (every cited consumer path exists on
disk; no justification string matches `/^r2000-/` or reads "prefix") but cannot
mechanically decide survival. That judgement belongs in the committed data, which
is exactly why D-06 wants data + test rather than a doc.

**Suggested minimal entry shape** (TS const, per the Discretion lean):

```ts
{
  module: "r2000-symbols.ts",
  verdict: "capability",
  basis: {
    consumers: [{ path: "r2000-cli.ts", symbol: "exportLabels", line: 60 }, ...],
    requirements: ["R2000-14", "R2000-15"],
  },
  extractables: [],            // non-empty only for "glue-with-extractable"
}
```

The test then asserts, for every module in scope: an entry exists; `basis` is
non-empty; every `consumers[].path` exists on disk; `requirements` entries match
a known-id shape; `extractables` is non-empty **iff** `verdict ===
"glue-with-extractable"`; and no `basis` field mentions the prefix. Note the
`consumers[].line` field is a **drift liability** — this document's own audit
found the roadmap's line numbers had drifted by 2 in two places. Recommend
citing `path` + `symbol` and making `line` optional/advisory, or asserting the
line contains the symbol (the `docs-linerefs.test.ts` pattern at `:66-83` is the
in-repo precedent for that check).

## The Coverage Boundary, Measured (SEAM-03)

### The store input shapes

`[VERIFIED: src/mcp/vice/r2000-coverage.ts:192-218]`, quoted verbatim:

```
export interface R2000Symbol {
  address: number;
  name: string;
  /** `LabelKind`'s Debug form: `"User"`, `"Auto"` or `"System"`. */
  kind: string;
  /** `LabelType`'s Debug form (`"Subroutine"`, `"AbsoluteAddress"`, ...). */
  type?: string;
}

export interface R2000Comment {
  address: number;
  /** `"line"` or `"side"`. */
  type: string;
  comment: string;
}

export interface R2000BlockEntry {
  start_address: number;
  end_address: number;
  /** `BlockType`'s Display string: `"Code"`, `"Byte"`, `"Address"`, ... */
  type: string;
}

export interface R2000CrossReference {
  address: number;
  /** The sorted, deduped caller list `r2000_get_cross_references` returns. */
  callers: readonly number[];
}
```

Exact lines: `R2000Symbol` `:192`, `R2000Comment` `:201`, **`R2000BlockEntry`
`:208`**, `R2000CrossReference` `:215`. CONTEXT's cited range `192-219` is
correct as a span. **`R2000BlockEntry` is the only one of the four whose doc
comment documents the Rust `Display` vocabulary** — confirming the Discretion
lean that it, and only it, moves with the adapter.

### The boundary functions and all three comparison sites

`[VERIFIED: src/mcp/vice/r2000-coverage.ts:1662-1690]`, quoted verbatim:

```
function storeBlockTypeAt(blocks: readonly R2000BlockEntry[], address: number): string | null {
  for (const block of blocks) {
    if (!block) continue;
    if (address >= block.start_address && address <= block.end_address) return block.type;
  }
  return null;
}

/** `provenTargets` is `provenDispatchTargets(dispatch)`, computed ONCE per
 * report by the caller. A bare membership test against the scan's own
 * `discoveredTargets` used to live here and inherited the ungated-pairing
 * defect straight into the reproducibility comparison (header trap 8); the
 * seam is passed in so there is no second, un-narrowed read of it. */
function classFromBytes(census: StructuralCensus, provenTargets: readonly number[], address: number): DerivedClass {
  if (provenTargets.includes(address)) return "code";
  const klass = classAt(census, address);
  if (klass === "reached-as-instruction") return "code";
  if (klass === "table-entry" || klass === "referenced-as-data") return "data";
  return "unreached";
}

function classFromStore(gradeToken: string | null, blockType: string | null): DerivedClass {
  if (gradeToken === "confirmed-code" || gradeToken === "probable-code") return "code";
  if (gradeToken === "confirmed-data" || gradeToken === "probable-data") return "data";
  // `[unknown]` and ungraded fall through to the store's own block type.
  if (blockType === "Code") return "code";
  if (blockType === null || blockType === "Undefined") return "unreached";
  return "data";
}
```

`[VERIFIED: src/mcp/vice/r2000-coverage.ts:1983-1986]`, quoted verbatim (the
**third** site D-11 adds):

```
      const blockType = storeBlockTypeAt(blockList, addr);
      if (blockType === null) uncoveredByStore++;
      if (run.class === "reached-as-instruction" && blockType !== "Code") censusCodeStoreNotCode++;
      if (run.class === "unreached" && blockType === "Code") storeCodeCensusUnreached++;
```

| Element | CONTEXT cites | Observed | Status |
|---|---|---|---|
| `DerivedClass` | `:1615-1690` (range) | `:1623` | exact within range |
| `ReproducibilityInput` | — | `:1650` | — |
| `storeBlockTypeAt` | `:1662` | **`:1662`** | **exact** |
| `classFromBytes` | `:1615-1690` (range) | `:1675` | exact within range |
| `classFromStore` | `:1683` | **`:1683`** | **exact** |
| Third comparison site | `:1983-1986` | **`:1983-1986`** | **exact** |
| Header independence invariants | `:59-70`, `:116-135` | `:59-75`, `:116-131` | effectively exact |

**Complete inventory of the literal Rust `Display` strings in `r2000-coverage.ts`**
`[VERIFIED: grep -n '"Code"\|"Undefined"\|"Byte"\|"Word"\|"Text"\|blockType' src/mcp/vice/r2000-coverage.ts]`:
`:211` (doc comment), `:1687`, `:1688`, `:1985`, `:1986`. **Five occurrences,
four of them live comparisons, all inside the three D-11 sites.** Plus one in the
test file at `r2000-coverage.test.ts:606` (`type: "Byte"` — a *fixture value*,
which correctly stays: the test exists to prove the store side can hold any
vocabulary).

**Both `storeBlockTypeAt()` call sites** (the lookup itself must route through
the adapter, not just the comparisons): `:1921` and `:1983`.
`[VERIFIED: src/mcp/vice/r2000-coverage.ts:1921]`, quoted verbatim:

```
    const fromStore = classFromStore(entry?.gradeToken ?? null, storeBlockTypeAt(blockList, address));
```

`blockList` is derived at two places: `:1852` (inside the reproducibility
function) and `:1976` (inside `computeDivergence`, declared `:1974`).

### The Stale Header Invariant — a correction the adapter *fixes*

`[VERIFIED: src/mcp/vice/r2000-coverage.ts:61-66]`, quoted verbatim:

```
//   1. NEVER derive any measure from the store's block-type listing. The
//      listing enters this file at one call site (`computeDivergence()`) and
//      leaves it as a comparison. A "completeness" number sourced from the
//      block table measures the annotator's bookkeeping, not the annotation
//      -- and mass `r2000_set_data_type` calls would move it for free.
```

The claim "**enters this file at one call site (`computeDivergence()`)**" is
**already false** against the code: the listing also enters at `:1921`, inside
the reproducibility comparison, via the same `storeBlockTypeAt()`. Two call
sites, two enclosing functions.

This is a genuine documentation drift the planner should know about, and it
argues *for* the adapter rather than against it: after D-10 lands, the listing
enters through **exactly one boundary** and the header's claim becomes true for
the first time. **Recommendation:** correct that comment in the same commit
(same discipline as D-16 — rewrite the record, don't route around it), restating
it as "enters this file only through `<adapter>.ts`". Leaving it as written while
introducing the adapter reproduces the D-16 failure shape.

The two invariants the adapter must **not** weaken
`[VERIFIED: src/mcp/vice/r2000-coverage.ts:124-127]`, quoted verbatim:

```
// BYTES-VERSUS-STORE: one side classifies an address using only the raw bytes
// and this file's census, the other using only the store's own documentation
// (confidence grade, block type). Neither side reads the other's input. The
// seal (`evidence/coverage-reproducibility/ANSWER.sha256`) is what makes the
```

The adapter sits on the **store** side only. It must never receive the census or
the bytes as an argument, or the independence axis collapses. That is the single
most important shape constraint on `blockClassAt()`.

### The criterion-3 test that must still pass

`[VERIFIED: src/mcp/vice/r2000-coverage.test.ts:604-623]`, quoted verbatim:

```
test("independence: rewriting every block entry to one type leaves every census byte count unchanged and moves only the divergence sub-report", () => {
  const before = reportFor(WELL_DOCUMENTED);
  const oneType: R2000BlockEntry[] = [{ start_address: 0x0810, end_address: 0x084f, type: "Byte" }];
  const after = reportFor(WELL_DOCUMENTED, { blocks: oneType });

  for (const key of ["reachedAsInstruction", "tableEntry", "referencedAsData", "unreached", "linearSweepDecodable", "rangeBytes"] as const) {
    assert.equal(
      after.structural[key],
      before.structural[key],
      `mass block-type rewrite moved structural.${key} -- the census must be a pure function of the bytes and the seed set`,
    );
  }
  assert.deepEqual(after.structural.classRuns, before.structural.classRuns);

  assert.equal(before.divergence.censusCodeStoreNotCode, 0);
  assert.ok(
    after.divergence.censusCodeStoreNotCode > 0,
    "the divergence sub-report did not move at all -- if it cannot move, the independence assertion above is vacuous",
  );
});
```

Note the built-in non-vacuity half at the end. D-13's second-implementation test
should copy that shape *including* the non-vacuity assertion — a substitutability
test where the divergence report cannot move proves nothing.

## Extraction Scope, Measured (D-14, D-15, D-16)

### `prg-image.ts` (D-14) — all consumers, and the shipped-module consequence

`[VERIFIED: src/mcp/vice/r2000-project.ts:166-194]` — `parsePrg` at `:171`,
`flatImageOrigin` at `:188`. Both exact.

| Consumer | Line | Import statement content | Action |
|---|---|---|---|
| **`r2000-cli.ts`** (SHIPPED) | `:56` | `import { synthesizeProject, parsePrg, flatImageOrigin } from "./r2000-project.ts";` | **SPLIT** — this is why `prg-image.ts` must be in `files[]` |
| `r2000-symbol-roundtrip.test.ts` | `:49` | `import { parsePrg, synthesizeProject } from "./r2000-project.ts";` | SPLIT |
| `r2000-verify.test.ts` | `:38` | `import { synthesizeProject, flatImageOrigin } from "./r2000-project.ts";` | SPLIT |
| `r2000-tools.test.ts` | `:36` | `import { synthesizeProject, flatImageOrigin } from "./r2000-project.ts";` | SPLIT |
| `r2000-mcp-client.test.ts` | `:98` | `import { synthesizeProject, flatImageOrigin } from "./r2000-project.ts";` | SPLIT |
| `r2000-project.test.ts` | `:54-55` | multi-line import listing `parsePrg`, `flatImageOrigin` among others, closing `:59` | SPLIT; the four `parsePrg`/`flatImageOrigin` unit tests at `:110-128` move to a new `prg-image.test.ts` or stay pointing at the new module |
| `r2000-d64.test.ts` | `:373-379` | **dynamic, non-literal** specifier: `await import(pathToFileURL(R2000_PROJECT_PATH).href)` | repoint the path constant; see note below |
| `r2000-cli.test.ts` | `:383,384,974,1245,1253,1259,1273` | **comment/assertion-message prose only** | comment accuracy |
| `r2000-d64.ts` | `:217,270` | **comment prose only** | comment accuracy |

**All six `SPLIT` rows are import statements that mix a moving symbol with a
staying one (`synthesizeProject`).** Not one of them is a plain rewrite. An
acceptance criterion saying "rewrite the import line" understates the work.

**The `r2000-d64.test.ts` dynamic import needs care.**
`[VERIFIED: src/mcp/vice/r2000-d64.test.ts:370-379]`, quoted verbatim:

```
    // A non-literal specifier, deliberately: this defers module resolution
    // (both TypeScript's static check and Node's runtime resolution) to a
    // path we have already confirmed exists on disk above -- a literal
    // `import("./r2000-project.ts")` would fail `tsc --noEmit` in this
    // isolated worktree even though the module is guaranteed to exist once
    // wave-1 merges.
    const mod = (await import(pathToFileURL(R2000_PROJECT_PATH).href)) as {
      parsePrg: (bytes: Uint8Array) => { origin: number; body: Uint8Array };
    };
```

This is a **worktree-isolation workaround**, and `use_worktrees` is `false` in
`.planning/config.json` `[VERIFIED: .planning/config.json workflow.use_worktrees]`.
The comment's stated reason no longer applies, but the code is correct either way.
Repointing it means changing `R2000_PROJECT_PATH` to a `prg-image.ts` path and
updating the comment. A `tsc --noEmit` run is the check.

**`files[]` consequences of adding `prg-image.ts`** — three guards begin scanning
it the moment it lands (see §Guards, below). This is the easiest thing in the
whole phase to miss.

### `shippedTsModules()` — four copies, all four verified

| File | CONTEXT/roadmap cites | Observed definition | Body |
|---|---|---|---|
| `docs-dangling-refs.test.ts` | `:353` | **`:353`** exact | canonical |
| `r2000-spawn-seam.test.ts` | `:176` | **`:176`** exact | identical body; assert message lacks the trailing comma the others have |
| `stock-dispatch.test.ts` | `:2902` (D-15) / `:2889` (roadmap) | **`:2902`** exact; `:2889` is a comment | identical |
| `comment-phase-pointers.test.ts` | `:400` | **`:400`** exact | identical |

`[VERIFIED: src/mcp/vice/docs-dangling-refs.test.ts:353-362]`, the canonical body,
quoted verbatim:

```
function shippedTsModules(): string[] {
  const pkg = JSON.parse(readFileSync(join(HERE, "package.json"), "utf8")) as { files?: string[] };
  const entries = (pkg.files ?? []).filter((f) => /\.(ts|mts)$/.test(f));
  for (const entry of entries) {
    assert.ok(
      existsSync(join(HERE, entry)),
      `package.json files[] names ${entry} but it does not exist on disk -- update files[] rather than letting the scanned set shrink silently`,
    );
  }
  return entries;
}
```

Two things the extraction must preserve, both from its doc comments:
1. **The existence assertion is load-bearing** (`docs-dangling-refs.test.ts:344-352`:
   *"A `files[]` entry that does not exist on disk FAILS this function rather than
   silently shrinking the scanned set (the INT-01 lesson applied preemptively)"*).
   The shared helper takes `assert` — or throws its own named error. It **cannot**
   silently return a short list.
2. **`r2000-spawn-seam.test.ts:155-175`'s doc comment explains why it is
   `files[]`-derived rather than `readdirSync`-derived, using `r2000-test-gate.ts`
   as the motivating example.** That rationale must travel with the helper. And
   after Phase 27, `acme-gate.ts` is a second instance of the same shape — a
   test-only module that spawns a real binary and must stay out of the scanned set
   — so the rationale gains a second example.

### `codeOnly()` — one definition; the four "variants" are not functions

| Cited site | Observed | What it actually is |
|---|---|---|
| `r2000-spawn-seam.test.ts:65` | **exact** | `function codeOnly(src: string): string` — a character-state-machine stripping comments **and** string/template literal bodies. Consumers: `:276`, `:493` (both in the same file) |
| `disasm-decoder.test.ts:308` | **exact** | `const codeOnly = source.split("\n").filter((line) => !line.trim().startsWith("//")).join("\n")` — a local `const` inside one test |
| `disasm-renderer.test.ts:346` | **exact** | byte-identical local `const` to the above |
| `disasm-opcodes.test.ts:394` | **exact** | byte-identical local `const` to the above |
| `r2000-tools.test.ts:201` | **exact** | `const codeOnly = rawSource.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")` — regex-based, different implementation |

**All four cited line numbers are exact.** And CONTEXT's judgement is confirmed
correct: they are genuinely a different job.
`[VERIFIED: src/mcp/vice/r2000-tools.test.ts:193-201]`, quoted verbatim — the
in-code statement of *why*:

```
  // Comment-strip only (never string-strip): the literal we are looking FOR
  // is itself a string, so blanking string content would make it
  // unobservable. codeOnly()-style full stripping is the right tool when a
  // check must ignore ALL string content (r2000-spawn-seam.test.ts's own
  // spawn-site scan); here the opposite is true -- we must inspect exactly
  // the literal call() receives, and comment-stripping alone is sufficient
  // to keep a doc-comment mention of "call(...)" from producing a false
  // positive, since no comment in this file contains that exact adjacency.
```

Two supplementary observations the planner may want:
- The **three `disasm-*` copies are byte-identical to each other** (a three-line
  `//`-comment-line filter). Consolidating *them* is a separate, real opportunity
  — and it is in the Deferred ledger, so it stays out.
- `stock-dispatch.test.ts:2925 nonCommentLines()` is a **fifth** distinct
  comment-stripper, with a recorded reason for not being `codeOnly()`. Also out.

### D-16's convention — see Correction C-4

Both recorded statements verified verbatim above. Both must be rewritten.
`r2000-spawn-seam.test.ts:53`'s existing import of `r2000-test-gate.ts` is the
precedent D-16 leans on, and it is real `[VERIFIED: src/mcp/vice/r2000-spawn-seam.test.ts:53]`:
`import { skipReasonFor, assertR2000RequiredIfEnvSet } from "./r2000-test-gate.ts";`

## Discretion Resolutions (with observed evidence)

### 1. Adapter module name — no collision on any candidate

`[VERIFIED: ls src/mcp/vice/ | grep -iE "block|annotation|prg|acme|registry|shipped"]` returns
only `capability-registry.test.ts`, `capability-registry.ts`, `r2000-acme-ident.ts`,
`skill-acme-build-cli.test.ts`.

| Candidate | Collision | Verdict |
|---|---|---|
| `block-class.ts` | none | **Recommended.** Reads as `<domain>-<role>` (`stock-condition`, `backend-detect`, `disasm-decoder`). Its exported function `blockClassAt()` reads naturally from the filename. Narrow — it says exactly what the module does: translate a block type to a class. |
| `annotation-blocks.ts` | none | Viable but broader — "annotation blocks" is Phase 28's *store* vocabulary, and naming a Phase-27 vocabulary-translation module after Phase 28's data model invites the assumption that it owns the blocks rather than translating them. |
| `acme-gate.ts` (D-01/D-02) | none | Confirmed available. `test-gate.mjs`, `test-gate.d.mts`, `test-gate.test.ts` all present, confirming D-02's rejection of `test-gate.ts`. |
| `prg-image.ts` (D-14) | none | Confirmed available. |
| Registry: **must not** be `capability-registry.*` | `capability-registry.ts` exists (BACK-05's per-backend delta) | Suggest `r2000-classification.ts`… **no** — it would match the `r2000-*` glob the enforcing test walks and demand an entry for itself. Suggest **`module-classification.ts`** or **`prefix-deletion-registry.ts`**. This self-matching trap is easy to walk into. |

### 2. Does `R2000BlockEntry` move with the adapter? — **Yes; the other two stay.**

Evidence: it is the only one of the four input shapes whose doc comment documents
the Rust `Display` vocabulary (`:211`, quoted above). Consumer inventory
`[VERIFIED: grep -rn "R2000BlockEntry" src scripts]`: `r2000-coverage.ts`
(`:208,1655,1662,1974,2059`), `r2000-coverage.test.ts` (`:58,122,606`),
`r2000-cli.ts` (`:75,1373,1379`). Three files. `R2000Symbol` and `R2000Comment`
have wider consumer sets (`r2000-coverage.ts:1409,1533,1559,1653,1654,2057,2058`,
`r2000-cli.ts:1371,1372,1377,1378`, `r2000-coverage.test.ts` ×6) and **nothing in
this phase touches them** — moving them would inflate criterion 4's diff for no
criterion. Recommended renamed form: **`BlockEntry`** (the `R2000` prefix drops;
the adapter module name supplies the namespace, matching `stock-*.ts`'s
convention of unprefixed exported types).

`r2000-cli.ts:75` is a type-only import (`import type { CoverageReport,
R2000BlockEntry, ... }`) — one more shipped-module import to split.

### 3. Registry scope — cover the 16 modules **and** `r2000-regbits.json`, exclude test files, and **state the two `scripts/lib/` exclusions explicitly**

Evidence for including `r2000-regbits.json`: it is in `files[]`
`[VERIFIED: src/mcp/vice/package.json files[]]` and it matches the `r2000-*`
glob, so an unfiltered enumerating test will demand an entry for it regardless of
intent. Better to include it deliberately than to add a silent extension filter.

Evidence for excluding test files: their fate follows their module's (CONTEXT's
own lean), and `test-gate.test.ts`'s drift guard already ensures every `*.test.*`
file lands in exactly one of the automated/manual sets — so no test file can go
unaccounted for. `[VERIFIED: src/mcp/vice/test-gate.test.ts:33-49]`.

Evidence for stating the `scripts/lib/r2000-cli-verbs.{mjs,d.mts}` exclusion:
`CUT-04` names the first one, and a registry that silently omits it is a
`CUT-04` blind spot the registry's whole purpose is to close.

### 4. Registry format — **TS module with a typed const**

Evidence: `tsconfig.json` covers the directory with `strict: true`,
`verbatimModuleSyntax`, `allowImportingTsExtensions`, `noEmit: true`
`[VERIFIED: CLAUDE.md Configuration section; tsc 7.0.2 available via npx]`, so a
typed const gets shape-checking from `npm run typecheck` for free — a second,
independent guard against a malformed entry, at zero cost. `capability-registry.ts`
is the in-repo precedent for a typed registry consulted by tests. A JSON file
would need the enforcing test to hand-validate every field's shape.

### 5. Plan decomposition — four plans, gate first

Recommended, with the reasoning:

1. **`27-01` — the ACME gate split (SEAM-01).** First, because criterion 1 is
   observable in isolation and `SEAM-01`'s Ordering constraint 1 makes it the
   only requirement with a sequencing obligation. Touches `r2000-test-gate.ts`,
   the new `acme-gate.ts` + `acme-gate.test.ts`, and four importers. Zero
   dependency on the other three plans.
2. **`27-02` — the coverage store boundary (SEAM-03).** Independent of `27-01`.
   Touches only `r2000-coverage.ts`, the new adapter, `r2000-coverage.test.ts`,
   `r2000-cli.ts:75`. The largest and most delicate diff (2292-line module,
   4315-line test file) — deserves its own plan so criterion 4's "demonstrably a
   move" is readable.
3. **`27-03` — `prg-image.ts` + the shared test helper (extraction scope, D-14/D-15/D-16).**
   The `files[]` change lives here, so `scripts/check-npm-packages.mjs` and the
   three `files[]`-scanning guards are exercised in one place. D-16's two comment
   rewrites belong here too, alongside the repoint they justify.
4. **`27-04` — the classification registry (SEAM-02).** **Last**, because its
   entries must cite the *post-extraction* tree: `r2000-project.ts`'s
   `extractables` list shrinks once `27-03` lands, `r2000-test-gate.ts`'s
   consumer list changes once `27-01` lands, and `r2000-coverage.ts`'s basis
   gains the adapter once `27-02` lands. A registry written first would be stale
   inside the same phase — the one thing criterion 2 says must not happen.

If parallelised, `27-01`/`27-02`/`27-03` are independent (disjoint file sets) and
`27-04` depends on all three. `use_worktrees` is `false`, so this is wave
ordering, not worktrees.

## Guards That Will Automatically See the New Modules

The most easily-missed acceptance criteria in this phase. Nothing here requires a
guard *edit* — but each guard will begin scanning the new files, and a header
comment that trips one turns a green phase red.

### Because `prg-image.ts` is added to `files[]` (D-14)

| Guard | What it enforces on shipped `.ts`/`.mts` | Risk for `prg-image.ts` |
|---|---|---|
| `docs-dangling-refs.test.ts:353,371,411` | No string literal in a shipped module names a phase number (`/\bPhase\s+\d/i`) | Its header must not put `Phase 27` **inside a string literal** (comments are fine here) |
| `comment-phase-pointers.test.ts:400,414,424,446` | No dangling phase-comment *assignment* in a shipped module | A header comment reading "moved here in Phase 27" may trip the assignment pattern — check the guard's own pattern families before writing the header |
| `stock-dispatch.test.ts:2902,2929,2949` | No shipped module hardcodes a fork-provides refusal claim, nor pairs future-phase framing with `VICE_BACKEND` | No realistic risk |
| `scripts/check-npm-packages.mjs` | The published tarball contains exactly the right files | Must see the new `files[]` entry; this is the D-14 gate |
| `r2000-spawn-seam.test.ts:176,296,363` | Every regenerator2000-shaped spawn site in the shipped set is in `EXPECTED_R2000_SPAWN_SITES` | `prg-image.ts` has no spawn call — safe. But the guard now scans it |

### Because all four new modules are `.ts` files in `src/mcp/vice/` (directory-wide guards, `files[]`-independent)

| Guard | Scan set | What the new modules must satisfy |
|---|---|---|
| `hop-chain-comments.test.ts:255-262` | `readdirSync(HERE)` filtered `.ts`/`.mts` — **every** module, shipped or not | No half-swept path chain naming a stale intermediate hop in any comment. Its floor assertion only grows, so adding files is safe |
| `assumption-label-discipline.test.ts:45-53` | authored `.ts`/`.mts` directly under `src/mcp/vice/`, **excluding** `resources/` and every `*.test.*` | **No new `[ASSUMED]` label** in `acme-gate.ts`, the adapter, `prg-image.ts` or the registry, unless a matching Assumptions Log row is added. Checked: the ACME half being moved contains **no** `[ASSUMED]` text, so the move itself is safe |
| `test-gate.test.ts:33-49` | `readdirSync(HERE)` `*.test.*` | `acme-gate.test.ts` is auto-discovered by `automatedTestFiles()`. **Do not** add it to `MANUAL_ONLY_TESTS`. No edit needed |
| `ci-suite-coverage.test.ts` | derives suite *directories* from the repo | `src/mcp/vice/` is already a covered directory. No edit needed |
| `hostpath-consumers.test.ts:188,204` | `r2000-*.ts` glob, floor 14, 16 present | No edit needed; see §Verified Reference Map |

**`assumption-label-discipline.test.ts` is the one most likely to bite**, because
the natural instinct when writing a long "single seam" header for a new module is
to record an assumption in it.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| Enumerating shipped modules from `files[]` | A fifth copy | The extracted shared helper (D-15), body copied verbatim from `docs-dangling-refs.test.ts:353` | Four copies is already the divergence hazard; a fifth in the registry's enforcing test would be self-parody |
| Stripping comments/strings before a structural scan | A new stripper | `codeOnly()` (full) or the `disasm-*` three-line filter (comments only) — pick by whether string bodies must be ignored, per `r2000-tools.test.ts:193-201`'s recorded reasoning | Five strippers already exist; the choice between them is documented in-code |
| Proving a module is absent from `files[]` | A prose promise | The `r2000-verify.test.ts:187-194` pattern, copied | It is the repo's established mechanical form and it is three lines |
| Proving a gate hard-FAILs when its binary is missing | Re-probing in-process, or a transcript in a SUMMARY | A child process with a poisoned env (D-05) | `ACME_AVAILABLE` is a module-load `const` (`:134`); an in-process re-probe is structurally impossible. `r2000-launch.test.ts:497-512` is the in-repo precedent for the child-process shape |
| Asserting a module set has the right size | A pinned total | Relation assertions (`every X has a Y`, `every cited path exists`) plus a **floor** | `audit-integrity.test.ts`'s pinned totals went red on a correct tree; `hostpath-consumers.test.ts:188`'s `>= 14` floor is the pattern that survived |
| Proving an adapter is substitutable | A grep for absent literals | A second implementation fed through the adapter (D-13), copying `r2000-coverage.test.ts:604`'s shape **including its non-vacuity half** | Absence of a string is not substitutability; and a substitutability test whose divergence report cannot move is vacuous |

## Common Pitfalls

### Pitfall 1: The child-process test recurses infinitely
**What goes wrong:** `acme-gate.test.ts` spawns `node --test acme-gate.test.ts`,
which spawns it again, forever.
**Why it happens:** the natural reading of D-05 ("spawns a child `node --test`
run") is to point the child at the current suite.
**How to avoid:** the child must target a **separate probe file written to a
temp dir** (`mkdtempSync(join(tmpdir(), ...))`), importing `acme-gate.ts` by
**absolute path**. See §Validation Architecture V-1 for the exact shape.
**Warning signs:** the suite hangs; process count climbs.

### Pitfall 2: The child probe file is written inside `src/mcp/vice/`
**What goes wrong:** a temp `*.test.mjs` in the module directory is collected by
`node --test '*.test.*'` on the *next* run, and breaks
`test-gate.test.ts:33-49`'s "every on-disk `*.test.*` lands in exactly one set"
assertion if it is ever left behind.
**Why it happens:** it is the shortest path to a relative import.
**How to avoid:** temp dir + absolute-path import, `rmSync` in a `finally`.
`r2000-launch.test.ts:497` avoids the file entirely with
`["--input-type=module", "-e", program]` — but `node --test` needs a file path,
so a temp file is required if D-05's literal `node --test` is honoured.
**Warning signs:** `test-gate.test.ts` goes red with an unfamiliar filename.

### Pitfall 3: `r2000-cli.test.ts`'s import is *rewritten* instead of *split*
**What goes wrong:** either the R2000-half symbols or the ACME-half symbols
vanish from the file, producing a typecheck error at best and a silently disabled
gate at worst.
**Why it happens:** D-01 says "get their import line rewritten", which is true
for three of the four files and false for this one.
**How to avoid:** Correction C-2. Same shape applies to all six
`r2000-project.ts` importers in D-14's table.
**Warning signs:** `tsc --noEmit` reports an undefined identifier; or one of the
never-skipped gate tests disappears from the TAP output count.

### Pitfall 4: The adapter receives the census, collapsing the independence axis
**What goes wrong:** `blockClassAt()` is given the census or the bytes "for
convenience", and `r2000-coverage.ts:124-127`'s "neither side reads the other's
input" invariant is silently broken. The `:604` independence test may still pass
while the *claim* it protects is void.
**Why it happens:** the adapter sits next to `classFromStore()`, which already
takes a grade token — adding one more argument feels harmless.
**How to avoid:** the adapter's signature takes **only** the block list and an
address. Its module must not import `disasm-decoder.ts` or anything census-side.
A structural import-purity assertion (the `disasm-decoder.test.ts:302-320`
pattern) is the cheapest guard.
**Warning signs:** the adapter module imports anything other than its own types.

### Pitfall 5: The registry cites line numbers that drift
**What goes wrong:** Phase 32 reads a registry whose `consumers[].line` values
have moved, exactly as this pass found two of `27-CONTEXT.md`'s own citations had.
**Why it happens:** line numbers are the most precise-looking and least stable
form of citation.
**How to avoid:** cite `path` + `symbol`; make `line` optional, and if present
have the enforcing test assert *the cited line contains the cited symbol* (the
`docs-linerefs.test.ts:66-83` pattern) rather than trusting it.
**Warning signs:** none — that is the point. This one is silent until Phase 32.

### Pitfall 6: The registry module name matches its own glob
**What goes wrong:** naming it `r2000-classification.ts` makes the enforcing test
demand a registry entry for the registry.
**How to avoid:** a non-`r2000` name (`module-classification.ts`).
**Warning signs:** the enforcing test fails on its first run with a
self-referential message.

### Pitfall 7: Criterion 4's green run is taken from `npm run test:automated`
**What goes wrong:** the run is green but skipped nine files including
`vice-proxy.test.ts` — which holds `BACK-05`'s only end-to-end wire proof. This
is recorded project knowledge, and `ci-guardrails.test.mjs:334,387` exists
specifically to stop the same substitution happening in CI.
**How to avoid:** D-17. Name the command (`npm test`), state the broker was
stopped. `[VERIFIED: src/mcp/vice/test-gate.mjs:95-105]` — the nine
`MANUAL_ONLY_TESTS` entries are `vice-broker-launch.test.ts`,
`vice-proxy.test.ts`, `broker-e2e.test.ts`, `stock-live.test.ts`,
`stock-live-triage.test.ts`, `stock-live-broker-monitor.test.ts`,
`stock-broker-live.test.ts`, `fork-live.test.ts`,
`stock-a4-checkpoint-flood.test.ts`.
**Warning signs:** the evidence names `test:automated`, or names no command at all.

### Pitfall 8: The two stale comments are left behind
**What goes wrong:** `r2000-coverage.ts:61-66`'s "one call site" claim and
`hop-chain-comments.test.ts:46-50`'s unqualified convention statement both
survive, each now contradicting the code beside them.
**How to avoid:** Corrections C-4 and §The Stale Header Invariant. Both are
one-paragraph rewrites in the same commit as the code.
**Warning signs:** none mechanically — this is why the planner must list them as
explicit tasks.

## Runtime State Inventory

This phase is a rename/refactor phase, so the inventory is mandatory. Every
category answered explicitly.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| **Stored data** | **None.** No database, datastore, collection name, ID or `user_id` anywhere carries `r2000-test-gate`, `parsePrg`, `flatImageOrigin`, `shippedTsModules`, `codeOnly`, `storeBlockTypeAt` or `classFromStore`. Verified: these are module-internal TypeScript symbols with zero persisted representation. The one persisted artifact adjacent to this phase is `evidence/coverage-reproducibility/ANSWER.sha256` (the coverage seal) — it hashes a *derived answer*, not a symbol name, and nothing in this phase changes any census output (criterion 4 asserts exactly that). | none |
| **Live service config** | **None.** The only external service surface is the VICE broker, which is not configured with any symbol or module path from this phase. No n8n workflow, Datadog service name, Tailscale ACL tag or Cloudflare Tunnel exists in this repo. | none |
| **OS-registered state** | **None.** No systemd unit, launchd plist, Task Scheduler entry or pm2 process name references any module in scope. The broker's own systemd unit (recorded project knowledge) launches `resources/vice-broker.mjs`, untouched here. | none |
| **Secrets / env vars** | **`ACME_BIN` and `VICE_REQUIRE_ACME` — code reads them by exact name, and `ci.yml:140` sets the second.** D-03 keeps both byte-identical, so **no action**. This is the one category with real exposure and it is closed by decision rather than by absence. Also present: `ACME` (a *different* var, consumed by `src/skills/acme-build/scripts/acme.mjs`, set at `ci.yml:99-100`) — untouched. No `.env` file exists in the repo. | none — **but the plan must assert the names did not move**, per D-03 |
| **Build artifacts / installed packages** | **`resources/*.mjs`** are compiled from host-bound `.mts` sources by `build.ts`, with `resources-sync.test.ts` failing CI on drift. **Nothing in this phase is `.mts`** — all four new modules are `.ts` run under type-stripping — so no rebuild is needed and `build.ts`'s asserted emitted-file set is unchanged. **The published npm tarball changes**: `files[]` gains `prg-image.ts` (D-14), validated by `scripts/check-npm-packages.mjs`. No `node_modules` reinstall, no egg-info, no Docker tag. | run `npm run build` only to confirm it is a no-op; run `scripts/check-npm-packages.mjs` to validate the tarball after the `files[]` change |

**The canonical question — after every file in the repo is updated, what runtime
systems still have the old string cached, stored, or registered?** Answer:
**nothing, provided `ACME_BIN` and `VICE_REQUIRE_ACME` keep their names.** That
is the whole of this phase's runtime-state exposure, and D-03 already closes it.
The reason the answer is this small is that every symbol in scope is
compile-time-only: nothing in Phase 27 changes a wire name, a tool name, a file
format, a stored record, or an env var.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js ≥ 22.18 | everything (type-stripping) | ✓ | v22.22.0 | — |
| `tsc` | `npm run typecheck` | ✓ | 7.0.2 (devDependency) | — |
| ACME cross-assembler | criterion 1's *positive* half (the gate must still SKIP-free-pass when ACME is present); `disasm-roundtrip.test.ts`, `skill-acme-build-cli.test.ts`, `r2000-answer-key.test.ts` | ✓ | release 0.97 "Zem", 31 Jan 2021, at `/home/henrik/.local/bin/acme` | — |
| A nonexistent path for `ACME_BIN` | criterion 1's *negative* half (the hard-FAIL) | ✓ (trivially) | — | — |
| regenerator2000 binary | the ten R2000-half gate importers | ✗ (not probed; irrelevant) | — | Absence is an **expected SKIP forever, by design** — `r2000-test-gate.ts:15-24` records that `VICE_REQUIRE_R2000` is deliberately never set in CI. Not a blocker |
| VICE emulator / broker | nothing in this phase | n/a | — | **Must be STOPPED** for criterion 4's green run (D-17). No broker process was running at research time |

`[VERIFIED: command -v acme && acme --version; node --version; npx tsc --version]`

**Missing dependencies with no fallback:** none.
**Missing dependencies with fallback:** regenerator2000 — absence is by design.

## Package Legitimacy Audit

**Not applicable — this phase installs zero external packages.** Every new module
is authored TypeScript importing only in-repo modules and Node builtins
(`node:child_process` for `acme-gate.ts`, `node:fs`/`node:path` for the shared
helper and the registry's enforcing test, `node:zlib` only if `decodeRawData`
moves per Correction C-1 option 2). `src/mcp/vice/package.json`'s `dependencies`
(`@mastra/mcp` 1.15.0, `@mastra/core` 1.55.0) and `devDependencies`
(`@types/node` 24.13.3, `typescript` 7.0.2) are **unchanged**
`[VERIFIED: src/mcp/vice/package.json]`. The `package.json` diff in this phase is
exactly one line: a new `prg-image.ts` entry in `files[]`.

`ENGINEERING_RULES.md` §4's dependency bar is therefore not triggered.
The `package-legitimacy check` seam was not run because there is no package to check.

**Packages removed due to [SLOP] verdict:** none.
**Packages flagged as suspicious [SUS]:** none.

## Validation Architecture

`workflow.nyquist_validation` is `true` `[VERIFIED: .planning/config.json]`, so
this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no third-party framework |
| Config file | none — `src/mcp/vice/package.json` `scripts.test` is the contract: `node --test '*.test.*'` |
| Quick run command | `cd src/mcp/vice && node --test acme-gate.test.ts` (single file, per-task) |
| Full suite command | `cd src/mcp/vice && npm test` — **the full `*.test.*` glob** |
| Typecheck | `cd src/mcp/vice && npm run typecheck` (`tsc --noEmit -p tsconfig.json`) |
| **Forbidden** | `npm run test:automated` — it runs `node test-gate.mjs`, which **skips the nine `MANUAL_ONLY_TESTS` entries** including `vice-proxy.test.ts` (`BACK-05`'s only wire proof). It exists for local devcontainer ergonomics, not as anyone's contract |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| SEAM-01 | With `VICE_REQUIRE_ACME=1` and a nonexistent `ACME_BIN`, the suite **FAILS** (non-zero exit) rather than skipping — from the extracted module under its non-`r2000` name | integration (child process) | `node --test acme-gate.test.ts` | ❌ Wave 0 (`acme-gate.test.ts`) |
| SEAM-01 | `acme-gate.ts` is absent from `package.json` `files[]` | unit (structural) | `node --test acme-gate.test.ts` | ❌ Wave 0 |
| SEAM-01 | No ACME symbol is reachable from any `r2000-*` module | unit (structural grep-in-test) | `node --test acme-gate.test.ts` | ❌ Wave 0 |
| SEAM-01 | The three unchanged ACME consumers still gate correctly | regression | `node --test disasm-roundtrip.test.ts skill-acme-build-cli.test.ts r2000-answer-key.test.ts r2000-cli.test.ts` | ✅ exists |
| SEAM-01 | `ci.yml` still sets `VICE_REQUIRE_ACME` and still runs the full glob | regression | `node --test ci-guardrails.test.mjs` | ✅ exists (`:334`, `:387`) |
| SEAM-02 | Every in-scope `r2000-*` entry on disk has a registry entry; every cited consumer path exists; no basis cites the prefix | unit (enforcing, relation-only) | `node --test <registry>.test.ts` | ❌ Wave 0 |
| SEAM-02 | `extractables` is non-empty **iff** verdict is `glue-with-extractable` | unit | same | ❌ Wave 0 |
| SEAM-02 | The registry is absent from `files[]` | unit (structural) | same | ❌ Wave 0 |
| SEAM-02 | The registry type-checks | typecheck | `npm run typecheck` | ✅ exists |
| SEAM-03 | The `:604` independence test still passes across the new boundary | regression | `node --test r2000-coverage.test.ts` | ✅ exists (`:604`) |
| SEAM-03 | A **second** block-vocabulary implementation fed through the adapter leaves every census byte count unchanged and moves only the divergence sub-report | unit (substitutability) | `node --test r2000-coverage.test.ts` | ❌ Wave 0 (new test in existing file) |
| SEAM-03 | The adapter imports nothing census-side (independence-axis purity) | unit (structural) | `node --test <adapter>.test.ts` or in `r2000-coverage.test.ts` | ❌ Wave 0 |
| SEAM-03 *(optional supplement)* | No literal `"Code"`/`"Undefined"`/`"Byte"` comparison survives in `r2000-coverage.ts` | unit (structural) | same | ❌ Wave 0, planner's discretion per D-13 |
| D-14 | `prg-image.ts` is in `files[]` and the tarball validates | integration | `node scripts/check-npm-packages.mjs` | ✅ exists |
| D-14 | `parsePrg`/`flatImageOrigin` unit behaviour unchanged | regression | `node --test prg-image.test.ts` (moved from `r2000-project.test.ts:110-128`) | ✅ tests exist, file ❌ Wave 0 |
| D-15 | All four `shippedTsModules()` consumers still produce identical scanned sets | regression | `node --test docs-dangling-refs.test.ts comment-phase-pointers.test.ts stock-dispatch.test.ts r2000-spawn-seam.test.ts` | ✅ exists |
| Criterion 4 | Full suite green with **zero** `r2000` modules deleted | full suite | `cd src/mcp/vice && npm test` (broker stopped) | ✅ exists |
| Criterion 4 | Nothing was deleted | structural | `git diff --diff-filter=D --name-only HEAD~N` returns no `r2000-*` path | n/a — evidence assertion |

### V-1: How criterion 1's hard-FAIL is observably proven (D-05)

**The constraint that forces the design:** `ACME_AVAILABLE` is a module-load
`const` `[VERIFIED: src/mcp/vice/r2000-test-gate.ts:134]` — `export const
ACME_AVAILABLE: boolean = probeAcme();`. Setting `process.env.ACME_BIN` inside a
test cannot affect it: the module is already loaded. **No in-process test can
prove criterion 1.** This is the same constraint `r2000-launch.test.ts:487-489`
records for `R2000_BIN` ("resolved once at module load (the IN-04 lesson)").

**The in-repo precedent to copy** `[VERIFIED: src/mcp/vice/r2000-launch.test.ts:497-512]`,
quoted verbatim:

```
test("runR2000({ timeoutMs: 250 }) against a genuinely slow child throws a named, actionable error -- never a raw spawnSync error object", () => {
  const here = dirname(fileURLToPath(import.meta.url));
  const childProgram =
    `import { runR2000 } from ${JSON.stringify(join(here, "r2000-launch.ts"))};\n` +
    `try {\n` +
    `  runR2000(["-e", "setTimeout(() => {}, 5000)"], { timeoutMs: 250 });\n` +
    `  console.log("NO_THROW");\n` +
    `} catch (e) {\n` +
    `  console.log("THREW:" + JSON.stringify({ message: e.message, isPlainSpawnError: typeof e.errno === "number" }));\n` +
    `}\n`;

  const r = spawnSync(process.execPath, ["--input-type=module", "-e", childProgram], {
    encoding: "utf8",
    timeout: 15_000,
    env: { ...process.env, R2000_BIN: process.execPath },
  });
```

**Recommended shape for `acme-gate.test.ts`.** D-05 asks for a child `node
--test` run. `node --test` requires file paths (it cannot take `-e`), so:

1. `mkdtempSync(join(tmpdir(), "acme-gate-fail-"))` — **outside** `src/mcp/vice/`,
   so the probe file is never collected by `node --test '*.test.*'` and never
   trips `test-gate.test.ts:33-49`.
2. Write one `probe.test.mjs` there whose entire body is a `test()` calling
   `assertAcmeRequiredIfEnvSet(assert)`, importing `acme-gate.ts` by **absolute
   path** via `JSON.stringify(join(HERE, "acme-gate.ts"))` — the exact idiom
   above. Node's type-stripping resolves the `.ts` regardless of the child's cwd.
3. `spawnSync(process.execPath, ["--test", probePath], { encoding: "utf8",
   timeout: 30_000, env: { ...process.env, VICE_REQUIRE_ACME: "1", ACME_BIN:
   join(tmpDir, "definitely-not-acme") } })`.
4. Assert **three** things, not one:
   - `r.status !== 0` — the FAIL itself. Assert non-zero, **not** `=== 1`: TAP
     runner exit codes are not a contract worth pinning.
   - the combined output matches `/VICE_REQUIRE_ACME is set but no real ACME was
     found/` — proves the failure is *this* assertion and not a resolution error,
     a syntax error, or a missing module. Without this, a typo'd import path
     produces a passing test for the wrong reason.
   - **the non-vacuity control:** the same child run with `VICE_REQUIRE_ACME`
     **unset** and the same bogus `ACME_BIN` exits **zero** (a named SKIP, not a
     FAIL). This is what proves the test observed the *gate* rather than merely a
     broken binary path — and it is exactly the shape
     `11-VALIDATION.md:281-282` recorded when this gate was first built:
     *"`VICE_REQUIRE_ACME=1 ACME_BIN=/nonexistent-acme` → 8 pass, **1 fail**, 1
     skipped"* versus *"`ACME_BIN=/nonexistent-acme`, env unset → 9 pass, 0 fail,
     **1 skipped**"*. Both directions, or neither.
5. `rmSync(tmpDir, { recursive: true, force: true })` in a `finally`.

**Cost:** two child processes per suite run (~1-2s). D-05 budgeted one; the
non-vaciuity control is worth the second, and the planner should say so rather
than let it look like scope creep.

**Note on `/tmp`:** recorded project knowledge is that `/tmp` is a 16 GB tmpfs
(RAM) with aging disabled. Two small text files, removed in a `finally`, is
immaterial — but the `finally` is not optional.

### V-2: How the registry's enforcing test proves SEAM-02 without pinning counts

The contract is **"every module on disk has an entry and every cited consumer
exists"** — never a total. Concretely:

- **Direction 1 (completeness):** for each path matching the registry's declared
  scope on disk, assert an entry exists. Failure message names the unclassified
  module. This is the assertion that makes a later-added module unable to slip in.
- **Direction 2 (no orphans):** for each entry, assert its `module` exists on
  disk. Catches an entry left behind after a rename.
- **Direction 3 (basis integrity):** every entry's `basis` is non-empty; every
  `consumers[].path` exists; every `requirements[]` matches a known-id shape.
- **Direction 4 (the prefix prohibition — criterion 2's checkable half):** no
  `basis` field's text matches `/prefix/i` or consists solely of a `r2000-`
  pattern. This is what turns "no classification cites a name prefix" from a
  promise into a test.
- **Direction 5 (verdict/extractables coherence):** `extractables.length > 0` iff
  `verdict === "glue-with-extractable"`.
- **Non-vacuity floor:** `modulesOnDisk.length >= 14` — **a floor, matching
  `hostpath-consumers.test.ts:188`'s established pattern**, so a broken glob
  fails loudly rather than making every assertion trivially true. A floor grows
  safely; an equality does not.
- **Planted violation** (the project's acceptance bar is observed-RED): the test
  temporarily evaluates its own predicates against a synthetic entry with an
  empty `basis` and a nonexistent consumer path, and asserts both are reported —
  the `hostpath-consumers.test.ts:220-229` planted-violation pattern. A guard
  that cannot be made to fail has not been written.

**Explicitly forbidden:** any assertion of the form `assert.equal(modules.length,
16)`. Recorded project history (`audit-integrity.test.ts`) is that such an
assertion goes red on a correct tree, and this phase *itself* changes the
directory's file count.

### V-3: How D-13's second implementation proves the adapter substitutable

The property Phase 28 needs is: *swapping the block-vocabulary implementation
moves the divergence sub-report and nothing else.* The test:

1. Build the report once with the real adapter over a real fixture
   (`reportFor(WELL_DOCUMENTED)` — the existing helper).
2. Build it again with a **second, deliberately different** adapter implementation
   — e.g. one whose vocabulary is `"CODE"`/`"UNSET"` instead of
   `"Code"`/`"Undefined"`, or one that classifies everything as data. Injected
   through whatever seam D-10 chooses (a parameter on `ReproducibilityInput`, or
   a module-level default the test overrides).
3. Assert **every** `structural` byte count and `classRuns` is **identical** —
   copying the exact key list from `r2000-coverage.test.ts:609`:
   `["reachedAsInstruction", "tableEntry", "referencedAsData", "unreached",
   "linearSweepDecodable", "rangeBytes"]` plus `deepEqual` on `classRuns`.
4. Assert the divergence sub-report **did** move — the non-vacuity half. Without
   it, an adapter that silently returned `null` for everything would pass step 3.
5. Assert the `reproducibility.comparisons` array's `fromBytes` values are
   unchanged while `fromStore` values differ — this is the sharpest form of the
   independence claim and it is available for free.

**D-11's completeness check rides along:** the test only proves substitutability
if **all three** comparison sites route through the adapter. A site left behind at
`:1985`/`:1986` would keep reading `"Code"` from the raw block list and step 3
would still pass while criterion 3 was false. So the substitutability test must
be paired with either (a) the optional structural "no Rust literal survives"
guard, or (b) a second adapter whose vocabulary makes a left-behind literal
*observable* (i.e. one that never emits `"Code"`). **(b) is stronger and free** —
choose a second vocabulary with no overlap, and a forgotten site shows up as a
moved byte count in step 3. Recommend (b), with (a) as the cheap supplement D-13
already permits.

### V-4: What criterion 4's green-run evidence must state

Four elements, all mandatory (D-17 plus recorded project knowledge):

1. **The exact command**, verbatim: `cd src/mcp/vice && npm test`. Not
   `npm run test:automated` — it skips nine files including `BACK-05`'s only wire
   proof. Not a per-file invocation.
2. **"The broker was stopped."** `BACK-05`'s D→G ordering test in
   `vice-proxy.test.ts` fails **deterministically** on a host with a live broker.
   That is a recorded environmental condition with an open todo
   `[VERIFIED: .planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md exists]`,
   a pre-existing red, and out of scope. Evidence that does not state the broker
   was stopped is uninterpretable: a red there means nothing without it.
3. **The pass/fail/skip counts**, so a future reader can see the suite was not
   silently narrowed. A skip count that *dropped* is as much a signal as a
   failure.
4. **"Zero `r2000` modules deleted"**, backed by a command not a claim — e.g.
   `git diff --diff-filter=D --name-only <base>..HEAD | grep -c r2000` returning
   `0`. This is criterion 4's actual substance ("demonstrably a move rather than
   a change") and it is the one part of the criterion that is trivially
   mechanisable.

Add `npm run typecheck` green as a fifth line: this phase's failure mode is a
half-split import, and `tsc --noEmit` catches that class before the suite does.

### Sampling Rate

- **Per task commit:** `npm run typecheck` + the single affected test file. Sub-30s.
- **Per wave merge:** `npm test` (full glob, broker stopped).
- **Phase gate:** `npm test` green + `npm run typecheck` green +
  `node scripts/check-npm-packages.mjs` green (the `files[]` change) + the
  zero-deletions command, all before `/gsd-verify-work`.

### Wave 0 Gaps

- [ ] `src/mcp/vice/acme-gate.test.ts` — covers SEAM-01 (the child-process
      hard-FAIL, its non-vacuity control, and the `files[]`-absence assertion)
- [ ] `src/mcp/vice/<registry>.test.ts` — covers SEAM-02 (five directions, a
      floor, and a planted violation)
- [ ] New tests **inside** `src/mcp/vice/r2000-coverage.test.ts` — covers SEAM-03
      (D-13's second implementation; optionally the structural literal guard)
- [ ] `src/mcp/vice/prg-image.test.ts` — D-14; the four existing unit tests move
      from `r2000-project.test.ts:110-128`
- [ ] Adapter import-purity assertion — a home must be chosen (its own
      `<adapter>.test.ts`, or inside `r2000-coverage.test.ts`)
- [ ] Framework install: **none needed** — `node --test` is built in

## Security Domain

`workflow.security_enforcement` is `true`, `security_asvs_level` is `1`
`[VERIFIED: .planning/config.json]`, so this section is required.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | **no** | No authentication surface exists in this phase or this package. |
| V3 Session Management | **no** | `r2000-session.ts` is an emulator/analyser *process* session, not a user session. Untouched here. |
| V4 Access Control | **no** | No authorization decision is made or moved. |
| V5 Input Validation | **partially — preserved, not added** | Two moving functions are input validators and their refusals must survive byte-identically: `parsePrg` rejects inputs under 3 bytes; `flatImageOrigin` rejects any length ≠ 65536. `r2000-cli.ts:24-31,477-491` records that the ordering of these two checks is deliberate — an oversized flat capture must hit `flatImageOrigin()`'s named refusal *instead of* silently falling through to `parsePrg()`. **The extraction must not reorder them.** The four existing unit tests at `r2000-project.test.ts:110-128` are the regression. |
| V6 Cryptography | **no** | `decodeRawData` is base64 + gunzip — an encoding, not a cryptographic control. Nothing hand-rolls crypto. The coverage seal (`ANSWER.sha256`) uses a standard digest and is untouched. |
| V12 File / Resource | **partially** | The child-process test writes to a temp dir; `mkdtempSync` (not a predictable path) plus `rmSync` in `finally` is the control, matching every existing temp-dir user in this suite. |
| V14 Configuration | **yes — the phase's one real security-relevant property** | `ACME_BIN` is an **externally-controlled binary name reaching `spawnSync`**. It is invoked as `spawnSync(ACME_BIN, ["--version"], ...)` — an **argv array, never a shell string** `[VERIFIED: src/mcp/vice/r2000-test-gate.ts:123,126]`. That property must be preserved verbatim in `acme-gate.ts`. `04-06-PLAN.md:312` records this as threat `T-04-06-01` (Tampering / command injection via the ACME subprocess), mitigated by exactly this argv-array discipline. |

### Known Threat Patterns for this stack (Node / TypeScript / test-harness extraction)

| Pattern | STRIDE | Standard Mitigation | Status in this phase |
|---------|--------|---------------------|------------------|
| Command injection via an env-supplied binary name | Tampering | `spawnSync(bin, argvArray, ...)` — argv array, never a shell string; never interpolate into a command | **Preserved by moving the code unchanged.** An acceptance criterion should grep `acme-gate.ts` for `exec(`/`execSync(`/a string-form `spawnSync` and expect zero, mirroring `04-06-PLAN.md:285` |
| Command injection in the new child-process test | Tampering | The `ACME_BIN` value it sets is a `join(tmpDir, ...)` path this code constructs, never user input; the child is spawned with an argv array | Mitigated by construction |
| A security gate that silently degrades to a skip | Repudiation / Tampering | The hard-FAIL switch (`VICE_REQUIRE_ACME`) plus a committed test that observes the FAIL | **This is criterion 1.** The whole of SEAM-01 is a mitigation for this pattern |
| A supply-chain change to the published tarball | Tampering | `scripts/check-npm-packages.mjs` validates both tarballs' exact contents via `npm pack --dry-run --json` | The `files[]` addition (D-14) is exactly what that guard exists to see. It must be **run**, not assumed |
| A test-only module leaking into the published tarball | Information Disclosure | Mechanical `files[]`-absence assertions | `acme-gate.ts`, the registry and the shared helper each need one (D-04, D-09, D-15). `r2000-verify.test.ts:187` is the pattern |
| Path traversal | Tampering | n/a | No path from an untrusted source is handled. `prg-image.ts` takes `Uint8Array`, never a path |

**No new attack surface is created by this phase.** Every security-relevant
property in scope is *preserved by moving code unchanged* — which is exactly what
criterion 4's "demonstrably a move" asserts, making criterion 4 the phase's
principal security control as well as its correctness control.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `node --test <file>` exits non-zero when a test in that file fails, and the assertion message appears in the combined stdout/stderr | V-1 | The child-process test's assertions need reshaping. **Cheap to falsify in Wave 0** — run the probe by hand once before writing the assertions. Not verified this session because it requires the not-yet-written module |
| A2 | Node's type-stripping resolves an absolute-path `.ts` import from a child process whose cwd is a temp dir outside the repo | V-1 | The probe file must live inside `src/mcp/vice/` (and then Pitfall 2 applies). Strongly suggested by `r2000-launch.test.ts:497-512`, which does exactly this with `-e` rather than `--test`, but the `--test` variant was not executed this session |
| A3 | `hop-chain-comments.test.ts` and `comment-phase-pointers.test.ts` will not fire on a well-written header for the four new modules | §Guards | A header rewrite in Wave 0. Their scan sets and pattern families were read; the specific new header text does not exist yet, so this cannot be verified in advance |
| A4 | `r2000-verify.ts`'s classification as a *capability* (criterion 2) is compatible with `EXPORT-01`'s statement that only its discipline survives | OQ-2 | The registry entry's basis must be reworded. Both texts were read verbatim; the tension is real and is an owner/planner judgement, not a fact to look up |
| A5 | The three `disasm-*` local `codeOnly` consts are byte-identical to each other | §codeOnly | Only affects an out-of-scope observation; no plan depends on it. Read visually, not diffed mechanically |

**Nothing in this document's Corrections C-1..C-6, Verified Reference Map, SEAM-02
Ground Truth, or Coverage Boundary sections rests on an assumption** — every claim
there carries a `[VERIFIED: path:lines]` tag with a verbatim quote from a file
opened this session.

## Open Questions (RESOLVED)

> **All four questions below were resolved during phase planning (2026-08-27) and
> are recorded here for provenance only — nothing in this section is still open.**
> Each `**Recommendation:**` was adopted, in executable plan content with its
> rationale, and each OQ heading now carries a `— RESOLVED in …` back-annotation
> naming where. The analysis itself is left exactly as written: the record of what
> was unclear at research time is the point of keeping it.
>
> | OQ | Resolution | Where |
> |---|---|---|
> | OQ-1 | Extract `codeOnly()`, on a **survival** rationale rather than a divergence one; comment-extractor family explicitly out of scope | `27-04-PLAN.md` |
> | OQ-2 | Record `r2000-verify.ts` as `capability`, basis = the surviving *discipline*; tension flagged in the entry's own `note` | `27-05-PLAN.md` |
> | OQ-3 | **Move** `decodeRawData` (option 2), not record-and-defer | `27-03-PLAN.md` |
> | OQ-4 | Two `scripts/lib/` files carried as registry **data** with an `out-of-enumeration` marker; enforcing test's enumeration stays inside `src/mcp/vice/` | `27-05-PLAN.md` |

### OQ-1: Extract `codeOnly()` at all, given it has exactly one consumer? — RESOLVED in `27-04-PLAN.md`

- **What we know:** `codeOnly()` has one definition (`r2000-spawn-seam.test.ts:65`)
  and one consuming file (itself, `:276` and `:493`). The four "variants" D-15
  names are local `const`s doing a different job, correctly excluded. So the
  *divergence* hazard D-15 argues from does not exist for `codeOnly()` — it
  exists only for `shippedTsModules()` (four true copies). Meanwhile
  `r2000-spawn-seam.test.ts` is an `r2000-*.test.ts` file Phase 32 deletes, so
  `codeOnly()` dies with it.
- **What's unclear:** whether "a sophisticated stripper that will be deleted and
  might be wanted later" is worth extracting, and whether extracting it while
  leaving three sibling comment-extractors duplicated
  (`comment-phase-pointers.test.ts`, `hop-chain-comments.test.ts`, and
  `stock-dispatch.test.ts:2925`'s `nonCommentLines()`) violates the
  `<specifics>` "no shims, no partial repoints" principle.
- **Recommendation:** **extract it, and state the rationale as *survival*, not
  divergence.** It costs one function move with one consumer to repoint (the
  cheapest possible), and it is the only implementation in the tree that
  correctly strips template-literal bodies — real, non-obvious logic with a
  documented WR-02 lineage. Then **state explicitly in the plan** that the
  comment-extractor family (`comment-phase-pointers`, `hop-chain-comments`,
  `nonCommentLines`) is deliberately out of scope, so the partial-consolidation
  is a recorded decision rather than an omission. `hop-chain-comments.test.ts:50`
  ("Keep the copy verbatim so a future reader can diff the two") is a positive
  instruction to keep *that* duplication — respecting it is consistent, not
  inconsistent.

### OQ-2: Is `r2000-verify.ts` a capability, and if so on what basis? — RESOLVED in `27-05-PLAN.md`

- **What we know:** criterion 2 names `-verify` among the ten modules "provably
  not deletable by prefix". But `REQUIREMENTS.md:100-104` (`EXPORT-01` and its
  preceding comment) says, verbatim: *"v0.6.0's STORE-06 asserted this reuses an
  existing `--verify` seam. It does not: that seam invokes regenerator2000 and
  parses ITS transcript. Only the discipline survives."* And `EXPORT-01` requires
  a verify path *"built for this purpose"*. Its only consumers are
  `r2000-cli.ts:58` and its own test — both `r2000-*`.
- **What's unclear:** whether the registry records it as `capability` (per
  criterion 2's explicit list) or `glue-with-extractable` (per `EXPORT-01`'s
  measured statement that its route dies).
- **Recommendation:** record it as **`capability`** — criterion 2 is the phase's
  own binding text and a research pass should not overrule it — but write the
  **basis as the discipline, not the route**: `acmeVerdict()`'s never-trust-the-
  exit-code parse (`r2000-cli.ts:623` records *"`r2000-verify.ts`'s
  `acmeVerdict()` derives ONLY from the parsed ACME…"*), which `EXPORT-01`
  explicitly carries forward and `EXPORT-03` restates. Cite `EXPORT-01` and
  `EXPORT-03` as its requirement ids. That is honest about what survives and
  keeps criterion 2 satisfied. **Flag it in the plan** so Phase 32 reads a basis
  it can act on rather than a verdict it will contest.

### OQ-3: Does `decodeRawData` move, or is it only recorded? (Correction C-1) — RESOLVED in `27-03-PLAN.md`

- **What we know:** it is generic in implementation, and a criterion-2 capability
  module statically imports it from a `glue-with-extractable` module. CONTEXT's
  stated reason for excluding it ("r2000-payload-specific") does not survive
  reading the code.
- **What's unclear:** only the planner's preference between moving it now
  (option 2) and recording it as a named extractable (option 1). Both discharge
  the hazard; neither is wrong.
- **Recommendation:** move it (option 2), for the same reason D-14 gives for
  `parsePrg`/`flatImageOrigin` — discharging the obligation now beats leaving it
  to Phase 32 under deletion pressure. But **whichever is chosen, write it down.**
  Silently following CONTEXT's parenthetical is the only route that leaves the
  census breakable by a prefix deletion.

### OQ-4: Does the registry cover `scripts/lib/r2000-cli-verbs.*`? — RESOLVED in `27-05-PLAN.md`

- **What we know:** both files exist and match `r2000-*` by name but not by
  location; `CUT-04` names `scripts/lib/r2000-cli-verbs.mjs` explicitly as a
  guard with a fate to record. D-06 scopes the enumerating test to
  `src/mcp/vice/r2000-*`, and D-09's rationale for the registry's location is
  that *"the test would then reach out of `src/mcp/vice/`, which nothing else in
  the suite does"* — which cuts against extending the scope.
- **What's unclear:** whether closing a `CUT-04` blind spot five phases early is
  worth a test that reaches into `scripts/`.
- **Recommendation:** keep the enforcing test's *enumeration* inside
  `src/mcp/vice/` (respecting D-09), but add the two `scripts/lib/` entries to
  the registry **data** with an explicit `scope: "out-of-enumeration"` marker and
  a header note stating that the enumeration does not cover them. Cheap, honest,
  and it means Phase 32 reading the registry finds them. Note that
  `docs-dangling-refs.test.ts` and `ci-suite-coverage.test.ts` both already reach
  outside `src/mcp/vice/` via `repoRoot({ from: HERE })`, so D-09's "nothing else
  in the suite does" is itself slightly overstated — if the planner prefers full
  enumeration, that precedent exists.

## State of the Art

Not applicable in the usual sense — this phase introduces no external technology
and no library choice. The only "state of the art" question is whether any
convention in `src/mcp/vice/` has moved since the references were written. Two
did:

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Guard tests each own their own scan end-to-end, copying helpers verbatim (`comment-phase-pointers.test.ts:53-59`, `hop-chain-comments.test.ts:46-50`) | The convention's scope is narrowed by D-16 to "no guard test imports **another guard test**"; importing a neutral non-test helper is permitted | This phase (D-16) | **Both** recorded statements must be rewritten, not one — Correction C-4 |
| `r2000-coverage.ts`'s block listing "enters this file at one call site (`computeDivergence()`)" (`:61-66`) | It already enters at **two** (`:1921`, `:1983`). After D-10 it enters at exactly one boundary — the adapter | Already drifted; corrected by this phase | The header comment must be rewritten in the same commit — §The Stale Header Invariant |
| `r2000-d64.test.ts:370-375`'s non-literal dynamic import, justified by "an isolated worktree" | `use_worktrees` is `false` | Config change, pre-dating this phase | The workaround's stated reason no longer applies. Repoint the path constant and update the comment; do not remove the pattern (it is harmless and the code is correct) |

**Deprecated / outdated:**
- **Nothing in `27-CONTEXT.md` is deprecated.** Its two line drifts (C-5) and two
  count errors (C-2, C-3) are drift and arithmetic, not stale decisions. Every
  D-NN decision survives contact with the tree.

## Sources

All sources are in-repo files read with `Read`/`sed`/`grep` this session at commit
`1785165`. **No web search, Context7 lookup, or external documentation fetch was
performed or needed** — the scope direction called for verification against the
live tree, and every question was answerable there. No `research-plan` seam call
was made for the same reason: there were no external questions to route.

### Primary (HIGH confidence — read this session, verbatim quotes above)
- `src/mcp/vice/r2000-test-gate.ts` (166 lines, read `:1-45`, `:90-166`)
- `src/mcp/vice/r2000-coverage.ts` (2292 lines, read `:55-75`, `:112-140`, `:184-222`, `:1612-1700`)
- `src/mcp/vice/r2000-coverage.test.ts` (4315 lines, read `:595-640`)
- `src/mcp/vice/r2000-project.ts` (read `:160-215`)
- `src/mcp/vice/r2000-cli.test.ts` (read `:20-32`), `r2000-answer-key.test.ts` (`:215-235`), `disasm-roundtrip.test.ts` (`:50-70`), `skill-acme-build-cli.test.ts` (`:40-52`)
- `src/mcp/vice/r2000-verify.test.ts` (`:173-196`), `hostpath-consumers.test.ts` (`:188-250`)
- `src/mcp/vice/r2000-spawn-seam.test.ts` (`:15-80`, `:155-200`), `stock-dispatch.test.ts` (`:2885-2960`), `docs-dangling-refs.test.ts` (`:344-375`), `comment-phase-pointers.test.ts` (`:45-70`, `:390-415`)
- `src/mcp/vice/hop-chain-comments.test.ts` (`:45-70`, `:250-278`), `assumption-label-discipline.test.ts` (`:45-75`), `test-gate.test.ts` (`:25-60`), `test-gate.mjs` (`:24-112`), `ci-suite-coverage.test.ts` (`:1-60`), `docs-linerefs.test.ts` (`:1-99`), `audit-integrity.test.ts` (grep)
- `src/mcp/vice/disasm-decoder.test.ts` (`:300-320`), `disasm-renderer.test.ts` (`:340-355`), `disasm-opcodes.test.ts` (`:388-400`), `r2000-tools.test.ts` (`:190-215`), `r2000-d64.test.ts` (`:365-390`), `r2000-launch.test.ts` (`:485-520`)
- `src/mcp/vice/package.json` (full), `.github/workflows/ci.yml` (`:40-150` + full ACME grep)
- `.planning/phases/27-shared-seams-extracted/27-CONTEXT.md` (full), `.planning/REQUIREMENTS.md` (full), `.planning/STATE.md` (`:1-120`), `.planning/config.json` (full), `./CLAUDE.md` (full, via system context)
- `git ls-files | grep -i r2000`; `ls src/mcp/vice/`; repo-wide greps for each symbol in scope

### Secondary (MEDIUM confidence)
- Live tool probes: `node --version` → v22.22.0; `npx tsc --version` → 7.0.2; `command -v acme && acme --version` → `/home/henrik/.local/bin/acme`, release 0.97 "Zem"; `pgrep -fa vice-broker` → no broker
- `.planning/todos/pending/2026-08-26-back-05-test-fails-deterministically-on-a-live-broker-host.md` (existence confirmed by `ls`, contents not read)
- `.planning/phases/11-.../11-VALIDATION.md:281-282,399-400` (via grep — the original two-direction ACME gate evidence)

### Tertiary (LOW confidence)
- None. Nothing in this document rests on a source that was not opened this session.

## Metadata

**Confidence breakdown:**
- **Reference verification: HIGH** — every cited path, line and symbol was opened
  with `Read`/`sed` this session and quoted verbatim. The four corrections
  (C-1..C-4) and two drifts (C-5) are observations, not inferences.
- **SEAM-02 ground truth: HIGH** — the module list is `git ls-files`; the consumer
  map is a per-module grep over `src` and `scripts`. Requirement-id attributions
  are MEDIUM (they are judgements from `REQUIREMENTS.md` text, and OQ-2 flags the
  one contested case).
- **Validation architecture: HIGH for design, MEDIUM for two mechanics** — the
  constraint forcing the child-process design is verified
  (`ACME_AVAILABLE` at `:134` is a module-load const) and the precedent shape is
  verified (`r2000-launch.test.ts:497-512`), but A1/A2 in the Assumptions Log
  were not executed and should be falsified in Wave 0 at near-zero cost.
- **Standard stack: N/A** — zero external packages; no stack decision exists.
- **Pitfalls: HIGH** — each is derived from a specific verified line, not from
  general experience.

**Research date:** 2026-08-26
**Tree state at research:** commit `1785165`
**Valid until:** **the next commit that touches `src/mcp/vice/`.** Every line
number in this document is a snapshot. The planner should re-run the greps in
§Verified Reference Map if any commit lands between this document and the plan —
`CLAUDE.md`'s own discipline ("treat a mismatch as drift to re-verify, not as
evidence the constraint itself changed") applies to this document too.
