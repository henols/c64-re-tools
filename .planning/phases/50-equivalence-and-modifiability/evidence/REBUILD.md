# The rebuild: provenance record

Phase 50 plan 50-06 Task 1. This document records **where the rebuild came
from**, so a reader can tell it apart from a copy of the committed image.
Every value below is transcribed from
`.planning/phases/50-equivalence-and-modifiability/evidence/rebuild-run.json`,
which the driver wrote from its own run on `2026-09-15T19:44:46Z`. Nothing
here is written from memory.

## How it was produced

The driver is
`.planning/phases/50-equivalence-and-modifiability/evidence/make-rebuild.mjs`.
It walks the real export-and-assemble path and re-derives no step of it:

| Stage | Entry point | Input |
|---|---|---|
| Import | `importStoreDocument()` (`src/mcp/vice/anno-store-export.ts`) | `src/mcp/vice/fixtures/hazard-subject/hazard-subject.annostore.json`, sha256 `7dab66644a093b9722ae3bf3a751ba121e4ce9cd57d2f61d62dfffc95adefcc3` |
| Export | `exportAsmTree()` (`src/mcp/vice/anno-export-asm.ts`) | the fresh throwaway store, against `hazard-subject.prg` |
| Assemble | `verifyAcmeAssemblesTree()` (`src/mcp/vice/acme-verify.ts`) | the exported tree, root file `root.a` |

The store document is imported into a **fresh, throwaway store file** through
the store's own public import verb, never raw SQL. The tree is exported into a
throwaway directory. The committed image is read only as `exportAsmTree()`'s
`imagePath`, which is where the byte-diff oracle's `expectedBytes` come from —
they are built **from the image, never from the exported text**, which is that
option's own stated contract.

**No second assembler call site and no second byte comparison were added.**
`make-rebuild.mjs` contains no `spawn`, `spawnSync`, `exec` or `execFile` of
its own. The only assembler process that runs is the one `acme-verify.ts`
launches, and `acme-verify.test.ts` pins that that module still holds exactly
one real assembler launch, spelled `spawnSync(assemblerBin, ...)`.

### The exported tree

`root.a` plus 11 siblings — 16 blocks:

```
data_1000.bin  data_1040.bin  data_107f.bin  data_1087.bin
root.a         scope_0825.a   scope_0833.a   scope_0853.a
scope_087a.a   scope_108f.a   symbols.a      unscoped.a
```

### The assembler's own verdict

Quoted from `rebuild-run.json`'s `verdict` block:

```
outcome:     "ok"
reason:      "the output file this run created is byte-identical to the expected
              bytes (2279 byte(s) across 16 segment(s))."
exit_status: 0
byte_diff:   { "equal": true, "firstDifferingOffset": null,
               "expectedLength": 2279, "actualLength": 2279 }
aggregate:   "Saving 2279 (0x8e7) bytes (0x801 - 0x10e8 exclusive)."
```

The assembler banner, from `acme --version` on this host:

```
This is ACME, release 0.97 ("Zem"), 31 Jan 2021
  Platform independent version.
```

ACME emitted **46 diagnostics, every one a `Warning`**, all of the form
`Warning (Zone <untitled>): Wrong type - expected address.` A warning never
fails this oracle's verdict — that is verdict rule 5's stated behaviour, and
the measured reason for it is that ACME 0.97 warns on a raw-number operand
under `-Wtype-mismatch` while assembling to exactly the right bytes. The
subject's own `sta $d020` is one such operand. Every diagnostic line is
preserved verbatim in `rebuild-run.json`.

### The two-byte load-address header, stated rather than slipped in

`acme-verify.ts`'s oracle assembles with `-f plain`, which emits the raw body
with **no load address**, because that is the form `expectedBytes` is built to
match. A `.prg` the emulator's `load` verb can read needs the two-byte
little-endian load address in front of that body.

Those two bytes were therefore written by the driver, and they are **derived,
not copied from the committed image**: the value is
`min(exportAsmTree().blocks[].start)` = `$0801` (2049). Before writing them,
the driver cross-checks that derivation against the assembler's **own** `-v2`
per-segment result lines and refuses rather than guessing if the two disagree.
The lowest address in those lines is `0x801`, from
`Segment size is 12 (0xc) bytes (0x801 - 0x80d exclusive).`, and ACME's own
aggregate line independently reports the same extent
(`0x801 - 0x10e8 exclusive`). The check passed, so the header is `$01 $08`.

### One thing the first run got wrong, recorded rather than quietly fixed

The driver's first run **failed**, with
`verifyAcmeAssemblesTree returned "failed": ACME's own per-segment result line
0 disagrees with the exporter's block 0: expected $0801..$080D (exclusive),
ACME reported $0825..$0833`. The cause is not a bad rebuild: `result.blocks`
is ascending by start, but `exportAsmTree()` sources `symbols.a` first, then
each populated scope ascending by scope start, then `unscoped.a` **last
regardless of address** — and this subject's lowest block (`$0801`) is
unscoped. ACME's per-segment lines follow file-inclusion order, never address
order. The project already carries a named helper for exactly this,
`blocksInTreeSourceOrder()`, with its own doc comment stating the same fact.
The driver now uses it. The failure is recorded here because a reader
re-running this path will hit it too.

## Digests, side by side

| File | Bytes | SHA-256 |
|---|---|---|
| `.planning/phases/50-equivalence-and-modifiability/evidence/hazard-subject-rebuild.prg` (the rebuild) | 2281 | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` |
| `src/mcp/vice/fixtures/hazard-subject/hazard-subject.prg` (the committed subject) | 2281 | `89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828` |

The assembled body alone, before the header was prepended, is 2279 bytes,
sha256 `57d056862520d950208b60455a815b8111a3ec117d54534d45a5762a77ffa48d`.

## Optional extra: byte-identity

**The rebuild is byte-identical to the committed subject.** Both files are
2281 bytes and both hash to
`89846d489f83f4d9fd092f214343c5566433655b836d20625e7123682b8c6828`.

**This is not the acceptance criterion for this phase, and a reader who stops
here has not read the verdict.** It is a narrower pre-modification sanity
check: it says the export-and-assemble path reproduced this one image at this
one layout, and it says nothing whatsoever about behaviour.

**The acceptance criterion is behavioural equivalence between the original and
the rebuild, demonstrated in a running emulator, with the committed transcript
as the artifact of record** — `.planning/phases/50-equivalence-and-modifiability/evidence/phase50-equivalence-transcript.md`.
ROADMAP Phase 50 criterion 3 states it in those terms. It then adds, in its
own words, "Byte-identity is not the bar and is not claimed". It goes on, in
the same sentence, "a narrower pre-modification byte-identical sanity check may
be recorded as an optional extra and must not be presented as the acceptance
criterion." This section is that optional extra and nothing more.

### What the byte-identity does and does not buy

It buys exactly one thing: it removes one source of difference from the
behavioural comparison that follows. A rebuild that differed from the original
in its own bytes would make any runtime difference ambiguous between "the
rebuild behaves differently" and "the rebuild *is* different". That ambiguity
is gone here.

It does **not** make the behavioural comparison informative on its own. A
comparison that finds nothing cannot, by itself, distinguish "there was nothing
to find" from "the instrument cannot see" — which is precisely why the red
control in plan 50-05 exists and was committed before any green result. The
green comparison is evidence because that red control failed first, under the
same mask, with the same command shape and no flag difference. Byte-identity
adds no weight to that argument and is not part of it.
