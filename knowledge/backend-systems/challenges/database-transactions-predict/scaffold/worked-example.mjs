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

async function withdrawUnprotected(who, amount) {
  if (balance < amount) return false;
  await Promise.resolve();
  balance -= amount;
  console.log(`unprotected ${who}:paid`);
  return true;
}

async function withdrawProtected(who, amount) {
  return withLock(async () => {
    if (balance < amount) return false;
    await Promise.resolve();
    balance -= amount;
    console.log(`protected ${who}:paid`);
    return true;
  });
}

async function run(label, withdraw) {
  balance = 100;
  const decisions = await Promise.all([withdraw("A", 80), withdraw("B", 80)]);
  console.log(`${label} decisions:${JSON.stringify(decisions)} balance:${balance}`);
}

await run("unprotected", withdrawUnprotected);
await run("protected", withdrawProtected);
