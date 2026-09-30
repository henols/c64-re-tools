# 18 — Repository structure

## 1. Goal

Keep the implementation structure as small as the architecture allows.

c64-re-tools is one repository and one npm package.

Do not create a workspace/monorepo package graph unless a future concrete requirement proves that independently versioned packages are necessary.

## 2. Top-level layout

The v1 source layout is:

~~~text
c64-re-tools/
├── src/
│   ├── mcp/
│   ├── host/
│   ├── host-client/
│   ├── knowledge/
│   ├── cli/
│   ├── protocol.ts
│   └── project.ts
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

Do not add top-level packages/ or vendor/ directories in v1.

## 3. One npm package

Publish one npm package for the product.

Conceptually:

~~~text
@henols/c64-re-tools
~~~

The exact package name may be finalized when implementation begins, but the architecture assumes one published package.

It exposes three executable roles:

~~~text
c64-re-tools
c64-re-tools-mcp
c64-re-tools-host
~~~

Responsibilities:

~~~text
c64-re-tools       installer/update/status/diagnose CLI
c64-re-tools-mcp   stateful VICE MCP
c64-re-tools-host  Host Runtime
~~~

One package means:

- one version;
- one release;
- one dependency graph;
- no internal package-version synchronization;
- no separate runtime/MCP/host package publishing.

## 4. src/mcp

src/mcp contains only the stateful VICE MCP.

Typical internal shape may become:

~~~text
src/mcp/
├── server.ts
├── tools/
└── session.ts
~~~

It owns:

- MCP server startup;
- public VICE tool schemas;
- mapping MCP operations to the Host Runtime VICE-session client;
- LLM-facing result/error shaping.

It does not own:

- ACME;
- DXA;
- Ghidra;
- c1541;
- petcat;
- knowledge.db;
- project workflows.

## 5. src/host

src/host contains everything that must execute on the graphical/native host.

Typical shape:

~~~text
src/host/
├── server.ts
├── vice/
│   ├── session.ts
│   ├── monitor.ts
│   └── ...
├── tools/
│   ├── acme.ts
│   ├── dxa.ts
│   ├── ghidra.ts
│   ├── c1541.ts
│   └── petcat.ts
└── staging/
~~~

All native tools are peers.

DXA receives no special vendoring, packaging or repository ownership.

The Host Runtime owns:

- VICE process lifecycle;
- VICE monitor integration;
- native-tool discovery/execution;
- temporary request/session storage;
- process supervision;
- host side of file transfer/staging.

## 6. src/host-client

src/host-client contains the deterministic client used by both MCP and broker-backed skill scripts.

It owns:

- Host Runtime connection/discovery;
- long-lived VICE-session connection client;
- short-lived native-tool request client;
- binary/tree transfer;
- private protocol request/result validation.

It contains no C64 workflow decisions.

Skill scripts do not reimplement transport or staging.

## 7. src/knowledge

src/knowledge contains the single local knowledge implementation.

Typical shape may become:

~~~text
src/knowledge/
├── database.ts
├── schema.ts
├── queries.ts
├── writes.ts
├── history.ts
└── import.ts
~~~

It owns:

- .c64-re-tools/knowledge.db;
- creation/opening;
- schema/migrations;
- transactions/revisions;
- current/history queries;
- analyzer reconciliation/import.

The Host Runtime never imports this directory.

## 8. src/cli

src/cli is thin orchestration for human installation and diagnostics.

It may implement:

~~~text
c64-re-tools install
c64-re-tools update
c64-re-tools uninstall
c64-re-tools status
c64-re-tools diagnose

c64-re-tools host install
c64-re-tools host status
~~~

It does not contain emulator, analyzer or knowledge workflow logic.

## 9. src/protocol.ts

The Host Runtime private wire contract needs one maintained definition shared by host-client and host.

Start with one source file:

~~~text
src/protocol.ts
~~~

Do not create a protocol package.

If the file genuinely becomes too large, split it into src/protocol/ later.

The protocol remains private infrastructure and its version/details remain below the LLM-facing boundary.

## 10. src/project.ts

Project handling is intentionally tiny.

src/project.ts owns:

- projectRoot = process.cwd();
- validation/resolution of project-relative paths;
- prevention of project escape.

It does not discover a project.

Do not create a project package or project service.

## 11. Skills

Each first-class skill remains a normal Agent Skill directory:

~~~text
skills/c64-static-analysis/
├── SKILL.md
├── agents/
│   └── openai.yaml
├── scripts/
└── references/
~~~

Only include scripts/references/assets when that skill needs them.

Skill scripts may import maintained source from src/ during development/build.

Installed skills must not depend on repository-relative imports.

The release build bundles the deterministic code required by each skill script into its distributable artifact.

Conceptually:

~~~text
skill source script
   + src/host-client
   + src/knowledge where needed
   + small deterministic helpers
            ↓
          bundle
            ↓
installed self-contained skill script
~~~

This prevents copying shared mechanics across skills without requiring separate npm packages.

## 12. Distribution

distribution/ is the only area that knows about the cross-harness packaging adapter.

Conceptually:

~~~text
distribution/
├── plugin.ts
└── ...
~~~

It may depend on @jalco/ap-sdk.

Nothing under src/ or skills/ depends on AP SDK runtime APIs.

Distribution consumes the built MCP executable/declaration and built skill artifacts and maps them to harness-specific installation forms.

## 13. External native tools

The repository contains adapters for native tools, not the tools themselves.

Do not add:

~~~text
vendor/dxa
vendor/acme
vendor/ghidra
vendor/vice
~~~

or equivalent bundled third-party source/binary trees.

VICE, ACME, DXA, Ghidra, c1541 and petcat are external host-native prerequisites handled uniformly by Host Runtime installation/discovery.

If a future external tool needs a patched build, solve that as an installation/dependency problem rather than silently turning this repository into its source vendor.

## 14. Tests

Keep unit tests beside the source they test:

~~~text
src/knowledge/database.ts
src/knowledge/database.test.ts
~~~

Use the top-level test/ tree only when a test crosses implementation boundaries or needs reusable fixtures.

~~~text
test/
├── fixtures/
│   ├── asm/
│   ├── prg/
│   ├── d64/
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
~~~

Definitions:

- unit: one module/component, no external native program;
- integration: real boundary or real external tool;
- e2e: installed/assembled product workflow across multiple boundaries.

Do not create separate test packages.

## 15. Build outputs

One normal build should produce everything required for development/release.

Conceptually:

~~~text
pnpm build
   ↓
dist/
├── cli/
├── mcp/
├── host/
└── skills/
~~~

The exact generated filenames are implementation details.

Important properties:

- MCP is directly executable from the npm package;
- Host Runtime is directly executable from the npm package;
- skill scripts are bundled/self-contained;
- distribution consumes built outputs;
- generated dist/ content is not treated as hand-maintained source.

## 16. Dependency direction

The intended source dependencies are small and explicit:

~~~text
src/mcp
   ↓
src/host-client
   ↓
src/protocol.ts

skills/* scripts
   ├── src/host-client
   ├── src/knowledge
   └── src/project.ts

src/host
   └── src/protocol.ts

src/knowledge
   └── src/project.ts

src/cli
   └── installation/distribution orchestration
~~~

Prohibited directions:

- src/host → src/knowledge;
- src/mcp → src/knowledge;
- src/mcp → native-tool adapters;
- src/knowledge → src/host;
- core src/ → distribution/AP SDK;
- one skill importing another skill's implementation.

## 17. Add structure only when pressure exists

Do not pre-create abstraction directories such as:

~~~text
domain/
core/
common/
shared/
platform/
services/
adapters/
repositories/
~~~

merely to classify code.

A new directory/module boundary should solve an observed ownership or size problem.

Prefer a clear file in the owning component over a speculative architectural layer.

## 18. Invariant

> One repository, one npm package, a small flat src/ organized by actual ownership, first-class skill directories, external native tools, and no package graph until reality requires one.
