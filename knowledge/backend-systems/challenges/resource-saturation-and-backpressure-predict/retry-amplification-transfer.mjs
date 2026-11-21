// Deterministic model: client retries timed-out requests while downstream is saturated.
// Downstream capacity = 1/tick; maxQueue = 2; timeout = 2 ticks; each client retries once.
const queue = [];
const incoming = [
  { id: "c1", arrivedAt: 1, retriesLeft: 1 },
  { id: "c2", arrivedAt: 1, retriesLeft: 1 },
  { id: "c3", arrivedAt: 2, retriesLeft: 1 },
  { id: "c4", arrivedAt: 2, retriesLeft: 1 },
];
let admitted = 0;
let completed = 0;
let timedOutAndRetried = 0;

for (let tick = 1; tick <= 4; tick += 1) {
  for (const req of incoming.filter((r) => r.arrivedAt === tick)) {
    queue.push(req);
    admitted += 1;
  }
  if (queue.length > 0) {
    const job = queue.shift();
    const wait = tick - job.arrivedAt;
    if (wait >= 2 && job.retriesLeft > 0) {
      timedOutAndRetried += 1;
      queue.push({ id: `${job.id}-retry`, arrivedAt: tick, retriesLeft: job.retriesLeft - 1 });
      admitted += 1;
    }
    completed += 1;
  }
}

console.log(`admitted:${admitted}`);
console.log(`completed:${completed}`);
console.log(`timedOutAndRetried:${timedOutAndRetried}`);
console.log(`remainingQueued:${queue.length}`);
