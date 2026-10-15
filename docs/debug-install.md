# Debug installation

## Prerelease

The prerelease is on the npm channel `next`. Use `@next` in place of `@latest`, on every machine:

```
npx -y --package=@henols/c64-re-tools@next c64-re-tools-host
npx -y @henols/c64-re-tools@next install --target claude
```

## Dev container

The agent runs in the container, VICE and the Host Runtime on the host. Start the Host Runtime on the host as usual; it listens on every address. In `devcontainer.json`:

```json
"runArgs": ["--add-host=host.docker.internal:host-gateway"]
```

Then install in the container as usual, or add the Feature from the README with the prerelease:

```json
"features": {
  "https://github.com/henols/c64-re-tools/releases/download/v<version>/devcontainer-feature-c64-re-tools.tgz": { "target": "claude", "channel": "next" }
}
```

`status` must show the Host Runtime as reachable.

## Trace

Each program writes what it does to a directory, as JSON lines. The Host Runtime also keeps a copy of VICE's log.

On the host, `--log-dir` names the directory, and `--log-console` prints the same events:

```
npx -y --package=@henols/c64-re-tools@next c64-re-tools-host --log-dir $HOME/c64-trace --log-console
```

From a checkout: `pnpm host --log-dir $HOME/c64-trace --log-console`.

For the MCP server and the skill scripts, set `C64RT_TRACE` in the project's `.claude/settings.local.json`:

```json
{ "env": { "C64RT_TRACE": "/absolute/path/to/trace" } }
```

## Field test

Tests c64-re-tools with an agent and brings back one report. In the project:

```
git clone -q --depth 1 --branch "v$(npm view @henols/c64-re-tools@next version)" https://github.com/henols/c64-re-tools ~/.cache/c64-field-kit
node ~/.cache/c64-field-kit/test/field/kit/install.ts
```

It prints the next steps.
