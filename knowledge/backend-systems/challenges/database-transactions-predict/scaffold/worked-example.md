# Check, then act: why the check must travel with the update

This is a deterministic in-memory Node.js ES-module model of two callers. It is not PostgreSQL. `balance` is a plain variable and `withLock` is a small helper that runs one piece of work at a time; neither contacts anything.

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

async function withdrawUnprotected(who, amount) {
  if (balance < amount) return false;
  await Promise.resolve();
  balance -= amount;
  console.log(`unprotected ${who}:paid`);
  return true;
}

async function withdrawProtected(who, amount) {
  return withLock(async () => {
    if (balance < amount) return false;
    await Promise.resolve();
    balance -= amount;
    console.log(`protected ${who}:paid`);
    return true;
  });
}

async function run(label, withdraw) {
  balance = 100;
  const decisions = await Promise.all([withdraw("A", 80), withdraw("B", 80)]);
  console.log(`${label} decisions:${JSON.stringify(decisions)} balance:${balance}`);
}

await run("unprotected", withdrawUnprotected);
await run("protected", withdrawProtected);
```

The same withdrawal logic runs twice. Both runs start two withdrawals of 80 from a balance of 100, and the business rule is that the balance must never go negative. The only difference is whether the check and the update sit inside `withLock`.

**Subgoal 1 — find where another caller can run.** In JavaScript, other work can run at each `await`. In the unprotected version the check `balance < amount` happens before the `await`, and the update happens after it. Between those two points the other withdrawal can run.

**Subgoal 2 — follow the stale decision.** Both callers check before either updates, so both see 100 and both decide "enough". The decision was true when it was made, but it is no longer true when each caller acts on it. Two payments succeed and the balance is -60. The single-line updates were not the problem; the gap between check and update was.

**Subgoal 3 — see what the lock changes.** In the protected version the check, the `await`, and the update are all one unit of work inside `withLock`. The lock lets the second caller start only after the first has finished. The first pays and leaves 20. The second now checks against 20, so it is rejected and nothing else changes.

**Subgoal 4 — note that the `await` was not removed.** The protected version still awaits in the middle. Its safety comes from the check and the update sharing one uninterrupted section, not from avoiding slow steps.

The resulting trace is:

```text
unprotected A:paid
unprotected B:paid
unprotected decisions:[true,true] balance:-60
protected A:paid
protected decisions:[true,false] balance:20
```

**What this model does and does not show.** It demonstrates why a check and its dependent update need a shared boundary in a single-threaded JavaScript interleaving. It does not prove how PostgreSQL behaves. In a real database the boundary might be a row lock taken with `SELECT ... FOR UPDATE`, a single conditional `UPDATE ... WHERE balance >= 80` whose affected-row count is inspected, a constraint, or a stricter isolation level, and each has its own guarantees and failure modes that must be checked against the database documentation and tests, not inferred from this model.

Optional principle question: if the lock covered only the update and the check stayed outside it, would the second caller still be rejected? Explain with the check-to-update gap.
