# Third-Party Notices for `@henols/vice-mcp`

This package is MIT-licensed (see `LICENSE` at the repository root, copyright
Henrik Olsson). This file lists third-party material incorporated into, or
relied on by, `@henols/vice-mcp`, with a provenance line per source.

**GPL-2.0-or-later source IS incorporated into this repository, under `src/mcp/vice/vendor/dxa/` (Phase 35, DXA-01).** That source is build-time-only input — vendored to be compiled by `vendor/dxa/build.bash` into a host-side binary this project's host-tool execution seam spawns as a subprocess, never imported by, linked into, or shipped inside the published `@henols/vice-mcp` tarball (A-06: `src/mcp/vice/package.json`'s `files[]` deliberately omits `vendor/dxa/` and the `dxa-*` modules that consume it). Every OTHER source named below is either zlib-licensed (incorporated), reference-only (nothing copied), or a build/test-time subprocess whose licence therefore never attaches to anything shipped.

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

## Incorporated material — dxa (GPL-2.0-or-later)

`src/mcp/vice/vendor/dxa/` vendors the upstream-unmodified, GPL-licensed
source of [dxa](https://www.floodgap.com/retrotech/xa/dists/dxa-0.1.5.tar.gz)
0.1.5 (37,987 bytes, 25 Mar 2022), the symbolic 65xx disassembler this
project's byte-level code/data discovery engine builds and spawns
(`DXA-01`). The tarball is pinned by `dxa-0.1.5.tar.gz.sha256`
(`8e40ed77816581f9ad95acac2ed69a2fb2ac7850e433d19cd684193a45826799`), written
to this repository BEFORE the tarball was ever fetched, and re-verified
byte-for-byte against that pin by `vendor/dxa/build.bash` on every run.

The tarball ships **no `LICENSE` and no `COPYING` file** — the GPL grant
lives only in a header comment repeated (with per-file variance, below) at
the top of every vendored `.c`/`.h` file. This project therefore supplies the
full GPL licence text itself, reproduced in full further down this section.

`main.c`'s header, quoted verbatim from `src/mcp/vice/vendor/dxa/main.c`:

```
/*\
 *  dxa -- symbolic 65xx disassembler
 *
 *  Based on d65 Copyright (C) 1993, 1994 Marko M\"akel\"a
 *  Changes for dxa (C) 2005-2019 Cameron Kaiser
 *
 *  This program is free software; you can redistribute it and/or modify
 *  it under the terms of the GNU General Public License as published by
 *  the Free Software Foundation; either version 2 of the License, or
 *  (at your option) any later version.
 *
 *  This program is distributed in the hope that it will be useful,
 *  but WITHOUT ANY WARRANTY; without even the implied warranty of
 *  MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 *  GNU General Public License for more details.
 *
 *  You should have received a copy of the GNU General Public License
 *  along with this program; if not, write to the Free Software
 *  Foundation, Inc., 675 Mass Ave, Cambridge, MA 02139, USA.
 *
 *  Marko does not maintain dxa, so questions specific to dxa should be
 *  sent to me at ckaiser@floodgap.com.
 *
\*/
```

**Per-file copyright variance — recorded rather than flattened.** Every
vendored `.c` file carries the `dxa -- symbolic 65xx disassembler` /
`GNU General Public License` (GPL) header block, but the copyright line
itself differs by file, reflecting dxa's own history as a fork of Marko
Mäkelä's `d65`:

- `table.c` and `vector.c` carry only the original `Copyright (C) 1993, 1994
  Marko M\"akel\"a` line (their header still identifies as `dxa v0.1.1`,
  an earlier version string than the tarball's own 0.1.5) — no Cameron
  Kaiser line at all.
- `scan.c` and `label.c` carry `Copyright (C) 1993, 1994 Marko M\"akel\"a`
  followed by a separate `Copyright (C) 2019 Cameron Kaiser` line.
- `dump.c` carries `Copyright (C) 1993, 1994 Marko M\"akel\"a` followed by
  `Changes for dxa (C) 2004-2019 Cameron Kaiser` (note: 2004, one year
  earlier than `main.c`'s own 2005-2019 span for the same "Changes for dxa"
  wording).
- `main.c` (quoted above) carries `Based on d65 Copyright (C) 1993, 1994
  Marko M\"akel\"a` followed by `Changes for dxa (C) 2005-2019 Cameron
  Kaiser`.

Every one of `ChangeLog`, `dump.c`, `dxa.1`, `INSTALL`, `label.c`, `main.c`,
`Makefile`, `opcodes.h`, `options.h`, `proto.h`, `scan.c`, `structures.h`,
`table.c`, `tests/Makefile`, `tests/test01.t`, `tests/test02.t`, `vector.c`
is upstream-unmodified and every `.c` file's header names the same GPL
grant — nothing added, nothing removed, nothing patched
(`vendor/dxa/build.bash`'s `verify` step asserts this byte-for-byte on every
run, not merely at vendoring time).

`vendor/dxa/build.bash` — never a package manager, never `$PATH` — is the
only supported way to obtain a built `dxa` binary; the built binary and every
`.o` intermediate are gitignored, never committed (host-architecture-specific
artifacts a digest gate could not otherwise defend). Full text of the GPL
licence dxa is offered under — the GNU General Public License, Version 2,
June 1991 — reproduced below because the upstream tarball ships none:

```
                    GNU GENERAL PUBLIC LICENSE
                       Version 2, June 1991

 Copyright (C) 1989, 1991 Free Software Foundation, Inc.,
 <https://fsf.org/>
 Everyone is permitted to copy and distribute verbatim copies
 of this license document, but changing it is not allowed.

                            Preamble

  The licenses for most software are designed to take away your
freedom to share and change it.  By contrast, the GNU General Public
License is intended to guarantee your freedom to share and change free
software--to make sure the software is free for all its users.  This
General Public License applies to most of the Free Software
Foundation's software and to any other program whose authors commit to
using it.  (Some other Free Software Foundation software is covered by
the GNU Lesser General Public License instead.)  You can apply it to
your programs, too.

  When we speak of free software, we are referring to freedom, not
price.  Our General Public Licenses are designed to make sure that you
have the freedom to distribute copies of free software (and charge for
this service if you wish), that you receive source code or can get it
if you want it, that you can change the software or use pieces of it
in new free programs; and that you know you can do these things.

  To protect your rights, we need to make restrictions that forbid
anyone to deny you these rights or to ask you to surrender the rights.
These restrictions translate to certain responsibilities for you if you
distribute copies of the software, or if you modify it.

  For example, if you distribute copies of such a program, whether
gratis or for a fee, you must give the recipients all the rights that
you have.  You must make sure that they, too, receive or can get the
source code.  And you must show them these terms so they know their
rights.

  We protect your rights with two steps: (1) copyright the software, and
(2) offer you this license which gives you legal permission to copy,
distribute and/or modify the software.

  Also, for each author's protection and ours, we want to make certain
that everyone understands that there is no warranty for this free
software.  If the software is modified by someone else and passed on, we
want its recipients to know that what they have is not the original, so
that any problems introduced by others will not reflect on the original
authors' reputations.

  Finally, any free program is threatened constantly by software
patents.  We wish to avoid the danger that redistributors of a free
program will individually obtain patent licenses, in effect making the
program proprietary.  To prevent this, we have made it clear that any
patent must be licensed for everyone's free use or not licensed at all.

  The precise terms and conditions for copying, distribution and
modification follow.

                    GNU GENERAL PUBLIC LICENSE
   TERMS AND CONDITIONS FOR COPYING, DISTRIBUTION AND MODIFICATION

  0. This License applies to any program or other work which contains
a notice placed by the copyright holder saying it may be distributed
under the terms of this General Public License.  The "Program", below,
refers to any such program or work, and a "work based on the Program"
means either the Program or any derivative work under copyright law:
that is to say, a work containing the Program or a portion of it,
either verbatim or with modifications and/or translated into another
language.  (Hereinafter, translation is included without limitation in
the term "modification".)  Each licensee is addressed as "you".

Activities other than copying, distribution and modification are not
covered by this License; they are outside its scope.  The act of
running the Program is not restricted, and the output from the Program
is covered only if its contents constitute a work based on the
Program (independent of having been made by running the Program).
Whether that is true depends on what the Program does.

  1. You may copy and distribute verbatim copies of the Program's
source code as you receive it, in any medium, provided that you
conspicuously and appropriately publish on each copy an appropriate
copyright notice and disclaimer of warranty; keep intact all the
notices that refer to this License and to the absence of any warranty;
and give any other recipients of the Program a copy of this License
along with the Program.

You may charge a fee for the physical act of transferring a copy, and
you may at your option offer warranty protection in exchange for a fee.

  2. You may modify your copy or copies of the Program or any portion
of it, thus forming a work based on the Program, and copy and
distribute such modifications or work under the terms of Section 1
above, provided that you also meet all of these conditions:

    a) You must cause the modified files to carry prominent notices
    stating that you changed the files and the date of any change.

    b) You must cause any work that you distribute or publish, that in
    whole or in part contains or is derived from the Program or any
    part thereof, to be licensed as a whole at no charge to all third
    parties under the terms of this License.

    c) If the modified program normally reads commands interactively
    when run, you must cause it, when started running for such
    interactive use in the most ordinary way, to print or display an
    announcement including an appropriate copyright notice and a
    notice that there is no warranty (or else, saying that you provide
    a warranty) and that users may redistribute the program under
    these conditions, and telling the user how to view a copy of this
    License.  (Exception: if the Program itself is interactive but
    does not normally print such an announcement, your work based on
    the Program is not required to print an announcement.)

These requirements apply to the modified work as a whole.  If
identifiable sections of that work are not derived from the Program,
and can be reasonably considered independent and separate works in
themselves, then this License, and its terms, do not apply to those
sections when you distribute them as separate works.  But when you
distribute the same sections as part of a whole which is a work based
on the Program, the distribution of the whole must be on the terms of
this License, whose permissions for other licensees extend to the
entire whole, and thus to each and every part regardless of who wrote it.

Thus, it is not the intent of this section to claim rights or contest
your rights to work written entirely by you; rather, the intent is to
exercise the right to control the distribution of derivative or
collective works based on the Program.

In addition, mere aggregation of another work not based on the Program
with the Program (or with a work based on the Program) on a volume of
a storage or distribution medium does not bring the other work under
the scope of this License.

  3. You may copy and distribute the Program (or a work based on it,
under Section 2) in object code or executable form under the terms of
Sections 1 and 2 above provided that you also do one of the following:

    a) Accompany it with the complete corresponding machine-readable
    source code, which must be distributed under the terms of Sections
    1 and 2 above on a medium customarily used for software interchange; or,

    b) Accompany it with a written offer, valid for at least three
    years, to give any third party, for a charge no more than your
    cost of physically performing source distribution, a complete
    machine-readable copy of the corresponding source code, to be
    distributed under the terms of Sections 1 and 2 above on a medium
    customarily used for software interchange; or,

    c) Accompany it with the information you received as to the offer
    to distribute corresponding source code.  (This alternative is
    allowed only for noncommercial distribution and only if you
    received the program in object code or executable form with such
    an offer, in accord with Subsection b above.)

The source code for a work means the preferred form of the work for
making modifications to it.  For an executable work, complete source
code means all the source code for all modules it contains, plus any
associated interface definition files, plus the scripts used to
control compilation and installation of the executable.  However, as a
special exception, the source code distributed need not include
anything that is normally distributed (in either source or binary
form) with the major components (compiler, kernel, and so on) of the
operating system on which the executable runs, unless that component
itself accompanies the executable.

If distribution of executable or object code is made by offering
access to copy from a designated place, then offering equivalent
access to copy the source code from the same place counts as
distribution of the source code, even though third parties are not
compelled to copy the source along with the object code.

  4. You may not copy, modify, sublicense, or distribute the Program
except as expressly provided under this License.  Any attempt
otherwise to copy, modify, sublicense or distribute the Program is
void, and will automatically terminate your rights under this License.
However, parties who have received copies, or rights, from you under
this License will not have their licenses terminated so long as such
parties remain in full compliance.

  5. You are not required to accept this License, since you have not
signed it.  However, nothing else grants you permission to modify or
distribute the Program or its derivative works.  These actions are
prohibited by law if you do not accept this License.  Therefore, by
modifying or distributing the Program (or any work based on the
Program), you indicate your acceptance of this License to do so, and
all its terms and conditions for copying, distributing or modifying
the Program or works based on it.

  6. Each time you redistribute the Program (or any work based on the
Program), the recipient automatically receives a license from the
original licensor to copy, distribute or modify the Program subject to
these terms and conditions.  You may not impose any further
restrictions on the recipients' exercise of the rights granted herein.
You are not responsible for enforcing compliance by third parties to
this License.

  7. If, as a consequence of a court judgment or allegation of patent
infringement or for any other reason (not limited to patent issues),
conditions are imposed on you (whether by court order, agreement or
otherwise) that contradict the conditions of this License, they do not
excuse you from the conditions of this License.  If you cannot
distribute so as to satisfy simultaneously your obligations under this
License and any other pertinent obligations, then as a consequence you
may not distribute the Program at all.  For example, if a patent
license would not permit royalty-free redistribution of the Program by
all those who receive copies directly or indirectly through you, then
the only way you could satisfy both it and this License would be to
refrain entirely from distribution of the Program.

If any portion of this section is held invalid or unenforceable under
any particular circumstance, the balance of the section is intended to
apply and the section as a whole is intended to apply in other
circumstances.

It is not the purpose of this section to induce you to infringe any
patents or other property right claims or to contest validity of any
such claims; this section has the sole purpose of protecting the
integrity of the free software distribution system, which is
implemented by public license practices.  Many people have made
generous contributions to the wide range of software distributed
through that system in reliance on consistent application of that
system; it is up to the author/donor to decide if he or she is willing
to distribute software through any other system and a licensee cannot
impose that choice.

This section is intended to make thoroughly clear what is believed to
be a consequence of the rest of this License.

  8. If the distribution and/or use of the Program is restricted in
certain countries either by patents or by copyrighted interfaces, the
original copyright holder who places the Program under this License
may add an explicit geographical distribution limitation excluding
those countries, so that distribution is permitted only in or among
countries not thus excluded.  In such case, this License incorporates
the limitation as if written in the body of this License.

  9. The Free Software Foundation may publish revised and/or new versions
of the General Public License from time to time.  Such new versions will
be similar in spirit to the present version, but may differ in detail to
address new problems or concerns.

Each version is given a distinguishing version number.  If the Program
specifies a version number of this License which applies to it and "any
later version", you have the option of following the terms and conditions
either of that version or of any later version published by the Free
Software Foundation.  If the Program does not specify a version number of
this License, you may choose any version ever published by the Free Software
Foundation.

  10. If you wish to incorporate parts of the Program into other free
programs whose distribution conditions are different, write to the author
to ask for permission.  For software which is copyrighted by the Free
Software Foundation, write to the Free Software Foundation; we sometimes
make exceptions for this.  Our decision will be guided by the two goals
of preserving the free status of all derivatives of our free software and
of promoting the sharing and reuse of software generally.

                            NO WARRANTY

  11. BECAUSE THE PROGRAM IS LICENSED FREE OF CHARGE, THERE IS NO WARRANTY
FOR THE PROGRAM, TO THE EXTENT PERMITTED BY APPLICABLE LAW.  EXCEPT WHEN
OTHERWISE STATED IN WRITING THE COPYRIGHT HOLDERS AND/OR OTHER PARTIES
PROVIDE THE PROGRAM "AS IS" WITHOUT WARRANTY OF ANY KIND, EITHER EXPRESSED
OR IMPLIED, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE.  THE ENTIRE RISK AS
TO THE QUALITY AND PERFORMANCE OF THE PROGRAM IS WITH YOU.  SHOULD THE
PROGRAM PROVE DEFECTIVE, YOU ASSUME THE COST OF ALL NECESSARY SERVICING,
REPAIR OR CORRECTION.

  12. IN NO EVENT UNLESS REQUIRED BY APPLICABLE LAW OR AGREED TO IN WRITING
WILL ANY COPYRIGHT HOLDER, OR ANY OTHER PARTY WHO MAY MODIFY AND/OR
REDISTRIBUTE THE PROGRAM AS PERMITTED ABOVE, BE LIABLE TO YOU FOR DAMAGES,
INCLUDING ANY GENERAL, SPECIAL, INCIDENTAL OR CONSEQUENTIAL DAMAGES ARISING
OUT OF THE USE OR INABILITY TO USE THE PROGRAM (INCLUDING BUT NOT LIMITED
TO LOSS OF DATA OR DATA BEING RENDERED INACCURATE OR LOSSES SUSTAINED BY
YOU OR THIRD PARTIES OR A FAILURE OF THE PROGRAM TO OPERATE WITH ANY OTHER
PROGRAMS), EVEN IF SUCH HOLDER OR OTHER PARTY HAS BEEN ADVISED OF THE
POSSIBILITY OF SUCH DAMAGES.

                     END OF TERMS AND CONDITIONS

            How to Apply These Terms to Your New Programs

  If you develop a new program, and you want it to be of the greatest
possible use to the public, the best way to achieve this is to make it
free software which everyone can redistribute and change under these terms.

  To do so, attach the following notices to the program.  It is safest
to attach them to the start of each source file to most effectively
convey the exclusion of warranty; and each file should have at least
the "copyright" line and a pointer to where the full notice is found.

    <one line to give the program's name and a brief idea of what it does.>
    Copyright (C) <year>  <name of author>

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, see <https://www.gnu.org/licenses/>.

Also add information on how to contact you by electronic and paper mail.

If the program is interactive, make it output a short notice like this
when it starts in an interactive mode:

    Gnomovision version 69, Copyright (C) year name of author
    Gnomovision comes with ABSOLUTELY NO WARRANTY; for details type `show w'.
    This is free software, and you are welcome to redistribute it
    under certain conditions; type `show c' for details.

The hypothetical commands `show w' and `show c' should show the appropriate
parts of the General Public License.  Of course, the commands you use may
be called something other than `show w' and `show c'; they could even be
mouse-clicks or menu items--whatever suits your program.

You should also get your employer (if you work as a programmer) or your
school, if any, to sign a "copyright disclaimer" for the program, if
necessary.  Here is a sample; alter the names:

  Yoyodyne, Inc., hereby disclaims all copyright interest in the program
  `Gnomovision' (which makes passes at compilers) written by James Hacker.

  <signature of Moe Ghoul>, 1 April 1989
  Moe Ghoul, President of Vice

This General Public License does not permit incorporating your program into
proprietary programs.  If your program is a subroutine library, you may
consider it more useful to permit linking proprietary applications with the
library.  If this is what you want to do, use the GNU Lesser General
Public License instead of this License.
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
appears in `src/mcp/vice/package.json`'s `files[]`, `dependencies`, or
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
