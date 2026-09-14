import { pathToFileURL } from 'node:url';

// Deliberately faulty in-memory concurrency model. This is NOT a PostgreSQL emulator.
export function createInventory(initialStock = 1) {
  let stock = initialStock;
  return {
    available() { return stock; },
    async reserve() {
      if (stock <= 0) return false;
      await Promise.resolve(); // controlled interleaving between decision and effect
      stock -= 1;
      return true;
    },
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const inventory = createInventory(1);
  const accepted = await Promise.all([inventory.reserve(), inventory.reserve()]);
  console.log(JSON.stringify({ accepted, remaining: inventory.available() }, null, 2));
}
