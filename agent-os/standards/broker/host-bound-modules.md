# Host-Bound Modules

The broker runs on the host from compiled `resources/*.mjs`. A module
is host-bound only if it is listed in BOTH `tsconfig.build.json`
`include` AND `build.ts` `HOST_BOUND_ARTIFACTS`. (`.mts` alone does not
mean host-bound.)

```ts
import { brokerIncidentsDir } from "./broker-home.mjs";   // .mjs specifier
import type { BrokerState } from "./broker-state.mjs";   // type-only: loads unbuilt
```

- Import siblings with `.mjs` specifiers. Use `import type` when the
  module must also load unbuilt (from tests), and inject functions via
  Deps instead of value-importing them.
- Never value-import a container-side `.ts` (e.g. repo-root.ts,
  incident-record.ts). Mirror the constant or shape instead, and pin the
  agreement with a sync test.
- Run `node build.ts` after editing. Commit the regenerated `.mjs`.
  CI rebuilds and fails on drift.
- A new host-bound module goes in both lists. build() fails on any
  mismatch.
- Entry artifacts (`build.ts` `ENTRY_ARTIFACTS`, `tsconfig.entry.json`)
  are compiled too, but emitted beside their `.mts` source and never
  host-bound: the package bin `vice-cli`, which runs from `node_modules`.
  CI rebuilds it and fails on drift.
