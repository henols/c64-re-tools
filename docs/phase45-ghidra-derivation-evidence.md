# Phase 45 plan 45-07 — Ghidra fixture family derivation and execution evidence

MEASURED 2026-09-11, on this host, against genuine tool installs (never
installed by this session — detected, per the project's standing "detect,
then refuse by name" convention).

## Tool versions used throughout this document

| Tool | Path / version |
|---|---|
| Ghidra `analyzeHeadless` | `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`, `C64NmosLanguage` extension already installed, processor id `6502:LE:16:nmos` |
| `x64sc` (stock VICE) | `/usr/bin/x64sc` (genuine unpatched stock; `/usr/local/bin/x64sc` shadows it earlier on `$PATH` and is the custom fork — the absolute path was used throughout) |

`pgrep -x x64sc` was confirmed empty immediately before this session's first
live run, and again after the last one.

**No `dxa` run appears anywhere in this document.** Unlike plan 45-06's
dxa+Ghidra family, this plan's own Task 1 action text types all three
fixtures BY HAND from their known static byte layout (BASIC stub/pad as
`byte`, straight-line code as `code`) — Ghidra is used only for the
volatile-marked cross-reference import and, for `bank-path-dependent.prg`,
the bank-state join. There was no dxa-derived classification to record.

## Task 1 — the derived half (Ghidra only, hand-typed ranges, no dxa)

Route, per `fixtures/decomp-execution-manifest.json` and RESEARCH.md
Pitfall 7: **flat64k** for all three fixtures. `bank-path-dependent.prg`'s
internal `jsr` only resolves correctly on this route (the `.prg` route's
own two-byte header-inclusive load shift breaks it — `fixtures/ghidra/
README.md`'s own documented finding), and `charset-phantom.prg`'s
register-derived `$1000-$17ff` character-set range only coincides with the
loaded bytes on this route. `bank.prg` has no internal `jsr` and either
route would have worked; the manifest's flat64k was used for consistency.

For each fixture: a 65,536-byte flat image was built fresh (never
committed) from the `.prg`'s own 2-byte header (origin) and body, mirroring
`ghidra-live.test.ts`'s own `generateFlat64kVariant()`/
`generatePathDependentFlat64kVariant()`/`generateCharsetPhantomFlat64kVariant()`.
`ghidra.analyze` ran with `preScript: vendor/ghidra-scripts/VolatileCarve.java`
(marks `$0000-$0001` and `$D000-$DFFF` volatile BEFORE `analyzeAll()`),
`postScript: vendor/ghidra-scripts/GhidraStructExport.java`, `noanalysis: true`
(the scripts do all analysis themselves), and each fixture's own flat64k
entry point (`$0810` for all three).

### Volatile marking and `classifyGhidraRunLog()` verdict, per fixture

All three runs: exit status 0, `scriptThrew: false`, language
`6502:LE:16:nmos` (byte-exact match to the requested processor). Every run
marked BOTH ranges on the EXISTING block the flat64k route's own single
whole-image block already covers — no `VOLATILE-NEW` line appears anywhere,
confirming no fallback to non-volatile ever occurred:

```
bank.prg:
  SPLIT-OK at 2 / d000 / e000
  VOLATILE-SET: RAM 0000-0001
  VOLATILE-SET: RAM.split.split d000-dfff
  VOLATILE-BLOCK-COUNT: 2

bank-path-dependent.prg:
  SPLIT-OK at 2 / d000 / e000
  VOLATILE-SET: RAM 0000-0001
  VOLATILE-SET: RAM.split.split d000-dfff
  VOLATILE-BLOCK-COUNT: 2

charset-phantom.prg:
  SPLIT-OK at 2 / d000 / e000
  VOLATILE-SET: RAM 0000-0001
  VOLATILE-SET: RAM.split.split d000-dfff
  VOLATILE-BLOCK-COUNT: 2
```

### Typing (hand-derived from the known static layout, per Task 1's own action text)

| Fixture | Ranges written |
|---|---|
| `bank.prg` (60 bytes) | `$0801-$080f` `byte` (stub+pad, 15 bytes), `$0810-$083a` `code` (43 bytes) |
| `bank-path-dependent.prg` (52 bytes) | `$0801-$080f` `byte` (15 bytes), `$0810-$0832` `code` (35 bytes, `start`+`probe`) |
| `charset-phantom.prg` (4097 bytes) | `$0801-$080f` `byte` (15 bytes), `$0810-$0822` `code` (19 bytes, `start`'s own six instructions), `$0823-$0fff` `byte` (2013 bytes, the `* = $1000` zero gap-fill — RESEARCH.md §9's own "988 bytes" figure for this gap was arithmetically wrong; the real gap, measured off the fixture's own address trace, is `$0fff-$0823+1 = 2013` bytes, and `15+19+2013+2048 = 4095` matches the payload length exactly), `$1000-$17ff` `code` (2048 bytes, the charset chain — set from Task 1 per the plan's own correction; Task 2 below supplies the execution evidence that forces it) |

Coverage check: `bank.prg` 15+43=58 of 58 payload bytes; `bank-path-dependent.prg`
15+35=50 of 50; `charset-phantom.prg` 15+19+2013+2048=4095 of 4095 — all MATCH,
zero gaps, zero overlaps.

Every exported document: `schemaVersion: 1`, zero labels, zero comments (before
Task 2's own bank-state annotations — see below), every range row
`provenance: "derived"`.

### `bank.prg` — Ghidra xref import (confirms the fixture's own README exactly)

Imported xrefs (decimal → hex): `2066→0812 sta $01`, `2070→0816 sta $d020`,
`2076→081c sta $01`, `2080→0820 sta $d020`, `2083→0823 lda $d020` (READ),
`2088→0828 sta $01`, `2103→0837 sta $01` — all seven lines match `fixtures/
ghidra/README.md`'s own MEASURED flat64k-route reference dump verbatim.

### `bank-path-dependent.prg` — Ghidra xref import, `## CONST_WRITES`, and the DECLINED join

`## REFERENCES` (real export, this run):

```
0813 -> 0001 WRITE     (call 1's own sta $01)
0815 -> 0825 UNCONDITIONAL_CALL   (jsr probe, call 1)
081a -> 0001 WRITE     (call 2's own sta $01)
081c -> 0825 UNCONDITIONAL_CALL   (jsr probe, call 2)
0821 -> 0001 WRITE     (restore)
0827 -> d020 WRITE     (probe's own sta $d020)
082c -> d000 READ      (probe's own lda $d000,x)
082f -> 3000 WRITE     (probe's own sta $3000,x)
```

`## CONST_WRITES` (`parseConstWrites()`, real recovered facts): `$0813=0x34`,
`$081a=0x33`, `$0821=0x37` — three resolved processor-port stores, matching
the source's own three `sta $01` instructions exactly.

`runMemmapJoin({ imageOrigin: 0x0801, imageByteLength: 50, constWrites })`,
REAL result, quoted verbatim:

```json
{
  "counts": {
    "addressesConsidered": 4, "annotated": 2, "skippedInImage": 0,
    "skippedNoMapEntry": 0, "declined": 2, "commentsChanged": 2
  },
  "decisions": [
    { "address": 1,     "outcome": "annotated", "label": "6510 On-chip 8-bit Input/Output Register" },
    { "address": 12288, "outcome": "annotated", "label": "Default BASIC area (38911 bytes)" },
    { "address": 53248, "outcome": "declined",
      "reason": "no recovered processor-port value reaches $d000 -- declining rather than defaulting to the power-on state" },
    { "address": 53280, "outcome": "declined",
      "reason": "no recovered processor-port value reaches $d020 -- declining rather than defaulting to the power-on state" }
  ]
}
```

**A MEASURED finding, disclosed rather than smoothed over: the decline
reason at these two addresses is `"no recovered processor-port value
reaches"`, not the `"reached under disagreeing processor-port values"`
shape the plan's own action text names as the illustrative example.** Both
are equally valid instances of the SAME `outcome: "declined"` mechanism the
plan requires — no bank state was guessed at either address — but the
underlying cause is worth recording explicitly:
`GHIDRA_REFTYPE_TO_ACCESS_KIND` (`anno-import.ts`) maps only `READ`,
`WRITE`, `READ_WRITE`, `COMPUTED_JUMP` and `COMPUTED_CALL` onto the store's
four-member `XrefAccessKind` — an ordinary direct `JSR`, exported by
`GhidraStructExport.java` as `UNCONDITIONAL_CALL` (confirmed in the real
`## REFERENCES` text above: `0815 -> 0825 UNCONDITIONAL_CALL`), is **not**
in that table and is therefore dropped (counted in `kindsSeenNotImported`,
never imported as a store xref). `runMemmapJoin()`'s own reachability walk
(`computeReachingValues()`/`canReach()`) is built entirely over the store's
imported xref graph (`listXrefs()`), so with no `UNCONDITIONAL_CALL` edge
connecting `$0813`'s own `sta $01` to `probe`'s body, the graph has no path
from either const-write to `$d000`/`$d020` at all — `reaching.values` comes
back empty, which is the `"no recovered value reaches"` branch, not the
`"several disagreeing values"` branch. This is a genuine, previously-
unmeasured limit of the current importer's reachability graph for a
DIRECT-call fixture (as opposed to a computed/indirect one) — recorded here
as a finding for a future plan, not fixed in this one (widening
`GHIDRA_REFTYPE_TO_ACCESS_KIND`'s vocabulary is an architectural change to
`anno-import.ts`/`anno-join.ts`, D-37-05's frozen mapping, squarely outside
this plan's declared `files_modified`). **No bank state was guessed at
either address regardless of which decline reason fired** — that is the
actual requirement, and it holds.

Per plan instruction, this decline is **not persisted** in this plan's own
store export — persistence of a `DECLINED:` comment is plan 45-09's own
authored-closure job (D-03's split-provenance rule: the derived evidence
above is what plan 45-09 will write its authored comment FROM). Confirmed:
no comment or annotation in any of the three committed `.annostore.json`
documents asserts a bank state for `$d000` or `$d020`.

### `charset-phantom.prg` — Ghidra xref import

`## REFERENCES` (real export): `0812 -> dd00 WRITE`, `0817 -> d018 WRITE`,
`081c -> d011 WRITE` — the three VIC register writes `start` performs,
matching the fixture's own address trace exactly. No xref exists for the
`jsr charset_start` (an `UNCONDITIONAL_CALL`, dropped for the same reason
recorded above) or for any address inside the charset chain (all in-image,
skipped from the memmap lookup by construction).

## Task 2 — the three live execution runs

The broker was started as a `systemd --user` transient unit
(`systemd-run --user --unit=vice-broker-4507 --collect
--working-directory=<repo>/src/mcp/vice --setenv=VICE_BACKEND=stock
--setenv=VICE_BIN=/usr/bin/x64sc --setenv=VICE_BROKER_CONTROL_PORT=0
--setenv=VICE_BROKER_MAX=1 --setenv=XDG_CONFIG_HOME=<scratch>/xdg-config --
node resources/vice-broker.mjs --repo-root <repo>/src/mcp/vice --state-dir
<scratch>/broker-state`), kept running for the whole session and stopped
(`systemctl --user stop vice-broker-4507`) after the last run, per this
plan's own instruction (contrast plan 45-06's own one-broker-per-run
pattern). A fresh `openBrokerControl()`/`.acquire()` control session was
opened per fixture run — **the connection IS the lease**
(`vice-broker-client.ts`'s own `release()` header comment: closing the
socket is the entire release, no wire round trip) — so a session cannot be
reused across fixtures after its own `release()` call destroys the socket.

**MEASURED, disclosed, reconfirming 45-06's own finding: every stock
monitor command implicitly re-pauses the emulated machine.**
`vice_execution_run()` was re-issued before every single poll in every wait
loop below, never once upfront.

### Run 1 — `bank.prg`

- `vice_autostart({path, run: true})` → `runState: "running"`.
- `vice_checkpoint_add({start: 0x83a, exec: true, stop: true})` → id 1,
  armed IMMEDIATELY after autostart (no pre-arm sleep — see the MEASURED
  timing finding below).
- Checkpoint hit confirmed via `hit_count` polling (never on paused state):
  hit after 5 poll attempts (~2.5s).
- `vice_execution_step({count: 1})` — retires the final `RTS` itself.
- `memmapshow` captured: 1,655,183 bytes.
- Real launch argv (from the granted instance's own `epoch.json`, never
  rebuilt): `["/usr/bin/x64sc","-default","-drive8type","1541","-seed","4242","-raminitstartrandom","0","-raminitrepeatrandom","0","-raminitrandomchance","0","+autostart-delay-random","-binarymonitor","-binarymonitoraddress","ip4://127.0.0.1:6600","-remotemonitor","-remotemonitoraddress","ip4://127.0.0.1:6601"]`
- `image_sha256`: `e46e71e1ffbfc196d1eb04d3a14f6ae638502225be56c996f0a090650ded2384`
  (matches `fixtures/ghidra/README.md`'s own committed sha256 for `bank.prg`).
- `seed`: `phase45-07-bank-fixed-seed`
- Run identity triple, exactly as `anno_evid_runs` reports it:
  `{"imageSha256":"e46e71e1ffbfc196d1eb04d3a14f6ae638502225be56c996f0a090650ded2384","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-07-bank-fixed-seed"}`
- `execObservations`: 2012.
- Per-address real execute evidence, confirmed against every one of the
  README's own seven reference addresses PLUS the terminal RTS:
  `$0810, $0812, $0816, $081c, $0820, $0823, $0828, $0837, $083a` — all
  `execute: true` (opcode bytes only, never an operand byte, matching real
  6502 semantics).
- `anno evid-disagreements` (real answer): `disagreementCount: 0`,
  `agreementCount: 21`, `blockCoveredNeverObservedCount: 37`,
  `observedOutsideAnyBlockCount: 1991`, `denominator: 58`.

### Run 2 — `bank-path-dependent.prg`

**A real, disclosed mistake in this run's own first attempt, corrected
before committing.** The checkpoint at `$0832` (`probe`'s own shared `RTS`)
is hit ONCE PER CALLER — this fixture's entire purpose. A `stop:true`
checkpoint halts on EVERY hit, so a poll loop that stops waiting the
INSTANT `hit_count >= 1` captures only call 1's own evidence and never lets
call 2 (the `$01=$33` path) execute at all. The FIRST capture attempt
observed exactly this: `$081a`-`$0824` (call 2's own instructions) were
uniformly `execute: false`. **Fixed**: the poll loop was changed to wait
for `hit_count >= 2` (both calls) before stopping; `anno_evid_reset()` was
used to clear the first, incomplete run's own observations
(`observationsRemoved: 1998`) before re-ingesting the corrected capture —
`anno_evid_reset`'s own contract ("resetting an empty bracket is the
ordinary thing, not a mistake") makes this the intended, idempotent route,
never a second store or a hand-edit.

- `vice_autostart({path, run: true})` → `runState: "running"`.
- `vice_checkpoint_add({start: 0x832, exec: true, stop: true})` → id 1.
- Checkpoint hit confirmed via `hit_count` polling: `hit_count` reached 2
  after 11 poll attempts (~5.5s) — BOTH calls to `probe` completed.
- `vice_execution_step({count: 1})` — retires the SECOND `RTS`, landing at
  `$081f` (the instruction right after call 2's own `jsr probe`),
  confirming the capture window spans both calls.
- `memmapshow` captured: 1,651,321 bytes.
- Real launch argv: identical to Run 1's (the broker's own launch command
  is fixed).
- `image_sha256`: `5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078`
  (matches `fixtures/ghidra/README.md`'s own committed sha256).
- `seed`: `phase45-07-bpd-fixed-seed`
- Run identity triple: `{"imageSha256":"5340d40d2b4ef3e166c80ee78f3e4960122ed3c1a99c0767ee771500012a0078","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-07-bpd-fixed-seed"}`
- `execObservations`: 2001 (after the reset-and-reingest correction above).
- Per-address real execute evidence, confirmed for BOTH callers and
  `probe`'s own shared body: `$0810` (start's own `sei`), `$0813`/`$081a`
  (both `sta $01` calls' own opcode bytes), `$0815`/`$081c` (both `jsr
  probe` calls' own opcode bytes), `$0825` (`probe`'s `lda #$aa`), `$0827`
  (`probe`'s own `sta $d020` — the shared write, reached under BOTH `$01`
  values), `$082a` (`ldx #$00`), `$082c` (`probe`'s own `lda $d000,x` — THE
  shared read this fixture exists to exercise, reached under BOTH `$01`
  values), `$082f` (`sta $3000,x`), `$0832` (the shared `RTS`) — all
  `execute: true`. `$081f`/`$0821`/`$0823`/`$0824` (start's own restore
  sequence, after the capture window's own deliberate stop point) remain
  `execute: false` — a genuine, disclosed scope boundary of this capture,
  not an error: the fixture's own point (a shared program point reached
  under two disagreeing bank states) is fully exercised without needing the
  restore tail.
- `anno evid-disagreements` (real answer, after the correction):
  `disagreementCount: 0`, `agreementCount: 13`,
  `blockCoveredNeverObservedCount: 37`, `observedOutsideAnyBlockCount: 1988`,
  `denominator: 50`.

### Run 3 — `charset-phantom.prg` (the self-executing "table", and a genuine stack overflow)

**Two real, MEASURED findings drove this run's own methodology, both
disclosed here in full rather than smoothed over.**

**Finding A — `vice_autostart({run: true})`'s own simulated RUN keystroke
never completes for this fixture.** Confirmed directly across four
independent live probes (`diag3`/`diag4`/`diag5`, this session): the LOAD
itself eventually succeeds (memory at `$0810` reads the fixture's own real
bytes, `a9 3f 8d 00 dd ...`, anywhere from ~7s to ~20s of real elapsed
time — the load is genuinely progressive over real time for a file this
size, not instantaneous), but the machine is then left parked in the
KERNAL's own idle loop INDEFINITELY (one probe ran 5 x 7-second windows,
35s total, with PC never leaving a narrow idle-loop address range).
`bank.prg` (60 bytes) and `bank-path-dependent.prg` (52 bytes) both
complete their own simulated RUN normally. This is disclosed as a genuine,
unresolved AUTOSTART RUN-detection quirk for this one fixture's own much
larger footprint (plausibly a READY-prompt detection heuristic timing out
before the KERNAL's own relink of a 4KB loaded block finishes) — not root-
caused further given the time available, and out of scope to fix (it is
`stock-machine.ts`'s own AUTOSTART wire-command behavior, unrelated to this
plan's own `files_modified`). **Workaround, mirroring 45-06's own
`export-asm/smc.prg` fallback exactly**: `vice_autostart({run: false})`
(LOAD only), poll memory until the REAL bytes land (verified at `$17fc`,
the file's own LAST four bytes — checking only the entry point's own first
few bytes was ITSELF a measured false-positive earlier in this session: a
single-step trace showed the CPU correctly executing six real instructions
from `$0810` through `jsr $1000` at `$081f`, then landing on BRK's own IRQ
vector immediately, because memory at `$1000` was STILL zero-filled even
though `$0810`'s own bytes had already arrived — the load is not atomic
across the whole file), then set PC directly at the entry point (`$0810`,
the fixture's own real, unshifted VICE-load address — never the flat64k
scratch-image address, which is a Ghidra-import artifact irrelevant to a
real VICE LOAD that strips the 2-byte header exactly like a real C64
loader), forcing the I flag on first (mirroring `smc.prg`'s own reasoning:
this fixture never executes `SEI` itself before the charset chain runs).

**Finding B — the 511-level `jsr *+4 / rts` chain genuinely overflows the
hardware stack, and RESEARCH.md Section 9's own "unwinds cleanly" prediction
is CORRECTED by this measurement.** A batched single-step trace (`diag6`,
this session) recorded the stack pointer after each batch of steps from a
clean entry at `$0810`: `SP = f2, 8e, c6, 36, 3e, ce, 5e, ee, 7e, 0e, 9e,
2e, be` over 2156 total steps — NON-MONOTONIC, proving the 256-byte stack
page wrapped around MULTIPLE times (511 nested `jsr`s need
511 × 2 = 1022 bytes of return-address space; the 6502 stack holds only
256). `start`'s own single pushed return address (`$0822`, its own `rts`)
is therefore OVERWRITTEN by a later, deeper push long before any unwind
could reach it — this is WHY a checkpoint armed at `$0822` (the address
RESEARCH.md predicted the unwind would cleanly return to) was observed
NEVER to fire across TWO independent attempts (90s and 120s deadlines, both
timed out at `hit_count: 0`, the second with a 5-second poll interval to
rule out poll-frequency interference). **The correction, stated plainly**:
the chain does not "unwind cleanly back through every intervening block's
own trailing RTS" as predicted; it corrupts its own return-address chain
via genuine stack wraparound and never reliably returns to `start`'s own
`$0822`. **What the measurement DOES confirm, unaffected by the
correction**: PC stayed inside `$1000-$17ff` throughout the traced window
(never escaping early into KERNAL/garbage territory during the portion
observed) — DECOMP-01's own soundness rule ("a range observed executing IS
code") is satisfied by this real, positive observation regardless of how
the chain's own control flow ultimately resolves. Execution was therefore
bounded by an EXPLICIT, discrete step count (`vice_execution_step({count:
4000})`, mirroring 45-06's own `export-asm/smc.prg` precedent for a
fixture whose control flow does not terminate as naively expected) rather
than by a checkpoint wait, which this fixture's own chaotic post-overflow
stack state makes impossible to bound any other way.

- `vice_autostart({path, run: false})` → load only.
- Load-completion poll (verify @ `$17fc`, expecting `60 60 60 60`): loaded
  after 2-3 poll attempts (~8-12s of real elapsed time).
- `vice_registers_set({register: "FL", value: currentFl | 0x04})` — forces
  the I flag on.
- `vice_registers_set({register: "PC", value: 0x0810})` — jumps to the
  entry point.
- `vice_execution_step({count: 4000})` — the explicit, discrete bound; no
  free-run and no checkpoint wait for this fixture.
- `memmapshow` captured: 1,653,527 bytes. **A second, unrelated, disclosed
  finding**: the raw text-channel reply carried 89 bytes of a stray leftover
  disassembly-trace line (`.C:1797  60  RTS  - A:1B X:00 Y:01 SP:26 ...`)
  prepended ahead of the real `addr: IO  ROM RAM` header — residue from
  this session's own earlier debug probes reusing the same warm emulator
  instance across many attempts. The genuinely foreign leading bytes were
  sliced off (the real memmapshow payload itself was never altered) before
  handing the reply to `anno_evid_ingest`; a production run against a
  freshly-launched instance (never carrying prior debug-session residue)
  would not need this.
- Real launch argv: identical to Runs 1/2's.
- `image_sha256`: `accff20636b1b763a9bcc92b1ff29889a5dcc69fa08536f6f4f7de7f833bc203`
  (matches `fixtures/ghidra/README.md`'s own committed sha256).
- `seed`: `phase45-07-charset-fixed-seed`
- Run identity triple: `{"imageSha256":"accff20636b1b763a9bcc92b1ff29889a5dcc69fa08536f6f4f7de7f833bc203","argvDigest":"c7ef57808d2b882fe1e18b8ac8c4bbb8cd6c2bbd72fdbc4b9a7942cd6536fbac","seed":"phase45-07-charset-fixed-seed"}`
- `execObservations`: 2555.
- **The MEASURED observation set for `$1000-$17ff`, stated plainly against
  the prediction**: 640 of 2048 bytes in the range show `execute: true` —
  NOT "essentially all 2044 bytes" as RESEARCH.md §9 predicted. The
  never-observed bytes are overwhelmingly each 4-byte block's own two JSR
  OPERAND bytes (never executed under real 6502 semantics regardless of how
  many times the JSR opcode itself fires) plus the RTS bytes of the
  EARLIEST-pushed blocks (whose return addresses were overwritten by the
  stack wraparound before any unwind could reach them, per Finding B).
- `anno evid-disagreements` (real answer): `disagreementCount: 0`,
  `agreementCount: 647`, `blockCoveredNeverObservedCount: 3448`,
  `observedOutsideAnyBlockCount: 1908`, `denominator: 4095`. **Zero
  disagreements** — every byte the derived half typed `code` that WAS
  observed executing agrees with that typing; the 3448 never-observed bytes
  (across the whole 4095-byte image, not only the charset region) prove
  nothing either way, per the soundness rule, and are correctly reported as
  their own bucket rather than folded into agreement or disagreement.

### The soundness asymmetry, applied to the typing decision

Per the phase's own rule ("a range observed executing IS code"; absence of
observation proves nothing): the `$1000-$17ff` range **stays typed `code`**
(Task 1's own shape), now with REAL positive evidence (640 observed-
executing bytes) supporting it directly, and the REMAINING 1408
never-observed bytes within that same range are typed `code` on the
DERIVED/byte-structural reasoning (identical 4-byte `jsr`/`rts` block shape
throughout) — not re-typed to `data`, `byte`, or any split layout on the
strength of their own absence of observation. This is criterion 1's second
sentence in miniature, applied literally: **no byte in this store was ever
re-typed because it was never observed executing.** The VIC-II's own
independent hardware read of these SAME bytes as a character set (the
"phantom routine" story `fixtures/ghidra/README.md` already documents) is
recorded here and in the README's own correction below, in PROSE — never
as a data-type override that would contradict the real, measured execution
evidence.

### Teardown

`systemctl --user stop vice-broker-4507` was run after the last live run
above, followed by `pgrep -x x64sc` — confirmed EMPTY. No `.d64`/`.prg`/
`.bin`/`.vsf` artifact was ever staged under the fixture tree
(`git status --porcelain src/mcp/vice/fixtures` never showed one throughout
this session).

## The completeness gate, at this stage (not run this plan)

This plan ships the derived half plus real execution evidence (D-12's
"derive first" half); the completeness gate's own report (entry-point
naming, purpose comments, referenced-address resolution) is plan 45-09's
job, exactly as plan 45-06 recorded for its own fixture family. No gate
run is recorded here; the gate is expected to report FAIL for all three
fixtures (every entry point still carries no authored name) until plan
45-09 closes them.

## Task 3 (1) — README provenance and the charset-phantom correction

See `src/mcp/vice/fixtures/ghidra/README.md`'s own new provenance sections
(one per new artifact) and its own APPENDED correction section (dated,
citing this document) for the `$1000-$17ff` typing.

## Task 3 (3) — idempotence, MEASURED by actually re-running

`bank.prg` was re-derived (Task 1's own action, replayed verbatim — flat64k
route, `VolatileCarve.java`/`GhidraStructExport.java`, entry point `$0810`)
into a FRESH scratch store, re-exported, and the derived-half fields
(`schemaVersion`, `store`, `ranges`, `labels`, `comments`, `projectEnums`,
`enumUsage`, `xrefs`) were confirmed to MATCH the committed
`fixtures/ghidra/bank.annostore.json` byte-identically — `execObservations`
excluded from this comparison by design (Task 2's own live-run evidence is
out of Task 1's own derivation scope; D-03's idempotence claim is about the
DERIVED half only, matching plan 45-06's own precedent for the same
exclusion). Re-derivation command and re-run confirmation are recorded in
this document by the plan's own Task 3 commit; `git status --porcelain
src/mcp/vice/fixtures/ghidra` was confirmed EMPTY immediately after.

## Final host state

`pgrep -x x64sc`: empty. `systemctl --user list-units 'vice-broker*'`:
empty (the transient unit self-collected via `--collect` once stopped).
`git status --porcelain src/mcp/vice/fixtures`: clean (checked repeatedly
throughout this session, and once more at its end).
