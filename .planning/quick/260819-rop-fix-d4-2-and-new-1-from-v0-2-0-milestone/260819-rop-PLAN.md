---
phase: quick-260819-rop
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - .planning/ROADMAP.md
  - .planning/intel/decisions.md
  - README.md
  - CLAUDE.md
  - scripts/generate-tool-support-table.mjs
  - docs/tool-support.md
  - .claude/mcp/vice/manifest-arg-compat.test.ts
autonomous: true
requirements: [AUDIT-D4-2, AUDIT-NEW-1]
worktree: false   # deliverable is largely .planning/ROADMAP.md content — worktree mode
                  # strips .planning/ from commits, so this plan MUST run in-tree

must_haves:
  truths:
    - "ROADMAP.md no longer claims disk detach is deferred to or owned by Phase 7 anywhere"
    - "ROADMAP.md still records that disk detach was cut from v0.2.0 scope, with the original reason and the D-13 / docs/stock-vice-parity.md cross-references intact"
    - "All five live documents describing D-07 state a backward-compatible argument shape, not an identical one"
    - "docs/tool-support.md's new sentence came from regenerating it with its generator, not from a hand edit"
    - "A test fails if a future manifest change removes a shared property, retypes one, or makes one newly required on stock"
    - "That same test does NOT fail merely because stock adds an optional property the fork lacks"
  artifacts:
    - path: ".claude/mcp/vice/manifest-arg-compat.test.ts"
      provides: "Structural backward-compatibility gate over the two shipped manifests"
      contains: "tools-manifest.stock.json"
      min_lines: 80
    - path: "docs/tool-support.md"
      provides: "Regenerated tool support table with corrected D-07 prose"
      contains: "backward-compatible"
    - path: "scripts/generate-tool-support-table.mjs"
      provides: "The single writer of that sentence"
      contains: "backward-compatible"
  key_links:
    - from: "scripts/generate-tool-support-table.mjs"
      to: "docs/tool-support.md"
      via: "node scripts/generate-tool-support-table.mjs"
      pattern: "backward-compatible"
    - from: ".claude/mcp/vice/manifest-arg-compat.test.ts"
      to: ".claude/mcp/vice/tools-manifest.stock.json"
      via: "readFileSync + JSON.parse"
      pattern: "tools-manifest\\.stock\\.json"
---

<objective>
Close two findings from `.planning/v0.2.0-MILESTONE-AUDIT.md`:

- **D4-2 (§8)** — three sites in `.planning/ROADMAP.md` still assert that disk
  detach is *deferred to* or *owned by* Phase 7. Phase 7 **cut** it from scope.
  The same ROADMAP already says so at two other sites, and REQUIREMENTS.md was
  corrected during Phase 8.1; only these were missed.
- **NEW-1 (§4.3)** — the D-07 standing constraint claims a tool advertised on
  both backends keeps *"the same argument shape"*. That is false for 17 of the
  34 shared tools (re-verified below). Every divergence is permissive, so
  nothing is broken — but five live documents assert something untrue, and the
  real invariant (backward compatibility) is untested.

Purpose: the v0.2.0 milestone audit must not close with documents that
contradict the shipped manifests or the phase record they describe.

Output: corrected prose at every live site, a regenerated `docs/tool-support.md`,
and one new colocated node:test file pinning the backward-compatibility
invariant so the corrected claim can never silently rot again.

**Execution note:** this plan runs **in-tree, without worktree isolation**
(`worktree: false` above). Worktree mode strips `.planning/` from commits and
this plan's primary deliverable is `.planning/ROADMAP.md` content. Do not add or
assume any worktree step.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/STATE.md
@CLAUDE.md

Read only the two audit sections being closed, not the whole report:
- `.planning/v0.2.0-MILESTONE-AUDIT.md` §4.3 (NEW-1) and the §8 row for D4-2.

House style for the new test file (read before writing Task 3):
- `.claude/mcp/vice/fork-manifest-surface.test.ts` — the WHY-header pattern, the
  `readManifest()` shape, `node:test` + `node:assert/strict`, the "do not just
  update the number without a decision record" contributor warning.
- `.claude/mcp/vice/tool-support-table.test.mjs` — the synthetic-fixture pattern
  for proving a checker actually rejects the bad case.

**Every line number cited in this plan was re-verified against the live files on
2026-08-19, but line numbers drift. Match on the quoted TEXT, never on the line
number.** If a quoted string is not found where stated, `grep` for it before
concluding the site is already fixed.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Stop ROADMAP.md asserting Phase 7 owns disk detach (D4-2)</name>
  <files>.planning/ROADMAP.md</files>
  <action>
Three sites make a false present-tense claim. Disk detach was **cut from v0.2.0
scope** — no stock binary-monitor detach opcode exists, no skill calls
`vice_disk_detach`, and re-attaching a different image covers the real workflow.
It was not deferred to Phase 7 and Phase 7 does not own it.

Correct these three, matching on text:

1. Phase 3's roadmap bullet (`~:95`), ending
   `"...verified 8/9 + 1 accepted override — disk detach has no stock opcode and is owned by Phase 7)"`.
   Make the parenthetical say the override stands because stock has no detach
   opcode and detach was subsequently cut from scope. Keep the rest of the
   bullet — plan counts, dates, gap-closure record — byte-identical.

2. Phase 3 success criterion 4's parenthetical (`~:203`), ending
   `"Deferred to Phase 7 — see D-13 in `03-CONTEXT.md` and `docs/stock-vice-parity.md`."`.
   Replace only the "Deferred to Phase 7" clause with the fact that detach was
   later cut from v0.2.0 scope entirely. **Keep the D-13 and
   `docs/stock-vice-parity.md` cross-references** — both are still true and both
   are what a reader follows to the reasoning. Keep the preceding sentence
   ("stock VICE's binary monitor exposes no detach opcode...") untouched: that
   is an accurate record of what Phase 3 decided at the time, and this task does
   not rewrite history, it only stops asserting a false present-tense ownership.

3. The regenerator2000 overlap narrative (`~:684-685`),
   `"Phase 7 owns disk detach (the deferred half of `DIRECT-06`) and wedge triage on stock."`
   This sits mid-paragraph, so reword rather than delete — the sentence must
   still carry Phase 7's real remaining ownership (wedge triage on stock) and the
   paragraph must still read as prose. Note detach as cut, or drop it from the
   ownership list and say so; your call, but the paragraph must not end up
   claiming detach is outstanding work.

Do NOT touch:
- `~:450` (`"**Dropped from this phase:** `vice_disk_detach`..."`) and `~:599`
  (the *Cut from scope* table row) — these are the already-correct sites this
  task aligns the others to.
- `~:500` — Phase 8.1's criterion text *"`DIRECT-06`'s traceability row stops
  attributing detach to Phase 7"*. That is a description of a fix, not a false
  claim; leave it exactly as-is.
- `.planning/REQUIREMENTS.md` (already correct) and
  `.planning/v0.2.0-MILESTONE-AUDIT.md` (an archived report — never rewrite it).

Before finishing, run `grep -n "detach" .planning/ROADMAP.md` and read every hit;
if a further site makes the same false claim, fix it the same way.
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools &amp;&amp; \
test "$(tr '\n' ' ' &lt; .planning/ROADMAP.md | tr -s ' ' | grep -ocE 'owned by Phase 7|Deferred to Phase 7|Phase 7 owns disk detach' | awk '{s+=$1} END {print s+0}')" -eq 0 &amp;&amp; \
grep -q 'Dropped from this phase:' .planning/ROADMAP.md &amp;&amp; \
grep -q '| Disk detach | remainder of `DIRECT-06`' .planning/ROADMAP.md &amp;&amp; \
grep -q 'D-13 in `03-CONTEXT.md`' .planning/ROADMAP.md &amp;&amp; \
grep -q "stops attributing detach to Phase 7" .planning/ROADMAP.md &amp;&amp; \
echo D4-2-OK
    </automated>
  </verify>
  <done>`grep -cE 'owned by Phase 7|Deferred to Phase 7|Phase 7 owns disk detach' .planning/ROADMAP.md` is 0; the two already-correct cut-from-scope sites, the D-13 cross-reference, and Phase 8.1's criterion text are all still present; every remaining `detach` hit in ROADMAP.md is factually true.</done>
</task>

<task type="auto">
  <name>Task 2: Correct the D-07 "same argument shape" claim at all five live sites (NEW-1 part A)</name>
  <files>.planning/ROADMAP.md, .planning/intel/decisions.md, README.md, CLAUDE.md, scripts/generate-tool-support-table.mjs, docs/tool-support.md</files>
  <action>
The true invariant, re-verified programmatically against the two shipped
manifests on 2026-08-19 (34 shared tools; 17 have a differing `inputSchema`;
zero removed properties; zero newly-required properties; exactly one type
divergence, and it is a widening):

> the same name and a **backward-compatible** argument shape — stock may add
> optional, clearly-labelled parameters, but never removes one, never retypes
> one, and never makes one newly required, so a call shaped for the fork
> manifest stays valid on stock.

You own the exact phrasing. Say the same true thing at every site, adapted to
each site's register, and leave each site's surrounding sentences untouched.

The five live sites (the scouting found four; the fifth was found by a
repo-wide grep and is a live D-07 mirror, not an archived artifact):

1. `.planning/ROADMAP.md` `~:61-62` — the D-07 standing-constraint bullet,
   `"the **same name and the same argument shape** on both"`. Terse constraint
   register.
2. `scripts/generate-tool-support-table.mjs` `~:205` — the string literal
   `"on both backends keeps the same name and argument shape on either one. Calling a tool the "`.
   Prose register. Note the sentence is assembled from concatenated literals;
   keep the concatenation readable.
3. `docs/tool-support.md` `:5` — **GENERATED FILE, DO NOT EDIT BY HAND** (its own
   header says so, and `tool-support-table.test.mjs` is a byte-identity drift
   guard). Fix site 2, then regenerate with
   `node scripts/generate-tool-support-table.mjs` from the repo root, and commit
   both files. Hand-editing the `.md` is a defect. The regenerated diff should be
   exactly the one prose line — the doc is currently in sync, so anything wider
   means something else drifted and you should stop and report it.
4. `README.md` `~:139` — `"advertised on both keeps the same name and argument shape on either one."`
   This sentence is hard-wrapped across lines; match on text, re-wrap to the
   surrounding paragraph's width. Prose register.
5. `CLAUDE.md` `~:25` — the **Compatibility** constraint bullet,
   `"A tool advertised on both keeps the same name and argument shape, and the fork's list is unchanged from v0.1.x."`
   Terse constraint register. Keep the rest of the bullet (the SKILL-01
   consequence) untouched.
6. `.planning/intel/decisions.md` `~:38-39` — `DEC-preserve-mcp-surface`'s
   "decision (superseded part)", which mirrors D-07 verbatim:
   `"A tool advertised on both keeps the same name and argument shape, and the fork's list is unchanged from v0.1.x."`
   Correct the mirror so it does not contradict the five sites above. Do **not**
   touch the `~~struck-through~~` superseded text above it or the "still
   standing" bullet below it.

Do NOT touch any file under `.planning/phases/**` — those are archived phase
artifacts recording what was believed at the time, and the audit report itself is
likewise archived.
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools &amp;&amp; \
for f in .planning/ROADMAP.md README.md CLAUDE.md docs/tool-support.md scripts/generate-tool-support-table.mjs .planning/intel/decisions.md; do tr '\n' ' ' &lt; "$f" | tr -s ' ' | grep -qE 'same name and (the same )?argument shape' &amp;&amp; { echo "STALE claim still present: $f"; exit 1; }; done; \
for f in .planning/ROADMAP.md README.md CLAUDE.md docs/tool-support.md scripts/generate-tool-support-table.mjs .planning/intel/decisions.md; do grep -qi 'backward-compatible' "$f" || { echo "MISSING new wording: $f"; exit 1; }; done &amp;&amp; \
test "$(git diff --numstat -- docs/tool-support.md | awk '{print $1"/"$2}')" = "1/1" &amp;&amp; \
(cd .claude/mcp/vice &amp;&amp; node --test tool-support-table.test.mjs) &amp;&amp; \
echo NEW-1-A-OK
    </automated>
  </verify>
  <done>Zero occurrences of the old claim remain in the six live files; each carries the corrected wording; `docs/tool-support.md`'s working-tree diff is exactly one line changed (proving it was regenerated from the generator, not hand-edited or drifted); the byte-identity drift guard passes.</done>
</task>

<task type="auto">
  <name>Task 3: Pin the backward-compatibility invariant with a structural test (NEW-1 part B)</name>
  <files>.claude/mcp/vice/manifest-arg-compat.test.ts</files>
  <action>
Create a new colocated `node:test` file, `.claude/mcp/vice/manifest-arg-compat.test.ts`,
that reads `tools-manifest.json` (fork) and `tools-manifest.stock.json` (stock)
from `HERE`, computes the shared-name set, and asserts **backward compatibility**
— not schema equality.

Structure it around one pure checker function (e.g.
`checkBackwardCompatible(forkSchema, stockSchema, toolName)` returning a list of
violation strings) so the same function can be run over the real manifests AND
over synthetic fixtures. That fixture pattern is house style — see
`tool-support-table.test.mjs`.

Assertions over the real manifests:
- **Nothing removed:** every key in the fork's `inputSchema.properties` also
  exists in stock's `inputSchema.properties`.
- **Nothing retyped:** for each shared property, stock's `type` equals the fork's
  `type`, with exactly one allowed exception — a stock property that **omits**
  `type` where the fork declares one is a *widening* and is permitted, but only
  via an explicit, commented allow-list entry naming the tool, the property, and
  the reason. Today that allow-list has exactly one member:
  `vice_checkpoint_set_condition.condition`, whose stock schema deliberately
  omits `type` because it accepts either a condition string or a structured
  condition object and the checker's supported subset has no union keyword
  (no `oneOf`/`anyOf`) to express that — the reason is stated inline in the
  stock manifest itself. A stock property declaring a *different* type is a
  regression and must fail.
- **Nothing newly required:** stock's `required` array is a subset of the fork's
  `required` array for every shared tool.
- **Stock-only additions are permitted** — do not assert anything about
  properties present on stock and absent on the fork. That permissiveness is the
  whole point of the invariant.

Also assert a sanity precondition (the shared set is non-empty and the allow-list
member is actually still shared), so the file cannot silently pass by finding
nothing to check.

Negative controls, using synthetic in-file fixtures rather than mutating the real
manifests: prove `checkBackwardCompatible()` reports a violation for (a) a
property the fork declares and stock drops, (b) a property retyped
`string` → `number`, and (c) a property newly required on stock. Also prove the
widening case (stock omits `type`) is reported when NOT allow-listed.

House style, mandatory:
- A long WHY header comment before the imports, in the register of
  `fork-manifest-surface.test.ts`: what invariant this file exists to protect;
  the past mistake (audit finding NEW-1 — five live documents asserted that a
  tool advertised on both backends keeps an *identical* argument shape, when 17
  of the 34 shared tools already had divergent `inputSchema` and nothing tested
  the claim either way); and **what a contributor must NOT do when it goes red**
  — do not just add an allow-list entry to make it green; a new entry needs a
  stated reason in the same shape as the existing one, and a removed/retyped/
  newly-required property is a real regression that breaks fork-shaped calls on
  stock, not a test to be relaxed.
- `node:test` + `node:assert/strict`, ESM, no new dependencies.
- 2-space indent, double quotes, semicolons, `const HERE = dirname(fileURLToPath(import.meta.url))`.
- Explicit real extensions on any relative import.
- Every assertion message names the offending tool and property.

No edit to `test-gate.mjs` is needed or wanted: `automatedTestFiles()` globs
`*.test.*` and subtracts `MANUAL_ONLY_TESTS`, so a new file joins the automated
set on its own. Adding it to `MANUAL_ONLY_TESTS` would be wrong — this test needs
no emulator, no broker, and no host setup.
  </action>
  <verify>
    <automated>
cd /home/henrik/dev/henrik/git/c64-re-tools/.claude/mcp/vice &amp;&amp; \
node --test manifest-arg-compat.test.ts &amp;&amp; \
npx tsc --noEmit -p tsconfig.json &amp;&amp; \
node test-gate.mjs &amp;&amp; \
echo NEW-1-B-OK
    </automated>
  </verify>
  <done>`manifest-arg-compat.test.ts` passes standalone with its negative controls green; `tsc --noEmit` is clean; the full automated gate (`node test-gate.mjs`, which includes `test-gate.test.ts`'s drift guard confirming the new file landed in exactly one of the automated/manual sets) passes.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| repo docs → LLM skill author | Corrected prose is what a future skill/plan author trusts about cross-backend call compatibility |
| shipped manifests → MCP client | `inputSchema` divergence decides whether a fork-shaped `tools/call` is valid on stock |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-quick-01 | Tampering | `docs/tool-support.md` | mitigate | Generated file; Task 2 edits the generator and regenerates. `tool-support-table.test.mjs`'s byte-identity drift guard is run in Task 2's verify, so a hand edit fails the gate. |
| T-quick-02 | Information disclosure | corrected D-07 prose | mitigate | Wording states only what is programmatically verified against the two committed manifests; no capability claim is widened. |
| T-quick-03 | Repudiation | future manifest edit silently narrowing a stock schema | mitigate | Task 3's `manifest-arg-compat.test.ts` fails on any removed, retyped, or newly-required shared property; the allow-list requires a stated reason. |
| T-quick-SC | Tampering | npm/pip/cargo installs | mitigate | N/A — this plan installs no packages. `node:test`/`node:assert/strict` only, zero new dependencies. |
</threat_model>

<verification>
Run from the repo root after all three tasks:

1. `test "$(grep -cE 'owned by Phase 7|Deferred to Phase 7|Phase 7 owns disk detach' .planning/ROADMAP.md)" -eq 0`
2. Whitespace-normalized staleness sweep returns nothing (the claim is hard-wrapped across lines in `.planning/intel/decisions.md`, so a plain per-line `grep` misses it — normalize first):
   `for f in .planning/ROADMAP.md README.md CLAUDE.md docs/tool-support.md scripts/generate-tool-support-table.mjs .planning/intel/decisions.md; do tr '\n' ' ' < "$f" | tr -s ' ' | grep -qE 'same name and (the same )?argument shape' && echo "STALE: $f"; done`
3. `git status --porcelain docs/tool-support.md scripts/generate-tool-support-table.mjs` shows both modified (generator + regenerated output committed together).
4. `cd .claude/mcp/vice && node test-gate.mjs` — full automated gate green, including the new test file and the `tool-support-table.test.mjs` drift guard.
5. `cd .claude/mcp/vice && npx tsc --noEmit -p tsconfig.json` — clean.
6. `git diff --stat` touches only the seven files in `files_modified`; nothing under `.planning/phases/**` and nothing in `.planning/REQUIREMENTS.md` or `.planning/v0.2.0-MILESTONE-AUDIT.md`.
</verification>

<success_criteria>
- Audit finding D4-2 is closed: no live planning document asserts Phase 7 owns or is deferred disk detach, while the cut-from-scope record and its reasoning survive intact.
- Audit finding NEW-1 is closed on both halves: six live documents state the backward-compatible invariant, `docs/tool-support.md` was regenerated from its generator, and a structural test now fails if the invariant is ever actually broken while staying green on permissive stock-only additions.
- The full automated test gate and typecheck pass.
</success_criteria>

<output>
Create `.planning/quick/260819-rop-fix-d4-2-and-new-1-from-v0-2-0-milestone/260819-rop-SUMMARY.md` when done.
</output>
