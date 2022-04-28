"use strict";
var fs = require("fs");
var path = require("path");
var util = require("util");
var Promise = require("bluebird");
var read = require("read");
var readP = util.promisify(read);
var minimatch = require("minimatch");
// P H A S E  0
function checkIncludes(config) {
    config.excludes = config.excludes || [];
    if (!config.include || !config.include.length) {
        return Promise.reject({
            code: "NoIncludes",
            message: "You need to specify files to upload - e.g. ['*', '**/*']"
        });
    }
    else {
        return Promise.resolve(config);
    }
}
function getPassword(config) {
    if (config.password) {
        return Promise.resolve(config);
    }
    else {
        var options = {
            prompt: "Password for " +
                config.user +
                "@" +
                config.host +
                " (ENTER for none): ",
            default: "",
            silent: true
        };
        return readP(options).then(function (res) {
            var config2 = Object.assign(config, { password: res });
            return config2;
        });
    }
}
// Analysing local firstory
function canIncludePath(includes, excludes, filePath) {
    var go = function (acc, item) {
        return acc || minimatch(filePath, item, { matchBase: true });
    };
    var canInclude = includes.reduce(go, false);
    // Now check whether the file should in fact be specifically excluded
    if (canInclude) {
        // if any excludes match return false
        if (excludes) {
            var go2 = function (acc, item) {
                return acc && !minimatch(filePath, item, { matchBase: true });
            };
            canInclude = excludes.reduce(go2, true);
        }
    }
    // console.log("canIncludePath", include, filePath, res);
    return canInclude;
}
// A method for parsing the source location and storing the information into a suitably formated object
function parseLocal(includes, excludes, localRootDir, relDir) {
    // reducer
    var handleItem = function (acc, item) {
        var currItem = path.join(fullDir, item);
        var newRelDir = path.relative(localRootDir, currItem);
        if (fs.lstatSync(currItem).isDirectory()) {
            // currItem is a directory. Recurse and attach to accumulator
            var tmp = parseLocal(includes, excludes, localRootDir, newRelDir);
            for (var key in tmp) {
                if (tmp[key].length == 0) {
                    delete tmp[key];
                }
            }
            return Object.assign(acc, tmp);
        }
        else {
            // currItem is a file
            // acc[relDir] is always created at previous iteration
            if (canIncludePath(includes, excludes, newRelDir)) {
                // console.log("including", currItem);
                acc[relDir].push(item);
                return acc;
            }
        }
        return acc;
    };
    var fullDir = path.join(localRootDir, relDir);
    // Check if `startDir` is a valid location
    if (!fs.existsSync(fullDir)) {
        throw new Error(fullDir + " is not an existing location");
    }
    // Iterate through the contents of the `fullDir` of the current iteration
    var files = fs.readdirSync(fullDir);
    // Add empty array, which may get overwritten by subsequent iterations
    var acc = {};
    acc[relDir] = [];
    var res = files.reduce(handleItem, acc);
    return res;
}
function countFiles(filemap) {
    return Object.values(filemap).reduce(function (acc, item) { return acc.concat(item); })
        .length;
}
function deleteDir(ftp, dir) {
    return ftp.list(dir).then(function (lst) {
        var dirNames = lst
            .filter(function (f) { return f.type == "d" && f.name != ".." && f.name != "."; })
            .map(function (f) { return path.posix.join(dir, f.name); });
        var fnames = lst
            .filter(function (f) { return f.type != "d"; })
            .map(function (f) { return path.posix.join(dir, f.name); });
        // delete sub-directories and then all files
        return Promise.mapSeries(dirNames, function (dirName) {
            // deletes everything in sub-directory, and then itself
            return deleteDir(ftp, dirName).then(function () { return ftp.rmdir(dirName); });
        }).then(function () { return Promise.mapSeries(fnames, function (fname) { return ftp.delete(fname); }); });
    });
}
var mkDirExists = function (ftp, dir) {
    // Make the directory using recursive expand
    return ftp.mkdir(dir, true).catch(function (err) {
        if (err.message.startsWith("EEXIST")) {
            return Promise.resolve();
        }
        else {
            console.log("[mkDirExists]", err.message);
            // console.log(Object.getOwnPropertyNames(err));
            return Promise.reject(err);
        }
    });
};
module.exports = {
    checkIncludes: checkIncludes,
    getPassword: getPassword,
    parseLocal: parseLocal,
    canIncludePath: canIncludePath,
    countFiles: countFiles,
    mkDirExists: mkDirExists,
    deleteDir: deleteDir
};
