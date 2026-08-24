import ghidra.app.script.GhidraScript;
import ghidra.app.decompiler.*;
import ghidra.program.model.listing.Function;
import java.io.*;

public class Decomp extends GhidraScript {
    @Override
    public void run() throws Exception {
        PrintWriter out = new PrintWriter(new FileWriter(getScriptArgs()[0]));
        DecompInterface di = new DecompInterface();
        di.openProgram(currentProgram);
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            DecompileResults r = di.decompileFunction(f, 30, monitor);
            out.println("//===== " + f.getName() + " @ " + f.getEntryPoint());
            out.println(r.decompileCompleted() ? r.getDecompiledFunction().getC()
                                              : "// FAILED: " + r.getErrorMessage());
        }
        out.close();
    }
}
