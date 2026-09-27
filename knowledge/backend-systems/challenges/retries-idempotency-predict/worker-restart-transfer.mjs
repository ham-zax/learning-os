let effects = 0;

function createWorker() {
  const completed = new Map();
  return async function handle(id, amount, stopBeforeAck = false) {
    if (completed.has(id)) return completed.get(id);
    effects += amount;
    const receipt = effects;
    completed.set(id, receipt);
    if (stopBeforeAck) throw new Error('worker stopped');
    return receipt;
  };
}

let worker = createWorker();
try {
  await worker('delivery-9', 5, true);
} catch {}

worker = createWorker();
const replay = await worker('delivery-9', 5);
console.log(`replay:${replay}`);
console.log(`effects:${effects}`);
