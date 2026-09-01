---
phase: "32"
slug: "the-deletion-and-the-grep-gate"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-01"
---

# Phase 32 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Input state:** B (created from artifacts — no prior SECURITY.md).
**Register origin:** `register_authored_at_plan_time: true` — all 21 plans carry a
`<threat_model>` block, so the auditor verified mitigations rather than building a
retroactive STRIDE register.
**Configured thresholds:** `asvs_level: 1`, `security_block_on: high`.

**ID COLLISION WARNING.** Threat ids are unique only per plan, not per phase. Plans
32-01…32-09 number `T-32-01`…`T-32-43` monotonically; the gap-closure plans 32-10…32-21
RESTART numbering at `T-32-01`. Every row below is therefore keyed **(plan, threat_id)**.
`32-10 T-32-02` is a different threat from `32-01 T-32-02`. Do not de-duplicate by id.

---

## Trust Boundaries

Union of the boundaries declared across the 21 plan threat models.

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| registry JSON → harness | Row-supplied plant descriptors (`file`, `find`, `replace`) cross into filesystem writes and subprocess argv construction | Committed repo data; no secrets |
| registry guard descriptors → subprocess argv | Row-supplied `argv`/`cwd` decide what is executed | Committed repo data |
| `--root <dir>` CLI argument → guard/harness filesystem access | An operator-supplied path decides which tree is read and, for the table generator, written | Local filesystem paths |
| git object-store content → guard logic | Text read from `git show` at two pinned commits crosses into the audited-set derivation | Committed repo history |
| edited planning documents → guards that read them | `.planning/PROJECT.md` / `ROADMAP.md` prose decides CI-relevant pass/fail | Project documentation |
| harness process lifetime → the tree the close gate later measures | An interrupted run could leave planted bytes on disk | Working-tree bytes |
| guard exit status → the audit's central claim | Status 1 can mean a failing assertion OR a killed timeout | Process exit codes |
| host broker/emulator state → gate results | An external process the phase does not own could decide whether a red is real | Read-only process state |
| tracked file bytes → published census counts | File content, including NUL-tainted content, crosses into published figures | Repo source bytes |

No boundary in this phase carries credentials, PII, or network-reachable input. The
instruments are local, hand-run, single-tenant developer tooling.

---

## Threat Register

119 rows parsed from 21 `<threat_model>` blocks: **87 mitigate, 20 accept, 12 not-applicable**.
By severity: 64 high, 39 medium, 4 low, 12 unscored (the not-applicable supply-chain rows).

**Summary: 112 CLOSED / 7 open-below-threshold / 0 open at or above `high`.**

Full per-row evidence — the file:line citation behind every CLOSED verdict — is in the
security audit verdict recorded in this phase's session and traceable to the sources it
cites. Rather than re-transcribing 119 rows, this register records the verdict per group,
with the individually notable rows called out in full.

### `mitigate` rows — 87 of 87 CLOSED

| Group | Plans | Rows | Status | Representative evidence |
|-------|-------|------|--------|-------------------------|
| Subprocess/argv safety | 32-01, 32-06, 32-16, 32-17 | 6 | closed | `audit-mutation-harness.mjs:569` spawnSync(argv array), `:255` execFileSync(array); `shell:` set 0×, `execSync` 0× across the three instruments; `:548-557` every argv element type-checked |
| `--root` containment | 32-01, 32-02, 32-10, 32-11, 32-12, 32-17 | 11 | closed | `scripts/lib/audit-root.mjs:52` segment-boundary containment (`candidate === base \|\| candidate.startsWith(base + sep)`), called at harness `:382`, `:560`, `:1035`, `:1171`; refusal precedes `paths()` so a refused root writes nothing |
| Working-tree capture/restore | 32-01, 32-06, 32-07, 32-19, 32-20, 32-21 | 13 | closed | bytes captured pre-write `:395`/`:507`; `restoreAll()` `:171-184`; handlers `exit`/`SIGINT`/`SIGTERM`/`uncaughtException` `:235-248`; `originals.clear()` at `:183` is the SOLE idempotency mechanism (CR-10 latch deleted); porcelain compared to a process-start baseline |
| Red/green evidence integrity | 32-01, 32-06, 32-07, 32-14, 32-15, 32-21 | 12 | closed | `check-guard-fates.mjs:531` `isNonZeroInteger`, `:740` rejects zero/absent/non-integer `exitStatus`, `:756` requires `control.exitStatus === 0`; green unplanted control gate `:761-775`; throwing post-condition `:488-505` before the write `:508` |
| Nested-runner DoS / timeouts | 32-01, 32-06, 32-15, 32-18, 32-19 | 8 | closed | `NODE_TEST_` stripped from child env `:563-567`; `timeout: 15000` + `killSignal: "SIGKILL"` `:573-574`; fail-closed ETIMEDOUT→status 1 `:578-600`; signal branch `:619-632` routes to UNMEASURABLE, kept separate from the timeout branch |
| Guard non-vacuity / floors | 32-04, 32-08, 32-13 | 8 | closed | `docs-linerefs.test.ts:185-196` floor asserted PER DOCUMENT inside the loop ("never a sum"); `:151` predicate requires BOTH `rewriteArguments()` and a `CITATION_RE` match; hatch-vocabulary grep = 0 across the three instruments |
| Audited-set derivation | 32-08, 32-13 | 5 | closed | `resolveSetC()` `:430-454` requires exactly `SET_C_FLOOR` tokens each resolving to exactly 1 tracked path, else throws — never a hand-typed array; `git cat-file -t` fail-closed `:195-201`; `ci.yml:38` `fetch-depth: 0` |
| Record integrity (no silent rewrite) | 32-03, 32-05, 32-13, 32-14, 32-16, 32-20 | 12 | closed | git `--numstat` proofs: `27b695d` 323/**0**, `b08bdbc` 2/**0**, `205dc3c` 70/**0** — pure insertions; `c81d2ee` on `check-no-analyser.mjs` has zero non-comment `+/-` lines |
| NUL-taint / byte-mode handling | 32-05, 32-06, 32-18 | 4 | closed | `grep -a` used 37× in the sweep, 15× in the reconciliation doc, zero un-`-a` measurements; byte-mode capture `readFileSync(abs)` no encoding `:395`, latin1 round-trip, `Buffer.from(…,"latin1")` `:508`; NUL ledger names `anno-memmap-render.ts` offset 15097 / line 315 |
| Broker read-only (D-13) | 32-06, 32-07, 32-09 | 3 | closed | zero `systemctl stop/restart`, `pkill`, `kill -9`, `killall` anywhere in `scripts/`; broker read at both ends of the close gate, both `inactive`; the `pgrep` false-positive trap itself documented |
| Removal-gate pin stability | 32-03, 32-05, 32-07, 32-09 | 5 | closed | `grep -ac 'the external analyser' .github/workflows/ci.yml` = **1** (line 209, pre-existing; the new step at `:258` carries no literal); `check-no-analyser.mjs` re-run **exit 0** |
| Fixture/temp-dir hygiene | 32-10, 32-11, 32-19 | 4 | closed | every `mkdtempSync(tmpdir())` removed in a `finally`; scratch dirs gitignored (`.gitignore:55`, `:66`) and killed in `t.after`; no `.audit-root-synth-*` survives a run |
| Split-read consistency | 32-02, 32-12 | 3 | closed | `claudeMd` moved inside `paths()` (`check-skill-description-overlap.mjs:101`, read via `P.claudeMd` `:305`); `splitReadRefusalReason()` `audit-root.mjs:382` consumed by four gates |
| Write-freedom / export surface | 32-18, 32-19 | 4 | closed | `uncontained-read-only` `:504` paired with an fs-import allow-list and a zero-writes check over comment-stripped source; exactly 3 harness exports, `:192-194` returns `originals.size` never the map |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `security_block_on` count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

### Notable individual verdicts

**`32-21 T-32-46` (Spoofing, high) — CLOSED, with a durability caveat.**
Code-review finding `WR-38` reports that `audit-harness-restore.test.ts:1209-1215` — the
assertion labelled *"the one that must never change"* — still passes with containment
removed. The auditor reproduced the reasoning and confirms it, but narrower than it reads:
the driver's escape target `../plant-contract-escape-target.txt`
(`plant-contract-driver.mjs:132`) does not exist at the repo root, so a containment-stripped
`plant()` throws at the `existsSync` check and `planted` is still `false`. The **next**
assertion, `assert.match(msg, /OUTSIDE the repository root/)` at `:1217-1222`, **does**
discriminate. So the case as a unit still bites; only the individually-labelled assertion is
non-discriminating. The threat stays CLOSED — the containment call is present and
load-bearing at `audit-mutation-harness.mjs:382` and the pin fails on bypass — but the
*label* is a real instrument defect, tracked OPEN as `WR-38` (see Deferred, below).

**All 21 `T-32-SC` supply-chain rows — CLOSED.** Basis independently re-measured: no phase-32
plan touched a manifest or lockfile. The only manifest commit in the window, `42f83bc`,
changes just `engines.node` (`>=22.18.0` → `>=24.0.0`) and its lockfile mirror — zero
dependency names. The runtime surface is exactly `@mastra/mcp` 1.15.0 + `@mastra/core` 1.55.0,
dev `@types/node` + `typescript`. No package-legitimacy audit was owed by any plan.

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| AR-32-01 | `32-10`/`32-11`/`32-12` `T-32-02` (×3, medium) | **WR-04 — lexical containment vs. an in-repo outward symlink.** `resolveContainedRoot()` compares resolved paths lexically; a symlink *inside* the repository pointing outward defeats it. `audit-root.mjs:31-34` records the reason it is not fixed: `realpathSync` would throw on a not-yet-created directory that several callers legitimately pass. Exploitation requires an attacker-planted symlink already inside the repo, at which point the tree is compromised anyway. Below the `high` block threshold. **Stays OPEN in the findings todo — not upgraded, not closed.** | Henrik Olsson | 2026-09-01 |
| AR-32-02 | `32-10`/`32-14`/`32-15` `T-32-03` (×3, medium) | **WR-12 — `evidenceMarkdown()` fence injection.** Guard stdout is interpolated into inline code and fenced blocks without escaping, so output containing a fence could forge evidence structure. The only writer is a local hand-run developer instrument, the only input is this repository's own test output, there is no network and no multi-tenant surface. Below the `high` block threshold. **Stays OPEN in the findings todo.** | Henrik Olsson | 2026-09-01 |
| AR-32-03 | `32-12` `T-32-08` (medium) | **WR-06 — `redOwed()` looseness.** Basis re-measured at HEAD: 35/35 re-pointed rows are command-paired (control command == planted command), 35/35 carry distinct excerpts, 35/35 carry a plant. Honest today; the predicate itself is unchanged, so the property is measured rather than enforced. Below the `high` block threshold. **Stays OPEN in the findings todo.** | Henrik Olsson | 2026-09-01 |

Six further rows the plans had dispositioned `accept` were verified CLOSED rather than
carried, because the auditor re-measured their basis and found the risk absent:
`32-03 T-32-13` (secret-shaped grep over every 32-03 commit addition: zero hits),
`32-08 T-32-37` (moot — `check-guard-fates.mjs:820` *rejects* `observedRed` on a
`kept-unchanged` row, so no strengthening red exists to misread),
`32-16 T-32-22` (`audit-gate.mjs:130` fs surface is exactly `{ readdirSync, readFileSync }`
and the write-freedom pair is green 62/62, making the acceptance mechanically revocable),
`32-17 T-32-28` (zero references to `audit-mutation-harness` in any `package.json`, workflow,
shell script or hook setting — no consumer keys on its exit 2), plus the 21 `T-32-SC` rows
above.

---

## Deferred — code-review findings, not threat-register rows

Nine round-4 code-review findings (`CR-07`, `WR-37`…`WR-40`, `IN-16`…`IN-19`) are
dispositioned **OPEN** and carried to the milestone backlog by a recorded operator decision
(`32-UAT.md` test 1, option (a), 2026-09-01). They are tracked with full cross-round evidence
in `.planning/todos/pending/2026-09-01-phase-32-review-round-4-nine-open-findings.md`
(severity: blocker).

The security audit checked each only against the question *"does this falsify a mitigation the
register claims, at severity ≥ high?"* — **none does**:

- **`CR-07` (Critical).** `audit-root-args.test.ts:928-948` drives an
  `rmSync`+`cpSync` rebuild of the gitignored `installer/skills/` tree five times per run
  while four other test files read it under a ~120-file parallel runner. Checked against its
  three candidate rows: `32-02 T-32-08` claims only that a **non-default** root never
  implicitly spawns the sync (true — `check-skill-cli-invocations.mjs:211` refuses first);
  `32-18 T-32-30` is scoped to the harness matrix row; `32-18 T-32-31`'s write-freedom claim
  covers only `uncontained-read-only` rows. **No register row claims `installer/skills/` is
  isolated under the parallel runner**, so this is an *unregistered* flag, not a falsified
  mitigation. It is also **not a trust-boundary crossing**: `installer/scripts/sync-skills.mjs`
  reads no argv — `DEST` is fixed by module location (`:35`, `:75`) — so there is no
  untrusted-input path, only a concurrency hazard on a gitignored build artifact.
- **`WR-37`** vs `32-15 T-32-16` — both declared clauses are present (`:749-756` verdict-driven
  skip; a missing descriptor still hard-fails). WR-37 argues for a smaller blast radius than
  the row promised; the DoS itself is empirically closed (the 61-row sweep completes).
- **`WR-38`** — see the `32-21 T-32-46` verdict above. Instrument-label defect, mitigation intact.
- **`WR-39`** vs `32-20 T-32-42`/`T-32-34` — docblock overclaim; the declared elements
  (measured `/fixtures/` exclusion, isolated + concurrent runs) are present.
- **`IN-16`** vs `32-21 T-32-45` — the production refusal is present (`:338-362`); IN-16
  measured the driver's byte pair *with the refusal deleted* and concedes the pair
  discriminates the `$&` class it is used for.
- **`IN-18`** vs `32-15 T-32-17` — ordering/ergonomics. `--out` remains contained (`:1171`),
  and `join(root, "/tmp/x")` reinterpreting an absolute path as root-relative is fail-safe
  here; the `uncaughtException` handler `:242-248` still restores and exits 1.
- **`IN-19`** — 0 of 35 `find` strings self-overlap, and the per-site post-condition is exact
  under overlap.
- **`WR-40`, `IN-17`** — maintainability / test-thoroughness. No register row.

### Unregistered flags surfaced by the audit (informational, non-blocking)

1. **`installer/skills/` rebuild amplification under the parallel runner** — the `CR-07`
   subject. New write amplification with no register row. Already dispositioned OPEN at
   Critical in the code-review track.
2. **One leaked empty `.planning/vice-proxy-evidence-test-NmeHDU/`**, mtime 2026-09-01 01:54,
   created during the gap-closure round by a plan carrying no `/tmp`-leak row (`32-06`'s
   `T-32-27` covered only 32-06's own run, which leaked nothing; the other 12 dirs predate the
   phase). All are empty and invisible to git. Low.

---

## Verification Depth — honest coverage statement

Recorded because a security sign-off that does not say what it actually looked at is the same
class of defect this phase exists to guard against.

**Verified by reading the code and executing it** — the whole `mitigate` set's mechanisms:
the argv seam (`scripts/lib/audit-root.mjs`), containment, plant/revert/restore and guard
execution (`scripts/audit-mutation-harness.mjs`), the fate gate
(`scripts/check-guard-fates.mjs`), the four split-read gates, and the four phase-32 test
files. Independently executed by the auditor: `check-no-analyser.mjs` **exit 0**,
`check-guard-fates.mjs` **exit 0** (`setA=43 setB=16 setC=2 total=61`), `guard-fates.test.ts`
21/21, `removal-gate.test.ts` 8/8, `audit-root-args.test.ts` 62/62,
`audit-harness-restore.test.ts` 15/15 — 106 assertions green — with `git status --porcelain`
**byte-identical** before and after. Independently re-measured from data rather than prose:
registry descriptor and occurrence counts, the 35/35/35 `redOwed` basis, `WINDOWS.md` counter
arithmetic (40 entries, ids strictly ascending, 20 open + 12 waived + 8 fixed = 40), the
dependency surface and manifest history, and git `--numstat` proofs for every
record-integrity row.

**Accepted on the register's / evidence artifacts' own evidence (L1-appropriate, weaker):**
the repudiation rows whose product is a written record — `32-05 T-32-18`/`T-32-21`,
`32-09 T-32-40`/`T-32-41`, `32-13 T-32-09`, `32-14 T-32-09`, `32-15 T-32-17`/`T-32-18`,
`32-20 T-32-41`, `32-21 T-32-48`. Each artifact was confirmed to exist and its required
clauses spot-checked verbatim, but **not** every figure in the 61k-line and 493k-line sweep
documents was re-derived. Also accepted rather than re-derived: the full set-A/B/C derivation
(the gate performs it and exits 0), and `32-20 T-32-40`'s acceptance criterion asserting the
map-clearing call is still present — that was a one-time plan criterion, not a standing test
assertion, though the mechanism is present at `:183` and pinned behaviourally by the
second-window cases.

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-01 | 119 | 112 | 0 (+7 accepted-open below `high`) | gsd-security-auditor (ASVS L1, block_on: high) |

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log (AR-32-01 … AR-32-03)
- [x] `threats_open: 0` confirmed — no open threat at or above `high`
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-01
