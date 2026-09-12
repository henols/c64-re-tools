---
phase: 47-multi-file-rebuildable-source
plan: 04
subsystem: reverse-engineering-toolchain
tags: [acme, export-asm, annotation-store, symbol-resolution, multi-file-source]

requires:
  - phase: 47-multi-file-rebuildable-source
    provides: "47-01's exportAsmTree()/cwd-aware acme.build; 47-02's multi-scope partition and boundary refusal; 47-05's directory-shaped --out; 47-03's external_file !binary emission -- the tree this plan's symbol rule and cross-file proof run against"
provides:
  - "referencedAddress()/isInTree() -- the in-tree symbol rule inside exportAsm()'s code-block loop: every branch, JSR, JMP, data reference and indirect vector whose target lies inside an emitted block is checked against the SAME labelIndex the renderer reads, and an unresolved one is collected and refused ONCE at the end, naming the first offender's referring/target addresses and the N-of-M count"
  - "the refusal's own boundary (D47-F): a reference OUTSIDE every emitted block (a hardware register, a KERNAL entry) still renders as a hex literal and is never refused"
  - "a proof, against real ACME 0.97, that a jsr crossing a scope's file boundary resolves in both directions (forward and backward), guarded by a direct test of setLabel()'s name-uniqueness refusal and a direct test that no emitted file carries an ACME !zone directive"
  - "a proof, against real ACME 0.97, that a zero-page-shaped reference encodes in two bytes when symbols.a is sourced first, drifts to a real assembler refusal when swapped, and widens to three bytes -- visibly, with ACME's own oversized-addressing warning -- when the backstop bracket is also removed"
affects: [47-06]

actuals:
  tokens: 10365
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "One extraction function, one boundary test: referencedAddress() reads resolvedTarget first (relative branch, absolute jmp/jsr) then falls back to the operand's own value for absolute/zeropage/indirect roles, and isInTree() tests the result against the SAME blocks array exportAsm() already built -- never a second range list or a second label lookup, so a refusal can never disagree with what the renderer actually substituted."
    - "Collect-then-refuse-once: an unresolved in-tree reference is accumulated across the WHOLE block loop and refused a single time at the end, in the exact shape the pre-existing unapplied-enum-usage and unplaced-comment refusals already use (name the first offender, state the N-of-M count, name the remedy)."
    - "A hazard the exporter's own renderer refuses to reproduce (D-11: never substitute a symbol into a zeropage-mode operand) is exercised, when it needs proving at all, by hand-mutating the WRITTEN TREE FILES on disk -- the same idiom PLANTED VIOLATION 2 already established for the single-file case, extended here to a real multi-file tree and a real ACME report listing rather than a string-replace of result.source."

key-files:
  created: []
  modified:
    - src/mcp/vice/anno-export-asm.ts
    - src/mcp/vice/anno-export-asm.test.ts

key-decisions:
  - "The in-tree symbol rule is scoped to the SAME blocks array exportAsm() already built (all emitted blocks, code and data alike), and reads the SAME labelIndex map the renderer's symbolFor closure reads -- never a second index or a second range list, on the same 'one seam per concern' discipline this file already follows for its other refusals."
  - "An immediate operand is deliberately never a reference, for the same reason disasm-renderer.ts's own D-11 comment gives on the substitution side: an immediate is a byte value, project enums are what give it a name, and treating it as an address is how `lda #$08` would start demanding a label at $0008."
  - "The pre-existing 'ALL 256 OPCODES' fixture needed 8 header-only labels (one per relative-branch opcode's own self-reference) to keep exporting under the new rule -- added via `everyOpcodeBranchTargetLabels()`, matching the plan's own instruction to add the missing label rather than weaken the rule or carve out an exemption."
  - "Task 3's fixture proves the zero-page ordering hazard by hand-substituting a symbol into a zeropage-mode operand in the WRITTEN unscoped.a file (a mutation disasm-renderer.ts's D-11 rule never lets the exporter perform on its own) -- without it, sourcing order cannot matter at all, since nothing this exporter emits on its own references that operand by name."

requirements-completed: []
# BUILD-03 is declared by THREE sibling plans in this phase (47-02, 47-04,
# 47-06). Per the shared-ID gate, it is NOT marked complete here -- 47-06
# (depends_on: [47-04], wave 5) has not yet landed its own SUMMARY. Nothing
# was marked in REQUIREMENTS.md by this plan; the next plan to close BUILD-03
# is 47-06.

coverage:
  - id: D1
    description: "Every in-tree branch, JSR, JMP and data reference goes through a symbol, and the unresolvable case refuses by name -- naming both addresses and the N-of-M count -- rather than freezing an address into a hex literal. A reference outside every emitted block still renders as a hex literal and is never refused."
    requirement: "BUILD-03"
    verification:
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: an in-tree `jsr` with no label at its target makes exportAsm() throw, naming both addresses and the count"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: the same `jsr` store with a label recorded at the target exports cleanly, renders the symbol, and reassembles byte-identically"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: a reference to an address OUTSIDE every emitted block renders as a hex literal and does NOT refuse"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: a relative BRANCH whose resolved target is in-tree with no label there refuses too -- the rule covers branches, not only jsr/jmp"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: a data reference -- an absolute operand that is not a control-flow target -- in-tree with no label there refuses"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: an indirect `jmp` whose VECTOR address is in-tree with no label there refuses"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: the refusal message contains no byte value from the image and no store comment text"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#symbol rule: an immediate operand is never treated as a reference -- a store loading an immediate equal to a block address exports cleanly"
        status: pass
    human_judgment: false
  - id: D2
    description: "A cross-file reference (jsr from a block in one scope's file to a label defined by a block in another scope's file) resolves after the split, in both directions, proven by real ACME assembling to the expected bytes; the store's name-uniqueness refusal that makes the flat namespace safe is asserted directly, no !zone directive is ever emitted, and an auto-generated label's backlog marker survives the split."
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "anno-export-asm.test.ts#cross file: a jsr in the FIRST scope's file (sourced first) resolves to a label defined by a block in the SECOND scope's file"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#cross file: the mirror -- a jsr in the SECOND scope's file resolves to a label defined by a block in the FIRST scope's file"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#cross file: non-vacuity -- the referring line and the target's own block really are in DIFFERENT emitted files"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#cross file: PRECONDITION -- setLabel() refuses a second label name bound to a different address, the invariant the flat namespace rests on"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#cross file: no ACME !zone directive appears in any emitted file of the tree"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#cross file: an auto-generated label name survives the split -- its symbols.a definition still carries the backlog marker"
        status: pass
    human_judgment: false
  - id: D3
    description: "The zero-page two-byte encoding is read out of a real ACME report listing when symbols.a is sourced first; swapping the sourcing order alone makes the same source fail at real ACME's own block-end assertion; stripping that assertion on top of the broken order lets the three-byte widening through, visibly, with ACME's own oversized-addressing warning; a non-vacuity check confirms the two report listings genuinely differ."
    requirement: "BUILD-03"
    verification:
      - kind: integration
        ref: "anno-export-asm.test.ts#zeropage order: the root sources symbols.a FIRST, and the report listing's line for that instruction shows the TWO-byte encoding"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#zeropage order: swapping root.a's two !source lines -- ONE documented mutation, nothing else changed -- makes the SAME reference assemble at a non-zero exit, caught by the block-end assertion"
        status: pass
      - kind: integration
        ref: "anno-export-asm.test.ts#zeropage order: stripping the block's own bracket assertions on top of the broken order -- a SECOND, deliberately unsupported mutation -- lets the widening through, visibly"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#zeropage order: non-vacuity -- the correct-order and stripped-bracket report listings really do differ on that instruction's line"
        status: pass
      - kind: unit
        ref: "anno-export-asm.test.ts#zeropage order: symbols.a is first in sourceOrder, and first among root.a's own !source lines -- a property of the generator, not one fixture"
        status: pass
    human_judgment: false

duration: 35min
completed: 2026-09-12
status: complete
---

# Phase 47 Plan 4: The In-Tree Symbol Rule, Cross-File Resolution and Zero-Page Ordering, Measured Summary

**`exportAsm()` now refuses by name -- naming both addresses and the count -- any in-tree branch, `JSR`/`JMP` or data reference with no label at its target, while a hardware/KERNAL address still renders as a hex literal; a cross-file `jsr` resolves in both directions against real ACME 0.97 with the flat-namespace invariant guarded directly; and the zero-page sourcing-order hazard is measured in both directions -- caught by the block-end assertion, then made visible when that assertion is deliberately removed.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `referencedAddress()` extracts the address a decoded instruction's operand references (`resolvedTarget` first -- every relative branch, absolute `jmp`/`jsr` -- then the operand's own value for the `absolute`, `zeropage` and `indirect` roles; an `immediate` operand is deliberately excluded), and `isInTree()` tests it against the SAME `blocks` array `exportAsm()` already built. An unresolved in-tree reference is collected across the whole block loop and refused ONCE at the end, in the exact shape the pre-existing unapplied-enum-usage and unplaced-comment refusals already use.
- A reference outside every emitted block -- `$d020`, `$ffd2`, any KERNAL entry -- still renders as a hex literal and is never refused (D47-F): both directions of that boundary are asserted, so it cannot drift silently either way.
- Eight `symbol rule:` tests cover `jsr`/branch/data-reference/indirect-vector in-tree unresolved refusals, the resolved `jsr` reassembling byte-identically, the out-of-tree non-vacuity control, the refusal message's no-disclosure guarantee, and immediate-operand exclusion. The pre-existing "ALL 256 OPCODES" fixture needed 8 header-only labels for its own relative branches' self-references to keep exporting under the new rule.
- Six `cross file:` tests prove, against real ACME 0.97, that a `jsr` crossing a scope's file boundary resolves in BOTH directions (forward and backward) with a non-vacuity check that the referring line and the target's block genuinely land in different emitted files; a PRECONDITION test drives `setLabel()`'s own name-uniqueness refusal directly; a test asserts no emitted file carries an ACME `!zone` directive; and a test confirms an auto-generated label's backlog marker survives the split into `symbols.a`.
- Five `zeropage order:` tests turn criterion 5 into three observations and a control: the two-byte encoding read from a real ACME report listing when `symbols.a` is sourced first, the SAME reference failing at real ACME's own block-end assertion when the sourcing order is swapped, the three-byte widening made visible (with ACME's own oversized-addressing warning) once the assertion is also stripped, a non-vacuity check that the two report listings genuinely differ, and a property test that `symbols.a` is first in `sourceOrder` and in `root.a`'s own `!source` lines for the generator generally.

## Task Commits

Each task was committed atomically:

1. **Task 1: Every in-tree reference goes through a symbol, or the export refuses by name** - `d39472bb` (feat)
2. **Task 2: A cross-file reference still resolves -- and the invariant that makes it safe is guarded** - `82976ebd` (test)
3. **Task 3: The zero-page encoding, measured in both directions** - `1ed8358d` (test)

_Note: all three tasks carried `tdd="true"`; per this project's established phase-47 convention (see 47-01/47-02/47-03/47-05 history), implementation and its own direct test coverage landed together per task rather than as separate RED/GREEN commits, since `MVP_MODE=false`/`TDD_MODE=false` for this run and the plan's own `type: execute` frontmatter does not invoke the plan-level RED/GREEN/REFACTOR gate._

## Files Created/Modified

- `src/mcp/vice/anno-export-asm.ts` - `referencedAddress()`, `isInTree()`, the `unresolvedReferences`/`inTreeReferenceCount` collection inside `exportAsm()`'s code-block loop, and the refusal thrown once after the loop completes
- `src/mcp/vice/anno-export-asm.test.ts` - eight `symbol rule:` tests plus `everyOpcodeBranchTargetLabels()` (Task 1); six `cross file:` tests plus `crossFileRefFixture()` (Task 2); five `zeropage order:` tests plus `zeropageOrderTree()`/`reportByteColumnAt()` (Task 3)

## Decisions Made

- The in-tree symbol rule is scoped to the SAME `blocks` array `exportAsm()` already built (every emitted block, code and data alike), and reads the SAME `labelIndex` map the renderer's `symbolFor` closure reads -- never a second index or a second range list, so a refusal can never disagree with what the renderer actually did.
- An immediate operand is deliberately never a reference, for the same reason `disasm-renderer.ts`'s own D-11 comment gives on the substitution side: an immediate is a byte value, project enums are what give it a name, and treating it as an address is how `lda #$08` would start demanding a label at `$0008`.
- The pre-existing "ALL 256 OPCODES" fixture needed 8 header-only labels (one per relative-branch opcode's own self-reference target) to keep exporting under the new rule -- added via a new `everyOpcodeBranchTargetLabels()` helper, per the plan's own instruction to add the missing label rather than weaken the rule.
- Task 3's fixture proves the zero-page ordering hazard by hand-substituting a symbol into a zeropage-mode operand in the WRITTEN `unscoped.a` file -- a mutation `disasm-renderer.ts`'s D-11 rule never lets the exporter perform on its own (it never substitutes into a zeropage operand). Without this mutation, sourcing order cannot matter at all for this exporter's own emission, since nothing it emits unmutated references that operand by name; this is confirmed live against real ACME 0.97, matching `PLANTED VIOLATION 2`'s own established idiom, extended to a real multi-file tree and a real `.rep` listing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug, anticipated by the plan's own text] The pre-existing "ALL 256 OPCODES" fixture reddened under the new in-tree symbol rule**
- **Found during:** Task 1, first full-suite run after adding the rule
- **Issue:** `everyOpcodeImage()`'s fixture (no labels, by design) decodes every relative-branch opcode's self-reference (`address + 2`, per the fixture's own filler-byte scheme) as an in-tree, unresolved reference -- 8 of 8 in-tree references, one per branch opcode ($10/$30/$50/$70/$90/$b0/$d0/$f0). The plan's own action text anticipated this exact class of regression: "If a pre-existing fixture ... now refuses, the correct fix is to ADD the missing store label at the referenced address ... Never weaken the rule, never add a per-fixture exemption."
- **Fix:** Added `everyOpcodeBranchTargetLabels()`, computing one label per relative-branch opcode's own resolved target (each the START of the next opcode's instruction, hence a HEADER-only definition, never inline) and passed as the fixture's `labels`. Updated the fixture's own doc-comment and the `content.length === 256` assertion's message to state why the label set no longer reads "zero labels" while the per-opcode line count is unaffected.
- **Files modified:** `src/mcp/vice/anno-export-asm.test.ts`
- **Verification:** `node --test anno-export-asm.test.ts` -- `ℹ fail 0`, `ℹ skipped 0` (173/173 before Task 1's own new tests were added, 192/192 after all three tasks).
- **Committed in:** `d39472bb` (Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1, explicitly anticipated by the plan's own action text -- not a surprise finding)
**Impact on plan:** The fix is the new rule doing exactly its documented job against a fixture that happens to carry unresolved in-tree branch self-references; no rule was weakened and no per-fixture exemption was added.

## Issues Encountered

None that blocked the plan. `npm run test:automated`'s first post-Task-3 run reported two additional failures beyond the documented 6-member baseline (`anno-verb-coverage.test.ts:444`, a shipped-skill-tree drift caused by a leaked `zz-scratch-*` directory from a concurrent parallel test worker; `text-protocol.test.ts:598`, a timing-sensitive RED-observation test) -- both confirmed as pre-existing, unrelated flakes (per this project's own documented "test suite races on repo-tree scratch files" note): both pass in isolation, and a clean re-run of the full suite returned the failing-name set to exactly the documented 6-member baseline (`anno-import.test.ts:352`, `anno-register.test.ts:385`, `anno-register.test.ts:479`, `audit-integrity.test.ts:245`, `docs-deferred-ledger.test.ts:101`, `docs-deferred-ledger.test.ts:195`). No leaked scratch directory or code from this plan's own work was involved.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- BUILD-03 stays `Pending` in `REQUIREMENTS.md` -- it is declared by three sibling plans in this phase (47-02, 47-04, 47-06); 47-06 (`depends_on: [47-04]`, wave 5) has not yet landed its own SUMMARY, so per the shared-ID gate nothing is marked complete here.
- Plan 47-06 can build directly on this plan's `referencedAddress()`/`isInTree()` in-tree symbol rule and the cross-file/zero-page proofs without further groundwork -- its own `depends_on: [47-04]` is now satisfied.
- No blockers.

---
*Phase: 47-multi-file-rebuildable-source*
*Completed: 2026-09-12*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/anno-export-asm.ts`
- FOUND: `src/mcp/vice/anno-export-asm.test.ts`
- FOUND commit `d39472bb` (Task 1)
- FOUND commit `82976ebd` (Task 2)
- FOUND commit `1ed8358d` (Task 3)
- Re-ran plan-level `<verification>`: `npm run typecheck` clean; `node --test anno-export-asm.test.ts` 192/192 pass, 0 skipped; `node --test anno-cli.test.ts anno-cli-invocations.test.ts` 139/139 pass; `node scripts/check-npm-packages.mjs` exit 0; `npm run test:automated` failing-name set is exactly the 6 documented baseline names (tests 4177, pass 4162, fail 6, skipped 9 on the clean re-run).
