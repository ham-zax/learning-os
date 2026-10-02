# Complete a trace where one step is returned and the next is not

Use Node.js ES-module semantics. `check` only prints after a timer and resolves with its delay; it contacts nothing.

```js
function check(field, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`checked:${field}`);
      resolve(ms);
    }, ms);
  });
}

Promise.resolve()
  .then(() => check("email", 15))
  .then((ms) => {
    console.log(`email took:${ms}`);
    check("phone", 5);
  })
  .then((value) => console.log(`after phone:${value}`));
console.log("form open");
```

Use the same subgoals: find what each callback hands back, decide what the next link waits for, then order the effects. Remember that the synchronous line at the bottom runs before any callback or timer.

The first trace line has been supplied. Complete the remaining lines in order, including each printed value:

```text
form open
________
________
________
________
```

Give a reason for each placement. In particular, which callback returns a promise and which only starts one? What value does each following link receive, and why?

You can mark each `then` callback with what it returns before filling the trace. Treat those marks as reasoning aids, not as output lines.

After predicting, check your explanation against a change: if the phone check took 50 ms instead of 5 ms, which trace lines would move?
