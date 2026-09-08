---
phase: 40-the-three-preprocessing-host-tools
fixed_at: 2026-09-08T13:19:32Z
review_path: .planning/phases/40-the-three-preprocessing-host-tools/40-REVIEW.md
iteration: 1
findings_in_scope: 6
fixed: 5
skipped: 0
status: partial
---

# Phase 40: Code Review Fix Report

**Fixed at:** 2026-09-08T13:19:32Z
**Source review:** .planning/phases/40-the-three-preprocessing-host-tools/40-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 6 (`fix_scope: all` -- Warning and Info tiers both in scope)
- Fixed: 5 (WR-01, WR-02, WR-03, WR-04, IN-01)
- Dispositioned with no code change: 1 (IN-02 -- see below; this is a deliberate
  "no change needed" outcome, not a skip caused by a stale review context)

Note on `status: partial` rather than `all_fixed`: IN-02 is intentionally
dispositioned as "no change needed" per its own review text (see below), so
5 of 6 findings resulted in a code change and 1 did not. Nothing was skipped
due to a rollback, a failed verification, or a stale review context -- every
finding was fully considered and dispositioned.

## Fixed Issues

### WR-01: `c1541.entry`/`chain`/`read` output filenames can collide, letting a failed call report a stale prior result as success

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** `a9254219`
**Applied fix:** In `runHostTool()`, immediately before the `spawnHostTool()`
call, added a best-effort `rmSync(built.outputs[0]!, { force: true })` gated
on `request.tool === "c1541.read"`. This unlinks any stale file at the
computed `outputPath` before the child (which writes that file itself via
`-read <name> <outputPath>`) runs, so a failed run for a colliding
slug can never be digested as a stale prior success. `force: true` makes a
missing file a silent no-op. Rebuilt `resources/host-tool.mjs` via
`node build.ts` and re-verified byte-identity with `resources-sync.test.ts`.

### WR-02: `petcat.decode`'s resolved `SYS` entry point was not range-checked against the C64's 16-bit address space

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** `28b74028`
**Applied fix:** In `derivePetcatEntrypoint()`, the all-decimal-digit literal
branch now checks `Number.isSafeInteger(value) && value >= 0 && value <= 0xffff`
before accepting the value as a real entry point; anything outside that range
(or that loses precision converting to a safe integer) now returns
`entrypoint: null` through the same named-decline shape the non-literal
("computed") branch already uses, naming the out-of-range argument verbatim.
Matches the fix suggestion essentially as written. Verified against the
existing literal-SYS fixture (`sys2064`, still resolves to `2064`) and the
existing computed-SYS/no-SYS test cases (all three `host-tool.test.ts`
`petcat.decode` cases still pass, plus the new live `petcat.test.mjs`
end-to-end case).

### WR-03: `spawnHostTool()`'s stdout accumulation was unbounded

**Files modified:** `src/mcp/vice/host-tool.mts`, `src/mcp/vice/resources/host-tool.mjs`
**Commit:** `68ab092d`
**Applied fix:** Adapted rather than applied verbatim. The finding's own
literal suggestion ("cap at `STDOUT_CLASSIFY_CAP_BYTES` or a slightly larger
ceiling") was checked against the actual consumers of `spawnResult.stdout`
first: `TOOLS_WHOSE_OUTPUT_IS_STDOUT` tools (`dxa.disassemble`, all four
stdout-shaped `c1541.*` ids, `petcat.decode`) write the FULL captured stdout
verbatim to their declared output file via `writeFileSync()` right after the
spawn -- a real `dxa.disassemble` listing for a 64KB image already measures
well past 64KiB of text (confirmed live, see Verification below), so a cap
near that size would have silently truncated a legitimate disassembly into a
corrupt, incomplete listing on every normal run, not just a malicious one.
Instead added a new `SPAWN_ACCUMULATION_HARD_CAP_BYTES` constant (64 MiB) --
sized purely as a runaway-memory guard, far above any legitimate output this
seam produces today -- and gated the `stdout`/`stderr` accumulation in
`spawnHostTool()`'s `data` handlers on `.length < SPAWN_ACCUMULATION_HARD_CAP_BYTES`.
Deliberately stops appending (keeps the HEAD) rather than using this
module's existing `tailBytes()` "keep the end" convention, because the
accumulated string doubles as literal file content for stdout-is-output
tools and preserving the in-order prefix keeps a (never expected to occur)
capped run's written output internally coherent.

### WR-04: `petcat.mjs` was missing the entry-point guard `c1541.mjs` needed for the identical reason

**Files modified:** `src/skills/c64-petcat/scripts/petcat.mjs`
**Commit:** `239c85ff`
**Applied fix:** Wrapped the CLI dispatch block in
`if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { ... }`,
mirroring `c1541.mjs`'s guard verbatim (same condition, same shape). Verified
by running `node petcat.mjs decode --image <fixture> --json` directly after
the change (still produces the correct response) and by the new
`petcat.test.mjs` (added for IN-01, see below) importing `parseOpts` with no
CLI dispatch side effect.

### IN-01: `petcat.mjs` had no dedicated test file, unlike its sibling `c1541.mjs`

**Files modified:** `src/skills/c64-petcat/scripts/petcat.mjs`, `src/skills/c64-petcat/scripts/petcat.test.mjs` (new)
**Commit:** `698a00a3`
**Applied fix:** Exported `parseOpts()` from `petcat.mjs` (previously
private) and added `petcat.test.mjs`, mirroring `c1541.test.mjs`'s two-tier
split: Tier 1 is four pure unit tests against `parseOpts()` (no seam call,
no `petcat` binary needed, always run); Tier 2 is three LIVE end-to-end
tests running the real `decode` CLI verb over the real seam against the
committed fixtures (`fixtures/dxa/basic-stub.prg` for the literal-SYS case,
`fixtures/petcat/computed-sys.prg` for the computed-SYS decline,
`fixtures/petcat/not-basic.prg` for the planted non-BASIC refusal), gated on
`petcat` being resolvable on PATH (the same imperfect-but-accepted
PATH-search proxy `c1541.test.mjs` already uses for `c1541`, even though the
real dispatch resolves the binary as a sibling of the detected VICE backend,
not via PATH). All 7 tests pass on this host (`petcat` is on PATH here).

## Dispositioned, No Code Change

### IN-02: `c1541.entry`/`chain`/`read`'s `name` validation refuses a leading hyphen but not other c1541-CLI-significant characters

**File:** `src/mcp/vice/host-tool.mts:895-904` (line numbers approximate --
drift against the source is expected as the file grows; see this repo's own
`CLAUDE.md` note on line-reference drift)
**Disposition:** No change needed. IN-02's own recommended fix text is
explicit: "Consider whether `c1541`'s own CLI has any other flag-introducing
sentinel besides a leading hyphen ... if not, no change is needed beyond
documenting that the hyphen check is deliberately the only one, which the
current comment already does reasonably well." Re-reading the comment
immediately above the hyphen check (`host-tool.mts:889-894`) confirms it
already states, by name, WHY the check exists (the argument-injection route
through `c1541`'s own CLI reading a caller-supplied name as a flag) and that
this is the one sentinel c1541's CLI is known to treat specially. No second
CLI-significant character class was identified during this fix pass beyond
what the finding itself already surfaced, and the finding is explicit that
this is not a security gap (argv is an array, never shell-interpreted).
Recorded here, rather than silently dropped, per this repo's own AUDIT-01
lesson that a finding must have a disposition SOMEWHERE, even when that
disposition is "the existing state is already adequate."

## Verification

Run from `src/mcp/vice` after each individual fix commit (per-finding,
sequential -- see commit log `a9254219`..`698a00a3`):

- `node build.ts` -- regenerated `resources/host-tool.mjs` after every
  `.mts` edit (WR-01, WR-02, WR-03), committed alongside the source change
  in the same commit.
- `npm run typecheck` (`tsc --noEmit -p tsconfig.json`) -- clean after every
  fix.
- `node --test host-tool.test.ts host-tool-oracle.test.ts resources-sync.test.ts`
  -- 115/115 passing after every fix, including `resources-sync.test.ts`'s
  byte-identity check.
- `node --test src/skills/c64-disk-access/scripts/c1541.test.mjs` -- 17/17
  passing (unaffected by these changes; run as a sanity check since WR-03's
  fix touches the same stdout-accumulation path `c1541.*` tools use).
- `VICE_LIVE_DXA=1 node --test dxa-live.test.ts` -- 4/5 passing, 1 skipped
  (opt-in corpus case, `VICE_LIVE_DXA_CORPUS=1` not set) -- specifically run
  to confirm WR-03's 64 MiB ceiling does not truncate a real disassembly of
  a full 65536-byte flat image; it does not.
- `node --test petcat.test.mjs` (from `src/skills/c64-petcat/scripts`) --
  7/7 passing, including the 3 new live end-to-end cases (`petcat` is
  resolvable on PATH on this host).
- Manual: `node petcat.mjs decode --image <fixture> --json` run directly
  after the WR-04 guard was added, confirming the CLI still dispatches
  correctly as a real entry point.

All fixes/tests ran directly on the main working tree (`workflow.use_worktrees`
is project policy `true`, but this agent's own `<project_context>` explicitly
overrode isolation for this run: "You are on the main working tree, branch
main. No worktree isolation." -- no worktree was created, per that explicit
instruction taking precedence over the standing project policy for this
invocation).

Scoped guard run (per this fix pass's own instructions) is left for the
orchestrator to re-run after this file is committed:
`node --test docs-review-disposition.test.ts audit-integrity.test.ts`
(both expected to go green once this file, naming all six finding ids
above, is present on disk).

---

_Fixed: 2026-09-08T13:19:32Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
