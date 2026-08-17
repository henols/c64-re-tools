---
phase: 04-client-side-tool-seam-and-6510-disassembler
reviewed: 2026-08-17T13:35:37Z
depth: standard
files_reviewed: 23
files_reviewed_list:
  - .claude/mcp/vice/disasm-opcodes.ts
  - .claude/mcp/vice/disasm-opcodes.test.ts
  - .claude/mcp/vice/disasm-decoder.ts
  - .claude/mcp/vice/disasm-decoder.test.ts
  - .claude/mcp/vice/disasm-renderer.ts
  - .claude/mcp/vice/disasm-renderer.test.ts
  - .claude/mcp/vice/disasm-roundtrip.test.ts
  - .claude/mcp/vice/stock-derived.ts
  - .claude/mcp/vice/stock-derived.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-disassemble.ts
  - .claude/mcp/vice/stock-disassemble.test.ts
  - .claude/mcp/vice/stock-address.ts
  - .claude/mcp/vice/stock-address.test.ts
  - .claude/mcp/vice/hostpath-consumers.test.ts
  - .claude/mcp/vice/vice-proxy.ts
  - .claude/mcp/vice/vice-broker-client.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/mcp/vice/THIRD-PARTY-NOTICES.md
  - scripts/check-npm-packages.mjs
  - docs/stock-vice-parity.md
  - .github/workflows/ci.yml
findings:
  critical: 0
  warning: 1
  info: 3
  total: 4
status: issues_found
---

# Phase 4: Code Review Report

**Reviewed:** 2026-08-17T13:35:37Z
**Depth:** standard
**Files Reviewed:** 23 (+ CI workflow)
**Status:** issues_found (no Critical/Blocker findings; one Warning, three Info)

## Summary

This phase's own implementation process (per the SUMMARY.md files) already caught and
self-corrected four plan-defect-shaped issues before they shipped: a transcription bug
(`$FD`), a tautological length-invariant test design, and two incorrect literal predictions
in the round-trip suite (Suite C's "assert ok===false" wording, Suite D's shrink-hazard
prediction). I re-derived and independently re-verified the areas those defects lived in —
the opcode table, the decoder's length/branch/truncation logic, the renderer's `!byte`/`+2`
mechanisms, and the round-trip's own assertions — and additionally:

- Ran every test file in this phase locally against a real installed ACME 0.97 ("Zem")
  (`disasm-opcodes.test.ts`, `disasm-decoder.test.ts`, `disasm-renderer.test.ts`,
  `disasm-roundtrip.test.ts`, `stock-disassemble.test.ts`, `stock-derived.test.ts`,
  `hostpath-consumers.test.ts`, `stock-address.test.ts`, `stock-dispatch.test.ts`) — all
  pass (188 + 5 + 76 + 105 tests, zero failures).
  - Confirmed `disasm-roundtrip.test.ts`'s "ACME availability gate (D-08)" test, the
    all-256-opcode Suite A, the fragment Suite B, the bidirectional membership Suite C,
    and the `+2`-spelling Suite D all genuinely execute (not skipped) and pass against
    `/home/henrik/.local/bin/acme`.
  - Ran `node scripts/check-npm-packages.mjs` — passes, including the new transitive-closure
    walk (32 modules) and the DISASM-07 dependency gate.
- Traced the derived-tool seam structurally end-to-end in `vice-proxy.ts`
  (`buildBackendAwareTool()` at line 3166) and confirmed that on the stock backend every
  registered tool — including `vice_disassemble` — is routed through `dispatchStock()`
  and never through `forwardToVice()`/`rewriteArguments()`; `handleRecycle()`/
  `gatherWedgeEvidence()` (the only caller of `rewriteArguments()` besides
  `forwardToVice()`) is unreachable on the stock backend today because `vice_recycle` has
  no `STOCK_DISPATCH_TABLE` entry and is refused by name. This claim holds structurally,
  not merely by convention.
- Probed `decode()` directly with an out-of-range `startAddress` (see WR-01 below) and
  confirmed by execution, not just by reading, that it silently wraps rather than
  rejecting.

**Decoder correctness (priority 1):** clean, aside from WR-01 below (an argument-bound gap
at the library boundary, not a decode-logic bug). Length/mode table, branch-target signed
arithmetic, 16-bit address wrap, truncation-without-fabrication, and the `JMP ($xxFF)`
NMOS page-wrap note are all correct and independently verified (bit-pattern derivation test,
all-256 length invariant against `LENGTH_FOR_MODE` rather than `entry.length`, and the real
ACME round-trip).

**Renderer/ACME fidelity (priority 2):** clean. The `!byte` substitution table, the `+2`
force, and the substitution-gating rules were all independently exercised against a real,
installed ACME (Suites A–D), including the two subtler failure modes the plan's own literal
wording missed (ACME resolving an ambiguous bare mnemonic to one canonical byte per group;
a 4-hex-digit literal already forcing word width independent of `+2`). No further defects
found.

**Derived-tool seam (priority 3):** clean and structurally sound, not merely conventional
— confirmed above.

**Input validation at the tool boundary (priority 4):** clean at the `vice_disassemble`
tool boundary itself (`parseAddress()`/`parseByteCount()` reject out-of-range, negative,
non-integer, and non-numeric input correctly, including symbolic-name refusal wording).
One gap exists one layer down, in the pure `decode()` library itself — see WR-01.

**Test quality (priority 5):** no fifth tautological-test pattern found. Every
independent-ground-truth mechanism this phase's own summaries describe (the bit-pattern
derivation, the `LENGTH_FOR_MODE`-based length invariant, Suite C/D's corrected wording) was
re-verified by execution against the real, installed opcode table/ACME, not just re-read.
Fixture construction throughout consistently calls `decode()`/`render()` on real opcode
bytes rather than hand-building `Instruction` literals (`disasm-renderer.test.ts` explicitly
asserts this via a `grep`).

**Resource handling in the round-trip test (priority 6):** clean. `assemble()` uses
`spawnSync` with an argv array (never a shell string — no injection surface even though the
rendered listing is fed to it), writes to a lazily-created `mkdtempSync` directory, and an
`after()` hook removes it recursively. No leaked child processes (synchronous spawn) or
temp files across a normal run.

## Warnings

### WR-01: `decode()` accepts a `startAddress` outside the valid 16-bit address space and silently wraps it, rather than rejecting it

**File:** `.claude/mcp/vice/disasm-decoder.ts:88-95, 124-126`
**Issue:** `isNonNegativeSafeInteger()` — the shared narrowing used for `startAddress`,
`opts.count`, and `opts.end` — only checks `Number.isSafeInteger(value) && value >= 0`. It
has no upper bound, so a `startAddress` far outside the legal `0..0xffff` C64 address space
is accepted as valid and then silently reduced via `(startAddress + offset) & 0xffff`. This
is inconsistent with `stock-address.ts`'s `parseAddress()` (`inAddressRange()` strictly
enforces `0..0xffff`), which is the only thing currently preventing this from being reachable
via the `vice_disassemble` tool. Confirmed by direct execution, not just by reading:

```
$ node -e 'import("./disasm-decoder.ts").then(({decode}) => {
  console.log(decode(new Uint8Array([0xea, 0xea]), 0x1FFFF, {}));
});'
[
  { address: 65535, bytes: [234], opcode: 234, mnemonic: "nop", ... },
  { address: 0,     bytes: [234], opcode: 234, mnemonic: "nop", ... }
]
```

`0x1FFFF` (131071) is nonsense as a C64 address, yet `decode()` returns two perfectly
plausible-looking instructions at `$FFFF`/`$0000` with no note or error indicating the input
was out of range. The module's own header states its `decode()` "never throws" and treats
malformed input as absent/empty, but an out-of-range (as opposed to negative/non-integer)
`startAddress` is neither rejected nor flagged — it is silently *used*, just wrapped. This
matters specifically because the module's own doc comments name **two future direct
consumers that import this file without going through `stock-address.ts`'s `parseAddress()`
at all** — Phase 5's backtrace (DERIV-02) and Phase 6's CPU-history decode (GAIN-01). A bug
in either of those call sites that produces an out-of-range address (e.g. an off-by-one in a
16-bit-plus-carry computation) would not surface as an error here; it would silently produce
a wrapped, plausible-looking disassembly at the wrong address, which is a much harder defect
to notice or debug than an outright refusal would be. `disasm-decoder.test.ts`'s own
"never throws" suite tests negative and non-integer `startAddress` but has no case for an
in-range-but-too-large one, so this gap has no test coverage either.
**Fix:** Either (a) reject `startAddress > 0xffff` in `decode()` itself (returning `[]`,
consistent with the existing negative/non-integer handling), or (b) if unbounded
`startAddress` is intentionally left to the caller's discretion (e.g. for a future consumer
that wants modular arithmetic on purpose), say so explicitly in the header comment next to
Rule 2, and add a `disasm-decoder.test.ts` case asserting the wrap is deliberate rather than
an oversight. Given this module's own stated ethic ("never fabricate", "a wrong length here
silently desynchronises everything downstream"), (a) is the more consistent choice:
```ts
function isValidStartAddress(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 0xffff;
}
```

## Info

### IN-01: Operand-text formatting is duplicated between `disasm-renderer.ts` and `stock-disassemble.ts`

**File:** `.claude/mcp/vice/stock-disassemble.ts:57-109` vs. `.claude/mcp/vice/disasm-renderer.ts:103-111, 160-222`
**Issue:** `hex2()`/`hex4()` and the per-addressing-mode operand-text switch are implemented
twice with identical formatting rules (documented in both files' comments as a deliberate
trade-off to avoid reopening the already-committed, already-tested renderer module mid-phase).
This is a style/maintainability observation, not a functional defect — I verified the two
implementations currently produce textually identical operand strings for every addressing
mode. The risk is purely future drift: if `disasm-renderer.ts`'s operand formatting is ever
changed (e.g. a spacing or casing tweak), `stock-disassemble.ts`'s `instructions[].operand`
field will silently diverge from `listing`'s own operand text with no test forcing the two
back into agreement.
**Fix:** Not urgent given the documented rationale; if `disasm-renderer.ts` is ever reopened,
consider exporting a operand-text-only primitive from it (e.g. splitting
`renderMnemonicOperand()`'s value formatting out) so both call sites share one
implementation. Alternatively, add a differential test asserting the two modules' operand
text agrees for every addressing mode, so a future divergence fails loudly instead of
silently.

### IN-02: `render()`'s symbol collection has no duplicate-name detection

**File:** `.claude/mcp/vice/disasm-renderer.ts:284-291`
**Issue:** `render()` collects substituted symbols into `symbols.set(symbol.name, symbol.address)`.
If a future symbol resolver (Phase 5's DERIV-04 store) ever returns the *same name* for two
*different* addresses within one listing (a resolver-side bug, e.g. two overlapping ranges),
the second occurrence silently overwrites the first in the `Map`, and the emitted single
`name = $XXXX` header definition will be wrong for whichever occurrence was written first.
Not reachable today (the resolver is `null` in this phase), so this is forward-looking only.
**Fix:** When Phase 5 installs a real resolver, consider asserting (in that phase's own
tests) that `symbolFor()` is injective per listing, or have `render()` warn/fall back to the
numeric form on a detected collision rather than silently keeping the last-seen address.

### IN-03: `decode()`'s `opts.count`/`opts.end` have no upper bound either, unlike `stock-disassemble.ts`'s own caller-side caps

**File:** `.claude/mcp/vice/disasm-decoder.ts:93-95`
**Issue:** Related to WR-01 but lower severity: `isNonNegativeSafeInteger()` also gates
`opts.count` and `opts.end`, and neither has an upper bound in the decoder itself. This is
harmless today — the loop is always bounded by `bytes.length`, so an absurdly large `count`
or `end` degrades to "no effective limit," not a crash or DoS — and matches the module's
documented "malformed treated as absent" philosophy for these two fields specifically
(unlike `startAddress`, which is actually *used* rather than defaulted). Noted for
completeness since it's the same helper function as WR-01; no fix required, just documenting
that this one is a non-issue by design, so a future reviewer doesn't need to re-derive that
conclusion.

---

_Reviewed: 2026-08-17T13:35:37Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
