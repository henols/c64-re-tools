# Phase 38 Plan 04 -- PROOF-02, the Roll-Up Verdict

This file is the single declared source for PROOF-02's roll-up lines
(`PROOF02_SITES_ENUMERATED`, `PROOF02_SEARCH_DEPTH`, `PROOF02_COMPUTED_DISPATCH`
-- `SCHEMA.md` § 3's one-declared-source-file-per-line rule) and for the
depacked-depth per-depth lines (`PROOF02_DEPACKED_*`). The loader/depacker-depth
per-depth lines live in their own file, `evidence/proof02-loader-stage.md`
(plan `38-03`), cited here rather than repeated.

## Step 1 -- the roll-up derivation rule, stated BEFORE any value

Written here, in this order, before any verdict below is written:

- `resolved` -- at least one enumerated `computed-index` site, at either depth,
  has a matching computed-jump reference carrying a target.
- `unresolved` -- at least one `computed-index` site was enumerated at either
  depth and none of them resolved.
- `not-exercised` -- zero `computed-index` sites were enumerated at either
  depth. The corpus was searched and found to contain none at the depths
  reached; this is not a pass, and it is not `could-not-run`, because the
  corpus exists and was searched.

## Step 2 -- enumerate over the capture (recorded BEFORE Ghidra runs)

`evidence/proof02-depacked-capture.md` (this plan's own Task 1) recorded
`PROOF02_CAPTURE_OBTAINED: yes`, naming `proof38-depacked-a`
(`sha256=99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5`) as
the capture this search runs over. With the broker confirmed down, that named
capture was copied into a `mkdtempSync` scratch workspace outside the
checkout, its sha256 was re-asserted against the recorded value, and plan
`38-03`'s independent enumerator (`evidence/proof02-enumerate-sites.mjs`,
reused unchanged) was run over it in `--flat64k` mode -- BEFORE any Ghidra
process ran on this image.

```
$ cp /home/henrik/.cache/c64-re-tools/phase33/33-10/proof38-depacked-a.bin /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/depacked.bin
$ sha256sum /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/depacked.bin
99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5  /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/depacked.bin
```

The digest is byte-identical to `evidence/proof02-depacked-capture.md`'s own
`PROOF02_CAPTURE_IMAGE_SHA256` -- the SAME captured bytes, never a second
capture path.

```
$ node .planning/phases/38-proof-01-03-on-real-cracked-code/evidence/proof02-enumerate-sites.mjs enumerate --flat64k /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/depacked.bin --json /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/depacked.sites.json
IMAGE_SHA256: 99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5
IMAGE_BYTES: 65536
IMAGE_ORIGIN: $0000
PROOF02_SITES_METHOD: linear byte scan for opcode $6C (NMOS 6502 JMP (abs), the only indirect control transfer this target has), classified by a bounded 48-byte backward instruction-length-table walk
PROOF02_CIRCULARITY_GUARD: sites are enumerated and recorded from a linear raw-byte $6C opcode scan, BEFORE any check of what Ghidra resolved -- this script reads no Ghidra export, ever, and nothing downstream may add a site to its output (the D-06 guard)

SITES (address, pointer, classification, dxa-class, backward-window bytes):
  $090c  ptr=$8bb4  vector  dxa=n/a  window=a2 db 6a ff 63 a2 db 76 ff 66 71 db 7b ff 67 71 2a 12 f7 dd db 72 f7 dc b4 dc a2 8e b4 dd a2 8a 12 d0 e2 9a a2 8f 12 df 6b a2 ff 6b a2 5b 73 82

COUNTS: immediate-index=0 computed-index=0 vector=1 unknown=0 total=1
```

No `--dump` (dxa cross-check) was supplied at this depth: dxa disassembles a
`.prg`-shaped load image with a two-byte header, not a raw flat-64K RAM
snapshot, and the plan's own action for this step names no dxa cross-check at
this depth -- `dxa=n/a` on the one site found records that plainly rather than
printing a false `data`/`code` value.

**Only one `$6C` byte exists anywhere in this 65536-byte capture, and it
classifies `vector`** (no direct write to its pointer address `$8bb4`/`$8bb5`
found in the 48-byte backward window -- the pointer is never written within
that window, so the classifier's own fallback rule applies). This is a
markedly smaller count than the 53 raw candidates plan `38-03` found in the
45072-byte statically extracted `.prg`: at this depth, the capture was taken
at the SAME anchor count (400 hits of the KERNAL IRQ) plan `38-03`'s image
predates entirely -- `evidence/proof02-depacked-capture.md`'s own
`PROOF02_DEPACK_PROGRESS` measurement already recorded that the packed game
body occupying most of the static image's own address range has been
substantially overwritten by runtime state at this same capture point, and
that most of the 64K capture's OTHER addresses (system RAM: zero page,
stack, screen memory, KERNAL variables) are not the packed compressed body
that produced plan `38-03`'s coincidental `$6C` hits at all. A smaller
raw-byte count at this depth is therefore consistent with what
`PROOF02_DEPACK_PROGRESS` already measured, not a contradiction of it.

PROOF02_DEPACKED_SITES_ENUMERATED: 1
PROOF02_DEPACKED_SITES_COMPUTED_INDEX: 0
PROOF02_DEPACKED_SITES_IMMEDIATE_INDEX: 0

Zero `computed-index` and zero `immediate-index` sites were found at this
depth. The one site found classifies `vector`, not either indexed-dispatch
bucket.

## Step 3 -- the Ghidra run (AFTER the enumeration above was already written)

Everything above this line was written into this file before any Ghidra
process ran on this capture. `GHIDRA_HOME` was set explicitly
(`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` -- not on `$PATH`, not
exported by default in this shell), and the `6502:LE:16:nmos` SLEIGH language
was asserted installed beforehand:

```
$ GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC node -e '<installedLanguageIds($GHIDRA_HOME) -> match for "6502:LE:16:nmos">'
{"id":"6502:LE:16:nmos","ldefsPath":".../Ghidra/Extensions/C64NmosLanguage/data/languages/6502_nmos.ldefs","slafile":"6502_nmos.sla","slafileExists":true}
```

The named capture was copied into a `mkdtempSync` scratch workspace with no
dot-prefixed path segment (`/home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/`,
outside the checkout and never `/tmp`, mirroring plan `38-03`'s own
Ghidra-scratch-root workaround for the same `resolveGhidraProject()`
dot-segment refusal), and `src/mcp/vice/vendor/ghidra-scripts/` was copied
into it with `cpSync`.

**A deviation, recorded here** ([Rule 3 -- Blocking], found live during this
step): the plan's own action text names a `loaderBaseAddr` of `0x0000` for
the flat-64K route. The seam refuses this outright -- `host-tool.mts` compares
`loaderBaseAddr` on the `flat64k` route against the route's own fixed base
address BYTE-EXACTLY as a string, and that fixed value is spelled `0x0`, not
`0x0000`:

```
$ node -e '<runGhidraAnalyze with loaderBaseAddr: "0x0000", importRoute: "flat64k">'
ERROR runGhidraAnalyze: ghidra.analyze refused: host_tool "ghidra.analyze" args.loaderBaseAddr (0x0000) conflicts with the "flat64k" route's own base address (0x0) -- the route defines the base on this route; omit loaderBaseAddr or supply the matching value
```

**Fix:** `loaderBaseAddr` was omitted entirely, letting the flat64k route
supply its own base address (`0x0`, numerically identical to what `0x0000`
meant) exactly as the refusal message itself directs. No other argument
changed. This is a plan-versus-seam spelling mismatch, not an architectural
choice, and the omitted field produces the exact same numeric base the plan's
own text asked for.

The wire request, run successfully after the fix:

```json
{
  "runId": "proof38-04-depacked",
  "importPath": "depacked.bin",
  "processor": "6502:LE:16:nmos",
  "importRoute": "flat64k",
  "scriptPath": "vendor/ghidra-scripts",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "proof38-04-depacked-export.txt"
}
```

```
$ GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC node -e '<runGhidraAnalyze(args, { repoRoot: "/home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a" })>'
RESULT {"runLogPath":"/home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/tools/ghidra-runs/proof38-04-depacked.ghidra-run.log","sha256":"c43d85071b93aaa08212b4cf68b28bfe2f3b400a9564678379ea1d5afff92469","byteLength":8216,"exitStatus":0,"language":{"present":true,"id":"6502:LE:16:nmos"}}
VERDICT {"scriptThrew":false,"language":{"present":true,"id":"6502:LE:16:nmos"},"classification":{"present":true,"expected":65536,"observed":65536}}
```

The run's own `classifyGhidraRunLog()` verdict is read directly, never
`exitStatus` alone (`GhidraRunResult`'s own doc: `exitStatus` carries no
information about whether a post-script threw). `scriptThrew: false`, the
requested language `6502:LE:16:nmos` is byte-exactly named in the run log, and
the export's own self-computed classification total (`65536`) matches its own
observed count -- an internally-consistent, non-thrown run. This project's
own runId-naming convention (alphanumeric-first, dash/underscore only) was
followed for `proof38-04-depacked`. The export file digests to
`08282495dfbbb983f796296efa3db9e1a9c2afe37ca107f308402668ec60168c` (721689
bytes, 65564 lines).

No entry points were supplied to this run -- the plan's own action for this
step names no `entrypointsPath` for the flat-64K route, unlike plan `38-03`'s
`.prg`-route run (which reused Phase 36's five established entry points for
this same release). Ghidra's own `CLASSIFICATION` section confirms the
consequence, stated plainly rather than smoothed over: every one of the
65536 addresses classifies `undef`, and `DECOMPILE_ACCOUNTING` records
`DECOMPILE_ZERO_FUNCTIONS true (no functions were found to decompile)` --
with nothing seeded to disassemble from, the default auto-analysis heuristics
recovered zero functions and zero references anywhere in this image. This is
itself part of the honestly-scoped depth reached at this stage, not a run
failure: `evidence/proof02-depacked-capture.md`'s own `PROOF02_DEPACK_PROGRESS`
measurement already recorded that this capture was taken mid-load (the disk
load's own current buffer position sits inside the static image's own
address range at this same anchor count), so the game's own code has not yet
reached a state from which a known entry point could be named without
guessing one -- and this plan's own prohibitions forbid enumerating dispatch
sites from anything but the independent, non-Ghidra route.

## Step 4 -- checking each already-enumerated site (only those)

Per the same detection rule plan `38-03`'s record already states: the signal
for an unresolved computed dispatch is the ABSENCE of a computed-jump
reference from an independently-enumerated site, never a reported error.
Since Step 2 found **zero** `computed-index` sites at this depth
(`PROOF02_DEPACKED_SITES_COMPUTED_INDEX: 0`), there is nothing in the
already-enumerated list to check a `COMPUTED_JUMP` reference against -- the
absence check is vacuous here, exactly as it was vacuous at the loader depth,
and stated as such rather than silently skipped.

The export's own global `STRUCTURAL_FACTS` section, quoted verbatim:

```
STRUCTURAL_FACT ARRAY_BOUND not-found
STRUCTURAL_FACT SPLIT_POINTER not-found
STRUCTURAL_FACT RECORD_STRIDE not-found
STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found
STRUCTURAL_FACT SELF_MODIFYING_WRITE not-found
```

The export's own `## REFERENCE_COUNT` line reads `0` -- zero references of
any kind were recovered at all (consistent with zero functions decompiled), so
a direct grep for the literal `COMPUTED_JUMP` tag inside `## REFERENCES`
necessarily also finds nothing beyond the `STRUCTURAL_FACT` line itself:

```
$ grep -c 'COMPUTED_JUMP' /home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/proof38-04-depacked-export.txt
1
```

That one match IS the `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found` line
quoted above -- confirmed by the `## REFERENCE_COUNT 0` line directly above
`## STRUCTURAL_FACTS`, so there is no other occurrence anywhere in the
`## REFERENCES` section to have missed.

PROOF02_DEPACKED_COMPUTED_DISPATCH: not-exercised

Per Step 1's derivation rule: `not-exercised` applies when zero
`computed-index` sites were enumerated at this depth -- exactly this case.
This is NOT a claim that no computed dispatch exists anywhere in the depacked
game body; it is the honestly-scoped statement that this search, at this
depth (a mid-load capture with no entry points supplied, per this plan's own
action), enumerated no candidate of that shape to check in the first place.

## Step 5 -- the roll-up

**Both depths, named explicitly:**

1. The statically extracted `BRUCE LEE   (DC)` `.prg` (45074 bytes, load
   address `$0801`), searched from Phase 36's own five established entry
   points (`$081b`, `$b70a`, `$b74c`, `$b7e7`, `$b790`) --
   `evidence/proof02-loader-stage.md` (plan `38-03`):
   `PROOF02_LOADER_SITES_ENUMERATED: 53`,
   `PROOF02_LOADER_SITES_COMPUTED_INDEX: 0`,
   `PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised`.
2. The depacked flat-64K capture (`proof38-depacked-a`, digest
   `99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5`), taken
   at the same anchor `$EA31` and the same target 400 hits Phase 33's own
   default uses -- this file's own Step 2-4:
   `PROOF02_DEPACKED_SITES_ENUMERATED: 1`,
   `PROOF02_DEPACKED_SITES_COMPUTED_INDEX: 0`,
   `PROOF02_DEPACKED_COMPUTED_DISPATCH: not-exercised`.

PROOF02_SITES_ENUMERATED: 54

The union across both depths: `53` (loader/depacker depth,
`evidence/proof02-loader-stage.md`'s own `PROOF02_LOADER_SITES_ENUMERATED`)
plus `1` (depacked depth, this file's own `PROOF02_DEPACKED_SITES_ENUMERATED`
above) = `54`.

PROOF02_SEARCH_DEPTH: loader-and-depacked -- (1) the statically extracted
`BRUCE LEE   (DC)` `.prg` (45074 bytes, load address `$0801`), searched from
Phase 36's five established entry points, per
`evidence/proof02-loader-stage.md`; and (2) the depacked flat-64K capture
`proof38-depacked-a` (65536 bytes, sha256
`99b1d660d946e65089856f1be2a7f3f7bb9e9e1c7938e1385d11c14296071dd5`), taken at
anchor `$EA31` hit 400 -- a mid-load stop, per
`evidence/proof02-depacked-capture.md`'s own `PROOF02_DEPACK_PROGRESS`
measurement, not a post-load capture of the fully resident game -- searched
with no entry points supplied, per this file's own Step 3. Both depths were
reached; neither the loader/depacker's own real code nor this depacked
capture's own resident bytes contain a `JMP (abs)`-shaped indexed dispatch
table at the depth each was searched.

PROOF02_COMPUTED_DISPATCH: not-exercised

Per Step 1's rule, applied to the union: zero `computed-index` sites were
enumerated at EITHER depth (`0` at the loader/depacker depth, `0` at the
depacked depth) -- `not-exercised` is the derived roll-up, citing both
per-depth files by name:
`evidence/proof02-loader-stage.md`'s `PROOF02_LOADER_COMPUTED_DISPATCH:
not-exercised` and this file's own `PROOF02_DEPACKED_COMPUTED_DISPATCH:
not-exercised`. Per `SCHEMA.md` § 5's own worked example, this is exactly the
"both depths not-exercised" case, and the roll-up value matches what that
section states the roll-up must read.

## Close with the honest framing

**Every capture-derived number above was compared under the two-term
`(PC, hit_count)` stop oracle**, with the frame term `(LIN, CYC)` recorded but
not asserted -- `GATE-01`'s `D-04` narrowing, reproduced here rather than
re-derived, exactly as `evidence/proof02-depacked-capture.md` states beside
its own numbers.

**The depth reached is what it is, stated plainly.** This roll-up's
`not-exercised` verdict is a statement about the corpus at the TWO DEPTHS
actually searched -- the loader/depacker's own 67 bytes of real code (which
does not contain the `JMP (abs)` opcode at all, per plan `38-03`'s own
measurement) and a mid-load depacked capture with only one raw `$6C` byte
anywhere in its 65536 bytes, classified `vector` rather than either
indexed-dispatch bucket, searched with no entry points supplied. It is NOT a
claim that a computed indexed-dispatch table does not exist anywhere in this
release's game body: the depacked capture available to this plan was taken
at a point where the disk load itself was still in progress
(`evidence/proof02-depacked-capture.md`'s own `PROOF02_DEPACK_PROGRESS`
measurement), not at a point where the game's own resident code was
identifiable from a known entry point. A capture at a later, post-load anchor
count, with an entry point named from that later state, is a DIFFERENT
measurement this plan does not take -- naming that boundary honestly is what
this closing section is for.

**`could-not-run` does not apply anywhere in this file.** The corpus exists on
disk and was searched at both depths; `PROOF02_CAPTURE_OBTAINED: yes` (this
plan's own Task 1), so the fallback branch (capture not obtained, roll-up
taking the loader-stage value alone) was never reached. `pass` does not apply
either, per `SCHEMA.md` § 3's own stated exclusion: a searched-and-empty
corpus is `not-exercised`, never a pass.

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x vice-broker; echo "exit=$?"
exit=1

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

BROKER_STATE: inactive

```
$ cd src/mcp/vice && npm run test:automated
ℹ tests 3525
ℹ suites 24
ℹ pass 3512
ℹ fail 2
ℹ cancelled 0
ℹ skipped 6
ℹ todo 5
```

At `TEST_AUTOMATED_BASELINE: tests 3525 / pass 3512 / fail 2`
(`evidence/README.md`, cited here rather than re-derived) -- both failures
are the same pre-existing `anno-register.test.ts` `STORE-*`/`MCP-04`
undeclared-requirement-id findings this phase does not touch, exactly the
relation `evidence/README.md`'s convention 4 asks every later transcript in
this phase to compare against (at or below this recorded floor, never a
literal re-derivation).

```
$ git status --porcelain
(empty, aside from this plan's own two evidence files staged for commit)
```

No Ghidra project directory, capture, `.vsf` snapshot or scratch artifact
from this task lives inside the checkout. Everything lived under
`PROBE_DIR=/home/henrik/.cache/c64-re-tools/phase33/33-10` (the capture) or
the sibling non-dot Ghidra scratch root
`/home/henrik/c64-re-tools-ghidra-scratch/phase38-04-Pcux1a/` (the enumeration
and Ghidra run), never inside this repository.
