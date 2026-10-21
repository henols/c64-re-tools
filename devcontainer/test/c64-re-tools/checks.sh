#!/bin/bash
# The checks of every scenario: the native tools run, and the toolkit of the
# channel is in the project.
set -e
# shellcheck disable=SC1091
source dev-container-features-test-lib
# shellcheck disable=SC1091
. /usr/local/share/c64-re-tools/feature.env

# The version that the channel names now: latest, or for next the newer of the
# npm next and latest versions. A prerelease goes to the npm tag next, a release to latest.
TAGS="$(curl -fsSL https://registry.npmjs.org/-/package/@henols%2fc64-re-tools/dist-tags)"
LATEST="$(printf '%s' "${TAGS}" | grep -o '"latest":"[^"]*"' | cut -d'"' -f4)"
NEXT="$(printf '%s' "${TAGS}" | grep -o '"next":"[^"]*"' | cut -d'"' -f4 || true)"
VERSION="${LATEST}"
if [[ "${CHANNEL}" == next && -n "${NEXT}" && "${NEXT%%-*}" != "${LATEST}" \
    && "$(printf '%s\n%s\n' "${LATEST}" "${NEXT%%-*}" | sort -V | tail -1)" == "${NEXT%%-*}" ]]; then
    VERSION="${NEXT}"
fi
TAG=latest
[[ "${VERSION}" == *-* ]] && TAG=next

check "ACME runs" bash -c "acme --version | grep 'This is ACME, release 0.97'"
check "dxa runs" bash -c "dxa -h 2>&1 | grep 'v0.1.5 -- symbolic'"
check "Exomizer runs" bash -c "exomizer -v 2>&1 | grep 'Exomizer v3.1.2 '"
check "c64run runs and has its ROMs" bash -c "c64run --version | grep '^roms=ok '"
check "c64run starts the C64 with its ROMs" bash -c "printf 'init\\nquit\\n' | c64run | grep '^ok .*pc=fce2'"
check "Java 21" bash -c "java -version 2>&1 | grep 'version \"21'"
check "Ghidra runs" bash -c "\"\$C64RT_GHIDRA/support/analyzeHeadless\" 2>&1 | grep 'Headless Analyzer Usage'"
check "Ghidra has a decompiler for this machine" bash -c "ls \"\$C64RT_GHIDRA\"/Ghidra/Features/Decompiler/os/linux_*/decompile"
check "the tools are stamped with the toolkit version" bash -c "test -s /usr/local/share/c64-re-tools/tools.version && ls /usr/local/share/c64-re-tools/stamps/dxa /usr/local/share/c64-re-tools/stamps/exomizer /usr/local/share/c64-re-tools/stamps/c64run /usr/local/share/c64-re-tools/stamps/ghidra"
check "a start with the same version installs no tools" bash -c "! /usr/local/share/c64-re-tools/project.sh update 2>&1 | grep 'installing the native tools'"
check "a start with the same version asks for no restart" bash -c "! /usr/local/share/c64-re-tools/project.sh update 2>&1 | grep 'Restart the agent session'"
check "the toolkit is installed in the project" bash -c "ls .claude/skills/c64-reverse-engineering/SKILL.md .mcp.json"
check "the tools are of the channel ${CHANNEL}: ${VERSION}" bash -c "test \"\$(cat /usr/local/share/c64-re-tools/tools.version)\" = '${VERSION}'"
check "the skills are of the channel ${CHANNEL}: ${VERSION}" bash -c "grep -F '\"version\": \"${VERSION}\"' .claude/skills/c64-knowledge/package.json"
check "the MCP server runs the npm tag ${TAG}" bash -c "grep -F -- '--package=@henols/c64-re-tools@${TAG}\"' .mcp.json"

reportResults
