const db = new Map([['stock', 5]]);
const cache = new Map([['stock', 5]]);
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function setStock(value) {
  cache.delete('stock');
  await pause(10);
  db.set('stock', value);
  console.log(`stock set to ${value}`);
}

async function getStock() {
  if (cache.has('stock')) return cache.get('stock');
  const value = db.get('stock');
  await pause(1);
  cache.set('stock', value);
  return value;
}

const [, during] = await Promise.all([setStock(0), getStock()]);
console.log(`read during update: ${during}`);
console.log(`read after update: ${await getStock()}`);
