# Field test

A field test installs the toolkit into a fresh project, as a user does, and lets a Claude session work with it. One report comes back here with what the programs did, what the agent thought, and what the tester saw.

Nothing in this directory is part of the package. You copy the `c64-field-debug` skill into the test project by hand, and never into `skills/`.

## Steps

1. Set the project up. The tarball comes from `npm pack` of this checkout, because `npx …@latest` still installs 1.1.0:

   ```
   node test/field/setup.ts ../field-project
   ```

   It prints the next commands, with the paths filled in. In short:

2. Copy the debug skill and the prompts into the project:

   ```
   cp -r test/field/c64-field-debug ../field-project/.claude/skills/
   mkdir -p ../field-project/field-test && cp test/field/prompts/*.md ../field-project/field-test/
   ```

   For the reverse-engineering task, put a `.prg` or a `.d64` into `field-test/target/` and write its name into `03-re-workflow.md`.

3. Start the Host Runtime with the trace on, in its own terminal:

   ```
   C64RT_TRACE=../field-project-field/trace npx -y --package=<tarball> c64-re-tools-host
   ```

4. Start Claude in the project with the trace on, so that the skill scripts write to it too (the MCP server gets it from `.mcp.json`):

   ```
   cd ../field-project && C64RT_TRACE=../field-project-field/trace claude
   ```

5. Paste `field-test/01-comprehension.md` as the first message. Then `02-dev-workflow.md`, then `03-re-workflow.md`, then `99-debrief.md`. While the agent works, write what does not work as you expect as a chat message that starts with `note:`. The agent saves it as your note, next to its own.

6. Collect the report:

   ```
   node test/field/collect.ts ../field-project
   ```

   It writes `field-reports/field-report-<time>/` with the trace, the notes, the transcripts, a knowledge summary and `summary.md`. Git ignores that directory.

7. In a session in this repository: read `field-reports/<run>/summary.md` and turn its findings into plan steps.

## What the trace holds

`C64RT_TRACE` makes every program append JSON lines to a file of its own: `host-…`, `mcp-…`, `script-…` and `cli-…`. Each line has `t` (ISO 8601 at `+01:00`), `kind`, `event` and the fields of the event. The host also keeps a copy of VICE's own log. See `src/trace.ts`.
