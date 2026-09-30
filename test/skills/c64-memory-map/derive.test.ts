// derive.test.ts -- the PLA banking table and the required-register refusals.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { main, plaMap } from "../../../skills/c64-memory-map/scripts/derive.ts";

test("plaMap follows the PLA table for $37, $36, $35, $34, $33 and $30", () => {
  assert.deepEqual(plaMap(0x37), { basic: "rom", d000: "io", kernal: "rom" });
  assert.deepEqual(plaMap(0x36), { basic: "ram", d000: "io", kernal: "rom" });
  assert.deepEqual(plaMap(0x35), { basic: "ram", d000: "io", kernal: "ram" });
  assert.deepEqual(plaMap(0x34), { basic: "ram", d000: "ram", kernal: "ram" });
  assert.deepEqual(plaMap(0x33), { basic: "rom", d000: "char rom", kernal: "rom" });
  assert.deepEqual(plaMap(0x30), { basic: "ram", d000: "ram", kernal: "ram" });
});

test("vectors states RAM at $D000 for $34, and BASIC out for $35 even though LORAM is 1", () => {
  const dir = mkdtempSync(join(tmpdir(), "derive-test-"));
  try {
    const image = join(dir, "img.bin");
    writeFileSync(image, Buffer.alloc(65536));
    const r34 = main(["vectors", image, "--port", "34"]);
    assert.equal(r34.ok, true);
    assert.match((r34 as { text: string }).text, /RAM at \$D000-\$DFFF \(LORAM = HIRAM = 0\)/);
    const r35 = main(["vectors", image, "--port", "35", "--all"]);
    assert.match((r35 as { text: string }).text, /DORMANT: BASIC ROM banked out — nothing maintains these/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("sprites and vic refuse a missing register instead of printing NaN or a default", () => {
  for (const argv of [["sprites", "--d015", "FF"], ["sprites", "--dd00", "3E", "--d018", "18"], ["vic", "--dd00", "3E", "--d018", "18"], ["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B"]]) {
    const r = main(argv);
    assert.equal(r.ok, false, argv.join(" "));
    assert.match((r as { message: string }).message, /missing --/);
  }
  const ok = main(["vic", "--dd00", "3E", "--d018", "18", "--d011", "1B", "--d016", "C8"]);
  assert.equal(ok.ok, true);
  assert.match((ok as { text: string }).text, /VIC bank 1/);
});

test("an unknown verb is refused with the usage, and no verb or --help prints it as a success", () => {
  assert.equal(main(["frobnicate"]).ok, false);
  assert.equal(main([]).ok, true);
  assert.equal(main(["--help"]).ok, true);
});
