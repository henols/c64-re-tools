---
phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans
plan: 06
subsystem: testing
tags: [test-suite-surgery, shipped-modules, node-test, source-scanning]

# Dependency graph
requires:
  - phase: 56-01
    provides: "The proven D-14 scratch scanner at /tmp/gsd-56-scope-scan/scope-scan.mjs, reused
      here directly (re-ran its planted-fixture proof, observed GREEN, then ran it over
      stock-dispatch.test.ts)."
provides:
  - "One more of the seventeen files that imported shipped-modules.ts no longer does:
    stock-dispatch.test.ts -- measured as the largest single population of raw-source-scanning
    cases in the phase (15 whole-case removals plus 2 D-02/D-03 renames)."
  - "The verbatim fifteen-case removed-case-name list, plus both D-03 renames, for this plan's
    share of D-16's SUMMARY deliverable."
affects: [56-07, 56-08, 56-09, 56-10, 56-11]

# Actuals (#2632) -- pairs with the plan's estimate to calibrate future estimates.
actuals:
  tokens: 5435
  tasks: 3
  commits: 3

tech-stack:
  added: []
  patterns:
    - "Per-file TAP name-set diff (node --test --test-reporter=tap <file>, before/after,
      comm -23/-13) as the sole coverage-preservation gate, per D-15. Used three times in this
      plan (once per task), each landing exactly on the named set of removals/renames with zero
      unexpected loss or gain."
    - "The D-14 scanner's line attribution is exact (paren-matched test() boundaries, not line
      proximity) EXCEPT when a regex-heavy body upstream corrupts its own depth-counting --
      measured live here: the WR-06 'plain wording' case's reported 'direct' hit at its own
      test() boundary carried no doomed-symbol text anywhere inside that boundary on hand-read,
      because an earlier paren-matching artifact (not this scanner run's masking bug, but its
      general fragility on this file's regex-dense assertions) attributed a distant real hit to
      the wrong call. Checked by direct string search inside the reported [start,end) span
      before trusting the hit, exactly as the plan's scanner_protocol instructs."
    - "A case-name naming convention ('structure/proxy: ...') can outlive its own scope
      boundary: three 'structure/proxy'-prefixed cases existed beyond the plan's 11-item
      candidate list, surfaced only by re-grepping the whole convention prefix rather than
      trusting the candidate enumeration was exhaustive. Two were genuine source-text scans and
      were removed. One read a JSON manifest and an imported production array with zero
      source-text assertion. It was kept and renamed under a D-03-adjacent judgement to clear the
      plan's own mechanical zero-prefix acceptance gate without touching behaviour."

key-files:
  created: []
  modified:
    - src/mcp/vice/stock-dispatch.test.ts

key-decisions:
  - "Task 2's candidate list (11 named 'structure/proxy' cases) undercounted the section by
    three. Re-grepped the whole file for the 'structure/proxy' prefix before trusting the
    candidate list was exhaustive, per the plan's own acceptance criteria ('No case name
    beginning structure/proxy remains'). See patterns-established and Deviations below."
  - "The 'anno_* curation' case (originally 'structure/proxy (plan 29-01): every curated anno_*
    name is absent from tools-manifest.stock.json') reads a JSON manifest file plus an imported
    production array (CURATED_ANNO_TOOLS from anno-tools.ts) -- not source text under the
    cut_rule's IN SCOPE test. Kept its body 100% byte-identical (nothing was stripped) and
    renamed it only to drop the misleading 'structure/proxy' prefix, so the plan's mechanical
    grep gate ('No case name beginning structure/proxy remains') passes without misrepresenting
    what the case actually proves."
  - "VICE_PROXY_SOURCE became fully orphaned after Task 2's removals (every one of its seven
    callers was itself removed by Task 2, including Task 1's own already-stripped WR-06 case,
    which had already lost its one reference to this constant in Task 1). Task 2's commit
    message incorrectly stated the constant was being kept because Task 1's case still used it.
    It did not. Fixed by removing the orphaned constant in Task 3, which independently
    satisfies this plan's 'no _SOURCE constant remains' acceptance gate."

requirements-completed: [SC-1, SC-2, SC-3, SC-4]

coverage:
  - id: D1
    description: "The WR-06 region (Task 1): the wholly-behavioural handshake-wording case
      survives untouched (scanner hit recorded as a false positive after hand-read). The
      genuinely mixed IPv6-bracket case is stripped of its source-text slice under D-02/D-03,
      keeps its three WHATWG URL parser assertions byte-for-byte, and is renamed to state only
      what it now proves."
    requirement: SC-1
    verification:
      - kind: unit
        ref: "stock-dispatch.test.ts (TAP name-set diff, /tmp/56-06-t1-lost.txt /
          -gained.txt -- lost 1 old name, gained 1 new name, zero unexpected)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D2
    description: "The structure/proxy region (Task 2): all 14 'structure/proxy'-prefixed cases
      in the file -- the 11 the plan named plus 3 it did not enumerate -- are resolved. 13 are
      pure vice-proxy.ts/anno-tools.ts source-text scans with no production call, removed whole
      under D-01, along with their now-orphaned proxyToolRegistrations()/reachesDispatchStock()
      helpers and the VICE_PROXY_CODE_LINES/ANNO_TOOLS_SOURCE constants. 1 (the anno_* curation
      case) reads JSON + an import, not source text -- kept byte-identical, renamed to drop the
      prefix. The CHAN-04 concurrent-dispatch cases and every other behavioural case survive
      untouched."
    requirement: SC-2
    verification:
      - kind: unit
        ref: "stock-dispatch.test.ts (TAP name-set diff, /tmp/56-06-t2-lost.txt /
          -gained.txt -- lost 14, gained 1, all recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
    human_judgment: false
  - id: D3
    description: "The last two scanning cases and the import (Task 3): the fork-forwarding
      structural case (a raw readFileSync of stock-dispatch.ts's own source -- the shape a
      symbol-anchored scan cannot see) and the WR-13 invariant case (enumerates every shipped
      module via shippedTsModules() and reads each as text) are removed whole, along with the
      now-orphaned nonCommentLines() helper, the doomed shipped-modules.ts import, and the
      VICE_PROXY_SOURCE constant orphaned by Task 2. The two mandated blind-spot passes (raw
      readFileSync of a sibling .ts/.mts, plus a suspicious case-name skim) found no further
      candidate. The CHAN-04 concurrent-dispatch case survives untouched."
    requirement: SC-3
    verification:
      - kind: unit
        ref: "stock-dispatch.test.ts (TAP name-set diff, /tmp/56-06-t3-lost.txt /
          -gained.txt -- lost 2, gained 0, both recorded)"
        status: pass
      - kind: unit
        ref: "npm --prefix src/mcp/vice run typecheck"
        status: pass
      - kind: unit
        ref: "npm run test:automated (src/mcp/vice) -- EXIT=0, tests 3697, pass 3688, fail 0,
          skipped 9"
        status: pass
    human_judgment: false
  - id: D4
    description: "stock-dispatch.test.ts is neither empty nor setup-only after the cut: it lost
      exactly 15 case names net (137 before this plan, 122 after), carries no doomed import, no
      _SOURCE constant, and no raw readFileSync of a sibling .ts/.mts, while every behavioural
      case -- including all four CHAN-04 channel-lock cases and the manifest-conformance harness
      -- remains."
    requirement: SC-4
    verification:
      - kind: unit
        ref: "grep -c 'from \"./shipped-modules.ts\"' returns 0, grep -cE
          '^const [A-Z_]+_SOURCE' returns 0, and the TAP set count moved from 137 to 122
          (net -15)"
        status: pass
    human_judgment: false

# Metrics
duration: 35min
completed: 2026-09-15
status: complete
---

# Phase 56 Plan 06: Cut stock-dispatch.test.ts's Source-Scanning Cases Summary

**Removed 15 whole source-scanning cases and stripped/renamed 2 more (one mixed, one merely
misnamed) from stock-dispatch.test.ts -- the phase's largest single population of raw-source
scans, reached through two module-scope `*_SOURCE` constants and a direct `readFileSync` rather
than the doomed module alone. The whole suite stays green.**

## Performance

- **Duration:** 35 min
- **Started:** 2026-09-15T06:42:00Z
- **Completed:** 2026-09-15T07:17:00Z
- **Tasks:** 3
- **Files modified:** 1

## Accomplishments
- Re-ran the D-14 scratch scanner's planted-fixture proof (GREEN, 2/2 expected hits, zero false
  positives on comments/strings/regex-after-`return`) before trusting it against the real file,
  per the plan's `scanner_protocol`. Ran it over `stock-dispatch.test.ts`: 7 direct hits, matching
  the plan's stated count exactly.
- **Task 1 (WR-06 region):** hand-read the scanner's "plain wording" hit and found no
  doomed-symbol text anywhere inside that case's own `test()` boundary -- recorded as a false
  positive. The scanner's exact paren-matched boundary detection is otherwise reliable on this
  file, but this one hit was attributed wrong (see patterns-established). Left the case untouched.
  Hand-read the genuinely mixed IPv6-bracket case, applied D-02/D-03: kept its three WHATWG URL
  parser assertions byte-for-byte, removed its trailing `buildHeldLease()` source-text slice, and
  renamed it from `"WR-06: vice-proxy.ts strips the WHATWG bracket form when deriving the dial
  host, so an IPv6 URL is usable by net.connect()"` to `"WR-06: the WHATWG URL parser keeps IPv6
  brackets in .hostname, and the same strip expression removes them while leaving an IPv4 host
  unaffected"` -- the surviving name states only what the surviving assertions prove.
- **Task 2 (structure/proxy region):** the plan's candidate list named 11 "structure/proxy"
  cases. Re-grepped the whole file for the prefix (mandated by the acceptance criteria's blanket
  zero-count gate) and found 3 more the plan did not enumerate. Hand-read all 14: 13 are pure
  `VICE_PROXY_SOURCE`/`VICE_PROXY_CODE_LINES`/`ANNO_TOOLS_SOURCE`/`proxyToolRegistrations()`
  text scans with zero production call, removed whole under D-01 along with the now-orphaned
  `proxyToolRegistrations()`, `reachesDispatchStock()`, `SYNTHETIC_TOOL_KEYS`,
  `BACKEND_SEAM_BYPASS_KEYS`, `VICE_PROXY_CODE_LINES` and `ANNO_TOOLS_SOURCE`. The 14th (the
  "anno_* curation" case) reads `tools-manifest.stock.json` (JSON, explicitly NOT IN SCOPE) plus
  the imported `CURATED_ANNO_TOOLS` production array -- not source text at all. Kept its body
  100% byte-identical and renamed it (dropped the "structure/proxy" prefix) since nothing about
  it needed stripping. Also removed the CR-07 section-header comment and the CR-06 comment, both
  of which described exclusively removed content (same "describes exactly the removed content
  and nothing else" precedent 56-05 established for `vsf-slice.test.ts`'s "Structural SUPPLEMENT"
  header). Left the unrelated, already-stale FORKRM-01 historical comment untouched per D-13.
- **Task 3 (last two cases, the import, the full gate):** removed the fork-forwarding structural
  case (a raw `readFileSync` of `stock-dispatch.ts`'s own source -- the exact blind-spot shape
  the symbol-anchored scanner cannot see, per RESEARCH's Open Questions) and the WR-13 invariant
  case (enumerates every shipped module via `shippedTsModules()` and reads each as text), plus
  the now-orphaned `nonCommentLines()` helper, its own WR-13 section-header comment (which
  described exclusively the removed case), and the doomed `shipped-modules.ts` import. Re-ran the
  mandated blind-spot passes (raw `readFileSync` of a sibling `.ts`/`.mts`, module-scope
  `*_SOURCE` constants, and a suspicious case-name skim) over the whole file and found one
  leftover:
  `VICE_PROXY_SOURCE`, orphaned by Task 2's removals (see Deviations). Removed it, which also
  independently satisfies the plan's own "no `_SOURCE` constant remains" acceptance gate.
- `npm run test:automated`: `EXIT=0`, `tests 3697`, `pass 3688`, `fail 0`, `skipped 9` -- matching
  the 56-05 baseline (`tests 3712`) minus exactly the 15 net case names this plan removed
  (137 TAP names before this plan, 122 after). `npm run typecheck` exits 0 after every commit.

## Task Commits

Each task was committed atomically:

1. **Task 1: The WR-06 region, including the one measured mixed case** - `076ac157` (test)
2. **Task 2: The structure/proxy region and its two source constants** - `feeb10ad` (test)
3. **Task 3: The two remaining scanning cases, the import, and the full automated gate** -
   `9a706864` (test)

**Plan metadata:** (this commit)

## Files Created/Modified
- `src/mcp/vice/stock-dispatch.test.ts` - lost 15 whole source-scanning cases net, stripped and
  renamed 1 mixed case, renamed 1 misnamed-but-behavioural case, and lost the
  `proxyToolRegistrations()`/`reachesDispatchStock()`/`nonCommentLines()` helpers,
  `SYNTHETIC_TOOL_KEYS`/`BACKEND_SEAM_BYPASS_KEYS`/`VICE_PROXY_CODE_LINES`/`ANNO_TOOLS_SOURCE`/
  `VICE_PROXY_SOURCE` constants, and the doomed `shipped-modules.ts` import. Every CHAN-04 case,
  the manifest-conformance harness, and every other behavioural case stay untouched.

## Decisions Made
See key-decisions in frontmatter: the undercounted candidate list (Task 2), the JSON-manifest
case's rename-not-remove treatment, and the VICE_PROXY_SOURCE orphan fix.

## Deviations from Plan

### Auto-fixed Issues

**1. [Cut-rule finding] Task 2's candidate list undercounted the "structure/proxy" section by 3**
- **Found during:** Task 2
- **Issue:** The plan's action text named 11 "structure/proxy"-prefixed candidates, but the
  file held 14. The 3 unlisted cases were surfaced only because the task's own acceptance
  criteria ("No case name beginning 'structure/proxy' remains in the file") is a blanket
  mechanical gate, not scoped to the named list, so a fresh whole-file grep for the prefix was
  run before trusting the candidate enumeration was exhaustive.
- **Fix:** Hand-read all 3. Two ("every registered tool whose runner can touch a transport
  reaches dispatchStock..." and "the synthetic tools are all registered...") are pure
  `proxyToolRegistrations()`-based text scans with zero production call -- removed whole under
  D-01, consistent with the plan's own treatment of the 11 named siblings. The third ("every
  curated anno_* name is absent from tools-manifest.stock.json") reads JSON + an import, not
  source text -- NOT IN SCOPE for removal under the cut_rule, kept byte-identical, renamed only
  to clear the mechanical prefix gate.
- **Files modified:** src/mcp/vice/stock-dispatch.test.ts
- **Verification:** TAP name-set diff for Task 2 shows exactly 14 lost / 1 gained, matching the
  full (11 named + 3 found) accounting. `grep -ac 'test("structure/proxy' stock-dispatch.test.ts`
  returns 0.
- **Committed in:** feeb10ad (Task 2 commit)

**2. [Cut-rule finding] Task 2's candidate #1 did not match its plan description, left untouched**
- **Found during:** Task 2
- **Issue:** The plan described candidate 1, `"dispatch: no handler in the table ever throws --
  dispatchStock always resolves to a well-formed {content,isError} result"`, as "reading a
  source constant twice while also calling dispatchStock for real." Hand-read showed the case's
  entire body loops three literal tool names through a real `dispatchStock()` call with zero
  source-text assertion anywhere -- it does not meet the cut_rule's IN SCOPE test (subject must
  be source TEXT) at all.
- **Fix:** Per the plan's own boundaries ("Stop and report. Never adjust... that measurement IS
  the finding"), left the case completely untouched -- no strip, no rename (its name does not
  over-promise anything a stripped half would have proved). Reported here rather than silently
  reconciled.
- **Files modified:** none (no change made)
- **Verification:** the case is present, byte-identical, in every post-cut TAP set across all
  three tasks.
- **Committed in:** n/a (no code change)

**3. [Cut-rule finding, fixed in Task 3] Task 2's commit message misstated why
VICE_PROXY_SOURCE was kept**
- **Found during:** Task 3's blind-spot pass
- **Issue:** Task 2's commit message asserted `VICE_PROXY_SOURCE` was being kept because "Task
  1's renamed WR-06 case still reads it." That was incorrect: Task 1's own D-02/D-03 strip had
  already removed the WR-06 case's one reference to that constant, in Task 1 itself. By the time
  Task 2 ran, the constant's only remaining callers were the 7 "structure/proxy" cases Task 2 was
  itself removing (candidates 3, 4, 5, 7, 9, 11, plus the CR-06 buildHeldLease case) -- so it
  became fully orphaned the moment Task 2's removals landed, not kept alive by anything.
- **Fix:** Task 3's mandated blind-spot pass (module-scope `*_SOURCE` constants) caught the
  orphaned constant before the plan closed. Removed it in Task 3, which also independently
  satisfies the plan's own "no `_SOURCE` constant remains" acceptance gate. No functional impact
  occurred at any point. Typecheck and the TAP suite were green at every commit, including the
  one carrying the inaccurate message.
- **Files modified:** src/mcp/vice/stock-dispatch.test.ts
- **Verification:** `grep -cE '^const [A-Z_]+_SOURCE' stock-dispatch.test.ts` returns 0 after
  Task 3. `npm run typecheck` and `npm run test:automated` both stay green throughout.
- **Committed in:** 9a706864 (Task 3 commit)

---

**Total deviations:** 3 (2 cut-rule findings reported per the plan's own protocol, 1
documentation-accuracy fix with zero functional impact).
**Impact on plan:** None on correctness -- the TAP name-set diffs, typecheck, and full automated
suite were green at every commit. All three are transparency corrections the plan's own
discipline (D-17 set-comparison gates, "stop and report, never adjust") is designed to surface.

## Issues Encountered

None beyond the three deviations above. The BEFORE TAP name set was captured before editing
began for each of the three tasks, per prior-wave context item 4.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Eleven of seventeen importing files are now clear (three from 56-01, three from 56-03, two
  from 56-04, two from 56-05, one -- `stock-dispatch.test.ts`, the largest single population of
  cases in the phase -- from this plan). Six remain, minus `anno-seam.test.ts` which 56-02
  already reduced without removing the file: `anno-derive.test.ts`, `anno-store.test.ts`,
  `anno-export-asm.test.ts`, `anno-coverage.test.ts`, plus `shipped-modules.ts` +
  `shipped-modules.test.ts` themselves (D-09, final wave only after every regular file loses its
  import).
- No blockers. The suite is green (`fail 0`, `skipped 9`, matching baseline minus this plan's 15
  net removed case names) and typecheck is clean. The next plan in this phase's wave sequence can
  proceed independently.

---
*Phase: 56-remove-shipped-modules-ts-and-its-embedded-source-scans*
*Completed: 2026-09-15*

## Self-Check: PASSED

- FOUND: `src/mcp/vice/stock-dispatch.test.ts`
- FOUND commit `076ac157` (Task 1)
- FOUND commit `feeb10ad` (Task 2)
- FOUND commit `9a706864` (Task 3)
- Every task's `<acceptance_criteria>` re-verified against the current tree: TAP name-set diffs
  match the recorded lost/gained names (1/1, 14/1, 2/0), `grep -c 'from "./shipped-modules.ts"'`
  returns 0, `grep -cE '^const [A-Z_]+_SOURCE'` returns 0, `grep -ac 'test("structure/proxy'`
  returns 0, and `npm run typecheck` exits 0.
- Plan-level `<verification>` re-run: `npm run test:automated` exits 0 with `fail 0`, `skipped 9`
  (same as baseline), `tests 3697` (baseline 3712 minus the 15 net cases this plan removed).
  `git log --name-only` for this plan's three task commits names only
  `src/mcp/vice/stock-dispatch.test.ts` in each.
