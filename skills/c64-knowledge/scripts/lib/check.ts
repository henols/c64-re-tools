// The comment check: a sample of comments for one seed and the verdict of
// each item. knowledge.ts reads and writes the files; these functions check
// each verdict and count the result, so the files stay consistent.

import { createHash } from "node:crypto";

import { SYMBOL_NAME } from "#src/c64.ts";
import { Refusal } from "#src/errors.ts";

export const CHECK_VERDICTS = ["correct", "wrong", "unsure"] as const;
export type CheckVerdict = (typeof CHECK_VERDICTS)[number];
/** The classes of a wrong comment, as the instructions of the check name them. */
export const CHECK_CLASSES = ["callers", "bits", "registers", "bounds", "units", "paths", "tables", "hardware", "place", "scope"] as const;
export type CheckClass = (typeof CHECK_CLASSES)[number];

/** One comment of a sample, in the output shape of the knowledge script. */
export interface SampleItem {
  address: string;
  placement: string;
  text: string;
  name?: string;
  [field: string]: unknown;
}

export interface Sample {
  seed: number;
  createdAt: string;
  revision: string;
  space?: string;
  population: number;
  comments: SampleItem[];
}

export interface Verdict {
  address: string;
  placement: string;
  verdict: CheckVerdict;
  class?: CheckClass;
  why?: string;
  text?: string;
  name?: string;
}

export interface Verdicts {
  seed: number;
  revision: string;
  items: Verdict[];
}

/**
 * The comments of a sample: the first count rows in the order of a hash of the seed and the place of each row,
 * in address order. A changed text or another row does not move a row.
 */
export function pickSample<T extends { space: string; address: number; placement: string }>(rows: readonly T[], seed: number, count: number): T[] {
  const key = (row: T) => createHash("sha256").update(`${seed}:${row.space}:${row.address}:${row.placement}`).digest("hex");
  return rows
    .map((row) => ({ row, key: key(row) }))
    .sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, count)
    .map((item) => item.row)
    .sort((a, b) => a.address - b.address || a.placement.localeCompare(b.placement));
}

/** The folder of the check of a seed, relative to the project folder. */
export const checkFolder = (seed: number) => `runs/comment-check-${seed}`;

/** A seed from the name of a check folder, or undefined for another folder. */
export function seedOfFolder(name: string): number | undefined {
  const match = /^comment-check-(\d{1,6})$/.exec(name);
  return match === null ? undefined : Number(match[1]);
}

export interface VerdictRequest {
  address: string;
  placement?: string;
  verdict: CheckVerdict;
  class?: CheckClass;
  why?: string;
  text?: string;
  name?: string;
}

/** The verdicts with the verdict of one item of the sample added, or in place of its earlier verdict. */
export function withVerdict(sample: Sample, verdicts: Verdicts | undefined, request: VerdictRequest): Verdicts {
  const at = sample.comments.filter((item) => item.address === request.address && (request.placement === undefined || item.placement === request.placement));
  const place = `${request.address}${request.placement === undefined ? "" : ` (${request.placement})`}`;
  if (at.length === 0) throw new Refusal("not-found", `The sample of seed ${sample.seed} has no comment at ${place}. Give the address of an item of the sample: get the items with checks ${sample.seed}.`);
  if (at.length > 1) throw new Refusal("invalid-input", `The sample of seed ${sample.seed} has a line and a side comment at ${request.address}. Give --placement line or --placement side.`);
  const item = at[0]!;
  const { verdict } = request;
  const extra = (["class", "text", "name"] as const).filter((field) => request[field] !== undefined);
  if (verdict !== "wrong" && extra.length > 0) throw new Refusal("invalid-input", `A verdict ${verdict} takes no --${extra.join(", --")}. Only a verdict wrong takes --class, --text and --name.`);
  if (verdict === "wrong" && request.class === undefined) throw new Refusal("invalid-input", `A verdict wrong needs --class: one of ${CHECK_CLASSES.join(", ")}.`);
  if (verdict !== "correct" && (request.why === undefined || request.why.trim() === "")) {
    throw new Refusal("invalid-input", verdict === "wrong" ? "A verdict wrong needs --why: the evidence, with the addresses and the instructions." : "A verdict unsure needs --why: the run that can show the claim.");
  }
  if (verdict === "wrong" && request.text === undefined && request.name === undefined) throw new Refusal("invalid-input", "A verdict wrong needs --text with the correct comment, --name with the correct name, or both.");
  if (request.name !== undefined && !SYMBOL_NAME.test(request.name)) throw new Refusal("invalid-input", `--name ${JSON.stringify(request.name)} is not a label: give a letter or an underscore, then letters, digits or underscores.`);
  const written: Verdict = { address: item.address, placement: item.placement, verdict };
  for (const field of ["class", "why", "text", "name"] as const) if (request[field] !== undefined) (written as unknown as Record<string, string>)[field] = request[field]!;
  const kept = (verdicts?.items ?? []).filter((other) => other.address !== item.address || other.placement !== item.placement);
  // The items in the sequence of the sample.
  const order = (verdict: Verdict) => sample.comments.findIndex((other) => other.address === verdict.address && other.placement === verdict.placement);
  return { seed: sample.seed, revision: sample.revision, items: [...kept, written].sort((a, b) => order(a) - order(b)) };
}

/** The counts of a check, and each item of the sample with its verdict when it has one: the correct text and name of a wrong item are its correction. */
export function checkResult(sample: Sample, verdicts: Verdicts | undefined) {
  const items = sample.comments.map((item) => {
    const found = verdicts?.items.find((verdict) => verdict.address === item.address && verdict.placement === item.placement);
    if (found === undefined) return item;
    const correction = { ...(found.text === undefined ? {} : { text: found.text }), ...(found.name === undefined ? {} : { name: found.name }) };
    return {
      ...item,
      verdict: found.verdict,
      ...(found.class === undefined ? {} : { class: found.class }),
      ...(found.why === undefined ? {} : { why: found.why }),
      ...(Object.keys(correction).length === 0 ? {} : { correction }),
    };
  });
  const count = (verdict: CheckVerdict) => items.filter((item) => item.verdict === verdict).length;
  return {
    seed: sample.seed,
    createdAt: sample.createdAt,
    revision: sample.revision,
    sampled: items.length,
    checked: items.filter((item) => item.verdict !== undefined).length,
    correct: count("correct"),
    wrong: count("wrong"),
    unsure: count("unsure"),
    items,
  };
}
