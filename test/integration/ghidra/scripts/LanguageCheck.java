// Reports how the c64-re-tools NMOS 6510 language decodes and executes, for
// the language acceptance tests. Arguments: <cases.json> <out.json>.
//
// For each opcode at 0x1000 + op * 4 (followed by the bytes 0x10 0x20 0x30):
// mnemonic, length, fall-through, flows and p-code op names.
// For each case: the registers and memory after one emulated instruction.
//@category c64-re-tools

import java.io.FileReader;
import java.io.FileWriter;
import java.math.BigInteger;
import java.util.Map;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import ghidra.app.emulator.EmulatorHelper;
import ghidra.app.script.GhidraScript;
import ghidra.app.util.PseudoDisassembler;
import ghidra.app.util.PseudoInstruction;
import ghidra.program.model.address.Address;
import ghidra.program.model.pcode.PcodeOp;

public class LanguageCheck extends GhidraScript {
	private static final String[] REGISTERS = { "A", "X", "Y", "SP", "N", "V", "D", "I", "Z", "C" };

	@Override
	public void run() throws Exception {
		String[] args = getScriptArgs();
		JsonObject input;
		try (FileReader reader = new FileReader(args[0])) {
			input = new Gson().fromJson(reader, JsonObject.class);
		}
		JsonObject output = new JsonObject();
		output.add("opcodes", decodeAll());
		output.add("cases", emulate(input.getAsJsonArray("cases")));
		try (FileWriter writer = new FileWriter(args[1])) {
			new Gson().toJson(output, writer);
		}
	}

	private JsonArray decodeAll() throws Exception {
		PseudoDisassembler disassembler = new PseudoDisassembler(currentProgram);
		JsonArray opcodes = new JsonArray();
		for (int op = 0; op < 256; op++) {
			Address address = toAddr(0x1000 + op * 4);
			JsonObject row = new JsonObject();
			row.addProperty("op", op);
			PseudoInstruction instruction = disassembler.disassemble(address);
			if (instruction == null) {
				opcodes.add(row);
				continue;
			}
			row.addProperty("mnemonic", instruction.getMnemonicString());
			row.addProperty("length", instruction.getLength());
			row.addProperty("fallthrough", instruction.getFlowType().hasFallthrough());
			row.addProperty("flowType", instruction.getFlowType().toString());
			JsonArray flows = new JsonArray();
			for (Address flow : instruction.getFlows()) {
				flows.add(flow.getOffset());
			}
			row.add("flows", flows);
			JsonArray pcode = new JsonArray();
			for (PcodeOp p : instruction.getPcode()) {
				String name = p.getMnemonic();
				if (p.getOpcode() == PcodeOp.CALLOTHER) {
					name += ":" + currentProgram.getLanguage().getUserDefinedOpName((int) p.getInput(0).getOffset());
				}
				pcode.add(name);
			}
			row.add("pcode", pcode);
			opcodes.add(row);
		}
		return opcodes;
	}

	private JsonArray emulate(JsonArray cases) throws Exception {
		JsonArray results = new JsonArray();
		for (JsonElement element : cases) {
			JsonObject spec = element.getAsJsonObject();
			EmulatorHelper emulator = new EmulatorHelper(currentProgram);
			try {
				long pc = spec.has("pc") ? spec.get("pc").getAsLong() : 0xc000;
				JsonArray bytes = spec.getAsJsonArray("bytes");
				byte[] code = new byte[bytes.size()];
				for (int i = 0; i < code.length; i++) {
					code[i] = (byte) bytes.get(i).getAsInt();
				}
				for (String register : REGISTERS) {
					emulator.writeRegister(register, register.equals("SP") ? 0x01ff : 0);
				}
				JsonObject registers = spec.getAsJsonObject("registers");
				for (Map.Entry<String, JsonElement> entry : registers.entrySet()) {
					emulator.writeRegister(entry.getKey(), entry.getValue().getAsLong());
				}
				JsonObject memory = spec.getAsJsonObject("memory");
				for (Map.Entry<String, JsonElement> entry : memory.entrySet()) {
					emulator.writeMemoryValue(toAddr(Long.parseLong(entry.getKey())), 1, entry.getValue().getAsLong());
				}
				emulator.writeMemory(toAddr(pc), code);
				emulator.writeRegister(emulator.getPCRegister(), pc);
				boolean stepped = emulator.step(monitor);
				JsonObject result = new JsonObject();
				result.addProperty("name", spec.get("name").getAsString());
				result.addProperty("stepped", stepped);
				result.addProperty("PC", emulator.readRegister(emulator.getPCRegister()).longValue());
				for (String register : REGISTERS) {
					BigInteger value = emulator.readRegister(register);
					result.addProperty(register, value.longValue());
				}
				JsonObject after = new JsonObject();
				for (JsonElement address : spec.getAsJsonArray("read")) {
					long at = address.getAsLong();
					after.addProperty(Long.toString(at), emulator.readMemoryByte(toAddr(at)) & 0xff);
				}
				result.add("memory", after);
				results.add(result);
			}
			finally {
				emulator.dispose();
			}
		}
		return results;
	}
}
