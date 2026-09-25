# Cross-Package Reach

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
