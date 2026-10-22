// The call contract of every skill script, from the outside: no arguments
// give the help envelope with the synopsis of each command, and a wrong call
// gives one ok:false envelope with exit status 2, with nothing on stderr.
// src/script.test.ts tests each rule of the command line. No code that a
// script reaches throws a bare Error. The skill docs follow the skill
// standard: one run line, a command table and a Flags table that agree with
// the scripts, one section for each command, shared blocks word for word, and
// no name of another skill.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

let project: string;
before(() => {
  project = mkdtempSync(join(tmpdir(), "c64-re-tools-contract-"));
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

interface Command {
  script: Script;
  name: string;
  synopsis: string;
  /** The options and their value forms, for example ["--out", "<path>"]; a flag has no value form. */
  options: Array<[string, string | undefined]>;
}

let commandsCache: Promise<Command[]> | undefined;

/** Every command of every script, from the command list that a script gives without arguments. */
function commands(): Promise<Command[]> {
  commandsCache ??= Promise.all(
    SCRIPTS.map(async (script) => {
      const help = await call(script, []);
      assert.equal(help.status, 0, `${script.name} without arguments: ${help.stdout}${help.stderr}`);
      const envelope = JSON.parse(help.stdout) as { command: string; body: { commands: Array<{ name: string; synopsis: string }> } };
      assert.equal(envelope.command, "help", script.name);
      return envelope.body.commands.map(({ name, synopsis }): Command => {
        const options = [...synopsis.matchAll(/(--[a-z0-9-]+)(?: (<[^>\]]+>|NAME=VALUE))?/g)].map((match): [string, string | undefined] => [match[1]!, match[2]]);
        return { script, name, synopsis, options };
      });
    }),
  ).then((lists) => lists.flat());
  return commandsCache;
}

test("every script gives its command list without arguments, with the synopsis of each command", async () => {
  const found = await commands();
  assert.ok(found.length >= 70, `${found.length} commands`);
  for (const command of found) assert.ok(command.synopsis.startsWith(`${command.script.name} ${command.name}`), `${command.script.name} ${command.name}`);
});

test("a script is named after its skill", () => {
  for (const script of SCRIPTS) assert.equal(script.name, `${script.skill.replace(/^c64-/, "")}.ts`, script.path);
});

test("a wrong call is one ok:false envelope with exit status 2 and nothing on stderr", async () => {
  await Promise.all(
    SCRIPTS.map(async (script) => {
      const run = await call(script, ["no-such-command"]);
      assert.equal(run.status, 2, `${script.name}: ${run.stdout}${run.stderr}`);
      assert.equal(run.stderr, "", `${script.name}: stderr`);
      const lines = run.stdout.split("\n").filter((line) => line !== "");
      assert.equal(lines.length, 1, `${script.name}: one line`);
      const envelope = JSON.parse(lines[0]!) as { ok: boolean; code: string; nextAction?: string };
      assert.equal(envelope.ok, false, script.name);
      assert.equal(envelope.code, "invalid-input", script.name);
      if (envelope.nextAction !== undefined) assert.match(envelope.nextAction, /^node \/\S+\.ts /, `${script.name}: nextAction`);
    }),
  );
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
