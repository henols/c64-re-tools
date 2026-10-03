// Live VICE tests are opt-in: set C64RT_LIVE_VICE to the absolute path of x64sc.
// Without it every live test is reported as skipped, never as passed (09 §6).

export const LIVE_VICE = process.env.C64RT_LIVE_VICE;

export const liveSkip: string | false =
  LIVE_VICE === undefined || LIVE_VICE === "" ? "live VICE: set C64RT_LIVE_VICE=/absolute/path/to/x64sc to run" : false;

/** The environment a live test gives the Host Runtime: VICE found through C64RT_VICE. */
export function liveEnv(): NodeJS.ProcessEnv {
  return { ...process.env, C64RT_VICE: LIVE_VICE };
}
