// The c64-static-analysis script with a fake dxa that prints a fixed listing:
// how conflicts are shown, and what a refused import leaves behind. No DXA
// or Ghidra needed.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { after, test } from "node:test";

import { openForWrite } from "../../src/knowledge/database.ts";
import { classifyRegion } from "../../src/knowledge/write.ts";

const script = resolve(import.meta.dirname, "../../skills/c64-static-analysis/scripts/analyze.ts");
const scratch = mkdtempSync(join(tmpdir(), "c64-re-tools-fake-dxa-"));
after(() => rmSync(scratch, { recursive: true, force: true }));

// A PRG at $1000: LDA #$00, RTS, then two data bytes.
const prg = Buffer.from([0x00, 0x10, 0xa9, 0x00, 0x60, 0x01, 0x02]);
const LISTING = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 60 \trts", "1003 table:", "1003 01 02 \t.byt $01,$02", ""];

/** A dxa that prints `lines` as its listing. */
function fakeDxa(name: string, lines: string[]): string {
  const fake = join(scratch, `${name}.ts`);
  writeFileSync(fake, `#!/usr/bin/env node\nprocess.stdout.write(${JSON.stringify(lines.join("\n"))});\n`);
  chmodSync(fake, 0o755);
  // Windows starts no script by its shebang: a .cmd file runs it through Node.
  if (process.platform !== "win32") return fake;
  const program = join(scratch, `${name}.cmd`);
  writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  return program;
}

function project(name: string): string {
  const root = join(scratch, name);
  mkdirSync(root);
  writeFileSync(join(root, "game.prg"), prg);
  return root;
}

async function analyze(root: string, dxa: string, ...args: string[]): Promise<{ status: number | null; json: Record<string, unknown> }> {
  const child = spawn(process.execPath, [...process.execArgv, script, "game.prg", "--analyzer", "dxa", ...args], {
    cwd: root,
    env: { ...process.env, C64RT_DXA: dxa, C64RT_HOST: "127.0.0.1:1" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk) => (stdout += chunk));
  child.stderr.on("data", (chunk) => (stderr += chunk));
  const [status] = (await once(child, "exit")) as [number | null];
  assert.equal(stderr, "");
  return { status, json: JSON.parse(stdout) as Record<string, unknown> };
}

test("a DXA conflict names what DXA found under the key dxa", { timeout: 60_000 }, async () => {
  const root = project("conflict");
  const db = openForWrite(root);
  classifyRegion(db, { origin: "user" }, { start: 0x1000, end: 0x1002, type: "bytes" });
  db.close();
  const { status, json } = await analyze(root, fakeDxa("dxa-ok", LISTING));
  assert.equal(status, 0, JSON.stringify(json));
  assert.deepEqual(json.conflicts, [
    { range: { start: "$1000", end: "$1002" }, knowledge: { type: "bytes", origin: "user" }, dxa: { type: "code" }, problem: "code and data disagree" },
  ]);
});

test("a refused DXA import in a new project creates no knowledge and writes no listing", { timeout: 60_000 }, async () => {
  const root = project("refused");
  const twoNames = ["1000 start:", "1000 a9 00 \tlda #$00", "1002 start:", "1002 60 \trts", "1003 01 02 \t.byt $01,$02", ""];
  const { status, json } = await analyze(root, fakeDxa("dxa-two-names", twoNames), "--listing", "analysis/game.lst");
  assert.equal(status, 1, JSON.stringify(json));
  assert.equal((json.error as { code: string }).code, "invalid-input");
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
  assert.equal(existsSync(join(root, "analysis")), false);
});

test("an accepted DXA import records the findings and writes the listing", { timeout: 60_000 }, async () => {
  const root = project("accepted");
  const { status, json } = await analyze(root, fakeDxa("dxa-accepted", LISTING), "--listing", "analysis/game.lst");
  assert.equal(status, 0, JSON.stringify(json));
  assert.equal(json.revision, 1);
  assert.equal(json.listing, "analysis/game.lst");
  assert.equal(existsSync(join(root, "analysis", "game.lst")), true);
});

test("an import refused because knowledge changed during the analysis tells to run the analysis again", { timeout: 60_000 }, async () => {
  const root = project("stale");
  // A dxa that writes knowledge while it runs, then prints its listing.
  const fake = join(scratch, "dxa-writes.ts");
  const module = (path: string) => JSON.stringify(pathToFileURL(resolve(import.meta.dirname, path)).href);
  writeFileSync(
    fake,
    [
      "#!/usr/bin/env node",
      `import { openForWrite } from ${module("../../src/knowledge/database.ts")};`,
      `import { renameSymbol } from ${module("../../src/knowledge/write.ts")};`,
      `const db = openForWrite(${JSON.stringify(root)});`,
      'renameSymbol(db, { origin: "user" }, { address: 0x1000, name: "main" });',
      "db.close();",
      `process.stdout.write(${JSON.stringify(LISTING.join("\n"))});`,
      "",
    ].join("\n"),
  );
  chmodSync(fake, 0o755);
  let program = fake;
  if (process.platform === "win32") {
    program = join(scratch, "dxa-writes.cmd");
    writeFileSync(program, `@"${process.execPath}" "${fake}" %*\r\n`);
  }
  const { status, json } = await analyze(root, program);
  assert.equal(status, 1, JSON.stringify(json));
  const error = json.error as { code: string; message: string };
  assert.equal(error.code, "stale-revision");
  assert.match(error.message, /Run the analysis again\.$/);
});
