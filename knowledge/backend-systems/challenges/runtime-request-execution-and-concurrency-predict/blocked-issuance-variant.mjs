// Deterministic model: two handlers where A does sync CPU work before B can issue its DB query.
const timeline = [];
function runHandler(name, syncMs, onIssueDb) {
  timeline.push(`${name}:enter`);
  // Synchronous CPU work blocks the JS thread; no other JS handler can run during this loop.
  let acc = 0;
  for (let i = 0; i < syncMs; i += 1) acc += i;
  if (onIssueDb) onIssueDb();
  timeline.push(`${name}:yield`);
  return acc;
}

runHandler("A", 100);
runHandler("B", 10, () => {
  timeline.push("B:db-issued");
  Promise.resolve().then(() => timeline.push("B:db-callback"));
});
timeline.push("thread:free");

await Promise.resolve();
for (const entry of timeline) console.log(entry);
