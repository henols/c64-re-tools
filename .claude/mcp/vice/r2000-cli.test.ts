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
import { synthesizeProject } from "./r2000-project.ts";

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

test("bin: `vice-mcp r2000 --help` lists both symbol round-trip verbs: export-lbl, import-lbl (11-08)", () => {
  assert.match(helpResult.stdout, /\bexport-lbl\b/);
  assert.match(helpResult.stdout, /\bimport-lbl\b/);
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

test("in-process: a .vsf input is refused with a message naming the backlog file, not a phase (D-03, FLOW-02)", async () => {
  await withTempDir(async (dir) => {
    const vsfPath = join(dir, "snapshot.vsf");
    writeFileSync(vsfPath, Buffer.from("VICE Snapshot File\x1a", "latin1"));
    const outPath = join(dir, "snapshot.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", vsfPath, "--out", outPath]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /2026-08-20-vsf-as-a-bootstrap-input/);
    assert.doesNotMatch(stderr, /Phase\s+\d/);
    assert.equal(existsSync(outPath), false, "no project file must be written for a refused .vsf input");
  });
});

test("in-process: bootstrap refuses a .regen2000proj input rather than reparsing it as a .prg (CR-02)", async () => {
  await withTempDir(async (dir) => {
    const projPath = join(dir, "game.regen2000proj");
    const originalContents = JSON.stringify({ some: "project", marker: "ORIGINAL-NOT-REPARSED" });
    writeFileSync(projPath, originalContents);

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", projPath]),
    );

    assert.notEqual(code, 0, "bootstrap must refuse a .regen2000proj input, not reparse it as a .prg");
    assert.match(stderr, /already a \.regen2000proj/);
    assert.equal(
      readFileSync(projPath, "utf8"),
      originalContents,
      "bootstrap must not have overwritten the .regen2000proj input with a reparsed garbage project",
    );
  });
});

test(
  "in-process: bootstrap refuses to clobber an existing default-named output file distinct from its input (overwrite guard)",
  async () => {
    await withTempDir(async (dir) => {
      const prgPath = join(dir, "game.prg");
      writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
      const existingProj = join(dir, "game.regen2000proj");
      const PRE_EXISTING = "PRE-EXISTING PROJECT CONTENT, NOT SYNTHESISED JSON";
      writeFileSync(existingProj, PRE_EXISTING);

      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["bootstrap", prgPath]),
      );

      assert.notEqual(code, 0);
      assert.match(stderr, /refusing to overwrite/);
      assert.equal(readFileSync(existingProj, "utf8"), PRE_EXISTING);
    });
  },
);

test("in-process: bootstrap --force overwrites an existing default-named output file deliberately", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
    const existingProj = join(dir, "game.regen2000proj");
    writeFileSync(existingProj, "STALE CONTENT");

    const { result: code } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", prgPath, "--force"]),
    );

    assert.equal(code, 0);
    const written = JSON.parse(readFileSync(existingProj, "utf8")) as { settings: { use_illegal_opcodes: unknown } };
    assert.equal(written.settings.use_illegal_opcodes, true);
  });
});

test("in-process: export-asm refuses to clobber an existing default-named output file (CR-01)", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
    const existingA = join(dir, "game.a");
    const HAND_WRITTEN = "; MY PRECIOUS HAND-WRITTEN SOURCE\n";
    writeFileSync(existingA, HAND_WRITTEN);

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", prgPath]),
    );

    assert.notEqual(code, 0, "export-asm must refuse rather than silently clobber game.a");
    assert.match(stderr, /refusing to overwrite/);
    assert.equal(
      readFileSync(existingA, "utf8"),
      HAND_WRITTEN,
      "export-asm must not have touched the pre-existing hand-written source",
    );
  });
});

test("in-process: export-asm --force overwrites an existing default-named output file deliberately (CR-01)", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
    const existingA = join(dir, "game.a");
    writeFileSync(existingA, "; stale source, --force says overwrite me\n");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", prgPath, "--force"]),
    );

    // Without a real regenerator2000 this may still fail later (spawn
    // ENOENT / non-zero exit), but it must get PAST the overwrite guard --
    // i.e. it must never print the CR-01 refusal message.
    assert.doesNotMatch(stderr, /refusing to overwrite/);
    void code;
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
// WR-07: a flat capture must be dispatched by EXTENSION, not by byte length,
// so a truncated/oversized `.raw`/`.bin` hits flatImageOrigin()'s own named
// refusal instead of silently falling through to parsePrg() (see
// r2000-cli.ts's header comment for the reproduced incident this pins).
// ---------------------------------------------------------------------------

test("in-process: bootstrap on a 4096-byte .raw capture fails, naming both the actual length and the required length (WR-07)", async () => {
  await withTempDir(async (dir) => {
    const rawPath = join(dir, "capture.raw");
    // First two bytes deliberately shaped like a plausible-looking load
    // address so a silent parsePrg() fallback would "succeed" with a wrong
    // origin instead of erroring -- this is what WR-07's live incident
    // looked like (origin $62c5 read from the capture's own first two
    // bytes).
    const truncated = Buffer.alloc(4096, 0);
    truncated[0] = 0xc5;
    truncated[1] = 0x62;
    writeFileSync(rawPath, truncated);
    const outPath = join(dir, "capture.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", rawPath, "--out", outPath]),
    );

    assert.notEqual(code, 0, "a wrong-size .raw capture must not bootstrap successfully");
    assert.match(stderr, /4096/, "stderr must name the actual length");
    assert.match(stderr, /65536/, "stderr must name the required length");
    assert.ok(!existsSync(outPath), "no project file must be written for a refused capture");
  });
});

test("in-process: bootstrap on a genuine 65536-byte .raw capture still bootstraps successfully (WR-07)", async () => {
  await withTempDir(async (dir) => {
    const rawPath = join(dir, "capture.raw");
    const full = Buffer.alloc(65536, 0);
    full[0x0801] = 0x60; // rts, so the body is non-trivially non-zero at a plausible spot
    writeFileSync(rawPath, full);
    const outPath = join(dir, "capture.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", rawPath, "--out", outPath]),
    );

    assert.equal(code, 0, `expected success, stderr: ${stderr}`);
    assert.ok(existsSync(outPath), `expected ${outPath} to exist`);
  });
});

test("in-process: bootstrap on a .prg whose length happens to be 4096 still bootstraps as a .prg (WR-07 regression guard)", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    const body = Buffer.alloc(4096, 0);
    body[0] = 0x01; // load address low byte
    body[1] = 0x08; // load address high byte ($0801)
    writeFileSync(prgPath, body);
    const outPath = join(dir, "game.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", prgPath, "--out", outPath]),
    );

    assert.equal(code, 0, `expected a .prg of any length to bootstrap normally, stderr: ${stderr}`);
    assert.ok(existsSync(outPath), `expected ${outPath} to exist`);
    const project = JSON.parse(readFileSync(outPath, "utf8")) as { origin?: number };
    assert.equal(project.origin, 0x0801);
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

// ---------------------------------------------------------------------------
// gen-enums verb tests (Task 3, 11-06) -- unknown option refused, missing
// project path refused with usage, and the coverage report present on
// stdout are always-run (no live binary needed); criterion 3's own
// acceptance test needs BOTH a real regenerator2000 (D-11) AND real ACME
// (disasm-roundtrip.test.ts's own VICE_REQUIRE_ACME convention), since it
// reads regenerator2000's --export_asm output through real ACME.
// ---------------------------------------------------------------------------

test("gen-enums: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["gen-enums", "some.regen2000proj", "--not-a-real-flag"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("gen-enums: a missing project path is refused with usage text, not a stack trace", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["gen-enums"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /usage: gen-enums/i);
});

test("gen-enums: a nonexistent project file is refused, not silently accepted", async () => {
  await withTempDir(async (dir) => {
    const missing = join(dir, "does-not-exist.regen2000proj");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["gen-enums", missing]));
    assert.notEqual(code, 0);
    assert.match(stderr, /not found/i);
  });
});

// ---------------------------------------------------------------------------
// export-lbl / import-lbl verb tests (Task 3, 11-08) -- unknown option and
// missing-value refusals, and a missing project/label file, are always-run
// (no live binary needed); the happy-path round trip against a bootstrapped
// project needs a real regenerator2000 (D-11) AND runR2000Tool()'s own
// workspace-containment requirement (T-11-PATH-ESCAPE), so it uses
// withWorkspaceTempDir() (defined below) rather than withTempDir()'s system
// tmpdir.
// ---------------------------------------------------------------------------

test("export-lbl: a missing project is refused, not silently accepted", async () => {
  await withTempDir(async (dir) => {
    const missing = join(dir, "does-not-exist.regen2000proj");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["export-lbl", missing]));
    assert.notEqual(code, 0);
    assert.match(stderr, /not found/i);
  });
});

test("export-lbl: --out with no value is refused", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["export-lbl", "some.regen2000proj", "--out"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /--out requires a value/i);
});

test("export-lbl: --out followed by a flag-shaped token is refused (not silently consumed as the value)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["export-lbl", "some.regen2000proj", "--out", "--force"]),
  );
  // Refused either way -- whether reported as "--out requires a value" or as
  // an unrecognised second flag ("--force" is reprocessed on its own once
  // it is not consumed as --out's value) -- the load-bearing property is
  // that "--force" is never silently accepted AS --out's value.
  assert.notEqual(code, 0);
  assert.match(stderr, /--out requires a value|unknown option/i);
});

test("export-lbl: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["export-lbl", "some.regen2000proj", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("import-lbl: usage is printed and exit is non-zero when arguments are missing", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["import-lbl", "only-one.regen2000proj"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /usage: import-lbl/i);
});

test("import-lbl: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["import-lbl", "some.regen2000proj", "some.lbl", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("import-lbl: a missing project file is refused", async () => {
  await withTempDir(async (dir) => {
    const missingProject = join(dir, "does-not-exist.regen2000proj");
    const lblPath = join(dir, "some.lbl");
    writeFileSync(lblPath, "al C:0801 .main\n");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["import-lbl", missingProject, lblPath]));
    assert.notEqual(code, 0);
    assert.match(stderr, /project file not found/i);
  });
});

test("import-lbl: a missing label file is refused", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const missingLbl = join(dir, "does-not-exist.lbl");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["import-lbl", projectPath, missingLbl]));
    assert.notEqual(code, 0);
    assert.match(stderr, /label file not found/i);
  });
});

// import-lbl's ceiling refusal needs no live regenerator2000 at all --
// r2000-symbols.ts's importLabels() checks the caller-supplied .lbl's own
// ceilings BEFORE ever spawning a child (T-11-LBL-SIZE), so the project file
// content is never even read.
test("import-lbl: a .lbl exceeding the line-count ceiling is refused with stock-symbols.ts's own ceiling message", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}"); // never read -- the ceiling check runs first
    const lblPath = join(dir, "huge.lbl");
    writeFileSync(lblPath, Array.from({ length: 50001 }, () => "; filler").join("\n"));

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["import-lbl", projectPath, lblPath]));
    assert.notEqual(code, 0);
    assert.match(stderr, /50000-line ceiling/);
  });
});

test(
  "gated: export-lbl writes a .lbl with the symbol count parsed back, and import-lbl reports names imported plus a disk-verified persistence confirmation (R2000-14/R2000-15)",
  { skip: SKIP_REASON },
  async () => {
    await withWorkspaceTempDir(async (dir) => {
      const prgPath = join(dir, "game.prg");
      writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
      const projectPath = join(dir, "game.regen2000proj");
      const { result: bootCode } = await withCapturedConsole(() => runR2000Cli(["bootstrap", prgPath, "--out", projectPath]));
      assert.equal(bootCode, 0);

      const { runR2000Tool } = await import("./r2000-tools.ts");
      const setResult = await runR2000Tool("r2000_set_label_name", { project: projectPath, address: 0x0801, name: "entry" });
      assert.equal(setResult.isError, false, JSON.stringify(setResult));

      const lblOut = join(dir, "game.lbl");
      const { result: exportCode, stdout: exportStdout } = await withCapturedConsole(() =>
        runR2000Cli(["export-lbl", projectPath, "--out", lblOut]),
      );
      assert.equal(exportCode, 0, exportStdout);
      assert.ok(existsSync(lblOut));
      assert.match(exportStdout, /wrote .*game\.lbl.*\(1 symbol\(s\)\)/);

      const importText = readFileSync(lblOut, "utf8") + "\nal C:0802 .discovered\n";
      const importPath = join(dir, "discovered.lbl");
      writeFileSync(importPath, importText);

      const { result: importCode, stdout: importStdout } = await withCapturedConsole(() =>
        runR2000Cli(["import-lbl", projectPath, importPath]),
      );
      assert.equal(importCode, 0, importStdout);
      assert.match(importStdout, /entry/);
      assert.match(importStdout, /discovered/);
      assert.match(importStdout, /persisted by an explicit/i);
    });
  },
);

// ---------------------------------------------------------------------------
// Local ACME gate, mirroring disasm-roundtrip.test.ts's own convention
// exactly (renamed nothing -- same ACME_BIN/VICE_REQUIRE_ACME env vars,
// since criterion 3's test is the SAME external-oracle claim that file
// already established the convention for).
// ---------------------------------------------------------------------------

const ACME_BIN = process.env.ACME_BIN ?? "acme";

function probeAcme(): boolean {
  let r = spawnSync(ACME_BIN, ["--version"], { encoding: "utf8" });
  let banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.error || !/acme/i.test(banner)) {
    r = spawnSync(ACME_BIN, ["--help"], { encoding: "utf8" });
    banner = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  }
  if (r.error) return false;
  return /acme/i.test(banner);
}

const ACME_AVAILABLE = probeAcme();

const CRITERION3_SKIP_REASON: string | false =
  R2000_AVAILABLE && ACME_AVAILABLE
    ? false
    : `criterion 3's acceptance test needs BOTH a real regenerator2000 (R2000_AVAILABLE=${R2000_AVAILABLE}) and real ` +
      `ACME (ACME_AVAILABLE=${ACME_AVAILABLE}) -- see this file's own D-11/D-08 gates above for how to install either.`;

test("ACME availability gate (D-08), reused for criterion 3", () => {
  if (process.env.VICE_REQUIRE_ACME) {
    assert.ok(
      ACME_AVAILABLE,
      `VICE_REQUIRE_ACME is set but no real ACME was found at ACME_BIN="${ACME_BIN}" -- criterion 3 requires ` +
        "a hard FAIL, never a skip, whenever the CI gate expects ACME to be present.",
    );
  }
});

/** Unlike withTempDir() (system tmpdir, fine for the CLI's own bootstrap/
 * export-asm/verify verbs, which never resolve a path against repoRoot()),
 * this test also drives runR2000Tool()/generateEnums() directly, and
 * r2000-tools.ts's resolveStorePath() (T-11-PATH-ESCAPE) requires every
 * .regen2000proj path to resolve INSIDE the workspace root -- a system
 * tmpdir path is refused by design. Mirrors r2000-enum-gen.test.ts's own
 * workspace-local temp-dir convention. */
function withWorkspaceTempDir<T>(fn: (dir: string) => T | Promise<T>): Promise<T> {
  const dir = mkdtempSync(join(HERE, ".r2000-cli-test-criterion3-"));
  return Promise.resolve(fn(dir)).finally(() => rmSync(dir, { recursive: true, force: true }));
}

test(
  "gated (D-11+D-08): criterion 3 -- lda #$1b / sta $d011 / rts renders as lda #D011_YSCROLL3_ROW25_SCREENON_TEXT in the ACME export, and the export reassembles under real ACME",
  { skip: CRITERION3_SKIP_REASON },
  async (t) => {
    await withWorkspaceTempDir(async (dir) => {
      const projectPath = join(dir, "criterion3.regen2000proj");
      // Exactly the criterion's own quoted example: lda #$1b / sta $d011 / rts,
      // synthesized directly (D-05: use_illegal_opcodes forced true, though
      // this particular fixture uses no illegal opcode -- forced regardless,
      // per synthesizeProject()'s own unconditional contract) at origin $0810.
      const bytes = Uint8Array.from([0xa9, 0x1b, 0x8d, 0x11, 0xd0, 0x60]);
      writeFileSync(projectPath, synthesizeProject(bytes, { origin: 0x0810 }));

      // gen-enums operates over the MCP surface (r2000-tools.ts), which --
      // unlike the --headless CLI verbs below -- does NOT auto-disassemble a
      // freshly bootstrapped project on load (measured live this session: a
      // search against a freshly synthesized project with no prior
      // r2000_disassemble call returns zero rows). A real c64-program-recon
      // session would already have called this as part of its own analysis
      // pass; this test performs that one setup step explicitly rather than
      // asserting gen-enums itself must auto-disassemble (out of this
      // task's own scope).
      const { runR2000Tool } = await import("./r2000-tools.ts");
      const disasmResult = await runR2000Tool("r2000_disassemble", { project: projectPath, address: 0x0810 });
      assert.equal(disasmResult.isError, false, `setup: r2000_disassemble failed: ${JSON.stringify(disasmResult)}`);

      // 1. run gen-enums against it.
      const { result: genCode, stdout: genStdout } = await withCapturedConsole(() => runR2000Cli(["gen-enums", projectPath]));
      assert.equal(genCode, 0, `gen-enums failed, stdout: ${genStdout}`);
      assert.match(genStdout, /total register stores seen: 1/);
      assert.match(genStdout, /paired \(adjacent lda #imm found\): 1/);
      assert.match(genStdout, /unpaired \(no adjacent immediate load\): 0/);

      // Recorded evidence for RESEARCH.md's dot-vs-underscore finding
      // (Assumption A2, version-scoped, re-verified here rather than
      // trusted as permanent): query the LIVE view for the same address.
      const liveSearch = await runR2000Tool("r2000_search_disassembly", {
        project: projectPath,
        query: "^lda$",
        use_regex: true,
        max_results: 10,
        search_labels: false,
        search_comments: false,
        search_instructions: true,
      });
      const liveRows = JSON.parse(liveSearch.content.map((c) => c.text).join("")) as { operand: string }[];
      const liveOperand = liveRows.find((r) => r.operand.includes("D011"))?.operand ?? "(not found)";
      t.diagnostic(`live search_disassembly operand for the applied enum: "${liveOperand}"`);

      // 2. run export-asm.
      const outPath = join(dir, "criterion3.a");
      const { result: exportCode, stdout: exportStdout } = await withCapturedConsole(() =>
        runR2000Cli(["export-asm", projectPath, "--out", outPath]),
      );
      assert.equal(exportCode, 0, `export-asm failed, stdout: ${exportStdout}`);
      const exported = readFileSync(outPath, "utf8");

      // 3. assert the exported file contains the literal criterion-3 lines.
      assert.match(
        exported,
        /lda #D011_YSCROLL3_ROW25_SCREENON_TEXT/,
        `expected the literal enum reference in the ACME export:\n${exported}`,
      );
      assert.match(exported, /sta \$d011/i, "expected a sta $d011 line in the ACME export");
      assert.match(
        exported,
        /D011_YSCROLL3_ROW25_SCREENON_TEXT\s*=\s*\$1b/i,
        `expected the enum's own definition line in the ACME export:\n${exported}`,
      );

      // 4. assert the export does NOT contain a bare-hex fallback -- a
      // fallback to "lda #$1b" would mean the usage did not bind.
      assert.doesNotMatch(exported, /lda #\$1b\b/i, "the export must not fall back to bare hex -- the enum usage must have bound");

      // Recorded evidence: which separator each surface produced, at
      // execution time (this session).
      const exportedLdaLine = exported.split("\n").find((l) => /lda #D011/i.test(l)) ?? "(not found)";
      t.diagnostic(`ACME export operand: "${exportedLdaLine.trim()}"`);
      const exportUsesUnderscore = /D011_YSCROLL/.test(exportedLdaLine);
      const liveUsesDot = /D011\.YSCROLL/.test(liveOperand);
      const liveUsesUnderscore = /D011_YSCROLL/.test(liveOperand);
      t.diagnostic(
        `separator comparison: export=${exportUsesUnderscore ? "underscore" : "other"}, ` +
          `live=${liveUsesDot ? "dot" : liveUsesUnderscore ? "underscore" : "other"} -- ` +
          (liveUsesDot
            ? "RESEARCH.md's dot-vs-underscore finding still holds on this regenerator2000 version"
            : liveUsesUnderscore
              ? "the two surfaces now AGREE on this regenerator2000 version -- RESEARCH.md's finding is version-scoped (Assumption A2), not permanent"
              : "unexpected separator on the live view -- re-check manually"),
      );
      assert.ok(exportUsesUnderscore, "the ACME export itself must use the underscore form the criterion quotes, regardless of the live view's own rendering");

      // 5. run verify and assert acmeVerdict() reports ok:true -- the
      // generated source actually reassembles under real ACME
      // (ENGINEERING_RULES.md Sec 7's real-external-oracle level).
      const { result: verifyCode, stdout: verifyStdout } = await withCapturedConsole(() => runR2000Cli(["verify", projectPath]));
      assert.equal(verifyCode, 0, `verify failed, stdout: ${verifyStdout}`);
      assert.match(verifyStdout, /ACME/);
      assert.match(verifyStdout, /byte-identical/i);

      // 6. explicit acceptance-surface assertion: this check read the ACME
      // EXPORT (assertions 3/4/5 above), never r2000_search_disassembly's
      // own rendering (only inspected for the recorded-evidence diagnostic
      // above, never asserted against as the pass/fail criterion).
      assert.ok(true, "criterion 3 verified against --export_asm/--verify output, not against the live query view");
    });
  },
);

// ---------------------------------------------------------------------------
// render-memmap verb tests (Task 3, 11-10) -- unknown option, missing
// --provenance, and a missing project file are always-run (no live binary
// needed); the happy path plus --check drift detection needs a real
// regenerator2000 (D-11), via the same withWorkspaceTempDir() convention
// export-lbl/import-lbl's own gated test uses above (resolveStorePath()
// requires the project path to resolve inside the workspace root).
// ---------------------------------------------------------------------------

test("render-memmap: --help lists the verb, states the output is generated, and states --check catches a hand edit", () => {
  const helpResult = spawnCli(["r2000", "--help"]);
  assert.match(helpResult.stdout, /\brender-memmap\b/);
  assert.match(helpResult.stdout, /GENERATED|generated/);
  assert.match(helpResult.stdout, /--check.*hand edit/is);
});

test("render-memmap: a missing project is refused, not silently accepted", async () => {
  await withTempDir(async (dir) => {
    const missing = join(dir, "does-not-exist.regen2000proj");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", missing, "--provenance", join(dir, "sidecar.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /project file not found/i);
  });
});

test("render-memmap: a missing --provenance is refused", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["render-memmap", projectPath]));
    assert.notEqual(code, 0);
    assert.match(stderr, /--provenance.*required/i);
  });
});

test("render-memmap: a nonexistent --provenance file is refused", async () => {
  await withTempDir(async (dir) => {
    const projectPath = join(dir, "game.regen2000proj");
    writeFileSync(projectPath, "{}");
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["render-memmap", projectPath, "--provenance", join(dir, "does-not-exist.json")]),
    );
    assert.notEqual(code, 0);
    assert.match(stderr, /provenance sidecar not found/i);
  });
});

test("render-memmap: an unknown option is refused with a non-zero exit code (WR-08 posture)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.regen2000proj", "--provenance", "x.json", "--not-a-real-flag"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /unknown option/i);
});

test("render-memmap: --provenance with no value is refused", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.regen2000proj", "--provenance"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--provenance requires a value/i);
});

test("render-memmap: --out followed by a flag-shaped token is refused (not silently consumed as the value)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["render-memmap", "some.regen2000proj", "--provenance", "x.json", "--out", "--check"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /--out requires a value/i);
});

test(
  "gated: render-memmap writes a file with row/[unknown] counts and a digest, and --check exits 0 in sync then non-zero naming the differing line after a hand edit (11-10)",
  { skip: SKIP_REASON },
  async () => {
    await withWorkspaceTempDir(async (dir) => {
      const projectPath = join(dir, "memmap.regen2000proj");
      // lda #$1b ; sta $d011 -- same tiny, fully hand-predictable program
      // r2000-memmap-render.test.ts's own golden test uses.
      const bytes = Uint8Array.from([0xa9, 0x1b, 0x8d, 0x11, 0xd0]);
      writeFileSync(projectPath, synthesizeProject(bytes, { origin: 0x0810 }));

      const { runR2000Tool } = await import("./r2000-tools.ts");
      const { formatConfidenceComment } = await import("./r2000-confidence.ts");

      const disasmResult = await runR2000Tool("r2000_disassemble", { project: projectPath, address: 0x0810 });
      assert.equal(disasmResult.isError, false, JSON.stringify(disasmResult));
      const labelResult = await runR2000Tool("r2000_set_label_name", { project: projectPath, address: 0x0810, name: "init_screen" });
      assert.equal(labelResult.isError, false, JSON.stringify(labelResult));
      const commentResult = await runR2000Tool("r2000_set_comment", {
        project: projectPath,
        address: 0x0810,
        comment: formatConfidenceComment("confirmed-code", "observed executing at boot"),
        type: "line",
      });
      assert.equal(commentResult.isError, false, JSON.stringify(commentResult));

      const provenancePath = join(dir, "capture.provenance.json");
      writeFileSync(
        provenancePath,
        JSON.stringify({
          capturePath: "/tmp/capture.raw",
          captureSha256: "a".repeat(64),
          port01: "$35",
          dd00: "$06",
          vicBank: "0 ($0000-$3FFF)",
          screenRam: "$0400",
          charsetOrBitmap: "$1000 (ROM shadow)",
          mode: "text, multicolor off",
          videoStandard: "PAL",
          liveVectorPair: "$0314/$0315",
          vectorHandler: "$EA31",
        }),
      );

      const outPath = join(dir, "memory-map.md");
      const { result: renderCode, stdout: renderStdout } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", outPath]),
      );
      assert.equal(renderCode, 0, renderStdout);
      assert.ok(existsSync(outPath));
      assert.match(renderStdout, /1 row\(s\)/);
      assert.match(renderStdout, /0 \[unknown\]/);
      assert.match(renderStdout, /digest [0-9a-f]{64}/);

      const { result: checkCode1, stdout: checkStdout1 } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", outPath, "--check"]),
      );
      assert.equal(checkCode1, 0, checkStdout1);
      assert.match(checkStdout1, /in sync/i);

      const original = readFileSync(outPath, "utf8");
      writeFileSync(outPath, original.replace("init_screen", "init_screeX"));
      const { result: checkCode2, stderr: checkStderr2 } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", outPath, "--check"]),
      );
      assert.notEqual(checkCode2, 0);
      assert.match(checkStderr2, /drifted at line/i);
      assert.match(checkStderr2, /init_screeX/);

      const missingOut = join(dir, "does-not-exist-yet.md");
      const { result: checkCode3, stderr: checkStderr3 } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", missingOut, "--check"]),
      );
      assert.notEqual(checkCode3, 0);
      assert.match(checkStderr3, /missing/i);
    });
  },
);
