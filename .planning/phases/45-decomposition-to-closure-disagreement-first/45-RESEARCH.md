# Phase 45: Decomposition to Closure, Disagreement First - Research

**Researched:** 2026-09-10
**Domain:** Reverse-engineering annotation closure over an existing SQLite-backed store (`.annostore`), a required disagreement-oracle input, and a decline-with-reason convention — no new architecture, no new external dependency
**Confidence:** HIGH for code-surface facts (all read this session with line citations); MEDIUM for the exact shape of the completeness-report script (net-new code, no prior art in this repo); LOW/ASSUMED flagged explicitly where CONTEXT.md left a gray area this research narrows but does not fully close

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Where the annotated store lives**
- **D-01:** One store per fixture. Each committed `.prg` gets its own `.annostore`.
- **D-02:** Committed form is a JSON export plus a committed importer, not a binary `.annostore` and not "regenerated only". No general store-JSON importer exists today — `anno_import_ghidra_export` is Ghidra-shaped only — so this phase builds one, and the export/import round trip is itself testable. Reversibility: one-way.
- **D-03:** Split provenance: derived regenerates, authored is frozen. Block types, cross-references and enum bindings regenerate deterministically from the bytes and must reproduce byte-identically (the `fixtures/coverage/make-coverage-fixtures.mjs` idempotence bar, enforced the same way — `git status --porcelain` empty after a re-run). Names, purpose comments and recorded declines are authored, reviewed once, then frozen; no regeneration claim is made about them.

**The completeness report**
- **D-04:** A skill with a dedicated script — NOT an MCP tool.
- **D-05:** It is not `anno-coverage.ts` and must not extend it. Trap 1 forbids deriving any measure from the store's block-type listing; there is a standing owner instruction not to extend, verify, or plan gap closure against the coverage instrument.
- **D-06:** The script does not need the broker. `anno-cli.ts` and `anno-store.ts` reach no broker, no `host_tool` op and no `forwardToVice()` — the store is `node:sqlite` in-process.
- **D-07:** The script reaches store data through a fifth `anno` CLI verb. This deliberately supersedes D-14 (2026-08-29, "FOUR VERBS. THAT IS THE WHOLE SURFACE"). The guard that will bite is `anno-verb-coverage.test.ts:59`'s `REAL_VERBS` array — it must be raised in the same change, and the supersession recorded rather than slipped through.
- **D-08:** `routine-queue-walker` owns the script. Not a new skill.
- **D-09:** The disagreement input is made structural TWO ways: (1) a required argument with no default that throws by name when absent; (2) a required output-schema field that only that input can populate, with the report refusing to render without it. Verify by a planted control **observed going red**.
- **D-10:** The output carries the soundness asymmetry two ways, both required: (1) Aggregate — reuse `evid-reconcile.ts`'s four buckets verbatim (`blockCoveredNeverObservedCount` stays its own named line against an explicit `denominator`); (2) Per range — every typed range carries how it was typed (`observed-executing` / `byte-derived` / `authored`). Feeds Phase 46's `BUILD-05`.
- **D-11:** Criterion 1's word "table" maps onto the four split layouts — `lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`. The frozen twelve-member `DATA_TYPES` vocabulary has no `table` member and is not to be widened.

**How the annotation gets done**
- **D-12:** Derive first, then agent closure. dxa + Ghidra import fills block types and cross-references mechanically via the route that already shipped in v0.8.0. The agent pass then does only what derivation cannot: names and purpose comments.
- **D-13:** Execution subset is named up front, and non-execution is rendered, not hidden. Every fixture with a genuine entry point gets a live run under Phase 33's reproducible-run protocol, `memmapshow` ingested and its disagreements cashed. Fixtures with nothing meaningful to execute are reported by name as "not executed" — never as a clean bill of health. Candidates by content: `dxa/tracer.prg`, `dxa/fixture.prg`, `ghidra/bank.prg`, `ghidra/bank-path-dependent.prg`, `ghidra/charset-phantom.prg` and `export-asm/smc.prg`, with `dxa/basic-stub.prg`, `petcat/computed-sys.prg` and `petcat/not-basic.prg` the likely declared non-executed set. **Research must fix the exact list — see Priority 1 below.**
- **D-15:** The enum route is rebuilt in `anno-enum-gen.ts`, over this project's own disassembler. Restore a `generateEnums()`-shaped fetch over `anno_disassemble`/`anno_search` rows, feeding the surviving `pairSearchRows()` and `planEnumsForPairing()`, installing through `anno_create_project_enum` + `anno_apply_enum_usage`.

**Where enum bits render**
- **D-16:** Both surfaces, one owning decoder. `anno-export-asm.ts` carries the proof (real-ACME byte-diff oracle); `anno_disassemble` carries the readability.
- **D-17:** A multi-bit write renders as OR-ed named constants AND a decoded comment — both, not either: `lda #VIC_SCREEN_1024 | VIC_CHARSET_2048   ; screen=$0400, charset=$0800`.

*(D-14 is deliberately unused in CONTEXT.md — it is the 2026-08-29 four-verb-cap decision, superseded by D-07.)*

### Claude's Discretion

- **Fixture set for typing.** All nine committed `.prg` fixtures are in scope for criteria 1, 3 and 4. (Execution scope is separately settled by D-13.)
- **How a decline and an accepted disagreement are recorded.** Criteria 2 and 4 both need a machine-checkable negative statement. Constraint from the roadmap: `.annostore`'s importer already declines with a reason — match that convention rather than inventing a second one. Whether one mechanism serves both criteria or two are needed is open.
- **Which auto-name prefixes count as survivors.** Criterion 3 names `p_XXXX` and `l_XXXX`. But `anno-coverage.ts`'s `AUTO_NAME_PREFIX_RE` already covers eleven prefixes (`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`), and dxa emits `lNNNN` labels of its own shape. Resolve against the actual label population in the derived stores, not against the roadmap prose alone.

### Flags the planner must not lose

1. `ANNO-13` (generated enums) is being partially reclaimed by D-15. `ANNO-14`/`ANNO-15` (symbol round trip) stay unowned — the withdrawal notice must be updated to say so.
2. The historical D-14 four-verb cap is superseded, deliberately (D-07) — record the supersession.
3. Criterion 5's multi-bit demo has exactly one possible home: only `fixtures/ghidra/charset-phantom.prg` writes `$D011` and `$D018` (`8d11d0`, `8d18d0`). No second candidate exists among the committed fixtures.
4. `charset-phantom.prg` is 4097 bytes, mostly charset data.
5. `bank-path-dependent.prg` is criterion 4's own fixture — Pitfalls 5 and 12 both land here, both prevented by decline-with-a-reason.

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope. `todo.match-phase 45` returned 7 matches, none folded (all generic keyword coincidences against broker lifecycle, prior-phase review backlog, or planning hygiene — see CONTEXT.md's `Reviewed Todos` for the full list).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECOMP-01 | Nothing left `Undefined`; every byte typed; completeness gate takes `anno_evid_disagreements` as a required input; soundness asymmetry respected | §1 (execution subset), §"Reusable Oracle" (`evid-reconcile.ts` buckets, verbatim reuse), Pitfall "charset-phantom self-executes" (the asymmetry's sharpest edge case in this fixture set) |
| DECOMP-02 | Every code entry point named + purpose comment (function/inputs/outputs/side effects); no `p_XXXX`/`l_XXXX` survivor | §2 (auto-name prefix population measured empty today), `routine-queue-walker/SKILL.md` reading (queue-build logic assumes a naming convention the current dxa/Ghidra pipeline never produces) |
| DECOMP-03 | Every referenced non-hardware address named/documented, or declined with a reason | §3 (decline mechanism located and its ephemerality measured), `bank-path-dependent.prg` address trace |
| DECOMP-04 | Hardware register writes render as named enums; `$D011`/`$D018` decomposed | §4 (`anno-regbits.json` already has both tables), §"D-17 verified live" (ACME OR-ed constant MEASURED) |
</phase_requirements>

## Summary

Phase 45 asks for zero new architecture and a great deal of new discipline. Every load-bearing seam already ships: `evid-reconcile.ts`'s four-bucket join (v0.9.0), the dxa+Ghidra derivation route (v0.8.0), `anno-export-asm.ts`'s real-ACME byte-diff oracle, `anno-regbits.json`'s curated bit-name table, and the `anno-enum-gen.ts` heuristics (all three functions D-15 needs — `variantNameFor()`, `pairSearchRows()`, `planEnumsForPairing()` — survive as live, tested code). Nothing in this phase requires a new npm dependency, a new host tool, or a new module; the roadmap's own instruction to re-read `ARCHITECTURE.md` on sight of a proposed new module is correct guidance, though this research found that document's cited section title does not exist verbatim in the file today (§"Documentation drift" below) — a citation gap, not a substantive contradiction.

This research fixes the one thing CONTEXT.md explicitly left open for research: the exact execution subset (D-13). Six of the nine committed `.prg` fixtures get a genuine, meaningful live run; three are BASIC-header-only or planted-garbage fixtures with no real machine-code entry point and must be rendered "not executed" by name. One of the six execution candidates — `charset-phantom.prg` — surfaces a genuine, previously-undocumented tension with the phase's own soundness asymmetry: its "charset data" is a chain of real `jsr`/`rts` opcodes that its own entry point actually calls, so executing it for real will mark essentially the whole 2048-byte "table" as **observed executing**, which by DECOMP-01's own rule (`observed-executing IS code`) forces that range to be typed `code`, not the `table`-shaped split layout the fixture's README describes it as demonstrating. This is not a bug in the research — it is the fixture doing exactly what its own header comment says it does (a phantom-routine hazard is, by construction, code masquerading as data), but it means criterion 5's register-decomposition proof and criterion 1's "every byte typed" claim must be planned as compatible with the block being typed `code` end-to-end, with a comment documenting the VIC-II dual read, rather than assuming it lands as a "table".

This research also found that criterion 3's literal survivor pattern (`p_XXXX`/`l_XXXX`) does not correspond to anything either derivation tool currently writes into a store: dxa's own listing convention is `lNNNN` (no underscore — `dxa-listing.test.ts:52`, MEASURED), Ghidra's default function names are `FUN_XXXX` (uppercase, no underscore before the hex — `charset-phantom-minted-labels.json`, MEASURED), and — critically — **neither dxa's import route nor Ghidra's import route (`anno-import.ts`) writes label names into the store at all**; `anno-import.ts` only ever calls `putXref()`. The eleven-prefix `AUTO_NAME_PREFIX_RE` (`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`) is a vestige of the *retired* external analyser's own naming convention, kept alive today only because `routine-queue-walker/SKILL.md` documents it by hand (Phase 2.1/3.1) as its own definition of "auto-generated name" — a definition that no longer matches what this project's current pipeline actually produces. Zero `.annostore` files are committed anywhere in this repo today, so there is no derived-store label population to sample; the plan's Wave 0 must have the executor derive one fixture first and inspect what `anno_get_symbols` actually returns before finalizing the survivor regex.

Finally, this research located the decline mechanism CONTEXT.md points at (`runMemmapJoin` in `anno-join.ts`, `outcome: "declined"`, a named `reason` string) and found it is **ephemeral** — it is returned in the `anno_join_memmap` tool call's JSON result and is never persisted as a store row or comment. If criterion 4's "recorded decline" is to survive past the one tool call that produced it, the plan must have the naming/closure pass explicitly persist a decline as a comment via the existing `anno_set_comment`/`setComment()` path (the same API the "annotated" outcome already uses) — reusing the mechanism, not inventing a second one, and this satisfies CONTEXT.md's "match that convention rather than inventing a second one" instruction more literally than it first appears (the convention to match is "decline with a named reason through the comment API," not merely "the string shape of the reason").

**Primary recommendation:** Build the completeness-report script as a new file under `src/skills/routine-queue-walker/scripts/` (that directory does not exist yet — create it), reached through a fifth `anno` CLI verb that takes `--store` (required) plus a required `--disagreements-file`/inline argument populated from `anno evid-disagreements --json`'s own output shape, and render using the exact `evid-reconcile.ts` field names verbatim (never re-derive or rename `blockCoveredNeverObservedCount`/`denominator`). Do the label-population measurement (dxa/Ghidra output → what actually lands as a store label) as the very first executable task, before finalizing the survivor regex.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Completeness report rendering | Skill script (`routine-queue-walker/scripts/*.mjs`, host-side, no container/broker) | `anno` CLI (fifth verb) | D-04/D-06/D-07: script owns rendering/orchestration, CLI verb owns store access |
| Disagreement join (byte-derived vs. runtime-observed) | `evid-reconcile.ts` (existing, in-process pure function) | `anno-cli.ts`'s `cmdEvidDisagreements` | Already shipped (v0.9.0); this phase is a consumer, never a re-implementer |
| Block typing (derived half) | dxa + Ghidra import route (`anno-import.ts`, existing) | `anno_join_memmap` (bank-state resolution) | D-12: derivation writes block types + xrefs, never names |
| Naming/purpose comments (authored half) | Agent, via `routine-queue-walker` skill playbook | `anno_set_label_name`/`anno_set_comment` | D-03: authored half is reviewed once, then frozen; no store auto-mints these |
| Enum installation | `anno-enum-gen.ts` fetch route (rebuilt this phase) + `anno_create_project_enum`/`anno_apply_enum_usage` | `anno-export-asm.ts` (OR-ed rendering), `anno_disassemble` (readability) | D-15/D-16: one decoder, two renderers, both already-shipped surfaces |
| JSON export/import of full store state | New module this phase (D-02) | `.annostore` (`node:sqlite`, existing) | No general importer exists (`anno_import_ghidra_export` is Ghidra-shaped only, VERIFIED — see §"D-02" below) |
| Register bit decoding | `anno-regbits.json` (existing, committed, both `$D011`/`$D018` already present) | `anno-regbits-gen.ts` (generator, not touched this phase) | D-16 leans on the existing curated table; no new register data needed for criterion 5 |

## Priority Findings

### 1. D-13's execution subset, fixed exactly

All nine `.prg` fixtures under `src/mcp/vice/fixtures/` were enumerated with `find` and their provenance READMEs read in full [VERIFIED: fixture READMEs, this session]:

| Fixture | Bytes | Genuine entry point? | Execution disposition |
|---|---|---|---|
| `dxa/tracer.prg` | 23 | Yes — `$0810`: `LDA #$00; STA $D020; RTS` | **EXECUTE.** Trivial but real code (`fixtures/dxa/README.md`). |
| `dxa/fixture.prg` | 281 | Yes — Phase 23's synthetic 145-code/131-data/3-pad fixture, copied unchanged | **EXECUTE.** Real, larger synthetic program with an established ground-truth partition. |
| `dxa/basic-stub.prg` | 18 | No — 12-byte canonical `10 SYS 2064` BASIC stub followed by 4 arbitrary bytes (`aa bb cc dd`) explicitly built as `unknown`-region ground truth, never real code | **DECLARE NON-EXECUTED.** Running it would `SYS 2064` into four garbage bytes with no defined behaviour; the fixture's own purpose (byte-derived partition ground truth) does not depend on execution. |
| `ghidra/bank.prg` | 60 | Yes — `$0810` (flat64k route): `$01` bank-state flips + `$D020` writes/reads | **EXECUTE.** Straight-line code (MEASURED no branches in `37-RESEARCH.md` §D, quoted in `ghidra/README.md`). |
| `ghidra/bank-path-dependent.prg` | 52 | Yes — `$0810`: calls `probe` twice under two different `$01` values | **EXECUTE.** This is criterion 4's own fixture (Flag 5) — the path-dependent decline case. |
| `ghidra/charset-phantom.prg` | 4097 | Yes — `$0810`: writes `$DD00`/`$D018`/`$D011`, then `jsr charset_start; rts` | **EXECUTE, with a landmine — see Pitfall below.** The one fixture criterion 5 needs; also the one execution candidate whose "table" bytes are real 6502 opcodes that genuinely get called and returned from. |
| `export-asm/smc.prg` | 13 | Yes — `$0801`: `lda #$00; inc $0802; sta $d020; jmp $0801` (self-modifying, infinite loop) | **EXECUTE**, with a caveat: this program never terminates (`jmp $0801` loops forever). The reproducible-run protocol must bound execution by cycle count or checkpoint, not by natural termination — flag for the plan. |
| `petcat/computed-sys.prg` | 26 | No — pure BASIC, `10 sys peek(43)+256*peek(44)` with no machine-code payload of its own; the computed `SYS` target depends on runtime BASIC-pointer state this standalone fixture never establishes meaningfully | **DECLARE NON-EXECUTED.** Its entire purpose (`petcat.decode`'s computed-vs-literal `SYS` handover verdict) is about the BASIC tokenization/decode layer, not about running the program. |
| `petcat/not-basic.prg` | 64 | No — 64 deterministic non-BASIC bytes (`(i*7+3) mod 256`), the `PREP-04` planted-failure fixture for `petcat.decode`'s non-vacuous control | **DECLARE NON-EXECUTED.** By construction it is not a program; it exists to make `petcat.decode` refuse it. |

**Result: six EXECUTE (`dxa/tracer.prg`, `dxa/fixture.prg`, `ghidra/bank.prg`, `ghidra/bank-path-dependent.prg`, `ghidra/charset-phantom.prg`, `export-asm/smc.prg`), three DECLARE NON-EXECUTED (`dxa/basic-stub.prg`, `petcat/computed-sys.prg`, `petcat/not-basic.prg`).** This matches CONTEXT.md's own "candidates by content" list exactly, confirming the roadmap author's prediction — but two caveats the roadmap did not name, found this session:

1. **`export-asm/smc.prg` never halts** (`jmp $0801` loops back to its own start forever) — the reproducible-run protocol invocation must use a checkpoint/cycle-count bound, not wait for the program to return. Note this explicitly in the plan's task for this fixture.
2. **`ghidra/charset-phantom.prg`'s "charset" bytes are real, callable opcodes** — see the Pitfall below; this interacts directly with DECOMP-01's soundness-asymmetry wording ("a range observed executing IS code").

The anti-vacuity guard (D-13's own point): the completeness report must render `dxa/basic-stub.prg`, `petcat/computed-sys.prg` and `petcat/not-basic.prg` with an explicit "NOT EXECUTED" line per fixture (naming why, matching each fixture's own reason above), never merely omit them from the disagreement section.

### 2. Auto-name prefix question, resolved against the actual (absent) label population

**No `.annostore` file exists anywhere in this repository today** [VERIFIED: `find … -iname "*.annostore"` returned nothing, this session]. There is no derived-store label population to sample, so CONTEXT.md's instruction to "resolve against the actual label population in the derived stores" cannot be settled by direct measurement this session — it must be the plan's Wave 0 task, run before the survivor regex is finalized. What this research establishes instead, precisely, is what the *code* currently does and does not produce:

- **dxa's own label convention is `lNNNN`** (lowercase `l` + four lowercase hex digits, **no underscore**) — MEASURED directly from the committed dxa listing fixture: `dxa-listing.test.ts:52`, `"0810          l810:"`, and the full listing at that file's larger fixture shows `l8bf`, `l8df`, `l900`, etc. [VERIFIED: `src/mcp/vice/dxa-listing.test.ts:52,77`]. This is `dxa`'s own external listing text — it is never written into an `.annostore` by any code in this repo (see next point).
- **Ghidra's own default function-label convention is `FUN_XXXX`** (uppercase, underscore, four lowercase hex digits) — MEASURED from the committed fixture `src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json`: `"FUN_1000"`, `"FUN_1004"`, … `"FUN_17fc"` [VERIFIED: `fixtures/ghidra/charset-phantom-minted-labels.json`]. This is Ghidra's *internal* project naming; it is likewise never carried into an `.annostore`.
- **`anno-import.ts` (the one Ghidra-export importer that exists) never writes a label row.** Read in full [VERIFIED: `src/mcp/vice/anno-import.ts:1-40` and onward]: its header states plainly it parses `GhidraStructExport.java`'s `## `-delimited sections and maps `Reference.getReferenceType()` onto the store's `XrefAccessKind` — every write it performs is `putXref()`. There is no label-writing code path in this module at all.
- **`anno_set_label_name` is the only way a name enters the store**, and it is a plain user/agent-supplied write [VERIFIED: `src/mcp/vice/anno-tools.ts:468`, `anno-store.ts:2863` `setLabel()`] — the store never auto-mints a default name for a newly-discovered address.
- **The eleven-prefix `AUTO_NAME_PREFIX_RE`** (`zpf_ f_ zpa_ a_ p_ zpp_ e_ j_ s_ b_ r_`, `anno-coverage.ts:1393`) is explicitly documented in two other modules as the *retired external analyser's own* auto-naming vocabulary, not this project's: `anno-export-asm.ts:103` calls them "upstream's own predefined/user-defined label types," and `module-classification.ts:149-150` makes the same point. [VERIFIED: `anno-coverage.ts:1393`, `anno-export-asm.ts:100-115`, `anno-coverage.test.ts:1413-1421` (the `L_` exclusion test, confirming these are upstream-analyser-shaped, case-sensitive strings)]
- **`routine-queue-walker/SKILL.md` (Phase 2.1 line 85-93, Phase 3.1 line 134-138) builds its entire candidate queue by pattern-matching these exact eleven prefixes** (`s_`, `p_XXXX`, `zpp_XX`, `zpf_XX`, `zpa_XX`, `f_XXXX`, `a_XXXX`, `e_XXXX`, `b_XXXX`) [VERIFIED: `src/skills/routine-queue-walker/SKILL.md:85-93,134-138`, read in full this session].

**The finding, stated plainly:** on a store populated exclusively by the current dxa+Ghidra derivation route (D-12's "derive first" half), `anno_get_symbols` returns **zero labels** to begin with — derivation writes typed ranges and cross-references only, never names. `routine-queue-walker`'s existing candidate-queue logic (which depends on scanning label names for the eleven legacy prefixes) has **no seed to work from** on a freshly-derived store; it was written for an era when the (now-retired) external analyser auto-populated those exact prefixes. **This is a real gap the plan must close**, not a cosmetic one: the routine-queue-walker extension this phase builds (or a preceding step) must derive its candidate queue from **cross-references and block classification directly** (a `JSR`-target address inside a code range is a routine candidate; an address referenced by a split lo/hi pair or an address table is a symbol candidate) rather than from the SKILL.md's current label-prefix scan, which will silently find nothing to do.

Given this, criterion 3's literal wording (`p_XXXX`/`l_XXXX`) does not exactly match either tool's real shape: `p_XXXX` **is** one of the eleven legacy prefixes and would fire correctly if that convention is ever reintroduced by hand; `l_XXXX` (**with** an underscore) is **not** one of the eleven, and does not match dxa's real `lNNNN` (**without** an underscore) either. **Recommendation for the plan:** define the survivor regex explicitly for this phase's own purposes rather than reusing `AUTO_NAME_PREFIX_RE` unmodified (which would silently miss `l_XXXX`) or the literal roadmap text unmodified (which would silently miss dxa's real `lNNNN` shape and Ghidra's real `FUN_XXXX` shape, should either ever be imported as a label verbatim in the future). A defensible union: the eleven `AUTO_NAME_PREFIX_RE` prefixes (imported, never restated, per `anno-export-asm.ts`'s own "do not restate the eleven" rule) **plus** an explicit `^l_[0-9a-fA-F]{4}$` case **plus** a defensive `^(FUN|LAB)_[0-9a-fA-F]{4}$` / `^l[0-9a-fA-F]{3,4}$` case in case a future import route ever carries either tool's raw name through unrenamed. Tag this recommendation `[ASSUMED]` — it has not been validated against a real populated store, because none exists; the plan's Wave 0 should derive one fixture, inspect `anno_get_symbols`' actual output, and confirm or correct this regex before it ships.

### 3. Decline / accepted-disagreement recording mechanism

The mechanism CONTEXT.md points at — "`.annostore`'s importer already declines with a reason" — is `runMemmapJoin()` in `anno-join.ts`, reached via the `anno_join_memmap` tool [VERIFIED: `src/mcp/vice/anno-join.ts:196-209` (the `JoinDecision` interface, `outcome: "declined"` with a required `reason`), and the three concrete decline sites at `anno-join.ts:327` (`bank state … could not be determined`), `:373` (`no recovered processor-port value reaches …`), `:386` (`… is reached under disagreeing processor-port values: …`)]. `anno-bank.ts`'s header states the discipline this implements: "Resolve bank state BEFORE the address; decline with a reason where the program itself does not determine one" [VERIFIED: `src/mcp/vice/anno-bank.ts:1-12`], and explicitly forbids defaulting an unresolved region to RAM (the power-on state) — "the caller … declines instead" [VERIFIED: `anno-bank.ts:38-41`].

**Critical finding: this decline is ephemeral today.** Reading `runMemmapJoin()`'s full body [VERIFIED: `anno-join.ts:296-400`], the "annotated" outcome calls `setComment(handle, …)` — a durable store write — but **every "declined" outcome only pushes an entry into the in-memory `decisions` array that is returned in the tool call's JSON result.** Nothing is written to the store on a decline. If the caller does not separately persist that JSON somewhere durable, the decline vanishes the moment the tool call returns and a later session (or the completeness report itself, reading the store fresh) has no way to see it.

This directly resolves the open discretion question: **one mechanism can serve both criterion 2's "accepted disagreement" and criterion 4's "recorded decline," but only if the plan adds a persistence step that does not exist yet.** The natural, convention-matching answer (reusing the exact API the "annotated" branch already uses, rather than inventing a second one) is: **write every decline — bank-state or disagreement — as a store comment** via `anno_set_comment`/`setComment()`, using a distinguishable, greppable prefix (e.g., a `DECLINED: <reason>` line comment at the affected address, parallel to how `runMemmapJoin`'s own annotated branch already prefixes its written text with `BANK_PROVENANCE_PREFIX`/`PROVENANCE_TOKEN_PREFIX`, `anno-join.ts` around the `annotateUnderRegion` closure). A completeness-report reader can then treat "a comment matching the decline prefix exists at this address" as the durable, checkable negative statement both criteria need, without a new schema field, a new table, or a second convention. This is `[VERIFIED]` as *available* (the comment API exists and is exercised for exactly this purpose already) but the specific "write declines through `anno_set_comment` with a named prefix" design is this research's own synthesis, not something already coded — tag it as a strong, evidence-grounded recommendation for the plan, not as an already-shipped fact.

Note also that `anno_join_memmap`'s decline path only fires for **bank-state** and **graphics-derivation** ambiguity (AUTO-04/AUTO-05/AUTO-06/AUTO-07); it says nothing about a **disagreement-oracle** "accepted disagreement" (criterion 2's own case: a byte-derived `data` classification the runtime evidence contradicts, which the human/agent explicitly reviews and accepts rather than reclassifies). That is a different kind of decline — reviewed and accepted, not merely "could not be determined" — and needs its own comment text distinguishing "declined: unknown" from "disagreement: accepted, reason X" even if both ride the same `anno_set_comment` mechanism. Recommend two distinguishable comment-text conventions over the one shared API, not two APIs.

### 4. Integration surface, file:line map

**`evid-reconcile.ts`** (316 lines) [VERIFIED, read in full this session]:
- Header (`:1-73`) states the four buckets and the union-across-runs prohibition verbatim.
- `EvidReconciliation` interface (`:124-174`) — the exact field names the report must reuse: `disagreements` (array, declared/returned FIRST), `disagreementCount`, `agreementCount` (count only, no row array), `blockCoveredNeverObservedCount` (`:143`), `observedOutsideAnyBlockCount` (`:152`), `observedAtUndefinedBlockCount` (`:160`), `denominator` (`:168`), `positiveClass: "code"` (`:170`), `tier: "runtime-observed"` (`:173`).
- `reconcileObservedExecution(input: EvidReconcileInput): EvidReconciliation` (`:217`) is the pure join function; it takes already-fetched `blocks`/`observations` and an optional `classifier`, fetches nothing itself.
- Five named traps (`:49-73`): never fetch either side here; never compare a block-type string directly; never return a percentage/rate/ratio; never let "no row" collide with "observed not executing"; never derive `data` from absence.

**`anno-cli.ts`** (1658 lines) [VERIFIED]:
- `evid-disagreements` is the existing fourth verb, added by plan 43-06 (header comment `:1-16`).
- `REAL_VERBS` guard: `src/mcp/vice/anno-verb-coverage.test.ts:59` — `const REAL_VERBS = ["coverage", "export-asm", "render-memmap", "evid-disagreements"]`, and `ANNO_CLI_VERB_FLOOR = 4` at `scripts/lib/anno-cli-verbs.mjs:92`, asserted `assert.equal(ANNO_CLI_VERB_FLOOR, 4)` at `anno-verb-coverage.test.ts:191`. **Both the array and the floor constant must be raised together** when the fifth verb lands (the file's own comment history at `:41-59` documents the 8→2→3→4 progression, each raise moving both together).
- `printEvidDisagreementsReport()` (`:1482-1508`) is the precedent to copy: five headed sections, never a combined figure, `denominator` printed beside every count, disagreements section rendered FIRST.
- `cmdEvidDisagreements()` (`:1526-1588`) is the precedent for how the fifth verb should open the store read-only (`mustExist: true`), fetch both sides itself, call `reconcileObservedExecution()`, and support `--json`.
- Dispatch switch (`:1598-1652`) is the one place a new `case` and the updated four-verb error message (`:1644`) both land.

**`anno-verb-coverage.test.ts`** — confirmed above; this is a *frozen registry*, hand-maintained, deliberately not derived from the parser under test (`:41-44`), so it must be edited by hand in the same commit that adds the fifth verb.

**`anno-enum-gen.ts`** (533 lines) [VERIFIED, header read in full]:
- What left (2026-08-30, plan 29-10): the fetch (two disassembly searches), `parseSearchRows()`, `createOrUpdateEnum()`/`applyUsage()` (the install), and `generateEnums()` (the pass stringing them together) — all four spoke to the retired analyser.
- What survives, as live, tested code: `variantNameFor()` (`:185`), `pairSearchRows()` (`:314`, the D-23 adjacent-pair rule — a store pairs with an immediate load exactly 2 bytes earlier, adjacent-only), `planEnumsForPairing()` (`:443`, D-20's one-variant-per-distinct-value rule), `sanitizeVariantMap()` (`:385`), `buildEnumGenerationReport()` (`:499`).
- D-15's job: rebuild the fetch (over `anno_disassemble`/`anno_search` rows instead of the retired analyser's rows) and the install (`anno_create_project_enum` + `anno_apply_enum_usage`, both already-shipped tools) — feed the surviving heuristics unchanged.

**`anno-regbits.json` / `anno-regbits-gen.ts`**: both `$D011` and `$D018` bit-name tables **already exist and are committed today** [VERIFIED: `src/mcp/vice/anno-regbits.json:54` (`$D011`, fields `YSCROLL`/`ROWS`/`SCREENON`/`MODE`/`ECM`/`RST8`) and `:320` (`$D018`, fields `SELECT_UPPER_LOWER_CHARACTER_SET`/`CHARACTER_DOT_DATA_BASE_ADDRESS`/`VIDEO_MATRIX_BASE_ADDRESS`)]. No new register data is needed for criterion 5; the work is entirely in the *rendering* (D-16/D-17), not the decode table.

**`anno-export-asm.ts`** (1310 lines): the ACME byte-diff oracle exists and is exercised in `anno-export-asm.test.ts` today, but **the OR-ed multi-bit-constant rendering shape D-17 asks for (`lda #A | B`) does not exist anywhere in this file today** [VERIFIED by grep: no `| ` OR-expression emission found in `anno-export-asm.ts`'s production code]. This is genuinely new work, not an extension of an existing render path. **D-17's load-bearing claim was independently verified live this session** — see "D-17 verified live" below.

**`anno-types.ts`**: `DATA_TYPES` (`:288-301`) is exactly the frozen twelve — `code, byte, word, address, petscii, screencode, lo_hi_address, hi_lo_address, lo_hi_word, hi_lo_word, external_file, undefined` — confirmed both in source and in `anno-types.test.ts:63-78`'s hand-written `TWELVE_MEMBERS` array with a `deepEqual` assertion plus a frozen-object assertion [VERIFIED, both files read in full]. `SPLIT_DATA_TYPES` (`:322-323`) is derived by filtering on the `lo_hi_`/`hi_lo_` prefixes (`:308,313,318-320`) — confirming D-11's claim that the four split layouts are exactly `lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`, and that there is no `table` member anywhere in the vocabulary.

### 5. D-02: the JSON export/import gap, confirmed

`anno-tools.ts`'s full `anno_*` tool list (24 tools, enumerated in full this session) [VERIFIED: `grep -n '  name: "anno_' src/mcp/vice/anno-tools.ts`] contains exactly one import-shaped tool: `anno_import_ghidra_export` (`:968`), which — per `anno-import.ts`'s own header — is scoped to `GhidraStructExport.java`'s specific `## `-delimited transfer format and writes xrefs only. **No tool or CLI verb exports or imports the store's full state as a general JSON document.** CONTEXT.md's claim is confirmed exactly as stated.

What the store's full state actually comprises, so the planner knows what a round-trip must carry (read from `anno-types.ts`'s `RangeRow`, `LabelRow`, `CommentRow`, `ProjectEnumRow`, `EnumUsageRow` interfaces and `anno-store.ts`'s corresponding `list*`/`set*` functions, all read this session): typed ranges (`start`, `endInclusive`, `dataType`, `bank`), labels (address → name), comments (address, `commentType: "line"|"side"`, text), project enums (name, register, variant map) and their usage bindings, plus cross-references (`toAddress`, access kind) and — new to v0.9.0 — execution-observation rows (`anno_evid_ingest`'s table). **D-03's split-provenance requirement maps onto this schema naturally**: ranges/xrefs/enum-bindings are the derived half (must regenerate byte-identically from a re-run of the dxa+Ghidra route); labels/comments/(and, per §3 above, decline-comments) are the authored half. The export schema should carry a provenance tag per row-class (or per individual row, if declines and ordinary comments must be distinguished at that granularity) so the two halves stay distinguishable on disk, exactly as D-03 requires — recommend tagging at the row level via a `provenance: "derived"|"authored"` field on each exported comment/range row rather than only at the table level, since a single fixture will mix authored purpose-comments and derived-decline-comments in the same comment table.

### 6. Derived-half idempotence bar

`fixtures/coverage/make-coverage-fixtures.mjs` and its README state the bar plainly [VERIFIED: `fixtures/coverage/README.md:38-39`, `make-coverage-fixtures.mjs:47,73`]: "The generator is deterministic and idempotent — running it twice must leave `git status --porcelain src/mcp/vice/fixtures/coverage` empty." **This research found no CI job that actually re-runs this generator and checks the diff** [checked: `.github/workflows/ci.yml` has no reference to `make-coverage-fixtures.mjs` or `make-export-asm-fixtures.mjs`]. The bar today is enforced by convention/manual discipline, not by an automated gate. The `export-asm` fixture generator states the identical bar in its own README (`fixtures/export-asm/README.md:70-72`) and is likewise not CI-enforced by an automated re-run-and-diff step, as far as this search found. **Recommendation:** the plan should either (a) accept the existing convention (regenerate-and-`git diff`-by-hand before each commit, matching current project practice) for the new per-fixture derived-half regeneration, or (b) add a genuinely new CI step — but note that (b) is arguably new CI surface the REQUIREMENTS.md "Out of Scope" table does not explicitly forbid (only new *npm runtime dependencies and host prerequisites* are excluded) but which is not requested by any of DECOMP-01..04 either; recommend (a) unless the plan's own verification loop needs the stronger guarantee.

### 7. `routine-queue-walker` skill — what exists and where the script lands

Read in full this session (273 lines). **`src/skills/routine-queue-walker/scripts/` does not exist yet** [VERIFIED: `ls` on that path fails — no such directory]. The skill today is a pure prose playbook with no accompanying scripts, unlike `acme-build` (which has `scripts/*.mjs`). The new completeness-report script is genuinely net-new, not an addition to an existing scripts directory.

Two structural findings from the read:
- **Phase 5 of the existing playbook already invokes `anno coverage`** (the CLI verb backed by `anno-coverage.ts`) as its own "measure the pass instead of asserting it finished" step (`SKILL.md:192-258`). This is the exact instrument D-05 forbids the *new* completeness report from being or extending. The plan must make clear in the skill's prose that Phase 5's existing `anno coverage` invocation and the new completeness-report verb are two **different, non-overlapping** measurements — one is `anno-coverage.ts`'s byte-census/label-ratio instrument (kept, unchanged), the other is this phase's disagreement-gated completeness gate (new). Do not let the SKILL.md read as though the new report replaces Phase 5's existing coverage call; both stay.
- **The existing candidate-queue-building logic (Phase 2.1/3.1) cannot fire on a dxa/Ghidra-derived store** — see §2 above. The plan must either (a) add a preceding step to Phase 2 that builds the routine/symbol candidate queue from cross-references and block classification when no auto-named labels exist, or (b) explicitly scope this phase's naming pass to work directly from `anno_get_cross_references`/`anno_get_blocks` output rather than the SKILL.md's current label-scan logic. Given D-08 says "the completeness report supplies the numeric stop condition it currently lacks" (implying the *existing* walk logic is otherwise sufficient), this gap should be surfaced to the planner as a decision point rather than silently patched by research.

**Container-out seam / D-06 cross-check:** confirmed independently — `anno-cli.ts` and `anno-store.ts` never call `runHostTool()`, never touch `child_process`, and the store is `node:sqlite` in-process [VERIFIED by the absence of any `host_tool`/`spawnSync`/`forwardToVice` reference in either file, checked this session]. The new script is a pure Node script calling the CLI verb in-process (or via `node vice-proxy.ts anno <verb>` exactly as `SKILL.md:198` already does for `anno coverage`) — no container-out seam is implicated, matching D-06 exactly.

### 8. D-09's planted-control convention

No project-wide single named convention file exists for "a control that flips to red on demand"; the discipline is applied ad hoc, per-guard, and is well-precedented across the codebase [VERIFIED via multiple citations]: `ROADMAP.md:834` ("Durability is proven by planted violation… removing the save makes that same test go red, observed rather than assumed"), `ROADMAP.md:1017` and `:1108` (BUILD-07's own planned planted control for a later phase), `PROJECT.md:266` ("each re-proven by a planted violation observed red and reverted"), `PROJECT.md:269` (`scripts/check-no-skill-external-spawn.mjs`, "observed biting on three planted violations while holding on four exemptions"). **The mechanism, consistently, is: write a test that (1) asserts the guard fires against a deliberately-broken/omitted variant of the code under test (observed red, and the red output is recorded/quoted in the plan's own evidence), then (2) reverts to the real code and re-asserts green.** For D-09's specific case — "removing the disagreement query makes the gate fail rather than silently pass" — the concrete test shape is: call the completeness-report function/verb with the required disagreement argument omitted (or, if TypeScript makes that unrepresentable at the call site, delete the required-argument check in a scratch copy and observe the previously-passing render now fail) and assert the refusal message names the missing input, then restore and re-assert the normal render succeeds. This matches the pattern `anno-store.test.ts`'s own STORE-04 durability tests already use (four observed reds, each reverted before its commit, per the STATE.md excerpt read this session) — reuse that shape rather than inventing a new one.

### 9. `charset-phantom.prg` sizing and the execution landmine

Read `charset-phantom.a` in full this session [VERIFIED]. The charset block is `!for i, 0, 510 { jsr * + 4 ; rts }` (511 four-byte blocks) plus a terminal four-byte `rts rts rts rts` block — 511×4 + 4 = 2048 bytes exactly, matching `CHARACTER_SET_SIZE`. **Traced by hand and confirmed against the source**: `start`'s single `jsr charset_start` genuinely calls into this chain, and because every block's own trailing `RTS` is a real 6502 return, the CPU will execute block 0 → JSR into block 1 → JSR into block 2 → … → JSR into block 510 → JSR into the terminal block (whose *first* `RTS` fires) → and then unwind cleanly back through every intervening block's own trailing `RTS`, popping exactly one return address per level. **Consequence: essentially all 2044 bytes of blocks 0–510, plus the terminal block's first byte, will show up as `observed executing` if this fixture is run for real** — only the terminal block's last three (dead) `RTS` bytes never execute.

This directly collides with DECOMP-01's own stated soundness rule: "a range observed executing IS code." If `charset-phantom.prg` is executed per D-13 (as CONTEXT.md's own candidate list says it should be), the completeness report's own required-disagreement-input logic will see the ENTIRE charset range as `observed executing`, and by the phase's own rule that range **must** be typed `code`, not the `table`-shaped split layout its README describes it as testing. This is not a contradiction to be papered over — the fixture's own header comment is explicit that this is exactly the point (a "phantom routine" is, definitionally, bytes that are simultaneously valid graphics data AND valid, callable code): **the correct annotation, forced by the phase's own evidence-first rule, is to type the whole 2048-byte range as `code`** (each 4-byte block a tiny real subroutine) and document, via a comment, that the VIC-II hardware independently reads the identical bytes as a character set — the dual-use fact belongs in prose, not in a data-type override that would contradict observed execution. **This must be stated explicitly in the plan** so the executor does not spend time trying to force this fixture's charset region into a `table` typing that the evidence itself forbids. Note this does not touch criterion 5 (`$D011`/`$D018` register-write decomposition), which is independent of how the charset *body* bytes end up typed.

**Byte layout, for "what does 'every byte typed' mean for a 4K charset table" concretely**: `$0801-$080f` (15 bytes) — BASIC stub + pad, `byte`/pad-shaped, identical treatment to every other fixture's stub. `$0810-$0822` (19 bytes, flat64k addressing) — `start`'s six instructions (three `lda #imm`/`sta $xxxx` pairs + `jsr`+`rts`), typed `code`. `$0823-$0fff` (988 bytes) — the `* = $1000` gap-fill, all zero bytes, typed `byte` (or, if a run-length-friendly convention is preferred, one single `byte` range covering the whole gap — the store's range model is start/endInclusive so one row suffices). `$1000-$17ff` (2048 bytes) — the charset chain, typed `code` per the finding above once executed (511 four-byte "routines" could in principle be one giant range if the report's typing is range-based rather than per-instruction, or 512 tiny ranges if the store models each block separately; **recommend one range** covering `$1000-$17fc` plus the four-byte terminal, since nothing about criterion 1 requires per-instruction granularity, only that no byte reads `Undefined`). This means "every byte typed" for this fixture is achievable with roughly **4 range rows total** (stub+pad, code, zero-fill gap, charset-chain-as-code), not 512 — the 4K size is not itself a granularity problem once the execution finding above is accepted.

### 10. Pitfalls and landmines (consolidated)

1. **`charset-phantom.prg`'s charset bytes are real, callable code, not inert data** — see §9. Landmine: assuming the fixture demonstrates a "table" typing; the phase's own soundness rule forces `code`.
2. **Auto-name prefix mismatch** — see §2. Landmine: reusing `AUTO_NAME_PREFIX_RE` or the roadmap's literal `p_XXXX`/`l_XXXX` text unmodified will either miss real cases or vacuously pass a store that was never at risk of the failure mode criterion 3 names.
3. **Ephemeral decline** — see §3. Landmine: treating `anno_join_memmap`'s `outcome: "declined"` JSON response as itself satisfying "recorded" — it is not persisted anywhere unless the plan adds a comment-write step.
4. **`export-asm/smc.prg` never halts** — see §1. Landmine: the reproducible-run protocol invocation for this fixture must bound execution explicitly (checkpoint or cycle count), or the run will hang.
5. **Bank-state collapse (named in the roadmap Notes)** — `bank-path-dependent.prg`'s `probe` subroutine is reached under two different `$01` values from two different callers; a naive single-pass annotation would collapse both into one incorrect bank assumption. `anno-join.ts`'s `computeReachingValues` already handles the "several disagreeing values" case by declining (`:386`) — the plan must ensure the naming/purpose-comment pass reads this decline and writes an honest comment rather than picking one caller's bank state arbitrarily.
6. **Fabricated indirect targets (named in the roadmap Notes)** — same fixture, same discipline: `$D000,x` (character-ROM read under `$33`, RAM read under `$34`) must not be annotated with a single confident symbol; the two-bank-state ambiguity must be recorded, not resolved by guessing.
7. **The `.prg`-route two-byte address shift** — every ghidra fixture's README documents that Ghidra's `.prg` import route (`BinaryLoader`, which does not strip the 2-byte load-address header) shifts every address two bytes later than the flat64k route and, per `bank-path-dependent.a`'s finding, **breaks internal `jsr` targets on the `.prg` route specifically** (the call lands 2 bytes before the real target). **The plan must specify which Ghidra import route each fixture's derivation pass uses** — the flat64k route is the only one where `bank-path-dependent.prg`'s internal call resolves correctly, and it is the only route on which `charset-phantom.prg`'s register-derived character-set range (`$1000-$17ff`) coincides with the loaded bytes at all (the README states the `.prg` route is "UNUSABLE for this specific proof" for that fixture). **Recommend flat64k route for `bank-path-dependent.prg` and `charset-phantom.prg`; either route is fine for `bank.prg`** (straight-line, no internal jsr).
8. **`anno-verb-coverage.test.ts`'s `REAL_VERBS` is hand-maintained by design** (`:41-44`, "Deriving this array from `parseAnnoCliVerbs()`… would turn every assertion below into a tautology") — a plan that adds the fifth verb to the dispatch switch but forgets this array (and `ANNO_CLI_VERB_FLOOR`) will fail this test with a clear, expected message; document it as a mandatory paired edit, not an optional follow-up.
9. **`anno_evid_disagreements`'s run-identity filter is all-or-nothing** — `image_sha256`/`argv_digest`/`seed` must be supplied together or omitted together (`anno-tools.ts:1116-1152`, "supply all three together or none; a partial identity is refused"). If the completeness report wants to scope disagreements to exactly one fixture's own canonical run (recommended, to avoid a union across accidental re-runs polluting the report), the plan must thread all three identity fields through from the reproducible-run protocol's own recorded identity, not just the store path.
10. **Documentation drift on the canonical-reference pointer** — CONTEXT.md's `<canonical_refs>` points the planner at `.planning/codebase/ARCHITECTURE.md § "What already exists that this milestone builds on"`. This exact section heading does not exist in that file [VERIFIED: `grep` for the heading text and for any v0.9.0/v1.0.0/`evid-reconcile` reference in `ARCHITECTURE.md` returned nothing; the file's own header states `Analysis Date: 2026-09-01`, git-log-confirmed as its last touch, predating this milestone's 2026-09-10 open]. This is a citation gap in CONTEXT.md, not a contradiction of any decision — flagging per the measurement discipline's "say so explicitly and loudly" instruction. The planner should not spend time hunting for a section that is not there; this RESEARCH.md's own file:line citations above supersede that pointer for this phase's purposes.
11. **`anno-coverage.ts` trap 1, exact wording, for the plan to quote verbatim if it explains why the new report is separate**: *"NEVER derive any measure from the store's block-type listing. … A 'completeness' number sourced from the block table measures the annotator's bookkeeping, not the annotation -- and mass `anno_set_data_type` calls would move it for free."* [VERIFIED: `anno-coverage.ts:65-69`]

## Standard Stack

No new dependency of any kind. This phase is a pure consumer of already-shipped, already-committed modules (`evid-reconcile.ts`, `anno-cli.ts`, `anno-store.ts`, `anno-import.ts`, `anno-join.ts`, `anno-bank.ts`, `anno-enum-gen.ts`, `anno-export-asm.ts`, `anno-regbits.json`) plus one new file (the completeness-report script) and one new CLI verb (thin dispatch glue inside the existing `anno-cli.ts`). REQUIREMENTS.md's own "Out of Scope" table explicitly forbids new npm runtime dependencies and new host prerequisites for this milestone — this research found no reason any would be needed.

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| A skill script (D-04, locked) | A new MCP tool | Explicitly rejected by the user; MCP tools are a store/tool-surface change with a different review bar, and the whole point of D-04 was to keep this phase's output a playbook artifact, not a new tool contract |
| Reusing `evid-reconcile.ts` verbatim (D-10, locked) | Re-deriving the four buckets inside the new report | Would duplicate the union-across-runs prohibition and the five named traps in a second place — exactly the anti-pattern this codebase's own header comments warn against repeatedly |
| Persisting declines as store comments (this research's recommendation, §3) | A new store table/column for "declined" state | A new table is explicitly out of scope per REQUIREMENTS.md's "A store table for the hazard report" exclusion's own reasoning (though that line names the hazard report specifically, the same "derived query over existing tables" principle applies here — a decline is expressible as a comment without a schema change) |

**Installation:** none required.

## Package Legitimacy Audit

Not applicable — no external package is installed, imported, or newly depended upon by this phase.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌─────────────────────────────────────────────┐
                     │   Committed fixture (.prg, 9 files)          │
                     └───────────────────┬───────────────────────-─┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │ D-12 STEP 1: derive (existing, v0.8.0)           │
                 │  dxa disassemble  +  ghidra.analyze              │
                 │  → block types + xrefs written via anno-import.ts│
                 │  → NO labels written (measured, §2)              │
                 └────────────────────────┬───────────────────────-┘
                                          │  .annostore (per-fixture, D-01)
                 ┌────────────────────────┴────────────────────────┐
                 │ EXECUTE candidates only (6 of 9, D-13/§1):       │
                 │  Phase 33 reproducible-run protocol → VICE       │
                 │  memmapshow → anno_evid_ingest → exec observations│
                 └────────────────────────┬───────────────────────-┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │ D-12 STEP 2: agent closure (this phase, new)     │
                 │  routine-queue-walker: candidate queue FROM      │
                 │  xrefs+blocks (NOT label-prefix scan, §7)        │
                 │  → anno_set_label_name, anno_set_comment         │
                 │  → declines persisted as comments (§3, new)      │
                 │  → enum install via rebuilt anno-enum-gen.ts     │
                 │    fetch (D-15) + anno_create_project_enum       │
                 └────────────────────────┬───────────────────────-┘
                                          │
                 ┌────────────────────────┴────────────────────────┐
                 │ evid-reconcile.ts (existing, v0.9.0, UNCHANGED)  │
                 │  reconcileObservedExecution(blocks, observations)│
                 │  → EvidReconciliation (4 buckets, verbatim, D-10)│
                 └────────────────────────┬───────────────────────-┘
                                          │  required input (D-09)
                 ┌────────────────────────┴────────────────────────┐
                 │ NEW: completeness-report script                 │
                 │  src/skills/routine-queue-walker/scripts/*.mjs  │
                 │  reached via NEW 5th `anno` CLI verb (D-07)      │
                 │  REFUSES to render without disagreement input   │
                 │  renders: zero-Undefined census, disagreement/  │
                 │  decline resolution status, survivor search,    │
                 │  symbol/register-enum completeness              │
                 └───────────────────────────────────────────────-─┘
```

### Recommended Project Structure

```
src/mcp/vice/
├── anno-cli.ts               # fifth verb dispatch lands here (D-07)
├── anno-verb-coverage.test.ts  # REAL_VERBS + ANNO_CLI_VERB_FLOOR raised in the same change
├── evid-reconcile.ts          # UNCHANGED — imported, never re-implemented
├── anno-enum-gen.ts           # rebuilt fetch route (D-15) added around surviving heuristics
├── anno-store-export.ts       # NEW (D-02): general JSON export/import module
├── anno-store-export.test.ts  # NEW: round-trip test
src/skills/routine-queue-walker/
├── SKILL.md                   # extended: candidate-queue-from-xrefs guidance (§7), Phase 5's
│                               #   existing `anno coverage` call left untouched and disambiguated
│                               #   from the new completeness report
└── scripts/                   # NEW DIRECTORY — does not exist today
    └── completeness-report.mjs  # NEW: the D-04 script, calls the fifth CLI verb
```

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Byte-derived vs. runtime-observed disagreement join | A second reconciliation function inside the new report | `evid-reconcile.ts`'s `reconcileObservedExecution()`, imported | D-10 requires verbatim field reuse; a second implementation would drift from the five named traps that took a dedicated module to get right |
| Register bit decomposition | A hand-rolled `$D011`/`$D018` bit table | `anno-regbits.json` (already committed, already has both registers) | Re-deriving from `memmap.json` by regex is explicitly the failure `anno-regbits-gen.ts`'s own header warns against; the curated table already exists |
| Enum naming/pairing heuristics | New value→variant naming logic | `anno-enum-gen.ts`'s `variantNameFor()`/`pairSearchRows()`/`planEnumsForPairing()` | Pinned by injectivity tests across all 256 values; D-15 explicitly says these survive unchanged, only the fetch/install route is new |
| Completeness/coverage measurement | Extending `anno-coverage.ts` | A wholly separate report (D-05) | Trap 1: any measure sourced from the block-type listing measures bookkeeping, not annotation; there is a standing owner instruction against extending this instrument |

**Key insight:** every piece of this phase that looks like it needs new logic has, on inspection, either an existing module that already does it (regbits, enum heuristics, the disagreement join) or an existing convention it must extend rather than reinvent (the decline-via-comment pattern, the planted-red-control pattern). The only genuinely new code is: the completeness-report script itself, the fifth CLI verb's thin dispatch, the enum-gen fetch/install route, and the general store JSON export/import module.

## Common Pitfalls

See "Priority Findings §10" above for the consolidated, cited list (11 items). The two most consequential for planning are #1 (`charset-phantom.prg`'s self-executing "table") and #3/#2 combined (the decline mechanism is ephemeral, and the auto-name-prefix convention the existing skill playbook assumes does not match what the current derivation tools actually produce).

## Code Examples

### D-17 verified live — ACME assembles the OR-ed named-constant form

MEASURED this session against the real, locally-installed ACME 0.97 ("Zem"), the exact assembler version every other fixture README in this repo cites:

```asm
VIC_SCREEN_1024 = %00000000
VIC_CHARSET_2048 = %00000100
        * = $0801
        !byte $0b,$08,$0a,$00,$9e,$32,$30,$36,$34,$00,$00,$00
        * = $0810
start:
        lda #VIC_SCREEN_1024 | VIC_CHARSET_2048
        sta $d018
        rts
```

```
$ acme -f cbm -o or-test.prg -r or-test.rep or-test.a
exit=0
0810 a904                       lda #VIC_SCREEN_1024 | VIC_CHARSET_2048
0812 8d18d0                     sta $d018
0815 60                         rts
```

Assembled bytes: `a9 04` — `LDA #$04`, byte-identical to a direct `lda #$04`. **D-17's shape is confirmed real, assembling and reassembling byte-identically under real ACME**, resolving what the research priorities flagged as this decision's own load-bearing, previously-unverified claim.

### `evid-reconcile.ts`'s field names, to reuse verbatim in the completeness report (D-10)

```typescript
// Source: src/mcp/vice/evid-reconcile.ts:124-174 (read in full this session)
export interface EvidReconciliation {
  disagreements: EvidDisagreement[];       // FIRST field, declared and returned first
  disagreementCount: number;
  agreementCount: number;                  // count only, no row array
  blockCoveredNeverObservedCount: number;  // NEVER folded into a class or a rate
  observedOutsideAnyBlockCount: number;
  observedAtUndefinedBlockCount: number;
  denominator: number;                     // every other count is a fraction OF this
  positiveClass: "code";
  tier: "runtime-observed";
}
```

### `printEvidDisagreementsReport()`'s rendering discipline, to copy for the new report

```typescript
// Source: src/mcp/vice/anno-cli.ts:1482-1508 (read in full this session)
console.log(`  DISAGREEMENTS (${r.disagreementCount} of ${r.denominator})`);
// ... disagreements FIRST, agreement as a bare count, never-observed with an
// explicit "absence proves nothing" sentence, never a combined percentage.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| External-analyser-rented `.annostore` with `s_`/`p_`/`zpp_`-style auto-naming | This project's own `node:sqlite`-backed store, populated by dxa+Ghidra, with NO auto-naming at all | v0.7.0 (2026-08-26 "no parity" decision) → v0.8.0 dxa/Ghidra pivot | `routine-queue-walker/SKILL.md`'s candidate-queue logic (written for the old auto-naming convention) is now stale against the current pipeline — §2/§7 above |
| Three-verb `anno` CLI cap (D-14, 2026-08-29) | Four verbs (2026-08-31 `export-asm` return; 2026-09-?? `evid-disagreements`), five after this phase (D-07) | Each raise is paired with `ANNO_CLI_VERB_FLOOR` in the same commit | This phase's fifth-verb addition follows an established, tested pattern — not a novel risk |
| `anno-enum-gen.ts` fully wired (`ANNO-13`) | Route deleted 2026-08-30 (plan 29-10), heuristics kept live, "no phase owns its return" | Until this phase (D-15) | `.planning/PROJECT.md:228-229`'s withdrawal notice needs updating to record the partial reclaim, per Flag 1 |

**Deprecated/outdated:** the `routine-queue-walker/SKILL.md`'s Phase 2.1/3.1 label-prefix-based candidate-queue logic is effectively unreachable against a purely dxa/Ghidra-derived store (§2/§7) and needs an explicit extension or a documented alternate candidate-source, not a silent workaround.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | The survivor regex for criterion 3 should be the eleven `AUTO_NAME_PREFIX_RE` prefixes plus an explicit `l_XXXX` case plus defensive `FUN_XXXX`/`lNNNN` cases | §2 | If a future import route ever carries a raw dxa/Ghidra name into a label unrenamed, an under-scoped regex would let a real survivor through silently; an over-scoped one could false-flag a legitimate authored name that happens to start with a covered prefix (unlikely given the prefixes are short and specific, but not impossible for `a_` or `b_`) |
| A2 | Declines (bank-state, disagreement-accepted) should be persisted as `anno_set_comment` writes with a distinguishing text prefix, rather than a new schema field | §3 | If the plan instead wants declines to be queryable structurally (not just greppable in comment text), a schema change becomes necessary and the "match the existing convention, no second mechanism" framing changes; this is a design recommendation, not a measured fact about what the code already does |
| A3 | `charset-phantom.prg`'s charset chain should be typed as one (or a few) `code` range(s) rather than per-4-byte-block ranges | §9 | If the plan intends per-instruction-level range granularity elsewhere in this phase for consistency, this recommendation should be revisited; nothing in DECOMP-01..04 requires per-instruction ranges, only zero `Undefined` bytes |
| A4 | The completeness report's disagreement query should be scoped to a fixture's own single canonical run via `image_sha256`/`argv_digest`/`seed`, rather than reading the union across all runs a store has ever recorded | Pitfall 9 | If a fixture's `.annostore` never accumulates more than one run's observations in practice, this scoping is unnecessary ceremony; if it does (e.g., a re-run during debugging), omitting it risks the completeness report silently reading a stale or duplicated run's evidence |

## Open Questions

1. **Exactly how should the new candidate-queue-building step for a label-free, dxa/Ghidra-derived store be specified?**
   - What we know: the existing `routine-queue-walker/SKILL.md` Phase 2.1/3.1 logic assumes pre-existing auto-named labels that the current pipeline never produces (§2/§7).
   - What's unclear: whether this phase should patch the existing SKILL.md's queue-building steps in place, or whether D-08's "the completeness report supplies the numeric stop condition it currently lacks" implies the queue-building logic is out of this phase's scope and was already expected to be extended by some other means research did not find.
   - Recommendation: the plan should make an explicit decision here rather than treat it as implied; this research recommends extending Phase 2.1/3.1 to build the candidate list from `anno_get_cross_references`/`anno_get_blocks` (JSR targets in code ranges; addresses referenced by split lo/hi pairs or tables) as a documented alternate path alongside the existing label-prefix path, so the skill still works correctly against a future store that DOES carry externally-imported auto-names.

2. **Should the JSON export/import module (D-02) be scoped to per-fixture stores only (D-01), or generalized?**
   - What we know: D-01 locks one store per fixture; D-02 is described as "the export becomes a committed on-disk format every later phase's fixtures are written in."
   - What's unclear: whether Phase 46/47's own needs (which this research did not investigate, being out of this phase's scope) place any additional shape requirements on the export schema beyond what D-03's split-provenance and this phase's own criteria need.
   - Recommendation: design the schema to the concrete needs measured in §5 (typed ranges, labels, comments, enum bindings/usage, xrefs, exec observations, plus a provenance tag) and flag in the plan that Phase 46's consumption of D-10's per-range provenance markers (`BUILD-05`) is the one forward dependency this research is aware of but has not independently verified against Phase 46's own not-yet-written research.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| ACME cross-assembler | Verifying D-17's byte-diff oracle claim (already exercised in existing tests); not newly required by this phase | ✓ | `ACME, release 0.97 ("Zem"), 31 Jan 2021` at `/home/henrik/.local/bin/acme`, MEASURED this session | — |
| `node:sqlite` / Node test runner | `.annostore` operations, `node --test` | ✓ (implied by the whole existing `anno-*.test.ts` suite passing per STATE.md's own recent green-run records) | Node ≥ 24 per project `engines` | — |
| VICE (`x64sc`), stock or fork | D-13's six execution runs, via Phase 33's reproducible-run protocol | Not probed this session (measurement discipline forbids launching VICE/the broker during research) | — | Phase 33's own protocol and the project's standing "detect, then refuse by name" convention already cover this; no new fallback needed for this phase specifically |
| dxa (vendored binary) | D-12's derive-first step | Vendored and pinned per project convention (`src/mcp/vice/vendor/dxa/`); not independently re-verified this session since no fixture was actually re-derived | — |
| Ghidra `analyzeHeadless` | D-12's derive-first step, `charset-phantom.prg`'s register-derived range | Per project memory, installed at a non-standard path (`/home/henrik/dev/_ghidra-probe/`); not independently re-probed this session | — |

**Missing dependencies with no fallback:** none identified — this phase's dependencies are the same ones the existing dxa/Ghidra/VICE pipeline already requires and already has detection/refusal conventions for.

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json:58`'s `node --test '*.test.*'` script |
| Quick run command | `node --test src/mcp/vice/anno-cli.test.ts src/mcp/vice/anno-verb-coverage.test.ts` (scoped to the touched files, per the project's own documented practice of never trusting the whole-glob `npm test` for a single plan's evidence) |
| Full suite command | `npm test` in `src/mcp/vice` — **known to hang / have a pre-existing failure floor** per project memory (`full-glob-suite-outlives-bash-timeout.md`, `test-automated-hides-ci-failures.md`); do not use this as the plan's own pass/fail signal, measure the floor instead |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECOMP-01 | Completeness report renders zero `Undefined`; refuses without the disagreement input; soundness asymmetry respected | unit + planted-control | `node --test src/skills/routine-queue-walker/scripts/completeness-report.test.mjs` | ❌ Wave 0 — new file, new test |
| DECOMP-02 | No `p_XXXX`/`l_XXXX`(-equivalent) survivor; every code entry point has function/inputs/outputs/side-effects comment | unit (survivor regex) + per-fixture manual/agent review | same new test file, plus a per-fixture checklist (comment content is not mechanically checkable beyond presence/non-emptiness) | ❌ Wave 0 |
| DECOMP-03 | Every non-hardware address named or explicitly declined | unit (decline-comment presence at known ambiguous addresses, e.g. `bank-path-dependent.prg`'s `probe`) | new test file | ❌ Wave 0 |
| DECOMP-04 | `$D011`/`$D018` render as named, OR-ed, decomposed constants; reassembles byte-identically | integration, real-ACME (existing oracle pattern in `anno-export-asm.test.ts`) | `node --test src/mcp/vice/anno-export-asm.test.ts` (extended) | ✅ file exists, extend it |
| D-07 (verb-count guard) | `REAL_VERBS`/`ANNO_CLI_VERB_FLOOR` raised together | unit | `node --test src/mcp/vice/anno-verb-coverage.test.ts` | ✅ file exists, edit it |
| D-02 (round trip) | Export then import reproduces the store exactly | unit, round-trip | new `anno-store-export.test.ts` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** the scoped `node --test` command for the file(s) touched by that task.
- **Per wave merge:** `node --test src/mcp/vice/anno-*.test.ts src/mcp/vice/evid-*.test.ts src/skills/routine-queue-walker/scripts/*.test.mjs`.
- **Phase gate:** full suite green (against the project's own known pre-existing failure floor, not a fresh zero) before `/gsd-verify-work`, per this project's own standing measurement discipline.

### Wave 0 Gaps

- [ ] `src/skills/routine-queue-walker/scripts/` — directory does not exist, must be created
- [ ] `completeness-report.mjs` + `completeness-report.test.mjs` — the D-04 script and its test, net new
- [ ] `anno-store-export.ts` + `anno-store-export.test.ts` — the D-02 general JSON export/import module and its round-trip test
- [ ] A first empirical measurement: derive ONE fixture (recommend `dxa/tracer.prg`, the smallest) through the existing dxa+Ghidra route into a fresh per-fixture `.annostore`, then call `anno_get_symbols` and inspect the actual label population before finalizing the survivor regex (§2, Assumption A1)

## Security Domain

`security_enforcement` is enabled in `.planning/config.json`, so this section is included per protocol, but this phase's actual attack surface is minimal and mostly inherited unchanged from existing, already-hardened code:

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | No end-user auth surface is touched; this is a local CLI/skill-script operating on local files |
| V3 Session Management | No | N/A — no session concept in scope |
| V4 Access Control | No | N/A — single-operator local tooling |
| V5 Input Validation | Partial | The new fifth CLI verb's argument parsing should follow the existing `parseEvidDisagreementsArgs()`-shaped pattern (unknown-option refusal, missing-value refusal) rather than a bespoke parser — already the project's established convention (`anno-cli.ts`'s WR-08 posture, cited above) |
| V6 Cryptography | No | N/A — no cryptographic material in scope |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Path traversal via a caller-supplied `--store`/export-path argument | Tampering | Route every new caller-supplied path through the existing `storePathWithinWorkspace()` seam (already used by every other verb — `anno-cli.ts`'s own header states "never grow a second path validator") |
| A malformed/adversarial exported JSON document being re-imported and corrupting the store | Tampering | The new D-02 importer should follow `anno-import.ts`'s own "never write a row before the whole document has parsed successfully" discipline (build a full write list before the first mutating call) |

## Sources

### Primary (HIGH confidence — read in full or measured directly this session)
- `src/mcp/vice/evid-reconcile.ts` (full file, 316 lines)
- `src/mcp/vice/anno-cli.ts` (targeted sections: header, `printEvidDisagreementsReport`, `cmdEvidDisagreements`, dispatch switch)
- `src/mcp/vice/anno-verb-coverage.test.ts` (header + `REAL_VERBS`/`ANNO_CLI_VERB_FLOOR` sections)
- `src/mcp/vice/anno-coverage.ts` (header, trap 1, `AUTO_NAME_PREFIX_RE` definition)
- `src/mcp/vice/anno-types.ts` (`DATA_TYPES`/`SPLIT_DATA_TYPES` definitions) and `anno-types.test.ts` (hand-written twelve)
- `src/mcp/vice/anno-import.ts` (header + import discipline)
- `src/mcp/vice/anno-join.ts` (`JoinDecision`, `runMemmapJoin` full decline logic)
- `src/mcp/vice/anno-bank.ts` (header, decline-with-reason discipline statement)
- `src/mcp/vice/anno-enum-gen.ts` (header, surviving function signatures)
- `src/mcp/vice/anno-export-asm.ts` (`AUTO_NAME_PREFIX_RE` import rationale; grep confirming no existing OR-expression emission)
- `src/mcp/vice/anno-regbits.json` ($D011/$D018 entries, parsed with Python)
- `src/mcp/vice/anno-tools.ts` (full `anno_*` tool name census; `anno_evid_disagreements` schema)
- `src/mcp/vice/block-class.ts` (header)
- `src/mcp/vice/dxa-listing.test.ts` (`lNNNN` label shape, MEASURED)
- `src/mcp/vice/fixtures/ghidra/charset-phantom-minted-labels.json` (`FUN_XXXX` label shape, MEASURED)
- `src/mcp/vice/fixtures/ghidra/charset-phantom.a` (full source, JSR-chain traced by hand)
- `src/mcp/vice/fixtures/{ghidra,dxa,petcat,export-asm}/README.md` (full provenance, all four files)
- `src/skills/routine-queue-walker/SKILL.md` (full file, 273 lines)
- `.planning/codebase/ARCHITECTURE.md` (checked for the cited section — absent, confirmed stale)
- `.planning/CONTEXT.md`, `.planning/REQUIREMENTS.md`, `.planning/STATE.md` (tail)
- Live ACME 0.97 invocation, this session, proving D-17's OR-ed-constant claim (see Code Examples)
- `find`/`ls`/`grep` confirming zero committed `.annostore` files anywhere in the repository

### Secondary (MEDIUM confidence)
- `.planning/PROJECT.md` (ANNO-13/14/15 withdrawal notice text, quoted verbatim)
- `.github/workflows/ci.yml` (grep for fixture-regeneration CI steps — absence noted, not exhaustively audited line-by-line)

### Tertiary (LOW confidence / ASSUMED)
- The specific survivor-regex union recommended in §2 (Assumption A1) — synthesis, not yet validated against a real derived store
- The decline-as-comment persistence design in §3 (Assumption A2) — a recommendation grounded in an existing API, not an already-shipped mechanism
- VICE/dxa/Ghidra tool availability on the actual execution host — not re-probed this session per the measurement discipline's prohibition on launching VICE

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — no new dependency, every reused module read and cited with line numbers
- Architecture: HIGH — all integration points read in full this session with file:line citations
- Pitfalls: HIGH for the code-verifiable ones (charset-phantom execution, ephemeral decline, verb-count guard, .prg-route address shift); MEDIUM for the ones requiring a not-yet-existing derived store to fully confirm (auto-name survivor population)

**Research date:** 2026-09-10
**Valid until:** 30 days (stable, no external API surface; the one time-sensitive fact — zero committed `.annostore` files — will change the moment this phase's own Wave 0 runs, which is expected and by design)
