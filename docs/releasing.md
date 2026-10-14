# Releasing

Push a tag on a commit of `main`. The tag gives the version. CI tests the commit, publishes it to npm and makes a GitHub Release.

```
git tag v2.0.0-rc.4 && git push origin v2.0.0-rc.4   # prerelease, npm next
git tag v2.0.0      && git push origin v2.0.0        # release, npm latest
```

- Each version can be released only once. `v2.0.0-rc.1` to `v2.0.0-rc.3` are used.
- Never change the version in the repository. It stays `0.0.0-development`.
- If a job fails, re-run the failed jobs.
