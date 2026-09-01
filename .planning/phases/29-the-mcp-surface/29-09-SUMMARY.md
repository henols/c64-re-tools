---
phase: 29-the-mcp-surface
plan: 09
subsystem: skills
tags: [skills, re-pointing, removal-gate, guards, attribution, cli, installer]

requires:
  - phase: 29-06
    provides: the complete 19-verb `anno_*` surface whose real names, parameters and semantics every re-pointed playbook is written against
  - phase: 29-07
    provides: the two-verb CLI (`render-memmap`, `coverage`), the `coverage` verb's REQUIRED `--store`, and `scripts/lib/anno-cli-verbs.mjs` as the single invocation-literal seam
  - phase: 29-08
    provides: `anno-register.ts`, whose headline `anno_search` entry is the subject the skill-coverage guard's non-vacuity control is re-pointed onto
provides:
  - ten re-pointed skill files carrying zero old-family tool names, in both trees a user can receive them from
  - the `vice-mcp anno <verb>` invocation name, spelled identically in the skill prose, the verb-coverage literal and the proxy's dispatch token
  - the D-10/CUT-05 contradiction resolved with the skill named as the side that moved, and the fork-honesty assertion re-pointed at a withdrawal notice Phase 30's restoration keeps true
  - a BLOCK-scoped `skill-attribution-headers` permanent exemption over the ABS-02 headers, bidirectional like the notices one
  - the skill-coverage guard expressed over the `anno_*` family at a measured, raised floor of 18, with a load-bearing non-vacuity subject
  - the removal gate's 29-09 citations discharged in full (65 -> 0), plus CLAUDE.md's entry discharged three plans early
affects: [29-10, 29-11, 29-12, phase-30, phase-31]

actuals:
  tokens: 36000
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Dated withdrawal notice: a removed route is never deleted silently and never left as a live instruction — it is replaced by a sentence carrying a date, the name the route returns under, the phase that returns it, and the oracle it returns behind, so a reader who reaches for it fails informatively instead of hitting an unknown-verb error"
    - "A guard's assertion is re-pointed at the FUTURE name of a withdrawn route, so the same literal is the withdrawal notice today and the live invocation after the restoration — the guard survives the restoration with no second edit"
    - "An allow-list entry is discharged in one of two ways and the summary says which: DELETED when the file re-measures at zero, or MOVED to a permanent exemption when the residual is prose that outlives the deletion. Neither is 'the count went down'"
    - "A recorded provenance FIELD whose producer is gone names the CHANNEL the code can observe, never a guessed producer; the historical producer moves into dated prose with no token an extractor can mistake for a route"

key-files:
  created: []
  modified:
    - src/skills/acme-build/SKILL.md
    - src/skills/c64-memory-mapping/SKILL.md
    - src/skills/c64-program-recon/SKILL.md
    - src/skills/c64-program-recon/references/reconstruction.md
    - src/skills/c64-program-recon/references/tool-selection.md
    - src/skills/c64-program-recon/scripts/packer-finding.mjs
    - src/skills/c64-program-recon/templates/memory-map.template.md
    - src/skills/c64-ram-capture/SKILL.md
    - src/skills/routine-queue-walker/SKILL.md
    - src/skills/vice-wedge-triage/SKILL.md
    - scripts/lib/anno-cli-verbs.mjs
    - scripts/check-skill-tool-coverage.mjs
    - scripts/check-skill-fork-honesty.mjs
    - scripts/check-no-analyser.mjs
    - src/mcp/vice/vice-proxy.ts
    - src/mcp/vice/vice-proxy.test.ts
    - src/mcp/vice/anno-cli.ts
    - src/mcp/vice/anno-cli.test.ts
    - src/mcp/vice/anno-verb-coverage.test.ts
    - src/mcp/vice/module-classification.ts
    - README.md
    - CLAUDE.md

key-decisions:
  - "The re-pointing is a PROCEDURE rewrite, not a name substitution. `anno_disassemble` renders and writes nothing, so classification became read-then-record; `anno_save_project` performs no write; every call names its own `store` and every derived read its `image`; `max_results` is REQUIRED with no default on five reads. A playbook that had only its names swapped would have read correctly and been unexecutable."
  - "The `.regen2000proj` adjacent-table limitation is recorded as CLOSED rather than carried. The new store never joins two rows of its own accord (STORE-02), so the over-merge caveat is false here and repeating it would be a stale warning masquerading as care."
  - "The ABS-02 attribution headers moved to a PERMANENT exemption rather than being scrubbed. The plan's Task 2 criterion `grep -rail 'the external analyser' installer/skills | wc -l` returns 0 is unsatisfiable without deleting them, which CUT-03 and ROADMAP Phase 31 criterion 4 both forbid — recorded below as a criterion met in substance, with the substitute measurement."
  - "`packer-finding.mjs`'s `entropySource` names the CHANNEL (`caller-supplied`), not a verb. `--entropy` is caller-supplied and the code cannot know who produced the number; naming a current verb would claim a run that never happened, and naming the retired one leaves a tool-name-shaped token forever."
  - "The README's sixth required-substring assertion was RE-POINTED, not dropped: it asserted a prerequisite claim that is now false, and now asserts the CUT-03 attribution, which is the obligation that outlives the integration."

patterns-established:
  - "Withdrawal prose must avoid the stale-framing vocabulary its own honesty guard polices — `in the meantime` rather than `until then` — so a dated, current-truth notice is not mistaken for the stale forward reference the guard exists to catch"
  - "A permanent exemption over prose is BLOCK-scoped on the same marker the guard that ENFORCES that prose anchors on, so protection and enforcement agree on the block boundary by construction"

requirements-completed: [REPOINT-01, REPOINT-02, CUT-05, MCP-05]

coverage:
  - id: D1
    description: "Every tool name any skill playbook names resolves to a verb that is actually on the surface: zero old-family names remain in either tree, and all 18 distinct new-family names extracted are in ANNO_TOOL_DEFINITIONS"
    requirement: REPOINT-01
    verification:
      - kind: other
        ref: "grep -arloE '\\banno_[a-z0-9_]+' src/skills/ (no files) and over installer/skills (0 occurrences)"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs (exit 0; 'anno_*: 18 distinct names extracted, all curated')"
        status: pass
    human_judgment: false
  - id: D2
    description: "Every withdrawn CLI verb is described as withdrawn with a date and a named return condition, never left as an instruction that fails with an unknown-verb error"
    requirement: REPOINT-02
    verification:
      - kind: other
        ref: "audit of every CLI-verb mention under src/skills/: the only live invocations are `anno render-memmap` and `anno coverage`; export-asm, export-lbl, import-lbl, gen-enums, bootstrap and verify each appear only inside a sentence containing 'withdrawn'/'WITHDRAWN' and naming Phase 30"
        status: pass
    human_judgment: true
    rationale: "The grep proves the words are present. Whether a reader who reaches for the old route actually understands what to do instead is an editorial judgment no test asserts."
  - id: D3
    description: "The invocation name moved across all three halves in ONE commit — the skill prose, `verbsMissingFromSkills()`'s literal and the proxy's dispatch token — and the proxy change is line-count-neutral"
    requirement: MCP-05
    verification:
      - kind: other
        ref: "git diff --numstat HEAD~1 -- src/mcp/vice/vice-proxy.ts at d6ba750 → '5 5' (equal added and deleted)"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-verb-coverage.test.ts (6/6, including the live-execution control asserting 'anno CLI verbs: N parsed')"
        status: pass
      - kind: other
        ref: "node scripts/check-skill-tool-coverage.mjs ('anno CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved')"
        status: pass
    human_judgment: false
  - id: D4
    description: "D-10/CUT-05 is resolved in one change naming the skill as the side that moves: the live export instruction is gone, a dated withdrawal notice names the future route, and the guard's positive check asserts that notice's literal"
    requirement: CUT-05
    verification:
      - kind: other
        ref: "planted red: replacing `anno export-asm` in src/skills/acme-build/SKILL.md makes node scripts/check-skill-fork-honesty.mjs exit 1 naming that string; reverted to an empty diff and exit 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/skill-acme-build-cli.test.ts + skill-attribution.test.ts (55/55 across the affected guard tests)"
        status: pass
    human_judgment: false
  - id: D5
    description: "The shipped twin tree carries the same re-pointing, proven against the SHIPPED copy by the packaging check rather than a tracked-files scan"
    requirement: REPOINT-01
    verification:
      - kind: other
        ref: "node scripts/check-npm-packages.mjs (exit 0; @henols/c64-re-tools 34 files / 7 skills before AND after; @henols/vice-mcp 84 files, unchanged) — prepack runs sync-skills, so the list is post-sync by construction"
        status: pass
      - kind: other
        ref: "diff -r src/skills/<each> installer/skills/<each>: identical except the six deliberately-excluded test/fixture entries; installer/skills carries 0 old-family tool names and the same four residual subject mentions as src/skills, file for file"
        status: pass
    human_judgment: false
  - id: D6
    description: "The tool-name floor is re-expressed over the new family at the measured new count — raised, not lowered — with a non-vacuity subject whose disappearance fires two independent checks"
    requirement: MCP-05
    verification:
      - kind: other
        ref: "planted red: filtering anno_search out of CURATED_ANNO_TOOLS makes node scripts/check-skill-tool-coverage.mjs exit 1 on TWO assertions (the per-name curation check and the non-vacuity control); reverted to an empty diff and exit 0"
        status: pass
      - kind: other
        ref: "grep -av '^[[:space:]]*//' scripts/check-skill-tool-coverage.mjs | grep -ac 'anno-tools' → 0"
        status: pass
      - kind: unit
        ref: "src/mcp/vice/anno-register.test.ts + anno-derivation.test.ts + module-classification.test.ts (41/41)"
        status: pass
    human_judgment: false
  - id: D7
    description: "`packer-finding.mjs`'s recorded provenance value has an explicitly decided fate: the fact survives, the tool-name-shaped literal does not"
    requirement: REPOINT-02
    verification:
      - kind: other
        ref: "grep -an '\\banno' src/skills/c64-program-recon/scripts/packer-finding.mjs → no tool-name-shaped token; one dated prose provenance line naming the retired analyser"
        status: pass
      - kind: unit
        ref: "src/skills/c64-program-recon/scripts/packer-finding.test.mjs (16 pass, 1 skipped — the oracle-gated case)"
        status: pass
    human_judgment: false
  - id: D8
    description: "The removal gate's 29-09 citations are discharged in full, and every commit of this plan left the gate green"
    requirement: CUT-05
    verification:
      - kind: other
        ref: "node scripts/check-no-analyser.mjs (exit 0; 21 entries, NO 29-09 citation; 29-09's temporary total 65 -> 11 -> 0)"
        status: pass
    human_judgment: false

duration: 71 min
completed: 2026-08-29
status: complete
---

# Phase 29 Plan 09: Procedure Re-pointing Summary

**Every absorbed analysis procedure now executes on the owned annotation surface in both trees a user can receive it from — 17 old-family tool names re-pointed onto 18 verbs that actually exist, six withdrawn CLI verbs each described as withdrawn with a dated return condition, the `anno` subcommand renamed to `anno` across its three halves in one commit, and the one guard that contradicted the cut resolved with the skill named as the side that moved.**

## Performance

- **Duration:** 71 min
- **Completed:** 2026-08-29
- **Tasks:** 3 of 3
- **Files modified:** 22

## The three measured figures (these supersede the plan's prose)

Re-measured at execution, as the plan instructed, because `29-CONTEXT.md` and `REPOINT-01`/ROADMAP Phase 31 disagree with each other:

| Figure | Measured | Plan's prose | ROADMAP Phase 31 criterion 1 |
|---|---|---|---|
| Skill files naming an old-family tool-shaped token | **5** | 5 | (not stated) |
| Distinct such tokens | **17** | 17 | 18 — **wrong** |
| Files mentioning the retired analyser at all | **10** | 10 | 10 |

The plan's corrected counts are confirmed exactly. ROADMAP Phase 31's "18 distinct tool names" is the figure that is wrong; the tree carried **17**. Coincidentally the post-re-pointing count *is* 18, because the rewrite introduced `anno_remove_scope` (which the old surface had no equivalent for) while `anno_search_disassembly` and `anno_get_binary_info` both mapped onto existing names.

## Accomplishments

- **The procedures were rewritten, not renamed.** Four semantic changes made a name-only substitution impossible, and each one is now carried in the prose: `anno_disassemble` **renders and writes nothing**, so "call disassemble and the trace creates blocks for you" became read-with-`anno_disassemble`, then record with `anno_set_data_type "code"` — and the playbook now says why the split is deliberate (nothing is classified by a decoder's guess). `anno_save_project` **performs no write** and reports a revision. Every call names its own `store` (a `.annostore`), and every call that derives from bytes names an `image` as well. `max_results` is **REQUIRED with no default** on five reads. A playbook that had only its tokens swapped would have read correctly and been unexecutable — which is precisely the failure mode with no error message that REPOINT-01 exists against.
- **`bootstrap` is replaced by a property, not another verb.** The store is created by the first WRITE to a `.annostore` path; a read-only call against a path that does not exist is refused by name rather than answering against an empty store.
- **A dated limitation is recorded as CLOSED rather than carried forward.** `c64-memory-mapping`'s adjacent-table limitation (recorded 2026-08-24) said two adjacent same-type regions auto-merge and lose their boundary. The annotation store **never joins two rows of its own accord** (STORE-02), so the caveat is false here. It is rewritten as a closure with the new working rules, and the attribution header's own deviation record — which cited that limitation as where a carried hazard lived — was corrected in the same commit.
- **Six withdrawn verbs, six dated withdrawal notices.** `export-asm`, `export-lbl`, `import-lbl` and `gen-enums` each say they are withdrawn, name **Phase 30**, and name the **real-ACME byte-diff oracle** they return behind; `bootstrap` is replaced by the create-on-first-write property; `verify` went with the exporter it verified. Each notice also keeps the *discipline* the verb carried — the `.lbl` loop's three rules (the store is the merge point, `vice_symbols_load` replaces rather than merges, regenerate whole) survive as hand instructions, and `gen-enums`'s specification survives so the Phase 30 rebuild has one.
- **The invocation rename moved in one commit across all three halves** — the skill prose, `verbsMissingFromSkills()`'s `anno ${verb}` literal, and `vice-proxy.ts`'s dispatch token — with the proxy change **line-count-neutral at 5 added / 5 deleted**.
- **D-10/CUT-05 is resolved with the skill named as the side that moved,** and the guard's assertion re-pointed at the **future** route name so Phase 30's restoration keeps it true with no second edit.
- **The gate's 29-09 citations went 65 → 11 → 0** across the two task commits, and the gate was observed green after every commit.

## Task Commits

1. **Task 1: Re-point every skill playbook, and move the invocation literal, the subcommand token and the prose in one commit** — `d6ba750` (refactor)
2. **Task 2: Resolve the fork-honesty contradiction, and prove the shipped twin tree carries the same change** — `b89b010` (fix)
3. **Task 3: Re-express the tool-name floor over the new prefix, with a load-bearing non-vacuity subject** — `c3f68e4` (refactor)

**Plan metadata:** see the `docs(29-09)` commit following this SUMMARY.

## Decisions Made

### `packer-finding.mjs`'s recorded provenance value — decided, not string-replaced

ROADMAP Phase 31 requires this fate be **decided**. The field recorded where a caller-supplied entropy number came from, and named the retired analyser's binary-info verb in that verb's own tool-name shape.

**Decision: keep the fact, retire the literal, and name the CHANNEL rather than a producer.** Two things were wrong with carrying the shape forward under any spelling. It is a fact about a past run, so renaming it to a verb on the current surface would claim a run that never happened. And the branch **cannot know** who produced the number — `--entropy` is caller-supplied, and the caller may equally have measured it, read it from a derived binary-info call, or copied it out of a report. So `entropySource` is now `"caller-supplied"`, which the code can actually observe, and the historical producer moved into a dated past-tense paragraph in the file header with no token an extractor could mistake for a live route. The `unknownFinding` reason, which named "the pinned analyser surface", now names this project's own surfaces.

### The ABS-02 attribution headers are a PERMANENT exemption, not an allow-list discharge

The sixteen 29-09 skill entries left the allow-list in **two different ways**, because they were two different kinds of mention, and the gate now records which:

- **Five files re-measured at exactly zero and their entries are DELETED** — `acme-build/SKILL.md` (1), `references/reconstruction.md` (1), `references/tool-selection.md` (2), `vice-wedge-triage/SKILL.md` (2), plus each one's shipped twin. Every one named a LIVE route.
- **Four files kept a permanent residual and MOVED to a permanent exemption** — `c64-memory-mapping/SKILL.md` (6→5), `c64-program-recon/SKILL.md` (7→4) and `routine-queue-walker/SKILL.md` (5→3) keep only their ABS-02 headers; `packer-finding.mjs` (3→1) keeps its dated provenance paragraph.

A new **BLOCK-scoped `skill-attribution-headers` class** covers the headers, anchored on the same `ATTRIBUTION (ABS-02)` … `-->` marker `skill-attribution.test.ts` uses — so the guard that *enforces* the attribution and the exemption that *protects* it agree on block boundaries by construction, and a mention one line outside a header is still a reintroduction. It is bidirectional like the notices exemption: both a **hit** pin and a **block** pin are asserted per file, so deleting a header fails the gate rather than silencing it.

### The README's required-substring assertion was re-pointed, not dropped

`check-skill-fork-honesty.mjs`'s sixth required README string asserted (Phase 10, ANNO-03) that the README named the analyser as a **required prerequisite**. That claim died with the integration. Deleting the assertion was the wrong repair: the obligation that survives the cut is CUT-03's attribution. The string stays and its **reason** moves — what a reader loses if it goes is no longer an install step, it is the attribution being findable from the README instead of only from a notices file. The guard's two remaining mentions joined `attribution-guard-test`, the class that already exists for a guard that must name the subject to police prose about it.

### README, sentence by sentence

| Class | Sentences |
|---|---|
| **CORRECTED** (claim a prerequisite that no longer exists) | the `## Installing the external analyser` heading; the "requires … It is a **required prerequisite**, not an optional accelerator" sentence; the `cargo install` row; the rustc **>= 1.90** floor; both container-cost rows; the "verified against 0.9.20" row; the whole one-project-per-network-namespace paragraph (that limit belonged to an HTTP MCP route this project never used); and the two monitor-contention sentences about a `--vice` pass-through on a launch path that is gone |
| **KEPT** (attribution and history, true after the deletion) | the upstream repository link, the dual `MIT OR Apache-2.0` licence, the pinned commit `493f840…` / `v0.9.20`, and the pointer to `THIRD-PARTY-NOTICES.md` — now standing in a dated section of their own rather than inside an install section |

The Licence table row was the README's only pre-existing attribution sentence and it lived *inside* the deleted install section, so the attribution was **relocated and expanded** rather than left byte-identical. That is a deliberate departure from the plan's "unchanged" wording, recorded here because it is exactly the judgement a later reader will want to check: deleting the whole section would have removed the README's only attribution pointer while the shipped packages still incorporate the upstream prose.

### CLAUDE.md's allow-list entry was discharged three plans early

`routine-queue-walker`'s YAML `description:` is trigger text, not attribution (ROADMAP Phase 31 criterion 4 says so explicitly), and `check-skill-description-overlap.mjs` asserts CLAUDE.md's project-skills table is **byte-identical** to every SKILL.md frontmatter description. So the CLAUDE.md row had to move in the same commit or that guard goes red. Its count reached **zero**, and an entry pinning zero is an exemption with room in it — so the entry (which cited 29-10) is **deleted**, with the reason recorded in its place. Nothing 29-10 does to CLAUDE.md is blocked by its absence.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocker] Task 1's re-pointing reds `check-skill-tool-coverage.mjs`, whose file the plan assigns to Task 3**

- **Found during:** Task 1
- **Issue:** The plan's Task 1 acceptance criteria require BOTH `grep -arloE '\banno_[a-z0-9_]+' src/skills/` to return no files AND `node scripts/check-skill-tool-coverage.mjs` to exit 0. Those are incompatible while the script still extracts the old prefix: emptying the skill tree of old-family names drives `extractedAnno.size` to 0 and fails the `>= 10` floor. The script is listed only in Task 3's `<files>`.
- **Fix:** Task 1 made the **minimum functional** re-point needed to keep the guard green in its own commit — the extraction regex, the classification set (importing `CURATED_ANNO_TOOLS` **alongside** the retired one, not replacing it), the floor number, and the CLI-verb section's naming, which belongs to the invocation rename anyway. Task 3 then delivered everything the plan actually assigns to it and which was still outstanding: the full raise record, the "no manifest at all" structural note, the non-vacuity subject swap, the retired import's removal and its last use site, and the report-line wording.
- **Files modified:** `scripts/check-skill-tool-coverage.mjs`
- **Verification:** the guard exits 0 at `d6ba750`, `b89b010` and `c3f68e4`; Task 3's own grep criterion (`anno-tools` outside comment lines) reports 0 only after `c3f68e4`.
- **Committed in:** `d6ba750` and `c3f68e4`

**2. [Rule 3 - Blocker] The acme-build withdrawal notice and the fork-honesty positive check had to move in Task 1, not Task 2**

- **Found during:** Task 1
- **Issue:** Task 1's criterion 3 requires *every* CLI invocation under `src/skills/` to name a surviving verb or sit in a withdrawal sentence — which includes `acme-build/SKILL.md`'s `anno export-asm`. But the fork-honesty guard asserts that exact literal is present, so removing it without re-pointing the guard leaves a red guard at Task 1's commit.
- **Fix:** the withdrawal notice **and** the guard's positive-check re-point landed together in `d6ba750`, preserving this phase's "green at every commit" discipline. Task 2 then did the README correction, the required-substring re-pointing, the installer proof, the planted-red observation and the final allow-list discharge — all of which the plan assigns to it.
- **Files modified:** `src/skills/acme-build/SKILL.md`, `scripts/check-skill-fork-honesty.mjs`
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` exits 0 at all three commits.
- **Committed in:** `d6ba750`

**3. [Rule 1 - Bug] The withdrawal notices tripped the honesty guard's stale-forward-reference check**

- **Found during:** Task 1
- **Issue:** `check-skill-fork-honesty.mjs` fails any skill paragraph containing BOTH a bare `Phase N` reference and one of `deferred|not yet|until|unavailable`. Three of the new withdrawal paragraphs said "Until then" / "Until it does" alongside "Phase 30".
- **Fix:** the prose was reworded to "in the meantime", **not** the guard widened. A dated withdrawal notice is a current truth rather than the stale deferral the guard exists to catch, but weakening a guard to accommodate new prose is the exact anti-pattern this phase polices — the cheaper and stronger repair is on the prose side, and it costs nothing.
- **Files modified:** `src/skills/c64-program-recon/SKILL.md`, `references/reconstruction.md`, `references/tool-selection.md`
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` → `no stale phase-deferral prose found`.
- **Committed in:** `d6ba750`

**4. [Rule 1 - Bug] The rewritten prose reintroduced the forbidden standalone `disasm` verb token**

- **Found during:** Task 1
- **Issue:** describing `view`'s default as `'disasm'` reintroduced the bare token WR-03/IN-03 forbids — plan 10-06 removed `acme.mjs`'s `disasm` dispatch entry, and a playbook naming it sends an agent into an unknown-verb failure. Two sites.
- **Fix:** reworded to "the disassembly view is that parameter's documented default", which says the same thing without the token.
- **Files modified:** `src/skills/c64-memory-mapping/SKILL.md`, `src/skills/c64-program-recon/SKILL.md`
- **Verification:** `node scripts/check-skill-fork-honesty.mjs` exit 0; `skill-honesty-checks.test.ts` green.
- **Committed in:** `d6ba750`

**5. [Rule 3 - Blocker] CLAUDE.md's project-skills table drifted from the rewritten description**

- **Found during:** Task 1
- **Issue:** `check-skill-description-overlap.mjs` asserts CLAUDE.md's table is byte-identical to each SKILL.md's frontmatter `description:`. Rewriting `routine-queue-walker`'s description (required substantively by ROADMAP Phase 31 criterion 4) broke that.
- **Fix:** the row was regenerated from the SKILL.md frontmatter, and CLAUDE.md's allow-list entry — whose single occurrence was that row — was deleted with its reason recorded. See "Decisions Made".
- **Files modified:** `CLAUDE.md`, `scripts/check-no-analyser.mjs`
- **Verification:** `node scripts/check-skill-description-overlap.mjs` → `CLAUDE.md project-skills table: 7 rows, all byte-identical to their SKILL.md`.
- **Committed in:** `d6ba750`

**6. [Rule 3 - Blocker] Line-citation drift in `module-classification.ts`, twice**

- **Found during:** Tasks 1 and 3
- **Issue:** `module-classification.test.ts` Direction 9 asserts every structured `line` citation resolves to a line CONTAINING the cited symbol, and 9b does the same for `path:NN` prose citations. Adding an import to `check-skill-tool-coverage.mjs` moved two citations (Task 1); removing it moved one back and orphaned another (Task 3); rewriting `c64-program-recon/SKILL.md` moved a prose citation from `:250` to `:255`.
- **Fix:** all four re-pointed. In Task 3, `anno-tools.ts`'s `CURATED_ANNO_TOOLS` consumer citation was **re-pointed onto `anno-derivation.test.ts:55`** — the one out-of-family consumer still importing that set — rather than deleted, so the `glue` verdict keeps a live basis instead of an empty one, and its rationale now records that all three out-of-family imports are gone. A wording fix was also needed: the rationale's phrase "over the anno_* prefix" tripped Direction 4's name-as-justification prohibition.
- **Files modified:** `src/mcp/vice/module-classification.ts`
- **Verification:** `node --test module-classification.test.ts` — 20/20 pass.
- **Committed in:** `d6ba750`, `c3f68e4`

**7. [Rule 3 - Blocker] The invocation rename rippled into `anno-cli.ts` and three test files**

- **Found during:** Task 1
- **Issue:** the CLI's own `--help` advertised `vice-mcp anno <verb>` in `NPX_INVOCATION`/`PLUGIN_INVOCATION`, and three test files spawned or matched the old token (`anno-cli.test.ts`, `vice-proxy.test.ts`, `anno-verb-coverage.test.ts`'s live-execution regex). None is in the plan's `files_modified`, but leaving them would have shipped a `--help` naming a subcommand that no longer dispatches.
- **Fix:** all four re-pointed in the same commit as the token itself, including `anno-verb-coverage.test.ts`'s negative-control comment, which explains *why* `render-memmap` is the load-bearing control.
- **Files modified:** `src/mcp/vice/anno-cli.ts`, `anno-cli.test.ts`, `vice-proxy.test.ts`, `anno-verb-coverage.test.ts`
- **Verification:** `node --test anno-cli.test.ts anno-verb-coverage.test.ts` green.
- **Committed in:** `d6ba750`

### Acceptance criteria met in substance but not in literal form

**Task 2, criterion:** *"`grep -rail 'the external analyser' installer/skills | wc -l` returns 0 after the sync."*

**This criterion is unsatisfiable as written, and satisfying it would have been the defect the plan's own D-10 reasoning forbids.** The shipped skill tree carries the ABS-02 attribution headers, which name the upstream repository twice per header. ROADMAP Phase 31 criterion 4 requires those "10 instances across two trees, each with its two naming lines byte-identical", and CUT-03 exists precisely so the attribution prose is *not* what pays for the removal. Driving that grep to 0 requires deleting attributions from the shipped tarball.

What the criterion was protecting is fully delivered, and measured three ways:

| Measurement | Result |
|---|---|
| `grep -aroE '\banno_[a-z0-9_]+' installer/skills \| wc -l` — the old-family tool names, which is what "the same re-pointing" means | **0** |
| `grep -rail 'the external analyser' installer/skills \| wc -l` | **4**, and every one is accounted for: 3 files' ABS-02 headers (5, 4, 3 occurrences) plus `packer-finding.mjs`'s dated provenance line (1) |
| Per-file counts, `installer/skills` vs `src/skills` | **identical, file for file** — 5 / 4 / 3 / 1 in both trees |

The removal gate independently confirms the classification: all 24 header occurrences fall inside `skill-attribution-headers` and both `packer-finding.mjs` copies inside `surviving-provenance`, with **zero** unclassified hits anywhere under `installer/skills`. A grep count is the weaker instrument here; the gate reads bytes in-process and classifies every occurrence.

---

**Total deviations:** 7 auto-fixed (4 × Rule 3 blocker, 3 × Rule 1 bug) + 1 criterion met in substance rather than literal form.
**Impact on plan:** every auto-fix repaired a guard this plan's own change turned red, in the same commit as the change that broke it — no commit leaves a red guard behind. Two of them (deviations 1 and 2) are task-boundary adjustments made to preserve that invariant; both tasks' deliverables are complete. No scope creep: every file touched outside the plan's manifest carried a now-false statement about a file the plan does modify.

## Issues Encountered

**The plan's `<verification>` line "The removal gate's temporary allow-list has shrunk to the deletion-bound files and the roadmap prose plan 29-11 edits" is satisfied with a caveat worth stating.** The allow-list now holds **21 entries: 29-10 (166 occurrences) and 29-12 (4)**, and **nothing cites 29-09 or 29-11**. There are no 29-11 entries because ROADMAP prose lives under `.planning/`, which the gate excludes by prefix — so 29-11's own work is not gate-visible and never was. That is not a gap; it is the scope predicate working as designed, and the phrase in the plan's verification line simply describes a category the gate cannot hold.

**`render-memmap` still reads the pre-store project file, and the skill now says so.** The verb survives with its `<project>` argument, and the route that created those project files (`bootstrap`) is withdrawn. That leaves a real gap — the verb runs only against a project file a user already has — which is D-17's subject and plan 29-12's to close. The playbook carries a dated note stating exactly that, rather than quietly documenting an invocation whose input has no producer.

**ROADMAP Phase 31 criterion 1's "18 distinct tool names" is wrong** — the tree carried **17** old-family names. Recorded here rather than corrected in ROADMAP, which is plan 29-11's file.

## Verification Results

| Check | Result |
|---|---|
| `cd src/mcp/vice && npm run test:automated` | 2829 tests, 2796 pass, **5 fail** — all `anno-session.test.ts` (the `plan 18-06` FIFO-queue tests). **Failing-file SET unchanged** from 29-07's close; no new file entered it. Broker confirmed down before the run (`systemctl --user status vice-broker` → unit not found; no `x64sc`/`vice-broker` processes), so the BACK-05 phantom is not in play. |
| `cd src/mcp/vice && npm run typecheck` | exit 0 |
| `node scripts/check-skill-tool-coverage.mjs` | exit 0 — `anno_*: 18 distinct names extracted, all curated (CURATED_ANNO_TOOLS has 19 entries)`; `anno CLI verbs: 2 parsed from anno-cli.ts, 2/2 resolved` |
| `node scripts/check-no-analyser.mjs` | exit 0 — 401 files scanned, **21 entries, no 29-09 citation** |
| `node scripts/check-skill-fork-honesty.mjs` | exit 0 — `no stale phase-deferral prose found`; README carries all 6 required strings |
| `node scripts/check-skill-description-overlap.mjs` | exit 0 — CLAUDE.md table 7/7 byte-identical |
| `node scripts/check-npm-packages.mjs` | exit 0 — `@henols/vice-mcp` **84 files**; `@henols/c64-re-tools` **34 files, 7 skills** |
| `node scripts/audit-gate.mjs` | exit 0 |
| `node --test anno-verb-coverage.test.ts docs-linerefs.test.ts skill-attribution.test.ts skill-acme-build-cli.test.ts skill-honesty-checks.test.ts anno-cli.test.ts removal-gate.test.ts skill-consumer-paths.test.ts skill-description-overlap.test.ts` | 146 pass, 0 fail |
| `node --test module-classification.test.ts anno-register.test.ts anno-derivation.test.ts` | 41 pass, 0 fail |
| `node --test src/skills/c64-program-recon/scripts/packer-finding.test.mjs` | 16 pass, 0 fail, 1 skipped (oracle-gated) |
| `git diff --numstat HEAD~1 -- src/mcp/vice/vice-proxy.ts` (at `d6ba750`) | `5  5` — equal added and deleted, as required |

### Packaging, before and after

| Package | Before (at `327c7db`) | After (at `c3f68e4`) |
|---|---|---|
| `@henols/vice-mcp` | 84 files | **84 files** |
| `@henols/c64-re-tools` | 34 files, 7 skills | **34 files, 7 skills** |

The file counts are deliberately unchanged — this plan rewrote content, added no file and removed none. The proof that the *content* reached the shipped tree is the per-file comparison above (`installer/skills` identical to `src/skills` except the six excluded test entries) plus the gate's own scan of the packed list.

### Removal-gate measurement, before and after (the gate's own `subjectHits()` predicate)

| File | Before | After | Disposition |
|---|---|---|---|
| `README.md` | 8 | **2** | moved to `surviving-provenance` (attribution link) |
| `scripts/check-skill-fork-honesty.mjs` | 3 | **2** | moved to `attribution-guard-test` (the re-pointed assertion) |
| `src/skills/acme-build/SKILL.md` | 1 | **0** | entry DELETED |
| `src/skills/c64-memory-mapping/SKILL.md` | 6 | **5** | moved to `skill-attribution-headers` |
| `src/skills/c64-program-recon/SKILL.md` | 7 | **4** | moved to `skill-attribution-headers` |
| `src/skills/c64-program-recon/references/reconstruction.md` | 1 | **0** | entry DELETED |
| `src/skills/c64-program-recon/references/tool-selection.md` | 2 | **0** | entry DELETED |
| `src/skills/c64-program-recon/scripts/packer-finding.mjs` | 3 | **1** | moved to `surviving-provenance` |
| `src/skills/routine-queue-walker/SKILL.md` | 5 | **3** | moved to `skill-attribution-headers` |
| `src/skills/vice-wedge-triage/SKILL.md` | 2 | **0** | entry DELETED |
| (each of the eight `installer/skills/…` twins) | same | same | same, by construction |
| `CLAUDE.md` | 1 | **0** | entry DELETED (cited 29-10; discharged early) |
| **29-09's temporary total** | **65 across 18 entries** | **0** | 65 → 11 after task 1, 11 → 0 after task 2 |

## Known Stubs

None. No file created or modified by this plan carries a hardcoded empty value, a placeholder string, or a component with no data source wired.

## User Setup Required

None — no external service configuration required. (This plan **removes** a user setup step: the README no longer instructs anyone to `cargo install` a third-party Rust toolchain.)

## Next Phase Readiness

- **Plan 29-10 (wave 7)** inherits a skill tree and a README free of every live route into the deletion set, so nothing it deletes is still documented as reachable. Its own allow-list burden is unchanged at 166 occurrences, and CLAUDE.md's entry is already gone — one fewer file for it to touch. `module-classification.ts`'s `anno-tools.ts` verdict now cites `anno-derivation.test.ts:55`, so 29-10 must move that citation (or the verdict) when it deletes the module and that import.
- **Plan 29-11** inherits an allow-list with **no 29-09 citation**, two plans closer to the emptiness assertion it makes. It also inherits one recorded ROADMAP correction to make: Phase 31 criterion 1's "18 distinct tool names" measured as **17**, and criterion 3's `git grep` proof is superseded by the packaging proof recorded above.
- **Plan 29-12 (wave 6)** still owns `render-memmap`'s rebuild. Its CLI invocation is now spelled `anno render-memmap` in three skill files, and the playbook carries a dated note that the verb's project input has no producer — so 29-12's rebuild has both a name to keep and a stated gap to close.
- **Phase 30** inherits four dated withdrawal notices that name it by number and name the byte-diff oracle by shape: `anno export-asm` (asserted by `check-skill-fork-honesty.mjs`, and the same literal becomes the live invocation on restoration), the `.lbl` round trip's `export-lbl`/`import-lbl`, and `gen-enums` with its specification preserved. Each verb that lands there also raises `ANNO_CLI_VERB_FLOOR`.
- **Phase 31** is substantially discharged early by this plan. Its criteria 1, 2 and 3 are met and measured; criterion 4's attribution chain is intact and now mechanically protected in both directions by `skill-attribution-headers`; criterion 5 (`upstream-procedure-manifest.json` and the `anno_undo` disposition) is untouched and remains that phase's work.

---
*Phase: 29-the-mcp-surface*
*Completed: 2026-08-29*

## Self-Check: PASSED

All 22 modified files verified present on disk. All three task commits verified present in `git log --oneline --all` (`d6ba750`, `b89b010`, `c3f68e4`). Every task's `<acceptance_criteria>` was re-run at close; the one criterion not satisfiable in literal form is documented above under "Acceptance criteria met in substance but not in literal form", with its substitute measurement, rather than silently skipped. Both planted-red controls were observed failing and reverted to an empty diff.
