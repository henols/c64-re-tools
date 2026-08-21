---
created: 2026-08-21T00:00:00.000Z
title: Planted fixture -- NOT a real todo
---

## Problem

This file exists only as a committed input to
`docs-review-disposition.test.ts`'s planted-false-negative test (AUDIT-01,
plan 11.1-07 Task 4). It exists to prove that `isDispositioned()` reports the
synthetic finding **WR-99** (introduced by the sibling fixture,
`planted-review-fixture.md`) as dispositioned when a disposition source
actually names it -- pinning that the guard reads disposition sources rather
than unconditionally reporting every id as undispositioned (which would
falsely pass the "reports undispositioned" test while being useless).

This file is deliberately NOT placed under `.planning/todos/pending/` or
`.planning/todos/completed/` and is never read by the real todo scan
(`readTodoFiles()`, which only reads those two directories) -- it is read
directly, by path, only from within the test file itself.

**Disposition: fixed.** WR-99 does not describe real code; this line exists
only to be found.
