# Phase 14 Plan 01: FORK-01 Decision Brief

This is the document to read before Task 2's checkpoint. It presents the
evidence assembled in `14-RESEARCH.md`, organized around the actual decision.
**It does not recommend an outcome.** Where research's own prose leans toward
one option, that lean is deliberately not carried forward here — the choice
is the human's.

## The question

**FORK-01** (`.planning/REQUIREMENTS.md:60`), verbatim:

> The fork-backend question is answered by a dated decision in PROJECT.md →
> Key Decisions that names the criteria which would reverse it, including the
> upstream `KEYBOARD_MATRIX_SET` coupling — not retained by default for a
> third close

ROADMAP.md Phase 14's three success criteria, verbatim (`.planning/ROADMAP.md:174-176`):

1. PROJECT.md → Key Decisions carries a dated `FORK-01` entry naming the
   criteria that would reverse it, explicitly including the upstream
   `KEYBOARD_MATRIX_SET` coupling
2. A user who hits SID read-back, matrix keyboard, or RESTORE/NMI is told, at
   the point of use, a route they can actually follow — evidenced by the live
   doc/skill text, not merely asserted in this roadmap
3. The decision is reflected in the code's actual state, checked live: if
   "remove", no code path still advertises or spawns the fork transport; if
   "retain", the retained path is exercised once more against a real fork
   binary and still passes

## The three options

Use exactly these three literal tokens when answering Task 2's checkpoint —
every downstream plan (14-02, 14-04, 14-05) dispatches on them.

### `retain`

The fork stays the default. PROJECT.md's line-109 Out-of-Scope bullet
("Removing or deprecating the fork backend") is **formalised with named
reversal criteria** rather than superseded.

- **Recorded:** a dated FORK-01 Key Decisions row stating the retain outcome
  and the reversal criteria (see "Reversal criteria — draft text" below).
- **Code change:** none.
- **Criterion 1:** satisfied — the dated row is the deliverable.
- **Criterion 2:** already satisfied today, on this branch, by construction —
  the three hard-loss routes already exist, are already annotated in skill
  prose, and are already mechanically checked (research Q4).
- **Criterion 3:** satisfied in-phase by 14-03's live exercise of the fork's
  own `-mcpserver` HTTP transport against a real fork binary — the first such
  exercise this milestone, and possibly since v0.1.x (research Q3).

### `deprecate-first`

The decision recorded is "remove, one release later." `resolvedBackend()`'s
indeterminate-probe fallback flips from `fork` to `stock`, and a one-time
deprecation notice is emitted (14-04's scope).

- **Recorded:** a dated FORK-01 Key Decisions row stating the decision to
  remove, with a named release/removal window, and the line-109 bullet
  rewritten to record that FORK-01 superseded it.
- **Code change:** `backend-detect.mts`'s indeterminate-probe fallback
  literal flips from `"fork"` to `"stock"`; a deprecation notice is added;
  the compiled `resources/backend-detect.mjs` mirror is rebuilt to match
  (this project's own "no build step for the shipped server, but host-bound
  `.mts` must be compiled" rule).
- **Criterion 1:** satisfied — the dated row is the deliverable.
- **Criterion 2:** satisfied in-phase — the routes still exist (the fork
  binary is not yet deleted on this branch), so no rewrite is forced this
  phase.
- **Criterion 3:** satisfied in-phase — the fork path still exists and is
  live-exercised by 14-03, exactly as on `retain`.

### `remove-now`

Full deletion of the fork backend.

- **Recorded:** a dated FORK-01 Key Decisions row stating the decision to
  remove immediately, with the line-109 bullet rewritten to record that
  FORK-01 superseded it.
- **Code change:** this phase's plan set **cannot complete the deletion
  in-phase.** Research Q1/Q2 sizes the removal at:
  - ~15 production modules touched, several (`vice.ts` at 772 lines
    especially) not cleanly separable — 13 stock-side modules import shared
    types (`ViceError`, `MachineRestartedError`, `readEpoch()`, `mcpHost()`,
    `type ToolInfo`) from the same file that hosts the fork's `call()` seam,
    so deletion requires first extracting those shared exports, not a
    straight `git rm`
  - 23 test files carrying between 1 and 53 fork-string mentions each
  - 4 skill playbooks (`c64-program-recon`'s four reference docs plus its
    `SKILL.md`, `c64-ram-capture/SKILL.md`, `vice-wedge-triage/SKILL.md`)
  - `README.md` (the entire backend-choice section, lines 72-157)
  - `docs/stock-vice-parity.md` (its two-way gap analysis collapses to a
    one-way loss list)
  - a **premise rewrite**, not a parameter tweak, of the 505-line
    `scripts/check-skill-fork-honesty.mjs` — every one of its non-vacuity
    assertions (`FORK_ONLY_NAMES.size >= 20`, `totalForkMentions >= 8`,
    required-substring checks naming `vice_sid_get_state` /
    `vice_keyboard_matrix` / `VICE_BACKEND`) is written assuming the fork is
    a live alternative; on removal the whole checked invariant changes shape
    from "does every fork-only mention carry a fork-requirement annotation"
    to "does every hard-loss mention carry an honest no-route statement"
- **Criterion 1:** satisfied — the dated row is the deliverable regardless of
  code-change timing.
- **Criterion 2:** cannot be satisfied in-phase for SID read-back or
  RESTORE/NMI without the full rewrite above; would require this phase to
  also complete the FORK-02 rewording, which is out of this phase's sized
  scope.
- **Criterion 3 (the remove clause):** **cannot be satisfied in-phase.**
  Choosing `remove-now` means Phase 14 seals with criterion 3's remove clause
  recorded **unmet**, and the orchestrator must insert a follow-on phase to
  perform the deletion itself. This is stated plainly, not softened: the
  decision can be *recorded* this phase; the deletion cannot be *completed*
  this phase.

## What removal costs

**Published-package contract.** `tools-manifest.json` lists 62 named tools —
this is what `@henols/vice-mcp`'s currently-published npm tarball advertises.
`scripts/check-npm-packages.mjs:55` asserts that file's presence in the pack.
This project's own release automation auto-publishes a patch version on every
merge to `main` **unless the commit subject carries `[skip release]`** — so a
breaking removal of 62 advertised tools needs a deliberate major-version
release path, not a default merge. Shipping the removal as a silent patch
bump would itself be the exact "silent" failure mode FORK-01's requirement
text exists to forbid, applied to the package contract instead of the
planning record.

**Pitfall 1 (research, confirmed this session): `vice.ts` is not a separable
fork module.** It is simultaneously the fork's HTTP `call()` transport seam
*and* the shared home of `ViceError`, `MachineRestartedError`, `readEpoch()`,
`mcpHost()`, and `type ToolInfo` — imported by 13 stock modules
(`stock-condition.ts`, `stock-recycle.ts`, `stock-diagnose.ts`,
`stock-dispatch.ts`, `stock-connect.ts`, `stock-derived.ts`,
`stock-handler.ts`, `stock-address.ts`, `stock-petscii.ts`, `stock-paths.ts`,
`stock-timing.ts`, `stock-symbols.ts`, `vice-broker-client.ts`), none of which
use `call()`. Any removal plan must extract the shared exports into a module
that survives the deletion before deleting `call()` and its direct
dependents, or the deletion breaks 13 unrelated stock files at typecheck
time.

## What retain costs

The steady-state cost of `retain` is already paid — the dual test matrix (23
fork-string-referencing test files, mostly shared with stock coverage rather
than duplicated), the dual manifest, the 505-line honesty-check script, and
the doc caveats throughout README/skills are already written, already
committed, and already running in CI.

**The one unpaid cost:** no test in this repository currently drives the
fork's HTTP transport against a real, live `-mcpserver` process.
`broker-e2e.test.ts` — the one end-to-end broker test that spawns a real
child process — explicitly stubs `VICE_BIN` to `/bin/sleep`, and its own
header states plainly that no real emulator runs anywhere in that test and no
test opens a connection to the host VICE. Phase 13's live captures spoke
`-binarymonitor` (the **stock** protocol) to the fork *binary*
(`/usr/local/bin/x64sc`), not the fork's own `-mcpserver` HTTP endpoint — so
even those recent, real, live-binary captures did not exercise the fork
transport itself. This means criterion 3's live exercise is not a formality
on the retain branch: it is the **first-ever** live exercise of the fork's
actual HTTP transport this milestone, and possibly since v0.1.x. 14-03 pays
this cost on every branch that keeps the fork alive through this phase
(`retain` and `deprecate-first` both).

## The two open questions

Both are put to the human explicitly at Task 2's checkpoint, because an
executor inferring either mid-task would be walking a decision the phase
exists to make deliberately.

**Open Question A — is "remove" full deletion now, or deprecate-then-delete?**
The standing todo
(`.planning/todos/pending/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`)
raises this itself and never answers it: "is this 'delete the fork backend'
or 'stop defaulting to it and stop testing it'?" Deprecate-first (keep the
code, flip the default to stock, remove a release later) is explicitly
offered there as the lower-risk alternative to full deletion. Whether
FORK-01's "not retained by default" clause is satisfied by deprecate-first
(which is still, technically, retaining the code) or requires the harder
either/or the roadmap's phrasing implies is exactly the ambiguity this
checkpoint resolves.

**Open Question B — does FORK-02's "a route they can actually follow"
require a replacement capability, or is an honest statement of permanent
loss itself the satisfying route?** On a non-`retain` branch, no client-side
route exists at all for SID read-back or RESTORE/NMI (research Q4) — there is
nothing to substitute. For matrix keyboard, `vice_joystick_set` is a genuine
partial route independent of the fork. The plan's default reading, unless
overridden at the checkpoint: an honest, complete statement of the loss with
no dangling promise of a fix satisfies FORK-02 for SID read-back and
RESTORE/NMI on a non-`retain` branch — this matches how
`capability-registry.ts`'s own `"descoped"` category already phrases
genuinely-unbuilt (not unrecoverable) losses today.

## Reversal criteria — draft text

Ready-to-paste prose for the PROJECT.md Key Decisions row, folding in
`UP-01`'s existing wording (`.planning/REQUIREMENTS.md:87`):

> A `KEYBOARD_MATRIX_SET` opcode for VICE's binary monitor (~60 lines in
> `monitor_binary.c` calling the existing `keyboard_set_keyarr_any()`) has
> **not** landed as of VICE 3.10 — confirmed live against the VICE 3.10
> manual's binary-monitor command list, whose only keyboard-related command
> is `0x72` (buffer-text feed). Even after it lands upstream, Debian/Ubuntu's
> `apt` path is already one release behind (shipping 3.9, which lacks even
> `CPUHISTORY_GET` from 3.10), so a landed opcode would need a further
> release cycle to reach this project's documented primary install path.
> Landing it closes the matrix-keyboard loss specifically; its effect on
> RESTORE/NMI is **unconfirmed**, not assumed closed (RESTORE pulses the NMI
> line directly, not the keyboard matrix, and no artifact establishes whether
> the same or a sibling call would also drive it). It closes SID read-back
> **not at all** — SID's `$D400-$D418` registers are write-only in hardware,
> a fact no opcode addition changes. This trigger is manually tracked, not
> mechanically probed: building a version-detection probe for an opcode with
> zero wire presence today is out of this phase's scope.

## Stale framing to ignore

`docs/roadmap-stock-vice.md` (pre-migration ADR, historical) frames the
binary monitor's single-TCP-connection model as a *cost* of going stock
("the broker/concurrency model needs review"). This is **corrected** by
`.planning/notes/stock-vice-migration-revised-loss-ledger.md`, which
establishes it is a non-issue: the fork's own `-mcpserver` HTTP session is
*already* one stateful connection per instance, so the topology carries over
unchanged — only the event-demux shape differs between the two protocols. A
reader who consults `docs/roadmap-stock-vice.md` cold, without also reading
the loss-ledger note, would inherit the stale, corrected claim. Recorded here
so the human deciding FORK-01 is not handed it.

## Caveats carried into the decision

From research's Assumptions Log — none is load-bearing for FORK-01/FORK-02's
own success criteria, but each qualifies how confidently the reversal-criteria
wording and the retain-branch carrying-cost framing can be stated:

- **A1** — whether `keyboard_set_keyarr_any` (or a sibling VICE-core call)
  could also be extended to drive the RESTORE/NMI line, closing all three
  hard losses rather than just matrix-keyboard, is **unconfirmed**. Overstating
  this in the PROJECT.md row would be wrong; the reversal-criteria draft above
  deliberately states RESTORE's closure as unconfirmed rather than assumed.
- **A2** — the fork maintainer's (`barryw/vice-mcp`) current activity level
  was **not checked this session** against the third-party repository. The
  pending todo's "near zero" incremental-cost framing for retain dates from
  2026-08-11; if the fork has drifted or gone stale since, that framing may
  already be out of date.
- **A3** — no artifact read this session establishes whether any real
  consumer runs the fork transport (`VICE_BACKEND=fork`) in production today.
  If one does, an untested-transport regression in the fork's HTTP path would
  be invisible until 14-03's live exercise or a user report surfaces it.
