const counter = {
  count: 0,
  increment() {
    this.count += 1;
    return this.count;
  },
};

console.log(counter.increment());
const increment = counter.increment;
try {
  console.log(increment());
} catch (error) {
  console.log(error.constructor.name);
}
console.log(counter.count);
