# Architecture Research

**Domain:** Owned annotation store for a C64 reverse-engineering MCP plugin — v0.7.0
**Researched:** 2026-08-26
**Confidence:** HIGH for every integration point, guard, and line reference below (all obtained by direct inspection of this repository's own source at HEAD, not inferred and not re-derived from planning prose). MEDIUM for the store-internals recommendations (persistence shape, module split), which are design judgements grounded in the project's own established patterns rather than facts read off disk.

> **Confidence-seam note, recorded rather than silently overridden.** `gsd_run query classify-confidence --provider local-source-read --verified` returns `LOW`. That taxonomy models *external* documentation providers; it has no provider id for first-party source inspection, which is the strongest available evidence for questions about this repository. Every claim tagged HIGH below cites the file and symbol it was read from, so a reader can re-verify in one command rather than trusting a tier label.

---

## Executive answer, up front

Four of this research's findings change the shape of the roadmap, so they lead:

1. **`capability-registry.ts` needs no new entries, and adding one would be a factual error.** It holds only the *per-backend delta*. A proxy-local family has no delta. Backend-agnosticism is made structural somewhere else entirely — in **`stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS`** (§1.2).
2. **Neither `tools-manifest.json` nor `tools-manifest.stock.json` is modified** — verified: `grep -c anno` returns `0` on both, and `refresh-manifest.ts` would wipe a hand-added entry on the next refresh. `docs/tool-support.md` likewise contains zero anno mentions.
3. **The deletion is ~12k lines, not ~25.7k.** Of the 25,759 lines across `src/mcp/vice/anno-*.ts`, roughly **13,700 survive under new names** — `anno-coverage.ts` alone (2,292 + 6,484 test) has no anno-process coupling at all beyond two string literals. Framing the milestone as a 25.7k-line deletion will produce a phase plan that deletes reusable assets (§2.4).
4. **There are more guards pinned to the deleted subject than the three named at scoping — nine, plus two CI scripts** (§5.3). Two of them (`scripts/generate-tool-support-table.mjs`, `scripts/check-skill-tool-coverage.mjs`) are CI gates that go red or throw *the moment the new family is registered*, before any deletion happens.

---

## Standard Architecture

### System Overview — where the annotation family sits

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    Claude Code  (MCP client, stdio)                          │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │ JSON-RPC over stdin/stdout
┌───────────────────────────────────▼──────────────────────────────────────────┐
│  vice-proxy.ts   — the ONE stdio entry point / tool registry                 │
│                                                                              │
│  tools{}  registration, in source order (position is asserted, see §1.2):    │
│   1. for (const def of manifestTools)   → buildBackendAwareTool()  ← fork/stock│
│   2. RESULT_CONTINUE_TOOL.name          → buildViceTool()   ← BYPASS #1       │
│   3. RECYCLE_TOOL.name                  → buildBackendAwareTool()            │
│   4. DIAGNOSE_TOOL.name                 → buildBackendAwareTool()            │
│   5. for (const annoDef of ANNO_TOOL_DEFINITIONS) → buildViceTool() ← BYPASS #2│
│                                                    (was: annoDef, :3401-3402)│
│                                                                              │
│  rewriteArguments()  defined :2009 — exactly TWO call sites, both ABOVE:      │
│      :1531  inside gatherWedgeEvidence()  (fn starts :1507)                  │
│      :3052  inside forwardToVice()        (fn starts :2987)                  │
│  ⇒ Neither is reachable from a buildViceTool() runner. BY CONSTRUCTION.       │
└──────┬───────────────────────────────────────────────────┬───────────────────┘
       │ BYPASS #2: no transport of any kind               │ direct tools
┌──────▼───────────────────────────────────────────┐  ┌────▼──────────────────┐
│           THE OWNED ANNOTATION STORE (new)        │  │ vice.ts   call()      │
├───────────────────────────────────────────────────┤  │ DENY_LIST, retry      │
│  anno-tools.ts   surface: defs, allow-list,       │  │ epoch/restart detect  │
│                  arg validation, runAnnoTool()    │  └────┬──────────────────┘
├──────────────┬───────────────┬────────────────────┤       │ HTTP / binmon
│ anno-store.ts│ anno-xref.ts  │ anno-acme-export.ts│  ┌────▼──────────────────┐
│  THE ONE     │ xrefs+search  │ ACME printer       │  │  host VICE (x64sc)    │
│  persistence │ over typed    │ =*+$01, prefixes   │  └───────────────────────┘
│  seam        │ decode        │                    │
├──────────────┴───────────────┴────────────────────┤
│  anno-model.ts   pure model: ranges, 12-member    │
│                  type vocabulary, invariants      │
├───────────────────────────────────────────────────┤
│  SURVIVING OWNED MODULES (renamed, not rebuilt)   │
│  disasm-opcodes/decoder/renderer · acme-ident     │
│  d64 · prg-image · regbits-gen · enum-gen         │
│  memmap-render · confidence · coverage            │
├───────────────────────────────────────────────────┤
│  repo-root.ts  repoRoot()  — container-side only  │
│  ✗ NEVER hostpath.ts (asserted, §1.3)             │
└───────────────────────┬───────────────────────────┘
                        │ atomic write, container-side
              ┌─────────▼──────────────┐
              │ <workspace>/*.c64anno  │  one JSON doc: model + undo journal
              └────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Typical implementation in this repo |
|-----------|----------------|-------------------------------------|
| `anno-tools.ts` | The tool surface: `ANNO_TOOL_DEFINITIONS`, `CURATED_ANNO_TOOLS`, `assertCuratedTool()`, `resolveStorePath()`, `runAnnoTool()` | Direct structural analogue of `anno-tools.ts` (1,214 lines), minus the child-process runner |
| `anno-store.ts` | The ONE place that reads/writes the store file, applies a mutation, appends to the undo journal, and rewrites atomically | New; no analogue exists (this is what was rented from upstream `state/`) |
| `anno-model.ts` | Pure model + invariants: address ranges, the data-type vocabulary, label/comment/scope/enum records. No I/O, no imports beyond `acme-ident.ts` | New |
| `anno-xref.ts` | Cross-references and search derived from the typed decode | New, built on `disasm-decoder.ts`'s `decode()` |
| `anno-acme-export.ts` | ACME source printer honouring block types, scopes, enums, `=*+$01`, typed prefixes | New, built on `disasm-renderer.ts` |
| `acme-verify.ts` | Spawn a real ACME, parse **ACME's own** diagnostics, byte-compare the reassembled `.prg` | Rewrite of `anno-verify.ts` (184 lines) — see the correction in §3.3 |
| `coverage.ts` | Derived-from-bytes coverage census the store's block table cannot move | Rename of `anno-coverage.ts`, two functions repointed (§2.3) |

---

## 1. Integration points, by file and symbol

### 1.1 Registration: `vice-proxy.ts`, lines 194 and 3401–3402

Two edits, both 1:1 substitutions of the existing anno route:

```ts
// vice-proxy.ts:194 — the only static import of the family
import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";
//  →   import { ANNO_TOOL_DEFINITIONS, runAnnoTool } from "./anno-tools.ts";

// vice-proxy.ts:3401-3402 — the registration loop
for (const annoDef of ANNO_TOOL_DEFINITIONS) {
  tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
}
//  →   for (const annoDef of ANNO_TOOL_DEFINITIONS) {
//        tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args));
//      }
```

`buildViceTool()` is defined at `vice-proxy.ts:3263`. It calls `createTool()` and nothing else — no `forwardToVice()`, no `call()`, no `ensureViceSession()`, no `rewriteArguments()`.

**The `buildViceTool()`-vs-`forwardToVice()` constraint, addressed directly.** CLAUDE.md's constraint is satisfied *by construction* for this family, and the construction is verifiable in one command:

```
$ grep -n "rewriteArguments(" src/mcp/vice/vice-proxy.ts
1531:    const { args: translated } = rewriteArguments({ path: screenshotContainerPath }, ...);
2009:function rewriteArguments(
3052:    const rewritten = rewriteArguments(args, name);
```

Exactly two call sites (`:1531` inside `gatherWedgeEvidence()`, `:3052` inside `forwardToVice()`), and the registration at `:3401` reaches neither, because `buildViceTool()`'s `execute` closes over the caller-supplied `run` and no forwarding path. Nothing to intercept, therefore nothing to forget. **This is not a property to be re-established — it is inherited unchanged, provided the new registration uses `buildViceTool()` and the runner lives in a module that does not import `vice-proxy.ts`.** Confirmed HIGH.

Two secondary facts about this line region, both load-bearing:

- **CLAUDE.md's line citations are currently accurate** (`:3052` / `:2987` / `:1531` / `:1507`, verified above) and `docs-linerefs.test.ts` checks each cited line actually contains a `rewriteArguments()` call or a function declaration. Deleting the import at `:194` and rewriting `:3401-3402` in place is line-neutral. **Any plan that adds net lines to `vice-proxy.ts` above `:1507` turns `docs-linerefs.test.ts` red and requires a same-commit CLAUDE.md update.** Prefer putting new code in sibling modules — which is also what PROJECT.md's own "Known debt" section already instructs ("`vice-proxy.ts` remains large and is the sole tool-surface seam — client-side derivations go in sibling modules, never appended to it").
- `.planning/PROJECT.md`'s copy of the same constraint is **stale** (`:3029` / `:2964` / `:1508` / `:1484`). `docs-linerefs.test.ts` reads only `CLAUDE.md`, so this is green-but-wrong. Worth a one-line fix in whichever plan touches the constraint.

### 1.2 Backend-agnosticism is made structural here — not in `capability-registry.ts`

**`src/mcp/vice/stock-dispatch.test.ts`** is the guard that makes the property structural. Four assertions matter, all around lines 1485–1575:

| Symbol / line | What it asserts | Required change |
|---|---|---|
| `proxyToolRegistrations()` (:1485) | Regex-scans `vice-proxy.ts` for `tools[<key>] = <rhs>;`, returning `[key, rhs]` pairs keyed by **raw captured text** | none — but see the loop-variable naming note below |
| `BACKEND_SEAM_BYPASS_KEYS` (:1504) | `["RESULT_CONTINUE_TOOL.name", "annoDef.name"]` — the exact allow-list of registrations permitted to bypass `buildBackendAwareTool()` | `"annoDef.name"` → `"annoDef.name"` |
| `assert.deepEqual(bypassing, BACKEND_SEAM_BYPASS_KEYS)` (:1527) | **Ordered** exact equality against the registrations that lack `buildBackendAwareTool(` | the new loop must stay **after** `RESULT_CONTINUE_TOOL` in source order, or the array order must change with it |
| the runner-purity test (:1549) | Slices `runAnnoTool()`'s body out of `anno-tools.ts` and asserts it contains none of `["forwardToVice", "ensureViceSession", "rewriteArguments"]` | repoint at `runAnnoTool(` in `anno-tools.ts`; **this is the mechanical expression of the CLAUDE.md constraint and must not be dropped** |
| the manifest-absence test (:1563) | Every `CURATED_ANNO_TOOLS` name is absent from both manifests | repoint at `CURATED_ANNO_TOOLS` |
| `import { CURATED_ANNO_TOOLS } from "./anno-tools.ts";` (:44) | static import — breaks on deletion | repoint |

Also `registrations.length >= 5` (:1508) — a non-vacuity floor that stays satisfied by a 1:1 swap.

**Do not add anything to `capability-registry.ts`.** Read at HEAD: 26 entries, all `vice_*`, zero `anno_*`. Its header states the exclusion rule explicitly — the registry is the *set difference between the two backend manifests*, minus registration artifacts. A proxy-local family is in neither manifest, so it contributes no delta. Its own doc comment names `vice_diagnose`/`vice_recycle` as the precedent: "A naive set-difference over the two manifests misclassifies them as a divergence; they are not one, and including them here would be a factual error, not merely an omission." The same reasoning covers the annotation family exactly. The registry's four consumers (`vice-proxy.ts`, `stock-dispatch.ts`, `scripts/generate-tool-support-table.mjs`, `scripts/check-skill-fork-honesty.mjs`) need no registry-driven change.

**`scripts/generate-tool-support-table.mjs` DOES need a change, and it throws if it does not get one.** `discoverSyntheticToolNames()` (:104) hard-codes:

```js
const ANNO_LOOP_VAR_RE = /for\s*\(\s*const\s+(\w+)\s+of\s+ANNO_TOOL_DEFINITIONS\s*\)/;
...
if (ident === annoLoopVar) continue; // excluded structurally, not by name
```

Rename the collection to `ANNO_TOOL_DEFINITIONS` and this regex matches nothing, `annoLoopVar` becomes `null`, and the captured `annoDef` identifier falls into the documented **throw** branch ("Any OTHER captured identifier that resolves to neither a loop-variable pattern nor a `const IDENT: ToolDefinition = {...}` declaration throws"). `docs/tool-support.md` is generated from this script under a byte-identity drift guard, so the failure surfaces as a red drift guard with a confusing message. The identical regex is **independently duplicated by design** in two more places, each of which must move in the same commit:

- `src/mcp/vice/tool-support-table.test.mjs:66`
- `src/mcp/vice/capability-registry.test.ts:161`

(The triplication is deliberate — "each is a separate witness proving the other two right" — so all three change, and none is refactored into a shared helper.)

### 1.3 `hostpath-consumers.test.ts` — what it requires of the new modules

Read in full at HEAD. Three requirements, and one already-red-on-deletion hazard the scoping did not name.

**(a) The store is NOT a host-path consumer, and must not become one.** `EXPECTED_IMPORTERS` is a five-element `deepEqual` plus `assert.equal(importers.length, 5)`:

```ts
const EXPECTED_IMPORTERS = ["containerpath.ts", "install-resources.ts", "stock-paths.ts", "vice-proxy.ts", "vice-sync.ts"];
```

Any new `anno-*.ts` importing `hostpath.ts` — statically, multi-line, or via `await import()` (all three shapes are detected, with planted-violation proofs) — fails this test. **The store persists to a project file, and that does not make it a host-path consumer**, because the file is resolved container-side against `repoRoot()`, never translated to a host view. The store file is read and written by the MCP process itself; nothing outside the container ever opens it. Contrast `stock-paths.ts`, which is in the consumer set precisely because it hands a path to the *emulator*, which lives on the host.

The pattern to carry over verbatim is **`resolveStorePath()`** in `anno-tools.ts` (: search `export function resolveStorePath`). It is already the right shape and needs only its extension literal changed:

1. reject non-string / empty
2. require the expected extension (`.regen2000proj` → `.c64anno`)
3. `resolve(repoRoot(), trimmed)`
4. `isContained(resolved, root)` — workspace containment
5. `realpathSync` both sides and re-check containment — symlink escape
6. on `ENOENT`, `resolveViaDeepestExistingAncestor()` — so a not-yet-created store file still gets a canonicalised parent rather than falling back to the literal path

`anno-tools.ts`'s own header states the rule the new module inherits: *"Never import the VICE host-path/container-path translation modules here … a project path is resolved against `repoRoot()` only. Asserted structurally by the closed host-path consumer-set test."*

**(b) The anno-family absence tests must become anno-family absence tests.** The file contains a `readdirSync`-derived family scan that is *itself* pinned to the deleted subject:

```ts
function annoProductionModules(): string[] {
  return topLevelProductionModules().filter((name) => /^anno-.*\.ts$/.test(name));
}
const ANNO_MODULE_FLOOR = 14;
```

Three tests break on deletion, not one:
- the floor test (`modules.length >= 14`) — goes red at 0
- the INT-01 positive control naming `anno-acme-ident.ts`, `anno-regbits-gen.ts`, `anno-symbols.ts`, `anno-test-gate.ts` by literal filename — goes red on rename
- the absence test, whose own `assert.ok(annoModules.length > 0)` non-vacuity guard goes red

So **`hostpath-consumers.test.ts` is a fourth guard pinned to the deletion**, alongside the three named at scoping. Its fate: repoint the pattern to `/^anno-.*\.ts$/`, set a floor equal to the *measured* new count, and re-point the positive control at four real new filenames. The planted-violation tests (the `importsHostpath()` proofs) are subject-independent and carry over unchanged.

**(c) `DERIVED_TOOL_MODULES` is not affected.** It maps `STOCK_DERIVED_TOOLS` entries to filenames and asserts key-set equality with `STOCK_DERIVED_TOOLS`. The annotation family is not a stock-derived tool (it is not in either manifest, so it cannot be derived from one), so it must **not** be added here — the same by-construction reasoning as `capability-registry.ts`.

### 1.4 The test-availability gate must be split before anything is deleted

`src/mcp/vice/anno-test-gate.ts` owns **two** gates, not one:

| half | symbols | consumers that must survive the deletion |
|---|---|---|
| the external analyser | `ANNO_BIN`, `probeAnno()`, `ANNO_AVAILABLE`, `skipReasonFor()`, `assertAnnoRequiredIfEnvSet()` | all anno tests (deleted) + `anno-launch.ts`, `anno-mcp-client.ts` (deleted) |
| **ACME** | `ACME_BIN`, `probeAcme()`, `ACME_AVAILABLE`, `acmeSkipReasonFor()`, `assertAcmeRequiredIfEnvSet()` | **`disasm-roundtrip.test.ts`**, **`skill-acme-build-cli.test.ts`** — both survive |

Two surviving tests import the ACME half from a module whose name must go. Extract the ACME half to `acme-test-gate.ts` (or `bin-test-gate.ts`) **before** the deletion, and carry over its two documented invariants verbatim: the module must stay absent from `package.json` `files[]` (a test-only helper has no place in the tarball — `anno-verify.test.ts` asserts this mechanically), and its filename must not match the `*.test.*` glob.

---

## 2. New vs modified components, explicitly separated

### 2.1 NEW modules

| Module | Lines (est.) | Responsibility | Depends on |
|---|---|---|---|
| `anno-model.ts` | ~350 | Pure model + invariants: ranges, the data-type vocabulary, label/comment/scope/enum records, non-overlap, ACME-legal names | `acme-ident.ts` only |
| `anno-store.ts` | ~500 | **The ONE persistence seam.** open/create, apply-mutation, undo journal, atomic write, `resolveStorePath()` | `anno-model.ts`, `repo-root.ts`, `node:fs` |
| `anno-tools.ts` | ~1,100 | Tool surface + allow-list + arg validation + `runAnnoTool()` | `anno-store.ts`, `anno-xref.ts`, `anno-acme-export.ts`, `acme-ident.ts` |
| `anno-xref.ts` | ~400 | Cross-references and search over the typed decode | `disasm-decoder.ts`, `anno-model.ts` |
| `anno-acme-export.ts` | ~600 | ACME printer: block types, scopes, enums, `=*+$01`, typed prefixes | `disasm-renderer.ts`, `anno-model.ts` |
| `acme-verify.ts` | ~250 | Spawn real ACME, parse **ACME's own** output, byte-compare the reassembled `.prg` | `node:child_process` |
| `acme-test-gate.ts` | ~60 | The extracted ACME availability gate (§1.4) | — |
| `anno-cli.ts` | ~900 | `vice-mcp anno <verb>` — the surviving CLI verbs | the above |

### 2.2 MODIFIED existing files

| File | Change | Why |
|---|---|---|
| `src/mcp/vice/vice-proxy.ts` | `:194` import; `:3401-3402` loop (loop var → `annoDef`) | the registration (§1.1) |
| `src/mcp/vice/stock-dispatch.test.ts` | `:44` import; `BACKEND_SEAM_BYPASS_KEYS` `:1504`; runner-purity test `:1549`; manifest-absence test `:1563` | structural backend-agnosticism (§1.2) |
| `src/mcp/vice/capability-registry.ts` | **NONE** | proxy-local ⇒ no per-backend delta (§1.2) |
| `src/mcp/vice/tools-manifest.json` / `.stock.json` | **NONE** | family is in neither, by design; `refresh-manifest.ts` would wipe an entry anyway |
| `docs/tool-support.md` | **NONE** (regenerated byte-identical) | contains zero anno mentions today |
| `src/mcp/vice/capability-registry.test.ts` | `:161` loop-var regex | one of three independent witnesses (§1.2) |
| `src/mcp/vice/tool-support-table.test.mjs` | `:66` loop-var regex | second witness |
| `scripts/generate-tool-support-table.mjs` | `:104` `ANNO_LOOP_VAR_RE` | third witness; **throws** if missed (§1.2) |
| `src/mcp/vice/hostpath-consumers.test.ts` | family regex, floor, positive control (3 tests) | §1.3(b) |
| `src/mcp/vice/package.json` `files[]` | remove 15 `anno-*.ts` entries + `anno-regbits.json`; add the new/renamed set | `check-npm-packages.mjs`'s transitive-closure walk (static **and** dynamic imports) fails otherwise |
| `scripts/check-npm-packages.mjs` | `REQUIRED_DERIVED_MODULES` `:201` (`["anno-cli.ts", "ANNO-09"]`); the anno family names in the closure-walk comment `:218` | a listed-but-absent file fails the `need()` |
| `scripts/check-skill-tool-coverage.mjs` | `:49` static import of `CURATED_ANNO_TOOLS`; `ANNO_TOOL_NAME_RE` `:88`; the ≥10-name non-vacuity floor `:447`; the CLI-verb section `:457-490` | **CI gate — throws `ERR_MODULE_NOT_FOUND` on deletion** |
| `scripts/lib/anno-cli-verbs.mjs` + `.d.mts` | rename; repoint the dispatch-switch parse at `anno-cli.ts`; `ANNO_CLI_VERB_FLOOR` | parses the CLI's own switch, never a hand-typed array |
| `scripts/check-skill-fork-honesty.mjs` | the ANNO-05 deletion pin `:412-500`; the positive pointer `need(... includes("anno export-asm"))` `:504` | **a direct contradiction: the pointer string must change or the new gate fires on it** (§5.2) |
| `scripts/audit-gate.mjs` | `:136` `"docs-absorbed-decisions.test.ts"` in the gated-guard list | guard fate (§5.3) |
| `src/skills/*/SKILL.md` (5 files) + 4 reference/template/script files | ~148 `anno` and ~27 `the external analyser` mentions re-pointed; `routine-queue-walker`'s `description:` frontmatter rewritten | the five absorbed procedures' routes (§4, step 5) |
| `CLAUDE.md` | the `anno_*` clause in the Architecture constraint bullet | the family it names ceases to exist |
| `.planning/ARCHITECTURE.md` | Rule A21 (`resolveStorePath`, `ChildProcess`, `anno-mcp-client.ts`) | pinned by `docs-absorbed-decisions.test.ts` (§5.3) |

### 2.3 RENAMED / REPOINTED — survives, do not rebuild

| Today | Becomes | Non-test lines | Repoint needed |
|---|---|---|---|
| `anno-acme-ident.ts` | `acme-ident.ts` | 97 | none (zero imports) |
| `anno-d64.ts` | `d64.ts` | 310 | none (zero imports) |
| `anno-confidence.ts` | `confidence.ts` | 233 | none (zero imports) |
| `anno-regbits-gen.ts` + `anno-regbits.json` | `regbits-gen.ts` + `regbits.json` | 421 | none (zero imports) |
| `anno-memmap-render.ts` | `memmap-render.ts` | 531 | none (zero imports) |
| `anno-enum-gen.ts` | `enum-gen.ts` | 574 | drop `anno-tools.ts` → `anno-store.ts` |
| `anno-symbols.ts` | `anno-symbols.ts` | 388 | drop `anno-launch.ts` / `anno-mcp-client.ts` / `anno-tools.ts` → `anno-store.ts`; keeps `stock-symbols.ts` (the live round trip) |
| `anno-coverage.ts` | `coverage.ts` | 2,292 | **two functions only**: `storeBlockTypeAt()` (:1662) and `classFromStore()` (:1683) compare against upstream's Rust `Display` strings `"Code"` / `"Undefined"`; retarget at the store's own type representation. Its `decodeRawData` import becomes unnecessary (base64 is an upstream wire artifact). Everything else — including `AUTO_NAME_PREFIX_RE` (:1384) — is untouched |
| `anno-project.ts` (part) | `prg-image.ts` | ~60 of 344 | `parsePrg()`, `flatImageOrigin()` are pure and reusable; `synthesizeProject()` / `ensureProjectSettings()` / `decodeRawData()` are anno-shaped and go |
| `anno-verify.ts` | `acme-verify.ts` | 184 | **rewrite, not rename** — see §3.3 |

Surviving test files by the same rule: `anno-d64.test.ts` (396), `anno-confidence.test.ts` (154), `anno-regbits.test.ts` (250), `anno-memmap-render.test.ts` (464), `anno-enum-gen.test.ts` (353), `anno-coverage.test.ts` (4,315), `anno-coverage-grammar.test.ts` (2,169) — **8,101 test lines survive**, the great majority of it the coverage instrument's own six anti-vacuity controls.

### 2.4 DELETED outright

| File | Lines | Why it cannot survive |
|---|---|---|
| `anno-launch.ts` | 357 | the `the external analyser` spawn seam |
| `anno-mcp-client.ts` | 795 | the NDJSON JSON-RPC client to the child |
| `anno-session.ts` | 693 | the long-lived child session, FIFO queue, crash recovery |
| `anno-tools.ts` | 1,214 | replaced by `anno-tools.ts` (surface shape carried, body replaced) |
| `anno-cli.ts` | 1,503 | replaced by `anno-cli.ts` (verbs carried, bodies replaced) |
| `anno-project.ts` (rest) | ~284 | `.regen2000proj` synthesis |
| `anno-test-gate.ts` (anno half) | ~55 | the availability probe for a binary no longer used |
| their `*.test.ts` | 527 + 775 + 966 + 1,029 + 1,650 + 437 + 627 + 617 + 192 + 247 | see §5.3 for the guard-by-guard fate |

**Measured deletion arithmetic** (`wc -l src/mcp/vice/anno-*.ts`): 25,759 total = 10,102 non-test + 15,657 test. Genuinely deleted: **~5,300 non-test + ~7,100 test ≈ 12,400 lines.** Surviving under new names: **~4,800 non-test + ~8,100 test ≈ 12,900 lines.** *A roadmap phase written to "delete 25,700 lines" will delete the coverage instrument and the enum generator. Size the deletion phase at ~12k and the rename phase separately.*

---

## Recommended project structure

```
src/mcp/vice/
├── anno-model.ts             # pure model, invariants, type vocabulary
├── anno-store.ts             # THE persistence seam (atomic write + undo journal)
├── anno-tools.ts             # ANNO_TOOL_DEFINITIONS, CURATED_ANNO_TOOLS, runAnnoTool()
├── anno-xref.ts              # xrefs + search over the typed decode
├── anno-acme-export.ts       # ACME printer
├── anno-symbols.ts           # VICE .lbl import/export (the live round trip)
├── anno-cli.ts               # `vice-mcp anno <verb>`
├── acme-verify.ts            # spawn real ACME, parse ACME's own output, byte-compare
├── acme-ident.ts             # (renamed) legal ACME identifiers
├── acme-test-gate.ts         # (extracted) ACME availability gate — NOT in files[]
├── prg-image.ts              # (extracted) parsePrg / flatImageOrigin
├── d64.ts  confidence.ts  coverage.ts  memmap-render.ts
├── regbits-gen.ts  regbits.json  enum-gen.ts        # (renamed) machine knowledge
├── disasm-opcodes.ts  disasm-decoder.ts  disasm-renderer.ts   # UNCHANGED
└── vice-proxy.ts  vice.ts  repo-root.ts  hostpath.ts  ...      # unchanged seams
```

### Structure rationale

- **`anno-` prefix, one family, derivable from disk.** `hostpath-consumers.test.ts` and `spawn-seam.test.ts` both derive their module set with `readdirSync` + a name regex rather than a hand-typed list, precisely because a hand-typed list went stale (INT-01 found four uncovered modules). A single stable prefix keeps that idiom working and gives the removal gate a one-line rule: *no shipped module name may contain `anno`, and no shipped tool name may contain `anno_`.*
- **`acme-` prefix for the assembler-facing half.** `acme-verify.ts`, `acme-ident.ts` and `acme-test-gate.ts` are about ACME, not about annotation. Keeping them out of the `anno-` family means the store's family floor counts only store modules, and the ACME gate's extraction (§1.4) reads as an obvious boundary rather than an accident.
- **Names that no longer say `anno`, per the seed's own instruction** — "All of it survives, under names that no longer say `anno`."
- **Nothing appended to `vice-proxy.ts`.** Two lines change; everything else is a sibling module. This preserves both the `docs-linerefs.test.ts` line citations and the project's own standing instruction about that file's size.

---

## 3. Architectural patterns

### Pattern 1: One store document, atomically rewritten, with the undo journal inside it

**What:** the store is a single JSON document at `<workspace>/<name>.c64anno` containing both the current model **and** a bounded undo journal. Every mutating tool call: validate → apply in memory → append the inverse operation to the journal → serialise → write `tmp` → `rename()` → return.

**When:** always. There is no in-memory-only mode and no explicit save verb governing durability.

**Trade-offs:** a full rewrite per mutation is O(document) rather than O(mutation), but the document is kilobytes-to-low-hundreds-of-KB for a 64K address space, and the alternative — a journal as system of record plus a derived snapshot — is two sources of truth, which is exactly what "single seam per concern" forbids. The rename is the atomicity primitive; no dependency is added.

**Why the journal lives *inside* the document:** the durability requirement is *"mutate → kill → reopen returns the mutation, and removing the save makes that same test go red."* If the undo journal were in-memory only, `mutate → kill → reopen → undo` would silently fail, and the planted-violation test would pass while undo was broken across a restart. Persisting both together makes one atomic write the only durability primitive there is.

```ts
// anno-store.ts — the shape that makes the planted-violation test bite
export function applyMutation(path: string, m: Mutation): StoreDoc {
  const doc = loadStore(path);                 // parse-or-create
  const inverse = invertMutation(doc, m);      // computed BEFORE the apply
  const next = { ...applyToModel(doc, m), journal: pushBounded(doc.journal, inverse) };
  writeAtomic(path, next);                     // tmp + rename — remove this line and durability dies
  return next;
}
```

Deleting `writeAtomic()` breaks the durability test *and* the undo-across-restart test with one edit. That is what makes the planted violation non-vacuous.

### Pattern 2: Persist-before-return, not save-on-demand

**What:** `anno_save`-shaped verbs do not govern durability. Persistence is inside the mutation path, before the tool returns its result to the caller.

**When to use:** every mutating tool.

**Trade-offs:** the five absorbed procedures each end with an `anno_save_project` step. Rather than delete that step from the playbooks (which loses a real procedural beat — "you are done with this routine"), map it onto **`anno_checkpoint`**, which marks an undo boundary and is a no-op for durability. The prose survives, the meaning sharpens, and the manifest-derived surface keeps a 1:1 route for the call. **Do not keep a save verb that is load-bearing for durability** — the previous architecture's need for `saveAndVerify()` (never trust the child's own text response) existed only because persistence lived in another process.

### Pattern 3: The data-type vocabulary is 12 members, not 7

PROJECT.md's Active list names seven ("code, byte, word, address, PETSCII, screencode, table"). The surface being replaced already exposes **twelve**, read verbatim from `anno-tools.ts`'s `anno_set_data_type` schema:

```
code · byte · word · address · petscii · screencode
lo_hi_address · hi_lo_address · lo_hi_word · hi_lo_word
external_file · undefined
```

"table" is a compression of four distinct split-layout members, and `external_file` / `undefined` have no representative in the seven. **Adopt all twelve.** Reasons, both concrete: (a) `DECOMP-01` is what the vocabulary is sized for, and a split-address table is precisely the structure the pivot notes record `da65`'s `RANGE TYPE` as *unable* to express — losing it here reintroduces the export-boundary problem the pivot exists to avoid; (b) the surviving coverage census classifies against block types today, so a narrowed vocabulary silently narrows the census.

### Pattern 4: Typed label prefixes are already owned — 11, not 5

The seed names five (`zpp_`/`zpa_`/`f_`/`a_`/`e_`). `anno-coverage.ts:1384` — a **surviving** module — already owns the authoritative set:

```ts
export const AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/;
```

Eleven prefixes, exercised by a real fixture list in `anno-coverage.test.ts:946`. The exporter and the store's naming rules should both read this one constant rather than re-declaring a subset. A committed real-world witness of the output format exists at `.planning/notes/dxa-ghidra-pivot-evidence/anno.asm` — including four live `=*+$01` mid-instruction labels at lines 51, 81, 135, 145 — which makes an excellent golden fixture for the exporter.

---

## 4. Data flow

### (a) Setting a label / comment / data type

```
Claude Code
  │ tools/call { name: "anno_set_label_name", arguments: { project, address, name } }
  ▼
vice-proxy.ts  CallToolRequestSchema override
  │  DENY_LIST check (vice.ts) — runs first, always
  │  tools["anno_set_label_name"].execute(args)      ← buildViceTool() closure, :3402
  ▼
anno-tools.ts  runAnnoTool("anno_set_label_name", args)
  │  assertCuratedTool(name)                          ← allow-list, incl. batch recursion
  │  assertLegalAcmeIdentifier(name)                  ← acme-ident.ts, reused as-is
  │  resolveStorePath(project)                        ← repoRoot() + containment + realpath
  ▼
anno-store.ts  applyMutation(path, { kind: "set-label", ... })
  │  loadStore → invertMutation → applyToModel → pushBounded(journal)
  │  ★ writeAtomic(tmp) + rename()   ← PERSISTENCE HAPPENS HERE
  ▼
returns { content: [...], isError: false } to vice-proxy.ts → wire
```

**Persistence relative to the tool-call boundary:** *inside* it, before the result is constructed. Nothing is buffered across calls, so there is no session, no crash-recovery state machine, and no `saveAndVerify()` — the three most expensive pieces of the architecture being deleted (`anno-session.ts` 693 + `anno-mcp-client.ts` 795 + their 1,741 test lines) exist only because persistence lived in another process.

**Transport reachability:** zero. `runAnnoTool()` imports `anno-store.ts`, `anno-xref.ts`, `anno-acme-export.ts`, `acme-ident.ts` — none of which imports `vice.ts` or `vice-proxy.ts`. `stock-dispatch.test.ts:1549`'s repointed runner-purity test asserts this mechanically over the function body.

### (b) Querying cross-references

```
tools/call anno_get_cross_references { project, address }
  ▼
runAnnoTool → resolveStorePath → anno-store.ts  loadStore(path)     ← READ ONLY, no write
  ▼
anno-xref.ts  crossReferencesTo(model, address)
  │  for each block typed "code": disasm-decoder.ts  decode(bytes, origin)
  │    → collect operand targets from absolute/indirect/relative modes
  │  for each block typed address / lo_hi_address / hi_lo_address:
  │    → walk the table, emit a reference per entry (this is why "table" must
  │      stay four distinct members — the walk differs per layout)
  ▼
returns [{ from, kind: "jsr"|"jmp"|"read"|"write"|"table-entry", ... }]
```

**No write occurs**, so no journal entry and no file rewrite. The read-only/mutating split is what makes the `anno_checkpoint` mapping in Pattern 2 safe.

**Design decision — derive or cache?** Derive. The xref index is a pure function of (bytes, block types), and caching it inside the store document creates a second truth that can disagree with the block table — the exact failure `COV-01`'s derived-from-bytes census was built to make impossible. A full 64K decode is single-digit milliseconds with `disasm-decoder.ts`; cache in memory per process if profiling ever demands it, never on disk.

### (c) ACME export → real-ACME reassembly verification round trip

```
anno_export_acme { project, out }           (or `vice-mcp anno export-asm`)
  ▼
anno-store.ts  loadStore                    → model
  ▼
anno-acme-export.ts  renderProgram(model, bytes)
  │  !cpu 6510 header; per-block: code → disasm-renderer.ts, data → typed emitters
  │  labels with typed prefixes (AUTO_NAME_PREFIX_RE's vocabulary)
  │  comments as ; lines; scopes as ACME zones
  │  SMC write targets → `LABEL =*+$01` mid-instruction idiom
  │  register writes → generated enum names (enum-gen.ts)
  ▼  writes <out>.a
acme-verify.ts  verifyReassembly({ source, expectedBytes })
  │  spawnSync("acme", ["--cpu","6510","-f","cbm","--msvc","-v1","-o",tmp.prg, source])
  │  ★ verdict from ACME's OWN parsed diagnostics + existsSync(prg)
  │    — NEVER from the exit code alone (see the correction below)
  │  byte-compare tmp.prg body against expectedBytes
  ▼
returns { ok, diags, firstDivergingAddress }
```

**§3.3 — a correction to the milestone's own premise, and the most important architectural finding in this section.** PROJECT.md's Active list says the store *"exports ACME source verified by a real ACME through the existing `--verify` seam."* Read at HEAD, `anno-verify.ts` does **not** invoke ACME. It invokes `analyser --verify` (`import { buildVerifyArgs, runAnno } from "./anno-launch.ts"`) and parses **the external analyser's** per-assembler summary transcript:

```
✗ ACME — ACME not found in PATH (skipped)
✓ All roundtrip verifications passed.
EXIT=0
```

So the "existing seam" is *inside the thing being deleted*. What survives the deletion is the **discipline**, not the code:

1. never derive the verdict from the exit status (the transcript above is exit 0 with ACME never having run)
2. never trust an aggregate summary line
3. require **unanimity** across every ACME result line, first non-ok drives the verdict (WR-04)
4. refuse to guess when more than one authoritative line is present
5. `"skipped"` and `"ok"` are different outcomes and must never be conflated

The invocation half must be built new. **`src/skills/acme-build/scripts/acme.mjs` already does exactly this** (`spawnSync("acme", ["--cpu","6510","-f","cbm","-Wtype-mismatch","--strict-segments","--msvc","-v1", ...])`, with an `ACME` library probe, `--msvc` diagnostic parsing, and an `ok = r.status === 0 && existsSync(prg)` verdict). It is the right model, but it lives in `src/skills/` — a *different npm package* — so `src/mcp/vice/` cannot import it. `acme-verify.ts` is therefore a deliberate second implementation of the spawn, keeping `acme.mjs`'s argv verbatim so the two agree by inspection.

**Plan-level consequence:** a phase criterion worded "reuse the existing `--verify` seam" is unachievable as written. Word it as *"reuse `acmeVerdict()`'s five verdict rules, replacing the anno invocation with a direct ACME spawn matching `acme.mjs`'s argv."* `anno-verify.test.ts` (247 lines) pins two real transcripts verbatim — the honest pass and the false-pass trap — which are anno-format and must be re-recorded from real ACME output. This is a genuine cost the deletion incurs; do not plan it as a rename.

### (d) Undo

```
tools/call anno_undo { project }
  ▼
runAnnoTool → resolveStorePath → anno-store.ts  undo(path)
  │  doc = loadStore(path)                    ← journal read from DISK, not memory
  │  if (doc.journal.length === 0) → refuse by name, no write
  │  const inverse = doc.journal.at(-1)
  │  next = { ...applyToModel(doc, inverse), journal: doc.journal.slice(0, -1) }
  │  ★ writeAtomic + rename                   ← the undo is itself durable
  ▼
returns the reverted state summary
```

**Why the journal must be on disk:** the acceptance bar is a planted violation across a process kill. `mutate → kill → reopen → undo` only works if the inverse operation was persisted by the mutating call. An in-memory journal makes undo a within-process convenience and the durability test would still pass — which is exactly the "a test written by the same pass that wrote the code proves less than it looks like it does" failure this project has been taught six times.

**Note the manifest disposition, deliberately departed from.** `upstream-procedure-manifest.json` classifies `anno_undo` as **`omit`**, with the recorded rationale that a curated tool must serve a named criterion and undo did not. v0.7.0's Active list *supplies* that criterion ("undo … proven by planted violation"). The manifest's own third re-sync trigger anticipates precisely this: *"A future phase needs an upstream call this manifest currently disposes of as omitted … Adding one requires updating that entry's disposition in the same commit, so the manifest cannot silently disagree."* **Update the `anno_undo` disposition in the same commit that adds `anno_undo`,** or `anno-derivation.test.ts`'s "every non-curated upstream call carries a justification and a citation" assertion becomes a record of a decision that has been reversed.

---

## 5. The removal's mechanics

### 5.1 The gate, modelled on the `toacme` precedent

The precedent is `scripts/check-skill-fork-honesty.mjs:412-500` (the ANNO-05 deletion pin). Its properties, each of which the new gate should copy:

| property | how `toacme`'s gate does it |
|---|---|
| **whole-tree, not a file list** | walks the `skillFiles` corpus already collected — every `.md` and `.mjs` under `src/skills`. Its own header: *"a file-by-file version of this exact assertion is the same structural blindness that let … a stale reference dangle through an earlier `--include=SKILL.md`-shaped pass while that narrower gate reported clean. Do not narrow this back to a fixed file list."* |
| **substantive checks run BEFORE the exemption is consulted** | WR-03's fix. The `toacme` and `cmdDisasm` checks execute unconditionally; only the third, narrower `disasm`-token check consults the exemption. A line reading `// see acme.mjs cmdDisasm / toacme, evidence: "disasm"` previously short-circuited all three. |
| **exemption scoped to the LINE and to the specific check**, never to the file | `DISASM_LINE_EXEMPTION = 'evidence: "disasm"'` |
| **exemption non-vacuity counter** | `need(exemptionHits === 1, ...)` — a second hit means the exemption is hiding a second reintroduction |
| **a positive check that the replacement pointer still exists** | `need(acmeBuildSkillSource.includes("anno export-asm"), "the deletion must not be 'fixed' by deleting the pointer to the proven route too")` |
| **proven by a planted reintroduction**, not merely written | the milestone's own wording; the `toacme` gate was observed biting on a non-`SKILL.md` file |

Recommended scope for the v0.7.0 gate: **`src/`, `scripts/`, `docs/`, `README.md`, `package.json`** — the shipped tree. Deliberately **exclude `.planning/`**, matching the `toacme` precedent (`grep -rln toacme` finds 20+ `.planning/` files today and the gate is green). Planning artifacts are the historical record; a gate over them would demand rewriting history.

### 5.2 The exemption — and two corrections to its stated shape

**Correction 1: there are five `ATTRIBUTION (ABS-02)` blocks, not three, across three files.** Measured:

```
src/skills/c64-program-recon/SKILL.md     : 2   (lines 293, 495)
src/skills/c64-memory-mapping/SKILL.md    : 2   (lines 225, 476)
src/skills/routine-queue-walker/SKILL.md  : 1   (line 7)
```

**Correction 2: each block carries TWO lines containing "the external analyser", not one** — the `Adapted from the external analyser.` line and the `Source repository: an upstream repository` line. So the exemption set is **10 lines across 5 blocks in 3 files**, and the non-vacuity counter should require exactly 10, not 3. Verified line numbers:

```
routine-queue-walker/SKILL.md   :   8,   9
c64-memory-mapping/SKILL.md     : 226, 227, 477, 478
c64-program-recon/SKILL.md      : 294, 295, 496, 502
```

**Recommended exemption predicate — block-scoped, not line-string-scoped.** The `toacme` gate exempts a literal string. Here the safer rule is structural: a line is exempt only if it falls inside an `ATTRIBUTION (ABS-02)` block *and* matches one of the two attribution shapes (`^\s*Adapted from the external analyser\.$` or the pinned repository URL). This is stronger than a substring exemption because prose smuggled into an attribution block on a *new* line is still caught, and it dovetails with `skill-attribution.test.ts`'s existing `attributionBlocks()` extractor — reuse that function rather than writing a second block parser (the "one definition of what counts" discipline `hostpath-consumers.test.ts`'s `importsHostpath()` already establishes).

**A third mention is NOT exempt and must change substantively:** `routine-queue-walker/SKILL.md:3`, the YAML `description:` frontmatter — *"Drive an existing **the external analyser** annotation project's backlog…"*. That is the skill's trigger text, not attribution. It must be rewritten to name the owned store. Note the coupling: `skill-attribution.test.ts` runs a **pairwise trigger-collision gate over all seven skill descriptions**, so rewriting this description must be re-checked against the other six.

**The direct contradiction to resolve inside one plan.** `scripts/check-skill-fork-honesty.mjs:504` asserts `acme-build/SKILL.md` still contains the literal string `"anno export-asm"`. If the skills are cleansed, that `need()` fails; if the string stays, the new gate fires on it. Both halves must move in the same commit: repoint the positive check at the new verb (`"anno export-asm"`) and update the skill text together. **Discovering this at the gate is the predictable failure mode**; PROJECT.md's Active list already asks for every guard to have "an explicit fate before the phase gate."

### 5.3 Guard fates — nine tests plus two CI scripts

The scoping named three. The measured set is larger. Every row below was confirmed by reading the file.

| Guard | Pinned to | Recommended fate |
|---|---|---|
`spawn-seam.test.ts` (627) | `EXPECTED_ANNO_SPAWN_SITES` + `assertNoViceFlag` before every anno spawn; derives its module set from `package.json` `files[]`; reads `.planning/phases/18-*/evidence/` | **Delete with the subject.** The `--vice` invariant it enforces is moot when nothing spawns anno. Its `codeOnly()` string-literal stripper and `shippedTsModules()` idiom are reused by `stock-dispatch.test.ts:2889,2919` — **extract those two helpers first** or that file breaks. |
`docs-absorbed-decisions.test.ts` (in `scripts/audit-gate.mjs:136`) | `.planning/ARCHITECTURE.md`'s Rule A21 (names `resolveStorePath`, `ChildProcess`, `anno-mcp-client.ts`) and PROJECT.md's D-36 row | **Split.** The D-36/D-32 supersession assertions are pure historical-record checks and stay green if the Key Decisions rows stay (they should — Key Decisions is a ledger, not live documentation). Rule A21 describes a module that ceases to exist: mark it superseded with a date in `.planning/ARCHITECTURE.md` and narrow the guard to assert the supersession note, or retire rule+guard together and remove the name from `audit-gate.mjs:136`. **Removing the name from `audit-gate.mjs` without removing the test, or vice versa, breaks the audit gate** — its own comment records that the two were added in the same commit for this reason. |
`absorbed-answer-key.test.ts` (282) | `.planning/phases/11-*/evidence/criterion1/` with **no existence guard**; the sealed-question hash chain; a committed ACME fixture byte-compare | **Rename and keep** (`sealed-question.test.ts`). It is an evidence-integrity guard over a historical artifact, not a test of anno code. Keeping it also keeps PROJECT.md's "do not archive phase directories" decision intact — deleting it would silently relax one of that decision's two stated reasons and should be an explicit choice, not a side effect. |
**`hostpath-consumers.test.ts`** (326) | `annoProductionModules()`, `ANNO_MODULE_FLOOR = 14`, an INT-01 positive control naming four anno filenames | **Repoint** (§1.3b). Three tests go red on deletion. |
`anno-verb-coverage.test.ts` (192) | `parseAnnoCliVerbs()` over `anno-cli.ts`'s dispatch switch; `REAL_VERBS` (8) | **Rewrite** against `anno-cli.ts`. |
`anno-symbol-roundtrip.test.ts` (617) | the live anno↔VICE symbol round trip; reads `.planning/phases/` | **Rewrite** as `anno-symbol-roundtrip.test.ts`. The capability (`ANNO-14`/`ANNO-15`) survives in `anno-symbols.ts`; only the static half's provider changes. |
`anno-verify.test.ts` (247) | two verbatim anno `--verify` transcripts; asserts `anno-test-gate.ts` is absent from `files[]` | **Rewrite** (§3.3). Fixtures must be re-recorded from real ACME. Preserve the `files[]`-absence assertion, repointed at `acme-test-gate.ts`. |
`anno-derivation.test.ts` (207) | `.planning/phases/19-*/upstream-procedure-manifest.json` — **not** anno code | **Rename and keep** (`upstream-procedure-audit.test.ts`). This guards the manifest the new tool surface is *derived from*; deleting it removes the derivation's own integrity check at the exact moment it matters most. |
`skill-attribution.test.ts` | the same Phase 19 manifest; the six-field headers; the byte-exact MIT notice; the pairwise trigger-collision gate | **Keep unchanged, and treat as the acceptance gate for the skill-repointing phase.** Every attribution edit must leave it green. |
`scripts/check-skill-tool-coverage.mjs` | static `import { CURATED_ANNO_TOOLS } from "../src/mcp/vice/anno-tools.ts"`; `ANNO_TOOL_NAME_RE`; ≥10-name floor; CLI-verb floor 8 | **Repoint.** Throws `ERR_MODULE_NOT_FOUND` the moment `anno-tools.ts` is deleted. |
`scripts/generate-tool-support-table.mjs` + its two independent witnesses | `ANNO_LOOP_VAR_RE` hard-codes `ANNO_TOOL_DEFINITIONS` | **Repoint all three** (§1.2). **Throws — and therefore reddens `docs/tool-support.md`'s byte-identity drift guard — the moment the collection is renamed, i.e. before any deletion.** |

**Ordering consequence.** Two of these (the last two rows) break on the *registration*, not on the deletion. They must be handled in the same phase that registers the new family, or the phase closes with a red CI gate. This is the single most important sequencing fact in this document after §5.4.

### 5.4 Five committed tests read live `.planning/phases/` paths

`spawn-seam.test.ts`, `skill-attribution.test.ts`, `absorbed-answer-key.test.ts`, `anno-coverage.test.ts`, `anno-verify.test.ts` (plus `anno-session.test.ts`, `anno-tools.test.ts`, `anno-symbol-roundtrip.test.ts`, `anno-derivation.test.ts` — nine in total by measurement). Two are worst-case: `absorbed-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with **no existence guard**, and `skill-attribution.test.ts` / `anno-derivation.test.ts` read the Phase 19 manifest by an absolute relative path.

**Roadmap constraint, restated for the planner:** `.planning/phases/` accumulates by design (PROJECT.md Key Decisions, 2026-08-23), and the milestone close must pass `--no-archive-phases`. The set of guards forcing that just changed shape — two of them (`docs-review-disposition.test.ts`, `skill-attribution.test.ts`) survive v0.7.0 regardless, so the constraint stands even if `absorbed-answer-key.test.ts` is deleted. Do not treat the deletion as a route to relaxing it.

---

## 6. Suggested build order

Six phases. Every dependency below is a real one read off the code, not a preference.

### Phase 27 — Extract the shared seams the deletion would take with it

**Deliver:** `acme-test-gate.ts` (the ACME half of `anno-test-gate.ts`, §1.4); `prg-image.ts` (`parsePrg`, `flatImageOrigin`); the `codeOnly()` / `shippedTsModules()` helpers `stock-dispatch.test.ts:2889,2919` borrows from `spawn-seam.test.ts`. Repoint `disasm-roundtrip.test.ts` and `skill-acme-build-cli.test.ts` at the new ACME gate.

**Why first:** these are the modules with surviving consumers *outside* the anno family. Every one of them is a silent breakage if the deletion runs first, and each is a pure move with no behaviour change — the cheapest possible phase, and it makes every later phase's diff readable.

**Green bar:** full `npm test` unchanged (not `test:automated` — that skips `MANUAL_ONLY_TESTS`). No anno module deleted yet.

### Phase 28 — The store: model, persistence, undo

**Deliver:** `anno-model.ts`, `anno-store.ts`. The 12-member type vocabulary. Ranges, scopes, project enums, labels, comments. Atomic write + in-document undo journal. `resolveStorePath()` carried over from `anno-tools.ts` with the extension literal changed.

**Deliver the two planted-violation proofs here, not later:** (i) mutate → kill process → reopen returns the mutation, and *deleting `writeAtomic()` turns it red*; (ii) mutate → kill → reopen → undo reverts, and *making the journal in-memory turns it red*.

**Why second:** everything else reads or writes this. It has no dependency on the tool surface, the exporter, or any deletion.

**Green bar:** the two planted violations observed red, then green. No MCP surface exists yet, so no CI gate moves.

### Phase 29 — The MCP surface, derived from the Phase 19 manifest

**Deliver:** `anno-tools.ts` (`ANNO_TOOL_DEFINITIONS`, `CURATED_ANNO_TOOLS`, `assertCuratedTool()` incl. batch recursion, `runAnnoTool()`); `anno-xref.ts`; the `vice-proxy.ts` two-line registration; **and every guard that moves on registration** — `stock-dispatch.test.ts` (six sites), the three loop-var-regex witnesses, `scripts/check-skill-tool-coverage.mjs`, `package.json` `files[]`, `scripts/check-npm-packages.mjs`.

**The surface is a diff, not a judgement call.** The manifest's union across the five procedures is:

| verb (upstream name) | manifest disposition | new name |
|---|---|---|
| `set_label_name`, `set_comment`, `set_data_type`, `read_region`, `get_binary_info`, `get_blocks`, `get_symbols`, `get_comments`, `get_cross_references`, `get_address_details`, `disassemble`, `create_project_enum`, `apply_enum_usage`, `batch_execute`, `save_project` | `curated` | `anno_*` |
| `get_disassembly_cursor` | `adapt-to-address-input` | **no tool** — callers always supply an explicit address; `anno_read_region` answers the need (D18-24/D18-25). This is the manifest's own instruction, already honoured today. |
| `undo` | `omit` | **`anno_undo` — deliberate departure**, criterion now supplied. Update the manifest disposition in the same commit (§4d). |
| `toggle_splitter`, `set_immediate_format` | `omit`, each naming the requirement that would supply a criterion (`DECOMP-01`/`BUILD-02`, `BUILD-03`) | **omit** — those requirements are re-mapped to v0.9.0 |
| `unpack_binary` | `omit` | **omit** — the unpacker was dropped by owner decision 2026-08-25; depack-by-running via `c64-ram-capture` |

Plus the three the current surface has beyond the manifest union (`add_scope`, `search_disassembly`, `update_project_enum`, `delete_project_enum`) — 19 curated names today, and every one is exercised by at least one skill file (`scripts/check-skill-tool-coverage.mjs`'s ≥10-distinct-name floor is measured over `src/skills/**`).

**Why third:** the manifest is a committed artifact (available now, no dependency), but the surface must exist before the skills can be re-pointed to it, and before the deletion can be safe.

**Green bar:** `npm test` green **including** `tool-support-table.test.mjs` and `docs/tool-support.md`'s byte-identity drift guard; `node scripts/check-skill-tool-coverage.mjs` exits 0; `node scripts/check-npm-packages.mjs` green. **Both anno and anno families are registered simultaneously at this phase's close.** That is the point: the replacement is demonstrably ready before anything is removed.

### Phase 30 — The ACME exporter and the real-ACME round trip

**Deliver:** `anno-acme-export.ts`; `acme-verify.ts` (a direct ACME spawn matching `acme.mjs`'s argv, carrying `acmeVerdict()`'s five verdict rules — §3.3); the `=*+$01` idiom; the 11-prefix typed labels read from `AUTO_NAME_PREFIX_RE`; enum rendering via the renamed `enum-gen.ts`; `anno-symbols.ts` and the VICE `.lbl` round trip.

**Verify externally, per the project's own six-times-learned lesson:** the acceptance oracle is a real ACME 0.97 reassembling the export to bytes identical to the input, using `.planning/notes/dxa-ghidra-pivot-evidence/anno.asm` as the committed golden witness of the target format. Re-record `anno-verify.test.ts`'s two transcripts from real ACME output — the honest pass and a deliberately-constructed false-pass trap.

**Why fourth:** needs the store (28) and the surface (29). Independent of the deletion.

### Phase 31 — Re-point the five absorbed procedures

**Deliver:** every `anno_*` tool call and `anno <verb>` CLI invocation in `src/skills/` re-pointed — ~148 `anno` mentions across 10 files, concentrated in `c64-memory-mapping/SKILL.md` (53), `c64-program-recon/SKILL.md` (51) and `routine-queue-walker/SKILL.md` (21). Heuristics preserved verbatim: block classification, symbol data-flow patterns, the BASIC V2 token table, the seven-step routine procedure. `routine-queue-walker`'s YAML `description:` rewritten. All five `ATTRIBUTION (ABS-02)` blocks left **byte-identical**.

**Why fifth, and why not merged into the deletion phase:** this is prose surgery with a mechanical acceptance gate (`skill-attribution.test.ts` green, including the pairwise trigger-collision check over all seven descriptions). Merging it with a 12k-line deletion produces a diff no reviewer can read, and the milestone's own framing names this as the half that prevents "the knowledge intact and the procedure inert."

**Green bar:** `skill-attribution.test.ts` green; `check-skill-tool-coverage.mjs` green with **zero** `anno_*` names extracted and its floor re-expressed over `anno_*`; `check-skill-fork-honesty.mjs` green with the positive pointer repointed to `"anno export-asm"` (§5.2).

### Phase 32 — The deletion and the gate

**Deliver:** delete the ~12.4k lines in §2.4; rename the ~12.9k in §2.3; repoint `coverage.ts`'s two functions; discharge every guard fate in §5.3; build the whole-tree grep gate with the 10-line block-scoped attribution exemption and its exactly-10 non-vacuity counter; **observe the gate biting on a planted reintroduction** before accepting it; update `CLAUDE.md`'s constraint bullet, `.planning/ARCHITECTURE.md`'s Rule A21, and `scripts/audit-gate.mjs:136` in step with `docs-absorbed-decisions.test.ts`'s chosen fate.

**Why last, and why this ordering is not negotiable:** the replacement is registered at 29, exercised at 30, and depended on by the skills at 31. Deleting before 31 leaves the absorbed procedures pointing at nothing — the exact failure the milestone's skill half exists to prevent. Deleting before 29 breaks `scripts/check-skill-tool-coverage.mjs` at module load and leaves CI red with no replacement to point at.

**Green bar:** full `npm test`; both `check-*.mjs` CI scripts; `docs/tool-support.md` byte-identical; all six `docs-*.test.ts` guards green (a precondition of recording the milestone-audit status, enforced by a real `PreToolUse` hook via `scripts/audit-gate.mjs`); the grep gate observed red on a planted reintroduction and green after its revert; **and the gate observed green over the untouched attribution blocks** — the specific false-positive the exemption exists for.

### Dependency graph

```
27 (extract shared seams)
 └─► 28 (store: model, persistence, undo)
      └─► 29 (MCP surface + every registration-time guard)   ← anno and anno coexist here
           ├─► 30 (ACME exporter + real-ACME round trip)
           └─► 31 (re-point the five absorbed procedures)
                └─► 32 (deletion + grep gate + guard fates)   ← anno gone
                     ▲
                  30 ─┘   (32 needs 30's exporter, since check-skill-fork-honesty.mjs's
                           positive pointer must name a verb that exists)
```

---

## 7. Anti-patterns specific to this milestone

### Anti-pattern 1: Adding the annotation family to `capability-registry.ts`

**What people do:** treat "26 entries declare every tool's support level per backend" as meaning *every tool has an entry*.
**Why it's wrong:** the registry is a *delta*, not a census. Its header names the exact precedent (`vice_diagnose`/`vice_recycle`) and calls the inclusion "a factual error, not merely an omission." An entry would also render a spurious row in `docs/tool-support.md`, breaking its byte-identity guard.
**Instead:** add the loop-variable name to `stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS` and leave the registry alone. That is where the property is enforced.

### Anti-pattern 2: Hand-adding the family to a manifest

**What people do:** add `anno_*` entries to `tools-manifest.json` so `tools/list` "knows about them".
**Why it's wrong:** both manifests are regenerated by `refresh-manifest.ts` from a live **host VICE** server's own `tools/list`. An annotation store is never that host, so a hand-added entry is silently wiped on the next refresh. `vice-proxy.ts:3387-3400` already records this in a comment, and `stock-dispatch.test.ts:1563` asserts the absence in both directions.
**Instead:** register proxy-locally; `tools/list` is served from the same `tools{}` object `buildViceTool()` populates.

### Anti-pattern 3: Routing the family through `buildBackendAwareTool()`

**What people do:** reach for the "one backend-aware registration seam" because its doc comment says never to bypass it.
**Why it's wrong:** on the non-fork arm it calls `dispatchStock()`, which has no table entry for an `anno_*` name and **refuses by name** — so the entire store would be unreachable on the stock backend. `vice-proxy.ts:3387` says it outright: "`buildBackendAwareTool()` would be flatly wrong here (there is nothing for it to dispatch to on either backend)."
**Instead:** `buildViceTool()` directly, listed as an asserted exception in `BACKEND_SEAM_BYPASS_KEYS`.

### Anti-pattern 4: Importing `hostpath.ts` to "find where the store file goes"

**What people do:** reason that a file path crossing a boundary needs translation.
**Why it's wrong:** the store file never leaves the container. Translating it would be the mirror image of DERIV-07's wrongly-translated screenshot path — the bug `hostpath-consumers.test.ts`'s closed consumer set exists to prevent. The five-element `deepEqual` fails immediately.
**Instead:** `repoRoot()` + `resolveStorePath()`'s six-step containment ladder.

### Anti-pattern 5: An explicit save verb that governs durability

**What people do:** carry `anno_save_project` across as `anno_save`, with mutations buffered in memory until it is called.
**Why it's wrong:** it reintroduces the entire failure class the deletion is meant to remove — a save that reports success without persisting (which is why `saveAndVerify()` exists today), and an undo journal that dies with the process. It also makes the durability planted violation vacuous: removing the save would break an explicit call, not the mutation path.
**Instead:** persist-before-return; map the procedures' save step onto `anno_checkpoint` (an undo boundary, durability-neutral).

### Anti-pattern 6: Narrowing the type vocabulary to the seven names in PROJECT.md

**What people do:** implement exactly the seven listed, folding four split-table layouts into one "table".
**Why it's wrong:** the split-address table is the structure the pivot notes record `da65` as unable to express, and losing it recreates the export-boundary loss the pivot exists to avoid. It also silently narrows the surviving coverage census.
**Instead:** all twelve, read verbatim off `anno_set_data_type`'s schema.

### Anti-pattern 7: A grep gate that exempts by file, or that consults the exemption first

**What people do:** exempt the three SKILL.md files wholesale, or check `if (exempt) continue` at the top of the loop.
**Why it's wrong:** WR-03 in this repo's own history: a line reading `// see acme.mjs cmdDisasm / toacme, evidence: "disasm"` short-circuited all three checks because the exemption substring appeared anywhere on it. File-level exemption is strictly worse — it blesses ~148 mentions in the three files that carry the most.
**Instead:** block-scoped, shape-matched, per-check exemption; substantive checks first; an exactly-10 non-vacuity counter.

---

## Integration Points

### External tools

| Tool | Integration pattern | Gotchas |
|---|---|---|
| **ACME 0.97 "Zem"** | `spawnSync("acme", ["--cpu","6510","-f","cbm","--msvc","-v1","-o",prg,src])`, argv matched to `src/skills/acme-build/scripts/acme.mjs` | probe `$ACME`, `/usr/local/share/acme`, `/usr/share/acme`, `/usr/lib/acme`, `~/.acme` for the library. **Never derive the verdict from the exit code** — parse `--msvc` diagnostics and `existsSync(prg)`. Absence is an expected SKIP in CI, gated by the extracted `acme-test-gate.ts`. |
| **the external analyser** | **removed** | `cargo install` only, rustc ≥ 1.90, ~5 min build — which is why `VICE_REQUIRE_ANNO` was never set in CI. Its removal deletes a documented install prerequisite from the README. |
| **VICE (`x64sc`)** | unchanged; the store never touches it | the annotation family's independence from it is the whole point of the `buildViceTool()` route. |

### Internal boundaries

| Boundary | Communication | Notes |
|---|---|---|
| `vice-proxy.ts` ↔ `anno-tools.ts` | one static import + one 2-line loop | the only coupling; asserted by `stock-dispatch.test.ts`'s registration scan |
| `anno-tools.ts` ↔ `anno-store.ts` | direct call, synchronous | the store is the only writer; `anno-tools.ts` never touches `node:fs` itself |
| `anno-*` ↔ `hostpath.ts` | **forbidden** | asserted by `hostpath-consumers.test.ts`'s 5-element consumer set |
| `anno-*` ↔ `vice.ts` / `forwardToVice()` | **forbidden, by construction** | asserted by the repointed runner-purity test at `stock-dispatch.test.ts:1549` |
| `src/mcp/vice/**` ↔ `src/skills/**` | **no imports either way** — separate npm packages | why `acme-verify.ts` re-implements `acme.mjs`'s spawn rather than importing it |
| `coverage.ts` ↔ the store | reads block types | the only surviving coupling to upstream's response format (two functions, §2.3) |

---

## Open questions for the planner

1. **Tool prefix.** `anno_*` is assumed throughout. `store_*` and `vice_anno_*` are alternatives; `vice_*` is unavailable (it would collide with the manifest namespace and confuse `check-skill-tool-coverage.mjs`'s extraction regexes). Whichever is chosen, the grep gate's rule becomes "no shipped tool name may contain `anno_`", which is prefix-independent.
2. **`docs-absorbed-decisions.test.ts` / Rule A21.** Two defensible fates (§5.3). This is a decision, not a mechanical fix, and it moves `scripts/audit-gate.mjs`.
3. **`absorbed-answer-key.test.ts`.** Keeping it preserves the "do not archive phase directories" decision's second leg. Deleting it should be an explicit choice recorded as such.
4. **Store file naming and multiplicity.** One store per binary under analysis, or one per workspace? `resolveStorePath()` takes a caller-supplied path today, which supports many; the absorbed procedures all pass `project` explicitly. Recommend keeping caller-supplied.

---

## Sources

All HIGH-confidence claims read directly at HEAD (`main`, 2026-08-26):

- `src/mcp/vice/vice-proxy.ts` — `:194`, `:1507`, `:1531`, `:2009`, `:2987`, `:3052`, `:3263` (`buildViceTool`), `:3323` (`buildBackendAwareTool`), `:3387-3402`
- `src/mcp/vice/capability-registry.ts` — full file; 26 entries, header exclusion rules
- `src/mcp/vice/hostpath-consumers.test.ts` — full file; `EXPECTED_IMPORTERS`, `annoProductionModules()`, `ANNO_MODULE_FLOOR`, `DERIVED_TOOL_MODULES`
- `src/mcp/vice/anno-tools.ts` — header, `ANNO_TOOL_DEFINITIONS` (19 names), `CURATED_ANNO_TOOLS:634`, `resolveStorePath()`, `anno_set_data_type` schema (12-member enum)
- `src/mcp/vice/stock-dispatch.test.ts` — `:44`, `:1485-1575`
- `src/mcp/vice/anno-verify.ts` — header, `:47` (`buildVerifyArgs`/`runAnno` import), exports
- `src/mcp/vice/anno-test-gate.ts` — both gate halves; consumer scan
- `src/mcp/vice/anno-coverage.ts` — `:131-134`, `:1384`, `:1662`, `:1683`
- `src/mcp/vice/anno-project.ts`, `anno-symbols.ts` — export lists
- `src/mcp/vice/docs-linerefs.test.ts`, `capability-registry.test.ts:154-174`, `tool-support-table.test.mjs:62-78`
- `src/mcp/vice/package.json` — `files[]` (15 anno entries + `anno-regbits.json`)
- `scripts/check-skill-fork-honesty.mjs:412-510` — the `toacme` gate precedent
- `scripts/check-skill-tool-coverage.mjs:35-520`, `scripts/generate-tool-support-table.mjs:85-135`, `scripts/check-npm-packages.mjs:190-240`, `scripts/audit-gate.mjs:106-140`
- `src/skills/acme-build/scripts/acme.mjs:100-170` — the real-ACME spawn
- `src/skills/*/SKILL.md` — 5 `ATTRIBUTION (ABS-02)` blocks, 10 exempt lines, measured mention counts
- `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json` — 5 procedures, 20-verb union, 3 re-sync triggers, 5 disposition rationales
- `.planning/notes/dxa-ghidra-pivot-evidence/anno.asm` — committed real ACME export with 4 `=*+$01` labels
- `.planning/PROJECT.md` (Current Milestone v0.7.0, Constraints, Key Decisions), `CLAUDE.md`, `.planning/seeds/own-the-annotation-store.md`

Measurements: `wc -l src/mcp/vice/anno-*.ts` (25,759 = 10,102 non-test + 15,657 test); `grep -c anno` on both manifests and `docs/tool-support.md` (0, 0, 0); `grep -rc the external analyser src/skills` (27 across 8 files); `grep -rc anno src/skills` (~148 across 10 files).

---
*Architecture research for: owned annotation store, v0.7.0*
*Researched: 2026-08-26*
