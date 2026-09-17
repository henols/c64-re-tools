# Phase 58: One Declaration, Four Places That Can No Longer Disagree - Research

**Researched:** 2026-09-17
**Domain:** In-repo data-file consolidation (JSON declaration), packaging evidence, low-Node CI proof. No new runtime dependency, no MCP tool surface change.
**Confidence:** HIGH

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01/D-02 (measured, stale-roadmap correction):** `README.md` carries **one**
  install table, for VICE only (`README.md:99-107`) — eight ecosystem rows. There
  is **no** README install line for ACME, `c1541`, `petcat`, Ghidra, dxa or Node.
  `acme-build/SKILL.md` **no longer** carries the ACME prefix list — `SKILL.md:211-212`
  says the prefixes are "none of them documented a second time here"; they exist in
  exactly one place, `findAcmeLib()` at `host-tool.mts:2231-2246`. `CLAUDE.md`'s
  citation of `SKILL.md` for "four documented prefixes" is stale; correcting it is
  explicitly **not** a Phase 58 deliverable.
- **D-03 (criterion 5 amended, not reinterpreted):** every remedy string carries a
  three-valued `provenance`: `measured` (this project observed it work — today
  exactly `sudo apt install acme`, run every CI build), `carried` (copied from an
  in-tree string, record names `file:line`), `authored` (derived from the tool's
  own upstream docs, record names that source). No string may be unlabeled.
  Reversibility: costly.
- **D-04 (per-string provenance in JSON; reasoning in docs):**
  `docs/phase58-declaration-provenance.md`, styled like `docs/stock-hard-losses.md`
  and `docs/phase40-preprocessing-tools-decisions.md`, records every case where two
  sources disagreed and which won. The JSON tag is what a test asserts; the doc is
  what a human reads.
- **D-05 (one disagreement already identified and must be recorded):**
  `README.md:96-97` frames the VICE 3.10 gate as load-bearing (`CPUHISTORY_GET`
  behind the cycle stopwatch); `.planning/REQUIREMENTS.md:88` records the opposite
  and is the later evidence ("No shipped tool refuses on one. `vice_cpu_history`
  runs over the text channel (`chis`)"). REQUIREMENTS.md wins. Worked example for
  the provenance doc.
- **D-06 (record shape — platform keys are OS-level, ecosystems nest beneath):**
  Top level `linux` / `darwin` / `win32` (`process.platform`-matchable). Each
  carries an ordered list of ecosystem entries (`debian-trixie`, `ubuntu-2510`,
  `arch`, `fedora-rpmfusion`, `alpine-edge`, `homebrew`, `windows-official`, …).
  Rejected: a flat ecosystem-row list, and a separate short per-OS remedy beside a
  separate ecosystem table. Reversibility: costly.
- **D-07 (ACME library is its own record):** separate from the ACME binary.
  Carried remedy: `export ACME=<dir holding cbm/c64/vic.a>` (`SKILL.md:255`); the
  four probe prefixes come from `findAcmeLib()` (`host-tool.mts:2237-2243`), now
  their only home.
- **D-08 (`unblocks` is keyed by two closed, checkable vocabularies):** skills by
  `src/skills/<name>/` directory name (nine of them); MCP capabilities by
  `host_tool` op id — explicitly `acme.build`, `dxa.disassemble`, `ghidra.analyze`,
  and the `c1541.*` / `petcat.*` ops. Do **not** key by individual `vice_*`/`anno_*`
  tool names.
- **D-09 (remedy strings are prose containing a command, never structured argv):**
  `"Enable the contrib component first, then run: sudo apt install vice"` as one
  string, never `{"cmd": "apt", ...}`. A test should assert the shape. Reversibility:
  one-way in spirit (rests on the milestone's governing constraint).
- **D-10 (direct user decision — both VICE version columns dropped):** the
  declaration carries **no** VICE version data of any kind — not a floor, not a
  dated observation. `DECL-04` holds literally.
- **D-11 (correction split, reverse of the obvious):** `README.md:99-107` (the
  generated table) is Phase 62's problem. `README.md:113-119` ("What a sub-3.10
  VICE costs") sits **outside** the generated section and nothing regenerates it —
  **Phase 58 rewrites that prose** now, since a false claim standing for four more
  phases is worse than the (accepted) markdown-only deviation from "data only".
- **D-12 (file placement and name):** `src/mcp/vice/prerequisites.json`. Must live
  under `src/mcp/vice/` to be reachable by that package's `files[]`.
  **Not** `tools.declaration.json` (research's proposal) — reserved to avoid
  confusion with the user's own `.c64-re-tools/tools.json` (`LOC-01`).
  Reversibility: costly.
- **D-13 (DECL-05 proof is off the tarball's own file list):** an explicit named
  assertion in `scripts/check-npm-packages.mjs` reading `vice.files`, in the style
  already documented at `scripts/check-npm-packages.mjs:16-18`. A repo-path
  `existsSync` check would pass while the published package silently omits the
  file (the CR-07 failure shape).
- **D-14 (the low-Node floor is 18, not invented):** the number is the floor this
  project already declares for a package users run (`installer/package.json:16`,
  `">=18"`). `DECL-02`'s proof is a CI matrix cell that `JSON.parse`s
  `prerequisites.json` under Node 18. All four current CI jobs pin Node 24; this
  cell is new. Phase 61's `DOCTOR-02` cell later runs the real doctor entry point
  on the same floor — one number, two phases.
- **D-15 (the Node 18 cell uses `actions/setup-node`):** not a package-manager
  invocation of an external prerequisite (the milestone's governing constraint
  forbids `apt`/`nvm`/`npm i -g` for this).

### Claude's Discretion

Reversible on new evidence: **D-03, D-04, D-06, D-11** — reasoning stated inline
above. D-10 is the one direct user answer.

### Deferred Ideas (OUT OF SCOPE)

- Correcting `CLAUDE.md`'s stale ACME-prefix citation (D-02) — real, not a Phase 58
  deliverable (mirrored from `.planning/PROJECT.md`; a CLAUDE.md-only edit would be
  wiped on next regeneration).
- Generating `acme-build/SKILL.md`'s prefix list from the declaration (`DECL-F2`) —
  moot as written since D-02 establishes the list is no longer in SKILL.md at all.
- The installer package consuming the declaration for a "what you will need"
  message (`DECL-F1`) — deferred.
- A per-machine `~/.config/c64-re-tools/tools.json` (`DOCTOR-F2`) — deferred.
- `DECL-03` (every live refusal sourcing its remedy from this file) — explicitly
  **not** this phase. Owned by Phase 60 (compiled `resources/*.mjs` regeneration
  risk isolated there).
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| DECL-01 | One committed declaration names every prerequisite, and for each records id, unblocked skills/MCP capabilities, and per-platform remedy text. | See "Standard Stack" record schema below and the two closed vocabularies enumerated under D-08 (nine skill dirs, nine `host_tool` op ids). Verified via `Read` at `src/skills/` (`ls`) and `host-tool.mts:181-193` (`HOST_TOOL_IDS`). |
| DECL-02 | Plain JSON, `JSON.parse`, no new runtime dependency, proven to parse under Node 18. | See "Environment Availability" (Node 18 installable and exercised live on this host via `nvm`) and "Validation Architecture" (new CI matrix cell using `actions/setup-node@v4`, `node-version: "18"`). |
| DECL-04 | Node is the only record carrying a version-floor field; a non-vacuous test proves it. | See "Common Pitfalls" (Pitfall 3) and "Code Examples" (planted-violation pattern already used in `anno-cli.test.ts:1286`). |
| DECL-05 | Declaration ships in the published `vice-mcp` tarball; `check-npm-packages.mjs` asserts it. | See "Code Examples" (the `vice.files.includes(...)` idiom already used for `THIRD-PARTY-NOTICES.md` at `check-npm-packages.mjs:181-184`). |
</phase_requirements>

## Summary

Phase 58 adds exactly one new committed data file — `src/mcp/vice/prerequisites.json`
— plus one new docs file (`docs/phase58-declaration-provenance.md`), one new
`package.json` `files[]` entry, one new named assertion in
`scripts/check-npm-packages.mjs`, one new CI job/step pinned to Node 18, and a
prose rewrite at `README.md:113-119`. Every other file this phase's goal names
(`host-tool.mts`, `backend-detect.mts`, the generated README table) is read-only
this phase — nothing wires a live refusal to the new file (that is `DECL-03`,
Phase 60), and nothing regenerates the compiled `resources/*.mjs` artifacts.

Two of the four "disagreeing places" the roadmap's goal text names are, on direct
inspection, not what the goal text describes: there is **one** README table (VICE
only, not "per-distro tables" plural covering multiple tools), and the ACME prefix
list has already been withdrawn from `SKILL.md` in favor of `findAcmeLib()` as its
sole home. CONTEXT.md already records both corrections (D-01/D-02); this research
independently re-verified both by reading the cited files line-for-line and found
them accurate. A third, more consequential fact this research adds: the c1541/
petcat "sibling" refusal in `host-tool.mts` carries **no remedy text at all today**
— it names the paths it tried and stops. Since c1541/petcat ship in the same OS
package as `x64sc` (installing `vice` installs all three), the declaration's
remedy for those two tools is not free-standing "carried" text — it is the VICE
table's own remedy, reused for a different tool id, and that reuse decision
belongs in the provenance doc alongside the D-05 worked example.

**Primary recommendation:** Model `prerequisites.json` as a hand-authored,
non-generated JSON object keyed by tool id (nine records: `x64sc`, `c1541`,
`petcat`, `acme`, `acme-lib`, `ghidra`, `dxa`, `node`, and — recommended, see Open
Questions — a distinct approach for dxa's single non-platform-keyed remedy). Each
record carries `unblocks: { skills: [...], mcp: [...] }` drawn from the two closed
vocabularies, and `remedies` nested `platform -> ecosystem -> { text, provenance,
source }` per D-06/D-03. Reuse the project's own `assert relations, not counts`
convention (`scripts/lib/skill-corpus.mjs`'s `topLevelSkillDirs()`) for the
skill-vocabulary test rather than re-deriving a directory walk locally.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Prerequisite metadata (id, unblocks, remedy text) | Data / Committed config | — | A plain JSON file under `src/mcp/vice/`, read with `JSON.parse` by any future consumer regardless of that consumer's own Node floor. Not a "backend" tier — it has no runtime behavior. |
| Packaging proof (`files[]` + tarball assertion) | Build / Packaging tooling | — | `scripts/check-npm-packages.mjs` runs outside any served process, at publish-validation time only. |
| Low-Node parse proof | CI / Platform tooling | — | A GitHub Actions matrix cell using `actions/setup-node@v4`; not shipped code, not a runtime dependency. |
| README prose correction (`README.md:113-119`) | Docs | — | Hand-edited markdown outside Phase 62's generated section; no code path reads it. |
| Live refusal strings (`host-tool.mts`, `backend-detect.mts`) | API / Backend (host-tool seam) | — | **Explicitly out of scope this phase** (`DECL-03`, Phase 60) — these keep reading their own inline literals until Phase 60 repoints them. |

This map exists to make explicit that Phase 58 touches **no** runtime tier at all
— every deliverable is data, docs, or build/CI tooling. A plan that adds a task
importing `prerequisites.json` from `host-tool.mts` or `backend-detect.mts` is
out of scope and should be rejected at plan-check.

## Standard Stack

No new dependency of any kind. `JSON.parse` is a JS built-in; `node:fs`'s
`readFileSync` and `existsSync` are already imported throughout this codebase
(`host-tool.mts`, `check-npm-packages.mjs`). No `npm install` is part of this
phase — the Package Legitimacy Gate is therefore not applicable (see below).

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| (none — `node:fs`/`JSON.parse` only) | Node built-in | Read and parse the declaration | Zero-dependency, works on every Node floor down to the ES5 era; matches `anno-regbits.json`/`tools-manifest.stock.json` precedent in this repo |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `node --test` (built-in) | Node 24 (test runner), matches project convention | New colocated `prerequisites.test.ts` | Already the project's sole test framework; no new tooling |
| `actions/setup-node@v4` | Already pinned elsewhere in `ci.yml` (used at `node-version: "24"` four times) | Provision a second, older Node runtime for the DECL-02 proof | Not a package-manager invocation of an external *prerequisite* — provisioning a language runtime for CI is outside the never-auto-install constraint's scope (that constraint is about `x64sc`/ACME/Ghidra/dxa, not about which Node CI itself runs on) |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Plain `.json` | `.ts`/`.mts` module exporting the declaration | Rejected by D-12/D-02: a `.ts` source cannot be read by a Node below the server's own floor without type-stripping support, which is exactly the problem being solved (mirrors `installer/bin/cli.mjs:32-48`'s documented reason for not importing `version.ts`) |
| One flat ecosystem-row array | Nested `platform -> ecosystem` tree (D-06) | Rejected: a flat list gives the future doctor no way to select "the right five Linux rows" from `process.platform` alone |

**Installation:** None — no `npm install` command applies to this phase.

**Version verification:** N/A — no package versions to verify. `node:fs` and
`JSON.parse` are part of every supported Node runtime.

## Package Legitimacy Audit

**Not applicable to this phase.** No package is added to any `package.json`
`dependencies`/`devDependencies` in this phase — `prerequisites.json` is a
hand-authored data file, not an installed package, and `DECL-02` explicitly
requires "adding no new runtime dependency." The Package Legitimacy Gate
protocol therefore has no packages to check.

## Architecture Patterns

### System Architecture Diagram

```
                     ┌───────────────────────────────┐
                     │  src/mcp/vice/prerequisites.json│   <- NEW this phase
                     │  (hand-authored, committed)     │
                     └───────────────┬──────────────────┘
                                     │  read by (FUTURE phases only)
              ┌──────────────────────┼───────────────────────┐
              │                      │                       │
              ▼                      ▼                       ▼
   Phase 60: host-tool.mts   Phase 61: doctor CLI     Phase 62: README
   / backend-detect.mts      (new, low-Node entry)    generator
   live refusals read        reads declaration,       reads declaration,
   remedy text from here     resolves each tool,       re-emits the VICE
   (DECL-03 — NOT this       prints readiness report   table + any new
   phase)                    (DOCTOR-01..09)           per-tool tables
                                                        (GEN-01..03)

   Phase 58's OWN consumers (this phase only):
   ┌────────────────────────────┐   ┌───────────────────────────────┐
   │ scripts/check-npm-packages │   │ CI: new Node-18 matrix cell    │
   │ .mjs — asserts             │   │ (actions/setup-node@v4,        │
   │ vice.files includes        │   │  node-version: "18") reads and │
   │ "prerequisites.json"       │   │ JSON.parses the same file      │
   │ (DECL-05)                  │   │ (DECL-02)                      │
   └────────────────────────────┘   └───────────────────────────────┘

   Also this phase, no relation to the JSON file's runtime path:
   README.md:113-119 prose rewrite (D-11) — hand-edited, no reader.
```

A reader tracing "how does a missing tool eventually produce a remedy message"
should note that **no arrow into a live code path exists yet** at the end of
Phase 58 — the diagram's dashed relationship to Phase 60/61/62 is prospective,
not something this phase builds or tests.

### Recommended Project Structure
```
src/mcp/vice/
├── prerequisites.json          # NEW — the one declaration (D-12)
├── prerequisites.test.ts       # NEW — colocated, node --test convention
├── package.json                # files[] gains one entry
docs/
├── phase58-declaration-provenance.md   # NEW — D-04, styled like stock-hard-losses.md
scripts/
├── check-npm-packages.mjs      # gains one named assertion (D-13)
.github/workflows/
├── ci.yml                      # gains one Node-18 matrix cell/step (D-14/D-15)
README.md                       # lines 113-119 rewritten (D-11); lines 99-107 untouched (Phase 62's job)
```

### Pattern 1: Hand-authored committed JSON, read by `JSON.parse` + `readFileSync`
**What:** A plain-data `.json` file under `src/mcp/vice/`, listed in `files[]`,
read the same way `anno-regbits.json` and `tools-manifest.stock.json` already are.
**When to use:** Any data a consumer must read regardless of that consumer's own
Node/TypeScript capability.
**Example:**
```typescript
// Source: src/mcp/vice/anno-regbits.test.ts:48 (pattern already in this repo)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));

function readPrerequisites(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(HERE, "prerequisites.json"), "utf8")) as Record<string, unknown>;
}
```
[VERIFIED: src/mcp/vice/anno-regbits.test.ts:46-49 — quoted below] —
```
function readCommittedDoc(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(HERE, "anno-regbits.json"), "utf8")) as Record<string, unknown>;
}
```

### Pattern 2: Assert relations, not counts, against an enumerable tree
**What:** Reuse `scripts/lib/skill-corpus.mjs`'s `topLevelSkillDirs()` (already
imported by `scripts/check-npm-packages.mjs`) to enumerate the nine skill
directories, rather than re-deriving a `readdirSync` walk inline in a new test.
**When to use:** The `DECL-01` closed-vocabulary test (`unblocks.skills` values
must all be real skill directory names; conversely every skill directory that
actually depends on a host tool should appear at least once across the
declaration).
**Example:**
```javascript
// Source: scripts/check-npm-packages.mjs:5 (import already exists in this file)
import { topLevelSkillDirs } from "./lib/skill-corpus.mjs";
```
[VERIFIED: scripts/check-npm-packages.mjs:60 — `import { topLevelSkillDirs } from "./lib/skill-corpus.mjs";`]

Note: this import lives in a `scripts/*.mjs` file. A colocated
`src/mcp/vice/prerequisites.test.ts` reaching the same helper would need a
relative import `../../../scripts/lib/skill-corpus.mjs` (three levels up from
`src/mcp/vice/`) or `../../scripts/lib/skill-corpus.mjs` (two levels, if the test
lives at `src/mcp/vice/` — verify the actual hop count against
`anno-regbits.test.ts:87-90`'s own documented hop-count caveat before writing
this, since a wrong relative depth is a documented recurring mistake in this
repo). Alternative: enumerate `src/skills/` directly with `readdirSync` inside
the new test, mirroring `anno-regbits.test.ts`'s own precedent of reaching
`src/skills/...` directly rather than only through the shared helper — either is
consistent with existing convention; importing the shared helper is preferred
per CLAUDE.md's "import the owning function, don't recompute it inline" rule,
if the relative path can be gotten right.

### Pattern 3: Non-vacuous guard via an in-memory planted violation (no fixture mutation)
**What:** `DECL-04`'s "no other record carries a version-floor field" test needs
a planted-violation proof per `ENGINEERING_RULES.md` §6. This project's existing
convention for this shape is to construct a synthetic in-memory clone with the
violation injected, rather than mutating the committed file on disk mid-test.
**When to use:** Exactly this case — a real record that should never carry a
`versionFloor`-like field is cloned in the test with one injected, and the same
validation function that runs over the loaded document must be observed to
reject it.
**Example (matches the project's existing "planted violation" idiom):**
```typescript
// Source: src/mcp/vice/anno-cli.test.ts:1286 (pattern name and shape; this
// project's own precedent for "guard's planted violation is reported")
test("structural: the guard's planted violation is reported and its wrapped control is not (non-vacuity)", () => {
  const clean = readPrerequisites();
  assertNoStrayVersionFloor(clean); // passes on the real, committed file

  const poisoned = structuredClone(clean);
  (poisoned as any).acme.versionFloor = "0.97"; // planted, never committed
  assert.throws(() => assertNoStrayVersionFloor(poisoned));
});
```

### Anti-Patterns to Avoid
- **Runtime coupling to `host-tool.mts`/`backend-detect.mts` this phase:** Do not
  make any refusal string interpolate `prerequisites.json` at runtime yet. That
  is `DECL-03`, deliberately deferred to Phase 60 because it requires
  regenerating the compiled `resources/*.mjs` artifacts that
  `resources-sync.test.ts` guards byte-identically. [CONTEXT.md D-explicit / ROADMAP.md "Departure 1"]
- **Structured argv fields:** Never shape a remedy as `{cmd, args}` — D-09 makes
  this the phase's cross-cutting no-execute guarantee, testable by asserting
  every remedy value is a `string`, never an object/array.
- **Byte-identical drift guards for anything Phase 62 later generates:** Not
  applicable to Phase 58's own deliverables (nothing here is generated), but
  worth naming so a plan doesn't accidentally add a byte-diff guard against
  `README.md:99-107` — that assertion class was deliberately removed
  (`ENGINEERING_RULES.md` §11, owner decision 2026-09-13).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Enumerating the nine skill directories | A new `readdirSync` walk with its own regex | `topLevelSkillDirs()` (`scripts/lib/skill-corpus.mjs:90`) or the same inline pattern `anno-regbits.test.ts` already uses to reach `src/skills/` | `scripts/lib/skill-corpus.mjs`'s own header names the exact failure mode of a second copy: "one CI gate passing while the other should have failed" |
| Packaging-presence proof | A repo-path `existsSync("src/mcp/vice/prerequisites.json")` check | `vice.files.includes("prerequisites.json")` against `npm pack --dry-run --json`'s own output (`scripts/check-npm-packages.mjs`'s `packFiles()`) | Documented in this file's own header: a filesystem check passes even when the published tarball silently omits the file — the CR-07 failure shape this project has already been burned by once |
| Version-floor exemption logic | A special-cased `if (id !== "node")` check duplicated in multiple tests | One shared validator function (e.g. `assertNoStrayVersionFloor()`) that both the real-file test and the planted-violation test call | Two independent implementations of "what counts as a version-floor field" can silently diverge |

**Key insight:** Every "don't hand-roll" here is really "don't re-derive a
cross-cutting seam locally" — the exact anti-pattern this codebase's CLAUDE.md
already names and that `scripts/lib/skill-corpus.mjs`'s own header cites a real
incident for.

## Common Pitfalls

### Pitfall 1: Treating the roadmap's "four disagreeing places" description as literal scope
**What goes wrong:** A plan that goes looking for "README's per-distro tables"
(plural, multi-tool) or "the ACME prefix list in SKILL.md" will find neither —
README has exactly one table (VICE-only), and SKILL.md explicitly disclaims
carrying the prefix list a second time.
**Why it happens:** The roadmap goal text was written before the tree was
re-measured on 2026-09-16; CONTEXT.md's D-01/D-02 already correct this, but a
plan or executor skimming only the phase description in ROADMAP.md (not
CONTEXT.md) could still chase the stale premise.
**How to avoid:** Cite `README.md:99-119` and `SKILL.md:211-212` directly in the
plan rather than paraphrasing the roadmap goal text.
**Warning signs:** A task described as "extract the per-distro tables from
README" (plural) or "move the ACME prefix list out of SKILL.md" (nothing to move).

### Pitfall 2: Treating c1541/petcat's missing remedy as something to "carry" without deciding first
**What goes wrong:** `findSiblingBinary()`'s refusal (`host-tool.mts:1555-1559`,
`1630-1634` call sites; refusal built at `host-tool.mts:2273-2305`+ its two
callers) carries `tried: [...]` paths but **zero remedy text** — there is nothing
to literally "carry" from that refusal. The only real remedy anywhere in the tree
for these two binaries is the VICE install table (`README.md:99-107`), written
for `x64sc`.
[VERIFIED: src/mcp/vice/host-tool.mts:1555-1559 — quoted:]
```
    const c1541Found = findSiblingBinary("c1541", resolvedBackend().binPath, log);
    if (c1541Found.path === null) {
      return {
        ok: false,
        message: `host_tool "${request.tool}" refuses: "c1541" does not exist (tried: ${c1541Found.tried.join(", ")})`,
      };
    }
```
**Why it happens:** c1541/petcat have never needed independent install
documentation because they ship inside the same OS package as `x64sc`
(`apt install vice`/`brew install vice`/etc. installs all three binaries
together) — but the declaration's schema is per-tool-id, so this reuse must be
an explicit authoring decision, not an accident of copy-paste.
**How to avoid:** Record this explicitly in `docs/phase58-declaration-provenance.md`
as a second worked case alongside D-05: "c1541 and petcat's remedy text is the
VICE install table's own text, reused, because installing the `vice`/VICE
package installs all three binaries together; provenance is `carried` from
`README.md:99-107`, not `authored`."
**Warning signs:** A `prerequisites.json` where `c1541`/`petcat` remedies are
freshly worded prose that doesn't match the VICE table's wording — that is
"invented at authoring time," which criterion 5 forbids.

### Pitfall 3: An always-true `DECL-04` guard
**What goes wrong:** A test that asserts "no record has a `versionFloor` field
except `node`'s" will pass trivially on a file where the field type is never
defined anywhere else in the schema — proving nothing (`ENGINEERING_RULES.md`
§6's exact concern, and flagged as an open question in CONTEXT.md's `<specifics>`
block).
**Why it happens:** A schema-shaped assertion (TypeScript type checking, or a
`for (id in doc) if (id !== "node") assert(!doc[id].versionFloor)`) is vacuously
true if nothing in the authoring process could ever have produced a violation —
the guard has never been observed to fail.
**How to avoid:** Use Pattern 3 above — clone the real document in-memory, plant
a `versionFloor` on a non-Node record, and assert the shared validator throws.
Revert nothing on disk; the poisoned copy never leaves test memory.
**Warning signs:** A `DECL-04` test with no `structuredClone`/mutation step at
all, or one that only checks TypeScript's static type (which would not run
against the actual JSON content).

### Pitfall 4: Conflating the "measured" provenance's actual scope
**What goes wrong:** D-03 states the `measured` provenance applies to
`sudo apt install acme` "on Debian/Ubuntu," but the CI step that actually
executes and observes this (`ci.yml:65-81`) runs on GitHub's `ubuntu-latest`
runner — genuinely Ubuntu, with no repository-component enabling step at all.
The step's own comment says the package name was "verified... against Debian
trixie during planning," which is a *name-verification* claim, not the same
thing as *this specific ecosystem row having been observed installing
successfully*.
[VERIFIED: .github/workflows/ci.yml:17-18,65-81 — job `runs-on: ubuntu-latest`;
quoted steps: `retry_apt update`, `retry_apt install -y acme`, `command -v acme`,
`{ acme --version || acme --help; } 2>&1 | head -5 | tee /tmp/acme-banner.txt`,
`grep -qi acme /tmp/acme-banner.txt`]
**Why it happens:** "Debian/Ubuntu" reads as one ecosystem family in prose, but
D-06's schema keys ecosystems individually (`debian-trixie` vs. `ubuntu-2510`
are separate entries in the VICE table already). If the ACME record reuses the
same ecosystem keys, only the one CI actually exercises (`ubuntu-*`, whatever
`ubuntu-latest` resolves to at authoring time) should be tagged `measured`; a
`debian-trixie` row for ACME, even with identical command text, has not
actually been observed by this project's CI and should be `authored` or
`carried` from the same measured text with a note, not silently promoted to
`measured` by association.
**How to avoid:** Record the exact runner OS/version CI resolves to at
authoring time (`ubuntu-latest` is a moving target — pin the observed version in
the provenance doc, not just the label) and scope the `measured` tag to that one
ecosystem key only.
**Warning signs:** Every Linux ecosystem row for ACME tagged `measured` when
only one was actually run.

## Code Examples

### Reading and validating the declaration (schema sketch)
```typescript
// Illustrative only — not copied from any existing file, since this file is
// new. Field names deliberately mirror the vocabulary CONTEXT.md's decisions
// already fix (D-06 platform/ecosystem nesting, D-08 unblocks vocabularies,
// D-09 remedy-as-prose, D-03 three-valued provenance).
type Provenance = "measured" | "carried" | "authored";

interface RemedyEntry {
  text: string;               // D-09: prose containing a command, never structured argv
  provenance: Provenance;     // D-03
  source: string;             // file:line, CI step name, or upstream doc URL
}

interface ToolRecord {
  id: string;                              // e.g. "x64sc", "c1541", "acme-lib", "node"
  unblocks: {
    skills: string[];                      // must be real src/skills/<name>/ dirs (D-08)
    mcp: string[];                         // must be real HOST_TOOL_IDS entries (D-08)
  };
  versionFloor?: string;                   // ONLY "node" may carry this (DECL-04)
  remedies: Record<string, Record<string, RemedyEntry>>; // platform -> ecosystem -> entry (D-06)
}
```

### DECL-05 packaging assertion (mirrors the existing style exactly)
```javascript
// Source: scripts/check-npm-packages.mjs:181-184 (existing pattern for a
// different file; the new assertion for prerequisites.json should read
// identically in shape)
need(
  vice.files.includes("THIRD-PARTY-NOTICES.md"),
  "vice-mcp: missing THIRD-PARTY-NOTICES.md -- criterion 5 requires the opcode table's zlib provenance to ship with the package (D-07)"
);
```
[VERIFIED: scripts/check-npm-packages.mjs:181-184 — quoted verbatim above.]
The new `DECL-05` assertion should follow the identical shape:
`need(vice.files.includes("prerequisites.json"), "vice-mcp: missing prerequisites.json -- DECL-05 requires the same remedies to reach an npm-installed user");`

### The Node-18 CI proof (new job/step, mirrors existing `actions/setup-node` usage)
```yaml
# Illustrative — mirrors .github/workflows/ci.yml's existing four uses of
# actions/setup-node@v4 (lines 31-33, 235-237, 276-278, 341-344), all currently
# pinned to node-version: "24". This is the first cell pinned lower.
- uses: actions/setup-node@v4
  with:
    node-version: "18"
- name: Prove prerequisites.json parses on the installer's own Node floor (DECL-02)
  run: node -e "JSON.parse(require('fs').readFileSync('src/mcp/vice/prerequisites.json','utf8')); console.log('OK')"
```
[VERIFIED: .github/workflows/ci.yml:31-33 — `- uses: actions/setup-node@v4` /
`with:` / `node-version: "24"`, confirming the existing idiom this mirrors at a
different version number.]

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| README's VICE table asserts "Clears the 3.10 gate?" as consequential | No shipped tool refuses on the VICE-version gate (`vice_cpu_history` runs over text channel) | Measured and recorded in `.planning/REQUIREMENTS.md:85,88` before this phase began | D-10 drops both version columns entirely rather than reframing them; D-11 requires the now-false `README.md:113-119` prose to be corrected in this same phase |

**Deprecated/outdated:** The premise that this milestone's declaration needs a
VICE-version field at all — superseded by D-10's direct user decision.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `oracle.probe`, `oracle.run`, and `ghidra.installExtension` are correctly excluded from D-08's closed `mcp` vocabulary because nothing outside `host-tool.mts` itself and its own tests calls them (verified by grep across `src/mcp/vice/*.ts` and `src/skills/*/SKILL.md`, no other caller found) [ASSUMED — grep found no positive caller, which is an absence, not a proof no future phase adds one] | Standard Stack / D-08 discussion | Low — if a later phase surfaces one of these as a user-facing capability, the vocabulary needs one more entry; does not invalidate anything built this phase |
| A2 | `ubuntu-latest`'s specific OS version at authoring time is what CI's `measured` ACME install actually exercises, and this should be recorded precisely (not just "Ubuntu") in the provenance doc | Common Pitfalls (Pitfall 4) | Low-medium — an imprecise `measured` tag on the wrong ecosystem key would let a `DECL-04`-adjacent audit assume more coverage than CI actually provides |
| A3 | `topLevelSkillDirs()`'s relative import path from a new `src/mcp/vice/prerequisites.test.ts` is `../../scripts/lib/skill-corpus.mjs` (two levels up) — not independently re-verified against the exact directory depth; `anno-regbits.test.ts`'s own header explicitly warns this hop count has been gotten wrong before (plan 16-01 changed it from 2 to 3 hops for a *different* target path) | Architecture Patterns, Pattern 2 | Low — a wrong relative path fails loudly at `import` time (module not found), it does not silently misbehave |

**If this table is empty:** N/A — see entries above; none are load-bearing for
correctness, all fail loudly if wrong.

## Open Questions

1. **Does the declaration carry a `schemaVersion` field?**
   - What we know: `anno-store.ts` uses a `SCHEMA_VERSION` constant (4);
     `tools-manifest.stock.json` carries no version field at all. Both
     precedents exist in this tree and point opposite ways.
   - What's unclear: whether Phase 62's generator or Phase 61's doctor will ever
     need to detect a schema change (e.g. a `remedies` shape change) — nothing
     in DECL-01/02/04/05 requires it.
   - Recommendation: Since `prerequisites.json` is hand-authored (not
     generated) and has exactly one shipped consumer type (a doctor and a
     generator arriving in *later* phases), add a minimal `schemaVersion: 1`
     field now — it costs one key and forecloses a future "was this file ever
     versioned" question — but this is genuinely optional; either choice is
     defensible and CONTEXT.md left it open on purpose.

2. **Does dxa belong in the declaration, and with what remedy shape?**
   - What we know: dxa has a real, single, platform-agnostic remedy
     (`bash vendor/dxa/build.bash build`, `host-tool.mts:1472`) and `LOC-05`
     makes it deliberately un-overridable by file or environment (it is
     vendored and built by this project, unlike every other tool here).
   - What's unclear: whether dxa's record should still nest under
     `platform -> ecosystem` (D-06's general shape) with the identical remedy
     repeated under every platform, or should use a distinguishable top-level
     shape (e.g. a `universal` remedy key) since D-06 was designed around
     genuinely per-platform install commands.
   - Recommendation: Give dxa's record a single `remedies.universal` (or
     equivalent single-key) entry rather than repeating the identical string
     under `linux`/`darwin`/`win32` — repeating identical text three times
     invites drift if the build command ever changes, and this file has no
     other case of one remedy applying to every platform. Whichever shape is
     chosen, `docs/phase58-declaration-provenance.md` should say so explicitly,
     since it is the one record whose shape genuinely differs from the other
     eight (D-07 already anticipates this for `acme-lib`, though for a
     different reason — that record differs by being ITS OWN tool id, not by
     remedy shape).

3. **How is `DECL-04`'s non-vacuity test written so it stays non-vacuous over
   time** (not just at authoring time)?
   - What we know: `ENGINEERING_RULES.md` §6 requires a planted violation
     observed failing, not merely a schema that happens to disallow the field
     today.
   - What's unclear: whether the planted-violation test should run every CI
     invocation (cheap, in-memory, no reason not to) or only be a one-time
     authoring-time proof recorded in the plan's evidence.
   - Recommendation: Run it every time, in the same `prerequisites.test.ts` file
     — Pattern 3 above is cheap (one `structuredClone`, one injected field, one
     `assert.throws`) and costs nothing to run on every `npm test`.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node 24 (project's own floor) | Everything already in this repo | ✓ | v24.20.0 (confirmed via `node --version` on this host) | — |
| Node 18 (D-14's low floor, for local dry-run of the DECL-02 proof) | Local verification of the planned CI matrix cell | ✓ — installable and exercised live this session | v18.20.8, installed via `nvm install 18` and confirmed with `nvm exec 18 node -e "JSON.parse(...)"` returning the expected parsed object | CI's `actions/setup-node@v4` with `node-version: "18"` is the authoritative proof either way; local `nvm` is a convenience, not required |
| `actions/setup-node@v4` | The new CI matrix cell (D-15) | ✓ — already used four times elsewhere in `ci.yml` at version "24" | v4 (pinned action version, unchanged) | — |
| npm registry reachability (for `nvm install 18`) | Local dry-run only, not CI | ✓ — confirmed live (`curl -sI https://nodejs.org` returned HTTP 307, i.e. reachable) | — | — |

**Missing dependencies with no fallback:** None.

**Missing dependencies with fallback:** None — everything needed for this phase
is already present or trivially provisioned in CI.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in `node --test` (no separate framework; project-wide convention) |
| Config file | None — `src/mcp/vice/test-gate.mjs`'s `MANUAL_ONLY_TESTS` list governs which colocated `*.test.ts` files are excluded from the automated gate; a new `prerequisites.test.ts` needs no host dependency and terminates in milliseconds, so it must **not** be added to that list |
| Quick run command | `cd src/mcp/vice && node --test prerequisites.test.ts` |
| Full suite command | `cd src/mcp/vice && npm run test:automated` (project's own automated gate; per-repo `test_command` in `.planning/config.json` is exactly this) |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DECL-01 | Every record has id/unblocks/remedies; `unblocks.skills` values are real skill dirs; `unblocks.mcp` values are real `HOST_TOOL_IDS` entries; all nine tools (`x64sc`, `c1541`, `petcat`, acme binary, acme library, Ghidra, dxa, Node — 8 named in the goal, potentially 9 records counting acme/acme-lib separately per D-07) are present | unit (structural) | `node --test prerequisites.test.ts` | ❌ Wave 0 — new file |
| DECL-02 | `prerequisites.json` parses with `JSON.parse` under Node 18 | integration (CI-only, cannot be proven by a unit test running on whatever Node started `npm test`) | New CI step: `actions/setup-node@v4` (`node-version: "18"`) + `node -e "JSON.parse(...)"` | ❌ Wave 0 — new CI step, `.github/workflows/ci.yml` |
| DECL-04 | No record but `node`'s carries a version-floor field; a planted violation on a non-Node record is observed rejected | unit (structural, non-vacuous per `ENGINEERING_RULES.md` §6) | `node --test prerequisites.test.ts` | ❌ Wave 0 — new file |
| DECL-05 | `prerequisites.json` is in the packed `vice-mcp` tarball's own file list | unit/build-gate (reads `npm pack --dry-run --json` output, not the filesystem) | `node scripts/check-npm-packages.mjs` | ❌ Wave 0 — new assertion in existing file |

### Sampling Rate
- **Per task commit:** `cd src/mcp/vice && node --test prerequisites.test.ts` (fast, no host dependency)
- **Per wave merge:** `cd src/mcp/vice && npm run test:automated` plus `node scripts/check-npm-packages.mjs` (DECL-05 lives outside `npm test`)
- **Phase gate:** Full `npm run test:automated` green, `check-npm-packages.mjs` green, and the new CI matrix cell green (requires an actual CI run or `act`/manual GitHub Actions dispatch — cannot be proven purely locally, since D-14/D-15 require the *actual* GitHub Actions runner environment as the evidence, though a local `nvm exec 18` dry-run is a legitimate pre-CI sanity check per the Environment Availability findings above)

### Wave 0 Gaps
- [ ] `src/mcp/vice/prerequisites.test.ts` — covers DECL-01, DECL-04
- [ ] `src/mcp/vice/prerequisites.json` — the declaration itself (not a test, but the Wave 0 artifact every other test in this phase depends on)
- [ ] New assertion block in `scripts/check-npm-packages.mjs` — covers DECL-05
- [ ] New CI step in `.github/workflows/ci.yml` — covers DECL-02
- [ ] `docs/phase58-declaration-provenance.md` — not a test, but a required deliverable (D-04) that at least two other tests/docs cite (D-05's worked example, Pitfall 2's c1541/petcat case)

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | This phase adds no auth surface |
| V3 Session Management | no | No session concept touched |
| V4 Access Control | no | No access-control surface |
| V5 Input Validation | yes, narrowly | `prerequisites.json` is committed, trusted, first-party data — but any future consumer (Phase 61's doctor) must not trust it as executable input. This phase's own contribution to that guarantee is D-09: remedy strings are plain prose, never structured argv, tested by asserting every `text` field is a `string` and no record contains an `argv`/`cmd`/`args`-shaped field |
| V6 Cryptography | no | No secrets, no crypto surface |

### Known Threat Patterns for {stack}

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A remedy field shaped so a later reader could `execFile()` it directly, silently reopening the never-auto-install constraint two phases from now | Elevation of Privilege (a data file becomes an attack surface for code injection once a future consumer trusts its shape) | D-09's structural test: every remedy is a bare `string`; no record anywhere in the schema has an `argv`, `cmd`, or `args` key. This is the phase's own stated cross-cutting constraint, not a new invention — see CONTEXT.md's "Reversibility: one-way in spirit" note on D-09 |
| A packaging omission (file silently missing from the published tarball) discovered only by an end user | Tampering / Information Disclosure by omission — a user gets stale or absent remedies with no signal that something is missing | D-05/D-13's tarball-list assertion (`vice.files.includes(...)`), which is exactly the CR-07 failure-shape mitigation this project has already institutionalized in `check-npm-packages.mjs` |

## Sources

### Primary (HIGH confidence)
- Direct `Read`/`grep`/`sed` inspection of this repository's own tracked files, this session: `README.md` (lines 90-119), `src/skills/acme-build/SKILL.md` (lines 195-260), `src/mcp/vice/host-tool.mts` (lines 1472, 1545-1575, 1555-1559, 2200-2320), `src/mcp/vice/backend-detect.mts` (lines 254-345), `src/mcp/vice/package.json` (full), `installer/package.json` (full), `scripts/check-npm-packages.mjs` (lines 1-260), `src/mcp/vice/resources/vice-launcher.sh` (`NODE_FLOOR_MAJOR` grep), `.github/workflows/ci.yml` (lines 1-345, node-version/acme/setup-node greps), `src/mcp/vice/anno-regbits.json`/`anno-regbits.test.ts`, `scripts/lib/skill-corpus.mjs`, `src/mcp/vice/anno-cli.test.ts` (planted-violation pattern), `.planning/REQUIREMENTS.md`, `.planning/ROADMAP.md` (Phase 58 section + Sequencing Rationale v1.1.0), `.planning/research/ARCHITECTURE.md` (§3), `.planning/config.json`, `docs/stock-hard-losses.md`, `docs/phase40-preprocessing-tools-decisions.md`.
- Live, on-host verification this session: `nvm install 18` succeeded (Node v18.20.8), and `nvm exec 18 node -e "JSON.parse(...)"` correctly round-tripped a sample JSON structure — direct evidence that D-14's "oldest Node the doctor must start on" claim is checkable on this development host, not just in CI.

### Secondary (MEDIUM confidence)
- None used — every claim in this document was verified directly against the tracked repository tree or a live command on this session's host.

### Tertiary (LOW confidence)
- None.

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — zero new dependencies; every idiom cited is quoted verbatim from an existing file in this repo, read this session.
- Architecture: HIGH — the record schema sketch is illustrative (marked as such, not claimed as verified), but every structural constraint it encodes (D-06/D-08/D-09/D-12) is a locked CONTEXT.md decision, and every existing-file citation supporting it was read this session.
- Pitfalls: HIGH — all four pitfalls are grounded in files read this session, not inferred from the roadmap's prose alone; Pitfall 4 in particular corrects a precision gap in D-03's own phrasing that this research is flagging back to the planner.

**Research date:** 2026-09-17
**Valid until:** Stable for this phase's lifetime — the underlying facts (README's table, SKILL.md's disclaimer, host-tool.mts's refusal strings, package.json floors) only change if a different phase edits those files first; recommend re-checking `git log` on the cited files before executing if more than ~7 days pass, per this project's general "no dual-read of stale state" discipline.
