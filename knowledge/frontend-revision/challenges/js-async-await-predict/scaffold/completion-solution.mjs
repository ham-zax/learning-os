async function stamp(color) {
  console.log(`stamp:${color}`);
  await Promise.resolve();
  return "sealed";
}

const receipt = stamp("cyan");
console.log(`receipt:promise=${receipt instanceof Promise}`);
console.log("counter:open");
console.log(`result:${await receipt}`);
