// The c64-knowledge script, run as the LLM runs it: in a project folder,
// with arguments, reading one JSON envelope from stdout.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { after, test } from "node:test";

import { COVERAGE } from "../../src/c64.ts";
import { readEnvelope, type ScriptEnvelope } from "../kit.ts";
import { listing, type ListingSource } from "../../skills/c64-knowledge/scripts/lib/listing.ts";
import { checkResult, pickSample, withVerdict } from "../../skills/c64-knowledge/scripts/lib/check.ts";

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

/** The item of one address in a result of at. */
function atOne(root: string, address: string): Record<string, unknown> {
  return (knowledge(root, "at", address).json.addresses as Array<Record<string, unknown>>)[0]!;
}

/** The items of a list in a result: {count, listed, rest?}. */
function items<T = Record<string, unknown>>(list: unknown): T[] {
  return (list as { listed: T[] }).listed;
}

/** One run of the script: json is the body, or {error: {code, message}} for a refusal. */
function knowledge(root: string, ...args: string[]): { status: number | null; json: Record<string, unknown>; envelope: ScriptEnvelope } {
  const run = spawnSync(process.execPath, [...process.execArgv, script, ...args], { cwd: root, encoding: "utf8" });
  assert.equal(run.stderr, "", run.stderr);
  const { envelope, json } = readEnvelope(run.stdout, run.status);
  return { status: run.status, json: json as Record<string, unknown>, envelope };
}

test("writes report their revision and the current value", () => {
  const root = project();
  const renamed = knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--reason", "reads joystick 2").json;
  assert.equal(typeof renamed.revision, "string");
  assert.deepEqual(renamed, { revision: renamed.revision, symbol: { address: "$2100", name: "update_player", kind: "routine", origin: "llm", revision: renamed.revision } });
  const classified = knowledge(root, "classify", "$3000-$303f", "sprite", "--by", "user").json;
  assert.deepEqual(classified, { revision: classified.revision, regions: [{ start: "$3000", end: "$303f", type: "sprite", origin: "user", revision: classified.revision }] });
  assert.equal(knowledge(root, "rename", "$2100", "update_player").json.revision, null, "no change, no revision");
  const revision = knowledge(root, "revision", String(renamed.revision)).json as { revision: { description: string }; added: { count: number } };
  assert.equal(revision.revision.description, "reads joystick 2");
  assert.equal(revision.added.count, 1);
});

test("a write over a row of another origin prints the replaced row", () => {
  const root = project();
  const first = knowledge(root, "rename", "$2100", "update_player", "--kind", "routine", "--by", "user").json;
  const second = knowledge(root, "rename", "$2100", "move_player").json;
  assert.deepEqual(second, {
    revision: second.revision,
    symbol: { address: "$2100", name: "move_player", kind: "routine", origin: "llm", revision: second.revision },
    previous: { address: "$2100", name: "update_player", kind: "routine", origin: "user", revision: first.revision },
  });
});

test("a removal shows as a suppression with its reason, in at and in the history", () => {
  const root = project();
  knowledge(root, "reference", "$0410", "$ef29", "jump");
  knowledge(root, "classify", "$0480-$04ff", "bytes");
  const unreferenced = knowledge(root, "unreference", "$0410", "$ef29", "jump", "--reason", "the vector is written at run time").json.revision;
  const unclassified = knowledge(root, "unclassify", "$0480-$04ff").json.revision;
  assert.deepEqual(knowledge(root, "suppressions").json, {
    suppressions: {
      count: 2,
      listed: [
        { suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", revision: unreferenced, reason: "the vector is written at run time" },
        { suppresses: "region", start: "$0480", end: "$04ff", origin: "llm", revision: unclassified },
      ],
    },
  });
  assert.deepEqual(atOne(root, "$0480").suppressions, [{ suppresses: "region", start: "$0480", end: "$04ff", origin: "llm", revision: unclassified }]);
  const history = items(knowledge(root, "history", "$0410").json.history);
  assert.deepEqual(history.at(-1), { entity: "suppression", suppresses: "reference", from: "$0410", to: "$ef29", kind: "jump", origin: "llm", fromRevision: unreferenced, reason: "the vector is written at run time" }, "the history gives the reason of the revision");
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
  const first = knowledge(root, "apply", "batch.json", "--reason", "first names", "--evidence", "note:seen in the attract mode").json;
  assert.equal(typeof first.revision, "string");
  assert.deepEqual(first, { revision: first.revision, writes: 2, replaced: [] });
  const piped = spawnSync(process.execPath, [...process.execArgv, script, "apply", "-"], { cwd: root, encoding: "utf8", input: JSON.stringify([{ op: "comment", address: "$2100", placement: "line", text: "Reads joystick 2." }]) });
  const second = readEnvelope(piped.stdout, piped.status).json as Record<string, unknown>;
  assert.deepEqual({ ...second, revision: typeof second.revision }, { revision: "string", writes: 1, replaced: [] });
  // A batch lists each row of another origin that it replaced, as previous does for one write.
  const user = knowledge(root, "rename", "$2200", "l2200", "--by", "user").json;
  writeFileSync(join(root, "over.json"), JSON.stringify([{ op: "comment", address: "$2200", placement: "line", text: "x" }, { op: "rename", address: "$2200", name: "draw_cave" }]));
  assert.deepEqual(knowledge(root, "apply", "over.json").json.replaced, [{ write: 2, op: "rename", previous: { address: "$2200", name: "l2200", kind: "label", origin: "user", revision: user.revision } }]);
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
  knowledge(root, "rename", "$2300", "helper");
  assert.deepEqual(items<{ name: string }>(knowledge(root, "symbols", "--origin", "user").json.symbols).map((row) => row.name), ["update_player"]);
  assert.deepEqual(items(knowledge(root, "symbols", "--origin", "semantic").json.symbols).length, 2);
  const robot = knowledge(root, "symbols", "--origin", "robot");
  assert.equal(robot.status, 2);
  assert.match((robot.json.error as { message: string }).message, /^--origin cannot be "robot"\. Give one of user, llm, dxa, decompiler, heuristic, semantic or analyzer, or a comma list of them\. semantic is user and llm\. analyzer is dxa, decompiler and heuristic\. To get the usage, run knowledge\.ts symbols --help\.$/);
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

  const run = new Uint8Array(0x10000);
  run[0x0400] = COVERAGE.ramExecute;
  writeFileSync(join(capture, "attract.bin"), run);
  const joined = knowledge(root, "coverage", ".c64-re-tools/local/capture/attract.bin");
  assert.deepEqual(joined.json.imported, [".c64-re-tools/local/capture/attract.bin"]);
  assert.equal(joined.json.added, 1);
  const cited = knowledge(root, "rename", "$0400", "start", "--evidence", "coverage:.c64-re-tools/local/capture/attract.bin");
  assert.equal(cited.status, 0);
  const evidence = (knowledge(root, "revision", String(cited.json.revision)).json.revision as { evidence: Array<{ kind: string; ref: string }> }).evidence;
  assert.deepEqual(evidence.map((item) => [item.kind, item.ref]), [["coverage", ".c64-re-tools/local/capture/attract.bin"]]);
  const unknown = knowledge(root, "rename", "$0401", "x", "--evidence", "coverage:other.bin");
  assert.equal(unknown.status, 2);
  assert.match((unknown.json.error as { message: string }).message, /Import the map with coverage first\./);
  assert.deepEqual(knowledge(root, "program").json, {
    image: { segments: [{ start: "$0400", end: "$04ff" }], bytes: 256, entry: "$0400", state: true, stages: 1 },
    coverage: { maps: [".c64-re-tools/local/capture/attract.bin"], ranges: { x: 1 } },
  });
  // A JSON value that is no object, here a segment, is no image.json.
  writeFileSync(join(capture, "bad.json"), JSON.stringify({ image: "image.bin", segments: [null] }));
  const bad = knowledge(root, "image", ".c64-re-tools/local/capture/bad.json");
  assert.equal(bad.status, 2);
  assert.match((bad.json.error as { message: string }).message, /segment 1 is not an object/);
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
  assert.match((missing.json.error as { message: string }).message, /no coverage map of the knowledge in bank1\. Import the map with coverage --space bank1 first\./);
});

test("export writes all current knowledge to a project file and answers with counts", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "update_player");
  const classified = knowledge(root, "classify", "$3000-$303f", "sprite").json;
  const exported = knowledge(root, "export", "--out", "exports/knowledge.json").json;
  assert.match(String(exported.sha256), /^[0-9a-f]{64}$/);
  assert.deepEqual({ ...exported, bytes: undefined, sha256: undefined }, { out: "exports/knowledge.json", bytes: undefined, sha256: undefined, counts: { symbols: 1, analyzerNames: 0, regions: 1, comments: 0, references: 0, suppressions: 0, modules: 0, operands: 0, patches: 0, switches: 0, releases: 0, macros: 0, macroUses: 0 }, revision: classified.revision });
  const file = JSON.parse(readFileSync(join(root, "exports", "knowledge.json"), "utf8")) as { symbols: Array<{ name: string }> };
  assert.equal(file.symbols[0]!.name, "update_player");
});

test("module records where a file of generated source starts, and modules lists them", () => {
  const root = project();
  const set = knowledge(root, "module", "$0801", "boot.asm", "--title", "BASIC start");
  assert.equal(set.status, 0, JSON.stringify(set.json));
  const module = { start: "$0801", file: "boot.asm", title: "BASIC start", origin: "llm", revision: set.json.revision };
  assert.deepEqual(set.json, { revision: set.json.revision, module });
  assert.deepEqual(knowledge(root, "modules").json, { modules: { count: 1, listed: [module] } });
  assert.equal(typeof knowledge(root, "unmodule", "$0801").json.revision, "string");
});

test("--space keeps drive code and cartridge banks apart from the C64", () => {
  const root = project();
  const drive = knowledge(root, "rename", "$0500", "loop", "--space", "drive8");
  assert.equal(drive.status, 0, JSON.stringify(drive.json));
  assert.deepEqual(drive.json.symbol, { space: "drive8", address: "$0500", name: "loop", kind: "label", origin: "llm", revision: drive.json.revision });
  // --space gives the space of each write of a batch that names none.
  writeFileSync(join(root, "bank.json"), JSON.stringify([{ op: "classify", start: "$8000", end: "$80ff", type: "bytes" }, { op: "rename", address: "$8000", name: "cart_start", space: "bank1" }]));
  assert.equal(knowledge(root, "apply", "bank.json", "--space", "bank0").status, 0);
  assert.deepEqual(knowledge(root, "spaces").json, { spaces: { count: 3, listed: ["drive8", "bank0", "bank1"] } });
  assert.equal(items(knowledge(root, "regions", "--space", "bank0").json.regions).length, 1);
  assert.equal(items<{ name: string }>(knowledge(root, "symbols", "--space", "bank1").json.symbols)[0]!.name, "cart_start");
});

test("operand writes an expression after a check against the program in the knowledge, and operands shows it", () => {
  const root = project();
  // $8079 LDA #$c0 / STA $0314 / LDA #$80
  writeFileSync(join(root, "game.prg"), Buffer.from([0x79, 0x80, 0xa9, 0xc0, 0x8d, 0x14, 0x03, 0xa9, 0x80]));
  knowledge(root, "rename", "$80c0", "irq_handler");
  const without = knowledge(root, "operand", "$8079", "--lo", "irq_handler");
  assert.equal(without.status, 2, "operand needs the program in the knowledge");
  assert.match((without.json.error as { message: string }).message, /^The knowledge has no program\. Put the program into the project knowledge: a PRG, or the image\.json of a capture\./);
  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  assert.equal(knowledge(root, "classify", "$8079-$8080", "code").status, 0);
  assert.equal(knowledge(root, "operand", "$8079", "--lo", "irq_handler", "--hi", "irq_handler").status, 2, "one selector only");
  const lo = knowledge(root, "operand", "$8079", "--lo", "irq_handler").json;
  assert.deepEqual(lo, {
    revision: lo.revision,
    operand: { address: "$8079", select: "lo", symbol: "irq_handler", text: "<irq_handler", origin: "llm", revision: lo.revision },
  });
  assert.equal(knowledge(root, "operand", "$807b", "--value", "CINV", "--offset=0").status, 0, "a platform name");
  assert.deepEqual(items<{ address: string; text: string }>(knowledge(root, "operands").json.operands).map((row) => [row.address, row.text]), [["$8079", "<irq_handler"], ["$807b", "CINV"]]);
});

test("a command takes a start of a revision id that only one revision has, and 0 for the knowledge before every revision", () => {
  const root = project();
  const first = String(knowledge(root, "rename", "$2100", "main", "--reason", "the entry").json.revision);
  knowledge(root, "rename", "$2100", "start");
  assert.match(first, /^\d{8}T\d{6}\.\d{3}-[0-9a-z]{6}$/);
  // The date, the time and part of the random characters.
  assert.equal(knowledge(root, "revert", first.slice(0, 26)).status, 0);
  assert.equal((atOne(root, "$2100").symbol as { name: string }).name, "main");
  const reverted = knowledge(root, "revert", "0").json;
  assert.equal(atOne(root, "$2100").symbol, undefined);
  // A revert keeps the revision that it restored.
  assert.equal((knowledge(root, "revision", String(reverted.revision)).json.revision as { restores: string }).restores, "0");
  const help = knowledge(root, "revert", "--help");
  assert.equal(help.envelope.command, "help");
  const body = help.json as { summary: string; options: Array<{ flag: string; help: string }> };
  assert.match(body.summary, /Makes the knowledge the same as at one revision: all spaces, or with --space only that space\. The revert is a new revision/);
  assert.match(body.options.find((option) => option.flag === "--space <space>")!.help, /Without --space, every space reverts/);
  assert.doesNotMatch(JSON.stringify(body), /Undoes one revision/);
});

test("release, switch, patch, macro and use write the source knowledge, and switches, at and history read it", () => {
  const root = project();
  // $8100 INC $fb / BNE +2 / INC $fc / LDA #$00 / STA $d020
  writeFileSync(join(root, "game.prg"), Buffer.from([0x00, 0x81, 0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xa9, 0x00, 0x8d, 0x20, 0xd0]));
  assert.equal(knowledge(root, "patch", "$8106-$810a", "CRACK").status, 2, "patch needs --code, --code-file or --nop");
  assert.equal(knowledge(root, "patch", "$8106-$810a", "CRACK", "--nop", "--code", "nop").status, 2, "only one of them");

  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  mkdirSync(join(root, ".c64-re-tools", "local"), { recursive: true });
  writeFileSync(join(root, "other.prg"), Buffer.from([0x00, 0x81, 0xe6, 0xfb, 0xd0, 0x02, 0xe6, 0xfc, 0xa9, 0x01, 0x8d, 0x20, 0xd0]));
  assert.match(String((knowledge(root, "release", "OTHER", "--file", "other.prg", "--base").json.error as { message: string }).message), /The bytes of other\.prg are not the program of the knowledge/);
  const original = knowledge(root, "release", "FIRESTAR", "--file", "game.prg", "--base", "--comment", "The first release.").json;
  assert.deepEqual(original, {
    revision: original.revision,
    release: { label: "FIRESTAR", base: true, define: "--define RELEASE_FIRESTAR=1", file: "game.prg", sha256: createHash("sha256").update(readFileSync(join(root, "game.prg"))).digest("hex"), comment: "The first release.", origin: "llm", revision: original.revision },
    bytes: 11,
  });
  // The knowledge keeps the bytes of the release: its file can be a scratch file that git ignores.
  writeFileSync(join(root, ".c64-re-tools", "local", "other.prg"), readFileSync(join(root, "other.prg")));
  assert.equal(knowledge(root, "release", "V2", "--file", ".c64-re-tools/local/other.prg").status, 0);
  assert.match(readFileSync(join(root, ".c64-re-tools", "knowledge", "release_memory.jsonl"), "utf8"), /"label":"V2","at":"\$8100","bytes":"e6fbd002e6fca9018d20d0"/);
  assert.equal(knowledge(root, "switch", "CRACK", "--kind", "crack", "--comment", "A white border.").status, 0);
  assert.equal(knowledge(root, "switch", "FIX_BORDER", "--kind", "fix", "--releases", "V2").status, 0);
  writeFileSync(join(root, "crack.asm"), "  lda #1\n  sta $d020\n");
  const patched = knowledge(root, "patch", "$8106-$810a", "CRACK", "--code-file", "crack.asm", "--comment", "A white border.").json;
  assert.deepEqual(patched, {
    revision: patched.revision,
    patch: { start: "$8106", end: "$810a", bytes: 5, switch: "CRACK", code: "  lda #1\n  sta $d020", comment: "A white border.", origin: "llm", revision: patched.revision },
  });
  const shownSwitches = items<Record<string, unknown>>(knowledge(root, "switches").json.switches).map(({ origin: _origin, revision: _revision, ...row }) => row);
  assert.deepEqual(shownSwitches, [
    { name: "CRACK", kind: "crack", default: 0, base: 0, releases: [], comment: "A white border.", patches: [{ start: "$8106", end: "$810a" }] },
    { name: "FIX_BORDER", kind: "fix", default: 1, base: 0, releases: ["V2"], patches: [] },
  ]);
  assert.deepEqual(items<{ entity: string }>(knowledge(root, "history", "--switch", "CRACK").json.history).map((row) => row.entity), ["switch", "patch"]);

  knowledge(root, "rename", "$00fb", "ptr");
  assert.equal(knowledge(root, "macro", "inc16", "--params", "dst", "--body", "inc .dst\nbne +\ninc .dst+1\n+", "--comment", "Adds 1.").status, 0);
  const used = knowledge(root, "use", "$8100-$8105", "inc16", "--args", "ptr").json;
  assert.deepEqual(used, {
    revision: used.revision,
    use: { start: "$8100", end: "$8105", macro: "inc16", args: ["ptr"], text: "+inc16 ptr", origin: "llm", revision: used.revision },
  });
  assert.equal((atOne(root, "$8103") as { macroUse: { text: string } }).macroUse.text, "+inc16 ptr");
});

test("join shows the batches of parallel agents as one list of writes, and with --apply writes it as one revision", () => {
  const root = project();
  // The Bruce Lee run: each agent named its own range; batch b owns $1000-$1fff.
  writeFileSync(join(root, "a.json"), JSON.stringify({ owner: { start: "$0200", end: "$0fff" }, ops: [{ op: "rename", address: "$0400", name: "cold_start", kind: "routine" }, { op: "rename", address: "$1000", name: "draw_room_a" }] }));
  writeFileSync(join(root, "b.json"), JSON.stringify({ owner: { start: "$1000", end: "$1fff" }, ops: [{ op: "rename", address: "$1000", name: "draw_room", kind: "routine" }, { op: "comment", address: "$1000", placement: "line", text: "Draws the room." }] }));
  writeFileSync(join(root, "c.json"), JSON.stringify([{ op: "rename", address: "$2000", name: "cold_start" }]));
  const joined = knowledge(root, "join", "a.json", "b.json");
  assert.equal(joined.status, 0, JSON.stringify(joined.json));
  const shown = joined.json as { writes: { count: number; listed: Array<Record<string, unknown>> }; repeated: number; choices: unknown[] };
  assert.equal(shown.writes.count, 3);
  assert.equal(shown.repeated, 0);
  assert.deepEqual(shown.choices, [{ what: "name", at: "$1000", kept: { file: "b.json", value: "draw_room (routine)" }, left: [{ file: "a.json", value: "draw_room_a" }] }]);
  assert.equal(joined.envelope.nextAction, `node ${script} join a.json b.json --apply --project ${root}`, "the next command writes the joined batches from any directory");
  assert.equal(existsSync(join(root, ".c64-re-tools")), false, "join without --apply writes no knowledge");

  const clash = knowledge(root, "join", "a.json", "c.json", "--apply");
  assert.equal(clash.status, 2);
  assert.deepEqual(clash.json.error, { code: "conflict", message: "The batches give one name cold_start at $0400 (a.json) and $2000 (c.json). Nothing was written. Give each name and each module file one address in the batches, then join again." });
  writeFileSync(join(root, "overlap.json"), JSON.stringify({ owner: { start: "$0f00", end: "$10ff" }, ops: [] }));
  assert.equal(knowledge(root, "join", "a.json", "overlap.json").status, 2, "owner ranges must not overlap");

  const written = knowledge(root, "join", "a.json", "b.json", "--apply", "--reason", "the names of two agents");
  assert.equal(written.status, 0, JSON.stringify(written.json));
  assert.deepEqual({ ...written.json, revision: typeof written.json.revision }, { revision: "string", writes: 3, replaced: [], repeated: 0, choices: shown.choices });
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
});

test("listing writes an operand expression in the syntax of the addressing mode, as c64-source does", () => {
  // $047e LDA #$00, $0480 LDA $d000,X, $0483 LDA ($fb),Y, $0485 JMP ($0300), $0488 LDA $1000.
  const bytes = new Map([0xa9, 0x00, 0xbd, 0x00, 0xd0, 0xb1, 0xfb, 0x6c, 0x00, 0x03, 0xad, 0x00, 0x10].map((value, offset) => [0x047e + offset, value]));
  const expressions = new Map([
    [0x047e, "<room_charset_a"],
    [0x0480, "$d000"],
    [0x0483, "pointer"],
    [0x0485, "vector"],
    [0x0488, "(table+1)"],
  ]);
  const source: ListingSource = {
    byteAt: (address) => bytes.get(address),
    nameOf: () => undefined,
    secondNames: () => [],
    regions: [{ start: 0x047e, end: 0x048a, type: "code" }],
    comments: () => ({ line: [] }),
    operand: (address) => expressions.get(address),
    references: () => ({ in: 0, out: 0 }),
  };
  assert.deepEqual(
    listing(source, 0x047e, 0x048a).map((line) => line.text),
    ["lda #<room_charset_a", "lda $d000,x", "lda (pointer),y", "jmp (vector)", "lda 0+(table+1)"],
  );
});

test("listing names an address inside a named data region or a platform entry as name+offset, as c64-source does", () => {
  // $4000 LDA $432F, $4003 STA $0319, $4006 LDA $4100: a two-byte table at $432E, the high byte of NMINV, and a code region.
  const bytes = new Map([0xad, 0x2f, 0x43, 0x8d, 0x19, 0x03, 0xad, 0x00, 0x41, 0x00, 0x00].map((value, offset) => [0x4000 + offset, value]));
  for (const address of [0x432e, 0x432f, 0x4100, 0x4101]) bytes.set(address, 0);
  const names = new Map([[0x432e, "fireball_active"], [0x0318, "NMINV"], [0x4100, "main"]]);
  const source: ListingSource = {
    byteAt: (address) => bytes.get(address),
    nameOf: (address) => names.get(address),
    entryStart: (address) => (address === 0x0319 ? 0x0318 : undefined),
    secondNames: () => [],
    regions: [{ start: 0x4000, end: 0x4008, type: "code" }, { start: 0x4100, end: 0x4101, type: "code" }, { start: 0x432e, end: 0x432f, type: "bytes" }],
    comments: () => ({ line: [] }),
    operand: () => undefined,
    references: () => ({ in: 0, out: 0 }),
  };
  assert.deepEqual(listing(source, 0x4000, 0x4008).map((line) => line.text), ["lda fireball_active+1", "sta NMINV+1", "lda main"]);
});

test("listing writes a table of words or addresses as its values with the names of the targets, as c64-source does", () => {
  // $2000: addresses of $3000 (room_a) and $3010; $2004: an RTS table, split, of $3100 (handler) and $3200; $2008: words with an odd last byte.
  const table = [0x00, 0x30, 0x10, 0x30, 0xff, 0xff, 0x30, 0x31, 0x34, 0x12, 0x56];
  const bytes = new Map(table.map((value, offset) => [0x2000 + offset, value]));
  const names = new Map([[0x3000, "room_a"], [0x3100, "handler"]]);
  const source: ListingSource = {
    byteAt: (address) => bytes.get(address),
    nameOf: (address) => names.get(address),
    secondNames: () => [],
    regions: [{ start: 0x2000, end: 0x2003, type: "addresses" }, { start: 0x2004, end: 0x2007, type: "rts-addresses-split" }, { start: 0x2008, end: 0x200a, type: "words" }],
    comments: () => ({ line: [] }),
    operand: () => undefined,
    references: () => ({ in: 0, out: 0 }),
  };
  assert.deepEqual(
    listing(source, 0x2000, 0x200a).map((line) => [line.address, line.text]),
    [
      [0x2000, "!word room_a,$3010"],
      [0x2004, "!byte <(handler-1),<$31ff,>(handler-1),>$31ff"],
      [0x2008, "!word $1234"],
      [0x200a, "!byte $56"],
    ],
  );
  assert.deepEqual(listing(source, 0x2001, 0x2003).map((line) => [line.address, line.text]), [[0x2002, "!word $3010"]], "a start inside a word starts at the next word");
});


test("listing shows a comment at an operand byte (knowledge of an older version) with its address, as c64-source does", () => {
  // $1bc9 LDA $0104, $1bcc RTS; a side comment at $1bc9 and one at the operand byte $1bca.
  const bytes = new Map([0xad, 0x04, 0x01, 0x60].map((value, offset) => [0x1bc9 + offset, value]));
  const comments = new Map<number, { line: string[]; side?: string }>([[0x1bc9, { line: [], side: "the mode" }], [0x1bca, { line: [], side: "mid-instruction comment" }]]);
  const source: ListingSource = {
    byteAt: (address) => bytes.get(address),
    nameOf: () => undefined,
    secondNames: () => [],
    regions: [{ start: 0x1bc9, end: 0x1bcc, type: "code" }],
    comments: (address) => comments.get(address) ?? { line: [] },
    operand: () => undefined,
    references: () => ({ in: 0, out: 0 }),
  };
  assert.deepEqual(
    listing(source, 0x1bc9, 0x1bcc).map((line) => [line.text, line.comment]),
    [["lda $0104", "the mode $1bca: mid-instruction comment"], ["rts", undefined]],
  );
});

test("listing with code only gives the instructions of the code regions and no data lines", () => {
  // $1000 LDA #$01, $1002 RTS, then two bytes of data, then $1006 RTS in a JMP table region.
  const bytes = new Map([0xa9, 0x01, 0x60, 0x07, 0x08, 0x00, 0x60].map((value, offset) => [0x1000 + offset, value]));
  const source: ListingSource = {
    byteAt: (address) => bytes.get(address),
    nameOf: () => undefined,
    secondNames: () => [],
    regions: [{ start: 0x1000, end: 0x1002, type: "code" }, { start: 0x1003, end: 0x1004, type: "bytes" }, { start: 0x1006, end: 0x1006, type: "jumps" }],
    comments: () => ({ line: [] }),
    operand: () => undefined,
    references: () => ({ in: 0, out: 0 }),
  };
  assert.deepEqual(listing(source, 0x1000, 0x1006).map((line) => line.text), ["lda #$01", "rts", "!byte $07,$08", "!byte $00", "rts"]);
  assert.deepEqual(listing(source, 0x1000, 0x1006, { code: true }).map((line) => line.text), ["lda #$01", "rts", "rts"]);
});

test("at reads many addresses with the access of each coverage map, and coverage takes the map of a recording folder", () => {
  const root = project();
  writeFileSync(join(root, "game.prg"), Buffer.from([0x00, 0x10, 0xa9, 0x01, 0x60]));
  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  const folder = join(root, "tests", "recordings", "walk");
  mkdirSync(folder, { recursive: true });
  const run = new Uint8Array(0x10000);
  run[0x1000] = COVERAGE.ramExecute;
  run[0x1001] = COVERAGE.ramRead;
  writeFileSync(join(folder, "coverage.bin"), run);
  writeFileSync(join(folder, "recording.json"), "{}");
  assert.deepEqual(knowledge(root, "coverage", "tests/recordings/walk").json.imported, ["tests/recordings/walk/coverage.bin"]);
  const read = knowledge(root, "at", "$1000", "$1001", "$1002").json as { revision: string; addresses: Array<{ address: string; coverage: unknown; access: string }> };
  assert.equal(typeof read.revision, "string");
  assert.deepEqual(read.addresses[0]!.coverage, [{ map: "tests/recordings/walk/coverage.bin", access: "x" }]);
  assert.deepEqual(read.addresses.map((item) => [item.address, item.access]), [["$1000", "x"], ["$1001", "r"], ["$1002", "-"]]);
  const refused = knowledge(root, "references", "--direction", "in");
  assert.equal(refused.status, 2);
  assert.match((refused.json.error as { message: string }).message, /--direction needs --range/);
});

test("patch takes the bytes of a release with --from-release, and start-screen takes the screen in the program from a capture", () => {
  const root = project();
  // The program: $1000-$17ff, with 1000 colour bytes at $1400. The release V2 has other bytes at $1000-$1002.
  const program = Buffer.alloc(0x800, 0xea);
  program.fill(0x0e, 0x400, 0x400 + 500);
  program.fill(0x01, 0x400 + 500, 0x400 + 1000);
  writeFileSync(join(root, "game.prg"), Buffer.concat([Buffer.from([0x00, 0x10]), program]));
  const other = Buffer.from(program);
  other.set([0xa9, 0x00, 0x60]);
  writeFileSync(join(root, "v2.prg"), Buffer.concat([Buffer.from([0x00, 0x10]), other]));
  assert.equal(knowledge(root, "image", "game.prg").status, 0);
  assert.equal(knowledge(root, "release", "BASE", "--file", "game.prg", "--base").status, 0);
  assert.equal(knowledge(root, "release", "V2", "--file", "v2.prg").status, 0);
  assert.equal(knowledge(root, "switch", "FIX", "--kind", "fix", "--releases", "V2").status, 0);
  const patched = knowledge(root, "patch", "$1000-$1002", "FIX", "--from-release", "V2").json as { patch: { code: string } };
  assert.equal(patched.patch.code, "!byte $a9,$00,$60");
  assert.equal(knowledge(root, "patch", "$1000-$1002", "FIX", "--from-release", "V2", "--nop").status, 2, "one source of the code");

  // Captures of the program with a text screen at $0400 and the character ROM, each with its colour RAM.
  const capture = (name: string, colours: string) => {
    const folder = join(root, ".c64-re-tools", "local", name);
    mkdirSync(folder, { recursive: true });
    writeFileSync(join(folder, "image.bin"), Buffer.alloc(0x10000));
    writeFileSync(join(folder, "image.json"), JSON.stringify({ entry: "$1000", segments: [{ start: "$1000", end: "$17ff" }], image: "image.bin" }));
    const vic = Buffer.alloc(0x2f);
    [vic[0x11], vic[0x16], vic[0x18], vic[0x20], vic[0x21]] = [0x1b, 0x08, 0x14, 0xf2, 0xf0];
    const io = { vic: { from: "$d000", bytes: vic.toString("hex") }, cia2: { from: "$dd00", bytes: "033f" }, colour: { from: "$d800", bytes: colours } };
    const pages = Object.fromEntries(["$0000", "$0100", "$0200", "$0300"].map((page) => [page, "00".repeat(256)]));
    writeFileSync(join(folder, "entry_state.json"), JSON.stringify({ registers: { pc: "$1000", a: 0, x: 0, y: 0, sp: 0xf6, flags: { i: true } }, cpuPort: { $00: 0x2f, $01: 0x37 }, pages, io, differsFromReset: [] }));
    return `.c64-re-tools/local/${name}/image.json`;
  };
  const refused = knowledge(root, "start-screen", "--capture", capture("other", "f1".repeat(500) + "fe".repeat(500)));
  assert.match((refused.json.error as { message: string }).message, /has more than one colour, and the program of the knowledge has no 1000 bytes with these colours/);
  const screen = knowledge(root, "start-screen", "--capture", capture("title", "fe".repeat(500) + "f1".repeat(500)), "--border", "5").json as { startScreen: Record<string, unknown> };
  assert.deepEqual({ ...screen.startScreen, revision: undefined }, { mode: "text", screen: "$0400", charset: "$1000", colours: "$1400", border: 5, background: 0, origin: "llm", revision: undefined });
});

test("pickSample takes the same places for the same seed, also after their texts change", () => {
  const rows = [0x2000, 0x2010, 0x2020, 0x2030, 0x2040, 0x2050].map((address) => ({ space: "c64", address, placement: "line", text: `at ${address}` }));
  const first = pickSample(rows, 1, 3).map((row) => row.address);
  assert.equal(first.length, 3);
  assert.deepEqual(first, [...first].sort((a, b) => a - b), "in address order");
  assert.deepEqual(pickSample(rows.map((row) => ({ ...row, text: "changed" })), 1, 3).map((row) => row.address), first);
  assert.deepEqual(pickSample([...rows, { space: "c64", address: 0x2060, placement: "side", text: "new" }], 1, 7).filter((row) => first.includes(row.address)).length, 3);
  assert.notDeepEqual(pickSample(rows, 2, 3).map((row) => row.address), first, "another seed takes other places");
});

test("withVerdict refuses a comment outside the sample and a verdict without the fields that it needs, and checkResult counts the verdicts", () => {
  const comment = (address: string, placement: string) => ({ address, placement, text: "t" });
  const sample = { seed: 3, createdAt: "2026-10-30T16:00:00.000+01:00", revision: "r", population: 9, comments: [comment("$2000", "line"), comment("$2000", "side"), comment("$2100", "line")] };
  const refused = (request: Parameters<typeof withVerdict>[2], pattern: RegExp) => assert.throws(() => withVerdict(sample, undefined, request), pattern);
  refused({ address: "$2200", verdict: "correct" }, /has no comment at \$2200/);
  refused({ address: "$2000", verdict: "correct" }, /Give --placement line or --placement side/);
  refused({ address: "$2100", verdict: "correct", class: "bits" }, /takes no --class/);
  refused({ address: "$2100", verdict: "wrong", why: "x", text: "y" }, /needs --class/);
  refused({ address: "$2100", verdict: "wrong", class: "bits", text: "y" }, /needs --why/);
  refused({ address: "$2100", verdict: "wrong", class: "bits", why: "x" }, /needs --text .*--name/);
  refused({ address: "$2100", verdict: "wrong", class: "bits", why: "x", name: "2bad" }, /is not a label/);
  const one = withVerdict(sample, undefined, { address: "$2100", verdict: "unsure", why: "a run of room 2" });
  const two = withVerdict(sample, one, { address: "$2000", placement: "side", verdict: "wrong", class: "bits", why: "AND #$7f", text: "Clears bit 7." });
  const again = withVerdict(sample, two, { address: "$2100", verdict: "correct" });
  assert.deepEqual(again.items.map((item) => [item.address, item.placement, item.verdict]), [["$2000", "side", "wrong"], ["$2100", "line", "correct"]], "a new verdict replaces the earlier one, in the order of the sample");
  const result = checkResult(sample, again);
  assert.deepEqual([result.sampled, result.checked, result.correct, result.wrong, result.unsure], [3, 2, 1, 1, 0]);
  assert.equal(result.items[0]!.verdict, undefined, "an open item has no verdict");
  assert.deepEqual([result.items[1]!.text, result.items[1]!.correction], ["t", { text: "Clears bit 7." }], "the correction does not hide the comment");
});

test("a comment check: sample starts it, verdict records a judgement, checks gives the items, the counts and the files", () => {
  const root = project();
  const writes = [0x2000, 0x2010, 0x2020, 0x2030, 0x2040, 0x2050].map((address) => ({ op: "comment", address: `$${address.toString(16)}`, placement: "line", text: `routine at ${address}` }));
  writeFileSync(join(root, "comments.json"), JSON.stringify([{ op: "rename", address: "$2010", name: "move_player", kind: "routine" }, ...writes]));
  assert.equal(knowledge(root, "apply", "comments.json").status, 0);
  const started = knowledge(root, "sample", "--count", "3", "--seed", "1").json;
  assert.deepEqual([started.seed, started.population, started.sampled], [1, 6, 3]);
  const items = (knowledge(root, "checks", "1").json.items as { listed: Array<{ address: string; name?: string }> }).listed;
  assert.deepEqual(items.map((item) => [item.address, item.name]), [["$2000", undefined], ["$2010", "move_player"], ["$2020", undefined]]);
  assert.equal(knowledge(root, "verdict", "1", "move_player", "wrong", "--class", "callers", "--why", "JSR at $3000 calls it too", "--name", "move_actor").status, 0);
  const result = knowledge(root, "checks").json.checks as { listed: Array<Record<string, unknown>> };
  assert.deepEqual([result.listed[0]!.seed, result.listed[0]!.checked, result.listed[0]!.wrong], [1, 1, 1]);
  assert.deepEqual(knowledge(root, "checks", "1").json.files, { sample: "runs/comment-check-1/sample.json", verdicts: "runs/comment-check-1/verdicts.json" });
  assert.equal(knowledge(root, "sample", "--seed", "1").status, 2, "a seed whose check has verdicts is refused");
});

test("a batch write with an unknown field names every field that the write takes, space too", () => {
  const root = project();
  writeFileSync(join(root, "batch.json"), JSON.stringify([{ op: "classify", range: "$1000-$10ff", type: "code" }]));
  const refused = knowledge(root, "apply", "batch.json");
  assert.equal(refused.status, 2);
  assert.match((refused.json.error as { message: string }).message, /^write 1: classify takes start, end, type, element, space, not range/);
});

test("a read with conflicts of a git merge gives merge as the next command, and a write is refused until merge decides them", () => {
  const root = project();
  knowledge(root, "rename", "$2100", "first");
  knowledge(root, "rename", "$2200", "second");
  // A git merge keeps the lines of both sides: a second current name at $2100.
  const file = join(root, ".c64-re-tools", "knowledge", "symbols.jsonl");
  const second = JSON.parse(readFileSync(file, "utf8").trim().split("\n")[1]!) as Record<string, unknown>;
  writeFileSync(file, `${readFileSync(file, "utf8")}${JSON.stringify({ ...second, id: `${second.added}/2`, address: "$2100", name: "other" })}\n`);
  const read = knowledge(root, "at", "$2100");
  assert.equal((read.json.conflicts as unknown[]).length, 1);
  assert.match(read.envelope.hint!, /Run merge/);
  assert.equal(read.envelope.nextAction, `node ${script} merge --reason 'decide the conflicts of a git merge' --project ${root}`);
  const refused = knowledge(root, "rename", "$2300", "third");
  assert.equal(refused.envelope.code, "conflict");
  assert.match(refused.envelope.hint!, /Decide the conflicts of the git merge in the project knowledge\. Then write again\./);
  const merged = knowledge(root, "merge", "--reason", "two computers");
  assert.equal((merged.json.choices as unknown[]).length, 1);
});
