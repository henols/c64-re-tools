---
phase: 23-the-real-release-gate-go-degrade-no-go
source: 23-REVIEW.md
fixed_at: 2026-08-26
fixed_by: execute-phase orchestrator (phase-close gate)
commits: [97993bf, 8f07dd0, dac2217]
dispositions:
  fixed: 7
  deferred: 4
  total: 11
---

# Phase 23 — code review fix record

Dispositions for every finding in `23-REVIEW.md`. Applied at phase close, after 23-11, by
the execute-phase orchestrator rather than by a dispatched plan — the review ran as the
`execute:post` gate, which fires after the last plan has already completed.

**Nothing here changed the verdict.** It stays `no-go` under rule `R1`, and no
`could-not-run` was promoted to a pass. Every fix was verified by re-running the thing it
claims to fix, not by re-reading the prose.

## Fixed

### CR-01 — the "reproducible" measurement did not reproduce
**Commit `8f07dd0`.** The block printed `SCHEMA.md` § 6's flat-64K flag set with
`fixture.prg` appended; it exits 2 with `dxa: Could not open <entrypoints>.` because `-R`/`-B`
name inventory files plan 23-05 was never dispatched to produce. Stripped of those it gives
`code=0` against a record saying `code=179`.

Replaced with the invocation 23-02 actually ran
(`evidence/fixture/fixture-baseline.txt:50`). **Verified by re-running it**: rebuilt the
fixture with ACME, ran `dxa -U -p all-nmos6502 -t detect-all -a dump fixture.prg` through the
phase's own pinned `evidence/tools/dxa`, and parsed the listing —
`PARSE_CODE_BYTES: 179`, `PARSE_DATA_BYTES: 100`, `PARSE_ACCOUNTED_BYTES: 279`,
`PARSE_ADDRESS_RANGE: $0801-$0917`, matching the record exactly.

Also separated the `-g 0000` guidance (mandatory on a flat capture, wrong on `fixture.prg`,
which carries a genuine `$0801` header) and recorded that no `detect-internal` fixture number
exists anywhere in the evidence tree, so § 6's print-both protocol was specified but never
exercised.

### CR-02 — `201 multi-bit divergences` was cited to nothing
**Commits `97993bf`, `8f07dd0`.** The figure appeared in `STATE.md`, `ROADMAP.md`, a pending
todo, two SUMMARYs and the findings document, but **nowhere under `evidence/`** — a breach of
this tree's rule that every cited value is transcribed from a named outcome line. Cause: the
orchestrator measured it at phase close and wrote it straight into the durable record,
bypassing the protocol a dispatched plan would have followed. Plan 23-09 would have owned it
and was never dispatched.

Re-measured from scratch rather than copied forward; it reproduces at 201. Landed as
`evidence/capture/snapshot-divergence.txt` with the instrument `evidence/vsf-ram-extract.mjs`,
provenance stated at the head of the transcript. The transcript first proves the instrument
against 23-03's own hand-transcribed hex (two 8 KB chunks byte-identical; `$0000-$1FFF`
differing at exactly `$0000`/`$0001`, the 6510 port overlay a snapshot stores beneath).

### CR-03 — a fourth snapshot that was never saved
**Commit `8f07dd0`.** Corrected to the three handoff snapshots that exist
(`danish_r1_handoff`, `danish_r2_handoff`, `saeger_r1_handoff`), verified by listing
`~/.config/vice/mcp_snapshots/`. Records that `saeger` run 2 was compared **live** against run
1's snapshot rather than banked, that `probe_frame_a` is a checkpoint-imprecision probe and not
a handoff, and narrows "each proven faithful on reload" to the release it was performed for.

### CR-04 — "the corpus images are not in this repository" was false
**Commit `8f07dd0`.** Both `.d64` files are in the working tree at `evidence/corpus/`, because
the `vice` MCP surface refuses absolute paths outside the mounted workspace and 23-03 had to
place them there to autostart them. Verified: `git ls-files` reports **zero** tracked `.d64`.
Corrected to **never committed** — the claim D-04 actually makes, the one the evidence
supports, and the one this document already stated correctly elsewhere.

### WR-01 — Finding E was superseded and not updated
**Commit `8f07dd0`.** `deferred-items.md` recorded the corrected gate reading 19 minutes after
Finding E was written, and 23-11 ran afterwards without carrying it across — inverting
convention 7 (*final occurrence wins*). Finding E now records the green broker-free suite
(`# pass 2593  # fail 0`, exit 0) and `2408` as deterministic and broker-caused, proven both
directions. The honest split is preserved: `916` is genuinely load-sensitive (observed during
23-04, when no broker had been live since 2026-08-20); `159` and `2410` were never observed on
a broker-free host and stay **unresolved** rather than reclassified on one green run.

### WR-02 — arithmetically impossible pass/fail counts
**Commit `8f07dd0`.** Resolved as a consequence of the Finding E rewrite; the
"2592/2638 passing every time" sentence no longer exists (`grep 2592` returns nothing).

### WR-04 — the Ghidra headless block could not run as printed
**Commit `dac2217`.** Three defects, each checked against the rehearsal transcripts in
`evidence/tools/instrument-provenance.txt`: `-scriptPath` was missing (without it
`analyzeHeadless` finds neither script); the work was split across two invocations with
`-deleteProject` on the first, destroying the project the second needed; and
`-loader-baseAddr 0x0` was printed under a "rehearsed on the fixture" label when the fixture
rehearsals used `0x801`. Replaced with the single-invocation form rehearsed at
`instrument-provenance.txt:582`, with the fixture (`0x801`) and flat-capture (`0x0`) routes
separated and the flat route's synthetic-image caveat stated.

## Deferred, with reasons

None of these four affects a value, a citation, or the verdict.

### WR-03 — corrections 2 and 3 carry no disposition or owner
Assigning applied/not-applied dispositions to two corrections standing in `23-CONTEXT.md` is a
scope decision no dispatched plan owns. Left for whoever re-scopes v0.6.0 under `R1`.

### WR-05 — the opening provenance contract overstates what it can guarantee
A judgement about how strong a claim the document should make, not a factual error. No value
or verdict depends on it.

### IN-01 — `evidence/tools/verify/README.md` missing from the evidence index
Cosmetic index omission.

### IN-02 — the `082e -> 089a` comparand is unstated in both places
Genuinely unstated in criterion 2 and criterion 4 alike; resolving which is "the easy case"
needs context only a re-run of those criteria would settle, and neither was dispatched.
