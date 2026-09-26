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
