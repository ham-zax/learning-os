async function inner() {
  console.log('inner-start');
  await Promise.resolve();
  console.log('inner-end');
}

async function outer() {
  console.log('outer-start');
  const pending = inner();
  console.log('outer-middle');
  await pending;
  console.log('outer-end');
}

outer();
console.log('top-end');
