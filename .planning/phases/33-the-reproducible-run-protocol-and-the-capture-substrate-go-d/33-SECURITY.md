---
phase: "33"
slug: "the-reproducible-run-protocol-and-the-capture-substrate-go-d"
status: verified
# threats_open = count of OPEN threats at or above workflow.security_block_on (high)
threats_open: 0
asvs_level: 1
register_authored_at_plan_time: true
created: "2026-09-03"
---

# Phase 33 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.
> Built in **State B** (no prior SECURITY.md) from the `<threat_model>` block that
> **all twelve** plans carry, plus the `## Threat Flags` sections of the SUMMARYs.

---

## Trust Boundaries

| Boundary | Description | Data Crossing |
|----------|-------------|---------------|
| a `.vsf` snapshot file → `vsf-slice.ts` | Untrusted binary input; every offset and length the module walk uses is read FROM that input | Attacker-controllable module headers, lengths, body sizes |
| the container-side proxy → the host broker control plane | The `acquire` op gained a `profile` field this phase | A JSON launch-profile object, pre-narrowing |
| a launch profile → the spawned `x64sc` argv | A wrong mapping here becomes arbitrary emulator flags | Fixed literal flag tokens only — never a passthrough string |
| the binary monitor socket → `stock-reproducible-run.ts` | Unauthenticated full machine control on 127.0.0.1 | Wire frames, five of which are unsolicited events |
| a per-release transient allow-list → `compareCaptures()` | The ONE input that can turn a failing comparison into a passing one | An allow-list artifact, capped at 64 addresses |
| the evidence probes → the shipped modules | A control that drifts from shipped code measures a stale copy | Imported symbols, never retyped literals |

---

## Threat Register

| Threat ID | Category | Component | Severity | Disposition | Mitigation | Status |
|-----------|----------|-----------|----------|-------------|------------|--------|
| `T-33-01` | Denial of Service | listSnapshotModules() | high | mitigate | Bound-check every wire-derived offset before use: a size below `MODULE_HEADER_LEN`, or `offset + size` past the file length, throws. Never `subarray` … | closed |
| `T-33-02` | Tampering | sliceC64Mem() | high | mitigate | Strict walk with no rescan fallback, plus the terminal `offset === file.length` assertion; a body below 65543 is refused naming the observed value and… | closed |
| `T-33-03` | Tampering / Elevation of Privilege | the `acquire` handler's `profile` field | high | mitigate | normaliseLaunchProfile()` is the single narrowing site: object-or-absent, `warp`/`headless` boolean-or-absent, unknown keys **rejected by name** with … | closed |
| `T-33-04` | Elevation of Privilege | evidence/autostart-probe.mjs` argv assembly | high | mitigate | The probe emits a fixed literal flag list with only the port interpolated; no argv element is built from an external string, and there is no passthrou… | closed |
| `T-33-05` | Information Disclosure | the binmon bind address | medium | mitigate | binmonHost` keeps its `127.0.0.1` default; `profile` has no path to the bind address. The existing one-time widened-bind stderr note (naming the resol… | closed |
| `T-33-06` | Information Disclosure | corpus `.d64` bytes and probe `.vsf` output | medium | mitigate | The corpus stays gitignored (`corpus/.gitignore` refuses `*.d64`); the probe writes `.vsf` output under `PROBE_DIR=$HOME/.cache/c64-re-tools/phase33`,… | closed |
| `T-33-06b` | Cryptography | argvDigest` usage in the record | low | accept | sha256 via `node:crypto` only. Accepted as adequate: the digest is a reproducibility identity key for bookkeeping, not an integrity control against an… | closed |
| `T-33-07` | Repudiation | the two transcripts | high | mitigate | Every run records `BROKER_STATE: inactive` and the observed `TEST_AUTOMATED_BASELINE:`; a measurement taken against a live broker is discarded and re-… | closed |
| `T-33-09` | Spoofing | release identity | medium | mitigate | The release is identified by sha256 over its exact bytes (`1a9d294e…fb6c5`), asserted in the task precondition; a filename match without a digest matc… | closed |
| `T-33-10` | Denial of Service | the frame-anchor checkpoint | medium | mitigate | Every checkpoint armed here is `stop: true`. A non-stopping checkpoint emits `CHECKPOINT_INFO` synchronously from inside the CPU loop on every hit, wh… | closed |
| `T-33-11` | Repudiation | evidence/DECISION-RULE.md | high | mitigate | Single-commit landing plus the banked `## Ordering proof` (real `git log` and `git rev-list --count` output). The verify command asserts `git rev-list… | closed |
| `T-33-12` | Tampering | evidence/DECISION-RULE.md` after the first measurement | high | mitigate | The frozen-status paragraph names the specific failure mode (a later plan "only resolving an ambiguity") and routes ambiguities to an `## ACCEPTED LIM… | closed |
| `T-33-13` | Repudiation | the verdict's derivability | medium | mitigate | ## Totality` walks all 108 input tuples so the verdict is re-derivable from the document alone; R9 carries no antecedent, which is what makes `could-n… | closed |
| `T-33-14` | Tampering | 33-CONTEXT.md` decision text | high | mitigate | Amend by appending a dated rider beside the superseded sentence, never by deleting it; Task 1's second verify asserts the original D-21 and D-24 sente… | closed |
| `T-33-15` | Tampering | .planning/STATE.md | high | mitigate | Address the two rows by their unique todo stems, never by a bare status token (this project's own record: a broad status replace deleted standalone `N… | closed |
| `T-33-16` | Repudiation | the recorded suite baseline | medium | mitigate | The new expected count (2 failing tests in `anno-register.test.ts`) is written into `STATE.md` with the root cause named, and every later plan's `fail… | closed |
| `T-33-17` | Tampering | default_memspace` contamination during a drive-emulated run | medium | mitigate | Every checkpoint the probe arms passes `memspace: 0x00` through the wire-byte mapping (`0x00` main, `0x01`-`0x04` units 8-11, `0x08` rejected) rather … | closed |
| `T-33-18` | Tampering | the skill-side resolution ladder | medium | mitigate | Every rung is a named path; total failure exits non-zero listing the paths tried. There is no local re-implementation to fall back to, so a resolution… | closed |
| `T-33-19` | Information Disclosure | .vsf` path handling | medium | mitigate | No exported function takes a path parameter; `vsf-slice.ts` imports nothing from either path-translation seam, and `hostpath-consumers.test.ts` assert… | closed |
| `T-33-20` | Tampering | resources/broker-launch.mjs | high | mitigate | The regenerated artifact is staged in the same commit as its `.mts` source, asserted by a `git diff --cached --name-only` check; `resources-sync.test.… | closed |
| `T-33-21` | Tampering | docs/tool-support.md | medium | mitigate | The table is produced only by its generator and guarded byte-identically; the verify re-runs the generator and requires `git diff --exit-code` to be c… | closed |
| `T-33-22` | Denial of Service | argv order regression (`-default`, `-console`) | high | mitigate | Four ordering assertions pin the positions that were each learned from a failure: `-default` off index 0 means the monitor never binds and the connect… | closed |
| `T-33-23` | Denial of Service | the single-owner `inFlight` launch guard | high | mitigate | The eligibility filter is a synchronous `continue` placed **before** the readiness-probe `await`, verified by a line-number comparison inside the extr… | closed |
| `T-33-24` | Spoofing | a grant that does not match the request | high | mitigate | Serving a profile-bearing request with an unwarped instance is undetectable by the caller, so it is structurally excluded: a mismatched instance is in… | closed |
| `T-33-25` | Tampering | older state-directory records | low | accept | A record with no `profile` field is treated as profile-less, which IS the warm floor's current behaviour, so a broker restarted mid-phase degrades to … | closed |
| `T-33-26` | Tampering | parseAllowList | high | mitigate | An allow-list is the one input that can make a failing comparison pass, so every widening route is closed by refusal: a range-shaped entry is refused … | closed |
| `T-33-27` | Tampering | compareCaptures`'s bit tolerance | high | mitigate | There is no bit-count tolerance at any address — a one-bit difference outside the allow-list fails. The planted one-bit control in Task 2 is the proof… | closed |
| `T-33-28` | Repudiation | the predicate/oracle circularity | high | mitigate | Barred by shape rather than by convention: a bidirectional import census (static and dynamic) plus a signature check for image-buffer parameters, each… | closed |
| `T-33-29` | Tampering | the census's own coverage | medium | mitigate | The census reads files with `readFileSync` over `shippedTsModules()` rather than shelling out, which makes the NUL-byte blind spot in this tree unreac… | closed |
| `T-33-30` | Tampering | inheriting an address set across releases | high | mitigate | Re-deriving over an existing artifact is refused without an explicit `--force`, with the no-inheritance rule in the message and in the directory READM… | closed |
| `T-33-31` | Spoofing | the wait's resolution | high | mitigate | The wait is keyed on the **target's** checkpoint id and never resolves on the anchor's `CHECKPOINT_INFO`, and no pending request is ever resolved by a… | closed |
| `T-33-32` | Tampering | hit_count` parsing | high | mitigate | Read at body offset 13 as u32LE, through `stock-protocol.ts`'s existing parse branch rather than a local offset. Proven by a scripted frame yielding 1… | closed |
| `T-33-33` | Tampering | argument acceptance | high | mitigate | RUN_UNTIL_KEYS` is pinned by a single `assert.deepEqual` to exactly five names, so an accepted-and-ignored argument (or a future sub-flag) reds. `repr… | closed |
| `T-33-34` | Denial of Service | the resume/cleanup paths | medium | mitigate | Exactly one resume per wait; the three cleanup paths stay distinct with only the timeout path deleting the target; the non-temporary anchor is deleted… | closed |
| `T-33-35` | Repudiation | the three red controls | high | mitigate | Each control ships with the paired positive that makes its red attributable: Arm B against Arm A for the determinism block; the full protocol against … | closed |
| `T-33-36` | Tampering | a control drifting from the shipped code | high | mitigate | The determinism probe imports `STOCK_DETERMINISM_FLAGS` rather than retyping it, the frame-anchor control calls the shipped `compareStopIdentity`, and… | closed |
| `T-33-37` | Tampering | shipping a protocol-without-the-reset | high | mitigate | The reset-removed control is produced by an evidence script calling the procedure's pieces directly, never by a tool argument. 33-09 pins the accepted… | closed |
| `T-33-38` | Tampering | changing the timing budget inside a measuring plan | medium | mitigate | Task 3 records a `short` verdict and explicitly does not change the budget, and its verify asserts `git status --porcelain -- src/mcp/vice/` is empty.… | closed |
| `T-33-39` | Repudiation | the verdict's derivation | high | mitigate | Every input is read from the final occurrence of its declared outcome line at column 0 of its declared source file, cited by path; a verify command ex… | closed |
| `T-33-40` | Repudiation | an unevaluated rule read as satisfied | medium | mitigate | The rule walk states, for every rule after the fired one, that it was **not evaluated** and why — Phase 23's findings document had to add exactly this… | closed |
| `T-33-41` | Tampering | the two-directional ledger invariant | high | mitigate | The three file moves and the three row removals land in one commit, asserted by a staged-path check; no new Deferred Items row is filed for the residu… | closed |
| `T-33-42` | Repudiation | a criterion marked met against its own evidence | high | mitigate | Each of the five success criteria is annotated with the outcome line's value and the evidence file behind it, so a "met" annotation and a contradictin… | closed |
| `T-33-SC` | Tampering | npm/pip/cargo installs | high | accept | No package-manager install task exists in this plan or anywhere in this phase — `33-RESEARCH.md` § *Package Legitimacy Audit* records "Not applicable … | closed |

*Status: open · closed · open — below high threshold (non-blocking)*
*Severity: critical > high > medium > low — only open threats at or above `workflow.security_block_on` (high) count toward `threats_open`*
*Disposition: mitigate (implementation required) · accept (documented risk) · transfer (third-party)*

---

## Accepted Risks Log

| Risk ID | Threat Ref | Rationale | Accepted By | Date |
|---------|------------|-----------|-------------|------|
| R-33-01 | `T-33-SC` | No package-manager install task exists anywhere in this phase. `33-RESEARCH.md` § *Package Legitimacy Audit* records "Not applicable to this phase", and the container-side server's zero-third-party-runtime-dependency posture is a documented project constraint. **Accepted on the grounds that the attack surface is absent, not tolerated** — any later plan proposing an install must run the audit. Confirmed at audit: both `package.json` files and `package-lock.json` untouched by this phase. | Henrik | 2026-09-03 |
| R-33-02 | `T-33-25` | A state-directory record with no `profile` field is treated as profile-less, which IS the warm floor's current behaviour, so a broker restarted mid-phase degrades to today's semantics rather than to an error. Pinned by a round-trip test rather than left implicit. | Henrik | 2026-09-03 |
| R-33-03 | `T-33-06b` | `argvDigest` uses sha256 via `node:crypto` only. The digest is a **reproducibility identity key for bookkeeping, not an integrity control against an adversary**; no threat model in this phase asks it to resist a chosen-prefix attack. | Henrik | 2026-09-03 |

---

## Security Audit Trail

| Audit Date | Threats Total | Closed | Open | Run By |
|------------|---------------|--------|------|--------|
| 2026-09-03 | 43 | 43 | 0 | `/gsd-secure-phase 33` (orchestrator, L1) |

### Method, and why no auditor subagent was spawned

`secure-phase` § 3's short-circuit applies exactly: `threats_open: 0` **and**
`register_authored_at_plan_time: true` **and** `asvs_level == 1`. At L1, grep-depth
classification is the specified sufficient depth, so the workflow routes straight to the
write-up rather than to a deeper L2/L3 verification this project has not opted into.

`register_authored_at_plan_time` is `true` on direct evidence, not assumption: **all
twelve** `33-*-PLAN.md` files contain a parseable `<threat_model>` block. This is not the
legacy "empty-by-no-planning" case the retroactive-STRIDE branch exists to catch.

### How each threat was classified closed

- **34 of 43** are cited **by threat id** in a SUMMARY's `## Threat Flags`
  section, each naming where the mitigation is observed. All seven such sections report
  "None" — no residual flag was raised by any executor.
- **9 of 43** are not cited by id in any SUMMARY, so they were verified directly at
  this audit rather than taken on trust:

  | Threat | Severity | What was checked, 2026-09-03 |
  |---|---|---|
  | `T-33-07` | high | Transcripts record broker state and real command output: `BROKER_STATE:` appears 21×, "BROKER inactive" 18× across `evidence/*.md`, and the four measurement transcripts carry 13 / 22 / 12 / 13 real `$ `-prefixed command lines — a summary written in place of output would not clear the per-file minimum |
  | `T-33-09` | medium | Release identity asserted by literal digest: `sha256=99b1d660…71dd5` present in `evidence/33-capture-pair.md`, 36 full 64-hex digests recorded |
  | `T-33-27` | high | `capture-predicate.test.ts` carries the planted **one-bit** control; `compareCaptures()` has no bit-count tolerance at any address |
  | `T-33-28` | high | `capture-seam.test.ts` runs the bidirectional import census; `stop-oracle.ts` exports no image-buffer parameter |
  | `T-33-29` | medium | The census uses `readFileSync` over `shippedTsModules()` (`capture-seam.test.ts:173,184`) rather than shelling out — **this is what makes the known NUL-byte grep blind spot in this tree structurally unreachable**, not merely unlikely |
  | `T-33-30` | high | `derive-transients.mjs:318` refuses to overwrite an existing artifact without `--force`, with the no-inheritance rule in the message |
  | `T-33-35` | high | Each red control ships with its paired positive; the three control transcripts are committed |
  | `T-33-36` | high | The controls **import** shipped definitions rather than retyping them: `frame-anchor-probe.mjs:87,90` takes `STOCK_DETERMINISM_FLAGS` from `broker-launch.mts` and calls the shipped `oracle.compareStopIdentity()` at `:534,:550`; `determinism-probe.mjs` does the same |
  | `T-33-06b` | low | Disposition is `accept` — recorded as R-33-03 above |

  Independent corroboration for `T-33-36`: the UAT test-2 probe written on 2026-09-03
  (`evidence/reproducible-seam-probe.mjs`) reproduced this failure mode from the other
  direction. Its first run **omitted** `STOCK_DETERMINISM_FLAGS` and silently measured a
  non-reproducible capture while the stop identity still looked perfect. That is precisely
  the drift `T-33-36` names, observed live.

---

## Sign-Off

- [x] All threats have a disposition (mitigate / accept / transfer) — 40 mitigate, 3 accept, 0 transfer
- [x] Accepted risks documented in Accepted Risks Log — 3 entries
- [x] `threats_open: 0` confirmed — no open threat at or above the `high` block threshold
- [x] `status: verified` set in frontmatter

**Approval:** verified 2026-09-03
