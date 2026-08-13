#!/usr/bin/env node
// stock-dispatch.ts
//
// THE ONE PLACE the stock tool surface is defined and dispatched (D-07,
// D-09). D-07 makes the two backends' advertised tool lists genuinely
// different, permanently -- not a runtime filter over one shared list, but
// a second committed manifest file (tools-manifest.stock.json) this module
// selects between. D-09 says the stock path must never fall through to the
// fork's HTTP forward: a tool this file does not dispatch is simply not on
// the stock manifest, so vice-proxy.ts's tools/list answer never advertises
// it and there is nothing for a fall-through to catch.
//
// This plan (02-09) lands the manifest selector (manifestPathForBackend())
// and (Task 2, added below) the lease-to-session seam (ensureStockSession(),
// HeldLease on vice-broker-client.ts). Plan 02-10 adds the dispatch table
// itself, vice_ping, and the vice-proxy.ts wiring on top of this file.
//
// WHAT NOT TO DO:
//   - Never fall through to forwardToVice() from this module or from
//     anything built on top of it -- a stock tool call that reaches here
//     with no dispatch entry must be refused, never silently forwarded to
//     the fork's HTTP transport (D-09).
//   - Never add a second dispatch site in vice-proxy.ts -- this file is the
//     one place a tools/call for the stock backend is routed from.
//   - Never acquire a broker lease here (Task 2's own ensureStockSession()
//     header comment explains this prohibition fully).
import { resolve, join } from "node:path";

import type { ViceBackend } from "./backend-detect.mts";

// ---------------------------------------------------------------------------
// manifestPathForBackend() -- the manifest selector.
// ---------------------------------------------------------------------------

/**
 * Resolves which manifest file backs a given backend's advertised tool
 * surface, following the EXACT override precedence vice-proxy.ts's own
 * manifestPath() already establishes: an explicit VICE_TOOLS_MANIFEST value
 * (passed in as `envOverride`, never read from process.env directly here --
 * this function stays a pure, injectable seam) wins for either backend,
 * unchanged; otherwise the backend picks its own committed default file
 * beside `hereDir`. `envOverride` is deliberately a plain parameter, not a
 * process.env read, so this function has no hidden global dependency and a
 * test can drive every combination without mutating the real environment.
 */
export function manifestPathForBackend(backend: ViceBackend, hereDir: string, envOverride: string | undefined): string {
  if (envOverride) {
    return resolve(envOverride);
  }
  return backend === "stock" ? join(hereDir, "tools-manifest.stock.json") : join(hereDir, "tools-manifest.json");
}
