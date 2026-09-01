# Phase 15: Debt and Review Disposition - Research

**Researched:** 2026-08-22
**Domain:** Planning-artifact disposition (code-review findings, pending todos, undocumented behaviours, stale UAT scenarios) — not a build phase
**Confidence:** HIGH for the inventories (everything below is grep/read-verified against the live tree this session); MEDIUM for "which findings are still genuinely open" (a subset was spot-checked against current source, the rest carry the same caveat the phase's own prior todos already state — verify before fixing, do not assume)

## Summary

Phase 15 has no `CONTEXT.md` — nobody ran `/gsd-discuss-phase` for it — so this
research derives scope entirely from `ROADMAP.md`'s Phase 15 section and
`REQUIREMENTS.md`'s GATE-02/DEBT-01/DEBT-02/DEBT-03. There is very little to
*decide* here and a great deal to *enumerate and execute*: this is the
milestone's bulk workload, and the bulk is mechanical — closing named,
already-diagnosed findings and todos, not designing anything new.

The single most important discovery this research made, not named anywhere in
`ROADMAP.md` or `REQUIREMENTS.md`: **`docs-review-disposition.test.ts` — the
guard GATE-02's own success criterion depends on — has a parser blind spot.**
Its heading regex (`^### (WR|IN|CR)-(\d+):`) only matches level-3 headings
ending in a colon. Two real phases violate that shape and are therefore
**invisible to the guard, not merely undispositioned by it**: Phase 03's
`03-REVIEW.md` uses level-**4** (`####`) finding headings throughout (all 14
of its findings are unscanned), and Phase 14's `14-REVIEW.md` uses a
level-3-but-no-colon heading style (`### IN-01 (Info) — ...`) for its one
finding. Verified live in this session by running the guard's own logic with
a widened regex: **150 findings exist across all `*-REVIEW.md` files (not the
currently-reported ~121-ish scanned set), and with the wider regex 9 of them
are newly-surfaced as undispositioned** — 8 in `03-REVIEW.md` (`WR-06`,
`WR-07`, `WR-08`, `IN-02`..`IN-06`) and 1 in `14-REVIEW.md` (`IN-01`, which the
review's own text says was fixed in-phase but which no recognised disposition
source — `SUMMARY`/`VERIFICATION`/`REVIEW-FIX`/todo/milestone-audit — actually
names). `docs-review-disposition.test.ts` is green today (`4/4` tests pass)
**for the wrong reason**: it is blind to a third of a phase's findings and all
of another's, not because everything is truly dispositioned. Fixing this
guard is the highest-leverage single task in this phase — it is a smaller,
literal repeat of the exact defect `docs-review-disposition.test.ts` itself
was built to catch (AUDIT-01, "no disposition anywhere," one layer deeper:
"no discovery at all").

Past that, the phase decomposes into four mechanical work streams, detailed
below: (1) GATE-02 — disposition every open finding across all phases,
including the 9 newly-discovered ones; (2) DEBT-01 — disposition every
pending todo not already claimed by Phase 16 (18 of the 20 pending todos are
this phase's; 2 are Phase 16's); (3) DEBT-02 — document five specific
undocumented behaviours at the place a user would actually look; (4) DEBT-03
— actually run Phase 03's three pending UAT scenarios live (a real stock VICE
and display are both available in this environment; nothing blocks this).
**Notable cross-reference the planner should exploit**: DEBT-03's UAT
scenario 3 ("hot non-stopping checkpoint auto-disables under sustained hit
pressure") and the A4 remnant of `2026-08-14-probe-phase3-assumed-wire-details.md`
are the *same live test* — one task can close both.

**Primary recommendation:** Sequence the guard fix first (it changes what
"every open finding" even means for the rest of the phase), then work GATE-02
and DEBT-01 together since most of their items overlap 1:1 (a pending todo
naming review-finding IDs *is* the disposition mechanism this repo already
uses), then DEBT-02 (pure documentation, no dependencies), then DEBT-03 (live
emulator work, independent of the others, can run in parallel).

## Architectural Responsibility Map

This phase touches no runtime architecture — it is entirely in the
planning-artifact and documentation tiers, plus a handful of small,
independent source-level fixes. The conventional Browser/API/Database tier
table does not apply; the analogous breakdown for this phase is:

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Review-finding disposition (GATE-02) | Guard/test-instrument (`docs-review-disposition.test.ts`) | Planning docs (`todos/`, `*-VERIFICATION.md`) | The guard defines what counts as "dispositioned"; fixing its parser is a source-code change, everything else is planning-doc/todo editing |
| Todo disposition (DEBT-01) | Planning docs (`.planning/todos/`) | Source (for the ones that are genuine code fixes) | Repo convention: move pending -> completed with a `## Resolution` section, or fix source and cite the commit |
| Undocumented-behaviour closure (DEBT-02) | User-facing docs (`README.md`, `SKILL.md` files) | Research doc (`GAINS-PROTOCOL.md`) | Users read skills and README, not `.planning/` |
| UAT execution (DEBT-03) | Live emulator (stock `x64sc` via broker) | Skill scripts (`c64-ram-capture`) | Requires a real running VICE process; this environment has one |
| Individual real code fixes (`stock-connect.ts` IN-05, `stock-dispatch.ts` WR-13, GAINS-PROTOCOL.md/tools-manifest caveat) | Source (`.claude/mcp/vice/*.ts`) | — | Small, isolated, no architectural ripple |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| GATE-02 | Every open code-review finding across all phases is dispositioned, including Phase 08's `WR-04`..`WR-12`, Phase 09's `IN-01`..`IN-03`, `WR-13`'s second hardcoded capability-refusal string, and `02-REVIEW.md`'s `IN-05` — and `docs-review-disposition.test.ts` runs green from a clean checkout | § "GATE-02 — the full open-finding inventory" below: every finding, its current verified-or-not status, and the guard's own parser gap |
| DEBT-01 | Every item in `.planning/todos/pending/` is fixed, dispositioned `wont-fix` with recorded rationale, or explicitly promoted with a named owner — none carried silently into v0.5.0 | § "DEBT-01 — the pending-todo inventory" below: all 20 pending todos, which 2 Phase 16 already claims, and a recommended disposition for each of the 18 remaining |
| DEBT-02 | The undocumented-behaviour todos are closed by documenting the behaviour where a user would actually look for it | § "DEBT-02 — the five undocumented behaviours" below: exact current doc-silence confirmed by grep, and the exact section to add to in each target file |
| DEBT-03 | Phase 03's three pending UAT scenarios are executed against real fixtures and a running program, recorded pass or fail with evidence | § "DEBT-03 — Phase 03's three pending UAT scenarios" below: what each needs, fixture inventory, and the A4 cross-reference |

## GATE-02 — the full open-finding inventory

### The guard itself

`docs-review-disposition.test.ts` (`.claude/mcp/vice/docs-review-disposition.test.ts`)
already exists — it was built in Phase 11.1 (plan 11.1-07) to fix exactly this
class of silence for AUDIT-01. It runs green today: `node --test
docs-review-disposition.test.ts` → `4/4 pass` [VERIFIED: ran live this
session]. It scans every `<num>-REVIEW.md` under `.planning/phases/*/` for
headings matching `^### (WR|IN|CR)-(\d+):` (`docs-review-disposition.test.ts:91`),
and considers a finding "dispositioned" if its id appears, word-bounded,
anywhere in one of five recognised sources for that phase: the phase's own
`*-SUMMARY.md`/`*-VERIFICATION.md`/`*-REVIEW-FIX.md`, a pending-or-completed
todo identifiably about that phase, or a top-level `v*-MILESTONE-AUDIT.md`'s
phase-scoped `tech_debt:` block (`docs-review-disposition.test.ts:22-51`).
This "mentioned anywhere" bar is deliberately weak by design (the guard's own
header says so, line 16-21) — it exists to catch total silence, not to grade
disposition quality. **GATE-02's actual bar is higher than the guard's**: the
ROADMAP text says findings must carry "a cited disposition," which this repo's
convention (see § "Disposition mechanics" below) treats as fix-with-commit,
wont-fix-with-rationale, or promote-with-owner — not merely "mentioned."

**Parser gap, verified live this session** — run from `.claude/mcp/vice`:

```js
// improved regex, run as a scratch script against the real tree
const re = /^#{3,4} (WR|IN|CR)-(\d+)[:\s]/gm;
```

against every `*-REVIEW.md`: **150 findings total** (vs. whatever count the
current `^### ...:` -only regex sees — the guard's own positive-control test
only asserts a floor of `>= 100`, so it never noticed the undercounting).
Re-running the guard's full disposition logic with this widened regex
produces **9 undispositioned findings that the shipped guard currently cannot
even see**:

| Phase | Review file | Ids invisible to today's parser | Why invisible |
|---|---|---|---|
| 03-direct-tools | `03-REVIEW.md` | `WR-06`, `WR-07`, `WR-08`, `IN-02`, `IN-03`, `IN-04`, `IN-05`, `IN-06` | Entire file uses `####` (level 4) finding headings, not `###` (level 3) — `WR-01`..`WR-05` and `IN-01` of this same file ARE separately mentioned elsewhere (see below), so only these 8 are actually undispositioned once visible |
| 14-backend-decision | `14-REVIEW.md` | `IN-01` | Heading is `### IN-01 (Info) — ...`, not `### IN-01:` — no colon immediately after the id |

**Fix shape** (do this first, before dispositioning anything, since it changes
the ground truth the rest of the phase works against):

```js
// docs-review-disposition.test.ts's parseFindingIds() -- widen to accept
// level-3 OR level-4 headings, and either a colon or a space/paren after the
// id (Phase 14's "### IN-01 (Info) -- ..." style).
const re = /^#{3,4} (WR|IN|CR)-(\d+)[:\s]/gm;
```
Re-verify the positive-control floor still holds (it will — 150 > 100) and
add a **new** positive-control assertion pinning discovery of `03-REVIEW.md
WR-06` and `14-REVIEW.md IN-01` specifically, so this exact regression class
cannot silently regress again. `[VERIFIED: ran a widened-regex replica of the
guard's own logic against the live tree this session — see file paths and
counts above]`

### Named-in-ROADMAP findings (the ones GATE-02's own text calls out)

**Phase 08 — `08-REVIEW.md` `WR-04`..`WR-12` (9 findings).** Already tracked
by the pending todo `.planning/todos/pending/2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md`.
That todo spot-checked 3 of the 9 against source and found them still open;
this session independently re-verified all 9 against current source:

| Id | What it is | Verified status this session | Fix (already written in `08-REVIEW.md`) |
|---|---|---|---|
| WR-04 | `generate-tool-support-table.mjs`'s markdown-cell emission has no `\|`/newline escaping | **STILL OPEN** [VERIFIED: `scripts/generate-tool-support-table.mjs:241` still does `` `\| ${row.name} \| ${forkCell} \| ${stockCell} \| ${row.note} \|` `` with no `cell()` helper] | Add a `cell()` escaping helper at the one emission point; `08-REVIEW.md:330-360` has the exact diff |
| WR-05 | `capability-registry.test.ts` hardcoded the synthetic-tool set as `new Set(["vice_diagnose","vice_recycle"])`, missing `vice_result_continue` | **ALREADY FIXED / SUPERSEDED** [VERIFIED: `.claude/mcp/vice/capability-registry.test.ts:163-185` now derives `SYNTHETIC` dynamically from `vice-proxy.ts` via regex discovery, with a `>= 3` non-vacuity assertion and a throw on an unresolved identifier — matches the review's own suggested fix in shape] | None needed — cite as fixed, find the commit |
| WR-06 | `check-skill-tool-coverage.mjs`'s registry-echo assertions are tautologies | **NOT re-verified this session** — treat as open per the todo's own caveat | `08-REVIEW.md:399-431` |
| WR-07 | D-E consolidation silently doubled the coverage script's core-check allowlist | **NOT re-verified this session** | `08-REVIEW.md:432-463` |
| WR-08 | `discoverSyntheticToolNames()`'s declaration regex is unbounded and can silently resolve to the wrong tool name | **PARTIALLY ADDRESSED, re-verify** [VERIFIED: `capability-registry.test.ts`'s copy of this discovery logic (line ~168) still uses the same unbounded `[\s\S]*?name:\s*"([^"]+)"` lazy pattern the review flagged — WR-05's fix solved the *missing-third-tool* symptom but not this underlying unbounded-regex risk] | `08-REVIEW.md:464-508` has the bounded-search fix |
| WR-09 | Stale-forward-reference lint depends on line-wrap luck | **NOT re-verified this session** | `08-REVIEW.md:508-543` |
| WR-10 | Fork-honesty annotation rule is section-wide, matches bare `fork backend`/`VICE_BACKEND` | **NOT re-verified this session** | `08-REVIEW.md:544-582` |
| WR-11 | Unannotated-section reports point every name at the first mention's line number | **NOT re-verified this session** | `08-REVIEW.md:583-602` |
| WR-12 | `walkSkills()`/`MCP_PREFIX_RE`/`TOOL_NAME_RE` duplicated verbatim across `check-skill-fork-honesty.mjs` and `check-skill-tool-coverage.mjs` | **STILL OPEN** [VERIFIED: `scripts/check-skill-fork-honesty.mjs:73` comment literally says "Copied from scripts/check-skill-tool-coverage.mjs's walkSkills()"; `scripts/lib/` contains only `anno-cli-verbs.mjs` and `skill-honesty-checks.mjs` (a *different* shared module, for violation predicates, not the walk/regex duplication) — no `skill-corpus.mjs` or equivalent exists] | `08-REVIEW.md:603-622` names the extraction target `scripts/lib/skill-corpus.mjs` |

**Also named in ROADMAP: `WR-13` (`08-REVIEW.md`) — the dead second
capability-refusal string.** [VERIFIED: `.claude/mcp/vice/stock-dispatch.ts:735-738`
(`dispatchStock()`'s miss branch) is byte-identical to the review's quoted
issue text today — still hardcodes `"the fork backend provides this tool"`
(false for the 2 stock-only-gain tool names) and the forbidden "wait for a
later phase" framing]. This finding already has a *prose* disposition —
`08-VERIFICATION.md:121` says "Reviewed and deliberately left unfixed by
explicit user decision" — but that VERIFICATION.md predates this milestone
and the ROADMAP explicitly says GATE-02 must disposition it in *this* phase.
Since it's confirmed unreachable dead code (every one of the 38 stock-manifest
tools has a real `stockHandlerFor()` entry), the two live options are: (a)
apply the review's own written fix (route the miss through
`capabilityRefusalMessage()`, `08-REVIEW.md:623-658` has the diff), or (b)
formally record `wont-fix` with the existing rationale in a source the guard
actually reads (a completed todo, since none exists for `WR-13` specifically
today — it is currently only *mentioned*, inside the `WR-04..WR-12` todo's
own prose, not independently dispositioned).

**Phase 09 — `09-REVIEW.md` `IN-01`..`IN-03` (3 findings).** Tracked by
`.planning/todos/pending/2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md`,
which already contains a fully-reasoned recommendation: **`wont-fix` all
three, citing evidence immutability** — the findings are in
`.planning/phases/09-the-assumption-probe-go-no-go/evidence/*.mjs`, throwaway
harnesses whose committed transcripts (the phase's actual deliverable, backing
the `degrade`/`R4` go/no-go verdict) were produced *by these exact files*;
editing them after the fact breaks the correspondence between the harness in
the tree and the evidence it produced. This phase's job is to execute that
recommendation: mark `IN-01`/`IN-02`/`IN-03` `wont-fix` in `09-REVIEW.md`
(or an addendum the guard can see — see § Disposition mechanics) and move the
todo to `completed/` with a `## Resolution` section.

**02-REVIEW.md's `IN-05`.** [VERIFIED: `.claude/mcp/vice/stock-connect.ts:537`
today still reads `` `stockConnect: reconnect to target ${session.targetId} could
not prove machine identity...` `` inside `stockReconnect()` (the function
starts at line 529) — the exact one-word defect the review names]. This is
the cheapest fix in the whole phase: change `stockConnect:` to `stockReconnect:`
on that one line. No test currently asserts the old string
[VERIFIED: `grep -rn "stockConnect: reconnect to target" .claude/mcp/vice/*.test.ts`
returns nothing], so nothing else needs updating. This finding is currently
only mentioned in prose (`STATE.md`'s "Also carried, not blocking" section,
which is **not** one of the guard's five recognised sources) — filing/closing
a todo or citing it in a fresh completed-todo `## Resolution` is what actually
satisfies the guard.

**Phase 14's `IN-01` (newly surfaced by the parser-gap fix above).**
[VERIFIED: `.claude/mcp/vice/fork-live.test.ts:80-91` already contains the
corrected skip-reason sentence — "an empty value counts as unset... a
set-but-wrong path is reported by the next branch, not defaulted away" — the
review's own `## Disposition` section (`14-REVIEW.md`, final lines) says
"fixed in this phase rather than deferred"]. The code fix is real and already
landed; the only remaining work is a citation the guard can see (a completed
todo, or an addendum to `14-VERIFICATION.md` naming `IN-01`) — currently
nothing does, because `14-REVIEW.md` prose isn't a recognised source and the
finding was invisible to the parser regardless.

**Phase 13 — `13-REVIEW.md` `WR-01`, `WR-02`, `IN-01`, `IN-02` (4 findings).**
Tracked by `.planning/todos/pending/2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md`,
which already contains fully-reasoned per-finding recommendations:
- `WR-01` (shell-interpolated `checkCommandAvailable()` in `probe-binmon.mjs:1486-1489`) — **fix at source**, two-line diff already written in the todo.
- `WR-02` (`probe-binmon.mjs` grown to ~2430 lines / six concerns) — **defer with intent** (same evidence-immutability argument as Phase 09's `IN-01..03`; split when a sixth mode is actually added).
- `IN-01` (A3 polarity check's short-circuit blind spot) — **fix only if A3 is re-probed**; A3 is `INCONCLUSIVE` today, so likely `wont-fix` for now.
- `IN-02` (evidence `.txt` transcripts omitted from the review's own `files:` scope) — **fix in the workflow** (`code-review.md`'s file-list derivation), not in this phase's source tree; likely `wont-fix`/promote as a GSD-tooling improvement, out of this repo's own scope.

**Newly-surfaced Phase 03 findings (8, from the parser-gap fix above).**
Full text for each is already written in `03-REVIEW.md`:

| Id | Location cited by the review | One-line issue | Verified status this session |
|---|---|---|---|
| WR-06 | `.claude/mcp/vice/stock-live.test.ts:74-85` | Skip message claims a default (`/usr/bin/x64sc`) applies when set to a truthy non-path value; it never does | **STILL OPEN** [VERIFIED: line 82-83 today still reads "Defaults to `${VICE_LIVE_STOCK_BIN_DEFAULT}` when set to a truthy non-path value"] |
| WR-07 | `.claude/mcp/vice/vice-proxy.test.ts:3856-3875` | Widened `vice-proxy:` identity detector exempts thrown-error paths; `text:` marker matches mid-word inside `context:` | Not re-verified this session |
| WR-08 | `README.md:67-68`, Environment table `47-52` | README said "three" manual-only files (now four) and omitted `VICE_LIVE_STOCK_BIN` from the Environment table | **LIKELY SUPERSEDED/MOOT** [VERIFIED: current `README.md` has no "manual-only"/"test:automated"/"Environment table" text at all anymore — the whole Development section was simplified to a 5-line `npm ci && npm run typecheck && npm test` block; the specific wrong-count claim WR-08 named no longer exists to be wrong] — recommend disposing as superseded, not as a fix |
| IN-02 | `.claude/mcp/vice/stock-registers.ts:99-129` | `registerCatalogFor()` claims "fetched exactly once and cached" but has no in-flight dedupe | Not re-verified this session |
| IN-03 | `.claude/mcp/vice/vice-proxy.test.ts:140,146-152` | Dead `NetServer` union member in a leak-tracking `Set`, related to WR-02 (same file) | Not re-verified this session |
| IN-04 | `.claude/mcp/vice/stock-registers.test.ts:50-52` | Stale source-line-number citation in a test comment | Not re-verified this session (line drift is likely, given multiple intervening edits) |
| IN-05 | `.claude/mcp/vice/stock-live.test.ts:1` | Non-executable test file carries a `#!/usr/bin/env node` shebang | **STILL OPEN** [VERIFIED: `head -1 stock-live.test.ts` → `#!/usr/bin/env node`] |
| IN-06 | `.claude/mcp/vice/stock-live.test.ts:373-377` | `new RegExp(statusEntry.name)` can be a single character (`"P"`), weakly anchored | Not re-verified this session |

`03-REVIEW.md`'s `WR-01`..`WR-05` and `IN-01` are **already** dispositioned
(the guard finds them once the regex is fixed too) — `WR-01`/`WR-02`/`WR-03`
were fixed per `03-REVIEW-FIX.md:17`'s "Fix scope: critical_warning (CR-01,
CR-02, WR-01, WR-02, WR-03; IN-01 out of scope)" (which also explicitly
dispositions `IN-01` as out-of-scope), and `WR-04`/`WR-05` are named as
"Warning, latent only" in `03-VERIFICATION.md:195-196`. Only the 8 rows above
are genuinely new work.

### Disposition mechanics — the established convention

This repo has a consistent, load-bearing shape for closing a finding/todo,
demonstrated repeatedly (e.g. `.planning/todos/completed/2026-08-20-fully-remove-the-forked-vice-mcp-backend.md`,
`.planning/todos/completed/2026-08-21-anno-cli-wr-08-option-values-silently-swallowed.md`):
move the todo file from `pending/` to `completed/` (a `git mv`) and append a
`## Resolution` section naming the date, the phase/plan that closed it, the
actual decision, and citing evidence (a commit, a SUMMARY, a test run). For a
finding with **no existing todo** (Phase 03's 8 newly-surfaced ones, Phase
14's `IN-01`, `WR-13`), the same shape applies: either fix the source and cite
the commit in a `*-VERIFICATION.md` addendum or a fresh completed todo, or
file a todo and close it in the same breath with a `## Resolution` recording
`wont-fix`+rationale. **Do not invent a new disposition format** — the guard
only recognises the five sources named in its own header (SUMMARY,
VERIFICATION, REVIEW-FIX, todo, milestone-audit `tech_debt:`); a note added
only to `REVIEW.md` itself, or only to `STATE.md` prose, satisfies a human
reader but not the guard.

## DEBT-01 — the pending-todo inventory

20 todos exist in `.planning/todos/pending/` today [VERIFIED: `ls` count this
session]. **2 are explicitly claimed by Phase 16** (`resolves_phase: 16` or
named in `ROADMAP.md`'s Phase 16 section): `2026-08-20-relocate-plugin-payload-under-src-and-merge-mcp-json.md`
(this *is* `PKG-01`) and `2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md`.
**Phase 17 claims none by name** — it only measures the resulting count.
**That leaves 18 todos as this phase's workload**, plus Phase 03's UAT-gap
row (DEBT-03, tracked separately below since it isn't a todo file).

| Todo | Priority | Recommended disposition | Why |
|---|---|---|---|
| `2026-08-12-vice-broker-tests-stall-outside-devcontainer.md` | low | **Close now, `wont-fix`** | Already carries a dated user decision ("Not a bug to fix — these are not automatable") from 2026-08-12; the todo file itself just needs `git mv`ing to `completed/` with a `## Resolution` citing that this was decided, not deferred |
| `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` | — | **Close, `wont-fix`-leaning** — needs one live check first | Its own acceptance check asks "do the 3 manual-only suites hang on a GitHub Actions runner?" Check via `gh run list`/`gh run view` on a recent CI run before deciding; if they've been passing in CI, document why CI's set is deliberately wider (per option 2 in the todo) and close |
| `2026-08-14-probe-phase3-assumed-wire-details.md` (trimmed to A4 only) | high | **Execute the live probe — same test as DEBT-03 scenario 3** | See cross-reference below; do not disposition this separately from DEBT-03's scenario 3, they are the same experiment |
| `2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill.md` | low | **Fix — write the doc note** | DEBT-02 item 1; see below |
| `2026-08-19-keyboard-fallback-load-does-not-progress-within-bounded-poll.md` | medium | **`wont-fix` or defer with rationale** | Explicitly does not block anything (`vice_autostart`'s independent pass already closed DIST-03); not one of DEBT-02's five named behaviours; investigating it is a nice-to-have, not required for this milestone |
| `2026-08-19-project-paths-git-marker-requirement-undocumented.md` | medium | **Fix — write the doc note** | DEBT-02 item 2; see below |
| `2026-08-19-releases-json-schema-undocumented.md` | medium | **Fix — write the doc note** | DEBT-02 item 3; see below |
| `2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool.md` | high | **Fix — document or correct the field** | DEBT-02 item 4; see below |
| `2026-08-20-vsf-as-a-bootstrap-input.md` | — | **Close, `wont-fix`** — REQUIREMENTS.md already pre-decided this | `REQUIREMENTS.md`'s own Out of Scope table says: "Covered by `DEBT-01` as a disposition, not as a build. D-34 stands unless a consumer has `.vsf` captures and cannot re-capture as `.raw`." Move to `completed/` citing that line |
| `2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` | — | **Fix — execute Solution items 1, 2, 3, 4** | DEBT-02 item 5; see below. This is real doc+code work, not a pure disposition |
| `2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md` | — | **Fix or explicitly defer** | Real, scoped, ~small fix (import from `anno-test-gate.ts` instead of 3 hand-copied `probeAnno()` bodies); no phase claims it — either do it here (cheap, self-contained) or promote with a named owner |
| `2026-08-21-phase-08-review-wr-04-through-wr-12-never-dispositioned.md` | — | **Fix/wont-fix each of the 9**, then close | See GATE-02 section above — this todo IS the GATE-02 work item for Phase 08 |
| `2026-08-21-phase-09-review-in-01-in-03-never-dispositioned.md` | low | **Execute its own recommendation (`wont-fix`, evidence immutability), then close** | See GATE-02 section above |
| `2026-08-22-build-atomic-cleanup-test-races-on-shared-tmp.md` | low | **Fix (cheap) or `wont-fix`** | Root cause and fix are both fully diagnosed in the todo (stage the out-dir under a private `mkdtempSync` parent instead of scanning shared `/tmp`); pre-existing flake unrelated to any GSD phase, does not gate `audit-gate.mjs`. Cheap enough to just fix |
| `2026-08-22-cpuhistory-get-sidecars-mislabel-the-fork-as-stock.md` | low | **Fix (cheap)** | Two JSON field edits + one README table row; verification steps are already written in the todo |
| `2026-08-22-phase-13-review-wr-01-wr-02-in-01-in-02-never-dispositioned.md` | low | **Fix/defer each of the 4 per its own already-written recommendation, then close** | See GATE-02 section above |
| `2026-08-22-tools-manifest-stale-missing-vice_snapshot_list.md` | low | **Fix — regenerate the manifest** | `cd .claude/mcp/vice && node refresh-manifest.ts` against a live fork server (`/usr/local/bin/x64sc`, confirmed present this session), then re-run `fork-live.test.ts`. **Caveat**: this may reopen the `fork-manifest-surface.test.ts` count/name gate at 62 (that test asserts a *specific* deliberate 62-tool exception — re-adding `vice_snapshot_list` needs that gate's count updated too, with a decision record, per that file's own header warning) |
| `2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md` | high | **Partial fix now, promote the redesign question** | See detailed note below — this is bigger than a documentation fix |

### Two todos needing more than a doc edit

**`2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md`** (= DEBT-02
item 5) has four concrete Solution items, most already fact-checked by this
research:
1. Correct `GAINS-PROTOCOL.md:1264` — [VERIFIED: current text reads
   `**\`RESOURCE_SET WarpMode 1\` will fail with \`0x8f\`.**`
   (`.planning/research/GAINS-PROTOCOL.md:1264`) — the todo's measured
   correction is: `0x01` for `RESOURCE_GET WarpMode` and for a **string**-typed
   `RESOURCE_SET`, `0x8f` only for an **int**-typed `RESOURCE_SET`].
2. Add the `InitialWarpMode` silent-success-trap note to the resource table
   around `GAINS-PROTOCOL.md:1350-1351` [VERIFIED: current table there already
   has an `InitialWarpMode` row reading "0/1 — only honoured at launch" — the
   silent-success/readback-proves-nothing nuance is not yet in that row].
3. Decide/record the stock warp story (launch-time flag or `Speed`, never a
   runtime `WarpMode` resource) — `GAINS-PROTOCOL.md` and `CLAUDE.md:36`
   already state this correctly; this item is about making sure nothing
   contradicts it, not adding a new fact.
4. **Fix `vice_machine_config_set`'s description** — this is the hard one.
   [VERIFIED: `.claude/mcp/vice/tools-manifest.json:1188` today reads: `"Set
   machine configuration resources (WarpMode, Speed, video standard, SID
   model, CIA model, etc). WarpMode (0/1) disables speed limiting for fast
   execution. ..."`]. **Important constraint the todo does not flag**:
   `tools-manifest.json` is **machine-generated**, not hand-authored —
   `refresh-manifest.ts`'s own header comment says it is "the ONLY writer,"
   and `fork-manifest-surface.test.ts`'s header says "`refresh-manifest.ts`
   ... always writes the tool list *EXACTLY* as the live fork host's
   `tools/list` answers." The description text is the **live fork binary's
   own** compiled tool schema — a foreign C project this repo does not own.
   **Hand-editing `tools-manifest.json` directly is very likely wrong**: the
   next `refresh-manifest.ts` run (an operator command, not CI-gated) would
   silently revert it, and nothing would notice. `docs/tool-support.md` is
   also generated (from `capability-registry.ts`, not from the manifest's
   description text) and does not carry full tool descriptions either — its
   one `vice_machine_config_set` row (`docs/tool-support.md:54`) only says
   "not yet built (descoped)" for the stock side, nothing about the fork
   side's `WarpMode` overclaim. **Open question for the planner**: the
   achievable fix is a caveat note in a project-owned file this repo *does*
   maintain — candidates are `docs/stock-vice-parity.md`'s licensed-divergence
   register (already has a `WarpMode`-adjacent entry structure) or a new
   `capability-registry.ts` note field if one exists for fork-only tools —
   not an edit to the generated manifest JSON itself. Flag this for a human
   decision rather than assuming which file.

**`2026-08-22-vice-disk-attach-approximation-contradicted-by-a5.md`**: A live
probe (Phase 13) proved `vice_disk_attach`'s advertised "attach without
loading or running" contract is false — it performs a full machine reset and
loads a program. The todo's own "What a fix would touch" section names two
tiers: (a) a cheap, purely-corrective fix — update `docs/stock-vice-parity.md`'s
D-14 entry (`docs/stock-vice-parity.md:270`, `:311`) and
`stock-machine.ts:185`'s `approximation` string to state the *true* behaviour
instead of the false one; (b) a real product decision — should the tool's
contract be restructured, or does it even still make sense given how little
it differs from `vice_autostart`? Recommend doing (a) in this phase (it is a
documentation-honesty fix squarely in this phase's charter) and **promoting
(b)** to `REQUIREMENTS.md` → Future Requirements with a named owner (the
todo itself is the right citation) — this phase's own scope fence (a
disposition phase, not a redesign phase) argues against attempting a tool
contract change here.

## DEBT-02 — the five undocumented behaviours

All five are confirmed silent in the target docs this session — none of the
five strings/concepts below appear anywhere in `README.md` or
`c64-ram-capture/SKILL.md` today [VERIFIED: `grep -n "Drive8Type\|git init\|C64RE_PROJECT_ROOT\|RELEASES.json\|releases.json" README.md .claude/skills/c64-ram-capture/SKILL.md` returns nothing].

| # | Behaviour | Source todo | Where a user would actually look | What to add |
|---|---|---|---|---|
| 1 | `Drive8Type` prerequisite for disk loads | `2026-08-19-drive-type-prerequisite-undocumented-in-readme-and-skill.md` | `c64-ram-capture/SKILL.md`'s `## Boot a disk` section (line 74) | This is now a **closing note, not an active workaround** — the todo itself says Phase 8.2's fix made the broker set `-drive8type 1541` unconditionally at every stock launch (`broker-launch.mts`'s `buildViceArgs()`), so a user driving the documented `vice_disk_attach`→`vice_autostart` procedure never needs to know the concept exists. Add one sentence to `## Boot a disk` (or the skill's `## Troubleshooting` table) noting the broker configures the drive type automatically; no user action needed |
| 2 | `project-paths.mjs`'s `.git`-marker requirement for the toolkit's project root | `2026-08-19-project-paths-git-marker-requirement-undocumented.md` | `c64-ram-capture/SKILL.md`, near the top (the skill has no dedicated "Setup" section today — insert a short prerequisite line before `## The order`, or add to `## Troubleshooting`) | One line: the toolkit's project root must be a git repo (`git init` first) or `C64RE_PROJECT_ROOT` must be set explicitly — a scratch/throwaway project needs this |
| 3 | `RELEASES.json`'s schema (`schema_version`, `schema_notes`, `id`/`canonical`/`disk_image`/`dumps` per entry; `dumps` **must** be an array, no `??` guard) | `2026-08-19-releases-json-schema-undocumented.md` | New subsection in `c64-ram-capture/SKILL.md`, natural placement right before `## References` (line ~290) or right after `## Which skill does what` | Add a "Release registry shape" subsection documenting the fields (the todo names them exactly), or ship a `RELEASES.json.example` in the skill's own directory |
| 4 | `vice_ping`'s `resolvedBinaryPath` is a one-time MCP-server-startup PATH probe, independent of which binary the broker actually leased for a given request | `2026-08-19-vice-ping-resolvedbinarypath-misleading-under-broker-pool.md` | Code (`vice-proxy.ts:3312`) or a doc note wherever `vice_ping`'s output shape is documented | [VERIFIED: `ACTIVE_BACKEND` is still resolved once at module scope, `vice-proxy.ts:316` — `const ACTIVE_BACKEND = backendDetect.resolvedBackend();` — and its `binPath`/`binPathResolved` flow unchanged into the `vice_ping` response at `vice-proxy.ts:3312-3313`]. Note: a **prior, different** bug in this same area (`WR-05`, "unresolved command name, not a resolved path") was already fixed — `binPathFields()` now correctly distinguishes a resolved absolute path from a bare command (`backend-detect.mts:444-449`). This todo's concern is orthogonal and still open: the field never re-queries per-request which binary the *leased* instance is actually running. Recommend the todo's own second option — rename/document the field explicitly as a startup-time probe, not the leased instance's binary — since re-querying the broker's `epoch.json` per-`vice_ping` call is a larger behavioural change this disposition phase should not casually take on |
| 5 | The refuted warp-over-`resource_set` claim | `2026-08-20-warp-over-resource-set-refuted-on-stock-3-10.md` | `GAINS-PROTOCOL.md` (research doc, already mostly correct) + `tools-manifest.json`'s fork-tool description (see the open question above) | See the detailed breakdown in the DEBT-01 section above |

## DEBT-03 — Phase 03's three pending UAT scenarios

Source: `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` (`status: partial`,
3 of 3 tests still `pending` — read in full this session).

| # | Scenario | What it needs | Fixture/program status | Evidence shape for pass/fail |
|---|---|---|---|---|
| 1 | `vice_autostart` / `vice_disk_attach` / `vice_snapshot_load` round-trip against real `.prg`/`.d64`/`.vsf` fixtures on genuine stock VICE | A `.prg`, a `.d64`, and a `.vsf`, plus a running genuine stock `x64sc` | **No `.d64` fixture exists in the repo today** [VERIFIED: `find . -iname "*.d64"` returns nothing]. Three small `.prg` fixtures exist (`.planning/phases/09-.../evidence/fixture/probe-illegal.prg`, two `.../11-.../evidence/**/*.prg`, 46-102 bytes) and could be reused, or a fresh trivial `.prg` built with `acme` (confirmed present at `~/.local/bin/acme`). A `.d64` can be built with `c1541` (confirmed present at `/usr/local/bin/c1541`, already used by `probe-binmon.mjs` and `stock-broker-live.test.ts` for exactly this purpose). A `.vsf` can be produced fresh via `vice_snapshot_save` against a live session, or two pre-existing ones already exist under `.vice-snapshots/` (`anno_probe_vsf.vsf`, `anno_probe_vsf_v2.vsf`) though those were captured for a different (anno) purpose and their provenance/contents should be re-checked before reuse rather than assumed suitable | Round-trip byte/state verification per tool (attach → confirm directory visible; autostart → confirm PC moved + program loaded; snapshot load → confirm RAM matches the saved state), recorded in `03-HUMAN-UAT.md` per its existing `result:` field convention |
| 2 | `vice_keyboard_petscii` and `vice_joystick_set` against a **running program** | A real running C64 program that visibly reacts to PETSCII/joystick input | No existing fixture demonstrably does this; the 3 tiny `.prg` fixtures above are recon/probe subjects, not interactive programs. Likely needs either a tiny hand-assembled ACME test program (poll `$DC00`/keyboard buffer, write to screen memory) or booting BASIC and typing/reading a program's visible response | Observed screen-memory or register change correlated with the injected input, captured via `vice_memory_read`/`vice_registers_get` before and after |
| 3 | Hot non-stopping checkpoint auto-disables under sustained 20+/sec hit pressure | A real running program hitting a checkpoint address at high frequency, with a non-stopping (`stop:false`) checkpoint armed on it | **This is the identical experiment as `2026-08-14-probe-phase3-assumed-wire-details.md`'s remaining A4 item** — both ask "does `stock-checkpoints.ts`'s rate-limiter auto-disable actually fire under a real, synchronous `CHECKPOINT_INFO` flood from inside VICE's CPU loop, without stalling or deadlocking?" **Do this once, satisfy both.** CLAUDE.md's own Protocol constraint documents the exact risk (`mon_breakpoint.c:557-562` emits the hit frame synchronously, from inside the CPU loop, before checking `cp->stop`) — this is a genuine, previously-unexercised safety-critical probe, not a formality | Confirm: the rate limiter's auto-disable fires, the checkpoint is toggled off, neither client nor emulator deadlocks/stalls. If the probe finds a genuine race, `stock-checkpoints.ts`'s deferral mechanism needs a real fix plus a regression test **before** softening any label — do not report a pass to unblock the milestone if the probe actually finds a problem |

**Live-testing feasibility, confirmed this session**: `DISPLAY=:0` is set,
`/usr/bin/x64sc` (genuine stock, confirmed via absolute path — the fork
`/usr/local/bin/x64sc` shadows bare `x64sc` on `PATH`) and `/usr/local/bin/c1541`
are both present and executable, and `acme` is present at `~/.local/bin/acme`.
Nothing in this environment blocks running all three scenarios live. Recall
the project's own hazard: never run a second monitor client against the same
instance while these tests are live (indistinguishable from a hang) — see
`vice-wedge-triage` skill and `CLAUDE.md`'s Concurrency constraint.

## Common Pitfalls

### Pitfall 1: Treating the guard's "green" as proof of completeness
**What goes wrong:** `docs-review-disposition.test.ts` passes today, and a
plan could reasonably read that as "nothing to do here." **Why it happens:**
The guard's parser has a real blind spot (see above) — green means "nothing
the parser can see is undispositioned," not "nothing is undispositioned."
**How to avoid:** Fix the parser regex *before* trusting any green run for
scope-closing decisions in this phase. **Warning signs:** A `*-REVIEW.md`
using `####` for findings, or a heading with no colon after the id.

### Pitfall 2: Hand-editing `tools-manifest.json`
**What goes wrong:** Fixing `vice_machine_config_set`'s misleading `WarpMode`
description by editing `tools-manifest.json` directly looks like the fastest
fix, but the file is machine-generated from a live external binary this repo
does not own; the next `refresh-manifest.ts` run silently reverts it, and
there is no CI gate forcing a regeneration before merge. **How to avoid:**
Put the caveat in a project-owned file (`docs/stock-vice-parity.md` or a
`capability-registry.ts` note), not the generated manifest.

### Pitfall 3: Editing Phase 09's evidence harnesses to "fix" their Info findings
**What goes wrong:** `evidence/vice-tool-harness.mjs`/`evidence/mcp-harness.mjs`
produced the committed transcripts that back the milestone's `degrade`/`R4`
go/no-go verdict; editing them after the fact breaks the provenance link
between the harness in the tree and the evidence it is recorded as having
produced. **How to avoid:** `wont-fix` with the evidence-immutability
rationale already written in the pending todo, don't "helpfully" clean up
the code.

### Pitfall 4: Regenerating `tools-manifest.json` without checking the count gate
**What goes wrong:** Fixing the stale-manifest todo (`vice_snapshot_list`
missing) by running `refresh-manifest.ts` reopens `fork-manifest-surface.test.ts`'s
hard-coded 62-tool count gate, which has its own header warning against
bumping the number without a decision record. **How to avoid:** If the fix
adds `vice_snapshot_list` back to the manifest, update that gate's count
*with* a decision record in the same change, per that file's own instructions
— don't just bump the literal.

### Pitfall 5: Arming a `stop:false` checkpoint casually for DEBT-03 scenario 3 / A4
**What goes wrong:** This is a genuine safety-relevant probe (documented risk:
stalling the emulator's CPU loop from inside a synchronous socket write), not
routine test execution. **How to avoid:** Use the wedge-triage discipline
(bounded polling, a way to recognise and recover from a real stall) rather
than an unbounded wait, and be prepared to record a genuine `fail` if the
rate limiter doesn't fire cleanly — don't soften the test to force a pass.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `03-REVIEW.md`'s `WR-07`, `IN-02`, `IN-03`, `IN-04`, `IN-06` are still open (not individually re-verified against current source this session, unlike `WR-06`/`WR-08`/`IN-05`) | GATE-02 § newly-surfaced Phase 03 findings | If one is already fixed, the plan wastes a small amount of effort re-confirming it; low cost either way — re-verify at execution time, as the analogous Phase 08 todo already recommends doing for its own unverified subset |
| A2 | `08-REVIEW.md`'s `WR-06`, `WR-07`, `WR-09`, `WR-10`, `WR-11` are still open (this session did not re-verify them; the pending todo's own author likewise left them unverified) | GATE-02 § Phase 08 table | Same as A1 |
| A3 | The right home for the `vice_machine_config_set` WarpMode caveat is a project-owned doc (`docs/stock-vice-parity.md` or `capability-registry.ts`), not the generated `tools-manifest.json` | DEBT-01 § two todos needing more than a doc edit | If wrong, effort goes into the wrong file and the caveat still doesn't reach a user reading `docs/stock-vice-parity.md`; low risk since either way it's a small text change once located |
| A4 | `.vice-snapshots/anno_probe_vsf.vsf`/`anno_probe_vsf_v2.vsf` are suitable to reuse for DEBT-03 scenario 1's `.vsf` round-trip test | DEBT-03 § scenario 1 | If their machine-type/content doesn't fit a clean disk-load round-trip test, a fresh `.vsf` needs producing via `vice_snapshot_save`, which is cheap and already a documented tool in this project |
| A5 | CI's manual-only-suite behaviour (needed to close `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md`) can be checked via `gh run view` on a recent workflow run without triggering a new one | DEBT-01 § todo table | If GitHub Actions history has rotated past a run predating the narrowed gate, a fresh CI run (a real push) may be needed to answer definitively — the todo's own acceptance check anticipates this |

**If this table is empty:** N/A — see rows above; every claim not backed by a
direct `Read`/`grep`/live-run this session is listed.

## Open Questions

1. **Where does the `vice_machine_config_set`/`WarpMode` caveat actually
   belong?**
   - What we know: `tools-manifest.json` is machine-generated and shouldn't be
     hand-edited; `docs/tool-support.md` is also generated and doesn't carry
     full descriptions; `capability-registry.ts` entries exist for this tool
     but their `reason` field serves stock-refusal messaging, a different
     purpose than caveating a fork-side description.
   - What's unclear: whether `capability-registry.ts`'s schema should grow a
     new field for this, or whether `docs/stock-vice-parity.md`'s existing
     licensed-divergence register is the right home.
   - Recommendation: decide at plan time, not research time — this is a
     genuine "Claude's Discretion" item since no CONTEXT.md pinned it, and it
     has real trade-offs (schema growth vs. a documentation-only patch).

2. **Should `2026-08-21-migrate-hand-copied-acme-gates-to-anno-test-gate.md`
   be fixed in this phase or promoted?**
   - What we know: it's a real, scoped, self-contained fix with exact
     replacement code already specified; no phase currently claims it.
   - What's unclear: whether this phase's time budget (already large — GATE-02
     alone touches ~30 findings) has room for a testing-infrastructure
     dedup that isn't strictly a GATE-02/DEBT-01/DEBT-02/DEBT-03 requirement
     by name (it IS a pending todo, so DEBT-01 covers it either way).
   - Recommendation: fix it if time allows (it's genuinely cheap), otherwise
     dispose via DEBT-01 as "promoted, no named external owner needed — do in
     the next phase that touches anno test infrastructure."

3. **Does the `docs-review-disposition.test.ts` parser fix need a companion
   fix to normalize heading levels, or is widening the regex sufficient?**
   - What we know: widening the regex (accept `###`/`####`, colon-or-space) is
     sufficient to make the guard see all 150 findings correctly, verified
     live this session.
   - What's unclear: whether a future reviewer might introduce a third
     heading style this widened regex still misses (e.g. a numbered list
     instead of a heading).
   - Recommendation: widen the regex now (immediate, verified fix); consider
     whether the code-review workflow itself (`gsd-core/workflows/code-review.md`)
     should mandate one heading convention for new reviews going forward — that
     is a GSD-tooling change outside this repo's own scope, note it but do not
     block this phase on it.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Genuine stock `x64sc` | DEBT-03 all 3 scenarios; A4 probe | ✓ | `/usr/bin/x64sc`, VICE 3.9 [VERIFIED: prior phases' evidence docs; binary present this session] | — |
| Fork `x64sc` | Manifest regeneration todo, WarpMode fork-tool verification | ✓ | `/usr/local/bin/x64sc`, VICE 3.10 [VERIFIED: `ls -la` this session] | — |
| Display | DEBT-03 (VICE GUI/PNG output paths reference a display) | ✓ | `DISPLAY=:0` [VERIFIED this session] | — |
| `c1541` | DEBT-03 scenario 1 (`.d64` fixture creation) | ✓ | `/usr/local/bin/c1541` [VERIFIED this session] | — |
| `acme` | DEBT-03 scenario 1/2 (`.prg` fixture creation, if reusing existing tiny fixtures isn't sufficient) | ✓ | `~/.local/bin/acme` [VERIFIED this session] | Reuse existing committed `.prg` fixtures under `.planning/phases/09-*/evidence/` and `11-*/evidence/` if a fresh build isn't needed |
| `gh` CLI (for the CI-history check) | `2026-08-13-reconcile-ci-test-command-with-narrowed-gate.md` | Not checked this session | — | If unavailable, view the workflow run history via the GitHub web UI instead |

**Missing dependencies with no fallback:** None identified.

**Missing dependencies with fallback:** `gh` CLI availability unconfirmed;
web UI is the fallback.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (no separate framework) |
| Config file | none — invoked directly per file or via `npm test`/`npm run test:automated` in `.claude/mcp/vice` |
| Quick run command | `node --test docs-review-disposition.test.ts` (and the other three `docs-*.test.ts` guards) |
| Full suite command | `npm run test:automated` (narrowed gate, excludes the 3 manual-only suites) |

### Phase Requirements -> Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| GATE-02 | Every review finding is dispositioned | guard (planning-doc) | `node --test docs-review-disposition.test.ts` | ✅ (needs the parser-regex fix as part of this phase's own work, not a Wave 0 gap) |
| DEBT-01 | Pending-todo tree reflects real dispositions | guard (planning-doc) | `node --test docs-deferred-ledger.test.ts` | ✅ existing |
| DEBT-02 | Documentation updated | manual review (no automated doc-content assertion exists or is warranted for prose additions) | — | N/A — human-verify mode, per `.planning/config.json`'s `human_verify_mode: "end-of-phase"` |
| DEBT-03 | Live UAT scenarios executed | manual/live (`03-HUMAN-UAT.md`'s own `result:` field, not an automated test) | — | ✅ file exists, needs its 3 `pending` rows updated |

### Sampling Rate
- **Per task commit:** run the specific `docs-*.test.ts` guard(s) touched by that task, plus `npm run typecheck`
- **Per wave merge:** `npm run test:automated`
- **Phase gate:** all four `docs-*.test.ts` guards green (this is `GATE-01`'s own mechanically-enforced precondition, `audit-gate.mjs`) before any milestone-audit `status: passed`

### Wave 0 Gaps
None — this phase's "tests" are the existing planning-doc guards
(`docs-review-disposition.test.ts`, `docs-deferred-ledger.test.ts`) plus a
handful of small source-level unit fixes (e.g. `IN-05`'s one-line string fix
in `stock-connect.ts`) that land inside already-tested modules. No new test
framework or fixture is needed; where a fix touches assertions that key off
specific strings (e.g. `stock-dispatch.test.ts` if `WR-13`'s message
changes), update the existing test in the same commit.

## Security Domain

`security_enforcement` is `true` in `.planning/config.json`, but this phase's
actual work surface is planning documents, doc prose, and a handful of
isolated string/regex fixes — no new input-handling, auth, or session-management
surface is introduced.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth surface touched |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A |
| V5 Input Validation | marginal | `WR-01` (Phase 13's `checkCommandAvailable()` shell-interpolation finding) is the one item in this phase's scope with a real injection-shape defect — fix by argv-array `spawnSync`, never shell-string interpolation, per the already-written fix in `13-REVIEW.md` |
| V6 Cryptography | no | N/A |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Shell command-string interpolation (`spawnSync("sh", ["-c", ...])` with a variable) | Tampering | argv-array `spawnSync`, never a shell string — the fix Phase 13's `WR-01` already specifies for `probe-binmon.mjs:1486-1489` |

## Sources

### Primary (HIGH confidence — read/run directly this session)
- `.claude/mcp/vice/docs-review-disposition.test.ts` — full read; ran it live (`4/4 pass`); reproduced its scanning logic with a widened regex against the live tree to find the 9 newly-surfaced findings
- `.planning/phases/*/REVIEW.md` for phases 01, 02, 03, 05, 07, 08, 08.2, 09, 10, 11, 12, 13, 14 — headings enumerated, several full findings read verbatim
- `.planning/todos/pending/*.md` (all 20) and several `.planning/todos/completed/*.md` — read in full
- `.planning/phases/03-direct-tools/03-HUMAN-UAT.md` — read in full
- `.claude/mcp/vice/{stock-connect.ts, stock-dispatch.ts, stock-live.test.ts, fork-live.test.ts, capability-registry.test.ts, vice-proxy.ts, backend-detect.mts, refresh-manifest.ts, fork-manifest-surface.test.ts}` — grepped/read for current-source verification of specific findings
- `scripts/{generate-tool-support-table.mjs, check-skill-tool-coverage.mjs, check-skill-fork-honesty.mjs}` and `scripts/lib/` — grepped/read for WR-04/05/08/12 status
- `docs/tool-support.md`, `.claude/mcp/vice/tools-manifest.json`, `.planning/research/GAINS-PROTOCOL.md` — grepped for exact current text
- `README.md`, `.claude/skills/c64-ram-capture/SKILL.md` — full section headings enumerated, grepped for the five DEBT-02 terms (all absent)
- `.planning/REQUIREMENTS.md`, `.planning/STATE.md`, `.planning/ROADMAP.md` (Phase 15/16/17 sections) — read in full for scope and claimed-todo cross-checking
- Live environment probes this session: `DISPLAY`, `x64sc` (both binaries), `c1541`, `acme`

### Secondary (MEDIUM confidence)
- The un-re-verified subset of Phase 08's `WR-06/07/09/10/11` and Phase 03's `WR-07/IN-02/IN-03/IN-04/IN-06` — status inherited from the reviews' own text and the prior pending todo's own partial spot-check, not independently re-confirmed against current source this session

### Tertiary (LOW confidence)
- None — every claim above is either directly verified this session or explicitly flagged in the Assumptions Log

## Metadata

**Confidence breakdown:**
- Finding/todo inventories: HIGH — every file counted, read, and cross-referenced live this session
- "Which findings are still genuinely open": MEDIUM — a meaningful subset spot-checked against current source and confirmed either way; the rest inherit the same "not yet re-verified" caveat the repo's own prior todos already carry, which is itself informative (this is the established, accepted verification discipline here, not a shortcut this research introduced)
- The `vice_machine_config_set` caveat's correct home: LOW/open question — genuinely undetermined, flagged for planner/human decision rather than guessed

**Research date:** 2026-08-22
**Valid until:** This research is tied to the exact state of `.planning/todos/pending/`, every `*-REVIEW.md`, and current source at commit `69465e4`. Any commit that lands before this phase executes (fixing one of the flagged-open findings, adding a new pending todo, etc.) invalidates the corresponding row above — re-verify against current source at plan time, do not treat this document as frozen ground truth once execution starts.
