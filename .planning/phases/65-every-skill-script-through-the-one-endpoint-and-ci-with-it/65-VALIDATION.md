---
phase: "65"
slug: "every-skill-script-through-the-one-endpoint-and-ci-with-it"
# status lifecycle: draft (seeded by plan-phase) → validated (set by validate-phase §6)
# audit-milestone §5.5 distinguishes NOT-VALIDATED (draft) from PARTIAL (validated + nyquist_compliant: false) (#2117)
status: draft
nyquist_compliant: false
wave_0_complete: false
created: "2026-09-25"
---

# Phase 65 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.
> Seeded by plan-phase from `65-RESEARCH.md` § Validation Architecture and § Security Domain,
> and from `65-CONTEXT.md` D-01..D-14. Task-level rows are filled once `65-*-PLAN.md` exists;
> `/gsd-validate-phase` closes the file out.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Node's built-in test runner — `node --test`. No separate framework to install. |
| **Config file** | none — convention is a colocated `*.test.ts` / `*.test.mts` / `*.test.mjs` beside the module under test |
| **Quick run command** | `cd src/mcp/vice && node --test --test-reporter=tap <file>.test.ts` |
| **Full suite command** | `npm --prefix src/mcp/vice test`, plus `npm --prefix installer test` and `node --test 'src/skills/*/scripts/*.test.mjs'` (the three suites `.github/workflows/ci.yml` runs) |
| **Estimated runtime** | ~90 seconds for the MCP-server suite; the D-01 broker-per-suite harness adds broker start-up per affected suite |

**Suite-command caveat (binding, from project memory):** `npm run test:automated` skips the
`MANUAL_ONLY_TESTS` set and therefore hides CI failures. The phase gate below uses the full-glob
`npm test`, not `test:automated`. Never pipe a suite through `tail`/`head`: the pipe reports the
pager's exit code and fakes a green baseline. Redirect to a file and read `$?` on the same line.
`node --test` exits 0 on a filename that does not exist, so every per-task command checks each
named test file exists before it runs.

---

## Sampling Rate

- **After every task commit:** the specific new/changed test file(s) for that task
- **After every plan wave:** the three full suites above, plus `npm --prefix src/mcp/vice run typecheck`
- **Whenever the ACME or CI path is touched:** `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts` from `src/mcp/vice`
- **Before `/gsd-verify-work`:** all three suites green with `VICE_REQUIRE_ACME=1`, typecheck clean, and `resources-sync.test.ts` green (no `resources/*.mjs` drift)
- **Max feedback latency:** 120 seconds per task command

---

## Per-Task Verification Map

Task IDs are assigned when `65-*-PLAN.md` lands. The planner MUST translate every row below
into at least one per-task row with a runnable `<automated>` command and its `<fails_when>`
sibling. Threat refs T-65-01..T-65-05 map to `65-RESEARCH.md` § Security Domain "Known Threat
Patterns", in table order.

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | SEAM-01 | — | Both the MCP-side callers (`ghidra-run.ts`, `dxa-run.ts`) and a skill script reach a real listener on an ephemeral port through `broker-endpoint.ts`; no second dial module exists. The census itself is MEASURED and recorded in phase evidence, never asserted on source text (64 D-18, `260914-poo` D-1) | integration (real listener) + evidence census | `node --test <host-tool-endpoint>.test.ts` + census transcript under `evidence/` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-02 | — | The ladder is unchanged, and the file it resolves on rung 3 EXECUTES from a package placed under a path segment literally named `node_modules` (D-14). A path-resolution test alone does not satisfy this row | integration (execution) | `node --test mcp-module.test.mjs` (path, existing) + a new execution case | ⚠️ path-only today — execution case ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | T-65-01, T-65-02 | One route regardless of `isInsideContainer()`: the same call against disjoint client and broker roots gives the same result, inputs cross as bytes (D-03/D-04), results land under the client's own `.c64-re-tools/<kind>/` (D-07) | integration (disjoint temp roots) | `node --test <host-tool-route>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | T-65-01 | Tree walk skips dot-prefixed entries and refuses by name a symlink whose REAL target leaves its tree (D-05) | unit (real fs, `mkdtempSync` fixtures) | `node --test <tree-walk>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | T-65-02 | A broker-supplied result name escaping the per-kind directory is REFUSED, not sanitised, by `validateContainedDestination()` — its first live producer (D-07, XFER-03) | unit + integration | `node --test transfer-paths.test.ts` (existing) + the new download path's test | ⚠️ validator exists — live wiring ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | T-65-03 | 16 MiB per file AND per request's upload aggregate, from the one `TRANSFER_MAX_BYTES` constant; the refusal names the limit (D-11) | unit (cap) | `node --test <host-tool-upload>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | T-65-04, T-65-05 | The session-free host-tool arm is answered ahead of the token gate, authorised only by a broker-minted handle; its wire vocabulary cannot shadow or be shadowed by the legacy token-gated `host_tool` op | unit (real listener, ephemeral port) | `node --test broker-control.test.ts` (extend) | ⚠️ extend, don't replace | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | — | `sourceDir` (D-06) and `outDir` / `-o` / `--out-dir` (D-08) are refused BY NAME, never silently dropped; `HOST_TOOL_ARG_KEYS` / `HOST_TOOL_PATH_ARG_KEYS` and `host-tool.test.ts`'s both-directions census move in the same change | unit | `node --test host-tool.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | — | Only declared results come back; broker-side scratch for the request is deleted when the request ends; the Ghidra project database never crosses the socket (D-09) | integration | `node --test <host-tool-results>.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | — | Every client-side deadline on the new route stays ordered above the server-side per-tool budget (`HOST_TOOL_REQUEST_TIMEOUT_MS` cross-seam ordering test, RESEARCH Pitfall 4) | unit | `node --test host-tool.test.ts` | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | SEAM-03 | — | With no broker running, each of the four affected skills refuses with ENDPOINT-04's existing wording (`describeDialFailure()` / `BROKER_START_COMMAND`); no second refusal text exists (D-02) | integration (no listener) | `node --test <skill-no-broker>.test.*` | ❌ W0 | ⬜ pending |
| TBD | TBD | TBD | RM-08 | — | CI's ACME tests pass with no call to `hostToolOverHostRoute()`: each suite starts its own compiled broker on an ephemeral port with a temp `VICE_BROKER_HOME`, and no process survives teardown even when a case fails (D-01) | integration (broker-per-suite harness) | `VICE_REQUIRE_ACME=1 node --test skill-acme-build-cli.test.ts` | ✅ rewrite harness | ⬜ pending |
| TBD | TBD | TBD | RM-08 | — | Under `VICE_REQUIRE_ACME`, a harness broker that fails to start is a FAIL, never a skip (D-01, `acme-gate.ts`) | unit | `node --test acme-gate.test.ts` or the harness's own test | ⚠️ confirm file | ⬜ pending |
| TBD | TBD | TBD | (folded, D-12/D-13) | — | `tools/list` no longer carries any `anno_*` tool; no skill claims a tool the server does not advertise; `vice-mcp anno <verb>` still answers with no VICE binary installed | unit + structural guard | `node --test stock-dispatch.test.ts` + the existing skill-tool-claim guard | ✅ extend | ⬜ pending |
| TBD | TBD | TBD | (folded todo) | — | `broker-e2e.test.ts` disconnect-while-queued polls the condition under test instead of sampling once after a fixed deadline | integration | `node --test broker-e2e.test.ts` | ✅ modify | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] An EXECUTION test for the ladder's rung-3 target (D-14): the package sits under a path segment literally named `node_modules`, because Phase 64's own route-agreement check missed the Node restriction by extracting into a directory with another name. CLAUDE.md's "Never call a package manager from code" binds this test too, so the planner must say how the test builds that tree
- [ ] A shared broker-per-suite harness for D-01 (start the compiled broker, point the child's `VICE_BROKER_CONTROL_PORT` at it, kill it in teardown, prove no survivor, fail rather than skip under `VICE_REQUIRE_ACME`) — no such helper exists today
- [ ] A disjoint-roots test for the collapsed single route (SEAM-03), with the container detector injected rather than detected
- [ ] A cross-seam ordering entry for any NEW client-side timeout the host-tool route introduces (RESEARCH Pitfall 4)

**Scratch-fixture rule (binding):** every fixture directory is a fresh `mkdtempSync` per test,
never a fixed path inside the repository tree. The suite already has three sites that race on
repo-tree scratch files, one of which leaks a gitignored directory and then fails
deterministically until it is deleted by hand. Do not add a fourth. `/tmp` on this host is a
16 GB tmpfs with aging disabled — clean up what you create.

**Live-broker rule (binding):** no test binds port 19510. A broker on 19510 deterministically
reddens at least one existing test (Phase 66's own cross-cutting note, cited by D-01).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| A skill script run inside a real container gives the same answer as the same run on the bare host | SEAM-03 | The automated proof injects the container detector and uses disjoint temp roots; a real container adds a real network namespace and a real missing bind mount, which a unit test cannot stand up | Start the broker on the host, run `acme.mjs` on the scaffold from inside a throwaway container that can reach the host bridge, run the same command on the host, compare the returned result paths' contents byte for byte, then stop the broker and remove the container |
| The four affected SKILL.md files read correctly to a model with no broker running | SEAM-03 (D-02) | The `description:` frontmatter is machine-read prose; its wording is judged, not computed | Read each changed `description:` and prerequisite line against CLAUDE.md "Machine-read prose": one instruction per sentence, active voice, no semicolons |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Every runnable `<automated>` command has a `<fails_when>` sibling naming an observable failure signal
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 120s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
