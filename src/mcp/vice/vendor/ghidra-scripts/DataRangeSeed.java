// DataRangeSeed.java -- a committed, function-named Ghidra pre-script.
//
// WHAT IT DOES. Reads a file of inclusive address ranges and, for each one,
// clears whatever is currently defined there and redefines the whole range
// as undefined DATA -- so this project's own code-discovery analysis (the
// `analyzeAll()` call `VolatileCarve.java`'s own `run()` makes, or Ghidra's
// own default post-import analysis when no such call is made) never treats
// those bytes as instructions. This is Phase 37 plan 37-08's (`AUTO-07`)
// Ghidra-side half of the graphics-range feedback loop: the derived
// character-set/bitmap/screen-matrix/sprite-pointer ranges this project's own
// `anno-graphics.ts` computes are fed back here so the analyser stops minting
// PHANTOM labels and cross-references inside a region that is actually
// display data, never program.
//
// ITS SEMANTICS ARE THE OPPOSITE OF `VolatileCarve.java`'s `readEntryPoints()`
// loop, whose PLUMBING SHAPE this script copies verbatim (a file of one fact
// per line, read once, acted on per entry, with a diagnostic line per
// outcome and a summary count): that loop marks addresses as CODE
// (`createFunction()`); this one marks a RANGE as DATA. The pattern map for
// this plan (`37-PATTERNS.md`) records directly that no true analog for
// THIS SEMANTIC exists anywhere in this project's vendored scripts -- only
// the plumbing shape is shared.
//
// HOW IT IS REACHED. This script is supplied as `ghidra.analyze`'s
// `dataRangesPath`-driven, ALWAYS-FIRST `-preScript` pair
// (`ghidra-project.mts`'s `buildAnalyzeHeadlessArgv()`), positioned BEFORE
// any caller-supplied `preScript` (`VolatileCarve.java`) in argv -- because
// `VolatileCarve.java`'s own `run()` calls `analyzeAll()` itself, at the end
// of ITS run, and the ranges this script marks must already be DATA before
// that call happens, or code discovery would already have run over them by
// the time this script's own mark ever took effect. `analyzeHeadless` runs
// `-preScript` entries strictly in argv order (see
// `analyzeHeadlessREADME.md`'s own "Using Multiple Scripts" section), so
// argv order alone is what makes this ordering hold -- no other
// synchronisation exists between the two scripts.
//
// THE RANGE FILE'S OWN GRAMMAR, deliberately the SAME two-address form the
// disassembler's own `-B` data-block file already uses (`dxa-blocks.ts`'s
// `emitDataBlocks()`, one `xxxx-yyyy` lower-case hex line per inclusive
// range) -- so a caller building this file from the SAME derived-range rows
// it already built a `-B` file from needs no second rendering rule. Unlike
// that file, this script tolerates a leading `$` on either address (this
// project's own hex-literal convention elsewhere), and does not require
// zero-padding or lower case -- `Long.parseLong(..., 16)` accepts either
// case and any digit count.
//
// A MALFORMED LINE OR AN INVERTED RANGE IS REFUSED BY NAME, NEVER SKIPPED
// SILENTLY. This script's own output is what a run log is read for when
// something about the feedback did not take -- silence on a bad line would
// let a range fail to seed with no visible trace, exactly the "confident
// wrong output with no error" failure mode this whole phase exists to
// prevent. A refused line does not abort the run: the remaining lines are
// still processed, and the summary count still reports how many ranges
// actually seeded.
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSpace;
import ghidra.program.model.data.Undefined1DataType;
import ghidra.program.model.listing.Listing;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

public class DataRangeSeed extends GhidraScript {

    /** One parsed inclusive range, or the raw line and a reason it could not
     * be parsed at all (a malformed line never reaches the inverted-range
     * check, since there is no start/end to compare). */
    private static final class ParsedRange {
        final long start;
        final long end;
        final String rawLine;

        ParsedRange(long start, long end, String rawLine) {
            this.start = start;
            this.end = end;
            this.rawLine = rawLine;
        }
    }

    /** Strips a leading `$` (this project's own hex-literal convention),
     * mirroring the SAME allowance `VolatileCarve.java`'s own
     * `readEntryPoints()` makes for its entry-point file. */
    private static long parseHexToken(String token) {
        String t = token.trim();
        if (t.startsWith("$")) t = t.substring(1);
        return Long.parseLong(t, 16);
    }

    /**
     * Reads the range file at `getScriptArgs()[0]` (this script's own
     * positional argument -- see this file's own header for why it is
     * ALWAYS first in argv). Mirrors `VolatileCarve.java`'s
     * `readEntryPoints()` plumbing: one println() per outcome, an explicit
     * "none" line with a NAMED reason when there is nothing to read, never a
     * silent empty return.
     */
    private List<ParsedRange> readDataRanges() throws Exception {
        List<ParsedRange> out = new ArrayList<>();
        String[] args = getScriptArgs();
        if (args.length == 0 || args[0] == null || args[0].isEmpty()) {
            println("DATARANGE-SEED: none");
            println("DATARANGE-SEED-REASON: no range-file argument given");
            return out;
        }
        File f = new File(args[0]);
        if (!f.isFile()) {
            println("DATARANGE-SEED: none");
            println("DATARANGE-SEED-REASON: file not found: " + f.getPath());
            return out;
        }
        // IN-01 fix: an I/O-level failure reading the range file itself (e.g.
        // `Files.readAllLines()` throwing after the `f.isFile()` existence
        // check above races with a concurrent delete) is reported as a
        // named, contained failure -- exactly like every other refusal in
        // this file -- rather than propagating out of `run()` (this
        // function's only caller, with no surrounding try/catch) and
        // aborting the WHOLE script. A malformed LINE was already handled
        // this way; this closes the same gap for the file read itself.
        List<String> lines;
        try {
            lines = Files.readAllLines(f.toPath());
        } catch (java.io.IOException e) {
            println("DATARANGE-SEED: none");
            println("DATARANGE-SEED-REASON: I/O error reading " + f.getPath() + ": " + e.getMessage());
            return out;
        }
        int refusedCount = 0;
        for (String raw : lines) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;

            int dash = line.indexOf('-');
            if (dash <= 0 || dash == line.length() - 1) {
                println("DATARANGE-REFUSED: " + line + " -- malformed range line: expected \"<start>-<end>\" (two hex addresses separated by a single '-')");
                refusedCount += 1;
                continue;
            }
            long start;
            long end;
            try {
                start = parseHexToken(line.substring(0, dash));
                end = parseHexToken(line.substring(dash + 1));
            } catch (NumberFormatException e) {
                println("DATARANGE-REFUSED: " + line + " -- malformed range line: not a valid hex address pair (" + e.getMessage() + ")");
                refusedCount += 1;
                continue;
            }
            if (end < start) {
                println("DATARANGE-REFUSED: " + line + " -- inverted range: end address is before start address");
                refusedCount += 1;
                continue;
            }
            out.add(new ParsedRange(start, end, line));
        }
        if (out.isEmpty() && refusedCount == 0) {
            println("DATARANGE-SEED: none");
            println("DATARANGE-SEED-REASON: file " + f.getPath() + " contained no ranges");
        }
        return out;
    }

    @Override
    public void run() throws Exception {
        AddressSpace sp = currentProgram.getAddressFactory().getDefaultAddressSpace();
        Listing listing = currentProgram.getListing();

        List<ParsedRange> ranges = readDataRanges();
        int seededCount = 0;

        for (ParsedRange range : ranges) {
            Address startAddr = sp.getAddress(range.start);
            Address endAddr = sp.getAddress(range.end);
            try {
                // Clear whatever is currently defined across the whole range
                // (code, data, or nothing) so createData() below never
                // conflicts with an existing code unit or data unit --
                // mirrors VolatileCarve.java's own "carve before flag" order:
                // the clear happens BEFORE this script ever defines anything.
                listing.clearCodeUnits(startAddr, endAddr, false);

                // Define the whole range as undefined data, one byte at a
                // time: Ghidra has no single "undefined data of arbitrary
                // length" constructor, and a byte-at-a-time definition is
                // exactly what "undefined data across the whole range" means
                // -- every byte in it is marked data, none left as an
                // implicit code candidate.
                // CR-02 fix: `cur.add(1)` throws AddressOutOfBoundsException
                // when `cur` is already the address space's maximum offset
                // ($FFFF here) -- there is no address to advance to. The
                // loop below checks for the LAST iteration (cur == endAddr)
                // and breaks BEFORE calling add(1) again, mirroring
                // GhidraStructExport.java's own classification loop
                // (checks `a.equals(r.getMaxAddress())` and breaks before
                // `a.next()`), rather than advancing unconditionally after
                // every createData() call.
                Address cur = startAddr;
                while (true) {
                    listing.createData(cur, Undefined1DataType.dataType);
                    if (cur.equals(endAddr)) break;
                    cur = cur.add(1);
                }

                seededCount += 1;
                println("DATARANGE-OK: " + range.rawLine + " (" + (range.end - range.start + 1) + " bytes)");
            } catch (Exception e) {
                println("DATARANGE-FAILED: " + range.rawLine + " -- " + e.getMessage());
            }
        }

        println("DATARANGE-SEED-COUNT: " + seededCount);
    }
}
