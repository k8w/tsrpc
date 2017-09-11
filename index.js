const express = require('express')
const app = express()

app.disable('x-powered-by');
app.use(require('body-parser').raw({ limit: Infinity, type: ()=>true }));

app.use(function (req, res) {
    console.log(req.path)
    console.log(req.body.toString())
    res.send(new Buffer('Hello world'))
})

app.listen(3000, function () {
    console.log('Example app listening on port 3000!')
})