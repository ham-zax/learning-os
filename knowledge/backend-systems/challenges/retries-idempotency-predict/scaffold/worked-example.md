# Separate a retry from another operation

This deterministic Node.js model makes sequential calls in one process. Its map remains alive throughout. It models a lost reply by ignoring the first return value.

```js
const reservations = new Map();
let slotsUsed = 0;

function reserve(operationKey, quantity) {
  if (reservations.has(operationKey)) return reservations.get(operationKey);
  slotsUsed += quantity;
  const confirmation = `booking-${slotsUsed}`;
  reservations.set(operationKey, confirmation);
  return confirmation;
}

reserve("booking-request-41", 2); // The reply is lost; the result stays recorded.
console.log(`recovered:${reserve("booking-request-41", 2)}`);
console.log(`separate:${reserve("booking-request-42", 2)}`);
console.log(`slots-used:${slotsUsed}`);
```

**Subgoal 1 — identify the operation.** The map looks up the key, not the quantity. The first call uses two slots and stores its confirmation under `booking-request-41`.

**Subgoal 2 — inspect what survived the lost reply.** Ignoring a reply does not undo this effect or erase the map entry.

**Subgoal 3 — distinguish retry from new intent.** Reusing `booking-request-41` retrieves the recorded result. `booking-request-42` represents a separate operation, even though its quantity is also two. It uses two more slots.

The trace is:

```text
recovered:booking-2
separate:booking-4
slots-used:4
```

The needed mechanism here is stable operation identity plus a retained result. Equal payloads alone do not identify one operation. This model makes no claim about overlapping calls, process restarts, durable storage, or real delivery systems.

Optional principle question: why would using quantity alone as the map key incorrectly suppress some legitimate bookings?
