// GhidraStructExport.java -- a committed, function-named Ghidra post-script.
//
// WHAT IT EXPORTS. A `## `-delimited plain-text file, one fact per line, in a
// FIXED section order: `## CLASSIFICATION` (per-address code/data/undef,
// exactly as many lines as the program's own memory blocks total), then
// `## REFERENCES` (every typed cross-reference, uncapped), then
// `## STRUCTURAL_FACTS` (five fact kinds, or an explicit not-found line for
// each kind not found), then `## DECOMPILE_ACCOUNTING` (attempted / decompiled
// / timedOut / failed counts under a committed identity and ceiling), then
// `## UNRESOLVED_DISPATCH` (a count and a list, with no denominator figure of
// any kind), then `## DECOMPILED_TEXT` (one function per entry: its entry
// point, its name, and its full decompiled C body verbatim, in
// `MODE_DECOMPINTERFACE` only -- see the note below on why this section
// exists and REFERENCES does not answer the same question). Section order is
// fixed and each section's own lines are in ascending address order, so two
// runs over the same program produce byte-identical output -- the file is
// opened for OVERWRITE (the default `FileWriter(path)` constructor), never
// append.
//
// WHY `## DECOMPILED_TEXT` EXISTS, AND WHY `## REFERENCES` CANNOT ANSWER THE
// SAME QUESTION. `## REFERENCES` is populated from the reference manager --
// one entry per operand reference established at DISASSEMBLY time, over the
// raw instruction listing. A memory write instruction's own reference to its
// target address survives in this list REGARDLESS of whether the target
// range is volatile: dead-store elimination is a DECOMPILER-layer, per-
// function, p-code-level transformation, and it does not remove or alter the
// listing's own reference database. MEASURED (real Ghidra 12.1.3, this
// project's own `bank.a` fixture): a non-volatile carve and a volatile carve
// of the identical program produce BYTE-IDENTICAL `## REFERENCES` sections --
// the write instructions are still there, still referenced, in both cases.
// The elimination is visible ONLY in the decompiled C text this section now
// carries: with the I/O ranges volatile, all four `$01` writes and both
// `$d020` writes (plus the read) appear as literal assignment/read
// statements; without volatile, three of the four `$01` writes and one of
// the two `$d020` writes are gone from the decompiled text entirely, with no
// warning anywhere else in the export. A harness that only checks
// `## REFERENCES` for this project's own volatile-carve criterion would
// observe no difference at all and wrongly conclude the carve made no
// difference.
//
// WHICH ARGUMENTS IT TAKES. `getScriptArgs()[0]` is the output path,
// required -- an empty or absent value throws a named refusal before
// anything else runs. `getScriptArgs()[1]`, when present, OVERRIDES the
// internal classification-line assertion described below; it exists so a
// caller (this project's own hermetic gate) can plant a deliberately wrong
// expectation and observe the resulting throw. `getScriptArgs()[2]`, when
// present, selects the export MODE: `MODE_DECOMPINTERFACE` ("DECOMP", the
// default when the argument is absent) or `MODE_DATATYPEMANAGER` ("DATATYPE",
// the control route). Whichever mode ran is printed on its own line.
//
// WHICH MODE DOES WHAT. `## CLASSIFICATION` and `## REFERENCES` are
// mode-independent -- neither touches the decompiler layer at all. In
// `MODE_DECOMPINTERFACE` (the acceptance route), `## STRUCTURAL_FACTS` and
// `## DECOMPILE_ACCOUNTING` are both produced by walking a `DecompInterface`
// over every function. In `MODE_DATATYPEMANAGER` (the control route,
// invoked by supplying "DATATYPE" as script argument 2), this script does
// NOT construct a `DecompInterface` at all: `## STRUCTURAL_FACTS` instead
// reports what `DataTypeManager.getAllComposites()` and `.getDefinedData()`
// found, each with its own explicit count line, and `## DECOMPILE_ACCOUNTING`
// reports that the decompiler was not invoked in this mode. The point of the
// mode argument is that BOTH routes run against the SAME image, in the SAME
// script, one argument apart -- proving structurally that this project's
// structural facts come from the decompiler layer and not from the listing's
// data types, per the Standing Constraint recorded in ROADMAP.md. Its
// composite and defined-data counts are expected to read as near-empty on
// 6502; that emptiness is the control's own finding, not a bug in the
// control.
//
// THE TWO DEFECTS THIS PROMOTION FIXES, RELATIVE TO ITS DIRECT ANCESTOR
// (`.planning/phases/23-.../evidence/ExportAnalysis23.java`):
//
//   1. THE CLASSIFICATION EXPECTATION IS NOW THE SCRIPT'S OWN BLOCK TOTAL,
//      NEVER THE IMAGE SIZE. The ancestor compared the observed
//      classification-line count against an explicit caller-supplied
//      argument the caller was expected to derive from the image's own
//      byte length -- correct-looking, but silently wrong on the `.prg`
//      route, where the loaded image is far smaller than the classified
//      address space (the BASIC stub and pad bytes classify too). This
//      script instead sums every memory block's own size via
//      `Memory.getBlocks()` INSIDE the script and asserts the observed
//      count against THAT sum -- no fixed number and no image size appears
//      anywhere in this assertion. When script argument 1 supplies an
//      override, an explicit labelled line records that the override was in
//      effect, so a planted wrong expectation is visible in the log rather
//      than mistaken for the real assertion.
//
//   2. STRUCTURAL FACTS NOW COME FROM `DecompInterface`, WITH A THREE-WAY
//      ACCOUNTING IDENTITY. The ancestor exported no structural facts at all
//      (its own header explained why: `DataTypeManager`'s composite query
//      returns essentially nothing on 6502). This script instead walks
//      every function through `DecompInterface`, calling `isTimedOut()` on
//      every `DecompileResults` SEPARATELY from `decompileCompleted()` (they
//      are two distinct methods -- a timed-out function is not the same
//      state as a failed one), and asserts internally that
//      `attempted == decompiled + timedOut + failed`, throwing loudly on a
//      mismatch. A committed ceiling on the timedOut count is asserted the
//      same way: exceeding it throws, naming both numbers. A program with
//      zero functions emits an explicit, labelled zero-function line rather
//      than leaving the section empty -- an omitted or empty section reads
//      exactly like a complete one, which is the whole failure shape this
//      accounting exists to catch.
//
// UNRESOLVED DISPATCH HAS NO DENOMINATOR. This project's own C2-sites
// enumeration was narrowed to absent (owner decision, ROADMAP.md), so this
// script reports unresolved computed-dispatch sites as a bare count and a
// per-site list, never as a proportion, a percentage or a total-sites
// figure of any kind. Naming a denominator this milestone cannot source
// independently is exactly the shape of the unreproducible published
// headline this project's own history warns against -- a later editor
// should not helpfully add one back.
//
// TYPED CROSS-REFERENCES SURVIVE UNCHANGED. The reference loop below is the
// ancestor's own uncapped loop, printing `Reference.getReferenceType()` for
// every reference with no numeric bound and a written-count line. Every
// access kind the annotation join consumes (read, write, read-write, and
// the flow-typed kinds) must survive this export; nothing here filters by
// kind.
//
// NO PART OF THIS FILE, IN ANY FORM, NAMES A PHASE NUMBER.
//
// Usage:
//   analyzeHeadless <proj> <name> -import <image> \
//     -processor <LANGUAGE_ID> -loader BinaryLoader -loader-baseAddr <base> \
//     -noanalysis -scriptPath <scriptdir> \
//     -preScript VolatileCarve.java <entrypoints> \
//     -postScript GhidraStructExport.java <out.txt> [<expected-lines>] \
//     -deleteProject
//
// (Script argument 2, the mode selector, is not yet reachable through
// `ghidra.analyze`'s own typed seam -- that seam supplies only the export
// path and the expected-line override as positional script arguments. The
// control mode is invoked directly against `analyzeHeadless`, outside the
// seam, until a later plan wires a third positional slot.)

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressRange;
import ghidra.program.model.data.DataType;
import ghidra.program.model.data.DataTypeManager;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.DataIterator;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.listing.Listing;
import ghidra.program.model.pcode.HighFunction;
import ghidra.program.model.pcode.PcodeOp;
import ghidra.program.model.pcode.PcodeOpAST;
import ghidra.program.model.symbol.FlowType;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.ReferenceIterator;

import java.io.FileWriter;
import java.io.PrintWriter;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class GhidraStructExport extends GhidraScript {

    // Decompile timeout per function, in SECONDS (decompileFunction's own
    // timeout parameter is seconds, not milliseconds). Value: 30.
    private static final int DECOMPILE_TIMEOUT_SECONDS = 30;

    // Committed ceiling on the number of timed-out functions tolerated in one
    // run before this script refuses loudly. Value: 5.
    private static final int TIMED_OUT_CEILING = 5;

    // Export mode names, selected by getScriptArgs()[2].
    private static final String MODE_DECOMPINTERFACE = "DECOMP";
    private static final String MODE_DATATYPEMANAGER = "DATATYPE";

    private static final Pattern CONCAT11_PATTERN = Pattern.compile("CONCAT11\\(");
    private static final Pattern ARRAY_BOUND_PATTERN =
            Pattern.compile("for\\s*\\([^;]*;[^;]*<\\s*(0x[0-9a-fA-F]+|[0-9]+)[^;]*;");
    private static final Pattern RECORD_STRIDE_PATTERN =
            Pattern.compile("\\+\\s*\\*?\\w*\\s*\\*\\s*(0x[0-9a-fA-F]+|[0-9]+)\\)");

    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        if (args.length == 0 || args[0] == null || args[0].isEmpty()) {
            throw new IllegalArgumentException(
                "GhidraStructExport: an output path is required as script argument 0");
        }
        String overrideRaw = (args.length > 1 && args[1] != null && !args[1].isEmpty()) ? args[1] : null;
        String mode = (args.length > 2 && args[2] != null && !args[2].isEmpty())
                ? args[2] : MODE_DECOMPINTERFACE;
        if (!mode.equals(MODE_DECOMPINTERFACE) && !mode.equals(MODE_DATATYPEMANAGER)) {
            throw new IllegalArgumentException(
                "GhidraStructExport: script argument 2 must be \"" + MODE_DECOMPINTERFACE
                + "\" or \"" + MODE_DATATYPEMANAGER + "\"; got \"" + mode + "\"");
        }
        println("EXPORT_MODE: " + mode);

        Listing lst = currentProgram.getListing();

        // ---- ## CLASSIFICATION : one line per address, `<address> code|data|undef`
        StringBuilder classificationSection = new StringBuilder();
        long classificationLines = 0L;
        classificationSection.append("## CLASSIFICATION\n");
        for (AddressRange r : currentProgram.getMemory().getAddressRanges()) {
            for (Address a = r.getMinAddress(); ; a = a.next()) {
                CodeUnit cu = lst.getCodeUnitContaining(a);
                String kind = "undef";
                if (cu instanceof Instruction) {
                    kind = "code";
                } else if (cu instanceof Data) {
                    kind = ((Data) cu).isDefined() ? "data" : "undef";
                }
                classificationSection.append(a).append(" ").append(kind).append("\n");
                classificationLines += 1;
                if (a.equals(r.getMaxAddress())) break;
            }
        }
        classificationSection.append("## CLASSIFICATION_LINES ").append(classificationLines).append("\n");

        // Self-computed expectation: the sum of every memory block's own
        // size. No fixed number and no image size appears in this
        // computation -- it is read entirely off the program's own memory.
        long blockTotalExpected = 0L;
        for (var b : currentProgram.getMemory().getBlocks()) {
            blockTotalExpected += b.getSize();
        }
        classificationSection.append("CLASSIFICATION_EXPECTED_FROM_BLOCKS ").append(blockTotalExpected).append("\n");
        classificationSection.append("CLASSIFICATION_OBSERVED ").append(classificationLines).append("\n");
        // Printed to the script console (and so into the captured run log,
        // not only the export file) -- this is what the harness's own
        // run-log classifier reads for the classification-expectation
        // question. Same labelled text either way.
        println("CLASSIFICATION_EXPECTED_FROM_BLOCKS: " + blockTotalExpected);
        println("CLASSIFICATION_OBSERVED: " + classificationLines);

        long assertAgainst = blockTotalExpected;
        if (overrideRaw != null) {
            assertAgainst = Long.parseLong(overrideRaw);
            classificationSection.append("CLASSIFICATION_OVERRIDE_USED yes (asserting against ")
                    .append(assertAgainst).append(" instead of the block total ")
                    .append(blockTotalExpected).append(")\n");
            println("CLASSIFICATION_OVERRIDE_USED: yes (asserting against " + assertAgainst
                    + " instead of the block total " + blockTotalExpected + ")");
        } else {
            classificationSection.append("CLASSIFICATION_OVERRIDE_USED no\n");
            println("CLASSIFICATION_OVERRIDE_USED: no");
        }
        if (classificationLines != assertAgainst) {
            // Loud, not a warning: a short classification file looks exactly
            // like a complete one, and every count computed over it is wrong.
            throw new IllegalStateException(
                "GhidraStructExport: exported " + classificationLines
                + " classification lines but expected " + assertAgainst
                + " (block-total expectation=" + blockTotalExpected
                + "). Refusing a short export.");
        }

        // ---- ## REFERENCES : every reference, NO CAP, typed access kind preserved
        StringBuilder referencesSection = new StringBuilder();
        long referenceCount = 0L;
        referencesSection.append("## REFERENCES\n");
        ReferenceIterator ri = currentProgram.getReferenceManager()
                .getReferenceIterator(currentProgram.getMinAddress());
        List<Reference> allReferences = new ArrayList<>();
        while (ri.hasNext()) {
            Reference rf = ri.next();
            allReferences.add(rf);
            referenceCount += 1;
            referencesSection.append(rf.getFromAddress()).append(" -> ").append(rf.getToAddress())
                    .append(" ").append(rf.getReferenceType()).append("\n");
        }
        referencesSection.append("## REFERENCE_COUNT ").append(referenceCount).append("\n");

        // ---- ## STRUCTURAL_FACTS and ## DECOMPILE_ACCOUNTING : mode-dependent
        StringBuilder structuralSection = new StringBuilder("## STRUCTURAL_FACTS\n");
        StringBuilder accountingSection = new StringBuilder("## DECOMPILE_ACCOUNTING\n");
        // ---- ## DECOMPILED_TEXT : one function per entry, full C body
        // verbatim. See this file's own header for why this section exists
        // and REFERENCES does not answer the same question. Populated only
        // in MODE_DECOMPINTERFACE -- MODE_DATATYPEMANAGER never decompiles.
        StringBuilder decompiledTextSection = new StringBuilder("## DECOMPILED_TEXT\n");
        long decompiledTextCount = 0L;

        if (mode.equals(MODE_DATATYPEMANAGER)) {
            // Control route: DataTypeManager only. DecompInterface is never
            // constructed in this branch.
            DataTypeManager dtm = currentProgram.getDataTypeManager();
            int compositeCount = 0;
            Iterator<ghidra.program.model.data.Composite> compositeIter = dtm.getAllComposites();
            while (compositeIter.hasNext()) {
                compositeIter.next();
                compositeCount += 1;
            }
            structuralSection.append("STRUCTURAL_FACT COMPOSITE_TYPES count=").append(compositeCount).append("\n");
            long definedDataCount = 0L;
            DataIterator dataIter = lst.getDefinedData(true);
            while (dataIter.hasNext()) {
                dataIter.next();
                definedDataCount += 1;
            }
            structuralSection.append("STRUCTURAL_FACT DEFINED_DATA count=").append(definedDataCount).append("\n");
            structuralSection.append("STRUCTURAL_FACT_MODE_NOTE DataTypeManager route -- expected near-empty on 6502\n");
            accountingSection.append("DECOMPILE_ACCOUNTING_MODE_NOTE decompiler not invoked in ")
                    .append(MODE_DATATYPEMANAGER).append(" mode\n");
            decompiledTextSection.append("DECOMPILED_TEXT_MODE_NOTE decompiler not invoked in ")
                    .append(MODE_DATATYPEMANAGER).append(" mode\n");
            decompiledTextSection.append("## DECOMPILED_TEXT_COUNT 0\n");
        } else {
            DecompInterface di = new DecompInterface();
            try {
                di.openProgram(currentProgram);
                long attempted = 0L;
                long decompiled = 0L;
                long timedOut = 0L;
                long failed = 0L;

                List<String> arrayBoundFacts = new ArrayList<>();
                List<String> splitPointerFacts = new ArrayList<>();
                List<String> recordStrideFacts = new ArrayList<>();

                Iterator<Function> functions = currentProgram.getFunctionManager().getFunctions(true);
                while (functions.hasNext()) {
                    Function f = functions.next();
                    attempted += 1;
                    DecompileResults r = di.decompileFunction(f, DECOMPILE_TIMEOUT_SECONDS, monitor);
                    if (r.isTimedOut()) {
                        timedOut += 1;
                        continue;
                    }
                    if (!r.decompileCompleted()) {
                        failed += 1;
                        continue;
                    }
                    decompiled += 1;

                    String cText = r.getDecompiledFunction() != null
                            ? r.getDecompiledFunction().getC() : "";

                    decompiledTextSection.append("FUNCTION ").append(f.getEntryPoint()).append(" ")
                            .append(f.getName()).append("\n");
                    decompiledTextSection.append(cText);
                    if (cText.isEmpty() || cText.charAt(cText.length() - 1) != '\n') {
                        decompiledTextSection.append("\n");
                    }
                    decompiledTextCount += 1;

                    Matcher arrayM = ARRAY_BOUND_PATTERN.matcher(cText);
                    if (arrayM.find()) {
                        arrayBoundFacts.add("function=" + f.getName() + " address=" + f.getEntryPoint()
                                + " detail=" + arrayM.group().trim());
                    }

                    boolean splitFound = CONCAT11_PATTERN.matcher(cText).find();
                    if (!splitFound) {
                        HighFunction hf = r.getHighFunction();
                        if (hf != null) {
                            Iterator<PcodeOpAST> pcodeIter = hf.getPcodeOps();
                            while (pcodeIter.hasNext()) {
                                PcodeOp op = pcodeIter.next();
                                if (op.getOpcode() == PcodeOp.PIECE) {
                                    splitFound = true;
                                    break;
                                }
                            }
                        }
                    }
                    if (splitFound) {
                        splitPointerFacts.add("function=" + f.getName() + " address=" + f.getEntryPoint());
                    }

                    Matcher strideM = RECORD_STRIDE_PATTERN.matcher(cText);
                    if (strideM.find()) {
                        recordStrideFacts.add("function=" + f.getName() + " address=" + f.getEntryPoint()
                                + " detail=" + strideM.group().trim());
                    }
                }

                if (attempted == 0) {
                    accountingSection.append("DECOMPILE_ZERO_FUNCTIONS true (no functions were found to decompile)\n");
                }
                accountingSection.append("DECOMPILE_ATTEMPTED ").append(attempted).append("\n");
                accountingSection.append("DECOMPILE_DECOMPILED ").append(decompiled).append("\n");
                accountingSection.append("DECOMPILE_TIMED_OUT ").append(timedOut).append("\n");
                accountingSection.append("DECOMPILE_FAILED ").append(failed).append("\n");
                accountingSection.append("DECOMPILE_TIMEOUT_SECONDS ").append(DECOMPILE_TIMEOUT_SECONDS).append("\n");
                accountingSection.append("DECOMPILE_TIMED_OUT_CEILING ").append(TIMED_OUT_CEILING).append("\n");

                if (attempted != decompiled + timedOut + failed) {
                    throw new IllegalStateException(
                        "GhidraStructExport: attempted=" + attempted + " does not equal decompiled="
                        + decompiled + " + timedOut=" + timedOut + " + failed=" + failed);
                }
                if (timedOut > TIMED_OUT_CEILING) {
                    throw new IllegalStateException(
                        "GhidraStructExport: timedOut=" + timedOut
                        + " exceeds the committed ceiling TIMED_OUT_CEILING=" + TIMED_OUT_CEILING);
                }

                // ARRAY_BOUND
                if (arrayBoundFacts.isEmpty()) {
                    structuralSection.append("STRUCTURAL_FACT ARRAY_BOUND not-found\n");
                } else {
                    for (String s : arrayBoundFacts) {
                        structuralSection.append("STRUCTURAL_FACT ARRAY_BOUND found ").append(s).append("\n");
                    }
                }
                // SPLIT_POINTER (the CONCAT11 / PcodeOp.PIECE idiom)
                if (splitPointerFacts.isEmpty()) {
                    structuralSection.append("STRUCTURAL_FACT SPLIT_POINTER not-found\n");
                } else {
                    for (String s : splitPointerFacts) {
                        structuralSection.append("STRUCTURAL_FACT SPLIT_POINTER found ").append(s).append("\n");
                    }
                }
                // RECORD_STRIDE
                if (recordStrideFacts.isEmpty()) {
                    structuralSection.append("STRUCTURAL_FACT RECORD_STRIDE not-found\n");
                } else {
                    for (String s : recordStrideFacts) {
                        structuralSection.append("STRUCTURAL_FACT RECORD_STRIDE found ").append(s).append("\n");
                    }
                }
            } finally {
                di.dispose();
            }

            // COMPUTED_JUMP_RESOLVED -- a COMPUTED_JUMP reference whose target
            // address is a real, defined address (not unresolved). Derived
            // from the reference list gathered above; needs no second decompile.
            boolean computedJumpResolvedFound = false;
            for (Reference rf : allReferences) {
                if (rf.getReferenceType() instanceof FlowType
                        && ((FlowType) rf.getReferenceType()).isComputed()
                        && rf.getToAddress() != null) {
                    structuralSection.append("STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED found from=")
                            .append(rf.getFromAddress()).append(" to=").append(rf.getToAddress()).append("\n");
                    computedJumpResolvedFound = true;
                }
            }
            if (!computedJumpResolvedFound) {
                structuralSection.append("STRUCTURAL_FACT COMPUTED_JUMP_RESOLVED not-found\n");
            }

            // SELF_MODIFYING_WRITE -- a WRITE reference whose destination
            // address falls inside an existing instruction's own body.
            boolean selfModifyingFound = false;
            for (Reference rf : allReferences) {
                if (rf.getReferenceType().isWrite() && lst.getInstructionAt(rf.getToAddress()) != null) {
                    structuralSection.append("STRUCTURAL_FACT SELF_MODIFYING_WRITE found from=")
                            .append(rf.getFromAddress()).append(" to=").append(rf.getToAddress()).append("\n");
                    selfModifyingFound = true;
                }
            }
            if (!selfModifyingFound) {
                structuralSection.append("STRUCTURAL_FACT SELF_MODIFYING_WRITE not-found\n");
            }

            decompiledTextSection.append("## DECOMPILED_TEXT_COUNT ").append(decompiledTextCount).append("\n");
        }

        // ---- ## UNRESOLVED_DISPATCH : a count and a list, NO DENOMINATOR
        //
        // This section reports a bare count and one line per site. It never
        // computes or prints a proportion, a share, or a total-sites figure
        // of any kind -- this milestone has no independent enumerator to
        // source such a figure from, and naming one anyway is exactly the
        // unreproducible-headline mistake this project's own history warns
        // against. A later editor should not add one back.
        StringBuilder dispatchSection = new StringBuilder("## UNRESOLVED_DISPATCH\n");
        List<String> unresolvedSites = new ArrayList<>();
        for (Instruction insn : lst.getInstructions(true)) {
            FlowType ft = insn.getFlowType();
            if (ft != null && ft.isComputed() && insn.getFlows().length == 0) {
                unresolvedSites.add(insn.getAddress() + " " + insn.getMnemonicString());
            }
        }
        dispatchSection.append("UNRESOLVED_DISPATCH_COUNT ").append(unresolvedSites.size()).append("\n");
        for (String site : unresolvedSites) {
            dispatchSection.append(site).append("\n");
        }

        // ---- Write every section, in the fixed order, opened for OVERWRITE.
        PrintWriter out = new PrintWriter(new FileWriter(args[0]));
        try {
            out.print(classificationSection);
            out.print(referencesSection);
            out.print(structuralSection);
            out.print(accountingSection);
            out.print(dispatchSection);
            out.print(decompiledTextSection);
        } finally {
            out.close();
        }

        println("EXPORT_FILE: " + args[0]);
        println("EXPORT_CLASSIFICATION_LINES: " + classificationLines);
        println("EXPORT_REFERENCE_COUNT: " + referenceCount);
        println("EXPORT_DECOMPILED_TEXT_COUNT: " + decompiledTextCount);
    }
}
