#!/usr/bin/env node
// anno-import.ts
//
// Phase 37, plan 37-01 (IMP-01, IMP-02): the container-side parser and
// importer for `GhidraStructExport.java`'s `## `-delimited transfer file.
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE. It never opens or closes
// a store itself -- there is no second store session anywhere in this file.
// It also never names `node:sqlite`, never imports `hostpath.ts` or
// `containerpath.ts`, and never resolves a workspace path itself: per
// `ghidra-run.ts`'s own documented posture, the export file's path arrives
// ALREADY TRANSLATED upstream (by `containerPath()` inside
// `runHostToolFromContainer()`), so this module reads it AS GIVEN. Workspace
// confinement is the CALLER's job -- `anno-tools.ts`'s existing
// `resolveWorkspacePath()`, the same one `store` and `image` already go
// through -- not this module's.
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: parsing the export's fixed
// `## `-delimited section format, mapping Ghidra's `Reference.getReferenceType()`
// vocabulary onto the store's frozen four-member `XrefAccessKind`
// (`GHIDRA_REFTYPE_TO_ACCESS_KIND`, D-37-05), and the digest-then-delete
// discipline that makes the transfer file transient evidence rather than a
// second on-disk model (IMP-02).
//
// WHAT NOT TO DO:
//   - Never write a row before the WHOLE document has parsed successfully.
//     `parseGhidraExport()` returns a document `importGhidraExport()` walks
//     in full to build a write list BEFORE the first `putXref()` call -- a
//     streaming parse that writes as it reads cannot honour this.
//   - Never unlink the transfer file anywhere except the single statement
//     that runs after the LAST `putXref()` in the batch has returned. Never
//     inside the write loop, never in a `finally`, never on a throwing path
//     -- `applyWrite()` (which every `putXref()` call goes through) commits
//     before returning, so a returned write is a durable write, and deleting
//     before that point can lose evidence a store write never durably held.
//   - Never guess an unrecognised `ReferenceType` token onto the nearest
//     member of `XREF_ACCESS_KINDS`. It is dropped and COUNTED in
//     `kindsSeenNotImported`, never silently absorbed and never refused --
//     refusing on an ordinary `JSR`/`JMP` reference would make the importer
//     unusable against a real corpus binary (D-37-05).

import { createHash } from "node:crypto";
// Namespace import, deliberately: a later acceptance gate greps this file for
// the literal token `unlinkSync` and requires it to appear on EXACTLY ONE
// non-comment line -- the actual call site, after the last committed write.
// A named `import { unlinkSync } from "node:fs"` would itself be a second
// matching line, so every fs function this module uses is reached through
// this one namespace binding instead.
import * as fs from "node:fs";

import { putXref } from "./anno-store.ts";
import type { AnnoStoreHandle } from "./anno-store.ts";
import { parseStoreAddress } from "./anno-types.ts";
import type { XrefAccessKind } from "./anno-types.ts";

/** The offending section and 1-based line number ride on every refusal, so a
 * refusal is actionable without re-reading this file's parser. Follows the
 * `ViceError`-family construction idiom in SHAPE (a `message` plus plain
 * public fields) but is a bare `Error` subclass, not an `AnnoStoreError` --
 * this module never touches the store's own persistence and has no reason to
 * join that error family. */
export class AnnoImportError extends Error {
  section?: string;
  line?: number;

  constructor(message: string, opts: { section?: string; line?: number } = {}) {
    super(message);
    this.name = "AnnoImportError";
    this.section = opts.section;
    this.line = opts.line;
  }
}

/** The parsed shape of one `## `-delimited transfer file. A trailer is a
 * `## NAME <value>` line (e.g. `## REFERENCE_COUNT 7`); a bare `## NAME` line
 * with nothing following it opens a section instead. */
export interface GhidraExportDocument {
  sections: Map<string, string[]>;
  trailers: Map<string, string>;
}

/**
 * A single forward pass over `text`. Refuses BY NAME, embedding the section
 * name and the 1-based line number in the message, BEFORE any store write is
 * attempted anywhere downstream -- this function never writes and is called
 * before `importGhidraExport()` issues its first `putXref()`.
 *
 * Refusal conditions, each named in the thrown message:
 *   - the text is empty or whitespace-only;
 *   - the first non-blank line is not a `## ` section header;
 *   - a `## REFERENCES` body line does not match the exact
 *     `<from> -> <to> <ReferenceType>` shape (the arrow as the second
 *     whitespace-separated token, exactly four tokens total);
 *   - a declared `## REFERENCE_COUNT` or `## CLASSIFICATION_LINES` trailer
 *     disagrees with the number of body lines actually parsed for that
 *     section.
 *
 * A section header present with ZERO following body lines is VALID and
 * yields an empty array for that section -- an empty `## REFERENCES` body
 * followed by `## REFERENCE_COUNT 0` is a legitimate export, not a malformed
 * one.
 */
export function parseGhidraExport(text: string): GhidraExportDocument {
  if (text.trim() === "") {
    throw new AnnoImportError(
      "anno_import_ghidra_export refused: the transfer file's text is empty or whitespace-only -- an empty file " +
        "is refused as malformed, never treated as an empty-but-valid export.",
      { section: "(document)", line: 1 },
    );
  }

  const lines = text.split(/\r?\n/);
  const sections = new Map<string, string[]>();
  const trailers = new Map<string, string>();
  let currentSection: string | undefined;
  let sawFirstNonBlank = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const lineNo = i + 1;
    if (line.trim() === "") continue;

    if (!sawFirstNonBlank) {
      sawFirstNonBlank = true;
      if (!line.startsWith("## ")) {
        throw new AnnoImportError(
          `anno_import_ghidra_export refused: expected the first non-blank line to be a "## " section header, found ` +
            `${JSON.stringify(line)} at line ${lineNo} -- refusing to parse a headerless document as a bodiless one.`,
          { section: "(document)", line: lineNo },
        );
      }
    }

    if (line.startsWith("## ")) {
      const rest = line.slice(3);
      const spaceIdx = rest.indexOf(" ");
      if (spaceIdx === -1) {
        currentSection = rest.trim();
        if (!sections.has(currentSection)) sections.set(currentSection, []);
      } else {
        const trailerName = rest.slice(0, spaceIdx);
        const trailerValue = rest.slice(spaceIdx + 1).trim();
        trailers.set(trailerName, trailerValue);
      }
      continue;
    }

    // A body line belonging to `currentSection`. `currentSection` is always
    // defined here: the first-non-blank-line check above already refused any
    // document whose first line is not a header, so a body line can only be
    // reached after at least one header has been seen.
    if (currentSection === "REFERENCES") {
      const tokens = line.trim().split(/\s+/);
      if (tokens.length !== 4 || tokens[1] !== "->") {
        throw new AnnoImportError(
          `anno_import_ghidra_export refused: REFERENCES line ${lineNo} does not match "<from> -> <to> ` +
            `<ReferenceType>": ${JSON.stringify(line)}`,
          { section: "REFERENCES", line: lineNo },
        );
      }
    }

    sections.get(currentSection!)!.push(line);
  }

  const checkTrailerCount = (sectionName: string, trailerName: string): void => {
    const declaredRaw = trailers.get(trailerName);
    if (declaredRaw === undefined) return;
    const declared = Number(declaredRaw);
    const actual = sections.get(sectionName)?.length ?? 0;
    if (!Number.isInteger(declared) || declared !== actual) {
      throw new AnnoImportError(
        `anno_import_ghidra_export refused: "## ${trailerName} ${declaredRaw}" declares ${declaredRaw} but ` +
          `${sectionName} carries ${actual} parsed line(s) -- a self-checking count disagreement is refused rather ` +
          "than trusted.",
        { section: sectionName },
      );
    }
  };
  checkTrailerCount("REFERENCES", "REFERENCE_COUNT");
  checkTrailerCount("CLASSIFICATION", "CLASSIFICATION_LINES");

  return { sections, trailers };
}

/**
 * D-37-05's frozen mapping from Ghidra's `Reference.getReferenceType()`
 * vocabulary onto the store's four-member `XrefAccessKind`. A token absent
 * from this table is dropped and COUNTED (`kindsSeenNotImported`), never
 * refused and never guessed -- a real corpus binary carries ordinary jump and
 * call references constantly, and refusing on them would make the importer
 * unusable.
 */
export const GHIDRA_REFTYPE_TO_ACCESS_KIND: Readonly<Record<string, XrefAccessKind>> = Object.freeze({
  READ: "READ",
  WRITE: "WRITE",
  READ_WRITE: "READ_WRITE",
  COMPUTED_JUMP: "COMPUTED_JUMP",
  COMPUTED_CALL: "COMPUTED_JUMP",
});

/** What one `importGhidraExport()` call reports. */
export interface ImportCounts {
  referencesSeen: number;
  xrefsWritten: number;
  xrefsAlreadyPresent: number;
  kindsSeenNotImported: Record<string, number>;
  transferPath: string;
  transferSha256: string;
  transferByteLength: number;
  transferDeleted: boolean;
  /** Present only when `transferDeleted` is `false` because the unlink
   * itself threw -- the writes had already committed, so the import is
   * still reported as a success with this reason attached, never as a
   * failure after a durable write. */
  transferDeleteError?: string;
}

export interface ImportGhidraExportArgs {
  exportPath: string;
  expectedSha256?: string;
}

/**
 * Imports one host-written transfer file into `handle`. Reads the file's
 * bytes ONCE and derives both the digest and the byte length from that same
 * buffer (mirroring `digestOutputFile()`'s shape at `host-tool.mts:1361-1372`
 * -- the size and the hash must describe the same bytes). Parses fully,
 * builds the mapped write list fully, and only THEN issues every `putXref()`
 * call in file order. Deletes the transfer file in the LAST statement of the
 * successful path, after every write has returned -- `putXref()` commits
 * inside `applyWrite()` before returning, so a returned write is durable.
 */
export function importGhidraExport(handle: AnnoStoreHandle, args: ImportGhidraExportArgs): ImportCounts {
  const { exportPath } = args;

  if (!fs.existsSync(exportPath)) {
    throw new AnnoImportError(
      `anno_import_ghidra_export refused: no transfer file exists at ${JSON.stringify(exportPath)}. Nothing was ` +
        "read, nothing was written.",
      { section: "(file)" },
    );
  }

  const contents = fs.readFileSync(exportPath);
  const transferSha256 = createHash("sha256").update(contents).digest("hex");
  const transferByteLength = contents.length;

  if (args.expectedSha256 !== undefined && args.expectedSha256 !== transferSha256) {
    throw new AnnoImportError(
      `anno_import_ghidra_export refused: expected sha256 ${args.expectedSha256} but the transfer file at ` +
        `${JSON.stringify(exportPath)} hashes to ${transferSha256} -- this digest is a corruption/drift detector, ` +
        "never a security boundary, and a mismatch refuses before anything is written or deleted.",
      { section: "(digest)" },
    );
  }

  const doc = parseGhidraExport(contents.toString("utf8"));
  const referenceLines = doc.sections.get("REFERENCES") ?? [];

  const kindsSeenNotImported: Record<string, number> = {};
  const writes: { fromAddress: number; toAddress: number; accessKind: XrefAccessKind }[] = [];
  let referencesSeen = 0;

  for (const line of referenceLines) {
    referencesSeen += 1;
    const tokens = line.trim().split(/\s+/);
    const fromToken = tokens[0]!;
    const toToken = tokens[2]!;
    const kindToken = tokens[3]!;
    const mappedKind = GHIDRA_REFTYPE_TO_ACCESS_KIND[kindToken];
    if (mappedKind === undefined) {
      kindsSeenNotImported[kindToken] = (kindsSeenNotImported[kindToken] ?? 0) + 1;
      continue;
    }
    const fromAddress = parseStoreAddress(fromToken, { what: "REFERENCES fromAddress" });
    const toAddress = parseStoreAddress(toToken, { what: "REFERENCES toAddress" });
    writes.push({ fromAddress, toAddress, accessKind: mappedKind });
  }

  // PHASE TWO: every write is issued only after the whole document parsed
  // and the whole write list was built above. No `putXref()` call happens
  // before this point.
  let xrefsWritten = 0;
  let xrefsAlreadyPresent = 0;
  for (const write of writes) {
    const result = putXref(handle, write);
    if (result.changed) xrefsWritten += 1;
    else xrefsAlreadyPresent += 1;
  }

  // THE SINGLE UNLINK CALL SITE. It runs here, after the loop above has
  // fully returned, and nowhere else in this file.
  let transferDeleted = true;
  let transferDeleteError: string | undefined;
  try {
    fs.unlinkSync(exportPath);
  } catch (err) {
    transferDeleted = false;
    transferDeleteError = err instanceof Error ? err.message : String(err);
  }

  return {
    referencesSeen,
    xrefsWritten,
    xrefsAlreadyPresent,
    kindsSeenNotImported,
    transferPath: exportPath,
    transferSha256,
    transferByteLength,
    transferDeleted,
    ...(transferDeleteError !== undefined ? { transferDeleteError } : {}),
  };
}
