# Tool Answers and Refusals

Build results only through `stock-handler.ts`:

```ts
return stockAnswer(session.client, { address, bytes });   // sessioned
return derivedAnswer({ symbols });                         // "pure" tool (no session)
return isErrorText(`vice_memory_read: size must be 1-65535, got ${n}`);
return convertWireError("vice_memory_read", err);          // client.send() rejected
return convertHandshakeError(toolName, err);               // session/connect failed
```

- Never write a `{ content, isError }` literal. `stockAnswer()` stamps
  `runState` on every answer, and a handler never supplies its own.
- Never write a third error converter. A new wire/handshake case gets a
  branch in one of the two existing converters.
- Refusal text starts with `toolName:`, says what happened, and names the
  remedy (an env var, an argument, a retry being safe).
- Never pass a raw errno through alone; wrap it with its likely cause.
