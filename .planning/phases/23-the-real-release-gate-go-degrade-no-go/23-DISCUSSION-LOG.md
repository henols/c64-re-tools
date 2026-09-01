# Phase 23: The Real-Release Gate (Go/Degrade/No-Go) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-26
**Phase:** 23-The Real-Release Gate (Go/Degrade/No-Go)
**Areas discussed:** Corpus and screening, Verdict shape and pre-commitment

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Corpus acquisition | Where the corpus comes from; how many; what qualifies | |
| Ground truth for the numbers | How data-recovery / false-positive are defined with no `.lbl` | |
| Screen or take as found | Pre-screen for computed dispatch and `$01` banking, or report absence | ✓ |
| Verdict shape + pre-commit | Phase 9's `R1..R5` shape; how Phase 24 is gated | ✓ |

**User's choice:** Both selected areas, plus free text: *"Dont use the t2000 for
any thing it has to be removed, lets use vice to go to the code where we
areintrested in om reverse engeenger"*

**Notes:** The free text was read as two standing constraints rather than an
area selection — anno excluded as an instrument (it is `CUT-01` scope), and
VICE as the means of reaching the code under study. Both were applied to every
subsequent question in the session and are recorded as `D-01` / `D-02`.

Two areas were defaulted without being offered, and stated as such at the time:
tooling provisioning, and `PROOF-04`'s audit depth. Both appear under Claude's
Discretion in CONTEXT.md.

---

## Corpus and screening

### Q1 — What do dxa and Ghidra get measured on?

| Option | Description | Selected |
|--------|-------------|----------|
| Depacked RAM capture | Autostart in VICE, run past the depacker, checkpoint, capture flat 64K. Only route where a data-recovery number means anything | ✓ |
| Packed `.prg` as shipped | Offline and simple, but a compressed payload is high-entropy bytes — measures the packer, not the game | |
| Both, side by side | Honest about the difference, but roughly doubles the work for a number expected to be meaningless | |

**User's choice:** Depacked RAM capture.
**Notes:** Consistent with the milestone's standing "no unpacker; depack-by-running
is sufficient" decision.

### Q2 — Where does the release come from?

| Option | Description | Selected |
|--------|-------------|----------|
| You supply it locally | Operator points at a real release already on the machine; identified by name + sha256 | ✓ (on revision) |
| Fetch from public archives | CSDb / Internet Archive, URL and hash recorded; third-party reproducible but adds a network dependency to a gate | |
| Real third-party demo code | Removes the self-authored defect, but not cracked — leaves criterion 1's `CRACKER-PATCH` separation unexercised | |
| Corpus absence is the verdict | Acquire nothing; record no-corpus as a gate input and let the rule fire | ✓ (first answer, revised) |

**User's choice:** initially *"Corpus absence is the verdict"*, then revised to
*"I'll supply something after all"*, and on follow-up: **"disk image or a prg"**.

**Notes:** The first answer was challenged rather than accepted, because it
conflicted with Q1 (a depacked capture requires something to depack) and because
it decides the outcome before the rules exist — which the ROADMAP explicitly
forbids ("write the rules before you have the answers"). A three-option
disambiguation was put back to the user: build the machinery and record gaps /
absence is the whole phase / supply an image. The third was chosen.

The absence branch was **not** discarded — it survives as a rule input for
whatever the supplied corpus turns out not to contain (see Q3).

Flagged at this point and carried into CONTEXT.md rather than resolved:
`c64-provenance-diff` is an N-way diff, so a single image cannot be
provenance-classified, and criterion 1's cracker-vs-game separation needs
another method.

### Q3 — How is the risk that criteria 2 and 3 are absent handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Inventory first, reject nothing | Record what the capture contains before measuring; no rejection, so no selection bias; "not exercised" becomes pre-declared | ✓ |
| Screen and swap | Keep looking until an image has both constructs. Strongest test, but selects for code that suits the tools | |
| Take it as found | Measure and report `not_exercised`. Zero extra work, but the gate can pass without testing what it exists to test | |

**User's choice:** Inventory first, reject nothing.

### Q4 — What produces the inventory?

| Option | Description | Selected |
|--------|-------------|----------|
| VICE runtime observation | Watchpoint `$01`, checkpoint the dispatch site. Observed not inferred; neither engine under test touches it | ✓ |
| In-house static decoder | `disasm-*.ts` sweep — offline and deterministic, but finds candidates without proving execution | |
| Both, runtime as authority | Most complete; catches paths a play-through misses, at the cost of building two things | |

**User's choice:** VICE runtime observation.
**Notes:** The question was framed around a circularity trap surfaced before
asking — if dxa or Ghidra produced the inventory, criterion 2 would reduce to
"Ghidra resolved the dispatch that Ghidra found".

---

## Verdict shape and pre-commitment

### Q1 — How is "rules before answers" made structural?

| Option | Description | Selected |
|--------|-------------|----------|
| Rules in their own early plan | Plan 23-01 writes rules + inventory format, touches nothing else; git history is the proof | ✓ |
| Rules plan plus a test guard | Mechanically enforced, but guards a property git already records, in a phase shipping no code | |
| Rules inside the verdict document | Fewer files, but pre-commitment becomes a claim about an earlier revision of one file | |

**User's choice:** Rules in their own early plan.

### Q2 — How does the verdict gate Phase 24?

| Option | Description | Selected |
|--------|-------------|----------|
| ROADMAP + STATE pointers | Phase 24's `Depends on` and Notes name the file and field; Phase 9's own closure shape | ✓ |
| A guard that reddens on no-go | Structural, but encodes roadmap policy in the test suite — and cannot check `degrade`, the likeliest outcome | |
| Both | Belt and braces, at the cost of a test whose main branch should never fire | |

**User's choice:** ROADMAP + STATE pointers.

### Q3 — Does the rule pre-enumerate what `degrade` narrows?

| Option | Description | Selected |
|--------|-------------|----------|
| Pre-map the two high-risk criteria | Criteria 2 and 3 mapped up front; rest authored at verdict time | ✓ (Claude's discretion) |
| Phase 9 shape — author at verdict time | Literally what Phase 9 did; simplest, but decided by someone who has seen the numbers | |
| Pre-map every criterion | Maximum pre-commitment, but front-loads speculation and may not fit the actual failure | |

**User's choice:** *"You decide."*
**Notes:** Decided as pre-mapping criteria 2 and 3 only. Criterion 3 is named in
the ROADMAP as the highest-risk item on the pivot's own record and criterion 2 is
the case the fixture never exercised, so those are where a post-hoc mapping is
most suspect; criteria 1, 4 and 5 produce a number, a capability list, and the
rule itself respectively.

### Closing

| Option | Description | Selected |
|--------|-------------|----------|
| Ready for context | Write CONTEXT.md; remaining opens recorded as flagged assumptions | ✓ |
| Explore more gray areas | Criterion 1's operational definitions; cracker/game separation on one image; verdict document location and frontmatter contract | |

**User's choice:** Ready for context.
**Notes:** The three named opens were offered and declined; all three are written
into CONTEXT.md `<specifics>` as questions the researcher must close, not as
silent gaps.

---

## Claude's Discretion

- `degrade` narrowing pre-mapped for criteria 2 and 3 only (explicit "you decide").
- Ghidra provisioning — reuse the surviving `~/dev/_ghidra-probe` install;
  record the version, treat the path as an undeclared external input.
- dxa provisioning — not present on this host (lost with `/tmp`, which is tmpfs);
  build 0.1.5 throwaway but pin the exact version, since `DXA-01` must vendor
  the same one the gate measured.
- `PROOF-04` audit depth — source read of `analyzer.rs` from the local cargo
  registry, no anno execution.
- Ghidra pre-script technique — reuse `BankProbe3.java`'s `getBlock()`-first
  guard verbatim.

## Deferred Ideas

- `anno-coverage.ts` is absent from `CUT-02`'s survivor list and so appears to
  fall inside `CUT-01`'s deletion. Consistent with the owner's intent; flagged
  for Phase 25's planner to confirm as deliberate.
- Fetching a corpus from public archives — revisit only if the supplied image
  cannot exercise criteria 2 and 3.
- A test guard on Phase 24 gating — revisit if the ROADMAP/STATE pointer proves
  insufficient.
- Pre-mapping `degrade` narrowing for all five criteria.
- Todo reviewed and not folded: *Reap vicerc scratch dirs in broker kill/recycle
  path* (matched at 0.2 on the keyword "milestone"; unrelated).

## Filed during this session

- `.planning/todos/pending/2026-08-26-correct-the-false-real-corpus-claim-in-research-questions-md.md`
  (major) — `research/questions.md` asserts the `c64-provenance-diff` fixtures
  are "real releases, already committed" in this repo. They are not. Captured via
  `/gsd-capture` mid-discussion; commit `fd1093b`.
