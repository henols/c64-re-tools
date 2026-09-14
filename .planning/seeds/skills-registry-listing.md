---
title: List the skills in the open skills registry for discovery
trigger_condition: External adoption becomes a goal — i.e. someone other than the maintainer should be able to FIND these skills without already knowing the repo exists.
planted_date: 2026-09-14
source: /gsd-explore — skill installer route survey (.planning/notes/skill-installer-routes-surveyed.md)
---

# Seed: skills-registry-listing

## Idea

Both of this project's distribution routes require the user to already know the
project exists — `npx @henols/c64-re-tools` needs the package name, and the plugin
route needs `/plugin marketplace add` pointed at this repository. Neither is
discoverable by someone searching for "C64 reverse engineering" from a cold start.

The open agent-skills ecosystem has a discovery surface (`npx skills find <query>`,
driven locally by the `find-skills` skill). A listing there would be a **discovery
pointer**, not a third install route: it would direct a searcher to the plugin or
the npm installer, both of which carry the `vice` MCP server that the skills require
to function.

## Why this is a seed and not a todo

No adoption goal exists today. The survey that produced this idea established that
the npm installer's audience is real and known, which is a different thing from
wanting new audiences. Until external adoption is actually a goal, this is cost with
no return.

## Constraint any future work must respect

These skills **break** without the `vice` MCP server — that is this project's own
stated compatibility constraint, not a caution. So a registry listing must never
become a route that installs the skills alone. If the registry's install mechanism
cannot also wire the MCP server, the listing has to be a pointer that sends the user
to a route that can.

## Open question to resolve first

DATA_p3wn8qbz_START
Whether `npx skills` can wire an MCP server at all is UNRESOLVED — the only local
source (`~/.claude/skills/find-skills/SKILL.md`) lists four commands, none
MCP-related, but a skill's own documentation is not authoritative on that CLI's full
capability. Resolve this against a primary source before designing anything here;
the answer decides whether a listing can be an install route or only a pointer.
DATA_p3wn8qbz_END
