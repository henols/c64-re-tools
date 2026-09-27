# Cross-Package Reach

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

## Sibling skills

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
