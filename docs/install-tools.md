# Install the native tools

<img src="../assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="300">

The skill scripts run ACME, dxa and Ghidra on the machine of the agent: in a dev container, inside the container. Check what is missing:

```
npx -y @henols/c64-re-tools@latest status
```

Ghidra 12.1.3 needs Java 21. Ghidra 12.2 and later need Java 25. These steps are the ones that live CI runs. In a dev container, the Feature in the README does all of this.

## Debian 13 / Ubuntu 22.04 or later

Debian 12 has no OpenJDK 21: install [Temurin 21](https://adoptium.net/installation/) instead of `openjdk-21-jdk-headless`.

```
sudo apt-get install acme openjdk-21-jdk-headless unzip curl
curl -fsSLO https://raw.githubusercontent.com/henols/c64-re-tools/main/devcontainer/src/c64-re-tools/install-dxa.sh
bash install-dxa.sh
curl -fsSLO https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.3_build/ghidra_12.1.3_PUBLIC_20260817.zip
echo "93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54  ghidra_12.1.3_PUBLIC_20260817.zip" | sha256sum -c -
unzip -q ghidra_12.1.3_PUBLIC_20260817.zip -d ~/.local/share
echo 'export C64RT_GHIDRA="$HOME/.local/share/ghidra_12.1.3_PUBLIC"' >> ~/.profile
```

`install-dxa.sh` builds dxa 0.1.5 from its source and checks the archive. dxa is not in the `xa65` package.

## macOS (Homebrew)

```
xcode-select --install
brew install acme openjdk@21
export JAVA_HOME="$(brew --prefix openjdk@21)/libexec/openjdk.jdk/Contents/Home"
curl -fsSLO https://sources.voidlinux.org/dxa-0.1.5/dxa-0.1.5.tar.gz
test "$(md5 -q dxa-0.1.5.tar.gz)" = 6d69ae1772ed58de97b0180e480dfe0c
tar -xzf dxa-0.1.5.tar.gz && make -C dxa-0.1.5 CC=clang
install -m 0755 dxa-0.1.5/dxa "$(brew --prefix)/bin/dxa"
curl -fsSLO https://github.com/NationalSecurityAgency/ghidra/releases/download/Ghidra_12.1.3_build/ghidra_12.1.3_PUBLIC_20260817.zip
test "$(shasum -a 256 ghidra_12.1.3_PUBLIC_20260817.zip | cut -d' ' -f1)" = 93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54
unzip -q ghidra_12.1.3_PUBLIC_20260817.zip -d ~
(cd ~/ghidra_12.1.3_PUBLIC/support/gradle && ./gradlew buildNatives)
```

Then set `C64RT_GHIDRA=$HOME/ghidra_12.1.3_PUBLIC` and `JAVA_HOME` (the line above) in your shell profile. Ghidra ships no decompiler for macOS: `buildNatives` builds it.

## Windows

1. Java 21: `winget install EclipseAdoptium.Temurin.21.JDK`
2. ACME: unzip [acme0.97win.zip](https://sourceforge.net/projects/acme-crossass/files/win32/) and put `acme.exe` on `PATH`, or set `C64RT_ACME` to its full path.
3. dxa has no Windows release. Build [dxa-0.1.5.tar.gz](https://sources.voidlinux.org/dxa-0.1.5/dxa-0.1.5.tar.gz) with MinGW-w64: `make CC=gcc LDFLAGS=-static`. Put `dxa.exe` on `PATH`, or set `C64RT_DXA`.
4. Ghidra: unzip [ghidra_12.1.3_PUBLIC_20260817.zip](https://github.com/NationalSecurityAgency/ghidra/releases/tag/Ghidra_12.1.3_build) (SHA-256 `93a5d11a9ad510622acaaf908c556a7b9b764d338e78a7567f3689bf5081fd54`), then `setx C64RT_GHIDRA C:\path\to\ghidra_12.1.3_PUBLIC`.

## Settings

| Variable | Meaning |
| --- | --- |
| `C64RT_ACME`, `C64RT_DXA` | Full path of the tool when it is not on `PATH`. |
| `C64RT_GHIDRA` | The Ghidra installation directory (the one with `support/`). |
| `JAVA_HOME` | The JDK that Ghidra uses, when `java` on `PATH` is another version. |
