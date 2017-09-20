"use strict";

var async = require('async');
var commander = require('commander');
var fs = require('fs');
var fsextra = require('fs-extra');
var path = require('path');
var process = require('process');
var tmp = require('tmp');

var lib = require('./lib.js');

commander
    .version('0.0.1')
    .usage('<options>')
    .option('--upload <trace>', 'Process and upload the specified diagnostics trace directory.')
    .option('--download <trace>', 'Process and download the specified diagnostics trace.')
    .option('--remove <trace>', 'Remove the specified from the cloud if it exists.')
    .option('--list', 'List all of the traces currently in the cloud store.')
    .option('--compress <trace>', 'Compress the specified trace directory.')
    .option('--decompress <trace>', 'Remove the specified from the cloud if it exists.')
    .option('--location <location>', 'Specify the directory name to download a diagnostics trace.')
    .parse(process.argv);

var accessCredentials = lib.loadRemoteAccessInfo();

function ensureCredentials() {
    if(!lib.checkRemoteAccessInfo(accessCredentials)) {
        process.stderr.write(`Access credentials not found or invlaid: ${accessCredentials}\n`);
        process.exit(1);
    }
}

if (commander.upload) {
    ensureCredentials();

    var traceDir = ensureTraceDir(commander.upload);
    const startTime = new Date();
    processTraceUpload(traceDir, commander.location, accessCredentials, (err) => {
        if (err) {
            process.stderr.write('Failed to upload trace: ' + err + '\n');
            process.exit(1);
        }
        else {
            process.stdout.write(`Completed upload in ${(new Date() - startTime) / 1000}s.\n`);
        }
    });
}
else if (commander.download) {
    ensureCredentials();

    var remoteFileName = commander.download;
    var targetDir = ensureTraceTargetDir(commander.location);
    if (targetDir) {
        const startTime = new Date();
        processTraceDownload(remoteFileName, targetDir, accessCredentials, (err) => {
            if (err) {
                process.stderr.write('Failed to download trace: ' + err + '\n');
                process.exit(1);
            }
            else {
                process.stdout.write(`Completed download in ${(new Date() - startTime) / 1000}s.\n`);
            }
        });
    }
    else {
        process.stderr.write(`${commander.location} is not empty and does not look like an old trace location.\n`);
        process.stderr.write(`--Skipping download to avoid any accidental data loss.\n`)
    }
}
else if (commander.remove) {
    ensureCredentials();

    lib.removeFileFromAzure(commander.remove, accessCredentials, (err, result) => {
        if (err) {
            process.stderr.write('Failed with error: ' + err + '\n');
            process.exit(1);
        }

        if (result) {
            process.stdout.write(`Deleted trace.\n`);
        }
        else {
            process.stdout.write(`No trace with the name "${commander.remove}" was found.\n`);
        }
    });
}
else if (commander.list) {
    ensureCredentials();
    
    lib.listFilesFromAzure(accessCredentials,(err, files) => {
        if (err) {
            process.stderr.write('Failed with error: ' + err + '\n');
            process.exit(1);
        }

        process.stdout.write('Traces on remote:\n');
        files.map((file) => {
            process.stdout.write('    ' + file + '\n');
        });
    });
}
else if (commander.compress) {
    var traceDir = ensureTraceDir(commander.compress);
    const startTime = new Date();
    lib.traceCompressor(traceDir, commander.location || path.basename(traceDir) + '.trc', (err) => {
        if (err) {
            process.stderr.write('Failed with error: ' + err + '\n');
            process.exit(1);
        }

        process.stdout.write(`Completed compression in ${(new Date() - startTime) / 1000}s.\n`);
    });
}
else if (commander.decompress) {
    var traceDir = ensureTraceTargetDir(commander.location);
    if (traceDir) {
        const startTime = new Date();
        lib.traceDecompressor(commander.decompress, traceDir, (err) => {
            if (err) {
                process.stderr.write('Failed with error: ' + err + '\n');
                process.exit(1);
            }

            process.stdout.write(`Completed decompression in ${(new Date() - startTime) / 1000}s.\n`);
        });
    }
    else {
        process.stderr.write(`${commander.location} is not empty and does not look like an old trace location.\n`);
        process.stderr.write(`--Skipping download to avoid any accidental data loss.\n`)
    }
}
else {
    commander.help();
}

////////////////////////////////

function dirLooksLikeTrace(trgtDir) {
    try {
        if (fs.existsSync(trgtDir)) {
            var contents = fs.readdirSync(trgtDir).filter((value) => !value.startsWith('.'));

            if (contents.length !== 0 && contents.indexOf('ttdlog.log') === -1) {
                //This doesn't look like an old trace directory!
                //We don't want to accidentally blow away user data.
                return false;
            }
        }
    } catch (ex) {
        return false;
    }

    return true;
}

//Ensure the trace dir looks like a TTD log dir.
function ensureTraceDir(traceDirName) {
    var dname = path.resolve(traceDirName);
    var lname = path.resolve(dname, 'ttdlog.log');
    if (fs.existsSync(dname) && fs.existsSync(lname)) {
        return dname;
    }
    else {
        if (!fs.existsSync(dname)) {
            console.error('Directory does not exist: ' + traceDirName);
        }
        else {
            console.error('Directory does not contain a diagnostics trace log: ' + traceDirName);
        }

        process.exit(1);
    }
}

//Create the target dir name we want to expand into and make sure it is ready to extract data into
function ensureTraceTargetDir(optTargetDirName) {
    var trgtDir = path.resolve(process.cwd(), '_tracelog' + path.sep);
    if (optTargetDirName) {
        trgtDir = path.resolve(optTargetDirName);
    }

    if (!dirLooksLikeTrace(trgtDir)) {
        return undefined;
    }

    fsextra.emptyDirSync(trgtDir);
    return trgtDir;
}

//Do the processing for the trace upload
function processTraceUpload(traceDirName, remoteName, accessCredentials, completecallback) {
    tmp.file({ postfix: '.trc' }, (err, tempfile) => {
        if (err) { return completecallback(err) };

        var remoteFile = remoteName || path.basename(traceDirName) + '.trc';

        var actionPipeline = [
            function (callback) {
                lib.traceCompressor(traceDirName, tempfile, callback);
            },
            function (callback) {
                lib.uploadFileToAzure(tempfile, remoteFile, accessCredentials, callback);
            }
        ];

        async.series(actionPipeline, completecallback);
    });
}

function processTraceDownload(remoteFileName, targetDir, accessCredentials, completecallback) {
    //tmp cleans up automatically on completion
    tmp.file({ postfix: '.trc' }, (err, tempfile) => {
        if (err) { return completecallback(err) };

        var actionPipeline = [
            function (callback) {
                lib.downloadFileFromAzure(path.basename(remoteFileName), tempfile, accessCredentials, callback);
            },
            function (callback) {
                lib.traceDecompressor(tempfile, targetDir, callback);
            }
        ];

        async.series(actionPipeline, completecallback);
    });
}
