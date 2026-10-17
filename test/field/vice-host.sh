#!/usr/bin/env bash
# Starts the c64-re-tools Host Runtime with a chosen VICE, for a field test
# with more than one VICE version. It can also build VICE from the
# newest trunk of VICE's source (the VICE-Team/svn-mirror git repository),
# stamped with its SVN revision, so that the host can tell a build with the
# fix for VICE bug #2202 (r45971 and later) from a flawed one.
#
# Linux only. It installs no packages: a missing build tool is named with
# the command that installs it.
#
#   test/field/vice-host.sh list
#   test/field/vice-host.sh build [--update]
#   test/field/vice-host.sh run <vice> [--checkout] [-- <host options>]
#
# <vice> is "trunk" (the newest trunk build; it is built first when there is
# none), a path to an x64sc, or a directory with bin/x64sc. c1541 and petcat
# come from the same directory as that x64sc.
#
# The host runs in the foreground; Ctrl+C stops it and its VICE. Only one
# host can listen on a port: stop one before you start the next, or give
# another port (-- --port 6465) and set C64RT_HOST in the container.
#
# Environment:
#   C64RT_VICE_BUILDS  where builds and the source go (default ~/.local/share/c64-re-tools/vice)
#   C64RT_CHANNEL      the npm channel of the host (default next)

set -euo pipefail

ROOT="${C64RT_VICE_BUILDS:-$HOME/.local/share/c64-re-tools/vice}"
SOURCE="$ROOT/svn-mirror"
REPOSITORY="https://github.com/VICE-Team/svn-mirror.git"
# The branch with the plain trunk import: each commit carries its git-svn-id.
BRANCH="clean"
CHANNEL="${C64RT_CHANNEL:-next}"
CHECKOUT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

fail() {
    printf 'vice-host: %s\n' "$*" >&2
    exit 1
}

usage() {
    sed -n '11,13p' "${BASH_SOURCE[0]}" | sed 's/^#   //' >&2
    exit 2
}

# The SVN revision of the checked-out trunk.
revision() {
    git -C "$SOURCE" log -1 --format=%B | sed -n 's/^git-svn-id: .*@\([0-9]*\) .*/\1/p'
}

# The newest trunk build: the directory r<revision> with the highest revision.
newest_build() {
    local found=""
    for dir in "$ROOT"/r*/; do
        [ -x "${dir}bin/x64sc" ] || continue
        found="${dir%/}"
    done
    # Directory names sort by number only when they have the same width; SVN revisions here have 5 digits.
    [ -n "$found" ] && printf '%s\n' "$found"
}

# Refuses a build when a tool or a library is missing, by name and with the remedy.
check_build_tools() {
    local missing=()
    for tool in git gcc g++ make autoconf automake pkg-config flex xa dos2unix makeinfo; do
        command -v "$tool" > /dev/null || missing+=("$tool")
    done
    command -v bison > /dev/null || command -v byacc > /dev/null || command -v yacc > /dev/null || missing+=("bison")
    for module in gtk+-3.0 glew libpng; do
        pkg-config --exists "$module" || missing+=("$module (pkg-config)")
    done
    if [ "${#missing[@]}" -gt 0 ]; then
        fail "a VICE build needs: ${missing[*]}. On Debian or Ubuntu: sudo apt-get install build-essential autoconf automake pkg-config bison flex texinfo xa65 dos2unix libgtk-3-dev libglew-dev libpng-dev libpulse-dev libasound2-dev libcurl4-openssl-dev libevdev-dev"
    fi
}

# Gets the newest trunk (vice/ only), then builds and installs it into r<revision> when that build is not there.
build() {
    local update="${1:-}"
    check_build_tools
    mkdir -p "$ROOT"
    if [ ! -d "$SOURCE/.git" ]; then
        git clone --depth 1 --branch "$BRANCH" --filter=blob:none --sparse "$REPOSITORY" "$SOURCE"
        git -C "$SOURCE" sparse-checkout set vice
    elif [ "$update" = "--update" ]; then
        git -C "$SOURCE" fetch --depth 1 origin "$BRANCH"
        git -C "$SOURCE" reset --hard FETCH_HEAD
    fi
    local rev
    rev="$(revision)"
    [ -n "$rev" ] || fail "the newest commit of $BRANCH has no git-svn-id, so the build cannot get its SVN revision"
    local prefix="$ROOT/r$rev"
    if [ -x "$prefix/bin/x64sc" ]; then
        printf 'vice-host: trunk r%s is built already: %s\n' "$rev" "$prefix" >&2
        return
    fi
    printf 'vice-host: building VICE trunk r%s into %s\n' "$rev" "$prefix" >&2
    (cd "$SOURCE/vice" && ./autogen.sh)
    local work="$ROOT/build-r$rev"
    rm -rf "$work"
    mkdir -p "$work"
    # SVN_REVISION_OVERRIDE puts the revision into the build: -version and the binary monitor then give it.
    (cd "$work" && "$SOURCE/vice/configure" --prefix="$prefix" --enable-gtk3ui --disable-html-docs SVN_REVISION_OVERRIDE="$rev")
    make -C "$work" -j"$(nproc)"
    make -C "$work" install
    rm -rf "$work"
    "$prefix/bin/x64sc" -version >&2 || true
}

# The x64sc of a <vice> argument.
x64sc_of() {
    local choice="$1"
    case "$choice" in
        trunk)
            local dir
            dir="$(newest_build)" || true
            if [ -z "$dir" ]; then
                # The build writes to stderr: stdout of this function is the path.
                build >&2
                dir="$(newest_build)" || fail "the build did not give a VICE"
            fi
            printf '%s\n' "$dir/bin/x64sc"
            ;;
        *)
            if [ -d "$choice" ]; then
                printf '%s\n' "$choice/bin/x64sc"
            else
                printf '%s\n' "$choice"
            fi
            ;;
    esac
}

list() {
    local seen=" "
    for x64sc in "$(command -v x64sc || true)" /usr/bin/x64sc /usr/local/bin/x64sc "$ROOT"/r*/bin/x64sc; do
        [ -n "$x64sc" ] && [ -x "$x64sc" ] || continue
        local real
        real="$(readlink -f "$x64sc")"
        case "$seen" in *" $real "*) continue ;; esac
        seen="$seen$real "
        printf '%-50s %s\n' "$x64sc" "$("$x64sc" -version 2>&1 | head -1)"
    done
}

run() {
    [ $# -ge 1 ] || usage
    local x64sc
    x64sc="$(x64sc_of "$1")"
    shift
    local from_checkout=no
    if [ "${1:-}" = "--checkout" ]; then
        from_checkout=yes
        shift
    fi
    if [ "${1:-}" = "--" ]; then shift; fi
    [ -x "$x64sc" ] || fail "no x64sc at $x64sc"
    local bin
    bin="$(dirname "$x64sc")"
    for tool in c1541 petcat; do
        [ -x "$bin/$tool" ] || fail "no $tool next to $x64sc: the host needs the c1541 and the petcat of the same VICE"
    done
    printf 'vice-host: %s\n' "$("$x64sc" -version 2>&1 | head -1)" >&2
    export C64RT_VICE="$x64sc" C64RT_C1541="$bin/c1541" C64RT_PETCAT="$bin/petcat"
    if [ "$from_checkout" = yes ]; then
        cd "$CHECKOUT"
        exec node src/host/main.ts "$@"
    fi
    exec npx -y --package="@henols/c64-re-tools@$CHANNEL" c64-re-tools-host "$@"
}

case "${1:-}" in
    list) list ;;
    build) build "${2:-}" ;;
    run)
        shift
        run "$@"
        ;;
    *) usage ;;
esac
