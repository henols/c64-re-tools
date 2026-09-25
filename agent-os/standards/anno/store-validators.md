# Store Validators

The MCP proxy validates nothing. Every store argument goes through an
`assertX()`/`parseStoreX()` in `anno-types.ts` before it reaches SQL.

```ts
parseStoreAddress(4096)     // ok
parseStoreAddress("$1000")  // ok
parseStoreAddress("0x1000") // ok
parseStoreAddress("1024")   // throws: bare decimal refused
```

- Validators throw a named `ViceError` that includes the offending
  value and the valid form. They never return a default, because a
  default gets written into the store.
- Refuse illegal label names. Never trim, substitute or quote them:
  `init screen` -> `init_screen` silently merges two names.
- A legal name already bound elsewhere is refused, never rebound.
- Never reuse stock `parseAddress()`. It accepts bare decimal and
  depends on the installed symbol table. A mis-based store address
  persists for every later reader.
- No zod (it is only an undeclared transitive of @mastra).
