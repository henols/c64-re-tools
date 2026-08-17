# Phase 4: Client-Side Tool Seam and 6510 Disassembler - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-17
**Phase:** 4-Client-Side Tool Seam and 6510 Disassembler
**Areas discussed:** What DERIV-07 still builds, Disassembler layering + who consumes it, Unassemblable opcode rendering, vice_disassemble answer + args

---

## What DERIV-07 still builds

**Framing finding presented before questions:** `buildBackendAwareTool()`
(`vice-proxy.ts:3165`) already routes every stock tool to `dispatchStock` before
`forwardToVice()` — therefore before `rewriteArguments()` — and
`withStockSession()` (`stock-dispatch.ts:426`) already provides a live multi-call
session. DERIV-07's interception point largely exists.

### Q1 — What should Phase 4 actually build for DERIV-07?

| Option | Description | Selected |
|--------|-------------|----------|
| A derived-tool layer above stock-dispatch | `withDerivedTool()` beside `withStockSession()` in a sibling module, owning the container-path discipline (mirror of D-17); gives Phase 5/6 a home that already exists | ✓ |
| Pin the existing seam with a test + doc | Honest to what exists, satisfies DERIV-07's letter; leaves Phase 5 to invent the path discipline under three consumers at once | |
| Backend-neutral derived layer | Both backends could route through it; BACK-02 forbids fork surface change and the fork implements derived tools in-emulator, so it ships with no fork consumer | |

**User's choice:** A derived-tool layer above stock-dispatch → **D-01**

### Q2 — What enforces the container-path rule beyond criterion 1's test?

| Option | Description | Selected |
|--------|-------------|----------|
| Closed-consumer-set assertion + simulated-container test | Behavioural test with `HOST_WORKSPACE_PATH` set, plus an asserted absence from `hostpath.ts`'s tested closed consumer set; CR-07 is the precedent for why one structural test is not enough | ✓ |
| Behavioural test only | Real end-to-end proof, but only covers the tools existing when written | |
| Branded ContainerPath type | Strongest compile-time guarantee; erased by type-stripping, widens `hostpath.ts` signatures, only `tsc --noEmit` ever checks it | |

**User's choice:** Closed-consumer-set assertion + simulated-container test → **D-02**

### Q3 — How do derived tools register, given D-09's one-table rule?

| Option | Description | Selected |
|--------|-------------|----------|
| One table, new adapter, data-only registry | Derived-ness is a property of the adapter, never a routing decision; Phase 8 reads a plain name list that is data, not a dispatch path | ✓ |
| A separate DERIVED_DISPATCH_TABLE | Legible derived set and a structural source for Phase 8, but a second dispatch site with a fall-through — what D-09 and the CR-07 post-mortem forbid | |

**User's choice:** One table, new adapter, data-only registry → **D-03**

### Q4 — Must `withDerivedTool()` require a live session?

| Option | Description | Selected |
|--------|-------------|----------|
| Session optional, declared per tool | A wire-free derived tool never halts the machine; D-05 of Phase 3 makes every wire touch a halt | ✓ |
| Session always required | Uniform contract, one code path; bakes an unnecessary user-visible halt into any future wire-free derived tool | |

**User's choice:** Session optional, declared per tool → **D-04**

**Notes:** User declined further questions on the seam (gatherWedgeEvidence
naming, module naming, Phase 8 capability-matrix feed) — all recorded as Claude's
discretion in CONTEXT.md.

---

## Disassembler layering + who consumes it

**Framing finding presented before questions:** `acme-build/scripts/acme.mjs:209`
already ships a `disasm` command — but it is a shell-out to ACME's external
`toacme`, and the skill's own SKILL.md admits the output needs hand-fixing to
reassemble. It is a candidate consumer and a duplication hazard, not a reusable
table.

### Q1 — How far should the library reach beyond the MCP tool?

| Option | Description | Selected |
|--------|-------------|----------|
| Library + MCP tool now; acme-build swap noted, not done | Standalone pure module (table → decode → render), no protocol import; Phase 5 backtrace and Phase 6 CPU-history import the decoder | ✓ |
| Also replace acme-build's toacme shell-out | Drops an external binary and fixes admitted-broken output; changes a shipped skill inside a backend-scoped phase | |
| MCP tool only, no standalone library | Smallest surface; Phase 5 and Phase 6 would reach into a tool module or re-derive the table | |

**User's choice:** Library + MCP tool now; acme-build swap noted, not done → **D-05**, deferred item recorded

### Q2 — How is the table pinned where the round-trip cannot reach?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed TS table + bit-pattern derivation test | Transcribe cc65 `opc6502x.c`, then derive mode/length from the 6502 `aaabbbcc` bit structure across all 256 entries with irregulars listed; independent of the table it checks | ✓ |
| Vendor cc65's opc6502x.c + committed generator | Exact diff-auditable provenance; adds a C file nothing compiles, and proves faithfulness to one source rather than correctness | |
| Generate by probing ACME | Round-trip true by construction; puts ACME on the build's critical path and cannot cover the opcodes ACME rejects | |

**User's choice:** Committed TS table + bit-pattern derivation test → **D-06**

### Q3 — How is criterion 5's attribution / no-GPL made checkable?

| Option | Description | Selected |
|--------|-------------|----------|
| NOTICES file gated by the packaging check | `THIRD-PARTY-NOTICES.md` at root, source-header attribution, `check-npm-packages.mjs` extended so `@henols/vice-mcp` fails to publish without it | ✓ |
| Also add an automated GPL-absence check | Scans for VICE-derived markers; marker-matching is the shape of structural test CR-07 showed can pass while the violation stands | |
| Source headers and LICENSE section only | No new file, nothing for the packaging check to gate on; criterion 5 names third-party notices specifically | |

**User's choice:** NOTICES file gated by the packaging check → **D-07**

---

## Unassemblable opcode rendering

**Framing finding presented before questions:** ACME is installed neither on the
development host nor in CI — no `acme`/`toacme` binary, and no ACME step in any
of `ci.yml`'s four `ubuntu-latest` + Node 22 jobs. Criterion 4's "rather than
skipped" makes *how the round-trip runs* a decision before *what it excludes*.

### Q1 — How does DISASM-03's round-trip actually run?

| Option | Description | Selected |
|--------|-------------|----------|
| Install ACME in CI | apt step in the CI test job, named env-gated local skip in the `stock-live.test.ts` shape; a real gate on every push, and unblocks the deferred acme-build swap | ✓ |
| Self-contained re-encoder oracle instead | Hermetic and always runs; built from the same table it checks, so it proves render/parse symmetry, not that ACME accepts the output | |
| Join the manual-only gate | Consistent with the live-emulator suites; the phase's headline correctness check would never run in CI | |

**User's choice:** Install ACME in CI → **D-08**

### Q2 — How does the renderer emit opcodes `!cpu 6510` cannot express?

Presented with the verified 18-mnemonic list from `acme-build/SKILL.md`
(`lax dcp sax slo rla sre rra isc anc alr arr sbx las tas sha shx shy jam`),
which omits ANE/LXA, `$EB` SBC, and every multi-byte NOP.

| Option | Description | Selected |
|--------|-------------|----------|
| !byte for all of them, mnemonic in a trailing comment | All instruction bytes emitted so addresses stay correct; round-trip has zero exclusions and is byte-exact; a test asserts ACME genuinely rejects each substitution so the table cannot over-substitute | ✓ |
| Emit the mnemonic, assert the exclusions | Most readable and the most literal reading of "documented exclusions"; ships output that provably does not reassemble | |
| Split by class | NOPs/JAMs as `!byte`, ANE/LXA/`$EB` as excluded mnemonics; leaves a short exclusion list and takes two sentences to state | |

**User's choice:** !byte for all of them, mnemonic in a trailing comment → **D-09**

### Q3 — Where do the page-wrap warning, truncation and substitution notes live?

| Option | Description | Selected |
|--------|-------------|----------|
| One notes field per instruction, rendered as trailing comments | Decoder attaches structured notes, renderer emits them as `;` comments; one mechanism for criterion 3's page-wrap, DISASM-05's truncation and D-09's substitutions; comments cannot affect the round-trip | ✓ |
| Text comments only | Simplest renderer; an agent would parse prose to learn an instruction is truncated, and Phase 5's backtrace consumes the decoder | |
| Structured field only, listing stays pure source | Cleanest reassembly input; the listing is what a human reads and criterion 3 wants the warning explicit | |

**User's choice:** One notes field per instruction, rendered as trailing comments → **D-10**

---

## vice_disassemble answer + args

### Q1 — What arguments does stock accept?

| Option | Description | Selected |
|--------|-------------|----------|
| Fork args required, optional end added | `address` + `count` + `show_symbols` keep fork names/types/defaults (D-03 of Phase 3); optional `end` gives DISASM-01's range; both together is refused, never silently resolved | ✓ |
| Fork args only, range derived from count | Nothing new to document; a caller who knows the end address must guess a count, and truncation only fires at a memspace boundary | |
| Range-first, count optional | Cleanest match to DISASM-01's wording; changes which argument is required relative to the fork, which D-03 rules out | |

**User's choice:** Fork args required, optional end added → **D-12**

### Q2 — What does the answer carry?

| Option | Description | Selected |
|--------|-------------|----------|
| Structured instructions plus a rendered listing | One `instructions` array and one `listing` string under the same `outputSchema`; the round-trip test feeds ACME the tool's own output | ✓ |
| Structured records only | Smallest answer; every consumer reimplements the renderer and the round-trip would test the library, not the tool | |
| Rendered listing only | Closest to the fork; D-02 of Phase 3 exists so answers are machine-checkable | |

**User's choice:** Structured instructions plus a rendered listing → **D-13**

### Q3 — How is operand width pinned, and what does that mean for DISASM-06?

Raised as a finding: an abs operand below `$0100` (`lda $0080`) can be
re-encoded to zero page, shrinking 3 bytes to 2 and breaking the round-trip
whether or not a symbol is involved.

| Option | Description | Selected |
|--------|-------------|----------|
| Force explicit width, one rule for both | Rendered operand width equals decoded instruction width, forced where it could shrink; symbols substitute only where the forced width already pins the encoding — one invariant covers criteria 3, 4 and DISASM-06 | ✓ |
| Substitute only above $0100, exclude the rest | Less renderer machinery; reintroduces exclusions D-09 just eliminated, and makes them data-dependent | |
| Branch targets only | Trivially safe; makes `show_symbols` useless on `$d020`/`$ffd2`, and the width problem still needs solving separately | |

**User's choice:** Force explicit width, one rule for both → **D-11**

### Q4 — How does Phase 4 satisfy DISASM-06 with no symbol store until Phase 5?

| Option | Description | Selected |
|--------|-------------|----------|
| Ship the mechanism against the existing hook, test with an injected resolver | Wire `show_symbols` to `stock-address.ts`'s `setSymbolResolver()` (built by D-04 of Phase 3 for exactly this); no-op-that-says-so with no store installed | ✓ |
| Pure function now, not wired to the tool | Avoids a half-connected feature; leaves the tool advertising an argument it does not honour | |
| Move DISASM-06 to Phase 5 | Cleanest dependency story; the rule is about encoding safety, not symbol provenance, and the renderer needs the invariant anyway | |

**User's choice:** Ship the mechanism against the existing hook → **D-14**

---

## Claude's Discretion

- Module naming and file split for the derived layer and the disassembler.
- `gatherWedgeEvidence()` named in the helper header as Phase 5's second
  consumer, but not repointed here.
- The exact `!byte` comment format and label emission for branch/jump targets.
- Whether the renderer is pluggable for Phase 6's CPU-history output format.
- The precise membership of D-09's substitution table — determined by the
  assertion test against the installed ACME, not by prose.

## Deferred Ideas

- Repoint `acme-build`'s `disasm` at the new library, replacing the `toacme`
  shell-out.
- `gatherWedgeEvidence()`'s host-translation fix — Phase 5 criterion 5.
- Renderer pluggability for Phase 6's CPU-history format.
- A Phase 8 parity-harness divergence entry for disassembly output.
