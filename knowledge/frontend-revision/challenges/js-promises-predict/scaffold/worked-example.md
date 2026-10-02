# What the next `then` waits for: the callback's return value

This example runs in Node.js as an ES module. `fetchTile` only simulates slow work with a timer; it contacts nothing.

```js
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
```

Two chains start together. They differ in one detail: the first callback has braces and no `return`; the second callback returns the promise from `fetchTile`.

**Subgoal 1 — find what each first callback hands back.** The north callback starts a timer, then ends. A function that ends without `return` hands back `undefined`. The south callback hands back the promise that `fetchTile("south", 20)` created.

**Subgoal 2 — see what the chain does with that value.** `then` gives the next link a promise of its own. If the callback returns an ordinary value, that promise fulfills right away with the value. If it returns a promise, the link adopts that promise and waits for it. The north chain therefore does not wait. Its timer is still running, but nothing in the chain points at it.

**Subgoal 3 — order the effects.** The north chain moves on at once, so `dropped:undefined` prints before any timer fires. Then the 10 ms timer prints `tile:north`. The south chain is still waiting for its 20 ms timer; when that fires it prints `tile:south`, and only then does the next link receive `SOUTH` and print `kept:SOUTH`.

The resulting trace is:

```text
dropped:undefined
tile:north
tile:south
kept:SOUTH
```

One causal rule explains all four lines: the next link waits for whatever the callback returns, never for work the callback merely started. Starting a promise and returning it are different acts.

Optional principle question: if the north callback became `() => fetchTile("north", 10)`, which line would move, and what value would the next link print?
