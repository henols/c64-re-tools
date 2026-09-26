# Standards for skills-CLI install and a runnable npm server

The following standards apply to this work.

---

## skills/cross-package-reach

# Cross-Package Reach

Skill scripts ship in `@henols/c64-re-tools`. MCP modules ship in
`@henols/vice-mcp`. A script never statically imports across that line.

```ts
const mod = resolveMcpModule("resources/host-tool-endpoint.mjs");
if (!mod.ok) return { ok: false, message: refusalMessage("resources/host-tool-endpoint.mjs", mod.rungs) };
spawn(process.execPath, [mod.path, "run", "--tool", tool, "--args", JSON.stringify(args),
  "--tools-root", toolsRoot, "--base-dir", baseDir]);
```

- Locate MCP modules with `resolveMcpModule()` and run them with
  `process.execPath`. That is the only spawn a script makes.
- A module that may be loaded from `node_modules` must be a compiled
  `resources/*.mjs` file, because Node does not strip types there.
  Host-tool calls go through `invokeHostTool()` in `mcp-module.ts`, which
  wraps the snippet above.
- External binaries (petcat, c1541, acme, ...) are reached only through
  the host-tool seam as a typed request. Never spawn one directly, not
  even as a fallback.
- A missing module is refused with `refusalMessage()`, which names every
  location tried.

---

## skills/script-results

# Skill Script Results

Skill scripts are plain `.ts`, run on Node >= 24. Never hand-write
`.mjs`. Each skill's `scripts/` holds a `package.json` of
`{ "type": "module" }`, so a consumer project's own `"type"` never
decides how the installed scripts load.

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

# Refuse, Never Guess

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

## skills/skill-md-shape

# SKILL.md Shape

~~~markdown
---
name: c64-petcat
description: <what it does, one sentence>. Use when asked to <trigger>,
  <trigger>, or <trigger>.
---

# <Doing the thing>

**<The one rule whose violation is expensive.>** <Why, 1-2 lines.>

```bash
S=src/skills/c64-petcat/scripts/petcat.ts   # from the repo root
```

## <Task sections, in the order the work happens>
## Failure shape
## What this skill does NOT do
## Troubleshooting
~~~

- The description lists the phrases a user actually says. It is the
  only thing that triggers the skill.
- One script per skill, bound to a shell variable once and reused.
- Troubleshooting is a `Symptom | Correct` table. Symptom is the literal
  error text.
- No skill-map table, no dated history, no withdrawal notes. Link another
  skill inline only where the reader must go next.

---

## broker/host-bound-modules

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
  `resources-sync.test.ts` reds on drift.
- A new host-bound module goes in both lists. build() fails on any
  mismatch.
- Entry artifacts (`build.ts` `ENTRY_ARTIFACTS`, `tsconfig.entry.json`)
  are compiled too, but emitted beside their `.mts` source and never
  host-bound: package bins that run from `node_modules` (`vice-cli`,
  the installer CLI). `entry-sync.test.ts` reds on drift.

---

## global/module-header

# Module Header

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
