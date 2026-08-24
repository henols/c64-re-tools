---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 1
total_count: 2
last_updated: 2026-08-24T10:06:33.000Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260823-kf6 | deviation | src/mcp/vice/audit-integrity.test.ts | 262 | Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md | open |  | 2026-08-23T12:59:39.120Z |  |
| 2 | 18 | deviation | src/mcp/vice/r2000-mcp-client.ts |  | npm test (no flags) never exited when regenerator2000 is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runR2000Tool() through r2000-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (r2000-cli.test.ts:1303 calls runR2000Tool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openR2000Session(); plain npm test now exits 0. | fixed | Root-caused and fixed at the wave-2 post-merge gate; the "pre-existing" attribution was inferred from the import chain, never measured against an unmodified checkout. | 2026-08-24T09:42:05.932Z | 2026-08-24T10:06:33.000Z |

````json
[
  {
    "id": 1,
    "kind": "deviation",
    "phase": "quick-260823-kf6",
    "file": "src/mcp/vice/audit-integrity.test.ts",
    "line": 262,
    "description": "Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-23T12:59:39.120Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "18",
    "file": "src/mcp/vice/r2000-mcp-client.ts",
    "line": null,
    "description": "npm test (no flags) never exited when regenerator2000 is installed locally. RESOLVED at phase 18 wave 2's post-merge gate: NOT pre-existing -- plan 18-03's rewire of runR2000Tool() through r2000-session.ts's HELD slot left every non-vice-proxy host pinned open by the child's ref'd stdio handles (r2000-cli.test.ts:1303 calls runR2000Tool once). Disproven by direct measurement: the same file exits in 2s at the wave-1 tip ebe90f8 and hung at f6a5b03. Fixed by unref'ing the child and its three stdio pipes in openR2000Session(); plain npm test now exits 0.",
    "status": "fixed",
    "reason": "Root-caused and fixed at the wave-2 post-merge gate; the \"pre-existing\" attribution was inferred from the import chain, never measured against an unmodified checkout.",
    "recorded_at": "2026-08-24T09:42:05.932Z",
    "resolved_at": "2026-08-24T10:06:33.000Z"
  }
]
````
