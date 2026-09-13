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
