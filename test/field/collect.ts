// Collects a field test into one report: the trace, the notes of the agent
// and the tester, the Claude transcripts, a summary of project knowledge, and
// summary.md with the failures, the slow operations, the VICE events, the
// notes with the trace around each one, and the agent's comprehension next to
// each description.
//
//   node test/field/collect.ts <project-dir> [--out <dir>]

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { parseArgs } from "node:util";

import { debugTools } from "../../src/mcp/tools/debug.ts";
import { executionTools } from "../../src/mcp/tools/execution.ts";
import { inputTools } from "../../src/mcp/tools/input.ts";
import { machineTools } from "../../src/mcp/tools/machine.ts";
import { mediaTools } from "../../src/mcp/tools/media.ts";
import { memoryTools } from "../../src/mcp/tools/memory.ts";
import { videoTools } from "../../src/mcp/tools/video.ts";
import { fileStampCet, isoCet } from "../../src/time.ts";

const root = resolve(import.meta.dirname, "../..");

type Event = Record<string, unknown> & { t: string; kind: string; event: string; file: string };
type Note = Record<string, unknown> & { t: string; by: string; kind: string; component: string; severity: string; text: string };

interface Run {
  project: string;
  runDir: string;
  traceDir: string;
  tarball?: string;
  sha256?: string;
  commit?: string;
  version?: string;
  createdAt?: string;
}

function jsonLines<T>(file: string): T[] {
  const out: T[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // A line cut by a crash is left out.
    }
  }
  return out;
}

function readTrace(dir: string): Event[] {
  if (!existsSync(dir)) return [];
  const events: Event[] = [];
  for (const name of readdirSync(dir).filter((entry) => entry.endsWith(".jsonl")).sort()) {
    for (const event of jsonLines<Event>(join(dir, name))) events.push({ ...event, file: name });
  }
  return events.sort((a, b) => a.t.localeCompare(b.t));
}

/** True for an event that records a failure. */
function failed(event: Event): boolean {
  if (event.ok === false) return true;
  if (event.event.endsWith("-failed")) return true;
  if (event.event === "script.end" && event.error !== undefined) return true;
  if (event.event === "tool.run") return event.code !== 0 || event.timedOut === true || event.spawnError !== undefined;
  return false;
}

/** What an event is about, in a few words. */
function subject(event: Event): string {
  if (typeof event.op === "string") return event.op;
  if (typeof event.name === "string") return event.name;
  if (Array.isArray(event.argv) && typeof event.argv[0] === "string") return basename(event.argv[0]);
  if (typeof event.line === "string") return event.line.split("\n")[0]!.slice(0, 120);
  return "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value);
}

/** The Claude Code transcript directory of a project: its path with every character that is not a letter or a digit as "-". */
function transcriptDir(project: string): string {
  return join(homedir(), ".claude", "projects", project.replace(/[^A-Za-z0-9]/g, "-"));
}

function knowledgeSummary(project: string): Record<string, unknown> {
  const file = join(project, ".c64-re-tools", "knowledge.db");
  if (!existsSync(file)) return { present: false };
  try {
    const db = new DatabaseSync(file, { readOnly: true });
    const count = (sql: string) => db.prepare(sql).all() as Array<Record<string, unknown>>;
    const summary = {
      present: true,
      revisions: count("SELECT origin, COUNT(*) AS count FROM revisions GROUP BY origin"),
      symbols: count("SELECT origin, kind, COUNT(*) AS count FROM current_symbols GROUP BY origin, kind"),
      regions: count("SELECT origin, type, COUNT(*) AS count FROM current_regions GROUP BY origin, type"),
      comments: count("SELECT origin, COUNT(*) AS count FROM current_comments GROUP BY origin"),
      references: count('SELECT origin, kind, COUNT(*) AS count FROM "current_references" GROUP BY origin, kind'),
    };
    db.close();
    return summary;
  } catch (error) {
    return { present: true, error: error instanceof Error ? error.message : String(error) };
  }
}

function skillDescriptions(project: string): Map<string, string> {
  const out = new Map<string, string>();
  const dir = join(project, ".claude", "skills");
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const file = join(dir, name, "SKILL.md");
    if (!existsSync(file)) continue;
    const match = /^description:\s*(.+)$/m.exec(readFileSync(file, "utf8"));
    if (match !== null) out.set(name, match[1]!.trim());
  }
  return out;
}

function toolDescriptions(): Map<string, string> {
  const tools = [...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools];
  return new Map(tools.map((tool) => [tool.name, tool.description]));
}

function status(project: string): string {
  const run = spawnSync(process.execPath, [...process.execArgv, join(root, "src/cli/main.ts"), "status"], { cwd: project, encoding: "utf8", timeout: 90_000 });
  return `${run.stdout ?? ""}${run.stderr ?? ""}`.trim() || `status gave nothing (${run.error?.message ?? `exit ${run.status}`})`;
}

function summary(run: Run, events: Event[], notes: Note[], knowledge: Record<string, unknown>, project: string, statusText: string): string {
  const lines: string[] = [];
  const h = (level: number, title: string) => lines.push("", `${"#".repeat(level)} ${title}`, "");
  const near = (t: string, seconds: number) => {
    const at = Date.parse(t);
    return events.filter((event) => Math.abs(Date.parse(event.t) - at) <= seconds * 1000);
  };
  const show = (event: Event) => {
    const extra = failed(event) ? ` — ${text(event.code)} ${text(event.message ?? event.error)}`.trimEnd() : "";
    const ms = typeof event.ms === "number" ? ` (${event.ms} ms)` : "";
    return `${event.t.slice(11, 23)} ${event.kind} ${event.event} ${subject(event)}${ms}${extra}`;
  };

  lines.push(`# Field report ${run.createdAt ?? ""}`.trimEnd(), "");
  lines.push(`- Project: \`${run.project}\``);
  lines.push(`- Package: ${run.version ?? "?"} at commit ${run.commit ?? "?"}, tarball sha256 ${run.sha256?.slice(0, 16) ?? "?"}…`);
  lines.push(`- Set up: ${run.createdAt ?? "?"}. Collected: ${isoCet(new Date())}.`);
  lines.push(`- Trace: ${events.length} events in ${new Set(events.map((event) => event.file)).size} files. Notes: ${notes.length}.`);

  h(2, "Status at collection");
  lines.push("```", statusText, "```");

  h(2, "Programs and events");
  lines.push("| Kind | Files | Events | Failures | First | Last |", "|---|---|---|---|---|---|");
  for (const kind of [...new Set(events.map((event) => event.kind))]) {
    const own = events.filter((event) => event.kind === kind);
    lines.push(`| ${kind} | ${new Set(own.map((event) => event.file)).size} | ${own.length} | ${own.filter(failed).length} | ${own[0]!.t} | ${own.at(-1)!.t} |`);
  }

  h(2, "Failures");
  const failures = events.filter(failed);
  if (failures.length === 0) lines.push("None.");
  const groups = new Map<string, Event[]>();
  for (const event of failures) {
    const key = `${event.kind} ${event.event} ${subject(event)} ${text(event.code)}`.trim();
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  for (const [key, own] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`- **${key}** × ${own.length}`);
    for (const event of own.slice(0, 3)) lines.push(`  - ${event.t.slice(11, 23)}: ${text(event.message ?? event.error ?? event.stderr).slice(0, 300)}`);
  }

  h(2, "Slowest operations");
  const timed = events.filter((event) => typeof event.ms === "number" && ["request", "tool.call", "tool.run", "script.end", "connection.ready", "vice.ready", "host.ready", "session.opened"].includes(event.event));
  for (const event of [...timed].sort((a, b) => (b.ms as number) - (a.ms as number)).slice(0, 15)) lines.push(`- ${show(event)}`);

  h(2, "VICE");
  const count = (name: string) => events.filter((event) => event.event === name).length;
  lines.push(`- Launches: ${count("vice.launch")}, ready: ${count("vice.ready")}, failed: ${count("vice.launch-failed")}, exits: ${count("vice.exit")}, drive stops: ${count("vice.drive-stop")}.`);
  for (const event of events.filter((event) => event.event === "vice.exit")) lines.push(`- ${event.t.slice(11, 23)} exit pid ${text(event.pid)}: code ${text(event.code)}, signal ${text(event.signal)} after ${text(event.ms)} ms`);
  const vicePattern = /timeout|takes no commands|did not come back|exited unexpectedly|monitor connection lost|not stopped after|headless again/i;
  for (const event of events.filter((event) => event.event === "log" && vicePattern.test(text(event.line))).slice(0, 30)) lines.push(`- ${show(event)}`);

  h(2, "Notes");
  const byComponent = new Map<string, Note[]>();
  for (const note of notes.filter((note) => note.kind !== "comprehension")) byComponent.set(note.component, [...(byComponent.get(note.component) ?? []), note]);
  if (byComponent.size === 0) lines.push("None.");
  for (const [component, own] of [...byComponent].sort((a, b) => a[0].localeCompare(b[0]))) {
    h(3, component);
    const ordered = [...own].sort((a, b) => (a.by === b.by ? a.t.localeCompare(b.t) : a.by === "user" ? -1 : 1));
    for (const note of ordered) {
      lines.push(`- **${note.t.slice(0, 19)} ${note.kind}** (${note.severity}, by ${note.by}): ${note.text}`);
      for (const field of ["intent", "choice", "expected", "actual"] as const) if (note[field] !== undefined) lines.push(`  - ${field}: ${text(note[field])}`);
      const around = near(note.t, 60).filter((event) => event.event !== "trace.start");
      const picked = [...around.filter(failed), ...around.filter((event) => !failed(event))].slice(0, 12).sort((a, b) => a.t.localeCompare(b.t));
      if (picked.length > 0) {
        lines.push("  - trace within a minute:");
        for (const event of picked) lines.push(`    - ${show(event)}`);
      }
    }
  }

  h(2, "Comprehension");
  const skills = skillDescriptions(project);
  const tools = toolDescriptions();
  const comprehension = notes.filter((note) => note.kind === "comprehension");
  if (comprehension.length === 0) lines.push("None.");
  for (const note of comprehension) {
    h(3, note.component);
    const described = skills.get(note.component) ?? tools.get(note.component);
    if (described !== undefined) lines.push(`- Description: ${described}`);
    lines.push(`- The agent: ${note.text}`);
  }

  h(2, "Knowledge");
  lines.push("```json", JSON.stringify(knowledge, null, 2), "```");
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { out: { type: "string" } } });
  const target = positionals[0];
  if (target === undefined) {
    console.error("usage: node test/field/collect.ts <project-dir> [--out <dir>]");
    process.exit(2);
  }
  const project = resolve(target);
  const runFile = join(project, "field-test", "run.json");
  const run: Run = existsSync(runFile)
    ? (JSON.parse(readFileSync(runFile, "utf8")) as Run)
    : { project, runDir: `${project}-field`, traceDir: join(`${project}-field`, "trace") };

  const out = resolve(values.out ?? join(root, "field-reports"));
  const report = join(out, `field-report-${fileStampCet(new Date())}`);
  mkdirSync(report, { recursive: true });

  if (existsSync(run.traceDir)) cpSync(run.traceDir, join(report, "trace"), { recursive: true });
  const notesFile = join(project, "field-test", "notes.jsonl");
  if (existsSync(notesFile)) cpSync(notesFile, join(report, "notes.jsonl"));
  const transcripts = transcriptDir(project);
  if (existsSync(transcripts)) {
    mkdirSync(join(report, "transcripts"));
    for (const name of readdirSync(transcripts).filter((entry) => entry.endsWith(".jsonl"))) cpSync(join(transcripts, name), join(report, "transcripts", name));
  }

  const events = readTrace(run.traceDir);
  const notes = existsSync(notesFile) ? jsonLines<Note>(notesFile) : [];
  const knowledge = knowledgeSummary(project);
  const statusText = status(project);
  writeFileSync(join(report, "manifest.json"), `${JSON.stringify({ ...run, collectedAt: isoCet(new Date()), node: process.version, status: statusText, transcripts: existsSync(transcripts) ? transcripts : null }, null, 2)}\n`);
  writeFileSync(join(report, "knowledge-summary.json"), `${JSON.stringify(knowledge, null, 2)}\n`);
  writeFileSync(join(report, "summary.md"), summary(run, events, notes, knowledge, project, statusText));

  const tar = spawnSync("tar", ["-czf", `${report}.tgz`, "-C", out, basename(report)], { encoding: "utf8" });
  console.log(`Report: ${report}`);
  console.log(tar.status === 0 ? `Archive: ${report}.tgz` : `No archive: tar ${tar.error?.message ?? `exited ${tar.status}`}`);
  console.log(`Events: ${events.length}, failures: ${events.filter(failed).length}, notes: ${notes.length}.`);
}

main();
