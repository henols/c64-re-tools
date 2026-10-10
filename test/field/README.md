# Field test

A field test installs c64-re-tools into a fresh project, as a user does, and lets a Claude session work with it. One report comes back here. It shows what the programs did, what the agent thought, and what the tester saw.

Nothing in this directory is part of the npm package. The kit in `kit/` holds the `c64-field-debug` skill, the session prompts, `install.ts` and `bundle.ts`. The kit imports nothing from `src/`, so a git clone of the release tag is enough to run it. `report.ts` runs here, in this checkout.

## In a dev container

The agent, the MCP server and the skill scripts run in the container. The Host Runtime runs on the machine with VICE. They share no files: they use TCP only.

1. On the host, start the Host Runtime with its trace. Use a token of 16 characters or more, and the address of the container bridge:

   ```
   export C64RT_HOST_TOKEN=<secret>
   C64RT_TRACE=$HOME/c64-field/host-trace npx -y --package=@henols/c64-re-tools@next c64-re-tools-host --listen 172.17.0.1
   ```

2. In the container, in the project directory, set the same token and run the kit:

   ```
   export C64RT_HOST_TOKEN=<secret>
   git clone -q --depth 1 --branch v2.0.0-rc.1 https://github.com/henols/c64-re-tools ~/.cache/c64-field-kit
   node ~/.cache/c64-field-kit/test/field/kit/install.ts
   ```

   The script installs `@henols/c64-re-tools@next` through npx and copies the debug skill and the prompts into the project. It writes `C64RT_TRACE` and the token into `.claude/settings.local.json`. Claude Code gives that env to the MCP server and to every skill script.

   On Linux, the container must resolve `host.docker.internal`. Add `"runArgs": ["--add-host=host.docker.internal:host-gateway"]` to `devcontainer.json`.

3. Put a `.prg` or a `.d64` into `field-test/target/`. Write its name into `field-test/03-re-workflow.md`.

4. Start Claude Code in the project. Paste the prompts in this order: `field-test/01-comprehension.md`, `02-dev-workflow.md`, `03-re-workflow.md`, `99-debrief.md`. To record what you see, start a chat message with `note:`. The agent saves your words as your note, and adds its own note on the same problem.

5. Quit Claude Code. Then bundle the run in the container:

   ```
   node ~/.cache/c64-field-kit/test/field/kit/bundle.ts
   ```

   The bundle is `field-test/bundle-<time>.tgz`. It holds the notes, the container trace, the Claude transcripts, a knowledge summary, the skill descriptions, the status and the configuration without its secrets. With the usual workspace mount, the host sees the file at once. Otherwise, copy it to the host with `docker cp`.

6. In this checkout, make the report:

   ```
   node test/field/report.ts <bundle.tgz> --host-trace $HOME/c64-field/host-trace
   ```

   The report goes to `field-reports/<bundle>/`, which git ignores. Read `summary.md`.

## On one machine

`setup.ts` packs this checkout, makes a fresh project and runs the kit's `install.ts` with the tarball. The host then writes into the project's trace, so the report needs no `--host-trace`.

```
node test/field/setup.ts ../field-project
```

Then do steps 3 to 6 above. The script prints each command with its paths.

## The report

`summary.md` has these sections:

- **Builds and clocks**: the c64-re-tools version of each program, and the clock difference between the container and the host. All times in the report use the host's clock.
- **Failures**, grouped by program, event and error code.
- **Slowest operations**.
- **Host connections**: each address that the clients tried, and each refused handshake.
- **VICE**: starts, exits, drive stops, timeouts.
- **Notes**, grouped by component. The tester's notes come first. Each note shows the trace events of the same minute that are nearest to it.
- **Comprehension**: what the agent thinks each skill and tool does, next to its description.
- **Knowledge**: the rows in `knowledge.db` by origin.

## What the trace holds

With `C64RT_TRACE`, every program appends JSON lines to a file of its own: `host-…`, `mcp-…`, `script-…` and `cli-…`. Each line has `t` (ISO 8601 at `+01:00`), `kind`, `event` and the fields of the event. The first line, `trace.start`, names the version that runs. The host also keeps a copy of VICE's own log. See `src/trace.ts`.

A host and a client of different releases speak different protocol versions, and the handshake refuses them. The refusal names the older side and how to update it.
