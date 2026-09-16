---
title: wrapPossiblyChunked() is orphaned — the shipped server advertises a result cap it no longer enforces, and vice_result_continue can only refuse
date: 2026-09-13
priority: high
source: planning-time measurement while re-baselining vice-proxy.test.ts (quick task 260913-v9e)
audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# What

`96ef711f feat(52-04)` deleted `forwardToVice()`, which was the **only caller** of
`wrapPossiblyChunked()`. The function itself was not deleted. MEASURED at
`fd91b4b2`, `grep -rn wrapPossiblyChunked --include=*.ts --include=*.mts src/`:

    src/mcp/vice/vice-proxy.ts:632   (comment)
    src/mcp/vice/vice-proxy.ts:958   the definition
    src/mcp/vice/anno-tools.ts:1737  (comment, documents relying on it)
    src/mcp/vice/vice-proxy.test.ts:1295 (comment)

Zero call sites. Three live consequences, all in **shipped** code:

1. `CONTINUATION_STORE` is never populated, so `vice_result_continue` — still
   registered as an advertised tool at `vice-proxy.ts:488` — can only ever return
   its "unknown or has already expired" refusal. It is a dead tool on the surface.
2. `_meta` still advertises `anthropic/maxResultSizeChars: OUTPUT_CHAR_CAP`
   (`vice-proxy.ts:1530`, cap defined at `:416`), but nothing enforces it.
   `grep -c 'maxResultSizeChars|CHAR_CAP|continuation' stock-dispatch.ts` → **0**,
   so the surviving dispatch path has no cap of its own.
3. `anno-tools.ts:1737` documents relying on `wrapPossiblyChunked()` to split an
   oversized answer across a continuation sequence. That no longer happens.

# Why it matters

This ships to npm. The server declares a capability contract it does not honour:
an oversized result is neither chunked nor capped, and the tool offered for
retrieving the next chunk cannot work. A client that trusts the advertised
`maxResultSizeChars` gets something else.

# Why it was invisible

The only tests covering it live in `vice-proxy.test.ts`, a `MANUAL_ONLY_TESTS`
entry that `npm run test:automated` never runs, and CI has been red upstream of
its Test step since Phase 34 for an unrelated reason. Four tests still fail
correctly against this: the oversized-result round trip, the exhausted token, the
unknown token, and `the _meta cap stamp and the actual chunk boundary never drift
apart`.

# Do NOT

Do not retire those four tests to make the file green. They are the only
surviving evidence this regression exists. The fix is to re-wire the chunking
into the surviving dispatch path (or to deliberately withdraw the `_meta`
advertisement and unregister `vice_result_continue`, recorded as an accepted
loss) — decided as product work, not as test cleanup.
