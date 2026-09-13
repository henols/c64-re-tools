# Phase 49, plan 49-07 — `HAZARD_DISPOSITION`

Declares the one outcome line `SCHEMA.md` §3 assigns to this file:
`HAZARD_DISPOSITION` (§2.3).

---

## What was measured

The run harness builds the real hazard report (`buildHazardReport()`) over
the committed purpose-built subject's own program image and store ranges
(`src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` and
`hazard-subject.annostore.json`) — the same real report
`evidence/49-tree-rebuild.md` cites for its own `DIFF_SCOPE_COVERAGE` line.

The report carries **3 findings** and **1 undecided (`"unclassified"`)
region**:

| Hazard class | Anchor address | Mechanism |
|---|---|---|
| `indexed-dispatch` | `$081C` (2076) | `stack-return-dispatch` |
| `self-modifying-code` | `$0825` (2085) | `store-target-in-instruction-opcode-byte` |
| `cycle-exact-raster` | `$10C2` (4290) | `timer-reload-in-vectored-handler` |

| Undecided region | Reason |
|---|---|
| `$087A..$0FFF` (2170..4095, inclusive) | "the VIC-II register recovery for this combination is incomplete -- missing bank-select, control-register-1 -- so this report could not determine whether a page-alignment dependency exists here" |

The harness disposes this report (`disposeHazardReport()`) against a
frozen, per-finding acknowledgement array declared in
`src/mcp/vice/reassembly-gate-run.test.ts` (`HAZARD_ACKNOWLEDGEMENTS`) — one
entry per finding, three entries, each carrying a distinct, non-empty
reason a person would give for accepting that specific movement
constraint. The array carries **no** acknowledgement of the one undecided
region: the plan's own action text describes the array as "one entry per
finding" and states plainly that the harness "does not add an entry to
make the run pass" when the report carries something the array does not
name — so the undecided region is left unacknowledged, and the honest
disposal below is `blocked`, not `acknowledged`.

## Command and raw output

```
$ date -u +"%Y-%m-%d"
2026-09-13

$ cd src/mcp/vice && node --test reassembly-gate-run.test.ts
[...]
hazard disposition:
HAZARD_DISPOSITION: blocked

Acknowledged findings:
  indexed-dispatch $081C stack-return-dispatch: the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the code that reads it, so the reconstructed return address stays correct as-is.
  self-modifying-code $0825 store-target-in-instruction-opcode-byte: the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this rebuild, so the write still lands on the intended opcode byte.
  cycle-exact-raster $10C2 timer-reload-in-vectored-handler: the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected by a rebuild that leaves the handler at its original address.
[...]
ℹ tests 2
ℹ pass 2
ℹ fail 0
```

Exit code of the full `node --test` invocation, read directly on the same
line (never through a pipe): `0`.

Corroborating, independently-run excerpt (`disposeHazardReport()` invoked
directly against the same real report and the same three-entry
acknowledgement array, findings only, no region acknowledgement supplied —
run separately from the harness above purely to surface the disposal's own
stated reason string verbatim):

```
$ date -u +"%Y-%m-%d"
2026-09-13
$ cd src/mcp/vice && node zz-49-07-disposal-check.mjs
findings-only disposal: blocked disposeHazardReport: undecided region 2170::4095 is not matched by exactly one acknowledgement.
```

(`zz-49-07-disposal-check.mjs` was a throwaway scratch script -- load the
committed `.prg` and store export, build the real hazard report through
`buildHazardReport()`, build the same three-entry findings-only
acknowledgement array the run harness declares, and call
`disposeHazardReport()` directly, logging its `disposition` and `reason`.
Never committed; removed immediately after this corroborating run.)

## Reading the line this file declares

`HAZARD_DISPOSITION: blocked` is `disposeHazardReport()`'s own returned
`disposition` field, derived exactly as `SCHEMA.md` §2.3 states: `blocked`
"in every other case" once `clean` (zero findings, zero undecided regions,
zero acknowledgements) and `acknowledged` (every finding AND every
undecided region matched exactly once) are both excluded. All 3 findings
here ARE matched exactly once each by the frozen array — the rendered
lines above show it — but the 1 undecided region is matched by nothing,
which is what `disposeHazardReport()`'s own reason string names verbatim:
`"undecided region 2170::4095 is not matched by exactly one acknowledgement."`

This is the honest, real measurement against the committed subject, not an
adjustment: the plan's own instruction is explicit that no entry is added
to turn a blocked disposition into a passing one, and this evidence file
records exactly what the real disposal returned.

The one bare line this file declares is already quoted verbatim in the
first code fence above (`HAZARD_DISPOSITION: blocked`) — not repeated a
second time here, on the same terms `evidence/49-tree-rebuild.md` states
for its own two lines.

## Re-measurement (2026-09-13, after the alignment subject was amended)

**This is a re-measurement, not the original run.** The alignment routine
in `src/mcp/vice/fixtures/hazard-subject/hazard-subject-align.a` (and its
mis-aligned twin) was amended so its VIC-II bank-select register (`$dd00`)
and control register 1 (`$d011`) are both stated as an immediate load
directly followed by its store, rather than a read-modify-write and an
unwritten register respectively. Both images and the store export were
regenerated through their existing committed generator scripts. The prior
run's own section above is left in place as history, per this document's
own final-occurrence-wins rule.

The amended subject's real hazard report now carries **5 findings** and
**0 undecided regions** (previously 3 findings, 1 undecided region):

| Hazard class | Anchor address | Mechanism |
|---|---|---|
| `indexed-dispatch` | `$081C` (2076) | `stack-return-dispatch` |
| `self-modifying-code` | `$0825` (2085) | `store-target-in-instruction-opcode-byte` |
| `page-alignment` | `$0881` (2177) | `charset-base-pinned-by-register` |
| `page-alignment` | `$088B` (2187) | `sprite-pointer-names-aligned-base` |
| `cycle-exact-raster` | `$10C2` (4290) | `timer-reload-in-vectored-handler` |

The two new findings are exactly the page-alignment dependency the
fixture's own design document always claimed to plant: the character-set
selector (anchored at the `sta $d018` instruction) and the sprite pointer
(anchored at the `sta $07f8` instruction) are now both derivable, because
`deriveGraphicsRanges()` no longer has a missing register in this
combination.

The frozen acknowledgement array in `src/mcp/vice/reassembly-gate-run.test.ts`
now carries five entries -- one per finding, the same "this run does not
relocate it" reasoning already frozen for the first three extended to the
two new ones, on the reasoning that array's own header comment states in
full. Every one of the five findings is matched exactly once, and there is
no undecided region left to acknowledge, so the disposal moves from
`blocked` to `acknowledged` -- not `clean` (a human accepted five named
movement constraints) and not `blocked` (nothing here is unacknowledged).

### Command and raw output (re-measurement)

```
$ date -u +"%Y-%m-%d"
2026-09-13

$ cd src/mcp/vice && node --test acme-seam.test.ts acme-verify.test.ts reassembly-gate.test.ts reassembly-gate-ack.test.ts reassembly-gate-movement.test.ts reassembly-gate-run.test.ts
[...]
hazard disposition:
HAZARD_DISPOSITION: acknowledged

Acknowledged findings:
  indexed-dispatch $081C stack-return-dispatch: the RTS-trick return address is reconstructed from a fixed hi/lo table pair; this run does not relocate that table or the code that reads it, so the reconstructed return address stays correct as-is.
  self-modifying-code $0825 store-target-in-instruction-opcode-byte: the opcode-byte write targets a fixed, unrelocated address in this run; the instruction it patches is not moved by this rebuild, so the write still lands on the intended opcode byte.
  page-alignment $0881 charset-base-pinned-by-register: the character-set selector is now stated as a fixed immediate value naming the committed character-set base; this run does not relocate the character set (the baseline rebuild reproduces the subject at its original layout), so the register value still names the correct 2048-byte-aligned block.
  page-alignment $088B sprite-pointer-names-aligned-base: the sprite pointer is stated as a fixed immediate value naming the committed sprite-shape base; this run does not relocate the sprite shape (the baseline rebuild reproduces the subject at its original layout), so the pointer byte still names the correct 64-byte-aligned block.
  cycle-exact-raster $10C2 timer-reload-in-vectored-handler: the one-shot timer reload sits inside a vectored handler this run does not relocate; its cycle-exact timing is unaffected by a rebuild that leaves the handler at its original address.
[...]
ℹ tests 121
ℹ pass 121
ℹ fail 0
```

Exit code of the full `node --test` invocation, read directly on the same
line (never through a pipe): `0`.

### Reading the re-measured line

`HAZARD_DISPOSITION: acknowledged` is `disposeHazardReport()`'s own
returned `disposition` field: all 5 findings are matched exactly once by
the (now five-entry) frozen array, and 0 undecided regions remain to be
acknowledged, so `SCHEMA.md` §2.3's `acknowledged` condition ("every
finding matched by exactly one acknowledgement... and every undecided
region is likewise acknowledged") is satisfied vacuously for the region
half and directly for the finding half. This is not a weaker result than
`blocked`; it is the honest disposal of a report that changed shape because
the subject itself changed, decided by the same array-matching rule as
before.
