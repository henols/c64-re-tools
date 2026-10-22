// The retro-testing script. test runs a scenario on the original and the
// rebuild in one emulator; run runs steps on one side and writes what they
// ask for; record and replay play a session in the replay core (c64run) and
// compare the rebuild with it; diff shows what changed between two states;
// checklist gives the Markdown list for a human tester.

import { projectMainSpace } from "#src/knowledge/names.ts";
import { COVERAGE } from "#src/cpu/coverage.ts";
import { formatAddress } from "#src/address.ts";
import { isRefusal, Refusal } from "#src/errors.ts";
import { WireFailure } from "#src/host-client/tools.ts";
import { readPrg } from "#src/host-client/image.ts";
import { writeReported, type Written } from "#src/host-client/transfer.ts";
import { ViceSessionClient } from "#src/host-client/vice-session.ts";
import { C64RunSession, PAL_FRAME_CYCLES } from "#src/native/c64run.ts";
import { ZX_FRAME_CYCLES, ZxRunSession } from "#src/native/zxrun.ts";
import { openForRead } from "#src/knowledge/database.ts";
import { machineOf } from "#src/knowledge/project-machine.ts";
import { readZxRebuild, readZxRecordFile, readZxRecording, ZX_RECORDING_FILES, zxProgramProblem, zxRamDifferences, zxRamParts, zxRecord, zxReplay, zxVerdict, type ZxReplaySide } from "./lib/zx-recording.ts";
import { localToolContext } from "#src/native/local.ts";
import { Workspace } from "#src/native/staging.ts";
import { knowledgeNames } from "#src/knowledge/names.ts";
import { LOCAL_DIRECTORY, PROJECT_DIRECTORY, projectRelative } from "#src/project.ts";
import { listed, OPTIONS, reply, runScript, UsageError, type Call, type CommandSpec, type Reply } from "#src/script.ts";
import type { Machine } from "#src/machine.ts";
import { diffFiles } from "./lib/diff-files.ts";
import { CANCELLED, play } from "./lib/play.ts";
import { readRecordFile, record, RECORDING_FILES, recordingFolder } from "./lib/recording.ts";
import { replay } from "./lib/replay.ts";
import { runFile } from "./lib/runs.ts";
import { namesOf, readScenario, runScenario, scenarioNames, type Scenario, type ScenarioResult } from "./lib/scenario.ts";

/** The default port of the --play page: next to the Host Runtime's 6464. */
const DEFAULT_HTTP_PORT = 6465;

/** Behavior that only a person can judge. */
const ALWAYS = [
  "The controls respond as fast as in the original.",
  "The animation is smooth and has no glitches.",
  "The music and the sound effects sound the same as in the original.",
  "The game flow and the level changes work from start to end.",
  "Nothing unexpected happens outside the tested scenarios.",
];

/** The hint of a test or replay verdict: what to do after a FAIL or an INCONCLUSIVE. */
const INCONCLUSIVE_HINT = "reason tells why the script could not compare. This is not a failure of the program. Correct the cause, then run the command again.";

async function test(call: Call): Promise<ScenarioResult | Reply> {
  refuseOtherMachine("test");
  const scenario = readScenario(call.subject(0));
  const out = call.string("out");
  // Every file of the scenario is checked before the emulator starts.
  const names = scenarioNames(scenario, call.subject(0));
  let client: ViceSessionClient;
  try {
    client = await ViceSessionClient.open({ videoStandard: scenario.videoStandard ?? "pal" });
  } catch (error) {
    if (!(error instanceof WireFailure)) throw error;
    return reply({ result: "INCONCLUSIVE", scenario: scenario.name, reason: `no emulator: ${error.message}`, checkpoints: [], differences: [] }, { hint: "The emulator did not start. Give error and reason to the user." });
  }
  try {
    const result = await runScenario(client, scenario, { names, max: call.count("max-listed")!, ...(out === undefined ? {} : { out }) });
    if (result.result === "INCONCLUSIVE") return reply(result, { hint: INCONCLUSIVE_HINT });
    if (result.result === "FAIL") return reply(result, { hint: `Examine the first difference in the emulator at its checkpoint.${out === undefined ? " Give --out to get the screens and all differing bytes as files." : ""}` });
    return result;
  } finally {
    await client.close();
  }
}

/** The machine of the project: a ZX Spectrum records and replays in zxrun. */
function projectMachine(): Machine {
  const db = openForRead();
  try {
    return machineOf(db);
  } finally {
    db?.close();
  }
}

const spectrumProject = () => projectMachine().family === "spectrum";

/** test and run start a C64 in VICE: in a project of another machine they refuse before they read a file. */
function refuseOtherMachine(command: string): void {
  const machine = projectMachine();
  if (machine.family === "c64") return;
  throw new UsageError(`${command} is for a C64 program, and this project is a ${machine.name} project.`, {
    hint: "Record a session of the snapshot of the program with record. Then replay the recording on the original and on the rebuild with replay.",
  });
}

/** record for a ZX Spectrum program: the steps on its snapshot in zxrun. */
async function zxRecordCommand(call: Call): Promise<Record<string, unknown>> {
  if (call.flag("play") || call.count("joystick") !== undefined || call.count("http-port") !== undefined) throw new UsageError("--play, --joystick and --http-port are for a C64 program");
  const out = call.string("out")!;
  const file = readZxRecordFile(call.subject(0));
  const context = localToolContext();
  const core = await ZxRunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-record-");
  try {
    const outcome = await zxRecord(core, file, workspace);
    const files = [
      writeReported(`${out}/${ZX_RECORDING_FILES.recording}`, `${JSON.stringify(outcome.recording, null, 2)}\n`, { what: "--out" }),
      writeReported(`${out}/${ZX_RECORDING_FILES.reads}`, outcome.reads, { what: "--out" }),
      writeReported(`${out}/${ZX_RECORDING_FILES.coverage}`, outcome.coverage, { what: "--out" }),
      writeReported(`${out}/${ZX_RECORDING_FILES.program}`, outcome.program, { what: "--out" }),
    ];
    return {
      result: "PASS",
      recorded: true,
      out,
      name: file.name,
      frames: Math.round(outcome.recording.ticks / ZX_FRAME_CYCLES[outcome.recording.machine === "spectrum128" ? "128k" : "48k"]),
      inputSites: outcome.recording.sites.length,
      executed: outcome.coverage.reduce((count, byte) => count + ((byte & COVERAGE.ramExecute) === 0 ? 0 : 1), 0),
      files,
    };
  } finally {
    await core.close();
    workspace.remove();
  }
}

/** The number of changed RAM ranges that the body of a ZX Spectrum replay lists. */
const ZX_LISTED_RANGES = 16;

/**
 * replay for a ZX Spectrum program: the original, and the rebuild over the
 * snapshot, must end with the recorded tick and RAM. A rebuild that does not
 * gives the changed ranges of its RAM against the original's, and with --out
 * the RAM of both sides as files.
 */
async function zxReplayCommand(call: Call): Promise<Reply | Record<string, unknown>> {
  for (const option of ["checkpoint", "state", "pin", "symbols"]) {
    if (call.strings(option).length > 0) throw new UsageError(`--${option} is for a C64 program. A ZX Spectrum replay compares the tick and the RAM at the end`);
  }
  const rebuildPath = call.string("rebuild");
  const at = call.address("rebuild-at");
  const out = call.string("out");
  if ((rebuildPath === undefined) !== (at === undefined)) throw new UsageError("give --rebuild and --rebuild-at together: the bytes of the rebuild and the address of their first byte");
  if (out !== undefined && rebuildPath === undefined) throw new UsageError("--out writes the RAM of the original and the rebuild, and --rebuild is missing. Give --rebuild and --rebuild-at too, or leave out --out.");
  const folder = recordingFolder(call.subject(0));
  const recording = readZxRecording(folder);
  // The rebuild is checked before the replay core starts.
  const rebuild = rebuildPath === undefined ? undefined : readZxRebuild(rebuildPath, at!);
  const changed = zxProgramProblem(folder, recording);
  if (changed !== undefined) {
    return reply({ result: "INCONCLUSIVE", recording: folder, reason: changed, sides: [] }, { hint: "The program file of the recording changed, so the recording is no reference. Record the session again." });
  }
  const context = localToolContext();
  const sides: Array<{ side: "original" | "rebuild"; problem?: string; ticks: number; hash: string }> = [];
  const ends: ZxReplaySide[] = [];
  for (const side of rebuild === undefined ? (["original"] as const) : (["original", "rebuild"] as const)) {
    const core = await ZxRunSession.open(context);
    const workspace = Workspace.create(context.supervisor, "c64-re-tools-replay-");
    try {
      const outcome = await zxReplay(core, folder, recording, workspace, side === "rebuild" ? rebuild : undefined);
      const problem = zxVerdict(recording, outcome);
      sides.push({ side, ticks: outcome.ticks, hash: outcome.hash, ...(problem === undefined ? {} : { problem }) });
      ends.push(outcome);
    } finally {
      await core.close();
      workspace.remove();
    }
    // An original that does not end as recorded makes the recording no reference: the rebuild does not run.
    if (sides[0]!.problem !== undefined) {
      return reply(
        { result: "INCONCLUSIVE", recording: folder, reason: `the recording does not reproduce on the original: ${sides[0]!.problem}`, sides },
        { hint: "The original does not end with the tick and the RAM of the recording, so the recording is no reference. Record the session again." },
      );
    }
  }
  const rebuilt = sides[1];
  if (rebuilt?.problem === undefined) return { result: "PASS", recording: folder, sides };
  const parts = zxRamParts(ends[0]!.banks, ends[1]!.banks).filter((part) => !Buffer.from(part.original).equals(Buffer.from(part.rebuild)));
  const differences = zxRamDifferences(parts);
  const files: Written[] = [];
  if (out !== undefined) {
    for (const part of parts) {
      const suffix = part.bank === undefined ? "" : `-ram${part.bank}`;
      files.push(writeReported(`${out}/original${suffix}.bin`, part.original, { what: "--out" }), writeReported(`${out}/rebuild${suffix}.bin`, part.rebuild, { what: "--out" }));
    }
  }
  const show = (range: (typeof differences.ranges)[number]) => ({
    ...(range.bank === undefined ? {} : { bank: range.bank }),
    start: formatAddress(range.start),
    end: formatAddress(range.end),
    ...(range.a === undefined ? {} : { original: range.a, rebuild: range.b }),
  });
  const rest = out === undefined ? "--out <dir>, then compare the RAM files with diff" : "the RAM files in files to diff";
  const body = {
    result: "FAIL",
    recording: folder,
    reason: `the rebuild does not end as the original: ${rebuilt.problem}`,
    sides,
    ...(parts.length === 0 ? {} : { memory: { changedBytes: differences.changedBytes, ...listed(differences.ranges, ZX_LISTED_RANGES, show, rest) } }),
    ...(out === undefined ? {} : { files }),
  };
  const first = parts[0];
  if (first === undefined) return reply(body, { hint: "The RAM at the end is the RAM of the original, but the input reads or the tick are different. reason tells which. Examine the rebuild in the emulator." });
  if (out === undefined) return reply(body, { hint: "memory lists the changed ranges of the RAM at the end: original and rebuild give the bytes of a short range. Give --out to get the RAM of both sides as files." });
  const suffix = first.bank === undefined ? "" : `-ram${first.bank}`;
  return reply(body, {
    hint: `files holds the RAM of each side at the end${first.bank === undefined ? "" : ", one file for each changed bank"}. Run nextAction to compare them${parts.length > 1 ? " for the first changed bank" : ""}. Then find the code that writes the first changed address.`,
    nextAction: call.next("diff", `${out}/original${suffix}.bin`, `${out}/rebuild${suffix}.bin`, "--address", formatAddress(first.at)),
  });
}

async function recordCommand(call: Call): Promise<Reply> {
  if (spectrumProject()) {
    const out = call.string("out")!;
    return reply(await zxRecordCommand(call), {
      hint: `Commit ${out} with the scenarios. Add ${out}/${ZX_RECORDING_FILES.coverage} to the project knowledge as coverage. To make sure that the recording replays, run nextAction. Give --rebuild and --rebuild-at to compare a rebuild.`,
      nextAction: call.next("replay", out),
    });
  }
  const playing = call.flag("play");
  if (!playing && (call.count("joystick") !== undefined || call.count("http-port") !== undefined)) throw new UsageError("--joystick and --http-port need --play. Give --play, or leave out these flags.");
  const joystick = (call.count("joystick") ?? 2) as 1 | 2;
  const httpPort = call.count("http-port") ?? DEFAULT_HTTP_PORT;
  const out = call.string("out")!;
  const file = readRecordFile(call.subject(0));
  // The program and the symbols are checked before the replay core starts.
  for (const [field, check] of [["program", () => readPrg(file.program)], ["symbols", () => namesOf(file.symbols)]] as const) {
    try {
      check();
    } catch (error) {
      if (isRefusal(error)) throw new Refusal(error.code, `record file ${call.subject(0)}: ${field}: ${error.message}`);
      throw error;
    }
  }
  const context = localToolContext();
  const core = await C64RunSession.open(context);
  const workspace = Workspace.create(context.supervisor, "c64-re-tools-record-");
  try {
    const person = playing
      ? (session: C64RunSession, restore: () => Promise<string | undefined>) => {
          const ready = (url: string) =>
            process.stderr.write("Open " + url + ". The start screen is frozen. Enter or Start begins the play, F12 or End saves the recording, F11 or Cancel ends without one. F9 changes the joystick port.\n");
          return play(session, { httpPort, joystick, ready, restore });
        }
      : undefined;
    const outcome = await record(core, file, workspace, person);
    const summary = {
      name: file.name,
      frames: Math.round(outcome.recording.ticks / PAL_FRAME_CYCLES),
      inputSites: outcome.recording.sites.length,
      events: outcome.recording.events.length,
      // The instructions in the coverage map: 0 when the coverage never started.
      executed: outcome.coverage.reduce((count, byte) => count + ((byte & COVERAGE.ramExecute) === 0 ? 0 : 1), 0),
      // The frame and the instruction where the map starts: the code before them has no marks.
      coverageFrom: outcome.coverageFrom === undefined ? null : { frame: Math.floor(outcome.coverageFrom.tick / PAL_FRAME_CYCLES), pc: formatAddress(outcome.coverageFrom.pc) },
    };
    if (outcome.reason === CANCELLED) return reply({ result: "FAIL", recorded: false, reason: outcome.reason, ...summary }, { hint: "Ask the user what to do. Do not make a scripted recording in place of the session of the user." });
    if (outcome.reason !== undefined) return reply({ result: "FAIL", recorded: false, reason: outcome.reason, ...summary }, { hint: "reason names the step that did not complete. Change that step, then record again." });
    const files = [
      writeReported(`${out}/${RECORDING_FILES.recording}`, `${JSON.stringify(outcome.recording, null, 2)}\n`, { what: "--out" }),
      writeReported(`${out}/${RECORDING_FILES.reads}`, outcome.reads, { what: "--out" }),
      writeReported(`${out}/${RECORDING_FILES.coverage}`, outcome.coverage, { what: "--out" }),
    ];
    // A recording in the local folder is a work file: git ignores it, so it is no test.
    const keep = projectRelative(out).startsWith(`${PROJECT_DIRECTORY}/${LOCAL_DIRECTORY}/`)
      ? `Git ignores ${out}. To keep the recording as a test, record again with --out tests/recordings/<name>.`
      : `Commit ${out} with the scenarios.`;
    return reply(
      { result: "PASS", recorded: true, out, ...summary, files },
      { hint: `${keep} Add ${out}/${RECORDING_FILES.coverage} to the project knowledge as coverage. ${summary.coverageFrom === null ? "The coverage did not start: the map is empty." : "The map has no marks for the code that ran before coverageFrom."} To make sure that the recording replays, run nextAction.`, nextAction: call.next("replay", out) },
    );
  } finally {
    await core.close();
    workspace.remove();
  }
}

function checklist(call: Call): { text: string } {
  const lines = ["# Playtest checklist", ""];
  for (const path of call.subjects) {
    const scenario: Scenario = readScenario(path);
    lines.push(`## ${scenario.name}`, "");
    for (const step of scenario.steps) if ("observe" in step) lines.push(`- [ ] At "${step.observe}", the rebuild looks and behaves as the original.`);
    lines.push("");
  }
  lines.push("## Application", "");
  for (const item of call.strings("item")) lines.push(`- [ ] ${item}`);
  for (const item of ALWAYS) lines.push(`- [ ] ${item}`);
  return { text: `${lines.join("\n")}\n` };
}

const STATE_ITEM = "a name or a $ address, with :size for more than one byte, for example room:2";

const COMMANDS: CommandSpec[] = [
  {
    name: "test",
    summary: "Runs a scenario on the original and then on the rebuild in one emulator. result is PASS, FAIL with the differences, or INCONCLUSIVE with the reason.",
    subjects: [{ name: "<scenario.json>", help: "a scenario file, relative to the project folder. See references/scenario-format.md" }],
    options: {
      out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "with a FAIL, write both screens, the difference image and memory.json into this folder: each differing memory item with all its bytes, and each byte that differs" },
      "max-listed": { ...OPTIONS["max-listed"], help: "list at most n differing bytes of each memory item (default 50). The count is always given" },
    },
    run: test,
  },
  {
    name: "run",
    summary: "Runs the steps of a run file in its own emulator and writes what they ask for into --out: screens, coverage maps, snapshot files, traces, and results.json with the observations and the expectations. result is FAIL when a step did not run or an expect step found a value that differs.",
    subjects: [{ name: "<run.json>", help: "a run file, relative to the project folder. See references/scenario-format.md, section Runs" }],
    options: { out: { ...OPTIONS.out, output: "folder", value: "<dir>", required: true, help: "the folder for the files of the steps and results.json" } },
    notes: 'A run file is one JSON object. It must have name, start and steps. name is a non-empty string. start is { "program": "<file.prg>" }, { "program": "<file.prg>", "load": true } or { "snapshot": "<file.vsf>" }. steps is a list with at least one step. Optional: symbols ("knowledge", "none" (default) or a JSON file) and videoStandard ("pal" (default) or "ntsc"). The script refuses other keys.',
    run: async (call) => {
      refuseOtherMachine("run");
      const { output, failed } = await runFile(call.subject(0), call.string("out")!);
      if (!failed) return { result: "PASS", ...output };
      const hint = output.reason !== undefined ? "reason tells why a step did not run. Correct the step or the start, then run again." : "failedExpectations names the expect steps that failed. expectations in results.json gives the expected and the actual values.";
      return reply({ result: "FAIL", ...output }, { hint });
    },
  },
  {
    name: "record",
    summary: "Plays the steps of a record file on the original, and writes the session as a recording folder: recording.json, reads.txt and coverage.bin. result is FAIL when the session did not complete.",
    subjects: [{ name: "<record.json>", help: "a record file, relative to the project folder. See references/recording-format.md" }],
    options: {
      out: { ...OPTIONS.out, output: "folder", value: "<dir>", required: true, help: "the recording folder, for example tests/recordings/<name>" },
      play: { kind: "flag", help: "a person plays after the steps: the script prints the address of a page on stderr. The page shows the start screen frozen until Start (Enter). End (F12) saves the recording, Cancel (F11) ends without one" },
      joystick: { kind: "count", value: "<1|2>", min: 1, max: 2, help: "with --play: the joystick port that the program reads, at the start (default 2). F9 on the page changes it" },
      "http-port": { kind: "count", value: "<n>", min: 0, max: 65535, help: `with --play: the port of the page (default ${DEFAULT_HTTP_PORT})` },
    },
    run: recordCommand,
  },
  {
    name: "replay",
    summary: "Replays a recording on the original, which must end with the recorded state, and with --rebuild on the rebuild, which must have the state of the original at each checkpoint. result is PASS, FAIL or INCONCLUSIVE.",
    subjects: [{ name: "<recording>", help: "a folder that record wrote, relative to the project folder" }],
    options: {
      checkpoint: { kind: "text", value: "<routine>", help: "the name or $ address of a routine: each entry is a checkpoint. Without it, the comparison of the record file" },
      state: { kind: "text", value: "<item>", multiple: true, help: `the state to compare at each checkpoint: ${STATE_ITEM}` },
      pin: { kind: "text", value: "<item>", multiple: true, help: `random state in RAM, in the form of --state: at each checkpoint the rebuild gets the original's values there` },
      rebuild: { kind: "path", value: "<file>", help: "the rebuild to compare with the original: a PRG, or for a ZX Spectrum program the bytes of its build, with --rebuild-at" },
      "rebuild-at": { kind: "address", value: "<address>", help: "ZX Spectrum: the address of the first byte of --rebuild, as the range of its build gives it" },
      symbols: { ...OPTIONS.symbols, help: "the names of the rebuild: the symbol file of its build (default: the symbols of the recording)" },
      out: { ...OPTIONS.out, output: "folder", value: "<dir>", help: "with a FAIL, write the RAM of both sides at the first different checkpoint into this folder. ZX Spectrum: the RAM of both sides at the end" },
    },
    notes: "A recording without names takes the names of the knowledge for the original. A $ address is an address of the original: on the rebuild it moves with the name before it.",
    run: async (call) => {
      if (spectrumProject()) return zxReplayCommand(call);
      if (call.address("rebuild-at") !== undefined) throw new UsageError("--rebuild-at is for a ZX Spectrum program: a PRG gives its load address");
      const [checkpoint, rebuild, symbols, out] = [call.string("checkpoint"), call.string("rebuild"), call.string("symbols"), call.string("out")];
      const result = await replay({ folder: call.subject(0), state: call.strings("state"), pin: call.strings("pin"), ...(checkpoint === undefined ? {} : { checkpoint }), ...(rebuild === undefined ? {} : { rebuild }), ...(symbols === undefined ? {} : { symbols }), ...(out === undefined ? {} : { out }) });
      if (result.result === "INCONCLUSIVE") return reply(result, { hint: INCONCLUSIVE_HINT });
      if (result.result !== "FAIL") return result;
      const [original, rebuilt] = result.files ?? [];
      if (original !== undefined && rebuilt !== undefined) {
        return reply(result, { hint: "files holds the RAM of each side at the first different checkpoint. Run nextAction to compare them. Then examine the first different state item in the emulator.", nextAction: call.next("diff", original.out, rebuilt.out) });
      }
      if (result.firstDifference === undefined) return reply(result, { hint: "reason tells how many checkpoints the rebuild came to. Examine the rebuild in the emulator after its last checkpoint." });
      return reply(result, { hint: `A difference in a random value with the same input often shows a missing --pin.${out === undefined ? " Give --out to get the RAM of each side at the first different checkpoint." : ""}` });
    },
  },
  {
    name: "diff",
    summary: "What changed between two machine states of one kind: two snapshot files (snapshot.vsf), two memory files of runs (memory.bin), or two observations of runs (results.json:<name>).",
    subjects: [
      { name: "<a>", help: "the first state, relative to the project folder" },
      { name: "<b>", help: "the second state" },
    ],
    options: {
      gap: { kind: "count", value: "<n>", min: 0, max: 0xffff, default: 0, help: "join changed ranges across at most n equal bytes (default 0)" },
      "max-listed": OPTIONS["max-listed"],
      ntsc: { kind: "flag", help: "the snapshots are of an NTSC machine (default PAL)" },
      address: { kind: "address", value: "<address>", help: "the address of the first byte of a memory file that is shorter than 64 KiB" },
      out: { ...OPTIONS.out, output: "file", value: "<file>", help: "also write all ranges to this file" },
    },
    run: (call) => {
      const [address, out] = [call.address("address"), call.string("out")];
      const machine = projectMachine();
      return diffFiles(call.subject(0), call.subject(1), { gap: call.count("gap")!, max: call.count("max-listed")!, ntsc: call.flag("ntsc"), ...(address === undefined ? {} : { at: address }), ...(out === undefined ? {} : { out }), ...(machine.family === "c64" ? {} : { memoryOnly: machine.name }) });
    },
  },
  {
    name: "checklist",
    summary: "The playtest checklist for a human tester as Markdown in text: the checkpoints of the scenarios, and the behavior that automated scenarios cannot check.",
    subjects: [{ name: "<scenario.json>", help: "a scenario file", list: true }],
    options: { item: { kind: "text", value: "<text>", multiple: true, help: "an application-specific line" } },
    run: checklist,
  },
];

await runScript({
  name: "testing",
  summary: "Tests a rebuild against the original: scenarios in an emulator, runs, recorded play sessions, state differences, and a checklist for a human tester.",
  names: knowledgeNames,
  mainSpace: projectMainSpace,
  commands: COMMANDS,
});
