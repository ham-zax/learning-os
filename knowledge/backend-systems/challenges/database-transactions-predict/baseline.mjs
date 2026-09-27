let seats = 1;

async function reserve(client) {
  if (seats <= 0) return false;
  await Promise.resolve();
  seats -= 1;
  console.log(`${client}:accepted`);
  return true;
}

const decisions = await Promise.all([reserve('A'), reserve('B')]);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`seats:${seats}`);
