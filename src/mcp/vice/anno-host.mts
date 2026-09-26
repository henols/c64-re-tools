// anno-host.mts
//
// WHY THIS FILE EXISTS: the broker's handle on its annotation worker thread
// (anno-worker.mts). It starts the worker on the first request, matches each
// answer to its request, and turns a worker that dies into a named refusal
// for every request still waiting -- the next request starts a fresh worker.
//
// WHAT NOT TO DO:
//   - Never reject. Every failure resolves as an `internal` answer the
//     broker relays by name.
//   - Never run a request on the broker's own thread. The worker exists so a
//     long import or report never blocks relay and transfer traffic.
import { Worker } from "node:worker_threads";

import type { AnnoWorkerReply, AnnoWorkerRequest } from "./anno-worker.mts";

/** A request as the broker hands it over; the host assigns the id. */
export type AnnoHostRequest = Omit<AnnoWorkerRequest, "id">;

export interface AnnoHostOptions {
  /** The machine's annotation database; see broker-home.mts. */
  annoDbPath: string;
  /** Where the worker module lives. Defaults to the sibling beside this one:
   * the compiled `.mjs` in resources/, or the `.mts` source when this module
   * is loaded unbuilt. */
  workerUrl?: URL;
}

function defaultWorkerUrl(): URL {
  return new URL(import.meta.url.endsWith(".mts") ? "./anno-worker.mts" : "./anno-worker.mjs", import.meta.url);
}

export class AnnoHost {
  private worker: Worker | null = null;
  private readonly pending = new Map<number, (reply: AnnoWorkerReply) => void>();
  private nextId = 1;
  private readonly options: AnnoHostOptions;

  constructor(options: AnnoHostOptions) {
    this.options = options;
  }

  /** Answers one request. Never rejects. */
  run(request: AnnoHostRequest): Promise<AnnoWorkerReply> {
    const id = this.nextId++;
    return new Promise((resolve) => {
      this.pending.set(id, resolve);
      try {
        this.ensureWorker().postMessage({ ...request, id } satisfies AnnoWorkerRequest);
      } catch (err) {
        this.pending.delete(id);
        resolve({ id, ok: false, code: "internal", message: `the anno worker could not take the request (${err instanceof Error ? err.message : String(err)})` });
      }
    });
  }

  /** Stops the worker. Requests still waiting are answered `internal`. */
  async close(): Promise<void> {
    const worker = this.worker;
    this.worker = null;
    if (worker !== null) await worker.terminate();
    this.failPending("the broker is stopping");
  }

  private ensureWorker(): Worker {
    if (this.worker !== null) return this.worker;
    const worker = new Worker(this.options.workerUrl ?? defaultWorkerUrl(), { workerData: { annoDbPath: this.options.annoDbPath } });
    worker.on("message", (reply: AnnoWorkerReply) => {
      const resolve = this.pending.get(reply.id);
      if (resolve === undefined) return;
      this.pending.delete(reply.id);
      resolve(reply);
    });
    worker.on("error", (err) => {
      if (this.worker === worker) this.worker = null;
      this.failPending(`the anno worker failed (${err.message})`);
    });
    worker.on("exit", (code) => {
      if (this.worker === worker) this.worker = null;
      this.failPending(`the anno worker exited (code ${code})`);
    });
    this.worker = worker;
    return worker;
  }

  private failPending(message: string): void {
    for (const [id, resolve] of this.pending) resolve({ id, ok: false, code: "internal", message });
    this.pending.clear();
  }
}
