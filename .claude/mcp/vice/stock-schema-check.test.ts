// node:test coverage of stock-schema-check.ts -- checkAgainstSchema(), the
// small dependency-free outputSchema shape checker (D-02, plan 03-12 Task 3).
import { test } from "node:test";
import assert from "node:assert/strict";

import { checkAgainstSchema } from "./stock-schema-check.ts";

test("valid nested object: a matching value against a schema with type/properties/required returns no violations", () => {
  const violations = checkAgainstSchema(
    { a: 1, nested: { b: "hello" } },
    {
      type: "object",
      properties: {
        a: { type: "number" },
        nested: { type: "object", properties: { b: { type: "string" } }, required: ["b"] },
      },
      required: ["a", "nested"],
    },
  );
  assert.deepEqual(violations, []);
});

test("acceptance criterion: checkAgainstSchema({a:1}, {...}) returns an empty array", () => {
  const violations = checkAgainstSchema({ a: 1 }, { type: "object", properties: { a: { type: "number" } }, required: ["a"] });
  assert.deepEqual(violations, []);
});

test("missing required key is reported, naming its own path", () => {
  const violations = checkAgainstSchema({}, { type: "object", required: ["a"] });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /a/);
  assert.match(violations[0]!, /required property missing/);
});

test("wrong type is reported naming both the expected type and the actual type", () => {
  const violations = checkAgainstSchema("not a number", { type: "number" });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /expected type "number"/);
  assert.match(violations[0]!, /got string/);
});

test("enum violation lists the allowed values", () => {
  const violations = checkAgainstSchema("purple", { enum: ["running", "stopped", "unknown"] });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /running/);
  assert.match(violations[0]!, /stopped/);
  assert.match(violations[0]!, /unknown/);
  assert.match(violations[0]!, /purple/);
});

test("enum success: a value present in the enum list produces no violation", () => {
  const violations = checkAgainstSchema("running", { type: "string", enum: ["running", "stopped", "unknown"] });
  assert.deepEqual(violations, []);
});

test("array items type violation is reported at the offending index", () => {
  const violations = checkAgainstSchema([1, 2, "x"], { type: "array", items: { type: "number" } });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /\$\[2\]/);
  assert.match(violations[0]!, /expected type "number"/);
});

test("array items: all elements valid produces no violations", () => {
  const violations = checkAgainstSchema([1, 2, 3], { type: "array", items: { type: "number" } });
  assert.deepEqual(violations, []);
});

test("unexpected key under additionalProperties:false is reported", () => {
  const violations = checkAgainstSchema({ a: 1, b: 2 }, { type: "object", properties: { a: { type: "number" } }, additionalProperties: false });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /\$\.b/);
  assert.match(violations[0]!, /additionalProperties:false/);
});

test("additionalProperties:false with no extra keys produces no violation", () => {
  const violations = checkAgainstSchema({ a: 1 }, { type: "object", properties: { a: { type: "number" } }, additionalProperties: false });
  assert.deepEqual(violations, []);
});

test("an unsupported keyword (oneOf) is reported as a violation naming it", () => {
  const violations = checkAgainstSchema(1, { oneOf: [] });
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /oneOf/);
});

test("acceptance criterion: checkAgainstSchema(1, {oneOf: []}) returns a violation naming oneOf", () => {
  const violations = checkAgainstSchema(1, { oneOf: [] });
  assert.ok(violations.some((v) => v.includes("oneOf")));
});

test("a null value against a required property is reported as a type violation, not silently passed", () => {
  const violations = checkAgainstSchema(
    { a: null },
    { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /\$\.a/);
  assert.match(violations[0]!, /got null/);
});

test("an undefined value against a required property is reported as missing, not silently passed", () => {
  const violations = checkAgainstSchema(
    { a: undefined },
    { type: "object", properties: { a: { type: "string" } }, required: ["a"] },
  );
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /\$\.a/);
  assert.match(violations[0]!, /required property missing/);
});

test("checkAgainstSchema never throws on a malformed schema argument", () => {
  assert.doesNotThrow(() => checkAgainstSchema({ a: 1 }, "not a schema at all"));
  assert.doesNotThrow(() => checkAgainstSchema({ a: 1 }, null));
  assert.doesNotThrow(() => checkAgainstSchema({ a: 1 }, 42));
});

test("a malformed schema argument (not a plain object) is reported as its own violation", () => {
  const violations = checkAgainstSchema({ a: 1 }, "not a schema at all");
  assert.equal(violations.length, 1);
  assert.match(violations[0]!, /not a plain object/);
});

test("multiple violations at once are all reported, not just the first", () => {
  const violations = checkAgainstSchema({ b: 2 }, { type: "object", properties: { a: { type: "number" } }, required: ["a"], additionalProperties: false });
  assert.equal(violations.length, 2);
  assert.ok(violations.some((v) => /\$\.a/.test(v) && /required property missing/.test(v)));
  assert.ok(violations.some((v) => /\$\.b/.test(v) && /additionalProperties:false/.test(v)));
});

test("boolean, integer and null types are each checked correctly", () => {
  assert.deepEqual(checkAgainstSchema(true, { type: "boolean" }), []);
  assert.deepEqual(checkAgainstSchema(5, { type: "integer" }), []);
  assert.deepEqual(checkAgainstSchema(5.5, { type: "integer" }).length, 1);
  assert.deepEqual(checkAgainstSchema(null, { type: "null" }), []);
});
