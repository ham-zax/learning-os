// Deterministic in-memory model: bounded concurrency pool with an unbounded queue.
// Arrival rate = 2 requests/tick for 5 ticks (10 total); worker completes 1 request/tick.
const capacity = 1;
const queue = [];
let inFlight = 0;
let completed = 0;
let maxQueueDepth = 0;
const completedLatencies = [];

for (let tick = 1; tick <= 5; tick += 1) {
  // 2 new requests arrive each tick
  queue.push({ id: `r${tick}a`, arrivedAt: tick });
  queue.push({ id: `r${tick}b`, arrivedAt: tick });
  if (inFlight < capacity && queue.length > 0) {
    inFlight += 1;
    const job = queue.shift();
    completed += 1;
    completedLatencies.push(tick - job.arrivedAt + 1);
    inFlight -= 1;
  }
  maxQueueDepth = Math.max(maxQueueDepth, queue.length);
}

console.log(`completed:${completed}`);
console.log(`queuedAtTick5:${queue.length}`);
console.log(`maxQueueDepth:${maxQueueDepth}`);
console.log(`latencies:${JSON.stringify(completedLatencies)}`);
