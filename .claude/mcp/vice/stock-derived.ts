#!/usr/bin/env node
// stock-derived.ts
//
// THE derived-tool leaf (DERIV-07). This file owns the one thing
// stock-dispatch.ts does not: the CONTAINER-PATH DISCIPLINE for a stock tool
// whose answer is computed CLIENT-SIDE rather than fetched from the wire.
// It holds STOCK_DERIVED_TOOLS (the data-only registry, D-03),
// derivedContainerPath() (D-01/D-02), DerivedToolError, and the
// DerivedPureHandler type. withDerivedTool() itself lives beside
// withStockSession() in stock-dispatch.ts -- see this plan's
// plan_decision_module_split block for why the adapter and this leaf are two
// files rather than one (withDerivedTool() must delegate to
// ensureStockSession(), which lives in stock-dispatch.ts; putting the
// adapter here would close a runtime cycle stock-dispatch.ts -> stock-derived.ts
// -> stock-dispatch.ts).
//
// WHY THIS FILE EXISTS: this is the MIRROR IMAGE of stock-paths.ts's D-17
// hazard. There, NOT translating an emulator-side path is the bug -- four
// tools carry a filename stock VICE opens on the HOST, and stock-paths.ts's
// whole job is making sure that translation happens. HERE, translating a
// CLIENT-SIDE-DERIVED path is the bug: rewriteArguments() runs INSIDE the
// fork-forwarding function at vice-proxy.ts:2773, before call() -- a derived
// tool sitting behind call() would receive HOST-translated paths and act on
// them INSIDE THE CONTAINER (ROADMAP Phase 4 Notes, CLAUDE.md). The
// derived-tool seam this file anchors exists so a derived tool's handler is
// reached BEFORE that fork-forwarding function ever runs
// rewriteArguments() at all.
//
// SECOND CONSUMER, named now so Phase 5's edit is a one-liner:
// gatherWedgeEvidence() (vice-proxy.ts:1343) calls rewriteArguments() itself
// at line 1367. On the stock backend, PERFORMING that translation becomes
// the bug -- its own comment inverts. Phase 5 criterion 5 owns that fix; it
// is deliberately NOT repointed here (it is currently unreachable on stock
// anyway: handleRecycle() is backend-aware and refused by name after CR-07,
// and vice_display_screenshot does not exist on stock until Phase 5).
//
// WHAT NOT TO DO:
//   - Never `import` hostpath.ts from this file, or from any module listed
//     in STOCK_DERIVED_TOOLS' implementations -- hostpath-consumers.test.ts
//     fails the build if you do.
//   - Never `import` vice-proxy.ts, and never call rewriteArguments().
//   - Never add a client-side-derived tool to stock-paths.ts's
//     STOCK_EMULATOR_SIDE_PATH_TOOLS -- that file's own header already warns
//     against exactly this.
//   - Never build a second dispatch table or a fall-through (D-03, Phase 2
//     D-09). Derived-ness is a property of which adapter wraps a handler,
//     never a routing decision -- there is still exactly one
//     STOCK_DISPATCH_TABLE and exactly one dispatchStock( call site in
//     vice-proxy.ts.
//   - Never re-implement session acquisition here -- withDerivedTool() in
//     stock-dispatch.ts delegates to the one ensureStockSession() the 25
//     direct tools use.
import { ViceError, type ViceErrorOptions } from "./vice.ts";
import type { StockToolResult } from "./stock-handler.ts";
import type { StockDispatchDeps } from "./stock-dispatch.ts";

/** The one error type this module ever throws -- never a bare Error,
 * matching vice.ts's established ViceError hierarchy (stock-address.ts's
 * StockAddressError and stock-paths.ts's StockPathError are the sibling
 * precedents). */
export class DerivedToolError extends ViceError {
  constructor(message: string, options: ViceErrorOptions = {}) {
    super(message, options);
    this.name = "DerivedToolError";
  }
}

// ---------------------------------------------------------------------------
// STOCK_DERIVED_TOOLS -- the data-only registry (D-03). This set is DATA and
// is NEVER consulted to ROUTE a call -- it is consulted only to refuse an
// undeclared tool (derivedContainerPath(), withDerivedTool()) and to answer
// Phase 8's "which tools are derived" question. There is still exactly one
// STOCK_DISPATCH_TABLE; a tool's presence here changes nothing about how it
// is dispatched, only which adapter wraps its handler.
// ---------------------------------------------------------------------------

export const STOCK_DERIVED_TOOLS: ReadonlySet<string> = new Set([
  "vice_disassemble", // Phase 4, DERIV-07's first consumer (04-05) -- client-side 6510 disassembler
]);

/**
 * The handler shape for a derived tool that needs NO session (D-04). It
 * receives no session argument at all, so it structurally cannot reach the
 * wire -- there is no `session.client` to send anything through. `deps` is
 * threaded down for anything the handler needs beyond the session (matching
 * StockSessionHandler's own `deps` parameter).
 *
 * `StockDispatchDeps` is imported `type`-only from stock-dispatch.ts -- under
 * verbatimModuleSyntax an `import type` erases completely at compile time,
 * so it creates no runtime cycle even though stock-dispatch.ts imports THIS
 * file's other exports at runtime (exactly the arrangement stock-handler.ts
 * already uses and documents for the same reason).
 */
export type DerivedPureHandler = (args: Record<string, unknown>, deps: StockDispatchDeps) => Promise<StockToolResult>;

// ---------------------------------------------------------------------------
// derivedContainerPath() -- the container-path discipline (D-01/D-02).
// ---------------------------------------------------------------------------

/**
 * Returns `containerPath` UNCHANGED, having consulted nothing -- no
 * `isInsideContainer()` branch, no `hostPathCandidates()`, no
 * `tryHostPaths()`, no environment variable. Its entire behaviour is "return
 * the container path", and its entire value is that it is the ONE named seam
 * a derived tool routes an output path through -- so a future reviewer (or
 * hostpath-consumers.test.ts's asserted-absence scan) has something concrete
 * to point at when checking that no translation ever happened.
 *
 * Refuses any `toolName` not declared in STOCK_DERIVED_TOOLS -- the same
 * refuse-if-not-declared shape as stock-paths.ts's withEmulatorSidePath() --
 * so a handler cannot opt itself into derived treatment without being
 * declared in the registry above.
 */
export function derivedContainerPath(toolName: string, containerPath: string): string {
  if (!STOCK_DERIVED_TOOLS.has(toolName)) {
    throw new DerivedToolError(
      `derivedContainerPath: ${toolName} is not declared in STOCK_DERIVED_TOOLS -- only a tool listed there may ` +
        `route a path through this function.`,
    );
  }
  return containerPath;
}
