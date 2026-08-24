import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.*;
import ghidra.program.model.listing.*;
import ghidra.program.model.symbol.*;
import ghidra.program.model.data.*;
import java.io.*;
import java.util.*;

public class ExportAnalysis extends GhidraScript {
    @Override
    public void run() throws Exception {
        String[] args = getScriptArgs();
        PrintWriter out = new PrintWriter(new FileWriter(args.length > 0 ? args[0] : "ghidra.txt"));
        Listing lst = currentProgram.getListing();

        out.println("## CLASSIFICATION");
        AddressIterator ai = currentProgram.getMemory().getAddresses(true);
        for (Address a : currentProgram.getMemory().getAddressRanges().next()) { }
        for (AddressRange r : currentProgram.getMemory().getAddressRanges()) {
            for (Address a = r.getMinAddress(); a.compareTo(r.getMaxAddress()) <= 0; a = a.next()) {
                CodeUnit cu = lst.getCodeUnitContaining(a);
                String kind = "undef";
                if (cu instanceof Instruction) kind = "code";
                else if (cu instanceof Data) kind = ((Data) cu).isDefined() ? "data" : "undef";
                out.println(String.format("%s %s", a, kind));
                if (a.equals(r.getMaxAddress())) break;
            }
        }

        out.println("## FUNCTIONS");
        for (Function f : currentProgram.getFunctionManager().getFunctions(true)) {
            out.println(f.getEntryPoint() + " " + f.getName() + " body=" + f.getBody().getNumAddresses()
                + " callers=" + f.getCallingFunctions(monitor).size());
        }

        out.println("## DEFINED_DATA");
        DataIterator di = lst.getDefinedData(true);
        while (di.hasNext()) {
            Data d = di.next();
            out.println(d.getAddress() + " " + d.getDataType().getName() + " len=" + d.getLength()
                + " label=" + (d.getLabel() == null ? "-" : d.getLabel()));
        }

        out.println("## STRUCTS");
        Iterator<Composite> ci = currentProgram.getDataTypeManager().getAllComposites();
        while (ci.hasNext()) { Composite c = ci.next(); out.println(c.getName() + " size=" + c.getLength()); }

        out.println("## REFERENCES");
        ReferenceIterator ri = currentProgram.getReferenceManager().getReferenceIterator(
            currentProgram.getMinAddress());
        int n = 0;
        while (ri.hasNext() && n < 400) {
            Reference rf = ri.next(); n++;
            out.println(rf.getFromAddress() + " -> " + rf.getToAddress() + " " + rf.getReferenceType());
        }
        out.close();
    }
}
