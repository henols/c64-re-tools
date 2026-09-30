# 19 — Implementation plan and build order

## 1. Strategy

Implement c64-re-tools as a sequence of vertical slices.

Each milestone must:

- produce something runnable;
- cross the real boundaries it is meant to validate;
- use the real external component where that component is the subject of the milestone;
- add tests for the behavior it introduces;
- leave the repository in a working state.

Do not build large disconnected subsystems in parallel and integrate them at the end.

The first architectural risk to eliminate is:

~~~text
MCP
 ↓
Host Runtime client
 ↓
Host Runtime
 ↓
VICE
 ↓
real machine state
~~~

The second is:

~~~text
skill script
 ↓
Host Runtime native-tool request
 ↓
real host tool
 ↓
structured result
~~~

The third is:

~~~text
analyzer result
 ↓
normalized findings
 ↓
knowledge reconciliation
 ↓
knowledge.db
~~~

## 2. Milestone 0 — Greenfield scaffold

Create only the minimum implementation skeleton.

### Build

- package.json;
- TypeScript configuration;
- build/test scripts;
- src/c64.ts;
- src/project.ts;
- src/protocol.ts;
- executable entry points:
  - src/mcp/main.ts;
  - src/host/main.ts;
  - src/cli/main.ts;
- empty-but-valid skill directories as they are actually needed, not all at once.

### Establish

- one npm package;
- one pnpm build;
- one test runner;
- formatting/linting only if they materially help the project;
- dist/ build output;
- executable bin wiring.

### Acceptance

~~~text
pnpm install
pnpm build
pnpm test
~~~

all succeed from a clean checkout.

The built package can execute:

~~~text
c64-re-tools --help
c64-re-tools-mcp --help
c64-re-tools-host --help
~~~

No C64 functionality is required yet.

## 3. Milestone 1 — First real VICE vertical slice

This is the first important milestone.

Implement the smallest path that proves the architecture:

~~~text
MCP
 ↓
host-client
 ↓
Host Runtime
 ↓
VICE process
 ↓
binary monitor
 ↓
C64 state
~~~

### Implement

Host Runtime:

- server/listener;
- one long-lived VICE session connection;
- process supervision;
- VICE launch/readiness/termination;
- binary-monitor connection;
- serialized request handling.

The first slice intentionally uses only the binary monitor. This is sufficient to prove session ownership, machine state, memory access and register access with the smallest possible implementation. The text monitor is still part of the v1 VICE-session architecture and is added when the first frozen MCP operation genuinely requires it; do not interpret this milestone as a binary-monitor-only architecture.

Host client:

- connection;
- VICE-session ownership;
- private request/reply validation.

MCP:

- server;
- c64_status;
- c64_memory_read;
- c64_registers action=get.

### Acceptance

A real invocation must be able to:

1. start Host Runtime;
2. start MCP;
3. cause one VICE instance to launch;
4. read a known C64 memory range;
5. read CPU registers;
6. report stopped/running state correctly;
7. terminate MCP and verify its VICE child exits.

Also verify:

~~~text
two MCP processes
 ↓
two independent Host Runtime sessions
 ↓
two independent VICE processes
~~~

No mocked VICE acceptance test counts for this milestone.

## 4. Milestone 2 — Complete live-machine foundation

Expand the real VICE path into the minimum useful interactive C64 environment.

### Implement first

- reset;
- pause/resume;
- step/next;
- memory write;
- register set;
- program load;
- autostart;
- disk attach;
- keyboard;
- joystick;
- warp;
- screen capture.

### Then implement deterministic control

- advance-frames;
- run-until;
- typed register/memory/raster conditions;
- breakpoint lifecycle;
- watchpoint lifecycle.

### Acceptance

Prove a deterministic scenario against real VICE:

~~~text
load fixture PRG
 ↓
run
 ↓
send input
 ↓
run until known state/address
 ↓
advance exact frame count
 ↓
read memory/register state
 ↓
capture screen
~~~

The same scenario must be repeatable without wall-clock sleeps.

At this point c64-emulator can become a usable skill because the MCP has meaningful live-machine functionality.

## 5. Milestone 3 — Complete the frozen VICE MCP surface

Finish the remaining frozen v1 MCP contract before adding more product workflows.

### Add

- memory search/compare;
- live disassembly;
- CPU history;
- backtrace;
- profile;
- memmap;
- timing;
- VIC-II;
- sprites;
- CIA;
- SID;
- c64_observe;
- screen baselines/compare/diff;
- snapshots;
- drive8 support where defined by the frozen schema.

Add the text-monitor connection and routing when the first operation genuinely requires it. Thereafter, keep binary/text monitor selection internal to `src/host/vice`; callers never choose a monitor.

All binary/text monitor routing remains inside src/host/vice.

### Acceptance

Every public tool listed in 15 — VICE MCP schemas has:

- schema tests;
- host-client/Host Runtime contract tests;
- at least one representative real-VICE integration test for each underlying implementation mechanism;
- no raw VICE vocabulary leaking into normal MCP results.

After this milestone the public VICE MCP is feature-complete for v1.

## 6. Milestone 4 — Knowledge core

Implement the local durable knowledge system independently of Host Runtime.

### Implement

- projectRoot = process.cwd();
- safe project-relative paths;
- database open/create;
- v1 schema;
- revisions;
- current-state reads;
- semantic writes;
- history;
- transactional mutation;
- schema migration framework;
- c64-knowledge deterministic script.

### Test heavily

Especially:

- revision creation;
- rename history;
- region split/reclassification;
- comment replacement/removal;
- reference history;
- stale revision refusal;
- rollback on failure;
- source-controlled single-file behavior.

### Acceptance

From a clean C64 project directory:

~~~text
knowledge read
→ no database required

first write
→ .c64-re-tools/knowledge.db created

write several semantic changes
→ current view correct
→ full history preserved
~~~

No Host Runtime process is involved.

## 7. Milestone 5 — Native-tool request seam + ACME

Use ACME as the first real short-lived native-tool integration because it is comparatively simple and immediately creates a useful development loop.

### Implement common seam

- short-lived Host Runtime tool request;
- typed dispatch;
- staging upload;
- returned attachments;
- native-tool discovery;
- bounded child execution;
- request cleanup;
- structured failure handling.

### Implement ACME

- source-root staging;
- entry source;
- defines/includes/setPc;
- diagnostic parsing;
- symbol parsing;
- PRG validation;
- structured result.

### Implement c64-assembler

Its script should be thin:

~~~text
read project source
 ↓
call acme.assemble
 ↓
write returned program locally
 ↓
report diagnostics/symbols
~~~

### Acceptance

Real development loop:

~~~text
source
 ↓
c64-assembler
 ↓
Host Runtime
 ↓
ACME
 ↓
PRG
 ↓
c64_program_load/autostart
 ↓
VICE
~~~

A fixture source program must assemble, launch and reach a known state in VICE.

This proves both execution surfaces work together without putting ACME into MCP.

## 8. Milestone 6 — Disk and BASIC tooling

Add the simpler native-tool workflows before static analyzers.

### c1541

Implement:

- directory;
- bam;
- entry;
- chain;
- read.

Then implement c64-disk skill script.

### petcat

Implement:

- BASIC V2 decode;
- listing validation;
- SYS handoff extraction.

Then implement c64-basic skill script.

### Acceptance

Using real fixture media:

- inspect a D64 directory;
- extract a PRG;
- decode a BASIC loader;
- identify its machine-code handoff;
- optionally load the extracted/handoff program in VICE.

This gives the reverse-engineering workflow its normal intake path.

## 9. Milestone 7 — DXA first-pass static analysis

DXA is the first analyzer because its role is fast structural analysis.

### Implement

Host adapter:

- stage image;
- apply seeds;
- run DXA;
- parse complete output;
- validate typed result;
- return coverage/regions/labels/listing metadata.

Project side:

- normalized analyzer-finding model;
- DXA → normalized finding mapping;
- parse-before-write validation;
- knowledge importer/reconciler;
- coverage/category authority handling;
- conflict reporting.

c64-static-analysis script gets its first working analyzer path.

### Acceptance

On a known fixture:

~~~text
PRG
 ↓
DXA
 ↓
normalized structural findings
 ↓
knowledge import
 ↓
knowledge.db
~~~

Then run DXA again with deliberately changed coverage/result and prove:

- obsolete DXA-owned facts retire correctly;
- history remains;
- semantic user/LLM knowledge is protected;
- no partial import occurs on malformed analyzer output.

## 10. Milestone 8 — Ghidra deeper analysis

Add Ghidra only after the normalized analyzer/knowledge path already works with DXA.

### Implement

- headless Ghidra invocation;
- required C64/NMOS-6502 integration scripts;
- disposable project creation;
- seed current semantic labels/routines/data;
- function/region/reference export;
- optional bounded decompilation;
- complete output validation;
- Ghidra → normalized finding mapping.

Reuse the same knowledge importer/reconciler from DXA.

Do not create a parallel Ghidra-specific knowledge write path.

### Acceptance

Prove the intended iterative loop:

~~~text
DXA
 ↓
knowledge.db
 ↓
semantic rename/classification
 ↓
Ghidra seeded from current knowledge
 ↓
deeper structural findings
 ↓
same knowledge importer
 ↓
history/conflicts preserved
~~~

Also prove that an echoed semantic seed does not become Ghidra-owned knowledge.

## 11. Milestone 9 — Functional-equivalence testing

Now the required primitives exist:

- complete VICE control/observation;
- assembler;
- knowledge;
- deterministic symbols;
- screen comparison.

Implement c64-testing.

### First capabilities

- scenario setup/actions/checkpoint/observations/comparison in code;
- sequential original/rebuild A/B execution;
- semantic-address resolution;
- exact/threshold visual comparison;
- machine-state comparison;
- PASS/FAIL/INCONCLUSIVE;
- manual playtest checklist generation.

Do not introduce a large scenario DSL.

Start with TypeScript/data structures internal to the testing skill/runtime.

### Acceptance

Use a deliberately equivalent and deliberately broken reconstruction fixture.

The same scenario must:

- PASS the equivalent reconstruction;
- FAIL the behaviorally different reconstruction;
- return INCONCLUSIVE when the required checkpoint cannot be established.

## 12. Milestone 10 — Remaining specialist skills

Build the remaining skills on top of already-working primitives.

Suggested order:

1. c64-memory-map;
2. c64-unpacker;
3. c64-provenance;
4. c64-reverse-engineering.

### c64-memory-map

Mostly deterministic reference/decoding functionality.

### c64-unpacker

Add its external native tool only when the concrete tool/contract has been chosen. It may combine Host Runtime tool requests with live VICE MCP investigation.

### c64-provenance

Use local comparison/analysis plus existing specialist capabilities. Do not create a provenance database.

### c64-reverse-engineering

Build last because it orchestrates all the other specialists.

Its value comes from choosing the next correct step, not duplicating their mechanics.

### Acceptance

Run an end-to-end fixture from unknown C64 artifact through:

~~~text
inspect media/BASIC/packing
 ↓
run/observe
 ↓
DXA
 ↓
knowledge
 ↓
semantic investigation
 ↓
Ghidra
 ↓
source reconstruction
 ↓
ACME build
 ↓
functional verification
~~~

## 13. Milestone 11 — Installation and distribution

Do not postpone all packaging checks until the final release: smoke-test the built npm package throughout development.

Once product behavior is complete, finish the user-facing installation flow.

### Implement

- c64-re-tools install;
- update;
- uninstall;
- status;
- diagnose;
- c64-re-tools host install/status;
- Host Runtime foreground start;
- supported per-user autostart where appropriate;
- AP SDK distribution adapter;
- MCP declaration;
- packaged skills;
- installed skill-script bundles.

### Test from installed artifacts

Never accept only repository-local execution.

Test at least:

~~~text
npm package artifact
 ↓
fresh environment
 ↓
install
 ↓
skills available
 ↓
MCP launches
 ↓
Host Runtime reachable
 ↓
real VICE operation
~~~

and host-tool skill execution from its installed location.

## 14. Milestone 12 — Hardening and release

Only after the end-to-end architecture works.

### Add/finalize

- crash cleanup;
- timeout/size bounds;
- malformed input/output cases;
- Windows/Linux/macOS behavior where supported;
- devcontainer host reachability;
- installer failure remediation;
- package provenance;
- release automation;
- full CI matrix;
- documentation examples;
- current-code behavior cases worth porting as regression tests.

### Release gate

A v1 release should require successful representative workflows for both product halves.

Development:

~~~text
source
→ ACME
→ VICE
→ debug
→ test
~~~

Reverse engineering:

~~~text
artifact
→ inspect
→ VICE
→ DXA/Ghidra
→ knowledge
→ reconstruct
→ assemble
→ equivalence test
~~~

## 15. What to reuse from the current implementation

Reuse evidence and proven behavior selectively while implementing each milestone.

Good reuse candidates:

- VICE protocol framing/details;
- observed monitor quirks/workarounds;
- process cleanup lessons;
- ACME diagnostic/symbol parsing behavior;
- DXA/Ghidra parser rules;
- c1541/petcat fixture expectations;
- useful integration fixtures;
- failure cases already found in production.

Do not port entire old modules merely because they exist.

For every old-code reuse:

~~~text
identify required behavior
 ↓
write/port the regression test
 ↓
implement it inside the new ownership boundary
~~~

## 16. Work-in-progress rule

Do not start several future milestones just because their directories already exist.

Prefer:

~~~text
one vertical slice
 ↓
real acceptance test
 ↓
commit/merge
 ↓
next slice
~~~

A milestone may contain several small PRs, but the branch should remain runnable.

## 17. Recommended first implementation sequence

The first concrete coding sequence is:

~~~text
1. scaffold package/build/test
2. define minimal private protocol
3. Host Runtime listener
4. Host Runtime process supervisor
5. VICE process launch/readiness
6. binary-monitor client
7. per-connection VICE session
8. host-client VICE connection
9. MCP server
10. c64_status
11. c64_memory_read
12. c64_registers get
13. real-VICE integration test
14. two-MCP/two-VICE isolation test
15. clean disconnect/child cleanup test
~~~

Do not implement ACME, knowledge, Ghidra, skills packaging or advanced debugger features before this first slice is working.

## 18. Definition of architectural success

The rewrite is on the right track when new functionality usually means adding code inside one obvious owner rather than creating another architectural layer.

Examples:

~~~text
new VICE observation
→ src/host/vice + MCP tool group

new host-native tool
→ src/host/tools + thin skill script

new durable knowledge operation
→ src/knowledge

new workflow reasoning
→ the relevant SKILL.md
~~~

If implementing an ordinary feature requires changes across many unrelated areas, revisit the boundary before adding abstractions.
