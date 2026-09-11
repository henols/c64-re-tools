---
title: c64-memory-mapping's 623-line SKILL.md covers three jobs under a description promising one
date: 2026-09-11
priority: low
source: /gsd-explore — skill redundancy audit
---

# What

`src/skills/c64-memory-mapping/SKILL.md` is 623 lines — the second-largest shipped SKILL.md —
and covers three distinct jobs:

    §24-226    Look up an address / annotate a listing / read annotations / feed the enum
               generator          -- published-address resolution, from four tables
    §227-473   Classifying every region of an annotation project -- block types, pass order,
               the adjacent-table limitation, labelling and the report
    §474-612   What a symbol in the store actually represents -- a 6-step per-symbol
               documentation procedure

Its frontmatter description promises essentially the first: *"Look up what any C64 address means
and turn raw 6502 disassembly into documented assembly, by resolving every address against the
C64 memory map, KERNAL ROM routine list, canonical assembler symbols, and per-bit VIC-II/SID/CIA
register tables."*

# Why it matters

The description is the trigger surface. A session that asks to classify a project's regions, or
to work out what one of a program's OWN symbols represents, is not obviously asking to "look up
what an address means" — and §474 says so itself, drawing exactly that line:

> `lookup` at the top of this page answers what a **published** address means … This section is
> the other half: **what a program's *own* address represents.** No table can tell you, because
> the meaning was decided by the program's code.

So the page knows it is doing two different things; the description does not say so. Either the
description should cover all three jobs, or the sections should move.

# Note before acting

§474-612 is **not** stray content to be deleted. `c64-program-recon`'s scope paragraph
(SKILL.md:414-419) explicitly assigns "naming the data symbols it touches" to
`c64-memory-mapping` as the absorbed pair. Moving it elsewhere breaks a declared three-way
contract; widening the description does not. Prefer the description, or move the sections only
as part of a deliberate re-arbitration that updates `c64-program-recon` too.

This is independent of the delegation defect in
`.planning/todos/pending/routine-queue-walker-restates-instead-of-delegating.md` and can be
fixed separately. Full audit: `.planning/notes/skill-redundancy-audit.md`.
