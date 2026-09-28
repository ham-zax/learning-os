class Store {
  constructor() {
    this.items = [];
  }

  add(item) {
    this.items.push(item);
    return this.items.length;
  }
}

const store = new Store();

function onEvent(handler, payload) {
  try {
    console.log(`handled: ${handler(payload)}`);
  } catch (error) {
    console.log(`handled: ${error.constructor.name}`);
  }
}

onEvent(store.add, 'x');
onEvent((item) => store.add(item), 'y');
onEvent(store.add.bind(store), 'z');
console.log(`items: ${store.items.join(',')}`);
