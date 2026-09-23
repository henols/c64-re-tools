---
title: A devcontainer client cannot see the host broker's broker.json -- interim remedy documented, permanent fix owned by Phase 66 (RM-02)
date: 2026-09-23
priority: medium
source: plan 64-10 (gap G-64-1, secondary cause) -- discovered while making the broker and the client resolve broker.json through one shared machine-level resolver
---

# What

Plan 64-10 (Phase 64, gap closure round G-64-1) made
`vice-broker-client.ts`'s `brokerRootDir()` resolve the SAME machine-level
state directory `vice-broker.mts`'s `parseArgs()` does, through
`broker-home.mts`'s `brokerStateDir()` on both sides -- so every documented
start route (`npx -y @henols/vice-mcp broker`, the systemd user unit, the
launchd agent, and `vice-launcher.sh`'s own `--repo-root` pin) now agrees
with the client on where `broker.json` lives, for the first time.

That agreement holds only when the broker and the client run on the SAME
machine. A client running inside a devcontainer resolves `brokerStateDir()`
against its OWN home directory (the container's own filesystem view), which
is not the host's -- so a devcontainer client cannot find a host-started
broker's `broker.json` unless something on BOTH sides is explicitly pointed
at one location both can actually see.

No translation seam can close this gap. `hostpath.ts`/`containerpath.ts`
rewrite a bind-mounted container path to a host-reachable path (and back);
a host-home path lies OUTSIDE the bind-mounted workspace by construction, so
`containerPath()` throws on it rather than translating it. This plan's own
prohibitions forbid routing a host-home path through either module for
exactly that reason -- attempting to would be fighting the seam's own
invariant, not extending it.

# Interim remedy

Set `VICE_BROKER_HOME` (or `VICE_POOL_DIR`) on EACH side -- the host broker
process and the container client process -- to that side's own view of one
location both can reach (e.g. a directory bind-mounted into the container
under an identical or translated path). This is a per-deployment
configuration step; neither resolver can infer it.

# Owner

**Phase 66 (RM-02)** is the permanent fix, not a future interim patch to
this mechanism. ROADMAP.md's Phase 66, Success Criterion 2: "`broker.json`
is neither written nor read anywhere and every reader of it is deleted."
Once there is no `broker.json` left for any client to read, there is
nothing left for a devcontainer client to fail to see -- the whole class of
gap this todo describes disappears with the file, not with a smarter
resolver.

# Do NOT

Do not attempt a translation fix inside `hostpath.ts`/`containerpath.ts` --
a host-home path is categorically outside what either module's contract
covers, and widening either one to accept it would blur the exact boundary
`hostpath-consumers.test.ts` polices. Do not fix this by adding a fifth
environment variable or a container-detection branch to `broker-home.mts`
or `vice-broker-client.ts` -- BROKER-06/D-13/D-14 already settled the
variable set (`VICE_BROKER_HOME` superseding the four legacy directory
variables), and this todo's own remedy already works within it.

# Full record

`.planning/phases/64-files-as-bytes-both-directions/evidence/64-g641-state-dir-agreement.md`
-- the decision record for the launcher pin's removal, the route census
proving every documented route now agrees, the override table, and this
same container interim limitation stated in full alongside it.
