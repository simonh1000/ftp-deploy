"use strict";

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

const FtpDeployer = function() {
    // The constructor for the super class.
    events.EventEmitter.call(this);
    this.ftp = null;
    this.eventObject = {
        totalFilesCount: 0,
        transferredFileCount: 0,
        filename: ""
    };

    this.makeAllAndUpload = function(remoteDir, filemap) {
        // TODO pass on the full object

        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, key => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    };

    this.makeDir = function(newDirectory) {
        if (newDirectory === "/") {
            return Promise.resolve("unused");
        } else {
            return this.ftp.mkdir(newDirectory, true);
        }
    };
    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.makeAndUpload = (config, relDir, localFileMetas) => {
        let newRemoteDir = upath.join(config.remoteRoot, relDir);
        // console.log("newRemoteDir", newRemoteDir);
        // ensure directory we need exists. Will resolve if dir already exists
        return this.makeDir(newRemoteDir)
            .then(() => {
                return this.ftp.list(newRemoteDir).then(remoteStats => {
                    return remoteStats.reduce((acc, item) => {
                        acc[item.name] = {
                            size: item.size,
                            date: new Date(item.date).getTime()
                        };
                        return acc;
                    }, {});
                });
            })
            .then(remoteStats => {
                return Promise.mapSeries(localFileMetas, meta => {
                    // console.log("remoteStats", remoteStats[meta.fname], meta);
                    let tmpLocalName = upath.join(
                        config.localRoot,
                        relDir,
                        meta.fname
                    );

                    if (
                        remoteStats[meta.fname] &&
                        remoteStats[meta.fname].size == meta.size &&
                        remoteStats[meta.fname].date >= meta.mtime
                    ) {
                        this.emit("log", "skipping: " + meta.fname);
                        return Promise.resolve("skipped " + tmpLocalName);
                    }

                    let localFile = fs.readFileSync(tmpLocalName);
                    this.eventObject["filename"] = upath.join(
                        relDir,
                        meta.fname
                    );

                    this.emit("uploading", this.eventObject);

                    return this.ftp
                        .put(
                            localFile,
                            upath.join(config.remoteRoot, relDir, meta.fname)
                        )
                        .then(() => {
                            this.eventObject.transferredFileCount++;
                            this.emit("uploaded", this.eventObject);
                            return Promise.resolve("uploaded " + tmpLocalName);
                        })
                        .catch(err => {
                            this.eventObject["error"] = err;
                            this.emit("upload-error", this.eventObject);
                            // if continue on error....
                            return Promise.reject(err);
                        });
                });
            });
    };

    // connects to the server, Resolves the config on success
    this.connect = config => {
        this.ftp = new PromiseFtp();

        return this.ftp.connect(config).then(serverMessage => {
            this.emit("log", "Connected to: " + config.host);
            this.emit("log", "Connected: Server message: " + serverMessage);

            return config;
        });
    };

    // creates list of all files to upload and starts upload process
    this.checkLocalAndUpload = config => {
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
    this.deleteRemote = config => {
        if (config.deleteRemote) {
            return lib
                .deleteDir(this.ftp, config.remoteRoot)
                .then(() => {
                    this.emit("log", "Deleted directory: " + config.remoteRoot);
                    return config;
                })
                .catch(err => {
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

    this.deploy = function(config, cb) {
        return lib
            .checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect)
            .then(this.deleteRemote)
            .then(this.checkLocalAndUpload)
            .then(res => {
                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null, res);
                } else {
                    return Promise.resolve(res);
                }
            })
            .catch(err => {
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
