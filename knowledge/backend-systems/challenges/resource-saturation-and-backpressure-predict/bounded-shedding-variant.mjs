// Deterministic model: bounded queue (maxQueue = 2) with explicit load shedding.
// Same overload: 2 arrivals/tick for 5 ticks, 1 completion/tick.
const maxQueue = 2;
const queue = [];
let completed = 0;
let rejected = 0;
const completedLatencies = [];

for (let tick = 1; tick <= 5; tick += 1) {
  for (const suffix of ["a", "b"]) {
    if (queue.length < maxQueue) {
      queue.push({ id: `r${tick}${suffix}`, arrivedAt: tick });
    } else {
      rejected += 1;
    }
  }
  if (queue.length > 0) {
    const job = queue.shift();
    completed += 1;
    completedLatencies.push(tick - job.arrivedAt + 1);
  }
}

console.log(`completed:${completed}`);
console.log(`rejected:${rejected}`);
console.log(`queuedAtTick5:${queue.length}`);
console.log(`maxLatency:${Math.max(...completedLatencies)}`);
