// VolatileCarve.java -- a committed, function-named Ghidra pre-script.
//
// WHAT IT DOES, IN ORDER. Splits the current program's memory at three fixed
// addresses ($0002, $D000, $E000), then marks the 6510 processor port
// ($0000-$0001) and the I/O page ($D000-$DFFF) volatile, so the decompiler
// does not dead-store-eliminate hardware writes during the analysis this
// script itself triggers. It then reads an optional entry-point file, seeds
// each address as a function entry point, and calls analyzeAll().
//
// HOW IT IS REACHED. This script is supplied as `ghidra.analyze`'s
// `preScript` field (host-tool.mts / ghidra-project.mts), which emits it on
// `analyzeHeadless`'s own `-preScript` flag. The optional entry-point file is
// supplied as `ghidra.analyze`'s `entrypointsPath` field, which is appended as
// this script's own positional argument -- `getScriptArgs()[0]`.
// `ghidra.analyze`'s `noanalysis` field is REQUIRED alongside this script:
// this script calls `analyzeAll(currentProgram)` itself, so an additional
// analysis pass triggered by `analyzeHeadless`'s own default behaviour would
// run the whole pipeline twice, once before the volatile carve above ever
// executes.
//
// THE ONE THING NOT TO COPY FROM AN EARLIER PROBE. A bare `getBlock(addr)`
// followed directly by `setVolatile(true)`, with no prior split, is a trap on
// a flat 64K import: Ghidra's `BinaryLoader` creates exactly ONE block for
// such an image, `RAM 0000-ffff`, so `getBlock($D000)` returns that whole
// block and `setVolatile(true)` marks the ENTIRE address space volatile --
// with no error and no warning, and the symptom (no dead-store elimination
// anywhere) looks exactly like success. That is why this script splits FIRST,
// at $0002/$D000/$E000, before ever touching the volatile flag: the split
// guarantees the block `setVolatile()` acts on starts exactly at the range's
// own start, never wider.
//
// BOTH IMPORT ROUTES, ONE SCRIPT. This script branches on what
// `mem.getBlock()` returns, NEVER on a route flag the caller passes. On the
// flat-64K route the split above produces a block starting at each range's
// start, so `setVolatile()` scopes correctly on the EXISTING block. On the
// `.prg` route no block covers `$D000` at all (the imported image is much
// smaller), so `getBlock()` returns null and this script falls back to
// `createUninitializedBlock()` with read, write and volatile all set. One
// file works for both images; the caller never tells it which route it is on.
//
// WHY NO EXCEPTION HANDLER SITS ANYWHERE IN THIS SCRIPT'S CARVE OR FLAG-SET
// LOGIC. A memory conflict (`MemoryConflictException`) thrown by `split()` or
// by block creation MUST propagate out of this script and surface as
// `analyzeHeadless`'s own `ERROR REPORT SCRIPT ERROR` log line. Catching it
// here and continuing would make the run silently fall back to a
// non-volatile carve -- exactly the failure mode the Standing Constraint
// (`ROADMAP.md` -- "Ghidra deletes hardware writes as dead stores unless the
// I/O ranges are marked volatile") names: applied to a raster loop this
// deletes the entire visible effect of the program while the run still
// reports success. This script would rather crash loudly than degrade
// quietly.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSpace;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

public class VolatileCarve extends GhidraScript {

    private static final long[] SPLIT_AT = { 0x0002L, 0xd000L, 0xe000L };

    /** Address ranges that must end up volatile: {start, byteLength}. */
    private static final long[][] VOLATILE_RANGES = {
        { 0x0000L, 0x0002L },   // 6510 processor port: $00 direction, $01 banking
        { 0xd000L, 0x1000L },   // VIC-II / SID / colour RAM / CIA / expansion
    };

    private void dumpBlocks(String label) {
        println("BLOCKS-" + label + ":");
        for (MemoryBlock b : currentProgram.getMemory().getBlocks()) {
            println("  " + b.getName() + " " + b.getStart() + "-" + b.getEnd()
                    + " vol=" + b.isVolatile());
        }
    }

    /**
     * Carve the flat 64K block so volatility can be scoped to a sub-range.
     * Each split is guarded twice: the block must exist, and it must not
     * already start at the split address (splitting a block at its own start
     * throws). On the .prg route these are all no-ops -- either no block covers
     * the address, or the block already starts there -- and the method says so
     * on its own output line rather than passing silently.
     */
    private void carve(Memory mem, AddressSpace sp) throws Exception {
        for (long a : SPLIT_AT) {
            Address addr = sp.getAddress(a);
            MemoryBlock blk = mem.getBlock(addr);
            if (blk == null) {
                println("SPLIT-SKIP at " + Long.toHexString(a) + ": no block covers this address");
                continue;
            }
            if (blk.getStart().equals(addr)) {
                println("SPLIT-SKIP at " + Long.toHexString(a) + ": block " + blk.getName()
                        + " already starts here");
                continue;
            }
            mem.split(blk, addr);
            println("SPLIT-OK at " + Long.toHexString(a));
        }
    }

    /**
     * Flat-64K route: the carve above has already produced a block that starts
     * at the range's start, so setVolatile() scopes correctly.
     * .prg route: getBlock() returns null and a fresh volatile block is created.
     */
    private void makeVolatile(Memory mem, AddressSpace sp, long start, long len) throws Exception {
        Address addr = sp.getAddress(start);
        MemoryBlock blk = mem.getBlock(addr);
        if (blk != null) {
            blk.setVolatile(true);
            println("VOLATILE-SET: " + blk.getName() + " " + blk.getStart() + "-" + blk.getEnd());
            if (!blk.getStart().equals(addr)) {
                println("VOLATILE-WARN: block " + blk.getName() + " starts at " + blk.getStart()
                        + ", not at the requested " + addr
                        + " -- volatility is wider than intended, the carve did not take");
            }
            return;
        }
        MemoryBlock nb = mem.createUninitializedBlock(
                "VOL_" + Long.toHexString(start), addr, len, false);
        nb.setVolatile(true);
        nb.setRead(true);
        nb.setWrite(true);
        println("VOLATILE-NEW: " + nb.getName() + " " + nb.getStart() + "-" + nb.getEnd()
                + " (.prg route -- no existing block covered this address)");
    }

    private List<Address> readEntryPoints(AddressSpace sp) throws Exception {
        List<Address> out = new ArrayList<>();
        String[] args = getScriptArgs();
        if (args.length == 0 || args[0] == null || args[0].isEmpty()) {
            println("ENTRYPOINTS: none");
            println("ENTRYPOINTS-REASON: no entry-point file argument given");
            return out;
        }
        File f = new File(args[0]);
        if (!f.isFile()) {
            println("ENTRYPOINTS: none");
            println("ENTRYPOINTS-REASON: file not found: " + f.getPath());
            return out;
        }
        for (String raw : Files.readAllLines(f.toPath())) {
            String line = raw.trim();
            if (line.isEmpty() || line.startsWith("#")) continue;
            if (line.startsWith("$")) line = line.substring(1);
            out.add(sp.getAddress(Long.parseLong(line, 16)));
        }
        if (out.isEmpty()) {
            println("ENTRYPOINTS: none");
            println("ENTRYPOINTS-REASON: file " + f.getPath() + " contained no addresses");
        } else {
            println("ENTRYPOINTS: " + out.size() + " from " + f.getPath());
        }
        return out;
    }

    @Override
    public void run() throws Exception {
        Memory mem = currentProgram.getMemory();
        AddressSpace sp = currentProgram.getAddressFactory().getDefaultAddressSpace();

        dumpBlocks("BEFORE");

        // Show the trap rather than only avoiding it: on a flat import this
        // prints RAM 0000-ffff, which a bare getBlock-and-flag with no prior
        // split would have marked volatile in its entirety.
        MemoryBlock naive = mem.getBlock(sp.getAddress(0xd000L));
        println("NAIVE-BLOCK-AT-D000: "
                + (naive == null ? "none (.prg route)"
                                 : naive.getName() + " " + naive.getStart() + "-" + naive.getEnd()
                                   + " size=" + naive.getSize()));

        carve(mem, sp);
        for (long[] r : VOLATILE_RANGES) {
            makeVolatile(mem, sp, r[0], r[1]);
        }

        dumpBlocks("AFTER");

        int volatileCount = 0;
        for (MemoryBlock b : mem.getBlocks()) if (b.isVolatile()) volatileCount += 1;
        println("VOLATILE-BLOCK-COUNT: " + volatileCount);

        for (Address entry : readEntryPoints(sp)) {
            disassemble(entry);
            createFunction(entry, null);
            currentProgram.getSymbolTable().addExternalEntryPoint(entry);
            println("ENTRYPOINT-SEEDED: " + entry);
        }

        analyzeAll(currentProgram);
        println("ANALYZE-ALL: complete");
    }
}
