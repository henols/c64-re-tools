// The call contract of every skill script, from the outside: no arguments and
// each --help give the help envelope, and each wrong call gives one ok:false
// envelope with exit status 2, with nothing on stderr. No code that a script
// reaches throws a bare Error. The skill docs follow the skill standard: one
// run line, a command table and a Flags table that agree with the scripts, one
// section for each command, shared blocks word for word, and no name of
// another skill.

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
  synopsis: string;
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
    const help = await call(script, []);
    assert.equal(help.status, 0, `${script.name} without arguments: ${help.stdout}${help.stderr}`);
    const envelope = JSON.parse(help.stdout) as { ok: boolean; command: string; body: { commands: Array<{ name: string }> } };
    assert.equal(envelope.command, "help", script.name);
    const names = envelope.body.commands.map((command) => command.name);
    return all(names, async (name): Promise<Command> => {
      const own = await call(script, [name, "--help"]);
      assert.equal(own.status, 0, `${script.name} ${name} --help: ${own.stdout}${own.stderr}`);
      const { synopsis } = (JSON.parse(own.stdout) as { body: { synopsis: string } }).body;
      const words = synopsis.split(" ").slice(2);
      const required = words.filter((word) => /^<[^>]+>(\.\.\.)?$/.test(word)).length;
      const options = [...synopsis.matchAll(/(--[a-z0-9-]+)(?: (<[^>\]]+>|NAME=VALUE))?/g)].map((match): [string, string | undefined] => [match[1]!, match[2]]);
      const needed = [...synopsis.matchAll(/(?<!\[)(--[a-z0-9-]+) (<[^>\]]+>)/g)].map((match): [string, string] => [match[1]!, match[2]!]);
      return { script, name, synopsis, required, options, needed };
    });
  });
  commandsCache = lists.flat();
  return commandsCache;
}

interface Refused {
  code: string;
  error: string;
  hint?: string;
  nextAction?: string;
  /** error and hint. */
  message: string;
}

/** Asserts one ok:false envelope line with the code, exit status 2 and nothing on stderr. A nextAction is a full command line of the script. */
function refused(run: Run, code: string, what: string): Refused {
  assert.equal(run.status, 2, `${what}: ${run.stdout}${run.stderr}`);
  assert.equal(run.stderr, "", `${what}: stderr`);
  const lines = run.stdout.split("\n").filter((line) => line !== "");
  assert.equal(lines.length, 1, `${what}: one line`);
  const envelope = JSON.parse(lines[0]!) as Refused & { ok: boolean };
  assert.equal(envelope.ok, false, `${what}: ok`);
  assert.equal(envelope.code, code, `${what}: ${envelope.error} ${envelope.hint ?? ""}`);
  assert.equal(typeof envelope.error, "string", `${what}: error`);
  if (envelope.nextAction !== undefined) assert.match(envelope.nextAction, /^node \/\S+\.ts /, `${what}: nextAction`);
  return { ...envelope, message: [envelope.error, envelope.hint].filter((part) => part !== undefined).join(" ") };
}

test("every script gives its command list without arguments, and every command gives its synopsis", async () => {
  const found = await commands();
  assert.ok(found.length >= 70, `${found.length} commands`);
  for (const command of found) assert.ok(command.synopsis.startsWith(`${command.script.name} ${command.name}`), `${command.script.name} ${command.name}`);
});

test("a script is named after its skill", () => {
  for (const script of SCRIPTS) assert.equal(script.name, `${script.skill.replace(/^c64-/, "")}.ts`, script.path);
});

test("every wrong call is one ok:false envelope with exit status 2 and nothing on stderr", async () => {
  const found = await commands();
  await all(SCRIPTS, async (script) => {
    refused(await call(script, ["no-such-command"]), "invalid-input", `${script.name} no-such-command`);
  });
  await all(found, async (command) => {
    const what = `${command.script.name} ${command.name}`;
    const subjects = Array.from({ length: command.required }, () => "x");
    refused(await call(command.script, [command.name, ...subjects, "--no-such-option"]), "invalid-input", `${what} --no-such-option`);
    // A flag of another command of the script: the hint names the commands that take it.
    const own = new Set(command.options.map(([option]) => option));
    const other = found.find((item) => item.script === command.script && item.options.some(([option]) => !own.has(option)));
    const foreign = other?.options.find(([option]) => !own.has(option));
    if (foreign !== undefined) {
      const error = refused(await call(command.script, [command.name, ...subjects, foreign[0], ...(foreign[1] === undefined ? [] : ["x"])]), "invalid-input", `${what} ${foreign[0]}`);
      assert.match(error.hint ?? "", new RegExp(`^${foreign[0]} is an option of .*\\b${other!.name}\\b`), `${what} ${foreign[0]}: ${error.message}`);
    }
    // A surplus argument.
    if (!command.synopsis.includes("...")) {
      const allSubjects = command.synopsis.split(" ").slice(2).filter((word) => /^\[?<[^>]+>\]?$/.test(word)).length;
      refused(await call(command.script, [command.name, ...Array.from({ length: allSubjects + 1 }, () => "x"), ...command.needed.flatMap(([name, form]) => [name, SAMPLE[form] ?? "x"])]), "invalid-input", `${what} with a surplus argument`);
    }
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
      if (folder) assert.ok((await refusedAt("README.md")).startsWith(`${option}: README.md is a file, but ${option} needs a folder. Give the path of a folder, or a new path for the folder.`), what);
      else assert.ok((await refusedAt("afolder")).startsWith(`${option}: afolder is a folder. Give the path of a file.`), what);
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

const SKILLS = readdirSync(join(ROOT, "skills")).sort();
const SCRIPTED = [...new Set(SCRIPTS.map((script) => script.skill))];

function skillText(skill: string): string {
  return readFileSync(join(ROOT, "skills", skill, "SKILL.md"), "utf8");
}

/** The text of a "## <title>" or "### <title>" section of a SKILL.md, up to the next heading of the same or a higher level. */
function section(skill: string, title: string, level: 2 | 3): string | undefined {
  const text = skillText(skill);
  const marks = "#".repeat(level);
  const start = text.indexOf(`\n${marks} ${title}\n`);
  if (start < 0) return undefined;
  const rest = text.slice(start + 1);
  const end = rest.slice(level + 1).search(new RegExp(`\\n#{1,${level}} `));
  // A --- rule between the groups of the standard is no part of the section.
  return (end < 0 ? rest : rest.slice(0, end + level + 1)).replace(/(\s|\n---\n)+$/, "\n");
}

/** The rows of the first Markdown table in `text`, without the header and the rule: each row as its cells. */
function tableRows(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.startsWith("|"));
  return lines.slice(2).map((line) => line.slice(1, line.endsWith("|") ? -1 : undefined).split(/(?<!\\)\|/).map((cell) => cell.trim()));
}

/** The command sections of a SKILL.md: ### `<command> ...`, with the ## group above each. */
function commandSections(skill: string): Array<{ command: string; group: string | undefined }> {
  const found: Array<{ command: string; group: string | undefined }> = [];
  let group: string | undefined;
  for (const line of skillText(skill).split("\n")) {
    if (line.startsWith("## ")) group = line.slice(3).trim();
    const match = /^### `([a-z][a-z0-9-]*)[ `]/.exec(line);
    if (match !== null) found.push({ command: match[1]!, group });
  }
  return found;
}

test("every skill with a script has the same Paths and the project folder and JSON output sections", () => {
  for (const [title, level] of [["Paths and the project folder", 3], ["JSON output", 2]] as const) {
    const texts = SCRIPTED.map((skill) => [skill, section(skill, title, level)] as const);
    for (const [skill, text] of texts) assert.ok(text !== undefined, `${skill} has no section ${title}`);
    for (const [skill, text] of texts) assert.equal(text, texts[0]![1], `${skill}: ${title} differs from ${texts[0]![0]}`);
  }
});

test("a SKILL.md gives the path of its script one time only, in the run line", () => {
  for (const script of SCRIPTS) {
    const count = skillText(script.skill).split(`<skill>/scripts/${script.name}`).length - 1;
    assert.equal(count, 1, `${script.skill}: <skill>/scripts/${script.name} occurs ${count} times`);
  }
});

test("a SKILL.md has one section for each command, and the command table names only commands and flags that the script has", async () => {
  const found = await commands();
  for (const skill of SCRIPTED) {
    const own = found.filter((command) => command.script.skill === skill);
    const sections = commandSections(skill).map((item) => item.command);
    for (const command of own) assert.equal(sections.filter((name) => name === command.name).length, 1, `${skill}: one section ### \`${command.name} ...\``);
    for (const name of sections) assert.ok(own.some((command) => command.name === name), `${skill}: a section for ${name}, which is no command`);
    const table = section(skill, "Select the command", 2);
    assert.ok(table !== undefined, `${skill} has no section Select the command`);
    const rows = tableRows(table);
    assert.ok(rows.length > 0, `${skill}: Select the command has no rows`);
    for (const [, cell] of rows) {
      for (const code of (cell ?? "").matchAll(/`([^`]+)`/g)) {
        const [name, ...words] = code[1]!.split(/\s+/);
        const command = own.find((item) => item.name === name);
        assert.ok(command !== undefined, `${skill}: ${code[1]} names no command`);
        for (const word of words.filter((item) => /^--[a-z]/.test(item))) {
          const option = word.split("=")[0]!;
          if (option === "--project" || option === "--help") continue;
          assert.ok(command.options.some(([known]) => known === option), `${skill}: ${name} has no ${option}`);
        }
      }
    }
  }
});

test("the Flags table of a SKILL.md gives each flag of each command, and only flags that the command has", async () => {
  const found = await commands();
  for (const skill of SCRIPTED) {
    const own = found.filter((command) => command.script.skill === skill);
    const sections = commandSections(skill);
    const declared = new Set(own.flatMap((command) => command.options.map(([option]) => `${command.name} ${option}`)));
    const flags = section(skill, "Flags", 2);
    if (declared.size === 0 && flags === undefined) continue;
    assert.ok(flags !== undefined, `${skill} has no section Flags`);
    assert.ok(flags.includes("Each flag applies only to the commands in the table. On another command, the script refuses the flag."), `${skill}: the Flags section starts with the two fixed sentences`);
    const given = new Set<string>();
    for (const [flagCell, commandCell] of tableRows(flags)) {
      const option = /`(--[a-z][a-z0-9-]*)/.exec(flagCell ?? "")?.[1];
      assert.ok(option !== undefined, `${skill}: a Flags row without a flag: ${flagCell}`);
      let names: string[];
      const group = /^All commands in "([^"]+)"$/.exec(commandCell ?? "")?.[1];
      if (commandCell === "All commands") names = own.map((command) => command.name);
      else if (group !== undefined) {
        names = sections.filter((item) => item.group === group).map((item) => item.command);
        assert.ok(names.length > 0, `${skill}: no command sections under ## ${group}`);
      } else names = [...(commandCell ?? "").matchAll(/`([a-z][a-z0-9-]*)`/g)].map((match) => match[1]!);
      assert.ok(names.length > 0, `${skill} ${option}: the Command cell names no command`);
      for (const name of names) {
        assert.ok(declared.has(`${name} ${option}`), `${skill}: ${name} has no ${option}`);
        given.add(`${name} ${option}`);
      }
    }
    for (const pair of declared) assert.ok(given.has(pair), `${skill}: the Flags table has no row for ${pair}`);
  }
});

test("no skill names another skill or the script of another skill", () => {
  const scripts = new Map(SCRIPTS.map((script) => [script.name, script.skill]));
  const problems: string[] = [];
  for (const skill of SKILLS) {
    const directory = join(ROOT, "skills", skill);
    const files = ["SKILL.md", ...readdirSync(directory, { recursive: true, encoding: "utf8" }).filter((file) => file.startsWith("references/") && file.endsWith(".md"))];
    const sources = readdirSync(directory, { recursive: true, encoding: "utf8" }).filter((file) => file.startsWith("scripts/") && file.endsWith(".ts"));
    for (const file of [...files, ...sources]) {
      readFileSync(join(directory, file), "utf8")
        .split("\n")
        .forEach((line, index) => {
          // Code comments may name a skill: only the text that the agent reads counts.
          if (file.endsWith(".ts") && /^\s*(\/\/|\*|\/\*|import )/.test(line)) return;
          for (const other of SKILLS) if (other !== skill && other.startsWith("c64-") && new RegExp(`\\b${other}\\b(?![-/])`).test(line)) problems.push(`${skill}/${file}:${index + 1} names ${other}`);
          for (const [name, owner] of scripts) if (owner !== skill && new RegExp(`(?<![\\w/-])${name.replace(".", "\\.")}\\b`).test(line)) problems.push(`${skill}/${file}:${index + 1} names ${name}`);
        });
    }
  }
  assert.deepEqual(problems, []);
});
