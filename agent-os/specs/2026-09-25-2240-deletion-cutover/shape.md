# Deletion Cutover — Shaping Notes

## Scope

This is roadmap v2.0.0 "One Broker, One Socket", step 2. It removes the old host/container seam from production code: the path-translation modules (`hostpath.ts`, `containerpath.ts`, `stock-paths.ts`), `host-tool-client.ts`, the legacy `host_tool` op and the `host-tool.mjs` CLI, `containerizeGrant()`, the `broker.json` discovery record and every reader of it, and the control token gate. Structural tests assert the seam is absent, so they cannot pass vacuously.

## Decisions

- One spec, with ordered tasks, each landing with the suite green.
- The token gate goes along with `broker.json`, its only distribution channel. Protection rests on the loopback/bridge-only bind, per-grant `ownsTarget()`, and handle checks. That matches `tech-stack.md` ("There is no auth token").
- The MCP server's lease moves to a new `dialControlSession()` on the fixed endpoint. `describeDialFailure()` replaces the three broker-absent messages.
- The broker's own "is a live broker already on this port" check becomes a hello probe.
- Out of scope, recorded as roadmap follow-ups:
  - the epoch drift check reading `epoch_file` across the container boundary;
  - `vice_program_load` sending a client-side path.
- Kept: `CONTAINER_WORKSPACE_PATH` in `repo-root.ts` and `container-guard.mts`, `containerGuardEnforce`/`Report`, and `runHostTool()`.

## Context

- **Visuals:** none.
- **References:** see `references.md`.
- **Product alignment:** one broker per machine on fixed TCP 19510, and a client finds it with nothing on disk. No auth token, and never a `0.0.0.0` bind.

## Standards Applied

- **broker/host-bound-modules:** broker-control, vice-broker and broker-endpoint are rebuilt into `resources/`.
- **global/injectable-deps:** the new control session takes the same dial/connect seams as the other dialers.
- **global/module-header:** rewritten headers stay short and drop plan history.
- **global/atomic-state-files:** after the change, the broker writes no discovery file at all.
- **skills/cross-package-reach:** its example changes to the compiled endpoint client.
