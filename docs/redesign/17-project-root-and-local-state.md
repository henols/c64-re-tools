# 17 — Project root and local state

## 1. Purpose

Define the simplest possible project model and exactly what c64-re-tools may persist inside that project.

## 2. Project root

The project root is the working directory from which the agent harness is launched.

That is the entire rule.

Conceptually:

~~~text
projectRoot = harness working directory
~~~

There is no project-root discovery algorithm.

Do not:

- walk upward for .git;
- walk upward for .c64-re-tools;
- inspect package.json;
- infer a project from the skill/MCP installation path;
- read harness-specific workspace variables;
- use C64RE_PROJECT_ROOT or another override;
- guess a parent directory.

If the user wants to work on another project, launch the harness from that project's directory.

## 3. Project initialization

There is no explicit initialization command.

When c64-re-tools first needs persistent project knowledge, it creates:

~~~text
<project root>/
└── .c64-re-tools/
    └── knowledge.db
~~~

The directory is not used to discover the project. It is simply toolkit-owned storage under the already-known project root.

Read-only knowledge access may treat a missing knowledge.db as an empty knowledge store without creating the file.

The first durable semantic write or analyzer import creates .c64-re-tools/ and knowledge.db automatically.

## 4. Project-relative paths

All project file paths are interpreted relative to the harness working directory.

Examples:

~~~text
original/game.d64
src/main.a
build/game.prg
~~~

A project-relative path:

- must not be absolute;
- must not escape the project with parent traversal;
- must not escape through a symlink when its bytes/tree are staged for host execution.

The LLM normally sees these project-relative paths.

## 5. Persistent project layout

The only authoritative toolkit-owned project state in v1 is:

~~~text
.c64-re-tools/knowledge.db
~~~

Do not create a general project-local runtime/cache tree such as:

~~~text
.c64-re-tools/local/
cache/
runs/
snapshots/
logs/
ghidra/
staging/
builds/
~~~

## 6. SQLite side files

knowledge.db must remain a self-contained source-controlled database after each successful committed write.

Use SQLite rollback-journal semantics for v1 rather than relying on persistent WAL state.

Temporary SQLite journal/locking files may exist while a process is active, but committed project knowledge must be present in knowledge.db when the transaction completes.

SQLite owns database locking/concurrency; no additional project lock file is required.

## 7. Where non-project state lives

### Host Runtime

Host Runtime machine-specific state lives outside the project:

- logs;
- runtime sockets/ports;
- native-tool discovery/configuration;
- temporary Ghidra projects;
- request staging;
- crash diagnostics.

### MCP session

Session state lives with the MCP/Host Runtime session:

- VICE process;
- visual baselines;
- snapshots;
- temporary comparison state.

### Short-lived skill/native-tool state

Analyzer/build/disk/BASIC staging is request-owned and removed after the operation.

### Build outputs

Assembler outputs are normal developer/project artifacts written by the skill to the requested project-relative location after bytes return from the Host Runtime.

### Test scenarios

Persisted scenario definitions are ordinary developer-authored project files at locations chosen by the developer. They are not hidden toolkit state and are not stored in knowledge.db.

## 8. Shared runtime

The shared deterministic runtime provides:

- the harness working directory as project root;
- project-relative path validation;
- knowledge access;
- Host Runtime client/staging helpers.

There is no root resolver beyond reading the harness working directory.

Released skill scripts should still use bundled/shared runtime code rather than locating MCP internals through filesystem ladders.

## 9. Knowledge API ownership

All access to knowledge.db goes through one shared local knowledge library.

It owns:

- database creation/opening;
- schema validation/migration;
- SQLite settings;
- transaction/revision semantics;
- current/history queries;
- analyzer import/reconciliation.

Skills do not implement independent SQLite behavior.

## 10. Failure behavior

Relevant project/path failures are simple:

~~~text
project-relative path escapes the project
knowledge database is invalid
knowledge database requires an unsupported migration
~~~

There is no "could not determine project root" error because the harness working directory already is the project root.

## 11. Operational invariant

> Launch the harness from the C64 project directory. That directory is the project root, and c64-re-tools stores durable knowledge in its .c64-re-tools/knowledge.db.
