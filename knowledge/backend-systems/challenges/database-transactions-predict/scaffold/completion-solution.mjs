let balance = 100;

function createLock() {
  let tail = Promise.resolve();
  return async function withLock(work) {
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await work(); } finally { release(); }
  };
}
const withLock = createLock();

async function withdraw(who, amount) {
  if (balance < amount) return false;
  return withLock(async () => {
    await Promise.resolve();
    balance -= amount;
    console.log(`${who}:paid`);
    return true;
  });
}

const decisions = await Promise.all([withdraw("A", 70), withdraw("B", 50)]);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`balance:${balance}`);
