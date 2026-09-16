---
title: capability-registry.ts claims vice_diagnose/vice_recycle are in neither manifest — both are in the stock one
date: 2026-09-11
priority: low
source: /gsd-explore — MCP tool redundancy census
audit_acknowledged:
  milestone: v1.0.0
  at: 2026-09-16
---

# What

`src/mcp/vice/capability-registry.ts`'s header, in its EXCLUDED-DELIBERATELY section, says:

> "vice_diagnose" and "vice_recycle" are NOT capability gaps: they are synthetic, proxy-local
> tools registered on BOTH backends by vice-proxy.ts's
> buildBackendAwareTool()/resolveAdvertisedToolDefinition() synthetic-registration call sites,
> **never listed in either raw manifest JSON file**.

The bolded clause is false as of 2026-09-11. MEASURED:

    tool                   tools-manifest.json   tools-manifest.stock.json
    vice_diagnose          no                    YES
    vice_recycle           no                    YES
    vice_result_continue   no                    no

# Why it matters, and why it is only `low`

The reasoning the comment supports is still correct — both tools are synthetic and proxy-local,
and a naive fork-vs-stock set-difference still misclassifies them, which is the point the
paragraph exists to make. Only the supporting detail has gone stale: it was true in the
fork-only era, and the hand-authored stock manifest later listed them.

It matters because this is the file whose header forbids hand-maintaining a second copy of
capability data anywhere else in the repo. A single authority carrying a factually wrong claim
about where its own data lives is the failure mode that rule exists to prevent, and a reader
checking the claim finds it false and loses confidence in the rest.

# Fix

Correct the clause to name what is actually true — `vice_result_continue` is the tool in neither
manifest; `vice_diagnose` and `vice_recycle` are absent from the FORK manifest only. Keep the
argument intact, since it does not depend on the wrong detail.

Consider whether a test can pin it. The claim is a statement about two committed JSON files, so
it is mechanically checkable in the same way `stock-dispatch.test.ts` already pins the stock
manifest against the dispatch table — and `docs-linerefs.test.ts` is the precedent for
mechanically checking a prose claim in this tree.

# Do NOT act on the withdrawn drift claim

An earlier version of this todo asserted `tools-manifest.json` was "stale in both directions."
**That was wrong** and the file was deleted rather than corrected. See
[[mcp-tool-redundancy-census]]'s "Withdrawn" section: `tools-manifest.json` is the FORK surface,
it was being compared against a STOCK session's advertised list, and the difference is the
intended D-07 per-backend trimming. There is no manifest drift to fix.
