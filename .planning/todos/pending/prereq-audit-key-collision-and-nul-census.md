---
title: Close the prereq-readme-gen audit-key gap, and correct CLAUDE.md's NUL-file count (one → four)
date: 2026-09-19
priority: medium
source: /gsd-execute-phase 61 — 61-REVIEW.md (WR-01, WR-02, IN-01) plus an orchestrator NUL census
audit_acknowledged:
  milestone: v1.1.0
  at: 2026-09-19
---

# Two follow-ups from the Phase 61 code review

Both were filed as advisory Warnings in `61-REVIEW.md` (status `issues_found`, 0 Critical). Neither
blocks Phase 61's roadmap criteria and neither fires against today's declaration. They are recorded
here so they are not lost.

## 1. WR-02 — the guard's comparison keys on less than its derivation dedups on

`src/mcp/vice/prereq-readme-gen.ts:229-256`, against `prereq-readme-gen.test.ts:185-192`.

`deriveEcosystemRows` correctly dedups on the **pair** `(ecosystem, text)`. But
`auditGeneratedReadme`'s comparison maps — `expectedByEco` and `actualByEco` — key on
**`ecosystem` alone**. Map construction is last-one-wins, so if a future declaration edit ever
gives one ecosystem id two different remedy texts under different platform keys, one side of a
real divergence is silently dropped from the comparison.

This is the highest-value item of the three. Phase 61 exists to make this guard trustworthy, and
this is a hole in the guard's *totality* — precisely the class it is meant to close. Confirmed by
scanning the committed `prerequisites.json` that no ecosystem id currently carries two different
texts, so it is **latent, not a live false pass**.

Fix: key both comparison maps on the same pair the derivation dedups on.

## 2. IN-01 — no structural rejection of a pipe or newline in a remedy

Nothing rejects a remedy `text` containing `|` or a newline, either of which would corrupt the
generated markdown table's column alignment on both the render and the parse side. Confirmed no
current value triggers it. A structural check belongs next to the renderer.

## 3. WR-01 / the NUL census — the documented count is stale

CLAUDE.md documents **one** file carrying NUL bytes (`anno-memmap-render.ts`). A
`readFileSync(f).indexOf(0)` census of `src/mcp/vice/` finds **four**:

| File | Byte offset | Origin |
|---|---|---|
| `anno-memmap-render.ts` | 15144 | documented |
| `anno-store-export.ts` | 26225 | phase 51 (`377ab25a`) — undocumented |
| `prereq-readme-gen.ts` | 10247 | phase 61 |
| `prerequisites.test.ts` | 19805 | undocumented |

All four are `data` to `file(1)`, and plain `grep` returns exit 1 on them. Any content census of
this package must use `grep -a` or it will silently conclude a present string is absent.

**Framing correction worth preserving:** the Phase 61 occurrence is *not* an accidental
escape-sequence slip. `anno-store-export.ts:554` uses the identical idiom — a template literal
joining `imageSha256`, `argvDigest` and `seed` with NUL delimiters — committed in phase 51. The
new code follows established prior art in the same package. The grep-invisibility consequence is
real either way, but the actionable item is the **stale documented count**, not the new code.
Whether to also replace the idiom (e.g. `JSON.stringify([a, b])` as the composite key) is a
separate, wider call affecting both files.
