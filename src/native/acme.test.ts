import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";

import { WireFailure } from "../protocol/messages.ts";
import { acmeArguments, assemble, parseDiagnostics, parseSymbols } from "./acme.ts";
import { ProcessSupervisor } from "./processes.ts";

const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-acme-test-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

test("argv carries only what the typed request allows", () => {
  const argv = acmeArguments("/usr/bin/acme", { files: [], sourceDir: "src", entrySource: "main.a", includeDirs: ["lib", "../build"], defines: { DEBUG: 1, FAST: true, SLOW: false }, setPc: 0x0801 }, "/w/out");
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
    "-I",
    "../build",
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
    { severity: "error", file: "(outside the source files)", line: 1, message: "Weird." },
  ]);
});

test("a diagnostic in an include folder outside the source root names the file from the source root", () => {
  const output = [
    "Error - File main.a, line 3 (Zone <untitled>): Value not defined.",
    "Error - File gen.a, line 1 (Zone <untitled>): Number does not fit in 8 bits.",
    "Warning - File consts.a, line 2 (Zone <untitled>): Label name starts with a shift-space character.",
    "Serious error - File /w/source/build/x.a, line 2 (Zone <untitled>): Too deeply nested.",
    "Error - File /w/other/x.a, line 1: Weird.",
  ].join("\n");
  const files = ["src/main.a", "src/lib/consts.a", "build/gen.a", "build/x.a"].map((path) => ({ path, size: 1 }));
  assert.deepEqual(parseDiagnostics(output, "/w/source", { files, sourceDir: "src", includeDirs: ["lib", "../build"] }), [
    { severity: "error", file: "main.a", line: 3, message: "Value not defined." },
    { severity: "error", file: "../build/gen.a", line: 1, message: "Number does not fit in 8 bits." },
    { severity: "warning", file: "lib/consts.a", line: 2, message: "Label name starts with a shift-space character." },
    { severity: "error", file: "../build/x.a", line: 2, message: "Too deeply nested." },
    { severity: "error", file: "(outside the source files)", line: 1, message: "Weird." },
  ]);
});

test("the symbol list gives addresses inside the program and constants outside", () => {
  const list = "\tMAX_ENEMIES\t= $8\t; unused\n\tCOLOR\t= $2\n\thelper\t= $80c\t; ?\n\tloop\t= $809\n\tstart\t= $801\t; unused\n";
  assert.deepEqual(parseSymbols(list, { start: 0x0801, end: 0x080d }), [
    { name: "COLOR", kind: "constant", value: 2, used: true },
    { name: "MAX_ENEMIES", kind: "constant", value: 8, used: false },
    { name: "helper", kind: "address", address: 0x080c, used: true },
    { name: "loop", kind: "address", address: 0x0809, used: true },
    { name: "start", kind: "address", address: 0x0801, used: false },
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
  // ACME runs in the source root, a folder of the staged tree.
  const nested = await assemble({ files: [{ path: "src/main.a", size: 1 }], sourceDir: "src", entrySource: "main.a", includeDirs: [], defines: {} }, [Buffer.from("x")], context);
  assert.match(String(nested.result.diagnostics[0]?.message), /out of memory in source\/src\/main\.a$/);
});

test("an entry source or include directory outside the source root is refused by name before ACME runs", async () => {
  const context = { supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env: { PATH: "" } };
  const params = { files: [{ path: "main.a", size: 1 }], entrySource: "main.a", includeDirs: [] as string[], defines: {} };
  const refused = (name: string) => (error: unknown) => error instanceof WireFailure && error.code === "invalid-input" && error.message.includes(name);
  for (const directory of ["/usr/share/acme", "../..", "lib/../../x", "C:/acme", "lib\\x"]) {
    await assert.rejects(assemble({ ...params, includeDirs: ["lib", directory] }, [Buffer.from("x")], context), refused(`include directory ${directory} `));
  }
  for (const entry of ["/etc/passwd", "../main.a", "-v"]) {
    await assert.rejects(assemble({ ...params, entrySource: entry }, [Buffer.from("x")], context), refused(`entry source ${entry} `));
  }
  // From the source root src, .. is the top of the staged tree: only a path above it is an escape.
  const nested = { ...params, files: [{ path: "src/main.a", size: 1 }], sourceDir: "src" };
  for (const directory of ["../..", "../build/../../x", "/usr/share/acme", "C:/acme", "..\\build"]) {
    await assert.rejects(assemble({ ...nested, includeDirs: [directory] }, [Buffer.from("x")], context), refused(`include directory ${directory} `));
  }
  for (const sourceDir of ["..", "/w", "src/../.."]) {
    await assert.rejects(assemble({ ...nested, sourceDir }, [Buffer.from("x")], context), refused(`source directory ${sourceDir} `));
  }
  // An include folder beside the source root passes the checks: the stand-in PATH has no ACME, so the run stops there.
  for (const directory of ["../build", "..", "../build/gen"]) {
    await assert.rejects(assemble({ ...nested, includeDirs: [directory] }, [Buffer.from("x")], context), (error: unknown) => error instanceof WireFailure && error.code === "installation-incomplete");
  }
});
