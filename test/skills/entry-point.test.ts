// entry-point.test.ts
//
// A skill is often installed as a symlink (a plugin cache, `npx skills add`
// with links). Each script must run its CLI when it is started through such a
// link, and not exit 0 with no output.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILLS = join(HERE, "..", "..", "skills");

const SCRIPTS = [
  "c64-annotations/scripts/completeness-report.ts",
  "c64-assembler/scripts/acme.ts",
  "c64-basic/scripts/petcat.ts",
  "c64-disassembler/scripts/disassemble.ts",
  "c64-disk/scripts/c1541.ts",
  "c64-memory-map/scripts/derive.ts",
  "c64-memory-map/scripts/driver.ts",
  "c64-project/scripts/project-paths.ts",
  "c64-project/scripts/releases.ts",
  "c64-provenance/scripts/diff-images.ts",
  "c64-ram-capture/scripts/compare.ts",
  "c64-ram-capture/scripts/compare-cross-binary.ts",
  "c64-ram-capture/scripts/derive-transients.ts",
  "c64-ram-capture/scripts/dump-artifacts.ts",
  "c64-ram-capture/scripts/vsf-slice.ts",
  "c64-ram-capture/scripts/watch-loads.ts",
  "c64-unpacker/scripts/packer-finding.ts",
];

for (const script of SCRIPTS) {
  test(`${script} runs its CLI when started through a symlinked skills folder`, () => {
    const scratch = mkdtempSync(join(tmpdir(), "entry-point-test-"));
    try {
      mkdirSync(join(scratch, ".git"));
      mkdirSync(join(scratch, "recovery"));
      writeFileSync(join(scratch, "recovery", "RELEASES.json"), JSON.stringify({ schema_version: "1.0", releases: [] }));
      symlinkSync(SKILLS, join(scratch, "linked-skills"), "dir");

      const r = spawnSync(process.execPath, [join(scratch, "linked-skills", script)], {
        cwd: scratch,
        encoding: "utf8",
        env: { ...process.env, C64RE_PROJECT_ROOT: scratch, VICE_MCP_DIR: "" },
        timeout: 30_000,
      });
      assert.notEqual(`${r.stdout}${r.stderr}`.trim(), "", `no output at all, exit ${r.status}`);
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }
  });
}
