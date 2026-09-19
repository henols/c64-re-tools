# Research Questions

Open questions raised during planning and exploration. Each carries the date it was raised and
what would settle it.

## Can any advertised `vice_*` tool be proven strictly dominated, given the v0.1.x compatibility promise?

**Raised:** 2026-09-11 — `/gsd-explore`, MCP tool redundancy census.
**Blocks:** any removal of a tool from the advertised surface.

The decision taken was "remove only tools that are pure aliases with no unique capability,
disambiguate everything else." That requires proving domination per tool, and the proof is the
gate — a tool that merely *looks* like an alias is a disambiguation row, not a deletion.

Four REASONED candidates, none yet proven:

- `vice_execution_until_return` — overlaps the 5-tool stepping cluster; named in no shipped skill.
- `vice_registers_available` — overlaps `vice_registers_get`; named in no shipped skill.
- `vice_checkpoint_set_condition` — overlaps `vice_checkpoint_add`'s own condition handling.
- `vice_result_continue` — proxy-local; unclear whether an agent should ever select it directly.

`vice_watch_add` is the fifth and the most explicit — its own description says *"shorthand for
checkpoint with store/load"* — but it IS named by three shipped skill files, so removing it has a
caller cost the other four do not.

**What would settle it, per tool:**

1. Is every argument shape reachable through the proposed replacement, with the same semantics?
   Read the stock handler, not the description — `handleExecutionUntilReturn`
   (`stock-execution.ts`), `stock-checkpoints.ts`, `stock-dispatch.ts`.
2. Does the fork implement it differently from stock? A tool can be an alias on one backend and
   not the other, which would make removal a backend-conditional change.
3. Is it reachable from internal code as well as from an agent? The `vice_ping` case is the
   worked example of this trap: it reads as a duplicate of `vice_diagnose`, but is `PROBE_TOOL`
   (`vice-probe.ts:47`), the broker launch gate (`broker-launch.mts:868`) and a `vice-sync.ts`
   poll primitive. Grep `src/` as well as `src/skills/` before calling anything unused.
4. What does removal cost against `CLAUDE.md`'s compatibility constraint — *"the fork's list is
   unchanged from v0.1.x"*? Does removing a stock-only tool touch that promise at all, or does
   the constraint bind only tools advertised on both?

**Note on the evidence base:** seed this from `tools-manifest.stock.json`, which is hand-authored
source, matches the live stock surface exactly (46/46), and is pinned to the dispatch table by
`stock-dispatch.test.ts`'s conformance battery. Do NOT seed it from `tools-manifest.json` — that
file describes the FORK's surface, which differs by design (D-07 per-backend trimming), and
comparing the two produces false "unused tool" findings. `vice_result_continue` is in neither
manifest because it is registered proxy-locally (`vice-proxy.ts:3403`); its absence there is not
evidence about its value.

## Does anything in the v1.0.0 rebuild half need stock's three hard losses?

**Raised:** 2026-09-11 — `/gsd-explore`, owner scope call to remove the fork backend entirely.
**Blocks:** the fork-removal phase should not run until this is answered.
**Settled:** 2026-09-11 — answered below: no. Phase 52's stated dependency on this question is
discharged.

Removing the fork makes three capabilities **permanently unavailable**, not hedged:

    SID read-back      $D400-$D418 is write-only in hardware and the binary monitor has no SID
                       command. Not "unimplemented" — unrecoverable on stock.
    Matrix keyboard    KEYBOARD_FEED (0x72) injects buffer text only; there is no matrix control.
    RESTORE / NMI      no monitor route to the physical line.

These are exactly what `FORK-01` retained the fork to hedge. Accepting their permanent loss is
the real content of the reversal, so it should be an explicit, dated acceptance — not a silent
consequence of a deletion.

**What is already known (do not re-derive):** `PROJECT.md:398`, the v0.8.0 close audit dated
2026-09-06, records that the hedge was never exercised and that all three losses were **not
needed by any of the six shipped skills**, running end-to-end on genuine stock `x64sc` 3.9. That
is strong evidence for acceptance, but it is evidence about the SHIPPED skills at v0.8.0, not
about work not yet written.

**What is genuinely open:** the v1.0.0 "Rebuild Half" is the milestone in flight. Does any of its
planned work need to read SID state back, drive the keyboard matrix directly, or trigger
RESTORE/NMI?

- **Matrix keyboard** is the one to check hardest. It is named as the hardest loss, and
  `PROJECT.md:1758` couples it to `FORK-01` — an upstream `KEYBOARD_MATRIX_SET` opcode (~60 lines
  in `monitor_binary.c` calling `keyboard_set_keyarr_any`) would close it for everyone. A game
  that scans the matrix directly rather than reading the KERNAL buffer cannot be driven without
  it, and driving a game is squarely in scope for a rebuild milestone.
- **SID read-back** matters for music-player reverse engineering; check whether any planned phase
  inspects a running player's register state rather than its code.
- **RESTORE/NMI** is the narrowest; likely accept without further work.

**How to settle it:** read the v1.0.0 phase list in `ROADMAP.md` for work that drives input or
inspects sound state, and check the six shipped skills' text for surviving "requires the fork"
routes (`tool-selection.md` carries at least one, for `vice_sid_get_state`). If nothing needs
them, record the acceptance with its date and evidence and proceed. If something does, that work
must be rescoped BEFORE the fork is removed, not after.

### Answer, 2026-09-11: No

**No.** Nothing in the v1.0.0 rebuild half needs SID read-back, matrix keyboard, or
RESTORE/NMI. A word-bounded scan of the whole v1.0.0 phase block (Phase 45 through Phase 51)
for `keyboard|matrix|nmi|restore|joystick|sid` returns zero hits, run this session.

**Matrix keyboard — not needed.** Phase 48 criterion 1 is the milestone's one new
input-capable subject: a committed, purpose-built synthetic program that "assembles under real
ACME and runs in VICE with visible on-screen behaviour." Its input, if any, is authored by this
project rather than reverse-engineered from a real title, so it can be designed against the
KERNAL buffer that `KEYBOARD_FEED` (0x72) drives — no direct matrix control is required.
(Correcting S-1: Phase 45's own Notes say plainly that its subject is "the existing committed
fixtures," not the purpose-built synthetic one — `tracer.prg`, `bank.prg`, `smc.prg`, plus
`bank-path-dependent.prg` and `charset-phantom` named in its criterion 4 and criterion 5 — so
Phase 48's fixture is not "the only subject in v1.0.0"; it is the *new* one, and the
pre-existing fixtures are Phase 45's decomposition subject, not an input-driving one either
way.) The decisive scope point is Phase 50's own Notes: applying the pipeline to a real title
(`bruce_lee`, which scans `$DC00`/`$DC01` directly rather than reading the KERNAL buffer) is
named `FUT-05` and stated explicitly as "not this phase" — so the one scenario in the whole
milestone that would need direct matrix control is already outside v1.0.0's scope.

**The `FUT-05` caveat.** `FUT-05` — applying the pipeline to a real title such as `bruce_lee` —
would plausibly need matrix keyboard, because a game that scans the matrix directly cannot be
driven through the KERNAL buffer. The remedy at that point is the upstream
`KEYBOARD_MATRIX_SET` opcode (`PROJECT.md:439`, ~60 lines in `monitor_binary.c` calling
`keyboard_set_keyarr_any`), which closes the gap for every stock user. It is **not**
reinstating the fork backend, which the owner reports never actually worked.

**SID read-back — not needed.** The v1.0.0 equivalence instrument does not read SID state
back at all; it excludes it. `src/skills/c64-ram-capture/scripts/compare.mjs`'s `VOLATILE`
table (line 40, found via `grep -n 'VOLATILE\|0xd000'`) puts the whole `$D000-$DFFF` I/O range
in its mask, SID's `$D400-$D7FF` included, with the comment directly above it stating the
reason: "reading this range samples live hardware and two captures can never agree here."
Phase 50 criterion 1 narrows this mask further for the original-vs-rebuild comparison, but
names a `$D020`/`$D015`/`$D018` regression only as the **planted test case** the narrowed mask
must still be observed catching — its text does not say the narrowing stops at those three
registers (correcting S-2: "only" in the handed-over evidence was an over-read of what
criterion 1 actually claims; the three are the proof case for the gate, not a stated ceiling on
what the mask covers). Either reading leaves the same answer here: the instrument's whole
design is to mask SID's range rather than read it back, so no v1.0.0 phase needs live SID
state.

**RESTORE / NMI — not needed.** The Task 1 scan already covers the range this needs checking
over: the whole v1.0.0 phase block, Phase 45 through Phase 51 (not the narrower Phase 47-50
range the handed-over evidence checked — correcting S-3, since the v1.0.0 rebuild half is the
full 45-51 span). That word-bounded scan for `keyboard|matrix|nmi|restore|joystick|sid`
returned zero hits, so nothing in the milestone reaches for RESTORE or NMI.

**Cross-check over the 15 requirements** (`DECOMP-01..04`, `BUILD-01..07`, `EQUIV-01..04`).
The hard half — the same word-bounded scan, run over the v1.0.0 Requirements block for
`keyboard|matrix|sid|nmi|restore|joystick` — returns `0`. A separate scan of the same block for
`sound|input` returns exactly one hit, not zero as the handed-over evidence claimed: `DECOMP-01`'s
text, which states the completeness gate "takes `anno_evid_disagreements` as a **required**
input." That is a data-flow input to a completeness gate, not a keyboard/joystick input device,
so it is not counter-evidence — it is disambiguated here rather than silently dropped. There is
no "sound" hit anywhere in the block.

**Framing correction.** This question is posed as "can we accept permanently LOSING these
three capabilities?" But the owner reports the fork backend never actually worked
(`.planning/notes/fork-removal-reversal-basis.md` records the owner's scope call), so none of
the three were ever genuinely available to lose in practice. Removing the fork does not lose a
capability — it stops the documentation promising one it could not deliver. That is what makes
this acceptance straightforward rather than a sacrifice.

**Hand-off to Phase 52.** The surviving `requires the fork` / `fork-only` routes found in skill
text this session (`grep -rniE 'requires the fork|fork-only' src/skills/`), for Phase 52
criterion 3 to rewrite rather than re-derive:

- `src/skills/c64-program-recon/references/tool-selection.md:17` — `vice_sid_get_state`
- `src/skills/c64-program-recon/references/control-flow.md:89` — `vice_keyboard_restore`
- `src/skills/vice-wedge-triage/SKILL.md:225` — the `vice_ping` ×3 non-pausing poll technique
  (fork-only; the same section already states the stock equivalent)
- `src/skills/c64-program-recon/SKILL.md:698` — `vice_keyboard_matrix`
- `src/skills/c64-program-recon/references/sound-and-input.md:64` — `vice_keyboard_matrix`
- `src/skills/c64-program-recon/references/observation-hazards.md:88` — `vice_sid_get_state`
- `src/skills/c64-program-recon/references/observation-hazards.md:106` — `vice_keyboard_matrix`
- `src/skills/c64-ram-capture/SKILL.md:163` — the fork-only keyboard-matrix capture call

This entry ANSWERS the question and unblocks Phase 52. The formal dated ACCEPTANCE record —
Phase 52's own success criterion 3 — is deliberately **not** written here; writing it in this
plan would pre-empt that phase and split the record across two places.
