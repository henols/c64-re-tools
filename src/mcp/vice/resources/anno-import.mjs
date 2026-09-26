#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-import.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-import.mts
//
// The parser and importer for `GhidraStructExport.java`'s
// `## `-delimited transfer file.
//
// THIS MODULE RECEIVES AN ALREADY-OPEN STORE HANDLE AND THE FILE'S BYTES. It
// never opens or closes a store, never names `node:sqlite`, and never touches
// the filesystem: the client read the transfer file and staged its bytes, and
// the client deletes it once this import has returned successfully
// (`anno-call-client.ts`).
//
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR: parsing the export's fixed
// `## `-delimited section format, mapping Ghidra's `Reference.getReferenceType()`
// vocabulary onto the store's frozen four-member `XrefAccessKind`
// (`GHIDRA_REFTYPE_TO_ACCESS_KIND`), and the digest that ties the import to
// the exact bytes it read.
//
// WHAT NOT TO DO:
//   - Never write a row before the WHOLE document has parsed successfully.
//     `parseGhidraExport()` returns a document `importGhidraExport()` walks
//     in full to build a write list BEFORE the first `putXref()` call -- a
//     streaming parse that writes as it reads cannot honour this.
//   - Never report success before the LAST `putXref()` has returned. The
//     client deletes the transfer file on success, and `applyWrite()`
//     commits before returning, so only a returned write is a durable one.
//   - Never guess an unrecognised `ReferenceType` token onto the nearest
//     member of `XREF_ACCESS_KINDS`. It is dropped and COUNTED in
//     `kindsSeenNotImported`, never silently absorbed and never refused --
//     refusing on an ordinary `JSR`/`JMP` reference would make the importer
//     unusable against a real corpus binary.
import { createHash } from "node:crypto";
import { putXref } from "./anno-store.mjs";
import { parseStoreAddress } from "./anno-types.mjs";
/** The offending section and 1-based line number ride on every refusal, so a
 * refusal is actionable without re-reading this file's parser. Follows the
 * `ViceError`-family construction idiom in SHAPE (a `message` plus plain
 * public fields) but is a bare `Error` subclass, not an `AnnoStoreError` --
 * this module never touches the store's own persistence and has no reason to
 * join that error family. */
export class AnnoImportError extends Error {
    section;
    line;
    constructor(message, opts = {}) {
        super(message);
        this.name = "AnnoImportError";
        this.section = opts.section;
        this.line = opts.line;
    }
}
/**
 * Parses ONE Ghidra-rendered address token -- e.g. `"0815"`, `"d020"`,
 * `"0001"` -- exactly as `Address.toString()` renders one inside a real
 * export: bare hex digits, NO `"$"` or `"0x"` prefix, ALWAYS hex, never
 * decimal. MEASURED this plan, against a REAL captured export: this is a
 * distinct format from `parseStoreAddress()`'s (`anno-types.mts`) own
 * agent-facing contract, which REFUSES an unprefixed numeric string on
 * purpose, because an AGENT-supplied address is genuinely ambiguous between
 * hex and decimal. A Ghidra-rendered token carries NO such ambiguity (it
 * always comes from `Address.toString()`, never from anything an agent
 * typed), so this module parses it with its OWN narrow rule instead of
 * `parseStoreAddress()`'s. Still accepts the `"$"`/`"0x"`-prefixed forms
 * (delegating to `parseStoreAddress()` for those, unchanged), so a
 * hand-written test fixture using either convention keeps working.
 *
 * Discovered as a LIVE, previously-untested defect in the REFERENCES import
 * path: every prior test used a hand-written, `$`-prefixed
 * transfer file, never a token shaped exactly as Ghidra itself renders one
 * -- `importGhidraExport()` would refuse EVERY real captured export outright.
 * Fixed here, in the SAME function `## CONST_WRITES`'s own tokens (which are
 * ALSO bare hex) need the identical treatment for.
 */
function parseGhidraAddressToken(token, what) {
    if (token.startsWith("$") || /^0[xX]/.test(token)) {
        return parseStoreAddress(token, { what });
    }
    if (/^[0-9a-fA-F]+$/.test(token)) {
        const value = parseInt(token, 16);
        if (value < 0 || value > 0xffff) {
            throw new AnnoImportError(`anno_import_ghidra_export refused: ${what} ${JSON.stringify(token)} is out of range -- expected $0000-$ffff.`, { section: what });
        }
        return value;
    }
    throw new AnnoImportError(`anno_import_ghidra_export refused: ${what} ${JSON.stringify(token)} is not a resolvable address -- expected bare ` +
        `hex digits (Ghidra's own rendering) or a "$"/"0x"-prefixed form.`, { section: what });
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
export function parseGhidraExport(text) {
    if (text.trim() === "") {
        throw new AnnoImportError("anno_import_ghidra_export refused: the transfer file's text is empty or whitespace-only -- an empty file " +
            "is refused as malformed, never treated as an empty-but-valid export.", { section: "(document)", line: 1 });
    }
    const lines = text.split(/\r?\n/);
    const sections = new Map();
    const trailers = new Map();
    let currentSection;
    let sawFirstNonBlank = false;
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;
        if (line.trim() === "")
            continue;
        if (!sawFirstNonBlank) {
            sawFirstNonBlank = true;
            if (!line.startsWith("## ")) {
                throw new AnnoImportError(`anno_import_ghidra_export refused: expected the first non-blank line to be a "## " section header, found ` +
                    `${JSON.stringify(line)} at line ${lineNo} -- refusing to parse a headerless document as a bodiless one.`, { section: "(document)", line: lineNo });
            }
        }
        if (line.startsWith("## ")) {
            const rest = line.slice(3);
            const spaceIdx = rest.indexOf(" ");
            if (spaceIdx === -1) {
                currentSection = rest.trim();
                if (!sections.has(currentSection))
                    sections.set(currentSection, []);
            }
            else {
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
                throw new AnnoImportError(`anno_import_ghidra_export refused: REFERENCES line ${lineNo} does not match "<from> -> <to> ` +
                    `<ReferenceType>": ${JSON.stringify(line)}`, { section: "REFERENCES", line: lineNo });
            }
        }
        // MEASURED bug, found this plan against a REAL captured export (no prior
        // test ever ran a real `## CLASSIFICATION` section through this parser):
        // `GhidraStructExport.java`'s classification section appends three
        // informational lines AFTER its own `## CLASSIFICATION_LINES <n>`
        // trailer -- `CLASSIFICATION_EXPECTED_FROM_BLOCKS`, `CLASSIFICATION_
        // OBSERVED`, `CLASSIFICATION_OVERRIDE_USED` -- with NO `## ` prefix
        // (verbatim `StringBuilder.append()` calls, never a header/trailer
        // line). Because `currentSection` stays "CLASSIFICATION" across the
        // preceding `## CLASSIFICATION_LINES` TRAILER line (a trailer never
        // changes `currentSection`), these three bare lines would otherwise be
        // swept into `sections.get("CLASSIFICATION")` as ordinary body content,
        // inflating the parsed count by exactly 3 relative to the script's own
        // declared trailer -- silently reddening `checkTrailerCount` below on
        // every real capture. Skipped here BY NAME (never a generic "looks like
        // a trailer" heuristic, which risks dropping a genuine classification
        // line that happens to start similarly).
        if (currentSection === "CLASSIFICATION" &&
            /^(CLASSIFICATION_EXPECTED_FROM_BLOCKS|CLASSIFICATION_OBSERVED|CLASSIFICATION_OVERRIDE_USED)\b/.test(line)) {
            continue;
        }
        sections.get(currentSection).push(line);
    }
    const checkTrailerCount = (sectionName, trailerName) => {
        const declaredRaw = trailers.get(trailerName);
        if (declaredRaw === undefined)
            return;
        const declared = Number(declaredRaw);
        const actual = sections.get(sectionName)?.length ?? 0;
        if (!Number.isInteger(declared) || declared !== actual) {
            throw new AnnoImportError(`anno_import_ghidra_export refused: "## ${trailerName} ${declaredRaw}" declares ${declaredRaw} but ` +
                `${sectionName} carries ${actual} parsed line(s) -- a self-checking count disagreement is refused rather ` +
                "than trusted.", { section: sectionName });
        }
    };
    checkTrailerCount("REFERENCES", "REFERENCE_COUNT");
    checkTrailerCount("CLASSIFICATION", "CLASSIFICATION_LINES");
    // The SAME generic trailer-count check, extended to
    // `## CONST_WRITES` / `## CONST_WRITES_COUNT`. Note what this generic
    // grammar already does with the exporter's own `## CONST_WRITES_NONE`
    // marker line: because every `## `-prefixed line with no following space
    // OPENS A NEW SECTION (never a body line), that marker line itself closes
    // out `CONST_WRITES` at zero body lines and opens an unrelated, always-
    // empty `CONST_WRITES_NONE` section -- so a "found nothing" export and a
    // "found nothing, no marker" export are indistinguishable to THIS check,
    // both correctly reporting zero body lines against a `CONST_WRITES_COUNT 0`
    // trailer. `parseConstWrites()` below never needs to special-case the
    // marker itself for exactly this reason.
    checkTrailerCount("CONST_WRITES", "CONST_WRITES_COUNT");
    return { sections, trailers };
}
/**
 * The frozen mapping from Ghidra's `Reference.getReferenceType()`
 * vocabulary onto the store's four-member `XrefAccessKind`. A token absent
 * from this table is dropped and COUNTED (`kindsSeenNotImported`), never
 * refused and never guessed -- a real corpus binary carries ordinary jump and
 * call references constantly, and refusing on them would make the importer
 * unusable.
 */
export const GHIDRA_REFTYPE_TO_ACCESS_KIND = Object.freeze({
    READ: "READ",
    WRITE: "WRITE",
    READ_WRITE: "READ_WRITE",
    COMPUTED_JUMP: "COMPUTED_JUMP",
    COMPUTED_CALL: "COMPUTED_JUMP",
});
/** The watched-address set, mirroring the Java constant
 * `CONST_WRITE_WATCHED_ADDRESSES` in `GhidraStructExport.java` byte-for-byte
 * -- the two MUST be kept in step. `parseConstWrites()` below does NOT
 * filter its own output against this list: a `## CONST_WRITES` line for an
 * address outside this set is still parsed and returned, because the
 * EXPORTER owns the watched set, and a parser that silently dropped a
 * widened set would hide the widening from every caller rather than
 * surfacing it. */
export const CONST_WRITE_WATCHED_ADDRESSES = Object.freeze([0x0001, 0xd011, 0xd018, 0xdd00]);
/**
 * Turns the `## CONST_WRITES` section `parseGhidraExport()` already parsed
 * into `(storeAddress, targetAddress, value)` facts. `parseGhidraExport()`
 * has ALREADY refused, before
 * this function is ever called, if a declared `## CONST_WRITES_COUNT`
 * trailer disagrees with the section's own parsed body-line count -- the
 * SAME generic check `## REFERENCE_COUNT`/`## CLASSIFICATION_LINES` already
 * use. This function refuses on its own only for a body line whose token
 * count is not exactly three (the importer's own named error, section and
 * 1-BASED-WITHIN-THE-SECTION line number), or whose address/value token is
 * not a resolvable constant (`parseGhidraAddressToken()`'s own refusal,
 * reused rather than duplicated -- never a hand-rolled second numeric
 * parser).
 *
 * A section carrying only the exporter's own `## CONST_WRITES_NONE` marker
 * line yields an empty array, not an error: per `parseGhidraExport()`'s
 * generic `## `-header grammar, that marker line itself OPENS A NEW,
 * unrelated section (every `## `-prefixed line with no following space does)
 * rather than being a `CONST_WRITES` body line, so `CONST_WRITES` is left
 * with zero parsed body lines either way -- there is nothing here to
 * special-case. A document that never mentions `CONST_WRITES` at all (no
 * section key, no count trailer) yields the same empty array.
 */
export function parseConstWrites(document) {
    const lines = document.sections.get("CONST_WRITES") ?? [];
    const facts = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const lineNo = i + 1;
        const tokens = line.trim().split(/\s+/);
        if (tokens.length !== 3) {
            throw new AnnoImportError(`anno_import_ghidra_export refused: CONST_WRITES line ${lineNo} does not match "<store-address> ` +
                `<target-address> <value>": ${JSON.stringify(line)}`, { section: "CONST_WRITES", line: lineNo });
        }
        const storeAddress = parseGhidraAddressToken(tokens[0], `CONST_WRITES line ${lineNo} storeAddress`);
        const targetAddress = parseGhidraAddressToken(tokens[1], `CONST_WRITES line ${lineNo} targetAddress`);
        const value = parseGhidraAddressToken(tokens[2], `CONST_WRITES line ${lineNo} value`);
        facts.push({ storeAddress, targetAddress, value });
    }
    return facts;
}
/**
 * Imports one transfer file's bytes into `handle`. The digest and the byte
 * length are derived from the same buffer, so they describe the same bytes.
 * Parses fully, builds the mapped write list fully, and only THEN issues
 * every `putXref()` call in file order.
 */
export function importGhidraExport(handle, args) {
    const exportName = args.exportName;
    const contents = Buffer.from(args.exportBytes);
    const transferSha256 = createHash("sha256").update(contents).digest("hex");
    const transferByteLength = contents.length;
    if (args.expectedSha256 !== undefined && args.expectedSha256 !== transferSha256) {
        throw new AnnoImportError(`anno_import_ghidra_export refused: expected sha256 ${args.expectedSha256} but the transfer file ` +
            `${JSON.stringify(exportName)} hashes to ${transferSha256} -- this digest is a corruption/drift detector, ` +
            "never a security boundary, and a mismatch refuses before anything is written or deleted.", { section: "(digest)" });
    }
    const doc = parseGhidraExport(contents.toString("utf8"));
    const referenceLines = doc.sections.get("REFERENCES") ?? [];
    // Parsed here, from the SAME document -- `parseConstWrites()` was previously
    // exercised only by test code (`anno-join.test.ts`/`ghidra-live.test.ts`),
    // never by this, the only production entry point that reads a transfer
    // file. See `ImportCounts.constWrites`'s own doc comment for how the
    // facts reach `anno_join_memmap`.
    const constWrites = parseConstWrites(doc);
    const kindsSeenNotImported = {};
    const writes = [];
    let referencesSeen = 0;
    for (const line of referenceLines) {
        referencesSeen += 1;
        const tokens = line.trim().split(/\s+/);
        const fromToken = tokens[0];
        const toToken = tokens[2];
        const kindToken = tokens[3];
        const mappedKind = GHIDRA_REFTYPE_TO_ACCESS_KIND[kindToken];
        if (mappedKind === undefined) {
            kindsSeenNotImported[kindToken] = (kindsSeenNotImported[kindToken] ?? 0) + 1;
            continue;
        }
        const fromAddress = parseGhidraAddressToken(fromToken, "REFERENCES fromAddress");
        const toAddress = parseGhidraAddressToken(toToken, "REFERENCES toAddress");
        writes.push({ fromAddress, toAddress, accessKind: mappedKind });
    }
    // PHASE TWO: every write is issued only after the whole document parsed
    // and the whole write list was built above. No `putXref()` call happens
    // before this point.
    let xrefsWritten = 0;
    let xrefsAlreadyPresent = 0;
    for (const write of writes) {
        const result = putXref(handle, write);
        if (result.changed)
            xrefsWritten += 1;
        else
            xrefsAlreadyPresent += 1;
    }
    return {
        referencesSeen,
        xrefsWritten,
        xrefsAlreadyPresent,
        kindsSeenNotImported,
        transferPath: exportName,
        transferSha256,
        transferByteLength,
        constWrites,
    };
}
