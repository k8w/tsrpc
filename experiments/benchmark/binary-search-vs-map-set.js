require('k8w-extend-native');

const N = 1000;
const rands = Array.from({ length: N }, (v, i) => i).orderBy(() =>
  Math.random()
);

function binarySearch() {
  let arr = [];
  let n = 0;

  for (let i = 0; i < N; ++i) {
    arr.push({ id: i });
  }
  for (let i = 0; i < N; ++i) {
    let idx = arr.binarySearch(rands[i], (v) => v.id);
    if (idx > -1) {
      arr.splice(idx, 1);
    }
  }
}

function map() {
  let map = new Map();
  let n = 0;
  for (let i = 0; i < N; ++i) {
    map.set(i, { id: i });
  }
  for (let i = 0; i < N; ++i) {
    map.delete(i);
  }
}

let setValues = Array.from({ length: N }, (v, i) => ({ id: i }));
function set() {
  let set = new Set();
  let n = 0;
  for (let i = 0; i < N; ++i) {
    set.add(setValues[i]);
  }
  for (let i = 0; i < N; ++i) {
    set.delete(setValues[i]);
  }
}

for (let i = 0; i < 10; ++i) {
  console.time('binarySearch');
  for (let i = 0; i < 10000; ++i) {
    binarySearch();
  }
  console.timeEnd('binarySearch');

  console.time('map');
  for (let i = 0; i < 10000; ++i) {
    map();
  }
  console.timeEnd('map');

  console.time('set');
  for (let i = 0; i < 10000; ++i) {
    set();
  }
  console.timeEnd('set');

  console.log('---------------------');
}
