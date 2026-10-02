# Complete a trace where the lock covers only part of the work

This is a deterministic in-memory Node.js ES-module model, not PostgreSQL. `withLock` runs one piece of work at a time; `balance` is a plain variable.

```js
let balance = 100;

function createLock() {
  let tail = Promise.resolve();
  return async function withLock(work) {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  };
}
const withLock = createLock();

async function withdraw(who, amount) {
  if (balance < amount) return false;
  return withLock(async () => {
    await Promise.resolve();
    balance -= amount;
    console.log(`${who}:paid`);
    return true;
  });
}

const decisions = await Promise.all([withdraw("A", 70), withdraw("B", 50)]);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`balance:${balance}`);
```

Use the same subgoals: find where another caller can run, follow each decision from where it is made to where it is acted on, then see what the lock does and does not cover. Here A withdraws 70 and B withdraws 50 from a balance of 100.

The first trace line has been supplied. Complete the remaining lines in order, including each printed value:

```text
A:paid
________
________
________
```

Give a reason for each line. In particular, when does each caller perform its balance check relative to the lock? Is the final balance consistent with the rule that it must never go negative?

You can mark the check and the update on the code before filling the trace. Treat those marks as reasoning aids, not as output lines.

After predicting, say which single statement you would move so that the check and the update share one protected section, and what the second caller would then return. Remember this is only a Node model; it does not show how any PostgreSQL isolation level behaves.
