// Throwaway Ghidra pre-script for phase 23 -- evidence, not a deliverable.
// Registered in no manifest, shipped by nothing, read by no src/ module.
//
// WHAT IT DOES. Makes the C64 processor port ($0000-$0001) and the I/O page
// ($D000-$DFFF) volatile BEFORE analyzeAll() runs, so the decompiler does not
// dead-store-eliminate hardware writes, then seeds the VICE-observed entry
// points and runs analysis.
//
// THE ONE THING NOT TO COPY FROM THE PIVOT. BankProbe3.java's makeVolatile()
// does getBlock(addr) first and calls setVolatile(true) on whatever comes back.
// That was written for the .prg route, where the image block does not cover
// $D000, so getBlock returned null and a fresh I/O block was created. On a flat
// 64K raw import Ghidra's BinaryLoader creates exactly ONE block, RAM 0000-ffff,
// so getBlock($D000) returns the whole image and setVolatile(true) marks the
// ENTIRE address space volatile -- with no error and no warning, and the symptom
// (no dead-store elimination anywhere) looks like success. 23-CONTEXT.md's
// discretion note recommended reusing that guard verbatim; 23-RESEARCH.md
// Pitfall 2 overturns it, verified live against Ghidra 12.1.3.
//
// So: Memory.split() at $0002, $D000 and $E000 FIRST, then setVolatile(true) on
// the carved $0000-$0001 and $D000-$DFFF blocks only.
//
// BOTH ROUTES, ONE SCRIPT. Where getBlock(addr) returns null -- the .prg route,
// where no block covers I/O -- fall back to createUninitializedBlock with read,
// write and volatile set, exactly as BankProbe3.java does. The script branches
// on which route it is in rather than being written for one: the fixture
// rehearsal exercises the .prg branch and the corpus run exercises the split
// branch, and both must work from this one file.
//
// ENTRY POINTS come from VICE runtime observation (D-06) and NEVER from dxa or
// Ghidra -- no fact used to judge an engine may be produced by an engine under
// test. They arrive as a file of four-hex-digit addresses, one per line. An
// absent or empty file prints `ENTRYPOINTS: none` and continues: Ghidra alone on
// a headerless 6502 image produced 0 functions and 0 code bytes on the pivot
// fixture, so an empty entry-point set is a recordable fact, not a silent no-op.
//
// Usage:
//   analyzeHeadless <proj> <name> -import <image> \
//     -processor 6502:LE:16:default -loader BinaryLoader -loader-baseAddr 0x0 \
//     -noanalysis -preScript FlatVolatile.java [<entrypoints-file>] -deleteProject
//
// getScriptArgs()[0], when present, is the entry-point file. It is optional.

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSpace;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.mem.MemoryBlock;

import java.io.File;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;

public class FlatVolatile extends GhidraScript {

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
     * .prg route: getBlock() returns null and a fresh volatile block is created,
     * which is BankProbe3.java's path, kept verbatim in behaviour.
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
        // prints RAM 0000-ffff, which is what BankProbe3.java would have marked
        // volatile in its entirety.
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
