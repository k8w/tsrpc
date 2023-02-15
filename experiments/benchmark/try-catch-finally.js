const N = 1000000;

const arr = Array.from({ length: 10 }, () => 0);
function final1() {
  arr.forEach((v, i, arr) => {
    arr[i] += 1;
  });
}
function final2() {
  arr.forEach((v, i, arr) => {
    arr[i] += 2;
  });
}
function final3() {
  arr.forEach((v, i, arr) => {
    arr[i] += 3;
  });
}

for (let i = 0; i < 10; ++i) {
  console.time('native-all');
  for (let i = 0; i < N; ++i) {
    let ret = test1();
    if (ret.isSucc) {
      final1();
    } else {
      final2();
    }
    final3();
  }
  console.timeEnd('native-all');

  console.time('try-catch-finally');
  for (let i = 0; i < N; ++i) {
    let ret;
    try {
      ret = test2();
      final1();
    } catch (e) {
      final2();
    } finally {
      final3();
    }
  }
  console.timeEnd('try-catch-finally');

  console.time('native-err');
  for (let i = 0; i < N; ++i) {
    let ret = test1();
    if (ret.isSucc) {
      final1();
    } else {
      final2();
    }
  }
  console.timeEnd('native-err');

  console.time('try-catch');
  for (let i = 0; i < N; ++i) {
    let ret;
    try {
      ret = test2();
      final1();
    } catch (e) {
      final2();
    }
  }
  console.timeEnd('try-catch');

  console.time('native-finally');
  for (let i = 0; i < N; ++i) {
    let ret = test1();
    if (ret.isSucc) {
      final1();
    }
    final3();
  }
  console.timeEnd('native-finally');

  console.time('try-finally');
  for (let i = 0; i < N; ++i) {
    let ret;
    try {
      ret = test3();
      if (ret.isSucc) {
        final1();
      }
    } finally {
      final3();
    }
  }
  console.timeEnd('try-finally');
}

function test1() {
  return Math.random() > 0.5
    ? { isSucc: true, data: 'aaaaa' }
    : { isSucc: false, errMsg: 'bbbbb' };
}
function test2() {
  if (Math.random() > 0.5) {
    return { isSucc: true, data: 'aaaaa' };
  } else {
    throw { isSucc: false, errMsg: 'bbbbb' };
  }
}
function test3() {
  if (Math.random() > 0) {
    return { isSucc: true, data: 'aaaaa' };
  } else {
    throw { isSucc: false, errMsg: 'bbbbb' };
  }
}
