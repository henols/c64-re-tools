# 09 — Build, test and release

## 1. Build philosophy

Implementation order is defined in [19 — Implementation plan](19-implementation-plan.md). Build vertically and require a real acceptance test at each architectural boundary rather than completing disconnected subsystems first.

The product is built from one repository and one npm package. There is no workspace-package graph in v1. `pnpm build` produces the CLI, MCP, Host Runtime and bundled skill artifacts described in [18 — Repository structure](18-repository-structure.md).


c64-re-tools is not a general project build system in v1.

The caller/skill provides explicit build inputs, for example:

```text
sourceRoot = src/
entrySource = main.a
```

The client stages the source root to the Host Runtime. The host runs the configured assembler and returns diagnostics/output.

Do not add `project.json` solely to remember one build entry point.

## 2. Initial assembler

ACME is the initial supported assembler because it is central to the C64 development and reverse-engineering workflow.

Additional assemblers should be added only when a concrete requirement exists. The domain API should avoid unnecessary ACME-specific leakage where a generic assembly concept is sufficient.

## 3. Functional equivalence

A reverse-engineered application need not produce the original bytes or addresses.

Correctness is behavioral:

```text
same relevant environment + same relevant inputs
                  ↓
       same externally observable behavior
```

Because universal equivalence cannot generally be proven, c64-re-tools supplies repeatable emulator tests/scenarios as evidence.

## 4. Functional test model

Testing is layered rather than based on one universal assertion mechanism:

```text
routine-level equivalence
        ↑
checkpointed machine-state behavior
        ↑
visual/gameplay scenarios
        ↑
human playtesting
```

A scenario has five conceptual parts:

```text
Setup
Actions
Checkpoint
Observations
Comparison
```

Checkpoint synchronization should use C64/emulator state rather than wall-clock sleeps wherever practical.

For original-vs-reconstruction tests, compare semantic symbols/behavior rather than assuming identical addresses. Original-side semantic locations come from project knowledge; rebuild-side locations can come from assembler/source symbols.

Visual comparison is first-class for games. Screenshots should be captured at verified checkpoints and may be paired with VIC-II/screen/sprite state so a visual mismatch can be diagnosed rather than merely counted.

Automated results are exactly:

```text
PASS
FAIL
INCONCLUSIVE
```

`INCONCLUSIVE` is used when a valid comparable state could not be established; infrastructure/setup failure is not a behavioral failure.

Human playtesting remains the final acceptance layer for control feel, animation quality, audio, progression and unanticipated behavior outside automated coverage.

The complete semantics are defined in [13 — Testing and functional equivalence](13-testing-and-functional-equivalence.md).

Exact scenario serialization remains intentionally deferred. Avoid designing a large scenario language before implementation experience demands it.

## 5. Test layers for the implementation

### Unit tests

Pure parsers, database invariants, protocol codecs, address/range handling and deterministic logic.

### Integration tests

- MCP adapter ↔ Application API;
- Application client ↔ Host Runtime protocol;
- host tool staging/execution;
- real SQLite transactions/migrations.

### Real VICE tests

Any claim depending on actual VICE behavior requires a real-emulator test path. Mocks are not sufficient evidence for monitor quirks or launch behavior.

### Packaging/install tests

Test installed artifacts from their real installation locations, not only repository-local execution. This guards against the class of defects the current project has already encountered where in-repo discovery masks packaging mistakes.

## 6. CI

CI should at minimum enforce:

- typecheck/build;
- deterministic unit/integration tests;
- package smoke tests from installed artifacts;
- knowledge DB schema/migration tests;
- protocol compatibility tests;
- representative host-tool tests where the tool is a required CI dependency;
- no generated-artifact drift if generated committed files still exist (prefer eliminating unnecessary committed build outputs in the rewrite).

Live graphical VICE tests may require an environment designed for them; when unavailable they must be named separately rather than silently counted as passed.

## 7. Release

Package/release automation should use standard ecosystem publishing mechanisms and provenance where available. Release tooling must not depend on repository-local paths that differ from installed layouts.
