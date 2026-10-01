# 06 — Project and knowledge

## 1. Project model

A project is simply the developer's project directory/repository.

c64-re-tools does not require a project manifest in v1 and does not impose a source layout.

Examples are all valid:

```text
game/
├── game.d64
└── .c64-re-tools/knowledge.db
```

```text
game/
├── original.prg
├── src/
│   └── main.a
└── .c64-re-tools/knowledge.db
```

The original application remains in the project where the developer chose to place it. Operations receive explicit project-relative paths when they need bytes/source.

## 2. Persistent toolkit state

The only authoritative persistent toolkit-owned project state in v1 is:

```text
.c64-re-tools/knowledge.db
```

Do not create a general project-local runtime/cache tree under `.c64-re-tools`. Host Runtime state, screenshots, snapshots, analyzer scratch, staging and logs belong outside the project. See [17 — Project root and local state](17-project-root-and-local-state.md).

The project root is the harness working directory. `.c64-re-tools/` is storage only; it is not used for project discovery.

## 3. One representation

SQLite is the single source of truth for project knowledge and its history.

Do not maintain synchronized JSON, JSONL, YAML or other mirrors. If diagnostic/export commands are later useful, they render on demand; their output is not another authoritative project file.

Git may version the database file, but Git history is not the knowledge-history model. Knowledge history must be stored and queryable inside `knowledge.db`.

## 4. Database v1

Keep the first schema deliberately small:

```text
meta
revisions
symbols
regions
comments
references
```

The four knowledge tables are temporal: rows are never destructively overwritten when accepted knowledge changes.

### `meta`

Stores database-internal state only:

```text
schema_version
current_revision
```

### `revisions`

One accepted knowledge change or one accepted analyzer import creates one revision.

Conceptual fields:

```text
id            INTEGER PRIMARY KEY
created_at    TEXT NOT NULL
origin        TEXT NOT NULL
operation     TEXT NOT NULL
input_hash    TEXT
tool_version  TEXT
description   TEXT
```

Initial `origin` vocabulary:

```text
user
llm
dxa
ghidra
```

Examples of `operation`:

```text
rename-symbol
classify-region
set-comment
analysis-import
revert
```

`description` is a short human/LLM-readable explanation of why the revision exists. It is especially useful for semantic LLM/user edits and later diagnosis.

For analyzer imports, `input_hash` identifies the analyzed bytes and `tool_version` records the analyzer version when known.

A single analyzer run that contributes many accepted findings creates one revision, not one revision per row.

### Temporal row model

`symbols`, `regions`, `comments` and `references` contain:

```text
valid_from_revision INTEGER NOT NULL
valid_to_revision   INTEGER NULL
```

A current row has:

```text
valid_to_revision IS NULL
```

When knowledge changes, the old row is closed by setting `valid_to_revision`, and a new current row is inserted in the same transaction.

Rows are not deleted to represent ordinary rename/reclassification/removal history.

Current-state views may be provided internally, for example:

```text
current_symbols
current_regions
current_comments
current_references
```

so normal queries do not need to repeat the validity predicate.

### `symbols`

Conceptual fields:

```text
address               INTEGER NOT NULL
name                  TEXT NOT NULL
kind                  TEXT NOT NULL
origin                TEXT NOT NULL
valid_from_revision   INTEGER NOT NULL
valid_to_revision     INTEGER
```

Initial `kind` vocabulary:

```text
label
routine
variable
data
vector
```

Rules:

- address range is `0..65535`;
- one current primary symbol per address;
- current symbol names are unique;
- `label` is the generic/default kind.

Generated analyzer names such as `FUN_2100` may be inserted when no better symbol exists.

If the LLM/user later determines the semantic identity, for example `update_player`, that becomes the new current symbol in a new revision. The generated symbol remains in history.

Analyzer imports never replace an existing semantic user/LLM name with a generated name.

### `regions`

Conceptual fields:

```text
start_address         INTEGER NOT NULL
end_address           INTEGER NOT NULL
type                  TEXT NOT NULL
origin                TEXT NOT NULL
valid_from_revision   INTEGER NOT NULL
valid_to_revision     INTEGER
```

Initial `type` vocabulary:

```text
code
bytes
words
addresses
addresses-split
petscii
screen
bitmap
sprite
```

Meanings:

- `words`: little-endian 16-bit values;
- `addresses`: contiguous little-endian address table;
- `addresses-split`: low-byte table followed/corresponding to high-byte table;
- absence of a current region means unknown/unclassified.

Current regions never overlap.

Setting a new classification over part of a current region closes the affected current rows and inserts the required split/replacement rows within one revision.

A more precise semantic classification may supersede a generic analyzer classification while preserving the earlier classification in history.

### `comments`

Conceptual fields:

```text
address               INTEGER NOT NULL
placement             TEXT NOT NULL
text                  TEXT NOT NULL
origin                TEXT NOT NULL
valid_from_revision   INTEGER NOT NULL
valid_to_revision     INTEGER
```

Initial placements:

```text
line
side
```

One current comment of each placement may exist per address.

Comment text contains prose only. Machine-readable confidence/status tokens must not be encoded inside comment strings.

Comments are the primary place for semantic explanation that does not fit in a short symbol name.

### `references`

References retain reusable structural relationships discovered by static analysis or explicitly established by the project.

Conceptual fields:

```text
from_address          INTEGER NOT NULL
to_address            INTEGER NOT NULL
kind                  TEXT NOT NULL
origin                TEXT NOT NULL
valid_from_revision   INTEGER NOT NULL
valid_to_revision     INTEGER
```

Initial `kind` vocabulary may include:

```text
call
jump
read
write
reference
```

The vocabulary should remain small and based on concrete consumers.

References are stored because incoming/outgoing relationships are central to later analysis and are expensive/noisy to reconstruct repeatedly from full analyzer output.

Raw control-flow graphs, decompiler text and complete analyzer projects are not stored.

## 5. Automatic DXA/Ghidra import

Analyzer processes run on the Host Runtime and never open `knowledge.db`.

The flow is:

```text
DXA / Ghidra
     ↓
structured analyzer result
     ↓
Application analysis layer
     ↓
deterministic knowledge importer
     ↓
single SQLite transaction/revision
     ↓
knowledge.db
```

The importer stores only durable reusable knowledge.

Typical DXA import:

```text
code ranges  → regions(type=code, origin=dxa)
data ranges  → regions(type=bytes or known type, origin=dxa)
generated labels/routine starts when useful → symbols(origin=dxa)
```

Typical Ghidra import:

```text
function entry/name     → symbols(kind=routine, origin=ghidra)
code/data classification→ regions(origin=ghidra)
calls/reads/writes/xrefs→ references(origin=ghidra)
```

Bulky or reproducible outputs such as full listings, decompiler text, raw logs and complete CFG exports are not copied into the knowledge database merely because they exist.

### Conflict rules

Automatic analysis fills gaps and adds compatible structural knowledge. It does not silently destroy current knowledge.

Examples:

- existing semantic symbol `update_player` + Ghidra `FUN_2100` → keep `update_player`; generated name is not a conflict worth replacing;
- existing region `sprite` + DXA says `code` → report a conflict and do not silently overwrite;
- existing generic `bytes` + justified semantic `sprite` from LLM/user → semantic edit may supersede it in a new revision.

Analyzer import results should report at least:

```text
inserted
changed_or_retired
unchanged
conflicts
revision
```

Re-analysis is coverage-aware. A complete analyzer snapshot may retire only that analyzer's own older findings inside the address ranges and finding categories it authoritatively covers. Partial/non-authoritative results may add compatible findings but may not retire older ones by absence. Semantic user/LLM knowledge is never retired by analyzer reconciliation. See [12 — Static analysis and knowledge import](12-static-analysis-knowledge-import.md).

## 6. Knowledge feeds later analysis

Stored knowledge is not only output; it also improves later tools.

Before Ghidra analysis, the application layer may query current knowledge and provide:

```text
symbols(kind=routine)  → entry points
known non-code regions → data ranges
known symbol names     → labels/seeds where supported
```

This creates an iterative loop:

```text
DXA
 ↓
knowledge.db
 ↓
VICE/LLM investigation
 ↓
semantic knowledge
 ↓
Ghidra seeded by current knowledge
 ↓
new structural findings
 ↓
knowledge.db
```

Only current accepted knowledge is used to seed analysis; historical rows remain available for review but are not treated as current truth.

## 7. LLM/user semantic knowledge

Static analyzers are good at structural facts but usually generate technical names.

The LLM/user must be able to replace those with application-specific semantic knowledge.

Example:

```text
revision 18 / ghidra
$2100 = FUN_2100, routine

revision 24 / llm
$2100 = update_player, routine
description: "Reads joystick 2 and updates player X/Y coordinates."
```

The current symbol is `update_player`, while `FUN_2100` remains reviewable in history.

The application determines the origin from the caller/context; the LLM does not spoof analyzer origins.

## 8. Query model

The normal API presents current knowledge unless history is explicitly requested.

### Address-centric lookup

`knowledge.at(address)` returns the useful current context for one address:

- primary symbol;
- containing region;
- comments;
- incoming references;
- outgoing references.

This should be one of the main operations used by skills/LLMs.

### Search/list

The API also supports current-state symbol/region/comment/reference listing and textual search.

### History

History is first-class:

```text
knowledge.history(address)
knowledge.history(entity)
knowledge.revisions(...)
knowledge.revision(id)
```

A history query should make it possible to answer:

- what used to be known here?
- which revision changed it?
- was it DXA, Ghidra, an LLM or a user?
- what reason was recorded?
- what input/tool version produced an analyzer import?
- what did a particular analyzer run change?

## 9. Revert semantics

A revert never erases history.

Reverting creates a new revision whose changes restore a selected earlier state.

Example:

```text
rev 18  ghidra  FUN_2100
rev 24  llm     update_player
rev 31  user    revert/rename to FUN_2100
```

All three revisions remain queryable.

A generalized revert operation may be implemented when needed; the history model must make it possible from the start.

## 10. Transaction rules

Every accepted knowledge modification runs in one transaction.

Typical write flow:

```text
BEGIN
  verify expected current revision if supplied
  validate operation/conflicts
  insert revision row
  close superseded current rows
  insert new current rows
  update meta.current_revision
COMMIT
```

A failure writes no partial revision and leaves current knowledge unchanged.

Use SQLite rollback-journal semantics appropriate for a source-controlled single-file database. A successful committed write must be fully represented in `knowledge.db`; do not rely on persistent WAL state. SQLite owns locking/concurrency; no additional project lock file is required.

## 11. What is not stored in v1

Do not create tables merely because data can be observed. The initial schema does not require separate tables for:

- variants/releases;
- artifacts;
- builds;
- runs;
- generic observations;
- hypotheses/assertions;
- raw traces;
- full Ghidra projects;
- complete decompiler output.

The revision history is deliberately knowledge-specific. It is not a generalized event log for everything the system does.

## 12. Schema evolution

`schema_version` is explicit. The new implementation may provide controlled forward migrations when a real new requirement changes the schema.

Migrations must be deterministic, tested and transactional. Material/destructive migrations should create an appropriate backup/recovery point before changing the database.
