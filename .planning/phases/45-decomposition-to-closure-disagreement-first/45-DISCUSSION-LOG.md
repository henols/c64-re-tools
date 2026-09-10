# Phase 45: Decomposition to Closure, Disagreement First - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-10
**Phase:** 45-decomposition-to-closure-disagreement-first
**Areas discussed:** Where the annotated store lives, What the completeness report IS, How the annotation gets done, Where enum bits render

**Areas offered but not selected:** Fixture set & which get executed; Recording a decline / accepted disagreement; The auto-name survivor bar. (All three are carried into CONTEXT.md's "Claude's Discretion" with their named constraints rather than dropped.)

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Fixture set & which get executed | Which of the 9 committed `.prg` files count, and which get a live VICE run | |
| Where the annotated store lives | Nothing `.annostore` is committed today | ✓ |
| What the completeness report IS | `anno-coverage.ts` is off-limits and structurally forbids the measure | ✓ |
| Recording a decline / accepted disagreement | Criteria 2 and 4 both need a machine-checkable negative statement | |
| How the annotation gets done | Agent pass, scripted derivation, or hand-authored; plus the deleted enum route | ✓ |
| The auto-name survivor bar | Roadmap's two prefixes vs `AUTO_NAME_PREFIX_RE`'s eleven | |
| Where enum bits render | Which surface criterion 5 is checkable on | ✓ |

---

## Where the annotated store lives

### Q1 — What form gets committed?

| Option | Description | Selected |
|--------|-------------|----------|
| JSON export + importer | Text export per fixture, committed importer rebuilds the store; reviewable in a diff. Cost: no general store-JSON importer exists yet | ✓ (via "you decide") |
| Binary `.annostore` committed | sqlite committed directly; zero new code, byte-exact. Cost: opaque in review, sqlite churn | |
| Not committed — regenerated | A committed script rebuilds every store each run, following `fixtures/coverage/`'s precedent | |

**User's choice:** "You decide"
**Notes:** Chosen as JSON export + importer because a binary sqlite cannot show a purpose-comment change in a diff — which is precisely what Q3's split-provenance answer exists to make visible. The two answers together only cohere under the text form.

### Q2 — One store or many?

| Option | Description | Selected |
|--------|-------------|----------|
| One store per fixture | Matches the per-engine fixture directories; per-fixture gate is trivially scoped | ✓ |
| One store, scoped per fixture | Single store using `anno_add_scope`; exercises scopes ahead of Phase 47. Cost: diff collision, gate must filter | |

**User's choice:** One store per fixture

### Q3 — Does the `fixtures/coverage/` idempotent-regeneration bar carry?

| Option | Description | Selected |
|--------|-------------|----------|
| No — authored artifacts | Treat the store like source: written once, reviewed, frozen | |
| Yes — idempotent regeneration | A re-run must produce a byte-identical artifact; every judgment call becomes a committed literal | |
| Split — derived regenerates, authored doesn't | Block types/xrefs/enum bindings regenerate; names and purpose comments are authored and frozen | ✓ |

**User's choice:** Split — derived regenerates, authored doesn't
**Notes:** This is the decision that shaped the rest of the phase. It made the text export form necessary (Q1), and it maps directly onto the "derive first, then agent closure" answer in the annotation area.

---

## What the completeness report IS

### Q1 — Where does the report live?

| Option | Description | Selected |
|--------|-------------|----------|
| New `anno_*` MCP tool | First-class reusable capability, backend-agnostic via `buildViceTool()` | |
| Module + CLI verb | Runnable in CI without an MCP session | |
| Both — one module, two entry points | Matches how the `anno_*` family already ships | |
| **(free text)** | **"A skill with a dedicated script, not in a MCP, not sure if it needs to go through the broker or it can work on its own"** | ✓ |

**User's choice:** Free text — a skill with a dedicated script, explicitly not an MCP tool.
**Notes:** All three offered options were rejected. The broker uncertainty was settled factually rather than guessed: `anno-cli.ts` and `anno-store.ts` reach no broker, no `host_tool` op, and no `forwardToVice()` — the store is `node:sqlite` in-process — so the script needs no broker. This forced a follow-up on how the script reaches store data at all.

### Q1b (follow-up) — How does the skill script get the data?

| Option | Description | Selected |
|--------|-------------|----------|
| Read committed JSON artifacts only | Pure file-in, report-out, offline-testable. Risk: a stale committed disagreement file could pass a gate the live store would fail | |
| Add a 5th CLI verb | `vice-mcp anno completeness`; always live. Cost: breaks the D-14 four-verb cap held since 2026-08-29 | ✓ |
| Script imports the modules directly | Cross-package reach from `src/skills` into `src/mcp/vice` | |
| Hybrid — JSON in, live check | Report from JSON, refuse on staleness. Cost: needs a reach mechanism anyway | |

**User's choice:** Add a 5th CLI verb
**Notes:** The four-verb cap is superseded deliberately, not by accident. Precedent: plan 43-06 already raised it three → four. The guard that will bite is `anno-verb-coverage.test.ts:59`'s `REAL_VERBS`.

### Q1c (follow-up) — Which skill owns the script?

| Option | Description | Selected |
|--------|-------------|----------|
| A new closure/completeness skill | A tenth skill. Clean ownership. Cost: another skill in the surface | |
| Extend `routine-queue-walker` | Already exists to drive a backlog to closure and report every leftover | ✓ |
| Extend `c64-program-recon` | Recon owns first-pass discovery, not closure | |

**User's choice:** Extend `routine-queue-walker`

### Q2 — How is the disagreement input made structural?

| Option | Description | Selected |
|--------|-------------|----------|
| Required arg, no default, throws | Same shape `evid-reconcile.ts` uses | |
| Required output field | Schema rejects a report without it; survives an empty array | |
| Both | Input cannot be omitted AND output cannot render without it | ✓ (via "you decide") |

**User's choice:** "You decide"
**Notes:** Chosen as both. A required argument alone is satisfied by an empty array, which would make "no disagreements" and "no disagreement query" indistinguishable — exactly the silent pass criterion 1 forbids.

### Q3 — Criterion 1 says "table", but the frozen twelve have no such member.

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on "not undefined" | Read the criterion's word list as informal prose | |
| "table" = the four split layouts | Map onto `lo_hi_address` / `hi_lo_address` / `lo_hi_word` / `hi_lo_word` | ✓ |
| Flag it and let research settle | Possibly the roadmap text needs correcting | |

**User's choice:** "table" = the four split layouts

### Q4 — How does the output carry the soundness asymmetry?

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse `evid-reconcile`'s four buckets | Zero new concepts; the module that got this right owns it | |
| Per-range provenance marker | Observed-executing / byte-derived / authored, per range; feeds Phase 46 | |
| Both | Aggregate can't lie, detail can't hide. Cost: largest schema | ✓ |

**User's choice:** Both

---

## How the annotation gets done

### Q1 — Who produces the annotation?

| Option | Description | Selected |
|--------|-------------|----------|
| Agent pass via `routine-queue-walker` | Backlog one entry at a time, queue rebuilt each pass | |
| Derive first, then agent closure | dxa + Ghidra fill types and xrefs mechanically; agent does only names and comments | ✓ |
| Hand-authored throughout | Fixtures are small and already have byte-layout tables. Cost: doesn't exercise the pipeline | |

**User's choice:** Derive first, then agent closure
**Notes:** Maps exactly onto the split-provenance decision — the derived half of the committed artifact is literally the derivation's output.

### Q2 — Which fixtures get a live VICE run?

| Option | Description | Selected |
|--------|-------------|----------|
| Every fixture that can run | Maximum oracle coverage. Cost: a broker + VICE per fixture | |
| A named subset, declared up front | Non-executed fixtures reported by name as "not executed", never as a clean bill of health | ✓ (via "you decide") |
| One fixture, deeply | Smallest cost. Risk: thin evidence against the milestone's named most-dangerous gap | |

**User's choice:** "You decide"
**Notes:** Chosen as the named subset. It cashes the oracle on several fixtures — the gap the roadmap calls the milestone's most dangerous — while making vacuity *visible*: a fixture with no run has no disagreement rows and would otherwise pass criterion 2 for free.

### Q3 — Where does the rebuilt enum route live?

| Option | Description | Selected |
|--------|-------------|----------|
| In `anno-enum-gen.ts`, over this project's own disassembler | Restore the fetch feeding the surviving `pairSearchRows()` / `planEnumsForPairing()`. Note: this is ANNO-13, recorded as withdrawn with no phase owning its return | ✓ |
| In the skill script | Keeps `anno-enum-gen.ts` as pure heuristics with no route | |
| Minimal — hand-bind the fixtures' registers | Smallest scope. Cost: doesn't restore ANNO-13 | |

**User's choice:** In `anno-enum-gen.ts`, over this project's own disassembler
**Notes:** This means Phase 45 reclaims the enum half of ANNO-13. ANNO-14/15 (the symbol round trip) stay unowned — flagged in CONTEXT.md so the withdrawal notice gets corrected rather than left to contradict the code.

---

## Where enum bits render

### Q1 — Which surface?

| Option | Description | Selected |
|--------|-------------|----------|
| The ACME export | Already under a real-ACME byte-diff oracle — strongest check available | |
| `anno_disassemble` output | Where a session actually reads the code. Cost: checkable only by string comparison | |
| The completeness report | One artifact for criteria 1 and 5. Cost: conflates "is it typed" with "is it named" | |
| Export + disassembly, one decoder | Export carries the proof, disassembly carries the readability | ✓ |

**User's choice:** Export + disassembly, one decoder

### Q2 — How does a multi-bit write render?

| Option | Description | Selected |
|--------|-------------|----------|
| OR-ed named constants | Reassembles to the identical byte, so the byte-diff oracle proves the decomposition is arithmetically correct | ✓ |
| Hex plus a decoded comment | Safest for reassembly. Cost: still emits one hex constant, which criterion 5 rules out | ✓ |
| Named constant per whole value | D-20's existing rule. Cost: a named magic number, not a decomposition | |

**User's choice:** "A combination of 1 and 2" — `lda #VIC_SCREEN_1024 | VIC_CHARSET_2048   ; screen=$0400, charset=$0800`
**Notes:** Neither half alone satisfies criterion 5: a bare hex constant with a comment still emits one hex constant, and bare OR-ed constants without a comment are not readable at a glance.

---

## Claude's Discretion

The user answered "you decide" three times. Each is recorded in CONTEXT.md with the reasoning that resolved it:

- **Committed store form** → JSON export + importer (D-02)
- **How the disagreement input is made structural** → both mechanisms (D-09)
- **Which fixtures get a live run** → a named subset with non-execution rendered (D-13)

Plus three gray areas the user chose not to discuss, carried forward with their constraints: the fixture set for typing, how a decline and an accepted disagreement are recorded (constraint: match `.annostore`'s existing importer convention, do not invent a second), and which auto-name prefixes count as survivors.

## Deferred Ideas

None — discussion stayed within phase scope. No scope creep was raised.

**Todos reviewed, none folded:** `todo.match-phase 45` returned 7 matches, all generic keyword coincidences against broker lifecycle, prior-phase review backlog, and a tree-wide test-folder refactor. Listed individually in CONTEXT.md's `<deferred>` section.

## Measurements taken during discussion

Two facts were established by reading the tree rather than assumed, and both changed an answer:

1. **`anno-cli.ts` and `anno-store.ts` reach no broker, no `host_tool` op, and no `forwardToVice()`** — settled the user's stated uncertainty about whether the script needs the broker. It does not.
2. **Only `fixtures/ghidra/charset-phantom.prg` writes `$D011` and `$D018`** (`8d11d0`, `8d18d0` in its bytes). Every other committed fixture touches `$D020`, `$D021` or `$01` only — so criterion 5's multi-bit demo has exactly one possible home among the committed fixtures.
