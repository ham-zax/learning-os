const db = new Map([['price', 10]]);
const cache = new Map();
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getPrice() {
  if (cache.has('price')) return cache.get('price');
  const value = db.get('price');
  await pause(20);
  cache.set('price', value);
  return value;
}

async function updatePrice(value) {
  await pause(5);
  db.set('price', value);
  cache.delete('price');
  console.log(`updated to ${value}`);
}

const [first] = await Promise.all([getPrice(), updatePrice(12)]);
console.log(`first read: ${first}`);
console.log(`later read: ${await getPrice()}`);
console.log(`db: ${db.get('price')}`);
