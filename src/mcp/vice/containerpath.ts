#!/usr/bin/env node
// Build a CONTAINER path from something a HOST-side process handed back to
// us in host-filesystem terms.
//
// This is the INVERSE of hostpath.ts's outbound direction. hostpath.ts
// solves "I have a container path and need to hand it to something running
// on the host" -- container -> host. This file solves the opposite: "a
// host-side process handed ME a path (or a URL naming a loopback host) in
// ITS OWN terms, and I need the container-side equivalent to actually open
// it" -- host -> container.
//
// This direction did not exist until Phase 01.2's on-demand VICE broker
// started handing this container back its OWN grant records: the broker
// runs on the host, legitimately resolves its own repo root, and writes a
// grant carrying a loopback `url` plus host-rooted `epoch_file` and
// `supervisor_dir` fields (its own view of the filesystem -- entirely
// correct from where it's standing). Until this module existed, nothing
// inverted those coordinates before they were adopted as the session's
// identity: loopback meant the CONTAINER's own loopback (ECONNREFUSED, since
// nothing listens there), and the host-rooted epoch path simply didn't
// resolve inside the container. Every broker-granted instance was silently
// unreachable -- see
// .planning/quick/260801-ccn-translate-broker-granted-host-coordinate/260801-ccn-PLAN.md's
// "The bug" section for the full, already-root-caused failure shape this
// module fixes.
//
// Mirrors hostpath.ts deliberately: the same derive-never-hardcode rule
// (the mapping is never written down as a literal -- see hostRootCandidates()
// below), the same `{ candidates, exact?, reason? }` return contract, the
// same throw-with-the-env-hint contract, the same CLI-at-the-bottom guard.
// What this file does NOT know: which FIELDS a grant record carries, or what
// the container-visible host alias is -- that is broker-protocol knowledge
// that belongs at the one seam that sees every grant as written
// (vice-proxy.mjs's containerizeGrant()), not duplicated here. This module
// only ever answers "given a host path or a URL naming a host, what is its
// container-side equivalent" -- nothing more, so it stays a generic
// host<->container primitive rather than a second copy of broker knowledge.
import { hostPathCandidates, SET_ENV_HINT } from "./hostpath.ts";
import { repoRoot } from "./repo-root.ts";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

export { SET_ENV_HINT };

const HERE = dirname(fileURLToPath(import.meta.url));
// Same derivation and the same env override hostpath.ts's own
// WORKSPACE_ROOT/CONTAINER_WS use -- this file lives beside it, so the two
// must always agree; this is not a second, possibly-diverging copy, just the
// same resolution applied to this file's own location. Both dropped their
// hard-coded four-level hop when they moved here from
// .claude/skills/devcontainer-host-path/scripts/, where that count was
// correct; see hostpath.ts's note on why a fixed count is the wrong shape.
const WORKSPACE_ROOT = repoRoot({ from: HERE });
const CONTAINER_WS = process.env.CONTAINER_WORKSPACE_PATH || WORKSPACE_ROOT;

// Matched structurally (127.0.0.0/8 in full, "localhost", and the IPv6
// loopback exactly as the WHATWG URL parser itself renders `.hostname` --
// bracketed, "[::1]"), never against the single "127.0.0.1" literal this bug
// was actually observed with (D-4).
const IPV4_LOOPBACK_RE = /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;

function isLoopbackHostname(hostname: string): boolean {
  return hostname === "localhost" || hostname === "[::1]" || IPV4_LOOPBACK_RE.test(hostname);
}

/** hostRootCandidates()'s own return shape: `roots` the cleaned, de-duplicated,
 * longest-first list of candidate host root paths, `exact` true only when the
 * sibling's own hostPathCandidates() came back with an exact (env-derived)
 * match needing no adjudication. */
export interface HostRootCandidatesResult {
  roots: string[];
  exact: boolean;
}

/**
 * The container workspace root's own candidate HOST paths -- from
 * `hostPathCandidates()`, the sibling's own outbound derivation, never
 * duplicated here (this is the whole of D-3: the mapping is derived at
 * runtime off the sibling's own knowledge, and no absolute host path is ever
 * written down in this file, checked by containerpath.test.ts's own
 * runtime-derived source assertion). Cleaned up for use as a match prefix: a
 * trailing separator stripped (hostPathCandidates() for the workspace root
 * itself returns a candidate with one, since its template joins an empty
 * relative tail), de-duplicated, and sorted LONGEST-first so a short or
 * empty guess prefix can never shadow a longer, more specific one when
 * matching a host path below.
 */
export function hostRootCandidates(): HostRootCandidatesResult {
  const { candidates, exact } = hostPathCandidates(CONTAINER_WS, { workspaceRoot: WORKSPACE_ROOT });
  const cleaned = [...new Set(candidates.map((c) => c.replace(/\/+$/, "")).filter((c) => c.length > 0))];
  cleaned.sort((a, b) => b.length - a.length);
  return { roots: cleaned, exact: Boolean(exact) };
}

/** containerPathCandidates()'s own return shape, mirroring hostpath.ts's
 * HostPathCandidatesResult with `raw` in place of `abs`: there is nothing to
 * resolve against this container's cwd, the input is already host-absolute
 * or it is not translatable at all. `raw` is `unknown` rather than `string`
 * because this module's whole job is judging host-side input that may not
 * even be a path string -- see the non-absolute-input branch below. */
export interface ContainerPathCandidatesResult {
  raw: unknown;
  candidates: string[];
  exact?: boolean;
  reason?: string;
}

/**
 * Candidate CONTAINER paths for a HOST-side path string, best first.
 * Returns `{ raw, candidates, exact?, reason? }` -- the sibling's own shape
 * (`raw` in place of `abs`: there is nothing to resolve against this
 * container's cwd, the input is already host-absolute or it is not
 * translatable at all).
 *
 * STATED RESIDUAL, matching hostpath.ts's own for its direction: a
 * non-absolute string is left alone, never guessed at -- indistinguishable
 * from a non-path value without guessing, and guessing would be a worse
 * failure than leaving it untranslated.
 */
export function containerPathCandidates(hostish: unknown): ContainerPathCandidatesResult {
  if (typeof hostish !== "string" || !hostish.startsWith("/")) {
    return {
      raw: hostish,
      candidates: [],
      reason:
        "not an absolute host-style path -- relative strings are deliberately untouched " +
        "(mirrors hostpath.ts's own stated residual for its own direction).",
    };
  }
  const { roots, exact } = hostRootCandidates();
  const candidates: string[] = [];
  for (const root of roots) {
    if (hostish === root || hostish.startsWith(`${root}/`)) {
      const tail = hostish.slice(root.length);
      candidates.push(resolve(`${CONTAINER_WS}${tail}`));
    }
  }
  const deduped = [...new Set(candidates)];
  if (!deduped.length) {
    return {
      raw: hostish,
      candidates: [],
      reason: `${hostish} does not match any known host root -- translation is impossible, not merely unknown.`,
    };
  }
  return exact ? { raw: hostish, candidates: deduped, exact: true } : { raw: hostish, candidates: deduped };
}

/** The single best container path, or throw with the reason plus the env
 * hint -- exactly as the sibling's hostPath() does. */
export function containerPath(hostish: unknown): string {
  const { candidates, reason, raw } = containerPathCandidates(hostish);
  if (!candidates.length) {
    throw new Error(`${reason || `cannot determine a container path for ${String(raw)}`}\n  Or ${SET_ENV_HINT}`);
  }
  return candidates[0];
}

/**
 * Rewrite a loopback hostname in `urlString` to `alias`, preserving scheme,
 * port and path. Byte-identical passthrough for anything else: a
 * non-loopback host is NEVER re-pointed (D-4 -- a bad grant must never be
 * able to aim a session at an arbitrary endpoint just because it happened to
 * hand back some other hostname), and a string that does not parse as a URL
 * at all is returned exactly as given.
 */
export function containerHost(urlString: string, alias: string): string {
  let url: URL;
  try {
    url = new URL(urlString);
  } catch {
    return urlString;
  }
  if (!isLoopbackHostname(url.hostname)) {
    return urlString;
  }
  url.hostname = alias;
  return url.toString();
}

/** containerizeRecord()'s options -- the FIELD LIST is supplied by the
 * caller deliberately (D-7), so `pathFields`/`urlFields` default to empty
 * arrays. `alias` is required: every real caller (vice-proxy.mjs's
 * containerizeGrant()) and every test in this suite always supplies one, so
 * typing it as mandatory here costs nothing in practice (the same
 * cost-free-tightening call Plan 03 made for install-resources.ts's
 * resourcesStatus() -- see that plan's SUMMARY). */
export interface ContainerizeRecordOptions {
  pathFields?: string[];
  urlFields?: string[];
  alias: string;
}

/** One field actually rewritten by containerizeRecord(). */
export interface ContainerizeRecordChange {
  field: string;
  from: unknown;
  to: unknown;
}

/** One field left alone by containerizeRecord(), with the reason why. */
export interface ContainerizeRecordUntranslated {
  field: string;
  value: unknown;
  reason: string;
}

/** containerizeRecord()'s return shape: a NEW record (the input is never
 * mutated), plus the changed and untranslated field lists. */
export interface ContainerizeRecordResult {
  record: Record<string, unknown>;
  changes: ContainerizeRecordChange[];
  untranslated: ContainerizeRecordUntranslated[];
}

/**
 * Pure, never-throwing translation of a host-written record: `pathFields`
 * go through containerPath(), `urlFields` through containerHost() with
 * `alias`. Returns a NEW record -- the input is never mutated -- plus
 * `changes` (`{ field, from, to }`, one per field actually rewritten) and
 * `untranslated` (`{ field, value, reason }`, one per field left alone
 * because it was already container-shaped, matched no known host root, or
 * wasn't a loopback host / parseable URL). Absent and non-string fields are
 * silently skipped -- never a throw, never reported either way.
 *
 * The FIELD LIST is supplied by the caller deliberately (D-7): which fields
 * a grant record carries is broker-specific knowledge, and keeping it out of
 * this module is what keeps this a generic host<->container primitive
 * rather than a broker-protocol module wearing a generic name.
 */
export function containerizeRecord(
  record: Record<string, unknown> | undefined,
  { pathFields = [], urlFields = [], alias }: ContainerizeRecordOptions
): ContainerizeRecordResult {
  const out: Record<string, unknown> = { ...(record || {}) };
  const changes: ContainerizeRecordChange[] = [];
  const untranslated: ContainerizeRecordUntranslated[] = [];

  for (const field of pathFields) {
    const value = record ? record[field] : undefined;
    if (typeof value !== "string") continue; // absent/non-string -- skip silently
    let translated: string;
    try {
      translated = containerPath(value);
    } catch (e) {
      untranslated.push({ field, value, reason: (e as Error).message });
      continue;
    }
    out[field] = translated;
    if (translated !== value) {
      changes.push({ field, from: value, to: translated });
    } else {
      untranslated.push({ field, value, reason: "already container-shaped -- no translation needed" });
    }
  }

  for (const field of urlFields) {
    const value = record ? record[field] : undefined;
    if (typeof value !== "string") continue;
    const translated = containerHost(value, alias);
    out[field] = translated;
    if (translated !== value) {
      changes.push({ field, from: value, to: translated });
    } else {
      untranslated.push({ field, value, reason: "not a loopback host, or not a parseable URL -- left unchanged" });
    }
  }

  return { record: out, changes, untranslated };
}

// -------------------------------------------------------------------- CLI

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h") || argv.length === 0) {
    console.log(`usage: node containerpath.ts <host-path...>

Print the container-side path(s) for host filesystem paths handed back by a
host-side process (e.g. the on-demand VICE broker's grant records), best
first, one per line -- the inverse of hostpath.ts.

env: CONTAINER_WORKSPACE_PATH   container-side workspace root (default ${CONTAINER_WS})`);
    process.exit(argv.length === 0 ? 1 : 0);
  }
  try {
    for (const p of argv) {
      const { candidates, reason, raw } = containerPathCandidates(p);
      if (!candidates.length) throw new Error(reason || `cannot determine a container path for ${String(raw)}`);
      for (const c of candidates) console.log(c);
    }
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    process.exit(1);
  }
}
