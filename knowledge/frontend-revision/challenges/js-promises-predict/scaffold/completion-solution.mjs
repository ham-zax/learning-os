function check(field, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`checked:${field}`);
      resolve(ms);
    }, ms);
  });
}

Promise.resolve()
  .then(() => check("email", 15))
  .then((ms) => {
    console.log(`email took:${ms}`);
    check("phone", 5);
  })
  .then((value) => console.log(`after phone:${value}`));
console.log("form open");
