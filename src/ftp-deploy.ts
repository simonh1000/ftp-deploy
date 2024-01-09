import upath from "upath";
import events from "events";
import fs from "fs";
import PromiseFtp from "promise-ftp";
import PromiseSftp from "ssh2-sftp-client";
import Promise from "bluebird";

import lib from "./lib";
import { FileMap, Ftp, FtpDeployConfig } from "./types";

/* interim structure
{
    '/': ['test-inside-root.txt'],
    'folderA': ['test-inside-a.txt'],
    'folderA/folderB': ['test-inside-b.txt'],
    'folderA/folderB/emptyC': [],
    'folderA/folderB/emptyC/folderD': ['test-inside-d-1.txt', 'test-inside-d-2.txt']
}
*/

class FtpDeployer extends events.EventEmitter {
    connectionStatus: undefined | "disconnected" | "connected";
    ftp: Ftp | null;
    eventObject: {
        totalFilesCount: number;
        transferredFileCount: number;
        filename: string;
        error?: Error;
    };

    // The constructor for the super class.
    // TODO: Add config: FtpDeployConfig as an argument to prevent future null checks on this.ftp
    constructor() {
        super();

        // TODO: remove if redundant to super()
        events.EventEmitter.call(this);
        this.ftp = null;
        this.eventObject = {
            totalFilesCount: 0,
            transferredFileCount: 0,
            filename: "",
            error: undefined,
        };
    }

    private makeAllAndUpload(remoteDir: FtpDeployConfig, filemap: FileMap) {
        let keys = Object.keys(filemap);
        return Promise.mapSeries(keys, (key) => {
            return this.makeAndUpload(remoteDir, key, filemap[key]);
        });
    }

    private makeDir(newDirectory: string) {
        if (this.ftp === null) {
            return Promise.reject("ftp object is null");
        }

        if (newDirectory === "/") {
            return Promise.resolve("unused");
        }

        return this.ftp.mkdir(newDirectory, true);
    }

    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    private makeAndUpload(
        config: FtpDeployConfig,
        relDir: string,
        fnames: string[]
    ) {
        let newDirectory = upath.join(config.remoteRoot, relDir);

        return this.makeDir(newDirectory).then(() => {
            return Promise.mapSeries(fnames, (fname) => {
                if (this.ftp === null) {
                    return Promise.reject("ftp object is null");
                }
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
                    .catch((err: Error) => {
                        this.eventObject["error"] = err;
                        this.emit("upload-error", this.eventObject);
                        // if continue on error....
                        return Promise.reject(err);
                    });
            });
        });
    }

    // connects to the server, Resolves the config on success
    private connect(config: FtpDeployConfig) {
        this.ftp = config.sftp ? new PromiseSftp() : new PromiseFtp();

        // sftp client does not provide a connection status
        // so instead provide one ourselfs
        if (this.ftp instanceof PromiseSftp) {
            this.connectionStatus = "disconnected";
            this.ftp.on("end", this.handleDisconnect);
            this.ftp.on("close", this.handleDisconnect);
        }

        return this.ftp
            .connect(config)
            .then((serverMessage: string) => {
                this.emit("log", "Connected to: " + config.host);
                this.emit("log", "Connected: Server message: " + serverMessage);

                // sftp does not provide a connection status
                // so instead provide one ourself
                if (config.sftp) {
                    this.connectionStatus = "connected";
                }

                return config;
            })
            .catch((err: Error) => {
                return Promise.reject({
                    code: "code" in err ? err.code : "unknown",
                    message: "connect: " + err.message,
                });
            });
    }

    private getConnectionStatus() {
        // only ftp client provides connection status
        // sftp client connection status is handled using events
        return this.ftp !== null && "getConnectionStatus" in this.ftp
            ? this.ftp.getConnectionStatus()
            : this.connectionStatus;
    }

    private handleDisconnect() {
        this.connectionStatus = "disconnected";
    }

    // creates list of all files to upload and starts upload process
    private checkLocalAndUpload(config: FtpDeployConfig) {
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
    private deleteRemote(config: FtpDeployConfig) {
        if (config.deleteRemote) {
            return lib
                .deleteDir(this.ftp, config.remoteRoot)
                .then(() => {
                    this.emit("log", "Deleted directory: " + config.remoteRoot);
                    return config;
                })
                .catch((err: Error) => {
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

    public deploy(config: FtpDeployConfig, cb) {
        return lib
            .checkIncludes(config)
            .then(lib.getPassword)
            .then(this.connect)
            .then(this.deleteRemote)
            .then(this.checkLocalAndUpload)
            .then((res) => {
                if (this.ftp === null) {
                    return Promise.reject("ftp object is null");
                }

                this.ftp.end();
                if (typeof cb == "function") {
                    cb(null, res);
                } else {
                    return Promise.resolve(res);
                }
            })
            .catch((err: Error) => {
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
