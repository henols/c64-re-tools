# DXA-02 real refusal (Phase 35, plan 35-05, Task 1)

**What this record is:** a refusal provoked by a REAL unknown listing form from an ACTUAL
`dxa` run on REAL bytes -- not by a hand-planted malformed line, and not by `dxa`'s own
process exit status. `DXA-02`'s amended text requires exactly this distinction; a unit test's
input is synthetic by construction, so `dxa-listing.test.ts`'s own sixth-shape refusal fixture
(a synthetic dash-separated line, 35-02's own key-decision) cannot satisfy it. This record can,
because every byte and every listing line below came out of a real, unmodified, locally-built
`dxa 0.1.5` binary run against real bytes.

## Part 1: the top-of-memory boundary reproduction

A 65,536-byte flat image was built with a deterministic filler pattern (`byte[i] = i & 0xff`
for every `i`) plus three explicit byte overrides -- `byte[0] = 0x48`, `byte[1] = 0x7d`,
`byte[65535] = 0xeb` -- so the resulting wraparound line is reproducible byte-for-byte, exactly
matching the reproduction already recorded in `35-05-PLAN.md`'s own "The real refusal, already
reproduced at plan time" section. The command run:

```
vendor/dxa/dxa -p all-nmos6502 -d skip-scanning -t detect-internal -g 0000 -a dump <65536-byte image>
```

(the same fixed flag set `host-tool.mts`'s `dxa.disassemble` branch constructs for
`imageKind: "flat64k"`, with no `-R`/`-B`/`-l` since none were supplied).

| Field | Value |
|---|---|
| Exit status | **0** |
| stderr | empty (0 bytes) |
| Listing byte length | 699116 |
| Listing line count | 21848 |
| Wall-clock duration | 13 ms |
| Trailing newline | absent (the listing does not end with `\n`) |

**The offending line, verbatim, the listing's own last line:**

```
ffff eb 48 7d 	.byt $eb
```

Read directly: the hex-byte column carries **three** bytes (`eb 48 7d`) at address `$ffff`,
while the trailing directive (`.byt $eb`) emits only **one**. The trailing two bytes, `48` and
`7d`, are the image's own bytes at offsets `0` and `1` -- `dxa`'s dump column walks one address
past `$ffff` (the top of the 16-bit address space) and wraps back to zero, re-printing the
image's own first two bytes in a line whose address column still reads `$ffff`. `dxa`'s own
directive text (`.byt $eb`, one byte) is the ONLY textually-declared byte count on this line;
the hex column silently carries two more. **`dxa` exited 0, with empty stderr, on input it
mis-emitted.** That successful exit status is itself part of this evidence, because it is
exactly why the refusal this record demonstrates cannot be `dxa`'s own exit status -- a
process that exits 0 on a self-inconsistent listing gives a caller no signal to catch this by
watching its exit code alone.

## Part 2: the refusal, from a real run, by this project's own parser

Feeding the SAME listing above (from the SAME real `dxa` run, unmodified) to the Phase 23
evidence parser (`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/
dxa-listing-parse.mjs` -- this project's own script, not `dxa`'s own code, already the
authoritative pre-existing listing parser this repository owned before `dxa-listing.ts`
existed) with a declared image size of 65536:

```
$ node dxa-listing-parse.mjs listing.lst 65536
Error: dxa-listing-parse: accounted byte total 65538 does not equal expected image size 65536. Refusing to report an under-counted classification. accounted=65538 expected=65536 (matched 21846 byte-emitting lines; an unseen line shape, an overlapping emission, or a wrong declared size is the cause).
```

exit 1.

This throws. **This is this project's own parser refusing, by name** -- the message names the
accounted total it computed (65538), the expected declared size (65536), and the matched-line
count (21846); nothing in it is `dxa`'s own wording or `dxa`'s own exit code. It is a REAL,
UNPLANTED refusal: the input is the full, unmodified, real listing `dxa` itself produced from
the boundary reproduction above -- no line was hand-edited, truncated, or removed to provoke
this. The over-count (65538 vs. 65536, a difference of exactly 2) is the same wraparound this
record's Part 1 already isolated: the running-emission-count parser adds every hex-column byte
regardless of address, so the two wrapped bytes at the line's own address column (`$ffff`) get
counted as though they occupied addresses `$ffff+1` and `$ffff+2` inside the declared window,
when in reality they are the image's own bytes 0 and 1, re-emitted a second time under a
misleading address.

### Explicitly distinguished from Phase 23's own prior demonstration

Phase 23's `evidence/fixture/fixture-baseline.txt` section "4. The refusal, demonstrated"
already recorded this SAME parser throwing on a **deliberately, HAND-truncated** copy of a
279-byte fixture listing (the last 20 lines removed by hand, `accounted=247` vs.
`expected=279`). That demonstration proved the mechanism works -- a real regex-driven parser
does throw on a byte-total mismatch -- but the mismatch itself was manufactured by editing the
listing file, not produced by `dxa` on any input `dxa` was actually given. `DXA-02`'s amended
text says explicitly that a refusal is not sufficient unless it is "provoked by a real unknown
listing form from an actual run and not only by a hand-planted malformed line" -- the
hand-truncated 247-vs-279 case is precisely the kind of evidence that amendment excludes.

This record's refusal is different in kind, not merely in numbers: the 65538-byte listing was
never edited after `dxa` produced it. The mismatch originates entirely inside `dxa`'s own
dump-column emission logic at the top of the 16-bit address space -- a real listing form this
project's parser had never been exercised against until this boundary case was constructed and
run for real.

## Part 3: the production parser's own disposition -- it does NOT refuse

`dxa-listing.ts` (this project's CURRENT, shipped parser, hardened by plan 35-02 with A-04's
window contract) is a different design from the Phase 23 evidence script above: its ONE
refusal predicate is `covered.size !== imageSize`, where `covered` is the set of DISTINCT
in-window addresses, never a running emission count. Parsing the SAME real listing with
`origin: 0, imageSize: 65536`:

| Field | Value |
|---|---|
| `covered.size` | 65536 (equals `imageSize` -- no throw) |
| `codeBytes` | 0 |
| `dataBytes` | 65536 |
| `matchedLines` | 21846 |
| `outOfWindow` | 1 line: `"ffff eb 48 7d \t.byt $eb"` |

This is the reason plan 35-01's decision A-04 replaced the running emission count with distinct
in-window coverage in the first place: the two wrapped bytes on the `$ffff` line are real
addresses `0x10000` and `0x10001` -- one full address space width past the declared window's
end (`[0, 65536)`) -- not a re-claim on addresses `0` and `1`, which were already covered
earlier in the listing by their own, correctly-addressed lines. Because those two bytes are
simply outside the window, they are never added to `covered`, never double-claimed, and never
silently dropped either: the whole line is recorded verbatim in `outOfWindow[]`. The production
parser's own disposition of this exact real artefact is therefore: **REPORT, do not refuse, do
not drop.** `dxa-live.test.ts`'s new `dxa-live BOUNDARY` case asserts both halves of this
directly (`covered.size === 65536` AND `outOfWindow` names the `$ffff` line) -- a case that
only asserted "it did not throw" would also pass on a parser that had silently dropped the
artefact instead of reporting it.

## Part 4: the real-cracked-code run

The same fixed flag set was run against a real cracked C64 release, extracted with no VICE, no
broker and no capture pipeline in the loop, via the committed `anno-d64.ts` reader
(`listEntries()`/`extractEntry()`). Release identity (name plus sha256 only, per D-04's
gitignored-corpus convention -- the image itself never enters this repository, confirmed by
`git status --porcelain` at the end of this record):

| Field | Value |
|---|---|
| Release name | `danish.d64` |
| sha256 | `1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5` |
| Extracted entry | `BRUCE LEE   (DC)` |
| Extracted length | 45074 bytes (2-byte load-address header + 45072-byte body) |

This is the SAME release, the SAME extracted entry and the SAME `$0819` entry point plan
35-04's own `evidence/35-dxa03-real-image.md` already recorded and cross-referenced here rather
than re-derived. Command run (identical fixed flags, `-R` naming the one declared entry point):

```
vendor/dxa/dxa -p all-nmos6502 -d skip-scanning -t detect-internal -R release.entrypoints -a dump release.prg
```

| Field | Value |
|---|---|
| Exit status | **0** |
| stderr | empty |
| Listing byte length | 481016 |
| Listing line count | 15044 |
| Wall-clock duration | 8 ms |

**Outcome: the parser does NOT refuse on this real cracked-code run.** Parsing with
`origin: 0x0801, imageSize: 45072` (the extracted `.prg`'s own load address and body length):

| Field | Value |
|---|---|
| `covered.size` | 45072 (equals `imageSize` exactly -- no throw) |
| `unclassified.size` | 0 (no overlapping decode anywhere in this listing) |
| `outOfWindow` | 1 line: `"b80f ae a7 00 \t.byt $ae,$a7"` |

**That absence is itself worth recording, with the numbers that show why**, per this task's own
instruction. The single `outOfWindow` line is a SECOND, genuinely distinct real over-read shape
from the `$ffff` top-of-memory case above -- not the same artefact recurring. Address `$b80f`
is the last data line before the extracted image's own declared end (`origin + imageSize =
$0801 + 45072 = $b811`); its hex column carries three bytes (`ae a7 00`) at addresses
`$b80f`/`$b810`/`$b811`, while its directive (`.byt $ae,$a7`) names only two. `$b80f` and
`$b810` are the image's own last two real bytes and fall correctly inside the window; `$b811`
is one byte past the declared image end and falls outside it -- an end-of-image lookahead
over-read, not a wraparound. Because the two in-window bytes of that line were not claimed
anywhere else, `covered.size` still lands exactly on `45072`, matching `imageSize` precisely,
so no refusal fires. The unrelated grep-checked earlier discovery from plan 35-04's own real-run
(a different range, `$0819-$081f`, classified code-then-data by a known-data range) is not
implicated here at all -- this is a separate, independent finding from this task's own run.

## Working-tree check

`git status --porcelain` shows no `.d64` file and no extracted `.prg` at the time this record
was written (the extracted release bytes were written only to a scratch directory outside this
repository's working tree, removed immediately after use; the corpus image itself is read
directly from its gitignored path under
`.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/`, per D-04's
convention -- never copied into this record or anywhere tracked).

## Oracle narrowing (D-04)

This task produced and consumed NO capture pair, exactly like plan 35-04's own Task 3: every
run above reads bytes directly off disk (a synthetically-constructed flat image, and
`anno-d64.ts`'s direct extraction from a `.d64` image) and spawns `dxa` as a one-shot child
process through the host-tool seam or directly for the transcript captures above -- no VICE, no
broker, no checkpoint, no runtime observation of any kind. There is therefore nothing here for
the two-term `(PC, hit_count)` oracle (with the frame term `(LIN, CYC)` recorded but not
asserted, per `D-04`'s pre-mapped narrowing of rule R6) to apply to. Stated explicitly per this
plan's own instruction to say so rather than leave the line out.
