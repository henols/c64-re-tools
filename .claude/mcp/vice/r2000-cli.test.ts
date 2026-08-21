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

import { runR2000Cli, VERB_OPTIONS } from "./r2000-cli.ts";
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

// ---------------------------------------------------------------------------
// WR-09 (D-11.1-04) -- restoring bootstrapProject()'s and cmdRenderMemmap()'s
// never-throw contract on the two branches that broke it (the unwrapped
// `.d64` `parsePrg()` call, and the two unguarded `writeFileSync()` calls),
// plus a structural guard pinning it so a THIRD unguarded write cannot be
// added silently.
//
// The structural guard reads r2000-cli.ts's own source, strips comments and
// string/template-literal bodies (so neither can produce a false brace/paren
// match), then for every `writeFileSync(` occurrence walks BACKWARD through
// the stripped text one character at a time, tracking brace depth, until it
// reaches the nearest unmatched `{` (skipping any it can already prove is
// matched by a `}` seen along the way). That unmatched `{` is classified by
// the token immediately preceding it: `try` means the call is guarded;
// `else`/`finally`/`do`, or a `(...)`-headed block whose header keyword is
// `if`/`for`/`while`/`switch`/`catch`, is a same-function block the scan
// keeps climbing past; anything else (a `function`/method header, an arrow
// `=>`, or reaching column 0 with nothing left to climb) is a function
// boundary or module scope, and the call is reported unguarded. This is a
// brace-depth scan "from each match backwards to the nearest enclosing
// `try {` in the same function" exactly as specified, not a "the file
// contains the word try" substring check -- proven below by a planted
// violation (a bare call at function top level, which the scan must reach
// module scope for and report unguarded) alongside a wrapped control (which
// it must stop climbing at on the very first brace and report guarded).
// ---------------------------------------------------------------------------

const R2000_CLI_SOURCE_PATH = join(HERE, "r2000-cli.ts");

/**
 * Blanks every line comment, block comment, quoted string and template
 * literal body to a same-length run of spaces (newlines preserved), so a
 * brace or paren living only inside a comment or a message string can never
 * be mistaken for real control-flow structure. Deliberately does not track
 * `${...}` interpolation specially inside a template literal -- the whole
 * span between backticks is blanked regardless of nesting, which is correct
 * for this file (no `writeFileSync(` call lives inside a template
 * interpolation anywhere in it) and simpler than a fully general JS
 * tokenizer would need to be.
 */
function stripCommentsAndLiterals(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const c = source[i];
    const c2 = source[i + 1];
    if (c === "/" && c2 === "/") {
      while (i < n && source[i] !== "\n") {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "/" && c2 === "*") {
      out[i] = " ";
      out[i + 1] = " ";
      i += 2;
      while (i < n && !(source[i] === "*" && source[i + 1] === "/")) {
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        out[i + 1] = " ";
        i += 2;
      }
      continue;
    }
    if (c === '"' || c === "'") {
      const quote = c;
      out[i] = " ";
      i++;
      while (i < n && source[i] !== quote) {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    if (c === "`") {
      out[i] = " ";
      i++;
      while (i < n && source[i] !== "`") {
        if (source[i] === "\\") {
          out[i] = " ";
          i++;
          if (i < n) {
            out[i] = " ";
            i++;
          }
          continue;
        }
        if (source[i] !== "\n") out[i] = " ";
        i++;
      }
      if (i < n) {
        out[i] = " ";
        i++;
      }
      continue;
    }
    i++;
  }
  return out.join("");
}

/** The word (identifier characters only) ending at, and including, index
 * `endIdxInclusive` in `stripped`. */
function wordEndingAt(stripped: string, endIdxInclusive: number): string {
  let start = endIdxInclusive;
  while (start >= 0 && /[A-Za-z0-9_$]/.test(stripped[start]!)) start--;
  start++;
  return stripped.slice(start, endIdxInclusive + 1);
}

type BraceKind = "try" | "block" | "function" | "module";

/** Classifies an open brace at `braceIdx` in `stripped` by the token
 * immediately preceding it (skipping whitespace). See this section's header
 * comment for the full classification rule. */
function classifyBrace(stripped: string, braceIdx: number): BraceKind {
  let j = braceIdx - 1;
  while (j >= 0 && /\s/.test(stripped[j]!)) j--;
  if (j < 0) return "module";
  if (stripped[j] === ">" && stripped[j - 1] === "=") return "function"; // arrow `=> {`
  if (stripped[j] === ")") {
    // Walk back to this `)`'s matching `(`, then classify by the keyword (if
    // any) immediately before THAT -- distinguishes `if (...) {` / `for
    // (...) {` / `catch (...) {` (same-function block) from a function or
    // method definition's own `(...) {` (a function boundary).
    let depth = 1;
    let k = j - 1;
    while (k >= 0 && depth > 0) {
      if (stripped[k] === ")") depth++;
      else if (stripped[k] === "(") depth--;
      k--;
    }
    let m = k;
    while (m >= 0 && /\s/.test(stripped[m]!)) m--;
    if (m < 0) return "function";
    const word = wordEndingAt(stripped, m);
    if (word === "if" || word === "for" || word === "while" || word === "switch" || word === "catch") {
      return "block";
    }
    return "function";
  }
  const word = wordEndingAt(stripped, j);
  if (word === "try") return "try";
  if (word === "else" || word === "finally" || word === "do") return "block";
  return "function";
}

/**
 * Walks backward from `callIdx` (the index of a `writeFileSync(` match) in
 * `stripped`, one enclosing brace at a time, until it either finds a `try`
 * (guarded, returns true) or hits a function boundary / module scope
 * (unguarded, returns false). Braces already matched by a `}` encountered
 * during the walk are skipped via a simple depth counter, exactly as if
 * scanning a balanced-bracket stack from the top down.
 */
function isWriteGuarded(stripped: string, callIdx: number): boolean {
  let i = callIdx - 1;
  let depth = 0;
  while (i >= 0) {
    const c = stripped[i];
    if (c === "}") {
      depth++;
      i--;
      continue;
    }
    if (c === "{") {
      if (depth === 0) {
        const kind = classifyBrace(stripped, i);
        if (kind === "try") return true;
        if (kind === "function" || kind === "module") return false;
        // "block" (if/for/while/switch/catch/else/finally/do) -- this brace
        // is consumed; keep climbing toward the next enclosing brace.
        i--;
        continue;
      }
      depth--;
      i--;
      continue;
    }
    i--;
  }
  return false;
}

/** Every `writeFileSync(` call-site index in `source`, found against the
 * comment/literal-stripped text so neither can produce a false match. */
function findWriteFileSyncCalls(source: string): { stripped: string; indices: number[] } {
  const stripped = stripCommentsAndLiterals(source);
  const re = /\bwriteFileSync\s*\(/g;
  const indices: number[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped))) indices.push(m.index);
  return { stripped, indices };
}

test("structural (WR-09): every writeFileSync( in r2000-cli.ts is inside a try block, with a non-vacuous floor and named positive-control sites", () => {
  const source = readFileSync(R2000_CLI_SOURCE_PATH, "utf8");
  const { stripped, indices } = findWriteFileSyncCalls(source);

  // Non-vacuity floor -- a scanner that silently found zero call sites would
  // trivially "pass" a guard that asserts nothing. Two named sites are
  // known to exist right now (bootstrapProject()'s project-file write and
  // cmdRenderMemmap()'s Markdown write); the floor is exactly that measured
  // count, so a THIRD write added later raises it rather than silently
  // slipping through unguarded.
  assert.ok(indices.length >= 2, `expected at least 2 writeFileSync( call sites, found ${indices.length}`);

  // Positive control: the scanner must actually be looking at the real
  // content at each site, not merely returning a fixed answer. Assert each
  // known call site's own arguments are visible in the matched text.
  const contexts = indices.map((idx) => source.slice(idx, idx + 60));
  assert.ok(
    contexts.some((c) => c.includes("outPath, projectJson")),
    `expected to see bootstrapProject()'s own write site among: ${JSON.stringify(contexts)}`,
  );
  assert.ok(
    contexts.some((c) => c.includes("outPath, rendered.markdown")),
    `expected to see cmdRenderMemmap()'s own write site among: ${JSON.stringify(contexts)}`,
  );

  for (const idx of indices) {
    assert.ok(
      isWriteGuarded(stripped, idx),
      `writeFileSync( at source offset ${idx} (${JSON.stringify(source.slice(idx, idx + 60))}) is not inside a try block`,
    );
  }
});

test("structural (WR-09): the guard's planted violation is reported and its wrapped control is not (non-vacuity)", () => {
  const wrapped = `
function foo() {
  try {
    writeFileSync(p, s);
  } catch (err) {
    console.error(err);
  }
}
`;
  const bare = `
function foo() {
  writeFileSync(p, s);
}
`;

  const { stripped: wrappedStripped, indices: wrappedIndices } = findWriteFileSyncCalls(wrapped);
  assert.equal(wrappedIndices.length, 1);
  assert.ok(isWriteGuarded(wrappedStripped, wrappedIndices[0]!), "a try/catch-wrapped writeFileSync must be reported as guarded");

  const { stripped: bareStripped, indices: bareIndices } = findWriteFileSyncCalls(bare);
  assert.equal(bareIndices.length, 1);
  assert.ok(
    !isWriteGuarded(bareStripped, bareIndices[0]!),
    "a bare, function-top-level writeFileSync must be reported as NOT guarded -- the planted violation this guard exists to catch",
  );
});

test("in-process (WR-09): a .d64 entry whose payload parsePrg() rejects fails with a bootstrap:-prefixed, entry-naming message that never mentions parsePrg", async () => {
  await withTempDir(async (dir) => {
    const d64Path = join(dir, "game.d64");
    const buf = blankImage();
    writeDirEntry(buf, 18, 1, 0, { typeByte: 0x82, firstTrack: 5, firstSector: 0, name: "EMPTY", blocks: 1 });
    // Final sector's last-used-byte offset = 2 -- WR-05's assertPlainImage()/
    // extractEntry() bounds check (usedByte >= 2) is the floor this repo
    // already enforces, so the smallest reachable extracted payload is 1
    // byte (usedByte - 1), one byte short of parsePrg()'s own 3-byte
    // minimum (a 2-byte load address plus at least 1 payload byte). This is
    // the current live reproduction of the review's finding -- the
    // original review's exact "0 byte(s)" repro predates WR-05's bounds
    // check (added by plan 11-02) and is no longer reachable at all, since
    // extractEntry() itself now refuses any usedByte below 2 as corrupt
    // before parsePrg() is ever called.
    const off = tsToOffset(5, 0);
    buf[off] = 0; // end of chain
    buf[off + 1] = 2; // last-used-byte offset = 2 -> 1 payload byte
    writeFileSync(d64Path, buf);
    const outPath = join(dir, "game.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", d64Path, "--entry", "EMPTY", "--out", outPath]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /^bootstrap:/);
    assert.match(stderr, /EMPTY/);
    assert.doesNotMatch(stderr, /parsePrg/);
    assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
    assert.equal(existsSync(outPath), false, "no project file must be written for a rejected .d64 entry");
  });
});

test("in-process (WR-09): bootstrap with --out inside a non-existent directory fails with a bootstrap:-prefixed message naming the path, never a stack trace", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);
    const outPath = join(dir, "no-such-subdir", "game.regen2000proj");

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["bootstrap", prgPath, "--out", outPath]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^bootstrap:/);
    assert.match(stderr, new RegExp(outPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
  });
});

test(
  "gated (WR-09): render-memmap with --out inside a non-existent directory fails with a render-memmap:-prefixed message naming the path, never a stack trace",
  { skip: SKIP_REASON },
  async () => {
    await withWorkspaceTempDir(async (dir) => {
      const projectPath = join(dir, "wr09.regen2000proj");
      const bytes = Uint8Array.from([0xa9, 0x1b, 0x8d, 0x11, 0xd0, 0x60]);
      writeFileSync(projectPath, synthesizeProject(bytes, { origin: 0x0810 }));

      const { runR2000Tool } = await import("./r2000-tools.ts");
      const disasmResult = await runR2000Tool("r2000_disassemble", { project: projectPath, address: 0x0810 });
      assert.equal(disasmResult.isError, false, JSON.stringify(disasmResult));

      const provenancePath = join(dir, "prov.json");
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

      const outPath = join(dir, "no-such-subdir", "memory-map.md");
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["render-memmap", projectPath, "--provenance", provenancePath, "--out", outPath]),
      );

      assert.notEqual(code, 0);
      assert.match(stderr, /^render-memmap:/);
      assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
    });
  },
);

// ---------------------------------------------------------------------------
// IN-06 -- a verb refuses an option it does not implement instead of
// silently dropping it. `verify` accepted (and discarded) `--out` because
// `parseArgs()` is a single shared parser returning `out` for every verb,
// while `cmdVerify()` never reads the field back out. `VERB_OPTIONS` (one
// frozen map, `r2000-cli.ts`) plus `checkAcceptedOptions()`'s single
// pre-dispatch call site now refuses any `--flag`-shaped token a verb does
// not accept, for all seven verbs uniformly.
// ---------------------------------------------------------------------------

test("verify: --out is refused, naming the flag and the accepted option set (IN-06)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["verify", "some.regen2000proj", "--out", "x"]));
  assert.notEqual(code, 0);
  assert.match(stderr, /^verify:/);
  assert.match(stderr, /--out/);
  assert.match(stderr, /--entry/, "the refusal must list the accepted option set");
  assert.doesNotMatch(stderr, /\n\s+at /, "stderr must not contain stack-trace text");
});

test("verify: --force is refused the same way --out is (both were silently parsed and discarded before IN-06)", async () => {
  const { result: code, stderr } = await withCapturedConsole(() =>
    runR2000Cli(["verify", "some.regen2000proj", "--force"]),
  );
  assert.notEqual(code, 0);
  assert.match(stderr, /^verify:/);
  assert.match(stderr, /--force/);
});

test("verify: --entry is still accepted and reaches the .d64 entry lookup, not refused as an unknown option (IN-06 regression guard)", async () => {
  await withTempDir(async (dir) => {
    const d64Path = join(dir, "game.d64");
    writeFileSync(d64Path, oneEntryImage());

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["verify", d64Path, "--entry", "NOPE"]),
    );

    assert.notEqual(code, 0);
    // Must fail with extractEntry()'s own "unknown entry" shape (naming the
    // requested and available entries), never the options checker's
    // refusal -- proving --entry was accepted and actually used.
    assert.doesNotMatch(stderr, /is not accepted by this verb/);
    assert.match(stderr, /NOPE/);
    assert.match(stderr, /GAME/);
  });
});

test("the verb-options map agrees with USAGE's own per-verb option lists, for all seven verbs (IN-06)", () => {
  const usage = helpResult.stdout;
  const verbs = Object.keys(VERB_OPTIONS);
  assert.equal(verbs.length, 7, `expected exactly 7 verbs in VERB_OPTIONS, found ${verbs.length}: ${verbs.join(", ")}`);

  for (const verb of verbs) {
    const lineMatch = new RegExp(`^ {2}${verb.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b.*$`, "m").exec(usage);
    assert.ok(lineMatch, `expected a USAGE line for verb "${verb}"`);
    const documented = new Set(lineMatch![0].match(/--[a-zA-Z-]+/g) ?? []);
    const mapped = new Set(VERB_OPTIONS[verb]);
    assert.deepEqual(
      documented,
      mapped,
      `verb "${verb}": USAGE documents ${JSON.stringify([...documented])} but VERB_OPTIONS accepts ${JSON.stringify([...mapped])}`,
    );
  }
});

test("every verb's own documented options are still accepted, one assertion per verb (IN-06 regression guard)", async () => {
  // Built directly from VERB_OPTIONS (the map's own ground truth) rather
  // than hand-typed per verb, so this test cannot silently drift from the
  // map it is proving.
  const placeholderValue: Record<string, string> = {
    "--entry": "SOME-ENTRY",
    "--out": "some-out-path",
    "--force": "",
    "--max-results": "10",
    "--provenance": "some-provenance.json",
    "--check": "",
  };
  for (const [verb, options] of Object.entries(VERB_OPTIONS)) {
    const argv: string[] = [verb, "some.regen2000proj"];
    if (verb === "import-lbl") argv.push("some.lbl");
    for (const opt of options) {
      argv.push(opt);
      const value = placeholderValue[opt];
      if (value) argv.push(value);
    }
    const { stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.doesNotMatch(
      stderr,
      /is not accepted by this verb/,
      `verb "${verb}" with its own documented options ${JSON.stringify(options)} must not be refused by checkAcceptedOptions(); argv=${JSON.stringify(argv)}, stderr=${stderr}`,
    );
  }
});

test("an unaccepted option is refused for every verb it does not belong to, not merely for verify (IN-06 generalisation)", async () => {
  for (const verb of Object.keys(VERB_OPTIONS)) {
    const argv = [verb, "some.regen2000proj", "--totally-not-a-real-flag"];
    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(argv));
    assert.notEqual(code, 0, `verb "${verb}" must refuse an unaccepted flag`);
    assert.match(stderr, new RegExp(`^${verb}:`), `verb "${verb}"'s refusal must be prefixed with its own name`);
    assert.match(stderr, /--totally-not-a-real-flag/);
  }
});

// ---------------------------------------------------------------------------
// WR-08 -- `parseArgs()`'s `--entry`/`--out` used to take the NEXT token
// unconditionally (`entry = rest[++i]`), so a missing or flag-shaped value
// was silently accepted as the value itself. `bootstrap`, `export-asm` and
// `verify` all route through the shared `parseArgs()` (`cmdVerify()` only
// ever reads its `entry` field back out -- `--out` is not in verify's own
// accepted set at all, so `checkAcceptedOptions()` above already refuses it
// before `cmdVerify()` runs; the "verify: --out is refused" test above pins
// that path, so it is not repeated here). Every case below is a `{missing
// value, flag-shaped value}` x `{--entry, --out}` cell for the two verbs
// that actually read `--out` back out, plus the two `--entry` cells for
// verify. The review's own literal reproduction (`--out --entry FOO`) is
// pinned by name for both bootstrap and export-asm, each asserting the
// actual harm -- no file literally named `--entry` is ever created --
// rather than only the parsed shape.
//
// Non-vacuity (recorded verbatim in the SUMMARY): every test in this section
// was confirmed to FAIL against a scratch revert of `parseArgs()` to the
// pre-fix `entry = rest[++i]` / `out = rest[++i]` form, then confirmed to
// PASS again once the fix was restored, with `git diff` showing byte-
// identity against the committed fix afterwards.
// ---------------------------------------------------------------------------

test("bootstrap: the review's literal reproduction (--out --entry FOO) refuses naming --out, and creates no file named --entry", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    // The real hazard's location is `process.cwd()`, not the input's own
    // directory: the pre-fix parser hands `bootstrapProject()` the bare
    // string "--entry" as `outPath` (no directory component at all, since
    // it came from `rest[++i]` unconditionally), and `writeFileSync()`
    // resolves a directory-less relative path against the CURRENT WORKING
    // DIRECTORY of the CLI process -- confirmed live while proving this
    // suite's non-vacuity (see the SUMMARY's transcript): running the
    // reverted parser wrote a real "--entry" file into this repo's own
    // `.claude/mcp/vice/` directory, not into any temp dir. Guard against
    // exactly that landing spot, and clean it up defensively in case a
    // regression ever reintroduces the write.
    const cwdHazardPath = join(process.cwd(), "--entry");
    try {
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["bootstrap", prgPath, "--out", "--entry", "FOO"]),
      );

      assert.notEqual(code, 0);
      assert.match(stderr, /^bootstrap:/);
      assert.match(stderr, /--out/, "the refusal must name --out, not --entry (WR-09's lesson)");
      assert.match(stderr, /requires a value/);
      assert.equal(existsSync(cwdHazardPath), false, "no file literally named --entry must be created in the CLI's cwd");
      assert.equal(existsSync(join(dir, "game.regen2000proj")), false, "bootstrap must not have written its default output either");
    } finally {
      if (existsSync(cwdHazardPath)) rmSync(cwdHazardPath);
    }
  });
});

test("bootstrap: --entry with no following token is refused, not treated as a value of undefined", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["bootstrap", prgPath, "--entry"]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^bootstrap:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});

test("bootstrap: --entry followed by a flag-shaped token is refused, not taken as the entry name", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["bootstrap", prgPath, "--entry", "--force"]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /^bootstrap:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});

test("bootstrap: --out with no following token is refused, not treated as a value of undefined", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["bootstrap", prgPath, "--out"]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^bootstrap:/);
    assert.match(stderr, /--out/);
    assert.match(stderr, /requires a value/);
  });
});

test("export-asm: the review's finding, one verb over (--out --entry FOO) refuses naming --out, and creates no file named --entry", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    // Same cwd-relative hazard location as bootstrap's own case above --
    // see that test's comment for why `process.cwd()` is the real landing
    // spot, not the input file's directory.
    const cwdHazardPath = join(process.cwd(), "--entry");
    try {
      const { result: code, stderr } = await withCapturedConsole(() =>
        runR2000Cli(["export-asm", prgPath, "--out", "--entry", "FOO"]),
      );

      assert.notEqual(code, 0);
      assert.match(stderr, /^export-asm:/);
      assert.match(stderr, /--out/);
      assert.match(stderr, /requires a value/);
      assert.equal(existsSync(cwdHazardPath), false, "no file literally named --entry must be created in the CLI's cwd");
      assert.equal(existsSync(join(dir, "game.a")), false, "export-asm must not have written its default output either");
    } finally {
      if (existsSync(cwdHazardPath)) rmSync(cwdHazardPath);
    }
  });
});

test("export-asm: --entry with no following token is refused", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["export-asm", prgPath, "--entry"]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^export-asm:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});

test("export-asm: --entry followed by a flag-shaped token is refused, not taken as the entry name", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["export-asm", prgPath, "--entry", "--force"]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /^export-asm:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});

test("export-asm: --out with no following token is refused", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["export-asm", prgPath, "--out"]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^export-asm:/);
    assert.match(stderr, /--out/);
    assert.match(stderr, /requires a value/);
  });
});

test("verify: --entry with no following token is refused", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    const { result: code, stderr } = await withCapturedConsole(() => runR2000Cli(["verify", prgPath, "--entry"]));

    assert.notEqual(code, 0);
    assert.match(stderr, /^verify:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});

test("verify: --entry followed by a flag-shaped token is refused, not taken as the entry name", async () => {
  await withTempDir(async (dir) => {
    const prgPath = join(dir, "game.prg");
    writeFileSync(prgPath, PRG_WITH_ILLEGAL_OPCODE);

    // The only flag-shaped token guaranteed not to trip
    // checkAcceptedOptions() ahead of parseArgs() is one already in verify's
    // own accepted set -- --entry itself, used here as a (nonsensical)
    // value for the first --entry.
    const { result: code, stderr } = await withCapturedConsole(() =>
      runR2000Cli(["verify", prgPath, "--entry", "--entry"]),
    );

    assert.notEqual(code, 0);
    assert.match(stderr, /^verify:/);
    assert.match(stderr, /--entry/);
    assert.match(stderr, /requires a value/);
  });
});
