let now = 0;
const TTL = 30;
const db = new Map([['name', 'Sam']]);
const cache = new Map();

function readName() {
  const entry = cache.get('name');
  if (entry && now < entry.expiresAt) return `${entry.value} (cache)`;
  const value = db.get('name');
  cache.set('name', { value, expiresAt: now + TTL });
  return `${value} (db)`;
}

function saveName(value) {
  db.set('name', value);
}

console.log(`t=0 ${readName()}`);
now = 10;
saveName('Sasha');
console.log(`t=10 ${readName()}`);
now = 29;
console.log(`t=29 ${readName()}`);
now = 30;
console.log(`t=30 ${readName()}`);
