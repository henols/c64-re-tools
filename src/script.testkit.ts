// A script "demo" with the commands that src/script.test.ts calls: in a child
// process through runScript for the envelope, and through parseCall for the
// command line.

import { WireFailure } from "./protocol/messages.ts";
import { Refusal } from "./errors.ts";
import { projectRoot } from "./project.ts";
import { listed, OPTIONS, reply, UsageError, type ScriptSpec } from "./script.ts";

/** `names` knows main_loop at $0810 in c64 and $0300 in drive8. */
const names = (name: string, space: string): number => {
  if (name === "main_loop") return space === "drive8" ? 0x300 : 0x810;
  throw new Refusal("not-found", `${name} is not a name in the knowledge. Give a $ address, or a name that knowledge.ts symbols lists, with or without --analyzer.`);
};

class Coded extends Error {
  code = "conflict";
}

export const DEMO: ScriptSpec = {
  name: "demo",
  summary: "A script for the tests.",
  names,
  commands: [
    {
      name: "echo",
      summary: "Gives its subjects and options back.",
      subjects: [{ name: "<word>", help: "a word" }, { name: "<more>", help: "more words", optional: true, list: true }],
      options: { out: { ...OPTIONS.out, output: "file" }, flag: { kind: "flag", help: "a flag" }, item: { kind: "text", value: "<text>", help: "an item", multiple: true }, "max-listed": OPTIONS["max-listed"] },
      run: (call) => ({ subjects: call.subjects, out: call.string("out") ?? null, flag: call.flag("flag"), items: call.strings("item"), maxListed: call.count("max-listed") }),
    },
    {
      name: "at",
      summary: "An address.",
      subjects: [{ name: "<address>", help: "an address" }],
      options: { space: OPTIONS.space, entry: OPTIONS.entry, range: OPTIONS.range },
      run: (call) => ({ address: call.parseAddress(call.subject(0), "<address>"), entry: call.address("entry") ?? null, range: call.range("range") ?? null }),
    },
    { name: "need", summary: "A required option.", options: { out: { ...OPTIONS.out, output: "folder", required: true }, frames: OPTIONS.frames }, run: (call) => ({ out: call.string("out"), frames: call.count("frames") ?? null }) },
    { name: "bare", summary: "An --out without an output kind.", options: { out: OPTIONS.out }, run: () => ({}) },
    { name: "check", summary: "A check.", subjects: [{ name: "<result>", help: "PASS, FAIL or INCONCLUSIVE" }], run: (call) => ({ result: call.subject(0) }) },
    { name: "refuse", summary: "Refuses.", run: () => { throw new WireFailure("machine-unavailable", "The Host Runtime does not answer."); } },
    { name: "missing", summary: "A missing tool.", run: () => { throw new Refusal("installation-incomplete", "ACME is not installed. Ask the user to install it."); } },
    { name: "hinted", summary: "A refusal with its own hint.", run: () => { throw new Refusal("conflict", "Two writes disagree. This stays in the error.", { hint: "Merge them first." }); } },
    { name: "next", summary: "A result with a next command.", run: (call) => reply({ done: true }, { hint: "Run where next.", nextAction: call.next("where", "$c000") }) },
    { name: "cut", summary: "A cut list.", run: () => ({ items: listed([1, 2, 3], 1) }) },
    { name: "coded", summary: "An error with a code from the list.", run: () => { throw new Coded("two writes disagree"); } },
    { name: "usage", summary: "A usage error.", run: () => { throw new UsageError("give one file"); } },
    { name: "crash", summary: "A fault.", run: () => { throw new RangeError("index out of range"); } },
    { name: "later", summary: "A fault after the result.", run: () => { setTimeout(() => { throw new TypeError("late"); }, 10); return new Promise(() => {}); } },
    { name: "reject", summary: "A rejection that nothing catches.", run: () => { void Promise.reject(new Error("lost")); return new Promise(() => {}); } },
    { name: "wrong", summary: "A shared option with another kind.", options: { out: { kind: "flag", help: "wrong" } }, run: () => ({}) },
    { name: "where", summary: "The project.", run: () => ({ root: projectRoot() }) },
    { name: "span", summary: "A range subject.", subjects: [{ name: "<range>", help: "a range" }, { name: "<type>", help: "a type", optional: true }], run: (call) => ({ range: call.parseRange(call.subject(0), "<range>") }) },
  ],
};
