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
