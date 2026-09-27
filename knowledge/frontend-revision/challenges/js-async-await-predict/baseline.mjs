async function task() {
  console.log('inside-start');
  await Promise.resolve();
  console.log('inside-end');
}

task();
console.log('outside');
