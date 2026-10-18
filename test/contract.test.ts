// The call contract of every skill script, from the outside: each command
// answers --help with its usage, and each wrong call with one JSON error and
// exit status 2, with nothing on stderr. No code that a script reaches throws
// a bare Error. The skill docs share their blocks word for word, and name only
// commands and options that the scripts have.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, before, test } from "node:test";

import { closureOf } from "../distribution/plugin.ts";

const ROOT = join(import.meta.dirname, "..");

interface Script {
  skill: string;
  name: string;
  path: string;
}

const SCRIPTS: Script[] = readdirSync(join(ROOT, "skills"))
  .sort()
  .flatMap((skill) => {
    let names: string[] = [];
    try {
      names = readdirSync(join(ROOT, "skills", skill, "scripts")).filter((name) => name.endsWith(".ts"));
    } catch {
      return [];
    }
    return names.map((name) => ({ skill, name, path: join(ROOT, "skills", skill, "scripts", name) }));
  });

/** The content of a knowledge file that no --out may change. */
const KEPT = "kept\n";

let project: string;
before(() => {
  project = mkdtempSync(join(tmpdir(), "c64-re-tools-contract-"));
  mkdirSync(join(project, ".c64-re-tools", "knowledge"), { recursive: true });
  writeFileSync(join(project, ".c64-re-tools", "knowledge", "symbols.jsonl"), KEPT);
  writeFileSync(join(project, "README.md"), "x");
  mkdirSync(join(project, "afolder"));
});
after(() => rmSync(project, { recursive: true, force: true }));

interface Run {
  status: number | null;
  stdout: string;
  stderr: string;
}

/** Runs a script in the empty project. No host runs: every call here must fail or answer before it needs one. */
function call(script: Script, args: readonly string[]): Promise<Run> {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [...process.execArgv, script.path, ...args], { cwd: project, env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("close", (status) => resolve({ status, stdout, stderr }));
  });
}

/** Runs the calls with at most 8 at a time. */
async function all<T, U>(items: readonly T[], body: (item: T) => Promise<U>): Promise<U[]> {
  const results: U[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await body(items[index]!);
      }
    }),
  );
  return results;
}

interface Command {
  script: Script;
  name: string;
  usage: string;
  /** The subjects that the command needs. */
  required: number;
  /** The options and their value forms, for example ["--out", "<path>"]; a flag has no value form. */
  options: Array<[string, string | undefined]>;
  /** The options that the command needs, with their value forms. */
  needed: Array<[string, string]>;
}

let commandsCache: Command[] | undefined;

/** Every command of every script, from --help. */
async function commands(): Promise<Command[]> {
  if (commandsCache !== undefined) return commandsCache;
  const lists = await all(SCRIPTS, async (script) => {
    const help = await call(script, ["--help"]);
    assert.equal(help.status, 0, `${script.name} --help: ${help.stdout}${help.stderr}`);
    const text = (JSON.parse(help.stdout) as { text: string }).text;
    const names = text.split("Commands:\n")[1]!.split("\n\n")[0]!.split("\n").map((line) => line.trim().split(/\s+/)[0]!);
    return all(names, async (name): Promise<Command> => {
      const own = await call(script, [name, "--help"]);
      assert.equal(own.status, 0, `${script.name} ${name} --help: ${own.stdout}${own.stderr}`);
      const usage = (JSON.parse(own.stdout) as { text: string }).text;
      const synopsis = usage.split("\n")[0]!;
      const words = synopsis.split(" ").slice(2);
      const required = words.filter((word) => /^<[^>]+>(\.\.\.)?$/.test(word)).length;
      const options = [...synopsis.matchAll(/(--[a-z0-9-]+)(?: (<[^>\]]+>|NAME=VALUE))?/g)].map((match): [string, string | undefined] => [match[1]!, match[2]]);
      const needed = [...synopsis.matchAll(/(?<!\[)(--[a-z0-9-]+) (<[^>\]]+>)/g)].map((match): [string, string] => [match[1]!, match[2]!]);
      return { script, name, usage, required, options, needed };
    });
  });
  commandsCache = lists.flat();
  return commandsCache;
}

/** Asserts one JSON error line with the code, exit status 2 and nothing on stderr. */
function refused(run: Run, code: string, what: string): { code: string; message: string } {
  assert.equal(run.status, 2, `${what}: ${run.stdout}${run.stderr}`);
  assert.equal(run.stderr, "", `${what}: stderr`);
  const lines = run.stdout.split("\n").filter((line) => line !== "");
  assert.equal(lines.length, 1, `${what}: one line`);
  const { error } = JSON.parse(lines[0]!) as { error: { code: string; message: string } };
  assert.equal(error.code, code, `${what}: ${error.message}`);
  return error;
}

test("every script lists its commands, and every command gives its usage as text", async () => {
  const found = await commands();
  assert.ok(found.length >= 70, `${found.length} commands`);
  for (const command of found) assert.ok(command.usage.startsWith(`${command.script.name} ${command.name}`), `${command.script.name} ${command.name}`);
});

test("a script is named after its skill", () => {
  for (const script of SCRIPTS) assert.equal(script.name, `${script.skill.replace(/^c64-/, "")}.ts`, script.path);
});

test("every wrong call is one JSON error with exit status 2 and nothing on stderr", async () => {
  const found = await commands();
  await all(SCRIPTS, async (script) => {
    refused(await call(script, []), "invalid-input", `${script.name} without a command`);
    refused(await call(script, ["no-such-command"]), "invalid-input", `${script.name} no-such-command`);
  });
  await all(found, async (command) => {
    const what = `${command.script.name} ${command.name}`;
    const subjects = Array.from({ length: command.required }, () => "x");
    refused(await call(command.script, [command.name, ...subjects, "--no-such-option"]), "invalid-input", `${what} --no-such-option`);
    if (command.required > 0) refused(await call(command.script, [command.name]), "invalid-input", `${what} without subjects`);
    for (const [option, value] of command.options) {
      if (value === "<address>") refused(await call(command.script, [command.name, ...subjects, option, "12-3"]), "invalid-input", `${what} ${option} 12-3`);
      if (value === "<start>-<end>") refused(await call(command.script, [command.name, ...subjects, option, "$c000"]), "invalid-input", `${what} ${option} $c000`);
      if (value === "<file>" || value === "<path>" || value === "<dir>") refused(await call(command.script, [command.name, ...subjects, option, "../out"]), "invalid-input", `${what} ${option} ../out`);
    }
  });
});

/** A value of the form, which the command line parser takes. */
const SAMPLE: Record<string, string> = { "<address>": "$0400", "<start>-<end>": "$0400-$04ff", "<n>": "1", "<bytes>": "64" };

test("every --out and --out-<name> is refused before the command does any work: in the knowledge, a folder for a file, a file for a folder", async () => {
  const found = (await commands()).filter((command) => command.options.some(([option]) => /^--out(-|$)/.test(option)));
  assert.ok(found.length >= 20, `${found.length} commands with an output`);
  await all(found, async (command) => {
    // required counts the values of the needed options too.
    const subjects = Array.from({ length: command.required - command.needed.length }, () => "x");
    for (const [option, value] of command.options.filter(([name]) => /^--out(-|$)/.test(name))) {
      const what = `${command.script.name} ${command.name} ${option}`;
      const others = command.needed.filter(([name]) => name !== option).flatMap(([name, form]) => [name, SAMPLE[form] ?? "x"]);
      const refusedAt = async (path: string) => refused(await call(command.script, [command.name, ...subjects, ...others, option, path]), "invalid-input", `${what} ${path}`).message;
      const folder = value === "<dir>";
      assert.match(await refusedAt(folder ? ".c64-re-tools/knowledge" : ".c64-re-tools/knowledge/symbols.jsonl"), new RegExp(`^${option}: \\.c64-re-tools/knowledge.* is in \\.c64-re-tools/knowledge/, the knowledge of the project`), what);
      if (folder) assert.equal(await refusedAt("README.md"), `${option}: README.md has a file where a folder must be. Give a path whose folders are folders.`, what);
      else assert.equal(await refusedAt("afolder"), `${option}: afolder is a folder. Give the path of a file.`, what);
    }
  });
  assert.equal(readFileSync(join(project, ".c64-re-tools", "knowledge", "symbols.jsonl"), "utf8"), KEPT);
});

test("no code that a script reaches throws a bare Error, TypeError or RangeError", () => {
  const reached = new Set<string>();
  for (const skill of new Set(SCRIPTS.map((script) => script.skill))) {
    const directory = join(ROOT, "skills", skill);
    for (const file of closureOf(directory, SCRIPTS.filter((script) => script.skill === skill).map((script) => script.path))) reached.add(file);
  }
  const found: string[] = [];
  for (const file of reached) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        if (/throw new (Error|TypeError|RangeError)\(/.test(line)) found.push(`${file.slice(ROOT.length + 1)}:${index + 1}`);
      });
  }
  assert.ok(reached.size > 50, `${reached.size} files`);
  assert.deepEqual(found, [], "throw a Refusal with a code from src/errors.ts");
});

/** The text of a "### <title>" section of a SKILL.md, up to the next heading. */
function section(skill: string, title: string): string | undefined {
  const text = readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
  const start = text.indexOf(`\n### ${title}\n`);
  if (start < 0) return undefined;
  const rest = text.slice(start + 1);
  const end = rest.slice(4).search(/\n#{1,3} /);
  return end < 0 ? rest : rest.slice(0, end + 4);
}

test("every skill with scripts has the same Calling the script and Project folder sections", () => {
  const skills = [...new Set(SCRIPTS.map((script) => script.skill))];
  for (const title of ["Calling the script", "Project folder"]) {
    const texts = skills.map((skill) => [skill, section(skill, title)] as const);
    for (const [skill, text] of texts) assert.ok(text !== undefined, `${skill} has no section ${title}`);
    for (const [skill, text] of texts) assert.equal(text, texts[0]![1], `${skill}: ${title} differs from ${texts[0]![0]}`);
  }
});

test("a SKILL.md names only commands and options that its scripts have", async () => {
  const found = await commands();
  for (const skill of new Set(SCRIPTS.map((script) => script.skill))) {
    const text = readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
    for (const match of text.matchAll(/scripts\/([a-z-]+\.ts) ([a-z-]+)([^\n`]*)/g)) {
      const [, name, commandName, rest] = match;
      const command = found.find((item) => item.script.name === name && item.name === commandName);
      assert.ok(command !== undefined, `${skill}: ${name} has no command ${commandName}`);
      for (const option of rest!.matchAll(/(?<![\w-])--[a-z][a-z0-9-]*/g)) {
        if (option[0] === "--project" || option[0] === "--help") continue;
        assert.ok(command.options.some(([known]) => known === option[0]), `${skill}: ${name} ${commandName} has no ${option[0]}`);
      }
    }
  }
});
