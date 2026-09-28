function step(name, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`done ${name}`);
      resolve(name);
    }, ms);
  });
}

step('a', 20)
  .then(() => step('b', 5))
  .then((value) => console.log(`chain got ${value}`));
console.log('sync end');
