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

The only mandatory persistent toolkit-owned project state is:

```text
.c64-re-tools/knowledge.db
```

Optional disposable/machine-local data belongs under:

```text
.c64-re-tools/local/
```

`local/` is not authoritative knowledge and should normally be ignored by source control.

## 3. One representation

SQLite is the single source of truth for project knowledge.

Do not maintain synchronized JSON, JSONL, YAML or other mirrors. If diagnostic/export commands are later useful, they render on demand; their output is not another authoritative project file.

## 4. Database v1

Keep the first schema deliberately small:

```text
meta
symbols
regions
comments
```

### `meta`

Stores database-internal state only:

```text
schema_version
revision
```

`revision` increments after successful write transactions and may be used for optimistic concurrency.

### `symbols`

Conceptual fields:

```text
address   INTEGER NOT NULL
name      TEXT NOT NULL
kind      TEXT NOT NULL
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
- symbol names are unique;
- one primary symbol per address;
- `label` is the generic/default kind.

### `regions`

Conceptual fields:

```text
start_address INTEGER NOT NULL
end_address   INTEGER NOT NULL
type          TEXT NOT NULL
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
- absence of a region means unknown/unclassified.

Regions never overlap. Setting a classification over part of an existing region causes the application layer to split/replace rows transactionally so every address has at most one current region classification.

### `comments`

Conceptual fields:

```text
address    INTEGER NOT NULL
placement  TEXT NOT NULL
text       TEXT NOT NULL
```

Initial placements:

```text
line
side
```

One comment of each placement may exist per address.

Comment text contains prose only. Machine-readable confidence/status tokens must not be encoded inside comment strings.

## 5. What is not stored in v1

Do not create tables merely because data can be observed. The initial schema does not require tables for:

- variants/releases;
- artifacts;
- builds;
- runs;
- generic observations;
- hypotheses/assertions;
- cross-references;
- raw traces;
- Ghidra/dxa intermediate results.

Cross-references and other derived results should be computed when practical rather than persisted and allowed to become stale.

## 6. Transaction rules

Every knowledge modification runs in a transaction.

Typical write flow:

```text
BEGIN
  verify expected revision if supplied
  validate operation invariants
  perform row changes/splits
  increment revision
COMMIT
```

A failure writes nothing.

Use SQLite settings appropriate for a source-controlled single-file database. Avoid a design where successful project state can remain only in an uncommitted WAL sidecar.

## 7. Schema evolution

`schema_version` is explicit. Unlike the current strict-equality model, the new implementation may provide controlled forward migrations when a real new requirement changes the schema.

Migrations must be deterministic, tested and transactional. Material/destructive migrations should create an appropriate backup/recovery point before changing the database.
