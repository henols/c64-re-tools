# OPC-01 criterion 2: the compile gate observed RED (Phase 36, plan 36-01, Task 2)

**What this record is:** a hand-run transcript proving the compile gate's own three-part
condition (exit 0 AND `.sla` produced AND its mtime strictly newer than every input) genuinely
FAILS when one of the eight sized-local fixes named in `36-RESEARCH.md`'s "The 8 failing SLEIGH
constructors and the verified fix" is reverted -- and that the committed tree compiles clean
again immediately afterwards. The revert happened ONLY inside a scratch copy; the committed
tree under `src/mcp/vice/vendor/ghidra-ext/` was never touched (`git status --porcelain` on
that directory read 0 lines both before and after this session, confirmed below).

This same observation is also encoded as a test case
(`sleigh-compile-gate.test.ts`'s `PLANTED VIOLATION` test, landed in the same commit as this
plan's Task 1 work), so the red is checked mechanically on every future run of the suite, not
only recorded here as a one-time transcript.

Environment: `GHIDRA_HOME=/home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC` (real Ghidra
12.1.3, the project's declared probe installation). Date: 2026-09-04.

## Part 1: the constructor reverted

The `:NOP imm16` constructor (`op=0x0c`, the "Absolute, three bytes" undocumented NOP), one of
the eight sites named in `36-RESEARCH.md`. Its FIXED form, as committed at
`src/mcp/vice/vendor/ghidra-ext/data/languages/6502_undocumented.sinc` line 232:

```
:NOP imm16 is op=0x0c; imm16
{
    local a16:2 = imm16;
    local ignored:1 = *:1 a16;
}
```

Reverted, in a scratch copy only, to its PRE-fix form -- the raw `imm16` token field passed
directly to the dereference, with no sized local introduced first:

```
:NOP imm16 is op=0x0c; imm16
{
    local ignored:1 = *:1 imm16;
}
```

## Part 2: the command and the red observation

A scratch tree was built by copying the six committed vendored-extension files plus the three
stock 6502 language files (`6502.slaspec`, `6502.pspec`, `6502.cspec`, copied from
`$GHIDRA_HOME/Ghidra/Processors/6502/data/languages/`, per D-36-02 -- never committed into this
repository), the revert above applied to the SCRATCH copy's own `6502_undocumented.sinc`, then:

```
$ /home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/support/sleigh 6502_nmos.slaspec 6502_nmos.sla
```

**Output (verbatim, JDK banner omitted):**

```
ERROR 6502_undocumented.sinc:232: in table "instruction" constructor from 6502_undocumented.sinc:232 (SleighCompile)
ERROR 6502_undocumented.sinc:232: 6502_undocumented.sinc:234:    Main section: Could not resolve at least 1 variable size (SleighCompile)
WARN  2 NOP constructors found (SleighCompile)
WARN  Use -n switch to list each individually (SleighCompile)
ERROR No output produced (SleighCompile)
```

| Field | Value |
|---|---|
| Exit status | **2** (non-zero) |
| Error text | `Could not resolve at least 1 variable size` |
| Line named | `6502_undocumented.sinc:232` (the reverted constructor's own opening line) and `:234` (the failing statement inside it) |
| `.sla` produced? | **No** -- `ls 6502_nmos.sla` reports "No such file or directory" |

The gate's three-part condition (exit 0 AND `.sla` present AND mtime strictly newer than every
input) is unambiguously NOT satisfied: the exit status alone already fails it, and there is no
`.sla` at all to check an mtime against. This is asserted on the compiler's OWN error text
(`Could not resolve at least 1 variable size`, naming line 232) -- not merely on a differing
exit status, per this task's own requirement.

## Part 3: the committed tree compiles clean immediately afterwards

A SECOND, independent scratch tree was built from the same six committed files (untouched --
no revert applied) plus the same three stock files, and compiled with the identical command:

```
$ /home/henrik/dev/_ghidra-probe/ghidra_12.1.3_PUBLIC/support/sleigh 6502_nmos.slaspec 6502_nmos.sla
```

**Output (verbatim, JDK banner omitted):**

```
WARN  2 NOP constructors found (SleighCompile)
WARN  Use -n switch to list each individually (SleighCompile)
WARN  5 operations wrote to temporaries that were not read (SleighCompile)
WARN  Use -t switch to list each individually (SleighCompile)
WARN  6502.slaspec:119: Unreferenced table: 'ADDR8' (SleighCompile)
```

| Field | Value |
|---|---|
| Exit status | **0** |
| Errors | none |
| `.sla` produced? | Yes -- 8435 bytes |
| Warnings | exactly the two expected (`2 NOP constructors found`, `5 operations wrote to temporaries that were not read`), plus one pre-existing warning inherited from STOCK `6502.slaspec` itself (`Unreferenced table: 'ADDR8'`, confirmed separately to appear even compiling `6502.slaspec` alone with no extension present) |

Green immediately after red, on the identical committed source, with only the scratch copy's
own revert removed.

## Working-tree check

```
$ git status --porcelain src/mcp/vice/vendor/ghidra-ext/
```

produced 0 lines both immediately before this session's scratch work began and immediately
after both scratch trees were torn down -- the revert lived only inside a `mkdtempSync`
directory under this host's RAM-backed `/tmp`, never inside the committed tree.

## Eight red observations are available for free; one was taken

`36-RESEARCH.md`'s own table names eight independent sites, each of which reproduces this same
"`Could not resolve at least 1 variable size`" failure when its own sized-local fix is reverted:
`:NOP imm16` (`op=0x0c`, taken above), `:LAX "#"imm8` (`op=0xab`), `:SBC "#"imm8` (`op=0xeb`),
`:XAA "#"imm8` (`op=0x8b`), `:AHX imm16,Y` (`op=0x9f`), `:TAS imm16,Y` (`op=0x9b`), `:SHY
imm16,X` (`op=0x9c`), and `:SHX imm16,Y` (`op=0x9e`). This record takes the first
(`:NOP imm16`) as its single hand-run demonstration, per this task's own instruction that one
observation suffices and the other seven are recorded as available rather than separately run
by hand.
