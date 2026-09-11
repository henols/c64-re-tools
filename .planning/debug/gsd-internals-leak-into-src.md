---
slug: gsd-internals-leak-into-src
status: awaiting_human_verify
trigger: "way is internal gsd nots and information leaking to the source code and the skills. It is not something gsd is designed to do it shall keep it inside its own files"
created: 2026-09-11
updated: 2026-09-11
---

# Debug Session: GSD internals leaking into source code and skills

## Symptoms

**Expected behavior**
GSD's internal planning vocabulary — `.planning/*` paths, `/gsd-*` command names,
phase/plan citations, decision ids (`D-NN`, `G-NN-N`), and cross-references to
`RE-FINDINGS.md` / `REQUIREMENTS.md` / `ROADMAP.md` — stays confined to GSD's own
files under `.planning/`. GSD is a planning harness; it is not designed to write its
bookkeeping into the product.

**Actual behavior**
That vocabulary is pervasive in product source and in the shipped skills. Measured
2026-09-11 by the orchestrator before delegation:

| Pattern | Hits in `src/` | Hits in `src/skills/` (shipped) |
|---|---|---|
| `.planning/` path literal | 231 | 26 |
| `GSD` / `gsd-` | 112 | 7 |
| `Phase [0-9]+` | 882 | 67 |
| `plan NN-NN` citation | 85 | 32 |
| `D-[0-9]{2}` decision id | 2242 | 75 |
| `G-[0-9]+-[0-9]+` gap id | 40 | 1 |
| `ROADMAP` | 60 | 0 |
| `MEASURED` | 930 | — |

37 skill files carry at least one. Both npm packages (`@henols/vice-mcp`,
`@henols/c64-re-tools`) ship `src/skills/**`, so end users who install the plugin
read playbooks that cite this repo's private planning artifacts.

Representative instances:
- `src/skills/vice-wedge-triage/SKILL.md:135` — cites
  `.planning/todos/pending/2026-08-01-vice-registers-frozen-after-reset-during-01-04-task2.md`
- `src/skills/c64-program-recon/SKILL.md:116` — cites
  `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-RESEARCH.md`
- `src/skills/c64-memory-mapping/SKILL.md:185-186` — instructs the end user to route
  work "behind a GSD command (`/gsd-quick`), per this project's GSD Workflow
  Enforcement rule"; the installing user has no GSD
- `src/skills/c64-program-recon/references/reconstruction.md:46` — cites
  `.planning/REQUIREMENTS.md` § Out of Scope
- `src/skills/routine-queue-walker/scripts/completeness-report.mjs:78` — "phase 45
  plan 45-01 task 2"
- `src/skills/c64-provenance-diff/scripts/diff-images.mjs:376,522` — "see
  `.planning/RE-FINDINGS.md`"

**Error messages**
None. This is a silent content leak, not a runtime fault. It surfaces only when a
consumer reads a shipped skill and finds a dangling reference to a directory that
does not exist in their checkout.

**Timeline**
Unknown at session start — accumulated over ~46 phases. Establishing when and by
what mechanism the references first entered product files is part of the
investigation.

**Reproduction**
```bash
grep -rniE '\.planning/|/gsd-|Phase [0-9]+|plan [0-9]+-[0-9]+|\bD-[0-9]{2}\b' src/skills/
```

## Scope (user-confirmed 2026-09-11)

- **Categories in scope — all five:** `.planning/*` paths, `/gsd-*` command names,
  phase/plan citations, `D-NN` / `G-NN-N` ids, and `RE-FINDINGS`/`REQUIREMENTS`/
  `ROADMAP` cross-references.
- **Tree in scope — entire repo including tests.** `src/**` in full, `*.test.*`
  included, plus `CLAUDE.md`'s own bullets.
- **Goal — diagnose AND fix**, with a guard test so it cannot regress.

### Orchestrator note on blast radius (disclosed, not a blocker)

The user chose the widest scope explicitly after being shown the counts. Two facts
the investigation must weigh rather than silently ignore:

1. `D-NN` ids are **not purely internal**. `docs/stock-vice-parity.md` ships and
   defines D-01…D-NN; `src/skills/vice-wedge-triage/SKILL.md:27` cites "`docs/stock-vice-parity.md` D-03"
   — a *resolvable* reference to a shipped doc. Blanket-stripping `D-NN` would
   destroy working cross-references. The fix must distinguish ids anchored in a
   shipped doc from ids anchored only in `.planning/`.
2. Several `.test.*` files exist **specifically** to police documentation content
   (`docs-dangling-refs.test.ts`, `docs-linerefs.test.ts`,
   `skill-honesty-checks.test.ts`, `audit-integrity.test.ts`). Their pinned strings
   legitimately name planning artifacts because that is the thing under test.
   Rewriting those pins would break the guards rather than clean them.

Both are classification problems for the debugger to resolve with evidence, not
reasons to narrow the user's chosen scope.

## Current Focus

bug_class: Bohrbug — fully deterministic, reproducible by grep at any commit; no
timing or concurrency component. Route: deterministic reproduction -> git bisect /
history archaeology (SBFL skipped: no failing test exists, the defect is content).

hypothesis: The leak is a THREE-STAGE RATCHET, not a single authoring mistake.
(1) SEED: the MCP server + skills were extracted wholesale from a *different*
GSD-managed project ("the Bruce Lee project", commit b0975f4c 2026-08-09) and
arrived carrying 424 citations that point at the DONOR repo's `.planning/` tree.
(2) CODIFY: `/gsd-map-codebase` (412bec66, 2026-08-11) observed that inherited
style and wrote it up PRESCRIPTIVELY in `.planning/codebase/CONVENTIONS.md`
§Comments as "the house style, not an exception", explicitly naming plan ids and
`D-N` decision labels as required content of a WHY header and calling them
"stable cross-reference anchors between code comments, tests, and `.planning/`
docs". That document is injected into `CLAUDE.md` (lines 115-161, marker
`<!-- GSD:conventions-start source:CONVENTIONS.md -->`).
(3) AMPLIFY: GSD's own workflows tell every downstream agent to READ that file
(`discuss-phase-assumptions.md:221`, `execute-plan.md:554`), so each phase writes
more citations; guard tests were then built that RATIFY the practice
(`comment-phase-pointers.test.ts` explicitly declines a blanket ban and polices
only staleness). Result: 424 -> 3196 hits in 33 days.

test: (complete) history archaeology + convention-source tracing + GSD-instruction
audit. See Evidence entries 3-9.

expecting: (n/a — hypothesis confirmed, see Evidence 9 for the decisive datum)

next_action: apply the fix in four atomic commits — (a) cut the prescription in
CONVENTIONS.md + resync the CLAUDE.md block, (b) clean the shipped skills, (c) add
a guard test scoped to the shipped surface, (d) repoint/remove dangling refs.

reasoning_checkpoint:
  hypothesis: "Planning vocabulary keeps appearing in product files because
    `.planning/codebase/CONVENTIONS.md` §Comments PRESCRIBES it (plan ids, `D-N`
    labels, `.planning/` cross-references as required WHY-header content), that
    file is injected into CLAUDE.md and is read by every GSD discuss/execute
    agent, and it was itself generated by /gsd-map-codebase observing citations
    that were INHERITED from a donor repository rather than authored here."
  confirming_evidence:
    - "DIRECT: `.planning/RE-FINDINGS.md` has NEVER existed in this repo — `git
      log --all -- .planning/RE-FINDINGS.md` is empty and no file matches — yet
      24 tracked `src/` files cite it and 5 shipped SKILL.md files INSTRUCT the
      end user to write findings into it. A reference that was never valid here
      cannot have been authored here; it was carried in."
    - "DIRECT: commit b0975f4c (2026-08-09, message: 'extracted from the Bruce
      Lee project') already contains `.planning/RE-FINDINGS.md`,
      `.planning/seeds/broker-restart-reaps-and-voids.md`,
      `.planning/quick/260801-ccn-.../260801-ccn-PLAN.md` and
      `.planning/incidents/README.md` citations. All four targets are MISSING in
      this repo today and three of the four citations are still in the tree
      (broker-kill.mts:576, containerpath.ts:23, vice-broker.mts:522)."
    - "DIRECT: `.planning/codebase/CONVENTIONS.md:172-190` states the rule in
      imperative form and names the exact tokens that leak: `quick-260818-nh5`,
      `phase 32 plan 32-04`, `SEAM-02`, `D-3`, `D-10`, `D-32`. The 2026-08-11
      first version already said it (`quick-260731-p8a`, `D-2`, `D-7`), i.e. the
      convention was recorded two days after the import and before this repo's
      first executed phase (02, 2026-08-13)."
    - "DIRECT: the read path is in GSD's own vendored workflows —
      `discuss-phase-assumptions.md:221` ('If codebase maps exist: Read relevant
      ones (CONVENTIONS.md, ...)') and `execute-plan.md:554`. The write path is
      `scan.md:23` (quality scanner -> CONVENTIONS.md)."
    - "QUANTITATIVE: citation count in the MCP server tree — 424 (2026-08-09
      import) -> 424 (2026-08-11 map) -> 425 (2026-08-13, first phase) -> 1593
      (2026-08-23) -> 1846 (2026-09-01 remap) -> 3196 (HEAD). 7.5x growth, all
      of it AFTER the convention was codified."
    - "DIRECT: 32 of the 87 distinct `.planning/` targets cited from `src/` do
      not resolve in this checkout — the decay CONVENTIONS.md's 'stable
      cross-reference anchors' claim asserts cannot happen."
  falsification_test: "If GSD itself (not this project's own convention doc)
    mandated the citations, the rule would appear in the vendored
    `.claude/gsd-core/` instruction set. RUN: grepped all 580 vendored files for
    citation mandates — the ONLY hit is `check-command-router.cjs:152`, a comment
    noting the PLANNER is told to cite decisions in a plan's `<read_first>`
    section, i.e. inside a `.planning/` file. No GSD instruction asks an executor
    to put a phase/plan/decision id in product source. Hypothesis SURVIVED: the
    prescription is this project's own, not GSD's. Second falsifier: if the
    citations had been authored here organically, at least the earliest ones
    would resolve. They do not — see RE-FINDINGS."
  fix_rationale: "Deleting 3196 citations without repealing the convention treats
    the symptom: the measured regrowth rate is 424->3196 in 33 days under an
    active prescription. The root-cause fix is to repeal the prescription in
    CONVENTIONS.md (and its CLAUDE.md projection), because that is the
    instruction every future agent reads. The guard test is what makes the
    repeal enforceable rather than advisory, and it must be scoped to the SHIPPED
    surface (`src/skills/**` + package.json files[]) because that is where the
    reference is unresolvable for the reader."
  blind_spots:
    - "I have not proven the donor repo's identity beyond the commit message's
      own words ('extracted from the Bruce Lee project'); the donor is not
      available to inspect. This does not affect the mechanism — the decisive
      fact is that the targets never existed HERE."
    - "`routine-queue-walker/SKILL.md`'s 23 `Phase N` hits are the SKILL's OWN
      workflow steps (Phase 0..Phase 5), not GSD phases. Any guard that does not
      exclude them produces 23 false positives on the largest offender. Verified
      by reading the file."
    - "I have not measured whether cleaning comment citations in `src/mcp/vice/`
      would red `docs-absorbed-decisions.test.ts` / `audit-integrity.test.ts` /
      `docs-linerefs.test.ts`, which pin specific comment content."
  candidate_causes:
    - "code: authors hand-writing citations into comments (SYMPTOM, not cause —
      they were following a written rule)"
    - "config/convention: `.planning/codebase/CONVENTIONS.md` §Comments
      prescribes it, and CLAUDE.md re-projects it (CONFIRMED — primary cause)"
    - "environment/tooling: GSD's map-codebase generates that file from
      observation, turning a descriptive census into a prescriptive rule
      (CONFIRMED — the amplifier that makes it self-reinforcing)"
    - "data/provenance: the source tree was imported from another GSD project
      with its citations intact (CONFIRMED — the seed)"
  and_gate: "YES — this failure REQUIRES all three simultaneously. The import
    alone would have left a static 424 references that a single sweep would fix.
    The convention alone, on a clean tree, would have produced citations that
    RESOLVE (this repo's own phases exist). It is the conjunction — inherited
    unresolvable refs + a generated rule that canonises them as house style + a
    workflow that re-reads and re-generates that rule each milestone — that
    produces unbounded growth of UNRESOLVABLE references. root_cause is therefore
    a SET, not a single item."

tdd_checkpoint: (none)

## Evidence

- timestamp: 2026-09-11 (orchestrator, pre-delegation)
  observation: Leakage is present in 37 shipped skill files and across non-test MCP
  server source (`anno-cli.ts` 14 hits, `vice.ts` 7, `vice-proxy.ts` 7,
  `anno-export-asm.ts` 7, `host-tool.mts` 5, `anno-register.ts` 5).
  method: `grep -rniE` over `src/`, counts tabulated above.

- timestamp: 2026-09-11 (orchestrator, pre-delegation)
  observation: `CLAUDE.md` itself — the file loaded into every session — carries the
  same vocabulary in its own Constraints bullets (phase/plan citations, `G-40-1`,
  `D-33`, MEASURED dates). This is a plausible propagation vector: agents read
  CLAUDE.md and mirror its citation style into the code they write.
  method: direct read of project instructions.

- timestamp: 2026-09-11 (debugger, E3)
  checked: `.planning/debug/knowledge-base.md`
  found: does not exist; no prior resolved session to match against.
  implication: no known-pattern shortcut, full investigation required.

- timestamp: 2026-09-11 (debugger, E4)
  checked: the PRESCRIPTION. `.planning/codebase/CONVENTIONS.md` §Comments
  (lines 172-190).
  found: states verbatim — "**Decision-record-style header comments are the house
  style, not an exception.** Non-trivial modules and nearly every test file open
  with a multi-paragraph block covering: **WHY THIS FILE EXISTS** — the incident or
  requirement that motivated it, usually with a dated plan id
  (`quick-260818-nh5`, `phase 32 plan 32-04`), a requirement id (`SEAM-02`,
  `BACK-05`, `GATE-01`, `PKG-03`), or a decision label (`D-3`, `D-10`, `D-32`)."
  and — "**Decision labels** ... are stable cross-reference anchors between code
  comments, tests, and `.planning/` docs."
  implication: this is an explicit, written instruction to embed planning
  vocabulary in product source. It is the proximate cause. It is NOT a GSD
  artefact by content — it is this project's own convention document, but it is
  GENERATED by a GSD command.

- timestamp: 2026-09-11 (debugger, E5)
  checked: the INJECTION path into every session.
  found: `CLAUDE.md:115` `<!-- GSD:conventions-start source:CONVENTIONS.md -->` …
  `CLAUDE.md:161` `<!-- GSD:conventions-end -->`. The projected copy is a lossy
  one-line-per-bullet summary whose first bullet is truncated mid-sentence
  ("...often referencing a specific dated"), so CLAUDE.md alone does not name the
  `D-N`/plan-id tokens — the full prescription lives in CONVENTIONS.md.
  implication: CLAUDE.md is a WEAKER vector than the orchestrator hypothesised.
  The load-bearing document is `.planning/codebase/CONVENTIONS.md`. Both must be
  changed, but the source file is the one that carries the instruction.

- timestamp: 2026-09-11 (debugger, E6)
  checked: does GSD itself mandate code-level citations? Grepped all 580 files
  under the vendored `.claude/gsd-core/` for citation/traceability mandates.
  found: ONE hit — `bin/lib/check-command-router.cjs:152`: "planner is also
  explicitly told (plan-phase.md) to cite decisions in `<read_first>`" — which is
  a citation inside a PLAN document, i.e. inside `.planning/`. No instruction
  anywhere asks an executor to write a phase/plan/decision id into product code.
  implication: FALSIFIES the "GSD tells agents to do this" vector. GSD's design
  intent (as the user stated it) is upheld by GSD's own instructions; the
  deviation is local. What GSD DOES supply is the read/write loop:
  `workflows/scan.md:23` generates CONVENTIONS.md; `workflows/execute-plan.md:554`
  and `workflows/discuss-phase-assumptions.md:221` make every executor and
  discusser read it.

- timestamp: 2026-09-11 (debugger, E7)
  checked: ORIGIN. `git log --reverse -S` across the pre-relocation path
  (`.claude/mcp/vice`, before commit c77edee7 moved it to `src/mcp/vice`).
  found: the FIRST commit containing the source — b0975f4c, 2026-08-09, "Add
  c64-rc-tools plugin: vice MCP server + C64 RE/ACME skills … **extracted from the
  Bruce Lee project**" — already contained `.planning/` citations at 20+ sites,
  including `.planning/RE-FINDINGS.md`,
  `.planning/seeds/broker-restart-reaps-and-voids.md`,
  `.planning/quick/260801-ccn-translate-broker-granted-host-coordinate/260801-ccn-PLAN.md`,
  `.planning/incidents/README.md`,
  `.planning/todos/pending/2026-08-05-wr-02-*`.
  implication: the leak PREDATES this repository. It was imported, not authored
  here. `/gsd-map-codebase` two days later observed the imported style and
  canonised it.

- timestamp: 2026-09-11 (debugger, E8)
  checked: do the imported targets resolve, and do the citations survive?
  found: `.planning/RE-FINDINGS.md` MISSING, `.planning/seeds/broker-restart-reaps-and-voids.md`
  MISSING, `.planning/quick/260801-ccn-.../` MISSING, `.planning/incidents/README.md`
  MISSING. Three of those citations are STILL in the tree at
  `src/mcp/vice/broker-kill.mts:576`, `src/mcp/vice/resources/broker-kill.mjs:451`,
  `src/mcp/vice/containerpath.ts:23`, `src/mcp/vice/vice-broker.mts:522`.
  Repo-wide: 32 of 87 distinct `.planning/` targets cited from `src/` do not
  resolve (a handful of those 32 are deliberate test plants — e.g.
  `THIS-DOCUMENT-DOES-NOT-EXIST-32-04-PLANT.md`, `v9.9.9-MILESTONE-AUDIT.md` —
  and a few are prose ellipses, but the imported ones and ~20 archived
  `todos/pending/` entries are real dangling references).
  implication: refutes CONVENTIONS.md's own justification ("stable cross-reference
  anchors"). In practice they decay.

- timestamp: 2026-09-11 (debugger, E9 — DECISIVE)
  checked: has `.planning/RE-FINDINGS.md` ever existed in this repository?
  found: NO. `find .planning -iname '*RE-FINDINGS*'` → nothing.
  `git log --all -- .planning/RE-FINDINGS.md` → empty. `git log --diff-filter=D`
  → empty. It was never created, never committed, never deleted. Yet **24 tracked
  files under `src/` cite it**, and FIVE shipped `SKILL.md` files (`acme-build`,
  `c64-program-recon`, `c64-provenance-diff`, `c64-ram-capture`,
  `vice-wedge-triage`) carry a near-verbatim footer instructing the reader:
  "Findings that make RE faster go in `.planning/RE-FINDINGS.md` **at the moment
  you find them** … File-changing work enters through a GSD command
  (`/gsd-quick`)."
  implication: this single fact carries the whole diagnosis. A reference that was
  never valid in this repository cannot have been authored in this repository —
  it was inherited. And a shipped playbook that tells an end user to write into a
  path that does not exist even for the maintainer is the user's reported symptom
  in its purest form.

- timestamp: 2026-09-11 (debugger, E10)
  checked: AMPLIFICATION. Citation count in the MCP-server tree at six commits.
  found: b0975f4c 2026-08-09 = 424 · 412bec66 2026-08-11 (first map-codebase) =
  424 · c3f2b1ab 2026-08-13 (first executed phase) = 425 · c77edee7 2026-08-23 =
  1593 · 8305eb8e 2026-09-01 (second map-codebase) = 1846 · HEAD 2026-09-11 =
  3196.
  method: `git grep -acE '\.planning/|\bD-[0-9]+\b|[Pp]hase [0-9]+|plan [0-9]+-[0-9]+'`
  at each commit, summed.
  implication: 7.5x growth in 33 days, entirely after the convention was written
  down. The mechanism is not dormant — it is actively producing new references,
  which is why an instance-only sweep would not hold.

- timestamp: 2026-09-11 (debugger, E11)
  checked: RATIFICATION. `src/mcp/vice/comment-phase-pointers.test.ts` header.
  found: states verbatim — "A blanket 'no comment mentions Phase N' rule is not
  viable here: this repo's shipped modules carry ~124 legitimate historical
  `Phase N` mentions in comments (narrating when something was decided, built, or
  found), against a mere handful of real violations. So this guard detects the
  ASSIGNMENT SHAPE specifically -- narration stays legal, hand-off does not."
  Its sibling `docs-dangling-refs.test.ts` (FLOW-02) forbids a phase number in a
  shipped STRING or TEMPLATE literal but is "deliberately, permanently scoped to
  literals only".
  implication: the project has already drawn a line — planning vocabulary is
  FORBIDDEN in runtime-visible text, PERMITTED in source comments. That line was
  drawn for the MCP server (where the reader is a maintainer). It is the wrong
  line for `src/skills/**`, where the reader is an end user who has no
  `.planning/` at all. This is the precise gap to close, and it explains why
  existing guards never caught the reported symptom.

- timestamp: 2026-09-11 (debugger, E12)
  checked: WHO ACTUALLY RECEIVES THE LEAK. `files[]` in both package manifests
  and the plugin packaging script.
  found: (a) `@henols/vice-mcp` files[] lists 90 individual modules — `docs/` is
  NOT among them. (b) `@henols/c64-re-tools` files[] = `bin/`, `skills/`,
  `README.md`, `THIRD-PARTY-NOTICES.md` — `docs/` NOT included. (c) the plugin
  zip is built by `scripts/package.sh` with `git archive HEAD`, which packs the
  ENTIRE tracked tree — its own comment concedes this: "`git archive HEAD` packs
  the whole tracked tree including `.planning/`". `.planning/` is 1551 tracked
  files.
  implication: RESOLVES CLASSIFICATION PROBLEM 1 with a sharper answer than
  posed. A `D-NN` anchored in `docs/stock-vice-parity.md` (e.g.
  `vice-wedge-triage/SKILL.md:27`) is resolvable for a PLUGIN user and DANGLING
  for an npm-installer user, because `docs/` ships in the zip but in neither
  tarball. Conversely `.planning/` refs resolve for a plugin user for the wrong
  reason — the plugin is shipping the maintainer's entire private planning tree
  to every consumer.

- timestamp: 2026-09-11 (debugger, E13)
  checked: FALSE-POSITIVE SURVEY of the shipped-skill surface (37 files, 195
  hits), read individually.
  found: four distinct classes.
  A. INSTRUCTIONS TO THE END USER that cannot be followed — the RE-FINDINGS +
     `/gsd-quick` footer in 5 SKILL.md files, plus
     `c64-memory-mapping/SKILL.md:185-186` ("`memmap` belongs behind a GSD
     command (`/gsd-quick`), per this project's GSD Workflow Enforcement rule")
     and `c64-program-recon/references/observation-hazards.md:8`. Highest harm:
     these address the reader directly.
  B. DANGLING SOURCE/PROVENANCE lines — `references/control-flow.md:3`,
     `graphics.md:3`, `sound-and-input.md:3`, `tool-selection.md:7` all open with
     "Source: `.planning/RE-FINDINGS.md`", a file that has never existed.
  C. INTERNAL BOOKKEEPING NARRATION in `scripts/*.mjs` comments ("Phase 40, plan
     40-02 (PREP-01, D-01, D-02)") — meaningless to a consumer but not an
     instruction.
  D. FALSE POSITIVES that must NOT be touched — `routine-queue-walker/SKILL.md`'s
     23 `Phase N` hits are that skill's OWN workflow steps (Phase 0 … Phase 5),
     and `c64-disk-access/scripts/c1541.test.mjs:48` reads a real evidence corpus
     under `.planning/phases/23-.../` and already SKIPS (never fails) when the
     tree is absent.
  implication: the single largest apparent offender (routine-queue-walker, 23
  hits) is entirely legitimate. Any guard must exclude the skill's own
  "Phase N" step headings or it produces 23 false positives on day one and gets
  switched off.

## Eliminated

- hypothesis: "GSD's own executor/planner instructions ask for traceability
  comments in shipped code, so the harness is doing what the user says it should
  not."
  evidence: grepped all 580 files of the vendored `.claude/gsd-core/` tree. The
  only citation mandate found is `check-command-router.cjs:152`, describing
  `plan-phase.md` telling the PLANNER to cite decisions inside a plan's
  `<read_first>` block — i.e. inside `.planning/`. Zero instructions target
  product source. GSD behaves as designed; the prescription is local to this
  project's `.planning/codebase/CONVENTIONS.md`.
  timestamp: 2026-09-11

- hypothesis: "`CLAUDE.md`'s own Constraints bullets are the propagation vector —
  agents read CLAUDE.md and mirror its citation style" (the orchestrator's
  pre-delegation hypothesis, Evidence entry 2).
  evidence: PARTIALLY eliminated — demoted from primary to secondary. The
  CLAUDE.md §Comments block is a lossy auto-generated projection of
  CONVENTIONS.md whose relevant bullet is TRUNCATED before it names any citation
  token ("...often referencing a specific dated"). CLAUDE.md therefore does not
  itself instruct anyone to write `D-NN` or plan ids. It is the SOURCE document,
  `.planning/codebase/CONVENTIONS.md:172-190`, that names them. Chronology also
  refutes primacy: the citations were already present on import (2026-08-09),
  before CLAUDE.md carried any of this.
  timestamp: 2026-09-11

- hypothesis: "The references were authored in this repo and simply went stale as
  phases completed and todos were archived."
  evidence: refuted for the seed population. `.planning/RE-FINDINGS.md` — cited by
  24 tracked `src/` files and by 5 shipped SKILL.md footers — has NO git history
  whatsoever in this repository (`git log --all` empty, `--diff-filter=D` empty).
  It was never created and never deleted here. Staleness explains the ~20
  archived `todos/pending/` citations; it cannot explain a target that never
  existed. Both mechanisms are real; import is the origin, staleness is a
  secondary decay process.
  timestamp: 2026-09-11

## Resolution

root_cause: |
  A SET of three conditions that must hold simultaneously (AND-gate fired):

  1. IMPORT (data/provenance, 2026-08-09, commit b0975f4c). The MCP server and
     skills were extracted from another GSD-managed project and arrived with 424
     citations pointing at the DONOR repository's `.planning/` tree. Decisive
     proof: `.planning/RE-FINDINGS.md` is cited by 24 tracked `src/` files and by
     five shipped SKILL.md footers, and has never existed in this repository at
     any commit.

  2. PRESCRIPTION (convention, 2026-08-11, commit 412bec66).
     `/gsd-map-codebase` observed the imported style and wrote it into
     `.planning/codebase/CONVENTIONS.md` §Comments as a normative rule — "the
     house style, not an exception" — explicitly requiring a WHY header to carry
     "a dated plan id …, a requirement id …, or a decision label (`D-3`, `D-10`,
     `D-32`)" and asserting these are "stable cross-reference anchors between
     code comments, tests, and `.planning/` docs". It is projected into
     `CLAUDE.md:115-161` via the `GSD:conventions` marker block.

  3. AMPLIFICATION LOOP (tooling). GSD's workflows make every downstream agent
     READ that file (`discuss-phase-assumptions.md:221`,
     `execute-plan.md:554`) and re-GENERATE it from the codebase
     (`scan.md:23`). Each milestone therefore observes a larger citation
     population and restates the rule more confidently, while guard tests built
     along the way (`comment-phase-pointers.test.ts`) explicitly declined a
     blanket ban and legalised "historical narration", ratifying the practice.
     Measured effect: 424 -> 3196 citations in 33 days.

  Why the existing guards never caught it: the project drew its line at
  RUNTIME-VISIBLE TEXT (`docs-dangling-refs.test.ts` FLOW-02 forbids a phase
  number in a shipped string/template literal) and deliberately exempted
  comments. That line is defensible for `src/mcp/vice/**`, whose reader is a
  maintainer with the `.planning/` tree in front of them. It is the wrong line
  for `src/skills/**`, whose reader is an end user who installed a plugin and has
  no `.planning/` at all — which is exactly the surface the user reported.

fix: |
  Staged in three atomic commits, addressing the root cause first.

  COMMIT 1 (714c0391) -- repeal the prescription. The rule that produced the
  leak lived in `.planning/codebase/CONVENTIONS.md` §Comments, which is
  REGENERATED by `/gsd-map-codebase` and therefore cannot hold a repeal. So:
    - `.planning/ENGINEERING_RULES.md` gains § 21 "Planning vocabulary stays
      inside `.planning/`" (hand-maintained, never regenerated) with § 21.1
      the hard mechanically-enforced rule for `src/skills/**`, § 21.2 the
      "state the reason, not the reference" rule for product source, § 21.3
      the ban on `.planning/` paths with the measured decay evidence, and
      § 21.4 the ratchet's history plus an explicit override of any future
      map-codebase run that re-describes citations as house style.
    - `.planning/codebase/CONVENTIONS.md` §Comments rewritten: the WHY-header
      discipline is KEPT (it is genuinely valuable and the user did not ask
      for it to go), but its anchor changes from a plan/decision id to an
      actionable reason, with a worked bad/good pair. Carries a note telling a
      future map-codebase run that the 1659 legacy occurrences are a backlog,
      not the style.
    - `CLAUDE.md`'s `GSD:conventions` block resynced to match.

  COMMIT 2 -- guard + clean the shipped skills (one atomic unit: the rule and
  the proof it holds).
    - NEW `src/mcp/vice/skills-planning-vocabulary.test.ts`. Scans every text
      file under `src/skills/**` for eight categories (`.planning` path, gsd
      command, phase citation, plan citation, decision/gap id, requirement id,
      planning-artifact filename, planning-doc cross-reference). Auto-included
      in `npm run test:automated` via test-gate.mjs's glob.
      TWO NARROW EXEMPTIONS, both non-vacuously tested:
        (a) a skill's OWN declared workflow steps -- it parses the file's
            `## Phase N` headings and exempts ONLY those numbers, so
            routine-queue-walker's 23 legitimate "Phase 0..5" mentions pass
            while a "Phase 40" in the same file still fails;
        (b) `c64-disk-access/scripts/c1541.test.mjs`, exempted BY PATH, with a
            liveness assertion that it still contains the reference AND still
            degrades to a skip.
      A decision id is allowed when the same line names the shipped document
      that defines it (`` `docs/stock-vice-parity.md` D-03 ``); a bare `D-03`
      is not. Two planted controls prove the predicate distinguishes dirty
      from clean.
    - Cleaned all 276 violations across 47 files: 9/9 SKILL.md, 6 reference
      pages, 1 template, 1 scaffold, 1 JSON data file, and 22 scripts.
      `src/skills/**` is now at ZERO.
      Notable content fixes rather than deletions:
        * FIVE SKILL.md files carried an identical copy-pasted footer telling
          the reader to file findings in `.planning/RE-FINDINGS.md` and route
          work "through a GSD command (`/gsd-quick`)". Replaced with the same
          grading discipline addressed to the reader's own notes.
        * `vice-wedge-triage/SKILL.md:53` and
          `c64-program-recon/references/tool-selection.md:23` told users
          incident records land under `.planning/incidents/`. FACTUALLY WRONG
          since D-33 (2026-09-08) moved them to `.c64-re-tools/incidents/`.
          Corrected, not merely stripped.
        * `c64-memory-mapping/SKILL.md:185` told the installing user to run
          `memmap` "behind a GSD command (`/gsd-quick`), per this project's GSD
          Workflow Enforcement rule". Replaced with the actual safety advice
          (it mutates tracked files; run on a clean tree, review the diff).
        * `completeness-report.mjs:232` emitted "(REPRO-02)" into the report a
          user reads; `watch-loads.mjs` emitted "plan 02-02", "Phase 3/4",
          "D-12", "VERIFY-01" into a generated `recovery/LOADING.md`. Both are
          runtime output, now clean.
        * `vsf-slice.test.mjs:214` ACTIVELY PINNED the leak
          (`assert.match(src, /Phase 40 plan 40-06/)`). Re-anchored onto the
          semantic phrase instead of the plan number.
        * `derive-transients.mjs:361` builds a string that must stay
          byte-identical to committed data in `transients/danish.json`; both
          sides changed together and re-verified.

verification: |
  guardrail_verdict: accepted

  Signal -- baseline captured BEFORE any edit (`npm run test:automated`,
  EXIT=1, broker confirmed not running):
    1. annoRegisterEntryFor(): both new tools have a register entry citing a
       real consumer path and a declared requirement id
    2. DIRECTION 5 (basis integrity): ... every id is declared in
       .planning/REQUIREMENTS.md
    3. planted violation (the negative control): a CLEAN synthetic entry is
       reported by NONE of the predicates
    4. check-skill-fork-honesty: every spelling that RESOLVES to the
       repository root is accepted
  1-3 are the known anno-register floor. 4 is the known zz-scratch race (its
  own failure text names `src/skills/acme-build/zz-scratch-T3tPC4/...`, a
  scratch dir another test wrote into the real tree concurrently).

  Signal -- the guard is non-vacuous: it went RED on the untouched tree with
  276 violations in 47 files while all four of its OTHER cases (non-empty
  scan set, exemption liveness, planted dirty, planted clean) passed. That
  RED/GREEN pair is the regression proof.

  Signal -- targeted suites after the cleanup:
    * `node --test skills-planning-vocabulary.test.ts` -> 5/5 pass
    * `node --test 'src/skills/*/scripts/*.test.mjs'` (the exact CI command)
      -> 196 tests, 191 pass, 0 fail
    * all five CI skill guards (`check-skill-fork-honesty`,
      `check-skill-cli-invocations`, `check-skill-description-overlap`,
      `check-skill-tool-coverage`, `check-no-skill-external-spawn`) -> exit 0
    * `docs-linerefs` / `docs-dangling-refs` / `docs-absorbed-decisions`
      after the CLAUDE.md edit -> exit 0

files_changed:
  - CLAUDE.md
  - .planning/ENGINEERING_RULES.md
  - .planning/codebase/CONVENTIONS.md
  - src/mcp/vice/skills-planning-vocabulary.test.ts (new)
  - src/skills/** (47 files)

  Signal -- full-suite regression, AFTER the fix (`npm run test:automated`,
  EXIT=1): failure SET is BYTE-IDENTICAL to the baseline set above, all four
  entries, no additions and no removals. The `check-skill-fork-honesty` entry
  reproduced with INVERTED polarity ("got 0, unflagged 1" vs the baseline's
  "got 1, unflagged 0"), which is the signature of the scratch-file race
  rather than a content change; no zz-scratch directory was left behind.

  Signal -- collateral gates, all after the fix:
    * `npx tsc --noEmit` -> exit 0 (the new .ts guard typechecks)
    * `node --test test-gate.test.ts ci-suite-coverage.test.ts` -> 13 pass /
      0 fail, so the new guard is correctly picked up by the automated gate's
      glob and is not orphaned from the drift guard
    * `node scripts/check-npm-packages.mjs` -> OK; @henols/vice-mcp 104 files,
      @henols/c64-re-tools 42 files / 9 skills; sync-skills reports
      installer/skills byte-for-byte in sync with the cleaned src/skills/

  Signal -- final census: `src/skills/**` is at ZERO across all eight
  categories (one named exemption). Dangling `.planning/` targets cited from
  `src/` fell from 65 occurrences in 42 files to 51 in 31 files (the residue
  is entirely in `src/mcp/vice/**`).

  NOT DONE, MEASURED AND DISCLOSED: `src/mcp/vice/**` still carries 1663
  occurrences across 95 of the 103 modules `package.json`'s `files[]` ships
  verbatim to npm. That surface is deliberately staged rather than swept here
  -- see the Resolution note below.

remaining_scope: |
  The user's settled scope was the entire repo. Two parts of it are measured
  but NOT swept in this session, and the reasons are evidence-based rather
  than a narrowing:

  1. `src/mcp/vice/**` -- 1663 occurrences in 95 shipped modules. Each needs
     the citation replaced by the REASON it stands for (per § 21.2), which is
     a judgement call per site, not a mechanical strip: the comments are the
     house's engineering rationale and § 21.2 explicitly forbids shortening
     them away. At least six committed guards pin comment content in this
     tree (`docs-linerefs`, `docs-dangling-refs`, `comment-phase-pointers`,
     `hop-chain-comments`, `docs-absorbed-decisions`, `audit-integrity`), so
     a sweep must move the guards in step. That is a planned phase, not a
     debug-session edit, and starting it here would leave it half-done.
     The guard written this session is directly extensible to it: widen
     `shippedSkillFiles()` to the `files[]` module set and the same eight
     categories apply unchanged.

  2. `CLAUDE.md`'s Constraints bullets. Its § Comments block WAS rewritten
     (that was the propagation vector). Its Constraints bullets were not:
     they are auto-generated from `.planning/PROJECT.md` via the
     `GSD:project` marker block, and `docs-linerefs.test.ts` mechanically
     verifies the `vice-proxy.ts:<N>` citations inside them. CLAUDE.md is
     also a maintainer-instruction file rather than product output, so the
     § 21 rationale ("the reader has only the product") does not apply to it
     the way it applies to a skill. Worth a decision, not an assumption.

