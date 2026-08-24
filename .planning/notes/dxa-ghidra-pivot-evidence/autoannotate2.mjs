import { readFileSync } from "node:fs";
const mm = JSON.parse(readFileSync(
  "/home/henrik/dev/henrik/git/c64-re-tools/installer/skills/c64-memory-mapping/memmap.json","utf8"));

// RULE 1: narrowest containing range wins. A 4096-byte "I/O Area" entry must never
// beat the 1-byte "$D020 Border colour" entry.
function lookup(a){
  let best=null;
  for(const e of mm.entries){
    if(a<e.start||a>e.end) continue;
    const w=e.end-e.start;
    if(!best||w<best.w||(w===best.w&&(e.sym?1:0)>(best.e.sym?1:0))) best={w,e};
  }
  return best?.e ?? null;
}
// RULE 2: an address inside the loaded image is a program address, never a machine
// address — do not annotate it from the memory map at all.
const IMG=[0x0801,0x0917];
const inImage=a=>a>=IMG[0]&&a<=IMG[1];

const xrefs=readFileSync("/home/henrik/dev/_ghidra-probe/ghidra3.txt","utf8")
  .split("## REFERENCES")[1].trim().split("\n")
  .map(l=>l.match(/^([0-9a-f]{4}) -> ([0-9a-f]{2,4}) (\S+)$/)).filter(Boolean)
  .map(m=>({from:parseInt(m[1],16),to:parseInt(m[2],16),kind:m[3]}));

let hit=0,prog=0;
const seen=new Set();
for(const x of xrefs){
  if(inImage(x.to)){prog++;continue;}
  const e=lookup(x.to); if(!e){continue;}
  hit++;
  const key=x.to; if(seen.has(key))continue; seen.add(key);
  const name=e.sym||(e.label||"").split(/[.,]/)[0].trim().slice(0,28);
  const desc=(e.desc||"").split(/(?<=\.)\s/)[0].slice(0,90);
  console.log(`$${x.to.toString(16).padStart(4,"0")}  ${name.padEnd(28)} ; ${desc}`);
}
console.log(`\n${hit} machine-address xrefs annotated (${seen.size} distinct), ${prog} program addresses correctly skipped, of ${xrefs.length} total`);
