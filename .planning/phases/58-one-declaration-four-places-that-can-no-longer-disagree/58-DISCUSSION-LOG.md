# Phase 58: One Declaration, Four Places That Can No Longer Disagree - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-16
**Phase:** 58-one-declaration-four-places-that-can-no-longer-disagree
**Areas discussed:** Remedy provenance, Record shape, VICE version columns, Placement & proof

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Remedy provenance | Criterion 5 says every string is carried from a named existing source; measured, only `x64sc` has one | ✓ |
| Record shape | How `unblocks` is keyed, ACME stdlib as its own record, what a "platform" key is | ✓ |
| VICE version columns | The README table's two version columns vs `DECL-04` and the milestone's Out of Scope | ✓ |
| Placement & proof | File location and name, `DECL-05` packaging assertion, the "oldest Node" number | ✓ |

**User's choice:** all four.

---

## Remedy provenance

### Q1 — five of eight records have no per-platform remedy anywhere in the tree

| Option | Description | Selected |
|--------|-------------|----------|
| Author it, and say so per string | Write per-platform commands for tools that lack them; every string carries a provenance field. Criterion 5 becomes "every string names its origin" | |
| Carry only what exists | Per-platform for `x64sc` alone; everything else gets one generic string copied verbatim, with an explicit null and a reason | |
| Author only what's measured | Per-platform only where this project observed it work — CI's `apt install acme` and nothing else | |
| You decide | Claude picks, weighing measured-over-asserted discipline against the Phase 61 doctor being useful | ✓ |

**User's choice:** You decide.
**Claude's selection and reasoning:** "Author it, and say so" — but hardened by
folding in the third option's discipline rather than discarding it. Every remedy
string carries a three-valued `provenance` (`measured` / `carried` / `authored`),
so an authored `brew install acme` is never internally indistinguishable from a
fact this project observed. Criterion 5 is amended explicitly in CONTEXT.md
rather than silently reinterpreted. (→ D-03)

### Q2 — where the "two sources disagreed, here's which won" record lives

| Option | Description | Selected |
|--------|-------------|----------|
| A field in the JSON | Optional `conflictNote` per record; travels with the data but puts prose in a data file | |
| A docs/ decision file | `docs/phase58-...md` in this project's existing style; JSON stays pure data | |
| Both, split by job | Machine-checkable tag in JSON, reasoning in the docs file | |
| You decide | Claude picks based on what Phases 60–62 actually read | ✓ |

**User's choice:** You decide.
**Claude's selection and reasoning:** "Both, split by job." `DECL-04`'s test and
Phase 60's refusal wiring need something machine-checkable in the JSON;
criterion 5's "records which was chosen and why" needs prose a human reads, and
this project already has a convention for that (`docs/phase40-preprocessing-tools-decisions.md`,
`docs/stock-hard-losses.md`). (→ D-04)

**Notes:** One genuine live disagreement was identified during scouting and is
recorded as the worked example — `README.md:96-97` vs
`.planning/REQUIREMENTS.md:88` on whether the VICE 3.10 gate is load-bearing.
(→ D-05)

---

## Record shape

### Q1 — what a "platform" key is

| Option | Description | Selected |
|--------|-------------|----------|
| Ecosystem rows, doctor prints all | Keep the README's 8-row granularity flat; doctor prints every row matching the OS | |
| OS keys, ecosystems nested | Top level `linux`/`darwin`/`win32`, ecosystem list beneath; one shape serving both consumers | |
| Two fields, stated as two | Short per-OS remedy for the doctor, separate ecosystem table for the README | |
| You decide | Claude picks, weighing doctor output against lossless regeneration | ✓ |

**User's choice:** You decide.
**Claude's selection and reasoning:** "OS keys, ecosystems nested" — the only
option where one shape serves both consumers. The doctor matches
`process.platform` and walks its list; Phase 62's generator walks the same tree
and re-emits all eight rows. "Two fields, stated as two" was rejected outright: it
creates a fifth place that can disagree, which is what the phase exists to
remove. (→ D-06)

**Not asked — already settled upstream:** `DOCTOR-04` mandates ACME's standard
library as its own record (→ D-07); `DECL-01` mandates both skills and MCP
capabilities in `unblocks`. Claude chose the keying vocabularies (skill directory
names, `host_tool` op ids) so `DECL-01` is mechanically verifiable (→ D-08).

---

## VICE version columns

### Q1 — what happens to "Version it ships" and "Clears the 3.10 gate?"

| Option | Description | Selected |
|--------|-------------|----------|
| Drop both; correct the README | Declaration carries no VICE version data; the false prose at `README.md:113-119` is corrected too | ✓ |
| Keep as dated annotation | Both survive as a non-floor `observedVersion` tagged "not a gate"; `DECL-04` still holds literally | |
| Drop the gate, keep the version | Keep the version as a dated observation, drop the gate column whose consequence was measured false | |
| You decide | Claude picks | |

**User's choice:** Drop both; correct the README. *(The only direct user
decision of the session.)*
**Notes:** This makes `DECL-04` hold literally rather than by argument. It also
means the phase must own a README correction, which prompted the follow-up
below. (→ D-10)

### Q2 — where the README correction lands, given Phase 58 is scoped data-only

| Option | Description | Selected |
|--------|-------------|----------|
| In Phase 58 | Both the table columns and the prose, now | |
| In Phase 62, recorded now | Keeps 58 data-only; README stays false for four phases | |
| Columns in 58, prose in 62 | Split by how much judgement each edit needs | |
| You decide | Claude picks based on the roadmap's own reasons for keeping 58 thin | ✓ |

**User's choice:** You decide.
**Claude's selection and reasoning:** The **inverse** of the third option. Phase
62 generates the table, so a Phase 58 hand-edit to it is throwaway work that
gets overwritten. The prose at `README.md:113-119` sits outside the generated
section and nothing regenerates it, so it stays false unless a phase owns it —
Phase 58 rewrites that prose, Phase 62 drops the columns. The roadmap keeps 58
thin to isolate the first `resources/*.mjs` regeneration, and a markdown edit
carries none of that risk. (→ D-11)

---

## Placement & proof

No questions put to the user — Claude decided all four and stated them inline
before the closing check.

| Decision | Choice | Ref |
|---|---|---|
| File location and name | `src/mcp/vice/prerequisites.json`, not research's `tools.declaration.json` (collides conceptually with `LOC-01`'s user-facing `tools.json`) | D-12 |
| `DECL-05` proof | Named assertion in `check-npm-packages.mjs` reading `vice.files`, never a filesystem check — the transitive-import walk cannot see a file nothing imports | D-13 |
| "Oldest Node" | 18, taken from `installer/package.json:16` rather than invented | D-14 |
| How CI gets old Node | `actions/setup-node`, never `apt`/`nvm`/`npm i -g` | D-15 |

---

## Claude's Discretion

The user answered "you decide" on four of five questions. Claude's selections and
the reasoning behind each are recorded above and in CONTEXT.md's `<decisions>`,
rather than left implicit:

- D-03 (three-valued provenance), D-04 (JSON tag + docs file), D-06 (nested
  OS/ecosystem shape), D-11 (README split between Phase 58 and 62).
- D-12 through D-15 were decided without being put to the user at all, being
  technical placement questions with defensible in-tree precedent.

The one direct user decision is D-10.

---

## Deferred Ideas

- Correcting `CLAUDE.md`'s stale citation of `acme-build/SKILL.md` for the ACME
  prefix list — real, but needs its own quick task touching both `CLAUDE.md` and
  `.planning/PROJECT.md` (the mirrored source).
- `DECL-F1` (installer consumes the declaration), `DECL-F2` (SKILL.md prefix list
  generated), `DOCTOR-F2` (per-machine `tools.json`) — all already recorded in
  REQUIREMENTS.md § Future Requirements.

## Raised but not discussed

Three gray areas were identified and not put to the user, because the user
declared ready for context. Carried into CONTEXT.md `<specifics>` as open:

1. Whether the declaration carries a `schemaVersion` — in-tree precedent points
   both ways (`.annostore`'s `SCHEMA_VERSION` 4 vs `tools-manifest.stock.json`
   carrying none).
2. Whether dxa belongs in the declaration at all, given `LOC-05` makes it
   un-overridable — probably yes, but its record shape will differ from every
   other one and that should be deliberate.
3. How `DECL-04`'s "no other record carries a version-floor field" test is
   written so it is non-vacuous per `ENGINEERING_RULES.md` §6.
