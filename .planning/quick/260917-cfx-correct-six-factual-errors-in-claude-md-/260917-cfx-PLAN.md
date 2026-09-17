---
quick_id: 260917-cfx
phase: quick-260917-cfx
plan: 01
type: execute
wave: 1
depends_on: []
autonomous: true
requirements: [QUICK-260917-cfx]

files_modified:
  - CLAUDE.md

# This plan deletes no file. `files_deleted` is therefore absent by
# measurement, not by omission. It also edits exactly ONE file: the
# locked findings forbid touching anything else.

estimate:
  tokens: 22500       # raw_tokens x factor 0.5
  raw_tokens: 45000
  tasks: 2
  confidence: high    # sample_count 322, factor 0.5, applied true, clamped

must_haves:
  truths:
    - "The Architecture spawn bullet in `CLAUDE.md` names `broker-launch.mts` as the one current member of the emulator-spawning module set, and no longer claims the set is empty."
    - "The `build.ts` host-bound module bullet lists all ten `.mts` sources that `HOST_BOUND_ARTIFACTS` in `src/mcp/vice/build.ts` emits."
    - "Both ACME library-prefix citations point at `findAcmeLib()` in `src/mcp/vice/host-tool.mts`, with no line range attached."
    - "Both prose skill counts say nine, matching the nine directories under `src/skills/`."
    - "The advertised tool count says 76 and shows the 47-manifest / 29-directly-registered split that makes it checkable."
    - "The three rotted `package.json` line anchors are gone, and each of the three facts they carried (Node >= 24, Node >= 18, `node --test '*.test.*'`) still reads unchanged."
    - "Both GSD marker pairs still exist exactly once each, so both blocks stay addressable."
    - "No bullet inside either GSD block ends mid-sentence — every one closes with `.` or `)`."
    - "The `## Component Responsibilities` table survives with all 17 of its pipe-prefixed lines."
    - "The two GSD blocks together occupy between 35 and 60 lines, down from 147."
  artifacts:
    - "CLAUDE.md (repo root) — the single edited file."
  key_links:
    - "`HOST_BOUND_ARTIFACTS` in `src/mcp/vice/build.ts` is the authority for the ten-module list; the CLAUDE.md bullet must mirror it."
    - "`.planning/codebase/CONVENTIONS.md` and `.planning/codebase/ARCHITECTURE.md` are the complete sources the truncated blocks were condensed FROM; the replacement links back to them."
---

<objective>
Correct six verified factual errors in `CLAUDE.md` and replace the content of its
two structurally-broken GSD-generated blocks with a hand-written, accurate,
self-contained condensation.

Purpose: `CLAUDE.md` is loaded into every Claude session in this repo. Six of its
claims are measurably false against the tree, and 148 of its 329 lines are
truncated mid-sentence, which makes them unusable as instructions. A reader
acting on the spawn-safety bullet today would conclude no module spawns the
emulator, which is wrong and safety-relevant.

Output: One file changed (`CLAUDE.md`), two atomic commits.

Scope guard: this is documentation-only. No source file, no test, no other
document is edited. Every fact below was already verified against the tree by the
orchestrator — do not re-derive, re-investigate or second-guess any of it.
</objective>

<execution_context>
@/home/henrik/dev/henrik/git/c64-re-tools/.claude/gsd-core/workflows/execute-plan.md
</execution_context>

<context>
@/home/henrik/dev/henrik/git/c64-re-tools/CLAUDE.md
@/home/henrik/dev/henrik/git/c64-re-tools/.planning/codebase/CONVENTIONS.md
@/home/henrik/dev/henrik/git/c64-re-tools/.planning/codebase/ARCHITECTURE.md
</context>

<!--
  planner-discipline allowlist. Task 2's verify negative-greps the ten empty
  heading strings and Task 1's verify negative-greps seven stale literals. Those
  same literals appear in the task actions because the executor has to find the
  exact text it is replacing in a 329-line prose file. The greps run against
  CLAUDE.md, never against this plan, so there is no self-invalidation path.
-->
<!-- planner-discipline-allow: That set is currently **empty** -->
<!-- planner-discipline-allow: src/skills/acme-build/SKILL.md:181-186 -->
<!-- planner-discipline-allow: plus six C64 -->
<!-- planner-discipline-allow: Skills (six) -->
<!-- planner-discipline-allow: ~63 tools -->
<!-- planner-discipline-allow: src/mcp/vice/package.json:29 -->
<!-- planner-discipline-allow: package.json:58 -->
<!-- planner-discipline-allow: installer/package.json:11 -->
<!-- planner-discipline-allow: ## Scope Note -->
<!-- planner-discipline-allow: ## Function Design -->
<!-- planner-discipline-allow: ## Module Design -->
<!-- planner-discipline-allow: ## Data Flow -->
<!-- planner-discipline-allow: ## Anti-Patterns -->
<!-- planner-discipline-allow: ## Cross-Cutting Concerns -->
<!-- planner-discipline-allow: ### Primary tool-call path (emulator control) -->
<!-- planner-discipline-allow: ### Recovery/incident path (recycle or crash) -->
<!-- planner-discipline-allow: ### Re-deriving a cross-cutting seam locally -->
<!-- planner-discipline-allow: ### Killing/relaunching preemptively to serve a newer request -->

<tasks>

<task type="auto">
  <name>Task 1: Apply the six factual corrections (C1-C6)</name>
  <files>CLAUDE.md</files>
  <read_first>
    Read `CLAUDE.md` in full before editing — it is 329 lines and the six edits
    are scattered across it. Line numbers below are the pre-edit positions and
    shift as you go; locate each edit by its surrounding text, not by line number.

    Do not read any source file to re-confirm the facts. They are locked input,
    already verified. One exception: you MAY open `src/mcp/vice/build.ts` around
    `HOST_BOUND_ARTIFACTS` to copy the ten names in their exact order.
  </read_first>
  <action>
C1 — the Architecture bullet at line 48 that begins "Every shipped module that
spawns the emulator binary". Its closing claim is false. Rewrite the bullet so it
states that the set of shipped modules that spawn the emulator binary has exactly
ONE current member, `src/mcp/vice/broker-launch.mts`, which spawns in argv-array
form (`spawn(viceBin, viceArgs)`, never `shell: true`, never a string-interpolated
binary path). Keep the historical note that a `--help` backend probe was the set's
prior member and was removed when backend detection collapsed to a single stock
target — that part is true and useful — but it must no longer be the basis for a
claim that the set is empty. Preserve the bullet's imperative force: any NEW module
that spawns the emulator binary must use the argv-array form, and the set stays
frozen rather than assumed. The literal phrase "That set is currently **empty**"
must not survive anywhere in the file.

C2 — the Frameworks bullet at line 77 describing `src/mcp/vice/build.ts`. It lists
seven host-bound modules. `HOST_BOUND_ARTIFACTS` in `src/mcp/vice/build.ts` holds
TEN entries, in this order: vice-broker, container-guard, broker-state,
broker-launch, broker-kill, broker-epoch, broker-control, backend-detect,
host-tool, ghidra-project. The array stores the `.mjs` OUTPUT names; the `.mts`
sources share those basenames. Rewrite the bullet to list all ten `.mts` sources.
The three currently missing are `backend-detect.mts`, `host-tool.mts` and
`ghidra-project.mts`. Keep the bullet's existing explanation of WHY the build step
exists (the host side, outside any container, cannot rely on Node's type-stripping).

C3 — two citations for the four ACME library prefixes, at line 50 (the Dependency
bullet, which cites the skill file without a range) and line 79 (the Frameworks
bullet, which cites `src/skills/acme-build/SKILL.md:181-186`). Both are wrong: the
prefixes are not in that skill file at all. They live in `findAcmeLib()` in
`src/mcp/vice/host-tool.mts`. Repoint BOTH citations at `findAcmeLib()` in
`src/mcp/vice/host-tool.mts`, citing the function by name. Do NOT attach a line
range to either — line anchors are exactly what C6 is cleaning up. Leave the
prefix values themselves and the "Verified locally against ACME release 0.97 Zem"
note unchanged.

C4 — two prose counts of the skills. Line 8 says the plugin ships six C64
reverse-engineering skills; the table row at line 187 is labelled "Skills (six)".
There are NINE directories under `src/skills/`. Change both to nine. The
`## Project Skills` table already lists all nine correctly — do not touch it.

C5 — the tool count at line 8. The advertised surface is 76, not ~63: 47 `vice_*`
entries in `src/mcp/vice/tools-manifest.stock.json`, plus 1 synthetic
`vice_result_continue` and 28 `anno_*` tools registered directly in
`vice-proxy.ts` (the `anno_*` tools are deliberately in NEITHER manifest — they
reach a proxy-local SQLite store and never touch VICE). Rewrite the parenthetical
to say "76 tools" and to show the split as 47 from the manifest plus 29 registered
directly, so a future reader can re-count it instead of trusting a bare figure.

C6 — three rotted line-number anchors. Every FACT they carry is correct; only the
anchors moved, so change the citation form and nothing else.
  * Line 64 cites `engines` at `src/mcp/vice/package.json:29`. Cite `engines.node`
    in `src/mcp/vice/package.json` by field name instead. The Node >= 24 fact and
    its type-stripping rationale stay exactly as written.
  * Line 74 cites the test script at `package.json:58`. Cite the `test` script in
    `src/mcp/vice/package.json` by name instead. The command `node --test
    '*.test.*'` stays exactly as written.
  * Line 65 cites installer engines at `installer/package.json:11`. Cite
    `engines.node` in `installer/package.json` by field name instead. The Node >= 18
    fact stays exactly as written.
Do NOT substitute freshly-counted line numbers — they will rot again. Leave the
`src/mcp/vice/package.json:64` citation on line 70 alone; it is outside this
task's locked scope.

Touch nothing else. In particular: leave the Protocol / Capability / Safety /
Concurrency / Dependency bullets untouched beyond C1 and C3; leave the
"Advertised tool surface" table row at line 183 alone (it is correct as written);
leave the `## GSD Execution Isolation` section and the profile block alone.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && rc=0; for p in 'That set is currently **empty**' 'src/skills/acme-build/SKILL.md:181-186' 'plus six C64' 'Skills (six)' '~63 tools' 'src/mcp/vice/package.json:29' 'package.json:58' 'installer/package.json:11'; do n=$(grep -Fc -- "$p" CLAUDE.md || true); [ "$n" = 0 ] || { echo "STALE($n): $p"; rc=1; }; done; for p in 'broker-launch.mts' 'backend-detect.mts' 'host-tool.mts' 'ghidra-project.mts' 'findAcmeLib()' '76 tools' 'Skills (nine)' 'Node >= 24' 'Node >= 18' "node --test '*.test.*'"; do n=$(grep -Fc -- "$p" CLAUDE.md || true); [ "$n" -ge 1 ] || { echo "MISSING: $p"; rc=1; }; done; a=$(awk '/Every shipped module that spawns the emulator binary/ && /broker-launch\.mts/' CLAUDE.md | wc -l); [ "$a" -ge 1 ] || { echo "C1: spawn bullet does not name broker-launch.mts"; rc=1; }; b=$(awk '/build\.ts/ && /vice-broker/ && /container-guard/ && /broker-state/ && /broker-launch/ && /broker-kill/ && /broker-epoch/ && /broker-control/ && /backend-detect/ && /host-tool/ && /ghidra-project/' CLAUDE.md | wc -l); [ "$b" -ge 1 ] || { echo "C2: no single bullet lists all ten host-bound modules"; rc=1; }; c=$(grep -nF 'findAcmeLib()' CLAUDE.md | wc -l); [ "$c" -eq 2 ] || { echo "C3: expected 2 findAcmeLib() citations, found $c"; rc=1; }; d=$(git -C /home/henrik/dev/henrik/git/c64-re-tools diff --name-only HEAD -- src/mcp/vice/build.ts src/mcp/vice/host-tool.mts src/mcp/vice/broker-launch.mts src/mcp/vice/vice-proxy.ts src/mcp/vice/package.json installer/package.json src/skills docs README.md | wc -l); [ "$d" -eq 0 ] || { echo "SCOPE: a source file this plan must not touch was modified"; rc=1; }; e=$(git -C /home/henrik/dev/henrik/git/c64-re-tools diff --name-only HEAD -- CLAUDE.md | wc -l); [ "$e" -ge 1 ] || { echo "SCOPE: CLAUDE.md was not modified at all"; rc=1; }; echo "rc=$rc"; exit $rc</automated>
  </verify>
  <done>
    The verify script exits 0. All eight stale literals are gone from `CLAUDE.md`,
    all ten replacement literals are present, the spawn bullet names
    `broker-launch.mts` on its own line, one bullet lists all ten host-bound
    modules, `findAcmeLib()` is cited exactly twice, and `git status` shows no
    tracked file modified other than `CLAUDE.md`.

    Commit: `docs(claude): correct six verified factual errors in CLAUDE.md`
  </done>
</task>

<task type="auto">
  <name>Task 2: Replace the truncated conventions and architecture block content</name>
  <files>CLAUDE.md</files>
  <read_first>
    Read `.planning/codebase/CONVENTIONS.md` (253 lines) and
    `.planning/codebase/ARCHITECTURE.md` (583 lines). These are the COMPLETE,
    healthy source documents. The blocks in `CLAUDE.md` were truncated by the
    sync step that injected them, not by any damage to these sources. Re-running
    `/gsd-map-codebase` would reproduce the damage and is NOT the fix — do not
    propose it.

    Use these sources to recover the full text of any truncated bullet worth
    keeping. Prefer completing a good truncated bullet from its source over
    inventing new prose.
  </read_first>
  <action>
Replace the CONTENT between the two GSD marker pairs in `CLAUDE.md`. The
conventions block runs from the `GSD:conventions-start source:CONVENTIONS.md`
marker to the `GSD:conventions-end` marker; the architecture block runs from
`GSD:architecture-start source:ARCHITECTURE.md` to `GSD:architecture-end`.
Together they currently span 147 lines, of which 70 bullets are cut off
mid-sentence, 10 headings carry zero content, and one fenced block is empty.

Hard constraints on the replacement:

Keep all four marker comments byte-identical and in place, so both blocks stay
addressable by the sync tooling. Only the content between them changes.

Keep the `## Component Responsibilities` markdown table in the architecture block
verbatim — all 17 pipe-prefixed lines, header and separator included. It is
accurate and genuinely useful. Its skills row was already relabelled by Task 1;
carry that corrected row through unchanged.

Keep the `## Conventions` and `## Architecture` top-level headings.

Every bullet you retain must be a COMPLETE sentence a reader can act on, ending
in `.` or `)`. If you cannot complete a bullet accurately from the source
document, delete it rather than leaving it truncated. This is the whole point of
the task: a half-sentence instruction is worse than no instruction.

Delete outright the ten content-free headings and the empty fenced block under
the System Overview heading. The headings to remove are: ## Scope Note,
## Function Design, ## Module Design, ## Data Flow, ### Primary tool-call path
(emulator control), ### Recovery/incident path (recycle or crash),
## Anti-Patterns, ### Re-deriving a cross-cutting seam locally,
### Killing/relaunching preemptively to serve a newer request, and
## Cross-Cutting Concerns. Do not resurrect them with hand-written content —
delete them and let the source document carry that detail.

Add, as the first line of content inside each block, a one-line pointer to the
full source document: `.planning/codebase/CONVENTIONS.md` for the conventions
block and `.planning/codebase/ARCHITECTURE.md` for the architecture block, so the
deleted detail is one hop away.

Target a large net reduction: the two blocks together should land at roughly 35
to 55 lines, down from 147. The architecture block's 17-line table plus its
heading, marker pair and pointer already account for about 21 of that, so budget
roughly 8 to 12 complete bullets for architecture and 12 to 18 for conventions.
Do not pad to fill the budget; delete anything you cannot state accurately.

Choose the surviving bullets by what a session actually needs in-context: the
naming patterns, the code-style rules, the import-extension rule, the error-class
hierarchy and the comment-content rule for conventions; the container-in /
host-out split, the single-seam-per-concern rule, the generated-but-committed
artifact rule, the no-build-step rule, the single-owner launch guard, and the
never-throw stdio boundary for architecture. The rest belongs in the source
documents the pointers now name.
  </action>
  <verify>
    <automated>cd /home/henrik/dev/henrik/git/c64-re-tools && rc=0; for m in 'GSD:conventions-start source:CONVENTIONS.md' 'GSD:conventions-end' 'GSD:architecture-start source:ARCHITECTURE.md' 'GSD:architecture-end'; do n=$(grep -nF -- "$m" CLAUDE.md | wc -l); [ "$n" -eq 1 ] || { echo "MARKER($n): $m"; rc=1; }; done; t=$(awk '/GSD:architecture-start/,/GSD:architecture-end/' CLAUDE.md | grep -n '^|' | wc -l); [ "$t" -eq 17 ] || { echo "TABLE: expected 17 pipe lines, found $t"; rc=1; }; L=$(( $(awk '/GSD:conventions-start/,/GSD:conventions-end/' CLAUDE.md | wc -l) + $(awk '/GSD:architecture-start/,/GSD:architecture-end/' CLAUDE.md | wc -l) )); [ "$L" -ge 35 ] && [ "$L" -le 60 ] || { echo "SIZE: combined blocks are $L lines, want 35-60"; rc=1; }; T=$(awk '/GSD:conventions-start|GSD:architecture-start/{b=1} /GSD:conventions-end|GSD:architecture-end/{b=0} b && /^[[:space:]]*- / && !/[.)]$/ {c++} END{print c+0}' CLAUDE.md); [ "$T" = 0 ] || { echo "TRUNCATED: $T bullets do not end in . or )"; rc=1; }; F=$(awk '/^```text$/{getline; if ($0 ~ /^```$/) print "EMPTY"}' CLAUDE.md | wc -l); [ "$F" = 0 ] || { echo "FENCE: empty text fence still present"; rc=1; }; for h in '## Scope Note' '## Function Design' '## Module Design' '## Data Flow' '## Anti-Patterns' '## Cross-Cutting Concerns' '### Primary tool-call path (emulator control)' '### Recovery/incident path (recycle or crash)' '### Re-deriving a cross-cutting seam locally' '### Killing/relaunching preemptively to serve a newer request'; do n=$(grep -Fc -- "$h" CLAUDE.md || true); [ "$n" = 0 ] || { echo "EMPTY HEADING SURVIVED: $h"; rc=1; }; done; for p in '## Conventions' '## Architecture' '.planning/codebase/CONVENTIONS.md' '.planning/codebase/ARCHITECTURE.md' '| Stdio MCP entry point |' '| Host broker daemon |' '| Advertised tool surface |' '| Skills (nine) |'; do n=$(grep -Fc -- "$p" CLAUDE.md || true); [ "$n" -ge 1 ] || { echo "MISSING: $p"; rc=1; }; done; d=$(git -C /home/henrik/dev/henrik/git/c64-re-tools diff --name-only HEAD -- src/mcp/vice/build.ts src/mcp/vice/host-tool.mts src/mcp/vice/broker-launch.mts src/mcp/vice/vice-proxy.ts src/mcp/vice/package.json installer/package.json src/skills docs README.md | wc -l); [ "$d" -eq 0 ] || { echo "SCOPE: a source file this plan must not touch was modified"; rc=1; }; e=$(git -C /home/henrik/dev/henrik/git/c64-re-tools diff --name-only HEAD -- CLAUDE.md | wc -l); [ "$e" -ge 1 ] || { echo "SCOPE: CLAUDE.md was not modified at all"; rc=1; }; echo "rc=$rc"; exit $rc</automated>
  </verify>
  <done>
    The verify script exits 0. Both marker pairs are intact and balanced, the
    17-line Component Responsibilities table survives with its corrected skills
    row, the two blocks together measure 35-60 lines, zero bullets inside them end
    mid-sentence, the empty fenced block and all ten content-free headings are
    gone, both source-document pointers are present, and no file other than
    `CLAUDE.md` is modified.

    Commit: `docs(claude): replace truncated conventions and architecture blocks`
  </done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| CLAUDE.md -> every future session | The file is auto-loaded as instructions; a false claim here steers real code changes. |

## STRIDE Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation Plan |
|-----------|----------|-----------|----------|-------------|-----------------|
| T-cfx-01 | Tampering | `CLAUDE.md` spawn-safety bullet | medium | mitigate | C1 replaces the false "set is empty" claim with the real member `broker-launch.mts` and keeps the argv-array imperative, so a reader cannot conclude the safety rule has no subject. |
| T-cfx-02 | Information disclosure | none | low | accept | The change is documentation-only and adds no secret, credential or host path beyond paths already public in the repo. |
| T-cfx-03 | Tampering | scope creep into source files | medium | mitigate | Both verify scripts assert `git diff --name-only HEAD` is empty for every source path the corrections cite (`build.ts`, `host-tool.mts`, `broker-launch.mts`, `vice-proxy.ts`, both `package.json` files, `src/skills`, `docs`, `README.md`) while `CLAUDE.md` itself did change. The check is baseline-independent, so the working tree's pre-existing unrelated dirty files cannot mask or fake it. |
| T-cfx-SC | Tampering | npm/pip/cargo installs | n/a | accept | This plan installs no package and runs no package manager. No legitimacy gate is required. |
</threat_model>

<verification>
Run both task verify scripts in order. Then confirm the whole-file result:

1. `wc -l CLAUDE.md` — expect roughly 215-240 lines, down from 329.
2. `git -C /home/henrik/dev/henrik/git/c64-re-tools diff --stat HEAD~2 -- CLAUDE.md`
   — expect exactly one file changed.
3. `git -C /home/henrik/dev/henrik/git/c64-re-tools log --oneline -2` — expect two
   commits, neither carrying an AI attribution trailer or signature.
</verification>

<success_criteria>
- All six corrections (C1-C6) are applied and mechanically verified.
- Both GSD blocks carry complete, actionable prose and point at their full sources.
- `CLAUDE.md` is the only file changed, across exactly two atomic commits.
- No commit message, and no line added to `CLAUDE.md`, identifies an AI as author.
</success_criteria>

<deferred>
Recorded here so it is not lost, and deliberately OUT OF SCOPE for this plan
(this is a documentation-only task that edits `CLAUDE.md` alone):

- **Stale source comment at `src/mcp/vice/vice-proxy.ts:1588-1589`.** It still
  references a `refresh-manifest.ts` and a `tools-manifest.json` that no longer
  exist in the tree. The corresponding `CLAUDE.md` architecture-table row is
  already CORRECT and must not be "fixed" to match the stale comment — the
  comment is what is wrong. Fixing it means editing a source file, which this
  plan forbids. Route it through its own `/gsd-quick`.
</deferred>

<output>
Create `.planning/quick/260917-cfx-correct-six-factual-errors-in-claude-md-/260917-cfx-SUMMARY.md` when done.
</output>
