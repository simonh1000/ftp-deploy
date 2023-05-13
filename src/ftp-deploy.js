"use strict";

const EventEmitter = require("events");
const upath = require("upath");
const Promise = require("bluebird");
const fs = require("fs");

var PromiseFtp = require("promise-ftp");
var PromiseSftp = require("ssh2-sftp-client");
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

class FtpDeployer extends EventEmitter {
    constructor() {
        // The constructor for the super class.
        // events.EventEmitter.call(this);
        super();
        this.ftp = null;
        this.eventObject = {
            totalFilesCount: 0,
            transferredFileCount: 0,
            filename: "",
        };
    }

    makeAllAndUpload(remoteDir, filemap) {
        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, (key) => {
            // console.log("Processing", key, filemap[key]);
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    }

    makeDir(newDirectory) {
        if (newDirectory === "/") {
            return Promise.resolve("unused");
        } else {
            return this.ftp.mkdir(newDirectory, true);
        }
    }
    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    makeAndUpload(config, relDir, fnames) {
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
    }

    // connects to the server, Resolves the config on success
    connect(config) {
        console.log(this.ftp);
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
    }

    getConnectionStatus() {
        // only ftp client provides connection status
        // sftp client connection status is handled using events
        return typeof this.ftp.getConnectionStatus === "function"
            ? this.ftp.getConnectionStatus()
            : this.connectionStatus;
    }

    handleDisconnect = () => {
        this.connectionStatus = "disconnected";
    };

    // creates list of all files to upload and starts upload process
    checkLocalAndUpload(config) {
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
    }

    // Deletes remote directory if requested by config
    // Returns config
    deleteRemote(config) {
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
    }

    deploy(config, cb) {
        console.log(config);
        return lib
            .checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect.bind(this))
            .then(this.deleteRemote.bind(this))
            .then(this.checkLocalAndUpload.bind(this))
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
    }
}

module.exports = FtpDeployer;
