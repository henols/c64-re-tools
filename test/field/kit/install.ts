// Sets the current directory up as a field-test project: c64-re-tools
// installed through npx, as a user installs it, the c64-field-debug skill
// and the session prompts copied in, and the trace switched on for every
// program that Claude Code starts here. Run it in the project:
//
//   node <kit>/install.ts [--package <next|version|spec|tarball>] [--trace <dir>]
//
// The kit comes from a git clone of the release tag, never from the npm
// package: the debug skill is not part of c64-re-tools.

import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { type FieldRun, inContainer, isoCet, PACKAGE_NAME, run, RUN_FILE } from "./common.ts";

const kit = import.meta.dirname;
const USAGE = "usage: node <kit>/install.ts [--package <next|version|spec|tarball>] [--trace <dir>]";

/** The npx package spec: a tarball as an absolute path, a full spec as it is, a tag or a version for this package. */
function specOf(value: string): string {
  if (value.endsWith(".tgz")) return resolve(value);
  if (value.startsWith(`${PACKAGE_NAME}@`)) return value;
  return `${PACKAGE_NAME}@${value}`;
}

/** The version a spec names, from the tarball or the registry; undefined when neither answers. */
function versionOf(spec: string): string | undefined {
  if (spec.endsWith(".tgz")) {
    const listed = run("tar", ["-xzOf", spec, "package/package.json"]);
    try {
      return (JSON.parse(listed.stdout) as { version?: string }).version;
    } catch {
      return undefined;
    }
  }
  const viewed = run("npm", ["view", spec, "version"], { timeoutMs: 60_000 });
  const lines = viewed.stdout.trim().split("\n").filter((line) => line !== "");
  return viewed.status === 0 ? lines.at(-1)?.replace(/^.*'([^']+)'$/, "$1") : undefined;
}

function readJson<T>(file: string, empty: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : empty;
}

function writeJson(file: string, value: unknown): void {
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function main(): void {
  let values: { package?: string; trace?: string; help?: boolean };
  try {
    ({ values } = parseArgs({ options: { package: { type: "string" }, trace: { type: "string" }, help: { type: "boolean" } } }));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n${USAGE}`);
    process.exit(2);
  }
  if (values.help === true) {
    console.log(USAGE);
    return;
  }
  const project = process.cwd();
  const spec = specOf(values.package ?? "next");
  const traceDir = resolve(values.trace ?? join(project, "field-test", "trace"));
  const container = inContainer();

  console.log(`Installing ${spec} into ${project} ...`);
  const install = run("npx", ["-y", `--package=${spec}`, "c64-re-tools", "install", "--target", "claude"], { cwd: project, inherit: true });
  if (install.status !== 0) {
    console.error(`npx ${spec} install failed with status ${install.status}.`);
    process.exit(1);
  }

  // The MCP server from the same spec: install declares the channel of its version, and a tarball has none.
  const mcpFile = join(project, ".mcp.json");
  const mcp = readJson<{ mcpServers?: Record<string, { args?: string[] }> }>(mcpFile, {});
  const server = mcp.mcpServers?.["c64-re-tools"];
  if (server?.args === undefined) {
    console.error(`${mcpFile} declares no c64-re-tools server.`);
    process.exit(1);
  }
  server.args = server.args.map((arg) => (arg.startsWith("--package=") ? `--package=${spec}` : arg));
  writeJson(mcpFile, mcp);

  // Claude Code gives the env of its settings to every Bash command and every MCP server it starts.
  const settingsFile = join(project, ".claude", "settings.local.json");
  const settings = readJson<{ env?: Record<string, string> }>(settingsFile, {});
  settings.env = { ...settings.env, C64RT_TRACE: traceDir };
  for (const name of ["C64RT_HOST", "C64RT_HOST_TOKEN"]) {
    const value = process.env[name];
    if (value !== undefined && value !== "") settings.env[name] = value;
  }
  mkdirSync(join(project, ".claude"), { recursive: true });
  writeJson(settingsFile, settings);

  // The debug skill and the prompts. A prompt that is already there stays: the tester may have edited it.
  cpSync(join(kit, "c64-field-debug"), join(project, ".claude", "skills", "c64-field-debug"), { recursive: true });
  const fieldDir = join(project, "field-test");
  mkdirSync(join(fieldDir, "target"), { recursive: true });
  mkdirSync(traceDir, { recursive: true });
  for (const name of readdirSync(join(kit, "prompts"))) {
    if (!existsSync(join(fieldDir, name))) cpSync(join(kit, "prompts", name), join(fieldDir, name));
  }

  const commit = run("git", ["-C", kit, "rev-parse", "HEAD"]);
  const version = versionOf(spec);
  const record: FieldRun = {
    project,
    spec,
    ...(version === undefined ? {} : { version }),
    traceDir,
    ...(commit.status === 0 ? { kitCommit: commit.stdout.trim() } : {}),
    inContainer: container,
    platform: process.platform,
    node: process.version,
    createdAt: isoCet(),
  };
  writeJson(join(project, RUN_FILE), record);

  // On one machine the host can write into the project's trace; in a container it writes on the host.
  const hostTrace = container ? join("$HOME", "c64-field", "host-trace") : traceDir;
  const tokenSet = settings.env.C64RT_HOST_TOKEN !== undefined;
  const hostCommand = container
    ? `C64RT_TRACE=${hostTrace} C64RT_HOST_TOKEN=<the same secret> npx -y --package=${spec} c64-re-tools-host --listen <the container bridge, for example 172.17.0.1>`
    : `C64RT_TRACE=${hostTrace} npx -y --package=${spec} c64-re-tools-host`;
  console.log(`
Installed c64-re-tools ${version ?? "(version unknown)"} with the c64-field-debug skill.
Trace for Claude Code's programs: ${traceDir} (in .claude/settings.local.json)

1. On the machine with VICE, in its own terminal, start the host runtime:
   ${hostCommand}${container && !tokenSet ? `

   No C64RT_HOST_TOKEN was set here. Set the same secret (16 characters or more)
   in .claude/settings.local.json under "env", or export it and run install again.` : ""}${spec.endsWith(".tgz") && container ? `

   The host needs the same tarball: copy ${spec} to the host first.` : ""}

2. Put a .prg or .d64 into field-test/target/ and write its name into field-test/03-re-workflow.md.

3. Start Claude Code here, and paste the prompts in this order:
   field-test/01-comprehension.md, 02-dev-workflow.md, 03-re-workflow.md, 99-debrief.md
   Start a chat message with "note:" to record what you see.

4. Quit Claude Code, then bundle the run:
   node ${join(kit, "bundle.ts")}

5. In the c64-re-tools checkout, make the report:
   node test/field/report.ts <the bundle>${container ? ` --host-trace ${hostTrace}` : ""}
`);
}

main();
