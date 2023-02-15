const N = 1000000;

const arr = ['text', 'buffer'];
const set = new Set();
set.add('text');
set.add('buffer');
const obj = {
  text: true,
  buffer: true,
};

for (let i = 0; i < 10; ++i) {
  console.time('arr0');
  for (let i = 0; i < N; ++i) {
    let res = arr.indexOf('text');
  }
  console.timeEnd('arr0');

  console.time('arr1');
  for (let i = 0; i < N; ++i) {
    let res = arr.indexOf('buffer');
  }
  console.timeEnd('arr1');

  console.time('set');
  for (let i = 0; i < N; ++i) {
    let res = set.has('text');
  }
  console.timeEnd('set');

  console.time('obj');
  for (let i = 0; i < N; ++i) {
    let res = obj.text;
  }
  console.timeEnd('obj');

  console.log('-----------------------');
}
