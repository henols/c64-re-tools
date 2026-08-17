---
phase: 05-skill-critical-derived-tools
reviewed: 2026-08-17T19:00:05Z
depth: standard
files_reviewed: 28
files_reviewed_list:
  - .claude/mcp/vice/stock-memory-search.ts
  - .claude/mcp/vice/stock-memory-search.test.ts
  - .claude/mcp/vice/stock-symbols.ts
  - .claude/mcp/vice/stock-symbols.test.ts
  - .claude/mcp/vice/stock-vicii.ts
  - .claude/mcp/vice/stock-vicii.test.ts
  - .claude/mcp/vice/stock-cia.ts
  - .claude/mcp/vice/stock-cia.test.ts
  - .claude/mcp/vice/stock-sprites.ts
  - .claude/mcp/vice/stock-sprites.test.ts
  - .claude/mcp/vice/stock-handler.ts
  - .claude/mcp/vice/stock-handler.test.ts
  - .claude/mcp/vice/stock-derived.ts
  - .claude/mcp/vice/stock-derived.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/hostpath-consumers.test.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/tools-manifest.stock.json
  - scripts/check-skill-tool-coverage.mjs
  - scripts/check-npm-packages.mjs
  - .github/workflows/ci.yml
  - docs/stock-vice-parity.md
  - .claude/skills/c64-program-recon/references/tool-selection.md
  - .claude/skills/c64-program-recon/references/observation-hazards.md
  - .claude/skills/c64-program-recon/references/sound-and-input.md
  - .claude/skills/c64-program-recon/references/graphics.md
  - .claude/skills/c64-program-recon/references/control-flow.md
findings:
  critical: 2
  warning: 13
  info: 0
  total: 15
status: issues_found
---

# Phase 5: Code Review Report

**Reviewed:** 2026-08-17T19:00:05Z
**Depth:** standard
**Files Reviewed:** 28
**Status:** issues_found

## Summary

Eight derived tools were added to the stock backend across five new modules, plus
registration, manifest, CI-gate and doc changes. Baseline gates all pass in this
worktree: `tsc --noEmit` is clean, `node --test 'stock-*.test.ts' 'hostpath-consumers.test.ts'`
is 722 pass / 0 fail / 2 skipped, `scripts/check-skill-tool-coverage.mjs` exits 0.
The four registration surfaces are consistent: `STOCK_DERIVED_TOOLS` (9),
`STOCK_DISPATCH_TABLE` (34), `tools-manifest.stock.json` (34 entries with
`inputSchema`/`outputSchema`), and `package.json` `files[]` (all five new modules
present). Fork/stock `inputSchema` property sets and `required` lists are identical
for all eight tools, so D-03 argument compatibility holds. Criterion 3's
`{available:false, reason}` registries are genuinely built from `VICII_UNAVAILABLE_FIELDS`
/ `CIA_UNAVAILABLE_FIELDS` and pinned with `enum:[false]` in the manifest; no
enumerated internal-only field surfaces as `0`.

The bit decoding I could check by hand is correct: `$D011`/`$D016`/`$D018`/`$D019`/`$D01A`
field extraction, the 9-bit sprite-X and raster reconstruction, the CIA CRA/CRB bit
layout including the 2-bit `countSource`, the active-low joystick polarity, the
`3 - (raw & 3)` VIC-bank inversion, `screenBase`/`spriteDataAddress` (fixture-verified
against `dump-artifacts.mjs`: `$DD00=0xC1`, `$D018=0x31` → 35840), and the
multicolour bit-pair legend mapping.

**However, the whole DERIV-05/DERIV-06 family reads the wrong memory view.** All
four chip/sprite reads hardcode `bank: 0x0000`, which on stock VICE is the
`default`/`cpu` bank — the *current CPU banking configuration*, not the I/O
registers and not the RAM the VIC-II fetches. I verified this against a real
unpatched `/usr/bin/x64sc` (VICE 3.9) over the binary monitor: with `$01 = $34`
(I/O banked out — routine in depackers, loaders and demos, i.e. exactly this
milestone's audience), `MEM_GET` bank 0 over `$D000-$D02E` returns the RAM
underneath, which `decodeVicii()` then reports as fully-available VIC-II state
with no marker at all. That is the criterion-3 failure mode the phase was built
to prevent, arriving through the address argument instead of through the
`unavailable` registry. Two BLOCKERs below, plus thirteen warnings covering an
outputSchema violation on a documented input form, CIA port decoding that ignores
the keyboard-matrix column drive, unvalidated BCD, a misleading ASCII legend,
misleading skill/refusal text about `mode:'ranges'`, three tests that cannot fail
or that under-test their own titles, and assorted dead code.

## Critical Issues

### CR-01: All chip-state reads use the CPU-view bank, so RAM/char-ROM is silently decoded as VIC-II/CIA registers

**File:** `.claude/mcp/vice/stock-vicii.ts:277`, `.claude/mcp/vice/stock-cia.ts:339`, `.claude/mcp/vice/stock-sprites.ts:230`

**Issue:** Every read hardcodes `bank: 0x0000`. `BANKS_AVAILABLE` on real stock
VICE 3.9 reports `[{id:0,"default"},{id:0,"cpu"},{id:1,"ram"},{id:2,"rom"},{id:3,"io"},{id:4,"cart"}]`
— bank 0 is the *CPU view*, which follows `$00`/`$01` banking. Verified live
against `/usr/bin/x64sc` (VICE 3.9) over `-binarymonitor`:

```
# default banking ($01 = $37)
D020 bank0: fe   bankIO: fe   bankRAM: ff

# after MEM_SET $01 = $34 (I/O banked out)
D020 bank0: ff   bankIO: fe   bankRAM: ff
VICblock bank0  = ffff00000000ffffffff00000000ffffffff...   <- RAM under I/O
VICblock bankIO = 00000000000000000000000000000000001b...   <- real registers
```

`decodeVicii()` on that first buffer yields `borderColour: 15`,
`spriteEnabled: [true x8]`, a plausible `rasterLine`, a plausible
`memorySetup`, `interruptStatus.anyIrqPending: true` — all reported as
*available*, with `unavailable` carrying only the six internal-only fields. The
answer is indistinguishable from a real read. Same for `vice_cia_get_state`
(`$DC00`/`$DD00`) and for `vice_sprite_get`/`vice_sprite_inspect`'s `$DD00` read,
which feeds the VIC-bank number and therefore every derived address in the
answer. A game running with `$01 = $34` (or `$35`, common in loaders and IRQ
depackers) makes every one of these tools return fabricated state. `stock-memory.ts`
already built and exported the bank seam for exactly this reason
(`bankCatalogFor()`, `resolveBank()`); the derived modules bypass it.

**Fix:** resolve the `io` bank id from the emulator's own catalog and read through
it; never assume the wire id. Refuse rather than guess if the catalog has no `io`
entry, and state the bank on the answer so the caller can see which view was read.

```ts
// stock-vicii.ts / stock-cia.ts / stock-sprites.ts's $DD00 read
import { bankCatalogFor } from "./stock-memory.ts";

async function ioBankId(toolName: string, session: StockConnectSession): Promise<number | StockErrorResult> {
  let catalog;
  try {
    catalog = await bankCatalogFor(session);
  } catch (err) {
    return convertWireError(toolName, err);
  }
  const id = catalog.byName.get("io");
  if (id === undefined) {
    return isErrorText(
      `${toolName}: this VICE build's BANKS_AVAILABLE catalog has no "io" bank ` +
        `(${[...catalog.byId.values()].join(", ")}) -- refusing rather than reading the ` +
        `banking-dependent CPU view, which returns the RAM under $D000-$DFFF whenever the ` +
        `running program has I/O banked out ($01 bit 2 / bits 0-1).`,
    );
  }
  return id;
}
// ...
const body = memGetBody({ sidefx: false, start: VICII_BASE, end: VICII_END, memspace: 0x00, bank: ioBank });
```

Add `bank: "io"` to each answer payload and to the manifest `outputSchema`, and add
a live case to `stock-live.test.ts` that sets `$01 = $34` and asserts the answer
still reports real register values (see WR-06).

### CR-02: Sprite/screen reads also use the CPU-view bank, so a resolved address in `$D000-$DFFF` returns I/O registers instead of the RAM the VIC-II fetches

**File:** `.claude/mcp/vice/stock-sprites.ts:272` (pointer table), `.claude/mcp/vice/stock-sprites.ts:546` (sprite data), `.claude/mcp/vice/stock-sprites.ts:124-137` (`spriteRomWindowNote`)

**Issue:** The VIC-II never sees I/O or cartridge ROM — it sees RAM (plus the
char-ROM window in banks 0 and 2). The pointer-table and sprite-data reads use
`bank: 0x0000`, the CPU view. In VIC bank 3 (`$C000-$FFFF`) the absolute range
`$D000-$DFFF` is the I/O area from the CPU's side, so a screen at `$CC00`
(pointer table `$CFF8`) with pointers into `$D000+` — or sprite data placed under
I/O, a standard trick to reclaim 4 KB — is read back as CIA/VIC/colour-RAM
register bytes and rendered as a sprite. Verified live: `$D020` returns `fe`
through bank 0 and `ff` through bank `ram`, i.e. the two views genuinely differ
at the addresses in question.

`spriteRomWindowNote()` shows the author reasoned about exactly this class of
hazard for the char-ROM window (`$1000-$1FFF` in banks 0 and 2) but there is no
equivalent for the I/O window, and — unlike the char-ROM case, where the CPU view
happens to return the same RAM the note warns about — here the returned bytes are
genuinely from a different device.

**Fix:** read the pointer table and the sprite data through the `ram` bank id
resolved from `bankCatalogFor()` (the VIC-II's own view), and keep the char-ROM
note for banks 0/2 since `ram` still cannot show char ROM. Then add the missing
window note:

```ts
/** Banks 0 and 2: $1000-$1FFF is the char-ROM window (chip sees ROM, we read RAM).
 *  Bank 3: $D000-$DFFF is the I/O window from the CPU's side -- reading it through
 *  the `ram` bank is what the chip actually fetches; reading it through `default`
 *  returns registers instead. */
function spriteWindowNote(address: number, bank: number): string | null { /* ... */ }
```

Add a unit case with a pointer resolving into `$D000-$DFFF` in bank 3 asserting
both the correct bank on the wire body and the note's presence.

## Warnings

### WR-01: `vice_symbols_lookup` violates its own declared `outputSchema` on a documented, unit-tested input form

**File:** `.claude/mcp/vice/stock-symbols.ts:380`, `.claude/mcp/vice/tools-manifest.stock.json` (`vice_symbols_lookup.outputSchema.properties.query.properties.address`)

**Issue:** `payload.query = { address: args.address }` echoes the **raw**
argument, while the schema declares `query.address` as `type: "number"`.
`parseAddress()` accepts `"$d020"` / `"0xd020"`, and
`stock-symbols.test.ts:341-357` explicitly tests those forms. Reproduced:

```
answer:     {"query":{"address":"$d020"},"found":true,...}
violations: ["$.query.address: expected type \"number\", got string"]
```

The `conformance (D-02)` gate in `stock-dispatch.test.ts` would catch this, but
its `vice_symbols_lookup` case only calls `{ name: "main" }` — the `address`
branch is never schema-checked, so the gate passes vacuously for this path.

**Fix:** echo the parsed value, not the raw one, and add the missing conformance
case.

```ts
const payload: Record<string, unknown> = { query: { address }, found: name !== undefined, symbolCount: loadedSymbolCount };
```

### WR-02: CIA1 port A/B joystick decoding ignores the keyboard-matrix column drive that shares the same pins

**File:** `.claude/mcp/vice/stock-cia.ts:155-197`

**Issue:** `$DC00`/`$DC01` are the keyboard matrix column-select / row-read pair
*and* joystick 2 / joystick 1. With `DDRA = $FF` (the normal KERNAL state) a read
of `$DC00` returns the column latch the scan last wrote; with a column driven low,
`$DC01`'s row bits read as pressed keys. `decodeCia()` reports `joystick2`/
`joystick1` as five plain booleans with no caveat, and it *already has* the DDR
bytes in the same 16-byte buffer (`portADirection`/`portBDirection`) but does not
consult them. Because every stock read halts the machine at an arbitrary PC —
often inside the IRQ keyboard scan — a low column bit decodes as a phantom
direction press. Verified live at the BASIC prompt with no input:
`$DC00..$DC03 = 7f ff ff 00` — bit 7 of `$DC00` is the column latch, not a
joystick line, so the byte demonstrably carries non-joystick content.

This is the same "plausible-looking value where the truth is unavailable" class
criterion 3 targets, and the module's own header explicitly lists the CIA's
read/write aliases while omitting this one.

**Fix:** add a `notes: string[]` to each chip entry (the precedent already exists
in `stock-sprites.ts`) and emit a note whenever `portADirection` shows output bits
on CIA1, naming the aliasing; alternatively wrap `joystick1`/`joystick2` as
`{ value, confounded: boolean, reason }`. Declare the new field in the manifest
`outputSchema`.

### WR-03: `fromBcd()` accepts non-BCD nibbles and reports impossible TOD values; the CIA1 fixture makes the tens-digit path pass by coincidence

**File:** `.claude/mcp/vice/stock-cia.ts:113-115`, `.claude/mcp/vice/stock-cia.test.ts:68,148-156`

**Issue:** `fromBcd(0x9f)` returns `9*10 + 15 = 105`, emitted as
`tod.seconds: 105` with no marker. Separately, the fixture's hours byte is `0x8b`
— low nibble `0xb`, not valid BCD. `fromBcd(0x8b & 0x1f) = fromBcd(0x0b) = 0*10 + 11 = 11`,
so `assert.equal(tod.hours, 11)` passes without ever exercising the tens digit
(bit 4). A real 11 PM is `0x91`. The regression this test claims to guard —
"a raw pass-through would give seconds:66, not 42" — is only actually proven for
seconds/minutes.

**Fix:** validate both nibbles and mark the field rather than emitting an
impossible number; change the fixture to a valid BCD hours byte so the tens digit
is covered.

```ts
function fromBcd(raw: number): number | null {
  const tens = (raw >> 4) & 0x0f, units = raw & 0x0f;
  return tens > 9 || units > 9 ? null : tens * 10 + units;
}
// hours: 0x91 -> 11 PM (tens digit exercised); report null as
// { available: false, reason: "$xx0B held 0x8b, which is not valid BCD" }
```

### WR-04: `vice_sprite_inspect` returns the multicolour bit-pair legend for hi-res renders, where it does not apply

**File:** `.claude/mcp/vice/stock-sprites.ts:74-75,603`, `.claude/mcp/vice/stock-sprites.test.ts:318`

**Issue:** `SPRITE_ASCII_LEGEND` describes four bit-*pair* mappings
(`'.'`=00, `'#'`=10, `'@'`=01, `'%'`=11). For a hi-res sprite `renderSpriteAscii()`
emits one character per **bit** — only `'#'` and `'.'`, where `'#'` means "bit
set", not "%10" — yet the same legend is attached whenever `format === "ascii"`.
An agent reading a hi-res grid is told `'@'` and `'%'` exist and that `'#'` means
a two-bit code. `stock-sprites.test.ts:318` asserts
`parsed.legend === SPRITE_ASCII_LEGEND` on hi-res sprite 0, pinning the wrong
behaviour.

**Fix:** two legends, selected on `multicolour`.

```ts
export const SPRITE_ASCII_LEGEND_HIRES = "'.' = transparent (bit clear), '#' = sprite colour (bit set)";
export const SPRITE_ASCII_LEGEND_MULTICOLOUR = "'.' = transparent (00), '#' = sprite colour (10), '@' = multicolour 1 (01), '%' = multicolour 2 (11)";
// ...
legend: multicolour ? SPRITE_ASCII_LEGEND_MULTICOLOUR : SPRITE_ASCII_LEGEND_HIRES,
```

### WR-05: The `mode:'snapshot'` refusal text and the new skill text both promise a time-dimension `mode:'ranges'` does not have

**File:** `.claude/mcp/vice/stock-memory-search.ts:242-243`, `.claude/skills/c64-program-recon/references/control-flow.md:164-166`

**Issue:** Both say to "compare two live ranges captured at different points in
time". `handleMemoryCompare()` issues both `MEM_GET`s inside one call against one
halted machine (its own comment at lines 305-308 says exactly that). It compares
two *addresses* at one *time*; there is no mechanism to capture range 1 now and
compare it later, and no tool in the milestone copies a range to a scratch buffer.
An agent following the refusal message's advice will produce a meaningless diff
and read it as a state comparison. This is agent-facing text on the error path, so
it is the wording most likely to be acted on.

**Fix:** say what the tool does. e.g. "`mode:'ranges'` compares two *different
address ranges* in the same halted machine — it cannot compare one range across
time. To compare a range before and after, use `vice_memory_read` twice and diff
client-side, or the `c64-ram-capture` skill's full-image diff." Update
`control-flow.md` to match.

### WR-06: No live-emulator coverage for any of the eight new tools

**File:** `.claude/mcp/vice/stock-live.test.ts` (unchanged by this phase)

**Issue:** The opt-in live harness still contains only its two Phase-3 register
cases; all 34 new/changed tests are stub-driven (`EventEmitter` + a `send` spy).
Those stubs assert wiring faithfully — call order, byte-level body contents,
short-read refusals — but they cannot see what the emulator actually returns for
a given request, which is precisely how CR-01 and CR-02 got through: the bodies
are exactly as intended, and the intent is wrong. One live case per chip tool,
run against `/usr/bin/x64sc`, would have failed immediately.

**Fix:** add live cases guarded by the existing `VICE_LIVE_STOCK_BIN` opt-in:
(a) `vice_vicii_get_state` on a booted machine asserting `borderColour === 14`
and `backgroundColour === 6` (the KERNAL defaults); (b) the same after
`MEM_SET $01 = $34`, asserting the answer still reports those values (the CR-01
regression); (c) `vice_sprite_get` asserting `screenBase === 1024` and
`pointerTableAddress === 2040` on a default machine.

### WR-07: `stock-sprites.ts` re-derives constants and sprite decoding that `stock-vicii.ts` already exports

**File:** `.claude/mcp/vice/stock-sprites.ts:58-60,359-379,527-534`

**Issue:** `VICII_BASE`/`VICII_END`/`VICII_LENGTH` are redeclared as private
literals even though `stock-vicii.ts:77-81` exports all three, and the per-sprite
`enabled`/`x`/`y`/`colour`/`multicolour`/`expandX`/`expandY`/
`priorityBehindBackground` extraction duplicates `decodeVicii()`'s
`spriteEnabled`/`spriteX`/`spriteY`/`spriteColour`/`spriteMulticolour`/
`spriteExpandX`/`spriteExpandY`/`spritePriorityBehindBackground` bit-for-bit, in
a third and fourth place (`handleSpriteGet` and `handleSpriteInspect` each carry
their own copy of the eight `bytes[0xdNNN - VICII_BASE]!` lookups). This is the
codebase's own named "re-deriving a cross-cutting seam locally" anti-pattern, and
`VICII_LENGTH = 0x2f` is a magic literal where the sibling derives it from base
and end.

**Fix:** `import { VICII_BASE, VICII_END, VICII_LENGTH, decodeVicii } from "./stock-vicii.ts";`
and build both sprite answers from `decodeVicii()`'s already-decoded per-sprite
arrays; keep only the pointer-chain arithmetic local to this module.

### WR-08: `vice_symbols_load`'s path containment is check-then-use, and the reported `resolvedPath` is not the canonical path

**File:** `.claude/mcp/vice/stock-symbols.ts:129-146,279,289`

**Issue:** `resolveLabelFilePath()` computes `real = realpathSync(resolved)`,
asserts containment on `real`, then **returns `resolved`** — the non-canonical
path. `statSync(resolvedPath)` and `readFileSync(resolvedPath)` then re-traverse
symlinks, so the escape check is advisory: anything that can replace a symlink
component between the check and the read is read from outside the workspace. The
answer's `resolvedPath` is likewise the pre-canonicalisation string, so the
end-to-end test at `stock-dispatch.test.ts` asserting `resolvedPath` stays
container-side is checking the un-resolved value.

**Fix:** return and use `real` everywhere after the check, and report it.

```ts
  return real;   // canonical, containment-checked; stat/read/report all agree
```

### WR-09: `truncated` is set on an exact-boundary result, and `identical`'s `!truncated` conjunct is dead

**File:** `.claude/mcp/vice/stock-memory-search.ts:195-198,357-360,375`

**Issue:** `if (matches.length === maxResults) { truncated = true; break; }` fires
after pushing the last allowed match, without ever establishing that another match
exists. A range with exactly `max_results` matches reports `truncated: true`, so a
caller that re-searches on `truncated` loops for nothing and cannot tell a complete
result from a clipped one. Same in the compare loop. Separately,
`identical: differences.length === 0 && !truncated` — when `truncated` is true
`differences.length === maxDifferences >= 1` (`parseByteCount` refuses 0), so the
conjunct can never change the value.

**Fix:** keep scanning far enough to know, or rename the flag honestly.

```ts
if (matches.length === maxResults) { truncated = offset < bytes.length - pattern.length; break; }
// ...
identical: differences.length === 0,
```

### WR-10: Three tests cannot fail, or do not test what their titles claim

**File:** `.claude/mcp/vice/stock-derived.test.ts:60-113`, `.claude/mcp/vice/stock-sprites.test.ts:253-262`

**Issue:**
1. `"D-02 mechanism 1: a derived handler receives the container path verbatim"`
   wraps a synthetic handler in `withDerivedTool()` and asserts the args arrive
   unchanged. `withDerivedTool()` (`stock-dispatch.ts:491-520`) forwards `args`
   by reference and has no reference to `rewriteArguments` at all, so the
   assertion is structurally unfailable. The stated risk — that `vice-proxy.ts`
   routes a derived tool through `forwardToVice()`, which *does* call
   `rewriteArguments()` at line 2773 — is never exercised: nothing in the test
   touches `vice-proxy.ts`'s routing. The `hostPath()` non-vacuity control only
   proves translation *would* differ, which says nothing about whether the real
   dispatch order bypasses it.
2. `"handleSpriteGet: a wrong response type on any of the three reads is refused"`
   replaces `send` with a function that returns `{type:"wrong_type"}` for *every*
   call, so only the **first** read's guard is reached; reads 2 and 3 are never
   exercised. `void original;` at line 261 is dead — the original `send` is
   captured and discarded, never restored.

**Fix:** (1) assert the routing property where it lives — extend the existing
`VICE_PROXY_CODE_LINES` structural assertion in `stock-dispatch.test.ts` to prove
the derived branch precedes the `forwardToVice(` call site, or drive a real
`tools/call` through `vice-proxy.ts` with `VICE_BACKEND=stock`. (2) Parameterise
the sprite test over which of the three reads returns the wrong type:

```ts
for (const failAt of [1, 2, 3]) {
  test(`handleSpriteGet: a wrong response type on read ${failAt} is refused`, async () => { /* count calls, fail only on `failAt` */ });
}
```

### WR-11: Dead code across the new modules and the new CI script

**File:** `.claude/mcp/vice/stock-symbols.ts:215,314`, `.claude/mcp/vice/stock-derived.ts:66-135`, `.claude/mcp/vice/stock-sprites.ts:262-270,539-544`, `scripts/check-skill-tool-coverage.mjs:25,42,54`

**Issue:**
- `loadedPath` is assigned (line 314) and cleared (line 236) but never read
  anywhere in the codebase — write-only module state, and it is not on the answer
  either.
- `derivedContainerPath()` and `DerivedToolError` have **zero production callers**
  (only `stock-derived.test.ts`), and no `STOCK_DERIVED_TOOLS` member takes a path
  argument. The file's header calls it "the ONE named seam a derived tool routes an
  output path through"; nothing routes through it, so the seam is currently
  decorative and its refusal branch can never fire in production.
- The two `> 0xffff` refusals in `stock-sprites.ts` are unreachable:
  `pointerTableEnd` maxes at `49152 + 15*1024 + 0x3ff = 65535` and `dataEnd` at
  `49152 + 255*64 + 62 = 65534`. `stock-sprites.test.ts:407-426` documents the
  bound is never crossed. They read as live guards.
- `statSync` is imported and never used (line 25); `walkSkills`'s third parameter
  `dirsSeen` is always `null` and never read (lines 42, 54); the recursive call's
  return value is discarded while the function also returns `acc`.

**Fix:** delete `loadedPath` or put it on the answer as `loadedFrom`; either give
`derivedContainerPath()` its first production caller or delete it with its error
class and the tests that only exercise it; convert the two address guards into
`assert`-style internal invariants with a comment stating they are unreachable by
construction; drop the unused import and parameter.

### WR-12: The new skill/doc text warns about the small hazard and is silent on the large one, and overstates the side-effect proof

**File:** `.claude/skills/c64-program-recon/references/observation-hazards.md:83-87`, `docs/stock-vice-parity.md:64-77`

**Issue:** The new paragraph tells agents "an internal field the register map
cannot expose is marked `{ available: false, reason }` ... never a bare `0` — do
not record a stock `0` from one of these fields as a measurement; check
`available` first." That is true for the eleven enumerated fields and useless
against CR-01, where *every* field is `available` and wrong. Nothing in the skill
or the parity doc tells the reader that a stock chip-state answer is only valid
while the program has I/O banked in.

Separately, both files upgrade the side-effect claim from the skill's existing
"unverified" to "**provably** side-effect-free ... a stronger guarantee than
'unverified', not merely a smaller risk", citing as evidence "asserted directly on
the wire body by a regression test". The tests assert only that `body[0] === 0x00`
— a client-side fact about what is *sent*. Whether stock VICE's `MEM_GET`
honours `side_effects = 0` for `$D01E`/`$D01F`/`$DC0D`/`$DD0D` is an emulator
property with no cited source or probe in the repo. (My own live probe was
consistent with the claim — a repeated `sidefx:false` read of `$D01E` did not
clear it — but the repo's evidence chain does not establish it, and this project's
convention is to mark such claims VERIFIED vs ASSUMED explicitly.)

**Fix:** add the banking hazard to `observation-hazards.md` alongside the
`available` note, and downgrade "provably" to the accurate claim ("`sidefx:false`
is hardcoded with no override; whether the emulator's read path honours it for
`$D01E`/`$D01F`/`$DC0D`/`$DD0D` is ASSUMED, pending a recorded probe") or add the
probe to `stock-live.test.ts` and cite it.

### WR-13: Stale planner comment now contradicts the shipped scope

**File:** `.claude/mcp/vice/stock-dispatch.ts:558`

**Issue:** The deliberately-not-registered list still reads
`- \`vice_disk_read_sector\` (Phase 5)`. Phase 5 has landed without it, and
`docs/stock-vice-parity.md` (this diff) now records it as **CUT from scope
2026-08-17**. The two files disagree about whether the omission is pending or
permanent, and `stock-dispatch.test.ts`'s `DELIBERATELY_ABSENT_TOOL_NAMES`
carries the same stale annotation.

**Fix:** change to `- \`vice_disk_read_sector\` (CUT from scope 2026-08-17 -- no
skill calls it; see ROADMAP.md "Cut from scope (v0.2.0, 2026-08-17)")` and mirror
it in the test's comment.

---

_Reviewed: 2026-08-17T19:00:05Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
