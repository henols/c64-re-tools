---
phase: 05-skill-critical-derived-tools
reviewed: 2026-08-17T21:49:46Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - .claude/mcp/vice/hostpath-consumers.test.ts
  - .claude/mcp/vice/package.json
  - .claude/mcp/vice/stock-cia.test.ts
  - .claude/mcp/vice/stock-cia.ts
  - .claude/mcp/vice/stock-derived.test.ts
  - .claude/mcp/vice/stock-derived.ts
  - .claude/mcp/vice/stock-dispatch.test.ts
  - .claude/mcp/vice/stock-dispatch.ts
  - .claude/mcp/vice/stock-handler.test.ts
  - .claude/mcp/vice/stock-handler.ts
  - .claude/mcp/vice/stock-live.test.ts
  - .claude/mcp/vice/stock-memory-search.test.ts
  - .claude/mcp/vice/stock-memory-search.ts
  - .claude/mcp/vice/stock-memory.test.ts
  - .claude/mcp/vice/stock-memory.ts
  - .claude/mcp/vice/stock-sprites.test.ts
  - .claude/mcp/vice/stock-sprites.ts
  - .claude/mcp/vice/stock-symbols.test.ts
  - .claude/mcp/vice/stock-symbols.ts
  - .claude/mcp/vice/stock-vicii.test.ts
  - .claude/mcp/vice/stock-vicii.ts
  - .claude/mcp/vice/tools-manifest.stock.json
  - .claude/skills/c64-program-recon/references/control-flow.md
  - .claude/skills/c64-program-recon/references/graphics.md
  - .claude/skills/c64-program-recon/references/observation-hazards.md
  - .claude/skills/c64-program-recon/references/sound-and-input.md
  - .claude/skills/c64-program-recon/references/tool-selection.md
  - docs/stock-vice-parity.md
  - .github/workflows/ci.yml
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-tool-coverage.mjs
findings:
  critical: 1
  warning: 11
  info: 4
  total: 16
status: issues_found
---

# Phase 5: Code Review Report (re-review after gap closure 05-09..05-13)

**Reviewed:** 2026-08-17T21:49:46Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

This is a re-review of the same 31 files after five gap-closure plans landed. I re-verified
every claimed fix against the code and, where the claim was about real emulator behaviour,
against genuine unpatched stock VICE 3.9 at `/usr/bin/x64sc`.

**Verified fixed, and fixed correctly:**

- **CR-01** — `stock-vicii.ts:285` and `stock-cia.ts:429` now call
  `resolveRequiredBank(..., "io", session)` (new export, `stock-memory.ts:148`) and refuse
  when the catalog has no `io` entry, sending zero `MEM_GET`s on that path. I ran the
  manual-only live gate myself (`VICE_LIVE_STOCK_BIN=/usr/bin/x64sc node --test
  stock-live.test.ts`, 7/7 pass) and confirmed the regression is genuinely closed: with
  `$01 = $34`, the CPU-view `$D020` read returns `255` while `vice_vicii_get_state` still
  reports `borderColour: 14` / `backgroundColour: 6` through `bank {id:3,name:"io"}`, and
  `vice_cia_get_state` reports `timerAControl.raw: 1` rather than the CPU-view `0xff`.
- **CR-02** — `readSpriteContext()` resolves `io` for `$D000-$D02E`/`$DD00` and `ram` for the
  pointer table and sprite data, both before the first send, with exactly one
  `BANKS_AVAILABLE` round trip. `registerBank`/`dataBank` are on both sprite answers and
  pinned with `enum` in the manifest. The bank-3 I/O-window note exists and fires. Live
  confirmed: `cia2PortARaw` is unchanged across `$01 = $34`, with a working non-vacuity control.
- **Legend defect** — two constants, selected on the per-sprite `multicolour` flag, with a
  genuinely useful cross-check test ("every distinct character in the rendered rows is
  mentioned in the legend") plus a live case.
- **WR-01** — `query.address` echoes the parsed number, and `stock-symbols.test.ts:436-471`
  validates the address branch against the *shipped* manifest schema **and** carries a
  non-vacuity control that proves the checker rejects the old behaviour. Well done.
- **WR-08** — `resolveLabelFilePath()` returns `real`; tested against a real in-workspace
  symlink. (But see WR-05 below: the containment comparison it feeds is asymmetric.)
- **WR-11 (partial)** — `loadedPath` is gone.
- **WR-02 / WR-03 (partial)** — `confounded`/`confoundedReason` and `invalidBcd` exist and are
  tested. Both fixes are incomplete; see CR-01 and WR-03 below.
- **WR-12 / WR-13** — the "provably side-effect-free" claim is correctly downgraded to
  VERIFIED-flag/ASSUMED-honouring in both the parity doc and the hazard reference, the
  banking hazard is recorded in both, and `stock-dispatch.ts:557` no longer says
  "(Phase 5)" for `vice_disk_read_sector`.

**What I found that is still wrong.** One Critical: the WR-03 fix skipped `tod.tenths`, which
still fabricates an impossible decimal from a non-BCD nibble with no marker at all — the exact
anti-pattern criterion 3 exists to forbid, in a manifest-`required` field. Eleven warnings,
five of them new: `vice_memory_banks` demonstrably under-reports the emulator's own bank
enumeration (live-verified: 6 banks on the wire, 5 in the answer, `count: 5`); `handleSpriteGet`
emits hazard notes for sprites that are not in the answer; the CIA `confounded` flag is
unconditionally `true` on any booted machine (live-verified `DDRA = $FF`) so it cannot
discriminate; the `resolveLabelFilePath` containment check compares a realpath against a
non-realpath root and falsely refuses legitimate files (reproduced); and one sprite test became
*more* vacuous as a side effect of the CR-01/CR-02 fix — its three response-type guards are now
unreachable, proven by instrumentation. The rest are carried-over items I judged worth
re-stating.

I also independently confirm the orchestrator's stated facts: manifest counts, `files[]` = 44,
`STOCK_DERIVED_TOOLS` size 9, fork/stock `inputSchema` property sets and `required` lists
identical for all eight new tools (so D-03 argument compatibility holds), and
`check-skill-tool-coverage.mjs` exit 0.

## Narrative Findings (AI reviewer)

### Critical Issues

#### CR-01: `tod.tenths` still fabricates an impossible decimal from a non-BCD nibble — the WR-03 fix skipped it

**File:** `.claude/mcp/vice/stock-cia.ts:291` (with `:137-144`, `:289-319`)

**Issue:** `fromBcd()` was hardened to return `null` for a byte whose nibble exceeds 9, and
`seconds`/`minutes`/`hours` correctly omit the key and list themselves in `tod.invalidBcd`.
`tenths` was never routed through it:

```ts
const tod: Record<string, unknown> = {
  tenths: todTenthsRaw & 0x0f,     // <- raw mask, never validated, never listed
};
```

A TOD tenths register holds BCD 0-9; VICE stores whatever the program wrote (`byte & 0x0f`), so
10-15 is reachable. Reproduced against the shipped decoder with `$DC08 = 0x0f`:

```
tod:   {"tenths":15,"seconds":42,"minutes":59,"hours":11,"pm":true,"rawHex":"0f425991","invalidBcd":[]}
notes: []
```

`tenths: 15` is not a physical value. There is no `invalidBcd` entry, no `notes` entry, and the
manifest lists `tenths` in `tod.required` with `type: "number"`, so the answer conforms and an
agent has no signal whatsoever that this number was invented. This is precisely the "plausible
value where the truth is unavailable" class the phase's criterion 3 was written to forbid, and
the gap-closure plan's own claim ("TOD fields refuse to invent a value from a non-BCD byte")
is only two-thirds delivered. Blast radius is one field, but the class is the one that must not
ship — and the sibling fields being fixed makes the inconsistency actively misleading: an agent
that has learned to trust `invalidBcd` will read `tenths` as measured.

`stock-cia.test.ts` cannot catch it: every fixture's tenths nibble is `0x5`, `0x0` or `0x1`, and
no `withTod()` override touches offset `0x08`.

**Fix:** route tenths through the same helper and the same omit-plus-name path as its three
siblings.

```ts
const todTenths = fromBcd(todTenthsRaw & 0x0f);   // high nibble is unused/reads 0
const tod: Record<string, unknown> = {};
if (todTenths !== null) {
  tod.tenths = todTenths;
} else {
  invalidBcd.push("tenths");
  notes.push(
    `$${basePrefix}08 (TOD tenths) reads 0x${todTenthsRaw.toString(16).padStart(2, "0")}, whose low ` +
      `nibble is not valid BCD -- no decimal value is reported; tod.rawHex carries the raw byte.`,
  );
}
```

Then drop `tenths` from `tod.required` in `tools-manifest.stock.json` (it joins
`seconds`/`minutes`/`hours` as conditionally present), and add a `withTod({ tenths: 0x0f })`
case asserting the key is absent and `invalidBcd` contains `"tenths"`.

### Warnings

#### WR-01: `vice_memory_banks` silently drops any bank sharing a wire id — live-verified, 6 banks on the wire, 5 in the answer

**File:** `.claude/mcp/vice/stock-memory.ts:101-110,195-196` (also `:172`)

**Issue:** `bankCatalogFor()` builds `byId` with `byId.set(bank.id, bank.name)`, and
`handleMemoryBanks` enumerates `byId`. Real stock VICE reports **two names for wire id 0**, so
last-write-wins loses one. Raw wire probe against `/usr/bin/x64sc` (VICE 3.9):

```
RAW BANKS: [{"id":0,"name":"default"},{"id":0,"name":"cpu"},{"id":1,"name":"ram"},
            {"id":2,"name":"rom"},{"id":3,"name":"io"},{"id":4,"name":"cart"}]
```

and the shipped handler on that exact catalog:

```
vice_memory_banks answer: {"banks":[{"id":0,"name":"cpu"},{"id":1,"name":"ram"},{"id":2,"name":"rom"},
                                    {"id":3,"name":"io"},{"id":4,"name":"cart"}],"count":5,...}
```

`"default"` is gone and `count` says 5 where the emulator enumerated 6. The same `byId` is the
source of the "available banks: ..." list in `resolveRequiredBank`'s refusal
(`stock-memory.ts:162`), so a refusal message tells an agent a working bank name does not exist.
And `resolveRequiredBank`/`resolveBank` return `name: catalog.byId.get(resolved)`, which echoes
a name the caller did not ask for:

```
resolveRequiredBank("default") -> {"ok":true,"id":0,"name":"cpu"}
```

The live `stock-live.test.ts` case at line 532 only asserts `io` and `ram` are *present*, so it
passes; and `stock-memory.test.ts` has a `realCatalogReply()` fixture carrying the duplicate id
but never feeds it to `handleMemoryBanks` (the only `handleMemoryBanks` test uses a two-bank
fixture with distinct ids). CLAUDE.md's own rule is that bank ids come from the emulator's
enumeration and are never guessed — reporting fewer banks than it enumerated breaks the same
contract from the other end.

**Fix:** keep the wire list, not an id-keyed map, for reporting; keep `byId` only for the
one-name-per-id reverse lookup, and echo the *requested* name.

```ts
export interface BankCatalog {
  byName: Map<string, number>;
  byId: Map<number, string>;
  /** Every (id, name) pair the emulator reported, in wire order -- aliases included. */
  entries: { id: number; name: string }[];
}
// handleMemoryBanks:
return stockAnswer(session.client, { banks: catalog.entries, count: catalog.entries.length });
// resolveRequiredBank: report what was asked for, and the canonical spelling separately
return { ok: true, id: resolved, name: catalog.entries.find((b) => b.id === resolved && b.name.toLowerCase() === bankName.toLowerCase())!.name };
```

Add a `handleMemoryBanks` test driven by `realCatalogReply()` asserting `count === 6` and that
both `default` and `cpu` appear.

#### WR-02: `handleSpriteGet` emits hazard notes for sprites that are not in the answer, and the notes name no sprite

**File:** `.claude/mcp/vice/stock-sprites.ts:433-439,455,471` (contradicting the contract at `:234-236`)

**Issue:** The per-sprite loop computes `spriteWindowNote()` for **all eight** sprites and pushes
into the shared `notes` array, but `sprites` is then narrowed to the single requested index at
line 455. `SpriteContext`'s own doc comment says the opposite is intended: "per-sprite
data-address notes are added by each handler once it knows which sprite(s) it needs".
`handleSpriteInspect` does it correctly (line 645, single sprite); `handleSpriteGet` does not.

Reproduced with VIC bank 3, `screenBase = $C000`, and only sprite 5's pointer resolving into
`$D000`:

```
requested sprite: 3  returned: [{"i":3,"addr":49152}]
notes: ["address 0xd000 falls in VIC bank 3's I/O window ($D000-$DFFF absolute) -- ..."]
```

The note carries no sprite index, so an agent that asked about sprite 3 reads a hazard warning
it can only attribute to sprite 3 — whose data address is `0xc000` and perfectly safe. The
inverse error is equally available: a real hazard on the requested sprite is indistinguishable
from a spurious one on another.

**Fix:** compute notes only for the sprites actually returned, and name the sprite in the note.

```ts
const sprites = spriteIndex !== undefined ? [allSprites[spriteIndex]!] : allSprites;
for (const s of sprites) {
  const dataNote = spriteWindowNote(s.dataAddress as number, context.bank, context.ramBank.name);
  if (dataNote !== null) {
    const attributed = `sprite ${s.index}: ${dataNote}`;
    if (!notes.includes(attributed)) notes.push(attributed);
  }
}
```

Add a case asserting `{ sprite: 3 }` on that fixture returns `notes: []` while `{}` returns the
note, attributed to sprite 5.

#### WR-03: the CIA `confounded` flag is unconditionally `true` on any booted machine, so it cannot discriminate — and it ignores DDRB for `joystick1`

**File:** `.claude/mcp/vice/stock-cia.ts:204`

**Issue:** `keyboardColumnDriven = chip === 1 && portADirectionRaw !== 0x00`. On a real booted
C64 the KERNAL leaves `DDRA = $FF` permanently, so this is always true. Live probe of a
freshly-booted `/usr/bin/x64sc` through the shipped decoder:

```
live $DC00-$DC0F: 7fffff00671fffff0000000100000108
portA.joystick2: {"up":false,...,"fire":false,"confounded":true,"confoundedReason":"... DDRA ($DC02) reads 0xff ..."}
portB.joystick1: {"up":false,...,"confounded":true,...}
notes: ["$DC00/$DC01 ... DDRA (0xff) shows 8 port A output pin(s) ..."]
```

Here `$DC00 = 0x7F`: only bit 7 (a column line) is low, bits 0-4 all read high, so this *is* an
unambiguous "nothing pressed" joystick read — and the tool flags it confounded anyway. Because
the flag is on for 100% of realistic reads, it carries no information: an agent cannot use it
to tell a clean sample from a phantom one, and the module header's stated escape hatch ("with
`DDRA = $00` ... they are a genuine joystick read") describes a state that essentially never
occurs. The honest fix is cheap and uses bytes already in the buffer: a joystick bit is only
confounded when its own pin is an output **and** currently reads low.

Separately, `joystick1` lives on port B (`$DC01`), whose read is also latch-confounded by
`DDRB` (`bytes[0x03]`) — which this predicate never consults. With `DDRA = $00` and
`DDRB != 0x00`, `joystick1` reports `confounded: false` while port B is being driven.

**Fix:** make the flag per-read-actual rather than per-DDR-configured, and consult the right DDR
for each port.

```ts
/** A port bit is confounded iff it is configured as an output AND currently reads low --
 *  i.e. the low bit could be the driven latch rather than a pressed direction. */
function drivenLowMask(raw: number, ddr: number): number { return ddr & ~raw & 0x1f; }
const portAConfoundedBits = drivenLowMask(portARaw, portADirectionRaw);
const portBConfoundedBits = drivenLowMask(portBRaw, bytes[0x03]!);
// joystick2.confounded = portAConfoundedBits !== 0; joystick1.confounded = portAConfoundedBits !== 0 || portBConfoundedBits !== 0;
// and report `confoundedBits` so a caller knows WHICH directions are suspect.
```

Then replace the `withDdrA(CIA1_BYTES, 0xff)` test with cases distinguishing
`DDRA=$ff, PRA=$ff` (clean) from `DDRA=$ff, PRA=$fe` (confounded), and add a `DDRA=$00,
DDRB=$f0` case for `joystick1`.

#### WR-04: the sprite "wrong response type on any of the three reads" test became strictly vacuous as a side effect of the CR-01/CR-02 fix

**File:** `.claude/mcp/vice/stock-sprites.test.ts:333-342`

**Issue:** The test replaces `send` with a function returning `{ type: "wrong_type" }` for
*every* call. Before the gap closure, the first call was the VIC-II `MEM_GET`, so at least one
of the three `memory_get` type guards was reached. Now `readSpriteContext()` sends
`BANKS_AVAILABLE` first, so the failure comes from `bankCatalogFor()` and **none** of the three
guards in `readSpriteContext()` is exercised. Instrumented against the shipped handler:

```
isError: true
text:   vice_sprite_get: the command failed (bankCatalogFor: expected a "banks_available" reply, got "wrong_type").
send call count: 1  types: [ 130 ]      // 130 = BANKS_AVAILABLE only
```

The test title claims coverage of three code paths and now covers none of them. (`void
original;` at line 341 is also still dead — the original `send` is captured and discarded.) This
is a regression in coverage introduced by an otherwise-correct fix, which is exactly the class
of drift a re-review should catch.

**Fix:** parameterise over which read fails, answering `BANKS_AVAILABLE` normally throughout.

```ts
for (const failAt of [1, 2, 3] as const) {
  test(`handleSpriteGet: a wrong response type on read ${failAt} is refused`, async () => {
    let memGets = 0;
    const { session } = makeSpriteSession();
    const real = (session.client as any).send;
    (session.client as any).send = async (ct: number, body: Buffer) => {
      if (ct === CommandType.BanksAvailable) return real(ct, body);
      memGets += 1;
      return memGets === failAt ? { type: "wrong_type" } : real(ct, body);
    };
    const result = await handleSpriteGet({}, session, DEPS);
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /memory_get/);
    assert.equal(memGets, failAt, "the failing read must be the one under test");
  });
}
```

Delete `void original;` rather than keeping a captured-and-discarded reference.

#### WR-05: `resolveLabelFilePath` compares a realpath against a non-realpath root, falsely refusing legitimate in-workspace files

**File:** `.claude/mcp/vice/stock-symbols.ts:129-151` (with `repo-root.ts:117-156`)

**Issue:** `root = repoRoot()` returns `resolve(...)`, never `realpathSync(...)`. The second
containment check compares the fully-canonicalised `real` against that possibly-symlinked
`root`, so any workspace whose own path contains a symlinked component fails for every file
inside it. Reproduced with `CLAUDE_PROJECT_DIR` pointing at a symlink to a real directory that
genuinely contains the label file:

```
vice_symbols_load: ".../symtest/link/sub/labels.lbl" resolves (via symlink) to
".../symtest/real/sub/labels.lbl", which is outside the workspace root (.../symtest/link)
-- a symbol file must live inside the workspace
```

The file *is* inside the workspace; the message is wrong and the tool is unusable. This is
routine in practice: a bind-mounted or symlinked project directory, `/tmp` on macOS, a
`~ -> /mnt/...` home. The WR-08 fix made this reachable more often, since the returned value is
now the same `real` the check ran on. `stock-symbols.test.ts`'s symlink cases use
`mkdtempSync(tmpdir())` where `/tmp` is real on Linux CI, so nothing catches it.

**Fix:** canonicalise both sides before comparing, and keep the pre-realpath check purely as
the friendlier message for an obviously out-of-tree argument.

```ts
const root = repoRoot();
let realRoot: string;
try { realRoot = realpathSync(root); } catch { realRoot = root; }
// ... after `real = realpathSync(resolved)`:
if (!isContained(real, realRoot)) { /* refuse, naming both realRoot and real */ }
```

Add a test that symlinks a directory, points `CLAUDE_PROJECT_DIR` at the link, and asserts a
load *succeeds*.

#### WR-06: `vice_memory_search` / `vice_memory_compare` still read wire bank `0x0000`, take no `bank` argument, and never say which view they read

**File:** `.claude/mcp/vice/stock-memory-search.ts:153,310,328`

**Issue:** All three `MEM_GET` bodies pass `bank: 0x0000` as a literal. That is the CPU view,
which follows `$00`/`$01` banking — the exact shape CR-01 was raised about, and which
`stock-memory.ts`'s own header now names as forbidden ("a chip-state or VIC-fetch read must
NEVER pass a literal bank id and must NEVER default to `0x0000`"). These two are not chip-state
reads, so the CPU view is a defensible default; the defect is that it is **invisible and
unchangeable**:

- `vice_memory_read` accepts `bank` and reports it on the answer; these two accept no `bank` at
  all (fork parity confirmed: neither manifest declares one), so an agent cannot search RAM
  under ROM or under I/O, which is a routine reverse-engineering need on this project.
- Neither answer carries a `bank` field, and neither `outputSchema` declares one. A search
  across `$D000-$DFFF` returns register bytes or the RAM underneath depending on the halted
  program's `$01`, and the answer looks identical either way. The module header's own reasoning
  ("searching or comparing across `$D000-$DFFF` must never clear a pending VIC-II IRQ flag")
  shows the author expected these ranges to be searched.

**Fix:** at minimum, name the view on the answer so it is auditable; better, accept the same
optional `bank` argument `vice_memory_read` already resolves through `resolveBank()`.

```ts
const bankResolution = await resolveBank("vice_memory_search", args.bank, session);
if (!bankResolution.ok) return bankResolution.result;
const body = memGetBody({ sidefx: false, start, end, memspace: 0x00, bank: bankResolution.id });
// payload: ..., bank: bankResolution.name !== undefined ? { id: bankResolution.id, name: bankResolution.name } : bankResolution.id,
```

Declare `bank` in both `inputSchema`s and `outputSchema`s (adding an argument the fork does not
have is already precedented — `vice_memory_read`'s `sideEffects` is stock-only).

#### WR-07 (carried over from the prior review's WR-05): the `mode:'snapshot'` refusal and two docs promise a time dimension `mode:'ranges'` does not have

**File:** `.claude/mcp/vice/stock-memory-search.ts:242-243`,
`.claude/skills/c64-program-recon/references/control-flow.md:164`,
`docs/stock-vice-parity.md:188-189`

**Issue:** Deliberately out of scope for the gap closure, and it has since **spread** to a third
file: the parity doc now quotes the refusal text verbatim. All three tell an agent to
"compare two live ranges captured at different points in time". `handleMemoryCompare` issues
both `MEM_GET`s inside one call against one halted machine (its own comment at lines 304-308
says so). It compares two *addresses* at one *time*. This is agent-facing text on an error path
— the wording most likely to be acted on — so I am re-reporting it despite the scope decision.

**Fix:** say what the tool does, in all three places: "`mode:'ranges'` compares two *different
address ranges* in the same halted machine; it cannot compare one range across time. To compare
before/after, call `vice_memory_read` twice and diff client-side, or use `c64-ram-capture`'s
full-image diff."

#### WR-08 (carried over, WR-09): `truncated` is set on an exact-boundary result, and `identical`'s `!truncated` conjunct is dead

**File:** `.claude/mcp/vice/stock-memory-search.ts:195-198,357-360,375`

**Issue:** `if (matches.length === maxResults) { truncated = true; break; }` fires after pushing
the last allowed match without establishing that another exists, so a range with exactly
`max_results` matches reports `truncated: true`. A caller that re-searches on `truncated` cannot
tell a complete result from a clipped one. `identical: differences.length === 0 && !truncated`
is dead in the second conjunct: `parseByteCount` refuses 0 (`stock-address.ts:215`), so
`truncated` implies `differences.length >= 1`. `stock-memory-search.test.ts:91` uses 6 matches
against `max_results: 2`, so the boundary case is untested.

**Fix:** `if (matches.length === maxResults) { truncated = offset < bytes.length - pattern.length; break; }`
and `identical: differences.length === 0`. Add a boundary case (exactly `max_results` matches
available) asserting `truncated: false`.

#### WR-09 (carried over, WR-07): `stock-sprites.ts` re-derives constants and per-sprite decoding that `stock-vicii.ts` already exports

**File:** `.claude/mcp/vice/stock-sprites.ts:72-74,420-453,602-669`

**Issue:** `VICII_BASE`/`VICII_END`/`VICII_LENGTH` are private literals (`VICII_LENGTH = 0x2f`
is a magic number where `stock-vicii.ts:89` derives it) although
`stock-vicii.ts:85-89` exports all three; and the eight `bytes[0xdNNN - VICII_BASE]!` lookups
plus the per-sprite `enabled`/`x`/`y`/`colour`/`multicolour`/`expandX`/`expandY`/
`priorityBehindBackground` extraction are duplicated bit-for-bit in **both** sprite handlers,
making four copies of decoding `decodeVicii()` already performs. This is the codebase's own
named "re-deriving a cross-cutting seam locally" anti-pattern, and WR-02 above is a direct
consequence of the duplication (the two handlers' note handling diverged).

**Fix:** `import { VICII_BASE, VICII_END, VICII_LENGTH, decodeVicii } from "./stock-vicii.ts";`
and build both sprite answers from `decodeVicii()`'s already-decoded arrays; keep only the
pointer-chain arithmetic local.

#### WR-10 (carried over, WR-10 #1): the D-02 derived-path test is structurally unfailable

**File:** `.claude/mcp/vice/stock-derived.test.ts:60-113`

**Issue:** The test wraps a synthetic handler in `withDerivedTool()` and asserts args arrive
unrewritten. `withDerivedTool` (`stock-dispatch.ts:486-521`) forwards `args` by reference and
contains no reference to `rewriteArguments` at all, so the assertion cannot fail. The stated
risk — that `vice-proxy.ts` routes a derived tool through the fork-forwarding function, which
*does* call `rewriteArguments()` — is never exercised; the `hostPath()` control only proves
translation *would* differ. Per CLAUDE.md this is the load-bearing invariant for every derived
tool, so a test that cannot fail is a real gap even though it was scoped out.

**Fix:** assert the routing property where it lives — extend the existing `VICE_PROXY_CODE_LINES`
structural assertion in `stock-dispatch.test.ts` to prove the derived branch precedes the
fork-forward call site, or drive a real `tools/call` through `vice-proxy.ts` with
`VICE_BACKEND=stock`.

#### WR-11 (carried over, WR-11 remainder): dead code across the derived modules and the new CI script

**File:** `.claude/mcp/vice/stock-derived.ts:66-135`, `.claude/mcp/vice/stock-sprites.ts:332-342,614-620`,
`scripts/check-skill-tool-coverage.mjs:25,42,53,62`

**Issue:** Still present after the gap closure:
- `derivedContainerPath()` and `DerivedToolError` have **zero production callers** (only
  `stock-derived.test.ts`), and no `STOCK_DERIVED_TOOLS` member takes a path argument — so the
  file's "ONE named seam a derived tool routes an output path through" routes nothing, and its
  refusal branch cannot fire in production.
- The two `> 0xffff` refusals in `stock-sprites.ts` are unreachable by construction:
  `pointerTableEnd` maxes at `49152 + 15*1024 + 0x3ff = 65535`, `dataEnd` at
  `49152 + 255*64 + 62 = 65534`. They read as live guards; `stock-sprites.test.ts:556-575`
  documents the bound is never crossed.
- `statSync` is imported and never used (line 25); `walkSkills`'s third parameter `dirsSeen` is
  always `null` and never read (lines 42, 53, 62), and the recursive call's return value is
  discarded while the function also returns `acc`.

**Fix:** give `derivedContainerPath()` a production caller or delete it with its error class and
the tests that only exercise it; convert the two address guards into commented internal
invariants stating they are unreachable by construction; drop the unused import and parameter.

### Info

#### IN-01: the manifest pins `bank.name` to lowercase literals while `resolveRequiredBank` returns the wire's own spelling

**File:** `.claude/mcp/vice/tools-manifest.stock.json` (`vice_vicii_get_state`/`vice_cia_get_state`
`bank.name.enum: ["io"]`, `vice_sprite_*` `registerBank`/`dataBank`), `.claude/mcp/vice/stock-memory.ts:172`

**Issue:** Lookup is case-insensitive (`byName.get(bankName.toLowerCase())`) but the reported
name is `catalog.byId.get(resolved)`, i.e. whatever the build spelled. VICE 3.9 spells them
lowercase (verified live), so this is latent — but a build spelling it `"IO"` would resolve
fine and then emit an answer that violates its own declared `enum`, surfacing as a conformance
failure rather than a clean refusal or a correct answer.

**Fix:** report the canonical lowercase name the schema pins (`name: bankName.toLowerCase()`),
and keep the wire spelling in a separate `wireName` field if it is worth surfacing at all.

#### IN-02: `check-npm-packages.mjs`'s transitive-closure walk misses `export ... from` and side-effect imports

**File:** `scripts/check-npm-packages.mjs:118`

**Issue:** The regex `/^\s*import\s[^;]*?from\s+"(\.\/[^"]+)"/gm` matches only value/type imports
with a `from` clause. It would not follow `export { x } from "./y.ts"` or a bare
`import "./y.ts"` — and one of the latter exists (`vice-probe.ts:41: import "./repo-root.ts";`).
No module is currently unreachable-but-unshipped because of it (`repo-root.ts` is reached by
other named imports), so this is a latent hole in an otherwise good gate.

**Fix:** widen the pattern to `/^\s*(?:import|export)\s(?:[^;]*?from\s+)?"(\.\/[^"]+)"/gm`.

#### IN-03: the hostpath consumer gate only sees direct static imports of `./hostpath.*`

**File:** `.claude/mcp/vice/hostpath-consumers.test.ts:43`

**Issue:** `HOSTPATH_IMPORT_RE` is deliberately narrow (correctly, to avoid matching comments and
string literals), but that means a future derived module could reach host-path translation
transitively — e.g. by importing `stock-paths.ts`, which is itself in the allowed set — or via a
dynamic `await import()`, and the two D-02 mechanisms would both pass. Today no derived module
imports any of the five, so the invariant holds.

**Fix:** add a second, transitive assertion: for each `DERIVED_TOOL_MODULES` value, walk its
relative-import closure and assert none of the five consumers appears in it.

#### IN-04: `sound-and-input.md` documents the joystick bits without mentioning `confounded`

**File:** `.claude/skills/c64-program-recon/references/sound-and-input.md:55-59,68-70`

**Issue:** The reference gained a note about `$xx0D`'s read/write split (good), but the joystick
paragraph still reads "The joystick bits are active-low: bit 4 is fire, bits 0-3
up/down/left/right" with no mention that on stock `vice_cia_get_state` annotates those five
booleans with `confounded`/`confoundedReason`, nor that `tod` fields can be absent with the name
listed in `invalidBcd`. Given WR-03 above (the flag is currently always `true`), a skill note is
what would stop an agent reading a phantom direction press as real.

**Fix:** one sentence in the third CIA hazard: "On stock, `vice_cia_get_state`'s `joystick1`/
`joystick2` carry `confounded` plus a reason whenever the shared keyboard-column pins may be
driving the read — treat a confounded direction as unmeasured, and re-sample with the machine
stopped outside the KERNAL scan."

---

_Reviewed: 2026-08-17T21:49:46Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
_Live verification: `/usr/bin/x64sc` (VICE 3.9) — `stock-live.test.ts` 7/7 pass; raw `BANKS_AVAILABLE`, `$DC00-$DC0F` on a booted machine, and four shipped-handler repros run directly_
