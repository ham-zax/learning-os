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
const retryKey = "dispatch-23";
console.log(`retry-receipt:${dispatch(retryKey, "studio")}`);
console.log(`new-order:${dispatch("dispatch-24", "studio")}`);
console.log(`parcels-sent:${parcelsSent}`);
