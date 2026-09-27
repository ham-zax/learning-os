let total = 0;
const completed = new Map();

async function handle(id, amount) {
  if (completed.has(id)) return completed.get(id);
  await Promise.resolve();
  total += amount;
  completed.set(id, total);
  return total;
}

const results = await Promise.all([handle('same-operation', 5), handle('same-operation', 5)]);
console.log(`results:${JSON.stringify(results)}`);
console.log(`total:${total}`);
