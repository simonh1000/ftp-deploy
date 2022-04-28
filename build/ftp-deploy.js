"use strict";
var upath = require("upath");
var util = require("util");
var events = require("events");
var Promise = require("bluebird");
var fs = require("fs");
var PromiseFtp = require("promise-ftp");
var PromiseSftp = require("ssh2-sftp-client");
var lib = require("./lib");
/* interim structure
{
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
}
*/
var FtpDeployer = function () {
    var _this = this;
    // The constructor for the super class.
    events.EventEmitter.call(this);
    this.ftp = null;
    this.eventObject = {
        totalFilesCount: 0,
        transferredFileCount: 0,
        filename: "",
    };
    this.makeAllAndUpload = function (remoteDir, filemap) {
        var _this = this;
        var keys = Object.keys(filemap);
        return Promise.mapSeries(keys, function (key) {
            // console.log("Processing", key, filemap[key]);
            return _this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    };
    this.makeDir = function (newDirectory) {
        if (newDirectory === "/") {
            return Promise.resolve("unused");
        }
        else {
            return this.ftp.mkdir(newDirectory, true);
        }
    };
    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.makeAndUpload = function (config, relDir, fnames) {
        var newDirectory = upath.join(config.remoteRoot, relDir);
        return _this.makeDir(newDirectory, true).then(function () {
            // console.log("newDirectory", newDirectory);
            return Promise.mapSeries(fnames, function (fname) {
                var tmpFileName = upath.join(config.localRoot, relDir, fname);
                var tmp = fs.readFileSync(tmpFileName);
                _this.eventObject["filename"] = upath.join(relDir, fname);
                _this.emit("uploading", _this.eventObject);
                return _this.ftp
                    .put(tmp, upath.join(config.remoteRoot, relDir, fname))
                    .then(function () {
                    _this.eventObject.transferredFileCount++;
                    _this.emit("uploaded", _this.eventObject);
                    return Promise.resolve("uploaded " + tmpFileName);
                })
                    .catch(function (err) {
                    _this.eventObject["error"] = err;
                    _this.emit("upload-error", _this.eventObject);
                    // if continue on error....
                    return Promise.reject(err);
                });
            });
        });
    };
    // connects to the server, Resolves the config on success
    this.connect = function (config) {
        _this.ftp = config.sftp ? new PromiseSftp() : new PromiseFtp();
        // sftp client does not provide a connection status
        // so instead provide one ourselfs
        if (config.sftp) {
            _this.connectionStatus = "disconnected";
            _this.ftp.on("end", _this.handleDisconnect);
            _this.ftp.on("close", _this.handleDisconnect);
        }
        return _this.ftp
            .connect(config)
            .then(function (serverMessage) {
            _this.emit("log", "Connected to: " + config.host);
            _this.emit("log", "Connected: Server message: " + serverMessage);
            // sftp does not provide a connection status
            // so instead provide one ourself
            if (config.sftp) {
                _this.connectionStatus = "connected";
            }
            return config;
        })
            .catch(function (err) {
            return Promise.reject({
                code: err.code,
                message: "connect: " + err.message,
            });
        });
    };
    this.getConnectionStatus = function () {
        // only ftp client provides connection status
        // sftp client connection status is handled using events
        return typeof _this.ftp.getConnectionStatus === "function"
            ? _this.ftp.getConnectionStatus()
            : _this.connectionStatus;
    };
    this.handleDisconnect = function () {
        _this.connectionStatus = "disconnected";
    };
    // creates list of all files to upload and starts upload process
    this.checkLocalAndUpload = function (config) {
        try {
            var filemap = lib.parseLocal(config.include, config.exclude, config.localRoot, "/");
            // console.log(filemap);
            _this.emit("log", "Files found to upload: " + JSON.stringify(filemap));
            _this.eventObject["totalFilesCount"] = lib.countFiles(filemap);
            return _this.makeAllAndUpload(config, filemap);
        }
        catch (e) {
            return Promise.reject(e);
        }
    };
    // Deletes remote directory if requested by config
    // Returns config
    this.deleteRemote = function (config) {
        if (config.deleteRemote) {
            return lib
                .deleteDir(_this.ftp, config.remoteRoot)
                .then(function () {
                _this.emit("log", "Deleted directory: " + config.remoteRoot);
                return config;
            })
                .catch(function (err) {
                _this.emit("log", "Deleting failed, trying to continue: " +
                    JSON.stringify(err));
                return Promise.resolve(config);
            });
        }
        return Promise.resolve(config);
    };
    this.deploy = function (config, cb) {
        var _this = this;
        return lib
            .checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect)
            .then(this.deleteRemote)
            .then(this.checkLocalAndUpload)
            .then(function (res) {
            _this.ftp.end();
            if (typeof cb == "function") {
                cb(null, res);
            }
            else {
                return Promise.resolve(res);
            }
        })
            .catch(function (err) {
            console.log("Err", err.message);
            if (_this.ftp && _this.getConnectionStatus() != "disconnected")
                _this.ftp.end();
            if (typeof cb == "function") {
                cb(err, null);
            }
            else {
                return Promise.reject(err);
            }
        });
    };
};
util.inherits(FtpDeployer, events.EventEmitter);
module.exports = FtpDeployer;
