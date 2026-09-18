# Phase 59: The Tool-Location Seam and Its Precedence Order - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-18
**Phase:** 59-the-tool-location-seam-and-its-precedence-order
**Areas discussed:** Placement of the x64sc authority, Where env-var names live, Directory-rooted tools, Refusal granularity

Gray-area selection: all four presented areas were selected (multiSelect).

---

## Placement of the x64sc authority

### Q1 — Where does the `tools.json` step go for x64sc?

| Option | Description | Selected |
|--------|-------------|----------|
| Seam wraps it, no backend-detect edit | Seam owns env + file for all eight; calls `resolvedBackend()` for x64sc only when both are silent. Phase 59 touches no existing host-bound module, so Phase 60 keeps its "first regeneration" deliverable. | ✓ |
| `resolvedBackend()` gains the file step internally | Stays sole x64sc authority; seam delegates x64sc to it. Costs Phase 60's first-regeneration deliverable and special-cases 1 of 8 tools. | |
| Split location out of `resolvedBackend()` now | Reduce it to identity/capability caching; seam owns location for all eight. Cleanest, but pulls Phase 60's refactoring forward. | |

**User's choice:** Seam wraps it, no backend-detect edit (the recommended option).
**Notes:** Deciding factor presented was Phase 60's cross-cutting constraint calling itself "the **first** regeneration of the committed `resources/*.mjs` artifacts" — adding a new artifact is an addition, editing `backend-detect.mts` is an early regeneration. Became CONTEXT D-01, including the mandated statement of what the choice costs Phase 60.

### Q2 — Who owns the `$PATH` walk?

| Option | Description | Selected |
|--------|-------------|----------|
| Seam exports it; Phase 60 collapses the copies | Seam owns the walk as a named export, never calls `resolvedBackend()`, stays read-only. Three copies coexist for one phase, stated as transitional in the module header. | ✓ |
| Seam calls `resolvedBackend()` for x64sc's third layer | One authority immediately, capability cache stays warm. Costs a disk write and a process-lifetime memo on a location query. | |
| Seam keeps a private copy, no export | Smallest surface. Costs Phase 60 rediscovering that three copies exist. | |

**User's choice:** Seam exports it; Phase 60 collapses the copies (recommended).
**Notes:** Context presented — this tree already has two copies of the same loop, and `findSiblingBinary`'s own comment says it "mirrors `defaultResolveBinPath()`'s own algorithm". Became D-02.

### Q3 — Does the seam cache its answers?

| Option | Description | Selected |
|--------|-------------|----------|
| No cache — re-resolve every call | No fifth global-state module, no reset hatch, and Phase 61's doctor is truthful for free. | ✓ |
| Module-level memo with a test reset hatch | Follows the `backend-detect.mts` / `findSiblingBinary` precedent. Costs a fifth global-state module and a doctor that must reset to be truthful. | |
| Caller-supplied cache object | Matches the injection convention, no global state. Costs a parameter at every Phase 60 callsite. | |

**User's choice:** No cache (recommended).
**Notes:** Two arguments presented — `CLAUDE.md` enumerates exactly four modules holding global state, so a fifth is an architecture-record change; and the stated reason `findSiblingBinary` memoises evaporates once the seam stops calling `resolvedBackend()`. Became D-03.

### Q4 — How does the result express which source answered?

| Option | Description | Selected |
|--------|-------------|----------|
| Two fields — `layer` plus `mechanism` | `layer` is the three things a user can fix; `mechanism` is the specific one of six. Each consumer reads the field it needs. | ✓ |
| One six-value union | Flat and truthful; the refusal must map six values back to three layers itself. | |
| One four-value union matching `DOCTOR-03` | Seam and doctor agree by construction, but "probe" would mean three different searches. | |

**User's choice:** Two fields (recommended).
**Notes:** A table was presented showing the tree has six distinct location mechanisms where `DOCTOR-03` names four — `acme-lib`'s fixed-prefix list and `dxa`'s vendored path are the two unnamed ones. Became D-04.

---

## Where env-var names live

### Q1 — What shape carries the env-var names and the two exclusions?

| Option | Description | Selected |
|--------|-------------|----------|
| One `location` block per record in the declaration | `{ envVar?, fileOverridable, reason? }`; dxa/node carry `fileOverridable: false` plus a reason the refusals quote verbatim. | ✓ |
| Flat `envVar` field plus a separate `overridable` flag | Flatter to assert on, but the two facts can contradict (node has an env var *and* is not overridable). | |
| Seam owns the table; declaration untouched | Phase 58's artifact stays as shipped. Costs two places naming tools — the disagreement this milestone exists to remove. | |

**User's choice:** One `location` block per record (recommended).
**Notes:** Research presented: an optional additive field is the canonical backward-compatible schema change and owes no version bump, and is moot here since no shipped code reads the file yet — so `schemaVersion` stays `1`, recorded rather than asked. Became D-05.

### Q2 — Do `c1541` and `petcat` get environment variables of their own?

| Option | Description | Selected |
|--------|-------------|----------|
| No — `tools.json` only, absence recorded | `LOC-04` is closed by the file; new env vars are unscoped permanent public API. | ✓ |
| Invent `C1541_BIN` and `PETCAT_BIN` | Uniform layer 1 for CI and tests. Costs two permanent public env vars. | |
| One `VICE_TOOLS_DIR` for all three VICE binaries | One variable instead of two, matching how VICE ships. Costs a precedence rule against `VICE_BIN`. | |

**User's choice:** No — `tools.json` only (recommended).
**Notes:** The Out of Scope table was checked first and says nothing about new env vars, so this was genuinely open. Factual point presented: `VICE_BIN` already relocates all three together, because `findSiblingBinary`'s first candidate is `dirname(resolvedX64scPath)`. Became D-06.

---

## Directory-rooted tools

### Q1 — How does the seam handle the two tools whose path is a directory?

| Option | Description | Selected |
|--------|-------------|----------|
| Records declare a `kind`, with a `marker` for directories | Validation branches on kind; the seam returns the directory, not the marker, which is what both callsites already want. | ✓ |
| Uniform path-plus-optional-marker, no `kind` field | Fewer fields, one validation path. Nothing in the type distinguishes must-be-a-directory from must-be-a-file. | |
| Narrow the seam to executables only | Smallest scope and `LOC-06`'s triad holds literally. But ghidra is the tool most in need of the file. | |

**User's choice:** Records declare a `kind`, with a `marker` (recommended).
**Notes:** A table was presented showing how each of the eight tools proves validity today, with two findings: `LOC-06`'s "or a directory" clause is the *correct* state for two of eight tools, and `LOC-06`'s "not executable" clause has no precedent in the tree at all — nothing currently checks the executable bit. Produced D-07 and the explicit CRITERION AMENDMENT to `LOC-06` recorded in CONTEXT.md.

### Q2 — Which layers does the validation apply to?

| Option | Description | Selected |
|--------|-------------|----------|
| File layer only | `LOC-06` is satisfied literally; `LOC-03`'s "nothing changed" becomes trivially true; the file is the one layer with an actionable remedy. | ✓ |
| All three layers, uniformly | Validation is not layer-dependent. Costs new behaviour on the env layer, which `LOC-03` protects. | |
| File refuses; env and probe warn and proceed | Every layer checked, one fatal. Costs a third behaviour, and a warning nobody reads is close to silent fall-through. | |

**User's choice:** File layer only (recommended).
**Notes:** `LOC-06`'s exact wording ("A **`tools.json` entry** naming a path…") was quoted as the scoping evidence. Became D-08.

---

## Refusal granularity

### Q1 — How wide is the failure when one entry is bad?

| Option | Description | Selected |
|--------|-------------|----------|
| Per-tool — only that id is refused | Loud but scoped; matches every existing refusal in `host-tool.mts` and lets the doctor print a truthful row per tool. | ✓ |
| Whole file fails closed | Strongest reading of fail-loudly. One typo makes the plugin unusable and damages the doctor most. | |
| Whole file ignored, loudly, resolution continues | Nothing breaks, nothing silent. But correct entries stop taking effect because of an unrelated typo. | |

**User's choice:** Per-tool (recommended).
**Notes:** Research presented: the cross-tool CLI consensus is that an explicit override pointing at nothing must fail loudly and never fall through to the search order — which settles loud-vs-silent but not how wide the failure is. Became D-09.

### Q2 — Where do file-level refusals surface?

| Option | Description | Selected |
|--------|-------------|----------|
| Two exports — resolve one tool, or judge the file | `resolveTool(id)` walks the layers; `validateToolsFile()` judges the file and resolves nothing, so `DOCTOR-05`'s no-second-detection-path holds. | ✓ |
| One export resolving every declared tool at once | Doctor and dispatch cannot diverge. Costs walking `$PATH` for all eight to resolve one, on a seam decided not to cache. | |
| Per-tool resolve carries file-level problems too | No caller can miss them. Costs eight copies of one typo, handed to callers that cannot act. | |

**User's choice:** Two exports (recommended).
**Notes:** The prompt for this question was the consequence of Q1 — a per-tool resolve of `x64sc` never looks at a typo'd `"vice"` key, so under per-tool scoping nothing would ever report it. Became D-10.

### Q3 — How does a JSON file carry the required commentary?

| Option | Description | Selected |
|--------|-------------|----------|
| Reserved underscore keys, skipped by the validator | Strict `JSON.parse`, zero dependencies, one documented exemption rule. Costs a rule that no tool id may start with `_`. | ✓ |
| Strip `//` comments before parsing | A real commented template. Costs a hand-rolled stripper or a third runtime dependency. | |
| Plain JSON, commentary in a sibling file | No parser question. But criterion 4 wants the exclusion documented where a reader is looking — which is `tools.json`. | |

**User's choice:** Reserved underscore keys (recommended).
**Notes:** This question exists because criterion 4 and `DOCTOR-08` jointly require a *commented* `tools.json` template and JSON has no comments — and a `_comment` key would have tripped the unknown-key refusal just specified in Q2. Became D-11, rated one-way because it becomes part of the user-facing file format.

---

## Recorded Without Asking

Two items were resolved from the roadmap's own text rather than put to the user,
and are stated as such in CONTEXT.md:

- **Both exclusions are refused, not merely documented.** The phase goal says "the two deliberate exclusions are **refused and documented** rather than quietly ignored", so a `node` key is refused by name too, not only mentioned in prose. Criterion 3 spells out dxa only.
- **Phase 59 owns the template text; Phase 61 emits it.** A committed static example plus a doctor-written template is two templates that can disagree. Phase 59 commits no `tools.json.example`.

Also recorded rather than asked: `schemaVersion` stays `1` (additive optional
fields, and no shipped consumer of v1 exists yet).

## Claude's Discretion

The user selected the recommended option on all eleven questions and offered no
counter-proposal or free-text answer, so every decision in CONTEXT.md is Claude's
reasoning accepted rather than a user directive. Four smaller choices were made
without asking and are named in CONTEXT.md so the planner does not reopen them:
`accessSync(p, X_OK)` over mode-bit arithmetic; a `.mts` module importing
host-bound siblings as `.mjs`; tests using real temp directories and injectable
overrides rather than a mocking library; and file naming following the
domain-prefix convention but not the `host-tool-*` domain.

## Deferred Ideas

No scope creep was raised during discussion — every question stayed inside the
seam. The deferred list in CONTEXT.md is therefore made up of items surfaced by
the decisions themselves rather than by the user reaching outside the phase:
collapsing the three `$PATH`-walk copies and settling `resolvedBackend()`'s final
role (both Phase 60, per D-01/D-02); `C1541_BIN`/`PETCAT_BIN` and
`VICE_TOOLS_DIR` (declined in D-06); widening validation beyond the file layer
(scoped out by D-08); `DOCTOR-F2`'s per-machine location file; the carried-over
`CLAUDE.md` ACME-prefix correction from Phase 58; and the raw NUL byte found in
`src/mcp/vice/prerequisites.test.ts` during context gathering.

Two gray areas were surfaced and left open at the user's "ready for context"
call, and are recorded in CONTEXT.md's Specific Ideas as decisions still owed:
the `tools.json` value shape (string versus object values), and how the compiled
`resources/*.mjs` artifact resolves `../prerequisites.json`.
