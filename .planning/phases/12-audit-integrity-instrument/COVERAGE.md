No external API integration: this phase changes text-scanning and error-handling internals of a local Node script (`scripts/audit-gate.mjs`) wired as a Claude Code `PreToolUse` hook, verified by `node --test` against synthetic on-disk trees — no SDK, HTTP client, network service, or credentialed endpoint is touched.

---

## Why the detector fired, and why it is a false positive

The deterministic api-coverage detector reported `detected: true` on exactly one
signal:

```
{verb: "wiring", noun: "mcp", snippet: "Add a wiring test group to `.claude/mcp/vice/audit-integrity.test.ts`. Its"}
```

Confirmed by re-reading the phase scope rather than by preference:

- The noun `mcp` comes from a **directory name**. `.claude/mcp/vice/` is where
  this repo keeps its Node sources and its colocated `*.test.ts` files;
  `audit-integrity.test.ts` lives there because that is where `npm test` runs,
  not because it touches the `vice` MCP tool surface. Nothing in this phase
  imports `@mastra/mcp`, `@modelcontextprotocol/sdk`, `vice.ts`,
  `vice-proxy.ts`, or any `vice_*` tool.
- The verb `wiring` means a `PreToolUse` entry in `.claude/settings.json` — a
  local process contract (stdin JSON in, exit code out), dispatched by the Claude
  Code process on the same machine. No transport, no auth, no rate limit, no
  versioned remote surface.
- The only cross-process boundaries in scope are Node's own `--test` runner,
  invoked via `spawnSync` with an argv array built from a `readdirSync` listing,
  and that hook stdin/exit-code convention.
- `grep -rl "audit-gate\|MILESTONE-AUDIT" .claude/skills/` returns nothing: none
  of the six C64 reverse-engineering skills is in scope either.

A capability matrix here would have to invent a capability that does not exist,
so this reasoned declaration stands in its place — the same contract an
`OPT-OUT` row carries, with the reason stated rather than assumed.
