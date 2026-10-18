# Debugging a run

<img src="../assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="300">

## Trace

Each program writes what it does to a directory, as JSON lines. The Host Runtime also keeps a copy of VICE's log. Nothing of the trace reaches the agent.

On the host, `--log-dir` names the directory, and `--log-console` prints the same events:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host --log-dir $HOME/c64-trace --log-console
```

From a checkout: `pnpm host --log-dir $HOME/c64-trace --log-console`.

For the MCP server and the skill scripts, set `C64RT_TRACE` in the project's `.claude/settings.local.json`:

```json
{ "env": { "C64RT_TRACE": "/absolute/path/to/trace" } }
```

## Dev container

`status` in the container must show the Host Runtime as reachable. The Host Runtime listens on every address, and `runArgs` in `devcontainer.json` lets the container reach it as `host.docker.internal`.

Each start installs the toolkit and its tools again, but only what changed. To do it now and see the output:

```
/usr/local/share/c64-re-tools/project.sh update
cat /usr/local/share/c64-re-tools/tools.version
```

`tools.version` is the toolkit version of the installed tools. A new release is on npm some minutes after its tag; until then the start keeps the earlier version.

If the build stops with `Digest did not match` for the Feature, remove its entry from `.devcontainer/devcontainer-lock.json` and rebuild.

## Field test

Tests c64-re-tools with an agent and brings back one report. In the project:

```
git clone -q --depth 1 --branch "v$(npm view @henols/c64-re-tools version)" https://github.com/henols/c64-re-tools ~/.cache/c64-field-kit
node ~/.cache/c64-field-kit/test/field/kit/install.ts
```

It prints the next steps.
