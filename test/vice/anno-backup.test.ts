// anno-backup.test.ts -- `anno export-project` and `anno import-project`, the
// text form of a project's committed annotations.db.
//
// Each workspace here has its OWN annotations.db, the way two clones would:
// the only thing that crosses between them is the export document.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAnnoCli } from "../../src/mcp/vice/anno-cli.ts";
import { openTestProject, type TestProject } from "./workspace-store-fixture.ts";
import { workspaceStoreRunner, type RunAnno } from "../../src/mcp/vice/anno-workspace-store.ts";
import { addExcludedRange, addScope, currentRevision, setComment, setDataType, setLabel } from "../../src/mcp/vice/anno-store.mts";
import { exportStoreDocument, STORE_EXPORT_SCHEMA_VERSION, type StoreExportDocument } from "../../src/mcp/vice/anno-store-export.mts";

const cleanups: Array<() => void> = [];
afterEach(() => {
  while (cleanups.length > 0) cleanups.pop()!();
});

function workspace(): string {
  const ws = mkdtempSync(join(tmpdir(), "anno-backup-"));
  cleanups.push(() => rmSync(ws, { recursive: true, force: true }));
  return ws;
}

/** The workspace's own project, opened for populating and inspecting. */
function project(ws: string): TestProject {
  const p = openTestProject(ws);
  cleanups.push(() => p.close());
  return p;
}

/** A workspace with no annotations.db yet: only the client's runner. */
function noProject(ws: string): { runAnno: RunAnno } {
  return { runAnno: workspaceStoreRunner({ workspaceRoot: ws }) };
}

async function anno(ws: string, b: { runAnno: RunAnno }, argv: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const out: string[] = [];
  const err: string[] = [];
  console.log = (...args: unknown[]) => void out.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => void err.push(args.map(String).join(" "));
  try {
    const code = await runAnnoCli(argv, { runAnno: b.runAnno, workspaceRoot: ws });
    return { code, stdout: out.join("\n"), stderr: err.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

/** One row of every class a project can hold. */
function populate(b: TestProject): void {
  setDataType(b.handle, { start: 0xc000, endInclusive: 0xc005, dataType: "code" });
  setLabel(b.handle, { address: 0xc000, name: "start", kind: "User" });
  setComment(b.handle, { address: 0xc000, commentType: "side", text: "[confirmed-code] entry point" });
  addScope(b.handle, { start: 0xc000, endInclusive: 0xc005 });
  addExcludedRange(b.handle, { start: 0xc003, endInclusive: 0xc003, reason: "trainer patch" });
}

const EMPTY_DOCUMENT: StoreExportDocument = {
  schemaVersion: STORE_EXPORT_SCHEMA_VERSION,
  ranges: [],
  labels: [],
  comments: [],
  projectEnums: [],
  enumUsage: [],
  xrefs: [],
  execObservations: [],
  scopes: [],
  excludedRanges: [],
};

test("export-project then import-project moves a whole project into another workspace's fresh project, row for row", async () => {
  const wsA = workspace();
  const a = project(wsA);
  populate(a);
  const exported = join(wsA, "backup.json");
  const out = await anno(wsA, a, ["export-project", "--out", exported]);
  assert.equal(out.code, 0, out.stderr);
  assert.match(out.stdout, /^export-project: wrote .*backup\.json \(project [0-9a-f-]{36}: 1 ranges, 1 labels, 1 comments/);
  assert.deepEqual(JSON.parse(readFileSync(exported, "utf8")), exportStoreDocument(a.handle), "the file is the project's export document");

  // A second clone: a workspace with no annotations.db yet.
  const wsB = workspace();
  const b = noProject(wsB);
  const document = join(wsB, "backup.json");
  writeFileSync(document, readFileSync(exported));
  const imported = await anno(wsB, b, ["import-project", document]);
  assert.equal(imported.code, 0, imported.stderr);
  assert.match(imported.stdout, /^import-project: imported .* into project [0-9a-f-]{36} \(1 ranges, 1 labels, 1 comments/);

  assert.ok(existsSync(join(wsB, ".c64-re-tools", "annotations.db")), "import-project is a write: it creates the workspace's annotations.db");
  const imported2 = project(wsB);
  assert.notEqual(imported2.projectId, a.projectId, "the imported project is a new project, not the exporter's id");
  assert.deepEqual(exportStoreDocument(imported2.handle), exportStoreDocument(a.handle));
});

test("import-project refuses a project that already holds annotations, naming what it holds, and leaves it untouched", async () => {
  const ws = workspace();
  const b = project(ws);
  setLabel(b.handle, { address: 0x1000, name: "mine", kind: "User" });
  const before = exportStoreDocument(b.handle);
  const revision = currentRevision(b.handle);
  const document = join(ws, "incoming.json");
  writeFileSync(document, JSON.stringify({ ...EMPTY_DOCUMENT, labels: [{ address: 0x2000, name: "theirs", kind: "User", bank: null }] }));

  const result = await anno(ws, b, ["import-project", document]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /already holds annotations \(1 labels\)/);
  assert.match(result.stderr, /never merges/);
  assert.deepEqual(exportStoreDocument(b.handle), before);
  assert.equal(currentRevision(b.handle), revision, "a refused import writes nothing, not even a revision");
});

test("import-project is one transaction: a document the store refuses part-way leaves the project empty", async () => {
  const ws = workspace();
  const b = project(ws);
  const document = join(ws, "clash.json");
  // Every row is well-formed on its own, so validation passes; the store
  // refuses the second label because its name is already bound elsewhere --
  // after the range and the first label were applied.
  writeFileSync(
    document,
    JSON.stringify({
      ...EMPTY_DOCUMENT,
      ranges: [{ start: 0xc000, endInclusive: 0xc005, dataType: "code", bank: null, provenance: "derived" }],
      labels: [
        { address: 0xc000, name: "dup", kind: "User", bank: null },
        { address: 0xc001, name: "dup", kind: "User", bank: null },
      ],
    }),
  );
  const revision = currentRevision(b.handle);

  const result = await anno(ws, b, ["import-project", document]);
  assert.notEqual(result.code, 0);
  assert.match(result.stderr, /already bound/);
  assert.deepEqual(exportStoreDocument(b.handle), EMPTY_DOCUMENT, "no row of a refused import may survive");
  assert.equal(currentRevision(b.handle), revision);
});

test("import-project refuses a file that is not an export document, without echoing its bytes", async () => {
  const ws = workspace();
  const b = project(ws);
  const token = "QQZZBACKUP";
  const cases: Array<{ body: string; expect: RegExp }> = [
    { body: `${token}\nnot json\n`, expect: /is not valid JSON/ },
    { body: "[1, 2]", expect: /not an object/ },
    { body: JSON.stringify({ schemaVersion: STORE_EXPORT_SCHEMA_VERSION }), expect: /has no "ranges" array/ },
    { body: JSON.stringify({ ...EMPTY_DOCUMENT, schemaVersion: 99 }), expect: /schemaVersion 99/ },
  ];
  for (const { body, expect } of cases) {
    const document = join(ws, "bad.json");
    writeFileSync(document, body);
    const result = await anno(ws, b, ["import-project", document]);
    assert.notEqual(result.code, 0);
    assert.match(result.stderr, expect);
    assert.ok(!`${result.stdout}${result.stderr}`.includes(token), "the refusal must not disclose the file's contents");
  }
  assert.deepEqual(exportStoreDocument(b.handle), EMPTY_DOCUMENT);
});

test("export-project requires --out, refuses to overwrite without --force, and refuses a workspace with no project", async () => {
  const ws = workspace();
  const b = project(ws);
  populate(b);

  const noOut = await anno(ws, b, ["export-project"]);
  assert.notEqual(noOut.code, 0);
  assert.match(noOut.stderr, /--out FILE is required/);

  const existing = join(ws, "existing.json");
  writeFileSync(existing, "KEEP");
  const refused = await anno(ws, b, ["export-project", "--out", existing]);
  assert.notEqual(refused.code, 0);
  assert.match(refused.stderr, /refusing to overwrite/);
  assert.equal(readFileSync(existing, "utf8"), "KEEP");
  const forced = await anno(ws, b, ["export-project", "--out", existing, "--force"]);
  assert.equal(forced.code, 0, forced.stderr);
  assert.equal(JSON.parse(readFileSync(existing, "utf8")).schemaVersion, STORE_EXPORT_SCHEMA_VERSION);

  const fresh = workspace();
  const none = await anno(fresh, noProject(fresh), ["export-project", "--out", join(fresh, "x.json")]);
  assert.notEqual(none.code, 0);
  assert.match(none.stderr, /has no annotation project yet/);
  assert.equal(existsSync(join(fresh, "x.json")), false);
  assert.equal(existsSync(join(fresh, ".c64-re-tools")), false, "an export is a read: it creates no project");
});

test("import-project takes exactly one document, and refuses a missing one by name", async () => {
  const ws = workspace();
  const b = project(ws);
  const none = await anno(ws, b, ["import-project"]);
  assert.notEqual(none.code, 0);
  assert.match(none.stderr, /usage: import-project <file>/);
  const missing = await anno(ws, b, ["import-project", join(ws, "nope.json")]);
  assert.notEqual(missing.code, 0);
  assert.match(missing.stderr, /document not found/);
});
