# Standards for Clean Unused Code and Move Tests

The following standards apply to this work.

---

## global/module-header

## Module Header

Every non-test module opens with this header:

```ts
##!/usr/bin/env node
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

### Import cycles

- Shared types and helpers go in a leaf module that both sides import
  (e.g. stock-handler.ts). Never import the dispatcher back.
- Types-only back-edges use `import type`, which erases at compile time.
- Inside a known runtime cycle, export `function` declarations, never
  `const` arrows. A const in the cycle throws ReferenceError at load.

---

## broker/host-bound-modules

## Host-Bound Modules

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

---

## skills/cross-package-reach

## Cross-Package Reach

Each skill folder is installed on its own (`npx skills add`, or the
plugin), with no MCP tree beside it. MCP modules ship in `@henols/vice-mcp`
and in the plugin's `src/mcp/vice/`. A script never statically imports
across that line.

```ts
const mod = resolveMcpModule("resources/host-tool-endpoint.mjs");
if (!mod.ok) return { ok: false, message: refusalMessage("resources/host-tool-endpoint.mjs", mod.rungs) };
spawn(process.execPath, [mod.path, "run", "--tool", tool, "--args", JSON.stringify(args),
  "--tools-root", toolsRoot, "--base-dir", baseDir]);
```

- Locate MCP modules with `resolveMcpModule()` and run them with
  `process.execPath`. That is the only spawn a script makes.
- A module that may be loaded from `node_modules` must be compiled
  JavaScript, because Node does not strip types there: a `resources/*.mjs`
  file, or the package's `dist/` copy of a `.ts` module (rung 3 of
  `resolveMcpModule()` maps `x.ts` to `dist/x.js` on its own).
  Host-tool calls go through `invokeHostTool()` in `mcp-module.ts`, which
  wraps the snippet above.
- External binaries (petcat, c1541, acme, ...) are reached only through
  the host-tool seam as a typed request. Never spawn one directly, not
  even as a fallback.
- A missing module is refused with `refusalMessage()`, which names every
  location tried.

### Sibling skills

A skill may be installed without the `c64-project` skill it uses. Never
value-import a sibling skill statically; load it through the skill's
`scripts/sibling.ts` so a missing sibling is a refusal that names it.

```ts
import type { HostToolResponse } from "../../c64-project/scripts/mcp-module.ts"; // erased: fine
const mcp = await loadSibling(() => import("../../c64-project/scripts/mcp-module.ts"), "mcp-module.ts", "c64-basic");
if (!mcp.ok) return { ok: false, message: mcp.message };
```

- `import type` from a sibling is fine: it erases at runtime.
- Keep the thunk's specifier literal, so tsc types the module.
- Keep every `sibling.ts` copy identical by hand. No test compares them.

---

## global/injectable-deps

## Injectable Deps

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
