"use strict";

var assert = require('assert');
var fs = require('fs');
var path = require('path');
var process = require('process');
var childProcess = require('child_process');

var launchExe = (process.platform === 'win32') ? 'node.exe' : 'node';

function uploadTraceSync(resolvedPath) {
    try {
        var tracename = path.basename(resolvedPath) + '.trc';
        process.stderr.write(`    Uploading ${resolvedPath} to ${tracename} in Azure storage (Sync).\n`);
        var cmd = `${launchExe} ${path.resolve(__dirname, 'app.js')} --upload ${resolvedPath}`;
        var envval = storageCredentialJSON ? { DO_TTD_RECORD: 0, DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS: JSON.stringify(storageCredentialJSON) } : { DO_TTD_RECORD: 0 };

        var startTime = new Date();
        childProcess.execSync(cmd, { env: envval });

        process.stderr.write(`Completed upload of ${resolvedPath} in ${(new Date() - startTime) / 1000}s.\n`);
    }
    catch (ex) {
        process.stderr.write(`    Faild to write error trace -- ${ex}\n`);
    }
}

function uploadTraceAsync(resolvedPath) {
    try {
        var tracename = path.basename(path.dirname(resolvedPath)) + '_' + path.basename(resolvedPath) + '.trc'
        process.stderr.write(`    Uploading ${resolvedPath} to ${tracename} in Azure storage (Async).\n`);
        var cmd = `${launchExe} ${path.resolve(__dirname, 'app.js')} --upload ${resolvedPath} --location ${tracename}`;
        var envval = storageCredentialJSON ? { DO_TTD_RECORD: 0, DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS: JSON.stringify(storageCredentialJSON) } : { DO_TTD_RECORD: 0 };

        var startTime = new Date();
        childProcess.exec(cmd, { env: envval }, function (err, stdout, stderr) {
            if (err) {
                process.stderr.write(`Failed to upload ${cmd} -- err is ${err} stderr is ${stderr} stdout is ${stdout}\n`);
            }

            process.stderr.write(`Completed upload of ${resolvedPath} in ${(new Date() - startTime) / 1000}s.\n`);
        });
    }
    catch (ex) {
        process.stderr.write(`    Faild to write error trace -- ${ex}\n`);
    }
}

var storageCredentialJSON = undefined;

function enableAzureUploads(credentials) {
    const AzureManager = {
        "uploadTraceSync": uploadTraceSync,
        "uploadTraceAsync": uploadTraceAsync
    };

    storageCredentialJSON = credentials || loadRemoteAccessInfo();

    if (process.jsEngine && process.jsEngine === 'chakracore') {
        if (!checkRemoteAccessInfo(storageCredentialJSON)) {
            process.stdout.write(`No cloud credentials found -- only local traces will be written.\n`);
        }
        else {
            require('trace_mgr').setOptions({
                remoteTraceManagerObj: AzureManager
            });
        }
    }
}
exports.enableAzureUploads = enableAzureUploads

function loadRemoteAccessInfo() {
    var res = undefined;
    try {
        if (process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS) {
            res = JSON.parse(process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS);
        }
        else {
            const moduleroot = path.dirname(require.main.filename);
            const configPath = path.resolve(moduleroot, 'azureconfig.json');

            const contents = fs.readFileSync(configPath);
            res = JSON.parse(contents);
        }
    }
    catch (ex) {
        ;
    }

    return res;
}

function checkRemoteAccessInfo(accessInfo) {
    return accessInfo && (accessInfo.remoteShare && accessInfo.remoteUser && accessInfo.storageKey);
}