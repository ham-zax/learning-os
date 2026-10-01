# Complete a trace with a returned promise

Use Node.js ES-module semantics. The stamp function below only prints and returns a string; it does not contact a service.

```js
async function stamp(color) {
  console.log(`stamp:${color}`);
  await Promise.resolve();
  return "sealed";
}

const receipt = stamp("cyan");
console.log(`receipt:promise=${receipt instanceof Promise}`);
console.log("counter:open");
console.log(`result:${await receipt}`);
```

Start with the same subgoals: follow the immediate call, mark its suspension, finish the caller's synchronous work, then resume the suspended work. Here the caller eventually has its own await too, so track that boundary separately.

The first trace line has been supplied. Complete the remaining lines in order, including each printed value:

```text
stamp:cyan
________
________
________
```

Give a reason for each placement. In particular, what does `stamp` return to its caller before the function reaches `return "sealed"`? Which expression makes the top-level code wait for that returned promise?

You can annotate the code with a slash at each suspension point before filling the trace. Treat those annotations as reasoning aids, not as output lines.

After predicting, check whether your explanation would still work if the awaited promise took longer to settle. The goal is to explain the boundary between the call and its continuation, without assuming that the `async` keyword schedules the whole body for later.
