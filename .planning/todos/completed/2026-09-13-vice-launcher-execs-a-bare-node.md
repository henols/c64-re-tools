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

---

## Resolution

**Closed 2026-09-13** by quick task `260913-o1w`, commits `321b0804`, `05a7d4b0`,
`4ca6c3d4`, `15e9d5a7`, `ab0e15e1`. Verifier returned GOAL_ACHIEVED, 8/8, with every
check driven against the real tree rather than read off the summary.

All three wanted behaviours landed:

1. **Explicit interpreter.** `vice-launcher.sh` now resolves `VICE_BROKER_NODE`, then
   PATH, and execs a shell variable holding an absolute path. The MCP server's own
   `process.execPath` was evaluated and REJECTED as a route: nothing in the shipped tree
   spawns the launcher — every reference is a path printed in a message for a human to
   type — so there is no parent/child relationship to inherit or pass it through, and
   under a devcontainer the server's `execPath` is a container path with no host
   counterpart. That was verified, not assumed.
2. **Refuse by name.** A below-floor interpreter exits 4 BEFORE exec, naming the offending
   binary, the version it reported, the floor, and both remedies. Driven live with a stub
   reporting `v20.0.0`: stdout empty, broker artifact never reached. Nothing is installed
   and no package manager is invoked.
3. **Recorded in the broker record.** `broker.json` gained `node_exec_path`, taken from the
   broker's own `process.execPath` — so it stays truthful even when the broker is started
   directly rather than through the launcher. The key set moved from thirteen to fourteen.

**The floor is the major from `engines.node`, not a second hardcoded number.** A drift test
fails if the launcher's literal and `package.json` disagree, so the bash half cannot silently
diverge from the package half — the same drift class the bare interpreter itself was.

**Accepted consequence, recorded rather than buried:** the broker previously WORKED when
launched from a stripped environment resolving `/usr/bin/node` v20.19.2, because the deployed
artifact is compiled `.mjs`. It now refuses there. That is the intended trade — fail loud
rather than run on an interpreter nobody chose — and `VICE_BROKER_NODE` is the escape hatch
for a conforming binary that is simply not on PATH. A host's nvm 22.22 is likewise refused.

**Two deviations, both flagged rather than hidden**, on `broker-kill.test.ts`'s self-reexec
structural guard. It banned the substring `execPath` outright, which blocked the legitimate
new field. The first replacement — a spawn-construct regex — was bypassable by one variable of
indirection and so was weaker than what it replaced. The final form pins the occurrence count
at exactly one, on the one permitted line, AND keeps the regex as a legible statement of the
hazard, and covers both dot and bracket property access. Proven non-vacuous in both spellings:
each plant reds the test, each revert greens it at 38/38.

Remaining, deliberately NOT done here: raising `installer/package.json`'s `engines.node`.
That is seeded in `typescript-everywhere-and-the-node-floor.md` and was blocked on this work,
not the other way round.
