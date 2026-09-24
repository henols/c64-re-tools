---
title: "Enumerations rot, pointers don't — the CLAUDE.md audit and what it changed"
date: 2026-09-24
context: /gsd-explore — audit CLAUDE.md for irrelevant content, nonexistent things and contradictions
status: five defects found and fixed in 706d633b; rule adopted for these files
---

# Enumerations rot, pointers don't

An audit of `CLAUDE.md` against the live tree found five defects. One was a genuinely false
architectural claim. The other four were the same shape: **a list or a count, copied out of the
thing it describes, which then moved.**

## The finding in one example

The set of host-bound modules `build.ts` compiles was recorded three times, three ways:

| Where | Count |
|---|---|
| `.planning/codebase/STACK.md` | "the eight-file include list" |
| `CLAUDE.md` | enumerated ten by name |
| `src/mcp/vice/build.ts` (`HOST_BOUND_ARTIFACTS`) | **sixteen** |

`tsconfig.build.json`'s `include` agreed with `build.ts` — the two copies that had to match
mechanically stayed correct, and both prose copies drifted. Nothing was wrong with the code.

## The five defects

1. **`node:net` was not confined.** `CLAUDE.md` said `stock-protocol.ts` was "the only module
   that handles `node:net`". Twelve production modules import it — the broker, the relay, the
   text channel, the host-tool client. `ARCHITECTURE.md`, the *source* for that block, made the
   narrower and correct claim (the binmon *wire format* is confined). The generated summary had
   compressed a true narrow claim into a false broad one.
2. **A guard was promised that no longer exists.** "A structural test asserts each one." Phase
   56 deleted the confinement scan; `anno-seam.test.ts` records its own removal in its header.
   This is the most dangerous kind of stale doc — a reader trusts that a violation would be
   caught, so they stop checking.
3. **The NUL-byte warning under-reported by three.** Named one file; four tracked `.ts` files
   qualified. Following the advice as written still missed three.
4. **The `build.ts` list**, above.
5. **The `docs/` citation counts** — "103 citations, 16 of 22 dangling" — written on 2026-09-19
   and falsified hours later by the commit that fixed those very citations. Self-inflicted, and
   the cleanest possible demonstration: the author of the number was the one who invalidated it.

The `node:sqlite` confinement **survived** the audit: `anno-store.ts` is genuinely still the
only importer. Only its guarantee was false. Worth separating — the rule was right, the
enforcement claim was not.

## The rule adopted

State the rule and say where the truth lives; do not copy the truth. The one bullet that had
stayed true for months already did this: *"Read the `HOST_BOUND_ARTIFACTS` array in `build.ts`
before you rename a file across the two."* It names no members, so it cannot go stale.

Where a count genuinely helps a reader, it now ships with the command that recomputes it, so a
reader can tell in one step whether the number still holds.

## The structural trap found on the way

`CLAUDE.md` is mostly **generated**. Seven regions are fenced by
`<!-- GSD:<name>-start source:<file> -->`:

| region | source |
|---|---|
| project | `.planning/PROJECT.md` |
| stack | `.planning/codebase/STACK.md` |
| conventions | `.planning/codebase/CONVENTIONS.md` |
| architecture | `.planning/codebase/ARCHITECTURE.md` |
| skills | `src/skills/` |
| workflow | GSD defaults |
| profile | `generate-claude-profile` |

Only "GSD Execution Isolation" is hand-maintained and outside any fence.

The operator-owned `docs/` rule added on 2026-09-19 had been written **into the conventions
block and nowhere else**. With Phase 53's guard withdrawn, that rule was the only thing
preventing the `docs/` recurrence — and a regeneration would have erased it with no trace. It
now lives in `CONVENTIONS.md`, and the architecture and stack corrections were made in their
sources too.

Two consequences worth carrying forward:

- **A rule that must survive goes in the source file**, not in `CLAUDE.md`. Editing `CLAUDE.md`
  directly is fine for something you want live today — the blocks have visibly drifted, so
  nothing regenerates on its own — but do both.
- **The generated text is a lossy summary, not a copy.** Defect 1 existed only in the
  generated form. Verify a `CLAUDE.md` line against its source before trusting it, and against
  the tree before trusting either.

## Left open

- The Protocol and Capability bullets cite VICE's own C source by line and could not be checked
  from this repo — see `.planning/todos/pending/audit-vice-source-citations-in-claude-md.md`.
- `INTEGRATIONS.md` has the same disease and is unfixed — see
  `.planning/todos/pending/integrations-md-cites-deleted-capability-registry.md`.
- Whether to re-run the generator at all is undecided — see
  `.planning/todos/pending/decide-whether-to-regenerate-claude-md.md`.
