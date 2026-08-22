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
D=.claude/skills/c64-program-recon/scripts/derive.mjs   # from the repo root

node $D vectors dump.bin                                # $01 + six vectors, which pair is live
node $D vic --dd00 3E --d018 18 --d011 1B --d016 C8     # bank, screen, charset, mode
node $D sprites --dd00 3E --d018 18 --d015 0F --ptrs 20,21,22,23,FF,FF,FF,FF
```

The script does only the arithmetic that a lookup table cannot — register bits to concrete
addresses — over values **you** fetched through `mcp__plugin_c64-re-tools_vice__*`. It contacts nothing.

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

**Open or bootstrap the store**, then hand its path to every call that follows:

```bash
npx -y @henols/vice-mcp r2000 bootstrap game.prg                            # npm install
node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 bootstrap game.prg   # in-repo/plugin
```

Every `r2000_*` tool takes an explicit `project` path pointing at the resulting `.regen2000proj`
(D-19) — there is no ambient session state naming the store, so which project a call touched is
always visible in the transcript.

**Write findings with the named tools, not a Markdown row:**

| Tool | Use for |
|---|---|
| `r2000_set_label_name` | Naming a routine or table (`init_screen`, `sprite_table`) |
| `r2000_set_data_type` | Classifying a block (`code`, `byte`, `address`, `petscii`, …) |
| `r2000_add_scope` | Marking a handler's extent as a lexical scope |
| `r2000_set_comment` | Recording the evidence — the carrier for the confidence grade below |
| `r2000_batch_execute` | Bulk annotation, 5+ independent calls at once — a real memory map is dozens of labels/comments/block ranges, and batching is what makes that affordable under the per-call spawn-load-mutate-save-exit lifecycle |

**Grade with the confidence prefix.** Lead every evidence comment with exactly one of these five
bracket tokens (quoted verbatim from `r2000-confidence.ts`, the parser's own source of truth):

`[confirmed-code]` (confirmed code), `[probable-code]` (probable code), `[confirmed-data]`
(confirmed data), `[probable-data]` (probable data), `[unknown]` (unknown).

A typo in the bracket token — wrong case, an underscore, a plural, stray whitespace — **fails
loudly**; it does not silently degrade into an ungraded comment. As with `RE-FINDINGS.md`, do not
promote a row by editing its grade in place: re-verify and restate the evidence with a fresh
`r2000_set_comment` call, so the record of when something stopped being a guess survives.

**Query instead of re-deriving.** `r2000_get_symbols`, `r2000_get_comments`, `r2000_get_blocks` and
`r2000_get_cross_references` answer straight from the store. `r2000_search_disassembly` searches
labels, comments and instructions together — but `max_results` is **REQUIRED** on this surface,
because regenerator2000's own default is 50 and silently truncates a full-program pass. The query
this whole workflow exists to make cheap:

> "Show me everything still `[unknown]`" → `r2000_search_disassembly` with `query: "[unknown]"` and
> an explicit `max_results` set above your program's comment count.

(The composite address-details lookup is deliberately not on this surface — D-32, a 64K-project
defect filed upstream — its answer is reachable as a combination of the tools above.)

### Take names to the running machine, and bring live findings back

The store and the running emulator are not two independent destinations for a name — writing one
into the store and discovering one live are two legs of **one loop**, in this order, matching how
`R2000-14`/`R2000-15` were actually proven (see Phase 11's live walkthrough,
`evidence/criterion4/WALKTHROUGH.md`):

1. **Export what the store already knows.** `r2000 export-lbl <project>` writes `al C:xxxx .Name`
   lines that `stock-symbols.ts`'s own parser accepts — the verb reads the written file back
   through that same parser before it reports success, never trusting a regenerator2000 exit code
   alone.

   ```bash
   npx -y @henols/vice-mcp r2000 export-lbl game.regen2000proj                            # npm install
   node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 export-lbl game.regen2000proj  # in-repo/plugin
   ```

2. **Load it into the running machine — `vice_symbols_load`, exactly once.** Load that `.lbl` file
   into the live emulator with `vice_symbols_load`. Call it **exactly once** per regenerated file:
   it REPLACES the machine's symbol table rather than merging into it, so loading an older export a
   second time after the store has moved on would silently discard the newer names.
3. **Discover something live the static pass could not, then write it to the store first.**
   Disassembling or reading the running machine (`vice_disassemble`, a checkpoint hit, …) can turn
   up a name the static store never had. Write it with `r2000_set_label_name` *before* regenerating
   anything — the store is the merge point (D-29), not your own notes.
4. **Regenerate the whole `.lbl` and bring it back with `import-lbl`, never an incremental patch.**
   `r2000 import-lbl <project> <lbl>` imports an externally-produced `.lbl` file into the project,
   and reports whether the import was **disk-verified** — re-read from disk in a fresh process,
   never trusted from the child's own success text alone.

   ```bash
   npx -y @henols/vice-mcp r2000 import-lbl game.regen2000proj discovered.lbl                            # npm install
   node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 import-lbl game.regen2000proj discovered.lbl  # in-repo/plugin
   ```

Two traps: `export-lbl` exports **USER** labels only — the auto-generated `a_D011`/`e_FFD2`
externals never appear in the written file. And both verbs require an EXISTING `.regen2000proj`;
neither one bootstraps a project from a raw input.

`r2000 gen-enums` — turning register writes into named enum variants — is documented in
`c64-memory-mapping`, alongside the `memmap.json` bit table it consumes.

**Generate the memory map; do not hand-author it.** Fill in the provenance sidecar (schema and a
filled example live in `templates/memory-map.template.md`), then:

```bash
npx -y @henols/vice-mcp r2000 render-memmap game.regen2000proj --provenance sidecar.json
node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 render-memmap game.regen2000proj --provenance sidecar.json
```

Add `--check` to detect drift — either a hand edit to the rendered file, or a store change since it
was last rendered. The rendered file carries a generated-file banner; treat it like every other
generated artifact in this repo and never hand-edit it.

## Static disassembly

Turning a `.prg` or a flat 64K image into ACME source, offline, is not part of this
skill's own method — it is a separate route:

```bash
npx -y @henols/vice-mcp r2000 export-asm game.prg          # npm installs
node <plugin-root>/.claude/mcp/vice/vice-proxy.ts r2000 export-asm game.prg  # in-repo/plugin
```

This is **static**, over a file on disk — `vice_disassemble` (the live-RAM route
this skill's own table above uses) reads a running emulator's RAM at a checkpoint
instead. The two are complementary: reach for the static route before the emulator
is even running, and for `vice_disassemble` once you have a live checkpoint to
decode from.

Extracting from a `.d64` image: name the file inside the image explicitly. The
tool lists the directory and refuses rather than guess (D-02) — a guess could
analyse a cracktro or loader stub instead of the game.

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

## Which skill does what

This one is the route between the stations. It does not restate what the others carry.

| Need | Go to |
|---|---|
| A verified 64K image, or comparing two captures | `c64-ram-capture` |
| What a specific address or bit means | `c64-memory-mapping` — `node … lookup '$D018'` |
| Assembling | `acme-build` |
| Static disassembly of a `.prg` or flat image | `vice-mcp r2000 export-asm` (see above) |
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
