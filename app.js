"use strict";
var Console = require('console');
var Process = require('process');
var Express = require('express');
var Util = require('./util');

//Add support for Azure upload
if (Process.jsEngine === 'chakracore') {
    /*
    //Update this code to use your copy of diagnostics buddy if desired
    
    Console.log('Setting up Azure trace uploader.');  
    var traceMgr = require('trace_mgr');
    var diagBuddy = require(__dirname + '\\DiagnosticsBuddy\\index.js');

    var initDemoSampleRates = {emitOnLogWarn: 1.0, emitOnLogError: 0.25, emitOnAssert: 1.0 };
    traceMgr.setOptions({ remoteTraceManagerObj: diagBuddy.AzureManager, initialRates: initDemoSampleRates });
    */

    var traceMgr = require('trace_mgr');
    var initDemoSampleRates = {emitOnLogWarn: 1.0, emitOnLogError: 0.25, emitOnAssert: 1.0 };
    traceMgr.setOptions({ initialRates: initDemoSampleRates });
}

var s_rootDir = Util.canonicalPath(__dirname, 'testdata');

var app = Express();
app.set('view engine', 'ejs');
app.set('views', Util.canonicalPath(__dirname, 'views'));

function noCache(req, res, next) {
    res.setHeader('Cache-Control', 'no-cache');
    next();
}

app.get('/', noCache, function (req, res) {
    Console.log(`${new Date().toISOString()}: new connection from ${req.ip.slice(req.ip.lastIndexOf(':') + 1)}`);
    Util.loadDirectoryInfo(s_rootDir, req, res, 'index.ejs', s_rootDir);
});
app.get('/subdir/', noCache, function (req, res) {
    Util.loadDirectoryInfo(s_rootDir, req, res, 'dir.ejs');
});
app.get('/subdir/:subpath', noCache, function (req, res) {
    Util.loadDirectoryInfo(s_rootDir, req, res, 'dir.ejs');
});
app.get('/contents/:subpath', noCache, function (req, res) {
    Util.loadFileInfo(s_rootDir, req, res);
});

app.use(function (err, req, res, next) {
    Console.error(err.stack);
    res.status(500).send('Something broke!');
});

app.listen(3000, function () {
    Console.log(`Server running ${Process.jsEngine ? Process.jsEngine : 'v8'} and listening on port 3000`);
});
