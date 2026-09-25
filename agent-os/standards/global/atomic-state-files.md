# Atomic State Files

Write state/record files atomically, owner-only:

```ts
const tmp = join(dir, `.tmp-${process.pid}-${randomUUID()}`);
writeFileSync(tmp, "");
chmodSync(tmp, 0o600);        // tighten BEFORE content lands
writeFileSync(tmp, content);
renameSync(tmp, path);
```

- Readers see no file or a complete file, never a partial one.
- mkdir with `{ recursive: true }` only. Never check-then-create, because
  concurrent brokers race on it.
- Read host-written files back as untrusted: parse in try/catch,
  validate every field's type, ignore unknown fields, and never open a
  path taken from the content.
- An absent file is a normal state. Return `{ present: false, reason }`
  and don't throw.
