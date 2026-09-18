# Phase 61: The Install Tables Generated, and a Guard That Compares Facts - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-19
**Phase:** 61-the-install-tables-generated-and-a-guard-that-compares-facts
**Areas discussed:** Generated scope & row identity, Command fidelity, Citations & orphaned prose, Guard shape & control & homes

All four offered areas were selected.

---

## Generated scope & row identity

### Q1 — What does the generator emit into README.md?

| Option | Description | Selected |
|--------|-------------|----------|
| VICE table + overview | Regenerate the 8-row ecosystem table from `x64sc`, plus one generated overview covering all eight records | |
| Only the VICE table | Regenerate the existing table and nothing else; seven of eight prerequisites keep no README presence | |
| A table per ecosystem-bearing record | `x64sc`, `c1541`, `petcat`, `acme` each get a table; the first three are identical trees | |
| You decide | Claude picks and records the reasoning | ✓ |

**User's choice:** You decide.
**Notes:** Claude took "VICE table + overview" (CONTEXT D-01) — it emits the VICE remedy tree once rather than three times, and a milestone about the user's first hour should not leave seven of eight prerequisites invisible.

### Q2 — Where do the human-readable ecosystem labels live?

| Option | Description | Selected |
|--------|-------------|----------|
| Top-level `ecosystems` map | `ecosystems: { "debian-trixie": { "label": ... } }` beside `tools`, stated once | |
| `label` on each remedy entry | Self-contained records, but the same label written three times | |
| Mapping table inside the generator | No schema change, but a second place that can disagree | |
| *(declined — see below)* | | ✓ |

**User's choice:** Answered "Non" twice, then clarified on a follow-up: **none of these — no labels in the declaration.**
**Notes:** The first answer was ambiguous enough that Claude stopped and asked in plain text rather than guessing. The clarifying question offered three readings of "I don't want it" — labels in the declaration, the all-eight overview, or the whole phase going the way the doctor did. The user selected **labels in the declaration**. The consequence stated in the accepted option text — the ecosystem column reading `debian-trixie` rather than `Debian 13 "trixie"` — is therefore a deliberate trade. Became CONTEXT D-02/D-03; the generator-side mapping fell with it, since it reintroduces the second disagreeing place the milestone exists to remove.

### Q3 — What does the table do with `homebrew` appearing under two platforms?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedupe, platforms in a column | One row per distinct `(ecosystem, text)` pair, with a generated `Platforms` column | ✓ (Claude) |
| Dedupe, keep it in the label | One row, coverage stays prose | |
| One row per platform entry | 9 rows, Homebrew listed twice | |
| You decide | | |

**User's choice:** Answered "Non" (same ambiguous turn as Q2); not re-asked after the clarification resolved the labels question.
**Notes:** Claude took dedupe + generated `Platforms` column (CONTEXT D-04) and said so in the open, offering the raw nine-row alternative as a one-line correction. With no authored labels anywhere, every cell in the table is then data and the guard's record comparison is total.

---

## Command fidelity

### Q1 — How does a generated cell render the remedy text?

| Option | Description | Selected |
|--------|-------------|----------|
| Plain text, verbatim | The cell is the declaration's `text`, character for character; five rows lose inner backticks | ✓ |
| Wrap the whole cell in backticks | Keeps a code-ish look, but renders part-prose remedies entirely as commands | |
| Formatting rule in the generator | Preserves today's look; the generator owns a heuristic the guard must reverse | |
| You decide | | |

**User's choice:** Plain text, verbatim.
**Notes:** No web research for this area — it was settled by two measurements presented before the question: no remedy string contains a `|` or a newline (longest 157 chars), and five of seven linux remedies differ from their README rows only by backticks *inside* the sentence. Became CONTEXT D-05, rated costly to reverse because the guard's exact-equality comparison depends on it.

---

## Citations & orphaned prose

### Q1 — What happens to the 27 `"source": "README.md:NNN"` citations?

| Option | Description | Selected |
|--------|-------------|----------|
| Leave them, record the circularity | No edit to the frozen declaration; the provenance doc states they are historical | ✓ |
| Re-point at the pre-generation commit | `README.md@67a0d810:101` — literally true forever, but invents a citation syntax | |
| Re-point at the generator | Honest about the new topology, but destroys the historical record | |
| You decide | | |

**User's choice:** Leave them, record the circularity.
**Notes:** Became CONTEXT D-09. Consistent with the declaration freeze either way. Nothing audits those 27 today — the ledger guard reads documents, not the JSON — so nothing breaks; the claim simply becomes historical.

### Q2 — Where does the generated region start?

| Option | Description | Selected |
|--------|-------------|----------|
| Table only; phase rewrites the prose | Markers wrap the table; this phase hand-rewrites 96-97, 110-111, 122-123 and re-anchors the ledger | ✓ |
| Region includes the lead-in | One less hand-edit, but the generator starts authoring English prose | |
| You decide | | |

**User's choice:** Table only; phase rewrites the prose.
**Notes:** Became CONTEXT D-06/D-07/D-08. Three prose neighbours were measured stale before the question was put, including `README.md:122-123`'s "The 3.10 floor named in the table above", which goes outright false when the column is dropped — the same failure shape Phase 58 fixed at its own D-11.

---

## Guard shape, control & homes

### Q1 — Which side does the guard derive independently?

| Option | Description | Selected |
|--------|-------------|----------|
| Shared derivation, independent parse | Guard calls the generator's row-derivation, parses the README with its own reader | ✓ |
| Fully independent second reader | Catches symmetric generator bugs; duplicates the derivation rule | |
| Regenerate and compare rendered output | A byte comparison with a pre-wash — the class the 2026-09-13 owner decision removed | |
| You decide | | |

**User's choice:** Shared derivation, independent parse.
**Notes:** Became CONTEXT D-10, mirroring `resources-sync.test.ts`'s own stated rule.

### Q2 — What gets planted for `GEN-03`?

| Option | Description | Selected |
|--------|-------------|----------|
| Mutate the real pair in a temp dir | `mkdtempSync(tmpdir())`, one record changed, guard must fail and name it | ✓ |
| Committed fixture pair | A readable committed control, but proves the guard fails on a toy | |
| Both | Strongest evidence, most test code | |
| You decide | | |

**User's choice:** Mutate the real pair in a temp dir.
**Notes:** Became CONTEXT D-12. Repo-tree scratch files already cause deterministic failures elsewhere in this suite, which is why the mutation stays under `tmpdir()`.

### Q3 — Where do the generator and guard live?

| Option | Description | Selected |
|--------|-------------|----------|
| Both in `src/mcp/vice` | Runs in CI through the existing `npm test` step, no workflow change | |
| Generator in `scripts/`, guard colocated | Generator sits next to what it writes; pure functions cross a package boundary | |
| Folded into `build.ts` | One generator entry point, but a different job from compiling `.mts` | |
| You decide | | ✓ |

**User's choice:** You decide.
**Notes:** Claude took both in `src/mcp/vice` (CONTEXT D-13). `node --test '*.test.*'` globs only that directory, the `.git`-marker walk to reach the repo root is already precedent there twice, and keeping derive/render/parse in one module is what makes the shared-derivation guard possible.

---

## Closing check

Offered: explore the overview's column shape, or write the context. **User chose: ready for context.** The overview's columns are recorded as Claude's discretion with the intent stated (CONTEXT D-11).

## Claude's Discretion

- **D-01** — generated scope ("you decide").
- **D-04** — row dedupe and the `Platforms` column (Claude's choice, alternative left open).
- **D-11** — the overview's columns (user declared ready with it open).
- **D-13** — where the generator and guard live ("you decide"), plus the module-naming caution about the existing `install-resources.ts`.

## Deferred Ideas

- A doctor, a `--check`, or any pre-flight verification surface — dropped at owner decision 2026-09-18.
- Correcting `CLAUDE.md`'s stale ACME-prefix citation — carried unclosed from Phase 58.
- `DECL-F1` / `DECL-F2` / `DOCTOR-F2` — already in REQUIREMENTS.md § Future Requirements.
- Labels for the eight ecosystem ids, in any location — foreclosed by D-02 for this phase.

## Flagged, not folded

- **`DECL-05` reads Complete but its proof no longer exists.** `scripts/check-npm-packages.mjs` was deleted 2026-09-17 in `d0e9fb2e`; nothing in the tree names `DECL-05` today. Phase 58's, not Phase 61's — recorded in CONTEXT.md so the milestone does not close over it.
- Two todos from `todo.match-phase 61` reviewed and not folded; one of them (`audit-gate.mjs`'s shared guard budget) was measured stale during this discussion.
