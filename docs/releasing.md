# Releasing

Push a tag on a commit of `main`. The tag gives the version. CI tests the commit, publishes it to npm and makes a GitHub Release.

```
git tag vX.Y.Z && git push origin vX.Y.Z
```

- A tag without `-` goes to npm `latest`; a tag such as `vX.Y.Z-rc.N` goes to `next`.
- Each version can be released only once.
- Never change the version in the repository. It stays `0.0.0-development`.
- If a job fails, re-run the failed jobs.
