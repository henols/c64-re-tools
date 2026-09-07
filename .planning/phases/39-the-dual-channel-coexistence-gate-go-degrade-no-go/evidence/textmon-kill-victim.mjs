#!/usr/bin/env node
// -----------------------------------------------------------------------------
// textmon-kill-victim.mjs -- Phase 39, plan 39-06 (`CHAN-01`, `DISCONNECT_RECOVERY`).
//
// THE VICTIM.
// -----------
// A separate CHILD PROCESS, spawned by disconnect-recovery-probe.mjs, that
// establishes a text-side halt and then blocks forever -- registering
// NOTHING that could run in response to this process going away: no
// lifecycle callback of any shape, on any signal, and no attempt to tear
// its own connection down. Any such registration would make the measurement
// about THAT cleanup path instead of about what actually happens when a
// client simply vanishes, which is the literal reading of "SIGKILL the text
// client" (SCHEMA.md section 2.5): a same-process socket teardown exercises
// a release path this process is built to never have a chance to run.
//
// The parent kills this process with an uncatchable signal. There is no
// handler here that could observe that signal, react to it, or run any code
// afterwards -- the kernel closing this process's socket file descriptor,
// with nothing on this side having asked for that, IS the experiment.
//
// Usage: node textmon-kill-victim.mjs <text-port>
//
// Protocol with the parent: once the halt is established, this process
// prints exactly one line to stdout, "VICTIM_READY <details>", so the
// parent knows the halt is in effect before it starts measuring. Nothing
// further is ever printed or sent by this process on its own initiative.
// -----------------------------------------------------------------------------
import { awaitBanner, connectTextMonitor, sendAndAwaitPrompt } from "./textmon-probe-client.mjs";

const textPort = Number(process.argv[2]);

if (!Number.isInteger(textPort) || textPort <= 0) {
  process.stderr.write("usage: node textmon-kill-victim.mjs <text-port>\n");
  process.exitCode = 1;
} else {
  const sock = await connectTextMonitor(textPort, { timeoutMs: 10000 });
  const banner = await awaitBanner(sock, { timeoutMs: 10000 });
  const halt = await sendAndAwaitPrompt(sock, "memmapshow", { timeoutMs: 15000 });
  process.stdout.write(
    `VICTIM_READY matchedPromptRe=${halt.matchedPromptRe} bannerBytes=${banner.raw.length} replyBytes=${halt.raw.length}\n`,
  );
  // Nothing follows. This process now blocks forever with no lifecycle
  // registration of any kind -- its own uncatchable termination is the
  // only way it ever stops existing.
  await new Promise(() => {});
}
