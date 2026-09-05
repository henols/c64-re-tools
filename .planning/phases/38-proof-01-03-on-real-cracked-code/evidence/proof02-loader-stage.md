# Phase 38 Plan 03 -- PROOF-02, Loader/Depacker-Stage Search

This file records the loader/depacker-depth half of PROOF-02: candidate
indirect-dispatch sites enumerated by a route Ghidra had no part in
(`evidence/proof02-enumerate-sites.mjs`, plan `38-03`'s own Task 1), recorded
**before** Ghidra ever ran, then checked against what Ghidra's real export
says per already-enumerated site -- never the reverse. This is D-01's
"recorded alongside" half; plan `38-04` owns the deeper depacked-image half.

Every command below was actually run, with the broker confirmed stopped
first, per `evidence/README.md`'s conventions (binding on this plan, not
restated in full here).

## Step 0 -- broker confirmed stopped

```
$ systemctl --user is-active vice-broker
inactive

$ pgrep -x x64sc; echo "exit=$?"
exit=1
```

## Step 1 -- independent site enumeration, recorded BEFORE Ghidra runs at all

**Corpus resolution and identity assertion**, per `evidence/README.md`
convention 5 -- `$C64_CORPUS_DIR` unset on this run, so the repo-relative
Phase 23 corpus path was used, and both the release image and the extracted
entry's own sha256 were asserted before any byte was read for any other
purpose:

```
$ sha256sum /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64
1a9d294e07f9593ba59d878423d157bacfe6c6902d3a52ef6ac96512a15fb6c5  /home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64

$ listEntries(/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64)
[{"name":"BRUCE LEE   (DC)","type":"PRG","track":17,"sector":0,"sizeBlocks":178}]

$ extractEntry(/home/henrik/dev/henrik/git/c64-re-tools/.planning/phases/23-the-real-release-gate-go-degrade-no-go/evidence/corpus/danish.d64, "BRUCE LEE   (DC)")
sha256=331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4 bytes=45074
```

PROOF02_LOADER_IMAGE_SHA256: 331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4

Both digests match the values `evidence/proof01-dxa-real-release.md` (plan
`38-01`) already recorded for this same release and entry -- the SAME
extracted bytes, never a second extraction path.

The extracted `.prg` was written into a `mkdtempSync` scratch workspace under
`PROBE_DIR=$HOME/.cache/c64-re-tools/phase38` (absolute path recorded here so
a later wave can find it, per convention 2 -- never a fact a claim rests on):
`/home/henrik/.cache/c64-re-tools/phase38/proof02-loader-ZLZz8z/bl.prg`.

**dxa cross-check listing**, through the shipped `dxa-run.ts` seam
(`runDxaDisassemble()`), entry point `$0819` (the BASIC stub's own `SYS 2073`
target, established by Phase 35 and re-used unchanged from `38-01`):

```
$ runDxaDisassemble({ image: "bl.prg", imageKind: "prg", entrypointsPath: "bl.dxa-entry" }, { repoRoot: "<scratch>" })
runDxaDisassemble: code=67 data=45005 unclassified=0 covered=45072
LISTING_PATH: /home/henrik/.cache/c64-re-tools/phase38/proof02-loader-ZLZz8z/bl.dxa-dump.lst
```

**The independent enumerator**, `evidence/proof02-enumerate-sites.mjs`
(committed by this plan's own Task 1), run over the extracted image with the
dxa listing above as the cross-check annotation -- its FULL real output,
pasted verbatim, is the record of what was found. This runs, and is written
into this file, before Ghidra is invoked anywhere below:

```
$ node evidence/proof02-enumerate-sites.mjs enumerate --prg bl.prg --dump bl.dxa-dump.lst --json bl.sites.json
IMAGE_SHA256: 331fe97e73f8c77624242b4da3029efcb9199ffa184d6cd95220a60311efdaf4
IMAGE_BYTES: 45074
IMAGE_ORIGIN: $0801
PROOF02_SITES_METHOD: linear byte scan for opcode $6C (NMOS 6502 JMP (abs), the only indirect control transfer this target has), classified by a bounded 48-byte backward instruction-length-table walk
PROOF02_CIRCULARITY_GUARD: sites are enumerated and recorded from a linear raw-byte $6C opcode scan, BEFORE any check of what Ghidra resolved -- this script reads no Ghidra export, ever, and nothing downstream may add a site to its output (the D-06 guard)

SITES (address, pointer, classification, dxa-class, backward-window bytes):
  $090c  ptr=$8bb4  vector  dxa=data  window=a2 db 6a ff 63 a2 db 76 ff 66 71 db 7b ff 67 71 2a 12 f7 dd db 72 f7 dc b4 dc a2 8e b4 dd a2 8a 12 d0 e2 9a a2 8f 12 df 6b a2 ff 6b a2 5b 73 82
  $166a  ptr=$4e9d  unknown  dxa=data  window=70 27 30 09 ad 15 d0 19 73 27 8d 15 d0 60 20 b5 10 ad 79 cf 4d 99 cf 8d 66 11 a2 01 a9 80 20 8e 0b a9 10 95 bf a9 2a 9d 48 4f a9 2b 9d 4b 4f a9
  $1a83  ptr=$de00  vector  dxa=data  window=a5 03 18 69 26 aa a9 01 9d 00 03 ca ca 10 f9 a6 03 a9 00 9d 00 03 60 60 f7 10 ca ff fa 9d 11 17 bd 05 a2 48 8a 48 98 48 ba bd 04 01 29 00 f0 03
  $1a86  ptr=$0408  vector  dxa=data  window=69 26 aa a9 01 9d 00 03 ca ca 10 f9 a6 03 a9 00 9d 00 03 60 60 f7 10 ca ff fa 9d 11 17 bd 05 a2 48 8a 48 98 48 ba bd 04 01 29 00 f0 03 6c 00 de
  $1a8a  ptr=$fffc  vector  dxa=data  window=01 9d 00 03 ca ca 10 f9 a6 03 a9 00 9d 00 03 60 60 f7 10 ca ff fa 9d 11 17 bd 05 a2 48 8a 48 98 48 ba bd 04 01 29 00 f0 03 6c 00 de 6c 08 04 40
  $1a8d  ptr=$0000  vector  dxa=data  window=03 ca ca 10 f9 a6 03 a9 00 9d 00 03 60 60 f7 10 ca ff fa 9d 11 17 bd 05 a2 48 8a 48 98 48 ba bd 04 01 29 00 f0 03 6c 00 de 6c 08 04 40 6c fc ff
  $2669  ptr=$304f  unknown  dxa=data  window=6f 1d a9 00 95 c8 a9 01 85 85 de 63 4f 30 08 46 85 20 39 1e 4c d8 1c de 66 4f 30 06 20 f2 1d 4c e5 1c de 69 4f 30 08 46 85 20 c4 1e 4c f0 1c de
  $3b0c  ptr=$de00  vector  dxa=data  window=43 4c 17 1b 48 a9 00 85 25 85 26 85 27 68 95 25 4c 2c 31 ad 04 01 f0 d1 ad 7b cf 4d 9b cf d0 13 ad 7e cf 4d 9e cf d0 0b ad 81 cf 4d a1 cf d0 03
  $3f17  ptr=$8ddb  unknown  dxa=data  window=8d 24 01 8d 2b 01 a9 0c 8d 25 01 8d 27 01 60 a9 01 8d 97 4e 60 a9 01 8d 97 4e 8d 98 4e 8d 99 4e 60 a9 ff 8d 1c db 8d 1d db 8d 44 db 8d 45 db 8d
  $43f7  ptr=$6d84  vector  dxa=data  window=6e 4c 4e 40 60 a5 14 18 69 04 85 14 90 02 e6 15 60 a5 29 0a aa bd c5 4e 48 bd c4 4e 48 60 a5 0a 18 69 04 85 0a a5 0b 69 00 85 0b 60 20 4f 42 85
  $440d  ptr=$17a9  unknown  dxa=data  window=c5 4e 48 bd c4 4e 48 60 a5 0a 18 69 04 85 0a a5 0b 69 00 85 0b 60 20 4f 42 85 6c 84 6d a9 13 20 ca 3a a9 13 20 ca 3a a9 14 4c ca 3a 20 8a 3a c6
  $4417  ptr=$2da9  unknown  dxa=data  window=18 69 04 85 0a a5 0b 69 00 85 0b 60 20 4f 42 85 6c 84 6d a9 13 20 ca 3a a9 13 20 ca 3a a9 14 4c ca 3a 20 8a 3a c6 6c a9 17 4c ca 3a 20 8a 3a c6
  $4421  ptr=$6d84  vector  dxa=data  window=0b 60 20 4f 42 85 6c 84 6d a9 13 20 ca 3a a9 13 20 ca 3a a9 14 4c ca 3a 20 8a 3a c6 6c a9 17 4c ca 3a 20 8a 3a c6 6c a9 2d 4c ca 3a 20 4f 42 85
  $4434  ptr=$6da4  unknown  dxa=data  window=a9 14 4c ca 3a 20 8a 3a c6 6c a9 17 4c ca 3a 20 8a 3a c6 6c a9 2d 4c ca 3a 20 4f 42 85 6c 84 6d a9 63 20 ca 3a a9 63 20 ca 3a a9 64 4c ca 3a a6
  $443b  ptr=$a560  vector  dxa=data  window=3a c6 6c a9 17 4c ca 3a 20 8a 3a c6 6c a9 2d 4c ca 3a 20 4f 42 85 6c 84 6d a9 63 20 ca 3a a9 63 20 ca 3a a9 64 4c ca 3a a6 6c a4 6d 20 e2 17 e6
  $5321  ptr=$7675  vector  dxa=data  window=25 27 29 2b 09 0b 0d 0f 5c 5c 15 17 0d 0f 0d 0f 5c 0e d6 61 62 5d 5e 75 76 5d 5e 73 74 6d 6e 65 66 75 76 5c 5c 6f 70 71 72 63 64 73 74 63 64 6b
  $5335  ptr=$5c5c  vector  dxa=data  window=62 5d 5e 75 76 5d 5e 73 74 6d 6e 65 66 75 76 5c 5c 6f 70 71 72 63 64 73 74 63 64 6b 6c 75 76 73 74 5c 06 d6 5f 60 77 78 5c 04 d6 71 72 6d 6e 6b
  $542d  ptr=$6f6e  unknown  dxa=data  window=00 2c 04 38 08 00 2c 04 38 00 82 82 68 8c 84 00 70 0f 30 84 00 70 0f 30 f9 09 3e 9d 1b 82 dd 27 11 91 d8 4c 43 c6 46 b4 5c 8d 90 e0 e0 68 6a 6b
  $6674  ptr=$3c78  vector  dxa=data  window=00 60 00 d0 00 f0 00 f0 00 30 00 10 00 98 00 f8 03 fc 03 fc 02 fc 02 f4 13 34 13 0c 1f 0c 7c f0 0c 18 3c 34 1c 3e e6 e4 be 3f 3f 1f 4d c0 e4 cc
  $67d3  ptr=$446c  vector  dxa=data  window=40 48 58 18 00 03 d6 02 42 4c 3c 78 43 00 04 d6 04 08 0c 7c 78 7c 38 7e ff 81 00 44 6e e7 c3 66 e7 08 08 04 04 85 8d 89 ff fe 7e 7c 7c 00 00 44
  $67d4  ptr=$4444  vector  dxa=data  window=48 58 18 00 03 d6 02 42 4c 3c 78 43 00 04 d6 04 08 0c 7c 78 7c 38 7e ff 81 00 44 6e e7 c3 66 e7 08 08 04 04 85 8d 89 ff fe 7e 7c 7c 00 00 44 6c
  $67d7  ptr=$00c6  vector  dxa=data  window=00 03 d6 02 42 4c 3c 78 43 00 04 d6 04 08 0c 7c 78 7c 38 7e ff 81 00 44 6e e7 c3 66 e7 08 08 04 04 85 8d 89 ff fe 7e 7c 7c 00 00 44 6c 6c 44 44
  $681e  ptr=$ccec  vector  dxa=data  window=78 70 30 00 05 d6 7c 7c 38 10 00 03 d6 10 12 32 20 20 a0 b2 be df ff 7e 00 00 22 36 37 33 16 13 30 00 08 4c 4c 04 04 05 4d 7d fb ff 7e 00 00 44
  $682d  ptr=$2c6c  vector  dxa=data  window=32 20 20 a0 b2 be df ff 7e 00 00 22 36 37 33 16 13 30 00 08 4c 4c 04 04 05 4d 7d fb ff 7e 00 00 44 6c ec cc 68 c8 0c 00 60 70 d0 f0 f0 78 38 38
  $682e  ptr=$782c  unknown  dxa=data  window=20 20 a0 b2 be df ff 7e 00 00 22 36 37 33 16 13 30 00 08 4c 4c 04 04 05 4d 7d fb ff 7e 00 00 44 6c ec cc 68 c8 0c 00 60 70 d0 f0 f0 78 38 38 6c
  $6833  ptr=$ceec  unknown  dxa=data  window=df ff 7e 00 00 22 36 37 33 16 13 30 00 08 4c 4c 04 04 05 4d 7d fb ff 7e 00 00 44 6c ec cc 68 c8 0c 00 60 70 d0 f0 f0 78 38 38 6c 6c 2c 78 60 04
  $684a  ptr=$c746  vector  dxa=data  window=7e 00 00 44 6c ec cc 68 c8 0c 00 60 70 d0 f0 f0 78 38 38 6c 6c 2c 78 60 04 6c ec ce 26 62 42 00 60 70 d0 f0 f0 78 38 7e 7f 3c 7c f8 80 04 04 2c
  $6857  ptr=$686c  vector  dxa=data  window=d0 f0 f0 78 38 38 6c 6c 2c 78 60 04 6c ec ce 26 62 42 00 60 70 d0 f0 f0 78 38 7e 7f 3c 7c f8 80 04 04 2c 6c 46 c7 01 00 0c 1c 16 1e 1e 3c 38 38
  $6858  ptr=$3c68  unknown  dxa=data  window=f0 f0 78 38 38 6c 6c 2c 78 60 04 6c ec ce 26 62 42 00 60 70 d0 f0 f0 78 38 7e 7f 3c 7c f8 80 04 04 2c 6c 46 c7 01 00 0c 1c 16 1e 1e 3c 38 38 6c
  $685d  ptr=$e66e  vector  dxa=data  window=6c 6c 2c 78 60 04 6c ec ce 26 62 42 00 60 70 d0 f0 f0 78 38 7e 7f 3c 7c f8 80 04 04 2c 6c 46 c7 01 00 0c 1c 16 1e 1e 3c 38 38 6c 6c 68 3c 0c 40
  $68f4  ptr=$446c  vector  dxa=data  window=20 20 00 04 04 10 03 d6 c2 72 38 10 00 00 20 38 30 14 10 10 00 02 00 00 80 80 20 3c 1d 1d 08 00 18 3c 28 3c 3c 7c 70 7c d8 ce ce 4e 7c 7c 00 44
  $68f5  ptr=$4444  vector  dxa=data  window=20 00 04 04 10 03 d6 c2 72 38 10 00 00 20 38 30 14 10 10 00 02 00 00 80 80 20 3c 1d 1d 08 00 18 3c 28 3c 3c 7c 70 7c d8 ce ce 4e 7c 7c 00 44 6c
  $6942  ptr=$286c  vector  dxa=data  window=40 00 0c 00 21 31 03 d6 00 00 7c 38 10 00 05 23 0b 03 82 9a d8 98 00 00 04 0c 0c 00 3e 1c 08 00 00 18 3c 28 3c 3c 7c 74 7c 78 fe fe 82 82 c4 2c
  $6943  ptr=$3c28  unknown  dxa=data  window=00 0c 00 21 31 03 d6 00 00 7c 38 10 00 05 23 0b 03 82 9a d8 98 00 00 04 0c 0c 00 3e 1c 08 00 00 18 3c 28 3c 3c 7c 74 7c 78 fe fe 82 82 c4 2c 6c
  $696c  ptr=$446c  vector  dxa=data  window=fe fe 82 82 c4 2c 6c 6c 28 3c 3e 18 3c 14 3c 3c 3e 0e 3e 1b 73 73 72 3e 3e 00 22 36 36 22 22 66 18 38 2c 3c 3c 20 60 24 7d f9 df cf 4e 7c 00 44
  $696d  ptr=$4444  vector  dxa=data  window=fe 82 82 c4 2c 6c 6c 28 3c 3e 18 3c 14 3c 3c 3e 0e 3e 1b 73 73 72 3e 3e 00 22 36 36 22 22 66 18 38 2c 3c 3c 20 60 24 7d f9 df cf 4e 7c 00 44 6c
  $6ced  ptr=$787c  unknown  dxa=data  window=00 0c 00 0d 00 0f c0 0f c0 00 00 60 c0 90 a0 80 00 03 d6 01 03 04 0e 1f 5f 7b 33 36 3e 1e 3c 0c 06 03 09 05 01 00 03 d6 80 c0 20 70 f8 fa de cc
  $6d53  ptr=$384e  vector  dxa=data  window=d6 0c 16 1a 1e fe fc be 3e 3e 1a 0a 02 00 03 d6 0c 16 1a 7e fc fe 9f 5b 39 11 00 00 08 0c 14 1c 1c 0c 0e 1e 36 72 1c 00 10 30 28 38 38 30 70 78
  $6dbf  ptr=$4143  vector  dxa=data  window=c0 e0 70 38 04 d6 10 00 04 d6 06 04 06 0e 1c 38 04 d6 10 00 04 d6 03 02 03 07 7e 7c 5e 5e 0e 02 02 00 00 e0 30 b0 30 10 00 04 d6 0a 9a 9e 1c 28
  $6f19  ptr=$3e3e  vector  dxa=data  window=08 04 02 01 61 72 36 7c 7c 38 78 03 d6 7c b8 98 18 1c 0c 04 0c 10 08 04 02 61 73 36 7c 7c 38 78 78 7c b8 bc 2e 22 12 18 08 18 10 20 40 80 86 4e
  $6f2e  ptr=$3e3e  vector  dxa=data  window=10 08 04 02 61 73 36 7c 7c 38 78 78 7c b8 bc 2e 22 12 18 08 18 10 20 40 80 86 4e 6c 3e 3e 1c 1e 03 d6 3e 1d 19 18 38 30 20 30 08 10 20 40 86 ce
  $6f7e  ptr=$2664  vector  dxa=data  window=c2 03 01 03 00 0e d6 03 80 03 80 00 80 03 c0 03 f0 00 f0 3f f0 00 f0 03 f0 03 3c 03 cc 00 cf 00 41 00 c3 80 40 38 38 30 3c 7a 73 72 7e 7c f0 f8
  $882a  ptr=$6968  unknown  dxa=data  window=11 10 5c 5a 11 02 5e 90 6a 5e 5d 11 10 53 5e 11 10 5a 6b 5c 5d 11 10 c2 04 86 87 ee 10 11 10 11 86 c2 02 5e 94 68 69 5e 53 5e c2 5e 5f c2 5e 6b
  $8836  ptr=$6a68  unknown  dxa=data  window=10 53 5e 11 10 5a 6b 5c 5d 11 10 c2 04 86 87 ee 10 11 10 11 86 c2 02 5e 94 68 69 5e 53 5e c2 5e 5f c2 5e 6b 6c 68 69 c2 5e 69 5e 69 c2 02 5e 84
  $8853  ptr=$6968  unknown  dxa=data  window=5e c2 5e 5f c2 5e 6b 6c 68 69 c2 5e 69 5e 69 c2 02 5e 84 6c 68 6a c2 04 86 83 10 11 10 80 10 11 86 c2 02 5e 94 68 69 5e 53 5e c2 5e 5f c2 5e 6b
  $885f  ptr=$6a68  unknown  dxa=data  window=69 5e 69 c2 02 5e 84 6c 68 6a c2 04 86 83 10 11 10 80 10 11 86 c2 02 5e 94 68 69 5e 53 5e c2 5e 5f c2 5e 6b 6c 68 69 c2 5e 69 5e 69 c2 02 5e 84
  $a72c  ptr=$bde8  vector  dxa=data  window=e2 e3 8d 30 e1 68 28 60 20 da e3 60 98 10 06 29 7f aa 4c 55 e4 29 02 d0 16 ae 09 e3 ec 6b e8 90 07 a2 ff 98 29 01 f0 32 e8 8e 09 e3 4c 03 e3 ae
  $a743  ptr=$aae8  unknown  dxa=data  window=d0 16 ae 09 e3 ec 6b e8 90 07 a2 ff 98 29 01 f0 32 e8 8e 09 e3 4c 03 e3 ae 6c e8 bd 70 e8 30 18 0a 10 0a 0a 4a 4a 8d 00 e1 e8 4c 5e e4 4a e8 8e
  $a74f  ptr=$98e8  vector  dxa=data  window=98 29 01 f0 32 e8 8e 09 e3 4c 03 e3 ae 6c e8 bd 70 e8 30 18 0a 10 0a 0a 4a 4a 8d 00 e1 e8 4c 5e e4 4a e8 8e 6c e8 aa 4c 55 e4 a0 01 ae 6d e8 8e
  $b518  ptr=$c0b0  vector  dxa=data  window=80 e9 a2 00 80 ad b9 00 09 80 ad 99 00 04 80 59 c8 80 59 d0 f1 80 de e8 80 59 e0 a6 80 59 f0 10 80 ad ee 20 c0 80 59 ee 25 c0 80 ed d0 d8 80 de
  $b62d  ptr=$7c9a  vector  dxa=data  window=00 ff 00 ff 00 ff 00 ff 00 ff 00 ff 00 ff 00 9c 35 55 d0 50 f9 f9 7c 87 2e 2a af 53 fa fa 7f 82 2b 0b 8e 70 d2 4f ef ef be 45 14 e9 70 70 74 bc
  $b6bd  ptr=$b39a  vector  dxa=data  window=ff 0e d6 f5 ff 05 d6 00 06 d6 b7 00 03 d6 02 ff 00 0d d6 91 51 91 46 31 1a 11 45 44 b4 a2 91 ac 88 88 89 e6 7c c9 f4 52 da b9 b4 b4 26 ef a7 9e
  $b6dd  ptr=$b39a  vector  dxa=data  window=88 88 89 e6 7c c9 f4 52 da b9 b4 b4 26 ef a7 9e 6c 9a b3 18 55 a5 28 4a c4 2a 22 22 2a a2 22 22 8a 89 88 e6 7c c9 f4 52 da b9 b4 b4 26 ef a7 9e

COUNTS: immediate-index=0 computed-index=0 vector=36 unknown=17 total=53
DXA_CLASS_COUNTS: code=0 data=53 unclassified=0 absent=0
```

PROOF02_LOADER_SITES_ENUMERATED: 53
PROOF02_LOADER_SITES_COMPUTED_INDEX: 0
PROOF02_LOADER_SITES_IMMEDIATE_INDEX: 0

Every one of the 53 raw `$6C` byte occurrences in this extracted image is
classified `dxa=data` by the independent dxa cross-check -- none is `code`.
This is the "a `$6C` byte inside a data region is a false site" case
`evidence/proof02-enumerate-sites.mjs`'s own header names explicitly: at
this depth, the packed game body (which contains most of this image's
45072-byte span) is exactly where raw `$6C` bytes turn up by coincidence,
never as a genuinely executed indirect jump. Zero of the 53 candidates
classify `immediate-index` or `computed-index` -- the loader/depacker's own
small amount of REAL code (67 bytes, per dxa's own `code` count above) does
not contain the `JMP (abs)` opcode at all.

## Step 2 -- the Ghidra run (AFTER the enumeration above was already written)

Everything above this line was written into this file before any Ghidra
process ran. The wire request below went through this project's own
`ghidra.analyze` host-tool seam (the same seam and the same corpus program
Phase 36's `evidence/36-07-acceptance-run.md` already exercised, with a new
`runId`), with `GHIDRA_HOME` set explicitly to this host's non-standard
install path (`/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` -- not on
`$PATH`, not exported by default in this shell) and the `6502:LE:16:nmos`
SLEIGH language asserted installed beforehand:

```
$ installedLanguageIds($GHIDRA_HOME) -> match for "6502:LE:16:nmos"
{"id":"6502:LE:16:nmos","ldefsPath":".../Ghidra/Extensions/C64NmosLanguage/data/languages/6502_nmos.ldefs","slafile":"6502_nmos.sla","slafileExists":true}
```

**A deviation, recorded here** ([Rule 3 -- Blocking], found live during this
step): this phase's own `PROBE_DIR` (`$HOME/.cache/c64-re-tools/phase38`)
cannot host the Ghidra scratch workspace -- `ghidra-project.mts`'s
`resolveGhidraProject()` unconditionally refuses any computed project
location containing a dot-prefixed path element, and `.cache` is exactly
that. The FIRST attempt below reproduces the refusal live; the SECOND uses a
sibling scratch root with no dot-prefixed segment
(`$HOME/c64-re-tools-ghidra-scratch/phase38/`, still outside the checkout
and still never `/tmp`), built via `mkdtempSync` and populated with a copy
of the same extracted `bl.prg`, the same `bl.entrypoints` file (renamed
`release.entrypoints`) and a `cpSync` of `vendor/ghidra-scripts/`:

```
$ GHIDRA_HOME=... node -e '<ghidra.analyze against $HOME/.cache/c64-re-tools/phase38/...>'
REFUSAL: runGhidraAnalyze: ghidra.analyze refused: resolveGhidraProject refuses a project location containing a dot-prefixed path element (".cache"): path element starting with '.' is not permitted; computed location was /home/henrik/.cache/c64-re-tools/phase38/proof02-loader-ZLZz8z/tools/ghidra-runs/proof02-loader
```

The wire request, re-run against the corrected scratch root:

```json
{
  "runId": "proof02-loader",
  "importPath": "bl.prg",
  "processor": "6502:LE:16:nmos",
  "importRoute": "prg",
  "noanalysis": true,
  "scriptPath": "vendor/ghidra-scripts",
  "preScript": "vendor/ghidra-scripts/VolatileCarve.java",
  "entrypointsPath": "release.entrypoints",
  "postScript": "vendor/ghidra-scripts/GhidraStructExport.java",
  "exportPath": "proof02-loader-export.txt"
}
```

`release.entrypoints` (the SAME five entry points Phase 36's
`evidence/36-07-corpus-before-after.md` established for this exact release
and re-used verbatim, never re-derived):

```
081b
b70a
b74c
b7e7
b790
```

```
$ node -e '<runGhidraAnalyze(args, { repoRoot: "$HOME/c64-re-tools-ghidra-scratch/phase38/proof02-loader-WeXZwZ" })>'
RESULT: {"runLogPath":".../tools/ghidra-runs/proof02-loader.ghidra-run.log","sha256":"99ec32d181e39d8a53dfe2efc6b0cc94e32a14bd9ce9fe14b496b5d7c668e1fe","byteLength":10770,"exitStatus":0,"language":{"present":true,"id":"6502:LE:16:nmos"}}
VERDICT: {"scriptThrew":false,"language":{"present":true,"id":"6502:LE:16:nmos"},"classification":{"present":true,"expected":49682,"observed":49682}}
```

The run's own `classifyGhidraRunLog()` verdict is read directly, never
`exitStatus` alone (`GhidraRunResult`'s own doc: `exitStatus` carries no
information about whether a post-script threw). `scriptThrew: false`, the
run log's own `Using Language/Compiler:` line names `6502:LE:16:nmos`
byte-exactly matching the requested processor, and the export's own
self-computed classification total (`49682`) matches its own observed
count -- an internally-consistent, non-thrown run. The export file itself
digests to `25b705799a98dcf5e9691d7c645f6681385c9d313deb45bd6d61dbb15a836bf6`
(553902 bytes).

## Step 3 -- checking each already-enumerated site (only those)

Per Task 2's own detection rule: the signal for an unresolved computed
dispatch is the ABSENCE of a computed-jump reference from an
independently-enumerated site, never a reported error -- Ghidra emits no
warning and no log line when it fails to resolve one. Since Step 1 found
**zero** `computed-index` sites at this depth
(`PROOF02_LOADER_SITES_COMPUTED_INDEX: 0`), there is nothing in the
already-enumerated list to check a `COMPUTED_JUMP` reference against -- the
absence check is vacuous here, and stated as such rather than silently
skipped.

The export's own global `STRUCTURAL_FACTS` section confirms the same
absence at the whole-image level, quoted verbatim:

```
STRUCTURAL_FACT ARRAY_BOUND not-found
STRUCTURAL_FACT SPLIT_POINTER found function=FUN_a660 address=a660
STRUCTURAL_FACT SPLIT_POINTER found function=FUN_b790 address=b790
STRUCTURAL_FACT RECORD_STRIDE not-found
STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found
STRUCTURAL_FACT SELF_MODIFYING_WRITE found from=b7de to=081f
```

A direct grep of the export's `## REFERENCES` section for the literal
`COMPUTED_JUMP` reference-type tag confirms zero occurrences anywhere in the
82 references this run recorded (`## REFERENCE_COUNT 82`) -- the only match
in the whole export file is the `STRUCTURAL_FACT` line itself, quoted above.
These numbers (`49682` classification lines, `82` references, `10`
decompiled functions) are IDENTICAL to Phase 36's own acceptance run over
this same release and these same five entry points -- the same real corpus,
the same real result, observed twice.

## Step 4 -- the verdict

PROOF02_LOADER_COMPUTED_DISPATCH: not-exercised

Per the declared derivation rule (`38-03-PLAN.md`): `not-exercised` applies
when zero `computed-index` sites were enumerated at this depth -- exactly
this case. This is NOT a claim that no computed dispatch exists anywhere in
this release; it is the honestly-scoped statement that this search, at this
depth, enumerated no candidate of that shape to check in the first place.

PROOF02_LOADER_ENTRYPOINTS: $081b, $b70a, $b74c, $b7e7, $b790

PROOF02_LOADER_SEARCH_DEPTH: the statically extracted BRUCE LEE (DC) .prg (45074 bytes, load address $0801), searched from the five entry points above -- $081b (the BASIC stub's own SYS 2073 target), $b70a (reached from $081b's own direct JMP), $b74c and $b7e7 (the depacker's own two self-relocating copy-loop source addresses), and $b790 (the depacker's second real routine). The game's own code is packed and does not appear as static bytes in this file until the depacker actually runs at runtime -- this search does not emulate that, and reaches only the loader/depacker stage's own 67 bytes of real code (per dxa's own code-address count, Step 1) plus this same 67-byte-adjacent region as Ghidra's own ten decompiled functions. Nothing below the depacker's own execution is visible to this search; plan 38-04's own depacked-image search is what reaches further.

## Step 5 -- Phase 36's earlier search, cited alongside (not instead of)

Phase 36's `evidence/36-07-acceptance-run.md` already ran this EXACT same
image, route, language and five entry points once before (a different
`runId`, `"acceptance"`), and recorded, quoted verbatim from that file:

> `STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found`
>
> "**MEASURED finding: `COMPUTED_JUMP` is genuinely absent from this corpus
> program's own resolved references, at the depth this plan's five entry
> points reach.** [...] the actual finding, disclosed rather than forced:
> every computed control transfer this image reaches decodes as a `BRK`
> instruction whose own flow is the "BRK trick" -- a computed jump through
> the hardware IRQ vector (`$FFFE`), which this synthetic flat import cannot
> resolve because the vector's own target lives entirely outside the loaded
> image. [...] This was independently RE-CONFIRMED, during this plan's own
> investigation, on a SECOND, unrelated crack of the SAME game (`saeger.d64`,
> cracked by a different group) -- the identical `BRK`-trick shape appears
> there too, at its own two computed-call sites."

**The mechanism distinction, stated plainly.** What Phase 36 found is NOT a
computed-INDEX dispatch table -- it is a `BRK` opcode (`$00`), whose own
hardware behaviour on a real 6502 forces control through the fixed vector at
`$FFFE`/`$FFFF` regardless of any register value. There is no `$6C`
(`JMP (abs)`) instruction at that BRK-trick site at all, so this plan's own
enumerator (a `$6C`-only scan, by design -- see this file's own header and
`evidence/proof02-enumerate-sites.mjs`'s) never sees it and never could: the
BRK trick and an indexed `disp_lo,x` / `disp_hi,x` dispatch table (this
plan's own Task 1 pivot-fixture case) are two entirely different control-flow
mechanisms that happen to share the property "the destination is not a fixed
literal in the code". Phase 36's finding is cited HERE, alongside this
plan's own `not-exercised` result, precisely because the two are
complementary, not duplicate: Phase 36 established that the ONE computed
transfer this depth's five entry points actually reach is unresolvable by
construction (an out-of-image vector target); this plan establishes that no
`JMP (abs)`-shaped indexed dispatch table exists anywhere in this same
extracted image's raw bytes for Ghidra to have even had a chance at
resolving. Neither result stands in for the other, and neither is read as an
answer about the packed game body plan `38-04` has yet to search.

## Closing

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

At or below `TEST_AUTOMATED_BASELINE: tests 3525 / pass 3512 / fail 2`
(`evidence/README.md`, measured post-`38-01`, cited here rather than
re-derived) -- both failures are the same pre-existing
`anno-register.test.ts` `STORE-*`/`MCP-04` undeclared-requirement-id
findings this phase does not touch.

`git status --porcelain` was confirmed to show no Ghidra project directory,
no `.prg`, no `.d64` and no export/run-log artifact inside the checkout --
every working file for this task lived under the two scratch roots named
above (`PROBE_DIR` for the corpus/dxa work, the sibling non-dot scratch root
for the Ghidra run), never inside this repository.

BROKER_STATE: inactive
