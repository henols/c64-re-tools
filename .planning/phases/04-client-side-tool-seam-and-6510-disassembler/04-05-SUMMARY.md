---
phase: 04-client-side-tool-seam-and-6510-disassembler
plan: 05
subsystem: mcp-server
tags: [typescript, stock-vice-backend, derived-tools, disassembler, 6502, node-test]

# Dependency graph
requires:
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 02)
    provides: "withDerivedTool()/STOCK_DERIVED_TOOLS -- the derived-tool interception seam this plan is the first consumer of"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 03)
    provides: "disasm-decoder.ts's decode()/Instruction -- the byte decoder this handler calls"
  - phase: 04-client-side-tool-seam-and-6510-disassembler (plan 04)
    provides: "disasm-renderer.ts's render()/RenderOptions -- the ACME-ready listing generator this handler calls"
provides:
  - "vice_disassemble on the stock backend (DISASM-01, criterion 2): fork-compatible address/count/show_symbols plus a stock-only end, mutually exclusive with count"
  - "stock-address.ts's reverse symbol lookup: symbolNameFor()/hasSymbolStore(), the address->name inverse of the existing resolve()"
  - "stock-disassemble.ts: handleDisassemble, a bounded/side-effect-free MEM_GET read decoded+rendered client-side, answer bounded at 100 instructions"
affects: [04-06-acme-roundtrip, 04-07-parity-docs, phase-5-screenshots-and-derivations, phase-6-stock-only-gains]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "First derived-tool registration: vice_disassemble goes through withDerivedTool(needsSession:true) in the SAME STOCK_DISPATCH_TABLE, never a second table or dispatch site"
    - "One resolver holder, both directions: SymbolResolver widened with an optional nameFor(address), read from the same module-level holder parseAddress() already reads -- no second holder"
    - "D-12 mutual exclusion pattern: gate a refusal on args.field !== undefined (explicit supply), never on the resolved default, so a default value can never trigger a refusal meant for explicit conflicting input"
    - "D-13 answer-bound pattern: decode the full range, then slice(0, MAX) and report limitReached/nextAddress -- applied uniformly to both the count form (already capped) and the end form (uncapped, the real DoS surface)"

key-files:
  created:
    - .claude/mcp/vice/stock-disassemble.ts
    - .claude/mcp/vice/stock-disassemble.test.ts
  modified:
    - .claude/mcp/vice/stock-address.ts
    - .claude/mcp/vice/stock-address.test.ts
    - .claude/mcp/vice/stock-dispatch.ts
    - .claude/mcp/vice/stock-dispatch.test.ts
    - .claude/mcp/vice/tools-manifest.stock.json
    - .claude/mcp/vice/package.json

key-decisions:
  - "Widened SymbolResolver in place (optional nameFor) rather than a second reverse-lookup holder or a new stock-symbols.ts seam, per the plan's own plan_decision_reverse_symbol_lookup block -- one holder, one hook, Phase 5's DERIV-04 store installs both directions into it"
  - "The structured instructions[] answer field's operand text is always numeric (never symbol-substituted) -- symbol substitution is exclusively a listing (ACME text) concern; the plan's own field examples (#$0f, $d020,x, ($10ff)) are all numeric forms"
  - "operandTextFor()/hex2()/hex4() are local to stock-disassemble.ts rather than exported from disasm-renderer.ts -- that file's own per-operand-text helper is private and outside this plan's files_modified, and the structured field's numeric-only rule is a distinct concern from the listing's symbol-substituted rendering anyway"

requirements-completed: [DISASM-01, DISASM-06]

# Metrics
duration: ~45min
completed: 2026-08-17
---

# Phase 4 Plan 05: vice_disassemble on the Stock Backend Summary

**`vice_disassemble` lands on the stock backend through the derived-tool seam: fork-compatible `address`/`count`/`show_symbols` plus a stock-only `end`, a bounded side-effect-free MEM_GET read decoded via 04-03's decoder and rendered via 04-04's ACME-ready renderer, answer capped at 100 instructions with `limitReached`/`nextAddress`.**

## Performance

- **Duration:** ~45 min
- **Tasks:** 3 completed
- **Files modified/created:** 8 (2 created, 6 modified)

## Accomplishments

- **`stock-address.ts`'s reverse symbol lookup (DISASM-06's first consumer of the reverse direction):** `SymbolResolver` widened with an optional `nameFor(address) -> name`, read from the SAME module-level holder `parseAddress()`/`resolve()` already use. `symbolNameFor()` and `hasSymbolStore()` exported, never throwing, degrading to `undefined`/`false` when no resolver or no `nameFor` is installed. `parseAddress()`'s existing behaviour is provably unaffected (all 27 pre-existing tests plus 21 new ones pass).
- **`stock-disassemble.ts` -- `handleDisassemble`:** parses the fork's `address`/`count`/`show_symbols` (same names, types, defaults) plus the stock-only optional `end`; refuses `count`+`end` together outright (D-12), gated on explicit supply so the default `count` of 10 never falsely triggers the refusal against an `end`-only call. Reads a bounded, side-effect-free (`sidefx` hardcoded `false`) memory range -- over-read-by-two for the `end` form, `address + count*3 - 1` for the `count` form, both clamped at `$ffff`. Decodes via `disasm-decoder.ts`'s `decode()`, renders via `disasm-renderer.ts`'s `render()`. Bounds the answer at 100 instructions (D-13) with `limitReached`/`nextAddress`, applied to both forms. `show_symbols` with no symbol store installed is a successful no-op that says so (`symbolNote`, D-14), never an error. Never issues a resume; the answer is built exclusively through `stockAnswer()`.
- **Registration:** `vice_disassemble` added to `tools-manifest.stock.json` (26 tools total) with an `inputSchema` matching the fork's own wording plus `end`, and an `outputSchema` restricted to `checkAgainstSchema()`'s supported keyword subset (no `description`/`default`/`minimum` inside it). Registered in `STOCK_DISPATCH_TABLE` through `withDerivedTool("vice_disassemble", { needsSession: true }, handleDisassemble)` -- the same table 25 direct tools already use, no second dispatch site (`grep -c 'dispatchStock(' vice-proxy.ts` still `1`).
- **Rule 2 shipping-correctness (this task's own T-04-05-08 mitigation):** `stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` added to `package.json`'s `files[]` (38 entries, up from 34) in the SAME commit that makes `stock-dispatch.ts` import them. The shipping-closure gate (walking every relative import transitively reachable from `vice-proxy.ts`) passes: 32 modules, zero unshipped.
- **Test coverage:** 21 new `stock-address.test.ts` cases (reverse lookup); 20 `stock-disassemble.test.ts` cases (every D-12 refusal, the over-read math for both forms, `$ffff` clamping with an instruction running off the top reported truncated, D-14's no-op and substitution paths, the 100-instruction answer bound, short-read/wrong-response-type guards, exactly-one-send); `stock-dispatch.test.ts` gained a conformance case, an end-to-end derived-path proof under a translating environment (`HOST_WORKSPACE_PATH`/`CLAUDE_PROJECT_DIR` set), and a structural zero-`forwardToVice`-code-reference assertion for `stock-dispatch.ts` itself.
- Full regression: `npm run typecheck` exits 0; `npm run test:automated` shows 1176/1177 passing, the one failure being the pre-existing, already-logged worktree-path `repo-root.test.ts` case (unrelated -- confirmed no reference to `disassemble`/`disasm` anywhere in that file); `npm run smoke` exits 0, advertising 61 tools.
- Manual sanity read of a real answer's `listing` field: `!cpu 6510` header, `* = $c000` origin line, followed by decoded instruction lines -- confirmed by direct invocation against a synthetic byte corpus.

## Task Commits

1. **Task 1: Add the reverse symbol lookup to stock-address.ts** - `dbfa1b2` (feat)
2. **Task 2: Create stock-disassemble.ts -- the vice_disassemble handler** - `4e3480a` (feat)
3. **Task 3: Register vice_disassemble -- manifest, dispatch table, and tests** - `d135251` (feat)

**Plan metadata:** pending (this commit)

## Files Created/Modified

- `.claude/mcp/vice/stock-address.ts` - widened `SymbolResolver` with optional `nameFor`; exported `symbolNameFor()`/`hasSymbolStore()`
- `.claude/mcp/vice/stock-address.test.ts` - 21 new tests for the reverse direction, plus one confirming `parseAddress()` is unaffected
- `.claude/mcp/vice/stock-disassemble.ts` - `handleDisassemble`, the `vice_disassemble` handler
- `.claude/mcp/vice/stock-disassemble.test.ts` - 20 tests covering refusals, over-read math, truncation, D-14, the answer bound, and the wire guards
- `.claude/mcp/vice/stock-dispatch.ts` - imports `handleDisassemble`; registers it via `withDerivedTool` in the `// derived (DERIV-07, DISASM-01)` group
- `.claude/mcp/vice/stock-dispatch.test.ts` - `REGISTERED_TOOL_NAMES` grows to 26; a conformance case, an end-to-end derived-path proof, and a structural forwardToVice-absence assertion for `stock-dispatch.ts`
- `.claude/mcp/vice/tools-manifest.stock.json` - `vice_disassemble` entry added (26 tools)
- `.claude/mcp/vice/package.json` - `files[]` gains `stock-disassemble.ts`, `disasm-opcodes.ts`, `disasm-decoder.ts`, `disasm-renderer.ts` (38 entries)

## The exact answer field list and `dispatchStock` invocation shape 04-06 needs

**Answer fields, in the order `stockAnswer()` receives them** (plus `runState`, appended by `stockAnswer()` itself -- never supplied by the handler):

```typescript
{
  address: number,               // always present
  end?: number,                  // present only when the `end` form was used
  count: number,                 // instructions ACTUALLY returned (kept.length), not the requested count
  instructions: Array<{
    address: number,
    bytes: number[],
    mnemonic: string,            // "" for a truncated instruction
    operand: string,             // rendered operand text, always numeric (never symbol-substituted); "" when the mode has none or the instruction is truncated
    resolvedTarget?: number,     // present only when the instruction has one (relative branch, or jmp/jsr absolute)
    notes: string[],             // always present, possibly empty: "truncated" | "nmos-page-wrap" | "illegal-opcode" | "acme-unassemblable"
  }>,
  listing: string,                // the full ACME-ready "!cpu 6510" text -- symbol names ARE substituted here when symbolsApplied is true
  symbolsApplied: boolean,
  symbolNote?: string,            // present only when show_symbols was true but no symbol store is installed
  limitReached: boolean,
  nextAddress?: number,           // present only when limitReached is true
  runState: "running" | "stopped" | "unknown",  // appended by stockAnswer(), always present
}
```

**`dispatchStock` invocation to obtain a `listing` string** (the real path, exercising `withDerivedTool`):

```typescript
import { dispatchStock, type StockDispatchDeps } from "./stock-dispatch.ts";

const result = await dispatchStock("vice_disassemble", { address: "$c000", count: 20 }, deps);
// result.isError === false on success
const parsed = JSON.parse((result as { content: { text: string }[] }).content[0].text);
const listing: string = parsed.listing;
```

`listing`'s exact header format (from `disasm-renderer.ts`'s `render()`, unchanged by this plan): `!cpu 6510`, then zero or more `name = $XXXX` symbol definitions sorted by address, then `* = $XXXX` (the origin, always `address` on this handler's call), then one line per instruction.

## Decisions Made

- **Reverse symbol lookup widens the existing holder** (per the plan's own `plan_decision_reverse_symbol_lookup` block) rather than a second holder or seam -- `SymbolResolver.nameFor` is optional so every existing implementer and test fake stays valid, and Phase 5's DERIV-04 store installs both directions into the same object.
- **The structured `instructions[]` field's `operand` text is always numeric, never symbol-substituted.** The plan's own field examples (`"#$0f"`, `"$d020,x"`, `"($10ff)"`) are all plain hex forms; symbol substitution is exclusively a `listing`-field concern (`disasm-renderer.ts`'s `render()`, unchanged). This keeps the two answer fields' concerns cleanly separated: `instructions[]` for machine-readable numeric data, `listing` for the human/ACME-readable rendered text.
- **`operandTextFor()`/`hex2()`/`hex4()` are local, duplicated helpers in `stock-disassemble.ts`**, not imports from `disasm-renderer.ts` (whose equivalent helpers -- `renderMnemonicOperand()`, `hex2()`, `hex4()` -- are private, unexported, and combine mnemonic+operand text together rather than operand text alone). `disasm-renderer.ts` is deliberately outside this plan's `files_modified`; duplicating three small pure functions was judged lower-risk than reopening 04-04's already-committed, tested module to export a new primitive mid-phase.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Header comment used the literal string "sidefx: true", which the plan's own acceptance criteria forbid**

- **Found during:** Task 2, running the plan's own acceptance-criteria grep (`grep -c 'sidefx: true' stock-disassemble.ts` must output `0`)
- **Issue:** The header comment's "WHAT NOT TO DO" list originally read `Never set \`sidefx: true\` on the MEM_GET body`, which itself contains the forbidden literal
- **Fix:** Reworded to "Never turn the MEM_GET body's side-effect flag on", preserving the same warning without the literal string
- **Files modified:** `.claude/mcp/vice/stock-disassemble.ts`
- **Verification:** `grep -c 'sidefx: true' stock-disassemble.ts` now outputs `0`; `npm run typecheck` still passes
- **Committed in:** `4e3480a` (Task 2's own commit -- caught before committing, not a separate fix-up)

**2. [Rule 1 - Bug] My own new structural test (`stock-dispatch.test.ts`'s zero-forwardToVice-code-reference assertion) initially flagged a prose mention inside a `/** ... */` block comment**

- **Found during:** Task 3, running the new test for the first time
- **Issue:** `stock-dispatch.ts`'s own pre-existing `dispatchStock()` docblock names `forwardToVice()` in prose (explaining the D-09 hazard it exists to prevent) using `*`-prefixed continuation lines. My new test's comment-stripping only removed `//` lines, matching that block-comment prose as a "code" reference and failing on a pre-existing, correct comment I did not write.
- **Fix:** Widened the test's comment-stripping to match `VICE_PROXY_CODE_LINES`'s own existing filter (`!/^\s*\*/.test(line) && !/^\s*\/\//.test(line)`), the same pattern this file already uses one section above for `vice-proxy.ts`
- **Files modified:** `.claude/mcp/vice/stock-dispatch.test.ts`
- **Verification:** `node --test stock-dispatch.test.ts` now shows 105/105 passing
- **Committed in:** `d135251` (Task 3's own commit -- caught before committing)

---

**Total deviations:** 2 auto-fixed (both Rule 1, both caught and fixed before the containing task's commit -- neither shipped as a broken intermediate state)
**Impact on plan:** Both fixes are to this plan's own new artifacts (a header comment and a new test's filtering logic), not to any prior-wave file. No scope creep, no behavioural change to the shipped handler.

## Issues Encountered

- **Plan's own task 2 `<verify>` block referenced `stock-disassemble.test.ts` before task 3 (which creates that file) ran.** Task 2's `files` list correctly scoped only `stock-disassemble.ts` itself; its `<verify>` automated command additionally ran `node --test stock-disassemble.test.ts`, which does not exist until task 3. Resolved by treating task 2's verification as deferred to task 3's completion (where the full verify chain, including that test file, was run and passed) rather than attempting to run a nonexistent test file mid-task. No code or test content was affected by this sequencing note; it is documented here for plan-quality tracking, not as a defect requiring a fix.
- **`node_modules` was not present in this worktree at the start of execution** (plugin dependencies are provisioned by a `SessionStart` hook that runs `npm ci`, gated on a lockfile hash). Ran `npm ci` once at the start of Task 1's verification so `npm run typecheck` (which needs `tsc`) could run; this is standard environment provisioning, not a plan deviation.

## Plan Defect Watch

No tautological test pattern (a test whose expected value is read from the same live source that built its input) was found in this plan's own new tests. The two candidates checked:
- **The all-256/renderer-style "independent ground truth" pattern from 04-03/04-04 does not apply here** -- this plan's tests assert against explicit literal expected values (byte offsets, hex addresses, string content), never against a value re-derived from the same code path under test.
- **The over-read-math tests** (`end+2`, `address+count*3-1`) compute the expected `readEnd` independently in the test body from the plan's own stated formula, then assert the captured wire body matches that literal -- not by calling the handler twice and comparing its own two outputs to each other.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `vice_disassemble` is live on the stock backend, registered through the derived-tool seam, and validated by the D-02 conformance harness against its own declared `outputSchema`.
- 04-06 (real-ACME round-trip) can call `dispatchStock("vice_disassemble", {...}, deps)` and feed the returned `listing` string directly to a real `acme` process -- the exact invocation shape and header format are recorded above.
- 04-07 (parity docs) can cite this plan's D-09/D-11 divergences (already named in the manifest's own `description` field) verbatim.
- Phase 5's DERIV-04 symbol store, when it lands, installs an object implementing both `resolve()` and `nameFor()` into `stock-address.ts`'s one holder via the existing `setSymbolResolver()` -- no code change needed in this plan's files to pick it up.
- No blockers. The one open uncertainty inherited from 04-04 (whether ACME's real `+2` size-forcing syntax is spelled correctly) remains 04-06's job to confirm, unaffected by this plan.

## Self-Check: PASSED

- FOUND: `.claude/mcp/vice/stock-disassemble.ts`
- FOUND: `.claude/mcp/vice/stock-disassemble.test.ts`
- FOUND commit `dbfa1b2` (Task 1)
- FOUND commit `4e3480a` (Task 2)
- FOUND commit `d135251` (Task 3)

---
*Phase: 04-client-side-tool-seam-and-6510-disassembler*
*Completed: 2026-08-17*
