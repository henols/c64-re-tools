# References for Ghidra Without the Symlink Alias

## Similar Implementations

### Staging sweep

- **Location:** `src/mcp/vice/broker-kill.mts` (`sweepOrphanedStaging`), called in `vice-broker.mts` right after the bind
- **Relevance:** reused as-is, with `root: brokerGhidraDir()`. It is safe at the same post-bind point, with no `await` in between, because no run can be live yet.

### Executor-only option

- **Location:** `src/mcp/vice/host-tool.mts` (`HostToolDeps.outputDir`)
- **Relevance:** the precedent for `ghidraProjectsRoot`: the broker sets it, in-process callers name their own, and no request can.

### Dotted-segment check

- **Location:** `src/mcp/vice/ghidra-project.mts` (`hasDotPrefixedSegment`, `DOT_SEGMENT_REFUSAL`)
- **Relevance:** the existing predicate for the new root's refusal. Its measured basis (Ghidra checks the absolutized path) still holds.

### Broker-home resolvers

- **Location:** `src/mcp/vice/broker-home.mts` (`brokerStagingDir`, `brokerConfigScratchDir`)
- **Relevance:** the shape and injectable options for `brokerGhidraDir()`.
