# Research Questions

Open questions surfaced during exploration, awaiting deeper investigation.

## Does dxa + Ghidra hold up on a real cracked release?
_Raised 2026-08-24 via /gsd-explore — see [[dxa-ghidra-pivot]]_

Every number behind the pivot (dxa 72% data recovery / 0 false positives;
Ghidra's computed-jump and SMC-write resolution; the 18/18 auto-annotation
join) comes from **one 279-byte fixture written by the same person testing
it**. The constructs are real and the tools are real, but a fixture author's
dispatch table is friendlier than a demo coder's.

Answerable against the existing `c64-provenance-diff` fixtures — real releases,
already committed, already provenance-classified. Specific things to measure:

- dxa's data-recovery rate and false-positive count on real packed/cracked code
- whether Ghidra's constant propagation still resolves indirect dispatch when
  the index is computed rather than an immediate `ldx #$02`
- whether the `analyzer.rs`-shaped work we are dropping was doing something the
  dxa+Ghidra pair does not replace
- how the auto-annotation join's two selection rules behave against code that
  banks ROM in and out (an address's meaning becomes bank-dependent, which
  `memmap.json`'s flat address model does not express)

That last one is the most likely to invalidate something.

## Does Ghidra's 6502 decompiler degrade on illegal opcodes in real code?
_Raised 2026-08-24 via /gsd-explore_

Ghidra 12.1.3's `6502.slaspec` defines 57 instructions, all documented — no
illegal NMOS opcodes and no `illegal`/`undocumented` handling. dxa covers the
gap for *discovery* (`-p all-nmos6502`), but Ghidra still has to decompile the
surrounding code. Unknown whether an undecodable byte stops the decompiler at
that instruction, poisons the whole function, or is silently skipped — and the
answer decides whether a custom SLEIGH extension is needed or whether dxa's
coverage is sufficient in practice.
