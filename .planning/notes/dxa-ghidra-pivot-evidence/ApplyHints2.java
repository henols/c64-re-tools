import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;

public class ApplyHints2 extends GhidraScript {
    // Every code label dxa discovered, plus the data ranges dxa proved are data.
    static final int[] CODE = {0x0810,0x0817,0x0831,0x083c,0x083e,0x0843,0x0856,0x085f,
                               0x0860,0x086d,0x0871,0x0879,0x0883,0x0892,0x0896,0x089a,0x08a0};
    // dxa's proven data: BASIC stub, the four split tables, the addrtable, the arrays.
    static final int[][] DATA = {{0x0801,0x080f},{0x08ab,0x08b6},{0x08b7,0x08be},
                                 {0x08bf,0x08fe},{0x08ff,0x0917}};

    @Override
    public void run() throws Exception {
        var sp = currentProgram.getAddressFactory().getDefaultAddressSpace();
        // Mark data first so recursive disassembly cannot run into it.
        for (int[] r : DATA) {
            Address s = sp.getAddress(r[0]), e = sp.getAddress(r[1]);
            clearListing(s, e);
            createLabel(s, "data_" + Integer.toHexString(r[0]), true);
        }
        for (int a : CODE) {
            Address ad = sp.getAddress(a);
            try { disassemble(ad); createFunction(ad, "sub_" + Integer.toHexString(a)); } catch (Exception ex) {}
            currentProgram.getSymbolTable().addExternalEntryPoint(ad);
        }
        // The address table dxa resolved: make it a real pointer array.
        Address tab = sp.getAddress(0x08b7);
        try { createData(tab, new ghidra.program.model.data.ArrayDataType(
              new ghidra.program.model.data.PointerDataType(), 4, 2)); } catch (Exception ex) {
              println("ApplyHints2: pointer array failed: " + ex); }
        println("ApplyHints2: " + CODE.length + " routines, " + DATA.length + " data ranges applied");
    }
}
