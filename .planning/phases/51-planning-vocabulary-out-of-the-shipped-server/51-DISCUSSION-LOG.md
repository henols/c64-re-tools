# Phase 51: Planning Vocabulary Out of the Shipped Server - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-14
**Phase:** 51-planning-vocabulary-out-of-the-shipped-server
**Areas discussed:** Scan surface vs edit surface, How the guard arrives green, Unrecoverable sites, Technical-token collisions

---

## Area selection

All four offered gray areas were selected.

| Option | Description | Selected |
|--------|-------------|----------|
| Scan surface vs edit surface | `files[]` only, or `files[]` plus the `.mts` behind `resources/*.mjs` | ✓ |
| How the guard arrives green | Ordering trap: a guard red on arrival gets switched off | ✓ |
| Unrecoverable sites | Sites where nobody can recover what the citation meant | ✓ |
| Technical-token collisions | `UTF-16` trips the requirement-id regex | ✓ |

---

## Scan surface vs edit surface

Measured before asking: the `.mts` sources carry 903 citations, the `.mjs` they
compile into carry 651 — `build.ts` drops ~28%. Separately confirmed that
`resources-sync.test.ts` asserts byte-identical-to-a-fresh-build, so the
hand-edited-`.mjs` drift hole does not exist; that removed one argument for
widening and left the question about guard ergonomics.

| Option | Description | Selected |
|--------|-------------|----------|
| `files[]` + the `.mts` behind `resources/` | 903 sites in that family, +252 over the literal criterion. Guard failure names the file a maintainer opens. No split-brain between compiled and source form. | ✓ |
| `files[]` exactly | 651 in `resources/`. Literal reading of the success criterion; no drift hole since `resources-sync` forbids hand-edits. But leaves 252 citations in files you just rewrote. | |
| `files[]` enforced, `.mts` cleaned opportunistically | Zero enforced where promised, source cleaned as a side effect but not pinned — so it regresses silently. | |

**User's choice:** `files[]` + the `.mts` behind `resources/`
**Notes:** How the `.mts` set is derived was not put to the user — `build.ts`
already exports `HOST_BOUND_ARTIFACTS` with a both-directions assertion against
the emitted set, so deriving from it rather than hand-listing is an
implementation detail, recorded as D-02.

### Second tarball

| Option | Description | Selected |
|--------|-------------|----------|
| Fold it in | 4 occurrences in `installer/bin/cli.mjs`; the only unguarded shipped-to-npm surface left. | ✓ |
| Leave it — strictly `src/mcp/vice/**` | Holds the roadmap's literal phase boundary and files the gap as a deferred task. | |

**User's choice:** Fold it in

---

## How the guard arrives green

Measured before asking: 3188 distinct hand-edit sites (2312 non-generated
`files[]` + 872 `.mts`-only + 4 installer), not the 2963 a raw `files[]` scan
reports.

| Option | Description | Selected |
|--------|-------------|----------|
| Count-pinned ratchet, widened first | Widen immediately with every dirty file at its exact count; ledger may only shrink. Green from commit one. A file pinned at 235 reds at 236, answering §21.1's objection to by-path exemption. | ✓ |
| Scope flag flipped at the end | Simplest, but nothing enforces progress and a flag defaulting off resembles the guard being switched off. | |
| Widen last, single final plan | Roadmap's literal advice; no temporary machinery, but no mechanical check across the sweep and a long tail surfaces when narrowing the guard is cheapest. | |

**User's choice:** Count-pinned ratchet, widened first

### Partition

Module-family populations measured before asking: annotation store / CLI 935,
protocol / transport 807, broker 585, host tools 397, other 315, proxy / tool
surface 141.

| Option | Description | Selected |
|--------|-------------|----------|
| By module family | Six coherent domains. Meaning is domain-local, which is where the phase's stated risk lives. Ratchet counts move in one family per plan. | ✓ |
| By file | Cleanest ratchet bookkeeping, but `host-tool.mts` alone is 322 sites in one unit and file order supplies no domain context. | |
| By citation category | Fastest per-site, but churns counts across every file every plan and strips the context needed to write the reason. | |

**User's choice:** By module family

---

## Unrecoverable sites

Measured before asking, and it reframed the area substantially:

- 42.7% (1637) of sites are parenthetical tags beside prose that already states
  the reason — the fix is deleting the tag.
- 50.9% (1952) are inline with prose still on the line.
- 6.4% (246) have little or no prose on the line — a line-level upper bound on
  the hard class.
- 518 of the 1088 requirement-id hits are phase-scoped review ids. `CR-01`
  resolves in 27 distinct `REVIEW.md` files, `WR-02` in 34.
- 33 distinct cited tokens (~135 occurrences) resolve nowhere in `.planning/`.

| Option | Description | Selected |
|--------|-------------|----------|
| Tiered by id class | Drop the tag where prose carries the reason; grep `.planning/` for globally-unique ids; `git blame` for the 518 phase-scoped `CR-`/`WR-` ids. | ✓ |
| Prose-first only, never consult history | Cheapest and fully mechanical, but loses recoverable meaning where one `git blame` would have produced it. | |
| Full lookup at every site | Most faithful, but ~43% of lookups would be pure waste and the cost is what stalls the phase. | |

**User's choice:** Tiered by id class

### Verifying success criterion 2

Raised because criterion 2 ("a diff that net-deletes explanatory comments fails
the phase") had no mechanical check, while criterion 1 is fully guarded.

| Option | Description | Selected |
|--------|-------------|----------|
| Budgeted comment-volume floor, per file | Comment bytes lost ≤ summed length of removed citation tokens, plus slack. Exactly computable from the scan's own match list. | ✓ |
| Phase-wide net floor | More forgiving, but lets one gutted file hide behind another's growth — the exact failure criterion 2 names. | |
| Human review, disclosed per plan | No machinery and no gaming a byte count, but leaves criterion 2 unguarded on a phase premised on conventions decaying without guards. | |

**User's choice:** Budgeted comment-volume floor, per file

---

## Technical-token collisions

Measured before asking: of the 37 id prefixes appearing in the shipped tree,
exactly one (`UTF`) is not a declared project id prefix. `PD-03` initially
looked like a second, but turned out to be a dangling citation rather than a
false positive.

| Option | Description | Selected |
|--------|-------------|----------|
| Rewrite the two lines, no exemption | `UTF-16 code units` → `16-bit code units`. Zero escape hatches, consistent with §21.1's withdrawal of the `c1541.test.mjs` path exemption. | ✓ |
| Named allowlist of `{UTF-16, UTF-32}` | Spares a future maintainer a confusing failure, but is the by-name escape hatch §21.1 argues against. | |
| Rewrite now, and make the failure message teach | Same rewrite plus a signposted trap in the guard's error text. | |

**User's choice:** Rewrite the two lines, no exemption

---

## Closing check

Offered: write CONTEXT.md, explore the five-guard reconciliation, or something
else. **User's choice:** ready for context. The two remaining guard questions
(`comment-phase-pointers.test.ts` needs its reasoning rewritten rather than its
literals patched; `docs-dangling-refs.test.ts`'s FLOW-02 must not be widened)
are already prescribed by the roadmap and were recorded as carried-forward
constraints rather than reopened.

## Claude's Discretion

- Exact file and shape of the ratchet ledger, provided shrink-only and
  reach-empty both assert.
- The slack term in the comment-volume budget, to be picked from the first
  family's real diffs.
- Ordering of the six families across plans.

## Deferred Ideas

None — discussion stayed within phase scope. Twelve pending todos were reviewed
and none folded; all matched on generic keyword overlap rather than subject.
