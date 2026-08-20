# Phase 11: Annotation Store, Enums, and the Symbol Round Trip - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-20
**Phase:** 11-annotation-store-enums-and-the-symbol-round-trip
**Areas discussed:** Store access & lifecycle, Enum generation semantics, Store vs. prose in recon, Round-trip closure proof, plus three residual scope items
**Mode:** default (interactive), no flags

---

## Area selection

| Option | Description | Selected |
|--------|-------------|----------|
| Store access & lifecycle | How a Claude session reaches the `.regen2000proj`; who owns saving | ✓ |
| Enum generation semantics | Criterion 3's value-vs-bit mismatch; where enums live; bit-name source | ✓ |
| Store vs. prose in recon | Canonical model; confidence grades; the query demonstration | ✓ |
| Round-trip closure proof | Inbound persistence; merge policy; program; backend | ✓ |

**User's choice:** all four.

**Todo folding** — both offered todos folded:

| Todo | Selected |
|------|----------|
| `2026-08-20-npm-closure-walk-blind-to-dynamic-imports.md` | ✓ |
| `2026-08-20-r2000-review-residual-findings.md` (WR-02..WR-07) | ✓ |

---

## Store access & lifecycle

### Q1 — How should a Claude session reach the store?

| Option | Description | Selected |
|--------|-------------|----------|
| Proxy through our MCP server | `vice-proxy.ts` advertises `r2000_*`, drives `--mcp-server-stdio` as a child. One MCP surface, D-07's guard stays load-bearing, per-call project path. Cost: we become an MCP client for the first time. | ✓ |
| Second MCP server in the manifest | Near-zero code, but MCP server config is static so the project path freezes at session start; 28 tools land outside our gates | |
| CLI verbs only, no MCP | Cheapest and most testable, but criterion 2's xrefs and search would mean reimplementing r2000's analysis engine | |

**User's choice:** Proxy through our MCP server (recommended).
**Notes:** → **D-16**. Evidence presented: `--mcp-server-stdio` measured speaking MCP 2024-11-05 with 28 tools.

### Q2 — What lifecycle should the r2000 child have?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-call spawn: load → mutate → save → exit | Stateless, no supervision, no wedge class; 0.12s load measured. Costs undo/redo. | ✓ |
| Session-scoped long-lived child | Undo/redo work, load amortised; costs lifecycle, crash supervision, a second wedge class | |
| You decide | | |

**User's choice:** Per-call spawn (recommended).
**Notes:** → **D-17**. Makes `r2000_batch_execute` the efficiency lever, which drove Q on batch gating later.

### Q3 — Which r2000 tools should the surface expose?

| Option | Description | Selected |
|--------|-------------|----------|
| Curated subset named for the criteria | Drops TUI-shaped tools and the two unusable per-call; fewer names to keep honest | ✓ |
| Mirror all 28 | Nothing to decide per tool, future features free; ships cursor/pane tools and the broken `get_address_details` | |
| You decide | | |

**User's choice:** Curated subset (recommended).
**Notes:** → **D-18**.

### Q4 — How should project selection work?

| Option | Description | Selected |
|--------|-------------|----------|
| Explicit project path argument on every tool | Composes with per-call spawn, sidesteps the fixed-port limit (stdio has no port), visible in the transcript | ✓ |
| One conventional store per project | Fewer arguments, matches `repoRoot()`; but two programs in one repo need a switch that does not exist | |
| You decide | | |

**User's choice:** Explicit path argument (recommended).
**Notes:** → **D-19**. Noted that this may retire the one-project-at-a-time limitation D-15 documents.

---

## Enum generation semantics

Evidence presented before asking: applying an enum emits its **entire** variant
list into the header (measured), and an unmatched value falls back to bare
`#$1b` while still emitting the dead definitions (measured).

### Q1 — How do we make `lda #$1b / sta $d011` read semantically?

| Option | Description | Selected |
|--------|-------------|----------|
| Program-specific: name only the values this program writes | 2-5 variants per register, short headers, every bound immediate resolves. Needs an `lda #imm` → `sta` pairing pass. | ✓ |
| All 256 values per register | Reusable, but one register touched = 256 `=` lines; six registers = ~1500-line preamble | |
| Single-bit masks only | Small and honest, but measured to give header noise *and* no semantic render — criterion 3's own example fails | |
| You decide | | |

**User's choice:** Program-specific (recommended).
**Notes:** → **D-20**.

### Q2 — Where should generated enums live?

| Option | Description | Selected |
|--------|-------------|----------|
| Project-level, inside the `.regen2000proj` | Proven working end to end; self-contained, diffable, no machine-global write | ✓ |
| r2000's global config dir as `enum-*.toml` | Reusable across projects, but an invisible machine-wide side effect shared with the human's own TUI usage | |
| You decide | | |

**User's choice:** Project-level (recommended).
**Notes:** → **D-21**. Same posture as Phase 8.1's refusal to write into machine-global `~/.claude/plugins/`.

### Q3 — Where do bit names come from?

| Option | Description | Selected |
|--------|-------------|----------|
| The 29 structured entries plus a curated table in this repo | The 29 cover exactly the chips the criterion names; prose cannot become an identifier mechanically | ✓ |
| Parse the `desc` prose for all ~282 register entries | Widest coverage, but the normaliser plus exception list *is* the curated table, only implicit and untested | |
| Only the 29, nothing hand-written | Purest reading, zero curation, but mangled identifiers and sprite registers absent | |
| You decide | | |

**User's choice:** 29 structured plus a curated table (recommended).
**Notes:** → **D-22**. Also surfaced that `R2000-13`'s `--dump-enum-files` claim is wrong — that flag dumps three built-ins and exits.

### Q4 — How wide should the `lda #imm` → `sta register` pairing look?

| Option | Description | Selected |
|--------|-------------|----------|
| Adjacent pair only, no dataflow | Dominant C64 idiom and the criterion's own example; a miss costs nothing, a wrong binding is worse than none | ✓ |
| Short window with register tracking | More coverage on real code, but real wrong-answer risk | |
| You decide | | |

**User's choice:** Adjacent pair only (recommended).
**Notes:** → **D-23**, with an explicit paired-vs-total coverage count.

---

## Store vs. prose in recon

Evidence presented: r2000's twelve block types carry classification but **no
confidence axis** — `Code` cannot distinguish observed-executing from
reachable-never-run.

### Q1 — Relationship between the store and the Markdown memory map?

| Option | Description | Selected |
|--------|-------------|----------|
| Store canonical, Markdown rendered from it | Kills drift outright; criterion 1 true by construction. Costs a renderer, and run-scoped scalars need a home. | ✓ |
| Both, store authoritative for address-keyed facts | No renderer, prose stays readable; but two places, so drift is possible | |
| Store purely additive, prose unchanged | Lowest risk, but leaves the prose primary — which is the problem the criterion names | |

**User's choice:** Store canonical (recommended).
**Notes:** → **D-24**. Combined with Q4's answer, this needs an explicit reconciliation, flagged in CONTEXT.md.

### Q2 — Where do confidence grades live?

| Option | Description | Selected |
|--------|-------------|----------|
| Line-comment convention with a machine-readable prefix | Proven: comments persist and both `get_comments` and `search_disassembly` filter on them. No new storage. | ✓ |
| Sidecar JSON keyed by address | Typed and schema-checkable, but a second store to sync — the drift class being closed | |
| Block types only, drop the confidence axis | Nothing to build, but discards the template's most deliberate feature | |
| You decide | | |

**User's choice:** Line-comment convention (recommended).
**Notes:** → **D-25**, pinned by a test so a typo fails rather than silently degrading.

### Q3 — What demonstrates "answers a question by querying"?

| Option | Description | Selected |
|--------|-------------|----------|
| A recorded two-session transcript on one real program | Matches evidence-over-assertion and Phase 8.1's precedent | ✓ |
| An automated test over a committed fixture store | Runs in CI forever, but proves the layer works, not that a session reaches for it; WR-02 is a live vacuous-test example | |
| Both — transcript for the criterion, test for the regression | Most expensive; roughly what Phase 8.2 needed anyway | |

**User's choice:** Recorded two-session transcript (recommended).
**Notes:** → **D-26**. Paired with D-31's fixture test on the round-trip side, so the phase gets both in practice.

### Q4 — Where do run-scoped facts go?

| Option | Description | Selected |
|--------|-------------|----------|
| Stay in Markdown as a provenance header | Facts about a run, not an address; the store has no shape for them | ✓ |
| Fold into a store comment at a convention address | One file, but abuses an address-keyed field and leaks into the ACME header | |
| You decide | | |

**User's choice:** Provenance header in Markdown (recommended).
**Notes:** → **D-27**, with the D-24 reconciliation flagged for the planner.

---

## Round-trip closure proof

Evidence presented: `--import_lbl` under `--headless` **discards** (measured —
two names imported, `--export_lbl` from disk returned only the pre-existing one),
and `--export_lbl` emits `al C:0810 .init_screen`, matching `stock-symbols.ts`'s
parser verbatim.

### Q1 — How does the inbound leg persist?

| Option | Description | Selected |
|--------|-------------|----------|
| `--import_lbl` + stdio MCP + `save_project` | Proven live; uses r2000's own parser, no third copy of the format; satisfies R2000-15's literal wording | ✓ |
| Parse the `.lbl` ourselves, then `set_label_name` per name | Full control, but a third parser copy and R2000-15 names `--import_lbl` explicitly | |
| You decide | | |

**User's choice:** `--import_lbl` + stdio MCP + `save_project` (recommended).
**Notes:** → **D-28**.

### Q2 — How do incrementally discovered names accumulate?

| Option | Description | Selected |
|--------|-------------|----------|
| The store is the merge point — regenerate the full `.lbl` and reload | Makes replace semantics correct, leaves DERIV-04 untouched, one merge implementation | ✓ |
| Add a merge mode to `vice_symbols_load` | Fewer reloads, but reopens a settled v0.2.0 decision and diverges semantics across backends | |
| You decide | | |

**User's choice:** Store is the merge point (recommended).
**Notes:** → **D-29**.

### Q3 — What program is the loop demonstrated on?

| Option | Description | Selected |
|--------|-------------|----------|
| Committed fixture for CI, a real program for the walkthrough | Guards the loop forever and satisfies "one real program" | ✓ |
| Committed fixture only | Fully reproducible, but Phase 8.1 is the standing counter-example | |
| Real program only | Strongest evidence, but nothing guards it afterwards | |

**User's choice:** Fixture for CI, real program for the walkthrough (recommended).
**Notes:** → **D-31**. Noted that only `probe-illegal.prg` is committed; the corpus is per-project via `releases.mjs`.

### Q4 — Which backend does the live half run against?

| Option | Description | Selected |
|--------|-------------|----------|
| Stock, with the fork verified unregressed | `stock-symbols.ts` is what this repo owns; genuine stock `x64sc` is available on this host | ✓ |
| Both backends, proven separately | Widest claim, but doubles the walkthrough to prove something v0.2.0 treats as unchanged | |
| You decide | | |

**User's choice:** Stock, fork under the standing BACK-02 gate (recommended).
**Notes:** → **D-30**.

---

## Residual scope items

### Q1 — `r2000_get_address_details` is broken for every 64K project

| Option | Description | Selected |
|--------|-------------|----------|
| Exclude it; cover the need with the working tools | Its answer is a composite of tools measured working on 64K; capability honesty | |
| Include it with a guard refusing 64K projects | Available where it works, but refusal is the common case here | |
| Include it plus a client-side reimplementation for 64K | Full capability, but a second implementation of r2000's analysis | |
| **Other (free text)** | "you decide and create an issue in r2000 GitHub project" | ✓ |

**User's choice:** free text — delegated the disposition, and asked for an upstream issue.
**Notes:** → **D-32**. Claude chose *exclude*; filed
<https://github.com/ricardoquesada/regenerator2000/issues/42> with the
reproduction, the affected/unaffected tool table and a suggested fix. Also
recorded that `analyzer.rs`/`html.rs` share the pattern and that `flow_analyze`
survives by accident.

### Q2 — `r2000_batch_execute` dispatches by inner tool name

| Option | Description | Selected |
|--------|-------------|----------|
| Expose it, gate every inner name against the curated set | Mirrors `vice.ts`'s DENY_LIST smuggling guard; batching is what makes per-call spawn viable | ✓ |
| Do not expose it; one tool call per annotation | Nothing to gate, but dozens of spawns and whole-file saves per memory map | |
| You decide | | |

**User's choice:** Expose with inner-name gating (recommended).
**Notes:** → **D-33**, pinned by a smuggling test.

### Q3 — `.vsf`'s deferral points at a home that does not exist

| Option | Description | Selected |
|--------|-------------|----------|
| Explicitly out of Phase 11; correct the roadmap wording | No requirement covers it; Phase 9 found auto-detection unreliable; synthesis never hands r2000 a container | ✓ |
| Pick it up as scope here | Closes the loose end, but a VICE snapshot parser for a partly-unreliable payoff in the riskiest phase | |
| You decide | | |

**User's choice:** Explicitly out, correct the wording (recommended).
**Notes:** → **D-34**. Three sites to fix: ROADMAP Phase 10 criterion 3 note, the standing "prefer `.vsf`" constraint, and Phase 10 CONTEXT.md's deferred-ideas entry.

---

## Claude's Discretion

- **D-32** — excluding `r2000_get_address_details` and filing upstream issue #42.
  Explicitly delegated ("you decide and create an issue in r2000 GitHub project").
- **D-35** — correcting `stock-symbols.ts`'s "STATED ASSUMPTION, NOT A VERIFIED
  FACT" note about `--export_lbl`, now verified live and scoped to 0.9.20 plus
  this fixture. Not asked; recorded because the file forbids claiming verified
  compatibility without evidence, and the evidence now exists.

The planner additionally owns the exact final tool-name list under D-18's rule,
the CLI verb names, and the module split inside the directory D-06 fixes.

## Deferred Ideas

- `.vsf` as a bootstrap input (D-34) — backlog with a real reason.
- An upstream fix for `get_address_details` (issue #42) — would let D-32 be revisited.
- **Upstream feature request: bitfield enums** — a value rendering as an OR of
  named bits. That one feature collapses D-20's entire problem.
- `$D015`/`$D017`/`$D01A`/`$D01B`–`$D01D`, absent from memmap's 29 structured
  `bits` entries; widening memmap itself is `c64-memory-mapping` work.
- Non-ACME export formats (`64tass`, `ca65`, `kick`).
- Two-project-limit detection — and the observation that D-19 plus stdio may make
  the limit itself moot, so D-15's documented limitation may need narrowing.
- `r2000_undo` / `r2000_redo` — unusable under D-17; git revert of the project
  file is the substitute.
- `r2000_set_immediate_format`'s `low_byte`/`high_byte` modes — strongest
  candidate for a later surface addition (pointer tables).
- The fork-backend removal todo (semver-major) and the plugin-payload relocation
  todo (would invalidate every path in CONTEXT.md) — both reviewed, neither folded.
