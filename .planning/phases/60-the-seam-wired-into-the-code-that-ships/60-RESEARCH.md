# Phase 60: The Seam Wired Into the Code That Ships - Research

**Researched:** 2026-09-18
**Domain:** Internal refactor — rewiring existing host-bound resolution callsites through an
already-shipped seam (`tool-location.mts`); no new external package, no new protocol, no new
runtime dependency.
**Confidence:** HIGH for the callsite inventory (all claims below are `[VERIFIED: file:line]` —
read this session, this phase, no external ecosystem survey required). MEDIUM for the shape of the
wiring itself, since Phase 59 deliberately left the exact rewiring mechanics ("resolvedBackend()'s
final role") as an open question for this phase to answer, not something research can answer in
its place.

## Summary

Phase 60 has no new technology to research. Its entire domain is five files this project already
owns — `backend-detect.mts`, `host-tool.mts`, `broker-launch.mts`, `vice-broker.mts`,
`vice-proxy.ts` — and one seam this project shipped one phase ago, `tool-location.mts`, which
today nothing calls. The research task was therefore not "what library should we use" but "map
every place a tool's location or a tool's absence is decided today, with `file:line`, so the
planner does not discover a fourth undocumented copy mid-execution the way this session found one."

That fourth copy is the single most load-bearing finding here: **the actual `x64sc` spawn does
not go through `resolvedBackend()` at all.** `resolvedBackend()` (`backend-detect.mts:308-337`) is
called from exactly two production sites (`vice-proxy.ts:319`, `vice-broker.mts:1142`, both once,
both for identity/reporting) plus twice more inside `host-tool.mts` (`c1541`/`petcat` sibling
probes). The emulator's own spawn command — `spawnFn(viceBin, viceArgs)` at
`broker-launch.mts:517` — reads its `viceBin` from a **third, independent** expression,
`deps.viceBin ?? process.env.VICE_BIN ?? "x64sc"`, duplicated verbatim at
`broker-launch.mts:445` (`spawnAndRecordInstance`) and `broker-launch.mts:1523`
(`launchSupervised`), and a **fourth**, `vice-broker.mts:224`'s `resolveViceBinForHostState()`,
used only for the `host_state` reporting field. None of these three/four call `resolvedBackend()`,
so a `tools.json` entry for `x64sc` wired only into `backend-detect.mts` would leave the emulator
you actually launch untouched — `LOC-01`'s "honoured by the code that runs, not only by a test
calling the seam directly" would still fail for the single highest-value tool in the declaration.
Worse: `spawnAndRecordInstance()`'s VICE_BIN read executes **inside** `broker-launch.mts`'s
`inFlight` synchronous check-and-set window (`tryLaunchOne()`: `broker-launch.mts:573-581`;
`acquirePortAndLaunch()`: `broker-launch.mts:677-684`), which is exactly the site both Phase 59's
and Phase 60's own cross-cutting constraints warn a planner never to call the seam from inside.
The resolution this evidence points to — confirmed by the fact that `deps.viceBin` is already a
plumbed-through, currently-unpopulated override on both functions — is to resolve `x64sc` through
the seam **once, before** `acquirePortAndLaunch()`/`tryLaunchOne()` is ever called (the same "once
per process" posture `resolvedBackend()` already has), and thread the resolved string down through
the existing `deps.viceBin` parameter rather than calling the seam from inside the guard.

**Primary recommendation:** Resolve every tool id through `resolveTool()` at the natural "once per
process, before any guarded critical section" point each callsite already has — `vice-broker.mts`'s
startup (already resolves `x64sc`'s identity there via `resolvedBackend()`; add the seam call
alongside it and thread the winning path down through `deps.viceBin`), and `runHostTool()`'s own
per-request entry in `host-tool.mts` (which already computes `repoRootAbs` from `deps.repoRoot`
and can derive `toolsDir`/`projectRoot` from it) for `acme`, `acme-lib`, `ghidra`, `c1541` and
`petcat`. Do not attempt to make `resolvedBackend()` itself the seam's only caller — three other
call sites bypass it entirely today, and closing only that one would leave `LOC-01`'s criterion
technically true for identity-reporting and false for the thing a user actually experiences: what
gets spawned.

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LOC-01 | A user can record a tool's absolute path in `.c64-re-tools/tools.json` and have every code path that resolves that tool honour it | Item 2's callsite table names every current resolver and which of `env`/`tools.json`/`$PATH` it implements today; the Summary's "fourth copy" finding identifies the specific gap (the emulator spawn path bypasses `resolvedBackend()` entirely) that must close for this to be true of the code that actually runs, not just of a seam call |
| LOC-02 | One resolver seam owns the precedence order; both the doctor (Phase 61) and live dispatch resolve through it | Item 2's table plus Pitfall 1/Anti-Patterns name every place an independent `env.VAR ?? default` expression exists today, so the planner can enumerate exactly what must collapse; Validation Architecture proposes a structural closed-consumer-set test to keep it collapsed |
| LOC-03 | `VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME` still win over the file; no existing test/CI/live-test invocation changes behaviour | Item 6 enumerates every test file, CI step and live-test invocation that sets one of the four vars today, making "unchanged" a measurable pre/post diff rather than an assertion; Pitfall 3 names the specific measurement mistake (`test:automated`) to avoid |
| LOC-04 | `c1541`/`petcat` become locatable via `tools.json` for the first time, sibling probe widened not replaced | Item 7 states `findSiblingBinary()`'s exact current memoisation/fallback/warning shape and what "widened, not replaced" must preserve; Open Question 1 flags the one real design decision (does the seam gain a `sibling-of-x64sc` mechanism, or does `findSiblingBinary()` stay a private helper extended in place) the planner must settle explicitly |
| DECL-03 | The remedy text a user sees comes from the declaration at every site that emits one | Item 3's per-tool table separates the two real cases: `dxa`/`ghidra` (two independently-authored strings to collapse to one) versus `acme`/`acme-lib` (no curated remedy exists today at all — new behaviour, not a text-source swap), which changes the scope and effort of the corresponding plan tasks |

</phase_requirements>

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Tool-location precedence (env → tools.json → $PATH/probe) | Host process (broker + host-tool executor) | — | Both real callers of a resolved binary path — the broker's own spawn and the host-tool executor's own spawn — run on the host, never in the container; the seam itself is host-bound (`build.ts`'s `HOST_BOUND_ARTIFACTS`) |
| Emulator launch (`x64sc` spawn) | Host broker (`vice-broker.mts` / `broker-launch.mts`) | — | Sole spawn site for the emulator binary per `CLAUDE.md`'s frozen one-member spawn set |
| Host-tool executor (`acme`/`ghidra`/`dxa`/`c1541`/`petcat`) | Host process (`host-tool.mts`, reached by two routes) | Container (dispatch only) | `host-tool.mts` (compiled to `resources/host-tool.mjs`) is the one executor; the container-side control-plane route and the host-side direct-spawn route both terminate in the same compiled module (`host-tool-client.ts:14-27`) |
| Remedy text (what to install/set to fix a missing tool) | Declaration (`prerequisites.json`) | Live refusal call sites (must read, never re-author) | `DECL-03`'s whole point: a site that authors its own remedy string is the disagreement this milestone exists to remove |
| Doctor / capability reporting | Not this phase | Phase 61 | Phase 60 must not grow a second detection path for the doctor to find already built (`DOCTOR-05`) |

## Live Callsite Inventory (the phase's actual research payload)

### 1. The seam as shipped in Phase 59 — `src/mcp/vice/tool-location.mts`

`[VERIFIED: src/mcp/vice/tool-location.mts]` (read in full this session).

- **Exports, exact signatures:**
  - `resolveOnPath(bin: string, env: NodeJS.ProcessEnv): { path: string | null; tried: string[] }` (`:227`)
  - `validateToolsFile(deps: ValidateToolsFileDeps): ToolsFileProblem[]` (`:334`)
  - `resolveTool(id: string, deps: ResolveToolDeps): ResolveToolResult` (`:436`)
  - `toolsFileTemplate(resolved: Readonly<Record<string, string>>, deps?: ToolsFileTemplateDeps): string` (`:701`)
- **`ResolveToolResult` shape** (`:88-107`): `{ id, path: string | null, tried: string[], layer: "env" | "file" | "probe" | null, mechanism: string | null, refusal: string | null }`. A refused id (undeclared, or `fileOverridable: false`) returns `path/layer/mechanism: null`, `tried: []`, and prose in `refusal`. A query that reached every layer and found nothing returns `refusal: null` too — a plain "not found" is not a refusal.
- **`resolveTool()`'s three layers, in order** (`:436-664`): env (`record.location?.envVar`, existence-only, `matchesDeclaredKind` check, no executable-bit check — D-08), then `.c64-re-tools/tools.json` (full `LOC-06` triad plus executable-bit via `accessSync(p, X_OK)`, and **terminal** — a bad file entry never falls through to `$PATH`), then `$PATH` walk (`resolveOnPath`) **for `kind: "executable"` ids only** — a directory-kind id gets no probe layer at all.
- **`ResolveToolDeps`** (`:116-155`): `toolsDir` and `projectRoot` are both **required** explicit strings (never derived from each other, never from a static `repo-root.ts` import); `env`, `exists`, `statKind`, `access`, `readFile`, `here`, `log` are all optional injectable overrides. `log` is declared but **not yet called by the module's own resolution logic** — it exists only for forward compatibility; a caller wanting `findSiblingBinary()`-style warning behaviour must still wire it up themselves after Phase 60's rewiring (see item 7 below).
- **`validateToolsFile()`'s refusal shapes** (`:334-423`): unparseable JSON, non-object top level, unknown key (not in the declaration's own key set, exact array-membership check — never bracket lookup, so a `__proto__`-shaped key refuses like any other unknown key), a `fileOverridable: false` id named at all (quotes `record.location.reason` verbatim), and a non-string/empty value. Keys beginning with a single underscore (`_foo`, not `__foo`) are silently skipped (D-11 reserved-prose rule). **Never resolves anything** — no `$PATH` walk, no stat beyond what a value-shape check requires.
- **Memoisation: none, by design (D-03).** No module-level memo, no `resetForTests()` hatch, no caller-supplied cache. Every call re-resolves from every layer from scratch. Proven by test (`tool-location.test.ts#no cache: a binary appearing on the injected PATH between two calls is found by the second call`).
- **Reset hatches the tests use:** none exist because none are needed — the module holds no state to reset. Tests instead inject fresh `deps` objects (scratch `env`, scratch `exists`/`statKind`/`access`/`readFile` closures over an in-memory or temp-directory fixture) per test case.
- **The declaration lookup** (`readDeclaration()`, `:195-203`): tries `join(here, "prerequisites.json")` then `join(here, "..", "prerequisites.json")`, first existing wins — this is what lets the same source file resolve the declaration correctly both unbuilt (`src/mcp/vice/`) and compiled (`src/mcp/vice/resources/`).
- **What the module's own header explicitly forbids a future editor from doing** (`:48-66`, read verbatim): do not call `resolvedBackend()` or import `backend-detect.mjs`/`host-tool.mjs` from *inside this file*; do not add a module-level memo or reset hatch; do not statically import `repo-root.ts`; do not interpolate a resolved path into a shell string or import `node:child_process`; do not hand-edit the compiled `resources/tool-location.mjs` artifact. **None of these forbid a *caller* — `backend-detect.mts`, `host-tool.mts`, `broker-launch.mts` — from importing `tool-location.mjs`.** The one-directional constraint is "the seam imports nothing sibling," not "nothing may import the seam."

### 2. Every live callsite that resolves a tool today

`[VERIFIED: file:line for each row below]`

| Site | File:line | Env var read | Ordering today | Memoised? | What changes under the seam |
|---|---|---|---|---|---|
| `resolvedBackend()` | `backend-detect.mts:308-337`, env default at `:312` (`const viceBin = deps.viceBin ?? env.VICE_BIN ?? "x64sc";`) | `VICE_BIN` | env → `$PATH` (via `defaultResolveBinPath`, `:204-216`) — no `tools.json` step | **Yes** — module-level `memoisedResult`, reset only by `resetResolvedBackendForTests()` (`:284`) | Would need a `tools.json` layer inserted between env and `$PATH`; the memo means it must be called at most once per process (matches D-03's "caller may memoise, seam itself never does") |
| `spawnAndRecordInstance()` | `broker-launch.mts:445` (`const viceBin = deps.viceBin ?? process.env.VICE_BIN ?? "x64sc";`), used at spawn call `:517` | `VICE_BIN` | env → hardcoded default `"x64sc"` — **no `$PATH` walk, no `resolvedBackend()` call at all** | No | This is the **actual emulator spawn**. Runs inside the `inFlight` guard (`tryLaunchOne()`, `:573-581`). Must receive its `viceBin` via the already-existing `deps.viceBin` override, resolved by a caller **before** entering the guard — never by calling the seam here. |
| `launchSupervised()` | `broker-launch.mts:1523`, used for the log filename (`:1530`) and threaded to `spawnAndRecordInstance()` via `deps.viceBin` (`:1556`) | `VICE_BIN` | Same expression as above, independently duplicated | No | Same fix as above — this is the crash-respawn path; `deps.viceBin` must be populated at the same call site that populates it for the fresh-launch path, or the two diverge on respawn |
| `resolveViceBinForHostState()` | `vice-broker.mts:223-225` | `VICE_BIN` | env → hardcoded `"x64sc"` | No | Reporting-only (`host_state.viceBin` field) — lowest-risk of the four, but still a fourth place the same default expression is authored |
| `findAcmeLib()` | `host-tool.mts:2231-2245` | `ACME` | Fixed candidate list: `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `$HOME/.acme` — first whose `cbm/c64/vic.a` marker exists wins | No (called fresh every `acme.build` invocation, `:2379`) | This resolves the ACME **standard library** (a directory), used only to append an include-path hint to ACME's own stderr (`:2740-2742`) — separate record (`acme-lib`) from the ACME binary itself |
| ACME binary path | `host-tool.mts:1292` (`const acmePath = process.env.ACME_BIN && process.env.ACME_BIN !== "" ? process.env.ACME_BIN : "acme";`) | `ACME_BIN` | env → bare `"acme"` string handed to `spawn()`, which resolves it against the **child process's own `$PATH`** — **no existence check happens in this codebase at all before spawning** | No | Today a missing ACME binary is not refused by name; it surfaces as a raw `spawn acme ENOENT`-shaped `spawnErrorMessage` (see item 3) |
| `findDxaBinary()` | `host-tool.mts:2223-2229`, called at `:1468` | none (project-vendored, no override — `LOC-05`) | Two-candidate join mirroring the compiled-vs-source split, first existing wins | No | Already correctly un-overridable; `resolveTool("dxa", …)` returns `refusal` unconditionally today per Phase 59's D-16 — Phase 60 must decide whether `findDxaBinary()` itself gets replaced by the seam's *mechanism* internals or stays a private helper the seam's `vendored-path` mechanism (not yet implemented — D-15) wraps |
| `GHIDRA_HOME` reads | `host-tool.mts:1348` (`ghidra.analyze`), `:1513` (`ghidra.installExtension`, duplicate at `:2534`) | `GHIDRA_HOME` | env-only, existence-and-marker check inline (`support/analyzeHeadless` / `support/sleigh`) — **no `tools.json` step, no `$PATH` fallback (by design — Ghidra has none)** | No | `ghidra-project.mts` itself does **not** read `process.env.GHIDRA_HOME` — its `installedLanguageIds(ghidraHome)` (`:438`) takes it as an explicit parameter (confirmed by reading `:410-421`); the three env reads are entirely in `host-tool.mts` |
| `findSiblingBinary()` | `host-tool.mts:2273-2311`, called at `:1555` (`c1541`) and `:1630` (`petcat`) | none — first candidate is *computed* from `resolvedBackend().binPath`, never an env var of its own (D-06: `c1541`/`petcat` get no dedicated env var) | sibling-of-x64sc → `$PATH` walk (mirrors `defaultResolveBinPath()`) | **Yes** — `siblingBinaryMemo`, a `Map<string, {...}>` keyed by binary name, per-process lifetime, **no reset hatch at all** (`:2260-2271`) | `LOC-04` requires this widen to check `tools.json` too; the memo must keep its current semantics per the cross-cutting constraint — "widening what it can resolve must not change when it caches" |

`stock-dispatch.ts` (`:181-207`, `:432-444`) and `vice-proxy.ts:319` are **readers** of `resolvedBackend()`'s already-resolved `binPath` (for `vice_ping`'s `resolvedBinaryPath` field) — not independent resolution logic, but they inherit whatever `resolvedBackend()` decides, so wiring `resolvedBackend()` into the seam automatically improves what `vice_ping` reports without touching either file.

**Route topology for `host-tool.mts`'s five reachable tools** (`acme`, `acme-lib`, `ghidra`, `c1541`, `petcat`, `dxa`): confirmed by reading `host-tool-client.ts:1-40, 255-290` that there are exactly two routes to `runHostTool()` — the container-side control-plane op (through the broker) and the host-side direct spawn of `resources/host-tool.mjs` (used by CI and any non-devcontainer host) — and **both terminate in the same compiled `host-tool.mjs`**. Rewiring `host-tool.mts`'s internals once covers both routes; there is no separate container-side copy of any of these five resolvers to find and fix.

### 3. Every site that emits a remedy message today, and DECL-03's actual scope

`[VERIFIED: file:line]`

| Tool | Refusal site | Current message source | Has a curated remedy today? |
|---|---|---|---|
| `dxa` | `host-tool.mts:1472` | Hardcoded JS template literal: `` `... -- run "bash vendor/dxa/build.bash build" to produce it` `` | Yes — and it happens to match `prerequisites.json`'s `dxa` remedy text (`:362`) **by coincidence of two independently-authored strings**, not by one reading the other |
| `ghidra.analyze` (unset) | `host-tool.mts:1348-1354` | Hardcoded: `` `requires the GHIDRA_HOME environment variable to name a Ghidra installation directory; it is unset` `` | Only implicitly — names the variable, does not say what to set it *to* or how to install Ghidra; `prerequisites.json`'s `ghidra` remedy (`:335`) is a paraphrase of this same sentence, not a shared source |
| `ghidra.analyze` (path missing) | `host-tool.mts:1359-1364` | Hardcoded, names the computed path | No install remedy at all |
| `ghidra.installExtension` (×2) | `host-tool.mts:1513-1525`, `:2534-2546` | Same two hardcoded messages, duplicated verbatim across two call sites | Same as above |
| `acme.build` (binary missing) | **No dedicated refusal exists.** `spawnHostTool()` (`:2122-2191`) catches the `spawn()` throw and returns `{ exitCode: null, spawnErrorMessage: e.message, ... }` — a raw OS-level `spawn acme ENOENT`-shaped string | — | **No.** This is the one tool with zero curated remedy today, not a disagreement between two remedies |
| `acme-lib` (directory missing) | No refusal — `findAcmeLib()` returning `null` only appends an extra hint line to ACME's *own* stderr complaint (`:2740-2742`), and only when ACME's own error text already matches `/ACME.*environment variable/i` | — | Conditional, ACME-error-text-dependent, not a standalone refusal |
| `c1541.*` | `host-tool.mts:1555-1560` (implied — `findSiblingBinary` returning `null` feeds into a refusal a few lines below; not directly read this session past `:1560`, planner should confirm exact message text) | Names tried paths, no install remedy | Partial |
| `petcat.decode` | `host-tool.mts:1630-1636` | `` `refuses: "petcat" does not exist (tried: ${petcatFound.tried.join(", ")})` `` | No install remedy, only tried-paths |

**What this means for `DECL-03`'s scope:** the roadmap frames `DECL-03` as "a live refusal and the doctor cannot name different remedies for the same tool" — implying a reconciliation of two existing texts. For `dxa` and `ghidra`, that framing holds: two independently-authored strings exist and must collapse to one (the declaration's), with the live refusal reading `prerequisites.json` at runtime rather than re-authoring the sentence. **For `acme` and `acme-lib`, there is no live remedy to reconcile — there is a raw OS error and a conditional hint.** Closing `DECL-03` for these two tools is closer to *adding* a curated pre-spawn existence check (through the seam) than *repointing* an existing one. The planner should treat `acme`'s ENOENT-shaped failure as in-scope for `DECL-03` even though the roadmap's own framing ("cannot name different remedies") does not obviously cover "names no remedy at all."

### 4. The declaration as Phase 58/59 left it — `src/mcp/vice/prerequisites.json`

`[VERIFIED: src/mcp/vice/prerequisites.json]` (read in full this session, 417 lines).

- `schemaVersion: 1` (unchanged since Phase 58; Phase 59 added `location`/`kind`/`marker` additively, per its own D-05).
- Eight tool ids: `x64sc`, `c1541`, `petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`.
- **`location` block per record** (`{ envVar?, fileOverridable, reason? }`):
  - `x64sc`: `{ envVar: "VICE_BIN", fileOverridable: true }`
  - `c1541`: `{ fileOverridable: true }` — **no `envVar`** (D-06)
  - `petcat`: `{ fileOverridable: true }` — **no `envVar`** (D-06)
  - `acme`: `{ envVar: "ACME_BIN", fileOverridable: true }`
  - `acme-lib`: `{ envVar: "ACME", fileOverridable: true }`
  - `ghidra`: `{ envVar: "GHIDRA_HOME", fileOverridable: true }`
  - `dxa`: `{ fileOverridable: false, reason: "dxa is vendored and built by this project, so an override could only select a binary it did not build and did not pin." }`
  - `node`: `{ fileOverridable: false, reason: "vice-launcher.sh is bash and reads VICE_BROKER_NODE before any working Node exists to parse JSON with." }`
- **`kind`**: `executable` for `x64sc`, `c1541`, `petcat`, `acme`, `dxa`, `node`; `directory` for `acme-lib` (`marker: "cbm/c64/vic.a"`) and `ghidra` (`marker: "support/analyzeHeadless"`).
- **Remedy text and provenance:** `x64sc`/`c1541`/`petcat` share the identical seven-ecosystem-plus-Windows remedy block, each tagged `carried` from `README.md:101-108`. `acme`'s remedy is tagged `measured` (`.github/workflows/ci.yml:78`) for Ubuntu and `carried` for Debian. `acme-lib`, `ghidra`, `dxa` and `node` each carry one `universal`/`generic` remedy, all tagged `carried` from a named `file:line` (`acme-build/SKILL.md:255`, `host-tool.mts:1352`, `host-tool.mts:1472`, `vice-launcher.sh:219` respectively).
- **Which ids carry remedy text callable at runtime today:** none of the eight records' `remedies` blocks are read by any shipped code path yet — they exist only as data. Only `location.reason` (for `dxa` and `node`) is already read at runtime, by `tool-location.mts` itself (`toolsFileTemplate()`'s `_dxa`/`_viceBrokerNode` keys, and `resolveTool()`'s own D-16 refusal text). Wiring the `remedies` arrays into a live refusal message is new work this phase has not been done anywhere yet — `DECL-03` is not "flip a switch," it is "add the first runtime reader of `remedies`."
- **`unblocks`** vocabularies are already enumerable and closed (nine skills, a fixed `host_tool` op-id set) — not itself part of Phase 60's scope, but worth knowing while touching this file: any structural test the planner adds should assert relations against `prerequisites.test.ts`'s existing helpers, never a new record count (this file's own `LOCATION_KEYS`/`assertLocationBlockShape` pattern at `prerequisites.test.ts:176-205` is the established idiom to extend, not replace).

### 5. The build pipeline and the sync guard

`[VERIFIED: src/mcp/vice/build.ts:42-53, src/mcp/vice/resources-sync.test.ts:1-60]`

- `HOST_BOUND_ARTIFACTS` (`build.ts:42-53`) currently lists eleven entries: `vice-broker.mjs`, `container-guard.mjs`, `broker-state.mjs`, `broker-launch.mjs`, `broker-kill.mjs`, `broker-epoch.mjs`, `broker-control.mjs`, `backend-detect.mjs`, `host-tool.mjs`, `ghidra-project.mjs`, `tool-location.mjs`. This list is asserted **exactly equal** to what `tsc` actually emits (`build.ts:194-207`) — an unexpected addition or a silent omission both fail loudly.
- Phase 60 will very likely need to regenerate **`backend-detect.mjs`** and **`host-tool.mjs`** (both already on the list — no new entry needed) as a direct consequence of editing their `.mts` sources. If the planner also edits `broker-launch.mts` or `vice-broker.mts` (both host-bound, both already listed), those two regenerate too. Editing `vice-proxy.ts` does **not** trigger a regeneration — it is a container-side `.ts` file, not in `HOST_BOUND_ARTIFACTS`, and runs under Node's native type-stripping like every other container-side module.
- `resources-sync.test.ts` (`:49-` onward) drives `build()` (the **same** function `build.ts` exports, not a re-implementation) into a scratch `mkdtempSync` directory and asserts, in both directions: every file the scratch build produced exists byte-identical under the committed `resources/`, and (implied by the file's own stated purpose, "Direction 2" not fully read this session) no orphaned generated file exists under `resources/` that the scratch build did not also produce. **A planner task that edits any `.mts` in `HOST_BOUND_ARTIFACTS` MUST run `node build.ts` (or the plan's own build step) and commit the regenerated `resources/*.mjs` before this test can pass** — this is the literal mechanism behind the roadmap's "first regeneration" cross-cutting constraint, not a metaphor.
- **What makes the guard go red:** editing a `.mts` source without rebuilding (stale committed `.mjs`), or a rebuild that emits a file not already listed in `HOST_BOUND_ARTIFACTS` (a hard assertion failure inside `build()` itself, before `resources-sync.test.ts` ever runs). Since Phase 60 adds no new host-bound module (it only edits existing ones), the `HOST_BOUND_ARTIFACTS` list itself should not need an edit — only a rebuild.
- **The generated-banner idiom** (`build.ts`'s `GENERATED_BANNER()`) is prepended by `build()` to every emitted file; a planner must never hand-edit anything under `resources/` directly (per `tool-location.mts`'s own header, which states this generally for the whole family, not only itself).

### 6. The four env vars named in the goal

`[VERIFIED: grep across src/mcp/vice, .github/workflows/ci.yml]` — see the callsite table in item 2 for `VICE_BIN`, `ACME_BIN`, `ACME`, `GHIDRA_HOME`'s read sites. Note `ACME` (the library directory) and `ACME_BIN` (the binary) are **two distinct variables with two distinct meanings** — confirmed both exist in-tree (`host-tool.mts:1292` for `ACME_BIN`; `host-tool.mts:2234`, inside `findAcmeLib()`, for `ACME`) and neither is a typo for the other.

**Tests, CI steps, scripts and live-test invocations that set one of the four, enumerated so "passes unchanged" is measurable:**

- **`VICE_BIN`** — set (not merely read) in: `vice-broker-launch.test.ts:92-108` (`VICE_BIN_STUB` fixture), `broker-kill.test.ts:562` (`/bin/sleep`), `vice-broker-acquire.test.ts:234,257` (`process.env.VICE_BIN =`, restored after), `host-tool-oracle.test.ts:188,194` (`process.env.VICE_BIN =`, restored after), `broker-e2e.test.ts:93,529,1105` (`/bin/sleep`, a stub path, and a container-simulation env block), `stock-a4-checkpoint-flood.test.ts:212`, `stock-broker-live.test.ts:246`, `text-monitor-live.test.ts:194` (all three real-emulator live tests, `viceBinPath`), `broker-control.test.ts:1288,1319` (`/bin/sleep`), `host-tool.test.ts:2588,2594` (`process.env.VICE_BIN =`, restored after). **CI itself never sets `VICE_BIN`** (`ci.yml` has no `VICE_BIN` line) — CI has no real emulator installed; the ACME job is the only tool CI actually provisions.
- **`ACME_BIN`** — set/read in: `skill-acme-build-cli.test.ts` (comment at `:68` references "CI's `ACME= node ...` invocation"), `anno-export-asm.test.ts`, `acme-verify.test.ts` (including the `VICE_REQUIRE_ACME=1` mandatory-RED case at `:590-603`), `host-tool.test.ts`, `anno-derivation.test.ts`, `hazard-subject-variants.test.ts`, `disasm-roundtrip.test.ts`, `hazard-subject-fixture.test.ts`, `host-tool-transport.test.ts`, plus two fixture-generator scripts (`fixtures/hazard-subject/make-hazard-subject-*.mjs`, `fixtures/export-asm/make-export-asm-fixtures.mjs`). **CI does not set `ACME_BIN` explicitly** — it installs `acme` onto `$PATH` via `apt`/`retry_apt` (`ci.yml:78`) and sets `VICE_REQUIRE_ACME=1` (`ci.yml:122,179`) to turn an absent-ACME skip into a hard failure, relying on the bare-`"acme"` `$PATH` fallback at `host-tool.mts:1292`, not on `ACME_BIN` itself.
- **`ACME`** (library dir) — `skill-acme-build-cli.test.ts:86` sets `env.ACME = ""` explicitly to force the library-free code path; `dxa-seam.test.ts:98`'s comment notes a test case that "cannot plant its fixture" against the `process.env.ACME`-first candidate, i.e. an acknowledged test-design constraint from `findAcmeLib()`'s own precedence, not a new one Phase 60 introduces.
- **`GHIDRA_HOME`** — read/set in `ghidra-live.test.ts`, `sleigh-compile-gate.test.ts`, `ghidra-opcode-live.test.ts`, `host-tool.test.ts`, `ghidra-project.test.ts`, and `test-gate.mjs` (almost certainly to classify these as opt-in/manual-only — not fully read this session, planner should confirm). **CI never sets `GHIDRA_HOME`** — no Ghidra job exists in `ci.yml`; these are live, opt-in tests against a real local Ghidra install (per this project's own `no-devcontainer`/`ghidra-installed-at-nonstandard-path` operational notes), exercised by a human running them locally, not by CI.

**Consequence for the plan's own verification step:** "nothing changed" for `LOC-03` is measurable by re-running the full `node --test '*.test.*'` suite (never `test:automated`, which hides `MANUAL_ONLY_TESTS`) with no live `vice-broker` process running on the host (a live broker deterministically reddens at least one unrelated test — see item 8) both before and after the rewiring, confirming the pass/fail set for every file named above is unchanged, plus a manual/documented run of the live-emulator and live-Ghidra suites if the executing agent has those installed.

### 7. `c1541` / `petcat` and the sibling probe — what "widened, not replaced" must mean concretely

`[VERIFIED: src/mcp/vice/host-tool.mts:2260-2311]`

- `findSiblingBinary(binaryName, resolvedX64scPath, log?)` today: memoises per binary name in a process-lifetime `Map` with **no reset hatch** (`siblingBinaryMemo`, `:2271`); first candidate is `dirname(resolvedX64scPath)/binaryName` (computed fresh from whatever `resolvedBackend().binPath` currently is — itself memoised); fallback is a raw `$PATH` walk that calls `log?.()` with a hazard warning naming the resolved `x64sc`, the `$PATH` match, and "this may be a DIFFERENT VICE build than the emulator."
- **`LOC-04` requires `tools.json` become a way to name `c1541`/`petcat` directly** (their `prerequisites.json` records already carry `{ fileOverridable: true }` with no `envVar`, per D-06 — confirmed this session). Concretely, "widened, not replaced" means: insert a `tools.json` check **between** the sibling-of-`x64sc` check and the `$PATH` fallback (matching the seam's own layer order — env, which these two ids do not have, then file, then probe), while (a) preserving the existing per-binary-name memo semantics (a `tools.json` answer, once found, should be memoised exactly like a sibling-probe or `$PATH` answer is today — the cross-cutting constraint is explicit that widening "must not change when it caches," not "must not cache"), and (b) preserving the `log?.()` warning callback for the `$PATH`-fallback case specifically (never for the `tools.json` case, which is an intentional user override, not a hazard).
- The seam's own `resolveTool()` does not implement a `sibling-of-x64sc` mechanism at all yet (Phase 59's D-15 deliberately scoped the seam's probe layer to `$PATH` only) — its `mechanism` type already declares the `"sibling-of-x64sc"` literal (`tool-location.mts:81`) for exactly this reason, but the mechanism itself must be added or the seam must be treated as answering the file layer while `findSiblingBinary()` (retained, extended with a `tools.json` check ahead of its existing two steps) still answers the rest. **This is an open design point Phase 59's own placement document (`docs/phase59-tool-location-placement.md`, bill item 4) explicitly flags as unresolved and hands to this phase** — research cannot resolve it in the planner's place; see Open Questions below.

### 8. Test-suite facts a plan must respect

`[VERIFIED: src/mcp/vice/package.json:132-133, src/mcp/vice/test-gate.mjs:40-176]`

- `npm test` runs `node --test '*.test.*'` — the full glob, and per this project's own standing operational memory this is the **real gate**; it no longer hangs (corrected 2026-09-16, measured green: 3858 pass/3777.../0 fail/81 skip in one prior recorded run, exact numbers drift release to release and must be re-measured, not copied).
- `npm run test:automated` runs `test-gate.mjs`, which explicitly filters out `MANUAL_ONLY_TESTS` (`test-gate.mjs:141-161`) — a green `test:automated` run proves nothing about the excluded files and must never be reported as "the suite passed."
- A live `vice-broker` process running on the host deterministically reddens at least one test in this suite (per this project's own recorded operational finding — not independently re-verified this session, flagged as `[ASSUMED]` pending the planner's own pre-flight check) — the plan's own verification steps should explicitly state "confirm no broker process is running" before trusting a red/green result, and should re-run to confirm after stopping one if a failure looks suspicious.
- Two of this project's own source/test files contain a raw NUL byte and are silently skipped by plain `grep` with no warning: `src/mcp/vice/anno-memmap-render.ts` and `src/mcp/vice/prerequisites.test.ts` (confirmed this session: `prerequisites.json`'s own structural gate is the second file, found only via `grep -a`). Any census the planner or an executor runs over `prerequisites.test.ts` — which Phase 60 will very likely need to extend for any new `location`/`kind` assertions — **must use `grep -a`**, per this session's own repeated instruction and the project's own committed operational memory.

## Standard Stack

Not applicable in the conventional sense — this phase installs no new package. The "stack" is
this project's own existing conventions, restated because Phase 60 must not violate them:

| Convention | Source | Applies here because |
|---|---|---|
| Destructured options object, injectable env/fs/spawn | `.planning/codebase/CONVENTIONS.md` (Injection) | Every function this phase touches (`resolvedBackend`, `spawnAndRecordInstance`, `launchSupervised`, `runHostTool`) already follows this; new seam-calling code must too |
| `.mts` imports its host-bound siblings with a `.mjs` extension | `host-tool.mts:124` (existing precedent) | `backend-detect.mts`/`broker-launch.mts` importing `tool-location.mjs` (not `.mts`) is the pattern to follow |
| No runtime dependency beyond `@mastra/mcp`/`@mastra/core` | `CLAUDE.md` § Imports | Nothing in this phase's scope needs a third dependency; the seam already ships with zero |
| Refuse by name, remedy in the message | `CLAUDE.md` § Dependency (never-auto-install) | `DECL-03`'s entire subject |

## Package Legitimacy Audit

**Not applicable — this phase installs no external package.** No `npm view`, no registry check, no
`package-legitimacy` seam run. If a future gap-closure round on this phase discovers a need for a
new dependency, that discovery itself is the trigger to re-run this protocol; nothing in the
phase's stated scope (rewiring existing host-bound modules through an existing seam) creates that
need.

## Architecture Patterns

### System Architecture Diagram

```
Container side                          Host side
───────────────                          ─────────
                                          vice-broker.mts (startup, once)
                                            │
                                            ├─ resolvedBackend({supervisorDir}) ──► backend-detect.mts
                                            │     (identity + capability cache;         │
                                            │      binPath used for host_state/logging) │
                                            │                                            │
                                            └─ [NEW] resolveTool("x64sc", {toolsDir,     │
                                                projectRoot}) ──► tool-location.mjs ◄─────┘
                                                    │ (env → tools.json → $PATH)
                                                    ▼
                                              resolved viceBin string
                                                    │
                    handleAcquire() ──(control plane)──► acquirePortAndLaunch(..., viceBin) [inFlight guard]
                                                    │
                                                    ▼
                                          spawnAndRecordInstance() ── spawn(viceBin, viceArgs) ──► x64sc

vice-proxy.ts (MCP stdio entry)          host-tool-client.ts (container route)
    │                                         │  hostToolOverControlPlane()
    │  resolvedBackend() (reporting only)     │       │
    ▼                                         ▼       ▼ (control plane, same executor)
stock-dispatch.ts (vice_ping's                broker-control.mts ── onHostTool ──► runHostTool()
  resolvedBinaryPath field)                                                            │
                                        host-tool-client.ts (host route, no container)  │
                                            │  hostToolOverHostRoute()                  │
                                            │  spawn(resources/host-tool.mjs) ──────────┤
                                                                                        ▼
                                                                    runHostTool() (host-tool.mts)
                                                                        │
                                                        ┌───────────────┼────────────────┬──────────────┐
                                                        ▼               ▼                ▼              ▼
                                              [NEW] resolveTool     findDxaBinary   findSiblingBinary  GHIDRA_HOME
                                              ("acme"/"acme-lib"/    (unchanged,      (widened: file    reads
                                               "ghidra", ...)        LOC-05 refuses)  layer added)     (→ seam)
```

### Recommended "shape" (not a directory layout — no new files)

No new directories or files are recommended beyond what a plan's own test additions require
(likely new colocated test cases in `backend-detect.test.ts`, `broker-launch.test.ts` or a new
`vice-broker-acquire.test.ts` case, `host-tool.test.ts`). This phase edits existing files.

### Pattern 1: Resolve once outside the guard, pass the result down through an existing override

**What:** Every one-shot resolution (the emulator's `viceBin`) must happen at the natural
"resolve once per process, before any synchronous critical section" point, and be threaded down
through the parameter that already exists for exactly this purpose (`deps.viceBin` on
`TryLaunchDeps`/`AcquirePortAndLaunchDeps`).
**When to use:** Any resolution whose current default expression executes inside
`broker-launch.mts`'s `inFlight` window.
**Example:**
```typescript
// vice-broker.mts, alongside the existing resolvedBackend() call (:1142) —
// illustrative shape, not verbatim code from this session's reads.
const backendResult = resolvedBackend({ supervisorDir: args.stateDir });
const viceBinResolution = resolveTool("x64sc", {
  toolsDir: join(args.repoRoot, ".c64-re-tools"),
  projectRoot: args.repoRoot,
});
const resolvedViceBin = viceBinResolution.path ?? backendResult.binPath; // fallback documented, not invented
// ... later, threaded into acquirePortAndLaunch(reason, { ..., viceBin: resolvedViceBin })
```
This is illustrative of the *pattern* (resolve outside the guard, pass down through the existing
override), not a citation of code that exists — `tool-location.mts` and `vice-broker.mts` do not
currently call each other; a planner implementing this must design the exact fallback behaviour
(what happens when the seam refuses or finds nothing but `resolvedBackend()`'s bare `$PATH` walk
would have found something) rather than treating this snippet as settled.

### Pattern 2: Resolve per-request from an already-available root, for the host-tool executor

**What:** `runHostTool()` already computes `repoRootAbs = resolvePath(deps.repoRoot)` at its own
entry (`host-tool.mts:2339`) from an argument both routes (`host-tool-client.ts`'s control-plane
and direct-spawn callers) already supply. `toolsDir`/`projectRoot` for every `resolveTool()` call
inside this function's body can derive from that one value with no new plumbing.
**When to use:** `acme`, `acme-lib`, `ghidra` resolution inside `runHostTool()`'s `acme.build`/
`ghidra.analyze`/`ghidra.installExtension` branches, and the `c1541`/`petcat` widening inside
`findSiblingBinary()`'s call sites.

### Anti-Patterns to Avoid

- **Calling `resolveTool()` from inside `broker-launch.mts`'s `inFlight` guard.** Both Phase 59's
  and Phase 60's own cross-cutting constraints name this explicitly; the seam's own filesystem
  reads (stat, readFileSync) are synchronous but non-trivial I/O, and the guard's entire safety
  property depends on the check-and-set window staying trivially fast and synchronous with nothing
  awaited between.
- **Repointing only `resolvedBackend()` and declaring `LOC-01`/`LOC-02` closed.** As demonstrated
  above, three other independent `VICE_BIN` reads exist; closing one and leaving three is a
  regression risk this research exists to prevent a planner from walking into.
- **Hand-editing anything under `resources/`.** Every compiled artifact this phase touches is
  regenerated by `build.ts`, never hand-patched — `tool-location.mts`'s own header states this
  generally and it applies to `backend-detect.mjs`/`host-tool.mjs` equally.
- **Authoring a fourth copy of the `env.VAR ?? "default"` idiom while "fixing" the third.** Any new
  code this phase writes to read an env var directly (rather than through the seam) reproduces
  exactly the duplication `LOC-02` exists to collapse.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---|---|---|---|
| A fourth `$PATH`-walk implementation | A new inline loop over `PATH.split(":")` | `resolveOnPath()` (`tool-location.mts:227`) — already exported for exactly this collapse | Phase 59's own placement doc names three coexisting copies as a debt this phase pays down; a fourth would be a regression, not a fix |
| A remedy-text formatter | A new template-string builder for "how to install X" | Read `prerequisites.json`'s `remedies[platform]` array directly, matched on `process.platform` — the exact shape `docs/phase58-declaration-provenance.md`'s D-06 record already specifies for the (not-yet-built) Phase 61/62 consumers | Two independently-authored remedy formatters is the disagreement `DECL-03` exists to remove |
| A second structural gate over `prerequisites.json`'s new fields | A new test file | Extend `prerequisites.test.ts`'s existing `LOCATION_KEYS`/`assertLocationBlockShape`/`assertKindAndMarker` helpers (`:176-229`) | This file is already documented as "the one authoritative structural gate" over the declaration |

**Key insight:** every "don't hand-roll" item in this phase is really the same item stated three
ways — Phase 58 and Phase 59 already built the pieces (the declaration, the seam, the structural
gate); Phase 60's discipline is wiring existing pieces together correctly, not building new ones.

## Common Pitfalls

### Pitfall 1: Treating `resolvedBackend()` as the only `x64sc` resolution site
**What goes wrong:** A plan rewires `backend-detect.mts` to consult `tools.json`, declares `LOC-01`
satisfied for `x64sc`, and ships — while the actual spawned binary (via `broker-launch.mts`'s
independent `VICE_BIN` reads) is untouched.
**Why it happens:** `resolvedBackend()` is the only *named*, documented, tested resolution
function for `x64sc`; the other three reads are unnamed inline expressions easy to miss on a
casual read.
**How to avoid:** Grep for the literal substring `VICE_BIN` across `src/mcp/vice/*.mts` before
declaring `x64sc` done, and confirm each hit is either the seam itself, a test, or a resolved-and-
threaded `deps.viceBin` consumer.
**Warning signs:** A `tools.json` entry for `x64sc` visibly changes `vice_ping`'s reported path but
the broker still spawns the old binary.

### Pitfall 2: Calling the seam inside the `inFlight` window
**What goes wrong:** A synchronous `resolveTool()` call is added directly inside
`spawnAndRecordInstance()` or `tryLaunchOne()`'s try block, "because that's where `viceBin` is
computed today." This does not literally introduce an `await` (the seam is fully synchronous), so
it does not trivially break the atomicity of the check-and-set — but it does reintroduce
filesystem I/O (three `existsSync`/`statSync`/`readFileSync` calls per resolution) into a section
this project has twice now explicitly documented as a section that must stay minimal, and it
means a slow or hung filesystem (network mount, degraded disk) now blocks the *guard itself*
rather than a pre-guard resolution step.
**Why it happens:** it is the path of least resistance — the guard's own function already has
`deps.viceBin` in scope, and adding a fallback line right there looks like the smallest diff.
**How to avoid:** resolve once, at the caller that already resolves `resolvedBackend()` once
(`vice-broker.mts` startup), and pass the answer down through the existing `deps.viceBin` field —
never call `resolveTool()` from a function reachable from inside `tryLaunchOne()`/
`acquirePortAndLaunch()`'s guarded region.
**Warning signs:** A code review finds `resolveTool(` textually between an `inFlight = true` and
its matching `inFlight = false`.

### Pitfall 3: Assuming `test:automated` proves `LOC-03`
**What goes wrong:** A plan's own verification step runs `npm run test:automated`, sees green, and
reports "nothing changed for existing VICE_BIN/ACME_BIN/ACME/GHIDRA_HOME setups" — while the live
tests that actually exercise those four env vars against a real broker/emulator/Ghidra install are
silently excluded by `MANUAL_ONLY_TESTS`.
**How to avoid:** Run the full `node --test '*.test.*'` glob (or `npm test`), with no live broker
process running, and diff the pass/fail file set against a pre-change baseline.
**Warning signs:** The verification step's own command line contains `test:automated`.

### Pitfall 4: Reconciling remedy text for `acme`/`acme-lib` as if it already exists
**What goes wrong:** A plan task is scoped as "repoint the ACME refusal message at
`prerequisites.json`," discovers there is no existing ACME refusal message to repoint (a bare
`spawn ENOENT`), and either invents a refusal shape mid-execution with no plan-level review, or
skips the tool entirely and under-delivers `DECL-03`.
**How to avoid:** The planner should explicitly scope a task to add a pre-spawn existence check
for `acme` (through the seam, mirroring the pattern `dxa`/`ghidra` already use) as new behaviour,
not a text-source swap, and budget it accordingly.

## Code Examples

No external-library code examples apply. The one pattern worth citing verbatim as a model for the
new seam-calling code's shape is the existing `{ path, tried }` result idiom this project already
uses four times over (`findAcmeLib`, `findDxaBinary`, `findSiblingBinary`, `resolvedBackend`'s
`binPath`/`binPathResolved` pair) and which `resolveTool()`'s `ResolveToolResult` widens rather
than replaces:

```typescript
// Source: src/mcp/vice/tool-location.mts:88-107 (read in full this session)
export interface ResolveToolResult {
  id: string;
  path: string | null;
  tried: string[];
  layer: ToolLocationLayer | null;      // "env" | "file" | "probe" | null
  mechanism: ToolLocationMechanism | null; // envVar name, "tools.json", "$PATH", ...
  refusal: string | null;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|---|---|---|---|
| Each resolver (`resolvedBackend`, `findAcmeLib`, `findSiblingBinary`, `broker-launch.mts`'s inline reads) owns its own precedence order | One seam (`tool-location.mts`) owns env → `tools.json` → `$PATH`/probe for every declared id | Phase 59 (built, unwired) → Phase 60 (wired) | A user can override any file-overridable tool without an env var, for the first time (`c1541`/`petcat` especially — previously impossible by any route) |
| Remedy text authored inline at each refusal site | Remedy text declared once in `prerequisites.json`, read at refusal time | Phase 58 (declared) → Phase 60 (wired for the first time) | A live refusal and a future doctor (Phase 61) cannot drift apart, because there is only one place either can read from |

**Deprecated/outdated:** none of this phase's subject matter is a library or protocol version;
nothing here becomes stale on the usual "check for a newer release" cadence. The only thing that
can go stale is this document's own file:line citations if further plans land on this branch
before Phase 60 executes — re-grep before trusting a line number if executing later than 2026-09-18.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|---|---|---|
| A1 | A live `vice-broker` process deterministically reddens at least one test in the suite | Item 8 / Pitfall 3 | Low — this is a documented project operational note, not independently re-run this session; if wrong, the planner's pre-flight "stop the broker" step is merely unnecessary, not harmful |
| A2 | `test-gate.mjs`'s `GHIDRA_HOME`-related tests are excluded from `MANUAL_ONLY_TESTS` for the reason "no Ghidra in CI" rather than some other reason | Item 6 | Low — affects only how the plan documents *why* these are opt-in, not whether they are |
| A3 | `resources-sync.test.ts`'s "Direction 2" (orphan check) exists as described, mirroring Direction 1's stated purpose | Item 5 | Low-Medium — if the second direction does not exist or works differently, the "what makes the guard go red" list is incomplete; the planner should re-read the full file before writing verification steps that depend on this claim |
| A4 | The illustrative code in "Pattern 1" is a viable design, not merely a plausible one | Architecture Patterns | Medium — this is explicitly flagged as illustrative-not-verbatim in the text itself; the planner must design the actual fallback/error-handling behaviour, which this research does not attempt to settle |

## Open Questions

1. **Does `resolveTool()` gain a `sibling-of-x64sc` mechanism, or does `findSiblingBinary()` stay a
   private helper the seam does not know about, extended in place with its own `tools.json` check?**
   - What we know: Phase 59's own placement document names this as unresolved and assigns it to
     Phase 60 (`docs/phase59-tool-location-placement.md`, bill item 4); the seam's `mechanism` type
     already reserves the literal for future use.
   - What's unclear: whether "the precedence order exists in exactly one place" (`LOC-02`) is
     satisfied by `findSiblingBinary()` delegating its *file-layer* check to `resolveTool()`'s
     internals (partial delegation) versus the seam growing a true `sibling-of-x64sc` mechanism of
     its own (full delegation, `findSiblingBinary()` becomes a thin wrapper or is retired).
   - Recommendation: the planner should decide this explicitly, as its own D-NN, rather than
     letting it be implied by whichever line lands first — the same discipline Phase 59 already
     modelled for its own open placement question.

2. **Does `resolvedBackend()` itself gain the `tools.json` layer internally, or does the caller
   (`vice-broker.mts`, `vice-proxy.ts`) call `resolveTool()` separately and choose between the two
   answers?**
   - What we know: Phase 59's D-01 explicitly left this open and named it Phase 60's decision;
     `resolvedBackend()`'s memoisation (module-level, reset only by a test-only hatch) is
     incompatible with a no-cache seam being called from inside it on every access — but calling
     it once, at the same startup moment `resolvedBackend()` itself is called, is compatible.
   - What's unclear: whether `resolvedBackend()`'s eventual role is "reduced to identity/capability
     caching over a path handed to it" (per Phase 59's own framing) or keeps deciding the path itself
     with an added `tools.json` step.
   - Recommendation: given `resolvedBackend()`'s `binPath` also feeds `vice_ping`'s reporting field
     and `findSiblingBinary()`'s own first-candidate computation, whichever shape is chosen must
     keep those two downstream consumers correct without their own edits — verify this at design
     time, not by running the suite and hoping.

3. **What is `c1541.*`'s and `petcat.decode`'s exact current refusal message text (not read past
   `host-tool.mts:1560`/`:1636` boundary this session for the full surrounding block)?**
   - What we know: `petcat.decode`'s is confirmed verbatim (`:1634`); `c1541.*`'s equivalent line
     was not captured in this session's reads.
   - Recommendation: the planner should read `host-tool.mts:1538-1580` in full before writing the
     `c1541.*` refusal-message task, rather than assuming it mirrors `petcat.decode`'s shape exactly.

## Environment Availability

| Dependency | Required By | Available (this session) | Version | Fallback |
|---|---|---|---|---|
| Node.js ≥ 24 | Running/typechecking/testing the MCP server package | Not probed this session (research-only; no code executed) | — | N/A — this project's own standing floor |
| `x64sc` (stock VICE) | Live-testing the emulator-spawn rewiring | Per this project's own operational memory, `/usr/bin/x64sc` is genuine unpatched stock and available on this machine | Not re-probed this session | N/A |
| Ghidra | Live-testing `GHIDRA_HOME` rewiring | Per this project's own operational memory, installed at a non-standard path (`/home/henrik/dev/_ghidra-probe/`), not on `$PATH` | Not re-probed this session | Executor should search for `analyzeHeadless` rather than guessing a prefix, per this project's own standing note |
| ACME | Live-testing `ACME_BIN`/`ACME` rewiring | Verified locally against ACME 0.97 "Zem" per `CLAUDE.md`'s own stated fact; not re-probed this session | 0.97 "Zem" (per CLAUDE.md) | N/A |

**Missing dependencies with no fallback:** none identified — this phase's own execution requires
no new external tool beyond what the project already assumes is present for its existing test
suite.

## Validation Architecture

### Test Framework
| Property | Value |
|---|---|
| Framework | Node's built-in test runner (`node --test`), no separate framework `[VERIFIED: src/mcp/vice/package.json:132-133]` |
| Config file | none — colocated `*.test.ts`/`*.test.mts` beside the module under test |
| Quick run command | `node --test tool-location.test.ts backend-detect.test.ts host-tool.test.ts` (targeted, per touched file) |
| Full suite command | `npm test` (i.e. `node --test '*.test.*'`) — the real gate; never `npm run test:automated` for a claim about `LOC-03` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|---|---|---|---|---|
| LOC-01 | A `tools.json` entry for `x64sc`/`acme`/`ghidra`/`c1541`/`petcat` is honoured by the code that actually spawns/resolves it, not only by a direct seam call | integration | `node --test broker-launch.test.ts vice-broker-acquire.test.ts host-tool.test.ts` | ✅ (existing files, new cases needed — Wave 0 gap) |
| LOC-02 | No live callsite keeps its own env-var-and-default expression outside the seam | structural | A new grep-based structural test (mirrors `hostpath-consumers.test.ts`'s closed-consumer-set idiom) asserting `process.env.VICE_BIN`/`ACME_BIN`/`ACME`/`GHIDRA_HOME` occur only inside `tool-location.mts`/`tool-location.test.ts` and (if kept as a documented, deliberate exception) `vice-broker.mts`'s reporting-only `resolveViceBinForHostState()` | ❌ Wave 0 — new test file or new case |
| LOC-03 | Every existing test/CI step/live-test invocation that sets one of the four env vars still passes | regression | `npm test` (full suite, no live broker running), pass/fail set diffed against pre-change baseline | ✅ (existing suite; diff step is new plan discipline, not a new file) |
| LOC-04 | `c1541`/`petcat` resolvable via `tools.json`, sibling probe still works when the file says nothing | unit | `node --test host-tool.test.ts` (new cases against `findSiblingBinary()`'s widened behaviour) | ❌ Wave 0 — new cases in existing file |
| DECL-03 | A live refusal for `dxa`/`ghidra`/`acme` reads `prerequisites.json`'s remedy/reason text at runtime, never a re-authored literal | unit | `node --test host-tool.test.ts prerequisites.test.ts` (new cases: mutate the declaration's remedy text in a scratch copy, confirm the live refusal message changes to match — the non-vacuity idiom this project already uses elsewhere) | ❌ Wave 0 — new cases |

### Sampling Rate
- **Per task commit:** the targeted `node --test <touched-file>.test.ts` command for whatever was just edited.
- **Per wave merge:** full `npm test` with no live broker process running (see Pitfall 3).
- **Phase gate:** full `npm test` green, plus `node build.ts` run and `resources-sync.test.ts` green against the **regenerated and committed** `resources/backend-detect.mjs`/`resources/host-tool.mjs` (and any other `HOST_BOUND_ARTIFACTS` entry actually touched) before `/gsd-verify-work`.

### Wave 0 Gaps
- [ ] A structural "closed consumer set" test for the four env-var names, mirroring `hostpath-consumers.test.ts` — covers `LOC-02`.
- [ ] New `host-tool.test.ts` cases for `c1541`/`petcat` resolving via a scratch `tools.json` — covers `LOC-04`.
- [ ] New `host-tool.test.ts`/`prerequisites.test.ts` cases proving a refusal message tracks a mutated declaration remedy/reason string — covers `DECL-03`, and gives the non-vacuity proof `ENGINEERING_RULES.md` §6 requires for a refusal test.
- [ ] A pre-and-post rewiring full-suite baseline diff step, documented as part of the plan's own verification (not a new test file — a verification *procedure*) — covers `LOC-03`.

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---|---|---|
| V2 Authentication | No | No auth surface touched |
| V3 Session Management | No | Not touched |
| V4 Access Control | No | Not touched |
| V5 Input Validation | Yes | `tool-location.mts` already validates `tools.json` shape (`validateToolsFile()`), path normalisation confined to the file layer (D-08); Phase 60 must not widen input trust — a resolved path from `tools.json` must never be interpolated into a shell string (already a standing project-wide rule, and the seam's own header repeats it) |
| V6 Cryptography | No | Not touched |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---|---|---|
| A resolved tool path interpolated into a shell string, enabling injection via a crafted `tools.json` value | Tampering | Always spawn via an argv array (`spawn(cmd, args)`), never a shell string — this project's own frozen constraint (`CLAUDE.md` § Architecture, the one-member spawn set) and the seam's own header both already forbid this |
| `__proto__`/prototype-pollution-shaped keys in `tools.json` or a tool id | Tampering | `resolveTool()`/`validateToolsFile()` already use exact array-membership checks against the declaration's key set, never bracket property lookup (`tool-location.mts:448-458`, `:384-388`) — any new code this phase adds that looks up a tool id or a `tools.json` key must follow the same pattern, never a bare `obj[key]` |
| A relative or `~`-prefixed `tools.json` path escaping the intended project tree | Tampering / Elevation of Privilege | Already confined to `normalizeFileLayerValue()`'s two-step resolution against `projectRoot` (`tool-location.mts:260-263`) — no new normalisation should be added elsewhere; if `runHostTool()`'s callers need this, they call the seam, they do not re-implement it |
| A live refusal message leaking a host-absolute path to the container side unexpectedly | Information Disclosure | Not new to this phase — `containerPath()` translation is already the established pattern for any host path crossing the container boundary (`host-tool-client.ts`'s own header); any new refusal message this phase adds that includes a resolved path must go through the same translation before reaching a container-side caller |

## Sources

### Primary (HIGH confidence — read this session, this repo)
- `src/mcp/vice/tool-location.mts` (full file) — the seam's own implementation and header.
- `src/mcp/vice/host-tool.mts` (targeted reads: env-var reads, `findAcmeLib`/`findDxaBinary`/
  `findSiblingBinary`, `buildHostToolArgv`'s ACME/Ghidra branches, `spawnHostTool`,
  `runHostTool`'s dispatch body).
- `src/mcp/vice/backend-detect.mts` (full header + `resolvedBackend()` and its deps/memo).
- `src/mcp/vice/broker-launch.mts` (targeted: `spawnAndRecordInstance`, `launchSupervised`,
  `tryLaunchOne`, `acquirePortAndLaunch`, the `inFlight` guard).
- `src/mcp/vice/vice-broker.mts` (targeted: `resolveViceBinForHostState`, the `resolvedBackend()`
  startup call, `handleAcquire`'s onAcquire wiring).
- `src/mcp/vice/vice-proxy.ts`, `src/mcp/vice/stock-dispatch.ts` (grep + targeted reads: the
  `resolvedBackend()` reporting consumers).
- `src/mcp/vice/host-tool-client.ts` (targeted: the two-route header, the host-route spawn).
- `src/mcp/vice/ghidra-project.mts` (targeted: confirmed no direct `process.env.GHIDRA_HOME` read).
- `src/mcp/vice/prerequisites.json` (full file).
- `src/mcp/vice/build.ts`, `src/mcp/vice/resources-sync.test.ts` (targeted).
- `src/mcp/vice/prerequisites.test.ts` (targeted, via `grep -a` per this file's own NUL-byte warning).
- `docs/phase59-tool-location-placement.md` (full file).
- `.planning/phases/59-.../59-CONTEXT.md`, `.planning/phases/58-.../58-CONTEXT.md` (full files).
- `.planning/phases/59-.../59-01-SUMMARY.md`, `59-05-SUMMARY.md` (full files).
- `.planning/ROADMAP.md` (Phase 58 through 62 sections).
- `.planning/REQUIREMENTS.md` (LOC-* and DECL-03 rows).
- `.github/workflows/ci.yml` (targeted grep for env-var and ACME-job lines).

### Secondary (MEDIUM confidence)
- This project's own committed operational memory (`.claude/…/memory/MEMORY.md` entries on
  live-broker test interference, the full-glob suite no longer hanging, `test:automated` hiding
  failures, Ghidra's non-standard path) — treated as project-authoritative but not independently
  re-verified inside this research session's own tool calls.

### Tertiary (LOW confidence)
- None used — no WebSearch or external-ecosystem source was needed for this phase's domain.

## Metadata

**Confidence breakdown:**
- Live callsite inventory (items 1–8 above): HIGH — every claim is a direct `file:line` read this
  session.
- The exact shape of the rewiring (which module gains which new call, whether `resolvedBackend()`
  is reduced or extended): MEDIUM — deliberately left open by Phase 59, and this research states
  the tradeoffs rather than picking for the planner.
- Test-suite operational facts (live-broker interference, NUL-byte files): MEDIUM — sourced from
  this project's own standing memory, not independently re-triggered this session.

**Research date:** 2026-09-18
**Valid until:** This is an internal-refactor phase over code that does not churn on an external
release cadence; the main staleness risk is a sibling plan landing on this branch before Phase 60
executes and shifting the `file:line` citations above. Re-grep before trusting a line number if
executing more than a few days after 2026-09-18, or if `git log` shows commits touching
`backend-detect.mts`/`host-tool.mts`/`broker-launch.mts`/`vice-broker.mts` since this date.
