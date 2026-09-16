# Architecture Research

**Domain:** Rebuild-half integration for c64-re-tools (v1.0.0 "The Rebuild Half")
**Researched:** 2026-09-10
**Confidence:** HIGH for everything cited against real source; MEDIUM where a
detector or table is explicitly net-new and the design is a recommendation
rather than a measured fact (flagged inline).

This is a **subsequent-milestone integration** document, not a greenfield
domain survey. It answers "where does each v1.0.0 target feature slot into the
architecture that already exists," against the real tree, and does not
propose a parallel seam anywhere the existing one already reaches.

## What already exists that this milestone builds on

Read directly, not inferred:

- `src/mcp/vice/anno-export-asm.ts` (1310 lines) — `exportAsm()` is **already**
  "the ONE place annotation-store rows plus image bytes become ACME source
  text" (its own header, line 24). Today it emits **one monolithic file**, no
  `!source`, no filtering of any kind — every store range is emitted
  unconditionally. `.annostore` → text, nothing else; no assembler runs here.
- `src/mcp/vice/anno-cli.ts` — `export-asm <image> --store FILE [--out FILE]
  [--force]` is a **CLI-only** verb (`anno-cli.ts:1632`, `1644` — "this CLI has
  exactly four" verbs: `render-memmap`, `coverage`, `export-asm`,
  `evid-disagreements`). It is **not** an `anno_*` MCP tool today.
- `src/mcp/vice/anno-tools.ts` / `vice-proxy.ts:3438-3439` — every `anno_*` MCP
  tool is registered from the `ANNO_TOOL_DEFINITIONS` array via
  `buildViceTool()` directly, which is why the family never reaches
  `forwardToVice()` (MCP-02, satisfied by construction). Adding a new `anno_*`
  tool is exactly this: one entry in that array plus one dispatch arm.
- `src/mcp/vice/host-tool.mts` (compiled to `resources/host-tool.mjs`, runs
  **host-side** inside the broker process) — `acme.build`'s `buildHostToolArgv()`
  branch (`:1287-1330`) already supports `source`, `outDir`, `includes` (`-I`
  dirs), `defines` (`-D`), `setpc`. Every path-bearing field is resolved through
  `resolveWorkspacePath()` (`:2355-2380`), the same site every other host tool's
  paths go through. `spawn(toolPath, argv, { stdio, ...env })` at `:2139` has
  **no `cwd` override** — the child inherits the broker process's own cwd.
- `src/mcp/vice/acme-verify.ts` / `acme-gate.ts` — the real-ACME byte-diff
  oracle (EXPORT-03). **Test-only**, absent from `package.json`'s `files[]` by a
  committed assertion (`acme-verify.ts` header). `PROJECT.md`'s own v0.9.0
  "Next Milestone Goals" note already decides this is reused, not re-minted,
  for the reassembly gate.
- `src/mcp/vice/anno-coverage.ts` (`scanIndirectDispatch()`, `:967`) — a
  **proven, shipped detector** for exactly one of BUILD-04's four hazard
  classes already exists: split lo/hi jump tables, multi-entry dispatch
  tables, and — by name — the **RTS-trick idiom**
  (`DISPATCH_CONTEXT_SHAPES: ["stack-return-push-idiom",
  "zeropage-vector-jumped-through"]`, `:761`). It also already reports an
  **advisory/unproven bucket** (`splitTableCandidates`) explicitly because
  "this is precisely what the hazard report wants to see, flagged as unproven"
  (`:646-649`, a comment written before this milestone existed). No detector
  for self-modifying-code writes, page-alignment dependence, or cycle-exact
  raster code exists anywhere in the tree (confirmed by grep across
  `anno-*.ts`, `disasm-*.ts`, `stock-*.ts`).
- `src/mcp/vice/evid-reconcile.ts` — `reconcileObservedExecution()` is a
  **pure function**, never opens the store itself (its own header states this),
  called by `dispatchEvidDisagreements()` in `anno-tools.ts:2414-2430`, which
  fetches both sides itself (`listExecObservations()`, `listRanges()` via a
  **lazy** `await import("./anno-cli.ts")` to avoid dragging `anno-coverage.ts`
  /`anno-memmap-render.ts`/`anno-export-asm.ts` into the MCP server's static
  import graph) and returns a `max_results`-bounded, disagreement-first report.
  This is the template a hazard-report MCP tool should copy verbatim.
- `src/skills/c64-ram-capture/scripts/compare.mjs` — pure, no MCP calls, a
  hardcoded `VOLATILE` span array (`:30-41`) and a single `compare(a, b)`
  entry point that assumes **one shared address space** at **one shared
  logical instant** between the two 64K images. `EQUIV-01` has never run this
  in any mode but that one.

## Answer 1 — Where the export path lives

**In the `anno_*` family, not `acme-build`, extending `anno-export-asm.ts` in
place.** This is not a new decision — it is the existing decision, restated
for the multi-file case:

- The export is fundamentally `(store rows, image bytes) → text`. That is
  MCP-02's derived-tool shape exactly: a computation over `.annostore` state
  that touches no emulator and no transport. Placing it in `acme-build` would
  put annotation-store knowledge (ranges, labels, comments, enums, scopes) in
  a skill whose entire contract today is "wraps `acme` and nothing else...
  contacts nothing" (`src/skills/acme-build/SKILL.md:16-18`) and that has zero
  reach into `node:sqlite` — `anno-store.ts` is the **one** module in this repo
  permitted to name it, structurally asserted by `anno-seam.test.ts`.
  Splitting store-reading logic across two module families would be exactly
  the "re-deriving a cross-cutting seam locally" anti-pattern this project's
  own `.planning/codebase/ARCHITECTURE.md` names by its own incident history.
- `BUILD-01`'s new requirement — one ACME file **per scope** wired by
  `!source`, assembling to a single output — is a change to `exportAsm()`'s
  *output shape*, not to *which module owns the derivation*. Concretely: add
  a scope-partitioned sibling (e.g. `exportAsmProject()`) that groups
  `listRanges()`'s rows by their `anno_range.scope` column (the store already
  has scopes — `PROJECT.md`'s STORE-01 line), emits one file per scope through
  the **same** `emitBlock()`/`emitDataLines()`/`withComments()`/label logic
  already in `anno-export-asm.ts` (never duplicated), plus one root/header
  file carrying the `!source "scope_x.a"` lines and the header symbol/enum
  definitions. `expectedBytes` (already derived from the image, never from
  `source`, per the module's own "WHAT THIS FILE DOES NOT CHECK" section) is
  unaffected by the file split — it is a property of the union of blocks, not
  of how many files they were written into.
- Assembly stays completely separate, exactly as it is today: the multi-file
  tree the exporter produces is handed to `acme-build`'s existing
  `host_tool acme.build` route (`host-tool.mts`) to actually invoke ACME. The
  `anno_*` family still never touches ACME or the host boundary; `acme-build`
  still never touches the store. This is the same "two things intentionally
  kept ignorant of each other" split `EXPORT-01`'s header already describes
  ("Nothing in this file verifies this file").
- Surface: keep it **CLI-only** (`anno-cli.ts`'s `export-asm` verb, widened
  with new options, or the existing `--out` becoming an output *directory*
  for multi-file mode) rather than adding an MCP `anno_*` tool for the export
  itself — a multi-file source tree is a filesystem artifact for a human/ACME
  to read, not a bounded, chunkable answer an agent queries mid-session (the
  precedent that *does* call for an `anno_*` MCP tool is the hazard report,
  Answer 3, because that is exactly the shape `anno_evid_disagreements`
  already serves).

**New vs modified:** `anno-export-asm.ts` — modified (add scope-partitioned
multi-file emission alongside the existing single-file path, which stays for
backward compatibility / the reassembly gate's byte-diff granularity).
`anno-cli.ts` — modified (`export-asm` verb widened). Nothing in
`acme-build`, `host-tool.mts`, or `vice-proxy.ts` changes for this decision
alone.

## Answer 2 — Where ACME actually runs, and what that implies for file layout

ACME is a **host** binary reached only through `runHostTool()`'s `acme.build`
branch (`host-tool.mts:2355-2470` builds argv and resolves paths;
`host-tool.mts:2139` spawns it). The container-side exporter never touches it.
This creates a genuine, previously-unexercised hazard for a multi-file tree:

**Measured fact about ACME itself** (ACME's own file-inclusion rule,
`AllPOs.txt` / project quick-reference): a quoted `!source "name.a"` is loaded
from the assembler process's **current working directory**, never from the
directory of the file that contains the `!source` line. `<name.a>`
angle-bracket quoting instead searches the `-I` library directories (the
mechanism `acme-build`'s existing `-I`/`includes` option already serves, and
which is semantically for library-style search paths such as
`cbm/c64/config.a`, not for a project's own generated sibling scope files).

**Measured fact about this codebase:** `host-tool.mts`'s `spawn()` call for
`acme.build` sets no `cwd` — the ACME child inherits the broker process's own
working directory, whatever that happens to be at broker start. Today this is
harmless because the shipped exporter never emits `!source` at all (single
monolithic file). The moment `BUILD-01`'s multi-file, `!source`-wired export
ships, it stops being harmless: a bare `!source "scope_main.a"` line resolves
against a directory nobody has ever pinned, decoupled entirely from where the
files were actually written.

**What this implies, concretely:**

1. **Every file the multi-file exporter writes for one export must land flat
   in one directory** (the resolved `outDir`), and every `!source` line the
   exporter emits must reference a **bare filename with no directory
   component** (`!source "scope_sprites.a"`, never `!source
   "scopes/scope_sprites.a"`). This is a constraint on `exportAsm()`'s output,
   decided container-side.
2. **`host-tool.mts`'s `acme.build` branch needs a `cwd` addition** — set
   `spawn()`'s `cwd` to the already-resolved `outDirPath` for this tool only.
   This is a small, host-side, single-seam-respecting change: `host-tool.mts`
   is already the one place that decides what environment/library path ACME
   sees (`findAcmeLib()` injecting `$ACME`, `:2196-2384`), so adding "and also
   its working directory" to the same branch is extending the existing
   pattern, not inventing a second one.
3. **The container-side exporter must never embed a host absolute path** in
   generated source text. `anno-export-asm.ts`'s own header already forbids
   importing `hostpath.ts`/`containerpath.ts` ("an exporter has no reason to
   join it") — that rule, read together with fact 1 above, is what forces the
   bare-filename design rather than "just write the host path into `!source`."
   The container does not reliably know the host path, and hardcoding one
   would break portability across machines reading the same store.
4. The root/header file the exporter emits should itself be resolvable as
   `acme.build`'s `source` argument exactly as today (a single entry point);
   only its **siblings**, reached via `!source`, are new.

**New vs modified:** `host-tool.mts` — modified (add `cwd: outDirPath` to the
`acme.build` spawn options; this is genuinely new behaviour this milestone
requires, not present today because nothing has ever needed it).
`anno-export-asm.ts` — modified (bare-filename `!source` emission, one file
per scope, all in one directory). `acme-build`'s `SKILL.md` — likely needs a
documentation note about the multi-file convention once it exists, since the
skill currently documents only single-file assembly.

## Answer 3 — Where the hazard report lives

**A derived, read-only query — new pure module plus a new `anno_*` MCP tool —
never a new store table, never a table that anything "acts on."**

- **Not a new store table.** `BUILD-04`'s own text is "enumerates... none of
  which any existing tool in this stack detects" and the 2026-09-10 scoping
  decision is explicit: "`BUILD-04` was already the right model and is
  unchanged: it enumerates what blocks movement and **acts on none of it**."
  A store table implies durable, mutable, revertable state (that is exactly
  what `.annostore`'s existing tables are for — labels, comments, ranges,
  enums). A hazard finding is not an annotation a person authored; it is a
  computed fact about the current byte layout, and it must be recomputed
  every time the layout changes rather than going stale in a table nobody
  invalidates. This is the same reasoning that already keeps
  `scanIndirectDispatch()`'s output out of the store and inside
  `anno-coverage.ts`'s pure `computeCoverage()` pipeline.
- **A derived query, following `anno_evid_disagreements`'s exact shape**
  (`anno-tools.ts:2414-2430`): a new pure module (recommend
  `src/mcp/vice/anno-hazards.ts`) that takes already-fetched, plain data —
  decoded instructions, the byte-derived block table (`blocksFromStore()`),
  cross-references, and (for class 4) `anno_evid_exec` observations — and
  returns a four-bucket report. It **never opens the store itself**, mirroring
  `evid-reconcile.ts`'s own documented contract. A `dispatchHazardReport()`
  arm in `anno-tools.ts` fetches both sides and calls it, exactly like
  `dispatchEvidDisagreements()` does today, and gets `max_results` truncation
  for free from the same pattern (a full hazard listing dumped whole is the
  same "full-64K disassembly view dumped into an agent's context" hazard
  `anno-tools.ts:1584` already documents for a different tool).
- **Reuse, don't re-derive, the one class that already has a proven
  detector.** Class 1 (indexed jump tables including the RTS-trick idiom) is
  `scanIndirectDispatch()`'s `IndirectDispatchScan` — import its **types and
  function**, do not re-implement the dispatch-context gate. The advisory
  `splitTableCandidates` bucket is explicitly designed to feed a hazard report
  and should be surfaced as "unproven, flagged" rather than dropped.
- **Classes 2-4 are genuinely new** (confirmed absent from the tree by
  grep — no self-modifying-code write detector, no page-alignment detector, no
  raster-timing detector exists anywhere today):
  - *Self-modifying code*: any `STA`/`STX`/`STY`/`INC`/`DEC` (etc.) whose
    resolved operand address falls inside a `code`-typed range. This is a
    **byte-level scan over `decode()`'s output**, independent of whether a
    human has already placed a mid-instruction label there — `anno-export-asm.ts`'s
    existing mid-instruction-label handling (`:1004-1037`) is a *symptom* of
    already-annotated SMC, not a detector of unannotated SMC, and the hazard
    report needs the latter.
  - *Page-alignment dependence*: enumeration only, per this project's own
    Out-of-Scope stance on automatic relocation — flag any indexed table
    access whose base sits on (or is a candidate for) a page boundary, where
    moving the table would change indexed-access cycle counts or wrap
    behaviour. No general solve; report the candidate and let a human decide.
  - *Cycle-exact raster code*: enumeration only — flag code reachable from an
    IRQ vector (cross-reference-derived) that also writes `$D012`/reads the
    raster line, using the **existing** cross-reference union
    (`STORE-06`) and `anno_evid_exec` execution evidence as corroboration, not
    as a cycle-accurate proof (this project has no static cycle counter; the
    live `(PC, hit_count, (LIN, CYC))` harness is a *measurement* tool, not
    a *static* one, and the hazard report must stay static/byte-derived to
    run without an emulator).
- **Relation to `anno_evid_exec`'s soundness asymmetry matters here
  directly.** A hazard-report finding that consults runtime evidence (class 4
  above) must never use "never observed executing" as evidence that a region
  is *not* raster-sensitive code — `RuntimeExecClass` structurally has no
  `data` member for exactly this reason (EVID-01..06). Observed-executing
  strengthens a class-4 flag; unobserved says nothing and must not suppress
  one. This is not a new rule to invent — it is the existing asymmetry,
  applied at a new consumption site.

**New vs modified:** `anno-hazards.ts` — new, pure. `anno-tools.ts` — modified
(one new `dispatchHazardReport()` arm plus one new `ANNO_TOOL_DEFINITIONS`
entry — `anno_hazard_report` or similar). `anno-cli.ts` — likely modified too
(a fifth CLI verb, which requires touching the hard-coded "this CLI has
exactly four" closed-set message at `:1644` and its guarding test). No change
to `anno-store.ts`'s schema, no `SCHEMA_VERSION` bump.

## Answer 4 — The reassembly-plus-hazard gate, structurally before the phase it gates

`BUILD-06`'s (renumbered `BUILD-07` in the current requirement text — see
`PROJECT.md`'s v1.0.0 scoping note) literal requirement is a **phase-ordering**
constraint, and this project already has two directly-precedented mechanisms
for exactly this shape, both citable:

1. **Standalone go/no-go phase, rules committed before measurement.** Phase 9
   (`ANNO-16`) and the `CHAN-01` gate (Phase 39) are this project's own
   precedent: "Make the assumption probe a standalone go/no-go **phase**, not
   a criterion inside one" (`PROJECT.md` Key Decisions), because a phase
   boundary makes the gate structural rather than skippable, and a verdict
   whose rules were written and frozen *before* the measurement exists is
   derived rather than judged.
2. **Build the instrument before the work it gates, not after.** Phase 12
   (`GATE-01`, v0.4.0) is the second precedent: an instrument built *after*
   the work it is meant to gate has never gated anything.

Applied here: the reassembly-plus-hazard gate should be its **own phase**,
sitting between the "Rebuildable source" (`BUILD-*`) phase and the
"Equivalence and modifiability" (`EQUIV-*`) phase — not a criterion folded
into either. Its sole deliverable is a script that:

- Reuses, never re-mints, v0.7.0's real-ACME byte-diff oracle
  (`acme-verify.ts`/`acme-gate.ts`) — this is already the decided position,
  stated verbatim in `PROJECT.md`'s v0.9.0 "Next Milestone Goals": *"A
  reassembly gate should reuse it rather than mint a second one."*
- Calls the new multi-file `exportAsm()` path (Answer 1), assembles it through
  the real `acme.build` host-tool route with the `cwd` fix (Answer 2), and
  byte-diffs against `expectedBytes` exactly as `acme-verify.ts` does today —
  never trusting ACME's exit status or its aggregate summary line, per that
  module's own documented recorded false-pass history.
- Calls the new hazard-report module (Answer 3) and requires the report to be
  **clean** (or every remaining finding explicitly acknowledged, mirroring
  this project's existing acknowledge-don't-falsify discipline for
  unclosable audit items).
- Combines both into one go/no-go verdict, with its rules committed in the
  **same commit** as the phase that builds the gate, before the gate is ever
  run for real — the `CHAN-01`/`GATE-01` pattern.

Because `EQUIV-04` requires the "whole pipeline runnable in CI," this gate
script is a project-internal verification artifact (same category as
`acme-verify.ts`) exercised against the committed synthetic fixture (Target
feature 4, "A purpose-built synthetic subject"), not a shipped end-user tool
— consistent with `acme-verify.ts` being test-only and absent from
`package.json`'s `files[]`.

**New vs modified:** one new phase-scoped gate script (recommend
`gate-reassembly.ts` or similar, test-only, importing `acme-verify.ts` and
`anno-hazards.ts`'s exported function directly — not shelling to the CLI, for
the same reason `acme-verify.ts` never shells to `anno-cli.ts`). No change to
existing modules beyond what Answers 1-3 already require.

## Answer 5 — `compare.mjs` in original-versus-different-binary mode

`compare.mjs` (`src/skills/c64-ram-capture/scripts/compare.mjs`) is pure,
dependency-free logic with **no MCP/store/host-tool involvement at all** —
this is the right layer for the change and it stays exactly there. The
existing `compare(a, b)` function assumes one shared 64K address space
compared at one shared logical instant; `EQUIV-01` breaks both assumptions
(two different binaries, each with its own meaningful stopping point, and
labels/addresses that may legitimately differ post-rebuild since byte-identity
is explicitly not the acceptance bar).

**What changes, architecturally, is entirely inside this one file plus its
CLI surface — no new seam, no MCP tool, no store table:**

- The hardcoded `VOLATILE` array (`:30-41`) must become **caller-suppliable**
  rather than a single fixed constant, because same-binary mode's broad
  volatile mask (blanket `$D000-$DFFF`) is exactly what would hide a real
  `$D020`/`$D015`/`$D018` regression in cross-binary mode — the requirement's
  own wording ("narrowed volatile mask so a real ... regression cannot hide").
  The fix is a config/allowlist argument (JSON file or `--volatile` flag),
  with the existing hardcoded array becoming the *default* for same-binary
  mode so no existing caller breaks.
- A new **allowlist for intentional differences** — addresses (or ranges)
  the caller declares as expected-to-differ because the rebuild changed them
  on purpose (moved data table, renamed/relocated symbol whose absolute value
  differs even though its function doesn't). This is a second, orthogonal
  input file from the volatile mask: volatile means "always excluded because
  it's hardware/stack noise"; allowlist means "this specific pairing is
  known-intentional for this specific comparison." Both narrow the
  `divergence` bucket, neither should be the same mechanism (conflating them
  would make an intentional difference indistinguishable from hardware noise
  in the report).
- **Per-binary logical checkpoints** is a **capture-time**, not a
  compare-time, concern — it means the *skill* (not `compare.mjs`) must be
  able to stop each of the two binaries at its own semantically-equivalent
  point (which may be a different PC/address in each, since addresses can
  legitimately differ) before capturing. `compare.mjs`'s only obligation is to
  accept and print which checkpoint label produced each side of the
  comparison, so the report states what was actually compared rather than
  implying a shared PC. This is a metadata/reporting addition to
  `cmdCompare()`'s argument handling, not a new capability elsewhere in the
  architecture — the `c64-ram-capture` skill already knows how to set
  arbitrary checkpoints via the existing `vice_*` MCP surface; nothing new is
  needed there.

**New vs modified:** `compare.mjs` — modified (new mode/flags: a
volatile-mask override, an allowlist file, checkpoint-label metadata on
output). `c64-ram-capture/SKILL.md` — modified (document the new mode). No
change anywhere in `src/mcp/vice/`.

## Answer 6 — Where the lossless-export invariant is enforced and tested

**`anno-export-asm.ts`'s `exportAsm()` (and its multi-file sibling from
Answer 1) is the single seam, because it already is the one chokepoint every
store range must pass through to become emitted text.** Today it has **zero**
filtering logic anywhere in its call chain (confirmed by reading the whole
file: `listRanges()`'s result becomes `blocks` via a straight `.map()`, never
a `.filter()`), which means the invariant already holds vacuously — the risk
this requirement guards against is a **future** change (most plausibly
`BUILD-05`'s provenance-aware carry-through) tempting someone to add a
provenance-based skip inside this same function, exactly the mistake the
2026-09-10 scoping decision already named and reworded `BUILD-05` to prevent
("that wording made the tool the decider").

**Concrete enforcement design:**

1. **User-requested exclusion becomes a recorded, visible state, never a
   silent gap.** Add an explicit exclusion mechanism at the store layer — a
   `anno_excluded_range` table (or a nullable "excluded + reason" column on
   `anno_range`, whichever costs less against `SCHEMA_VERSION`'s existing
   strict-refusal discipline; a new table is more consistent with this
   project's history of adding tables rather than widening existing ones,
   c.f. `anno_evid_exec` at `SCHEMA_VERSION` 4 rather than a column bolted onto
   `anno_range`). `exportAsm()` still walks an excluded range's full byte
   span and emits a block for it — filled with the real bytes (byte-identity
   is not lost) but tagged with a visible marker comment naming the exclusion
   and its reason, mirroring the existing `AUTO_NAME_MARKER`/
   `ALIAS_MARKER_PREFIX` pattern (`:513`, `:525`) of "mark, never drop, never
   silently resolve." `expectedBytes` — derived from the image, never from
   `source` — is completely unaffected either way, which is exactly why this
   module is the right place: the byte-diff oracle from Answer 4 cannot even
   express "this range vanished" as anything other than a coverage gap, so a
   silent drop would already be visible to the reassembly gate as a range no
   longer covered — but the invariant is about **never reaching that state**,
   not about detecting it after the fact.
2. **A structural regression guard, not just a behavioural test.** Add a test
   (in the style of this project's other structural guards —
   `anno-seam.test.ts`, `module-classification.test.ts`) that scans
   `anno-export-asm.ts`'s own source text and asserts there is no
   provenance/confidence-keyed conditional between `listRanges()`'s result and
   the emitted block array — i.e. `blocks.length` is asserted equal to
   `ranges.length` unconditionally, by construction, so a future contributor
   adding `.filter(r => r.provenance !== "cracker")` reds a named test rather
   than shipping silently.
3. **The planted-heuristic-survives control** the requirement asks for:
   construct a store fixture where a plausible heuristic (e.g. "provenance
   confidence below some threshold" or "range flagged `cracker-patch` by
   `c64-provenance-diff`") would want to drop a range, run `exportAsm()`, and
   assert the range's bytes are present in `expectedBytes`/the emitted source
   regardless. This is the same idiom `anno-coverage.test.ts`'s planted-defect
   controls already use for `COV-02`'s vacuous-pass detection — reuse the
   pattern, don't invent a new one.

**New vs modified:** `anno-store.ts` — modified (new exclusion table,
`SCHEMA_VERSION` bump if a new table is chosen). `anno-export-asm.ts` —
modified (exclusion-aware block emission, still zero provenance-based
filtering). `anno-tools.ts` — modified (a way to *set* an exclusion, e.g.
`anno_exclude_range`/`anno_include_range`, symmetric with how every other
mutating `anno_*` verb pairs a setter with a lister). New structural test
file, new planted-fixture test in `anno-export-asm.test.ts`.

## New vs Modified Components — summary table

| Component | New / Modified | What changes |
|---|---|---|
| `anno-export-asm.ts` | Modified | scope-partitioned multi-file emission, bare-filename `!source`, exclusion-aware block emission, no provenance filtering (guarded) |
| `anno-cli.ts` | Modified | `export-asm` widened for multi-file output; new `hazards` verb (closed-set message at `:1644` must move) |
| `anno-tools.ts` | Modified | new `anno_hazard_report` dispatch arm + definition; new exclusion setter/lister verbs |
| `anno-hazards.ts` | **New** | pure four-class hazard scan; imports `scanIndirectDispatch()` from `anno-coverage.ts` for class 1, adds SMC/page-align/raster-timing detectors |
| `anno-store.ts` | Modified | new exclusion table (or column), `SCHEMA_VERSION` bump |
| `host-tool.mts` | Modified | `acme.build`'s `spawn()` gains `cwd: outDirPath` |
| `acme-build` skill/`SKILL.md` | Modified (docs) | document the multi-file `!source` convention once the exporter emits it |
| `compare.mjs` | Modified | caller-suppliable volatile mask, allowlist input, checkpoint-label metadata |
| `c64-ram-capture/SKILL.md` | Modified (docs) | document cross-binary mode and per-binary checkpoint procedure |
| reassembly+hazard gate script | **New** | test-only, imports `acme-verify.ts` + `anno-hazards.ts` directly, own phase |
| `vice-proxy.ts` | Unaffected | `ANNO_TOOL_DEFINITIONS` loop already registers any new `anno_*` entry with no further change needed |
| `.mcp.json`, `vice.ts`, `stock-*.ts`, broker control protocol | Unaffected | nothing here touches the emulator, the transport seam, or `forwardToVice()` |

## Data Flow — the export + assemble + verify path (new)

```
.annostore (SQLite, container-side)
   |  listRanges / listLabels / listComments / listProjectEnums / listEnumUsage
   v
anno-export-asm.ts: exportAsm() / exportAsmProject()   [container-side, pure-ish: reads store + image, writes nothing itself in library form]
   |  groups ranges by scope, emits one .a file per scope + one root .a with
   |  !source "scope_x.a" (BARE filenames) + expectedBytes derived from IMAGE
   v
anno-cli.ts: export-asm verb   [container-side, writes files to a workspace dir]
   |  writes root.a + scope_*.a flat into one output directory (container path)
   v
host-tool-client.ts -> broker control socket -> host-tool.mts: acme.build   [crosses container/host boundary]
   |  resolveWorkspacePath() translates the container output dir to a host path
   |  spawn(acme, argv, { cwd: outDirPath })   <-- NEW: cwd fix from Answer 2
   v
real ACME (host)   -- resolves every bare !source "scope_x.a" against cwd == outDirPath
   |  writes .prg / .sym / .vs / .rep back into outDirPath
   v
reassembly gate script (test-only, own phase)
   |  byte-diffs assembled output against exportAsm()'s expectedBytes (acme-verify.ts's oracle, reused)
   |  calls anno-hazards.ts's report, requires clean or acknowledged
   v
go / no-go, decided by rules committed before this script's first real run
```

## Data Flow — the hazard report path (new)

```
.annostore                      byte-derived block table (block-class.ts)
   |  listRanges / cross-refs        |  blocksFromStore()
   v                                 v
anno_hazard_report dispatch arm (anno-tools.ts)  <-- fetches BOTH sides, exactly like dispatchEvidDisagreements()
   |
   v
anno-hazards.ts (pure, new)
   |-- class 1: scanIndirectDispatch() [REUSED from anno-coverage.ts, not re-derived]
   |-- class 2: new SMC-write scan over decode() output vs code-typed ranges
   |-- class 3: new page-alignment candidate scan (enumeration only)
   |-- class 4: new raster/IRQ reachability scan, corroborated (never suppressed) by anno_evid_exec
   v
{ indexedJumpTables, selfModifyingCode, pageAlignment, rasterTiming }, max_results-bounded
```

## Anti-Patterns to avoid in this milestone specifically

### Building a second export route through `acme-build`

**What would happen:** a new skill script inside `acme-build` reads
`.annostore` directly (or shells out to `vice-mcp anno export-asm` and then
does its own scope-splitting) to produce the multi-file tree.
**Why it's wrong:** duplicates store-reading/derivation logic outside the
`anno_*` family's confinement, and reintroduces the "prefix-driven / re-derived
seam" failure mode this project has direct incident history with
(`shipped-modules.ts`'s four hand-copied `shippedTsModules()` implementations,
cited in `.planning/codebase/ARCHITECTURE.md`).
**Do this instead:** extend `anno-export-asm.ts`, keep `acme-build` as the
assembly-only consumer it already is.

### Re-deriving the indexed-jump-table detector

**What would happen:** `anno-hazards.ts` reimplements its own indexed-load
pairing scan for BUILD-04's class 1 instead of importing
`scanIndirectDispatch()`.
**Why it's wrong:** `anno-coverage.ts`'s detector already survived a real
false-positive incident (CR-04, documented at length in its own header) and
carries a mechanically-enforced closed shape list (`DISPATCH_CONTEXT_SHAPES`)
with negative controls proven to reach the predicate's interior. A second
implementation starts over from zero evidence and can silently reintroduce
exactly the false-positive class CR-04 fixed.
**Do this instead:** import the function and its types; treat
`splitTableCandidates` as the hazard report's "unproven, flagged" bucket
verbatim.

### Letting the exporter learn about provenance verdicts directly

**What would happen:** `BUILD-05`'s "carry the provenance verdict to point of
use" gets implemented by having `exportAsm()` read a confidence/provenance
column and skip or annotate ranges based on a threshold it decides.
**Why it's wrong:** this is precisely the tool-is-the-decider failure mode the
2026-09-10 scoping decision renamed `BUILD-05` to avoid, and it is exactly
what `BUILD-07`'s lossless invariant (Answer 6) exists to make structurally
unreachable.
**Do this instead:** the verdict is carried as **visible text** (a comment,
sourced from `c64-provenance-diff`'s existing ledger) attached to every
emitted block regardless of its value; inclusion/exclusion is a separate,
explicit, user-invoked action (the exclusion table from Answer 6), never a
threshold inside the exporter.

### Embedding a host path in generated ACME source

**What would happen:** to work around the `!source` cwd issue (Answer 2), the
exporter (container-side) is handed the host output directory and writes
absolute host paths into `!source` lines.
**Why it's wrong:** violates `anno-export-asm.ts`'s own documented rule
against importing `hostpath.ts`/`containerpath.ts`, and hardcodes a
machine-specific path into a *store-derived artifact* that is supposed to be
portable and re-exportable on any machine holding the same `.annostore`.
**Do this instead:** bare filenames, one flat output directory, `cwd` fix in
`host-tool.mts` (Answer 2's actual recommendation).

### Adding a `data` class to `RuntimeExecClass` for hazard corroboration

**What would happen:** the class-4 (raster-timing) hazard detector, wanting to
say "this region is *not* raster code," reads `anno_evid_exec`'s absence of
observations as evidence and reports it as safe/data-like.
**Why it's wrong:** `RuntimeExecClass` is deliberately `"code" | "unobserved"`
with no `data` member (EVID-01..06's structural soundness asymmetry).
Never-observed proves nothing; treating it as evidence of safety would launder
an absence into a false negative on exactly the class of hazard this milestone
exists to surface honestly.
**Do this instead:** use `anno_evid_exec` only to *strengthen* a flag already
raised by static evidence (IRQ-reachable + writes `$D012`/`$D011`), never to
suppress one.

## Suggested Build Order

Dependencies, not calendar time — each item lists what it structurally needs
from the item(s) before it.

1. **Decomposition to closure (`DECOMP-01..04`)** — depends on nothing new
   architecturally; consumes the existing `anno_evid_exec` join
   (`reconcileObservedExecution()`) that v0.9.0 already shipped, plus existing
   `anno_*` label/comment/enum tools. No new module required.
2. **The purpose-built synthetic subject** — should land early, in parallel
   with (1) or immediately after, because `BUILD-04`'s hazard detector and
   `EQUIV-03`'s modifiability proof are stated to be *vacuous* without it.
   Every later item's tests depend on this fixture existing and containing
   all four hazard classes deliberately.
3. **Lossless-export invariant machinery (Answer 6)** — build the exclusion
   table/column and the structural no-filter guard **before** widening the
   exporter for multi-file output, so the multi-file work is written against
   an already-enforced invariant rather than retrofitted onto it.
4. **Multi-file export + `!source` wiring (Answers 1 & 2)** — depends on (3)
   for the exclusion-aware block emission, and depends on the synthetic
   fixture (2) to exercise every hazard-adjacent shape (SMC operand labels,
   split tables) through the new multi-file path at least once.
   `host-tool.mts`'s `cwd` fix can be built independently and lands here.
5. **Hazard report (Answer 3)** — depends on `scanIndirectDispatch()` already
   existing (it does) and on the synthetic fixture (2) to give the three new
   detectors something real to fire on. Independent of (3)/(4) in principle,
   but sequencing it after the fixture exists (2) is what makes its own tests
   non-vacuous, mirroring this project's own stated concern about `COV-02`-style
   vacuous passes.
6. **`compare.mjs` cross-binary mode (Answer 5)** — independent of 1-5;
   can be built in parallel at any point, since it touches no `src/mcp/vice/`
   code at all. Should land before (7) since equivalence demonstration needs
   it.
7. **Reassembly-plus-hazard gate, as its own phase (Answer 4)** — depends on
   (4) (multi-file export must exist to reassemble) and (5) (hazard report
   must exist to gate on). Must be built and **run for real, green or
   explicitly acknowledged**, before the Equivalence phase begins — this is
   the literal ordering `BUILD-06`/`BUILD-07` requires, and this project's own
   Phase 9 / Phase 12 precedent for what "before" means structurally.
8. **Equivalence and modifiability (`EQUIV-01..04`)** — depends on (6) and
   (7) both being in place; this is the phase the gate in (7) exists to gate.

## Sources

- `src/mcp/vice/anno-export-asm.ts` (read in full, 1310 lines)
- `src/mcp/vice/anno-cli.ts` (grepped for `export-asm`, verb dispatch,
  closed-set message at `:1644`)
- `src/mcp/vice/anno-tools.ts` (`dispatchEvidDisagreements()` read at
  `:2388-2430`; registration loop referenced from `vice-proxy.ts`)
- `src/mcp/vice/vice-proxy.ts` (`ANNO_TOOL_DEFINITIONS` registration at
  `:3438-3439`, `buildViceTool()` at `:3300`)
- `src/mcp/vice/host-tool.mts` (read `:1-130`, `:1180-1330`, `:2340-2500`;
  grepped for `acme`, `cwd`, `spawn(`)
- `src/mcp/vice/acme-gate.ts`, `src/mcp/vice/acme-verify.ts` (headers read in
  full)
- `src/mcp/vice/anno-coverage.ts` (`:600-880`, `scanIndirectDispatch()` and
  `DISPATCH_CONTEXT_SHAPES`/`DISPATCH_GATE_ROUTES`)
- `src/mcp/vice/evid-reconcile.ts`, `src/mcp/vice/anno-store.ts` (schema
  section `:250-350`, `:3453-3710` for `anno_evid_exec`)
- `src/skills/acme-build/SKILL.md` (read `:1-60`)
- `src/skills/c64-ram-capture/scripts/compare.mjs` (read in full)
- `.planning/PROJECT.md` (`## Constraints` `:623-654`, `## Key Decisions`
  `:680-742`, `## Current Milestone: v1.0.0` `:1583-1732`)
- `.planning/milestones/v0.5.0-REQUIREMENTS.md` (base `DECOMP-*`/`BUILD-*`/
  `EQUIV-*` text, read in full)
- `.planning/codebase/ARCHITECTURE.md` (component responsibilities, anti-
  patterns, architectural constraints — read in full)
- ACME file-inclusion semantics (`!source "name"` = current-directory-relative,
  `<name>` = `-I` library search path) — web search against ACME's own
  `AllPOs.txt`/quick-reference documentation, cross-checked against this
  project's own `-I`/`includes` implementation in `host-tool.mts`.

---
*Architecture research for: c64-re-tools v1.0.0 rebuild-half integration*
*Researched: 2026-09-10*
