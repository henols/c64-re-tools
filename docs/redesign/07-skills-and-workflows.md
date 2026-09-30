# 07 — Skills and workflows

## 1. Role of skills

Skills are the workflow/intelligence layer for an LLM harness.

They explain:

- what capability to use;
- when to use it;
- why it is useful;
- useful sequencing;
- how to interpret results;
- when evidence is insufficient.

They do not implement the underlying capability.

## 2. Binding rule

```text
Skill:
  HOW / WHEN / WHY

Application/tooling:
  WHAT actually happens
```

A skill must not contain its own:

- PRG/D64 parser;
- memory-diff engine;
- annotation/knowledge store implementation;
- VICE monitor client;
- host-tool launcher;
- filesystem staging protocol;
- duplicated project-root resolver when the integration already has one.

## 3. Reverse-engineering workflow

A reverse-engineering skill may guide an agent through steps such as:

```text
identify/load subject
  ↓
inspect BASIC/entry path
  ↓
trace execution
  ↓
disassemble relevant ranges
  ↓
classify regions
  ↓
name routines/data
  ↓
record comments
  ↓
reconstruct source
  ↓
build
  ↓
compare behavior
```

The skill invokes deterministic MCP operations for each concrete action.

## 4. Development workflow

Development skills may guide:

```text
edit source
  ↓
assemble
  ↓
autostart/load
  ↓
set breakpoints/watchpoints
  ↓
inspect memory/registers/screen
  ↓
run tests/scenarios
```

The same machine/debug/build tools are shared with reverse engineering.

## 5. Skill composition

Prefer focused skills with clear responsibilities rather than one enormous C64 skill. A high-level reverse-engineering skill may reference focused skills/capabilities, but the implementation logic remains in the tool layer.

The exact skill catalogue can evolve during implementation. The architecture does not bind the project to the current twelve-skill split.

## 6. Long repetitive work

Skills should request higher-level deterministic operations when repetition would otherwise force the LLM to perform large loops of tiny calls.

Bad pattern:

```text
LLM: step → read → step → read → step → read ... thousands of times
```

Preferred pattern:

```text
LLM: request bounded trace/compare operation
Tool: performs deterministic loop
Tool: returns compact result
LLM: reasons about result
```

## 7. Refuse rather than invent

Skills should preserve uncertainty. If evidence does not establish what a routine/data region does, the workflow records only what is justified rather than manufacturing a confident label or explanation.
