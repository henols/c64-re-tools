import assert from "node:assert/strict";
import { test } from "node:test";

import { acmeArguments, parseDiagnostics, parseSymbols } from "./acme.ts";

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
    "/w/out/program.prg",
    "--symbollist",
    "/w/out/symbols.txt",
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
