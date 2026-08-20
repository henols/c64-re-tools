// Coverage for r2000-cli.ts: proves the argv-subcommand mechanism end to end
// (the exact thing RESEARCH.md flagged as unverified for Assumption A2),
// exercises both verbs in-process, and proves the .d64 refusal (D-02) writes
// nothing. Bin-level tests spawn the real vice-proxy.ts bin exactly as a
// consumer would (smoke.mjs's own harness shape, including
// VICE_SKIP_RESOURCE_INSTALL=1 and MASTRA_TELEMETRY_DISABLED=1 in the child
// env); in-process tests call runR2000Cli() directly against a temp working
// directory. The gated test (test 8) needs a real regenerator2000 and follows
// disasm-roundtrip.test.ts's SKIP_REASON / { skip } convention, renamed
// R2000_BIN/VICE_REQUIRE_R2000 per D-11 -- never a hand-rolled early return.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { runR2000Cli } from "./r2000-cli.ts";
import { tsToOffset } from "./r2000-d64.ts";

const HERE = dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------------------
// Console capture -- runR2000Cli() speaks only via console.log/console.error,
// never returns text, so in-process tests intercept both temporarily rather
// than spawning a child process for every case.
// ---------------------------------------------------------------------------

async function withCapturedConsole<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const outLines: string[] = [];
  const errLines: string[] = [];
  console.log = (...args: unknown[]) => {
    outLines.push(args.map(String).join(" "));
  };
  console.error = (...args: unknown[]) => {
    errLines.push(args.map(String).join(" "));
  };
  try {
    const result = await fn();
    return { result, stdout: outLines.join("\n"), stderr: errLines.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

function withTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(tmpdir(), "r2000-cli-test-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

// ---------------------------------------------------------------------------
// A minimal, self-contained .d64 fixture -- one directory sector at 18/1 with
// a single "GAME" entry, its payload written across a single sector. Rebuilt
// here (not exported from r2000-d64.test.ts, per that file's scope) using the
// same DOS end-of-chain convention: the last sector's next-track byte is 0
// and its next-sector byte holds the zero-based offset of the last used byte.
// ---------------------------------------------------------------------------

function blankImage(): Buffer {
  return Buffer.alloc(174848, 0);
}

function writeDirEntry(
  buf: Buffer,
  dirTrack: number,
  dirSector: number,
  index: number,
  opts: { typeByte: number; firstTrack: number; firstSector: number; name: string; blocks: number },
): void {
  const off = tsToOffset(dirTrack, dirSector) + index * 32;
  buf[off + 2] = opts.typeByte;
  buf[off + 3] = opts.firstTrack;
  buf[off + 4] = opts.firstSector;
  const nameBuf = Buffer.alloc(16, 0xa0);
  Buffer.from(opts.name, "latin1").copy(nameBuf);
  nameBuf.copy(buf, off + 5);
  buf[off + 30] = opts.blocks & 0xff;
  buf[off + 31] = (opts.blocks >> 8) & 0xff;
}

function writeSingleSectorEntry(buf: Buffer, track: number, sector: number, payload: Uint8Array): void {
  const off = tsToOffset(track, sector);
  buf[off] = 0; // end of chain
  buf[off + 1] = payload.length + 1; // last-used-byte offset (see r2000-d64.ts's own convention)
  Buffer.from(payload).copy(buf, off + 2);
}

/** A tiny .prg-shaped payload: little-endian $0801 load address, `lax`
 * zeropage ($A7 $02, an illegal opcode) then `rts` ($60) -- reused for every
 * fixture below so the forced `use_illegal_opcodes` setting (D-05) is
 * actually exercised, not merely written, exactly like r2000-project.test.ts's
 * own gated integration test. */
const PRG_WITH_ILLEGAL_OPCODE = Uint8Array.from([0x01, 0x08, 0xa7, 0x02, 0x60]);

function oneEntryImage(): Buffer {
  const buf = blankImage();
  writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 5, firstSector: 0, name: "GAME", blocks: 1 });
  writeSingleSectorEntry(buf, 5, 0, PRG_WITH_ILLEGAL_OPCODE);
  return buf;
}

// ---------------------------------------------------------------------------
// Bin-level tests (no regenerator2000 needed, so these always run) -- the
// end-to-end proof RESEARCH.md flagged as missing for Assumption A2: the
// subcommand short-circuits before the MCP server ever starts.
// ---------------------------------------------------------------------------

const VICE_PROXY = join(HERE, "vice-proxy.ts");
const CLI_ENV = {
  ...process.env,
  VICE_SKIP_RESOURCE_INSTALL: "1",
  MASTRA_TELEMETRY_DISABLED: "1",
};
const CLI_TIMEOUT_MS = 20_000;

function spawnCli(args: string[]) {
  return spawnSync("node", [VICE_PROXY, ...args], {
    encoding: "utf8" as const,
    env: CLI_ENV,
    timeout: CLI_TIMEOUT_MS,
  });
}

let helpResult: ReturnType<typeof spawnCli>;
let unknownVerbResult: ReturnType<typeof spawnCli>;

before(() => {
  helpResult = spawnCli(["r2000", "--help"]);
  unknownVerbResult = spawnCli(["r2000", "no-such-verb"]);
});

test("bin: `vice-mcp r2000 --help` exits 0, prints both invocation forms, and emits no JSON-RPC frame", () => {
  assert.equal(helpResult.status, 0, `stdout: ${helpResult.stdout} stderr: ${helpResult.stderr}`);
  assert.match(helpResult.stdout, /npx -y @henols\/vice-mcp r2000 <verb>/);
  assert.match(helpResult.stdout, /node <plugin-root>\/\.claude\/mcp\/vice\/vice-proxy\.ts r2000 <verb>/);

  // The load-bearing assertion: no line of stdout parses as a JSON object
  // carrying a `jsonrpc` key -- proof the subcommand short-circuits before
  // the MCP server (and its stdio JSON-RPC wire protocol) ever starts.
  const lines = helpResult.stdout.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      continue;
    }
    const isJsonRpcFrame = !!parsed && typeof parsed === "object" && "jsonrpc" in (parsed as Record<string, unknown>);
    assert.equal(
      isJsonRpcFrame,
      false,
      `stdout line parses as a JSON-RPC frame, proving the dispatch fell through into the server: ${trimmed}`,
    );
  }
});

test("bin: `vice-mcp r2000 no-such-verb` exits non-zero and prints a usage block", () => {
  assert.notEqual(unknownVerbResult.status, 0);
  const combined = `${unknownVerbResult.stdout}${unknownVerbResult.stderr}`;
  assert.match(combined, /usage \(npm install\)/);
});

test("bin: `vice-mcp r2000 --help` lists all three verbs: bootstrap, export-asm, verify", () => {
  assert.match(helpResult.stdout, /\bbootstrap\b/);
  assert.match(helpResult.stdout, /\bexport-asm\b/);
  assert.match(helpResult.stdout, /\bverify\b/);
});

test("bin: both invocations terminate on their own within the timeout, not via spawnSync's timeout kill", () => {
  assert.equal(
    helpResult.signal,
    null,
    "r2000 --help was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
  assert.equal(
    unknownVerbResult.signal,
    null,
    "r2000 no-such-verb was killed by the spawn timeout -- the dispatch may have fallen through into startStdio(), which never returns",
  );
});

// ---------------------------------------------------------------------------
// In-process verb tests, calling runR2000Cli() directly against a temp
// working directory.
// ---------------------------------------------------------------------------

test("in-process: bootstrap on a .d64 with no --entry lists every entry name and writes nothing (D-02)", async () => {
  await withTempDir(async (dir) => {
    const d64Path = join(dir, "game.d64");
    writeFileSync(d64Path, oneEntryImage());
    const outPath = join(dir, "game.regen2000proj");

    const { result: code, stdout } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", d64Path, "--out", outPath]),
    );

    assert.equal(code, 2);
    assert.match(stdout, /GAME/);
    assert.equal(existsSync(outPath), false, "no project file must be written when no --entry is given");
  });
});

test(
  "in-process: bootstrap on a .d64 with --entry naming a missing file fails, naming the requested and available entries, and writes nothing",
  async () => {
    await withTempDir(async (dir) => {
      const d64Path = join(dir, "game.d64");
      writeFileSync(d64Path, oneEntryImage());
      const outPath = join(dir, "game.regen2000proj");

      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["bootstrap", d64Path, "--entry", "NOPE", "--out", outPath]),
      );

      assert.notEqual(code, 0);
      assert.match(stderr, /NOPE/);
      assert.match(stderr, /GAME/);
      assert.equal(existsSync(outPath), false, "no project file must be written for an unknown --entry");
    });
  },
);

test("in-process: a .vsf input is refused with a message naming Phase 11, not a crash (D-03)", async () => {
  await withTempDir(async (dir) => {
    const vsfPath = join(dir, "snapshot.vsf");
    writeFileSync(vsfPath, Buffer.from("VICE Snapshot File\x1a", "latin1"));
    const outPath = join(dir, "snapshot.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", vsfPath, "--out", outPath]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /Phase 11/);
    assert.equal(existsSync(outPath), false, "no project file must be written for a refused .vsf input");
  });
});

test("in-process: bootstrap on a bare .prg writes a .regen2000proj with the forced settings (D-05)", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
    const outPath = join(dir, "game.regen2000proj");

    const { result: code } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", prgPath, "--out", outPath]),
    );

    assert.equal(code, 0);
    assert.ok(existsSync(outPath), `expected ${outPath} to exist`);
    const project = JSON.parse(readFileSync(outPath, "utf8")) as {
      settings: { use_illegal_opcodes: unknown; system: unknown };
    };
    assert.equal(project.settings.use_illegal_opcodes, true);
    assert.equal(typeof project.settings.system, "string");
    assert.ok((project.settings.system as string).length > 0, "settings.system must be an explicit non-empty string");
  });
});

// ---------------------------------------------------------------------------
// Gated test -- needs a real regenerator2000. Mirrors D-11's SKIP/
// VICE_REQUIRE_R2000 shape (r2000-project.test.ts's own convention), never a
// hand-rolled early return.
// ---------------------------------------------------------------------------

const R2000_BIN = process.env.R2000_BIN ?? "regenerator2000";

function probeR2000(): boolean {
  const r = spawnSync(R2000_BIN, ["--version"], { encoding: "utf8", timeout: 10_000 });
  if (r.error) return false;
  const banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  return /regenerator2000/i.test(banner);
}

const R2000_AVAILABLE = probeR2000();

/** Computed exactly once. Passed through node:test's own `{ skip }` option --
 * never a hand-rolled early return, which would report a false PASS rather
 * than a SKIP. */
const SKIP_REASON: string | false = R2000_AVAILABLE
  ? false
  : `r2000-cli.test.ts's regenerator2000-dependent test is skipped -- no real regenerator2000 was found at ` +
    `R2000_BIN="${R2000_BIN}". Set R2000_BIN to an absolute path to a real "regenerator2000" binary, or ` +
    `install one (cargo install regenerator2000 -- verified against 0.9.20 during Phase 9/10 planning). D-11 ` +
    `keeps CI from setting VICE_REQUIRE_R2000, so this is an expected SKIP there.`;

test("regenerator2000 availability gate (D-11)", () => {
  if (process.env.VICE_REQUIRE_R2000) {
    assert.ok(
      R2000_AVAILABLE,
      `VICE_REQUIRE_R2000 is set but no real regenerator2000 was found at R2000_BIN="${R2000_BIN}" -- a ` +
        `maintainer who sets this variable expects a hard FAIL, never a SKIP, when the binary is actually missing.`,
    );
  }
});

test(
  "gated: export-asm on a bare .prg produces ACME source in one command, no human interaction (D-01/D-09)",
  { skip: SKIP_REASON },
  async () => {
    await withTempDir(async (dir) => {
      const prgPath = join(dir, "game.prg");
      writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
      const outPath = join(dir, "game.a");

      const { result: code } = await withCapturedConsole(() =>
        runR2000Cli(["export-asm", prgPath, "--out", outPath]),
      );

      assert.equal(code, 0);
      assert.ok(existsSync(outPath), `expected exported .a file at ${outPath}`);
      const exported = readFileSync(outPath, "utf8");
      assert.ok(exported.length > 0, "exported .a file is empty");
      assert.match(
        exported,
        /\blax\b/i,
        "exported ACME source should contain the illegal-opcode mnemonic 'lax', proving " +
          "use_illegal_opcodes: true was actually honoured",
      );
    });
  },
);

test(
  "gated: verify on a bare .prg returns 0 and prints an ACME line containing byte-identical (D-10, criterion 4)",
  { skip: SKIP_REASON },
  async () => {
    await withTempDir(async (dir) => {
      const prgPath = join(dir, "game.prg");
      writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

      const { result: code, stdout } = await withCapturedConsole(() =>
        runR2000Cli(["verify", prgPath]),
      );

      assert.equal(code, 0, `expected exit 0, stdout: ${stdout}`);
      assert.match(stdout, /ACME/);
      assert.match(stdout, /byte-identical/i);
    });
  },
);
