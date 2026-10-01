# Trace the call before tracing the continuation

This small example runs in Node.js as an ES module. The printer is an ordinary JavaScript object; it represents no real device.

```js
const printer = {
  async label(name) {
    console.log(`label:${name}`);
    await 0;
    console.log("printer:released");
  },
};

printer.label("parcel");
console.log("desk:free");
```

**Subgoal 1 — follow the immediate call.** Calling `label` starts its body immediately. The first log prints `label:parcel`. The word `async` does not postpone the entire method.

**Subgoal 2 — mark the suspension boundary.** At `await 0`, the method suspends. Even this already available value causes the remaining body to continue later. The call has returned a promise, and the caller can carry on.

**Subgoal 3 — finish the current synchronous work.** The caller prints `desk:free`. The await did not block that caller.

**Subgoal 4 — resume the remaining body.** After the current synchronous work finishes, the continuation prints `printer:released`.

The resulting trace is:

```text
label:parcel
desk:free
printer:released
```

For this example, one boundary is enough: separate the body before its await from the continuation after it. We do not need a full event-loop taxonomy to explain these three lines.

Optional principle question: if `0` became `Promise.resolve(0)`, would the last log move before `desk:free`? Explain using the suspension boundary.
