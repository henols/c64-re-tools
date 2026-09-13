---
created: 2026-09-13T00:00:00.000Z
title: vice-launcher.sh execs a bare `node`, so the broker runs under whatever version the caller exposes
area: broker
severity: minor
files:

  - src/mcp/vice/resources/vice-launcher.sh:169
---

# The broker's interpreter is whatever `node` happens to mean

`resources/vice-launcher.sh:169` ends with:

```sh
exec node "$BROKER_ARTIFACT" --repo-root "$REPO_ROOT" "$@"
```

Bare `node`, resolved from whatever `PATH` the launching context carries. No
version check, no explicit interpreter.

**MEASURED on this host 2026-09-13** — the resolution is not stable:

- interactive shell (nvm default): **v24.20.0**
- `env -i bash -lc 'which node'`: **/bin/node, v20.19.2**
- bare `sh -c 'command -v node'`: **/usr/bin/node**, Debian `nodejs` 20.19.2

Four Node versions are installed (nvm v20.20.0 / v22.13.0 / v22.22.0 / v24.20.0,
plus the system 20.19.2). Which one the broker gets depends on how it was
launched, and nothing records or checks that.

**Why it has not bitten yet:** the deployed broker artifact is compiled `.mjs`,
so it runs on Node 20 fine. The compile step is absorbing this. That also means
the exposure is invisible until someone reaches for a newer Node feature or
removes the compile step — see the seed
`typescript-everywhere-and-the-node-floor.md`, which is blocked on exactly this.

**The systemd trap, concretely.** No VICE broker unit is installed today, but
the user's existing `~/.config/systemd/user/nanoclaw.service` sets
`Environment=PATH=/usr/local/bin:/usr/bin:/bin:/home/henrik/.local/bin` — no nvm
path. A broker unit written to that shape resolves bare `node` to v20.19.2.

**Remedy, in this project's established shape (detect, then refuse by name with
the remedy — never auto-install):**

1. Resolve an explicit interpreter rather than `exec node`. The MCP server's own
   `process.execPath` is a candidate, since that process already satisfies
   `engines.node >= 24` — but confirm it is reachable from the host side, which
   is a different process boundary; do not assume it.
2. If the resolved Node is below the floor, refuse by name and print the remedy,
   rather than starting and failing later in a way that reads as a wedge.
3. Record the resolved interpreter in the broker record, so a triage session can
   see which Node a given broker actually ran under.
