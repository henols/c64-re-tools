---
title: DENY_LIST is a fork artifact — every entry, measured
date: 2026-09-11
context: /gsd-explore — owner observed "the decline list is something that got left behind and doesn't fill any purpose any longer"
confidence: MEASURED 2026-09-11 against both committed manifests
---

# The claim, checked

`vice.ts`'s `DENY_LIST` holds five names and is described in `capability-registry.ts:22` as
*"the only refusal in this tree that is a security control."* Measured against both manifests:

    entry                       tools-manifest.json   tools-manifest.stock.json
                                     (FORK)                  (STOCK)
    tools_list                       YES                       no
    tools_call                       YES                       no
    initialize                       YES                       no
    notifications_initialized        YES                       no
    vice_disk_list                   no                        no

**Every entry is a fork artifact, and they are dead in two different ways.**

# The four meta-tools: dead with the fork

They exist because the fork's HTTP MCP server advertised its **own protocol methods as callable
tools** — hence 62 fork manifest entries where only 58 are real tools. The hazard
`denyListRefusalMessage()` describes is real *for that surface*: a generic meta-tool can carry a
forbidden tool name as a NESTED argument, bypassing an outer-name-only guard.

On stock that surface does not exist. Tools are dispatched through `STOCK_DISPATCH_TABLE`, a
closed set defined in this repository's own code — there is no generic meta-tool to pass a
nested name through. `stock-dispatch.test.ts:532` already asserts no `DENY_LIST` name appears in
the stock manifest, so the guard is provably refusing nothing dispatchable today.

# `vice_disk_list`: already dead, independently of the fork decision

This is the original entry and the only one carrying the CRASH hazard shape — *"known to crash
the shared host VICE MCP server … recovery requires a manual, host-side restart."*

It is in **neither** manifest. The fork's own current snapshot no longer advertises it. It has
been guarding a tool that exists on no backend, and that was already true before any removal
decision. Its hazard message is the only thing in the tree still asserting the tool exists.

# What must NOT be concluded

**The nested-argument hazard is not gone — only this instance of it is.** `anno_batch_execute`
has the same shape and is live and backend-independent: it executes several `anno_*` calls from
a nested list, so an outer-name check on `anno_batch_execute` says nothing about what is inside.
That is guarded separately and by inversion — `CURATED_ANNO_TOOLS` (an allowlist, not a
denylist), `assertAnnoBatch()`, and `ANNO_MAX_BATCH_DEPTH`. `anno-tools.ts:81` cites `DENY_LIST`
explicitly as the precedent it inverted:

> `DENY_LIST` exists to close: the outer name passes the gate while the inner […]

So: the array goes with the fork; the **pattern stays**, already correctly applied elsewhere.
Anyone removing `DENY_LIST` must leave `anno-tools.ts`'s guards untouched and should rewrite that
citation rather than delete it, since it is the reason that guard is shaped the way it is.

# Consumers to unwind

    vice.ts:201            the array
    vice.ts:229            denyListRefusalMessage()
    vice.ts:698            the call() guard
    vice.ts:771            serverInfo() discovery filtering (strips DENY_LIST names from tools/list)
    vice-proxy.ts:3396     manifest registration skip
    vice-proxy.ts:3465     CallToolRequestSchema override guard
    refresh-manifest.ts:82 relies on serverInfo() having already stripped them
    capability-registry.ts:22,31,49,99,389  cites it as precedent and as a deliberate exclusion
    anno-tools.ts:81,2010  cites it as the precedent for the INVERTED allowlist — keep, rewrite

Note `vice-proxy.ts:3325` records that these four names were added to `DENY_LIST` precisely so
one existing filter would cover them, rather than adding a per-tool special case. Removing the
array should not reintroduce special cases in its place — with the fork gone there is nothing
left to filter.

Context: [[fork-removal-reversal-basis]].
