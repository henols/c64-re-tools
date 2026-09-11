# Phase 52: Remove the Fork Backend - Pattern Map

**Mapped:** 2026-09-11
**Files analyzed:** ~40 (deletion/rewrite targets from ROADMAP §Phase 52 + RESEARCH §1/§2/§5/§6/§7)
**Analogs found:** all classified; this phase is overwhelmingly DELETE/REWRITE, not CREATE — most
rows below are "precedent for the kind of change," not a template to copy verbatim.

## Framing note for the planner

Only **one** genuinely new file exists in this phase's scope: the `vice.ts` shared-infrastructure
split (RESEARCH §2). Everything else is a deletion, a guard rewrite, a registry-content migration,
or a skill-prose rewrite. A pattern map that invented "closest analog" rows for deleted files would
be noise, so this document is organized by CHANGE TYPE, each with its real analog(s) and concrete
excerpts, rather than a flat per-file table.

## File Classification

| File | Change type | Role | Data flow | Closest analog |
|---|---|---|---|---|
| `vice-errors.ts` (new, name per RESEARCH A1) | **new module** (split-extraction) | utility/shared-seam | request-response (error types + lease-state accessors) | `stock-paths.ts` header + `repo-root.ts` header (seam-extraction convention) |
| `vice.ts` | **delete fork half, keep nothing** (all surviving symbols move to `vice-errors.ts`) | service/transport | request-response | — (dies) |
| `vice-sync.ts` | **delete whole** (dead code, zero non-test importers) | utility | event-driven | — (dies) |
| `vice-probe.ts` | **delete whole** (fork-only, dies with `forwardToVice()`) | service | request-response | — (dies) |
| `refresh-manifest.ts` | **delete whole** | utility/config-gen | batch | — (dies) |
| `tools-manifest.json` | **delete** | config | — | — (dies) |
| `capability-registry.ts` | **delete after content migration** (RESEARCH §6 recommendation) | config/registry | request-response | see "registry migration" section below |
| `backend-detect.mts` | **collapse** (`probeBackend()` dies, `resolvedBackend()` stubs to stock) | utility | request-response | itself, before/after diff is the template |
| `vice-proxy.ts` | **large in-place deletion** (`forwardToVice`, `gatherWedgeEvidence*`, `rewriteArguments`, `buildBackendAwareTool`) | controller/router | request-response | itself — this is the "big deletion inside a live file" case, see Phase-32 precedent below |
| `docs-fork-decision.test.ts` | **rewrite in place** (repoint assertions at the reversal row) | test/guard | doc-presence | itself (see Guard Shape excerpt below) — also the template for the OTHER guard rewrites |
| `docs-linerefs.test.ts` | **rewrite/narrow** (the citations it pins are deleted code) | test/guard | doc-presence | `docs-fork-decision.test.ts` (same "pin prose against source" shape) |
| `manifest-arg-compat.test.ts` | **delete whole** (two-manifest premise gone) | test/guard | — | — (dies) |
| `scripts/check-skill-fork-honesty.mjs` | **invert/rewrite** | CI script | batch/doc-check | its own siblings (`check-npm-packages.mjs`, `check-skill-cli-invocations.mjs`, `check-skill-tool-coverage.mjs`) |
| `scripts/generate-tool-support-table.mjs` | **retire or repoint** | CI script/generator | batch | `scripts/check-npm-packages.mjs` (sibling shape) |
| `PROJECT.md` (`FORK-01` row, `### Out of Scope` bullet) | **rewrite in place** | doc | — | its own existing row (excerpt below) |
| 9 skill sites (`c64-program-recon/**`, `vice-wedge-triage/SKILL.md`, `c64-ram-capture/SKILL.md`) | **rewrite prose** (routing language → permanent-limitation language) | doc/skill | — | `vice-wedge-triage/SKILL.md:225-234` (existing good permanent-limitation-with-alternative prose, excerpted below) |
| 12 test files with `"fork"` conditionals | **structural deletion of branches** (not skip) | test | — | Phase 32's own precedent ("The Deletion and the Grep Gate") |
| new criterion-3 acceptance record (doc, location TBD by planner) | **new doc content**, sourced from `capability-registry.ts`'s 6 `"hardware"` entries | doc | — | `PROJECT.md`'s `### Out of Scope` bullet style (dated, evidenced, named reversal trigger) |

## Pattern Assignments

### 1. `vice.ts` split → new `vice-errors.ts` (the one real "new file")

**Analog:** `src/mcp/vice/stock-paths.ts` (header convention) and `src/mcp/vice/repo-root.ts`
(seam-extraction rationale, "WHY THIS FILE EXISTS" + "WHAT NOT TO DO").

**Header pattern to copy** (`stock-paths.ts:1-30`):
```typescript
#!/usr/bin/env node
// vice-errors.ts
//
// The ONE place the shared error hierarchy and lease-state accessors live,
// used by BOTH the (dead) fork transport's former callers and the (surviving)
// stock lease-acquisition path. Split out of vice.ts (Phase 52) because
// buildHeldLease() (vice-proxy.ts) reads activeInstance() on every tool call,
// on both backends -- deleting vice.ts wholesale breaks stock lease
// acquisition, not just fork transport.
//
// WHAT NOT TO DO:
//   - Never move fork-transport code here (call(), rpc(), withReconnect(),
//     DENY_LIST). Those die with the fork; this file is the shared half only.
//   - Never let this module reimport anything from vice.ts -- vice.ts is
//     gone after the split; a lingering import is a sign the split missed
//     a symbol.
import { ... } from "node:...";
```

**Symbols to move verbatim** (RESEARCH §2, "corrected shared/dead split, by symbol"):
`ViceError`, `ViceErrorOptions`, `MachineRestartedError`, `MachineRestartedErrorOptions`,
`readEpoch`, `EpochResult`, `EPOCH_FILE`, `mcpHost`, `activeInstance`, `useInstance`,
`ActiveInstance`, `UseInstanceOptions`.

**Repoint pattern** — every one of the 17 surviving importers changes only its import path,
e.g. `stock-paths.ts:27`:
```typescript
import { ViceError, type ViceErrorOptions } from "./vice.ts";
```
becomes
```typescript
import { ViceError, type ViceErrorOptions } from "./vice-errors.ts";
```
This is a mechanical repoint, not a logic change — verify with `npm run typecheck` after each file
(Pitfall 1 in RESEARCH: do the split BEFORE deleting `vice.ts`, never the reverse).

**Error-class shape to preserve** (base pattern already documented in CLAUDE.md, confirmed live in
`vice.ts`): `class ViceError extends Error` with an options-object constructor
(`constructor(message: string, { ...fields }: ViceErrorOptions = {})`) — copy this shape unchanged
into the new file, do not "improve" it mid-move.

---

### 2. Guard-rewrite shape (`docs-fork-decision.test.ts` and its siblings)

**Analog:** `docs-fork-decision.test.ts` itself is both the file to rewrite AND the template every
other pinned-prose guard in this phase should follow, because it already documents its own
rationale for existing (`src/mcp/vice/docs-fork-decision.test.ts:1-14`):

```typescript
// docs-fork-decision.test.ts
//
// WHY THIS EXISTS: FORK-01. This project answered the fork-backend question
// by default at two milestone closes in a row. Phase 14 broke that pattern
// with a dated decision recorded in `.planning/PROJECT.md`'s `## Key
// Decisions` table -- but a dated decision written in prose can drift...
// This file makes that row's presence, dating, and reversal criteria a
// checked invariant instead of a one-time write.
```

**Section-isolation helper pattern** (`docs-fork-decision.test.ts:33-37`), reusable verbatim for
the rewritten version (only the heading name and reversal-phrase set change):
```typescript
function keyDecisionsSection(projectMd: string): string | null {
  const m = projectMd.match(/^## Key Decisions\n([\s\S]*?)(?=\n## )/m);
  return m ? m[1] : null;
}
```

**Row-predicate pattern** (`REVERSAL_PHRASES` const at top of file, non-empty-set self-check) —
when rewriting for the reversal, keep an equivalent named, non-empty phrase set so test-vacuity
can't silently pass; e.g. `["reversal", "removed", "no longer retained"]` or similar, asserted
non-empty in test 1 exactly as today.

**What changes, concretely:** test 2 ("exactly one row contains `FORK-01`") and test 6 (Out of
Scope bullet cites `FORK-01`) stay structurally identical — only the row's CONTENT assertions
(tests 3-5) get repointed to the new reversal wording. This is a rewrite of assertions against a
new fixed string, not a new test architecture. Same technique applies to `docs-linerefs.test.ts`
(pins `vice-proxy.ts:<N>` citations — RESEARCH §7 says the underlying invariant is obsolete, so
this guard needs the CLAUDE.md/PROJECT.md Architecture bullet removed and the guard's assertion
list narrowed to whatever citations remain true, not just renumbered).

---

### 3. Large in-place deletion inside a live file (`vice-proxy.ts`, 12 test files)

**Analog:** Phase 32, "The Deletion and the Grep Gate" (`.planning/ROADMAP.md:470`, 21/21 plans,
completed 2026-09-01, narrowed by `D-01`). This is the repo's own house precedent for "delete a
large code region from a live file/tree, keep the suite green between steps, and add a grep-based
gate proving the deletion doesn't regress." The name itself is the pattern: pair every deletion wave
with a mechanical (grep-based) proof that the deleted thing stays deleted.

Concretely for Phase 52, RESEARCH §1 criterion 7 already specifies the equivalent gate:
```bash
grep -rc '"fork"' src/mcp/vice/*.ts src/mcp/vice/*.mts | awk -F: '$2>0'
```
expected empty. This is the Phase-32-style "grep gate" applied to this phase's subject. Use the
same technique for `rewriteArguments`/`forwardToVice`/`buildBackendAwareTool` — grep for the deleted
symbol names post-deletion and assert zero hits, rather than trusting the diff alone.

**Sequencing precedent also matches RESEARCH §3's wave order**: rules/guards first (Wave 0), then
mechanical splits (Wave 1), then the big deletion (Wave 2), then the grep-gate check at each wave
boundary — this is exactly Phase 32's own documented shape, and also matches the project's stated
general principle ("rules and instrument before the work they gate" — same shape as Phase 9, 12,
23, 33, 39, cited in ROADMAP's Sequencing Rationale for Phase 46).

**Test-file branch deletion, structural not skip** (RESEARCH §1 criterion 7, Pitfall 3): grep each
of the 12 files (`grep -n '"fork"' <file>`) and remove the conditional's whole branch — not
`test.skip()`, not an early return. Verify via `grep -c '"fork"' *.test.ts` returning zero.

---

### 4. CI-script inversion (`scripts/check-skill-fork-honesty.mjs`)

**Analog:** its own sibling scripts in `scripts/`: `check-npm-packages.mjs`,
`check-skill-cli-invocations.mjs`, `check-skill-tool-coverage.mjs` — same family, same header
convention (a `#!/usr/bin/env node` shebang, a WHY-comment naming the failure class it guards
against, a small pure predicate function, then a `test`/assert-and-exit-nonzero body). The file's
own header (`scripts/check-skill-fork-honesty.mjs:1-25`) already documents its own precedent for
"a required string was re-pointed, not dropped" when its subject changed shape once before
(2026-08-29, phase 29 plan 29-09) — that is the literal precedent for what THIS phase must do again:
a currently-required assertion (fork-only tool names exist, README names `VICE_BACKEND`) becomes
false and must be re-pointed at the new truth (no fork-only tools exist; README should NOT claim a
backend switch), not silently deleted. Excerpt:
```javascript
// THE SIXTH REQUIRED STRING WAS RE-POINTED, NOT DROPPED (2026-08-29,
// phase 29 plan 29-09). It used to assert that README named
// the external analyser as a REQUIRED PREREQUISITE ... true when the
// plugin shelled out to that analyser, and false the moment the
// integration was cut. Deleting the assertion outright was the wrong
// repair: the obligation that survives the cut is CUT-03's...
```
Apply the same discipline: for each of the script's current assertions (fork-only name floor ≥20,
fork-mention floor ≥8, the 4 required README strings), decide per-assertion whether the underlying
concern survives (e.g., "the criterion-3 acceptance record is discoverable from README" likely
survives and gets a NEW string to assert) versus dies outright (the `VICE_BACKEND` string, the
fork-only name derivation from `capability-registry.ts`).

---

### 5. Registry-content migration (`capability-registry.ts` → criterion-3 acceptance record)

**Analog:** `PROJECT.md`'s `### Out of Scope` section's existing bullet style — dated, names the
technical basis, states a reversal trigger where one exists. Excerpt of the exact shape to match
(`PROJECT.md:436`):
```
- **Matrix-keyboard equivalence on the stock backend** — proven not recoverable at source level.
  `read_ciapb()` recomputes from `keyarr` on every read, and watchpoints fire after the load
  completes. `JOYPORT_SET` covers most in-game input instead.
```
This is nearly verbatim the shape the criterion-3 record needs for each of the three hard losses,
and the raw material already exists in `capability-registry.ts`'s 6 `"hardware"`-category `reason`
fields (RESEARCH §6) — e.g. the SID entry's reason: `"SID's $D400-$D418 registers are write-only in
hardware, and the binary monitor exposes no SID read command."` Copy these `reason`/`alternative`
strings into whichever doc Wave 0 designates (PROJECT.md Out of Scope, or a new `docs/` file cross-
referenced from it — RESEARCH Open Question 2, planner's call), preserving the exact technical
wording rather than re-deriving it by hand.

**FORK-01 row rewrite target** (`PROJECT.md:933`, current text, to be amended in place alongside
`docs-fork-decision.test.ts`):
```
- ... Formalised by FORK-01 (Key Decisions, 2026-08-22): retained as the default hedge, now with
  dated reversal criteria — see that row rather than treating this bullet as the sole record.
```
The rewrite must keep an ISO date, keep the literal string `KEYBOARD_MATRIX_SET` (per the guard's
regex — the amended row can say the trigger is now moot, see RESEARCH §3), and keep one of the
reversal-phrase vocabulary words, exactly as `docs-fork-decision.test.ts`'s assertions require.

---

### 6. Skill-prose rewrite (9 sites: routing language → permanent-limitation language)

**Analog — the GOOD existing example to model the rewrite on:** `vice-wedge-triage/SKILL.md:225-234`,
which already states a permanent stock limitation, gives the reason, and immediately supplies the
stock-side alternative in the same breath:
```markdown
**On stock, there is no non-pausing call at all — any inbound byte halts the machine — so the
`vice_ping` ×3 poll measures nothing there and is fork-only.** The stock equivalent is the same
bracket shape with zero calls during the wait:

1. `vice_cycles_stopwatch` `{action: "reset"}`
2. `vice_execution_run`
3. A real wall-clock wait, with **no calls at all** during it
4. `vice_cycles_stopwatch` `{action: "read"}`
```
Note this is ALSO one of the 9 rewrite sites (#3 in RESEARCH §5 table) — it already names the stock
route, so its required edit is the smallest on the list: drop the "is fork-only" framing (there is
no fork to route to) and keep the stock bracket as the ONLY procedure, not an alternative to it.

**Contrast — a site that needs the full rewrite** (`c64-program-recon/references/tool-selection.md:17`,
paraphrased in RESEARCH #1): `vice_sid_get_state "(requires the fork — SID …)"` has NO stock route
at all. For sites like this, the rewrite pattern is: state the limitation as permanent and dated,
give the hardware reason (reuse `capability-registry.ts`'s `reason` text verbatim per §5 above),
and remove the "requires the fork" framing entirely rather than replacing "fork" with a dead
pointer. Do not invent a stock workaround that doesn't exist.

**Guard interaction:** `skills-planning-vocabulary.test.ts` requires the new prose stay clean of any
`.planning/*` path — do not cite `.planning/notes/fork-removal-reversal-basis.md` by path from
skill text; cite `docs/`-rooted paths only, per CLAUDE.md's "one surviving citation form."

---

## Shared Patterns

### Error hierarchy (must survive the split unchanged)
**Source:** `vice.ts`'s `ViceError`/`MachineRestartedError` (moving to `vice-errors.ts`)
**Apply to:** all 17 files repointing their import path only — no constructor-shape changes.

### "WHY THIS FILE EXISTS" / "WHAT NOT TO DO" header convention
**Source:** `stock-paths.ts:1-30`, `repo-root.ts:1-30`, `host-tool.mts:1-40`
**Apply to:** the new `vice-errors.ts`, and to any doc/comment surviving a deletion that still needs
to explain why the deleted code's LESSON should not be reintroduced (CLAUDE.md's own comment-rule:
"what NOT to do, with the specific past mistake named" — RESEARCH explicitly flags several fork-era
comments, e.g. `stock-paths.ts:19-24`'s "Never call rewriteArguments() from a stock handler," as
candidates to trim rather than delete outright, since the lesson survives the code).

### Grep-gate proof-of-deletion
**Source:** Phase 32 precedent ("The Deletion and the Grep Gate") + RESEARCH §1 criterion 1's exact
command (`grep -rc '"fork"' src/mcp/vice/*.ts src/mcp/vice/*.mts | awk -F: '$2>0'`, expect empty)
**Apply to:** every wave boundary in RESEARCH §3's proposed sequence — treat as the reusable
verification idiom for this whole phase, not a one-off check.

### Doc-guard rewrite discipline ("re-point, don't drop")
**Source:** `docs-fork-decision.test.ts` header (own rationale) + `check-skill-fork-honesty.mjs`'s
2026-08-29 precedent comment (quoted in full above)
**Apply to:** `docs-fork-decision.test.ts`, `docs-linerefs.test.ts`, `check-skill-fork-honesty.mjs`,
`anno-tools.ts`'s two `DENY_LIST` comment citations (§8 of RESEARCH — rewrite to describe the
pattern in the abstract, do not delete).

## No Analog Found / Flags for the Planner

| Item | Why no analog | Flag |
|---|---|---|
| Criterion-3 acceptance record's FINAL placement (PROJECT.md vs new `docs/` file vs both) | Open decision (RESEARCH Open Question 2), not a code shape | Planner/owner must decide at Wave 0 — the PROJECT.md Out-of-Scope bullet style above is the template regardless of placement |
| `capability-registry.ts` disposition: delete-with-migration vs. repurpose-in-place | RESEARCH explicitly flags this `[ASSUMED]` | If the owner prefers repurposing, `capabilityRefusalMessage()`'s fork-redirect text still must go (RESEARCH §6: it becomes "actively false") regardless of which disposition is chosen |
| `vice-proxy.ts`/broker cross-check deletion (RESEARCH Open Question 3) | No existing "always-agrees liveness stub" pattern in this tree to copy | Read `resolvedBackend()`'s "unknown" branch during Wave 3 before deciding delete-outright vs. simplify-to-binary-found-check |
| **Riskier-than-assumed flag:** `vice.ts`'s `activeInstance`/`useInstance` — RESEARCH found these are load-bearing for STOCK's own lease path (`buildHeldLease()`), not fork-only as the ROADMAP Notes implied | This is exactly the kind of misclassification a pattern map should surface: the "closest analog" for these two functions is NOT "fork transport, delete" but "shared infra, split" — confirmed already in RESEARCH §2, restated here because it is the single highest-risk misread in this phase |

## Metadata

**Analog search scope:** `src/mcp/vice/*.ts`, `src/mcp/vice/*.mts`, `scripts/*.mjs`,
`src/skills/**/*.md`, `.planning/PROJECT.md`, `.planning/ROADMAP.md`
**Files read directly this pass:** `repo-root.ts`, `hostpath.ts`, `stock-paths.ts`, `host-tool.mts`,
`docs-fork-decision.test.ts`, `check-skill-fork-honesty.mjs`, `vice-wedge-triage/SKILL.md`,
`PROJECT.md` (targeted sections), `ROADMAP.md` (Phase 32, 51 sections)
**Pattern extraction date:** 2026-09-11
