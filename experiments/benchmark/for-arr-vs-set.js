const N = 100000;

const arr = Array.from({ length: 1000 }, (v, i) => ({ id: i }));
const set = new Set(arr);

for (let i = 0; i < 10; ++i) {
  console.time('arr for i');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    for (let i = 0, len = arr.length; i < len; ++i) {
      res += arr[i].id;
    }
  }
  console.timeEnd('arr for i');

  console.time('arr for of');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    for (let v of arr) {
      res += v.id;
    }
  }
  console.timeEnd('arr for of');

  console.time('set for of');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    for (let v of set) {
      res += v.id;
    }
  }
  console.timeEnd('set for of');

  console.time('set forEach');
  for (let i = 0; i < N; ++i) {
    let res = 0;
    set.forEach((v) => {
      res += v.id;
    });
  }
  console.timeEnd('set forEach');
}
