# Feature Research

**Domain:** Frame-exact emulator capture + a two-engine (dxa discovery / Ghidra semantic) 6502 analysis pipeline feeding an owned annotation store
**Researched:** 2026-09-02
**Confidence:** HIGH on the two pasted proposals' assessment and on the da65/dxa/Ghidra capability facts (measured or read in primary source this session). MEDIUM on capture practice. LOW on comparable-tool ecosystem claims (web-search-derived, single-tier).

## Evidence labelling

Every claim below carries one of:

| Label | Means |
|---|---|
| **MEASURED (session)** | Observed by running something during this research pass, on this host, 2026-09-02 |
| **MEASURED (repo)** | Observed by a recorded measurement already committed in this repository, with its date and file |
| **READ-IN-SOURCE** | Read from a primary artifact — a vendor manual, a man page, a binary's own `-help`/string table, or shipped source |
| **RECALLED** | Model knowledge or a web-search summary. Not verified. Treated as a hypothesis, never as a basis for a scoping decision on its own |

Host inventory taken this session, because it changes what "table stakes" costs:
`da65` V2.18 (Debian 2.19-2), `ca65`, `ld65`, `xa`, `acme` 0.97, `/usr/bin/x64sc`
(genuine stock VICE 3.9), `/usr/local/bin/x64sc` (the fork), `java` OpenJDK 21,
and Ghidra **12.1.3** — but only at `/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC`,
out of tree, not on `$PATH`, not pinned, not vendored. **`dxa` is not installed
anywhere** under `/home`, `/opt` or `/usr/local`. MEASURED (session).

---

## 0. Already built — do NOT re-scope these

The single most useful thing this research can do for the roadmap is refuse
work. Each row below appears somewhere in the two pasted proposals as if it
were new.

| Proposed as new | Actually | Status |
|---|---|---|
| "Annotated disassembly output (`program.asm`)" | `anno export-asm <image> --store FILE` ships and writes ACME source; the real-ACME byte-diff oracle (`acme-verify.ts`) is test-only by a committed assertion | **Shipped v0.7.0** (`EXPORT-01..03`) |
| "A canonical analysis model with regions / functions / tables / symbols / references" | `.annostore` over `node:sqlite`, one seam, 18 `anno_*` tools, 12-member frozen per-range type vocabulary **including the four split layouts as first-class members**, narrowest-range-wins paint index proven exact at all 65,536 addresses against an independent linear-scan oracle | **Shipped v0.7.0** (`STORE-01..07`) |
| "Cross-references and search over the decode" | `STORE-06` — unions decoded code, typed split ADDRESS tables and stored non-derivable rows into one sorted de-duplicated list | **Shipped v0.7.0** |
| "Human overrides always win / `overrides.yaml`" | The store *is* the override layer; it has snapshot/revert proven across a real `SIGKILL` in a separate OS process | **Shipped v0.7.0** (`STORE-04`) |
| "A 6502 decoder covering illegal opcodes" | `disasm-opcodes.ts` / `disasm-decoder.ts` / `disasm-renderer.ts`, 2,555 lines, already decode illegal opcodes | **Shipped, pre-pivot** |
| "The SLEIGH extension for the 105 missing opcode bytes" | Exists in full: `docs/undocumented-opcodes-ghidra.md`, 766 lines, unstable instructions already modelled as black-box userops, `@include` layering already written | **Written; `OPC-01..03` integrate and verify it, they do not author it** |
| "An interactive 6502 disassembler with auto-analysis and a project file" | This is the external analyser. Evaluated, integrated (v0.3.0-v0.5.0), then **deleted** in v0.7.0 — 14 files / 8,221 lines removed entry by entry behind a grep gate observed biting on four evasion routes | **Deliberately removed. Not a candidate.** |
| "A packer-specific unpacker (`unp64`-class, 370+ formats)" | Dropped by explicit owner decision 2026-08-24 (~5,400 lines including a 6502 CPU emulator). Depack-by-running via `c64-ram-capture` is the route | **Out of scope by decision** |
| "Multi-assembler output / a `ca65` target" | Out of Scope by owner decision at the v0.7.0 close | **Out of scope by decision** |
| "Bank-qualified addressing as a modelled feature" | Out of Scope by owner decision at the v0.7.0 close | **Out of scope by decision** |

MEASURED (repo): all rows sourced from `PROJECT.md` § Requirements/Out of Scope,
`.planning/notes/dxa-ghidra-pivot.md` and `ROADMAP.md` Phase 24/25/26 notes.

**Two prerequisites are unowned, not one.** `ROADMAP.md` names the frame-exact
emulator stop as "the single gate". It is the single gate on *measurement*, but
it is not the only missing input: **dxa does not exist on this machine and
Ghidra exists only as an unpinned out-of-tree probe unpack** (MEASURED, session).
`DXA-01` requires a vendored build at a pinned version with its GPLv2+ notice;
`GHID-01` requires a committed harness "reproducible by a second run from a
clean project". Neither is satisfied by what is on disk. Sequence tool
acquisition as real work, not as a setup footnote.

---

## Feature Landscape

### Table Stakes (a user of this milestone assumes these exist)

| Feature | Why Expected | Complexity | Depends on existing | Notes |
|---|---|---|---|---|
| **Depacked flat 64K capture with no transcription step**, by slicing a `.vsf` `C64MEM` module body | Every downstream criterion reads this substrate; without it they are all `could-not-run`, which is what produced Phase 23's `no-go` | **LOW** | `vice_snapshot_save` (supported on **both** backends), `hostpath.ts`/`containerpath.ts` | Method already validated. `C64MEM` body = 4 bytes port/PLA + exactly 65536 bytes RAM; slice `[bodyStart+4, +65536)`. `RAM[$00]`/`RAM[$01]` are the *underlying RAM*, not the 6510 port — the only place a snapshot image legitimately differs from a `vice_memory_read` transcript. MEASURED (repo, 2026-08-26; `evidence/vsf-ram-extract.mjs` exists as a throwaway) |
| **A capture manifest beside every image**: sha256, size, and the *stop coordinates* — `hit_count`, PC, raster line/cycle, cycle counter | "Are these two captures the same run?" is unanswerable without recording where each one stopped. Phase 23's whole divergence finding is a comparison of stop coordinates | **LOW** | `SCHEMA.md` already fixes `capture_sha256` / `CAPTURE_SIZE` names | The community records nothing equivalent — practitioners re-run and eyeball. This is cheap and it is what makes the equivalence claim checkable rather than asserted |
| **An equivalence *predicate* with a named divergence allowlist**, not a hash compare | Byte-identity between two runs is structurally unreachable and the project has already measured why | **MEDIUM** | the manifest above | Known-legitimate divergences already measured: the `$00`/`$01` port overlay, `$00F6` (KERNAL keyboard-decode-table pointer), and ~41 single-bit drift addresses that "all pass". MEASURED (repo, 2026-08-26) |
| **A machine-readable code/data map from a vendored, pinned dxa** | `DXA-01..03`. It is the only tool that produces a map from nothing, and the only one covering illegal NMOS opcodes | **MEDIUM** | nothing existing; new vendored build | dxa's flag set is sufficient and stable: `-p all-nmos6502`, `-g`/`-G` load address, `-r`/`-R` routine entry points, `-b xxxx-yyyy`/`-B file` data blocks, `-t detect-internal` address tables, `-a dump` address info, `-l` labels. READ-IN-SOURCE (man page) |
| **A dxa listing parser that refuses by name** | dxa offers **no structured output at all** — assembler source listing only. A silent mis-parse feeds phantom code into every stage downstream | **MEDIUM** | Phase 23's throwaway `dxa-listing-parse.mjs` proves the line shape and the refusal | READ-IN-SOURCE (man page: no machine-readable format documented). The refusal already has a working form: assert accounted byte total == an *explicitly passed* image size, never one inferred from the same listing |
| **Ghidra headless from a committed script, handed dxa's map as hints** | Ghidra alone on a headerless 6502 image produces **0 functions and 0 code bytes**. The map is not an optimisation | **MEDIUM** | none; new harness | MEASURED (repo, 2026-08-24). Language id is exactly `6502:LE:16:default` — MEASURED (session, from `6502.ldefs` in the 12.1.3 install) |
| **The volatile-I/O carve on `$0000-$0001` and `$D000-$DFFF`, before `analyzeAll()`** | Without it the decompiler deletes hardware writes as dead stores, **silently**. Applied to a raster loop it deletes the entire visible effect of the program and reports success | **LOW to write, HIGH to prove** | none | MEASURED (repo, 2026-08-24): 3 of 4 `$01` writes and a `$d020` write eliminated under defaults. Must call `mem.getBlock(addr)` and `setVolatile(true)` on the *existing* block; creating a conflicting one throws `MemoryConflictException` and drops the run back to non-volatile |
| **Structural facts extracted through `DecompInterface`, never `DataTypeManager`** | `getAllComposites()` and `getDefinedData()` return essentially nothing on 6502; the same program through `DecompInterface` yields the index bound, the `CONCAT11` split pointer and the record stride directly | **MEDIUM** | none | MEASURED (repo, 2026-08-24). Named in `ROADMAP.md` as "the single most expensive mistake available in this design" |
| **Cross-references carrying their access kind** (`READ`/`WRITE`/`READ_WRITE`/`COMPUTED_JUMP`) | The auto-annotation join needs the kind, not the address. `inc $d021` typed `READ_WRITE` rather than `WRITE` is a semantic difference in a register annotation | **LOW** | store's xref rows | MEASURED (repo, 2026-08-24) — those three exact facts are what Ghidra contributed that nothing else produced |
| **Machine-address auto-annotation: narrowest-range-wins, in-image skip, bank-before-address, decline where path-dependent** | `AUTO-01..07`. The whole point of the feature | **MEDIUM** | `.annostore` write seam, `memmap.json` (959 entries, 4 published sources, pinned by `memmapSha256`) | MEASURED (repo, 2026-08-24 PoC): 18 of 18 machine-address xrefs annotated across 10 distinct addresses, 25 program addresses correctly skipped, of 43 total |
| **All 105 opcode bytes stock `6502.slaspec` omits, decoding under the extension** | Crack and packer code is exactly where the gap bites, and `GHID-04`'s acceptance is not honestly claimable while 105 bytes are undecodable | **MEDIUM** (integration, not authoring) | `docs/undocumented-opcodes-ghidra.md` | MEASURED (session): `6502.slaspec` has exactly **57** constructor lines in 500; `65c02.slaspec` has 28 in 222; `grep -inE 'illegal\|undoc\|unstable\|unknown'` over `6502.slaspec` returns **zero** |
| **`--json` structured output on stdout from the one command** | A caller needs the counts and the facts without screen-scraping | **LOW** | store queries | Table stakes as a *rendering*. See the anti-feature row on `program.json` as a persisted artifact |

### Differentiators (real advantage, no comparable does this)

| Feature | Value Proposition | Complexity | Depends on existing | Notes |
|---|---|---|---|---|
| **A constructed monotonic frame counter over the text monitor's `stopwatch`** | This is the missing clock. `CLAUDE.md` records that there is no monotonic cycle register and that `LIN`/`CYC` are readable but not monotonic — so "stop at frame M" needs a constructed counter. `stopwatch` *is* that counter and it already works | **MEDIUM** | the `-remotemonitor` port the broker **already allocates on every stock launch and nothing has ever dialed** | READ-IN-SOURCE (VICE monitor manual: "Print the CPU cycle counter of the current device. 'reset' sets the counter to 0"). MEASURED (repo, 2026-08-27): `sw` → `Stopwatch: 12855025`, advancing while the machine runs. **The highest-leverage unlock in this milestone and the cheapest.** Caveat: the text monitor *halts the machine on command* exactly like the binary monitor (MEASURED, repo) — it is a second channel needing the same serialization discipline, not a free side-channel |
| **Frame alignment as a second wait after the depack stop** | Frame index is the dominant divergence term. Land the same frame and two runs are one transient KERNAL pointer away from equivalent | **HIGH** | `vice-sync.ts` invariants (exactly one resume per wait; poll on `hit_count`, never on paused state) | MEASURED (repo): `danish` r1/r2 stopped at `hit_count` 1 and **2** → **201** multi-bit divergences; `saeger` r1/r2 both at `hit_count` 1 → **1** multi-bit difference. Checkpoint conditions must use `RL`/`CY` (not `LIN`/`CYC`), have **no operator precedence**, and treat bare integers as **hex** — parenthesise every comparison. A non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop, so a hot-address condition can stall the emulator thread |
| **An execution-derived code/data map from the emulator itself (`memmapzap` → run → `memmapshow`)** | Makes dxa's static map **checkable instead of trusted** — the single defect class this project treats as a bug. It is also the "dynamic evidence source" the pasted design defers to "one addition I would make eventually", available today for the cost of a text-monitor client | **MEDIUM** | the same unclaimed `-remotemonitor` port | READ-IN-SOURCE (monitor manual): mask bits are `"ioRWXrwx"` — **execute is a separate bit for both ROM and RAM**. MEASURED (repo, 2026-08-27): per-address `IO ROM RAM` access map returned on genuine stock 3.9; `memmapzap` clears it. MEASURED (session): `memmapshow`/`memmapsave`/`memmapzap`/`cpuhistory`/`chis`/`stopwatch`/`profile` all present in `/usr/bin/x64sc`'s string table. **Read the asymmetry precisely:** an executed bit *confirms* CODE; the absence of one does **not** prove DATA (an untaken branch is still code). So it directly detects dxa's false *negatives*, and detects false positives only in combination with the VIC graphics map. Note `memmapsave` writes a **picture** (BMP/PCX/PNG/GIF/IFF), not data — `memmapshow` text is the machine-readable route |
| **The VIC-DMA graphics map, fed back to both engines** | Cross-references structurally *cannot* find a charset the VIC fetches by DMA and no instruction references. This is the containment for the pipeline's worst failure | **HIGH** | `memmap.json`, dxa `-b`, Ghidra data marking | `AUTO-05`. Derived from `$DD00` bits 0-1 **inverted**, `$D018`, `$D011` bit 5, screen + `$3F8`. Failure it contains, MEASURED (repo): graphics bytes decoded as instructions mint phantom labels (`zpp_02`, `zpa_06`, `f_1B1A`) indistinguishable in form from genuine ones; a phantom routine inside a charset gets promoted to a Ghidra function, yields phantom xrefs, feeds the join, and emerges as a confident wrong comment the next pass treats as established. No comparable tool has any analogue — SVD-style loaders have no DMA agent |
| **Declining rather than annotating** where bank state is path-dependent | **No comparable tool declines.** Ghidra's SVD-Loader, radare2's SVD import and IDA's device `.cfg` all annotate unconditionally from a flat declarative device description | **MEDIUM** | store write seam | RECALLED (web search, LOW). Their domain has no path-dependent address meaning, so they never needed a decline path. The consequence is load-bearing: **there is no prior art to copy and no prior art to validate against**, which is exactly why `AUTO-02/03/04` each demand a control observed *red* rather than an assertion that the fix is present |
| **Warp + headless corpus sweeps** | `PROOF-01` needs a real-release number, and a real-release number needs more than one release. Real-time emulation with a mapped window is the wrong default for a sweep and impossible on a display-less host | **MEDIUM** | broker acquire path, `buildViceArgs()` | Premise already corrected in-repo: **warp is a runtime text-monitor command on both backends**, not a launch dimension — MEASURED (repo, 2026-08-27): `warp` → `Warp mode is off.`, `warp on`, `warp` → `Warp mode is on.` Headless is the only genuine launch-mode dimension. `-warp`, `-console`, `-autostart-warp` all present in stock 3.9's `-help` (MEASURED, session) |
| **Provenance-per-assertion in the store** (which engine asserted a fact, and via which access kind) | This is the genuinely good half of the pasted `analysis.json` proposal, separated from the harmful half | **LOW to MEDIUM** | store rows | Keep *why* something was classified. Discard the float arithmetic — see anti-features |

### Anti-Features (each with the reason, because each will be re-proposed)

| Feature | Why Requested | Why Problematic | Alternative |
|---|---|---|---|
| **A `da65` `.info` generator as an output stage** | It is the pasted design's whole back half, and da65 genuinely does read ranges/labels/table types | **Six independent reasons, five of them measured — see § (c).** Most decisive: its complete `RANGE TYPE` vocabulary is exactly nine values and contains no split, struct or pointer-pair type, so every structural fact Ghidra recovers dies at that boundary; and it **cannot express a comment without minting a symbol name**, which is fatal for a feature whose entire output is comments on machine addresses | `anno export-asm` (shipped) as the render stage; `acme-verify.ts`'s real-ACME byte-diff oracle (shipped, test-only) as the check |
| **`program.json` as a persisted fourth artifact** | The pasted proposal's genuinely new idea, and a JSON file feels like an obvious deliverable | It is a fourth model beside `.annostore`, the `.vsf` and the dxa listing. This project has been bitten repeatedly by a second copy of a fact drifting from the first — it maintains **six** `docs-*.test.ts` guards and a both-directions-derived deferred ledger for exactly this reason | Emit JSON **from** the store on demand (`--json`), and make the Ghidra post-script's output a **transfer file consumed and discarded inside the same command**. See § (d) for the container-boundary correction |
| **Float confidences merged by noisy-OR (`1-(1-a)(1-b)`)** | It looks principled and the pasted design leans on it heavily | (i) The numbers are invented — the proposal itself concedes "the actual confidence numbers are yours to define". (ii) Noisy-OR assumes independence, and dxa's map is **fed into Ghidra as hints**, so the two sources are maximally *dependent*; the product inflates confidence precisely where it is least warranted. (iii) The store already has a frozen discrete 12-member vocabulary and a paint index proven exact at all 65,536 addresses — a parallel float model is a second, unproven paint over the same bytes | Discrete typing + provenance + an explicit `conflicts` list. "Never silently choose" is the proposal's own good instinct; a merged scalar is how you silently choose |
| **`-limitcycles` as a capture stop** | It reads like a cycle-exact stop, which is exactly what a frame-exact capture wants | Stock 3.9's own help: **"Specify number of cycles to run before quitting with an error."** It *exits the process* — no snapshot, no RAM — and the process it exits is the one the broker owns and supervises. READ-IN-SOURCE (session, `/usr/bin/x64sc -help`). There is no `-exitsnapshot`; only `-exitscreenshot` | A constructed frame counter over `stopwatch` (differentiator above), with `-limitcycles` kept only as a runaway watchdog if anything |
| **Text-monitor `bsave`/`save` as the capture route** | It is the canonical practitioner move and writes a flat binary directly, no transcription | Two hard problems. (1) It writes on the **host** filesystem from inside the emulator, bypassing `hostpath.ts`/`containerpath.ts` — a second, unguarded path-translation route, the exact class `CLAUDE.md` closes. (2) It gives the **CPU view**: ROM banked in where it is banked in, `$00`/`$01` reading as the 6510 port, I/O reads hitting live registers. READ-IN-SOURCE (monitor manual: `save` writes a two-byte load address, `bsave` does not) | The `.vsf` `C64MEM` slice — already validated, already goes through the supported `vice_snapshot_save` tool on both backends, and yields the underlying RAM |
| **Freezer-cartridge freeze (Action Replay / Retro Replay)** | The historical practitioner route and a real one | RECALLED (LOW): requires a cartridge image, freezes on an NMI at a wall-clock-arbitrary point — so *less* frame-exact than a checkpoint, not more — and writes its own file format. Strictly worse than a snapshot on every axis this milestone cares about | `.vsf` snapshot at a checkpoint |
| **Event-history replay as the *primary* determinism mechanism** | Determinism by construction is a beautiful answer, and the flags exist (`-eventsnapshotdir`, `-eventstartsnapshot`, `-eventendsnapshot`, MEASURED session) | VICE's own manual disclaims it: snapshots "may not be 100% accurate even with all the recommended settings", and it acknowledges "the playback session differs from what was done at recording time" as a real outcome with mitigations rather than a guarantee. READ-IN-SOURCE (VICE manual ch. 11). Also: it records *user input* (joystick, keyboard, reset, image attach, datasette) — not the depack path, which needs no input at all | Keep it as a **second-choice route behind the pre-committed gate**, tested rather than assumed. A frame-exact stop is the primary |
| **A packer-specific unpacker** | 370+ formats is a real capability with no in-house equivalent | Dropped by explicit owner decision (2026-08-24), ~5,400 lines including a 6502 CPU emulator. Depack-by-running is already a shipped skill | `c64-ram-capture` |
| **`program.c` as a co-equal deliverable output** | It is the most impressive-looking artifact the pipeline can produce | Sets an expectation 6502 cannot meet (§ (f)) and invites unbounded "improve the C" work on a target that never existed — hand-written 6502 was not compiled from C. v0.6.0's own research already classified "producing C instead of assembly" as an anti-feature for the rebuild goal | Emit the C as *labelled derived evidence* behind each structural fact; accept the pass on the facts, never on the prose |
| **Applying a `memmap.json`-derived struct to `$D000-$DFFF` via `DataTypeManager`** | It is exactly what SVD-Loader does for ARM, so it looks like the obvious, well-trodden design | It is the design this project has already measured as returning essentially nothing on 6502 — the "single most expensive mistake available". The comparable tool's own technique does not transfer to this architecture | The join runs **outside** Ghidra, over exported typed xrefs, against `memmap.json`, writing into the store |
| **A hedged optimistic annotation** ("possibly the border colour") | It feels more useful than nothing | It is the confident-wrong-comment failure mode with a fig leaf, and the next pass treats it as established. All three selection rules were got wrong on the first attempt and **each failed silently rather than erroring** (MEASURED, repo) | Decline, and record *why* it declined |
| **A second machine map** (folding in another tool's built-in C64 label set) | More names looks like more coverage | The retired analyser's built-in map is 732 labels, **names only, no descriptions**, and its first line excludes the entire hardware register file. `memmap.json` (959 entries, 4 published sources) is the source and is pinned by `memmapSha256` upstream of the enum path | `memmap.json`, sole source |
| **A GUI / an interactive TUI disassembler** | Every comparable RE tool has one | No consumer. The interaction model is a Claude session driving CLI/MCP tools; an LLM does not use a GUI. Already rejected in v0.6.0 research | The `anno_*` MCP surface |

---

## Question-by-question findings

### (a) Reproducible capture of a running / depacked program

**What practitioners actually do.** RECALLED / READ-IN-SOURCE, MEDIUM confidence:
there are four live routes in the community, and they are not equivalent.

1. **VICE monitor `bsave`/`save` at a breakpoint** — the classic. Flat range dump
   straight to a file. `save` prepends a two-byte load address, `bsave` does not.
   READ-IN-SOURCE (monitor manual). CPU view, host-side write. See the
   anti-feature row.
2. **`.vsf` snapshot** — the `C64MEM` module is mandatory and holds the RAM.
   RECALLED, corroborated by this repo's own MEASURED slicing work. This is the
   route the project has already validated and the one its Active requirement
   names.
3. **Emulating unpackers** (`unp64`-class, and browser tools auto-depacking
   370+ packer formats) — run the program in a private 6502 emulation until the
   unpack routine completes, then dump. RECALLED. Strictly a *tool substitution*
   for the depack-by-running route this project already owns; dropped by owner
   decision.
4. **Freezer cartridges** — historically the origin of the whole practice.
   RECALLED. Anti-feature here.

**What determines whether two runs are equivalent — and what the community
considers good enough.** The honest finding is that the community has **no
formalised equivalence bar at all.** No source surveyed records stop coordinates,
publishes a divergence allowlist, or diffs two independent captures of the same
release. Practitioners re-run and eyeball, because their goal is "a dump I can
disassemble", not "a dump another run reproduces". LOW confidence on the absence
(you cannot prove a negative from a web search), but nothing surfaced that
contradicts it.

**This project has already gone past that bar, and its measurement is the most
valuable single datum in this research.** MEASURED (repo, 2026-08-26),
snapshot-to-snapshot with no transcription anywhere:

| runs | where they stopped | result |
|---|---|---|
| `danish` r1 vs r2 | `hit_count` 1 and **2** — different frames | **201** multi-bit divergences |
| `saeger` r1 vs r2 | both `hit_count` 1 — same frame | **1** multi-bit difference (`$00F6`, the KERNAL keyboard-decode-table pointer) |

Plus 41 single-bit drifts, all passing. So: **frame index is the dominant term,
intra-frame position costs one-bit drift.** That reduces the whole feature to one
requirement — land the same frame — and it tells you what the equivalence
predicate must tolerate.

**Table stakes vs differentiator, plainly:**
- *Table stakes:* the `.vsf` slice, the manifest, and the predicate with a named
  allowlist. All three are cheap and two are half-built.
- *Differentiator:* the constructed frame counter over `stopwatch`, over the
  already-allocated never-dialed `-remotemonitor` port. Nothing in the community
  does this because nobody in the community needs two runs to compare.

**One caution from this session.** My own attempt to drive `-remotemonitor` live
returned empty responses on the first try — most likely because a `/dev/tcp`
readiness probe consumed the monitor's **single client slot** (stock VICE's
monitor services exactly one client; a second `connect()` sits unserviced with no
reply and no EOF, indistinguishable from a wedge). Whoever builds the text-monitor
client should treat readiness probing as part of the protocol, not as a
precondition to it. MEASURED (session, negative result).

### (b) dxa's discovery pass, and the alternatives

**What a 6502 discovery pass produces in practice, and the table stakes for it:**
a per-byte code/data partition, a routine entry-point set, and an address-table
list with resolved targets. That is exactly dxa's output surface — and it emits it
as **assembler source text with no structured format** (READ-IN-SOURCE, man page),
which is why `DXA-03`'s refusing parser is not optional polish.

| Tool | Produces a machine-readable code/data map? | What it gets wrong on packed / cracked C64 code | Verdict |
|---|---|---|---|
| **dxa** 0.1.5 | **No** — listing only. `-a dump` is the most parseable mode | Errors run the *dangerous* direction: data called code. Re-measured on a rebuilt fixture at a pinned dxa: **3 false positives**, `72.39%` data recovery (97/134), and `FIXTURE_REPRODUCED: no` — the pivot's own `72.46%` / **0-FP** headline **does not reproduce**, because the fixture's 141/138 partition was not source-derivable and flattered dxa exactly where the headline lived. There is still **no real-release number at all**. MEASURED (repo, Phase 23) | **The discovery engine.** Only tool producing a map from nothing; only one covering illegal NMOS (`-p all-nmos6502`). Dormant (2022-03 tarball, 0.1.5, 3,417 lines C, GPLv2+, in no Debian package), so vendor and build at a pinned version |
| **da65** (cc65) | Only as *input* (`.info`), never as output | With no `.info` it does a flat linear decode — 6 `.byte` lines on the pivot fixture. MEASURED (repo). This session, given a hand-written `.info`, it correctly resolved an `ADDRTABLE` to a label and minted `L1040` for an out-of-listing target — so it renders well and discovers nothing | **A renderer, not a discoverer.** And the wrong renderer for this project (§ c) |
| **the external analyser** (what the question calls "regenerator") | Yes, in its own project file | Fresh bootstrap gave a flat linear decode with every data table rendered as garbage instructions (9 `!byte` lines total). MEASURED (repo, 2026-08-24) | **Already evaluated, already integrated, already deleted in v0.7.0. Not a candidate. Do not re-scope.** |
| **Ghidra alone** | Yes, once it has anything to work with | With zero hints on a headerless 6502 image: **0 functions, 0 code bytes, 1 ASCII string.** MEASURED (repo). Also 57 documented instructions only, no illegal-opcode handling whatsoever — MEASURED (session) | **The semantic engine, downstream of dxa.** Not a discovery engine on this architecture |
| **IDA's 6502 loader** | Yes (the IDB) | RECALLED, LOW: a processor module exists; no headless-scriptable C64 loader surfaced in the community record | Anti-feature: a new paid prerequisite replacing the Ghidra half with no measured gain |
| **`disasm6502`, `dasm`** | No | RECALLED, LOW: `dasm` is an *assembler*, not a disassembler; `disasm6502` is a small script with no project model | Not viable |
| **6502bench SourceGen** | Yes — `.dis65` | RECALLED/READ-IN-SOURCE: Windows/WPF interactive GUI | Anti-feature as a pipeline stage; **excellent design prior art** for § (d) |
| **VICE's own `memmapshow`** | Yes, as text, and it is *execution-derived* rather than inferred | Coverage is a lower bound on code — an untaken branch is code the run never visited | **The under-used differentiator.** See the differentiators table |

**Feedback into dxa is a file-generation task, not engine work.** `-B <file>` and
`-R <file>` read data-block and routine lists from files (READ-IN-SOURCE), so the
pasted design's "generate a new dxa invocation/hints" pass is two text writers.
Cheap. Do it.

### (c) da65 `.info` as an output contract — **ANTI-FEATURE**

**What `.info` actually expresses.** READ-IN-SOURCE (cc65 da65 users guide),
cross-checked against the installed binary's string table (MEASURED, session,
`da65 V2.18 - Debian 2.19-2`):

- `GLOBAL` — 17 formatting/IO options (`CPU`, `STARTADDR`, `COMMENTS`, column
  positions, `INPUTOFFS`/`INPUTSIZE`, `NEWLINEAFTERJMP`/`RTS`…)
- `RANGE { START; END; TYPE; NAME; COMMENT; UNIT; ADDRMODE }`
- `LABEL { ADDR; NAME; COMMENT; SIZE; PARAMSIZE }`
- `SEGMENT { START; END; NAME }`
- `ASMINC { FILE; COMMENTSTART; IGNOREUNKNOWN }`
- and the complete `RANGE TYPE` vocabulary, exactly nine values:
  `ADDRTABLE BYTETABLE CODE DBYTETABLE DWORDTABLE RTSTABLE SKIP TEXTTABLE WORDTABLE`

**What it cannot express that the store can — five measured failures, one decided.**

1. **No split, struct, pointer-pair or record type.** `grep -iE 'struct|split|pointer|ptrtable'`
   over the binary's strings returns **zero**. MEASURED (session). Verified
   behaviourally the same session: given `tab_lo`/`tab_hi` as two `BYTETABLE`
   ranges, da65 emitted two unrelated `.byte` runs and left the `jmp (ptr)`
   target unresolved. The store's frozen vocabulary has **12** members *with the
   four split layouts as first-class members* — the milestone's one irreversible
   decision. Exporting through `.info` throws away exactly the members that cost
   the most to get right.
2. **A comment cannot exist without a symbol.** `LABEL { ADDR $1005; COMMENT "…"; }`
   with no `NAME` is a hard error — `c.info(4): Error: Label name is missing`,
   exit 1. MEASURED (session). The auto-annotation feature's *entire output* is
   comments on machine addresses (`$d020  Border color (only bits #0-#3).`).
   Rendering them through `.info` would force a minted label per annotated
   address, corrupting the symbol namespace to carry comment text.
3. **`TYPE SKIP` emits nothing at all**, so the byte-for-byte rebuild the whole
   back half exists to enable is **silently wrong**. MEASURED (session):
   `grep -nE '\.res|\.org|\.segment'` over da65's output → nothing; ca65 + ld65
   assembled cleanly and produced a binary differing at byte 2 — the 18-byte hole
   collapsed and `lda tab_lo,x` re-assembled as `$100E` instead of `$1020`. A
   clean assemble over a wrong binary is this project's canonical failure shape.
4. **`PARAMSIZE` — the one construct the pasted note names it for — did not
   fire.** Present in the V2.18 binary and parses without error, with or without a
   covering `TYPE Code` range. MEASURED (repo, 2026-08-24).
5. **Wrong assembler.** It emits ca65. This project's toolchain, its shipped
   exporter and its only real-assembler oracle are all ACME, and multi-assembler
   output is **already Out of Scope by owner decision**.
6. **Wrong goal.** `.info` → `da65` → `ca65`/`ld65` → `cmp` serves byte-for-byte
   reconstruction, which the pivot decision explicitly rejected as the goal
   ("source quality and functionality"; rebuilding is a separate later step) and
   which v0.6.0's research showed is structurally *undefinable* here — there is no
   canonical original binary, only a provenance-graded composite with ranges
   honestly `UNKNOWN`.

**Verdict: anti-feature. Do not build a `.info` generator.** The render stage
already exists (`anno export-asm`) and the byte-level oracle already exists
(`acme-verify.ts`, real ACME 0.97, test-only by a committed assertion, observed
refusing on both a missing assembler and a corrupted byte).

**Where to point the impulse instead.** If the underlying wish is a
*third-party-readable interchange artifact*, `.info` is a poor choice on
expressiveness alone. The interchange gap that actually has users is the
**withdrawn VICE `.lbl` symbol round trip** (`ANNO-14`/`ANNO-15`) — a Validated
capability with **no route and no owning phase** today. That is a better use of
the same effort and it closes a known regression.

### (d) The three-file output contract

**`program.asm` — table stakes, already shipped.** Do not re-scope.

**`program.json` — anti-feature as a persisted artifact, table stakes as a
rendering.** The proposal's own framing already contains the answer: it asks
whether the post-script should "write directly into the store … making `.asm` a
rendering of the store rather than a third parallel output that can drift from
it." Yes. That is the right instinct and every comparable pipeline agrees:

| Pipeline | Authoritative model | Rendered views | Evidence kept separately? |
|---|---|---|---|
| **6502bench SourceGen** | `.dis65` project file, which stores **only metadata — none of the disassembled file's data** | "Generate Assembly" per target assembler; "Export" to text / CSV / HTML "as it appears on the screen" | n/a — no second model persisted. READ-IN-SOURCE / RECALLED |
| **Ghidra** | the project database | decompiled C, listing export, XML export | the analysis log |
| **Mesen CDL (NES)** | the annotation project | generated listings | **yes** — the CDL is a pure per-byte execution-evidence file, deliberately *not* the annotation model. RECALLED |
| **This project** | `.annostore` | `anno export-asm`, `--json` | the `.vsf`, the dxa listing, the Ghidra export |

The unanimous pattern is **one model, generated views, and evidence files kept
strictly outside the model.** So: the dxa listing and the Ghidra export are
*evidence*; `.annostore` is the model; `.asm` and `--json` are views. A persisted
`program.json` sitting between them is a fourth model, and drift between two
copies of the same fact is the failure this repo already spends six
`docs-*.test.ts` guards and a both-directions-derived ledger defending against.

**One correction the proposal's wording needs, and it is architectural, not
stylistic.** "The Ghidra post-script writes directly into the store" cannot be
implemented literally. The post-script is a **JVM on the host**; the store is
**container-side behind the proxy**, reached through one seam with a single-owner
write path, and the `anno_*` family is registered proxy-locally through
`buildViceTool()` specifically so it never reaches `forwardToVice()`. A host-side
JVM calling into it would invent a second write path into the store and cross the
container boundary outside `hostpath.ts`/`containerpath.ts`. The implementable
shape is:

```
Ghidra post-script (host JVM)
    └─> transfer file (host)
            └─> container-out seam
                    └─> importer (container-side)
                            └─> the one store seam  ──> .annostore
```

and the transfer file is **consumed and deleted within the same command**, so it
is never a durable fourth artifact. That also lands squarely on the open question
the todo already flags: Ghidra is not a stateless short-lived tool like `c1541`
or `acme`, and megabyte-scale exports cannot ride the broker's 64 KiB line cap.
**Decide the execution seam before the post-script is written** — it determines
the transfer mechanism, which determines the post-script's output format.

### (e) Automatic machine-address annotation

**Expected behaviour.** For every recovered cross-reference: if the target is
inside the loaded image, skip it (it is a program address). Otherwise resolve the
bank state at that program point from the recovered `$01` literals, then select
the **narrowest** `memmap.json` range containing the address under that bank
state, tie-breaking toward the entry carrying a `sym`, and write a comment into
the store. Where the bank state is path-dependent, write nothing and say why.
Report annotated and skipped counts, and read the result back **out of the
store**, not out of the pipeline's stdout.

**Why each rule exists — all three were got wrong first, and all three failed
silently.** MEASURED (repo, 2026-08-24):
- Selecting by description length or first match yields the useless
  4096-byte "I/O Area" entry over the 1-byte "Border color (only bits #0-#3)".
- Without the image-range check, in-program loop-back branches land inside
  "Default BASIC area (38911 bytes)" and get annotated as machine features — two
  did.
- Without bank resolution, `$d020` under `$01 = $34` is annotated as the border
  colour when it is RAM, and `$d000` under `$33` as sprite-0-X when it is
  Character ROM.

**What the comparables do.** RECALLED (LOW confidence, single-tier web):

| Tool | Mechanism | Bank / overlay handling | Optimistic or declines? |
|---|---|---|---|
| Ghidra SVD-Loader | Parses a CMSIS-SVD device file, creates a memory block per peripheral, applies typed structs and bitfields | None. ARM Cortex-M peripherals are not banked. Platform forks (e.g. RP2040) exist precisely because address ranges needed **hand** customisation | **Optimistic, unconditional** |
| radare2 | SVD import flags and names memory-mapped registers; 8051 support hard-codes per-variant memory maps in `cpu_models[]` | A *static* per-variant selection chosen at load time | **Optimistic, unconditional** |
| IDA | processor-module device definitions auto-name SFRs | Device chosen once, at load | **Optimistic, unconditional** |
| Ghidra overlay blocks | overlay memory blocks per bank | A static configuration the analyst selects | **Optimistic, unconditional** |
| VICE `memmapshow` | reports *observed* access class per address (`io`/`ROM`/`RAM`, execute a separate bit) | Reports what actually happened rather than predicting | **Declines by construction** — it only reports observation |

Two conclusions worth carrying into the roadmap:

1. **No comparable tool declines, and none carries per-program-point state.** The
   closest analogues are a static per-variant map or a static overlay selection.
   So this feature has **no prior art to copy and none to validate against** —
   which is the strongest possible argument for `AUTO-02/03/04`'s
   control-observed-red discipline, and for `PROOF-03` (where a single
   forward-carried `$01` stops being correct) being a real measurement rather
   than a footnote. It has never been measured in either direction.
2. **`memmapshow` is the one comparable that would corroborate the join
   independently.** Its `io` bit tells you which addresses the run actually
   resolved to I/O rather than RAM — an execution-derived check on precisely the
   bank decode the join makes statically. That is the missing external oracle for
   `AUTO-04`, and this project's own record is that an external check finds what
   an internal one cannot, six times over.

Two gaps stay carried, and no plan should quietly promise either: **sprite bitmap
locations** (the pointer values are program data usually written at runtime, so
they are not register values Ghidra recovers) and the **second VIC banking axis**
under path-dependent state. Also: one graphics map per *program point*, not per
program — a program switching charset per raster split has several valid maps and
a single derived map is wrong for all but one.

### (f) Decompiler output on 6502

**What `DecompInterface` is genuinely indispensable for — table stakes.** It is
the **only** route to the structural facts, because the listing layer has none of
them. MEASURED (repo, 2026-08-24), same fixture, same run:

```c
} while (param_1 != 0x20);                          // array bound  -> byte[32]
DAT_00fb = (code *)CONCAT11(DAT_08b0,DAT_08ad);     // split pointer, typed code*
param_1 = param_1 + 5;  if (param_1 == 0x19) return; // record stride 5
```

against `DataTypeManager.getAllComposites()` / `getDefinedData()` returning
essentially nothing on the same program. So the decompiler **layer** is table
stakes as a fact source.

**What the C *text* will actually look like, and why it disappoints.**
- Zero-page globals render as `DAT_00fb`, `DAT_0001`, `DAT_d020` — MEASURED
  (repo), from the volatile-fixture transcript.
- RECALLED (LOW, community): the named 6502 failure mode is that when Ghidra
  resolves a register+constant addressing mode's effective address it treats that
  single byte as the object of interest and mints a symbol for it — destroying the
  array/index shape that is the whole point on 6502. Consistent with the
  `DAT_xxxx`-per-address shape above; not independently verified here.
- Structurally: hand-written 6502 was never compiled from C, so **there is no
  original C shape to recover.** Decompilation-to-C as a discipline belongs to
  compiled-from-C targets. v0.6.0's own research already reached this conclusion
  and classified "producing C instead of assembly" as an anti-feature for the
  rebuild goal.
- The volatile carve is what makes the C **correct** and also what makes it
  **uglier** — every I/O access re-read rather than folded. Nobody should tune the
  carve to improve readability. That trades correctness for prose on a silent
  failure mode.

**Recommended acceptance bar, stated so it can actually be met.** Do **not**
accept `program.c` on its readability. Accept the decompiler pass on
`GHID-04`'s five structural facts recovered from a **real** binary — an array
bound, the `CONCAT11` split-pointer idiom, a record stride, ≥1 resolved computed
jump, ≥1 self-modifying write target — plus every cross-reference carrying its
access kind, plus a committed control proving the same export routed through
`DataTypeManager` returns essentially nothing. The C text may be emitted (it costs
nothing once `DecompInterface` is open, and it is the human-readable evidence
*behind* each fact), on three conditions: it is labelled derived evidence, it is
never an input to the store, and it is never one of three co-equal deliverables.

**Verdict: nice-to-have, and framed wrongly in the proposal.** `program.c` is the
proposal's most attractive output and its least defensible one.

---

## Feature Dependencies

```
Frame-exact stop
    ├──requires──> constructed frame counter over `stopwatch`
    │                  └──requires──> a text-monitor client
    │                                     └──requires──> the already-allocated
    │                                                    -remotemonitor port
    │                                                    (nothing has ever dialed it)
    └──must preserve──> vice-sync.ts invariants
                          (exactly one resume per wait; poll on hit_count)

Depacked flat 64K capture
    ├──requires──> vice_snapshot_save  (SHIPPED, both backends)
    └──requires──> .vsf C64MEM slicing (VALIDATED, throwaway script exists)

Equivalence predicate
    ├──requires──> capture manifest (stop coordinates)
    └──requires──> Frame-exact stop        <-- otherwise it always says "not equivalent"

Real-release measurement (PROOF-01..03)
    ├──requires──> Depacked capture + Equivalence predicate
    ├──requires──> a vendored, pinned dxa build      <-- NOT INSTALLED
    └──requires──> a pinned, committed Ghidra harness <-- present only as an
                                                          out-of-tree probe unpack

dxa code/data map
    ├──requires──> vendored pinned dxa
    └──requires──> refusing listing parser (DXA-03)

Ghidra semantic pass
    ├──requires──> dxa's map as hints   <-- NOT an optimisation: zero hints = zero output
    ├──requires──> volatile I/O carve   <-- correctness requirement, fails silently
    ├──requires──> DecompInterface export (never DataTypeManager)
    └──requires──> SLEIGH illegal-opcode extension, sequenced AHEAD of the acceptance run

SLEIGH extension
    └──must NOT edit 6502.slaspec directly:
           65c02.slaspec line 1 is `@include "6502.slaspec"`, so anything added to
           6502.slaspec is inherited by 65C02:LE:16:default and collides with its
           documented meanings. The extension needs a THIRD slaspec that includes
           6502.slaspec, with its own language id.       [MEASURED, session]

Auto-annotation join
    ├──requires──> typed xrefs with access kinds (Ghidra pass)
    ├──requires──> memmap.json, pinned by memmapSha256   (SHIPPED)
    ├──requires──> the store write seam                  (SHIPPED)
    ├──requires──> bank-state decode from recovered $01 literals
    │                  └──requires──> the volatile carve  <-- no volatile, no $01 literals
    └──contained by──> the VIC-DMA graphics map (AUTO-07/05), NOT by a review step

memmapshow execution map
    ├──requires──> the same text-monitor client as the frame counter
    └──enhances──> dxa map (independent oracle), AUTO-04 (independent bank oracle)

program.json (persisted)  ──conflicts with──>  .annostore as the single model
da65 .info generator      ──conflicts with──>  the store's 12-member type vocabulary
                                               AND with anno export-asm
```

### Dependency notes worth acting on

- **The text-monitor client is the keystone.** It is a dependency of the frame
  counter (the frame-exact stop), of the `memmapshow` execution map (dxa's
  independent oracle), of runtime warp (corpus sweeps), and of the `chis` cycle
  history that stock's binary monitor cannot give below VICE 3.10. One MEDIUM
  component unblocks four features, and the port it needs has been open and
  allocated on every stock launch since Phase 3 with nothing dialing it.
  Sequence it first.
- **The volatile carve gates the auto-annotation join, not just the C output.**
  Without volatile, Ghidra deletes the `$01` writes, so the bank state the join
  needs does not exist to be recovered. `AUTO-04` is downstream of `GHID-03`
  by a hard dependency, not by convenience.
- **The SLEIGH extension must precede the acceptance run**, as `ROADMAP.md`
  already states — but add the measured layering constraint above, because the
  obvious implementation (append to `6502.slaspec`) is the one that breaks 65C02.
- **Tool acquisition is a dependency, not setup.** Nothing measurable happens
  until dxa is vendored and built and Ghidra is pinned inside a committed harness.

---

## MVP Definition

### Launch with (this milestone's core)

- [ ] **Text-monitor client** — one channel, one serialization discipline, respecting
      the same halt semantics as the binary monitor. Unblocks four features.
- [ ] **`.vsf` `C64MEM` slice + capture manifest** — the substrate, plus the stop
      coordinates that make equivalence decidable.
- [ ] **Frame-exact stop** via a constructed `stopwatch` frame counter, behind the
      pre-committed go / degrade / no-go gate whose rules are committed before any
      measurement (the Phase 23 pattern).
- [ ] **Equivalence predicate with a named divergence allowlist** — `$00`/`$01`,
      `$00F6`, and the single-bit drift set.
- [ ] **Vendored, pinned dxa + a listing parser that refuses by name.**
- [ ] **Pinned Ghidra harness**: volatile carve with a control observed **red**,
      `DecompInterface` export with a `DataTypeManager` control observed **empty**,
      access-kinded cross-references, and the SLEIGH extension in a third slaspec.
- [ ] **Auto-annotation join** into the store: narrowest-range-wins, in-image skip,
      bank-before-address, decline-with-reason, counts reported, read back from the
      store — each of the three rules with its own control observed red.
- [ ] **`--json` on stdout, rendered from the store.**

### Add after validation

- [ ] **`memmapshow` execution map** as an independent oracle on dxa's false
      positives and on the join's bank decode. Trigger: the text-monitor client
      exists and `PROOF-01` has produced its first real-release number.
- [ ] **Headless launch mode + runtime warp for corpus sweeps.** Trigger: one
      release measured end to end, and a second release wanted.
- [ ] **VIC-DMA graphics map fed back to dxa `-b` and Ghidra.** Trigger: phantom
      labels observed in a real-release run (they will be).
- [ ] **The withdrawn `.lbl` symbol round trip** (`ANNO-14`/`ANNO-15`) — a
      Validated capability with no route and no owning phase. Better value than any
      new interchange format.

### Future consideration

- [ ] **Event-history replay as a determinism route.** Defer: VICE's own manual
      disclaims accuracy, and it records user input rather than a depack path.
- [ ] **`program.c` emission as labelled derived evidence.** Defer: zero value
      until the five structural facts are landing from real code.
- [ ] **Iterating dxa ↔ Ghidra to convergence** (the proposal's `max_passes: 10`
      loop). Defer: build pass 1 → pass 2 as a *single* feedback step first and
      measure whether pass 3 changes anything. An unbounded convergence loop over
      a model with invented confidences is a way to spend a milestone.

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---|---|---|---|
| Text-monitor client | HIGH (unblocks 4) | MEDIUM | **P1** |
| `.vsf` slice + capture manifest | HIGH | LOW | **P1** |
| Frame-exact stop (constructed frame counter) | HIGH | HIGH | **P1** |
| Equivalence predicate + allowlist | HIGH | MEDIUM | **P1** |
| Vendored pinned dxa + refusing parser | HIGH | MEDIUM | **P1** |
| Volatile carve with a red-observed control | HIGH | LOW/HIGH to prove | **P1** |
| `DecompInterface` export + `DataTypeManager` control | HIGH | MEDIUM | **P1** |
| SLEIGH extension in a third slaspec | HIGH | MEDIUM | **P1** |
| Auto-annotation join + three red controls | HIGH | MEDIUM | **P1** |
| `--json` from the store | MEDIUM | LOW | **P1** |
| `memmapshow` execution oracle | HIGH | MEDIUM | **P2** |
| Headless + runtime warp sweeps | MEDIUM | MEDIUM | **P2** |
| VIC-DMA graphics map feedback | HIGH | HIGH | **P2** |
| `.lbl` symbol round trip restoration | MEDIUM | LOW | **P2** |
| Provenance-per-assertion in the store | MEDIUM | LOW | **P2** |
| Event-history replay | LOW (as primary) | HIGH | **P3** |
| `program.c` as labelled evidence | LOW | LOW | **P3** |
| Unbounded convergence loop | LOW | HIGH | **P3** |
| `da65 .info` generator | **NEGATIVE** | MEDIUM | **anti-feature** |
| Persisted `program.json` | **NEGATIVE** | LOW | **anti-feature** |
| Float confidence merging | **NEGATIVE** | MEDIUM | **anti-feature** |
| `-limitcycles` as a capture stop | **NEGATIVE** | LOW | **anti-feature** |
| `bsave` as the capture route | **NEGATIVE** | LOW | **anti-feature** |

---

## Assessment of the two pasted proposals

Both are LLM-authored, unprobed, and not primary sources. Both were read as data.

### `docs/dissambler-workflow.md`

| Part | Assessment |
|---|---|
| Normalize first; every analyser agrees byte 0 == `$0801` | **Adopt.** Already half-present as `SCHEMA.md`'s corpus/capture keys |
| dxa discovers, Ghidra understands | **Adopt — it is already this project's decided pivot.** Not new |
| "Your own analysis model is authoritative; tool outputs are derived artifacts" | **Adopt, and it is the proposal's single best idea.** Also already true: `.annostore` is that model |
| Keep facts and hypotheses separate; record *why* | **Adopt the provenance half.** Reject the scalar-confidence half |
| Float confidences merged by noisy-OR | **Reject.** Invented numbers, dependent sources, a second unproven paint over an exact one |
| Feed knowledge back into dxa (`-B`/`-R`) | **Adopt.** Two text writers |
| Structural inference (arrays, split pointers, dispatch, records, strings, inline params) | **Adopt the taxonomy** — it matches the store's 12-member vocabulary well. But Ghidra's `DecompInterface` already yields the bound, the split pointer and the stride, so much of this is *reading Ghidra's answer*, not re-deriving it |
| `da65 .info` generator → `da65` → `ca65`/`ld65` → `cmp` | **Reject in full.** Six reasons in § (c), five measured this session |
| "Add an optional dynamic evidence source eventually" | **Promote, don't defer.** It is available today over an already-open port, and it is the only independent oracle this pipeline has |
| Python implementation, `run.py`, YAML overrides | **Reject the shape.** This project is Node ≥ 24 with no build step for the shipped server, and the store already is the override layer |
| "Design the `analysis.json` schema before writing integration code" | **Sound advice, wrong artifact.** The schema already exists — it is `.annostore` |

### The Ghidra one-command wrapper todo

This one already carries its own corrections and they are correct. Adding to
them:

- The **three-file contract** is genuinely the new idea, and § (d) resolves it:
  `.asm` shipped, `.json` a rendering not an artifact, `.c` derived evidence not a
  deliverable.
- Its `--entry-address` interface is **weaker than what already exists** — the
  todo says so, and MEASURED zero-hint output (0 functions, 0 code bytes) proves
  it.
- Its language-id claim `6502:LE:16:default` is **confirmed** against the real
  12.1.3 install (MEASURED, session, `6502.ldefs`).
- Its SLEIGH point is **already owned**, and this research adds the layering
  constraint it does not state: `65c02.slaspec:1` is `@include "6502.slaspec"`, so
  the extension must not go into `6502.slaspec`.
- The **execution-seam question it declines to settle is load-bearing for the
  post-script's output format**, so it must be answered before the post-script is
  written, not after.

---

## Sources

**MEASURED this session (2026-09-02), on this host**
- `da65 -V` → `da65 V2.18 - Debian 2.19-2`; `strings` exact-line scan of `/usr/bin/da65`
- da65 behavioural runs on a purpose-built 44-byte split-pointer fixture: split-table
  rendering, `LABEL` without `NAME` → `Error: Label name is missing`, `TYPE SKIP`
  emitting no directive, and the resulting ca65+ld65 rebuild differing at byte 2
- `/usr/bin/x64sc --version` → `x64sc (VICE 3.9)`; `-help` scan for
  `-limitcycles` / `-exitscreenshot` / `-warp` / `-console` / `-event*`
- `strings /usr/bin/x64sc` → `memmapshow`, `memmapsave`, `memmapzap`, `cpuhistory`,
  `chis`, `stopwatch`, `profile`
- Ghidra 12.1.3 install at `/home/henrik/dev/_ghidra-probe/`: `6502.slaspec` 57
  constructors / 500 lines, `65c02.slaspec` 28 / 222 with line 1 `@include "6502.slaspec"`,
  `6502.ldefs` ids `6502:LE:16:default` and `65C02:LE:16:default`, no
  `illegal`/`undoc`/`unstable` handling in `6502.slaspec`
- Host tool inventory; `dxa` absent under `/home`, `/opt`, `/usr/local`
- Negative result: a `/dev/tcp` readiness probe against `-remotemonitor` appears to
  consume the monitor's single client slot

**MEASURED in-repo (dated, committed)**
- `.planning/notes/dxa-ghidra-pivot.md` (2026-08-24) — the four-tool comparison table
- `.planning/notes/ghidra-volatile-io-and-banking.md` (2026-08-24) — the dead-store
  deletion and the recovered `$01` literals
- `.planning/notes/auto-annotation-from-ghidra-xrefs.md` (2026-08-24) — 18/18 join, three rules
- `.planning/notes/text-monitor-channel-live-probe.md` (2026-08-27) — `warp`, `sw`,
  `chis`, `memmapshow`, `prof`, `bt`, `io`, and the halt semantics, on genuine stock 3.9
- `.planning/todos/pending/2026-08-26-frame-exact-emulator-stop-is-unowned.md` — the
  201-vs-1 divergence table
- `.planning/todos/pending/2026-08-26-extract-flat-64k-from-vice-snapshots-instead-of-transcribing-hex.md`
  — `C64MEM` layout and the range-by-range validation
- `docs/phase23-real-release-gate-findings.md` via `ROADMAP.md` Phase 26 notes —
  `FIXTURE_FALSE_POSITIVES: 3`, `FIXTURE_DATA_RECOVERY_PCT: 72.39`, `FIXTURE_REPRODUCED: no`
- `.planning/phases/23-*/evidence/` — `ExportAnalysis23.java`, `FlatVolatile.java`,
  `dxa-listing-parse.mjs`, `SCHEMA.md`, `tools/instrument-provenance.txt`
- `.planning/research/archive-v0.6.0/FEATURES.md` — the byte-identity and
  C-output-as-anti-feature findings

**READ-IN-SOURCE (primary docs)**
- [da65 Users Guide](https://cc65.github.io/doc/da65.html) — options, info-file
  attributes, the nine `RANGE TYPE` values, `PARAMSIZE`
- [dxa(1) man page](https://www.gsp.com/cgi-bin/man.cgi?section=1&topic=dxa) — the
  full flag set; no machine-readable output
- [VICE Manual ch. 11, Event history](https://vice-emu.sourceforge.io/vice_11.html) —
  what is recorded, `start.vsf`/`end.vsf`, `EventStartMode`, the accuracy caveat
- [VICE Manual ch. 12, Monitor](https://vice-emu.sourceforge.io/vice_12.html) —
  `memmapshow` mask `ioRWXrwx`, `memmapsave` as a picture, `save`/`bsave`,
  `dump`/`undump`, `cpuhistory`, `stopwatch`
- [VICE Manual ch. 2, Invoking](https://vice-emu.sourceforge.io/vice_2.html) — `-limitcycles`

**RECALLED (web search, LOW confidence, single-tier)**
- [VICE Manual ch. 9, Snapshots](https://vice-emu.sourceforge.io/vice_9.html) and Lemon64
  threads on dumping/dissecting snapshots — practitioner capture routes
- [UNP64](https://commodore.software/downloads/download/81-programming-tools/204-unp64-v2-31),
  [Restore 64](https://restore64.dev/) — emulating-unpacker practice
- [SVD-Loader-Ghidra](https://github.com/leveldown-security/SVD-Loader-Ghidra),
  [RP2040 fork](https://github.com/wejn/SVD-Loader-Ghidra-RP2040),
  [radare2 8051 notes](https://book.rada.re/arch/8051.html) — peripheral annotation practice
- [6502bench SourceGen manual](https://6502bench.com/sgmanual/intro.html),
  [Generating Code](https://6502bench.com/sgtutorial/generating-code.html) — the
  `.dis65` metadata-only model
- [Retro Reversing: NES with Ghidra](https://www.retroreversing.com/nes-ghidra),
  [stardot thread on the Ghidra disassembler](https://stardot.org.uk/forums/viewtopic.php?t=16692)
  — 6502 decompiler quality reports

---
*Feature research for: frame-exact capture + the two engines (v0.8.0)*
*Researched: 2026-09-02*
