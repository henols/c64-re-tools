// anno-client-refusals.test.ts -- the three ways the client cannot reach the
// workspace's annotation project, each refused by name with nothing created:
//
//   - no broker answering (a REAL dial against a port nobody listens on);
//   - a broker from before this checkout, which answers `unknown op: anno_run`
//     (broker-control.mts's own unknown-op reply, injected as the runner's
//     answer -- starting a genuinely old broker is not possible from here);
//   - a malformed .c64-re-tools/project.json, refused before the broker is
//     asked and never rewritten.
import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:net";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { runAnnoTool } from "./anno-call-client.ts";
import { runAnnoCli } from "./anno-cli.ts";
import { runAnnoRemote, type AnnoRemoteCall, type AnnoRemoteResult } from "./anno-remote.ts";
import { mintProjectId, persistProjectId } from "./anno-project.ts";

async function withWorkspace<T>(fn: (ws: string) => Promise<T>): Promise<T> {
  const ws = mkdtempSync(join(tmpdir(), "anno-client-refusals-"));
  try {
    return await fn(ws);
  } finally {
    rmSync(ws, { recursive: true, force: true });
  }
}

/** A port that was free a moment ago and has nobody listening on it now. */
async function deadPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await new Promise<void>((resolveClose) => server.close(() => resolveClose()));
  return port;
}

async function withCapturedConsole<T>(fn: () => Promise<T>): Promise<{ result: T; stdout: string; stderr: string }> {
  const origLog = console.log;
  const origError = console.error;
  const out: string[] = [];
  const err: string[] = [];
  console.log = (...args: unknown[]) => void out.push(args.map(String).join(" "));
  console.error = (...args: unknown[]) => void err.push(args.map(String).join(" "));
  try {
    const result = await fn();
    return { result, stdout: out.join("\n"), stderr: err.join("\n") };
  } finally {
    console.log = origLog;
    console.error = origError;
  }
}

const projectFile = (ws: string) => join(ws, ".c64-re-tools", "project.json");
const SET_LABEL = { address: 0xc000, name: "refusal_label" };

test("no broker answering: a first write is refused naming the broker, and project.json is NOT created", async () => {
  const port = await deadPort();
  const runRemote = (call: AnnoRemoteCall) => runAnnoRemote(call, { port, candidates: ["127.0.0.1"] });
  await withWorkspace(async (ws) => {
    const result = await runAnnoTool("anno_set_label_name", SET_LABEL, { runRemote, workspaceRoot: ws });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /no broker answered/, `the refusal must name the broker; got ${result.content[0]!.text}`);
    assert.equal(existsSync(projectFile(ws)), false, "a write that never reached the broker must not persist a project id");
  });
});

test("no broker answering: a report is refused naming the broker, and writes nothing", async () => {
  const port = await deadPort();
  const runRemote = (call: AnnoRemoteCall) => runAnnoRemote(call, { port, candidates: ["127.0.0.1"] });
  await withWorkspace(async (ws) => {
    persistProjectId(ws, mintProjectId());
    const { result: code, stderr } = await withCapturedConsole(() => runAnnoCli(["evid-disagreements"], { runRemote, workspaceRoot: ws }));
    assert.notEqual(code, 0);
    assert.match(stderr, /no broker answered/, `the refusal must name the broker; got ${stderr}`);
  });
});

/** What a broker from before this checkout answers to `anno_run`. */
const oldBroker = async (): Promise<AnnoRemoteResult> => ({ ok: false, code: "bad_request", message: "unknown op: anno_run" });

test("an old broker: a first write is refused with the restart remedy, and project.json is NOT created", async () => {
  await withWorkspace(async (ws) => {
    const result = await runAnnoTool("anno_set_label_name", SET_LABEL, { runRemote: oldBroker, workspaceRoot: ws });
    assert.equal(result.isError, true);
    assert.match(result.content[0]!.text, /does not know anno_run/);
    assert.match(result.content[0]!.text, /start the broker from this checkout/);
    assert.equal(existsSync(projectFile(ws)), false);
  });
});

test("an old broker: a report in a workspace that has a project is refused with the same remedy", async () => {
  await withWorkspace(async (ws) => {
    persistProjectId(ws, mintProjectId());
    const { result: code, stderr } = await withCapturedConsole(() => runAnnoCli(["evid-disagreements"], { runRemote: oldBroker, workspaceRoot: ws }));
    assert.notEqual(code, 0);
    assert.match(stderr, /start the broker from this checkout/);
  });
});

test("a malformed project.json is refused by name before the broker is asked, and is never rewritten", async () => {
  for (const body of ["{not json", JSON.stringify({ project_id: "not-a-uuid" })]) {
    await withWorkspace(async (ws) => {
      mkdirSync(join(ws, ".c64-re-tools"));
      writeFileSync(projectFile(ws), body);
      let asked = 0;
      const runRemote = async (): Promise<AnnoRemoteResult> => {
        asked++;
        return { ok: false, code: "unreachable", message: "must not be dialled" };
      };

      const write = await runAnnoTool("anno_set_label_name", SET_LABEL, { runRemote, workspaceRoot: ws });
      assert.equal(write.isError, true);
      assert.match(write.content[0]!.text, /project\.json/, `a write must name the file it refused; got ${write.content[0]!.text}`);

      const report = await withCapturedConsole(() => runAnnoCli(["evid-disagreements"], { runRemote, workspaceRoot: ws }));
      assert.notEqual(report.result, 0);
      assert.match(report.stderr, /project\.json/, `a report must name the file it refused; got ${report.stderr}`);

      assert.equal(asked, 0, "the broker must not be asked on behalf of a project id nobody can read");
      assert.equal(readFileSync(projectFile(ws), "utf8"), body, "a malformed project.json is refused, never regenerated");
    });
  }
});
