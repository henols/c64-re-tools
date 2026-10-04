// The petcat adapter (16 §13). petcat makes the C64 BASIC V2 listing; the
// adapter parses the tokenized program itself to check that listing and to
// find the machine-code handoffs, because petcat's exit status proves nothing
// (it prints any bytes as text).

import { existsSync, readFileSync } from "node:fs";

import { WireFailure, type BasicHandoff, type PetcatResult } from "../../protocol.ts";
import type { ProcessSupervisor } from "../processes.ts";
import { Workspace } from "../staging.ts";
import { findTool, PETCAT } from "./discover.ts";
import { runTool } from "./run.ts";

const TIMEOUT_MS = 30_000;
const LISTING = "listing.txt";
/** BASIC refuses higher line numbers when a line is entered. */
const MAX_LINE_NUMBER = 63999;

const TOKEN = { data: 0x83, rem: 0x8f, sys: 0x9e, usr: 0xb7, plus: 0xaa, minus: 0xab, times: 0xac, divide: 0xad } as const;
const QUOTE = 0x22;
const COLON = 0x3a;

export interface TokenizedLine {
  number: number;
  /** The line's bytes after the line number, without the terminating zero. */
  tokens: Uint8Array;
}

export type TokenizedProgram = { loadAddress: number; basicEnd: number; lines: TokenizedLine[] } | { reason: string };

/**
 * Splits a PRG into BASIC lines the way BASIC relinks a loaded program: each
 * line ends at a zero byte, and a link whose high byte is zero ends the
 * program. The stored links are not trusted.
 */
export function parseTokenized(program: Uint8Array): TokenizedProgram {
  if (program.length < 4) return { reason: "The file is too short for a BASIC program." };
  const loadAddress = program[0]! | (program[1]! << 8);
  const lines: TokenizedLine[] = [];
  let at = 2;
  // File offset k (from 2 on) loads at loadAddress + k - 2.
  for (;;) {
    // A file that ends right after a line leaves the end marker to the zeros after it in memory.
    if (at === program.length && lines.length > 0) return { loadAddress, basicEnd: loadAddress + at - 2, lines };
    if (at + 1 >= program.length) return { reason: "The BASIC program has no end marker." };
    if (program[at + 1] === 0) return { loadAddress, basicEnd: loadAddress + at, lines };
    if (at + 4 > program.length) return { reason: "The last BASIC line is cut off." };
    const number = program[at + 2]! | (program[at + 3]! << 8);
    if (number > MAX_LINE_NUMBER) return { reason: `Line number ${number} is above ${MAX_LINE_NUMBER}, so the bytes are no BASIC program.` };
    const end = program.indexOf(0, at + 4);
    if (end < 0) return { reason: `BASIC line ${number} has no end.` };
    lines.push({ number, tokens: program.subarray(at + 4, end) });
    at = end + 1;
  }
}

/**
 * Evaluates a SYS argument that holds only numbers, + - * / and brackets.
 * Returns undefined for anything that needs run-time values.
 */
export function constantExpression(bytes: Uint8Array): number | undefined {
  const tokens = [...bytes].filter((byte) => byte !== 0x20);
  let at = 0;
  const peek = () => tokens[at];
  const number = (): number | undefined => {
    let text = "";
    while (peek() !== undefined && ((peek()! >= 0x30 && peek()! <= 0x39) || peek() === 0x2e)) text += String.fromCharCode(tokens[at++]!);
    return text === "" || text === "." ? undefined : Number(text);
  };
  const primary = (): number | undefined => {
    if (peek() === TOKEN.minus || peek() === TOKEN.plus) {
      const negative = tokens[at++] === TOKEN.minus;
      const value = primary();
      return value === undefined ? undefined : negative ? -value : value;
    }
    if (peek() === 0x28) {
      at++;
      const value = sum();
      if (value === undefined || tokens[at++] !== 0x29) return undefined;
      return value;
    }
    return number();
  };
  const product = (): number | undefined => {
    let value = primary();
    while (value !== undefined && (peek() === TOKEN.times || peek() === TOKEN.divide)) {
      const operator = tokens[at++];
      const right = primary();
      if (right === undefined) return undefined;
      value = operator === TOKEN.times ? value * right : value / right;
    }
    return value;
  };
  const sum = (): number | undefined => {
    let value = product();
    while (value !== undefined && (peek() === TOKEN.plus || peek() === TOKEN.minus)) {
      const operator = tokens[at++];
      const right = product();
      if (right === undefined) return undefined;
      value = operator === TOKEN.plus ? value + right : value - right;
    }
    return value;
  };
  const value = sum();
  return value !== undefined && at === tokens.length && Number.isFinite(value) ? value : undefined;
}

/** SYS and USR in program text: not in strings, REM or DATA. */
export function findHandoffs(lines: TokenizedLine[]): BasicHandoff[] {
  const handoffs: BasicHandoff[] = [];
  for (const { number, tokens } of lines) {
    let quoted = false;
    let inData = false;
    for (let at = 0; at < tokens.length; at++) {
      const byte = tokens[at]!;
      if (byte === QUOTE) quoted = !quoted;
      if (quoted) continue;
      if (inData) {
        if (byte === COLON) inData = false;
        continue;
      }
      if (byte === TOKEN.rem) break;
      if (byte === TOKEN.data) inData = true;
      else if (byte === TOKEN.usr) handoffs.push({ kind: "usr", line: number, computed: true });
      else if (byte === TOKEN.sys) {
        // The argument ends at the statement end or at a comma (extra SYS parameters).
        let end = at + 1;
        while (end < tokens.length && tokens[end] !== COLON && tokens[end] !== 0x2c) end++;
        const value = constantExpression(tokens.subarray(at + 1, end));
        if (value === undefined) handoffs.push({ kind: "sys", line: number, computed: true });
        // BASIC drops the fraction; outside 0-65535 SYS stops with ILLEGAL QUANTITY and jumps nowhere.
        else if (Math.trunc(value) >= 0 && Math.trunc(value) <= 0xffff) handoffs.push({ kind: "sys", line: number, address: Math.trunc(value) });
        at = end - 1;
      }
    }
  }
  return handoffs;
}

/** petcat's listing lines ("   10 sys2061"), as number and text. */
export function parseListing(listing: string): Array<{ number: number; text: string }> {
  const lines: Array<{ number: number; text: string }> = [];
  for (const line of listing.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    const match = /^\s*(\d+) ?(.*)$/.exec(line);
    if (match === null) throw new WireFailure("operation-failed", "petcat printed a listing line without a line number.");
    lines.push({ number: Number(match[1]), text: match[2]! });
  }
  return lines;
}

export async function decode(
  program: Buffer,
  context: { supervisor: ProcessSupervisor; signal: AbortSignal; env?: NodeJS.ProcessEnv; log?: (line: string) => void },
): Promise<{ result: PetcatResult }> {
  const tokenized = parseTokenized(program);
  if ("reason" in tokenized) return { result: { decoded: false, reason: tokenized.reason } };
  const executable = findTool(PETCAT, context.env);
  const workspace = Workspace.create();
  try {
    workspace.materialize("input", [{ path: "program.prg", size: program.length }], [program]);
    const output = workspace.directory("out");
    const run = await runTool({
      // -2: C64 BASIC V2 keywords. -nh: no header. The input is never read as an option.
      argv: [executable, "-2", "-nh", "-o", `${output}/${LISTING}`, "--", "input/program.prg"],
      cwd: workspace.root,
      supervisor: context.supervisor,
      signal: context.signal,
      timeoutMs: TIMEOUT_MS,
      ...(context.env === undefined ? {} : { env: context.env }),
    });
    if (run.aborted) throw new WireFailure("operation-failed", "The BASIC decode was cancelled.");
    if (run.timedOut) throw new WireFailure("operation-failed", `petcat did not finish within ${TIMEOUT_MS / 1000} seconds.`);
    const listingPath = `${output}/${LISTING}`;
    if (run.code !== 0 || !existsSync(listingPath)) {
      context.log?.(`petcat exited ${run.code}:\n${run.stdout}\n${run.stderr}`);
      throw new WireFailure("operation-failed", "petcat could not decode the program.");
    }
    const lines = parseListing(readFileSync(listingPath, "latin1"));
    const agrees = lines.length === tokenized.lines.length && lines.every((line, index) => line.number === tokenized.lines[index]!.number);
    if (!agrees) throw new WireFailure("operation-failed", "petcat's listing does not match the lines of the program.");
    return {
      result: {
        decoded: true,
        loadAddress: tokenized.loadAddress,
        basicEnd: tokenized.basicEnd,
        listing: lines.map((line) => `${line.number} ${line.text}`).join("\n"),
        lines,
        handoffs: findHandoffs(tokenized.lines),
      },
    };
  } finally {
    workspace.remove();
  }
}
