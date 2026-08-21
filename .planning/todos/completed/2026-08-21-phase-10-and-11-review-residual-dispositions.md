---
created: 2026-08-21
source: v0.3.0-MILESTONE-AUDIT.md AUDIT-01, closing the disposition gap 10-REVIEW.md
  and 11-REVIEW.md left open
severity: warning
resolves_phase: 11.1
---

# Phase 10 and 11 review residual dispositions — the AUDIT-01 ledger

`v0.3.0-MILESTONE-AUDIT.md`'s AUDIT-01 finding was not "these findings are wrong." It was
**"WR-09, WR-10, WR-11, WR-12 and IN-01 through IN-07 appear in no todo, no STATE.md
entry, and no SUMMARY."** The Phase 10 residual-findings todo
(`2026-08-20-r2000-review-residual-findings.md`) enumerated WR-02 through WR-07 without
saying why the rest were excluded. This ledger closes that silence: every one of the
eleven `10-REVIEW.md` findings below, plus `11-REVIEW.md`'s IN-02, now has an explicit
disposition — fixed (naming the plan, task and SUMMARY) or deferred (naming the todo and
the reason).

Verified against the six 11.1 SUMMARYs, not assumed from the plan's own predicted
mapping — every citation below was checked against the cited SUMMARY's actual text and,
for `fixed` entries, the cited commit hash was confirmed present in `git log`.

## `10-REVIEW.md` findings

### WR-09: `bootstrapProject()`'s documented never-throw contract is broken on two paths

> "the function's own doc comment... states 'Never throws for an expected, user-facing
> failure...' Every other `parsePrg` call is wrapped... but the `.d64` one... is not, and
> the write... is not wrapped at all." (`r2000-cli.ts:199`, `:220`)

**Disposition: fixed.** Plan `11.1-06` Task 1 (commit `c74617e`). `bootstrapProject()`'s
`.d64` `parsePrg()` call is now caught and reworded in the caller's own vocabulary
(entry name, byte count); both `bootstrapProject()`'s and `cmdRenderMemmap()`'s
`writeFileSync()` calls are now guarded. Pinned structurally by a brace-depth backward
scan in `r2000-cli.test.ts` proven non-vacuous by a planted violation and a real,
reverted demonstration against the file itself.
See: `11.1-06-SUMMARY.md` § Accomplishments, § Verification Evidence (Task 1).

### WR-10: `runR2000()` has no default timeout and no `maxBuffer`, on a synchronous spawn

> "`RunR2000Options.timeoutMs` exists but no caller sets it... `spawnSync` has no default
> timeout... `maxBuffer` is likewise unset..." (`r2000-launch.ts:142-158`)

**Disposition: fixed.** Plan `11.1-04` Task 1 (commit `b915913`). `runR2000()` now bounds
its `spawnSync` with `R2000_TIMEOUT_MS` (120s default, env-overridable via
`parseR2000TimeoutMs()`, which never yields `NaN`) and `R2000_MAX_BUFFER` (32 MiB), both
translated to named, argv-naming errors; `opts.timeoutMs` caller override preserved.
Proven live against real `regenerator2000 0.9.20` (38/38 pass) and the timeout proven
real by driving it through a genuinely separate Node child process.
See: `11.1-04-SUMMARY.md` § Accomplishments, § Live Verification Evidence.

### WR-11: `acme.mjs`'s own `--help` still advertises the libraries `template.a` no longer uses

> "The driver's usage block still reads: `new <file.a> scaffold a C64 program (BASIC stub
> + libs)`" (`.claude/skills/acme-build/scripts/acme.mjs:238`)

**Disposition: fixed.** Plan `11.1-05` Task 1 (commit `94010dd`). `acme.mjs`'s `new` usage
line now reads "scaffold a C64 program (BASIC stub, no libraries needed)"; the corrected
claim is pinned in BOTH directions (forbidden text absent, required text present) by
`check-skill-fork-honesty.mjs`'s new `SKILL_FILE_CLAIMS` array, via a shared
`fileClaimViolations()` predicate proven non-vacuous by a committed planted violation
plus a live RED-baseline run against the real script.
See: `11.1-05-SUMMARY.md` § Accomplishments, § Evidence (WR-11 bidirectional pin).

### WR-12: the `.d64` round-trip tests encode the implementation's own used-byte formula in their own fixture writer

> "the fixture writes `usedByte = payloadLen + 1`; the implementation reads `payloadLen =
> usedByte - 1`. Those are the same equation, so the round-trip test... is a tautology..."
> (`r2000-d64.test.ts:50-76`, and the duplicate at `r2000-cli.test.ts:87-92`)

**Disposition: fixed (primary site); duplicate left as accepted debt (see "Found while
dispositioning" below).** Plan `11.1-06` Task 3 (commit `d9c339e`). Two hand-written,
literal `.d64` final-sector fixtures pin the DOS used-byte convention independently of
`writeChain()`'s own formula in `r2000-d64.test.ts`. A live joint-mutation demonstration
proved the tautology `writeChain()`'s own round-trip test could not catch (inverting only
the read side still breaks the round trip too; only a self-consistent joint mutation of
both write and read formulas reproduces the actual tautology, and the two new literal
fixtures correctly fail it while the `writeChain()`-based tests do not).
See: `11.1-06-SUMMARY.md` § Accomplishments, § Verification Evidence (Task 3).

## Info

### IN-01: `process.exit()` immediately after `console.log` can truncate piped output

> "the dispatch ends the process the instant `runR2000Cli()` resolves. On a pipe,
> `console.log`/`console.error` writes are asynchronous, and `process.exit()` discards
> whatever has not drained." (`vice-proxy.ts:217-221`)

**Disposition: fixed.** Plan `11.1-05` Task 3 (commit `d5e01a8`). `vice-proxy.ts`'s `r2000`
CLI dispatch now explicitly drains `process.stdout`/`process.stderr` (bounded to 300ms)
before `process.exit()`. Measured on this host: pre-fix, a 512000-byte piped payload
truncated at exactly 65536 bytes; post-fix, all 512000 bytes are delivered, and a
never-reading pipe still exits well under the bound rather than hanging. Fixing the drain
surfaced and fixed a second, self-inflicted regression (an EPIPE crash on an
early-closing reader) in the same commit — see that plan's Deviations §1.
See: `11.1-05-SUMMARY.md` § Accomplishments, § Deviations (Auto-fixed Issue 1), § Evidence
(IN-01 byte-count measurements).

### IN-02: the host-path absence assertion is single-line and static-import-only

> "the regex is applied per line, so a multi-line named import... never matches, and a
> dynamic `await import(...)` never matches either." (`hostpath-consumers.test.ts:43`,
> `:106-118`)

**Disposition: fixed.** Plan `11.1-03` Task 2 (commit `95b128f`). `HOSTPATH_IMPORT_RE` now
matches against the whole comment-stripped source with the `m` flag (catching a
multi-line named import); a new `HOSTPATH_DYNAMIC_IMPORT_RE` catches `await import(...)`.
`stripCommentLines()` extended to also strip `/* ... */` block comments. Demonstrated
live: rewriting `stock-paths.ts`'s import into multi-line form is still detected; a
committed three-shape planted-violation test (multi-line static, dynamic, and a
comment/string-only control that must NOT be flagged) proves the widening did not
degrade into a substring search.
See: `11.1-03-SUMMARY.md` § Accomplishments (Task 2), § Verification Evidence (Task 2).

### IN-03: the `\bdisasm\b` deletion pin will false-positive on the protected Phase-4 module names

> "`-` is a non-word character, so `\bdisasm\b` matches `disasm-decoder.ts`,
> `disasm-opcodes.ts` and `disasm-renderer.ts`." (`scripts/check-skill-fork-honesty.mjs:373`)

**Disposition: fixed.** Plan `11.1-05` Task 2 (commit `c3f5b75`). The standalone-`disasm`
check is now `isStandaloneDisasmToken()`, excluding any hyphen-adjacent-letter shape, so a
skill doc naming `disasm-decoder.ts` etc. no longer trips a false "deleted verb"
diagnostic, while a real reintroduction of the bare `disasm` verb token — and WR-03's
exact same-line hole (`cmdDisasm`/`toacme` reintroduced on the one exempted line) — are
both still caught live (re-verified unchanged after the edit).
See: `11.1-05-SUMMARY.md` § Accomplishments, § Evidence (IN-03 live scratch-file checks).

### IN-04: two near-vacuous assertions in `r2000-launch.test.ts`

> "the test sets `process.env.R2000_BIN` at test time, but `R2000_BIN` is resolved at
> module load... so the mutation cannot affect the spawn... The following test asserts
> only `typeof R2000_BIN === "string"`..., which the `?? "regenerator2000"` default makes
> unfalsifiable." (`r2000-launch.test.ts:116-137`)

**Disposition: fixed.** Plan `11.1-04` Task 1 (commit `b915913`, the same commit as
WR-10 -- both touch `r2000-launch.ts`/`r2000-launch.test.ts`'s top-of-file region). The
dead `process.env.R2000_BIN` mutation was removed and the test retitled to what it
actually proves (`assertNoViceFlag` runs before any spawn attempt); the unfalsifiable
`typeof` assertion was replaced with a real equality check guarded on the env var being
unset. This same lesson was applied preemptively to `R2000_TIMEOUT_MS` (WR-10's new
env-derived constant), via a pure `parseR2000TimeoutMs()` helper and a real
separate-child-process test rather than a same-process env mutation.
See: `11.1-04-SUMMARY.md` § Accomplishments ("IN-04 fixed"), key-decisions.

### IN-05: garbled sentence in the rewritten Setup section

> "'The scaffold `new` writes / assembles against a bare install with no standard
> hardware-register library' -- a word is missing." (`acme-build/SKILL.md:155-156`)

**Disposition: fixed.** Plan `11.1-05` Task 1 (commit `94010dd`, the same commit as
WR-11 -- both are the acme-build-surfaces-honesty task). `SKILL.md`'s Setup sentence now
reads "The scaffold that `new` writes assembles against a bare install with no standard
hardware-register library" -- the missing word restored, original word-wrap point kept.
See: `11.1-05-SUMMARY.md` § Accomplishments, key-decisions (IN-05 entry).

### IN-06: `verify` accepts `--out` and silently ignores it

> "`parseArgs()` returns `out` for every verb, `cmdVerify` destructures only
> `{ positional, entry }`... A caller who passes it gets no error and no effect."
> (`r2000-cli.ts:294`)

**Disposition: fixed.** Plan `11.1-06` Task 2 (commit `03e71e9`). One frozen
`VERB_OPTIONS` map plus `checkAcceptedOptions()`, wired at `runR2000Cli()`'s single
pre-dispatch call site, refuses any `--flag` a verb does not accept, for all seven verbs
-- not just `verify`. Building the map from ground-truth code behaviour (not from USAGE
text) also caught and closed the identical shape for `verify --force` (silently parsed
and discarded, same as `--out`) and surfaced a real, separate documentation gap
(`export-asm`'s USAGE line never listed its already-working `--entry` forwarding),
fixed as a documentation-only correction in the same commit.
See: `11.1-06-SUMMARY.md` § Accomplishments, § Decisions Made, § Deviations.

### IN-07: `probeR2000()` / `SKIP_REASON` / the availability-gate test are duplicated verbatim in three test files

> "three identical copies, each spawning `regenerator2000 --version` at module scope...
> and two tests with the identical name 'regenerator2000 availability gate (D-11)'."
> (`r2000-cli.test.ts:274-303`, `r2000-verify.test.ts:145-174`, `r2000-project.test.ts`)

**Disposition: deferred.** Lives at
`.planning/todos/pending/2026-08-21-migrate-hand-copied-acme-gates-to-r2000-test-gate.md`.
This is IN-07's **only** deferral in this ledger -- stated plainly: plan 11-01 already
created `r2000-test-gate.ts` and six of the eight r2000/ACME-gated test files import it;
two hand-copied gates remain (`r2000-cli.test.ts`, `r2000-project.test.ts`). Converting
them is behaviour-preserving churn on files whose gate semantics are load-bearing for
Phase 11's already-verified criterion-3 evidence (`11-VERIFICATION.md` cites
`r2000-cli.test.ts`'s test 35 by name) -- the reason the existing migration todo already
gave. **Amended during this ledger's own dispositioning pass:** the todo's `files:` list
was missing `r2000-project.test.ts` (which carries the same hand-copied
`probeR2000()`/`SKIP_REASON` block, confirmed live at `r2000-project.test.ts:133-175`) --
10-REVIEW.md's own IN-07 wording named all three files, but the todo only ever tracked
two. Added `r2000-project.test.ts` to the `files:` list and a line to "What to do" naming
the third copy, so IN-07's home is complete rather than approximately right.

## `11-REVIEW.md` finding

### IN-02: `regenerateAndReload()` (the D-29 live-discovery merge point) has no production caller

> "This function is exported and described as 'the store is the merge point for a
> live-discovered name,' but it is referenced nowhere outside its own module and its test
> file..." (`r2000-symbols.ts:301-317`)

**Disposition: fixed (marked library-only, not given an invented caller).** Plan
`11.1-04` Task 3 (commit `0ff3440`). `regenerateAndReload()`'s doc comment now carries a
`LIBRARY-ONLY (Phase 11 IN-02, D-11.1-06)` marker naming the proven live path
(`export-lbl` -> `vice_symbols_load` -> live discovery -> `r2000_set_label_name` ->
`import-lbl`, per `c64-program-recon/SKILL.md`) and the adoption condition. A
biconditional guard in `r2000-symbol-roundtrip.test.ts` ties the marker to the real
production-caller count (across `.claude/mcp/vice/`, `.claude/skills/`, `scripts/`) in
both directions -- demonstrated live: a scratch production caller makes the guard fail
naming the caller; deleting the marker with zero callers also fails.
See: `11.1-04-SUMMARY.md` § Accomplishments ("Phase 11 IN-02 recorded"), § Library-Only
Marker Non-Vacuity Proof.

## Found while dispositioning

Two were already known from planning and are recorded here as instructed. Two more were
found during this pass and are recorded for the same reason -- leaving any of them
unstated would be the exact AUDIT-01 defect this ledger exists to close.

**1. The test-only env hatch `VICE_TEST_R2000_CLI_STDOUT_FILL_BYTES` (11.1-05, Task 3),
in shipped code.**
`vice-proxy.ts`'s `r2000` CLI dispatch now carries a narrow, clearly-named env-var escape
hatch that writes a deterministic filler payload through the real drained-exit code path.
It exists because neither of the plan-named payload-generation routes (`--help`'s fixed
~5.6 KB USAGE text; `cmdExportAsm`'s error path fed garbage input) could deterministically
produce a payload anywhere near 128 KiB against real `regenerator2000 0.9.20` on this
host -- both were measured directly and neither scales with input size at all.
**Disposition: accepted debt.** It is gated behind an env-var name no real caller would
ever set, is inert unless explicitly set, never appears in `--help` or any user-facing
documentation, and only emits filler bytes (inspected: it cannot execute code or read
arbitrary files). A test hook in shipped code should not pass unremarked, so it is
recorded here rather than left implicit in the SUMMARY alone.

**2. The comment-scope gap in plan 11.1-01's phase-pointer guard.**
The guard (`docs-dangling-refs.test.ts`'s `extractStringLiterals()`/
`danglingPhaseLiterals()`) is string-literal-only by deliberate design -- a comment-scoped
guard would be self-invalidated by the fix's own explanatory comments (this repo's fixes
routinely name the old, banned wording in a "what NOT to do" comment). Consequence:
`r2000-project.ts`'s third FLOW-02 site (a header comment, not a string literal) was fixed
by hand in plan 11.1-01 Task 1 and is permanently outside the guard's reach.
**Disposition: accepted debt**, already documented as a "Known Limitation" in
`11.1-01-SUMMARY.md` and restated here so it is not closed by living only in one plan's
SUMMARY.

**3. Two stale phase pointers in comments, outside the r2000 family:**
`stock-cia.ts:39` ("is Phase 8's business," for full stock keyboard-matrix recovery) and
`stock-dispatch.ts:614-615` (a "Phase 7" routing note for `vice_disk_detach` and
`vice_joystick_tap`). Both hand work to phases that have since completed; the
`vice_joystick_tap` half is additionally superseded by `stock-input.ts`'s own, separate,
permanent-exclusion decision. **Disposition: filed as a pending todo** --
`.planning/todos/pending/2026-08-21-stale-phase-pointers-in-stock-cia-and-stock-dispatch-comments.md`
-- because `vice_disk_detach`'s half is genuine, unclaimed backlog work (not merely a
stale comment), not accepted debt. Out of scope to fix here: neither file is in this
phase's r2000/audit-closure scope, and `stock-cia.ts`/`stock-dispatch.ts` are Phase 3
family, not the Phase 4 disassembler family this milestone protects -- but leaving the
pointer unstated would itself be the AUDIT-01 defect.

**4. `r2000-cli.test.ts:87-92`'s `writeSingleSectorEntry()` duplicates `writeChain()`'s
used-byte formula (noted while closing WR-12, plan 11.1-06 Task 3).**
Read directly: this duplicate is used only to build `.d64` fixtures for CLI-level
behavioural tests (e.g. `bootstrap`'s malformed-entry path) -- it never independently
verifies the DOS used-byte convention the way `r2000-d64.test.ts`'s round-trip test does.
**Disposition: accepted debt.** WR-12's actual defect (a round-trip *correctness* test
that is a tautology with respect to the convention) does not recur here, because nothing
in `r2000-cli.test.ts` asserts the convention against this fixture writer's own formula --
it only uses the formula to construct realistic-looking `.d64` bytes for unrelated
assertions. The independent literal pin correctly lives in `r2000-d64.test.ts` instead
(11.1-06-SUMMARY.md's own stated reason). No further action needed.

**5. `07-REVIEW.md`'s WR-15 through WR-19 (v0.2.0 Phase 7, all five marked "carryover")
are, on direct source inspection, already fixed -- with no updated paper trail recording it.**
Discovered while dispositioning this ledger's six expected v0.2.0 stragglers. `07-REVIEW.md`
(reviewed 2026-08-18T15:10:00Z) found these five as regressions/non-fixes surviving a prior
review round. Directly re-reading the current source shows all five ARE fixed: `stock-diagnose.ts`
and `stock-recycle.ts` require `parsed > 0` (not `>= 0`) with matching `// WR-15
(07-REVIEW.md)` comments; `load-order.test.ts` carries the "Part 4" value-only cycle guard
(`// Part 4: the STOCK dispatch runtime cycle (07-REVIEW.md WR-16)`); `stock-timing.ts`'s
`resolveVideoStandard()` now rethrows `MachineRestartedError`/`StockConnectionClosedError`/
`StockRequestTimeoutError` with a `// WR-17 (07-REVIEW.md)` comment; `stock-run-until.ts`
refuses `cycles` whenever present (`// WR-18, part 2`); `stock-diagnose.ts` attaches an
abandoned-acquisition observer (WR-19). All five fixes are present in `git log` as
`fix(07): WR-1{5,6,7,8,9} ...` commits (`7e10d45`, `e39a1cb`, `7274287`, `7ee52aa`,
`b8cecf6`), dated after the review that flagged them. **Disposition: superseded/moot --
the code has since changed.** No further fix needed. Recorded here because no todo,
SUMMARY, VERIFICATION.md or milestone audit names these five commits against these five
IDs -- `07-REVIEW-FIX.md` (the phase's own fix-report convention) only covers the review's
*first*-round findings (iteration 1, `findings_in_scope: 20`, none of which include a
second-round "carryover" re-flag), so these five fixes exist in code and in commit
messages but in no disposition document until this line. This is the same AUDIT-01
pattern recurring one phase earlier than the audit's own scope -- closed by silence, not
by absence of a fix.

## Resolution

All twelve enumerated findings (WR-09, WR-10, WR-11, WR-12, IN-01 through IN-07 from
`10-REVIEW.md`, plus IN-02 from `11-REVIEW.md`) now have an explicit disposition: eleven
fixed, one (IN-07) deferred with its home named. Five additional discoveries made while
dispositioning are recorded above rather than left implicit.

**The 21-finding arithmetic, `10-REVIEW.md` (2 Critical / 12 Warning / 7 Info = 21):**

- CR-01, CR-02, WR-01 — fixed at Phase 10 close-out.
- WR-02 through WR-07 — filed as
  `.planning/todos/completed/2026-08-20-r2000-review-residual-findings.md`, closed by
  plans `11-01`/`11-02` (see that todo's own `## Resolution`).
- WR-08 — **checked directly, and NOT fixed.** `r2000-cli.ts`'s `parseArgs()` still has
  `if (a === "--entry") entry = rest[++i];` / `else if (a === "--out") out = rest[++i];`
  with no value validation; live-reproduced on 2026-08-21
  (`node vice-proxy.ts r2000 bootstrap /tmp/wr08test.prg --out` silently wrote
  `wr08test.regen2000proj` instead of refusing the missing value). WR-08 fell through the
  gap between "fixed at close-out" (CR-01/CR-02/WR-01) and the residual-findings todo
  (WR-02..WR-07) — never named in either. This is itself a small AUDIT-01-class miss,
  found while dispositioning the four already-named ones. **Disposition: deferred**, filed
  as `.planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md`
  rather than fixed here — found while writing this ledger, not while executing an
  in-scope code-change task, so per this project's deviation-scope rule it is logged, not
  silently fixed inside an unrelated plan.
- WR-09, WR-10, WR-11, WR-12, IN-01 through IN-07 — this ledger (11 findings).

2 + 6 + 1 + 1 + 11 = **21**. The arithmetic reaches 21 exactly (CR-01, CR-02, WR-01 = 3;
WR-02..WR-07 = 6; WR-08 = 1; this ledger's 11).

**The v0.2.0 straggler count (per plan 11.1-07's own measured expectation, six findings:
`02-REVIEW.md` IN-05, `07-REVIEW.md` WR-15 through WR-19):** verified directly against
current source rather than assumed. Five of the six (`07-REVIEW.md`'s WR-15..19) are
already fixed in code (see "Found while dispositioning" item 5 above) — superseded, not
open. Exactly one (`02-REVIEW.md`'s IN-05) is genuinely still open:

### `02-REVIEW.md` IN-05: `stockReconnect()`'s error message names the wrong function

> "The thrown message begins `'stockConnect: reconnect to target …'` while `where`
> correctly says `stock-connect.ts:stockReconnect`." (`stock-connect.ts:322`)

**Disposition: still open.** Confirmed live in current source (`stock-connect.ts:537`):
the thrown `MachineRestartedError` message still begins `stockConnect: reconnect to
target...`. Never fixed by `02-REVIEW-FIX.md` (which covers only `02-REVIEW.md`'s CR/WR
findings, not its INFO findings), never filed as a todo, never mentioned in
`02-VERIFICATION.md`. A trivial one-line fix (`stockConnect:` -> `stockReconnect:`), but
`stock-connect.ts` is out of this phase's scope (Phase 2 family, not r2000, not the
protected Phase 4 disassembler family) — recorded as accepted debt, a genuine v0.2.0
inheritance, rather than fixed here. Per this phase's explicit instruction: dispositioned,
not exempted, and not silently fixed in a plan whose stated scope is closing the v0.3.0
audit.

**The closing rule:** "no disposition anywhere" was the defect; a finding is either fixed
with a named plan, or filed with a stated reason. Nothing above is closed by silence.
