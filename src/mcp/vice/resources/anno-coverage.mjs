#!/usr/bin/env node
// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-coverage.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
// anno-coverage.mts -- the ONE place that measures how well a binary has
// actually been reverse-engineered, reported as three distinct numbers --
// structural completeness, the Auto-versus-User label ratio, and a sampled
// independent-reproducibility check -- never collapsed into one aggregate
// percentage.
//
// ---------------------------------------------------------------------------
// WHY THIS FILE EXISTS
// ---------------------------------------------------------------------------
// A coverage instrument is needed, and the obvious implementation --
// ask the external analyser how much of the image it has classified as `Code` and
// call that "completeness" -- is CIRCULAR, and provably so at upstream's own
// source. `follow_indirect_jumps()` (`analyzer.rs:445-540` at the pinned
// commit) walks a linear sweep over bytes whose `block_types` entry is
// ALREADY `Code`, and only acts on opcode `0x6C` whose pointer location is
// ALREADY classified `Address`. On an under-classified binary -- which is
// exactly the state a coverage instrument exists to measure -- that walk
// finds nothing. An instrument built on it would report "nothing left to do"
// on a binary nobody has looked at yet. That is the defect this module is
// shaped to make unreachable, not merely to avoid.
//
// So the structural census here is a pure function of TWO things: the raw
// bytes, and the seed set the caller supplies. The store's own block table
// enters this file through exactly ONE boundary -- `block-class.mts`, which
// is the only place in the tree that interprets a store block-type string --
// and it reaches only a sub-report that is explicitly named as a comparison,
// never a measure of completeness. This file compares NEUTRAL block classes
// and never a store vocabulary. `anno-coverage.test.ts` pins that boundary
// twice: by rewriting every block entry to one type and asserting no census
// byte count moves, and by substituting a second block vocabulary through
// the boundary and asserting the same thing.
//
// ---------------------------------------------------------------------------
// WHAT THIS IS THE ONE AUTHORITATIVE PLACE FOR
// ---------------------------------------------------------------------------
//   - the byte census (`computeStructuralCensus`) and its four disjoint byte
//     classes;
//   - the WIDENED indirect-dispatch scan (`scanIndirectDispatch`) that reaches
//     the four classes upstream's own walk does not: zero-page vectors,
//     multi-entry dispatch tables, split lo/hi tables, and the stack-return
//     dispatch idiom (which contains no indirect-jump opcode at all and is
//     therefore completely invisible to an opcode-keyed walk);
//   - the DISPATCH-CONTEXT GATE that decides whether a Class-3 split lo/hi
//     pairing is PROVEN or merely ADVISORY -- same index register, a dispatch
//     consumer in evidence, every reconstructed target in-image and decodable,
//     and a lo/hi orientation something other than address order determined.
//     An ungated pairing is reported in `splitTableCandidates`, contributes
//     nothing to `discoveredTargets` and nothing to `tableEntryAddresses`;
//   - `provenDispatchTargets()` -- the ONE seam that decides what may seed a
//     recursive descent. Every `extraSeeds:` assignment in this file reads it
//     and reads nothing else;
//   - the two label figures (`computeLabelRatio`), one of which is gameable
//     and one of which is not;
//   - the comment-vacuity measure (`computeCommentVacuity`) and its exact
//     normalisation rules;
//   - the sampled reproducibility result (`computeReproducibility`), its
//     deterministic sample rule, and the ANCHORED multi-caller rule
//     (`namesACaller`) -- a caller reference is a DELIMITED token, never a
//     substring, so a comment mentioning an unrelated address whose leading
//     digits coincide with a caller's short form buys nothing;
//   - the pinned report schema (`COVERAGE_SCHEMA_VERSION`,
//     `buildCoverageReport`).
//
// ---------------------------------------------------------------------------
// WHAT NOT TO DO -- each of these is a specific, named trap
// ---------------------------------------------------------------------------
//   1. NEVER derive any measure from the store's block-type listing. The
//      listing enters this file only through `block-class.mts` and leaves it
//      as a comparison. A "completeness" number sourced from the block table
//      measures the annotator's bookkeeping, not the annotation -- and mass
//      `anno_set_data_type` calls would move it for free. Nor may this file
//      compare a store block-type string directly: the boundary owns that
//      vocabulary, and a comparison written here would be a second answer to
//      "what class is this address" beside the one the boundary gives.
//   2. NEVER sum the linear-sweep figure into completeness. Upstream's own
//      Pitfall 1 says it plainly: "Random data routinely disassembles into
//      plausible-looking instruction sequences -- this does NOT make it
//      code." `reachedAsInstruction` means REACHED BY RECURSIVE DESCENT FROM
//      A SEED. `linearSweepDecodable` is reported beside it, deliberately
//      under a different name, and is never added to it.
//   3. NEVER emit a single combined coverage figure -- not in the report
//      object, not in a summary line, not derived at the point of display.
//      Staying separately addressable, never combined, IS the whole point.
//      `coverageFindings()` below is a boolean verdict with per-measure
//      reasons, NOT an aggregate: it never averages, sums or weights the
//      measures, and every finding names exactly one of them.
//   4. NEVER define a second confidence vocabulary. `CONFIDENCE_GRADES` from
//      `./anno-confidence.mts` is the only one; that module's own header
//      forbids a second spelling.
//   5. NEVER import this repository's host-path or container-path translation
//      modules. The whole anno module family is asserted ABSENT from that
//      consumer set by a derived-from-disk scan (the `anno-*.ts` glob in the
//      path-consumer guard suite), and this file joins that family by name --
//      an import here would fail that guard rather than merely violate a
//      convention. Note that the guard's own filename is deliberately not
//      written out in this file: an acceptance check greps this source for
//      the two module names and a mention would trip it.
//   6. NEVER add a file-write call, a project-save call, or a live-session
//      import here. A coverage run is read-only over a project file BY
//      CONSTRUCTION, so two concurrent runs cannot corrupt a project and an
//      interrupted run leaves no partial report behind -- there is nothing on
//      disk for it to leave. `anno-coverage.test.ts` asserts that at source
//      level.
//   7. NEVER let an absent input read as a pass. A missing payload,
//      an undecodable one, or an empty comment set reports an explicit `null`
//      ratio plus a stated reason -- never a silently-omitted measure and
//      never a zero that reads like "clean".
//   8. NEVER promote a RECONSTRUCTED value to a descent seed without evidence
//      that something dispatches through it. Two indexed loads inside eight
//      instructions of each other is the single most ordinary shape in C64
//      code -- a screen-plus-colour copy loop -- and reading the bytes at
//      their two operand bases as a lo/hi address table turns ordinary DATA
//      into `reached-as-instruction`, which trap 2 defines as REACHED BY
//      RECURSIVE DESCENT FROM A SEED. The census's whole meaning is that
//      reachability was PROVEN; injecting arbitrary data into the seed set
//      destroys that meaning by the other route, without ever touching the
//      linear-sweep figure trap 2 guards. Reproduced at report level before
//      the gate landed: two 64-byte programs at $0810 with 7 bytes of real
//      code each, differing ONLY in immediate versus indexed addressing,
//      reported reached=7 and reached=55. Adding a source to
//      `provenDispatchTargets()` IS the decision to treat that source as
//      proof of code -- make it deliberately or not at all.
//
// ---------------------------------------------------------------------------
// A DELIBERATE DEVIATION, RECORDED
// ---------------------------------------------------------------------------
// A two-SESSION answer key was considered -- a second agent session
// re-deriving the answer independently. Nested headless agent sessions stall
// indefinitely in this project's environment, so that axis is not runnable
// here. The independence axis used instead is BYTES-VERSUS-STORE: one side
// classifies an address using only the raw bytes and this file's census, the
// other using only the store's own documentation (confidence grade, block
// type). Neither side reads the other's input. The store side's own
// vocabulary now lives behind the named boundary (`block-class.mts`), which
// takes the block listing and an address and nothing else -- so the axis
// cannot be collapsed by quietly handing the store side a look at the bytes.
// The seal (`evidence/coverage-reproducibility/ANSWER.sha256`) is what makes
// the result non-retrofittable: the hash is committed before the
// re-derivation is written, and a missing or empty re-derivation FAILS
// rather than skips.
import { blockClassAt } from "./block-class.mjs";
import { decode } from "./disasm-decoder.mjs";
import { decodeRawData, flatImageOrigin, parsePrg } from "./prg-image.mjs";
import { CONFIDENCE_GRADES, parseConfidencePrefix } from "./anno-confidence.mjs";
import { readFileSync } from "node:fs";
import { extname } from "node:path";
// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------
/**
 * The report's schema version. The decomposition sweep reads this report
 * repeatedly and the reassembly gate reuses the dispatch scan, so the field
 * set is a contract, not an implementation detail. Bump this ONLY together
 * with `anno-coverage.test.ts`'s exact top-level key-set assertion -- that
 * test exists so a silent field rename fails loudly rather than quietly
 * feeding two consumers `undefined`.
 *
 * VERSION HISTORY
 *   1 -- the original nine top-level keys.
 *   2 -- the top-level key set is UNCHANGED; the `dispatch` sub-object's
 *        target vocabulary changed. `discoveredTargets` narrowed to
 *        EVIDENCE-BACKED targets only, and the ungated split lo/hi pairings
 *        it used to include moved to the new advisory sibling
 *        `splitTableCandidates`. A consumer reading `discoveredTargets` gets
 *        a smaller, honest set than it did at version 1; this bump is the
 *        signal that a nested meaning changed. Accepted by a human at a
 *        decision checkpoint (option `narrow-and-add-sibling`), which also
 *        discharged the human-verification requirement this schema bump
 *        needed.
 */
export const COVERAGE_SCHEMA_VERSION = 2;
// ---------------------------------------------------------------------------
// Bounds. Both are explicit, both surface a truncation flag rather than
// looping (T-19-12/T-19-13). Neither is a heuristic "walk while plausible".
// ---------------------------------------------------------------------------
/** Hard cap on recursive-descent steps before the walk reports truncation. */
export const MAX_WALK_STEPS = 200_000;
/** Hard cap on entries read from any one dispatch table. A table longer than
 * this reports `truncated: true` for that table rather than walking on. */
export const MAX_TABLE_ENTRIES = 64;
/** How many decoded instructions a split-table pairing may span. Two indexed
 * loads further apart than this are not treated as a lo/hi pair. */
/** How many decoded instructions the class-3 pairing window spans, and the
 * `reach` every `hasDispatchContext()` / `resolveSplitOrientation()` call is
 * given. EXPORTED so the gate-interior witness in `anno-coverage.test.ts` can
 * ask its question over the same window the predicate rules on, rather than
 * over a number typed into a test that could silently drift from this one. */
export const SPLIT_TABLE_WINDOW = 8;
/**
 * Thrown ONLY for a caller contract violation -- an absent or unreadable
 * project path. Never thrown for malformed bytes: a payload that will not
 * gunzip, or a project file that is not JSON, is reported as an explicit
 * `payloadDecoded: false` plus a reason -- never a silent skip, and
 * never a throw the caller has to guess at either. Mirrors
 * `AnnoProjectSettingsError`'s named-field convention so a caller never has
 * to parse message text to recover the path.
 */
export class AnnoCoverageInputError extends Error {
    projectPath;
    constructor(message, { cause, projectPath } = {}) {
        super(message);
        this.name = "AnnoCoverageInputError";
        this.projectPath = projectPath;
        if (cause !== undefined) {
            this.cause = cause;
        }
    }
}
const CLASS_ORDER = [
    "reached-as-instruction",
    "table-entry",
    "referenced-as-data",
    "unreached",
];
const TERMINATORS = new Set([0x00 /* brk */, 0x40 /* rti */, 0x4c /* jmp abs */, 0x60 /* rts */, 0x6c /* jmp ind */]);
/** Mnemonics whose absolute/zero-page operand names a DATA location. Used to
 * mark `referenced-as-data`. Exactly one byte is marked per reference: the
 * extent of an indexed access is not determinable from the bytes, so guessing
 * a length here would manufacture coverage that was never proven. */
const DATA_REF_MNEMONICS = new Set([
    "lda", "ldx", "ldy", "sta", "stx", "sty",
    "adc", "sbc", "and", "ora", "eor", "cmp", "cpx", "cpy",
    "bit", "inc", "dec", "asl", "lsr", "rol", "ror",
]);
function sortedUniqueNumbers(values) {
    return [...new Set(values)].sort((a, b) => a - b);
}
function toRuns(classes, origin) {
    const runs = [];
    if (classes.length === 0)
        return runs;
    let runStart = 0;
    for (let i = 1; i <= classes.length; i++) {
        if (i === classes.length || classes[i] !== classes[runStart]) {
            runs.push({
                start: origin + runStart,
                end: origin + i - 1,
                class: CLASS_ORDER[classes[runStart]],
            });
            runStart = i;
        }
    }
    return runs;
}
/** Looks up the class of a single address in a census, or `null` when the
 * address lies outside the censused range. Linear over runs, which is what
 * keeps the census JSON-safe -- see `ClassRun`. */
export function classAt(census, address) {
    for (const run of census.classRuns) {
        if (address >= run.start && address <= run.end)
            return run.class;
    }
    return null;
}
/**
 * Does `decoded` exist, and is it an instruction a program could actually
 * EXECUTE -- one the decoder did not flag illegal and did not have to
 * truncate?
 *
 * THE ONE DECODABILITY PREDICATE IN THIS MODULE, and the reason it exists is
 * an incident rather than tidiness. Three places here answer "is this byte an
 * instruction": the linear sweep, the entry-point gate inside
 * `scanIndirectDispatch()`, and the recursive descent that produces the
 * HEADLINE number. The first two tested the decoder's illegal flag. The third
 * never asked. It walked straight THROUGH an illegal opcode, claimed its bytes
 * as reached code, and carried on into whatever followed.
 *
 * Measured on a 64-byte image at $0810 holding `lda #$01` / `ldx #$00` and then
 * sixty `$02` bytes: `reachedAsInstruction=64`, `unreached=0`,
 * `linearSweepDecodable=4`. One hundred per cent structural completeness on a
 * ninety-four-per-cent-garbage image, with the sibling figure on the SAME
 * report disagreeing sixteen-fold. Two figures describing two different byte
 * sets is not a rounding difference; it is a report contradicting itself.
 *
 * The predicate exists so those two figures cannot describe different byte sets
 * again. It is the same extraction `isPlausibleEntryPoint()` itself received
 * when the two halves of `provenDispatchTargets()` were found held to different
 * standards -- one definition, every reader on it.
 *
 * It reads the decoder's OWN boolean flag and its own `truncated` note. Never a
 * mnemonic string comparison and never an opcode-byte range: which opcodes are
 * illegal is the opcode table's fact to state, not this module's to restate.
 */
function isDecodableAsInstruction(decoded) {
    return !!decoded && !decoded.illegal && !decoded.notes.includes("truncated");
}
/**
 * Classifies every byte in `[origin, origin + size)` by recursive descent
 * from `seeds`.
 *
 * Bounded by construction: an explicit worklist and a visited set, NO
 * recursion (mirroring `decode()`'s own discipline, which this walker sits on
 * top of), and an explicit `MAX_WALK_STEPS` cap that sets `truncated` rather
 * than looping. Never throws: a non-`Uint8Array` payload, a nonsense origin
 * or an empty seed set all produce a well-formed census.
 *
 * An EMPTY or SEEDLESS input reports `reachedAsInstruction: 0` and
 * `unreached: rangeBytes` -- a real, readable zero, never an error and never
 * an omitted measure.
 */
export function computeStructuralCensus(bytes, origin, seeds = [], opts = {}) {
    const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
    const safeOrigin = Number.isSafeInteger(origin) && origin >= 0 && origin <= 0xffff ? origin : 0;
    const size = safeBytes.length;
    const maxSteps = Number.isSafeInteger(opts.maxSteps) && opts.maxSteps > 0 ? opts.maxSteps : MAX_WALK_STEPS;
    // The censused range is bounded at the 16-bit address space, not at
    // `origin + size`. A payload whose origin plus length runs past $FFFF is
    // MALFORMED INPUT -- a `.regen2000proj` file the operator did not author
    // can claim any origin and carry any length -- and this module's contract
    // on malformed input is to produce a well-formed census, never to wrap and
    // never to classify an address the machine cannot address. Bytes at or
    // beyond $10000 are not classified, not counted, and not swept.
    const effectiveEnd = Math.min(safeOrigin + size, 0x10000);
    const rangeSize = Math.max(0, effectiveEnd - safeOrigin);
    // Class codes are indices into CLASS_ORDER. A zero-initialised array would
    // mean "reached-as-instruction", which is exactly the wrong default for an
    // instrument whose entire point is that reachability must be PROVEN, so
    // fill with 3 ("unreached") explicitly.
    const classes = new Uint8Array(rangeSize);
    classes.fill(3);
    const inRange = (addr) => addr >= safeOrigin && addr < effectiveEnd;
    const mark = (addr, klass) => {
        if (!inRange(addr))
            return;
        const idx = addr - safeOrigin;
        // Lower index wins: reached-as-instruction beats table-entry beats
        // referenced-as-data beats unreached. Disjointness by construction.
        if (klass < classes[idx])
            classes[idx] = klass;
    };
    const seedList = sortedUniqueNumbers([...seeds, ...(opts.extraSeeds ?? [])].filter((a) => Number.isSafeInteger(a)));
    const worklist = seedList.filter(inRange);
    const visited = new Set(worklist);
    let steps = 0;
    let truncated = false;
    while (worklist.length > 0) {
        if (steps >= maxSteps) {
            truncated = true;
            break;
        }
        steps++;
        let pc = worklist.pop();
        // Walk this trace linearly until it terminates, leaves the range, or
        // revisits a byte already walked as an instruction.
        while (inRange(pc)) {
            if (steps >= maxSteps) {
                truncated = true;
                break;
            }
            steps++;
            const offset = pc - safeOrigin;
            const decoded = decode(safeBytes.subarray(offset), pc, { count: 1 })[0];
            // THE PREDICATE IS CONSULTED HERE, BEFORE THE MARKING LOOP BELOW, and
            // that order is deliberate -- not an accident of how the
            // statements happened to be written.
            //
            // Consulted before: the illegal byte is never marked, so it stays
            // `unreached` and the four class counts still sum to `rangeBytes`.
            // Consulted after: the byte would be claimed as reached code and only
            // then abandoned, which is precisely the behaviour that reported
            // sixty-four of sixty-four bytes as executed code on a four-byte program.
            //
            // A later reader who keeps the predicate but moves this test below the
            // marking loop reintroduces the defect while leaving every mention of the
            // predicate in place. Do not reorder these two statements.
            if (!isDecodableAsInstruction(decoded))
                break;
            for (let i = 0; i < decoded.bytes.length; i++)
                mark(pc + i, 0);
            // Data references: exactly one byte, the named base. Never a guessed
            // extent -- see DATA_REF_MNEMONICS.
            const operand = decoded.operand;
            if (operand &&
                (operand.role === "absolute" || operand.role === "zeropage") &&
                DATA_REF_MNEMONICS.has(decoded.mnemonic)) {
                mark(operand.value, 2);
            }
            // Control flow: a branch or a jsr forks; an unconditional terminator
            // ends the trace.
            const target = decoded.resolvedTarget;
            if (target !== undefined && inRange(target) && !visited.has(target)) {
                visited.add(target);
                worklist.push(target);
            }
            if (TERMINATORS.has(decoded.opcode))
                break;
            pc += decoded.bytes.length;
        }
    }
    for (const addr of opts.tableEntryAddresses ?? [])
        mark(addr, 1);
    // Linear-sweep decodability -- reported, never summed. See trap 2. Swept
    // over the SAME bounded range as the census, so the two figures describe
    // the same bytes.
    // The skip is expressed through the SAME predicate the descent above reads,
    // so the two figures are comparable by construction rather than by
    // coincidence. This figure's MEANING is untouched: it still counts bytes that
    // decode as legal, non-truncated instructions, exactly as it always did. The
    // descent was brought to this standard; this standard was never loosened to
    // the descent's, because `linearSweepDecodable` is a published field of a
    // report other phases consume and redefining it would be a schema question.
    let linearSweepDecodable = 0;
    for (const insn of decode(safeBytes.subarray(0, rangeSize), safeOrigin)) {
        if (!isDecodableAsInstruction(insn))
            continue;
        linearSweepDecodable += insn.bytes.length;
    }
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < rangeSize; i++) {
        const code = classes[i];
        counts[code] = counts[code] + 1;
    }
    return {
        origin: safeOrigin,
        // `size` is the payload's own length; `rangeBytes` is how much of it lies
        // inside the 16-bit address space and was therefore censused. The two
        // differ only for a malformed origin/length pair.
        size,
        rangeBytes: rangeSize,
        seeds: seedList,
        reachedAsInstruction: counts[0],
        tableEntry: counts[1],
        referencedAsData: counts[2],
        unreached: counts[3],
        linearSweepDecodable,
        truncated,
        steps,
        classRuns: toRuns(classes, safeOrigin),
    };
}
const INDEXED_LOAD_MODES = new Set(["absolute_x", "absolute_y", "zeropage_x"]);
/** The index register an indexed addressing mode reads, or `null` for a mode
 * that indexes through neither. Compared instead of mere membership in
 * `INDEXED_LOAD_MODES`, so an `absolute_x` load paired with an `absolute_y`
 * load is not mistaken for a lo/hi pair: two tables walked by two different
 * registers are two tables, not one split one. */
function indexRegisterOf(insn) {
    if (insn.mode === "absolute_x" || insn.mode === "zeropage_x")
        return "x";
    if (insn.mode === "absolute_y" || insn.mode === "zeropage_y")
        return "y";
    return null;
}
/** True iff both instructions index through the SAME register. */
function sameIndexRegister(a, b) {
    const ra = indexRegisterOf(a);
    return ra !== null && ra === indexRegisterOf(b);
}
const STORE_MNEMONICS = new Set(["sta", "stx", "sty"]);
/** True iff `insn` stores into a zero-page location. */
function zeroPageStoreTarget(insn) {
    if (!insn.operand)
        return null;
    if (!STORE_MNEMONICS.has(insn.mnemonic))
        return null;
    if (insn.operand.role !== "zeropage")
        return null;
    return insn.operand.value;
}
/**
 * The COMPLETE, frozen list of shapes `hasDispatchContext()` accepts as proof
 * that something dispatches through a reconstructed pair of tables. One stable
 * string id per sufficient shape, in the order the predicate tests them.
 *
 * A SHAPE LISTED HERE IS THE DECISION TO TREAT THAT SHAPE AS PROOF OF CODE --
 * the same decision `provenDispatchTargets()`'s doc comment describes, made one
 * level down. The class-3 gate reads this predicate, and `splitTables` is one
 * of the four sources that seam publishes, so a shape admitted here becomes a
 * recursive-descent seed and turns whatever it points at into headline
 * `reachedAsInstruction`.
 *
 * ADDING A SHAPE HERE WITHOUT A NEGATIVE CONTROL THAT REACHES ITS INTERIOR
 * FAILS THE TEST SUITE BY NAME. `anno-coverage.test.ts`'s
 * `GATE_INTERIOR_DECLARATIONS` must claim every id in this array, and a
 * declaration is checked mechanically by a witness that decodes the payload --
 * not accepted as a claim. That mechanism exists because this was once a real
 * false-positive route that a 2517-passing suite concealed: every negative
 * control the gate had bracketed it from the OUTSIDE, and a negative control
 * built from the outside of the predicate it constrains is not a control.
 *
 * The count is also tied to the predicate mechanically: a test reads
 * `hasDispatchContext()`'s body from this module's source text and asserts that
 * the number of true-returning sites in it equals this array's length, so a
 * fourth branch added without a matching id reds the suite rather than sliding
 * through a hand-maintained mirror.
 */
export const DISPATCH_CONTEXT_SHAPES = Object.freeze([
    "stack-return-push-idiom",
    "zeropage-vector-jumped-through",
]);
/**
 * The COMPLETE, frozen list of ROUTES by which a shape above can become a
 * proven dispatch finding. One record per gate.
 *
 * A ROUTE IS THE SECOND HALF OF A CONTROL TARGET'S IDENTITY, and this array
 * exists because keying control targets on shape ALONE shipped a hole big
 * enough to drive the defect it was built to catch straight through. One of
 * the two shapes above is ruled on by TWO gates, not one -- the class-3 pass,
 * which consults `hasDispatchContext()`, and the class-4 pass, whose own
 * five-instruction window is its gate. The test suite's interior witness used
 * to define that shape's interior as a DISJUNCTION of the two routes, so every
 * control declared against the shape satisfied the class-4 half and the
 * class-3 route into it had no control at all. The knowledge was already
 * written down one comment away; nothing forced a control for it.
 *
 * `publishesInto` is what makes a route's DECLINE measurable. A negative
 * control on the class-3 route is proved to decline through `splitTables` --
 * the collection that route publishes into -- and never through the aggregate
 * `provenDispatchTargets()` seam, because the stack-return payload is
 * simultaneously a class-3 decline and a class-4 acceptance: measured through
 * the seam it looks accepted, and its class-3 decline becomes inexpressible.
 *
 * ADDING A THIRD GATE HERE WITHOUT A CONTROL FOR IT FAILS THE TEST SUITE BY
 * NAME, and so does adding one to `scanIndirectDispatch()` without recording
 * it here. Four assertions in `anno-coverage.test.ts` hold this array down
 * against the module's own text rather than against a hand-maintained mirror:
 * the number of `hasDispatchContext(` call sites equals the number of records
 * whose `consultsSharedGate` is true; each record's `publishesInto` occurs
 * exactly once as a publication site inside `scanIndirectDispatch()`, and the
 * total equals this array's length; every `publishesInto` is a member of
 * `PROVEN_TARGET_SOURCES`; and the class-4 publication site precedes the
 * shared gate's only call site, with no call to the gate before it -- which is
 * what makes "the class-4 pass is a route, not a caller of the shared gate" a
 * source-level fact instead of a claim in a table.
 */
export const DISPATCH_GATE_ROUTES = Object.freeze([
    Object.freeze({ id: "class-3-pass", consultsSharedGate: true, publishesInto: "splitTables" }),
    Object.freeze({ id: "class-4-pass", consultsSharedGate: false, publishesInto: "stackReturnDispatch" }),
]);
/**
 * Does the instruction window starting at `start` carry evidence that
 * something DISPATCHES through a reconstructed pair of tables?
 *
 * Accepts either ONE of the two shapes named in `DISPATCH_CONTEXT_SHAPES`:
 *
 *   - `stack-return-push-idiom` -- the RTS trick, matched as a DATA FLOW from
 *     the pairing under test: the instruction immediately after EACH of the
 *     two paired loads is a `pha`, and an `rts` follows both of those pushes
 *     inside the window. Each load must push the byte it just read, because
 *     that is the whole mechanism -- `rts` jumps to the address assembled from
 *     the two pushed bytes, so a pairing whose bytes were never pushed is not
 *     the thing that address came from.
 *
 *     WHY THE PRESENCE OF A PUSH IDIOM IS NOT EVIDENCE ABOUT THIS PAIRING.
 *     This branch previously accepted any two `pha` bytes and any `rts` seen
 *     anywhere in the window, on the stated rationale that the Class-4 pass
 *     runs first and claims its windows, so a pairing inside one is never
 *     promoted here. That rationale is FALSE and has been removed rather than
 *     kept: Class 4 claims only its exact five-instruction shape
 *     (`indexed load : pha : indexed load : pha : rts`), and every time it
 *     DECLINES -- mixed index registers, an implausible reconstructed entry
 *     point, or any instruction sitting between a load and its push -- the
 *     window is left unclaimed and this pass rules on the pairing itself.
 *     `lda lo,x : sta $fb : lda hi,x : sta $fc : pha : txa : pha : tya : rts`
 *     is the concrete case: the two pushes carry the accumulator's leftover
 *     value and the X register, neither load's byte reaches the stack, and
 *     the payload was still promoted -- manufacturing eight "proven" entry
 *     points and 47 of 64 bytes of code-or-table out of a 15-byte program.
 *     A `pha`/`pha`/`rts` in the same neighbourhood as two indexed loads is
 *     an extremely ordinary coincidence; the LINK is the evidence, not the
 *     shape.
 *   - `zeropage-vector-jumped-through` -- the pairing's OWN two loads are
 *     consumed by two CONSECUTIVE zero-page stores (which is what resolves the
 *     orientation), AND an indirect jump within reach names the LOWER of those
 *     two addresses. That is the classic "build a vector in zero page, then
 *     `jmp (vector)`" idiom, matched END TO END and matched against the pairing
 *     under test.
 *
 * WHY THE CONSTRUCTION ALONE IS NOT EVIDENCE. Two stores into
 * consecutive zero-page addresses is how EVERY 16-bit pointer on a 6502 is
 * built, and `lda ($fb),y` -- indirect-indexed DATA access, far more common in
 * real code than indirect jump -- needs exactly the identical construction.
 * A predicate that never looks at what CONSUMES the vector it saw being built
 * cannot tell a jump table from a screen pointer, and every ordinary pointer
 * setup then promotes its data to `reachedAsInstruction`. So a bare
 * indirect-jump opcode "within reach" is not accepted either: an indirect jump
 * through some OTHER vector near two indexed loads is not evidence that those
 * loads feed it. The operand value must equal the vector that was built.
 *
 * WHY A CONSUMER OF SOME OTHER VECTOR IS NOT EVIDENCE ABOUT THIS PAIRING. The
 * sentence above is only half the rule, and this branch previously held only
 * that half: it demanded a consumer, then went looking for one by scanning the
 * WHOLE window for any two zero-page store targets differing by exactly one
 * with a jump naming the lower. A second, unrelated consecutive zero-page pair
 * inside the same window defeats that outright --
 * `lda lo,x : sta $fb : lda hi,x : sta $fc : sta $fd : sta $fe : jmp ($00fd)`
 * builds the pairing's vector at `$fb`/`$fc`, builds a foreign one at
 * `$fd`/`$fe`, jumps through the FOREIGN one, and was promoted on the strength
 * of a link that has nothing to do with the tables being reconstructed. Two
 * consecutive zero-page pairs in one window is not an exotic shape; a routine
 * that sets up a source pointer and a destination pointer has two. So the
 * address compared here is `vectorLow` -- the one the pairing's own two
 * consumer stores built -- and no other.
 */
function hasDispatchContext(insns, start, reach, pairing) {
    const end = Math.min(insns.length, start + reach + 1);
    // `stack-return-push-idiom`, decided against the PAIRING rather than against
    // the window's contents: the two paired loads must each be immediately
    // followed by the `pha` that carries the byte they just read, and the `rts`
    // that consumes the assembled address must follow both of those pushes.
    // Read at the two loads' own successors, so no `pha` anywhere else in the
    // window can stand in for either of them.
    if (insns[pairing.firstIndex + 1]?.opcode === 0x48 && insns[pairing.secondIndex + 1]?.opcode === 0x48) {
        for (let k = pairing.secondIndex + 2; k < end; k++) {
            if (insns[k].opcode === 0x60)
                return true;
        }
    }
    /** The pointer each indirect jump in the window dispatches THROUGH, collected
     * rather than treated as sufficient on sight -- see the doc comment. */
    const indirectJumpPointers = [];
    for (let k = start; k < end; k++) {
        const insn = insns[k];
        if (insn.opcode === 0x6c && insn.operand)
            indirectJumpPointers.push(insn.operand.value);
    }
    // `zeropage-vector-jumped-through`, decided against the PAIRING rather than
    // against the window's contents: the vector compared is the one the pairing's
    // OWN two consumer stores built, carried on the orientation as `vectorLow`.
    // An exact numeric equality on the zero-page address -- `jmp ($00fb)` decodes
    // to operand.value 0xfb and `sta $fb` to operand.value 0xfb -- never a string
    // or hex-text comparison.
    if (indirectJumpPointers.includes(pairing.oriented.vectorLow))
        return true;
    return false;
}
/**
 * Which of two indexed loads feeds the LOW byte, decided by the pairing's own
 * store construction rather than by address order.
 *
 * For each load, the nearest FOLLOWING zero-page store within reach is the
 * store that consumes it. When the two loads are consumed by two DIFFERENT,
 * CONSECUTIVE zero-page addresses, the one reaching the lower address holds
 * the low byte -- a 6502 vector is little-endian, so that is a fact about the
 * construction, not a convention. Any other shape returns `null`, and a
 * `null` orientation makes the pairing ADVISORY however good its other
 * evidence is: an unresolved orientation would otherwise be resolved by
 * `Math.min`, which is the exact defect this replaces.
 */
function resolveSplitOrientation(insns, firstIndex, secondIndex, reach) {
    const consumerOf = (from) => {
        const end = Math.min(insns.length, from + reach + 1);
        for (let k = from + 1; k < end; k++) {
            const zp = zeroPageStoreTarget(insns[k]);
            if (zp !== null)
                return zp;
        }
        return null;
    };
    const firstZp = consumerOf(firstIndex);
    const secondZp = consumerOf(secondIndex);
    if (firstZp === null || secondZp === null)
        return null;
    if (Math.abs(firstZp - secondZp) !== 1)
        return null;
    const firstBase = insns[firstIndex].operand.value;
    const secondBase = insns[secondIndex].operand.value;
    const vectorLow = Math.min(firstZp, secondZp);
    return firstZp < secondZp
        ? { loBase: firstBase, hiBase: secondBase, vectorLow }
        : { loBase: secondBase, hiBase: firstBase, vectorLow };
}
/**
 * Reaches the four classes upstream's `follow_indirect_jumps()` does not.
 *
 * Every table walk is bounded by `MAX_TABLE_ENTRIES` and reports its own
 * `truncated` flag -- never "walk while plausible". Never throws.
 */
export function scanIndirectDispatch(instructions, bytes, origin) {
    const safeBytes = bytes instanceof Uint8Array ? bytes : new Uint8Array(0);
    const safeOrigin = Number.isSafeInteger(origin) && origin >= 0 && origin <= 0xffff ? origin : 0;
    const insns = Array.isArray(instructions) ? instructions : [];
    const size = safeBytes.length;
    // THE ONE BOUND THIS SCAN DESCRIBES, stated once and read everywhere
    // below. `computeStructuralCensus()` clamps its range at the 16-bit address
    // space for the same reason as here -- a `.regen2000proj` the operator did
    // not author can claim any origin and carry any length -- and this scan, whose output is
    // that report's own dispatch sub-report, was left unbounded. Values at or
    // above $10000 caused no crash (the census's `mark()` filters them) but they
    // were written into the JSON that the decomposition and reassembly work
    // consumes, and
    // `anno-cli.ts`'s `hexAddr()` renders them as five hex digits: a report
    // whose two halves describe two different address spaces is misleading even
    // when nothing throws. Computed the SAME way as the census's clamp so the two
    // are one quantity, not two that happen to agree.
    const effectiveEnd = Math.min(safeOrigin + size, 0x10000);
    const inImage = (addr) => addr >= safeOrigin && addr + 1 < effectiveEnd;
    const wordAt = (addr) => {
        if (!inImage(addr))
            return null;
        const idx = addr - safeOrigin;
        return safeBytes[idx] | (safeBytes[idx + 1] << 8);
    };
    /**
     * Is `value` an address a program could actually be ENTERED at -- strictly
     * inside the image, and on a byte that decodes as a legal, non-truncated
     * instruction?
     *
     * The ONE predicate both gated reconstructions read: class 3's condition (e)
     * and the class-4 walk's condition (d). Extracted rather than written twice,
     * because the two halves of `provenDispatchTargets()` were held to
     * DIFFERENT standards for exactly as long as this test existed in only one
     * of them. A value pointing at a byte that does not decode is not an entry
     * point, and a mid-instruction address is not evidence of code however
     * confidently it is printed.
     *
     * This gate COMPOSES the module's decodability predicate with its own
     * in-image bound rather than restating the decodability test. Its behaviour
     * is unchanged by that composition -- the two conditions it applied were
     * already the predicate's two conditions.
     */
    const isPlausibleEntryPoint = (value) => {
        if (!(value >= safeOrigin && value < effectiveEnd))
            return false;
        return isDecodableAsInstruction(decode(safeBytes.subarray(value - safeOrigin), value, { count: 1 })[0]);
    };
    const indirectJumps = [];
    const multiEntryTables = [];
    const splitTables = [];
    const splitTableCandidates = [];
    const stackReturnDispatch = [];
    const tableEntryAddresses = new Set();
    const discovered = new Set();
    let truncated = false;
    // --- Class 1 + 2: indirect jumps (pointer ANYWHERE, including zero page)
    // and the multi-entry tables they name.
    for (const insn of insns) {
        if (insn.opcode !== 0x6c || !insn.operand)
            continue;
        const pointer = insn.operand.value;
        const target = wordAt(pointer);
        indirectJumps.push({
            at: insn.address,
            pointer,
            target,
            pointerInImage: inImage(pointer),
            pointerInZeroPage: pointer < 0x100,
        });
        if (target !== null)
            discovered.add(target);
        if (!inImage(pointer))
            continue;
        // Upstream reads EXACTLY ONE entry here. Read successive little-endian
        // 16-bit entries while each resolves inside the image, bounded.
        const targets = [];
        let cursor = pointer;
        let tableTruncated = false;
        while (true) {
            if (targets.length >= MAX_TABLE_ENTRIES) {
                tableTruncated = true;
                truncated = true;
                break;
            }
            const entry = wordAt(cursor);
            if (entry === null)
                break;
            if (!(entry >= safeOrigin && entry < effectiveEnd))
                break;
            targets.push(entry);
            tableEntryAddresses.add(cursor);
            tableEntryAddresses.add(cursor + 1);
            discovered.add(entry);
            cursor += 2;
        }
        if (targets.length > 0) {
            multiEntryTables.push({ at: insn.address, base: pointer, entries: targets.length, targets, truncated: tableTruncated });
        }
    }
    // --- Class 4: the stack-return dispatch idiom. `lda hi,X : pha : lda lo,X
    // : pha : rts` contains NO indirect-jump opcode, so an opcode-keyed walk
    // cannot see it at all. Sliding window over the decoded stream.
    //
    // THIS PASS RUNS BEFORE CLASS 3, DELIBERATELY. The idiom's hi/lo
    // assignment is JUSTIFIED -- the 6502 pushes the high byte first, so the
    // first load reads the hi table -- whereas the Class-3 pass has no such
    // evidence. Where both would match the same five instructions, the
    // justified one must win and the other must not be reported at all;
    // otherwise the same two instructions appear twice with contradictory
    // roles, and the byte-swapped twin ($09c0 for $c009) is emitted as if it
    // were an address. Every instruction of a matched window is recorded here
    // and the Class-3 pass declines any pairing whose leading load sits in one.
    //
    // GATED TO THE SAME STANDARD AS CLASS 3. This pass feeds the same
    // `provenDispatchTargets()` seam class 3 feeds, and gating one half of a
    // seam while the other half is ungated is not a gate. A window is PROVEN
    // only when ALL of:
    //   (a) the five instructions match the shape: indexed load, `pha`, indexed
    //       load, `pha`, `rts`;
    //   (b) both loads index through the SAME register -- two tables walked by
    //       two different registers are two tables, not one split one, which is
    //       the sentence class 3's own comment already makes. Pre-gate,
    //       `lda $c010,x : pha : lda $c013,y : pha : rts` yielded a proven
    //       target;
    //   (c) the lo/hi orientation is justified rather than assumed. This is the
    //       ONE condition the idiom supplies for free -- the 6502 pushes the
    //       high byte first, so the first load reads the hi table -- and it is
    //       why this pass runs before class 3 rather than after it;
    //   (d) EVERY published entry point is a plausible one
    //       (`isPlausibleEntryPoint`): strictly inside the image, and on a byte
    //       that decodes as a legal, non-truncated instruction. The entry count
    //       is derived from the DISTANCE between the two bases and is therefore
    //       a guess, so the walk is bounded by evidence rather than by that
    //       arithmetic: it stops at the first implausible value, marks the
    //       finding truncated and raises the scan-level `truncated` flag, so a
    //       walk cut short is REPORTED rather than shown as a clean empty list.
    // Nothing is published until (d) has been applied to it: `discovered` and
    // `tableEntryAddresses` are written only from the surviving prefix, exactly
    // the way class 3 reconstructs before its gate.
    const classFourWindow = new Set();
    for (let i = 0; i + 4 < insns.length; i++) {
        const [a, b, c, d, e] = [insns[i], insns[i + 1], insns[i + 2], insns[i + 3], insns[i + 4]];
        const isIndexedLoad = (x) => !!x.operand && INDEXED_LOAD_MODES.has(x.mode) && x.mnemonic.startsWith("ld");
        if (!isIndexedLoad(a))
            continue;
        if (b.opcode !== 0x48)
            continue; // pha
        if (!isIndexedLoad(c))
            continue;
        if (d.opcode !== 0x48)
            continue; // pha
        if (e.opcode !== 0x60)
            continue; // rts
        // (b). Checked BEFORE the window is claimed: a mismatched-register window
        // is not class 4's, so class 3 must still be free to report the pairing
        // (which it will decline on its own condition (b), as an advisory
        // candidate rather than silence).
        if (!sameIndexRegister(a, c))
            continue;
        for (const claimed of [a, b, c, d, e])
            classFourWindow.add(claimed.address);
        // The HIGH byte is pushed first, so `a` reads the hi table and `c` the lo.
        const hiBase = a.operand.value;
        const loBase = c.operand.value;
        const span = Math.abs(hiBase - loBase);
        let entries = span > 0 ? span : 1;
        let tableTruncated = false;
        if (entries > MAX_TABLE_ENTRIES) {
            entries = MAX_TABLE_ENTRIES;
            tableTruncated = true;
            truncated = true;
        }
        // Reconstruct WITHOUT publishing anything yet: nothing below touches
        // `discovered` or `tableEntryAddresses` until (d) has passed on it.
        const targets = [];
        const entryAddresses = [];
        for (let k = 0; k < entries; k++) {
            const loIdx = loBase + k - safeOrigin;
            const hiIdx = hiBase + k - safeOrigin;
            // The upper bound is the scan's ONE `effectiveEnd`, expressed on
            // the addresses rather than on the indices, so this walk stops where the
            // census stops instead of at the payload's declared length. Both halves
            // of the pair must be inside it: publishing `loBase + k` as a table entry
            // address while `hiBase + k` lies outside the machine's address space
            // would put a value in the report the measured machine cannot address.
            if (loIdx < 0 || hiIdx < 0 || loBase + k >= effectiveEnd || hiBase + k >= effectiveEnd)
                break;
            // The idiom pushes `target - 1`, because `rts` increments before
            // jumping. Reconstruct the real entry point.
            const pushed = safeBytes[loIdx] | (safeBytes[hiIdx] << 8);
            const value = (pushed + 1) & 0xffff;
            // (d). The entry count is a guess, so the walk stops here rather than
            // publishing an address a program cannot be entered at -- and says it
            // stopped.
            if (!isPlausibleEntryPoint(value)) {
                tableTruncated = true;
                truncated = true;
                break;
            }
            targets.push(value);
            entryAddresses.push(loBase + k, hiBase + k);
        }
        if (targets.length === 0)
            continue;
        for (const value of targets)
            discovered.add(value);
        for (const addr of entryAddresses)
            tableEntryAddresses.add(addr);
        stackReturnDispatch.push({ at: a.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated, orientationResolved: true });
    }
    // --- Class 3: split lo/hi tables. Paired indexed loads whose two bases are
    // a fixed distance N apart; reconstruct N targets.
    //
    // GATED (header trap 8). Two indexed loads within eight instructions of
    // each other is the most ordinary shape in C64 code, so the pairing alone
    // is not evidence of anything. A pairing is PROVEN only when ALL of:
    //   (a) it is not inside a window Class 4 already claimed;
    //   (b) both loads index through the SAME register;
    //   (c) something in reach CONSUMES the pair as a dispatch
    //       (`hasDispatchContext`) -- either the stack-return push idiom, or a
    //       zero-page vector that an indirect jump in reach actually jumps
    //       THROUGH. The mere construction of a zero-page vector is not enough:
    //       an indirect-indexed data read builds the identical pointer;
    //   (d) its lo/hi orientation is decided by the pairing's own store
    //       construction rather than by address order (`resolveSplitOrientation`);
    //   (e) EVERY reconstructed target lands strictly inside the image AND on a
    //       byte that decodes as a legal, non-truncated instruction. A value
    //       pointing at a byte that does not decode is not an entry point.
    // Anything else is ADVISORY: recorded in `splitTableCandidates` with no
    // orientation claim and no targets, contributing to neither `discovered`
    // nor `tableEntryAddresses`.
    //
    // AN ADVISORY RECORDING DOES NOT CONSUME THE LEADING LOAD. Only a
    // PROVEN pairing does. Otherwise one unrelated indexed load between the two
    // halves of a real split table erases it: the advisory pairing takes the
    // leading load, the genuine pairing behind it is never examined, and the
    // report shows a clean-looking empty `splitTables`. The direction of that
    // error is safe -- an under-report, never an over-report -- but it is
    // silent, which is the one thing a coverage instrument may not be.
    for (let i = 0; i < insns.length; i++) {
        const first = insns[i];
        if (!first.operand || !INDEXED_LOAD_MODES.has(first.mode))
            continue;
        if (!first.mnemonic.startsWith("ld"))
            continue;
        if (classFourWindow.has(first.address))
            continue; // (a)
        // ONLY A PROVEN PAIRING CONSUMES ITS LEADING LOAD. An ADVISORY
        // recording does not: the first advisory pairing seen for this leading
        // load is remembered here and emitted only if the window closes with no
        // proven pairing found. Until 19-11 the inner loop broke on BOTH
        // branches, so one unrelated indexed load sitting between the two halves
        // of a real split table consumed the leading load and the genuine pairing
        // behind it was never examined -- a dispatch table with a real
        // `jmp ($00fb)` consumer became invisible, and its eight targets vanished
        // from the seed set. The direction of that error is safe (under-report,
        // not over-report) but it is SILENT: the report showed two advisory
        // candidates and a clean-looking empty `splitTables`, with no indication
        // that a proven pairing had been preempted.
        //
        // At most ONE advisory candidate per leading load is still emitted -- the
        // first seen, in encounter order, so the output is deterministic -- and a
        // leading load that produces a proven pairing emits none.
        let pendingAdvisory = null;
        let pendingAdvisoryTruncated = false;
        for (let j = i + 1; j < Math.min(insns.length, i + 1 + SPLIT_TABLE_WINDOW); j++) {
            const second = insns[j];
            if (!second.operand || !INDEXED_LOAD_MODES.has(second.mode))
                continue;
            if (!second.mnemonic.startsWith("ld"))
                continue;
            const a = first.operand.value;
            const b = second.operand.value;
            if (a === b)
                continue;
            if (!inImage(a) || !inImage(b))
                continue;
            // (b) + (d). The orientation is the ONLY thing that may name a base
            // "lo": `Math.min` over two addresses is not evidence.
            const oriented = sameIndexRegister(first, second) ? resolveSplitOrientation(insns, i, j, SPLIT_TABLE_WINDOW) : null;
            // (c). The pairing under test crosses the call boundary: a predicate
            // that re-guesses which loads it is ruling on cannot rule on them.
            const gatedSoFar = oriented !== null && hasDispatchContext(insns, i, SPLIT_TABLE_WINDOW, { firstIndex: i, secondIndex: j, oriented });
            // Encounter order for the advisory case; the resolved roles otherwise.
            const loBase = oriented ? oriented.loBase : a;
            const hiBase = oriented ? oriented.hiBase : b;
            const span = Math.abs(hiBase - loBase);
            if (span <= 0)
                continue;
            let entries = span;
            let tableTruncated = false;
            if (entries > MAX_TABLE_ENTRIES) {
                entries = MAX_TABLE_ENTRIES;
                tableTruncated = true;
            }
            // Reconstruct WITHOUT publishing anything yet: nothing below touches
            // `discovered` or `tableEntryAddresses` until the gate has passed.
            const targets = [];
            const entryAddresses = [];
            for (let k = 0; k < entries; k++) {
                const loIdx = loBase + k - safeOrigin;
                const hiIdx = hiBase + k - safeOrigin;
                // As in the class-4 walk above: the scan's ONE `effectiveEnd`,
                // never the payload's declared length.
                if (loIdx < 0 || hiIdx < 0 || loBase + k >= effectiveEnd || hiBase + k >= effectiveEnd)
                    break;
                targets.push(safeBytes[loIdx] | (safeBytes[hiIdx] << 8));
                entryAddresses.push(loBase + k, hiBase + k);
            }
            if (targets.length === 0)
                continue;
            // (e) every target in-image and decodable as a legal instruction. The
            // predicate is shared with the class-4 walk's condition (d) -- one
            // definition, read by both gated reconstructions.
            const everyTargetIsAPlausibleEntryPoint = targets.every(isPlausibleEntryPoint);
            if (gatedSoFar && everyTargetIsAPlausibleEntryPoint) {
                for (const value of targets)
                    discovered.add(value);
                for (const addr of entryAddresses)
                    tableEntryAddresses.add(addr);
                splitTables.push({ at: first.address, loBase, hiBase, entries: targets.length, targets, truncated: tableTruncated, orientationResolved: true });
                if (tableTruncated)
                    truncated = true;
                pendingAdvisory = null; // a proven pairing emits no advisory candidate
                break; // a PROVEN pairing consumes its leading load -- and only that
            }
            // Advisory: remember the FIRST one and keep scanning the window.
            if (pendingAdvisory === null) {
                pendingAdvisory = {
                    at: first.address,
                    // ENCOUNTER order, not lo/hi roles -- see `orientationResolved`.
                    loBase: a,
                    hiBase: b,
                    entries: targets.length,
                    targets: [],
                    truncated: tableTruncated,
                    orientationResolved: false,
                };
                pendingAdvisoryTruncated = tableTruncated;
            }
        }
        if (pendingAdvisory !== null) {
            splitTableCandidates.push(pendingAdvisory);
            if (pendingAdvisoryTruncated)
                truncated = true;
        }
    }
    return {
        indirectJumps,
        multiEntryTables,
        splitTables,
        splitTableCandidates,
        stackReturnDispatch,
        discoveredTargets: sortedUniqueNumbers(discovered),
        tableEntryAddresses: sortedUniqueNumbers(tableEntryAddresses),
        truncated,
    };
}
/**
 * The COMPLETE, frozen set of scan collections `provenDispatchTargets()` reads
 * -- the class-1 indirect jumps, the class-2 multi-entry tables, the class-4
 * stack-return findings and the class-3 split tables, named as the
 * `IndirectDispatchScan` fields they are.
 *
 * ADDING A SOURCE HERE IS THE DECISION TO TREAT THAT SOURCE AS PROOF OF CODE,
 * which is the same decision the function's own doc comment below describes,
 * stated as data so a test can read it. `splitTableCandidates` is deliberately
 * NOT a member: an advisory pairing that became a seam source would seed a
 * recursive descent from evidence the gate explicitly declined, and that is
 * the whole point of it being advisory.
 *
 * This declares what the function already does and changes none of it. A test
 * extracts the function's body from this module's text, collects the `scan.`
 * fields it iterates, and asserts set equality with this array in both
 * directions -- so a fifth source added to the seam reds the suite by name,
 * and so does a route publishing into a collection the seam never reads.
 */
export const PROVEN_TARGET_SOURCES = Object.freeze([
    "indirectJumps",
    "multiEntryTables",
    "stackReturnDispatch",
    "splitTables",
]);
/**
 * The ONE place that decides what may seed a recursive descent.
 *
 * Every `extraSeeds:` assignment in this module reads this function and reads
 * nothing else. Built from real `jmp ($nnnn)` targets, the multi-entry tables
 * those jumps name, the stack-return idiom's push-order-justified
 * reconstruction, and PROVEN split tables -- and from nothing else.
 *
 * ADDING A SOURCE HERE IS THE DECISION TO TREAT THAT SOURCE AS PROOF OF CODE.
 * `reachedAsInstruction` means REACHED BY RECURSIVE DESCENT FROM A SEED
 * (header trap 2); a seed that is not evidence-backed turns ordinary data
 * into headline structural coverage without ever touching the linear-sweep
 * figure trap 2 guards. `splitTableCandidates` is deliberately NOT read here
 * -- that is the whole point of it being advisory.
 */
export function provenDispatchTargets(scan) {
    const proven = new Set();
    for (const jump of scan.indirectJumps) {
        if (jump.target !== null)
            proven.add(jump.target);
    }
    for (const table of scan.multiEntryTables) {
        for (const target of table.targets)
            proven.add(target);
    }
    for (const idiom of scan.stackReturnDispatch) {
        for (const target of idiom.targets)
            proven.add(target);
    }
    for (const split of scan.splitTables) {
        for (const target of split.targets)
            proven.add(target);
    }
    return sortedUniqueNumbers(proven);
}
// ---------------------------------------------------------------------------
// (c) The two label figures
// ---------------------------------------------------------------------------
/**
 * The auto-name prefixes from upstream's `LabelType::prefix()`.
 *
 * `L_` is DELIBERATELY EXCLUDED. Upstream assigns `L_` to `Predefined`,
 * `UserDefined` AND `LocalUserDefined` alike (`types.rs:394-396`), so it
 * cannot distinguish an auto-generated name from a user-chosen one --
 * including it would count every hand-named local label as auto and report a
 * false positive. Matching is ASCII case-sensitive, exactly as upstream emits
 * the prefixes.
 */
export const AUTO_NAME_PREFIX_RE = /^(zpf_|f_|zpa_|a_|p_|zpp_|e_|j_|s_|b_|r_)/;
export function computeLabelRatio(symbols, opts = {}) {
    const list = Array.isArray(symbols) ? symbols : [];
    const excluded = new Set([...(opts.excludeUserAddresses ?? [])]);
    let user = 0;
    let auto = 0;
    let systemExcluded = 0;
    const autoPrefixNameAddresses = [];
    const reallyExcluded = [];
    for (const sym of list) {
        if (!sym || typeof sym.name !== "string")
            continue;
        const kind = String(sym.kind ?? "");
        if (kind === "System" || kind === "Platform") {
            systemExcluded++;
        }
        else if (kind === "User") {
            if (excluded.has(sym.address)) {
                reallyExcluded.push(sym.address);
            }
            else {
                user++;
            }
        }
        else {
            auto++;
        }
        if (AUTO_NAME_PREFIX_RE.test(sym.name))
            autoPrefixNameAddresses.push(sym.address);
    }
    const denominator = user + auto;
    // The count is a count OF the list printed beside it. Deduped ONCE
    // into a local, then both fields read from that local -- two symbols at one
    // address must not report "2 label name(s) ... at $1000", a sentence that
    // contradicts itself.
    const autoPrefixAddresses = sortedUniqueNumbers(autoPrefixNameAddresses);
    return {
        kindRatio: { user, auto, userFraction: denominator === 0 ? null : user / denominator },
        autoPrefixNamesRemaining: autoPrefixAddresses.length,
        autoPrefixNameAddresses: autoPrefixAddresses,
        systemExcluded,
        excludedByMultiCallerRule: sortedUniqueNumbers(reallyExcluded),
    };
}
// ---------------------------------------------------------------------------
// (d) The comment-vacuity measure
// ---------------------------------------------------------------------------
/**
 * Comments that never count as documentation, stored ALREADY NORMALISED (see
 * `normaliseComment`). A comment equal to one of these after normalisation is
 * vacuous no matter how it was capitalised or emphasised.
 */
export const BANNED_GENERIC_COMMENTS = new Set([
    "handles data",
    "does stuff",
    "routine",
    "subroutine",
    "function",
    "data",
    "code",
    "unknown",
    "todo",
    "fixme",
    "n/a",
]);
/**
 * The EXACT normalisation the schema requires, in order:
 *   1. ASCII lowercase;
 *   2. strip backticks and emphasis markers (`` ` ``, `*`, `_`);
 *   3. collapse whitespace runs to a single space;
 *   4. trim.
 * Two normalised comments are then compared by EXACT STRING EQUALITY -- there
 * is no fuzzy match, no stemming and no similarity threshold anywhere here.
 */
export function normaliseComment(comment) {
    if (typeof comment !== "string")
        return "";
    return comment
        .replace(/[A-Z]/g, (ch) => ch.toLowerCase())
        .replace(/[`*_]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}
const UNKNOWN_GRADE_TOKEN = CONFIDENCE_GRADES.find((g) => g.token === "unknown").token;
function parseLineComments(comments) {
    const list = Array.isArray(comments) ? comments : [];
    const byAddress = new Map();
    for (const entry of list) {
        if (!entry || typeof entry.comment !== "string")
            continue;
        if (String(entry.type ?? "line") !== "line")
            continue;
        let gradeToken = null;
        let malformed = false;
        let rest = entry.comment;
        try {
            const parsed = parseConfidencePrefix(entry.comment);
            gradeToken = parsed.grade ? parsed.grade.token : null;
            rest = parsed.rest;
        }
        catch {
            malformed = true;
        }
        byAddress.set(entry.address, {
            address: entry.address,
            gradeToken,
            malformed,
            normalised: normaliseComment(rest),
        });
    }
    return [...byAddress.values()].sort((a, b) => a.address - b.address);
}
export function computeCommentVacuity(comments) {
    const parsed = parseLineComments(comments);
    const commentedAddresses = parsed.length;
    if (commentedAddresses === 0) {
        return {
            commentedAddresses: 0,
            distinctComments: 0,
            distinctCommentRatio: null,
            gradedFraction: null,
            gradedAddresses: 0,
            unknownGradedAddresses: 0,
            bannedGenericAddresses: [],
            malformedGradeAddresses: [],
            reason: "no line comments were supplied -- the vacuity measure is unavailable, not clean",
        };
    }
    const distinct = new Set();
    const banned = [];
    const malformed = [];
    let graded = 0;
    let unknownGraded = 0;
    for (const entry of parsed) {
        distinct.add(entry.normalised);
        if (BANNED_GENERIC_COMMENTS.has(entry.normalised))
            banned.push(entry.address);
        if (entry.malformed)
            malformed.push(entry.address);
        if (entry.gradeToken !== null) {
            if (entry.gradeToken === UNKNOWN_GRADE_TOKEN)
                unknownGraded++;
            else
                graded++;
        }
    }
    return {
        commentedAddresses,
        distinctComments: distinct.size,
        distinctCommentRatio: distinct.size / commentedAddresses,
        gradedFraction: graded / commentedAddresses,
        gradedAddresses: graded,
        unknownGradedAddresses: unknownGraded,
        bannedGenericAddresses: sortedUniqueNumbers(banned),
        malformedGradeAddresses: sortedUniqueNumbers(malformed),
        reason: null,
    };
}
/** True iff this comment counts as documentation at all: present, and not
 * equal to a banned-generic entry after normalisation. */
function isNonVacuous(entry) {
    if (!entry)
        return false;
    if (entry.malformed)
        return false;
    if (entry.normalised.length === 0)
        return false;
    return !BANNED_GENERIC_COMMENTS.has(entry.normalised);
}
const DEFAULT_SAMPLE_SIZE = 8;
/** `provenTargets` is `provenDispatchTargets(dispatch)`, computed ONCE per
 * report by the caller. A bare membership test against the scan's own
 * `discoveredTargets` used to live here and inherited the ungated-pairing
 * defect straight into the reproducibility comparison (header trap 8); the
 * seam is passed in so there is no second, un-narrowed read of it. */
function classFromBytes(census, provenTargets, address) {
    if (provenTargets.includes(address))
        return "code";
    const klass = classAt(census, address);
    if (klass === "reached-as-instruction")
        return "code";
    if (klass === "table-entry" || klass === "referenced-as-data")
        return "data";
    return "unreached";
}
/** `blockClass` is a NEUTRAL class from `block-class.mts`, never a store
 * vocabulary string. That is what lets a second annotation substrate be
 * substituted without this function changing at all. */
function classFromStore(gradeToken, blockClass) {
    if (gradeToken === "confirmed-code" || gradeToken === "probable-code")
        return "code";
    if (gradeToken === "confirmed-data" || gradeToken === "probable-data")
        return "data";
    // `[unknown]` and ungraded fall through to the store's own block class.
    if (blockClass === "code")
        return "code";
    if (blockClass === null || blockClass === "undefined")
        return "unreached";
    return "data";
}
/** Escapes `value` so it can be interpolated into a `RegExp` as a LITERAL.
 *
 * A label name is store data, not a literal this file controls: it arrives
 * from an annotation store the operator did not necessarily author
 * (a cracked release's annotation store, a shared project). A name carrying
 * regex metacharacters must therefore become text rather than a pattern.
 * Same discipline this repository applies to any externally-sourced string
 * that reaches a regex. */
function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
/**
 * The adjacent signals that turn a caller's label NAME into a caller
 * CITATION -- the marker set the name branch of `namesACaller()` reads.
 *
 * A NAMED CONSTANT rather than literals inlined in the regex, so the decision
 * is inspectable in one place and widening it is a one-line edit somewhere
 * obvious rather than a change buried in a pattern string.
 *
 * Each word is matched on identifier boundaries, and in the pattern built from
 * this list it must sit within three NON-IDENTIFIER characters of the name it
 * introduces: `from init`, `called by init`, `callers: init`. `by` carries
 * `called by` / `invoked by` / `used by` -- a comment saying that some routine
 * uses this one is naming a caller.
 *
 * Spelled at both the lowercase and the sentence-initial-capital form rather
 * than matched case-insensitively, because the NAME half of the same regex is
 * case-SENSITIVE (a label's name is its name, and `Init` is a different symbol
 * from `init`) and one regex carries both halves.
 */
const CALLER_CITATION_WORDS = Object.freeze([
    "from",
    "by",
    "call",
    "called",
    "caller",
    "callers",
    "calls",
]);
/** `CALLER_CITATION_WORDS` as a regex alternation, each word at its lowercase
 * and its sentence-initial-capital spelling. */
const CALLER_CITATION_ALTERNATION = CALLER_CITATION_WORDS.map((word) => `${word}|${word.charAt(0).toUpperCase()}${word.slice(1)}`).join("|");
/**
 * Does `rawComment` use `name` -- the user label recorded at a caller's
 * address -- AS A REFERENCE to that caller?
 *
 * THE DECISION, RECORDED. Bare presence of the name is NOT enough.
 * the external analyser label names are routinely ordinary English words -- `loop`,
 * `init`, `main`, `start`, `data`, `table`, `draw` -- and an ordinary
 * description of what a routine does will contain one by accident. The
 * reproduced case: callers `[$0012, $0034]`, comment "sets the mode flag
 * before the main loop runs", caller `$0012` named `loop`. Nothing in that
 * comment refers to the routine at `$0012`, yet an earlier, identifier-
 * bounded test matched `loop` inside "main loop runs" and certified the label
 * as documenting its caller -- a falsely-clean verdict, and worse than a noisy
 * one, because a label counted as documented stays in `labels.kindRatio.user`
 * and stays in the reproducibility sample, so the measure that exists to catch
 * it can no longer see it.
 *
 * So a name counts only in one of three shapes, all still bounded on
 * identifier boundaries so `my_entry_pointer` still does not name
 * `entry_point`:
 *
 *   (a) MARKED UP AS A SYMBOL -- the name in backticks. An annotator who
 *       fences a token is quoting an identifier, not writing prose.
 *   (b) INTRODUCED BY A CALLER-NAMING WORD from `CALLER_CITATION_WORDS`,
 *       within three non-identifier characters: `from init`, `called by init`,
 *       `callers: init`.
 *   (c) FOLLOWED BY ITS OWN PARENTHESISED HEX ADDRESS -- `init ($0012)`.
 *
 * THE ALTERNATIVE WEIGHED AND REJECTED: drop the name branch entirely and
 * accept only the hex form, which is already anchored correctly. It is
 * strictly safer and strictly simpler. It was rejected because it would
 * silently reclassify every project whose annotator cites callers by name
 * rather than by address -- a real and reasonable convention -- turning a
 * measure of documentation quality into a measure of citation style, with no
 * signal to the operator that the rule had changed underneath them. The
 * tightening above is the cheapest change that refuses the coincidence while
 * still accepting a genuine name citation.
 *
 * THE RESIDUAL, STATED: a marker word can still precede a coincidental name
 * ("copies bytes from screen" where a caller is named `screen`). That is a
 * far narrower coincidence than bare presence, and it errs toward accepting a
 * citation rather than toward manufacturing one; widening the refusal further
 * would need a corpus, not a guess.
 */
function citesCallerByName(rawComment, name) {
    const token = escapeRegExp(name);
    const notIdentBefore = "(?<![0-9A-Za-z_])";
    const notIdentAfter = "(?![0-9A-Za-z_])";
    const patterns = [
        // (a) marked up as a symbol.
        "`" + token + "`",
        // (b) introduced by a caller-naming word.
        `${notIdentBefore}(?:${CALLER_CITATION_ALTERNATION})${notIdentAfter}[^0-9A-Za-z_]{1,3}${token}${notIdentAfter}`,
        // (c) followed by its own parenthesised hex address.
        `${notIdentBefore}${token}${notIdentAfter}\\s*\\(\\$[0-9a-fA-F]{1,4}\\)`,
    ];
    return patterns.some((pattern) => new RegExp(pattern).test(rawComment));
}
/** Does `comment` literally name at least one of `callers` -- either as a
 * hexadecimal address, or as a REFERENCE to the user label name recorded at a
 * caller address?
 *
 * The match is ANCHORED, not a substring test:
 *
 *   - a HEX reference is `$` plus the caller's address at either its bare
 *     width or the canonical four-digit width, followed by a character that is
 *     NOT a hexadecimal digit -- end of string counts as a boundary. So a
 *     comment mentioning an unrelated and entirely ordinary address whose
 *     leading digits merely coincide with a caller's short form names NO
 *     caller: `$8106` is not `$0810`. Case-insensitive, as before.
 *   - a NAME reference must stand on an identifier boundary on BOTH sides --
 *     the characters either side may not be an ASCII letter, digit or
 *     underscore, so `my_entry_pointer` does not name `entry_point` -- AND
 *     must be USED AS A REFERENCE rather than merely present. See
 *     `citesCallerByName()` for what counts, why bare presence does not, and
 *     which alternative was rejected.
 *
 * Why anchored rather than "purely textual": this rule is the one measure
 * whose entire subject is refusing to be talked into a clean verdict, and an
 * unanchored `includes()` could be satisfied by a string that merely TOUCHES a
 * caller's short form -- a falsely-clean verdict on the anti-gaming measure
 * itself. Held down in BOTH directions by
 * three committed controls in `anno-coverage.test.ts`: "ANCHORING: a
 * colliding longer hex never satisfies the multi-caller rule ...", "ANCHORING:
 * a caller's label name satisfies the rule only on an identifier boundary",
 * and "a caller's label name counts only when the comment USES it as a
 * reference ...". */
function namesACaller(rawComment, callers, nameByAddress) {
    for (const caller of callers) {
        const hex = caller.toString(16).toLowerCase();
        // Deduped through a Set: a caller at or above $1000 is already four digits
        // wide, so its bare and canonical forms are the same token and testing it
        // twice would be dead work.
        for (const token of new Set([hex, hex.padStart(4, "0")])) {
            if (new RegExp(`\\$${escapeRegExp(token)}(?![0-9a-f])`, "i").test(rawComment))
                return true;
        }
        const name = nameByAddress.get(caller);
        if (name && citesCallerByName(rawComment, name))
            return true;
    }
    return false;
}
export function computeReproducibility(input) {
    const { census, dispatch, symbols, comments, blocks, crossReferences, blockClassifier } = input;
    const sampleSize = Number.isSafeInteger(input.sampleSize) && input.sampleSize > 0 ? input.sampleSize : DEFAULT_SAMPLE_SIZE;
    const symbolList = Array.isArray(symbols) ? symbols : [];
    const blockList = Array.isArray(blocks) ? blocks : [];
    const parsed = parseLineComments(comments);
    const commentByAddress = new Map(parsed.map((p) => [p.address, p]));
    const rawByAddress = new Map();
    for (const c of Array.isArray(comments) ? comments : []) {
        if (c && typeof c.comment === "string" && String(c.type ?? "line") === "line")
            rawByAddress.set(c.address, c.comment);
    }
    const nameByAddress = new Map();
    for (const s of symbolList) {
        if (s && typeof s.name === "string" && String(s.kind ?? "") === "User")
            nameByAddress.set(s.address, s.name);
    }
    const callersByAddress = new Map();
    for (const x of Array.isArray(crossReferences) ? crossReferences : []) {
        if (x && Array.isArray(x.callers))
            callersByAddress.set(x.address, x.callers);
    }
    // --- The multi-caller rule. Strictly MORE THAN ONE caller.
    const multiCallerUndocumented = [];
    for (const sym of symbolList) {
        if (!sym)
            continue;
        const callers = callersByAddress.get(sym.address) ?? [];
        if (callers.length <= 1)
            continue;
        const entry = commentByAddress.get(sym.address);
        const raw = rawByAddress.get(sym.address) ?? "";
        if (!isNonVacuous(entry) || !namesACaller(raw, callers, nameByAddress)) {
            multiCallerUndocumented.push(sym.address);
        }
    }
    const undocumented = new Set(multiCallerUndocumented);
    // Again: ONE deduped list, and every number reported beside it is
    // derived from it. Same rule as `computeLabelRatio` above -- a count printed
    // in the same sentence as a list must be a count of that list, or the
    // finding text contradicts itself.
    const multiCallerAddresses = sortedUniqueNumbers(multiCallerUndocumented);
    // --- The deterministic sample: documented labels sorted ascending by
    // address, take every Nth where N = ceil(population / sampleSize).
    const documented = symbolList
        .filter((s) => s && isNonVacuous(commentByAddress.get(s.address)) && !undocumented.has(s.address))
        .map((s) => s.address)
        .sort((a, b) => a - b);
    const population = documented.length;
    if (population === 0) {
        return {
            sampled: 0,
            agreed: 0,
            disagreed: 0,
            agreementRate: null,
            sampleRule: "no documented labels -- nothing to sample",
            addresses: [],
            comparisons: [],
            multiCallerUndocumented: { count: multiCallerAddresses.length, addresses: multiCallerAddresses },
            reason: "no label carries a non-vacuous line comment, so reproducibility is UNKNOWN rather than clean",
        };
    }
    const step = Math.max(1, Math.ceil(population / sampleSize));
    const addresses = [];
    for (let i = 0; i < population; i += step)
        addresses.push(documented[i]);
    const sampleRule = `documented labels sorted ascending by address (population ${population}), take every ` +
        `${step}${step === 1 ? "st" : "th"} (step = ceil(population / sampleSize), sampleSize ${sampleSize})`;
    const comparisons = [];
    const provenTargets = provenDispatchTargets(dispatch);
    for (const address of addresses) {
        const fromBytes = classFromBytes(census, provenTargets, address);
        const entry = commentByAddress.get(address);
        const fromStore = classFromStore(entry?.gradeToken ?? null, blockClassifier(blockList, address));
        comparisons.push({ address, fromBytes, fromStore, agreed: fromBytes === fromStore });
    }
    const agreed = comparisons.filter((c) => c.agreed).length;
    return {
        sampled: comparisons.length,
        agreed,
        disagreed: comparisons.length - agreed,
        agreementRate: comparisons.length === 0 ? null : agreed / comparisons.length,
        sampleRule,
        addresses,
        comparisons,
        multiCallerUndocumented: { count: multiCallerAddresses.length, addresses: multiCallerAddresses },
        reason: null,
    };
}
const DIVERGENCE_NOTE = "KNOWN, NAMED BIAS ON THE STORE SIDE: an annotation store may merge two adjacent same-type " +
    "blocks that carry no boundary marker between them, and no verb on this project's curated " +
    "surface sets that marker. An over-merge on the store side is therefore expected and is not " +
    "evidence of a census error. The census side reads no block data at all.";
/** `blockClassifier` is REQUIRED with NO default -- see
 * `ReproducibilityInput`'s field of the same name for why. */
function computeDivergence(census, blocks, blockClassifier) {
    const blockList = Array.isArray(blocks) ? blocks : [];
    let censusCodeStoreNotCode = 0;
    let storeCodeCensusUnreached = 0;
    let uncoveredByStore = 0;
    for (const run of census.classRuns) {
        for (let addr = run.start; addr <= run.end; addr++) {
            // Neutral classes only. The arithmetic and the counter names are
            // exactly what they were when this loop compared store strings.
            const blockClass = blockClassifier(blockList, addr);
            if (blockClass === null)
                uncoveredByStore++;
            if (run.class === "reached-as-instruction" && blockClass !== "code")
                censusCodeStoreNotCode++;
            if (run.class === "unreached" && blockClass === "code")
                storeCodeCensusUnreached++;
        }
    }
    return {
        censusCodeStoreNotCode,
        storeCodeCensusUnreached,
        uncoveredByStore,
        comparedBytes: census.rangeBytes,
        blocksSupplied: blockList.length > 0,
        reason: blockList.length > 0
            ? null
            : "no block listing was supplied -- the divergence comparison is UNAVAILABLE, not clean, and its counts compare against nothing",
        note: DIVERGENCE_NOTE,
    };
}
/** The exact top-level key set, in order. Exported so the schema test asserts
 * against ONE definition rather than a second hand-typed copy that could
 * drift from the interface above. */
export const COVERAGE_REPORT_KEYS = [
    "schemaVersion",
    "generatedAt",
    "project",
    "structural",
    "dispatch",
    "labels",
    "commentVacuity",
    "reproducibility",
    "divergence",
];
/**
 * The ONE piece of a `JSON.parse` failure that is safe to report: the byte
 * offset at which parsing stopped, as ` (at byte offset N)`, or `""` when the
 * runtime did not name one.
 *
 * WHY THIS IS A DIGIT EXTRACTOR AND NOT A MESSAGE PASS-THROUGH
 * (`T-29-16-06`). V8's JSON `SyntaxError` embeds a SNIPPET OF THE INPUT in its
 * own message -- `Unexpected token 'Q', "QQZZORACLE"... is not valid JSON` --
 * so any code that forwards `err.message` from a JSON parse over
 * caller-supplied bytes is a content-disclosure oracle. The capture group is
 * `(\d+)` and nothing else, so no byte of the parsed file can reach the
 * returned string however the runtime words its message.
 *
 * DELIBERATELY A SECOND COPY of `anno-memmap-render.mts`'s function of the same
 * name, not an import: that module is the memory-map RENDERER and pulls in the
 * annotation store, the provenance schema and the confidence vocabulary. This
 * module is the census instrument, which declares its own input shapes and
 * imports none of that. A three-line pure digit extractor duplicated with an
 * explicit cross-reference is cheaper than coupling the instrument to the
 * renderer; if a third caller ever appears, that is the moment to give it a
 * shared home. Keep the two in step: widening either regex beyond digits
 * reopens the same content-disclosure hazard on that side.
 */
function jsonParsePosition(err) {
    const match = /\bat position (\d+)\b/.exec(err instanceof Error ? err.message : String(err));
    return match ? ` (at byte offset ${match[1]})` : "";
}
/**
 * A flat capture's `LoadedProject`, or the refusal `flatImageOrigin()` raises
 * for one that is not exactly 65536 bytes. Split out so both extension-first
 * branches reach the SAME refusal rather than two spellings of it.
 */
function flatImage(projectPath, bytes) {
    try {
        return { origin: flatImageOrigin(bytes), bytes, payloadDecoded: true, reason: null };
    }
    catch (err) {
        return imageRefusal(projectPath, err);
    }
}
/**
 * The shared shape for an extension-dispatched refusal. `prg-image.mts` throws
 * a bare `Error` by design (it is a pure byte-layout module with no error
 * family of its own), and its two messages are a user-visible contract, so
 * they are carried through verbatim beside the path the caller named.
 *
 * These messages state a LENGTH -- "input is 4096 byte(s)", "a .prg needs at
 * least 3 bytes" -- and never a byte of the file's content, so unlike the JSON
 * syntax branch below they are safe to interpolate.
 */
function imageRefusal(projectPath, err) {
    return {
        origin: 0,
        bytes: new Uint8Array(0),
        payloadDecoded: false,
        reason: `${projectPath} is not an image this surface can read -- ${err instanceof Error ? err.message : String(err)}`,
    };
}
/**
 * THE ONE DEFINITION of how the coverage verb turns a path into bytes plus an
 * origin. It has exactly TWO callers -- `buildCoverageReport()`'s census
 * below, and `anno-cli.ts`'s `projectImage()`, which supplies the byte source
 * for the cross-reference derivation. A third hand-rolled decode anywhere is
 * the defect this export exists to remove: until 2026-08-30 there were two,
 * and the two halves of one report could therefore describe different
 * programs (`T-29-16-02`).
 *
 * DISPATCH IS BY EXTENSION FIRST, NEVER BY BYTE LENGTH, and that order is a
 * CONTRACT rather than a style choice. It is copied from `anno-tools.mts`'s
 * `loadImage()` -- the surface's own image loader -- rather than re-derived,
 * so the two views of "what is an image" cannot drift. The incident it
 * encodes: a 4096-byte flat `.raw` capture fell through to the `.prg`
 * parser, whose first two bytes become the load address, so a truncated
 * capture silently reported a complete-looking measurement with an origin
 * read backwards out of its own payload bytes, and exited zero -- every
 * downstream address wrong, no diagnostic. Running the extension check before
 * any length check is what keeps `flatImageOrigin()`'s named refusal
 * reachable for those two extensions.
 *
 * The retired JSON-project form is the TRAILING branch and nothing more: its
 * only producer was deleted when the CLI's kept-verb set was narrowed to
 * `render-memmap` and `coverage` (2026-08-29), so it is retained purely so a
 * caller with an existing project file on disk is not broken. Its diagnoses
 * are byte-identical to what they were, with the single exception recorded on
 * the syntax branch below.
 *
 * Failure of an EXTENSION-DISPATCHED branch is a `payloadDecoded: false` with
 * the underlying refusal as the reason, never a throw. The one throw left is
 * for a path that cannot be READ at all -- a caller-contract violation.
 */
export function loadProjectImage(projectPath) {
    let bytes;
    try {
        bytes = new Uint8Array(readFileSync(projectPath));
    }
    catch (err) {
        // A path that cannot be read is a CALLER CONTRACT violation, not
        // malformed data -- the one class this module throws for. The
        // interpolated message here is an ERRNO-class failure (ENOENT, EACCES,
        // EISDIR) that carries no byte of the file's content, so it is left
        // interpolated on purpose; the equivalent read-failure branch on the
        // sibling verb was left alone for exactly this reason.
        throw new AnnoCoverageInputError(`buildCoverageReport: could not read ${projectPath} -- ${err instanceof Error ? err.message : String(err)}`, { cause: err, projectPath });
    }
    return decodeProjectImage(projectPath, bytes);
}
/**
 * Decodes a project image from its bytes. `projectPath` names it -- its
 * extension picks the branch, and every reason quotes it -- so a caller that
 * received the bytes rather than a path gets the same answer
 * `loadProjectImage()` gives for the file. Never throws.
 */
export function decodeProjectImage(projectPath, bytes) {
    // The live image forms, in `loadImage()`'s own branch order.
    const ext = extname(projectPath).toLowerCase();
    if (ext === ".raw" || ext === ".bin") {
        return flatImage(projectPath, bytes);
    }
    if (ext !== ".prg" && bytes.length === 65536) {
        return flatImage(projectPath, bytes);
    }
    if (ext === ".prg") {
        try {
            const { origin, body } = parsePrg(bytes);
            return { origin, bytes: new Uint8Array(body), payloadDecoded: true, reason: null };
        }
        catch (err) {
            return imageRefusal(projectPath, err);
        }
    }
    // The retired project form, reached only when nothing above matched.
    let parsed;
    try {
        parsed = JSON.parse(new TextDecoder().decode(bytes));
    }
    catch (err) {
        // NEVER INTERPOLATE THE UNDERLYING PARSE ERROR HERE
        // (`T-29-16-06`). V8's SyntaxError quotes a snippet of the input it choked
        // on, so passing it through turns `<project>` -- a positional the shipped
        // playbooks tell an LLM to compose in a Bash invocation -- into a
        // CONTENT-DISCLOSURE ORACLE. Reproduced verbatim on this very tree before
        // the fix: `game.prg is not valid JSON -- Unexpected token '', "<the
        // file's own opening bytes>"... is not valid JSON`.
        //
        // The equivalent fix (`T-29-14-01`) applies exactly this treatment to the
        // `render-memmap --provenance` sidecar's syntax failure. Both sibling
        // verbs therefore give one treatment to one defect class. Residual
        // severity is MEDIUM here rather than that sibling's HIGH only because
        // `storePathWithinWorkspace()` confines this positional before the
        // loader sees it, so the oracle cannot leave the workspace -- an
        // in-workspace content echo is still a content echo.
        //
        // What survives is everything a caller legitimately needs: WHICH file,
        // and THAT it is not JSON. The byte OFFSET is included where the runtime
        // exposes one, because a position is a fact about where parsing stopped
        // and not about what the file contains. Do not "improve" this by
        // restoring the parser's message.
        return {
            origin: 0,
            bytes: new Uint8Array(0),
            payloadDecoded: false,
            reason: `${projectPath} is not valid JSON${jsonParsePosition(err)} and is not a .prg or an exactly-65536-byte flat capture ` +
                "(the underlying parser message is deliberately NOT included -- it quotes the file's own bytes)",
        };
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        return { origin: 0, bytes: new Uint8Array(0), payloadDecoded: false, reason: `${projectPath}'s top-level JSON value is not an object` };
    }
    const project = parsed;
    const origin = typeof project.origin === "number" && Number.isSafeInteger(project.origin) ? project.origin : 0;
    const payload = project.raw_data_base64;
    if (typeof payload !== "string") {
        return { origin, bytes: new Uint8Array(0), payloadDecoded: false, reason: `${projectPath} carries no raw_data_base64 payload` };
    }
    try {
        return { origin, bytes: new Uint8Array(decodeRawData(payload)), payloadDecoded: true, reason: null };
    }
    catch (err) {
        return {
            origin,
            bytes: new Uint8Array(0),
            payloadDecoded: false,
            reason: `${projectPath}'s raw_data_base64 payload would not decode -- ${err instanceof Error ? err.message : String(err)}`,
        };
    }
}
/**
 * Assembles the whole report. Read-only over `projectPath` by construction:
 * this function opens the file for reading and there is no write, save or
 * session call anywhere in this module.
 */
export function buildCoverageReport(opts) {
    if (!opts || typeof opts.projectPath !== "string" || opts.projectPath.length === 0) {
        throw new AnnoCoverageInputError("buildCoverageReport: projectPath is required and must be a non-empty string");
    }
    const symbols = opts.symbols ?? [];
    const comments = opts.comments ?? [];
    const blocks = opts.blocks ?? [];
    const crossReferences = opts.crossReferences ?? [];
    const now = typeof opts.now === "function" ? opts.now : () => new Date().toISOString();
    // Resolved ONCE and passed to both consumers, so the two sub-reports can
    // never disagree about which store vocabulary they are reading.
    const blockClassifier = typeof opts.blockClassifier === "function" ? opts.blockClassifier : blockClassAt;
    const loaded = opts.project ?? loadProjectImage(opts.projectPath);
    const seeds = new Set();
    seeds.add(loaded.origin);
    for (const sym of symbols) {
        if (sym && String(sym.kind ?? "") === "User")
            seeds.add(sym.address);
    }
    for (const entry of opts.entryPoints ?? []) {
        if (Number.isSafeInteger(entry))
            seeds.add(entry);
    }
    const linear = decode(loaded.bytes, loaded.origin);
    const dispatch = scanIndirectDispatch(linear, loaded.bytes, loaded.origin);
    const structural = computeStructuralCensus(loaded.bytes, loaded.origin, seeds, {
        tableEntryAddresses: dispatch.tableEntryAddresses,
        // The ONE seam. Never `dispatch.discoveredTargets` and never
        // `dispatch.splitTableCandidates` -- see `provenDispatchTargets()`.
        extraSeeds: provenDispatchTargets(dispatch),
    });
    const commentVacuity = computeCommentVacuity(comments);
    const reproducibility = computeReproducibility({
        census: structural,
        dispatch,
        symbols,
        comments,
        blocks,
        crossReferences,
        blockClassifier,
        ...(opts.sampleSize !== undefined ? { sampleSize: opts.sampleSize } : {}),
    });
    const labels = computeLabelRatio(symbols, { excludeUserAddresses: reproducibility.multiCallerUndocumented.addresses });
    const divergence = computeDivergence(structural, blocks, blockClassifier);
    return {
        schemaVersion: COVERAGE_SCHEMA_VERSION,
        generatedAt: now(),
        project: {
            path: opts.projectPath,
            origin: loaded.origin,
            size: loaded.bytes.length,
            payloadDecoded: loaded.payloadDecoded,
            reason: loaded.reason,
        },
        structural,
        dispatch,
        labels,
        commentVacuity,
        reproducibility,
        divergence,
    };
}
/** Thresholds, each attached to exactly one measure and each stated once. */
const MIN_USER_FRACTION = 0.5;
const MIN_DISTINCT_COMMENT_RATIO = 0.5;
const MIN_AGREEMENT_RATE = 0.8;
/**
 * Turns a report into a boolean verdict plus per-measure reasons.
 *
 * This is NOT a combined coverage figure and must never become one (header
 * trap 3): it emits no number, it never averages or weights the measures, and
 * every finding names exactly one of them. It is a threshold gate over
 * separately-addressable measures, which is what the six committed controls
 * assert against -- five must be non-clean for a NAMED reason, one must be
 * clean, and without that last one the whole instrument would be vacuous.
 */
export function coverageFindings(report) {
    const findings = [];
    if (!report.project.payloadDecoded) {
        findings.push({ measure: "project", reason: `payload unavailable: ${report.project.reason ?? "reason not recorded"}` });
    }
    if (report.structural.truncated) {
        findings.push({ measure: "structural", reason: "the descent walk hit its step bound and was truncated" });
    }
    const { userFraction } = report.labels.kindRatio;
    if (userFraction === null) {
        findings.push({ measure: "labels", reason: "no non-System labels, so the Auto-versus-User figure is unavailable rather than clean" });
    }
    else if (userFraction < MIN_USER_FRACTION) {
        findings.push({ measure: "labels", reason: `user fraction ${userFraction.toFixed(3)} is below ${MIN_USER_FRACTION}` });
    }
    if (report.labels.autoPrefixNamesRemaining > 0) {
        findings.push({
            measure: "labels",
            reason: `${report.labels.autoPrefixNamesRemaining} label name(s) still carry an auto-name prefix at ${report.labels.autoPrefixNameAddresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
        });
    }
    const vac = report.commentVacuity;
    if (vac.distinctCommentRatio === null) {
        findings.push({ measure: "commentVacuity", reason: vac.reason ?? "comment vacuity is unavailable" });
    }
    else if (vac.distinctCommentRatio < MIN_DISTINCT_COMMENT_RATIO) {
        findings.push({
            measure: "commentVacuity",
            reason: `distinct-comment ratio ${vac.distinctCommentRatio.toFixed(3)} is below ${MIN_DISTINCT_COMMENT_RATIO}`,
        });
    }
    if (vac.bannedGenericAddresses.length > 0) {
        findings.push({
            measure: "commentVacuity",
            reason: `${vac.bannedGenericAddresses.length} address(es) carry a banned-generic comment at ${vac.bannedGenericAddresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
        });
    }
    if (vac.malformedGradeAddresses.length > 0) {
        findings.push({
            measure: "commentVacuity",
            reason: `${vac.malformedGradeAddresses.length} comment(s) open with a near-miss confidence token`,
        });
    }
    const repro = report.reproducibility;
    if (repro.multiCallerUndocumented.count > 0) {
        findings.push({
            measure: "reproducibility",
            reason: `${repro.multiCallerUndocumented.count} multi-caller label(s) documented without naming a caller at ${repro.multiCallerUndocumented.addresses.map((a) => `$${a.toString(16)}`).join(", ")}`,
        });
    }
    if (repro.agreementRate === null) {
        findings.push({ measure: "reproducibility", reason: repro.reason ?? "reproducibility is unavailable" });
    }
    else if (repro.agreementRate < MIN_AGREEMENT_RATE) {
        findings.push({ measure: "reproducibility", reason: `agreement rate ${repro.agreementRate.toFixed(3)} is below ${MIN_AGREEMENT_RATE}` });
    }
    if (!report.divergence.blocksSupplied) {
        findings.push({ measure: "divergence", reason: report.divergence.reason ?? "divergence is unavailable" });
    }
    else if (report.divergence.censusCodeStoreNotCode > 0) {
        findings.push({
            measure: "divergence",
            reason: `${report.divergence.censusCodeStoreNotCode} byte(s) the census reached as instructions are not classified Code by the store`,
        });
    }
    return { clean: findings.length === 0, findings };
}
