"use strict";

const path = require("path");
const upath = require("upath");
const util = require("util");
const events = require("events");
const Promise = require("bluebird");
const fs = require("fs");

var PromiseFtp = require("promise-ftp");
const lib = require("./lib");

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
        deletedFileCount: 0,
        filename: "",
    };

    this.makeAllAndUpload = function (remoteDir, filemap) {
        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, (key) => {
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
            return Promise.mapSeries(fnames, (fname) => {
                let tmpFileName = upath.join(config.localRoot, relDir, fname);
                let tmp = fs.readFileSync(tmpFileName);
                this.eventObject["filename"] = upath.join(config.remoteRoot, fname);

                this.emit("uploading", this.eventObject);

                return this.ftp
                    .put(tmp, upath.join(config.remoteRoot, relDir, fname))
                    .then(() => {
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
        this.ftp = new PromiseFtp();

        return this.ftp
            .connect(config)
            .then((serverMessage) => {
                this.emit("log", "Connected to: " + config.host);
                this.emit("log", "Connected: Server message: " + serverMessage);

                return config;
            })
            .catch((err) => {
                return Promise.reject({
                    code: err.code,
                    message: "connect: " + err.message,
                });
            });
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

    this.execDeleteRemotes= (deletes, remoteRootDir='') => {
        return Promise.mapSeries(deletes, item => {
            // use parent dir to locate search mask
            let dir = path.posix.join(remoteRootDir, item.split('/').slice(0,-1).join('/'));
            let fmask = item.split('/').slice(-1);

            return this.ftp.list(dir).then(lst => {

                let dirNames = lst
                    .filter(f => f.type == "d" && f.name != ".." && f.name != "." && ((fmask == '') || (f.name == fmask)))
                    .map(f => path.posix.join(dir, f.name));

                let fnames = lst
                    .filter(f => (f.type != "d" && ((fmask == '') || (f.name == fmask))))
                    .map(f => path.posix.join(dir, f.name));

                // delete sub-directories and then all files
                return Promise.mapSeries(dirNames, dirName => {
                    // deletes everything in sub-directory, and then itself
                    return this
                        .execDeleteRemotes([dirName + '/'])
                        .then(() => this.ftp.rmdir(dirName)
                            .then(() => {
                              this.eventObject.deletedFileCount++;
                              this.eventObject["filename"] = dirName;
                              this.emit("removed", this.eventObject);
                            })
                        );
                })
                    .then(() =>
                        Promise.mapSeries(fnames, fname =>
                            this.ftp.delete(fname)
                                .then(() => {
                                    this.eventObject.deletedFileCount++;
                                    this.eventObject["filename"] = fname;
                                    this.emit("removed", this.eventObject);
                                })
                        )
                    );
            })
        });
    }

    // Deletes remote directory if requested by config
    // Returns config
    this.deleteRemote = (config) => {
        if (config.deleteRemote) {
            let filemap = lib.parseDeletes(
                config.delete,
                config.remoteRoot
            );
            return this
                .execDeleteRemotes(filemap, config.remoteRoot)
                .then((done) => {
                    this.emit("log", "Deleted remotes: " + JSON.stringify(filemap));
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
                if (
                    this.ftp &&
                    this.ftp.getConnectionStatus() != "disconnected"
                )
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
