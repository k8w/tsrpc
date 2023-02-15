const http = require('http');

async function main() {
  console.log('Start');
  let server = http.createServer({}, (req, res) => {
    console.log('REQ', req.method, req.url);
    console.log('headers', JSON.stringify(req.headers, null, 2));

    req.on('data', (v) => {
      console.log('onData', v.toString());
      res.end();
    });
  });

  await new Promise((rs) => {
    server.listen(3000, () => {
      console.log('Server started at 3000');
      setTimeout(() => {
        rs();
      }, 1000);
    });
  });

  console.log('Prepare req');
  let req = http.request('http://127.0.0.1:3000/a/b/c?a=111&b=222&c=333', {
    method: 'POST',
    headers: {
      aaaaaaaa: 'AAAAAAAAAAAAAAAA',
      bbbbbbbbbb: 'BBBBBBBBBBBBB',
    },
  });

  await new Promise((rs) => setTimeout(() => rs(), 200));
  console.log('HERE 1, write 1111111111');
  // req.write('111111111111111111111111111111111')
  await new Promise((rs) => setTimeout(() => rs(), 200));
  console.log('HERE 2');
  req.setHeader('ccccc', 'CCCCCCCCCCCCC');
  // req.flushHeaders();
  await new Promise((rs) => setTimeout(() => rs(), 200));
  console.log('HERE 3');
  req.setHeader('dddddd', 'DDDDDDDDDDDDDD');
  req.flushHeaders();
  console.log('write 222222222');
  req.write('222222222222222222222222222222');
  await new Promise((rs) => setTimeout(() => rs(), 200));
  req.end();

  console.log('end');

  // await new Promise(rs => setTimeout(() => rs, 1000));
}
main();
