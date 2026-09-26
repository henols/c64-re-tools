# SQLite Rules

Only `anno-store.mts` imports `node:sqlite`. Everything else calls its
functions, and only the broker's worker thread opens the database.

```ts
db.prepare("insert into anno_range(project_id, start, end_inclusive, data_type, bank) values ($pid, ?, ?, ?, ?)")
  .run(start, endInclusive, dataType, bank);
```

- Bound parameters via `prepare().run()`. Never interpolate into
  `exec()`, which runs only the fixed DDL and transaction keywords.
- Every statement on a project table binds `$pid` through the scoped
  statement factory (`scopeOf(handle)`), which refuses SQL without it.
- Single quotes for SQL literals. Double quotes throw `no such column`.
- Never load an extension, and never enable the constructor option.
- Never set `journal_mode` or `synchronous`. They persist in the file,
  and the default `delete` mode is the decision.
- No FTS5 table. Indexed `LIKE 'prefix%'` is faster, and removing FTS5
  later would be a migration.
- No save/flush verb. Every accepted write commits before it returns.
- Never cache a derived index/xref on disk. Recompute from the rows.
- Schema version check is strict equality, with no migration.
