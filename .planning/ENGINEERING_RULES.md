# c64-re-tools Engineering Rules

## Purpose

This document defines the default engineering and verification policy for GSD plans in
`c64-re-tools`.

A plan is not complete because the implementation appears correct. It is complete when the claim
made by the plan has been verified at the appropriate evidence level.

## 1. Scope Discipline

- Implement only the requested plan or phase scope.
- Do not perform unrelated refactors while delivering a scoped change.
- Do not introduce speculative abstractions for possible future work.
- Prefer extending an existing stable seam over creating a new parallel one.
- If a change expands scope materially, record the scope change in planning artifacts before
  treating the extra work as part of the plan.

## 2. Read Before Change

Before modifying a subsystem:

- inspect its current implementation;
- inspect the relevant tests;
- inspect `.planning/PROJECT.md` constraints and decisions;
- inspect `.planning/ARCHITECTURE.md` when present;
- check for existing guards, generated artifacts, and external-oracle tests.

Do not re-derive a decision that planning context already records as settled unless new evidence
actually invalidates it.

## 3. TypeScript Quality

- Keep type checking green.
- Do not introduce `any` merely to suppress a type error.
- Avoid unsafe casts unless the boundary being crossed is documented and validated.
- Do not use `@ts-ignore` or equivalent suppression without a recorded reason.
- Preserve Node runtime/version assumptions already established by the project.

## 4. Dependency Policy

A new runtime dependency requires explicit justification covering:

1. why existing project code cannot reasonably provide the capability;
2. why the platform/runtime standard library is insufficient;
3. maintenance/activity status of the dependency;
4. install and packaging impact;
5. container/host boundary implications;
6. whether it changes the project's documented prerequisite story.

Dev-only dependencies should still be justified if they create a new mandatory local/CI toolchain.

## 5. Test Integrity

Never make verification green by weakening the verifier.

Do not:

- delete a failing test merely because implementation changed;
- weaken assertions to match broken behavior;
- replace an external oracle with a same-assumption fixture without documenting the reduced
  evidence level;
- convert a required failure into a skip just to make CI pass;
- silently broaden accepted outputs;
- make tests derive their expected value from the same live source that produced the input under
  test;
- hardcode a result solely to satisfy a test;
- disable lint/type/test gates to get a green run.

When a test itself is wrong, correct the test and preserve evidence that the corrected test can
actually fail.

## 6. Non-Vacuous Verification

Important guards must be observed failing under a planted violation before they are trusted as
proof of the protected property.

Examples:

- remove or corrupt a generated artifact and confirm the drift guard fails;
- break a required manifest entry and confirm package validation rejects it;
- feed an invalid architecture/path consumer and confirm the guard rejects it;
- corrupt an external-tool expectation and confirm the external oracle catches it.

A permanently-green test is not evidence.

## 7. Independent Oracle Rule

When correctness depends on an external system, protocol, emulator, assembler, package manager, or
runtime, verify against that system where practical.

Preferred evidence hierarchy:

```text
real external system / live end-to-end behavior
        >
independently-derived external oracle
        >
wire-shaped fixture captured from reality
        >
synthetic fixture
        >
same-pass mock / source-inspection assertion
```

Use the weakest level only when stronger evidence is unavailable, and state the ceiling honestly.

For this project, examples include:

- real stock VICE for binary-monitor behavior;
- real fork VICE for fork-only capabilities;
- real ACME for emitted assembly/reassembly claims;
- fresh containers/package installs for installation claims;
- real broker launch paths for lifecycle and argv claims;
- real regenerator2000 for static-analysis and bootstrap claims.

## 8. Evidence Ceilings

Do not claim more than the strongest available evidence supports.

Examples:

- a synthetic binary-monitor frame proves parser behavior, not real VICE behavior;
- a mocked package install proves command composition, not installability;
- source inspection proves code shape, not runtime behavior;
- a skipped live test is not a pass;
- a locally green test does not prove CI packaging/release behavior.

Record limitations in the plan/verification output rather than smoothing them away.

## 9. Live-Test Policy

Live tests that depend on installed external programs may remain outside the default fast test
suite, but plans touching their behavior must run the relevant live test deliberately.

If the environment cannot run the required live test:

- do not fabricate equivalence;
- use the strongest available lower-level evidence;
- record the missing witness explicitly;
- leave the claim at the lower evidence level.

## 10. Architecture Compliance

All implementation must respect `.planning/ARCHITECTURE.md`.

At minimum verify relevant invariants around:

- direct vs derived tool routing;
- backend capability honesty;
- stock binary-monitor request/event demultiplexing;
- one-client-per-emulator ownership;
- broker launch guard semantics;
- host/container path translation boundaries;
- generated documentation/source-of-truth drift;
- static-analysis backend separation from live VICE control.

If a plan requires an architecture exception, stop and record the architecture decision before
continuing.

## 11. Generated Artifacts

Generated files must not be hand-edited when a generator is authoritative.

When changing a generator:

1. update the generator/source of truth;
2. regenerate the artifact;
3. run the drift guard;
4. verify that the generated delta is expected.

Generated documentation should use scratch-generation plus byte-diff or an equivalent deterministic
drift check where practical.

## 12. Compatibility

For tools exposed on both backends:

- do not remove or rename existing parameters casually;
- do not make an optional parameter newly required without an explicit compatibility decision;
- preserve meaningful result semantics;
- update capability documentation when backend support changes.

For a capability that exists only on one backend, fail explicitly rather than pretending parity.

## 13. Protocol Changes

Any change to binary-monitor protocol handling must include evidence appropriate to the changed
assumption.

At minimum consider:

- framing;
- request-id correlation;
- unsolicited events;
- error bodies;
- little-endian decoding;
- memspace mapping;
- version-gated opcodes;
- limits/clamps;
- single-client behavior.

Do not change a settled wire fact based only on an internal refactor.

## 14. Broker / Process Safety

- Preserve evidence before killing a wedged/crashed emulator.
- Do not introduce an `await` into the ownership gap protected by the synchronous `inFlight` guard.
- Do not open extra monitor clients to a stock VICE instance.
- Keep per-instance configuration isolated from the operator's real VICE configuration when the
  broker owns the launch.

## 15. Security / Boundary Safety

- Host paths must use the established host/container boundary modules.
- Do not expose or log secrets.
- Do not widen emulator endpoint exposure as a side effect of unrelated work.
- Resource-setting functionality exposed to an LLM must continue to refuse known machine-state-
  destroying resources unless the project explicitly changes that policy.

## 16. Git Discipline

- Keep commits focused and explain the behavior changed.
- Avoid mixing unrelated cleanup into feature commits.
- Review the final diff for accidental changes, generated-file drift, and dependency changes.
- Do not force-push or rewrite shared history unless explicitly authorized.
- Do not merge/publish/release merely because implementation is complete; follow the repository's
  existing operator/release gates.

## 17. Required Verification Before Completion

Run the commands that exist in the repository for the affected surfaces. The exact script names may
change, so prefer repository-defined scripts over hardcoding assumptions in planning prose.

The minimum completion set is:

- type checking;
- automated test suite;
- relevant package/tarball validation;
- relevant generated-artifact drift checks;
- relevant architecture/guard tests;
- relevant live VICE tests for emulator-dependent claims;
- real ACME round-trip when assembly correctness is affected;
- real regenerator2000 run when static-analysis behavior is affected;
- final git diff review.

If CI adds additional mandatory gates, local completion does not supersede them.

## 18. Definition of Done

A plan may be marked complete only when all applicable items are true:

- [ ] Acceptance criteria are satisfied.
- [ ] Scope matches the approved plan.
- [ ] Type checking passes.
- [ ] Automated tests pass.
- [ ] Relevant architecture guards pass.
- [ ] Relevant generated-artifact checks pass.
- [ ] Relevant external-oracle/live tests pass, or the missing witness is explicitly recorded.
- [ ] No test was weakened merely to get green.
- [ ] No unrelated files changed.
- [ ] New dependencies, if any, are justified.
- [ ] Documentation is updated where user-visible behavior changed.
- [ ] Evidence level supports the wording of the completion claim.
- [ ] Final git diff has been reviewed.

## 19. GSD Completion Rule

GSD must not declare a plan, phase, or milestone complete solely from implementation success.
Verification is part of completion.

When a required check fails, GSD should:

1. investigate the failure;
2. determine whether implementation, expectation, or the verifier is wrong;
3. fix the root cause;
4. re-run the relevant evidence;
5. record any remaining limitation honestly.

## 20. GSD Execution Isolation

`workflow.use_worktrees` is **true** — the stock GSD default for a Claude runtime. It was
restored on 2026-08-29 (commit `001696d`) after an audit found the `false` value had been set
in `2277885` as a side change, and that the reasons recorded for it were either unverified or
were stock GSD behaviour misread as a local defect.

**Run phases with worktree isolation on.** Do not disable it project-wide, and do not add
blanket instructions that route around GSD's dispatch, cleanup, or synthesis machinery. If a
worktree run misbehaves, diagnose that run — a single bad run is not evidence that isolation is
unusable.

Three constraints are real, verified against the installed GSD source, and are **stock
behaviour rather than local policy**. Honour them; do not "fix" them by disabling isolation.

1. **Plans that deliver `.planning/STATE.md` or `.planning/ROADMAP.md` content must use the
   stock per-plan carve-out.** Worktree executors are forbidden to touch those files
   (`execute-phase.md`) and the commit protocol strips them in parallel mode
   (`execute-plan.md`), so such a plan would report success while delivering nothing. Set
   `USE_WORKTREES_FOR_PLAN=false` for that plan only, exactly as a submodule-touching plan
   gets — the per-plan worktree gate re-records the plan-scoped isolation sentinel itself.
   `REQUIREMENTS.md` is unaffected; it is on the committed allow-list.

2. **`cleanup-wave` refuses any branch whose diff contains a file deletion**, unconditionally
   (`worktree-safety.cjs`'s cleanup-wave deletion check; upstream records an opt-in as a deferred decision). A
   deletion plan's branch builds and commits correctly — merge it by hand.

3. **The per-plan gate owns the isolation sentinel.** Do not hand-force `--force-isolation`
   as a standing ritual; that was an artifact of the project-level opt-out and is now wrong.

**Nested headless sessions are not prohibited.** The prior blanket ban rested on a claim that a
nested `claude -p` cannot reach the API from a subagent, which was tested on 2026-08-29 and
refuted: it ran to completion in foreground and backgrounded dispatch, with no sandbox, seccomp,
or namespace restriction present. The genuine reasons to avoid delegating a live task are that
the executor already *is* the agent the plan expects, and that the VICE binary monitor serves
exactly one client, so concurrent drivers corrupt the evidence. Cite those, not a stall.

### 20.1 GSD is a vendored install — never committed, never depended on

`.claude/gsd-core/` and its sibling installed dirs (`agents/`, `commands/`, `hooks/`,
`scripts/`, `skills/`, the `gsd-*.json` manifests, `.gsd/`, `.agents/`, `.codex/`) are a
**vendored install**, gitignored as of 2026-08-29. Three consequences, all deliberate:

1. **`/gsd-update` may be run freely and the repo never changes as a result.** The tree is
   ~700 files / 12MB and 216 of them contain this machine's absolute checkout path, so it is
   not portable to CI, another machine, or another clone. Committing it would make every
   update a large diff of unusable-elsewhere content.

2. **Nothing in this repo may branch on whether GSD is installed.** CI and fresh clones have
   no GSD at all and that is a supported state, not a degraded one. Guards assert over tracked
   `.planning/` and `CLAUDE.md` only, run identically everywhere, and never skip. Do not add a
   test that skips when `gsd-core` is missing — such a test reports on the vendored tree rather
   than guarding this one.

3. **Local customisations to the install are not preserved by git.** They are reapplied
   idempotently by `node scripts/gsd-reapply-local.mjs`, wired as a SessionStart hook in
   `.claude/settings.json` so a `/gsd-update` revert self-heals at the start of the next
   session instead of failing mid-phase. Two are currently carried: the executor's
   `mcp__vice__*` tool grant plus `effort: high`, and the UAT abstention carve-out. Add any
   new customisation to that script or it will be silently lost.

For the same reason, **do not cite line numbers inside the vendored tree** in tracked prose.
Those numbers drift on every update and nothing can check them. Name the file and the semantic
anchor instead.
