// broker-watchdog.mts
//
// WHY THIS FILE EXISTS: a broker killed with SIGKILL cannot clean up after
// itself. The broker forks this watchdog at startup and reports, over the IPC
// channel, the process group of every child it starts and every child that
// exits. When the channel closes -- the broker is gone, however it went --
// the watchdog stops every group it still holds, then exits.
//
// WHAT NOT TO DO:
//   - Never signal a group the broker did not report. This process has no
//     other authority.
//   - Never outlive the cleanup: exit as soon as the groups are stopped.

const groups = new Set<number>();

function signalGroup(pid: number, signal: NodeJS.Signals): void {
  try {
    process.kill(-pid, signal);
    return;
  } catch {
    // no such group -- try the pid itself
  }
  try {
    process.kill(pid, signal);
  } catch {
    // already gone
  }
}

function isGroupAlive(pid: number): boolean {
  for (const target of [-pid, pid]) {
    try {
      process.kill(target, 0);
      return true;
    } catch {
      // not this one
    }
  }
  return false;
}

function killWaitMs(): number {
  const n = Number(process.env.VICE_BROKER_KILL_WAIT_S);
  return (Number.isFinite(n) && n >= 0 ? n : 5) * 1000;
}

async function stopAll(): Promise<void> {
  const pids = [...groups];
  for (const pid of pids) signalGroup(pid, "SIGTERM");
  const limit = killWaitMs();
  let waited = 0;
  while (waited < limit && pids.some(isGroupAlive)) {
    await new Promise((r) => setTimeout(r, 100));
    waited += 100;
  }
  for (const pid of pids) {
    if (isGroupAlive(pid)) signalGroup(pid, "SIGKILL");
  }
}

// A terminal signal meant for the broker must not end the watchdog before
// it has done its job; only the channel closing ends it.
for (const sig of ["SIGINT", "SIGHUP", "SIGTERM"] as const) process.on(sig, () => {});

process.on("message", (message: unknown) => {
  if (typeof message !== "object" || message === null) return;
  const { op, pid } = message as { op?: unknown; pid?: unknown };
  if (typeof pid !== "number" || !Number.isInteger(pid) || pid <= 1) return;
  if (op === "track") groups.add(pid);
  else if (op === "untrack") groups.delete(pid);
});

process.on("disconnect", () => {
  stopAll().finally(() => process.exit(0));
});

if (!process.connected) process.exit(0);
