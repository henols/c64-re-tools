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
// exists and REFERENCES does not answer the same question), then, SEVENTH
// and ADDITIVE (Phase 37 plan 37-02, `AUTO-04`/`AUTO-06`), `## CONST_WRITES`
// (one line per resolved immediate store to a watched address -- the
// processor port and three VIC/CIA registers -- in the form
// `<store-address> <target-address> <constant-value>`, with an explicit
// `## CONST_WRITES_NONE` line when none are found). Section order is fixed
// and each section's own lines are in ascending address order, so two runs
// over the same program produce byte-identical output -- the file is opened
// for OVERWRITE (the default `FileWriter(path)` constructor), never append.
//
// WHY `## CONST_WRITES` EXISTS, AND WHY IT IS DERIVED FROM P-CODE, NEVER FROM
// DECOMPILED C TEXT. `## DECOMPILED_TEXT` carries the recovered constant
// (e.g. `DAT_0001 = 0x37;`) but with NO per-statement address -- decompiler
// restructuring can reorder statements relative to their real addresses, so
// treating source order as address order is a silent correctness bug. This
// section instead walks each function's own high p-code operations (from the
// SAME `DecompInterface` results `## STRUCTURAL_FACTS` already walks -- no
// second interface, no second decompile). MEASURED this plan, real Ghidra
// 12.1.3: a write to ANY of this section's watched addresses is represented
// as the decompiler's own built-in "write_volatile" `CALLOTHER` pseudo-op,
// never a plain `COPY` -- this is a direct, necessary consequence of GHID-02's
// volatile carve (a stated prerequisite): without it the write is eliminated
// as a dead store before this walk ever sees it (see `## DECOMPILED_TEXT`'s
// own header above), and WITH it, the decompiler routes every volatile write
// through this synthetic call rather than an ordinary assignment. A plain
// `COPY` (for a watched address outside any volatile range) and a `STORE`
// (indirect addressing) are also recognised, for generality. Emits a line
// ONLY when the value being stored is ITSELF a compile-time constant -- a
// store whose value is computed emits NOTHING, and that silence is
// `AUTO-05`'s decline signal, a fact rather than a gap; a later editor must
// never "fill in" a guessed value.
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
import ghidra.program.model.address.AddressSpace;
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
import ghidra.program.model.pcode.Varnode;
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

    // D-37-06: the watched-address set for `## CONST_WRITES`. A widened set
    // later is a one-line edit here; the section's own line shape (three
    // whitespace-separated tokens) never encodes which addresses are watched,
    // so a consumer never has to know this set to parse a line.
    private static final long[] CONST_WRITE_WATCHED_ADDRESSES = {
        0x0001L, // the 6510 processor port -- its bank state resolves AUTO-04/AUTO-05
        0xD011L, // VIC-II control register 1 -- the display-mode bit, AUTO-06
        0xD018L, // VIC-II memory control register -- screen/char-base nibbles, AUTO-06
        0xDD00L, // CIA #2 data port A -- the VIC bank bits (inverted), AUTO-06
    };

    // MEASURED this plan, real Ghidra 12.1.3, against this project's own
    // volatile-carved fixtures: a write to a memory location the volatile
    // carve (`VolatileCarve.java`, GHID-02) has marked volatile is represented
    // in high p-code as this synthetic CALLOTHER, NEVER as a plain COPY --
    // this is the ENTIRE reason a recovered store to any of this section's
    // watched addresses is observable at all (every one of them falls inside
    // a volatile-marked range in this project's own harness; without the
    // carve, `## DECOMPILED_TEXT`'s own header documents that the write is
    // eliminated as a dead store before it ever reaches this walk). The
    // numeric value itself is a documented Ghidra decompiler-internal
    // constant (`UserPcodeOp::BUILTIN_VOLATILE_WRITE`, decompiler C++ source
    // `userop.cc`), not a registration-order-dependent id -- safe to hardcode.
    private static final long CALLOTHER_BUILTIN_VOLATILE_WRITE = 0x10000002L;

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

        // The program's own default (memory) address space -- used by
        // `## CONST_WRITES`'s p-code walk below to distinguish a REAL memory
        // write (this space) from a write to a register or a temporary
        // "unique" p-code varnode (a different space each), which must never
        // be mistaken for a watched-address write just because its numeric
        // offset happens to coincide with one.
        AddressSpace defaultSpace = currentProgram.getAddressFactory().getDefaultAddressSpace();

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

        // ---- ## CONST_WRITES : populated ONLY in MODE_DECOMPINTERFACE, below
        // (the same per-function p-code walk STRUCTURAL_FACTS's SPLIT_POINTER
        // detection already performs -- no second interface, no second
        // decompile). Stays empty under MODE_DATATYPEMANAGER, which never
        // constructs a decompiler interface at all; the section still emits
        // its explicit not-found line and a zero count in that mode, per this
        // file's own explicit-not-found discipline.
        List<String> constWriteFacts = new ArrayList<>();

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
                    // ALWAYS walk this function's own high p-code (not only
                    // when splitFound is still false) -- `## CONST_WRITES`
                    // needs every function's STORE/COPY operations regardless
                    // of whether the CONCAT11 text pattern already answered
                    // the SPLIT_POINTER question. This never changes the
                    // SPLIT_POINTER verdict itself: the loop below only ever
                    // sets splitFound from false to true, never the reverse.
                    HighFunction hf = r.getHighFunction();
                    if (hf != null) {
                        Iterator<PcodeOpAST> pcodeIter = hf.getPcodeOps();
                        while (pcodeIter.hasNext()) {
                            PcodeOp op = pcodeIter.next();
                            if (!splitFound && op.getOpcode() == PcodeOp.PIECE) {
                                splitFound = true;
                            }
                            collectConstWrite(op, defaultSpace, constWriteFacts);
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

        // ---- ## CONST_WRITES : SEVENTH, ADDITIVE (Phase 37 plan 37-02). See
        // this file's own header for why this section exists and is derived
        // from p-code, never from decompiled C text. `constWriteFacts` was
        // populated above, inside the MODE_DECOMPINTERFACE per-function loop
        // (staying empty under MODE_DATATYPEMANAGER, which never constructs a
        // decompiler interface) -- this is the SAME explicit-not-found
        // discipline `## STRUCTURAL_FACTS` already applies to each of its
        // five fact kinds: an absent section and a section that found
        // nothing are different facts and must read differently.
        StringBuilder constWritesSection = new StringBuilder("## CONST_WRITES\n");
        if (constWriteFacts.isEmpty()) {
            constWritesSection.append("## CONST_WRITES_NONE\n");
        } else {
            for (String fact : constWriteFacts) {
                constWritesSection.append(fact).append("\n");
            }
        }
        constWritesSection.append("## CONST_WRITES_COUNT ").append(constWriteFacts.size()).append("\n");

        // ---- Write every section, in the fixed order, opened for OVERWRITE.
        PrintWriter out = new PrintWriter(new FileWriter(args[0]));
        try {
            out.print(classificationSection);
            out.print(referencesSection);
            out.print(structuralSection);
            out.print(accountingSection);
            out.print(dispatchSection);
            out.print(decompiledTextSection);
            out.print(constWritesSection);
        } finally {
            out.close();
        }

        println("EXPORT_FILE: " + args[0]);
        println("EXPORT_CLASSIFICATION_LINES: " + classificationLines);
        println("EXPORT_REFERENCE_COUNT: " + referenceCount);
        println("EXPORT_DECOMPILED_TEXT_COUNT: " + decompiledTextCount);
        println("EXPORT_CONST_WRITES_COUNT: " + constWriteFacts.size());
    }

    /**
     * `## CONST_WRITES`'s own p-code fact-extraction, called once per p-code
     * operation from the per-function walk above (the SAME `DecompInterface`
     * results `## STRUCTURAL_FACTS` already walks -- no second interface, no
     * second decompile). Recognises three idioms a resolved store to a fixed
     * memory address can take in Ghidra's high p-code, checked in the order a
     * volatile-marked watched address actually needs them:
     *
     *   - The decompiler's own built-in "write_volatile" `CALLOTHER` --
     *     MEASURED this plan (real Ghidra 12.1.3) as the ONLY shape a write
     *     to any of this section's watched addresses takes in THIS harness,
     *     because GHID-02's volatile carve (a stated prerequisite) is what
     *     keeps the write from being eliminated as a dead store in the first
     *     place, and the decompiler represents a volatile write this way,
     *     never as a plain `COPY`. input(1) is the destination address
     *     varnode (its own address IS the target); input(2) is the value.
     *   - `COPY`, the direct-addressing form for a fixed address OUTSIDE any
     *     volatile-marked range (kept for a future watched-address widening
     *     that falls outside GHID-02's own two carved ranges) -- the
     *     OPERATION'S OWN OUTPUT varnode's address IS the destination.
     *   - `STORE`, the indirect-addressing form -- input(0) is a CONSTANT
     *     varnode encoding the destination address SPACE's own numeric id
     *     (the standard Ghidra STORE/LOAD convention), input(1) is the
     *     destination OFFSET within that space, input(2) is the value.
     *
     * Appends a line to `out` ONLY when: the resolved destination varnode's
     * own address space is the program's default (memory) space -- NEVER a
     * register or a temporary "unique" p-code varnode, whose numeric offsets
     * can coincide with a watched address purely by chance; the destination
     * address is one of `CONST_WRITE_WATCHED_ADDRESSES`; and the value
     * varnode is ITSELF a compile-time constant. A computed value (anything
     * else) emits NOTHING -- D-37-07, `AUTO-05`'s decline signal.
     */
    private void collectConstWrite(PcodeOp op, AddressSpace defaultSpace, List<String> out) {
        Varnode destVn;
        Varnode valueVn;
        if (op.getOpcode() == PcodeOp.CALLOTHER
                && op.getInput(0) != null
                && op.getInput(0).isConstant()
                && op.getInput(0).getOffset() == CALLOTHER_BUILTIN_VOLATILE_WRITE) {
            destVn = op.getInput(1);
            valueVn = op.getInput(2);
        } else if (op.getOpcode() == PcodeOp.COPY) {
            destVn = op.getOutput();
            valueVn = op.getInput(0);
        } else if (op.getOpcode() == PcodeOp.STORE) {
            Varnode spaceIdVn = op.getInput(0);
            Varnode offsetVn = op.getInput(1);
            valueVn = op.getInput(2);
            if (spaceIdVn == null || offsetVn == null || !offsetVn.isConstant() || valueVn == null) {
                return;
            }
            AddressSpace storeSpace = currentProgram.getAddressFactory().getAddressSpace((int) spaceIdVn.getOffset());
            if (storeSpace == null || !storeSpace.equals(defaultSpace)) {
                return;
            }
            destVn = new Varnode(defaultSpace.getAddress(offsetVn.getOffset()), 1);
        } else {
            return;
        }
        if (destVn == null || valueVn == null) {
            return;
        }
        Address destAddr = destVn.getAddress();
        if (destAddr == null || !destAddr.getAddressSpace().equals(defaultSpace)) {
            return;
        }
        boolean watched = false;
        for (long w : CONST_WRITE_WATCHED_ADDRESSES) {
            if (destAddr.getOffset() == w) {
                watched = true;
                break;
            }
        }
        if (!watched || !valueVn.isConstant()) {
            return;
        }
        Address storeAddr = op.getSeqnum().getTarget();
        out.add(storeAddr + " " + destAddr + " 0x" + Long.toHexString(valueVn.getOffset()));
    }
}
