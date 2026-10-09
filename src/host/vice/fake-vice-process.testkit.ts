// Runs a FakeVice as a stand-in for an x64sc process: it serves both monitors
// on the ports that VICE's own arguments name, until it is stopped.

import { FakeVice } from "./fake-vice.testkit.ts";

const args = process.argv.slice(2);

function port(flag: string): number {
  const match = /:(\d+)$/.exec(args[args.indexOf(flag) + 1] ?? "");
  if (match === null) throw new Error(`no ${flag} argument`);
  return Number(match[1]);
}

await new FakeVice().serve(port("-binarymonitoraddress"), port("-remotemonitoraddress"));
