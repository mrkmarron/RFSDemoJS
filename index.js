'use strict';

var chalk = require('chalk');
var express = require('express');
var path = require('path');
var util = require('./util');

 // setup credentials for cloud trace management
 require('./DiagnosticsBuddy/index.js').enableAzureUploads();

// set tracing options for demo purposes
if (process.jsEngine && process.jsEngine === 'chakracore') {
  var trace_mgr = require('trace_mgr');
  trace_mgr.setOptions({ initialRates: {
    emitOnLogWarn: 1.0,
    emitOnLogError: 0.25,
    emitOnAssert: 1.0
  }});
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

app.listen(3000, function () {
  var msg = {
    engine: chalk.green(process.jsEngine ? process.jsEngine : 'v8'),
    port: "3000",
    pid: process.pid
  }
  console.log(msg);
}); 

