---
phase: 33-the-reproducible-run-protocol-and-the-capture-substrate-go-d
plan: 10
subsystem: evidence-measurement
tags: [stock-vice, binary-monitor, autostart, capture-pair, transient-allow-list, default-memspace, broker-acquire, gate-input]
status: complete

# Dependency graph
requires:
  - phase: 33-03
    provides: "the settled anchor-counted sequence AUTOSTART_SEQUENCE: S3, the measured AUTOSTART_FRAME_EXACT: not-achieved, the withdrawn cap claim (66 over the cap of 64 at jitter 4000), and the D-11 preflight discipline this plan enforces in code"
  - phase: 33-04
    provides: "vsf-slice.ts and the skill-side vsf-slice.mjs CLI -- the ONE reading of the .vsf C64MEM layout this plan reaches rather than re-authors"
  - phase: 33-05
    provides: "the stock determinism argv (STOCK_DETERMINISM_SEED / STOCK_DETERMINISM_FLAGS) and LaunchProfile, which buildViceArgs() emitted byte-identically to 33-03's measured argv under profile.headless"
  - phase: 33-06
    provides: "the LaunchProfile threaded through the broker control plane, so acquireOverControlPlane(dir, { profile: { headless: true } }) is a real route"
  - phase: 33-07
    provides: "capture-predicate.ts (normalisePorts, compareCaptures, parseAllowList, argvDigest, formatComparison) and stop-oracle.ts (compareStopIdentity, ORACLE_TERMS) -- the predicate and oracle this plan's verdicts come from"
  - phase: 33-08
    provides: "derive-transients.mjs's derive/check verbs, the committed derivation method, the cap-voids semantics, and the three-field reproducibility key"
  - phase: 33-09
    provides: "runReproducible() and the module header that names the anchor-counting loop as an evidence script's job -- which is what this plan's script is"
provides:
  - "C0_CAPTURE_PAIR: pass -- GATE-01's one corpus-dependent input, recorded as a VALUE in evidence/33-capture-pair.md"
  - "CAPTURE_FRAME_EXACT: no, with the differing terms (line, cycle) named, recorded beside the pass so the pass cannot be read as frame-exactness"
  - "TRANSIENT_COUNT: 49 against the committed cap of 64 -- the FIRST time D-22's cap met a real frame-anchored stop on a real cracked release; the cap decided WRITE and DERIVATION: void is absent"
  - "src/skills/c64-ram-capture/transients/danish.json -- the first committed per-release allow-list, 49 ascending entries, 48 attributions filled and 1 deliberately blank"
  - "MEMSPACE_ASSERTION: refuses -- the main-CPU memspace assertion observed passing clean and refusing after one deliberate drive-memspace checkpoint hit"
  - "evidence/capture-pair.mjs -- the named repeatable script with verbs run / compare / memspace / preflight, driving only shipped seams"
  - "MEASURED: a broker grant is NOT a bound monitor -- acquire returns in ~25-40 ms, before x64sc binds the binmon socket; readiness is dial-retry then PING"
  - "MEASURED: on stock 3.9 a memspace-less ADVANCE_INSTRUCTIONS still steps the MAIN CPU after one drive checkpoint hit, contradicting P10's first symptom; the @bank: condition symptom is the one that discriminates (err=0x00 -> 0x8f)"
affects: [33-11, 33-12, c64-ram-capture skill, any future autostart-capture plan, GATE-01's verdict]

# Actuals (#2632) — same estimateTokens scale as the plan's estimate (chars/4 over the realized diff).
actuals:
  tokens: 37337
  tasks: 3
  commits: 3

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "evidence script drives shipped seams by IMPORT and SPAWN, never by re-authoring: the argv comes from a real broker acquire and is transcribed from the broker's own stderr, so a rebuilt argv cannot digest to something the emulator never received"
    - "task-scoped broker child with its own state dir under PROBE_DIR and warm floor 0 -- the acquire path is exercised without a systemd unit and without a second competing emulator"
    - "the clean control runs FIRST and is load-bearing: it caught a defect in the assertion it was controlling for, on its first use"
    - "sub-check results are recorded separately from the conjunction they feed, with the verdict under the narrower definition stated explicitly, so a reader can re-derive rather than trust"

key-files:
  created:
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/capture-pair.mjs
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-capture-pair.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-transient-derivation.md
    - .planning/phases/33-the-reproducible-run-protocol-and-the-capture-substrate-go-d/evidence/33-memspace-refusal.md
    - src/skills/c64-ram-capture/transients/danish.json
  modified: []

key-decisions:
  - "The hit target is 400 and was fixed BEFORE the first run: it is the target 33-03's own reported pair used and the furthest into the release's load any measurement in this phase reaches. The tempting alternative -- a target at or under 50, where 33-03 measured 0 differing bytes -- was rejected on the record, because the load has not started by hit 50 and such a pair would compare equivalent while containing none of the release's code."
  - "The third derivation run's jitter is 4000 ms because it is the third rung of SCHEMA.md 2.2's PRE-COMMITTED 0/1500/4000 ladder, frozen before any measurement existed. The 1200 ms that 33-03 measured as agreeing with jitter 0 was available and was DECLINED on the record: picking it would have been picking the run that keeps the derivation under the cap."
  - "runReproducible() is NOT on this route and cannot be: it issues a hard RESET from inside the procedure (which undoes AUTOSTART, 33-03's P11) and sends exactly one resume per wait (which cannot count 400 anchor hits). Recorded as an ACCEPTED LIMIT; 33-09's own header names the counting loop as an evidence script's job, and this script is it."
  - "snapshotPathFor() was NOT used: it targets <repoRoot>/.vice-snapshots/, inside the checkout. Gitignored is not the same as never-entered, and D-27 / T-33-06 are about bytes not entering the checkout. Every .vsf and .bin went to PROBE_DIR instead, recorded as an ACCEPTED LIMIT."
  - "The main-CPU memspace assertion is the CONJUNCTION of both symptoms P10 names (memspace-less stepping reaches the main CPU AND a @bank: condition is accepted), with both sub-results always recorded separately. Measured: only the @bank: check discriminates on stock 3.9. The file states plainly that under a stepping-only definition the value would be did-not-refuse."
  - "The images fed to BOTH the derivation and the comparison are the port-normalised ones, so the two cannot disagree about what they compared. dirRead=47 / dataRead=55 on all three snapshots, so normalisation moved no number -- it is applied for the rule, not for the result."
  - "C0_CAPTURE_PAIR: pass is recorded with an ACCEPTED LIMIT stating that the allow-list was derived from three runs two of which ARE the reported pair, so the equivalence follows from the union fitting under the cap and ALL discriminating power sits in the cap. A planted one-bit flip at $C000 confirms the 49-entry list is not vacuous."

patterns-established:
  - "Pattern 1: an evidence script's outcome line is DERIVED IN CODE from the frozen schema's rule (SCHEMA.md 2.5 applied by comparePair()), so the value is produced by a rule rather than chosen after seeing the numbers"
  - "Pattern 2: the argv is transcribed from the launching process's own stderr rather than rebuilt, so the argv digest identifies what execve received and not what the script believes"
  - "Pattern 3: every disclosed near-miss carries its number rather than an adverb -- 49 against 64, 48 of 49 from one pairing, 66 measured on the other launch route -- so 'close' is never the reader's only information"

requirements-completed: [CAP-04, CAP-02]

coverage:
  - id: D1
    description: "One real cracked release (danish.d64, sha256-asserted) autostarted with true drive emulation in the loop, captured twice through the shipped route -- broker acquire with profile.headless, 33-03's S3 anchor-counted stop, snapshot, the shipped vsf-slice CLI -- and the pair compared under CAP-02's committed predicate"
    requirement: "CAP-04"
    verification:
      - kind: other
        ref: "node evidence/capture-pair.mjs run --label pair-j0 --jitter 0 --target 400 (and --label pair-j2500 --jitter 2500); transcripts in evidence/33-capture-pair.md"
        status: pass
      - kind: other
        ref: "node evidence/capture-pair.mjs compare --a pair-j0 --b pair-j2500 --allow-list src/skills/c64-ram-capture/transients/danish.json -> verdict=equivalent differing=0 allowed=28"
        status: pass
      - kind: other
        ref: "grep -Eq '^C0_CAPTURE_PAIR: (pass|fail|not-obtained)$' evidence/33-capture-pair.md && grep -Eq '^CAPTURE_FRAME_EXACT: (yes|no)$' -> CAPTURE_PAIR_RECORDED"
        status: pass
    human_judgment: false
  - id: D2
    description: "The pair recorded is the pair TAKEN, in the order taken, with every voided run written in with its reason and the release identified by sha256 over its exact bytes"
    requirement: "CAP-04"
    verification:
      - kind: other
        ref: "evidence/33-capture-pair.md § Every run taken, in the order taken -- 4 run invocations, all 4 tabled, VOIDED RUN V1 recorded with its ECONNREFUSED reason; the digest grep in the plan's verify would red on a name-only identification"
        status: pass
    human_judgment: true
    rationale: "That no run was silently dropped is a property of the record's completeness, not something a command can assert. The verify greps prove the outcome lines and the digest exist; only a reader can confirm the enumeration is exhaustive."
  - id: D3
    description: "The transient allow-list derived on the real release by the committed method over N=3 real captures, with the cap of 64 deciding the outcome and the cap itself unedited"
    requirement: "CAP-02"
    verification:
      - kind: other
        ref: "node src/skills/c64-ram-capture/scripts/derive-transients.mjs derive --release danish --out .../danish.json (3 images) -> TRANSIENT_COUNT: 49, cap 64, EXIT_STATUS=0"
        status: pass
      - kind: other
        ref: "node -e '<ascending + <=64 assertion over danish.json>' -> ARTIFACT_OK 49"
        status: pass
      - kind: other
        ref: "node -e '<parseAllowList over danish.json>' -> PARSED release=danish entries=49 addresses=49"
        status: pass
      - kind: other
        ref: "cd src/mcp/vice && grep -v '^ ' capture-predicate.ts | grep -c 'TRANSIENT_ALLOW_LIST_CAP = 64' -> 1"
        status: pass
      - kind: other
        ref: "node src/skills/c64-ram-capture/scripts/derive-transients.mjs check --allow-list .../danish.json (the pair) -> CHECK_VERDICT: equivalent, EXIT_STATUS=0"
        status: pass
    human_judgment: false
  - id: D4
    description: "The derived allow-list is proven non-vacuous: a one-bit flip at an address outside it still fails the comparison"
    requirement: "CAP-02"
    verification:
      - kind: other
        ref: "node -e '<compareCaptures with one bit planted at $C000>' -> PLANTED_COMPARE verdict=not-equivalent differing=1, PLANTED_DIFFERING $C000"
        status: pass
    human_judgment: false
  - id: D5
    description: "The main-CPU memspace assertion is observed PASSING on a clean machine and REFUSING after exactly one deliberate drive-memspace checkpoint hit, with the CHECKPOINT_INFO frame recorded verbatim"
    requirement: "CAP-04"
    verification:
      - kind: other
        ref: "node evidence/capture-pair.mjs memspace --label memspace-v2 --target 60 -> CLEAN ASSERTION PASS, CONTAMINATED ASSERTION REFUSES, DERIVED_MEMSPACE_ASSERTION refuses"
        status: pass
      - kind: other
        ref: "grep -Eq '^MEMSPACE_ASSERTION: (refuses|did-not-refuse)$' evidence/33-memspace-refusal.md && grep -q '0x01' && test $(grep -c '^\\$ ') -ge 3 -> MEMSPACE_RECORDED"
        status: pass
    human_judgment: false
  - id: D6
    description: "No corpus byte, capture image or snapshot entered the checkout -- only digests and derived JSON travel into git"
    requirement: "CAP-04"
    verification:
      - kind: other
        ref: "git status --porcelain | grep -E '\\.(d64|vsf|bin|prg|t64|tap|crt)$' | wc -l -> 0 (NO_BINARY_IN_CHECKOUT)"
        status: pass
    human_judgment: false

duration: 33 min
completed: 2026-09-02
---

# Phase 33 Plan 10: One Real Release, Captured Twice, and the Cap's First Real Test — Summary

`GATE-01`'s one corpus-dependent input is now a value: `C0_CAPTURE_PAIR: pass`, taken on
`danish.d64` autostarted with a live 1541, captured twice through the broker's own acquire
path and compared under `CAP-02`'s predicate against a 49-entry allow-list that `D-22`'s cap
of 64 admitted — recorded beside `CAPTURE_FRAME_EXACT: no` and an accepted limit spelling
out that the `pass` rests entirely on the cap.

**Duration:** 33 min (2026-09-02 22:10Z – 22:43Z) · **Tasks:** 3 · **Commits:** 3 (+1 docs) ·
**Files created:** 5

---

## Accomplishments

**1. `C0_CAPTURE_PAIR: pass` — the input Phase 23 recorded `could-not-run`.**
Three usable captures of `danish.d64` at pre-protocol jitter 0 / 2500 / 4000, all at anchor
hit 400 of `$EA31`, all with `Drive8TrueEmulation=1` and `Drive8Type=1541` read back over
`RESOURCE_GET` inside each run rather than assumed from the argv. The reported pair (runs 1
and 2) compares **equivalent**, `differing=0`, with its 28 differences all enumerated
transients.

**2. The route driven is the shipped one, and the argv proves it.** `acquireOverControlPlane`
with `profile: { headless: true }` produced an argv byte-identical to `33-03`'s measured
list plus the broker's own `-remotemonitor` pair — and it is **transcribed from the broker's
`launching …` stderr line**, never rebuilt in the script, so `argvDigest()` identifies what
`execve` received. The wire is `stock-protocol.ts`'s `ViceMonitorClient` and encoders (every
`memspace: 0x00` through `memspaceByte()`); the flat 64K comes through the **shipped
`vsf-slice` CLI** with not one snapshot offset in the evidence script; the verdicts come from
`capture-predicate.ts` and `stop-oracle.ts`.

**3. `TRANSIENT_COUNT: 49` — `D-22`'s cap met a real frame-anchored stop for the first time,
and decided WRITE.** All three pairwise comparisons run (28 / 48 / 26), union 49 against a
cap of 64. `src/skills/c64-ram-capture/transients/danish.json` is the first committed
per-release allow-list: 49 ascending entries, round-tripping through `parseAllowList()` and
the `check` verb, with 48 attributions filled from a published memory-map fact or a
measurement recorded in this phase and `$00A4` **left deliberately blank** rather than
guessed.

**4. `MEMSPACE_ASSERTION: refuses`, with its own discriminating power disclosed.** Clean
control passes, one drive-memspace checkpoint hit (wire byte `0x01`, the 1541 DOS ROM range,
`hit_count=1`, frame recorded verbatim), the same assertion refuses. And the sub-check
breakdown is on the page: the `@bank:`-condition check discriminated (`err=0x00` → `0x8f`,
twice on each side), the `ADVANCE_INSTRUCTIONS` stepping check did **not** — the main `PC`
moved on both sides — so under a stepping-only definition the value would have been
`did-not-refuse`, and the file says so.

**5. Two accepted limits recorded rather than worked around.** `runReproducible()` cannot
serve an autostarted release (hard `RESET` inside the procedure; one resume per wait), and
`snapshotPathFor()` targets a path inside the checkout. Both are the plan's own instructions
declined for a stated reason, in this plan's own files, with the three frozen files untouched.

---

## The outcome lines, and where they live

| Line | Value | Declared source file |
|---|---|---|
| `C0_CAPTURE_PAIR` | **`pass`** | `evidence/33-capture-pair.md` |
| `CAPTURE_FRAME_EXACT` | `no` (differing terms `line`, `cycle` named) | `evidence/33-capture-pair.md` |
| `TRANSIENT_COUNT` | `49` (cap 64) | `evidence/33-transient-derivation.md` |
| `DERIVATION` | **absent** — written only on the overflow branch, which was not taken | `evidence/33-transient-derivation.md` |
| `MEMSPACE_ASSERTION` | `refuses` | `evidence/33-memspace-refusal.md` |
| `BROKER_STATE` | `inactive` (all three files) | every file carrying a live run |
| `TEST_AUTOMATED_BASELINE` | 2 failing tests in 1 file (`anno-register.test.ts` :385, :479); tests 3113 / pass 3105 / fail 2 | every file carrying a live run |

`DECISION-RULE.md`'s `R4` and `R5` are therefore **not** reached by this input. `R4` needs
`C0_CAPTURE_PAIR: fail` and `R5` needs `not-obtained`; the value is `pass`, so `GATE-01`'s
verdict now turns on the four corpus-free inputs (`33-11`'s three plus `33-07`'s recorded
`SLICER: validated`). That is stated as a fact about the rule set, not as a prediction of the
verdict — `33-12` walks the rules.

## How to read the `pass` (this is the part that matters)

`C0_CAPTURE_PAIR: pass` and `CAPTURE_FRAME_EXACT: no` sit on the same page, from the same
runs, and they are not a contradiction — `SCHEMA.md` § 3 is explicit that
`CAPTURE_FRAME_EXACT` is the *cause* a `fail` narrowing is authored against, **not a second
gate**. But the pair is easy to misread, so the reading is written down in
`33-capture-pair.md` § *ACCEPTED LIMIT — read this `pass` for exactly what it can support*
and repeated here:

- The allow-list was derived from **three runs, two of which are the reported pair**, so the
  pair's 28 differing addresses are inside the 49-entry list **by construction**. The
  `equivalent` verdict was determined the moment the derivation wrote an artifact at all.
  This follows from the committed method (`D-23`, frozen), not from a choice made here.
- So the **entire discriminating power sits in the cap**, exactly as `transients/README.md`
  says: the cap "separates a frame-exact stop from a stop that is not". `pass` says this
  stop's run-to-run variation fits inside 64 enumerated addresses. It does **not** say the
  stop is frame-exact; `CAPTURE_FRAME_EXACT: no` says the opposite.
- The list is **not vacuous**, and that was checked: a one-bit flip planted at `$C000` fails
  the same comparison. 49 addresses of 65536 may differ; a single bit in the other 65487
  fails, at any bit count.
- **How close it came:** 48 of the 49 union addresses come from one pairing (jitter 0 against
  4000), and `33-03` measured **66** — over the cap — for the nominally corresponding
  comparison on a directly launched instance. Different launch routes, different argv
  digests, not two samples of one quantity; but both agree on the direction, that a
  frame-anchored post-load stop on this release **straddles** the cap. A future run of this
  script may well void.

## Deviations from Plan

### Auto-fixed issues

**1. [Rule 1 - Bug] The stop-identity record used the wrong field names for `ORACLE_TERMS`**
- **Found during:** Task 1, at the first `compare` invocation
- **Issue:** `takeRun()` wrote the frame term as `lin`/`cyc`; `stop-oracle.ts`'s
  `ORACLE_TERMS` are `pc, hitCount, line, cycle`. `compareStopIdentity()` threw
  `StopOracleError: term "line" is absent or not a finite integer on side a`.
- **Fix:** `takeRun()` now writes the oracle's own names, and a named `toStopIdentity()`
  maps **key names only** for the two records already on disk — no recorded value altered,
  defaulted or inferred, and a record carrying neither spelling is left absent so the oracle
  refuses it by name. The two captures were kept rather than re-taken: nothing about them
  changed.
- **Note:** the oracle refusing a partial record by name rather than comparing three of four
  terms is exactly the behaviour `33-07` built it for, observed here by accident. Recorded in
  `33-capture-pair.md` § *Voided runs* as "not a voided run", so the run count stays honest.
- **Commit:** `2b40040`

**2. [Rule 1 - Bug] A single-shot `connect()` after a broker acquire, which is a race**
- **Found during:** Task 1, first `run` invocation (**VOIDED RUN V1**)
- **Issue:** `acquireOverControlPlane` returns in ~25-40 ms, before `x64sc` has bound the
  binary-monitor socket. The bare `client.connect()` failed with
  `ECONNREFUSED 127.0.0.1:6600`; no anchor armed, no `AUTOSTART`, no snapshot.
- **Fix:** `connectWithRetry()` dials until the listener accepts within a recorded budget, and
  every run reports `CONNECTED_AFTER_MS` so the dial interval is visible **as part of** the
  pre-protocol interval rather than hidden inside it. The measured lesson — **a broker grant
  is not a bound monitor** — is recorded in the script's own comment and in the evidence file.
- **Commit:** `2b40040`

**3. [Rule 1 - Bug] The memspace assertion could never pass on a true-drive-emulation machine**
- **Found during:** Task 3, by the **clean control**, on its first use (**VOIDED RUN M1**)
- **Issue:** the assertion required the main `PC` to move **and** the drive `PC` not to. With
  `Drive8TrueEmulation=1` the drive CPU runs concurrently, so advancing the main CPU advances
  emulated time and the drive `PC` moves too (observed clean: `main $ea31 → $ffea`,
  `drive $d125 → $d127`). It was an assertion that always refuses, and would have produced a
  `refuses` verdict in step 3 for entirely the wrong reason.
- **Fix:** check (a) now passes on `mainMoved` alone; the drive `PC` is recorded as evidence,
  not as a pass condition, with the measured reason in the function header so the clause
  cannot be reintroduced. Run M1 was **discarded, not repaired** — its step-3 refusal is
  quoted nowhere as evidence — and the whole observation was re-taken on a fresh launch.
- **Commit:** `2466806`

### Plan instructions declined, with reasons (ACCEPTED LIMITs)

**4. [Rule 4-adjacent — recorded, not asked] `runReproducible()` is not on the capture route**
The plan asks for the stop to be reached "through `vice_run_until` with `reproducible: true`".
It cannot be: that procedure issues a monitor-issued **hard `RESET`** from inside itself, and
`AUTOSTART` **is** the power cycle (`autostart.c:1437`) so a `RESET` undoes the autostart
(`33-03`'s `P11`, measured); and it sends **exactly one** resume per wait, refusing an
early anchor hit rather than resuming past it, so it cannot count 400 hits. `33-09`'s own
module header names the anchor-counting loop as "an evidence script's job … not a published
tool surface", so `capture-pair.mjs` is precisely the script that header points at. No user
decision was sought because the plan's own dependency (`33-09`) already recorded the answer;
the limit is recorded in `33-capture-pair.md` in this plan's own file, per `SCHEMA.md`'s
direction, and the frozen files were not edited.

**5. `snapshotPathFor()` is not used for the snapshot path**
It returns `<repoRoot>/.vice-snapshots/<name>.vsf` — inside the checkout. `/.vice-snapshots/`
is gitignored, so the plan's own `git status` verify would not have seen the file; but `D-27`
and `T-33-06` are about bytes **not entering the checkout at all**. Snapshots went to
`PROBE_DIR` instead. Recorded as an accepted limit rather than silently applied.

**Total deviations:** 3 auto-fixed bugs (all Rule 1, all in this plan's own evidence script,
all caught by a control or a shipped refusal rather than by inspection) and 2 plan
instructions declined with recorded reasons. **Impact:** no shipped source file was modified
by this plan; the three bugs were in the measurement apparatus and two of the three were
caught by machinery this phase built for exactly that purpose.

## Authentication Gates

None.

## Verification

| Plan verification item | Result |
|---|---|
| 1. `node --check` on `capture-pair.mjs`; reaches the flat 64K through the shipped slicer | PASS — `grep -v '^//' … | grep -c 'vsf-slice'` = 4 |
| 2. `33-capture-pair.md` outcome lines at column 0, in domain, digest present, ≥4 `$ ` transcripts, broker narrative | PASS — `CAPTURE_PAIR_RECORDED`; 13 `$ ` transcripts |
| 3. no `.d64` / `.vsf` / `.bin` / `.prg` / `.t64` / `.tap` / `.crt` in `git status --porcelain` | PASS — `NO_BINARY_IN_CHECKOUT`, count 0 |
| 4. `33-transient-derivation.md` carries `TRANSIENT_COUNT:` and the reference points 0 / 300 / 1242; artifact ≤64 and ascending | PASS — `DERIVATION_RECORDED`; `ARTIFACT_OK 49` |
| 5. `TRANSIENT_ALLOW_LIST_CAP = 64` still present in `capture-predicate.ts` | PASS — count 1 |
| 6. `33-memspace-refusal.md` carries `MEMSPACE_ASSERTION:` at column 0, the clean control before the contamination, `0x01`, ≥3 transcripts | PASS — `MEMSPACE_RECORDED`; 4 `$ ` transcripts |
| 7. **Wave gate** — `npm run test:automated` at no more than 2 failures, all in `anno-register.test.ts` | PASS — tests 3113 / pass 3105 / **fail 2**, both in `anno-register.test.ts` (`:385`, `:479`). No second file name appeared. |

Additional checks run beyond the plan's list:

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | clean, no output |
| `node scripts/check-npm-packages.mjs` | `OK` — `@henols/vice-mcp` 83 files, `@henols/c64-re-tools` 38 files / 7 skills; exit 0 |
| `node installer/scripts/sync-skills.mjs` after adding a skill file | already in sync, nothing written |
| the three frozen files each still have exactly **one** commit (`2a8ef95`) | PASS — `DECISION-RULE.md`, `SCHEMA.md`, `README.md` all 1 commit |
| `git diff --diff-filter=D` over this plan's commits | no deletions |
| `systemctl --user is-active vice-broker` / `pgrep -x x64sc` before the suite | `inactive` / no output |

## Known Stubs

None. Every artifact this plan promised exists with measured content, and the one field left
empty — `$00A4`'s `attribution` in `danish.json` — is empty **by rule** (an unattributed
transient must be visibly unattributed rather than guessed), not as a placeholder awaiting
work.

## Issues Encountered

**One measured contradiction with `33-RESEARCH.md`'s pitfall `P10`, recorded as a finding
rather than smoothed over.** `P10` predicts that after `default_memspace` contamination a
memspace-less `ADVANCE_INSTRUCTIONS` steps the **drive** CPU. Measured on stock 3.9 after
exactly one drive-memspace checkpoint hit, it still moved the **main** CPU's `PC`
(`$ee85 → $eea9`). Either this build's stepping path does not read `default_memspace`, or one
drive checkpoint hit is not sufficient to retarget it — this measurement does not distinguish
those two and does not claim to. `33-memspace-refusal.md` § *What each sub-check actually did*
carries it in full, including that a stepping-only definition would have recorded
`did-not-refuse`. `EXECUTE_UNTIL_RETURN`, `P10`'s third command, was deliberately **not**
exercised (it would run the machine to a return and destroy the attributable before/after
state) and is recorded as not exercised.

Nothing here blocks a downstream plan: `stock-reproducible-run.ts` sends none of the three
affected commands and is immune by construction, which this measurement **supports** — the
`@bank:` refusal after contamination is exactly the failure its *WHAT NOT TO DO* list forbids
reintroducing.

## Next Phase Readiness

`33-11` is unblocked and unaffected by anything here: its three inputs (`SEED_EFFECT`,
`JITTER_IMMUNITY`, `ORACLE_NECESSITY`) are corpus-free and measured with their own probes.
Two things from this plan are worth its while:

- **A broker grant is not a bound monitor.** If `33-11`'s probes go anywhere near the acquire
  path, dial with a retry and treat `PING` as the readiness signal.
- **`ORACLE_NECESSITY` still needs a `(line, cycle)`-agreeing pair one frame apart**, and
  `33-03` measured that it is not producible at `$EA31` on this release (`LIN` moves by −52
  lines per anchor hit). Nothing in this plan changes that; the observation is still owed.

`33-12` can now transcribe four of the five gate inputs' declared sources; the fifth
(`C0_CAPTURE_PAIR: pass` at column 0 of `evidence/33-capture-pair.md`) is in place, and
`R4`/`R5` are both unreached.

**Phase status:** plans `33-11` and `33-12` remain. `33-10` complete.

## Self-Check: PASSED

Every claim above re-checked against disk and git before this file was committed.

**Files claimed created — all present:**

```
$ for f in evidence/capture-pair.mjs evidence/33-capture-pair.md evidence/33-transient-derivation.md evidence/33-memspace-refusal.md src/skills/c64-ram-capture/transients/danish.json; do [ -f "$f" ] && echo "FOUND: $f" || echo "MISSING: $f"; done
FOUND: .../evidence/capture-pair.mjs
FOUND: .../evidence/33-capture-pair.md
FOUND: .../evidence/33-transient-derivation.md
FOUND: .../evidence/33-memspace-refusal.md
FOUND: src/skills/c64-ram-capture/transients/danish.json
```

**Commits claimed — all reachable:**

```
$ for h in 2b40040 8235df5 2466806; do git log --oneline --all | grep -q "$h" && echo "FOUND: $h" || echo "MISSING: $h"; done
FOUND: 2b40040
FOUND: 8235df5
FOUND: 2466806
```

**Outcome lines re-greped at column 0 after the last edit to each file:** `C0_CAPTURE_PAIR: pass`,
`CAPTURE_FRAME_EXACT: no`, `TRANSIENT_COUNT: 49`, `MEMSPACE_ASSERTION: refuses`, `DERIVATION:` absent.

**Frozen files unmodified:** `DECISION-RULE.md`, `SCHEMA.md` and `README.md` each still carry
exactly one commit, `2a8ef95`.

**No deletions:** `git diff --diff-filter=D --name-only 543522c..HEAD` is empty.
