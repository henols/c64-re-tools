# Third-Party Notices for `@henols/vice-mcp`

This package is MIT-licensed (see `LICENSE` at the repository root, copyright
Henrik Olsson). This file lists third-party material incorporated into, or
relied on by, `@henols/vice-mcp`, with a provenance line per source.

**No GPL-licensed material is incorporated into this package: no GPL-licensed material appears anywhere in `@henols/vice-mcp`'s source or its published tarball.** Every source named below is either zlib-licensed (incorporated), reference-only (nothing copied), or a build/test-time subprocess whose licence therefore never attaches to anything shipped.

## Incorporated material — cc65 (zlib)

The 6502/6510 opcode table in `disasm-opcodes.ts` (mnemonics, addressing
modes, instruction lengths) is transcribed by hand from cc65's
`src/da65/opc6502x.c`, fetched raw
(`https://raw.githubusercontent.com/cc65/cc65/master/src/da65/opc6502x.c`)
against `master` @ commit `547d923588d870aacf0b0016c67d0f6a92a70f83`
(2026-07-11). The table itself was last touched upstream at commit
`02e79d35d73efd31522b5eab986d1919e3560bba` (2025-06-19, "making da65 produce
the same mnemonics as ca65 uses"). This is the only incorporated third-party
material the disassembler carries — the derived-data files
(`disasm-decoder.ts`, `disasm-renderer.ts`, `stock-disassemble.ts`) contain no
further transcribed material of their own.

cc65 is zlib-licensed, copyright cc65's own author:

```
(C) 2003-2011, Ullrich von Bassewitz
```

Full zlib licence text, reproduced below, satisfies the origin-must-not-be-
misrepresented and altered-versions-must-be-marked obligations for this
transcription (see `disasm-opcodes.ts`'s own header comment for the
attribution as it appears in-source):

```
This software is provided 'as-is', without any express or implied
warranty. In no event will the authors be held liable for any damages
arising from the use of this software.

Permission is granted to anyone to use this software for any purpose,
including commercial applications, and to alter it and redistribute it
freely, subject to the following restrictions:

1. The origin of this software must not be misrepresented; you must not
   claim that you wrote the original software. If you use this software
   in a product, an acknowledgment in the product documentation would be
   appreciated but is not required.

2. Altered source versions must be plainly marked as such, and must not be
   misrepresented as being the original software.

3. This notice may not be removed or altered from any source distribution.
```

## Reference-only cross-checks (no code or data taken)

masswerk.at's 6502 instruction-set reference
(https://www.masswerk.at/6502/6502_instruction_set.html) and
www.oxyron.de/html/opcodes02.html were consulted to cross-check the
illegal-opcode addressing modes, the 27-opcode NOP class (across 6
addressing-mode groups), the 12 JAM opcodes, and the NMOS `JMP ($xxFF)`
page-wrap behaviour. **Nothing was copied from either site** — both are
cited here as verification aids only, and the table's actual independent
cross-check is `disasm-opcodes.test.ts`'s bit-pattern derivation test plus
`disasm-roundtrip.test.ts`'s byte-exact real-ACME round-trip.

## Build/CI tools — not incorporated

The ACME cross-assembler (GPL) is invoked as a **subprocess in tests only**
(`disasm-roundtrip.test.ts`), against a real, locally- or CI-installed ACME
binary (verified as release `0.97 ("Zem")`, 31 Jan 2021, by 04-06's own
availability gate; CI installs it via `apt-get install -y acme` in
`.github/workflows/ci.yml`'s `build` job). **No ACME source, header, data
table or output is included in this repository or in the published
package**, so ACME's licence does not attach to anything shipped. ACME never
appears in `.claude/mcp/vice/package.json`'s `files[]`, `dependencies`, or
`devDependencies` — it is an apt/CI-installed tool, never an npm package.

## Explicitly NOT a source: VICE

VICE is GPL-2 and this repository is MIT. **No opcode fact, protocol
constant, or line of code in this repository is sourced from VICE's own
source tree.** The stock backend is built against the binary-monitor
**protocol** as documented in `docs/phase0-binmon-findings.md`, derived from
independent probing against a running VICE binary, never from reading VICE's
own C source.

## Explicitly NOT a source: `fluffy-6502`

`fluffy-6502`, named in `.planning/ROADMAP.md` and in 04-CONTEXT.md D-06 as an
MIT cross-check source, **could not be located under that name** on GitHub or
the general web during Phase 4 research (`04-RESEARCH.md` Assumptions Log
A1 / Pitfall 5). It was therefore **not used and is not cited** as a source
of this table — a notices entry naming a project whose URL 404s would
overstate what was actually checked. The opcode table's independent
verification instead comes from `disasm-opcodes.test.ts`'s `aaabbbcc`
bit-pattern derivation test and `disasm-roundtrip.test.ts`'s byte-exact
real-ACME round-trip — both stronger checks than a second static table would
have been.

## Existing runtime dependencies

`@henols/vice-mcp`'s only two runtime dependencies, unchanged by Phase 4:

- **`@mastra/mcp`** (`1.15.0`) — MCP server/tooling framework. See its own
  package licence (MIT) on the npm registry.
- **`@mastra/core`** (`1.55.0`) — underlying Mastra runtime `@mastra/mcp`
  depends on. See its own package licence (MIT) on the npm registry.

No new runtime dependency was added by the disassembler (`disasm-opcodes.ts`,
`disasm-decoder.ts`, `disasm-renderer.ts`, `stock-disassemble.ts` import only
this package's own sibling modules and Node built-ins). This is a checkable
claim, not a prose one: `scripts/check-npm-packages.mjs` asserts the packed
tarball's runtime `dependencies` are exactly these two, by key set and count.
