# Unseen coverage fixture

`recon-subject.regen2000proj` is a 100-byte project at origin `$0810` that was
authored for the annotation-store work, before the coverage rules existed, and
was never used to write them. `anno-coverage.test.ts` runs
`buildCoverageReport()` over it as a control the rules were not tuned against.

It lives outside `fixtures/coverage/` on purpose: that directory is enumerated,
and every subdirectory there is treated as one of the committed controls.
