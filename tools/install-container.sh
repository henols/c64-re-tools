#!/usr/bin/env bash
# The native tools of the skill scripts in a Debian or Ubuntu dev container,
# as root: ACME, dxa, Exomizer and c64run with its C64 ROMs for the C64; sjasmplus and
# zxrun with its ZX Spectrum ROMs for the ZX Spectrum. The dev container
# Feature runs the copy of this script that comes with the toolkit version it
# installs, so the tools and the skills are always of the same version.
# A tool is installed again only when its install files changed: a stamp in
# $STAMPS keeps the SHA-256 of the files that installed it.

set -Eeuo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
STAMPS="/usr/local/share/c64-re-tools/stamps"

fail() {
    printf 'c64-re-tools tools: %s\n' "$*" >&2
    exit 1
}

[[ "$(id -u)" -eq 0 ]] || fail "run as root."
# shellcheck disable=SC1091
. /etc/os-release
[[ "${ID:-}" == debian || "${ID:-}" == ubuntu || "${ID_LIKE:-}" == *debian* ]] || fail "only Debian and Ubuntu are supported, not ${ID:-an unknown system}."

export DEBIAN_FRONTEND=noninteractive
APT_UPDATED=""

# Installs the packages that are not installed yet.
packages() {
    local missing=() package
    for package in "$@"; do
        dpkg -s "${package}" > /dev/null 2>&1 || missing+=("${package}")
    done
    [[ ${#missing[@]} -eq 0 ]] && return
    if [[ -z "${APT_UPDATED}" ]]; then
        apt-get update
        APT_UPDATED=1
    fi
    apt-get install -y --no-install-recommends "${missing[@]}"
}

# tool <name> <script> [<file>...]: runs the script when the stamp of the tool
# is not the SHA-256 of the script and its files.
tool() {
    local name="$1" sum
    shift
    sum="$(cd "${HERE}" && cat "$@" | sha256sum | cut -d' ' -f1)"
    if [[ "$(cat "${STAMPS}/${name}" 2>/dev/null || true)" == "${sum}" ]]; then
        echo "c64-re-tools tools: ${name} is up to date."
        return
    fi
    bash "${HERE}/$1"
    mkdir -p "${STAMPS}"
    echo "${sum}" > "${STAMPS}/${name}"
}

packages acme unzip curl ca-certificates build-essential xz-utils
tool dxa install-dxa.sh
tool exomizer install-exomizer.sh
tool c64run install-chips.sh c64run.c
tool sjasmplus install-sjasmplus.sh
tool zxrun install-zxrun.sh zxrun.c

[[ -z "${APT_UPDATED}" ]] || rm -rf /var/lib/apt/lists/*
