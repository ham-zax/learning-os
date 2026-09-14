import { pathToFileURL } from 'node:url';

// Deliberately faulty learner starter. Copy to a disposable workspace before editing.
let count = 0;
export function createCounter() {
  return {
    next() { return ++count; },
    peek() { return count; },
  };
}

// A deterministic observation, not a learning-engine test or evidence event.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const first = createCounter();
  const second = createCounter();
  console.log(JSON.stringify({
    firstNext: first.next(),
    firstAgain: first.next(),
    secondNext: second.next(),
    firstPeek: first.peek(),
    secondPeek: second.peek(),
  }, null, 2));
}
