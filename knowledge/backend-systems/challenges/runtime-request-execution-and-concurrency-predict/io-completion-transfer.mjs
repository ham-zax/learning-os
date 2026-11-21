// Deterministic model: external I/O finishes while JS runs sync work, but callback waits for yield.
const events = [];
let externalIoDone = false;

function issueExternalIo(cb) {
  events.push("io:issued");
  queueMicrotask(() => {
    events.push("io:callback-run");
    cb();
  });
}

issueExternalIo(() => events.push("resp:sent"));
// External I/O completes off-thread while JS is still inside synchronous CPU work:
externalIoDone = true;
events.push(`sync:still-running(ioDone=${externalIoDone})`);
events.push("sync:yield");

await Promise.resolve();
for (const entry of events) console.log(entry);
