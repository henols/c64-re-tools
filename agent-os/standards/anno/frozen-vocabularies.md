# Frozen Vocabularies

Stored vocabularies are frozen constants, pinned by a hand-written test:

```ts
export const DATA_TYPES = Object.freeze(["code", "byte", "word", /* ... */] as const);
export const SPLIT_DATA_TYPES = Object.freeze(DATA_TYPES.filter(isSplitDataType));
```

- Never re-spell, re-order, add or remove a stored member. Values are
  already in user store files and SKILL.md playbooks. Narrowing is data
  loss, not a migration.
- Derive subsets with `filter`/`map`. Never write a second literal list.
- Pin the members with a literal test, never a test derived from the
  constant itself.
- No module-level mutable state beside them.
