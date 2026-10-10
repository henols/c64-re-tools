# Debug installation

## Prerelease

The prerelease is on the npm channel `next`. Use `@next` in place of `@latest`, on every machine:

```
npx -y --package=@henols/c64-re-tools@next c64-re-tools-host
npx -y @henols/c64-re-tools@next install --target claude
```

## Dev container

The agent runs in the container, VICE and the Host Runtime on the host. On the host:

```
export C64RT_HOST_TOKEN=$(openssl rand -hex 16)
npx -y --package=@henols/c64-re-tools@next c64-re-tools-host --listen 172.17.0.1
```

In the container, set the same `C64RT_HOST_TOKEN`, then install as usual. `status` must show the Host Runtime as reachable.

## Trace

Set `C64RT_TRACE` to a directory. Each program then writes what it does there, as JSON lines. The Host Runtime also keeps a copy of VICE's log.

On the host:

```
C64RT_TRACE=$HOME/c64-trace npx -y --package=@henols/c64-re-tools@next c64-re-tools-host
```

For the MCP server and the skill scripts, in the project's `.claude/settings.local.json`:

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
