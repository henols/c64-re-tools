# 07 — Skills and workflows

## 1. Role of skills

Skills are the workflow/intelligence layer for an LLM harness.

They explain:

- what capability to use;
- when to use it;
- why it is useful;
- useful sequencing;
- how to interpret results;
- what project knowledge to read or write;
- when evidence is insufficient;
- when another skill owns the next step.

They do not replace deterministic implementation.

## 2. Three execution classes

Skills may use one of three execution paths.

### MCP-backed

Used when the job is stateful interaction with the live VICE machine.

```text
LLM
 ↓
skill
 ↓
MCP
 ↓
Host Runtime session
 ↓
one owned VICE instance
```

Example: `c64-emulator`.

### Broker-script-backed

Used for deterministic non-VICE native host tooling.

```text
LLM
 ↓
skill
 ↓
thin skill script
 ↓
shared runtime client
 ↓
Host Runtime
 ↓
native host tool
```

Examples include static analysis, assembly, disk inspection and BASIC decoding.

### Project-local

Used for project-owned state that does not belong on the host.

```text
LLM
 ↓
skill
 ↓
local skill/runtime code
 ↓
knowledge.db
```

Example: `c64-knowledge`.

The skills share one behavioral model even though their transport differs.

## 3. Binding rule

```text
Skill:
  HOW / WHEN / WHY / WHAT TO RECORD

Shared deterministic code:
  parsing / validation / staging / broker / database mechanics

Native tools:
  actual host execution
```

A skill script may orchestrate its operation, but must remain thin.

A skill must not independently implement:

- VICE monitor clients;
- Host Runtime transport;
- native host-tool process supervision;
- file-staging protocol;
- SQLite schema/revision logic;
- duplicated project-root/runtime discovery;
- its own copies of shared infrastructure.

## 4. Common SKILL.md structure

Every C64 skill should use the same section order where applicable:

```text
Purpose
Inputs
Tools / execution path
Workflow
Knowledge
Result
Failure and conflicts
Handoffs
```

### Purpose

State one clear responsibility and its boundary.

### Inputs

State what the skill needs before work can begin.

### Tools / execution path

State whether the skill uses:

- MCP;
- a broker-backed script;
- local project code;
- another skill as a handoff.

Do not expose infrastructure details the LLM cannot use.

### Workflow

Give the ordered reasoning/action steps.

### Knowledge

Specify:

- what current knowledge to read first;
- what may be automatically persisted;
- what may be persisted after LLM/user interpretation;
- what must not be stored.

### Result

Define what successful completion means.

### Failure and conflicts

Define when to stop, refuse, report a conflict or preserve uncertainty.

### Handoffs

State which skill owns the next job when the request leaves the current skill's scope.

## 5. Common skill lifecycle

All skills follow this lifecycle where applicable:

```text
establish context
      ↓
read relevant existing knowledge
      ↓
validate required input
      ↓
perform deterministic operation
      ↓
interpret structured result
      ↓
persist only durable knowledge according to policy
      ↓
report conflicts/uncertainty
      ↓
verify completion
      ↓
hand off when necessary
```

Not every skill uses every step. For example assembly normally has nothing to persist.

## 6. Script behavior

Skill scripts should behave consistently.

Normal script responsibilities:

- validate arguments;
- read required project files;
- read relevant knowledge when needed;
- invoke shared runtime APIs;
- receive and normalize deterministic results;
- invoke the local knowledge importer when appropriate;
- return one compact structured result.

The LLM must not be required to parse raw Ghidra, DXA, ACME, c1541, petcat or broker output.

Native-tool output is translated into stable C64-domain structures before reaching the skill.

Infrastructure compatibility/version handling is internal. Versions, request IDs, ports, PIDs, staging paths and similar details are not normal skill/LLM inputs or outputs.

## 7. Knowledge-first behavior

Reverse-engineering skills should not rediscover information already present in the project.

Before reasoning about an address/range, read relevant current knowledge.

For example:

```text
knowledge.at($2100)
      ↓
existing symbol/region/comments/references
      ↓
new investigation
```

Historical knowledge is consulted when current knowledge is surprising, contradictory or under review.

## 8. Persistence policy

Every skill must explicitly classify its outputs.

### Automatically persist

Use only for deterministic durable structural findings with well-defined import behavior.

Primary example:

- DXA/Ghidra structural findings imported through the local deterministic knowledge importer.

### Persist after interpretation

Use for semantic conclusions established by the LLM/user.

Examples:

- `FUN_2100` is actually `update_player`;
- a byte region is a sprite table;
- a routine comment describing application behavior.

### Do not persist

Examples:

- temporary memory reads;
- breakpoints;
- one-off screen captures;
- raw analyzer logs;
- compiler diagnostics;
- temporary staging paths;
- transient process state.

## 9. Conflict policy

All skills use the same conflict rule:

```text
new information agrees
    → proceed

new information fills a gap
    → add

new information is a justified semantic refinement
    → create a new knowledge revision

new information contradicts current knowledge
    → do not silently overwrite
    → report the conflict
    → inspect evidence/history
    → resolve deliberately
```

Analyzer-generated technical names never silently replace existing semantic names.

## 10. Facts versus interpretations

Skills must distinguish deterministic observations from semantic interpretation.

Examples:

```text
Observed runtime fact:
$2100 executed after joystick input.

Static structural fact:
$2100 contains code and calls $2300.

Semantic interpretation:
$2100 is update_player.
```

The first two can come from deterministic tools. The third is an LLM/user conclusion and should be recorded as semantic project knowledge only when justified.

No complex confidence model is required in v1.

## 11. Actionability boundary

Only expose information to the LLM when it can materially affect:

- reasoning;
- choice of next action;
- interpretation of a C64 result;
- resolution of a conflict;
- remediation the LLM/user can actually perform.

Do not expose implementation details that the LLM cannot use.

Normal skill results should hide:

- broker/protocol/package versions;
- database schema version;
- wire-format versions;
- TCP ports;
- request IDs;
- PIDs;
- temporary staging paths;
- raw host command lines;
- internal retry/parser/compatibility details.

An explicit human diagnostics path may expose infrastructure details for troubleshooting.

## 12. Reverse-engineering orchestration

The high-level reverse-engineering skill coordinates specialists but does not duplicate them.

A typical flow is:

```text
identify/load subject
  ↓
inspect container/BASIC/packing state
  ↓
run/trace in VICE where needed
  ↓
DXA first-pass structural analysis
  ↓
automatic compatible knowledge import
  ↓
LLM/runtime investigation
  ↓
semantic knowledge updates
  ↓
Ghidra deeper analysis seeded by current knowledge
  ↓
automatic compatible knowledge import
  ↓
review conflicts/history
  ↓
reconstruct source
  ↓
assemble
  ↓
functional verification
```

The orchestrator's job is to decide what needs to be learned next and which specialist skill owns that work.

## 13. Skill boundaries by intent

Skills are named for the user's job, not the executable used underneath.

Target catalogue:

```text
c64-reverse-engineering
c64-emulator
c64-static-analysis
c64-knowledge
c64-assembler
c64-testing
c64-disk
c64-basic
c64-unpacker
c64-memory-map
c64-provenance
```

Directional changes from the current catalogue:

- remove `c64-project`; project location/runtime infrastructure are not a workflow skill;
- replace `c64-annotations` with `c64-knowledge`;
- replace `c64-ram-capture` with the broader `c64-testing`;
- rename/reframe `c64-disassembler` as `c64-static-analysis`.

The final catalogue can still evolve if implementation proves a different boundary is cleaner.

## 14. Specialist responsibilities

### c64-reverse-engineering

Orchestrate the end-to-end reverse-engineering method and select the next specialist.

### c64-emulator

Operate/debug the live VICE machine through MCP.

### c64-static-analysis

Use DXA for fast first-pass structure and Ghidra for deeper static analysis. Broker-backed. Normalize results and automatically import durable compatible findings locally.

### c64-knowledge

Read/write current semantic knowledge and review history. Project-local; never broker-backed.

### c64-assembler

Assemble C64 source with ACME through a broker-backed script.

### c64-testing

Perform functional/regression/equivalence verification using emulator observations and comparison techniques. RAM capture is one technique, not the whole skill.

### c64-disk

Inspect/extract/analyse C64 disk images using host disk tooling.

### c64-basic

Decode BASIC V2 and determine relevant machine-code handoff.

### c64-unpacker

Detect packed/crunched software and obtain the post-decompression subject for analysis.

### c64-memory-map

Interpret C64/KERNAL/BASIC/hardware addresses and register-derived locations. Prefer deterministic lookup/decoding capability over carrying large static tables in the main skill instructions.

### c64-provenance

Specialized workflow for distinguishing original application bytes/behavior from cracker or release-specific modifications.

## 15. Handoff behavior

Every specialist skill should use concise handoffs.

Example:

```text
Need live execution           → c64-emulator
Need static structure         → c64-static-analysis
Need knowledge review/write   → c64-knowledge
Need rebuild                  → c64-assembler
Need behavior verification    → c64-testing
```

A specialist does not absorb another specialist's workflow just to avoid a handoff.

## 16. Completion conditions

Every skill defines what "done" means.

Examples:

- BASIC: requested code decoded and machine-code handoff identified where present;
- static analysis: requested pass completed, durable compatible findings imported, conflicts reported;
- knowledge: requested context/history returned or semantic change committed as one revision;
- assembler: requested source assembled or actionable source diagnostics returned;
- testing: requested scenario/equivalence assertion executed and result reported;
- reverse engineering: requested scope is sufficiently understood/documented, not necessarily the entire application.

This prevents open-ended investigation when the user's requested scope has already been satisfied.

## 17. Context efficiency

Keep each `SKILL.md` compact and operational.

Detailed domain guidance belongs in `references/` and should be loaded only when needed.

Avoid duplicating:

- shared runtime details;
- installation instructions;
- tool protocol documentation;
- large static reference tables;
- another skill's complete workflow.

The goal is for several C64 skills to coexist in one LLM context without unnecessary token cost.

## 18. Failure behavior

Skills should preserve uncertainty.

If evidence does not establish what a routine/data region does, record only what is justified.

If a required capability is unavailable, report the actionable C64/operation-level problem. Do not expose internal compatibility/version details unless a human explicitly enters diagnostic/troubleshooting mode.
