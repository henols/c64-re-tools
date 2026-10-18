#!/usr/bin/env bash

set -Eeuo pipefail

# ------------------------------------------------------------
# dxa installer. install-container.sh runs it as root, with build-essential
# and curl.
#
# Installs:
#   /usr/local/bin/dxa
#   /usr/local/share/man/man1/dxa.1   (if supplied by source)
#
# Does NOT install:
#   xa
#   xa65
#
# dxa version:
#   0.1.5
# ------------------------------------------------------------

DXA_VERSION="0.1.5"

DXA_ARCHIVE="dxa-${DXA_VERSION}.tar.gz"

# The source archive. The upstream site (floodgap.com) is gone; Void Linux keeps the same archive.
DXA_URL="https://sources.voidlinux.org/dxa-${DXA_VERSION}/${DXA_ARCHIVE}"

# Published MD5 from SlackBuilds.
DXA_MD5="6d69ae1772ed58de97b0180e480dfe0c"

PREFIX="/usr/local"
BIN_DIR="${PREFIX}/bin"
MAN_DIR="${PREFIX}/share/man/man1"

BUILD_DIR=""

# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------

info()
{
    printf '\n==> %s\n' "$*"
}

error()
{
    printf '\nERROR: %s\n' "$*" >&2
    exit 1
}

cleanup()
{
    if [[ -n "${BUILD_DIR}" && -d "${BUILD_DIR}" ]]; then
        rm -rf "${BUILD_DIR}"
    fi
}

trap cleanup EXIT


# ------------------------------------------------------------
# Check user
# ------------------------------------------------------------

[[ "$(id -u)" -eq 0 ]] || error "Run as root."


# ------------------------------------------------------------
# Show what we're doing
# ------------------------------------------------------------

cat <<EOF

dxa installer
-------------

Version:     ${DXA_VERSION}
Install to:  ${BIN_DIR}/dxa

This script installs dxa only.
It will NOT install xa or xa65.

EOF


# ------------------------------------------------------------
# Create temporary build directory
# ------------------------------------------------------------

BUILD_DIR="$(mktemp -d -t dxa-build-XXXXXXXX)"

info "Using temporary build directory: ${BUILD_DIR}"

cd "${BUILD_DIR}"


# ------------------------------------------------------------
# Download dxa
# ------------------------------------------------------------

info "Downloading dxa ${DXA_VERSION}"

curl \
    --fail \
    --location \
    --show-error \
    --silent \
    --retry 3 \
    --output "${DXA_ARCHIVE}" \
    "${DXA_URL}"


# ------------------------------------------------------------
# Verify archive
# ------------------------------------------------------------

info "Verifying downloaded archive"

ACTUAL_MD5="$(md5sum "${DXA_ARCHIVE}" | awk '{print $1}')"

if [[ "${ACTUAL_MD5}" != "${DXA_MD5}" ]]; then
    echo
    echo "Expected MD5:"
    echo "  ${DXA_MD5}"
    echo
    echo "Downloaded MD5:"
    echo "  ${ACTUAL_MD5}"
    echo

    error "Checksum mismatch. Refusing to compile the archive."
fi

echo "Checksum OK."


# ------------------------------------------------------------
# Extract
# ------------------------------------------------------------

info "Extracting source"

tar -xzf "${DXA_ARCHIVE}"

SOURCE_DIR="${BUILD_DIR}/dxa-${DXA_VERSION}"

if [[ ! -d "${SOURCE_DIR}" ]]; then
    error "Expected source directory not found: ${SOURCE_DIR}"
fi

cd "${SOURCE_DIR}"


# ------------------------------------------------------------
# Build
# ------------------------------------------------------------

info "Compiling dxa with GCC"

make clean >/dev/null 2>&1 || true

make CC=gcc


# ------------------------------------------------------------
# Locate resulting binary
# ------------------------------------------------------------

info "Locating compiled dxa executable"

DXA_BINARY=""

if [[ -x "${SOURCE_DIR}/dxa" ]]; then
    DXA_BINARY="${SOURCE_DIR}/dxa"
else
    DXA_BINARY="$(
        find "${SOURCE_DIR}" \
            -maxdepth 3 \
            -type f \
            -name dxa \
            -perm -111 \
            -print \
            -quit
    )"
fi

if [[ -z "${DXA_BINARY}" ]]; then
    error "Compilation completed, but the dxa executable could not be found."
fi

echo "Found:"
echo "  ${DXA_BINARY}"


# ------------------------------------------------------------
# Basic executable check
# ------------------------------------------------------------

info "Checking compiled binary"

if [[ ! -x "${DXA_BINARY}" ]]; then
    error "Compiled dxa binary is not executable."
fi

# dxa -h exits non-zero; its output names the version.
DXA_HELP="$("${DXA_BINARY}" -h 2>&1 || true)"

if [[ "${DXA_HELP}" != *"v${DXA_VERSION} -- symbolic"* ]]; then
    error "The compiled dxa does not run or is not version ${DXA_VERSION}."
fi

echo "Compiled dxa binary runs."


# ------------------------------------------------------------
# Install binary
# ------------------------------------------------------------

info "Installing dxa"

install -d -m 0755 "${BIN_DIR}"

install \
    -m 0755 \
    "${DXA_BINARY}" \
    "${BIN_DIR}/dxa"


# ------------------------------------------------------------
# Install man page if supplied
# ------------------------------------------------------------

DXA_MANPAGE="$(
    find "${SOURCE_DIR}" \
        -type f \
        -name 'dxa.1' \
        -print \
        -quit
)"

if [[ -n "${DXA_MANPAGE}" ]]; then

    info "Installing dxa manual page"

    install -d -m 0755 "${MAN_DIR}"

    install \
        -m 0644 \
        "${DXA_MANPAGE}" \
        "${MAN_DIR}/dxa.1"

    if command -v mandb >/dev/null 2>&1; then
        mandb -q || true
    fi
else
    echo
    echo "No dxa.1 man page found in the source archive."
    echo "Skipping manual-page installation."
fi


# ------------------------------------------------------------
# Verify installation
# ------------------------------------------------------------

info "Verifying installation"

if [[ ! -x "${BIN_DIR}/dxa" ]]; then
    error "dxa was not installed correctly."
fi

echo
echo "Executable:"
command -v dxa || true


echo
echo "Installed path:"
echo "  ${BIN_DIR}/dxa"


# ------------------------------------------------------------
# Check that xa wasn't installed by us
# ------------------------------------------------------------

echo
echo "------------------------------------------------------------"
echo "Installation complete"
echo "------------------------------------------------------------"
echo
echo "dxa ${DXA_VERSION} is installed:"
echo
echo "    ${BIN_DIR}/dxa"
echo
