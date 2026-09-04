# Phase 37: The Importer and the Automatic Annotation Join - Research

**Researched:** 2026-09-05
**Domain:** In-repo codebase archaeology (Ghidra export format, annotation-store seam, memmap.json schema, dxa data-block feedback). No external prior art was sought — the ROADMAP explicitly settles that question and this research honours the scope fence.
**Confidence:** MEDIUM-HIGH — every claim below is either `[VERIFIED: path]` (read this session, quoted verbatim) or `[MEASURED: command]` (a command actually run this session). No `[CITED]`/`[ASSUMED]` claims about external sources were needed since this is a pure codebase pass. A few genuine design gaps are called out as `UNMEASURED`/open — see that section; they are the load-bearing risk in this phase, not a research shortcoming.

## Summary

Phase 36 shipped a working Ghidra harness, but its **only** output format is a single flat, hand-parseable, `## `-delimited **text file** (`GhidraStructExport.java`) — there is no JSON, no structured cross-reference table, and critically **no per-instruction recovered-constant export**. The store side (`anno-store.ts`) already has almost everything Phase 37 needs waiting unused: a `putXref()`/`listXrefs()` API with a frozen four-member `XrefAccessKind` (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) that matches `GHID-05`'s spec byte-for-byte, a `setDataType()`/`listRanges()` API for machine-address annotation, and — most consequentially — **a `bank` column already present on both `anno_xref` and `anno_range`, reserved, and written as `null` by every row the store has ever produced.** Phase 37 is the first phase that will ever populate it.

The `## DECOMPILED_TEXT` section (added in plan 36-05, additively, specifically to make the volatile-carve criterion provable) is the only place a recovered `$01` constant currently surfaces, and it surfaces as a bare C assignment statement (`DAT_0001 = 0x37;`) with **no address annotation at all** — Ghidra's `DecompiledFunction.getC()` returns plain text, not the tokenized/address-mapped markup. This is the single biggest gap this research found: **AUTO-04's bank-state resolution needs `(address, constant-value)` pairs, and nothing in the committed export currently produces them.** A new, additive p-code-level export section is very likely an early Phase 37 task, not an artifact Phase 36 already delivers — see "Open Questions" below.

The `$D020`/`$D000-$DFFF` overlap AUTO-02's control needs is real and present in `memmap.json` today (measured: 8 overlapping entries at `$D020`, two of them exactly 1 byte wide). A genuine equal-width `sym`-tie-break fixture also already exists at address `$0000` (two entries, one bearing `sym: "D6510"`, one not) — reusable rather than invented. `bank.a`/`bank.prg`'s three `$D020` writes are confirmed straight-line code with **no shared program point reached from two bank contexts**, so the ROADMAP's claim that this fixture cannot exercise the path-dependent decline is **CONFIRMED**, not merely repeated — a new synthetic fixture really is required. The dxa feedback loop for `AUTO-07` (graphics ranges → `-B` data blocks) is **already fully built** (`dxa-blocks.ts`'s `emitDataBlocks()`/`emitLabels()`, wired through `dxa-run.ts`'s `knownDataRows` field) — this is a "read rows from the store, don't invent a new mechanism" task, not new plumbing. The Ghidra-side "mark as data" equivalent has **no existing wire field** — `ghidra.analyze`'s seven fields (plan 36-02) cover scripts and entry points, nothing marks a range as data before analysis.

**Primary recommendation:** Extend `ANNO_TOOL_DEFINITIONS` with 1-3 new `anno_*` tool entries (never a new tool family) for the importer, reuse `putXref()`/`setDataType()` verbatim for the join's writes, and treat the missing per-instruction bank-literal export as the phase's first blocking design gap — resolve it with a new additive `## BANK_WRITES`-style p-code section in `GhidraStructExport.java` before any AUTO-04 work is planned.

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Ghidra export (classification, references, structural facts, decompiled text) | Host (Ghidra JVM process) | — | `GhidraStructExport.java` runs inside `analyzeHeadless`, on the host, driven by `ghidra.analyze` (Phase 34's host-tool seam) |
| Transfer file (host-written, container-read, digest-and-delete) | Boundary (host writes, container consumes) | — | IMP-01/IMP-02's whole point; the file crosses the container/host line exactly once, in one direction, and is deleted by the container-side importer that reads it |
| Container-side importer (parses export, calls store writes) | Container (Node process) | — | IMP-01: "a container-side importer reading a host-written transfer file" — a new `anno-*.ts` module, or a new verb inside an existing one |
| Annotation store writes (`putXref`, `setDataType`) | Container (annotation store, `anno-store.ts`) | — | The one module naming `node:sqlite`; every write goes through `applyWrite()` |
| `memmap.json` lookup (the join's selection rules) | Container (pure data, no I/O) | — | A static JSON file already shipped with the `c64-memory-mapping` skill; the join reads it, never mutates it |
| Bank-state resolution (`$01` bits 0-2) | Container (join logic) | Host (Ghidra, if a new p-code export is added) | The *decode* of a recovered `$01` literal into LORAM/HIRAM/CHAREN is pure arithmetic and belongs in the container-side join; *recovering* the literal in the first place is a host-side Ghidra export concern (see Open Questions) |
| Graphics-range derivation (`AUTO-06`) | Container (join logic, reading VIC register xrefs already in the store) | — | Derives from register **values**, not cross-references — the join reads whatever `$DD00`/`$D018`/`$D011` constant writes the importer already stored, and computes ranges arithmetically; no new host-side capability needed |
| Graphics-range feedback to dxa (`AUTO-07`) | Container (`dxa-blocks.ts`, already built) → Host (dxa binary) | — | Existing `emitDataBlocks()`/`emitLabels()` mechanism, fed by store rows via `dxa-run.ts`'s `knownDataRows` |
| Graphics-range feedback to Ghidra ("as data") | Host (a new Ghidra pre-script capability) | — | **No existing wire field.** `VolatileCarve.java`'s entry-point-seeding loop is the closest analogue (marks addresses as code); marking a range as *data* before analysis has no committed precedent — see Open Questions |

## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| IMP-01 | Container-side importer reads a host-written transfer file, respects the store's single seam | `anno-store.ts`'s `putXref()`/`setDataType()` APIs already exist and match the target shape; `ANNO_TOOL_DEFINITIONS` extension point confirmed cheap (§B) |
| IMP-02 | Transfer file is transient, digested, consumed-and-deleted in one command | No existing "transfer file" convention found in-repo to reuse (§F) — `HostToolFileResult`'s `{path, sha256, byteLength}` shape is the closest precedent for the digest half; deletion is new |
| AUTO-01 | Mechanical join, no agent/queue/skill, reports counts, reads back from store | `listXrefs()`/`listRanges()` are the store-side read-back APIs the criterion requires |
| AUTO-02 | Narrowest-range-wins + sym tie-break, both observed red | `memmap.json` measured: real $D020 overlap (8 entries) and a real equal-width sym tie (address 0) both exist today (§C) |
| AUTO-03 | In-image address skipped, never looked up in memmap.json | Needs the loaded image's own address range — carried by `ghidra.analyze`'s `importRoute`/`loaderBaseAddr` fields plus the image's own byte length; not yet threaded to an importer (§C) |
| AUTO-04 | Bank state resolved before address, `$01` bits 0-2 decoded, control observed red | **Blocked on a real gap**: no existing export produces `(address, $01-literal)` pairs (§A, §D) — the fixture-refutation is confirmed but the *data source* for the flip is not yet built |
| AUTO-05 | Path-dependent bank state declines with a reason | Same gap as AUTO-04 — the decline logic needs the same missing data source |
| AUTO-06 | Graphics ranges from VIC pointers, not cross-references | No existing register-decode code found in this repo (§E) — new container-side arithmetic over already-stored register-write values |
| AUTO-07 | Graphics ranges fed back to dxa (`-B`) and Ghidra (as data), phantom-label before/after shown | dxa half fully built (`dxa-blocks.ts`); Ghidra half has no existing mechanism (§E) |
| AUTO-08 | Every derived row carries `memmapSha256` | No existing per-row provenance column found in `anno_xref`/`anno_range` schema — likely a schema addition, or reuse of the store's revision/snapshot mechanism (open question) |

## A. What Phase 36 hands over

**On-disk shape of a Ghidra run, today.** `ghidra.analyze` (a `host-tool.mts` allowlisted verb, orchestrated container-side by `ghidra-run.ts`) produces exactly two files per run: a run log (`outputs[0]`, always present, digested as `{path, sha256, byteLength}` by `digestOutputFile()` — `host-tool.mts:1361-1372`, quoted: `"const contents = readFileSync(path); const sha256 = createHash(\"sha256\").update(contents).digest(\"hex\"); return { path, sha256, byteLength: contents.length };"`), and an optional export file (`outputs[1]`, present only when `exportPath` is supplied, digested identically). **Neither is JSON.** The export file is written by `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java`'s `run()` method as a single `PrintWriter`, six fixed-order `## `-delimited sections in one pass:

```
## CLASSIFICATION       -- <address> code|data|undef, one line per memory-block byte
## REFERENCES           -- <from> -> <to> <ReferenceType>, uncapped, every reference
## STRUCTURAL_FACTS      -- five fact kinds (ARRAY_BOUND, SPLIT_POINTER, RECORD_STRIDE,
                            COMPUTED_JUMP_RESOLVED, SELF_MODIFYING_WRITE), each with an
                            explicit not-found line when absent
## DECOMPILE_ACCOUNTING  -- attempted/decompiled/timedOut/failed counts
## UNRESOLVED_DISPATCH   -- a bare count, no denominator
## DECOMPILED_TEXT       -- one entry per function: "FUNCTION <addr> <name>" then the
                            function's FULL decompiled C body, verbatim
```
`[VERIFIED: src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java]` (read in full this session; header comment quoted: `"WHAT IT EXPORTS. A \`## \`-delimited plain-text file, one fact per line, in a FIXED section order"`).

**`## REFERENCES` is the typed-xref source AUTO-01 needs, and it is already uncapped.** The loop is: `while (ri.hasNext()) { Reference rf = ri.next(); ... referencesSection.append(rf.getFromAddress()).append(" -> ").append(rf.getToAddress()).append(" ").append(rf.getReferenceType()).append("\n"); }` — verbatim from the source. `rf.getReferenceType()` is Ghidra's own `RefType`, whose `toString()` produces values like `READ`, `WRITE`, `READ_WRITE`, but ALSO many `FlowType` names never mentioned in `GHID-05`'s four-member vocabulary (`UNCONDITIONAL_JUMP`, `CONDITIONAL_JUMP`, `UNCONDITIONAL_CALL`, `COMPUTED_CALL`, `DATA`, etc.) — see Open Questions for the mapping gap this creates.

**`GHID-02`'s volatile carve (`VolatileCarve.java`) does NOT emit recovered `$01` literals in any structured form.** Its entire job is to `split()` memory at `$0002`/`$D000`/`$E000` and call `setVolatile(true)` on the processor port and I/O page so the *decompiler* does not dead-store-eliminate hardware writes — it never reads or records what value is written to `$01`. `[VERIFIED: src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java]` (read in full; the file's only outputs are `println()` diagnostic lines: `BLOCKS-BEFORE/AFTER`, `SPLIT-OK`/`SPLIT-SKIP`, `VOLATILE-SET`/`VOLATILE-NEW`/`VOLATILE-WARN`, `ENTRYPOINTS`, `ANALYZE-ALL: complete` — none of these carry a memory value).

**The recovered `$01` constant DOES surface, but only as untagged decompiled C text, with no address.** MEASURED this session from the committed evidence transcript: `.planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-05-volatile-disappearance.md` records real decompiled output for `bank.prg` containing the literal lines `DAT_0001 = 0x37;`, `DAT_0001 = 0x34;`, `DAT_d020 = 0xaa;`, `DAT_0001 = 0x33;` `[VERIFIED: .planning/phases/36-the-sleigh-language-and-the-ghidra-harness/evidence/36-05-volatile-disappearance.md:144-155]`. This is exactly the shape a Phase 37 join could parse — a bare C assignment statement of the form `DAT_<hex-addr> = <hex-or-decimal-literal>;` — **but `GhidraStructExport.java`'s `## DECOMPILED_TEXT` section groups these lines under a per-FUNCTION header with no per-STATEMENT address at all** (`r.getDecompiledFunction().getC()` returns Ghidra's plain-C rendering, not the address-annotated token markup `DecompileResults.getCCodeMarkup()` would give). A join cannot answer "what was `$01` at address `$0816`?" from this text alone — it can only tell that *somewhere in this function*, `$01` was assigned these literals, in source order, which is a weaker fact than AUTO-04 needs (the criterion is about a specific write's own successor addresses, not "some assignment happened in this function"). **This is the load-bearing gap** — see Open Questions.

**Every artifact from A is host-side except the digested references handed back to the container.** `ghidra.analyze` runs entirely inside `analyzeHeadless` on the host; `runGhidraAnalyze()` (`ghidra-run.ts`) reads the run-log path "AS GIVEN" — already translated by `containerPath()` inside `runHostToolFromContainer()` before this module ever sees it — and never calls `hostPath()`/`containerPath()` itself `[VERIFIED: src/mcp/vice/ghidra-run.ts]` (module header quoted: `"THIS MODULE MUST NEVER IMPORT hostpath.ts ... The run log's path has ALREADY been translated through containerPath()"`). A Phase 37 importer reading the export file inherits this exact posture: read the path the response returns as given, never touch `hostpath.ts` directly.

## B. The store's single seam, and what an importer must respect

**The seam contract.** `anno-store.ts` is "the ONE module in this repo that names `node:sqlite`" `[VERIFIED: src/mcp/vice/anno-store.ts:4]`. Every read/write goes through `openStore()` (line 432) / `closeStore()` (569), and every mutation goes through `applyWrite()` (1816), which commits before returning — "NEVER add an explicit save or flush verb. Durability is this module's responsibility, not the caller's" `[VERIFIED: src/mcp/vice/anno-store.ts, "WHAT NOT TO DO" item 6]`. The store is opened, used for exactly one call, and closed — `anno-tools.ts` documents this as D-06: `"This module holds NO module-level store handle... every verb takes store as an argument, runAnnoTool() opens it, and the finally below closes it on every path"` `[VERIFIED: src/mcp/vice/anno-tools.ts]`. **This means an importer that must write hundreds of xref/range rows from one transfer file has to do it inside ONE tool call** — there is no "hold the store open across N calls" pattern to reuse.

**Two APIs already exist, unused, that are an almost-exact fit:**
- `putXref(handle, { fromAddress, toAddress, accessKind, baseRevision? })` — inserts into `anno_xref`, deduplicating on `(from_address, to_address, access_kind)` `[VERIFIED: src/mcp/vice/anno-store.ts:3440-3466]`. `accessKind` is validated against `XREF_ACCESS_KINDS = Object.freeze(["READ", "WRITE", "READ_WRITE", "COMPUTED_JUMP"] as const)` `[VERIFIED: src/mcp/vice/anno-types.ts:313]` — this is byte-for-byte `GHID-05`'s vocabulary (`"READ / WRITE / READ_WRITE / COMPUTED_JUMP"`, `.planning/REQUIREMENTS.md:219-220`), which is strong evidence the store's xref shape was deliberately built ahead of this phase to receive Ghidra's export.
- `setDataType(handle, { start, endInclusive, dataType, baseRevision? })` — types a range, returning `contradictedComments`/`reinterpretedSplitTables` `[VERIFIED: src/mcp/vice/anno-store.ts:2322-2352]`. `DataType` is the frozen twelve: `code, byte, word, address, petscii, screencode, lo_hi_address, hi_lo_address, lo_hi_word, hi_lo_word, external_file, undefined` `[VERIFIED: src/mcp/vice/anno-types.ts:213-226]`. **There is no `dataType` for graphics/charset/sprite** — AUTO-06/07's derived graphics ranges must be typed as `byte` (or another existing member) unless a new member is added to this frozen list, which the module's own comments treat as a real schema decision, not a casual edit.

**The `bank` column already exists on both tables, reserved, always null today.** `RangeRow` carries `bank: number | null` and the module comment states: `"bank is reserved and interpreted by nothing: every row this store writes today has bank null."` `[VERIFIED: src/mcp/vice/anno-types.ts:254-263]`. `XrefRow` carries the identical field `[VERIFIED: src/mcp/vice/anno-types.ts:500-506]`, and `putXref()`'s own insert statement writes a literal `null` for it today (`"insert into anno_xref(from_address, to_address, access_kind, bank) values (?, ?, ?, ?)"` with the fourth bound parameter hard-coded `null` in the call site) `[VERIFIED: src/mcp/vice/anno-store.ts:3440-3466]`. **Phase 37 (specifically AUTO-04) is very likely the first phase in this project's history to write a non-null `bank` value.** No test in the current suite exercises a non-null bank value — the planner should expect to touch `listXrefs()`/`listRanges()`'s read path too, since both currently just pass the column through, but no caller has ever supplied a non-null write.

**`ANNO_TOOL_DEFINITIONS` — the extension point, and its cost.** It lives in `src/mcp/vice/anno-tools.ts:438` as `export const ANNO_TOOL_DEFINITIONS: readonly AnnoToolDefinition[] = [...]`. It is consumed exactly once, in `vice-proxy.ts`: `"for (const annoDef of ANNO_TOOL_DEFINITIONS) { tools[annoDef.name] = buildViceTool(annoDef, (args) => runAnnoTool(annoDef.name, args)); }"` `[VERIFIED: src/mcp/vice/vice-proxy.ts:3388-3390]`. Because this is a single loop registering into `tools[annoDef.name]`, **adding 1-3 entries to the array does not create any new registration key** — the whole family still registers as a single `annoDef.name` key in `stock-dispatch.test.ts`'s own key-scanning regex. This is confirmed directly: `BACKEND_SEAM_BYPASS_KEYS = ["RESULT_CONTINUE_TOOL.name", "annoDef.name"]`, a **two-entry, order-sensitive array**, and the comment directly above it states: `"entry keeps position 2 -- swapping the two source-order registrations must fail this test, not be normalised away by a set comparison. A THIRD entry collides here rather than being absorbed into a superset."` `[VERIFIED: src/mcp/vice/stock-dispatch.test.ts:1507-1510]` — count confirmed: exactly 2 entries, exactly as ROADMAP.md states.

**Six named guards and what breaks them:**

| Guard | What breaks it | What Phase 37 must do |
|---|---|---|
| `anno-seam.test.ts` (`node:sqlite` named by exactly one module) | Any new module calling `node:sqlite`, `import("node:sqlite")`, or `process.getBuiltinModule("node:sqlite")` directly, instead of going through `anno-store.ts` | The importer must call `putXref()`/`setDataType()`, never open the `.db` file itself `[VERIFIED: src/mcp/vice/anno-seam.test.ts:1-13]` |
| `stock-dispatch.test.ts`'s `BACKEND_SEAM_BYPASS_KEYS` (2 entries, order-sensitive) | Registering a NEW tool family (a second loop, a second `tools[key] = ...` shape) instead of adding entries to the existing `ANNO_TOOL_DEFINITIONS` array | Extend `ANNO_TOOL_DEFINITIONS`, don't add a sibling family — the bypass count stays 2 either way, confirmed above |
| `anno-verb-coverage.test.ts` (`REAL_VERBS`, hand-maintained, scans `src/skills/` and diffs `installer/skills/` for drift) | Adding a new `anno` CLI verb (e.g. a new `import` case in `anno-cli.ts`'s dispatch switch) without adding it to the hand-maintained `REAL_VERBS` array and without documenting it in at least one skill file | `REAL_VERBS = ["coverage", "export-asm", "render-memmap"]` today `[VERIFIED: src/mcp/vice/anno-verb-coverage.test.ts:53]`; a new `anno import` verb needs a fourth entry here AND a skill-doc mention |
| `anno-derivation.test.ts` (walks `upstream-procedure-manifest.json`, asserts a route in both directions via `CURATED_ANNO_TOOLS`/`annoRegisterEntryFor()`) | A new `anno_*` tool name added to `ANNO_TOOL_DEFINITIONS` with no corresponding register entry, or vice versa | Whatever new tool(s) Phase 37 adds must have a matching `anno-register.ts` entry — this is the ABS-01/ABS-04 bidirectional-route check, not specific to Phase 37 but triggered by any new entry |
| `check-skill-tool-coverage.mjs` ("SHRINK BY FAILING" allowlists) | A skill file mentioning an `anno_*` tool name that isn't real, or a real tool with no skill mention | Any new tool needs a skill-doc citation somewhere under `src/skills/` |
| `absorbed-answer-key.test.ts` (reads `.planning/phases/11-*/evidence/` with no existence guard) | Unrelated to this phase's own changes; listed by ROADMAP as one of the six guards this phase's area touches, but nothing in the importer/join design should reach it | No action needed unless a plan accidentally deletes/moves Phase 11 evidence |

**MCP-02 confirmed current, no drift.** `rewriteArguments()` is defined at `vice-proxy.ts:2007` and called at two sites: inside `forwardToVice()` (`vice-proxy.ts:2985`) at line `3050`, and inside `gatherWedgeEvidence()` (function starts `vice-proxy.ts:1505`) at line `1529` `[VERIFIED: src/mcp/vice/vice-proxy.ts:1505,1522-1529,2007,2985,3050]` — byte-identical to CLAUDE.md's cited line numbers (3050/2985/1529/1505), confirming no drift this session. The `anno_*` family is registered via `buildViceTool()` directly (`vice-proxy.ts:3388-3390`, quoted above) and the surrounding comment states explicitly: `"so no anno_* runner can ever reach forwardToVice(), call(), or ensureViceSession() -- CLAUDE.md's 'derived tools must be intercepted before forwardToVice()' constraint is satisfied by construction for this family, not by an interception"` `[VERIFIED: src/mcp/vice/vice-proxy.ts, comment immediately above the anno_* registration loop]`. **A new importer tool added to `ANNO_TOOL_DEFINITIONS` inherits this same by-construction satisfaction automatically** — it does not need its own interception logic, as long as it is registered through the existing loop and not wired to `forwardToVice()` by hand.

## C. `memmap.json`'s schema, and whether the three selection rules are implementable

**Schema (measured by loading the file this session):** top-level `{ "sources": [...], "entries": [...] }`. **959 entries total.** Each entry: `{ start: number, end: number, label: string, section: string, desc: string, src: string, sym?: string }` — `start`/`end` are **inclusive integers**, no length field; `sym` is present on 219 of 959 entries and absent (or explicitly `null`) on the rest `[MEASURED: python3 json load of src/mcp/vice/c64-memory-mapping/memmap.json this session]`.

**Rule 1 (narrowest-range-wins + sym tie-break, AUTO-02).** Measured this session: 8 entries cover address `$D020` —
```
0xd000-0xd02e  0xd000-0xd7ff  0xd000-0xdfff (x3)  0xd020-0xd020 (x2)
```
The two 1-byte entries at exactly `$D020-$D020` are `"Border color (only bits #0-#3)"` and `"Border Color"`, neither carrying a `sym`. **Confirmed real overlap, exactly the shape AUTO-02's committed control needs** (`$D020` must select the 1-byte entry over the 4096-byte `$D000-$DFFF` entry). A genuine equal-width `sym`-tie-break case also exists, at address `$0000`: entry 0 (`"Processor port data direction register"`, no `sym`) and entry 1 (`sym: "D6510"`) are both exactly `start=0, end=0` `[MEASURED: same session]` — this pair is directly reusable as the tie-break fixture rather than needing to be invented.

**Rule 2 (in-image skip, AUTO-03).** `memmap.json` carries no notion of "the loaded image" — it is a static hardware map. The loaded image's own address range must come from the SAME inputs `ghidra.analyze` already threads through the seam: `importRoute` (`"prg" | "flat64k"`) and `loaderBaseAddr`, combined with the export's own `## CLASSIFICATION` section (which enumerates every classified address, i.e. the program's actual memory-block extent) `[VERIFIED: src/mcp/vice/ghidra-project.mts — GHIDRA_IMPORT_ROUTES, importRouteBaseAddr(), from plan 36-02's summary]`. **No existing code currently threads "this address is inside the loaded image" as a fact available to a join** — this is new Phase 37 logic, but the two inputs it needs (route + base address + classification section) are both already exported.

**Rule 3 (bank-before-address, AUTO-04).** `memmap.json`'s bank-conditional entries carry the condition **only as free text in `desc`**, never as a structured field — measured this session: only 6 of 959 entries mention `"bits #0-#2"` or `"bank"` in `desc` at all, and the schema has no `bankCondition`/`ioBankBit` field. The canonical example, the `$D000-$DFFF` I/O-area entry itself, reads: `"I/O Area (memory mapped chip registers), Character ROM or RAM area (4096 bytes); depends on the value of bits #0-#2 of the processor port at memory address $0001: %x00: RAM area. %0xx: Character ROM. (Except for the value %000, see above.) %1xx: I/O Area."` `[VERIFIED: src/skills/c64-memory-mapping/memmap.json, the $D000-$DFFF "sta"-sourced entry]`. **This means the join's bank-decode logic (LORAM/HIRAM/CHAREN bit extraction, and which memmap entries are bank-conditional) is a hand-written rule, not a lookup memmap.json can answer directly** — the planner should not expect to derive "is this entry bank-conditional" mechanically from the JSON; it will need a short, explicit, hand-maintained list (the `$D000-$DFFF`/`$A000-$BFFF`/`$E000-$FFFF`-shaped ROM-vs-RAM-vs-IO entries), separate from the narrowest-range-wins mechanism.

## D. The `$01` fixture question

**CONFIRMED, with a quote — `bank.a` has no path-dependent site.** The fixture is committed at `src/mcp/vice/fixtures/ghidra/bank.a` and is straight-line code with no branches, no shared subroutine, and no loop back to an earlier program point:
```
lda #$37 / sta $01 / lda #$05 / sta $d020     ; (A) — I/O banked in
sei
lda #$34 / sta $01 / lda #$aa / sta $d020     ; (B) — I/O banked OUT
lda $d020                                     ; (C) reads RAM, not the VIC register
lda #$33 / sta $01
cpchar: lda $d000,x / sta $3000,x / inx / bne cpchar   ; (D)
lda #$37 / sta $01
cli / rts
```
`[VERIFIED: src/mcp/vice/fixtures/ghidra/bank.a]` (read in full). Each `sta $d020` (three separate program points: `$0816`/`$0820`/read at `$0823` on the flat64k route) has exactly one determinate `$01` state — none of them is REACHED from two different callers or two different bank contexts, so a join walking this fixture in program order would never face an ambiguous bank state and would never need to decline. This is the ROADMAP's exact claim, confirmed rather than merely repeated: **a new synthetic fixture with a genuinely shared program point reached under two different `$01` states (e.g. a subroutine at a fixed address, called once after `$01=$34` and once after `$01=$33`, both times performing the same `$d020`/`$d000` access) is required** — `bank.a` cannot be reused for this criterion no matter how it is read.

**Fixture build path, exact and reusable.** ACME 0.97 "Zem" (31 Jan 2021), invoked as:
```
$ acme -f cbm -o fixtures/ghidra/bank.prg fixtures/ghidra/bank.a
```
run from `src/mcp/vice/`, exit 0 `[VERIFIED: src/mcp/vice/fixtures/ghidra/README.md, "Exact ACME command, version, date" section]`. This is not a skill invocation (`acme-build` is not called) — it is a direct CLI invocation recorded in the fixture's own README, which is the precedent Phase 37's new synthetic fixture should follow: assemble with `acme -f cbm -o <name>.prg <name>.a`, commit both the source and the assembled `.prg` under `src/mcp/vice/fixtures/ghidra/`, and record the exact command/sha256/date in that directory's `README.md` (the established convention, three fixtures deep already).

**A correction the planner must inherit.** The `.prg` route does **not** strip the file's own two-byte load-address header — `BinaryLoader` loads the whole 60-byte file as raw content, so every address on that route is shifted **two bytes later** than the source's own labels (entry point `$0812`, not `$0810`) `[VERIFIED: src/mcp/vice/fixtures/ghidra/README.md, "CORRECTED 2026-09-04" section]`. A new synthetic fixture's own entry-point file must account for this per-route offset the same way `bank.prg`'s README does, on whichever route(s) the new fixture is run against.

## E. Graphics derivation (AUTO-06/07)

**No existing code in this repo decodes `$DD00`/`$D018`/`$D011` for this purpose.** `stock-vicii.ts` and `stock-sprites.ts` reference these registers, but in the context of the **stock VICE MCP backend** (reading live emulator register state over the binary monitor for `vice_*` tools), not in the context of a static Ghidra-derived join over a program image `[MEASURED: grep for $DD00/$D018/$D011 across src/mcp/vice/*.ts and src/skills/*/SKILL.md — only stock-vicii.ts, stock-sprites.ts, and three skill docs match, none of them implementing a "derive graphics ranges from register writes" pipeline]`. AUTO-06's derivation logic (bit-inversion of `$DD00` bits 0-1 for the VIC bank, `$D018` nibble split for screen/charset-or-bitmap base, `$D011` bit 5 for the display mode) is genuinely new container-side arithmetic for this phase, to be written over whatever constant writes to those registers the importer has already stored as xrefs (per the join's own architecture: read the register **value** the program wrote, not "what does this instruction reference").

**AUTO-07's dxa half is fully built, not new plumbing.** `dxa-blocks.ts` already implements `emitDataBlocks(rows, outputPath)` (writes a `-B`-format file, one `xxxx-yyyy` range per line, sorted, overlap-refused) and `emitLabels(rows, outputPath)` (a `-l` xa65 labels file) `[VERIFIED: src/mcp/vice/dxa-blocks.ts:196-230]`, both driven off the store's own frozen `DATA_TYPES` minus `code`/`undefined` (`"DATA_BEARING_TYPES is DATA_TYPES ... filtered to exclude exactly \"code\" ... and \"undefined\""` `[VERIFIED: src/mcp/vice/dxa-blocks.ts header]`). `dxa-run.ts`'s `dxa.disassemble` already accepts a `knownDataRows` field that is "mutually exclusive with `datablocksPath`/`labelsPath`" and internally calls these two emitters `[VERIFIED: src/mcp/vice/dxa-run.ts:58-66,224-265]`. **Phase 37's AUTO-07 dxa half is therefore: write graphics-range rows into the store via `setDataType()`, then pass them (or the store's `listRanges()` output) as `knownDataRows` on the next `dxa.disassemble` call — no new emitter or wire field needed.** Because the frozen `DATA_TYPES` vocabulary has no graphics-specific member, these rows will type as `byte` (the closest existing member) unless the planner elects to widen the vocabulary — a schema decision, not a plumbing gap.

**AUTO-07's Ghidra half ("as data") has no existing mechanism.** `ghidra.analyze`'s seven fields (`importRoute`, `loaderBaseAddr`, `noanalysis`, `scriptPath`, `entrypointsPath`, `exportPath`, `expectedClassificationLines`) cover script wiring and entry-point seeding; none marks a range as **data** before analysis runs `[VERIFIED: 36-02-SUMMARY.md's own field list, cross-checked against host-tool.mts's ghidra.analyze allowlist]`. `VolatileCarve.java`'s `readEntryPoints()` is the closest structural analogue (reads a file of addresses, calls `createFunction()` per address) — an equivalent `readDataRanges()` that calls Ghidra's `Listing.createData()` (or clears+retypes a range as undefined data, blocking code discovery there) over a similarly-formatted range file is the natural extension, following the exact same "additive pre-script capability" pattern plan 36-05 already used for `## DECOMPILED_TEXT`. This is new work, not a research-time finding of something already built.

**Phantom-label naming convention — could not confirm from a real run log.** ROADMAP.md cites `zpp_02`, `zpa_06`, `f_1B1A` as example phantom labels a charset-decoded-as-code run mints. A grep of `.planning/phases/36-*/evidence/` and the Phase 36 summaries for these exact tokens found no match this session — they do not appear in any committed Phase 36 evidence file `[MEASURED: grep -rn "zpp_02\|zpa_06\|f_1B1A" .planning/phases/36-*/ — 0 matches]`. This naming convention (Ghidra's own default label-naming scheme for undocumented functions/data at addresses inside undisassembled regions) should be verified against a REAL run over a charset-shaped fixture before AUTO-07's phantom-label before/after criterion is planned — see Open Questions.

## F. The transfer file (IMP-02)

**No existing "transfer file, consumed and deleted in the same command" convention was found in this repository.** Searched for `sha256`-based host/container handoffs, `unlinkSync`/deletion patterns tied to a digest check, and any existing "transient evidence" artifact: the closest precedents are (1) `HostToolFileResult`'s `{path, sha256, byteLength}` digest shape (`host-tool.mts:1361-1372`, quoted in §A), which is the right shape for the digest half but is never itself deleted by any existing caller, and (2) Phase 33's own "transient allow-list" capture-pair mechanism (`33-transient-derivation.md`), which is about VICE capture equivalence, not a file format, and shares no code with this phase. **IMP-02 is genuinely a new pattern this phase must invent** — a minimal, defensible shape is: the importer reads the export file at its already-translated path, computes/reads its own sha256 (or trusts the seam's own `digestOutputFile()` sha256 passed alongside it), parses it, writes the store rows, and calls `unlinkSync()` on the export file **only after** every store write in that batch has committed — all inside the same `runAnnoTool()` call (per §B's D-06 constraint: one open/close per call).

## G. Test and verify substrate

**Command:** `npm run test:automated` (== `node test-gate.mjs`), run from `src/mcp/vice/`, with the VICE broker confirmed stopped beforehand (`ps aux | grep vice-broker` returned nothing this session).

**MEASURED floor, this session:** 3409 tests, 3396 pass, **2 fail**, both in `anno-register.test.ts` (`"DIRECTION 5 (basis integrity)"` and `"planted violation (the negative control)"`), both failing on the SAME six pre-existing `anno_*` tool names citing requirement IDs (`STORE-01`, `STORE-06`, `STORE-04`, `MCP-04`) that are "well-shaped but... NOT declared in `.planning/REQUIREMENTS.md`" `[MEASURED: npm run test:automated, src/mcp/vice/, this session — exact output: "tests 3409", "pass 3396", "fail 2"]`. This matches the floor recorded across every Phase 36 plan summary exactly (2-in-1, unchanged since plan 36-01) — Phase 37 should expect this SAME floor at its own opening baseline reading, not zero.

**Evidence-file convention (measured, phases 33-36):** `.planning/phases/NN-*/evidence/NN-PP-topic.md` (phase-plan-topic, e.g. `36-05-volatile-disappearance.md`) for plan-scoped transcripts, or `.planning/phases/NN-*/evidence/NN-topic.md` (phase-topic, no plan number) for phase-wide artifacts (e.g. `35-baseline.md`, `36-06-opcode-decode.md`). Phase 37's six required red transcripts (Pitfall 23) should land as `37-0N-<topic>.md` under a new `.planning/phases/37-the-importer-and-the-automatic-annotation-join/evidence/` directory, following the plan-scoped form since each is tied to a specific task.

## Standard Stack

No new external packages are required by this phase — every capability identified above (`putXref`, `setDataType`, `dxa-blocks.ts`'s emitters, `ghidra.analyze`'s existing wire fields) is already-shipped, in-repo TypeScript/Java. `## Package Legitimacy Audit` is therefore N/A for this phase; skip the gate.

## Architecture Patterns

### System Architecture Diagram

```
   HOST                                    │  CONTAINER
   ────                                    │  ─────────
   analyzeHeadless (Ghidra JVM)            │
     ├─ VolatileCarve.java (preScript)     │
     │    splits mem, marks $00-$01/$D000  │
     │    -$DFFF volatile, seeds entries   │
     ├─ [MISSING] a data-range preScript   │
     │    (AUTO-07's Ghidra-side "as data")│
     └─ GhidraStructExport.java (postScript)│
          writes ONE flat text export file │
          (## CLASSIFICATION / REFERENCES  │
           / STRUCTURAL_FACTS / ...        │
           / DECOMPILED_TEXT)              │
              │                            │
              │  outputs[1], digested       │
              │  {path, sha256, byteLength} │
              ▼                            ▼
   host-tool.mts (runHostTool)  ──────►  host-tool-client.ts
                                          (containerPath() translation)
                                                  │
                                                  ▼
                                    [NEW] container-side importer
                                    (an anno_* tool, IMP-01)
                                      - reads export file AS GIVEN
                                      - parses ## REFERENCES, etc.
                                      - calls putXref()/setDataType()
                                      - deletes the export file (IMP-02)
                                                  │
                                                  ▼
                                    anno-store.ts (the ONE node:sqlite module)
                                      anno_xref / anno_range tables
                                      (bank column, currently always null)
                                                  │
                                                  ▼
                                    [NEW] the join (AUTO-01..08)
                                      - reads listXrefs()/listRanges()
                                      - reads memmap.json (static file)
                                      - narrowest-range-wins + sym tie-break
                                      - in-image skip
                                      - bank-state decode ($01 bits 0-2)
                                      - graphics-range derivation
                                      - writes setDataType() rows back,
                                        with memmapSha256 provenance
                                                  │
                                                  ▼
                                    [existing] dxa-blocks.ts emitters
                                      (feeds graphics ranges back to dxa
                                       as knownDataRows -- already built)
```

### Recommended Project Structure
```
src/mcp/vice/
├── anno-import.ts          # NEW: parses GhidraStructExport.java's export
│                            #      format, calls putXref()/setDataType()
├── anno-import.test.ts     # NEW: hermetic parser tests over fixture exports
├── anno-join.ts            # NEW: the mechanical AUTO-01..08 join logic
├── anno-join.test.ts       # NEW: unit tests for the three selection rules
├── memmap-lookup.ts         # NEW (or folded into anno-join.ts): narrowest-
│                            #      range-wins + sym tie-break over memmap.json
├── vendor/ghidra-scripts/
│   └── GhidraStructExport.java  # MODIFIED additively: a new p-code-level
│                                 #   section carrying (address, constant)
│                                 #   pairs for AUTO-04/AUTO-05
├── fixtures/ghidra/
│   ├── bank-path-dependent.a    # NEW: the synthetic two-caller fixture (§D)
│   └── bank-path-dependent.prg
└── anno-tools.ts            # MODIFIED: 1-3 new entries in ANNO_TOOL_DEFINITIONS
```

### Pattern 1: Additive Ghidra export extension
**What:** Add a new trailing `## `-section to `GhidraStructExport.java` rather than modifying an existing section's shape.
**When to use:** Any time the join needs a fact the current export doesn't carry (this phase's own AUTO-04/AUTO-05 data-source gap, §A).
**Example:**
```java
// Source: src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java, plan 36-05's own
// precedent -- the "## DECOMPILED_TEXT" section was added exactly this way, additively,
// verified not to disturb any existing consumer by re-running 36-04's GATE 1/2/3 live
// tests at every commit boundary.
```

### Pattern 2: One-shot store session per tool call (D-06)
**What:** Open the store, do all the work, close it — never hold it open across calls.
**When to use:** The importer's own `anno_*` tool call must parse the ENTIRE transfer file and issue every `putXref()`/`setDataType()` call inside one `runAnnoTool()` invocation.
**Example:**
```typescript
// Source: src/mcp/vice/anno-tools.ts (D-06 comment)
// "This module holds NO module-level store handle and no ambient 'current store' --
//  every verb takes `store` as an argument, `runAnnoTool()` opens it, and the
//  `finally` below closes it on every path including the throwing one."
```

### Anti-Patterns to Avoid
- **A new `anno_*`-adjacent tool family:** registering a second loop beside the existing `ANNO_TOOL_DEFINITIONS` one collides with `BACKEND_SEAM_BYPASS_KEYS`'s pinned 2-entry array (§B). Extend the existing array instead.
- **Parsing decompiled C text as the bank-literal source of truth without an address:** `## DECOMPILED_TEXT` has no per-statement address (§A) — treating source-order proximity as address-order is a silent correctness bug waiting to reproduce the exact "confident wrong comment" failure mode this phase exists to prevent.
- **A hand-rolled sqlite open inside a new module:** `anno-seam.test.ts` will catch it, but the cost of discovering that late is a wasted plan — call `anno-store.ts`'s exported functions only.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Storing typed cross-references | A new table/column shape | `putXref()`/`listXrefs()`, `anno_xref`, `XREF_ACCESS_KINDS` | Already matches `GHID-05`'s exact vocabulary; reinventing risks a second, slightly different xref shape |
| Storing machine-address annotations | A new range table | `setDataType()`/`listRanges()`, `anno_range` | Already handles contradicted-comment detection and split-table reinterpretation |
| Feeding data-range hints back to dxa | A second `-B`/`-l` writer | `dxa-blocks.ts`'s `emitDataBlocks()`/`emitLabels()` | Already handles sorting, overlap refusal, zero-row omission, deterministic output |
| Digesting a produced file | A hand-rolled sha256/stat pair | `digestOutputFile()`'s pattern (`host-tool.mts:1361`) | Already solved the "same bytes for size and hash" correctness requirement (WR-03) |

**Key insight:** almost every piece of storage/plumbing infrastructure this phase needs already exists, unused, waiting for a caller. The actual novel work is narrow: the parser for the Ghidra export's text format, the three selection rules over `memmap.json`, the bank-state arithmetic, and — the one real gap — a new export section carrying addressed bank-literal facts.

## Runtime State Inventory

Not applicable — this is a greenfield feature phase (a new importer and join), not a rename/refactor/migration phase. No existing runtime state is being renamed or relocated.

## Common Pitfalls

### Pitfall 1: Treating `## DECOMPILED_TEXT` as an addressed data source
**What goes wrong:** A join reads the decompiled C text, sees `DAT_0001 = 0x34;` followed later by `DAT_d020 = 0xaa;` in source order, and assumes the second statement executes under the first's bank state.
**Why it happens:** Decompiled C output is naturally read top-to-bottom, and for straight-line code the source order usually IS the execution order — until decompiler restructuring (loop rotation, if-conversion) reorders statements relative to their real addresses.
**How to avoid:** Add a real address-carrying export section (a p-code STORE-operation walk, mirroring how `COMPUTED_JUMP_RESOLVED`/`SELF_MODIFYING_WRITE` are already derived from the reference list) before building AUTO-04/AUTO-05 on top of decompiled text.
**Warning signs:** Any AUTO-04 test that only checks "the flip is present somewhere in the function" rather than "the flip is present preceding THIS specific address".

### Pitfall 2: Assuming `memmap.json`'s bank-conditionality is machine-checkable
**What goes wrong:** A join tries to derive "is this range bank-conditional" purely from `memmap.json`'s own fields and finds nothing, then either skips the rule entirely or over-applies it to every I/O-area entry.
**Why it happens:** The schema has no structured bank-condition field (§C) — the information exists only as free text inside `desc`.
**How to avoid:** Hand-maintain the short list of bank-conditional ranges (the `$A000-$BFFF`/`$D000-$DFFF`/`$E000-$FFFF` triad) as an explicit constant, cross-checked against `memmap.json`'s own entries rather than parsed from them.
**Warning signs:** A "bank-conditional" detector whose only signal is a regex over `desc` text — fragile against future memmap.json content changes.

### Pitfall 3: Registering the importer tool outside `ANNO_TOOL_DEFINITIONS`
**What goes wrong:** A new tool family registered as its own loop passes locally but reddens `stock-dispatch.test.ts`'s pinned 2-entry `BACKEND_SEAM_BYPASS_KEYS` array.
**Why it happens:** The temptation to give the importer "its own space" rather than extending an existing 400+-line file.
**How to avoid:** Add entries to `ANNO_TOOL_DEFINITIONS` (`anno-tools.ts:438`) directly; the registration loop and its single bypass key are unaffected by array length.
**Warning signs:** A new `vice-proxy.ts` registration loop, or a second `for (const ... of ...)` block resembling the existing anno one.

## Code Examples

### Writing a typed cross-reference (the shape the importer will call)
```typescript
// Source: src/mcp/vice/anno-store.ts:3440-3466 (putXref, read this session)
putXref(handle, {
  fromAddress: 0x0812,
  toAddress: 0x0001,
  accessKind: "WRITE",   // one of XREF_ACCESS_KINDS: READ | WRITE | READ_WRITE | COMPUTED_JUMP
});
```

### Typing a machine-address range (the join's own write-back)
```typescript
// Source: src/mcp/vice/anno-store.ts:2322-2352 (setDataType, read this session)
setDataType(handle, {
  start: 0xd020,
  endInclusive: 0xd020,
  dataType: "byte",   // no graphics-specific member exists in the frozen twelve
});
```

### Feeding derived graphics ranges back to dxa (already-built mechanism)
```typescript
// Source: src/mcp/vice/dxa-blocks.ts:196-230 (emitDataBlocks/emitLabels, read this session)
// dxa-run.ts's dxa.disassemble already accepts a knownDataRows field that
// internally calls these two emitters -- Phase 37 supplies the rows, not
// a new emitter.
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|---------------|--------|
| An external analyser session, agent-in-the-loop annotation | A container-side, mechanical join over `.annostore` | v0.7.0 (Phase 27-32) then this phase (v0.8.0) | AUTO-01's whole point: no agent call, no queue walk, no skill invocation |
| `ExportAnalysis23.java` (Phase 23 throwaway, image-size-based classification) | `GhidraStructExport.java` (Phase 36, self-computed block-total assertion, `DecompInterface`-based structural facts) | Phase 36 plan 36-03 | Fixes a silent wrong-denominator bug; adds the accounting identity this phase's importer can trust |

**Deprecated/outdated:** The pivot's own `ExportAnalysis23.java` (image-size classification defect) — superseded, not reachable from any current wire path.

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Graphics-range rows should type as `byte` in the absence of a graphics-specific `DataType` member | §E, Don't Hand-Roll | If the planner instead widens `DATA_TYPES`, every consumer of the frozen-twelve invariant (dxa-blocks.ts's `DATA_BEARING_TYPES` derivation, any exhaustive-switch code) needs re-auditing — a schema migration, not a one-line change |
| A2 | The phantom-label naming convention (`zpp_02`, `zpa_06`, `f_1B1A`) still applies with the current Ghidra/language setup | §E | Not confirmed against a real run this session (0 matches in committed evidence) — AUTO-07's before/after criterion needs a fresh real capture to confirm the actual naming Ghidra 12.1.3 + the `nmos` language mints today |
| A3 | A new p-code-level export section is the right fix for AUTO-04's missing addressed bank-literal data, rather than some other mechanism | §A, Common Pitfalls #1 | If a different approach is chosen (e.g., driving the decompiler's tokenized/address-mapped C output instead of plain text), the "additive section" pattern and its own hermetic tests would need re-scoping |

## Open Questions

1. **How does the importer/join obtain `(address, $01-literal)` pairs at all?**
   - What we know: `## DECOMPILED_TEXT` carries the literal values (`DAT_0001 = 0x37;`) but with no address; `## REFERENCES` carries addresses but no constant values (just `<from> -> <to> <ReferenceType>`); `VolatileCarve.java` never records a value.
   - What's unclear: whether extending `GhidraStructExport.java` with a new p-code STORE-operation-walk section (address + constant operand, when the STORE's source is a constant) is sufficient, or whether some writes to `$01` are computed (not immediate) and therefore correctly produce no exportable literal — which is exactly AUTO-05's "declines with a reason" case.
   - Recommendation: plan an early task that extends `GhidraStructExport.java` additively (following plan 36-05's own precedent) with a section like `## BANK_WRITES` — `<address> <constant-value>` per resolved immediate STORE to `$0001`, and nothing when the store's source operand is not a compile-time constant. This directly produces AUTO-04's flip data and AUTO-05's decline data from the same mechanism.

2. **What is the exact mapping from Ghidra's `Reference.getReferenceType()` values to the store's four-member `XrefAccessKind`?**
   - What we know: `GHID-05` deliberately narrowed the exported vocabulary to `READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`, but `## REFERENCES`'s loop is uncapped and will emit every `RefType`/`FlowType` Ghidra produces, including `UNCONDITIONAL_JUMP`, `CONDITIONAL_JUMP`, `UNCONDITIONAL_CALL`, `COMPUTED_CALL`, `DATA`, etc.
   - What's unclear: whether the importer should drop every reference type outside the four (keeping only memory-access and computed-jump facts, which is what the join actually needs), or refuse loudly on an unrecognized type.
   - Recommendation: drop silently-but-countably (report a "kinds seen but not imported" count alongside AUTO-01's annotated/skipped counts) rather than refuse — a real corpus binary will have ordinary `JSR`/`JMP` references constantly, and refusing on them would make the importer unusable.

3. **What does `memmapSha256` provenance (AUTO-08) attach to, mechanically?**
   - What we know: no existing per-row provenance column exists in `anno_xref`/`anno_range` today; the store's own revision/snapshot mechanism (`currentRevision()`, `snapshotPathFor()`) tracks store-wide state, not per-row source metadata.
   - What's unclear: whether this is a new column (a schema migration on `anno_range`/`anno_xref`), or a side-table, or a comment (`setComment()` already exists and is per-address).
   - Recommendation: measure whether `setComment()`'s existing per-address comment mechanism is an acceptable carrier for `memmapSha256` before proposing a schema migration — reusing an existing write path is cheaper and lower-risk than adding a column to two tables that `putXref()`/`setDataType()` would both need updating for.

4. **Is the phantom-label naming convention (`zpp_02`, `zpa_06`, `f_1B1A`) still accurate?**
   - What we know: these names appear in ROADMAP.md's prose but not in any committed Phase 36 evidence transcript (0 matches, measured this session).
   - What's unclear: whether this is Ghidra's genuine default naming scheme under the `6502:LE:16:nmos` language, or a name from an earlier exploration under different settings.
   - Recommendation: capture one real run over a charset-shaped region as an early AUTO-07 task and record the ACTUAL minted names, rather than assuming ROADMAP's cited examples will reproduce.

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Ghidra installation (`GHIDRA_HOME`) | Every live AUTO-06/07 measurement, and any GhidraStructExport.java extension's `javac` type-check | Not probed this session (host-side, outside repo) | 12.1.3 per Phase 36 evidence | Phase 36's own precedent: structural work proceeds via hermetic/unit tests, live suites are `MANUAL_ONLY_TESTS`, opt-in via `VICE_LIVE_GHIDRA` |
| ACME cross-assembler | Building the new synthetic path-dependent `$01` fixture | Confirmed present per Phase 36 evidence (0.97 "Zem") — not re-probed this session | 0.97 | — |
| dxa binary (vendored, built) | AUTO-07's dxa feedback half | Built by Phase 35; not re-probed this session | 0.1.5 (pinned) | — |

**Missing dependencies with no fallback:** None identified — this phase's core logic (parsing, the join, the store writes) needs no external tool at plan time; only the live proof-of-work tasks (AUTO-04/05/06/07's live observations) need a real Ghidra installation, and Phase 36 already established the `MANUAL_ONLY_TESTS`/opt-in-env-var pattern for exactly this situation.

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Node's built-in test runner (`node --test`), no separate framework |
| Config file | none — `package.json`'s `scripts.test`/`scripts["test:automated"]` |
| Quick run command | `node --test <specific-file>.test.ts` (e.g. `node --test anno-import.test.ts anno-join.test.ts`) |
| Full suite command | `npm run test:automated` (== `node test-gate.mjs`), from `src/mcp/vice/`, VICE broker stopped first |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| IMP-01 | Importer reads transfer file, writes via `putXref`/`setDataType`, respects single seam | unit + hermetic | `node --test anno-import.test.ts` | ❌ Wave 0 |
| IMP-02 | Transfer file digested, consumed and deleted in one command | unit | `node --test anno-import.test.ts` (a case asserting `existsSync(transferPath) === false` after import) | ❌ Wave 0 |
| AUTO-01 | Mechanical join, no agent, counts reported, read-back from store | integration | `node --test anno-join.test.ts` (asserts `listXrefs()`/`listRanges()` reflect the join's writes, not stdout) | ❌ Wave 0 |
| AUTO-02 | Narrowest-range-wins + sym tie-break, both observed red | unit + planted-violation | `node --test anno-join.test.ts` ($D020 case + tie-break case, each with a red-then-fixed pair) | ❌ Wave 0 |
| AUTO-03 | In-image skip, observed red | unit + planted-violation | `node --test anno-join.test.ts` | ❌ Wave 0 |
| AUTO-04 | Bank-before-address, `$34`/`$33` flip, observed red | integration (needs the new synthetic fixture + possibly a live Ghidra capture) | `node --test anno-join.test.ts` (hermetic half) + a `MANUAL_ONLY_TESTS`-gated live case | ❌ Wave 0 (fixture AND export-format extension both new) |
| AUTO-05 | Path-dependent decline, observed red | unit + planted-violation | `node --test anno-join.test.ts` | ❌ Wave 0 |
| AUTO-06 | Graphics ranges from VIC pointers, not xrefs | unit | `node --test anno-join.test.ts` (or a new `graphics-derive.test.ts`) | ❌ Wave 0 |
| AUTO-07 | dxa/Ghidra feedback, phantom labels present-then-absent | manual_procedural (live) | `MANUAL_ONLY_TESTS`-gated, `VICE_LIVE_GHIDRA=1` | ❌ Wave 0 (needs a new Ghidra data-marking pre-script) |
| AUTO-08 | `memmapSha256` provenance on every derived row | unit | `node --test anno-join.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** the specific new test file(s) touched that task (`node --test anno-import.test.ts` / `anno-join.test.ts`)
- **Per wave merge:** `npm run test:automated` (floor: 3409 tests, 3396 pass, 2 fail in `anno-register.test.ts` — unrelated pre-existing failures, confirmed this session; a new failure anywhere else is a regression)
- **Phase gate:** full suite at the measured floor (2 failing, same file) before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/mcp/vice/anno-import.ts` + `anno-import.test.ts` — the transfer-file parser and importer tool, covers IMP-01/IMP-02
- [ ] `src/mcp/vice/anno-join.ts` + `anno-join.test.ts` — the three selection rules, the bank decode, the graphics derivation, covers AUTO-01..06,08
- [ ] `src/mcp/vice/fixtures/ghidra/bank-path-dependent.a`/`.prg` — the synthetic two-caller fixture, an EARLY task per criterion 4's own ordering requirement (§D)
- [ ] A new additive `GhidraStructExport.java` section carrying addressed `$01`-literal facts — a hard prerequisite for AUTO-04/AUTO-05's hermetic tests to have real data to assert against (Open Question 1)
- [ ] A new Ghidra pre-script capability ("mark range as data") for AUTO-07's Ghidra-side feedback half (§E) — no framework install needed, this is new script logic, not a new test framework

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | no | N/A — no auth surface in this phase |
| V3 Session Management | no | N/A |
| V4 Access Control | no | N/A — single-user local tool |
| V5 Input Validation | yes | The transfer-file parser must treat the Ghidra export as untrusted text (it is host-produced, but a corrupted or truncated file must not crash the importer) — mirrors `anno-tools.ts`'s existing per-verb argument validators |
| V6 Cryptography | yes (narrow) | sha256 digesting only (already-established `createHash("sha256")` pattern in `host-tool.mts`), never a security boundary — used for corruption/drift detection only |

### Known Threat Patterns for this stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| A transfer file path escaping the workspace root | Tampering | Reuse `resolveWorkspacePath()`'s existing confinement, the same pattern every other path-bearing `ghidra.analyze`/`dxa.disassemble` field already uses |
| A malformed/truncated export file silently producing partial annotations | Tampering / Repudiation | The importer must refuse loudly (not partially import) on a parse failure — mirrors `GhidraStructExport.java`'s own "refusing a short export" discipline (the classification-count assertion) |
| Deleting the transfer file before its contents are durably committed to the store | Repudiation | IMP-02's deletion must happen strictly after `applyWrite()`'s own commit returns successfully — never delete-then-write |

## Sources

### Primary (HIGH confidence — read/measured this session)
- `src/mcp/vice/vendor/ghidra-scripts/GhidraStructExport.java` — full source read
- `src/mcp/vice/vendor/ghidra-scripts/VolatileCarve.java` — full source read
- `src/mcp/vice/ghidra-run.ts` — full source read
- `src/mcp/vice/anno-store.ts` — seam header, `putXref`/`listXrefs`/`setDataType`/`listRanges`/`applyWrite` read
- `src/mcp/vice/anno-types.ts` — `DATA_TYPES`, `XREF_ACCESS_KINDS`, `RangeRow`, `XrefRow` read
- `src/mcp/vice/anno-tools.ts`, `vice-proxy.ts` (registration loop), `stock-dispatch.test.ts` (`BACKEND_SEAM_BYPASS_KEYS`) — read
- `src/mcp/vice/dxa-blocks.ts`, `dxa-run.ts` — read
- `src/skills/c64-memory-mapping/memmap.json` — loaded and measured (959 entries, overlap/tie-break counts)
- `src/mcp/vice/fixtures/ghidra/bank.a`, `fixtures/ghidra/README.md` — read
- `.planning/phases/36-*/36-0*-SUMMARY.md` (all seven plans), `.planning/phases/36-*/evidence/36-05-volatile-disappearance.md` — read
- `.planning/REQUIREMENTS.md` (IMP-01/02, AUTO-01..08, GHID-04/05), `.planning/ROADMAP.md` (Phase 37 section, Sequencing Rationale), `.planning/STATE.md`, `.planning/research/PITFALLS.md` (Pitfall 23) — read
- `npm run test:automated` — run this session, 3409/3396/2 confirmed

### Secondary (MEDIUM confidence)
- None — this was a pure codebase pass per the scope fence; no web sources consulted.

### Tertiary (LOW confidence)
- ROADMAP's cited phantom-label examples (`zpp_02`, `zpa_06`, `f_1B1A`) — not independently confirmed this session (0 matches in committed evidence); flagged in Open Questions.

## Recommended Plan Decomposition

Hard ordering constraints established by this research (not preferences):
1. **The synthetic path-dependent `$01` fixture (§D) must exist before any AUTO-04/AUTO-05 work is verified** — `bank.a` is confirmed unusable for this criterion (§D), so a plan that tries to prove the flip/decline against the existing fixture will silently produce a vacuous control.
2. **A new addressed bank-literal Ghidra export section (Open Question 1) must exist before AUTO-04/AUTO-05's hermetic tests can assert anything real** — this is upstream of the fixture becoming useful, since the fixture alone does not create the missing data path.
3. **The importer (IMP-01/IMP-02) must exist and be proven working before the join (AUTO-01..08) is planned** — AUTO-01's own criterion reads annotations back OUT OF THE STORE, which requires rows to already be there; ROADMAP.md states this explicitly.
4. **AUTO-06 (graphics derivation) does not depend on AUTO-04/AUTO-05** — it reads different registers via a different mechanism (VIC pointers, not bank state) and can be planned as an independent branch once the importer exists.
5. **AUTO-07's dxa half (§E) has no upstream blocker** (the mechanism is already built) but its Ghidra half (marking ranges as data) is new work with no existing precedent, and its phantom-label proof needs a real capture before the criterion can be written concretely (Open Question 4).

Suggested grouping into plans:

- **Plan A — The importer (IMP-01, IMP-02).** Transfer-file format decision (§F), the parser, `ANNO_TOOL_DEFINITIONS` extension (1-3 entries, §B), digest-and-delete discipline, all six named guards kept green (§B table). No dependency on any Ghidra export changes — can start immediately against the EXISTING export format (`## REFERENCES` alone is enough to prove the importer's own mechanics).
- **Plan B — The bank-state data source (blocks AUTO-04/AUTO-05).** Extend `GhidraStructExport.java` additively with an addressed bank-literal section (Open Question 1); build and commit the synthetic two-caller fixture (§D) as an early task inside this same plan, per criterion 4's own explicit ordering requirement. This plan has no dependency on Plan A and can run in parallel with it.
- **Plan C — The join's three selection rules + AUTO-08 (AUTO-01, AUTO-02, AUTO-03, AUTO-08).** Depends on Plan A (needs real imported rows to join against) but NOT on Plan B. Narrowest-range-wins, the sym tie-break, the in-image skip, and `memmapSha256` provenance — all measurable against `memmap.json` and the existing export format alone (§C).
- **Plan D — Bank-before-address (AUTO-04, AUTO-05).** Depends on Plan A AND Plan B. The highest-risk plan in the phase — both of this milestone's "unvalidated, not narrowed" requirements live here, and it is where 3 of the phase's 6 required red transcripts (bank flip, bank decode bypass, path-dependent decline) land.
- **Plan E — Graphics derivation and feedback (AUTO-06, AUTO-07).** Depends on Plan A (needs imported register-write xrefs) but not on Plan B/D. Register-derivation arithmetic (AUTO-06), the dxa feedback (already-built mechanism, §E), and the new Ghidra "mark as data" pre-script capability plus the phantom-label before/after live proof (AUTO-07) — the other 2 of the phase's 6 required red-transcript observations (in-image skip is Plan C's; graphics feedback here) plus AUTO-07's own present/absent proof.

This groups the phase's ten requirements into five plans across two effective waves: **Wave 1** = Plan A + Plan B (parallel, no shared files); **Wave 2** = Plan C + Plan D + Plan E (each depends only on Wave 1's outputs, not on each other) — matching the "importer before the join" and "fixture/export-extension before bank work" constraints exactly while maximizing parallelism.

## Metadata

**Confidence breakdown:**
- Store seam / extension mechanics (§B): HIGH — every claim read directly from source with quoted text, cross-checked against the exact line numbers CLAUDE.md itself cites (no drift found)
- Ghidra export format (§A, §D, §E): HIGH for what exists, MEDIUM for the design gap's resolution (the p-code-export recommendation is this research's own proposal, not something already built)
- memmap.json schema/measurements (§C): HIGH — loaded and queried directly this session
- Graphics derivation / phantom labels (§E): MEDIUM-LOW — no existing implementation found to verify against; the phantom-label naming convention is unconfirmed against a real run

**Research date:** 2026-09-05
**Valid until:** This research is tied to specific measured line numbers and file states (Phase 36 as shipped, `memmap.json` as it exists today). Treat as valid until the next commit touching `anno-store.ts`, `anno-tools.ts`, `GhidraStructExport.java`, or `memmap.json` — re-verify line-number citations per Pitfall 24's own discipline before relying on them in a plan.
