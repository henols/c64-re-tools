// The c64-knowledge script, run as the LLM runs it: in a project folder,
// with arguments, reading one JSON object from stdout.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";

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

/** The items of a list in a result: {count, listed, rest?}. */
function items<T = Record<string, unknown>>(list: unknown): T[] {
  return (list as { listed: T[] }).listed;
}

/** The id of the n-th revision of the project, oldest first. */
function rev(root: string, n: number): string {
  const listed = items<{ id: string }>(knowledge(root, "revisions", "--max-listed", "1000").json.revisions);
  const id = listed.at(-n)?.id;
  assert.ok(id !== undefined, `the project has no revision ${n}`);
  return id;
}

function knowledge(root: string, ...args: string[]): { status: number | null; json: Record<string, unknown> } {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(run.stderr, "", run.stderr);
  return { status: run.status, json: JSON.parse(run.stdout) as Record<string, unknown> };
}

test("reads in a project without knowledge answer empty and create nothing", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "at", "$2100").json, { address: "$2100", comments: [], referencesFrom: [], referencesTo: [], revision: "0" });
  assert.deepEqual(knowledge(root, "symbols").json, { symbols: { count: 0, listed: [] } });
  assert.deepEqual(knowledge(root, "revisions").json, { revisions: { count: 0, listed: [] } });
  assert.equal(existsSync(join(root, ".c64-re-tools")), false);
});

test("writes report their revision and the current value", () => {
  const root = project();
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--reason", "reads joystick 2").json, {
    revision: rev(root, 1),
    symbol: { address: "$2100", name: "update_player", kind: "routine", origin: "llm", revision: rev(root, 1) },
  });
  assert.deepEqual(knowledge(root, "classify", "$3000-$303f", "sprite", "--by", "user").json, {
    revision: rev(root, 2),
    regions: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: rev(root, 2) }],
  });
  assert.equal(knowledge(root, "comment", "$2100", "side", "joystick", "2").json.revision, rev(root, 3));
  assert.equal(knowledge(root, "reference", "$2000", "$2100", "call").json.revision, rev(root, 4));
  assert.deepEqual(knowledge(root, "rename", "$2100", "update_player").json.revision, null, "no change, no revision");
  const revision = knowledge(root, "revision", rev(root, 1)).json as { revision: { description: string }; added: { count: number } };
  assert.equal(revision.revision.description, "reads joystick 2");
  assert.equal(revision.added.count, 1);
});

test("errors are JSON with a stable code and a non-zero exit", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "loop");
  const conflict = knowledge(root, "rename", "$2200", "loop");
  assert.equal(conflict.status, 2);
  assert.equal((conflict.json.error as { code: string }).code, "conflict");
  const stale = knowledge(root, "rename", "$2300", "other", "--expect-revision", "0");
  assert.equal((stale.json.error as { code: string }).code, "stale-revision");
  for (const args of [["at", "2100"], ["classify", "$1000-$2000", "music"], ["rename", "$1000", "x", "--by", "ghidra"], ["bogus"], ["at", "$1000", "--nope"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
  }
  assert.equal((knowledge(root, "remove-symbol", "$9999").json.error as { code: string }).code, "not-found");
});

test("a refused write in a project without knowledge creates no knowledge", () => {
  const root = project();
  for (const args of [["rename", "2100", "loop"], ["classify", "$1000-$2000", "music"], ["comment", "$2100", "middle", "text"], ["reference", "$2000", "$2100", "jump-to"]]) {
    const result = knowledge(root, ...args);
    assert.equal(result.status, 2, args.join(" "));
    assert.equal((result.json.error as { code: string }).code, "invalid-input");
    assert.equal(existsSync(join(root, ".c64-re-tools")), false, args.join(" "));
  }
});

test("refused writes of every kind create nothing, and the first accepted write creates the knowledge", () => {
  const root = project();
  for (const args of [
    ["classify", "$1000-$2000", "music"],
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
  assert.equal(knowledge(root, "rename", "$2100", "main").json.revision, rev(root, 1));
  assert.equal(existsSync(join(root, ".c64-re-tools", "knowledge", "symbols.jsonl")), true);
});

test("a missing name or comment text is a usage error and creates no knowledge", () => {
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
  knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--by", "user");
  assert.deepEqual(knowledge(root, "rename", "$2100", "move_player").json, {
    revision: rev(root, 2),
    symbol: { address: "$2100", name: "move_player", kind: "routine", origin: "llm", revision: rev(root, 2) },
    previous: { address: "$2100", name: "update_player", kind: "routine", origin: "user", revision: rev(root, 1) },
  });
  knowledge(root, "classify", "$3000-$303f", "sprite", "--by", "user");
  assert.deepEqual(knowledge(root, "classify", "$3020-$305f", "bytes").json, {
    revision: rev(root, 4),
    regions: [{ start: "$3020", end: "$305f", type: "bytes", origin: "llm", revision: rev(root, 4) }],
    previous: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: rev(root, 3) }],
  });
});

test("a removal shows as a suppression with its reason, in at and in the history", () => {
  const root = project();
  knowledge(root, "rename", "$0408", "l0408");
  knowledge(root, "reference", "$0410", "$ef29", "jump");
  knowledge(root, "classify", "$0480-$04ff", "bytes");
  knowledge(root, "remove-symbol", "$0408", "--reason", "not an entry");
  knowledge(root, "unreference", "$0410", "$ef29", "jump", "--reason", "the vector is written at run time");
  knowledge(root, "unclassify", "$0480-$04ff");
  assert.deepEqual(knowledge(root, "suppressions").json, {
    // A removal of a name writes no suppression.
    suppressions: {
      count: 2,
      listed: [
        { suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", revision: rev(root, 5), reason: "the vector is written at run time" },
        { suppresses: "region", start: "$0480", end: "$04ff", origin: "llm", revision: rev(root, 6) },
      ],
    },
  });
  assert.deepEqual(knowledge(root, "suppressions", "--max-listed", "1").json.suppressions, {
    count: 2,
    listed: [{ suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", revision: rev(root, 5), reason: "the vector is written at run time" }],
    rest: "a larger --max-listed, a smaller --range, or knowledge.ts export --out <file> for all current knowledge",
  });
  assert.equal(knowledge(root, "at", "$0408").json.suppressions, undefined);
  assert.deepEqual(knowledge(root, "at", "$0480").json.suppressions, [{ suppresses: "region", start: "$0480", end: "$04ff", origin: "llm", revision: rev(root, 6) }]);
  const history = items(knowledge(root, "history", "$0410").json.history);
  assert.deepEqual(history.at(-1), { entity: "suppression", suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", fromRevision: rev(root, 5), reason: "the vector is written at run time" }, "the history gives the reason of the revision");
});

test("apply writes a batch from a file or standard input as one revision", () => {
  const root = project();
  writeFileSync(
    join(root, "batch.json"),
    JSON.stringify([
      { op: "rename", address: "$2100", name: "update_player", kind: "routine" },
      { op: "classify", start: "$3000", end: "$303b", type: "bytes", element: 6 },
    ]),
  );
  assert.deepEqual(knowledge(root, "apply", "batch.json", "--reason", "first names", "--evidence", "note:seen in the attract mode").json, { revision: rev(root, 1), writes: 2, replaced: [] });
  const piped = spawnSync(process.execPath, [...process.execArgv, script, "apply", "-"], { cwd: root, encoding: "utf8", input: JSON.stringify([{ op: "comment", address: "$2100", placement: "line", text: "Reads joystick 2." }]) });
  assert.deepEqual(JSON.parse(piped.stdout), { revision: rev(root, 2), writes: 1, replaced: [] });
  // A batch lists each row of another origin that it replaced, as previous does for one write.
  knowledge(root, "rename", "$2200", "l2200", "--by", "user");
  writeFileSync(join(root, "over.json"), JSON.stringify([{ op: "comment", address: "$2200", placement: "line", text: "x" }, { op: "rename", address: "$2200", name: "draw_cave" }]));
  assert.deepEqual(knowledge(root, "apply", "over.json").json.replaced, [{ write: 2, op: "rename", previous: { address: "$2200", name: "l2200", kind: "label", origin: "user", revision: rev(root, 3) } }]);
  assert.deepEqual(items(knowledge(root, "regions").json.regions)[0], { start: "$3000", end: "$303b", type: "bytes", element: 6, count: 10, origin: "llm", revision: rev(root, 1) });
  const refused = knowledge(root, "apply", "batch.json", "--expect-revision", rev(root, 1));
  assert.equal((refused.json.error as { code: string }).code, "stale-revision");
  writeFileSync(join(root, "bad.json"), JSON.stringify([{ op: "rename", address: "2100", name: "x" }]));
  assert.equal(knowledge(root, "apply", "bad.json").status, 2);
});

test("evidence names a project file with its SHA-256, and --origin filters the reads", () => {
  const root = project();
  mkdirSync(join(root, "coverage"));
  writeFileSync(join(root, "coverage", "attract.bin"), Buffer.from([4, 0, 4]));
  const written = knowledge(root, "rename", "$2100", "update_player", "--evidence", "file:coverage/attract.bin", "--by", "user").json;
  const evidence = ((knowledge(root, "revision", String(written.revision)).json.revision as { evidence: unknown[] }).evidence);
  assert.deepEqual(evidence, [{ kind: "file", ref: "coverage/attract.bin", sha256: createHash("sha256").update(Buffer.from([4, 0, 4])).digest("hex") }]);
  assert.equal((knowledge(root, "rename", "$2200", "x", "--evidence", "file:coverage/missing.bin").json.error as { code: string }).code, "not-found");
  // Scratch in local/ is no evidence, also through a path that only resolves into it.
  mkdirSync(join(root, ".c64-re-tools", "local", "runs", "rooms"), { recursive: true });
  writeFileSync(join(root, ".c64-re-tools", "local", "runs", "rooms", "results.json"), "{}");
  for (const ref of [".c64-re-tools/local/runs/rooms/results.json", "coverage/../.c64-re-tools/local/runs/rooms/results.json"]) {
    const refused = knowledge(root, "rename", "$2200", "x", "--evidence", `test:${ref}`);
    assert.equal(refused.status, 2);
    assert.match((refused.json.error as { message: string }).message, /runs\/<name>\//);
  }
  assert.deepEqual(items<{ name: string }>(knowledge(root, "symbols").json.symbols).filter((row) => row.name === "x"), []);
  knowledge(root, "rename", "$2300", "helper");
  assert.deepEqual(items<{ name: string }>(knowledge(root, "symbols", "--origin", "user").json.symbols).map((row) => row.name), ["update_player"]);
  assert.deepEqual(items(knowledge(root, "symbols", "--origin", "semantic").json.symbols).length, 2);
  assert.deepEqual(knowledge(root, "symbols", "--origin", "analyzer").json, { symbols: { count: 0, listed: [] } });
  const robot = knowledge(root, "symbols", "--origin", "robot");
  assert.equal(robot.status, 2);
  assert.match((robot.json.error as { message: string }).message, /^--origin cannot be "robot"\. Give one of user, llm, dxa, ghidra, heuristic, semantic or analyzer, or a comma list of them\. semantic is user and llm\. analyzer is dxa, ghidra and heuristic\n/);
});

test("image puts a capture into the knowledge, and coverage joins maps that are evidence by their path", () => {
  const root = project();
  const capture = join(root, ".c64-re-tools", "local", "capture");
  mkdirSync(capture, { recursive: true });
  const memory = Buffer.alloc(0x10000);
  memory.fill(0xea, 0x0400, 0x04ff);
  writeFileSync(join(capture, "image.bin"), memory);
  writeFileSync(join(capture, "image.json"), JSON.stringify({ entry: "$0400", segments: [{ start: "$0400", end: "$04ff" }], stages: [{ stage: 0, entry: "$0871" }], image: "image.bin" }));
  const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
  const state = { registers: { pc: "$0400", a: 0, x: 0, y: 0, sp: 0xf6, flags: { i: true } }, cpuPort: { $00: 0x2f, $01: 0x37 }, pages };
  writeFileSync(join(capture, "entry_state.json"), JSON.stringify({ ...state, differsFromReset: [] }));
  const imported = knowledge(root, "image", ".c64-re-tools/local/capture/image.json", "--reason", "the capture");
  assert.equal(imported.status, 0);
  assert.deepEqual({ ...imported.json, revision: undefined }, { revision: undefined, bytes: 256, rowsAdded: 4, rowsClosed: 0, entryChanged: true });
  const entry = readFileSync(join(root, ".c64-re-tools", "knowledge", "entry.jsonl"), "utf8");
  assert.match(entry, /"state":\{"registers":\{"pc":"\$0400","a":0,"x":0,"y":0,"sp":246,"flags":\{"i":true\}\},"cpuPort":/);
  assert.doesNotMatch(entry, /differsFromReset/, "the comparison with a clean reset stays in the capture");
  assert.equal(knowledge(root, "image", ".c64-re-tools/local/capture/image.json").json.revision, null);

  const run = new Uint8Array(0x10000);
  run[0x0400] = COVERAGE.ramExecute;
  writeFileSync(join(capture, "attract.bin"), run);
  const joined = knowledge(root, "coverage", ".c64-re-tools/local/capture/attract.bin");
  assert.deepEqual(joined.json.imported, [".c64-re-tools/local/capture/attract.bin"]);
  assert.equal(joined.json.ranges, 1);
  const cited = knowledge(root, "rename", "$0400", "start", "--evidence", "coverage:.c64-re-tools/local/capture/attract.bin");
  assert.equal(cited.status, 0);
  const evidence = (knowledge(root, "revision", String(cited.json.revision)).json.revision as { evidence: Array<{ kind: string; ref: string }> }).evidence;
  assert.deepEqual(evidence.map((item) => [item.kind, item.ref]), [["coverage", ".c64-re-tools/local/capture/attract.bin"]]);
  const unknown = knowledge(root, "rename", "$0401", "x", "--evidence", "coverage:other.bin");
  assert.equal(unknown.status, 2);
  assert.match((unknown.json.error as { message: string }).message, /import the map with coverage first/);
  assert.equal(knowledge(root, "coverage").status, 2);
  assert.deepEqual(knowledge(root, "program").json, {
    image: { segments: [{ start: "$0400", end: "$04ff" }], bytes: 256, entry: "$0400", state: true, stages: 1 },
    coverage: { maps: [".c64-re-tools/local/capture/attract.bin"], ranges: { x: 1 } },
  });
  writeFileSync(join(capture, "short.prg"), Buffer.from([0x00, 0x04]));
  assert.equal(knowledge(root, "image", ".c64-re-tools/local/capture/short.prg").status, 2);
  // A JSON value that is no object, as the file or as a segment or a stage, is no image.json.
  for (const [content, what] of [
    ["null", /it is not a JSON object/],
    ["[]", /it is not a JSON object/],
    [JSON.stringify({ image: "image.bin", segments: [null] }), /segment 1 is not an object/],
    [JSON.stringify({ image: "image.bin", segments: [{ start: "$0400", end: "$04ff" }], stages: [7] }), /stage 1 is not an object/],
  ] as const) {
    writeFileSync(join(capture, "bad.json"), content);
    const bad = knowledge(root, "image", ".c64-re-tools/local/capture/bad.json");
    assert.equal(bad.status, 2, content);
    assert.match((bad.json.error as { message: string }).message, what);
  }
});

test("coverage imports a map into each space, by one spelling of its path, and --evidence cites the latest import in the space of the write", () => {
  const root = project();
  const runs = join(root, "runs");
  mkdirSync(runs);
  const run = new Uint8Array(0x10000);
  run[0x0400] = COVERAGE.ramExecute;
  writeFileSync(join(runs, "m.bin"), run);
  const sha = () => createHash("sha256").update(readFileSync(join(runs, "m.bin"))).digest("hex");
  const first = sha();
  assert.deepEqual(knowledge(root, "coverage", "runs/m.bin").json.imported, ["runs/m.bin"]);
  assert.deepEqual(knowledge(root, "coverage", "./runs/m.bin").json.known, ["runs/m.bin"], "./runs/m.bin is the same map");
  const drive = knowledge(root, "coverage", "runs/m.bin", "--space", "drive8");
  assert.deepEqual(drive.json.imported, ["runs/m.bin"], "the map is not yet in drive8");
  assert.equal(drive.json.ranges, 1);

  // The map changes and is imported again: the evidence is the new import.
  run[0x0500] = COVERAGE.ramRead;
  writeFileSync(join(runs, "m.bin"), run);
  assert.deepEqual(knowledge(root, "coverage", "runs/m.bin").json.imported, ["runs/m.bin"]);
  const evidenceOf = (...args: string[]) => {
    const cited = knowledge(root, "rename", "$0400", "start", ...args);
    assert.equal(cited.status, 0, JSON.stringify(cited.json));
    return (knowledge(root, "revision", String(cited.json.revision)).json.revision as { evidence: Array<{ ref: string; sha256: string; space: string }> }).evidence;
  };
  assert.deepEqual(evidenceOf("--evidence", "coverage:./runs/m.bin"), [{ kind: "coverage", ref: "runs/m.bin", sha256: sha() }]);
  assert.deepEqual(evidenceOf("--evidence", "coverage:runs/m.bin", "--space", "drive8"), [{ kind: "coverage", ref: "runs/m.bin", sha256: first, space: "drive8" }]);
  const missing = knowledge(root, "rename", "$0400", "x", "--evidence", "coverage:runs/m.bin", "--space", "bank1");
  assert.equal(missing.status, 2);
  assert.match((missing.json.error as { message: string }).message, /no coverage map of the knowledge in bank1: import the map with coverage --space bank1 first/);
  assert.deepEqual((knowledge(root, "program").json.coverage as { maps: string[] }).maps, ["runs/m.bin"]);
});

test("export writes all current knowledge to a project file and answers with counts", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "update_player");
  knowledge(root, "classify", "$3000-$303f", "sprite");
  const exported = knowledge(root, "export", "--out", "exports/knowledge.json").json;
  assert.match(String(exported.sha256), /^[0-9a-f]{64}$/);
  assert.deepEqual({ ...exported, bytes: undefined, sha256: undefined }, { out: "exports/knowledge.json", bytes: undefined, sha256: undefined, counts: { symbols: 1, analyzerNames: 0, regions: 1, comments: 0, references: 0, suppressions: 0, modules: 0, operands: 0, patches: 0, macros: 0, macroUses: 0 }, revision: rev(root, 2) });
  const file = JSON.parse(readFileSync(join(root, "exports", "knowledge.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols[0]!.name, "update_player");
  assert.equal(knowledge(root, "export").status, 2, "export needs --out");
});

test("module records where a file of generated source starts, and modules lists them", () => {
  const root = project();
  const set = knowledge(root, "module", "$0801", "boot.asm", "--title", "BASIC start");
  assert.equal(set.status, 0, JSON.stringify(set.json));
  assert.deepEqual(set.json, { revision: rev(root, 1), module: { start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", revision: rev(root, 1) } });
  assert.deepEqual(knowledge(root, "modules").json, { modules: { count: 1, listed: [{ start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", revision: rev(root, 1) }] } });
  assert.equal(knowledge(root, "module", "$1000", "sub/x.asm").status, 2);
  assert.equal(knowledge(root, "rename", "$1000", "x", "--title", "T").status, 2, "--title is for module only");
  assert.equal(knowledge(root, "unmodule", "$0801").json.revision, rev(root, 2));
  assert.deepEqual(items(knowledge(root, "history", "$0801").json.history), [{ entity: "module", start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", fromRevision: rev(root, 1), toRevision: rev(root, 2) }]);
});

test("--space keeps drive code and cartridge banks apart from the C64", () => {
  const root = project();
  assert.equal(knowledge(root, "rename", "$0500", "loop").status, 0);
  const drive = knowledge(root, "rename", "$0500", "loop", "--space", "drive8");
  assert.equal(drive.status, 0, JSON.stringify(drive.json));
  assert.deepEqual(drive.json.symbol, { space: "drive8", address: "$0500", name: "loop", kind: "label", origin: "llm", revision: rev(root, 2) });
  writeFileSync(join(root, "bank.json"), JSON.stringify([{ op: "classify", start: "$8000", end: "$80ff", type: "bytes" }, { op: "rename", address: "$8000", name: "cart_start", space: "bank1" }]));
  assert.equal(knowledge(root, "apply", "bank.json", "--space", "bank0").status, 0);
  assert.deepEqual(knowledge(root, "spaces").json, { spaces: { count: 4, listed: ["c64", "drive8", "bank0", "bank1"] } });
  assert.deepEqual((knowledge(root, "at", "$0500", "--space", "drive8").json as { space: string; symbol: { name: string } }).space, "drive8");
  assert.equal(items(knowledge(root, "regions", "--space", "bank0").json.regions).length, 1);
  assert.equal(items(knowledge(root, "regions").json.regions).length, 0, "the C64 has no region");
  assert.equal(items<{ name: string }>(knowledge(root, "symbols", "--space", "bank1").json.symbols)[0]!.name, "cart_start");
  assert.equal(knowledge(root, "symbols", "--space", "drive9").status, 2);
});

test("operand writes an expression after a check against the program in the knowledge, and at and operands show it", () => {
  const root = project();
  // $8079 LDA #$c0 / STA $0314 / LDA #$80
  writeFileSync(join(root, "game.prg"), Buffer.from([0x79, 0x80, 0xa9, 0xc0, 0x8d, 0x14, 0x03, 0xa9, 0x80]));
  knowledge(root, "rename", "$80c0", "irq_handler");
  const without = knowledge(root, "operand", "$8079", "--lo", "irq_handler");
  assert.equal(without.status, 2, "operand needs the program in the knowledge");
  assert.match((without.json.error as { message: string }).message, /knowledge\.ts image/);
  assert.equal(knowledge(root, "image", "game.prg").json.revision, rev(root, 2));
  // The operand byte of an instruction is no instruction start, also when the expression gives its value.
  const inside = knowledge(root, "operand", "$807a", "--expr", "$c0");
  assert.equal(inside.status, 2);
  assert.match((inside.json.error as { message: string }).message, /\$807a is in no code region, so the knowledge does not know an instruction that starts there\. Classify the code/);
  assert.equal(knowledge(root, "classify", "$8079-$8080", "code").json.revision, rev(root, 3));
  assert.deepEqual(knowledge(root, "operand", "$807a", "--expr", "$c0").json.error, {
    code: "invalid-input",
    message: "$807a is not the start of an instruction. It is an operand byte of the instruction at $8079, decoded from the start of the code region at $8079. Give $8079.",
  });
  assert.equal(knowledge(root, "operand", "$8079", "--lo", "irq_handler", "--hi", "irq_handler").status, 2, "one selector only");
  assert.deepEqual(knowledge(root, "operand", "$8079", "--lo", "irq_handler").json, {
    revision: rev(root, 4),
    operand: { address: "$8079", select: "lo", symbol: "irq_handler", text: "<irq_handler", origin: "llm", revision: rev(root, 4) },
  });
  const refused = knowledge(root, "operand", "$807e", "--lo", "irq_handler");
  assert.equal(refused.status, 2);
  assert.match((refused.json.error as { message: string }).message, /<irq_handler gives \$c0, but the operand in the image is \$80/);
  assert.equal(knowledge(root, "operand", "$807b", "--value", "CINV", "--offset=0").json.revision, rev(root, 5), "a platform name");
  writeFileSync(join(root, "batch.json"), JSON.stringify([{ op: "operand", address: "$807e", select: "expr", expression: ">irq_handler" }]));
  assert.equal(knowledge(root, "apply", "batch.json").json.revision, rev(root, 6));
  const known = knowledge(root, "at", "$807e").json as { operand: { text: string }; referencesFrom: Array<{ to: string; kind: string }> };
  assert.equal(known.operand.text, ">irq_handler");
  assert.deepEqual(known.referencesFrom.map((row) => [row.to, row.kind]), [["$80c0", "pointer"]]);
  assert.deepEqual(items<{ address: string }>(knowledge(root, "operands").json.operands).map((row) => row.address), ["$8079", "$807b", "$807e"]);
  assert.equal(knowledge(root, "remove-symbol", "$80c0").status, 2, "the operands use it");
  assert.equal(knowledge(root, "unoperand", "$807e").json.revision, rev(root, 7));
});

test("a command takes a start of a revision id that only one revision has, and 0 for the knowledge before every revision", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "main", "--reason", "the entry");
  knowledge(root, "rename", "$2100", "start");
  const first = rev(root, 1);
  assert.match(first, /^\d{8}T\d{6}\.\d{3}-[0-9a-z]{6}$/);
  assert.equal(((knowledge(root, "revision", first.slice(0, 26)).json.revision as { description: string }).description), "the entry", "the date, the time and part of the random characters");
  const ambiguous = knowledge(root, "revision", first.slice(0, 8));
  assert.equal(ambiguous.status, 2);
  assert.match((ambiguous.json.error as { message: string }).message, /is the start of more than one revision/);
  assert.equal(knowledge(root, "revert", first.slice(0, 26)).status, 0);
  assert.equal((knowledge(root, "at", "$2100").json.symbol as { name: string }).name, "main");
  assert.equal(knowledge(root, "revert", "0").status, 0);
  assert.equal(knowledge(root, "at", "$2100").json.symbol, undefined);
  assert.equal(items<{ id: string }>(knowledge(root, "revisions", "--before", rev(root, 2)).json.revisions).map((row) => row.id).join(), first);
  assert.deepEqual(knowledge(root, "revision", "0").json, { revision: { id: "0", operation: "none", description: "The knowledge before every revision. It is empty." }, added: { count: 0, listed: [] }, closed: { count: 0, listed: [] } });
  // A revert keeps the revision that it restored.
  assert.equal((knowledge(root, "revision", rev(root, 4)).json.revision as { restores: string }).restores, "0");
  const help = String(knowledge(root, "revert", "--help").json.text);
  assert.match(help, /Makes the knowledge the same as at one revision\. The revert is a new revision/);
  assert.doesNotMatch(help, /Undoes one revision/);
});

test("patch, macro and use write the source knowledge, and patches, switches, macros, uses, at and history read it", () => {
  const root = project();
  // $8100 INC $fb / BNE +2 / INC $fc / LDA #$00 / STA $d020
  writeFileSync(join(root, "game.prg"), Buffer.from([0x00, 0x81, 0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xa9, 0x00, 0x8d, 0x20, 0xd0]));
  assert.equal(knowledge(root, "patch", "$8106-$810a", "CRACK", "--nop").status, 2, "patch needs the program in the knowledge");
  assert.equal(knowledge(root, "patch", "$8106-$810a", "CRACK").status, 2, "patch needs --code, --code-file or --nop");
  assert.equal(knowledge(root, "patch", "$8106-$810a", "CRACK", "--nop", "--code", "nop").status, 2, "only one of them");
  assert.equal(knowledge(root, "rename", "$8106", "x", "--code", "nop").status, 2, "--code works only with patch");
  assert.equal(existsSync(join(root, ".c64-re-tools")), false, "a refused write creates no knowledge");

  assert.equal(knowledge(root, "image", "game.prg").json.revision, rev(root, 1));
  writeFileSync(join(root, "crack.asm"), "  lda #1\n  sta $d020\n");
  assert.deepEqual(knowledge(root, "patch", "$8106-$810a", "CRACK", "--code-file", "crack.asm", "--comment", "A white border.").json, {
    revision: rev(root, 2),
    patch: { start: "$8106", end: "$810a", bytes: 5, switch: "CRACK", code: "  lda #1\n  sta $d020", comment: "A white border.", origin: "llm", revision: rev(root, 2) },
  });
  assert.equal(knowledge(root, "patch", "$8100-$8101", "DEBUG", "--nop").status, 0);
  assert.deepEqual(knowledge(root, "switches").json, {
    switches: {
      count: 2,
      listed: [
        { name: "CRACK", define: "--define CRACK=1", patches: [{ start: "$8106", end: "$810a" }] },
        { name: "DEBUG", define: "--define DEBUG=1", patches: [{ start: "$8100", end: "$8101" }] },
      ],
    },
  });
  assert.deepEqual(items<{ code: string }>(knowledge(root, "patches", "--switch", "DEBUG").json.patches).map((row) => row.code), [""]);
  assert.equal(knowledge(root, "unpatch", "$8100").json.revision, rev(root, 4));

  knowledge(root, "rename", "$00fb", "ptr");
  assert.equal(knowledge(root, "macro", "inc16", "--params", "dst", "--body", "inc .dst\nbne +\ninc .dst+1\n+", "--comment", "Adds 1.").json.revision, rev(root, 6));
  assert.deepEqual(knowledge(root, "use", "$8100-$8105", "inc16", "--args", "ptr").json, {
    revision: rev(root, 7),
    use: { start: "$8100", end: "$8105", macro: "inc16", args: ["ptr"], text: "+inc16 ptr", origin: "llm", revision: rev(root, 7) },
  });
  const known = knowledge(root, "at", "$8103").json as { macroUse: { text: string }; patch?: unknown };
  assert.equal(known.macroUse.text, "+inc16 ptr");
  assert.equal((knowledge(root, "at", "$8108").json as { patch: { switch: string } }).patch.switch, "CRACK");
  assert.deepEqual(items<{ name: string; params: string[] }>(knowledge(root, "macros").json.macros).map((row) => [row.name, row.params]), [["inc16", ["dst"]]]);
  assert.deepEqual(items<{ start: string }>(knowledge(root, "uses", "--macro", "inc16").json.uses).map((row) => row.start), ["$8100"]);
  assert.deepEqual(items<{ entity: string }>(knowledge(root, "history", "--macro", "inc16").json.history).map((row) => row.entity), ["macro", "macro-use"]);
  assert.equal(knowledge(root, "unmacro", "inc16").status, 2, "the macro has a use");

  writeFileSync(join(root, "batch.json"), JSON.stringify([
    { op: "unuse", start: "$8100" },
    { op: "macro", name: "inc16", params: "dst", body: "inc .dst\nbne +\ninc .dst+1\n+" },
    { op: "use", start: "$8100", end: "$8105", macro: "inc16", args: ["$fb"] },
    { op: "patch", start: "$8106", end: "$810a", switch: "CRACK", code: "  lda #2\n  sta $d020" },
  ]));
  const applied = knowledge(root, "apply", "batch.json").json as { writes: number; replaced: unknown[] };
  assert.equal(applied.writes, 4);
  assert.deepEqual((knowledge(root, "export", "--out", "k.json").json as { counts: Record<string, number> }).counts, { symbols: 1, analyzerNames: 0, regions: 0, comments: 0, references: 0, suppressions: 0, modules: 0, operands: 0, patches: 1, macros: 1, macroUses: 1 });
});

test("join makes one batch of the batches of parallel agents, and apply writes it as one revision", () => {
  const root = project();
  // The Bruce Lee run: each agent named its own range; batch b owns $1000-$1fff.
  writeFileSync(join(root, "a.json"), JSON.stringify({ owner: { start: "$0200", end: "$0fff" }, ops: [{ op: "rename", address: "$0400", name: "cold_start", kind: "routine" }, { op: "rename", address: "$1000", name: "draw_room_a" }, { op: "operand", address: "$0400", select: "lo", symbol: "draw_room_a" }] }));
  writeFileSync(join(root, "b.json"), JSON.stringify({ owner: { start: "$1000", end: "$1fff" }, ops: [{ op: "rename", address: "$1000", name: "draw_room", kind: "routine" }, { op: "comment", address: "$1000", placement: "line", text: "Draws the room." }] }));
  writeFileSync(join(root, "c.json"), JSON.stringify([{ op: "rename", address: "$2000", name: "cold_start" }]));
  const joined = knowledge(root, "join", "a.json", "b.json", "--out", "joined.json");
  assert.equal(joined.status, 0, JSON.stringify(joined.json));
  assert.deepEqual({ ...joined.json, bytes: undefined, sha256: undefined }, {
    out: "joined.json",
    bytes: undefined,
    sha256: undefined,
    writes: 4,
    repeated: 0,
    choices: [{ what: "name", at: "$1000", kept: { file: "b.json", value: "draw_room (routine)" }, left: [{ file: "a.json", value: "draw_room_a" }] }],
    apply: "knowledge.ts apply joined.json",
  });
  const batch = JSON.parse(readFileSync(join(root, "joined.json"), "utf8")) as Array<Record<string, unknown>>;
  assert.deepEqual(batch.find((write) => write.op === "operand"), { op: "operand", address: "$0400", select: "lo", symbol: "draw_room" }, "the operand follows the owner's name");
  assert.equal(existsSync(join(root, ".c64-re-tools")), false, "join writes no knowledge");

  const clash = knowledge(root, "join", "a.json", "c.json", "--out", "clash.json");
  assert.equal(clash.status, 2);
  assert.deepEqual(clash.json.error, { code: "conflict", message: "The batches give one name cold_start at $0400 (a.json) and $2000 (c.json). Nothing was written. Give each name and each module file one address in the batches, then join again." });
  assert.equal(existsSync(join(root, "clash.json")), false);
  writeFileSync(join(root, "overlap.json"), JSON.stringify({ owner: { start: "$0f00", end: "$10ff" }, ops: [] }));
  assert.equal(knowledge(root, "join", "a.json", "overlap.json", "--out", "x.json").status, 2, "owner ranges must not overlap");

  // $0400 LDA #$00: the low byte of draw_room ($1000).
  writeFileSync(join(root, "game.prg"), Buffer.from([0x00, 0x04, 0xa9, 0x00]));
  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  assert.equal(knowledge(root, "classify", "$0400-$0401", "code").status, 0);
  assert.equal(knowledge(root, "apply", "joined.json").status, 0);
  assert.equal((knowledge(root, "at", "draw_room").json as { symbol: { name: string } }).symbol.name, "draw_room", "a name gives the address");
});

test("listing reads the program and the coverage in the knowledge", () => {
  const root = project();
  // $1000 JSR $1010 / LDA $1020 / STA $d020 / RTS; $1010 RTS; $1020 a table.
  const bytes = [0x20, 0x10, 0x10, 0xad, 0x20, 0x10, 0x8d, 0x20, 0xd0, 0x60, 0, 0, 0, 0, 0, 0, 0x60, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 7, 8];
  writeFileSync(join(root, "game.prg"), Buffer.from([0x00, 0x10, ...bytes]));
  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  writeFileSync(
    join(root, "batch.json"),
    JSON.stringify([
      { op: "rename", address: "$1000", name: "main", kind: "routine" },
      { op: "rename", address: "$1010", name: "helper", kind: "routine" },
      { op: "rename", address: "$1020", name: "table", kind: "data" },
      { op: "classify", start: "$1000", end: "$1009", type: "code" },
      { op: "classify", start: "$1010", end: "$1010", type: "code" },
      { op: "comment", address: "$1003", placement: "side", text: "First entry." },
      { op: "reference", from: "$1000", to: "$1010", kind: "call" },
    ]),
  );
  assert.equal(knowledge(root, "apply", "batch.json").status, 0);

  const coverage = new Uint8Array(0x10000);
  coverage[0x1000] = COVERAGE.ramExecute;
  coverage[0x1003] = COVERAGE.ramExecute;
  coverage[0x1020] = COVERAGE.ramRead;
  writeFileSync(join(root, "run.bin"), coverage);
  assert.equal(knowledge(root, "coverage", "run.bin").status, 0);
  const listed = items(knowledge(root, "listing", "$1000-$1021").json.lines);
  assert.deepEqual(listed[0], { address: "$1000", bytes: "20 10 10", label: "main", text: "jsr helper", access: "x", referencesIn: 0, referencesOut: 1 });
  assert.deepEqual(listed[1], { address: "$1003", bytes: "ad 20 10", text: "lda table", access: "x", referencesIn: 0, referencesOut: 0, comment: "First entry." });
  assert.equal(listed[2]!.text, "sta EXTCOL", "a platform name");
  assert.deepEqual(listed.at(-1), { address: "$1020", bytes: "07 08", label: "table", text: "!byte $07,$08", access: "r", referencesIn: 0, referencesOut: 0 });
  assert.equal(knowledge(project(), "listing", "$1000-$1001").status, 2, "listing needs the program in the knowledge");
  const cut = knowledge(root, "listing", "$1000-$1021", "--max-listed", "1").json.lines as { count: number; listed: unknown[]; rest: string };
  assert.deepEqual([cut.count, cut.listed.length, cut.rest], [listed.length, 1, "a larger --max-listed, a smaller <range>, or --out <file> for all lines"]);

});
