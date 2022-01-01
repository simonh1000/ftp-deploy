"use strict";

const upath = require("upath");
const util = require("util");
const events = require("events");
const Promise = require("bluebird");
const fs = require("fs");
const os = require("os");
const memoryStreams = require('memory-streams');

var PromiseFtp = require("promise-ftp");
var PromiseSftp = require("ssh2-sftp-client");
const lib = require("./lib");
const path = require('path');

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

    this.makeAllAndUpload = function (remoteDir, filemap) {
        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, (key) => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    };


    this.downloadFilemap = function (remoteRoot, filemapName) {
        return new Promise((resolve, reject) => {
            this.ftp
                .cwd(remoteRoot)
                .then(() => this.ftp.get(filemapName))
                .then((stream) => {
                    var writer = new memoryStreams.WritableStream();
                    stream.pipe(writer)
                    stream.on('pause', () => {
                        // I am not entirely sure while memory stream don't eat this 
                        stream.resume();
                    });
                    stream.on('finish', (data, bcd) => {
                        try {
                            let obj = JSON.parse(writer.toString());
                            resolve(obj?.filemap);
                        } catch (error) {
                            console.log("Invalid file-map")
                            // we will upload everything
                            resolve();
                        }
                    })
                })
                .catch((e) => {
                    // probably file not found we resolve to undefined.
                    resolve()
                });
        });

    }

    this.pruneFilemap = function (localFilemap, remoteFilemap, filemapToUpload) {
        let filesAlreadyUploaded = 0;
        let filesToUpload = 0;
        if (!remoteFilemap) remoteFilemap = {};
        for (let folder of Object.keys(localFilemap)) {
            let previousFiles = remoteFilemap[folder] || [];
            filemapToUpload[folder] = localFilemap[folder].filter(newFile => {
                let previousFile = previousFiles.filter(previousFile => newFile.name == previousFile.name)[0];
                let keep = (!previousFile || previousFile.mtime != newFile.mtime);
                if (keep) filesAlreadyUploaded += 1;
                else filesToUpload += 1;
                return keep;
            }).map(f => f.name);
        }
        this.emit("log", "files already uploaded", filesAlreadyUploaded);
        this.emit("log", "files to upload", filesToUpload);
    }

    this.uploadFileMap = function (remoteRoot, filemapName, filemap) {
        let filemapBuffer = Buffer.from(JSON.stringify({
            date: new Date(),
            user: os.userInfo().username,
            client: os.hostname(),
            filemap
        }), "utf-8");
        return this.ftp
            .cwd(remoteRoot)
            .then(() => this.ftp.put(filemapBuffer, filemapName));
    }


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
                this.eventObject["filename"] = upath.join(relDir, fname);

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
            let localFilemap = lib.parseLocal(
                config.include,
                config.exclude,
                config.localRoot,
                "/",
                config.updateNewerFiles
            );
            let filemapName = config.filemapName || ".ftp-deploy-file-map.json"

            let uploadFiles = (filemap) => {
                // console.log(filemap);
                this.emit("log",
                    "Files found to upload: " + JSON.stringify(filemap)
                );
                this.eventObject["totalFilesCount"] = lib.countFiles(filemap);

                return this.makeAllAndUpload(config, filemap);
                return result;
            };

            if (config.updateNewerFiles) {
                let filemapToUpload = {};
                return this.downloadFilemap(config.remoteRoot, filemapName)
                    .then((remoteFilemap) => this.pruneFilemap(localFilemap, remoteFilemap, filemapToUpload))
                    .then(() => uploadFiles(filemapToUpload))
                    .then(() => this.uploadFileMap(config.remoteRoot, filemapName, localFilemap));
            } else return uploadFiles(localFilemap);

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
