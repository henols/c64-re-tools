# 10 — Current-code reuse strategy

## 1. This is not a migration

The new implementation is greenfield.

There is no requirement to preserve current:

- internal module boundaries;
- broker protocol;
- MCP tool names;
- CLI syntax;
- skill script structure;
- annotation database schema;
- build/generated-file mechanism;
- package internals.

The current implementation is an evidence source, not the architecture being transformed.

## 2. Reuse categories

For each current component, choose one of four outcomes:

### Reuse as-is

Only when code already fits the new boundary cleanly and carries sufficient tests.

### Adapt

Reuse algorithms/protocol knowledge while moving them behind the new architecture.

### Reimplement from evidence

Use current tests/behavior as the specification but write a cleaner implementation.

### Discard

Remove code whose purpose exists only because of current architectural complexity or obsolete distribution choices.

## 3. High-value evidence to preserve

The current repository contains important hard-won knowledge that should be systematically reviewed during implementation:

### VICE behavior

- binary monitor framing and request correlation;
- unsolicited events;
- text-monitor commands/parsing that provide functionality absent from the binary route;
- monitor contention behavior;
- launch argument quirks/order;
- startup/readiness timing;
- crash/wedge cases;
- stock VICE limitations.

### Process supervision

- child process groups;
- cleanup ordering;
- incident-before-kill discipline;
- lessons from abnormal broker termination/watchdog handling.

### Native host tools

- ACME invocation and real assembly gates;
- Ghidra headless integration and the custom NMOS 6502/6510 language covering all 105 undocumented opcode bytes;
- SLEIGH compile gates and full undocumented-opcode sweep tests;
- conservative userop treatment of electrically unstable undocumented instructions and JAM/KIL no-fallthrough behavior;
- dxa behavior/build requirements;
- c1541/petcat usage;
- tool-location/remediation knowledge.

### C64 analysis knowledge

- memory/register decoding;
- PRG/D64 parsing behavior;
- RAM capture/snapshot handling;
- code/data classification algorithms worth retaining;
- export/disassembly behavior that has real oracle tests.

### Packaging failures already discovered

Preserve tests/lessons that distinguish repository-local success from installed-package success.

## 4. Things likely to disappear

The new boundaries should eliminate or greatly simplify current mechanisms whose complexity exists because responsibilities are mixed, including examples such as:

- skill-owned implementation scripts;
- client-side direct knowledge of broker internals;
- duplicated project/release registries where explicit file inputs suffice;
- public exposure of host-tool staging mechanics;
- compatibility code required only by the current generated/runtime layout.

This list is directional, not a deletion checklist. Each item must be validated against actual implementation requirements.

## 5. Rewrite workflow

Recommended implementation order:

1. establish new package/repository skeleton alongside the current implementation;
2. implement Host Runtime protocol/session lifecycle;
3. implement VICE adapter behind the Host Runtime and validate against real VICE;
4. implement Application API machine/debug primitives;
5. implement minimal `knowledge.db` and knowledge API;
6. add host-tool staging and ACME;
7. add analysis tools one at a time as skills require them;
8. implement MCP adapter;
9. rewrite skills as workflow-only playbooks;
10. integrate existing skill/MCP package handlers and final installation UX;
11. port only tests that validate behavior still required by the new design, rewriting structural tests around the new architecture.

Do not create compatibility shims merely to allow old and new internals to coexist indefinitely.
