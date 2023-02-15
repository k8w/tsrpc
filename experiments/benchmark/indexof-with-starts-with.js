const N = 1000000;
const str = 'application/json; charset=utf-8';

for (let i = 0; i < 10; ++i) {
  console.time('indexOf');
  for (let i = 0; i < N; ++i) {
    str.indexOf('application/json') > -1;
    str.indexOf('application/octet-stream') > -1;
  }
  console.timeEnd('indexOf');

  console.time('startsWith');
  for (let i = 0; i < N; ++i) {
    str.startsWith('application/json');
    str.startsWith('application/octet-stream');
  }
  console.timeEnd('startsWith');

  console.time('includes');
  for (let i = 0; i < N; ++i) {
    str.includes('application/json');
    str.includes('application/octet-stream');
  }
  console.timeEnd('includes');

  console.log('---------------------');
}
