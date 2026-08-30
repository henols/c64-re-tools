---
phase: 29-the-mcp-surface
reviewed: 2026-08-30T14:05:00Z
depth: standard
files_reviewed: 96
files_reviewed_list:
  - CLAUDE.md
  - .github/workflows/ci.yml
  - .gitignore
  - README.md
  - scripts/audit-gate.mjs
  - scripts/check-no-regenerator2000.d.mts
  - scripts/check-no-regenerator2000.mjs
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-cli-invocations.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - scripts/lib/anno-cli-invocations.d.mts
  - scripts/lib/anno-cli-invocations.mjs
  - scripts/lib/anno-cli-verbs.d.mts
  - scripts/lib/anno-cli-verbs.mjs
  - scripts/lib/skill-corpus.d.mts
  - scripts/lib/skill-descriptions.d.mts
  - scripts/lib/skill-honesty-checks.mjs
  - src/mcp/vice/absorbed-answer-key.test.ts
  - src/mcp/vice/acme-gate.ts
  - src/mcp/vice/anno-acme-ident.ts
  - src/mcp/vice/anno-cli-invocations.test.ts
  - src/mcp/vice/anno-cli-path-consumers.test.ts
  - src/mcp/vice/anno-cli.test.ts
  - src/mcp/vice/anno-cli.ts
  - src/mcp/vice/anno-confidence.test.ts
  - src/mcp/vice/anno-confidence.ts
  - src/mcp/vice/anno-coverage-grammar.test.ts
  - src/mcp/vice/anno-coverage.test.ts
  - src/mcp/vice/anno-coverage.ts
  - src/mcp/vice/anno-d64.test.ts
  - src/mcp/vice/anno-d64.ts
  - src/mcp/vice/anno-derivation.test.ts
  - src/mcp/vice/anno-derive.test.ts
  - src/mcp/vice/anno-derive.ts
  - src/mcp/vice/anno-details.ts
  - src/mcp/vice/anno-enum-gen.test.ts
  - src/mcp/vice/anno-enum-gen.ts
  - src/mcp/vice/anno-memmap-render.test.ts
  - src/mcp/vice/anno-memmap-render.ts
  - src/mcp/vice/anno-regbits-gen.ts
  - src/mcp/vice/anno-regbits.json
  - src/mcp/vice/anno-regbits.test.ts
  - src/mcp/vice/anno-register.test.ts
  - src/mcp/vice/anno-register.ts
  - src/mcp/vice/anno-schema-v2-fixture.mjs
  - src/mcp/vice/anno-seam.test.ts
  - src/mcp/vice/anno-store.test.ts
  - src/mcp/vice/anno-store.ts
  - src/mcp/vice/anno-symbols.ts
  - src/mcp/vice/anno-tools.test.ts
  - src/mcp/vice/anno-tools.ts
  - src/mcp/vice/anno-types.test.ts
  - src/mcp/vice/anno-types.ts
  - src/mcp/vice/anno-verb-coverage.test.ts
  - src/mcp/vice/audit-integrity.test.ts
  - src/mcp/vice/block-class.test.ts
  - src/mcp/vice/block-class.ts
  - src/mcp/vice/capability-registry.test.ts
  - src/mcp/vice/comment-phase-pointers.test.ts
  - src/mcp/vice/docs-absorbed-decisions.test.ts
  - src/mcp/vice/docs-dangling-refs.test.ts
  - src/mcp/vice/docs-uat-abstention.test.ts
  - src/mcp/vice/docs-worktree-isolation.test.ts
  - src/mcp/vice/fixtures/coverage/make-coverage-fixtures.mjs
  - src/mcp/vice/fixtures/coverage/README.md
  - src/mcp/vice/fixtures/planted-removal-fixture.md.txt
  - src/mcp/vice/fixtures/planted-removal-fixture.ts.txt
  - src/mcp/vice/fixtures/README.md
  - src/mcp/vice/hop-chain-comments.test.ts
  - src/mcp/vice/hostpath-consumers.test.ts
  - src/mcp/vice/host-scripts.test.ts
  - src/mcp/vice/module-classification.test.ts
  - src/mcp/vice/module-classification.ts
  - src/mcp/vice/package.json
  - src/mcp/vice/prg-image.ts
  - src/mcp/vice/removal-gate.test.ts
  - src/mcp/vice/shipped-modules.test.ts
  - src/mcp/vice/shipped-modules.ts
  - src/mcp/vice/spawn-seam.test.ts
  - src/mcp/vice/stock-dispatch.test.ts
  - src/mcp/vice/stock-symbols.ts
  - src/mcp/vice/tool-support-table.test.mjs
  - src/mcp/vice/vice-proxy.test.ts
  - src/mcp/vice/vice-proxy.ts
  - src/skills/acme-build/SKILL.md
  - src/skills/c64-memory-mapping/SKILL.md
  - src/skills/c64-program-recon/references/reconstruction.md
  - src/skills/c64-program-recon/references/tool-selection.md
  - src/skills/c64-program-recon/scripts/packer-finding.mjs
  - src/skills/c64-program-recon/SKILL.md
  - src/skills/c64-program-recon/templates/memory-map.template.md
  - src/skills/c64-ram-capture/SKILL.md
  - src/skills/routine-queue-walker/SKILL.md
  - src/skills/vice-wedge-triage/SKILL.md
findings:
  critical: 1
  warning: 16
  info: 0
  total: 17
status: issues_found
---

# Phase 29: Code Review Report (re-review after gap closure 29-13..29-17)

**Reviewed:** 2026-08-30T14:05:00Z
**Depth:** standard
**Files Reviewed:** 96
**Status:** issues_found

## Summary

This overwrites the 2026-08-30T08:40Z review (90 files, 6 BLOCKER / 14 WARNING). Every prior
finding was re-checked against the code as it now stands, by reading the fix and — for the six
blockers and four of the behavioural warnings — by executing the shipped code.

**All six prior BLOCKERs are genuinely closed.** Not one of them is a comment-only repair:

* CR-01 — `sliceSpan()` now has the third case (`from > to`, `anno-tools.ts:1836`) and
  `dispatchDisassemble()` slices the span the caller named instead of one pre-clamped to `last`
  (`:1885-1889`). Both read verbs now reach the same `outsideImage()` from the same verdict.
* CR-02 — all six caller-supplied paths on the two verbs pass `storePathWithinWorkspace()`
  (`anno-cli.ts:383`, `:410`, `:425`, `:895-897`); `--force` is in `render-memmap`'s
  `VERB_OPTIONS`; `refuseOverwrite()` runs on the *confined* path on the non-`--check` branch.
* CR-03 — the sidecar parse failure is a digit-only offset extractor
  (`anno-memmap-render.ts:117-120`, `:412`), and 29-16 applied the same treatment to
  `anno-coverage.ts:2234-2265`'s sibling branch.
* CR-04 — all four `render-memmap` invocations name `game.annostore`; the falsified dated note is
  replaced by a correct one at `c64-program-recon/SKILL.md:271`.
* CR-05 — `loadProjectImage()` dispatches `.raw`/`.bin`/`.prg` by extension first
  (`anno-coverage.ts:2200-2235`), so the playbook's `coverage game.prg --store ...` runs.
* CR-06 — phase one recurses on `batchArgumentsFor(args, call)` (`anno-tools.ts:1371`), the same
  function phase two asks.

Prior WR-07, WR-08 and WR-10 are closed. WR-14 is closed in the two user-facing places and in both
stale cross-references; the two internal identifier renames are **deferred on a recorded decision**
and are re-raised below only as a pointer, not as a new demand. WR-13 is likewise
**deferred on record**.

`npm run test:automated` is green on this tree (2734 tests, 0 failures, 45.7 s), the new
`check-skill-cli-invocations` gate is wired into CI at `.github/workflows/ci.yml:215` and passes,
and `check-npm-packages.mjs` passes.

What did not survive scrutiny:

* **One new BLOCKER, reproduced.** `render-memmap --check` — the phase's own drift detector, and
  the only thing standing between a generated view and a hand edit — reports `drifted` for a store
  and sidecar that are byte-for-byte identical, purely because the checkout sits at a different
  absolute path. The banner it compares carries realpaths; the content digest inside that same
  banner is identical across the two runs. The gate contradicts the file's own digest.
* **Eight prior WARNINGs are untouched**, two of them re-reproduced here against the current tree
  rather than carried on the old report's word.
* **The two new CI gates each have a hole in the class they were built to close.** The invocation
  gate passes `anno coverage game.prg` with the REQUIRED `--store` omitted — a documented command
  that exits 1, which is exactly CR-05's shape. And `anno-cli-path-consumers.test.ts`, cited in
  three separate headers as the mechanism that "fails when one of them reaches a filesystem call
  without passing through the seam", is a *count* of call sites that cannot associate a call with
  an argument and does not cover positionals at all.
* **A literal NUL byte was introduced into a shipped source file this phase**, and the gate that
  documents that hazard cites its offset twice — both stale.

Every BLOCKER and every reproduced WARNING below was executed against this working tree. All probe
artifacts were removed; `git status` is unchanged from the session start.

## Critical Issues

### CR-01: `render-memmap --check` reports drift on an unmodified store whenever the absolute path differs — while the file's own digest says the content is identical

**File:** `src/mcp/vice/anno-memmap-render.ts:462-463` (banner), `:601-603` (byte comparison);
`src/mcp/vice/anno-cli.ts:383`, `:410`, `:425` (what is passed in)

**Issue:** Since plan 29-14, `cmdRenderMemmap()` passes the **realpath** returned by
`storePathWithinWorkspace()` into `renderMemoryMap()` for all three paths. The renderer writes two
of them verbatim into the generated file's banner:

```ts
lines.push(`  store: ${storePath}`);
lines.push(`  sidecar: ${provenancePath}`);
```

`checkRenderedMemoryMap()` then compares the on-disk file against a fresh render **byte for byte**
(`:601-603`). So the generated view is bound to the absolute path of the checkout that produced it,
and `--check` fails anywhere else — a different developer's clone, CI, or (directly relevant here,
per CLAUDE.md's GSD Execution Isolation section) any GSD worktree, which by construction sits at a
different absolute path from `main`.

Reproduced on this tree with an identical store and sidecar copied from `a/` to `b/`:

```
$ anno render-memmap .tmp-review/a/game.annostore --provenance .tmp-review/a/sidecar.json
render-memmap: wrote .../a/memory-map.md (1 row(s), 0 [unknown], digest 50e6c1b4...c8abe2)

$ cp -r .tmp-review/a .tmp-review/b
$ anno render-memmap .tmp-review/b/game.annostore --provenance .tmp-review/b/sidecar.json --check
render-memmap: drifted at line 3
  expected:   store: /home/.../.tmp-review/b/game.annostore
  actual:     store: /home/.../.tmp-review/a/game.annostore
```

Three things make this a blocker rather than cosmetic.

1. **The verdict is wrong, and the message names two causes neither of which happened.** USAGE
   (`anno-cli.ts:129-131`) and the shipped template (`memory-map.template.md:15-17`) both tell the
   reader drift means "either a hand edit to the rendered file **or** a store change since it was
   last rendered". Here it means neither, and nothing in the output says so.
2. **The file's own digest disagrees with the gate.** `computeRenderDigest()` covers the sorted
   store rows, the sidecar bytes and `RENDERER_VERSION` — not the paths — so both runs above
   printed `50e6c1b4...c8abe2`. A reader comparing the two banners sees the same digest beside a
   "drifted" verdict.
3. **The documented remedy makes it worse.** `memory-map.template.md:17-19` says "There is no way
   to 'fix' drift by editing the rendered file directly: the fix is always to re-run the
   generator." Doing that rewrites the committed artifact with the current machine's paths, so the
   file churns on every checkout and the *next* machine reds again. `--check` in CI is unusable for
   a committed memory map, which is the artifact it was built for.

**Fix:** make the banner path-independent — record the paths relative to the workspace root, which
is a fact about the project rather than about the machine:

```ts
// anno-memmap-render.ts, inside renderMemoryMap()
import { relative } from "node:path";
...
lines.push(`  store: ${relative(workspaceRoot, storePath)}`);
lines.push(`  sidecar: ${relative(workspaceRoot, provenancePath)}`);
```

`workspaceRoot` is already a required option on both `RenderMemoryMapOptions` and
`CheckRenderedMemoryMapOptions`, so no signature changes. Add a test that renders under root A,
re-`--check`s the same bytes under root B, and asserts `in-sync` — that property is what the
current suite does not pin, which is why this shipped. If the absolute paths are wanted for
diagnostics, print them to stderr on the write path instead of into the compared artifact.

## Warnings

### WR-01 (NEW): the new invocation gate cannot see a documented command that omits a REQUIRED flag — the same class as CR-05

**File:** `scripts/lib/anno-cli-invocations.mjs:216-251`; `scripts/check-skill-cli-invocations.mjs:75-78`

**Issue:** `checkInvocation()` checks exactly two things: every flag is in `VERB_OPTIONS`, and
every *positional*'s extension is a declared kind. It never checks that a verb's **required** flags
are present, and it never checks a **flag value**'s kind. Both verbs have a required flag
(`coverage --store` at `anno-cli.ts:872-878`, `render-memmap --provenance` at `:399-403`) and both
exit 1 without it. Reproduced: I edited `routine-queue-walker/SKILL.md:241` to read
`anno coverage game.prg` and re-ran the gate —

```
check-skill-cli-invocations: OK -- 10 documented anno CLI invocation(s) ...
```

— green, for a documented command that cannot run. That is precisely the failure the gate's own
header says it exists to catch ("a name-only floor cannot see a dead command"), reproduced one
level up. A documented `--store game.prg` would pass for the same reason: only positionals get a
kind check, never flag values.

**Fix:** declare the required set beside `POSITIONAL_KINDS` and check it, and give flag values their
own kinds map:

```js
const REQUIRED_FLAGS = Object.freeze({ coverage: ["--store"], "render-memmap": ["--provenance"] });
const FLAG_KINDS = Object.freeze({
  coverage: { "--store": [".annostore", ".store"] },
  "render-memmap": { "--provenance": [".json"], "--out": [".md"] },
});
// in checkInvocation():
for (const flag of requiredFlags?.[verb] ?? []) {
  if (!flags.some((f) => f.flag === flag)) problems.push(`anno ${verb}: ${flag} is required but was not supplied${where}`);
}
for (const { flag, value } of flags) {
  const kinds = flagKinds?.[verb]?.[flag];
  if (kinds && value && !isPlaceholder(value) && !kinds.includes(extensionOf(value))) {
    problems.push(`anno ${verb}: ${flag} value ${value} is not one of ${kinds.join(", ")}${where}`);
  }
}
```

Add a planted-violation case to `anno-cli-invocations.test.ts` for the omitted-required-flag shape;
the file's existing controls only plant a wrong extension.

### WR-02 (NEW): `anno-cli-path-consumers.test.ts`'s central assertion is a call-site COUNT, not an argument-to-seam association, and it is blind to positionals

**File:** `src/mcp/vice/anno-cli-path-consumers.test.ts:131-141`, `:229-243`, `:260-269`

**Issue:** Three separate headers (`anno-cli.ts:63-70`, `:337-343`, and this file's own `:32-42`)
name this test as the mechanism that "fails when one of [the path arguments] reaches a filesystem
call without passing through the seam". It does not do that. It does:

```ts
function seamCallCount(strippedSrc) { return strippedSrc.split("storePathWithinWorkspace(").length - 1; }
confinesAtLeast(stripped, CLI_PATH_ARGUMENTS.length)   // 6 >= 6
```

That is a count with no association. It cannot distinguish "six arguments, each confined once" (the
real state — verified, `anno-cli.ts` has exactly six call sites at `:383`, `:410`, `:425`,
`:895`, `:896`, `:897`) from "five arguments confined, one of them twice, one raw": the count is 6
in both. There is no slack today, which is what keeps it useful at all, but the property it is
credited with is not the property it checks.

Second, narrower hole: assertion 2 (`:229-243`) — the direction its own comment calls "the one that
catches the ACTUAL failure" — iterates `Object.entries(VERB_OPTIONS)`, which contains only
**flags**. A new *positional* path argument (`coverage <project>` and `render-memmap <store>` are
both positionals) is forced into `CLI_PATH_ARGUMENTS` by nothing at all: an author who adds one and
forgets the inventory entry gets a green suite and a count that still matches.

**Fix:** make the check per-argument rather than aggregate. Slice each `cmd*` function's body out of
the stripped source and require one `\w+\s*=\s*storePathWithinWorkspace\(` assignment inside that
body per inventory entry for that verb. Then extend assertion 2 to derive positionals too: the
per-verb `USAGE` synopsis already names them (`render-memmap <store>`, `coverage <project>`), so
parse the `<...>` tokens out of `USAGE` and require each to be in the inventory, exactly as flags
are derived from `VERB_OPTIONS`.

### WR-03 (NEW): `check-npm-packages.mjs`'s entire driver is behind an unasserted entry-point heuristic that fails silently

**File:** `scripts/check-npm-packages.mjs:161-171`, `:394`

**Issue:** 29-02 wrapped every assertion in the file in:

```js
const IS_ENTRY_POINT = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (IS_ENTRY_POINT) {
  ... the whole gate ...
}
```

If that comparison is ever false when the script *is* meant to run — invoked through a symlinked
path, through an `npm`/`npx` shim that rewrites `argv[1]`, or on a platform where the realpath and
the resolved argv path differ — the process prints **nothing at all** and exits **0**. CI reads
that as a pass. A gate whose failure mode is silence is exactly the shape this repository's own
removal gate carries a non-vacuity floor against; this one has none.

It is correct today: `node scripts/check-npm-packages.mjs` passes (verified — 78 vice-mcp files, 34
installer files, 7 skills, clean). The objection is the failure mode, not the current value.

**Fix:** hoist the body into an exported `main()` and make the branch loud rather than silent:

```js
export function main() { /* the whole gate */ }
if (IS_ENTRY_POINT) main();
else if (process.argv[1] !== undefined && basename(process.argv[1]) === basename(fileURLToPath(import.meta.url))) {
  console.error("check-npm-packages: invoked as an entry point but the entry-point test failed -- refusing to exit 0 silently");
  process.exit(1);
}
```

`check-no-regenerator2000.mjs` keeps importing `packFiles` and is unaffected.

### WR-04 (NEW): a literal NUL byte was introduced into a shipped source file, and the gate that documents the hazard cites a stale offset twice

**File:** `src/mcp/vice/anno-memmap-render.ts:315`; citations at
`scripts/check-no-regenerator2000.mjs:65-67` and `:815`

**Issue:** `computeRenderDigest()`'s canonicalisation embeds a raw `0x00` byte in its separator
string literal rather than a `\u0000` escape sequence:

```
const canonical = JSON.stringify({ blocks, symbols, comments }) + "<a raw NUL byte>" + sidecarBytes + "<a raw NUL byte>" + RENDERER_VERSION;
```

The file did not exist at the diff base (`git show <base>:...anno-memmap-render.ts` -> does not
exist), so this is new in this phase. The consequence is documented in this repo's own memory and
in the removal gate's own header: GNU `grep` classifies the whole file as binary and silently skips
it under `grep -c`/`grep -o` unless `-a` is passed, and that has already produced one wrong
decision here. A `\u0000` escape produces a byte-identical digest input with none of that.

The two citations of the byte are both **stale**: they say "offset 12862 (line 291)". Measured now:
byte 15074, line 315. `removal-gate.test.ts:234-243` asserts only that *some* NUL is present, so
nothing catches the drift — a reader following either citation lands in unrelated code.

**Fix:** replace the raw byte with the escape and name why, in a constant so there is one spelling:

```ts
// A field separator written as an ESCAPE, never a raw byte: a raw NUL makes this whole file
// binary to grep, and a grep-backed census then silently skips it.
const DIGEST_FIELD_SEPARATOR = "\u0000";
const canonical = JSON.stringify({ blocks, symbols, comments }) + DIGEST_FIELD_SEPARATOR + sidecarBytes + DIGEST_FIELD_SEPARATOR + RENDERER_VERSION;
```

The digest input is byte-identical, so no fixture or pin moves. Then delete both stale offsets from
`check-no-regenerator2000.mjs` — with the raw byte gone the caveat is historical, and rule 4
("never shell out to grep, never skip a file that looks binary") stands on its own without a
line-number citation that has to be maintained.

### WR-05 (NEW): USAGE drifted away from the code that 29-12 and 29-16 changed

**File:** `src/mcp/vice/anno-cli.ts:125`, `:136-153`

**Issue:** `--help` is the only route by which a CLI caller learns what to pass, and three of its
statements are now wrong or incomplete:

* `:125` — "writes --out (default: **memory-map.md beside the project**)". The code computes
  `join(dirname(storePath), "memory-map.md")` (`:425`) — beside the **store**. "The project" is the
  pre-29-12 vocabulary; the verb no longer takes a project.
* `:136-138` — `coverage <project> ... <project> supplies the PAYLOAD BYTES and the load origin`.
  After 29-16 the positional is an **image**: `.prg`, or an exactly-65536-byte `.raw`/`.bin`
  (`anno-coverage.ts:2218-2231`). USAGE names none of those forms, so a user reading `--help`
  cannot discover the input the shipped playbook now uses — while
  `check-skill-cli-invocations.mjs:75-78` pins exactly those three extensions as the only ones a
  playbook may document. Plan 29-16's own stated deliverable was to change "the playbook **and
  USAGE**"; only the playbook moved.
* `:150-152` — "Exits non-zero ONLY for a caller error or a store it could not read". It also exits
  1 on an undecodable payload (`:961-966`), which `cmdCoverage()`'s own doc comment names and USAGE
  does not.

**Fix:** re-spell the synopsis as `coverage <image> --store FILE ...`, name the three accepted image
forms in the body, change "beside the project" to "beside the store", and add the payload-decode
failure to the exit-code sentence. Consider asserting the synopsis against `POSITIONAL_KINDS` so
the two cannot drift again.

### WR-06 (STILL OPEN — was WR-03): `search_*` flags accept any non-`false` value, so the string `"false"` silently enables a corpus

**File:** `src/mcp/vice/anno-derive.ts:459-462`; `src/mcp/vice/anno-tools.ts:1254-1259`

**Issue:** Unchanged. `corpusEnabled()` is still `flag !== false`, and `assertSearchArgs()` still
validates only `store`, `image`, `query` and `max_results`. Every other argument family on this
surface has a validator (`assertMaxResults`, `assertBaseRevisionArg`, `assertGetBlocksArgs`'s
`include` membership check) and these three do not. `vice-proxy.ts`'s `validate: (value) => ({
value })` enforces nothing, so a JSON string where a boolean was meant — one of the most common LLM
argument errors — reverses the caller's intent with no refusal.

**Fix:** as previously stated, add to `assertSearchArgs()`:

```ts
for (const key of ["search_labels", "search_comments", "search_instructions"] as const) {
  const raw = argBag(args)[key];
  if (raw !== undefined && typeof raw !== "boolean") {
    refuseArg("anno_search", key, `"${key}" must be a boolean, got ${JSON.stringify(raw)} -- a string "false" would ENABLE the corpus.`, batchIndex);
  }
}
```

### WR-07 (STILL OPEN — was WR-06): `corpora.<name>.entries` means two different things depending on which corpus was disabled

**File:** `src/mcp/vice/anno-derive.ts:543-570`

**Issue:** Unchanged. `labelHits`/`commentHits` are built unconditionally (`:543`, `:548`), so a
disabled labels or comments corpus still reports its true size; `instructionHits` is `[]` when
disabled (`:565`), so a disabled instruction corpus reports `entries: 0`. The verb's description
promises every corpus is named with the number of entries it held, which is false for exactly one
of the three.

**Fix:** report `entries: null` for any corpus with `searched: false`, matching the
`{available:false, reason}` discipline the rest of this surface uses, so an unmeasured size is
distinguishable from a measured zero.

### WR-08 (STILL OPEN — was WR-01): `unique(address, bank)` enforces nothing for the rows this code writes

**File:** `src/mcp/vice/anno-store.ts:290-295`, `:3327-3341`

**Issue:** Unchanged. SQLite treats NULLs as distinct in a UNIQUE index, and every row
`applyEnumUsage()` writes has `bank = null` (`:3340`), so `unique(address, bank)` never fires. The
comment at `:3332-3334` cites that constraint by name as the reason "ONE ADDRESS CARRIES AT MOST
ONE ENUM". The invariant actually rests entirely on the select-then-update at `:3327-3338`, which
holds single-process inside `applyWrite`'s transaction but has no database-level backstop.

**Fix:** either make the invariant real —
`create unique index anno_enum_usage_addr on anno_enum_usage(address, ifnull(bank, -1));` — or
correct the comment to say the invariant is upheld by the guarded write path alone and that the
declared constraint is inert while `bank` is null.

### WR-09 (STILL OPEN — was WR-02): `references anno_enum(id)` is inert and `listEnumUsage()`'s inner join hides the consequence

**File:** `src/mcp/vice/anno-store.ts:293`, `:3389-3403`

**Issue:** Unchanged. SQLite enforces no foreign key without `pragma foreign_keys = ON`, which this
module deliberately never sets. `listEnumUsage()` uses `join anno_enum e on e.id = u.enum_id`, so a
usage row whose enum is missing vanishes from the listing rather than being reported — a shorter
list than the store holds, with nothing saying so.

**Fix:** `left join` plus `{ enumName: null, unresolved: true }`, or an explicit
`AnnoStoreCorruptError` for an unresolved row. Note the FK's inertness in the DDL comment either
way.

### WR-10 (STILL OPEN — was WR-04): four structural collections are returned whole, ungoverned by `max_results`, in a family that is not chunked

**File:** `src/mcp/vice/anno-tools.ts:1626`, `:1665-1667`, `:1679`, `:1690`, `:1706`

**Issue:** Unchanged. `dispatchScope` returns `scopes: listScopes(handle)`;
`dispatchCreateProjectEnum`/`dispatchUpdateProjectEnum` return `enums: listProjectEnums(handle)`;
`dispatchApplyEnumUsage` returns `enum_usage: listEnumUsage(handle)`; and `anno_get_blocks`'s
`include` returns all three whole. `anno_enum_usage` is address-keyed and can hold 65,536 rows. The
file's own cap comment (`:1100-1120`) states that nothing in this family is chunked and "the cap is
the only bound there is". A batch applying enum usage across a table returns a linearly growing
list on every entry.

**Fix:** bound the echo-backs (return a count plus the affected row, not the whole table) and give
`include`'s collections an explicit ceiling with a `truncated` flag, matching the
`returned`/`matched`/`truncated` shape the list verbs already use.

### WR-11 (STILL OPEN — was WR-05): `store` and `image` are documented as "workspace-relative" but resolve against `process.cwd()`

**File:** `src/mcp/vice/anno-tools.ts:407-426`; `src/mcp/vice/anno-types.ts:1080-1081`, `:1192-1202`

**Issue:** Unchanged. `realpathOfNearestExisting()` opens with `resolve(p)`, which is relative to
the **process working directory**, and only then is the result confined against `repoRoot()`. The
MCP server's CWD is whatever Claude Code launched it in; `repo-root.ts` has a four-step fallback
ladder that does not start at CWD. It fails safe — a mis-resolved path is refused rather than
silently accepted — but the refusal names a path the caller never typed, which is hard to diagnose.

**Fix:** resolve a relative argument against the workspace root explicitly, or correct both schema
descriptions to "absolute, or relative to the server's working directory".

### WR-12 (STILL OPEN — was WR-11): the inode guard compares `ino` without `dev`

**File:** `src/mcp/vice/anno-tools.ts:1513-1533`

**Issue:** Unchanged. `assertStorePresent()` returns `statSync(storePath).ino` and
`assertSameFile()` compares that single number. Inode numbers are unique only per filesystem, so a
swap to a same-numbered inode on a different device — a bind mount or tmpfs overlay, the exact
shape this repo's architecture is built around — passes the guard the comment calls "closes the
window between the existence check and the open".

**Fix:** capture and compare `{ dev, ino }`. One extra field; the two call sites are adjacent.

### WR-13 (STILL OPEN — was WR-12, reproduced): `parsePrg()` accepts a load address whose payload runs past `$FFFF`, and the overflow now reaches two surfaces

**File:** `src/mcp/vice/prg-image.ts:87-97`; `src/mcp/vice/anno-tools.ts:1852-1861`, `:1877`;
`src/mcp/vice/anno-coverage.ts:2226-2231`

**Issue:** Unchanged, and reproduced against this tree with a `.prg` carrying load address `$FF00`
and a 1024-byte payload:

```
anno_get_binary_info -> {"kind":"prg","origin":65280,"body_bytes":1024,"last_address":66303,...}
anno_read_region     -> "...loads at $ff00 and ends at $102ff..."
anno_disassemble { address: "0x10000" } -> [AnnoAddressError] 65536 is out of range -- expected 0..65535
```

`last_address: 66303` and the five-hex-digit `$102ff` are outside the 6510's address space and are
returned as successful answers, while `parseStoreAddress()` refuses any such value everywhere else
on the same surface — so a caller who reads `last_address` and feeds it back is refused by the tool
that just produced it. 29-16 gave `parsePrg()` a **second** consumer
(`anno-coverage.ts`'s `loadProjectImage()`), so the same unvalidated origin now also seeds the byte
census's address arithmetic on the CLI route.

**Fix:** refuse in `parsePrg()`, in the same shape as its existing length refusal, so both loaders
inherit it:

```ts
if (origin + (bytes.length - 2) - 1 > 0xffff) {
  throw new Error(
    `parsePrg: load address $${origin.toString(16)} plus ${bytes.length - 2} payload byte(s) runs past $ffff -- ` +
      "a .prg that does not fit the 6510's address space is refused by name rather than reported with a five-digit address",
  );
}
```

Both `loadImage()` and `loadProjectImage()` already wrap `parsePrg()`'s throw into their own named
refusal, so no call site changes.

### WR-14 (STILL OPEN — was WR-09): five shipped modules have no production consumer, and one has no consumer at all

**File:** `src/mcp/vice/package.json:51-73`

**Issue:** Unchanged, and re-measured on this tree by scanning every `.ts`/`.mts` importer:

| module | importers |
|---|---|
| `anno-symbols.ts` | **none — not even a test** |
| `anno-d64.ts` | `anno-d64.test.ts` only |
| `anno-enum-gen.ts` | `anno-enum-gen.test.ts` only |
| `anno-regbits-gen.ts` | `anno-enum-gen.ts` (itself orphaned) + `anno-regbits.test.ts` |
| `anno-register.ts` | `anno-derivation.test.ts`, `anno-register.test.ts` |
| `anno-acme-ident.ts` | reached only through the two orphans above |

All six are in `files[]` and ship in `@henols/vice-mcp`. `check-npm-packages.mjs` asserts only that
every *reachable* module is listed, never the converse, so nothing catches this.
`anno-seam.test.ts` and `shipped-modules.ts` derive their scan sets from `files[]`, so unreachable
modules dilute those guards.

**Fix:** decide per module and record it. If Phase 30 rebuilds `gen-enums`/`export-lbl`/`import-lbl`
over the store (as `.planning/REQUIREMENTS.md:73` and `scripts/lib/anno-cli-verbs.mjs` both say it
will), add a dated retention note naming Phase 30 and the requirement ids — the same shape
`prg-image.ts:30-50` now uses for its own reachability claim. Otherwise remove them from `files[]`
and from the tree. `anno-symbols.ts`, with zero importers including tests, needs an answer either
way.

### WR-15 (DEFERRED ON RECORD — was WR-13): the removal gate's `exemptionFor()` short-circuits

**File:** `scripts/check-no-regenerator2000.mjs:773-797`

**Issue:** Still present and **deliberately deferred on a recorded decision** — raised here as a
pointer only, not as a new demand. For a path in a `blockScoped` or `skillBlocks` class, an
occurrence outside a block `return null`s immediately (`:789`, `:793`), aborting the loop over the
remaining `EXEMPTION_CLASSES`; the `atLines` branch immediately above correctly `continue`s
(`:784`). Correct today only because those two classes are last in the array.

**Fix (when the deferral is lifted):** `continue` instead of `return null`, letting the final
`return null` after the loop be the only "no class covers this" answer.

### WR-16 (PARTIALLY CLOSED, REMAINDER DEFERRED ON RECORD — was WR-14): the retired vocabulary survives in two internal identifiers

**File:** `src/mcp/vice/anno-cli.ts:866`; `src/mcp/vice/vice-proxy.ts:300`, `:307`

**Issue:** Plan 29-16 closed the user-facing half — both `r2000:` message prefixes are now `anno:`
(`anno-cli.ts:1017`, `:1026`), `anno-cli-verbs.mjs`'s stale `extractedR2000`/floor cross-reference
is repaired, and `check-npm-packages.mjs:235-251` is marked explicitly past-tense with the
pre-deletion names. What remains is **deferred on a recorded decision**
(`<wr14_scope_decision>`): the exported entry point is still `runR2000Cli` and the test hatch is
still `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`. Noted so the deferral stays visible rather than
becoming invisible, not re-litigated.

**Fix (when the deferral is lifted):** rename both together with their two consumers
(`vice-proxy.ts:307`, `vice-proxy.test.ts`), in one commit.

---

_Reviewed: 2026-08-30T14:05:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
