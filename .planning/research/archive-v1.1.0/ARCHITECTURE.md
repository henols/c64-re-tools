# Architecture Research: Prerequisite Doctor + Layered Tool-Location Resolver

**Domain:** Integration into an existing, opinionated TypeScript/Node MCP-plugin codebase (`c64-re-tools`)
**Researched:** 2026-09-16
**Confidence:** HIGH for structural claims (all cite file:line read directly from the tree). MEDIUM for a few build-order sequencing calls that are judgment, not fact. Explicit open questions are marked as such, not guessed.

This is not a generic architecture survey — the milestone (`v1.1.0 The Prerequisite
Doctor`, `.planning/PROJECT.md:1880-1975`) already fixed five decisions. This
document works out *how* those decisions land on the actual files.

## Answer to the key question first (Q1's `.mts`/`.ts` placement)

**The new location-resolution seam must be authored as a host-bound `.mts` file,
added to `build.ts`'s `HOST_BOUND_ARTIFACTS` array, and it must NOT statically
import `repo-root.ts`.** It receives the resolved root/tools-dir as an explicit
string parameter from its caller, exactly like `backend-detect.mts` already does
for `supervisorDir`. This is not a stylistic preference — it is forced, and the
precedent already exists verbatim in the tree:

> `src/mcp/vice/backend-detect.mts:60-80` — *"`supervisorDir` is ALWAYS an
> explicit string this module receives from its caller, never a default this
> module derives itself... This file cannot import repo-root.ts's VALUE as a
> static import and still compile as a host-bound artifact: repo-root.ts (and
> its own dependency install-resources.ts) use `.ts`-extension imports that
> only resolve under Node's native type-stripping, unbuilt — exactly the mode a
> bare host running this module's COMPILED resources/backend-detect.mjs cannot
> rely on... Passing the resolved string in, rather than importing the
> resolver, is what keeps this file importable UNBUILT from a container-side
> `.ts` (exactly like container-guard.mts's own precedent) AND compilable into
> resources/ for the host, from the SAME source, with no `#ifdef`-style split."*

Every production runtime consumer of a tool location today is host-bound:

| Consumer | File:line | What it resolves | Compiled? |
|---|---|---|---|
| `resolvedBackend()` | `backend-detect.mts:283` (`env.VICE_BIN ?? "x64sc"`) | `x64sc` | Yes — in `HOST_BOUND_ARTIFACTS` (`build.ts:43-53`) |
| `spawnAndRecordInstance` default | `broker-launch.mts:445`, `:1523` (`process.env.VICE_BIN ?? "x64sc"`) | `x64sc` (the broker's own spawn target) | Yes |
| ACME binary | `host-tool.mts:1292` (`process.env.ACME_BIN ... : "acme"`) | `acme` | Yes |
| ACME library dir | `host-tool.mts:2231-2245` (`findAcmeLib()`, fixed candidate list + `process.env.ACME`) | ACME stdlib dir | Yes |
| Ghidra install dir | `host-tool.mts:1348-1362`, `:1513-1524`, `:2534-2545` (`process.env.GHIDRA_HOME`) | `analyzeHeadless`, `support/sleigh` | Yes |
| c1541/petcat siblings | `host-tool.mts:2273-2311` (`findSiblingBinary()`, sibling-of-x64sc probe + `$PATH` fallback) | `c1541`, `petcat` | Yes |
| dxa | `host-tool.mts:2223-2229` (`findDxaBinary()`, FIXED vendored path, deliberately never env-overridable) | vendored `dxa` | Yes |
| Node interpreter | `resources/vice-launcher.sh:189-222` | `node` itself | N/A — hand-authored bash, not compiled |

The one place that reads `ACME_BIN` **outside** the host-bound set is
`acme-gate.ts:71` — but that module is explicitly **test-only**
(`acme-gate.ts:32-34`: *"must never appear in `package.json`'s `files[]`... must
never be imported by a production module — only by `*.test.ts` files"*). It is
a separate, deliberately duplicate probe used by the test suite, not a
production consumer. **It is not a caller the new seam needs to serve for
correctness of the shipped product** — though see the "doctor vs. real refusal
agreement" section below for why it must not become a third opinion either.

Given that every production caller is host-bound and compiled, and the one
container-side `.ts` reader (`acme-gate.ts`) is test-only, the seam's home is
settled: it lives beside `backend-detect.mts` as a new `*-location.mts` (or
similar) file, is added to `HOST_BOUND_ARTIFACTS`, and takes `toolsDir`/
`repoRoot` as a parameter — never a static import of `repo-root.ts`.

### Why it cannot live inside `host-tool.mts`

`backend-detect.mts` is imported BY `host-tool.mts` (`host-tool.mts:124`,
`import { resolvedBackend } from "./backend-detect.mjs"`). A tool-location
resolver that both `backend-detect.mts` (for `VICE_BIN`/`x64sc`) and
`host-tool.mts` (for `ACME_BIN`/`GHIDRA_HOME`/sibling probes) need to call
cannot live inside `host-tool.mts`, because that would make `backend-detect.mts`
depend on `host-tool.mts` depend on `backend-detect.mts` — the exact module
cycle `repo-root.ts`'s own header names as a hazard class this codebase
rejects (`repo-root.ts:9-33`, and the "module-cycle avoidance is deliberate and
documented" architectural constraint in `CLAUDE.md`). It must be its own file,
sitting *below* both `backend-detect.mts` and `host-tool.mts` in the import
graph, so both can depend on it without depending on each other.

### Can `vice-launcher.sh` consume a JSON location file?

**Only in a degraded, hand-rolled way, and there is a real bootstrapping
problem that argues against trying.** `vice-launcher.sh` reads
`VICE_BROKER_NODE` (`resources/vice-launcher.sh:189-222`) *before* it has a
working Node interpreter — that variable's whole job is finding one. A `tools.json`
reader that used `node -e '...'` to parse the file would need to already have
resolved a Node to run it, which is the very question being answered. The
launcher could grep/sed a single well-known JSON key out of a flat file
without a full parser, but that reintroduces a second, fragile, hand-rolled
JSON reader outside the one seam this design is trying to consolidate around
— the exact anti-pattern ("re-deriving a cross-cutting seam locally") this
project already names. **Recommendation: `VICE_BROKER_NODE` stays env-var-only,
explicitly out of `tools.json`'s scope.** State this as a documented exception
in the prerequisite declaration and in `tools.json`'s own generated comment
header, not as an oversight. (This matches the milestone's own framing — it
lists `VICE_BROKER_NODE` as one of the five pre-existing overrides in three
naming conventions, `.planning/PROJECT.md:1926-1932`, without ever proposing to
unify it into the file.)

## 1. Where the seam lives, and what it looks like

**New file (proposed name, not yet in the tree):** `src/mcp/vice/tool-location.mts`

- Added to `build.ts`'s `HOST_BOUND_ARTIFACTS` (`build.ts:42-53`), which
  bumps that array from 10 entries to 11 and is asserted exactly
  (`build.ts:192-205` fails loudly on an unexpected emit).
- Exports one function, shaped like `resolvedBackend()`:
  `resolveToolLocation(toolId, deps): { path: string | null; source:
  "env" | "file" | "path" | "sibling" | "vendored" | "not-found"; tried:
  string[] }`, where `deps` carries `env?`, `toolsJsonPath?` (an explicit
  string — never self-resolved), and any per-tool probe overrides needed for
  testing (mirrors `ResolvedBackendDeps`'s injection-seam idiom,
  `backend-detect.mts:252-265`).
- Precedence inside the function: `env var → tools.json entry → $PATH/sibling
  probe → not found` (milestone decision #5, `.planning/PROJECT.md:1922-1932`).
  This is a *reordering/wrapping* of existing per-tool logic, not new probing
  logic — `findSiblingBinary()`, `findAcmeLib()`, `resolvedBackend()`'s own
  `$PATH` walk, and `findDxaBinary()`'s fixed-path check all already exist
  and must be called, not reimplemented (milestone's own explicit warning:
  *"Minting a second detection path is the specific mistake to avoid here"*,
  `.planning/PROJECT.md:1936-1940`).
- **`findDxaBinary()` stays outside the env/file override layer.**
  `host-tool.mts:126-131` states this as a deliberate, argued rule: dxa is
  vendored and built by this project, so an override "could only ever select
  a binary this project did not build and did not pin — a substitution this
  seam must never allow." The new seam should special-case `dxa` (and any
  future project-vendored tool) to skip the `env`/`file` precedence steps
  entirely and go straight to the fixed vendored-path probe. Get this wrong
  and the new seam silently reopens a hole the current code deliberately
  closed.

### Which existing modules must call it

| Module | Current resolution code (to be routed through the seam) |
|---|---|
| `backend-detect.mts:283` | `deps.viceBin ?? env.VICE_BIN ?? "x64sc"` |
| `broker-launch.mts:445`, `:1523` | `process.env.VICE_BIN ?? "x64sc"` |
| `host-tool.mts:1292` | ACME binary path |
| `host-tool.mts:1348-1362`, `:1513-1524`, `:2534-2545` | `GHIDRA_HOME`-derived paths |
| `host-tool.mts:2231-2245` (`findAcmeLib`) | ACME library dir candidates |
| `host-tool.mts:2273-2311` (`findSiblingBinary`) | c1541/petcat siblings |

`findDxaBinary()` (`host-tool.mts:2223-2229`) is **not** rerouted through the
`env`/`file` layers per above, but the seam should still expose it (or wrap
it) so the *doctor* has one call surface for all seven tools, including dxa.

**Open question — should `broker-launch.mts` and `backend-detect.mts`
literally call into the new module, or should `resolvedBackend()` itself grow
a `toolsJsonPath` deps field and stay the sole `VICE_BIN` authority, with the
new seam calling *it* rather than the reverse?** Both directions avoid a
cycle (neither file currently imports the other — `backend-detect.mts` has no
import of `host-tool.mts` or vice versa apart from the one-directional
`host-tool.mts → backend-detect.mjs` edge already shown above). The codebase's
own "single seam per concern" rule argues for **`resolvedBackend()` gaining
the `tools.json` precedence step internally** (since it is already the one
authoritative place for `x64sc` resolution, per its own header,
`backend-detect.mts:1-23`) while the *other* six tools (ACME binary, ACME lib,
Ghidra, c1541, petcat, dxa) route through the new seam module, which
`host-tool.mts` already sits next to. This keeps `resolvedBackend()` as the
one `x64sc` authority (unchanged) and makes the new module the one authority
for everything host-tool.mts. **This is a design choice for the phase to make
explicitly, not a fact this research measured — flagged as a decision point,
not a gap.**

## 2. Where the doctor runs, and the disagreement risk

**The doctor is a plain host-side process, and it must call the *same*
compiled artifacts the broker calls — not re-import unbuilt `.mts` source and
not reimplement any probe.** Concretely:

- The doctor's own entry point cannot be a `.ts` file requiring Node ≥24
  type-stripping (`bin.vice-mcp` → `vice-proxy.ts`,
  `src/mcp/vice/package.json:6-9`, `engines.node: >=24.0.0`,
  `package.json:104-106`) — the milestone states this as a hard constraint,
  not a preference (`.planning/PROJECT.md:1938-1944`).
- `resources/*.mjs` is already **plain, type-stripped, ES2022 JavaScript** —
  the committed output of `build.ts`'s `tsc` pass
  (`GENERATED_BANNER`, `build.ts:60-69`). It runs on any Node capable of
  ES2022 modules, with no type-stripping needed at all. This is the doctor's
  way out of the Node-version bind: **author the doctor's CLI entry as a new
  host-bound `.mts` file** (mirroring `vice-broker.mts`'s and `host-tool.mts`'s
  own bottom-of-file CLI blocks — see `vice-broker.mts:121-150`'s `parseArgs()`
  and `host-tool.mts:2991-3018`'s `run --repo-root <path> --request <json>`
  CLI), add it to `HOST_BOUND_ARTIFACTS`, and let `build.ts` emit a plain
  `.mjs` that needs no type-stripping to run. Ship it as a **second `bin`
  entry** in `src/mcp/vice/package.json` (today only `vice-mcp` →
  `vice-proxy.ts`, `package.json:6-9`) pointing at the compiled artifact under
  `resources/`.
- **Crucially, the doctor imports the same compiled `resources/*.mjs` modules
  the broker imports** — `resolvedBackend` from `backend-detect.mjs`, and the
  probe functions from the new `tool-location.mjs` (and, transitively,
  whatever of `host-tool.mts`'s probe functions the seam wraps). This is what
  answers Q2 directly: **yes, the doctor can call the resolution seam
  in-process, host-side, with no broker round trip, and get the identical
  answer — because it is calling the exact same function, not a
  reimplementation.** The risk named in the prompt ("a doctor that can
  disagree with the real refusal") is avoided by construction, not by
  cross-checking two independent probes.

### Memoisation is the one place this needs care

`resolvedBackend()` and `findSiblingBinary()` are both **memoised per process
lifetime** (`backend-detect.mts:271-277`'s `memoisedResult`;
`host-tool.mts:2260-2271`'s `siblingBinaryMemo`, including a documented
"a `null` answer is memoised too" rule). This is correct and desired *inside
a single long-running broker* — it is explicitly *not* correct to import if
copied into a long-lived doctor daemon. It is a non-issue for a **doctor
invoked as a one-shot CLI**, since a fresh process means a fresh, empty memo
on every run — which is exactly the behaviour a "check what's missing right
now" command wants. State this explicitly as a constraint on the doctor's
shape: **it must be a one-shot process, never a resident/watch-mode process**,
or the memoisation semantics that are safe for the broker become stale
answers for the doctor.

`resolvedBackend()`'s cache-eligibility path also takes an *optional*
`supervisorDir` (`backend-detect.mts:283`, `deps.supervisorDir`) for the
on-disk `backend.json` capability cache. The doctor should almost certainly
**not** pass a `supervisorDir` at all — persisting a capability cache from a
doctor run that never actually connects to a live VICE instance would write a
half-true record (identity, no `versionQuad`) into the same file the broker
maintains, for no benefit. Passing `deps.supervisorDir` unset makes this a
pure no-op there (`backend-detect.mts:82-88`: *"When supervisorDir is omitted
entirely, every cache read/write below is a no-op"*) — cite this behaviour
explicitly in the doctor's own header so a future reader does not "helpfully"
wire it up.

## 3. The prerequisite declaration and its consumers

**Format: plain JSON (or equivalently simple, dependency-free data — not
TypeScript, not YAML requiring a parser dependency).** This follows directly
from how the installer package already handles the identical Node-floor
problem: `installer/bin/cli.mjs:32-48` explicitly does **not** import
`src/mcp/vice/version.ts` (the project's real "single version-resolution
seam") because the installer targets Node ≥18
(`installer/package.json:15-17`) and cannot type-strip a `.ts` import the
way the `vice-mcp` package's Node ≥24 runtime can — it hand-copies one
literal (`MCP_DEV_PLACEHOLDER`) instead, with a comment explaining the
disclosed divergence. **The prerequisite declaration will hit the exact same
wall if it is authored as a `.ts`/`.mts` module**, because its three named
consumers — the doctor (old-Node CLI), the README generator, and
`host-tool.mts`'s refusal messages — do not share one Node floor. A plain
`.json` file sidesteps this entirely: every consumer can `JSON.parse` it with
zero dependency and zero Node-version requirement.

### The three consumers, concretely

1. **The doctor.** Reads the declaration to know what to probe and what each
   tool unblocks per skill; calls `resolveToolLocation()` per tool; renders
   the capability-mapped report.
2. **Runtime refusal messages in `host-tool.mts`.** Today these are inline
   string literals at the point of refusal — e.g. `host-tool.mts:1352`
   (`` `host_tool "ghidra.analyze" requires the GHIDRA_HOME environment
   variable...` ``), `:1362`, `:1472`, `:1517`, `:1559`, `:1634`. **These
   should NOT be rewritten to interpolate the declaration at runtime** — that
   would add a JSON-read-and-template step to the hot refusal path for no
   real benefit, and would risk the refusal text silently drifting from what
   the doctor reports if the interpolation logic itself diverges. The safer
   integration is the reverse: the declaration's per-tool "remedy" text
   should be **authored to match** these existing refusal strings (a
   cross-check test, not a runtime coupling), so a reader who hits the live
   refusal and a reader who runs the doctor see consistent guidance without
   the refusal path taking on a new dependency. This is consistent with the
   milestone's own framing of README generation as "guarded **semantically**,
   not byte-identically" (`.planning/PROJECT.md:1965-1968`) — the same
   semantic-not-literal relationship should hold here.
3. **README.md's install table generator.** Today `README.md`'s per-distro
   VICE table is entirely hand-kept (`README.md:101-110`); there is no
   equivalent table for ACME or Ghidra there at all — ACME's install guidance
   lives separately, in `src/skills/acme-build/SKILL.md:211,254` (prefix list
   and a table row). The generator's job is to **produce** (or verify) these
   tables from the one declaration, closing the milestone's named
   fragmentation (*"today that knowledge is split across README.md's
   hand-kept per-distro tables, acme-build/SKILL.md's prefix list, and
   inline refusal strings in host-tool.mts — four places that can disagree"*,
   `.planning/PROJECT.md:1949-1953`).

### Does the declaration need to be in `files[]`?

- **`src/mcp/vice/package.json`'s `files[]`: yes, if the doctor's compiled
  `.mjs` entry (or `host-tool.mjs`, transitively) reads it at runtime.**
  The published tarball only ships what `files[]` lists
  (`package.json:10-99`) plus the whole `resources/` directory
  (`package.json:98`, the line reading `"resources"`). A `.json` data file
  living inside `src/mcp/vice/` needs its own `files[]` entry (like
  `anno-regbits.json` already has at `package.json:66`, or
  `tools-manifest.stock.json` at `package.json:97`) — it will not ship
  automatically just by existing in the source tree, and it will not be
  covered by the `"resources"` entry unless it is physically placed inside
  `resources/` (which would be a category error: it is authored/curated data,
  not a build artifact, so it should NOT go through `build.ts`'s staging/
  banner/atomic-rename pipeline, and should NOT live inside the directory
  `resources-sync.test.ts` walks looking for stale builds).
- **`installer/package.json`'s `files[]` (`bin/`, `skills/`, `README.md`,
  `THIRD-PARTY-NOTICES.md`, `installer/package.json:9-14`): only if the
  installer's own README generator or CLI reads the declaration directly.**
  Given the installer targets Node ≥18 and already avoids importing
  `vice-mcp`'s TS seams for exactly this reason (`cli.mjs:32-48`), if the
  installer needs the declaration (e.g. to print "what you'll need" at
  install time) it should read it as **plain JSON via `fs.readFileSync` +
  `JSON.parse`**, never via a TypeScript import — and the file must then be
  vendored into the installer package's own `files[]` (most likely by
  `scripts/sync-skills.mjs`'s existing copy step, or a new equivalent), not
  imported cross-package at publish time. **Open question: does the
  installer actually need to consume the declaration in v1.1.0, or is that
  out of scope ("No install path is added, removed or collapsed",
  `.planning/PROJECT.md:1972-1974`)?** The milestone's own scoping note
  suggests the installer's *install paths* stay untouched — reading a
  declaration to print information is not an install-path change, but this
  is a judgment call the phase should make explicitly, not something this
  research can settle from the tree as written.

## 4. Build order

Dependencies flow one direction: the declaration and the resolver are
data/logic that everything else consumes; the doctor and the README generator
are consumers. Suggested phase sequence:

1. **The prerequisite declaration (data only).** New file, e.g.
   `src/mcp/vice/tools.declaration.json` (name TBD by the phase). No code
   changes to `host-tool.mts` or `backend-detect.mts` yet. Content: per tool
   (`x64sc`, `c1541`, `petcat`, ACME binary, ACME library dir, Ghidra, dxa) —
   version floor (where known), which skill(s)/MCP capability it unblocks,
   per-platform remedy text. Cross-check its remedy strings against the
   existing inline refusal messages listed in §3 as part of this phase's
   acceptance, not a later one.
2. **The location-resolution seam (`tool-location.mts`), new module, added
   to `HOST_BOUND_ARTIFACTS`.** Depends on nothing from step 1 structurally
   (the resolver's precedence logic — env → `tools.json` → probe — is
   independent of the *declaration's* content), but should be built with the
   declaration's tool-id vocabulary already fixed, so the two agree on names.
   This step also defines `tools.json`'s own schema (the *user-facing*,
   `.c64-re-tools/tools.json` override file — distinct from the
   *declaration*, which is developer-authored and committed). Unit-testable
   directly against its own unbuilt `.mts` source, following
   `backend-detect.test.ts`'s own precedent of importing `./backend-detect.mts`
   directly rather than only through the control-plane.
3. **Wire the seam into existing consumers.** Modify `host-tool.mts`'s five
   resolution sites (§1's table) and, per the open design question in §1,
   either `resolvedBackend()` internally or `broker-launch.mts`'s two
   `VICE_BIN` reads. This is the first step that touches
   `resources-sync.test.ts`-guarded files, so it is also the first step that
   requires `node build.ts` to be re-run and the diff of `resources/*.mjs`
   committed.
4. **The doctor CLI.** Depends on steps 1-3 existing: it reads the
   declaration (step 1) to know what to probe and how to describe it, and
   calls the seam (steps 2-3) to get real answers. New host-bound `.mts`
   entry point, new `HOST_BOUND_ARTIFACTS` member, new `bin` entry in
   `src/mcp/vice/package.json`.
5. **The README generator.** Depends on step 1 (the declaration) only,
   structurally — but should land after step 4 so it can borrow the doctor's
   own per-tool descriptions rather than inventing a third rendering of the
   same data. Guarded semantically, per the milestone's own instruction
   (`.planning/PROJECT.md:1965-1968`), not byte-for-byte.

**New components:** the declaration file, the `tool-location.mts` seam
module, the doctor CLI entry (`.mts` + compiled `.mjs` + new `bin` entry), the
README generator script, a `tools.json` schema/loader, a `tools.json` template
writer ("the doctor writes a commented template on request",
`.planning/PROJECT.md:1954-1955`).

**Modified components:** `build.ts` (`HOST_BOUND_ARTIFACTS` array, twice —
once for the seam, once for the doctor entry), `host-tool.mts` (five
resolution sites rerouted through the seam), `backend-detect.mts` and/or
`broker-launch.mts` (per the §1 open design question), `src/mcp/vice/
package.json` (`files[]` gains the declaration; `bin` gains the doctor
entry), possibly `installer/package.json`'s `files[]` (open question, §3),
`README.md` (becomes generated/verified rather than hand-kept, at least for
the VICE table), `src/skills/acme-build/SKILL.md` (its prefix list becomes a
candidate for sourcing from the same declaration rather than being a fourth
hand-kept copy — not required by the milestone but worth flagging as the
same fragmentation class).

## 5. What must NOT change

Every one of these is a named, tested invariant in the tree today — not
general advice:

- **The broker's synchronous `inFlight` launch guard
  (`broker-launch.mts:80-94`, checked at `:574-579` and `:679-684`).**
  `backend-detect.mts`'s own header states this explicitly:
  *"Do not call resolvedBackend() from inside broker-launch.mts's `inFlight`
  single-owner launch guard. This still performs filesystem I/O... anything
  that can block inside that synchronous check-and-set window is the exact
  failure class the 2026-08-01 triple-launch outage came from"*
  (`backend-detect.mts:37-43`). **The new seam inherits this constraint
  exactly** — it also performs filesystem I/O (`tools.json` read, plus
  whatever probes it wraps), and must never be called from inside that
  synchronous window either. If `broker-launch.mts` is one of the modules
  rerouted through the seam (§1's open question), this is the single most
  important thing to get right.
- **`resources-sync.test.ts`'s byte-identical build comparison** — every new
  `HOST_BOUND_ARTIFACTS` addition (the seam, the doctor entry) must be
  produced by `node build.ts` and the resulting `resources/*.mjs` committed;
  a hand-edited `resources/*.mjs` fails this test outright, by design
  (`resources-sync.test.ts:1-8`).
- **Memoisation semantics of `resolvedBackend()` and `findSiblingBinary()`**
  — both are correct *because* they are per-process, including a memoised
  `null`. The new seam must either delegate to these functions unchanged
  (preferred) or, if it introduces its own memoisation layer, must not
  contradict them (e.g. must not re-derive a `$PATH` walk that could answer
  differently on a second call within the same broker process).
- **The container-out seam for spawning.** `host-tool.mts` is "the ONE place
  that turns an untrusted wire request into a real child process on the
  HOST" (`host-tool.mts:3-11`) and does so only via `spawn` (async, never
  `spawnSync`, never a shell string — `host-tool.mts:22-25`). Nothing about
  location resolution should introduce a *second* spawn site. The seam
  resolves paths; it must never itself launch a probe subprocess outside the
  existing `spawnAndRecordInstance`/`runHostTool` spawn points — a
  version-probe subprocess (explicitly withdrawn already, per
  `host-tool.mts:2256-2257`: *"No version probe: deliberately withdrawn by
  the project owner — this stays a name-and-location probe only and must not
  gain one back"*) would violate both this rule and a standing owner
  decision in one move.
- **`findDxaBinary()`'s immunity to override** (`host-tool.mts:126-131`,
  §1 above) — do not let the new `env → file → probe` precedence chain apply
  to a project-vendored, project-built binary.
- **The never-auto-install rule and its three carve-outs**
  (`CLAUDE.md`'s "Dependency" bullet; restated as unchanged by the milestone,
  `.planning/PROJECT.md:1901-1906`). The doctor detects and reports; it must
  never invoke a package manager, never fetch-and-build, and never `npx -y` a
  third-party package on a user's behalf. This is explicitly *not*
  re-litigated by this milestone.
- **The seven-synchronized-edit-sites discipline for `HostToolId`**
  (`host-tool.mts:140-166`, enforced by `host-tool.test.ts`'s "both-directions
  census"). The doctor probing ACME/Ghidra/c1541/petcat/dxa/x64sc does **not**
  require adding any of them as a new `HostToolId` — they already have
  dedicated probe functions outside that allowlist (`findAcmeLib`,
  `findDxaBinary`, `findSiblingBinary`, `resolvedBackend`). Do not conflate
  "the doctor needs to check this tool" with "this tool needs a new
  `host_tool` wire operation" — the milestone is explicit that this is a
  reporting/location surface over existing probes, not a new capability
  (`.planning/PROJECT.md:1976-1980`).

## Open Questions (not determined from the tree — do not guess these away)

- Whether `resolvedBackend()` itself should gain the `tools.json` precedence
  step internally (keeping it the sole `x64sc` authority) versus the new
  seam wrapping it externally (§1). Both avoid a cycle; this is a design
  call for the phase, not a fact this research found in the code.
- Whether the installer package needs to consume the declaration at all in
  this milestone, or whether that is out of scope under "no install path is
  added, removed or collapsed" (§3). The milestone's text is ambiguous
  between "the installer prints prerequisite info" (arguably in scope, not
  an install-path change) and "nothing about the installer changes" (also a
  defensible reading).
- The exact filename/location for the declaration and for `tool-location.mts`
  are proposals in this document, not settled names — nothing in the tree
  today names them, so the phase is free to choose, but should pick names
  consistent with the existing `*-detect.mts` / `*-tool.mts` naming pattern.
- Whether `vice.json`/`tools.json`'s template-writing behavior ("the doctor
  writes a commented template on request", `.planning/PROJECT.md:1954-1955`)
  needs its own schema-validation pass, or whether `resolveToolLocation()`'s
  own defensive `isPlainObject()`-style narrowing (matching
  `backend-detect.mts:129-131`'s existing idiom) is sufficient. Not resolved
  by this research — a schema-validation library would be a new dependency,
  which this codebase visibly avoids elsewhere (no `.eslintrc`, no
  `biome.json`, hand-rolled narrowing throughout `host-tool.mts`).
