---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 07
subsystem: capture-substrate
tags: [capture, predicate, oracle, structural-guard, evidence, gate-input]
status: complete

requires:
  - "src/mcp/vice/vsf-slice.ts (33-04) — the C64MemSlice record whose dirRead/dataRead feed normalisePorts"
  - "src/mcp/vice/shipped-modules.ts — shippedTsModules() and codeOnly(), the census seam"
  - "evidence/SCHEMA.md § 2.4 (33-01, frozen) — the SLICER derivation rule"
  - "evidence/33-04-slicer-substrate.md (33-04) — the ACCEPTED LIMIT naming 33-07 as SLICER's closer"
provides:
  - "src/mcp/vice/capture-predicate.ts — compareCaptures, normalisePorts, parseAllowList, argvDigest, TRANSIENT_ALLOW_LIST_CAP, CaptureComparisonError, formatComparison, hex4/hex2/bin8/popcount"
  - "src/mcp/vice/stop-oracle.ts — compareStopIdentity, ORACLE_TERMS, StopOracleError, StopIdentity"
  - "src/mcp/vice/capture-seam.test.ts — CAP-03's bidirectional import census and signature census"
  - "evidence/33-slicer-validation.md — SLICER: validated, with both declared transcripts"
affects:
  - "33-08 (the allow-list derivation script consumes parseAllowList's committed shape and the cap)"
  - "33-09 (runReproducible's stop identity is compareStopIdentity's four terms)"
  - "33-10 (the real capture pair is decided by compareCaptures under a derived allow-list)"
  - "33-12 (reads SLICER: from evidence/33-slicer-validation.md as one of GATE-01's five inputs)"

tech-stack:
  added: []
  patterns:
    - "Pure byte-taking module on prg-image.ts / vsf-slice.ts's posture: no path parameter, no I/O, no path-translation import, asserted structurally from the module's own source"
    - "Replacement-in-kind rather than extension: compare.mjs's report vocabulary kept, its two rules (volatile RANGES, one-bit drift passes) dropped outright"
    - "Every red paired with a clean control in the same test, so the red is attributable to the plant and not to the fixture or harness"
    - "Census over shippedTsModules() with readFileSync + codeOnly(), never a shelled-out text search — the NUL-byte blind spot made unreachable by construction"
    - "Planted violations written into a temp tree with its own synthetic package.json, so the positive control drives the REAL rule rather than a re-implementation"
    - "Census functions THROW (CensusScopeError) when asked to scan a set that omits their module — a scan that reads nothing finds nothing and would otherwise pass"

key-files:
  created:
    - src/mcp/vice/capture-predicate.ts
    - src/mcp/vice/stop-oracle.ts
    - src/mcp/vice/capture-predicate.test.ts
    - src/mcp/vice/capture-seam.test.ts
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-slicer-validation.md
  modified:
    - src/mcp/vice/package.json

key-decisions:
  - "TRANSIENT_ALLOW_LIST_CAP is checked FIRST in parseAllowList and THROWS with no artifact returned — the cap voids the derivation (D-22) rather than warning, so there is nothing to gain from validating the entries of a list that cannot be used"
  - "compareCaptures accepts a parsed TransientAllowList OR a bare address array, normalised through one internal allowSet() that applies the same cap and address checks to both — the array form is a convenience for degenerate cases, never a widening route"
  - "The import census collects SPECIFIERS rather than matching import STATEMENTS, which makes it route-complete (multi-line static, dynamic import(), bare side-effect import, require, getBuiltinModule) without enumerating each shape"
  - "The specifier-shape filter is narrow by measurement, not by taste: an earlier draft accepting every letter-initial literal swept in every refusal message in both modules and made the non-vacuity assertion unwritable"
  - "argvDigest joins on 0x00 via a named ARGV_SEPARATOR constant written as the escape \\u0000, never a literal NUL byte in source — a literal one makes the file binary to grep, which is this tree's documented census blind spot"

requirements-completed: [CAP-03]

coverage:
  - deliverable: "The enumerated equivalence predicate under a committed cap of 64, with no bit-count tolerance"
    verification:
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#planted ONE-BIT difference outside the allow-list FAILS, and the same pair before the plant PASSES"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#parseAllowList accepts exactly 64 entries and refuses 65, naming both numbers and returning no artifact"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#parseAllowList refuses range-shaped entries by name, and the same addresses written individually parse"
        status: pass
    human_judgment: false
  - deliverable: "The $0000/$0001 6510-port overlay normalised in code, in one place, from the suffix fields, on a copy"
    verification:
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#a pair differing ONLY at $0000/$0001 is equivalent after normalisation and NOT equivalent without it"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#normalisePorts returns a COPY -- the caller's image is unchanged after the call"
        status: pass
    human_judgment: false
  - deliverable: "The three-term stop-identity oracle, symmetric, refusing a partial record"
    verification:
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#REPRO-03 adjacency: identical pc and hitCount but a frame position one frame apart is NOT identical"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-predicate.test.ts#compareStopIdentity refuses every absent or non-integer term, on either side, naming both"
        status: pass
    human_judgment: false
  - deliverable: "CAP-03's structural bar: the captured 64K barred by shape from the oracle, in both directions and on both import routes"
    verification:
      - kind: test
        ref: "src/mcp/vice/capture-seam.test.ts#CAP-03: the predicate and the oracle name no import specifier for each other, in either direction"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-seam.test.ts#CAP-03: no exported function signature in the oracle declares an image-buffer parameter"
        status: pass
      - kind: test
        ref: "src/mcp/vice/capture-seam.test.ts#planted violation (d): an oracle-shaped module whose exported comparison declares a Uint8Array parameter is reported"
        status: pass
    human_judgment: false
  - deliverable: "The SLICER gate input, derived by SCHEMA.md § 2.4's stated rule from both suites' transcripts"
    verification:
      - kind: command
        ref: "grep -Eq '^SLICER: (validated|failed)$' evidence/33-slicer-validation.md && test \"$(grep -c '^$ ' ...)\" -ge 2"
        status: pass
    human_judgment: false

metrics:
  duration: 22 min
  started: "2026-09-02T22:35:44+02:00"
  completed: "2026-09-02T22:57:39+02:00"
  tasks: 3
  files: 6

actuals:
  tokens: 25618
  tasks: 3
  commits: 3
---

# Phase 33 Plan 07: The Equivalence Predicate, the Stop Oracle and CAP-03's Structural Bar Summary

An enumerated-allow-list capture predicate with no bit-count tolerance anywhere, proven able to fail on a one-bit plant in CI; a four-scalar stop-identity oracle that takes no image buffer; a bidirectional import-and-signature census barring the two from each other with four planted controls; and `SLICER: validated` emitted in its declared file from both suites' re-run transcripts.

## What was built

**`src/mcp/vice/capture-predicate.ts`** — the one authoritative run-equivalence predicate. `TRANSIENT_ALLOW_LIST_CAP = 64` with its reasoning recorded inline (3 transients in 1024 at `READY`, itself an upper bound; 64 is an order of magnitude above it and a quarter of the page the requirement calls over-wide) and with the consequence of exceeding it stated as *voids the derivation*, not *raise the threshold*. `parseAllowList()` refuses a non-integer or out-of-range address, a duplicate, any range-shaped notation **by name** (ten span-shaped keys, plus an address written as a two-element array), and a list over the cap — the cap check runs first and throws with no artifact returned. `normalisePorts()` is the one `$0000`/`$0001` site: `$0000` takes `dirRead`, `$0001` takes `dataRead`, both from the slice record's suffix fields, and it returns `new Uint8Array` + `set` rather than `image.slice()`. `compareCaptures()` compares byte by byte, reports `allowed` and `differing` ascending, and fails on any differing address outside the list whatever its bit count. `argvDigest()` is sha256 over the exact argv NUL-joined, refusing an empty array by name.

**`src/mcp/vice/stop-oracle.ts`** — `ORACLE_TERMS = ["pc", "hitCount", "line", "cycle"]`, the three-term oracle as four scalars. `compareStopIdentity()` is symmetric, reports `differingTerms` in the declared order, and throws `StopOracleError` naming the term and the side for any absent or non-integer term. `frameTermAsserted` records which form the comparison used so `GATE-01`'s pre-mapped `ORACLE_NECESSITY: unproven` narrowing is implementable without a second published mode. The module imports nothing at all.

**`src/mcp/vice/capture-predicate.test.ts`** — 29 tests. `D-25`'s corpus-free half is the centre: a one-bit plant outside the allow-list reds while the same pair before the plant is green *in the same test*; a whole-byte plant at the same address reds identically, so no bit-count tolerance exists; a one-bit plant *at* an allow-listed address is allowed, which is what attributes the first red to the plant and not to a blanket refusal. Plus the cap boundary at 64/65, range refusals paired with the enumerated form parsing, adjacency (`$0FFF` fails, `$1000` allowed, `$1001` fails), empty and degenerate cases, symmetry and ascending order, the port normalisation asserted load-bearing by comparing the same pair without it, and the argv digest's order- and NUL-sensitivity.

**`src/mcp/vice/capture-seam.test.ts`** — 10 tests. A bidirectional import census over `shippedTsModules()` and a signature census over the oracle's exported functions, four planted violations each with a clean control over the real tree, a comment/message-string negative control, and three non-vacuity floors.

**`evidence/33-slicer-validation.md`** — both declared suites re-run at the point of derivation (`vsf-slice.test.ts` 34 tests, `capture-predicate.test.ts capture-seam.test.ts` 39 tests, `fail 0` each), the broker state and observed baseline, an `## ACCEPTED LIMIT` for the derived-scalar route, and `SLICER: validated` at column 0.

## The SLICER gate input, closed

`33-04` banked the first of `SLICER:`'s two declared transcripts and recorded an `## ACCEPTED LIMIT` explaining why it could emit neither value: `validated` would have been false with half the derivation missing, and `failed` would have fired `R1 → no-go` on a sibling plan's not-yet-written file. Both halves now exist and both were re-run here — `vsf-slice.test.ts` deliberately re-run rather than inherited, because a transcript is evidence a suite was green at the commit it was taken on and not a substitute for running it at the point of derivation.

`SLICER: validated`, at column 0, in `evidence/33-slicer-validation.md` — the single source file `SCHEMA.md` § 2 declares for that line. The three frozen files (`DECISION-RULE.md`, `SCHEMA.md`, `README.md`) are byte-unchanged and each still carries exactly one commit, `2a8ef95`.

**Scope note carried into the evidence file:** `SLICER`'s condition is `fail 0` on the two named suites and nothing else. The repository's `test:automated` red baseline of 2-in-1 sits outside § 2.4's stated condition and does not drag the line to `failed`; the two numbers share a page and the evidence file says so explicitly.

## Deviations from Plan

None — plan executed as written. Three points where the plan left the shape to the executor and the choice is worth naming:

**1. `compareCaptures` accepts a bare address array as well as a parsed artifact.** The plan's edge cases ask for an empty allow-list and a single-address list without requiring a release identifier to be fabricated for each. Both shapes go through one internal `allowSet()` that applies the same cap check and the same per-address validation, and a test asserts the array route is capped too — so the convenience is not a widening route (`T-33-26`).

**2. The import census collects specifiers, not import statements.** The plan asks for the static and dynamic routes in both directions. Matching quoted specifiers and then testing each against a path-anchored stem covers the multi-line static import, the dynamic `import()`, a bare side-effect import, `require()` and `process.getBuiltinModule()` with one rule rather than five, which is why plant (a) is deliberately the multi-line shape a per-line matcher cannot see.

**3. `argvDigest`'s NUL separator is written as the escape `"\u0000"`, never as a literal NUL byte.** The first draft of the module carried a literal NUL in the source, which made `grep` treat the whole file as binary and skip it silently — the exact blind spot `D-26` warns about and which this plan's own census exists to route around. Caught immediately (a `grep` for the constant returned nothing while `tail` showed the line) and replaced with the escape; the file now carries no control characters other than newlines, asserted before each commit.

## Verification

| Check | Result |
|---|---|
| `node --test capture-predicate.test.ts capture-seam.test.ts` | `tests 39 / pass 39 / fail 0`, exit 0 |
| `node --test vsf-slice.test.ts` (SLICER's first suite, re-run) | `tests 34 / pass 34 / fail 0`, exit 0 |
| `npm run typecheck` | exit 0, no line matching `error TS` |
| `TRANSIENT_ALLOW_LIST_CAP === 64` and `ORACLE_TERMS.length === 4` | `CONTRACTS_OK` |
| `files[]` contains both modules | `SHIPPED_OK` |
| `grep -v '^//' capture-seam.test.ts \| grep -c 'planted'` | 17 (floor 4) |
| `grep -v '^//' capture-seam.test.ts \| grep -c 'shippedTsModules'` | 5 (floor 1) |
| `evidence/33-slicer-validation.md` outcome lines and transcripts | `SLICER_INPUT_RECORDED`; 6 `$ ` lines at column 0 |
| Wave gate — `npm run test:automated` | `tests 3088 / pass 3080 / fail 2`, both in `anno-register.test.ts` (`:385`, `:479`) — at the 2-in-1 threshold, no second file |
| Broker state before every run | `systemctl --user is-active vice-broker` → `inactive` (exit 4, unit not loaded); `pgrep -a -x x64sc` → no output, exit 1 |
| Frozen files unmodified | `git diff HEAD` empty for all three; each still one commit, `2a8ef95` |

Test count moved 3049 → 3088 (+39, this plan's two suites) with the failure count unchanged at 2 in 1 file, so this plan introduced no failure.

## Known Stubs

None. Every function shipped is reached by a test in this plan's two suites, and the `frameTermAsserted` field — the one value that is constant today — is documented as recording rather than selecting, with the caller-side narrowing it exists for named.

## Accepted Limits

**One route to the circularity that neither structural assertion can see.** Recorded in `evidence/33-slicer-validation.md` as an `## ACCEPTED LIMIT` and carried from the plan's own `<flagged_assumptions>` (the deterministic edge probe classified `CAP-03`'s single edge `unclassified`). The import census and the signature census bar the capture from the oracle by *import* and by *parameter type*. Neither can see a caller that reads the capture itself and passes a **derived scalar** into `compareStopIdentity` — a digest, a differing-address count, an equivalence verdict — because no signature check can distinguish that `number` from a legitimately-read register value. `stop-oracle.ts`'s `WHAT NOT TO DO` forbids the derived-scalar route in prose, which is the weaker instrument the two stronger ones cannot reach. What would falsify the assumption that the two assertions are together sufficient: exactly such a call site.

## Threat Flags

None. Both new modules import only `node:crypto` (predicate) and nothing (oracle); neither opens a socket, reads a path, or touches a trust boundary the plan's `<threat_model>` did not already enumerate.

## Next

Ready for `33-08` (the `N >= 3` allow-list derivation script and the three-field reproducibility key, which consume `parseAllowList`'s committed shape, the cap and `argvDigest`) and `33-09` (`runReproducible()`, whose stop identity is `compareStopIdentity`'s four terms). Wave 3 is complete: the wave gate was taken after this plan landed and reports 2 failures in 1 file, both pre-existing.

## Self-Check: PASSED

Every file named in `key-files.created` exists on disk; all three task commits are reachable (`91633fb`, `8bb32d0`, `80fedeb`); `files[]` carries both new modules; `node --test capture-predicate.test.ts capture-seam.test.ts` re-reports `tests 39 / pass 39 / fail 0` and `npm run typecheck` exits 0 at the close-out commit; and `git diff HEAD` is empty for all three frozen evidence files, each still carrying exactly one commit (`2a8ef95`).
