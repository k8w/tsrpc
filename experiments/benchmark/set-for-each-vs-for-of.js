const N = 10000;
const set = new Set(Array.from({ length: 1000 }, (v, i) => ({ id: i })));

for (let i = 0; i < 10; ++i) {
  console.time('forEach');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    set.forEach((v) => {
      res += v.id;
    });
  }
  console.timeEnd('forEach');

  console.time('for of');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    for (v of set) {
      res += v.id;
    }
  }
  console.timeEnd('for of');
}
