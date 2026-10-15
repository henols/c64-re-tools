// The c64-knowledge script, run as the LLM runs it: in a project folder,
// with arguments, reading one JSON object from stdout.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

const script = resolve(import.meta.dirname, "../../skills/c64-knowledge/scripts/knowledge.ts");
const projects: string[] = [];
after(() => {
  for (const project of projects) rmSync(project, { recursive: true, force: true });
});

function project(): string {
  const root = mkdtempSync(join(tmpdir(), "c64-re-tools-skill-"));
  projects.push(root);
  return root;
}

function knowledge(root: string, ...args: string[]): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

test("reads in a project without knowledge answer empty and create nothing", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "at", "$2100").json, { address: "$2100", comments: [], referencesFrom: [], referencesTo: [], revision: 0 });
  assert.deepEqual(knowledge(root, "symbols").json, { symbols: [] });
  assert.deepEqual(knowledge(root, "revisions").json, { revisions: [] });
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("writes report their revision and the current value", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--reason", "reads joystick 2").json, {
    revision: 1,
    symbol: { address: "$2100", name: "update_player", kind: "routine", origin: "llm", revision: 1 },
  });
  assert.deepEqual(knowledge(root, "classify", "$3000", "$303f", "sprite", "--origin", "user").json, {
    revision: 2,
    regions: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: 2 }],
  });
  assert.equal(knowledge(root, "comment", "$2100", "side", "joystick", "2").json.revision, 3);
  assert.equal(knowledge(root, "reference", "$2000", "$2100", "call").json.revision, 4);
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player").json.revision, null, "no change, no revision");
  const revision = knowledge(root, "revision", "1").json as { revision: { description: string }; added: unknown[] };
  assert.equal(revision.revision.description, "reads joystick 2");
  assert.equal(revision.added.length, 1);
});

test("errors are JSON with a stable code and a non-zero exit", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "loop");
  const conflict = knowledge(root, "rename", "$2200", "loop");
  assert.equal(conflict.status, 1);
  assert.equal((conflict.json.error as { code: string }).code, "conflict");
  const stale = knowledge(root, "rename", "$2300", "other", "--expect-revision", "0");
  assert.equal((stale.json.error as { code: string }).code, "stale-revision");
  for (const args of [["at", "2100"], ["classify", "$1000", "$2000", "music"], ["rename", "$1000", "x", "--origin", "ghidra"], ["bogus"], ["at", "$1000", "--nope"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
  }
  assert.equal((knowledge(root, "remove-symbol", "$9999").json.error as { code: string }).code, "not-found");
});

test("a refused write in a project without knowledge creates no knowledge database", () => {
  const root = project();
  for (const args of [["rename", "2100", "loop"], ["classify", "$1000", "$2000", "music"], ["comment", "$2100", "middle", "text"], ["reference", "$2000", "$2100", "jump-to"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
    assert.equal(existsSync(join(root, ".c64-re-tools")), false, args.join(" "));
  }
});

test("refused writes of every kind create nothing, and the first accepted write creates the database", () => {
  const root = project();
  for (const args of [
    ["classify", "$1000", "$2000", "music"],
    ["rename", "$2100", "main", "--kind", "loop"],
    ["comment", "$2100"],
    ["rename", "$2100", "9lives"],
    ["remove-symbol", "$2100"],
    ["uncomment", "$2100", "line"],
    ["rename", "$2100", "main", "--expect-revision", "3"],
    ["revert", "7"],
  ]) {
    const result = knowledge(root, ...args);
    assert.notEqual(result.status, 0, args.join(" "));
    assert.ok(result.json.error !== undefined, args.join(" "));
  }
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
  assert.equal(knowledge(root, "rename", "$2100", "main").json.revision, 1);
  assert.equal(existsSync(join(root, ".c64-re-tools", "knowledge.db")), true);
});

test("a missing name or comment text is a usage error and creates no knowledge database", () => {
  const root = project();
  for (const args of [["rename", "$2100"], ["comment", "$2100", "line"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
  }
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("a write over a row of another origin prints the replaced row", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--origin", "user");
  assert.deepEqual(knowledge(root, "rename", "$2100", "move_player").json, {
    revision: 2,
    symbol: { address: "$2100", name: "move_player", kind: "routine", origin: "llm", revision: 2 },
    previous: { address: "$2100", name: "update_player", kind: "routine", origin: "user", revision: 1 },
  });
  knowledge(root, "classify", "$3000", "$303f", "sprite", "--origin", "user");
  assert.deepEqual(knowledge(root, "classify", "$3020", "$305f", "bytes").json, {
    revision: 4,
    regions: [{ start: "$3020", end: "$305f", type: "bytes", origin: "llm", revision: 4 }],
    previous: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: 3 }],
  });
});

test("a removal shows as a suppression with its reason, in at and in the history", () => {
  const root = project();
  knowledge(root, "rename", "$0408", "l0408");
  knowledge(root, "reference", "$0410", "$ef29", "jump");
  knowledge(root, "classify", "$0480", "$04ff", "bytes");
  knowledge(root, "remove-symbol", "$0408", "--reason", "not an entry");
  knowledge(root, "unreference", "$0410", "$ef29", "jump", "--reason", "the vector is written at run time");
  knowledge(root, "unclassify", "$0480", "$04ff");
  assert.deepEqual(knowledge(root, "suppressions").json, {
    suppressions: [
      { suppresses: "symbol", address: "$0408", origin: "llm", revision: 4, reason: "not an entry" },
      { suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", revision: 5, reason: "the vector is written at run time" },
      { suppresses: "region", start: "$0480", end: "$04ff", origin: "llm", revision: 6 },
    ],
  });
  assert.deepEqual(knowledge(root, "at", "$0408").json.suppressions, [{ suppresses: "symbol", address: "$0408", origin: "llm", revision: 4 }]);
  const history = knowledge(root, "history", "$0408").json.history as Array<Record<string, unknown>>;
  assert.deepEqual(history.at(-1), { entity: "suppression", suppresses: "symbol", address: "$0408", origin: "llm", fromRevision: 4, reason: "not an entry" }, "the history gives the reason of the revision (F-26)");
});

test("apply writes a batch from a file or standard input as one revision (D42)", () => {
  const root = project();
  writeFileSync(
    join(root, "batch.json"),
    JSON.stringify([
      { op: "rename", address: "$2100", name: "update_player", kind: "routine" },
      { op: "classify", start: "$3000", end: "$303b", type: "bytes", element: 6 },
    ]),
  );
  assert.deepEqual(knowledge(root, "apply", "batch.json", "--reason", "first names", "--evidence", "note:seen in the attract mode").json, { revision: 1, writes: 2, replaced: [] });
  const piped = spawnSync(process.execPath, [...process.execArgv, script, "apply", "-"], { cwd: root, encoding: "utf8", input: JSON.stringify([{ op: "comment", address: "$2100", placement: "line", text: "Reads joystick 2." }]) });
  assert.deepEqual(JSON.parse(piped.stdout), { revision: 2, writes: 1, replaced: [] });
  // A batch lists each row of another origin that it replaced, as previous does for one write (b2/07).
  knowledge(root, "rename", "$2200", "l2200", "--origin", "user");
  writeFileSync(join(root, "over.json"), JSON.stringify([{ op: "comment", address: "$2200", placement: "line", text: "x" }, { op: "rename", address: "$2200", name: "draw_cave" }]));
  assert.deepEqual(knowledge(root, "apply", "over.json").json.replaced, [{ write: 2, op: "rename", previous: { address: "$2200", name: "l2200", kind: "label", origin: "user", revision: 3 } }]);
  assert.deepEqual((knowledge(root, "regions").json.regions as unknown[])[0], { start: "$3000", end: "$303b", type: "bytes", element: 6, count: 10, origin: "llm", revision: 1 });
  const refused = knowledge(root, "apply", "batch.json", "--expect-revision", "1");
  assert.equal((refused.json.error as { code: string }).code, "stale-revision");
  writeFileSync(join(root, "bad.json"), JSON.stringify([{ op: "rename", address: "2100", name: "x" }]));
  assert.equal(knowledge(root, "apply", "bad.json").status, 2);
});

test("evidence names a project file with its SHA-256, and --origin filters the reads", () => {
  const root = project();
  mkdirSync(join(root, "coverage"));
  writeFileSync(join(root, "coverage", "attract.bin"), Buffer.from([4, 0, 4]));
  const written = knowledge(root, "rename", "$2100", "update_player", "--evidence", "coverage:coverage/attract.bin", "--origin", "user").json;
  const evidence = ((knowledge(root, "revision", String(written.revision)).json.revision as { evidence: unknown[] }).evidence);
  assert.deepEqual(evidence, [{ kind: "coverage", ref: "coverage/attract.bin", sha256: createHash("sha256").update(Buffer.from([4, 0, 4])).digest("hex") }]);
  assert.equal((knowledge(root, "rename", "$2200", "x", "--evidence", "coverage:coverage/missing.bin").json.error as { code: string }).code, "not-found");
  knowledge(root, "rename", "$2300", "helper");
  assert.deepEqual((knowledge(root, "symbols", "--origin", "user").json.symbols as Array<{ name: string }>).map((row) => row.name), ["update_player"]);
  assert.deepEqual((knowledge(root, "symbols", "--origin", "semantic").json.symbols as unknown[]).length, 2);
  assert.deepEqual(knowledge(root, "symbols", "--origin", "analyzer").json, { symbols: [] });
  assert.equal(knowledge(root, "symbols", "--origin", "robot").status, 2);
});

test("export writes all current knowledge to a project file and answers with counts", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "update_player");
  knowledge(root, "classify", "$3000", "$303f", "sprite");
  const exported = knowledge(root, "export", "--out", "exports/knowledge.json").json;
  assert.deepEqual({ ...exported, bytes: undefined }, { out: "exports/knowledge.json", bytes: undefined, counts: { symbols: 1, regions: 1, comments: 0, references: 0, suppressions: 0, modules: 0, operands: 0 }, revision: 2 });
  const file = JSON.parse(readFileSync(join(root, "exports", "knowledge.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols[0]!.name, "update_player");
  assert.equal(knowledge(root, "export").status, 2, "export needs --out");
});

test("module records where a file of generated source starts, and modules lists them (D48)", () => {
  const root = project();
  const set = knowledge(root, "module", "$0801", "boot.asm", "--title", "BASIC start");
  assert.equal(set.status, 0, JSON.stringify(set.json));
  assert.deepEqual(set.json, { revision: 1, module: { start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", revision: 1 } });
  assert.deepEqual(knowledge(root, "modules").json, { modules: [{ start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", revision: 1 }] });
  assert.equal(knowledge(root, "module", "$1000", "sub/x.asm").status, 1);
  assert.equal(knowledge(root, "rename", "$1000", "x", "--title", "T").status, 2, "--title is for module only");
  assert.equal(knowledge(root, "unmodule", "$0801").json.revision, 2);
  assert.deepEqual(knowledge(root, "history", "$0801").json.history, [{ entity: "module", start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", fromRevision: 1, toRevision: 2 }]);
});

test("--space keeps drive code and cartridge banks apart from the C64 (D53)", () => {
  const root = project();
  assert.equal(knowledge(root, "rename", "$0500", "loop").status, 0);
  const drive = knowledge(root, "rename", "$0500", "loop", "--space", "drive8");
  assert.equal(drive.status, 0, JSON.stringify(drive.json));
  assert.deepEqual(drive.json.symbol, { space: "drive8", address: "$0500", name: "loop", kind: "label", origin: "llm", revision: 2 });
  writeFileSync(join(root, "bank.json"), JSON.stringify([{ op: "classify", start: "$8000", end: "$80ff", type: "bytes" }, { op: "rename", address: "$8000", name: "cart_start", space: "bank1" }]));
  assert.equal(knowledge(root, "apply", "bank.json", "--space", "bank0").status, 0);
  assert.deepEqual(knowledge(root, "spaces").json, { spaces: ["c64", "drive8", "bank0", "bank1"] });
  assert.deepEqual((knowledge(root, "at", "$0500", "--space", "drive8").json as { space: string; symbol: { name: string } }).space, "drive8");
  assert.equal((knowledge(root, "regions", "--space", "bank0").json.regions as unknown[]).length, 1);
  assert.equal((knowledge(root, "regions").json.regions as unknown[]).length, 0, "the C64 has no region");
  assert.equal((knowledge(root, "symbols", "--space", "bank1").json.symbols as Array<{ name: string }>)[0]!.name, "cart_start");
  assert.equal(knowledge(root, "symbols", "--space", "drive9").status, 2);
});

test("operand writes an expression after a check against the image, and at and operands show it (D65)", () => {
  const root = project();
  // $8079 LDA #$c0 / STA $0314 / LDA #$80
  writeFileSync(join(root, "game.prg"), Buffer.from([0x79, 0x80, 0xa9, 0xc0, 0x8d, 0x14, 0x03, 0xa9, 0x80]));
  knowledge(root, "rename", "$80c0", "irq_handler");
  assert.equal(knowledge(root, "operand", "$8079", "--lo", "irq_handler").status, 2, "operand needs --image");
  assert.equal(knowledge(root, "operand", "$8079", "--lo", "irq_handler", "--hi", "irq_handler", "--image", "game.prg").status, 2, "one selector only");
  assert.deepEqual(knowledge(root, "operand", "$8079", "--lo", "irq_handler", "--image", "game.prg").json, {
    revision: 2,
    operand: { address: "$8079", select: "lo", symbol: "irq_handler", text: "<irq_handler", origin: "llm", revision: 2 },
  });
  const refused = knowledge(root, "operand", "$807e", "--lo", "irq_handler", "--image", "game.prg");
  assert.equal(refused.status, 1);
  assert.match((refused.json.error as { message: string }).message, /<irq_handler gives \$c0, but the operand in the image is \$80/);
  assert.equal(knowledge(root, "operand", "$807b", "--value", "CINV", "--offset=0", "--image", "game.prg").json.revision, 3, "a platform name");
  writeFileSync(join(root, "batch.json"), JSON.stringify([{ op: "operand", address: "$807e", select: "expr", expression: ">irq_handler" }]));
  assert.equal(knowledge(root, "apply", "batch.json").status, 2, "apply with operand writes needs --image");
  assert.equal(knowledge(root, "apply", "batch.json", "--image", "game.prg").json.revision, 4);
  const known = knowledge(root, "at", "$807e").json as { operand: { text: string }; referencesFrom: Array<{ to: string; kind: string }> };
  assert.equal(known.operand.text, ">irq_handler");
  assert.deepEqual(known.referencesFrom.map((row) => [row.to, row.kind]), [["$80c0", "pointer"]]);
  assert.deepEqual((knowledge(root, "operands").json.operands as Array<{ address: string }>).map((row) => row.address), ["$8079", "$807b", "$807e"]);
  assert.equal(knowledge(root, "remove-symbol", "$80c0").status, 1, "the operands use it");
  assert.equal(knowledge(root, "unoperand", "$807e").json.revision, 5);
});
