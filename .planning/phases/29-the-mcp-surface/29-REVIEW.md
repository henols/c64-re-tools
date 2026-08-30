---
phase: 29-the-mcp-surface
reviewed: 2026-08-30T08:40:00Z
depth: standard
files_reviewed: 90
files_reviewed_list:
  - CLAUDE.md
  - .github/workflows/ci.yml
  - .gitignore
  - README.md
  - scripts/audit-gate.mjs
  - scripts/check-no-regenerator2000.d.mts
  - scripts/check-no-regenerator2000.mjs
  - scripts/check-npm-packages.mjs
  - scripts/check-skill-fork-honesty.mjs
  - scripts/check-skill-tool-coverage.mjs
  - scripts/generate-tool-support-table.mjs
  - scripts/lib/anno-cli-verbs.d.mts
  - scripts/lib/anno-cli-verbs.mjs
  - scripts/lib/skill-corpus.d.mts
  - scripts/lib/skill-descriptions.d.mts
  - scripts/lib/skill-honesty-checks.mjs
  - src/mcp/vice/absorbed-answer-key.test.ts
  - src/mcp/vice/acme-gate.ts
  - src/mcp/vice/anno-acme-ident.ts
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
  critical: 6
  warning: 14
  info: 0
  total: 20
status: issues_found
---

# Phase 29: Code Review Report

**Reviewed:** 2026-08-30T08:40:00Z
**Depth:** standard
**Files Reviewed:** 90
**Status:** issues_found

## Summary

Phase 29 replaced the external-analyser integration with a store-backed `anno_*` MCP surface
(`anno-tools.ts`, 2,060 lines, 19 verbs), bumped `SCHEMA_VERSION` to 3 with `anno_enum_usage` and
`removeScope()`, rebuilt `render-memmap` over the store, narrowed the CLI to two verbs, and deleted
14 files / 8,221 lines behind a new removal gate.

The store seam and the never-throw boundary are, on the whole, well built: `runAnnoTool()`'s
`try`/`finally` is correct, the allow-list gate runs before any argument is looked at, `changed:false`
is never mapped to an error, and refusals carry their class. The removal gate itself
(`check-no-regenerator2000.mjs`) is sound — byte-level reads, no binary skip, pinned exact counts in
both directions, a non-vacuity floor, and a proven-empty allow-list.

What did not survive scrutiny is the boundary **around** that core:

* **Two of the three caller-supplied paths on the CLI are unconfined.** `--out` writes and
  `--provenance` reads escape the workspace root entirely. I reproduced both against this working
  tree: `anno coverage --out /tmp/…` wrote a file outside the repo, and `anno render-memmap --out
  /tmp/…` *silently overwrote* a pre-existing file with no `--force` and no refusal. Both function
  headers assert the opposite in writing.
* **`anno_disassemble` produces a plausible-looking zero** — the exact failure mode this module's
  own header is written against. An address wholly outside the image returns `isError:false`,
  `instructions: 0`, and an `end_address` numerically *below* the `address` it was asked about. Its
  sibling `anno_read_region` handles the same input correctly, so the two views documented as
  sharing "one cap, both views" disagree.
* **Three shipped skill playbooks document commands that cannot run.** The `render-memmap`
  invocation in `c64-program-recon/SKILL.md` (and the *template an agent copies*) still names
  `game.regen2000proj`, and a dated note actively asserts the verb "still reads the pre-store
  project file" — plan 29-12 rebuilt it over the store. `routine-queue-walker`'s Phase-5 measurement
  command passes a `.prg` to a verb that requires the deleted analyser's JSON format.
* **Nested `anno_batch_execute` is unconditionally refused**, because phase-one validation does not
  propagate the batch's `store` the way phase-two execution does — with a refusal message that tells
  the caller the opposite of the tool's own description.

Every BLOCKER below was reproduced by executing the shipped code, not inferred. All probe artifacts
were removed; the working tree is unmodified.

## Critical Issues

### CR-01: `anno_disassemble` answers a wholly-out-of-image address with a successful empty listing

**File:** `src/mcp/vice/anno-tools.ts:1798-1803`, `1836-1840`

**Issue:** `sliceSpan()` guards only `from < 0 || to >= body.length`. It never checks `from > to`.
`dispatchDisassemble()` clamps `end = Math.min(requestedEnd, last)` *before* slicing, so when
`start` is past the end of the image, `from` exceeds `to` and `subarray()` returns an **empty**
`Uint8Array` rather than `null` — the `outsideImage()` refusal at `:1840` is never reached.

Reproduced against a `.prg` loading at `$1000` with a 4-byte payload:

```
anno_disassemble { address: 0x9000 }            -> isError:false
{"origin":4096,"address":36864,"end_address":4099,"instructions":0,"listing":"!cpu 6510\n* = $9000"}

anno_disassemble { address: 0x9000, end_address: 0x9010 }  -> identical
anno_read_region { start:0x9000, end:0x9010 }   -> {"available":false,"reason":"...not entirely inside the image..."}   (correct)
```

Two facts make this a blocker rather than cosmetic. First, the body reports `end_address: 4099`
(`$1003`) for `address: 36864` (`$9000`) — an end below the start, i.e. an incoherent range that no
caller can validate. Second, this is precisely the "plausible-looking zero" MCP-04 and this file's
own header forbid: an agent asked to disassemble a routine at an address it mis-derived is told the
routine has no instructions, which reads as "this region is empty" rather than "you named the wrong
image".

**Fix:** make `sliceSpan()` total, and refuse before the clamp:

```ts
function sliceSpan(image: LoadedImage, start: number, end: number): Uint8Array | null {
  const from = start - image.origin;
  const to = end - image.origin;
  if (from < 0 || to >= image.body.length || from > to) return null;   // <-- add from > to
  return image.body.subarray(from, to + 1);
}
```

and in `dispatchDisassemble()` refuse on the *requested* span before clamping, so `start > last` is
reported by `outsideImage()`:

```ts
if (start > last) return outsideImage("anno_disassemble", image, start, requestedEnd);
const end = Math.min(requestedEnd, last);
```

---

### CR-02: `anno <verb> --out` writes outside the workspace root, and `render-memmap` overwrites without `--force`

**File:** `src/mcp/vice/anno-cli.ts:323`, `:355`, `:770-771`, `:788`, `:840`

**Issue:** Both verbs put *some* of their caller-supplied paths through
`storePathWithinWorkspace()` and leave `--out` outside it entirely. `cmdCoverage()` confines
`project` and `store` (`:770-771`) then calls `writeFileSync(out, …)` (`:840`) on the raw argument.
`cmdRenderMemmap()` confines `store` (`:301`) then calls `writeFileSync(outPath, …)` (`:355`), where
`outPath` is the raw `--out` when supplied (`:323`).

Both headers state the opposite as a maintained property — `:704` claims "Both caller-supplied paths
are confined by `storePathWithinWorkspace()`" and `:41` calls it "the ONE confinement seam" — so the
next maintainer has a written guarantee that the code does not keep. There are three caller-supplied
paths on each verb, not two.

`cmdRenderMemmap()` additionally never calls `refuseOverwrite()`, and `--force` is not in its
`VERB_OPTIONS` entry at all, so the write is unconditional.

Reproduced on this tree:

```
$ anno coverage <project> --store <store> --out /tmp/ESCAPE-PROOF.json
coverage: wrote /tmp/ESCAPE-PROOF.json (schema version 2)          # outside the repo

$ echo "PRE-EXISTING IMPORTANT FILE" > /tmp/ESCAPE-VICTIM.md
$ anno render-memmap <store> --provenance /tmp/sidecar.json --out /tmp/ESCAPE-VICTIM.md
render-memmap: wrote /tmp/ESCAPE-VICTIM.md (0 row(s), …)           # silently destroyed, no --force
```

This CLI is invoked by skill playbooks through Bash with agent-composed arguments
(`routine-queue-walker/SKILL.md:241`, `c64-program-recon/SKILL.md:255`), so the argument is
LLM-supplied by design — the same threat model `anno-tools.ts` and `stock-symbols.ts` already confine
against.

**Fix:** run every caller-supplied path through the one seam, and make overwrite policy uniform:

```ts
// cmdCoverage
let outPath: string | undefined;
if (out) {
  try { outPath = storePathWithinWorkspace(out, workspaceRoot); }
  catch (err) { console.error(`coverage: ${errMsg(err)}`); return 1; }
  if (!refuseOverwrite(outPath, force, "coverage")) return 1;
}
…
writeFileSync(outPath!, …);

// cmdRenderMemmap -- confine the explicit --out, and add --force to VERB_OPTIONS
const outPath = out
  ? storePathWithinWorkspace(out, workspaceRoot)
  : join(dirname(storePath), "memory-map.md");
if (!check && !refuseOverwrite(outPath, force, "render-memmap",
      " -- the rendered map is a generated view; re-run with --force to regenerate it")) return 1;
```

---

### CR-03: `render-memmap --provenance` reads any file on the filesystem and echoes its opening bytes

**File:** `src/mcp/vice/anno-cli.ts:311-313`, `src/mcp/vice/anno-memmap-render.ts:316`, `:353-362`

**Issue:** `provenancePath` is never confined — not in `cmdRenderMemmap()` and not in
`renderMemoryMap()`, whose `RenderMemoryMapOptions` doc comment documents `storePath`'s confinement
in detail (`anno-memmap-render.ts:311-314`) and says nothing at all about `provenancePath` one line
below (`:316`). `readFileSync(provenancePath, "utf8")` at `:353` then reads whatever the argument
points at, and the JSON-parse failure at `:362` interpolates Node's own error message, which carries
a content snippet.

Reproduced:

```
$ printf 'SECRET_TOKEN=hunter2-abcdefg\n' > /tmp/secret.env
$ anno render-memmap <store> --provenance /tmp/secret.env
render-memmap: renderMemoryMap: provenance sidecar at "/tmp/secret.env" is not valid JSON:
Unexpected token 'S', "SECRET_TOK"... is not valid JSON
```

An arbitrary-file-read oracle with partial content disclosure, driven by an agent-composed argument,
in a tree whose stated architecture is that *every* host-facing or caller-supplied path goes through
one seam.

**Fix:** confine it at the CLI, next to `storePath`, and take the workspace root into
`renderMemoryMap()`'s own contract:

```ts
let provenancePath: string;
try {
  storePath      = storePathWithinWorkspace(store, workspaceRoot);
  provenancePath = storePathWithinWorkspace(provenance, workspaceRoot);
} catch (err) { console.error(`render-memmap: ${errMsg(err)}`); return 1; }
```

and in `anno-memmap-render.ts`, either re-confine `provenancePath` against the `workspaceRoot` it
already receives, or document it as confined-by-the-caller the way `storePath` is — silence is what
let this through.

---

### CR-04: The shipped playbook and the copy-forward template document a `render-memmap` invocation that cannot work

**File:** `src/skills/c64-program-recon/SKILL.md:255-256` and `:263-267`;
`src/skills/c64-program-recon/templates/memory-map.template.md:11-12`;
identical shipped twins at `installer/skills/c64-program-recon/SKILL.md:255-256` and
`installer/skills/c64-program-recon/templates/memory-map.template.md:11-12`

**Issue:** Plan 29-12 rebuilt `render-memmap` over the annotation store — the verb's positional
argument is now the store (`anno-cli.ts:284`, USAGE at `:91`), opened with `openStore(…,
{mustExist:true})`. The playbooks were not updated. They still instruct:

```bash
npx -y @henols/vice-mcp anno render-memmap game.regen2000proj --provenance sidecar.json
```

and the dated note at `:263-267` asserts, in the present tense, the opposite of the shipped code:

> "it still reads the pre-store project file shown above. … until this verb is rebuilt over the
> `.annostore` it runs only against a project file you already have."

Reproduced against a real `.regen2000proj`-shaped file:

```
render-memmap: …/game.regen2000proj: not an annotation store (file is not a database) --
refusing to treat a truncated, empty or foreign file as an empty store…      (exit 1)
```

The `.regen2000proj` format's only producer was deleted in this same phase, so the documented input
cannot be created either. `memory-map.template.md` is a template an agent **copies into every new
project**, so the wrong route propagates rather than staying put, and `SKILL.md` is the primary
route an agent reaches this verb by.

**Fix:** re-point all four files onto the store, and delete the falsified dated note:

```bash
npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json
node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.annostore --provenance sidecar.json
```

Replace `:263-267` with the fact that is now true: the verb reads the store, creates neither the
store nor the sidecar, and writes `memory-map.md` beside the store by default.

---

### CR-05: `routine-queue-walker`'s Phase-5 measurement command cannot run — `coverage <project>` requires the deleted analyser's JSON format

**File:** `src/skills/routine-queue-walker/SKILL.md:241` (and the shipped twin at
`installer/skills/routine-queue-walker/SKILL.md:241`); `src/mcp/vice/anno-cli.ts:537-554`,
`src/mcp/vice/anno-coverage.ts:2108-2155`

**Issue:** The playbook's only measurement instruction is:

```
node src/mcp/vice/vice-proxy.ts anno coverage game.prg --store game.annostore
```

But `<project>` is parsed as JSON with a `raw_data_base64` gzip payload — `projectImage()` at
`anno-cli.ts:541` does `JSON.parse(readFileSync(projectPath, "utf8"))`, and `loadProject()` at
`anno-coverage.ts:2111` does the same. A `.prg` is not JSON. Reproduced:

```
$ anno coverage game.prg --store p.annostore ; echo $?
coverage: the project's payload was UNAVAILABLE -- …/g.prg is not valid JSON --
Unexpected token ' ', " ????" is not valid JSON
1
```

The verb prints a whole report of zeros and then exits 1, so a reader skimming the output sees a
completed census. Worse, the format `<project>` requires was produced only by `r2000-project.ts`,
deleted in this phase — so unlike CR-04 there is no correct spelling of this command for a new
project at all. `coverage` is currently reachable only for users holding a pre-deletion project file.

This is the same class of gap the phase *did* record for `render-memmap` (a dated withdrawal note)
and did not record here. Either the verb needs a `.prg`/flat-image input path (it already has
`parsePrg`/`flatImageOrigin` one import away via `prg-image.ts`), or the playbook must carry an
explicit dated withdrawal saying the measurement is unavailable this milestone. Shipping a
measurement step that always fails is the worst of the three options.

**Fix (preferred):** teach `projectImage()`/`loadProject()` the two image forms `anno-tools.ts`'s
`loadImage()` already dispatches (extension first, never by byte length), and change the playbook
and USAGE to `coverage <image> --store FILE`. **Fix (minimum):** add a dated withdrawal note to
`routine-queue-walker/SKILL.md` beside `:241` naming the deleted producer, matching the shape
`c64-program-recon/SKILL.md` uses for `gen-enums`/`export-lbl`.

---

### CR-06: Nested `anno_batch_execute` is always refused — phase-one validation does not inherit `store`, phase-two execution does

**File:** `src/mcp/vice/anno-tools.ts:1352-1355`, `:1366-1368`, `:1934-1936`

**Issue:** `assertAnnoBatch()` recurses into a nested batch with the child's **raw** arguments:

```ts
if (call.name === "anno_batch_execute") {
  assertAnnoBatch(call.arguments, depth + 1);   // <-- store NOT injected
  return;
}
```

The recursion then validates the grandchild calls with `batchArgumentsFor(args, call)` where `args`
is the *nested* payload, whose `store` is `undefined` — because the outer batch supplies it. Phase
two does the opposite: `dispatchBatchExecute()` at `:1934` builds `innerArgs =
batchArgumentsFor(bag, call)`, which *does* carry the outer store into the nested batch.

So every nested batch that relies on the documented inheritance is refused whole. Reproduced:

```
anno_batch_execute { store, calls: [ { name:"anno_batch_execute",
  arguments: { calls: [ { name:"anno_save_project", arguments:{} } ] } } ] }

-> isError:true  [AnnoToolArgumentError] anno_save_project refused (calls[0]):
   "store" must be a non-empty string … because there is no ambient current store to inherit.
```

Three things make this worse than a plain refusal. The message tells the caller *there is no
inheritance*, while the tool description at `:900-911` says "The store … is named ONCE at the top
level and every inner call inherits it; an inner `store` is overridden, never honoured." The
refusal names `anno_save_project` as the culprit, so nothing in the message points at the nesting.
And `ANNO_MAX_BATCH_DEPTH = 4` with its stack-exhaustion rationale (T-29-24) governs a shape that
cannot currently reach depth 2 by the documented route — the cap is exercised only by callers who
redundantly re-supply `store` inside (verified: that spelling does execute).

**Fix:** propagate the effective arguments into the recursion, exactly as execution does:

```ts
if (call.name === "anno_batch_execute") {
  assertAnnoBatch(batchArgumentsFor(args, call), depth + 1);
  return;
}
```

Add a test asserting that a depth-2 batch relying on inheritance validates *and* executes, and that
depth-5 is refused by name — the depth cap currently has no reachable positive control.

## Warnings

### WR-01: `unique(address, bank)` on `anno_enum_usage` enforces nothing for the rows this code writes

**File:** `src/mcp/vice/anno-store.ts:290-296`, `:3332-3337`

**Issue:** SQLite treats NULLs as distinct in a UNIQUE index. Every row `applyEnumUsage()` writes
has `bank = null` (`:3341`), so the constraint never fires. Verified directly:

```
create table t (…, bank integer, unique(address, bank));
insert (4096, 1, null); insert (4096, 2, null);   -> SECOND INSERT SUCCEEDED
```

The comment at `:3332` cites that constraint by name as the reason "ONE ADDRESS CARRIES AT MOST ONE
ENUM". The invariant actually rests entirely on the select-then-update at `:3327-3335`, which holds
single-process inside `applyWrite`'s transaction but has no database-level backstop — and
`listEnumUsage()`'s join would happily return both duplicates.

**Fix:** either make the invariant real —
`create unique index anno_enum_usage_addr on anno_enum_usage(address, ifnull(bank, -1));` — or
correct the comment to say the invariant is upheld by the guarded write path alone and that the
declared constraint is inert while `bank` is null. Do not leave a comment naming a guarantee the
schema does not provide.

### WR-02: `references anno_enum(id)` is inert, and `listEnumUsage()`'s inner join hides the consequence

**File:** `src/mcp/vice/anno-store.ts:293`, `:3389-3403`

**Issue:** SQLite does not enforce foreign keys unless `pragma foreign_keys = ON`, and this module
deliberately sets no pragmas (trap 4). `listEnumUsage()` uses `join anno_enum e on e.id =
u.enum_id`, so a usage row whose enum is missing would silently vanish from the listing rather than
be reported — the store would return a shorter list than it holds, with nothing saying so. Reachable
today only if a future verb deletes an enum (there is none) or a restored snapshot disagrees; but
the phase added the table without adding the guard.

**Fix:** use a `left join` and surface an unresolved row as
`{ enumName: null, unresolved: true }`, or add an explicit integrity assertion in
`listEnumUsage()` that a usage row with no enum is an `AnnoStoreCorruptError`. Note the FK's
inertness in the DDL comment either way.

### WR-03: `search_*` flags accept any non-`false` value, so the string `"false"` silently enables a corpus

**File:** `src/mcp/vice/anno-derive.ts:459-462`; `src/mcp/vice/anno-tools.ts:1252-1257`

**Issue:** `corpusEnabled()` returns `flag !== false`. The `inputSchema` declares
`type: "boolean"`, but `vice-proxy.ts`'s `validate: (value) => ({ value })` enforces nothing (this
file's own `AnnoToolArgumentError` doc comment says so), and `assertSearchArgs()` never checks the
three flags. Reproduced: `anno_search { search_labels: "false" }` returns
`"labels":{"searched":true,…}` — the opposite of what was asked, with no refusal. A JSON string
where a boolean was meant is one of the most common LLM argument errors.

**Fix:** validate them in `assertSearchArgs()` alongside every other argument:

```ts
for (const key of ["search_labels", "search_comments", "search_instructions"] as const) {
  const raw = argBag(args)[key];
  if (raw !== undefined && typeof raw !== "boolean") {
    refuseArg(name, key, `"${key}" must be a boolean, got ${JSON.stringify(raw)} -- a string "false" would ENABLE the corpus.`, batchIndex);
  }
}
```

### WR-04: Four structural collections are returned whole, ungoverned by `max_results`, in a family that is not chunked

**File:** `src/mcp/vice/anno-tools.ts:1608`, `:1647-1649`, `:1661`, `:1673`, `:1689`

**Issue:** `anno_get_blocks`'s `include` returns `scopes`/`enums`/`enum_usage` whole, and **every
enum and scope write verb echoes the full collection back on every call**: `dispatchScope` returns
all scopes, `dispatchCreateProjectEnum`/`dispatchUpdateProjectEnum` return all enums,
`dispatchApplyEnumUsage` returns all enum usages. `anno_enum_usage` is address-keyed and can hold up
to 65,536 rows. The file's own cap comment (`:1100-1120`) states that nothing on this family is
chunked and that "the cap is the only bound there is", and the schema justifies the exemption with
"these collections are small by construction" — which is an assumption about caller behaviour, not a
property of the schema. A batch applying enum usage across a table returns a linearly growing list
on each of its entries.

**Fix:** bound the echo-backs (return a count plus the affected row, not the whole table), and give
`include`'s collections their own explicit ceiling with a `truncated` flag, matching the
`returned`/`matched`/`truncated` shape the list verbs already use.

### WR-05: `store` and `image` are documented as "workspace-relative" but are resolved against `process.cwd()`

**File:** `src/mcp/vice/anno-tools.ts:407-414` (STORE_PROPERTY), `:416-426` (IMAGE_PROPERTY);
`src/mcp/vice/anno-types.ts` `realpathOfNearestExisting()` → `resolve(p)`

**Issue:** Both schema descriptions say "Absolute or workspace-relative path".
`storePathWithinWorkspace()` calls `resolve(path)`, which is relative to the **process working
directory**, and only then confines the result against `repoRoot()`. Demonstrated: running the same
relative argument from a subdirectory resolved to `<cwd>/<arg>`, not `<repoRoot>/<arg>`. The MCP
server's CWD is whatever Claude Code launched it in, which is not guaranteed to equal the resolved
repo root (`repo-root.ts` has a four-step fallback ladder that does not start at CWD).

It fails safe — a mis-resolved path is refused by the confinement check rather than silently
accepted — but the refusal will name a path the caller never typed, which is hard to diagnose.

**Fix:** resolve relative arguments against the workspace root explicitly, or correct both
descriptions to "absolute, or relative to the server's working directory".

### WR-06: `corpora.<name>.entries` means two different things depending on which corpus was disabled

**File:** `src/mcp/vice/anno-derive.ts:565-571`

**Issue:** `labelHits` and `commentHits` are computed unconditionally, so a disabled labels corpus
still reports its true size; `instructionHits` is `[]` when disabled, so a disabled instructions
corpus reports `entries: 0`. Verified: `{search_labels:false, search_instructions:false}` returns
`labels:{searched:false,entries:0}` only because the store is empty — on a populated store the two
disagree. The verb's own description promises "Every corpus is named in the body with the number of
entries it held", which is false for the instructions corpus when it is not searched.

**Fix:** either count the instruction corpus's entries even when it is not searched (expensive, and
the description warns about that), or report `entries: null` for any corpus with `searched:false`
so an unmeasured size is distinguishable from a measured zero — the same
`{available:false, reason}` discipline the rest of this surface uses.

### WR-07: `prg-image.ts`'s reachability rationale — the stated reason it is in `files[]` — is now false

**File:** `src/mcp/vice/prg-image.ts:30-36`

**Issue:** The header claims: "`vice-proxy.ts` reaches `anno-cli.ts` (through a dynamic import), and
`anno-cli.ts` imports `parsePrg` and `flatImageOrigin` from here." `anno-cli.ts:82` imports only
`decodeRawData`. The two named functions are now reached through `anno-tools.ts`'s `loadImage()` and
`anno-coverage.ts`, so the module *is* still reachable — but the sentence a maintainer would check
this against is wrong, and this is exactly the "rationale that became false" pattern the store
module's own header treats as evidence.

**Fix:** rewrite `:30-36` to name the two live routes (`anno-tools.ts`'s `loadImage()` for the MCP
surface, `anno-coverage.ts` for the census) and the one `anno-cli.ts` actually uses.

### WR-08: `refuseOverwrite()`'s doc claims uniformity it does not have

**File:** `src/mcp/vice/anno-cli.ts:182-193`

**Issue:** "Shared by every verb that writes an output file, so overwrite safety stays uniform
rather than one verb accreting a check the others lack (CR-01/CR-02)." `cmdRenderMemmap()` writes
`--out` at `:355` and never calls it. The comment names the exact defect it now contains.

**Fix:** wire `render-memmap` through `refuseOverwrite()` (see CR-02), or scope the comment to
`coverage` and record why the generated view is exempt.

### WR-09: Five modules with no production consumer are still shipped in the npm tarball

**File:** `src/mcp/vice/package.json:56-73`

**Issue:** After the deletion, `anno-d64.ts`, `anno-symbols.ts`, `anno-enum-gen.ts`,
`anno-regbits-gen.ts` and `anno-register.ts` have no importer outside their own tests
(`anno-regbits-gen.ts` is imported only by `anno-enum-gen.ts`, itself orphaned;
`anno-acme-ident.ts` survives only through those two). Their previous consumers — `r2000-cli.ts`,
`r2000-tools.ts`, `r2000-session.ts` — were deleted in plan 29-10. `check-npm-packages.mjs` asserts
only that every *reachable* module is listed, never the converse, so nothing catches this.
`anno-register.ts` in particular is a documentation registry with a test-only consumer.

This matters beyond tidiness: `anno-seam.test.ts` and `shipped-modules.ts` derive their scan set
from `files[]`, so unreachable modules dilute those guards, and 29-08's own register asserts verbs
have "named consumers" while five of the modules behind them have none.

**Fix:** decide per module. If Phase 30 rebuilds `gen-enums`/`export-lbl`/`import-lbl` over the
store (as `anno-cli-verbs.mjs:50-60` says it will), record that here as a dated retention note
naming the phase. Otherwise remove them from `files[]` and from the tree.

### WR-10: `dispatchSaveProject()` reads the revision twice, so the field and the prose can disagree

**File:** `src/mcp/vice/anno-tools.ts:1700-1710`

**Issue:** `revision: currentRevision(handle)` at `:1702` and
`String(currentRevision(handle))` at `:1707` are two separate reads on the same connection. A
concurrent writer committing between them yields a body whose `revision` field and whose note text
name different revisions — from the one verb whose entire purpose is reporting a revision that will
be used as a `base_revision` compare-and-swap guard.

**Fix:**

```ts
const revision = currentRevision(handle);
return { store: handle.path, revision, wrote: false, note: `… durable at revision ${revision} …` };
```

### WR-11: The inode guard compares `ino` without `dev`

**File:** `src/mcp/vice/anno-tools.ts:1495-1514`

**Issue:** `assertStorePresent()` returns `statSync(p).ino` and `assertSameFile()` compares it. Inode
numbers are unique only per filesystem, so a swap to a same-numbered inode on a different device
(a bind mount or tmpfs overlay — a shape this repo's architecture is built around) passes the guard.
The cost of closing it is one field.

**Fix:** capture and compare `{ dev, ino }`:

```ts
function assertStorePresent(name: string, p: string): { dev: number; ino: number } {
  … const s = statSync(p); return { dev: s.dev, ino: s.ino };
}
function assertSameFile(name: string, p: string, before: { dev: number; ino: number }): void {
  const now = statSync(p);
  if (now.dev !== before.dev || now.ino !== before.ino) { … }
}
```

### WR-12: `parsePrg()` accepts a load address whose payload runs past `$FFFF`, and the overflow reaches result bodies

**File:** `src/mcp/vice/prg-image.ts:69-78`; `src/mcp/vice/anno-tools.ts:1806`, `:1834`, `:1877`

**Issue:** `parsePrg()` validates only `length >= 3`. A `.prg` with load address `$FF00` and a 1 KB
payload yields `origin + body.length - 1 > 0xffff`. `loadImage()` computes `last` from that
(`:1834`), `dispatchBinaryInfo()` returns it as `last_address` (`:1877`), and `outsideImage()` prints
it as a five-hex-digit "address" (`:1806`) — a value outside the 6510's address space that
`parseStoreAddress()` would refuse anywhere else on this surface. `anno-derive.ts:197` caps the
*image* at 65,536 bytes but says nothing about origin + length.

**Fix:** refuse in `parsePrg()` by name, in the same shape as its length refusal:

```ts
if (origin + (bytes.length - 2) - 1 > 0xffff) {
  throw new Error(`parsePrg: load address $${origin.toString(16)} plus ${bytes.length - 2} payload byte(s) runs past $ffff`);
}
```

### WR-13: The removal gate's `exemptionFor()` short-circuits, making any class added after the block-scoped ones unreachable

**File:** `scripts/check-no-regenerator2000.mjs:782-789`

**Issue:** For a path listed in a `blockScoped` or `skillBlocks` class, an occurrence outside a block
`return null` immediately, aborting the loop over the remaining `EXEMPTION_CLASSES`. This is
correct today only because those two classes are last in the array. A future class appended after
them silently cannot cover any file that also appears in `NOTICES_FILES` or
`SKILL_ATTRIBUTION_PINS` — and the failure mode is a false reintroduction error whose cause is
invisible from the message. Contrast the `atLines` branch immediately above, which correctly
`continue`s.

**Fix:** `continue` instead of `return null`, and let the final `return null` after the loop be the
only "no class covers this" answer. The per-class exact-count assertions already prevent a second
class from over-covering.

### WR-14: Mechanical renaming left user-facing and cross-referencing strings pointing at the retired vocabulary

**File:** `src/mcp/vice/anno-cli.ts:866`, `:893`, `:902`; `src/mcp/vice/vice-proxy.ts:300`;
`scripts/lib/anno-cli-verbs.mjs:62`; `scripts/check-npm-packages.mjs:236-239`

**Issue:** The subcommand was renamed `r2000` → `anno` but several identifiers and user-visible
strings were not:

* `anno-cli.ts:893` — a user typing `vice-mcp anno badverb` is answered `r2000: unknown verb "…"`,
  naming a subcommand that no longer dispatches. Same at `:902` for the last-resort catch.
* `anno-cli.ts:866` — the CLI's exported entry point is still `runR2000Cli`, and
  `vice-proxy.ts:307` imports it under that name.
* `vice-proxy.ts:300` — the test hatch is still `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES`.
* `scripts/lib/anno-cli-verbs.mjs:62` cites "`extractedR2000.size >= 10`" as its precedent; that
  identifier is now `extractedAnno` and the floor is 18 (`check-skill-tool-coverage.mjs:478`), so a
  reader following the cross-reference finds nothing.
* `scripts/check-npm-packages.mjs:236-239` mixes renamed and deleted module names in one historical
  sentence ("the whole r2000 family (`anno-cli.ts`, `anno-d64.ts`, `r2000-project.ts`,
  `r2000-launch.ts`, `r2000-verify.ts`)"), three of which no longer exist.

**Fix:** rename `runR2000Cli` → `runAnnoCli` and the env hatch, change the two `r2000:` message
prefixes to `anno:`, and repair the two stale cross-references. For the historical sentence in
`check-npm-packages.mjs`, mark it explicitly past-tense with the pre-deletion names rather than
half-renaming it — a citation that is half-renamed is unusable in both directions.

---

_Reviewed: 2026-08-30T08:40:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
