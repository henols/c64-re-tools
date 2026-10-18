# Releasing

<img src="../assets/branding/c64-re-tools-transparent.svg" alt="C64 RE Tools" width="300">

Push a tag on the commit of a push to `main` whose CI passed. The tag gives the version. CI does not test again: it publishes to npm and makes a GitHub Release with the dev container Feature.

```
git tag vX.Y.Z && git push origin vX.Y.Z
```

- A tag without `-` goes to npm `latest`; a tag such as `vX.Y.Z-rc.N` goes to `next`. `next` stays where it is on a release. How users choose a channel: the README.
- Each version can be released only once.
- Never change the version in the repository. It stays `0.0.0-development`.
- If a job fails, re-run the failed jobs.
- The dev container Feature has its own version in `devcontainer-feature.json`. Change it only with its files. The Feature archive is the same bytes in every release until then, so the `devcontainer-lock.json` of a project stays valid.
- Tests for macOS, Windows, the Feature and live VICE run only when started by hand: `gh workflow run Platforms`, `gh workflow run "Dev container Feature"`, `gh workflow run Live`.
