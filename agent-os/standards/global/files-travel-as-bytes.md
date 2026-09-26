# Files Travel as Bytes

A tool or skill script that works on a file the project owns (a program, disk
image, snapshot, source tree, analysis result) takes a path on the client
side. The client reads the file and streams its bytes to the broker. A path
never crosses the socket in either direction.

```ts
const localPath = resolve(path);                                  // client-side path
const staged = await brokerControl.stageFile({ targetId, slot }); // broker mints a handle
await transferFile({ direction: "upload", handle: staged.handle, sourcePath: localPath });
```

- The emulator or host tool must open a file: stage it (`stageFile` +
  `transferFile`), then pass the broker-minted name through verbatim
  (`vice_autostart`, `vice_disk_attach`, `vice_snapshot_load`, host tools).
- The bytes only need to land in emulator memory: send them in the monitor
  request itself (`vice_program_load` uses `MEM_SET`).
- Results come back the same way: download by handle into the project's
  `.c64-re-tools/<kind>/`.
- Never send a client path to the broker or the emulator, and never read a
  path the broker names. The broker's own state (epoch files, staging,
  Ghidra projects) is reached only through a reply on the socket.
- Never replace a path argument with a fixed list of known files. The caller
  names the file.
