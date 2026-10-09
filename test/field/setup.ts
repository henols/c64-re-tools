// Sets a fresh project up for a field test: the toolkit installed from the
// packed tarball of this checkout through npx, as a user installs it, with
// .mcp.json pointed at the tarball while the release is not on npm. The run
// directory next to the project holds the tarball, the trace and run.json.
//
//   node test/field/setup.ts <project-dir> [--run-dir <dir>]

import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { isoCet } from "../../src/time.ts";

const root = resolve(import.meta.dirname, "../..");
const windows = process.platform === "win32";

function sh(command: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): string {
  const run = spawnSync(command, args, { cwd, encoding: "utf8", env, shell: windows && command !== process.execPath, stdio: ["ignore", "pipe", "inherit"] });
  if (run.status !== 0) {
    console.error(`${command} ${args.join(" ")} failed with status ${run.status}`);
    process.exit(1);
  }
  return run.stdout;
}

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { "run-dir": { type: "string" } } });
  const target = positionals[0];
  if (target === undefined) {
    console.error("usage: node test/field/setup.ts <project-dir> [--run-dir <dir>]");
    process.exit(2);
  }
  const project = resolve(target);
  const runDir = resolve(values["run-dir"] ?? join(dirname(project), `${basename(project)}-field`));
  const traceDir = join(runDir, "trace");
  if (existsSync(project) && readdirSync(project).length > 0) {
    console.error(`${project} exists and is not empty. Give a new or an empty directory.`);
    process.exit(1);
  }
  mkdirSync(project, { recursive: true });
  mkdirSync(traceDir, { recursive: true });
  // npm and npx with a cache of their own, so a new tarball never meets a stale one.
  const env = { ...process.env, npm_config_cache: join(runDir, "npm-cache"), npm_config_audit: "false", npm_config_fund: "false", npm_config_update_notifier: "false" };

  console.log("Packing this checkout ...");
  sh("npm", ["pack", "--pack-destination", runDir], root, env);
  const tarball = join(runDir, readdirSync(runDir).filter((name) => name.endsWith(".tgz")).sort().at(-1)!);
  const sha256 = createHash("sha256").update(readFileSync(tarball)).digest("hex");

  console.log("Installing into the project through npx ...");
  sh("git", ["init", "-q"], project, env);
  sh("npx", ["-y", `--package=${tarball}`, "c64-re-tools", "install", "--target", "claude"], project, env);

  // As declared, with the tarball in place of @latest, and the trace for the MCP server.
  const mcpFile = join(project, ".mcp.json");
  const mcp = JSON.parse(readFileSync(mcpFile, "utf8")) as { mcpServers: Record<string, { command: string; args: string[]; env?: Record<string, string> }> };
  const server = mcp.mcpServers["c64-re-tools"];
  if (server === undefined) {
    console.error(`${mcpFile} declares no c64-re-tools server.`);
    process.exit(1);
  }
  server.args = server.args.map((arg) => (arg.startsWith("--package=") ? `--package=${tarball}` : arg));
  server.env = { ...server.env, C64RT_TRACE: traceDir };
  writeFileSync(mcpFile, `${JSON.stringify(mcp, null, 2)}\n`);

  const commit = sh("git", ["rev-parse", "HEAD"], root, env).trim();
  const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string };
  mkdirSync(join(project, "field-test"), { recursive: true });
  const run = { project, runDir, traceDir, tarball, sha256, commit, version, node: process.version, createdAt: isoCet(new Date()) };
  writeFileSync(join(project, "field-test", "run.json"), `${JSON.stringify(run, null, 2)}\n`);
  writeFileSync(join(runDir, "run.json"), `${JSON.stringify(run, null, 2)}\n`);

  console.log(`
Project:   ${project}
Run dir:   ${runDir}
Trace:     ${traceDir}
Tarball:   ${tarball} (${version}, commit ${commit.slice(0, 8)})

Next:
  cp -r ${join(root, "test/field/c64-field-debug")} ${join(project, ".claude/skills/")}
  cp ${join(root, "test/field/prompts")}/*.md ${join(project, "field-test/")}

  C64RT_TRACE=${traceDir} npx -y --package=${tarball} c64-re-tools-host

  cd ${project} && C64RT_TRACE=${traceDir} claude
  (paste field-test/01-comprehension.md first, then 02, 03 and 99)

When done:
  node ${join(root, "test/field/collect.ts")} ${project}
`);
}

main();
