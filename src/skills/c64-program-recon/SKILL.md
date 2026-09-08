---
name: c64-program-recon
description: Work out how an unknown C64 program is structured at runtime — entry point, interrupt handlers, main loop, game states, graphics and sound — in a fixed order, before disassembling anything. Use when asked to reverse engineer a C64 game, find the main loop, entry point or IRQ handler, locate the player sprite, charset or music player, identify a game state machine, work out which memory regions are code versus data, or decide where to start on a depacked image.
---

# Reconnaissance on an unknown C64 program

**Do not disassemble the whole program first.** The structure hangs off a small fixed set of
well-known addresses: read them in order and the answer falls out. Treated as a search problem it
costs an hour every session; written down it is minutes.

Build a network of confirmed facts. Once the vectors, the IRQ handler, the main loop and the major
tables are known, everything else classifies far more easily.

```bash
D=src/skills/c64-program-recon/scripts/derive.mjs   # from the repo root

node $D vectors dump.bin                                # $01 + six vectors, which pair is live
node $D vic --dd00 3E --d018 18 --d011 1B --d016 C8     # bank, screen, charset, mode
node $D sprites --dd00 3E --d018 18 --d015 0F --ptrs 20,21,22,23,FF,FF,FF,FF
```

The script does only the arithmetic that a lookup table cannot — register bits to concrete
addresses — over values **you** fetched through `mcp__plugin_c64-re-tools_vice__*`. It contacts nothing.

## Before disassembling anything

Two adjacent jobs belong to other skills, and pointing at their owners is cheaper than re-deriving
either one here:

- **A file still sitting inside a `.d64` image** — its directory, block allocation map, sector
  chain, or raw bytes — is `c64-disk-access`'s job. Get the file out of the image there first.
- **A tokenized BASIC stub rather than raw machine code** — detokenizing it and finding where it
  hands over to machine code, including the named decline when no static handover address exists —
  is `c64-petcat`'s job. See below for the one thing it does not also do.

## The order

Each step is a read whose answer rules something out. Do not skip ahead: step 6 is cheap once the
handler is known, because that is where most chip writes happen.

| # | Question | Read | What the answer settles |
|---|---|---|---|
| 0 | Which of these bytes are even the game? | The manifest's buckets — `c64-provenance-diff` | Tracing a depacker's IRQ handler is wasted work. Scope before you trace |
| 1 | Where does execution start? | Post-depack: wherever the PC sits at the decrunch checkpoint. There is no BASIC stub to find. | The one address everything else hangs off |
| 2 | Which vector is live? | `$01`, then `$0314/$0315` **or** `$FFFE/$FFFF` | HIRAM (`$01` bit 1) decides. KERNAL out ⇒ the RAM vectors are meaningless |
| 3 | What drives the frame? | `$D01A`, `$D012`, `$DC0D` | `$DC0D` untouched ⇒ raster IRQ; programmed ⇒ the game runs its own timebase |
| 4 | Where is the main loop? | Checkpoint a suspected loop head, run one frame | Two shapes only: a real loop, or a two-instruction spin with the IRQ doing everything |
| 5 | Code or data? | What the PC actually visits across full coverage | A range never executed is data, whatever a tracer guessed |
| 6 | Where is the graphics? | `$DD00` → `$D018` → mode bits → `$D015` → VM+`$03F8` | Every displayed byte, computed. Nothing to search for |
| 7 | Where is the music? | Watch `$D404` | `init` runs once from main code; `play` runs once per frame from the IRQ |
| 8 | Where is the input? | Reads of `$DC00`/`$DC01` | Games poll the matrix directly and ignore the KERNAL buffer |

## Step 0 in full: only the game is in scope

Every image taken from a cracked release carries three layers that are **not the game**, and no
original master exists to strip them for you:

| Layer | What it is | Dead when |
|---|---|---|
| **loader** | The custom raw-sector routine that bypasses the KERNAL | The payload is in RAM |
| **cruncher / depacker** | The decompression stub | It has run once |
| **cracktro** | The group's intro, scroller, credits, and the keypress gate that dismisses it | Dismissed |

**The rule: a byte with nothing to do with the game is out of scope — always, not case by case.**
It is not annotated, not reconstructed, and not traced. This is a standing default, not a
per-session decision.

**The evidence bar runs both ways, and this project has been burned in both directions.**

- Removal needs *positive* evidence of the bucket: a crack-credit vocabulary match, a
  `RELEASES.json` `loader_ranges` entry earned from live disassembly, or a depacker stub provably
  dead after first run. A bare printable-ASCII scan classified **the game's own title text** as
  cracktro credit and would have shipped a confidently-wrong `CRACKER-PATCH` verdict.
- Absence of evidence records `UNKNOWN` and **keeps the bytes**. The
  a real title-screen text divergence was found sitting in a region that is neither loader nor
  cracktro — a cracker edit inside the game's own data. Stripping only the obvious intro screen
  leaves crack residue behind.

`c64-provenance-diff` owns the machinery and the five kinds; do not re-derive them here. What
belongs here is the ordering: **bucket first, then trace only what survives.**

Then work **backwards from observable effects** rather than reading code sequentially — it is
consistently faster. Watch writes to the sprite coordinates to find movement; watch `$D018` to find
the room loader; watch VM+`$03F8` to find the animation driver. `vice_watch_add` finds *writers*,
and that is its real leverage.

Differential experiments close the loop: patch a routine to `RTS` and see what stops. If enemies
freeze and nothing else does, the routine's purpose is confirmed — far stronger evidence than
reading the listing.

## Step 0.5: is it packed, and by what?

Runs **between step 0 and step 1** — after scoping, before you go looking for an entry point.
Tracing a decruncher is the same wasted work as tracing a loader, and every label you write on a
packed image is thrown away the moment the real image is recovered.

```bash
node src/skills/c64-program-recon/scripts/packer-finding.mjs game.prg      # from the repo root
node src/skills/c64-program-recon/scripts/packer-finding.mjs game.prg --entropy 7.83
```

Pass `--entropy` when you already have the number from `anno_get_binary_info`; otherwise the
script measures it from the file. It prints one JSON object. Read the `verdict`:

| Verdict | What it means | What to do |
| --- | --- | --- |
| `identified` | An external oracle stated the packer name, verbatim. `packer` holds it and `confidence` is `HIGH`. | Record the name as a finding. Then depack: run it in the emulator and capture RAM past the decrunch (`c64-ram-capture`). |
| `packed-unidentified` | Entropy is at or above the 7.5 packedness threshold and **no oracle named the packer**. `packer` is `null`. | Treat the image as packed. Depack the same way. Do not annotate these bytes and do not go hunting for a name. |
| `unpacked` | Entropy is below the threshold. Still not an identity claim — it says nothing about which packer, only that these bytes do not look compressed. | Continue to step 1 on this image. |
| `unknown` | No route produced an answer. `unavailableReason` always says why. | Continue, but record the unknown. Never write it up as "not packed". |

**A name is reported only when an external oracle stated one, and this project does not guess.**
No first-party route on this project's surface reports a packer name at all — the dated
investigation that established this, four independent ways, is written out in
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/19-RESEARCH.md` §2, and the
dated decision that fixes the acceptance bar and its re-open trigger is recorded under
`19-DECISIONS.md` in that same directory (SURF-03). So there is no code path here that can write a packer name from entropy, from a
decompression address, or from a byte pattern. If you want a name and the finding does not give
you one, install an external identifier on the **host** and point `UNP64` or `UNP64_PATH` at it in
the environment the host broker process sees — do not infer it. `packer-finding.mjs` never spawns
that identifier itself (Phase 34, SEAM-05): it reaches it only through the host-tool execution
seam (`src/mcp/vice/host-tool.mts`'s `oracle.probe`/`oracle.run` allowlist entries), because this
script runs container-side and there is no container PATH to a host binary on. **The container-side
environment is not consulted at all** (Phase 34, plan 34-08, CR-01): setting `UNP64`/`UNP64_PATH` in
this script's own (container-side) environment adds only a diagnostic hint to an absent result —
it can never select what the host executes. The oracle's location is host-side configuration
only, and the configured path's file name must be the oracle binary's own name (`unp64`) or the
seam treats it as absent.

**The entropy gate answers packedness, not identity.** High entropy tells you the bytes are
compressed (or encrypted, or genuinely random); it does not tell you by what. And the way a packed
image is actually opened up here is the run-and-capture route — run the program under the emulator
and capture RAM at a checkpoint past the decrunch — not an in-place unpack, which would destroy
the comments, labels and blocks the project already holds.

## Worked example — a real capture

```
$ node $D vectors capture.bin
$01 = $40 %01000000
  bit 0 LORAM  = 0  BASIC ROM  out (RAM at $A000-$BFFF)
  bit 1 HIRAM  = 0  KERNAL ROM out (RAM at $E000-$FFFF)
  bit 2 CHAREN = 0  character ROM at $D000-$DFFF

LIVE VECTOR PAIR: $FFFE/$FFFF (KERNAL banked OUT — the hardware vectors are live)
CBM80 SIGNATURE:  absent — nothing catches a reset here

## KERNAL IRQ/BRK/NMI ($0314-$0319)
   DORMANT: KERNAL ROM banked out — nothing maintains these. Read it, do not act on it.
vector        value   default   status
$0314/$0315  $0101   $EA31   *** RETARGETED ***
              CINV  — KERNAL IRQ (RAM, indirect)
…
## Hardware vectors ($FFFA-$FFFF) — live when the KERNAL is banked out
$FFFA/$FFFB  $1116     --     no default
$FFFC/$FFFD  $1116     --     no default
$FFFE/$FFFF  $1103     --     no default

Non-default bytes in DORMANT blocks: 17. These are NOT diverted
vectors. …
```

Read it as: the KERNAL is banked out, so the whole `$0300-$0333` range is **dormant** and `$0314`'s
`$0101` is residue, not a retargeted vector — ignore it. The live handler is `$1103`, and that is
where to arm the first checkpoint. `$FFFA` and `$FFFC` both holding `$1116` says the game installs
its own NMI *and* RESET handlers, at one shared address.

Both cracked releases give the same answers across all three of their captures, and `$1103` is the
same IRQ entry that phase-01 live work established independently (chain `$1103 → $1574 → $152C`).
The method reproduces a known-good result from a static image with no emulator running, and the
`$1116` pair is new — see `references/control-flow.md` § 2. **Confidence: HIGH** for steps 1-2.

## Writing findings into the annotation store

Recon's findings are not memory-map prose written once and left to rot — they are entries in a
queryable annotation store, and the Markdown memory map is a *generated view* of that store (D-24),
not something you hand-edit yourself.

**There is no bootstrap step, and no bootstrap verb.** The store is created by the first write to
it: name a `.annostore` path on any mutating call — `anno_set_label_name`, `anno_set_comment`,
`anno_set_data_type`, `anno_add_scope` — and it is created, committed and closed inside that call.
A read-only call against a path that does not exist yet is REFUSED by name rather than answering
against an empty store, so "I read nothing" and "there is nothing to read" stay distinguishable.

Every `anno_*` tool takes an explicit `store` path (D-19) — there is no ambient session state
naming the store, so which store a call touched is always visible in the transcript. Every call
that derives its answer from the program's **bytes** rather than from the annotations takes an
`image` path as well — `anno_get_binary_info`, `anno_read_region`, `anno_disassemble`,
`anno_get_cross_references`, `anno_search` and `anno_get_address_details`. The store holds
annotations and never bytes, so an omitted image would read as a plausible success against
whatever was recorded last. `image` is a `.prg` (2-byte little-endian load address plus payload) or
an exactly-65536-byte flat capture, dispatched **by extension first**, never by length.

**Write findings with the named tools, not a Markdown row:**

| Tool | Use for |
|---|---|
| `anno_set_label_name` | Naming a routine or table (`init_screen`, `sprite_table`) |
| `anno_set_data_type` | Classifying a block (`code`, `byte`, `address`, `petscii`, …) |
| `anno_add_scope` | Marking a handler's extent as a lexical scope |
| `anno_set_comment` | Recording the evidence — the carrier for the confidence grade below |
| `anno_batch_execute` | Bulk annotation, 5+ independent calls at once — a real memory map is dozens of labels/comments/block ranges, and one batch is one open/commit/close instead of dozens. The store (and the image, when an inner call needs one) is named ONCE at the top level and every inner call inherits it. A malformed payload, an empty `calls` array, an uncurated inner name at any depth or an illegal label name refuses the **whole** batch by index and executes nothing; past that gate, execution runs to completion and each entry carries its own status, so an error entry inside a successful result means that one call did not work |

**Grade with the confidence prefix.** Lead every evidence comment with exactly one of these five
bracket tokens (quoted verbatim from `anno-confidence.ts`, the parser's own source of truth):

`[confirmed-code]` (confirmed code), `[probable-code]` (probable code), `[confirmed-data]`
(confirmed data), `[probable-data]` (probable data), `[unknown]` (unknown).

A typo in the bracket token — wrong case, an underscore, a plural, stray whitespace — **fails
loudly**; it does not silently degrade into an ungraded comment. As with `RE-FINDINGS.md`, do not
promote a row by editing its grade in place: re-verify and restate the evidence with a fresh
`anno_set_comment` call, so the record of when something stopped being a guess survives.

**Query instead of re-deriving.** `anno_get_symbols`, `anno_get_comments` and `anno_get_blocks`
answer straight from the store; `anno_get_cross_references` and `anno_search` derive their answers
from the image bytes plus the store's typed ranges, so they take `image` too. `anno_search` searches
three corpora together — label names, comment text, and the instruction text rendered from every
range typed `code` — **byte-exact and case-sensitive**, with each corpus named in the answer
alongside how many entries it held, so a genuine zero over a real corpus stays distinguishable from
a corpus this surface does not have.

`max_results` is **REQUIRED, with no default,** on every one of those reads. That is deliberate: an
implicit default silently truncates a full-program pass, and here the true match count rides beside
the truncated list, so truncation is a fact you are told rather than one you infer. The query this
whole workflow exists to make cheap:

> "Show me everything still `[unknown]`" → `anno_search` with `query: "[unknown]"` and
> an explicit `max_results` set above your program's comment count.

`anno_get_blocks` is also the read route for the store's other structural annotations: pass
`include: ["scopes", "enums", "enum_usage"]` to get scope spans (which `anno_remove_scope` must
match exactly), every project enum with its variants, and every address-to-enum association.

`anno_get_address_details` composes everything known about ONE address — the labels bound there,
the comments there, the typed range covering it, and the cross-references reaching it. **The
composition is disclosed:** the body carries `composed_client_side` and a `composed_from` list
naming all four sources, so a composition is never mistaken for something the store held whole.

### Take names to the running machine, and bring live findings back

**Dated withdrawal, 2026-08-29 — the `.lbl` round trip is WITHDRAWN, and as of 2026-08-31 no phase
currently owns its return.** The two CLI verbs that carried it, `export-lbl` and `import-lbl`, are
gone from this surface: both were delivery paths into the retired static analyser. This notice
previously forecast that a numbered phase would rebuild them alongside the ACME export route; that
forecast was **wrong and is corrected here rather than deleted**. The phase that rebuilt the ACME
export route covered that route only — no requirement and no success criterion of it mentioned the
`.lbl` round trip — so the round trip still has no route and **no phase currently owns its return**.
Do not reach for these verbs here: they do not exist, and an invocation fails with an unknown-verb
error and no explanation of why.

The **loop itself is not withdrawn**, only its two automated legs, and the discipline it encodes is
what to keep doing by hand for as long as they stay gone:

1. **The store is the merge point (D-29), not your own notes.** A name discovered live —
   disassembling the running machine, a checkpoint hit — is written into the store with
   `anno_set_label_name` *first*, before it is carried anywhere else.
2. **`vice_symbols_load` REPLACES the machine's symbol table rather than merging into it.** Call it
   **exactly once** per generated `.lbl` file. Loading an older file a second time, after the store
   has moved on, silently discards the newer names.
3. **Regenerate whole, never patch incrementally.** The round trip regenerated the entire `.lbl`
   from the store, and any rebuild of it must do the same; a hand-written incremental patch
   reintroduces exactly the drift the single merge point exists to prevent.

Two traps that survive the withdrawal and are part of the specification whoever eventually rebuilds
this will read: the export carried **USER** labels only — auto-generated `a_D011`/`e_FFD2` externals
never appeared in the written file — and neither direction ever created a store from a raw input.

`gen-enums` — turning register writes into named enum variants — is **withdrawn on the same terms,
and no phase currently owns its return either**. The same superseded forecast named a numbered phase
for it; that phase's requirements covered the ACME export oracle only. What `gen-enums` consumed,
the `memmap.json` bit table, is documented in `c64-memory-mapping` along with the withdrawal and the
by-hand route that stays open.

**Generate the memory map; do not hand-author it.** Fill in the provenance sidecar (schema and a
filled example live in `templates/memory-map.template.md`), then:

```bash
npx -y @henols/vice-mcp anno render-memmap game.annostore --provenance sidecar.json
node <plugin-root>/src/mcp/vice/vice-proxy.ts anno render-memmap game.annostore --provenance sidecar.json
```

Add `--check` to detect drift. It is reported when, and only when, one of these changed: the
rendered file itself (a hand edit); a store row (a range, a label, a comment, or a comment's
confidence grade); the provenance sidecar's bytes; the location of the store or the sidecar
**relative to the workspace root**; or the renderer. **Relocating the checkout is not drift** — the
same tree at a different absolute path renders the same bytes, because the banner records
workspace-relative locations. The rendered file carries a generated-file banner; treat it like every
other generated artifact in this repo and never hand-edit it.

**Dated correction, 2026-08-30 — the paragraph above used to name TWO drift causes, and a third
existed.** Before gap-closure round 2 the banner recorded the store and the sidecar by their
ABSOLUTE paths, so the checkout's own location was a silent third cause: an identical store,
sidecar and rendered file reported `drifted` the moment the tree sat at a different absolute path,
while `render-memmap` printed the same `render_digest` in both. Plan 29-18 removed that cause by
recording workspace-relative locations, so the cause set above is the one the shipped verb has. The
old two-cause wording is superseded rather than merely reworded, and this note says so because a
reader meeting it in history needs to know which claim was live when.

**One-time drift after upgrading, 2026-08-30.** A memory map rendered *before* that change reports
`drifted` on its first `--check` afterwards, exactly once, because the banner's recorded locations
changed from absolute to workspace-relative spellings. Re-run the generator and commit the new
banner. This repository has no committed rendered `memory-map.md` — only the template — so nothing
here regresses; the sentence is written for **consuming projects**, which do have one.

**This playbook itself has a generated twin, and it is not the one to edit.**
`installer/skills/c64-program-recon/` is a gitignored COPY of this directory, rebuilt from it by
`installer/scripts/sync-skills.mjs` on the installer package's `prepack` and by
`npm --prefix installer run sync-skills`. Edit THIS file; never edit the twin. A hand-edit there is
overwritten by the next sync and is not independently covered either — the gates that scan the
shipped tree run the sync before they scan it, so a change made only in the twin is erased before it
is ever measured. A change made here is SHIPPED only once that sync has run.

**Dated correction, 2026-08-30 — `render-memmap` reads the annotation store directly, and the note
that used to stand here was WRONG when it shipped.** Phase 29 plan 29-12 rebuilt this verb over the
Phase 28 annotation store on `D-17`'s authority: its positional is an EXISTING `.annostore`, opened
with `mustExist` — an absent store is refused by name rather than created — and nothing on the path
it reaches consults the retired external analyser. The pre-store project file the earlier note named
has no producer left in this repository, so there is no route back to the old spelling. That earlier
note asserted in the PRESENT TENSE that this verb still read a project file; it was already false
when it shipped, and it is DELETED here rather than amended, so a reader comparing two dated claims
can tell which one to believe.

**Importing a Ghidra export, and the mechanical join that follows it.** When a Ghidra harness run
(a separate, host-side capability) has produced a transfer file, two calls land its findings in the
store — in this order, and each is one mechanical call, not an agent turn:

1. **`anno_import_ghidra_export`** reads the transfer file, writes one cross-reference row per
   surviving reference, and DELETES the transfer file once every write has durably committed. It reports
   `referencesSeen`, `xrefsWritten`, `xrefsAlreadyPresent` (a duplicate reference is deduplicated, not
   double-counted) and `kindsSeenNotImported` — reference kinds outside this store's four-member
   vocabulary, dropped and counted rather than guessed or refused. A malformed, truncated or
   digest-mismatched export is refused by name, naming the section and the offending line, and writes
   nothing.
2. **`anno_join_memmap`** then reads every cross-reference target the store already holds, skips
   addresses inside the program's own loaded image (those are code/data addresses, not hardware
   features), and annotates everything else with the narrowest `c64-memory-mapping/memmap.json` entry
   containing it. It reports `addressesConsidered`, `annotated`, `skippedInImage`,
   `skippedNoMapEntry`, `declined` and `commentsChanged`, plus a per-address decision naming the
   outcome and, for every skip, why.

Both calls are **mechanical**: there is no agent invocation, no queue walk and no skill invocation
anywhere inside either one, checked structurally over the two modules' own source rather than
asserted in prose. Run the import call once per Ghidra export, then the join call once per updated
image; neither call takes an agent turn to complete.

## Static disassembly

**Dated withdrawal 2026-08-29, dated return 2026-08-31 — whole-program ACME export was WITHDRAWN
and has come back as `anno export-asm`, behind a real-ACME byte-diff oracle.** The notice is kept
rather than deleted because the withdrawal explains the shape of what returned. The removed verb
turned a `.prg` or a flat 64K image into ACME source offline and settled its own correctness with a
transcript parser; what returned is not a rename of it. It is rebuilt over the **annotation store**,
and its correctness is settled by **assembling the output with a real ACME and diffing the bytes
against the input** — never by an exit code and never by a string match on the exporter's own
output.

```bash
npx -y @henols/vice-mcp anno export-asm game.prg --store game.annostore --out game.a
node <plugin-root>/src/mcp/vice/vice-proxy.ts anno export-asm game.prg --store game.annostore
```

`<image>` and `--store` are **two separate arguments and neither is derived from the other**: the
image supplies the bytes, the store supplies the names, typed ranges and comments. `--out` defaults
to a `.a` beside the **store** rather than beside the image, and an existing destination is refused
rather than overwritten unless you pass `--force`.

**It writes source and runs no assembler**, and says so in its own second output line
(`this file has NOT been assembled`). The real-ACME byte-diff is a **test-only** oracle in this
repository's test suite, absent from the published package and unreachable at runtime — so a clean
run is evidence that source was written, not an assembler verdict. `acme-build` carries the full
statement of that split.

Two routes remain for reading a single routine, and they are the ones the rest of this playbook
already uses:

- **`anno_read_region`** and **`anno_disassemble`** render one routine or table at an **explicit**
  inclusive range, decoded fresh from the image bytes on every call and written nowhere. That is
  the static route, bounded on purpose: the combined byte count is capped at **4096 bytes**
  (`ANNO_READ_REGION_MAX_BYTES`), and a wider request is REFUSED by name rather than truncated,
  because a full-64K disassembly dumped into an agent's context is exactly the hazard the cap
  exists to prevent.
- **`vice_disassemble`** is the live-RAM route this skill's own table above uses: it reads a
  running emulator's RAM at a checkpoint.

The two are complementary — reach for the static reads before the emulator is even running, and for
`vice_disassemble` once you have a live checkpoint to decode from.

Extracting a program from a `.d64` image is a separate capability that this repository still does
not have, and — correcting an earlier note that assigned it to the same numbered phase as the ACME
export oracle — **no phase currently owns it**. Whenever it is built it must name the file inside
the image explicitly and refuse rather than guess (D-02), because a guess could analyse a cracktro
or loader stub instead of the game.

## Before you touch the emulator

Two hazards cost this project real sessions. Both are in `references/observation-hazards.md`; these
two lines are the part you cannot afford to load lazily.

- **Pause after every observation.** Agent think-time runs the emulator at full speed — 258 million
  cycles (~262 emulated seconds) elapsed across a handful of reads with zero input sent, which was
  enough to reach `GAME OVER` and to invalidate an earlier finding. Never leave the machine running
  across a reasoning step.
- **When the machine looks frozen, enumerate your own checkpoints first.** An armed *stopping*
  checkpoint on the live IRQ path reproduces the entire "dead emulator" signature — zero cycles,
  `ping` still reporting `running`, an identical PC — because the machine genuinely never moved.
  Two cheap reads settle it, and neither needs `vice_execution_run`.

## Documenting one routine, end to end

The table at the top of this page finds *where* the structure is. This section
is what you do once you have picked one routine out of it and want it
documented properly in the annotation store.

**Scope, so three skills do not fight over the same job.** This procedure
handles **one routine, at one explicit address**. Building the backlog of every
undocumented routine in a project and draining it to closure is
`routine-queue-walker`'s job — it calls into this procedure once per queue
entry. Classifying the *regions* around the routine, and naming the data
symbols it touches, is the absorbed pair in `c64-memory-mapping`.

### 1. Context first

`anno_get_binary_info` for `system`, `filename`, `description` and
`may_contain_undocumented_opcodes`.

- `system` names the target machine and therefore which memory map, hardware
  registers and ROM entry points are in play.
- `filename` and `description` identify the software. This is how you recognise
  a stock component instead of re-deriving it — a Hubbard-style music driver,
  an Exomizer decrunch stub — and how genre informs a guess
  (`check_collision` is a plausible routine in a shooter).
- With `may_contain_undocumented_opcodes: true`, expect `LAX`, `SAX`, `SLO`,
  `DCP`, `ISC`. These are real instructions, not disassembly errors; do not
  stop reading at one.

### 2. Bounds, from an explicit address

**Always start from an address you were given or derived** — `$XXXX` or its
decimal equivalent. There is no editor cursor in this project's route, and
upstream's own text forbids relying on one in any case.

Find the start (the entry point or its label) and the end (`RTS`, `RTI`, or a
`JMP`). Two shapes to expect:

- A routine ending in `JMP shared_epilogue` still **ends there** — that is a
  tail call, and the target's body is a different routine.
- A routine with no return at all may **fall through** into the next one. Use
  the cross-references and the flow to decide where the boundary is, and say in
  the comment that it falls through.

### 3. Read the range

`anno_read_region` over the routine's explicit range, naming the `store` and
the `image`, with `view` **omitted** — the disassembly view is that parameter's
documented default, so the call needs no `view` at all here.

The combined byte count is capped at **4096 bytes** per call
(`ANNO_READ_REGION_MAX_BYTES`) and a request above it is refused by name
rather than silently truncated. A routine longer than that — rare, but real in
a decruncher or a level builder — is read as **consecutive ranges**. Read them
in order; do not raise the cap to swallow the whole program, because the cap is
what keeps a "read this routine" call from becoming a whole-program export.

Then read the flow, not just the instructions:

- Does it loop? Where does the loop terminate?
- Does it call other routines, or ROM entry points?
- Does it touch hardware registers?

Recurring shapes worth recognising on sight:

| Pattern | Almost always |
|---|---|
| `SEI` … `CLI` bracketing | IRQ setup or teardown |
| `LDA`/`STA` with `DEX`/`DEY`/`BNE` | Memory copy or fill |
| Bit shifts plus `ADC`/`SBC` chains | Maths, or a decompressor |
| Reads an I/O address then branches | Hardware polling |
| Writes to `$0314`/`$FFFE` | Interrupt vector installation |
| Writes to `$D400`–`$D418` | Music or SFX driver tick |
| Reads `$DC00`/`$DC01` | Joystick or keyboard polling |

### 4. Who calls it

`anno_get_cross_references` on the entry point. The caller is often more
decisive than the body:

- Called from an init block → a setup routine, runs once.
- Called from the main loop → a per-frame update.
- Called from the IRQ → must be fast; likely a music tick or a raster update,
  and its zero-page usage is IRQ-relative.
- **No callers at all** → not necessarily dead. It may be a dispatch target
  reached through a jump table; check the nearby data blocks for an address
  table pointing at it.

### 5. What data it touches

For every address the routine reads or writes:

1. `lookup` it first (see `c64-memory-mapping`). A hardware register or KERNAL
   entry point is answered outright and needs no further work.
2. Otherwise `anno_get_cross_references` on that address, and read the shape:
   - Written once, in init → a constant or a config value.
   - Written *and* read by several routines → shared state, a global.
   - In the zero page and used as `($addr),Y` → an indirect pointer.
3. **Enums.** If the accessed addresses or the immediate values form a logical
   set — state constants, joystick direction bits, colour codes — check for an
   existing project, global or system enum that matches, and apply it with
   `anno_apply_enum_usage` at the accessing instruction. If none matches but
   the set is clean, define one with `anno_create_project_enum` (give it a
   real `description`) and then apply it everywhere it fits. This is what turns
   `lda #$1b` into something a reader understands.

**The pointer-formatting step this project does not have.** A routine that sets
up a pointer or a vector does it with a pair of immediate loads — `LDA #<target
/ STA ptr`, `LDA #>target / STA ptr+1`. Upstream calls `set_immediate_format`
on each of the two instruction addresses, with `low_byte` / `high_byte` and the
target, so the pair renders as one symbol reference. **That call is not exposed
on this project's surface.** `BUILD-03` ("every branch, `JSR`/`JMP` and data
reference goes through a symbol, so code can move") is the requirement that
supplies its criterion, and the per-call disposition sits in the manifest named
in the attribution header above. Until then, recombine the two bytes yourself
and put the reconstructed target in a side comment on both instructions, so the
vector setup is readable even though the store cannot format it.

### 6. Synthesise, then document

Four things, and they are the four things the comment block carries: **purpose**
(one sentence), **inputs** (registers and memory used as arguments), **outputs**
(registers and memory modified), **side effects** (hardware, screen, sound).

Rename the label with `anno_set_label_name`, then put a multi-line `"line"`
comment above the first instruction with `anno_set_comment`, in this exact
shape — the separator is both the first and the last line:

```
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
<what the routine does>

Inputs:  <registers or memory used as arguments, or "None">
Outputs: <registers or memory modified, or "None">
Side Effects: <hardware changes, screen updates, etc., or "None">
=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-=-
```

Then add `"side"` comments to the instructions that carry the meaning — what a
register holds here, why this branch is taken, what this address represents.
This is the part that makes the listing readable for the next person, and it is
the part most often skipped. Grade evidence comments with the confidence prefix
documented earlier on this page.

### 7. Report

- **Purpose** in one sentence.
- **Inputs / outputs / side effects** as determined above.
- **Evidence** — the instructions or cross-references that decided it.
- **Actions taken** — what was renamed, which line comment was added, which
  instructions got side comments, which enums were defined or applied.
- **Uncertain areas** — every instruction or address whose purpose is still
  unclear, by address. A routine report with no uncertain areas on a real game
  is usually a report that stopped looking.

### What goes wrong

| Symptom | What it actually is |
|---|---|
| No `RTS`/`JMP`/`RTI` at the apparent end | Deliberate fall-through. Check whether the next label is independently called. |
| `JMP some_routine` as the last instruction | A tail call. This routine ends there; the target is a separate routine. |
| Several routines converging on one `RTS` | A shared epilogue. It belongs to none of them; note it in each comment. |
| No callers, but the routine is clearly live | Reached through a jump table. Look for an address table pointing at it. |
| Disassembly appears to break mid-routine | Undocumented opcodes. Check the binary-info hint and keep reading. |
| Zero-page usage contradicts the main program's | The routine runs from the IRQ. Its context is IRQ-relative. |

## A tokenized BASIC stub: detokenize with c64-petcat, don't hand-decode it

**Detokenizing a `SYS` stub and resolving its machine-code handover address is
`c64-petcat`'s job, not this skill's.** Reach for its `decode` verb before
reading tokenized bytes by hand: it wraps VICE's own `petcat` to produce the
readable listing and to report the handover address — or a *named decline*
(`entrypoint: null` with a reason) when the `SYS` argument is not a static
value, which is a resolved answer, never a guess to spend a disassembler on.
Corrected here: an earlier note claimed none of `c64-petcat`'s trigger phrases
overlapped this skill's frontmatter; that was true only because the skill did
not exist yet, and it is superseded now that it does.

The material below stays as **reference text only**, narrowed to what
`c64-petcat` does NOT do — write the tokenized bytes' typed ranges and
comments into this project's annotation store. That is rare in practice: a
commercial C64 title captured after its loader has run almost universally
reduces to a one-line `SYS` stub, so most sessions never reach this section at
all. When one does, use `c64-petcat`'s resolved listing and handover address
as the source of truth rather than re-deriving them by hand from the byte
layout below.

### Line anatomy

A tokenised BASIC program is a linked list in memory. Each line is:

1. **Bytes 0–1 — next-line pointer.** The address where the *next* line
   begins, little-endian (`24 04` → `$0424`).
2. **Bytes 2–3 — line number**, 16-bit little-endian (`0A 00` → `10`).
3. **Bytes 4–N — the tokens**, running until a `$00` terminator.
4. **End of program** when a line's next-line pointer is `$00 $00`.

Read the range with `anno_read_region`, `view: "hexdump"`, over an explicit
start and end address — subject to the same 4096-byte ceiling as every other
range read on this surface. Then walk the pointer chain from the first line
until the pointer is `$00 $00`.

### Keyword tokens (BASIC V2)

Bytes with the high bit set, `$80` through `$CB`, are keywords:

| Hex | Keyword | Hex | Keyword | Hex | Keyword | Hex | Keyword |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `$80` | `END` | `$93` | `LOAD` | `$A6` | `SPC(` | `$B9` | `POS` |
| `$81` | `FOR` | `$94` | `SAVE` | `$A7` | `THEN` | `$BA` | `SQR` |
| `$82` | `NEXT` | `$95` | `VERIFY` | `$A8` | `NOT` | `$BB` | `RND` |
| `$83` | `DATA` | `$96` | `DEF` | `$A9` | `STEP` | `$BC` | `LOG` |
| `$84` | `INPUT#` | `$97` | `POKE` | `$AA` | `+` | `$BD` | `EXP` |
| `$85` | `INPUT` | `$98` | `PRINT#` | `$AB` | `-` | `$BE` | `COS` |
| `$86` | `DIM` | `$99` | `PRINT` | `$AC` | `*` | `$BF` | `SIN` |
| `$87` | `READ` | `$9A` | `CONT` | `$AD` | `/` | `$C0` | `TAN` |
| `$88` | `LET` | `$9B` | `LIST` | `$AE` | `^` | `$C1` | `ATN` |
| `$89` | `GOTO` | `$9C` | `CLR` | `$AF` | `AND` | `$C2` | `PEEK` |
| `$8A` | `RUN` | `$9D` | `CMD` | `$B0` | `OR` | `$C3` | `LEN` |
| `$8B` | `IF` | `$9E` | `SYS` | `$B1` | `>` | `$C4` | `STR$` |
| `$8C` | `RESTORE` | `$9F` | `OPEN` | `$B2` | `=` | `$C5` | `VAL` |
| `$8D` | `GOSUB` | `$A0` | `CLOSE` | `$B3` | `<` | `$C6` | `ASC` |
| `$8E` | `RETURN` | `$A1` | `GET` | `$B4` | `SGN` | `$C7` | `CHR$` |
| `$8F` | `REM` | `$A2` | `NEW` | `$B5` | `INT` | `$C8` | `LEFT$` |
| `$90` | `STOP` | `$A3` | `TAB(` | `$B6` | `ABS` | `$C9` | `RIGHT$` |
| `$91` | `ON` | `$A4` | `TO` | `$B7` | `USR` | `$CA` | `MID$` |
| `$92` | `WAIT` | `$A5` | `FN` | `$B8` | `FRE` | `$CB` | `GO` |

Bytes between `$20` and `$7F` are literal PETSCII characters — strings,
variable names, numbers.

### What a decoding pass would write

Per line, batched through `anno_batch_execute`:

1. `anno_set_data_type` `address` over bytes 0–1 (the next-line pointer).
2. `anno_set_data_type` `word` over bytes 2–3 (the line number).
3. `anno_set_data_type` `byte` from byte 4 through the `$00` terminator,
   inclusive.
4. `anno_set_comment` `"side"` at byte 0, carrying the reconstructed line —
   `10 REM LODE RUNNER`.

Then jump to the next-line pointer and repeat until it reads `$00 $00`, and
finally mark that `$00 $00` terminator itself as `word`. Nothing needs to be
"saved": every one of those writes committed and fsynced inside its own call.
`anno_save_project` performs **no write at all** — it reports the store's current
revision, which is what to quote when you write the pass up.

## Which skill does what

This one is the route between the stations. It does not restate what the others carry.

| Need | Go to |
|---|---|
| A disk image's directory, BAM, sector chains, or a named file's raw bytes | `c64-disk-access` |
| Detokenizing a BASIC stub, or its machine-code handover address | `c64-petcat` |
| A verified 64K image, or comparing two captures | `c64-ram-capture` |
| What a specific address or bit means | `c64-memory-mapping` — `node … lookup '$D018'` |
| Assembling | `acme-build` |
| Static disassembly of a `.prg` or flat image | **`anno export-asm`** — withdrawn 2026-08-29, returned 2026-08-31 behind a real-ACME byte-diff oracle that is test-only, so the verb writes source and assembles nothing. Read one range at a time with `anno_read_region` for a single routine (see above) |
| Whether a byte is original or cracker-changed | `c64-provenance-diff` |
| The emulator stopped moving — wedged, self-trapped, or respawned | `vice-wedge-triage` |
| **Which address to read next, and what the answer rules out** | here |

## References

| File | Covers |
|---|---|
| `references/control-flow.md` | Entry point, the six vectors, IRQ source, main-loop shapes, state machines |
| `references/graphics.md` | The VIC derivation chain, the char-ROM shadow trap, sprites, watch targets |
| `references/sound-and-input.md` | SID player vs `$D41B`-as-RNG vs digi; CIA#1 vs CIA#2 |
| `references/observation-hazards.md` | Every way a live read gives a wrong answer. **Read before driving.** |
| `references/tool-selection.md` | Which `mcp__plugin_c64-re-tools_vice__*` call answers which question, and what to delegate |
| `references/reconstruction.md` | Binary inclusion, behavioural-equivalence correctness bar, SMC labels, label vocabulary |
| `templates/memory-map.template.md` | `render-memmap`'s provenance sidecar schema and the confidence vocabulary — the rendered map itself is generated, not hand-authored |

Findings that make RE faster go in `.planning/RE-FINDINGS.md` **at the moment you find them**,
graded with `Evidence:` and `Confidence:`. Promote by re-logging with the new evidence, never by
editing a grade in place. File-changing work enters through a GSD command (`/gsd-quick`).

## Troubleshooting

| Symptom | Fix |
|---|---|
| `$0314` holds something that is not a plausible address | Check HIRAM. With the KERNAL banked out the RAM vectors are uninitialised; read `$FFFE/$FFFF`. |
| Every graphics pointer is wrong, with no error | `$DD00` bits 0-1 are **inverted**. Re-derive the bank first; everything else hangs off it. |
| The charset at the computed address is garbage | CB may resolve into the char-ROM shadow (`$1000`/`$9000`, banks 0/2). `derive.mjs vic` flags it — there is no charset in RAM to extract. |
| A sprite decodes as noise | Check `$D015` first; a disabled sprite's registers are stale. Then check MCM — multicolor decoded as hires comes out twice as wide. |
| Computed mode is "INVALID — screen goes black" | You caught the registers mid-update inside a raster split. Re-read. |
| The emulator looks dead | Enumerate armed checkpoints before anything else. See hazard 2. |
| `vice_keyboard_type` does nothing | The game polls `$DC00`/`$DC01` directly. Use `vice_keyboard_matrix` (**requires the fork backend** — see `references/observation-hazards.md` § 4 for the stock route). |
| Two captures of the same checkpoint differ | Expected. Full-64K identity is impossible in principle; use `c64-ram-capture`'s drift rules. |
