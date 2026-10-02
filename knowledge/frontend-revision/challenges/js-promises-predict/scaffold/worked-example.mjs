function fetchTile(name, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`tile:${name}`);
      resolve(name.toUpperCase());
    }, ms);
  });
}

Promise.resolve()
  .then(() => {
    fetchTile("north", 10);
  })
  .then((value) => console.log(`dropped:${value}`));

Promise.resolve()
  .then(() => fetchTile("south", 20))
  .then((value) => console.log(`kept:${value}`));
