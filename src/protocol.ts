// The private Host Runtime wire contract, shared by src/host and src/host-client.
// Nothing here is LLM-facing: MCP and skill results never show these shapes.
// The parts live under src/protocol/; this file re-exports all of them.

export * from "./protocol/framing.ts";
export * from "./protocol/messages.ts";
export * from "./protocol/tools.ts";
export * from "./protocol/vice.ts";
