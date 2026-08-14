#!/usr/bin/env node
// stock-schema-check.ts
//
// A small, dependency-free `outputSchema` shape checker (D-02, plan 03-12
// Task 3). WHY THIS EXISTS RATHER THAN `ajv`: this project's container-side
// server has zero third-party runtime dependencies (see this repo's own
// `package.json` -- the stock manifest work deliberately did not add one),
// and every `outputSchema` this tree writes is flat and small: an object
// with a handful of typed properties, sometimes an array of similarly flat
// items, sometimes an enum. Pulling in a general-purpose JSON-Schema
// validator to check that shape would be the exact over-engineering the
// zero-dependency posture argues against -- a large, actively-maintained
// dependency to replace ~40 lines of recursive object walking.
//
// SUPPORTED SUBSET, AND NOTHING MORE: `type` (the seven JSON-Schema
// primitive names below), `properties`, `required`, `items`, `enum`, and
// `additionalProperties: false`. No `$ref`, no `oneOf`/`anyOf`/`allOf`, no
// `format`, no numeric bounds (`minimum`/`maximum`/etc). A schema construct
// this checker does not understand is ITSELF reported as a violation naming
// the unsupported keyword -- silently ignoring an unsupported keyword would
// let a schema claim a constraint nothing here actually checks, which is
// worse than refusing to check it at all.
//
// WHAT NOT TO DO:
//   - Never silently ignore an unrecognized schema keyword. Report it.
//   - Never widen this beyond what tools-manifest.stock.json's own
//     `outputSchema` entries actually use. If a future entry needs `oneOf`
//     or `$ref`, that is the moment to reconsider `ajv`, not the moment to
//     grow this file's own ad-hoc subset indefinitely.
//   - Never throw. A schema checker that can itself crash on a malformed
//     schema is worse than useless in a CI gate -- every branch here is
//     defensive about the shapes it is handed.

const SUPPORTED_KEYWORDS = new Set(["type", "properties", "required", "items", "enum", "additionalProperties"]);

const SUPPORTED_TYPES = new Set(["object", "string", "number", "integer", "boolean", "array", "null"]);

/** True iff `value` is a well-formed, generic JSON object -- not null, not
 * an array. Matches this module tree's own isPlainObject() convention
 * (stock-checkpoints.ts et al.). */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Renders `value`'s own JSON-Schema-style type name for a violation
 * message -- "null" and "array" are reported distinctly from the bare
 * `typeof` result, matching the vocabulary `type` itself uses. */
function describeActualType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

function typeMatches(value: unknown, type: string): boolean {
  switch (type) {
    case "object":
      return isPlainObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number" && Number.isFinite(value);
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return false;
  }
}

/** Deep-equal by JSON.stringify -- adequate for `enum` members, which in
 * every schema this checker is aimed at are primitives or small flat
 * objects/arrays, never anything whose key order varies meaningfully. */
function jsonEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Checks `value` against `schema` (the supported subset only -- see this
 * file's own header comment) and returns a list of human-readable
 * violations. An EMPTY array means valid. Never throws: a malformed
 * `schema` argument (not a plain object at all) is itself reported as one
 * violation rather than crashing the caller.
 */
export function checkAgainstSchema(value: unknown, schema: unknown, path = "$"): string[] {
  const violations: string[] = [];

  if (!isPlainObject(schema)) {
    violations.push(`${path}: schema itself is not a plain object (got ${describeActualType(schema)})`);
    return violations;
  }

  for (const key of Object.keys(schema)) {
    if (!SUPPORTED_KEYWORDS.has(key)) {
      violations.push(
        `${path}: unsupported schema keyword "${key}" -- checkAgainstSchema() only understands type/properties/required/items/enum/additionalProperties`,
      );
    }
  }

  if ("type" in schema) {
    const type = schema.type;
    if (typeof type === "string" && SUPPORTED_TYPES.has(type)) {
      if (!typeMatches(value, type)) {
        violations.push(`${path}: expected type "${type}", got ${describeActualType(value)}`);
      }
    } else {
      violations.push(`${path}: schema's "type" is not one of the supported type names (got ${JSON.stringify(type)})`);
    }
  }

  if ("enum" in schema) {
    const allowed = schema.enum;
    if (!Array.isArray(allowed)) {
      violations.push(`${path}: schema's "enum" is not an array (got ${describeActualType(allowed)})`);
    } else if (!allowed.some((candidate) => jsonEqual(candidate, value))) {
      violations.push(`${path}: value ${JSON.stringify(value)} is not one of the allowed enum values ${JSON.stringify(allowed)}`);
    }
  }

  // Object-shaped keywords apply whenever VALUE is a plain object, regardless
  // of whether "type" was also declared -- matching ordinary JSON-Schema
  // semantics (a keyword applies to the instance's own type, not gated by a
  // sibling "type" keyword being present).
  if (isPlainObject(value) && ("properties" in schema || "required" in schema || "additionalProperties" in schema)) {
    const properties = isPlainObject(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required) ? schema.required : [];

    for (const key of required) {
      if (typeof key !== "string") continue;
      if (!(key in value) || value[key] === undefined) {
        violations.push(`${path}.${key}: required property missing`);
      }
    }

    for (const [key, subSchema] of Object.entries(properties)) {
      // An explicit `undefined` is already reported by the `required` check
      // above as "missing" -- recursing here too would double-report the
      // same absence as BOTH "missing" and "wrong type", for the identical
      // key. Only recurse when there is an actual value to check.
      if (key in value && value[key] !== undefined) {
        violations.push(...checkAgainstSchema(value[key], subSchema, `${path}.${key}`));
      }
    }

    if (schema.additionalProperties === false) {
      const allowedKeys = new Set(Object.keys(properties));
      for (const key of Object.keys(value)) {
        if (!allowedKeys.has(key)) {
          violations.push(`${path}.${key}: unexpected property not permitted by additionalProperties:false`);
        }
      }
    }
  }

  // Array-shaped keywords apply whenever VALUE is an array and "items" was
  // declared, for the identical reason -- gated on the instance's own type,
  // not on a sibling "type" keyword.
  if (Array.isArray(value) && "items" in schema) {
    value.forEach((item, index) => {
      violations.push(...checkAgainstSchema(item, schema.items, `${path}[${index}]`));
    });
  }

  return violations;
}
