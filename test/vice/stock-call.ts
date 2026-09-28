// stock-call.ts
//
// WHY THIS FILE EXISTS: the tests call a stock tool by its wire name. This
// is that lookup, over the same STOCK_TOOLS table and runStockTool() runner
// the server uses, so a test drives the production dispatch path.
//
// WHAT NOT TO DO:
//   - Never add a second tool table or runner here. Look the tool up in
//     STOCK_TOOLS and run it through runStockTool().
import { isErrorText, type StockToolResult } from "../../src/mcp/vice/stock-handler.ts";
import type { StockSessionDeps } from "../../src/mcp/vice/stock-session.ts";
import { STOCK_TOOLS, runStockTool } from "../../src/mcp/vice/stock-tools.ts";

/** Runs the tool named `name`, or refuses by name when no tool has it. */
export async function callStockTool(name: string, args: Record<string, unknown>, deps: StockSessionDeps): Promise<StockToolResult> {
  const tool = STOCK_TOOLS.find((t) => t.name === name);
  if (!tool) {
    return isErrorText(`${name}: no stock tool has this name.`);
  }
  return runStockTool(tool, args, deps);
}
