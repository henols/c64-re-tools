# ACME verify transcript

`verify-honest-pass.txt` is a real capture, not synthesized: one annotation
store exported to ACME source by `exportAsm()`, assembled by a real
`ACME 0.97 "Zem", 31 Jan 2021`, and settled by `verifyAcmeAssembles()`'s
byte-diff. It carries the argv, ACME's stdout and stderr verbatim, and the
resulting `AcmeVerifyResult` field by field. Captured 2026-08-30T22:00:23Z on
the development host. The only edit after capture: temp directory paths became
the placeholder `<TMPDIR>`.

`acme-verify.test.ts` re-parses the captured stdout with
`parseAcmeResultLines()` and requires it to reproduce the recorded
`acmeResultLines`. Do not edit the transcript by hand; re-capture it instead.
