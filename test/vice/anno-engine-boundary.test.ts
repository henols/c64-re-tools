// anno-engine-boundary.test.ts -- proof that no path reaches the anno engine.
//
// The engine (`anno-tools.mts`, `anno-reports.mts`) runs where the store lives,
// which is not where the caller's files live. So:
//   * every argument a definition marks `clientFile` is REFUSED when it
//     arrives as a plain string, and accepted when it arrives as a staged
//     reference -- the contrast is what shows the refusal is about the path,
//     not about the call;
//   * the table of calls below covers exactly the verbs that take a client
//     file, derived from the definitions, so a newly marked argument cannot
//     slip past untested;
//   * the engine never reads `handle.path`, so no answer can echo the store's
//     location. A planted line proves the source check can see it.
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { closeStore, openStore } from "../../src/mcp/vice/anno-store.mts";
import { ANNO_TOOL_DEFINITIONS, clientFileKeys, runAnnoToolOnHandle, type AnnoInputFile } from "../../src/mcp/vice/anno-tools.mts";
import { runAnnoReportOnHandle } from "../../src/mcp/vice/anno-reports.mts";
import { VICE_DIR } from "./paths.ts";

const STAGED_REFUSAL = /did not arrive as a staged file/;

/** A tiny PRG: load address $0801, then `lda #$00` / `rts`. */
const PRG = new Uint8Array([0x01, 0x08, 0xa9, 0x00, 0x60]);
const EXPORT_TEXT = new TextEncoder().encode(["## REFERENCES", "$0801 -> $d020 WRITE", "## REFERENCE_COUNT 1", ""].join("\n"));

/** One minimal, otherwise-valid call per verb that takes a client file, with
 * each file argument given as `file`. */
function callsWith(file: unknown): Record<string, Record<string, unknown>> {
  return {
    anno_disassemble: { image: file, address: "$0801" },
    anno_read_region: { image: file, start_address: "$0801", end_address: "$0802" },
    anno_get_binary_info: { image: file },
    anno_get_cross_references: { image: file, address: "$0801", max_results: 1 },
    anno_search: { image: file, query: "x", max_results: 1 },
    anno_get_address_details: { image: file, address: "$0801" },
    anno_join_memmap: { image: file },
    anno_hazard_report: { image: file },
    anno_import_ghidra_export: { export_path: file },
    anno_batch_execute: { image: file, calls: [{ name: "anno_get_binary_info", arguments: {} }] },
  };
}

function withHandle(body: (handle: ReturnType<typeof openStore>) => Promise<void>): Promise<void> {
  const dir = mkdtempSync(join(tmpdir(), "anno-engine-"));
  const handle = openStore(join(dir, "proj.annostore"), { workspaceRoot: dir });
  return body(handle).finally(() => {
    closeStore(handle);
    rmSync(dir, { recursive: true, force: true });
  });
}

test("the call table covers exactly the verbs whose definitions mark a client file", () => {
  const marked = ANNO_TOOL_DEFINITIONS.filter((d) => clientFileKeys(d.name).length > 0).map((d) => d.name).sort();
  assert.deepEqual(Object.keys(callsWith("x")).sort(), marked);
  assert.ok(marked.includes("anno_import_ghidra_export") && marked.includes("anno_disassemble"), "both file kinds are marked");
});

test("every client-file argument is refused as a plain path, and the same call with a staged reference gets past that refusal", async () => {
  await withHandle(async (handle) => {
    for (const [name, args] of Object.entries(callsWith("/home/someone/game.prg"))) {
      const refused = await runAnnoToolOnHandle(handle, name, args, new Map());
      const text = refused.content[0]!.text;
      if (name === "anno_batch_execute") {
        // The batch answers per entry: the inner call inherits the unstaged
        // image and its entry carries the refusal.
        assert.match(text, STAGED_REFUSAL, `${name}: the inner entry must refuse the plain path`);
      } else {
        assert.equal(refused.isError, true, `${name} must refuse a plain path`);
        assert.match(text, STAGED_REFUSAL, `${name}: ${text}`);
      }
    }
    const inputs = new Map<string, AnnoInputFile>([["f0", { name: "game.prg", bytes: PRG }]]);
    const exportInputs = new Map<string, AnnoInputFile>([["f0", { name: "export.txt", bytes: EXPORT_TEXT }]]);
    for (const [name, args] of Object.entries(callsWith({ $file: "f0" }))) {
      const accepted = await runAnnoToolOnHandle(handle, name, args, name === "anno_import_ghidra_export" ? exportInputs : inputs);
      assert.doesNotMatch(accepted.content[0]!.text, STAGED_REFUSAL, `${name} must accept a staged reference`);
    }
  });
});

test("a staged reference to a slot the call did not send is refused by name", async () => {
  await withHandle(async (handle) => {
    const result = await runAnnoToolOnHandle(handle, "anno_get_binary_info", { image: { $file: "f9" } }, new Map());
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /names staged file "f9", which was not sent with the call/);
  });
});

/** Code lines of a module that name the handle's path. */
function handlePathUses(source: string): string[] {
  return source.split("\n").filter((line) => !/^\s*(\/\/|\*)/.test(line) && /\bhandle\.path\b/.test(line));
}

test("the engine never reads handle.path, so no answer can echo where the store lives", () => {
  assert.deepEqual(handlePathUses(readFileSync(join(VICE_DIR, "anno-tools.mts"), "utf8")), []);
  assert.deepEqual(handlePathUses("  return { store: handle.path, symbols };\n"), ["  return { store: handle.path, symbols };"], "planted: the check sees a use");
});

/** One minimal call per report whose inputs include a staged file, with
 * each file input given as `file`. */
function reportCallsWith(file: unknown): Record<string, Record<string, unknown>> {
  return {
    "render-memmap": { sidecar: file, sidecar_location: "p" },
    coverage: { image: file },
    "export-asm": { image: file },
    "decomp-completeness": { disagreements: file, manifest_entry: { path: "x.prg", execution: "executed", reason: null } },
    "hazard-report": { image: file },
    "import-project": { document: file },
  };
}

test("every report file input is refused as a plain path", async () => {
  await withHandle(async (handle) => {
    for (const [name, args] of Object.entries(reportCallsWith("/home/someone/file"))) {
      await assert.rejects(runAnnoReportOnHandle(handle, name, args, new Map()), STAGED_REFUSAL, `${name} must refuse a plain path`);
    }
    await assert.rejects(runAnnoReportOnHandle(handle, "export-asm", { image: { $file: "f0" }, ledger: "/home/someone/PROVENANCE.md" }, new Map([["f0", { name: "game.prg", bytes: PRG }]])), STAGED_REFUSAL);
  });
});

test("the report engine never reads handle.path", () => {
  assert.deepEqual(handlePathUses(readFileSync(join(VICE_DIR, "anno-reports.mts"), "utf8")), []);
});
