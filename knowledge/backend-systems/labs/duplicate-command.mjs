import { pathToFileURL } from 'node:url';

// Deliberately faulty in-memory starter. It handles a completed duplicate but
// does not define safe handling for overlapping requests. Not durable storage.
export function createProcessor(applyEffect) {
  const completed = new Map();
  return async function processCommand(id, amount) {
    if (completed.has(id)) return completed.get(id);
    const result = await applyEffect(amount);
    completed.set(id, result);
    return result;
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  let total = 0;
  const processCommand = createProcessor(async (amount) => {
    await Promise.resolve();
    total += amount;
    return total;
  });
  const results = await Promise.all([processCommand('same-operation', 5), processCommand('same-operation', 5)]);
  console.log(JSON.stringify({ results, total }, null, 2));
}
