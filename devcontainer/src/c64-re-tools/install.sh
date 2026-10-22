#!/usr/bin/env bash
# The c64-re-tools dev container Feature, at image build. It holds no tools
# of its own: project.sh installs the native tools that come with the
# toolkit version of the channel (tools/ in its npm package), now and at each
# start, so an old copy of this Feature still gets the tools that the skills
# need. Node 24 comes from the official Node Feature (dependsOn).

set -Eeuo pipefail

SHARE="/usr/local/share/c64-re-tools"
TARGET="${TARGET:-claude}"
CHANNEL="${CHANNEL:-latest}"
MACHINES="${MACHINES:-c64}"

fail() {
    printf 'c64-re-tools Feature: %s\n' "$*" >&2
    exit 1
}

[[ "${TARGET}" =~ ^[a-z]+(,[a-z]+)*$ ]] || fail "target must be a harness name or a comma list of them, not '${TARGET}'."
[[ "${CHANNEL}" == latest || "${CHANNEL}" == next ]] || fail "channel must be latest or next, not '${CHANNEL}'."
[[ "${MACHINES}" =~ ^(c64|spectrum)(,(c64|spectrum))*$ ]] || fail "machines must be c64, spectrum or c64,spectrum, not '${MACHINES}'."

# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == debian || "${ID:-}" == ubuntu || "${ID_LIKE:-}" == *debian* ]] || fail "only Debian and Ubuntu images are supported, not ${ID:-an unknown system}."

if ! command -v curl > /dev/null 2>&1; then
    export DEBIAN_FRONTEND=noninteractive
    apt-get update
    apt-get install -y --no-install-recommends curl ca-certificates
    rm -rf /var/lib/apt/lists/*
fi

# The lifecycle commands cannot read the options, so they are written next to project.sh.
mkdir -p "${SHARE}"
install -m 0755 "$(dirname "$0")/project.sh" "${SHARE}/project.sh"
printf 'TARGET=%s\nCHANNEL=%s\nMACHINES=%s\n' "${TARGET}" "${CHANNEL}" "${MACHINES}" > "${SHARE}/feature.env"

"${SHARE}/project.sh" tools
