# 09 — Build, test and release

## 1. Build philosophy

c64-re-tools is not a general project build system in v1.

The caller/skill provides explicit build inputs, for example:

```text
sourceRoot = src/
entrySource = main.a
```

The client stages the source root to the Host Runtime. The host runs the configured assembler and returns diagnostics/output.

Do not add `project.json` solely to remember one build entry point.

## 2. Initial assembler

ACME is the initial supported assembler because it is already central to the current project and reverse-engineering workflow.

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

## 4. Functional test primitive

A test/scenario conceptually performs:

```text
start from known machine/program state
        ↓
perform deterministic inputs/actions
        ↓
run/wait for deterministic condition
        ↓
inspect observable state
        ↓
assert expected behavior
```

Possible observations include, where appropriate:

- memory values/ranges;
- registers/PC state;
- reached/not-reached execution locations;
- screen state/capture;
- VIC/CIA-visible state;
- keyboard/joystick-driven behavior;
- disk-visible behavior;
- timing boundaries when behavior depends on timing;
- no JAM/crash/unexpected stop.

The same mechanism supports:

- reverse-engineering characterization of the original;
- verification of reconstructed source;
- regression testing of new C64 development.

Exact scenario file format is intentionally deferred until implementation of the test API. Avoid designing a large scenario language before concrete tests demand it.

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
