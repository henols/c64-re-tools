import assert from "node:assert/strict";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { elapsedMs, startTrace, summarize, Trace, trace, TRACE_VARIABLE } from "./trace.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-trace-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

const lines = (file: string) =>
  readFileSync(file, "utf8")
    .trimEnd()
    .split("\n")
    .map((line) => JSON.parse(line) as Record<string, unknown>);

test("without C64RT_TRACE the trace is off and records nothing", () => {
  const off = startTrace("host", { env: {} });
  assert.equal(off.on, false);
  assert.equal(off.file, undefined);
  off.event("anything", { a: 1 });
  off.keep(join(scratch, "nothing"), "nothing");
  assert.equal(trace(), off);
  assert.deepEqual(readdirSync(scratch), []);
});

test("with C64RT_TRACE each event is one JSON line with a CET time, the kind and the event", () => {
  const dir = join(scratch, "on");
  const on = startTrace("mcp", { env: { [TRACE_VARIABLE]: dir } });
  assert.equal(on.on, true);
  assert.equal(trace(), on);
  assert.match(on.file!, /[\\/]mcp-\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d+\.jsonl$/);
  on.event("tool.call", { name: "c64_status", ms: 1.5, t: "ignored", kind: "ignored", nothing: undefined });
  on.log("VICE starts");
  const [start, call, log] = lines(on.file!);
  assert.equal(start!.event, "trace.start");
  assert.equal(start!.pid, process.pid);
  assert.match(String(call!.t), /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+01:00$/);
  const { t: _t, ...rest } = call!;
  assert.deepEqual(rest, { kind: "mcp", event: "tool.call", name: "c64_status", ms: 1.5 });
  assert.equal(log!.event, "log");
  assert.equal(log!.line, "VICE starts");
});

test("summarize keeps a line short: bytes become a count, long text and arrays are cut, an error keeps its code", () => {
  assert.deepEqual(summarize(Buffer.alloc(70_000)), { bytes: 70_000 });
  const long = summarize("x".repeat(3_000)) as string;
  assert.ok(long.length < 2_100);
  assert.match(long, /… \(3000 characters\)$/);
  const items = summarize(Array.from({ length: 40 }, (_, index) => index)) as unknown[];
  assert.equal(items.length, 33);
  assert.equal(items[32], "… (40 items)");
  const error = Object.assign(new Error("gone"), { code: "machine-state-lost" });
  assert.deepEqual(summarize(error), { name: "Error", message: "gone", code: "machine-state-lost" });
  assert.deepEqual(summarize({ a: { b: { c: { d: { e: 1 } } } } }), { a: { b: { c: { d: "…" } } } });
  assert.equal(summarize(12n), "12");
});

test("keep copies a file next to the trace and records the copy, also when it fails", () => {
  const dir = join(scratch, "keep");
  const on = Trace.open("host", dir);
  const source = join(scratch, "vice.log");
  writeFileSync(source, "VICE log\n");
  on.keep(source, "vice-1.log");
  on.keep(join(scratch, "missing.log"), "vice-2.log");
  const kept = readdirSync(dir).find((name) => name.endsWith("-vice-1.log"));
  assert.ok(kept, "the copy is in the trace directory");
  assert.equal(readFileSync(join(dir, kept), "utf8"), "VICE log\n");
  assert.deepEqual(
    lines(on.file!).map((line) => line.event),
    ["trace.start", "trace.kept", "trace.keep-failed"],
  );
});

test("a directory that cannot be used leaves the trace off and warns", () => {
  const blocker = join(scratch, "file");
  writeFileSync(blocker, "");
  const warnings: string[] = [];
  const off = startTrace("script", { env: { [TRACE_VARIABLE]: join(blocker, "sub") }, warn: (line) => warnings.push(line) });
  assert.equal(off.on, false);
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /^C64RT_TRACE=.* cannot be used \(.*\); the trace is off\.$/);
});

test("elapsedMs counts from a performance.now() reading, to a tenth", () => {
  const ms = elapsedMs(performance.now() - 12.34);
  assert.ok(ms >= 12.3 && ms < 100, String(ms));
  assert.equal(Math.round(ms * 10), ms * 10);
});
