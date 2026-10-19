#!/usr/bin/env bash

set -Eeuo pipefail

# ------------------------------------------------------------
# Exomizer installer. install-container.sh runs it as root, with
# build-essential and curl.
#
# Installs:
#   /usr/local/bin/exomizer
#
# Exomizer version:
#   3.1.2 (tag 3.1.2, commit df77c879ce2a)
# ------------------------------------------------------------

EXOMIZER_VERSION="3.1.2"

# Bitbucket makes the archive of the tag on request, so its bytes can change.
# The check is on the source files that the build uses: the SHA-256 of the
# sorted list of "sha256  ./path" lines of src/.
EXOMIZER_URL="https://bitbucket.org/magli143/exomizer/get/${EXOMIZER_VERSION}.tar.gz"
EXOMIZER_SOURCE_SHA256="0824d19bdf5a2cc752d2c21e1e6314f7d5feb398bc2d42510aebc1a2e4f08c72"

BIN_DIR="/usr/local/bin"

BUILD_DIR=""

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

[[ "$(id -u)" -eq 0 ]] || error "Run as root."

printf '\n==> Installing Exomizer %s to %s/exomizer\n' "${EXOMIZER_VERSION}" "${BIN_DIR}"

BUILD_DIR="$(mktemp -d -t exomizer-build-XXXXXXXX)"
cd "${BUILD_DIR}"

curl --fail --location --show-error --silent --retry 3 --output exomizer.tar.gz "${EXOMIZER_URL}"
tar -xzf exomizer.tar.gz

# The archive holds one folder, named after the repository and the commit.
SOURCE_DIR="$(find "${BUILD_DIR}" -mindepth 2 -maxdepth 2 -type d -name src -print -quit)"
[[ -n "${SOURCE_DIR}" ]] || error "The archive has no src folder."
cd "${SOURCE_DIR}"

ACTUAL_SHA256="$(find . -type f | LC_ALL=C sort | xargs sha256sum | sha256sum | cut -d' ' -f1)"
if [[ "${ACTUAL_SHA256}" != "${EXOMIZER_SOURCE_SHA256}" ]]; then
    error "The source files of Exomizer ${EXOMIZER_VERSION} have the SHA-256 ${ACTUAL_SHA256}, not ${EXOMIZER_SOURCE_SHA256}. Refusing to compile them."
fi

make CC=gcc exomizer

[[ "$(./exomizer -v 2>&1 || true)" == *"Exomizer v${EXOMIZER_VERSION} "* ]] || error "The compiled exomizer does not run or is not version ${EXOMIZER_VERSION}."

install -d -m 0755 "${BIN_DIR}"
install -m 0755 exomizer "${BIN_DIR}/exomizer"

printf '\nExomizer %s is installed: %s/exomizer\n' "${EXOMIZER_VERSION}" "${BIN_DIR}"
