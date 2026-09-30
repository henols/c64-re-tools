# 02 — Architecture

## 1. System view

```text
┌──────────────────────────────────────────────────────┐
│                 Agent / Developer                    │
│ Claude · Codex · Cursor · other harnesses · CLI     │
└────────────────────────┬─────────────────────────────┘
                         │
                  MCP / CLI adapter
                         │
┌────────────────────────▼─────────────────────────────┐
│                  Application API                     │
│ machine · debug · analysis · knowledge · build      │
└───────────────┬───────────────────────┬──────────────┘
                │                       │
                │                       └── knowledge.db
                │
          Host Runtime protocol
                │
┌───────────────▼──────────────────────────────────────┐
│                    Host Runtime                      │
│ session ownership · VICE lifecycle · host tools     │
│ file staging · process supervision                  │
└───────────────┬───────────────────────┬──────────────┘
                │                       │
              VICE               ACME/Ghidra/dxa/
                                  c1541/petcat/...
```

## 2. Layer responsibilities

### Integration layer

Contains MCP and CLI adapters. It translates harness/user requests into Application API operations and translates results/errors back.

It does not:

- parse VICE monitor replies;
- manage emulator processes;
- open the knowledge database directly except through the knowledge application component;
- spawn native C64 tools directly.

### Application layer

Contains C64-centric deterministic operations. It is the stable conceptual boundary used by MCP, CLI and tests.

It speaks in concepts such as:

- memory;
- registers;
- execution;
- breakpoints;
- disassembly;
- symbols;
- regions;
- assembly.

It does not expose broker sockets, monitor opcodes, SQLite queries or temporary host paths.

### Host Runtime

Owns operations that must execute on the host:

- VICE process lifecycle;
- binary/text monitor connections;
- native host-tool execution;
- temporary host workspaces;
- file transfer/staging;
- process supervision.

### Project knowledge

`knowledge.db` belongs to the project and remains on the client/project side. The Host Runtime never owns or loads project knowledge.

This separates **execution state** from **knowledge state**.

## 3. Dependency direction

Dependencies flow inward toward stable C64 concepts:

```text
MCP/CLI
   ↓
Application API
   ↓
Host Runtime client / Knowledge store
   ↓
Host protocol / SQLite
   ↓
VICE / native tools
```

VICE monitor syntax and host tool command lines are implementation details at the bottom of the dependency graph.

## 4. Session ownership

A long-lived Host Runtime connection owns exactly one emulator session.

```text
MCP A ─ connection A ─ VICE A
MCP B ─ connection B ─ VICE B
MCP C ─ connection C ─ VICE C
```

The connection is the ownership boundary. A client-visible emulator selector is unnecessary and prohibited in v1.

## 5. State ownership

### Project/client-owned

- source code;
- original application files;
- `knowledge.db`;
- developer-authored test/scenario files, if/when introduced.

### Host Runtime-owned

- VICE processes;
- monitor connections;
- process IDs/groups;
- temporary staged files;
- native tool subprocesses;
- transient session state.

### Disposable/local

Caches, temporary captures and other recreatable material may live under `.c64-re-tools/local/`.

## 6. Error philosophy

Errors must preserve architectural truth.

Examples:

- no Host Runtime: say the Host Runtime cannot be reached;
- incompatible protocol: say versions are incompatible;
- VICE startup failure: session creation fails;
- VICE crash: current operation fails and reports that state was lost;
- missing host tool: tool operation fails by tool name and remediation;
- stale knowledge revision: write is refused without modification.

No layer should translate a structural failure into a plausible successful result.

## 7. No compatibility architecture

The new architecture is not constrained by current internal APIs. Compatibility shims are added only if a future concrete distribution requirement justifies them; they are not part of this design baseline.
