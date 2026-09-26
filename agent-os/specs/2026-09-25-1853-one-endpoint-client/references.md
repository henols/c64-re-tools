# References for One Endpoint Client

## Similar Implementations

### The endpoint client

- **Location:** `src/mcp/vice/host-tool-endpoint.mts` (`runHostToolOverEndpoint`)
- **Relevance:** this is the client every caller moves onto.
- **Key patterns:** `host_tool_stage` → upload each file → `host_tool_run` → download each result handle into `<toolsRoot>/<HOST_TOOL_KIND_DIR[tool]>/`. It never throws.

### Dial and transfer

- **Location:** `src/mcp/vice/broker-endpoint.ts` (`dialHostToolSession`, `DEFAULT_CONTROL_PORT`, `CLIENT_VERSION`), `src/mcp/vice/transfer-client.mts` (`transferFileOverEndpoint`)
- **Relevance:** the fixed-port dial with the `hello` handshake, and the byte transfer by handle.
- **Key patterns:** the candidate order is `127.0.0.1`, then `host.docker.internal`. There is no discovery file and no token.

### The broker side

- **Location:** `src/mcp/vice/vice-broker.mts` (`handleHostToolStage`, `handleHostToolRun`), `src/mcp/vice/broker-transfer.mts` (`stageHostToolRequest`), `src/mcp/vice/host-tool.mts` (`bindStagedInputs`, `runHostTool`)
- **Relevance:** the scratch staging and handle-bound results.

### Test broker

- **Location:** `src/mcp/vice/broker-harness.ts` (`startHarnessBroker`)
- **Relevance:** gives tests and CI their own broker.
- **Key patterns:** a fresh `VICE_BROKER_HOME` and control port. It returns `childEnv` and `stop()`.

### End-to-end test on the new route

- **Location:** `src/mcp/vice/host-tool-endpoint.test.ts`
- **Relevance:** the model for moving `skill-acme-build-cli.test.ts` onto a harness broker.

### Locating vendored files

- **Location:** `findDxaBinary` in `src/mcp/vice/host-tool.mts` (about line 2682)
- **Relevance:** tries `HERE/vendor/…`, then `HERE/../vendor/…`. The Ghidra extension lookup copies this.

### Version lookup

- **Location:** `resolveBrokerVersion` in `src/mcp/vice/broker-control.mts` (about line 762)
- **Relevance:** reads `package.json` beside the module, then one directory up. The client version lookup copies this.
