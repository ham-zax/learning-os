# Debug a partial fix: the fresh check is not enough

A teammate responded to double bookings by adding a **second availability check after the await**. A test still finds inconsistent capacity accounting during overlapping reservations. The initial capacity is six; C requests two units and D requests three.

```js
let remaining = 6;
const confirmed = [];

async function reserve(customer, quantity) {
  const snapshot = remaining;
  if (snapshot < quantity) return false;
  await Promise.resolve();
  if (remaining < quantity) return false;
  remaining = FILL_WRITE;
  confirmed.push(quantity);
  return true;
}

const decisions = await Promise.all([reserve("C", 2), reserve("D", 3)]);
const booked = confirmed.reduce((total, quantity) => total + quantity, 0);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`remaining:${remaining} booked:${booked}`);
console.log(`invariant:${remaining + booked === 6}`);
```

The expression `FILL_WRITE` is deliberately missing. A faulty version used the value captured **before** the await. Complete the investigation rather than guessing from the final remainder:

1. State the invariant relating `remaining`, the confirmed quantities, and six. What observation, rather than just a positive remainder, would prove a lost update?
2. If `FILL_WRITE` were `snapshot - quantity`, predict the three printed lines. Both requests are started together; each awaits an already-resolved promise.
3. Replace `FILL_WRITE` with one expression that preserves the invariant for **this Node schedule**, and predict the three lines again.
4. Explain precisely why the extra check alone does not fix the stale write. Would your proposed expression still be safe if another `await` were inserted between the final check and assignment? Identify what a real transaction would have to guarantee.

```text
decisions:________
remaining:________ booked:________
invariant:________
```

Treat this as a **debugging** exercise: use a falsifiable explanation of the discrepancy and a bounded correction, not a claim that this in-memory script proves production database correctness. The instruction is separate from any frozen assessable challenge.
