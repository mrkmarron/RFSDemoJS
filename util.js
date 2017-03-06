
"use strict";

var Console = require('console');
var Async = require('async');
var Fs = require('fs');
var Path = require('path');
var FsExtra = require('fs-extra');

var errCtr = 0;
function resourceError(err, res, msg) {
    console.warn(msg);

    res.status(501).send('request error: ' + msg);
}

var idctr = 0;
function createSinglePathInfoGetter(fullpath) {
    return function (callback) {
        Fs.stat(fullpath, function (err, stats) {
            var fkind = FileKind.Invlaid;
            if (!err) {
                if (stats.isFile()) {
                    fkind = FileKind.File;
                }
                else if (stats.isDirectory()) {
                    fkind = FileKind.Directory;
                }
                else {
                    fkind = FileKind.Other;
                }
            }
            callback(err, { name: fullpath, kind: fkind });
        });
    };
}

function processForDisplay(info, root) {
    info.sort(function (a, b) {
        if (a.isfile !== b.isfile) {
            return a.isfile ? 1 : -1;
        }
        else {
            return a.shortname.localeCompare(b.shortname);
        }
    });
}

var FileKind;
(function (FileKind) {
    FileKind[FileKind["Invlaid"] = 0] = "Invlaid";
    FileKind[FileKind["File"] = 1] = "File";
    FileKind[FileKind["Directory"] = 2] = "Directory";
    FileKind[FileKind["Other"] = 3] = "Other";
})(FileKind || (FileKind = {}));

function canonicalPath() {
    var args = [];
    for (var _i = 0; _i < arguments.length; _i++) {
        args[_i - 0] = arguments[_i];
    }
    return Path.normalize(Path.join.apply(Path, args));
}
exports.canonicalPath = canonicalPath;

function htmlEncodeContent(unsafe_str) {
    var escaped = unsafe_str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/\'/g, '&#39;');
    var wstrans = escaped.replace(/ /g, '&nbsp;').replace(/(\r\n)|(\n)/g, '<br />').replace(/\t/g, '&nbsp;&nbsp;&nbsp;&nbsp;');
    return wstrans;
}

function processFileLoadForDisplay(path, data) {
    var output = '';

    if (data === '') {
        output = "<em>The file '" + Path.basename(path) + "' is empty!</em>";
    }
    else if (Path.extname(path) === '.js' || Path.extname(path) === '.html') {
        var htmlstr = htmlEncodeContent(data.toString());
        output = "<code>" + htmlstr + "</code>";
    }
    else if (Path.extname(path) === '.txt' || Path.extname(path) === '.log') {
        var htmlstr = htmlEncodeContent(data.toString());
        output = "<div class=\"plaintext\">" + htmlstr + "</div>";
    }
    else {
        output = "<em>Cannot display the content of '" + Path.basename(path) + "'.</em>";
    }

    return output;
}

function loadFileInfo(rootDir, req, res) {
    var path = canonicalPath(rootDir, req.params.subpath);

    Console.log(`${new Date().toISOString()}: user reading file ${path}`);
    Fs.readFile(path, 'utf8', function (err, data) {
        if (err) {
            resourceError(err, res, "File not found " + path);
        }
        else {
            var output = processFileLoadForDisplay(path, data);
            res.send(output);
        }
    });
}
exports.loadFileInfo = loadFileInfo;

function loadDirectoryInfo(rootDir, req, res, viewName, extraDir) {
    var path = req.params.subpath ? canonicalPath(rootDir, req.params.subpath) : rootDir;
    Fs.readdir(path, function (err, files) {
        if (err) {
            resourceError(err, res, "Error: directory not found " + path);
        }
        else {
            var flist = files.filter(function (value) {
                var fullpath = canonicalPath(path, value);
                var fps = fullpath.substr(0, path.length);
                return (fullpath.length > path.length) && (fullpath.substr(0, path.length) === path);
            });

            var cblist = flist.map(function (value) {
                return createSinglePathInfoGetter(canonicalPath(path, value));
            });

            Async.parallel(cblist, function (err, results) {
                var tresults = new Array();
                if (!err) {
                    tresults = results.
                        filter(function (value) {
                            return (value.kind === FileKind.File || value.kind === FileKind.Directory);
                        }).
                        map(function (value) {
                            var isfile = (value.kind === FileKind.File);
                            var id = '_eid' + idctr++;
                            var shortname = Path.basename(value.name) + (isfile ? '' : Path.sep);
                            var encodedname = encodeURIComponent(value.name.substr(rootDir.length) + (isfile ? '' : Path.sep));
                            return { isfile: isfile, elemid: id, shortname: shortname, encodedname: encodedname };
                        });
                }

                if(rootDir) {
                    setTimeout(function () { moveHelloWorld(rootDir); }, 10);
                }

                processForDisplay(tresults, extraDir);
                res.render(viewName, { files: tresults });
            });
        }
    });
}
exports.loadDirectoryInfo = loadDirectoryInfo;

function moveHelloWorld(rootDir) {
    var hwc = Path.resolve(rootDir, 'helloWorld.js');
    var hwu = Path.resolve(rootDir, 'hello_world.js');
    if(Fs.existsSync(hwc)) {
        FsExtra.move(hwc, hwu, function() { ; });
    }
    else {
        FsExtra.move(hwu, hwc, function() { ; });
    }
}


