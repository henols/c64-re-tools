#!/usr/bin/env bash
# The c64-re-tools dev container Feature at work. Each command takes the
# toolkit version that the channel names now, and first installs the native
# tools of that version (tools/install-container.sh of its npm package), so
# the tools and the skills are always of the same version.
#   project.sh tools     the native tools only (at image build, as root)
#   project.sh install   the native tools, then the toolkit into the project (after create)
#   project.sh update    the same at each start; on a failure the installed copy stays

set -Eeuo pipefail

SHARE="/usr/local/share/c64-re-tools"
# shellcheck disable=SC1091
. "${SHARE}/feature.env" # TARGET and CHANNEL, the options of the Feature
REGISTRY="${NPM_CONFIG_REGISTRY:-https://registry.npmjs.org}"
REGISTRY="${REGISTRY%/}"

say() {
    printf 'c64-re-tools: %s\n' "$*" >&2
}

# Sets VERSION and TARBALL: the version that CHANNEL names in the registry now.
resolve() {
    local manifest
    manifest="$(curl -fsSL --retry 3 "${REGISTRY}/@henols%2fc64-re-tools/${CHANNEL}")" || return 1
    VERSION="$(printf '%s' "${manifest}" | grep -o '"version":"[^"]*"' | head -1 | cut -d'"' -f4)"
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

case "${1:-}" in
    tools)
        resolve || { say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}."; exit 1; }
        tools
        ;;
    install)
        resolve || { say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}."; exit 1; }
        tools
        exec npx -y "@henols/c64-re-tools@${VERSION}" install --target "${TARGET}"
        ;;
    update)
        if ! resolve; then
            say "the registry ${REGISTRY} gave no version for the channel ${CHANNEL}; the installed copy stays."
        elif ! tools; then
            say "the native tools of ${VERSION} did not install; the installed tools and toolkit stay."
        else
            npx -y "@henols/c64-re-tools@${VERSION}" update --target "${TARGET}" || say "the update failed; the installed copy stays."
        fi
        ;;
    *)
        echo "usage: project.sh tools|install|update" >&2
        exit 2
        ;;
esac
