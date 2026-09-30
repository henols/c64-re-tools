# 03 — Application API

## 1. Purpose

The Application API is the C64-centric contract used by MCP, CLI and automated tests. It exposes deterministic operations, not reverse-engineering workflows.

Skills combine these operations into workflows.

## 2. API design rules

1. Prefer one meaningful developer action per operation.
2. Keep frequent emulator primitives explicit.
3. Group CRUD-like actions only where they are naturally one concept.
4. Do not create giant generic dispatchers.
5. Do not expose implementation details such as monitor commands, broker file handles, SQLite queries or raw host argv.
6. Repetitive deterministic loops belong in the implementation, not in the LLM.

The final MCP surface should remain moderate in size (roughly tens of tools, not hundreds).

## 3. Machine operations

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
```

The public operation never states whether the implementation used the VICE binary or text monitor.

## 4. Debug operations

Representative operations:

```text
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

Where one operation supports a small natural action family, the MCP adapter may expose a grouped tool (for example breakpoint `add|remove|list`) rather than three near-identical MCP schemas.

## 5. Analysis operations

Analysis operations remain deterministic and bounded. Representative examples:

```text
analysis.disassemble
analysis.memory.compare
analysis.disk.inspect
analysis.basic.decode
analysis.staticAnalyze
analysis.trace
```

`analysis.disassemble` and `analysis.staticAnalyze` are deliberately different operations, not interchangeable engines behind one generic analyzer.

### DXA and Ghidra

DXA is the fast first-pass disassembly and structural-discovery engine for an unknown binary. It backs `analysis.disassemble` / `c64_disassemble` and is used to obtain a quick 6502 listing, code/data candidates and initial structural information.

Ghidra is the deeper static-analysis engine. It backs `analysis.staticAnalyze` / `c64_static_analyze` and is used when richer function, control-flow, cross-reference, data-flow and decompilation information is useful.

The normal relationship is:

```text
unknown application
      ↓
     DXA
fast structural discovery
      ↓
automatic import of compatible structural knowledge
      ↓
knowledge.db
      ↓
LLM + VICE investigation
      ↓
semantic knowledge
      ↓
Ghidra seeded by current knowledge
      ↓
automatic import of compatible structural knowledge
      ↓
knowledge.db
```

DXA and Ghidra themselves never open `knowledge.db`. They return structured findings to the Application API.

The Application analysis layer may automatically import durable findings through the knowledge layer in one revision/transaction. Typical durable imports are code/data ranges, function starts/generated names and references. Full listings, raw logs, complete CFGs and decompiler text are not copied into the database merely because they exist.

Automatic imports fill gaps and add compatible structure. They never silently overwrite conflicting semantic knowledge.

Current project knowledge is also an input to later analysis. For Ghidra, current routine symbols can seed entry points, known non-code regions can seed data ranges, and known names can seed labels where supported.

Do not normalize DXA and Ghidra into an `engine=` switch on one operation merely because both perform static analysis. Their roles and result semantics are different.

## 6. Knowledge operations

The knowledge API exposes current knowledge, semantic edits, analyzer imports and reviewable history.

### Current-state CRUD

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
```

LLM/user edits create semantic knowledge revisions. For example, replacing Ghidra's generated `FUN_2100` with `update_player` creates a new current symbol while retaining the generated name in history.

The application assigns the write origin from caller/context (`user`, `llm`, `dxa`, `ghidra`); callers do not impersonate analyzer origins.

### Address-centric lookup

```text
knowledge.at(address)
```

returns the current useful context for an address, including:

- primary symbol;
- containing region;
- comments;
- incoming references;
- outgoing references.

### History

```text
knowledge.history(address)
knowledge.history(entity)
knowledge.revisions(...)
knowledge.revision(id)
```

History operations expose prior values and the revision metadata that caused each change. They are used to diagnose bad analyzer imports, incorrect LLM conclusions, renames/reclassifications and later corrections.

### Analyzer import result

Analysis operations that persist findings return a summary such as:

```text
revision
inserted
unchanged
conflicts
```

A conflict leaves the contradictory current knowledge unchanged and reports it for the skill/LLM to investigate.

All writes support transactional revision checks so stale concurrent modifications can be refused.

## 7. Build operations

The first supported build primitive is explicit assembly rather than a project build system:

```text
build.assemble
```

Conceptual inputs:

```text
sourceRoot
entrySource
outputName/options where required
```

The implementation transfers the source root to the Host Runtime and runs the configured host assembler there.

The toolkit does not require a project-level build manifest in v1.

## 8. MCP mapping

The MCP adapter exposes a practical subset of the Application API using clear C64-oriented names. Representative shape:

```text
c64_status
c64_reset
c64_memory_read
c64_memory_write
c64_memory_search
c64_registers
c64_screen
c64_snapshot
c64_disk_attach
c64_keyboard
c64_joystick

c64_execution
c64_breakpoint
c64_watchpoint
c64_cpu_history

c64_disassemble
c64_memory_compare
c64_disk_inspect
c64_basic_decode
c64_static_analyze

c64_symbol
c64_region
c64_comment
c64_knowledge_at
c64_knowledge_search
c64_knowledge_history

c64_assemble
```

This list is a design target, not a frozen schema. Exact names/arguments are settled during implementation while preserving the boundaries above.

## 9. Explicitly excluded API shapes

The agent-facing API must not contain operations such as:

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

The first group leaks infrastructure. The final group incorrectly embeds workflows/reasoning into deterministic tools.
