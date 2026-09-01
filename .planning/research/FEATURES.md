# Feature Research

**Domain:** Annotation stores for binary reverse engineering, consumed by an LLM agent over MCP rather than a human GUI (6502/C64, 64K flat address space)
**Researched:** 2026-08-26
**Confidence:** MEDIUM overall — **HIGH** for everything traced to this repository's own source, manifests and skills (read directly this session); **MEDIUM** for the comparable-tool survey (each claim cross-checked across ≥2 independent sources per the confidence seam); **LOW** for any single-page claim, marked inline.

## What this answers, and the test it applies

v0.7.0 replaces the external analyser's `state/` with an annotation store this project owns. The consumers **already exist and are specified**: five absorbed analysis procedures live in this repo's skills, written against `anno_*` calls, and `.planning/phases/19-.../upstream-procedure-manifest.json` classifies every verb each one calls. That manifest is the derived specification.

Every feature below is scored against this project's standing measured test:

> **Does a shipped skill call this, or does something a skill calls depend on it?**

Applied mechanically, not by judgment. The measurements:

**Store verbs called directly by shipped skills** (`grep -rho 'anno_[a-z_]*' src/skills/`):

| Skill | Store verbs it calls |
|---|---|
| `c64-memory-mapping` | 13 — `apply_enum_usage`, `batch_execute`, `create_project_enum`, `disassemble`, `get_address_details`, `get_binary_info`, `get_blocks`, `get_cross_references`, `read_region`, `save_project`, `set_comment`, `set_data_type`, `set_label_name` |
| `c64-program-recon` | 15 — the above minus `disassemble`/`get_address_details`, plus `add_scope`, `get_comments`, `get_symbols`, `search_disassembly` |
| `routine-queue-walker` | 8 — `get_binary_info`, `get_comments`, `get_cross_references`, `get_symbols`, `read_region`, `save_project`, `set_comment`, `set_label_name` |
| `acme-build`, `c64-provenance-diff`, `c64-ram-capture`, `vice-wedge-triage` | **none** — these four are store-independent |

**Store verbs reached indirectly**, via the 8 CLI verbs the skills document (`bootstrap`, `export-asm`, `verify`, `gen-enums`, `export-lbl`, `import-lbl`, `render-memmap`, `coverage`). Measured at the only non-test `runAnnoTool(...)` call sites in the tree:

| CLI verb | Store verbs it depends on | Source |
|---|---|---|
| `gen-enums` | `search_disassembly` ×2, `create_project_enum`, **`update_project_enum`**, `apply_enum_usage` | `anno-enum-gen.ts:304,318,419,431,446` |
| `import-lbl` | `set_label_name` | `anno-symbols.ts:378` |
| `coverage` | `get_blocks` (divergence sub-report **only**), `get_symbols` (label ratio), `get_comments` (comment vacuity) | `anno-coverage.ts:186-187` |
| `export-asm` / `verify` | the whole model — labels, comments, blocks, scopes, enums — rendered to ACME | `anno-cli.ts`, `anno-verify.ts` |
| `export-lbl` | labels, **user kind only** (measured: auto `a_`/`e_` externals are not exported) | `anno-symbols.ts:16-23` |
| `bootstrap` | store creation / open | `anno-project.ts` |
| `render-memmap` | **none** — reads `memmap.json`, never the store | `anno-memmap-render.ts` (no `runAnnoTool` call site) |

**Result of applying the test to the current 19-verb curated surface:** 18 verbs have a named consumer. **One does not: `anno_delete_project_enum`** — no shipped skill calls it, and no skill-called module calls it (`gen-enums` uses create-then-update, never delete). It is surplus and should not be rebuilt.

## How comparable tools model this

**MEDIUM confidence** — cross-checked per tool.

| Concern | Ghidra | IDA Pro | rizin/radare2 | Binary Ninja | SourceGen (6502) | the earlier analyser / the external analyser (C64) |
|---|---|---|---|---|---|---|
| Labels | Symbols + namespaces | Names, local labels | Flags (`f`, `fr`, `f-`) | Symbols | user / auto, tagged non-unique-local / unique-local / global / exported | user labels; auto `a_`/`e_`/`s_` prefixes |
| Comment kinds | **5** — EOL, PRE, POST, PLATE, REPEATABLE | **5** — regular, repeatable, function, anterior, posterior | **1** (`CC`) | **1** + a separate *tags* axis | **3** — end-of-line, long comment (emitted), note (**never** emitted) | **2** — line, side |
| Range typing | Data types over ranges via `Listing` | Per-item (code/data/array/string) | `Cd` data, `Cs` string metadata | Types | Data format descriptors incl. PETSCII and C64 screen codes | 12-variant `BlockType` |
| Xref access kind | **First class** — `RefType.READ` / `WRITE` / `READ_WRITE`, `FlowType.COMPUTED_JUMP` | code vs data, with read/write/offset subtypes | weaker | weaker | operand-target driven | **address list only, no kind** |
| Undo | transactional, multi-level | none until **7.3** (2019), then database-level + redo | **none** (edit and re-save) | `BeginUndoActions`/`Commit`, user actions only — *auto actions are not undoable* | yes | yes |
| Persistence | ProgramDB (binary) | `.idb`/`.i64` | explicit projects (`Ps`/`Po`) | `.bndb` via `FileMetadata` | **JSON + a CRC of the data file, user data only** | `.regen2000proj` |
| Banked memory | overlay blocks; **no** automatic bank-switch analysis | manual segments | manual | manual | address regions | flat |

### What is genuinely conventional

Six things every tool in the table has, in the same shape:

1. A **named label keyed by address**.
2. **Free-text comments keyed by address**.
3. A **code-vs-data range classification** the disassembler obeys.
4. **Cross-references *to* an address**.
5. **Project persistence to a file**, separate from the binary.
6. A **user-vs-auto provenance distinction on names** (Ghidra symbol source, SourceGen user/auto labels, Binary Ninja user/auto actions, `get_symbols`' `kind: user|system|auto`). This one is load-bearing here and easy to drop by accident: `routine-queue-walker`'s entire premise is a backlog of *auto-named* symbols, and `export-lbl` exports *user* labels only.

### Where they disagree, and whether it matters here

**Comment multiplicity — disagreement is real, and mostly does not matter.** Five kinds (Ghidra, IDA) down to one (rizin, Binary Ninja). The **line / side** pair is C64-native, not an external analyser invention — the original analyser advertised full-line and side comments plus user labels years earlier. Two kinds is defensible and is what every caller uses. The **one distinction worth stealing** is SourceGen's *note* vs *long comment*: a note is multi-line and **never emitted into generated source**, a long comment is. No C64 tool has it, and an ACME exporter is exactly where the difference bites — a triage note like `[unknown] looks like a decrunch stub, unverified` should not land in shipped source. Cheap: one enum value, no new storage.

**Undo — genuinely contested, and the LLM consumer breaks the tie.** See the anti-features table.

**Xref access kind — matters, and is the one place the external analyser is behind.** `anno_get_cross_references` returns bare addresses. Ghidra keeps `READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP` as a field, and v0.6.0's held `GHID-05` already states the reason: *"the annotation join consumes the kind and not only the address."* The honest measured position: **no shipped skill or skill-called module consumes an access kind today** — `anno-coverage.ts` derives dispatch idioms from bytes itself and does not read xref kinds. So the *classifier* is surplus, but the *field* is nearly free, because the decoder already knows `sta $d020` is a write at decode time and cannot recover it later without re-decoding. Recommendation: **store the kind, do not build analysis on it**, and say plainly it is speculative-but-cheap rather than caller-driven.

**Flat vs banked address space — does not matter for v0.7.0, and the reason is on the record.** Ghidra's answer is overlay memory blocks with *no automatic bank-switch analysis* (GhidraNes maps each bank to its own overlay block and documents bank handling as manual). Everyone else is flat. For the C64 the real cases are RAM under I/O at `$D000-$DFFF` and KERNAL/BASIC ROM shadowing at `$A000`/`$E000`. `PROOF-03` — the requirement that would have measured where a forward-carried `$01` value becomes wrong — is recorded **`could-not-run`** at the Phase 23 `no-go`, and `memmap.json` is a flat address model. So: **keep addresses flat and unqualified in v0.7.0, and record the assumption at the store's own seam** so a future milestone finds it instead of discovering it. Adding a bank qualifier now would be modelling for an unmeasured requirement.

## Feature Landscape

### Table Stakes (every comparable tool has it; every consumer needs it)

| Feature | Why Expected | Complexity | Notes |
|---|---|---|---|
| **Label at an address** (`set_label_name`) | Universal. Present in all 6 surveyed tools plus the original analyser | **LOW** | Consumers: 3 of 5 absorbed procedures (`blocks`, `routine`, `symbol`), all 3 store-using skills, `import-lbl`. Depends on `anno-acme-ident.ts`'s `assertLegalAcmeIdentifier` — **REJECT, never sanitize**, already the convention |
| **Label kind: user / system / auto** (`get_symbols` filter) | Conventional in 4 of 6 tools | **LOW** | Consumers: `routine-queue-walker`'s backlog *is* the `auto` set; `export-lbl` exports `user` only; `coverage`'s two label ratios. Do not collapse to one kind |
| **Comment at an address, line + side** (`set_comment` / `get_comments`) | Universal; the line/side pair is C64-native | **LOW** | Consumers: **all 5** absorbed procedures, all 3 skills. Multi-line must work on `line` (upstream's does). Carrier for the `[confirmed-code]`-style confidence prefix — see differentiators |
| **Per-range data typing, inclusive both ends** (`set_data_type`) | Universal | **MEDIUM** | Consumers: `analyze-basic`, `analyze-blocks`, `c64-memory-mapping`, `c64-program-recon`. v0.7.0 mandates the *full* `DECOMP-01` vocabulary — code, byte, word, address, PETSCII, screencode, table — not the subset this milestone exercises. Upstream's 12 variants include 4 split-table forms (`lo_hi_address`, `hi_lo_address`, `lo_hi_word`, `hi_lo_word`), `external_file` and `undefined`; the split forms have a real 6502 caller (SID frequency tables, jump tables) and an even-count validation rule |
| **Block enumeration** (`get_blocks`) | Universal — the derived range table is how any listing is rendered | **MEDIUM** | Consumers: `analyze-blocks`, `c64-program-recon`, `coverage`'s divergence sub-report. **Ranges must be stored explicitly, not merged on adjacency** — see the splitter note below |
| **Cross-references to an address** (`get_cross_references`) | Universal | **MEDIUM–HIGH** | Consumers: `analyze-blocks`, `analyze-routine`, `analyze-symbol`, all 3 skills, `get_address_details`'s composition. Requires the decode plus `address`-typed data ranges to yield pointer xrefs (which is *why* `address` typing "creates X-Refs" in the current description) |
| **Search over labels + comments + instructions** (`search_disassembly`) | Present in all 6 | **MEDIUM** | Consumers: `c64-program-recon`'s `[unknown]` query; `gen-enums` (two passes). Keep the existing hard decision: **`max_results` REQUIRED with no default** — upstream's silent default of 50 truncated a full-program pass — and return the count so truncation is detectable |
| **Persistence: open, save, survive process death** (`save_project`) | Universal | **MEDIUM** | Consumers: 4 of 5 absorbed procedures end with it. `STORE-02` requires proof by planted violation (mutate → kill → reopen; then remove the save and prove the test reddens). Keep the existing rule: **never report persisted on the strength of the store's own success text** — re-read the file's content hash |
| **Read a region as disasm *or* hexdump** (`read_region`) | Both views exist in every tool | **LOW** | Consumers: `analyze-basic`, `analyze-blocks`, `analyze-routine`, all 3 skills. Reuses the owned decoders. Keep the byte cap that **refuses by name** rather than truncating silently |
| **Binary info** (`get_binary_info`) | Conventional (origin, size, platform) | **LOW** | Consumers: **4 of 5** absorbed procedures. Fields in use: origin, size, platform, filename, description, **entropy** (the >7.5 packed gate `analyze-program` relies on after `unpack_binary` was omitted), illegal-opcode hint |
| **Batch execution** (`batch_execute`) | Conventional in the LLM-facing generation (ida-pro-mcp, ghidra-mcp) | **MEDIUM** | Consumers: `analyze-basic`, `analyze-blocks`. Preserve the **measured** upstream semantics this repo already documents: the loop does **not** abort on first failure; each entry returns `{status:success|error}` — see the LLM section |
| **Address details** (`get_address_details`) | Conventional | **LOW** | Consumer: `analyze-symbol`. Already a client-side composition of four reads (D-36), carrying `composed_client_side:true` and `composed_from`. Owning the store makes this a native read — but **keep the marker convention** for any answer that is still composed |

### Differentiators (this project's competitive advantage)

| Feature | Value Proposition | Complexity | Notes |
|---|---|---|---|
| **Project enums generated from `memmap.json`** (`create_project_enum`, `update_project_enum`, `apply_enum_usage`) | *"Neither project can do this alone."* `lda #$1b / sta $d011` renders as `lda #D011_YSCROLL3_ROW25_SCREENON_TEXT` and reassembles byte-identical under real ACME | **MEDIUM** (retarget, not rebuild) | Consumers: `analyze-routine`, `analyze-symbol`, `c64-memory-mapping`, `c64-program-recon`, the `gen-enums` verb. Depends on `memmap.json` (959 entries), `anno-regbits-gen.ts`, `anno-enum-gen.ts`. `update` is required for re-runnable generation; `delete` is not (see surplus) |
| **Confidence grade as a queryable axis** | No surveyed tool has a confidence dimension on a block type. `Code` cannot distinguish "PC observed executing" from "reachable via a JSR, never run" — the distinction the recon template exists to keep | **LOW** (already built) | Consumers: `c64-program-recon`'s memory-map template, `coverage`'s comment-vacuity measure. Lives as a bracket-token prefix inside a line comment (`anno-confidence.ts`, five grades) with **zero new storage** and a typo'd-near-miss parser. Promoting it to a first-class column is optional and has no caller — keep it as a comment convention |
| **Store ↔ live-emulator symbol round trip** (`export-lbl` / `import-lbl`) | No surveyed RE tool talks to a running emulator's symbol table. Annotate statically → resolve live addresses to those names → new live findings flow back | **LOW–MEDIUM** (adapter exists) | Consumers: `c64-memory-mapping`, `c64-program-recon`, `routine-queue-walker`. Depends on `anno-symbols.ts` + `stock-symbols.ts`'s `parseViceLabelFile()` (this repo's *only* sanctioned second consumer of that format) |
| **ACME export verified by a real ACME** | Verification by external oracle, not by internal fixture — this project's most-repeated lesson | **HIGH** | Consumers: `export-asm`, `verify`, `acme-build`. v0.7.0 requires the `=*+$01` mid-instruction label idiom for self-modifying write targets and typed label prefixes (`zpp_`/`zpa_`/`f_`/`a_`/`e_`) — both preserved deliberately rather than rediscovered. Depends on `anno-verify.ts`'s parse of ACME's own result line |
| **Derived-from-bytes coverage census the store cannot move** | Asking the store how much it has classified is provably circular. The census is a pure function of raw bytes + caller seeds; the block table is read at exactly one site and feeds a *divergence* sub-report explicitly named as a comparison | **HIGH** (already built; retarget) | Consumer: the `coverage` verb, documented by `c64-program-recon`. Retarget cost is low; the *conceptual* boundary (`anno-coverage.test.ts` rewrites every block entry to one type and asserts no census byte count moves) must survive the port intact |
| **Explicitly stored ranges, so adjacency never auto-merges** | Removes the need for a `toggle_splitter` primitive **by construction**. Upstream auto-merges two adjacent same-type tables, which is why the manifest holds `toggle_splitter` as a future-surface proposal blocking `DECOMP-01` and `BUILD-02` | **LOW if designed in; MEDIUM to retrofit** | Named future consumers: `DECOMP-01` ("every byte is code, byte, word, address, PETSCII, screencode or table" cannot distinguish two merged tables), `BUILD-02` ("data tables extracted to their own files" has no boundary to cut on). Also removes the named bias the manifest predicts for `COV-01`'s divergence report. **The single largest free win available from owning the store** |
| **`{available:false, reason}` instead of a plausible zero** | Existing project convention at three named sites (`stock-cia.ts:494`, `stock-vicii.ts:239`, `incident-record.ts:115`). Aligns with the MCP guidance to return errors *inside* the result so the model can recover | **LOW** | Consumer: every skill that reads a possibly-absent capability. Apply to the store's own gaps — an unclassified range, an absent xref set, an unopened store |
| **Emitted vs non-emitted comment kinds** (SourceGen's *note*) | A triage note must not reach shipped source; a long comment must | **LOW** | No shipped caller **today** — marked speculative. Recommended only because the exporter is being built this milestone and adding the enum value later means re-typing existing comments |

### Anti-Features (commonly requested, actively harmful here)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **Undo / redo journal** | Every GUI tool has one — Ghidra transactions, Binary Ninja `BeginUndoActions`, IDA since 7.3, the external analyser's own. And v0.7.0's Active list plus `STORE-02` both say "undo" | The manifest already disposes `anno_undo` as **`omit`**, with the reason: `set_data_type` is idempotent over a range, so *"if a conversion was wrong, undo it and redo it correctly"* collapses to *"set it correctly"*. **No absorbed procedure and no shipped skill calls undo.** An agent also has no cursor or selection for "the last action" to be relative to, and retries make "whose last action?" genuinely ambiguous. A per-edit inverse-operation journal is the single largest structural cost in the store | Satisfy the requirement with the **cheapest form that has a consumer**: a whole-store snapshot/restore save-point (the store is a JSON document — copy it), not a per-edit inverse journal. Note it honestly: the *durability* half of `STORE-02` has a hard planted-violation test; the *undo* half has no caller and should be scoped to what the test can actually prove |
| **A cursor / "current address"** | It is how every GUI works, and upstream ships `get_disassembly_cursor` | Upstream's **own procedure text** forbids it in exactly this situation: *"Always launch each subagent with an explicit target address … **NEVER** use the 'current cursor address'."* This project has no editor. The manifest disposition is `adapt-to-address-input` | Explicit address (or explicit inclusive range) on **every** call, always. Already the shape of all 19 curated verbs |
| **Rejecting no-op writes** | Reads as discipline; a real MCP server does it (`ghidra-mcp` rejects "type unchanged" with an explanation) | It **breaks idempotency**, and agents retry on timeout. A retried `set_label_name` that already succeeded would surface as an error the model has to reason about | Succeed, and return `changed: true|false`. Last-writer-wins over an explicit range |
| **The full 5-kind comment taxonomy** | Ghidra and IDA both have five; parity looks like completeness | Only `line` and `side` have callers, across all five absorbed procedures. Three more kinds is three more enum values in every prompt for zero measured benefit | Keep `line` + `side`. Add the emitted/non-emitted flag if the exporter needs it — one bit, not three kinds |
| **Repeatable comments** (echo at every referencing site) | Genuinely attractive for hardware registers | `memmap.json` already answers "what does `$D020` mean" for all 959 documented addresses, and an echoing comment makes rendered output non-local and hard to diff — which fights the ACME export and the provenance workflow | `memmap.json` + generated enums for hardware; a plain comment for everything else |
| **Nested scopes** | Natural if you think in program structure | Upstream explicitly does not support them and no caller wants them. `add_scope` has exactly **one** site in the whole skill tree (`c64-program-recon/SKILL.md:177`) | Flat, non-overlapping scopes only, sized to be the `!source`/zone boundary the one-file-per-subsystem exporter needs |
| **Tags / bookmarks as a separate axis** | Binary Ninja tags, IDA bookmarks; feels like the right home for triage state | No caller. The confidence-prefix convention already occupies this niche with **zero new storage**, and is already searchable | The `[confirmed-code]`-style prefix inside a line comment |
| **Local-variable / stack-relative symbol tables** | SourceGen and IDA both have them | 6502 game code has no meaningful stack frames; zero callers | Zero-page symbols are just labels, already covered by the `zpp_`/`zpa_` typed prefixes |
| **Bank-qualified addresses / overlay address spaces** | ROM banking is real on the C64, and `PROOF-03` names it as the pivot's highest-risk item | `PROOF-03` is recorded **`could-not-run`** — no capture existed, nothing was measured. `memmap.json` is flat. No absorbed procedure asks for a bank qualifier. Modelling it now is modelling for an unmeasured requirement, and Ghidra's own answer (overlay blocks) still leaves bank-switch analysis manual | Flat, unqualified addresses; **record the assumption at the store's own seam** with a pointer to `PROOF-03` so a future milestone finds it rather than discovering it |
| **A `tools_call`-shaped meta-tool, or script eval** | `ida-pro-mcp` ships `py_eval`; it is the most powerful single tool you can add | Explicitly forbidden by this repo's own convention: it is the nested-argument smuggling shape `vice.ts`'s `DENY_LIST` exists to close. `batch_execute` is the **one** sanctioned exception, and only because every inner name is validated before anything executes | `batch_execute` with pre-flight validation of every inner name |
| **Destructive in-place unpacking** | It is the fast path to a depacked image | Manifest disposition: **`omit`, permanent**. Destructive by upstream's own description (clears comments/labels/blocks) and this project has a non-destructive route to the same answer | `c64-ram-capture` runs the program in the real emulator past the decrunch; the packer identity is a recon finding. The entropy gate **survives** the omission because entropy is a `get_binary_info` field |
| **HTML export with clickable xrefs** | Shareable artifact | Already cut in v0.3.0 as `ANNO-07` — no skill produces or consumes it | Nothing. Stay cut |
| **Byte-or-behaviour parity with the external analyser's store** | It is the thing being replaced, so parity feels like the safe bar | v0.7.0's own requirement text forecloses it: cross-references and search must be *"built on the surviving `disasm-*` decoders rather than carried across as a parity obligation."* Parity would measure an unpromised property — the exact mistake v0.2.0's dropped `VERIF-03` harness made | The manifest's per-procedure tool list is the bar. A procedure that runs is the test |
| **`delete_project_enum`** | It exists upstream and completes the CRUD set | **Zero callers anywhere.** `gen-enums` re-runs via create-then-update | Do not build it. Re-runnable generation needs `create` + `update` only |

## Feature Dependencies

```
Persistence (open / save / restore)
    └──required by──> every mutating verb
                          └──required by──> all 5 absorbed procedures

Owned 6510 decoders (disasm-opcodes / decoder / renderer, 1,042 non-test lines)
    ├──required by──> read_region (disasm view)
    ├──required by──> block classification / get_blocks
    ├──required by──> cross-reference derivation ──requires──> `address` range typing
    ├──required by──> xref access kind (free at decode time, unrecoverable later)
    └──required by──> ACME export ──verified by──> real ACME (anno-verify.ts seam)

Explicitly-stored ranges (no adjacency auto-merge)
    ├──removes need for──> toggle_splitter
    ├──required by──> DECOMP-01 (7-type vocabulary must distinguish adjacent tables)
    ├──required by──> BUILD-02 (per-table file extraction needs a boundary)
    └──removes──> COV-01's predicted over-merge divergence bias

memmap.json (959 entries) + regbits-gen + enum-gen
    └──required by──> project enums ──required by──> apply_enum_usage
                          └──required by──> analyze-routine, analyze-symbol, gen-enums

Labels (with user/auto kind preserved)
    ├──required by──> export-lbl (user kind ONLY — measured)
    ├──required by──> routine-queue-walker's backlog (auto kind IS the queue)
    └──required by──> coverage's two label ratios

Comments (line + side, multi-line on line)
    ├──carries──> confidence-grade prefix ──consumed by──> recon template, coverage vacuity
    └──required by──> search over comments ──required by──> "[unknown]" query, gen-enums

Scopes (flat, non-overlapping)
    └──enhances──> ACME export (the !source / zone boundary)

batch_execute ──requires──> single-owner write path (anno-session.ts's FIFO discipline)
undo journal ──conflicts with──> idempotent range typing (each makes the other pointless)
bank-qualified addresses ──conflicts with──> memmap.json's flat address model
no-op rejection ──conflicts with──> agent retry semantics
```

### Dependency Notes

- **Cross-references require `address` range typing, not just the decoder.** A pointer table is only a set of xrefs once its range is typed `address` (or a split lo/hi variant). This is why typing and xrefs cannot be split across distant phases: typing with no xref consumer looks complete and proves nothing.
- **`batch_execute` requires the single-owner write path.** `anno-session.ts`'s FIFO call queue and save-before-return persistence are what make a batch safe. Porting the batch verb without that discipline reintroduces the interleaved-write failure mode.
- **`export-lbl` depends on the user/auto label *kind*, not merely on labels.** Measured: an annotated project emits exactly the labels a caller set; auto `a_D011`/`e_FFD2` externals are **not** exported. A test asserting an `a_`-prefixed name appears in an export result is testing the wrong thing — that trap is already documented at `anno-symbols.ts:16-23` and must survive the port.
- **`render-memmap` has no store dependency at all.** It reads `memmap.json` and writes Markdown. It can be re-pointed independently of the store, or not at all.
- **`coverage` depends on the store only at its divergence sub-report** (plus label ratio and comment vacuity). Its census reads raw bytes and caller seeds. This boundary is *the* thing to preserve across the port; the existing test pins it by rewriting every block entry to one type and asserting no census byte count moves.
- **Undo conflicts with idempotent range typing.** Making typing idempotent is what makes undo unnecessary; building undo is what makes idempotency uninteresting. Pick idempotency — it is the one the callers already assume.

### Sizing correction (measured this session)

The seed `own-the-annotation-store.md` states figures that no longer hold. Recorded here rather than restated:

| Seed claim | Measured 2026-08-26 | Note |
|---|---|---|
| `disasm-*` = 2,555 lines to reuse | **1,042** non-test; 2,555 is the total **including tests** | Reuse target is ~1k lines, not ~2.5k |
| Delete 19,181 lines (9,087 non-test + 9,928 test) | **25,759** across `anno-*.ts` (10,102 non-test + **15,657** test) | Test surface is ~58% larger than the seed assumed; the deletion phase is materially bigger than sized |
| `anno-d64.ts` = 310 lines, standalone | 310, standalone — **holds** | Keep as-is |

**20 test files** are pinned to the deleted subject (`anno-*.test.ts` ×19 plus `docs-absorbed-decisions.test.ts`). Each needs an explicit fate before the phase gate — already an Active requirement, and the sizing above says why it is not a footnote. Two need particular care: `absorbed-answer-key.test.ts` reads `.planning/phases/11-*/evidence/` with no existence guard, and `docs-absorbed-decisions.test.ts` pins D-36, a decision about a tool that is being deleted.

## MVP Definition

### Launch With (v0.7.0)

The 18 caller-backed verbs, grouped by what the roadmapper can phase independently:

- [ ] **Store core + persistence** — open/save, durability proven by planted violation (`STORE-02`), the JSON document, `get_binary_info` — *every procedure depends on it*
- [ ] **Labels** — `set_label_name` (REJECT-not-sanitize validation), `get_symbols` with the `user|system|auto` kind filter — *3 procedures, 3 skills, `export-lbl`, `import-lbl`, `routine-queue-walker`'s queue*
- [ ] **Comments** — `set_comment` / `get_comments`, `line` + `side`, multi-line on `line` — *all 5 procedures*
- [ ] **Range typing** — `set_data_type` / `get_blocks`, **full `DECOMP-01` vocabulary**, explicitly-stored ranges with no adjacency auto-merge, even-count validation on split forms — *4 procedures*
- [ ] **Reads over the typed decode** — `read_region` (disasm|hexdump, refuse-over-cap), `disassemble`, `get_cross_references`, `get_address_details` — *4 procedures*
- [ ] **Search** — `search_disassembly`, `max_results` required with no default, count returned — *`c64-program-recon`, `gen-enums`*
- [ ] **Project enums** — `create_project_enum`, `update_project_enum`, `apply_enum_usage`, generated from `memmap.json` — *2 procedures, `gen-enums`*
- [ ] **Scopes** — `add_scope`, flat and non-overlapping — *`c64-program-recon`; the exporter's zone boundary*
- [ ] **Batch** — `batch_execute` over the single-owner write path, pre-flight validation of every inner name, per-item status on execution — *2 procedures*
- [ ] **ACME export + real-ACME verification** — `=*+$01` mid-instruction labels, typed label prefixes — *`export-asm`, `verify`, `acme-build`*
- [ ] **Symbol round trip** — `export-lbl` (user kind only), `import-lbl` — *3 skills*
- [ ] **Save-point restore** — the scoped form of "undo": whole-store snapshot/restore, not an inverse-operation journal

### Add After Validation (v0.7.x)

- [ ] **Xref access kind** (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) — trigger: `GHID-05` unheld. **Store the field now** (free at decode time, unrecoverable later); build nothing on it until there is a consumer
- [ ] **`set_immediate_format`** (low/high-byte pointer → symbol reference) — trigger: `BUILD-03` ("every branch, JSR/JMP and data reference goes through a symbol so code can move"). Named in the manifest as a future-surface proposal, not a permanent omission. Must go through the FIFO write path
- [ ] **Emitted vs non-emitted comment flag** (SourceGen's *note*) — trigger: the exporter emitting a triage note into shipped source, once
- [ ] **Confidence as a first-class field** rather than a comment prefix — trigger: a caller that needs to filter on it without a text scan. None exists today

### Future Consideration (v0.8+)

- [ ] **Bank-qualified addressing** — defer until `PROOF-03` is actually measured. Today it is modelling for an unmeasured requirement
- [ ] **Cross-release block-classification diffing** (`c64-provenance-diff` comparing *classifications* rather than byte offsets) — attractive, and the one-project-at-a-time limit that blocked it is gone once the store is ours. But `c64-provenance-diff` calls zero store verbs today, so it is a new consumer, not a re-pointing
- [ ] **`delete_project_enum`** — only if something ever needs it. Nothing does

## Feature Prioritization Matrix

| Feature | Consumer count | Implementation Cost | Priority |
|---|---|---|---|
| Persistence + durability proof | 5 procedures + 3 skills | MEDIUM | **P1** |
| Comments (line + side) | 5 procedures | LOW | **P1** |
| Labels + user/auto kind | 3 procedures, 3 skills, 2 CLI verbs | LOW | **P1** |
| Range typing, full vocabulary, no auto-merge | 4 procedures + 2 held requirements | MEDIUM | **P1** |
| `read_region` / `disassemble` | 4 procedures | LOW (decoders exist) | **P1** |
| `get_blocks` | 2 procedures + `coverage` | MEDIUM | **P1** |
| Cross-references | 3 procedures, 3 skills | MEDIUM–HIGH | **P1** |
| `get_binary_info` (incl. entropy) | 4 procedures | LOW | **P1** |
| `batch_execute` + single-owner write path | 2 procedures | MEDIUM | **P1** |
| Search with required `max_results` | 1 skill + `gen-enums` | MEDIUM | **P1** |
| Project enums (create/update/apply) | 2 procedures + `gen-enums` | MEDIUM (retarget) | **P1** |
| ACME export verified by real ACME | 3 CLI verbs + `acme-build` | HIGH | **P1** |
| `get_address_details` | 1 procedure | LOW (composition) | **P1** |
| Symbol round trip (export/import-lbl) | 3 skills | LOW–MEDIUM (adapter exists) | **P1** |
| Scopes (flat) | 1 skill + exporter | LOW | **P1** |
| Save-point restore (scoped "undo") | `STORE-02` requirement text | LOW | **P1** |
| Coverage census re-point | 1 CLI verb, 1 skill | LOW (already built) | **P1** |
| Confidence prefix (retarget as-is) | recon template + `coverage` | LOW (already built) | **P1** |
| Xref access kind — **field only** | none today; `GHID-05` held | LOW now / HIGH later | **P2** |
| Emitted/non-emitted comment flag | none today | LOW | **P2** |
| `set_immediate_format` | none today; `BUILD-03` | MEDIUM | **P2** |
| Undo journal (inverse operations) | **none** | HIGH | **P3 — recommend not building** |
| Splitter primitive | obviated by explicit ranges | — | **P3 — designed out** |
| `delete_project_enum` | **none** | LOW | **P3 — surplus, cut** |
| Bank-qualified addresses | none; `PROOF-03` unmeasured | HIGH | **P3 — defer** |
| Cursor / current-address | forbidden by upstream's own text | — | **Never** |
| `py_eval`-style meta-tool | — | — | **Never** |

## Competitor Feature Analysis

| Feature | Ghidra | IDA Pro | Binary Ninja | SourceGen (6502) | **Our approach** |
|---|---|---|---|---|---|
| Comment kinds | 5 typed | 5 typed | 1 + tags | 3 (one never emitted) | **2** (`line`, `side`), plus an emitted flag when the exporter demands it |
| Undo | transactional | database-level since 7.3 | user actions only | yes | **Save-point restore, no inverse journal** — no caller for undo |
| Xref access kind | first-class `RefType` | code/data + subtypes | weaker | operand-driven | **Store the kind, build no analysis on it yet** |
| Range typing | data types over ranges | per-item | types | descriptors incl. PETSCII + screen codes | **Explicit stored ranges, 7+ type vocabulary, no adjacency merge** |
| Persistence | ProgramDB (binary) | `.idb` | `.bndb` | **JSON + data-file CRC, user data only** | **JSON, user data only** — SourceGen's model, because it diffs and it is the shape the provenance workflow already assumes |
| Banked memory | overlay blocks, manual analysis | manual segments | manual | address regions | **Flat, assumption recorded at the seam** |
| Name provenance | symbol source | — | user vs auto actions | user vs auto labels | **`kind: user\|system\|auto`** — load-bearing for `routine-queue-walker` and `export-lbl` |
| Agent addressing | GUI cursor + API | GUI cursor + API | GUI cursor + API | GUI cursor | **Explicit address on every call, no cursor, ever** |
| Batch failure mode | — | per-item status array (`ida-pro-mcp`) | — | — | **Pre-flight refuse-whole on validation; per-item status on execution** |
| No-op write | accepted | accepted | accepted | accepted | **Accepted, with `changed:false`** — `ghidra-mcp` rejects; that is the wrong call for a retrying agent |

## What changes because the consumer is an LLM over MCP

Eight rules, each traced to something already decided in this repo or cross-checked in the survey:

1. **Address in, always. No cursor.** Upstream's own procedure text says *"**NEVER** use the 'current cursor address'"*; the manifest disposition is `adapt-to-address-input`; this project has no editor. Ranges are inclusive on both ends, stated in every description.
2. **Idempotent writes, `changed:true|false`, never a no-op error.** Agents retry on timeout. The MCP design consensus is explicit: if the resource already exists, return success rather than a blocking error. This is also what lets undo be omitted.
3. **Two distinct failure modes, not one.** *Pre-flight validation* failures (uncurated inner name, illegal ACME identifier, odd byte count on a split table, range over cap) refuse the **whole** call, by name, before anything executes — the existing D-33 posture. *Execution* failures inside a batch report **per item** and the loop runs to completion — the measured upstream semantics, and `ida-pro-mcp`'s shape. `ghidra-mcp` chose all-or-nothing atomicity; that is the wrong trade, because an agent recovers from "3 of 40 failed at these addresses" and cannot recover from "the batch was rejected".
4. **REJECT, never sanitize.** A malformed label name is a bug to surface, not a string to quote. Already the convention (`assertLegalAcmeIdentifier`); extend it to every ambiguous input.
5. **Refuse rather than truncate, and refuse *by name*.** The existing over-cap `read_region` refusal names the requested size and the valid range. `search_disassembly`'s `max_results` is required with no default because the silent default of 50 truncated a full-program pass; return the count so truncation is detectable rather than invisible.
6. **`{available:false, reason}` rather than a plausible zero.** The project convention at `stock-cia.ts:494`, `stock-vicii.ts:239`, `incident-record.ts:115`. Errors go *inside* the result so the model can see and recover from them, and the reason names the next thing to try.
7. **Mark composed and derived answers.** `get_address_details` already carries `composed_client_side:true` and `composed_from`. Keep the convention for anything not read straight out of storage — it is what stops a composed answer being mistaken for primary evidence.
8. **Do not grow the surface.** 19 verbs is already well past the cited 5–8-per-toolset sweet spot, and every schema consumes context. The manifest's resync trigger already enforces the discipline: adding a verb requires updating its disposition entry in the same commit, so the manifest cannot silently disagree with the code. Keep that gate pointed at the new store.

## Confidence and gaps

| Area | Level | Reason |
|---|---|---|
| Consumer trace (which verb has which caller) | **HIGH** | Measured directly: `grep` over `src/skills/`, every non-test `runAnnoTool` call site, the committed manifest |
| Sizing figures | **HIGH** | `wc -l` this session; the seed's figures are corrected above |
| Comparable-tool models | **MEDIUM** | Cross-checked per tool across ≥2 sources; official docs for Ghidra/Binary Ninja/SourceGen, vendor docs for IDA |
| C64-specific tools other than the external analyser | **LOW** | Infiltrator (2011), jc64dis and C64 Studio are GUI/one-shot decompilers; no primary documentation of an annotation model was found. Treated as evidence of *absence* of prior art, not as a model to follow |
| MCP-for-RE prior art | **MEDIUM** | `ida-pro-mcp`, `re-mcp`, `bethington/ghidra-mcp` READMEs read directly; the batch/convention/idempotency claims are their own documentation, not independently exercised |
| Whether a bank qualifier is needed | **LOW — and honestly so** | `PROOF-03` is `could-not-run`. Nothing is known. Recommendation is to record the assumption, not to model it |

**Gaps a phase will have to close, not this document:**
- Whether the split-table forms (`lo_hi_address` etc.) need all four variants or whether two plus an orientation flag suffices. No procedure exercises all four; `coverage`'s dispatch-context gate already reasons about lo/hi orientation and is the place to look.
- Whether `disassemble` (control-flow trace that *converts regions to Code*) and `set_data_type` should remain separate verbs once the store is ours — `disassemble` is a mutating read, which is exactly the shape an agent gets wrong.
- The exact fate of each of the 20 guard files pinned to the deleted subject. Named as an Active requirement; the sizing table says why it deserves its own plan rather than a task.

## Sources

**This repository, read directly (HIGH):** `.planning/PROJECT.md`; `.planning/REQUIREMENTS.md`; `.planning/seeds/own-the-annotation-store.md`; `.planning/notes/external-analyser-integration.md`; `.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`; `src/mcp/vice/anno-tools.ts`, `anno-enum-gen.ts`, `anno-symbols.ts`, `anno-confidence.ts`, `anno-coverage.ts`, `anno-cli.ts`, `anno-memmap-render.ts`, `stock-cia.ts`, `stock-vicii.ts`, `incident-record.ts`; `src/skills/*/SKILL.md`.

**Comparable tools (MEDIUM):**
- [Ghidra `CommentType`](https://ghidra.re/ghidra_docs/api/ghidra/program/model/listing/CommentType.html), [`Listing`](https://ghidra.re/ghidra_docs/api/ghidra/program/model/listing/Listing.html), [`RefType`](https://ghidra.re/ghidra_docs/api/ghidra/program/model/symbol/RefType.html), [`FlowType`](https://ghidra.re/ghidra_docs/api/ghidra/program/model/symbol/FlowType.html), [Comments help topic](https://github.com/NationalSecurityAgency/ghidra/blob/master/Ghidra/Features/Base/src/main/help/help/topics/CommentsPlugin/Comments.htm), [Ghidra Tip 0x0A: Comments](https://maxkersten.nl/2025/04/15/ghidra-tip-0x0a-comments/)
- [Ghidra `Memory` (overlay blocks)](https://ghidra.re/ghidra_docs/api/ghidra/program/model/mem/Memory.html), [Handling banked ROM (discussion #6651)](https://github.com/NationalSecurityAgency/ghidra/discussions/6651), [GhidraNes](https://github.com/pudge62/GhidraNes), [C64-Wiki: Bank Switching](https://www.c64-wiki.com/wiki/Bank_Switching)
- [IDA: Comments](https://www.hex-rays.com/products/ida/support/idadoc/481.shtml), [Igor's tip #14: Comments in IDA](https://hex-rays.com/blog/igor-tip-of-the-week-14-comments-in-ida), [IDA 7.3 Undo release note](https://docs.hex-rays.com/release-notes/7_3/undo), [Undo an action](https://hex-rays.com/products/ida/support/idadoc/1710.shtml)
- [Rizin Handbook: Adding Metadata to Disassembly](https://book.rizin.re/src/disassembling/adding_metadata.html), [Introducing Projects in Rizin](https://rizin.re/posts/introducing-projects/)
- [Binary Ninja `FileMetadata`](https://api.binary.ninja/binaryninja.filemetadata-module.html), [Important Concepts (user vs auto actions)](https://docs.binary.ninja/dev/concepts.html), [`BinaryView` C++ API](https://api.binary.ninja/cpp/group__binaryview.html)
- [6502bench SourceGen: More Details](https://6502bench.com/sgmanual/intro-details.html), [Editors](https://6502bench.com/sgmanual/editors.html), [Instruction and Data Analysis](https://6502bench.com/sgmanual/analysis.html), [fadden/6502bench](https://github.com/fadden/6502bench)
- [Infiltrator Disassembler V1.0 (CSDb)](https://csdb.dk/release/?id=100129)

**LLM/MCP consumer shaping (MEDIUM):**
- [mrexodia/ida-pro-mcp](https://github.com/mrexodia/ida-pro-mcp), [jtsylve/re-mcp](https://github.com/jtsylve/re-mcp) and [its announcement](https://jtsylve.blog/post/2026/05/04/ida-mcp-becomes-re-mcp), [bethington/ghidra-mcp](https://github.com/bethington/ghidra-mcp)
- [54 Patterns for Building Better MCP Tools (Arcade.dev)](https://www.arcade.dev/blog/mcp-tool-patterns/), [MCP Tool Annotations](https://mcpblog.dev/blog/2026-03-13-mcp-tool-annotations), [Design Patterns for Deploying AI Agents with MCP (arXiv)](https://arxiv.org/html/2603.13417v1), [MCP Toolbox Style Guide](https://mcp-toolbox.dev/reference/style-guide/)

---
*Feature research for: an owned annotation store serving an LLM agent over MCP (C64/6502)*
*Researched: 2026-08-26*
