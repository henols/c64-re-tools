# References for Deletion Cutover

## Similar Implementations

### Host-tool session dialer

- **Location:** `src/mcp/vice/broker-endpoint.mts` (`dialHostToolSession`, `makeHostToolSession`)
- **Relevance:** the pattern for `dialControlSession()`: a hello race that keeps the winning socket and then exchanges request/reply lines on it.

### Control session framing

- **Location:** `src/mcp/vice/vice-broker-client.ts` (`createSession`, `BrokerControlSession`)
- **Relevance:** the newline/FIFO request framing the new session reuses, minus the token.

### Dial failure wording

- **Location:** `src/mcp/vice/broker-endpoint.mts` (`describeDialFailure`, `BROKER_START_COMMAND`)
- **Relevance:** replaces the never-started, dead-or-hung and control-unreachable messages.

### Test broker

- **Location:** `src/mcp/vice/broker-harness.ts` (`startHarnessBroker`)
- **Relevance:** a real compiled broker on a fresh port and home, for the lease tests.

### Import detector and planted violations

- **Location:** `src/mcp/vice/hostpath-consumers.test.ts`
- **Relevance:** its comment-stripping import detector and planted-violation tests carry over into `path-seam-absent.test.ts`.
