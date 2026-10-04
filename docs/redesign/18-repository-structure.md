# 18 — Repository structure

## 1. Goal

Keep the implementation easy to understand, build, test and release.

c64-re-tools is one repository and one npm package. Organize source by concrete ownership, not by architectural patterns.

Do not create a workspace/monorepo package graph unless a future concrete requirement proves independently versioned packages are necessary.

## 2. Frozen v1 layout

~~~text
c64-re-tools/
├── src/
│   ├── c64.ts
│   ├── project.ts
│   ├── protocol.ts
│   │
│   ├── mcp/
│   │   ├── main.ts
│   │   ├── server.ts
│   │   └── tools/
│   │       ├── machine.ts
│   │       ├── execution.ts
│   │       ├── debug.ts
│   │       ├── memory.ts
│   │       ├── video.ts
│   │       ├── input.ts
│   │       └── media.ts
│   │
│   ├── host-client/
│   │   ├── connect.ts
│   │   ├── vice-session.ts
│   │   ├── tools.ts
│   │   └── transfer.ts
│   │
│   ├── host/
│   │   ├── main.ts
│   │   ├── server.ts
│   │   ├── staging.ts
│   │   ├── processes.ts
│   │   ├── vice/
│   │   │   ├── session.ts
│   │   │   ├── process.ts
│   │   │   ├── adapter.ts
│   │   │   ├── binary-monitor.ts
│   │   │   ├── text-monitor.ts
│   │   │   └── screen.ts
│   │   └── tools/
│   │       ├── index.ts
│   │       ├── discover.ts
│   │       ├── acme.ts
│   │       ├── dxa.ts
│   │       ├── c1541.ts
│   │       ├── petcat.ts
│   │       └── ghidra/
│   │           ├── index.ts
│   │           ├── scripts/
│   │           └── language/
│   │
│   ├── knowledge/
│   │   ├── database.ts
│   │   ├── schema.ts
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── history.ts
│   │   └── import.ts
│   │
│   └── cli/
│       ├── main.ts
│       ├── host.ts
│       └── diagnose.ts
│
├── skills/
│   ├── c64-reverse-engineering/
│   ├── c64-emulator/
│   ├── c64-static-analysis/
│   ├── c64-knowledge/
│   ├── c64-assembler/
│   ├── c64-testing/
│   ├── c64-disk/
│   ├── c64-basic/
│   ├── c64-unpacker/
│   ├── c64-memory-map/
│   └── c64-provenance/
│
├── distribution/
│   └── plugin.ts
│
├── test/
│   ├── fixtures/
│   ├── integration/
│   └── e2e/
│
├── docs/
├── package.json
├── tsconfig.json
└── pnpm-lock.yaml
~~~

This is the intended starting structure. Do not pre-create empty files/directories merely to match the diagram; create them as their responsibility is implemented.

Do not add top-level packages/, vendor/, common/, core/ or shared/ directories in v1.

## 3. Shared leaf files

Only a few concepts genuinely belong to multiple owners.

### src/c64.ts

Keep small C64-wide primitives here:

- canonical $0000-$ffff address type/parser/formatter;
- address-range validation;
- byte/range helpers that are truly shared.

Do not turn this into a generic domain layer.

### src/project.ts

Project handling is deliberately tiny:

~~~text
projectRoot = process.cwd()
~~~

It owns:

- the harness working directory as project root;
- resolving project-relative paths;
- refusing absolute paths/project escape;
- safe file/tree checks before staging.

It does not discover projects, inspect Git or read harness-specific environment variables.

### src/protocol.ts

This is the one maintained private Host Runtime wire contract shared by host and host-client.

It owns:

- request/reply message types;
- VICE-session requests;
- native-tool request/result types;
- attachment metadata;
- framing/encoding rules;
- protocol validation needed on the private boundary.

Start with one file. Split into src/protocol/ only if real size/ownership pressure appears.

Protocol details never become an LLM-facing API.

## 4. MCP

src/mcp is only the stateful VICE MCP.

### main.ts

Executable entry point.

Its job is only to:

1. create one Host Runtime VICE-session connection;
2. start the MCP server;
3. close the Host Runtime session when the MCP process exits.

This preserves:

~~~text
1 MCP process = 1 Host Runtime VICE session = 1 VICE instance
~~~

### server.ts

Owns:

- MCP server creation;
- registration of tool groups;
- common MCP error/result translation.

It does not contain VICE monitor logic.

### tools/

Group the frozen public tools by C64 responsibility rather than one file per tool.

~~~text
machine.ts
  c64_status
  c64_reset
  c64_warp

execution.ts
  c64_execution
  c64_run_until

debug.ts
  c64_breakpoint
  c64_watchpoint
  c64_cpu_history
  c64_backtrace
  c64_profile
  c64_memmap
  c64_timing

memory.ts
  c64_memory_read
  c64_memory_write
  c64_memory_search
  c64_memory_compare
  c64_registers
  c64_disassemble

video.ts
  c64_vicii
  c64_sprite
  c64_cia
  c64_sid
  c64_screen
  c64_observe

input.ts
  c64_keyboard
  c64_joystick

media.ts
  c64_autostart
  c64_program_load
  c64_disk_attach
  c64_snapshot
~~~

Keep each tool's public input schema beside its handler in the owning group.

Do not create parallel schemas/, handlers/, commands/ and services/ trees for the same tools.

A handler validates public input, calls vice-session.ts and shapes the C64-domain result. Nothing more.

## 5. Host client

src/host-client is the only client implementation for the Host Runtime.

### connect.ts

Owns deterministic connection to the local/host Host Runtime endpoint and internal compatibility checks.

### vice-session.ts

Owns the long-lived stateful connection used by the MCP.

It exposes C64-domain operations corresponding to the private Host Runtime VICE request contract.

It does not expose VICE monitor commands, ports or process identifiers.

### tools.ts

Owns short-lived typed requests used by skill scripts:

~~~text
ACME
DXA
Ghidra
c1541
petcat
future unpacker tool
~~~

It exposes typed logical operations, never generic process execution.

### transfer.ts

Owns byte/tree upload/download and bounded attachment transfer.

It does not know which native tool will consume the bytes.

No skill implements another transport/staging client.

## 6. Host Runtime

src/host contains everything that must run on the host machine.

### main.ts

Host Runtime executable entry point.

### server.ts

Owns:

- private transport listener;
- connection/request dispatch;
- creation of VICE sessions for long-lived MCP connections;
- dispatch of independent native-tool requests;
- shutdown coordination.

### staging.ts

Owns request/session temporary workspaces and safe materialization of transferred files/trees.

All staging is outside the user's project.

### processes.ts

Owns child-process supervision:

- register child;
- terminate owned child/process group;
- bounded shutdown;
- cleanup after disconnected client/runtime termination.

There is one process-supervision implementation rather than separate ad hoc cleanup in every tool adapter.

## 7. Host Runtime VICE implementation

src/host/vice owns every VICE-specific implementation detail.

### session.ts

The central per-emulator stateful object.

It owns:

- the VICE process;
- binary/text monitor connections;
- serialized operation queue;
- breakpoints/watchpoints/session-local IDs;
- snapshots/visual baselines/session-local state;
- restart-after-crash behavior.

Nothing outside host/vice needs to know which monitor implements an operation.

### process.ts

Owns VICE launch, readiness, restart and termination.

### adapter.ts

Implements the private C64-machine operations requested by vice-session.ts.

It translates C64-domain operations into whichever VICE monitor mechanism is required.

This is where workarounds for VICE quirks belong.

### binary-monitor.ts

Owns binary-monitor framing, request/response correlation and decoding.

### text-monitor.ts

Owns text-monitor command/response interaction only for operations that genuinely require it.

Raw monitor syntax never escapes this file/adapter boundary.

### screen.ts

Owns canonical emulator-frame capture, baseline storage/comparison and diff production.

Desktop screenshots do not belong here.

## 8. Host Runtime native tools

src/host/tools contains the native-tool adapters.

### index.ts

A small typed dispatcher for the supported host-tool operations.

There is no generic executable/argv route.

### discover.ts

One shared host-tool discovery/configuration implementation.

ACME, DXA, Ghidra, c1541 and petcat are peers. None has special vendor status.

### acme.ts

Owns:

- ACME argv construction;
- execution;
- diagnostic parsing;
- symbol parsing;
- PRG/result validation.

Returns the frozen acme.assemble result.

### dxa.ts

Owns:

- DXA argv construction;
- temporary seed-file generation where DXA requires files;
- output parsing/validation;
- typed DXA result construction.

DXA is external like every other native tool.

### c1541.ts

Owns all five typed c1541 actions:

~~~text
directory
bam
entry
chain
read
~~~

### petcat.ts

Owns BASIC V2 decoding, decoded-output validation and SYS handoff extraction.

### ghidra/

Ghidra is the one adapter allowed a directory because structured headless analysis needs c64-re-tools-owned Ghidra integration scripts/assets.

~~~text
ghidra/
├── index.ts
└── scripts/
~~~

index.ts owns temporary Ghidra project creation, headless invocation, seed preparation and parsed typed results.

scripts/ contains only c64-re-tools-owned Ghidra scripts required to seed/export analysis.

language/ contains the c64-re-tools-owned NMOS 6502/6510 SLEIGH integration required for C64 analysis, including undocumented opcode support. It must cover all 105 undocumented opcode bytes in addition to the documented instruction set.

These files are product integration code, not vendored Ghidra.

The host installer/build materializes or installs this language against the user's external Ghidra installation. Do not copy Ghidra itself into the repository.

## 9. Knowledge

src/knowledge is the sole implementation allowed to understand the knowledge database.

### database.ts

Owns:

- .c64-re-tools/knowledge.db path;
- open/create;
- SQLite connection settings;
- transaction helper.

### schema.ts

Owns the schema and deterministic forward migrations.

### read.ts

Owns current-state operations such as:

~~~text
at(address)
search(...)
symbols(...)
regions(...)
references(...)
comments(...)
~~~

### write.ts

Owns semantic user/LLM mutations:

~~~text
rename symbol
classify/reclassify region
set/remove comment
add/remove structural reference
revert where implemented
~~~

Every accepted mutation creates a revision transaction.

### history.ts

Owns:

~~~text
history(address/entity)
revisions(...)
revision(id)
~~~

### import.ts

Owns deterministic analyzer reconciliation:

- validate complete normalized findings before mutation;
- coverage/category authority rules;
- same-analyzer retirement;
- semantic-knowledge protection;
- conflict reporting;
- one revision/transaction per accepted analyzer import.

DXA/Ghidra-specific parsers do not live here. They belong to their Host Runtime adapters/static-analysis skill adapter.

## 10. CLI and distribution

Keep the human CLI small.

### src/cli/main.ts

Parses top-level commands and delegates.

### src/cli/host.ts

Human-facing Host Runtime install/start/status/autostart operations.

### src/cli/diagnose.ts

Explicit human diagnostics. This is where internal paths/versions/configuration may be shown when useful.

Normal LLM-facing paths do not call it.

Cross-harness plugin installation remains in distribution/plugin.ts using AP SDK.

Only the CLI/distribution edge may depend on packaging APIs. MCP, Host Runtime, knowledge and skill workflow code do not.

## 11. Skills

Keep each skill as small as its job allows.

Recommended starting contents:

~~~text
c64-reverse-engineering
  SKILL.md
  references/...

c64-emulator
  SKILL.md
  references/...

c64-static-analysis
  SKILL.md
  scripts/analyze.ts
  references/...

c64-knowledge
  SKILL.md
  scripts/knowledge.ts

c64-assembler
  SKILL.md
  scripts/assemble.ts

c64-testing
  SKILL.md
  references/...

c64-disk
  SKILL.md
  scripts/disk.ts

c64-basic
  SKILL.md
  scripts/basic.ts

c64-unpacker
  SKILL.md
  scripts/unpack.ts
  references/...

c64-memory-map
  SKILL.md
  scripts/lookup.ts
  references/...

c64-provenance
  SKILL.md
  references/...
~~~

Do not add a script merely because every skill could have one.

Rules:

- orchestration/reasoning stays in SKILL.md;
- repeatable deterministic mechanics go in scripts/;
- detailed domain material goes in references/;
- assets/ exists only when a real skill output needs bundled assets.

Skill scripts import src/ through the "#src/*" subpath import, never through a relative path out of the skill.

An installed skill holds its scripts, a copy of the src/ modules they reach and a package.json that maps "#src/*" to that copy (D17 in docs/plan.md). It never resolves repository-relative src/ imports at runtime.

## 12. One npm package

Publish one product package, conceptually:

~~~text
@henols/c64-re-tools
~~~

Expose three executables, TypeScript entry points run by tsx (D17):

~~~text
c64-re-tools       → src/cli/main.ts
c64-re-tools-mcp   → src/mcp/main.ts
c64-re-tools-host  → src/host/main.ts
~~~

One package provides:

- one version;
- one release;
- one dependency graph;
- one provenance chain;
- no internal package synchronization.

## 13. Build

The build has three application entry points:

~~~text
src/cli/main.ts
src/mcp/main.ts
src/host/main.ts
~~~

and the skill script entry points that actually exist.

There is no build step and no dist/ (D17): Node runs these files by type stripping, and tsc only typechecks. Users run the programs through npx with @latest; under node_modules Node does not strip types, so the bins start with a tsx shebang.

Do not invent a runtime module loader for skills: the "#src/*" subpath import and Node's own resolution are enough.

## 14. Tests

Keep unit tests beside source:

~~~text
src/knowledge/import.ts
src/knowledge/import.test.ts

src/host/tools/acme.ts
src/host/tools/acme.test.ts
~~~

Use test/ for boundary-crossing tests and fixtures:

~~~text
test/
├── fixtures/
│   ├── asm/
│   ├── prg/
│   ├── d64/
│   ├── basic/
│   └── analysis/
│
├── integration/
│   ├── vice/
│   ├── acme/
│   ├── dxa/
│   ├── ghidra/
│   ├── c1541/
│   └── petcat/
│
└── e2e/
    ├── reverse-engineering/
    └── development/
~~~

Definitions:

- unit = one implementation unit, no external native tool;
- integration = real boundary or real native tool;
- e2e = complete installed product workflow.

## 15. Dependency rules

Allowed direction:

~~~text
src/c64.ts
src/project.ts
src/protocol.ts
       ↑
       ├──────── src/host-client
       │              ↑
       │              ├──── src/mcp
       │              └──── skill scripts
       │
       ├──────── src/host
       │
       └──────── src/knowledge (c64/project only)

skill scripts ──────── src/knowledge where required

src/cli/distribution edge ── installation/diagnostics only
~~~

More concretely:

- mcp may import host-client, protocol and c64;
- host-client may import protocol, c64 and project;
- host may import protocol and c64;
- knowledge may import c64 and project;
- skill scripts may import host-client/knowledge/project/c64 as their job requires;
- distribution may consume built artifacts;
- CLI may delegate to distribution/host diagnostics.

Prohibited:

- host → knowledge;
- mcp → knowledge;
- mcp → native-tool adapters;
- knowledge → host/host-client;
- host-client → knowledge;
- core implementation → skill implementation;
- one skill → another skill's scripts;
- native-tool adapter → project knowledge;
- AP SDK imports outside distribution/CLI installation edge.

## 16. File-size rule

Do not split code by pattern pre-emptively.

A file earns a split when it has two independently changing responsibilities or has become difficult to understand/test as one unit.

Do not automatically create:

~~~text
types.ts
interfaces.ts
models.ts
utils.ts
constants.ts
service.ts
repository.ts
factory.ts
manager.ts
~~~

for every feature.

Keep types/constants/helpers next to the code that owns them until multiple real consumers justify moving them.

## 17. External native tools

The repository contains integration adapters, not copies of external native tools.

Do not add:

~~~text
vendor/
third_party/
tools/bin/
~~~

for VICE, ACME, DXA, Ghidra, c1541 or petcat.

Treat them uniformly as Host Runtime prerequisites.

c64-re-tools-owned integration assets, such as required Ghidra analysis scripts, stay with the adapter that owns them and are not considered vendored third-party code.

## 18. Invariant

> One repository, one npm package, three executable entry points, a small ownership-based src/, first-class skills, colocated unit tests, external native tools, and no abstraction/package layer without a concrete reason.
