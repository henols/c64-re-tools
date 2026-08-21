---
phase: 10
slug: 10-adoption-boundaries-automated-bootstrap-and-the-removal
status: verified
threats_open: 0
threats_total: 25
asvs_level: 1
created: 2026-08-21
---

# Phase 10 — Security

> Per-phase security contract: threat register, accepted risks, and audit trail.

This audit was written retroactively (the v0.3.0 milestone audit found Phase 10 shipped without
a `10-SECURITY.md`, despite being the phase that introduced this project's untrusted-input byte
parsers — `r2000-d64.ts`'s sector walker and `r2000-project.ts`'s `parsePrg()`). It does not
accept `10-REVIEW.md`, `10-VALIDATION.md` or any `10-0N-SUMMARY.md` prose as evidence by itself:
every row below cites the grep/read/test-run that produced the verdict, against the CURRENT tree
(2026-08-21), not the tree at Phase 10's original close. Several findings from `10-REVIEW.md`
(WR-05, WR-06, WR-07, WR-09, WR-10, WR-01, WR-03, WR-04) were closed by later plans (11-02,
11.1-04, 11.1-06) — this audit re-verified each closure by reading the cited code directly rather
than trusting the closure claim.

---

## Trust Boundaries

| Boundary | Description | Data Crossing | MCP-reachable? |
|----------|-------------|----------------|-----------------|
| A human's shell → `vice-proxy.ts`'s `argv[2] === "r2000"` branch → `r2000-cli.ts` | CLI verbs (`bootstrap`, `export-asm`, `verify`, `gen-enums`, `export-lbl`, `import-lbl`, `render-memmap`) | Filesystem paths, `.prg`/`.d64`/`.raw`/`.bin` bytes | **No** — gated before any MCP server/JSON-RPC construction (verified below) |
| A `.d64`/`.prg`/flat-64K file of unknown provenance (scene archive, cracked release) → `r2000-d64.ts` / `r2000-project.ts` | Untrusted disk-image and program bytes | Sector chains, directory entries, load-address bytes | **No** — these two modules are imported only by `r2000-cli.ts` (CLI-only) and `r2000-test-gate.ts` (test-only, never shipped); not imported by `r2000-tools.ts` or `r2000-mcp-client.ts`, the Phase-11 MCP surface |
| `r2000-cli.ts`/`r2000-verify.ts` argv → `spawnSync(regenerator2000)` | Caller-controlled file paths reaching a child process argv | Filesystem paths | No — CLI-only, and the child never touches stock VICE's binary monitor by construction |
| documentation/skill prose → a human reader | Command strings, licence claims, capability claims | Text | n/a (Repudiation-class threats, not code-reachable) |

The single most severity-relevant fact this audit adds beyond `10-REVIEW.md`: **the whole
attack surface the audit brief asked about — a malicious `.d64`/`.raw`/`.prg` fed to
`r2000-d64.ts` or `r2000-project.ts` — is reachable only by a human typing `vice-mcp r2000 <verb>`
at a local shell, never by a model through a `tools/call` payload.** Verified by:
`grep -rln "r2000-d64\|r2000-project" .claude/mcp/vice/*.ts` (excluding `*.test.ts`) returns only
`r2000-d64.ts`, `r2000-project.ts` (self), `r2000-cli.ts`, and `r2000-test-gate.ts`
(test-only, asserted absent from `package.json` `files[]`). `r2000-tools.ts` (the curated
`r2000_*` MCP tool family, `vice-proxy.ts:3287-3289`) imports neither. This caps every
byte-parser finding below at "local operator misuse," not "prompt-injectable remote input."

---

## Threat Register

| Threat ID | Category | Disposition | Source Plan(s) | Evidence | Status |
|-----------|----------|-------------|-----------------|----------|--------|
| T-10-01 | Denial of Service | mitigate | 10-01, 10-02(transfer), 10-04, 10-06, 10-09 | `FORBIDDEN_R2000_FLAGS = ["--vice"]` (`r2000-launch.ts:77`); `assertNoViceFlag()` iterates it and throws `R2000ViceFlagError` (`:122-130`); called as the **first statement** of `runR2000()` (`:311`) and of `withR2000Session()` in `r2000-mcp-client.ts:330`. Structurally enforced (not just called-by-convention) by `r2000-spawn-seam.test.ts`, present on disk, which derives every production spawn call site and fails if any spawns unguarded. `10-06`/`10-09`'s documentation-only leg (a *user's own* separate debugger) verified present in `.claude/skills/vice-wedge-triage/SKILL.md:18,65` (`monitor_held_elsewhere`, "Never recycle"). | **CLOSED** |
| T-10-02 | Tampering | mitigate | 10-01, 10-02, 10-03, 10-04, 10-05, 10-07 | `grep -rn "shell:\s*true" .claude/mcp/vice/r2000-*.ts .github/workflows/ci.yml` → 0 matches (only a comment stating the rule). `runR2000()` (`r2000-launch.ts:317`) and `withR2000Session()` (`r2000-mcp-client.ts:332`) both call `spawnSync`/`spawn` with an argv array, never a shell string. CI's ACME step (`.github/workflows/ci.yml:97-100`) uses fixed literal args, no interpolation of untrusted input. | **CLOSED** |
| T-10-03a | Tampering | mitigate | 10-02 | `synthesizeProject()` (`r2000-project.ts:124-131`): `origin` range-checked to `0..0xffff`, zero-length payload rejected, both throw naming the offending value. | **CLOSED** |
| T-10-03b | Tampering | mitigate | 10-03 | `.d64` sector-chain traversal: `listEntries()` (`r2000-d64.ts:148-200`) and `extractEntry()` (`:220-296`) each carry an independent `visited`-`Set` cycle guard that throws on a revisited `{track,sector}` key, plus an `isInImage()` bounds check against the 35-track geometry before every walk step. | **CLOSED** |
| T-10-04 | Repudiation | mitigate | 10-01 | `assertNoViceFlag()` throws `R2000ViceFlagError` (named, carries `argv`) rather than filtering; `grep -n "filter\|strip" r2000-launch.ts` around the guard shows no removal path — confirmed by reading `:122-130` directly (no `.filter()` on argv anywhere in the guard). | **CLOSED** |
| T-10-05 | Information Disclosure | mitigate | 10-01, 10-03, 10-04 | `hostpath-consumers.test.ts:178-220` now derives the r2000 module set from disk (`r2000ProductionModules()`, filtered on `/^r2000-.*\.ts$/`) with a non-vacuity floor, rather than the hand-typed 10-module list the v0.3.0 milestone audit flagged as stale (INT-01) — that gap is closed: a dedicated regression test (`:199-206`) pins the four previously-uncovered modules (`r2000-acme-ident.ts`, `r2000-regbits-gen.ts`, `r2000-symbols.ts`, `r2000-test-gate.ts`) as present in the derived set. Live re-check: `grep -rn "hostpath\|containerpath" .claude/mcp/vice/r2000-*.ts` (excluding tests) → 0 matches. | **CLOSED** |
| T-10-06 | Denial of Service | mitigate | 10-02, 10-05 | `r2000-project.test.ts:134,193` and `r2000-verify.test.ts:208,229` both pass explicit `timeout` options to `spawnSync`/`node:test`; `r2000-verify.test.ts:201-202` wraps temp-dir cleanup in `finally`. Neither file appears in `MANUAL_ONLY_TESTS` (grep confirms only comment-level "must never be added" markers, no actual listing). | **CLOSED** |
| T-10-07 | Spoofing | mitigate | 10-03, 10-04 | `extractEntry()` (`r2000-d64.ts:225-236`) throws on 0 matches and on >1 matches, never returns a guess. `bootstrapProject()` (`r2000-cli.ts:354-375`) requires `opts.entry` for `.d64` input and prints the listing + exits 2 otherwise. | **CLOSED** |
| T-10-08 | Tampering | mitigate | 10-04 | `vice-proxy.ts:271` — `if (process.argv[2] === "r2000")` dispatches to `runR2000Cli()` and calls `process.exit(code)` (`:303-306`), **above** `HERE_DIR`/backend-probe/server construction (`:309` onward). Confirmed by reading the file directly: no MCP server object exists yet when this branch runs. | **CLOSED** |
| T-10-09 | Spoofing | mitigate | 10-05 | `grep -c "status === 0" r2000-verify.ts` → `0`. `acmeVerdict()` (`r2000-verify.ts:116-160`) derives `ok` only from parsed ACME `VerifyLine`s: a `"skipped"` or `"failed"` ACME line is `ok:false` regardless of the child's exit code. | **CLOSED** |
| T-10-10 | Repudiation | mitigate | 10-05 | `evidence/10-verify-transcript.txt` present under the phase directory, carrying raw stdout/exit codes (verified by directory listing). | **CLOSED** |
| T-10-11 | Repudiation | mitigate | 10-06, 10-08 | `grep -rln "toacme\|cmdDisasm" .claude/skills/*.md .claude/skills/*/SKILL.md .claude/skills/*/references/*.md` → 0 hits. `check-skill-fork-honesty.mjs` re-run live: exit 0. | **CLOSED** |
| T-10-12 | Spoofing | mitigate | 10-06 | Documented `vice-mcp r2000 <verb>` commands checked against `check-skill-tool-coverage.mjs`'s live output: "r2000 CLI verbs: 7 parsed from r2000-cli.ts, 7/7 resolved (named by at least one skill file)." No dangling/invented verb. | **CLOSED** |
| T-10-13a | Repudiation | mitigate | 10-07 | CI's "Assemble the acme-build scaffold" step (`.github/workflows/ci.yml:83-105`) clears `$ACME`, scaffolds, builds, and asserts the emitted PRG's first two bytes are `01 08` (`$0801`) before declaring success — re-run live, confirmed present and unchanged from the plan's description. | **CLOSED** |
| T-10-13b | Repudiation | mitigate | 10-06 | WR-03's fix present: `scripts/check-skill-fork-honesty.mjs:406-448` — `DISASM_LINE_EXEMPTION` scoped per-check (only inside the `\bdisasm\b` branch) with an `exemptionHits === 1` non-vacuity assertion, matching the plan's described fix exactly (verified by reading the source, not the plan's claim). | **CLOSED** |
| T-10-14 | Denial of Service | accept | 10-07 | `grep -n "regenerator2000\|cargo install" .github/workflows/ci.yml` → 0 matches; the accepted risk (no r2000 install in CI, ~5 min cost) holds. | **CLOSED** (accepted risk, documented) |
| T-10-15 | Repudiation | mitigate | 10-08, 10-09 | `THIRD-PARTY-NOTICES.md:86`, `README.md:196`, `REQUIREMENTS.md:8,57`, `ROADMAP.md:100,307` all state `MIT OR Apache-2.0` (dual); no surviving "Apache-2.0 only" claim found by grep. | **CLOSED** |
| T-10-16 | Tampering | mitigate | 10-08 | `scripts/check-skill-fork-honesty.mjs:50-51` header states, and the body confirms by direct read, that the script only `readFileSync`s and regex-matches — no `eval`, no dynamic import, no spawn. | **CLOSED** |
| T-10-17 | Repudiation | mitigate | 10-09 | `ROADMAP.md` criterion-3 rows for Phase 10 plans (`:314-319`) match the shipped behaviour (bootstrap synthesises, `.d64` refuses to guess, the CLI seam) — no residual "input set the code does not implement" language found in the criterion-3 text checked. | **CLOSED** |
| T-10-18 | Denial of Service | mitigate | 10-09 | `vice-wedge-triage/SKILL.md:18,65,101` documents `monitor_held_elsewhere`/`monitor_acquisition_timeout` explicitly and states "Never a reason to recycle" for the contention case. | **CLOSED** |
| T-10-SC | Tampering | accept / mitigate | all nine plans | `.claude/mcp/vice/package.json` `dependencies` unchanged at exactly `{"@mastra/mcp":"1.15.0","@mastra/core":"1.55.0"}` (checked live); `node scripts/check-npm-packages.mjs` exits 0 live (73 files, dynamic-import closure walk included); regenerator2000's crates.io provenance (`ricardoquesada`, `MIT OR Apache-2.0`, 0.9.20) was verified in Phase 9 and is not re-verified here (accepted, inherited). | **CLOSED** |
| T-10-19 | Tampering / Integrity | mitigate | quick 260821-jd8 (retroactively promoted from unregistered WR-08) | `parseArgs()` (`r2000-cli.ts`, rewritten by commit `3541886`) now validates both `--entry` and `--out`: a value that is `undefined` or itself starts with `--` sets `entryMissingValue`/`outMissingValue` rather than being taken as the option's value, reusing the guard shape `parseExportLblArgs()` already had. `cmdBootstrap()`, `cmdExportAsm()` and `cmdVerify()` (the three verbs that route through `parseArgs()`) each check the relevant flag(s) before touching the filesystem and refuse with a one-line, never-thrown `bootstrap:`/`export-asm:`/`verify: --{entry,out} requires a value` message naming the actually-short option (WR-09's lesson: `--out --entry FOO` blames `--out`, not `--entry`) — `bootstrapProject()`'s never-throw contract is preserved (every branch still returns `{ code }`). Pinned by 10 new cases in `r2000-cli.test.ts` (commit `e0fd305`): the review's own literal reproduction for both `bootstrap` and `export-asm`, each asserting the actual harm (no file literally named `--entry` is created at the CLI's `process.cwd()` — confirmed to be the real landing spot for a directory-less relative `outPath` while proving these tests non-vacuous), plus missing-value and flag-shaped-value cases for both options across `bootstrap`/`export-asm`, and `--entry`'s two cases for `verify` (`--out` is not in `verify`'s accepted set at all, already pinned by the pre-existing "verify: --out is refused" IN-06 test). Non-vacuity proven directly: all 10 new tests were confirmed to FAIL against a scratch revert of `parseArgs()` to the pre-fix `rest[++i]` form (the revert visibly reproduced the hazard — a `--entry` file was written into the repo's own `.claude/mcp/vice/` working directory during that run), then confirmed to PASS again after restoring the fix, with `git diff` showing byte-identity against the committed fix. Full suite re-run live: `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 npm test` and `npx tsc --noEmit` both clean (see quick task 260821-jd8's SUMMARY.md for exact numbers). | **CLOSED** |

---

## WR-08 (T-10-19) — live re-reproduction, severity assessment, and resolution

Reproduced directly against the current tree (`.claude/mcp/vice`, `regenerator2000 0.9.20`):

```
$ node -e "const {parseArgs}=require('./r2000-cli.ts')" # (ESM; illustrative — see actual test run below)
```

Traced by hand against `parseArgs(["game.prg","--out","--entry","FOO"])`:
- `i=0`: `"game.prg"` → positional.
- `i=1`: `"--out"` → `out = rest[2] = "--entry"` (a flag-shaped token, accepted uncritically); loop `i` becomes 2 internally via `++i`.
- `i=3` (next iteration): `"FOO"` → positional.
- Result: `{ positional: ["game.prg","FOO"], out: "--entry", entry: undefined }`.

`bootstrapProject()`'s `outPath = opts.outPath ?? ...` then resolves to the literal string
`"--entry"`, and `writeFileSync("--entry", projectJson)` (`r2000-cli.ts:442`) creates that file —
matching `10-REVIEW.md`'s WR-08 finding exactly, unchanged.

**Security dimension, assessed as asked:** this is real, but bounded severity. A dash-prefixed
filename created in the working directory is a **local integrity/DoS-adjacent hazard**, not a
code-execution or information-disclosure one: a later `rm *` or a script doing
`some-tool $(ls)` in that directory could have the file's name parsed as an option by whatever
consumes it next (the classic `--` shell-glob trap). It requires a human already at a local shell
running this CLI directly — **it is not reachable via any MCP tool** (confirmed above: `r2000-cli.ts`
is gated behind `argv[2] === "r2000"`, checked before any JSON-RPC server exists, so no
prompt-injected model input can reach `parseArgs()`). Severity: **Low-Medium, CLI-only, no
privilege escalation, requires local operator error, but a real and easily-triggered footgun**
(unlike most Phase 10 findings, this is a one-command reproduction, not a crafted-file scenario).
It was correctly filed as a todo
(`.planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md`) but
never promoted into any `10-0N-PLAN.md`'s `<threat_model>` block, and no other plan's disposition
covers it — it is therefore an **unregistered threat with an open, unmitigated code path**,
which this audit's adversarial stance requires surfacing as a BLOCKER-class finding rather than
folding it silently into "accepted."

**Recommendation (as originally reported):** apply the same missing/flag-shaped-value guard
`parseExportLblArgs()` already uses (`r2000-cli.ts:684-699`) to the shared `parseArgs()` used by
`bootstrap`/`export-asm`/`verify` — the fix pattern already exists in this file, it just was not
applied to all three original verbs.

**Resolution:** closed by quick task `260821-jd8` (see
`.planning/quick/260821-jd8-close-wr-08-flag-shaped-option-values/260821-jd8-SUMMARY.md`).
`parseArgs()` was rewritten exactly along the recommended lines (commit `3541886`), and pinned by
ten new tests including the literal `--out --entry FOO` reproduction for both `bootstrap` and
`export-asm` (commit `e0fd305`). The pending todo
(`.planning/todos/pending/2026-08-21-r2000-cli-wr-08-option-values-silently-swallowed.md`) that
this section referenced has been moved to `.planning/todos/completed/` with a `## Resolution`
section naming the same commits. Assigned threat ID **T-10-19** in the register above, status
**CLOSED**.

---

## Other 10-REVIEW.md findings re-checked (not threat-model items, informational)

| Finding | Current state |
|---------|---------------|
| WR-11 (acme.mjs `--help` still advertises libs) | Not re-verified in depth by this audit (documentation-only, out of the threat register); left as recorded tech debt. |
| WR-12 (`.d64` test fixture tautology) | Not re-verified (test-strength finding, not a shipped-behavior defect; the review itself notes the formula is independently correct). |
| IN-01–IN-07 | Not re-verified individually; none carry a `T-10-*` ID and none describe an unmitigated attacker-reachable path per this audit's own re-reading of `r2000-cli.ts`, `r2000-verify.ts`. |

---

## Baseline (re-run live, this audit)

- `cd .claude/mcp/vice && VICE_REQUIRE_R2000=1 VICE_REQUIRE_ACME=1 npm test` → **2192 tests, 2157 pass, 0 fail, 30 skipped, 5 todo** (matches the required baseline exactly).
- `npx tsc --noEmit` → exit 0.
- `node scripts/check-skill-fork-honesty.mjs` → exit 0.
- `node scripts/check-npm-packages.mjs` → exit 0 (73 files in `@henols/vice-mcp`, 35 files/6 skills in `@henols/c64-re-tools`).
- `node scripts/check-skill-tool-coverage.mjs` → exit 0 (r2000 CLI verbs 7/7 resolved).
- `git status --short` → clean after the run (no fixture or scratch file left behind; no malicious `.d64`/`.raw` fixtures were written to the repo tree for this audit — verification relied on hand-traced code reading plus the project's own existing pinned fixtures in `r2000-d64.test.ts`/`r2000-cli.test.ts`, which already exercise truncated images, NUL-padded names, and the various parser edges).

---

_Audited: 2026-08-21_
_Auditor: Claude (gsd-security-auditor), retroactive audit per v0.3.0 milestone audit finding "No 10-SECURITY.md"_
