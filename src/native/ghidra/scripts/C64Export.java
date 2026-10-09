// Runs after Ghidra's analysis. Arguments: <request.json> <out.json>.
//
// Writes the structural result for the loaded image: functions with the
// source of their names, code and defined-data regions, memory references
// from instructions, and the requested decompilations within their bounds.
//@category c64-re-tools

import java.io.FileReader;
import java.io.FileWriter;
import java.util.LinkedHashSet;
import java.util.Set;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import ghidra.app.decompiler.DecompInterface;
import ghidra.app.decompiler.DecompileResults;
import ghidra.app.script.GhidraScript;
import ghidra.program.model.address.Address;
import ghidra.program.model.address.AddressSet;
import ghidra.program.model.listing.CodeUnit;
import ghidra.program.model.listing.Data;
import ghidra.program.model.listing.Function;
import ghidra.program.model.listing.Instruction;
import ghidra.program.model.symbol.RefType;
import ghidra.program.model.symbol.Reference;
import ghidra.program.model.symbol.SourceType;

public class C64Export extends GhidraScript {
	private static final java.util.regex.Pattern NAME = java.util.regex.Pattern.compile("^\\.?[A-Za-z_][A-Za-z0-9_]{0,63}$");
	/** The longest reason that the result check accepts. */
	private static final int MAX_REASON = 1000;
	/** The longest time for one decompilation, in seconds. */
	private static final int MAX_DECOMPILE_SECONDS = 60;

	@Override
	public void run() throws Exception {
		String[] args = getScriptArgs();
		JsonObject request;
		try (FileReader reader = new FileReader(args[0])) {
			request = new Gson().fromJson(reader, JsonObject.class);
		}
		long start = request.get("start").getAsLong();
		long end = request.get("end").getAsLong();
		AddressSet coverage = new AddressSet(toAddr(start), toAddr(end));

		JsonObject out = new JsonObject();
		JsonArray coverageOut = new JsonArray();
		coverageOut.add(range(start, end));
		out.add("coverage", coverageOut);
		out.add("functions", functions(coverage));
		out.add("regions", regions(coverage));
		out.add("references", references(coverage));
		JsonArray notDecompiled = new JsonArray();
		out.add("decompilations", decompile(request, notDecompiled));
		out.add("notDecompiled", notDecompiled);
		JsonObject completeness = new JsonObject();
		completeness.addProperty("functions", true);
		completeness.addProperty("regions", true);
		completeness.addProperty("references", true);
		out.add("completeness", completeness);
		try (FileWriter writer = new FileWriter(args[1])) {
			new Gson().toJson(out, writer);
		}
	}

	private static JsonObject range(long start, long end) {
		JsonObject range = new JsonObject();
		range.addProperty("start", start);
		range.addProperty("end", end);
		return range;
	}

	private JsonArray functions(AddressSet coverage) {
		JsonArray functions = new JsonArray();
		for (Function function : currentProgram.getFunctionManager().getFunctions(coverage, true)) {
			String name = function.getName();
			SourceType source = function.getSymbol().getSource();
			// Only the seeds carry user-defined names in this disposable project.
			String nameSource = source == SourceType.USER_DEFINED ? "seed" : source == SourceType.DEFAULT ? "generated" : "native";
			if (!NAME.matcher(name).matches()) {
				// A name that this script makes is generated, whatever name it replaces.
				name = String.format("FUN_%04x", function.getEntryPoint().getOffset());
				nameSource = "generated";
			}
			JsonObject item = new JsonObject();
			item.addProperty("entry", function.getEntryPoint().getOffset());
			item.addProperty("name", name);
			item.addProperty("nameSource", nameSource);
			functions.add(item);
		}
		return functions;
	}

	/** Instructions are code and defined data is data; undefined bytes are not classified. */
	private JsonArray regions(AddressSet coverage) {
		JsonArray regions = new JsonArray();
		String kind = null;
		long first = 0;
		long last = -2;
		for (CodeUnit unit : currentProgram.getListing().getCodeUnits(coverage, true)) {
			String unitKind = unit instanceof Instruction ? "code" : (unit instanceof Data && ((Data) unit).isDefined()) ? "data" : null;
			long unitStart = unit.getMinAddress().getOffset();
			long unitEnd = Math.min(unit.getMaxAddress().getOffset(), coverage.getMaxAddress().getOffset());
			if (unitKind != null && unitKind.equals(kind) && unitStart == last + 1) {
				last = unitEnd;
				continue;
			}
			if (kind != null) {
				JsonObject region = range(first, last);
				region.addProperty("classification", kind);
				regions.add(region);
			}
			kind = unitKind;
			first = unitStart;
			last = unitEnd;
		}
		if (kind != null) {
			JsonObject region = range(first, last);
			region.addProperty("classification", kind);
			regions.add(region);
		}
		return regions;
	}

	private JsonArray references(AddressSet coverage) {
		Set<String> seen = new LinkedHashSet<>();
		JsonArray references = new JsonArray();
		for (Instruction instruction : currentProgram.getListing().getInstructions(coverage, true)) {
			for (Reference reference : instruction.getReferencesFrom()) {
				RefType type = reference.getReferenceType();
				Address to = reference.getToAddress();
				if (!reference.isMemoryReference() || !to.isMemoryAddress() || type == RefType.FALL_THROUGH) {
					continue;
				}
				long from = instruction.getMinAddress().getOffset();
				if (type.isCall()) {
					add(references, seen, from, to.getOffset(), "call");
				} else if (type.isJump() || type.isFlow()) {
					add(references, seen, from, to.getOffset(), "jump");
				} else {
					if (type.isRead()) {
						add(references, seen, from, to.getOffset(), "read");
					}
					if (type.isWrite()) {
						add(references, seen, from, to.getOffset(), "write");
					}
					if (!type.isRead() && !type.isWrite()) {
						add(references, seen, from, to.getOffset(), "reference");
					}
				}
			}
		}
		return references;
	}

	private static void add(JsonArray references, Set<String> seen, long from, long to, String type) {
		if (!seen.add(from + ":" + to + ":" + type)) {
			return;
		}
		JsonObject reference = new JsonObject();
		reference.addProperty("from", from);
		reference.addProperty("to", to);
		reference.addProperty("type", type);
		references.add(reference);
	}

	/** A requested routine without decompiled code, and the decompiler's reason. */
	private static void notDecompiled(JsonArray list, long entry, String reason) {
		JsonObject item = new JsonObject();
		item.addProperty("entry", entry);
		String text = reason == null || reason.isBlank() ? "the decompiler gave no reason" : reason.strip();
		item.addProperty("reason", text.length() > MAX_REASON ? text.substring(0, MAX_REASON) : text);
		list.add(item);
	}

	private JsonArray decompile(JsonObject request, JsonArray failures) {
		JsonArray decompilations = new JsonArray();
		JsonArray entries = request.getAsJsonArray("decompile");
		if (entries.size() == 0) {
			return decompilations;
		}
		int perFunction = request.get("maxChars").getAsInt();
		int remaining = request.get("maxTotalChars").getAsInt();
		// The time that is left for the decompilations, as a clock time in milliseconds.
		long deadline = request.get("decompileDeadline").getAsLong();
		int routinesLeft = entries.size();
		DecompInterface decompiler = new DecompInterface();
		try {
			// Ghidra ships no native decompiler for some platforms (macOS): it then does not start.
			if (!decompiler.openProgram(currentProgram)) {
				String reason = "the Ghidra decompiler did not start: " + decompiler.getLastMessage();
				for (JsonElement element : entries) {
					notDecompiled(failures, element.getAsLong(), reason);
				}
				return decompilations;
			}
			for (JsonElement element : entries) {
				// Each routine gets an equal part of the time that is left, so every routine gets a turn.
				long secondsLeft = (deadline - System.currentTimeMillis()) / 1000;
				int seconds = (int) Math.min(MAX_DECOMPILE_SECONDS, secondsLeft / routinesLeft);
				routinesLeft--;
				Function function = getFunctionAt(toAddr(element.getAsLong()));
				if (function == null) {
					notDecompiled(failures, element.getAsLong(), "no function starts at this address");
					continue;
				}
				if (remaining <= 0) {
					notDecompiled(failures, element.getAsLong(), "the decompiled text of the other routines used the whole limit");
					continue;
				}
				if (seconds < 1) {
					notDecompiled(failures, element.getAsLong(), "the time for the Ghidra run ended before this routine");
					continue;
				}
				DecompileResults results = decompiler.decompileFunction(function, seconds, monitor);
				if (!results.decompileCompleted() || results.getDecompiledFunction() == null) {
					notDecompiled(failures, element.getAsLong(), results.getErrorMessage());
					continue;
				}
				String text = results.getDecompiledFunction().getC();
				int limit = Math.min(perFunction, remaining);
				boolean truncated = text.length() > limit;
				if (truncated) {
					text = text.substring(0, limit);
				}
				remaining -= text.length();
				JsonObject item = new JsonObject();
				item.addProperty("entry", function.getEntryPoint().getOffset());
				item.addProperty("text", text);
				item.addProperty("truncated", truncated);
				decompilations.add(item);
			}
		}
		finally {
			decompiler.dispose();
		}
		return decompilations;
	}
}
