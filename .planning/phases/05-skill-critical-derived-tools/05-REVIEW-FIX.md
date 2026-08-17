---
phase: 05-skill-critical-derived-tools
fixed_at: 2026-08-18T00:00:00Z
review_path: .planning/phases/05-skill-critical-derived-tools/05-REVIEW.md
iteration: 1
findings_in_scope: 7
fixed: 7
skipped: 9
status: all_fixed
---

# Phase 5: Code Review Fix Report

**Fixed at:** 2026-08-18
**Source review:** `.planning/phases/05-skill-critical-derived-tools/05-REVIEW.md`
**Iteration:** 1
**Scope:** the orchestrator's narrowed set — CR-01, WR-01, WR-04, WR-02, WR-05, WR-03, WR-06

**Summary:**
- Findings in scope: 7
- Fixed: 7 (one atomic commit each)
- Skipped: 9 (WR-07..WR-11, IN-01..IN-04 — all out of the narrowed scope)

## Hard gates (baseline held)

| Gate | Baseline (on `main`, before) | After |
|------|------------------------------|-------|
| `npm run typecheck` | clean | clean |
| `npm run test:automated` | 1391 tests / 1386 pass / **0 fail** / 5 todo | 1426 tests / 1421 pass / **0 fail** / 5 todo |
| Stock manifest tool count | 34 | 34 |
| Fork manifest tool count | 62 | 62 |
| `package.json` `files[]` | 44 | 44 |
| `STOCK_DERIVED_TOOLS` size | 9 | 9 |
| `check-skill-tool-coverage.mjs` | exit 0 | exit 0 |
| `resources-sync.test.ts` | pass | pass (no `.mts` touched) |
| Manual-only live gate (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test stock-live.test.ts`) | 7/7 | **10/10** (three new live cases: WR-01, WR-03, WR-06) |
| D-03 fork/stock `inputSchema` parity test | pass | pass |

35 net new automated tests; no test deleted except the one vacuous case WR-04 was about
(replaced by four non-vacuous ones) and the one WR-03 case that asserted the over-flagging
behaviour being fixed (replaced by nine).

## Fixed Issues

### CR-01: `tod.tenths` fabricated an impossible decimal from a non-BCD nibble

**Files modified:** `.claude/mcp/vice/stock-cia.ts`, `.claude/mcp/vice/stock-cia.test.ts`,
`.claude/mcp/vice/tools-manifest.stock.json`
**Commit:** `ecafe21`

`tenths` now goes through the same hardened `fromBcd()` and the same
omit-plus-name-in-`invalidBcd` path as its three siblings, pushing a note naming `$xx08` and the
raw byte; `tenths` drops out of `tod.required` in the stock manifest. Four new cases: the
reviewer's `0x0f` repro, a full `0x0a`–`0x0f` refusal / `0x00`–`0x09` accept sweep, proof the
unused high nibble does not invalidate (`0xf5` → 5), and an all-four-invalid case pinning the
register-order `invalidBcd` list plus the surviving `pm`/`rawHex` escape hatch.

### WR-01: `vice_memory_banks` dropped any bank sharing a wire id

**Files modified:** `.claude/mcp/vice/stock-memory.ts`, `.claude/mcp/vice/stock-memory.test.ts`,
`.claude/mcp/vice/stock-live.test.ts`
**Commit:** `11e49bf`

`BankCatalog` gains `entries` (every wire pair, in wire order, aliases included); `byId` is
documented as lossy-by-construction and is now first-name-wins for a stable reverse lookup.
`handleMemoryBanks`, `resolveRequiredBank`'s "available banks: ..." refusal list, and the
echoed `name` all read `entries` — and the echo is the wire spelling of the name the *caller*
asked for, so asking for `default` no longer answers `cpu`. Five unit cases (including an
explicit non-vacuity check that the live-derived fixture really carries an aliased id) plus a
live case asserting `count === banks.length`, that `default`/`cpu` share one id, and that
**every** reported name resolves through `vice_memory_read` and echoes back unchanged.

Live: `vice_memory_banks` now answers all 6 pairs
(`default`/`cpu`/`ram`/`rom`/`io`/`cart`), `count: 6`.

### WR-04: the sprite three-response-type-guard test was strictly vacuous

**Files modified:** `.claude/mcp/vice/stock-sprites.test.ts`
**Commit:** `254324a`

Parameterised over which of the three memory reads fails, answering `BANKS_AVAILABLE` normally
throughout, so each guard is genuinely reached. `assert.equal(memGets, failAt)` is the
anti-vacuity pin. The catalog failure keeps its own case — with its own call log, because
replacing `send` outright means `makeSpriteSession()`'s `calls` array is never reached and
asserting on it would itself be vacuous. `void original;` deleted.

### WR-02: hazard notes emitted for sprites absent from the answer, with no attribution

**Files modified:** `.claude/mcp/vice/stock-sprites.ts`, `.claude/mcp/vice/stock-sprites.test.ts`
**Commit:** `8b149c3`

The per-sprite note loop moved *after* the narrowing and now runs only over the sprites the
answer returns; every note is prefixed `sprite N: `. `handleSpriteInspect` emits the identical
attributed string, so the two tools agree verbatim for one sprite's hazard. Five cases on a
fixture where only sprite 5 is hazardous, including two sprites sharing one hazardous address
producing two separately-attributed notes (an address-keyed dedupe would collapse them).

### WR-05: `resolveLabelFilePath` compared a realpath against a non-realpath root

**Files modified:** `.claude/mcp/vice/stock-symbols.ts`, `.claude/mcp/vice/stock-symbols.test.ts`
**Commit:** `5d1eaa2`

The comparison is canonicalised on both sides (`realpathSync(repoRoot())`, falling back to the
resolved spelling if the root itself cannot be canonicalised). **WR-08 is preserved verbatim:**
the function still returns the same canonical `real` it containment-checked, and the
returned-path regression guard still passes. Three cases on a workspace root that *is* a
symlink (with that precondition asserted, since `mkdtempSync(tmpdir())` is real on Linux CI):
an in-workspace file loads and reports the canonical path, a symlink escape is still refused
naming the resolved target, and a `../` escape is still refused.

Verified non-vacuous by temporarily restoring the old comparison: the new "loads" case fails
while **both** escape controls still pass — i.e. the check was canonicalised, not weakened.

### WR-03: the CIA `confounded` flag could not discriminate, and ignored DDRB

**Files modified:** `.claude/mcp/vice/stock-cia.ts`, `.claude/mcp/vice/stock-cia.test.ts`,
`.claude/mcp/vice/stock-live.test.ts`, `.claude/mcp/vice/tools-manifest.stock.json`
**Commit:** `62518fe`

The predicate is now per-read-actual and per-bit: a direction is confounded **iff** it reads
LOW *and* either (a) its own pin is an output currently driving low, or (b) the *other* port is
driving a matrix line low, so a pressed key could be shorting this pin to it. A bit reading
HIGH is never confounded. `confoundedDirections` (always present, empty when clean, declared and
required in the manifest) names *which* directions are suspect; the reason names the cause per
port with the correct DDR. The five booleans are still annotated, never altered — WR-02's
honesty intent is preserved, and honesty now includes not crying wolf.

Nine cases, including the reviewer's live byte string asserted clean, `DDRA=$ff/PRA=$ff` clean
vs `DDRA=$ff/PRA=$fe` confounded on `up` only, an input pin reading low being genuine
(`DDRA=0x01`) while the same bit on a driven output is not (`DDRA=0x10`), a `DDRB=$f0` case
proving `joystick1` consults its own DDR, and a three-case discrimination check.

**Live-verified** (new case): a freshly-booted machine (`$DC00 = 0x7F`, `DDRA = $FF`) is now
reported clean on both joysticks with `notes: []`; driving `$DC00 = 0xfe` yields
`confounded: true`, `confoundedDirections: ["up"]`, and one note. `$DC00` is restored afterwards.

**One design choice beyond the review's suggested formula, flagged for human review.** The
review proposed `drivenLowMask(raw, ddr) = ddr & ~raw & 0x1f` per port, with
`joystick1.confounded = portAConfoundedBits !== 0 || portBConfoundedBits !== 0`. That masks the
column-select cause to bits 0–4, which would report `confounded: false` for a low port-B row bit
while a port-A column *outside* bits 0–4 (e.g. bit 7, as on the live booted machine) is driven
low — the phantom-press case WR-03 exists to catch. The implemented predicate therefore computes
the driven-low mask over all eight pins for the cross-port term while still only ever flagging
bits that actually read low. Both the review's live sample and the review's stated intent are
satisfied; the extra term is what a reviewer may want to re-confirm.

### WR-06: `memory_search`/`memory_compare` read literal wire bank `0x0000` invisibly

**Files modified:** `.claude/mcp/vice/stock-memory-search.ts`,
`.claude/mcp/vice/stock-memory-search.test.ts`, `.claude/mcp/vice/stock-memory.ts`,
`.claude/mcp/vice/tools-manifest.stock.json`, `.claude/mcp/vice/stock-live.test.ts`,
`docs/stock-vice-parity.md`
**Commit:** `e5cf367`

**The parity constraint did not bind, so the full fix was applied rather than the fallback.**
The D-03 contract enforced by `stock-dispatch.test.ts:167` is *equal required-argument sets*
plus *optional stock-only extras* — `vice_memory_read`'s `sideEffects` is the existing
precedent. Adding an optional `bank` therefore keeps parity, and that test passes unchanged
(verified). Nothing is deferred on this finding.

Both tools take the same optional `bank` argument `vice_memory_read` has, resolved through
`stock-memory.ts`'s one `resolveBank()` seam (now exported instead of re-derived), and both
answers carry `bank` in `vice_memory_read`'s own shape plus a plain-language `bankView` naming
the view that produced the bytes. `vice_memory_compare` applies the one bank to **both** ranges
(one halted machine — two views would be two different questions) with a single catalog round
trip; the default path costs no round trip at all. Recorded in `docs/stock-vice-parity.md`
alongside the other stock-only extras.

Eight unit cases plus a live case: `$E000` reads `0x85` through the CPU view and `0xff` through
`ram`, a search for the ROM byte matches through the default view and not through `ram`, and the
RAM-under-ROM byte — previously unreachable by this tool — is findable through `ram`.

## Skipped Issues

All nine are skipped for the same reason: **out of orchestrator-narrowed scope.** The review
marks WR-07..WR-11 as carried over from the prior review, plan 05-12 deliberately ruled them
out of gap closure, and widening the phase is against its brief; IN-01..IN-04 are Info.

### WR-07: `mode:'snapshot'` refusal and two docs promise a time dimension `mode:'ranges'` lacks

**File:** `.claude/mcp/vice/stock-memory-search.ts:242-243`,
`.claude/skills/c64-program-recon/references/control-flow.md:164`, `docs/stock-vice-parity.md:188-189`
**Reason:** out of orchestrator-narrowed scope.
**Note:** the WR-06 commit touched the same file and the same doc but left every one of these
three strings byte-for-byte unchanged, so the finding is unchanged and still applies as written.

### WR-08: `truncated` set on an exact-boundary result; `identical`'s `!truncated` conjunct dead

**File:** `.claude/mcp/vice/stock-memory-search.ts:195-198,357-360,375`
**Reason:** out of orchestrator-narrowed scope.
**Note:** still present verbatim after the WR-06 change, which only touched the bank plumbing
and the payload tail.

### WR-09: `stock-sprites.ts` re-derives constants and per-sprite decoding `stock-vicii.ts` exports

**File:** `.claude/mcp/vice/stock-sprites.ts:72-74,420-453,602-669`
**Reason:** out of orchestrator-narrowed scope.
**Note:** WR-02's fix removes the specific *divergence* the review called a consequence of this
duplication (the two handlers' note handling now produces identical strings), but the
duplication itself is untouched.

### WR-10: the D-02 derived-path test is structurally unfailable

**File:** `.claude/mcp/vice/stock-derived.test.ts:60-113`
**Reason:** out of orchestrator-narrowed scope.

### WR-11: dead code across the derived modules and the new CI script

**File:** `.claude/mcp/vice/stock-derived.ts:66-135`, `.claude/mcp/vice/stock-sprites.ts:332-342,614-620`,
`scripts/check-skill-tool-coverage.mjs:25,42,53,62`
**Reason:** out of orchestrator-narrowed scope.

### IN-01: the manifest pins `bank.name` to lowercase while `resolveRequiredBank` returns the wire spelling

**File:** `.claude/mcp/vice/tools-manifest.stock.json`, `.claude/mcp/vice/stock-memory.ts:172`
**Reason:** out of orchestrator-narrowed scope (Info).
**Note:** WR-01 changed which name is echoed (the requested alias's wire spelling rather than
`byId`'s), but it is still the *wire's* spelling, so this latent finding stands unchanged. Live
VICE 3.9 spells all bank names lowercase, so it remains latent.

### IN-02: `check-npm-packages.mjs`'s closure walk misses `export ... from` and side-effect imports

**File:** `scripts/check-npm-packages.mjs:118`
**Reason:** out of orchestrator-narrowed scope (Info).

### IN-03: the hostpath consumer gate only sees direct static imports

**File:** `.claude/mcp/vice/hostpath-consumers.test.ts:43`
**Reason:** out of orchestrator-narrowed scope (Info).

### IN-04: `sound-and-input.md` documents the joystick bits without mentioning `confounded`

**File:** `.claude/skills/c64-program-recon/references/sound-and-input.md:55-59,68-70`
**Reason:** out of orchestrator-narrowed scope (Info).
**Note:** WR-03 removes this finding's stated urgency ("Given WR-03 above, the flag is currently
always `true`") — the flag now discriminates — but the skill reference still does not mention
`confounded`/`confoundedDirections`/`invalidBcd`, so the documentation gap itself is unchanged.

---

_Fixed: 2026-08-18_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
