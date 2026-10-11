# Debug a reservation ledger that balances only when calls are serial

This is a deterministic **in-memory Node.js model**, not a database transaction or proof about a database isolation level. A desk has four allocatable units. A confirmed reservation must consume its quantity exactly once.

```js
async function trial(label, overlap) {
  let remaining = 4;
  const confirmed = [];

  async function reserve(customer, quantity) {
    const snapshot = remaining;
    console.log(`${label} ${customer} saw:${snapshot}`);
    if (snapshot < quantity) return false;
    await Promise.resolve();
    remaining = snapshot - quantity;
    confirmed.push(quantity);
    return true;
  }

  const decisions = overlap
    ? await Promise.all([reserve("A", 2), reserve("B", 3)])
    : [await reserve("A", 2), await reserve("B", 3)];
  const booked = confirmed.reduce((total, quantity) => total + quantity, 0);
  console.log(`${label} decisions:${JSON.stringify(decisions)}`);
  console.log(`${label} remaining:${remaining} booked:${booked} invariant:${remaining + booked === 4}`);
}

await trial("overlap", true);
await trial("serial", false);
```

A report that says “one unit remains” looks reassuring. But the real safety check needs **both** the current remainder and the independent confirmations:

**Invariant:** `remaining + sum(confirmed quantities) === initial capacity`, and every accepted reservation must leave capacity nonnegative.

The actual output is:

```text
overlap A saw:4
overlap B saw:4
overlap decisions:[true,true]
overlap remaining:1 booked:5 invariant:false
serial A saw:4
serial B saw:2
serial decisions:[true,false]
serial remaining:2 booked:2 invariant:true
```

**Debugging move 1 — prove the symptom.** Both overlapping requests return success, and the ledger says five units were promised against capacity four. The number “remaining:1” alone cannot certify correctness.

**Move 2 — falsify the tempting explanation.** “Node is single-threaded, so each reservation is atomic” would predict that B reads a remainder of two. Instrumenting the **snapshot at the decision point** shows both overlapped requests read four. That contradicts the serial hypothesis.

**Move 3 — localize the boundary.** Each request checks the snapshot, suspends at `await`, then writes `snapshot - quantity` after the other request has also inspected the old state. B overwrites A's deduction rather than applying its own deduction to the current remainder. The serial control changes **when B reads**, not the quantities or the invariant, and the discrepancy disappears.

**Move 4 — state what a repair must protect.** Capacity admission and its update must act as one valid decision, not two operations joined by a hopeful `await`. In a real database you would investigate a conditional write, row locking, version check, or another transaction mechanism **and verify its actual isolation behavior**. This toy trace only identifies the broken dependency; it does not choose a production database fix.

A useful debugging habit: reproduce the violated invariant, log the decision inputs, vary only the interleaving, and identify which observation becomes stale **before** choosing a repair.
