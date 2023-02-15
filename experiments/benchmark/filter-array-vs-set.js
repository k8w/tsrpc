const arr = Array.from({ length: 10000 }, (v, i) => ({ id: i }));
const set = new Set(arr);
const filter = (v) => v.id < 100;
const N = 100000;

for (let i = 0; i < 10; ++i) {
  console.time('for of set');
  for (let i = 0; i < N; ++i) {
    let res = [];
    for (let item of set) {
      if (item.id < 100) {
        res.push(item);
      }
    }
  }
  console.timeEnd('for of set');

  console.time('for of set with func');
  for (let i = 0; i < N; ++i) {
    let arr = [];
    for (let item of set) {
      if (filter(item)) {
        arr.push(item);
      }
    }
  }
  console.timeEnd('for of set with func');

  console.time('array-from-set');
  for (let i = 0; i < N; ++i) {
    Array.from(set).filter((v) => v.id < 100);
  }
  console.timeEnd('array-from-set');

  console.time('array-filter');
  for (let i = 0; i < N; ++i) {
    arr.filter((v) => v.id < 100);
  }
  console.timeEnd('array-filter');

  console.log('-------------');
}
