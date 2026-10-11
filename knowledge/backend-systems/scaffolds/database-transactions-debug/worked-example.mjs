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
