import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { acmeArguments, assemble, parseDiagnostics, parseSymbols } from "./acme.ts";
import { ProcessSupervisor } from "./processes.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-acme-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("argv carries only what the typed request allows", () => {
  const argv = acmeArguments("/usr/bin/acme", { files: [], entrySource: "main.a", includeDirs: ["lib"], defines: { DEBUG: 1, FAST: true, SLOW: false }, setPc: 0x0801 }, "/w/out");
  assert.deepEqual(argv, [
    "/usr/bin/acme",
    "--format",
    "cbm",
    "--cpu",
    "6510",
    "--maxerrors",
    "100",
    "-o",
    join("/w/out", "program.prg"),
    "--symbollist",
    join("/w/out", "symbols.txt"),
    "-I",
    "lib",
    "-DDEBUG=1",
    "-DFAST=1",
    "-DSLOW=0",
    "--setpc",
    "2049",
    "main.a",
  ]);
});

test("ACME messages become structured diagnostics with source-root-relative files", () => {
  const output = [
    "Error - File bad.a, line 4 (Zone <untitled>): Cannot open input file \"lib/missing.a\".",
    "Warning - File main.a, line 1 (Zone <untitled>): Output file already chosen.",
    "Serious error - File /w/source/lib/x.a, line 2 (Zone <untitled>): Too deeply nested.",
    "Error - File /etc/x.a, line 1: Weird.",
    "noise",
  ].join("\n");
  assert.deepEqual(parseDiagnostics(output, "/w/source"), [
    { severity: "error", file: "bad.a", line: 4, message: 'Cannot open input file "lib/missing.a".' },
    { severity: "warning", file: "main.a", line: 1, message: "Output file already chosen." },
    { severity: "error", file: "lib/x.a", line: 2, message: "Too deeply nested." },
    { severity: "error", file: "(outside the source root)", line: 1, message: "Weird." },
  ]);
});

test("the symbol list gives addresses inside the program and constants outside", () => {
  const list = "\tMAX_ENEMIES\t= $8\t; unused\n\tCOLOR\t= $2\n\thelper\t= $80c\t; ?\n\tloop\t= $809\n\tstart\t= $801\t; unused\n";
  assert.deepEqual(parseSymbols(list, { start: 0x0801, end: 0x080d }), [
    { name: "COLOR", kind: "constant", value: 2, used: true },
    { name: "MAX_ENEMIES", kind: "constant", value: 8, used: false },
    { name: "helper", kind: "address", value: 0x080c, used: true },
    { name: "loop", kind: "address", value: 0x0809, used: true },
    { name: "start", kind: "address", value: 0x0801, used: false },
  ]);
});

test("an ACME failure without a usual error message quotes the last output of ACME", { skip: process.platform === "win32" ? "the stand-in ACME is a shell script" : false }, async () => {
  const acme = join(scratch, "acme");
  writeFileSync(acme, '#!/bin/sh\necho "acme: out of memory in $PWD/main.a" >&2\nexit 1\n');
  chmodSync(acme, 0o755);
  const context = { supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env: { ...process.env, C64RT_ACME: acme } };
  const { result } = await assemble({ files: [{ path: "main.a", size: 1 }], entrySource: "main.a", includeDirs: [], defines: {} }, [Buffer.from("x")], context);
  assert.equal(result.assembled, false);
  assert.deepEqual(result.diagnostics, [
    { severity: "error", message: "ACME stopped with exit code 1 and gave no error in its usual form.\nThe last output of ACME:\n  acme: out of memory in source/main.a" },
  ]);
});
