---
phase: "44"
slug: "proof-04-the-independent-external-check"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on severity (the blocking gate)
threats_open: 0
asvs_level: 1
created: "2026-09-10"
---

# Phase 44 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

**Register origin:** `register_authored_at_plan_time: true` — all three plans
(`44-01`, `44-02`, `44-03`) carry a `<threat_model>` block authored before execution.
This is a *verification* run, not a retroactive-STRIDE reconstruction.

**Note on threat ids.** The three plans independently number their registers, so
`T-44-04` … `T-44-08` name **different** threats in different plans. Ids below are
qualified with their originating plan; nothing is silently merged.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| gitignored operator corpus → subject producer | `danish.d64` is operator-supplied material outside git; its bytes become the entire subject-side classification, so a substituted image would silently re-base every number. | Copyrighted disk image bytes (never enters the checkout) |
| VICE text-monitor reply → `parseAccessMap()` | Untrusted, version-drifting emulator text crosses into a parser whose output becomes the oracle side of the published count. | Untrusted external text |
| host filesystem → `c1541.*` / `dxa.disassemble` host-tool seam | Workspace-relative path arguments are resolved host-side; a path escaping the seam root would read or write outside the intended tree. | Filesystem paths |
| evidence script → host process table | Two direct-spawn emulator runs must not orphan a process and must not race a broker-managed instance. | Process lifecycle |
| subject producer ↔ oracle producer | Success Criterion 2 *is* this boundary being closed; a leak in either direction turns the measurement into a classifier grading its own homework. | Classification / observation artifacts |
| run transcripts → findings record | The record is what later readers cite; a number drifting between transcript and record is a fabricated figure with a real provenance trail behind it. | Measured numbers |
| Phase 38's recorded figures → this record | Three restated figures cross from another phase's committed evidence; a re-derivation or transcription slip would silently rewrite a published number. | Cross-phase published figures |
| this phase's documents → shipped doc guards | New documents can introduce a dangling reference or line-reference drift into the guarded document set. | Documentation references |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| T-44-01 (01,02) | Tampering | corpus + extracted-entry identity at read time | high | mitigate | Release digest `1a9d294e…fb6c5` asserted in **both** producers independently (`proof04-subject-dxa.mjs` ×1, `proof04-oracle-memmap.mjs` ×2); entry digest + 45074-byte length asserted before dxa; refusal names expected *and* actual. Both transcripts cite one `SUBJECT_ARTIFACT_SHA256`. | closed |
| T-44-02 (01,02) | Spoofing | emulator binary resolution | high | mitigate | `VICE_STOCK` is absolute `/usr/bin/x64sc`; `viceKind()` throws unless the resolved path reports `stock` (`proof04-oracle-memmap.mjs:226-228`); `ORACLE_VICE_BINARY` / `ORACLE_VICE_VERSION` printed from a live probe (`:230-231`). Blocks the `/usr/local/bin/x64sc` fork shadowing a bare PATH name. | closed |
| T-44-03 (01,02) | Tampering (data integrity) | `parseAccessMap()` consumption | high | mitigate | Discriminated `ok` field checked (`:300`); refusal prints `ORACLE_PARSE_REFUSAL` with code, line number and offending line (`:303`), writes no artifact, exits non-zero; committed rule routes to `not-exercised`. Recorded even when `none`. | closed |
| T-44-04 (01) | Tampering | run-identity fabrication | medium | mitigate | `argvDigest` computed inside `runIdentityFrom()` from raw argv — no parameter accepts a pre-computed digest. Real launch argv passed; `ORACLE_SPAWN_ARGV` (`:236`) and `ORACLE_ARGV_DIGEST` (`:318`) printed beside each other. | closed |
| T-44-04 (02) | Repudiation | a discarded or re-taken run vanishing from the record | high | mitigate | Verified by inspection: **exactly one** bare `PROOF04_VERDICT` outcome line per transcript (`run-a-hit50.md:112`, `run-b-narrowed.md:127`); the only other occurrence in each is a backticked prose reference. A second silent attempt cannot hide inside one file. | closed |
| T-44-04 (03) | Repudiation | a number in the record diverging from the run that produced it | high | mitigate | `proof04-verify-record.mjs` re-derives every per-run value, bucket-sum identity, depth-label rule, per-run verdict rule and roll-up from the two transcripts alone. **Re-run during this audit: `RECORDGATE_RESULT pass`, 7/7 assertions, exit 0.** Non-vacuity proven against a planted altered denominator. | closed |
| T-44-05 (01) | Information disclosure | host-tool path arguments escaping the seam root | medium | mitigate | Every `c1541.*` / `dxa.disassemble` path argument goes through `runHostTool()` (`proof04-subject-dxa.mjs:65,164,184`), resolved host-side by `resolveWorkspacePath()`, which refuses a path outside its root. No direct `child_process` spawn — confirmed by grep. | closed |
| T-44-05 (02) | Repudiation | a verdict or limit softened while writing prose | high | mitigate | Verdict transcribed from the driver's printed `PROOF04_VERDICT`, not judged in prose; depth label derived mechanically and cross-checked by the record gate's `RECORDGATE_DEPTH_LABEL` (**pass**); EVID-06/S3 narrowing quoted verbatim with source paths. | closed |
| T-44-06 (01) | Elevation of privilege | externally-derived strings reaching `execve` | medium | mitigate | Every emulator flag comes from `buildProbeArgs()` (`:234`), whose only interpolated values are two probe-chosen port numbers; no passthrough parameter by construction. `--depth` / `--label` parse to an integer and a slug and never reach an argv. | closed |
| T-44-06 (02) | Denial of service | orphaned `x64sc` across two runs | medium | mitigate | `preflight()` throws on a non-inactive broker or live `x64sc` (`:214`); `reapAll()` runs in the `finally` block (`:320,327`). Both transcripts record `BROKER_STATE: inactive` and `ORACLE_BROKER_STATE inactive`. | closed |
| T-44-06 (03) | Denial of service | a suite reading taken against a live broker | medium | mitigate | Broker and process state confirmed and recorded before the reading. **Re-confirmed during this audit:** `systemctl --user is-active vice-broker` → `inactive`, `pgrep -x x64sc` → empty, both before the suite run; `$?` read on the same line, never piped to `tail`. | closed |
| T-44-07 (01,02) | Denial of service | orphaned `x64sc` / a checkpoint sweep stalling the emulator thread | medium | mitigate | Same `preflight()` / `reapAll()` control as above. Exactly one **stopping** Exec checkpoint armed at the frame anchor — no non-stopping checkpoint, which would emit a frame per hit synchronously from inside the CPU loop. | closed |
| T-44-08 (01) | Repudiation | a verdict or rule chosen after seeing the numbers | high | mitigate | `SCHEMA.md` committed at `c62c261b` (17:13:09), strictly before both run transcripts (`00450ac3` 17:28:40, `dd1517e8` 17:32:15) and the findings record. Amendment ledger §9 empty. `--self-check` proves the `unresolved` / `not-exercised` branches fire without a live run (**re-run: `SELFCHECK_RESULT pass`**). | closed |
| T-44-08 (02) | Information disclosure | operator corpus bytes or snapshot data entering the checkout | medium | mitigate | Every artifact and log lands under `$HOME/.cache/c64-re-tools/phase44/…` (confirmed against both transcripts), outside the checkout and off the `/tmp` tmpfs. **Re-verified during this audit:** `git status --porcelain` over the phase directory shows no added `.d64`/`.prg`/`.bin`/`.vsf`/`.json`. | closed |
| T-44-08 (03) | Repudiation | a limit softened while writing the summary prose | high | mitigate | Four limits are separately-named `###` subsections — `PROOF04_LIMIT_DEPTH` (:155), `_SELF_MODIFICATION` (:182), `_ONE_RELEASE` (:203), `_ONE_CLASSIFIER` (:213) — not one caveats paragraph. `_COVERAGE_SHORTFALL`'s absence is itself stated and justified (:223). End-of-phase human check **signed off** (44-UAT.md test 1). | closed |
| T-44-09 (03) | Tampering | Phase 38's restated figures | high | mitigate | **Re-verified during this audit:** all three literals — `100.00 (24/24)`, `72.39 (97/134)`, `72.46 (100/138)` — present in the record and in the cited source `.planning/phases/38-…/evidence/proof01-dxa-real-release.md`. Transcribed verbatim with source path, never re-derived by re-running dxa. | closed |
| T-44-10 (03) | Tampering (data integrity) | a percentage formed from a zero or absent denominator | medium | mitigate | Gate asserts every percentage-shaped token is exactly two decimals, accompanied by a parenthesised integer pair whose quotient matches, and that no percentage is formed on a zero denominator. **Re-run: `RECORDGATE_PERCENTAGE_SHAPE pass`.** `--self-check`'s `zero-denominator` case asserts no `%` form is produced. | closed |
| T-44-11 (03) | Information disclosure | the planted-violation copy leaking into the checkout | low | mitigate | The gate accepts a `--record PATH` argument (`proof04-verify-record.mjs:92-95`) so no in-place edit of the committed file is ever needed; the altered copy is written only under `$HOME/.cache/c64-re-tools/phase44/planted/`. Confirmed absent from the checkout. | closed |
| T-44-SC (01,02,03) | Tampering | npm/pip/cargo installs | low | accept | No external package installed, no dependency added — both plans' `tech-stack.added` are empty. `44-RESEARCH.md` records its Package Legitimacy Audit as not applicable. Every external binary touched (`x64sc`, `c1541`, `dxa`) is detected and refused by name with a remedy, never installed. | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above workflow.security_block_on count toward threats_open*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-44-01 | T-44-SC | The phase installs nothing and adds no dependency, so there is no install surface to gate. The project's standing constraint is detect-then-refuse-by-name, never auto-install — the disposition was `accept` at plan time in all three plans and nothing in execution changed it. | Henrik Olsson (project owner standing constraint) | 2026-09-10 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-10 | 18 | 18 | 0 | `/gsd-secure-phase 44` (orchestrator, ASVS L1) |

**Method.** `register_authored_at_plan_time: true` and `asvs_level: 1`, so the workflow's
short-circuit applies: L1 grep-depth verification is sufficient and no `gsd-security-auditor`
subagent was spawned. Verification was **not** taken from SUMMARY claims — each mitigation was
checked against the implementation files directly, and six controls were re-executed live
during this audit (record gate, reconcile `--self-check`, independence test, doc-guards,
broker/process state, `git status` binary-leak check).

**Scope honesty.** L1 depth means grep-and-read verification that each named control is present
and reachable. It is not an L2 boundary-placement audit or an L3 end-to-end trace. Raising
`workflow.security_asvs_level` to 2 or 3 would spawn the auditor for deeper checks; at the
configured L1 that is out of scope by design, not an omission.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer)
- [x] Accepted risks documented in Accepted Risks Log
- [x] `threats_open: 0` confirmed
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-10
