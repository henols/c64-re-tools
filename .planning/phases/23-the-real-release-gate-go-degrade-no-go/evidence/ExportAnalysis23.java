// Throwaway Ghidra post-script for phase 23 -- evidence, not a deliverable.
// Registered in no manifest, shipped by nothing, read by no src/ module.
//
// WHAT IT IS. The export that BOTH measuring criteria read: criterion 1 reads
// `## CLASSIFICATION`, criterion 2 reads `## REFERENCES`. Same `## SECTION`-
// delimited plain-text format as the pivot's ExportAnalysis.java, one fact per
// line, written to getScriptArgs()[0].
//
// WHY IT IS NOT JUST ExportAnalysis.java. The pivot evidence README labels
// ExportAnalysis.java "the trap: returns almost no structural facts on 6502",
// and Decomp.java "the one that works". Read literally that would have this
// phase discard the export entirely, and that reading is wrong. Only its
// `## STRUCTS` section is empty on 6502 -- the DataTypeManager composite query
// finds nothing because the 6502 decompiler produces no composite types -- and
// that section is therefore DROPPED here. Its `## CLASSIFICATION` (per-byte
// code/data/undef) and `## REFERENCES` (typed xrefs, including COMPUTED_JUMP)
// sections are precisely what criteria 1 and 2 consume, verified against
// .planning/notes/dxa-ghidra-pivot-evidence/ghidra3.txt: `## STRUCTS` at line
// 820 is empty, `## REFERENCES` at line 821 carries 43 typed xrefs including
// `082e -> 089a COMPUTED_JUMP`.
//
// Structural facts, where a later phase needs them, come from DecompInterface
// as Decomp.java already demonstrates. That is Phase 24's concern, not this
// phase's, and no decompiler pass runs here.
//
// THE TWO DEFECTS FIXED (23-RESEARCH.md Pitfall 5):
//
//   1. THE 400-REFERENCE CAP IS GONE. ExportAnalysis.java bounded its
//      reference loop at four hundred iterations. It truncated SILENTLY, in
//      address order, so the tail of a real image vanished from the export. The
//      exact bound expression is deliberately NOT quoted here: 23-02-PLAN.md's
//      task-3 check greps this file for it and a comment quoting it would trip
//      that check. See .planning/notes/dxa-ghidra-pivot-evidence/ExportAnalysis.java
//      for the original line.
//
//      The fixture had 43 references and got away with it; a real release will
//      have thousands. There is no numeric bound on the reference loop in this
//      file, and `## REFERENCE_COUNT <n>` records what was actually written.
//
//   2. THE CLASSIFICATION COUNT IS ASSERTED. On a flat 64K image the
//      classification section is 65536 lines and roughly 1.5 MB, which is
//      expected, not a bug. But a short file is indistinguishable from a
//      complete one by eye, so the script asserts `## CLASSIFICATION_LINES <n>`
//      equals the image size and FAILS LOUDLY rather than exporting a short
//      file. The expected size is an explicit argument -- inferring it from the
//      program the script is checking would make the assertion vacuous.
//
// Reference kinds the annotation join consumes, all of which must survive the
// export: READ, WRITE, READ_WRITE, DATA, CONDITIONAL_JUMP, UNCONDITIONAL_JUMP,
// UNCONDITIONAL_CALL, COMPUTED_JUMP. Nothing filters by kind here; every
// reference the ReferenceManager yields is written.
//
// Usage:
//   analyzeHeadless <proj> <name> -import <image> \
//     -processor 6502:LE:16:default -loader BinaryLoader -loader-baseAddr <base> \
//     -noanalysis -preScript FlatVolatile.java <entrypoints> \
//     -postScript ExportAnalysis23.java <out-file> [<expected-classification-lines>] \
//     -deleteProject
//
// getScriptArgs()[0] is the output path. getScriptArgs()[1], when present, is
// the expected classification line count; when absent the count is reported but
// not asserted, and the script says so on its own output line.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressRange;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.Listing;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

import java.io.FileWriter;
import java.io.PrintWriter;

public class ExportAnalysis23 extends GhidraScript {

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length == 0 || args[0] == null || args[0].isEmpty()) {
            throw new IllegalArgumentException(
                "ExportAnalysis23: an output path is required as script argument 0");
        }
        long expectedLines = -1L;
        if (args.length > 1 && args[1] != null && !args[1].isEmpty()) {
            expectedLines = Long.parseLong(args[1]);
        }

        Listing lst = currentProgram.getListing();
        PrintWriter out = new PrintWriter(new FileWriter(args[0]));
        long classificationLines = 0L;
        long referenceCount = 0L;

        try {
            // ---- ## CLASSIFICATION : one line per address, `<address> code|data|undef`
            out.println("## CLASSIFICATION");
            for (AddressRange r : currentProgram.getMemory().getAddressRanges()) {
                for (Address a = r.getMinAddress(); ; a = a.next()) {
                    CodeUnit cu = lst.getCodeUnitContaining(a);
                    String kind = "undef";
                    if (cu instanceof Instruction) {
                        kind = "code";
                    } else if (cu instanceof Data) {
                        kind = ((Data) cu).isDefined() ? "data" : "undef";
                    }
                    out.println(a + " " + kind);
                    classificationLines += 1;
                    if (a.equals(r.getMaxAddress())) break;
                }
            }
            out.println("## CLASSIFICATION_LINES " + classificationLines);

            // ---- ## REFERENCES : every reference, NO CAP
            out.println("## REFERENCES");
            ReferenceIterator ri = currentProgram.getReferenceManager()
                    .getReferenceIterator(currentProgram.getMinAddress());
            while (ri.hasNext()) {
                Reference rf = ri.next();
                referenceCount += 1;
                out.println(rf.getFromAddress() + " -> " + rf.getToAddress() + " "
                        + rf.getReferenceType());
            }
            out.println("## REFERENCE_COUNT " + referenceCount);
        } finally {
            out.close();
        }

        println("EXPORT_FILE: " + args[0]);
        println("EXPORT_CLASSIFICATION_LINES: " + classificationLines);
        println("EXPORT_REFERENCE_COUNT: " + referenceCount);

        if (expectedLines < 0) {
            println("EXPORT_CLASSIFICATION_ASSERTED: no"
                    + " (no expected line count given as script argument 1)");
            return;
        }
        if (classificationLines != expectedLines) {
            // Loud, not a warning: a short classification file looks exactly
            // like a complete one, and every criterion-1 number is computed
            // over it.
            throw new IllegalStateException(
                "ExportAnalysis23: exported " + classificationLines
                + " classification lines but the image is " + expectedLines
                + " bytes. Refusing a short export. classification_lines="
                + classificationLines + " expected=" + expectedLines);
        }
        println("EXPORT_CLASSIFICATION_ASSERTED: yes (" + classificationLines
                + " lines == " + expectedLines + " bytes)");
    }
}
