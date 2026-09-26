# Standards for One Endpoint Client

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

## skills/cross-package-reach

Skill scripts ship in `@henols/c64-re-tools`. MCP modules ship in
`@henols/vice-mcp`. A script never statically imports across that line.

```ts
const mod = resolveMcpModule("host-tool-client.ts");
if (!mod.ok) return { ok: false, message: refusalMessage("host-tool-client.ts", mod.rungs) };
spawn(process.execPath, [mod.path, "run", "--tool", tool, "--args", JSON.stringify(args)]);
```

- Locate MCP modules with `resolveMcpModule()` and run them with
  `process.execPath`. That is the only spawn a script makes.
- External binaries (petcat, c1541, acme, ...) are reached only through
  the host-tool seam as a typed request. Never spawn one directly, not
  even as a fallback.
- A missing module is refused with `refusalMessage()`, which names every
  location tried.

---

## skills/script-results

New skill scripts are plain `.ts`, run on Node >= 24. Never hand-write
new `.mjs`. Existing `.mjs` scripts are legacy.

The last stdout line is one JSON object:

```json
{ "ok": true, ... }
{ "ok": false, "message": "petcat: not a BASIC program (x.prg)" }
```

- `ok: false` exits non-zero. `ok: true` exits 0.
- Never print `ok: true` with an empty, partial or guessed verdict.
- A wrapped tool's exit code does not decide success. The script's own
  classifier does (`petcat` exits 0 on garbage).
- Helpers that call out resolve to `{ ok: false, message }` and never
  reject, so callers need no try/catch.

---

## skills/refuse-never-guess

When a required fact or input is missing or ambiguous, refuse and name
why. Never substitute a fallback.

```json
{ "ok": false, "message": "no literal SYS address in line 10 (SYS PEEK(43)+...)" }
```

- Never auto-pick an input file. Require it by name.
- Never guess an entry point, handover address or offset. A wrong value
  is spent downstream (disassembly, diffs) and is expensive to find.
- Pass the tool's decline reason through verbatim.
- "I don't know" is a valid, reportable result. A plausible default
  is not.

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
