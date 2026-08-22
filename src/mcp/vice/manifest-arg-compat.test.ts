// Backward-compatibility gate over the two shipped tool manifests
// (audit finding NEW-1, .planning/v0.2.0-MILESTONE-AUDIT.md §4.3, closed by
// quick task 260819-rop).
//
// The past mistake this file exists to prevent: five live documents plus a
// decision-log mirror (.planning/ROADMAP.md, README.md, CLAUDE.md,
// .planning/intel/decisions.md, scripts/generate-tool-support-table.mjs's
// generated docs/tool-support.md) all asserted that a tool advertised on
// both backends keeps an IDENTICAL argument shape. That was false the whole
// time: re-verified programmatically against the two committed manifests on
// 2026-08-19, 17 of the 34 shared tools already have a differing
// `inputSchema`, and nothing anywhere tested the claim either way -- the
// divergence could have gone either direction (permissive widening, or a
// silent regression that breaks a fork-shaped call on stock) and no gate
// would have noticed.
//
// The real invariant -- the one now stated in the corrected prose -- is
// BACKWARD COMPATIBILITY, not schema equality: stock may add optional,
// clearly-labelled parameters a fork-shaped call simply never sets, but it
// must never (a) remove a property the fork declares, (b) retype a shared
// property, or (c) make a shared property newly required. Any of those three
// breaks a call built against the fork manifest when it lands on stock.
//
// One exception is allow-listed today: `vice_checkpoint_set_condition`'s
// `condition` property is `"type": "string"` on the fork but omits `type`
// entirely on stock, because stock's condition also accepts a structured
// condition object and this checker's supported JSON-Schema subset has no
// union keyword (no `oneOf`/`anyOf`) to express "string or object". Omitting
// `type` is strictly WIDER than the fork's declared type, so it can never
// reject a fork-shaped call -- that is why it is a widening, not a
// regression, and why it is permitted only via the commented allow-list
// below rather than by loosening the checker itself.
//
// What a contributor must NOT do when this file goes red: do not just add an
// allow-list entry to make it pass. A new entry needs a stated reason in the
// same shape as the one below, naming the tool, the property, and why the
// change is a genuine widening. A property that was actually removed,
// retyped, or made newly required on stock is a real regression -- it
// breaks every fork-shaped call already written against that tool -- and
// must be fixed in the manifest, not silenced here.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const FORK_MANIFEST_PATH = join(HERE, "tools-manifest.json");
const STOCK_MANIFEST_PATH = join(HERE, "tools-manifest.stock.json");

interface JsonSchemaProperty {
  type?: string;
  [key: string]: unknown;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

interface ManifestToolEntry {
  name: string;
  description?: string;
  inputSchema?: JsonSchema;
}

interface Manifest {
  generated_at: string;
  endpoint: string;
  tools: ManifestToolEntry[];
}

function readManifest(path: string): Manifest {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toolsByName(manifest: Manifest): Map<string, ManifestToolEntry> {
  const byName = new Map<string, ManifestToolEntry>();
  for (const tool of manifest.tools) {
    byName.set(tool.name, tool);
  }
  return byName;
}

/**
 * A single documented exception to "nothing retyped": a stock property that
 * OMITS `type` where the fork declares one is a widening (strictly more
 * permissive, never rejects a fork-shaped call) and is allowed here only
 * with a stated reason. Adding an entry is a decision, not a mechanical
 * fix -- see the file header.
 */
const WIDENING_ALLOW_LIST: ReadonlyArray<{
  tool: string;
  property: string;
  reason: string;
}> = [
  {
    tool: "vice_checkpoint_set_condition",
    property: "condition",
    reason:
      "stock's condition accepts EITHER a condition string OR a structured condition " +
      "object, and this checker's supported JSON-Schema subset has no union keyword " +
      "(no oneOf/anyOf) to express that -- so stock's schema omits `type` rather than " +
      "contradicting the fork's `\"type\": \"string\"`. See tools-manifest.stock.json's " +
      "own inline description for the same reason stated at the source.",
  },
];

function isWideningAllowed(tool: string, property: string): boolean {
  return WIDENING_ALLOW_LIST.some((entry) => entry.tool === tool && entry.property === property);
}

/**
 * Pure checker: returns a list of human-readable violation strings (empty
 * means backward-compatible). Never throws -- callers decide what to do with
 * a non-empty result. Used both against the two real shipped manifests and
 * against synthetic fixtures below (house style, see tool-support-table.test.mjs).
 */
function checkBackwardCompatible(
  forkSchema: JsonSchema | undefined,
  stockSchema: JsonSchema | undefined,
  toolName: string,
): string[] {
  const violations: string[] = [];
  const forkProps = forkSchema?.properties ?? {};
  const stockProps = stockSchema?.properties ?? {};
  const forkRequired = new Set(forkSchema?.required ?? []);
  const stockRequired = new Set(stockSchema?.required ?? []);

  for (const [property, forkDef] of Object.entries(forkProps)) {
    if (!(property in stockProps)) {
      violations.push(
        `${toolName}.${property}: removed on stock (declared in fork's inputSchema, absent from stock's)`,
      );
      continue;
    }

    const stockDef = stockProps[property];
    const forkType = forkDef?.type;
    const stockType = stockDef?.type;

    if (forkType !== stockType) {
      if (forkType !== undefined && stockType === undefined) {
        // Widening: stock's property omits `type` where the fork declares one.
        // Permitted only via the allow-list above, with a stated reason.
        if (!isWideningAllowed(toolName, property)) {
          violations.push(
            `${toolName}.${property}: stock omits "type" (fork declares "${forkType}") and ` +
              `is not in WIDENING_ALLOW_LIST -- add an allow-list entry naming the reason, or ` +
              `restore stock's "type"`,
          );
        }
      } else {
        violations.push(
          `${toolName}.${property}: retyped on stock (fork "${forkType}" -> stock "${stockType}")`,
        );
      }
    }
  }

  for (const property of stockRequired) {
    if (!forkRequired.has(property)) {
      violations.push(
        `${toolName}.${property}: newly required on stock (not required on fork's inputSchema)`,
      );
    }
  }

  return violations;
}

test("manifest-arg-compat: sanity precondition -- the shared tool-name set is non-empty and the allow-listed tool is in it", () => {
  const fork = readManifest(FORK_MANIFEST_PATH);
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const forkNames = new Set(fork.tools.map((t) => t.name));
  const stockNames = new Set(stock.tools.map((t) => t.name));
  const shared = [...forkNames].filter((name) => stockNames.has(name));

  assert.ok(
    shared.length > 0,
    "manifest-arg-compat: shared tool-name set is empty -- this test would silently check nothing",
  );

  for (const entry of WIDENING_ALLOW_LIST) {
    assert.ok(
      shared.includes(entry.tool),
      `manifest-arg-compat: WIDENING_ALLOW_LIST entry "${entry.tool}.${entry.property}" names a ` +
        `tool that is no longer shared between the two manifests -- remove the stale allow-list entry`,
    );
  }
});

test("manifest-arg-compat: every tool shared between tools-manifest.json (fork) and tools-manifest.stock.json (stock) is backward-compatible", () => {
  const fork = readManifest(FORK_MANIFEST_PATH);
  const stock = readManifest(STOCK_MANIFEST_PATH);
  const forkByName = toolsByName(fork);
  const stockByName = toolsByName(stock);

  const sharedNames = [...forkByName.keys()].filter((name) => stockByName.has(name));
  assert.ok(sharedNames.length > 0, "manifest-arg-compat: no shared tool names found to check");

  const allViolations: string[] = [];
  for (const name of sharedNames) {
    const forkTool = forkByName.get(name);
    const stockTool = stockByName.get(name);
    allViolations.push(...checkBackwardCompatible(forkTool?.inputSchema, stockTool?.inputSchema, name));
  }

  assert.deepEqual(
    allViolations,
    [],
    `manifest-arg-compat: found ${allViolations.length} backward-compatibility violation(s):\n` +
      allViolations.join("\n"),
  );
});

test("manifest-arg-compat: checkBackwardCompatible() reports a property the fork declares and stock drops", () => {
  const forkSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "number" }, condition: { type: "string" } },
    required: ["checkpoint_num", "condition"],
  };
  const stockSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "number" } },
    required: ["checkpoint_num"],
  };

  const violations = checkBackwardCompatible(forkSchema, stockSchema, "fixture_tool_removed_property");

  assert.ok(
    violations.some((v) => v.includes("fixture_tool_removed_property.condition") && v.includes("removed")),
    `expected a "removed" violation for fixture_tool_removed_property.condition, got: ${JSON.stringify(violations)}`,
  );
});

test("checkBackwardCompatible() reports a property retyped string -> number", () => {
  const forkSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "string" } },
    required: [],
  };
  const stockSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "number" } },
    required: [],
  };

  const violations = checkBackwardCompatible(forkSchema, stockSchema, "fixture_tool_retyped_property");

  assert.ok(
    violations.some(
      (v) =>
        v.includes("fixture_tool_retyped_property.checkpoint_num") &&
        v.includes("retyped") &&
        v.includes('"string" -> stock "number"'),
    ),
    `expected a "retyped" violation for fixture_tool_retyped_property.checkpoint_num, got: ${JSON.stringify(violations)}`,
  );
});

test("checkBackwardCompatible() reports a property newly required on stock", () => {
  const forkSchema: JsonSchema = {
    type: "object",
    properties: { bank: { type: "number" } },
    required: [],
  };
  const stockSchema: JsonSchema = {
    type: "object",
    properties: { bank: { type: "number" } },
    required: ["bank"],
  };

  const violations = checkBackwardCompatible(forkSchema, stockSchema, "fixture_tool_newly_required");

  assert.ok(
    violations.some((v) => v.includes("fixture_tool_newly_required.bank") && v.includes("newly required")),
    `expected a "newly required" violation for fixture_tool_newly_required.bank, got: ${JSON.stringify(violations)}`,
  );
});

test("checkBackwardCompatible() reports a stock property that omits \"type\" when NOT in the widening allow-list", () => {
  const forkSchema: JsonSchema = {
    type: "object",
    properties: { value: { type: "string" } },
    required: [],
  };
  const stockSchema: JsonSchema = {
    type: "object",
    properties: { value: { description: "no type declared, and not allow-listed" } },
    required: [],
  };

  const violations = checkBackwardCompatible(forkSchema, stockSchema, "fixture_tool_unlisted_widening");

  assert.ok(
    violations.some(
      (v) =>
        v.includes("fixture_tool_unlisted_widening.value") &&
        v.includes("omits") &&
        v.includes("WIDENING_ALLOW_LIST"),
    ),
    `expected an unlisted-widening violation for fixture_tool_unlisted_widening.value, got: ${JSON.stringify(violations)}`,
  );
});

test("checkBackwardCompatible() does NOT report the allow-listed widening (vice_checkpoint_set_condition.condition)", () => {
  const forkSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "number" }, condition: { type: "string" } },
    required: ["checkpoint_num", "condition"],
  };
  const stockSchema: JsonSchema = {
    type: "object",
    properties: { checkpoint_num: { type: "number" }, condition: { description: "string or object" } },
    required: ["checkpoint_num", "condition"],
  };

  const violations = checkBackwardCompatible(forkSchema, stockSchema, "vice_checkpoint_set_condition");

  assert.deepEqual(
    violations,
    [],
    `expected no violations for the allow-listed widening, got: ${JSON.stringify(violations)}`,
  );
});

test("checkBackwardCompatible() reports nothing for two identical schemas (no false positives)", () => {
  const schema: JsonSchema = {
    type: "object",
    properties: { addr: { type: "number" } },
    required: ["addr"],
  };

  const violations = checkBackwardCompatible(schema, schema, "fixture_tool_identical");

  assert.deepEqual(violations, [], `expected no violations for identical schemas, got: ${JSON.stringify(violations)}`);
});
