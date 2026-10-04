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

Harness-specific configuration belongs at the integration/installation edge only.

The MCP surface is intentionally narrow: it exposes only stateful operations against the live VICE machine owned by that MCP process.

Non-VICE operations such as static analysis, assembly, disk inspection, BASIC decoding and unpacking are invoked by skill-owned scripts that use the shared runtime/broker infrastructure.

Project knowledge is read and written locally in the project environment and does not pass through the Host Runtime.

## 5. Host/runtime separation

VICE and native C64 tools belong on the host machine because:

- VICE requires a graphical host environment (since D20 in docs/plan.md, VICE runs headless and needs the host's display only while the c64_window window is open);
- agent execution may be in a devcontainer or other headless environment;
- host tools should not need to be duplicated into every devcontainer;
- the host already owns tool installations such as VICE, ACME and Ghidra.

Therefore one Host Runtime per machine provides controlled access to VICE and native host tools.

There are two host-side interaction patterns:

```text
MCP process
   ↓ long-lived session connection
Host Runtime
   ↓
one owned VICE instance
```

and:

```text
skill script
   ↓ short-lived tool request
Host Runtime
   ↓
native host tool
```

A skill-script host-tool request does not own or select a VICE instance.

## 6. Session invariant

The following invariant is binding for the stateful emulator path:

```text
1 MCP process
      =
1 Host Runtime VICE session
      =
1 VICE instance
```

One Host Runtime may serve many such independent MCP sessions simultaneously, plus independent short-lived native-tool requests from skill scripts.

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
- how to interpret results;
- what durable knowledge should be read or written;
- when to hand off to another skill.

Skills may contain thin deterministic scripts for invoking their concrete operation.

Skill scripts may:

- validate inputs;
- read project files;
- read relevant project knowledge;
- invoke typed Host Runtime operations;
- normalize native-tool output;
- pass durable findings to the local knowledge importer;
- return compact structured results.

Skill scripts must not independently reimplement:

- VICE monitor clients;
- Host Runtime transport/staging internals;
- SQLite schema/revision logic;
- native tool implementations;
- duplicated broker/runtime infrastructure.

Shared deterministic infrastructure belongs in the runtime/application package.

## 9. Skill consistency requirements

All skills shall follow the same behavioral lifecycle where applicable:

```text
establish context
      ↓
read relevant existing knowledge
      ↓
validate input
      ↓
perform deterministic operation
      ↓
interpret result
      ↓
persist only durable knowledge according to policy
      ↓
report conflicts/uncertainty
      ↓
verify completion
      ↓
hand off when another skill owns the next job
```

Each skill shall define:

- its purpose and scope;
- required inputs;
- operations/tools/scripts it uses;
- ordered workflow;
- knowledge read/write policy;
- completion condition;
- conflict/failure behavior;
- handoffs to other skills.

Skill boundaries are based on user intent, not executable names. For example DXA and Ghidra belong to static analysis rather than separate tool-named skills.

## 10. Actionability boundary

Only information that can materially affect the LLM's reasoning, action selection or interpretation of a C64 result should be exposed to the LLM.

Implementation details that the LLM neither needs nor can act on must remain below the boundary.

Normally hidden details include:

- broker/protocol/package versions;
- database schema version;
- wire-format versions;
- TCP ports;
- request IDs;
- process IDs;
- temporary staging paths;
- raw native-tool command lines;
- internal retry/parser/compatibility details.

Internal failures are translated into domain-level or actionable operational failures before reaching the skill/LLM.

Detailed infrastructure diagnostics may be available to a human through an explicit troubleshooting/diagnostic path, but they are not part of normal skill context or normal operation results.

## 11. Project requirements

A project is simply the developer's ordinary project directory/repository.

The toolkit must not require a project manifest in v1.

The original application (for example `.prg`, `.d64` or `.crt`) remains wherever the developer stores it inside that project. Operations receive project-relative inputs explicitly where needed.

The only mandatory persistent toolkit-owned state is:

```text
.c64-re-tools/knowledge.db
```

Runtime/session/tool scratch data stays outside the project. `.c64-re-tools/` is reserved for durable project knowledge.

## 12. Knowledge requirements

The knowledge store shall represent durable understanding that has clear value to reverse engineering:

- symbols;
- classified address regions;
- comments;
- references between addresses;
- the revision history of that knowledge.

The database must preserve prior accepted values when knowledge changes. A rename, reclassification, correction or revert creates a new revision; it must not erase the earlier state.

History must be queryable so later sessions can determine what changed, when it changed, where it came from and why.

DXA and Ghidra findings that have durable structural value may be imported automatically by the local knowledge layer after a skill script receives normalized analyzer findings from the Host Runtime. Analyzer processes and the Host Runtime never open the project database.

LLM and user findings may add semantic names and interpretations that are more meaningful than generated analyzer names. These semantic edits are stored as new revisions, preserving the analyzer-derived history they supersede.

The schema must remain deliberately small. New tables/fields require a concrete feature requirement.

SQLite is the sole authoritative representation. The project shall not maintain synchronized JSON/JSONL mirrors.

## 12.1 Ghidra CPU-language requirements

Ghidra analysis for C64 software must use a dedicated NMOS 6502/6510 language that understands the complete 256-byte opcode space.

This includes:

- all 151 documented NMOS 6502 opcodes;
- all 105 undocumented opcode bytes used by real 6502/6510 software;
- correct instruction length/addressing mode for every opcode;
- p-code semantics for deterministic undocumented instruction families;
- no false fall-through after JAM/KIL instructions;
- conservative/opaque modeling for electrically unstable instructions whose exact result depends on analog/bus/chip behavior rather than inventing deterministic semantics;
- correct NMOS decimal-mode semantics for deterministic decimal-sensitive instructions rather than knowingly treating decimal mode as binary arithmetic.

The supported C64 Ghidra language is part of c64-re-tools integration behavior. Stock Ghidra 6502 decoding alone is insufficient when it leaves undocumented 6510 opcodes undefined.

The Ghidra integration must be regression-tested across all 105 undocumented opcode bytes.

## 13. Installation requirements

Installation of skills and MCP integrations shall use existing ecosystem package/configuration handlers. c64-re-tools shall not implement a competing general-purpose skills or MCP package manager.

A convenience installer may orchestrate existing handlers.

Any runtime/package compatibility handling is internal infrastructure and must not be exposed to the LLM during normal operation.

## 14. Reliability requirements

- Refuse rather than silently guess when a required input is ambiguous or missing.
- Never expose monitor protocol details to the agent-facing API.
- Never automatically retry a state-changing emulator operation after a VICE crash.
- Nothing the Host Runtime launches may intentionally outlive the request/session that owns it.
- Project writes must be transactional.
- A failed knowledge write must not leave a partially updated database or revision.
- Automatic analyzer imports must never silently overwrite conflicting current knowledge.
- Client and host must not assume they share the same filesystem paths.
- Skill scripts must return structured, bounded results rather than requiring the LLM to parse native-tool output.

## 15. Non-goals for v1

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
