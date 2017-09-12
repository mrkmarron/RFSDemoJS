"use strict";

var assert = require('assert');
var async = require('async');
var storage = require('azure-storage');
var fs = require('fs');
var path = require('path');
var process = require('process');
var zlib = require('zlib');

//////////////
//Shared functionality

function loadRemoteAccessInfo() {
    var res = undefined;
    try {
        if (process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS) {
            res = JSON.parse(process.env.DIAGNOSTICS_BUDDY_STORAGE_CREDENTIALS);
        }
        else {
            const moduleroot = path.dirname(require.main.filename);
            const configPath = path.resolve(moduleroot, 'azureconfig.json');
            res = JSON.parse(fs.readFileSync(configPath));
        }
    }
    catch (ex) {
        ;
    }

    return res;
}
exports.loadRemoteAccessInfo = loadRemoteAccessInfo;

function checkRemoteAccessInfo(accessInfo) {
    return accessInfo && (accessInfo.remoteShare && accessInfo.remoteUser && accessInfo.storageKey);
}
exports.checkRemoteAccessInfo = checkRemoteAccessInfo;

function uploadFileToAzure(localFile, remoteFile, accessInfo, callback) {
    assert(checkRemoteAccessInfo(accessInfo));

    const azureService = storage.createFileService(accessInfo.remoteUser, accessInfo.storageKey);
    azureService.createFileFromLocalFile(accessInfo.remoteShare, '', remoteFile, localFile, (err) => {
        callback(err);
    });
}
exports.uploadFileToAzure = uploadFileToAzure;

function downloadFileFromAzure(remoteFile, localFile, accessInfo, callback) {
    assert(checkRemoteAccessInfo(accessInfo));

    const azureService = storage.createFileService(accessInfo.remoteUser, accessInfo.storageKey);
    azureService.getFileToLocalFile(accessInfo.remoteShare, '', remoteFile, localFile, (err) => {
        callback(err);
    });
}
exports.downloadFileFromAzure = downloadFileFromAzure;

function removeFileFromAzure(remoteFile, accessInfo, callback) {
    assert(checkRemoteAccessInfo(accessInfo));

    const azureService = storage.createFileService(accessInfo.remoteUser, accessInfo.storageKey);
    azureService.deleteFileIfExists(accessInfo.remoteShare, '', remoteFile, (err, result) => {
        callback(err, result);
    });
}
exports.removeFileFromAzure = removeFileFromAzure;

function listFilesFromAzure(accessInfo, callback) {
    assert(checkRemoteAccessInfo(accessInfo));

    const azureService = storage.createFileService(accessInfo.remoteUser, accessInfo.storageKey);
    azureService.listFilesAndDirectoriesSegmentedWithPrefix(accessInfo.remoteShare, '', undefined, null, (err, result) => {
        callback(err, result.entries.files.map((fentry) => fentry.name));
    });
}
exports.listFilesFromAzure = listFilesFromAzure;

//////////////
//Compression functionality

const headerEntrySize = 32 + 32 + 32; //name startpos length\n

function traceCompressor(traceDir, targetFile, completeCallBack) {
    fs.readdir(traceDir, (direrr, compressFiles) => {
        if (direrr) { return completeCallBack(direrr); }

        const headerblockLength = 32 + compressFiles.length * headerEntrySize;
        let headerInfo = compressFiles.length.toString().padEnd(31) + '\n';

        function extendHeader(file, startPos, length) {
            let hval = (path.basename(file) + ' ' + startPos + ' ' + length).padEnd(headerEntrySize - 1) + '\n';
            headerInfo += hval;
        }

        function writeFinalHeaders() {
            fs.open(targetFile, 'r+', (wfherr, fd) => {
                if (wfherr) { return completeCallBack(wfherr); }

                const headerBuff = new Buffer(headerInfo);
                assert(headerBuff.length === headerInfo.length && headerInfo.length === headerblockLength);

                fs.write(fd, headerBuff, 0, headerBuff.length, 0, (hwerr, hbytes) => {
                    if (hwerr) { return completeCallBack(hwerr); }

                    fs.close(fd, (closeerr) => {
                        completeCallBack(closeerr);
                    });
                });
            });
        }

        let currentDataPos = headerblockLength;
        fs.writeFile(targetFile, new Buffer(headerblockLength), (ierr) => {
            if (ierr) { return completeCallBack(ierr); }

            function writeData(file, cb) {
                const inp = fs.createReadStream(file);
                const out = fs.createWriteStream(targetFile, { flags: "a" });

                out.on('close', () => {
                    extendHeader(file, currentDataPos, out.bytesWritten);
                    currentDataPos += out.bytesWritten;
                    cb(null);
                });
                out.on('error', (perr) => {
                    cb(perr);
                });

                const defl = zlib.createDeflate();
                inp.pipe(defl).pipe(out);
            }

            const filecbArray = compressFiles.map((file) => {
                return function (cb) {
                    writeData(path.join(traceDir, file), cb);
                }
            });

            async.series(
                filecbArray,
                function (err) {
                    if (err) { return completeCallBack(err); }

                    writeFinalHeaders();
                }
            );
        });
    });
}
exports.traceCompressor = traceCompressor;

function traceDecompressor(traceFile, targetDir, completeCallBack) {
    function extractHeaderInfo(cb) {
        fs.open(traceFile, 'r', (oerr, fd) => {
            if (oerr) { return completeCallBack(oerr); }

            const psizeBuff = new Buffer(32);
            fs.read(fd, psizeBuff, 0, psizeBuff.length, 0, (sizeerr, sizebytes, sizebuff) => {
                if (sizeerr) { return cb(sizeerr); }

                const headerblockCount = Number.parseInt(sizebuff.toString());
                if (Number.isNaN(headerblockCount)) { return cb(new Error('Failed to parse header info')); }

                const headerblockLength = 32 + headerblockCount * headerEntrySize;
                const pheadersBuff = new Buffer(headerblockLength);
                fs.read(fd, pheadersBuff, 0, pheadersBuff.length, 0, (herr, headersBytes, headersBuff) => {
                    if (herr) { return cb(herr); }

                    const headersLines = headersBuff.toString().split('\n');
                    const headers = headersLines.slice(1, headersLines.length - 1).map((headerStr) => {
                        const components = headerStr.split(/\s+/);
                        const startNumber = Number.parseInt(components[1]);
                        const lengthNumber = Number.parseInt(components[2]);
                        if (Number.isNaN(startNumber) || Number.isNaN(lengthNumber)) { return cb(new Error('Failed to parse file entry.')); }

                        return { file: components[0], startOffset: startNumber, length: lengthNumber };
                    });

                    fs.close(fd, (cerr) => {
                        if (sizeerr) { return cb(cerr); }
                        cb(null, headers);
                    });
                });
            });
        });
    }

    function extractFile(headerInfo, cb) {
        const inp = fs.createReadStream(traceFile, { start: headerInfo.startOffset, end: headerInfo.startOffset + headerInfo.length - 1 });
        const out = fs.createWriteStream(path.join(targetDir, headerInfo.file));

        out.on('close', () => {
            cb(null);
        });
        out.on('error', (perr) => {
            cb(perr);
        });

        const defl = zlib.createInflate();
        inp.pipe(defl).pipe(out);
    }

    extractHeaderInfo((err, headers) => {
        if (err) { return completeCallBack(err); }

        const filecbArray = headers.map((header) => {
            return function (cb) {
                extractFile(header, cb);
            }
        });

        async.series(
            filecbArray,
            function (serr) {
                return completeCallBack(serr);
            }
        );
    });
}
exports.traceDecompressor = traceDecompressor;


