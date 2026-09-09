---
phase: 41-the-text-channel-its-serialization-authority-and-the-content
fixed_at: 2026-09-09T00:00:00Z
review_path: .planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-REVIEW.md
iteration: 1
findings_in_scope: 3
fixed: 2
skipped: 1
status: partial
---

# Phase 41: Code Review Fix Report

**Fixed at:** 2026-09-09
**Source review:** .planning/phases/41-the-text-channel-its-serialization-authority-and-the-content/41-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 3 (WR-01, IN-01, IN-02 -- `fix_scope: all`, Info included)
- Fixed: 2 (WR-01, IN-01)
- Skipped: 1 (IN-02 -- disposition recorded as "no change needed", per the finding's own explicit "No code change required")

Verification ran inside the isolated git worktree created for this fix run
(`git worktree add -b gsd-reviewfix/41-* ...`), which has `node_modules`
symlinked in from the main checkout (not copied) purely to run
`node --test` / `npx tsc --noEmit` during this session. Both commits below
are fast-forwarded onto `main` by the cleanup tail, so the numbers are
reproducible from the main checkout after teardown; the symlink itself is
worktree-local and does not affect the committed tree.

## Fixed Issues

### WR-01: Passive banner drain bypasses the quiescence-window protection that the same class treats as load-bearing for command responses

**Files modified:** `src/mcp/vice/text-protocol.ts`, `src/mcp/vice/text-protocol.test.ts`
**Commit:** `9c46c626`
**Applied fix:** Applied exactly the fix the review prescribed. The `!this.#pending` (banner-drain) branch of `#onData()` no longer drains the buffer synchronously on the first tail match against `PROMPT_RE`. It now arms `#quiescenceTimer` (the same field the pending-command branch already uses) and only finalizes via a new `#finishBanner()` private method -- mirroring `#finishPending()`'s shape exactly -- once the match survives `TEXT_QUIESCENCE_MS` with no further bytes arriving. `#finishBanner()` performs the same drain/count/emit sequence the banner branch used to do inline (increment `bannerFramesDrained`, emit `"banner"`), and deliberately never touches `#pending`.

This closes both consequences the finding named: (1) a single logical banner can no longer be split into two `"banner"` events by prompt-shaped text occurring mid-banner, and (2) the buffer is no longer prematurely emptied at a false match, which removes the window in which a subsequently-issued command's real response bytes could land on a stale, already-cleared buffer and get concatenated into an unrelated notification's residue.

Added three new tests mirroring the existing Control-2 pair, applied to the no-command-outstanding case, immediately after the existing D-13(b) test in `text-protocol.test.ts`:
- `WR-01 (planted RED, without the fix)`: with `quiescenceMs: 0` (representing the pre-fix, unprotected behavior), prompt-shaped text mid-banner followed by the banner's real tail (15ms later) is drained into **two** separate `"banner"` events -- `bannerFramesDrained` reaches 2. This proves the structural gap, not merely asserts it.
- `WR-01 (fixed, GREEN)`: with the default `TEXT_QUIESCENCE_MS`, the same input sequence survives the quiescence window and drains as **exactly one** `"banner"` event containing both the mid-banner prompt-shaped text and the real trailing content, terminated by the TRUE trailing prompt.
- `WR-01` (third test): after a banner has fully drained through its own quiescence window, a real command issued afterward on the same connection still resolves with only its own output -- no banner residue leaks into `client.command()`'s payload.

All 20 assertions in `text-protocol.test.ts` pass (verified via `node --test text-protocol.test.ts`), plus the 38 assertions across `text-connect.test.ts`, `text-tools.test.ts`, and `channel-lock.test.ts` (consumers of this module) also pass unchanged. `npx tsc --noEmit -p tsconfig.json` reports zero errors project-wide after the change.

**Verification tier:** Tier 2 (syntax/type check passed: `tsc --noEmit`) plus full behavioral verification via the project's own `node --test` runner (not merely a syntax check) -- this finding was a concrete, narrow logic fix with a matching planted-RED/fixed-GREEN test pair added to lock it in, so no "requires human verification" flag is warranted; the fix is proven by its own tests exactly as the review's Fix section specified.

### IN-01: `desync` event on `TextMonitorClient` has no production listener

**Files modified:** `src/mcp/vice/text-protocol.ts`
**Commit:** `3a327ed7`
**Applied fix:** Chose the review's second offered option (a documentation-only fix) rather than the first (wiring a `console.error`-based listener in `text-connect.ts`). Rationale: the finding's own Issue text states this "mirrors `stock-protocol.ts`'s own `'desync'` convention deliberately" -- and confirmed by inspection, `stock-protocol.ts`'s binary `ViceMonitorClient` ALSO emits `"desync"` with no production listener anywhere in the tree (grep across `src/mcp/vice/*.ts`/`*.mts` found `.on("desync"...)` only inside test files). Wiring a listener onto only the text client would introduce a new asymmetry between the two channel clients that neither the review nor the existing codebase convention calls for, and risks silently diverging behavior between the two structurally-parallel classes this project's own header comments repeatedly describe as mirrors of each other.

Added a doc comment directly at the `this.emit("desync", err)` call site in `#checkCap()` (the no-`pending`/banner-drain branch) explicitly stating: no promise exists to reject in this branch so `"desync"` is the only signal; this mirrors the binary client's identical convention; neither of the two current production consumers (`text-connect.ts`, `text-tools.ts`) attach a listener, matching the binary client's own production call sites; this is a known, named diagnosability gap left unconsumed BY DESIGN pending a future plan that exposes the banner/desync stream to a caller; and a listener wired onto only this class would be an unwanted asymmetry.

This is a comment-only change (zero behavioral diff). `node --test text-protocol.test.ts` (20/20 pass) and `npx tsc --noEmit -p tsconfig.json` (zero errors) both re-verified after the change.

**Verification tier:** Tier 1 (re-read the modified section, confirmed comment text present and surrounding code intact) plus Tier 2 (syntax/type check passed) as a matter of course since it touches a `.ts` file the project already typechecks -- no functional verification was needed since no functional code changed.

## Skipped Issues

### IN-02: `spawnAndRecordInstance()`'s D-16 stock-record invariant guard is unreachable from any current production call site

**File:** `src/mcp/vice/broker-launch.mts:474-478`
**Reason:** "no change needed" -- disposition, not a rollback. The finding's own **Fix:** section states explicitly: *"No code change required. Consider a one-line note at `superviseChild()`'s call-site type ... if a second production caller is ever added."* There is currently exactly one call site of `superviseChild()` reaching `spawnAndRecordInstance()` with `backend: "stock"` and an omitted `remoteMonitorPort` -- this module's own unit tests, per `superviseChild()`'s own doc comment, which already states this plainly. The guard itself is legitimate defense-in-depth against a *future* caller and is functioning exactly as designed today; there is no current defect to fix, and the review author flagged this purely for future-editor awareness rather than as something requiring a present code change. No files were touched for this finding; it is a documented no-op by explicit instruction of the finding's own Fix guidance.
**Original issue:** The `if (backend === "stock" && deps.remoteMonitorPort === undefined) throw ...` guard at `broker-launch.mts:474-478` defends against "a call site that bypassed that guarantee," but the only production-reachable path to `backend: "stock"` today is `acquirePortAndLaunch()`, which always threads `remoteMonitorPort` through -- so this throw is currently unreachable from production code, only from this module's own unit tests exercising `superviseChild()` directly. Not a bug; flagged so a future editor adding a second production caller of `superviseChild()` for `backend: "stock"` knows to thread `remoteMonitorPort` through or trip this throw at runtime rather than at review time.

---

_Fixed: 2026-09-09_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
