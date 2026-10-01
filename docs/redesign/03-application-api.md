# 03 — Application API

## 1. Purpose

The public integration surface is split by responsibility.

The MCP exposes only stateful operations against the live VICE machine owned by that MCP process.

Non-VICE deterministic operations are invoked through skill-owned scripts backed by shared runtime/application code.

Project knowledge is accessed locally through the knowledge component.

## 2. API design rules

1. Expose only C64-domain concepts to the LLM.
2. Keep stateful VICE primitives explicit in MCP.
3. Keep non-VICE native-tool operations out of MCP.
4. Keep knowledge operations local to the project environment.
5. Do not expose broker sockets, monitor commands, SQLite queries, host argv or staging paths.
6. Repetitive deterministic loops belong below the LLM.
7. Internal compatibility/version details stay below the LLM-facing boundary.

## 3. MCP: stateful VICE operations only

Representative operations:

```text
machine.status
machine.reset
machine.pause
machine.resume

machine.memory.read
machine.memory.write
machine.memory.search

machine.registers.read
machine.registers.write

machine.disk.attach
machine.autostart

machine.keyboard
machine.joystick

machine.screen.capture
machine.snapshot.save
machine.snapshot.restore

debug.step
debug.next
debug.continue
debug.runUntil

debug.breakpoint.add
debug.breakpoint.remove
debug.breakpoint.list

debug.watchpoint.add
debug.watchpoint.remove
debug.watchpoint.list

debug.history
debug.backtrace
```

The MCP never exposes which VICE monitor interface or command was used.

The public VICE surface also supports fixed per-session PAL/NTSC machine profiles, explicit c64/drive8 debugging spaces, deterministic frame advancement, temporary named visual baselines and an atomic composite observation operation for checkpoint testing. Project semantic symbols are resolved before MCP calls rather than managed inside the MCP. See [14 — VICE MCP surface](14-vice-mcp-surface.md).

It also does not expose DXA, Ghidra, ACME, c1541, petcat, SQLite or arbitrary Host Runtime calls.

## 4. Skill-script operations

Non-VICE work is owned by the relevant skill and implemented through thin deterministic scripts plus shared runtime/application code.

Representative capabilities:

```text
static analysis
  DXA first-pass disassembly
  Ghidra deeper analysis

build
  ACME assembly

disk
  c1541 inspection/extraction

BASIC
  petcat decoding

unpacking
  host-side unpack/decrunch operations as required
```

These scripts use typed short-lived Host Runtime requests when they need native host tools.

The LLM sees the C64-domain result, not the broker/tool execution details.

## 5. DXA and Ghidra

DXA is the fast first-pass disassembly and structural-discovery engine for an unknown binary.

Ghidra is the deeper static-analysis engine used when richer function, control-flow, cross-reference, data-flow and decompilation information is useful.

The normal relationship is:

```text
unknown application
      ↓
static-analysis skill
      ↓
DXA through Host Runtime
      ↓
normalized structural findings
      ↓
local automatic knowledge import
      ↓
knowledge.db
      ↓
LLM + VICE investigation
      ↓
semantic knowledge
      ↓
static-analysis skill reads current knowledge
      ↓
Ghidra through Host Runtime
      ↓
normalized structural findings
      ↓
local automatic knowledge import
      ↓
knowledge.db
```

DXA and Ghidra never open `knowledge.db`.

The static-analysis script normalizes their output. The local knowledge importer then persists only durable reusable findings in one revision/transaction.

Typical durable imports are:

- code/data regions;
- function starts/generated names;
- calls/jumps/reads/writes/references.

Full listings, raw logs, complete CFGs and decompiler text are not stored merely because they exist.

Automatic imports fill gaps and add compatible structure. They never silently overwrite conflicting semantic knowledge.

Current project knowledge is an input to later Ghidra analysis. Current routine symbols may seed entry points, known non-code regions may seed data ranges, and known names may seed labels where supported.

## 6. Knowledge operations

Knowledge is project-local and exposed through a local knowledge script/component rather than MCP.

Representative operations:

```text
knowledge.symbol.set
knowledge.symbol.remove
knowledge.symbol.get
knowledge.symbol.list

knowledge.region.set
knowledge.region.remove
knowledge.region.get
knowledge.region.list

knowledge.comment.set
knowledge.comment.remove
knowledge.comment.get
knowledge.comment.list

knowledge.reference.list
knowledge.search

knowledge.at
knowledge.history
knowledge.revisions
knowledge.revision
```

LLM/user edits create semantic knowledge revisions. For example, replacing Ghidra's generated `FUN_2100` with `update_player` creates a new current symbol while retaining the generated name in history.

The application assigns write origin from context; callers do not impersonate analyzer origins.

### Address-centric lookup

`knowledge.at(address)` returns the current useful context for an address:

- primary symbol;
- containing region;
- comments;
- incoming references;
- outgoing references.

### History

History operations expose prior values and the revision metadata that caused each change. They are used to diagnose bad analyzer imports, incorrect LLM conclusions, renames/reclassifications and later corrections.

### Analyzer import result

Analyzer imports return a compact result such as:

```text
inserted
unchanged
conflicts
```

Revision bookkeeping is internal unless revision identity is useful for later knowledge-history operations.

A conflict leaves contradictory current knowledge unchanged and reports the actionable conflict to the skill/LLM.

## 7. Build operations

Assembly is invoked by the assembler skill through its script, not through MCP.

Conceptual inputs:

```text
sourceRoot
entrySource
outputName/options where required
```

The script transfers the source root through shared runtime infrastructure and invokes ACME on the host.

The toolkit does not require a project-level build manifest in v1.

## 8. LLM-facing result design

The LLM sees only information it can use.

Useful examples:

```text
$2100 is a routine
$3000-$30ff conflicts with an existing sprite classification
Ghidra found incoming references to $2100
VICE state was lost
ACME reports an error at main.a:42
required static-analysis capability is unavailable
```

Normally hidden examples:

```text
broker protocol version
runtime/package version
database schema version
wire-format version
request ID
TCP port
PID
temporary staging path
raw native-tool argv
internal parser/retry details
```

An explicit human diagnostics path may expose infrastructure details for troubleshooting.

## 9. Explicitly excluded LLM-facing shapes

Do not expose operations such as:

```text
broker_connect
broker_stage_file
vice_binary_monitor_command
vice_text_monitor_command
host_tool_run
sqlite_query
select_vice_instance
reverse_engineer_application
understand_program
```

Infrastructure stays below the LLM-facing boundary. High-level reverse-engineering workflows remain in skills rather than deterministic tools.
