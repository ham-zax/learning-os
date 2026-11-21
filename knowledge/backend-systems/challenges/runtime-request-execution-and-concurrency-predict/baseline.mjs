// Deterministic model: single-threaded JS handler mixing sync CPU work and async I/O.
console.log("reqA:start");
Promise.resolve().then(() => console.log("reqA:microtask"));
setTimeout(() => console.log("reqA:io-callback"), 0);
console.log("reqA:sync-cpu-done");
console.log("reqB:start");
