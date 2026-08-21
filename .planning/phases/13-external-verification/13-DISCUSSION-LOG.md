# Phase 13: External Verification - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-21
**Phase:** 13-external-verification
**Areas discussed:** Ground-truth binary, Contradiction budget, Fixture provenance, Probe automation

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Ground-truth binary | Stock 3.9 vs fork 3.10 vs both, per capture | ✓ |
| Contradiction budget | How far "corrected at its source" extends; A4 in or out | ✓ |
| Fixture provenance | Replace the three synthetic pairs in place, or keep both | ✓ |
| Probe automation | One-shot transcripts vs committed tests excluded from the CI gate | ✓ |

**User's choice:** all four.

---

## Ground-truth binary

### Q1 — which binary is ground truth for the three re-recorded fixtures?

| Option | Description | Selected |
|--------|-------------|----------|
| Stock 3.9 first, fork as labelled fallback | Try genuine stock for every capture; fall back to the fork only where 3.9 physically cannot produce the frame, with the reason in the sidecar | |
| Both binaries, every fixture | Record all three from stock 3.9 AND fork 3.10 as separate labelled pairs; the only way to separate protocol drift from fork patching | |
| Genuine stock 3.9 only | Only `/usr/bin/x64sc` counts; the fork is the proxy this phase exists to escape | |
| *(free text)* | "first in path" | ✓ |

**User's choice:** free text — "first in path".

**Notes:** Reflected back in plain text, because "first in path" resolves to
`/usr/local/bin/x64sc` — the **fork** — which is in tension with the phase goal's
"against real binaries in place of the internal proxies". Two readings were
offered: (1) first-in-path full stop, stock-vs-fork out of scope; (2)
first-in-path as default plus a stock 3.9 cross-check recording only whether the
bytes differ. User picked **1**. The accepted consequence — that these fixtures
describe a binary Phase 14 might retire — is recorded in D-13-01 rather than
left implicit.

### Q2 — which binary probes the EXTV-03 assumptions?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-assumption, whichever binary the code path targets | A1 against genuine stock (its `buildViceArgs()` branch is stock-only); A2/A3/A5 against first-in-path | |
| First-in-path for all four | Consistent with D-13-01, one binary; cost is A1 saying nothing about the stock launch branch | ✓ |
| Both binaries for all four | Most thorough; catches version-dependent behaviour such as A5's `AUTOSTART` handling | |

**User's choice:** first-in-path for all four — *"Dont put to muth work on it
whatever emulator that is first found in path is the one to use. emulators can be
installd and removed at any tome by the user, and versions dosent realy matter as
long they have the same protocol interface."*

**Notes:** The stated principle became the governing rule for binary selection
(D-13-02) and produced a corollary the user did not have to ask for: probes must
resolve the binary through the project's own lookup rather than hardcoding a
path, since the host's emulator set is user-mutable. The A1 objection was then
checked instead of argued — both builds advertise `-remotemonitor` and
`-remotemonitoraddress`, so the flag-spelling question is answerable on either
binary and the objection dissolved. Recorded as a live finding in CONTEXT.md's
domain section.

### Q3 — what evidence should EXTV-02 commit?

| Option | Description | Selected |
|--------|-------------|----------|
| Full transcripts plus a real-hardware regression test | Both raw transcripts verbatim, plus a fixture test on the real strings kept separate from the ASSUMED fixtures | ✓ (Claude's call) |
| Transcripts only | Commit transcripts, flip §2 from OPEN to VERIFIED, no new test | |
| Test only, transcripts summarised | Add the test, summarise the long `--help` output | |

**User's choice:** *"If it matters you decide."* → Claude selected option 1, as
D-13-03, because the todo's own acceptance-check step 2 asks for exactly that and
it is the only option that prevents `classifyHelpOutput()` drifting later.

---

## Contradiction budget, Fixture provenance, Probe automation

These three areas were resolved by Claude under the user's standing delegation
(*"if you want to rework something pick it otherwise continue"*), presented as
D-13-03 through D-13-07 for approval rather than asked as separate questions —
the user had twice signalled not to over-invest in the discussion.

| Decision | Alternatives considered | Outcome |
|---|---|---|
| D-13-04 contradiction budget | (a) fix only inside the file the todo names; (b) fix wherever the assumption appears; (c) record everything, fix nothing in-phase | **(b)**, after the initial call was found factually wrong — see below |
| D-13-05 A4 scope | in scope / out of scope | **Out.** Not one of the four wire details, and probing it risks stalling the emulator thread |
| D-13-06 fixture provenance | replace in place / keep synthetic and real side by side | **Replace in place**; provenance survives in the README table, `docs/phase2-backend-probe-evidence.md` §1, and git history |
| D-13-07 probe automation | probes as committed tests (needing an emulator in CI) / probes as script + offline assertions as tests | **Script + offline tests**, matching plan 07-12's precedent |

### The reworked call (D-13-04)

Asked whether any call needed changing, the user said *"Change one of my calls"*
without naming one, then *"if you want to rework something pick it otherwise
continue"*. Claude picked **D-13-04** and verified the premise instead of
re-deciding by taste:

The original wording bounded repairs to "the file the todo names". A `grep` of
the `[ASSUMED]` sites showed that is wrong for two of the four assumptions — A2
is labelled in both `stock-execution.ts:227` and `stock-protocol.ts:742`, and A3
in both `stock-input.ts:161,166` and `stock-protocol.ts:791`. The original rule
would have permitted a probe to confirm A2, strip one label, and leave its twin
still claiming the detail unverified. `stock-protocol.ts:408` additionally
asserts a module-level "never silent" labelling convention that uneven removal
would falsify.

D-13-04 was rewritten so the correction unit is *every site carrying the label*,
enumerated by `grep` at execution time, with the escape hatch re-anchored to
**behavioural contract change** rather than file count.

---

## Claude's Discretion

- D-13-03 through D-13-07 in full (*"If it matters you decide"*).
- Within them: how the three independent sub-items split across plans, where the
  EXTV-02 transcripts live on disk, and the probe-extension shape inside
  `probe-binmon.mjs`.
- Not discretionary: anything widening scope past D-13-04's escape hatch, which
  becomes a todo instead.

## Deferred Ideas

- **Stock-vs-fork fixture drift** — the cross-check capture that would separate
  3.9→3.10 protocol drift from fork patching. Cut by D-13-01; revisit only if
  Phase 14 keeps the fork.
- **A4** — the `stop:false` rate limiter under a real synchronous
  `CHECKPOINT_INFO` flood. Stays in its own todo per D-13-05.
- **`fixtures/binmon/README.md`'s "genuine build" wording** for
  `/usr/local/bin/x64sc`, which omits that it is the patched build. Corrected
  in-phase as a side effect of D-13-06, logged so it is not read as scope creep.
- 18 todos were surfaced by the matcher at a uniform 0.6 score; the 3 real ones
  were folded and the other 15 were reviewed and routed to Phases 14/15/16 or
  dismissed. Full disposition in CONTEXT.md's `<deferred>` section.
