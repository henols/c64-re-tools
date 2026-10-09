// The c64-re-tools CLI from src/: install and uninstall the skills and
// the MCP declaration in a project through AP SDK, and report status.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { mcpServerFor } from "../../distribution/package.ts";
import { encodeFrame, FrameDecoder } from "../../src/protocol.ts";

const cli = resolve(import.meta.dirname, "../../src/cli/main.ts");
const project = mkdtempSync(join(tmpdir(), "c64-re-tools-cli-"));
after(() => rmSync(project, { recursive: true, force: true }));

const run = (...args: string[]) => spawnSync(process.execPath, [cli, ...args], { cwd: project, encoding: "utf8", env: { ...process.env, C64RT_HOST: "127.0.0.1:1" } });

test("install puts the skills and the MCP declaration into the project; uninstall removes them", () => {
  const installed = run("install", "--target", "claude");
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  assert.ok(existsSync(join(project, ".claude", "skills", "c64-emulator", "SKILL.md")));
  const disk = join(project, ".claude", "skills", "c64-disk");
  for (const file of ["scripts/disk.ts", "src/host-client/tools.ts", "package.json"]) assert.ok(existsSync(join(disk, file)), file);
  // The installed TypeScript script runs from the project, outside this repository.
  const memmap = spawnSync(process.execPath, [join(project, ".claude", "skills", "c64-memory-map", "scripts", "memmap.ts"), "at", "$d020"], { cwd: project, encoding: "utf8" });
  assert.equal(memmap.status, 0, memmap.stderr);
  assert.match(memmap.stdout, /EXTCOL/);
  assert.deepEqual(JSON.parse(readFileSync(join(project, ".mcp.json"), "utf8")), { mcpServers: { "c64-re-tools": mcpServerFor(process.platform) } });

  assert.equal(run("update", "--target", "claude").status, 0, "an update installs again over the old files");

  const removed = run("uninstall", "--target", "claude");
  assert.equal(removed.status, 0, removed.stdout + removed.stderr);
  assert.equal(existsSync(join(project, ".claude", "skills", "c64-emulator")), false);
});

test("a project install for every harness leaves the home directory alone; uninstall leaves nothing behind (D21)", () => {
  const home = mkdtempSync(join(tmpdir(), "c64-re-tools-home-"));
  const fresh = mkdtempSync(join(tmpdir(), "c64-re-tools-cli-all-"));
  try {
    const inHome = (...args: string[]) =>
      spawnSync(process.execPath, [cli, ...args], { cwd: fresh, encoding: "utf8", env: { ...process.env, HOME: home, USERPROFILE: home, C64RT_HOST: "127.0.0.1:1" } });
    const windsurf = join(home, ".codeium", "windsurf", "mcp_config.json");

    const installed = inHome("install");
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    assert.match(installed.stdout, /install --global --target windsurf/);
    assert.doesNotMatch(installed.stdout, /windsurf\s+mcp/, "the report does not claim a Windsurf MCP declaration that the CLI took back");
    assert.equal(existsSync(join(home, ".codeium")), false, "a project install writes nothing into the home directory");
    const manifest = JSON.parse(readFileSync(join(fresh, ".ap-sdk", "install-manifest.json"), "utf8"));
    assert.equal(
      manifest.plugins["c64-re-tools"].items.some((item: { harness: string; kind: string }) => item.harness === "windsurf" && item.kind === "mcp"),
      false,
    );
    assert.ok(existsSync(join(fresh, ".windsurf", "skills", "c64-emulator", "SKILL.md")), "Windsurf still gets the skills");

    const removed = inHome("uninstall");
    assert.equal(removed.status, 0, removed.stdout + removed.stderr);
    assert.deepEqual(readdirSync(fresh), [], "no empty directory and no empty MCP configuration stays");

    // A declaration from a global install survives a project install and uninstall.
    assert.equal(inHome("install", "--global", "--target", "windsurf").status, 0);
    const global = readFileSync(windsurf, "utf8");
    assert.equal(inHome("install", "--target", "windsurf").status, 0);
    assert.equal(readFileSync(windsurf, "utf8"), global);
    assert.equal(inHome("uninstall", "--target", "windsurf").status, 0);
    assert.equal(readFileSync(windsurf, "utf8"), global);
    assert.deepEqual(readdirSync(fresh), []);
    assert.equal(inHome("uninstall", "--global", "--target", "windsurf").status, 0);
    assert.equal(existsSync(windsurf), false, "the global uninstall removes the configuration it emptied");
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(fresh, { recursive: true, force: true });
  }
});

test("status reports the version, the package, the tools here and a Host Runtime that does not answer", () => {
  const status = run("status");
  assert.equal(status.status, 0);
  assert.match(status.stdout, /^c64-re-tools \S+\nPackage: .+\nNode: v\d+/);
  // Found or missing, each tool that skill scripts run here has a line.
  assert.match(status.stdout, /Tools here:\n {2}ACME: .+\n {2}dxa: .+\n {2}Ghidra: .+\n/);
  assert.match(status.stdout, /Host Runtime: not reachable/);
});

test("status reports a Host Runtime that accepts the connection but drops the request as not reachable", async () => {
  // A host that answers the handshake, then closes each connection at the request.
  const server = createServer((socket) => {
    const decoder = new FrameDecoder();
    socket.on("data", (chunk) => {
      for (const message of decoder.push(chunk) as Array<{ type: string }>) {
        if (message.type === "hello") socket.write(encodeFrame({ type: "ready" }));
        else socket.destroy();
      }
    });
    socket.on("error", () => {});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const port = (server.address() as { port: number }).port;
    const child = spawn(process.execPath, [cli, "status"], { cwd: project, env: { ...process.env, C64RT_HOST: `127.0.0.1:${port}` } });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk: string) => (stdout += chunk));
    child.stderr.setEncoding("utf8").on("data", (chunk: string) => (stderr += chunk));
    const [code] = (await once(child, "close")) as [number | null];
    assert.equal(code, 0, stdout + stderr);
    assert.match(stdout, /Host Runtime: not reachable\. .+/);
    assert.doesNotMatch(stdout, /Host Runtime: reachable/);
    assert.equal(stderr, "");
  } finally {
    server.close();
  }
});

test("an unknown command or option, or an option that status does not take, exits 2 with the help", () => {
  assert.equal(run("doctor").status, 2);
  assert.equal(run("install", "--force").status, 2);
  for (const option of [["--global"], ["--target", "claude"]]) {
    const refused = run("status", ...option);
    assert.equal(refused.status, 2);
    assert.match(refused.stderr, /^status takes no --target or --global\.\n\nc64-re-tools:/);
  }
});
