// The context of a native tool run in a test.

import { ProcessSupervisor } from "./processes.ts";

/** A tool run with its own supervisor, a signal that never aborts, and the environment `env`. */
export const toolContext = (env: NodeJS.ProcessEnv) => ({ supervisor: new ProcessSupervisor(), signal: new AbortController().signal, env });
