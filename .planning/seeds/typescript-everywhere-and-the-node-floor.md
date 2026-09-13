---
title: TypeScript for the skill scripts and the host broker — blocked by which node `node` resolves to, not by EOL dates
trigger_condition: When the installer's `engines.node` floor is next revisited, when `build.ts` is next touched, or when a skill script grows complex enough that the missing type checking actually costs a bug — whichever comes first. Re-run the probe below before acting; it is machine-specific and dated.
planted_date: 2026-09-13
---

# TypeScript everywhere, and why it is not available yet

## The idea

Two places in this project are plain JavaScript while everything else is
TypeScript:

- **18 skill scripts** under `src/skills/*/scripts/*.mjs` (0 `.ts`), and
- **the host broker**, authored as `.mts` but compiled by `build.ts` into
  committed `resources/*.mjs`.

Both exist for one reason: `installer/package.json` declares
`engines.node: ">=18"`, and TypeScript-without-a-build needs a much newer Node.
Anything that lands on an end user's machine therefore has to be plain JS or
pre-compiled. If the floor could rise, the skill scripts could become
TypeScript and `build.ts` could potentially be deleted outright.

## The tempting argument, and why it is wrong

The obvious case for raising the floor is end-of-life dates: Node 18 went EOL
2025-04-30 and Node 20 on 2026-04-30, so as of this writing the installer
supports two runtimes nobody should be running. `@henols/vice-mcp` already
requires Node >= 24, so a user on Node 18 cannot run the emulator tooling at
all — which makes the `>=18` floor look like it is protecting a configuration
that cannot function.

**That argument does not survive contact with the actual host.** The binding
constraint is not what is supported, it is **what `node` resolves to in a
non-interactive environment** — and `resources/vice-launcher.sh:169` execs a
bare `node`:

```sh
exec node "$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"
```

## MEASURED on this development host, 2026-09-13

Four Node installations are present, and the interactive one is not the one a
spawned process gets:

| resolution path | version | type-strips a `.mts`? |
|---|---|---|
| interactive `node` (nvm default) | v24.20.0 | **yes** |
| `env -i bash -lc node` → `/bin/node` | **v20.19.2** | **NO** |
| bare-env `sh -c 'command -v node'` | `/usr/bin/node` (Debian `nodejs` 20.19.2+dfsg) | **NO** |
| nvm v20.20.0 | v20.20.0 | NO |
| nvm v22.13.0 | v22.13.0 | NO |
| nvm v22.22.0 | v22.22.0 | yes |

Probed directly by running a two-line `.mts` under each binary, not inferred
from release notes. The unflagged-type-stripping boundary is bracketed between
**22.13 (fails)** and **22.22 (works)**, consistent with the 22.18 backport.

**So a compiled `.mjs` broker is load-bearing on this machine today, not
vestigial.** Deploy the broker as `.mts` and any launch that does not inherit
an interactive nvm PATH gets Node 20.19.2 and fails to start.

Corroborating pattern: the user's existing `~/.config/systemd/user/nanoclaw.service`
sets `Environment=PATH=/usr/local/bin:/usr/bin:/bin:/home/henrik/.local/bin` —
**no nvm path**. A VICE broker unit written to that same shape would resolve
bare `node` to v20.19.2. No VICE broker unit is installed at present; when one
is written, this is the trap.

## The actionable item hiding underneath

The version floor is the wrong thing to attack first. The real defect is that
**the launcher trusts bare `node`**, so the broker runs under whichever Node the
launching context happens to expose — v24 from an interactive session, v20 from
a service or a stripped environment. The compiled `.mjs` is what makes that
inconsistency survivable rather than fatal.

Pin the interpreter before touching the language:

1. Have the launcher resolve a known-good Node explicitly (the MCP server's own
   `process.execPath` is one candidate, since that process already satisfies
   `>=24`), rather than `exec node`.
2. Have it REFUSE BY NAME with the remedy when the resolved Node is too old —
   matching this project's standing detect-then-refuse rule for external tools,
   never auto-installing one.
3. Only then reconsider `engines.node`, the `.mjs` skill scripts, and whether
   `build.ts` still earns its place.

Step 1 is worth doing on its own merits even if the language split stays
forever.

## Related

- `src/mcp/vice/build.ts` — the compile step and its `HOST_BOUND_ARTIFACTS` set
- `src/mcp/vice/resources/vice-launcher.sh:169` — the bare `node` exec
- `src/mcp/vice/backend-detect.mts:71-80` — a workaround forced by the same
  split: `repo-root.ts` uses `.ts`-extension imports that only resolve under
  type-stripping, so a host-bound module takes `supervisorDir` as a passed-in
  string instead of importing the resolver
- `resources-sync.test.ts` — fails CI when the committed `.mjs` drifts from `.mts`
