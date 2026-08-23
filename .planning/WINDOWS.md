---
schema_version: 1
open_count: 1
waived_count: 0
fixed_count: 0
total_count: 1
last_updated: 2026-08-23T12:59:39.120Z
---

# Broken Windows Ledger

> Cross-phase defect register. With `workflow.windows_enforce` enabled, `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | quick-260823-kf6 | deviation | src/mcp/vice/audit-integrity.test.ts | 262 | Pre-existing failure (T-12-04 hardcoded tech_debt=3 count), predates this task's commit 76f7b15; out of scope, see quick task's deferred-items.md | open |  | 2026-08-23T12:59:39.120Z |  |

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
  }
]
````
