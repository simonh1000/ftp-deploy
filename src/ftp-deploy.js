"use strict";

const fs = require("fs");
const path = require("path");
const upath = require("upath");
const util = require("util");
const events = require("events");
const Promise = require("bluebird");

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
    this.transferFileMap = null,
    this.deleteFileMap = null,
    this.ftp = null;
    this.eventObject = {
        totalFilesCount: 0,
        transferredFileCount: 0,
        deletedFileCount: 0,
        filename: "",
    };

    this.execUpload = (config) => {
        let keys = Object.keys(this.transferFileMap);
        // check if has incremental hash filename - if yes put at last on upload list
        let parked_fileFolderHashSums = false;
        if (config.fileFolderHashSums && (config.fileFolderHashSums != '')) {
            const check_filemap = this.transferFileMap['/'] || [];
            for (let i = 0; i < check_filemap.length; i++) {
                if (check_filemap[i] == config.fileFolderHashSums) {
                    parked_fileFolderHashSums = true;
                    check_filemap.splice(i, 1);
                    this.transferFileMap['/'] = check_filemap;
                    break;
                }
            }
        }
        // append special $ key if need for parked
        if (parked_fileFolderHashSums) { keys.push('$'); }

        return Promise.mapSeries(keys, (key) => {
            if (key == '$') {
                return this.makeAndUpload(config, '/', [config.fileFolderHashSums]);
            }
            else {
                return this.makeAndUpload(config, key, this.transferFileMap[key]);
            }
        });
    };

    this.makeDir = (newDirectory) => {
        if (newDirectory === "/") {
            return Promise.resolve("unused");
        } else {
            return this.ftp.mkdir(newDirectory, true);
        }
    };

    this.incrementalUpdate = (config, ftp_fileFolderHashSumsContent) => {
        const diff_content = lib.getFolderHashSumsDiffs(
                                 config.fileFolderHashSums,
                                 config.localRoot,
                                 ftp_fileFolderHashSumsContent
                             );
        if (diff_content) {
            config.include = diff_content.upload;
            config.delete = diff_content.delete;
        }
        return config
    }

    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.getRemoteHashFile = (config) => {
        if (!config.fileFolderHashSums || (config.fileFolderHashSums == "") || !config.deleteRemote) {
            return config;
        } else {
            const fname = path.posix.join(config.remoteRoot, config.fileFolderHashSums);
            return this.ftp.get(fname).then(stream => {
                // create a new reader promise
                return new Promise(function (resolve, reject) {
                    // buffer reader
                    stream.on('readable', () => {
                        let buf = stream.read(1024*1024*10);
                        if (buf != null) {
                            // watch dog timer to close connection while file was loaded
                            setTimeout(() => { stream.destroy(); }, 1000);
                            // send the readed buf in once to .then
                            resolve("" + buf);
                        }
                    });
                })
            })
            .then((content) => {
                return this.incrementalUpdate(config, content);
            })
            .catch((err) => {
                // we need to update all
                config.include = ["**/*"]
                config.delete = ["/"]
                return config;
            })
        }
    }

    // Creates a remote directory and uploads all of the files in it
    // Resolves a confirmation message on success
    this.makeAndUpload = (config, relDir, fnames) => {
        let newDirectory = upath.join(config.remoteRoot, relDir);
        return this.makeDir(newDirectory, true).then(() => {
            // console.log("newDirectory", newDirectory);
            return Promise.mapSeries(fnames, (fname) => {
                let tmpFileName = upath.join(config.localRoot, relDir, fname);
                let tmp = fs.readFileSync(tmpFileName);
                this.eventObject["filename"] = upath.join(config.remoteRoot, relDir, fname);

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
    this.checkLocal = (config) => {
        try {
            this.transferFileMap = lib.parseLocal(
                config.include,
                config.exclude,
                config.localRoot,
                "/"
            );

            // console.log(this.transferFileMap);
            this.emit(
                "log",
                "Files found to upload: " + JSON.stringify(this.transferFileMap)
            );
            this.eventObject["totalFilesCount"] += lib.countFiles(this.transferFileMap);

            return Promise.resolve(config);
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

                this.deleteFileMap = this.deleteFileMap.concat(dirNames, fnames);
                this.eventObject["totalFilesCount"] += dirNames.length + fnames.length;

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
            this.deleteFileMap = [];
            let filemap = lib.parseDeletes(
                config.delete,
                config.remoteRoot,
                (config.fileFolderHashSums && (config.fileFolderHashSums != ''))
            );
            return this
                .execDeleteRemotes(filemap, config.remoteRoot)
                .then((done) => {
                    this.emit("log", "Deleted remotes: " + JSON.stringify(done));
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
            .then(this.getRemoteHashFile)
            .then(this.checkLocal)
            .then(this.deleteRemote)
            .then(this.execUpload)
            .then((res) => {
                this.ftp.end();
                const data = {
                  totalFilesCount: this.eventObject.totalFilesCount,
                  transferredFileCount: this.eventObject.transferredFileCount,
                  deletedFileCount: this.eventObject.deletedFileCount,
                  transferFileMap: this.transferFileMap,
                  deleteFileMap: this.deleteFileMap,
                  res: res,
                }
                if (typeof cb == "function") {
                    cb(null, data);
                } else {
                    return Promise.resolve(data);
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
