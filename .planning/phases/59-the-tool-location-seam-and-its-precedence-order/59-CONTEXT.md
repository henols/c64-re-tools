# Phase 59: The Tool-Location Seam and Its Precedence Order - Context

**Gathered:** 2026-09-18
**Status:** Ready for planning

<domain>
## Phase Boundary

One new host-bound module that answers *where is this tool* for the eight ids
declared in `src/mcp/vice/prerequisites.json`, in one order — environment
variable, then `.c64-re-tools/tools.json`, then `$PATH` or a probe — and reports
which of the three answered. It owns its own refusal semantics: a bad file entry
is refused by name and the refusal says the file supplied it (`LOC-06`); a dxa
entry is refused by name with its reason (`LOC-05`); `VICE_BROKER_NODE` stays
environment-only and that exclusion is both refused and documented (`LOC-07`).
The module is compiled into `resources/` by the existing `build.ts` pipeline.

**The seam is not wired into anything this phase.** No live resolution path
calls it when Phase 59 ends; `host-tool.mts`, `backend-detect.mts` and every
callsite keep resolving exactly as they do today. That is Phase 60's whole
purpose and it is correct, not an oversight.

**Explicitly NOT in this phase:** `LOC-01`, `LOC-02`, `LOC-03`, `LOC-04` and
`DECL-03` (Phase 60); the doctor and its template emission (Phase 61); the
README generator (Phase 62). Also not in this phase: any edit to an existing
`.mts` module, for the reason recorded in D-01.

</domain>

<decisions>
## Implementation Decisions

### Placement — the answer criterion 5 mandates be recorded

- **D-01: The seam wraps `resolvedBackend()` externally. Phase 59 edits no
  existing host-bound `.mts` module.** The seam owns the environment and
  `tools.json` layers for all eight ids itself. For `x64sc` it does **not**
  delegate to `resolvedBackend()` at all (see D-02).

  **Why this shape rather than the internal one:** Phase 60's cross-cutting
  constraint calls itself "the **first** regeneration of the committed
  `resources/*.mjs` artifacts". Any Phase 59 edit to `backend-detect.mts`
  regenerates `resources/backend-detect.mjs` early and takes that deliverable
  off Phase 60, in a phase the roadmap scopes as "a module with tests". Adding a
  *new* artifact to `HOST_BOUND_ARTIFACTS` is an addition, not a regeneration of
  an existing one.

  **What this costs Phase 60 in refactoring scope** (criterion 5's second half):
  1. `resolvedBackend()` keeps its own `env.VICE_BIN ?? "x64sc"` read
     (`backend-detect.mts:312`) for its current direct callers, so the precedence
     order for `x64sc` lives in two places until Phase 60 removes the second.
     Phase 60's criterion 2 ("the precedence order exists in exactly one place")
     is therefore a real deliverable of Phase 60, not something Phase 59 leaves
     already true.
  2. Phase 60 must decide there whether `resolvedBackend()` is reduced to
     identity/capability caching over a path handed to it, or keeps a location
     role. Phase 59 deliberately does not pre-empt that.
  3. Phase 60 regenerates `resources/backend-detect.mjs` and
     `resources/host-tool.mjs` as planned.
  — **Reversibility:** reversible — Phase 60 was always going to refactor these
  callsites; this only sets which phase pays for the regeneration.

- **D-02: The seam exports the `$PATH` walk, and the three copies are collapsed
  in Phase 60.** The seam owns the walk as a named export and uses it for every
  id's third layer. It never calls `resolvedBackend()`, so a location query stays
  read-only (no capability-cache write) and inherits no process-lifetime memo.
  The two existing private copies — `defaultResolveBinPath()`
  (`backend-detect.mts:204`) and `findSiblingBinary()`'s fallback loop
  (`host-tool.mts:2292`), whose own comment already says it "mirrors
  `defaultResolveBinPath()`'s own algorithm" — stay untouched this phase. Three
  copies coexist for exactly one phase, and the seam's module header must say so
  in as many words, naming Phase 60 as where they collapse. Phase 60 then has
  named work rather than rediscovered duplication.

- **D-03: The seam caches nothing. Every call re-resolves.** No module-level
  memo, no caller-supplied cache, no `resetForTests()` hatch. Two reasons. First,
  `CLAUDE.md`'s architecture record enumerates exactly four modules that hold
  global state (`stock-dispatch.ts`, `backend-detect.mts`, `broker-launch.mts`,
  `vice-proxy.ts`); a fifth is an architecture-record change, not an
  optimisation. Second, Phase 61's doctor must be truthful, and a doctor
  reporting a stale path is the one failure it may not have — no-cache makes that
  structural. The stated reason `findSiblingBinary()` memoises ("its first
  candidate is computed from a `resolvedBackend()` call that is itself memoised")
  does not apply to the seam, which calls `resolvedBackend()` never (D-02).

- **D-04: The result carries `layer` and `mechanism` as two separate fields.**
  `layer` is `"env" | "file" | "probe"` — the three things a user can actually
  fix, so `LOC-06`'s refusal reads the field that answers *which layer do I fix*.
  `mechanism` is the specific one: the env-var name, `tools.json`, `$PATH`,
  sibling-of-`x64sc`, fixed-prefix list, or project-vendored path. The tree has
  **six** mechanisms where `DOCTOR-03` names four; splitting the fields lets
  `DOCTOR-03`'s row stay truthful about `acme-lib`'s prefix list and `dxa`'s
  vendored path without inventing a fourth layer or overloading one word to mean
  three searches. Plus `tried: string[]`, matching the `{ path, tried }` shape all
  four existing probes already return.
  — **Reversibility:** costly — `DOCTOR-03`'s doctor row and every Phase 60
  refusal message read these fields; renaming or merging them later touches both
  phases plus this module's tests.

### Where the environment-variable names and the two exclusions live

- **D-05: Each `prerequisites.json` record gains an optional `location` block.**
  Shape: `{ envVar?: string, fileOverridable: boolean, reason?: string }`.
  `x64sc` → `VICE_BIN`; `acme` → `ACME_BIN`; `acme-lib` → `ACME`; `ghidra` →
  `GHIDRA_HOME`. `dxa` and `node` carry `fileOverridable: false` plus a `reason`
  string that the `LOC-05` / `LOC-07` refusals quote **verbatim** — so the
  refusal text is declared rather than authored in code, exactly as every remedy
  string already is (Phase 58 D-09).

  Rejected: a seam-side `const` table, which would have the doctor printing an
  env-var name sourced from code beside a remedy sourced from the file — the
  precise disagreement this milestone exists to remove. Also rejected: flat
  `envVar` + `overridable` as two independent top-level fields, since "has an
  env var" and "is file-overridable" are separate facts that can contradict
  (`node` has an env var *and* is not file-overridable), which a nested block
  keeps coherent and a flat pair leaves to a test to police.

  `schemaVersion` stays **`1`**. An optional additive field is the canonical
  backward-compatible schema change, and it is moot here regardless: no shipped
  code reads `prerequisites.json` yet, so there is no older consumer to break.
  — **Reversibility:** costly — Phase 60's refusal wiring, Phase 61's doctor and
  Phase 62's generator all walk this tree; reshaping the block later is a change
  to three consumers plus every record.

- **D-06: `c1541` and `petcat` get no environment variables of their own.**
  `LOC-04` is closed by `tools.json`; `LOC-03` names exactly four env vars that
  must keep winning, and `C1541_BIN` / `PETCAT_BIN` would be new permanent public
  API this milestone did not scope. Their records **omit** `envVar`, and the
  absence must read as deliberate: the doctor says "no environment variable — use
  `tools.json`". Note that `VICE_BIN` already relocates all three together for
  the common case, because `findSiblingBinary()`'s first candidate is
  `dirname(resolvedX64scPath)` and that path came from `VICE_BIN`. Also rejected:
  a single new `VICE_TOOLS_DIR` naming the directory holding all three — a fifth
  env var whose interaction with `VICE_BIN` would need its own precedence rule.

### What a declared path names, and when it is validated

- **D-07: Records declare a `kind`, and a directory record declares its
  `marker`.** `kind` is `"executable" | "directory"`. The two directory tools
  carry their existing marker paths: `acme-lib` → `cbm/c64/vic.a`
  (`host-tool.mts:2205`), `ghidra` → `support/analyzeHeadless`
  (`host-tool.mts:1358`). Validation branches on `kind`: an executable must be a
  statable file; a directory must be a statable directory that contains its
  marker. **The seam returns the directory itself, never the marker** — which is
  what both existing callsites already want (`findAcmeLib()` returns the dir and
  the callsite joins the marker; `ghidra.analyze` joins
  `support/analyzeHeadless` itself), so Phase 60 stays a rewiring rather than a
  reinterpretation.

  Rejected: narrowing the seam to executables and leaving both directory tools
  environment-only. `ghidra` is the tool most in need of the file — it installs
  at non-standard paths, is never on `$PATH`, and today refuses outright when
  `GHIDRA_HOME` is unset, so `tools.json` is its first non-environment route.
  — **Reversibility:** costly — same three consumers as D-05, plus both
  directory callsites in Phase 60.

- **CRITERION AMENDMENT (`LOC-06`).** `LOC-06` as written refuses a path that is
  "absent, **not executable, or a directory**". For `acme-lib` and `ghidra` a
  directory is the *correct* state, so the clause is inverted for two of eight
  tools. The requirement is amended explicitly rather than reinterpreted:
  *a `tools.json` entry is refused by name when the path is absent, or is not
  what its record's `kind` declares, or — for a `directory` kind — does not
  contain its declared marker; and the refusal says the file supplied it.* The
  planner must not read the original wording literally and build a triad that
  refuses `ghidra`.

- **D-08: Validation applies to the file layer only.** Only a
  `tools.json`-supplied path is validated and refused. The environment and probe
  layers keep today's `existsSync`-only behaviour. `LOC-06` is written against
  the file layer in as many words ("A **`tools.json` entry** naming a path…"),
  and this makes `LOC-03`'s "nothing changed for anyone who already had it
  working" trivially true rather than something Phase 60 has to measure. It also
  keeps the executable-bit check off a layer where it has no precedent: **nothing
  in this tree currently checks the executable bit at all** — every existing
  probe is `existsSync` only — so applying it to `VICE_BIN` would newly refuse
  setups that today reach spawn. Phase 61's doctor may still *report* on all
  three layers; reporting is not refusing.
  — **Reversibility:** costly — widening validation to the env layer later is a
  behaviour change for existing setups, which is exactly what `LOC-03` protects.

### Refusal semantics

- **D-09: One bad entry refuses one tool.** A malformed `acme` entry refuses
  `acme` by name and nothing else; `x64sc` still resolves through the file. This
  is loud, not silent — it simply never falls through *for that tool*. It matches
  every existing refusal in `host-tool.mts`, all of which are scoped to one tool
  id and name it, and it is what lets Phase 61's doctor print a truthful row per
  tool, which is the doctor's entire job.

  Rejected: whole-file fail-closed (one typo makes the plugin unusable, and the
  doctor — whose job is to say which line is wrong — is most damaged by an
  all-or-nothing read) and whole-file-ignored-loudly (a user's *correct* entries
  stop taking effect because of an unrelated typo).
  — **Reversibility:** costly — `DOCTOR-03`'s per-row output depends on it.

- **D-10: Two exports, and only two.** `resolveTool(id, …)` walks the three
  layers for one id. `validateToolsFile(…)` judges the file alone and returns
  every file-level problem — an unknown key checked against the declaration's own
  key set, a refused `dxa` or `node` entry, a malformed top level, unparseable
  JSON — **without resolving anything**. Live dispatch calls the first; Phase 61's
  doctor calls both. `DOCTOR-05`'s ban on "a second detection path for the
  doctor" is preserved because the validator detects nothing: it reads the file
  and judges it.

  This split exists because a per-tool resolve of `x64sc` never looks at a
  `"vice"` key, so under D-09 nothing would ever report a typo. Rejected: a
  single `resolveAllTools()` (resolving one tool would walk `$PATH` and stat for
  all eight, on a seam decided not to cache) and folding file-level problems into
  every per-tool result (eight copies of one typo, handed to callers that cannot
  act on them).
  — **Reversibility:** costly — Phase 60 and Phase 61 both consume this export
  surface.

- **D-11: Keys beginning with `_` are reserved for prose and exempt from the
  unknown-key refusal.** This resolves a direct conflict: `DOCTOR-08` asks for a
  "commented `tools.json` template" and criterion 4 requires the
  `VICE_BROKER_NODE` exclusion to be documented *in* it — but JSON has no
  comments, and a `_comment` key would otherwise trip D-10's unknown-key
  refusal. The template therefore ships `_readme` and a `_viceBrokerNode` entry
  explaining the exclusion where a reader editing the file actually looks. The
  file stays strict `JSON.parse` with **zero** new dependencies (this package's
  runtime dep set is exactly `@mastra/mcp` and `@mastra/core`, deliberately), and
  the exemption is one documented rule rather than a comment-stripping parser
  that must not corrupt a `//` inside a path string. A test must assert no
  declared tool id begins with `_`.
  — **Reversibility:** one-way — this becomes part of the user-facing
  `tools.json` file format. Withdrawing it after a released template has told
  users to write `_readme` would start refusing files this project told them to
  write.

### Recorded from the roadmap, not decided here

- **Both exclusions are refused, not merely documented.** The phase goal says
  "the two deliberate exclusions are **refused and documented** rather than
  quietly ignored". Criterion 3 only spells out dxa, but a silently ignored
  `node` key is exactly the failure the goal names. So a `node` key in
  `tools.json` is refused by name, and its message points at `VICE_BROKER_NODE`
  as the route, quoting the `reason` string from D-05's `location` block.

- **Phase 59 owns the template *text*; Phase 61 emits it.** A committed static
  example file plus a doctor that writes its own template is two templates that
  can disagree — the exact thing this milestone exists to remove. The template is
  therefore an export of this seam (a string, or a builder taking resolved
  paths), and `DOCTOR-08`'s doctor fills in paths it itself resolved. Phase 59
  does **not** commit a `tools.json.example`.

- **Path handling lives in the seam** (roadmap cross-cutting constraint): `~`
  expansion, a relative path resolved from the repo root, and the kind check all
  live here, and a resolved path is never interpolated into a shell string.

- **No static `repo-root.ts` import.** The seam takes the resolved tools
  directory as an explicit string parameter, exactly as `backend-detect.mts`
  already does for `supervisorDir`. `repo-root.ts:265`'s `toolsDir()` is the
  caller's business.

- **Never called from inside `broker-launch.mts`'s `inFlight` guard.** That guard
  stays a synchronous check-and-set with no `await` between.

### Claude's Discretion

The user answered the recommended option on all eleven questions and raised no
counter-proposal, so every D-NN above is Claude's reasoning accepted rather than
a user directive. The planner may revisit any of them on new evidence, but should
record the reversal the way this file records the original choice.

Four smaller choices were made without asking and are stated so the planner does
not re-open them as unknowns:

- **Executable-bit check, where D-08 applies one, uses `accessSync(p, X_OK)`**,
  not mode-bit arithmetic — the latter gets group and other wrong and ignores
  ACLs and effective uid.
- **A `.mts` module imports its host-bound siblings with a `.mjs` extension**
  (`host-tool.mts:124` imports `./backend-detect.mjs`). The new module follows
  that, and must be added to `HOST_BOUND_ARTIFACTS` (`build.ts:42`).
- **Tests use real temp directories and the module's injectable overrides.** This
  suite has no mocking library and the repo's convention is a destructured
  options object with injectable env/fs/spawn hooks.
- **File naming** follows the repo's domain-prefix convention; the planner picks
  the prefix, but it must not be `host-tool-*` (that domain is the MCP dispatch
  surface, not location).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### The requirements, their scoping, and the amendment
- `.planning/REQUIREMENTS.md` — `LOC-05`, `LOC-06`, `LOC-07` in full, plus
  `LOC-01`..`LOC-04` to see what Phase 59 must *not* close. **Read `LOC-06`
  together with this file's CRITERION AMENDMENT before implementing its triad.**
- `.planning/REQUIREMENTS.md` § "Out of Scope" — the "A dxa location override"
  and "`VICE_BROKER_NODE` moving into `tools.json`" rows are the two exclusions'
  authoritative reasons, and the text there is what D-05's `reason` strings
  should carry.
- `.planning/REQUIREMENTS.md` — `DOCTOR-03`, `DOCTOR-05`, `DOCTOR-08`. Phase 59's
  export surface and template ownership are shaped by all three; read them before
  changing D-04, D-10 or D-11.
- `.planning/ROADMAP.md` § "Phase 59" — the five success criteria and the three
  cross-cutting constraints.
- `.planning/ROADMAP.md` § "Phase 60" — especially its criterion 3 and its
  "**first** regeneration of the committed `resources/*.mjs`" constraint, which
  is the load-bearing reason for D-01.
- `.planning/ROADMAP.md` § "Sequencing Rationale (v1.1.0)" — the "One open design
  question is assigned rather than left to drift" paragraph assigns criterion 5's
  answer to this phase, and the no-opening-gate paragraph names "the refused
  `tools.json` entries in 59" as this phase's control observed going RED.

### Phase 58's declaration, which this seam reads
- `src/mcp/vice/prerequisites.json` — the eight records. `schemaVersion: 1`,
  keyed by tool id. **No record carries an env-var name today**; D-05 adds the
  `location` block.
- `.planning/phases/58-one-declaration-four-places-that-can-no-longer-disagree/58-CONTEXT.md`
  — D-03 (three-valued `provenance`), D-06 (OS-level platform keys), D-09
  (remedy strings are prose, never structured argv), D-12 (the file's name and
  placement). D-09 binds hardest: the strings this seam quotes must stay usable
  verbatim inside a refusal sentence.
- `docs/phase58-declaration-provenance.md` — why each remedy string reads as it
  does.

### The four probes this seam sits in front of (read, do not edit)
- `src/mcp/vice/backend-detect.mts:308-337` — `resolvedBackend()`. Its
  `env.VICE_BIN ?? "x64sc"` default at `:312`, its capability-cache write, and
  its module-level `memoisedResult`. D-01 and D-02 exist because of these.
- `src/mcp/vice/backend-detect.mts:204-216` — `defaultResolveBinPath()`, the
  first of the three `$PATH`-walk copies.
- `src/mcp/vice/host-tool.mts:2273-2311` — `findSiblingBinary()`, the second
  copy, its per-binary memo, and its `$PATH`-shadowing warning, which `LOC-04`
  requires survive Phase 60.
- `src/mcp/vice/host-tool.mts:2231-2245` — `findAcmeLib()`, the fixed-prefix
  mechanism and the `ACME_LIB_MARKER` directory check.
- `src/mcp/vice/host-tool.mts:2205` — `ACME_LIB_MARKER` = `cbm/c64/vic.a`.
- `src/mcp/vice/host-tool.mts:2223-2229` — `findDxaBinary()`, the vendored
  mechanism.
- `src/mcp/vice/host-tool.mts:126-131` — the module comment stating why dxa may
  never be overridden. This is `LOC-05`'s reason in its original wording.
- `src/mcp/vice/host-tool.mts:1344-1362` and `:2534-2556` — `GHIDRA_HOME` and its
  `support/analyzeHeadless` / `support/sleigh` directory checks. Note there is no
  `$PATH` or prefix fallback for Ghidra at all, by design.
- `src/mcp/vice/host-tool.mts:1292` — the `ACME_BIN` default.

### Build, packaging and the resolved-root seam
- `src/mcp/vice/build.ts:42-53` — `HOST_BOUND_ARTIFACTS`. The new module's
  compiled name goes here. Read the surrounding header on staging and atomic
  rename before touching it.
- `src/mcp/vice/resources-sync.test.ts` — the byte guard that fails CI on drift.
- `src/mcp/vice/prerequisites.test.ts` — **the one authoritative structural gate
  over `prerequisites.json`**, and where D-05's and D-07's new fields must be
  validated. Read its header first: it explains that
  `scripts/check-npm-packages.mjs` was **retired** in `d0e9fb2e` and `scripts/`
  no longer exists, that `DECL-05`'s packaging proof therefore lives here off
  `npm pack --dry-run --json` (`:356`), and that every validator is a named
  export so the real document and a *planted violation* run the same code
  (`:302`, `:307`, `:317`) — the §6 non-vacuity idiom this phase's refusal tests
  should copy. It also shows the `build()`-before-importing-the-artifact idiom
  and the type-only-`.mts`-import caveat, both relevant to Specifics #2.
  **This file contains a raw NUL byte — see the warning below.**
- `src/mcp/vice/package.json` — `files[]` already lists both `prerequisites.json`
  and `resources`; `engines.node` is `>=24.0.0`; `dependencies` is exactly two.
- `src/mcp/vice/repo-root.ts:265-273` — `toolsDir()` and `supervisorDir()`. The
  seam must not import these; the caller resolves and passes a string.

### Standing project constraints
- `CLAUDE.md` § Constraints — the "External tools are **never** auto-installed"
  bullet (detect, then refuse by name with the remedy in the message) and the
  "Global state lives in four modules" architecture record, which D-03 declines
  to extend.
- `.planning/ENGINEERING_RULES.md` §6 (non-vacuous verification) — every refusal
  test in this phase needs a planted violation observed failing; a refusal that
  cannot be observed firing is documentation.
- `.planning/ENGINEERING_RULES.md` §10 (architecture compliance), §14 (broker /
  process safety — the `inFlight` guard), §17 (required verification).
- `.planning/codebase/CONVENTIONS.md` — the `.mts`-versus-`.ts` rule, the
  domain-prefix file-naming rule, and the destructured-options injection rule.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **The `{ path, tried }` result shape.** All four existing probes
  (`findAcmeLib`, `findDxaBinary`, `findSiblingBinary`, and `resolvedBackend`'s
  `binPath`/`binPathResolved` pair) already return "what I found plus everything
  I looked at". D-04's result type is that shape widened with `layer` and
  `mechanism`, not a new idea.
- **`resolvedBackend()`'s injection surface** (`ResolvedBackendDeps`) is the
  model for the seam's own options object: `env`, `resolveBinPath`, `stat`, `now`,
  each overridable, no mocking library needed. Note its `resolveBinPath` returns
  `string | null` and so cannot carry `layer`/`mechanism` — it is a model, not a
  hand-off point.
- **`findSiblingBinary()`'s warning idiom** — a `log?: (line: string) => void`
  callback that names the resolved `x64sc`, the `$PATH` match and the hazard.
  Reuse it verbatim; `LOC-04` requires the warning survive Phase 60.
- **Committed JSON data files read with `JSON.parse`:** `anno-regbits.json`,
  `tools-manifest.stock.json`, `prerequisites.json`. Three precedents, zero
  dependencies between them.

### Established Patterns
- **Refuse by name, with the remedy in the message.** Every refusal in
  `host-tool.mts` names the tool id and carries the remedy. D-09's per-tool blast
  radius is that pattern, not a departure from it.
- **Assert relations, not counts — and the gate that already does it.**
  `src/mcp/vice/prerequisites.test.ts:249` is titled "all eight required tool ids
  are present (**subset relation** over the required set, never a record count)".
  That file is the one authoritative structural gate over the declaration, so
  D-05's `location` block and D-07's `kind`/`marker` are validated **there**, not
  in a new gate. Assert relations — every `location.envVar` is a plausible
  env-var name, no tool id starts with `_`, every `kind: "directory"` record has
  a `marker` — never a literal record count.
- **Generated but committed.** `build.ts` compiles the new `.mts` into
  `resources/`, and that output is committed. `resources-sync.test.ts` fails CI
  on drift. Adding an artifact is an addition; regenerating an existing one is
  Phase 60's (D-01).
- **Prefer a structured result over a throw.** `ViceError`
  (`src/mcp/vice/vice-errors.ts:158`) exists, but every probe in this domain
  returns a result and throws nothing. The seam follows that: a refusal is a
  field on a returned value, with a `reason` holding prose a caller shows a user.

### Integration Points
- `src/mcp/vice/build.ts:42` — one new entry in `HOST_BOUND_ARTIFACTS`.
- `src/mcp/vice/prerequisites.json` — the `location` block on all eight records
  (D-05) and `kind` / `marker` (D-07). Additive; `schemaVersion` stays `1`.
- `src/mcp/vice/resources/` — one new committed `.mjs` artifact.
- Everything else is a new file: the seam `.mts` and its colocated `.test.ts`.
- **Nothing else.** No existing `.mts` is edited, by D-01.

</code_context>

<specifics>
## Specific Ideas

Two gray areas were surfaced and deliberately left open, because the user
declared ready for context. They are recorded here so the researcher and planner
treat them as decisions still owed rather than as settled:

1. **The `tools.json` value shape.** `{"x64sc": "/path"}` with string values, or
   `{"x64sc": {"path": "/path"}}` with object values leaving room for a future
   per-entry field? The string form is what a user would guess and what a
   hand-written file most likely contains; the object form is what `DOCTOR-F2`'s
   deferred per-machine layering would want. Whichever is chosen, D-11's reserved
   `_` prefix applies to the **keys**, and the choice is user-facing file format,
   so it carries the same one-way weight D-11 does.

2. **How the compiled artifact reaches the declaration.** `build.ts`'s `outDir`
   defaults to `"resources"` relative to `src/mcp/vice/`, so a compiled
   `resources/<seam>.mjs` resolves `prerequisites.json` as `../prerequisites.json`
   — and `build.ts` copies no data files. Both paths are in `package.json`'s
   `files[]`, so the published layout matches the repo layout, but the seam must
   resolve the declaration relative to `import.meta.url` at the *compiled*
   location, and that has to be proved rather than assumed. The technique is
   already in the tree: `src/mcp/vice/prerequisites.test.ts:356` proves
   `DECL-05` off `npm pack --dry-run --json` — the packed tarball's **own** file
   list, never a repo-path `existsSync`. Extend that case rather than writing a
   new gate.

One finding worth carrying as a specific rather than a decision: **criterion 4
and `DOCTOR-08` jointly require a commented JSON file, and JSON has no
comments.** D-11 resolves it, but the planner should know the conflict was real
and was resolved deliberately, not that the reserved-underscore rule appeared
from nowhere.

</specifics>

<deferred>
## Deferred Ideas

- **Collapsing the three `$PATH`-walk copies.** D-02 leaves them coexisting for
  one phase on purpose. Phase 60 owns the collapse, and D-02 requires the seam's
  module header say so by name so it is not rediscovered as duplication.
- **Deciding `resolvedBackend()`'s final role** — whether it is reduced to
  identity and capability caching over a path handed to it, or keeps a location
  role. Explicitly Phase 60's, per D-01.
- **`C1541_BIN` / `PETCAT_BIN` environment variables.** Declined for this
  milestone (D-06). If ever wanted, the argument is a uniform layer 1 for CI and
  test invocations; the cost is two permanent public env vars.
- **A single `VICE_TOOLS_DIR`** naming the directory holding `x64sc`, `c1541` and
  `petcat`. Rejected in D-06 for needing its own precedence rule against
  `VICE_BIN`. Recorded because it is the tidier design if new env vars are ever
  taken up.
- **Widening validation to the environment and probe layers.** D-08 scopes it to
  the file layer. If ever taken up, it is a behaviour change for existing setups
  and belongs in a phase that can measure `LOC-03`-style unchanged-behaviour
  evidence, not in a phase that asserts it.
- **A per-machine `~/.config/c64-re-tools/tools.json`** layered beneath the
  project-local one — already `DOCTOR-F2` in REQUIREMENTS.md § Future
  Requirements.
- **Correcting `CLAUDE.md`'s stale ACME-prefix citation** — carried over
  unresolved from Phase 58's deferred list (its D-02). Still real, still needs
  its own task touching both `CLAUDE.md` and `.planning/PROJECT.md`, since a
  CLAUDE.md-only edit is wiped on the next regeneration.

- **A raw NUL byte hides `prerequisites.test.ts` from plain `grep`.**
  Line 261 writes a `.join()` separator as a *literal* NUL rather than the
  escape `\0`, so `grep` classifies the file as binary and skips it **with no
  warning** — `grep -c ""` returns nothing, `grep -n "npm pack"` returns nothing,
  while `head` and `grep -a` read it fine. The test itself is correct and
  passing; the cost is census invisibility. Two consequences for this phase:
  **(1)** any content census the researcher or planner runs over the
  declaration's gate must use `grep -a`, or it will silently conclude the gate
  does not exist — this already happened once while gathering this context;
  **(2)** `CLAUDE.md`'s architecture record names exactly one such file
  (`src/mcp/vice/anno-memmap-render.ts`) and there are now **two**. Replacing the
  literal with the escape, and correcting `CLAUDE.md` plus `.planning/PROJECT.md`,
  is a small task that is **not** a Phase 59 deliverable — it touches a Phase 58
  artifact and the mirrored constraint list, exactly like the deferred ACME-prefix
  correction above.

### Reviewed Todos (not folded)

`todo.match-phase 59` returned fifteen matches. The three highest-scoring (0.9)
are broker-lifecycle items matching on `broker` / `path` / `vice` / `launch`
keyword overlap alone — "Reap vicerc scratch dirs in broker kill/recycle path",
"Remove pre-warm; launch VICE only on first request", "Remove anno from the MCP
surface". None touches tool location, prerequisite declaration or path
precedence. The remaining twelve score 0.6 or below on the same generic overlap.
**None folded.** Two are worth naming so a later phase does not think they were
missed:

- **"BACK-05 D-G ordering test fails deterministically on a live-broker host"** —
  not a phase deliverable, but it is an environment hazard for anyone running the
  suite while a broker is up. Relevant to how Phase 59's tests are *run*, not to
  what they assert.
- **"Fix stale 'six skills' count — nine ship"** — adjacent because
  `prerequisites.json`'s `unblocks.skills` already enumerates all nine. Phase 59
  does not close it and must not be read as having done so.

</deferred>

---

*Phase: 59-the-tool-location-seam-and-its-precedence-order*
*Context gathered: 2026-09-18*
