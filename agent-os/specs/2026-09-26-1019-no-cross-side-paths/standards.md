# Standards for No Cross-Side Paths

The following standards apply to this work.

---

## broker/host-bound-modules


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
  `resources-sync.test.ts` reds on drift.
- A new host-bound module goes in both lists. build() fails on any
  mismatch.

---

## global/injectable-deps


A module that touches processes, sockets, clocks or the filesystem
takes an optional `XDeps` object. Each field defaults to the real one:

```ts
export interface VerifiedKillDeps {
  isAlive?: (pid: number) => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  sleepMs?: (ms: number) => Promise<void>;
}

const isAlive = deps.isAlive ?? defaultIsAlive;
const kill = deps.kill ?? defaultKill;
```

- Production call sites pass no deps.
- Tests inject fakes for the side-effecting leaves only. Never stub the
  function under test or the seam that wires it.
- Paths get an explicit `dir` override so tests never write the real
  machine-level root.

---

## global/atomic-state-files


Write state/record files atomically, owner-only:

```ts
const tmp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
writeFileSync(tmp, "");
chmodSync(tmp, 0o600);        // tighten BEFORE content lands
writeFileSync(tmp, content);
renameSync(tmp, path);
```

- Readers see no file or a complete file, never a partial one.
- mkdir with `{ recursive: true }` only. Never check-then-create, because
  concurrent brokers race on it.
- Read host-written files back as untrusted: parse in try/catch,
  validate every field's type, ignore unknown fields, and never open a
  path taken from the content.
- An absent file is a normal state. Return `{ present: false, reason }`
  and don't throw.

---

## global/module-header


Every non-test module opens with this header:

```ts
#!/usr/bin/env node
// stock-address.ts
//
// WHY THIS FILE EXISTS: the one address parser for stock handlers, so
// no family module re-derives decimal/$hex/0x parsing or range checks.
//
// WHAT NOT TO DO:
//   - Never re-derive an address regex in a family module.
//   - Never treat a bare decimal string as hex here.
```

- Keep it short: the file's one job, then the concrete mistakes it prevents.
- No history, no plan/decision/review ids (D-07, WR-06, 64-12).
  Those go in git.

## Import cycles

- Shared types and helpers go in a leaf module that both sides import
  (e.g. stock-handler.ts). Never import the dispatcher back.
- Types-only back-edges use `import type`, which erases at compile time.
- Inside a known runtime cycle, export `function` declarations, never
  `const` arrows. A const in the cycle throws ReferenceError at load.

---

## mcp/tool-answers


Build results only through `stock-handler.ts`:

```ts
return stockAnswer(session.client, { address, bytes });   // sessioned
return derivedAnswer({ symbols });                         // "pure" tool (no session)
return isErrorText(`vice_memory_read: size must be 1-65535, got ${n}`);
return convertWireError("vice_memory_read", err);          // client.send() rejected
return convertHandshakeError(toolName, err);               // session/connect failed
```

- Never write a `{ content, isError }` literal. `stockAnswer()` stamps
  `runState` on every answer, and a handler never supplies its own.
- Never write a third error converter. A new wire/handshake case gets a
  branch in one of the two existing converters.
- Refusal text starts with `toolName:`, says what happened, and names the
  remedy (an env var, an argument, a retry being safe).
- Never pass a raw errno through alone; wrap it with its likely cause.
