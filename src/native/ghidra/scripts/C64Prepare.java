// Runs before Ghidra's analysis. Arguments: <seeds.json>.
//
// Fills the rest of the 64 KiB address space with uninitialized memory, so
// references to I/O and other RAM resolve, then applies the knowledge seeds:
// labels (user-defined names), data ranges (defined bytes that analysis does
// not disassemble) and entry points (disassembled functions).
//@category c64-re-tools

import java.io.FileReader;

import com.google.gson.Gson;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.data.ArrayDataType;
import ghidra.program.model.data.ByteDataType;
import ghidra.program.model.mem.Memory;
import ghidra.program.model.symbol.SourceType;

public class C64Prepare extends GhidraScript {
	@Override
	public void run() throws Exception {
		JsonObject seeds;
		try (FileReader reader = new FileReader(getScriptArgs()[0])) {
			seeds = new Gson().fromJson(reader, JsonObject.class);
		}
		long start = seeds.get("start").getAsLong();
		long end = seeds.get("end").getAsLong();
		Memory memory = currentProgram.getMemory();
		if (start > 0) {
			memory.createUninitializedBlock("RAM_LOW", toAddr(0), start, false);
		}
		if (end < 0xffff) {
			memory.createUninitializedBlock("RAM_HIGH", toAddr(end + 1), 0xffff - end, false);
		}

		for (JsonElement element : seeds.getAsJsonArray("labels")) {
			JsonObject label = element.getAsJsonObject();
			createLabel(toAddr(label.get("address").getAsLong()), label.get("name").getAsString(), true, SourceType.USER_DEFINED);
		}
		for (JsonElement element : seeds.getAsJsonArray("dataRanges")) {
			JsonObject range = element.getAsJsonObject();
			Address first = toAddr(range.get("start").getAsLong());
			Address last = toAddr(range.get("end").getAsLong());
			int length = (int) (last.getOffset() - first.getOffset() + 1);
			currentProgram.getListing().clearCodeUnits(first, last, false);
			currentProgram.getListing().createData(first, new ArrayDataType(ByteDataType.dataType, length, 1));
		}
		for (JsonElement element : seeds.getAsJsonArray("entryPoints")) {
			Address entry = toAddr(element.getAsLong());
			addEntryPoint(entry);
			disassemble(entry);
			if (getFunctionAt(entry) == null) {
				createFunction(entry, null);
			}
		}
	}
}
