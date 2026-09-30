# 11 — Skill contracts

## 1. Purpose

This document fixes the intended responsibility and operating contract of each first-class C64 skill.

Every skill follows the common structure defined in 07 — Skills and workflows:

~~~text
Purpose
Inputs
Tools / execution path
Workflow
Knowledge
Result
Failure and conflicts
Handoffs
~~~

The contracts describe what the LLM needs to know and do. Broker, package, protocol, schema and other implementation details remain below the actionability boundary.

## 2. Common rules

All skills follow these rules:

1. Read relevant existing knowledge before rediscovering known information.
2. Use deterministic scripts/tools for repeatable mechanics.
3. Never make the LLM parse raw native-tool output.
4. Persist only durable project knowledge.
5. Never silently overwrite contradictory current knowledge.
6. Preserve uncertainty when evidence is insufficient.
7. Stop when the requested scope is complete.
8. Hand work to the specialist that owns the next job instead of duplicating its workflow.

## 3. Contract summary

| Skill | Primary execution | Automatic knowledge write | Main result |
|---|---|---|---|
| c64-reverse-engineering | orchestrates other skills | none directly | requested RE scope understood/documented |
| c64-emulator | MCP / live VICE | none | runtime evidence/state |
| c64-static-analysis | broker-backed script | analyzer structural findings | structural analysis + conflicts |
| c64-knowledge | project-local | explicit requested writes | current/history knowledge or committed semantic change |
| c64-assembler | broker-backed script | none | PRG/artifacts or actionable diagnostics |
| c64-testing | MCP + local comparison helpers | none | pass/fail/inconclusive evidence |
| c64-disk | broker-backed script | none | disk structure/extracted content |
| c64-basic | broker-backed/local deterministic decode | none | BASIC listing + handoff address |
| c64-unpacker | broker-backed detection + MCP when runtime depack is needed | none | unpacked subject/artifact |
| c64-memory-map | local deterministic lookup/decoder | none | C64 address/register meaning |
| c64-provenance | local/broker-backed comparison as required | none | release/origin comparison result |

## 4. c64-reverse-engineering

### Purpose

Coordinate reverse engineering of an unknown C64 application. Decide what needs to be learned next and which specialist skill owns that work.

It does not reimplement specialist procedures.

### Inputs

- subject file/path or already-running subject;
- requested scope, question or completion target;
- existing project knowledge.

The requested scope may be narrow, for example:

~~~text
identify the main loop
understand $2100
find the IRQ handler
reconstruct the input system
reverse engineer the whole application
~~~

### Tools / execution path

Orchestrates the specialist skills. It has no reason to talk directly to the Host Runtime.

### Workflow

~~~text
establish requested scope
    ↓
read existing knowledge
    ↓
identify next unknown/blocker
    ↓
select specialist
    ↓
interpret result/evidence
    ↓
record justified semantic knowledge
    ↓
repeat until requested scope is complete
    ↓
rebuild/test when required by scope
~~~

### Knowledge

Read:
- all knowledge relevant to the requested addresses/ranges/components;
- history when a current conclusion is surprising or disputed.

Automatic write:
- none directly.

Semantic write:
- use c64-knowledge whenever the investigation establishes durable meaning.

Do not store:
- temporary investigation state;
- speculative names merely because a routine needs a temporary handle.

### Result

A clear answer/documented understanding of the requested scope, with durable findings recorded.

For a full reconstruction scope, completion also requires rebuild and functional verification.

### Failure and conflicts

If the next conclusion cannot be justified, preserve the unknown and gather more evidence rather than inventing meaning.

Knowledge conflicts must be reviewed before replacing current semantic knowledge.

### Handoffs

- runtime behavior → c64-emulator
- static structure → c64-static-analysis
- semantic/history work → c64-knowledge
- packed subject → c64-unpacker
- disk/container question → c64-disk
- BASIC startup → c64-basic
- address/register meaning → c64-memory-map
- rebuild → c64-assembler
- behavior/equivalence → c64-testing
- release/cracker-origin question → c64-provenance

## 5. c64-emulator

### Purpose

Operate and debug the one live VICE machine owned by the current MCP process.

### Inputs

- requested machine action or runtime question;
- target address/state/condition when applicable;
- subject/media to load when required.

### Tools / execution path

MCP only.

Representative capabilities:

- reset/pause/resume;
- memory/register read/write;
- stepping/continue/run-until;
- breakpoints/watchpoints;
- CPU history;
- keyboard/joystick;
- screen/snapshot;
- disk/media attachment and autostart.

### Workflow

~~~text
read relevant knowledge
    ↓
establish machine state
    ↓
set required observation/control condition
    ↓
run/step/provide input
    ↓
capture only relevant state
    ↓
interpret evidence
~~~

### Knowledge

Automatic write:
- none.

Semantic write:
- runtime evidence may justify a symbol, region or comment; record it through c64-knowledge.

Do not store:
- transient breakpoints/watchpoints;
- ordinary memory reads;
- temporary machine state;
- one-off screenshots unless the user explicitly wants an artifact.

### Result

The requested runtime state/evidence or a clear explanation that the condition could not be established.

### Failure and conflicts

A VICE crash invalidates machine state. Do not pretend the old state survived a restart.

Do not silently reinterpret runtime evidence that conflicts with current knowledge.

### Handoffs

- static explanation needed → c64-static-analysis
- durable conclusion → c64-knowledge
- comparison/assertion → c64-testing
- address/register decoding → c64-memory-map

## 6. c64-static-analysis

### Purpose

Discover static program structure using DXA for fast first-pass analysis and Ghidra for deeper analysis.

### Inputs

- project-relative binary/image path;
- load address when the input format does not determine it;
- requested analysis question/scope when narrower than the whole subject.

The skill chooses DXA or Ghidra based on the job rather than requiring the user to choose an executable.

### Tools / execution path

Broker-backed skill script.

~~~text
project bytes
    ↓
skill script
    ↓
Host Runtime
    ↓
DXA or Ghidra
    ↓
normalized findings
    ↓
local knowledge importer
~~~

### Workflow

First pass:

~~~text
read existing knowledge
    ↓
run DXA
    ↓
normalize structural findings
    ↓
reconcile/import durable findings
    ↓
report useful structure/conflicts
~~~

Deeper pass:

~~~text
read current symbols/regions
    ↓
seed Ghidra where useful
    ↓
run Ghidra
    ↓
normalize structural findings
    ↓
reconcile/import durable findings
    ↓
report useful structure/conflicts
~~~

### Knowledge

Read:
- current routine symbols;
- current data/code classifications;
- names useful as Ghidra seeds.

Automatically write:
- compatible analyzer-derived symbols;
- analyzer-derived regions;
- analyzer-derived references.

Do not automatically write:
- semantic routine names invented by the LLM;
- raw listings;
- decompiler text;
- full control-flow graphs;
- raw analyzer logs.

### Result

A compact C64-level result containing the requested useful findings plus any knowledge conflicts.

Re-analysis also retires stale findings owned by the same analyzer inside authoritative coverage; see 12 — Static analysis and knowledge import.

### Failure and conflicts

A malformed/incomplete analyzer result imports nothing.

A contradiction with semantic user/LLM knowledge is reported, never silently overwritten.

A contradiction with another analyzer remains a conflict unless the current operation is merely refreshing findings owned by the same analyzer.

### Handoffs

- dynamic question → c64-emulator
- semantic naming/classification → c64-knowledge
- C64 hardware meaning → c64-memory-map
- reconstructed source → c64-assembler

## 7. c64-knowledge

### Purpose

Read, write, correct and review durable project understanding.

### Inputs

One of:

- address/range/entity query;
- text/search query;
- requested symbol/region/comment mutation;
- history/revision review request.

Semantic writes should include a concise reason when that reason is useful for later review.

### Tools / execution path

Project-local knowledge component only.

Never broker-backed.

### Workflow

Read:

~~~text
resolve project
    ↓
open knowledge.db
    ↓
return current/history context
~~~

Write:

~~~text
resolve project
    ↓
read current value
    ↓
validate requested semantic change
    ↓
commit one revision transaction
    ↓
return resulting current knowledge
~~~

### Knowledge

This skill is the explicit semantic write path for LLM/user conclusions.

It also exposes history without requiring Git inspection.

### Result

For reads:
- compact current or historical C64 knowledge.

For writes:
- committed current value plus any relevant conflict/refusal.

### Failure and conflicts

Never erase history.

Never accept a stale concurrent write silently.

If a requested change contradicts current knowledge, show enough current/history context to resolve it deliberately.

### Handoffs

If more evidence is required:
- runtime evidence → c64-emulator
- static evidence → c64-static-analysis

## 8. c64-assembler

### Purpose

Assemble C64 source with ACME and return executable output or useful source diagnostics.

### Inputs

- source root;
- entry source;
- requested output path/name;
- explicit assembler options when needed.

### Tools / execution path

Broker-backed skill script → Host Runtime → ACME.

### Workflow

~~~text
validate source root/entry
    ↓
stage source tree
    ↓
assemble
    ↓
return output + relevant diagnostics/symbol information
~~~

### Knowledge

Read:
- none by default.

Automatic write:
- none.

Do not store:
- build logs;
- temporary staging state.

### Result

Successful output artifact(s), or actionable source diagnostics.

### Failure and conflicts

Report errors at source-level locations where possible. Hide host process/staging details.

### Handoffs

- run/debug result → c64-emulator
- regression/equivalence → c64-testing

## 9. c64-testing

### Purpose

Verify requested C64 behavior for development regressions or original-vs-reconstruction functional equivalence using layered evidence.

The skill supports:

- routine-level behavior;
- checkpointed machine-state comparisons;
- screenshot/visual comparisons;
- longer gameplay scenarios;
- preparation of human playtest checklists.

### Inputs

- scenario/action to perform;
- reproducible starting-state requirements;
- checkpoint condition(s);
- observations/assertions to compare;
- explicit tolerances/masks where applicable;
- original/reconstructed targets when equivalence is requested.

### Tools / execution path

Primarily MCP for VICE execution, state and input.

Local deterministic comparison helpers may be used for memory/state/image comparison.

Original and rebuild are normally run sequentially in the one VICE instance.

### Workflow

~~~text
establish reproducible start
    ↓
perform defined logical inputs/actions
    ↓
reach verified checkpoint
    ↓
capture relevant observations
    ↓
repeat for comparison target
    ↓
compare using explicit rules
    ↓
return PASS / FAIL / INCONCLUSIVE
~~~

Prefer semantic observations such as player_x or update_player over fixed physical addresses when original and rebuild layouts differ.

For games, screenshot checkpoints should normally be paired with useful display-driving state when that helps explain a mismatch.

### Knowledge

Read:
- semantic original-side address/symbol context needed by the test.

Rebuild-side semantic locations may come from assembler/source symbols.

Automatic write:
- none.

Semantic write:
- unexpected behavior may lead to a separate justified knowledge update after investigation.

Do not store ordinary test runs, transient screenshots, comparison artifacts or manual playtest outcomes in knowledge.db.

### Result

Exactly one automated state:

~~~text
PASS
FAIL
INCONCLUSIVE
~~~

with the smallest useful evidence explaining the result.

A visual failure should report useful differences, and where possible correlate them with C64 state rather than returning only a pixel score.

### Failure and conflicts

A test that did not reach its required starting state/checkpoint is INCONCLUSIVE, not a failure of application behavior.

Random/nondeterministic behavior must be controlled or compared through explicit invariants; otherwise exact assertions may be inconclusive.

Do not claim functional equivalence beyond the behavior actually exercised.

Human playtesting is the final acceptance layer for behavior that automated scenarios cannot fully establish.

See [13 — Testing and functional equivalence](13-testing-and-functional-equivalence.md).

### Handoffs

- investigate failure → c64-emulator
- static cause → c64-static-analysis
- rebuild after fix → c64-assembler
- durable semantic conclusion → c64-knowledge

## 10. c64-disk

### Purpose

Inspect C64 disk images and extract useful contents.

### Inputs

- disk image path;
- requested operation/file/sector when applicable.

### Tools / execution path

Broker-backed skill script → Host Runtime → c1541 or equivalent host disk tooling.

### Workflow

~~~text
inspect directory/container
    ↓
identify requested file/structure
    ↓
inspect chain/BAM/raw data as needed
    ↓
extract bytes/artifact when requested
~~~

### Knowledge

Automatic write:
- none.

Durable application meaning discovered from extracted content is recorded by the appropriate downstream skill.

### Result

Directory/BAM/sector-chain/raw/extracted-file information relevant to the request.

### Failure and conflicts

Distinguish malformed/corrupt disk structure from a valid empty/not-found result.

### Handoffs

- BASIC file → c64-basic
- packed file → c64-unpacker
- machine-code file → c64-static-analysis

## 11. c64-basic

### Purpose

Decode BASIC V2 and identify the handoff from BASIC startup code to machine code.

### Inputs

- BASIC PRG/path/bytes;
- specific line/token question when requested.

### Tools / execution path

Broker-backed petcat operation and/or equivalent deterministic local decoder.

### Workflow

~~~text
decode BASIC
    ↓
identify meaningful startup statements
    ↓
resolve SYS/USR or other machine-code handoff
    ↓
return listing + handoff information
~~~

### Knowledge

Automatic write:
- none.

The RE workflow may later record a handoff/entry point semantically if it is useful project knowledge.

### Result

Readable BASIC plus concrete machine-code handoff address(es) where present.

### Failure and conflicts

Do not invent a handoff when BASIC does not contain one that can be established.

### Handoffs

- machine code → c64-static-analysis
- runtime startup behavior → c64-emulator

## 12. c64-unpacker

### Purpose

Determine whether a C64 program is packed/crunched and obtain the post-decompression subject used for real analysis.

### Inputs

- candidate program path/bytes;
- optional runtime trigger/condition when known.

### Tools / execution path

May combine:

- broker-backed identification/native unpack tools;
- MCP/VICE when the reliable method is to execute through the decruncher and capture the resulting memory/program.

### Workflow

~~~text
identify whether packing is present
    ↓
name packer only when evidence supports it
    ↓
obtain post-decompression state/artifact
    ↓
verify the result is suitable for downstream analysis
~~~

### Knowledge

Automatic write:
- none.

Do not pollute project knowledge with details of the depacker unless the depacker itself is in the requested RE scope.

### Result

An unpacked/decrunched subject or a clear conclusion that packing was not established.

### Failure and conflicts

Do not guess a packer family from weak similarity.

Do not mistake loader/depacker code for the application under analysis.

### Handoffs

- unpacked machine code → c64-static-analysis
- runtime capture/investigation → c64-emulator

## 13. c64-memory-map

### Purpose

Resolve C64 platform addresses, KERNAL/BASIC entry points, hardware registers and register-derived memory locations.

### Inputs

- address;
- register/value combination;
- disassembly addresses requiring platform interpretation.

### Tools / execution path

Local deterministic lookup/decoder with detailed reference data loaded only when needed.

No broker required for pure lookup.

### Workflow

~~~text
normalize address/register input
    ↓
lookup/decode
    ↓
return concrete C64 meaning
~~~

### Knowledge

Automatic write:
- none.

Platform facts are reference knowledge, not application-specific project knowledge.

An application-specific conclusion based on the lookup may be recorded separately.

### Result

Concrete C64 interpretation useful to the current reasoning task.

### Failure and conflicts

Distinguish a known platform address from an application-owned address with no platform-defined meaning.

### Handoffs

- runtime value needed → c64-emulator
- project semantic conclusion → c64-knowledge

## 14. c64-provenance

### Purpose

Compare independently modified/cracked releases to determine which bytes/behaviors are likely original application content and which are release-specific modifications.

### Inputs

- two or more comparable release artifacts;
- alignment/anchor information when required;
- requested address/range/behavior question.

### Tools / execution path

Local deterministic comparison and broker-backed extraction helpers as required.

### Workflow

~~~text
establish comparable/aligned subjects
    ↓
compare independent releases
    ↓
separate shared content from release-specific changes
    ↓
interpret effect of relevant differences
~~~

### Knowledge

Automatic write:
- none in v1.

Specific durable conclusions may be recorded as ordinary semantic comments/regions/symbol context when useful.

A specialized provenance database model is not introduced without a concrete requirement.

### Result

A focused provenance conclusion/report for the requested region or behavior.

### Failure and conflicts

Do not call releases independent when their relationship is not established.

Do not label a byte original solely because one crack contains it.

### Handoffs

- inspect release container → c64-disk
- execute behavior → c64-emulator
- analyse differing code → c64-static-analysis
- record application conclusion → c64-knowledge

## 15. Trigger design

Skill descriptions should be written so that selection follows intent.

Examples:

- debug this running game → emulator;
- what does this binary contain? → static analysis;
- what do we already know about $2100? → knowledge;
- build this source → assembler;
- does the rebuild behave like the original? → testing.

Do not mention low-level internal transport or package mechanics in trigger descriptions.

## 16. Script contract

A deterministic skill script returns one structured result representing:

~~~text
success/result
or
actionable failure
~~~

The LLM receives only domain-level fields it can use.

Diagnostics reserved for human troubleshooting remain outside the normal result.
