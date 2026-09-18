---
phase: 59-the-tool-location-seam-and-its-precedence-order
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 6
files_reviewed_list:
  - src/mcp/vice/tool-location.mts
  - src/mcp/vice/tool-location.test.ts
  - src/mcp/vice/prerequisites.json
  - src/mcp/vice/prerequisites.test.ts
  - src/mcp/vice/phase58-citation-ledger.test.ts
  - src/mcp/vice/build.ts
findings:
  critical: 0
  warning: 6
  info: 1
  total: 7
status: issues_found
---

# Phase 59: Code Review Report

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 6 (`tool-location.mts`, `tool-location.test.ts`, `prerequisites.json`, `prerequisites.test.ts`, `phase58-citation-ledger.test.ts`, `build.ts`; `tsconfig.build.json` and `docs/phase59-tool-location-placement.md` were read but produced no additional findings beyond what's folded into the items below)
**Status:** issues_found

## Summary

The centerpiece, `tool-location.mts`, is well-built for the properties the phase's own criteria name explicitly: it holds no module-level memo (only a static `HERE` directory string, not a resolution cache); the three-layer walk resolves the environment, then `tools.json`, then `$PATH`, in that order, with the file layer's refusal genuinely terminal for a well-formed-but-invalid entry (confirmed by a direct test, `tool-location.test.ts:898-913`); the two `fileOverridable: false` ids (`dxa`, `node`) are refused before any layer is touched; the executable-bit check correctly uses `accessSync(path, X_OK)` scoped to the file layer alone; `~/` expansion, bare-`~` handling, and relative-value resolution against `projectRoot` (never `toolsDir` or cwd) all behave as documented and are each covered by a real scratch-filesystem test; and the two-candidate `readDeclaration()` join correctly finds `prerequisites.json` from both the unbuilt source's directory and the compiled artifact's one-directory-deeper location, proven by a build-then-dynamic-import test.

Tracing the file-layer and refusal logic against the stated invariants (never falls through after refusing; never reads `tools.json` for an unknown id) surfaced two related gaps that the test suite does not cover, plus a handful of smaller robustness and test-quality issues. None of these are exploitable today — the module's own header states "nothing calls this seam yet" — but they are real defects in the seam's contract, worth closing before Phase 60 wires live callers against it.

## Warnings

### WR-01: A malformed `tools.json` (bad JSON, non-object top level, or a non-string per-id value) is silently treated as "nothing to say" and falls through to `$PATH`, rather than refusing

**File:** `src/mcp/vice/tool-location.mts:560-586`
**Issue:** The file layer's terminal-refusal guarantee ("once a non-empty entry names a candidate for this id, resolution is TERMINAL for this call... never falls through to `$PATH` afterward (D-09)") only holds when the raw value is a non-empty string (line 570: `if (typeof rawValue === "string" && rawValue !== "")`). Three cases that `validateToolsFile()` treats as genuine problems are, inside `resolveTool()`, treated identically to "this id is simply absent from the file" and silently fall through to the `$PATH` probe (or to "nothing found"):
- `tools.json` contains invalid JSON (`JSON.parse` throws at line 564, caught at line 566, `parsed` is set to `null`, and the whole `if (parsed && typeof parsed === "object" ...)` block at line 568 is skipped).
- The top level parses but is not a plain object (array or primitive) — same skip.
- The entry for this id exists but is not a string (`null`, a number, an array, an object) — the inner `if` at line 570 is simply false, and execution falls through the closing brace with no refusal produced.

This means a user who introduces a JSON typo into `tools.json` gets a *silently different* outcome depending on whether the typo happens to still parse as valid JSON: a syntactically valid but semantically wrong value (e.g. a path that doesn't exist) produces a clear refusal naming the file (`buildFileLayerRefusal`), while a syntactically broken file (a missing quote, a trailing comma) or a wrong-typed value for the same key silently degrades the override into "not present," and resolution proceeds to search `$PATH` or return "nothing found" with `refusal: null`. A user relying on `tools.json` to *force* a particular binary would get no signal that their override was ignored.

**Fix:** Treat "this id has an entry (of any kind) but the entry could not be judged" as a refusal too, not a silent fall-through. For example, once the id key is present in a parsed object but the value is not a valid non-empty string, refuse by name; and consider surfacing an explicit refusal when the file itself fails to parse (`validateToolsFile()` already has the right message for both cases — this function should refuse the same way rather than diverge from it):
```ts
if (doc && typeof doc === "object" && !Array.isArray(doc) && id in doc) {
  const rawValue = doc[id];
  if (typeof rawValue !== "string" || rawValue === "") {
    return { id, path: null, tried, layer: null, mechanism: null,
      refusal: `"${id}"'s tools.json entry must be a non-empty string naming a path; found ${describeValueShape(rawValue)}` };
  }
  ...
}
```

### WR-02: `resolveTool()`'s id-to-record lookup and the tools.json value lookup use bracket property access, not an own-property check — an id shaped like an `Object.prototype` member bypasses the "unknown id" refusal and touches `tools.json`

**File:** `src/mcp/vice/tool-location.mts:447-448` and `:569`
**Issue:** `const record = declaration.tools[id];` followed by `if (!record) { ...refusal... }` (lines 447-457) assumes a falsy lookup means "not declared." For `id` equal to `"constructor"`, `"toString"`, `"valueOf"`, `"hasOwnProperty"`, `"isPrototypeOf"`, `"propertyIsEnumerable"`, or `"toLocaleString"`, `declaration.tools[id]` resolves to the corresponding inherited `Object.prototype` member (a function), which is truthy, so the `!record` guard never fires. Execution then proceeds as if this were a real declared tool: `record.location?.fileOverridable` and `record.kind` read as `undefined` off the function object (harmless), but the function reaches the `tools.json` layer at line 560 and performs `const rawValue = (parsed as Record<string, unknown>)[id];` (line 569) — i.e. it *does* read `tools.json`, directly contradicting the module's own documented invariant: "An id this declaration does not know returns a refusal naming it and reads `tools.json` never" (lines 433-434), and the matching test's premise (`tool-location.test.ts:532-551`, "an undeclared tool id is refused by name, and tools.json is never touched to answer it") — that test only exercises `id = "not-a-real-tool"`, which correctly hits the `!record` branch, so it does not catch this case.

Concretely: if `tools.json` happens to contain `{"constructor": "/some/real/executable"}`, then `resolveTool("constructor", { toolsDir, projectRoot, env: {} })` returns a *successful* resolution (`layer: "file"`, `mechanism: "tools.json"`, a real path) for a string that is not one of the eight declared tool ids at all — masquerading as a legitimate declared tool.

The project already recognized and defended against exactly this hazard class one function over: `validateToolsFile()`'s unknown-key check deliberately uses `acceptedIds.includes(key)` (array membership) "never an object-property lookup keyed by the raw string... so a prototype-shaped key (e.g. `"__proto__"`) refuses exactly like any other unrecognised value" (`tool-location.mts:384-388`, backed by `tool-location.test.ts:650-667`, T-59-09). That same defense was not carried over to `resolveTool()`'s own id lookup.

**Fix:** Guard the lookup with an own-property check rather than truthiness:
```ts
const record = Object.hasOwn(declaration.tools, id) ? declaration.tools[id] : undefined;
if (!record) { ... }
```
and, symmetrically, guard the `tools.json` value lookup the same way (`Object.hasOwn(parsed, id)` before indexing). Add a test mirroring T-59-09 but for `resolveTool()` itself (e.g. `resolveTool("constructor", …)` with a `tools.json` entry planted under that key must refuse, not resolve).

### WR-03: `toolsFileTemplate()` hardcodes its two reserved-key exclusions by literal id name rather than deriving them from every `fileOverridable: false` record

**File:** `src/mcp/vice/tool-location.mts:640-641, 648-649, 652-657`
**Issue:** `nodeReason`/`dxaReason` are read via `declaration.tools.node?.location?.reason` and `declaration.tools.dxa?.location?.reason` (lines 640-641), and the two reserved keys `_viceBrokerNode`/`_dxa` are emitted unconditionally (lines 648-649) — both hardcoded to exactly the two ids that are excluded *today*. The per-tool loop (lines 652-657) does generically skip any record with `location?.fileOverridable === false`, but it does so silently: an id excluded this way that is *not* `node` or `dxa` would simply vanish from the emitted template with no explanatory `_`-prefixed key at all, contradicting the function's own stated purpose ("so a reader editing the file by hand finds both exclusions and their reasons without opening this module," lines 42-46 of the module header). Nothing in `prerequisites.test.ts` or `tool-location.test.ts` asserts "every `fileOverridable: false` record has a matching reserved-key note in the template," so a third exclusion added to `prerequisites.json` in a future phase would silently regress this guarantee with no test failure to catch it.
**Fix:** Derive the reserved-key set generically:
```ts
const excludedReserved = Object.entries(declaration.tools)
  .filter(([, r]) => r.location?.fileOverridable === false)
  .map(([id, r]) => [`_${id}`, r.location?.reason ?? ""] as const);
```
and add a structural test asserting the reserved-key count in the template equals the number of `fileOverridable: false` records in the declaration (a relation, not a pinned count, per this project's own convention).

### WR-04: `~/` expansion silently degrades to a relative-path guess when `HOME` is unset, with no signal that the tilde could not be expanded

**File:** `src/mcp/vice/tool-location.mts:260-263`
**Issue:** `normalizeFileLayerValue()` expands `"~/foo"` via `join(env.HOME ?? "", rawValue.slice(2))`. When the injected/real environment has no `HOME` (plausible for a process launched under a minimal systemd unit — this project's own broker is documented to run as a systemd unit, see `docs`/MEMORY notes on broker lifecycle), the expansion silently becomes `join("", "bin/x64sc")` = `"bin/x64sc"`, which is then resolved *relative to `projectRoot`* rather than failing or refusing. A user who wrote `~/bin/x64sc` into `tools.json` expecting their home directory would instead get a path resolved against the project root — which may not exist (producing a refusal that doesn't mention the real cause, "HOME is unset"), or worse, may coincidentally exist and resolve to the wrong binary.
**Fix:** When the value starts with `~/` and `env.HOME` is absent or empty, either refuse explicitly ("~/... could not be expanded: HOME is not set in the environment this seam was given") rather than silently falling back to an empty-string join, or document the fallback as intentional and add a test exercising it.

### WR-05: The `$PATH` probe layer performs a raw `existsSync` check with no kind or executable-bit validation, unlike the other two layers

**File:** `src/mcp/vice/tool-location.mts:227-242, 591-597`
**Issue:** `resolveOnPath()` (the `$PATH` walk) accepts any candidate for which `existsSync()` is true — it never checks `statKind()` (file vs. directory) the way `matchesDeclaredKind()` does for the env and file layers, and it never runs the executable-bit check `passesFileLayerCheck()` applies to the file layer. For an executable-kind id (the only kind that ever reaches this layer, per line 591), a same-named *directory* sitting on `$PATH` ahead of the real binary — or a same-named file with no executable bit — would be silently accepted and returned as the resolved tool location (`layer: "probe"`, `mechanism: "$PATH"`), with no refusal and no indication that the "found" path isn't actually a runnable executable. The module header describes this as deliberately mirroring the two pre-existing private `$PATH`-walk implementations exactly (`backend-detect.mts`'s `defaultResolveBinPath()` and `host-tool.mts`'s `findSiblingBinary()`), so this gap is not new to this phase, but the seam is the one place in this tree that now also enforces `kind`- and executable-bit-awareness for the other two layers — the resulting inconsistency (two layers validate, one doesn't) is worth naming explicitly rather than carrying forward silently a third time.
**Fix:** At minimum, apply `statKind(candidate) === "file"` inside `resolveOnPath()`'s existence check (or as a post-filter in the caller) so a same-named directory on `$PATH` cannot be reported as a resolved executable location. Flagging this to Phase 60, which is already scheduled to collapse all three `$PATH`-walk copies into one, is a reasonable alternative to fixing it in this phase.

### WR-06: The "many concurrent `resolveTool` calls" tests exercise no real concurrency — every write/read pair is fully synchronous, so the interleaved/torn-read branch they assert against is unreachable

**File:** `src/mcp/vice/tool-location.test.ts:322-337, 915-944`
**Issue:** Both tests build their "concurrent" call set via `Array.from({ length: 20 }, () => Promise.resolve(resolveTool(...)))` (and, in the second test, a write immediately preceding each call inside the same synchronous callback). `Array.from`'s mapping function runs synchronously for every index before any `Promise.resolve()` microtask is even scheduled, and `resolveTool()` itself is fully synchronous (no `await`, no callback-based I/O) — so there is no actual interleaving between the writes and the reads: each iteration's write completes, then that same iteration's read happens, strictly in program order, before the next iteration starts. The test comment describes this as proving "no cache" and "T-59-13" backstop behavior ("never a merge"), which is true but trivially so — it is really testing sequential repeatability, not concurrency. More concretely, the second test's assertion allows an `isParseRefusal` branch (`result.path === null && typeof result.refusal === "string"`) intended to cover a torn/mid-write JSON read; that branch is dead in this test (never exercised, because there is no genuine race), and — per WR-01 above — it would not even match `resolveTool()`'s actual behavior on a JSON parse failure, which currently returns `refusal: null`, not a string. If a real interleaved read were ever exercised (e.g. via a genuinely async I/O injection), the test's own allowed-outcomes list would fail against the current implementation.
**Fix:** Either rename/reframe the test's claim to "sequential repeatability, no cache" (which is what it actually proves and is still a useful property), or construct genuine interleaving — e.g. inject an `exists`/`readFile` override that yields to the microtask queue mid-check — if concurrent-read coverage is actually intended. Note WR-01 must also be fixed before the `isParseRefusal` branch could ever legitimately fire.

## Info

### IN-01: `resolveOnPath()` has no direct test coverage, and its separator-containing-name branch is entirely unreached

**File:** `src/mcp/vice/tool-location.mts:227-242`
**Issue:** `resolveOnPath` is exported and documented as the module's contribution toward collapsing three duplicate `$PATH`-walk implementations into one (module header, lines 13-18), but `tool-location.test.ts` never imports or calls it directly — it is only exercised indirectly through `resolveTool()`'s `$PATH` layer, and every such call passes a tool id (`"x64sc"`, `"c1541"`, etc.) that never contains `/`. The `bin.includes("/")` branch (lines 229-232), which resolves the path via `resolvePath(bin)` against the ambient `process.cwd()` rather than any injectable root, is therefore never exercised by any test in this diff.
**Fix:** Add a direct unit test for `resolveOnPath()` covering both branches, including a `bin` value containing `/`, if this exported function is meant to be reused by Phase 60's collapse (as the module header implies it will be).

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
