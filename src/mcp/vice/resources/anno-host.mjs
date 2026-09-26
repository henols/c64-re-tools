// GENERATED FILE -- DO NOT EDIT.
// Compiled by `tsc` from anno-host.mts. Edit the TypeScript source and rebuild;
// changes made directly to this file are silently overwritten by the next build, and are never
// deployed to the host on their own -- install-resources.mjs copies THIS file's on-disk contents
// verbatim to .c64-re-tools/bin/, so an edit made only here reaches the host but is lost on the very next
// rebuild.
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
function defaultWorkerUrl() {
    return new URL(import.meta.url.endsWith(".mts") ? "./anno-worker.mts" : "./anno-worker.mjs", import.meta.url);
}
export class AnnoHost {
    worker = null;
    pending = new Map();
    nextId = 1;
    options;
    constructor(options) {
        this.options = options;
    }
    /** Answers one request. Never rejects. */
    run(request) {
        const id = this.nextId++;
        return new Promise((resolve) => {
            this.pending.set(id, resolve);
            try {
                this.ensureWorker().postMessage({ ...request, id });
            }
            catch (err) {
                this.pending.delete(id);
                resolve({ id, ok: false, code: "internal", message: `the anno worker could not take the request (${err instanceof Error ? err.message : String(err)})` });
            }
        });
    }
    /** Stops the worker. Requests still waiting are answered `internal`. */
    async close() {
        const worker = this.worker;
        this.worker = null;
        if (worker !== null)
            await worker.terminate();
        this.failPending("the broker is stopping");
    }
    ensureWorker() {
        if (this.worker !== null)
            return this.worker;
        const worker = new Worker(this.options.workerUrl ?? defaultWorkerUrl(), { workerData: { annoDbPath: this.options.annoDbPath } });
        worker.on("message", (reply) => {
            const resolve = this.pending.get(reply.id);
            if (resolve === undefined)
                return;
            this.pending.delete(reply.id);
            resolve(reply);
        });
        worker.on("error", (err) => {
            if (this.worker === worker)
                this.worker = null;
            this.failPending(`the anno worker failed (${err.message})`);
        });
        worker.on("exit", (code) => {
            if (this.worker === worker)
                this.worker = null;
            this.failPending(`the anno worker exited (code ${code})`);
        });
        this.worker = worker;
        return worker;
    }
    failPending(message) {
        for (const [id, resolve] of this.pending)
            resolve({ id, ok: false, code: "internal", message });
        this.pending.clear();
    }
}
