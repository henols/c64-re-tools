# AUTO-08: the provenance token is a live discriminator (Phase 37, plan 37-05, Task 2)

**What this record is:** a hand-run transcript proving `memmapSha256`'s provenance token
genuinely discriminates between map versions -- a one-byte change to a COPY of
`memmap.json` produces a `memmapDigest()` differing from the digest a previously-written
comment carries, read back through the store after a close and a reopen (never from the
join's own return value, since the requirement is about what a LATER READER finds in the
store). The mutation happened ONLY inside a `mkdtempSync` scratch tree mirroring the
repository shape three levels deep; the committed `src/skills/c64-memory-mapping/memmap.json`
and the committed `src/mcp/vice/memmap-lookup.ts`/`anno-join.ts` were never opened for writing
(`git status --porcelain` over all three read 0 lines both before and after this session,
confirmed below).

**This control is NOT one of the six required observed-red controls** (not one of the six the
phase requires -- row 4 of
`37-VALIDATION.md`'s table, AUTO-03's in-image skip, is the one plan 37-05 is required to
deliver -- see the sibling transcript `37-05-in-image-skip-red.md`). This one is added because a
provenance token nobody has seen change is a token nobody should trust, and the check is cheap.
A later reader counting the six required controls should not count this one among them.

This same observation is also encoded as a test case (`join-image-controls.test.ts`'s second
test, `PROVENANCE (EXTRA -- not one of the phase's six required controls): ...`, landed in the
same commit as this record), so the drift is checked mechanically on every future run of the
suite, not only recorded here as a one-time transcript.

Environment: this repository's own committed `anno-store.ts`/`anno-join.ts`/`memmap-lookup.ts`
and `src/skills/c64-memory-mapping/memmap.json`. Date: 2026-09-05.

## Part 1: the setup -- a join against the committed map, read back through the store

A store was opened, one cross-reference row was written targeting `$D020` (the border-colour
register, outside the join's own synthetic image range), and `runMemmapJoin()` was run against
the real, committed `memmap.json`. The store was then CLOSED and REOPENED, and the resulting
comment was read back through `listComments()` -- never from the join call's own return value:

```
comment text: Border color (only bits #0-#3) [memmap-sha256:60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
```

The token captured from the comment, and the committed map's own digest computed independently
via `memmapDigest()`:

```
committedTokenFromComment: 60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
committedDigest:           60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe
equal: true
```

Both are 64 lowercase hex characters, and they are equal -- the comment's token equals the
committed map's digest, exactly as expected before any mutation.

## Part 2: the mutation -- one byte appended to a COPY, non-vacuity checked first

A scratch tree was built mirroring the repository shape three levels deep
(`src/skills/c64-memory-mapping` next to `src/mcp/vice`, both under one `mkdtempSync` root), the
real `memmap.json` was copied into the mirrored skills location, and BEFORE the append, the copy
was asserted byte-identical to the committed file (a failed copy must never be mistaken for a
successful mutation):

```
copy byte-identical before append: true
```

One line was then appended to the COPY only (`// planted for AUTO-08 provenance-drift
non-vacuity (plan 37-05)`), and the real `memmap-lookup.ts` source was copied unmutated beside it
at the depth its own `HERE`-relative `MEMMAP_PATH` formula expects, so its digest computation
resolves against the mutated copy rather than silently reading the real, untouched file.

## Part 3: the red observation -- the mutated digest differs, in both directions

```
mutatedDigest:              dd4502f7f277df41435b540d4571f39364d1068a67e93b88a74da168c1ac2db4
mutated !== committed: true
mutated !== commentToken: true
```

| Digest | Value | 64 lowercase hex? |
|---|---|---|
| Committed map's digest | `60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe` | yes |
| Comment's own token (read back after close+reopen) | `60a517c1833a44e6dc1a99a949554fa39834b558371d9f1e98531499fe3642fe` | yes |
| Mutated (one-byte-appended copy) digest | `dd4502f7f277df41435b540d4571f39364d1068a67e93b88a74da168c1ac2db4` | yes |

**The three-way relationship, stated explicitly rather than merely "two strings differ":** the
comment's token equals the committed map's digest; the mutated digest differs from the committed
digest; the comment's token is therefore NOT the mutated digest. A comment written before the map
changed still carries the OLD digest -- the token distinguishes the two map versions, exactly as
`AUTO-08` requires of a later reader trying to tell which map version produced an annotation.

## Working-tree check

```
$ git status --porcelain src/skills/c64-memory-mapping/memmap.json src/mcp/vice/anno-join.ts src/mcp/vice/memmap-lookup.ts
```

produced 0 lines both immediately before this session's scratch work began and immediately after
the scratch tree was torn down -- the appended byte lived only inside a `mkdtempSync` directory
under this host's RAM-backed `/tmp`, never inside any committed file.

## Closing note

Two planted-violation cases live in `src/mcp/vice/join-image-controls.test.ts`: this file's
provenance case (second test) and the sibling in-image-skip case (first test, recorded in
`37-05-in-image-skip-red.md`). Two transcripts exist under this phase's `evidence/` directory
with this plan's `37-05-` prefix. Of the two, exactly ONE discharges a required control -- the
in-image skip (row 4 of `37-VALIDATION.md`'s six). This provenance record is the extra one, not
one of the six, as stated above.
