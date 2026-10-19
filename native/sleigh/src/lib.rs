// The Ghidra SLEIGH decoder and decompiler for the c64-re-tools 6510
// language and Ghidra's Z80 language, as a WebAssembly module without imports. The module holds one
// program image. Each call returns the length of a JSON text that out_ptr
// points to: the result, or {"error": "..."}. The analysis itself is
// TypeScript (src/native/ghidra/); this module only decodes and decompiles.

use std::cell::RefCell;
use std::fmt::Write;

use ghidra_decompiler::opcodes::{OpCode, get_opname};
use ghidra_decompiler::program::{PcodeVarnode, Program};
use ghidra_decompiler::sleigh_arch::{LanguageRegistry, set_global_language_registry};
use serde_json::{Value, json};

/// The languages that load takes, by number: 0 is the NMOS 6510 of the C64, 1 the Z80.
const LANGUAGES: [&str; 2] = ["C64RT_6510:LE:16:nmos", "z80:LE:16:default"];

thread_local! {
    static PROGRAM: RefCell<Option<Program>> = const { RefCell::new(None) };
    static OUT: RefCell<Vec<u8>> = const { RefCell::new(Vec::new()) };
}

fn reply(value: Value) -> u32 {
    let text = value.to_string().into_bytes();
    let length = text.len() as u32;
    OUT.with(|out| *out.borrow_mut() = text);
    length
}

fn error(message: String) -> u32 {
    reply(json!({ "error": message }))
}

fn with_program(run: impl FnOnce(&mut Program) -> Value) -> u32 {
    PROGRAM.with(|slot| match slot.borrow_mut().as_mut() {
        Some(program) => reply(run(program)),
        None => error("no program is loaded".to_string()),
    })
}

/// Takes a buffer that alloc gave and the caller filled.
unsafe fn take(pointer: *mut u8, length: usize) -> Vec<u8> {
    unsafe { Vec::from_raw_parts(pointer, length, length) }
}

#[unsafe(no_mangle)]
pub extern "C" fn alloc(length: usize) -> *mut u8 {
    let mut buffer = Vec::<u8>::with_capacity(length);
    let pointer = buffer.as_mut_ptr();
    std::mem::forget(buffer);
    pointer
}

#[unsafe(no_mangle)]
pub extern "C" fn out_ptr() -> *const u8 {
    OUT.with(|out| out.borrow().as_ptr())
}

/// Loads the image bytes at base in a language of LANGUAGES; replaces the program that was loaded before.
#[unsafe(no_mangle)]
pub extern "C" fn load(image: *mut u8, length: usize, base: u32, language: u32) -> u32 {
    let bytes = unsafe { take(image, length) };
    let Some(language) = LANGUAGES.get(language as usize) else {
        return error(format!("no language {language}"));
    };
    let mut registry = LanguageRegistry::new();
    registry.add_static_directory(&[
        ("c64rt_6510.ldefs", include_bytes!("../../../src/native/ghidra/language/c64rt_6510.ldefs")),
        ("c64rt_6510.sla", include_bytes!("../../../src/native/ghidra/language/c64rt_6510.sla")),
        ("c64rt_6510.pspec", include_bytes!("../../../src/native/ghidra/language/c64rt_6510.pspec")),
        ("c64rt_6510.cspec", include_bytes!("../../../src/native/ghidra/language/c64rt_6510.cspec")),
        ("z80.ldefs", include_bytes!("../../../src/native/ghidra/language/z80.ldefs")),
        ("z80.sla", include_bytes!("../../../src/native/ghidra/language/z80.sla")),
        ("z80.pspec", include_bytes!("../../../src/native/ghidra/language/z80.pspec")),
        ("z80.cspec", include_bytes!("../../../src/native/ghidra/language/z80.cspec")),
    ]);
    set_global_language_registry(registry);
    match Program::from_raw_bytes(bytes, language, u64::from(base)) {
        Ok(program) => {
            PROGRAM.with(|slot| *slot.borrow_mut() = Some(program));
            reply(json!({ "ok": true }))
        }
        Err(problem) => error(problem.explain().to_string()),
    }
}

/// One instruction: its length, bytes, text and p-code. The JSON is written by
/// hand: a serde_json Value per varnode makes a decode six times slower.
#[unsafe(no_mangle)]
pub extern "C" fn decode(address: u32) -> u32 {
    let reply = PROGRAM.with(|slot| {
        let mut slot = slot.borrow_mut();
        let Some(program) = slot.as_mut() else { return Err("no program is loaded".to_string()) };
        let address = u64::from(address);
        let (pcode, text) = match (program.pcode(address, 1), program.disassemble(address, 1)) {
            (Ok(mut pcode), Ok(mut text)) => (pcode.remove(0), text.remove(0)),
            (Err(problem), _) | (_, Err(problem)) => return Err(problem.explain().to_string()),
        };
        let mut out = String::with_capacity(1024);
        let _ = write!(out, "{{\"length\":{},\"bytes\":{:?},\"mnemonic\":{},\"operands\":{},\"pcode\":[", pcode.length, text.bytes, quote(&text.mnemonic), quote(&text.operands));
        for (index, operation) in pcode.operations.iter().enumerate() {
            if index > 0 {
                out.push(',');
            }
            let _ = write!(out, "{{\"op\":\"{}\",\"out\":", get_opname(operation.opcode));
            match &operation.output {
                Some(output) => write_varnode(&mut out, output),
                None => out.push_str("null"),
            }
            out.push_str(",\"in\":[");
            for (position, input) in operation.inputs.iter().enumerate() {
                if position > 0 {
                    out.push(',');
                }
                write_varnode(&mut out, input);
            }
            out.push(']');
            if operation.opcode == OpCode::Callother {
                let index = operation.inputs[0].offset as u32;
                let name = program.architecture().userops.get_op(index).map(|op| quote(op.get_name()));
                let _ = write!(out, ",\"userop\":{}", name.as_deref().unwrap_or("null"));
            }
            out.push('}');
        }
        out.push_str("]}");
        Ok(out)
    });
    match reply {
        Ok(text) => {
            let length = text.len() as u32;
            OUT.with(|out| *out.borrow_mut() = text.into_bytes());
            length
        }
        Err(message) => error(message),
    }
}

fn quote(text: &str) -> String {
    serde_json::to_string(text).unwrap_or_else(|_| "\"\"".to_string())
}

fn write_varnode(out: &mut String, varnode: &PcodeVarnode) {
    let _ = write!(out, "{{\"space\":{},\"offset\":{},\"size\":{}}}", quote(&varnode.space.to_lowercase()), varnode.offset, varnode.size);
}

/// Names a routine (kind 0) or a data address (kind 1) for the decompiler.
#[unsafe(no_mangle)]
pub extern "C" fn name(address: u32, text: *mut u8, length: usize, kind: u32) -> u32 {
    let text = String::from_utf8_lossy(&unsafe { take(text, length) }).into_owned();
    with_program(|program| {
        let address = u64::from(address);
        let named = if kind == 0 { program.set_function_name(address, &text) } else { program.set_data_name(address, &text) };
        match named {
            Ok(()) => json!({ "ok": true }),
            Err(problem) => json!({ "error": problem.explain().to_string() }),
        }
    })
}

/// The C text of the routine at the address.
#[unsafe(no_mangle)]
pub extern "C" fn decompile(address: u32) -> u32 {
    with_program(|program| match program.decompile(u64::from(address)) {
        Ok(text) => json!({ "text": text }),
        Err(problem) => json!({ "error": problem.explain().to_string() }),
    })
}
