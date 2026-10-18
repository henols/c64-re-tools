# Debugging a run

<img src="../assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="300">

## Trace

Use this when a tool fails and its error does not tell why. Each program writes what it does to a directory, as JSON lines. The Host Runtime also keeps a copy of VICE's log. Nothing of the trace reaches the agent.

On the host, `--log-dir` names the directory, and `--log-console` prints the same events:

```
npx -y --package=@henols/c64-re-tools@latest c64-re-tools-host --log-dir $HOME/c64-trace --log-console
```

From a checkout: `pnpm host --log-dir $HOME/c64-trace --log-console`.

For the MCP server and the skill scripts, set `C64RT_TRACE` in the project's `.claude/settings.local.json`:

```json
{ "env": { "C64RT_TRACE": "/absolute/path/to/trace" } }
```

## The container does not work

Use this when `npx -y @henols/c64-re-tools@latest status` in the container shows a problem.

**The Host Runtime is not reachable.** Make sure that the Host Runtime runs on the host. The container finds it as `host.docker.internal` through `runArgs` in `devcontainer.json`. If the host has another address, set `C64RT_HOST`.

**The toolkit or its tools are old.** Each container start installs the newest toolkit and its tools. A new release is on npm some minutes after it is made; until then the container keeps the earlier one. To install now and see the output:

```
/usr/local/share/c64-re-tools/project.sh update
cat /usr/local/share/c64-re-tools/tools.version
```

`tools.version` shows the version of the installed tools.

**The build stops with `Digest did not match`.** Remove the c64-re-tools entry from `.devcontainer/devcontainer-lock.json` and rebuild the container.

## Report a problem with a field test

Use this when the agent fails or does the wrong thing with the toolkit, and you want to tell the c64-re-tools developers why. An agent works on one of your programs with a set of prompts. Each time a tool fails or a description is unclear, it writes a note. At the end you get one report to send with an issue.

In an empty project folder:

```
git clone -q --depth 1 --branch "v$(npm view @henols/c64-re-tools version)" https://github.com/henols/c64-re-tools ~/.cache/c64-field-kit
node ~/.cache/c64-field-kit/test/field/kit/install.ts
```

It prints the next steps: start the Host Runtime, add your program, give the prompts to the agent, and make the report.
