"use strict";

const upath = require("upath");
const util = require("util");
const events = require("events");
const fs = require("fs");

var PromiseFtp = require("promise-ftp");
var PromiseSftp = require("ssh2-sftp-client");
const lib = require("./lib");

// This is a fixed version of the lastMod function to be applied to node-ftp
// It is applied in the connect function, see the comment containing "node-ftp hack fix"
// The fix entails adding 'Z' to the date time before creating the Date object, so
// that the Date object understands that it is being created from a GMT time.
// A pull request has been sent here: https://github.com/icetee/node-ftp/pull/24
// that fixes the problem upstream. Remove this hack once the PR is merged.
const XRegExp = require('xregexp').XRegExp;
const REX_TIMEVAL = XRegExp.cache('^(?<year>\\d{4})(?<month>\\d{2})(?<date>\\d{2})(?<hour>\\d{2})(?<minute>\\d{2})(?<second>\\d+)(?:.\\d+)?$')                    
const fixedLastMod= function(path, cb) {
    var self = this;
    this._send('MDTM ' + path, function(err, text, code) {
        if (code === 502) {
            return self.list(path, function(err, list) {
                if (err)
                    return cb(err);
                if (list.length === 1)
                    cb(undefined, list[0].date);
                else
                    cb(new Error('File not found'));
            }, true);
        } else if (err)
            return cb(err);
        var val = XRegExp.exec(text, REX_TIMEVAL), ret;
        if (!val)
            return cb(new Error('Invalid date/time format from server'));
        ret = new Date(val.year + '-' + val.month + '-' + val.date + 'T' + val.hour
                       + ':' + val.minute + ':' + val.second + 'Z');
        cb(undefined, ret);
    });
};

/* interim structure
{
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
}
*/

const FtpDeployer = function () {
    // The constructor for the super class.
    events.EventEmitter.call(this);
    this.ftp = null;
    this.eventObject = {
        totalFilesCount: 0,
        transferredFileCount: 0,
        filename: "",
    };

    // If the file doesn't exist, this function resolves to undefined.
    this.lastMod = function (path) {
        if (this.ftp.stat) {
            return this.ftp
                .stat(path)
                .then((stats)=>{
                    return stats.modifyTime;
                })
                .catch((e)=>{
                    if (e.code=="ENOENT")
                        return Promise.resolve(undefined);

                    return Promise.reject(e);
                });
        }

        else if (this.ftp.lastMod) {
            return this.ftp
                .lastMod(path)
                .catch((e)=>{
                    // Error code 550 means the file doesn't exist.
                    if (e.code==550)
                        return Promise.resolve(undefined);

                    return Promise.reject(e);
                });
        }

        else {
            return Promise.reject(new Error("Unable to check modification time."));
        }
    }

    this.makeAllAndUpload = function (remoteDir, filemap) {
        let keys = Object.keys(filemap);
        return lib.mapSeries(keys, (key) => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    };

    this.makeDir = function (newDirectory) {
        if (newDirectory === "/") {
            return Promise.resolve("unused");
        } else {
            return this.ftp.mkdir(newDirectory, true);
        }
    };

    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.makeAndUpload = (config, relDir, fnames) => {
        let newDirectory = upath.join(config.remoteRoot, relDir);
        return this.makeDir(newDirectory, true).then(() => {
            // console.log("newDirectory", newDirectory);
            return lib.mapSeries(fnames, (fname) => {
                let tmpFileName = upath.join(config.localRoot, relDir, fname);
                let tmp = fs.readFileSync(tmpFileName);
                this.eventObject["filename"] = upath.join(relDir, fname);

                let checkModTime=()=>{
                    if (!config.newFilesOnly)
                        return Promise.resolve(true);

                    return this.lastMod(upath.join(config.remoteRoot, relDir, fname))
                        .then((remoteModDate)=>{
                            let tmpStats=fs.statSync(tmpFileName);
                            if (remoteModDate && remoteModDate>=tmpStats.mtime) {
                                return false;
                            }

                            return true;
                        });
                }

                return checkModTime()
                    .then((shouldUpload)=>{
                        if (shouldUpload) {
                            this.emit("uploading", this.eventObject);
                            return this.ftp.put(tmp, upath.join(config.remoteRoot, relDir, fname))
                        }

                        else {
                            this.emit("skipping", this.eventObject);
                            return Promise.resolve();
                        }
                    })
                    .then(()=>{
                        this.eventObject.transferredFileCount++;
                        this.emit("uploaded", this.eventObject);
                        return Promise.resolve("uploaded " + tmpFileName);
                    })
                    .catch((err) => {
                        this.eventObject["error"] = err;
                        this.emit("upload-error", this.eventObject);
                        // if continue on error....
                        return Promise.reject(err);
                    });
            });
        });
    };

    // connects to the server, Resolves the config on success
    this.connect = (config) => {
        this.ftp = config.sftp ? new PromiseSftp() : new PromiseFtp();

        // sftp client does not provide a connection status
        // so instead provide one ourselfs
        if (config.sftp) {
            this.connectionStatus = "disconnected";
            this.ftp.on("end", this.handleDisconnect);
            this.ftp.on("close", this.handleDisconnect);
        }

        return this.ftp
            .connect(config)
            .then((serverMessage) => {
                this.emit("log", "Connected to: " + config.host);
                this.emit("log", "Connected: Server message: " + serverMessage);

                // node-ftp hack fix: apply the fixed function to the
                // underlying node-ftp instance.
                if (this.ftp.lastMod) {
                    this.ftp.rawClient.lastMod = fixedLastMod;
                }

                // sftp does not provide a connection status
                // so instead provide one ourself
                if (config.sftp) {
                    this.connectionStatus = "connected";
                }

                return config;
            })
            .catch((err) => {
                return Promise.reject({
                    code: err.code,
                    message: "connect: " + err.message,
                });
            });
    };

    this.getConnectionStatus = () => {
        // only ftp client provides connection status
        // sftp client connection status is handled using events
        return typeof this.ftp.getConnectionStatus === "function"
            ? this.ftp.getConnectionStatus()
            : this.connectionStatus;
    };

    this.handleDisconnect = () => {
        this.connectionStatus = "disconnected";
    };

    // creates list of all files to upload and starts upload process
    this.checkLocalAndUpload = (config) => {
        try {
            let filemap = lib.parseLocal(
                config.include,
                config.exclude,
                config.localRoot,
                "/"
            );
            // console.log(filemap);
            this.emit(
                "log",
                "Files found to upload: " + JSON.stringify(filemap)
            );
            this.eventObject["totalFilesCount"] = lib.countFiles(filemap);

            return this.makeAllAndUpload(config, filemap);
        } catch (e) {
            return Promise.reject(e);
        }
    };

    // Deletes remote directory if requested by config
    // Returns config
    this.deleteRemote = (config) => {
        if (config.deleteRemote) {
            return lib
                .deleteDir(this.ftp, config.remoteRoot)
                .then(() => {
                    this.emit("log", "Deleted directory: " + config.remoteRoot);
                    return config;
                })
                .catch((err) => {
                    this.emit(
                        "log",
                        "Deleting failed, trying to continue: " +
                            JSON.stringify(err)
                    );
                    return Promise.resolve(config);
                });
        }
        return Promise.resolve(config);
    };

    this.deploy = function (config, cb) {
        return lib
            .checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect)
            .then(this.deleteRemote)
            .then(this.checkLocalAndUpload)
            .then((res) => {
                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null, res);
                } else {
                    return Promise.resolve(res);
                }
            })
            .catch((err) => {
                console.log("Err", err.message);
                if (this.ftp && this.getConnectionStatus() != "disconnected")
                    this.ftp.end();
                if (typeof cb == "function") {
                    cb(err, null);
                } else {
                    return Promise.reject(err);
                }
            });
    };
};

util.inherits(FtpDeployer, events.EventEmitter);

module.exports = FtpDeployer;
