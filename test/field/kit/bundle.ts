// Packs a field-test run into one archive for report.ts in the c64-re-tools
// checkout: the run record, the notes, the trace of Claude Code's programs,
// the Claude Code transcripts of this project, a summary of project
// knowledge, the skill descriptions, the status and the configuration with
// its secrets removed. Run it in the project after you quit Claude Code:
//
//   node <kit>/bundle.ts [--out <dir>]

import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { type FieldRun, fileStampCet, inContainer, isoCet, PACKAGE_NAME, run, RUN_FILE } from "./common.ts";

const SECRET = /token|secret|password|key/i;

/** A copy of a JSON value with the value of every key that looks like a secret replaced. */
function redact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redact);
  if (typeof value !== "object" || value === null) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET.test(key) && typeof item === "string" ? "<removed>" : redact(item)]));
}

/** The Claude Code transcript directory of a project: its path with every character that is not a letter or a digit as "-", cut at 200 characters plus a hash. */
function transcriptDir(project: string): string | undefined {
  const projects = join(process.env.CLAUDE_CONFIG_DIR ?? join(homedir(), ".claude"), "projects");
  const name = project.replace(/[^A-Za-z0-9]/g, "-");
  if (existsSync(join(projects, name))) return join(projects, name);
  if (name.length <= 200 || !existsSync(projects)) return undefined;
  const long = readdirSync(projects).find((entry) => entry.startsWith(name.slice(0, 200)));
  return long === undefined ? undefined : join(projects, long);
}

/** Counts of the knowledge text of a project: the revisions, and the current rows of each table. */
function knowledgeSummary(project: string): Record<string, unknown> {
  const folder = join(project, ".c64-re-tools", "knowledge");
  if (!existsSync(folder)) return { present: false };
  try {
    const lines = (file: string): Array<Record<string, unknown>> => {
      const path = join(folder, file);
      if (!existsSync(path)) return [];
      return readFileSync(path, "utf8").split("\n").filter((line) => line.trim() !== "").map((line) => JSON.parse(line) as Record<string, unknown>);
    };
    const count = (rows: Array<Record<string, unknown>>, keys: string[]) => {
      const groups = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        const key = keys.map((name) => String(row[name])).join("|");
        const group = groups.get(key) ?? { ...Object.fromEntries(keys.map((name) => [name, row[name]])), count: 0 };
        group.count = (group.count as number) + 1;
        groups.set(key, group);
      }
      return [...groups.values()];
    };
    const current = (file: string) => lines(file).filter((row) => row.closed === null);
    return {
      present: true,
      revisions: count(lines("revisions.jsonl"), ["origin", "operation"]),
      symbols: count(current("symbols.jsonl"), ["origin", "kind"]),
      regions: count(current("regions.jsonl"), ["origin", "type"]),
      comments: count(current("comments.jsonl"), ["origin"]),
      references: count(current("references.jsonl"), ["origin", "kind"]),
    };
  } catch (error) {
    return { present: true, error: error instanceof Error ? error.message : String(error) };
  }
}

/** Each installed skill's description, from its SKILL.md. */
function skillDescriptions(project: string): Record<string, string> {
  const dir = join(project, ".claude", "skills");
  const out: Record<string, string> = {};
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir).sort()) {
    const file = join(dir, name, "SKILL.md");
    if (!existsSync(file)) continue;
    const match = /^description:\s*(.+)$/m.exec(readFileSync(file, "utf8"));
    if (match !== null) out[name] = match[1]!.trim().replace(/^(["'])(.*)\1$/, "$2");
  }
  return out;
}

function main(): void {
  const { values } = parseArgs({ options: { out: { type: "string" } } });
  const project = process.cwd();
  const runFile = join(project, RUN_FILE);
  if (!existsSync(runFile)) {
    console.error(`${RUN_FILE} is missing. Run bundle.ts in the project where you ran install.ts.`);
    process.exit(1);
  }
  const record = JSON.parse(readFileSync(runFile, "utf8")) as FieldRun;
  const name = `bundle-${fileStampCet()}`;
  const staging = mkdtempSync(join(tmpdir(), "c64-field-bundle-"));
  const root = join(staging, name);
  try {
    mkdirSync(root);
    cpSync(runFile, join(root, "run.json"));
    const notes = join(project, "field-test", "notes.jsonl");
    if (existsSync(notes)) cpSync(notes, join(root, "notes.jsonl"));
    if (existsSync(record.traceDir)) cpSync(record.traceDir, join(root, "trace"), { recursive: true });
    const transcripts = transcriptDir(project);
    if (transcripts !== undefined) cpSync(transcripts, join(root, "transcripts"), { recursive: true });

    writeFileSync(join(root, "knowledge-summary.json"), `${JSON.stringify(knowledgeSummary(project), null, 2)}\n`);
    writeFileSync(join(root, "skills.json"), `${JSON.stringify(skillDescriptions(project), null, 2)}\n`);
    for (const file of [".mcp.json", join(".claude", "settings.local.json"), join(".claude", "settings.json")]) {
      const path = join(project, file);
      if (!existsSync(path)) continue;
      const target = join(root, "config", file.replace(/[\\/]/g, "_"));
      mkdirSync(join(root, "config"), { recursive: true });
      writeFileSync(target, `${JSON.stringify(redact(JSON.parse(readFileSync(path, "utf8"))), null, 2)}\n`);
    }
    // Status as Claude Code's programs see the host: with the env of the settings (the token in a container), without the trace.
    const settings = join(project, ".claude", "settings.local.json");
    const { C64RT_TRACE: _trace, ...settingsEnv } = existsSync(settings) ? ((JSON.parse(readFileSync(settings, "utf8")) as { env?: Record<string, string> }).env ?? {}) : {};
    const status = run("npx", ["-y", `--package=${record.spec}`, "c64-re-tools", "status"], { cwd: project, timeoutMs: 180_000, env: { ...process.env, ...settingsEnv } });
    writeFileSync(join(root, "status.txt"), `${status.stdout}${status.stderr}`);
    writeFileSync(
      join(root, "bundle.json"),
      `${JSON.stringify({ createdAt: isoCet(), project, package: PACKAGE_NAME, transcripts: transcripts ?? null, inContainer: inContainer(), platform: process.platform, node: process.version }, null, 2)}\n`,
    );

    const outDir = resolve(values.out ?? join(project, "field-test"));
    mkdirSync(outDir, { recursive: true });
    const archive = join(outDir, `${name}.tgz`);
    const tar = run("tar", ["-czf", archive, "-C", staging, name]);
    if (tar.status !== 0) {
      console.error(`tar failed: ${tar.stderr}`);
      process.exit(1);
    }
    console.log(`Bundle: ${archive}`);
    console.log(`Transcripts: ${transcripts ?? "none found"}`);
    console.log(`\nIn the c64-re-tools checkout:\n  node test/field/report.ts ${archive}${record.inContainer ? " --host-trace <the host trace directory>" : ""}`);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

main();
