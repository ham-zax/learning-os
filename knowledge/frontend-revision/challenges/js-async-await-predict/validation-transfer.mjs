let shown = 'none';
const pending = new Map();

function load(field) {
  return new Promise((resolve) => pending.set(field, resolve));
}

async function validate(field) {
  const result = await load(field);
  shown = result;
  console.log(`${field}: ${shown}`);
}

const older = validate('old');
const newer = validate('new');

pending.get('new')('new-valid');
await newer;
pending.get('old')('old-invalid');
await older;
console.log(`final: ${shown}`);
