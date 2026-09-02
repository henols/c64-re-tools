# Phase 33: The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-02
**Phase:** 33-The Reproducible-Run Protocol and the Capture Substrate (Go/Degrade/No-Go)
**Areas discussed:** Gate rules & inputs, Evidence & red controls, Run-protocol surface, Capture substrate

---

## Gray area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Gate rules & inputs | `GATE-01`'s rule set: named inputs, thresholds, degrade narrowing; must not abstain the way Phase 23's did | ✓ |
| Evidence & red controls | Five controls that must be "observed red": transcripts vs. live tests vs. `MANUAL_ONLY_TESTS` (exactly nine files, a reviewed milestone decision) | ✓ |
| Run-protocol surface | The optional `vice_run_until` argument's shape and backends; how warp/headless are requested; warm-instance eligibility | ✓ |
| Capture substrate | Slicer home; allow-list derivation, cap and commit location; which release supplies `CAP-04` | ✓ |

**User's choice:** *"you sugests"* — free-text, delegating the whole discussion
rather than selecting a subset.

**Notes:** Interpreted under the standing autonomy preference as "select all
areas and decide them yourself". All four areas were therefore resolved by
Claude, single pass, with each decision recorded in CONTEXT.md alongside the
rationale a later reader would need to overturn it. No auto-advance to
plan-phase was performed — `--auto`/`--chain` were not passed.

---

## Gate rules & inputs

| Option | Description | Selected |
|--------|-------------|----------|
| Rules in their own early plan, git order as proof | Phase 9 / Phase 23 `D-07` shape; plan `33-01` touches nothing else | ✓ |
| Rules inside the first measuring plan | Fewer plans, but the ordering proof is gone | |
| Rules as a test-enforced schema | Encodes roadmap policy in a suite belonging to a phase that ships almost no code | |

**Choice:** Rules as plan `33-01`, nothing else in it (`D-01`).
**Notes:** Five named inputs (`D-02`), of which four are corpus-free by
construction, so `C0_CAPTURE_PAIR: not-obtained` is an input *value*, never a
reason to abstain — the specific defect Phase 23's gate carried. `could-not-run`
is structurally not emittable (`D-03`). Pre-mapped `degrade` narrowing limited
to `C0_CAPTURE_PAIR` and `ORACLE_NECESSITY` (`D-04`), the two where a
post-measurement mapping would be most suspect. Verdict as frontmatter in
`docs/phase33-reproducible-run-gate-findings.md` (`D-05`), binding Phases 34-38
through ROADMAP + STATE pointers with no test guard (`D-06`, Phase 23 `D-08`
carried).

---

## Evidence & red controls

| Option | Description | Selected |
|--------|-------------|----------|
| Committed transcripts from named repeatable scripts | A control whose purpose is to be red cannot live in a green suite; corpus-bound ones cannot run in CI at all | ✓ |
| New entries in `MANUAL_ONLY_TESTS` | Would grow a nine-file list that is a reviewed milestone decision, and the list is pinned by an exact `deepEqual` | |
| Live tests in the automated suite | Fails on every machine without the corpus | |

**Choice:** Transcripts (`D-07`); `MANUAL_ONLY_TESTS` stays at nine, with the
same-commit rule if that ever changes (`D-08`).
**Notes:** Two exceptions become real automated tests because they are
corpus-free and must not regress: `CAP-03`'s structural bar and `CAP-02`'s
fail-ability over a synthetic pair (`D-09`). Evidence scripts live under the
phase directory, not `src/` — the slicer and predicate are the only
deliverables (`D-10`). Every live run is taken with the broker stopped and the
`test:automated` floor of 0 recorded alongside it (`D-11`), because a live
broker reddens `BACK-05` deterministically and would make every number in the
phase suspect.

---

## Run-protocol surface

| Option | Description | Selected |
|--------|-------------|----------|
| Optional `reproducible` boolean on `vice_run_until`, stock-only | One seam, one call site; fork manifest stays frozen; matches the compat rule allowing stock-only optional params | ✓ |
| A separate `vice_run_reproducible` tool | A second route a caller can forget — exactly what `REPRO-02` forbids | |
| Composable sub-flags (`skip_reset`, `no_anchor`) | Ships the protocol-without-the-reset as a supported option | |

**Choice:** Optional `reproducible` argument, stock-only, absent by default
(`D-12`); whole-procedure switch with no sub-flags (`D-13`).
**Notes:** `reproducible: true` **requires** a sibling `frame_anchor` address
and refuses without one (`D-14`) — no KERNAL default is safe to guess on a
release that takes over the IRQ, and refusing beats silently degrading to the
two-term oracle `REPRO-03` guards against. Warp/headless arrive as an additive
optional `profile` object on the existing broker `acquire` op (`D-15`), copying
`broker-launch.mts`'s own `backend?:` precedent so the three whole-argv
`deepEqual` assertions stay green and the fork argv promise holds. A
non-matching pre-warmed instance is ineligible and gets a dedicated launch
rather than a retro-warp or a silent unwarped grant (`D-16`). The stale warp
sentence is re-grounded to say both true things, with `docs/tool-support.md`
regenerated in the same commit (`D-17`), and `probeReady`'s wall-clock timeouts
are re-checked under warp in the same plan (`D-18`).

---

## Capture substrate

| Option | Description | Selected |
|--------|-------------|----------|
| Container-side module in the shipped tree + thin skill wrapper | Reads a file, spawns nothing; `snapshotPathFor()` already makes the `.vsf` container-visible | ✓ |
| A new MCP tool | Touches the stock manifest, conformance tests and parity tables in a phase already breaking several guards | |
| Host-tool seam (Phase 34) | Reserved for external binaries; this is not one | |

**Choice:** `src/mcp/vice/vsf-slice.ts` plus a wrapper under
`c64-ram-capture/scripts/` (`D-19`); not promoted to a tool this phase (`D-20`).
**Notes:** The slicer walks the snapshot's module table rather than using a
fixed offset, and asserts a `4 + 65536` body (`D-21`) — an offset-based slicer
would produce garbage rather than an error, the worst failure mode for the
substrate every downstream number rests on. Transient allow-list is a
per-release committed JSON artifact under a **cap of 64 addresses** (`D-22`),
reasoned from the only measurement in hand (3 of 1024 at the `READY` prompt,
itself an upper bound) — one order above it, a quarter of the page the
requirement names as over-wide. Overflow **voids the derivation**; it is a fact
the gate must hear, not a threshold to raise. The method carried forward is
N >= 3 runs, union of pairwise differences, re-derived per release, no address
set inherited (`D-23`). The `$0000`/`$0001` port overlay is normalised in code,
not by spending allow-list slots (`D-24`). Planted-byte control asserted red
twice — synthetic in CI, real in transcript (`D-25`). `CAP-03`'s bar is a
structural test, written with `grep -a` because one source file in this tree
carries a NUL byte and is invisible to plain grep (`D-26`). Corpus is one
operator-supplied release identified by name + sha256, never committed (`D-27`,
Phase 23 `D-04` carried); a second release is a stretch input. The memspace
assertion's ability to refuse is proven by transcript after a deliberate drive
checkpoint hit (`D-28`). The capture record gains the three-field
reproducibility key with the 76-byte counterexample quoted inline (`D-29`).

---

## Claude's Discretion

All 29 decisions, under the owner's *"you sugests"* delegation. The three worth
a second look before `33-01` is committed, flagged in CONTEXT.md:

- **D-04** — which two inputs get pre-mapped `degrade` narrowing. Wrong here
  means a narrowing authored after the numbers were visible, which is the
  failure the gate exists to prevent.
- **D-22** — the cap of 64. Reasoned from a single measurement taken under
  different conditions, and it is a pre-commitment, so raising it later has a
  cost.
- **D-14** — refusing when `frame_anchor` is absent. The one decision that
  deliberately makes the tool harder to call.

## Deferred Ideas

- Absolute-cycle stop identity via `CPUHISTORY_GET` — blocked by the VICE 3.10
  floor (host runs 3.9); already recorded as deferred in REQUIREMENTS.md.
- Promoting the `.vsf` slicer to an MCP tool — additive, revisit at a second
  consumer.
- A second corpus release — would strengthen the claim that the derivation
  *method* generalises.
- A test guard on the gate's downstream binding — declined by `D-06`, addable
  later.

Seven cross-referenced todos were reviewed and not folded; they are listed with
their reasons in CONTEXT.md's `<deferred>` section.
