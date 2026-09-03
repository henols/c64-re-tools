---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
fixed_at: 2026-09-03T00:00:00Z
review_path: .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/33-REVIEW.md
iteration: 1
scope: all
findings_in_scope: 15
fixed: 14
accepted: 1
skipped: 0
status: all_dispositioned
---

# Phase 33: Code Review Fix Report

**Source review:** `33-REVIEW.md` (2 Critical, 9 Warning, 4 Info — 15 total)
**Scope:** `--fix --all`, so every id including Info carries a disposition.
**Iteration:** 1

## Summary

| Disposition | Count | Ids |
|---|---|---|
| fixed | 14 | CR-01, CR-02, WR-01, WR-02, WR-03, WR-04, WR-05, WR-06, WR-07, WR-09, IN-01, IN-02, IN-03, IN-04 |
| accepted (documented, not changed) | 1 | WR-08 |
| wont-fix | 0 | — |

Every finding was read against the current source before being acted on, and
two were adapted rather than applied as written (WR-01 and WR-06 — see their
entries). One fix required follow-up test changes in a file the review did not
cite (WR-03).

## Fixed

### CR-01 — a derived address set shipped under a README saying it does not

**Disposition:** fixed. **Commit:** `e18e44d`
**Files:** `installer/scripts/sync-skills.mjs`, `scripts/check-npm-packages.mjs`

Chose the "do not ship derived address sets" arm. `danish.json` stays in the
repo (it is 33-10's committed evidence and other artifacts cite it) and is
excluded from the tarball, which makes `transients/README.md`'s existing
"this README and nothing else" sentence true rather than editing the sentence
to match a leak.

`isNonShipping()` is now path-aware — a basename-only predicate cannot express
`<skill>/transients/*.json` — and `assertLeanTarball()` gained the matching
assertion, so the producer being wrong is caught rather than trusted (the same
independence rationale as every other check in that gate). The assertion is
shaped as "any `.json` under any skill's `transients/`", not `danish.json`, so
the next release's list is covered the day it is derived.

**Verified both directions** with `npm pack --dry-run --json`: with the rule,
the tarball carries `skills/c64-ram-capture/transients/README.md` and no
`.json`; with the rule reverted, `check-npm-packages.mjs` fails naming
`danish.json`. `node scripts/check-npm-packages.mjs` exits 0 (37 files,
7 skills).

### CR-02 — `anchorHitCount: 0` certified as a four-term stop identity

**Disposition:** fixed. **Commit:** `edb5d7f`
**Files:** `src/mcp/vice/stock-reproducible-run.ts`, `…test.ts`

`anchorHitCount === 0` is now an explicit refusal naming the cause, why 0 is
not a term, and the corrective action. It follows the timeout path's existing
precedent of emitting no oracle term rather than zero-filling one, and deletes
the anchor before refusing so a `stop: true` checkpoint is not left armed.

The test **observes** the refusal rather than asserting the guard exists: it
drives the whole procedure with a `CHECKPOINT_GET` reporting 0 and requires an
error result, plus explicit assertions that neither `"reproducibleStop": true`
nor `"hitCount": 0` appears in the output, so a regression that restores the
confident answer fails even if the message is reworded. **Confirmed to go red**
with the guard short-circuited to `if (false)`.

### WR-01 — the anchor-stopped-first refusal burned the whole deadline

**Disposition:** fixed, **with the fix adapted**. **Commit:** `f00446b`

The finding is real: at a different address the state is deterministically
terminal and already observed, yet the wait ran to a deadline of up to
600 000 ms while `.mcp.json` caps a request at 150 000 ms — so the
`anchorStoppedFirstNote` never reached the caller at any realistic setting.

**The review's patch was not applied as written.** It resolves on *every* first
anchor hit, which breaks `frameAnchor === address` — a documented legitimate
configuration that step 4 deliberately arms as two distinct checkpoints. At one
address both checkpoints match the same instruction, so a single stop emits two
`CHECKPOINT_INFO` frames: the target's arrives from that same stop with no
further execution, and the emission order is not ours to depend on. An ungated
early settle would turn the adjacent configuration's *successful stop* into a
spurious refusal. The settle is therefore gated on non-adjacency.

One pre-existing test had to be restated. It drove a distinct-address anchor
frame first and then required a confident stop anyway — not physically
realisable with a `stop: true` anchor and one resume, and passing only because
the fake emitted both frames back to back irrespective of machine state. It now
asserts what is load-bearing: an anchor frame **never certifies a stop**, which
is strictly stronger than before. T-33-31 is untouched — `"hit"` still resolves
on the target's id alone. Two tests added: the distinct-address settle asserted
on elapsed time against a 30 000 ms deadline, and the adjacency counterpart
proving the shortcut does not fire there.

### WR-02 — a non-restart resume failure left the anchor armed

**Disposition:** fixed. **Commit:** `d49a8ce`

Keyed on `client.connected` — the observable that says whether a delete could
even be answered — with the error-class test preserving the restarted path
exactly. `deleteCheckpoint()` reports dispositions and never throws, so it
cannot mask the error, which still propagates uncaught so the one existing
converter seam produces the wording. `MachineRestartedError` is imported from
`vice.ts` rather than redefined, matching `stock-connect.ts`'s normative
"reused — never redefined here".

Both directions tested, because the value is in the distinction. **Confirmed**
the live-socket test goes red with the condition short-circuited.

### WR-03 — `profile` accepted, recorded, then ignored on fork

**Disposition:** fixed. **Commits:** `38b4bb1`, `0061337` (test follow-up)

Refused at the single narrowing site, which is also the wire boundary that
already answers `bad_request`, so the caller *learns* its request was dropped.
Gating the record mirror instead would stop the record lying but leave the
caller with no way to find out. The refusal lands before `onAcquire`, so no
port is allocated, nothing is spawned, and no record is written that could
claim a knob its argv does not carry.

Scoped to `=== true`: an empty `{}` and an explicit `{warp:false}` ask for
nothing fork cannot deliver and still grant, since turning a no-op into an
error would break profile-less callers and make a request for exactly fork's
own behaviour an error.

**Follow-up the review did not predict:** four pre-existing tests across
`broker-control.test.ts` and `vice-broker-client.test.ts` drove profile-bearing
acquires against shared default `onHostState` stubs reporting `backend:
"fork"` — the very combination now refused. Two of them did worse than fail:
the refused acquire then waited for a grant that would never come, blocking
until `CONTROL_ACQUIRE_TIMEOUT_MS` (120 s). All four moved to a stock stub,
which is the only backend on which a profile-bearing acquire is coherent; the
properties they assert are backend-independent and unchanged. Four new tests
cover the fork refusal, the both-keys wording, the still-granted no-op
profiles, and the same profile granted on stock.

### WR-04 — prototype-key confusion in three CLI dispatchers

**Disposition:** fixed. **Commit:** `2a42989`

All three behaviours reproduced first, exactly as measured in the review.
`make-fixtures.mjs toString` exited 0 having written nothing; both skill
scripts produced the `"code" argument must be of type number` message instead
of their usage.

`make-fixtures.mjs` now uses `Object.hasOwn`, plus a second guard refusing a
selection that matched nothing — "wrote nothing" and "wrote what you asked for"
must never share an exit code in a provenance generator. Both skill scripts
dispatch off `Object.create(null)`, the idiom `derive-transients.mjs` already
used for its flag bag one level down.

The pre-existing unknown-verb tests held only for verbs that are not prototype
members. Each is now paired with a loop over
`constructor`/`toString`/`valueOf`/`hasOwnProperty`/`__proto__`. The generator
gains a refusal test that also asserts the four fixture files are
byte-unchanged; only the refusal path is driven, because a run with real names
would rewrite the committed corpus with a fresh `capturedAt`.

### WR-05 — the CAP-03 census was blind to a template-literal specifier

**Disposition:** fixed. **Commit:** `9d2d4c6`

Three changes: backticks in the literal scan; `isModuleSpecifierShaped()` no
longer requires a `/` (a whitespace-free literal carrying a module extension is
specifier-shaped, and the extension requirement preserves the property the
measured narrowing was protecting); and an **interpolated** specifier is
refused by shape rather than scanned, since it names its target only at runtime
and reporting "no hit" would be indistinguishable from a clean module.

Two planted positive controls added beside the existing four, **both confirmed
to go red** against the old scanner.

### WR-06 — three documented commands could not run from the documented cwd

**Disposition:** fixed, **with the template handled differently**. **Commit:** `4c72cd0`

`SKILL.md` gained `V=$S/vsf-slice.mjs` and
`TD=src/skills/c64-ram-capture/transients` in the quick-reference block, used
at all four sites, plus two new quick-reference lines so the slicer is
discoverable where every other script is. `transients/README.md:37-45` already
got this right; that is the wording propagated.

**The template was not rewritten as suggested.** Its `capture route` row was
flagged for the same wrong path, but all *five* of its `node scripts/…`
citations share that shape, only one is phase 33's, and the template states no
cwd at all — so `scripts/` there reads naturally as relative to the skill
directory. Rewriting one row into a different style would have made it
internally inconsistent. Instead the cwd the shorthand is relative to is stated
once, which resolves the ambiguity for all five and points repo-root callers at
the `$S` variables.

### WR-07 — the header named a non-existent importer

**Disposition:** fixed. **Commit:** `4c5797c`

Confirmed independently: `capture-predicate.ts` imports only `node:crypto` and
names `vsf-slice.ts` in comments alone; no non-test module imports it. The
correction states the live hazard explicitly — the entry-point guard was
justified by "`capture-predicate.ts` imports it", so a future editor could
conclude a real importer exercises it and relax it. Nothing does; the guard has
to hold for the census alone, and the comment now says so.

### WR-09 — the two `-drive8type` adjacency comments contradicted each other

**Disposition:** fixed. **Commit:** `31d3643`

Reconciled to what is load-bearing: `-default` precedes everything it resets,
and `-drive8type` comes *after* `-default`, not immediately after.

**Re-verified live rather than taken from the review.** The `-console` block's
citation was `alive=yes bound=1`, which does not cover I-2's property — its
failure mode is `Drive8Type` reverting to 0 (NONE) *while the monitor still
binds*, so liveness cannot distinguish the good case from the failure being
guarded against. Probed 2026-09-03 against genuine unpatched stock
`/usr/bin/x64sc` (VICE 3.9), `DISPLAY` and `WAYLAND_DISPLAY` both unset:

```
[-default -console -drive8type 1541 <determinism> -binarymonitor]
  alive=yes bound=1  Drive8Type=1541  Drive8TrueEmulation=1
```

read over `RESOURCE_GET` (0x51) with `-console` interposed. The behaviour is
correct; this was a comment defect only. Spawned instances reaped, postflight
`pgrep -x x64sc` clean.

### IN-01 — the two allow-list parsers disagreed on `attribution`

**Disposition:** fixed. **Commit:** `f016dc6`

`parseArtifact()` gained the type check. The two implementations are a
deliberate duplicate asserted to agree on *verdicts* but not on parse
strictness — which is where a deliberate duplicate drifts first, because an
artifact one accepts and the other rejects is a disagreement about whether the
ledger is readable at all. The malformed-artifact test the review asked for
edits exactly that field and asserts both implementations refuse it, and that
no verdict is printed.

### IN-02 — `--out` accepted a flag as its value

**Disposition:** fixed. **Commit:** `9d52cdd`

Mirrors the sibling parser's check, so the two CLIs answer the same mistake the
same way. The test asserts no file is written under the flag's own name, not
merely that the exit code is non-zero.

### IN-03 — a negative `limit` silently meant "print everything"

**Disposition:** fixed. **Commit:** `9d52cdd`

Refuses a negative or non-integer limit and documents `0` as unlimited (the
parameter previously had no documented semantics beyond its default, which is
why "negative means unlimited" was reachable by accident). The test pins both
surviving meanings alongside the refusals, so the fix cannot be mistaken for a
behaviour change.

### IN-04 — a malformed allow-list JSON was reported without the path

**Disposition:** fixed. **Commit:** `f016dc6`

Wrapped and named. On a route whose whole subject is which artifact says what,
which file failed to parse is the first thing an operator needs.

## Accepted — documented, deliberately not changed

### WR-08 — the capture predicate and the launch-profile chain have no production consumer

**Disposition:** accepted. **Commit:** `d7e6b8f`
**Files:** `src/mcp/vice/capture-predicate.ts`, `src/mcp/vice/vice-broker-client.ts`

**Reason:** an absent consumer is the expected state, not a defect. Phase 33
deliberately built the capture substrate ahead of phases 34-38 consuming it, so
neither wiring it up nor deleting it is correct: inventing a call site to
satisfy a census, and deleting working substrate, would both be worse than the
gap. The review offered exactly this as its alternative, and it is the arm
taken.

What *was* actionable is that neither module was **marked** as pending, while
`capture-predicate.ts`'s header calls it "the ONE authoritative place" and "the
ONE normalisation site (D-24)" — which reads as "in use" to anyone who has not
grepped. Both headers now record the status:

* `capture-predicate.ts` — imported by nothing outside its own tests and
  `derive-transients.test.mjs`, no CLI so no skill-side route either, and the
  only runnable equivalence check in the phase is the deliberate second
  implementation in `derive-transients.mjs`. "Authoritative" is restated as a
  design constraint on future callers, and `normalisePorts()` is named as never
  having run against a real capture.
* `vice-broker-client.ts` — the chain is tested at every hop but no production
  site passes a profile, so `-warp` and `-console` are unreachable today. Also
  notes that the first real consumer has to be on stock, since WR-03 now
  refuses the profile on fork.

Both paragraphs say what should happen to them when a consumer lands.

## Invariants held

Checked explicitly, because several fixes ran close to them:

* **`resources/*.mjs` are generated.** `broker-control.mts` and
  `broker-launch.mts` were edited and `node build.ts` re-run; only the two
  corresponding `.mjs` moved. `resources-sync.test.ts` green.
* **The broker's `inFlight` guard** — untouched; no fix went near
  `spawnAndRecordInstance()` or the synchronous check-and-set.
* **`profileEligible()` stays a synchronous filter before `await deps.probe`** —
  untouched. WR-03 was fixed at the control-plane narrowing site, not in the
  eligibility path, precisely so this structural property was not disturbed.
* **`TRANSIENT_ALLOW_LIST_CAP = 64` / refuse-don't-truncate** — untouched.
  CR-01 changes only what is *published*, never derivation behaviour.
* **The `new Uint8Array(n)` + `set` aliasing fix** — untouched.
* **`-default` precedes `-binarymonitor`** — preserved; WR-09 corrected only the
  comment and re-verified the argv over `RESOURCE_GET`.
* **The three frozen evidence files** — not modified, and no file added under
  `evidence/`. `git rev-list --count 2a8ef95 -- <evidence dir>` still returns 1.

## Gates

| Gate | Result |
|---|---|
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `cd src/mcp/vice && npm run test:automated` | at baseline — see below |
| `node scripts/check-npm-packages.mjs` | exit 0 |
| `node installer/scripts/sync-skills.mjs` | run after every skill-file edit |

All gates were run **in the main checkout** (`workflow.use_worktrees` honoured;
no worktree was created), so the numbers are reproducible from the tree as
committed.

**Baseline.** The pre-existing out-of-phase red baseline is 2 failures in
`src/mcp/vice/anno-register.test.ts` (`:389`, `:481` — one shared root cause,
requirement ids dropped from `.planning/REQUIREMENTS.md` at the v0.8.0
milestone open). Not fixed here, not this phase's.

The pre-fix run additionally showed 2 failures caused by `33-REVIEW.md` itself
existing without dispositions — `docs-review-disposition.test.ts:340` and its
cascade `audit-integrity.test.ts:236` — i.e. 4 failures in 3 files before any
fix. Both clear once this report and REVIEW.md's dispositions are committed,
returning the suite to the stated 2-in-1 baseline.

No new failure was introduced. Every test file touched by a fix was also run in
isolation, and each new negative control was confirmed to go red against the
unfixed source.

---

_Fixed: 2026-09-03_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
