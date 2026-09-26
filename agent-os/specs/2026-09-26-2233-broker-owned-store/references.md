# References for Broker-Owned Store

## Similar Implementations

### Host-tool request route

- **Location:** `src/mcp/vice/vice-broker.mts` (`stageHostToolRequest`, `resolveStagedFile`, `registerHostToolResult`), `broker-control.mts` (`host_tool_stage` / `host_tool_run` arms)
- **Relevance:** it already stages client bytes under a per-connection request key, runs broker-side work asynchronously, and returns results by handle. `anno_run` reuses the same staging and result registration.

### Endpoint client leaf

- **Location:** `src/mcp/vice/host-tool-endpoint.mts`, `broker-endpoint.mts` (`dialKeptSocket`, `dialHostToolSession`, `TRANSFER_TAG` comment)
- **Relevance:** the pattern for `dialAnnoSession()`. The `TRANSFER_TAG` comment already anticipates "the anno seam".

### Store export document

- **Location:** `src/mcp/vice/anno-store-export.ts` (`exportStoreDocument`, `importStoreDocument`)
- **Relevance:** the deterministic JSON round trip. It becomes the v2 document, which carries fixtures, `export-project` and `import-project`.

### Test broker harness

- **Location:** `src/mcp/vice/broker-harness.ts` (`startHarnessBroker`)
- **Relevance:** spawns the compiled broker on a dynamic port with a temp `VICE_BROKER_HOME`. Every transport test uses it.

### Structural seam test

- **Location:** `src/mcp/vice/path-seam-absent.test.ts`
- **Relevance:** the scan plus planted-violation proof that the new `node:sqlite` confinement and "no `store` argument" checks follow.
