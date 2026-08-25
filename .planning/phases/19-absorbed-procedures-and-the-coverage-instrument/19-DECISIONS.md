---
phase: 19
slug: absorbed-procedures-and-the-coverage-instrument
recorded: 2026-08-24
plan: 19-05
requirement: ABS-04
status: recorded
---

# Phase 19 — Dated Decisions

Five decisions this phase's own diff produced. ABS-04's prohibition governs every one
of them: *a decision whose reversal condition is unstated is a preference, not a
decision.* Each entry therefore carries four things — what was decided, the evidence it
rests on with a citation, the alternatives that were weighed and why they lost, and a
**named, checkable** condition under which it is revisited. "If it turns out to be
wrong" would not qualify; every condition below is something a person can notice
happening, or a command can notice for them.

The reason this file exists at all is the failure ABS-04 names: a consequence
discovered at the next milestone close. Two of the five (decisions 2 and 5) are exactly
that class of consequence — they were produced by the absorption diff rather than
planned, and they are dated here so Phase 20 opens knowing about them instead of
finding them.

---

## Decision 1 — The absorbed procedures are a SNAPSHOT at one pinned commit, and re-sync is a hash comparison

**Decided:** 2026-08-24 (plans 19-01, 19-02; recorded 19-05)

The five upstream analyze procedures are absorbed as a **snapshot** of upstream's text
at one pinned commit, not as a tracked dependency. There is no live link back to
upstream and no automatic notification when upstream edits them.

**The snapshot:** `ricardoquesada/regenerator2000` @
`493f840418f1450a342bb220c2fe3d2585dd0525` (v0.9.20, 2026-07-11) —
**53,392 bytes across five paths**:

| Upstream path | Bytes | sha256 (first 12) | Absorbed into |
|---|---:|---|---|
| `.agent/skills/r2000-analyze-basic/SKILL.md` | 4,457 | `8fc662ce52a1` | `src/skills/c64-program-recon` |
| `.agent/skills/r2000-analyze-blocks/SKILL.md` | 14,674 | `3fad6193466a` | `src/skills/c64-memory-mapping` |
| `.agent/skills/r2000-analyze-program/SKILL.md` | 15,308 | `2d1c91bcc612` | `src/skills/routine-queue-walker` |
| `.agent/skills/r2000-analyze-routine/SKILL.md` | 9,248 | `6fd26337de42` | `src/skills/c64-program-recon` |
| `.agent/skills/r2000-analyze-symbol/SKILL.md` | 9,705 | `d57d9c2fdfa1` | `src/skills/c64-memory-mapping` |

**Evidence.** The pin is corroborated two independent ways: the clone at that commit,
and the installed crate's own `.cargo_vcs_info.json`, whose recorded sha1 equals it
(19-RESEARCH.md §1.1). The text is obtainable **only** from the GitHub repository —
`Cargo.toml.orig:31-42`'s `exclude` list drops `.agent/**/*` from the published crate,
so there is no version-pinned package to diff against automatically (§1.1, §1.2).
Digests and byte counts above are re-verified byte-exact by
`src/mcp/vice/r2000-upstream-audit.test.ts` whenever a clone is reachable, and that test
rejects an abbreviated or floating ref outright (19-01-SUMMARY.md D5).

**Alternatives weighed.**
- *Vendor the upstream directory verbatim and diff it mechanically.* Rejected: the
  published crate excludes it, so vendoring would still be a manual fetch, and it would
  additionally ship 53KB of another project's prose inside two npm tarballs while
  contradicting the "ADAPTED, NOT VERBATIM" attribution the headers actually make true.
- *Track upstream as a git submodule.* Rejected: it turns an offline documentation
  dependency into a network dependency of the build, for text that changes rarely.
- *Leave the drift risk unstated.* Rejected — that is the ABS-04 failure itself.

**Why a snapshot is the right shape here.** The manifest already carries a `sha256` per
file, so re-sync is a **hash comparison, not a read-and-judge**. That is the cheap part,
and it is what makes the trade acceptable rather than merely accepted: checking whether
upstream moved costs five hashes and a diff, not five readings.

**The checking mechanism** is the `resync_triggers` array in
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`,
which carries each trigger together with the mechanism that answers it. Both triggers
below are entries in that array, not prose here.

Re-sync condition: EITHER (a) the installed `regenerator2000` moves off `0.9.20` — at
which point read the NEW crate's own `.cargo_vcs_info.json` for the commit it was
published from (no guessing at a tag), fetch the five paths at that commit, sha256 each,
and diff against this manifest's five digests; OR (b) `r2000_get_binary_info`'s response
field set changes — `AppState::file_info()` already computes `packer_name` and `is_packed`
and discards them before the handler's `json!` block, so the day either reaches that
block, decision 3's whole negative result collapses to a one-field read. Trigger (b) is
deliberately sharper than "watch for a new release": it names a specific tool's response
shape, which a single live `tools/call` answers.

---

## Decision 2 — Two future-surface tools are PROPOSED here and implemented at the start of Phase 20

**Decided:** 2026-08-24 (plan 19-05)

`r2000_toggle_splitter` and `r2000_set_immediate_format` are **proposed** now, with the
requirement each serves named, and **implemented at the start of Phase 20**. Neither is
added to `CURATED_R2000_TOOLS` in Phase 19.

**Why this is a decision and not a backlog note.** The absorption diff turned out to be
a **requirements-discovery instrument**. Both calls were previously recorded in
`src/mcp/vice/r2000-tools.ts`'s header as having *no criterion* — the exact words were
"`toggle_splitter` has no criterion" and "`set_immediate_format` [has] no criterion in
this phase". Reading upstream's procedures against this project's own requirements gave
each of them one. That is precisely the class of consequence ABS-04 exists to stop being
discovered at a milestone close, so it is dated here, in the phase that produced it.

**What each one serves.**

- **`r2000_toggle_splitter` → DECOMP-01 and BUILD-02.** DECOMP-01 requires that nothing
  remain `Undefined` — every byte resolved to a type *including a table*. BUILD-02
  requires data tables extracted to their own files so graphics, levels and music can be
  swapped without touching code. Without a splitter, **two adjacent tables merge into
  one block and there is no boundary to cut on**: the extraction BUILD-02 asks for has
  nowhere to put the seam. Upstream's own `get_blocks` documentation says it "Respects
  splitters" (`handler.rs:188`), which is the other half of the same fact — the block
  view a caller reads is already splitter-aware, so a caller with no way to set one is
  reading a view it cannot influence.
- **`r2000_set_immediate_format` → BUILD-03.** This one does not merely *serve*
  BUILD-03, it **IS** BUILD-03's mechanism. BUILD-03 requires that every branch, `JSR`/
  `JMP` and data reference go through a symbol so code can move; a 16-bit address loaded
  as two immediate bytes (`LDA #<label` / `LDA #>label`) is the one construct where that
  cannot happen without telling the annotation store which half is which.
  `set_immediate_format_impl` (`handler.rs:1645-1695`) is the low/high-byte step that
  turns a split immediate load into a symbol reference.

**Constraints that ride with them.** Both are **mutating**, so both must go through the
existing session seam (`r2000-session.ts`'s single held child, Rule A21) if added —
neither may introduce a second child-launch site. Both are **additive** under the
precedent SURF-01 already set for adding a curated tool with a named criterion, so
neither is a breaking change to the advertised surface.

**Alternatives weighed.**
- *Add them in Phase 19.* Rejected: Phase 19's job is the diff, and widening the
  curated surface here would mean shipping two mutating tools with no consumer, no
  fixture and no test of the thing they enable.
- *Leave them as "no criterion" and let Phase 20 rediscover them.* Rejected: that is the
  undated-consequence failure, one phase later and with less context.

**Recorded where the next phase will see it:** ROADMAP.md Phase 20 Notes and Phase 21
Notes both point here.

Reversal condition: if Phase 20's first decomposition pass reaches DECOMP-01 on the
committed fixtures **without** ever needing a table boundary the splitter would set — i.e.
the coverage instrument reports zero `Undefined` bytes and zero merged-table findings with
the tool absent — then `r2000_toggle_splitter`'s criterion did not survive contact and the
proposal is withdrawn rather than implemented. The same test applies to
`r2000_set_immediate_format` against BUILD-03: if no split immediate load appears in the
fixtures, its criterion is theoretical and it waits for one that is not.

---

## Decision 3 — SURF-03's acceptance bar is "a project-owned route exists and never guesses", NOT "a name is reported on this machine"

**Decided:** 2026-08-24 (plan 19-04 implemented; recorded 19-05)

SURF-03 closes on a **negative result, stated as one**. No read-only route to packer
identity exists on the pinned version's tool or command-line surface. The bar this phase
closes against is therefore *a project-owned route exists, is exercised end to end, and
never guesses a name* — not *a name is reported here, today*.

**Evidence — four independent proofs that nothing surfaces it** (19-RESEARCH.md §2.2):
the `get_binary_info` handler's `json!` block emits seven fields and `packer_name` is not
among them (`handler.rs:798-826`); `UnpackResult` (`unpacker.rs:50-70`) carries the
detection but is not serialised out; `LoadedProjectData.detected_packer`
(`state/project.rs:98-115`) is TUI-consumed only; and the whole consumer set of
`detect_packer` (`packer_signatures.rs:1-14`) is internal. Two live executions agree:
`regenerator2000 --help` offers 13 options, none of which reports file info or a packer,
and a live `tools/call r2000_get_binary_info` against the Phase 11 fixture returned
exactly the seven documented fields.

**What was built instead** (19-04): `src/skills/c64-program-recon/scripts/packer-finding.mjs`
— a three-valued verdict (`packed`/`unpacked`/`unknown`) with an ordered oracle chain and
a **structurally enforced hard unknown**: the name field has exactly one assignment site
and the high-confidence level exactly one, asserted at source level by the colocated test.
The finding can honestly say "packed, name unknown" and cannot be made to say anything
else by accident.

**What was explicitly NOT done, and why.**
- Upstream's signature table was **not copied**. Copying a signature table is copying a
  claim about the world that this project cannot re-verify and would then have to
  maintain; it would also convert a licence-attributed prose absorption into a data
  absorption with a different provenance story.
- **No library linkage was added.** Linking regenerator2000-core to reach an internal
  function would make a private, unversioned symbol a load-bearing dependency.
- **No invented tool name was placed on the upstream-prefixed surface.** The `r2000_`
  prefix means "regenerator2000 serves this". No such tool exists upstream, so a
  project-invented `r2000_get_packer` would be a *fabricated upstream tool* that this
  repository's own gates would thereafter treat as legitimate. That is why the finding is
  a skill script (19-04's own recorded decision).

**Out of scope, stated plainly.** The external oracle (`unp64`) is **not installed on
this machine**, and installing it — plus a compressor such as `exomizer` or `pucrunch` to
author a genuinely packed fixture — is out of scope for this phase. The oracle branch is
nevertheless **implemented and live-gated** in the D-11 style: absent means a *visible*
skip with a stated reason by default, and a hard failure under `VICE_REQUIRE_UNP64`. It
becomes live the day the oracle appears, with no code change. The `unp64` stdout shape is
recorded as an **assumption, not a measurement** (19-RESEARCH.md tertiary sources, A1).

**Alternatives weighed.** *Make installing `unp64` a prerequisite task and close SURF-03
on a reported name.* Rejected as scope: it makes a milestone requirement depend on a
third-party tool's availability on one developer's machine, and the requirement as
written asks for the finding to be surfaced, not for a particular answer.

Reopen trigger: install `unp64` (and a compressor to author a genuinely packed fixture),
then run `VICE_REQUIRE_UNP64=1 node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs`.
If the oracle route returns a name end to end, SURF-03's result is raised from
"route exists, name unavailable" to "name reported", and this decision's negative framing
is retired. Decision 1's re-sync trigger (b) is the second, cheaper route to the same
outcome and would retire the oracle branch entirely.

---

## Decision 4 — MIT is elected from regenerator2000's dual `MIT OR Apache-2.0`

**Decided:** 2026-08-24 (plan 19-01 wrote it; recorded 19-05)

For all absorbed prose, this project elects **MIT** from regenerator2000's dual
`MIT OR Apache-2.0` offer.

**Evidence.** `license = "MIT OR Apache-2.0"` read verbatim from
`regenerator2000-0.9.20/Cargo.toml.orig:28` in the installed crate **and** from
`crates/regenerator2000-core/Cargo.toml:5` at the pin — two independent copies agreeing
(19-RESEARCH.md §5.1). The election is published in
`src/mcp/vice/THIRD-PARTY-NOTICES.md`, in `installer/THIRD-PARTY-NOTICES.md`, and in
every per-file attribution header, and the headers' commit and digest are asserted equal
to the manifest's by `src/mcp/vice/skill-attribution.test.ts`.

**Why MIT is the natural match.** This repository is itself MIT-licensed, so incorporated
text and host carry **identical terms** — a reader of either tarball sees one licence,
not a compound one, and a downstream consumer inherits no new obligation from the
absorption.

**And the election loses nothing.** Apache-2.0's §4(b) modification-notice obligation —
the one substantive thing the other option would have added — is **discharged regardless**
by the "ADAPTED, NOT VERBATIM" statement plus named deviations that every per-file header
already carries. The header is therefore honest under *either* option, which is what makes
this a free choice rather than a trade.

**Alternatives weighed.** *Elect Apache-2.0.* Rejected: it adds a NOTICE-file obligation
and a licence mismatch with the host repository, in exchange for a modification notice
the headers already give. *Elect neither and restate the dual offer.* Rejected: "MIT OR
Apache-2.0" is an offer to the licensee, and passing an unexercised choice downstream
leaves every consumer to make it again.

**HUMAN JUDGMENT, carried forward.** This is the one item in this phase that a test
cannot settle. A licence election published in two npm tarballs is a **legal claim, not a
test outcome**. Every mechanical check passes — the strings are present, they agree with
the manifest, and the falsified pre-absorption claim is gone — but *whether these are the
right terms to publish* is a human call, flagged as such by 19-01 (D3) and again by 19-02
(D5), and flagged again here rather than closed silently.

Reversal condition: upstream re-licenses (checkable at the same moment as decision 1's
re-sync trigger (a), since both read the new crate's `Cargo.toml.orig`), or this
repository's own licence changes away from MIT — at which point the election is
re-made and the two notices documents plus every per-file header are updated together, or
a lawyer's review says otherwise.

---

## Decision 5 — The inherited reader-writer concurrency deferral is CLOSED by measurement, not re-deferred

**Decided:** 2026-08-24 (measured in plan 19-01; recorded 19-05)

D18-16 — the reader-writer upgrade of `r2000-session.ts`'s coarse FIFO mutex — is
**CLOSED**. Not re-deferred, not deferred with extra words: its own named precondition has
been met and answered.

**The precondition, in the deferral's own words:** *"A reader-writer upgrade remains
deferred pending measurement of whether regenerator2000's stdio handler actually
multiplexes concurrent requests rather than reading stdin serially."* That measurement was
required to be run and recorded as evidence, the way Phase 18 recorded the stdin-EOF
measurement.

**Evidence.** `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-STDIO-MULTIPLEXING-EVIDENCE.md`
— three runs against the real installed binary, all agreeing, with the command sequence,
run table and raw JSON captured, plus a negative control (`R2000_BIN=/nonexistent-binary`
exits 1 with a non-empty reason, so the measurement cannot pass vacuously). Independently
corroborated at source: `run_headless_stdio_loop` (`crates/regenerator2000-core/src/mcp/stdio.rs:67-98`)
reads stdin line by line and calls `handle_request` **synchronously on `&mut AppState`**,
spawning nothing. Two independent methods, one answer.

**The outcome.** The child **reads its input serially and handles one request at a time,
in arrival order**. Therefore:

- A reader-writer upgrade at this project's seam would buy **zero** parallelism — the
  child re-serialises the work a moment later regardless.
- The coarse first-in-first-out mutex is an **exact model of the child's own behaviour**,
  not a compromise made for simplicity. That reframing is the substance of this decision:
  the seam was previously described as coarse *pending* something better; it is now
  described as correct.
- **Read-only fan-out remains the sanctioned orchestration pattern**, and its value is
  **agent reasoning concurrency — explicitly not throughput at the session.** Absorbed
  procedures carry upstream's sequencing and none of its 7-way concurrent-subagent
  orchestration, exactly as Phase 18 criterion 4 required.

A methodological note worth keeping: the measurement scores same-millisecond arrival as
**serial, not as multiplexing**. A trivial request answered 1ms after the batch ahead of it
is a queue draining, not concurrency — a looser scoring rule would have produced a false
positive here.

**Also closed under this decision — the cursor-tool invitation.** `src/mcp/vice/r2000-tools.ts`'s
header carried a standing offer: the held TUI cursor trio (`get_disassembly_cursor`,
`jump_to_address`, `read_selected`) would be justified by *"a real caller appearing in
Phase 19's absorption diff"*. A real caller **did** appear — and its own upstream text
tells a reader not to rely on the cursor. Absorbing that procedure imported the caller and
its prohibition together, so the trio **stays held** and the invitation is **answered
rather than left open**. That header has been updated in this plan's commit: a future
reader must not find a condition that has already occurred still written as an open offer.

**Alternatives weighed.** *Build the reader-writer lock anyway, for future-proofing.*
Rejected: it would trade a simple, tested invariant for a harder-to-reason-about one in
exchange for a measured zero. *Re-defer pending a "better" measurement.* Rejected: the
deferral named its own precondition, the precondition was met, and re-deferring a met
precondition is how a deferral becomes permanent.

Reversal condition: regenerator2000's stdio loop stops being serial — concretely, either
`run_headless_stdio_loop` gains a spawn/task per request at some future pin (visible in the
same source read decision 1's re-sync trigger (a) already performs), or a re-run of
`node .planning/phases/19-absorbed-procedures-and-the-coverage-instrument/evidence/measure-stdio-multiplexing.mjs`
against a newer binary reports a verdict other than `serial-one-request-at-a-time`. Either
observation reopens the reader-writer question with a real reason behind it.

## Decision 6 — The recursive descent stops at an illegal opcode, and the census's three readers are brought to ONE predicate

**Decided:** 2026-08-25 (measured and implemented in plan 19-20)

`computeStructuralCensus()`'s recursive descent **stops at an illegal opcode and does not
claim its bytes**. The three places in `src/mcp/vice/r2000-coverage.ts` that answer "is this
byte an instruction a program executes" now read ONE predicate,
`isDecodableAsInstruction()`, and that predicate is the standard the linear sweep and
`isPlausibleEntryPoint()` **already used**. The descent was brought up to them; they were
not brought down to it.

**The evidence — a measured self-contradiction, not a theoretical one.** A 64-byte image at
`$0810` holding `lda #$01` / `ldx #$00` followed by sixty `$02` bytes reported
`reachedAsInstruction=64`, `unreached=0` and `linearSweepDecodable=4`. One hundred per cent
structural completeness on a ninety-four-per-cent-garbage image, with the sibling figure on
the SAME report disagreeing sixteen-fold. `reachedAsInstruction` is the number SC4 gates on
and the number Phase 20 runs under.

The root cause is WR-14's pattern one level over. This module already had **two readers
agreeing on the stricter rule and one that never asked** — and the one that never asked was
the one producing the headline figure. That is precisely the shape that made
`isPlausibleEntryPoint()` worth extracting in the first place, when the two halves of
`provenDispatchTargets()` were found held to different standards. After this change the same
payload reports `4` / `60` / `4`; the byte-identical twin whose filler is `$ea` still reports
`64` / `0` / `64`, so the tightening discriminates rather than refuses.

**The alternative weighed and REJECTED: stop only at the CPU-halting opcodes.** Let the
descent walk through the stable undocumented instructions and loosen the linear sweep to
match, so the two figures stay comparable at the looser standard. It is arguably more
faithful to the machine — a `jam` halts the processor and a `lax` does not — and it would
avoid the under-report named below.

It is rejected **for this round**, and for a specific reason rather than a preference:
loosening the sweep would change what `linearSweepDecodable` **MEANS**. That field currently
counts bytes decoding as LEGAL, non-truncated instructions; that meaning is published in the
report Phase 20 consumes; and redefining it is a report-shape change that owes a
`COVERAGE_SCHEMA_VERSION` bump and a review of every consumer. This round is a
predicate-and-control round and does not bump the schema — `COVERAGE_SCHEMA_VERSION` is
still `2` and `COVERAGE_REPORT_KEYS` is unchanged. Recording that boundary explicitly is
better than absorbing the schema question into a bug fix.

**The residual, stated plainly with its size as a number.** `disasm-opcodes.ts` flags
**105 of its 256 entries** illegal. Only **12** of those are `jam`; the other **93** are
stable undocumented instructions that real C64 code does use — 27 `nop` variants, 7 each of
`slo`, `rla`, `sre`, `rra`, `dcp` and `isc`, 6 `lax`, 4 `sax`, and the rest. (The count is
not a coincidence of this table: the working notes on undocumented opcodes carried in this
tree describe exactly "all 105 opcode bytes not defined by the documented NMOS 6502 ISA".)
A program that legitimately executes one of those 93 will now have its census **stop there
and under-report** its reached count.

Three things make that acceptable rather than merely tolerated. The direction of the error
is the safe one — an instrument whose entire point is that reachability must be PROVEN
should under-claim, not over-claim. It is **no longer silent**: the two figures now agree
instead of contradicting each other, and `reachedAsInstruction <= linearSweepDecodable` is
asserted as a general relation. And the sweep already behaved this way, so the census now
**shares an existing limitation rather than inventing a new one**.

**Reversal condition, named and checkable:** a real target program is measured whose census
under-reports because the descent stopped at a stable undocumented opcode — concretely, a
payload where `linearSweepDecodable` minus `reachedAsInstruction` is explained by a `lax`,
`sax`, `slo`, `rla`, `sre`, `rra`, `dcp`, `isc` or undocumented-`nop` byte on a path the
program really executes. The remedy is then a **named option on the census plus a
`COVERAGE_SCHEMA_VERSION` bump**, taken together with Phase 20's own review of the
`flat-three` schema. It is never a silent divergence between the descent and the sweep —
ending that divergence is the whole of what this decision buys, and it is held in place by
four source-derived pins (one definition, three placed call sites, the decoder's illegal
flag read at exactly one comment-stripped site, and the statement order that keeps an
illegal byte `unreached` rather than claimed).

**Provenance of the work itself.** WR-03 sat in `19-CONTEXT.md`'s `<deferred>` section and
was **promoted into this round by orchestrator decision**; `19-CONTEXT.md` was deliberately
left unedited rather than rewritten after the fact, and the promotion is recorded here and
in `19-VALIDATION.md`. The blast radius was measured, not assumed: all twelve committed
coverage fixtures and the previously-unseen Phase 11 fixture report the same
`reachedAsInstruction` as before (7, 7, 17, 17, 15, 15, 30 six times, and 68), and the
sealed reproducibility answer still holds with `ANSWER.md`, `ANSWER.sha256` and
`QUESTION.md` byte-unchanged.

---

---

## Cross-references

| Decision | Requirement served | Evidence artifact | Where the next phase sees it |
|---|---|---|---|
| 1 — snapshot vs drift | ABS-04 | `upstream-procedure-manifest.json` (`resync_triggers`), `r2000-upstream-audit.test.ts` | ROADMAP §19 Notes |
| 2 — two proposed tools | ABS-04; serves DECOMP-01, BUILD-02, BUILD-03 | `r2000-tools.ts` header; `upstream-procedure-manifest.json` (`disposition_rationale`) | ROADMAP §20 and §21 Notes |
| 3 — packer-identity bar | SURF-03 | `packer-finding.mjs` + `packer-finding.test.mjs`; 19-RESEARCH.md §2.2 | ROADMAP §19 Notes |
| 4 — MIT election | ABS-02 | both `THIRD-PARTY-NOTICES.md` files; `skill-attribution.test.ts` | — (human-judgment item, carried to the phase verifier) |
| 5 — concurrency deferral closed | ABS-04 (D18-16) | `19-STDIO-MULTIPLEXING-EVIDENCE.md`; `stdio.rs:67-98` | ROADMAP §19 Notes |
| 6 — the descent stops at an illegal opcode | COV-01 (serves COV-02) | `r2000-coverage.test.ts` WR-03 minimal pair + PINs 5-8; `19-VALIDATION.md` round-4 plan 19-20 section | ROADMAP §20 — the report Phase 20 runs under |

**Note on FUT-01.** ABS-01's "five procedures absorbed" and FUT-01's deferral of BASIC
token decoding are reconciled deliberately rather than tacitly (19-02 Task 1(b)):
`r2000-analyze-basic` is absorbed as **attributed reference material** whose first line
names `FUT-01` and states the capability is deferred, and **every one of its trigger
phrases is kept out of every skill's `description:` frontmatter** so the section can be
read but can never fire. That is checked, not asserted —
`skill-attribution.test.ts` pins a named non-empty phrase set as absent from every
description and proves the predicate bites on a planted one.

**Note on the coverage report schema (19-03).** The `flat-three` report shape was chosen at
a `checkpoint:decision` that was **auto-selected under this project's `yolo` mode and never
shown to a human**. It is a one-way commitment the moment Phase 20 starts reading it. It is
recorded here so that fact is visible to whoever reads this file, not only to whoever reads
19-03-SUMMARY.md: `COVERAGE_SCHEMA_VERSION = 1` and `COVERAGE_REPORT_KEYS` are exported and
pinned by a key-set test, so a silent field rename fails — but the *choice of shape* rests
on an unreviewed auto-selection. Phase 20's first use of the report is the natural moment to
confirm or revise it, before the commitment hardens.
