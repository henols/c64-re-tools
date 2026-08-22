# API Coverage — Phase 15 (Debt and Review Disposition)

No external API integration: this phase dispositions existing review findings and
pending todos, edits project-owned documentation, and executes three already-specified
live UAT scenarios against a locally installed VICE binary — it adds no client, no
transport, and no capability against any external service.

The `api-coverage.cjs` detector returns `{"detected": false}` against this phase's
ROADMAP section. The plan bodies do mention `mcp`, `tools-manifest.json` and
`tools/list`, which can trip the detector's noun vocabulary at seal time; those
mentions are all about **not** changing the existing surface:

- `tools-manifest.json` is machine-generated from the fork binary's own `tools/list`
  and this phase deliberately does **not** regenerate it (plan 15-11 records the
  `vice_snapshot_list` omission as deliberate per D-16, not as staleness).
- `capability-registry.ts` gains corrected **reason text** for an already-registered
  tool (`vice_machine_config_set`), not a new capability.
- No tool is added, removed, renamed, or given a new argument on either backend —
  `.planning/REQUIREMENTS.md` → Out of Scope: "Any new tool on either backend".
