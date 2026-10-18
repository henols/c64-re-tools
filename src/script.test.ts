// The script contract, run in a child process so the exit status and the output are real.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { pathToFileURL } from "node:url";

import { CONTRACT_USAGE, listed, takeProject, UsageError } from "./script.ts";

const url = (file: string) => JSON.stringify(pathToFileURL(join(import.meta.dirname, file)).href);

/** A script "demo" with the commands that the tests call. `names` knows main_loop at $0810 in c64 and $0300 in drive8. */
const FIXTURE = `
import { runScript, OPTIONS, UsageError } from ${url("script.ts")};
import { Refusal } from ${url("errors.ts")};
import { WireFailure } from ${url("protocol/messages.ts")};
import { projectRoot } from ${url("project.ts")};
const names = (name, space) => {
  if (name === "main_loop") return space === "drive8" ? 0x300 : 0x810;
  throw new Refusal("not-found", name + " is not a name in the knowledge. Give a $ address, or a name that knowledge.ts symbols lists, with or without --analyzer.");
};
class Coded extends Error { code = "conflict"; }
await runScript({
  name: "demo",
  summary: "A script for the tests.",
  names,
  commands: [
    { name: "echo", summary: "Gives its subjects and options back.", subjects: [{ name: "<word>", help: "a word" }, { name: "<more>", help: "more words", optional: true, list: true }],
      options: { out: { ...OPTIONS.out, output: "file" }, flag: { kind: "flag", help: "a flag" }, item: { kind: "text", value: "<text>", help: "an item", multiple: true }, "max-listed": OPTIONS["max-listed"] },
      run: (call) => ({ subjects: call.subjects, out: call.string("out") ?? null, flag: call.flag("flag"), items: call.strings("item"), maxListed: call.count("max-listed") }) },
    { name: "at", summary: "An address.", subjects: [{ name: "<address>", help: "an address" }], options: { space: OPTIONS.space, entry: OPTIONS.entry, range: OPTIONS.range },
      run: (call) => ({ address: call.parseAddress(call.subject(0), "<address>"), entry: call.address("entry") ?? null, range: call.range("range") ?? null }) },
    { name: "need", summary: "A required option.", options: { out: { ...OPTIONS.out, output: "folder", required: true }, frames: OPTIONS.frames }, run: (call) => ({ out: call.string("out"), frames: call.count("frames") ?? null }) },
    { name: "bare", summary: "An --out without an output kind.", options: { out: OPTIONS.out }, run: () => ({}) },
    { name: "check", summary: "A check.", subjects: [{ name: "<result>", help: "PASS, FAIL or INCONCLUSIVE" }], run: (call) => ({ result: call.subject(0) }) },
    { name: "refuse", summary: "Refuses.", run: () => { throw new WireFailure("machine-unavailable", "The Host Runtime does not answer."); } },
    { name: "coded", summary: "An error with a code from the list.", run: () => { throw new Coded("two writes disagree"); } },
    { name: "usage", summary: "A usage error.", run: () => { throw new UsageError("give one file"); } },
    { name: "crash", summary: "A fault.", run: () => { throw new RangeError("index out of range"); } },
    { name: "later", summary: "A fault after the result.", run: () => { setTimeout(() => { throw new TypeError("late"); }, 10); return new Promise(() => {}); } },
    { name: "reject", summary: "A rejection that nothing catches.", run: () => { Promise.reject(new Error("lost")); return new Promise(() => {}); } },
    { name: "wrong", summary: "A shared option with another kind.", options: { out: { kind: "flag", help: "wrong" } }, run: () => ({}) },
    { name: "where", summary: "The project.", run: () => ({ root: projectRoot() }) },
    { name: "span", summary: "A range subject.", subjects: [{ name: "<range>", help: "a range" }, { name: "<type>", help: "a type", optional: true }], run: (call) => ({ range: call.parseRange(call.subject(0), "<range>") }) },
  ],
});
`;

/** Runs the fixture with `args` as its command line; returns its exit status and output. */
function run(args: readonly string[], cwd?: string, source = FIXTURE): { status: number | null; stdout: string; stderr: string; json: any } {
  // With --eval, process.argv has no script entry: "demo" takes its place, so argv.slice(2) is args.
  const child = spawnSync(process.execPath, [...process.execArgv, "--input-type=module", "--eval", source, "demo", ...args], { encoding: "utf8", timeout: 30_000, ...(cwd === undefined ? {} : { cwd }) });
  let json: unknown;
  try {
    json = JSON.parse(child.stdout);
  } catch {
    json = undefined;
  }
  return { status: child.status, stdout: child.stdout, stderr: child.stderr, json };
}

/** Asserts one JSON error line, exit status 2 and nothing on stderr; returns the error. */
function refused(args: readonly string[], code: string): { code: string; message: string } {
  const result = run(args);
  assert.equal(result.status, 2, result.stderr);
  assert.equal(result.stdout.split("\n").length, 2, result.stdout);
  assert.equal(result.stderr, "");
  assert.equal(result.json?.error?.code, code, result.stdout);
  return result.json.error;
}

test("a result is one JSON line with exit status 0", () => {
  const result = run(["echo", "a", "b", "c", "--out", "x.json", "--flag", "--item", "one", "--item", "two", "--max-listed", "7"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.json, { subjects: ["a", "b", "c"], out: "x.json", flag: true, items: ["one", "two"], maxListed: 7 });
  assert.equal(result.stdout.split("\n").length, 2);
});

test("an option that is not given gets its default", () => {
  assert.deepEqual(run(["echo", "a"]).json, { subjects: ["a"], out: null, flag: false, items: [], maxListed: 50 });
});

test("a check gives exit status 0 for PASS, 1 for FAIL and 3 for INCONCLUSIVE", () => {
  assert.equal(run(["check", "PASS"]).status, 0);
  const fail = run(["check", "FAIL"]);
  assert.equal(fail.status, 1);
  assert.deepEqual(fail.json, { result: "FAIL" });
  assert.equal(run(["check", "INCONCLUSIVE"]).status, 3);
});

test("--help gives the usage as text with exit status 0, for the script and for one command", () => {
  const script = run(["--help"]);
  assert.equal(script.status, 0);
  assert.match(script.json.text, /^demo\.ts <command> \[subjects\.\.\.\] \[options\]/);
  assert.match(script.json.text, /\n {2}echo +Gives its subjects and options back\./);
  assert.ok(script.json.text.endsWith(CONTRACT_USAGE));
  const command = run(["echo", "--help"]);
  assert.equal(command.status, 0);
  assert.match(command.json.text, /^demo\.ts echo <word> \[<more>\.\.\.\] \[--out <path>\] \[--flag\] \[--item <text>\]\.\.\. \[--max-listed <n>\]\n/);
  assert.match(command.json.text, /--item <text> +an item \(repeatable\)/);
});

test("a refusal keeps its code; any error with a code from the list is a refusal", () => {
  assert.equal(refused(["refuse"], "machine-unavailable").message, "The Host Runtime does not answer.");
  assert.equal(refused(["coded"], "conflict").message, "two writes disagree");
});

test("a usage error names the problem, then the usage of the command", () => {
  const error = refused(["usage"], "invalid-input");
  assert.match(error.message, /^give one file\n\ndemo\.ts usage\n\nA usage error\./);
});

test("a fault is operation-failed with no stack, also one that nothing caught", () => {
  const error = refused(["crash"], "operation-failed");
  assert.match(error.message, /^demo\.ts crash failed inside c64-re-tools: index out of range\. This is a fault of the toolkit/);
  assert.match(refused(["later"], "operation-failed").message, /demo\.ts later failed inside c64-re-tools: late\./);
  assert.match(refused(["reject"], "operation-failed").message, /demo\.ts reject failed inside c64-re-tools: lost\./);
  assert.match(refused(["wrong"], "operation-failed").message, /--out of wrong is a flag, but OPTIONS has it as a path\. This is a fault of the toolkit/);
  assert.match(refused(["bare"], "operation-failed").message, /--out of bare has no output kind \(file or folder\)\. This is a fault of the toolkit/);
});

test("a wrong command line is invalid-input with exit status 2", () => {
  assert.match(refused([], "invalid-input").message, /^give a command: echo, at, need/);
  assert.match(refused(["nothing"], "invalid-input").message, /^nothing is not a command of demo\.ts/);
  assert.match(refused(["echo"], "invalid-input").message, /^echo needs <word> <more>\.\.\./);
  assert.match(refused(["at", "$c000", "$c001"], "invalid-input").message, /^at takes <address>\. "\$c001" is one too many/);
  assert.match(refused(["echo", "a", "--bogus"], "invalid-input").message, /^echo has no option --bogus\. Its options are --out, --flag, --item and --max-listed\n/);
  assert.match(refused(["need"], "invalid-input").message, /^need needs --out <path>/);
  assert.match(refused(["need", "--out", "x", "--frames", "0"], "invalid-input").message, /^--frames must be a whole number from 1 to 1000000, not "0"/);
  assert.match(refused(["need", "--out", "x", "--frames", "$10"], "invalid-input").message, /^--frames must be a whole number/);
  assert.match(refused(["echo", "a", "--out", "../x.json"], "invalid-input").message, /^--out: \.\.\/x\.json leads out of the project folder/);
  assert.match(refused(["echo", "a", "--out", "/tmp/x.json"], "invalid-input").message, /^--out: \/tmp\/x\.json is not relative/);
});

test("an address is $ and 1 to 4 hex digits, or a name in the space of the command", () => {
  assert.deepEqual(run(["at", "$fb"]).json, { address: 0xfb, entry: null, range: null });
  assert.deepEqual(run(["at", "$C000", "--entry", "main_loop"]).json, { address: 0xc000, entry: 0x810, range: null });
  assert.deepEqual(run(["at", "main_loop", "--space", "drive8"]).json, { address: 0x300, entry: null, range: null });
  assert.match(refused(["at", "$12345"], "invalid-input").message, /^<address> must be \$ and 1 to 4 hex digits/);
  assert.match(refused(["at", "c000"], "invalid-input").message, /^<address>: c000 is not a name in the knowledge\. Give a \$ address/);
  assert.match(refused(["at", "$c000", "--entry", "12-3"], "invalid-input").message, /^--entry must be \$ and 1 to 4 hex digits/);
  assert.match(refused(["at", "$c000", "--space", "drive9"], "invalid-input").message, /^--space must be c64, drive8, or bank0 to bank255/);
});

test("a range is <start>-<end>, each an address, and does not end before its start", () => {
  assert.deepEqual(run(["at", "$0", "--range", "$c000-$cfff"]).json.range, { start: 0xc000, end: 0xcfff });
  assert.deepEqual(run(["at", "$0", "--range", "$0800-main_loop"]).json.range, { start: 0x800, end: 0x810 });
  assert.match(refused(["at", "$0", "--range", "$c000"], "invalid-input").message, /^--range must be <start>-<end>/);
  assert.match(refused(["at", "$0", "--range", "$cfff-$c000"], "invalid-input").message, /^--range ends at \$c000, before its start \$cfff/);
});

test("a range in two parts is refused with the range as one token", () => {
  assert.deepEqual(run(["span", "$1bc2-$1bd0"]).json.range, { start: 0x1bc2, end: 0x1bd0 });
  assert.match(refused(["span", "$1bc2", "$1bd0"], "invalid-input").message, /^<range> is one token <start>-<end>: give '\$1bc2-\$1bd0', not '\$1bc2' '\$1bd0'/);
  assert.match(refused(["span", "$fb", "$fe", "workspace"], "invalid-input").message, /^<range> is one token <start>-<end>: give '\$fb-\$fe'/);
  assert.match(refused(["span", "main_loop", "$0820"], "invalid-input").message, /give 'main_loop-\$0820'/);
  assert.match(refused(["at", "$0", "--start", "$c000", "--end", "$cfff"], "invalid-input").message, /^at takes no --start or --end\. Give the range as one option: --range '\$c000-\$cfff'/);
  assert.match(refused(["at", "$0", "--start=$c000"], "invalid-input").message, /--range '\$c000-<end>'/);
  // A command without a range option keeps the message of an unknown option.
  assert.match(refused(["echo", "a", "--start", "$c000"], "invalid-input").message, /^echo has no option --start\. Its options are/);
  // A range option in two parts.
  assert.match(refused(["at", "$0", "--range", "$1bc2", "$1c00"], "invalid-input").message, /^--range is one token <start>-<end>: give --range '\$1bc2-\$1c00', not '\$1bc2' '\$1c00'/);
  assert.match(refused(["at", "$0", "--range=$1bc2", "$1c00"], "invalid-input").message, /^--range is one token <start>-<end>: give --range '\$1bc2-\$1c00'/);
});

test("a wrong option word gets a message of the toolkit that names the option and what to give", () => {
  const messages = [
    refused(["echo", "a", "--bogus"], "invalid-input").message,
    refused(["echo", "a", "--max-listed", "-1"], "invalid-input").message,
    refused(["echo", "a", "--item", "-x"], "invalid-input").message,
    refused(["echo", "a", "--item"], "invalid-input").message,
    refused(["echo", "a", "--flag=yes"], "invalid-input").message,
    refused(["echo", "a", "-1"], "invalid-input").message,
    refused(["check", "x", "--bogus"], "invalid-input").message,
  ];
  assert.match(messages[1]!, /^--max-listed must be a whole number from 0 to 100000, not "-1"/);
  assert.match(messages[2]!, /^--item needs a value: give --item <text>, not -x\. Give a value that starts with - as --item=-x/);
  assert.match(messages[3]!, /^--item needs a value: give --item <text>/);
  assert.match(messages[4]!, /^--flag is a flag: give --flag without a value/);
  assert.match(messages[5]!, /^-1 is not an option of echo: an option starts with --\..* Give a subject that starts with - after --, for example -- -1/);
  assert.match(messages[6]!, /^check has no option --bogus\. It takes no options/);
  // No text of Node parseArgs, and no unbalanced quote.
  for (const message of messages) assert.doesNotMatch(message, /Unknown option|positional argument|ambiguous|Did you forget|'-- "/);
  // A value with - is taken in the form --name=<value>, and a lone - is a subject.
  assert.deepEqual(run(["echo", "a", "--item=-x", "-"]).json.items, ["-x"]);
  assert.deepEqual(run(["echo", "a", "-"]).json.subjects, ["a", "-"]);
  assert.deepEqual(run(["echo", "a", "--", "-1"]).json.subjects, ["a", "-1"]);
});

test("takeProject takes --project in both forms out of the command line, up to --", () => {
  assert.deepEqual(takeProject(["list", "--project", "game", "--space", "c64"]), { project: "game", argv: ["list", "--space", "c64"] });
  assert.deepEqual(takeProject(["--project=game", "at", "$c000"]), { project: "game", argv: ["at", "$c000"] });
  assert.deepEqual(takeProject(["comment", "--", "--project", "x"]), { argv: ["comment", "--", "--project", "x"] });
  assert.deepEqual(takeProject(["at", "$c000"]), { argv: ["at", "$c000"] });
  assert.throws(() => takeProject(["--project"]), UsageError);
  assert.throws(() => takeProject(["--project", "--out", "x"]), UsageError);
  assert.throws(() => takeProject(["--project="]), UsageError);
  assert.throws(() => takeProject(["--project", "a", "--project", "b"]), /only once/);
});

test("--project sets the project of the script", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "c64-re-tools-script-"));
  try {
    mkdirSync(join(sandbox, "game", ".c64-re-tools"), { recursive: true });
    const chosen = run(["where", "--project", "game"], sandbox);
    assert.equal(chosen.status, 0, chosen.stderr);
    assert.deepEqual(chosen.json, { root: join(realpathSync(sandbox), "game") });

    const below = run(["where"], sandbox);
    assert.equal(below.status, 2, below.stderr);
    assert.equal(below.json.error.code, "invalid-input");
    assert.match(below.json.error.message, /These folders below it are projects: game\. Give --project <folder>/);

    const missing = run(["where", "--project", "nothing"], sandbox);
    assert.equal(missing.status, 2, missing.stderr);
    assert.equal(missing.json.error.code, "not-found");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("an output path is refused before the command runs: in the knowledge, a folder for a file, a file for a folder", () => {
  const sandbox = mkdtempSync(join(tmpdir(), "c64-re-tools-script-"));
  try {
    mkdirSync(join(sandbox, ".c64-re-tools", "knowledge"), { recursive: true });
    mkdirSync(join(sandbox, ".c64-re-tools", "local"), { recursive: true });
    mkdirSync(join(sandbox, "results"));
    writeFileSync(join(sandbox, ".c64-re-tools", "knowledge", "symbols.jsonl"), "keep\n");
    writeFileSync(join(sandbox, "README.md"), "x");
    const error = (args: string[]) => {
      const result = run(args, sandbox);
      assert.equal(result.status, 2, result.stdout);
      assert.equal(result.json.error.code, "invalid-input", result.stdout);
      return result.json.error.message as string;
    };
    assert.match(error(["echo", "a", "--out", ".c64-re-tools/knowledge/symbols.jsonl"]), /^--out: \.c64-re-tools\/knowledge\/symbols\.jsonl is in \.c64-re-tools\/knowledge\/, the knowledge of the project\. Only the c64-knowledge skill writes it/);
    assert.match(error(["echo", "a", "--out", "./.C64-RE-TOOLS/Knowledge/new.jsonl"]), /is in \.c64-re-tools\/knowledge\//);
    assert.equal(
      error(["echo", "a", "--out", ".c64-re-tools/local/knowledge.db"]),
      "--out: .c64-re-tools/local/knowledge.db is the index of the knowledge. Only the c64-knowledge skill writes it: a write there destroys the index. Give another file name, for example .c64-re-tools/local/<other name>.",
    );
    assert.match(error(["need", "--out", ".c64-re-tools/knowledge/pages"]), /, for example \.c64-re-tools\/local\/<folder>\.$/);
    assert.match(error(["need", "--out", ".c64-re-tools/knowledge"]), /is in \.c64-re-tools\/knowledge\//);
    assert.equal(error(["echo", "a", "--out", "results"]), "--out: results is a folder. Give the path of a file.");
    assert.equal(error(["need", "--out", "README.md"]), "--out: README.md is a file, but --out needs a folder. Give the path of a folder, or a new path for the folder.");
    assert.equal(error(["echo", "a", "--out", "README.md/page.md"]), "--out: README.md/page.md has a file where a folder must be. Give a path whose folders are folders.");
    if (process.platform !== "win32") {
      symlinkSync(join(sandbox, ".c64-re-tools", "knowledge"), join(sandbox, "linked"));
      assert.match(error(["echo", "a", "--out", "linked/symbols.jsonl"]), /is in \.c64-re-tools\/knowledge\//);
    }
    assert.equal(readFileSync(join(sandbox, ".c64-re-tools", "knowledge", "symbols.jsonl"), "utf8"), "keep\n");
    assert.deepEqual(run(["echo", "a", "--out", ".c64-re-tools/local/scratch.json"], sandbox).json.out, ".c64-re-tools/local/scratch.json");
    assert.deepEqual(run(["need", "--out", "results/new/deeper"], sandbox).json.out, "results/new/deeper");
  } finally {
    rmSync(sandbox, { recursive: true, force: true });
  }
});

test("a list in a result has its count, its first items, and where to get the rest", () => {
  assert.deepEqual(listed([1, 2, 3], 5), { count: 3, listed: [1, 2, 3] });
  assert.deepEqual(listed([1, 2, 3], 2, (item) => item * 10), { count: 3, listed: [10, 20], rest: "a larger --max-listed" });
  assert.deepEqual(listed([1, 2, 3], 0, undefined, "--out <file>"), { count: 3, listed: [], rest: "--out <file>" });
});
