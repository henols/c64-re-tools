#!/usr/bin/env bash
# The c64-re-tools dev container Feature at work. Each command takes the
# toolkit version that the channel names now, and first installs the native
# tools of that version (tools/install-container.sh of its npm package), so
# the tools and the skills are always of the same version.
#   project.sh tools     the native tools only (at image build, as root)
#   project.sh install   the native tools, then the toolkit into the project (after create)
#   project.sh update    the same at each start; on a failure the installed copy stays.
#                        A new version tells the user to restart the agent session.
# install and update then fill the npx cache of the MCP server (mcp_cache).
# npx runs with --prefer-online: its cached package data can be minutes old and
# not know a version that the registry just named.

set -Eeuo pipefail

SHARE="/usr/local/share/c64-re-tools"
# shellcheck disable=SC1091
. "${SHARE}/feature.env" # TARGET and CHANNEL, the options of the Feature
REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org}"
REGISTRY="${REGISTRY%/}"

say() {
    printf 'c64-re-tools: %s\n' "$*" >&2
}

# The newer of two versions. A release is newer than a prerelease of the same X.Y.Z.
newer() {
    local a="${1%%-*}" b="${2%%-*}"
    if [[ -z "$2" || ("${a}" == "${b}" && "$1" != *-*) ]]; then
        echo "$1"
    elif [[ -z "$1" || "${a}" == "${b}" ]]; then
        echo "$2"
    elif [[ "$(printf '%s\n%s\n' "${a}" "${b}" | sort -V | tail -1)" == "${a}" ]]; then
        echo "$1"
    else
        echo "$2"
    fi
}

# Sets VERSION and TARBALL: the version that CHANNEL names in the registry now.
# next is the newer of next and latest, so it never falls behind a release.
resolve() {
    local tags latest next manifest
    tags="$(curl -fsSL --retry 3 "${REGISTRY}/-/package/@henols%2fc64-re-tools/dist-tags")" || return 1
    latest="$(printf '%s' "${tags}" | grep -o '"latest":"[^"]*"' | cut -d'"' -f4 || true)"
    next="$(printf '%s' "${tags}" | grep -o '"next":"[^"]*"' | cut -d'"' -f4 || true)"
    if [[ "${CHANNEL}" == next ]]; then VERSION="$(newer "${latest}" "${next}")"; else VERSION="${latest}"; fi
    [[ -n "${VERSION}" ]] || return 1
    manifest="$(curl -fsSL --retry 3 "${REGISTRY}/@henols%2fc64-re-tools/${VERSION}")" || return 1
    TARBALL="$(printf '%s' "${manifest}" | grep -o '"tarball":"[^"]*"' | head -1 | cut -d'"' -f4)"
    [[ -n "${VERSION}" && -n "${TARBALL}" ]]
}

as_root() {
    if [[ "$(id -u)" -eq 0 ]]; then
        "$@"
    elif sudo -n true 2> /dev/null; then
        sudo "$@"
    else
        say "installing the native tools needs root or sudo without a password. Rebuild the container."
        return 1
    fi
}

# Installs the native tools of VERSION, when the installed ones are of another version.
tools() {
    [[ "$(cat "${SHARE}/tools.version" 2> /dev/null || true)" == "${VERSION}" ]] && return 0
    say "installing the native tools of @henols/c64-re-tools@${VERSION}."
    local dir status=0
    dir="$(mktemp -d -t c64-re-tools-XXXXXXXX)"
    if curl -fsSL --retry 3 "${TARBALL}" | tar -xz -C "${dir}"; then
        as_root bash "${dir}/package/tools/install-container.sh" || status=$?
    else
        status=1
    fi
    rm -rf "${dir}"
    [[ ${status} -eq 0 ]] || return "${status}"
    echo "${VERSION}" | as_root tee "${SHARE}/tools.version" > /dev/null
}

# Fills the npx cache folder of the MCP server, so that no agent session must
# install it. The MCP declaration starts npx -y --package=<spec> c64-re-tools-mcp
# with the npm tag of VERSION, and npx keys its folder by that spec. A session
# that stops during that install, or two sessions that install at the same time,
# leave an incomplete folder that npx uses again: then the server does not start.
# --help loads each module of the server, so it finds such a folder. Then the
# folder is removed and filled again.
mcp_cache() {
    local spec cache folder
    spec="@henols/c64-re-tools@latest"
    [[ "${VERSION}" == *-* ]] && spec="@henols/c64-re-tools@next"
    local run=(npx --prefer-online -y "--package=${spec}" c64-re-tools-mcp --help)
    if "${run[@]}" > /dev/null 2>&1; then
        return 0
    fi
    cache="$(npm config get cache)"
    for folder in "${cache}"/_npx/*/; do
        if grep -qF "\"${spec}\"" "${folder}package.json" 2> /dev/null; then
            rm -rf "${folder}"
        fi
    done
    if ! "${run[@]}" > /dev/null; then
        say "the MCP server ${spec} does not start, so the agent cannot use the emulator."
        return 1
    fi
}

case "${1:-}" in
    tools)
        resolve || { say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}."; exit 1; }
        tools
        ;;
    install)
        resolve || { say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}."; exit 1; }
        tools
        npx --prefer-online -y "@henols/c64-re-tools@${VERSION}" install --target "${TARGET}"
        mcp_cache
        ;;
    update)
        BEFORE="$(cat "${SHARE}/tools.version" 2> /dev/null || true)"
        if ! resolve; then
            say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}; the installed copy stays."
        elif ! tools; then
            say "the native tools of ${VERSION} did not install; the installed tools and toolkit stay."
        else
            if ! npx --prefer-online -y "@henols/c64-re-tools@${VERSION}" update --target "${TARGET}"; then
                say "the update failed; the installed copy stays."
            else
                mcp_cache || true
                if [[ -n "${BEFORE}" && "${BEFORE}" != "${VERSION}" ]]; then
                    say "updated from ${BEFORE} to ${VERSION}. Restart the agent session so that its MCP server runs ${VERSION}."
                    # The MCP server runs the npm tag of its version: from a prerelease to a release, @next becomes @latest.
                    if [[ "${BEFORE}" == *-* && "${VERSION}" != *-* ]]; then
                        say "${VERSION} is a release and newer than the newest prerelease, so the MCP server uses @latest."
                    fi
                fi
            fi
        fi
        ;;
    *)
        echo "usage: project.sh tools|install|update" >&2
        exit 2
        ;;
esac
