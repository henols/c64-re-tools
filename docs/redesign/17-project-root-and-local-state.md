# 17 — Project root and local state

## 1. Purpose

Define the simplest possible project model and exactly what c64-re-tools may persist inside that project.

## 2. Project root

The project is a folder that holds `.c64-re-tools/` (D67 in docs/plan.md). One repository can hold several projects, one folder for each program, and the agent can start at its root.

A skill script finds its project like git finds `.git`:

1. `--project <folder>` names it: a folder, relative to the working directory or absolute. It is used as given, without `.c64-re-tools/` too (the first write makes it). A missing folder, a file, the home folder and a folder inside another project are refused.
2. Otherwise the project is the nearest folder at or above the working directory that holds `.c64-re-tools/`. The walk stops below the home folder, so a `~/.c64-re-tools` is no project.
3. Otherwise, when folders below the working directory (three levels deep, without dot folders and `node_modules`) hold `.c64-re-tools/`, the script refuses and lists them. No write lands outside a project.
4. Otherwise the working directory is the project, as for a single program. The home folder is never a project.

The MCP server uses the same rules for each tool call with a path, from the folder where the harness started it. The tool's `project` parameter takes the place of `--project` (D68, 15 §1).

The lookup is lazy: a script that reads no project file and no knowledge never refuses.

There is no `project.json`, no workspace file and no environment variable. The folder is the mark.

## 3. Project initialization

There is no explicit initialization command.

When c64-re-tools first needs persistent project knowledge, it creates:

~~~text
<project root>/
└── .c64-re-tools/
    ├── knowledge/      the knowledge text, committed (D69)
    └── local/          the index knowledge.db and the agent's scratch, never committed
~~~

The directory marks the project (§2) and holds toolkit-owned storage.

A read of a project without `knowledge/` is empty knowledge and creates nothing.

The first durable semantic write or analyzer import creates .c64-re-tools/knowledge/ with its .gitattributes, and the index in local/.

## 4. Project-relative paths

All project file paths of the skill scripts and the MCP tools are relative to the project folder (D68), not to the working directory.

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

The LLM normally sees these project-relative paths. A shell redirect is relative to the shell's working directory; the skill texts say so.

## 5. Persistent project layout

The committed toolkit-owned project state is:

~~~text
.c64-re-tools/knowledge/
~~~

Beside it, `.c64-re-tools/local/` holds the index `knowledge.db` and what the agent saves for itself: script results, batches and step files (D70). It has a `.gitignore` with `*`, so git ignores it in a workspace and in a single project alike. The scripts and the MCP server make it when they resolve a project that has `.c64-re-tools/`, and the first knowledge write makes it with the index.

Do not create other runtime/cache trees in the project, such as:

~~~text
cache/
runs/
snapshots/
logs/
ghidra/
staging/
builds/
~~~

## 6. Text and index

Each committed write leaves complete knowledge files: they are written through a temporary file and a rename before the index commits.

The index uses rollback-journal semantics. Its journal and lock files stay in local/. SQLite owns locking; no additional project lock file is required.

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

Persisted scenario definitions are ordinary developer-authored project files at locations chosen by the developer. They are not hidden toolkit state and are not stored in the knowledge.

## 8. Shared runtime

The shared deterministic runtime provides:

- the project lookup of §2 and `--project`;
- project-relative path validation;
- knowledge access;
- Host Runtime client/staging helpers.

The lookup of §2 is the only root resolver.

Released skill scripts should still use bundled/shared runtime code rather than locating MCP internals through filesystem ladders.

## 9. Knowledge API ownership

All access to the knowledge goes through one shared local knowledge library.

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
the working directory is in no project and has projects below it (they are listed)
--project or project names no folder, the home folder, or a folder inside another project
project-relative path escapes the project
knowledge database is invalid
knowledge database requires an unsupported migration
~~~

## 11. Operational invariant

> A project is a folder with .c64-re-tools/. Start the harness in it, or above several of them and name one with --project (scripts) or project (MCP tools). c64-re-tools stores durable knowledge in its .c64-re-tools/knowledge/ and scratch in its .c64-re-tools/local/.
