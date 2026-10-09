// Runs a FakeVice as a stand-in for an x64sc process: it serves both monitors
// on the ports that VICE's own arguments name, until it is stopped. With
// --silent it accepts connections on both ports and never answers, as a VICE
// whose monitors do not become ready.

import { createServer } from "node:net";

import { FakeVice } from "./fake-vice.testkit.ts";

const args = process.argv.slice(2);

function port(flag: string): number {
  const match = /:(\d+)$/.exec(args[args.indexOf(flag) + 1] ?? "");
  if (match === null) throw new Error(`no ${flag} argument`);
  return Number(match[1]);
}

const binaryPort = port("-binarymonitoraddress");
const textPort = port("-remotemonitoraddress");
if (args.includes("--silent")) {
  for (const silent of [binaryPort, textPort]) createServer((socket) => socket.on("error", () => {})).listen(silent, "127.0.0.1");
} else {
  await new FakeVice().serve(binaryPort, textPort);
}
