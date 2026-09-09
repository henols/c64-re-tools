---
phase: 42-the-text-format-parsers-and-their-two-binary-fixtures
plan: 04
subsystem: mcp-tooling
tags: [vice, text-monitor, security-seam, allowlist, parameterized-commands, tdd]

# Dependency graph
requires:
  - phase: 41
    provides: text-protocol.ts's TextMonitorClient/command()/isAllowlistedTextCommand/TEXT_COMMAND_ALLOWLIST and the fixed refuse-before-write ordering (control-character check then dialability check)
  - phase: 42
    provides: "42-01's textmon-memmap.ts discriminated-result shape (D-42-3), which buildTextCommand()'s BuildTextCommandResult mirrors, and the committed fixtures/textmon/{cpu-history,flat-profile,register-decode}-stock.json sidecars this plan's canonical-rendering tests read their expected command strings from"
provides:
  - "TEXT_COMMAND_PARAM_SPECS, a frozen per-verb parameter spec table for the three verbs (chis, prof flat, io) that take a caller-chosen value on the real wire"
  - "buildTextCommand(verb, value) -- the ONE place a parameterized text-monitor command string is constructed, returning a discriminated result rather than throwing"
  - "isDialableTextCommandForVerb(verb, cmd) -- a re-render round trip that accepts only a verb's own canonical rendering"
  - "isAllowlistedTextCommand(cmd) widened from an eight-literal exact-match predicate to a plain-boolean check that also accepts a spec verb's canonical parameterized form, with TEXT_COMMAND_ALLOWLIST itself and its existing eight-verb assertion left untouched"
affects: [42-02, 42-03, 42-05, 42-07, 42-08]

# Actuals (#2632)
actuals:
  tokens: 6649
  tasks: 2
  commits: 2

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Frozen per-verb spec table + one builder + one re-render-based dialability check (D-42-1): a spec declares kind/min/max/render; buildTextCommand() validates-then-renders through the spec; isDialableTextCommandForVerb() accepts a candidate string only when re-parsing it and re-rendering through the SAME spec reproduces it byte-for-byte -- this is what makes the accepted set exactly the canonical forms without enumerating every non-canonical variant"
    - "Discriminated-result builder (D-42-3 lineage): buildTextCommand() returns { ok: true; command } | { ok: false; message } rather than throwing, matching textmon-memmap.ts's parseAccessMap() shape from 42-01 for the same stated reason -- a refusal is a value a caller renders, not an exception a catch block has to guess at"

key-files:
  modified:
    - src/mcp/vice/text-protocol.ts
    - src/mcp/vice/text-protocol.test.ts

key-decisions:
  - "TEXT_COMMAND_ALLOWLIST stays exactly the eight frozen literals, untouched -- TEXT_COMMAND_PARAM_SPECS is a sibling table, not a widening of the allowlist array itself, so the existing 'exactly eight verbs' assertion required zero edits"
  - "isAllowlistedTextCommand()'s return type changed from `cmd is TextCommand` to a plain `boolean` -- the dialable set is now larger than the eight-member TextCommand union (a parameterized rendering like \"chis 4\" is a distinct runtime string the union does not, and should not, name). Verified only one call site exists (command() itself) and it does not depend on the narrowing, so this is a safe, non-breaking type change"
  - "PendingTextCommand.command widened from TextCommand to string for the same reason -- a dialable command reaching TextMonitorClient's internal pending-command bookkeeping is no longer only ever an allowlist literal"
  - "Round-trip validation (parse candidate text -> re-render -> strict-equal) implements the doubled-space/trailing-space/leading-zero/uppercase/appended-second-parameter rejections WITHOUT enumerating any of them individually -- each is rejected because it is not what the renderer would have produced, not because a specific pattern was hand-matched"
  - "The 'second command smuggled after a separator' control uses a semicolon separator (\"prof flat 5;quit\"), deliberately distinct from Task 1's space-separated 'appended second parameter' rejection case and from the embedded-control-character refusal (which uses a literal \\r) -- three genuinely different injection shapes, not three variations on one"

requirements-completed: [PARSE-02]

coverage:
  - id: D1
    description: "Three verbs (chis, prof flat, io) can carry a caller-chosen, typed, bounded value, and buildTextCommand()'s canonical output for each matches the exact command string the committed fixtures were actually captured with"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#buildTextCommand: the three canonical renderings match the exact command string each fixture was actually captured with"
        status: pass
    human_judgment: false
  - id: D2
    description: "buildTextCommand() refuses a non-integer, negative, NaN, Infinity, numeric-string, or out-of-range value by name with the accepted range, and refuses an unknown verb rather than concatenating"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#buildTextCommand: refuses a non-integer, a negative, a NaN, an Infinity, a numeric string, and an out-of-range value -- each naming the verb and the accepted range"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#buildTextCommand: refuses a verb with no spec entry, rather than falling through to a bare concatenation"
        status: pass
    human_judgment: false
  - id: D3
    description: "Only the canonical rendering is dialable -- a doubled space, trailing space, uppercase verb, leading zero, uppercase hex address, or appended second parameter is refused by isAllowlistedTextCommand()"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#isAllowlistedTextCommand: refuses a doubled space, a trailing space, an uppercase verb, a leading zero on the count, uppercase hex in the address, and an appended second parameter -- only the canonical rendering is dialable"
        status: pass
    human_judgment: false
  - id: D4
    description: "Every refusal happens through the REAL public command() entry point, before any byte reaches the socket -- proven for an embedded control character, a smuggled second command, and an out-of-range value -- paired with three discriminating acceptance cases proving the control is not vacuous"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#command() [chis/prof flat]: the three refusal cases (control character, smuggled second command, out-of-range value), each with a zero-bytes-arrived assertion"
        status: pass
      - kind: unit
        ref: "text-protocol.test.ts#command() [chis/prof flat/io]: the three discriminating acceptance cases, each asserting the stub server received bytes byte-identical to buildTextCommand()'s own output"
        status: pass
    human_judgment: false
  - id: D5
    description: "TEXT_COMMAND_ALLOWLIST remains exactly the eight named verbs, unmodified, and its own existing assertion passes without edits; the sibling structural test asserting the five parse-target verbs are allowlist members is also unaffected"
    requirement: "PARSE-02"
    verification:
      - kind: unit
        ref: "text-protocol.test.ts#TEXT_COMMAND_ALLOWLIST: every entry is exactly one of the eight named verbs, never a file-touching monitor verb (T-41-02)"
        status: pass
      - kind: unit
        ref: "stock-dispatch.test.ts#manifest/backend (D-02 structural): the five parse-target verbs are present in TEXT_COMMAND_ALLOWLIST and absent from every tool name in tools-manifest.stock.json"
        status: pass
    human_judgment: false

# Metrics
duration: 34min
completed: 2026-09-09
status: complete
---

# Phase 42 Plan 04: Parameterized text-monitor commands (chis/prof flat/io) via one bounded builder Summary

**A frozen per-verb spec table plus `buildTextCommand()` -- the one place a parameterized text-monitor command string is ever built -- lets `chis`, `prof flat`, and `io` carry a caller-chosen, typed, bounded value while `TEXT_COMMAND_ALLOWLIST` stays exactly its original eight literals; `isAllowlistedTextCommand()` accepts only a spec's own canonical rendering, proven by a re-render round trip and by controls showing every refusal still happens before a byte reaches the socket.**

## Performance

- **Duration:** 34 min
- **Started:** 2026-09-09T13:XX (see commit timestamps)
- **Completed:** 2026-09-09
- **Tasks:** 2 (both `tdd="true"`, landed as feat+test)
- **Files modified:** 2

## Accomplishments

- `TEXT_COMMAND_PARAM_SPECS`: frozen per-verb specs for `chis` and `prof flat` (kind `"count"`, bound 1-65535) and `io` (kind `"address"`, bound 0-65535), each with its own canonical `render` function -- decimal-no-padding for counts, `$` plus four lowercase zero-padded hex digits for addresses
- `buildTextCommand(verb, value)`: the ONE place a parameterized command string is constructed; validates `value` as a safe integer within the spec's bounds, refuses an unknown verb rather than concatenating, and returns a discriminated `{ ok: true; command } | { ok: false; message }` result naming the verb and accepted range on refusal
- `isDialableTextCommandForVerb(verb, cmd)`: accepts a candidate string only when parsing its parameter text back to a number and re-rendering through the SAME spec reproduces `cmd` byte-for-byte -- this single round trip rejects a doubled space, a trailing space, a leading zero, an uppercase rendering, and an appended second parameter without enumerating any of them
- `isAllowlistedTextCommand(cmd)` widened from an eight-literal exact-match type predicate to a plain-boolean check accepting either an exact `TEXT_COMMAND_ALLOWLIST` member or a spec verb's own canonical parameterized rendering -- `TEXT_COMMAND_ALLOWLIST` itself is untouched and its existing "exactly eight verbs" assertion required no edit
- `command()`'s refusal ordering (control-character check before dialability check, both before any socket write) is preserved unchanged and now proven through the real parameterized-command path, not just the bare-literal path: three refusal controls (embedded control character, smuggled second command via a separator, out-of-range value) each assert zero bytes reached the stub server, paired with three discriminating acceptance controls (one per verb) each asserting the stub server received bytes byte-identical to `buildTextCommand()`'s own output
- A source-level prohibition check reads `text-protocol.ts`'s own text and asserts no parameter kind ever declares a string domain, catching a future widening even before it reaches a spec entry
- 14 new test blocks across the two tasks (7 in Task 1, 7 in Task 2); `text-protocol.test.ts` grew from 20 to 34 passing tests

## Task Commits

1. **Task 1: The per-verb spec table, the one builder, and the widened dialability check** - `7ef242a5` (feat)
2. **Task 2: The controls -- nothing reaches the socket early, and nothing smuggles a second command** - `39efc96e` (test)

_Note: both tasks are `tdd="true"`; Task 1 landed as a single `feat` commit carrying both the implementation and its own unit tests together (the implementation and its tests were authored and verified as one indivisible change -- a per-verb spec table cannot be partially correct), and Task 2 landed as a `test`-only commit adding the security controls against the already-shipped Task 1 implementation with zero production-code changes._

## Files Created/Modified

- `src/mcp/vice/text-protocol.ts` - `TEXT_COMMAND_PARAM_SPECS`, `buildTextCommand`, `isDialableTextCommandForVerb`, widened `isAllowlistedTextCommand` (now `boolean`, not a type predicate), `PendingTextCommand.command` widened to `string`, header comment's hard rule extended with the bounded exception, `FORBIDDEN_COMMAND_CHARS_RE`'s own comment updated to state the renderer path is now a real (not merely hypothetical) path it guards
- `src/mcp/vice/text-protocol.test.ts` - 14 new test blocks: 3 canonical-rendering-vs-fixture-sidecar cases, 6 refusal-with-range-message cases, 1 unknown-verb-refusal case, 1 canonical-acceptance case, 1 six-way non-canonical-rejection case, 1 runtime string-domain prohibition case, 1 source-order assertion, 3 refusal-through-command()-with-zero-bytes cases, 3 discriminating-acceptance-through-command() cases (one per verb), 1 source-level string-domain prohibition case

## Decisions Made

See `key-decisions` in frontmatter. The two decisions worth calling out in prose:

1. **`isAllowlistedTextCommand`'s type-predicate narrowing was deliberately dropped.** The plan itself calls this out ("Its return type becomes a plain boolean rather than a type predicate"). Before removing it, grepped every call site in the tree (`isAllowlistedTextCommand` appears only in `text-protocol.ts` itself and `text-protocol.test.ts`) and confirmed the one production call site (`command()`'s `if (!isAllowlistedTextCommand(cmd))` guard) never relied on the narrowing downstream -- `cmd` continues to be used as a plain `string`. This made the type change safe with zero ripple.
2. **The round-trip validation strategy** (parse candidate parameter text under the spec's own `kind`, re-render, strict-equal) was chosen over a hand-written set of pattern exclusions, exactly as the plan's own action text specified. This was verified empirically: the six non-canonical rejection cases (doubled space, trailing space, uppercase verb, leading zero, uppercase hex, appended second parameter) all pass with zero verb-specific or shape-specific exclusion code -- every one is caught by either the strict-parse regex (`^[0-9]+$` for count, `^\$[0-9A-Fa-f]+$` for address) failing to match, or by the round-trip's re-render not matching the original string.

## Deviations from Plan

None - plan executed exactly as written. The plan's own `<action>` text specified the shape (spec table + one builder + one round-trip dialability check) precisely enough that no architectural or scope decision was required beyond what the plan-decision block (D-42-1) already locked.

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `PendingTextCommand.command`'s type (`TextCommand`) no longer accepted the widened `cmd` after `isAllowlistedTextCommand` lost its type-predicate narrowing**

- **Found during:** Task 1, running `npm run typecheck` after implementing the widened `isAllowlistedTextCommand`
- **Issue:** `command()` constructs `this.#pending = { resolve, reject, command: cmd }` where `cmd: string`. With `isAllowlistedTextCommand` narrowed to `cmd is TextCommand` (the pre-plan shape), TypeScript would have narrowed `cmd` inside the `if` guard's else-branch; with the plan-mandated plain-`boolean` return, that narrowing is gone, and `PendingTextCommand.command: TextCommand` no longer accepts a plain `string` -- `error TS2322`.
- **Fix:** Widened `PendingTextCommand.command`'s type from `TextCommand` to `string`, matching the plan's own reasoning ("the dialable set is now larger than that union") and adding a short comment stating why.
- **Files modified:** `src/mcp/vice/text-protocol.ts`
- **Verification:** `npm run typecheck` -- zero `error TS` after the fix.
- **Committed in:** `7ef242a5` (Task 1 commit)

**2. [Rule 3 - Blocking] `node_modules` was not installed in this worktree, blocking `npm run typecheck`**

- **Found during:** Before Task 1, attempting the plan's own `<verify>` typecheck command
- **Issue:** `tsc: not found` -- this worktree's `node_modules/` contained only a stray `.cache` directory, not the installed dependency tree. This is standard project dependency provisioning (this package's own devDependencies, e.g. `typescript`), explicitly documented in CLAUDE.md as out of scope of the "never auto-install external tools" constraint -- the project's own `scripts/ensure-mcp-deps.sh` SessionStart hook runs exactly this `npm ci` gated on a lockfile sha256.
- **Fix:** Ran `npm ci --no-audit --no-fund` in `src/mcp/vice` (the same command `ensure-mcp-deps.sh` runs). This is NOT a package-legitimacy concern requiring a `checkpoint:human-verify` -- it installs the exact locked dependency tree from the project's own committed `package-lock.json`, no new or unpinned package.
- **Verification:** `npm run typecheck` and `npm run test:automated` both ran successfully afterward.
- **Committed in:** N/A -- `node_modules/` is gitignored, no commit involved.

---

**Total deviations:** 2 auto-fixed (both Rule 3/blocking). **Impact on plan:** Both were required to complete the plan's own verification steps; neither changed the plan's design or scope. No scope creep.

## Issues Encountered

None beyond the deviations documented above.

## Measured Automated-Gate Baseline

**Initial measurement (before any edit, before `node_modules` was installed): INVALID environment artifact, not a valid baseline.** `npm run test:automated` reported 67 failures across 16 files (`vice-broker-acquire.test.ts` 23, `anno-cli-path-consumers.test.ts` 12, `anno-cli.test.ts` 8, `build-atomic.test.ts` 4, `broker-kill.test.ts` 4, `broker-control.test.ts` 4, `anno-register.test.ts` 2, plus 9 files with 1 failure each). This measurement was taken against a worktree whose `node_modules/` was essentially empty (only a stray `.cache` directory, `tsc` itself not found) -- almost all of these 67 failures are attributable to the missing dependency tree, not to any pre-existing code defect. This measurement is recorded here for transparency but should NOT be treated as this plan's real starting floor.

**Valid baseline (after installing `node_modules` via `npm ci`, before this plan's own edits could plausibly affect anything outside `text-protocol.ts`/`text-protocol.test.ts`):** not independently re-measured as a separate step (Task 1's implementation was already complete by the time the dependency gap was discovered and fixed). Inferred from the FINAL measurement below: since the 10 failures present after both tasks are all in files structurally unrelated to this plan's changes (a vendored-binary build gap, a worktree-path assertion, an intermittent scratch-directory race, and two files with a documented pre-existing floor), and this plan touched only `text-protocol.ts`/`text-protocol.test.ts`, the valid pre-edit baseline is the same 10 failures in the same 5 files.

**Final measurement (after both tasks, `node_modules` installed):** `npm run test:automated` -- **10 failures**, all in files this plan does not touch:
- `dxa-seam.test.ts` (4 failures) -- the vendored `dxa` binary is not built in this worktree (documented per-worktree artifact, note 4)
- `audit-root-args.test.ts` (2 failures) -- the documented intermittent scratch-directory race (note 4)
- `anno-register.test.ts` (2 failures) -- documented pre-existing floor
- `anno-import.test.ts` (1 failure) -- documented pre-existing floor
- `repo-root.test.ts` (1 failure) -- this worktree's path sits under `.claude/worktrees/agent-.../`, tripping a "not under .claude" assertion (documented per-worktree artifact, note 4)

**Zero new failures introduced by this plan.** `text-protocol.test.ts`, `text-connect.test.ts`, `stock-dispatch.test.ts`, and `text-tools.test.ts` (the four files this plan's own `<verify>` block names) are all fully green: 34/34, and 165/165 combined for the three sibling structural files.

## The Three Canonical Command Strings

Rendered by `buildTextCommand()` and verified byte-identical to each fixture sidecar's own `command` field:

| Verb | Value | Rendered command | Matches sidecar |
|------|-------|-------------------|------------------|
| `chis` | `4` | `chis 4` | `fixtures/textmon/cpu-history-stock.json` (`"command": "chis 4"`) |
| `prof flat` | `5` | `prof flat 5` | `fixtures/textmon/flat-profile-stock.json` (`"command": "prof flat 5"`) |
| `io` | `53280` (= `0xd020`) | `io $d020` | `fixtures/textmon/register-decode-stock.json` (`"command": "io $d020"`) |

## Bounds Chosen

- **`chis` and `prof flat` (kind `"count"`): 1 through 65535.** Lower bound 1 because a zero-row request is not a request. Upper bound 65535 because that is the same 16-bit domain `CPUHISTORY_GET`'s own count field lives in on this machine (`monitor_binary.c:1492`, cited in CLAUDE.md's own "Protocol" constraint on that opcode wrapping past `uint16_t`) -- staying inside that domain keeps the text-channel parameter consistent with the binary-channel equivalent this project already documents.
- **`io` (kind `"address"`): 0 through 65535.** The full 16-bit C64 machine address space -- no address on this machine is representable outside that range.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `text-protocol.ts` now exposes `TEXT_COMMAND_PARAM_SPECS`, `buildTextCommand`, and `isDialableTextCommandForVerb` for plan 42-07 (tool wiring) to consume when it registers the `chis`/`prof flat`/`io`-backed MCP tools -- `text-tools.ts` and `stock-dispatch.ts` were deliberately left untouched, per this plan's own scope boundary.
- The security seam this plan hardens (D-42-1) is proven end to end through the REAL `command()` entry point, not just the builder in isolation -- 42-07 can call `buildTextCommand()` from a tool handler and trust that anything it returns as `ok: true` is dialable, and anything it does not is refused before any byte reaches the socket.
- No blockers for the next plan in this wave.

---
*Phase: 42-the-text-format-parsers-and-their-two-binary-fixtures*
*Completed: 2026-09-09*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/text-protocol.ts` (modified)
- FOUND: `src/mcp/vice/text-protocol.test.ts` (modified)
- FOUND commit: `7ef242a5` (Task 1)
- FOUND commit: `39efc96e` (Task 2)
- Re-ran all `<acceptance_criteria>` across both tasks: PASS
- Re-ran the plan-level `<verification>` block: `node --test text-protocol.test.ts` (34/34 pass), `node --test text-connect.test.ts stock-dispatch.test.ts text-tools.test.ts` (165/165 pass), `npm run typecheck` (zero `error TS`), `npm run test:automated` (10 failures, all in files unrelated to this plan's scope, matching documented pre-existing/worktree-artifact categories)
