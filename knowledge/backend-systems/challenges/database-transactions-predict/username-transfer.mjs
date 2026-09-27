const claimed = new Set();

async function claim(client, name) {
  if (claimed.has(name)) return false;
  await Promise.resolve();
  claimed.add(name);
  console.log(`${client}:claimed`);
  return true;
}

const decisions = await Promise.all([claim('A', 'alex'), claim('B', 'alex')]);
console.log(`decisions:${JSON.stringify(decisions)}`);
console.log(`claimed:${JSON.stringify([...claimed])}`);
