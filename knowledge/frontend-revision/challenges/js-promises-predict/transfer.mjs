function upload(name, ms) {
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log(`uploaded ${name}`);
      resolve();
    }, ms);
  });
}

async function saveAll(files) {
  files.forEach(async (file) => {
    await upload(file.name, file.ms);
  });
  console.log('all saved');
}

await saveAll([{ name: 'a', ms: 20 }, { name: 'b', ms: 5 }]);
console.log('show success banner');
