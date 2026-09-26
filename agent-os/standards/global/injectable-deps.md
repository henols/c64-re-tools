# Injectable Deps

A module that touches processes, sockets, clocks or the filesystem
takes an optional `XDeps` object. Each field defaults to the real one:

```ts
export interface VerifiedKillDeps {
  isAlive?: (pid: number) => boolean;
  kill?: (pid: number, signal: NodeJS.Signals) => void;
  sleepMs?: (ms: number) => Promise<void>;
}

const isAlive = deps.isAlive ?? defaultIsAlive;
const kill = deps.kill ?? defaultKill;
```

- Production call sites pass no deps.
- Tests inject fakes for the side-effecting leaves only. Never stub the
  function under test or the seam that wires it.
- Paths get an explicit `dir` override so tests never write the real
  machine-level root.
