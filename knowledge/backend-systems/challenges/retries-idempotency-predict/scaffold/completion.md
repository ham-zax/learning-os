# Choose the identity, then complete the trace

These calls are sequential in one Node.js process, and the map stays alive. Ignoring the first return value models its reply being lost. The caller intends to retry that first dispatch, then place a separate order to the same address.

```js
const dispatches = new Map();
let parcelsSent = 0;

function dispatch(operationKey, address) {
  if (dispatches.has(operationKey)) return dispatches.get(operationKey);
  parcelsSent += 1;
  const receipt = `${address}/parcel-${parcelsSent}`;
  dispatches.set(operationKey, receipt);
  return receipt;
}

dispatch("dispatch-23", "studio"); // Its reply is lost.
const retryKey = "FILL_RETRY_KEY";
console.log(`retry-receipt:${dispatch(retryKey, "studio")}`);
console.log(`new-order:${dispatch("dispatch-24", "studio")}`);
console.log(`parcels-sent:${parcelsSent}`);
```

Replace `FILL_RETRY_KEY` with the operation identity that expresses the caller's intended retry. Then complete every printed value:

```text
retry-receipt:________
new-order:________
parcels-sent:________
```

Use three subgoals: identify the intended operation, check which result remains recorded after the lost reply, and distinguish a retry from a separate order.

Explain why you chose that key. The address is identical in all calls: why should the retry and the new order still be treated differently? Explain which lookup returns a saved result and which call performs another effect.

Keep the reasoning within this model. It supplies sequential execution and retained memory; your answer need not invent a real broker or database guarantee. Consider the lost reply as missing knowledge at the caller, rather than evidence that no dispatch happened.
