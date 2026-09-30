# 17 — Project root and local state

## 1. Purpose

Define how every project-aware c64-re-tools component resolves the same project without a project manifest, and define exactly what c64-re-tools may persist inside that project.

The goals are:

- deterministic behavior from skills installed outside the project;
- harness independence;
- no fixed relative-path assumptions;
- no accidental project roots inside installed packages;
- minimal toolkit-owned project state.

## 2. Project identity

A c64-re-tools project is an ordinary directory.

There is no required project manifest.

The directory:

~~~text
.c64-re-tools/
~~~

acts as an optional explicit project-root marker once it exists.

Its durable v1 content is:

~~~text
.c64-re-tools/
└── knowledge.db
~~~

An empty .c64-re-tools directory is also a valid root marker. This allows a nested C64 project to be pinned inside a larger repository without introducing a manifest.

## 3. Shared root resolver

Every project-aware skill script and local runtime component uses one shared deterministic resolver.

No skill implements its own root walk.

Conceptual interface:

~~~text
resolveProjectRoot(
  startDirectory = process.cwd(),
  explicitRoot?
)
~~~

### Resolution order

1. An explicit root argument supplied by the caller.
2. C64RE_PROJECT_ROOT when set.
3. Walk upward from startDirectory and stop at the first directory containing either:
   - .c64-re-tools/; or
   - .git.
4. If no boundary exists, use startDirectory itself.

At each directory during the upward walk, .c64-re-tools is checked before .git.

This means:

- a nested C64 project marker wins before reaching an outer Git repository;
- a nested Git repository wins before an outer project's .c64-re-tools marker;
- when .c64-re-tools and .git are in the same directory, that directory is the project root.

## 4. Explicit-root behavior

An explicit root may be provided by deterministic script/runtime plumbing for cases such as:

- monorepos;
- commands intentionally operating on another project directory;
- harnesses whose process working directory is not the project;
- tests.

C64RE_PROJECT_ROOT provides the same user/environment override without binding the core resolver to a particular harness.

The explicit root or environment override:

- is resolved relative to the current working directory when relative;
- must already exist;
- must be a directory;
- is canonicalized before use;
- wins absolutely over marker discovery.

If it is invalid, resolution fails. Do not silently fall through to another root.

## 5. What is deliberately not consulted

Core project discovery does not read:

~~~text
CLAUDE_PROJECT_DIR
CONTAINER_WORKSPACE_PATH
CURSOR-specific variables
Codex-specific variables
installed skill path
installed MCP package path
import.meta.url-relative repository guesses
fixed ".." hop counts
package.json
~~~

A harness/distribution adapter may translate its own workspace concept into C64RE_PROJECT_ROOT when necessary.

The core remains harness-independent.

## 6. Working-directory rule

The default discovery anchor is process.cwd(), never the skill/script/module installation directory.

Skills are expected to run with the user's project as their working context.

If packaging for a harness cannot guarantee that, its adapter sets C64RE_PROJECT_ROOT or passes the explicit root through shared runtime plumbing.

## 7. Nested project examples

### Ordinary Git repository

~~~text
game/                  ← .git → project root
├── .git/
├── original/
└── src/
    └── main.a         ← command started here
~~~

The upward walk resolves game/.

### Explicit nested C64 project

~~~text
retro-work/
├── .git/
├── game-a/
│   ├── .c64-re-tools/ ← nearest boundary → project root
│   └── game.d64
└── game-b/
~~~

A command started inside game-a resolves game-a.

### Nested Git repository

~~~text
outer/
├── .c64-re-tools/
└── imported-game/
    ├── .git/          ← nearest boundary → project root
    └── game.prg
~~~

A command inside imported-game resolves imported-game rather than outer.

### No Git and no marker

~~~text
game/
├── game.prg
└── src/
~~~

When invoked from game/, game/ is the project.

When invoked from game/src/ with no explicit root and no marker, game/src/ is necessarily the project because there is no external fact from which the parent intent can be inferred.

Use an explicit root once in such an ambiguous layout if game/ is intended. The first durable write then creates game/.c64-re-tools/, making later discovery automatic.

## 8. Knowledge initialization

There is no mandatory project-initialization command.

### Read-only operation

If the resolved project has no:

~~~text
.c64-re-tools/knowledge.db
~~~

a read-only knowledge query behaves as an empty knowledge store.

It does not create files merely because knowledge was read.

### First durable write

The first semantic write or analyzer import:

1. resolves the project root;
2. creates .c64-re-tools/ if absent;
3. creates/initializes knowledge.db;
4. performs the requested write transaction.

There is no separate registration step.

### Pinning a nested/non-Git project

On an ambiguous first write, the skill/runtime may supply explicitRoot.

Once .c64-re-tools exists at that location, normal upward discovery finds it thereafter.

## 9. Corrupt or incompatible knowledge store

If .c64-re-tools exists and knowledge.db exists but cannot be opened/validated:

- that directory remains the project root;
- the operation fails clearly;
- do not walk farther upward looking for another database;
- do not silently create a replacement database.

This prevents a damaged project from accidentally reading/writing an ancestor project's knowledge.

## 10. Project-relative files

All project-aware file inputs are resolved through the shared project root.

A project-relative path:

- must not be absolute;
- must not escape the project with parent traversal;
- is canonicalized against the project root;
- must not escape through a symlink when its bytes/tree are staged for host execution.

The LLM normally sees project-relative paths, not absolute client paths.

## 11. Persistent project layout

In v1, c64-re-tools reserves only:

~~~text
.c64-re-tools/knowledge.db
~~~

as authoritative toolkit-owned project state.

Do not create a general:

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

tree in the project.

Those concerns have better owners elsewhere.

## 12. SQLite side files

knowledge.db must remain a self-contained source-controlled database after each successful committed write.

Use SQLite rollback-journal semantics for v1 rather than relying on persistent WAL state.

Temporary SQLite journal/locking files may exist while a process is active, but successful durable state must be present in knowledge.db itself when the transaction completes.

No custom project lock file is required; SQLite owns database locking/concurrency.

Concurrent semantic writes use the existing revision check/transaction rules rather than a second locking mechanism.

## 13. Where non-project state lives

### Host Runtime state

Machine-specific Host Runtime state lives in the user's host-level application state/data directories, outside projects.

Examples:

- logs;
- runtime sockets/ports;
- tool discovery/configuration;
- temporary Ghidra projects;
- host request staging;
- crash diagnostics.

Exact OS paths are internal implementation details.

### MCP session state

Session-owned transient state lives with the MCP/Host Runtime session:

- VICE process;
- visual baselines;
- snapshots;
- temporary comparison state.

It disappears when the session ends/state is lost unless a future explicit export feature says otherwise.

### Short-lived skill/native-tool state

Temporary analyzer/build/disk/BASIC staging uses request-owned temporary locations and is deleted after the result is returned.

### Build outputs

Assembler outputs are developer/project artifacts, not toolkit metadata.

They are written by the skill to the user-requested project path after bytes return from the Host Runtime.

### Test scenarios

If persisted, test scenario definitions are ordinary developer-authored project files in a location the developer chooses.

They are not hidden c64-re-tools state and are not stored in knowledge.db.

## 14. Shared runtime dependency

Project-root resolution, project-relative path validation and knowledge access belong to shared deterministic runtime code.

Skill scripts must not locate/import MCP internals through filesystem ladders.

Greenfield runtime dependency rule:

~~~text
maintained shared TypeScript source
        ↓
release build/bundling
        ↓
skill script artifact
~~~

Where practical, each released skill script is self-contained/bundled with the small shared runtime pieces it needs.

This means runtime correctness does not depend on:

- sibling skill installation paths;
- node_modules search from the user's project;
- a VICE_MCP_DIR-style override;
- relative hops from a skill package into an MCP package.

The MCP and skills may share source libraries during development, but a released skill never needs to discover the MCP's source tree on disk.

## 15. Knowledge API ownership

All access to knowledge.db goes through one shared local knowledge library.

It owns:

- database creation/opening;
- schema validation/migration;
- SQLite settings;
- transaction/revision semantics;
- current/history queries;
- analyzer import/reconciliation.

Skills do not open SQLite independently.

The c64-knowledge skill exposes that library's useful operations; other skills use the same library internally where needed.

## 16. Failure behavior

Project-root/path failures should be actionable and small.

Examples:

~~~text
explicit project root does not exist
project-relative path escapes the project
knowledge database is invalid
knowledge database requires an unsupported migration
~~~

Do not normally report:

- module installation paths;
- root-discovery ladder internals;
- package locations;
- database pragmas;
- SQLite lock filenames.

Explicit human diagnostics may expose those details.

## 17. Current-code lessons retained

The current implementation correctly recognized several problems that remain important:

- one shared root resolver is better than duplicated root logic;
- fixed relative ".." hops are unsafe;
- skill installation directories are not necessarily the user's project;
- an explicit c64-re-tools root override is useful.

The greenfield design deliberately drops current fallbacks that guess a project from:

- Claude-specific workspace variables;
- container-specific variables;
- a .git walk starting from the installed module rather than the working project;
- fixed package-directory hop counts.

## 18. Invariant

The project-state invariant is:

> Resolve the project from the user's working context, persist only durable knowledge under .c64-re-tools, and keep runtime/tool/session machinery outside the project.
