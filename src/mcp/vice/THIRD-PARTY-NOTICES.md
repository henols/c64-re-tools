# Third-Party Notices for `@henols/vice-mcp`

This package is MIT-licensed (see `LICENSE` at the repository root, copyright
Henrik Olsson). This file lists third-party material incorporated into, or
relied on by, `@henols/vice-mcp`, with a provenance line per source.

**No GPL-licensed material is incorporated into this package: no GPL-licensed material appears anywhere in `@henols/vice-mcp`'s source or its published tarball.** Every source named below is either zlib-licensed (incorporated), `MIT OR Apache-2.0`-licensed (incorporated — the adapted regenerator2000 analysis procedures under `src/skills/`, see below), reference-only (nothing copied), or a build/test-time subprocess whose licence therefore never attaches to anything shipped.

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

## Incorporated material — regenerator2000 analysis procedures (MIT OR Apache-2.0)

This repository's skill playbooks under `src/skills/` incorporate prose
**adapted** from regenerator2000's own analysis procedures. The source is the
GitHub repository <https://github.com/ricardoquesada/regenerator2000> at the
pinned commit `493f840418f1450a342bb220c2fe3d2585dd0525` (tag `v0.9.20`,
authored 2026-07-11 by Ricardo Quesada). The pin is corroborated independently
of the tag: the installed crate's own `.cargo_vcs_info.json` records
`"sha1": "493f840418f1450a342bb220c2fe3d2585dd0525"`, so the crates.io 0.9.20
release — the binary this project actually drives — was published from exactly
this commit.

The procedure text is **not** in the published crate: `Cargo.toml`'s `exclude`
list drops `.agent/**/*`, so the GitHub repository at the pin is the only
source for it. The five pinned source files, their digests over the raw
upstream bytes, and this project's destination for each:

| Upstream source path (at the pin) | sha256 | Bytes | Destination in this repository | Incorporated as of this commit |
| --- | --- | --- | --- | --- |
| `.agent/skills/r2000-analyze-basic/SKILL.md` | `8fc662ce52a1c947e0b57b92a8efb8e2f387a4cdad117de2b5300f50d44c23a2` | 4457 | `src/skills/c64-program-recon/` | **yes** |
| `.agent/skills/r2000-analyze-blocks/SKILL.md` | `3fad6193466a20fa0d2f56a7e38a740fa7218b920aa36e348bc65273c987aa1b` | 14674 | `src/skills/c64-memory-mapping/` | **yes** |
| `.agent/skills/r2000-analyze-program/SKILL.md` | `2d1c91bcc612c00ce71b7def08917b59ca7e495aa61f9075cbb0795e935f6955` | 15308 | `src/skills/routine-queue-walker/` | **yes** |
| `.agent/skills/r2000-analyze-routine/SKILL.md` | `6fd26337de42b2d8f7da570ec7c5aa47072818f4cede675d8189930cadbe2730` | 9248 | `src/skills/c64-program-recon/` | **yes** |
| `.agent/skills/r2000-analyze-symbol/SKILL.md` | `d57d9c2fdfa1c3e2f8a6384a881378ad1e3e371114c3b0b8d15ec1c71b3b4da8` | 9705 | `src/skills/c64-memory-mapping/` | **yes** |

**Total pinned upstream corpus: 53,392 bytes across five files, all five now
incorporated** (the first by plan 19-01, the remaining four by plan 19-02).
The final column is maintained per absorbed file, so this section never claims
incorporation that has not happened yet; the machine-readable record — paths,
digests, per-call dispositions and the re-sync triggers — is
`.planning/phases/19-absorbed-procedures-and-the-coverage-instrument/upstream-procedure-manifest.json`,
and `src/mcp/vice/skill-attribution.test.ts` asserts each absorbed file's own
header agrees with it, one registry row per source path.

Two destinations appear twice in the table above, and that is not a duplicate:
`src/skills/c64-memory-mapping/` and `src/skills/c64-program-recon/` each
incorporate **two** upstream procedures, with two different digests. Each of
the two therefore carries **two** attribution headers, one per source path —
a single per-file header would have to claim one digest and be wrong about the
other.

**The incorporated text is ADAPTED, NOT VERBATIM.** Each absorbed file carries
its own attribution header naming the source path, the pinned commit, the
source digest, the licence, and — individually — the deviations this project
made from the upstream instructions (upstream's parallel subagent fan-out is
not carried; runtime reads of the upstream repository's excluded agent-skills
directory are replaced with this project's own skill paths; the cursor-based
entry route is replaced by explicit address input; upstream tool steps this
project does not expose are omitted or re-routed). That per-file header is the
authoritative statement for the file it sits in.

regenerator2000 is dual-licensed **`MIT OR Apache-2.0`** — at the user's
option — `Copyright (c) 2026 Ricardo Quesada` (`LICENSE-MIT:3` at the pin;
both `LICENSE-MIT` and `LICENSE-APACHE` ship in the repository and the crate).

**This project elects MIT** for the incorporated text. MIT matches this
repository's own licence, so the incorporated prose and its host carry the
same terms and a downstream consumer has one set of obligations rather than
two. The Apache-2.0 §4(b) modification-notice obligation would in any case be
discharged by the "ADAPTED, NOT VERBATIM" statement and the named deviations
in every per-file header, so the election costs nothing in disclosure — the
modification notice is present either way. The MIT permission notice and
copyright above travel inside every absorbed file's header, which is what
ships in both published tarballs.

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
appears in `src/mcp/vice/package.json`'s `files[]`, `dependencies`, or
`devDependencies` — it is an apt/CI-installed tool, never an npm package.

## Build/CI tools — the regenerator2000 binary itself is not incorporated

**Scope note (Phase 19):** this section is about the regenerator2000
**program** — the binary this project spawns. It is no longer a blanket claim
about the repository. Prose adapted from regenerator2000's analysis
procedures **is** incorporated into `src/skills/`; see "Incorporated material
— regenerator2000 analysis procedures" above, which is the canonical section
for it.

regenerator2000 is invoked as an **external CLI subprocess** (Phase 10's
`R2000-09` bootstrap and `R2000-06` reassembly proof) against a real,
locally-installed `regenerator2000` binary. **Nothing from regenerator2000's
own implementation — no source code, no data table, no captured program
output — is included in this repository or in either published package**: no
Rust source, no packer-signature table, no opcode or block-type data, no
recorded tool response. Nothing of the binary's implementation is
redistributed here.

Its licence is **`MIT OR Apache-2.0`** — dual, at the user's option —
confirmed from the crate's own crates.io licence field, with both
`LICENSE-MIT` and `LICENSE-APACHE` shipping in the crate. (Do not read this
as Apache-2.0 alone: that stale, single-licence claim is what `R2000-03`'s
own requirement text and `.planning/notes/regenerator2000-integration.md`
still carried before Phase 10 corrected it here.)

Verified version `0.9.20`, published 2026-07-11 by `ricardoquesada`
(matching the linked GitHub repository owner), checked 2026-08-20 — so this
provenance claim is re-checkable against a specific release.

regenerator2000 never appears in `src/mcp/vice/package.json`'s
`files[]`, `dependencies`, or `devDependencies` — it is a `cargo
install`-provided tool, never an npm package.

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
