# Phase 19 — API Coverage Declaration

No external API integration: every surface this phase touches is local. The coverage
instrument reads a project file off disk and already-fetched store data through the
existing in-process session seam; the packer finding probes and spawns an optional
OS-level CLI oracle as a subprocess with an argument array; the description checker and
the attribution guards parse committed Markdown as strings. No network client, no HTTP or
webhook endpoint, no SDK, no OAuth flow, and no new external service is introduced,
consumed, or wrapped. The `mcp` and `api` vocabulary in the plan prose refers to this
repository's own already-shipped stdio tool surface and to `the external analyser`'s local
child-process protocol, both of which predate this phase and gain no new integration
here — the one net-new external dependency anywhere in the phase (`unp64`) is an optional
local executable that is probed, never installed, and never contacted over a network.

Detector state at plan time: `{"detected": false, "signals": []}` over the phase scope.
