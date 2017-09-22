"use strict";

const path = require("path");
const fs = require("fs-extra");
const async = require("async");
const chalk = require("chalk");

var users = require("./users");

var errCtr = 0;
var idCtr = 0;

function resourceError(err, res, msg) {
  console.warn(chalk.red(msg));
  res.status(501).send("request error: " + msg);
}

function createSinglePathInfoGetter(abspath) {
  return function (callback) {
    fs.stat(abspath, function (err, stats) {
      var fkind = FileKind.Invalid;
      if (!err) {
        if (stats.isFile()) {
          fkind = FileKind.File;
        } else if (stats.isDirectory()) {
          fkind = FileKind.Directory;
        } else {
          fkind = FileKind.Other;
        }
      }
      callback(err, { name: abspath, kind: fkind });
    });
  };
}

function processForDisplay(info, root) {
  info.sort(function (a, b) {
    if (a.isfile !== b.isfile) {
      return a.isfile ? 1 : -1;
    } else {
      return a.shortname.localeCompare(b.shortname);
    }
  });
}

var FileKind;
(function (FileKind) {
  FileKind[(FileKind["Invalid"] = 0)] = "Invalid";
  FileKind[(FileKind["File"] = 1)] = "File";
  FileKind[(FileKind["Directory"] = 2)] = "Directory";
  FileKind[(FileKind["Other"] = 3)] = "Other";
})(FileKind || (FileKind = {}));

function canonicalPath() {
  const args = Array.prototype.slice.call(arguments, 0);
  // var args = [];
  // for (var _i = 0; _i < arguments.length; _i++) {
  //   args[_i - 0] = arguments[_i];
  // }
  return path.normalize(path.join.apply(path, args));
}

function htmlEncodeContent(unsafe_str) {
  var escaped = unsafe_str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/\'/g, "&#39;");
  var wstrans = escaped
    .replace(/ /g, "&nbsp;")
    .replace(/(\r\n)|(\n)/g, "<br />")
    .replace(/\t/g, "&nbsp;&nbsp;&nbsp;&nbsp;");
  return wstrans;
}

function processFileLoadForDisplay(file_path, data) {
  var output = "";

  if (data === "") {
    output = "<em>The file '" + path.basename(file_path) + "' is empty!</em>";
  } else if (
    path.extname(file_path) === ".js" ||
    path.extname(file_path) === ".html"
  ) {
    var htmlstr = htmlEncodeContent(data.toString());
    output = "<code>" + htmlstr + "</code>";
  } else if (
    path.extname(file_path) === ".txt" ||
    path.extname(file_path) === ".log"
  ) {
    var htmlstr = htmlEncodeContent(data.toString());
    output = '<div class="plaintext">' + htmlstr + "</div>";
  } else {
    output =
      "<em>Cannot display the content of '" +
      path.basename(file_path) +
      "'.</em>";
  }

  return output;
}

function loadFileInfo(rootDir, req, res) {
  const user = users.getUser(req.params.userName);
  const subPath = req.params.subpath ? decodeURI(req.params.subpath) : '';
  var file_path = canonicalPath(rootDir, user.dataDirectory, subPath);

  var fileRequestTime = new Date().toISOString();
  console.log(`(${fileRequestTime}) -- start reading file ${file_path}`);

  fs.readFile(file_path, "utf8", function (err, data) {
    if (err) {
      var fileErrorTime = new Date().toISOString();
      resourceError(
        err,
        res,
        `(${fileErrorTime}) -- File not found ${file_path}`
      );
    } else {
      var fileResultTime = new Date().toISOString();
      console.log(`(${fileResultTime}) -- complete reading file ${file_path}`);

      var output = processFileLoadForDisplay(file_path, data);
      res.send(output);
    }
  });
}

function loadDirectoryInfo(rootDir, req, res, viewName, extraDir) {
  const userData = users.getUsers();
  const userName = req.params.userName || "";

  if (!userName) {
    res.render(viewName, {
      files: [],
      port: req.app.get("port"),
      users: userData,
      currentUser: undefined
    });
    return;
  }

  const badDir = path.join(rootDir, userName);
  const goodDir = path.join(rootDir, users.getUser(userName).dataDirectory);
  console.log(`reading directory from ${goodDir}`);

  var directoryRequestTime = new Date().toISOString();
  console.log(
    `(${directoryRequestTime}) -- start reading directory ${goodDir}`
  );

  fs.readdir(badDir, function (err, files) {
    if (err) {
      var directoryErrorTime = new Date().toISOString();
      resourceError(
        err,
        res,
        `(${directoryErrorTime}) -- Directory not found ${goodDir}`
      );
      return;
    }

    var flist = files.filter(function (value) {
      var fullpath = canonicalPath(badDir, value);
      var fps = fullpath.substr(0, badDir.length);
      return (
        fullpath.length > badDir.length &&
        fullpath.substr(0, badDir.length) === badDir
      );
    });

    var cblist = flist.map(function (value) {
      return createSinglePathInfoGetter(canonicalPath(badDir, value));
    });

    async.parallel(cblist, function (err, results) {
      var tresults = [];
      if (!err) {
        tresults = results
          .filter(function (value) {
            return (
              value.kind === FileKind.File || value.kind === FileKind.Directory
            );
          })
          .map(function (value) {
            var isfile = value.kind === FileKind.File;
            var id = "_eid" + idCtr++;
            var shortname =
              path.basename(value.name) + (isfile ? "" : path.sep);
            var encodedname = encodeURIComponent(
              value.name.substr(goodDir.length + 1) + (isfile ? "" : path.sep)
            );
            return {
              isfile: isfile,
              elemid: id,
              shortname: shortname,
              encodedname: encodedname
            };
          });
      }

      var directoryResultTime = new Date().toISOString();
      console.log(
        `(${directoryResultTime}) -- complete reading directory ${goodDir}`
      );

      processForDisplay(tresults, extraDir);
      res.render(viewName, {
        files: tresults,
        port: req.app.get("port"),
        users: userData,
        currentUser: userName
      });
    });
  });
}

exports = module.exports = {
  canonicalPath,
  loadFileInfo,
  loadDirectoryInfo
};
