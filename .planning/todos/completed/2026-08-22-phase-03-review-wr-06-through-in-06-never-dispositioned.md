---
created: 2026-08-22T13:59:20.000Z
title: 03-REVIEW.md WR-06..IN-06 (WR-06, WR-07, WR-08, IN-02, IN-03, IN-04, IN-05, IN-06) never dispositioned
area: planning
priority: low
resolves_phase: 15
files:
  - .planning/phases/03-direct-tools/03-REVIEW.md
  - .claude/mcp/vice/stock-live.test.ts
  - .claude/mcp/vice/vice-proxy.test.ts
  - .claude/mcp/vice/stock-registers.ts
  - .claude/mcp/vice/stock-registers.test.ts
---

## Problem

Eight findings in `03-REVIEW.md` — `WR-06`, `WR-07`, `WR-08` (Warning) and
`IN-02`, `IN-03`, `IN-04`, `IN-05`, `IN-06` (Info) — had no disposition
anywhere. These eight are not merely undispositioned but were **undiscovered**:
`docs-review-disposition.test.ts`'s parser could not see any of `03-REVIEW.md`'s
finding headings at all before plan 15-01 widened it — every one of the 14
findings in that file is a level-4 (`####`) heading, and the guard's original
regex only matched level-3 headings ending in a colon.

`05-REVIEW.md`'s 16 findings share the exact same `####` blind spot but are
NOT part of this todo — they are all already dispositioned via
`05-REVIEW-FIX.md`, so widening the parser only surfaced them, it did not add
new backlog. `03-REVIEW.md`'s eight are the only real, unaddressed work the
widening exposed.

Six of `03-REVIEW.md`'s 14 findings already have a recorded disposition and
are NOT part of this todo, so a future reader does not re-litigate them:
`CR-01`, `CR-02`, `WR-01`, `WR-02`, `WR-03` were fixed per
`03-REVIEW-FIX.md:17` (fix scope `critical_warning`, all 5 fixed, commits
cited per-finding in that file); `IN-01` was explicitly ruled out of scope in
the same fix report; `WR-04` and `WR-05` are recorded as "Warning, latent
only" in `03-VERIFICATION.md`'s Anti-Patterns table (lines ~190-198).

## The eight findings

Verified directly against current source on 2026-08-22 (this plan), not
assumed from the review's own text:

| Id | Cited location | One-line issue | Verified at plan time (2026-08-22) |
|----|-----------------|-----------------|--------------------------------------|
| `WR-06` | `stock-live.test.ts:74-85` (also `:163-169`, `:176-181`) | Opt-in skip message claims a truthy-non-path-value default that `??` can never reach | **STILL OPEN**, and now present at **three** sites, not the single site the review cited — `stock-live.test.ts:74-85` (`VICE_LIVE_STOCK_BIN`), `:163-169` (`VICE_LIVE_STOCK_BIN_39`), `:176-181` (`VICE_LIVE_STOCK_BIN_310`); the two 07-13 variables were added after the review and share the identical wrong sentence shape |
| `WR-07` | `vice-proxy.test.ts:~3856-3875` | Widened `vice-proxy:` identity detector's marker set exempts errors reached via `throw new`, and `text:` matches mid-word inside `context:` | **NOT re-verified** at plan time — `vice-proxy.test.ts` is `MANUAL_ONLY_TESTS` entry 2 and hangs outside a devcontainer (confirmed timing out at 150s on 2026-08-13); verify by source assertion plus `npm run typecheck`, never by running the suite |
| `WR-08` | `.claude/mcp/vice/README.md:67-68` and the Environment table (`:47-52`) | README says `test:automated` excludes "three" manual-only files and omits `VICE_LIVE_STOCK_BIN` from the Environment table | **STILL OPEN, and now MORE stale than the review described**: `test-gate.mjs`'s `MANUAL_ONLY_TESTS` has grown to **eight** entries (its own header and `test-gate.test.ts` both say "eight"), not the "four" the review expected README to say — README.md:67 still says "three". The Environment table still has no `VICE_LIVE_STOCK_BIN` row (`grep -c VICE_LIVE_STOCK_BIN .claude/mcp/vice/README.md` returns 0) |
| `IN-02` | `stock-registers.ts:256` | `in` operator on `FLAG_BIT_POSITIONS` walks the prototype chain | **NOT re-verified** at plan time |
| `IN-03` | `vice-proxy.test.ts:140, 146-152` | `OPEN_SERVERS`'s `Set<Server \| NetServer>` never receives a `NetServer`, so the leak registry's second union member is dead (and would not work if used, since `closeAllConnections?.()` is `undefined` on `net.Server`) | **STILL OPEN** — `NetServer`-typed locals now exist widely in the file (e.g. `controlServer: NetServer \| null` at `:2258`, `:2295`, `:2436` and dozens more), but none of them is ever passed to `OPEN_SERVERS.add(...)` (`grep -n "OPEN_SERVERS.add"` returns exactly one call site, `:226`, adding an HTTP `Server`, not a `NetServer`). The general use of the `NetServer` type elsewhere in the file does not supersede this specific finding about the leak registry |
| `IN-04` | `stock-registers.test.ts:50-52` | Comment cites a pre-fix line range (`stock-registers.ts:260-268`) that no longer exists | **NOT re-verified** at plan time |
| `IN-05` | `stock-live.test.ts:1` | Shebang on a non-executable `*.test.ts` file, inconsistent with every sibling in the directory | **STILL OPEN** — line 1 is still `#!/usr/bin/env node` |
| `IN-06` | `stock-live.test.ts:373-377` (now `:455-473`) | Live flag-refusal assertion built `new RegExp(statusEntry.name)` unescaped — a single-character register name (e.g. `"P"`) would match almost any text | **PARTLY ADDRESSED** — the assertion now escapes regex metacharacters (`statusEntry!.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")`), closing the metacharacter-injection half. The weak-anchoring half remains: a short/common register name can still match text that never actually names the register, since the assertion is not anchored to the full refusal phrase (e.g. `` `as "${escaped}"` ``) |

## Why it is a todo rather than a fix here

Plan 15-01's charter is the instrument (widen the guard's parser) and one
end-to-end disposition proof (`14-REVIEW.md`'s `IN-01`), not eight source
fixes across four files outside its own scope. A pending todo is one of
`docs-review-disposition.test.ts`'s five recognised disposition sources, so
filing it returns the guard to green honestly — the findings are tracked,
with a named owner and a per-finding verification status — rather than by
silencing or narrowing the parser that just proved it could see them.

**Owner: plan 15-04.**

## What will close it

Per finding: re-verify against current source first (several of the "NOT
re-verified" rows above may have drifted further since this todo was filed),
then either fix it or record a `superseded`/`wont-fix` disposition with the
reason, in a source `docs-review-disposition.test.ts` recognises (this
todo's own `## Resolution` section, once filed, or `03-REVIEW.md`'s own file
— **never** by editing `03-REVIEW.md`'s headings to make a finding
disappear from the parser; that is explicitly prohibited by plan 15-01's own
must-haves and would defeat the point of widening the parser in the first
place).

`WR-06`'s fix is small and mechanical (correct or delete the three
false-default sentences). `WR-08` needs both a number update (README's
"three" → "eight", matching `MANUAL_ONLY_TESTS`'s actual current length,
not the "four" the original review expected) and the missing
`VICE_LIVE_STOCK_BIN` Environment table row. `IN-03`'s fix is either wiring
a real control-plane `net.Server` into `OPEN_SERVERS` or removing the dead
`NetServer` union member and documenting why control-plane sockets are
untracked. `IN-06`'s remaining half needs the full-phrase anchor
(`` new RegExp(`as "${escaped}"`) ``) the review itself suggested.

**Standing warning:** `vice-proxy.test.ts` is `MANUAL_ONLY_TESTS` entry 2
and hangs outside a devcontainer (confirmed timing out at 150s on
2026-08-13). `WR-07` and `IN-03` must be verified by source-level assertion
plus `npm run typecheck`, never by running that suite directly.

## Resolution

**All eight findings fixed on 2026-08-22 by Phase 15 plan 15-04, after re-verifying each against current source; none was superseded or wont-fix — every one this todo listed was still live (or, for `WR-08`, more stale than this todo's own filing described), and every fix landed.** `03-REVIEW.md` was not edited.

| Id | Verdict | Evidence |
|----|---------|----------|
| `WR-06` | Fixed | Deleted the unreachable-fallback sentence ("Defaults to `X` when set to a truthy non-path value") at all three current sites in `stock-live.test.ts` (`VICE_LIVE_STOCK_BIN`, `_39`, `_310`) — the branch each message lives in only runs when the variable is unset, so the fallback it described could never be reached from there. `grep -v -E '^\s*(//|\*|/\*)' stock-live.test.ts \| grep -c 'truthy non-path'` returns `0`. Commit `aaaffce`. |
| `WR-07` | Fixed (re-verified STILL OPEN, contrary to this plan's own stale premise) | Re-read the current identity detector in `vice-proxy.test.ts` (drifted from the review's `:3856-3875` citation to `:3869-3890` at plan time): both defects the review named were still present — `throw new`/standalone `Error(` were not agent-visible markers (false-negative class), and `text:` matched mid-word inside `context:`. Added both markers and word-boundary-anchored `text:`. Verified via a standalone throwaway probe (`node` script, never `node --test vice-proxy.test.ts`) reproducing the exact same logic against six control cases (all pass) plus the real `vice-proxy.ts` source (0 violations, unchanged) — full manual grep audit of the file's only `throw new`/`Error(`/`context:` occurrences confirmed none sits closer to any of the 12 real `` `vice-proxy: `` sites than that site's own `console.error(`, so the widened marker set introduces no new false positive. Three new control assertions (`throw-new`, `throw-new after an unrelated earlier console.error`, `context:` mid-word) added to the file itself. `vice-proxy.test.ts` was never executed. Commit `e8621d7`. |
| `WR-08` | Fixed (re-verified STILL OPEN, more stale than this todo's own filing described — the plan's "moot" premise was checked and found false) | `grep -n "three manual-only\|excludes the three" README.md` still matched before this fix; `test-gate.mjs`'s own header and `test-gate.test.ts` both say **eight** (not the "four" the original review expected, nor the "three" README still said). Fixed: README.md's Development section now says "eight" and the Environment table now lists `VICE_LIVE_STOCK_BIN`. `grep -c 'manual-only' README.md` output (post-fix, "eight manual-only files" / "excludes manual-only files") confirms the corrected wording; no residual "three manual-only" match. Commit (this plan's Task 3 commit — see `git log --oneline -1 -- .claude/mcp/vice/README.md`). |
| `IN-02` | Fixed | `registerCatalogFor()` now caches the in-flight promise, not the resolved catalog, and evicts on rejection. Two new non-vacuous tests in `stock-registers.test.ts` (concurrency send-count, rejection-eviction), each confirmed live to FAIL against a temporarily-reverted implementation (send count 2, and a replayed rejection) before the fix was restored and both tests re-confirmed passing (25/25, then 28/28 with `docs-linerefs.test.ts`). Commit `e8621d7`. |
| `IN-03` | Fixed (re-verified STILL OPEN, contrary to this plan's own stale premise that `NetServer`'s broader use elsewhere superseded the finding) | `grep -n "OPEN_SERVERS.add"` still returns exactly one call site, adding an HTTP `Server`, never a `NetServer` — confirmed live at plan time (same evidence 15-01 already recorded). Every per-test `controlServer` (a real `net.Server`) is closed by its own local `try`/`finally`, never registered here, and `closeAllConnections` (used in this registry's teardown) is `undefined` on `net.Server` regardless, so wiring it in would not have worked as-is. Fixed by narrowing `OPEN_SERVERS` to `Set<Server>` and documenting why control-plane sockets are untracked by this net. `npm run typecheck` exits 0; `vice-proxy.test.ts` was never executed. Commit `e8621d7`. |
| `IN-04` | Fixed | Replaced the drifted `stock-registers.ts:260-268` citation in `stock-registers.test.ts` with a plan/commit citation (`03-14-PLAN.md`, `ff82edc`) — `git cat-file -e ff82edc` exits 0. `grep -c 'stock-registers.ts:260-268' stock-registers.test.ts` returns `0`. `docs-linerefs.test.ts` (out of this citation's scope — it only checks `CLAUDE.md`'s `vice-proxy.ts:<N>` citations) stays green regardless. Commit `e8621d7`. |
| `IN-05` | Fixed | Removed the `#!/usr/bin/env node` shebang from `stock-live.test.ts:1`. `head -1 stock-live.test.ts \| grep -c 'usr/bin/env'` returns `0`. (Noted, not fixed — out of this task's declared file scope: six OTHER manual-only/live test files in this directory also carry the same shebang, so the review's "no other sibling carries one" premise has itself drifted; logged as a pre-existing, out-of-scope observation, not silently expanded into a six-file cleanup.) Commit `aaaffce`. |
| `IN-06` | Fixed | The flag-bit refusal assertion in `stock-live.test.ts` now matches the handler's full emitted phrase (`` reported by this catalog as "${escapedStatusName}" ``, mirroring `stock-registers.ts:259`'s real `` `reported by this catalog as "${statusName}"` `` string) instead of a bare, regex-escaped register name. Verified structurally (source assertion) — the fix is not exercised by the default-skip run (14/14 skipped, exit 0, unchanged shape); a future live opt-in run against a real stock build is what actually exercises it. Commit `aaaffce`. |

**Consequence:** `03-REVIEW.md`'s all 14 findings are now fully dispositioned (six were already closed before this phase; these eight close the remainder). `docs-review-disposition.test.ts` returns to green with this todo counted as a completed disposition source. No source or planning-facing regression: `npm run typecheck` and `npm run test:automated` both exit 0 (2108 tests, 2103 pass, 0 fail, 5 pre-existing todo) after all three commits; `03-REVIEW.md` itself is byte-identical to before this plan (`git diff --stat` empty).
