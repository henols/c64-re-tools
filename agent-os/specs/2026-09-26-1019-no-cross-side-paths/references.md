# References for No Cross-Side Paths

## Similar Implementations

### Broker status reply

- **Location:** `src/mcp/vice/vice-broker.mts` (`handleStatus`), client parse in `vice-broker-client.ts` (`status()`)
- **Relevance:** already carries each instance's live `epoch` over the control connection. The lease's `brokerControl` session outlives an emulator crash, so it can be asked during a reconnect.

### Binary memory write

- **Location:** `src/mcp/vice/stock-memory.ts` (`handleMemoryWrite`, `memSetBody`, `resolveBank`)
- **Relevance:** the exact `MemorySet` path the new `vice_program_load` handler reuses, including the default bank and the ack-shape check.

### Byte staging (not used, for contrast)

- **Location:** `src/mcp/vice/stock-machine.ts` (`vice_autostart`, `vice_disk_attach`)
- **Relevance:** the route for files the emulator itself must open. `vice_program_load` does not need it, because its bytes go straight into RAM.

### Structural seam test

- **Location:** `src/mcp/vice/path-seam-absent.test.ts`
- **Relevance:** the scan and planted-violation proof that the new absence checks extend.
