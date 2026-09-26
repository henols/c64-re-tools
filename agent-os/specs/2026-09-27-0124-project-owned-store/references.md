# References for Project-Owned Store

## Similar Implementations

### The broker's anno answer loop

- **Location:** `src/mcp/vice/anno-worker.mts` (`answerAnnoRequest`), as of `b93adeac`
- **Relevance:** it dispatches a tool or report on a project handle and maps
  a report refusal to `refused` and any other failure to `failed`. The
  workspace-store runner reuses this dispatch in-process, without the thread.

### The in-process test broker

- **Location:** `src/mcp/vice/inproc-anno-broker.ts` (`answerInProcess`)
- **Relevance:** it already answers every call in-process against a database
  file, with inputs read as basename plus bytes. The production runner has
  the same shape.

### Store export document

- **Location:** `src/mcp/vice/anno-store-export.mts`
- **Relevance:** export-project and import-project keep working as text
  copies and fixture exports of the committed database.

### The superseded milestone

- **Location:** `agent-os/specs/2026-09-26-2233-broker-owned-store/`
- **Relevance:** its call-surface decisions carry forward: no `store`
  argument, staged file references, and the required `--out`. Its
  store-location decisions are superseded.
