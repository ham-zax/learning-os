let remaining = 6;
const confirmed = [];

async function reserve(customer, quantity) {
  const snapshot = remaining;
  if (snapshot < quantity) return false;
  await Promise.resolve();
  if (remaining < quantity) return false;
  remaining = snapshot - quantity;
  confirmed.push(quantity);
  return true;
}

const decisions = await Promise.all([reserve("C", 2), reserve("D", 3)]);
const booked = confirmed.reduce((total, quantity) => total + quantity, 0);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`remaining:${remaining} booked:${booked}`);
console.log(`invariant:${remaining + booked === 6}`);
