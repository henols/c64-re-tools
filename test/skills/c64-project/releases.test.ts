// releases.test.ts -- the registry CLI: list, register, add-dump.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, "..", "..", "..", "skills", "c64-project", "scripts", "releases.ts");

function project() {
  const root = mkdtempSync(join(tmpdir(), "releases-test-"));
  mkdirSync(join(root, ".git"));
  const regPath = join(root, "recovery", "RELEASES.json");
  return {
    root,
    regPath,
    registry: () => JSON.parse(readFileSync(regPath, "utf8")),
    run: (...argv: string[]) => {
      const r = spawnSync(process.execPath, [SCRIPT, ...argv, "--json"], {
        cwd: root,
        encoding: "utf8",
        env: { ...process.env, C64RE_PROJECT_ROOT: root, C64RE_DATA_DIR: "", C64RE_REGISTRY: "" },
        timeout: 30_000,
      });
      const lines = r.stdout.trim().split("\n");
      assert.equal(lines.length, 1, `--json prints only the result line:\n${r.stdout}`);
      return { status: r.status, result: JSON.parse(lines[0]) };
    },
    cleanup: () => rmSync(root, { recursive: true, force: true }),
  };
}

test("register creates the registry and adds a release with an empty dumps array", () => {
  const p = project();
  try {
    const r = p.run("register", "--id", "release-a", "--disk-image", "disks/a.d64", "--canonical");
    assert.equal(r.status, 0, JSON.stringify(r.result));
    assert.deepEqual(p.registry().releases, [{ id: "release-a", canonical: true, disk_image: "disks/a.d64", dumps: [] }]);
    const list = p.run("list");
    assert.deepEqual(list.result.releases, [{ id: "release-a", canonical: true, disk_image: "disks/a.d64", dumps: 0 }]);
  } finally {
    p.cleanup();
  }
});

test("register refuses a duplicate id, a second canonical release and an id that is not one path segment", () => {
  const p = project();
  try {
    assert.equal(p.run("register", "--id", "release-a", "--disk-image", "a.d64", "--canonical").status, 0);
    assert.match(p.run("register", "--id", "release-a", "--disk-image", "a.d64").result.message, /already in the registry/);
    assert.match(p.run("register", "--id", "release-b", "--disk-image", "b.d64", "--canonical").result.message, /already canonical/);
    assert.match(p.run("register", "--id", "../evil", "--disk-image", "b.d64").result.message, /must match/);
    assert.equal(p.registry().releases.length, 1);
  } finally {
    p.cleanup();
  }
});

test("add-dump records a write-set result as a dumps entry and refuses a second one with the same label", () => {
  const p = project();
  try {
    p.run("register", "--id", "release-a", "--disk-image", "a.d64");
    const ws = {
      ok: true,
      release: "release-a",
      label: "run1",
      bin: "recovery/release-a/dumps/release-a-run1.bin",
      state: "recovery/release-a/dumps/release-a-run1.state.json",
      map: "recovery/release-a/dumps/release-a-run1.map.json",
      capture: "recovery/release-a/dumps/release-a-run1.capture.json",
      sha256: "ab".repeat(32),
    };
    writeFileSync(join(p.root, "set.json"), `some text\n${JSON.stringify(ws)}\n`);
    const r = p.run("add-dump", "--from", "set.json");
    assert.equal(r.status, 0, JSON.stringify(r.result));
    assert.deepEqual(p.registry().releases[0].dumps, [
      { label: "run1", bin: ws.bin, sha256: ws.sha256, capture_record: ws.capture, chip_state: ws.state, range_manifest: ws.map },
    ]);
    const again = p.run("add-dump", "--from", "set.json");
    assert.equal(again.status, 1);
    assert.match(again.result.message, /already has a dump labelled "run1"/);
    assert.equal(p.run("add-dump", "--from", "set.json", "--force").status, 0);
    assert.equal(p.registry().releases[0].dumps.length, 1);
  } finally {
    p.cleanup();
  }
});

test("add-dump refuses a failed write-set result", () => {
  const p = project();
  try {
    p.run("register", "--id", "release-a", "--disk-image", "a.d64");
    writeFileSync(join(p.root, "set.json"), JSON.stringify({ ok: false, message: "assembleImage: gap before address $3000" }));
    const r = p.run("add-dump", "--from", "set.json");
    assert.equal(r.status, 1);
    assert.match(r.result.message, /not a successful write-set result/);
  } finally {
    p.cleanup();
  }
});

test("list refuses, naming the release, when a release entry has no dumps array", () => {
  const p = project();
  try {
    mkdirSync(join(p.root, "recovery"));
    writeFileSync(p.regPath, JSON.stringify({ releases: [{ id: "release-a", disk_image: "a.d64" }] }));
    const r = p.run("list");
    assert.equal(r.status, 1);
    assert.match(r.result.message, /release "release-a" has no "dumps" array/);
  } finally {
    p.cleanup();
  }
});

test("a missing registry and an unknown command are refusals, not crashes", () => {
  const p = project();
  try {
    assert.match(p.run("list").result.message, /no registry at/);
    const r = p.run("frobnicate");
    assert.equal(r.status, 1);
    assert.match(r.result.message, /unknown command "frobnicate"/);
  } finally {
    p.cleanup();
  }
});
