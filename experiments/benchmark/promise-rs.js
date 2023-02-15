async function main() {
  for (let i = 0; i < 10; ++i) {
    console.time('No cache');
    let promise = Promise.resolve('ok');
    for (let i = 0; i < 1000000; ++i) {
      let v = await promise;
    }
    console.timeEnd('No cache');

    console.time('Cache');
    let cache;
    let promise2 = Promise.resolve('ok').then((v) => {
      cache = v;
    });
    for (let i = 0; i < 1000000; ++i) {
      if (cache) {
        let v = cache;
      } else {
        await promise2;
        let v = cache;
      }
    }
    console.timeEnd('Cache');
  }
}
main();
