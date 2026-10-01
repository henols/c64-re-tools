# 02 — Architecture

## 1. System view

```text
┌──────────────────────────────────────────────────────┐
│                 Agent / Developer                    │
│ Claude · Codex · Cursor · other harnesses           │
└───────────────┬────────────────┬─────────────────────┘
                │                │
           MCP tools        skill scripts
                │                │
                │                ├──────────────┐
                │                │              │
                ▼                ▼              ▼
           stateful VICE    Host Runtime    knowledge.db
              path          tool requests    project-local
                │                │
                ▼                ▼
              VICE        ACME/Ghidra/dxa/
                           c1541/petcat/...
```

The architecture intentionally exposes three different execution surfaces:

1. **MCP** for stateful interaction with the one live VICE machine owned by that MCP process.
2. **Skill-owned scripts** for deterministic non-VICE operations, using short-lived typed Host Runtime requests when a native host tool is required.
3. **Project-local knowledge access** for `knowledge.db`; knowledge never goes through the Host Runtime.

## 2. MCP boundary

The MCP is not a general gateway to all c64-re-tools functionality.

It exposes only operations that require or act on the live VICE session, such as:

- memory/register access;
- execution control;
- breakpoints/watchpoints;
- CPU history;
- keyboard/joystick input;
- screen/snapshot operations;
- attached media and other emulator state.

The MCP does not expose:

- DXA;
- Ghidra;
- ACME;
- c1541;
- petcat;
- arbitrary host tools;
- SQLite/knowledge operations;
- project build/analysis workflows.

This preserves the invariant that one MCP process owns exactly one VICE instance.

## 3. Skill-script boundary

Skills may contain thin deterministic scripts for their specific job.

Broker-backed skill scripts use shared runtime code to:

- validate input;
- read/stage project files;
- issue typed short-lived host-tool requests;
- receive structured native-tool results;
- normalize them into stable C64-domain results;
- invoke the local knowledge importer when durable findings should be persisted.

Examples:

```text
c64-static-analysis script → Host Runtime → DXA/Ghidra
c64-assembler script       → Host Runtime → ACME
c64-disk script            → Host Runtime → c1541
c64-basic script           → Host Runtime → petcat
```

Skill scripts do not each implement their own broker protocol, staging mechanism or process launcher. Those belong to shared runtime/application code.

## 4. Project knowledge boundary

`knowledge.db` belongs to the project environment.

Knowledge operations run locally:

```text
skill / local knowledge script
        ↓
knowledge component
        ↓
.c64-re-tools/knowledge.db
```

The Host Runtime and native analyzers never open, own or mutate the database.

Analyzer integration crosses the boundary as normalized findings:

```text
DXA / Ghidra
     ↓
Host Runtime
     ↓
static-analysis skill script
     ↓
normalized findings
     ↓
local deterministic knowledge importer
     ↓
knowledge.db
```

The reverse direction is also local-first:

```text
knowledge.db
     ↓
current symbols/regions
     ↓
static-analysis skill script
     ↓
analysis seed
     ↓
Host Runtime
     ↓
Ghidra
```

## 5. Host Runtime

The Host Runtime owns operations that must execute on the host:

- VICE process lifecycle;
- binary/text monitor connections;
- native host-tool execution;
- temporary host workspaces;
- file transfer/staging;
- process supervision.

It supports both:

- long-lived VICE session connections owned by MCP processes;
- short-lived independent native-tool requests from skill scripts.

A native-tool request does not select or inherit an MCP-owned VICE instance.

## 6. State ownership

### Project/client-owned

- source code;
- original application files;
- `knowledge.db`;
- developer-authored test/scenario files, if/when introduced.

### MCP/VICE-session-owned

- the one VICE process for that MCP;
- monitor connections;
- emulator execution state;
- temporary emulator-session resources.

### Host Runtime request-owned

- temporary staged files;
- native-tool subprocesses;
- transient tool results.

### Disposable/local

Caches, temporary captures and other recreatable material stay outside the project under Host Runtime, MCP-session or request-owned temporary storage. `.c64-re-tools/` is reserved for durable project knowledge.

## 7. Dependency direction

Dependencies flow toward stable C64 concepts:

```text
LLM / skill
   ├── MCP → VICE-session client → Host Runtime → VICE
   ├── skill script → shared runtime client → Host Runtime → native tools
   └── local knowledge component → SQLite
```

VICE monitor syntax, host tool argv, broker sockets, staging paths and SQLite statements remain implementation details.

## 8. Actionability boundary

The LLM-facing boundary contains only information that can affect C64 reasoning, action selection or result interpretation.

Expose examples such as:

- a routine/address classification;
- an analyzer conflict;
- a lost VICE state;
- an assembler source error;
- a missing required host capability;
- current/history knowledge needed to reason about the application.

Hide examples such as:

- protocol/package/schema versions;
- TCP ports;
- broker request IDs;
- PIDs;
- staging paths;
- raw host command lines;
- parser/retry/compatibility internals.

Infrastructure failures are translated into actionable domain/operation failures before reaching the LLM.

Detailed infrastructure diagnostics are available only through an explicit human troubleshooting path.

## 9. Session ownership

A long-lived Host Runtime VICE session owns exactly one emulator.

```text
MCP A ─ connection A ─ VICE A
MCP B ─ connection B ─ VICE B
MCP C ─ connection C ─ VICE C
```

The connection is the ownership boundary. A client-visible emulator selector is unnecessary and prohibited in v1.

Short-lived host-tool requests are independent of these connections.

## 10. Error philosophy

Errors must preserve architectural truth while respecting the actionability boundary.

Examples:

- no Host Runtime: report that the required host service cannot be reached and the operation cannot continue;
- internal compatibility mismatch: report an incompatible/incomplete installation, without exposing irrelevant version details to the LLM;
- VICE startup failure: session creation fails;
- VICE crash: current operation fails and reports that state was lost;
- missing host tool: report the missing capability/tool with actionable remediation;
- stale knowledge revision: write is refused without modification.

No layer should translate a structural failure into a plausible successful result.

## 11. No compatibility architecture

The new architecture is not constrained by current internal APIs. Compatibility shims are added only if a future concrete distribution requirement justifies them; they are not part of this design baseline.

## 12. Repository implementation shape

The greenfield implementation uses one repository and one npm package with a small flat `src/` organized by ownership (`mcp`, `host`, `host-client`, `knowledge`, `cli`) plus first-class `skills/`. See [18 — Repository structure](18-repository-structure.md).
