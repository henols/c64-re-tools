# Phase 64: the convergence metric, measured

**What this records:** the count and the full name list of production
(non-test) modules importing `hostpath.ts`, `containerpath.ts` or
`stock-paths.ts`, before and after this phase, per D-18. D-18 chose
measurement over assertion deliberately — an importer count is a text
question by construction, and this project's locked rule
(`260914-poo` D-1) bans a test asserting on text. This document is the
measurement; Phase 66's exit is where the metric becomes a gate.

## The exact, reproducible command

Run from `src/mcp/vice/`:

```bash
grep -aln 'from "./hostpath.ts"\|from "./containerpath.ts"\|from "./stock-paths.ts"' *.ts *.mts 2>/dev/null | grep -v '\.test\.' | sort
```

`grep -a` is load-bearing, not decorative: four source files under
`src/mcp/vice/` contain NUL bytes (`anno-memmap-render.ts`,
`anno-store-export.ts`, `prereq-readme-gen.ts`, `prerequisites.test.ts`,
measured 2026-09-19) and plain `grep` silently treats them as binary and
skips them with no warning — a content census that omits `-a` therefore
under-reports without failing loudly. Re-checked directly for this
measurement (2026-09-23): none of the four contains an import of any of the
three seam modules (`grep -ac` on each returns `0`), so `-a`'s presence does
not change this phase's count, but its absence would be silently unverified
rather than confirmed absent.

The `grep -v '\.test\.'` exclusion matches this project's own convention
(`CLAUDE.md`'s "Files" convention: a test sits beside its module as
`<module>.test.ts`) — this metric counts production importers, not test
fixtures that construct a stub of the same shape.

## Before this phase (measured 2026-09-23, the milestone's own opening count)

`STATE.md`'s "Current Position" section records the count at phase 64's
open as **6**, with these six named importers:

- `containerpath.ts`
- `host-tool-client.ts`
- `install-resources.ts`
- `stock-machine.ts`
- `stock-paths.ts`
- `vice-proxy.ts`

## After this phase (measured 2026-09-23, re-run against the tree at the
close of plan 64-07)

```
containerpath.ts
host-tool-client.ts
install-resources.ts
stock-paths.ts
vice-proxy.ts
```

**Count: 5.**

Confirmed by reading each importing line directly:

```
stock-paths.ts:43:import { tryHostPaths } from "./hostpath.ts";
install-resources.ts:40:import { hostPath, SET_ENV_HINT } from "./hostpath.ts";
containerpath.ts:38:import { hostPathCandidates, SET_ENV_HINT } from "./hostpath.ts";
host-tool-client.ts:57:import { containerPath } from "./containerpath.ts";
vice-proxy.ts:96:import { hostPath, SET_ENV_HINT } from "./hostpath.ts";
vice-proxy.ts:104:import { containerizeRecord } from "./containerpath.ts";
```

## Which module dropped, and why

**`stock-machine.ts`** is the one module this phase removed from the list.
Its own module header (rewritten by plan 64-06) records the mechanism
directly: all four of its file-carrying handlers
(`handleAutostart`/`handleDiskAttach`/`handleSnapshotSave`/
`handleSnapshotLoad`) stopped calling `withEmulatorSidePath()` — the
function that translated a client-side path into an emulator-side path
across the host/container seam — and stopped needing emulator-side path
translation at all, because the broker itself now mints the emulator-side
filename via `stage_file` and hands it back as an opaque string this client
only relays verbatim. The two snapshot handlers additionally switched their
own `name`-sanitisation call from `stock-paths.ts`'s throwing
`sanitizeSnapshotName()` wrapper to `transfer-paths.ts`'s
`validateSnapshotName()` directly (plan 64-06, D-18's own named mechanism) —
so `stock-machine.ts` now imports nothing from `stock-paths.ts` at all.
Confirmed directly: `grep -n 'from "./stock-paths.ts"\|withEmulatorSidePath' stock-machine.ts`
(outside comments) returns zero matches.

## The roadmap's predicted value versus what was measured

`ROADMAP.md`'s Phase 64 cross-cutting note predicts the convergence metric
lands at **4** by this phase's exit (a "6 → 4" framing). The measurement
above lands at **5**, not 4.

This is the exact gap the planner named in advance, in `64-07-PLAN.md`'s own
`<planner_findings>` block, before this plan executed a single task: the
predicted value of 4 appears to be off by one, because this phase drops
exactly ONE of the six named importers (`stock-machine.ts`), landing the
count at 5 rather than 4. D-18 already states the metric is measured and
recorded rather than gated, so this gap is recorded here as **Phase 66's to
reconcile, not this phase's to force closed**. Nothing in this phase invents
extra work to manufacture a fourth removal — doing so would exceed this
plan's own declared scope (`files_modified` names exactly one test file and
two evidence documents) and would risk deleting or bypassing a module
(`stock-paths.ts`) that D-13 explicitly requires to survive until Phase 66's
own `RM-01` deletes it.

The remaining five importers are exactly the ones Phase 66's own `RM-01`
(deleting `stock-paths.ts`) and the milestone's boundary-seam collapse must
address: `stock-paths.ts` itself (the module being deleted), and its four
remaining consumers (`containerpath.ts`, `host-tool-client.ts`,
`install-resources.ts`, `vice-proxy.ts`) — none of which is this phase's
`files_modified` scope, and none of which Phase 64's `<domain>` "Explicitly
NOT in this phase" list authorised touching. `host_tool` in particular is
named directly: "Skill-script host tools are `SEAM-03`, Phase 65" — so
`host-tool-client.ts`'s own import is Phase 65's or Phase 66's to resolve,
not Phase 64's.

## D-18's named, accepted cost

**Nothing mechanical catches a regression between Phase 64 and Phase 66.**
This is D-18's own stated cost, accepted at the point of decision, not
discovered here. A future plan could reintroduce an import of `hostpath.ts`,
`containerpath.ts` or `stock-paths.ts` into a module not on this list, and no
test in this codebase would fail — the locked no-asserting-on-text rule
(`260914-poo` D-1) forbids a source-scanning guard from closing that gap,
and `ROADMAP.md`'s own Phase 53 withdrawal record shows that moving such a
check into CI does not escape the rule either (a prior guard criterion doing
exactly that was withdrawn on 2026-09-17 for reading source text). The one
survivor of that purge, `anno-hazard-report.test.ts:1127`'s own
`assert.ok(!/hostpath|containerpath/.test(source), ...)`, is recorded in
`64-CONTEXT.md`'s own D-18 entry as **mixed precedent, not a licence** — its
survival is not evidence that adding a second one is sanctioned, and this
plan adds none.

## D-17's guarantee and its limit, recorded verbatim rather than softened

The disjoint-roots test this plan wrote (`transfer-disjoint-roots.test.ts`)
proves **nothing leaked** across two filesystem roots that cannot see each
other — it does **not** prove that nothing was ever opened. A stray read of
a broker-side path that happens to succeed and never surfaces in a tool
result would still pass every assertion in that test. This is the weaker
guarantee D-17 chose deliberately, against the stronger (injected-seam)
option offered and declined, and it is recorded here exactly as
`64-CONTEXT.md`'s own D-17 entry states it — not restated as a stronger
claim than the test actually makes.

## The wire-field narrowing (planner finding item 1, `64-07-PLAN.md`)

"No broker-side path in any wire field" cannot hold literally: `AUTOSTART`,
`DUMP` and `UNDUMP` each carry a filename field on the wire, the emulator
runs on the broker's own host, and the Phase 63 relay is byte-transparent by
design — it must not parse what it relays. Something has to carry the
broker's own chosen path across to the emulator, and that something is this
client relaying a string it did not choose (the `emulator_filename` a
`stage_file` reply mints). What IS provable, and what
`transfer-disjoint-roots.test.ts` actually asserts, is narrower and stated
precisely: **no broker-side path in any TOOL RESULT**, and no
client-CHOSEN broker path anywhere. The four handlers' results were checked
recursively (every key, every nested value) for exactly this — never for the
stronger, unprovable claim that no wire field ever carries a B-side path.

## Reconciling this measurement's own currency

This document's own "after" measurement was re-run at the close of plan
64-07 (this plan), against the tree as it stood after this plan's own Task 1
commit (`transfer-disjoint-roots.test.ts`, which is a test file and does not
touch the import graph itself). The count is unchanged by this plan's own
work — plan 64-06 is what moved it from 6 to 5, and this document is the
recording of that fact, not a new reduction.
