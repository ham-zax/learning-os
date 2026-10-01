const printer = {
  async label(name) {
    console.log(`label:${name}`);
    await 0;
    console.log("printer:released");
  },
};

printer.label("parcel");
console.log("desk:free");
