let total = 0;
const completed = new Map();

async function handle(id, amount) {
  if (completed.has(id)) return completed.get(id);
  total += amount;
  completed.set(id, total);
  return total;
}

async function send(id, amount, loseResponse = false) {
  const result = await handle(id, amount);
  if (loseResponse) throw new Error('response lost');
  return result;
}

try {
  await send('payment-7', 5, true);
} catch {}

const retry = await send('payment-7-retry', 5);
console.log(`retry:${retry}`);
console.log(`total:${total}`);
