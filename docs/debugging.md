# Debugging

## The trace

Set `C64RT_TRACE` to a directory. Each program then writes what it does to a file of its own there, as JSON lines. The lines hold requests, tool calls, VICE starts and exits, native tool runs and errors, each with its time. The Host Runtime also keeps a copy of VICE's log. Nothing of the trace reaches the agent.

On the host:

```
C64RT_TRACE=$HOME/c64-trace npx -y --package=@henols/c64-re-tools@<channel> c64-re-tools-host
```

For the MCP server and the skill scripts, in the project's `.claude/settings.local.json`:

```json
{ "env": { "C64RT_TRACE": "/absolute/path/to/trace" } }
```

## Field test

The field test installs c64-re-tools into a fresh project and lets an agent work with it. The agent and you write notes while it works. At the end, one report comes back with the trace, the notes and the agent's transcripts. It works on one machine and in a dev container.

The kit is in this repository and is not part of the npm package. The steps are in [test/field/README.md](../test/field/README.md).
