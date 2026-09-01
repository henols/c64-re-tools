# Evidence — dxa + Ghidra pivot (/gsd-explore, 2026-08-24)

Reproduction material for [[dxa-ghidra-pivot]] and
[[auto-annotation-from-ghidra-xrefs]]. Preserved here because the working copy
lived in `/tmp`, which is tmpfs on this host.

| File | What it is |
|---|---|
| `fixture.a` / `fixture.lbl` | The 279-byte synthetic fixture and its ground-truth symbols. 141 code / 138 data bytes. Exercises split pointer tables, RTS-trick dispatch, a full address table, a `cpx`-bounded indexed array, a stride-5 record array, inline `JSR` string parameters, and self-modifying code. Build: `acme -f cbm -o fixture.prg -l fixture.lbl fixture.a` |
| `dxa.out` | dxa 0.1.5 output, zero hints: `dxa -U -p all-nmos6502 -t detect-all -a enabled fixture.prg` |
| `anno.asm` | the external analyser 0.9.20 export from a fresh bootstrap, no annotation — the flat-decode baseline |
| `program.info` | Hand-written da65 info file used to establish da65's ceiling |
| `ApplyHints2.java` | Ghidra pre-script: applies dxa's discovered routines and data ranges |
| `ExportAnalysis.java` | Ghidra post-script, **listing-layer** export — demonstrates the trap: returns almost no structural facts on 6502 |
| `Decomp.java` | Ghidra post-script, **decompiler-layer** export — this is the one that works |
| `ghidra3.txt` | Ghidra 12.1.3 output with full dxa hints: 152 code bytes, 17 functions, 43 typed xrefs including the resolved `COMPUTED_JUMP` and the SMC `WRITE` |
| `decomp.c` | Ghidra 6502 decompiler output — contains the index bound (`!= 0x20`), the split-pointer `CONCAT11`, and the record stride (`+ 5`) |
| `bank.a` | Banking fixture: the same addresses mean different things under `$01` = `$37` / `$34` / `$33` |
| `bank.txt` | Ghidra output **without** volatile I/O — shows the silent dead-store deletion of hardware writes |
| `bank3.txt` | Ghidra output **with** volatile I/O — every `$01` literal preserved in program order |
| `BankProbe3.java` | The pre-script that sets the volatile blocks (note the `getBlock()`-first guard against `MemoryConflictException`) |
| `vic.a` / `vic.txt` | VIC-pointer fixture and Ghidra's recovery of `$DD00`/`$D018`/`$D011` including read-modify-write arithmetic |
| `vicderive.mjs` | Derives the graphics memory map (bank, screen, charset/bitmap, sprite pointers) from those recovered values |
| `autoannotate2.mjs` | The annotation join: `ghidra3.txt` xrefs x `memmap.json`. Run from anywhere: `node autoannotate2.mjs` (paths are absolute). Implements both selection rules. |

Ghidra was installed to `~/dev/_ghidra-probe` (1.4 GB) purely for this probe and
is safe to delete; nothing in the repo depends on that path.
