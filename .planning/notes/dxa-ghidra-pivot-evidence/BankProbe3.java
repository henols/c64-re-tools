import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.address.Address;
import ghidra.program.model.listing.*;
import ghidra.program.model.mem.*;
import java.io.*;

public class BankProbe3 extends GhidraScript {
    private void makeVolatile(Address start, int len) throws Exception {
        var mem = currentProgram.getMemory();
        MemoryBlock existing = mem.getBlock(start);
        if (existing != null) { existing.setVolatile(true); println("volatile(existing): " + existing.getName()); return; }
        MemoryBlock b = mem.createUninitializedBlock("VOL_" + start, start, len, false);
        b.setVolatile(true); b.setRead(true); b.setWrite(true);
        println("volatile(new): " + b.getName() + " " + b.getStart() + "-" + b.getEnd());
    }

    @Override
    public void run() throws Exception {
        var sp = currentProgram.getAddressFactory().getDefaultAddressSpace();
        println("existing blocks:");
        for (MemoryBlock b : currentProgram.getMemory().getBlocks())
            println("  " + b.getName() + " " + b.getStart() + "-" + b.getEnd() + " vol=" + b.isVolatile());
        makeVolatile(sp.getAddress(0x0000), 2);
        makeVolatile(sp.getAddress(0xd000), 0x1000);

        Address entry = sp.getAddress(0x0810);
        disassemble(entry); createFunction(entry, "start");
        currentProgram.getSymbolTable().addExternalEntryPoint(entry);
        analyzeAll(currentProgram);

        PrintWriter out = new PrintWriter(new FileWriter(getScriptArgs()[0]));
        DecompInterface di = new DecompInterface(); di.openProgram(currentProgram);
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            DecompileResults r = di.decompileFunction(f, 30, monitor);
            out.println(r.decompileCompleted() ? r.getDecompiledFunction().getC() : "// FAILED");
        }
        out.close();
    }
}
