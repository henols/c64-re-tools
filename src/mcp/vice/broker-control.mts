// broker-control.mts
//
// N / D-01 (plan 01, tracer): the framing, the token gate, and acquire/
// release. Plan 05 (task 1) completed the message set: recycle, status,
// host_state, the arrival-ordered pending-acquire structure, and the
// kernel-enforced singleton guard's low-level bind primitive. THIS PLAN's
// task 2 adds a SEVENTH and EIGHTH op, `monitor_claim`/`monitor_release`
// (BROK-02/PROTO-08, D-13): exclusive ownership of an instance's raw binmon
// socket, enforced here rather than left to a client-side heuristic --
// stock VICE services exactly one binmon client, and a second connect()
// produces no reply and no EOF, so the refusal must happen BEFORE any
// second dial is ever attempted. The subsystem's FIRST network listener: a
// TCP control plane replacing the bash broker's requests/grants/denials/
// leases directory tree entirely. One JSON object per line; the connection
// open IS the claim, connection close IS the release (T-01.6.2-01 through
// -09).
//
// Wire format confirmed at plan 01's blocking checkpoint:decision
// (2026-08-03, `as-specified`, no amendments -- see .planning/RE-FINDINGS.md
// for the full record, including the two accepted residual risks and the
// unix-domain-socket dead end). Auth: per-boot capability token compared
// constant-time, checked BEFORE any state read or write. Bind: 0.0.0.0
// explicitly, never 127.0.0.1 -- host.docker.internal is the bridge
// address, not loopback, so a loopback-only listener is structurally
// unreachable from the container. Port: 19510 default via
// VICE_BROKER_CONTROL_PORT.
import { createServer, type Server, type Socket } from "node:net";
import { timingSafeEqual, randomBytes } from "node:crypto";

export type ControlRequestKind = "acquire" | "release" | "recycle" | "status" | "host_state" | "monitor_claim" | "monitor_release";
export type ControlErrorCode = "unauthorized" | "bad_request" | "denied" | "no_free_port" | "at_capacity" | "internal" | "monitor_owned";

export interface ControlRequest {
  op: string;
  id?: string;
  token?: string;
  target_id?: string;
  [key: string]: unknown;
}

export interface AcquireGrant {
  port: number;
  url: string;
  epochFile: string;
  supervisorDir: string;
}

/** Discriminated acquire outcome (plan 05): the tracer's onAcquire used to
 * answer `AcquireGrant | null`, collapsing every failure into one
 * `internal` error. Criterion H's error vocabulary needs to tell
 * `no_free_port` (the port allocator is exhausted), `at_capacity` (the
 * instance ceiling is reached) and `launch_in_flight` (a launch is already
 * under way -- NOT a failure the caller should see; the control listener
 * queues the request instead, see enqueueAcquire()/drainPendingAcquires()
 * below) apart from a genuine `internal` fault. */
export type AcquireOutcome =
  | { ok: true; grant: AcquireGrant }
  | { ok: false; reason: "no_free_port" | "at_capacity" | "launch_in_flight" | "internal" };

/** The recycle acknowledgement's business fields, field-for-field the same
 * set resources/vice-broker.sh's write_recycle_ack() emits (id, target_id,
 * port, x64sc_pid, vice_bin, kill_stage, epoch_before, outcome, reason) --
 * `version`/`acked_at` are file-envelope fields with no equivalent need on a
 * live connection and are deliberately dropped. The outcome values a real
 * onRecycle() implementation produces are a SUBSET of the values
 * vice-proxy.ts's recycleAckOutcomeMessage() switches on (this plan does
 * not author the direct fairness/completeness proof of every switch case --
 * only the ones this broker's own recycle path can actually produce). */
export interface RecycleOutcome {
  port: number | null;
  pid: number | null;
  viceBin: string | null;
  killStage: string;
  epochBefore: number | null;
  outcome: string;
  reason: string;
}

export interface StatusInstanceEntry {
  port: number;
  url: string;
  state: string;
  reason: string;
  epoch: number | null;
  /** Plan 05: whether this instance currently has a claimed monitor client
   * (InstanceRecord.monitorClient set), computed on demand from the SAME
   * in-memory map every other status field reads. */
  hasMonitorClient: boolean;
}

/** The claim conflict's refusal payload (plan 05, T-02-18): names the
 * holding grant and its claim timestamp so a refusal is reported as an
 * ownership conflict, never as a wedged or unresponsive emulator.
 * `pid` mirrors GrantRecord.pid's own convention -- broker-state.mts's
 * InstanceRecord.monitorClient's own header comment explains why. */
export interface MonitorHolder {
  grantId: string;
  claimedAt: number;
  pid: number | null;
}

/** Discriminated outcome for `monitor_claim` (plan 05, D-13): resolved by
 * vice-broker.mts's own handleMonitorClaim(), which is the SOLE writer of
 * InstanceRecord.monitorClient on a successful claim. `monitor_owned` is a
 * distinct outcome from every other error -- it carries the holder's own
 * identity, because a refusal answered "someone else has it, and here is
 * who" is what makes this an ownership conflict rather than an unexplained
 * hang. */
export type MonitorClaimOutcome = { ok: true } | { ok: false; code: "monitor_owned"; holder: MonitorHolder } | { ok: false; code: "bad_request" | "internal" };

/** Discriminated outcome for `monitor_release` (plan 05, T-02-01): `denied`
 * is refused WITHOUT clearing the record -- a non-holder cannot release
 * someone else's claim. An already-cleared record (no current holder at
 * all) is tolerated as a success, matching the container-side client's own
 * documented tolerance for releasing twice. */
export type MonitorReleaseOutcome = { ok: true } | { ok: false; code: "denied" | "bad_request" | "internal" };

export interface HostStateFields {
  pid: number;
  startedAt: string;
  nodeVersion: string;
  viceBin: string;
  warmFloor: number;
  maxInstances: number;
  basePort: number;
  /** WR-04: the backend verdict THIS broker resolved at startup -- the one that
   * actually decided the emulator's launch argv. Put on the wire because the
   * container-side proxy performs its OWN resolvedBackend() against the
   * CONTAINER's filesystem, where there is usually no x64sc at all, so it
   * classifies `unknown` -> `{ backend: "fork", source: "indeterminate" }`. D-01's
   * "one reader" property holds per process but not across the pair, and a
   * mismatch was previously neither detected nor reported: the proxy would
   * advertise the fork's full manifest and forward HTTP at a binary-monitor
   * port. This field is what lets the proxy detect that disagreement instead of
   * discovering it as a transport failure. */
  backend: "fork" | "stock";
}

export interface StartControlListenerOptions {
  host?: string;
  port?: number;
  token: string;
  /** Called on `acquire`, AFTER the token check has already passed. See
   * AcquireOutcome's own header comment for the discriminated shape. */
  onAcquire: (requestId: string) => Promise<AcquireOutcome>;
  /** Called on an explicit `release` request AND on connection close
   * (whichever happens first) -- the kernel enforces the release including
   * on the client's own SIGKILL, since close always fires either way. */
  onRelease: (requestId: string) => void;
  /** Called on `recycle`, ONLY after this listener has already confirmed the
   * requesting connection holds the named target grant (T-01.6.2-31) -- a
   * connection may only ever recycle the grant it itself holds; anything
   * else is answered `denied` without this callback ever being invoked, so
   * an injected kill/signal recorder observes nothing for a mismatched
   * target. */
  onRecycle: (targetId: string) => Promise<RecycleOutcome>;
  /** Called on `status` -- answers the question the dropped
   * broker-instances.json projection used to answer (D-24), computed on
   * demand. Synchronous: this broker holds every instance in one in-memory
   * map already (C4), so there is nothing to await. */
  onStatus: () => StatusInstanceEntry[];
  /** Called on `host_state` -- answers questions about the HOST, not about
   * instances (the retiring status subcommand's own host-facing half).
   * Neither this response nor the status response may ever carry the
   * capability token (T-01.6.2-32) -- this module never puts it there. */
  onHostState: () => HostStateFields;
  /** Called on `monitor_claim`, AFTER the token check has already passed --
   * the SAME gate every other op runs, checked before any state is read or
   * written (plan 05, T-02-16). `requestId` is this specific claim request's
   * own correlation id; `targetId` both resolves which instance is being
   * claimed (the same way onRecycle's targetId resolves its own target) AND
   * is the claiming identity compared against a conflicting holder -- see
   * vice-broker.mts's handleMonitorClaim() for the resolution and
   * idempotency rules. */
  onMonitorClaim: (requestId: string, targetId: string) => MonitorClaimOutcome;
  /** Called on `monitor_release`, under the same token gate. Clearing is
   * refused (not silently accepted) when `targetId` names a grant that is
   * NOT the current holder -- see MonitorReleaseOutcome's own header
   * comment for the already-cleared tolerance. */
  onMonitorRelease: (requestId: string, targetId: string) => MonitorReleaseOutcome;
}

export interface StartControlListenerResult {
  server: Server;
  port: number;
  host: string;
  /** The arrival-ordered pending-acquire structure for THIS listener
   * instance -- append-on-receipt, drain-from-the-front, nothing sorts or
   * re-orders it (D-08's mechanism; the direct FIFO fairness PROOF is
   * deliberately left to Phase 01.6.2.1, per this module's own comment on
   * drainPendingAcquires() below). Exposed so the real broker's own
   * periodic evaluation pass (vice-broker.mts's runBrokerPass) can drain it
   * -- this is what plan 02's `serveAcquires: () => {}` no-op placeholder
   * comment was reserving room for. */
  pendingAcquires: PendingAcquireQueue;
}

export type ControlResponse =
  | { kind: "grant"; id: string; port: number; url: string; epoch_file: string; supervisor_dir: string }
  | { kind: "released" }
  | {
      kind: "recycle_ack";
      id: string;
      target_id: string;
      port: number | null;
      x64sc_pid: number | null;
      vice_bin: string | null;
      kill_stage: string;
      epoch_before: number | null;
      outcome: string;
      reason: string;
    }
  | { kind: "status"; instances: StatusInstanceEntry[] }
  | {
      kind: "host_state";
      pid: number;
      started_at: string;
      node_version: string;
      vice_bin: string;
      warm_floor: number;
      max_instances: number;
      base_port: number;
      /** WR-04: see HostStateFields.backend for why this is on the wire. */
      backend: "fork" | "stock";
    }
  | { kind: "monitor_claimed" }
  | { kind: "monitor_released" }
  // `holder` is optional and populated ONLY for code "monitor_owned" --
  // every other op's error reuses this exact same variant with `holder`
  // omitted (plan 05 extends the existing seam rather than inventing a
  // parallel channel for the one op that needs an extra field).
  | { kind: "error"; code: ControlErrorCode; message: string; holder?: MonitorHolder };

/** 32 cryptographically random bytes rendered as hex -- the per-boot
 * capability token. Held in memory only by the caller; written once into
 * broker.json and never logged, never included in an error message
 * (T-01.6.2-02). */
export function newControlToken(): string {
  return randomBytes(32).toString("hex");
}

const MAX_LINE_BYTES = 65536;

/** CR-03: the one refusal wording for a target-naming op whose `target_id` is
 * not the grant the asking connection itself holds. Deliberately worded as an
 * authorisation refusal and NOT as an ownership conflict between two
 * legitimate holders (`monitor_owned`, which names a holder) and never as an
 * emulator fault -- see attachControlProtocol()'s own ownsTarget() comment,
 * and T-02-18's prohibition on wedge/hang vocabulary in this file's
 * monitor-op refusals. */
const MONITOR_OWNERSHIP_DENIAL =
  "monitor_claim/monitor_release may only target the grant this connection itself holds";

export function resolveControlPort(override?: number): number {
  if (typeof override === "number") return override;
  const raw = process.env.VICE_BROKER_CONTROL_PORT;
  if (raw === undefined || raw === "") return 19510;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 19510;
}

/** Constant-time token comparison over EQUAL-LENGTH buffers -- an
 * unequal-length comparison is refused without ever calling
 * timingSafeEqual (which throws on a length mismatch), so the length check
 * itself leaks nothing beyond what a fixed-length comparison already
 * would not avoid. */
function tokensMatch(candidate: string, expected: string): boolean {
  const a = Buffer.from(candidate, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function writeLine(socket: Socket, obj: ControlResponse): void {
  if (socket.writable) {
    socket.write(`${JSON.stringify(obj)}\n`);
  }
}

function defaultRequestId(prefix: string): string {
  return `${prefix}-${process.pid}-${Date.now()}`;
}

// ---------------------------------------------------------------------------
// Arrival-ordered pending-acquire structure (D-08's mechanism, not its
// fairness proof -- see drainPendingAcquires()'s own header comment).
// ---------------------------------------------------------------------------

export interface PendingAcquireEntry {
  requestId: string;
  /** Retries the acquire once, over the SAME original connection. Resolves
   * `true` once this entry is fully settled (either served, or answered
   * with a terminal error, or its connection is gone) and should be removed
   * for good; resolves `false` when the launch is STILL in flight and this
   * entry must be tried again on a later pass. */
  attempt: () => Promise<boolean>;
}

export type PendingAcquireQueue = PendingAcquireEntry[];

/** Appends to the BACK of the queue -- the only mutation this structure
 * ever performs on receipt. Nothing here sorts or re-orders; arrival order
 * falls out of the array's own insertion order. */
export function enqueueAcquire(queue: PendingAcquireQueue, entry: PendingAcquireEntry): void {
  queue.push(entry);
}

/** Drains the queue from the front, strictly in the order this CALL found
 * them: takes a snapshot of everything currently pending (`splice`, never a
 * sort), then attempts each in that order. An entry whose launch is still
 * in flight is pushed back onto the queue for the NEXT drain pass rather
 * than retried immediately in a tight loop -- a later-arriving acquire that
 * queued behind it during THIS pass is not overtaken (it is appended after
 * the requeued entry, never before), so the array never needs re-ordering
 * to stay correct; a genuinely adversarial retry pattern could still starve
 * an entry across MULTIPLE passes, which is exactly the direct fairness
 * proof this module deliberately does not author -- injecting N acquires
 * and asserting grants return in that order is Phase 01.6.2.1's D-08
 * deliverable. The original defect this queue replaces (a lexical iteration
 * over `req-<pid>-<ms>-<hex>` filenames) cannot exist here regardless: there
 * is no file, and no re-ordering call of any kind anywhere in this region. */
export async function drainPendingAcquires(queue: PendingAcquireQueue): Promise<void> {
  const snapshot = queue.splice(0, queue.length);
  for (const entry of snapshot) {
    const settled = await entry.attempt();
    if (!settled) {
      queue.push(entry);
    }
  }
}

// ---------------------------------------------------------------------------
// Bind (low-level, no protocol) -- kept separate from startControlListener()
// so a test can occupy a real port with a plain, non-broker listener (task
// 3's singleton-guard tests) without pulling in this module's own protocol
// handling.
// ---------------------------------------------------------------------------

export interface BoundListener {
  server: Server;
  port: number;
  host: string;
}

/** Binds a bare TCP listener with NO protocol wired up -- no token check, no
 * request handling, nothing. `startControlListener()` below calls this
 * internally and then attaches the real protocol; a test wanting to occupy
 * a control port with "something that is not a broker" (the loud singleton
 * path's own fixture) can call this directly and never see anything that
 * looks like this broker's wire format. */
export function bindControlListener(host: string, port: number): Promise<BoundListener> {
  return new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.on("error", reject);
    server.listen(port, host, () => {
      const addr = server.address();
      const boundPort = typeof addr === "object" && addr !== null ? addr.port : port;
      resolvePromise({ server, port: boundPort, host });
    });
  });
}

/** Attaches the newline-delimited-JSON protocol (framing, token gate, all
 * five request kinds) to an ALREADY-BOUND server. Split out of
 * startControlListener() so the bind step and the protocol-wiring step are
 * two separately callable primitives -- the real broker still calls
 * startControlListener() as one step (this function is not part of its own
 * public surface); this module's own tests exercise the two independently. */
function attachControlProtocol(server: Server, opts: StartControlListenerOptions, pendingAcquires: PendingAcquireQueue): void {
  server.on("connection", (socket: Socket) => {
    let buffer = "";
    let requestIdForThisConnection: string | null = null;

    socket.on("data", (chunk: Buffer) => {
      buffer += chunk.toString("utf8");
      if (Buffer.byteLength(buffer, "utf8") > MAX_LINE_BYTES) {
        socket.destroy();
        return;
      }
      let newlineIdx: number;
      while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, newlineIdx);
        buffer = buffer.slice(newlineIdx + 1);
        handleLine(line);
      }
    });

    socket.on("close", () => {
      // Connection close IS the release -- including on the client's own
      // SIGKILL, since "close" always fires either way. Idempotent: an
      // explicit `release` already having cleared
      // requestIdForThisConnection makes this a no-op.
      if (requestIdForThisConnection) {
        const id = requestIdForThisConnection;
        requestIdForThisConnection = null;
        opts.onRelease(id);
      }
    });

    socket.on("error", () => {
      // Per-connection error handling isolates one peer's failure from
      // every other connection and from the server itself (T-01.6.2-06).
    });

    /**
     * CR-03 (code review 2026-08-13). THE per-connection ownership predicate
     * every target-naming op is gated on -- the same rule `recycle` has
     * enforced since T-01.6.2-31, now shared rather than copied.
     *
     * Before this existed, `monitor_claim`/`monitor_release` took `target_id`
     * from the request and passed it straight through, so any connection
     * holding the per-boot control token (which every container-side proxy
     * sharing this broker does) could name ANOTHER session's grant id.
     * vice-broker.mts's handleMonitorClaim() uses that id as BOTH the target
     * and the claiming identity, and handleMonitorRelease()'s "only the
     * holder may release" check compared the request against itself -- so
     * session B could lock session A out of its own monitor socket, or
     * RELEASE A's live claim, after which a third client was free to dial the
     * same single-client binmon socket. That is precisely the unserviced-
     * backlog state D-13 exists to prevent and that CLAUDE.md says must never
     * be reachable.
     *
     * WHAT NOT TO DO: never add another op that acts on a caller-supplied
     * `target_id` without gating it here first. The grant a connection holds
     * is the ONLY identity this protocol has -- `target_id` is a request
     * field, not a credential.
     */
    function ownsTarget(targetId: string): boolean {
      return requestIdForThisConnection !== null && targetId === requestIdForThisConnection;
    }

    /** Attempts one acquire over THIS connection/socket, writing the
     * terminal response (grant or a non-queueing error) when settled, or
     * enqueueing itself and returning unsettled when a launch is already in
     * flight. Shared by the immediate first attempt and every later retry
     * `drainPendingAcquires()` drives, so the two paths can never answer
     * differently for the same requestId.
     *
     * Gap closure (plan 14, WR-03/T-01.6.2-87/-88): two destroyed-socket
     * checks guard a grant against outliving the connection that owns it,
     * and they bound TWO DIFFERENT failures -- do not conflate them into one
     * claim.
     *
     * Half one -- the pre-check immediately below, BEFORE onAcquire() is
     * ever called -- closes the ALWAYS-REACHABLE leak: a client that
     * disconnects while queued leaves its entry pending (nothing removes it,
     * since it never held a grant id to release), and the next drain pass
     * would otherwise call the launch callback anyway -- which on the real
     * broker allocates a port, spawns a real child, writes an epoch record
     * and records a grant that no connection owns. This half turns that
     * always-reachable leak into a bounded race (half two, below).
     *
     * Half two -- the release-on-late-grant branch on the success path --
     * bounds the NARROW race the pre-check cannot close: a disconnect
     * landing between the pre-check passing and onAcquire()'s own
     * completion. This half does NOT eliminate that race -- it cannot, the
     * pre-check and the callback are separated by a real await -- it turns
     * the race from a leak into a reclaim, by invoking the existing release
     * callback with the same request id instead of silently dropping the
     * grant it produced.
     */
    function attemptAcquire(requestId: string): Promise<boolean> {
      // Half one: a queued entry whose owning socket is already gone is
      // settled immediately, WITHOUT ever calling onAcquire() -- this is
      // what keeps a retried drain pass from performing a real, ownerless
      // launch.
      if (socket.destroyed) return Promise.resolve(true);
      return opts
        .onAcquire(requestId)
        .then((outcome) => {
          if (outcome.ok) {
            // Half two: the pre-check above ran before this call; a
            // disconnect landing DURING the await is still possible and is
            // bounded, not eliminated, here -- a grant that settles for a
            // socket that is now gone is released through the existing
            // release path rather than dropped.
            if (socket.destroyed) {
              opts.onRelease(requestId);
              return true;
            }
            requestIdForThisConnection = requestId;
            writeLine(socket, {
              kind: "grant",
              id: requestId,
              port: outcome.grant.port,
              url: outcome.grant.url,
              epoch_file: outcome.grant.epochFile,
              supervisor_dir: outcome.grant.supervisorDir,
            });
            return true;
          }
          if (outcome.reason === "launch_in_flight") {
            return false; // still blocked -- caller re-queues
          }
          if (socket.destroyed) return true; // no grant was produced -- nothing to release, nothing left to answer
          const code: ControlErrorCode = outcome.reason === "internal" ? "internal" : outcome.reason;
          writeLine(socket, { kind: "error", code, message: `acquire failed: ${outcome.reason}` });
          return true;
        })
        .catch(() => {
          if (!socket.destroyed) {
            writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "acquire threw" });
          }
          return true;
        });
    }

    function handleLine(line: string): void {
      if (line.trim() === "") return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "malformed JSON line" });
        return;
      }
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "request must be a JSON object" });
        return;
      }
      const req = parsed as ControlRequest;

      // Token check BEFORE any state is read or written -- absence or
      // mismatch is refused, the connection is destroyed, and nothing is
      // allocated, spawned or signalled (T-01.6.2-01, T-01.6.2-03).
      const token = typeof req.token === "string" ? req.token : "";
      if (!tokensMatch(token, opts.token)) {
        writeLine(socket, { kind: "error", code: "unauthorized" as ControlErrorCode, message: "missing or invalid control token" });
        socket.destroy();
        return;
      }

      if (req.op === "acquire") {
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("req");
        void attemptAcquire(requestId).then((settled) => {
          if (!settled) {
            enqueueAcquire(pendingAcquires, { requestId, attempt: () => attemptAcquire(requestId) });
          }
        });
      } else if (req.op === "release") {
        if (requestIdForThisConnection) {
          const id = requestIdForThisConnection;
          requestIdForThisConnection = null;
          opts.onRelease(id);
        }
        writeLine(socket, { kind: "released" });
      } else if (req.op === "recycle") {
        const recycleId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("recycle");
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        // T-01.6.2-31: a connection may only recycle the grant IT ITSELF
        // holds. This check happens here, before onRecycle() is ever
        // called, so a mismatched target never reaches the kill discipline
        // and never signals anything -- an injected signal recorder stays
        // empty for this case. Now expressed through the SAME ownsTarget()
        // predicate monitor_claim/monitor_release use (CR-03), so the three
        // target-naming ops cannot drift apart.
        if (!ownsTarget(targetId)) {
          writeLine(socket, {
            kind: "error",
            code: "denied" as ControlErrorCode,
            message: "recycle may only target the grant this connection itself holds",
          });
          return;
        }
        opts
          .onRecycle(targetId)
          .then((result) => {
            writeLine(socket, {
              kind: "recycle_ack",
              id: recycleId,
              target_id: targetId,
              port: result.port,
              x64sc_pid: result.pid,
              vice_bin: result.viceBin,
              kill_stage: result.killStage,
              epoch_before: result.epochBefore,
              outcome: result.outcome,
              reason: result.reason,
            });
          })
          .catch(() => {
            writeLine(socket, { kind: "error", code: "internal" as ControlErrorCode, message: "recycle threw" });
          });
      } else if (req.op === "status") {
        writeLine(socket, { kind: "status", instances: opts.onStatus() });
      } else if (req.op === "host_state") {
        const hs = opts.onHostState();
        writeLine(socket, {
          kind: "host_state",
          pid: hs.pid,
          started_at: hs.startedAt,
          node_version: hs.nodeVersion,
          vice_bin: hs.viceBin,
          warm_floor: hs.warmFloor,
          max_instances: hs.maxInstances,
          base_port: hs.basePort,
          backend: hs.backend,
        });
      } else if (req.op === "monitor_claim") {
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        if (targetId === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_claim requires target_id" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
          return;
        }
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("claim");
        const outcome = opts.onMonitorClaim(requestId, targetId);
        if (outcome.ok) {
          writeLine(socket, { kind: "monitor_claimed" });
        } else if (outcome.code === "monitor_owned") {
          // Ownership conflict, named by holder -- deliberately worded to
          // never suggest the emulator itself has stopped answering
          // (T-02-18; the plan's own grep gate polices this).
          //
          // WR-08 (broker side): `holder` is REQUIRED by MonitorClaimOutcome for
          // this code, but this handler runs inside socket.on("data") with no
          // try/catch above it, so a producer that ever omitted it would throw a
          // TypeError out of the control listener and take the broker process
          // with it -- a type contract is not a runtime guarantee at a wire
          // boundary. The fallback names the holder as unknown rather than
          // fabricating one, matching what the container-side client now does
          // with a malformed holder payload.
          const holder = outcome.holder ?? { grantId: "unknown", claimedAt: 0, pid: null };
          writeLine(socket, {
            kind: "error",
            code: "monitor_owned",
            message: `instance already has a monitor client (grant ${holder.grantId}, claimed at ${holder.claimedAt}) -- this is an ownership conflict, not an emulator failure`,
            holder,
          });
        } else {
          writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_claim failed: ${outcome.code}` });
        }
      } else if (req.op === "monitor_release") {
        const targetId = typeof req.target_id === "string" ? req.target_id : "";
        if (targetId === "") {
          writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: "monitor_release requires target_id" });
          return;
        }
        if (!ownsTarget(targetId)) {
          writeLine(socket, { kind: "error", code: "denied" as ControlErrorCode, message: MONITOR_OWNERSHIP_DENIAL });
          return;
        }
        const requestId = typeof req.id === "string" && req.id !== "" ? req.id : defaultRequestId("release-monitor");
        const outcome = opts.onMonitorRelease(requestId, targetId);
        if (outcome.ok) {
          writeLine(socket, { kind: "monitor_released" });
        } else {
          writeLine(socket, { kind: "error", code: outcome.code, message: `monitor_release refused: ${outcome.code}` });
        }
      } else {
        writeLine(socket, { kind: "error", code: "bad_request" as ControlErrorCode, message: `unknown op: ${String(req.op)}` });
      }
    }
  });
}

/** Starts the TCP control listener: binds (bindControlListener()), then
 * attaches the full newline-delimited-JSON protocol (attachControlProtocol()
 * above) -- all five request kinds, the token gate, and the arrival-ordered
 * pending-acquire queue this listener instance owns. Frames inbound bytes as
 * newline-delimited JSON: buffers, splits on "\n", parses each line with
 * the never-throw posture this codebase already uses for untrusted input --
 * a malformed line answers `bad_request` and the connection survives. A
 * connection exceeding MAX_LINE_BYTES without a newline is destroyed rather
 * than buffered further (T-01.6.2-04). */
export function startControlListener(opts: StartControlListenerOptions): Promise<StartControlListenerResult> {
  const host = opts.host ?? process.env.VICE_BROKER_CONTROL_HOST ?? "0.0.0.0";
  const port = resolveControlPort(opts.port);

  return bindControlListener(host, port).then((bound) => {
    const pendingAcquires: PendingAcquireQueue = [];
    attachControlProtocol(bound.server, opts, pendingAcquires);
    return { server: bound.server, port: bound.port, host: bound.host, pendingAcquires };
  });
}
