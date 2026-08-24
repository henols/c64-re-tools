---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-24T09:42:05.932Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260823-kf6 | deviation | src/mcp/vice/audit-integrity.test.ts | 262 | Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md | open |  | 2026-08-23T12:59:39.120Z |  |
| 2 | 18 | deviation | src/mcp/vice/r2000-cli.test.ts |  | npm test (no flags) never exits when regenerator2000 is installed locally -- pre-existing, unrelated to plan 18-03's own file changes (confirmed via import-chain inspection); reproduced deterministically against r2000-cli.test.ts alone. Worked around locally via node --test-force-exit. See .planning/phases/18-persistent-session-and-tool-surface/deferred-items.md item 1. | open |  | 2026-08-24T09:42:05.932Z |  |

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
    "file": "src/mcp/vice/r2000-cli.test.ts",
    "line": null,
    "description": "npm test (no flags) never exits when regenerator2000 is installed locally -- pre-existing, unrelated to plan 18-03's own file changes (confirmed via import-chain inspection); reproduced deterministically against r2000-cli.test.ts alone. Worked around locally via node --test-force-exit. See .planning/phases/18-persistent-session-and-tool-surface/deferred-items.md item 1.",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-24T09:42:05.932Z",
    "resolved_at": null
  }
]
````
