// Turns a field-test bundle (from the kit's bundle.ts) and the host's trace
// into one report under field-reports/: the files, and summary.md with the
// builds and the clock difference, the failures, the slow operations, the
// host connections, the VICE events, the notes with the trace around each
// one, and the agent's comprehension next to each description.
//
//   node test/field/report.ts <bundle.tgz|bundle-dir> [--host-trace <dir> ...] [--out <dir>]

import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { parseArgs } from "node:util";

import { debugTools } from "../../src/mcp/tools/debug.ts";
import { executionTools } from "../../src/mcp/tools/execution.ts";
import { inputTools } from "../../src/mcp/tools/input.ts";
import { machineTools } from "../../src/mcp/tools/machine.ts";
import { mediaTools } from "../../src/mcp/tools/media.ts";
import { memoryTools } from "../../src/mcp/tools/memory.ts";
import { videoTools } from "../../src/mcp/tools/video.ts";
import { isoCet } from "../../src/time.ts";

const root = resolve(import.meta.dirname, "../..");

/** One trace line, with the file it came from and `at`, its time in ms on the host's clock. */
type Event = Record<string, unknown> & { t: string; kind: string; event: string; file: string; at: number };
type Note = Record<string, unknown> & { t: string; by: string; kind: string; component: string; severity: string; text: string };

function jsonLines<T>(file: string): T[] {
  const out: T[] = [];
  for (const line of readFileSync(file, "utf8").split("\n")) {
    if (line.trim() === "") continue;
    try {
      out.push(JSON.parse(line) as T);
    } catch {
      // A line that a crash cut off is left out.
    }
  }
  return out;
}

function readJson<T>(file: string, fallback: T): T {
  return existsSync(file) ? (JSON.parse(readFileSync(file, "utf8")) as T) : fallback;
}

function* jsonlFiles(dir: string): Generator<string> {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) yield* jsonlFiles(path);
    else if (entry.endsWith(".jsonl")) yield path;
  }
}

/** The events of every trace directory, each file once (one machine puts the host into the same directory). */
function readTrace(dirs: string[]): Event[] {
  const seen = new Set<string>();
  const events: Event[] = [];
  for (const dir of dirs) {
    for (const file of jsonlFiles(dir)) {
      const name = basename(file);
      if (seen.has(name)) continue;
      seen.add(name);
      for (const event of jsonLines<Event>(file)) events.push({ ...event, file: name, at: Date.parse(event.t) });
    }
  }
  return events;
}

/**
 * How far the clients' clock (container) is ahead of the host's, in ms: the
 * median over each client's ready and the host's ready for the same role,
 * which happen within a few milliseconds of each other. Undefined without a pair.
 */
function clockSkew(events: Event[]): { skewMs: number; pairs: number } | undefined {
  const hostReady = events.filter((event) => event.kind === "host" && event.event === "connection.ready");
  const differences: number[] = [];
  for (const client of events.filter((event) => event.kind !== "host" && event.event === "host.ready")) {
    let best: number | undefined;
    for (const host of hostReady) {
      if (host.role !== client.role) continue;
      const difference = client.at - host.at;
      if (Math.abs(difference) < 120_000 && (best === undefined || Math.abs(difference) < Math.abs(best))) best = difference;
    }
    if (best !== undefined) differences.push(best);
  }
  if (differences.length === 0) return undefined;
  differences.sort((a, b) => a - b);
  return { skewMs: differences[Math.floor(differences.length / 2)]!, pairs: differences.length };
}

function failed(event: Event): boolean {
  if (event.ok === false) return true;
  if (event.event.endsWith("-failed")) return true;
  if (event.event === "script.end" && event.error !== undefined) return true;
  if (event.event === "tool.run") return event.code !== 0 || event.timedOut === true || event.spawnError !== undefined;
  return false;
}

function subject(event: Event): string {
  if (event.event === "host.connect") return `${text(event.host)}:${text(event.port)}${event.accepted === true ? " accepted" : " not accepted"}`;
  if (typeof event.op === "string") return event.op;
  if (typeof event.name === "string") return event.name;
  if (Array.isArray(event.argv) && typeof event.argv[0] === "string") return basename(event.argv[0]);
  if (typeof event.line === "string") return event.line.split("\n")[0]!.slice(0, 120);
  return "";
}

function text(value: unknown): string {
  return typeof value === "string" ? value : value === undefined ? "" : JSON.stringify(value);
}

function clock(at: number): string {
  return isoCet(new Date(at)).slice(11, 23);
}

function summary(dir: string, events: Event[], notes: Note[], skew: { skewMs: number; pairs: number } | undefined, hostTraced: boolean): string {
  const run = readJson<Record<string, unknown>>(join(dir, "run.json"), {});
  const bundle = readJson<Record<string, unknown>>(join(dir, "bundle.json"), {});
  const skills = readJson<Record<string, string>>(join(dir, "skills.json"), {});
  const tools = new Map([...machineTools, ...executionTools, ...debugTools, ...memoryTools, ...videoTools, ...inputTools, ...mediaTools].map((tool) => [tool.name, tool.description]));
  const statusText = existsSync(join(dir, "status.txt")) ? readFileSync(join(dir, "status.txt"), "utf8").trim() : "(no status)";
  const knowledge = readJson<unknown>(join(dir, "knowledge-summary.json"), { present: false });

  const lines: string[] = [];
  const h = (level: number, title: string) => lines.push("", `${"#".repeat(level)} ${title}`, "");
  const show = (event: Event) => {
    const extra = failed(event) ? ` — ${text(event.code)} ${text(event.message ?? event.error)}`.trimEnd() : "";
    const ms = typeof event.ms === "number" ? ` (${event.ms} ms)` : "";
    return `${clock(event.at)} ${event.kind} ${event.event} ${subject(event)}${ms}${extra}`;
  };

  lines.push(`# Field report ${text(bundle.createdAt)}`.trimEnd(), "");
  lines.push(`- Project: \`${text(run.project)}\`${run.inContainer === true ? " (in a container)" : ""}`);
  lines.push(`- Package: \`${text(run.spec)}\`, version ${text(run.version) || "?"}. Kit commit ${text(run.kitCommit).slice(0, 8) || "?"}.`);
  lines.push(`- Installed ${text(run.createdAt)}, bundled ${text(bundle.createdAt)}, reported ${isoCet()}.`);
  lines.push(`- Trace: ${events.length} events in ${new Set(events.map((event) => event.file)).size} files${hostTraced ? "" : ", none from the host"}. Notes: ${notes.length}.`);

  h(2, "Builds and clocks");
  const builds = new Map<string, Set<string>>();
  for (const event of events.filter((event) => event.event === "trace.start")) {
    builds.set(event.kind, (builds.get(event.kind) ?? new Set()).add(text(event.version) || "?"));
  }
  for (const [kind, versions] of builds) lines.push(`- ${kind}: ${[...versions].join(", ")}`);
  if (skew === undefined) lines.push(`- Clock difference: unknown (no ready pair of a client and the host).`);
  else lines.push(`- Clock difference: the clients are ${skew.skewMs} ms ${skew.skewMs >= 0 ? "ahead of" : "behind"} the host (median of ${skew.pairs} pairs). The times below are on the host's clock.`);

  h(2, "Status at bundle time");
  lines.push("```", statusText, "```");

  h(2, "Programs and events");
  lines.push("| Kind | Files | Events | Failures | First | Last |", "|---|---|---|---|---|---|");
  for (const kind of [...new Set(events.map((event) => event.kind))]) {
    const own = events.filter((event) => event.kind === kind);
    lines.push(`| ${kind} | ${new Set(own.map((event) => event.file)).size} | ${own.length} | ${own.filter(failed).length} | ${clock(own[0]!.at)} | ${clock(own.at(-1)!.at)} |`);
  }

  h(2, "Failures");
  const failures = events.filter(failed);
  if (failures.length === 0) lines.push("None.");
  const groups = new Map<string, Event[]>();
  for (const event of failures) {
    const key = `${event.kind} ${event.event} ${subject(event)} ${text(event.code)}`.trim();
    groups.set(key, [...(groups.get(key) ?? []), event]);
  }
  for (const [key, own] of [...groups].sort((a, b) => b[1].length - a[1].length)) {
    lines.push(`- **${key}** × ${own.length}`);
    for (const event of own.slice(0, 3)) lines.push(`  - ${clock(event.at)}: ${text(event.message ?? event.error ?? event.stderr).slice(0, 300)}`);
  }

  h(2, "Slowest operations");
  const timed = events.filter((event) => typeof event.ms === "number" && ["request", "tool.call", "tool.run", "script.end", "connection.ready", "vice.ready", "host.ready", "session.opened"].includes(event.event));
  for (const event of [...timed].sort((a, b) => (b.ms as number) - (a.ms as number)).slice(0, 15)) lines.push(`- ${show(event)}`);

  h(2, "Host connections");
  const connects = events.filter((event) => event.event === "host.connect");
  const byAddress = new Map<string, Event[]>();
  for (const event of connects) byAddress.set(`${text(event.host)}:${text(event.port)}`, [...(byAddress.get(`${text(event.host)}:${text(event.port)}`) ?? []), event]);
  if (byAddress.size === 0) lines.push("None.");
  for (const [address, own] of byAddress) {
    const accepted = own.filter((event) => event.accepted === true).length;
    lines.push(`- ${address}: ${accepted} accepted, ${own.length - accepted} not, longest attempt ${Math.max(...own.map((event) => Number(event.ms) || 0))} ms`);
  }
  for (const event of events.filter((event) => ["host.handshake-failed", "connection.refused", "host.closed"].includes(event.event) && (event.event !== "host.closed" || event.byUs !== true))) {
    lines.push(`- ${show(event)} ${text(event.message ?? event.reason ?? event.error)}`);
  }

  h(2, "VICE");
  const count = (name: string) => events.filter((event) => event.event === name).length;
  lines.push(`- Launches: ${count("vice.launch")}, ready: ${count("vice.ready")}, failed: ${count("vice.launch-failed")}, exits: ${count("vice.exit")}, drive stops: ${count("vice.drive-stop")}.`);
  for (const event of events.filter((event) => event.event === "vice.exit")) lines.push(`- ${clock(event.at)} exit pid ${text(event.pid)}: code ${text(event.code)}, signal ${text(event.signal)} after ${text(event.ms)} ms`);
  const vicePattern = /timeout|takes no commands|did not come back|exited unexpectedly|monitor connection lost|not stopped after|headless again/i;
  for (const event of events.filter((event) => event.event === "log" && vicePattern.test(text(event.line))).slice(0, 30)) lines.push(`- ${show(event)}`);

  h(2, "Notes");
  const byComponent = new Map<string, Note[]>();
  for (const note of notes.filter((note) => note.kind !== "comprehension")) byComponent.set(note.component, [...(byComponent.get(note.component) ?? []), note]);
  if (byComponent.size === 0) lines.push("None.");
  // A note is written on the clients' clock.
  const noteAt = (note: Note) => Date.parse(note.t) - (skew?.skewMs ?? 0);
  for (const [component, own] of [...byComponent].sort((a, b) => a[0].localeCompare(b[0]))) {
    h(3, component);
    const ordered = [...own].sort((a, b) => (a.by === b.by ? a.t.localeCompare(b.t) : a.by === "user" ? -1 : 1));
    for (const note of ordered) {
      lines.push(`- **${clock(noteAt(note))} ${note.kind}** (${note.severity}, by ${note.by}): ${note.text}`);
      for (const field of ["intent", "choice", "expected", "actual"] as const) if (note[field] !== undefined) lines.push(`  - ${field}: ${text(note[field])}`);
      // The failures of that minute, then the events nearest to the note.
      const around = events.filter((event) => event.event !== "trace.start" && Math.abs(event.at - noteAt(note)) <= 60_000);
      const nearest = around.filter((event) => !failed(event)).sort((a, b) => Math.abs(a.at - noteAt(note)) - Math.abs(b.at - noteAt(note)));
      const picked = [...around.filter(failed), ...nearest].slice(0, 12).sort((a, b) => a.at - b.at);
      if (picked.length > 0) {
        lines.push("  - trace within a minute:");
        for (const event of picked) lines.push(`    - ${show(event)}`);
      }
    }
  }

  h(2, "Comprehension");
  const comprehension = notes.filter((note) => note.kind === "comprehension");
  if (comprehension.length === 0) lines.push("None.");
  for (const note of comprehension) {
    h(3, note.component);
    const described = skills[note.component] ?? tools.get(note.component);
    if (described !== undefined) lines.push(`- Description: ${described}`);
    lines.push(`- The agent: ${note.text}`);
  }

  h(2, "Knowledge");
  lines.push("```json", JSON.stringify(knowledge, null, 2), "```");
  return `${lines.join("\n")}\n`;
}

function main(): void {
  const { values, positionals } = parseArgs({ allowPositionals: true, options: { "host-trace": { type: "string", multiple: true }, out: { type: "string" } } });
  const source = positionals[0];
  if (source === undefined) {
    console.error("usage: node test/field/report.ts <bundle.tgz|bundle-dir> [--host-trace <dir> ...] [--out <dir>]");
    process.exit(2);
  }
  const out = resolve(values.out ?? join(root, "field-reports"));
  mkdirSync(out, { recursive: true });
  const name = basename(source).replace(/\.tgz$/, "");
  const dir = join(out, name);
  rmSync(dir, { recursive: true, force: true });
  if (source.endsWith(".tgz")) {
    const tar = spawnSync("tar", ["-xzf", resolve(source), "-C", out], { encoding: "utf8" });
    if (tar.status !== 0 || !existsSync(dir)) {
      console.error(`Cannot unpack ${source}: ${tar.stderr || `no ${name}/ inside`}`);
      process.exit(1);
    }
  } else {
    cpSync(resolve(source), dir, { recursive: true });
  }

  const hostTraces = values["host-trace"] ?? [];
  hostTraces.forEach((hostTrace, index) => cpSync(resolve(hostTrace), join(dir, hostTraces.length === 1 ? "host-trace" : `host-trace-${index + 1}`), { recursive: true }));

  const raw = readTrace([join(dir, "trace"), ...readdirSync(dir).filter((entry) => entry.startsWith("host-trace")).map((entry) => join(dir, entry))]);
  const skew = clockSkew(raw);
  // Every time on the host's clock: the clients' events move by the measured difference.
  const events = raw.map((event) => (event.kind === "host" || skew === undefined ? event : { ...event, at: event.at - skew.skewMs })).sort((a, b) => a.at - b.at);
  const notes = existsSync(join(dir, "notes.jsonl")) ? jsonLines<Note>(join(dir, "notes.jsonl")) : [];
  const hostTraced = events.some((event) => event.kind === "host");
  writeFileSync(join(dir, "summary.md"), summary(dir, events, notes, skew, hostTraced));

  console.log(`Report: ${join(dir, "summary.md")}`);
  console.log(`Events: ${events.length}, failures: ${events.filter(failed).length}, notes: ${notes.length}${hostTraced ? "" : ". No host trace: give it with --host-trace"}.`);
}

main();
