'use strict';

var chalk = require('chalk');
var express = require('express');
var path = require('path');
var process = require('process');
var util = require('./util');
var fs = require('fs');

 // setup credentials for cloud trace management
 require('./DiagnosticsBuddy/index.js').enableAzureUploads();

console.log('process.env.DO_TTD_RECORD is [' + process.env.DO_TTD_RECORD + ']');
console.log('process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS is [' + process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS + ']');
console.log('path.resolve(\'./\' is [' + path.resolve('./') + ']')

// set tracing options for demo purposes
if (process.jsEngine && process.jsEngine === 'chakracore') {
  var trace_mgr = require('trace_mgr');
  trace_mgr.setOptions({ initialRates: {
    emitOnLogWarn: 1.0,
    emitOnLogError: 0.25,
    emitOnAssert: 1.0,
    localTraceDirectory: __dirname
  }});
}

if (!fs.existsSync('_tmptmptmp')) {
    fs.mkdirSync('_tmptmptmp');
}
if (!fs.existsSync('_diagnosticTraces')) {
  fs.mkdirSync('_diagnosticTraces');
}

const DATA_DIR = path.resolve(__dirname, 'testdata');

var app = express();
app.set('view engine', 'ejs');
app.set('views', path.resolve(__dirname, 'views'));

function noCache(req, res, next) {
  res.setHeader('Cache-Control', 'no-cache');
  next();
}

app.get('/', noCache, function (req, res) {
  console.log(`${new Date().toISOString()}: new connection from ${req.ip.slice(req.ip.lastIndexOf(':') + 1)}`);
  util.loadDirectoryInfo(DATA_DIR, req, res, 'index.ejs', DATA_DIR);
});

app.get('/subdir/', noCache, function (req, res) {
  util.loadDirectoryInfo(DATA_DIR, req, res, 'dir.ejs');
});

app.get('/subdir/:subpath', noCache, function (req, res) {
  util.loadDirectoryInfo(DATA_DIR, req, res, 'dir.ejs');
});

app.get('/contents/:subpath', noCache, function (req, res) {
  util.loadFileInfo(DATA_DIR, req, res);
});

app.use(function (err, req, res, next) {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

/**
 * Normalize a port into a number, string, or false.
 */

function normalizePort(val) {
  var port = parseInt(val, 10);

  if (isNaN(port)) {
    // named pipe
    return val;
  }

  if (port >= 0) {
    // port number
    return port;
  }

  return false;
}

var port = normalizePort(process.env.PORT || '3000');
app.set('port', port);

var server = app.listen(port, function () {
  var addr = server.address();
  var msg = {
    engine: chalk.green(process.jsEngine ? process.jsEngine : 'v8'),
    port: addr.port,
    pid: process.pid
  }
  console.log(msg);
}); 

