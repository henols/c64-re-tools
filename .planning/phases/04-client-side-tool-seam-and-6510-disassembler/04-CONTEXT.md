# Phase 4: Client-Side Tool Seam and 6510 Disassembler - Context

**Gathered:** 2026-08-17
**Status:** Ready for planning

<domain>
## Phase Boundary

Two deliverables, one dependency between them.

1. **The derived-tool seam (DERIV-07)** — a home for tools that compute their
   answer client-side, guaranteed to run before `rewriteArguments()` and
   therefore never handed a host-translated path.
2. **The 6510 disassembler (DISASM-01..07)** — a pure library (opcode table →
   decoder → renderer) with no protocol import, plus `vice_disassemble` on the
   stock backend as its first consumer through the new seam.

**In scope:** DERIV-07, DISASM-01..07.

**Not in this phase:** memory search/compare/fill, checkpoint groups, the symbol
*store* (DERIV-04), sprites, chip-state decode, backtrace, screenshots, and
`gatherWedgeEvidence()`'s host-translation fix (Phase 5); CPU-history decode
(Phase 6, which imports this phase's decoder); cycle timing, `run_until`, disk
detach (Phase 7); the per-backend capability matrix and BACK-05's error text
(Phase 8).

**Phase 4 starting state (Phase 3's end state):** `tools-manifest.stock.json`
advertises **25** tools, all 1:1 opcode wrappers. `STOCK_DISPATCH_TABLE` holds
25 entries, every one registered through `withStockSession()`. There is no
derived tool, no disassembler, no opcode table, and no third-party notices file
anywhere in the repo.

**Two scouting findings that reshape the phase:**

- **The interception point DERIV-07 asks for largely already exists.**
  `buildBackendAwareTool()` (`vice-proxy.ts:3165`) routes every stock tool to
  `dispatchStock` — before `forwardToVice()`, therefore before
  `rewriteArguments()`. `withStockSession()` (`stock-dispatch.ts:426`) already
  hands a handler a live multi-call session. Phase 4's DERIV-07 work is
  therefore **not** "build a seam from nothing"; it is D-01 below.
- **ACME is absent from CI and from the development host.** No `acme` or
  `toacme` binary is installed, and `.github/workflows/ci.yml` has no ACME step
  in any of its four `ubuntu-latest` jobs. Success criterion 4's wording
  ("exclusions are enumerated and asserted **rather than skipped**") makes this
  a blocking decision, answered by D-08.

</domain>

<decisions>
## Implementation Decisions

### The derived-tool seam (DERIV-07)

- **D-01: Build a derived-tool layer above `stock-dispatch.ts`, not a test that
  pins the existing one.** A `withDerivedTool()` adapter in a **sibling module**
  (never appended to `vice-proxy.ts`) sitting alongside `withStockSession()`,
  owning the one thing stock-dispatch does not: the **container-path
  discipline**. Derived tools resolve any output path through one helper that is
  structurally asserted never to reach `hostpath.ts` — the exact mirror image of
  D-17 of Phase 3, which declared per-tool translation for *emulator-side* paths.
  Building it in the phase with the first and largest consumer avoids both a seam
  with no user and a seam retrofitted under three consumers at once.
  - Rejected: pinning the existing seam with a test plus documentation. Honest to
    what exists and satisfies the letter of DERIV-07, but leaves Phase 5 to
    invent the path discipline under screenshots, sprites and
    `gatherWedgeEvidence()` simultaneously.
  - Rejected: a backend-neutral derived layer usable from the fork path. BACK-02
    forbids changing the fork's advertised list and the fork implements every
    derived tool in-emulator, so it would ship with no fork consumer.

- **D-02: Two enforcement mechanisms, because one structural test is not
  enough.** Criterion 1's behavioural test is necessary but not sufficient:
  1. **Simulated-container behavioural test** — run with `HOST_WORKSPACE_PATH`
     set so translation would *visibly* rewrite the path, and assert the derived
     handler receives the container path. This is criterion 1 verbatim.
  2. **Asserted absence from `hostpath.ts`'s closed consumer set** — the repo
     already maintains a tested closed consumer list for host-path logic; the
     derived module is added to it as an asserted *absence*, so a future derived
     tool that reaches `hostpath.ts` fails a test rather than shipping.
  - **Precedent, and why (1) alone was rejected:** CR-07 (code review
    2026-08-13). A structural test that checked "no code line pairs the string
    `stock` with `forwardToVice`" passed while a real D-09 violation stood —
    three synthetic tools reached the fork's HTTP transport on the stock backend.
    A test that only covers the tools existing when it is written does not
    survive Phase 5 adding three more and Phase 6 adding composites.
  - Rejected: a branded `ContainerPath` type. Strongest compile-time guarantee,
    but type-stripping erases it at runtime, it widens `hostpath.ts`'s
    signatures, and `tsc --noEmit` would be the only thing that ever checks it.

- **D-03: One dispatch table, one adapter, a data-only derived registry.**
  Derived tools register into the **same** `STOCK_DISPATCH_TABLE`, through
  `withDerivedTool()` instead of `withStockSession()`. Derived-ness is a property
  of the adapter, never a routing decision. If Phase 8's capability matrix needs
  to know which tools are derived, it reads a plain name list that is **data and
  never a dispatch path**.
  - Rejected: a separate `DERIVED_DISPATCH_TABLE` consulted before the main one.
    It is a second dispatch site with a fall-through between them — precisely
    what D-09 of Phase 2 and the CR-07 post-mortem forbid.

- **D-04: `withDerivedTool()` takes a per-tool session flag; a session is not
  mandatory.** Session-requiring derived tools (`vice_disassemble`, Phase 5's
  screenshots) get one exactly as today. A derived tool that computes purely from
  its arguments opens no connection.
  - Rationale: D-05 of Phase 3 makes every touch of the wire a machine halt.
    Mandating a session would make an emulator-free tool stop the user's running
    program for nothing.
  - Rejected: session always required (uniform, one code path, but bakes an
    unnecessary user-visible halt into any future wire-free derived tool).

### The disassembler library

- **D-05: A standalone pure module — table → decoder → renderer — with no
  protocol import.** The MCP tool is one consumer, not the home. Phase 5's
  backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01) import the
  **decoder**, not the renderer or the tool.
  - Rejected: building the decoder inside the derived-tool module and exposing it
    only through `vice_disassemble` — Phase 5 and Phase 6 would each reach into a
    tool module or re-derive the table.
  - **Deferred, not done here:** repointing `acme-build`'s `disasm` command at
    this library. See Deferred Ideas.

- **D-06: The opcode table is a committed TypeScript literal, pinned by a
  bit-pattern derivation test.** Transcribe cc65's `opc6502x.c` (zlib) into a
  plain TS table, then add a test that derives addressing mode and instruction
  length from the 6502's own `aaabbbcc` opcode bit structure across all 256
  entries, with the genuine irregulars listed explicitly. This catches
  transcription typos exactly where a hand-written table is weakest, and covers
  the opcodes D-08's round-trip cannot reach — with no new files, no build step
  and no external tool.
  - Cross-check sources per the roadmap: `fluffy-6502` (MIT) and ACME's
    illegal-opcode matrix. Mnemonics re-spelled to ACME's `!cpu 6510` set.
    **Nothing is sourced from VICE** — VICE is GPL-2 and this repo is MIT.
  - Rejected: vendoring `opc6502x.c` and generating with a committed script (adds
    a C file nothing compiles; proves faithfulness to one source, not
    correctness).
  - Rejected: generating by probing ACME at build time (puts ACME on the build's
    critical path, and ACME cannot express the opcodes that most need covering).

- **D-07: `THIRD-PARTY-NOTICES.md` at the repo root, gated by the packaging
  check.** Create the file with the zlib licence text and a provenance line per
  source; attribute in the opcode table module's own header comment; extend
  `scripts/check-npm-packages.mjs` — which already asserts an exact file list per
  tarball — so `@henols/vice-mcp` **fails to publish** without it. Criterion 5's
  no-GPL claim becomes a stated, reviewable provenance line per source rather
  than an assertion in a doc.
  - The file does not exist today; no `NOTICE`/`THIRD-PARTY` file is anywhere in
    the repo (only `LICENSE`).
  - Rejected: an automated GPL-absence marker scan on top. Marker-matching is
    exactly the shape of structural test CR-07 showed can pass while the real
    violation stands.
  - Rejected: source headers plus a `LICENSE` section only — nothing for the
    packaging check to gate on, and criterion 5 names third-party notices
    specifically.

### Rendering: the round-trip and the opcodes ACME cannot express

- **D-08: Install ACME in CI. The round-trip is a real gate, not a manual
  suite.** Add an apt step to the CI test job, with a **named** env-gated skip
  locally when `acme` is absent — the same shape as `stock-live.test.ts`'s
  `VICE_LIVE_STOCK_BIN`. Costs one apt line and pins output against the actual
  assembler, which is the only thing that can prove reassembly. It also unblocks
  D-05's deferred `acme-build` swap later.
  - **Ground truth:** ACME is installed neither on the development host nor in
    CI. `.github/workflows/ci.yml` has four `ubuntu-latest` + Node 22 jobs and no
    ACME step.
  - Rejected: a self-contained table-driven re-encoder oracle instead. Hermetic
    and always runs, but built from the same table it checks — it proves
    render/parse symmetry, not that ACME accepts the output, and DISASM-03 says
    "reassembles through ACME".
  - Rejected: joining `test-gate.mjs`'s `MANUAL_ONLY_TESTS` beside
    `stock-live.test.ts`. Honest about the dependency, but the phase's headline
    correctness check would never run in CI, and criterion 4's "rather than
    skipped" reads as a warning against exactly this.

- **D-09: Every opcode ACME's `!cpu 6510` cannot express renders as `!byte`,
  with the decoded mnemonic in a trailing comment.** All bytes of the instruction
  are emitted so the following instruction still lands at the correct address; a
  human loses nothing because the mnemonic and operand are in the comment.
  - **The round-trip then has zero exclusions and is byte-exact by
    construction.** Criterion 3's "enumerated and asserted" becomes a
    **substitution table** in which a test asserts ACME *genuinely rejects* each
    entry — so the table cannot silently over-substitute as ACME gains mnemonics.
  - **Known scope of the substitution set.** `acme-build/SKILL.md` records 18
    verified `!cpu 6510` illegal mnemonics: `lax dcp sax slo rla sre rra isc anc
    alr arr sbx las tas sha shx shy jam`. Not in that list, and therefore
    substitution candidates pending the assertion test: `ANE`/`XAA` (`$8B`),
    `LXA` (`$AB`), the duplicate `SBC #` (`$EB`), and **every multi-byte NOP
    variant** — the twelve criterion 2 singles out as desynchronising everything
    after them when their operand length is wrong. The exact set is determined by
    the assertion test against the installed ACME, not by this list.
  - Rejected: emitting the mnemonic and asserting the exclusions. Most readable,
    the most literal reading of "documented exclusions" — but the phase would
    ship output that provably does not reassemble, which is what criterion 4
    exists to prevent.
  - Rejected: splitting by class (NOPs and JAMs as `!byte`, `ANE`/`LXA`/`$EB` as
    excluded mnemonics). Leaves a short exclusion list, so the round-trip is
    still not byte-exact, and the rule takes two sentences to state.

- **D-10: One structured `notes` list per decoded instruction, rendered as
  trailing `;` comments.** The decoder attaches notes — `nmos-page-wrap`,
  `acme-unassemblable`, `truncated`, and the resolved branch target — and the
  renderer emits each as a trailing comment. One mechanism carries criterion 3's
  page-wrap warning on `JMP ($xxFF)`, criterion 3's truncation reporting
  (DISASM-05), and D-09's substitution explanation; the structured answer stays
  machine-readable for Phase 5's backtrace; and comments cannot affect the
  round-trip.
  - Rejected: text comments only (an agent would have to parse prose to learn an
    instruction is truncated, and Phase 5's backtrace consumes the decoder).
  - Rejected: a structured field only, listing kept as pure source (the listing
    is what a human reads, and criterion 3 asks for the warning to be explicit).

- **D-11: The renderer's invariant is that the rendered operand's width equals
  the decoded instruction's width — forced explicitly where it could shrink.**
  An absolute or absolute-indexed operand below `$0100` (`lda $0080`) can be
  re-encoded by the assembler to zero page, turning 3 bytes into 2 and breaking
  the round-trip **whether or not a symbol is involved**. Render those with
  ACME's forced-16-bit form.
  - **DISASM-06 falls out of the same rule.** A symbol substitutes **only** where
    the forced width already pins the encoding — never in an immediate operand
    (the `#<` / `#>` ambiguity), never where the assembler could still pick a
    shorter mode. One invariant covers criterion 3, criterion 4 and DISASM-06
    together.
  - Rejected: substituting only above `$0100` and excluding literal sub-`$0100`
    absolutes. Reintroduces the exclusions D-09 just eliminated, and makes them
    data-dependent rather than a fixed opcode list.
  - Rejected: branch targets only. Trivially safe, but makes `show_symbols`
    nearly useless on the operands a reverse engineer cares about (`$d020`,
    `$ffd2`), and the sub-`$0100` width problem still needs solving separately.

### `vice_disassemble` on the stock backend

- **D-12: Fork arguments stay required; `end` is added as an optional stock
  extra.** `address`, `count` (instructions, default 10, max 100) and
  `show_symbols` keep the fork's names, types and defaults so existing skill
  calls work unchanged (D-03 of Phase 3). An optional `end` lets a caller ask for
  a range directly — what DISASM-01 names, and what the roadmap's "over-read by
  two bytes, drop instructions starting past the requested end" rule is written
  for. **Supplying both `end` and `count` is refused**, never silently resolved
  in favour of one.
  - Rejected: fork arguments only, range derived from `count` (a caller who knows
    the end address has to guess an instruction count, and the truncation rule
    would only ever fire at a memspace boundary).
  - Rejected: range-first with `count` optional — changes which argument is
    required relative to the fork, which D-03 of Phase 3 rules out.

- **D-13: The answer carries structured instructions *and* a rendered listing,
  both under one `outputSchema`.** An `instructions` array (address, bytes,
  mnemonic, operand, resolved target, `notes` per D-10) plus a `listing` string
  of the ACME-ready text. The agent gets machine-readable fields without parsing
  prose; the human gets something pasteable into a `.a` file; and **D-08's
  round-trip test has an exact string from the tool's own output to feed ACME**,
  so the thing proven to reassemble is what the tool actually returns.
  - Answer size is bounded by `count`'s existing max of 100.
  - Rejected: structured records only (every consumer reimplements the renderer,
    and the round-trip would test the library rather than the tool's output).
  - Rejected: rendered listing only, closest to the fork (D-02 of Phase 3 exists
    so answers are machine-checkable, and an agent wanting the instruction at a
    given address would have to parse the listing back).

- **D-14: DISASM-06 ships its mechanism now, wired to the resolver hook D-04 of
  Phase 3 already built.** `show_symbols` calls through
  `stock-address.ts`'s `setSymbolResolver()` extension point, which is still
  `null`. The width rule (D-11) is proven in tests with an **injected fake
  resolver**. With no store installed, `show_symbols` is a no-op that **says so**
  rather than an error — matching `parseAddress()`'s existing "no symbol table is
  loaded" behaviour. Phase 5 installs the real store (DERIV-04) and nothing about
  the disassembler changes.
  - Rejected: a pure function not wired to the tool (leaves the tool advertising
    an argument it does not honour, and hands Phase 5 an integration Phase 4 was
    supposed to close).
  - Rejected: moving DISASM-06 to Phase 5 by roadmap edit. The rule is about the
    disassembler's encoding safety, not about where symbols come from — and the
    renderer needs the invariant regardless.

### Carried forward from earlier phases — not re-decided here

- **D-01 of Phase 3:** stock answers are stock-native; every divergence from the
  fork is recorded in `docs/stock-vice-parity.md`. **This phase adds to it:**
  D-09's `!byte` substitutions, D-13's answer shape, and D-12's optional `end`.
- **D-02 of Phase 3:** `outputSchema` on every stock manifest entry, checked by
  the per-handler answer-conformance harness.
- **D-03 of Phase 3:** required argument names and types match the fork's;
  stock-only **optional** arguments with safe defaults are permitted (D-12's
  `end`).
- **D-04 of Phase 3:** one `parseAddress()` with the pluggable symbol hook —
  D-14 is its first real consumer.
- **D-05/D-06 of Phase 3:** disassembling reads memory, so it halts the machine
  and never issues an unrequested resume; `runState` appears on the answer.
- **D-09 of Phase 2:** one dispatch table, no fall-through, no second dispatch
  site — D-03 above is written to preserve it.
- **ROADMAP Standing Constraints:** client-side derivations go in sibling
  modules, never appended to `vice-proxy.ts` (172 KB); the fork backend's
  advertised list is unchanged from v0.1.x.
- **PROJECT.md Out of Scope:** byte-identical output parity with the fork is
  explicitly **not** an acceptance bar. `docs/stock-vice-parity.md` §A.7 already
  licenses disassembly formatting and illegal-opcode rendering divergence.

### Claude's Discretion

- **Module naming and file split** for the derived layer and the disassembler,
  subject to the sibling-module rule and the existing `stock-*.ts` naming
  convention.
- **`gatherWedgeEvidence()` is named now as the derived-path helper's second
  consumer, but not repointed here.** Phase 5 criterion 5 owns the fix. It is
  currently unreachable on stock anyway — `handleRecycle()` is backend-aware and
  refused by name (CR-07) — and `vice_display_screenshot` does not exist on stock
  until Phase 5, so there is nothing to repoint it to. The helper's header should
  name it so Phase 5's edit is a one-liner.
- **The exact `!byte` comment format** and label emission for branch/jump
  targets, subject to D-10's notes mechanism and D-11's width invariant.
- **Whether the renderer is pluggable** for Phase 6's CPU-history output format,
  or Phase 6 composes the decoder with its own renderer.
- **The precise membership of D-09's substitution table** — determined by the
  assertion test against the ACME build installed by D-08, not by the list in
  D-09's prose.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Protocol and parity (normative)
- `docs/phase0-binmon-findings.md` — the normative protocol document (normative
  by ingest resolution W2), corrected in Phase 1. §5 carries the confirmed opcode
  set and error codes. §4 documents `monitor_startup_trap()` firing on any
  inbound byte — the fact D-05 of Phase 3 rests on, and why disassembling halts
  the machine.
- `docs/stock-vice-parity.md` — per-capability parity. Line 58 already records
  `vice_disassemble` as "ship a client 6502 disassembler; formatting/illegal
  opcodes diverge"; §A.7 licenses the divergence. **This phase adds to it:**
  D-09's `!byte` substitution set, D-13's answer shape, D-12's optional `end`.
- `docs/phase1-probe-results.md` — what a real build actually did. Relevant here
  only for the version quads and the observed event sequence.
- `docs/roadmap-stock-vice.md` — the ADR (status: proposed).

### Prior-phase decisions this phase builds on
- `.planning/phases/03-direct-tools/03-CONTEXT.md` — **read in full.** D-01
  (stock-native answers), D-02 (`outputSchema`), D-03 (fork-compatible inputs +
  optional extras), D-04 (`parseAddress()` and the symbol hook D-14 consumes),
  D-05/D-06 (halt policy and `runState`), D-17 (the emulator-side path
  translation table that D-01 here mirrors in the opposite direction).
- `.planning/phases/02-stock-backend-connection/02-CONTEXT.md` — D-07 (trimmed
  per-backend manifest), **D-09 (one dispatch table, no fall-through — D-03 here
  is written to preserve it)**.
- `.planning/ROADMAP.md` "Standing Constraints" and the Phase 4 Notes — the
  sibling-module rule, the `rewriteArguments()` hazard at `vice-proxy.ts:2773`,
  the over-read-by-two-bytes rule, and the cc65/fluffy-6502/ACME sourcing with
  the VICE GPL exclusion.
- `.planning/notes/stock-vice-migration-revised-loss-ledger.md` — the corrected
  loss ledger.
- `.planning/intel/constraints.md` — the CON-* blocks.
- `.planning/INGEST-CONFLICTS.md` — the W1/W2 resolutions.

### Code this phase touches or extends
- `.claude/mcp/vice/stock-dispatch.ts` — `STOCK_DISPATCH_TABLE` (25 entries),
  `withStockSession()` at line 426, `StockDispatchDeps`, `ensureStockSession()`.
  D-03 registers the derived tool here through the new adapter; never a second
  table, never a fall-through.
- `.claude/mcp/vice/stock-handler.ts` — `StockToolResult` / `StockOkResult` /
  `StockSessionHandler` / `convertHandshakeError()` / `convertWireError()` /
  `stockAnswer()`. The derived adapter reuses this contract; do not write a
  second error converter.
- `.claude/mcp/vice/stock-address.ts` — `setSymbolResolver()` at line 41, still
  `null`, with the "no symbol table is loaded" refusal text D-14 matches.
- `.claude/mcp/vice/vice-proxy.ts` — `buildBackendAwareTool()` at line 3165 (the
  ONE backend-aware registration seam, and the reason DERIV-07's interception
  point already largely exists); `rewriteArguments()` at line 1845, called inside
  `forwardToVice()` at line 2888; `gatherWedgeEvidence()` at line 1343, whose own
  `rewriteArguments()` call at line 1367 is Phase 5's fix. **Nothing is appended
  to this file.**
- `.claude/mcp/vice/hostpath.ts` / `containerpath.ts` — the tested closed
  consumer set. D-02 adds the derived module to it as an asserted **absence**.
- `.claude/mcp/vice/tools-manifest.stock.json` — 25 entries today;
  `vice_disassemble` is added with its `outputSchema` per D-13.
- `.claude/mcp/vice/tools-manifest.json` — the fork manifest.
  `vice_disassemble`'s fork entry is at line 786 (`address`, `count` max 100,
  `show_symbols`) — the argument shape D-12 preserves. **Not edited.**
- `.claude/mcp/vice/stock-schema-check.ts` — the dependency-free `outputSchema`
  checker the new answer must validate against.
- `.claude/mcp/vice/test-gate.mjs` — `MANUAL_ONLY_TESTS`, frozen at four
  entries. D-08 deliberately does **not** add to it.
- `.github/workflows/ci.yml` — four `ubuntu-latest` + Node 22 jobs, no ACME
  step. D-08 adds one.
- `scripts/check-npm-packages.mjs` — validates exact tarball file lists via
  `npm pack --dry-run --json`. D-07 extends it to require the notices file.
- `.claude/skills/acme-build/SKILL.md` §Disassembly and
  `.claude/skills/acme-build/scripts/acme.mjs:209` (`cmdDisasm`, a `toacme`
  shell-out) — the deferred consumer, and the source of D-09's verified 18-
  mnemonic `!cpu 6510` list.

### Codebase maps
- `.planning/codebase/ARCHITECTURE.md` — layers, seams, and the two named
  anti-patterns (re-deriving a cross-cutting seam locally; preemptive
  kill/relaunch).
- `.planning/codebase/TESTING.md` — the automated gate is
  `npm run test:automated` (`test-gate.mjs`), which excludes the four
  manual-only suites.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`withStockSession()` + `STOCK_DISPATCH_TABLE` + `dispatchStock()`**
  (`stock-dispatch.ts`) — the adapter D-01's `withDerivedTool()` is modelled on
  and registers beside. `withStockSession()` already gives a handler a live
  multi-call session, so the derived layer inherits session handling rather than
  reinventing it.
- **`convertHandshakeError()` / `convertWireError()` / `isErrorText()` /
  `stockAnswer()`** (`stock-handler.ts`) — the established refusal and answer
  shape. Reuse; do not write a second converter.
- **`setSymbolResolver()` / `parseAddress()`** (`stock-address.ts`) — D-04 of
  Phase 3 built the hook explicitly so "Phase 5's symbol store can fill it later
  without every call site changing". D-14 is its first consumer, one phase early.
- **`stock-schema-check.ts`** — the dependency-free `outputSchema` checker and
  the per-handler answer-conformance harness Phase 3 built; D-13's answer plugs
  straight in.
- **`hostpath.ts` / `containerpath.ts`'s tested closed consumer set** — the
  existing mechanism D-02's asserted-absence check extends.
- **`scripts/check-npm-packages.mjs`** — already asserts an exact file list per
  tarball; D-07 needs one more required entry, not a new mechanism.
- **`stock-live.test.ts` + `test-gate.mjs`'s env-gated skip pattern** — the
  named-reason skip shape D-08 reuses for a local ACME absence.

### Established Patterns
- **Single seam per concern.** One dispatch table, one transport, one repo-root
  resolver, one deny-list. D-01's path helper and D-03's single table both follow
  it; re-deriving either locally is this codebase's own named anti-pattern.
- **Structural tests can pass while the violation stands.** CR-07 is the named
  precedent and the reason D-02 requires two mechanisms rather than one.
- **A green suite written by the same pass that wrote the code proves less than
  it looks like it does.** Phase 2's post-mortem, re-confirmed by Phase 3's
  `sizeBits` blocker where the fixtures stubbed the same wrong assumption the
  code made. D-06's bit-pattern derivation test and D-08's real-ACME round-trip
  are both chosen to be *independent* of the table they check.
- **Generated-but-committed artifacts.** `.mts` → `resources/*.mjs` via
  `build.ts`; `resources-sync.test.ts` fails CI on drift. Phase 4 touches no
  `.mts`, so no rebuild is implied.
- **No build step for the shipped server.** Container-side `.ts` runs under
  Node's native type-stripping — which is why D-02 rejects a branded type as the
  sole guarantee.
- **Never-throw boundary.** No handler may let an exception escape; the derived
  adapter inherits `dispatchStock()`'s conversion.
- **Runtime narrowing at every JSON boundary** via `isPlainObject()`, not casts.
- **Long structured header comments** stating why a file exists and what NOT to
  do, naming the specific past mistake. New modules match this density.

### Integration Points
- `STOCK_DISPATCH_TABLE` — where `vice_disassemble` registers, through the new
  adapter (D-03).
- `tools-manifest.stock.json` — where its `inputSchema` (D-12) and
  `outputSchema` (D-13) are declared.
- `stock-address.ts`'s resolver hook — where D-14's symbol substitution reads
  from, and where Phase 5's store will install.
- `hostpath.ts`'s closed consumer set — where D-02's asserted absence lands.
- `.github/workflows/ci.yml` — where D-08's ACME install step goes.
- `scripts/check-npm-packages.mjs` + `.claude/mcp/vice/package.json`'s `files`
  list — where D-07's notices file is gated and shipped.
- The disassembler's exported **decoder** — the import surface Phase 5's
  backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01) consume.

</code_context>

<specifics>
## Specific Ideas

- The user consistently chose the option that **eliminates a category of failure
  rather than documenting it**: `!byte` substitution over an exclusion list
  (D-09), forced operand width over a data-dependent exclusion (D-11), a real CI
  gate over a manual suite (D-08), a packaging check over a prose claim (D-07).
  Where a later choice trades output prettiness against a provable invariant,
  prefer the invariant.
- The user twice chose **two independent verification mechanisms over one**
  (D-02's behavioural test plus asserted absence; D-06's bit-pattern test
  alongside D-08's round-trip). The pattern reflects CR-07 and Phase 3's
  `sizeBits` blocker — a check derived from the same assumption as the code
  proves nothing. Downstream planning should not collapse these back into one
  test on grounds of economy.
- The user declined to widen the phase into the `acme-build` skill even though
  the swap is clearly valuable — scope discipline over opportunistic cleanup.

</specifics>

<deferred>
## Deferred Ideas

- **Repoint `acme-build`'s `disasm` command at the new library**, replacing the
  external `toacme` shell-out (`acme.mjs:209`). Real value — it drops an
  external-binary dependency and fixes output the skill's own SKILL.md admits
  needs hand-fixing to reassemble (`!by$0b;ANC#`, mis-indented illegals). Held
  back because it changes a shipped skill's behaviour and output format inside a
  phase scoped to the stock backend. D-08's CI ACME install unblocks verifying
  it later. **Its own change, or a Phase 8 skill-revision companion.**
- **`gatherWedgeEvidence()`'s host-translation fix** — Phase 5 criterion 5. Named
  in D-01's helper header as the second consumer so Phase 5's edit is a
  one-liner; not repointed here (see Claude's Discretion for why it is currently
  a no-op on stock).
- **Whether the renderer becomes pluggable for Phase 6's CPU-history format** —
  decide when GAIN-01 is planned, not now.
- **A Phase 8 parity-harness entry for disassembly output** — the fork's
  in-emulator `vice_disassemble` and this library will differ in spelling,
  illegal-opcode rendering and D-09's `!byte` substitutions. §A.7 already
  licenses it; the harness needs the specific divergence list this phase
  produces.

### Reviewed Todos (not folded)

All five pending todos matched `todo.match-phase` at 0.6 on generic keywords
(`stock`, `phase`, `vice`, `test`, `source`) with no Phase 4 substance — the same
false-positive pattern Phase 3 recorded. None touches the derived seam or the
disassembler:

- **`2026-08-13-confirm-help-discriminator-against-real-vice-binaries.md`** —
  Phase 2 verification debt.
- **`2026-08-13-re-record-binmon-fixtures-against-real-stock-vice.md`** — Phase 2
  verification debt.
- **`2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`** — a CI-config
  question with release consequences. **Adjacent to D-08:** this phase adds an
  ACME install to CI and puts a new test behind the automated gate, so whoever
  plans D-08 should confirm the CI job actually runs the gate that contains the
  round-trip. Not folded — the reconciliation itself is still not Phase 4 work.
- **`2026-08-12-vice-broker-tests-stall-outside-devcontainer.md`** — already
  user-dispositioned as not-a-bug; relevant only as the definition of the
  automated gate.
- **`2026-08-14-probe-phase3-assumed-wire-details.md`** — Phase 3 probe debt on
  four `[ASSUMED]` wire details; none is used by the disassembler or the seam.

</deferred>

---

*Phase: 4-Client-Side Tool Seam and 6510 Disassembler*
*Context gathered: 2026-08-17*
