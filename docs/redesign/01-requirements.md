# 01 — Requirements

## 1. Purpose

c64-re-tools shall provide tools for reverse engineering unknown Commodore 64 applications and for developing new C64 software. Reverse engineering is the primary use case, but the underlying machine, debugging, build and test operations must be equally useful during normal development.

## 2. Primary workflows

### Reverse engineering

```text
unknown C64 application
        ↓
run / inspect / trace
        ↓
record durable knowledge
        ↓
reconstruct maintainable source
        ↓
build
        ↓
verify behavior against the original
```

### Development

```text
source
  ↓
build
  ↓
run in VICE
  ↓
debug / inspect
  ↓
test
  ↓
modify
```

The implementation must not create separate architectures for these workflows. They share the same machine, debugging, knowledge, build and test capabilities.

## 3. Functional equivalence

A reconstructed application is correct when, for the behavior being compared, the original and reconstructed applications exhibit the same externally observable behavior under the same relevant machine environment and inputs.

Byte-identical output is **not** required.

Externally observable behavior may include, where relevant:

- screen and graphics behavior;
- sound behavior;
- keyboard and joystick response;
- application/game logic;
- disk behavior;
- important memory-visible state;
- control-flow outcomes;
- timing where timing affects behavior.

c64-re-tools does not claim to mathematically prove equivalence for arbitrary programs. It supplies deterministic emulator operations and repeatable tests that provide evidence.

## 4. Harness independence

No core C64 capability may depend on Claude Code, Codex, Cursor or another specific harness.

Supported integrations may expose the same Application API through:

- MCP;
- CLI;
- automated tests;
- future integrations.

Harness-specific configuration belongs at the integration/installation edge only.

## 5. Host/runtime separation

VICE and native C64 tools belong on the host machine because:

- VICE requires a graphical host environment;
- agent execution may be in a devcontainer or other headless environment;
- host tools should not need to be duplicated into every devcontainer;
- the host already owns tool installations such as VICE, ACME and Ghidra.

Therefore one Host Runtime per machine provides controlled access to VICE and native host tools.

## 6. Session invariant

The following invariant is binding:

```text
1 MCP process
      =
1 Host Runtime connection/session
      =
1 VICE instance
```

One Host Runtime may serve many such independent sessions simultaneously.

An MCP process does not switch between emulator instances during its lifetime.

## 7. Supported capability set

There is one supported capability set for a compatible c64-re-tools installation.

The system does not negotiate a reduced feature matrix. If a required VICE interface or required host-side function cannot be established, session creation or the affected operation fails clearly and actionably.

Operations that stock VICE fundamentally cannot provide are simply not part of the supported API.

## 8. Skills versus implementation

Skills contain workflow knowledge:

- when to use a capability;
- why to use it;
- useful sequencing;
- how to interpret results.

Skills must not implement parsers, address calculations, database behavior, VICE protocol handling, process management, file staging or duplicated project discovery.

Deterministic/repetitive work belongs in tools/application code.

## 9. Project requirements

A project is simply the developer's ordinary project directory/repository.

The toolkit must not require a project manifest in v1.

The original application (for example `.prg`, `.d64` or `.crt`) remains wherever the developer stores it inside that project. Operations receive project-relative inputs explicitly where needed.

The only mandatory persistent toolkit-owned state is:

```text
.c64-re-tools/knowledge.db
```

Machine-local and disposable data may live under:

```text
.c64-re-tools/local/
```

and must not be authoritative project knowledge.

## 10. Knowledge requirements

The knowledge store shall represent durable understanding that has clear value to reverse engineering:

- symbols;
- classified address regions;
- comments;
- references between addresses;
- the revision history of that knowledge.

The database must preserve prior accepted values when knowledge changes. A rename, reclassification, correction or revert creates a new revision; it must not erase the earlier state.

History must be queryable through the application API so later sessions can determine what changed, when it changed, where it came from and why.

DXA and Ghidra findings that have durable structural value may be imported automatically by the application layer. Analyzer processes themselves never open the project database.

LLM and user findings may add semantic names and interpretations that are more meaningful than generated analyzer names. These semantic edits are stored as new revisions, preserving the analyzer-derived history they supersede.

The schema must remain deliberately small. New tables/fields require a concrete feature requirement.

SQLite is the sole authoritative representation. The project shall not maintain synchronized JSON/JSONL mirrors.

## 11. Installation requirements

Installation of skills and MCP integrations shall use existing ecosystem package/configuration handlers. c64-re-tools shall not implement a competing general-purpose skills or MCP package manager.

A convenience installer may orchestrate existing handlers.

## 12. Reliability requirements

- Refuse rather than silently guess when a required input is ambiguous or missing.
- Never expose monitor protocol details to the agent-facing API.
- Never automatically retry a state-changing emulator operation after a VICE crash.
- Nothing the Host Runtime launches may intentionally outlive the Host Runtime/session that owns it.
- Project writes must be transactional.
- A failed knowledge write must not leave a partially updated database or revision.
- Automatic analyzer imports must never silently overwrite conflicting current knowledge.
- Client and host must not assume they share the same filesystem paths.

## 13. Non-goals for v1

The redesign does not initially require:

- an emulator plugin framework;
- capability negotiation;
- multiple VICE instances per MCP process;
- a project manifest/build manifest;
- a generalized knowledge graph;
- generalized event sourcing of every runtime/tool event;
- storage of every analysis observation or raw analyzer output;
- formal proof of program equivalence;
- byte-identical reconstructed binaries;
- compatibility with current MCP tool names or database schema;
- an in-place migration path from the current architecture.
