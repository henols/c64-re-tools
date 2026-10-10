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
import { DatabaseSync } from "node:sqlite";
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

function knowledgeSummary(project: string): Record<string, unknown> {
  const file = join(project, ".c64-re-tools", "knowledge.db");
  if (!existsSync(file)) return { present: false };
  try {
    const db = new DatabaseSync(file, { readOnly: true });
    const rows = (sql: string) => db.prepare(sql).all();
    const summary = {
      present: true,
      revisions: rows("SELECT origin, operation, COUNT(*) AS count FROM revisions GROUP BY origin, operation"),
      symbols: rows("SELECT origin, kind, COUNT(*) AS count FROM current_symbols GROUP BY origin, kind"),
      regions: rows("SELECT origin, type, COUNT(*) AS count FROM current_regions GROUP BY origin, type"),
      comments: rows("SELECT origin, COUNT(*) AS count FROM current_comments GROUP BY origin"),
      references: rows('SELECT origin, kind, COUNT(*) AS count FROM "current_references" GROUP BY origin, kind'),
    };
    db.close();
    return summary;
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
