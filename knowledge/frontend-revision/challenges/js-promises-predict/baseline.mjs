function save(label) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`saved ${label}`);
      resolve(label);
    }, 10);
  });
}

Promise.resolve()
  .then(() => {
    save('draft');
  })
  .then((value) => console.log(`next got ${value}`));
